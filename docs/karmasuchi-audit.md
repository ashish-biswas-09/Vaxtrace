# কর্মসূচি (Programme) Screens — Engineering, UX & Security Audit

**Date:** 2026-09-29 · **Build audited:** local `pnpm --filter @vaxtrace/web dev` against the hosted Supabase project · **Session used:** the existing signed-in admin session in the browser pane (`ADM-000001`, অ্যাডমিন)

**Method.** Every screen in the কর্মসূচি nav group was opened and scrolled end to end at desktop (1557px) and mobile (375px) widths. Filters, chips, pagination and inline panels were exercised, and malformed URL parameters were tried. Source for every screen, server action, shared component, auth helper and the relevant SQL migrations (RLS, views, triggers, functions) was read line by line. **No form was submitted and no data was changed.** Findings that depend on a write (plan, cancel, classify) are marked *Requires Verification*.

**Classification.** **Confirmed**: reproduced live, or unambiguous in code. **Strong indication**: the code makes it near-certain, but it was not reproduced. **Requires Verification**: plausible, and needs a specific test or account. **Improvement**: not a defect.
**Severity.** Critical · High · Medium · Low.

---

## Implementation status (updated 2026-09-29)

Legend: ✅ done and verified live · ⛔ needs something only you can provide

Code: `apps/web`, `supabase/migrations/20260929100000_programme_audit_fixes.sql`. Decision record: `docs/adr-supervisor-programme-access.md`. Tests: `apps/web/tests/programme-audit.test.tsx`, `apps/web/tests/programme-actions.test.tsx` (vitest, 102 passing), `supabase/tests/programme_audit.test.sql` (pgTAP; its assertions pass on the live project, 11/11).

| Phase | Task | Status |
|---|---|---|
| 1 | P1-1, P1-2 keyed dialogs (K-02) · P1-3 regression test | ✅ |
| 1 | P1-4, P1-5 no success without an affected row (K-06) | ✅ (tested with a mocked client) |
| 1 | P1-6 daily-dose chart (K-03) | ✅ reads RLS-scoped dose rows, follows the period picker |
| 1 | P1-7, P1-8 trend bars render, 12 months zero-filled, freshness line (K-04) | ✅ |
| 1 | P1-9, P1-10 supervisor access (K-01), Option A | ✅ ADR written; nav tested per role |
| 1 | P1-11, P1-12 URL validation, no raw SQL (K-07, K-14) | ✅ |
| 1 | P1-13 MFA gate in layout + CSV route (K-08) | ✅ |
| 1 | P1-14 note length (K-16) | ✅ |
| 1 | P1-15 first investigator kept (S-5) | ✅ app + DB trigger (live test passed) |
| 2 | P2-1 to P2-4 "রিপোর্ট হয়নি" state, chip, card, rate, cancel (K-05) | ✅ |
| 2 | P2-5, P2-6 AEFI open/close any case, urgency order (K-15) | ✅ |
| 2 | P2-7 reason for severity downgrade (S-6) | ✅ app + DB rule (live test passed) |
| 2 | P2-8 status-transition triggers (S-7) | ✅ live tests: held→cancelled refused, AEFI backwards refused, re-open clears closed_at |
| 2 | P2-9 one registry-coverage definition (K-09) | ✅ Reports and Coverage both show Penta ৭৩% (৭৪৮/১০২১) |
| 2 | P2-10 one tone scale, target 90% (K-10) | ✅ |
| 2 | P2-11 period picker (K-11) | ✅ drives the daily series; coverage/dropout are cohort figures and say so |
| 2 | P2-12 year window, cohort dropout (K-13) | ✅ |
| 2 | P2-13 drill-downs match numbers (K-12) | ✅ ২৪→২৪, ৩৪১→৩৪১ |
| 2 | P2-14 plan-form location and date rules (K-17) | ✅ 164 → 30 options; server-checked, tested |
| 2 | P2-15 team leads scoped to the facility | ✅ live: শ্রীপুর offers 1 worker, মৌচাক 2 (was 4 everywhere) |
| 3 | P3-1, P3-2 dialogs with focus; plan in header (K-18) | ✅ |
| 3 | P3-3, P3-4 database paging, filters and search for Sessions and AEFI (K-19) | ✅ |
| 3 | P3-5, P3-6 Data Quality: level labels, sticky header, issues filter, drill-downs, scoped headline (K-20) | ✅ counts match (৩৩→৩৩, ৬→৬) |
| 3 | P3-7 printing (K-23) | ✅ |
| 3 | P3-8, P3-9 Reports states; empty areas collapsed | ✅ |
| 4 | P4-1 copy (§8.1), P4-3 Bengali numerals, P4-4 date echo | ✅ |
| 4 | P4-2 glossary | ✅ §8.2, linked from `lib/programme.ts` |
| 4 | P4-5 review by an EPI officer | ⛔ needs a person |
| 5 | P5-1 to P5-8 contrast, charts, cards, mobile table, identifiers, reasons, touch targets, tokens | ✅ axe WCAG 2.1 AA: 0 violations on all 5 screens, light and dark |
| 6 | Unit, component and server-action tests | ✅ 102 passing |
| 6 | Database tests | ✅ the 11 pgTAP assertions run on the live project inside a rolled-back transaction: 11/11 pass, no rows kept |
| 6 | Apply the migration | ✅ applied via the Supabase connector as `20260929105535_programme_audit_fixes` |
| 6 | Manual pass as a supervisor account | ⛔ needs a supervisor login (the SQL impersonation check was blocked by the tool's safety review) |
| 6 | Real saves through the UI | ⛔ not done on the shared hosted DB (needs your go-ahead); DB rules proven by the rolled-back tests, app logic by mocked tests |
| 6 | Security advisor after migration | ✅ only new finding is `session_staff()` (intended, scope-checked). Pre-existing: `mv_coverage_monthly` readable by anon/authenticated → fix written in `20260929110000_revoke_mv_coverage_monthly.sql`, **not applied** |

Also fixed during verification: filter-row alignment, uneven AEFI action buttons, ~480px of blank scroll under charts (hidden table escaping `sr-only`), a flat "সর্বোচ্চ ১" zero chart, the country row in Data Quality, and the Reports coverage chart (visible track, per-row target mark, summary line, colour key, duplicate table removed).

---

## 1. Executive Summary

The কর্মসূচি area is well built at the database layer. Row-level security enforces role × scope on every table checked, reporting views use `security_invoker`, and the one `security definer` function re-applies scope. Constraints stop a cancelled session without a reason and a classified AEFI case without a causality. Audit triggers cover sessions and AEFI cases. Unauthenticated requests are redirected.

The problems are in the application layer above that foundation. In order of impact:

1. **An AEFI case can be saved with another case's clinical data (Critical, Confirmed live).** Open the classify panel for one case, then another. The form keeps the first case's *severity* and *status* while its hidden `case_id` switches to the second case.
2. **Supervisors can't reach any কর্মসূচি screen (High, Confirmed).** The requirements say supervisors plan sessions, view coverage and investigate AEFI, and the pages, actions and RLS all allow them. The `/admin` layout redirects every non-admin, so the supervisor workflow does not exist in the UI.
3. **Two of the three charts show nothing (High, Confirmed live).** Every bar in the Coverage trend is 0px tall because of a CSS bug. The Reports daily-dose chart always says "কোনো তথ্য নেই।" because its materialized view was revoked from the role the page queries with.
4. **Sessions don't account for sessions that never happened (High, Confirmed live).** 16 of 113 sessions are past-dated, still "পরিকল্পিত" and have no doses. No filter shows them, no action applies to them, and the cancellation rate leaves them out. The "আসন্ন সেশন" card shows ০.
5. **The same metric disagrees across screens (High, Confirmed live).** Penta registry coverage is ৭৪% (৮৪৭/১১৫০) on Reports and ৭৩% (৭৪৮/১০২১) on Coverage. Colour thresholds differ (90/70 vs 80/50). The zero-dose card says ২৪ and links to a list whose badge says ৩০.
6. **Actions can report success when nothing changed (High, Strong indication).** Cancel and classify call `.update()` without checking the row count, so an RLS-filtered or already-changed row returns "সেশন বাতিল হয়েছে।".
7. **UI copy reads like design notes, not guidance.** Descriptions explain the designers' reasoning. Jargon like "হর" and ambiguous verbs like "প্রয়োগ করুন" (which also means "administer") make the screens harder for field managers.

Phase 1 (≈ 6 engineering days) fixes the Critical item and four of the six High items (K-02, K-03, K-04, K-06). It also settles supervisor access (K-01), which needs a product owner because it means either opening `/admin` to supervisors or building a supervisor shell. The other two High items (K-05, K-09) land in Phase 2.

**Findings at a glance:** 1 Critical · 6 High · 16 Medium · 4 Low · 4 open verification items · 6 verified-good controls.

---

## 2. Current কর্মসূচি System Overview

| Nav item | Route | Page guard | MFA gate | Data source | Primary job |
|---|---|---|---|---|---|
| এলাকাভিত্তিক কভারেজ | `/admin/coverage` | `requireAppRole("supervisor")` | ✅ | RPC `coverage_by_area` (invoker), RPC `monthly_doses` (definer, re-scoped) | Coverage by area with drill-down, registry vs population |
| টিকাদান সেশন | `/admin/sessions` | `requireAppRole("supervisor")` | ✅ | `v_session_tally`, `sessions`, `facilities`, `locations`, `user_assignments`, `profiles` | Plan and cancel sessions, see tallies |
| রিপোর্ট | `/admin/reports` (+ `/export`) | `requireRole("admin")` | ❌ | `v_coverage`, `v_dropout`, `mv_daily_doses` | Antigen coverage, dropout, daily doses, CSV |
| টিকা-পরবর্তী ঘটনা | `/admin/aefi` | `requireAppRole("supervisor")` | ✅ | `v_aefi_cases` | AEFI case investigation and WHO classification |
| তথ্যের মান | `/admin/data-quality` | `requireAppRole("supervisor")` | ❌ | `v_data_quality` | Data completeness and timeliness by area |

All five sit under `app/(admin)/admin/layout.tsx`, which calls `requireRole("admin")` before any page guard runs.

Live data at audit time: 341 active registered children, 856 doses, 113 sessions (90 held · 7 cancelled · 16 planned, all past-dated), 15 AEFI cases (7 open, 1 overdue serious), population estimate for Dhaka division only (২৯০৮০).

## 3. User Roles & Responsibilities

Source: the capability matrix in `docs/VaxTrace_System_Analysis_and_Requirements_Report.md` (lines 699–721) compared with the implementation.

| Capability | Required for | Implemented for | Gap |
|---|---|---|---|
| View coverage reports | field_worker @scope, supervisor @scope, programme_manager @scope, system_admin global | programme_manager, system_admin only | **Supervisor and field worker have no access** |
| Plan session / campaign | supervisor @scope, programme_manager @scope | programme_manager, system_admin | **Supervisor has no access** |
| Investigate / classify AEFI | supervisor and above (RLS policy `aefi_cases_update`, action error text "সুপারভাইজার বা তার ঊর্ধ্বতনের কাজ") | programme_manager, system_admin | **Supervisor has no access** |
| Export data (CSV/PDF) | supervisor @scope, programme_manager @scope, store_keeper @facility | programme_manager, system_admin | **Supervisor has no access** |
| Review data quality | supervisor (requirements §"supervisor … review data quality") | programme_manager, system_admin | **Supervisor has no access** |

Why: `lib/roles.ts:29` maps `supervisor → "worker"`, `app/(admin)/admin/layout.tsx:23` admits only `"admin"`, and the worker shell (`app/(worker)/worker`) has two pages (home, register child). See K-01.

---

## 4. Screen-by-Screen Findings

Each row gives the finding ID, then its details in §12/§13.

### 4.1 এলাকাভিত্তিক কভারেজ
| ID | Finding | Class | Sev |
|---|---|---|---|
| K-04 | 12-month trend: every bar renders at 0px; months with no data are dropped (10 bars under "গত ১২ মাসে") | Confirmed | High |
| K-07 | Raw Postgres errors shown to users; `year=abc` renders `NaN` in the year select and banner | Confirmed | Medium |
| K-09 | Registry coverage for Penta disagrees with Reports | Confirmed | High |
| K-10 | Tone thresholds differ from Reports/Dashboard | Confirmed | Medium |
| K-12 | Zero-dose card (২৪, 12–23 mo) links to a list badged ৩০ (<12 mo); "নিবন্ধিত" cells link to unfiltered `/admin/children` | Confirmed | Medium |
| K-13 | Population coverage numerator not tied to the denominator year; the date filter silently applies to some columns only | Strong indication | Medium |
| K-14 | Reversed date range accepted silently, giving ০% | Confirmed | Medium |
| K-22 | Mobile: 3 of 8 columns visible, trend overflows its card, 10px labels | Confirmed | Medium |
| K-25 | "হর", "হর-বছর", "প্রয়োগ করুন", Latin-digit years, `mm/dd/yyyy` | Confirmed | Medium |

### 4.2 টিকাদান সেশন
| ID | Finding | Class | Sev |
|---|---|---|---|
| K-05 | 16/113 sessions stuck as past-dated "পরিকল্পিত": no filter, no action, excluded from the cancellation rate | Confirmed | High |
| K-06 | Cancel reports success when no row was updated | Strong indication | High |
| K-17 | Plan form offers 164 locations incl. country/division/district; no search; date rule client-only | Confirmed | Medium |
| K-18 | Cancel panel opens below the whole table; no focus move; stays open after success; not the shared confirm dialog | Confirmed | Medium |
| K-19 | Loads every session twice (view + table), paginates in the browser | Confirmed | Medium |
| K-23 | "ট্যালি ছাপুন" prints only the current page (30 of 113) plus search box and chips | Confirmed (code) | Low |
| K-25 | Times in Latin digits (`09:00–13:00`) beside Bengali dates | Confirmed | Low |

### 4.3 রিপোর্ট
| ID | Finding | Class | Sev |
|---|---|---|---|
| K-03 | "দৈনিক প্রদত্ত ডোজ" always empty — `mv_daily_doses` revoked from `authenticated` | Confirmed | High |
| K-08 | No MFA gate on page or CSV export | Confirmed (code) | Medium |
| K-11 | Top-bar period picker (গত ৭/৩০/৯০/৩৬৫ দিন) changes the URL only | Confirmed | Medium |
| K-09/K-10 | Numbers and colours disagree with Coverage | Confirmed | High / Medium |
| K-28 | Dropout for single-dose antigens (BCG, IPV) shows a meaningless ০%; no area filter; errors swallowed; no empty states | Confirmed | Low |

### 4.4 টিকা-পরবর্তী ঘটনা (AEFI)
| ID | Finding | Class | Sev |
|---|---|---|---|
| K-02 | Switching cases keeps the previous case's severity/status in the form | **Confirmed live** | **Critical** |
| K-06 | Classify reports success when RLS filtered the update | Strong indication | High |
| K-15 | Classified cases can't be edited or closed (5 of 15 stuck); overdue serious case listed 13th of 15 | Confirmed | Medium |
| K-16 | Every save overwrites `investigated_by`; severity can be downgraded (clearing "overdue") with no reason; 1–2 char note hits a DB constraint and returns a generic error | Confirmed (code) | Medium |
| K-18 | Panel opens 556px (desktop) / 2,875px (mobile) below the clicked button | Confirmed | Medium |
| K-25 | Three names for one thing: nav "টিকা-পরবর্তী ঘটনা", title "টিকা-পরবর্তী বিরূপ ঘটনা (AEFI)", sessions column "AEFI"; গুরুতর vs মারাত্মক | Confirmed | Medium |

### 4.5 তথ্যের মান
| ID | Finding | Class | Sev |
|---|---|---|---|
| K-20 | Headline cards read only the depth-1 (country) row, so a sub-national user sees ০/— in green | Strong indication | Medium |
| K-20 | "এন্ট্রির গড় বিলম্ব" is a median; shown as "৮২৬৭ ঘণ্টা" (≈৩৪৪ দিন); every row red; ~100 rows, no sticky header, no level labels (three "ঢাকা" rows), no drill-through | Confirmed | Medium |
| K-08 | No MFA gate | Confirmed (code) | Medium |

---

## 5. Requirement Analysis

| Requirement (source) | Current behaviour | Verdict |
|---|---|---|
| Supervisor plans sessions @scope (capability matrix) | Supervisor redirected to `/worker` | **Not met** (K-01) |
| Session cancellation rate is measurable (`sessions` table comment, BS-03) | Rate = cancelled ÷ (held + cancelled); 16 unreported sessions invisible | **Partially met**: needs an "অনুষ্ঠিত হয়নি / রিপোর্ট হয়নি" state (K-05) |
| Serious AEFI investigated within 48h (`v_aefi_cases.investigation_overdue`) | Flag exists; list sorted by onset date, so the overdue case sits near the bottom | Met in data, **not surfaced** (K-15) |
| AEFI lifecycle reported → investigated → classified → closed | UI edit path disappears once causality is set; "closed" unreachable | **Not met** (K-15) |
| Every KPI drills to its rows (comment at `coverage/page.tsx:269`) | Registered cell → unfiltered list; zero-dose → different definition; data-quality → no links | **Partially met** (K-12, K-20) |
| Reports can be scoped to a period (`DateScope.tsx:7–13`) | Picker has no effect on Reports | **Not met** (K-11) |
| Time dimension for coverage (BS-10) | Trend chart invisible; empty months dropped | **Not met** (K-04) |
| MFA required for elevated roles (SEC-03, `require_mfa_elevated`) | Enforced on 3 of 5 screens; not on Reports, Data Quality, CSV export | **Inconsistent** (K-08) |
| One vocabulary and one tone scale (`lib/programme.ts` header) | Second tone scale in `Chart.tsx` and inline in Reports | **Not met** (K-10) |

Requirements that are **questionable as written**:
- *Population coverage without a date window.* `coverage_by_area` divides **all-time** final-dose children by **one year's** surviving infants unless the user enters a date range. The indicator is only defensible for an annual cohort, so default the window to the denominator year (K-13).
- *Two zero-dose definitions under one label.* Both definitions are valid (the DB comment says so). The UI must name them differently, or the numbers look like an error (K-12).

---

## 6. UX Analysis

**Information hierarchy.** Each screen opens with a paragraph that explains the designers' reasoning ("দুটির পার্থক্যই সেই শিশুরা, যাদের সিস্টেম এখনো চেনে না।") rather than what the user can do. Primary actions are buried: "নতুন সেশন পরিকল্পনা" sits below a 4-page table, and the AEFI classify panel appears below the whole list.

**Workflow gaps.** No way to record that a planned session did not happen (K-05). No way to close a classified AEFI case (K-15). Supervisors, the intended operators, have no access at all (K-01).

**Feedback.** Success messages can be false (K-06). Errors surface raw SQL (K-07) or are swallowed, leaving an empty chart that looks like "no data" (K-03, Reports tables). After cancelling, the form stays open with an active "সেশন বাতিল করুন" button.

**Filtering.** Coverage uses a GET form, which is good (shareable, back-button friendly). But:
- Its date range applies only to some columns, with no label saying which (K-13).
- Reversed ranges aren't caught (K-14).
- The year list is built from the current value, so a bad value produces four `NaN`s.

Sessions and AEFI chips are client-side and don't persist in the URL, so a filtered view can't be shared or survive a reload. The Reports period picker does nothing (K-11).

**Destructive and irreversible actions.** Cancelling a session uses an inline form with no confirmation step, while the codebase already ships a native-`<dialog>` `ConfirmButton` (`components/ui/kit.tsx:261`). AEFI classification is an irreversible clinical claim, and in the UI it cannot be reversed at all (K-15). It is also exposed to K-02.

**Discoverability of state.** Session rows past their date with status "পরিকল্পিত" look identical to future ones. The only overdue AEFI case is visually distinguished (a red badge) but sorted near the bottom.

**Cognitive load.** Data Quality shows ~100 undifferentiated rows, all flagged red, so the colour carries no signal. Coverage shows 7 of 8 divisions as rows of ০ and "—" chips.

## 7. UI & Card Design Analysis

| Component | Observation | Evidence | Recommendation |
|---|---|---|---|
| `StatCard` | 4-up KPI row on every screen; at <640px stacks to 1 column and uses 515px (AEFI) before any record | Mobile measurement | 2-column grid from 0px; drop the `hint` on mobile or collapse it |
| `StatusBadge` | Light-theme contrast 4.01 (danger), 4.16 (success), 4.17 (warning), 4.49 (primary) at 12px, all below 4.5:1 | Computed from live tokens | Darken tone text or tint in light theme (dark theme passes 5.2–8.0) |
| "—" rendered inside a badge | Coverage rows with no data render grey "—" chips in 3 columns, which reads as a status | Screenshot, 7 division rows | Render a plain "—" without a badge when the value is null |
| `TrendBars` / Reports daily bars | Percent heights inside an un-stretched flex item resolve to 0 | `TrendBars.tsx:33` (`items-end`), live: 62–100% → 0px | See K-04; one shared bar-chart component for both |
| Code cells (`AEFI-000008`, batch `PCV-2026-NEAR2`) | Wrap at the hyphen on desktop | Screenshot | `whitespace-nowrap` on identifier cells |
| Page headers | Coverage/Sessions/AEFI use `PageHeader`; Reports and Data Quality hand-roll `<header>` | `reports/page.tsx:26`, `data-quality/page.tsx:34` | Use `PageHeader` everywhere |
| Buttons | Raw `<button>`/`<a>` with ad-hoc classes (filter submit, CSV, cancel, pagination, print) next to the shared `Button` | Multiple files | Use `components/ui/Button` |
| Tokens | কর্মসূচি files use legacy `--color-*` aliases; kit/nav use `--text-*`/`--accent` | `packages/ui-tokens/tokens.css:102–112` notes "~400 call sites" | Migrate কর্মসূচি files while touching them |
| Tables | No sticky header on 100-row Data Quality table; card view on mobile works well for Sessions/AEFI | Scroll test | `sticky top-0` on `thead` inside the scroll box |

## 8. Bengali Content Analysis

**Pattern.** The UI strings translate code comments. They explain *why the system was designed this way* instead of *what the user should do*, and they lean on em dashes and aphorisms ("রিপোর্ট না হওয়া আর না ঘটা এক জিনিস নয়"). That is the "AI tone". The fix is shorter, task-first sentences.

### 8.1 Copy corrections (current → proposed)

| # | Where | Current | Proposed | Why |
|---|---|---|---|---|
| 1 | Coverage description | নিবন্ধন-ভিত্তিক কভারেজ বলে আমাদের নথিভুক্ত শিশুদের কত অংশ … যাদের সিস্টেম এখনো চেনে না। | এলাকা অনুযায়ী টিকার কভারেজ। এলাকার নামে ক্লিক করলে নিচের স্তর দেখা যাবে। *(definitions move to an "হিসাব কীভাবে?" disclosure)* | Task first; definitions on demand |
| 2 | Disclosure text (new) | — | **নিবন্ধন-ভিত্তিক:** নিবন্ধিত শিশুদের যেসব ডোজের সময় হয়েছে, তার কত শতাংশ দেওয়া হয়েছে। **জনসংখ্যা-ভিত্তিক:** এলাকার লক্ষ্য শিশুদের কত শতাংশ শেষ ডোজ পেয়েছে। | Plain definitions |
| 3 | Filter label | হর-বছর | লক্ষ্য শিশুর বছর | "হর" (denominator) is maths jargon |
| 4 | Card label | লক্ষ্য শিশু (হর) | লক্ষ্য শিশু | Same |
| 5 | Warning link | হর যোগ করুন | জনসংখ্যার হিসাব যোগ করুন | Same |
| 6 | Card hint | হর ছাড়া তুলনা করা যায় না | জনসংখ্যার হিসাব নেই, তাই তুলনা করা যাচ্ছে না | Same |
| 7 | Filter labels | ডোজের সময়কাল — শুরু / শেষ | ডোজের তারিখ: থেকে / পর্যন্ত | Natural pair |
| 8 | Filter button | প্রয়োগ করুন | ফলাফল দেখুন | "প্রয়োগ" also means *administer*; the stock ledger uses "প্রয়োগকৃত" for administered doses |
| 9 | Vaccine option | সব টিকা (জনসংখ্যা-ভিত্তিক হিসাব ছাড়া) | সব টিকা | The card already explains |
| 10 | Card hint | একটি নির্দিষ্ট টিকা বেছে নিলে এই হিসাব সম্ভব | একটি টিকা বেছে নিলে এই হিসাব দেখা যাবে | Simpler |
| 11 | Breadcrumb root | সব | সব এলাকা | Standalone "সব" is unclear |
| 12 | Trend helper | সময়ের মাত্রা ছাড়া কভারেজ কেবল বাড়তে পারে, কমতে পারে না — তাই খারাপ হতে থাকা কর্মসূচি ধরা পড়ে না। | মাসভিত্তিক প্রদত্ত ডোজ। কোনো মাসে ডোজ কমে গেলে সেই মাসের সেশনগুলো দেখুন। | Actionable |
| 13 | Coverage error | কভারেজের হিসাব আনা যায়নি: {error.message} | কভারেজের হিসাব দেখানো যাচ্ছে না। ফিল্টারগুলো ঠিক আছে কিনা দেখে আবার চেষ্টা করুন। | No raw SQL (K-07) |
| 14 | Zero-dose card | শূন্য-ডোজ শিশু / ১২–২৩ মাস বয়সী, যারা পেন্টা-১ কখনো পায়নি | শূন্য-ডোজ (১২–২৩ মাস) / পেন্টা-১ কখনো পায়নি | Distinguish from the <12-month list (K-12); use the configured marker name, not a hard-coded "পেন্টা-১" |
| 15 | Sessions description | নির্ধারিত কেন্দ্র, আউটরিচ ও ক্যাম্পেইন — কোথায়, কবে, কে। প্রতিটি ডোজ … আলাদা কাগজে রাখতে হয় না। | স্থায়ী কেন্দ্র, আউটরিচ ও ক্যাম্পেইন সেশনের পরিকল্পনা ও ফলাফল। সেশনে দেওয়া ডোজ এখানে নিজে থেকে যোগ হয়। | Task first |
| 16 | Session type `fixed` | নির্ধারিত কেন্দ্র | স্থায়ী কেন্দ্র | "নির্ধারিত" also means *scheduled*, which clashes with status "পরিকল্পিত"; "স্থায়ী কেন্দ্র" is the EPI field term *(confirm with the programme team)* |
| 17 | Plan-form helper | কেন্দ্র হলো *কে চালাচ্ছে*, এলাকা হলো *কোথায় হচ্ছে*। আউটরিচে দুটি আলাদা — … সেবা পেয়েছে বলে দেখাবে। | আউটরিচ সেশনে "সেশনের স্থান" হবে যে ওয়ার্ডে সেশন বসছে, কেন্দ্রের নিজের ওয়ার্ড নয়। | One instruction |
| 18 | Plan-form labels | সেবা কেন্দ্র (কে চালাচ্ছে) / এলাকা (কোথায় হচ্ছে) | পরিচালনাকারী কেন্দ্র / সেশনের স্থান | Labels, not sentences |
| 19 | Cancel helper | কারণ অনুযায়ী বাতিলের হারই সেই সংখ্যা, যা দিয়ে আউটরিচের যানবাহন … প্রমাণ করা যায়। | কারণটি বাতিলের প্রতিবেদনে দেখানো হবে। | Drop the justification |
| 20 | Cancel secondary button | ফিরে যান | না, সেশন রাখুন | States what happens |
| 21 | Stat hint (held) | ডোজ নথিভুক্ত হয়েছে | অন্তত একটি ডোজ নথিভুক্ত | Accurate: `held` = ≥1 dose (trigger) |
| 22 | Print labels | PDF রপ্তানি / রিপোর্ট ছাপুন / ট্যালি ছাপুন | প্রিন্ট / PDF (everywhere) | It is `window.print()`, not an export |
| 23 | AEFI nav / title / column | টিকা-পরবর্তী ঘটনা / টিকা-পরবর্তী বিরূপ ঘটনা (AEFI) / AEFI | টিকা-পরবর্তী বিরূপ প্রতিক্রিয়া (AEFI) in title; **AEFI** in nav, columns, badges | One term |
| 24 | AEFI description | প্রতিটি ঘটনা একটি কেস — কোন টিকা, কোন ব্যাচ, … রিকলের সময় প্রশ্নের উত্তর দেয়। | রিপোর্ট হওয়া প্রতিটি AEFI-এর তদন্ত ও WHO শ্রেণিবিন্যাস এখানে করুন। মারাত্মক কেসের তদন্ত ৪৮ ঘণ্টার মধ্যে শুরু করতে হবে। | Task and deadline |
| 25 | AEFI empty state | শূন্য থাকা ভালো খবর, তবে মনে রাখুন — রিপোর্ট না হওয়া আর না ঘটা এক জিনিস নয়। | টিকার রেকর্ডে বিরূপ প্রতিক্রিয়া লেখা হলে কেস এখানে দেখা যাবে। | No lecturing |
| 26 | Severity options | মৃদু / গুরুতর / মারাত্মক | মৃদু / গুরুতর (চিকিৎসা লেগেছে) / মারাত্মক (ভর্তি, স্থায়ী ক্ষতি বা মৃত্যু) | গুরুতর and মারাত্মক are near-synonyms; the WHO *severe* vs *serious* distinction has to be visible. Keep the labels and add qualifiers *(confirm with the DGHS AEFI guideline)* |
| 27 | AEFI row action | তদন্ত / শ্রেণিবিন্যাস | তদন্ত করুন | Verb, one action |
| 28 | AEFI RLS error | এই কেসটি শ্রেণিবদ্ধ করার অনুমতি নেই — এটি সুপারভাইজার বা তার ঊর্ধ্বতনের কাজ। | এই কেস পরিবর্তনের অনুমতি আপনার নেই। সুপারভাইজার বা ঊর্ধ্বতন কর্মকর্তা এটি করতে পারবেন। | Polite, direct |
| 29 | Reports title | রিপোর্ট ও পরিসংখ্যান (nav: রিপোর্ট) | রিপোর্ট | Match the nav |
| 30 | Coverage table headers | সম্পন্ন / দেয় | দেওয়া হয়েছে / দেওয়ার সময় হয়েছে | "দেয়" reads as "gives"; also fix nav badge "টি দেয় ডোজ" → "টি ডোজের সময় হয়েছে" |
| 31 | Dropout headers | শুরু করেছে / সম্পূর্ণ করেছে | প্রথম ডোজ পেয়েছে / শেষ ডোজ পেয়েছে | Concrete |
| 32 | Chart legend | ড্যাশ লাইন = লক্ষ্যমাত্রা ৮০% | ড্যাশ দাগ: লক্ষ্যমাত্রা ৮০% | Natural Bengali |
| 33 | Data-quality description | কভারেজের সংখ্যা বিশ্বাস করার আগে যাচাই। প্রতিটি হিসাব … নতুন কোনো ডেটা এন্ট্রি লাগে না। | এলাকা অনুযায়ী তথ্যের ঘাটতি ও এন্ট্রিতে দেরি। | Task first |
| 34 | Lag card | এন্ট্রির গড় বিলম্ব · ৮২৬৭ ঘণ্টা | এন্ট্রিতে দেরি (মধ্যক) · ৩৪৪ দিন | It is a median; hours are unreadable at this scale |
| 35 | Card / column | নম্বরবিহীন অভিভাবক / নম্বর নেই | ফোন নম্বর নেই | Which number? |
| 36 | Card | কেন্দ্রবিহীন ডোজ | কেন্দ্রের নাম ছাড়া ডোজ | Natural |
| 37 | Card hint | স্বাভাবিক — নিবন্ধনের পূর্বশর্ত নয় | জন্ম নিবন্ধন ছাড়াও শিশু নিবন্ধন করা যায় | Plain |
| 38 | Column | একীভূত | একীভূত (ডুপ্লিকেট) | Context |

### 8.2 Terminology guideline (proposed glossary)

| Concept | Use | Avoid |
|---|---|---|
| Denominator | লক্ষ্য শিশু / জনসংখ্যার হিসাব | হর |
| Fixed site | স্থায়ী কেন্দ্র | নির্ধারিত কেন্দ্র |
| Administered | প্রদত্ত / দেওয়া হয়েছে | প্রয়োগ (for non-dose actions) |
| Due | দেওয়ার সময় হয়েছে | দেয় |
| AEFI | AEFI (first mention: টিকা-পরবর্তী বিরূপ প্রতিক্রিয়া) | টিকা-পরবর্তী ঘটনা |
| Median | মধ্যক | গড় (= mean) |
| Print/PDF | প্রিন্ট / PDF | রপ্তানি (for print), ছাপুন/প্রিন্ট mixed |

**Numerals and dates.** Every number the user reads should go through `toBn`. That includes years (`CoverageFilters.tsx:57–60`), times (`sessions/page.tsx:64–67`) and chart tooltips (`reports/page.tsx:135`). Native `type="date"`/`type="time"` inputs render `mm/dd/yyyy` and `--:-- --` from the browser locale. Add a `দিন/মাস/বছর` hint under each, or format the chosen value beside the input.

---

## 9. Security Analysis

Format: Observation → Evidence → Risk → Mitigation.

**S-1 · Supervisor access blocked above a correct RLS layer (K-01).** Access control is **over-restrictive**, not bypassable. Evidence: `layout.tsx:23` vs page guards `requireAppRole("supervisor")` and RLS `sessions_insert/update`, `aefi_cases_update` (`auth_has_role(['supervisor',…])`). Risk: workflow denial. Staff will share admin accounts to get work done, and that is the real security risk. Mitigation: product decision in Phase 1 (task P1-9).

**S-2 · Server actions trust `.update()` without a row count (K-06).** Evidence: `sessions/_actions.ts:93–102`, `aefi/_actions.ts:63–84`. In Postgres, an UPDATE whose rows fail the RLS `USING` clause affects 0 rows **without raising an error**, so the `"row-level security"` branch is unreachable for that case and the user sees success. Risk: false audit belief ("I cancelled it"), duplicate work. Mitigation: `.select("id")` and fail when the result is empty.

**S-3 · Raw database errors rendered (K-07).** Evidence, live: `?area=1.2)` → "ltree syntax error at character 4"; `?vaccine=x` → `invalid input syntax for type uuid: "x"` (`coverage/page.tsx:228–231`). Risk: low, since the users are authenticated admins, but it leaks schema detail and is an unvalidated trust boundary. Mitigation: zod-parse `searchParams` (uuid, ltree pattern `^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$`, 4-digit year, ISO dates, from ≤ to), log the raw error server-side and show copy #13.

**S-4 · MFA gate applied inconsistently (K-08).** Evidence: `mfaGate` is called in coverage/sessions/aefi, but not in `reports/page.tsx:12`, `reports/export/route.ts:8` or `data-quality/page.tsx:16`. The DB-side `mfa_satisfied()` covers role grants, settings, denominator writes and the audit trail, not reporting views. Risk: with `require_mfa_elevated` on, an aal1 programme manager is blocked from Coverage but can read Reports and download the CSV. Mitigation: call `mfaGate` in the admin layout once (it is a no-op below programme_manager), so no page can forget it.

**S-5 · AEFI `investigated_by` overwritten on any save (K-16).** Evidence: `aefi/_actions.ts:71`. `investigated_at` is only stamped once (`trg_aefi_stamp`, sql:437–440), so the two can name different people. Risk: accountability record is wrong; the audit trigger preserves history, but the case row misleads. Mitigation: set `investigated_by` only on the first transition into `under_investigation`/`classified`; keep editors in the audit log.

**S-6 · Severity downgrade silently clears the 48-hour overdue flag (Requires Verification of policy intent).** Evidence: overdue is `severity='serious' AND status IN (...)` (`tracing_and_aefi.sql:532–534`). The form lets any supervisor+ change severity with no reason. Risk: a missed SLA can be hidden; `aefi_cases_audit` records it, but nobody reviews it. Mitigation: require a reason when severity goes down, and show "মাত্রা পরিবর্তিত" on the case.

**S-7 · No DB-level status transition guard (Potential).** Evidence: `sessions_update` and `aefi_cases_update` policies allow any column change for supervisor+ in scope. Only `sessions_cancel_reason` and `aefi_*_complete` constrain the shape. A held session with doses can be set to `cancelled` via the Data API, and a closed AEFI case re-opened fails with a raw constraint error because `closed_at` is never cleared. Risk: data integrity through direct API use; audited. Mitigation: BEFORE UPDATE triggers enforcing allowed transitions (planned→held|cancelled; reported→under_investigation→classified→closed, plus an explicit re-open path).

**S-8 · CSV formula injection not neutralised (Potential, Low).** Evidence: `lib/csv.ts:5–8` quotes `",\n\r` but does not prefix `= + - @`. The coverage export only contains admin-managed catalog names. Other exports reusing `csvCell` may carry user-entered text *(verify which)*. Mitigation: prefix `'` to cells starting with `= + - @ \t \r`.

**Verified-good controls (no action):**
1. RLS role × scope on `sessions`, `aefi_cases` including `WITH CHECK` (`sessions_stock_coldchain.sql:815–835`, `tracing_and_aefi.sql:583–604`).
2. `security_invoker` on every view used here; `coverage_by_area` is invoker; `monthly_doses` (definer) re-applies `auth_scopes()`.
3. `mv_daily_doses` and `mv_coverage_monthly` not granted to `authenticated`, which is correct. K-03 is the consequence of reading one from the wrong client.
4. Unauthenticated `GET /admin/coverage` and `/admin/reports/export` return redirects (verified live).
5. Audit triggers on `sessions` and `aefi_cases`.
6. DB constraints mirror form rules (cancel reason 3–300, classified ⇒ causality, time order).

## 10. Accessibility Analysis

| Check | Result | Evidence |
|---|---|---|
| Focus visible | ✅ Global `:focus-visible` outline | `globals.css:60` |
| Skip link, `aria-current`, grouped nav lists, table caption (Coverage) | ✅ | `layout.tsx:87`, `AdminNav.tsx:139–192`, `coverage/page.tsx:236` |
| Status badge contrast (light) | ❌ 4.01–4.49:1 at 12px | Computed from live tokens |
| Status badge contrast (dark) | ✅ 5.2–8.0:1 | Same |
| Minimum text size | ❌ 10px chart labels; 11px nav headings; the token file sets 13px as the floor for Bengali | `TrendBars.tsx:39,48`, `reports/page.tsx:137`, `tokens.css:118–119` |
| Charts have a text alternative | ❌ Bars have no accessible name; Reports bars rely on `title` | `TrendBars.tsx`, `reports/page.tsx:135` |
| Focus management for inline panels | ❌ Focus stays on the trigger while the panel renders 556–2,875px away | Live measurement |
| Truncated text | ❌ Cancel reason cut to 24 chars, full text only in `title` (not keyboard/touch reachable) | `SessionsTable.tsx:101–104` |
| Target size | ⚠️ Chips and pagination 26px tall; passes WCAG 2.2 AA (24px), below the 44px recommended for field tablets | Live measurement |
| Required-field cue | ⚠️ Plan form uses `required` with no visual marker; AEFI marks causality with a red `*` only | Code |
| Language | ⚠️ Confirm `<html lang="bn">`; date/time inputs follow browser locale | — |

## 11. Responsive Analysis (375px)

| Screen | Result |
|---|---|
| Coverage | Filters wrap acceptably. The table shows 3 of 8 columns and the coverage columns need an un-signposted sideways scroll. The trend `<ul>` is 385px inside a 301px card, so labels run past the card edge. |
| Sessions | Card view works. The 4 KPIs stack to ~500px. The plan form is below all cards. |
| AEFI | Card view works. 4 KPIs use 515px. The classify panel opens **2,875px (3.5 screens)** below the tapped card. |
| Reports | Tables scroll inside their boxes; the period picker is hidden below `sm` (it does nothing anyway, K-11). |
| Data Quality | 7-column table, `min-w-[52rem]`, ~100 rows; heavy on a phone. A card-per-area view with only non-zero issues would suit mobile. |
| Page-level overflow | ✅ None (document scroll width = viewport). |

---

## 12. Confirmed Issues

Ordered by priority: security → correctness → task disruption → data integrity → accessibility → UX → visual → performance → maintainability.

| ID | Sev | Finding | Evidence | Impact | Recommendation |
|---|---|---|---|---|---|
| **K-02** | **Critical** | AEFI classify panel keeps the previous case's severity and status when a different case is opened | `AefiTable.tsx:134` renders `<ClassifyPanel row={active}>` without `key`; `useState(row.status)` (141) and `defaultValue` selects (184, 199) don't reset. **Live:** open AEFI-000010, then AEFI-000007 → heading and `case_id` = 000007, severity = গুরুতর, status = রিপোর্টকৃত (000007 is মৃদু / তদন্তাধীন) | Saving writes one child's clinical severity/status onto another child's case, which misreports a safety signal | `<ClassifyPanel key={active.id} …/>`; same for `CancelForm key` in `SessionsTable.tsx:129` |
| K-01 | High | Supervisors cannot reach কর্মসূচি; requirements assign them session planning, coverage, AEFI investigation, data-quality review, export | `layout.tsx:23`, `roles.ts:29`, requirements matrix lines 699–721, worker shell has 2 pages | The intended primary operators have no UI; admin-account sharing becomes likely | Product decision: admit `supervisor` to `/admin` with a filtered nav, **or** add a supervisor section to the worker shell. Page guards and RLS already support it |
| K-03 | High | Reports daily-dose chart always empty | `harden.sql:16` revokes `mv_daily_doses` from `authenticated`; `reports/page.tsx:19` queries it with the user client; error ignored. Live: "কোনো তথ্য নেই।" with 856 doses on record | Chart is dead; users infer no activity | Replace with `monthly_doses` or a new scoped `daily_doses(p_days)` definer RPC that applies `auth_scopes()`; handle `error` |
| K-04 | High | Coverage trend bars invisible; empty months dropped | `TrendBars.tsx:33` `items-end` stops `<li>` stretching, so `%` height → 0 (live: 62–100% → 0px). `monthly_doses` (sql:341–351) returns only months with rows; 10 bars for "১২ মাস" (Aug–Sep 2026 missing) | The only time-series view is blank | Remove `items-end`, add `justify-end` to `<li>`; zero-fill with `generate_series` in SQL; show "হালনাগাদ: {date}" from `v_job_health` |
| K-05 | High | 16/113 sessions past-dated, still "পরিকল্পিত", zero doses; invisible to filters/stats/actions | Live counts; `sessions/page.tsx:77–82`; `held` only set by dose trigger (`sessions_stock_coldchain.sql:157–168`); cancel button only if `date ≥ today` (`SessionsTable.tsx:91`) | Unreported and missed sessions vanish; the cancellation rate is overstated as good (৭% of 97 instead of accounting for 113) | Derived state "রিপোর্ট হয়নি" (planned ∧ date < today); filter chip, stat card, and an action to cancel it with a reason after the date |
| K-09 | High | Registry coverage differs between screens (Penta ৭৪% vs ৭৩%) | Live; `v_coverage` counts all schedules (`defect_sweep.sql:662`) while `coverage_by_area` restricts to `routine`, active, non-deleted (sql:213–221) | Two official numbers for one indicator | Redefine `v_coverage` with the same filters, or point Reports at `coverage_by_area` totals |
| K-07 | Medium | Raw SQL errors; `NaN` year | Live (§9 S-3); `coverage/page.tsx:42`, `CoverageFilters.tsx:23` | Confusing, leaks schema | Validate `searchParams` with zod; generic copy #13 |
| K-08 | Medium | MFA gate missing on Reports, CSV export, Data Quality | §9 S-4 | Policy bypass for aal1 elevated users | `mfaGate` in admin layout |
| K-10 | Medium | Three tone scales for coverage/dropout | `programme.ts:143–158` (90/70; 10/5), `Chart.tsx:19,31` (80/50), `reports/page.tsx:71–79,114` (80/50; 10) | 85% is green on Reports and amber on Coverage | One `coverageTone`/`dropoutTone` + one target constant, used by all |
| K-11 | Medium | Reports period picker has no effect | `DateScope.tsx:13` lists `/admin/reports`; `ReportsPage` reads no `searchParams`. Live: range=7 → Penta ৮৪৭/১১৫০, same as default | Users quote an "last 7 days" figure that is all-time | Either wire `range` into the report queries or remove `/admin/reports` from `SCOPED` |
| K-12 | Medium | Drill-downs don't match their numbers | Zero-dose card ২৪ (12–23 mo) → page badge ৩০ (<12 mo), live; "নিবন্ধিত" cells → `/admin/children` without area (`coverage/page.tsx:271`); zero-dose card href drops area (209) | "The number changed when I clicked" breaks trust | Distinct labels (copy #14); pass `?area=`; add `?window=12-23` to the zero-dose list or link to a matching view |
| K-14 | Medium | `from > to` accepted; results silently ০% | Live `?from=2026-09-01&to=2026-01-01` | Wrong figures presented as valid | Client `min`/`max` coupling + server validation message |
| K-15 | Medium | Classified AEFI cases can't be edited or closed; list not ordered by urgency | `AefiTable.tsx:93–105` shows the action only when `causality` is null; 5 of 15 stuck; `aefi/page.tsx:26` orders by onset; overdue case at row 13 | Cases never reach "নিষ্পন্ন"; the SLA breach is easy to miss | Row action always available ("খুলুন"); order `overdue desc, severity desc, reported_at`; overdue banner at top |
| K-16 | Medium | AEFI save side effects | §9 S-5; note length: zod allows 1–2 chars (`aefi/_actions.ts:32`) but DB requires 3 (`tracing_and_aefi.sql:383`) → generic "কেস সংরক্ষণ করা যায়নি।" | Wrong investigator; unexplained failures | See S-5; `z.string().trim().min(3).max(2000).optional().or(z.literal(""))` |
| K-17 | Medium | Plan form accepts nonsensical locations and past dates server-side | Live: 164 options including "বাংলাদেশ · দেশ", 8 divisions, 64 districts; `sessions/_actions.ts:14` only checks `min(1)`; `min={today}` client-only | Sessions planned at country level; back-dated plans | Offer only ward/union-level (leaf) locations under the facility's upazila; searchable combobox; server rule `session_date ≥ today`; for `fixed`, enforce location = facility location |
| K-18 | Medium | Inline panels open far from the trigger; no focus move; cancel form stays after success; cancel not using the shared confirm dialog | Live 556px / 2,875px; `SessionsTable.tsx:129`, `AefiTable.tsx:134` | Users think nothing happened; mobile users lose their place | Use native `<dialog>` (as `ConfirmButton`) for both panels; close + toast on success |
| K-19 | Medium | Unbounded queries and browser-side pagination | `sessions/page.tsx:27–31` (all sessions, twice), `aefi/page.tsx:23–26`, `DataTable.tsx:26–28` (own ponytail note) | Page weight grows with every session/case; fine for demo data, not for a district | Server pagination via `.range()` + URL params, starting with Sessions |
| K-20 | Medium | Data Quality readability | Live (§4.5) | Screen doesn't answer "where should I act?" | Median label, days unit, level labels, sticky header, "শুধু সমস্যাযুক্ত এলাকা" toggle, links to filtered lists |
| K-21 | Medium | Accessibility gaps | §10 | AA contrast fail in light theme; chart unreadable by AT | See Phase 5 |
| K-22 | Medium | Mobile layout gaps | §11 | Key numbers off-screen on phones | See Phase 5 |
| K-25 | Medium | Bengali copy issues | §8 | Slower comprehension; ambiguity ("প্রয়োগ", "দেয়", "হর") | See Phase 4 |
| K-23 | Low | Print prints one page plus controls | `DataTable.tsx:71–110` has no `print:hidden`; pagination slices rows | Incomplete tally sheet | `print:hidden` on controls; render all rows when printing (`beforeprint` → page size ∞) |
| K-24 | Low | Mixed token vocabularies, raw buttons, hand-rolled headers | §7 | Drift; harder theming | Migrate while touching files |
| K-28 | Low | Reports: single-dose dropout rows, no scope filter, silent errors, no empty states | Live (BCG/IPV ০%), `reports/page.tsx` | Noise; ambiguous empties | Hide dropout for `total_doses = 1`; handle `error`; `EmptyState` |

## 13. Potential Issues Requiring Verification

| ID | Hypothesis | Why it's likely | How to verify |
|---|---|---|---|
| K-06 | Cancel/classify show success when 0 rows updated | Supabase `.update()` without `.select()` returns `error: null` on 0 rows; RLS `USING` filters silently | pgTAP or integration test: as a supervisor scoped to ward A, update a ward-B session via the action; expect an error message, not "সেশন বাতিল হয়েছে।" |
| K-13 | Population coverage mixes cohorts when no date range is set | `coverage_by_area.sql:174–175, 197–208`: numerator all-time, denominator one year | Seed an area with 3 years of final doses and 1 year of target; expect >100% |
| K-20a | Data-quality headline cards show ০ for sub-national users | `data-quality/page.tsx:27` picks the depth-1 path; RLS/view scope hides it for an upazila user | Sign in as an upazila-scoped programme manager |
| S-6 | Severity downgrade used to clear overdue flags | Form allows it without a reason | Review `admin_audit` for `aefi_cases` severity changes |
| S-7 | Illegal status transitions via Data API | Policies allow any column update | pgTAP: held → cancelled with doses; closed → reported |
| S-8 | CSV formula injection in exports that reuse `csvCell` | No prefix neutralisation | Grep export routes; insert `=HYPERLINK(...)` in a user-editable field; export |
| V-1 | `mv_coverage_monthly` refresh job is stale (Aug–Sep 2026 missing) or those months truly had no doses | 10 of 12 months returned | Check `v_job_health` row `refresh-coverage-monthly`; `select max(administered_date) from vaccination_records` |
| V-2 | Location `<option>` indentation (`" ".repeat`) collapses visually | Browsers normalise whitespace in option labels | Open the select on Chrome/Firefox/Android; switch to ` ` or `<optgroup>` if collapsed |

## 14. Prioritized Recommendations

1. **Fix K-02 now.** A one-line `key` prop removes a clinical data-corruption path.
2. **Make actions truthful (K-06).** Check affected rows; never report success on 0 rows.
3. **Restore the two charts (K-03, K-04).** They are the only time dimension in the programme area.
4. **Decide supervisor access (K-01).** Every other workflow improvement assumes the right people can open these screens.
5. **Close the session-state gap (K-05)** and the **AEFI lifecycle gap (K-15)**.
6. **One number, one colour (K-09, K-10, K-12).** Same indicator, same filters, same thresholds, same labels.
7. **Validate inputs at the trust boundary (K-07, K-14, K-16, K-17)** and **gate MFA once in the layout (K-08)**.
8. **Rewrite copy (K-25)** with the glossary in §8.2.
9. **Fix accessibility and mobile issues (K-21, K-22)**, then **pagination (K-19)**, then **maintainability (K-24)**.

---

## 15. Phase-Based Optimization Plan

### Phase 1 — Critical Correctness & Safety  *(≈ 6 days · Risk: Low–Medium)*
- **Objective:** no screen writes wrong data, reports false success, hides data it has, or leaks internals.
- **Solves:** K-02, K-06, K-03, K-04, K-07, K-08, K-16 (validation), decision on K-01.
- **Dependencies:** product owner decision for K-01; DB migration for the daily-dose RPC and zero-fill.
- **User impact:** AEFI data safe; charts visible; honest feedback.
- **Technical impact:** 1 migration, ~8 files.
- **Acceptance criteria:** see §17, P1.

### Phase 2 — Workflow & Data Integrity  *(≈ 6 days · Risk: Medium)*
- **Objective:** every session and case has a reachable next state; every indicator has one definition.
- **Solves:** K-05, K-15, K-09, K-10, K-11, K-12, K-13, K-14, K-17, S-5, S-6, S-7.
- **Dependencies:** Phase 1 (validation helpers, truthful actions); agreement on coverage methodology (K-13) with the programme lead.
- **User impact:** managers can close the loop on sessions and AEFI; numbers match across screens.
- **Technical impact:** 1–2 migrations (view redefinition, transition triggers), shared tone/target module.

### Phase 3 — Information Architecture & Interaction  *(≈ 5 days · Risk: Low–Medium)*
- **Objective:** the primary action and the most urgent item are visible without scrolling; state lives in the URL.
- **Solves:** K-18, K-19, K-20, K-23, K-28, the drill-down part of K-12.
- **Dependencies:** Phase 2 states (for filters/sorting).
- **User impact:** fewer clicks, shareable filtered views, complete printouts.
- **Technical impact:** DataTable gains server mode; dialogs replace inline panels.

### Phase 4 — Bengali UX & Terminology  *(≈ 2–3 days · Risk: Low)*
- **Objective:** task-first, consistent, natural Bengali.
- **Solves:** K-25, §8 items 1–38, numerals.
- **Dependencies:** sign-off on glossary terms marked *confirm* (স্থায়ী কেন্দ্র, severity qualifiers).
- **Technical impact:** strings only, plus `toBn` in 3 places.

### Phase 5 — Components, Accessibility & Responsive  *(≈ 3 days · Risk: Low)*
- **Objective:** WCAG 2.1 AA on these screens in both themes; usable at 375px.
- **Solves:** K-21, K-22, K-24, §7 items.
- **Dependencies:** none (can run in parallel with Phase 4).

### Phase 6 — QA & Validation  *(≈ 4 days, overlapping · Risk: Low)*
- **Objective:** every finding has a regression test or a scripted manual check; re-audit passes.
- **Dependencies:** all phases.

---

## 16. Detailed Micro-Task Backlog

Paths are relative to `apps/web/src` unless they start with `supabase/`.

### Phase 1
| Task | Change | Est |
|---|---|---|
| P1-1 | `app/(admin)/admin/aefi/_components/AefiTable.tsx:134` → `<ClassifyPanel key={active.id} row={active} …/>` | 0.1d |
| P1-2 | `app/(admin)/admin/sessions/_components/SessionsTable.tsx:129` → `<CancelForm key={active.id} …/>` | 0.1d |
| P1-3 | Test: render `AefiTable`, open case A, open case B, assert severity/status selects equal B's values (`tests/aefi.test.tsx`) | 0.3d |
| P1-4 | `sessions/_actions.ts` cancel: `.update(...).eq(...).eq("status","planned").select("id")`; if `data.length === 0` return `{ error: "সেশনটি বাতিল করা যায়নি — এটি আর পরিকল্পিত অবস্থায় নেই বা আপনার এলাকার বাইরে।" }` | 0.3d |
| P1-5 | `aefi/_actions.ts`: same `.select("id")` check; message per §8.1 #28 | 0.2d |
| P1-6 | Migration: `daily_doses(p_days int default 90)` security definer over `mv_daily_doses`/`vaccination_records` with `location_path <@ any(auth_scopes())`, grant to `authenticated`; `reports/page.tsx:19` calls it; render an error state when `error` | 0.5d |
| P1-7 | `coverage/_components/TrendBars.tsx:33` remove `items-end`; `<li>` gets `justify-end`; bar wrapper `flex-1 w-full flex items-end`; label `text-xs` | 0.2d |
| P1-8 | Migration: `monthly_doses` zero-fills with `generate_series(date_trunc('month', current_date) - (p_months-1) * interval '1 month', date_trunc('month', current_date), '1 month')` left-joined to the aggregate | 0.3d |
| P1-9 | K-01 decision record (ADR): Option A, admit `supervisor` to `/admin` (layout uses `requireAppRole("supervisor")`, nav hides items whose page guard is higher); Option B, supervisor pages in the worker shell. Recommend **A** (pages, actions and RLS already support it) | 0.5d + PO |
| P1-10 | Implement P1-9 option A: `layout.tsx:23`; `AdminNav` items get `minRole`; filter by `claims.appRole`; the Reports page guard becomes `requireAppRole("supervisor")` | 1.5d |
| P1-11 | `lib/programmeParams.ts` (new, one zod schema): `area` ltree regex, `vaccine` uuid or "all", `year` 2000–2100, `from`/`to` ISO with `from ≤ to`; used by `coverage/page.tsx`; invalid → defaults + `Callout` "ফিল্টারের একটি মান সঠিক ছিল না, তাই সাধারণ মান দেখানো হচ্ছে।" | 0.5d |
| P1-12 | `coverage/page.tsx:228–231` show copy #13; `console.error(error)` server-side | 0.1d |
| P1-13 | `mfaGate` moved into `layout.tsx` (after role check); remove per-page calls | 0.3d |
| P1-14 | `aefi/_actions.ts:32` note `min(3)` with message "তদন্তের বিবরণ অন্তত ৩ অক্ষরের হতে হবে"; empty string allowed | 0.1d |
| P1-15 | `aefi/_actions.ts:71` set `investigated_by` only when current `investigated_by` is null (read first, or move to `trg_aefi_stamp`) | 0.3d |

### Phase 2
| Task | Change | Est |
|---|---|---|
| P2-1 | Sessions derived state `unreported = status==='planned' && date < today`; `SESSION_STATUS_BN` display-only entry "রিপোর্ট হয়নি" (tone warning) | 0.3d |
| P2-2 | Sessions filter chip "রিপোর্ট হয়নি"; stat card "রিপোর্ট হয়নি: N" linking to the chip | 0.3d |
| P2-3 | Cancellation-rate hint uses (cancelled) ÷ (held + cancelled + unreported) and says so | 0.1d |
| P2-4 | Allow cancel for `unreported` rows (server already allows; relax `date ≥ today` in `SessionsTable.tsx:91`) with reason required | 0.2d |
| P2-5 | AEFI: action column always renders "খুলুন"; panel supports classified → closed; outcome editable after classification | 0.5d |
| P2-6 | AEFI order: `investigation_overdue desc, severity (serious>severe>minor), status open first, reported_at asc` (SQL `order` or sort in page) | 0.2d |
| P2-7 | AEFI: when severity decreases, require `severity_change_reason` (new nullable column + check), show it in the panel | 0.5d |
| P2-8 | Migration: transition triggers for `sessions.status` and `aefi_cases.status` (S-7); clear `closed_at` on re-open | 0.7d |
| P2-9 | Redefine `v_coverage` with `source='routine'`, active, non-deleted children (match `coverage_by_area`) | 0.3d |
| P2-10 | `lib/programme.ts` exports `COVERAGE_TARGET`, `coverageTone`, `dropoutTone`; `Chart.tsx` and `reports/page.tsx` import them (delete local copies). Agree the target (80% or 90%) with the programme lead | 0.3d |
| P2-11 | Reports reads `range` (`DateScope`) and passes it to queries, **or** remove `/admin/reports` from `SCOPED` in `DateScope.tsx:13` (recommended until reports are period-aware) | 0.1–1d |
| P2-12 | Coverage: default `from`/`to` to the denominator year's Jan 1–Dec 31 when a vaccine is selected; label which columns the date range affects ("তারিখ-নির্ভর" marker on headers) | 0.5d |
| P2-13 | Coverage drill links: registered → `/admin/children?area=…`; zero-dose card/cell → list filtered to 12–23 months (add `window` param to zero-dose page) | 0.5d |
| P2-14 | Plan form: location options = leaves under the selected facility's upazila; searchable (`<input list>` datalist is enough); server check `session_date >= today`; for `fixed`, force `location_id = facility.location_id` server-side | 0.8d |
| P2-15 | Team lead list scoped to users assigned at or below the facility's area | 0.3d |

### Phase 3
| Task | Change | Est |
|---|---|---|
| P3-1 | Replace inline Cancel/Classify panels with native `<dialog>` (reuse `ConfirmButton` structure); focus first field; close + toast on success | 0.8d |
| P3-2 | Sessions: move "নতুন সেশন পরিকল্পনা" into a header action that opens a dialog | 0.3d |
| P3-3 | `DataTable` server mode: `page`, `q`, `filter` in URL; Sessions and AEFI use `.range()` and `count: "exact"` | 1.5d |
| P3-4 | Sessions page: drop the second `sessions` query by adding `start_time, end_time, cancel_reason, team_lead` to `v_session_tally` | 0.2d |
| P3-5 | Data Quality: `LEVEL_LABEL_BN` after each area name; sticky `thead`; toggle "শুধু সমস্যাযুক্ত এলাকা"; cells link to filtered guardian/record lists | 0.8d |
| P3-6 | Data Quality headline from a scoped total (sum of the caller's top-level rows) instead of the depth-1 row | 0.3d |
| P3-7 | Print: `print:hidden` on DataTable controls/pagination; `beforeprint` renders all rows; Sessions gets a `.print-only` header (area, period, printed by, date) | 0.4d |
| P3-8 | Reports: hide dropout for `total_doses = 1`; `EmptyState` for empty tables; error `Callout` per query | 0.3d |
| P3-9 | Coverage: collapse zero rows ("আরও ৭টি এলাকায় কোনো তথ্য নেই") | 0.3d |

### Phase 4
| Task | Change | Est |
|---|---|---|
| P4-1 | Apply §8.1 rows 1–38 | 1d |
| P4-2 | Add §8.2 glossary to `docs/` and link it from `lib/programme.ts` header | 0.2d |
| P4-3 | `toBn` for years (`CoverageFilters.tsx:57–60`), session times (`sessions/page.tsx:64–67`), chart tooltips | 0.2d |
| P4-4 | Date/time inputs: helper text "দিন/মাস/বছর" or show `dateBn(value)` beside the input | 0.3d |
| P4-5 | Review pass by a Bengali-speaking EPI officer on severity/causality/session-type terms | 0.5d |

### Phase 5
| Task | Change | Est |
|---|---|---|
| P5-1 | Light-theme tone text tokens darkened so `tone/tone-bg ≥ 4.5:1` (verify all five with a script in `packages/ui-tokens`) | 0.4d |
| P5-2 | One `BarChart` component (vertical) used by Coverage trend and Reports daily; `role="img"` + `aria-label` summary, plus a visually hidden `<table>` of values; min label 12px | 0.8d |
| P5-3 | `StatCard` grid `grid-cols-2` from 0px; hide `hint` below `sm` | 0.2d |
| P5-4 | Coverage table on mobile: sticky first column + right-edge fade as a scroll hint, or card view per area | 0.5d |
| P5-5 | Identifier cells `whitespace-nowrap` (AEFI code, batch, session code) | 0.1d |
| P5-6 | Cancel reason: expandable row detail instead of `title` tooltip | 0.2d |
| P5-7 | Chips/pagination `min-h-9` (36px) on touch (`pointer: coarse`) | 0.1d |
| P5-8 | Replace `--color-*` with `--text-*`/`--accent`/`--border-*` in the 13 কর্মসূচি files; use `Button` for raw buttons; `PageHeader` in Reports and Data Quality | 0.8d |

### Phase 6
See §18.

---

## 17. Acceptance Criteria

**P1**
- Opening AEFI case A then case B shows B's severity, status, outcome and note in the form (automated test).
- Cancelling a session that is out of scope or no longer planned shows an error and no success message (integration test with a scoped account).
- Reports "দৈনিক প্রদত্ত ডোজ" shows bars for the caller's scope, and an error state if the query fails.
- Coverage trend shows exactly 12 bars (zero months visible as zero), each bar height proportional to its value.
- Any malformed `area`, `vaccine`, `year`, `from`, `to` renders defaults plus a Bengali notice; no Postgres text appears anywhere.
- With `require_mfa_elevated = true`, an aal1 programme manager is redirected from all five screens and from `/admin/reports/export`.
- A supervisor account (per the P1-9 decision) can open Coverage, Sessions, AEFI, Data Quality and Reports, sees only its scope, and cannot see nav items above its role.

**P2**
- Sessions: every row is in exactly one of আসন্ন / রিপোর্ট হয়নি / সম্পন্ন / বাতিল; the counts sum to the total.
- AEFI: any case can be opened; a classified case can be closed; the overdue serious case is first in the default order.
- Penta registry coverage is identical on Coverage (country total) and Reports.
- The same coverage value gets the same colour on Dashboard, Coverage and Reports.
- The Reports period picker either changes the figures or is absent.
- Each drill-down lands on a list whose count equals the clicked number.
- The plan form cannot create a session at country/division/district level or before today, even via a crafted POST.

**P3–P5**
- Primary actions visible without scrolling at 1366×768 and 375×812.
- Printing Sessions produces all rows plus a header with area, period and print date; no inputs appear.
- All text/badge pairs ≥ 4.5:1 in light and dark; no text below 12px; charts have text alternatives.
- No copy in §8.1 "Current" column remains; all user-visible numerals are Bengali.

## 18. QA & Validation Strategy

| Layer | What | Tooling |
|---|---|---|
| Unit | Tone/target single source (extend `tests/programme.test.tsx`); param schema (valid/invalid/edge: leap day, from = to, year bounds); `toBn` on years/times | vitest |
| Component | K-02 panel reset; cancel dialog focus/escape; DataTable server-mode URL sync | vitest + @testing-library/react |
| Database | RLS: scoped supervisor can plan/cancel/classify only in scope (extend `supabase/tests/rls_scope.test.sql`); transition triggers (S-7); `daily_doses` scope; `monthly_doses` zero-fill returns 12 rows; `v_coverage` equals `coverage_by_area` totals | pgTAP (`supabase test db`) |
| Integration | Server actions against a seeded DB with two scoped accounts; assert no false success (K-06) | vitest + local Supabase |
| Role matrix | Sign in as guardian, field_worker, store_keeper, supervisor, programme_manager (aal1/aal2), system_admin; record reachable screens and actions vs §3 | Manual script, one sheet per role |
| Destructive flows | Cancel session: planned future, planned past, held, already cancelled, out of scope, double submit | Manual + integration |
| Edge cases | No population estimate; area with no children; vaccine with 1 dose; empty AEFI list; 1,000+ sessions (performance) | Seed script |
| Responsive | 375, 768, 1366, 1920 widths; Bengali long names; dark and light | Browser pane viewport presets |
| Accessibility | axe scan on all five routes; keyboard-only walkthrough of plan → cancel and open → classify → close | axe-core, manual |
| Regression | Re-run this audit's live checks (§4) after each phase; all K-IDs marked fixed/verified | This document |

## 19. Final Optimization Checklist

**Safety & security**
- [x] K-02 AEFI panel keyed by case ID (and CancelForm)
- [x] K-06 no success message without an affected row
- [x] K-07 searchParams validated; no raw DB text shown
- [x] K-08 MFA gate in the admin layout
- [x] S-5 `investigated_by` set once
- [x] S-6 reason required for severity downgrade
- [x] S-7 DB transition triggers
- [x] S-8 CSV cells neutralised

**Correctness**
- [x] K-03 daily-dose chart reads a scoped RPC
- [x] K-04 trend bars render; months zero-filled; freshness date shown
- [x] K-09 one registry-coverage definition
- [x] K-10 one tone scale and target
- [x] K-11 period picker works or is removed
- [x] K-12 drill-downs match their numbers
- [x] K-13 coverage window defaults to the denominator year
- [x] K-14 date range validated

**Workflow**
- [x] K-01 supervisor access decided and implemented
- [x] K-05 "রিপোর্ট হয়নি" session state
- [x] K-15 AEFI lifecycle complete; urgency ordering
- [x] K-17 plan form limited to valid locations and dates
- [x] K-18 dialogs with focus management

**Experience**
- [x] K-19 server pagination (Sessions, AEFI)
- [x] K-20 Data Quality readable and actionable
- [x] K-21 AA contrast, 12px floor, chart alternatives
- [x] K-22 375px layouts
- [x] K-23 complete printouts
- [x] K-25 copy and glossary applied; Bengali numerals everywhere
- [x] K-24 tokens/Button/PageHeader consistency
- [ ] Re-audit completed — screens, drill-downs, axe and DB tests done; supervisor-account UI pass still open