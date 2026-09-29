-- কর্মসূচি audit fixes (docs/karmasuchi-audit.md): K-09, S-5, S-6, S-7, P2-15.

-- ===========================================================================
-- 1. K-09 — one registry-coverage definition
-- ===========================================================================
-- Reports read v_coverage, the Coverage screen reads coverage_by_area(). The latter counts
-- only children whose lifecycle status is 'active'; this view also counted children who had
-- moved out, died or refused, so Penta read 74% on one screen and 73% on the other.
create or replace view v_coverage
with (security_invoker = true) as
select v.code, v.name_en, v.name_bn,
       count(*) filter (where s.status = 'done')::numeric
         / nullif(count(*) filter (where s.due_date <= current_date), 0) as coverage_rate,
       count(*) filter (where s.status = 'done')          as done_count,
       count(*) filter (where s.due_date <= current_date) as due_count
  from schedules s
  join vaccines v on v.id = s.vaccine_id
  join children c on c.id = s.child_id and c.deleted_at is null and c.status = 'active'
 where s.source = 'routine'
 group by v.code, v.name_en, v.name_bn;

-- ===========================================================================
-- 2. S-7 — session status only moves forward
-- ===========================================================================
-- planned → held (the dose trigger) or planned → cancelled (with a reason). A held session has
-- doses attached, so cancelling it afterwards would contradict its own tally.
create or replace function public.trg_session_transition() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status and old.status <> 'planned' then
    raise exception 'Session % cannot move from % to %', old.code, old.status, new.status
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger sessions_transition before update of status on sessions
  for each row execute function public.trg_session_transition();

revoke execute on function public.trg_session_transition() from anon, authenticated, public;

-- ===========================================================================
-- 3. AEFI — forward-only status, one investigator, reasoned downgrades (S-5, S-6, S-7)
-- ===========================================================================
alter table aefi_cases
  add column severity_change_reason text
    check (severity_change_reason is null or length(severity_change_reason) between 3 and 300);

-- Named to run after aefi_cases_stamp (triggers of one event fire in name order), so a re-open
-- can clear the closed_at that the stamp trigger would otherwise leave behind.
create or replace function public.trg_aefi_transition() returns trigger
language plpgsql set search_path = public as $$
declare
  rank_old int := array_position(array['reported','under_investigation','classified','closed'], old.status::text);
  rank_new int := array_position(array['reported','under_investigation','classified','closed'], new.status::text);
begin
  -- The one backward move allowed: re-opening a closed case for further investigation.
  if old.status = 'closed' and new.status = 'under_investigation' then
    new.closed_at := null;
  elsif rank_new < rank_old then
    raise exception 'AEFI case % cannot move from % to %', old.code, old.status, new.status
      using errcode = 'check_violation';
  end if;

  -- The investigator is whoever first took the case, not whoever saved it last. Later edits
  -- are in the audit trail.
  new.investigated_by := coalesce(old.investigated_by, new.investigated_by);

  -- Downgrading severity clears the 48-hour overdue flag, so it has to say why.
  if new.severity < old.severity
     and new.severity_change_reason is not distinct from old.severity_change_reason then
    raise exception 'Lowering the severity of % requires a reason', old.code
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger aefi_cases_transition before update on aefi_cases
  for each row execute function public.trg_aefi_transition();

revoke execute on function public.trg_aefi_transition() from anon, authenticated, public;

-- ===========================================================================
-- 4. P2-15 — who can lead a session at this facility
-- ===========================================================================
-- profiles_select lets a supervisor read only their own profile, so the team-lead picker could
-- not show names to the role that plans sessions. This returns id + name only, only for staff
-- posted at, above or below the facility, and only inside the caller's own scope.
create or replace function public.session_staff(p_facility uuid)
returns table (id uuid, full_name text)
language sql stable security definer set search_path = public as $$
  select distinct p.id, p.full_name
    from facilities f
    join locations fl on fl.id = f.location_id
    join user_assignments ua on ua.role in ('field_worker', 'supervisor')
                            and ua.valid_from <= current_date
                            and (ua.valid_to is null or ua.valid_to >= current_date)
    left join facilities uf on uf.id = ua.facility_id
    join locations al on al.id = coalesce(ua.location_id, uf.location_id)
    join profiles p on p.id = ua.user_id
   where f.id = p_facility
     and public.auth_has_role(array['supervisor', 'programme_manager', 'system_admin']::app_role[])
     and fl.path <@ any (public.auth_scopes())
     and (ua.facility_id = p_facility or al.path <@ fl.path or fl.path <@ al.path)
   order by p.full_name
$$;

revoke execute on function public.session_staff(uuid) from anon, public;
grant  execute on function public.session_staff(uuid) to authenticated;
