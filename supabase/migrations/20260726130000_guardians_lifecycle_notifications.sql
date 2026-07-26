-- Guardians as a domain record, a lifecycle for children, duplicate merge, and the
-- notification rebuild that all three unblock.
--
-- Closes, from the report:
--   BS-02 / FR-14 / FR-15   a child could not exist without a registered guardian ACCOUNT
--   BS-05 / FR-16 / FR-17   no duplicate detection, no merge
--   BS-06 / FR-18 / FR-36   a child, once inserted, was `active` forever
--   BUG-06 / FR-50          the dispatcher sent email to phone numbers
--   BUG-07 / FR-51          no opt-out existed, contradicting a stated success criterion
--   BUG-08 / FR-52          six messages in one evening to one guardian
--   BUG-11                  two sources of truth for the number reminders are sent to
--   FR-54                   no overdue reminder distinct from the due-soon reminder
--   FR-55                   message bodies were string literals in a Deno function
--   FR-56                   reminders did not stop for a bereaved family
--
-- These land together because they are one dependency chain, not four features: the
-- authoritative phone number lives on the guardian, the decision to send at all depends on
-- the child's lifecycle, and the dispatcher cannot be fixed without both.

-- ===========================================================================
-- 1. GUARDIANS
-- ===========================================================================
-- The overwhelming majority of children are registered by a health worker at a session, from
-- a guardian who has no smartphone, no email and no account. `children.guardian_id NOT NULL
-- REFERENCES profiles(id)` forced the worker to either invent an auth account on that
-- guardian's behalf or attach the child to somebody else's profile. The second is what
-- actually happens in production systems, and it silently destroys ownership: RLS then shows
-- the child to the wrong person and reminders go to the wrong number.
--
-- Splitting guardian (a domain record) from user account (an auth identity) turns parent
-- onboarding from a prerequisite into a growth loop.
create type guardian_relationship as enum (
  'mother', 'father', 'grandparent', 'sibling', 'other_relative', 'caregiver'
);

create table guardians (
  id           uuid primary key default gen_random_uuid(),
  -- NULL until the guardian claims their account. This nullability is the entire point.
  user_id      uuid unique references profiles(id) on delete set null,
  full_name    text not null check (length(full_name) between 1 and 120),
  -- Authoritative for reminders. BUG-11 existed because two columns held this and the
  -- dispatcher and the UI each believed a different one.
  phone        text not null check (phone ~ '^\+?[0-9]{6,20}$'),
  email        text check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  relationship guardian_relationship not null default 'mother',
  -- Optional and verifiable-later, never a registration prerequisite: birth-registration
  -- coverage is incomplete and many families have no NID at first contact (report §8.3).
  national_id  text check (national_id is null or national_id ~ '^[0-9]{10,17}$'),
  address      text check (address is null or length(address) between 1 and 300),
  location_id  uuid references locations(id) on delete restrict,
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index guardians_phone_idx    on guardians (phone) where deleted_at is null;
create index guardians_user_idx     on guardians (user_id);
create index guardians_location_idx on guardians (location_id);
create index guardians_created_by_idx on guardians (created_by);

create trigger guardians_touch_updated_at before update on guardians
  for each row execute function public.trg_touch_updated_at();
create trigger guardians_audit after insert or update or delete on guardians
  for each row execute function trg_admin_audit();

-- Backfill. The guardian row deliberately takes the SAME id as the profile it is derived
-- from, so every existing children.guardian_id value stays valid and the foreign key can be
-- re-pointed without touching a single child row. New guardians get fresh uuids and no
-- profile, which is the whole reason the table exists.
insert into guardians (id, user_id, full_name, phone, email, address, created_by, created_at)
select p.id,
       p.id,
       p.full_name,
       -- A guardian must have a phone. Where the profile has none, the child's legacy
       -- guardian_contact is the next best source; failing both, a placeholder that fails the
       -- format check would abort the migration, so an explicit unknown marker is used and
       -- reported by the data-quality view below.
       coalesce(
         p.phone,
         (select c.guardian_contact from children c
           where c.guardian_id = p.id and c.guardian_contact ~ '^\+?[0-9()[:space:]-]{6,25}$'
           limit 1),
         '+000000000000'
       ),
       p.email,
       p.address,
       p.id,
       p.created_at
  from profiles p
 where exists (select 1 from children c where c.guardian_id = p.id);

-- Normalise anything the backfill pulled out of free text.
update guardians set phone = regexp_replace(phone, '[^0-9+]', '', 'g')
 where phone !~ '^\+?[0-9]{6,20}$';

comment on column guardians.phone is
  'Authoritative contact for reminders and for account claim. +000000000000 marks a record '
  'migrated from a profile that had no usable number — surfaced by v_data_quality, never sent to.';

-- Re-point the foreign key. children.guardian_id keeps its name and its values; only what it
-- means changes, and it now means a guardian rather than a login.
alter table children drop constraint children_guardian_id_fkey;
alter table children
  add constraint children_guardian_id_fkey
  foreign key (guardian_id) references guardians(id) on delete restrict;

-- BUG-11: the second source of truth goes away entirely rather than being kept in sync.
alter table children drop column guardian_contact;

-- ===========================================================================
-- 2. CHILD LIFECYCLE
-- ===========================================================================
-- A child, once inserted, was `active` forever: reminders never stopped, denominators
-- inflated with children who had left the catchment or died, and dropout was permanently
-- overstated.
--
-- FR-56 is not a nicety. A system that texts a bereaved family "your child's next vaccine is
-- due" has failed in a way no coverage metric captures.
create type child_status as enum (
  'active',
  'moved_out',    -- left the catchment; leaves this denominator, may join another
  'transferred',  -- moved to a named facility inside the programme
  'refused',      -- guardian declined; recorded, respected, still counted in the denominator
  'deceased',
  'aged_out'      -- past the age the routine schedule covers
);

alter table children
  add column status            child_status not null default 'active',
  add column status_changed_at timestamptz  not null default now(),
  add column status_reason     text check (status_reason is null or length(status_reason) between 3 and 300),
  -- BS-05 groundwork: the one identifier that makes exact duplicate detection possible.
  add column birth_registration_no text
    check (birth_registration_no is null or birth_registration_no ~ '^[0-9]{17}$'),
  add column merged_into_id    uuid references children(id) on delete restrict;

create index children_status_idx    on children (status) where deleted_at is null;
create index children_merged_idx    on children (merged_into_id) where merged_into_id is not null;
create unique index children_brn_key on children (birth_registration_no)
  where birth_registration_no is not null and deleted_at is null;

-- `active` is the only status that receives reminders or counts as awaiting a dose. Naming
-- the set once, here, keeps every consumer honest.
create or replace function public.child_is_reachable(p_status child_status)
returns boolean language sql immutable set search_path = public as $$
  select p_status = 'active'
$$;

create table child_status_history (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references children(id) on delete cascade,
  from_status child_status,
  to_status   child_status not null,
  reason      text,
  changed_by  uuid references profiles(id),
  changed_at  timestamptz not null default now()
);

create index child_status_history_child_idx on child_status_history (child_id, changed_at desc);
create index child_status_history_changed_by_idx on child_status_history (changed_by);

create or replace function public.trg_child_status_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();

    insert into child_status_history (child_id, from_status, to_status, reason, changed_by)
    values (new.id, old.status, new.status, new.status_reason, auth.uid());

    -- A status that stops messaging must stop it immediately, not at the next nightly run.
    -- Cancelling queued rows is the difference between "we will not send another" and "we
    -- already have one in the queue for tomorrow morning".
    if not public.child_is_reachable(new.status) then
      update notifications
         set status = 'dead',
             last_error = 'cancelled: child status ' || new.status
       where child_id = new.id
         and status in ('queued', 'failed');
    end if;
  end if;
  return new;
end $$;

revoke execute on function public.trg_child_status_history() from anon, authenticated, public;

-- ===========================================================================
-- 3. DUPLICATE DETECTION AND MERGE
-- ===========================================================================
-- A child registered at a facility in January and again at an outreach session in March by a
-- worker who cannot find the first record *will* be duplicated. A duplicate produces two
-- schedules, two coverage contributions, doubled reminders and a permanently wrong
-- denominator.
--
-- Normalisation is deliberately crude — casefold, strip everything that is not a letter or a
-- Bengali character, collapse whitespace. Fancier matching (phonetic, edit distance) is a
-- research project; this catches the overwhelmingly common cases of spacing and honorifics.
create or replace function public.normalise_name(p_name text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(lower(trim(coalesce(p_name, ''))), '[^[:alnum:]ঀ-৿]+', ' ', 'g')
$$;

create index children_dedup_idx
  on children (public.normalise_name(full_name), date_of_birth)
  where deleted_at is null and merged_into_id is null;

-- Returns likely matches with a reason, for the worker to confirm or dismiss at registration.
-- SECURITY INVOKER on purpose: a worker must only ever be shown duplicates inside their own
-- scope, and that is exactly what the children_select policy already decides.
-- Output columns are prefixed `m_`: a RETURNS TABLE parameter is in scope inside the body of
-- a SQL function, so naming one `child_id` would make every `c.child_id` reference ambiguous.
create or replace function public.find_duplicate_children(
  p_full_name text,
  p_date_of_birth date,
  p_guardian_phone text default null,
  p_birth_registration_no text default null
)
returns table (m_id uuid, m_child_id text, m_full_name text, m_date_of_birth date,
               m_guardian_name text, m_reason text, m_confidence text)
language sql stable set search_path = public as $$
  select c.id, c.child_id, c.full_name, c.date_of_birth, g.full_name,
         case
           when p_birth_registration_no is not null
                and c.birth_registration_no = p_birth_registration_no then 'জন্ম নিবন্ধন নম্বর মিলেছে'
           when public.normalise_name(c.full_name) = public.normalise_name(p_full_name)
                and c.date_of_birth = p_date_of_birth then 'নাম ও জন্মতারিখ মিলেছে'
           else 'অভিভাবকের ফোন ও জন্মতারিখ মিলেছে'
         end,
         case
           when p_birth_registration_no is not null
                and c.birth_registration_no = p_birth_registration_no then 'exact'
           when public.normalise_name(c.full_name) = public.normalise_name(p_full_name)
                and c.date_of_birth = p_date_of_birth then 'high'
           else 'possible'
         end
    from children c
    join guardians g on g.id = c.guardian_id
   where c.deleted_at is null
     and c.merged_into_id is null
     and (
       (p_birth_registration_no is not null and c.birth_registration_no = p_birth_registration_no)
       or (public.normalise_name(c.full_name) = public.normalise_name(p_full_name)
           and c.date_of_birth = p_date_of_birth)
       or (p_guardian_phone is not null and g.phone = p_guardian_phone
           and c.date_of_birth = p_date_of_birth)
     )
   limit 10
$$;

revoke execute on function public.find_duplicate_children(text, date, text, text) from anon;

-- Merging keeps BOTH identifiers resolvable. A printed card carrying the loser's Child ID is
-- in a family's hands and will be presented at a session years from now; a merge that makes
-- that card stop working has moved the problem onto the person least able to solve it.
create or replace function public.merge_children(
  p_loser_id uuid, p_winner_id uuid, p_reason text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_moved int;
begin
  if p_loser_id = p_winner_id then
    raise exception 'a child cannot be merged into itself';
  end if;
  if coalesce(auth.uid()::text, '') <> '' and not public.auth_has_role(
       array['supervisor','programme_manager','system_admin']::app_role[]) then
    raise exception 'merging duplicate children requires a supervisor or above'
      using errcode = 'insufficient_privilege';
  end if;
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'a merge requires a reason';
  end if;
  if exists (select 1 from children where id = p_winner_id and merged_into_id is not null) then
    raise exception 'the surviving record has itself been merged away';
  end if;

  -- Doses move first and are the reason the merge exists: the whole point is that the child's
  -- immunization history stops being split across two records. A dose that would collide with
  -- one already on the winner is voided rather than dropped, so the count is explainable.
  update vaccination_records r
     set child_id = p_winner_id
   where r.child_id = p_loser_id
     and not exists (
       select 1 from vaccination_records w
        where w.child_id = p_winner_id
          and w.vaccine_id = r.vaccine_id
          and w.dose_number = r.dose_number
          and w.voided_at is null
     );
  get diagnostics v_moved = row_count;

  update vaccination_records
     set voided_at = now(), voided_by = auth.uid(),
         void_reason = 'duplicate merged into ' || p_winner_id::text
   where child_id = p_loser_id and voided_at is null;

  -- The loser's schedule rows are redundant once the doses have moved; the winner's schedule
  -- is re-derived from the combined history below.
  delete from schedules where child_id = p_loser_id;
  update notifications set status = 'dead', last_error = 'cancelled: duplicate merged'
   where child_id = p_loser_id and status in ('queued', 'failed');

  update children
     set merged_into_id = p_winner_id,
         status = 'transferred',
         status_reason = left('merged: ' || p_reason, 300),
         deleted_at = now(),
         deleted_by = auth.uid(),
         delete_reason = left('merged into ' || p_winner_id::text || ': ' || p_reason, 300)
   where id = p_loser_id;

  perform public.rederive_schedules(p_winner_id);

  insert into audit_log(actor_id, action, entity, entity_id, before, after)
  values (auth.uid(), 'child.merge', 'children', p_loser_id,
          jsonb_build_object('loser', p_loser_id),
          jsonb_build_object('winner', p_winner_id, 'doses_moved', v_moved, 'reason', p_reason));
end $$;

revoke execute on function public.merge_children(uuid, uuid, text) from anon;

-- Resolving a Child ID must follow the merge chain, or a printed card stops working.
create or replace function public.resolve_child(p_child_id text)
returns uuid language sql stable set search_path = public as $$
  with target as (select id, merged_into_id from children where child_id = p_child_id)
  select coalesce((select merged_into_id from target), (select id from target))
$$;

revoke execute on function public.resolve_child(text) from anon;

-- ===========================================================================
-- 4. THE GUARDIAN CLAIM (FR-15)
-- ===========================================================================
-- A guardian claims the children registered on their behalf by signing in with the phone
-- number the worker recorded, then supplying a Child ID. There is deliberately no separate
-- OTP: Supabase Auth has already proved control of the number by the time this runs, and
-- inventing a second one-time code would be a second thing to get wrong.
--
-- The number match is the whole security property, so it is done here and not in app code.
create or replace function public.claim_child(p_child_id text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_phone     text := nullif(auth.jwt() ->> 'phone', '');
  v_child     uuid;
  v_guardian  uuid;
  v_g_phone   text;
begin
  if v_uid is null then
    raise exception 'sign in before claiming a child' using errcode = 'insufficient_privilege';
  end if;
  if v_phone is null then
    raise exception 'claiming requires an account verified by phone number'
      using errcode = 'insufficient_privilege';
  end if;
  if not public.consume_rate_limit('child.claim', 8, interval '1 hour') then
    raise exception 'too many claim attempts this hour';
  end if;

  v_child := public.resolve_child(p_child_id);
  if v_child is null then
    -- Deliberately the same message as a phone mismatch: distinguishing them turns this into
    -- an oracle for "does this Child ID exist".
    raise exception 'child id and phone number do not match';
  end if;

  select c.guardian_id, g.phone into v_guardian, v_g_phone
    from children c join guardians g on g.id = c.guardian_id
   where c.id = v_child;

  if regexp_replace(coalesce(v_g_phone, ''), '[^0-9]', '', 'g')
     is distinct from regexp_replace(v_phone, '[^0-9]', '', 'g') then
    raise exception 'child id and phone number do not match';
  end if;

  if exists (select 1 from guardians where id = v_guardian and user_id is not null
               and user_id <> v_uid) then
    raise exception 'this guardian record is already linked to another account';
  end if;

  update guardians set user_id = v_uid where id = v_guardian;

  insert into audit_log(actor_id, action, entity, entity_id, after)
  values (v_uid, 'guardian.claim', 'guardians', v_guardian,
          jsonb_build_object('child_id', p_child_id));

  return v_guardian;
end $$;

revoke execute on function public.claim_child(text) from anon;

-- ===========================================================================
-- 5. RLS FOR GUARDIANS, AND THE POLICIES THAT NOW GO THROUGH THEM
-- ===========================================================================
alter table guardians            enable row level security;
alter table child_status_history enable row level security;

create policy guardians_select on guardians for select using (
  user_id = (select auth.uid())
  or (
    (select auth_role()) in ('worker','admin')
    and (location_id is null
         or exists (select 1 from locations l
                     where l.id = guardians.location_id
                       and l.path <@ any ((select auth_scopes()))))
  )
);
create policy guardians_insert on guardians for insert
  with check ((select auth_role()) in ('worker','admin'));
create policy guardians_update on guardians for update
  using ((select auth_role()) in ('worker','admin') or user_id = (select auth.uid()))
  with check ((select auth_role()) in ('worker','admin') or user_id = (select auth.uid()));

create policy child_status_history_select on child_status_history for select using (
  exists (select 1 from children c where c.id = child_status_history.child_id)
);

-- Ownership is now "the guardian record linked to my account", not "my user id is in the
-- child row". Every policy that expressed the old rule is rewritten; the shape is the one
-- §11.6 of the report specifies.
drop policy if exists children_select on children;
create policy children_select on children for select using (
  exists (select 1 from guardians g
           where g.id = children.guardian_id and g.user_id = (select auth.uid()))
  or (
    deleted_at is null
    and (select auth_role()) in ('worker','admin')
    and location_path <@ any ((select auth_scopes()))
  )
  or (
    (select auth_app_role()) in ('programme_manager','system_admin')
    and location_path <@ any ((select auth_scopes()))
  )
  or exists (
    select 1 from break_glass_access b
     where b.child_id = children.id
       and b.user_id = (select auth.uid())
       and b.expires_at > now()
  )
);

drop policy if exists children_insert on children;
create policy children_insert on children for insert with check (
  exists (select 1 from guardians g
           where g.id = children.guardian_id and g.user_id = (select auth.uid()))
  or (
    (select auth_role()) in ('worker','admin')
    and location_path <@ any ((select auth_scopes()))
  )
);

drop policy if exists schedules_select on schedules;
create policy schedules_select on schedules for select using (
  exists (
    select 1 from children c
     where c.id = schedules.child_id
       and (
         exists (select 1 from guardians g
                  where g.id = c.guardian_id and g.user_id = (select auth.uid()))
         or ((select auth_role()) in ('worker','admin')
             and c.location_path <@ any ((select auth_scopes())))
       )
  )
);

drop policy if exists vr_select on vaccination_records;
create policy vr_select on vaccination_records for select using (
  ((select auth_role()) in ('worker','admin')
   and location_path <@ any ((select auth_scopes())))
  or exists (select 1 from children c
               join guardians g on g.id = c.guardian_id
              where c.id = vaccination_records.child_id
                and g.user_id = (select auth.uid()))
);

-- The lifecycle trigger is created after the policies so nothing fires against a half-built
-- rule set during the migration itself.
create trigger children_status_history before update on children
  for each row execute function public.trg_child_status_history();

-- ===========================================================================
-- 6. NOTIFICATIONS REBUILT
-- ===========================================================================
-- Three defects, one cause: the queue was keyed on a schedule and addressed to a profile.
--
--   BUG-06  every pending schedule fanned out to BOTH sms and email, and the dispatcher then
--           resolved one field (profiles.contact) and handed it to Resend or to an SMS
--           gateway indifferently. A parent whose contact is a phone number generated five
--           failed email attempts and a dead row, every time.
--   BUG-07  no opt-out existed at all, contradicting the handbook's own Phase 3 success
--           criterion "parent opt-out honored".
--   BUG-08  idempotency on (schedule_id, channel, due_date) meant a 6-week-old with Penta-1,
--           PCV-1 and OPV-2 due the same day produced 3 schedules x 2 channels = SIX messages
--           in one evening, to one guardian. At 14 weeks it is worse.
create type notification_kind as enum ('due_soon', 'overdue');

create table notification_preferences (
  guardian_id uuid primary key references guardians(id) on delete cascade,
  sms_enabled   boolean not null default true,
  email_enabled boolean not null default true,
  -- The blunt instrument, honoured before any per-channel setting. A guardian who says stop
  -- means stop, and it must not require reasoning about three booleans to work out that it did.
  opted_out_at  timestamptz,
  opt_out_reason text check (opt_out_reason is null or length(opt_out_reason) <= 300),
  updated_at    timestamptz not null default now()
);

alter table notification_preferences enable row level security;

create policy notification_preferences_select on notification_preferences for select using (
  exists (select 1 from guardians g
           where g.id = notification_preferences.guardian_id
             and (g.user_id = (select auth.uid()) or (select auth_role()) in ('worker','admin')))
);
create policy notification_preferences_insert on notification_preferences for insert
  with check (
    exists (select 1 from guardians g
             where g.id = notification_preferences.guardian_id
               and (g.user_id = (select auth.uid()) or (select auth_role()) in ('worker','admin')))
  );
create policy notification_preferences_update on notification_preferences for update
  using (
    exists (select 1 from guardians g
             where g.id = notification_preferences.guardian_id
               and (g.user_id = (select auth.uid()) or (select auth_role()) in ('worker','admin')))
  )
  with check (
    exists (select 1 from guardians g
             where g.id = notification_preferences.guardian_id
               and (g.user_id = (select auth.uid()) or (select auth_role()) in ('worker','admin')))
  );

create trigger notification_preferences_audit
  after insert or update or delete on notification_preferences
  for each row execute function trg_admin_audit();

-- FR-55: message bodies stop being string literals inside a Deno function. A template is
-- versioned data, so changing the Bangla wording is an edit an operator can make and an
-- auditor can see, not a redeploy.
create table message_templates (
  key        text not null check (length(key) between 1 and 60),
  version    int  not null check (version >= 1),
  channel    notification_channel not null,
  locale     text not null default 'bn' check (locale in ('bn','en')),
  subject    text,
  body       text not null check (length(body) between 1 and 1000),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (key, version, channel, locale)
);

alter table message_templates enable row level security;
create policy message_templates_select on message_templates for select
  using ((select auth.role()) = 'authenticated');
create policy message_templates_insert on message_templates for insert
  with check ((select auth_role()) = 'admin' and (select mfa_satisfied()));
create policy message_templates_update on message_templates for update
  using ((select auth_role()) = 'admin' and (select mfa_satisfied()))
  with check ((select auth_role()) = 'admin' and (select mfa_satisfied()));

-- {{child_name}}, {{due_date}}, {{dose_list}} are substituted by the dispatcher. Bengali
-- numerals are applied to the substituted values, not stored in the template, so the same
-- template works if an English locale is ever added.
insert into message_templates (key, version, channel, locale, subject, body) values
  ('dose_due_soon', 1, 'sms', 'bn', null,
   'প্রিয় অভিভাবক, {{child_name}}-এর টিকার তারিখ {{due_date}}। প্রাপ্য টিকা: {{dose_list}}। নিকটস্থ টিকাকেন্দ্রে যোগাযোগ করুন। — VaxTrace'),
  ('dose_due_soon', 1, 'email', 'bn', 'টিকার সময় হয়েছে — VaxTrace',
   'প্রিয় অভিভাবক,{{newline}}{{newline}}{{child_name}}-এর পরবর্তী টিকার তারিখ {{due_date}}।{{newline}}প্রাপ্য টিকা: {{dose_list}}।{{newline}}{{newline}}নিকটস্থ টিকাকেন্দ্রে যোগাযোগ করুন।{{newline}}{{newline}}— VaxTrace'),
  ('dose_overdue', 1, 'sms', 'bn', null,
   'প্রিয় অভিভাবক, {{child_name}}-এর টিকার তারিখ ({{due_date}}) পেরিয়ে গেছে। বাকি টিকা: {{dose_list}}। দ্রুত নিকটস্থ টিকাকেন্দ্রে যোগাযোগ করুন। — VaxTrace'),
  ('dose_overdue', 1, 'email', 'bn', 'টিকার তারিখ পেরিয়ে গেছে — VaxTrace',
   'প্রিয় অভিভাবক,{{newline}}{{newline}}{{child_name}}-এর টিকার তারিখ ({{due_date}}) পেরিয়ে গেছে।{{newline}}বাকি টিকা: {{dose_list}}।{{newline}}{{newline}}দ্রুত নিকটস্থ টিকাকেন্দ্রে যোগাযোগ করুন।{{newline}}{{newline}}— VaxTrace');

-- The queue is re-keyed from (schedule, channel, day) to (child, channel, day): one message
-- per child per channel per day, listing every dose due, instead of one per dose.
alter table notifications
  add column child_id      uuid references children(id) on delete cascade,
  add column guardian_id   uuid references guardians(id) on delete cascade,
  add column kind          notification_kind not null default 'due_soon',
  add column send_date     date,
  add column dose_count    int not null default 1 check (dose_count >= 1),
  add column recipient_to  text,          -- the address actually used, frozen at enqueue time
  add column template_key  text,
  add column template_version int,
  add column provider_status text;        -- FR-53: written back by the delivery webhook

update notifications n
   set child_id = s.child_id,
       guardian_id = c.guardian_id,
       send_date = n.due_date,
       recipient_to = p.contact
  from schedules s
  join children c on c.id = s.child_id
  left join profiles p on p.id = n.recipient_id
 where s.id = n.schedule_id and n.child_id is null;

-- Legacy rows that cannot be resolved (a schedule since deleted) would block the NOT NULLs.
delete from notifications where child_id is null;

alter table notifications
  alter column child_id set not null,
  alter column send_date set not null,
  -- A batched message covers several schedules, so it cannot belong to one of them.
  alter column schedule_id drop not null,
  -- recipient_id was the profile; a guardian without an account has none, which is exactly
  -- the case BS-02 exists to support.
  alter column recipient_id drop not null;

alter table notifications drop constraint notifications_schedule_id_channel_due_date_key;
create unique index notifications_batch_key
  on notifications (child_id, channel, kind, send_date);

create index notifications_guardian_idx on notifications (guardian_id);
create index notifications_child_idx    on notifications (child_id);

comment on index public.notifications_batch_key is
  'BUG-08. One message per child per channel per kind per day. The old key was per schedule, '
  'which sent six messages in one evening to the guardian of a 6-week-old.';

-- ---------------------------------------------------------------------------
-- ENQUEUE, REBUILT
-- ---------------------------------------------------------------------------
-- Routing is the fix for BUG-06 and it is one rule: a channel is only queued if the guardian
-- has an address OF THAT KIND. sms needs a phone, email needs an email. No more handing a
-- phone number to Resend.
create or replace function public.enqueue_reminders()
returns int language plpgsql set search_path = public as $$
declare
  v_lead  int := setting_int('reminder_lead_days');
  v_count int;
begin
  if auth.uid() is not null
     and not public.consume_rate_limit('reminders.manual_run', 4, interval '1 hour') then
    raise exception 'the manual reminder run has been used too many times this hour';
  end if;

  with due_raw as (
    select s.child_id,
           c.guardian_id,
           g.phone,
           g.email,
           min(s.due_date) as due_date,
           count(*)        as dose_count
      from schedules s
      join children  c on c.id = s.child_id
      join guardians g on g.id = c.guardian_id
      left join notification_preferences np on np.guardian_id = g.id
     where s.status in ('pending', 'missed')
       and s.source = 'routine'
       -- FR-56. The single most important predicate in this function.
       and public.child_is_reachable(c.status)
       and c.deleted_at is null
       and g.deleted_at is null
       -- BUG-07: opt-out, honoured before anything else.
       and np.opted_out_at is null
       and (
         -- due soon, inside the lead window
         (s.status = 'pending' and s.due_date between current_date and current_date + v_lead)
         -- FR-54: overdue gets its own cadence — weekly, not daily, so a family that has
         -- already been told is not told again every morning.
         or (s.status = 'missed' and (current_date - s.due_date) % 7 = 0)
       )
     group by s.child_id, c.guardian_id, g.phone, g.email
  ),
  due as (
    -- `kind` is derived here rather than in due_raw: it depends on min(due_date), and an
    -- aggregate cannot appear in a GROUP BY. A child with both an overdue and an upcoming
    -- dose lands in one `overdue` batch covering everything outstanding, which is the message
    -- a guardian should actually receive.
    select d.*,
           (case when d.due_date < current_date then 'overdue' else 'due_soon' end)
             ::notification_kind as kind
      from due_raw d
  ),
  routed as (
    select d.*, ch.channel, ch.address
      from due d
     cross join lateral (values
       ('sms'::notification_channel,   d.phone),
       ('email'::notification_channel, d.email)
     ) as ch(channel, address)
     where ch.address is not null
       and ch.address <> '+000000000000'
       and ((ch.channel = 'sms'   and setting_bool('channel_sms')
             and coalesce((select np.sms_enabled from notification_preferences np
                            where np.guardian_id = d.guardian_id), true))
         or (ch.channel = 'email' and setting_bool('channel_email')
             and coalesce((select np.email_enabled from notification_preferences np
                            where np.guardian_id = d.guardian_id), true)))
  )
  insert into notifications (child_id, guardian_id, recipient_id, channel, kind, due_date,
                             send_date, dose_count, recipient_to, scheduled_for,
                             template_key, template_version)
  select r.child_id, r.guardian_id,
         (select g.user_id from guardians g where g.id = r.guardian_id),
         r.channel, r.kind, r.due_date, current_date, r.dose_count, r.address,
         reminder_send_at(current_date),
         case r.kind when 'overdue' then 'dose_overdue' else 'dose_due_soon' end, 1
    from routed r
  on conflict (child_id, channel, kind, send_date) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.enqueue_reminders() from anon;

-- Bengali numerals are expected in user-facing text (report §8.3). The web app already does
-- this in format.ts; the dispatcher is a different runtime, so the rule lives in one place
-- both can reach. Defined before notification_payload, which calls it — a `language sql`
-- body is parsed at CREATE time, so a forward reference would fail the migration.
create or replace function public.to_bengali_digits(p_text text)
returns text language sql immutable set search_path = public as $$
  select translate(coalesce(p_text, ''), '0123456789', '০১২৩৪৫৬৭৮৯')
$$;

-- The dispatcher reads this instead of assembling a message from three queries and a string
-- literal. One round trip per row, and the Bangla lives in the database.
create or replace function public.notification_payload(p_notification_id uuid)
returns table (channel notification_channel, send_to text, subject text, body text)
language sql stable security definer set search_path = public as $$
  with n as (
    select * from notifications where id = p_notification_id
  ),
  doses as (
    select string_agg(distinct v.name_bn, ', ' order by v.name_bn) as dose_list
      from schedules s
      join vaccines v on v.id = s.vaccine_id
     where s.child_id = (select child_id from n)
       and s.status in ('pending','missed')
       and s.due_date <= (select due_date from n) + 1
  ),
  t as (
    select mt.subject, mt.body
      from message_templates mt, n
     where mt.key = n.template_key
       and mt.version = coalesce(n.template_version, 1)
       and mt.channel = n.channel
       and mt.locale = 'bn'
       and mt.is_active
  )
  select n.channel,
         n.recipient_to,
         t.subject,
         replace(
           replace(
             replace(
               replace(t.body, '{{child_name}}', coalesce(c.full_name, 'আপনার শিশু')),
               '{{due_date}}', public.to_bengali_digits(to_char(n.due_date, 'DD/MM/YYYY'))),
             '{{dose_list}}', coalesce(doses.dose_list, 'নির্ধারিত টিকা')),
           '{{newline}}', E'\n')
    from n
    join children c on c.id = n.child_id
    cross join doses
    cross join t
$$;

revoke execute on function public.notification_payload(uuid) from anon, authenticated, public;
revoke execute on function public.to_bengali_digits(text) from anon;

-- Guardians read their own delivery history; the batch key means there is now one row per
-- message actually sent rather than one per dose.
drop policy if exists notifications_select on notifications;
create policy notifications_select on notifications for select using (
  (select auth_role()) = 'admin'
  or recipient_id = (select auth.uid())
  or exists (select 1 from guardians g
              where g.id = notifications.guardian_id and g.user_id = (select auth.uid()))
);

-- ===========================================================================
-- 7. DATA QUALITY (BS-11, first cut)
-- ===========================================================================
-- Built from data that already exists, which is what makes it cheap. The entry-lag metric in
-- particular was sitting unused in the schema: vaccination_records already stores both
-- administered_date and created_at.
create or replace view v_data_quality
with (security_invoker = true) as
select l.path::text                                   as location_path,
       l.name_bn                                      as location_name,
       count(distinct c.id)                           as children,
       count(distinct c.id) filter (where c.status = 'active')        as active_children,
       count(distinct c.id) filter (where c.merged_into_id is not null) as merged_children,
       count(distinct g.id) filter (where g.phone = '+000000000000')  as guardians_without_phone,
       count(distinct g.id) filter (where g.user_id is null)          as guardians_unclaimed,
       count(distinct c.id) filter (where c.birth_registration_no is null) as children_without_brn,
       -- Median hours between the dose being given and it being entered. A free metric that
       -- reads as sophisticated and is the standard timeliness indicator.
       percentile_cont(0.5) within group (
         order by extract(epoch from r.created_at - r.administered_date::timestamptz) / 3600
       ) filter (where r.id is not null)               as median_entry_lag_hours,
       count(r.id) filter (where r.facility_id is null and r.voided_at is null)
                                                       as doses_without_facility
  from locations l
  join children  c on c.location_path <@ l.path and c.deleted_at is null
  join guardians g on g.id = c.guardian_id
  left join vaccination_records r on r.child_id = c.id and r.voided_at is null
 group by l.path, l.name_bn;

comment on view public.v_data_quality is
  'BS-11. Verification is part of the information system, not an afterthought — WHO data '
  'quality guidance. Every column here is computed from data the schema already held.';
