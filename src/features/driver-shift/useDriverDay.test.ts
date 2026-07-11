import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { useDriverDay } from './useDriverDay';
import { renderHookWithProviders, makeStore } from '@/test/renderWithProviders';
import { resetDb, getDb } from '@/test/mswServer';
import { loginSuccess } from '@/store/slices/authSlice';
import { today, __setToday } from '@/utils/clock';
import type { Order, User } from '@/types';

const iso = today();
afterEach(() => __setToday(iso)); // some cases pin "today"; always restore the real one
const driverUser: User = { id: 'user-driver', email: 'd@x.com', name: 'John', role: 'driver', driverId: 'driver-1' };

function driverStore() {
  const store = makeStore();
  store.dispatch(loginSuccess({ user: driverUser, token: 't' }));
  return store;
}

function seedToday(overrides: { active?: boolean; stockShort?: boolean } = {}) {
  const db = getDb();
  db.hubs = [
    { id: 'hub-1', name: 'Downtown', locationType: 'hub', address: 'x', coordinates: { lat: 40, lng: -74 }, inventory: { diesel: overrides.stockShort ? 100 : 15000 } },
    { id: 'hub-3', name: 'Northgate', locationType: 'hub', address: 'y', coordinates: { lat: 40.7, lng: -73.9 }, inventory: { diesel: 9800 } },
  ];
  db.allocations = [{ id: 'a1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: iso }];
  db.orders = [
    { id: 'o1', sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel', quantity: 5000, deliveryDate: iso, assignedDriverId: 'driver-1', status: 'assigned' },
  ];
  if (overrides.active) {
    db.shifts = [{ id: 'shift-1', driverId: 'driver-1', vehicleId: 'vehicle-1', date: iso, status: 'active', startedAt: '', endedAt: null, orderIds: ['o1'] }];
  }
}

beforeEach(() => resetDb());

describe('useDriverDay', () => {
  it("returns today's allocation, orders and a ready-to-start status", async () => {
    seedToday();
    const { result } = renderHookWithProviders(() => useDriverDay(), { store: driverStore() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.driverId).toBe('driver-1');
    expect(result.current.orders).toHaveLength(1);
    expect(result.current.allocatedVehicle?.registration).toBe('TRK-101');
    expect(result.current.readiness.ready).toBe(true);
    expect(result.current.activeShift).toBeUndefined();
  });

  it('surfaces the active shift when one is running', async () => {
    seedToday({ active: true });
    const { result } = renderHookWithProviders(() => useDriverDay(), { store: driverStore() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.activeShift?.id).toBe('shift-1');
  });

  it('reports not-ready when source stock is short', async () => {
    seedToday({ stockShort: true });
    const { result } = renderHookWithProviders(() => useDriverDay(), { store: driverStore() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.readiness.ready).toBe(false);
  });

  it('falls back to the raw hub id when the source hub is unknown', async () => {
    const db = getDb();
    db.hubs = [
      { id: 'hub-3', name: 'Northgate', locationType: 'hub', address: 'y', coordinates: { lat: 40.7, lng: -73.9 }, inventory: { diesel: 9800 } },
    ];
    db.allocations = [{ id: 'a1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: iso }];
    // Source hub 'ghost-hub' isn't in the lookup, so the name resolver returns the id.
    db.orders = [
      { id: 'o1', sourceId: 'ghost-hub', destinationId: 'hub-3', product: 'diesel', quantity: 5000, deliveryDate: iso, assignedDriverId: 'driver-1', status: 'assigned' },
    ];
    const { result } = renderHookWithProviders(() => useDriverDay(), { store: driverStore() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.readiness.ready).toBe(false);
    expect(result.current.readiness.reason).toContain('ghost-hub');
  });

  it('summarises the driver\'s current-month orders with the next upcoming run', async () => {
    __setToday('2026-07-15');
    const db = getDb();
    const mk = (over: Partial<Order> & { id: string }): Order => ({
      sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel', quantity: 1000,
      deliveryDate: '2026-07-15', assignedDriverId: 'driver-1', status: 'assigned', ...over,
    });
    db.orders = [
      mk({ id: 'm-today' }), // today
      mk({ id: 'm-done', deliveryDate: '2026-07-05', status: 'delivered' }),
      mk({ id: 'm-fail', deliveryDate: '2026-07-08', status: 'failed' }),
      mk({ id: 'm-next', deliveryDate: '2026-07-25' }), // upcoming → nextDate
      mk({ id: 'm-other-month', deliveryDate: '2026-08-02' }), // excluded
      mk({ id: 'm-other-driver', assignedDriverId: 'driver-2' }), // excluded
    ];
    const { result } = renderHookWithProviders(() => useDriverDay(), { store: driverStore() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const m = result.current.month;
    expect(m.key).toBe('2026-07');
    expect(m.total).toBe(4);
    expect(m.delivered).toBe(1);
    expect(m.failed).toBe(1);
    expect(m.remaining).toBe(2);
    expect(m.nextDate).toBe('2026-07-25');
  });

  it('has no allocation/orders for an unauthenticated (no driverId) user', async () => {
    seedToday();
    const { result } = renderHookWithProviders(() => useDriverDay());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.driverId).toBe('');
    expect(result.current.allocation).toBeUndefined();
    expect(result.current.orders).toHaveLength(0);
  });
});
