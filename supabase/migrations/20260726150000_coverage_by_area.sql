-- ===========================================================================
-- COVERAGE BY AREA, ZERO-DOSE, AND THE TIME DIMENSION
-- ===========================================================================
-- Report decision D3 (the reporting half), BS-07 and BS-10.
--
-- Round 1 built `population_estimates` — the denominator. This is the arithmetic that divides
-- by it. Until now the only coverage figure the system could produce was *registry* coverage:
-- of the children we happen to know about, what share are up to date. That number is
-- congratulatory by construction, because a catchment that registers only the easy-to-reach
-- children reports near-100% while missing exactly the families the programme exists for.
--
-- Three things land here:
--
--   1. `coverage_by_area()` — registered, target, doses, registry coverage, POPULATION
--      coverage, dropout and zero-dose for the children of any node in the hierarchy. This is
--      the query behind the one screen §16.3 says changes the defense.
--   2. `v_zero_dose` — the flagship global immunization indicator, as a list of named children
--      a worker can go and find, not as a percentage.
--   3. `mv_coverage_monthly` — the time dimension BS-10 says is missing. "Coverage" with no
--      period is a lifetime-to-date number that can only ever go up, and therefore cannot
--      show a programme getting worse.
--
-- Every rate here keeps its numerator and denominator in the same row. A rate without its N is
-- not a statistic, and this schema has said so since 20260725120000.

-- ===========================================================================
-- 1. THE ZERO-DOSE MARKER ANTIGEN
-- ===========================================================================
-- "Zero-dose" is not "no vaccine at all". WHO/IA2030 defines a zero-dose child as one who has
-- not received the first dose of a DTP-containing vaccine — in Bangladesh, Penta-1. That is a
-- fact about the *catalog*, so it belongs on the catalog rather than in a view matching on a
-- code string, which breaks silently the day someone renames a product.
alter table vaccines
  add column is_zero_dose_marker boolean not null default false;

-- At most one. Two markers would make the indicator ambiguous and the number unciteable. A
-- partial unique index on the flag itself is the idiom: among the rows where it is true, the
-- value `true` must be unique, so there can be exactly one of them.
create unique index vaccines_zero_dose_marker_key
  on vaccines (is_zero_dose_marker) where is_zero_dose_marker;

comment on column public.vaccines.is_zero_dose_marker is
  'The DTP-containing antigen whose first dose defines zero-dose status (WHO/IA2030). Exactly '
  'one row may carry it.';

-- Best-effort on existing catalogs; deliberately not fabricated if nothing matches, because a
-- zero-dose count computed against the wrong antigen is worse than one the screen reports as
-- unconfigured.
update vaccines
   set is_zero_dose_marker = true
 where id = (
   select id from vaccines
    where code ilike 'PENTA%' or code ilike 'DTP%' or code ilike 'DPT%'
    order by case when code ilike 'PENTA%' then 0 else 1 end, code
    limit 1
 );

-- ===========================================================================
-- 2. THE DENOMINATOR, ROLLED UP WITHOUT DOUBLE-COUNTING
-- ===========================================================================
-- A district's target is not "the district's row plus its upazilas' rows" — that counts the
-- same children twice whenever both levels have been entered. The rule, stated once here so
-- no report has to re-decide it:
--
--   **The finest recorded level wins.** An estimate is dropped from the roll-up if any strict
--   descendant of its location carries an estimate for the same year and age band, because the
--   finer figure is the one somebody actually collected and the coarser one is a summary of it.
--
-- What survives is a set of non-overlapping estimates, and summing them over any subtree is
-- then simply correct.
create or replace view v_population_leaf
with (security_invoker = true) as
select pe.location_id, l.path as location_path, pe.year, pe.age_band, pe.estimate, pe.source
  from population_estimates pe
  join locations l on l.id = pe.location_id
 where not exists (
   select 1
     from population_estimates finer
     join locations fl on fl.id = finer.location_id
    where finer.year     = pe.year
      and finer.age_band = pe.age_band
      and fl.path <@ l.path
      and fl.path <> l.path
 );

comment on view public.v_population_leaf is
  'Non-overlapping population estimates: where both a district and its upazilas carry a '
  'figure, the upazila figures win. Summing these over a subtree cannot double-count.';

-- ===========================================================================
-- 3. COVERAGE BY AREA
-- ===========================================================================
-- A function rather than a view, because the screen needs four filters — which node to expand,
-- which antigen, which denominator year, which dose window — and pushing them into the query
-- means a district drill-down scans a district rather than the country.
--
-- NOT security definer. It runs with the caller's rights, so every table it touches is filtered
-- by the same scoped RLS as everywhere else: a manager assigned to one upazila calling this
-- with the country root gets their upazila's numbers, not the nation's. That is the whole
-- payoff of §11.6 and it must not be given away by a definer function.
create or replace function public.coverage_by_area(
  p_parent     ltree default null,   -- expand the children of this node; null = visible roots
  p_vaccine_id uuid  default null,   -- null = every antigen combined
  p_year       int   default null,   -- denominator year; null = current
  p_from       date  default null,   -- dose window start; null = all time
  p_to         date  default null
)
returns table (
  location_id         uuid,
  location_path       ltree,
  name_bn             text,
  level               location_level,
  registered          bigint,
  target              bigint,
  doses_given         bigint,
  due_count           bigint,
  done_count          bigint,
  registry_coverage   numeric,
  population_coverage numeric,
  dose1_children      bigint,
  final_dose_children bigint,
  dropout_rate        numeric,
  zero_dose           bigint
)
language sql stable set search_path = public as $$
  with params as (
    select coalesce(p_year, extract(year from current_date)::int) as yr,
           (select v.id from vaccines v where v.is_zero_dose_marker limit 1) as marker_id,
           (select v.total_doses from vaccines v where v.id = p_vaccine_id)  as final_dose,
           -- With no node requested, start at the caller's own shallowest assignment. A
           -- national manager lands on the divisions; a manager posted to one upazila lands on
           -- its unions, not on an empty list of divisions they cannot read.
           coalesce(p_parent, (
             select l.path from locations l
              where l.valid_to is null
                and l.path = any (auth_scopes())
              order by nlevel(l.path)
              limit 1
           )) as parent
  ),
  -- The rows the table shows: the immediate children of that node — or the node itself when it
  -- has none, so drilling into a ward shows the ward rather than an empty table.
  area as (
    select l.*
      from locations l, params
     where l.valid_to is null
       and l.path ~ (params.parent::text || '.*{1}')::lquery
    union all
    select l.*
      from locations l, params
     where l.valid_to is null
       and l.path = params.parent
       and not exists (
         select 1 from locations c
          where c.valid_to is null
            and c.path ~ (params.parent::text || '.*{1}')::lquery
       )
  )
  select a.id,
         a.path,
         a.name_bn,
         a.level,
         coalesce(c.registered, 0),
         coalesce(pop.target, 0),
         coalesce(d.doses_given, 0),
         coalesce(s.due_count, 0),
         coalesce(s.done_count, 0),
         case when coalesce(s.due_count, 0) > 0
              then s.done_count::numeric / s.due_count end,
         -- Population coverage needs an antigen to be a statement about anything: "68% of the
         -- target received Penta-3" is an indicator, "68% of the target received doses" is not.
         -- With no antigen selected it is NULL, and the screen renders an em dash rather than a
         -- number nobody can define (UX-07).
         case when p_vaccine_id is not null and coalesce(pop.target, 0) > 0
              then coalesce(d.final_dose_children, 0)::numeric / pop.target end,
         coalesce(d.dose1_children, 0),
         coalesce(d.final_dose_children, 0),
         case when p_vaccine_id is not null and coalesce(d.dose1_children, 0) > 0
              then (d.dose1_children - d.final_dose_children)::numeric / d.dose1_children end,
         coalesce(z.zero_dose, 0)
    from area a
    cross join params
    left join lateral (
      select count(*) as registered
        from children ch
       where ch.location_path <@ a.path
         and ch.deleted_at is null
         and ch.status = 'active'
    ) c on true
    left join lateral (
      select sum(pl.estimate)::bigint as target
        from v_population_leaf pl
       where pl.location_path <@ a.path
         and pl.year = params.yr
         and pl.age_band = 'surviving_infants'
    ) pop on true
    left join lateral (
      select count(*)                                                        as doses_given,
             count(distinct r.child_id) filter (where r.dose_number = 1)     as dose1_children,
             count(distinct r.child_id) filter (
               where r.dose_number = params.final_dose)                      as final_dose_children
        from vaccination_records r
       where r.location_path <@ a.path
         and r.voided_at is null
         and (p_vaccine_id is null or r.vaccine_id = p_vaccine_id)
         and (p_from is null or r.administered_date >= p_from)
         and (p_to   is null or r.administered_date <= p_to)
    ) d on true
    left join lateral (
      -- Registry coverage keeps the meaning 20260726100000 gave it: of the doses this system
      -- says are due, how many are recorded as given. Campaign rows stay out, as they always
      -- have — a supplementary activity is not evidence of routine schedule adherence.
      select count(*) filter (where sc.due_date <= current_date) as due_count,
             count(*) filter (where sc.status = 'done')          as done_count
        from schedules sc
        join children ch on ch.id = sc.child_id
       where ch.location_path <@ a.path
         and ch.deleted_at is null
         and ch.status = 'active'
         and sc.source = 'routine'
         and (p_vaccine_id is null or sc.vaccine_id = p_vaccine_id)
    ) s on true
    left join lateral (
      -- The indicator form: children now aged 12–23 months who never received the marker
      -- antigen's first dose. Retrospective and therefore closed — every one of them is a
      -- child the programme did not reach before their first birthday.
      select count(*) as zero_dose
        from children ch
       where ch.location_path <@ a.path
         and ch.deleted_at is null
         and ch.status = 'active'
         and params.marker_id is not null
         and ch.date_of_birth <= current_date - interval '12 months'
         and ch.date_of_birth >  current_date - interval '24 months'
         and not exists (
           select 1 from vaccination_records r
            where r.child_id = ch.id
              and r.vaccine_id = params.marker_id
              and r.dose_number = 1
              and r.voided_at is null
         )
    ) z on true
   order by a.path
$$;

revoke execute on function public.coverage_by_area(ltree, uuid, int, date, date) from anon, public;
grant  execute on function public.coverage_by_area(ltree, uuid, int, date, date) to authenticated;

comment on function public.coverage_by_area(ltree, uuid, int, date, date) is
  'One row per child node of p_parent: registered, target, doses, registry coverage, '
  'POPULATION coverage against population_estimates, dropout and zero-dose. Invoker rights, '
  'so scoped RLS still applies (report D3, BS-07, §16.3).';

-- ===========================================================================
-- 4. ZERO-DOSE, AS A LIST OF CHILDREN
-- ===========================================================================
-- A percentage is a management number. A worker cannot visit a percentage. The operational
-- form of this indicator is a list with a name, an address and a guardian's phone on every
-- row — which is why it is a view over children rather than an aggregate.
--
-- The window is deliberately different from the indicator's: children UNDER 12 months, because
-- those are the ones who can still be reached in time. Both numbers are correct and they
-- answer different questions, so both exist and both are labelled.
create or replace view v_zero_dose
with (security_invoker = true) as
select ch.id                as child_id,
       ch.child_id          as child_code,
       ch.full_name,
       ch.date_of_birth,
       ch.gender,
       ch.location_id,
       ch.location_path,
       ch.facility_id,
       g.id                 as guardian_id,
       g.full_name          as guardian_name,
       g.phone              as guardian_phone,
       g.address,
       (current_date - ch.date_of_birth)                        as age_days,
       -- How overdue the marker dose is: the schedule row that should have been done.
       (select min(sc.due_date) from schedules sc
         where sc.child_id = ch.id
           and sc.vaccine_id = (select v.id from vaccines v where v.is_zero_dose_marker limit 1)
           and sc.dose_number = 1)                              as marker_due_date
  from children ch
  join guardians g on g.id = ch.guardian_id
 where ch.deleted_at is null
   and ch.status = 'active'
   and ch.date_of_birth > current_date - interval '12 months'
   and exists (select 1 from vaccines v where v.is_zero_dose_marker)
   and not exists (
     select 1 from vaccination_records r
      where r.child_id = ch.id
        and r.vaccine_id = (select v.id from vaccines v where v.is_zero_dose_marker limit 1)
        and r.dose_number = 1
        and r.voided_at is null
   );

comment on view public.v_zero_dose is
  'Children under 12 months with no first dose of the DTP-containing antigen — the WHO/IA2030 '
  'zero-dose indicator in its actionable form: a list somebody can visit, not a percentage.';

-- ===========================================================================
-- 5. THE TIME DIMENSION
-- ===========================================================================
-- BS-10: every reporting figure in this system was lifetime-to-date, which can only ever rise
-- and therefore cannot show a programme deteriorating. Doses by month, by area, by antigen —
-- materialized, because the screen behind it is a dashboard and the query is a full scan.
create materialized view mv_coverage_monthly as
select date_trunc('month', r.administered_date)::date as month,
       r.location_path,
       r.vaccine_id,
       r.dose_number,
       count(*)                        as doses,
       count(distinct r.child_id)      as children
  from vaccination_records r
 where r.voided_at is null
 group by 1, 2, 3, 4;

-- Unique index so the refresh can be CONCURRENT — the difference between a nightly dashboard
-- outage and none (report §12.4).
create unique index mv_coverage_monthly_key
  on mv_coverage_monthly (month, location_path, vaccine_id, dose_number);
create index mv_coverage_monthly_path_gist
  on mv_coverage_monthly using gist (location_path);

comment on materialized view public.mv_coverage_monthly is
  'Doses by month x area x antigen x dose number. A matview has no RLS, so it is NOT granted '
  'to authenticated — monthly_doses() below reads it behind a scope check.';

-- A matview does not enforce row-level security. Granting it to `authenticated` would hand
-- every signed-in user a nationwide dose count, quietly undoing the scope model. The screen
-- reaches it through this function instead, which re-applies the scope test the matview
-- cannot.
create or replace function public.monthly_doses(
  p_parent     ltree default null,
  p_vaccine_id uuid  default null,
  p_months     int   default 12
)
returns table (month date, doses bigint, children bigint)
language sql stable security definer set search_path = public as $$
  select m.month, sum(m.doses)::bigint, sum(m.children)::bigint
    from mv_coverage_monthly m
   where m.month >= date_trunc('month', current_date)::date
                    - (greatest(p_months, 1) - 1) * interval '1 month'
     and (p_vaccine_id is null or m.vaccine_id = p_vaccine_id)
     -- Both halves are required: inside the requested node AND inside the caller's own scope.
     -- The second is what a definer function would otherwise lose.
     and (p_parent is null or m.location_path <@ p_parent)
     and m.location_path <@ any (public.auth_scopes())
   group by m.month
   order by m.month
$$;

revoke execute on function public.monthly_doses(ltree, uuid, int) from anon, public;
grant  execute on function public.monthly_doses(ltree, uuid, int) to authenticated;

insert into job_runs (job_name, expected_interval)
values ('refresh-coverage-monthly', interval '1 day')
on conflict (job_name) do nothing;

create or replace function public.job_refresh_coverage_monthly() returns void
language plpgsql security definer set search_path = public as $$
declare v_started timestamptz := public.job_begin('refresh-coverage-monthly');
begin
  refresh materialized view concurrently mv_coverage_monthly;
  perform public.job_end('refresh-coverage-monthly', v_started, 'refreshed');
exception when others then
  perform public.job_end('refresh-coverage-monthly', v_started, null, sqlerrm);
  raise;
end $$;

revoke execute on function public.job_refresh_coverage_monthly() from anon, authenticated, public;

select cron.schedule('refresh-coverage-monthly', '0 2 * * *',
                     $cron$select public.job_refresh_coverage_monthly()$cron$);

-- ===========================================================================
-- 6. GRANTS
-- ===========================================================================
grant select on public.v_population_leaf, public.v_zero_dose to authenticated;
