-- VaxTrace demo seed: vaccine catalog + a coherent synthetic story (TODO 0.5, 3.2).
-- Demo login credentials for every seeded account: password "VaxTrace@2026" (see docs/DEMO.md).
-- Safe to re-run against a fresh database only (no ON CONFLICT guards — seed.sql is meant
-- to run once against a just-migrated project, per `supabase db reset`).

-- ============================================================================
-- DEMO ACCOUNTS (admin + worker only — parent accounts exist for FK completeness;
-- parent login uses phone+OTP per §7.0a and isn't part of the Aug 3 demo scope).
-- ============================================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'admin@vaxtrace.bd', crypt('VaxTrace@2026', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'worker@vaxtrace.bd', crypt('VaxTrace@2026', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000011',
   'authenticated', 'authenticated', 'parent.a@vaxtrace.bd', crypt('VaxTrace@2026', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000012',
   'authenticated', 'authenticated', 'parent.b@vaxtrace.bd', crypt('VaxTrace@2026', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000013',
   'authenticated', 'authenticated', 'parent.c@vaxtrace.bd', crypt('VaxTrace@2026', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000014',
   'authenticated', 'authenticated', 'parent.d@vaxtrace.bd', crypt('VaxTrace@2026', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
  from auth.users u
 where u.id in (
   'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000012',
   'a0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000014'
 );

insert into profiles (id, full_name, contact, locale) values
  ('a0000000-0000-0000-0000-000000000001', 'অ্যাডমিন সালমা রহমান', 'admin@vaxtrace.bd', 'bn'),
  ('a0000000-0000-0000-0000-000000000002', 'স্বাস্থ্যকর্মী নাসরিন আক্তার', 'worker@vaxtrace.bd', 'bn'),
  ('a0000000-0000-0000-0000-000000000011', 'রোকসানা বেগম', '+8801710000011', 'bn'),
  ('a0000000-0000-0000-0000-000000000012', 'কামাল হোসেন', '+8801710000012', 'bn'),
  ('a0000000-0000-0000-0000-000000000013', 'সালমা খাতুন', '+8801710000013', 'bn'),
  ('a0000000-0000-0000-0000-000000000014', 'জসিম উদ্দিন', '+8801710000014', 'bn');

insert into user_roles (user_id, role) values
  ('a0000000-0000-0000-0000-000000000001', 'admin'),
  ('a0000000-0000-0000-0000-000000000002', 'worker'),
  ('a0000000-0000-0000-0000-000000000011', 'parent'),
  ('a0000000-0000-0000-0000-000000000012', 'parent'),
  ('a0000000-0000-0000-0000-000000000013', 'parent'),
  ('a0000000-0000-0000-0000-000000000014', 'parent');

-- ============================================================================
-- VACCINE CATALOG — Bangladesh EPI schedule subset (§8.1: vaccine_doses normalizes
-- per-dose age/interval, since the flat SRS model can't express real calendars).
-- ============================================================================
insert into vaccines (code, name_bn, name_en, total_doses) values
  ('BCG',   'বিসিজি',                 'BCG',                 1),
  ('OPV',   'ওপিভি',                  'Oral Polio Vaccine',  4),
  ('PENTA', 'পেন্টাভ্যালেন্ট',        'Pentavalent',         3),
  ('PCV',   'পিসিভি',                 'Pneumococcal (PCV)',  3),
  ('IPV',   'আইপিভি',                 'Inactivated Polio',   1),
  ('MR',    'হাম-রুবেলা',             'Measles-Rubella',     2);

insert into vaccine_doses (vaccine_id, dose_number, recommended_age_days, min_interval_days)
select id, 1, 0, 0 from vaccines where code = 'BCG';

insert into vaccine_doses (vaccine_id, dose_number, recommended_age_days, min_interval_days) values
  ((select id from vaccines where code = 'OPV'), 1, 0,  0),
  ((select id from vaccines where code = 'OPV'), 2, 42, 28),
  ((select id from vaccines where code = 'OPV'), 3, 70, 28),
  ((select id from vaccines where code = 'OPV'), 4, 98, 28);

insert into vaccine_doses (vaccine_id, dose_number, recommended_age_days, min_interval_days) values
  ((select id from vaccines where code = 'PENTA'), 1, 42, 0),
  ((select id from vaccines where code = 'PENTA'), 2, 70, 28),
  ((select id from vaccines where code = 'PENTA'), 3, 98, 28);

insert into vaccine_doses (vaccine_id, dose_number, recommended_age_days, min_interval_days) values
  ((select id from vaccines where code = 'PCV'), 1, 42, 0),
  ((select id from vaccines where code = 'PCV'), 2, 70, 28),
  ((select id from vaccines where code = 'PCV'), 3, 98, 28);

insert into vaccine_doses (vaccine_id, dose_number, recommended_age_days, min_interval_days)
select id, 1, 98, 0 from vaccines where code = 'IPV';

insert into vaccine_doses (vaccine_id, dose_number, recommended_age_days, min_interval_days) values
  ((select id from vaccines where code = 'MR'), 1, 270, 0),
  ((select id from vaccines where code = 'MR'), 2, 450, 90);

-- ============================================================================
-- CHILDREN — inserting fires trg_child_after_insert, which auto-generates every
-- schedules row from the catalog above (§8.4). Ages are relative to `current_date`
-- so the demo stays realistic no matter when this seed runs.
-- ============================================================================
insert into children (id, full_name, date_of_birth, gender, guardian_id, guardian_contact, created_by) values
  ('b0000000-0000-0000-0000-000000000001', 'আয়েশা আক্তার', current_date - interval '15 months', 'female',
   'a0000000-0000-0000-0000-000000000011', '+8801710000011', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000002', 'রাফি ইসলাম', current_date - interval '3 months', 'male',
   'a0000000-0000-0000-0000-000000000011', '+8801710000011', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000003', 'নুসরাত জাহান', current_date - interval '10 months', 'female',
   'a0000000-0000-0000-0000-000000000012', '+8801710000012', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000004', 'আরিফ হাসান', current_date - interval '2 years', 'male',
   'a0000000-0000-0000-0000-000000000013', '+8801710000013', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000005', 'তানিয়া সুলতানা', current_date - interval '20 days', 'female',
   'a0000000-0000-0000-0000-000000000014', '+8801710000014', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000006', 'মেহেদী হাসান', current_date - interval '6 weeks', 'male',
   'a0000000-0000-0000-0000-000000000012', '+8801710000012', 'a0000000-0000-0000-0000-000000000002');

-- ============================================================================
-- VACCINATION RECORDS — inserting fires trg_record_after_insert, which flips the
-- matching schedule to 'done' and stamps next_due_date. administered_by is the
-- seeded worker throughout.
-- ============================================================================

-- Child 1 (15mo, "on track"): every dose due so far, administered.
insert into vaccination_records (child_id, vaccine_id, dose_number, administered_by, administered_date)
select 'b0000000-0000-0000-0000-000000000001', s.vaccine_id, s.dose_number,
       'a0000000-0000-0000-0000-000000000002', s.due_date + 2
  from schedules s
 where s.child_id = 'b0000000-0000-0000-0000-000000000001'
   and s.due_date <= current_date - interval '3 days'
 order by s.vaccine_id, s.dose_number;

-- Child 2 (3mo, "on track"): birth + 6-week doses administered; 10/14-week doses still pending.
insert into vaccination_records (child_id, vaccine_id, dose_number, administered_by, administered_date)
select 'b0000000-0000-0000-0000-000000000002', s.vaccine_id, s.dose_number,
       'a0000000-0000-0000-0000-000000000002', s.due_date + 1
  from schedules s
 where s.child_id = 'b0000000-0000-0000-0000-000000000002'
   and s.due_date <= current_date - interval '30 days'
 order by s.vaccine_id, s.dose_number;

-- Child 3 (10mo, "dropout" story): only got the birth-dose round, nothing since —
-- everything past the 14-day grace window is left pending here and then swept to
-- 'missed' below, giving Admin's dropout/coverage reports a real signal.
insert into vaccination_records (child_id, vaccine_id, dose_number, administered_by, administered_date)
select 'b0000000-0000-0000-0000-000000000003', s.vaccine_id, s.dose_number,
       'a0000000-0000-0000-0000-000000000002', s.due_date + 3
  from schedules s
 where s.child_id = 'b0000000-0000-0000-0000-000000000003'
   and s.due_date = (select date_of_birth from children where id = 'b0000000-0000-0000-0000-000000000003')
 order by s.vaccine_id, s.dose_number;

-- Child 4 (2y, fully completed long ago): every dose administered on schedule.
insert into vaccination_records (child_id, vaccine_id, dose_number, administered_by, administered_date)
select 'b0000000-0000-0000-0000-000000000004', s.vaccine_id, s.dose_number,
       'a0000000-0000-0000-0000-000000000002', s.due_date + 2
  from schedules s
 where s.child_id = 'b0000000-0000-0000-0000-000000000004'
 order by s.vaccine_id, s.dose_number;

-- Child 5 (20-day newborn): only the birth-dose round is due; leave it pending on
-- purpose (worker console demo target — nothing to record for the others yet).
-- Child 6 (6wk, "control"): birth doses due and administered, nothing overdue yet.
insert into vaccination_records (child_id, vaccine_id, dose_number, administered_by, administered_date)
select 'b0000000-0000-0000-0000-000000000006', s.vaccine_id, s.dose_number,
       'a0000000-0000-0000-0000-000000000002', s.due_date + 1
  from schedules s
 where s.child_id = 'b0000000-0000-0000-0000-000000000006'
   and s.due_date <= current_date - interval '3 days'
 order by s.vaccine_id, s.dose_number;

-- Run the missed-dose sweep once now (normally the nightly pg_cron job, §8.4) so
-- Child 3's abandoned schedule shows as 'missed' immediately for the demo, instead
-- of waiting for the next 01:00 UTC run.
update schedules set status = 'missed'
 where status = 'pending' and due_date < current_date - interval '14 days';

-- ============================================================================
-- INVENTORY — a couple of near-expiry batches and one low-stock batch, per TODO 3.2.
-- ============================================================================
insert into inventories (vaccine_id, batch_number, stock_quantity, expiry_date) values
  ((select id from vaccines where code = 'BCG'),   'BCG-2026-A1',   420, current_date + interval '9 months'),
  ((select id from vaccines where code = 'OPV'),   'OPV-2026-B2',   180, current_date + interval '18 days'),
  ((select id from vaccines where code = 'PENTA'), 'PENTA-2025-C7',  35, current_date + interval '11 days'),
  ((select id from vaccines where code = 'PENTA'), 'PENTA-2026-C8', 300, current_date + interval '7 months'),
  ((select id from vaccines where code = 'PCV'),   'PCV-2026-D3',   150, current_date + interval '4 months'),
  ((select id from vaccines where code = 'IPV'),   'IPV-2026-E1',    90, current_date + interval '6 months'),
  ((select id from vaccines where code = 'MR'),    'MR-2026-F4',    210, current_date + interval '10 months');
