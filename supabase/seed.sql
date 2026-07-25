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

-- `contact` is display-only now; `phone` and `email` are the typed columns channel routing
-- reads (BUG-06 was one column doing both jobs and the dispatcher guessing which).
insert into profiles (id, full_name, contact, email, phone, locale) values
  ('a0000000-0000-0000-0000-000000000001', 'অ্যাডমিন সালমা রহমান', 'admin@vaxtrace.bd',  'admin@vaxtrace.bd',  null, 'bn'),
  ('a0000000-0000-0000-0000-000000000002', 'স্বাস্থ্যকর্মী নাসরিন আক্তার', 'worker@vaxtrace.bd', 'worker@vaxtrace.bd', null, 'bn'),
  ('a0000000-0000-0000-0000-000000000011', 'রোকসানা বেগম',  '+8801710000011', null, '+8801710000011', 'bn'),
  ('a0000000-0000-0000-0000-000000000012', 'কামাল হোসেন',   '+8801710000012', null, '+8801710000012', 'bn'),
  ('a0000000-0000-0000-0000-000000000013', 'সালমা খাতুন',   '+8801710000013', null, '+8801710000013', 'bn'),
  ('a0000000-0000-0000-0000-000000000014', 'জসিম উদ্দিন',   '+8801710000014', null, '+8801710000014', 'bn');

insert into user_roles (user_id, role) values
  ('a0000000-0000-0000-0000-000000000001', 'admin'),
  ('a0000000-0000-0000-0000-000000000002', 'worker'),
  ('a0000000-0000-0000-0000-000000000011', 'parent'),
  ('a0000000-0000-0000-0000-000000000012', 'parent'),
  ('a0000000-0000-0000-0000-000000000013', 'parent'),
  ('a0000000-0000-0000-0000-000000000014', 'parent');

-- ============================================================================
-- POSTINGS — role x scope (report §10). The migration's backfill puts every existing staff
-- account at the root, but a fresh database has no staff at migration time, so the demo's
-- postings are set here.
--
-- Deliberately NOT both at root: the admin is national (and holds the technical estate
-- separately), while the worker is posted to one union. That difference is the whole point of
-- the model, and a demo where everyone can see everything demonstrates nothing.
-- ============================================================================
insert into user_assignments (user_id, role, location_id) values
  ('a0000000-0000-0000-0000-000000000001', 'programme_manager',
   (select id from locations where path = 'bd')),
  ('a0000000-0000-0000-0000-000000000001', 'system_admin',
   (select id from locations where path = 'bd')),
  ('a0000000-0000-0000-0000-000000000002', 'field_worker',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak'));

-- ============================================================================
-- FACILITIES — a facility is LOCATED IN one place and SERVES a set of places, and the two
-- are different: the outreach site sits in ward 3 and serves wards 3, 4 and 5.
-- ============================================================================
insert into facilities (id, name_bn, name_en, type, location_id, is_store) values
  ('f0000000-0000-0000-0000-000000000001', 'কালিয়াকৈর উপজেলা স্বাস্থ্য কমপ্লেক্স',
   'Kaliakair Upazila Health Complex', 'upazila_health_complex',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair'), true),
  ('f0000000-0000-0000-0000-000000000002', 'মৌচাক ইউনিয়ন স্বাস্থ্য কেন্দ্র',
   'Mouchak Union Health Centre', 'union_health_centre',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak'), true),
  ('f0000000-0000-0000-0000-000000000003', 'মৌচাক ওয়ার্ড ৩ আউটরিচ কেন্দ্র',
   'Mouchak Ward 3 Outreach Site', 'outreach_site',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak.ward_3'), false);

insert into facility_catchments (facility_id, location_id, is_primary) values
  ('f0000000-0000-0000-0000-000000000001',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair'), true),
  ('f0000000-0000-0000-0000-000000000002',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak'), true),
  -- The asymmetry that makes facility_catchments a table rather than a column.
  ('f0000000-0000-0000-0000-000000000003',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak.ward_3'), true),
  ('f0000000-0000-0000-0000-000000000003',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak.ward_4'), false),
  ('f0000000-0000-0000-0000-000000000003',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak.ward_5'), false);

-- ============================================================================
-- POPULATION ESTIMATES — the denominator (BS-07). Without these rows every coverage figure
-- is a registry measuring itself. The numbers are illustrative and the `source` says so:
-- a denominator whose provenance is unknown cannot be used in a report anyone has to sign.
-- ============================================================================
insert into population_estimates (location_id, year, age_band, estimate, source) values
  ((select id from locations where path = 'bd.dhaka.gazipur.kaliakair'),
   extract(year from current_date)::int, 'surviving_infants', 9800, 'ডেমো অনুমান — সরকারি উৎস নয়'),
  ((select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak'),
   extract(year from current_date)::int, 'surviving_infants', 1150, 'ডেমো অনুমান — সরকারি উৎস নয়'),
  ((select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak'),
   extract(year from current_date)::int, 'live_births', 1240, 'ডেমো অনুমান — সরকারি উৎস নয়');

-- ============================================================================
-- GUARDIANS — a domain record, not a login (BS-02). These four happen to have accounts
-- because the demo needs a parent sign-in, but `user_id` is nullable precisely so the
-- overwhelming majority of guardians, who have no account, are representable.
-- ============================================================================
insert into guardians (id, user_id, full_name, phone, relationship, location_id, created_by) values
  ('d0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000011',
   'রোকসানা বেগম', '+8801710000011', 'mother',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak.ward_3'),
   'a0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000012',
   'কামাল হোসেন', '+8801710000012', 'father',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak.ward_4'),
   'a0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000013',
   'সালমা খাতুন', '+8801710000013', 'mother',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak.ward_5'),
   'a0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000014',
   'জসিম উদ্দিন', '+8801710000014', 'father',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak.ward_3'),
   'a0000000-0000-0000-0000-000000000002'),
  -- The case the whole redesign exists for: a guardian with no account at all.
  ('d0000000-0000-0000-0000-000000000015', null,
   'ফাতেমা বিবি', '+8801710000015', 'mother',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak.ward_4'),
   'a0000000-0000-0000-0000-000000000002');

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
-- location_id is supplied explicitly so the demo has children spread across wards; without it
-- trg_child_location would still fill it from the registrar's posting, but every child would
-- land in the same union and the area reports would have nothing to compare.
insert into children (id, full_name, date_of_birth, gender, guardian_id, created_by, location_id, facility_id) values
  ('b0000000-0000-0000-0000-000000000001', 'আয়েশা আক্তার', current_date - interval '15 months', 'female',
   'd0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000002',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak.ward_3'),
   'f0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000002', 'রাফি ইসলাম', current_date - interval '3 months', 'male',
   'd0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000002',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak.ward_3'),
   'f0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000003', 'নুসরাত জাহান', current_date - interval '10 months', 'female',
   'd0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000002',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak.ward_4'),
   'f0000000-0000-0000-0000-000000000003'),
  ('b0000000-0000-0000-0000-000000000004', 'আরিফ হাসান', current_date - interval '2 years', 'male',
   'd0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000002',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak.ward_5'),
   'f0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000005', 'তানিয়া সুলতানা', current_date - interval '20 days', 'female',
   'd0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000002',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak.ward_3'),
   'f0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000006', 'মেহেদী হাসান', current_date - interval '6 weeks', 'male',
   'd0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000002',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak.ward_4'),
   'f0000000-0000-0000-0000-000000000003'),
  -- Registered for a guardian who has no account, and never will have one unless she claims
  -- it with the Child ID. This row is unregisterable in the pre-BS-02 model.
  ('b0000000-0000-0000-0000-000000000007', 'সাদিয়া ইসলাম', current_date - interval '8 months', 'female',
   'd0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000002',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair.mouchak.ward_4'),
   'f0000000-0000-0000-0000-000000000003');

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

-- Run the sweep once now (normally the nightly pg_cron job) so Child 3's abandoned schedule
-- shows as 'missed' immediately for the demo, instead of waiting for the next 01:00 UTC run.
--
-- Calls the function rather than repeating its WHERE clause: the grace period is a programme
-- setting with a per-antigen override now (BUG-10), and a hardcoded 14 days here would drift
-- from it the first time anyone changed it.
select public.reconcile_schedule_status();

-- ============================================================================
-- LIFECYCLE — one child who has left the catchment, so the reports have a non-active status
-- to show and FR-56's "reminders stop" is demonstrable rather than merely asserted.
-- ============================================================================
update children
   set status = 'moved_out',
       status_reason = 'পরিবার ঢাকায় স্থানান্তরিত হয়েছে'
 where id = 'b0000000-0000-0000-0000-000000000004';

-- One guardian who has opted out (BUG-07), which the pre-rebuild system could not represent.
insert into notification_preferences (guardian_id, opted_out_at, opt_out_reason)
values ('d0000000-0000-0000-0000-000000000013', now(), 'অভিভাবক এসএমএস বন্ধ করতে বলেছেন');

-- ============================================================================
-- INVENTORY — a couple of near-expiry batches and one low-stock batch, per TODO 3.2.
-- ============================================================================
-- Stock is held at a store, not in a global pool (FR-40): the same batch legitimately exists
-- in two places, which is why the unique key is (facility, vaccine, batch).
insert into inventories (vaccine_id, batch_number, stock_quantity, expiry_date, facility_id) values
  ((select id from vaccines where code = 'BCG'),   'BCG-2026-A1',   420, current_date + interval '9 months',  'f0000000-0000-0000-0000-000000000001'),
  ((select id from vaccines where code = 'OPV'),   'OPV-2026-B2',   180, current_date + interval '18 days',   'f0000000-0000-0000-0000-000000000001'),
  ((select id from vaccines where code = 'PENTA'), 'PENTA-2025-C7',  35, current_date + interval '11 days',   'f0000000-0000-0000-0000-000000000001'),
  ((select id from vaccines where code = 'PENTA'), 'PENTA-2026-C8', 300, current_date + interval '7 months',  'f0000000-0000-0000-0000-000000000001'),
  ((select id from vaccines where code = 'PCV'),   'PCV-2026-D3',   150, current_date + interval '4 months',  'f0000000-0000-0000-0000-000000000001'),
  ((select id from vaccines where code = 'IPV'),   'IPV-2026-E1',    90, current_date + interval '6 months',  'f0000000-0000-0000-0000-000000000001'),
  ((select id from vaccines where code = 'MR'),    'MR-2026-F4',    210, current_date + interval '10 months', 'f0000000-0000-0000-0000-000000000001'),
  -- The same PENTA batch, issued down to the union centre. One batch, two stores, two
  -- balances — impossible to express before facility_id existed.
  ((select id from vaccines where code = 'PENTA'), 'PENTA-2026-C8',  60, current_date + interval '7 months',  'f0000000-0000-0000-0000-000000000002');
