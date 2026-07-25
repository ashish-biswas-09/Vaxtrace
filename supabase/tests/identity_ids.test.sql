-- The unique-identifier guarantees (10-digit Child ID, per-role staff code). These are
-- the invariants everything else — reporting, tracking, auditing — is allowed to assume,
-- so they get asserted rather than trusted.
-- Run: supabase test db  (requires local `supabase start`)
begin;
select plan(9);

-- ---------------------------------------------------------------------------
-- Luhn: the reason the ID is 10 digits and not 9.
-- ---------------------------------------------------------------------------
select is(public.luhn_check_digit('100000000'), 8, 'known-answer Luhn check digit');
select throws_ok(
  $$ select public.luhn_check_digit('12a') $$,
  null,
  null,
  'luhn_check_digit rejects non-numeric input'
);

-- ---------------------------------------------------------------------------
-- Child ID
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'guardian@example.com');
insert into profiles (id, full_name) values
  ('44444444-4444-4444-4444-444444444444', 'Guardian');

-- A client-supplied child_id must be discarded, not honoured.
insert into children (id, full_name, date_of_birth, gender, guardian_id, child_id) values
  ('55555555-5555-5555-5555-555555555555', 'Child One', current_date - 30, 'other',
   '44444444-4444-4444-4444-444444444444', '0000000000');

select isnt(
  (select child_id from children where id = '55555555-5555-5555-5555-555555555555'),
  '0000000000',
  'a client-supplied child_id is overwritten by the server'
);

select matches(
  (select child_id from children where id = '55555555-5555-5555-5555-555555555555'),
  '^[0-9]{10}$',
  'child_id is exactly 10 digits'
);

select is(
  (select substr(child_id, 10, 1)::int from children where id = '55555555-5555-5555-5555-555555555555'),
  (select public.luhn_check_digit(substr(child_id, 1, 9)) from children where id = '55555555-5555-5555-5555-555555555555'),
  'the 10th digit is a valid Luhn check digit over the first 9'
);

select throws_ok(
  $$ update children set child_id = '9999999999'
      where id = '55555555-5555-5555-5555-555555555555' $$,
  null,
  null,
  'child_id cannot be changed once assigned'
);

-- Uniqueness is by construction: two inserts can never collide.
insert into children (id, full_name, date_of_birth, gender, guardian_id) values
  ('66666666-6666-6666-6666-666666666666', 'Child Two', current_date - 30, 'other',
   '44444444-4444-4444-4444-444444444444');

select isnt(
  (select child_id from children where id = '55555555-5555-5555-5555-555555555555'),
  (select child_id from children where id = '66666666-6666-6666-6666-666666666666'),
  'two children never share a Child ID'
);

-- ---------------------------------------------------------------------------
-- Worker / Admin ID
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('77777777-7777-7777-7777-777777777777', 'staff@example.com');
insert into profiles (id, full_name) values
  ('77777777-7777-7777-7777-777777777777', 'Staff');
insert into user_roles (user_id, role) values
  ('77777777-7777-7777-7777-777777777777', 'worker');

select matches(
  (select staff_code from user_roles
    where user_id = '77777777-7777-7777-7777-777777777777' and role = 'worker'),
  '^WKR-[0-9]{6}$',
  'a worker grant mints a WKR- staff code'
);

select throws_ok(
  $$ update user_roles set staff_code = 'WKR-999999'
      where user_id = '77777777-7777-7777-7777-777777777777' $$,
  null,
  null,
  'staff_code cannot be changed once assigned'
);

select * from finish();
rollback;
