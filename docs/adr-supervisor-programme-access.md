# ADR: Supervisors use the কর্মসূচি screens inside `/admin`

**Status:** Accepted, 2026-09-29 · **Finding:** K-01 in `karmasuchi-audit.md`

## Context

The requirements' capability matrix gives `supervisor` session planning, coverage reports, AEFI investigation, data-quality review and export, all within their scope. The pages, server actions and RLS policies for those screens already admitted `supervisor`. But `app/(admin)/admin/layout.tsx` called `requireRole("admin")`, and `supervisor` maps to the legacy `worker` user role. So every supervisor was redirected to `/worker`, which has two pages. The workflow existed in code and was unreachable.

## Options

- **A. Admit `supervisor` to `/admin`.** Filter the navigation by role. Each page keeps its own guard.
- **B. Build supervisor pages inside the worker shell.**

## Decision

**A.** The screens, actions and scoped RLS already exist and are tested; B would duplicate them.

- The layout gate is `requireAppRole("supervisor")`, plus `mfaGate` once for the subtree.
- `AdminNav` items carry `minRole`, matching each page's own guard. `navFor(appRole)` drives the sidebar, mobile drawer and command palette.
- `/admin` (the dashboard) redirects a supervisor to `/admin/coverage`. The notifications bell and child search are shown only to programme managers and above.
- The worker shell shows a "কর্মসূচি" link to supervisors.

## Consequences

- Security is unchanged: RLS still scopes every read and write, and pages above the floor keep their own guards.
- A page added to `/admin` without `minRole` defaults to `programme_manager`, which is fail-closed.
- `profiles_select` hides other staff's names from supervisors. That is why `session_staff()` exists (migration `20260929100000`).
- Tested by `navFor (K-01)` in `apps/web/tests/programme-audit.test.tsx`. A manual pass with a real supervisor account is still required (audit §18).
