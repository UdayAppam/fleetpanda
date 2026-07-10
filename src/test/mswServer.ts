import { setupServer } from 'msw/node';
import { createHandlers, type MockDb, type MockStore } from '@/mocks/handlers';
import type { Hub, Order, VehiclePosition } from '@/types';

// Small in-memory fixture the shared handlers mutate. Kept intentionally minimal (vs the
// full demo seed) so tests assert against a known, tiny dataset. The handler *logic* is the
// same code the browser mock and the real server run — only the data differs.
export function makeDb(): MockDb {
  const hubs: Hub[] = [
    { id: 'hub-1', name: 'Downtown', locationType: 'hub', address: 'x', coordinates: { lat: 40, lng: -74 }, inventory: { diesel: 15000 } },
    { id: 'hub-3', name: 'Northgate', locationType: 'hub', address: 'y', coordinates: { lat: 40.7, lng: -73.9 }, inventory: { diesel: 9800 } },
  ];
  const orders: Order[] = [
    { id: 'order-1', sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel', quantity: 5000, deliveryDate: '2025-11-24', assignedDriverId: 'driver-1', status: 'assigned' },
  ];
  const vehiclePositions: VehiclePosition[] = [
    { id: 'pos-1', vehicleId: 'vehicle-1', driverId: 'driver-1', lat: 40, lng: -74, updatedAt: '', status: 'idle' },
  ];
  return {
    hubs,
    orders,
    vehiclePositions,
    users: [
      { id: 'user-admin', email: 'admin@fleetpanda.com', password: 'admin123', name: 'Dana', role: 'admin' },
      { id: 'user-driver', email: 'driver@fleetpanda.com', password: 'driver123', name: 'John', role: 'driver', driverId: 'driver-1' },
    ],
    products: [{ id: 'prod-diesel', key: 'diesel', name: 'Diesel', unit: 'L', lowStockThreshold: 5000, tankCapacity: 20000 }],
    drivers: [{ id: 'driver-1', name: 'John', license: 'DL-1', phone: '+1', status: 'available' }],
    vehicles: [{ id: 'vehicle-1', registration: 'TRK-101', capacity: 8000, type: 'Tanker', status: 'available' }],
    allocations: [{ id: 'alloc-1', vehicleId: 'vehicle-1', driverId: 'driver-1', date: '2025-11-24' }],
    shifts: [],
  };
}

const store: MockStore = { db: makeDb() };
export const resetDb = () => (store.db = makeDb());
// Direct accessor so tests can seed rows dated to the runtime "today".
export const getDb = () => store.db;

export const server = setupServer(...createHandlers(store));
