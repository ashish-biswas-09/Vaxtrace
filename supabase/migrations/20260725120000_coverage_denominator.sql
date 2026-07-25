-- UI/UX finding: the coverage chart showed a percentage with no denominator.
--
-- "১০০%" against one child who has had one dose and "১০০%" against four thousand children
-- render identically, and a programme officer reading the second as the first (or the first
-- as the second) is exactly the misreading a coverage dashboard exists to prevent. A rate
-- without its N is not a statistic, it is a decoration.
--
-- Columns are appended, so every existing consumer (dashboard, reports, CSV export) keeps
-- working untouched and can opt into the counts.
create or replace view v_coverage
with (security_invoker = true) as
select v.code, v.name_en, v.name_bn,
       count(*) filter (where s.status = 'done')::numeric
         / nullif(count(*) filter (where s.due_date <= current_date), 0) as coverage_rate,
       count(*) filter (where s.status = 'done')            as done_count,
       count(*) filter (where s.due_date <= current_date)   as due_count
  from schedules s join vaccines v on v.id = s.vaccine_id
 group by v.code, v.name_en, v.name_bn;
