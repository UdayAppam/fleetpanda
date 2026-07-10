// Deterministic seed for the FleetPanda mock API. Run: `npm run seed`.
// Dates are generated relative to the REAL local calendar day so the demo always shows a
// live "today". Data is crafted so every dashboard readiness state + shift advisory appears.
import { writeFileSync } from 'node:fs';

const fmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const localToday = () => fmt(new Date());
const TODAY = process.env.SEED_DATE || localToday();
const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return fmt(d);
};
const at = (iso, hhmm) => `${iso}T${hhmm}:00`;

// Mirror of src/services/route.ts so the seeded in-transit truck sits ON the drawn curve.
const routePath = (from, to, samples = 16) => {
  const mid = { lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 };
  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;
  const len = Math.hypot(dLat, dLng) || 1;
  const perp = { lat: -dLng / len, lng: dLat / len };
  const sign = Math.sin((from.lat + to.lng) * 7) >= 0 ? 1 : -1;
  const off = len * 0.16 * sign;
  const ctrl = { lat: mid.lat + perp.lat * off, lng: mid.lng + perp.lng * off };
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const mt = 1 - t;
    pts.push({
      lat: +(mt * mt * from.lat + 2 * mt * t * ctrl.lat + t * t * to.lat).toFixed(5),
      lng: +(mt * mt * from.lng + 2 * mt * t * ctrl.lng + t * t * to.lng).toFixed(5),
    });
  }
  return pts;
};

const users = [
  { id: 'user-admin', email: 'admin@fleetpanda.com', password: 'admin123', name: 'Dana Ops', role: 'admin' },
  { id: 'user-driver', email: 'driver@fleetpanda.com', password: 'driver123', name: 'John Smith', role: 'driver', driverId: 'driver-1' },
  { id: 'user-driver2', email: 'maria@fleetpanda.com', password: 'driver123', name: 'Maria Ruiz', role: 'driver', driverId: 'driver-2' },
  { id: 'user-driver4', email: 'amina@fleetpanda.com', password: 'driver123', name: 'Amina Bello', role: 'driver', driverId: 'driver-4' },
  { id: 'user-driver7', email: 'sam@fleetpanda.com', password: 'driver123', name: 'Sam Okoye', role: 'driver', driverId: 'driver-7' }, // already on a live run
];

const products = [
  { id: 'prod-diesel', key: 'diesel', name: 'Diesel', unit: 'L', lowStockThreshold: 5000, tankCapacity: 20000 },
  { id: 'prod-petrol', key: 'petrol', name: 'Petrol (Regular)', unit: 'L', lowStockThreshold: 5000, tankCapacity: 20000 },
  { id: 'prod-premium', key: 'premium', name: 'Premium Petrol', unit: 'L', lowStockThreshold: 3000, tankCapacity: 12000 },
];

// Spread across the metro (~7–35 km apart) so journey times are realistic.
const hubs = [
  { id: 'hub-1', name: 'Downtown Distribution Hub', locationType: 'hub', address: '123 Main St', coordinates: { lat: 40.7128, lng: -74.006 }, inventory: { diesel: 12000, petrol: 12000, premium: 3100 } },
  { id: 'hub-2', name: 'Harbor Terminal', locationType: 'terminal', address: '88 Dockside Ave', coordinates: { lat: 40.6626, lng: -74.045 }, inventory: { diesel: 2400, petrol: 18700, premium: 6900 } },
  { id: 'hub-3', name: 'Northgate Depot', locationType: 'hub', address: '400 North Rd', coordinates: { lat: 40.8601, lng: -73.9 }, inventory: { diesel: 9800, petrol: 4300, premium: 8200 } },
  { id: 'hub-4', name: 'Airport Fuel Terminal', locationType: 'terminal', address: 'Cargo Loop 2', coordinates: { lat: 40.6413, lng: -73.7781 }, inventory: { diesel: 20000, petrol: 15000, premium: 2100 } },
  { id: 'hub-5', name: 'Westside Storage', locationType: 'hub', address: '77 River Blvd', coordinates: { lat: 40.758, lng: -74.13 }, inventory: { diesel: 4600, petrol: 9100, premium: 5400 } },
  { id: 'hub-6', name: 'Southbay Terminal', locationType: 'terminal', address: '9 Bay St', coordinates: { lat: 40.59, lng: -73.94 }, inventory: { diesel: 13400, petrol: 800, premium: 4700 } },
  { id: 'hub-7', name: 'Eastport Terminal', locationType: 'terminal', address: '5 Sound Rd', coordinates: { lat: 40.73, lng: -73.68 }, inventory: { diesel: 8000, petrol: 6000, premium: 2000 } },
];

const drivers = [
  { id: 'driver-1', name: 'John Smith', license: 'DL-123456', phone: '+1-555-0100', status: 'available' },
  { id: 'driver-2', name: 'Maria Ruiz', license: 'DL-223344', phone: '+1-555-0101', status: 'available' },
  { id: 'driver-3', name: 'Wei Chen', license: 'DL-334455', phone: '+1-555-0102', status: 'available' },
  { id: 'driver-4', name: 'Amina Bello', license: 'DL-445566', phone: '+1-555-0103', status: 'available' },
  { id: 'driver-5', name: 'Carlos Diaz', license: 'DL-556677', phone: '+1-555-0104', status: 'available' },
  { id: 'driver-6', name: 'Priya Nair', license: 'DL-667788', phone: '+1-555-0105', status: 'available' },
  { id: 'driver-7', name: 'Sam Okoye', license: 'DL-778899', phone: '+1-555-0106', status: 'on_shift' },
];

// Varied capacities (6k–18k); one in maintenance to demo availability.
const vehicles = [
  { id: 'vehicle-1', registration: 'TRK-101', capacity: 6000, type: 'Tanker', status: 'available' },
  { id: 'vehicle-2', registration: 'TRK-104', capacity: 12000, type: 'Tanker', status: 'available' },
  { id: 'vehicle-3', registration: 'TRK-108', capacity: 8000, type: 'Tanker', status: 'available' },
  { id: 'vehicle-4', registration: 'TRK-112', capacity: 15000, type: 'Tanker', status: 'available' },
  { id: 'vehicle-5', registration: 'TRK-119', capacity: 18000, type: 'Tanker', status: 'available' },
  { id: 'vehicle-6', registration: 'TRK-123', capacity: 10000, type: 'Tanker', status: 'available' },
  { id: 'vehicle-7', registration: 'TRK-130', capacity: 9000, type: 'Tanker', status: 'maintenance' },
  { id: 'vehicle-8', registration: 'TRK-141', capacity: 6000, type: 'Tanker', status: 'on_shift' },
];

const o = (id, sourceId, destinationId, product, quantity, deliveryDate, assignedDriverId, status, extra = {}) => ({
  id, sourceId, destinationId, product, quantity, deliveryDate, assignedDriverId, status, ...extra,
});

const orders = [
  // TODAY — each order engineered to demonstrate a readiness state / advisory:
  o('order-1', 'hub-1', 'hub-3', 'diesel', 5000, TODAY, 'driver-1', 'assigned'), // Ready (John)
  o('order-2', 'hub-1', 'hub-5', 'petrol', 4000, TODAY, 'driver-1', 'assigned'), // Ready (John)
  o('order-3', 'hub-4', 'hub-6', 'diesel', 8000, TODAY, 'driver-2', 'assigned'), // Blocked: capacity (6k truck)
  o('order-4', 'hub-2', 'hub-3', 'petrol', 3000, TODAY, null, 'pending'), // Needs driver
  o('order-5', 'hub-3', 'hub-6', 'diesel', 4500, TODAY, 'driver-3', 'assigned'), // Needs vehicle (no allocation)
  o('order-6', 'hub-6', 'hub-1', 'petrol', 5000, TODAY, 'driver-5', 'assigned'), // Blocked: stock (hub-6 petrol 800)
  // Wei (driver-4) — 4 long-distance runs → shift overbooked advisory (each order itself Ready)
  o('order-7', 'hub-4', 'hub-5', 'diesel', 3000, TODAY, 'driver-4', 'assigned'),
  o('order-8', 'hub-4', 'hub-3', 'diesel', 3000, TODAY, 'driver-4', 'assigned'),
  o('order-9', 'hub-4', 'hub-1', 'diesel', 2000, TODAY, 'driver-4', 'assigned'),
  o('order-10', 'hub-4', 'hub-6', 'diesel', 3000, TODAY, 'driver-4', 'assigned'),
  // Priya (driver-6) — tiny load on a 15k tanker → under-utilised advisory
  o('order-11', 'hub-1', 'hub-2', 'diesel', 800, TODAY, 'driver-6', 'assigned'),

  // PAST — history
  o('order-12', 'hub-1', 'hub-2', 'diesel', 3000, addDays(TODAY, -1), 'driver-1', 'delivered', { completedAt: at(addDays(TODAY, -1), '15:20') }),
  o('order-13', 'hub-5', 'hub-4', 'petrol', 2500, addDays(TODAY, -1), 'driver-2', 'failed', { failureReason: 'Customer site closed on arrival' }),
  o('order-14', 'hub-6', 'hub-1', 'premium', 1800, addDays(TODAY, -2), 'driver-1', 'delivered', { completedAt: at(addDays(TODAY, -2), '11:05') }),

  // UPCOMING — planning
  o('order-15', 'hub-2', 'hub-3', 'petrol', 3000, addDays(TODAY, 1), null, 'pending'),
  o('order-16', 'hub-4', 'hub-1', 'premium', 2000, addDays(TODAY, 2), null, 'pending'),
  o('order-17', 'hub-3', 'hub-6', 'diesel', 4500, addDays(TODAY, 2), 'driver-3', 'assigned'),
  o('order-18', 'hub-2', 'hub-5', 'diesel', 5200, addDays(TODAY, 3), null, 'pending'),

  // TODAY, already IN TRANSIT — a truck on the road so the live map shows motion on load.
  o('order-19', 'hub-1', 'hub-4', 'diesel', 3000, TODAY, 'driver-7', 'in_transit'),
];

const allocations = [
  { id: 'alloc-1', vehicleId: 'vehicle-2', driverId: 'driver-1', date: TODAY }, // 12k — fits John's 9k
  { id: 'alloc-2', vehicleId: 'vehicle-1', driverId: 'driver-2', date: TODAY }, // 6k — too small for 8k → capacity block
  { id: 'alloc-3', vehicleId: 'vehicle-5', driverId: 'driver-4', date: TODAY }, // 18k — Wei (overbooked on time)
  { id: 'alloc-4', vehicleId: 'vehicle-6', driverId: 'driver-5', date: TODAY }, // 10k — Carlos (stock-blocked order)
  { id: 'alloc-5', vehicleId: 'vehicle-4', driverId: 'driver-6', date: TODAY }, // 15k — Priya (under-utilised)
  // driver-3 intentionally has NO allocation today → order-5 = Needs vehicle
  { id: 'alloc-6', vehicleId: 'vehicle-3', driverId: 'driver-3', date: addDays(TODAY, 2) },
  { id: 'alloc-7', vehicleId: 'vehicle-2', driverId: 'driver-1', date: addDays(TODAY, -1) },
  { id: 'alloc-8', vehicleId: 'vehicle-8', driverId: 'driver-7', date: TODAY }, // the in-transit run
];

const shifts = [
  { id: 'shift-past-1', driverId: 'driver-1', vehicleId: 'vehicle-2', date: addDays(TODAY, -1), status: 'ended', startedAt: at(addDays(TODAY, -1), '08:00'), endedAt: at(addDays(TODAY, -1), '16:30'), orderIds: ['order-12'] },
  { id: 'shift-past-2', driverId: 'driver-1', vehicleId: 'vehicle-2', date: addDays(TODAY, -2), status: 'ended', startedAt: at(addDays(TODAY, -2), '08:10'), endedAt: at(addDays(TODAY, -2), '14:00'), orderIds: ['order-14'] },
  { id: 'shift-active-1', driverId: 'driver-7', vehicleId: 'vehicle-8', date: TODAY, status: 'active', startedAt: at(TODAY, '08:30'), endedAt: null, orderIds: ['order-19'] },
];

const vehiclePositions = [
  { id: 'pos-1', vehicleId: 'vehicle-2', driverId: 'driver-1', lat: 40.7128, lng: -74.006, updatedAt: at(TODAY, '08:00'), status: 'idle' },
  { id: 'pos-2', vehicleId: 'vehicle-1', driverId: 'driver-2', lat: 40.6413, lng: -73.7781, updatedAt: at(TODAY, '08:00'), status: 'idle' },
  { id: 'pos-3', vehicleId: 'vehicle-5', driverId: 'driver-4', lat: 40.6413, lng: -73.7781, updatedAt: at(TODAY, '08:00'), status: 'idle' },
  { id: 'pos-4', vehicleId: 'vehicle-6', driverId: 'driver-5', lat: 40.59, lng: -73.94, updatedAt: at(TODAY, '08:00'), status: 'idle' },
  { id: 'pos-5', vehicleId: 'vehicle-4', driverId: 'driver-6', lat: 40.7128, lng: -74.006, updatedAt: at(TODAY, '08:00'), status: 'idle' },
  // Sam is partway along the hub-1 → hub-4 route, with a breadcrumb trail of where he's been.
  {
    id: 'pos-6',
    vehicleId: 'vehicle-8',
    driverId: 'driver-7',
    ...(() => {
      const route = routePath(hubs[0].coordinates, hubs[3].coordinates); // hub-1 → hub-4
      const idx = 8;
      return { lat: route[idx].lat, lng: route[idx].lng, trail: route.slice(0, idx) };
    })(),
    updatedAt: at(TODAY, '09:05'),
    status: 'in_transit',
  },
];

// ---------------------------------------------------------------------------
// Bulk data — 100+ valid records appended to the curated demo core above.
// Deterministic PRNG so the dataset is reproducible; every record is valid against the
// app's rules (inventory ≤ tankCapacity, source≠destination, referential integrity,
// status↔date consistency, unique vehicle+date allocations).
// ---------------------------------------------------------------------------
let _s = 20260710;
const rnd = () => {
  _s = (Math.imul(_s, 1597334677) + 1013904223) >>> 0;
  return _s / 4294967296;
};
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const round500 = (n) => Math.max(500, Math.round(n / 500) * 500);

const FIRST = ['Liam', 'Noah', 'Ava', 'Mia', 'Ethan', 'Zoe', 'Omar', 'Sara', 'Leo', 'Nina', 'Ivan', 'Tara', 'Hugo', 'Lena', 'Cyrus', 'Rhea', 'Kofi', 'Ines', 'Dev', 'Yara'];
const LAST = ['Ford', 'Nash', 'Ito', 'Khan', 'Vega', 'Roy', 'Blum', 'Osei', 'Park', 'Costa', 'Haas', 'Mora', 'Quinn', 'Sato', 'Bauer', 'Diaz', 'Reed', 'Wong', 'Ali', 'Rossi'];
const STREET = ['Main St', 'Dock Ave', 'River Rd', 'Cargo Loop', 'Bay St', 'North Rd', 'Depot Way', 'Fuel Ln', 'Harbor Blvd', 'Gantry St'];
const CITY = ['Downtown', 'Harbor', 'Northgate', 'Airport', 'Westside', 'Southbay', 'Eastport', 'Midvale', 'Lakeside', 'Riverton', 'Oakmont', 'Fairview'];
const FAILS = ['Customer site closed', 'Access blocked on arrival', 'Vehicle breakdown en route', 'Incorrect delivery address', 'Recipient refused delivery'];

// 75 more locations (→ ~82 total). Bulk hubs stock every product (source-valid for any order).
for (let i = 1; i <= 75; i++) {
  const type = rnd() < 0.5 ? 'hub' : 'terminal';
  const inventory = {};
  for (const p of products) inventory[p.key] = round500(ri(0, p.tankCapacity));
  hubs.push({
    id: `loc-${i}`,
    name: `${pick(CITY)} ${type === 'hub' ? 'Hub' : 'Terminal'} ${i}`,
    locationType: type,
    address: `${ri(1, 999)} ${pick(STREET)}`,
    coordinates: { lat: +(40.5 + rnd() * 0.45).toFixed(4), lng: +(-74.25 + rnd() * 0.6).toFixed(4) },
    inventory,
  });
}

// 100 more drivers and 100 more vehicles.
for (let i = 1; i <= 100; i++) {
  drivers.push({ id: `drv-${i}`, name: `${pick(FIRST)} ${pick(LAST)}`, license: `DL-${700000 + i}`, phone: `+1-555-${String(2000 + i).padStart(4, '0')}`, status: 'available' });
}
const CAPS = [6000, 8000, 10000, 12000, 15000, 18000, 20000];
for (let i = 1; i <= 100; i++) {
  vehicles.push({ id: `veh-${i}`, registration: `TRK-${300 + i}`, capacity: pick(CAPS), type: 'Tanker', status: rnd() < 0.08 ? 'maintenance' : 'available' });
}

// 110 more orders across past/today/future with consistent status.
const bulkHubs = hubs.filter((h) => h.id.startsWith('loc-'));
const bulkDrivers = drivers.filter((d) => d.id.startsWith('drv-'));
for (let i = 1; i <= 110; i++) {
  const src = pick(bulkHubs); // stocks all products
  let dst = pick(hubs);
  while (dst.id === src.id) dst = pick(hubs);
  const product = pick(products).key;
  const quantity = round500(ri(500, 8000));
  const offset = ri(-7, 7);
  const deliveryDate = addDays(TODAY, offset);
  let status, assignedDriverId;
  if (offset < 0) {
    status = rnd() < 0.85 ? 'delivered' : 'failed';
    assignedDriverId = pick(bulkDrivers).id;
  } else {
    const assigned = rnd() < 0.6;
    status = assigned ? 'assigned' : 'pending';
    assignedDriverId = assigned ? pick(bulkDrivers).id : null;
  }
  const order = { id: `ord-${i}`, sourceId: src.id, destinationId: dst.id, product, quantity, deliveryDate, assignedDriverId, status };
  if (status === 'delivered') order.completedAt = at(deliveryDate, '14:00');
  if (status === 'failed') order.failureReason = pick(FAILS);
  orders.push(order);
}

// ~50 more allocations, unique (vehicleId, date), for today + upcoming days.
const bulkVehicles = vehicles.filter((v) => v.id.startsWith('veh-') && v.status === 'available');
const seenAlloc = new Set(allocations.map((a) => `${a.vehicleId}|${a.date}`));
let allocN = 0;
for (let i = 0; i < 120 && allocN < 50; i++) {
  const v = pick(bulkVehicles);
  const date = addDays(TODAY, ri(0, 5));
  const key = `${v.id}|${date}`;
  if (seenAlloc.has(key)) continue;
  seenAlloc.add(key);
  allocations.push({ id: `alloc-b${++allocN}`, vehicleId: v.id, driverId: pick(bulkDrivers).id, date });
}

const db = { users, products, hubs, drivers, vehicles, orders, allocations, shifts, vehiclePositions };
writeFileSync('db.json', JSON.stringify(db, null, 2));
const invCells = hubs.length * products.length;
console.log(
  `Seeded db.json (today=${TODAY}): ${hubs.length} locations, ${products.length} products, ${drivers.length} drivers, ${vehicles.length} vehicles, ${orders.length} orders, ${allocations.length} allocations, ${invCells} inventory cells.`,
);
