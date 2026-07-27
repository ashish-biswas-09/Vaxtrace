# VaxTrace Admin — UI/UX Redesign Blueprint

**Date:** 2026-07-27 · **Base commit:** `37dcb2f` (main) · **Scope:** Admin panel + Authentication
**Audited:** 33 route files under `apps/web/src/app/(admin)` and `(auth)`, the shared kit in `_components/`, `packages/ui-tokens/tokens.css`, `globals.css`
**Supersedes:** `docs/admin-uiux-audit.md` (feature parity vs Figma). This document covers design quality, IA and system architecture.

---

## 0. Verdict

| Dimension | Now | Target | The gap |
|---|---|---|---|
| Design-system **coverage** (tokens) | 25 | 95 | 9 colour tokens + 1 font. No surface, spacing, type, radius, shadow, motion, z-index, chart tokens |
| Design-system **adoption** (kit) | 45 | 95 | The kit exists and is half-used — see §1.2 |
| Dark mode | 55 | 95 | Canvas fixed, elevation and `color-scheme` still missing |
| Information architecture | 80 | 95 | 4 groups already correct; depth and breadcrumbs missing |
| Navigation & wayfinding | 45 | 95 | 24 destinations, no icons, no counts, no breadcrumbs, no search |
| Component consistency | 45 | 95 | 17 hand-rolled tables, 14 copies of the button class |
| Accessibility (WCAG 2.2 AA) | 55 | 100 | Zero `aria-invalid` app-wide; contrast; focus; keyboard |
| Feedback & states | 60 | 95 | One skeleton for 33 routes, no toasts, no `not-found` |
| Dashboard effectiveness | 60 | 95 | 9 undifferentiated KPIs, no deltas, no streaming |
| Authentication | 35 | 95 | Unbranded, light-only, flashes on load |
| Performance | 60 | 90 | 3 query waves, no streaming, unbounded reads |
| **Overall** | **~70** | **95+** | |

**The headline finding is not "there is no design system." It is that the design system exists and only half the screens use it.** `PageHeader`, `EmptyState`, `FormMessage`, `ConfirmButton`, `StatCard`, `StatusBadge` and a responsive `DataTable` are all built and good. Ten screens use them; twenty hand-roll the same shapes beside them. That split — two generations of screens living in one panel — is what a reviewer sees first, and it is cheaper to close than to rebuild.

---

## 1. Current state

### 1.1 Surface inventory — 24 destinations + 9 sub-routes

| Group | Destinations |
|---|---|
| — | ড্যাশবোর্ড `/admin` |
| **পরিষেবা** | children · guardians · tracing · zero-dose · duplicates |
| **কর্মসূচি** | coverage · sessions · reports · aefi · data-quality |
| **সরবরাহ** | inventory · stock · requisitions · cold-chain · catalog |
| **প্রশাসন** | locations · facilities · population · users · break-glass · **audit** · notifications · settings · help |

Sub-routes: `children/[id]`, `children/new`, `inventory/[id]`, `inventory/new`, `catalog/[id]`, `catalog/new`, `users/[id]`, `reports/export`, `audit/export`. Plus `analytics` → redirect. Auth: `/`, `/role`, `/sign-in`, `/sign-up`, `/verify`, `/claim`, `/scope`. Account: `/account`, `/account/security`.

**`audit` is removed by this plan (§7). No orphan routes — the nav covers everything else.**

### 1.2 Adoption split — the core problem, in counts

| Shared primitive | Uses | Screens that hand-roll it instead |
|---|---|---|
| `PageHeader` | **10** | **20** write their own `<h1>` block |
| `DataTable` | **14** | **17** files hand-roll `<table>` |
| `EmptyState` | **6** | the rest print a bare `<p>` |
| `ConfirmButton` | several | **4 `window.confirm()` calls survive** |
| — Button — | **does not exist** | **14 files copy the primary-button class string** |
| — Field — | **does not exist** | **0 occurrences of `aria-invalid` or `aria-describedby` in the entire app** |
| `requireRole` (legacy) | **19 screens** | vs `requireAppRole` + `mfaGate` on **14** — two authorization APIs |
| `export const metadata` | **1** (root) | **33 routes all render the tab title "VaxTrace"** |
| Route `loading` / `error` / `not-found` | 1 / 1 / **0** | one dashboard-shaped skeleton serves all 33 |

The 17 hand-rolled tables are the expensive one: `DataTable` carries the search box, filter chips, pagination, the zero-result-vs-empty distinction and the **mobile card fallback**. Every screen that hand-rolls a table silently opts out of all six.

### 1.3 Token layer

`packages/ui-tokens/tokens.css` is 33 lines: 9 colours × 2 themes + 1 font. Absent: surface/elevation, spacing, type scale, radius, shadow, focus, motion, z-index, chart palette, and **`color-scheme`**.

Measured contrast against the current tokens:

| Pair | Ratio | Needs | |
|---|---|---|---|
| Card border `#30363d` on dark canvas `#0d1117` | **1.55:1** | 3:1 | ❌ improved from 1.33 but still invisible |
| Table header `#30363d`@40% on `#0d1117` | **1.15:1** | 3:1 | ❌ header indistinguishable from body |
| Card border `#e5e7eb` on light `#ffffff` | **1.24:1** | 3:1 | ❌ same defect, light theme |
| Body `#fafafa` on `#0d1117` | **18.1:1** | 4.5:1 | ⚠️ over-contrast → halation on Bengali matra |
| Semantics, light | 4.83 / 5.02 / 5.02 | 4.5:1 | ✅ |
| Semantics, dark | 6.88 / 11.40 / 10.94 | 4.5:1 | ✅ |

The canvas was already lifted to `#0d1117`. The remaining defect is structural, not chromatic: **a card has no fill of its own**, so it is defined entirely by a 1.55:1 hairline. No border value fixes that — a surface ramp does.

---

## 2. Findings

**P0** blocks credible production · **P1** materially degrades · **P2** polish.

### Design system (D)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D-01 | P0 | No surface/elevation tokens — cards are hairlines on the canvas (§1.3) | 3-step surface ramp per theme (§4.1) |
| D-02 | P0 | `color-scheme` never declared. The panel has **8 `<select>`, 3 `<input type=date>`, 6 `type=number`** — all render **light native chrome on the dark theme** (dropdown lists, date pickers, spinners) | `color-scheme: dark` / `light` on each token scope |
| D-03 | P0 | The border token is used as a surface fill — `bg-[var(--color-border)]/40` for every table header | `--surface-raised` |
| D-04 | P1 | No type scale. `text-[10px]` in the reports chart, `text-xs` (12px) as default meta — below the legible floor for Bengali, and no line-height set for matra clearance | 9-step scale, 13px floor, 1.6 leading (§4.2) |
| D-05 | P1 | No spacing rule: page gap alternates `gap-6`/`gap-8`, card padding `p-4`/`p-5`/`p-6` across screens | Layout constants (§4.3) |
| D-06 | P1 | No icon system. `☰` as a text glyph, `→`/`←` as text affordances, two inline SVGs in `ThemeToggle`, nothing in a 24-item nav | 20px stroke set, one module (§4.5) |
| D-07 | P1 | Focus ring reuses `--color-primary` — same token as brand, CTA and active nav; and `:focus-visible` is unscoped, so it also fires on non-interactive elements | Dedicated `--focus`, scoped selector (§4.6) |
| D-08 | P1 | No chart tokens. Coverage bars encode by semantic tone only; the reports daily-dose chart has no axis, no gridline, no target line, and `flex-1` bars collapse to hairlines past ~40 days | Chart palette + axis + target (§4.7) |
| D-09 | P2 | No motion tokens, no `prefers-reduced-motion` | Duration/easing tokens (§4.4) |
| D-10 | P2 | No z-index scale; raw `z-10`/`z-20` in three overlay components | One ladder (§4.3) |

### Navigation & IA (N)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| N-01 | P0 | **No breadcrumbs anywhere across 24 destinations and 9 detail routes.** Only `children/[id]` has a hand-written back-link; batch, vaccine and user detail pages have no way back but the browser button | Route-derived breadcrumb in the topbar (§5.2) |
| N-02 | P0 | Header holds a theme toggle and an avatar. No title, no search, no alert indicator, no period scope | Full topbar (§5.2) |
| N-03 | P0 | **No global search.** Reaching a child by the ID read off a card means navigating to Children first | ⌘K command palette (§5.2) |
| N-04 | P1 | 24 nav links, no icons — a wall of Bengali text scanned by reading every line | 20px icon per item |
| N-05 | P1 | No counts on nav items, though due doses, stock alerts, cold-chain excursions, untraced defaulters and failed notifications are all already computed on the dashboard | Badge counts on the 5 that have one |
| N-06 | P1 | Active nav = solid `--color-primary` fill, the same treatment as the primary CTA. Twenty-four possible "buttons" compete with the real action | Tinted surface + 2px accent rail |
| N-07 | P1 | `MobileNav` is a dropdown: no focus trap, no `Escape`, dismissal only via an invisible full-screen button. `AccountMenu` declares `role="menu"` with no `menuitem` children and no keyboard model | `<dialog>` drawer + real menu semantics |
| N-08 | P2 | Sidebar fixed at 224px with no collapse; at 24 items it consumes a sixth of a laptop viewport permanently | 256 ↔ 64px rail, persisted |
| N-09 | P2 | Group order is by domain, but `প্রশাসন` holds 9 of 24 items — twice any other group | Split reference data from guard rails (§3) |

### Screens (S)

| ID | Sev | Screen | Finding | Fix |
|---|---|---|---|---|
| S-01 | P0 | Dashboard | **9 KPI cards** in a 6-then-3 layout, visually identical, no ranking. **Not one carries a trend or comparison** — every number is dead | 4 KPIs + delta + sparkline (§6) |
| S-02 | P0 | Dashboard | Open AEFI cases — including `investigation_overdue`, the one row that means someone must be telephoned — render **below nine KPI cards** | Alert rail above the fold (§6) |
| S-03 | P1 | Dashboard | Three sequential query waves: `Promise.all` of 11, then `vaccines`, then `actors`. Nothing paints until the slowest of 13 resolves | `_queries.ts` + `<Suspense>` per zone |
| S-04 | P1 | 20 screens | Hand-rolled `<h1>` header blocks instead of `PageHeader` — three geometries already drifted | Migrate to `PageHeader` |
| S-05 | P1 | 17 files | Hand-rolled `<table>` — no search, no filters, no pagination, **no mobile card fallback**; `min-w-[40rem]` hard-scrolls on a phone | Migrate to `DataTable` |
| S-06 | P1 | children, inventory, stock | No sortable columns anywhere. Order is fixed server-side; an admin cannot re-rank by stock level or coverage | `aria-sort` headers in `DataTable` |
| S-07 | P1 | children | No coverage/status filter chips — "children with missed doses", the main reason to open the screen, is not one click | Status filters |
| S-08 | P1 | reports | Bars → detail table → dropout table → daily chart, with no report selection and **no date-range scope on any screen in the panel** | Report picker + `?range=` scope |
| S-09 | P1 | settings | 4 of 5 groups are read-only status reports rendered identically to the one editable group | Split configuration from system status |
| S-10 | P1 | All | **`export const metadata` appears once in the app.** Every one of 33 routes shows the tab title "VaxTrace" | Per-route `title` |
| S-11 | P1 | All | **No `not-found.tsx` in the admin subtree.** `notFound()` from a detail route escapes to the unstyled root 404, outside the shell | Add one |
| S-12 | P2 | All | One `loading.tsx` — a dashboard-shaped skeleton — serves 33 routes | Per-route skeletons |
| S-13 | P2 | notifications, aefi, break-glass | 4–5 status-count cards where a single segmented bar says the same thing in one row | Segmented status bar |

### Components (C)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C-01 | P0 | **No `Button`.** The primary class string is copied into **14 files**; `SubmitButton` only works inside a `<form>` (`useFormStatus`), so every link-button and plain button is hand-written | `Button` primitive; `SubmitButton` becomes a wrapper |
| C-02 | P0 | **No `Field`.** Every form writes a bare `<label><input>`. **Zero `aria-invalid`, zero `aria-describedby` in the whole app** — errors render as unlinked red text and no field announces its own state | `Field` owns label/hint/error/ARIA |
| C-03 | P1 | `FormMessage` is good but page-scoped. **4 `window.confirm()` calls survive** despite `ConfirmButton` existing, and there is no toast — a mutation that revalidates in place gives no confirmation at all | Toast region + finish the `ConfirmButton` migration |
| C-04 | P1 | `StatusBadge` is outline-only — 1px border + text in the tone colour, inheriting the same 1.55:1 problem, and reading as a disabled chip | Tinted fill (`color-mix`) |
| C-05 | P1 | `DataTable`: no sort, no sticky header, no row hover, no selection, no density control, no URL-synced state (so a filtered view is unshareable), no `aria-live` on the result count | Extend (§4.8) |
| C-06 | P1 | `StatCard` has no comparison slot, so no screen can show a trend even where the data exists | `delta` + `sparkline` props |
| C-07 | P2 | `Card`, `GroupCard`/`GroupRow` (settings), definition-list `Field` (child detail) duplicated as local helpers in 3+ files | Promote to the kit |
| C-08 | P2 | No `Callout`. AEFI and the notifications hint each hand-roll a bordered `<section>` | `Callout` primitive |

### Authentication (A)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A-01 | P0 | **Zero branding.** Every auth screen is an `<h1>` and a 384px form centred on a blank page. Nothing reads as a government health system | Split brand shell (§8) |
| A-02 | P0 | **Auth is light-only.** `data-theme` lives on `#admin-root`, so it cannot reach `(auth)`, `/account` or `/worker`. An admin in dark mode is flash-banged at every sign-out | Hoist theme to `<html>` |
| A-03 | P0 | `ThemeToggle` applies the persisted theme in `useEffect` → **dark-flash on every load** for light users; SSR always emits dark | Blocking inline script |
| A-04 | P1 | Landing → role → sign-in is three screens before a character can be typed; the landing screen exists only to hold one button | Merge landing and role |
| A-05 | P1 | The password/OTP switch is two `<button>`s — no `role="tablist"`, no `aria-selected`, no arrow keys | Real tabs |
| A-06 | P1 | No `autocomplete` attributes, no password reveal, no caps-lock hint, no OTP box group, no resend timer | Auth field set (§8.3) |
| A-07 | P1 | Errors render as a loose `<p>` with no `role="alert"` and no association to a field | Error summary + `Field` binding |
| A-08 | P2 | No lockout/throttle messaging — a rate-limited user sees a generic failure | Distinct state |

### Performance (P)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| P-01 | P1 | Dashboard: 3 sequential waves (11 → `vaccines` → `actors`) | Fold into one wave |
| P-02 | P1 | No `<Suspense>` anywhere — every page blocks on its slowest query before first byte | Zone components + skeletons |
| P-03 | P1 | `children/page.tsx` pulls the **entire `schedules` table** to compute per-child coverage in JS | `v_child_coverage` view |
| P-04 | P2 | `notifications/page.tsx` reads every row to count 4 statuses | `count: 'exact', head: true` ×4 |
| P-05 | P2 | `force-dynamic` on all 30 routes; coverage/dropout/daily views don't change per second | `revalidate` on analytical screens |
| P-06 | P2 | `Noto_Sans_Bengali` loaded with no `weight` and no `display` → full variable axis | `weight: ["400","500","600"]`, `display:"swap"` |

### Blind spots (B)

| ID | Finding | Recommendation |
|---|---|---|
| B-01 | **No skip-to-content link.** Keyboard users traverse 24 nav links on every page | `<a href="#main" class="skip-link">` |
| B-02 | **PII is unmasked everywhere.** Guardian phone numbers render in full in tables and CSV exports, with no masking and no export warning — in a system holding children's health records | Mask by default, reveal on demand, confirm on export |
| B-03 | **Nothing indicates staleness.** Only the dashboard prints a timestamp; no screen has a refresh affordance | Shared "last updated · ↻" control |
| B-04 | **No offline state.** A rural EPI office losing connectivity mid-session gets a Next.js error boundary | Connection banner |
| B-05 | **Bengali typography is untuned** — default leading clips the matra on stacked conjuncts; `text-xs` meta is under the legible floor | 1.6 leading, 13px minimum |
| B-06 | **Two authorization APIs.** 19 screens on `requireRole`, 14 on `requireAppRole` + `mfaGate`. The legacy 19 are not MFA-gated — a security inconsistency wearing a refactor's clothes | Converge on `requireAppRole`; audit which screens genuinely need MFA |
| B-07 | **Removing the audit screen removes the only visible compliance surface.** The trail and triggers survive but nothing on screen points at them | Keep the dashboard activity feed (§7) |
| B-08 | **Cross-role import leak.** The worker shell imports `AccountMenu` from `(admin)/admin/_components/` | Move shared shell components to `src/components/` |

---

## 3. Information architecture

The existing 4-group split is sound and stays. One change: **প্রশাসন holds 9 of 24 items — twice any other group.** It mixes reference data an officer edits monthly with guard rails a security owner touches rarely. Splitting it gives 5 groups of 5/5/5/5/4 and puts the audit-adjacent items together.

```
VaxTrace Admin
│
├─ ড্যাশবোর্ড                    /admin
│
├─ পরিষেবা · Service            a named child or family in front of me
│  শিশু · অভিভাবক · ফলো-আপ বোর্ড · শূন্য-ডোজ শিশু · সম্ভাব্য ডুপ্লিকেট
│
├─ কর্মসূচি · Programme          how is the programme doing, and where
│  এলাকাভিত্তিক কভারেজ · টিকাদান সেশন · রিপোর্ট · টিকা-পরবর্তী ঘটনা · তথ্যের মান
│
├─ সরবরাহ · Supply              is there vaccine, is it cold, is it in date
│  টিকা মজুদ · স্টক লেজার · চাহিদাপত্র · কোল্ড চেইন · টিকা তালিকা
│
├─ রেফারেন্স · Reference        the data a coverage number needs to mean anything
│  প্রশাসনিক এলাকা · সেবা কেন্দ্র · জনসংখ্যার হিসাব · বিজ্ঞপ্তি
│
└─ প্রশাসন · Administration     the guard rails
   ব্যবহারকারী · জরুরি প্রবেশাধিকার · সেটিংস · সহায়িকা

Removed:  /admin/audit → redirect to /admin  (§7)
```

**Depth: 3 levels maximum** — group → destination → detail.

**Breadcrumb contract**, route-derived, rendered by the topbar, never hand-written:

| Route | Breadcrumb |
|---|---|
| `/admin` | ড্যাশবোর্ড |
| `/admin/children` | পরিষেবা › শিশু |
| `/admin/children/[id]` | পরিষেবা › শিশু › {name} |
| `/admin/inventory/[id]` | সরবরাহ › টিকা মজুদ › {batch} |
| `/admin/users/[id]` | প্রশাসন › ব্যবহারকারী › {name} |

---

## 4. Design system

### 4.1 Colour

Dark is designed first (the admin default). The canvas `#0d1117` is kept — it was already chosen deliberately — and the ramp is built above it. Every ratio below is computed.

**Dark**

| Token | Value | Role | Contrast |
|---|---|---|---|
| `--canvas` | `#0d1117` | App background | — (unchanged) |
| `--surface` | `#161b22` | Cards, panels, sidebar | elevation step |
| `--surface-raised` | `#21262d` | Table header, popover, modal, hover | — |
| `--border-subtle` | `#21262d` | Hairlines inside a surface | decorative |
| `--border-default` | `#30363d` | Card edge, paired with the fill | decorative (unchanged) |
| `--border-strong` | `#6e7681` | **Input & control borders** | **3.77:1** on surface ✅ |
| `--text-primary` | `#e6edf3` | Headings, values | 14.6:1 ✅ (was 18.1 — halation) |
| `--text-secondary` | `#9ba8b8` | Body, table cells | 7.2:1 ✅ |
| `--text-muted` | `#7b8a9c` | Meta, hints, placeholders | 4.9:1 ✅ |
| `--accent` | `#14b8a6` | Brand, links, active | 6.9:1 ✅ |
| `--accent-hover` | `#2dd4bf` | Hover only (the old value) | — |
| `--accent-fg` | `#0d1117` | Text on accent fill | 7.6:1 ✅ |
| `--danger` / `--warning` / `--success` | `#f87171` / `#fbbf24` / `#4ade80` | unchanged | 6.9 / 11.4 / 10.9 ✅ |
| `--focus` | `#60a5fa` | Focus ring — deliberately **not** the accent | — |

**Light** — same structure; the AA-verified hues are kept exactly.

| Token | Value | Note |
|---|---|---|
| `--canvas` | `#f6f8fa` | No longer pure white, so a white card reads as elevated |
| `--surface` / `--surface-raised` | `#ffffff` / `#ffffff` + `--shadow-2` | |
| `--border-subtle` / `--border-default` | `#eaeef2` / `#d0d7de` | decorative |
| `--border-strong` | `#8a94a3` | **3.07:1** on white ✅ |
| `--text-primary/secondary/muted` | `#0f172a` / `#3f4c5f` / `#5b6779` | 17.4 / 9.1 / 5.6 ✅ |
| `--accent` / `--accent-fg` | `#0f766e` / `#ffffff` | 4.83:1 — unchanged |
| `--danger/warning/success` | `#dc2626` / `#b45309` / `#15803d` | unchanged |
| `--focus` | `#2563eb` | |

**Derived fills** — one line each, so a tone change cannot strand its badge background:

```css
--danger-bg:  color-mix(in oklab, var(--danger)  14%, var(--surface));
--warning-bg: color-mix(in oklab, var(--warning) 14%, var(--surface));
--success-bg: color-mix(in oklab, var(--success) 14%, var(--surface));
--accent-bg:  color-mix(in oklab, var(--accent)  14%, var(--surface));
--muted-bg:   color-mix(in oklab, var(--text-muted) 14%, var(--surface));
```

**`color-scheme` is mandatory on each scope** — this is the single fix for D-02 and all 17 native controls.

**Compatibility:** `--color-bg`, `--color-fg`, `--color-primary`, `--color-primary-fg`, `--color-muted`, `--color-border`, `--color-danger`, `--color-warning`, `--color-success` stay as aliases. ~400 existing call sites keep working; migration is opportunistic, not a blocking rewrite.

### 4.2 Typography

| Token | Size / Line | Weight | Use |
|---|---|---|---|
| display | 30 / 38 | 600 | Auth brand |
| h1 | 24 / 32 | 600 | Page title |
| h2 | 18 / 28 | 600 | Section |
| h3 | 16 / 24 | 600 | Card title |
| body | 14 / 22 | 400 | Default, table cells |
| label | 13 / 20 | 500 | Field labels, chips |
| caption | 12 / 18 | 400 | **Latin/numeric only** |
| metric | 32 / 40 | 600 | KPI values, `tabular-nums` |
| mono | 13 / 20 | 400 | IDs, batch numbers, codes |

**13px is the floor for Bengali.** `text-[10px]` and `text-xs` on Bengali prose are banned. Body leading 1.6 for matra clearance. `tabular-nums` on every numeric column.

### 4.3 Spacing, breakpoints, z-index

4px base: `--space-1..10` = 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.

Page padding 16/24/32 · section gap 32 · card padding 20 · card internal gap 16 · table cell 12×16 · form field gap 16 · inline gap 8 · max content 1440 centred · **min touch target 44×44**.

| BP | Shell | Tables | Grid |
|---|---|---|---|
| <768 | Drawer | Cards | 1 col |
| ≥768 `md` | Drawer | Table + scroll | 2 col |
| ≥1024 `lg` | Sidebar 256 | Table | 3 col |
| ≥1280 `xl` | Sidebar 256 | Table | 4 col |

Z-index ladder: `sticky 10` · `topbar 20` · `dropdown 30` · `overlay 40` · `modal 50` · `toast 60`.

### 4.4 Radius, elevation, motion

Radius: `sm 6` (badge, chip, input) · `md 8` (button, select) · `lg 12` (card) · `xl 16` (modal, drawer) · `full`.

Elevation — **dark lifts with surface, light lifts with shadow** (shadows are invisible on dark):

| Level | Dark | Light |
|---|---|---|
| 0 flat | `--surface` + `--border-default` | `--surface` + `--border-subtle` |
| 1 raised | `--surface-raised` + `--border-default` | `0 1px 2px rgb(16 24 40/.06), 0 1px 3px rgb(16 24 40/.10)` |
| 2 overlay | `0 0 0 1px --border-strong, 0 16px 32px rgb(0 0 0/.6)` | `0 4px 6px -2px rgb(16 24 40/.03), 0 12px 16px -4px rgb(16 24 40/.08)` |

Motion: `--dur-fast 120ms` · `--dur-base 180ms` · `--dur-slow 240ms` · `--ease cubic-bezier(.2,0,0,1)`, all disabled under `prefers-reduced-motion`.

### 4.5 Icons

20px, 1.5px stroke, `currentColor`, `aria-hidden` unless the icon is the only label. One module, inline SVG — 28 icons is smaller than any icon package. Replaces `☰`, the `→`/`←` text arrows and the two SVGs in `ThemeToggle`. One per nav destination.

### 4.6 Focus

```css
:where(a, button, input, select, textarea, summary, [tabindex]):focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
  border-radius: inherit;
}
```

Blue in both themes so it never vanishes against a teal accent surface. `:where()` keeps specificity at zero so a component can override. Scroll containers get `scroll-padding` so the offset ring is not clipped at the edge.

### 4.7 Charts

Keep the dependency-free CSS/SVG approach — correct, and already shared.

- **Categorical:** `#14b8a6`, `#60a5fa`, `#a78bfa`, `#fbbf24`, `#f472b6`, `#34d399` — all ≥3:1 on both surfaces.
- **Coverage** keeps the semantic diverging scale, plus **a dashed 80% target line** — a coverage bar with no target is a number without a verdict.
- **Every chart needs** an axis or labelled max, a hover value, and an `sr-only` data table carrying the same numbers.
- **Daily-dose chart:** `flex-1` bars collapse past ~40 points, which a 90-day scope always is → area chart with a labelled max.
- **Never encode by colour alone.**

### 4.8 Component specification

| Component | Spec |
|---|---|
| **Button** *(new)* | `primary`/`secondary`/`ghost`/`danger` × `sm 32`/`md 40`/`lg 44`; hover, active, focus, disabled, loading (spinner + `aria-busy`, **label preserved** — swapping it reflows mid-click); optional icons; `href` renders a `<Link>` with identical visuals. Icon-only requires `aria-label`. |
| **Field** *(new)* | Owns `<label>` + control + hint + error. Generates the `id`, wires `aria-describedby`, sets `aria-invalid`, renders the required marker. Every input goes through it. |
| **Toast** *(new)* | `role="status"`, `aria-live="polite"`, 5s dismiss. Server actions return `ActionResult`; `ActionToast` bridges `useActionState` to the region. |
| **Callout** *(new)* | Inline info/warning/danger block with icon and optional action. |
| **Sparkline** *(new)* | Inline SVG polyline, `aria-hidden` — the delta chip carries the meaning. |
| **StatCard** *(extend)* | Add `delta` (value, direction, **`goodDirection`** — falling missed-doses is good, falling coverage is not) and `sparkline`. |
| **StatusBadge** *(extend)* | Tinted fill + tone text + 35%-alpha border. Replaces the outline-only chip. |
| **DataTable** *(extend)* | Add sortable headers (`aria-sort`), sticky header, row hover, URL-synced state (`?q=&filter=&sort=&page=`), `aria-live` result count. Keeps search, filters, pagination, card fallback. |
| **PageHeader** *(extend)* | Add a `meta` slot for the timestamp line. |
| **EmptyState** *(extend)* | Add an icon and a `variant` distinguishing "nothing exists" from "no results". |
| **Skeleton** *(new)* | `SkeletonText/Card/Table` composed into per-route `loading.tsx`. |
| **Card / GroupCard / GroupRow** *(promote)* | Lift the local helpers out of settings and child-detail. |

---

## 5. Navigation redesign

### 5.1 Sidebar

```
┌─ 256px ──────────────────────┐   collapsed: 64px rail, persisted, [ toggles
│ ◈ VaxTrace                   │
│   অ্যাডমিন প্যানেল            │
├──────────────────────────────┤
│ ▌◉ ড্যাশবোর্ড                │  active: --accent-bg + 2px left accent rail
│                              │
│ পরিষেবা                       │  group label 11/600 --text-muted
│   ◎ শিশু              ২৪    │  count: doses due
│   ◎ অভিভাবক                  │
│   ◎ ফলো-আপ বোর্ড       ৭    │  count: defaulters with no open task
│   ◎ শূন্য-ডোজ শিশু      ৩    │
│   ◎ সম্ভাব্য ডুপ্লিকেট        │
│ কর্মসূচি … সরবরাহ … রেফারেন্স … প্রশাসন
├──────────────────────────────┤
│ ADM-0001 · অ্যাডমিন      [«] │
└──────────────────────────────┘
```

`--surface` against the `--canvas` main, so the rail reads as its own plane. Item height 40, icon 20, gap 12. **Active is a tint plus a rail, never a solid accent fill** (N-06) — solid accent stays reserved for CTAs. Counts carry `sr-only` text ("শিশু, ২৪টি দেয় ডোজ"). In rail mode labels become tooltips and group labels become dividers.

Below `lg`: off-canvas `<dialog>` drawer — platform focus trap, `Escape`, backdrop, `aria-modal` (N-07).

### 5.2 Topbar — 56px, sticky, `backdrop-blur`

```
[☰] পরিষেবা › শিশু › রফিকুল ইসলাম   [🔍 খুঁজুন… ⌘K] [গত ৩০ দিন ▾] [🔔৭] [☾] [◉]
```

- **Breadcrumb** route-derived; detail pages contribute the record name via `<SetBreadcrumb>` (the layout never sees the dynamic segment).
- **⌘K palette**: any destination, any child by name or ID in either numeral script (`fromBn()` already normalises), plus quick actions.
- **Date scope**: 7/30/90/365 → `?range=`, read by Dashboard, Reports and Coverage. No screen can be scoped today.
- **Bell** → open alert count.
- **Skip link** as the first focusable element (B-01).

### 5.3 Keyboard

`⌘K`/`Ctrl+K` palette · `/` focus page search · `[` collapse sidebar · `Escape` close topmost overlay · tab order skip-link → sidebar → topbar → main.

---

## 6. Dashboard redesign

Today: **9 identical KPI cards** with no comparison on any of them, open AEFI cases below the fold, 13 queries in 3 blocking waves.

```
┌ PageHeader — title · scope · হালনাগাদ timestamp · quick actions ────────┐

┌ ১ · ALERT RAIL — only when non-empty, severity-ordered ────────────────┐
│ ⚠ তদন্তে বিলম্বিত AEFI · ২টি        [কেস দেখুন →]      danger          │
│ ⚠ কোল্ড চেইন সতর্কতা · ৩টি          [ডিভাইস দেখুন →]   danger          │
│ ⚠ মেয়াদোত্তীর্ণ ব্যাচ · ২টি          [মজুদ দেখুন →]     danger          │
│ ⚠ ফলো-আপ বরাদ্দ হয়নি · ৭টি         [বোর্ড দেখুন →]     warning         │

┌ ২ · KPI ROW — 4 cards, delta + sparkline ─────────────────────────────┐
│ প্রদত্ত ডোজ   বাদ পড়া ডোজ   দেয় ডোজ (এখন)   নিবন্ধিত শিশু            │
│    ২৪৭          ১৪২            ৩১৮             ৩,২৪৮                 │
│  ▲১২ (৫%)     ▼৮ (৫%)      [sparkline]     ▲১২৮ নতুন                │

┌ ৩ · TRENDS — coverage bars w/ 80% target │ daily-dose area, 12 wk ────┐

┌ ৪ · ACT-NOW QUEUES — 3 columns, inline action per row ────────────────┐
│ মজুদ সতর্কতা      │ বাদ পড়া — যোগাযোগ  │ বিজ্ঞপ্তি ব্যর্থতা          │
│ [পুনঃমজুদ]        │ [রেকর্ড]            │ [পুনরায় পাঠান]            │

┌ ৫ · সাম্প্রতিক কার্যক্রম — compact timeline, 8 rows, no link out (§7) ──┐
```

**Decisions**

- **9 KPIs → 4.** The other five are *alerts*, not indicators — untraced follow-ups, zero-dose, stock, cold-chain and AEFI all mean "someone must act", which is what zone 1 and zone 4 are for. Dropout and average coverage move to Reports, where the denominator is visible.
- **Deltas are the point.** A KPI without a comparison is a dead number. Three of the four compare against the equal-length prior window. **`দেয় ডোজ` deliberately carries no delta** — it is a stock, not a flow, and there is no history table to reconstruct what it was 30 days ago; inventing an arrow would make it a guess. It gets a sparkline of doses falling due per day instead, which is derivable and answers the same question.
- **AEFI moves above the KPIs**, filtered to `investigation_overdue` for the rail.
- **Queues replace counts** — the reader's next question after any number is "which ones?"
- **Streaming.** Each zone is an async server component in its own `<Suspense>`, so the alert rail paints without waiting on the coverage view.

---

## 7. Removing the audit-log screen

**Delete:** `audit/page.tsx`, `audit/_components/AuditTable.tsx`, `audit/export/route.ts`, the nav entry, the dashboard "সম্পূর্ণ অডিট লগ →" link, the `/admin/audit` assertion in `tests/admin.test.tsx`.

**Keep:** `_audit.ts` (`auditLabel` is also used by `/account`), the `audit_log` table and its triggers, the Settings row reporting them, and the dashboard activity feed minus its link out.

**Add:** `/admin/audit` → `/admin` redirect, mirroring the `analytics` pattern, so bookmarks don't 404.

> **Flagged for your call (B-07):** the request removes the *screen*. Keeping the dashboard feed preserves an on-screen answer to "who changed this", which a defense panel will ask. If you want it gone too, it is one `<section>` and one query.

---

## 8. Authentication redesign

### 8.1 Flow

`/` (brand + entry paths) → `/sign-in?role=…` → destination. **Three steps become two** (A-04).

### 8.2 Shell

```
┌───────────────────────────┬───────────────────────────┐
│ BRAND (46%, ≥lg)          │ FORM                      │
│ gradient #0f766e→#0d1117  │ --canvas                  │
│ ◈ ভ্যাক্সট্রেস              │      লগইন করুন             │
│ শিশুদের টিকাদান             │   [ID/পাসওয়ার্ড | ওটিপি]   │
│ ট্র্যাকিং সিস্টেম            │   ইমেইল    [         ]    │
│ ✓ ১০-সংখ্যার স্থায়ী আইডি    │   পাসওয়ার্ড [       👁 ]   │
│ ✓ স্বয়ংক্রিয় টিকার সূচি     │   [ লগইন করুন ]            │
│ ✓ রিমাইন্ডার ও কভারেজ       │                           │
│ সম্প্রসারিত টিকাদান কর্মসূচি │  [☾]                      │
└───────────────────────────┴───────────────────────────┘
   <lg: brand collapses to a band above the form
```

Fixes A-01 and A-02 — the shell follows the same `data-theme` as everything else once it is hoisted.

### 8.3 Form quality

Real `tablist`/`tab`/`tabpanel` with arrow keys (A-05) · `autocomplete` on every field (`username`, `current-password`, `new-password`, `one-time-code`, `tel`) · password reveal with `aria-pressed` · caps-lock hint · 6-box OTP with `inputmode="numeric"`, paste-across and a 60s resend countdown · error summary with `role="alert"` plus per-field `aria-invalid`/`aria-describedby` (A-07) · distinct throttle copy (A-08) · 44px targets · button spinner with the label preserved.

### 8.4 Theme hoist (A-02, A-03) — do this first, it unblocks everything

1. `data-theme` moves from `#admin-root` to `<html>`.
2. Blocking inline script in `<head>` reads `localStorage['vt-theme']` before paint.
3. `ThemeToggle` writes `document.documentElement.dataset.theme`; the `useEffect` goes.
4. `suppressHydrationWarning` on `<html>`.

Result: no flash, one theme across admin/auth/worker/account, and `color-scheme` finally has a scope.

---

## 9. Roadmap

| Phase | Scope | Status |
|---|---|---|
| **0 · Foundation** | Token layer, theme hoist, `color-scheme`, focus, 43 icons, Button/Field/Card/Toast/Callout/Skeleton/ConfirmDialog, `StatusBadge` fill, `StatCard` delta, audit screen removed | ✅ `9f96389` |
| **1 · Shell** | 5-group sidebar + icons + counts + CSS rail + `<dialog>` drawer, topbar + breadcrumbs + ⌘K + date scope, skip link, `not-found.tsx` | ✅ `9f96389` |
| **2 · Dashboard** | `_queries.ts`, alert rail, 9 KPIs → 4 with deltas, trends with target line, 3 queues, `<Suspense>` zones | ✅ `9f96389` |
| **3 · Auth** | Split brand shell, merged landing, tablist / autocomplete / reveal / caps-lock / 6-box OTP / bound errors | ✅ `9f96389` |
| **4 · Adoption sweep** | Kit moved out of `(admin)`, 56 `text-black` hacks removed, last 4 `window.confirm` replaced, 30 route titles, 4 breadcrumb tails, children/catalog/inventory on `PageHeader` | 🟡 partial — `9328729` |
| **5 · Hardening** | `v_child_coverage`, notification counts, `revalidate`, PII masking, converge the two auth APIs, axe + screen-reader pass | ⬜ not started |

### Remaining work, in priority order

1. **17 hand-rolled `<table>` blocks → `DataTable`** (S-05). The largest single item and the one with the most user-visible payoff: each migration gains search, filters, pagination and the mobile card fallback at once. `break-glass`, `cold-chain`, `coverage`, `data-quality`, `locations`, `population`, `reports` ×2, `stock`, `users/[id]`, `children/[id]`.
2. **17 remaining screens → `PageHeader`** (S-04). Mechanical; children, catalog and inventory are done as the pattern.
3. **`Field` in every form** (C-02). The primitive exists and sign-in / sign-up / verify use it; the ~15 admin forms still write bare `<label><input>`.
4. **`DataTable` sort + `aria-live` + URL state** (C-05, C-10).
5. **Per-route `loading.tsx`** (S-12).
6. **Phase 5 in full** — including B-06, the two authorization APIs, which is a security question and not a styling one.

**Cut order:** 5 → 4 → dashboard sparklines → auth brand panel. **Never cut Phase 0** — everything else depends on the token layer, and building Phase 2 on the current tokens means building it twice.

---

## 10. Micro-level implementation plan

### Phase 0 — Foundation

| # | File | Action |
|---|---|---|
| 0.1 | `packages/ui-tokens/tokens.css` | Rewrite per §4.1: surfaces, borders, text, accent, semantics, focus, `color-scheme` per scope, `color-mix` fills, spacing/radius/shadow/motion/z/chart tokens. Keep `--color-*` aliases. Declare derived tokens on `:root, [data-theme]` — a custom property referencing another resolves in the scope it is *declared* in, so `:root`-only would strand a `<div data-theme="dark">` subtree on light values. |
| 0.2 | `apps/web/src/app/globals.css` | `@theme inline` maps the new tokens; scoped `:focus-visible` on `--focus`; `prefers-reduced-motion`; `.sr-only` + `.skip-link`; keep the existing print block, retargeting tokens instead of `!important`-stripping colour. |
| 0.3 | `apps/web/src/app/layout.tsx` | `data-theme` + `suppressHydrationWarning` on `<html>`; blocking theme script; font `weight: ["400","500","600"]`, `display:"swap"`; `title.template`. |
| 0.4 | `_components/ThemeToggle.tsx` | Target `documentElement`, key `vt-theme`, drop the `useEffect`. |
| 0.5 | **new** `src/components/icons.tsx` | 28 inline SVGs (§4.5). |
| 0.6 | **new** `src/components/ui/Button.tsx` | §4.8. |
| 0.7 | **new** `src/components/ui/Field.tsx` | Label + control + hint + error + ARIA; `controlClass` export. |
| 0.8 | **new** `src/components/ui/Toast.tsx` | Provider + `useToast` + `ActionToast` + `ActionResult`. |
| 0.9 | **new** `src/components/ui/Card.tsx`, `Skeleton.tsx`, `_components/Callout.tsx`, `_components/Sparkline.tsx` | §4.8. |
| 0.10 | `_components/ui.tsx` | `StatusBadge` → tinted fill; `StatCard` → `delta` + `sparkline`; `SubmitButton` → `Button` wrapper (keep `name`/`value` passthrough); `PageHeader` → `meta` slot; `EmptyState` → icon + variant. |
| 0.11 | 14 files | Replace hand-copied primary-button classes with `<Button>`. |
| 0.12 | audit removal | Delete 3 files, nav entry, dashboard link; add redirect; update `tests/admin.test.tsx`. |
| 0.13 | 5 files | `bg-[var(--color-border)]/40` → `bg-[var(--surface-raised)]`. |

### Phase 1 — Shell

| # | File | Action |
|---|---|---|
| 1.1 | `_components/AdminNav.tsx` | 4 groups → 5 (§3); add `icon` and optional `count` per item; active = tint + rail. |
| 1.2 | **new** `_components/Sidebar.tsx` | 256 ↔ 64 rail, `localStorage`, `[` shortcut, tooltips, identity footer, sticky with own scroll. |
| 1.3 | **new** `_components/MobileDrawer.tsx` | `<dialog>` replacing the dropdown (N-07). |
| 1.4 | **new** `_components/Topbar.tsx`, `Breadcrumbs.tsx`, `CommandPalette.tsx`, `DateScope.tsx` | §5.2. |
| 1.5 | `_components/AccountMenu.tsx` | Real semantics, `Escape`, outside-click and focus-out, focus return. |
| 1.6 | `admin/_actions.ts` | `searchChildrenAction` for the palette — **sanitise the input before `.or()`**: PostgREST's filter grammar treats `,` `.` `(` `)` `*` as operators, so raw input would let a search box rewrite the query. |
| 1.7 | `admin/layout.tsx` | Compose Sidebar + Topbar + Toast + Breadcrumb provider; skip link; `<main id="main">`; one `Promise.all` for the 5 nav counts. |
| 1.8 | **new** `admin/not-found.tsx` | Themed 404 inside the shell (S-11). |
| 1.9 | 30 pages | `export const metadata = { title }` (S-10). |

### Phase 2 — Dashboard

| # | File | Action |
|---|---|---|
| 2.1 | **new** `admin/_queries.ts` | All dashboard access; one wave; window + prior-window helpers; per-day zero-filled series. |
| 2.2 | **new** `_components/dashboard.tsx` | `AlertRail`, `KpiRow`, `Trends`, `Queues`, `ActivityFeed` + skeletons. |
| 2.3 | **new** `_components/QueueCard.tsx` | Rows + inline action + "সব দেখুন →". |
| 2.4 | `_components/Chart.tsx` | 80% target line on `CoverageBars`; new `TrendArea` with gridlines and an `sr-only` data table. |
| 2.5 | `admin/page.tsx` | Rebuild per §6; keep the zero-children empty state, restyled. |
| 2.6 | `admin/loading.tsx` | Dashboard-shaped. |

### Phase 3 — Auth

| # | File | Action |
|---|---|---|
| 3.1 | **new** `(auth)/layout.tsx` | Split brand shell (§8.2). |
| 3.2 | `app/page.tsx` → `(auth)/page.tsx` | Merge landing + role; `/role` becomes a redirect; update `tests/home.test.tsx`. |
| 3.3 | `sign-in/_components/SignInForm.tsx` | Tablist, `Field`, autocomplete, reveal, caps-lock, error summary. |
| 3.4 | `verify/_components/VerifyOtpForm.tsx` | 6-box OTP, paste, auto-advance, resend timer. |
| 3.5 | `sign-up/_components/SignUpForm.tsx` | `Field` migration, strength meter. |
| 3.6 | `(auth)/*/actions.ts` | Distinguish throttle from bad credentials. |

### Phase 4 — Adoption sweep

Per screen: `PageHeader`, `DataTable` where a table is hand-rolled, `EmptyState`, `Field` in every form, `metadata`, route `loading.tsx`.

`children` · `children/[id]` · `children/new` · `guardians` · `inventory` · `inventory/[id]` · `inventory/new` · `catalog` · `catalog/[id]` · `catalog/new` · `users` · `users/[id]` · `notifications` · `settings` · `reports` · `locations` · `facilities` · `population` · `data-quality` · `break-glass`

Plus: `DataTable` sort + `aria-live`; the 4 remaining `window.confirm` → `ConfirmButton`; `children` status filter chips (S-07); `settings` split (S-09); `reports` picker + scope (S-08); worker shell imports from `src/components/` (B-08).

### Phase 5 — Hardening

`v_child_coverage` view (P-03) · notification counts by `head:true` (P-04) · `revalidate` on analytical routes (P-05) · PII masking + export confirm (B-02) · converge `requireRole` → `requireAppRole`, decide MFA per screen (B-06) · staleness control (B-03) · axe clean on all routes · keyboard-only pass · NVDA on dashboard, sign-in and one form.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Token rewrite breaks ~400 `var(--color-*)` sites | Aliases in the same file; migration is opportunistic |
| Theme hoist causes hydration mismatch | `suppressHydrationWarning` + blocking script before paint |
| Dashboard `<Suspense>` split changes query semantics | Move queries unchanged first, split second — two commits |
| Audit removal weakens the compliance story | Trail, triggers, Settings row and dashboard feed all retained |
| Phase 4 touches 20 screens | Mechanical and per-screen; each is independently shippable and revertible |
| Two auth APIs converged carelessly could drop an MFA gate | Phase 5, explicit per-screen decision, not a find-and-replace |

**Gate after every phase:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, both themes at 360/768/1440, keyboard traversal of every route touched, no new console errors.

---

## 12. Acceptance criteria

**Design system**
- [ ] Zero raw hex, zero `text-[10px]`, zero `/40` opacity hacks in the admin tree
- [ ] WCAG 2.2 AA in both themes: 4.5:1 text, 3:1 controls and borders
- [ ] `color-scheme` set; every native select, date picker and spinner matches the theme
- [ ] The primary button style exists in exactly one file
- [ ] `aria-invalid` and `aria-describedby` present on every field with an error

**Navigation**
- [ ] 23 destinations in 5 groups, each with an icon; 5 carry live counts
- [ ] Breadcrumbs on every route; no page writes its own back-link
- [ ] ⌘K reaches any destination and any child by ID in either numeral script
- [ ] Full keyboard traversal with a visible ring; drawer and dialogs trap focus and close on `Escape`

**Dashboard**
- [ ] 4 KPIs; three carry a period comparison, the fourth states why it does not
- [ ] Alerts above the fold, only when non-empty
- [ ] Every queue row has an inline action; zones stream independently

**Auth**
- [ ] Branded, theme-aware, no flash on load; two steps to a focused input
- [ ] Every field labelled, autocompleted, and its error announced

**System-wide**
- [ ] Every mutation produces a visible, announced confirmation; no `window.confirm`
- [ ] `PageHeader` on every screen; no hand-rolled `<table>` outside `DataTable`
- [ ] Distinct empty and no-results states on every list
- [ ] Per-route tab titles; themed 404 inside the shell
- [ ] Every route usable at 360px with no horizontal page scroll
- [ ] Audit screen removed; DB trail and dashboard feed intact
- [ ] `pnpm typecheck && lint && test && build` green
