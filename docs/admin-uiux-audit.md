# VaxTrace — Admin Role UI/UX Audit & Production Implementation Plan

**Date:** 2026-07-24 · **Target demo:** 2026-08-03 · **Scope:** Admin role only
**Figma:** `S1n9q5mqPNEzIks9FgUx0E`, page `79:2` (Screens · Admin · বাংলা)
**Sources of truth reconciled:** Figma (8 designed frames + 9-item sidebar), current Next.js implementation (6 routes), `TODO.md` (D1–D8), Engineering Handbook §7.1/§8.

---

## 0. Screen-count reconciliation (the "9 screens" question)

The request says "9 Admin screens." The Figma file actually contains **8 designed screen frames** (ADM-01…ADM-08, each in Light + Dark = 16 frames — dump verified complete, ends at `</canvas>`). The **"9" is the sidebar**, which lists **9 navigation destinations**. One of them — **শিশু / Children** — is a nav entry with **no dedicated frame drawn**.

| # | Sidebar label (BN) | Meaning | Figma frame | Impl route (before today) |
|---|---|---|---|---|
| 1 | ড্যাশবোর্ড | Dashboard | ADM-01 (`79:3`) | `/admin` ✅ |
| 2 | শিশু | Children registry | **none (nav stub)** | **missing** → **built today `/admin/children`** ✅ |
| 3 | ব্যবহারকারী ও ভূমিকা | Users & Roles | ADM-02 (`79:427`) | `/admin/users` ⚠️ partial |
| 4 | টিকা | Vaccine catalog | ADM-03 (`79:859`) | `/admin/catalog` ✅ |
| 5 | মজুদ | Inventory | ADM-04 (`79:1207`) | `/admin/inventory` ⚠️ partial |
| 6 | রিপোর্ট | Reports | ADM-05 (`79:1599`) | `/admin/reports` ⚠️ partial |
| 7 | অডিট লগ | Audit log | ADM-06 (`79:1883`) | **missing** (widget only on dashboard) |
| 8 | বিজ্ঞপ্তি ও জব | Notifications & cron | ADM-07 (`79:2255`) | **missing** |
| 9 | সেটিংস | System settings | ADM-08 (`79:2609`) | **missing** |

Plus an **impl-only** route with no Figma nav entry: `/admin/analytics` (বিশ্লেষণ) — Figma folds analytics into Reports as report-cards + a coverage-trend chart.

**Net:** implementation had **6 of 9** destinations; **today's build adds Children → 7 of 9**. Still missing: **Audit log, Notifications & jobs, Settings** (3 screens).

---

## 1. Screen-by-screen audit

### ADM-01 · Dashboard (`/admin`)
**Figma:** 4 KPI cards *with delta indicators* (কভারেজ হার 87.4% ▲2.1%, মিসড ডোজ 142 ▼8%, সক্রিয় শিশু 3,248 ▲128, এই সপ্তাহের ডোজ 512 ▲5%); a **monthly coverage bar chart** (Jan–Aug); a **dose-status doughnut** (হালনাগাদ/নির্ধারিত/শীঘ্রই দেয়/বিলম্বিত); a **stock-alert panel** (3 items with per-row "পুনঃমজুদ/Restock" CTAs); a **recent-activity feed** (avatar + actor + relative time). Top bar: **date-range picker** ("গত ৩০ দিন"), **theme toggle**, avatar.

**Impl:** 4 KPI cards (coverage, dropout, low-stock count, users count) — **no deltas**; recent-activity **table** (8 audit rows, no avatars); **no charts**, **no stock-alert panel with CTAs**, **no date-range filter**, **no top bar**.

**Gaps / blind spots**
- KPI **metric drift**: impl tracks *dropout* and *user count*; Figma tracks *missed doses* and *active children*. Pick one canonical set. Recommend Figma's (they're the ones a program officer reads); keep dropout on the Reports/Analytics screen.
- No trend deltas → the KPI is a dead number, no "is it improving?" signal.
- No charts → the dashboard's whole visual identity is missing. `analytics/page.tsx` already renders CSS bars (no chart dep) — promote that primitive here.
- Stock alerts exist only as a raw low-stock *count*; Figma surfaces the actual batches with restock actions. Actionability lost.
- Recent-activity is a table, not a feed; readable but off-design and no avatars.

### ADM-02 · Users & Roles (`/admin/users`)
**Figma:** search box, **role filter** dropdown, **"+ আমন্ত্রণ / Invite"** button, table = avatar+name / email / **role pill** (কর্মী/অ্যাডমিন/অভিভাবক) / **center** / **status pill** (সক্রিয়/আমন্ত্রিত/নিষ্ক্রিয়) / **last active** / **"…" row menu**.
**Impl:** table = name / contact / **inline role `<select>`**. No search, no filter, no invite, no status, no center, no last-active, no row menu.

**Gaps / blind spots**
- **No invite flow** — you cannot onboard a worker/admin from the UI at all (biggest functional hole).
- No status lifecycle (invited/active/inactive) → can't see pending invites or deactivate a user.
- Inline `<select>` role change has **no confirmation** — a mis-click silently promotes someone to admin. Security-sensitive; must be a confirm dialog (see §4).
- No `center` column though the domain is facility-based (Handbook mentions EPI centers).
- No search/pagination → breaks past ~50 users.

### ADM-03 · Vaccine catalog (`/admin/catalog`)
**Figma:** search, **"+ টিকা যোগ / Add vaccine"**, table = vaccine (name + subtitle) / total doses / recommended-age / **সম্পাদনা edit**.
**Impl:** list + `/new` + `/[id]` edit with `VaccineForm` + `DosesForm`. **Closest to parity.**

**Gaps:** no search box; no active/inactive toggle surfaced (`vaccines.is_active` exists in schema but isn't shown); "add" lives on a separate page vs Figma's inline affordance (acceptable).

### ADM-04 · Inventory (`/admin/inventory`)
**Figma:** search, **status filter** dropdown, **"+ মজুদ যোগ / Add stock"**, table = vaccine+batch / stock / expiry / **status pill** (কম/মেয়াদ ঘনিয়ে/সুস্থ/মজুদ নেই) / **"…" menu**.
**Impl:** table = vaccine / batch / stock / expiry / status pill / **edit link**; `/[id]` batch detail with `BatchForms`. Has empty state. `batchStatus()` computes tone/label.

**Gaps / blind spots**
- No search, no status filter, no "add stock" entry point (add only reachable by editing an existing batch? verify — there's no "new batch" route).
- Terminology drift risk: keep the four status labels in one registry shared with Worker (Handbook audit flagged সুস্থ vs পর্যাপ্ত across roles).
- "মজুদ নেই / 0 stock" and "মেয়াদ ঘনিয়ে / expiring" are the two rows an admin acts on — no sort/filter to isolate them.

### ADM-05 · Reports (`/admin/reports`)
**Figma:** **6 report-type launcher cards** (Coverage, Defaulter/Missed-dose, Drop-out, Center comparison, Stock usage, Custom) each "রিপোর্ট চালান →"; a **coverage-trend chart** (Jan–Aug); **"PDF রপ্তানি / Export"**.
**Impl:** two static tables (coverage per vaccine, dropout per vaccine) + a **CSV export** link. Plus separate `/admin/analytics` with CSS-bar coverage/dropout/daily-doses.

**Gaps / blind spots**
- Figma's model is *"pick a report → run it"*; impl dumps two fixed tables. Different IA. Recommend adopting the launcher model and **merging `/analytics` into it** (analytics = the "run" result view).
- Export is CSV only; Figma shows **PDF** (the defense-friendly artifact). Offer both.
- No center-comparison or stock-usage report at all.
- No date-range scoping on any report.

### ADM-06 · Audit log (`/admin/audit`) — **MISSING**
**Figma:** search, **action-type filter**, **date-range filter**, **export**; table = time / user+avatar / **action pill** (ডোজ রেকর্ড/শিশু নিবন্ধন/নিয়ম আপডেট/…) / entity (e.g. "MR (১ম) · শিশু #3091") / **দেখুন view**.
**Impl:** only an **8-row widget on the dashboard**; no dedicated page, no search/filter/export, no entity detail.

**Gaps / blind spots**
- `audit_log` table + `admin_audit` migration already exist and RLS is admin-only-read — the **backend is done, the screen is not**. Pure UI gap.
- Compliance surface: an immutable audit trail you can't search or export is not usable for the "who changed this role/record" question a defense panel will ask.

### ADM-07 · Notifications & jobs (`/admin/notifications`) — **MISSING**
**Figma:** **cron-job status card** (last run / next run / processed / failed / **"এখন চালান / Run now"**); **delivery-log table** = recipient / **channel pill** (SMS/ইমেইল) / message / **status pill** (পাঠানো/ব্যর্থ/পুনঃচেষ্টা) / sent-time.
**Impl:** none.

**Gaps / blind spots**
- `notifications` table exists (queue with status queued/sent/failed/dead, attempts, provider_ref, last_error) and `pg_cron` refresh is scheduled — again **backend-ready, UI-absent**.
- "Run now" is a privileged trigger — needs confirm + audit entry.
- This is the screen that *proves the reminder system works* during the demo; high narrative value.

### ADM-08 · System settings (`/admin/settings`) — **MISSING**
**Figma:** 3 grouped sections — **Reminders & Notifications** (lead-time select, daily-run time, SMS toggle, email toggle, quiet-hours toggle); **Schedule rules** (NIS schedule version, auto-generate-on-registration toggle, duplicate-detection toggle); **Security & Access** (**2-step OTP for staff** toggle, **session-timeout** select).
**Impl:** none.

**Gaps / blind spots**
- Several toggles map to *real behavior* (SMS/email channel enable, quiet hours, MFA-for-staff) — these need a `settings` table or config, not just cosmetic switches. For the demo, a read-mostly settings screen backed by a small `app_settings` table is enough; wire the ones that change live behavior (channels, lead time) and mark the rest "planned."
- **2-step OTP for staff** is TODO 1.17 (⚪ roadmap) — the toggle can exist and read "enforced in production."

---

## 2. Gap analysis (consolidated)

**Missing screens (3):** Audit log, Notifications & jobs, Settings. *(Children was missing — delivered today.)*
**Missing components:** invite-user dialog, confirm dialog, row "…" action menu, toolbar (search+filter+primary-action), status-pill registry, KPI card with delta, chart card (bar/doughnut/trend), date-range picker, theme toggle, avatar-with-initials, pagination, toast, skeleton loader, PDF export.
**Missing features:** user invite, user status lifecycle, per-report "run" model, PDF export, cron "run now", audit search/filter/export, settings persistence, per-child drill-in (from the new Children screen).
**Missing workflows:** onboard staff → assign role → confirm; isolate low/expiring stock → restock; run a report → export → attach to defense.
**Missing validations:** role-change confirmation, invite email/role validation, stock/expiry bounds (partly in `BatchForms` — verify), settings value bounds.
**Missing interactions:** search, filter, sort, pagination, row menus, optimistic toggle feedback.
**Missing states:** the codebase has **empty** (inventory, dashboard-activity) but essentially **no loading (skeleton), no error, no permission-denied, no success-toast** states. Only `SubmitButton` reflects pending. (Handbook audit: the one full 6-state pattern lives isolated on Worker WRK-07 — promote it.)
**Design inconsistencies:** KPI metric drift (dashboard); two different report IAs (reports vs analytics); status-label drift risk across roles; no shared type scale; own-avatar/avatar usage inconsistent.
**Implementation gaps:** no shared `AdminTable`/`Toolbar` — every screen re-hand-rolls a `<table>`; charts hand-rolled per screen; no component library, so each new screen is copy-paste.

---

## 3. Blind spots (things neither Figma nor current code handles)

1. **Destructive/privileged actions have no guardrails** — role change, "run now", (future) deactivate. No confirm, no re-auth, no undo window.
2. **No pagination / no bound on any list** — dashboards look fine on seed data, fall over on real volume. (Repeats the Handbook audit's cross-role finding.)
3. **No loading/error states** — a slow Supabase query shows a blank screen; a failed query shows nothing or a crash, not a retry.
4. **No responsive/tablet layout** — all frames are 1440×900; sidebar is fixed `w-56`, tables overflow-x only. A program officer on a tablet gets a broken layout.
5. **Accessibility:** color-only status pills (no text/icon redundancy for color-blind users), no visible focus rings audited, Bengali screen-reader labels unverified, `aria-current` only on nav.
6. **Settings that lie** — a toggle that doesn't actually change behavior is worse than no toggle. Decide per-toggle: wired vs "planned" (and label it).
7. **Audit completeness** — dashboard shows 8 rows; is *every* privileged write actually appended to `audit_log`? TODO 2.15 requires it; verify each admin action does.
8. **Empty vs zero ambiguity** — solved correctly on the new Children screen (newborn with birth-doses-due = 0%, but a child with *no* due doses = "—"). Apply the same discipline to coverage anywhere it appears.

---

## 4. UI/UX & architecture recommendations (don't just replicate Figma)

**Do adopt from Figma:** the 9-item IA, KPI deltas, the report-launcher model, the audit/notifications screens, status pills, the dashboard charts.

**Improve on Figma:**
- **One shared component kit** under `admin/_components/` — this is the highest-leverage change. Build: `AdminTable` (columns config + optional sort + pagination + row-actions slot), `Toolbar` (search + filters + primary action), `StatusPill` driven by a **single status registry** (`{ key → { tone, label_bn } }`) so a status renders identically on Admin *and* Worker (kills the সুস্থ/পর্যাপ্ত drift), `RowMenu`, `ConfirmDialog`, `KpiCard` (with delta), `ChartCard` + reuse the dependency-free CSS `Bar`/add a small donut, `EmptyState`, `Skeleton`, `Toast`. Every screen then becomes declarative config, not copy-pasted markup.
- **Confirm + audit every privileged mutation.** Role change and "run now" go through `ConfirmDialog` → server action → `audit_log` append → toast. Non-negotiable for a security-graded defense.
- **Merge `/analytics` into `/reports`** — Figma's model is correct; two competing analytics IAs is tech debt.
- **Server-side pagination** on `AdminTable` from day one (Supabase `.range()`), even if seed data is tiny — it's cheaper than retrofitting.
- **Status registry + type scale** solve two Handbook-audit findings (terminology drift, no shared type scale) at the system level.
- **Accessibility baseline:** text label inside every status pill (not color alone), visible focus rings, `aria-label` on icon-only controls, keyboard-navigable row menus.

**Architecture:** keep the current **Server Component + Server Action** pattern (it's clean — `requireRole("admin")` gates each route, RLS is the real boundary). Add: (a) a thin `app_settings` table for ADM-08; (b) a `v_child_coverage` view when the Children list outgrows app-side aggregation (marked with a `ponytail:` comment in the new page); (c) an `audit()` helper asserted by a test so no privileged action ships un-audited.

---

## 5. Implementation roadmap (micro-level)

Phasing assumes the 2026-08-03 demo. 🔴 must, 🟡 should, ⚪ optional.

### Phase A — Shared kit + guardrails (unblocks everything) 🔴
- A1 `StatusPill` + `status registry` (inventory, user, notification, audit-action, coverage tones).
- A2 `AdminTable` (columns, empty state, optional pagination, row-actions slot) — refactor Users/Inventory/Catalog/Children onto it.
- A3 `Toolbar` (search + filter selects + primary action).
- A4 `ConfirmDialog` + `Toast`; wire `RoleSelect` change through confirm→action→audit→toast.
- A5 `KpiCard` delta support; `ChartCard` (promote analytics `Bar`, add small donut).
- **Acceptance:** all four existing tables use `AdminTable`; role change requires confirm and writes an `audit_log` row (asserted by pgTAP/unit test).

### Phase B — Fill the 3 missing screens 🔴
- **B1 Audit log `/admin/audit`** — `AdminTable` over `audit_log` (join actor→profiles), action-type filter, date-range, CSV export. Reuse action-label map already in `admin/page.tsx` (`auditLabel`). *Acceptance:* every seeded privileged action appears; filter by action + date works; export downloads.
- **B2 Notifications & jobs `/admin/notifications`** — cron status card (last/next run, processed, failed counts from `notifications` aggregates) + delivery-log table (recipient/channel/message/status/sent). "Run now" = server action behind confirm, audited. *Acceptance:* sent/failed/retry statuses render with correct pills; run-now appends audit + toast.
- **B3 Settings `/admin/settings`** — `app_settings` table (key/value/updated_by); render the 3 groups; wire live-effect toggles (channels, reminder lead-time, quiet hours); mark MFA/other as "planned." *Acceptance:* changing lead-time persists and is read by the reminder logic; each change audited.

### Phase C — Bring existing screens to design 🟡
- C1 Dashboard: adopt Figma KPI set (+deltas), add coverage bar + dose-status donut, stock-alert panel with restock links, convert activity to feed.
- C2 Users: add invite dialog (`inviteUserAction`, TODO 2.13), status column + lifecycle, search/filter, center column, row menu.
- C3 Inventory: add search + status filter + "add stock" route + row menu.
- C4 Reports: launcher-card model, merge analytics, add PDF export alongside CSV.
- C5 Children (delivered): add search/filter + row → child detail drill-in (schedule/history), pagination, `v_child_coverage` view.

### Phase D — Hardening 🟡/⚪
- D1 Loading skeletons + error boundaries on every route.
- D2 Responsive/tablet pass (sidebar collapse, table→card at narrow widths).
- D3 a11y pass (axe): pill text redundancy, focus rings, Bengali SR labels.
- D4 E2E smoke (TODO 2.20): login as admin → visit all 9 destinations → one write each.

---

## 6. Prioritized micro-TODO (drop into `TODO.md` §2)

🔴 = demo-blocking, 🟡 = strengthens, ⚪ = polish/deflector.

1. 🔴 `StatusPill` + status registry (kills cross-role label drift). [A1]
2. 🔴 `AdminTable` + refactor 4 existing tables onto it. [A2]
3. 🔴 `ConfirmDialog`+`Toast`; role-change → confirm → `setRoleAction` → audit → toast. [A4]
4. 🔴 **Audit-log screen** `/admin/audit` (backend already done). [B1]
5. 🔴 **Notifications & jobs screen** `/admin/notifications`. [B2]
6. 🔴 **Settings screen** `/admin/settings` + `app_settings` table. [B3]
7. 🔴 User **invite** dialog + `inviteUserAction` (audited). [C2]
8. 🔴 pgTAP/unit: "no privileged admin action ships un-audited" (extends TODO 2.19). 
9. 🟡 Dashboard charts (coverage bar + dose donut) + KPI deltas + stock-alert panel. [C1]
10. 🟡 Merge `/analytics` into `/reports`; report-launcher model; PDF export. [C4]
11. 🟡 Inventory search + status filter + "add stock" route. [C3]
12. 🟡 Children detail drill-in + search + pagination + `v_child_coverage` view. [C5]
13. 🟡 Toolbar search/filter/pagination across all lists. [A2/A3]
14. 🟡 Loading skeletons + error boundaries. [D1]
15. ⚪ Responsive/tablet pass. [D2]
16. ⚪ a11y (axe) pass. [D3]
17. ⚪ Admin E2E smoke over all 9 destinations. [D4]

---

## 7. Development sequence & milestones

- **M1 (kit ready):** Phase A done — shared components in place, existing screens refactored, role-change guarded+audited. *Everything after this is fast.*
- **M2 (feature-complete IA):** Phase B done — all **9 destinations exist and work**; demo can navigate the entire admin surface end-to-end.
- **M3 (on-design):** Phase C — dashboard charts, invite flow, report launcher; the surface *looks* like the Figma.
- **M4 (demo-hardened):** Phase D subset — skeletons/errors + one responsive pass + admin E2E smoke green.

Sequence rationale: A before B (screens are trivial once the kit exists); B before C (having all 9 destinations navigable beats polishing 6); D last and time-boxed.

---

## 8. Risk analysis & mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Building 3 screens + kit before Aug 3 slips | Med | High | Kit-first (M1) makes B/C cheap; if slipping, ship B (all 9 navigable) and cut C polish — a complete-but-plain surface demos better than 6 pretty screens. |
| Privileged action ships un-audited | Med | High (security grade) | Test #8 asserts it; route every mutation through one audited action helper. |
| Settings toggles that don't do anything | High | Med | Per-toggle "wired vs planned" decision; label planned ones; only claim what's real. |
| Terminology drift resurfaces (Worker vs Admin) | High | Low-Med | Single status registry shared across roles (A1). |
| Lists break on real data volume | Low (demo) / High (prod) | Med | Server-side pagination in `AdminTable` from the start. |
| Charts add heavy deps / slow build | Low | Low | Reuse dependency-free CSS bars; hand-roll a small donut before reaching for Recharts. |
| Live "run now" cron trigger misfires in demo | Low | Med | Confirm dialog + idempotent notification unique constraint already in schema; test the happy path pre-demo. |

---

## 9. Final production-readiness checklist (Admin)

- [ ] All **9** sidebar destinations route to a real screen (7/9 after today; Audit, Notifications, Settings remain).
- [ ] Every list: search, filter where relevant, pagination, empty + loading + error states.
- [ ] Every privileged mutation: confirm dialog → server action → `audit_log` append → toast, proven by a test.
- [ ] Status labels come from one shared registry (Admin == Worker).
- [ ] Dashboard shows canonical KPI set with deltas + coverage chart + dose-status chart + actionable stock alerts.
- [ ] User invite works end-to-end; user status lifecycle visible.
- [ ] Audit log searchable/filterable/exportable; every seeded privileged action present.
- [ ] Notifications screen shows queue statuses; "run now" works and is audited.
- [ ] Settings persist; live-effect toggles actually change behavior; "planned" ones labeled.
- [ ] Reports: launcher model, CSV **and** PDF export, analytics merged in.
- [ ] a11y: pill text redundancy, focus rings, Bengali SR labels; axe clean on the dashboard.
- [ ] Responsive: usable on tablet (sidebar collapse, table reflow).
- [ ] Admin E2E smoke green: login → all 9 destinations → one write each.
- [ ] Bengali-only, Bengali numerals everywhere; zero hardcoded strings (lint-enforced).
- [ ] Dark theme parity (Admin page still uses raw colors per figma-ui memory — audit for token binding).

---

*Delivered this session: the missing **শিশু / Children** screen (`/admin/children`) — registry table (name+age+gender / guardian / contact / coverage / registered), app-side per-child coverage, added to sidebar in the Figma nav position, verified live against seed data (6 children, correct null-vs-0% coverage handling), zero console errors.*

---

## Design-quality re-audit (2026-07-24, post-ADM-09)

The parity audit above compares **code vs Figma**. This section audits the **Figma design itself** — heuristic/institutional UI/UX review of all **9 admin screens** now that the missing **শিশু** screen is designed.

**Figma now = 9 screens (Dark+Light each):** ADM-01 Dashboard, ADM-02 Users, ADM-03 Catalog, ADM-04 Inventory, ADM-05 Reports&Analytics, ADM-06 Audit, ADM-07 Notifications, ADM-08 Settings, **ADM-09 শিশু/Children (`249:2` Dark, `249:214` Light)** — built this session by cloning ADM-02 and remapping to the child model (name+age·gender / টিকা স্ট্যাটাস badge / অভিভাবক / কভারেজ badge / নিবন্ধিত), tone-correct badges (success/info/warning/danger) in both themes, nav active-state moved to শিশু. Requirement of "exactly 9 screens" is met (impl still carries an off-design 10th, `/admin/analytics` — recommend folding into Reports to match ADM-05).

### Findings (design lens) — most severe first

| ID | Finding | Screens | Priority | Complexity | UX gain |
|----|---------|---------|----------|-----------|---------|
| UX-01 | **No empty / loading / error / zero-result states designed** — every table shows only the happy path | all 9 | Critical | M | High |
| UX-02 | **No confirmation / destructive-action dialogs** — delete user, void batch, delete vaccine, "run now" have no modal states | Users, Catalog, Inventory, Notifications | Critical | M | High |
| UX-03 | **Mixed-language leak** — English placeholder "Search vaccine or batch…" on Inventory; violates Bangla-only | Inventory (ADM-04) | Critical | S | Med |
| UX-04 | **No pagination / bulk actions** anywhere — tables break past ~50 rows (children, audit, users grow unbounded) | Users, Inventory, Catalog, Audit, Notifications, শিশু | High | M | High |
| UX-05 | **Inconsistent row-action pattern** — kebab "⋯" (Users/Inventory/শিশু) vs text link "সম্পাদনা" (Catalog) vs "দেখুন" (Audit) vs card "রিপোর্ট চালান →" (Reports) | all list screens | High | S | Med |
| UX-06 | **Context-wrong global control persisted** — date-range pill "গত ৩০ দিন ▾" shown on Settings & Audit & Catalog where it does nothing | Settings, Audit, Catalog, Users, শিশু | High | S | Med |
| UX-07 | **Charts are decorative, not informational** — coverage bars have no axis, values, or tooltips; reads as placeholder | Dashboard, Reports | High | M | High |
| UX-08 | **Ambiguous account control** — top-right "অ" glyph unclear (language? avatar?); no user name/role/logout affordance | all 9 | High | S | Med |
| UX-09 | **Detail screens undesigned** — catalog/[id], inventory/[id] batch detail exist in code, no Figma frame, no breadcrumb/back pattern | Catalog, Inventory | High | M | Med |
| UX-10 | **Numeric columns left-aligned** — doses, stock, coverage% hard to scan/compare | Inventory, Catalog, শিশু | Medium | S | Med |
| UX-11 | **Settings persistence model unclear** — no Save button; auto-save vs explicit ambiguous; security toggles (2-step OTP off) lack guardrails | Settings | Medium | S | Med |
| UX-12 | **No focus-visible / keyboard-nav tokens** — no focus ring defined in the system; blocks a11y AA | all 9 | Medium | M | Med |
| UX-13 | **Contrast risk on muted text & badge-on-tint** — verify #9499b2 body-muted and warning #fbbf24-on-#3a2c10 hit WCAG AA (4.5:1 / 3:1) | all 9 | Medium | S | Med |
| UX-14 | **Decorative status dot conveys nothing** — identical blue dot before every catalog/inventory row item | Catalog, Inventory | Low | S | Low |
| UX-15 | **Orphan hidden text node** "শিশু, ব্যাচ খুঁজুন…" left behind the search field (design debt, cloned into ADM-09 too) | Users, শিশু | Low | S | Low |
| UX-16 | **No responsive/tablet frames** — 1440 desktop only; state admin-desktop-only or add a collapse breakpoint | all 9 | Low | L | Low |

### Micro-TODO roadmap

**Critical**
- `T-C1` (UX-01) Design the 6-state kit (default/loading-skeleton/empty/zero-result/error/success-toast) as shared components; apply to all 9 tables. Dep: shared component kit. Effort: 1.5d. Done when every table has an empty + loading + error frame in both themes.
- `T-C2` (UX-02) ConfirmDialog component (title/body/confirm-danger/cancel) + wire to delete-user, void-batch, delete-vaccine, run-now. Dep: none. Effort: 0.5d. Done when every destructive/irreversible action has a modal state.
- `T-C3` (UX-03) Replace English Inventory placeholder with "টিকা বা ব্যাচ খুঁজুন…"; lint rule to block Latin-only strings in screen text. Effort: 0.25d.

**High**
- `T-H1` (UX-04) Table footer component: pagination (৳ Bengali page numbers) + rows-per-page + optional bulk-select checkbox column. Apply to 6 list screens. Effort: 1d.
- `T-H2` (UX-05) Standardize on one row-action pattern (kebab menu with labelled items); demote text-links. Effort: 0.5d.
- `T-H3` (UX-06) Make the date-range pill contextual — render only on time-series screens (Dashboard, Reports, Audit-with-range); remove from Settings/Catalog/Users/শিশু. Effort: 0.25d.
- `T-H4` (UX-07) Real chart component with axis labels, value tooltips, and a legend that shows values; replace gradient placeholder bars on Dashboard + Reports. Effort: 1d.
- `T-H5` (UX-08) Account menu: avatar with initials + name + role + logout; disambiguate from theme/language toggle. Effort: 0.5d.
- `T-H6` (UX-09) Design catalog + inventory detail frames with a breadcrumb/back header pattern. Effort: 1d.

**Medium**
- `T-M1` (UX-10) Right-align numeric columns; tabular-figures. Effort: 0.25d.
- `T-M2` (UX-11) Decide Settings persistence (recommend explicit Save + dirty-state); add confirm for security toggles. Effort: 0.5d.
- `T-M3` (UX-12) Add focus-visible ring token; apply to all interactive components. Effort: 0.5d.
- `T-M4` (UX-13) Contrast pass — verify/adjust muted text + badge tints to WCAG AA; document ratios. Effort: 0.5d.

**Low**
- `T-L1` (UX-14) Remove or give meaning to the row status dot (e.g. active/inactive color). Effort: 0.1d.
- `T-L2` (UX-15) Delete the orphan hidden search text node in ADM-02 and ADM-09. Effort: 0.1d.
- `T-L3` (UX-16) Decision: declare admin desktop-only, or add a ≤768 sidebar-collapse + table-reflow variant. Effort: 1d if pursued.

**Sequencing:** the shared **admin component kit** (Table + Toolbar + StatusPill-registry + ConfirmDialog + StateKit + Pagination + AccountMenu) is the enabler — build it first, then T-C1/T-C2/T-H1/T-H2 fall out cheaply and consistently across all 9 screens. This is the same "system fix covers all screens" leverage flagged in the combined cross-role audit.*

---

## Delivered 2026-07-24 — Phase C + D slice

Shipped the code-actionable, schema-backed, testable subset of §5 Phase C/D. Deliberately did **not** fabricate data or half-build flows that need infra we don't have.

**Shared kit (enabler)**
- `_components/DataTable.tsx` — generic client list table: search box + filter chips + empty state over already-fetched rows. Pure `filterRows()` extracted and unit-tested. Client-side filter (no server pagination) — right for the demo dataset; `ponytail:` note points to Supabase `.range()` if a list grows.
- `_components/Chart.tsx` — `Bar` + `CoverageBars` extracted from the old analytics page; now shared by Dashboard and Reports so the coverage chart can't drift.

**Phase C**
- **C1 Dashboard** — added the per-vaccine coverage chart and an **actionable stock-alert panel** (real low/expiring batches with per-row "পুনঃমজুদ" links), replacing the dead low-stock count. KPI **deltas intentionally omitted** — no historical snapshot exists, so a delta would be fabricated.
- **C3 Inventory** — search + a "মনোযোগ প্রয়োজন" filter that isolates low/expiring batches (via shared `DataTable`).
- **C4 Reports** — **merged `/admin/analytics` into `/admin/reports`** (removed the duplicate IA; old route now 302s to reports; nav item dropped). Added **PDF export** via native `window.print()` + a print stylesheet (no PDF dependency), alongside the existing CSV.
- **C5 Children** — search over name/guardian/contact; per-child coverage extracted to `children/coverage.ts` and unit-tested for the empty-vs-zero rule.

**Phase D**
- **D1** — shared `loading.tsx` (skeleton) + `error.tsx` (retry boundary) for the whole `/admin` subtree.
- **D3 (partial)** — global `:focus-visible` ring token (was absent); status pills already carry text, not color alone.
- **D4 (partial)** — a **destinations smoke test** asserts all 9 sidebar routes have a page module; the full auth-driven "visit all 9 → one write" E2E is deferred (needs a live Supabase + login).

**Top bar (from mid-session request / audit UX-08)**
- New admin header with a **light/dark theme toggle** (retargets the `#admin-root` token scope, persisted) and an **account menu** (avatar initial → email + role + logout). Logout moved out of the sidebar.

**Tests:** `apps/web/tests/format.test.tsx` + `apps/web/tests/admin.test.tsx` — 24 assertions covering `filterRows`, `batchStatus`, `childCoverage`, `auditLabel`, the Bengali formatters, and the destinations manifest. `pnpm test` / `typecheck` / `lint` all green.

**Deferred (with reason, not silently):**
- **C2 user invite / status lifecycle / center column** — no `profiles.status`, no `center`, and no email/admin-API wiring in the schema; building it would need real infra decisions, not a UI stub.
- **C5 child-detail drill-in + `v_child_coverage` view** — YAGNI at 6 seed rows (the page already `ponytail:`-notes the view).
- **D2 responsive/tablet redesign** and **full D3 axe pass** — a real design/tooling effort; only the print-clean and focus-ring pieces were cheap enough to land now.
- KPI deltas — need a historical metrics snapshot table first.
