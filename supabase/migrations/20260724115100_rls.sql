-- VaxTrace Row-Level Security: deny-by-default on every table.
-- Base source: VaxTrace_Engineering_Handbook.md §8.5 (custom access token hook and the
-- children/schedules/vaccination_records/vaccines/inventories/user_roles policies are
-- verbatim from the handbook). profiles, vaccine_doses, notifications, and audit_log
-- policies are new — the handbook only gave "representative" examples for those four
-- and said "full set in migrations," so they're filled in here following the same
-- ownership/role rules used elsewhere in §8.5.

-- Custom Access Token Hook — stamps `user_role` into JWT claims on every issue/refresh.
-- Without this every policy below silently falls back to deny.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
declare v_role user_role; claims jsonb;
begin
  select role into v_role from public.user_roles
   where user_id = (event->>'user_id')::uuid
   order by role limit 1;                      -- if multi-role later, pick highest
  claims := coalesce(event->'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{user_role}', to_jsonb(coalesce(v_role::text,'parent')));
  return jsonb_set(event, '{claims}', claims);
end $$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- Helper: current role from JWT claim.
create or replace function auth_role() returns user_role
language sql stable as $$ select (auth.jwt() ->> 'user_role')::user_role $$;

alter table profiles             enable row level security;
alter table user_roles           enable row level security;
alter table vaccines              enable row level security;
alter table vaccine_doses        enable row level security;
alter table children             enable row level security;
alter table schedules            enable row level security;
alter table vaccination_records  enable row level security;
alter table inventories          enable row level security;
alter table notifications        enable row level security;
alter table audit_log            enable row level security;

-- PROFILES: self-read/write; admin full read+write.
create policy profiles_select on profiles for select using (
  id = auth.uid() or auth_role() = 'admin'
);
create policy profiles_insert on profiles for insert with check (
  id = auth.uid()
);
create policy profiles_update on profiles for update using (
  id = auth.uid() or auth_role() = 'admin'
) with check (
  id = auth.uid() or auth_role() = 'admin'
);

-- USER_ROLES: self-read; admin full read+write (drives the JWT hook above).
create policy roles_self_select on user_roles for select using (
  user_id = auth.uid()
);
create policy roles_all on user_roles for all using (
  auth_role() = 'admin'
) with check (
  auth_role() = 'admin'
);

-- CATALOG: everyone authenticated can read; only admin writes.
create policy vaccines_select on vaccines for select using (auth.role() = 'authenticated');
create policy vaccines_admin  on vaccines for all using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy vaccine_doses_select on vaccine_doses for select using (auth.role() = 'authenticated');
create policy vaccine_doses_admin  on vaccine_doses for all using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- CHILDREN: parents see only their own; workers & admins see all (v1, pre-facility).
create policy children_select on children for select using (
  guardian_id = auth.uid()
  or auth_role() in ('worker','admin')
);
create policy children_insert on children for insert with check (
  auth_role() in ('worker','admin')
  or guardian_id = auth.uid()              -- a parent may self-register their child
);
create policy children_update on children for update using (
  auth_role() in ('worker','admin')
) with check (auth_role() in ('worker','admin'));

-- SCHEDULES: parent sees rows for their children; worker/admin see all.
-- No insert/update/delete policy for any client role: schedules are system-generated
-- by the trg_child_after_insert / trg_record_after_insert triggers (SECURITY DEFINER,
-- see 20260724115000_domain_logic.sql) and the pg_cron missed-dose sweep (runs as the
-- superuser role that scheduled it) — deny-by-default is correct here.
create policy schedules_select on schedules for select using (
  auth_role() in ('worker','admin')
  or exists (select 1 from children c
              where c.id = schedules.child_id and c.guardian_id = auth.uid())
);

-- VACCINATION_RECORDS: only workers/admins write; parents read their child's.
create policy vr_select on vaccination_records for select using (
  auth_role() in ('worker','admin')
  or exists (select 1 from children c
              where c.id = vaccination_records.child_id and c.guardian_id = auth.uid())
);
create policy vr_insert on vaccination_records for insert with check (
  auth_role() in ('worker','admin') and administered_by = auth.uid()
);

-- INVENTORY & USER_ROLES: admin only (worker included on inventory per §8.5/§9.3 matrix).
create policy inv_all on inventories for all using (
  auth_role() in ('worker','admin')
) with check (auth_role() in ('worker','admin'));

-- NOTIFICATIONS: recipient reads their own; admin reads all. No client write policy —
-- rows are created by the (future) dispatch Edge Function using the service role, which
-- bypasses RLS entirely.
create policy notifications_select on notifications for select using (
  recipient_id = auth.uid() or auth_role() = 'admin'
);

-- AUDIT_LOG: admin-only read (compliance trail). No client write policy — rows are
-- inserted only by the SECURITY DEFINER triggers above.
create policy audit_log_select on audit_log for select using (
  auth_role() = 'admin'
);
