-- P0: no client could register a child.
--
-- `children.child_id` carried `default public.next_child_id()`, and 20260725100000 revoked
-- EXECUTE on that function from `authenticated` in the same migration that added the default.
-- A column default is evaluated as the INSERTING role, before any BEFORE trigger runs, so
-- every insert from the application died with
--
--     42501: permission denied for function next_child_id
--
-- and the server action reported the generic "নিবন্ধন ব্যর্থ হয়েছে". The seed never caught it
-- because the seed runs as the table owner, for whom the default resolves fine.
--
-- The same hole sat behind `trg_child_id_guard`: it is the thing that is supposed to mint the
-- id ("always server-generated; any client value is discarded"), but it was not SECURITY
-- DEFINER, so its own call to next_child_id() would have been refused for exactly the same
-- reason had the default not failed first.
--
-- The fix is the idiom this schema already uses for `user_roles.staff_code`, stated in that
-- column's own comment: the guard is a definer function that mints the value, and the column
-- default is a SENTINEL that VIOLATES the format check. Nothing is granted to clients, and if
-- the guard is ever dropped or bypassed the insert fails loudly instead of storing a bad id.

create or replace function public.trg_child_id_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.child_id := next_child_id();   -- always server-generated; any client value is discarded
  elsif new.child_id is distinct from old.child_id then
    raise exception 'child_id is immutable (child %)', old.id
      using errcode = 'restrict_violation';
  end if;
  return new;
end $$;

revoke execute on function public.trg_child_id_guard() from anon, authenticated, public;

-- 'UNSET' fails children_child_id_format ('^[0-9]{10}$'), so the default can never be the value
-- that lands in the table — it exists only so callers, and the generated TypeScript Insert
-- type, may omit the column.
alter table children alter column child_id set default 'UNSET';

comment on column children.child_id is
  'Immutable 10-digit Child ID: 9 sequence digits + Luhn check digit. Minted by child_id_guard, '
  'which is SECURITY DEFINER because next_child_id() is granted to nobody. The column default '
  'is the sentinel ''UNSET'', which violates children_child_id_format — if the guard is ever '
  'bypassed the insert fails rather than storing an invalid identifier.';

-- The staff-code guard has the identical shape and the identical latent failure: its default is
-- already a fail-closed sentinel, but the guard itself could not call next_staff_code().
create or replace function public.trg_staff_code_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.staff_code := next_staff_code(new.role);
  elsif new.staff_code is distinct from old.staff_code then
    raise exception 'staff_code is immutable (user %)', old.user_id
      using errcode = 'restrict_violation';
  end if;
  return new;
end $$;

revoke execute on function public.trg_staff_code_guard() from anon, authenticated, public;
