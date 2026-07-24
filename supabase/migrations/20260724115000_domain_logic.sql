-- VaxTrace domain logic: schedule generation, dose reconciliation, missed-dose sweep.
-- Source: VaxTrace_Engineering_Handbook.md §8.4 (verbatim).

create or replace function generate_schedule(p_child_id uuid)
returns void language sql as $$
  insert into schedules (child_id, vaccine_id, dose_number, due_date)
  select c.id, vd.vaccine_id, vd.dose_number,
         c.date_of_birth + (vd.recommended_age_days || ' days')::interval
    from children c
    join vaccine_doses vd on true
    join vaccines v on v.id = vd.vaccine_id and v.is_active
   where c.id = p_child_id
  on conflict (child_id, vaccine_id, dose_number) do nothing;
$$;

-- security definer: `schedules` has no insert policy for parent/worker roles
-- (system-generated, deny-by-default per §8.5) — this trigger's write must run
-- as the table owner regardless of who inserted the child, or registration fails.
create or replace function trg_child_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform generate_schedule(new.id);
  return new;
end $$;

create trigger child_after_insert
  after insert on children
  for each row execute function trg_child_after_insert();

-- Dose reconciliation: recording an administered dose flips the matching schedule row to
-- `done` and sets the next dose's `next_due_date`. One trigger, all callers covered.
-- security definer: same reason as trg_child_after_insert — `audit_log` has no
-- insert policy for parent/worker/admin, and the `schedules` update here must
-- succeed regardless of the invoking role's own RLS grants on those tables.
create or replace function trg_record_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_next_due date;
begin
  update schedules
     set status = 'done'
   where child_id = new.child_id
     and vaccine_id = new.vaccine_id
     and dose_number = new.dose_number;

  select s.due_date into v_next_due
    from schedules s
   where s.child_id = new.child_id
     and s.vaccine_id = new.vaccine_id
     and s.dose_number = new.dose_number + 1
     and s.status = 'pending';

  update vaccination_records set next_due_date = v_next_due where id = new.id;

  insert into audit_log(actor_id, action, entity, entity_id, after)
  values (new.administered_by, 'dose.record', 'vaccination_records', new.id, to_jsonb(new));
  return new;
end $$;

create trigger record_after_insert
  after insert on vaccination_records
  for each row execute function trg_record_after_insert();

-- Missed-dose sweep: daily pg_cron job marks overdue pending schedules `missed`.
select cron.schedule('mark-missed', '0 1 * * *', $$
  update schedules set status = 'missed'
   where status = 'pending' and due_date < current_date - interval '14 days';
$$);
