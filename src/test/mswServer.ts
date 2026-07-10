import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { API_URL } from '@/config/env';
import type { Hub, Order, VehiclePosition } from '@/types';

// In-memory fixture the handlers mutate, mirroring the real server's business rules.
export function makeDb() {
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
    shifts: [] as Record<string, unknown>[],
  };
}

let db = makeDb();
export const resetDb = () => (db = makeDb());
// Direct accessor so tests can seed rows dated to the runtime "today".
export const getDb = () => db;
const u = (p: string) => `${API_URL}${p}`;
const find = <T extends { id: string }>(arr: T[], id: string) => arr.find((x) => x.id === id);

export const handlers = [
  http.post(u('/login'), async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string };
    const user = db.users.find((x) => x.email === email);
    if (!user || user.password !== password) return HttpResponse.json({ error: 'Invalid' }, { status: 401 });
    const { password: _p, ...safe } = user;
    return HttpResponse.json({ user: safe, token: 't' });
  }),
  http.get(u('/hubs'), () => HttpResponse.json(db.hubs)),
  http.get(u('/hubs/:id'), ({ params }) => HttpResponse.json(find(db.hubs, params.id as string))),
  http.get(u('/products'), () => HttpResponse.json(db.products)),
  http.get(u('/drivers'), () => HttpResponse.json(db.drivers)),
  http.get(u('/vehicles'), () => HttpResponse.json(db.vehicles)),
  http.get(u('/orders'), () => HttpResponse.json(db.orders)),
  http.get(u('/allocations'), () => HttpResponse.json(db.allocations)),
  http.get(u('/shifts'), () => HttpResponse.json(db.shifts)),
  http.get(u('/vehiclePositions'), () => HttpResponse.json(db.vehiclePositions)),

  http.post(u('/allocations'), async ({ request }) => {
    const b = (await request.json()) as { vehicleId: string; driverId: string; date: string };
    if (db.allocations.some((a) => a.vehicleId === b.vehicleId && a.date === b.date))
      return HttpResponse.json({ error: 'TRK-101 is already allocated on ' + b.date }, { status: 409 });
    const alloc = { id: 'alloc-' + Date.now(), ...b };
    db.allocations.push(alloc);
    return HttpResponse.json(alloc, { status: 201 });
  }),

  http.post(u('/shifts/start'), async ({ request }) => {
    const { driverId, date } = (await request.json()) as { driverId: string; date: string };
    if (!db.allocations.find((a) => a.driverId === driverId && a.date === date))
      return HttpResponse.json({ error: 'No vehicle allocated' }, { status: 409 });
    const orders = db.orders.filter((o) => o.assignedDriverId === driverId && o.deliveryDate === date && o.status === 'assigned');
    for (const o of orders) {
      const hub = find(db.hubs, o.sourceId)!;
      if ((hub.inventory[o.product] ?? 0) < o.quantity)
        return HttpResponse.json({ error: 'insufficient stock' }, { status: 422 });
    }
    orders.forEach((o) => {
      find(db.hubs, o.sourceId)!.inventory[o.product] -= o.quantity;
      o.status = 'in_transit';
    });
    const shift = { id: 'shift-1', driverId, vehicleId: 'vehicle-1', date, status: 'active', startedAt: '', endedAt: null, orderIds: orders.map((o) => o.id) };
    db.shifts.push(shift);
    return HttpResponse.json(shift, { status: 201 });
  }),

  http.post(u('/orders/:id/complete'), ({ params }) => {
    const o = find(db.orders, params.id as string);
    if (!o) return HttpResponse.json({ error: 'not found' }, { status: 404 });
    if (o.status !== 'in_transit') return HttpResponse.json({ error: 'not in transit' }, { status: 409 });
    const dest = find(db.hubs, o.destinationId)!;
    dest.inventory[o.product] = (dest.inventory[o.product] ?? 0) + o.quantity;
    o.status = 'delivered';
    return HttpResponse.json({ order: o, inventory: { hubName: dest.name, product: o.product, delta: o.quantity, total: dest.inventory[o.product] } });
  }),

  http.patch(u('/orders/:id'), async ({ params, request }) => {
    const o = find(db.orders, params.id as string);
    if (!o) return HttpResponse.json({ error: 'not found' }, { status: 404 });
    Object.assign(o, (await request.json()) as Record<string, unknown>);
    return HttpResponse.json(o);
  }),
  http.delete(u('/orders/:id'), ({ params }) => {
    db.orders = db.orders.filter((o) => o.id !== (params.id as string));
    return HttpResponse.json({});
  }),

  http.post(u('/orders/:id/fail'), async ({ params, request }) => {
    const { reason } = (await request.json()) as { reason?: string };
    if (!reason) return HttpResponse.json({ error: 'reason required' }, { status: 422 });
    const o = find(db.orders, params.id as string)!;
    o.status = 'failed';
    o.failureReason = reason;
    return HttpResponse.json({ order: o });
  }),

  // Order create (used by the orders page / mutations)
  http.post(u('/orders'), async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const order = { id: 'order-' + Date.now(), ...body } as unknown as Order;
    db.orders.push(order);
    return HttpResponse.json(order, { status: 201 });
  }),

  // End a shift
  http.post(u('/shifts/:id/end'), ({ params }) => {
    const s = db.shifts.find((x) => x.id === (params.id as string));
    if (!s) return HttpResponse.json({ error: 'not found' }, { status: 404 });
    s.status = 'ended';
    s.endedAt = new Date().toISOString();
    return HttpResponse.json(s);
  }),

  // Simulated GPS position patch
  http.patch(u('/vehiclePositions/:id'), async ({ params, request }) => {
    const p = db.vehiclePositions.find((x) => x.id === (params.id as string));
    if (!p) return HttpResponse.json({ error: 'not found' }, { status: 404 });
    Object.assign(p, (await request.json()) as Record<string, unknown>);
    return HttpResponse.json(p);
  }),

  // Generic CRUD for the master-data resources.
  ...(['hubs', 'products', 'drivers', 'vehicles'] as const).flatMap((res) => [
    http.get(u(`/${res}/:id`), ({ params }) =>
      HttpResponse.json((db[res] as { id: string }[]).find((x) => x.id === (params.id as string))),
    ),
    http.post(u(`/${res}`), async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      const row = { id: `${res}-${Date.now()}`, ...body };
      (db[res] as Record<string, unknown>[]).push(row);
      return HttpResponse.json(row, { status: 201 });
    }),
    http.patch(u(`/${res}/:id`), async ({ params, request }) => {
      const row = (db[res] as { id: string }[]).find((x) => x.id === (params.id as string));
      if (!row) return HttpResponse.json({ error: 'not found' }, { status: 404 });
      Object.assign(row, (await request.json()) as Record<string, unknown>);
      return HttpResponse.json(row);
    }),
    http.delete(u(`/${res}/:id`), ({ params }) => {
      (db as unknown as Record<string, { id: string }[]>)[res] = (db[res] as { id: string }[]).filter(
        (x) => x.id !== (params.id as string),
      );
      return HttpResponse.json({});
    }),
  ]),

  // Individual order read
  http.get(u('/orders/:id'), ({ params }) => HttpResponse.json(find(db.orders, params.id as string))),
];

export const server = setupServer(...handlers);
