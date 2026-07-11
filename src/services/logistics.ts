import { distanceKm, type LatLng } from '@/utils/geo';
import type { Order } from '@/types';

// Realistic logistics assumptions (see docs/DECISIONS.md ADR-23).
export const AVG_SPEED_KMH = 45; // loaded tanker in metro traffic
export const LOAD_MINUTES = 30; // gantry load at source
export const UNLOAD_MINUTES = 30; // discharge at destination
export const SHIFT_HOURS = 8; // legal driving shift (08:00–16:00)
export const SHIFT_MINUTES = SHIFT_HOURS * 60;
export const UNDER_UTIL_PCT = 0.35; // below this, the load wastes the tanker

export type CoordOf = (hubId: string) => LatLng | undefined;

export interface OrderLeg {
  orderId: string;
  km: number;
  minutes: number; // round-trip: load + travel there + unload + travel back
}

// Per-order round trip from its source (conservative approximation).
export function orderJourney(order: Order, coordOf: CoordOf): OrderLeg {
  const s = coordOf(order.sourceId);
  const d = coordOf(order.destinationId);
  const base = LOAD_MINUTES + UNLOAD_MINUTES;
  if (!s || !d) return { orderId: order.id, km: 0, minutes: base };
  const km = distanceKm(s, d);
  const travelMin = (km / AVG_SPEED_KMH) * 60 * 2; // there and back
  return { orderId: order.id, km, minutes: Math.round(base + travelMin) };
}

// A single drop within a trip: one-way travel from the previous stop, then unload.
export interface TripDrop {
  order: Order;
  km: number; // one-way distance from the previous stop (the source for the first drop)
  minutes: number; // travel + unload
}

// A "trip" = load once at a source, then drop at each destination in sequence (a milk-run).
// A driver's day is one trip per pickup source (usually just one).
export interface Trip {
  sourceId: string;
  drops: TripDrop[];
  load: number; // litres loaded for this trip
  km: number; // source → drop1 → … → dropN
  minutes: number; // load once + Σ(travel + unload)
}

export interface DayPlan {
  trips: Trip[];
  legs: OrderLeg[]; // flat per-drop legs (kept for counts / back-compat)
  totalMinutes: number;
  totalKm: number;
  feasible: boolean; // fits within the shift window
  overMinutes: number; // by how much it overruns
  load: number; // total litres moved over the day
  utilisation: number | null; // load / capacity
  underutilised: boolean; // big tanker, small load
  reposition?: { km: number; minutes: number }; // deadhead from current location to first pickup
}

// One-way travel time from the vehicle's CURRENT position to the first pickup ("deadhead").
export function repositionLeg(from: LatLng, toSourceHub: LatLng | undefined): { km: number; minutes: number } {
  if (!toSourceHub) return { km: 0, minutes: 0 };
  const km = distanceKm(from, toSourceHub);
  return { km, minutes: Math.round((km / AVG_SPEED_KMH) * 60) };
}

// Groups orders into trips by pickup source (load once per source), sequencing the drops
// within each trip nearest-first from that source.
export function buildTrips(orders: Order[], coordOf: CoordOf): Trip[] {
  const groups = new Map<string, Order[]>();
  for (const o of orders) {
    const g = groups.get(o.sourceId);
    if (g) g.push(o);
    else groups.set(o.sourceId, [o]);
  }
  const trips: Trip[] = [];
  for (const [sourceId, group] of groups) {
    const src = coordOf(sourceId);
    const seq = sequenceOrders(group, coordOf, src);
    let prev = src;
    let km = 0;
    let minutes = LOAD_MINUTES; // load once at the source
    const drops: TripDrop[] = seq.map((o) => {
      const dest = coordOf(o.destinationId);
      const legDist = prev && dest ? distanceKm(prev, dest) : 0;
      const min = Math.round((legDist / AVG_SPEED_KMH) * 60 + UNLOAD_MINUTES);
      prev = dest ?? prev;
      km += legDist;
      minutes += min;
      return { order: o, km: legDist, minutes: min };
    });
    trips.push({ sourceId, drops, load: group.reduce((n, o) => n + o.quantity, 0), km, minutes });
  }
  return trips;
}

export function driverDayPlan(
  orders: Order[],
  coordOf: CoordOf,
  capacity?: number | null,
  startFrom?: LatLng, // vehicle's live position — folds deadhead into the shift time
): DayPlan {
  const trips = buildTrips(orders, coordOf);
  const reposition =
    startFrom && trips.length ? repositionLeg(startFrom, coordOf(trips[0].sourceId)) : undefined;

  // Deadhead between trips: last drop of one trip → the next trip's source.
  let interKm = 0;
  let interMinutes = 0;
  for (let i = 1; i < trips.length; i++) {
    const prevDrops = trips[i - 1].drops; // a trip always has at least one drop
    const lastDest = coordOf(prevDrops[prevDrops.length - 1].order.destinationId);
    const nextSrc = coordOf(trips[i].sourceId);
    if (lastDest && nextSrc) {
      const k = distanceKm(lastDest, nextSrc);
      interKm += k;
      interMinutes += Math.round((k / AVG_SPEED_KMH) * 60);
    }
  }

  const tripKm = trips.reduce((n, t) => n + t.km, 0);
  const tripMinutes = trips.reduce((n, t) => n + t.minutes, 0);
  const totalKm = tripKm + interKm + (reposition?.km ?? 0);
  const totalMinutes = tripMinutes + interMinutes + (reposition?.minutes ?? 0);
  const load = orders.reduce((n, o) => n + o.quantity, 0);
  const utilisation = capacity ? load / capacity : null;
  const legs: OrderLeg[] = trips.flatMap((t) => t.drops.map((d) => ({ orderId: d.order.id, km: d.km, minutes: d.minutes })));
  return {
    trips,
    legs,
    totalMinutes,
    totalKm,
    feasible: totalMinutes <= SHIFT_MINUTES,
    overMinutes: Math.max(0, totalMinutes - SHIFT_MINUTES),
    load,
    utilisation,
    underutilised: utilisation != null && load > 0 && utilisation < UNDER_UTIL_PCT,
    reposition,
  };
}

// Orders sequenced into a delivery route: greedy nearest-destination from the start position
// (the truck's live location), so the driver's run reflects where they actually are.
export function sequenceOrders(orders: Order[], coordOf: CoordOf, startFrom?: LatLng): Order[] {
  const remaining = [...orders];
  const seq: Order[] = [];
  let cur = startFrom ?? (orders[0] ? coordOf(orders[0].sourceId) : undefined);
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((o, i) => {
      const c = coordOf(o.destinationId);
      const d = c && cur ? distanceKm(cur, c) : 0;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    const next = remaining.splice(bestIdx, 1)[0];
    seq.push(next);
    cur = coordOf(next.destinationId) ?? cur;
  }
  return seq;
}

// One-way pickup→dropoff distance for a single delivery leg (display).
export function legKm(order: Order, coordOf: CoordOf): number {
  const s = coordOf(order.sourceId);
  const d = coordOf(order.destinationId);
  return s && d ? distanceKm(s, d) : 0;
}

export const fmtDuration = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};

export function etaEnd(startIso: string, minutes: number): string {
  const d = new Date(startIso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}
