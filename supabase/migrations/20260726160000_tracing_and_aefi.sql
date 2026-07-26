-- ===========================================================================
-- DEFAULTER TRACING AND AEFI
-- ===========================================================================
-- Report BS-04 and BS-12 — the two workflows the review called "critical" and "missing", and
-- the reason §6 could say the product had no core loop.
--
-- **Tracing.** A registry that can tell you a child is overdue and cannot tell you who is
-- going to their house has automated the easy half of the job. Every functioning immunization
-- programme runs the same loop: identify the defaulters, assign them to somebody, record what
-- happened at the door, close the task. Without the last two steps the same child appears on
-- every list forever, the list stops being read, and the system that produces it is worked
-- around. The loop is what turns overdue rows into visits.
--
-- **AEFI.** Adverse Events Following Immunization were a nullable text column on the dose
-- record. That is a note, not a case: it cannot be assigned, investigated, classified against
-- the WHO causality categories, linked to the batch it might implicate, or counted. A single
-- serious AEFI mishandled costs a programme more coverage than a year of outreach earns it,
-- which is why this is a workflow and not a bigger text box.

-- ===========================================================================
-- 1. THE TRACING TASK
-- ===========================================================================
create type tracing_status as enum (
  'open',      -- generated, nobody owns it yet
  'assigned',  -- a named worker is going
  'visited',   -- the visit happened; the outcome is recorded
  'closed'     -- the loop is finished, for a reason that is written down
);

-- What actually happens at the door. Every one of these is a real field outcome, and the last
-- three are the ones a system that only models success quietly loses.
create type tracing_outcome as enum (
  'vaccinated',         -- the dose was given during the visit
  'appointment_given',  -- the family will attend the next session
  'refused',            -- the guardian declined
  'moved_away',         -- the family has left the catchment
  'deceased',
  'not_found',          -- the address does not resolve
  'unreachable'         -- repeated attempts, no contact
);

create table tracing_tasks (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references children(id) on delete restrict,
  -- Denormalised for the same reason it is denormalised everywhere else in this schema: the
  -- scoped policy has to be a GiST probe rather than a join through children on every row.
  location_path ltree not null,
  status        tracing_status not null default 'open',
  assigned_to   uuid references profiles(id),
  assigned_at   timestamptz,
  due_by        date,
  -- The state of the child when the task was raised, frozen. Recomputing "days overdue" at
  -- read time makes an old closed task look like a fresh crisis, and makes the question "how
  -- late were we when we went?" unanswerable.
  doses_missed_at_open int not null default 0 check (doses_missed_at_open >= 0),
  days_overdue_at_open int not null default 0,
  outcome       tracing_outcome,
  outcome_note  text check (outcome_note is null or length(outcome_note) between 3 and 400),
  visited_at    timestamptz,
  closed_at     timestamptz,
  closed_by     uuid references profiles(id),
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  -- An open task has nobody on it, and an assigned one has somebody. Closure deliberately does
  -- NOT require an assignee: a family that turns out to have moved is often learnt about by
  -- phone, and a task that can only be closed by first pretending someone walked there is a
  -- task that gets closed dishonestly.
  constraint tracing_open_unassigned check (status <> 'open'     or assigned_to is null),
  constraint tracing_assigned_owner  check (status <> 'assigned' or assigned_to is not null),
  -- A visit with no outcome is a visit nobody can learn from; a closure with no outcome is a
  -- list being cleared rather than a loop being finished.
  constraint tracing_outcome_required check (
    status not in ('visited', 'closed') or outcome is not null
  ),
  constraint tracing_closed_complete check (
    (status = 'closed') = (closed_at is not null)
  )
);

-- One live task per child. Two open tasks for the same child means two workers walking to the
-- same house, which is exactly the waste this board exists to remove.
create unique index tracing_tasks_open_key on tracing_tasks (child_id)
  where status <> 'closed';
create index tracing_tasks_assignee_idx on tracing_tasks (assigned_to, status)
  where status <> 'closed';
create index tracing_tasks_path_gist   on tracing_tasks using gist (location_path);
create index tracing_tasks_child_idx   on tracing_tasks (child_id, created_at desc);
create index tracing_tasks_closed_by_idx on tracing_tasks (closed_by);
create index tracing_tasks_created_by_idx on tracing_tasks (created_by);

comment on table public.tracing_tasks is
  'The defaulter tracing loop (report BS-04, §13.6): identify, assign, visit, record the '
  'outcome, close. The outcome feeds back into the child lifecycle, which is what stops a '
  'moved-away family being traced again next month.';

create or replace function public.trg_tracing_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    select ch.location_path into new.location_path from children ch where ch.id = new.child_id;
    if new.location_path is null then
      raise exception 'Unknown child';
    end if;
  end if;

  -- The timestamps follow the status rather than being asked for. A form that requires the
  -- user to set both a status and its date is a form that will disagree with itself.
  if new.status = 'assigned' and new.assigned_at is null then
    new.assigned_at := now();
  end if;
  if new.status = 'visited' and new.visited_at is null then
    new.visited_at := now();
  end if;
  if new.status = 'closed' then
    new.closed_at := coalesce(new.closed_at, now());
    new.closed_by := coalesce(new.closed_by, auth.uid());
  end if;
  return new;
end $$;

create trigger tracing_tasks_stamp before insert or update on tracing_tasks
  for each row execute function public.trg_tracing_stamp();

revoke execute on function public.trg_tracing_stamp() from anon, authenticated, public;

create trigger tracing_tasks_audit after insert or update or delete on tracing_tasks
  for each row execute function trg_admin_audit();

-- ---------------------------------------------------------------------------
-- The outcome closes the loop on the child, not just on the task
-- ---------------------------------------------------------------------------
-- This is the whole reason the outcome vocabulary is an enum and not a note. A worker who
-- walks to a house and finds the family gone has learnt something about the child's lifecycle,
-- and if that knowledge stays inside the tracing task the same child is generated onto next
-- month's list, reminded by SMS, and counted in the denominator of a catchment they left.
create or replace function public.trg_tracing_outcome() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_status child_status;
begin
  if new.outcome is null or new.outcome is not distinct from old.outcome then
    return null;
  end if;

  v_status := case new.outcome
                when 'moved_away' then 'moved_out'::child_status
                when 'deceased'   then 'deceased'::child_status
                when 'refused'    then 'refused'::child_status
              end;

  if v_status is not null then
    update children
       set status        = v_status,
           status_reason = 'ট্রেসিং ফলাফল — ' || coalesce(new.outcome_note, new.outcome::text)
     where id = new.child_id
       and status = 'active';
  end if;
  return null;
end $$;

create trigger tracing_tasks_outcome after update of outcome on tracing_tasks
  for each row execute function public.trg_tracing_outcome();

revoke execute on function public.trg_tracing_outcome() from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- 2. WHO IS A DEFAULTER
-- ---------------------------------------------------------------------------
-- Computed live rather than read from `schedules.status`, which the nightly sweep maintains.
-- Both are correct; this one does not go stale between 00:00 and the sweep, and the tracing
-- board is looked at in the morning.
--
-- `child_is_reachable()` is what keeps a bereaved family off a route list (FR-56).
create or replace view v_defaulters
with (security_invoker = true) as
select ch.id                              as child_id,
       ch.child_id                        as child_code,
       ch.full_name,
       ch.date_of_birth,
       ch.location_id,
       ch.location_path,
       ch.facility_id,
       g.id                               as guardian_id,
       g.full_name                        as guardian_name,
       g.phone                            as guardian_phone,
       g.address,
       count(*)                           as doses_missed,
       min(sc.due_date)                   as earliest_due_date,
       (current_date - min(sc.due_date))  as days_overdue,
       -- The named antigens, so a worker knows what to carry before they leave.
       string_agg(distinct v.name_bn, ', ') as antigens_bn,
       exists (select 1 from tracing_tasks t
                where t.child_id = ch.id and t.status <> 'closed') as has_open_task
  from children ch
  join guardians g on g.id = ch.guardian_id
  join schedules sc on sc.child_id = ch.id
  join vaccines  v  on v.id = sc.vaccine_id
 where ch.deleted_at is null
   and child_is_reachable(ch.status)
   and sc.source = 'routine'
   and sc.status in ('pending', 'missed')
   and sc.due_date < current_date - schedule_grace_days(sc.vaccine_id)
 group by ch.id, ch.child_id, ch.full_name, ch.date_of_birth, ch.location_id,
          ch.location_path, ch.facility_id, g.id, g.full_name, g.phone, g.address;

comment on view public.v_defaulters is
  'Children with at least one routine dose overdue beyond its antigen grace period, with the '
  'guardian contact and the antigens owed. Deceased, moved-out and transferred children are '
  'excluded by child_is_reachable() (report BS-04, FR-20).';

-- ---------------------------------------------------------------------------
-- Generating the board
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER, because the nightly run has to see every defaulter in the country to raise
-- a task for each — v_defaulters is an invoker-rights view, and inside a definer function the
-- invoker is the owner, so RLS does not filter it. Every task it raises carries the child's own
-- location_path, so the scoped SELECT policy below still hands each supervisor only their own.
--
-- `p_scopes` is what keeps the on-demand caller honest: the job passes NULL and covers the
-- country; a supervisor pressing the button passes their own scopes and raises their own
-- board, not the nation's.
--
-- `on conflict do nothing` against the partial unique index is the idempotency: running it
-- twice in a day does not double the board.
create or replace function public.generate_tracing_tasks(
  p_due_in_days int default 7,
  p_scopes ltree[] default null
)
returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  insert into tracing_tasks
    (child_id, location_path, doses_missed_at_open, days_overdue_at_open, due_by)
  select d.child_id, d.location_path, d.doses_missed, d.days_overdue,
         current_date + greatest(p_due_in_days, 1)
    from v_defaulters d
   where not d.has_open_task
     and (p_scopes is null or d.location_path <@ any (p_scopes))
  on conflict (child_id) where status <> 'closed' do nothing;

  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke execute on function public.generate_tracing_tasks(int, ltree[])
  from anon, authenticated, public;

insert into job_runs (job_name, expected_interval)
values ('generate-tracing-tasks', interval '1 day')
on conflict (job_name) do nothing;

create or replace function public.job_generate_tracing_tasks() returns void
language plpgsql security definer set search_path = public as $$
declare v_started timestamptz := public.job_begin('generate-tracing-tasks'); v_n int;
begin
  v_n := public.generate_tracing_tasks();
  perform public.job_end('generate-tracing-tasks', v_started, v_n || ' tasks raised');
exception when others then
  perform public.job_end('generate-tracing-tasks', v_started, null, sqlerrm);
  raise;
end $$;

revoke execute on function public.job_generate_tracing_tasks() from anon, authenticated, public;

select cron.schedule('generate-tracing-tasks', '0 3 * * *',
                     $cron$select public.job_generate_tracing_tasks()$cron$);

-- A supervisor also needs to raise the board on demand — a session was cancelled, a ward was
-- flooded, the list is needed this afternoon. Same function, authorization checked because
-- SECURITY DEFINER means RLS does not state it.
create or replace function public.refresh_tracing_board(p_due_in_days int default 7)
returns int
language plpgsql security definer set search_path = public as $$
begin
  if not public.auth_has_role(array['supervisor','programme_manager','system_admin']::app_role[]) then
    raise exception 'Raising the tracing board requires a supervisor or above';
  end if;
  -- consume_rate_limit RETURNS the verdict, it does not raise. `perform` would discard it and
  -- the limit would silently do nothing — the mistake its own comment warns about.
  if not public.consume_rate_limit('tracing-board', 6, interval '1 hour') then
    raise exception 'Too many refreshes in the last hour. Try again later.';
  end if;
  return public.generate_tracing_tasks(p_due_in_days, public.auth_scopes());
end $$;

revoke execute on function public.refresh_tracing_board(int) from anon, public;
grant  execute on function public.refresh_tracing_board(int) to authenticated;

-- ---------------------------------------------------------------------------
-- The board, with everything a route list needs on one row
-- ---------------------------------------------------------------------------
create or replace view v_tracing_board
with (security_invoker = true) as
select t.id,
       t.status,
       t.child_id,
       ch.child_id            as child_code,
       ch.full_name,
       ch.date_of_birth,
       ch.status              as child_status,
       t.location_path,
       l.name_bn              as area_name_bn,
       g.full_name            as guardian_name,
       g.phone                as guardian_phone,
       g.address,
       t.assigned_to,
       p.full_name            as assignee_name,
       t.assigned_at,
       t.due_by,
       t.doses_missed_at_open,
       t.days_overdue_at_open,
       t.outcome,
       t.outcome_note,
       t.visited_at,
       t.closed_at,
       t.created_at,
       (t.status <> 'closed' and t.due_by is not null and t.due_by < current_date) as is_late
  from tracing_tasks t
  join children  ch on ch.id = t.child_id
  join guardians g  on g.id = ch.guardian_id
  left join locations l on l.id = ch.location_id
  left join profiles  p on p.id = t.assigned_to;

comment on view public.v_tracing_board is
  'The defaulter assignment board and the printable route list: one row per task with the '
  'child, the guardian, the address and the assignee.';

-- ===========================================================================
-- 3. AEFI
-- ===========================================================================
-- The vocabulary is WHO's, adopted verbatim (report §8.4) rather than invented, because an
-- AEFI classification that does not use the standard categories cannot be reported upward,
-- compared with anything, or defended.
create type aefi_severity as enum (
  'minor',    -- expected, self-limiting: fever, local reaction
  'severe',   -- requires medical attention, not life-threatening
  'serious'   -- death, hospitalisation, disability, congenital anomaly, life-threatening
);

create type aefi_status as enum (
  'reported',
  'under_investigation',
  'classified',
  'closed'
);

-- WHO causality assessment categories.
create type aefi_causality as enum (
  'vaccine_product',       -- caused by the vaccine itself
  'immunization_error',    -- caused by how it was stored, prepared or given
  'immunization_anxiety',  -- caused by anxiety about the injection
  'coincidental',          -- would have happened anyway
  'unclassifiable',        -- missing information prevents a conclusion
  'indeterminate'          -- evidence conflicts
);

create type aefi_outcome as enum (
  'recovered', 'recovering', 'recovered_with_sequelae', 'not_recovered', 'died', 'unknown'
);

create sequence public.aefi_code_seq start with 1;

create table aefi_cases (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique
                  default 'AEFI-' || lpad(nextval('public.aefi_code_seq')::text, 6, '0'),
  child_id      uuid not null references children(id) on delete restrict,
  -- The dose. Nullable because an event is sometimes reported before the record is found, and
  -- refusing to open the case until the paperwork matches is how reports stop being made.
  vaccination_record_id uuid references vaccination_records(id) on delete restrict,
  vaccine_id    uuid references vaccines(id) on delete restrict,
  -- The batch. This column is the reason a recall is possible: "which children reacted to
  -- BCG-2211" is one query, and it is the question that gets asked at three in the morning.
  inventory_id  uuid references inventories(id) on delete restrict,
  location_path ltree not null,
  facility_id   uuid references facilities(id) on delete restrict,
  onset_date    date not null check (onset_date <= current_date),
  symptoms      text not null check (length(symptoms) between 3 and 1000),
  severity      aefi_severity not null default 'minor',
  status        aefi_status   not null default 'reported',
  outcome       aefi_outcome  not null default 'unknown',
  causality     aefi_causality,
  investigation_note text check (investigation_note is null or length(investigation_note) between 3 and 2000),
  reported_by   uuid not null references profiles(id),
  reported_at   timestamptz not null default now(),
  investigated_by uuid references profiles(id),
  investigated_at timestamptz,
  closed_at     timestamptz,
  constraint aefi_code_format check (code ~ '^AEFI-[0-9]{6}$'),
  -- A case cannot be called classified without the classification. This is the constraint that
  -- stops the workflow degenerating back into the text box it replaced.
  constraint aefi_classified_complete check (
    status not in ('classified', 'closed') or causality is not null
  ),
  constraint aefi_closed_complete check ((status = 'closed') = (closed_at is not null))
);

create index aefi_child_idx      on aefi_cases (child_id, onset_date desc);
create index aefi_inventory_idx  on aefi_cases (inventory_id) where inventory_id is not null;
create index aefi_vaccine_idx    on aefi_cases (vaccine_id);
create index aefi_record_idx     on aefi_cases (vaccination_record_id);
create index aefi_path_gist      on aefi_cases using gist (location_path);
create index aefi_facility_idx   on aefi_cases (facility_id);
create index aefi_reported_by_idx     on aefi_cases (reported_by);
create index aefi_investigated_by_idx on aefi_cases (investigated_by);
-- The open queue: what an investigating officer opens the screen to see.
create index aefi_open_idx on aefi_cases (severity, onset_date desc)
  where status in ('reported', 'under_investigation');

comment on table public.aefi_cases is
  'AEFI as a case with a WHO causality classification and a batch link, not a free-text note '
  'on a dose record (report BS-12, FR-22). A serious case is a reportable event; the '
  'constraint that a classified case has a causality is what keeps it one.';

create or replace function public.trg_aefi_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if tg_op = 'INSERT' then
    select ch.location_path, ch.facility_id into new.location_path, new.facility_id
      from children ch where ch.id = new.child_id;
    if new.location_path is null then
      raise exception 'Unknown child';
    end if;

    -- Inherit the vaccine, batch and facility from the dose when one is named. Retyping them
    -- is how a case ends up implicating the wrong batch.
    if new.vaccination_record_id is not null then
      select vr.vaccine_id, vr.inventory_id, vr.facility_id into r
        from vaccination_records vr where vr.id = new.vaccination_record_id;
      new.vaccine_id   := coalesce(new.vaccine_id, r.vaccine_id);
      new.inventory_id := coalesce(new.inventory_id, r.inventory_id);
      new.facility_id  := coalesce(r.facility_id, new.facility_id);
    end if;
  end if;

  if new.status in ('under_investigation', 'classified') and new.investigated_at is null
     and new.investigated_by is not null then
    new.investigated_at := now();
  end if;
  if new.status = 'closed' then
    new.closed_at := coalesce(new.closed_at, now());
  end if;
  return new;
end $$;

create trigger aefi_cases_stamp before insert or update on aefi_cases
  for each row execute function public.trg_aefi_stamp();

revoke execute on function public.trg_aefi_stamp() from anon, authenticated, public;

create trigger aefi_cases_audit after insert or update or delete on aefi_cases
  for each row execute function trg_admin_audit();

-- ---------------------------------------------------------------------------
-- The text box becomes a case
-- ---------------------------------------------------------------------------
-- `vaccination_records.adverse_event` stays — it is what a worker types at the session table,
-- one-handed, and asking them to open a case form there would mean fewer events reported, not
-- better ones. What changes is that typing in it now *raises* a case, so the note reaches
-- somebody whose job is to look at it.
create or replace function public.trg_dose_aefi() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.adverse_event is null or length(btrim(new.adverse_event)) < 3 then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.adverse_event is not distinct from new.adverse_event then
    return null;
  end if;
  if exists (select 1 from aefi_cases a where a.vaccination_record_id = new.id) then
    return null;
  end if;

  insert into aefi_cases
    (child_id, vaccination_record_id, onset_date, symptoms, reported_by, location_path)
  values
    (new.child_id, new.id, new.administered_date, btrim(new.adverse_event),
     coalesce(new.administered_by, auth.uid()), new.location_path);
  return null;
end $$;

create trigger record_aefi after insert or update of adverse_event on vaccination_records
  for each row execute function public.trg_dose_aefi();

revoke execute on function public.trg_dose_aefi() from anon, authenticated, public;

-- Existing notes become cases, so the screen opens with the history rather than with an empty
-- table that implies nothing has ever happened.
insert into aefi_cases
  (child_id, vaccination_record_id, vaccine_id, inventory_id, onset_date, symptoms,
   reported_by, reported_at, location_path, facility_id)
select r.child_id, r.id, r.vaccine_id, r.inventory_id, r.administered_date,
       btrim(r.adverse_event), r.administered_by, r.created_at,
       coalesce(r.location_path, (select ch.location_path from children ch where ch.id = r.child_id)),
       r.facility_id
  from vaccination_records r
 where r.adverse_event is not null
   and length(btrim(r.adverse_event)) >= 3;

create or replace view v_aefi_cases
with (security_invoker = true) as
select a.id,
       a.code,
       a.status,
       a.severity,
       a.outcome,
       a.causality,
       a.onset_date,
       a.reported_at,
       a.symptoms,
       a.investigation_note,
       a.child_id,
       ch.child_id      as child_code,
       ch.full_name     as child_name,
       ch.date_of_birth,
       a.location_path,
       l.name_bn        as area_name_bn,
       a.facility_id,
       f.name_bn        as facility_name_bn,
       a.vaccine_id,
       v.code           as vaccine_code,
       v.name_bn        as vaccine_name_bn,
       a.inventory_id,
       i.batch_number,
       a.reported_by,
       rp.full_name     as reported_by_name,
       a.investigated_by,
       ip.full_name     as investigated_by_name,
       -- The service-level question a programme is judged on: a serious event has to be
       -- investigated within 48 hours, and this is the row that is late.
       (a.severity = 'serious'
        and a.status in ('reported', 'under_investigation')
        and a.reported_at < now() - interval '48 hours')          as investigation_overdue
  from aefi_cases a
  join children ch on ch.id = a.child_id
  left join locations  l  on l.path = a.location_path
  left join facilities f  on f.id = a.facility_id
  left join vaccines   v  on v.id = a.vaccine_id
  left join inventories i on i.id = a.inventory_id
  left join profiles   rp on rp.id = a.reported_by
  left join profiles   ip on ip.id = a.investigated_by;

-- ===========================================================================
-- 4. RLS
-- ===========================================================================
alter table tracing_tasks enable row level security;
alter table aefi_cases    enable row level security;

-- A worker sees the tasks in their catchment — they need the whole ward's list, not only their
-- own assignments, because tasks get swapped at the session table.
create policy tracing_tasks_select on tracing_tasks for select using (
  (select auth_role()) in ('worker','admin')
  and location_path <@ any ((select auth_scopes()))
);
create policy tracing_tasks_insert on tracing_tasks for insert with check (
  (select auth_has_role(array['supervisor','programme_manager','system_admin']::app_role[]))
  and location_path <@ any ((select auth_scopes()))
);
-- Assigning is a supervisor's act; recording what happened at the door is the assignee's, and
-- they must be able to do it without a supervisor present. Both are this one policy, and the
-- second branch is what makes the loop closeable in the field.
create policy tracing_tasks_update on tracing_tasks for update
  using (
    location_path <@ any ((select auth_scopes()))
    and (
      (select auth_has_role(array['supervisor','programme_manager','system_admin']::app_role[]))
      or assigned_to = (select auth.uid())
    )
  )
  with check (
    location_path <@ any ((select auth_scopes()))
    and (
      (select auth_has_role(array['supervisor','programme_manager','system_admin']::app_role[]))
      or assigned_to = (select auth.uid())
    )
  );
-- No delete policy. A task that was raised and abandoned is evidence; it is closed with an
-- outcome, not removed.

-- Anyone who may record a dose may report an event — that is the point of a reporting system,
-- and a threshold on reporting is a threshold on knowing.
create policy aefi_cases_select on aefi_cases for select using (
  ((select auth_role()) in ('worker','admin') and location_path <@ any ((select auth_scopes())))
  or exists (select 1 from children ch
              join guardians g on g.id = ch.guardian_id
             where ch.id = aefi_cases.child_id and g.user_id = (select auth.uid()))
);
create policy aefi_cases_insert on aefi_cases for insert with check (
  (select auth_role()) in ('worker','admin')
  and reported_by = (select auth.uid())
  and location_path <@ any ((select auth_scopes()))
);
-- Investigating and classifying is not. A causality assessment carries a clinical claim, and
-- the person who gave the dose is not the person who should be judging whether it caused harm.
create policy aefi_cases_update on aefi_cases for update
  using (
    (select auth_has_role(array['supervisor','programme_manager','system_admin']::app_role[]))
    and location_path <@ any ((select auth_scopes()))
  )
  with check (
    (select auth_has_role(array['supervisor','programme_manager','system_admin']::app_role[]))
    and location_path <@ any ((select auth_scopes()))
  );

-- ===========================================================================
-- 5. GRANTS
-- ===========================================================================
grant select, insert, update on public.tracing_tasks to authenticated;
grant select, insert, update on public.aefi_cases    to authenticated;
grant select on public.v_defaulters, public.v_tracing_board, public.v_aefi_cases
  to authenticated;
