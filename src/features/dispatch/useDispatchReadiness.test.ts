import { describe, it, expect, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { useDispatchReadiness } from './useDispatchReadiness';
import { renderHookWithProviders } from '@/test/renderWithProviders';
import { resetDb, getDb } from '@/test/mswServer';
import { today } from '@/utils/clock';
import type { Order } from '@/types';

const iso = today();

function seed() {
  const db = getDb();
  db.drivers = [
    { id: 'driver-1', name: 'John', license: 'DL-1', phone: '+1', status: 'available' },
    { id: 'driver-2', name: 'Mary', license: 'DL-2', phone: '+2', status: 'available' },
    { id: 'driver-3', name: 'Sam', license: 'DL-3', phone: '+3', status: 'available' },
  ];
  db.vehicles = [
    { id: 'vehicle-1', registration: 'TRK-101', capacity: 8000, type: 'Tanker', status: 'available' },
    { id: 'vehicle-2', registration: 'TRK-202', capacity: 8000, type: 'Tanker', status: 'available' },
  ];
  db.hubs = [
    { id: 'hub-1', name: 'Downtown', locationType: 'hub', address: 'x', coordinates: { lat: 40, lng: -74 }, inventory: { diesel: 15000 } },
    { id: 'hub-3', name: 'Northgate', locationType: 'hub', address: 'y', coordinates: { lat: 40.7, lng: -73.9 }, inventory: { diesel: 5000 } },
  ];
  db.allocations = [
    { id: 'a1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: iso },
    { id: 'a2', vehicleId: 'vehicle-2', driverId: 'driver-2', date: iso },
  ];
  const o = (over: Partial<Order>): Order => ({
    id: 'o', sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel', quantity: 1000,
    deliveryDate: iso, assignedDriverId: 'driver-1', status: 'assigned', ...over,
  });
  db.orders = [
    o({ id: 'o-ready', quantity: 3000 }),
    o({ id: 'o-needs-driver', assignedDriverId: null, status: 'pending' }),
    o({ id: 'o-transit', status: 'in_transit' }),
    o({ id: 'o-done', status: 'delivered' }),
    o({ id: 'o-blocked', assignedDriverId: 'driver-2', sourceId: 'hub-3', quantity: 6000 }),
    o({ id: 'o-needs-vehicle', assignedDriverId: 'driver-3' }),
  ];
}

beforeEach(() => {
  resetDb();
  seed();
});

describe('useDispatchReadiness', () => {
  it('classifies orders into counts and prioritises actionable ones', async () => {
    const { result } = renderHookWithProviders(() => useDispatchReadiness(iso));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.total).toBe(6);
    expect(result.current.counts).toMatchObject({
      ready: 1,
      in_transit: 1,
      done: 1,
      blocked: 1,
      needs: 2,
    });

    // needs_driver, needs_vehicle and blocked_stock are all actionable; blocked sorts first.
    expect(result.current.actionable).toHaveLength(3);
    expect(result.current.actionable[0].readiness.state).toBe('blocked_stock');
  });

  it('returns nothing for a date with no orders', async () => {
    const { result } = renderHookWithProviders(() => useDispatchReadiness('1999-01-01'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.total).toBe(0);
  });
});
