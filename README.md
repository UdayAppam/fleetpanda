# FleetPanda — Fleet Tracking Platform

A web interface for **petroleum logistics**: dispatchers plan and monitor a tanker fleet
moving fuel from hubs/terminals to destinations; drivers execute the day's deliveries. Built
as a frontend take-home with a mock REST backend.

> **Project status:** architecture & design complete (see [`/docs`](#documentation) and
> `PLAN.md`); implementation begins at **Phase 0 (Scaffold + Auth)**. Setup commands below
> describe the intended developer workflow.

---

## Features

**Admin / Dispatcher**
- Master data CRUD (Hubs, Terminals, Products, Drivers, Vehicles) with search, filters, validation
- Order management (create, assign to drivers, status filters)
- Vehicle allocation calendar with **double-booking prevention**
- **Live Fleet Map** — real-time vehicle positions, driver tooltips, filters, 30s auto-refresh
- Inventory dashboard with fuel-gauge stock levels and low-stock alerts

**Driver**
- Today's shift cluster + **Start Shift** (guarded by allocation & stock)
- Live map with destination markers, route line, and **Send GPS Update**
- Delivery management — complete (updates inventory) / fail (reason modal), **End Shift**
- Shift history

---

## Tech stack

| Area | Choice |
|---|---|
| Framework / build | React 18 + Vite + TypeScript (strict) |
| Server state | TanStack Query v5 |
| Global client state | Redux Toolkit (+ sessionStorage persist) |
| Cross-cutting UI | React Context (theme, toasts, confirm, auth façade) |
| Mock API | json-server + custom `server.js` (latency, errors, business rules) |
| Maps | Leaflet + react-leaflet |
| Forms / validation | React Hook Form + Zod |
| Styling | CSS Modules + design tokens (light/dark) |
| Fonts / icons | @fontsource (Barlow Semi Condensed, IBM Plex Sans/Mono) · lucide-react |
| Testing | Vitest + React Testing Library + MSW |

Rationale for every choice is in [`docs/DECISIONS.md`](docs/DECISIONS.md).

---

## Getting started

### Prerequisites
- **Node ≥ 20** and npm ≥ 10

### Install
```bash
git clone <repo-url>
cd FleetPanda
npm install
```

### Seed the mock database
```bash
npm run seed      # (re)generates db.json with realistic sample data
```

### Run (app + mock API together)
```bash
npm run dev:all   # Vite dev server + json-server, concurrently
```
- App: http://localhost:5173
- Mock API: http://localhost:4000

Or run them separately:
```bash
npm run dev       # frontend only
npm run mock      # json-server (server.js) only
```

### Log in
The login screen shows demo credentials and one-click **quick-login** chips:

| Role | Email | Lands on |
|---|---|---|
| Admin | `admin@fleetpanda.com` | `/admin` |
| Driver | `driver@fleetpanda.com` | `/driver` |

(Auth is a client-side mock — see `docs/DECISIONS.md` ADR-06/07.)

---

## Demo: the real-time flow (two tabs)

The Admin↔Driver real-time sync is best shown with **two tabs** (auth is persisted per-tab
via `sessionStorage`, so each tab can hold a different persona):

1. **Tab A** — log in as **Admin** → open **Fleet Map**.
2. **Tab B** — log in as **Driver** → **Start Shift** → **Send GPS Update** a few times.
3. Back in **Tab A**, the vehicle marker moves within one refresh cycle (≤30s or hit **Refresh**).
4. In **Tab B**, **Complete** a delivery → watch **Admin → Inventory** reflect the new stock.

To try error handling: allocate the **same vehicle on the same date twice** → blocked with a
clear conflict message.

---

## Testing

```bash
npm test              # run unit + component + integration tests (Vitest)
npm run test:coverage # coverage report → ./coverage
```

The API is mocked with **MSW** in tests. Critical flows covered:

| Flow | Where |
|---|---|
| Allocation **double-booking** blocked (409) | `features/allocation/*.test.tsx` |
| Complete delivery → **destination inventory increments** | `features/deliveries/*.test.tsx` |
| **Start/End shift** lifecycle (+ source decrement, stock guard) | `features/driver-shift/*.test.tsx` |
| **Auth guard** redirect matrix | `features/auth/*.test.tsx` |
| Utils: `stockLevel`, `stepToward`, date/clock | `utils/*.test.ts` |
| Redux slices + selectors | `store/**/*.test.ts` |

---

## Scripts

| Script | Does |
|---|---|
| `dev` | Vite dev server |
| `mock` | json-server via `server.js` |
| `dev:all` | both, concurrently |
| `seed` | regenerate `db.json` |
| `test` / `test:coverage` | run tests / with coverage |
| `lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `build` / `preview` | production build / preview it |

---

## Project structure

```
src/
├─ app/        router (+ guards), store, queryClient
├─ api/        http client + endpoint calls
├─ services/   business rules (validation/derivation only)
├─ hooks/      TanStack Query hooks + key factory
├─ store/      Redux slices + selectors
├─ contexts/   Auth, Theme, Toast, Confirm
├─ components/ ui · layout · forms · map (shared, reusable)
├─ features/   auth · master-data · orders · allocation · fleet-map ·
│              inventory · driver-shift · driver-map · deliveries · shift-history
├─ pages/      thin route compositions
├─ styles/     design tokens + themes
├─ utils/ lib/ clock, geo, formatters · zod schemas
└─ test/       setup, MSW handlers, factories
```
Full component responsibilities: [`docs/COMPONENTS.md`](docs/COMPONENTS.md).

---

## Documentation

| Doc | Contents |
|---|---|
| [`PLAN.md`](PLAN.md) | Product analysis, requirement traceability, architecture, roadmap |
| [`docs/COMPONENTS.md`](docs/COMPONENTS.md) | Component hierarchy & responsibilities |
| [`docs/STATE_MANAGEMENT.md`](docs/STATE_MANAGEMENT.md) | Three-layer state strategy (Query / Redux / Context) |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Technical decisions as ADRs (with alternatives) |
| [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md) | Code-level approach (side-effects, Query config, Leaflet, dates) |
| [`docs/UI_UX.md`](docs/UI_UX.md) | Design language, tokens, key screens, motion, a11y |

---

## Deployment

Static hosts (Vercel/Netlify) **cannot run json-server**; the mock API needs a Node host
(e.g. Render), whose free tier has an **ephemeral filesystem** (`db.json` resets on
sleep/redeploy) and requires **CORS** for the SPA origin. Because of this the **recorded
demo video is the primary deliverable**, with a deployed link as a bonus; **local run is the
most reliable path**. Set `VITE_API_URL` to point the SPA at the API origin.

---

## License

Assignment submission — not licensed for redistribution.
