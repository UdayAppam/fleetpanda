// FleetPanda mock API: json-server + custom Express routes that OWN all transactional
// side-effects (single writer). Run: `npm run mock`  (or `npm run dev:all`).
import jsonServer from 'json-server';

const PORT = process.env.PORT || 4000;
// Artificial latency + optional error injection (default OFF so the live demo is smooth).
const LATENCY_MS = Number(process.env.MOCK_LATENCY ?? 350);
const ERROR_RATE = Number(process.env.MOCK_ERROR_RATE ?? 0); // 0..1

const server = jsonServer.create();
const router = jsonServer.router('db.json');
const db = router.db; // lowdb instance
const middlewares = jsonServer.defaults();

server.use(middlewares);
server.use(jsonServer.bodyParser);

// --- latency + error simulation -------------------------------------------------
server.use((req, res, next) => {
  const delay = req.method === 'GET' ? LATENCY_MS : LATENCY_MS + 150;
  setTimeout(() => {
    if (ERROR_RATE > 0 && req.method !== 'GET' && Math.random() < ERROR_RATE) {
      return res.status(500).json({ error: 'Simulated server error' });
    }
    next();
  }, delay);
});

const nowIso = () => new Date().toISOString();
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const bad = (res, code, error, extra = {}) => res.status(code).json({ error, ...extra });

// --- auth (mock) ----------------------------------------------------------------
server.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};
  const user = db.get('users').find({ email }).value();
  if (!user || user.password !== password) return bad(res, 401, 'Invalid email or password');
  const { password: _pw, ...safe } = user;
  return res.json({ user: safe, token: `mock-${user.id}-${Date.now()}` });
});

// --- allocations: prevent double-booking ---------------------------------------
server.post('/allocations', (req, res) => {
  const { vehicleId, driverId, date } = req.body ?? {};
  if (!vehicleId || !driverId || !date) return bad(res, 422, 'vehicleId, driverId and date are required');
  if (date < localToday()) return bad(res, 422, 'Cannot allocate for a past date');
  const clash = db.get('allocations').find({ vehicleId, date }).value();
  if (clash) {
    const vehicle = db.get('vehicles').find({ id: vehicleId }).value();
    return bad(res, 409, `${vehicle?.registration ?? vehicleId} is already allocated on ${date}`, { conflict: clash });
  }
  const alloc = { id: `alloc-${Date.now()}`, vehicleId, driverId, date };
  db.get('allocations').push(alloc).write();
  return res.status(201).json(alloc);
});

// --- allocation edit/delete (same guards; clash check ignores the row itself) ---
server.patch('/allocations/:id', (req, res) => {
  const alloc = db.get('allocations').find({ id: req.params.id }).value();
  if (!alloc) return bad(res, 404, 'Allocation not found');
  const vehicleId = req.body?.vehicleId ?? alloc.vehicleId;
  const driverId = req.body?.driverId ?? alloc.driverId;
  const date = req.body?.date ?? alloc.date;
  if (date < localToday()) return bad(res, 422, 'Cannot allocate for a past date');
  const clash = db.get('allocations').value().find((a) => a.id !== alloc.id && a.vehicleId === vehicleId && a.date === date);
  if (clash) {
    const vehicle = db.get('vehicles').find({ id: vehicleId }).value();
    return bad(res, 409, `${vehicle?.registration ?? vehicleId} is already allocated on ${date}`, { conflict: clash });
  }
  const updated = db.get('allocations').find({ id: alloc.id }).assign({ vehicleId, driverId, date }).write();
  return res.json(updated);
});
server.delete('/allocations/:id', (req, res) => {
  const alloc = db.get('allocations').find({ id: req.params.id }).value();
  if (!alloc) return bad(res, 404, 'Allocation not found');
  db.get('allocations').remove({ id: req.params.id }).write();
  return res.json({});
});

// --- shift start: activate, dispatch orders (source -inventory), with guards ----
server.post('/shifts/start', (req, res) => {
  const { driverId, date } = req.body ?? {};
  if (!driverId || !date) return bad(res, 422, 'driverId and date are required');

  const allocation = db.get('allocations').find({ driverId, date }).value();
  if (!allocation) return bad(res, 409, 'No vehicle allocated to this driver for today');

  const existing = db.get('shifts').find({ driverId, date }).value();
  if (existing && existing.status === 'active') return bad(res, 409, 'Shift already started');

  const orders = db.get('orders').filter({ assignedDriverId: driverId, deliveryDate: date }).value()
    .filter((o) => o.status === 'assigned');

  // Guard: no source hub may go negative.
  for (const o of orders) {
    const hub = db.get('hubs').find({ id: o.sourceId }).value();
    const have = hub?.inventory?.[o.product] ?? 0;
    if (have < o.quantity) {
      return bad(res, 422, `${hub?.name ?? o.sourceId} has ${have} ${o.product}, order ${o.id} needs ${o.quantity}`);
    }
  }

  // Apply: decrement sources, mark orders in_transit (idempotent: only from 'assigned').
  orders.forEach((o) => {
    const hub = db.get('hubs').find({ id: o.sourceId });
    hub.set(`inventory.${o.product}`, (hub.value().inventory[o.product] ?? 0) - o.quantity).write();
    db.get('orders').find({ id: o.id }).assign({ status: 'in_transit' }).write();
  });

  const shift = existing
    ? db.get('shifts').find({ id: existing.id }).assign({ status: 'active', startedAt: nowIso(), orderIds: orders.map((o) => o.id) }).write()
    : (() => {
        const s = { id: `shift-${Date.now()}`, driverId, vehicleId: allocation.vehicleId, date, status: 'active', startedAt: nowIso(), endedAt: null, orderIds: orders.map((o) => o.id) };
        db.get('shifts').push(s).write();
        return s;
      })();

  db.get('drivers').find({ id: driverId }).assign({ status: 'on_shift' }).write();
  db.get('vehicles').find({ id: allocation.vehicleId }).assign({ status: 'on_shift' }).write();
  return res.status(201).json(shift);
});

// --- order complete: destination +inventory (idempotent from in_transit) --------
server.post('/orders/:id/complete', (req, res) => {
  const order = db.get('orders').find({ id: req.params.id }).value();
  if (!order) return bad(res, 404, 'Order not found');
  if (order.status !== 'in_transit') return bad(res, 409, `Order is ${order.status}, cannot complete`);

  const dest = db.get('hubs').find({ id: order.destinationId });
  const before = dest.value().inventory[order.product] ?? 0;
  dest.set(`inventory.${order.product}`, before + order.quantity).write();
  const updated = db.get('orders').find({ id: order.id })
    .assign({ status: 'delivered', completedAt: nowIso() }).write();

  return res.json({
    order: updated,
    inventory: { hubId: order.destinationId, hubName: dest.value().name, product: order.product, delta: order.quantity, total: before + order.quantity },
  });
});

// --- order fail: reason required ------------------------------------------------
server.post('/orders/:id/fail', (req, res) => {
  const { reason } = req.body ?? {};
  if (!reason) return bad(res, 422, 'A failure reason is required');
  const order = db.get('orders').find({ id: req.params.id }).value();
  if (!order) return bad(res, 404, 'Order not found');
  if (['delivered', 'failed'].includes(order.status)) return bad(res, 409, `Order is already ${order.status}`);
  const updated = db.get('orders').find({ id: order.id }).assign({ status: 'failed', failureReason: reason }).write();
  return res.json({ order: updated });
});

// --- shift end: free vehicle & driver ------------------------------------------
server.post('/shifts/:id/end', (req, res) => {
  const shift = db.get('shifts').find({ id: req.params.id }).value();
  if (!shift) return bad(res, 404, 'Shift not found');
  if (shift.status !== 'active') return bad(res, 409, `Shift is ${shift.status}`);
  const updated = db.get('shifts').find({ id: shift.id }).assign({ status: 'ended', endedAt: nowIso() }).write();
  db.get('drivers').find({ id: shift.driverId }).assign({ status: 'available' }).write();
  db.get('vehicles').find({ id: shift.vehicleId }).assign({ status: 'available' }).write();
  return res.json(updated);
});

server.use(router);
server.listen(PORT, () => {
  console.log(`FleetPanda mock API on http://localhost:${PORT} (latency ${LATENCY_MS}ms, errorRate ${ERROR_RATE})`);
});
