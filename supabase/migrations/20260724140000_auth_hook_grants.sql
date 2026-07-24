-- Fix: the Custom Access Token Hook was enabled but failing at runtime with HTTP 500
-- ("Error running hook URI: ...custom_access_token_hook"), which broke *all* sign-ins.
--
-- The hook function executes as the `supabase_auth_admin` role (GoTrue), not as the end
-- user. 20260724115100_rls.sql granted EXECUTE on the function but never gave that role read
-- access to the table it queries — so `select ... from user_roles` raised permission-denied
-- inside the hook and GoTrue returned 500. This is the documented requirement for a Postgres
-- access-token hook: grant schema usage + SELECT to supabase_auth_admin, and add an RLS
-- policy so the deny-by-default on user_roles doesn't silently block that role too.
grant usage on schema public to supabase_auth_admin;
grant select on public.user_roles to supabase_auth_admin;

create policy user_roles_auth_admin_read on public.user_roles
  for select to supabase_auth_admin using (true);
