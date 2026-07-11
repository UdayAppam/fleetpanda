# FleetPanda — Fleet Tracking Platform
## Architecture & Implementation Plan

> **Status:** Implemented — **rev 24, code-quality pass: no inline styles, composable primitives** (see §11)
> **Author:** Frontend Architect
> **Stack:** React + Redux Toolkit + Context API + TanStack Query + json-server
> **Date:** 2026-07-09

---

## 1. Product Analysis (PM view)

FleetPanda is a **petroleum logistics** platform. It moves fuel (diesel/petrol) from
**hubs/terminals** to destinations using **vehicles (tankers)** driven by **drivers**,
fulfilling **orders** scheduled on specific dates. The web app has **two distinct
personas** sharing one data layer:

| Persona | Goal | Core jobs-to-be-done |
|---|---|---|
| **Admin / Dispatcher** | Plan & monitor the fleet | Manage master data, create & assign orders, allocate vehicles (no double-booking), watch the live map, track inventory levels |
| **Driver** | Execute the day's deliveries | See today's shift, start shift, navigate, send GPS pings, mark deliveries complete/failed, end shift |

### 1.1 Requirement Traceability Matrix

Every requirement in the brief is mapped to a feature module so nothing is missed.

| # | Requirement (from brief) | Module | Persona |
|---|---|---|---|
| R1 | Create/edit Hubs, Terminals, Products, Drivers, Vehicles | Master Data | Admin |
| R2 | List views with search & filters | Master Data | Admin |
| R3 | Validation & error handling | Cross-cutting (forms) | Both |
| R4 | Create order (destination, product, qty, date) | Orders | Admin |
| R5 | Assign orders to drivers | Orders | Admin |
| R6 | View orders with status filters | Orders | Admin |
| R7 | Allocate vehicles to drivers for dates | Allocation | Admin |
| R8 | Calendar view of allocations | Allocation | Admin |
| R9 | Prevent double-booking (error) | Allocation | Admin |
| R10 | Live map: active vehicles, real-time locations | Fleet Map | Admin |
| R11 | Markers + driver info tooltip | Fleet Map | Admin |
| R12 | Filter by driver / vehicle / status | Fleet Map | Admin |
| R13 | Auto-refresh 30s + manual refresh | Fleet Map | Admin |
| R14 | Inventory table w/ product stock | Inventory | Admin |
| R15 | Low-stock color coding | Inventory | Admin |
| R16 | Inventory search & filter | Inventory | Admin |
| R17 | Shift card (vehicle, orders) | Driver Shift | Driver |
| R18 | Start Shift (disabled w/o allocation) | Driver Shift | Driver |
| R19 | List assigned deliveries | Driver Shift | Driver |
| R20 | Driver live map + destination markers + route | Driver Map | Driver |
| R21 | Send GPS Update (simulated) | Driver Map | Driver |
| R22 | Mark delivery Completed → updates inventory | Deliveries | Driver |
| R23 | Mark delivery Failed → reason modal | Deliveries | Driver |
| R24 | End Shift | Driver Shift | Driver |
| R25 | Shift History | Driver History | Driver |

### 1.2 Key User Flows (acceptance scenarios)

1. **Admin planning flow:** Create hub → create product → create order →
   allocate vehicle → see vehicle on the live map.
2. **Driver execution flow:** Start shift → view deliveries → send GPS updates →
   complete delivery → end shift.
3. **Real-time sync:** Driver sends GPS update → Admin's Live Fleet Map reflects the
   new position within one refresh cycle (≤30s or on manual refresh).
4. **Error path:** Allocate the same vehicle to two drivers on the same date →
   blocked with a clear error toast + inline message.

### 1.3 Definition of Done (per feature)

- Loading, empty, error, and success states all handled.
- Form validation with inline field errors.
- Responsive at 360px (mobile), 768px (tablet), 1280px (desktop).
- Keyboard-operable + ARIA labels on interactive elements.
- Covered by at least one test (unit / component / integration as appropriate).

---

## 2. Tech Stack & Rationale

Every choice below is **justified**, including the **alternatives considered and why they
were rejected** — this feeds directly into `docs/DECISIONS.md`. Nothing is added "by
default"; each library earns its place against the brief's evaluation criteria.

| Concern | Choice | Why this | Alternatives rejected |
|---|---|---|---|
| Framework | **React 18** + **Vite** | Brief allows React; huge ecosystem for maps/query/forms. Vite = instant HMR, fast builds, native TS/ESM, simple test setup with Vitest. | *CRA* (deprecated, slow); *Next.js* (SSR/routing overkill for a mock-API SPA, complicates json-server dev). |
| Language | **TypeScript (strict)** | Brief **prefers TS**. Domain has many linked entities (orders→drivers→vehicles→allocations) — types catch wiring bugs at compile time. Types are **inferred from Zod schemas**, so validation and typing share one source of truth. | *JavaScript* (loses the brief's preference + type safety across a relational domain). |
| Server state | **TanStack Query v5** | Owns all `db.json` data: caching, dedupe, `isPending`/`isError` (loading/error states = brief criteria), **`refetchInterval: 30_000`** delivers the map auto-refresh for free, plus optimistic updates + cache invalidation. | *Redux for server data* (manual cache/loading/refetch boilerplate — the anti-pattern Query exists to remove); *SWR* (fewer mutation/optimistic primitives); *raw useEffect+fetch* (re-implements caching badly). |
| Auth + global client state | **Redux Toolkit** | Holds **auth/session** (logged-in user + role), active driver shift, map filters, UI prefs — app-wide client state many routes read/write. RTK slices are pure, DevTools-inspectable, and **trivially unit-testable** (brief: testing quality). `persist` middleware keeps the session across reloads. | *Everything in Context* (re-render storms, no DevTools/middleware, harder to test); *Zustand* (fine, but brief explicitly names Redux/Context — we honor the stated stack). |
| Cross-cutting UI services | **Context API** | Thin providers for **Theme (dark mode)**, **Toast** bus, and **Confirm** dialog — infrequently-changing, truly global UI services where Redux would be boilerplate. Demonstrates the *correct* use of Context vs. Redux. | *Redux for theme/toasts* (overkill, verbose); *prop drilling* (unmaintainable across two persona trees). |
| **Auth (client-side)** | **Mock login → Redux `authSlice` + `AuthContext` façade** | Brief doesn't require a backend auth; a **client-side login** (pick/authenticate a user, role decides Admin vs Driver) demonstrates **protected routing, role-gating, and session UX** without a real server. State lives in Redux (testable), exposed via a small `AuthContext`/`useAuth()` for ergonomic consumption + route guards. | *No auth / bare role switcher* (misses protected-route & session UX signal); *real OAuth* (no backend, out of scope). |
| Mock API | **json-server** + `db.json` + custom `server.js` | Real REST endpoints, **session-persistent writes**, and middleware for artificial latency / errors / 409 conflict — matches brief **Option 1** and exercises loading & error states. | *MSW-only* (great for tests, but no persistence for the live demo — we use MSW **in tests** instead); *hardcoded state* (brief calls it "not recommended"). |
| Routing | **React Router v6** | Nested layout routes for `/login`, `/admin/*`, `/driver/*`; `loader`-free but supports **protected/role-gated route wrappers** driven by `authSlice`. | *TanStack Router* (newer, smaller ecosystem); *hash routing* (worse UX/SEO). |
| Maps | **Leaflet** + **react-leaflet** | Brief names Leaflet/Mapbox; Leaflet is **free, token-less**, supports markers, tooltips (driver info), and polylines (route line). React bindings keep markers declarative + reactive to Query data. | *Mapbox/Google* (require API keys/billing — friction for reviewers); *canvas from scratch* (reinventing panning/zoom). |
| Forms | **React Hook Form** + **Zod** | Uncontrolled inputs = minimal re-renders; **Zod** schemas give runtime validation **and** inferred TS types **and** reuse in tests — one schema, three jobs. Satisfies "form validation" + "TS interfaces". | *Formik* (more re-renders, heavier); *hand-rolled validation* (duplicated, error-prone). |
| Styling | **CSS Modules + design tokens** (CSS variables in `src/styles/`) | Scoped styles, zero runtime cost, **theme-able light/dark** via CSS custom properties, and total control over the FleetPanda petroleum brand (no fighting a UI kit's defaults). Tokens live in `src/styles/tokens.css` + `themes.css` (see `docs/UI_UX.md`). | *MUI/AntD* (generic look, hard to make "creative", large bundle); *Tailwind* (viable, but tokens+modules keep the brand system explicit and reviewable); *styled-components* (runtime cost). |
| Fonts | **@fontsource** (Barlow Semi Condensed, IBM Plex Sans, IBM Plex Mono) | Self-hosted via npm — **no CDN** (works offline/CSP), tree-shaken weights, subject-grounded signage+instrumentation pairing (see `docs/UI_UX.md §2`). | *Google Fonts CDN* (external request, offline-fragile); *Inter/system* (generic default face). |
| Icons | **lucide-react** | Consistent 1.5px-stroke icon set that reads as instrumentation; tree-shakeable; pairs with labels for a11y. | *Font-icon kits* (whole-set download); *emoji* (inconsistent, unstyleable). |
| Dates/calendar | **date-fns** + custom calendar grid | Tree-shakeable date math for the allocation calendar & delivery dates; a bespoke grid keeps the calendar on-brand and lightweight. | *moment.js* (heavy, legacy); *FullCalendar* (heavyweight for a simple month grid). |
| Testing | **Vitest** + **React Testing Library** + **MSW** | Vitest shares Vite config (fast, zero extra setup); RTL tests behavior not implementation; **MSW mocks the API in tests** (brief requirement) and reuses the same handlers across integration flows. | *Jest* (separate config/transform overhead with Vite/ESM); *Enzyme* (implementation-detail testing, deprecated). |
| Charts (inventory) | lightweight inline SVG bars/gauges | Fuel-gauge style meters on-brand, tiny, accessible, no dependency. | *Recharts/Chart.js* (bundle weight for a few bars). |

### 2.1 The Three-Layer State Strategy (the important decision)

The brief lists Redux **and** Context API; the user added TanStack Query. Rather than
pick one, each owns a **clearly separated slice of state** — this is the headline
architectural decision.

```
┌─────────────────────────────────────────────────────────────┐
│  SERVER STATE  →  TanStack Query                             │
│  Everything that lives in db.json: hubs, terminals, products,│
│  drivers, vehicles, orders, allocations, vehicle positions,  │
│  shifts, deliveries. Query keys, caching, 30s refetch,       │
│  mutations + optimistic updates + invalidation.              │
├─────────────────────────────────────────────────────────────┤
│  GLOBAL CLIENT STATE  →  Redux Toolkit                       │
│  auth (user + role + token), activeShiftId (just the id —    │
│  the shift ROW is server state), mapFilters (driver/vehicle/ │
│  status + refresh toggle), uiPrefs (sidebar, table density). │
│  auth persisted to sessionStorage (per-tab, survives reload).│
├─────────────────────────────────────────────────────────────┤
│  CROSS-CUTTING UI  →  Context API                            │
│  ThemeContext (light/dark), ToastContext (notifications),    │
│  ConfirmContext (promise-based confirm dialogs),             │
│  AuthContext (thin façade over authSlice → useAuth()).       │
└─────────────────────────────────────────────────────────────┘
```

**Rule of thumb:** *Does it come from the API? → TanStack Query. Is it app-wide client
state that many routes read/write? → Redux. Is it a UI service/provider? → Context.*
This keeps components lean and makes each layer independently testable.

**Single-ownership rule (no dual source of truth):** any entity that exists in `db.json`
is owned **only** by TanStack Query. Redux never stores a *copy* of a server row — only
**references** (e.g. `activeShiftId`) or purely client concerns (filters, prefs). The live
shift record is fetched via `useShift(activeShiftId)`; Redux just remembers which shift is
active for this session.

### 2.2 Client-side authentication design

No backend auth exists, so login is **simulated on the client** — but modeled properly so
it demonstrates real auth UX (protected routes, role-gating, session persistence):

- **Login page** (`/login`): user picks/enters credentials; we match against seeded
  `users` in `db.json` (each user has `role: admin | driver` and, for drivers, a
  `driverId`). A **mock token** is minted client-side.
- **`authSlice` (Redux):** `{ user, role, token, status }` — the single source of truth,
  persisted to **`sessionStorage`** (see below). Pure reducers → easy unit tests.
- **Persist to `sessionStorage`, not `localStorage` (deliberate):** the headline demo runs
  **Admin and Driver in two tabs at once** against the shared json-server. `localStorage` is
  shared across tabs, so a second login would clobber the first; **`sessionStorage` is
  per-tab**, letting each tab hold its own persona. Survives reload, isolates tabs.
- **Rehydration gate:** a `PersistGate` (or `authStatus: rehydrating → ready`) blocks route
  guards until persisted auth has rehydrated — otherwise a hard refresh of a deep link
  (`/admin/orders`) falsely bounces to `/login` before state loads.
- **`AuthContext` / `useAuth()`:** thin façade exposing `user`, `role`, `login()`,
  `logout()` so components/route-guards read auth without importing store internals.
  *Honest framing:* this is an **ergonomic seam** (one swap point for real auth later), not a
  technical necessity — typed Redux hooks would also work. It keeps the guard/consumer code
  decoupled from the state library.
- **Route guards:** `<ProtectedRoute>` (must be logged in) and `<RoleRoute role="admin">`
  wrap the route tree — Admin can't open `/driver/*` and vice-versa; unauthenticated users
  bounce to `/login`.

---

## 3. Domain Model & Data (db.json)

### 3.1 Entities & Relationships

```
User (id, email, name, role: admin|driver, driverId?, passwordHash)  ← mock login
Hub/Terminal (locationType: hub|terminal)
  └── inventory: { [product.key]: quantity }     ← keyed by product KEY string
Product (id, key: "diesel"|"petrol"|"premium", name, unit,
         lowStockThreshold, tankCapacity)   ← tankCapacity = gauge full-scale
Driver (id, name, license, phone, status)
Vehicle (id, registration, capacity, type, status)
Order (id, destinationId → Hub, sourceId → Hub, product (=key string),
       quantity, deliveryDate, assignedDriverId → Driver, status,
       failureReason?, completedAt?)
Allocation (id, vehicleId, driverId, date)   ← unique (vehicleId + date)
Shift (id, driverId, vehicleId, date, status, startedAt, endedAt,
       orderIds[])
VehiclePosition (id, vehicleId, driverId, lat, lng, updatedAt, status)
```

**Data-model decisions (aligned to the brief's sample):**
- **Inventory & orders are keyed by the product `key` string** (`"diesel"`, `"petrol"`) —
  exactly as the brief's sample seeds them (`inventory: {diesel, petrol}`, `order.product:
  "diesel"`). `Product.key` is the join; `Product` rows add name/unit/threshold metadata.
  (Avoids the silent `inventory[productId] → undefined` mismatch.)
- **No separate `Delivery` entity.** A "delivery" *is* an `Order` in the context of a shift
  (`shift.orderIds`). Order status + `failureReason`/`completedAt` carry the full lifecycle —
  one source of truth instead of a redundant mirror table.
- **`sourceId` is a deliberate addition** (not in the brief's sample): fuel must load *from*
  a hub, so we need the origin for the inventory maths and the route line.
- **`Product.tankCapacity` is a deliberate addition:** the fuel-gauge UI fills `qty /
  tankCapacity` and draws `lowStockThreshold` as a tick — without a full-scale reference the
  gauge fill is undefined. `lowStockThreshold` stays as the alert line.

**Stock level rule (single definition — used by gauge, badge, and row stripe):**
`crit` when `qty < lowStockThreshold`; `warn` when `qty < 1.5 × lowStockThreshold`;
otherwise `ok`. One function `stockLevel(qty, threshold)` in `services/`, unit-tested.

**Status enums**
- Order: `pending → assigned → in_transit → delivered | failed`
- Vehicle/Driver: `available | on_shift | maintenance(vehicle)`
- Allocation uniqueness: **`(vehicleId, date)` must be unique** — enforced client-side
  before POST (double-booking guard).
- Shift: `not_started | active | ended`

### 3.2 Seed data (realistic petroleum logistics)

- **6 hubs/terminals** across a metro area (with lat/lng + diesel/petrol inventory,
  some intentionally near/below low-stock thresholds to demo alerts).
- **3 products:** Diesel, Petrol (Regular), Premium Petrol — each with unit (litres),
  `lowStockThreshold`, and `tankCapacity` (gauge full-scale).
- **6 drivers**, **6 vehicles** (Tankers of varying capacity).
- **~10 orders** spread across statuses and dates (today, past, upcoming).
- **Allocations** for today so a driver can Start Shift immediately in the demo.
- **VehiclePositions** seeded near their source hubs so the live map is populated on load.

### 3.3 Mock API endpoints (json-server + custom middleware)

Standard REST from json-server:
```
GET                    /users            (mock login lookup: email/role/driverId)
GET/POST/PATCH/DELETE  /hubs /products /drivers /vehicles
GET/POST/PATCH/DELETE  /orders /allocations /shifts /deliveries
GET/PATCH              /vehiclePositions
```
Custom `server.js` middleware layered on json-server for:
- **Artificial latency** (~300–600ms) and **occasional 500s** (togglable) to exercise
  loading/error states (brief: "simulate API delays and errors").
- **Allocation double-booking guard** returning `409 Conflict` (client also guards).
- **Inventory side effects** (see rule below), applied atomically.

**Inventory flow (corrected — fuel moves source → destination):**
- On **dispatch/load** (order → `in_transit` when the shift starts): **decrement the
  `sourceId` hub** by `order.quantity` for `order.product` — the tanker takes fuel out.
- On **delivery complete** (order → `delivered`): **increment the `destinationId`** hub/
  terminal by `order.quantity` — the fuel arrives. (Earlier draft decremented the
  destination, which was backwards.)
- On **delivery failed**: no inventory change; if already dispatched, the load is considered
  still on the vehicle (out of scope to model returns).

**Single-writer contract (see `docs/IMPLEMENTATION.md §1`):** all transactional side-effects
are owned by **custom Express routes in `server.js`** — `POST /shifts/:id/start`,
`/orders/:id/complete`, `/orders/:id/fail`, `/shifts/:id/end`, `/allocations`. The client's
`services/` layer **only validates/derives** (conflict checks, disabled states) and never
writes inventory — preventing any double-apply.

**Correctness rules enforced server-side (client mirrors for UX):**
- **Idempotent transitions:** source decrement fires only on `assigned → in_transit`,
  destination increment only on `in_transit → delivered`; repeat/illegal transitions → `409`.
- **Non-negative inventory:** dispatch that would drive a hub's stock below zero → `422`;
  client disables **Start Shift** with an explicit reason.
- **No past-dated planning:** orders and allocations must be dated **today or later** — history
  is read-only. Enforced by Zod (`notPast`), the UI (`min` date + disabled past calendar days),
  and the server (`422` on a past allocation date).

---

## 4. Project Structure

```
fleetpanda/
├── db.json                     # json-server seed (session-persistent)
├── server.js                   # json-server + custom middleware (latency/errors/rules)
├── vite.config.ts
├── vitest.config.ts
├── package.json
├── README.md
├── docs/
│   ├── COMPONENTS.md           # component hierarchy & responsibilities (deliverable)
│   ├── STATE_MANAGEMENT.md     # 3-layer state strategy (deliverable)
│   ├── DECISIONS.md            # ADRs: why each choice (deliverable)
│   ├── IMPLEMENTATION.md       # code-level technical approach (side-effects, Query, Leaflet…)
│   └── UI_UX.md                # design language & experience spec (concept, tokens, screens)
├── public/
└── src/
    ├── main.tsx                # Providers: Query, Redux, Router, Theme, Toast
    ├── app/
    │   ├── router.tsx          # route tree (/login, /admin/*, /driver/*)
    │   ├── guards/             # ProtectedRoute, RoleRoute (auth + role gating)
    │   ├── store.ts            # Redux store config (+ persist for auth)
    │   └── queryClient.ts      # TanStack Query client + defaults
    ├── config/
    │   ├── env.ts              # API base URL, refresh interval
    │   └── constants.ts        # enums, thresholds
    ├── types/                  # shared TS domain types (mirror Zod schemas)
    ├── api/
    │   ├── httpClient.ts       # fetch wrapper (errors, JSON, base URL)
    │   └── endpoints/          # hubs.api.ts, orders.api.ts, ... (raw calls)
    ├── services/               # business rules (allocation guard, inventory math)
    ├── hooks/
    │   └── queries/            # useHubs, useOrders, useAllocations, useMutation wrappers
    ├── store/
    │   ├── slices/             # authSlice, shiftSlice, mapFiltersSlice, uiSlice
    │   └── selectors/          # selectAuth, selectRole, ...
    ├── contexts/
    │   ├── AuthContext.tsx     # useAuth() façade over authSlice + route guards
    │   ├── ThemeContext.tsx
    │   ├── ToastContext.tsx
    │   └── ConfirmContext.tsx
    ├── components/             # SHARED, reusable, presentational
    │   ├── ui/                 # Button, Input, Select, Modal, Table, Badge, Card, Spinner, Skeleton, EmptyState, Toast
    │   ├── layout/             # AppShell, Sidebar, Topbar, UserMenu (logout)
    │   ├── forms/              # FormField, FormError, validated wrappers
    │   └── map/                # MapView, VehicleMarker, DestinationMarker, RouteLine
    ├── features/              # FEATURE modules (smart components + local pieces)
    │   ├── auth/               # LoginForm, useLogin, authSlice wiring
    │   ├── dispatch/           # readiness engine + shift advisories (useDispatchReadiness,
    │   │                       #   useShiftAdvisories, ReadinessPill, ctaFor, readinessGroup)
    │   ├── master-data/        # hubs, terminals, products, drivers, vehicles
    │   ├── orders/
    │   ├── allocation/         # calendar + order-aware allocation + conflict/capacity guard
    │   ├── fleet-map/          # admin live map + filters + auto-refresh
    │   ├── inventory/          # table + low-stock coloring
    │   ├── driver-shift/       # shift card, start/end shift
    │   ├── driver-map/         # driver location, GPS update, route
    │   ├── deliveries/         # complete/fail delivery, reason modal
    │   └── shift-history/
    ├── pages/                  # route-level compositions (thin)
    │   ├── LoginPage.tsx
    │   ├── admin/
    │   └── driver/
    ├── styles/                 # tokens.css (color/type/space), themes.css (light/dark),
    │                           #   globals.css — consumed by CSS Modules (see docs/UI_UX.md)
    ├── utils/                  # clock, geo (stepToward), formatters, validators
    ├── lib/                    # zod schemas (single source of truth for validation+types)
    └── test/                   # test setup, MSW handlers, factories
```

**Conventions**
- `components/` = dumb/reusable; `features/` = domain-aware/smart; `pages/` = thin route
  compositions. This gives clean reusability and maps directly to the COMPONENTS.md doc.
- One Zod schema per entity in `lib/` → inferred TS type → reused in forms **and** tests.

---

## 5. Feature Design (per module)

### 5.0 Authentication (client-side)
- **`/login`** page with a validated form (RHF + Zod). Demo credentials shown on the page
  (e.g. `admin@fleetpanda.com`, `driver@fleetpanda.com`) plus a "quick-login" chip per role
  for a frictionless reviewer experience.
- On submit → look up `users` in `db.json`, mint a mock token, dispatch `authSlice.login`.
- **Protected + role-gated routing:** unauthenticated → `/login`; role decides landing
  (`/admin` vs `/driver`) and blocks the other tree. Logout from the top-bar user menu.
- Session **persists** across reloads; deep-linking to a guarded route after refresh works.

### 5.0b Dispatch Readiness (the "what needs doing" engine)
Real dispatchers think in terms of *"which orders are ready to roll, and what's blocking the
rest."* One pure classifier, `orderReadiness(order, ctx)` in `services/rules.ts`, resolves
every order to exactly one state — **needs_driver → needs_vehicle → blocked_capacity →
blocked_stock → ready → in_transit → done** — with a tone, label, and next action. The
**dashboard, the Orders table, and the allocation step all read this same function**, so they
can never disagree. `useDispatchReadiness(date)` buckets a day's orders; `useReadinessResolver()`
resolves any single order (any date). No new server state — pure derivation from existing
queries. Fixes the earlier sequencing bug: "no vehicle yet" is a **normal next-step
(Needs vehicle)**, not an error, matching Key User Flow #1 (order → *then* allocate).

### 5.0b-ii Logistics realism (distance, journey time, shift feasibility, utilisation)
`services/logistics.ts` adds real-world planning maths (all unit-tested): **distance**
(haversine source→dest), **journey time** per order (load + round-trip travel at 45 km/h +
unload), **driver-day plan** (Σ time vs an 8h shift → *overbooked*; total load ÷ capacity →
*under-utilised* below 35%). These are **driver-DAY** concerns (not per-order), so they live
*outside* `orderReadiness` and surface where the day is committed: **Allocation** (time +
utilisation + maintenance/booked vehicles disabled), a **dashboard "Shift advisories"** strip
(overbooked / under-utilised drivers with a Review CTA), and the **driver shift card** (route
km + estimated time + ETA). Capacity/maintenance/double-book **block**; overbooked/under-util/
stock **warn**.

### 5.0c Admin Dashboard — action center
The dashboard is the admin's **to-do list**, not vanity KPIs: a **readiness summary row**
(Ready / In transit / Need action / Blocked, each a filter link) over a **"What needs you"**
list — the day's actionable orders, ranked (blocked → needs), each naming the exact problem and
a **deep-link CTA** that pre-loads the fix ("Assign driver" → Orders filtered to pending;
"Allocate vehicle" → Allocation prefilled with driver+date; "Review stock" → Inventory). Plus a
low-stock panel. Fix it → the count drops → the item disappears. An "all clear" state when the
day is fully dispatched.

### 5.1 Master Data Management
- Share **primitives**, not a whole generic engine (YAGNI guard): reusable `<Table>`,
  `<Toolbar>` (search + filter chips), and `<FormDrawer>` shell; each entity has its **own
  thin form** (its Zod schema + fields). Faster and clearer than a fully config-driven CRUD
  factory when the five entities' fields diverge.
- **Hubs and Terminals share one entity** (`locationType`), managed in a single **"Hubs &
  Terminals"** section with a **Type dropdown** (form), **Type filter** (All/Hubs/Terminals) and a
  **Type badge** in the list — one place to manage while still visibly covering the brief.
- **Location form uses an offline map picker**: click the map to set coordinates (no manual
  lat/lng typing, no external geocoding — Leaflet has none; a Nominatim/Mapbox address search is a
  documented opt-in, see `docs/DECISIONS.md`).
- **Layout:** a **left entity rail** (icon + label + live count per entity) selects which
  entity to manage; the right pane shows a contextual title + "New" button, search, filters, and
  the list. Scales better than horizontal tabs and shows counts at a glance.
- **Search + attribute filters:** each list has a search box; Drivers and Vehicles add a
  status **filter-chip** row (available / on shift / maintenance). Hub inventory shows as
  **stock-coloured chips**.
- Optimistic create/edit/delete via TanStack mutations + query invalidation (applied here
  and to delivery actions — the two flows where it reads best; not blanket everywhere).

### 5.2 Order Management
- Create-order form: source + destination (hub select), product, quantity, delivery date.
  **Operational validation (usability):** as you fill it, the form shows the **source hub's
  live stock** for the chosen product and warns (amber) when the quantity exceeds it —
  "short by N; order can be placed but the shift can't start until replenished" — or
  confirms (green) that the source can cover it. Non-blocking, since the delivery date may be
  future and stock can change.
- Orders table with **status filter tabs** (All/Pending/Assigned/In-transit/Delivered/Failed),
  deep-linkable via `?status=` (dashboard CTAs), plus a **Readiness column** (`ReadinessPill`
  from the shared engine) so each order's next-step is visible in context.
- Create form keeps the **live source-stock** feedback (`orderStockCheck`). Assign-driver is a
  clean inline action → PATCH order `assigned`; the *reframed* "no vehicle yet" is now shown as
  the order's **Needs vehicle** readiness (an expected next step), not an error toast — the
  capacity check moved to the step that owns it (allocation).
- **Edit / delete** for `pending`/`assigned` orders (locked once `in_transit`): the same
  **`OrderForm`** serves create and edit (pass `initial`), demonstrating the reusable-form
  pattern used across master data.

### 5.3 Vehicle Allocation (order-aware)
- **Calendar grid** (month view) rendering allocations per day; deep-link prefill from
  dashboard CTAs (`{driverId, date}` via router state auto-opens the form).
- Allocate form is **order-aware**: picking a driver + date shows their **load for the day**
  (order count + litres); vehicles **too small for that load are disabled** and selecting one
  is **hard-blocked** (can't allocate) — capacity is physically impossible, so it blocks.
- **Double-booking prevention:** client pre-check + inline error; server returns `409` as the
  authoritative backstop.
- **Stock is a warning, not a block:** if a source hub can't currently cover the driver's
  orders, an amber note appears but allocation still proceeds (stock may be replenished before
  the date). Blocking rules stay server-side at dispatch (`422`).

### 5.4 Live Fleet Map (core)
- `react-leaflet` map with a **`<VehicleMarker>`** per active `vehiclePosition`.
- Tooltip/popup: driver name, vehicle reg, current order/status.
- **Vehicle map status (derivation for tooltip + filter):** a vehicle's status = the status
  of its current `in_transit` order if any, else `loading` (shift active, nothing dispatched)
  else `idle`. Computed by a `vehicleStatus()` selector so tooltip and filter always agree.
- **Filter panel** (Redux `mapFilters`): by driver, vehicle, delivery status (per above).
- **Auto-refresh:** `useQuery(..., { refetchInterval: 30_000 })` + manual "Refresh" button
  (`refetch()`) + toggle to pause auto-refresh. Shows "last updated" timestamp.
- **Identifiable, trackable, moving markers:** each vehicle is a **labeled truck pin**
  (registration + status colour, pulse when in-transit) with a **heading arrow** pointing the way
  it's travelling; **animated flowing route lines** to the destination signal motion at a glance;
  **hub/terminal context markers**. Tooltip/popup/list show **cargo (product + quantity)**,
  destination, remaining **km + ETA**.
- **Selection sync:** clicking a vehicle in the list highlights + **flies the map** to its marker
  (and clicking a marker selects the row) — the selected route is emphasised, others dimmed.
- **Accessible fallback:** the side **vehicle list panel** (same filtered data, now keyboard-
  focusable buttons) is the non-map equivalent — maps are inherently hard for a11y — and doubles
  as the results list.

### 5.5 Inventory Dashboard
- Table of hubs × products; each cell is a **fuel gauge** (`qty / tankCapacity`, threshold
  tick) + tabular number.
- **Low-stock color coding** via the single `stockLevel()` rule (§3.1): `ok`/`warn`/`crit`
  = green/amber/red, always **color + icon** (not color alone). Low rows carry a left
  severity stripe so problems read before the numbers.
- Search by hub, filter by product / stock level.

### 5.6 Driver — Shift & Delivery Management
- **Shift status card**: assigned **truck** (registration · type · capacity), an **Active /
  Not-started** badge, a **progress bar** (delivered / total, %), route km + driving time + **ETA**
  (from the truck's live position), and total load.
- **Start Shift** disabled without an allocation / stock (plain-language reason). On start →
  shift `active`, orders `in_transit`, **source hubs decrement** (load). **End Shift** confirms.
- **Delivery Management** = one **card per delivery** (route-ordered): **source hub → destination
  terminal with type badges**, product + quantity, leg distance, status; the **current** delivery
  is highlighted; **Mark delivered** (→ inventory update) / **Report failure** (reason modal);
  delivered/failed cards show completion time / failure reason.
- *Sequential runs:* ending a shift frees the driver + vehicle for **re-allocation** (one active
  truck per shift; no mid-shift swap — see §10).

### 5.7 Driver — Live Map + GPS (navigation)
- Own-vehicle marker with a **heading arrow** toward the next stop, labeled **destination
  markers** (with cargo in tooltip), and an **animated route line** (straight-line; no
  road-routing engine — optional in the brief).
- A floating **navigation card** ("Next stop"): destination, **product + litres**, distance
  remaining, ETA — the key info for the driver to navigate.
- **Send GPS Update** → PATCH `vehiclePosition` (nudges coordinates toward destination) →
  Admin map picks it up on next refresh (real-time flow; demo with Admin + Driver in two tabs).

### 5.8 Delivery Management
- Per delivery (= an order in the shift): **Complete** → success toast + **increment the
  destination hub's inventory** + order `delivered` + `completedAt`. **Fail** → **reason
  modal** (required text) → order `failed` + `failureReason`.
- **End Shift** → shift `ended`, moves to history, frees vehicle & driver back to `available`.

### 5.9 Shift History
- List of past shifts with date, vehicle, deliveries completed/failed counts.

---

## 6. UI/UX & Design System (FleetPanda brand)

> **Full design language now lives in `docs/UI_UX.md`** (concept, token tables, typography,
> key-screen layouts, motion, state design, a11y). This section is the summary; the doc is
> the source of truth and revises some choices below (amber → semantic-only, Barlow + IBM
> Plex type, graphite/petrol palette).

**Design intent:** Petroleum logistics is operational and safety-conscious — the UI should
feel like a **dispatcher's console**: calm, high-contrast, data-dense but scannable, where
**warm color always means fuel or attention**. Creative but *usable*, not decorative.

### 6.1 Brand & tokens (CSS variables, theme-aware)
- **Primary — "Panda Teal / Deep Petrol Blue"** `#0E7C86` / `#0B3D4F`: trust, fuel/energy.
- **Accent — "Fuel Amber"** `#F5A524`: CTAs, energy, active states.
- **Semantic:** success `#16A34A`, warning `#D97706` (low stock), danger `#DC2626`
  (failed/double-book), info `#2563EB`.
- **Neutrals:** slate ramp for surfaces/text; both **light & dark themes** via
  `data-theme` + `prefers-color-scheme` (Nice-to-have: dark mode ✔).
- Typography: Inter (system fallback); tabular numerals for inventory/quantities.
- Spacing scale (4px base), radii, elevation tokens for a consistent, polished feel.

### 6.2 Signature UX touches (creative + friendly)
- **Branded login** with one-click **quick-login chips** (Admin / Driver) so reviewers jump
  into either persona instantly — role-based redirect lands them in the right workspace.
- **User menu** in the top bar showing the logged-in identity + role, with logout.
- **Panda mascot** empty-states & first-run hints (friendly, on-brand microcopy).
- **Live map "pulse"** animation on vehicle markers + a subtle "updated" flash on refresh.
- **Fuel-gauge style inventory meters** (radial/bar) reinforcing the petroleum theme.
- **Skeleton loaders** + **toast notifications** + **optimistic UI** (all Nice-to-haves ✔).
- **Command feel:** sticky filter bars, status **badges** with icon+color (never color
  alone → accessible).
- Smooth **transitions** (drawer slide, toast, marker move) via CSS/Framer-lite motion.

### 6.3 Responsiveness & a11y
- Mobile-first: driver interface is the mobile hero (drivers use phones); admin tables
  collapse to card lists on small screens; sidebar → bottom nav / drawer on mobile.
- **ARIA** labels, focus management in modals/drawers, full keyboard nav, visible focus
  rings, WCAG AA contrast in both themes.

---

## 7. Cross-Cutting Concerns

- **Error boundaries:** app-level + per-feature boundary → friendly fallback + retry.
- **Loading states:** skeletons for lists/tables/map; spinners for button actions.
- **Async/error UX:** TanStack `isPending`/`isError`; mutation errors → toast + inline.
- **Validation:** Zod schemas shared by forms and API-service guards.
- **Optimistic updates:** mutations update cache immediately, roll back on error.
- **Notifications:** ToastContext bus (success/error/info) with auto-dismiss + a11y live region.
- **Config-driven:** API base URL, refresh interval, latency/error simulation flags.
- **Error simulation defaults OFF:** random 500s stay behind a flag (on for the loading/error
  showcase + tests) so the 30s-polling map never flickers errors during a live demo.

---

## 8. Testing Strategy (deliverable: coverage report)

| Layer | Tool | What we test |
|---|---|---|
| Unit | Vitest | utils (geo distance/step), rules (`stockLevel`, `gaugeFill`, `vehicleMapStatus`, `startShiftReadiness`, `orderStockCheck`, `orderReadiness` — all branches), logistics (`orderJourney`, `driverDayPlan` + deadhead, **`sequenceOrders`**, `etaEnd`), Redux reducers/selectors |
| Component | RTL | Button/Table/Modal, forms with validation, VehicleMarker/tooltip, inventory low-stock coloring |
| Integration | RTL + **MSW** | Critical flows: create order, allocate vehicle (+ **double-book error**), complete delivery → inventory decrement, start/end shift |
| API mocking | MSW | All network calls mocked in tests (brief requirement) |

- Coverage target: **≥70%** on utils/services/slices; key flows covered end-to-end.
- `npm test`, `npm run test:coverage` documented in README.

---

## 9. Delivery Plan (phased)

### 9.1 Priority cut line (MoSCoW) — protect the core within 2–3 days

The brief's #1 evaluation item is UI/UX and the **Live Fleet Map is the "core feature."**
Scope is triaged so an unfinished core can never happen:

- **Must (non-negotiable):** all R1–R25, Live Fleet Map, double-booking guard, inventory
  side-effects, responsive + basic a11y, critical-path tests.
- **Should (do if on track):** client-side auth, dark mode, toasts, skeletons.
- **Could (time-boxed, cut first if behind):** panda mascot, fuel-gauge meters, marker
  animations, optimistic UI beyond the two showcase flows.

Coverage is **right-sized to critical paths** (allocation conflict, delivery→inventory,
shift lifecycle, auth guard), not a blanket 70% across every file.

### 9.2 Phases

| Phase | Deliverable | Includes |
|---|---|---|
| **0. Scaffold + Auth** | Running shell + login | Vite+TS, Router, Redux store (+persist), Query client, Theme/Toast/Auth contexts, json-server + `db.json` + seed, design tokens, `<AppShell>`, **client-side login + protected/role-gated routes** |
| **1. Master Data** | CRUD works | Reusable Table/Form/Drawer, hubs/terminals/products/drivers/vehicles, search/filter/validation |
| **2. Orders & Allocation** | Planning works | Order create/assign/filter; allocation calendar + **double-booking guard** |
| **3. Live Fleet Map** | Core feature | Leaflet map, markers+tooltips, filters, 30s auto-refresh + manual |
| **4. Inventory** | Monitoring | Inventory table, low-stock coloring, search/filter |
| **5. Driver App** | Execution | Shift view, start/end shift, driver map + GPS update, complete/fail delivery + inventory side-effect, shift history |
| **6. Polish** | Nice-to-haves | Dark mode, skeletons, optimistic UI, animations, a11y pass |
| **7. Testing & Docs** | Submission-ready | Vitest+RTL+MSW suites, coverage report, COMPONENTS/STATE_MANAGEMENT/DECISIONS.md, README, deploy (Vercel/Netlify) |

---

## 10. Open Questions / Assumptions

- **Auth:** The brief doesn't mention auth, so we implement a **client-side mock login**
  (Redux `authSlice` + `AuthContext`, seeded `users` in `db.json`). This is a deliberate
  value-add: it demonstrates protected routing, role-gating, and session persistence — real
  auth UX — without needing a backend. A real API can drop in behind `useAuth()`/`login()`
  later with no component changes. (See §2.2.)
- **"Terminals" vs "Hubs":** treated as one entity with a `locationType` discriminator
  (`hub | terminal`) — matches the shared sample structure.
- **Real-time:** achieved via TanStack polling (30s) since there's no websocket backend;
  driver GPS writes are visible to admin on the next poll/refresh.
- **Persistence:** json-server persists writes to `db.json` for the session (survives even
  refresh, exceeding the brief's "session only" bar).
- **Shifts & trucks:** one **active truck per shift**; a driver runs their sequenced route, then
  **End Shift** frees them + the vehicle, after which they can be **re-allocated a new truck/orders**
  (sequential runs). A *mid-shift* truck swap (changing trucks without ending the shift) is out of
  scope — it'd need a shift-leg model; the current one covers realistic single-truck day runs.
- **Deployment (honest caveats):** static hosts (Vercel/Netlify) **cannot run json-server**;
  it needs a Node host (e.g. Render), whose free tier has an **ephemeral filesystem**
  (`db.json` resets on sleep/redeploy) and requires **CORS** config for the SPA origin.
  Because of this, the **recorded 2–3 min video is the primary demo deliverable**, with a
  deployed link as a bonus. README documents local run (the most reliable path).

---

## 11. Revision Log

**Rev 27 — driver view as trips (milk-run) + all-driver logins:**
- **P2:** new `buildTrips()` groups a day's orders by pickup source; `driverDayPlan` now models a
  **load-once + chained-drops** run (plus inter-trip deadheads) instead of a round-trip per order —
  ETA/km are no longer overestimated and match the single-tank allocation guard.
- **P1:** `DeliveryManager` renders a **Load header per trip** (source · litres · drops · tank-fill)
  then the drop cards, so the pickup shows once, not on every card.
- **P3:** the Shift hero shows a **tank-fill** line (`<load> loaded · <n>% of <reg>`).
- **Logins:** every driver now has an account (`seed.js`); `SEED_VERSION` bumped so stale demo
  caches reset (fixes "can't log in as amina"). Login page adds Amina + Sam quick chips. ADR-29.
- **420 tests pass, 100% coverage** (overbooked fixtures updated to ≥16 drops for the new math).

**Rev 26 — serverless self-heal: recover from idle Service-Worker eviction:**
- Fixed the deployed-demo error `Unexpected token '<', "<!doctype "... is not valid JSON` seen
  **after the tab sat idle**: browsers stop idle Service Workers, so a request (e.g. the 30 s Fleet
  Map poll) fell through to Netlify's SPA fallback (`index.html`) and crashed `JSON.parse`.
- `httpClient` now self-heals in mock mode — an HTML response re-arms the worker
  (`reviveMockWorker()` → `navigator.serviceWorker.ready` + `worker.start()`) and **retries once**,
  otherwise throws a clear 503. New test `httpClient.selfheal.test.ts`; ADR-28 updated.

**Rev 25 — serverless deploy: in-browser mock API (MSW):**
- The app now ships a **serverless build** that runs its API **inside the browser** via a
  **Service Worker** (MSW), so it hosts on Netlify with **no backend, no DB, no cold start**
  (fixes the earlier localhost/MIME deploy problems — ADR-14/-28).
- The transactional rules were extracted into a **shared handler factory** (`src/mocks/handlers.ts`)
  reused by **both** the test server (`msw/node`) and the browser worker (`src/mocks/browser.ts`),
  seeded from a frozen snapshot (`src/mocks/db.seed.json`) and persisted per-browser to
  `localStorage`. `VITE_MOCK=true` (wired in `netlify.toml`) enables it and pins
  `VITE_DEMO_DATE=2026-07-10` to the seed. New scripts: `dev:mock`, `build:mock`, `seed:snapshot`.
- The shared handlers now faithfully mirror `server.js` (past-date allocation guard; driver/vehicle
  status flips on shift start/end; timestamp shift ids) — **3 tests realigned** to the real
  behaviour they'd been shimming. **376 tests pass** (2 pre-existing WIP tests unrelated to this
  change remain red — OrderForm past-date text + HubForm picker button). ADR-28 records the rationale.

**Rev 24 — code-quality: remove inline styles + composable primitives:**
- **All presentational inline `style={{}}` removed** (~28 across 13 files) → CSS Modules or global
  utilities (`.capitalize`, `.muted` alongside the existing `.mono`/`.num`). The only remaining
  `style` bindings are **CSS custom properties for genuinely data-driven geometry** (fuel-gauge
  fill/tick, shift progress width) — the correct pattern; the rules live in CSS.
- **Component architecture:** `Field`'s `Input`/`Select` now **merge `className`** (composable —
  callers extend without losing base styles); `Table` uses **`data-align` + a `--col-w` var**
  instead of inline alignment/width; added `ErrorBoundary`/`ConfirmContext`/`OrdersPage` CSS
  modules; added `.opCrit` variant so warning banners don't override via inline colours.
- Styling standard documented (`docs/DECISIONS.md` ADR-12). No visual change; **326 tests pass**.

**Rev 23 — large validated dataset + use-case validation:**
- `seed.js` now appends a **deterministic bulk dataset** to the curated demo core: **82 locations,
  107 drivers, 108 vehicles, 129 orders, 58 allocations, 246 inventory cells** — all **valid
  against the app rules** (inventory ≤ tankCapacity, source≠destination, referential integrity,
  status↔date consistency, unique vehicle+date allocations). Exercises pagination and every order
  status/readiness state.
- **Validation found a real bug:** a curated hub held **22,000 L diesel vs the 20,000 L cap**
  (the cap rule was added later) → fixed. Products kept at 3 by design (a fuel network has few
  products; 100 would make the inventory table unusable — noted, not a miss).
- Test suite expanded to **262 passing**; fixed a brittle `getByText` matcher + 2 test-infra types.

**Rev 22 — pagination + mobile responsiveness:**
- **Pagination built into the shared `Table`** (default 10/page, configurable) → Master Data,
  Orders, and **Inventory** (converted to the shared Table with dynamic product columns) all
  paginate, with a "A–B of N" + prev/next footer that resets to page 1 when the filter changes.
- **Mobile nav fixed**: the sidebar is now a proper **off-canvas drawer** (hamburger opens it,
  a **scrim** taps to close, and it **auto-closes on navigate**) on ≤720px, separate from the
  desktop rail-collapse. Other screens' breakpoints validated (dashboard, fleet map, master-data
  rail, driver run-sheet, forms, calendar).

**Rev 21 — cleanup + reusable forms (extensibility proof):**
- **`OrderForm` is now reusable for create *and* edit** (optional `initial`, mirroring the
  master-data forms) — and wired up: **edit + delete** actions on the Orders table for `pending`/
  `assigned` orders (guarded; `in_transit`/terminal orders are locked). Added `update`/`remove`
  order mutations. This is the "easy to enhance like order editing" the design was built for.
- **DRY:** extracted the duplicated `line()` polyline helper to `components/map/mapUtils.ts`
  (`toLatLngs`); `DeliveryManager` reuses `logistics.legKm` instead of a local copy.
- Tests: +2 (order update/delete via MSW) → **67 total**.

**Rev 20 — driver shift + delivery-management redesign:**
- Reframed the driver screen from a compact "run sheet of stops" into a **Shift & Delivery
  Management** portal (matches the brief's Shift View + Delivery Management sections):
  - **Shift status card**: assigned **truck** (reg · type · capacity), **Active/Not-started**
    badge, a **progress bar** (delivered/total, %), route km + ETA, Start/End Shift.
  - **Delivery Management** = one **card per delivery** clearly showing **source hub → destination
    terminal with their type badges**, product + quantity, leg distance, status, and the
    **current** delivery highlighted; big **Mark delivered / Report failure** actions; delivered/
    failed cards show completion time / failure reason. (`DeliveryManager` replaced `DeliveryList`.)

**Rev 19 — location flow: geocoding (search + reverse):**
- The location form's picker now does **both directions**: **type an address → results dropdown →
  pick** (forward), and **click the map → address auto-fills** (reverse), both setting coordinates
  + address together. Via **Nominatim** (`services/geocode.ts`), **best-effort with graceful
  fallback** — offline/rate-limited just leaves the address editable, form never breaks. Reordered
  so the picker leads and the address field is auto-filled (editable) below.
- Tests: +1 (geocode short-circuit) → **65 total**. (ADR-27 updated.)

**Rev 18 — inventory capacity validation & guidance:**
- **Hub inventory is now capped at each product's `tankCapacity`.** The location form shows a
  **"Max N L" hint** and `max` on every inventory field and **blocks over-capacity** with an inline
  error (e.g. 800,000 L petrol into a 20,000 L tank → rejected). Dynamic Zod (`makeHubSchema`)
  built from the products.
- **Product form** educates: "Max tank capacity (L) — the most a hub can store …", low-stock hint,
  and validates **threshold ≤ capacity**.
- Tests: +4 (capacity/threshold) → **64 total**.

**Rev 17 — merged Hubs & Terminals + map location picker:**
- Hubs and Terminals (already one entity) merged into a single **"Hubs & Terminals"** rail
  section with a **Type dropdown** (form) + **Type filter** (All/Hubs/Terminals) + **Type badge**
  (list). One place to manage; still visibly satisfies the brief.
- **Offline map location picker** in the location form: **click the map to set lat/lng** (Leaflet
  `CircleMarker`, OSM tiles); the number fields become an auto-filled readout. No geocoding /
  external service — deliberate, to keep the app offline & deterministic (Leaflet has no
  geocoding API; address-search would need Nominatim/Mapbox — offered as a documented opt-in,
  not wired). Address stays a manual label.

**Rev 16 — Master Data UX redesign:**
- Replaced the wrapping row of entity pill-chips with a **left entity rail** (icon + label +
  **live count** per entity: Hubs/Terminals/Products/Drivers/Vehicles), content on the right with
  one clean toolbar and a contextual "New" button. Strong "you are here", no chip-wrapping, and
  counts at a glance. Rail collapses to a horizontal scroll strip on mobile.
- **Hub inventory** now renders as **stock-coloured chips** ("Diesel 15,000" with an ok/warn/crit
  dot) instead of a cramped mono string.

**Rev 15 — maps rebuilt on `CircleMarker` (definitive placement fix):**
- Both maps re-implemented from scratch using Leaflet **`CircleMarker`** instead of divIcons.
  CircleMarkers render in the SVG overlay pane **directly at the projected coordinate** — no icon
  box, no `iconAnchor`, no CSS centering — so placement is **mathematically exact**: the truck
  sits **on the motion line** (its position IS a route waypoint), and **pickup/dropoff dots sit
  exactly on their hubs**. Trucks painted last (on top); permanent tooltips carry labels
  (🚚 reg, 📦 Pickup · hub, ⛽ hub · qty product). Removed the divIcon `markers.ts` + its CSS.
- Route lines (casing + bright animated + trail) unchanged; selection/fly-to/list panel kept.

**Rev 14 — visible truck + route motion, accurate placement:**
- **Marker placement fixed (Leaflet divIcon anchoring):** two bugs — (a) Leaflet's default
  `.leaflet-div-icon` draws a **white bordered box** (never reset) that made pins look boxed/off;
  (b) pins were rotated teardrops centred by `inset`, so the visible shape sat off the true point.
  Fix: **reset `.leaflet-div-icon` to transparent** + **circular pins centred via
  `left/top:50% + translate(-50%,-50%)`** (canonical Leaflet centre-anchor) with `iconAnchor` =
  half of `iconSize`. The in-transit truck now sits **exactly on the route line**; source/dest
  markers sit **exactly on their hubs** (verified numerically: truck === route waypoint, route
  ends === hub coords to 5dp; `route.ts` rounds to match `seed.js`).
- Truck marker enlarged (26px) and pinned **on top** (`zIndexOffset`).
- Route is now a **3-layer line**: dark casing (contrast over any tiles) + a **bright orange,
  thick, fast-flowing animated** dashes (where it's *going*) + a grey dashed **trail** on top
  (where it's *been*) — motion is unmistakable. Applied to admin + driver maps;
  `prefers-reduced-motion` disables the flow.

**Rev 13 — identifiable source/destination markers:**
- Deliveries now show **big teardrop endpoint markers**: a teal **PICKUP** pin (load) at the
  source and a **product-coloured DROPOFF** pin (fuel-drop icon; diesel/petrol/premium colour) at
  the destination — each with an info label (**hub name + quantity + product**). Applied on both
  the admin fleet map and the driver map, so which end is load vs deliver is unmistakable.
- Generic hubs stay as small context markers underneath. (User: straight lines are fine.)

**Rev 12 — movement trail + curved route (both maps):**
- Vehicles now leave a **breadcrumb trail** (solid grey line of where they've been) —
  `vehiclePosition.trail`, appended on each GPS update; the seeded in-transit truck ships with a
  trail so the admin map shows a track on load.
- Routes are **curved pseudo-routes** (`services/route.ts`, deterministic Bézier) instead of a
  dead-straight line; the **GPS simulation follows the curve** (`nextAlongRoute`) and the heading
  arrow points along it. Honest offline choice — real road geometry would need a routing API
  (ADR-25 documents the seam to swap in OSRM/Mapbox if wanted).
- Tests: +5 (`routePath`, `nextAlongRoute`) → **60 total**.

**Rev 11 — clearer map: motion, direction & cargo (both personas):**
- Moving trucks now read as moving: a **heading arrow** (bearing → destination) on in-transit
  markers + an **animated "flowing" route line**; **cargo (product + quantity)** shown in the
  marker tooltip, popup, and vehicle list; popup adds remaining **km + ETA**.
- **Driver map navigation card**: floating "Next stop" panel — destination, product + litres,
  distance remaining, ETA — plus a heading-aware own-vehicle marker and labeled destination
  markers, so the map is usable for navigation.
- Seed now includes a truck **already in transit** (Sam Okoye / TRK-141, hub-1→Airport, 3,000 L
  diesel, mid-route) + a `sam@fleetpanda.com` login, so both maps show live motion on first load.
- Tests: +2 (`bearing`) → **55 total**.

**Rev 10 — temporal validity (no past-dated planning):**
- You **can't create an order or allocate a vehicle for a past date** — history is seeded &
  read-only; only **today or future** is valid. Enforced at three layers: **Zod** (`notPast`
  refine on `deliveryDate`/`date`), the **UI** (date inputs `min={today()}`, allocation calendar
  **disables past days**, submit blocked with an inline reason), and the **server** (`POST
  /allocations` returns **422** for a past date). Tests: +4 schema tests → **53 total**.

**Rev 9 — driver route run-sheet:**
- Driver shift is now a **run sheet**: deliveries **sequenced into a route** from the truck's
  live position (`sequenceOrders`, nearest-first), each shown as **Load @ source → Deliver @
  destination · qty · ~km**, numbered, with the **next stop highlighted**; the card shows the
  **truck**, **start/pickup hub** (+ deadhead km), and route distance/time/**ETA**. (§5.6)
- **Admin tune:** the assign-driver dropdown now shows driver **availability** (`· on shift` /
  `· available`) so a busy driver isn't handed a fresh same-day run.
- Tests: +2 logistics (`sequenceOrders`) → **49 total**.

**Rev 8 — live-location planning + Fleet Map UX:**
- **Fixed count mismatch**: dashboard readiness tiles are *today-scoped*, so their deep-link now
  carries `&date=` and the Orders list filters to that day — the number shown == the number
  clicked. Clearable chip shows the date.
- **Live-location aware planning**: `driverDayPlan` accepts the vehicle's current position and
  folds a **deadhead** (current → first pickup) into the shift time; surfaced in Allocation
  ("incl. X km to reach the first pickup") and the driver shift ETA.
- **Fleet Map overhaul**: labeled, status-coloured **truck markers** (registration on the pin);
  **hub/terminal context markers**; **route lines** from in-transit vehicles to their
  destination; **list ↔ map selection sync** (click a row → highlight + fly-to marker, and
  vice-versa); richer popups with **remaining distance + ETA**. Marker CSS refreshed.
- Tests: +1 logistics (deadhead) → **47 total**.

**Rev 7 — realistic logistics + live dates + richer seed:**
- **`services/logistics.ts`** — distance, per-order journey time, driver-day shift feasibility
  (8h), tanker utilisation (35%). Driver-day advisories kept *out* of `orderReadiness`. (§5.0b-ii)
- **Allocation is fully feasibility-aware**: hard-block capacity + **maintenance + already-booked
  vehicles disabled**; **warn** on overbooked shift-time, under-utilisation, and stock. (§5.3)
- **Dashboard "Shift advisories"** strip (overbooked / under-utilised) + **`?readiness=` tile
  deep-links now actually filter** the Orders list (with a clearable chip) — fixes the reported
  "tiles don't filter" bug.
- **Driver shift card** shows route km + estimated driving time + ETA.
- **Live dates**: clock defaults to the real local day; **`seed.js` rewritten** to generate
  data relative to *today* and to deliberately demonstrate every state (7 hubs, 8 vehicles incl.
  one in maintenance, 18 orders → Ready ×7, Needs driver, Needs vehicle, Blocked-capacity,
  Blocked-stock, + Overbooked & Under-utilised advisories).
- Tests: +7 logistics unit tests → **46 total**.

**Rev 6 — dispatch-readiness engine + action-center dashboard:**
- **`orderReadiness()`** single classifier (needs_driver → needs_vehicle → blocked_capacity →
  blocked_stock → ready → in_transit → done) + `useDispatchReadiness`/`useReadinessResolver`.
  (§5.0b)
- **Dashboard rebuilt as an action center** — readiness summary + "what needs you" ranked list
  with deep-link CTAs that pre-load the fix. (§5.0c)
- **Orders** gets a Readiness column + `?status=` deep-link; **assignment reframed** (no more
  "no vehicle" error toast — it's a readiness state now). (§5.2)
- **Allocation is order-aware**: shows the driver's day load, **hard-blocks undersized
  vehicles** (capacity), **warns on stock** (non-blocking). Fixes the order→allocate sequencing
  bug the PM review flagged. (§5.3)
- Replaced `assignmentIssues` with the readiness engine. Tests: −4 +8 → **39 total**.

**Rev 5 — operational-validation UX (order placement & driver assignment):**
- Order form shows **live source-hub stock** for the selected product and warns when the
  quantity exceeds it. (§5.2, `orderStockCheck`)
- Driver assignment surfaces realistic problems — no vehicle allocated for the date, driver
  already on shift, **vehicle capacity overloaded** — as toasts + dropdown annotations.
  (§5.2, `assignmentIssues`)
- Master Data lists gained **attribute filters** (driver/vehicle status) alongside search.
  (§5.1)
- Tests: +6 unit tests for the new rules (35 total). Docs kept in sync per standing policy.

**Rev 4 — joint UI/UX + technical architect validation (closed UI↔tech seams):**
- **`Product.tankCapacity`** added so the fuel-gauge motif has a real full-scale. (§3.1, §5.5)
- **Single `stockLevel()` rule** (`crit < threshold`, `warn < 1.5×threshold`, else `ok`) shared
  by gauge/badge/row. (§3.1, §5.5)
- **Fonts via `@fontsource`** (not data-URI, which was artifact-only guidance); added
  **lucide-react** icons + a `src/styles/` token home. (§2, §4)
- **Vehicle map-status derivation** (`vehicleStatus()`) so tooltip + filter agree. (§5.4)
- Marker **tween-on-poll**, **success-toast fires from server response**, and **theme defaults
  to `prefers-color-scheme`** — see `docs/IMPLEMENTATION.md` & `docs/UI_UX.md`.

**Rev 3 also adds `docs/UI_UX.md` (creative design-lead pass):** stated concept ("Dispatcher's
Console" vs "Driver's Cab"); palette revised so **amber is semantic-only** and CTAs use petrol
teal; subject-grounded type (**Barlow Semi Condensed + IBM Plex Sans/Mono**); full dark+light
token tables; key-screen layouts; rationed motion; state & a11y specs. (§6 → `docs/UI_UX.md`)

**Rev 3 — technical implementation review applied (new `docs/IMPLEMENTATION.md`):**
- **Single-writer contract** for side-effects (custom `server.js` routes own inventory;
  client only validates) — removes a latent double-decrement bug. (§3.3, ADR-17)
- **Idempotent transitions + non-negative inventory** guards (409/422). (§3.3, ADR-18)
- **Query defaults / key factory / optimistic `cancelQueries` recipe** specified. (ADR-19)
- **Leaflet+Vite hardening** (divIcon markers, CSS, height, memo, test-mock). (ADR-20)
- Added: injectable **clock/date util**, **error-routing** split (boundary vs query),
  **guard redirect matrix**, **code-splitting**, **seed integrity**, tooling baseline.

**Rev 2 — senior PM + architect review applied:**
- **Inventory flow corrected:** source hub decrements on dispatch, **destination increments
  on delivery** (was decrementing destination — backwards). (§3.3, §5.6, §5.8)
- **Product keying unified** to `Product.key` string, matching the brief's sample
  (`inventory: {diesel,...}`, `order.product: "diesel"`) — kills the `productId` mismatch. (§3.1)
- **Removed redundant `Delivery` entity** — a delivery is an `Order` in a shift; lifecycle
  carried by order status + `failureReason`/`completedAt`. (§3.1)
- **Fixed dual-source-of-truth:** Redux holds `activeShiftId` only; shift row stays server-
  owned. Added explicit single-ownership rule. (§2.1)
- **Auth persistence → `sessionStorage`** (per-tab) so the two-tab Admin+Driver real-time
  demo works; added **PersistGate** rehydration gate for deep-link refresh. (§2.2)
- **AuthContext reframed honestly** as an ergonomic seam, not a necessity. (§2.2)
- **MoSCoW cut line** added to protect the core map within 2–3 days; coverage right-sized. (§9.1)
- **Error simulation defaults OFF** so the live map demo never flickers. (§7)
- **Deployment caveats** made honest; video is the primary deliverable. (§10)
- Smaller: Terminals surfaced as distinct nav; capacity-vs-quantity check; map a11y list
  fallback; straight-line route note; CRUD uses shared primitives (not a generic engine). (§5)

---

*Next step: on approval of this plan, proceed to Phase 0 (scaffold + auth) and build
phase-by-phase.*
