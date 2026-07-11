import { describe, it, expect } from 'vitest';
import { orderJourney, driverDayPlan, buildTrips, sequenceOrders, etaEnd, fmtDuration, legKm, SHIFT_MINUTES } from './logistics';
import type { Order } from '@/types';

const coords: Record<string, { lat: number; lng: number }> = {
  'hub-1': { lat: 40.7128, lng: -74.006 },
  'hub-4': { lat: 40.6413, lng: -73.7781 }, // ~20 km from hub-1
  'hub-near': { lat: 40.7128, lng: -74.006 }, // same as hub-1
  'hub-close': { lat: 40.72, lng: -74.0 }, // ~1 km from hub-1
  'hub-far': { lat: 40.9, lng: -73.7 }, // far NE
};
const coordOf = (id: string) => coords[id];

const mkOrder = (id: string, sourceId: string, destinationId: string, quantity: number): Order => ({
  id, sourceId, destinationId, product: 'diesel', quantity,
  deliveryDate: '2026-01-01', assignedDriverId: 'driver-1', status: 'assigned',
});

describe('orderJourney', () => {
  it('is just load+unload when source and destination coincide', () => {
    const leg = orderJourney(mkOrder('o', 'hub-1', 'hub-near', 5000), coordOf);
    expect(leg.km).toBe(0);
    expect(leg.minutes).toBe(60); // 30 load + 30 unload, no travel
  });
  it('adds round-trip travel for distant destinations', () => {
    const leg = orderJourney(mkOrder('o', 'hub-1', 'hub-4', 5000), coordOf);
    expect(leg.km).toBeGreaterThan(15);
    expect(leg.minutes).toBeGreaterThan(60);
  });
});

describe('driverDayPlan', () => {
  it('is feasible for a light day and computes utilisation', () => {
    const plan = driverDayPlan([mkOrder('o', 'hub-1', 'hub-4', 6000)], coordOf, 12000);
    expect(plan.feasible).toBe(true);
    expect(plan.utilisation).toBeCloseTo(0.5);
    expect(plan.underutilised).toBe(false);
  });
  it('flags under-utilisation for a tiny load in a big tanker', () => {
    const plan = driverDayPlan([mkOrder('o', 'hub-1', 'hub-4', 800)], coordOf, 15000);
    expect(plan.underutilised).toBe(true); // 800/15000 ≈ 5%
  });
  it('flags overbooked when the day exceeds the shift window', () => {
    // A single load with many drops: 16 × ~30 min unload alone overruns the 8h shift.
    const orders = Array.from({ length: 16 }, (_, i) => mkOrder(`o${i}`, 'hub-4', 'hub-far', 1000));
    const plan = driverDayPlan(orders, coordOf, 18000);
    expect(plan.totalMinutes).toBeGreaterThan(SHIFT_MINUTES);
    expect(plan.feasible).toBe(false);
    expect(plan.overMinutes).toBeGreaterThan(0);
  });
  it('models a milk-run: one load, chained drops (not a round trip per order)', () => {
    const orders = [
      mkOrder('a', 'hub-1', 'hub-close', 3000),
      mkOrder('b', 'hub-1', 'hub-4', 3000),
    ];
    const plan = driverDayPlan(orders, coordOf, 12000);
    // one trip (shared source), two drops, loaded once
    expect(plan.trips).toHaveLength(1);
    expect(plan.trips[0].drops).toHaveLength(2);
    expect(plan.trips[0].load).toBe(6000);
    // chained drops are cheaper than two independent round trips back to the source
    const roundTrips = orderJourney(orders[0], coordOf).minutes + orderJourney(orders[1], coordOf).minutes;
    expect(plan.totalMinutes).toBeLessThan(roundTrips);
  });
  it('splits into one trip per pickup source and adds inter-trip travel', () => {
    const orders = [
      mkOrder('a', 'hub-1', 'hub-close', 2000),
      mkOrder('b', 'hub-4', 'hub-far', 2000),
    ];
    const plan = driverDayPlan(orders, coordOf, 12000);
    expect(plan.trips.map((t) => t.sourceId)).toEqual(['hub-1', 'hub-4']);
    // inter-trip deadhead (last drop of trip 1 → source of trip 2) is included
    const tripKm = plan.trips.reduce((n, t) => n + t.km, 0);
    expect(plan.totalKm).toBeGreaterThan(tripKm);
  });
  it('skips inter-trip travel when the next trip source has unknown coordinates', () => {
    const orders = [
      mkOrder('a', 'hub-1', 'hub-close', 2000),
      mkOrder('b', 'ghost', 'hub-far', 2000), // second trip source has no coordinates
    ];
    const plan = driverDayPlan(orders, coordOf, 12000);
    expect(plan.trips).toHaveLength(2);
    // no inter-trip deadhead is added (nextSrc undefined), so totalKm is just the trip legs
    const tripKm = plan.trips.reduce((n, t) => n + t.km, 0);
    expect(plan.totalKm).toBeCloseTo(tripKm);
  });
  it('adds a deadhead when the vehicle starts away from the first pickup', () => {
    const orders = [mkOrder('o', 'hub-1', 'hub-4', 5000)];
    const base = driverDayPlan(orders, coordOf, 12000);
    // truck currently sitting at hub-4, ~20 km from the hub-1 pickup
    const withDeadhead = driverDayPlan(orders, coordOf, 12000, coords['hub-4']);
    expect(withDeadhead.reposition?.km).toBeGreaterThan(15);
    expect(withDeadhead.totalMinutes).toBeGreaterThan(base.totalMinutes);
  });
});

describe('buildTrips', () => {
  it('tolerates unknown source and destination coordinates', () => {
    const trips = buildTrips([mkOrder('a', 'nope', 'nowhere', 1000)], coordOf);
    expect(trips).toHaveLength(1);
    expect(trips[0].drops[0].km).toBe(0);
    expect(trips[0].minutes).toBeGreaterThan(0); // load + unload, no travel
  });
});

describe('sequenceOrders', () => {
  it('orders deliveries nearest-first from the start position', () => {
    const far = mkOrder('far', 'hub-1', 'hub-far', 1000);
    const close = mkOrder('close', 'hub-1', 'hub-close', 1000);
    const seq = sequenceOrders([far, close], coordOf, coords['hub-1']);
    expect(seq.map((o) => o.id)).toEqual(['close', 'far']); // close before far
  });
  it('returns the same set of orders', () => {
    const orders = [mkOrder('a', 'hub-1', 'hub-4', 1), mkOrder('b', 'hub-1', 'hub-close', 1)];
    expect(sequenceOrders(orders, coordOf).map((o) => o.id).sort()).toEqual(['a', 'b']);
  });
  it('returns an empty array for no orders', () => {
    expect(sequenceOrders([], coordOf)).toEqual([]);
  });
  it('tolerates unknown destination coordinates (no start position)', () => {
    const orders = [mkOrder('a', 'unknown', 'unknown', 1), mkOrder('b', 'unknown', 'unknown', 1)];
    expect(sequenceOrders(orders, coordOf).map((o) => o.id).sort()).toEqual(['a', 'b']);
  });
});

describe('orderJourney / legKm without coordinates', () => {
  it('falls back to load+unload only when a hub is unknown', () => {
    const leg = orderJourney(mkOrder('o', 'unknown-a', 'unknown-b', 5000), coordOf);
    expect(leg.km).toBe(0);
    expect(leg.minutes).toBe(60);
  });
  it('legKm is the one-way pickup→dropoff distance, or 0 when unknown', () => {
    expect(legKm(mkOrder('o', 'hub-1', 'hub-4', 1), coordOf)).toBeGreaterThan(15);
    expect(legKm(mkOrder('o', 'hub-1', 'nope', 1), coordOf)).toBe(0);
  });
  it('skips the deadhead when the first pickup hub is unknown', () => {
    const plan = driverDayPlan([mkOrder('o', 'nope', 'hub-4', 1000)], coordOf, 5000, coords['hub-4']);
    expect(plan.reposition?.km).toBe(0);
  });
});

describe('etaEnd / fmtDuration', () => {
  it('adds minutes to a start time', () => {
    expect(etaEnd('2026-01-01T08:00:00', 90)).toBe(new Date('2026-01-01T09:30:00').toISOString());
  });
  it('formats durations', () => {
    expect(fmtDuration(90)).toBe('1h 30m');
    expect(fmtDuration(45)).toBe('45m');
  });
});
