-- P0 defect sweep — the findings of docs/VaxTrace_System_Analysis_and_Requirements_Report.md §7 (BS-13).
--
-- Nine verified defects close here. They are grouped into one migration because they share
-- three moving parts (the schedule derivation function, the vaccination_records write path,
-- and the missed-dose sweep) and splitting them would mean writing each of those three twice.
--
--   BUG-01  access-token hook selected the LOWEST-privilege role
--   BUG-02  schedules were never re-derived after a catalog change
--   BUG-03  vaccine_doses.min_interval_days was stored and never used
--   BUG-05  the dose -> batch link was unenforced free text
--   BUG-09  v_dropout was a cartesian self-join and did not emit the WHO indicator
--   BUG-10  the missed-dose grace period was hardcoded at 14 days for every antigen
--   BUG-12  children had no soft-delete tier (see the note at §7 below — down-rated, not dismissed)
--   FR-31   a clinically invalid dose was insertable
--   FR-32   a dose could be amended but never voided
--   FR-33   a dose given elsewhere could not be recorded as such
--
-- BUG-04 (stock ledger), BUG-06/07/08 (notification routing, opt-out, batching) and BUG-11
-- (two sources of truth for the guardian's phone number) are structural rather than local and
-- land with the entities they belong to: the ledger migration and the guardians migration.

-- ===========================================================================
-- 1. BUG-01 — ROLE RESOLUTION PICKED THE LOWEST PRIVILEGE
-- ===========================================================================
-- `order by role limit 1` ordered by the enum's *declaration* order, which is
-- ('parent','worker','admin'). So the lowest-privilege role won, while the inline comment
-- claimed the opposite ("if multi-role later, pick highest"). user_roles' primary key is
-- (user_id, role), so multi-role is representable today: a health worker who is also the
-- parent of their own child was silently demoted to `parent` on the next token refresh.
--
-- The fix is an explicit rank rather than `order by role desc`. Ordering by the enum is what
-- caused the bug; relying on the enum's order in the other direction would make the next
-- person to add a role to the middle of the enum re-introduce it. A rank function states the
-- privilege ladder as data, and is the same ladder the scoped-authorization migration extends.
create or replace function public.role_rank(p_role user_role)
returns int language sql immutable set search_path = public as $$
  select case p_role
           when 'admin'  then 30
           when 'worker' then 20
           when 'parent' then 10
         end
$$;

comment on function public.role_rank(user_role) is
  'Privilege ladder as data. Higher wins. Gaps of 10 leave room for roles between tiers.';

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_role   user_role;
  v_status text;
  claims   jsonb;
begin
  select role into v_role from public.user_roles
   where user_id = (event->>'user_id')::uuid
   order by public.role_rank(role) desc, role
   limit 1;                                    -- highest ACTIVE privilege, deterministically

  select status::text into v_status from public.profiles
   where id = (event->>'user_id')::uuid;

  claims := coalesce(event->'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{user_role}',   to_jsonb(coalesce(v_role::text, 'parent')));
  claims := jsonb_set(claims, '{user_status}', to_jsonb(coalesce(v_status, 'active')));
  return jsonb_set(event, '{claims}', claims);
end $$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- role_rank is called from inside the hook, which runs as supabase_auth_admin. Revoking from
-- PUBLIC would revoke it from that role too, so the grant has to be explicit. It is not a
-- trigger function and leaks nothing (it maps an enum to an int), but there is no reason for
-- a client to reach it over /rest/v1/rpc either.
revoke execute on function public.role_rank(user_role) from anon, authenticated, public;
grant  execute on function public.role_rank(user_role) to supabase_auth_admin;

-- ===========================================================================
-- 2. CATALOG COLUMNS THE VALIDATION AND THE GRACE PERIOD NEED
-- ===========================================================================
-- min/max age bound the window in which an antigen may legitimately be given; the grace
-- period is how long a dose may be overdue before the programme calls it missed. All three
-- are clinical policy, and all three were previously either absent or hardcoded.
alter table vaccines
  add column min_age_days      int  check (min_age_days is null or min_age_days >= 0),
  add column max_age_days      int  check (max_age_days is null or max_age_days >= 0),
  add column grace_period_days int  check (grace_period_days is null or grace_period_days between 0 and 365),
  -- Interoperability seam (report §8.5): a place to put an external code system without a
  -- migration later. Nullable and unused today, deliberately.
  add column code_system       text check (code_system is null or length(code_system) between 1 and 60),
  add column code_value        text check (code_value  is null or length(code_value)  between 1 and 60),
  add constraint vaccines_age_window check (
    min_age_days is null or max_age_days is null or max_age_days >= min_age_days
  );

comment on column vaccines.max_age_days is
  'Upper age bound for eligibility. NULL = no upper bound. Used to decide whether a newly '
  'catalogued dose should be back-filled onto an already-registered child.';

-- BUG-10: the sweep's 14 days becomes a programme setting with a per-antigen override.
insert into app_settings (key, value) values ('missed_grace_days', '14'::jsonb)
on conflict (key) do nothing;

create or replace function public.schedule_grace_days(p_vaccine_id uuid)
returns int language sql stable set search_path = public as $$
  select coalesce(
           (select v.grace_period_days from vaccines v where v.id = p_vaccine_id),
           setting_int('missed_grace_days'),
           14                                   -- last resort: the behaviour this replaces
         )
$$;

-- ===========================================================================
-- 3. FR-32 / FR-33 — VOID AND PROVENANCE ON A DOSE RECORD
-- ===========================================================================
-- A clinical record is never deleted. A wrong one is voided: the row stays, carries who
-- voided it and why, and stops counting. Everything that reads coverage, stock or history
-- filters on `voided_at is null`.
create type dose_source as enum (
  'facility',          -- given at a fixed site by this programme
  'outreach',          -- given at an outreach session by this programme
  'card_transcribed',  -- back-entered from the family's home-based card
  'other_facility',    -- reported as given by another provider
  'campaign'           -- supplementary immunization activity, outside the routine schedule
);

alter table vaccination_records
  add column source      dose_source not null default 'facility',
  add column voided_at   timestamptz,
  add column voided_by   uuid references profiles(id),
  add column void_reason text check (void_reason is null or length(void_reason) between 3 and 300),
  -- BUG-05: the batch stops being free text. batch_number is kept as the printed-on-the-vial
  -- string for history, but inventory_id is what a recall query follows.
  add column inventory_id uuid references inventories(id),
  -- FR-31 escape hatch: a clinically unusual dose is sometimes the right call in the field.
  -- It is allowed, it is never silent.
  add column override_reason text check (override_reason is null or length(override_reason) between 3 and 300),
  add constraint vaccination_records_void_complete check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null and void_reason is not null)
  );

create index vaccination_records_inventory_id_idx on vaccination_records (inventory_id);
create index vaccination_records_voided_by_idx    on vaccination_records (voided_by);
-- Reporting reads doses by date, and by facility-and-date once facilities exist.
create index vaccination_records_administered_date_idx
  on vaccination_records (administered_date) where voided_at is null;

-- Best-effort backfill of the FK from the text that used to stand in for it.
update vaccination_records r
   set inventory_id = i.id
  from inventories i
 where i.vaccine_id = r.vaccine_id
   and i.batch_number = r.batch_number
   and r.inventory_id is null;

-- A voided dose has to free its slot, or the correction cannot be re-recorded. The table
-- constraint becomes a partial unique index over the live rows only.
alter table vaccination_records
  drop constraint vaccination_records_child_id_vaccine_id_dose_number_key;

create unique index vaccination_records_active_dose_key
  on vaccination_records (child_id, vaccine_id, dose_number)
  where voided_at is null;

comment on index public.vaccination_records_active_dose_key is
  'A dose is administered at most once — but a voided record no longer occupies the slot, '
  'which is what makes a correction possible without deleting clinical history.';

-- Voiding is a supervisory act (report §10.4), not something the recording worker does to
-- their own mistake unreviewed. Column grants make the write possible; this trigger decides
-- who may make it, exactly as trg_status_guard does for profiles.status.
create or replace function public.trg_dose_void_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.voided_at is distinct from old.voided_at then
    if old.voided_at is not null then
      raise exception 'a voided dose cannot be revived (record %)', old.id
        using errcode = 'restrict_violation';
    end if;
    if coalesce(auth_role()::text, '') <> 'admin' then
      raise exception 'only an administrator may void a dose'
        using errcode = 'insufficient_privilege';
    end if;
    new.voided_by := coalesce(new.voided_by, auth.uid());
  end if;

  -- Everything clinical stays append-only. The amendable set is notes / adverse_event, and
  -- now the void fields. Column grants already enforce this for PostgREST callers; the check
  -- is repeated here so a service-role or SQL-console write cannot rewrite history either.
  if new.child_id          is distinct from old.child_id
     or new.vaccine_id     is distinct from old.vaccine_id
     or new.dose_number    is distinct from old.dose_number
     or new.administered_date is distinct from old.administered_date
     or new.administered_by   is distinct from old.administered_by
     or new.source            is distinct from old.source then
    raise exception 'clinical fields of a dose record are append-only (record %)', old.id
      using errcode = 'restrict_violation';
  end if;

  return new;
end $$;

create trigger vaccination_records_void_guard before update on vaccination_records
  for each row execute function public.trg_dose_void_guard();

revoke execute on function public.trg_dose_void_guard() from anon, authenticated, public;

-- Extend the amendable column set. Column grants are additive, so this adds the three void
-- columns to the (notes, adverse_event) pair 20260725100100 granted; the clinical columns
-- remain ungranted and therefore unwritable by any PostgREST caller.
grant update (voided_at, voided_by, void_reason)
  on public.vaccination_records to authenticated;

-- ===========================================================================
-- 4. BUG-03 — DUE DATES THAT HONOUR min_interval_days
-- ===========================================================================
-- The old derivation was `date_of_birth + recommended_age_days`, full stop. A child who
-- received Penta-1 eight weeks late still had Penta-2 due on the birth-derived date — often
-- *before* the minimum interval had elapsed — and the sweep then marked that clinically
-- impossible date `missed`.
--
-- The correct due date is the later of the two constraints: old enough for this dose, and
-- far enough from the previous one *as actually administered*.
create or replace function public.dose_due_date(
  p_child_id uuid, p_vaccine_id uuid, p_dose_number int
) returns date
language sql stable set search_path = public as $$
  select greatest(
           c.date_of_birth + vd.recommended_age_days,
           coalesce(
             (select r.administered_date + vd.min_interval_days
                from vaccination_records r
               where r.child_id    = p_child_id
                 and r.vaccine_id  = p_vaccine_id
                 and r.dose_number = p_dose_number - 1
                 and r.voided_at is null),
             '-infinity'::date            -- no previous dose on file: the age rule alone applies
           )
         )
    from children c
    join vaccine_doses vd
      on vd.vaccine_id = p_vaccine_id and vd.dose_number = p_dose_number
   where c.id = p_child_id
$$;

-- ===========================================================================
-- 5. BUG-02 — SCHEDULES THAT ARE RE-DERIVED
-- ===========================================================================
-- generate_schedule() only ever ran from an AFTER INSERT trigger on `children`. Adding a
-- vaccine or a dose to the catalog produced schedule rows for future registrations only;
-- every already-registered child was invisibly excluded, with no backfill path.
--
-- Re-derivation now does both halves: insert the rows that are missing, and refresh the due
-- dates of the rows that are not yet administered. It is idempotent, so it is safe to run
-- from a trigger, from a dose recording, and from a nightly job.
alter table schedules
  add column recalculated_at timestamptz,
  add column source text not null default 'routine'
    check (source in ('routine','catch_up','campaign'));

comment on column schedules.source is
  'How this row came to exist. `campaign` rows are excluded from routine coverage so a '
  'supplementary round cannot inflate the routine indicator (report FR-68).';

-- The defaulter list is "pending or missed, oldest first, for these children" — the existing
-- (status, due_date) index serves the scan, this one serves the per-child parent view.
create index schedules_child_status_idx on schedules (child_id, status);

create or replace function public.rederive_schedules(p_child_id uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_inserted int;
  v_updated  int;
begin
  -- (a) Rows that should exist and do not. A dose is only back-filled onto an existing child
  --     while that child is still inside the antigen's age window: catalogue MR at 9 months
  --     and every 4-year-old in the register should not acquire an instantly-overdue dose.
  insert into schedules (child_id, vaccine_id, dose_number, due_date, source, recalculated_at)
  select c.id, vd.vaccine_id, vd.dose_number,
         public.dose_due_date(c.id, vd.vaccine_id, vd.dose_number),
         'routine', now()
    from children c
    join vaccines v on v.is_active
    join vaccine_doses vd on vd.vaccine_id = v.id
   where (p_child_id is null or c.id = p_child_id)
     and c.deleted_at is null
     and (v.max_age_days is null or c.date_of_birth + v.max_age_days >= current_date)
  on conflict (child_id, vaccine_id, dose_number) do nothing;
  get diagnostics v_inserted = row_count;

  -- (b) Rows whose due date has moved because a previous dose was finally given, voided, or
  --     given late. Only rows that are not yet administered are touched — a `done` row is a
  --     historical fact, not a projection.
  with recomputed as (
    select s.id, public.dose_due_date(s.child_id, s.vaccine_id, s.dose_number) as new_due
      from schedules s
     where s.status in ('pending','missed')
       and (p_child_id is null or s.child_id = p_child_id)
  )
  update schedules s
     set due_date = rc.new_due, recalculated_at = now()
    from recomputed rc
   where rc.id = s.id
     and rc.new_due is not null
     and s.due_date is distinct from rc.new_due;
  get diagnostics v_updated = row_count;

  perform public.reconcile_schedule_status(p_child_id);
  return v_inserted + v_updated;
end $$;

-- BUG-10: the sweep reads the grace period instead of hardcoding 14 days, and it runs in
-- both directions. A row whose due date has just been pushed into the future by (b) above
-- must stop being `missed`, or a late Penta-1 leaves Penta-2 permanently marked as a defaulter.
create or replace function public.reconcile_schedule_status(p_child_id uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  -- Read once per call, not once per row. The programme default is a settings lookup; the
  -- per-antigen override is a column already on the row the join brings in. Calling
  -- schedule_grace_days() inside the predicate would be one app_settings scan per schedule —
  -- invisible on seed data, ruinous at national volume.
  v_default_grace int := coalesce(setting_int('missed_grace_days'), 14);
  v_missed   int;
  v_restored int;
begin
  update schedules s set status = 'missed'
    from vaccines v
   where v.id = s.vaccine_id
     and s.status = 'pending'
     and (p_child_id is null or s.child_id = p_child_id)
     and s.due_date < current_date - coalesce(v.grace_period_days, v_default_grace);
  get diagnostics v_missed = row_count;

  update schedules s set status = 'pending'
    from vaccines v
   where v.id = s.vaccine_id
     and s.status = 'missed'
     and (p_child_id is null or s.child_id = p_child_id)
     and s.due_date >= current_date - coalesce(v.grace_period_days, v_default_grace);
  get diagnostics v_restored = row_count;

  return v_missed + v_restored;
end $$;

-- generate_schedule keeps its name and signature — it is what trg_child_after_insert calls
-- and what the handbook §8.4 documents — but delegates, so there is exactly one derivation.
create or replace function public.generate_schedule(p_child_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.rederive_schedules(p_child_id);
end $$;

-- Catalog changes now propagate. Statement-level, not row-level: adding three doses to an
-- antigen should re-derive once, not three times. Catalog edits are admin-only and rare;
-- the cost of a full pass is paid at the moment someone changes clinical policy.
create or replace function public.trg_catalog_rederive() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.rederive_schedules(null);
  return null;
end $$;

create trigger vaccine_doses_rederive after insert or update or delete on vaccine_doses
  for each statement execute function public.trg_catalog_rederive();
create trigger vaccines_rederive after insert or update on vaccines
  for each statement execute function public.trg_catalog_rederive();

-- Definer functions are reachable at /rest/v1/rpc/<name> unless revoked. None of these has
-- any business being called by a client: re-derivation is a consequence of a catalog edit or
-- a dose, never a user action.
revoke execute on function public.rederive_schedules(uuid)        from anon, authenticated, public;
revoke execute on function public.reconcile_schedule_status(uuid) from anon, authenticated, public;
revoke execute on function public.trg_catalog_rederive()          from anon, authenticated, public;
revoke execute on function public.generate_schedule(uuid)         from anon, authenticated, public;
revoke execute on function public.dose_due_date(uuid, uuid, int)  from anon;
revoke execute on function public.schedule_grace_days(uuid)       from anon;

-- Replace the hardcoded nightly sweep with the reconciling one.
select cron.unschedule('mark-missed');
select cron.schedule('reconcile-schedules', '0 1 * * *',
  $cron$select public.reconcile_schedule_status()$cron$);

-- ===========================================================================
-- 6. FR-31 — A CLINICALLY INVALID DOSE IS NO LONGER INSERTABLE
-- ===========================================================================
-- Validation lives in a BEFORE INSERT trigger for the same reason every other invariant in
-- this schema does: a rule enforced in one server action is a rule that the next write path
-- does not have.
--
-- Honest limit, stated rather than discovered later: the interval, dose-order and same-day
-- checks read `vaccination_records`, and Postgres does not increment the command counter
-- between rows of a single multi-row INSERT. A bulk load (the seed file, a future importer)
-- therefore cannot see its own sibling rows and those three checks are skipped for it. Every
-- interactive path — one row per statement — is fully checked. The age, provenance, batch and
-- date checks below read only the NEW row or other tables, and hold under bulk load too.
create or replace function public.trg_record_validate() returns trigger
language plpgsql set search_path = public as $$
declare
  v_child   children%rowtype;
  v_vaccine vaccines%rowtype;
  v_min_interval int;
  v_prev_date    date;
  v_inv     inventories%rowtype;
begin
  select * into v_child from children where id = new.child_id;
  if not found then
    raise exception 'no such child (%)', new.child_id using errcode = 'foreign_key_violation';
  end if;
  if v_child.deleted_at is not null then
    raise exception 'child % is deregistered; a dose cannot be recorded against it', v_child.child_id
      using errcode = 'restrict_violation';
  end if;

  -- A dose before birth was insertable. It is not expressible as a CHECK (it spans two
  -- tables), which is exactly why it had been missed.
  if new.administered_date < v_child.date_of_birth then
    raise exception 'administered_date (%) precedes the child''s date of birth (%)',
      new.administered_date, v_child.date_of_birth using errcode = 'check_violation';
  end if;

  select * into v_vaccine from vaccines where id = new.vaccine_id;
  if not found or not v_vaccine.is_active then
    raise exception 'vaccine % is not in the active catalog', new.vaccine_id
      using errcode = 'check_violation';
  end if;

  -- Minimum age is a hard block: it is the one error that cannot be justified in the field.
  if v_vaccine.min_age_days is not null
     and new.administered_date < v_child.date_of_birth + v_vaccine.min_age_days then
    raise exception '% may not be given before % days of age (child was % days old)',
      v_vaccine.code, v_vaccine.min_age_days, new.administered_date - v_child.date_of_birth
      using errcode = 'check_violation';
  end if;

  -- The dose has to exist in the catalog at all.
  select min_interval_days into v_min_interval
    from vaccine_doses
   where vaccine_id = new.vaccine_id and dose_number = new.dose_number;
  if v_min_interval is null then
    raise exception 'dose % of % is not defined in the catalog', new.dose_number, v_vaccine.code
      using errcode = 'check_violation';
  end if;

  -- Interval and dose order are overridable, because a worker standing in front of a child
  -- sometimes has a reason the schema cannot see. Overridable is not the same as silent:
  -- override_reason is stored on the record and shows in the history.
  if new.dose_number > 1 and new.override_reason is null
     and new.source in ('facility','outreach') then
    select r.administered_date into v_prev_date
      from vaccination_records r
     where r.child_id = new.child_id and r.vaccine_id = new.vaccine_id
       and r.dose_number = new.dose_number - 1 and r.voided_at is null;

    if v_prev_date is null then
      -- Out of order only if *some other* dose of this antigen is already on file but the
      -- immediately preceding one is not — Penta-3 recorded when only Penta-1 exists. A child
      -- whose antigen history is empty is a catch-up registration, which is legitimate: the
      -- earlier doses go in with source 'card_transcribed'.
      if exists (select 1 from vaccination_records r
                  where r.child_id = new.child_id and r.vaccine_id = new.vaccine_id
                    and r.voided_at is null) then
        raise exception 'dose % of % is out of order: dose % has not been recorded. '
                        'Supply override_reason, or record the earlier dose with source '
                        '''card_transcribed''.',
          new.dose_number, v_vaccine.code, new.dose_number - 1
          using errcode = 'check_violation';
      end if;
    elsif new.administered_date < v_prev_date + v_min_interval then
      raise exception 'dose % of % is % days after the previous dose; the minimum interval is %. '
                      'Supply override_reason to record it anyway.',
        new.dose_number, v_vaccine.code, new.administered_date - v_prev_date, v_min_interval
        using errcode = 'check_violation';
    end if;
  end if;

  -- Two different doses of the same antigen on one day is almost always a data-entry slip.
  if new.override_reason is null
     and exists (select 1 from vaccination_records r
                  where r.child_id = new.child_id and r.vaccine_id = new.vaccine_id
                    and r.administered_date = new.administered_date and r.voided_at is null) then
    raise exception 'another dose of % is already recorded for this child on %',
      v_vaccine.code, new.administered_date using errcode = 'unique_violation';
  end if;

  -- BUG-05: if a batch is named, it has to be a real batch of this antigen and it has to have
  -- been usable on the day. batch_number is then stamped from the FK so the two can never
  -- disagree again.
  if new.inventory_id is not null then
    select * into v_inv from inventories where id = new.inventory_id;
    if not found then
      raise exception 'no such stock batch (%)', new.inventory_id
        using errcode = 'foreign_key_violation';
    end if;
    if v_inv.vaccine_id <> new.vaccine_id then
      raise exception 'batch % is not a batch of %', v_inv.batch_number, v_vaccine.code
        using errcode = 'check_violation';
    end if;
    if v_inv.expiry_date < new.administered_date and new.override_reason is null then
      raise exception 'batch % expired on %', v_inv.batch_number, v_inv.expiry_date
        using errcode = 'check_violation';
    end if;
    new.batch_number := v_inv.batch_number;
  end if;

  return new;
end $$;

create trigger record_validate before insert on vaccination_records
  for each row execute function public.trg_record_validate();

revoke execute on function public.trg_record_validate() from anon, authenticated, public;

-- ===========================================================================
-- 7. BUG-12 — SOFT DELETE FOR CHILDREN
-- ===========================================================================
-- Correction to the report's finding, recorded here because the migration is the evidence:
-- a hard DELETE on `children` was already denied to every client role, because the table has
-- no DELETE policy and RLS is deny-by-default. The exposure was to the service role and to
-- direct SQL, not to the application. The gap that remained is the *absence of a
-- deregistration path at all*: there was no way to say "this row was created in error" or
-- "this child left the catchment" without destroying the row.
alter table children
  add column deleted_at timestamptz,
  add column deleted_by uuid references profiles(id),
  add column delete_reason text check (delete_reason is null or length(delete_reason) between 3 and 300),
  add constraint children_delete_complete check (
    (deleted_at is null and deleted_by is null and delete_reason is null)
    or (deleted_at is not null and deleted_by is not null and delete_reason is not null)
  );

create index children_deleted_by_idx on children (deleted_by);
create index children_active_idx on children (created_at desc) where deleted_at is null;

create or replace function public.trg_child_delete_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.deleted_at is distinct from old.deleted_at
     and coalesce(auth_role()::text, '') <> 'admin' then
    raise exception 'only an administrator may deregister a child'
      using errcode = 'insufficient_privilege';
  end if;
  if new.deleted_at is not null then
    new.deleted_by := coalesce(new.deleted_by, auth.uid());
  end if;
  return new;
end $$;

create trigger children_delete_guard before update on children
  for each row execute function public.trg_child_delete_guard();

revoke execute on function public.trg_child_delete_guard() from anon, authenticated, public;

-- A deregistered child disappears from every worker and guardian surface. An administrator
-- still sees them, because "why is this child gone" is an administrative question.
drop policy if exists children_select on children;
create policy children_select on children for select using (
  (select auth_role()) = 'admin'
  or (
    deleted_at is null
    and (guardian_id = (select auth.uid()) or (select auth_role()) = 'worker')
  )
);

-- BUG-11 (first half): created_by was nullable and unconstrained, so a child could exist with
-- no recorded registrar. Every existing row has one; the backfill is defensive.
update children set created_by = guardian_id where created_by is null;
alter table children alter column created_by set not null;

-- ===========================================================================
-- 8. DOSE RECONCILIATION — RE-DERIVE AFTER RECORDING, AND ON VOID
-- ===========================================================================
-- The original trigger flipped one schedule row to `done` and read the next dose's stored
-- due date. With BUG-03 fixed, the next dose's due date is not knowable until the schedule
-- has been re-derived from the date this dose was actually given — so re-derivation happens
-- first, and next_due_date is read after it.
create or replace function public.trg_record_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_next_due date;
begin
  update schedules
     set status = 'done'
   where child_id = new.child_id
     and vaccine_id = new.vaccine_id
     and dose_number = new.dose_number;

  perform public.rederive_schedules(new.child_id);

  select s.due_date into v_next_due
    from schedules s
   where s.child_id = new.child_id
     and s.vaccine_id = new.vaccine_id
     and s.dose_number = new.dose_number + 1
     and s.status <> 'done';

  update vaccination_records set next_due_date = v_next_due where id = new.id;

  insert into audit_log(actor_id, action, entity, entity_id, after)
  values (new.administered_by, 'dose.record', 'vaccination_records', new.id, to_jsonb(new));
  return new;
end $$;

-- Voiding a dose reopens the schedule row it closed and re-derives everything downstream of
-- it. Without this the correction would leave the child permanently "up to date" for a dose
-- the register says they never received.
create or replace function public.trg_record_after_void() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.voided_at is not null and old.voided_at is null then
    update schedules
       set status = 'pending'
     where child_id = new.child_id
       and vaccine_id = new.vaccine_id
       and dose_number = new.dose_number;

    perform public.rederive_schedules(new.child_id);

    insert into audit_log(actor_id, action, entity, entity_id, before, after)
    values (new.voided_by, 'dose.void', 'vaccination_records', new.id, to_jsonb(old), to_jsonb(new));
  end if;
  return null;
end $$;

create trigger record_after_void after update on vaccination_records
  for each row execute function public.trg_record_after_void();

revoke execute on function public.trg_record_after_void() from anon, authenticated, public;

-- ===========================================================================
-- 9. BUG-09 — v_dropout REWRITTEN IN ONE PASS, EMITTING THE WHO INDICATOR
-- ===========================================================================
-- The previous definition joined vaccination_records to itself twice on vaccine_id with no
-- correlation between the two copies. That is |records|² intermediate rows per antigen before
-- count(distinct …) reduced them: correct on six seed children, unrunnable at a district's
-- volume. It also emitted only the two inputs of the dropout rate, never the rate.
--
-- Dropout, per WHO: (dose 1 − dose N) / dose 1, on the same cohort. One scan, conditional
-- aggregation, and the numerator and denominator stay visible next to the rate — a rate
-- without its N is not a statistic (20260725120000).
create or replace view v_dropout
with (security_invoker = true) as
select v.code, v.name_en, v.name_bn,
       count(distinct r.child_id) filter (where r.dose_number = 1)             as started,
       count(distinct r.child_id) filter (where r.dose_number = v.total_doses) as completed,
       (count(distinct r.child_id) filter (where r.dose_number = 1)
        - count(distinct r.child_id) filter (where r.dose_number = v.total_doses))::numeric
         / nullif(count(distinct r.child_id) filter (where r.dose_number = 1), 0)
                                                                               as dropout_rate
  from vaccines v
  left join vaccination_records r
    on r.vaccine_id = v.id
   and r.voided_at is null
 group by v.code, v.name_en, v.name_bn, v.total_doses;

comment on view public.v_dropout is
  'WHO dropout rate: (dose1 - doseN) / dose1 on the same cohort. Single pass over '
  'vaccination_records; voided doses excluded.';

-- Coverage excludes voided doses and campaign schedule rows for the same reason.
create or replace view v_coverage
with (security_invoker = true) as
select v.code, v.name_en, v.name_bn,
       count(*) filter (where s.status = 'done')::numeric
         / nullif(count(*) filter (where s.due_date <= current_date), 0) as coverage_rate,
       count(*) filter (where s.status = 'done')          as done_count,
       count(*) filter (where s.due_date <= current_date) as due_count
  from schedules s
  join vaccines v on v.id = s.vaccine_id
  join children c on c.id = s.child_id and c.deleted_at is null
 where s.source = 'routine'
 group by v.code, v.name_en, v.name_bn;

comment on view public.v_coverage is
  'REGISTRY coverage: of the children this system knows about, what share are up to date. '
  'This is a data-quality metric, not a public-health one — population coverage against a '
  'denominator lands with v_coverage_by_area (report BS-07).';

-- ===========================================================================
-- 10. BACKFILL
-- ===========================================================================
-- Existing schedules were derived without min_interval_days and swept with a hardcoded
-- grace period. Re-derive once so the data matches the rules that now govern it.
select public.rederive_schedules(null);
