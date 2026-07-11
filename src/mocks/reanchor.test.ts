import { describe, it, expect } from 'vitest';
import { daysBetween, shiftDate, shiftDateTime, reanchor, SEED_BASE } from './reanchor';
import type { MockDb } from './handlers';

describe('reanchor date helpers', () => {
  it('counts whole days between calendar dates', () => {
    expect(daysBetween('2026-07-10', '2026-07-17')).toBe(7);
    expect(daysBetween('2026-07-10', '2026-07-03')).toBe(-7);
    expect(daysBetween('2026-07-10', '2026-07-10')).toBe(0);
  });
  it('shifts a calendar date and a timestamp by whole days', () => {
    expect(shiftDate('2026-07-10', 5)).toBe('2026-07-15');
    expect(shiftDateTime('2026-07-10T14:00:00.000Z', 5)).toBe('2026-07-15T14:00:00.000Z');
  });
});

const db = (): MockDb => ({
  users: [],
  products: [],
  hubs: [],
  drivers: [],
  vehicles: [],
  orders: [
    { id: 'o1', sourceId: 'h1', destinationId: 'h2', product: 'diesel', quantity: 1000, deliveryDate: SEED_BASE, assignedDriverId: 'd1', status: 'delivered', completedAt: `${SEED_BASE}T14:00:00.000Z` },
  ],
  allocations: [{ id: 'a1', vehicleId: 'v1', driverId: 'd1', date: SEED_BASE }],
  shifts: [{ id: 's1', driverId: 'd1', vehicleId: 'v1', date: SEED_BASE, status: 'ended', startedAt: `${SEED_BASE}T08:00:00.000Z`, endedAt: `${SEED_BASE}T16:00:00.000Z`, orderIds: [] }],
  vehiclePositions: [{ id: 'p1', vehicleId: 'v1', driverId: 'd1', lat: 40, lng: -74, updatedAt: `${SEED_BASE}T09:00:00.000Z`, status: 'idle' }],
});

describe('reanchor', () => {
  it('shifts every dated field to the target day', () => {
    const shifted = reanchor(db(), '2026-07-20'); // +10 days
    expect(shifted.orders[0].deliveryDate).toBe('2026-07-20');
    expect(shifted.orders[0].completedAt).toBe('2026-07-20T14:00:00.000Z');
    expect(shifted.allocations[0].date).toBe('2026-07-20');
    expect(shifted.shifts[0].date).toBe('2026-07-20');
    expect(shifted.shifts[0].startedAt).toBe('2026-07-20T08:00:00.000Z');
    expect(shifted.shifts[0].endedAt).toBe('2026-07-20T16:00:00.000Z');
    expect(shifted.vehiclePositions[0].updatedAt).toBe('2026-07-20T09:00:00.000Z');
  });
  it('is a no-op when the target equals the seed base', () => {
    const same = reanchor(db(), SEED_BASE);
    expect(same.orders[0].deliveryDate).toBe(SEED_BASE);
  });
  it('leaves null/absent timestamps untouched', () => {
    const d = db();
    d.orders[0].completedAt = null;
    d.shifts[0].startedAt = null;
    d.shifts[0].endedAt = null;
    const shifted = reanchor(d, '2026-07-12');
    expect(shifted.orders[0].completedAt).toBeNull();
    expect(shifted.shifts[0].startedAt).toBeNull();
    expect(shifted.orders[0].deliveryDate).toBe('2026-07-12');
  });
});
