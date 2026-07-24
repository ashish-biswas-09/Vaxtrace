-- TODO 2.18/2.19: admin-only write policies. Proves that catalog and role-assignment
-- writes are refused for non-admins, inventory writes are refused for parents (worker+admin
-- only per §8.5/§9.3), and an admin write succeeds. Run: supabase test db.
begin;
select plan(4);

-- Fixtures as postgres (bypasses RLS). One user per role + a vaccine for the inventory test.
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'worker@example.com'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'parent@example.com');

insert into profiles (id, full_name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Worker'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Parent');

insert into user_roles (user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'worker'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'parent');

insert into vaccines (id, code, name_bn, name_en, total_doses) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'FIX', 'ফিক্স', 'Fixture', 1);

set local role authenticated;

-- 1. Worker cannot create a vaccine (catalog is admin-only for writes).
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","user_role":"worker"}';
select throws_ok(
  $$ insert into vaccines (code, name_bn, name_en, total_doses) values ('WKR', 'ও', 'W', 1) $$,
  '42501', null, 'a worker cannot create a vaccine'
);

-- 2. Worker cannot grant a role (user_roles is admin-only).
select throws_ok(
  $$ insert into user_roles (user_id, role)
     values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'admin') $$,
  '42501', null, 'a worker cannot assign a role'
);

-- 3. Parent cannot write inventory (worker/admin only).
set local request.jwt.claims = '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated","user_role":"parent"}';
select throws_ok(
  $$ insert into inventories (vaccine_id, batch_number, stock_quantity, expiry_date)
     values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'B1', 10, current_date + 30) $$,
  '42501', null, 'a parent cannot write inventory'
);

-- 4. Admin can create a vaccine (positive control).
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","user_role":"admin"}';
select lives_ok(
  $$ insert into vaccines (code, name_bn, name_en, total_doses) values ('ADM', 'অ', 'A', 1) $$,
  'an admin can create a vaccine'
);

select * from finish();
rollback;
