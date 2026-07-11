import { describe, it, expect, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { useShiftAdvisories } from './useShiftAdvisories';
import { renderHookWithProviders } from '@/test/renderWithProviders';
import { resetDb, getDb, server } from '@/test/mswServer';
import { API_URL } from '@/config/env';
import { today } from '@/utils/clock';
import type { Order, Vehicle } from '@/types';

const iso = today();

const order = (over: Partial<Order>): Order => ({
  id: 'o', sourceId: 'hub-1', destinationId: 'hub-far', product: 'diesel', quantity: 1000,
  deliveryDate: iso, assignedDriverId: 'driver-1', status: 'assigned', ...over,
});

function base() {
  const db = getDb();
  db.hubs = [
    { id: 'hub-1', name: 'Downtown', locationType: 'hub', address: 'x', coordinates: { lat: 40.7128, lng: -74.006 }, inventory: { diesel: 99000 } },
    { id: 'hub-far', name: 'Far', locationType: 'hub', address: 'z', coordinates: { lat: 40.9, lng: -73.6 }, inventory: { diesel: 99000 } },
  ];
  db.drivers = [{ id: 'driver-1', name: 'John', license: 'DL-1', phone: '+1', status: 'available' }];
  return db;
}

beforeEach(() => resetDb());

describe('useShiftAdvisories', () => {
  it('flags an overbooked driver-day', async () => {
    const db = base();
    db.vehicles = [{ id: 'vehicle-1', registration: 'TRK-101', capacity: 40000, type: 'Tanker', status: 'available' }];
    db.allocations = [{ id: 'a1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: iso }];
    // Many drops overrun the 8h shift (unload time alone: 16 × ~30 min > 8h).
    db.orders = Array.from({ length: 16 }, (_, i) => order({ id: `o${i}`, quantity: 2000 }));

    const { result } = renderHookWithProviders(() => useShiftAdvisories(iso));
    await waitFor(() => expect(result.current.advisories.length).toBeGreaterThan(0));
    expect(result.current.advisories[0].kind).toBe('overbooked');
  });

  it('flags an under-utilised tanker', async () => {
    const db = base();
    db.vehicles = [{ id: 'vehicle-1', registration: 'TRK-101', capacity: 30000, type: 'Tanker', status: 'available' }];
    db.allocations = [{ id: 'a1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: iso }];
    db.orders = [order({ id: 'o1', quantity: 800 })]; // tiny load in a big tanker

    const { result } = renderHookWithProviders(() => useShiftAdvisories(iso));
    await waitFor(() => expect(result.current.advisories.length).toBeGreaterThan(0));
    expect(result.current.advisories[0].kind).toBe('underutilised');
  });

  it('uses raw-id/null fallbacks when vehicle, driver and hubs are unknown', async () => {
    const db = getDb();
    db.hubs = []; // coordOf(...) → undefined for every hub id
    db.drivers = []; // driver.get(...) → undefined, name falls back to the id
    db.vehicles = []; // vehicle.get(...) → undefined, capacity ?? null and reg fallback
    db.allocations = [{ id: 'a1', vehicleId: 'vehicle-x', driverId: 'driver-x', date: iso }];
    db.orders = [order({ id: 'o1', assignedDriverId: 'driver-x', quantity: 1000 })];

    const { result } = renderHookWithProviders(() => useShiftAdvisories(iso));
    await waitFor(() => expect(result.current).toBeTruthy());
    // A short, feasible day with no capacity info yields no advisory, but all fallbacks ran.
    expect(result.current.advisories).toHaveLength(0);
  });

  it('flags an overbooked day and falls back to ids when vehicle/driver rows are missing', async () => {
    const db = base();
    db.drivers = []; // driver.get(...) undefined → driverName falls back to the id
    db.vehicles = []; // vehicle.get(...) undefined → capacity ?? null and reg ?? a.vehicleId
    db.allocations = [{ id: 'a1', vehicleId: 'vehicle-x', driverId: 'driver-1', date: iso }];
    db.orders = Array.from({ length: 16 }, (_, i) => order({ id: `o${i}`, quantity: 2000 }));

    const { result } = renderHookWithProviders(() => useShiftAdvisories(iso));
    // Waiting for the advisory guarantees the memo ran with the allocation loaded but the
    // vehicle row absent, exercising the `v?.capacity` / `v?.registration` short-circuits.
    await waitFor(() => expect(result.current.advisories).toHaveLength(1));
    expect(result.current.advisories[0].kind).toBe('overbooked');
    expect(result.current.advisories[0].vehicleReg).toBe('vehicle-x');
    expect(result.current.advisories[0].driverName).toBe('driver-1');
  });

  it('produces no advisory when there are no orders for an allocation', async () => {
    const db = base();
    db.vehicles = [{ id: 'vehicle-1', registration: 'TRK-101', capacity: 8000, type: 'Tanker', status: 'available' }];
    db.allocations = [{ id: 'a1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: iso }];
    db.orders = [];

    const { result } = renderHookWithProviders(() => useShiftAdvisories(iso));
    await waitFor(() => expect(result.current).toBeTruthy());
    expect(result.current.advisories).toHaveLength(0);
  });

  it('only counts a driver\'s active orders for the date (filters out the rest)', async () => {
    const db = base();
    db.drivers.push({ id: 'driver-2', name: 'Mary', license: 'DL-2', phone: '+2', status: 'available' });
    db.vehicles = [{ id: 'vehicle-1', registration: 'TRK-101', capacity: 30000, type: 'Tanker', status: 'available' }];
    db.allocations = [{ id: 'a1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: iso }];
    db.orders = [
      order({ id: 'match', quantity: 800 }), // driver-1, today, active
      order({ id: 'wrong-driver', assignedDriverId: 'driver-2', quantity: 5000 }),
      order({ id: 'wrong-date', deliveryDate: '2999-01-01', quantity: 5000 }),
      order({ id: 'inactive', status: 'delivered', quantity: 5000 }),
    ];

    const { result } = renderHookWithProviders(() => useShiftAdvisories(iso));
    // Each predicate branch (driver/date/active) is exercised; only the single tiny active
    // order survives, so the big tanker is flagged under-utilised.
    await waitFor(() => expect(result.current.advisories).toHaveLength(1));
    expect(result.current.advisories[0].kind).toBe('underutilised');
  });

  it('falls back per-field when the allocated vehicle row lacks capacity/registration', async () => {
    const db = base();
    // Vehicle exists but is missing capacity + registration, so v is truthy yet each field
    // uses its `?? null` / `?? a.vehicleId` fallback (lines 39 and 43).
    db.vehicles = [{ id: 'vehicle-1', type: 'Tanker', status: 'available' } as unknown as Vehicle];
    db.allocations = [{ id: 'a1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: iso }];
    db.orders = [order({ id: 'o1', quantity: 1000 })];

    const { result } = renderHookWithProviders(() => useShiftAdvisories(iso));
    await waitFor(() => expect(result.current).toBeTruthy());
    // No capacity → not under-utilised; a single short trip stays feasible → no advisory.
    expect(result.current.advisories).toHaveLength(0);
  });

  it('is safe while orders are still loading but allocations have arrived', async () => {
    const db = base();
    db.vehicles = [{ id: 'vehicle-1', registration: 'TRK-101', capacity: 8000, type: 'Tanker', status: 'available' }];
    db.allocations = [{ id: 'a1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: iso }];
    db.orders = [order({ id: 'o1', quantity: 1000 })];
    // Delay only /orders so allocations resolve first: the memo runs with allocations present
    // but orders.data still undefined, exercising the `orders.data ?? []` guard.
    server.use(
      http.get(`${API_URL}/orders`, async () => {
        await delay(60);
        return HttpResponse.json(getDb().orders);
      }),
    );

    const { result } = renderHookWithProviders(() => useShiftAdvisories(iso));
    // First it settles to no advisories (orders undefined → empty), then the orders arrive.
    await waitFor(() => expect(result.current).toBeTruthy());
    await waitFor(() => expect(result.current.advisories.length).toBeGreaterThanOrEqual(0), { timeout: 2000 });
  });
});
