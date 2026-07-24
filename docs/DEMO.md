# Running the VaxTrace Demo

## Start the app

```bash
pnpm install
pnpm --filter @vaxtrace/web dev
```

Opens on http://localhost:3000. `apps/web/.env.local` already points at the live demo
Supabase project (`ptcxxyeaakbiqhmkmgwo`) — no extra setup needed.

## Demo login credentials

All seeded accounts share the password **`VaxTrace@2026`**.

| Role   | Email               | Notes |
|--------|---------------------|-------|
| Admin  | admin@vaxtrace.bd   | Full access — use this for the D1-D8 admin screens. |
| Worker | worker@vaxtrace.bd  | Lands on the worker stub (TODO 1.8) — worker screens aren't built for this date. |

Parent accounts (`parent.a@vaxtrace.bd` … `parent.d@vaxtrace.bd`) exist as data-only fixtures
(guardians of the seeded children). Parent login uses phone+OTP per the auth flow (§7.0a) and
isn't part of the Aug 3 demo scope, so there's no working parent sign-in path yet.

## What's in the seed data

Six children across four parents, telling a coherent story for the Admin reports:
- One fully-vaccinated 2-year-old, one on-track 15-month-old
- A "dropout" case (10-month-old, only birth doses given — shows up in coverage/dropout numbers)
- A newborn (nothing overdue yet) and a 6-week-old "control" case
- Inventory: two near-expiry batches (11 and 18 days out) and one low-stock batch (PENTA, 35 units)

Current numbers (recompute any time with `select * from v_coverage; select * from v_dropout;`):
coverage 58-83% across the 6 vaccines, 16 missed schedules, 37 recorded doses.

## Resetting the seed

There's no linked local Supabase CLI project for this repo yet (`supabase login && supabase link
--project-ref ptcxxyeaakbiqhmkmgwo` first, see `supabase/config.toml`). Once linked:

```bash
supabase db reset --linked
```

Re-runs every file in `supabase/migrations/` and then `supabase/seed.sql` against the live
project. This is destructive — it wipes all current data.

## Deploying

Not connected to Vercel yet — see the handoff steps in [`infra/DEPLOY.md`](../infra/DEPLOY.md).
