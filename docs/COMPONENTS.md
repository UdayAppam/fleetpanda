# COMPONENTS.md — Component Hierarchy & Responsibilities

> Companion to `PLAN.md`. Describes the component tree, the layering rules that keep it
> maintainable, and each component's single responsibility **with the reasoning** for why
> it exists where it does.

---

## 1. Layering model (the one rule that governs everything)

Components are sorted into **three tiers by how much they know about the domain**. This is
the backbone of reusability and testability.

| Tier | Folder | Knows about… | May call… | Example |
|---|---|---|---|---|
| **UI / primitives** | `components/ui` | Nothing domain-specific. Pure props in, events out. | — | `Button`, `Table`, `Modal`, `Badge` |
| **Composite / shared** | `components/{layout,forms,map}` | App shell & generic patterns, not entities. | UI tier | `AppShell`, `FormDrawer`, `MapView` |
| **Feature (smart)** | `features/*` | The domain (orders, shifts, inventory). | Hooks, store, services | `OrdersTable`, `AllocationCalendar` |
| **Pages** | `pages/*` | Route composition only. Thin. | Feature components | `OrdersPage`, `DriverShiftPage` |

**Reasoning:** dependencies point **downward only** (pages → features → composite → ui).
A UI primitive never imports a hook or the store, so it is trivially reusable and unit-
testable in isolation. All data-fetching and business logic lives in the **feature tier**,
keeping primitives dumb and pages declarative. This directly serves the brief's
"component architecture and reusability" and "code organization" criteria.

**Smart vs. presentational split:** feature folders separate a *container* (does the
`useQuery`/`useMutation`, wiring) from *presentational* children (receive data via props).
Presentational children are the ones we snapshot/component-test; containers are covered by
integration tests with MSW.

---

## 2. Top-level tree

```
<AppProviders>                         // main.tsx — all context/providers, one place
 ├─ QueryClientProvider                // TanStack Query
 ├─ ReduxProvider + PersistGate        // store + sessionStorage rehydration gate
 ├─ ThemeProvider                      // light/dark tokens
 ├─ ToastProvider                      // notification bus
 ├─ ConfirmProvider                    // promise-based confirm dialogs
 └─ AuthProvider                       // useAuth() façade over authSlice
      └─ RouterProvider
           ├─ /login  → <LoginPage>                       (public)
           ├─ /admin/* → <ProtectedRoute><RoleRoute role="admin">
           │              └─ <AppShell variant="admin">   (guarded)
           │                   └─ <Outlet/> → admin pages
           └─ /driver/* → <ProtectedRoute><RoleRoute role="driver">
                          └─ <AppShell variant="driver">  (guarded)
                               └─ <Outlet/> → driver pages
```

**Reasoning for provider order:** Query and Redux are the data foundations, so they wrap
everything. `PersistGate` sits directly under Redux so **no child renders until persisted
auth has rehydrated** — this is what stops a hard-refreshed deep link from flashing to
`/login`. `AuthProvider` is above the router because the **route guards depend on it**.
Theme/Toast/Confirm are cross-cutting UI services every route may use, so they live at the
root too.

---

## 3. Shared building blocks (`components/`)

### 3.1 `components/ui` — primitives (zero domain knowledge)

| Component | Responsibility | Why it's a primitive |
|---|---|---|
| `Button` | Variants (primary/ghost/danger), loading + disabled states | Every action uses it; loading state standardizes async feedback |
| `Input`, `Select`, `Textarea`, `DatePicker` | Controlled field UIs + error slot | Reused by every form; a11y (label/aria) handled once |
| `Modal` / `Drawer` | Focus-trapped overlay, ESC/overlay close | Centralizes focus management & keyboard a11y so features don't re-solve it |
| `Table` | Headers, row render via `columns` config, empty/loading/error slots, **client-side pagination** (page size configurable) | Master data + orders + inventory all use it → paginated + consistent from one place |
| `Badge` | Status pill = **icon + color + label** | Status is everywhere; icon+label means we never rely on color alone (a11y) |
| `Card` | Surface container with elevation tokens | Shift view, dashboards, list items |
| `Spinner`, `Skeleton` | Loading affordances | Consistent loading language across the app |
| `EmptyState` | Illustration + message + optional CTA | Turns "no data" into guidance (panda microcopy) |
| `Toast` | Single notification (auto-dismiss, `role="status"`) | Rendered by `ToastProvider`; a11y live-region built in |
| `FuelGauge` | Inline SVG bar/radial for a stock level | On-brand inventory viz without a chart dependency |

**Reasoning:** these are the vocabulary of the UI. Building them once guarantees visual
consistency (a brief criterion) and means a design tweak (e.g. radius token) propagates
everywhere. None import hooks/store, so each has a fast, dependency-free component test.

### 3.2 `components/layout`

| Component | Responsibility |
|---|---|
| `AppShell` | Frame: sidebar/topbar + `<Outlet/>`. `variant` switches Admin vs Driver chrome |
| `Sidebar` / `BottomNav` | Primary nav; collapses to a bottom bar/drawer on mobile |
| `Topbar` | Page title, theme toggle, `UserMenu` |
| `UserMenu` | Logged-in identity + role + **logout** |
| `ErrorBoundary` | App-level + per-feature fallback with retry |

**Reasoning:** the two personas need different navigation but the *same* frame mechanics.
One `AppShell` parameterized by `variant` avoids duplicating layout logic while keeping
each persona's IA distinct.

### 3.3 `components/forms`

| Component | Responsibility |
|---|---|
| `FormDrawer` | Drawer shell for create/edit: header, body slot, footer actions, dirty-guard |
| `FormField` | Label + control + inline error + description, wired to React Hook Form |
| `FormError` | Renders a Zod/RHF field error accessibly (`aria-describedby`) |

**Reasoning:** every master-data and order form is "fields + validation + submit." These
shells encode that pattern **once** (including a11y error wiring), so each entity form is
just *its schema + its fields* — reuse without a heavy generic-CRUD abstraction.

### 3.4 `components/map`

| Component | Responsibility |
|---|---|
| `MapView` | Leaflet container, tiles, sane default viewport/bounds |
| `MapController` | `useMap()` helper that `flyTo`s the selected vehicle |
| `colors` + `CircleMarker`s (in the map pages) | Anchor-free SVG dots (exact placement): truck (status colour, painted last, on the line), **PICKUP** (teal) + **DROPOFF** (product colour) endpoint dots, hub context dots; labels via tooltips (🚚/📦/⛽). Replaced the old divIcon `markers.ts` (ADR-26) |
| `RouteLine` | Dashed polyline vehicle→destination (fleet map) / source→destination (driver) |
| `VehicleListPanel` | **Accessible, keyboard-focusable list mirroring the markers, synced selection** |

**Reasoning:** map concerns are isolated so both the Admin fleet map and the Driver map
**reuse the same marker/tooltip code** with different data. `VehicleListPanel` is the
keyboard/screen-reader-accessible equivalent of the map (maps are inherently poor for a11y)
and doubles as the filtered results view.

---

## 4. Feature modules (`features/*`) — responsibilities

Each feature owns its container(s), presentational children, local types, and its slice of
query/mutation hooks. Mapped to the requirement IDs from `PLAN.md §1.1`.

| Feature | Key components | Responsibility | Reqs |
|---|---|---|---|
| `auth` | `LoginForm`, `useLogin`, `ProtectedRoute`, `RoleRoute` | Mock login, session, route/role gating | — |
| `dispatch` | `useDispatchReadiness`, `useReadinessResolver`, `useShiftAdvisories`, `ReadinessPill`, `readinessGroup`, `ctaFor` | **Readiness classifier** (per-order) + **shift advisories** (driver-day overbooked/under-utilised) consumed by Dashboard + Orders + Allocation; deep-link CTAs + `?readiness=` group filter | — |
| `master-data` | `EntityListView`, `HubForm`, `TerminalForm`, `ProductForm`, `DriverForm`, `VehicleForm` | CRUD + search/filter + validation; Hubs & Terminals share the entity but show as separate lists | R1–R3 |
| `orders` | `OrderForm` (create **+ edit**), `useOrderMutations` (create/assign/update/remove), status tabs | Create/assign/view/**edit/delete** orders (edit locked after dispatch); live source-stock check; Readiness column + `?status=`/`?readiness=` deep-links | R4–R6 |
| `allocation` | `AllocationCalendar`, `AllocateVehicleForm`, `ConflictBanner` | Allocate vehicles per date, **double-booking guard**, capacity check | R7–R9 |
| `fleet-map` | `FleetMap`, `MapFilters`, `RefreshControl`, `VehicleListPanel` | Live vehicle positions, filters, 30s auto-refresh + manual | R10–R13 |
| `inventory` | `InventoryTable`, `StockCell`, `StockLevelFilter` | Stock per hub×product, **low-stock coloring**, search/filter | R14–R16 |
| `driver-shift` | `ShiftCard`, `StartShiftButton`, `EndShiftButton`, `DeliveryList` (run-sheet) | Today's shift: truck + start/pickup + route distance/ETA; start (→dispatch/source decrement)/end; **sequenced run-sheet with pickup→dropoff per stop** | R17–R19, R24 |
| `driver-map` | `DriverMap`, `SendGpsButton` | Driver location, destination markers, GPS ping | R20–R21 |
| `deliveries` | `DeliveryManager` (delivery cards + fail-reason modal) | Delivery-management portal: per-delivery source→destination (with hub types), product/qty, status, **Mark delivered** (→destination increment) / **Report failure** (reason modal) | R22–R23 |
| `shift-history` | `ShiftHistoryList`, `ShiftHistoryRow` | Past shifts + completed/failed counts | R25 |

**Reasoning for feature-folder structure (vs. type-folder):** co-locating a feature's
component + hooks + types means a change to "orders" touches **one folder**, not five
scattered ones. It also makes each feature independently understandable and testable — and
maps 1:1 to this table, so the doc stays in sync with the code.

---

## 5. Pages (`pages/*`) — thin compositions

Pages only **compose feature components and set layout**; they contain no business logic.

```
pages/
 ├─ LoginPage
 ├─ admin/  DashboardPage · MasterDataPage · OrdersPage · AllocationPage
 │          · FleetMapPage · InventoryPage
 └─ driver/ ShiftPage · DriverMapPage · ShiftHistoryPage
```

**Reasoning:** keeping pages thin means routing/layout can change without touching feature
logic, and features can be reused across pages (e.g. a mini fleet-map widget on the admin
dashboard reuses `<FleetMap compact/>`).

---

## 6. Cross-cutting components & where they live

| Concern | Component / provider | Placement reasoning |
|---|---|---|
| Notifications | `ToastProvider` + `Toast` | Root provider → any feature fires a toast via `useToast()` without prop-drilling |
| Confirmations | `ConfirmProvider` | Promise-based `confirm()` so destructive actions (delete, end shift) are one `await` |
| Errors | `ErrorBoundary` (app + per-feature) | Per-feature boundaries stop one broken widget from blanking the whole page |
| Loading | `Skeleton`/`Spinner` in each container | Loading lives next to the data that's loading, driven by TanStack `isPending` |
| Theme | `ThemeProvider` + CSS tokens | One toggle flips `data-theme`; all components read tokens, none hard-code color |

---

## 7. Component design principles (applied throughout)

1. **One responsibility per component** — if a name needs "and," it splits.
2. **Props down, events up** — presentational components never fetch; containers do.
3. **Composition over configuration** — shared *primitives* + slots, not a mega config-driven
   engine (avoids the generic-CRUD time sink).
4. **Accessible by construction** — focus traps, `aria-*`, icon+label status, map list
   fallback are built into the shared components so features inherit a11y for free.
5. **Every stateful async surface has four states** — loading / empty / error / success —
   enforced by the shared `Table`, `EmptyState`, and container pattern.

---

## 8. Extending the app (the patterns to copy)

The layers make new features cheap and consistent. Concrete recipes:

- **Add a CRUD entity** → a Zod schema in `lib/schemas.ts` (types infer from it), a query hook in
  `hooks/queries`, reuse `useEntityMutations` + the shared `Table`/`FormDrawer`/`Toolbar`. A new
  Master-Data section is a one-line addition to the `RAIL` config.
- **Add create *and* edit for a record** → write **one form** that takes an optional `initial`
  (see `OrderForm`, `HubForm`); the container passes `initial` for edit and omits it for create,
  and calls `create`/`update` from the feature's mutations hook. (Order editing was added this
  way with no new component.)
- **Add a business rule** → a pure function in `services/rules.ts` (or `logistics.ts`), unit
  tested; UI consumes it. Server-authoritative rules go in `server.js`.
- **Add a surface that shows entity state** → reuse `orderReadiness` / `ReadinessPill` /
  `useReadinessResolver` so it can't disagree with the dashboard.
- **Map feature** → `CircleMarker`s (anchor-free) + `colors.ts` + `mapUtils.toLatLngs`; labels via
  tooltips. No divIcon anchoring to get wrong.
