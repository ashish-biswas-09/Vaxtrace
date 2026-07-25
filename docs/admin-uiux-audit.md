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

---

## Delivered 2026-07-25 — Identity system, child history, account management, module pass

### 1. Unique identification system (schema-enforced)

| Entity | Identifier | Shape | Guarantee |
|---|---|---|---|
| Child | `children.child_id` | 10 digits — 9 from a sequence + a **Luhn check digit** | Unique by construction, generated in a `BEFORE INSERT` trigger; `BEFORE UPDATE` rejects any change |
| Admin | `user_roles.staff_code` | `ADM-000001` | Same guards, per-role sequence |
| Worker | `user_roles.staff_code` | `WKR-000001` | " |
| Parent | `user_roles.staff_code` | `PAR-000001` | " |

Design notes:

- **Why a trigger, not a `DEFAULT`.** A default can be overridden by any caller. The guard trigger *overwrites* whatever the client sent, so the invariant holds for server actions, the SQL console, service-role jobs and future importers alike. The `DEFAULT`s that do exist are there only so the generated TypeScript `Insert` types treat the column as optional; `user_roles`' default is the sentinel `'UNSET'`, which deliberately **violates** the format CHECK, so a bypassed trigger fails closed instead of storing junk.
- **Why 10 digits and not 9.** The tenth is a Luhn checksum over the first nine, so a mistyped or transposed Child ID is rejected at data entry rather than silently attaching a dose to the wrong child.
- **Why the code lives on `user_roles`, not `profiles`.** The identifier names a *capacity*. Someone who is both a worker and an admin holds one of each, and neither number is ever reused.
- Verified live against the project database and rolled back: a client-supplied `0000000000` came back as `1000000073`; `UPDATE ... SET child_id` raised; a worker grant minted `WKR-000001`; `luhn_check_digit('12a')` raised. Locked in as `supabase/tests/identity_ids.test.sql` (9 pgTAP assertions).

### 2. Child vaccination history — `/admin/children/[id]`

The Children screen was a registry with no drill-in. Every row now opens a full immunisation record: Child ID (headline), name / age / gender / DOB, guardian and contact, the registering staff member **with their Worker ID**, and a dose table covering **vaccine, dose number, scheduled date, administered date, status, administering worker (+ ID), batch number, and remarks / adverse events**.

- History is the **schedule joined to administered doses**, not just the doses given — showing only what happened hides what was missed, which is the question the screen exists to answer. Extracted to `children/[id]/history.ts` and unit-tested (orphan records, ordering, status precedence).
- `schedules.status` only knows pending/done/missed, so `doseStatus()` splits pending into **due** (past) and **upcoming** (future). Without that split, every newborn's entire future calendar reads as outstanding.
- **Remarks and adverse events (AEFI)** are new columns on `vaccination_records`, editable inline. Everything clinical — child, vaccine, dose, date, who administered — stays append-only; a column-level `GRANT UPDATE (notes, adverse_event)` enforces that at the database, not just in the server action. AEFI rows also surface as a dedicated dashboard alert.
- Child ID search accepts **either script**: `filterRows` normalises Bengali digits to ASCII, so a card read aloud in Bangla and one scanned in Latin find the same child.

### 3. Account management — `/account`

Built **outside** the admin shell so all three roles reach the same screen: profile picture upload / replace / delete, name, contact, address, language, email change, password change, immutable role ID, and personal account activity.

- **Private** avatars bucket (not public), one folder per user id enforced by a storage policy, served through short-lived signed URLs — the object path is otherwise the only thing between a stranger and a health worker's photograph. Replacing a `.jpg` with a `.png` removes the old object rather than orphaning it.
- **Password change re-authenticates.** The current password is verified on a `persistSession:false` client before `updateUser`, so a borrowed session cannot silently take over an account on a shared clinic workstation — and a wrong guess cannot disturb the live session.
- Account activity is powered by a merged `audit_log` SELECT policy: an admin reads the whole trail, everyone else reads only the entries they caused.
- `profiles.updated_at` existed but nothing ever moved it, so "last updated" was always the creation time. One trigger fixed every write path.

### 4. Module pass

| Module | Change |
|---|---|
| ড্যাশবোর্ড | KPI switched from user accounts to **registered children**; new **AEFI alert panel**; recent activity links through to the audit log |
| শিশু | Child ID column, per-row drill-in, coverage filters, dual-script search |
| টিকা তালিকা | Search, active/inactive filters, and a **`total_doses` vs `vaccine_doses` mismatch warning** — when they disagree, children silently get an incomplete calendar |
| টিকা মজুদ | **`/admin/inventory/new`** — receiving stock previously had no entry point at all; a duplicate batch is reported as a conflict, not a crash |
| রিপোর্ট | CSV export refactored onto a shared `lib/csv.ts` |
| ব্যবহারকারী | Rebuilt on the shared table: staff-ID column, search, per-role filters |
| অডিট লগ | Search, entity filters, pagination and **CSV export** — an audit trail that cannot leave the screen is not evidence. `auditLabel` now separates a *dose amendment* from a *dose given* |
| বিজ্ঞপ্তি | Status registry extracted and shared; attempts and `last_error` surfaced; status filters |
| সিস্টেম সেটিংস | Rewritten to report **only facts the database can prove**. The previous screen showed invented values (lead time, daily run time) for a dispatcher that does not exist; unbuilt behaviour is now labelled **পরিকল্পিত** |
| Shared | `DataTable` gained **pagination** and a distinct **zero-result vs empty** message |

### 5. Bugs found and fixed along the way

- **Timezone off-by-one in `daysUntil`.** `new Date("2026-07-25")` parses as UTC midnight; `setHours(0,0,0,0)` then snapped it to the local day that instant falls in — a day early east of Greenwich. In Bangladesh (UTC+6) every dose due today read as *upcoming* and every batch expiring today read as *expired*, for the first six hours of every day. Fixed at the root with a local-date constructor plus a new `todayIso()`; call sites moved off `toISOString().slice(0,10)`. This was surfacing as a failing test that predated this session.
- **Audit coverage holes.** Child registration, profile edits and dose amendments were untracked. Triggers added — the trail has to be complete to be evidence.
- **`trg_admin_audit()` was callable over the public REST API** by `anon` and `authenticated`. It is a trigger function; `EXECUTE` revoked. The earlier hardening migration applied this rule to the functions that existed then; this one was added afterwards and missed.

### 6. Advisor status

- **Security: 4 WARN → 1.** Fixed the two `trg_admin_audit` exposures, and **removed** an `admin_cron_jobs()` SECURITY DEFINER function built earlier in this same session — a definer function reachable over the public REST API is not worth two informational cards, even with an internal admin check. The remaining item, **leaked-password protection**, is an Auth *service* setting no SQL migration can reach: added to `supabase/config.toml` for local, but **the hosted project needs the switch flipped under Dashboard → Authentication → Password settings**.
- **Performance: all WARN cleared.** Every RLS policy re-evaluated `auth.uid()` / `auth_role()` per row; now wrapped as `(select ...)` so the planner evaluates once per statement. Overlapping permissive policies merged — the `for all` policies were split into explicit insert/update/delete so they stop shadowing the select policy. Five missing foreign-key covering indexes added.
- **Remaining: 9 × INFO `unused_index`, deliberately not actioned.** Five are the FK indexes just created — unused because they are new. The others (`schedules (status, due_date)`, `children (guardian_id)`) are the reminder-sweep and parent-RLS indexes. Dropping an index because a seed-sized database has not needed it yet is optimising for the linter instead of for the query it was built for; the lint self-resolves under real traffic.

### 7. Verification

`pnpm typecheck`, `pnpm lint`, `pnpm build` and `pnpm test` all clean — **37/37 tests passing** (was 23/24). The production build emits no warnings. Every route was compiled and swept against a freshly restarted dev server with zero server errors.

### 8. Still open

- **User invite flow and status lifecycle** — needs the Supabase Admin API and email wiring, not a UI stub.
- **Reminder dispatcher (SMS / email)** — until it exists, Settings correctly labels those rows পরিকল্পিত and Notifications has no "run now".
- **Child registration UI** — the schema and ID generation are ready; the worker-facing form is not built.
- **KPI deltas** — need a historical metrics snapshot table; a delta without history would be fabricated.
- **Worker and Parent shells** — still stubs; `/account` already serves them.
- **Responsive / tablet pass and a full axe a11y run** — a real design effort, untouched here.
- **Auth-driven E2E smoke** — the destinations manifest test covers the navigable surface; the login-and-write pass needs a seeded live session.
- **Visual sign-off** — every screen was compile- and log-verified, but rendering was not eyeballed while signed in as an admin.

---

## Delivered 2026-07-25 (phase 2) — Reminders, account lifecycle, worker console, responsive/a11y

### 9. Reminder system

Split deliberately in two, along the line of what can be guaranteed:

- **Enqueue — in the database, no provider needed.** `enqueue_reminders()` walks pending schedules falling due inside the configured lead time and inserts one `notifications` row per enabled channel, at a send time computed by `reminder_send_at()` (which pushes into the next morning if the configured run hour falls inside quiet hours). Idempotent by the table's own `unique(schedule_id, channel, due_date)`, so cron and a manual run cannot double-send. Scheduled daily via `pg_cron`.
- **Dispatch — an Edge Function, deployed.** `dispatch-reminders` claims `queued` *and* `failed` rows (a first transient provider error must not be permanent), sends via Resend / SMS gateway, and retires a row to `dead` after 5 attempts so a permanently bad address stops consuming the retry budget. Gated on a shared secret and **fails closed**: verified live returning `401` both with no secret and with a wrong one. With no provider keys configured it reports `skipped`, rather than failing every row and filling the delivery log with noise.

`enqueue_reminders()` is deliberately **SECURITY INVOKER**. A definer function is reachable at `/rest/v1/rpc/<name>` by every signed-in user — exactly what the security advisor flags, and what an `admin_cron_jobs()` function was deleted for earlier. RLS already grants an admin the reads, and a narrow `notifications_admin_insert` policy authorises the write.

**Settings is now real.** The reminder group is backed by `app_settings` rows that `enqueue_reminders()` actually reads. Verified live and rolled back: **8 enqueued → re-run 0** (idempotent), **channel toggle gates the insert** (8 → 4 with SMS off), **a 23:00 run time pushed to 07:00 next morning**. Only the gateway row remains labelled পরিকল্পিত, because that is the only part still waiting on infrastructure.

### 10. Account lifecycle and invitations

`profiles.status` (`invited` / `active` / `inactive`) is **enforced, not decorative**. The access token hook stamps `user_status` onto the JWT; `auth_role()` returns `NULL` for anything but `active`, which makes every role-based RLS policy deny — one change, denying system-wide. `getUserRole()` mirrors it so a suspended account is redirected at the door instead of landing on an admin screen full of mysteriously empty tables.

Two traps closed on the way:

- Column grants cannot tell an admin from a parent — both are `authenticated`. Granting `update(status)` would have let a deactivated user set themselves back to `active`. A `BEFORE UPDATE` trigger rejects the change unless the caller is an admin.
- A missing `user_status` claim is treated as `active`, in both the SQL and the TypeScript. Treating it as suspended would have signed out every live session the moment the migration ran.

The hook now reads `profiles` as well as `user_roles`, so it needed the same grant + RLS policy that a previous 500-on-every-sign-in was traced to. Verified before moving on: `supabase_auth_admin` has schema usage, SELECT on both tables, EXECUTE on the hook, **and does not bypass RLS** — so both explicit policies are load-bearing, and both exist.

Invitations use the Admin API and therefore the service role, read at call time. Without `SUPABASE_SERVICE_ROLE_KEY` the action says so plainly rather than reporting a success that did not happen. `requireRole("admin")` runs *before* the service key is ever touched.

### 11. Responsive and accessibility

- **Contrast measured, not eyeballed.** Light-theme `warning` (#d97706, **3.19:1**) and `success` (#16a34a, **3.30:1**) both failed WCAG AA — and both are used as *text* colour in status pills and KPI values, not just as fills. Replaced with #b45309 and #15803d (**5.02:1** each). Dark theme already passed (7.16 / 11.86 / 11.36) and is untouched.
- **Sidebar collapses below `lg`** into a header disclosure; a fixed `w-56` rail ate a third of a tablet viewport. Closing on navigation is done by keying the panel on the pathname rather than resetting state from an effect — the same result without the extra render pass the lint rule objects to.
- **`min-w-0` on the main flex column.** Without it a flex child will not shrink below its content width, so `overflow-x-auto` on a wide table never engages and the *page* scrolls sideways instead of the table.
- Every table now scrolls inside its own box (`overflow-x-auto`, not `overflow-hidden`, which was silently clipping columns), and every `<th>` carries `scope="col"`.

### 12. Dashboard UI/UX audit — findings, justification, and what was changed

Reviewed as a design surface rather than a feature list. Six findings survived scrutiny; each is recorded with why it is a real defect and not a preference.

| # | Finding | Why it is a defect | Change |
|---|---|---|---|
| D1 | **A rate with no denominator.** The coverage chart showed only a percentage. | "১০০%" from one dose and "১০০%" from four thousand render identically. Misreading one as the other is precisely what a coverage dashboard exists to prevent — this is a correctness defect wearing a visual-design costume. | `v_coverage` now returns `done_count` / `due_count`; the chart shows `৪/৫` under the rate, the report table gains both columns, and the CSV export carries them so the figures can be re-aggregated downstream. |
| D2 | **Only lagging indicators.** Coverage and dropout describe what already went wrong. | An admin opening a dashboard is asking "what do I do *now*". Nothing on the screen answered it — due and missed dose counts existed only on the worker console. | Act-now row added first (**দেয় ডোজ**, **বাদ পড়া ডোজ**, stock attention), with the lagging rates demoted to a second row. Order encodes priority. |
| D3 | **KPIs were dead ends.** A number with no way through to the rows behind it. | The question after every KPI is "show me which ones". The reader had to navigate by hand and reconstruct the filter. | `StatCard` takes an optional `href`; all six now link to the list they summarise. |
| D4 | **No temporal context.** Every figure was "now", with nothing saying so. | This screen gets screenshotted into reports. A number without its as-of time is unciteable. | Header carries a live হালনাগাদ timestamp. |
| D5 | **Activity feed had no time.** `dateBn` renders date only. | All eight entries from today rendered as the identical string, so the feed looked unordered and conveyed no recency — the one thing a feed is for. | New `dateTimeBn`, unit-tested. System-authored rows now attribute to **সিস্টেম** instead of an em-dash that reads as missing data. |
| D6 | **No first-run state.** Zero children produced a grid of em-dashes. | Indistinguishable from a broken dashboard. The one moment a new admin most needs direction is the moment they get least. | Dedicated empty state explaining that registering a child mints its ID and schedule, with the two actions that matter. |

Two candidate findings were **rejected** after examination rather than implemented for appearance's sake: a dashboard date-range picker (the KPIs are point-in-time by definition — a range control over them would be a lie, and the audit log and reports already carry their own scoping), and KPI trend deltas (still no historical snapshot table, so any delta would be fabricated — unchanged from the earlier finding).

### 13. Verification

`pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` all clean — **43/43 tests** (from 37, and from 23/24 before this work began). Production build emits no warnings. Full route sweep against a freshly restarted dev server: zero server errors.

Supabase advisors: **security 1** (the hosted leaked-password toggle, which no migration can reach), **performance 0 WARN**. The only remaining entries are INFO `unused_index` on indexes that are either newly created or back queries a seed-sized database has not run yet.

One regression caught and fixed during this phase: `app_settings_write` was created `for all`, which also matches SELECT and re-introduced on the settings table exactly the overlapping-policy problem removed from every other table one migration earlier. Split per action.

### 14. Still open

- **Leaked-password protection** — Dashboard → Authentication → Password settings (set in `config.toml` for local; the hosted toggle is a user action).
- **Provider keys** — `RESEND_API_KEY` / `SMS_GATEWAY_*` and `CRON_SECRET` for actual delivery; `SUPABASE_SERVICE_ROLE_KEY` for invitations. Every code path is built and fails honestly without them.
- **Parent shell** — still a stub; `/account` already serves parents.
- **Dose recording from the worker console** — registration ships here; recording an administered dose is the next worker screen.
- **Visual sign-off** — everything is compile-, log- and contrast-verified, but not eyeballed while signed in.
