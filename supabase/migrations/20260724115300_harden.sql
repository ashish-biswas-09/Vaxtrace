-- Security hardening from `supabase get_advisors` (security). All legitimate for a
-- child-health app where §8.5 makes RLS the security spine — not linter-silencing.

-- 1. Pin search_path on the remaining functions (the two trigger functions already set it).
alter function public.custom_access_token_hook(jsonb) set search_path = public;
alter function public.auth_role() set search_path = public;
alter function public.generate_schedule(uuid) set search_path = public;

-- 2. Trigger functions must never be callable as RPC via /rest/v1/rpc/*. They fire from
--    triggers as the table owner; no client role needs EXECUTE.
revoke execute on function public.trg_child_after_insert() from anon, authenticated, public;
revoke execute on function public.trg_record_after_insert() from anon, authenticated, public;

-- 3. mv_daily_doses is admin-report-only (D4). Materialized views can't carry RLS, so
--    take it out of the Data API entirely — server code reaches it via the service role.
revoke select on public.mv_daily_doses from anon, authenticated;
