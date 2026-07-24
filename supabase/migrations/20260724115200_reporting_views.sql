-- VaxTrace reporting read-model: views/materialized views, never touching OLTP write paths.
-- Source: VaxTrace_Engineering_Handbook.md §8.6 (verbatim).

-- security_invoker: without this, Postgres evaluates RLS on the underlying tables using
-- the VIEW OWNER's role (whoever ran this migration), not the querying user — silently
-- bypassing RLS for every caller. See §8.5 "RLS is the security spine."
-- Coverage: % of due-or-past doses that are done, per vaccine.
create view v_coverage
with (security_invoker = true) as
select v.code, v.name_en, v.name_bn,
       count(*) filter (where s.status = 'done')::numeric
         / nullif(count(*) filter (where s.due_date <= current_date), 0) as coverage_rate
  from schedules s join vaccines v on v.id = s.vaccine_id
 group by v.code, v.name_en, v.name_bn;

-- Dropout: children who got dose 1 of a vaccine but not the last dose.
create view v_dropout
with (security_invoker = true) as
select v.code,
       count(distinct r1.child_id) filter (where r1.dose_number = 1)                as started,
       count(distinct rl.child_id) filter (where rl.dose_number = v.total_doses)    as completed
  from vaccines v
  left join vaccination_records r1 on r1.vaccine_id = v.id
  left join vaccination_records rl on rl.vaccine_id = v.id
 group by v.code, v.total_doses;

-- Heavy aggregate → materialized view, refreshed nightly by pg_cron (manual refresh ok for demo).
-- Materialized views cannot carry RLS or security_invoker — this one is only ever queried
-- from admin-gated application code (D4 report screen), never exposed to parent/worker routes.
create materialized view mv_daily_doses as
select administered_date, count(*) as doses
  from vaccination_records group by administered_date;

select cron.schedule('refresh-doses', '30 1 * * *', $$refresh materialized view mv_daily_doses$$);
