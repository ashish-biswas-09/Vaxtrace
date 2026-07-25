-- RLS performance pass. No policy's *meaning* changes here — only how Postgres evaluates it.
-- Two mechanical fixes plus the foreign-key indexes, from `supabase get_advisors (performance)`.
--
-- 1. auth_rls_initplan: `auth.uid()` written bare in a policy is re-evaluated once per row.
--    Wrapping it as `(select auth.uid())` turns it into an InitPlan the planner evaluates
--    once per statement. On a 6-row seed table this is invisible; on a district's worth of
--    children it is the difference between a scan and a scan times a function call. Same for
--    `auth_role()`, which reads the JWT on every call.
--
-- 2. multiple_permissive_policies: where two permissive policies covered the same role and
--    action, *both* run for every row and the results are OR-ed. Merging them into a single
--    policy with an OR inside is the same rule at half the cost. The `for all` policies are
--    split into explicit insert/update/delete so they stop overlapping the select policy.
--
-- Deliberately NOT done: dropping the four indexes the linter reports as "unused". They are
-- unused because nothing has queried this project at volume yet — `schedules (status,
-- due_date)` is the reminder sweep's index and `children (guardian_id)` backs the parent RLS
-- lookup. Dropping an index because a fresh database has not needed it yet is optimising for
-- the linter instead of for the query it was built for.

-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select using (
  id = (select auth.uid()) or (select auth_role()) = 'admin'
);

drop policy if exists profiles_insert on profiles;
create policy profiles_insert on profiles for insert with check (
  id = (select auth.uid())
);

drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update using (
  id = (select auth.uid()) or (select auth_role()) = 'admin'
) with check (
  id = (select auth.uid()) or (select auth_role()) = 'admin'
);

-- ---------------------------------------------------------------------------
-- USER_ROLES — `roles_all` (for all) overlapped both the self-select and the
-- parent self-signup insert. Split per action; each action now has exactly one policy.
-- ---------------------------------------------------------------------------
drop policy if exists roles_self_select on user_roles;
drop policy if exists roles_all on user_roles;
drop policy if exists roles_self_insert_parent on user_roles;

create policy user_roles_select on user_roles for select using (
  user_id = (select auth.uid()) or (select auth_role()) = 'admin'
);
-- Self-signup may still grant *only* 'parent' to *only* yourself (20260724120000).
create policy user_roles_insert on user_roles for insert with check (
  (select auth_role()) = 'admin'
  or (user_id = (select auth.uid()) and role = 'parent')
);
create policy user_roles_update on user_roles for update
  using ((select auth_role()) = 'admin')
  with check ((select auth_role()) = 'admin');
create policy user_roles_delete on user_roles for delete
  using ((select auth_role()) = 'admin');
-- user_roles_auth_admin_read is scoped `to supabase_auth_admin` and so never overlaps the
-- client roles above; it stays exactly as 20260724140000 created it.

-- ---------------------------------------------------------------------------
-- CATALOG — `*_admin` (for all) overlapped `*_select` on SELECT.
-- ---------------------------------------------------------------------------
drop policy if exists vaccines_select on vaccines;
drop policy if exists vaccines_admin on vaccines;
create policy vaccines_select on vaccines for select using (
  (select auth.role()) = 'authenticated'
);
create policy vaccines_insert on vaccines for insert with check ((select auth_role()) = 'admin');
create policy vaccines_update on vaccines for update
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');
create policy vaccines_delete on vaccines for delete using ((select auth_role()) = 'admin');

drop policy if exists vaccine_doses_select on vaccine_doses;
drop policy if exists vaccine_doses_admin on vaccine_doses;
create policy vaccine_doses_select on vaccine_doses for select using (
  (select auth.role()) = 'authenticated'
);
create policy vaccine_doses_insert on vaccine_doses for insert
  with check ((select auth_role()) = 'admin');
create policy vaccine_doses_update on vaccine_doses for update
  using ((select auth_role()) = 'admin') with check ((select auth_role()) = 'admin');
create policy vaccine_doses_delete on vaccine_doses for delete
  using ((select auth_role()) = 'admin');

-- ---------------------------------------------------------------------------
-- CHILDREN / SCHEDULES / RECORDS
-- ---------------------------------------------------------------------------
drop policy if exists children_select on children;
create policy children_select on children for select using (
  guardian_id = (select auth.uid()) or (select auth_role()) in ('worker','admin')
);

drop policy if exists children_insert on children;
create policy children_insert on children for insert with check (
  (select auth_role()) in ('worker','admin') or guardian_id = (select auth.uid())
);

drop policy if exists children_update on children;
create policy children_update on children for update
  using ((select auth_role()) in ('worker','admin'))
  with check ((select auth_role()) in ('worker','admin'));

drop policy if exists schedules_select on schedules;
create policy schedules_select on schedules for select using (
  (select auth_role()) in ('worker','admin')
  or exists (select 1 from children c
              where c.id = schedules.child_id and c.guardian_id = (select auth.uid()))
);

drop policy if exists vr_select on vaccination_records;
create policy vr_select on vaccination_records for select using (
  (select auth_role()) in ('worker','admin')
  or exists (select 1 from children c
              where c.id = vaccination_records.child_id and c.guardian_id = (select auth.uid()))
);

drop policy if exists vr_insert on vaccination_records;
create policy vr_insert on vaccination_records for insert with check (
  (select auth_role()) in ('worker','admin') and administered_by = (select auth.uid())
);

drop policy if exists vr_update on vaccination_records;
create policy vr_update on vaccination_records for update
  using ((select auth_role()) in ('worker','admin'))
  with check ((select auth_role()) in ('worker','admin'));

-- ---------------------------------------------------------------------------
-- INVENTORY / NOTIFICATIONS / AUDIT
-- ---------------------------------------------------------------------------
drop policy if exists inv_all on inventories;
create policy inv_all on inventories for all
  using ((select auth_role()) in ('worker','admin'))
  with check ((select auth_role()) in ('worker','admin'));

drop policy if exists notifications_select on notifications;
create policy notifications_select on notifications for select using (
  recipient_id = (select auth.uid()) or (select auth_role()) = 'admin'
);

-- Merged: an admin reads the whole trail, everyone else reads the entries they caused.
-- Two separate permissive policies both ran on every row for the same result.
drop policy if exists audit_log_select on audit_log;
drop policy if exists audit_log_self_select on audit_log;
create policy audit_log_select on audit_log for select using (
  (select auth_role()) = 'admin' or actor_id = (select auth.uid())
);

-- ---------------------------------------------------------------------------
-- STORAGE — same InitPlan fix for the avatars policy.
-- ---------------------------------------------------------------------------
drop policy if exists avatars_own_object on storage.objects;
create policy avatars_own_object on storage.objects for all to authenticated
  using      (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Covering indexes for foreign keys. Without these, a delete or an update on the
-- referenced table sequentially scans the referencing one to check the constraint.
-- ---------------------------------------------------------------------------
create index if not exists children_created_by_idx on children (created_by);
create index if not exists notifications_recipient_id_idx on notifications (recipient_id);
create index if not exists schedules_vaccine_id_idx on schedules (vaccine_id);
create index if not exists vaccination_records_administered_by_idx
  on vaccination_records (administered_by);
create index if not exists vaccination_records_vaccine_id_idx
  on vaccination_records (vaccine_id);
