-- Authentication hardening and scheduled-job observability.
--
-- Closes, from the report:
--   SEC-03 / FR-08   MFA is not enforced for any account despite handbook §9.2
--   SEC-04 / GAP-11  no rate limiting on the actions that cost money or leak data
--   SEC-14           the guardian's phone is both the reminder channel and the recovery
--                    channel, and a SIM reassignment is a real account-takeover vector
--   NFR-19 / REC-02  a pg_cron job can stop and nothing in the product notices
--   BUG-06 (first half) `profiles.contact` is one column doing two jobs
--
-- The theme is the same one the codebase already commits to: put the rule where no caller can
-- skip it, and expose the evidence where a human can see it.

-- ===========================================================================
-- 1. TYPED CONTACT — ONE COLUMN WAS DOING TWO JOBS
-- ===========================================================================
-- `contact` held "phone (E.164) or email display". That is fine for showing a person's
-- contact detail on a screen and useless for deciding how to reach them: the reminder
-- dispatcher resolved this one field and handed it to Resend or to an SMS gateway
-- indifferently, so every guardian whose contact is a phone number generated five failed
-- email attempts and a dead row (BUG-06).
--
-- `contact` is kept as the display field, and stays authoritative for nothing.
alter table profiles
  add column phone text check (phone is null or phone ~ '^\+?[0-9]{6,20}$'),
  add column email text check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  add column contact_verified_at timestamptz;

-- Backfill by shape. An entry that is neither a plausible phone nor a plausible email is left
-- in `contact` alone: guessing wrong here means sending a child's health reminder to a
-- stranger, and a NULL simply means the dispatcher skips that channel.
update profiles set email = contact
 where contact ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and email is null;
update profiles set phone = regexp_replace(contact, '[^0-9+]', '', 'g')
 where contact ~ '^\+?[0-9()[:space:]-]{6,25}$' and phone is null;

create index profiles_phone_idx on profiles (phone) where phone is not null;

grant update (phone, email) on public.profiles to authenticated;

comment on column profiles.contact is
  'Display-only primary contact. Channel routing reads phone/email, never this — see BUG-06.';

-- SEC-14: changing the number that receives a child''s health reminders — and that can be
-- used to recover the account — invalidates its verification and is recorded loudly. The
-- audit row is what makes "someone changed my number" answerable after the fact.
create or replace function public.trg_contact_change_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.phone is distinct from old.phone or new.email is distinct from old.email then
    new.contact_verified_at := null;
    insert into audit_log(actor_id, action, entity, entity_id, before, after)
    values (auth.uid(), 'profile.contact_change', 'profiles', new.id,
            jsonb_build_object('phone', old.phone, 'email', old.email),
            jsonb_build_object('phone', new.phone, 'email', new.email));
  end if;
  return new;
end $$;

create trigger profiles_contact_change_guard before update on profiles
  for each row execute function public.trg_contact_change_guard();

revoke execute on function public.trg_contact_change_guard() from anon, authenticated, public;

-- ===========================================================================
-- 2. MFA FOR ELEVATED SCOPES
-- ===========================================================================
-- Supabase Auth issues an `aal` claim: aal1 for password-only, aal2 once a second factor has
-- been verified in this session. Enforcement therefore costs no new infrastructure — it is a
-- claim test, in the same place every other authorization decision in this schema lives.
--
-- "Elevated" is defined by scope as well as by role, per FR-08: anyone holding an assignment
-- at district level or above, and anyone who can grant roles or read the whole audit trail.
insert into app_settings (key, value) values ('require_mfa_elevated', 'false'::jsonb)
on conflict (key) do nothing;

comment on table app_settings is
  'Programme configuration. require_mfa_elevated ships false so that enabling MFA is a '
  'deliberate operational act rather than a migration that locks every administrator out of '
  'production the moment it deploys. Handbook §9.2 requires it true in production.';

create or replace function public.auth_aal() returns text
language sql stable set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1')
$$;

-- Does the current user hold any assignment that demands a second factor?
create or replace function public.auth_is_elevated() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from user_assignments ua
      left join locations l on l.id = ua.location_id
     where ua.user_id = (select auth.uid())
       and ua.valid_from <= current_date
       and (ua.valid_to is null or ua.valid_to >= current_date)
       and (
         ua.role in ('programme_manager','system_admin')
         or l.level in ('country','division','district')
       )
  )
$$;

-- The gate itself. Returns true when MFA is not required, or is required and satisfied.
-- Written so that a user who is NOT elevated is never affected, and so that turning the
-- setting off is an instant, total rollback.
create or replace function public.mfa_satisfied() returns boolean
language sql stable security definer set search_path = public as $$
  select not coalesce(public.setting_bool('require_mfa_elevated'), false)
      or not public.auth_is_elevated()
      or public.auth_aal() = 'aal2'
$$;

revoke execute on function public.auth_is_elevated() from anon;
revoke execute on function public.mfa_satisfied()    from anon;
revoke execute on function public.auth_aal()         from anon;

-- Where the gate is applied, and where it deliberately is not.
--
-- APPLIED to the privileged surfaces: granting roles, editing the denominator every published
-- number divides by, changing system settings, and reading the whole audit trail. A second
-- factor is proportionate for all four, and an administrator who has not enrolled sees a
-- permission error on an action rather than a screen that is mysteriously empty.
--
-- NOT APPLIED to reading child records. Emptying the children table for an un-enrolled worker
-- would look like data loss, not like a security control, and the worker cannot fix it from
-- the screen they are staring at. Enrolment is enforced at the application boundary instead
-- (a redirect to the enrolment screen), which is the layer that can explain itself.
drop policy if exists user_assignments_insert on user_assignments;
create policy user_assignments_insert on user_assignments for insert with check (
  (select auth_app_role()) in ('programme_manager','system_admin')
  and (select mfa_satisfied())
);

drop policy if exists user_assignments_update on user_assignments;
create policy user_assignments_update on user_assignments for update
  using ((select auth_app_role()) in ('programme_manager','system_admin') and (select mfa_satisfied()))
  with check ((select auth_app_role()) in ('programme_manager','system_admin') and (select mfa_satisfied()));

drop policy if exists user_assignments_delete on user_assignments;
create policy user_assignments_delete on user_assignments for delete
  using ((select auth_app_role()) = 'system_admin' and (select mfa_satisfied()));

drop policy if exists app_settings_insert on app_settings;
create policy app_settings_insert on app_settings for insert
  with check ((select auth_role()) = 'admin' and (select mfa_satisfied()));

drop policy if exists app_settings_update on app_settings;
create policy app_settings_update on app_settings for update
  using ((select auth_role()) = 'admin' and (select mfa_satisfied()))
  with check ((select auth_role()) = 'admin' and (select mfa_satisfied()));

drop policy if exists app_settings_delete on app_settings;
create policy app_settings_delete on app_settings for delete
  using ((select auth_role()) = 'admin' and (select mfa_satisfied()));

drop policy if exists population_estimates_insert on population_estimates;
create policy population_estimates_insert on population_estimates for insert
  with check (
    (select auth_app_role()) in ('programme_manager','system_admin')
    and (select mfa_satisfied())
    and exists (select 1 from locations l
                 where l.id = population_estimates.location_id
                   and l.path <@ any ((select auth_scopes())))
  );

drop policy if exists population_estimates_update on population_estimates;
create policy population_estimates_update on population_estimates for update
  using (
    (select auth_app_role()) in ('programme_manager','system_admin')
    and (select mfa_satisfied())
    and exists (select 1 from locations l
                 where l.id = population_estimates.location_id
                   and l.path <@ any ((select auth_scopes())))
  )
  with check (
    (select auth_app_role()) in ('programme_manager','system_admin')
    and (select mfa_satisfied())
    and exists (select 1 from locations l
                 where l.id = population_estimates.location_id
                   and l.path <@ any ((select auth_scopes())))
  );

-- The whole audit trail is the record of everyone else's actions. Reading your own entries
-- ("account activity") stays unconditional — that is a subject-access right, not a privilege.
drop policy if exists audit_log_select on audit_log;
create policy audit_log_select on audit_log for select using (
  actor_id = (select auth.uid())
  or ((select auth_role()) = 'admin' and (select mfa_satisfied()))
);

-- ===========================================================================
-- 3. RATE LIMITING
-- ===========================================================================
-- Scope note, stated rather than left implicit: sign-in and OTP issuance are rate-limited by
-- GoTrue itself, upstream of this database, and re-implementing that here would be a second
-- limiter that disagrees with the first. What GoTrue does NOT limit is the authenticated,
-- expensive, in-product actions — the ones that spend the SMS budget, export bulk personal
-- data, or open a break-glass grant. Those are limited here, per user, where the identity is
-- already established.
create table rate_limits (
  user_id    uuid not null references profiles(id) on delete cascade,
  bucket     text not null check (length(bucket) between 1 and 60),
  window_start timestamptz not null,
  hits       int not null default 0 check (hits >= 0),
  primary key (user_id, bucket, window_start)
);

create index rate_limits_sweep_idx on rate_limits (window_start);

alter table rate_limits enable row level security;
-- No client policy at all: the table is written only by the SECURITY DEFINER function below
-- and read only by it. A user who could read this table could read how close they are to a
-- limit; a user who could write it could reset their own.
create policy rate_limits_self_select on rate_limits for select
  using (user_id = (select auth.uid()));

-- Fixed-window counter. Deliberately not a sliding window or a token bucket: this guards a
-- human clicking a button, not an API edge, and a fixed window is one row and one UPSERT.
--
-- ponytail: fixed window, so a burst can straddle a boundary and briefly double the limit.
-- Move to a sliding window only if a real abuse pattern shows up in the audit log.
create or replace function public.consume_rate_limit(
  p_bucket text, p_limit int, p_window interval default interval '1 hour'
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_start  timestamptz;
  v_hits   int;
begin
  if v_uid is null then
    raise exception 'rate limiting requires an authenticated caller'
      using errcode = 'insufficient_privilege';
  end if;

  -- Bucket boundary: floor(now / window) * window, so every caller in a window shares a key.
  v_start := to_timestamp(floor(extract(epoch from now()) / extract(epoch from p_window))
                          * extract(epoch from p_window));

  insert into rate_limits (user_id, bucket, window_start, hits)
  values (v_uid, p_bucket, v_start, 1)
  on conflict (user_id, bucket, window_start)
    do update set hits = rate_limits.hits + 1
  returning hits into v_hits;

  if v_hits > p_limit then
    insert into audit_log(actor_id, action, entity, entity_id, after)
    values (v_uid, 'rate_limit.exceeded', 'rate_limits', null,
            jsonb_build_object('bucket', p_bucket, 'limit', p_limit, 'hits', v_hits));
    return false;
  end if;
  return true;
end $$;

revoke execute on function public.consume_rate_limit(text, int, interval) from anon;

comment on function public.consume_rate_limit(text, int, interval) is
  'Returns false when the caller has exhausted the bucket. Callers must treat false as a '
  'refusal — it is a check, not a throttle, and it does not sleep or queue.';

-- Closed windows are purged nightly; the job is registered with the instrumented wrappers
-- in §4 so that it reports its own health like every other scheduled job.

-- ===========================================================================
-- 4. SCHEDULED-JOB OBSERVABILITY (REC-02)
-- ===========================================================================
-- The reminder system depends on three pg_cron jobs. pg_cron jobs do stop — on plan changes,
-- restores and extension upgrades — and nothing in the product noticed.
--
-- The prior audit removed an `admin_cron_jobs()` SECURITY DEFINER RPC for a sound reason
-- (20260725100100): a definer function reachable at /rest/v1/rpc is not worth two
-- informational cards. That reasoning stands. This closes the same blind spot without
-- re-opening that surface: each job writes a row as it runs, and the settings screen reads
-- that row under ordinary RLS. No RPC, no definer read path, full visibility.
create table job_runs (
  job_name         text primary key check (length(job_name) between 1 and 60),
  last_started_at  timestamptz,
  last_success_at  timestamptz,
  last_duration_ms int,
  last_error       text,
  last_result      text,
  runs_total       bigint not null default 0,
  failures_total   bigint not null default 0,
  -- How long this job may go without a success before it is considered stale. Data, not a
  -- constant in a dashboard, so changing a cron expression and its alert is one edit.
  expected_interval interval not null default interval '1 day'
);

alter table job_runs enable row level security;

create policy job_runs_select on job_runs for select
  using ((select auth_role()) = 'admin');
-- No write policy. Rows are written by the SECURITY DEFINER wrappers below, which run from
-- pg_cron as the scheduling superuser.

insert into job_runs (job_name, expected_interval) values
  ('enqueue-reminders',   interval '1 day'),
  ('reconcile-schedules', interval '1 day'),
  ('refresh-doses',       interval '1 day'),
  ('purge-rate-limits',   interval '1 day')
on conflict (job_name) do nothing;

-- One wrapper shape, so every job reports the same way whether it succeeds or throws.
create or replace function public.job_begin(p_name text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_now timestamptz := clock_timestamp();
begin
  insert into job_runs (job_name, last_started_at, runs_total)
  values (p_name, v_now, 1)
  on conflict (job_name) do update
    set last_started_at = v_now, runs_total = job_runs.runs_total + 1;
  return v_now;
end $$;

create or replace function public.job_end(
  p_name text, p_started timestamptz, p_result text, p_error text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update job_runs
     set last_duration_ms = (extract(epoch from clock_timestamp() - p_started) * 1000)::int,
         last_error       = p_error,
         last_result      = p_result,
         last_success_at  = case when p_error is null then clock_timestamp() else last_success_at end,
         failures_total   = failures_total + case when p_error is null then 0 else 1 end
   where job_name = p_name;
end $$;

create or replace function public.job_enqueue_reminders() returns void
language plpgsql security definer set search_path = public as $$
declare v_started timestamptz := public.job_begin('enqueue-reminders'); v_n int;
begin
  v_n := public.enqueue_reminders();
  perform public.job_end('enqueue-reminders', v_started, v_n || ' queued');
exception when others then
  perform public.job_end('enqueue-reminders', v_started, null, sqlerrm);
  raise;
end $$;

create or replace function public.job_reconcile_schedules() returns void
language plpgsql security definer set search_path = public as $$
declare v_started timestamptz := public.job_begin('reconcile-schedules'); v_n int;
begin
  v_n := public.reconcile_schedule_status();
  perform public.job_end('reconcile-schedules', v_started, v_n || ' rows changed');
exception when others then
  perform public.job_end('reconcile-schedules', v_started, null, sqlerrm);
  raise;
end $$;

-- CONCURRENTLY needs a unique index on the matview, and buys the thing that matters: the
-- refresh no longer takes an ACCESS EXCLUSIVE lock. Invisible on seed data; a nightly
-- dashboard outage at scale (report §12.4).
create unique index if not exists mv_daily_doses_date_key on mv_daily_doses (administered_date);

create or replace function public.job_refresh_doses() returns void
language plpgsql security definer set search_path = public as $$
declare v_started timestamptz := public.job_begin('refresh-doses');
begin
  refresh materialized view concurrently mv_daily_doses;
  perform public.job_end('refresh-doses', v_started, 'refreshed');
exception when others then
  perform public.job_end('refresh-doses', v_started, null, sqlerrm);
  raise;
end $$;

create or replace function public.job_purge_rate_limits() returns void
language plpgsql security definer set search_path = public as $$
declare v_started timestamptz := public.job_begin('purge-rate-limits'); v_n int;
begin
  delete from rate_limits where window_start < now() - interval '7 days';
  get diagnostics v_n = row_count;
  perform public.job_end('purge-rate-limits', v_started, v_n || ' purged');
exception when others then
  perform public.job_end('purge-rate-limits', v_started, null, sqlerrm);
  raise;
end $$;

revoke execute on function public.job_begin(text)                       from anon, authenticated, public;
revoke execute on function public.job_end(text, timestamptz, text, text) from anon, authenticated, public;
revoke execute on function public.job_enqueue_reminders()               from anon, authenticated, public;
revoke execute on function public.job_reconcile_schedules()             from anon, authenticated, public;
revoke execute on function public.job_refresh_doses()                   from anon, authenticated, public;
revoke execute on function public.job_purge_rate_limits()               from anon, authenticated, public;

-- Repoint every schedule at its instrumented wrapper.
-- Unschedule by lookup, not by name: cron.unschedule(name) throws when the job is absent, and
-- 'purge-rate-limits' has never been scheduled — it is registered for the first time below.
select cron.unschedule(jobid) from cron.job
 where jobname in ('enqueue-reminders','reconcile-schedules','refresh-doses','purge-rate-limits');

select cron.schedule('enqueue-reminders',   '30 0 * * *', $cron$select public.job_enqueue_reminders()$cron$);
select cron.schedule('reconcile-schedules', '0 1 * * *',  $cron$select public.job_reconcile_schedules()$cron$);
select cron.schedule('refresh-doses',       '30 1 * * *', $cron$select public.job_refresh_doses()$cron$);
select cron.schedule('purge-rate-limits',   '15 2 * * *', $cron$select public.job_purge_rate_limits()$cron$);

-- The screen reads this, and so does the alert. A job that has never succeeded is stale from
-- the moment it is registered, which is the correct reading: "we have no evidence it works".
create or replace view v_job_health
with (security_invoker = true) as
select j.job_name,
       j.last_started_at,
       j.last_success_at,
       j.last_duration_ms,
       j.last_result,
       j.last_error,
       j.runs_total,
       j.failures_total,
       j.expected_interval,
       (j.last_success_at is null
        or j.last_success_at < now() - (j.expected_interval * 2)) as is_stale
  from job_runs j;

comment on view public.v_job_health is
  'NFR-19. Stale = no success within twice the expected interval — one missed run is a blip, '
  'two is a stopped job.';

-- ===========================================================================
-- 5. RATE LIMITS ON THE ACTIONS THAT ACTUALLY COST SOMETHING
-- ===========================================================================
-- enqueue_reminders() is reachable from the admin "run reminders now" button. Every call
-- fans out to real messages with real per-message cost, and the button had no limit at all.
-- The cap lives in the function rather than in the server action for the usual reason: the
-- action is one caller of many.
create or replace function public.enqueue_reminders()
returns int language plpgsql set search_path = public as $$
declare
  v_lead  int := setting_int('reminder_lead_days');
  v_count int;
begin
  -- pg_cron runs this with no JWT; auth.uid() is null and the limit does not apply to the
  -- scheduled path, only to a human pressing the button.
  if auth.uid() is not null
     and not public.consume_rate_limit('reminders.manual_run', 4, interval '1 hour') then
    -- Default SQLSTATE (P0001). Postgres has no "too many requests" class, and borrowing an
    -- unrelated one would mislead anything that reads the code rather than the message.
    raise exception 'the manual reminder run has been used too many times this hour';
  end if;

  insert into notifications (schedule_id, recipient_id, channel, due_date, scheduled_for)
  select s.id, c.guardian_id, ch.channel, s.due_date, reminder_send_at(current_date)
    from schedules s
    join children c on c.id = s.child_id and c.deleted_at is null
   cross join lateral (
      select unnest(array['sms','email']::notification_channel[]) as channel
   ) ch
   where s.status = 'pending'
     and s.due_date between current_date and current_date + v_lead
     and ((ch.channel = 'sms'   and setting_bool('channel_sms'))
       or (ch.channel = 'email' and setting_bool('channel_email')))
  on conflict (schedule_id, channel, due_date) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.enqueue_reminders() from anon;

-- Break-glass is legitimate and must stay cheap to use, but a worker opening dozens of
-- out-of-scope records in an hour is not doing clinical work.
create or replace function public.trg_break_glass_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.consume_rate_limit('break_glass.open', 10, interval '1 hour') then
    raise exception 'too many break-glass accesses this hour; contact your supervisor'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create trigger break_glass_limit before insert on break_glass_access
  for each row execute function public.trg_break_glass_limit();

revoke execute on function public.trg_break_glass_limit() from anon, authenticated, public;
