# STATE_MANAGEMENT.md — How Application State Is Managed

> Companion to `PLAN.md`. Explains **what state exists, which layer owns it, and why** —
> the single most-evaluated architectural decision in this assignment.

---

## 1. The core idea: three layers, one owner per piece of state

Most React state bugs come from **one piece of state living in two places**. We prevent
that by classifying every piece of state by its *nature*, then giving each nature exactly
one home.

```
┌──────────────────────────────────────────────────────────────────┐
│  SERVER STATE            →  TanStack Query                        │
│  Data that lives in db.json and is owned by the "backend".        │
│  hubs, terminals, products, drivers, vehicles, orders,            │
│  allocations, shifts, vehiclePositions, users.                    │
├──────────────────────────────────────────────────────────────────┤
│  GLOBAL CLIENT STATE     →  Redux Toolkit                         │
│  App-wide state the client owns, read/written across routes.      │
│  auth {user, role, token}, activeShiftId, mapFilters, uiPrefs.    │
├──────────────────────────────────────────────────────────────────┤
│  CROSS-CUTTING UI STATE  →  Context API                           │
│  Provider-shaped UI services.                                     │
│  theme, toasts, confirm dialogs, auth façade (useAuth).           │
├──────────────────────────────────────────────────────────────────┤
│  LOCAL STATE             →  useState / useReducer                 │
│  Ephemeral, single-component. Input text, open/closed, hover.     │
└──────────────────────────────────────────────────────────────────┘
```

**Decision rule (used for every new piece of state):**
1. Does it come from / persist to the API? → **TanStack Query**.
2. Is it client-owned and needed by many routes/components? → **Redux**.
3. Is it a UI service consumed via a provider? → **Context**.
4. Otherwise → **local `useState`**.

---

## 2. Why not just one tool?

The brief names **Redux and Context**; the stack also uses **TanStack Query**. Rather than
force everything into one, each tool is used **for what it is best at**. This is a feature,
not indecision — it demonstrates understanding of the *kinds* of state.

| Tempting shortcut | Why we reject it |
|---|---|
| Put server data in Redux | Reimplements caching, dedupe, background refetch, loading/error flags, and the 30s poll by hand — the exact boilerplate TanStack Query removes. Server data is **async, cached, and shared**, not "app state." |
| Put everything in Context | Every context update re-renders all consumers; no DevTools, no middleware, awkward to unit-test. Fine for stable UI services, wrong for frequently-changing app state. |
| Put UI services in Redux | Theme/toasts/confirm are provider-shaped and rarely change; a slice + actions is ceremony with no payoff. |

---

## 3. Layer 1 — Server state with TanStack Query

**Owns:** everything in `db.json`.

**Why TanStack Query:**
- **Caching + dedupe:** many components read `useDrivers()`; Query serves them from one
  cache entry with one network call.
- **Loading/error for free:** `isPending` / `isError` drive skeletons and error UI — a
  direct brief criterion ("handling of async operations and loading states").
- **The 30s auto-refresh is one line:** `useQuery({ queryKey: ['vehiclePositions'],
  refetchInterval: 30_000 })`. Manual refresh = `refetch()`. (Live Fleet Map, R13.)
- **Mutations + cache invalidation:** create/edit/delete call the API then
  `queryClient.invalidateQueries` so lists refresh automatically.
- **Optimistic updates** (delivery complete, master-data edits): update cache immediately,
  roll back `onError` — snappy UX with correctness.

**Query key conventions**
```
['hubs'] ['hubs', id]
['orders', { status }]            // filters are part of the key → cache per filter
['allocations', { month }]
['vehiclePositions']              // polled every 30s
['shift', activeShiftId]          // the ACTIVE shift row is fetched, not copied to Redux
```

**Cross-persona real-time:** the Driver `PATCH`es `vehiclePositions`; the Admin map's
polling query re-reads the shared json-server and shows the new position — no websockets
needed. This is why vehicle positions are **server state, not Redux** (see §6).

---

## 4. Layer 2 — Global client state with Redux Toolkit

**Owns four slices. None of them duplicates a server row.**

| Slice | Shape | Why Redux |
|---|---|---|
| `auth` | `{ user, role, token, status }` | Read by route guards, topbar, driver-data scoping — truly app-wide. Pure reducers are **trivially unit-testable** (testing-quality criterion). Persisted (see §7). |
| `shift` | `{ activeShiftId }` | The *fact of* an active shift is client session state; the **shift row itself is fetched via `useShift(activeShiftId)`**. Storing only the id is what enforces single-ownership. |
| `mapFilters` | `{ driverId?, vehicleId?, status?, autoRefresh }` | Filter selections are client-only, shared between the map and its list panel, and must survive tab-internal navigation. |
| `uiPrefs` | `{ sidebarCollapsed, tableDensity }` | Small cross-route UI preferences. |

**Why Redux Toolkit specifically:** slices remove boilerplate, Immer allows straightforward
reducers, Redux DevTools makes state transitions inspectable during the demo, and
middleware gives us clean persistence. Selectors (`selectRole`, `selectMapFilters`)
centralize reads so components don't reach into state shape.

---

## 5. Layer 3 — Cross-cutting UI with Context API

**Owns provider-shaped UI services** that are global but change rarely or imperatively:

| Context | API | Why Context (not Redux) |
|---|---|---|
| `ThemeContext` | `{ theme, toggle }` | Flips `data-theme`; stable, no middleware needed |
| `ToastContext` | `toast.success/error/info()` | Imperative fire-and-forget bus + a11y live region; a slice would be ceremony |
| `ConfirmContext` | `await confirm(opts)` | Promise-based dialogs for destructive actions; naturally a provider |
| `AuthContext` | `useAuth() → { user, role, login, logout }` | **Thin façade over `authSlice`** (see §8) |

---

## 6. The single-ownership rule (the anti-bug guarantee)

> **Any entity that exists in `db.json` is owned only by TanStack Query. Redux stores
> references (ids) or pure client concerns — never a copy of a server row.**

Two decisions this rule forced (and corrected during review):

- **Active shift:** Redux holds `activeShiftId` only; the row is fetched. *Reason:* if Redux
  cached the shift row, a mutation (complete a delivery) would update the Query cache but
  leave a stale copy in Redux → the two views disagree.
- **Vehicle positions:** kept in Query, **not** mirrored to Redux. *Reason:* they must be
  shared across the Admin and Driver tabs via the server; a client copy can't sync across
  tabs and would defeat the real-time demo.

---

## 7. Persistence & the two-tab demo

- **Auth persists to `sessionStorage`, not `localStorage`.** The headline demo runs **Admin
  in one tab and Driver in another** against the shared json-server. `localStorage` is shared
  across tabs, so the second login would overwrite the first; **`sessionStorage` is per-tab**,
  so each tab keeps its own persona. It still survives reload.
- **`PersistGate`** delays rendering until persisted auth rehydrates, so a hard-refreshed
  deep link (`/admin/orders`) doesn't momentarily read "logged out" and bounce to `/login`.
- **Server data is *not* persisted client-side** — it lives in json-server (which persists
  `db.json` for the session), so a refresh simply re-fetches the source of truth.

---

## 8. Why `AuthContext` wraps `authSlice` (honest reasoning)

`authSlice` is the **owner** (state + reducers + persistence + tests). `AuthContext`/
`useAuth()` is a **thin read/action façade** over it.

- **Benefit:** components and route guards depend on `useAuth()`, not on the store's shape or
  the state library — a **single seam** to swap the mock login for a real auth API later
  with zero component edits.
- **Honest caveat:** this is an *ergonomic* choice, not a technical necessity — typed Redux
  hooks (`useAppSelector`) would also work. We keep it because it (a) satisfies the brief's
  interest in seeing Context used deliberately and (b) genuinely decouples consumers from the
  state library. It adds one thin layer, not real complexity.

---

## 9. Data-flow examples (state in motion)

**Admin creates an order (mutation + invalidation):**
```
OrderForm → useCreateOrder() [mutation] → POST /orders
  → onSuccess: invalidate ['orders'] → OrdersTable refetches → toast.success()
```

**Driver completes a delivery (optimistic + side effect + cross-layer):**
```
CompleteAction → useCompleteDelivery()
  → optimistic: order.status = 'delivered' in Query cache (UI updates instantly)
  → PATCH /orders/:id  +  PATCH destination hub inventory (+quantity)
  → onError: rollback cache + toast.error()
  → onSuccess: invalidate ['orders'], ['hubs'] → Admin inventory reflects new stock
```

**Real-time position (server as the sync bus):**
```
Tab B (Driver): SendGpsButton → PATCH /vehiclePositions/:id
Tab A (Admin): useQuery(['vehiclePositions'], refetchInterval:30s) → marker moves
```

**Filtering the map (pure client state):**
```
MapFilters → dispatch(setMapFilter) → Redux mapFilters
  → FleetMap + VehicleListPanel both select mapFilters → filtered render (no refetch)
```

---

## 10. Testing the state layers

| Layer | How it's tested |
|---|---|
| Redux slices/selectors | Pure unit tests: dispatch action → assert next state |
| Query hooks / mutations | Integration tests with **MSW** mocking the endpoints |
| Context services | Component tests: render a consumer, assert toast/confirm/theme behavior |
| Critical flows | End-to-end-ish RTL tests: allocation conflict, delivery→inventory, shift lifecycle, auth guard redirect |

**Reasoning:** because each layer has a single clear responsibility, each is testable in
isolation — pure reducers need no mocks, Query hooks mock only the network, and UI services
are behavior-tested. This is what makes the "testing quality" criterion achievable within
the time budget.
