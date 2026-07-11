// Shared MSW handler set — the in-browser/in-test implementation of the FleetPanda
// mock API. This mirrors the business rules in `server.js` (the single-writer spec):
// idempotent status transitions, source-decrement on dispatch, destination-increment
// on delivery, non-negative inventory, and 409/422 guards.
//
// Both entry points reuse this factory:
//   • src/mocks/browser.ts  → setupWorker(...createHandlers(store))   (deployed/static)
//   • src/test/mswServer.ts → setupServer(...createHandlers(store))   (Vitest)
//
// The `store` is a mutable box ({ db }) so `resetDb()` can swap the whole dataset while
// live handlers keep reading the current one. `onWrite` lets the browser persist mutations.
import { http, HttpResponse } from 'msw';
import { API_URL } from '@/config/env';
import type {
  Allocation,
  Driver,
  Hub,
  Order,
  Product,
  Shift,
  User,
  Vehicle,
  VehiclePosition,
} from '@/types';

export interface MockDb {
  users: (User & { password: string })[];
  products: Product[];
  hubs: Hub[];
  drivers: Driver[];
  vehicles: Vehicle[];
  orders: Order[];
  allocations: Allocation[];
  shifts: Shift[];
  vehiclePositions: VehiclePosition[];
}

export interface MockStore {
  db: MockDb;
  /** Called after any mutating request so the browser can persist to localStorage. */
  onWrite?: () => void;
}

const nowIso = () => new Date().toISOString();
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const find = <T extends { id: string }>(arr: T[], id: string) => arr.find((x) => x.id === id);

export function createHandlers(store: MockStore) {
  const u = (p: string) => `${API_URL}${p}`;
  const db = () => store.db;
  const wrote = () => store.onWrite?.();
  const err = (status: number, error: string, extra: Record<string, unknown> = {}) =>
    HttpResponse.json({ error, ...extra }, { status });

  return [
    // --- auth (mock) --------------------------------------------------------------
    http.post(u('/login'), async ({ request }) => {
      const { email, password } = (await request.json()) as { email: string; password: string };
      const user = db().users.find((x) => x.email === email);
      if (!user || user.password !== password) return err(401, 'Invalid email or password');
      const { password: _pw, ...safe } = user;
      return HttpResponse.json({ user: safe, token: `mock-${user.id}` });
    }),

    // --- collection reads ---------------------------------------------------------
    http.get(u('/hubs'), () => HttpResponse.json(db().hubs)),
    http.get(u('/products'), () => HttpResponse.json(db().products)),
    http.get(u('/drivers'), () => HttpResponse.json(db().drivers)),
    http.get(u('/vehicles'), () => HttpResponse.json(db().vehicles)),
    http.get(u('/orders'), () => HttpResponse.json(db().orders)),
    http.get(u('/orders/:id'), ({ params }) => HttpResponse.json(find(db().orders, params.id as string))),
    http.get(u('/allocations'), () => HttpResponse.json(db().allocations)),
    http.get(u('/shifts'), () => HttpResponse.json(db().shifts)),
    http.get(u('/vehiclePositions'), () => HttpResponse.json(db().vehiclePositions)),

    // --- allocation: unique (vehicle, date), no past dates ------------------------
    http.post(u('/allocations'), async ({ request }) => {
      const b = (await request.json()) as { vehicleId?: string; driverId?: string; date?: string };
      if (!b.vehicleId || !b.driverId || !b.date) return err(422, 'vehicleId, driverId and date are required');
      if (b.date < localToday()) return err(422, 'Cannot allocate for a past date');
      const clash = db().allocations.find((a) => a.vehicleId === b.vehicleId && a.date === b.date);
      if (clash) {
        const veh = find(db().vehicles, b.vehicleId);
        return err(409, `${veh?.registration ?? b.vehicleId} is already allocated on ${b.date}`, { conflict: clash });
      }
      const alloc: Allocation = { id: `alloc-${Date.now()}`, vehicleId: b.vehicleId, driverId: b.driverId, date: b.date };
      db().allocations.push(alloc);
      wrote();
      return HttpResponse.json(alloc, { status: 201 });
    }),

    // --- allocation edit: same guards, but the vehicle+date clash ignores this row ---------
    http.patch(u('/allocations/:id'), async ({ params, request }) => {
      const alloc = find(db().allocations, params.id as string);
      if (!alloc) return err(404, 'Allocation not found');
      const b = (await request.json()) as { vehicleId?: string; driverId?: string; date?: string };
      const vehicleId = b.vehicleId ?? alloc.vehicleId;
      const driverId = b.driverId ?? alloc.driverId;
      const date = b.date ?? alloc.date;
      if (date < localToday()) return err(422, 'Cannot allocate for a past date');
      const clash = db().allocations.find((a) => a.id !== alloc.id && a.vehicleId === vehicleId && a.date === date);
      if (clash) {
        const veh = find(db().vehicles, vehicleId);
        return err(409, `${veh?.registration ?? vehicleId} is already allocated on ${date}`, { conflict: clash });
      }
      Object.assign(alloc, { vehicleId, driverId, date });
      wrote();
      return HttpResponse.json(alloc);
    }),
    http.delete(u('/allocations/:id'), ({ params }) => {
      const id = params.id as string;
      if (!find(db().allocations, id)) return err(404, 'Allocation not found');
      db().allocations = db().allocations.filter((a) => a.id !== id);
      wrote();
      return HttpResponse.json({});
    }),

    // --- shift start: dispatch orders, decrement source inventory, flip statuses ---
    http.post(u('/shifts/start'), async ({ request }) => {
      const { driverId, date } = (await request.json()) as { driverId?: string; date?: string };
      if (!driverId || !date) return err(422, 'driverId and date are required');

      const allocation = db().allocations.find((a) => a.driverId === driverId && a.date === date);
      if (!allocation) return err(409, 'No vehicle allocated to this driver for today');

      const existing = db().shifts.find((s) => s.driverId === driverId && s.date === date);
      if (existing && existing.status === 'active') return err(409, 'Shift already started');

      const orders = db().orders.filter(
        (o) => o.assignedDriverId === driverId && o.deliveryDate === date && o.status === 'assigned',
      );

      // Guard: no source hub may go negative.
      for (const o of orders) {
        const hub = find(db().hubs, o.sourceId);
        const have = hub?.inventory?.[o.product] ?? 0;
        if (have < o.quantity) {
          return err(422, `${hub?.name ?? o.sourceId} has ${have} ${o.product}, order ${o.id} needs ${o.quantity}`);
        }
      }

      // Apply: decrement sources, mark orders in_transit.
      orders.forEach((o) => {
        const hub = find(db().hubs, o.sourceId)!;
        hub.inventory[o.product] = (hub.inventory[o.product] ?? 0) - o.quantity;
        o.status = 'in_transit';
      });

      let shift: Shift;
      if (existing) {
        Object.assign(existing, { status: 'active', startedAt: nowIso(), orderIds: orders.map((o) => o.id) });
        shift = existing;
      } else {
        shift = {
          id: `shift-${Date.now()}`,
          driverId,
          vehicleId: allocation.vehicleId,
          date,
          status: 'active',
          startedAt: nowIso(),
          endedAt: null,
          orderIds: orders.map((o) => o.id),
        };
        db().shifts.push(shift);
      }

      const driver = find(db().drivers, driverId);
      if (driver) driver.status = 'on_shift';
      const vehicle = find(db().vehicles, allocation.vehicleId);
      if (vehicle) vehicle.status = 'on_shift';
      wrote();
      return HttpResponse.json(shift, { status: 201 });
    }),

    // --- order complete: destination +inventory (idempotent from in_transit) -------
    http.post(u('/orders/:id/complete'), ({ params }) => {
      const order = find(db().orders, params.id as string);
      if (!order) return err(404, 'Order not found');
      if (order.status !== 'in_transit') return err(409, `Order is ${order.status}, cannot complete`);
      const dest = find(db().hubs, order.destinationId)!;
      const before = dest.inventory[order.product] ?? 0;
      dest.inventory[order.product] = before + order.quantity;
      order.status = 'delivered';
      order.completedAt = nowIso();
      wrote();
      return HttpResponse.json({
        order,
        inventory: {
          hubId: order.destinationId,
          hubName: dest.name,
          product: order.product,
          delta: order.quantity,
          total: before + order.quantity,
        },
      });
    }),

    // --- order fail: reason required ----------------------------------------------
    http.post(u('/orders/:id/fail'), async ({ params, request }) => {
      const { reason } = (await request.json()) as { reason?: string };
      if (!reason) return err(422, 'A failure reason is required');
      const order = find(db().orders, params.id as string);
      if (!order) return err(404, 'Order not found');
      if (['delivered', 'failed'].includes(order.status)) return err(409, `Order is already ${order.status}`);
      order.status = 'failed';
      order.failureReason = reason;
      wrote();
      return HttpResponse.json({ order });
    }),

    // --- order create / edit / delete ---------------------------------------------
    http.post(u('/orders'), async ({ request }) => {
      const body = (await request.json()) as Partial<Order>;
      const order = { id: `order-${Date.now()}`, status: 'pending', ...body } as Order;
      db().orders.push(order);
      wrote();
      return HttpResponse.json(order, { status: 201 });
    }),
    http.patch(u('/orders/:id'), async ({ params, request }) => {
      const order = find(db().orders, params.id as string);
      if (!order) return err(404, 'Order not found');
      Object.assign(order, (await request.json()) as Partial<Order>);
      wrote();
      return HttpResponse.json(order);
    }),
    http.delete(u('/orders/:id'), ({ params }) => {
      db().orders = db().orders.filter((o) => o.id !== (params.id as string));
      wrote();
      return HttpResponse.json({});
    }),

    // --- shift end: free vehicle & driver -----------------------------------------
    http.post(u('/shifts/:id/end'), ({ params }) => {
      const shift = find(db().shifts, params.id as string);
      if (!shift) return err(404, 'Shift not found');
      if (shift.status !== 'active') return err(409, `Shift is ${shift.status}`);
      shift.status = 'ended';
      shift.endedAt = nowIso();
      const driver = find(db().drivers, shift.driverId);
      if (driver) driver.status = 'available';
      const vehicle = find(db().vehicles, shift.vehicleId);
      if (vehicle) vehicle.status = 'available';
      wrote();
      return HttpResponse.json(shift);
    }),

    // --- simulated GPS position patch ---------------------------------------------
    http.patch(u('/vehiclePositions/:id'), async ({ params, request }) => {
      const pos = find(db().vehiclePositions, params.id as string);
      if (!pos) return err(404, 'Position not found');
      Object.assign(pos, (await request.json()) as Partial<VehiclePosition>);
      wrote();
      return HttpResponse.json(pos);
    }),

    // --- generic CRUD for master-data resources -----------------------------------
    ...(['hubs', 'products', 'drivers', 'vehicles'] as const).flatMap((res) => [
      http.get(u(`/${res}/:id`), ({ params }) =>
        HttpResponse.json((db()[res] as { id: string }[]).find((x) => x.id === (params.id as string))),
      ),
      http.post(u(`/${res}`), async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        const row = { id: `${res.slice(0, 3)}-${Date.now()}`, ...body };
        (db()[res] as unknown as Record<string, unknown>[]).push(row);
        wrote();
        return HttpResponse.json(row, { status: 201 });
      }),
      http.patch(u(`/${res}/:id`), async ({ params, request }) => {
        const row = (db()[res] as { id: string }[]).find((x) => x.id === (params.id as string));
        if (!row) return err(404, 'Not found');
        Object.assign(row, (await request.json()) as Record<string, unknown>);
        wrote();
        return HttpResponse.json(row);
      }),
      http.delete(u(`/${res}/:id`), ({ params }) => {
        (db() as unknown as Record<string, { id: string }[]>)[res] = (db()[res] as { id: string }[]).filter(
          (x) => x.id !== (params.id as string),
        );
        wrote();
        return HttpResponse.json({});
      }),
    ]),
  ];
}
