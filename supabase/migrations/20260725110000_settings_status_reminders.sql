-- Three things that had to land together, because they all touch the access token hook:
--   1. app_settings   — the settings screen stops describing behaviour and starts controlling it
--   2. profiles.status — an account lifecycle that actually denies access, not a cosmetic pill
--   3. enqueue_reminders() — the half of the reminder system that needs no SMS provider

-- ===========================================================================
-- 1. APP SETTINGS
-- ===========================================================================
create table app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- Defaults match what the settings screen used to *claim* was happening. Now the claim and
-- the behaviour are the same row.
insert into app_settings (key, value) values
  ('reminder_lead_days', '3'::jsonb),
  ('daily_run_hour',     '20'::jsonb),
  ('channel_sms',        'true'::jsonb),
  ('channel_email',      'true'::jsonb),
  ('quiet_hours_start',  '21'::jsonb),
  ('quiet_hours_end',    '7'::jsonb);

alter table app_settings enable row level security;

-- Readable by any signed-in user (the reminder logic runs as the caller), writable by admin.
-- Split per action rather than one `for all`: a `for all` policy also matches SELECT and
-- would run alongside app_settings_select on every read — the overlap 20260725101000
-- removed from every other table.
create policy app_settings_select on app_settings for select using (
  (select auth.role()) = 'authenticated'
);
create policy app_settings_insert on app_settings for insert
  with check ((select auth_role()) = 'admin');
create policy app_settings_update on app_settings for update
  using ((select auth_role()) = 'admin')
  with check ((select auth_role()) = 'admin');
create policy app_settings_delete on app_settings for delete
  using ((select auth_role()) = 'admin');

create index app_settings_updated_by_idx on app_settings (updated_by);

create trigger app_settings_audit after insert or update or delete on app_settings
  for each row execute function trg_admin_audit();
create trigger app_settings_touch before update on app_settings
  for each row execute function trg_touch_updated_at();

-- Typed accessors so callers never repeat the jsonb cast.
create or replace function public.setting_int(p_key text)
returns int language sql stable set search_path = public as $$
  select (value #>> '{}')::int from app_settings where key = p_key
$$;

create or replace function public.setting_bool(p_key text)
returns boolean language sql stable set search_path = public as $$
  select (value #>> '{}')::boolean from app_settings where key = p_key
$$;

-- ===========================================================================
-- 2. ACCOUNT STATUS
-- ===========================================================================
create type user_status as enum ('invited', 'active', 'inactive');

-- Existing accounts are active; only newly invited ones start elsewhere.
alter table profiles add column status user_status not null default 'active';

-- Status is NOT self-service. The column grant has to name `status` for an admin to set it,
-- but column grants cannot distinguish an admin from a parent (both are `authenticated`), so
-- without this trigger a deactivated user could simply set themselves back to 'active'.
create or replace function public.trg_status_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status and coalesce(auth_role()::text, '') <> 'admin' then
    raise exception 'only an admin may change account status'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create trigger profiles_status_guard before update on profiles
  for each row execute function public.trg_status_guard();

revoke execute on function public.trg_status_guard() from anon, authenticated, public;
grant update (status) on public.profiles to authenticated;

-- ===========================================================================
-- 3. ACCESS TOKEN HOOK — stamp status alongside role
-- ===========================================================================
-- The hook runs as `supabase_auth_admin`. It already had read access to user_roles
-- (20260724140000); it now reads profiles too, and needs the same grant + policy or every
-- sign-in returns HTTP 500 exactly as it did before that fix.
grant select on public.profiles to supabase_auth_admin;

create policy profiles_auth_admin_read on public.profiles
  for select to supabase_auth_admin using (true);

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_role   user_role;
  v_status text;
  claims   jsonb;
begin
  select role into v_role from public.user_roles
   where user_id = (event->>'user_id')::uuid
   order by role limit 1;
  select status::text into v_status from public.profiles
   where id = (event->>'user_id')::uuid;

  claims := coalesce(event->'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{user_role}',   to_jsonb(coalesce(v_role::text, 'parent')));
  claims := jsonb_set(claims, '{user_status}', to_jsonb(coalesce(v_status, 'active')));
  return jsonb_set(event, '{claims}', claims);
end $$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- A suspended account keeps a valid JWT until it expires, so the deny has to live where every
-- policy already looks. auth_role() returning NULL makes every `auth_role() in (...)` test
-- fall to NULL — never true — so role-based access disappears system-wide from one place.
--
-- coalesce(..., 'active'): tokens minted before this migration carry no user_status claim.
-- Treating a missing claim as suspended would sign out every live session at once.
create or replace function public.auth_role() returns user_role
language sql stable set search_path = public as $$
  select case
           when coalesce(auth.jwt() ->> 'user_status', 'active') = 'active'
           then (auth.jwt() ->> 'user_role')::user_role
         end
$$;

-- ===========================================================================
-- 4. REMINDER ENQUEUE
-- ===========================================================================
-- Deliberately SECURITY INVOKER. A SECURITY DEFINER function is reachable at
-- /rest/v1/rpc/<name> by every signed-in user and is exactly what the security advisor
-- flags; here RLS already grants an admin everything this needs to read, and the insert
-- policy below is what authorises the write. pg_cron runs it as the scheduling superuser,
-- which bypasses RLS anyway.
create policy notifications_admin_insert on notifications for insert
  with check ((select auth_role()) = 'admin');

-- Scheduled send time for a given day, honouring quiet hours. Computed once here rather than
-- in the dispatcher so "when will this go out" has exactly one answer.
create or replace function public.reminder_send_at(p_day date)
returns timestamptz language plpgsql stable set search_path = public as $$
declare
  v_run   int := setting_int('daily_run_hour');
  v_start int := setting_int('quiet_hours_start');
  v_end   int := setting_int('quiet_hours_end');
  v_in_quiet boolean;
begin
  -- Quiet hours normally wrap midnight (21:00 -> 07:00), so the test differs by direction.
  v_in_quiet := case
    when v_start > v_end then v_run >= v_start or v_run < v_end
    else v_run >= v_start and v_run < v_end
  end;
  if v_in_quiet then
    -- Push to the moment quiet hours lift. If that hour has already passed today, it is
    -- tomorrow morning.
    return case
      when v_end > v_run then p_day + make_interval(hours => v_end)
      else p_day + 1 + make_interval(hours => v_end)
    end;
  end if;
  return p_day + make_interval(hours => v_run);
end $$;

-- Queues one reminder per (schedule, channel, due_date) for every pending dose falling due
-- inside the configured lead time. Idempotent by the table's own unique constraint, so
-- running it twice — or running it manually and then letting cron run — cannot double-send.
create or replace function public.enqueue_reminders()
returns int language plpgsql set search_path = public as $$
declare
  v_lead  int := setting_int('reminder_lead_days');
  v_count int;
begin
  insert into notifications (schedule_id, recipient_id, channel, due_date, scheduled_for)
  select s.id, c.guardian_id, ch.channel, s.due_date, reminder_send_at(current_date)
    from schedules s
    join children c on c.id = s.child_id
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
revoke execute on function public.reminder_send_at(date) from anon;

-- Enqueue once a day; reminder_send_at decides the hour each row actually goes out, so the
-- cron expression does not need to change when an admin edits the run time.
select cron.schedule('enqueue-reminders', '30 0 * * *', $cron$select public.enqueue_reminders()$cron$);
