# UI_UX.md — Design Language & Experience Spec

> Companion to `PLAN.md §6`. This is the **creative direction and design system** for
> FleetPanda, grounded in the world it operates in: fuel terminals, tankers, gauges, and
> night-shift dispatch. It supersedes the lighter sketch in `PLAN.md §6` (see §11, "What
> changed and why").

---

## 1. Concept — "The Dispatcher's Console"

FleetPanda is not a generic admin CRUD app; it is a **control room for moving fuel safely**.
The design borrows from the vernacular of that world — **terminal floodlights, instrument
clusters, gauge faces, hazard placards, reflective signage** — to make an interface that
feels *operational and trustworthy* rather than decorative.

Two moods for two personas:
- **Admin = the console.** Calm, dark, data-dense, glanceable. You *monitor* a fleet; the UI
  is a wall of instruments where anything wrong lights up.
- **Driver = the cab.** Bright, single-column, thumb-first, glove-friendly. You *operate*;
  the UI is a big, safe set of controls for one task at a time.

**Design tension we hold:** dense information, zero clutter. Warmth is *rationed* — in this
system, **warm color always means fuel or attention**, never decoration (see §3).

---

## 2. Typography — signage + instrumentation

Deliberately **not** Inter/Space Grotesk (the safe defaults). The pairing is drawn from the
subject: motorway/transit signage for headings, engineered technical type for data.

| Role | Typeface | Why this face |
|---|---|---|
| **Display / headings / nav / labels** | **Barlow Semi Condensed** | Lineage in transit & motorway signage; condensed width suits data-dense dispatch screens and reads instantly at a glance. |
| **Body / UI text** | **IBM Plex Sans** | Engineered, neutral, highly screen-legible; the "technical instrument" voice. Real small-size clarity for tables. |
| **Data / mono** | **IBM Plex Mono** | Registrations (`TRK-101`), licences, coordinates, IDs, quantities — anything that should align and read as a machine value. |

Rules: labels/eyebrows are **uppercase, +0.06em tracking**; headings use `text-wrap:balance`;
body target ~65ch; **`font-variant-numeric: tabular-nums`** everywhere digits stack (inventory,
quantities, calendar).

**Font delivery (real Vite app):** self-hosted via **`@fontsource`** npm packages
(`@fontsource/barlow-semi-condensed`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`)
— **no CDN request**, tree-shaken weights, works offline. (Data-URI `@font-face` is only for
the sandboxed Artifact previews, not the shipped app.)

**Type scale (1.25 / major-third):** 12 · 14 · 16(base) · 20 · 25 · 31 · 39.

---

## 3. Color — graphite night, petrol steel, warm = meaning

The chrome is **cool steel on graphite**; the **only warm hues are semantic** (fuel level,
delivery status). This is the core creative rule and the reason the palette reads as
*designed*, not templated: seeing amber/red on screen always means "fuel" or "attention."

### 3.1 Brand & neutrals (cool)
| Token | Dark (primary) | Light | Meaning |
|---|---|---|---|
| `--brand` | `#12A2AD` | `#0B7C86` | Petrol teal — primary actions, links, active nav, selection |
| `--brand-deep` | `#0B3D4F` | `#0B3D4F` | Deep petrol — headers, brand surfaces, map chrome |
| `--bg` | `#0D1417` | `#F4F6F6` | Ground (graphite-teal night / cool paper) |
| `--surface` | `#131E22` | `#FFFFFF` | Cards, panels |
| `--surface-2` | `#1A272C` | `#EAEEEE` | Raised / hover |
| `--border` | `#27383E` | `#D4DBDB` | Hairlines |
| `--text` | `#E7EEF0` | `#0E1A1E` | Primary text |
| `--text-muted` | `#9DB0B6` | `#5A6B70` | Secondary — a **teal-biased grey**, chosen not defaulted |

### 3.2 Semantic (warm = fuel & status)
| Token | Hex | Used for |
|---|---|---|
| `--ok` | `#23A455` | Signal green — completed delivery, healthy stock, shift active |
| `--warn` | `#E8912B` | **Diesel amber** — low-stock warning, near-threshold, pending |
| `--crit` | `#DC3B34` | **Valve red** — failed delivery, double-booking, below-min stock |
| `--info` | `var(--brand)` | Informational — reuses petrol teal (no stray blue) |

Every semantic use is **color + icon + label** (never color alone) for accessibility and for
color-blind operators. Fuel gauges use the same three-stop scale so "amber/red" reads
identically on a bar as on a badge.

**One stock-level rule drives all warm status** (gauge fill color, badge, inventory row
stripe): `crit` when `qty < lowStockThreshold`, `warn` when `qty < 1.5 × lowStockThreshold`,
else `ok`. The gauge fills `qty / tankCapacity` with the threshold drawn as a tick — so
"how close to empty" is spatial, and the color never disagrees with the number.

**Note the deliberate move:** amber is pulled *out of the chrome* (the earlier plan used it
for CTAs) and reserved as the **fuel/attention** signal — so warmth carries meaning
consistently across the whole product.

---

## 4. Grid, shape, depth

- **Spacing:** 4px base scale — 4·8·12·16·24·32·48·64. Layout via flex/grid `gap`, not margins.
- **Radius:** `--r-sm 6px` (inputs/badges), `--r-md 10px` (cards), `--r-lg 16px` (sheets/map
  panels). Restrained — industrial, not bubbly (no `rounded-lg`-everywhere).
- **Elevation:** two soft shadows only — resting card and floating panel/toast. On dark,
  elevation reads via `--surface-2` + a 1px top highlight, not heavy shadow.
- **Icons:** Lucide (consistent 1.5px stroke) — reads as instrumentation; paired with labels.

---

## 5. Information architecture

```
Admin (left rail + top status strip)          Driver (top strip + bottom tab bar)
 ├─ Dashboard   (KPIs + mini map + alerts)      ├─ Shift    (today's cluster)
 ├─ Fleet Map   ★ core                          ├─ Map      (navigate + GPS)
 ├─ Orders                                       └─ History
 ├─ Allocation  (calendar)
 ├─ Inventory
 └─ Master Data ▸ Hubs · Terminals · Products
                   · Drivers · Vehicles
Top strip (both): brand · live clock · env "last synced" · theme · user menu
```

**Reasoning:** admins scan many domains → persistent left rail with a summary Dashboard
first (summary-before-detail). Drivers do one thing at a time on a phone → 3-item bottom bar
in the thumb zone.

---

## 6. Key screens (layout intent)

**Admin — Dashboard (action center):** the admin's **to-do list**, not vanity KPIs. A
readiness summary row (Ready · In transit · Need action · Blocked — each a filter link) over a
ranked **"What needs you"** list; every row names the exact problem and carries a **deep-link
CTA** that pre-loads the fix. Fix it → the count drops → the row disappears. "All clear" state
when the day is fully dispatched.
```
Ready 2   In transit 1   Need action 2   Blocked 1
WHAT NEEDS YOU (3)
  🔴 order-3  Harbor→Southbay · 6,000 L diesel   Source short 3,600 L   [Review stock]
  🟠 order-4  Needs a driver                                            [Assign driver]
  🟠 order-6  Wei Chen has no vehicle Nov 24                            [Allocate vehicle]
```

Below the action list, a **Shift advisories** strip flags driver-**day** problems the per-order
list can't: a driver **overbooked** for the 8h shift (e.g. "4 deliveries ≈ 8h 12m — over by 12m")
or a tanker **under-utilised** (tiny load in a big truck), each with a Review CTA to Allocation.
The tiles are **live filter links** (`?readiness=`) that scope the Orders list. The driver's
**shift card** shows route km + estimated driving time + ETA.

**Admin — Fleet Map (the hero):** full-bleed dark map; floating **glass filter panel**
(driver/vehicle/status + auto-refresh toggle + "last updated"); docked right **Vehicle List
Panel** (accessible mirror + results). Markers are branded pins that **pulse** when active
and **glide** to new positions on refresh.
```
┌───────────────────────────────────────────────┬───────────────┐
│  [filters ▾]                    ⟳ 00:23  ●live │ ACTIVE (4)     │
│                                                 │ ▸ TRK-101 J.S │
│             · · ·  ( map canvas )  · · ·         │   in-transit  │
│        ◉ pulse marker → tooltip: driver, reg    │ ▸ TRK-104 A.R │
│                                                 │   loading     │
└───────────────────────────────────────────────┴───────────────┘
```

**Admin — Inventory (instrument wall):** table of hub × product where each cell is a **fuel
gauge** (mini bar) colored ok/amber/red vs threshold; low-stock rows carry a left **severity
stripe** so problems read before you read numbers.
```
HUB                 DIESEL            PETROL           PREMIUM
Downtown  ▐ ████████░░ 15,000    ██████░░░░ 12,000   ███░░░░░░ 3,100 ⚠
Harbor    ▌ ██░░░░░░░░  2,400 ⛔  █████████░ 18,700   ████░░░░░ 6,900
```

**Admin — Allocation (calendar):** month grid; each day chips = vehicle→driver; a conflict
attempt flashes the day **valve-red** with an inline "TRK-101 already booked" banner.

**Driver — Shift (instrument cluster):** one hero card = today's vehicle, deliveries count, a
**big primary Start Shift** (disabled with a plain-language reason when there's no allocation
or stock is short). Deliveries below as large tappable rows.
```
┌─────────────────────────────┐
│ TODAY · Tue 24              │
│ 🛻 TRK-101 · 8,000 L tanker │
│ 3 deliveries · 13,000 L     │
│ ┌─────────────────────────┐ │
│ │      ▶  START SHIFT      │ │  ← 56px, thumb zone
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

**Driver — Delivery action:** each delivery row → **Complete** (green, success toast + stock
updates) or **Fail** (opens a focus-trapped **reason modal**, required text). **End Shift** is
a deliberate, confirm-gated action.

---

## 7. Signature components

- **Status badge:** pill = dot-icon + label, semantic bg at ~14% + solid text; identical
  language everywhere (orders, shifts, deliveries).
- **Fuel gauge:** inline SVG bar with a threshold tick; fills ok→amber→red; the product's
  low-stock line is drawn so "how close to empty" is spatial, not just numeric.
- **Marker:** branded teardrop in petrol/status color; **pulse ring** when active; smooth
  position transition on poll (`prefers-reduced-motion` disables it).
- **Toast:** top-right stack, semantic left-stripe, icon + one-line copy that names the
  result ("Delivery completed · Downtown +5,000 L diesel"), auto-dismiss + `role="status"`.
  The delta text is built from the **server response** (fired `onSuccess`, not optimistically)
  so it's always truthful even if the server clamps/rejects.
- **Empty states:** the **panda** as a friendly operator with one-line guidance and a CTA
  ("No orders yet — create your first run").

---

## 8. Motion — restrained, meaningful

Motion earns its place only where it signals system state (per the skill's "less is more"):
- **Map refresh:** on each 30s poll the marker **tweens `setLatLng` (~400ms ease)** to its
  new spot — and because GPS "nudges" are *small* steps (geo stepper), this reads as a glide,
  not a teleport — plus a 1-frame "synced" flash on the last-updated chip.
- **Optimistic action:** row settles instantly; a subtle undo-able toast confirms.
- **Drawer/modal:** 180ms ease slide/scale; focus moves in, returns on close.
- **Live pulse:** only on *active* vehicles, so movement means "something is happening."
- All gated by **`prefers-reduced-motion: reduce`** → cross-fades/no transforms.

---

## 9. State design (every async surface)

| State | Treatment |
|---|---|
| **Loading** | Skeletons shaped like the real content (table rows, cards, map list) — not spinners-in-a-void |
| **Empty** | Panda + guidance + primary CTA |
| **Error** | Inline card: what failed + **Retry**; business errors (409/422) surface as a specific message ("TRK-101 already allocated on Tue 24"), never a raw code |
| **Success** | Toast naming the concrete outcome + any inventory delta |
| **Operational** | Proactive feedback that surfaces *realistic problems before they happen*: the order form shows the **source hub's live stock** and warns (amber) if the quantity exceeds it; driver assignment annotates the dropdown (`· on shift`, `· no vehicle`) and toasts issues — no vehicle allocated for the date, driver on shift, or **capacity overloaded** (critical/red). Warnings are **non-blocking** — the dispatcher stays in control but can't miss the problem. |

---

## 10. Responsive & accessibility

- **Mobile-first driver**, breakpoints 360 / 768 / 1280. Admin tables **reflow to cards**
  under 768; left rail → drawer; map filter panel → bottom sheet.
- **Touch:** ≥44px targets; driver primaries 56px in the thumb zone.
- **A11y:** WCAG AA contrast in *both* themes (verified on the graphite ground, which is the
  hard case); visible focus rings on brand color; full keyboard nav; focus trap + restore in
  overlays; the **Vehicle List Panel is the accessible equivalent of the map**; status is
  never color-only; live regions for toasts and the map "last updated".
- **Themes:** tokens on `:root`, redefined under `@media (prefers-color-scheme: dark)` and
  `:root[data-theme=...]` so the viewer toggle wins both ways. **Default follows
  `prefers-color-scheme`** (not force-dark) so a reviewer on a light OS isn't surprised; dark
  is the *primary* design and light is crafted with equal care (not an inversion). The user's
  explicit toggle persists via `uiPrefs`.

---

## 11. What changed from `PLAN.md §6`, and why

| Was (rev-2 sketch) | Now | Reason |
|---|---|---|
| Amber as the **CTA/accent** color | Amber is **semantic only** (fuel/low-stock); CTAs use **petrol teal** | Keeps one meaning for warmth; cleanly separates accent from status (design-system correctness) |
| "Inter (system fallback)" | **Barlow Semi Condensed + IBM Plex Sans/Mono** | Subject-grounded (signage + instrumentation); avoids the generic default face |
| Palette named but not tokenized for both grounds | Full **dark-primary + light** token tables with a teal-biased neutral | Chosen neutrals, both themes designed, contrast verified on the hard (dark) ground |
| "Fuel-gauge meters" mentioned | Gauges are the **structural motif** (inventory cells, driver cluster, badges share one scale) | Turns a nice-to-have into a coherent visual system |
| Generic "creative touches" list | A stated **concept** (Console vs Cab) that drives IA, motion, and color rationing | Design decisions now trace to one idea, not scattered flourishes |
