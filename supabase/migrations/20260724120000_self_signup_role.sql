-- A4 Sign Up (TODO 1.4/1.12) is parent self-registration per the auth flow (§7.0a) —
-- workers/admins are provisioned by an existing admin via D6/D7, never public signup.
-- The existing `roles_all` policy is admin-only, so a freshly signed-up user has no way
-- to grant themselves even the 'parent' role. This adds a narrow self-insert policy
-- scoped to role = 'parent' only — self-granting 'worker' or 'admin' is still denied.
create policy roles_self_insert_parent on user_roles for insert with check (
  user_id = auth.uid() and role = 'parent'
);
