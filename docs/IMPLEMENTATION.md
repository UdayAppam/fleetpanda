# IMPLEMENTATION.md — Technical Implementation Approach

> Companion to `PLAN.md`, `STATE_MANAGEMENT.md`, `DECISIONS.md`. Captures the concrete,
> code-level decisions that keep the build correct and fast — the traps we've decided how to
> handle **before** writing them. Every rule here has a reason.

---

## 1. Side-effect ownership — the server is the single writer

**Problem:** if both the mock server *and* a client service apply inventory maths, every
delivery changes stock **twice**.

**Rule:** all **transactional / multi-resource** mutations are owned by **custom Express
routes in `server.js`** (which mutate the lowdb store atomically). The client **never**
writes inventory directly.

### Custom endpoints (the only writers of side-effects)

| Endpoint | Does (atomically) | Guards |
|---|---|---|
| `POST /allocations` | Create allocation | **409** if `(vehicleId, date)` already exists |
| `POST /shifts/:id/start` | Shift → `active`; its orders `assigned → in_transit`; **source hub −quantity** | **422** if any source stock < quantity; **409** if shift already active |
| `POST /orders/:id/complete` | Order → `delivered` + `completedAt`; **destination hub +quantity** | **409** if not `in_transit` |
| `POST /orders/:id/fail` | Order → `failed` + `failureReason` | requires reason; **409** if already terminal |
| `POST /shifts/:id/end` | Shift → `ended`; vehicle & driver → `available` | **409** if not `active` |

Plain json-server REST (`GET/POST/PATCH/DELETE`) stays for **non-transactional** CRUD
(hubs, products, drivers, vehicles, order create/assign, vehicle positions).

**Client's role:** the `services/` layer is **validation & derivation only** — compute
allocation conflicts to disable the submit button, compute "can start shift", derive
low-stock levels. It never applies the authoritative maths; it calls the endpoints above
and invalidates the affected queries. Single writer ⇒ no double-apply.

---

## 2. Idempotent state transitions

Side-effects are keyed on the **status transition**, not on a button press, so a retry or a
double-click can't double-apply:

- Source decrement fires **only** on `assigned → in_transit`. If an order is already
  `in_transit`, the start endpoint rejects it (no second decrement).
- Destination increment fires **only** on `in_transit → delivered`.
- Every custom route re-reads current status from the store and refuses illegal transitions
  with `409`. **The transition is the idempotency key.**

---

## 3. Inventory can never go negative

- **Server:** `POST /shifts/:id/start` returns **422** with the offending order(s) if any
  `quantity > source.inventory[product]`.
- **Client:** pre-checks the same rule and **disables Start Shift** with an explicit tooltip
  ("Hub X has 3,000 L diesel, order needs 5,000 L"). Same rule, enforced both sides — server
  is authority, client is UX.

---

## 4. TanStack Query configuration

### 4.1 Client defaults (`app/queryClient.ts`)
```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,          // master data rarely changes; avoid chatty refetch
      refetchOnWindowFocus: false, // critical: stops surprise refetches during the 2-tab demo
      retry: 1,
    },
  },
});
```
`refetchInterval: 30_000` is applied **only** to the `['vehiclePositions']` query — not
globally — so the auto-refresh is scoped to the live map (R13).

### 4.2 Query-key factory (`hooks/queries/keys.ts`)
Centralize keys so invalidation is typo-proof and refactors are safe:
```ts
export const qk = {
  hubs:   { all: ['hubs'] as const, detail: (id: string) => ['hubs', id] as const },
  orders: { all: ['orders'] as const, list: (f: OrderFilters) => ['orders', f] as const },
  positions: ['vehiclePositions'] as const,
  shift:  (id: string) => ['shift', id] as const,
  // ...
};
```

### 4.3 Canonical optimistic-update recipe
Used for delivery complete/fail and master-data edits. The `cancelQueries` step is
**mandatory** — without it a background poll overwrites the optimistic value.
```ts
useMutation({
  mutationFn,
  onMutate: async (vars) => {
    await queryClient.cancelQueries({ queryKey });
    const snapshot = queryClient.getQueryData(queryKey);
    queryClient.setQueryData(queryKey, optimistic(snapshot, vars));
    return { snapshot };
  },
  onError: (_e, _vars, ctx) => queryClient.setQueryData(queryKey, ctx.snapshot),
  onSettled: () => queryClient.invalidateQueries({ queryKey }),
});
```

**Toast truth rule:** the *row* updates optimistically, but any toast that states a concrete
outcome (e.g. "Downtown +5,000 L diesel") is fired **`onSuccess` from the server response**,
never optimistically — so a `409`/`422` can't produce a false success message.

---

## 5. Error routing — boundaries vs. query errors

Error boundaries **do not** catch async errors from fetches. Split responsibilities:

| Error kind | Handled by |
|---|---|
| Render/runtime crash in a component tree | `ErrorBoundary` (app-level + per-feature) → fallback + retry |
| Query/mutation network error | In-component **`isError`** UI (message + Retry), or opt a query into `throwOnError` wrapped in **`QueryErrorResetBoundary`** for a boundary-level retry |
| Validation error (Zod/RHF) | Inline field error + summary, never a boundary |
| Business rule (409/422 from server) | Toast + inline message on the triggering control |

---

## 6. Leaflet + Vite — known traps & the chosen fixes

Concrete gotchas that otherwise cost hours:

1. **Import CSS:** `import 'leaflet/dist/leaflet.css'` once at the map module.
2. **Broken default marker icons under bundlers:** we use **custom `L.divIcon` markers**
   anyway (branded pin + pulse), which sidesteps the missing-image bug entirely. (Fallback:
   `L.Icon.Default.mergeOptions` with imported icon URLs.)
3. **Zero-height container:** `MapView` sets an explicit height (CSS `min-height`), or the
   tile layer renders 0px.
4. **Performance under polling:** `VehicleMarker` is `React.memo`'d and keyed by
   `vehicleId`, and we update marker position via props — the map layer set is not torn down
   and rebuilt every 30s. Position changes **tween `marker.setLatLng` over ~400ms** so the
   move reads as a glide (GPS steps are small); the tween is disabled under
   `prefers-reduced-motion`.
5. **Testing:** jsdom can't render Leaflet → **mock `react-leaflet`** in component tests and
   assert against the `VehicleListPanel` (the accessible mirror) for map behavior.

---

## 7. Time & dates — one injectable clock

- A single `utils/clock.ts` exposes `now()` and `today()` (returns **date-only
  `YYYY-MM-DD`**). Everything ("today's shift", allocation date, `deliveryDate`) imports it.
- **Date-only fields are strings** (`YYYY-MM-DD`) to avoid timezone off-by-one; timestamps
  (`startedAt`, `completedAt`, `updatedAt`) are full ISO.
- `today()` is **mockable in tests**, so "today's shift"/allocation logic is deterministic.
- An optional `VITE_DEMO_DATE` pins the app's "today" to the seed date so a fresh clone
  always shows an active shift ready to start.

---

## 8. GPS simulation — a pure, testable stepper

- Per the brief, movement is triggered by the manual **"Send GPS Update"** button.
- The movement itself is a **pure function** `stepToward(pos, dest, stepKm): LatLng` in
  `utils/geo.ts` — unit-tested, no side-effects.
- Optional: a driver-side interval that calls the stepper for a hands-free demo; off by
  default so the manual flow (and tests) stay deterministic.

---

## 9. Auth guard redirect matrix

| Situation | Result |
|---|---|
| Unauthenticated → any guarded route | Redirect `/login`, preserve `from` (return after login) |
| Authenticated, wrong role (driver → `/admin/*`) | Redirect to **their** home (`/driver`), not `/login` |
| Authenticated → `/login` | Redirect to their role home |
| Post-login | Go to `from` if present, else role home |

Guards read auth via `useAuth()`; they render **nothing** until `authStatus === 'ready'`
(PersistGate), preventing a rehydration flash.

---

## 10. Performance — code-splitting

- `React.lazy` + `Suspense` split the **`/admin/*`** and **`/driver/*`** route trees and the
  **Leaflet map chunk** — a driver on mobile never downloads admin code, and the heavy map
  bundle loads only on map routes.
- Suspense fallbacks reuse the `Skeleton` components for a consistent loading language.

---

## 11. Seed data integrity (`seed.js` → `db.json`)

- **String ids matching the brief** (`"hub-1"`, `"driver-1"`).
- **Referential integrity:** every `assignedDriverId`, `sourceId`, `destinationId`,
  `vehicleId` resolves to a real row.
- **A ready-to-demo "today":** at least one allocation + assigned orders dated `today()` so
  **Start Shift works on first load**; some hubs seeded near/below `lowStockThreshold` to show
  alerts; vehicle positions seeded near source hubs so the map is populated immediately.
- `seed.js` regenerates `db.json` deterministically (`npm run seed`) so the demo state is
  reproducible.

---

## 12. Tooling baseline

- **ESLint + Prettier + `tsc --noEmit`** wired as `npm run lint` / `typecheck`; run in CI-style
  before commit (a senior-hygiene signal, cheap to add).
- Scripts: `dev` (Vite), `mock` (json-server via `server.js`), `dev:all` (concurrently),
  `seed`, `test`, `test:coverage`, `build`, `preview`.
