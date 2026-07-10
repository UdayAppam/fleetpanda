# DECISIONS.md — Technical Decisions & Rationale (ADRs)

> Companion to `PLAN.md`. Each decision is recorded as a lightweight ADR:
> **Context → Decision → Reasoning → Alternatives rejected → Trade-offs.**
> Nothing here is "default" — every choice earns its place against the brief's evaluation
> criteria (UI/UX, architecture, state management, async/loading, error handling,
> responsiveness/performance, testing).

---

## ADR-01 — Framework: React 18 + Vite

- **Context:** Brief allows React/Vue/Angular. Need a fast SPA dev loop with a rich
  ecosystem for maps, data-fetching, and forms.
- **Decision:** React 18 built with Vite.
- **Reasoning:** Largest ecosystem for the exact libraries we need (react-leaflet, TanStack
  Query, React Hook Form). Vite gives instant HMR, native TS/ESM, and shares config with
  Vitest so testing needs near-zero extra setup.
- **Alternatives rejected:** *CRA* (deprecated, slow, webpack cruft); *Next.js* (SSR/file-
  routing is overkill for a mock-API SPA and complicates running json-server); *Vue/Angular*
  (fine, but React maximizes the assignment's library ecosystem).
- **Trade-off:** React gives less "out of the box" than Angular — we assemble routing/state/
  forms ourselves, which is exactly what the brief wants to see.

---

## ADR-02 — Language: TypeScript (strict)

- **Context:** Brief prefers TS. Domain is relational (orders→drivers→vehicles→allocations→
  shifts).
- **Decision:** TypeScript in `strict` mode; **types inferred from Zod schemas**.
- **Reasoning:** Compile-time safety catches entity-wiring bugs (e.g. wrong id field) before
  runtime. Deriving types from Zod means validation and typing share **one source of truth**
  (`z.infer<typeof orderSchema>`), so a schema change updates both.
- **Alternatives rejected:** *JavaScript* (loses the brief's stated preference and type
  safety across a linked domain); *hand-written interfaces separate from validators*
  (two things to keep in sync).
- **Trade-off:** Slightly more upfront typing effort; repaid immediately by refactor safety.

---

## ADR-03 — Server state: TanStack Query v5

- **Context:** All data comes from a mock REST API; needs caching, loading/error states, a
  30s auto-refresh, and mutations.
- **Decision:** TanStack Query owns all server state (see `STATE_MANAGEMENT.md`).
- **Reasoning:** Caching, dedupe, `isPending`/`isError`, `refetchInterval` (the map's 30s
  refresh in one line), optimistic updates, and invalidation are built-in — directly serving
  the "async operations and loading states" criterion.
- **Alternatives rejected:** *Redux for server data* (hand-rolled cache/loading/refetch — the
  anti-pattern Query exists to eliminate); *SWR* (fewer mutation/optimistic primitives);
  *raw `useEffect`+fetch* (re-implements caching poorly, no dedupe).
- **Trade-off:** Another library to learn, and two state systems (Query + Redux) — mitigated
  by the strict single-ownership rule that keeps their boundary crisp.

---

## ADR-04 — Global client state: Redux Toolkit

- **Context:** Some client state (auth, active shift ref, map filters, UI prefs) is app-wide
  and read/written across routes.
- **Decision:** Redux Toolkit slices for `auth`, `shift` (id only), `mapFilters`, `uiPrefs`.
- **Reasoning:** RTK removes boilerplate; reducers are **pure and trivially unit-testable**
  (testing-quality signal); DevTools make state visible in the demo; middleware gives clean
  persistence. Brief explicitly names Redux.
- **Alternatives rejected:** *Everything in Context* (re-render storms, no DevTools/
  middleware, harder to test); *Zustand* (excellent, but the brief names Redux/Context, so we
  honor the stated stack).
- **Trade-off:** More ceremony than Zustand; acceptable given the brief and the DevTools/
  testing benefits.

---

## ADR-05 — Cross-cutting UI: Context API

- **Context:** Theme, toasts, confirm dialogs, and an auth façade are global but provider-
  shaped and rarely/imperatively updated.
- **Decision:** React Context for `Theme`, `Toast`, `Confirm`, and `Auth` (façade).
- **Reasoning:** These are UI *services*, not app data. Context is the idiomatic delivery
  mechanism; a Redux slice would be ceremony for state that barely changes. Demonstrates the
  *correct* Context-vs-Redux boundary the brief probes.
- **Alternatives rejected:** *Redux for theme/toasts* (overkill); *prop drilling*
  (unmaintainable across two persona trees).
- **Trade-off:** Context updates re-render consumers — fine here because these values change
  infrequently.

---

## ADR-06 — Authentication: client-side mock login

- **Context:** Brief provides no backend and doesn't mention auth, but two personas exist.
- **Decision:** Client-side login against seeded `users`; state in `authSlice`, consumed via
  `AuthContext`/`useAuth()`; `ProtectedRoute` + `RoleRoute` guards.
- **Reasoning:** Demonstrates **protected routing, role-gating, and session UX** (real auth
  behavior) without a backend. A real auth API can drop in behind `useAuth()`/`login()` with
  no component changes.
- **Alternatives rejected:** *No auth / bare role toggle* (misses protected-route & session
  signal); *real OAuth* (no backend, out of scope).
- **Trade-off:** It is not *real* security (password check is mock) — clearly documented; the
  value is the UX/architecture pattern, not cryptographic auth.

---

## ADR-07 — Auth persistence: `sessionStorage` + PersistGate

- **Context:** The headline demo runs **Admin and Driver simultaneously in two tabs** against
  the shared json-server.
- **Decision:** Persist `auth` to **`sessionStorage`** (per-tab), gated by `PersistGate`.
- **Reasoning:** `localStorage` is shared across tabs, so a second login would clobber the
  first and break the two-persona demo. `sessionStorage` is per-tab and still survives
  reload. `PersistGate` prevents route guards from reading "logged out" before rehydration
  finishes (which would false-bounce a refreshed deep link to `/login`).
- **Alternatives rejected:** *`localStorage`* (breaks two-tab demo); *no persistence* (reload
  logs you out — poor UX and can't deep-link).
- **Trade-off:** Session doesn't survive closing the tab — acceptable and arguably correct for
  a per-tab persona model.

---

## ADR-08 — Mock API: json-server + custom middleware

- **Context:** Brief Option 1 (recommended). Need persistence during the session, plus the
  ability to simulate latency/errors and enforce a couple of business rules.
- **Decision:** json-server with a small `server.js` wrapper (latency, optional 500s, 409
  double-booking, inventory side-effects).
- **Reasoning:** Real REST endpoints and **session-persistent writes** for a believable demo;
  middleware lets us exercise loading/error states and enforce the double-booking + inventory
  rules server-side.
- **Alternatives rejected:** *MSW-only* (great for tests but no live persistence — so we use
  MSW **in tests** instead); *hardcoded state* (brief calls it "not recommended").
- **Trade-off:** A second process to run in dev (documented in README) and it can't be hosted
  on static platforms (see ADR-14).

---

## ADR-09 — Routing: React Router v6

- **Decision:** React Router v6 with nested layout routes and guard wrappers.
- **Reasoning:** Nested `<Outlet/>` layouts model `/login`, `/admin/*`, `/driver/*` cleanly;
  guards (`ProtectedRoute`/`RoleRoute`) compose as route elements driven by `authSlice`.
- **Alternatives rejected:** *TanStack Router* (newer, smaller ecosystem); *hash routing*
  (worse URLs/UX).
- **Trade-off:** Data-router `loader`s not used (we fetch in components via Query) — a
  deliberate choice to keep one data layer.

---

## ADR-10 — Maps: Leaflet + react-leaflet

- **Decision:** Leaflet via react-leaflet for both the Admin and Driver maps.
- **Reasoning:** Brief names Leaflet/Mapbox; Leaflet is **free and token-less** (no reviewer
  friction), supports markers, driver-info tooltips, and route polylines. React bindings keep
  markers declaratively bound to Query data.
- **Alternatives rejected:** *Mapbox/Google* (API keys/billing = setup friction for
  reviewers); *hand-rolled canvas* (reinventing pan/zoom/tiles).
- **Trade-off:** Maps are weak for a11y → we add a `VehicleListPanel` as the accessible
  equivalent (see ADR-15).

---

## ADR-11 — Forms & validation: React Hook Form + Zod

- **Decision:** React Hook Form for form state, Zod for schemas.
- **Reasoning:** RHF uses uncontrolled inputs → minimal re-renders (performance criterion).
  One **Zod schema does three jobs**: runtime validation, inferred TS types, and reuse in
  tests. Satisfies "form validations" + "TypeScript interfaces."
- **Alternatives rejected:** *Formik* (more re-renders, heavier); *hand-rolled validation*
  (duplicated, drifts from types).
- **Trade-off:** Two libraries, but they're small and compose via `@hookform/resolvers`.

---

## ADR-12 — Styling: CSS Modules + design tokens (CSS variables)

- **Decision:** CSS Modules with a token layer of CSS custom properties; no component kit.
- **Reasoning:** Scoped styles, **zero runtime cost**, and full control over the FleetPanda
  petroleum brand ("creative, on-brand UI" is the top evaluation item). Tokens enable
  **light/dark theming** by flipping `data-theme`, and make the design system explicit and
  reviewable.
- **Alternatives rejected:** *MUI/AntD* (generic look, hard to make distinctive, large
  bundle); *Tailwind* (viable, but explicit tokens+modules make the brand system more
  legible for reviewers); *styled-components* (runtime cost).
- **Trade-off:** We build primitives ourselves — more work, but that *is* the "component
  architecture" being evaluated, and it keeps the bundle lean.
- **Styling standard (enforced):** **no inline `style` for presentation** — all rules live in CSS
  Modules or the small global utility set (`.mono`/`.num`/`.capitalize`/`.muted`). Dynamic,
  data-driven geometry (a gauge fill %, a progress width, a table column width) is passed as a
  **CSS custom property** via `style` (e.g. `--fill`), so the *rules* still live in the stylesheet
  and only a *value* crosses the boundary. Shared inputs merge `className` so they're extensible.

---

## ADR-13 — Testing: Vitest + React Testing Library + MSW

- **Decision:** Vitest (runner), RTL (component/integration), MSW (network mocking in tests).
- **Reasoning:** Vitest shares Vite config (fast, no separate transform). RTL tests behavior,
  not implementation. **MSW mocks the API in tests** (explicit brief requirement) and the same
  handlers back the integration flows. Coverage is **right-sized to critical paths**
  (allocation conflict, delivery→inventory, shift lifecycle, auth guard) rather than a blanket
  number.
- **Alternatives rejected:** *Jest* (extra config/transform friction with Vite/ESM);
  *Enzyme* (implementation-detail testing, deprecated).
- **Trade-off:** Meaningful coverage over a high headline percentage — a conscious priority
  call given the 2–3 day budget.

---

## ADR-14 — Deployment: video-primary, deploy-as-bonus

- **Context:** Static hosts (Vercel/Netlify) **cannot run json-server**; a Node host (Render)
  has an **ephemeral filesystem** and needs **CORS**.
- **Decision:** The **recorded 2–3 min video is the primary demo deliverable**; a deployed
  link (SPA on Netlify + json-server on Render) is a bonus; local run is the documented
  reliable path.
- **Reasoning:** Honesty about the mock-backend's hosting limits avoids a broken live link
  during evaluation. Local run always works.
- **Alternatives rejected:** *Claiming a fully persistent hosted API* (would silently reset on
  Render sleep/redeploy — misleading).
- **Trade-off:** Slightly less "wow" than a live URL, but reliable and truthful.

---

## ADR-15 — Domain modeling decisions

These aren't library choices but they materially shape the app; recorded for traceability.

- **Product keying by `key` string** (not `productId`): the brief's sample seeds inventory as
  `{diesel, petrol}` and `order.product: "diesel"`. Keying by `Product.key` matches the data
  and avoids `inventory[productId] → undefined` bugs.
- **No separate `Delivery` entity:** a delivery *is* an `Order` inside a shift; order status +
  `failureReason`/`completedAt` carry the lifecycle. Removes a redundant mirror table (one
  source of truth).
- **Inventory flow (corrected):** **source hub decrements on dispatch**, **destination
  increments on delivery** — fuel physically moves source→destination. (An earlier draft
  decremented the destination, which was backwards.)
- **`sourceId` added to Order** (not in the brief's sample): fuel must load from an origin
  hub for the inventory maths and the route line.
- **Hubs & Terminals = one entity** (`locationType`) but surfaced as **separate nav/lists** so
  the brief's "Hubs, Terminals" checklist is visibly satisfied.
- **Accessible map fallback:** a `VehicleListPanel` mirrors the map for keyboard/screen-reader
  users, since Leaflet maps are inherently hard to make accessible.

---

## ADR-16 — Scope discipline (MoSCoW) within 2–3 days

- **Decision:** Ruthless prioritization: **Must** = all R1–R25 + Live Fleet Map + core rules;
  **Should** = auth, dark mode, toasts, skeletons; **Could** (time-boxed, cut first) = mascot,
  fuel-gauge meters, animations, optimistic UI beyond two showcase flows.
- **Reasoning:** The brief's top criterion is UI/UX and its named "core feature" is the map.
  The cut line guarantees the core ships polished before any nice-to-have consumes time.
- **Trade-off:** Some delightful extras may not ship — an intentional exchange for a complete,
  robust core.

---

## ADR-17 — Side-effect ownership: the mock server is the single writer

- **Context:** Inventory changes and status transitions touch multiple resources atomically.
  If both the server and a client service apply them, stock changes twice.
- **Decision:** Transactional mutations live in **custom Express routes in `server.js`**
  (`/shifts/:id/start`, `/orders/:id/complete|fail`, `/shifts/:id/end`, `/allocations`). The
  client never writes inventory; its `services/` layer only validates/derives.
- **Reasoning:** One writer ⇒ no double-apply; atomicity in one place; business rules
  enforceable with real HTTP codes (409/422). See `IMPLEMENTATION.md §1–3`.
- **Alternatives rejected:** *Client-side side-effects* (races, non-atomic, easy to double-
  apply); *both sides "for safety"* (the actual bug we're preventing).
- **Trade-off:** `server.js` grows beyond vanilla json-server — worth it for correctness.

---

## ADR-18 — Idempotent transitions + non-negative inventory

- **Decision:** Side-effects key on the **status transition** (`assigned→in_transit`,
  `in_transit→delivered`); illegal/repeat transitions return `409`. Dispatch that would drive
  stock negative returns `422`; the client disables Start Shift with a reason.
- **Reasoning:** Retries/double-clicks can't double-apply; inventory stays physically valid —
  a realistic logistics edge case and a strong error-handling demo.
- **Alternatives rejected:** *Trusting the client not to double-fire* (fragile); *allowing
  negative stock* (nonsensical for fuel).
- **Trade-off:** Slightly more server logic; directly serves "error handling and edge cases."

---

## ADR-19 — TanStack Query defaults, key factory, optimistic recipe

- **Decision:** Global `refetchOnWindowFocus: false`, `staleTime: 30s`, `retry: 1`;
  `refetchInterval` scoped **only** to `['vehiclePositions']`; a centralized **query-key
  factory**; and a canonical optimistic recipe that **`cancelQueries` first**.
- **Reasoning:** Focus-refetch off prevents surprise refetches during the two-tab demo;
  scoped interval keeps only the map polling; the key factory makes invalidation typo-proof;
  `cancelQueries` stops a background poll clobbering an optimistic update. See
  `IMPLEMENTATION.md §4`.
- **Alternatives rejected:** *Defaults as-is* (chatty, race-prone); *inline string keys*
  (fragile invalidation).
- **Trade-off:** A little config up front for predictable data behavior.

---

## ADR-20 — Maps: custom `divIcon` markers + Vite hardening

- **Decision:** Use custom **`L.divIcon`** markers (branded pin + pulse), import Leaflet CSS,
  set explicit map height, `React.memo` markers by id, and **mock `react-leaflet` in tests**
  (assert via `VehicleListPanel`).
- **Reasoning:** divIcons give us on-brand markers **and** sidestep the classic broken-
  default-icon bundler bug; memoization keeps the 30s poll smooth; jsdom can't render Leaflet
  so the accessible list is the test surface. See `IMPLEMENTATION.md §6`.
- **Alternatives rejected:** *Default Leaflet icons* (break under Vite, generic look);
  *testing the canvas* (not possible in jsdom).
- **Trade-off:** A little marker CSS to own — which we want for the brand anyway.

---

## ADR-21 — Operational validation: warn, don't block (order placement & assignment)

- **Context:** Dispatchers need to *see realistic operational problems* while placing orders
  and assigning drivers — insufficient source stock, no vehicle allocated for the date,
  driver already on shift, vehicle capacity overloaded.
- **Decision:** Surface these as **non-blocking, real-time feedback** (inline stock readout +
  amber/green banner on the order form; dropdown annotations + toasts on assignment), computed
  by pure functions in `services/rules.ts` (`orderStockCheck`, `assignmentIssues`) and
  unit-tested. Hard, correctness-critical rules stay **blocking on the server** (start-shift
  422 for negative stock, 409 double-booking).
- **Reasoning:** Planning is intentionally flexible — an order for a future date may exceed
  *today's* stock and still be valid once replenished, and a driver may get a vehicle
  allocated later. Blocking those would fight the dispatcher; **informing** them respects
  operator judgment while making problems impossible to miss. The authoritative guards remain
  server-side so nothing invalid can actually execute.
- **Alternatives rejected:** *Hard-block at planning time* (too rigid for future-dated
  planning); *no feedback* (operator discovers the problem only when the shift fails to start).
- **Trade-off:** A warning can be ignored — acceptable, because the server still refuses the
  invalid *action* (dispatch/allocation) at execution time.

---

## ADR-22 — Dispatch readiness: one classifier drives the dashboard, orders & allocation

- **Context:** A dispatcher's core question is *"what do I need to do right now?"* That state
  (needs driver / needs vehicle / over capacity / stock short / ready) was implicit and
  scattered, and an earlier version wrongly flagged "no vehicle yet" as an error at
  order-assignment time — inverting the brief's sequence (order → *then* allocate).
- **Decision:** A single pure function **`orderReadiness(order, ctx)`** classifies each order
  into one state + tone + next-action. The **action-center dashboard**, the **Orders readiness
  column**, and the **allocation guard** all read it (via `useDispatchReadiness` /
  `useReadinessResolver`). Dashboard items carry **deep-link CTAs** that pre-load the fix.
  Capacity is **hard-blocked** at allocation (physically impossible); stock is a **warning**
  (replenishable). Superseded `assignmentIssues` (ADR-21's assignment toasts).
- **Reasoning:** One source of truth means the three surfaces can never disagree; the
  dashboard becomes a to-do list ("fix it → count drops"), which is the top-weighted UX
  criterion. Pure derivation from existing queries → no new server state, fully unit-testable
  (every branch covered).
- **Alternatives rejected:** *Per-screen ad-hoc checks* (drift, duplication — the ADR-21
  assignment toasts were exactly this); *a new backend "readiness" endpoint* (unnecessary; it's
  derivable client-side).
- **Trade-off:** Readiness recomputes on the client each render — negligible at this data
  scale, and memoized.

---

## ADR-23 — Logistics realism: per-order readiness vs driver-day feasibility

- **Context:** Real dispatch needs distance, journey time, whether a driver's day fits an 8-hour
  shift, and whether a tanker is right-sized for its load — "can John actually do these 4 runs
  today?"
- **Decision:** A pure `services/logistics.ts` (haversine distance; per-order round-trip time at
  45 km/h + 30 min load + 30 min unload; `driverDayPlan` → shift feasibility over an 8 h window +
  utilisation vs a 35 % floor). Crucially, **shift-overbooked and under-utilised are driver-DAY
  properties, kept OUT of the per-order `orderReadiness`** — otherwise one overbooked day would
  render N identical order pills. They surface at the **allocation step**, a **dashboard "Shift
  advisories" strip**, and the **driver shift card (ETA)**. Capacity/maintenance/double-book
  **block**; time/utilisation/stock **warn** (per ADR-21/22 philosophy).
- **Reasoning:** Correct granularity (one order = one state; one driver-day = one advisory) keeps
  the model honest and the UI un-noisy. Assumptions are constants at the top of the module, easy
  to tune. Fully client-derived from coordinates already in the data — no backend, unit-tested.
- **Alternatives rejected:** *Folding shift/utilisation into `orderReadiness`* (wrong
  granularity, noisy — the review caught this); *a routing API for exact ETAs* (overkill; a
  conservative round-trip estimate is enough for planning).
- **Trade-off:** Round-trip-per-order overestimates multi-drop routes slightly — deliberately
  conservative for shift planning, and documented.
- **Live-location extension:** `driverDayPlan` optionally takes the vehicle's current GPS
  position and folds a **deadhead** (current → first pickup) into the shift time, so assigning a
  driver whose truck is far from the pickup correctly costs more of the shift. Surfaced in
  Allocation + the driver ETA; still fully derivable client-side.

---

## ADR-24 — Fleet Map: identifiable markers + list↔map selection

- **Context:** Plain dot markers were hard to identify/track; the map lacked geographic context
  and any link between the list and the map.
- **Decision:** Custom `divIcon` **truck markers labeled with the registration** (status colour +
  pulse for in-transit); **hub/terminal context markers**; **dashed route polylines** to
  destinations; **bidirectional selection** (list row ↔ marker) with a `MapController` that
  `flyTo`s the selected vehicle; popups showing **remaining distance + ETA**.
- **Reasoning:** A dispatcher must identify a truck at a glance and jump between the tabular and
  spatial views — the top UX criterion for the "core feature". Selection state is local to the
  page; the `useMap()` controller keeps Leaflet imperative panning out of React render.
- **Alternatives rejected:** *Marker clustering* (unnecessary at this fleet size); *always-open
  labels for every hub* (clutter — hubs use light labels, vehicles carry the reg).
- **Trade-off:** More marker CSS/markup to own — worth it for legibility and brand.
- **Update (rev 15):** custom divIcon markers were replaced by **`CircleMarker`** after repeated
  sub-pixel placement drift — see ADR-26.

---

## ADR-26 — Map markers: `CircleMarker`, not divIcon (placement accuracy)

- **Context:** Custom HTML **divIcon** markers kept rendering visually offset from their true
  coordinate (Leaflet's default white box; rotation/anchor/CSS-centering subtleties), so the
  in-transit truck looked *off* the route line and source/destination pins looked *misplaced* —
  even though the underlying coordinates were verified exact.
- **Decision:** Rebuild both maps on Leaflet **`CircleMarker`**. It renders in the SVG overlay
  pane **at the projected lat/lng directly** — no `iconAnchor`, no icon box, no CSS centering —
  making placement mathematically exact. Labels move to **tooltips** (permanent for active items,
  with emoji as lightweight "icons"), colour encodes status (truck) and product (dropoff); trucks
  are painted last so they sit on top of the route.
- **Reasoning:** The right primitive eliminates a whole class of anchoring bugs. The truck's
  position *is* a route waypoint, so a CircleMarker there is provably **on the line**; pickup/
  dropoff CircleMarkers sit exactly on hub coordinates. Simpler, less CSS, and correct.
- **Alternatives rejected:** *More divIcon anchor tweaking* (kept drifting — three rounds);
  *raster icon images* (still anchor-based, plus asset loading).
- **Trade-off:** Lose bespoke SVG truck/heading glyphs — replaced by coloured dots + emoji
  tooltips. Accuracy and reliability win over decorative marker art.

---

## ADR-27 — Location coordinates: offline map picker, not live geocoding

- **Context:** Typing raw lat/lng in the location form is error-prone. A nicer UX is picking on a
  map or searching an address; the ask was "use a map / a Leaflet API to fetch locations."
- **Decision:** Add an **offline map picker** — click the embedded Leaflet map to set the
  location's coordinates (a `CircleMarker` moves; number fields become an auto-filled readout).
  Address remains a manual label. **No geocoding.**
- **Reasoning:** **Leaflet has no geocoding API** — it only renders maps. Address→coordinates (or
  a searchable location dropdown) needs an external service (**Nominatim/OSM** — free but online,
  rate-limited ~1 req/s, attribution; or **Mapbox/Google** — API key + billing). That's an online
  dependency and a new failure mode, which conflicts with the app's **offline, no-backend,
  deterministic-demo** design. The map picker delivers most of the UX win with **zero external
  dependency** and always works.
- **Alternatives rejected:** *Live Nominatim address search* (offered as a documented **opt-in**
  behind a config flag — the `LocationPicker` is the seam — but not wired into the core flow);
  *manual lat/lng only* (poor UX).
- **Trade-off:** No type-an-address autofill offline; the map click + manual address label is the
  reliable substitute.
- **Update (rev 19):** on request, **geocoding was added** — reverse (map click → address) +
  forward (address search box) via **Nominatim** — but kept **best-effort with graceful
  fallback**: if it's offline/rate-limited, coordinates still set and the address stays editable,
  so the form never breaks. `services/geocode.ts` is the single seam (swap Nominatim for
  Mapbox/Google if quality/limits demand).

---

## ADR-25 — Movement trail + curved pseudo-route (offline, no routing API)

- **Context:** A straight source→destination line doesn't read as a *route*, and there was no way
  to see where a truck had **been** (live tracking). Real road geometry needs an external routing
  service (OSRM/Mapbox/Google) — an online dependency that breaks the app's offline, no-backend,
  deterministic-demo design.
- **Decision:** Keep it offline: (1) a **breadcrumb trail** — each GPS update appends the previous
  point to `vehiclePosition.trail`, drawn as a solid line behind the marker; (2) a **curved
  pseudo-route** (`services/route.ts`, a deterministic quadratic Bézier with a perpendicular
  mid-offset) drawn as the animated remaining path, and the **GPS simulation advances along it**
  (`nextAlongRoute`) so the marker traces the curve. Both maps (admin + driver) share the same
  function, and the marker heading points along the route.
- **Reasoning:** Delivers the requested realism — motion, a trail, and a non-straight route — with
  **zero external dependency**, deterministic and unit-tested, so the demo always works. Honestly
  *not* real roads.
- **Alternatives rejected:** *OSRM/Mapbox Directions API* (true roads, but online-only, rate-
  limited, another failure mode — offered as an opt-in if real geometry is required); *straight
  line* (the thing being fixed).
- **Trade-off:** The curve is decorative, not road-accurate. If real turn-by-turn geometry is
  needed, `routePath()` is the single seam to swap for a routing-API call.

## ADR-28 — Serverless deploy: run the mock API in the browser (MSW), not a Node host

- **Context:** The app's backend is `server.js` (json-server + custom single-writer routes). A
  static host (Netlify) **cannot run it**, so the first deploy served the dev `index.html` (MIME
  error, ADR-14) and, once fixed, the SPA had `http://localhost:4000` baked in and no API to reach.
  Hosting `server.js` separately (Render) reintroduces cold starts, an ephemeral filesystem, and a
  second origin to keep alive — heavy for a take-home demo.
- **Decision:** Ship a **serverless build** that runs the API **inside the browser** via **MSW**.
  The transactional rules already live as MSW handlers used by the test suite; they were extracted
  into a shared factory (`src/mocks/handlers.ts`, parameterised by a mutable store) consumed by
  **both** `msw/node` (tests) and a **Service Worker** (`src/mocks/browser.ts`, deployed). Data is
  seeded from a frozen snapshot (`src/mocks/db.seed.json`, generated by `seed.js`) and persisted
  per-browser to `localStorage` behind a version key. A `VITE_MOCK=true` flag (set in
  `netlify.toml`) switches `API_URL` to same-origin so the worker intercepts every request;
  `VITE_DEMO_DATE` is pinned to the snapshot's base date (2026-07-10) so "today" stays coherent.
  OSM tiles + Nominatim geocoding are left to hit the network (`onUnhandledRequest: 'bypass'`).
- **Reasoning:** One command (`npm run build:mock`) yields a **fully working, shareable, static**
  deploy with no backend, no DB, and no cold start — anyone opening the link gets seeded data
  instantly. It reuses the *same* business-rule code the tests trust (DRY: `server.js` remains the
  canonical spec; the handlers mirror it), so behaviour matches the real API.
- **Alternatives rejected:** *Netlify Functions + hosted DB (Blobs/Supabase)* — real shared
  persistence but more code, an external dependency, and seeding to maintain; overkill for a demo
  (kept as the path if multi-user shared state is ever required). *Host `server.js` on Render* —
  cold starts + ephemeral writes + a second origin to babysit.
- **Trade-off:** Mock data is **per-browser and ephemeral** (a "Reset demo" seam exists via
  `resetMockData()`), not shared across users/devices. For true shared state, run the full-stack
  option (`VITE_API_URL` → hosted `server.js`) — the app code is identical either way.
