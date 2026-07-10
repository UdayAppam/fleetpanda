import { describe, it, expect } from 'vitest';
import { orderJourney, driverDayPlan, sequenceOrders, etaEnd, fmtDuration, legKm, SHIFT_MINUTES } from './logistics';
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
    // many long round trips push total minutes over the 8h shift
    const orders = Array.from({ length: 8 }, (_, i) => mkOrder(`o${i}`, 'hub-4', 'hub-1', 2000));
    const plan = driverDayPlan(orders, coordOf, 18000);
    expect(plan.totalMinutes).toBeGreaterThan(SHIFT_MINUTES);
    expect(plan.feasible).toBe(false);
    expect(plan.overMinutes).toBeGreaterThan(0);
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
