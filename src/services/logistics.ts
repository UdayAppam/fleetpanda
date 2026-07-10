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

export interface DayPlan {
  legs: OrderLeg[];
  totalMinutes: number;
  totalKm: number;
  feasible: boolean; // fits within the shift window
  overMinutes: number; // by how much it overruns
  load: number; // total litres
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

export function driverDayPlan(
  orders: Order[],
  coordOf: CoordOf,
  capacity?: number | null,
  startFrom?: LatLng, // vehicle's live position — folds deadhead into the shift time
): DayPlan {
  const legs = orders.map((o) => orderJourney(o, coordOf));
  const reposition =
    startFrom && orders.length ? repositionLeg(startFrom, coordOf(orders[0].sourceId)) : undefined;
  const legMinutes = legs.reduce((n, l) => n + l.minutes, 0) + (reposition?.minutes ?? 0);
  const totalKm = legs.reduce((n, l) => n + l.km, 0) + (reposition?.km ?? 0);
  const load = orders.reduce((n, o) => n + o.quantity, 0);
  const utilisation = capacity ? load / capacity : null;
  return {
    legs,
    totalMinutes: legMinutes,
    totalKm,
    feasible: legMinutes <= SHIFT_MINUTES,
    overMinutes: Math.max(0, legMinutes - SHIFT_MINUTES),
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
