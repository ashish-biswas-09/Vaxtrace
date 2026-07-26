-- The gate for the scoped-authorization migration (report §11.7 step 3, SEC-01, NFR-10).
--
-- Before 20260726110000, `auth_role() = 'admin'` granted every administrator read access to
-- every child in the country. The claim this migration makes is that a manager posted to one
-- upazila cannot read a child in another. A claim like that is worth exactly as much as the
-- test that proves it, so the negative case is asserted first and hardest.
--
-- Run: supabase test db   (requires local `supabase start`)
begin;
select plan(9);

-- ---------------------------------------------------------------------------
-- Fixtures, inserted as postgres so RLS does not interfere with setup.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'manager-a@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'manager-b@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'worker-a@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'national@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'guardian@example.com');

insert into profiles (id, full_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Manager Kaliakair'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Manager Sreepur'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Worker Kaliakair'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'National Manager'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Guardian');

insert into user_roles (user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'admin'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'worker'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'admin'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'parent');

-- The migration seeds the real hierarchy, so the two upazilas already exist and this test
-- does not have to invent geography that production would not have.
insert into user_assignments (user_id, role, location_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'programme_manager',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair')),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'programme_manager',
   (select id from locations where path = 'bd.dhaka.gazipur.sreepur')),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'field_worker',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak')),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'programme_manager',
   (select id from locations where path = 'bd'));

-- One child in each upazila. location_id is supplied explicitly here rather than left to
-- trg_child_location, because the point of the test is where the children are.
insert into children (id, full_name, date_of_birth, gender, guardian_id, created_by, location_id) values
  ('cccccccc-0000-0000-0000-00000000000a', 'Child Kaliakair', current_date - interval '6 months',
   'female', 'aaaaaaaa-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000003',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak.ward_1')),
  ('cccccccc-0000-0000-0000-00000000000b', 'Child Sreepur', current_date - interval '6 months',
   'male', 'aaaaaaaa-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000003',
   (select id from locations where path = 'bd.dhaka.gazipur.sreepur'));

-- The trigger must have denormalised the ltree path, or every scope test below is vacuous.
select isnt(
  (select location_path::text from children where id = 'cccccccc-0000-0000-0000-00000000000a'),
  null,
  'trg_child_location stamps location_path on insert'
);

-- ---------------------------------------------------------------------------
-- THE TEST THE MIGRATION EXISTS FOR
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","user_role":"admin","app_role":"programme_manager","user_status":"active"}';

select is(
  (select count(*)::int from children where id = 'cccccccc-0000-0000-0000-00000000000b'),
  0,
  'a programme_manager @ upazila Kaliakair CANNOT read a child in upazila Sreepur'
);

select is(
  (select count(*)::int from children where id = 'cccccccc-0000-0000-0000-00000000000a'),
  1,
  'the same manager CAN read a child in their own upazila'
);

-- Scope has to hold on the derived tables too, or the child is merely hidden behind a table
-- whose schedule rows still leak the same person.
select is(
  (select count(*)::int from schedules where child_id = 'cccccccc-0000-0000-0000-00000000000b'),
  0,
  'schedules of an out-of-scope child are not readable either'
);

-- ---------------------------------------------------------------------------
-- A worker posted to a ward sees their ward, not the whole upazila's district
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated","user_role":"worker","app_role":"field_worker","user_status":"active"}';

select is(
  (select count(*)::int from children where id = 'cccccccc-0000-0000-0000-00000000000a'),
  1,
  'a field_worker @ union Mouchak reads a child in a ward below it (path containment, not equality)'
);

select is(
  (select count(*)::int from children where id = 'cccccccc-0000-0000-0000-00000000000b'),
  0,
  'the same worker cannot read a child outside their union'
);

-- ---------------------------------------------------------------------------
-- Root scope still sees everything — the backfill must not have changed anyone's access
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated","user_role":"admin","app_role":"programme_manager","user_status":"active"}';

select is(
  (select count(*)::int from children where id in
     ('cccccccc-0000-0000-0000-00000000000a','cccccccc-0000-0000-0000-00000000000b')),
  2,
  'a programme_manager @ root reads both children — existing national access is preserved'
);

-- ---------------------------------------------------------------------------
-- A guardian's access is ownership, not geography: it survives having no assignment at all
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000005","role":"authenticated","user_role":"parent","app_role":"guardian","user_status":"active"}';

select is(
  (select count(*)::int from children where guardian_id = 'aaaaaaaa-0000-0000-0000-000000000005'),
  2,
  'a guardian with no assignment still reads their own children in any location'
);

-- ---------------------------------------------------------------------------
-- Break-glass: the documented, logged way across a scope boundary (FR-76, ADR-019)
-- ---------------------------------------------------------------------------
set local role postgres;
insert into break_glass_access (user_id, child_id, reason) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-00000000000b',
   'Child presented at a Kaliakair outreach session while visiting family.');

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","user_role":"admin","app_role":"programme_manager","user_status":"active"}';

select is(
  (select count(*)::int from children where id = 'cccccccc-0000-0000-0000-00000000000b'),
  1,
  'break-glass grants the out-of-scope read that was denied above'
);

select * from finish();
rollback;
