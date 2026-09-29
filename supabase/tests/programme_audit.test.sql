-- The gate for 20260929100000_programme_audit_fixes (docs/karmasuchi-audit.md S-5, S-6, S-7,
-- P2-15).
--
-- Run: supabase test db   (requires local `supabase start`)
begin;
select plan(11);

-- ---------------------------------------------------------------------------
-- Fixtures, inserted as postgres so RLS does not interfere with setup.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('dddddddd-0000-0000-0000-000000000001', 'supervisor-k@example.com'),
  ('dddddddd-0000-0000-0000-000000000002', 'worker-k@example.com'),
  ('dddddddd-0000-0000-0000-000000000003', 'worker-s@example.com');

insert into profiles (id, full_name) values
  ('dddddddd-0000-0000-0000-000000000001', 'Supervisor Kaliakair'),
  ('dddddddd-0000-0000-0000-000000000002', 'Worker Kaliakair'),
  ('dddddddd-0000-0000-0000-000000000003', 'Worker Sreepur');

insert into user_roles (user_id, role) values
  ('dddddddd-0000-0000-0000-000000000001', 'worker'),
  ('dddddddd-0000-0000-0000-000000000002', 'worker'),
  ('dddddddd-0000-0000-0000-000000000003', 'worker');

insert into facilities (id, name_bn, name_en, type, location_id)
values ('dddddddd-1111-0000-0000-000000000001', 'পরীক্ষা কেন্দ্র', 'Test Facility',
        'community_clinic', (select id from locations where path = 'bd.dhaka.gazipur.kaliakair'));

insert into user_assignments (user_id, role, location_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'supervisor',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair')),
  ('dddddddd-0000-0000-0000-000000000002', 'field_worker',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak')),
  ('dddddddd-0000-0000-0000-000000000003', 'field_worker',
   (select id from locations where path = 'bd.dhaka.gazipur.sreepur'));

insert into guardians (id, full_name, phone, location_id, created_by)
values ('dddddddd-4444-0000-0000-000000000001', 'Test Guardian', '+8801700000009',
        (select id from locations where path = 'bd.dhaka.gazipur.kaliakair'),
        'dddddddd-0000-0000-0000-000000000001');

insert into children (id, full_name, date_of_birth, gender, guardian_id, created_by, location_id)
values ('dddddddd-5555-0000-0000-000000000001', 'Test Child', current_date - 400, 'female',
        'dddddddd-4444-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001',
        (select id from locations where path = 'bd.dhaka.gazipur.kaliakair'));

-- ---------------------------------------------------------------------------
-- S-7 — sessions only move forward
-- ---------------------------------------------------------------------------
insert into sessions (id, facility_id, location_id, session_date)
values ('dddddddd-6666-0000-0000-000000000001', 'dddddddd-1111-0000-0000-000000000001',
        (select id from locations where path = 'bd.dhaka.gazipur.kaliakair'), current_date);

select lives_ok(
  $$update sessions set status = 'held' where id = 'dddddddd-6666-0000-0000-000000000001'$$,
  'planned → held is allowed'
);
select throws_ok(
  $$update sessions set status = 'cancelled', cancel_reason = 'late'
     where id = 'dddddddd-6666-0000-0000-000000000001'$$,
  '23514', null,
  'a held session cannot be cancelled afterwards'
);

-- ---------------------------------------------------------------------------
-- AEFI — forward-only status, one investigator, reasoned downgrades
-- ---------------------------------------------------------------------------
insert into aefi_cases (id, child_id, onset_date, symptoms, reported_by, severity)
values ('dddddddd-7777-0000-0000-000000000001', 'dddddddd-5555-0000-0000-000000000001',
        current_date, 'high fever', 'dddddddd-0000-0000-0000-000000000002', 'serious');

select lives_ok(
  $$update aefi_cases set status = 'under_investigation',
                          investigated_by = 'dddddddd-0000-0000-0000-000000000001'
     where id = 'dddddddd-7777-0000-0000-000000000001'$$,
  'reported → under_investigation is allowed'
);
update aefi_cases set investigated_by = 'dddddddd-0000-0000-0000-000000000003'
 where id = 'dddddddd-7777-0000-0000-000000000001';
select is(
  (select investigated_by from aefi_cases where id = 'dddddddd-7777-0000-0000-000000000001'),
  'dddddddd-0000-0000-0000-000000000001'::uuid,
  'the first investigator is kept when someone else saves the case'
);

select throws_ok(
  $$update aefi_cases set status = 'reported' where id = 'dddddddd-7777-0000-0000-000000000001'$$,
  '23514', null,
  'status cannot move backwards'
);

select throws_ok(
  $$update aefi_cases set severity = 'minor' where id = 'dddddddd-7777-0000-0000-000000000001'$$,
  '23514', null,
  'a severity downgrade without a reason is refused'
);
select lives_ok(
  $$update aefi_cases set severity = 'severe', severity_change_reason = 'hospital record: outpatient only'
     where id = 'dddddddd-7777-0000-0000-000000000001'$$,
  'a severity downgrade with a reason is allowed'
);

update aefi_cases set status = 'closed', causality = 'coincidental'
 where id = 'dddddddd-7777-0000-0000-000000000001';
select lives_ok(
  $$update aefi_cases set status = 'under_investigation' where id = 'dddddddd-7777-0000-0000-000000000001'$$,
  'a closed case can be re-opened for investigation'
);
select is(
  (select closed_at from aefi_cases where id = 'dddddddd-7777-0000-0000-000000000001'),
  null,
  're-opening clears closed_at, so aefi_closed_complete holds'
);

-- ---------------------------------------------------------------------------
-- P2-15 — session_staff() is scoped to the caller and the facility's area
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated","user_role":"worker","app_role":"supervisor","user_status":"active"}';

select ok(
  exists (select 1 from session_staff('dddddddd-1111-0000-0000-000000000001')
           where id = 'dddddddd-0000-0000-0000-000000000002'),
  'a supervisor sees a field worker posted inside the facility''s upazila'
);
select ok(
  not exists (select 1 from session_staff('dddddddd-1111-0000-0000-000000000001')
               where id = 'dddddddd-0000-0000-0000-000000000003'),
  'staff posted to another upazila are not offered'
);

select * from finish();
rollback;
