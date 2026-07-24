# VaxTrace — Pre-Defense TODO

**Target date:** 2026-08-03 (pre-defense demo)
**Scope decision:** the **entire Authentication module** and the **entire Admin module** are built complete and demoed live. Parent and Worker screens stay as Figma designs only — not implementation targets for this date. Full rationale and screen map: [`VaxTrace_Engineering_Handbook.md`](VaxTrace_Engineering_Handbook.md) (§7.0a, §7.1, Pre-Defense MVP Scope callout).

**Priority key**
- 🔴 **Must Complete** — the demo does not work / is not credible without this.
- 🟡 **Should Complete** — materially strengthens the demo; cut first if time runs out.
- ⚪ **Optional** — nice polish or a defense-question deflector ("is this planned?" → yes, see roadmap).

Work top-to-bottom: Section 0 blocks 1–2; Section 1 (Auth) blocks Section 2 (Admin is behind RLS + the admin role).

---

## 0. Foundation & Platform (blocks everything)

| # | Task | Priority |
|---|---|---|
| 0.1 | Repo scaffold: pnpm + Turborepo, TS strict, ESLint/Prettier/Husky/commitlint (§7 folder structure) | 🔴 |
| 0.2 | Next.js App Router skeleton + Tailwind, import design tokens from Figma (`packages/ui-tokens`) | 🔴 |
| 0.3 | Supabase project (single env is enough for the demo — skip dev/staging/prod split for now) | 🔴 |
| 0.4 | `supabase/migrations`: full schema §8.3 (`profiles`, `user_roles`, `vaccines`, `vaccine_doses`, `children`, `schedules`, `vaccination_records`, `inventories`, `notifications`, `audit_log`) — Admin's reports & inventory screens need the whole schema even though Parent/Worker UI isn't built | 🔴 |
| 0.5 | `generate_schedule()` trigger (§8.4) + seed script (`supabase/seed.sql`): vaccine catalog + enough synthetic children/schedules/records/inventory that Admin reports show non-empty, non-trivial numbers | 🔴 |
| 0.6 | RLS enabled + policies on every table (§8.5), Custom Access Token Hook stamping `user_role` on the JWT | 🔴 |
| 0.7 | CI: typecheck, lint, unit, `pnpm build` green (§13.2) — pgTAP/E2E can lag if time-boxed, but these four block every PR | 🔴 |
| 0.8 | Vercel deploy reachable by URL (preview or a single demo deployment) — the defense needs a live link, not `localhost` | 🔴 |
| 0.9 | Sentry + structured logging baseline | 🟡 |
| 0.10 | Full dev/staging/prod Supabase project split, branch-preview DBs | ⚪ |

---

## 1. Authentication Module (🔴 Must — complete end-to-end)

Flow: **Splash → Role Selection → Login (ID & Password / OTP) → Dashboard** (handbook §7.0a).

### UI / Frontend
| # | Task | Priority |
|---|---|---|
| 1.1 | A1 Splash — Bangla-only, no locale switcher (2026-07-20 decision — see handbook correction needed in §4.16/§7/ADR-007), no backend | 🔴 |
| 1.2 | **A2 Role Selection (new)** — parent / worker / admin picker; sets a `role` cookie/query param that pre-selects the Login form variant; purely client-side routing, no auth call | 🔴 |
| 1.3 | A3 Login — ID & Password field for worker/admin, phone+OTP toggle for parent; RHF + Zod validation | 🔴 |
| 1.4 | A4 Sign Up — pre-filled role from A2; RHF + Zod | 🔴 |
| 1.5 | A5 OTP / Reset Password | 🔴 |
| 1.6 | Bangla strings for all 5 auth screens (no hardcoded text — lint-enforced per §4.16) | 🔴 |
| 1.7 | Light/dark theming applied from Figma tokens on all 5 screens | 🟡 |
| 1.8 | Minimal post-login landing stub for parent/worker roles (e.g. "Parent/Worker experience coming soon") so login doesn't dead-end for non-admin test accounts during Q&A | 🔴 |
| 1.9 | Error/empty states (wrong password, expired OTP, network error) localized | 🟡 |

### Backend
| # | Task | Priority |
|---|---|---|
| 1.10 | `signInAction`, `signUpAction`, `verifyOtpAction`, `resetPwAction` (§7.1 A3–A5) | 🔴 |
| 1.11 | `@supabase/ssr` server client + middleware session refresh | 🔴 |
| 1.12 | `insertProfile` on sign-up (`data.ts`), trigger or action-time insert into `profiles` + `user_roles` | 🔴 |
| 1.13 | Route post-login redirect by JWT `user_role` claim, never by the A2 selection (§7.0a security note) | 🔴 |

### Database / Auth
| # | Task | Priority |
|---|---|---|
| 1.14 | Supabase Auth config: email/password + phone OTP enabled | 🔴 |
| 1.15 | Custom Access Token Hook wired in `supabase/config.toml` (§8.5) | 🔴 |
| 1.16 | RLS policy: `profiles`/`user_roles` self-read, admin full read (§8.5, §9.3 matrix) | 🔴 |
| 1.17 | MFA (TOTP) enforced for admin accounts | ⚪ (roadmap says "enforced in production" — skip for demo, mention as planned) |

### Testing
| # | Task | Priority |
|---|---|---|
| 1.18 | pgTAP: "a parent cannot read another parent's child" (§12.3, the one non-negotiable test) | 🔴 |
| 1.19 | E2E (Playwright): splash → role-select → login → correct-role landing, for all 3 roles | 🟡 |
| 1.20 | E2E: sign-up → auto-login → landing | ⚪ |
| 1.21 | a11y pass (axe) on all 5 auth screens | ⚪ |

### Documentation
| # | Task | Priority |
|---|---|---|
| 1.22 | Handbook auth-flow section (§7.0a) — **done this session** | 🔴 ✅ |
| 1.23 | Figma Role Selection screen added + wired into flow | 🔴 (blocked on Figma desktop access — see note below) |

---

## 2. Admin Module (🔴 Must — complete end-to-end)

Screens D1–D8 (handbook §7.1).

### UI / Frontend
| # | Task | Priority |
|---|---|---|
| 2.1 | D1 Admin Dashboard — KPI widgets (coverage %, dropout %, low-stock count, users count) | 🔴 |
| 2.2 | D2 Vaccine Inventory — list + stock/expiry status | 🔴 |
| 2.3 | D3 Batch/Stock Detail — edit quantity, expiry, batch number | 🔴 |
| 2.4 | D4 Reports & Statistics — table/chart view, CSV export button | 🔴 |
| 2.5 | D5 Coverage Analytics — chart(s) from `v_coverage`/`v_dropout` (Recharts) | 🟡 |
| 2.6 | D6 User Management — list users + roles | 🔴 |
| 2.7 | D7 Role Assignment — change a user's role | 🔴 |
| 2.8 | D8 Vaccine Catalog — CRUD vaccines + per-dose schedule (`vaccine_doses`) | 🔴 |
| 2.9 | Realtime KPI counters (Supabase Realtime) on D1 | ⚪ (polling/refresh-on-load is fine for a demo) |
| 2.10 | Dark-first theming per Figma admin screens | 🟡 |

### Backend
| # | Task | Priority |
|---|---|---|
| 2.11 | `adjustStockAction`, `editBatchAction` (D2/D3) | 🔴 |
| 2.12 | `exportCsvAction` (D4) | 🟡 |
| 2.13 | `inviteUserAction`, `setRoleAction` — audited (D6/D7) | 🔴 |
| 2.14 | `upsertVaccineAction`, `upsertVaccineDoses` (D8) | 🔴 |
| 2.15 | Every admin write appends to `audit_log` (role change, catalog edit, stock adjust) | 🔴 |

### Database
| # | Task | Priority |
|---|---|---|
| 2.16 | `v_coverage`, `v_dropout` views (§8.6) | 🔴 |
| 2.17 | `mv_daily_doses` materialized view + refresh (can be manual refresh for demo, cron optional) | 🟡 |
| 2.18 | RLS: admin-only on `inventories`, `user_roles`, `vaccines` writes (§8.5) proven by pgTAP | 🔴 |

### API / Testing
| # | Task | Priority |
|---|---|---|
| 2.19 | pgTAP: admin-only write policies (inventory, catalog, roles) | 🔴 |
| 2.20 | E2E: login as admin → visit all 8 D-screens → perform one write on each (smoke) | 🟡 |
| 2.21 | Verify coverage/dropout numbers reconcile against seeded raw records (manual check acceptable pre-defense) | 🔴 |

### Documentation
| # | Task | Priority |
|---|---|---|
| 2.22 | No handbook changes needed beyond what's already in §8.6/§16 EPIC 2 — confirm during build that no drift appears | ⚪ |

---

## 3. Cross-Cutting (Must for a credible demo)

| # | Task | Priority |
|---|---|---|
| 3.1 | Bangla is the default locale end-to-end on every built screen (Auth + Admin) — zero hardcoded strings | 🔴 |
| 3.2 | Demo seed data tells a coherent story (a handful of children with realistic ages/doses, a couple of near-expiry batches, a couple of overdue schedules) so Admin reports aren't empty/flat during Q&A | 🔴 |
| 3.3 | `.env.example` + secrets documented; service-role key never in client bundle (CI grep, §13.4) | 🔴 |
| 3.4 | One-page "how to run the demo" note (start command, demo login credentials per role, seed reset command) | 🟡 |
| 3.5 | Lighthouse/a11y spot-check on Admin dashboard (data-dense screen, easiest to regress) | ⚪ |

---

## 4. Explicitly Out of Scope for Aug 3 (tracked, not forgotten)

Per the handbook's Future Roadmap (§18) and Phase 2–6 plan — do **not** start these before Auth + Admin are demo-ready:

- Parent module (B1–B6): history, upcoming schedule, notifications prefs, profile
- Worker module (C1–C6): register child, record dose, correct record
- Notifications & reminder dispatch (Epic 3)
- Immunization certificate generation (Epic 4)
- Full security/perf/a11y hardening pass (Epic 5)
- Production launch checklist, DR drills (Epic 6)

---

## Note on the Figma Role Selection screen

Item 1.23 is blocked: the Figma desktop MCP needs the `VaxTrace — UI System / Screens` file (`S1n9q5mqPNEzIks9FgUx0E`) open and an Auth frame selected in the Figma desktop app to read/write it. Open the file and select the Auth page, and this can be completed in the same session.
