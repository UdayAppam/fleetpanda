import { describe, it, expect, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { useShiftAdvisories } from './useShiftAdvisories';
import { renderHookWithProviders } from '@/test/renderWithProviders';
import { resetDb, getDb } from '@/test/mswServer';
import { today } from '@/utils/clock';
import type { Order } from '@/types';

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
    // Many long round trips overrun the 8h shift.
    db.orders = Array.from({ length: 8 }, (_, i) => order({ id: `o${i}`, quantity: 3000 }));

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

  it('produces no advisory when there are no orders for an allocation', async () => {
    const db = base();
    db.vehicles = [{ id: 'vehicle-1', registration: 'TRK-101', capacity: 8000, type: 'Tanker', status: 'available' }];
    db.allocations = [{ id: 'a1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: iso }];
    db.orders = [];

    const { result } = renderHookWithProviders(() => useShiftAdvisories(iso));
    await waitFor(() => expect(result.current).toBeTruthy());
    expect(result.current.advisories).toHaveLength(0);
  });
});
