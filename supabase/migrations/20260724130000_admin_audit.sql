-- Admin write auditing (TODO 2.15): every admin mutation to inventory, the vaccine
-- catalog, or role assignments appends to audit_log. Done in the database (not app code)
-- for the same reason as trg_record_after_insert in 20260724115000_domain_logic.sql:
-- audit_log has no client insert policy, and a DB trigger audits every code path that
-- touches the table, not just the one server action that remembered to log.
--
-- security definer: the insert into audit_log must succeed regardless of the invoking
-- role's RLS grants. auth.uid() inside a definer function still resolves to the *caller*
-- (it reads the JWT), so the actor is recorded correctly.

create or replace function trg_admin_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_before jsonb;
  v_after  jsonb;
  v_id     uuid;
begin
  if tg_op = 'DELETE' then
    v_before := to_jsonb(old);
  elsif tg_op = 'INSERT' then
    v_after := to_jsonb(new);
  else
    v_before := to_jsonb(old);
    v_after  := to_jsonb(new);
  end if;

  -- entity_id is a single uuid column; user_roles keys on user_id, catalog rows on id.
  -- Composite-key tables (vaccine_doses) leave it null — the before/after jsonb still
  -- carries the full row.
  begin
    v_id := coalesce(
      (v_after->>'id')::uuid,      (v_before->>'id')::uuid,
      (v_after->>'user_id')::uuid, (v_before->>'user_id')::uuid
    );
  exception when others then
    v_id := null;
  end;

  insert into audit_log(actor_id, action, entity, entity_id, before, after)
  values (auth.uid(), tg_table_name || '.' || lower(tg_op), tg_table_name, v_id, v_before, v_after);

  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

create trigger inventories_audit   after insert or update or delete on inventories
  for each row execute function trg_admin_audit();
create trigger vaccines_audit      after insert or update or delete on vaccines
  for each row execute function trg_admin_audit();
create trigger vaccine_doses_audit after insert or update or delete on vaccine_doses
  for each row execute function trg_admin_audit();
create trigger user_roles_audit    after insert or update or delete on user_roles
  for each row execute function trg_admin_audit();
