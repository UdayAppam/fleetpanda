import { describe, it, expect, beforeEach } from 'vitest';
import { api } from '@/api/endpoints';
import { ApiError } from '@/api/httpClient';
import { resetDb, getDb } from '@/test/mswServer';
import { today } from '@/utils/clock';
import type { Order, Shift } from '@/types';

const iso = today();

const order = (over: Partial<Order>): Order => ({
  id: 'o1', sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel', quantity: 5000,
  deliveryDate: iso, assignedDriverId: 'driver-1', status: 'assigned', ...over,
});

function seedForStart() {
  const db = getDb();
  db.hubs = [
    { id: 'hub-1', name: 'Downtown', locationType: 'hub', address: 'x', coordinates: { lat: 40, lng: -74 }, inventory: { diesel: 15000 } },
    { id: 'hub-3', name: 'Northgate', locationType: 'hub', address: 'y', coordinates: { lat: 40.7, lng: -73.9 }, inventory: { diesel: 0 } },
  ];
  db.drivers = [{ id: 'driver-1', name: 'John', license: 'DL-1', phone: '+1', status: 'available' }];
  db.vehicles = [{ id: 'vehicle-1', registration: 'TRK-101', capacity: 8000, type: 'Tanker', status: 'available' }];
  db.allocations = [{ id: 'a1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: iso }];
  return db;
}

beforeEach(() => resetDb());

describe('mock handlers: POST /shifts/start', () => {
  it('rejects a shift when a source hub lacks the inventory to dispatch', async () => {
    const db = seedForStart();
    // Source hub-1 has 15000 diesel; require more than that so the guard trips (lines 115-116).
    db.orders = [order({ quantity: 20000 })];

    await expect(api.startShift('driver-1', iso)).rejects.toBeInstanceOf(ApiError);
    // No side-effects: inventory untouched, order still assigned.
    expect(getDb().hubs.find((h) => h.id === 'hub-1')?.inventory.diesel).toBe(15000);
    expect(getDb().orders[0].status).toBe('assigned');
  });

  it('reactivates an existing (previously ended) shift for the same driver/day', async () => {
    const db = seedForStart();
    db.orders = [order({ quantity: 5000 })];
    const ended: Shift = {
      id: 'shift-old', driverId: 'driver-1', vehicleId: 'vehicle-1', date: iso,
      status: 'ended', startedAt: '', endedAt: '', orderIds: [],
    };
    db.shifts = [ended];

    const shift = await api.startShift('driver-1', iso);
    // Same row is reused (Object.assign on existing — lines 128-129), now active with dispatched orders.
    expect(shift.id).toBe('shift-old');
    expect(shift.status).toBe('active');
    expect(shift.orderIds).toContain('o1');
    expect(getDb().shifts).toHaveLength(1);
    expect(getDb().orders[0].status).toBe('in_transit');
  });
});
