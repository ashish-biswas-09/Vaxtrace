-- Account management + clinical completeness.
--
-- Two gaps closed here:
--   1. A user could not maintain their own account (no address, no profile picture,
--      no way to see what they had done).
--   2. A dose record could not carry the remark / adverse-event information a
--      vaccination history is supposed to show.

-- ---------------------------------------------------------------------------
-- PROFILES: address + avatar. `contact` stays the single primary-contact field
-- (phone or email, per its original comment) — a second `phone` column next to it
-- would just be drift. Email and password live in auth.users, edited via the Auth API.
-- ---------------------------------------------------------------------------
alter table profiles
  add column address     text check (address is null or length(address) between 1 and 300),
  add column avatar_path text check (avatar_path is null or length(avatar_path) <= 300);

-- `updated_at` existed but nothing ever moved it, so "last updated" was always the
-- creation time. One trigger fixes every write path.
create or replace function public.trg_touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch_updated_at before update on profiles
  for each row execute function public.trg_touch_updated_at();

revoke execute on function public.trg_touch_updated_at() from anon, authenticated, public;

-- A user may edit their own profile, but not their identity or timestamps. Column-level
-- grants are the enforcement; the RLS policy only decides *which rows*.
revoke update on public.profiles from authenticated;
grant update (full_name, contact, address, avatar_path, locale) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- VACCINATION RECORDS: remarks and adverse events (AEFI).
-- ---------------------------------------------------------------------------
alter table vaccination_records
  add column notes         text check (notes is null or length(notes) between 1 and 500),
  add column adverse_event text check (adverse_event is null or length(adverse_event) between 1 and 500);

-- Partial index: "show me the adverse events, newest first" is the only query that
-- ever scans on this, and it is rare enough that a full index would be dead weight.
create index on vaccination_records (administered_date desc) where adverse_event is not null;

-- An adverse event is usually reported *after* the dose, so the record must be amendable —
-- but only in those two fields. Everything clinical (child, vaccine, dose, date, who gave it)
-- stays append-only, which is what makes the history trustworthy.
create policy vr_update on vaccination_records for update
  using (auth_role() in ('worker','admin'))
  with check (auth_role() in ('worker','admin'));

revoke update on public.vaccination_records from authenticated;
grant update (notes, adverse_event) on public.vaccination_records to authenticated;

-- ---------------------------------------------------------------------------
-- AUDIT: close the coverage holes. Child registration, profile edits and dose
-- amendments were untracked; the trail has to be complete to be evidence.
-- ---------------------------------------------------------------------------
create trigger children_audit after insert or update or delete on children
  for each row execute function trg_admin_audit();
create trigger profiles_audit after update on profiles
  for each row execute function trg_admin_audit();
create trigger vaccination_records_update_audit after update on vaccination_records
  for each row execute function trg_admin_audit();

-- Every user can read the entries they themselves caused ("account activity").
-- Admin-only read of the *whole* log is unchanged (audit_log_select).
create policy audit_log_self_select on audit_log for select using (
  actor_id = auth.uid()
);

-- ---------------------------------------------------------------------------
-- AVATARS: private bucket, one folder per user id, served through short-lived
-- signed URLs. Private rather than public because the object path is the only thing
-- standing between a stranger and a health worker's photograph.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy avatars_own_object on storage.objects for all to authenticated
  using      (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- HARDENING: `trg_admin_audit()` (added in 20260724130000) was reachable as
-- /rest/v1/rpc/trg_admin_audit by anon and authenticated. It is a trigger function —
-- it fires as the table owner, and no client role has any reason to call it.
-- 20260724115300_harden.sql applied this rule to the trigger functions that existed
-- then; this one was added afterwards and missed it.
-- ---------------------------------------------------------------------------
revoke execute on function public.trg_admin_audit() from anon, authenticated, public;

-- Deliberately NOT added here: an `admin_cron_jobs()` SECURITY DEFINER function to list the
-- pg_cron schedule on the settings screen. It was built, then removed — a definer function
-- reachable over the public REST API is not worth two informational cards, even with an
-- internal admin check. If the schedule needs to be shown in-product later, read it with the
-- service role from server code rather than exposing an RPC every signed-in user can invoke.
