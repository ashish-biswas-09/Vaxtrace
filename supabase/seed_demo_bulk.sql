-- ===========================================================================
-- VaxTrace — FULL-SCALE DEMO DATASET
-- ===========================================================================
-- `seed.sql` tells a small, hand-written story: seven children whose histories were chosen
-- one by one. That is the right thing for reading the schema, and the wrong thing for TESTING
-- the admin module — with seven children nothing paginates, no filter has anything to exclude,
-- no queue has a second page, and a query that silently truncates at the PostgREST row cap
-- looks perfectly healthy.
--
-- This file builds the registry at a size where those things are visible: ~380 children across
-- ~160 wards, ~3,800 doses, a stock ledger that reconciles, and every enum state that any
-- admin screen filters on actually present in the data.
--
-- RUN ORDER
--   1. supabase db reset          (migrations + seed.sql)
--   2. this file
--
-- It DELETES the operational rows seed.sql created and rebuilds them at scale. It deliberately
-- keeps: locations (seeded by the geography migration), the vaccine catalog, app_settings,
-- message_templates and the six demo auth accounts. Re-running it is safe.
--
-- Everything is derived from hashtext(), never random(), so the same database comes out twice
-- and a number quoted in a report is still true tomorrow.
--
-- ponytail: the whole file is one pass of INSERT … SELECT over generate_series. It is not a
-- factory library and does not need to be — the shape of the data is the point, not the tool.

begin;

-- ---------------------------------------------------------------------------
-- 0. CLEAR THE OPERATIONAL TABLES
-- ---------------------------------------------------------------------------
-- The ledger and the temperature log are append-only by trigger, and deregistering a child or
-- voiding a dose is an admin act guarded by auth_role(). The seed has no JWT, so the guards
-- come off for the load and go straight back on.
alter table stock_transactions  disable trigger stock_immutable;
alter table cold_chain_readings disable trigger cold_chain_readings_immutable;
alter table children            disable trigger children_status_history;
alter table children            disable trigger children_delete_guard;
alter table vaccination_records disable trigger vaccination_records_void_guard;
alter table break_glass_access  disable trigger break_glass_limit;

delete from aefi_cases;
delete from tracing_tasks;
delete from notifications;
delete from notification_preferences;
delete from child_status_history;
delete from break_glass_access;
delete from requisition_lines;
delete from requisitions;
delete from stock_transactions;
delete from cold_chain_readings;
delete from cold_chain_devices;
delete from vaccination_records;
delete from schedules;
delete from children;
delete from guardians;
delete from inventories;
delete from sessions;
delete from facility_catchments;
delete from facilities;
delete from population_estimates;
delete from user_assignments;
delete from rate_limits;
delete from audit_log;

-- ---------------------------------------------------------------------------
-- 1. DEEPER GEOGRAPHY
-- ---------------------------------------------------------------------------
-- The geography migration seeds the country, all divisions, all districts, Gazipur's upazilas
-- and two Kaliakair unions. Two more upazilas get unions here so an area report has more than
-- one branch to compare, and coverage_by_area() has something to drill into.
insert into locations (parent_id, level, slug, name_bn, name_en)
select p.id, 'union', u.slug, u.bn, u.en
  from (values
    ('bd.dhaka.gazipur.gazipur_sadar','baria','বাড়িয়া','Baria'),
    ('bd.dhaka.gazipur.gazipur_sadar','mirzapur','মির্জাপুর','Mirzapur'),
    ('bd.dhaka.gazipur.gazipur_sadar','pubail','পুবাইল','Pubail'),
    ('bd.dhaka.gazipur.sreepur','barmi','বরমী','Barmi'),
    ('bd.dhaka.gazipur.sreepur','gosinga','গোসিঙ্গা','Gosinga'),
    ('bd.dhaka.gazipur.sreepur','telihati','তেলিহাটি','Telihati')
  ) as u(parent, slug, bn, en)
  join locations p on p.path = u.parent::ltree
 where not exists (select 1 from locations x where x.path = (u.parent || '.' || u.slug)::ltree);

-- Nine wards per union is statutory, so it is generated rather than transcribed.
insert into locations (parent_id, level, slug, name_bn, name_en)
select p.id, 'ward', 'ward_' || n, 'ওয়ার্ড ' || translate(n::text,'0123456789','০১২৩৪৫৬৭৮৯'), 'Ward ' || n
  from generate_series(1, 9) as n
  join locations p
    on p.level = 'union'
   and (p.path <@ 'bd.dhaka.gazipur.gazipur_sadar' or p.path <@ 'bd.dhaka.gazipur.sreepur')
 where not exists (select 1 from locations x where x.parent_id = p.id and x.slug = 'ward_' || n);

-- Bengali numerals in user-facing text (handbook §4.16). The migration's ward seeder emits
-- Latin digits, which read as a different language inside a Bangla-only interface.
update locations set name_bn = translate(name_bn, '0123456789', '০১২৩৪৫৬৭৮৯')
 where name_bn ~ '[0-9]';

-- ---------------------------------------------------------------------------
-- 2. STAFF BEYOND THE TWO DEMO LOGINS
-- ---------------------------------------------------------------------------
-- The user-management screen needs more than one row, the assignment model needs a role at
-- every tier, and the account lifecycle needs an invited and an inactive account to show.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       crypt('VaxTrace@2026', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', '{}', now() - interval '120 days', now(),
       '', '', '', ''
  from (values
    ('a0000000-0000-0000-0000-000000000003'::uuid, 'supervisor@vaxtrace.bd'),
    ('a0000000-0000-0000-0000-000000000004'::uuid, 'store@vaxtrace.bd'),
    ('a0000000-0000-0000-0000-000000000005'::uuid, 'manager.gazipur@vaxtrace.bd'),
    ('a0000000-0000-0000-0000-000000000006'::uuid, 'worker.sreepur@vaxtrace.bd'),
    ('a0000000-0000-0000-0000-000000000007'::uuid, 'worker.sadar@vaxtrace.bd'),
    ('a0000000-0000-0000-0000-000000000008'::uuid, 'worker.left@vaxtrace.bd')
  ) as u(id, email)
 where not exists (select 1 from auth.users x where x.id = u.id);

insert into auth.identities (id, provider_id, user_id, identity_data, provider,
                             last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
  from auth.users u
 where u.id between 'a0000000-0000-0000-0000-000000000003'
                and 'a0000000-0000-0000-0000-000000000008'
   and not exists (select 1 from auth.identities i where i.user_id = u.id);

insert into profiles (id, full_name, contact, email, phone, locale, status, address) values
  ('a0000000-0000-0000-0000-000000000003','সুপারভাইজার মাহবুব আলম','supervisor@vaxtrace.bd','supervisor@vaxtrace.bd','+8801711000003','bn','active','কালিয়াকৈর, গাজীপুর'),
  ('a0000000-0000-0000-0000-000000000004','স্টোর কিপার রফিকুল ইসলাম','store@vaxtrace.bd','store@vaxtrace.bd','+8801711000004','bn','active','কালিয়াকৈর, গাজীপুর'),
  ('a0000000-0000-0000-0000-000000000005','প্রোগ্রাম ম্যানেজার শাহনাজ পারভীন','manager.gazipur@vaxtrace.bd','manager.gazipur@vaxtrace.bd','+8801711000005','bn','active','গাজীপুর সদর'),
  ('a0000000-0000-0000-0000-000000000006','স্বাস্থ্যকর্মী আফরোজা খাতুন','worker.sreepur@vaxtrace.bd','worker.sreepur@vaxtrace.bd','+8801711000006','bn','active','শ্রীপুর, গাজীপুর'),
  ('a0000000-0000-0000-0000-000000000007','স্বাস্থ্যকর্মী জাহিদ হাসান','worker.sadar@vaxtrace.bd','worker.sadar@vaxtrace.bd','+8801711000007','bn','invited','গাজীপুর সদর'),
  ('a0000000-0000-0000-0000-000000000008','স্বাস্থ্যকর্মী নাজমা বেগম','worker.left@vaxtrace.bd','worker.left@vaxtrace.bd','+8801711000008','bn','inactive','গাজীপুর সদর')
on conflict (id) do nothing;

insert into user_roles (user_id, role) values
  ('a0000000-0000-0000-0000-000000000003','worker'),
  ('a0000000-0000-0000-0000-000000000004','worker'),
  ('a0000000-0000-0000-0000-000000000005','admin'),
  ('a0000000-0000-0000-0000-000000000006','worker'),
  ('a0000000-0000-0000-0000-000000000007','worker'),
  ('a0000000-0000-0000-0000-000000000008','worker')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. FACILITIES AND CATCHMENTS
-- ---------------------------------------------------------------------------
insert into facilities (id, name_bn, name_en, type, location_id, is_store) values
  ('f0000000-0000-0000-0000-000000000001','কালিয়াকৈর উপজেলা স্বাস্থ্য কমপ্লেক্স','Kaliakair Upazila Health Complex','upazila_health_complex',(select id from locations where path='bd.dhaka.gazipur.kaliakair'), true),
  ('f0000000-0000-0000-0000-000000000002','মৌচাক ইউনিয়ন স্বাস্থ্য কেন্দ্র','Mouchak Union Health Centre','union_health_centre',(select id from locations where path='bd.dhaka.gazipur.kaliakair.mouchak'), true),
  ('f0000000-0000-0000-0000-000000000003','মৌচাক ওয়ার্ড ৩ আউটরিচ কেন্দ্র','Mouchak Ward 3 Outreach Site','outreach_site',(select id from locations where path='bd.dhaka.gazipur.kaliakair.mouchak.ward_3'), false),
  ('f0000000-0000-0000-0000-000000000004','গাজীপুর সদর উপজেলা স্বাস্থ্য কমপ্লেক্স','Gazipur Sadar Upazila Health Complex','upazila_health_complex',(select id from locations where path='bd.dhaka.gazipur.gazipur_sadar'), true),
  ('f0000000-0000-0000-0000-000000000005','শ্রীপুর উপজেলা স্বাস্থ্য কমপ্লেক্স','Sreepur Upazila Health Complex','upazila_health_complex',(select id from locations where path='bd.dhaka.gazipur.sreepur'), true),
  ('f0000000-0000-0000-0000-000000000006','শহীদ তাজউদ্দীন আহমদ মেডিকেল কলেজ হাসপাতাল','Shaheed Tajuddin Ahmad Medical College Hospital','hospital',(select id from locations where path='bd.dhaka.gazipur.gazipur_sadar'), false),
  ('f0000000-0000-0000-0000-000000000007','ডিএনসিসি ওয়ার্ড ১ নগর মাতৃসদন','DNCC Ward 1 Urban Health Centre','city_corporation_centre',(select id from locations where path='bd.dhaka.dhaka.dncc.ward_1'), true),
  ('f0000000-0000-0000-0000-000000000008','ব্র্যাক স্বাস্থ্য কেন্দ্র, ফুলবাড়িয়া','BRAC Health Centre, Fulbaria','ngo_clinic',(select id from locations where path='bd.dhaka.gazipur.kaliakair.fulbaria'), false),
  -- Deactivated on purpose: the facilities screen needs an inactive row to render differently.
  ('f0000000-0000-0000-0000-000000000009','পুরাতন কালিয়াকৈর আউটরিচ কেন্দ্র','Old Kaliakair Outreach Site','outreach_site',(select id from locations where path='bd.dhaka.gazipur.kaliakair.mouchak.ward_9'), false);

update facilities set is_active = false where id = 'f0000000-0000-0000-0000-000000000009';

insert into facilities (name_bn, name_en, type, location_id, is_store)
select l.name_bn || ' ইউনিয়ন স্বাস্থ্য কেন্দ্র', l.name_en || ' Union Health Centre',
       'union_health_centre', l.id, false
  from locations l
 where l.level = 'union' and l.path <@ 'bd.dhaka.gazipur'
   and l.path <> 'bd.dhaka.gazipur.kaliakair.mouchak';

insert into facilities (name_bn, name_en, type, location_id, is_store)
select l.name_bn || ' কমিউনিটি ক্লিনিক', l.name_en || ' Community Clinic',
       'community_clinic', l.id, false
  from locations l
 where l.level = 'ward' and l.slug = 'ward_1' and l.path <@ 'bd.dhaka.gazipur';

insert into facility_catchments (facility_id, location_id, is_primary)
select f.id, f.location_id, true from facilities f;

-- The asymmetry that makes facility_catchments a table rather than a column: the outreach site
-- sits in ward 3 and serves wards 3, 4 and 5.
insert into facility_catchments (facility_id, location_id, is_primary) values
  ('f0000000-0000-0000-0000-000000000003',(select id from locations where path='bd.dhaka.gazipur.kaliakair.mouchak.ward_4'), false),
  ('f0000000-0000-0000-0000-000000000003',(select id from locations where path='bd.dhaka.gazipur.kaliakair.mouchak.ward_5'), false);

-- ---------------------------------------------------------------------------
-- 4. POSTINGS — role × scope
-- ---------------------------------------------------------------------------
-- Deliberately not all at the root: a demo where everyone sees everything demonstrates
-- nothing. The last row is an expired secondment, which is what proves valid_to is honoured.
insert into user_assignments (user_id, role, location_id, facility_id, valid_from, valid_to) values
  ('a0000000-0000-0000-0000-000000000001','programme_manager',(select id from locations where path='bd'), null, current_date - 200, null),
  ('a0000000-0000-0000-0000-000000000001','system_admin',      (select id from locations where path='bd'), null, current_date - 200, null),
  ('a0000000-0000-0000-0000-000000000002','field_worker',      (select id from locations where path='bd.dhaka.gazipur.kaliakair.mouchak'), null, current_date - 180, null),
  ('a0000000-0000-0000-0000-000000000003','supervisor',        (select id from locations where path='bd.dhaka.gazipur.kaliakair'), null, current_date - 150, null),
  ('a0000000-0000-0000-0000-000000000004','store_keeper',      null, 'f0000000-0000-0000-0000-000000000001', current_date - 150, null),
  ('a0000000-0000-0000-0000-000000000005','programme_manager', (select id from locations where path='bd.dhaka.gazipur'), null, current_date - 120, null),
  ('a0000000-0000-0000-0000-000000000006','field_worker',      (select id from locations where path='bd.dhaka.gazipur.sreepur'), null, current_date - 90, null),
  ('a0000000-0000-0000-0000-000000000007','field_worker',      (select id from locations where path='bd.dhaka.gazipur.gazipur_sadar'), null, current_date - 30, null),
  ('a0000000-0000-0000-0000-000000000008','field_worker',      (select id from locations where path='bd.dhaka.gazipur.gazipur_sadar'), null, current_date - 400, current_date - 40);

-- ---------------------------------------------------------------------------
-- 5. THE DENOMINATOR — two years, three age bands
-- ---------------------------------------------------------------------------
insert into population_estimates (location_id, year, age_band, estimate, source, updated_by)
select l.id, y.yr, b.band,
       (case l.level when 'district' then 62000 when 'upazila' then 9500 else 1150 end
        * (case b.band when 'live_births' then 1.08 when 'surviving_infants' then 1.0 else 1.02 end)
        * (case when y.yr = extract(year from current_date)::int then 1.0 else 0.96 end)
        + (abs(hashtext(l.slug || y.yr || b.band)) % 180))::int,
       'ডেমো অনুমান — বিবিএস প্রক্ষেপণ নয়',
       'a0000000-0000-0000-0000-000000000001'
  from locations l
 cross join (values (extract(year from current_date)::int),
                    (extract(year from current_date)::int - 1)) as y(yr)
 cross join (values ('surviving_infants'), ('live_births'), ('0_11m')) as b(band)
 where l.path = 'bd.dhaka.gazipur'
    or (l.level in ('upazila','union') and l.path <@ 'bd.dhaka.gazipur');

-- ---------------------------------------------------------------------------
-- 6. GUARDIANS
-- ---------------------------------------------------------------------------
-- Three per ward. Almost none have an account — that is the case BS-02 exists to serve — and
-- one in thirty-seven carries the '+000000000000' marker for "migrated with no usable number",
-- which is what v_data_quality counts.
insert into guardians (id, user_id, full_name, phone, email, relationship, national_id,
                       address, location_id, created_by, created_at)
select ('d1000000-0000-0000-0000-' || lpad((w.n * 8 + s)::text, 12, '0'))::uuid,
       null,
       gn.bn,
       case when (w.n * 8 + s) % 37 = 0 then '+000000000000'
            else '+8801' || lpad(((700000000 + w.n * 811 + s * 97) % 1000000000)::text, 9, '0') end,
       case when (w.n * 8 + s) % 4 = 0 then 'guardian' || (w.n * 8 + s) || '@example.bd' end,
       (array['mother','father','grandparent','caregiver','other_relative']::guardian_relationship[])[1 + (w.n + s) % 5],
       case when (w.n + s) % 3 <> 0 then lpad(((1990000000000 + w.n * 7717 + s * 131))::text, 17, '0') end,
       'গ্রাম ' || (1 + (w.n + s) % 12) || ', ' || replace(w.path::text, 'bd.dhaka.gazipur.', ''),
       w.id,
       'a0000000-0000-0000-0000-000000000002',
       now() - ((w.n * 3 + s) || ' days')::interval
  from (
    select l.id, l.path, (row_number() over (order by l.path) - 1)::int as n
      from locations l where l.level in ('ward','urban_ward')
  ) w
 cross join generate_series(0, 2) as s
  join (values
    (0,'রোকসানা বেগম'),(1,'কামাল হোসেন'),(2,'সালমা খাতুন'),(3,'জসিম উদ্দিন'),(4,'ফাতেমা বিবি'),
    (5,'শিরীন আক্তার'),(6,'আব্দুল করিম'),(7,'নাসিমা পারভীন'),(8,'মোঃ শাহজাহান'),(9,'রেহানা ইয়াসমিন'),
    (10,'আনোয়ার হোসেন'),(11,'মমতাজ বেগম'),(12,'হাফিজুর রহমান'),(13,'শাহানারা খাতুন'),(14,'বেলাল উদ্দিন'),
    (15,'রুবিনা আক্তার'),(16,'সিরাজুল ইসলাম'),(17,'নার্গিস সুলতানা'),(18,'মিজানুর রহমান'),(19,'আয়েশা সিদ্দিকা')
  ) as gn(n, bn) on gn.n = (w.n * 8 + s) % 20;

-- The four demo parent logins each claim a guardian record, so the parent surface has data.
update guardians g set user_id = p.uid, phone = p.phone
  from (values
    ('d1000000-0000-0000-0000-000000000000'::uuid,'a0000000-0000-0000-0000-000000000011'::uuid,'+8801710000011'),
    ('d1000000-0000-0000-0000-000000000008'::uuid,'a0000000-0000-0000-0000-000000000012'::uuid,'+8801710000012'),
    ('d1000000-0000-0000-0000-000000000016'::uuid,'a0000000-0000-0000-0000-000000000013'::uuid,'+8801710000013'),
    ('d1000000-0000-0000-0000-000000000024'::uuid,'a0000000-0000-0000-0000-000000000014'::uuid,'+8801710000014')
  ) as p(gid, uid, phone)
 where g.id = p.gid;

-- ---------------------------------------------------------------------------
-- 7. CHILDREN
-- ---------------------------------------------------------------------------
-- Inserting fires child_id_guard (mints the Child ID), children_location (stamps the ltree
-- path) and child_after_insert (derives the whole schedule from the date of birth). Nothing
-- below writes a schedule row by hand.
insert into children (id, full_name, date_of_birth, gender, guardian_id, created_by,
                      location_id, facility_id, created_at)
select ('b1000000-0000-0000-0000-' || lpad(p.k::text, 12, '0'))::uuid,
       nm.bn,
       current_date - ((25 + (abs(hashtext('dob' || p.k)) % 1055)) || ' days')::interval,
       nm.g::child_gender,
       p.id,
       (array['a0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000006',
              'a0000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000003']::uuid[])[1 + p.k % 4],
       p.location_id,
       fac.id,
       greatest(p.created_at, now() - interval '400 days')
  from (
    select g.*, s.slot, (g.gn * 3 + s.slot) as k
      from (select gd.id, gd.location_id, gd.created_at,
                   row_number() over (order by gd.created_at, gd.id) - 1 as gn
              from guardians gd) g
      join lateral generate_series(0, case when g.gn % 5 = 0 then 2
                                           when g.gn % 3 = 0 then 1 else 0 end) as s(slot) on true
  ) p
  join (values
    (0,'আয়েশা আক্তার','female'),(1,'রাফি ইসলাম','male'),(2,'নুসরাত জাহান','female'),(3,'আরিফ হাসান','male'),
    (4,'তানিয়া সুলতানা','female'),(5,'মেহেদী হাসান','male'),(6,'সাদিয়া ইসলাম','female'),(7,'তামিম ইকবাল','male'),
    (8,'জান্নাতুল ফেরদৌস','female'),(9,'সাব্বির আহমেদ','male'),(10,'মারিয়া খাতুন','female'),(11,'ইমরান হোসেন','male'),
    (12,'সুমাইয়া আক্তার','female'),(13,'রিয়াদ হাসান','male'),(14,'লামিয়া ইসলাম','female'),(15,'নাফিস আহমেদ','male'),
    (16,'তাসনিম জাহান','female'),(17,'আরাফাত রহমান','male'),(18,'রাইসা বিনতে','female'),(19,'শাহরিয়ার কবির','male'),
    (20,'হুমায়রা বিনতে','female'),(21,'আবির হাসান','male'),(22,'ফারিয়া তাবাসসুম','female'),(23,'সিফাত উল্লাহ','male')
  ) as nm(n, bn, g) on nm.n = p.k % 24
  left join lateral (
    select f.id from facilities f
      join locations fl on fl.id = f.location_id
      join locations cl on cl.id = p.location_id
     where cl.path <@ fl.path and f.is_active
     order by nlevel(fl.path) desc, f.is_store desc limit 1
  ) fac on true;

-- Birth registration on most, absent on the rest — the gap v_data_quality reports.
update children
   set birth_registration_no = lpad((20200000000000000 + (abs(hashtext('brn' || id::text)) % 79999999))::text, 17, '0')
 where abs(hashtext('brnpick' || id::text)) % 10 < 7;

-- ---------------------------------------------------------------------------
-- 8. INVENTORY, AND THE LEDGER THAT OWNS IT
-- ---------------------------------------------------------------------------
insert into inventories (vaccine_id, batch_number, stock_quantity, expiry_date, facility_id)
select v.id,
       v.code || '-' || to_char(current_date - ((abs(hashtext(v.code || f.code)) % 200) || ' days')::interval, 'YYYY')
             || '-' || substr(f.code, 9, 2) || (1 + (abs(hashtext(v.code || f.code)) % 9)),
       800 + (abs(hashtext('qty' || v.code || f.code)) % 1200),
       current_date + ((120 + (abs(hashtext('exp' || v.code || f.code)) % 400)) || ' days')::interval,
       f.id
  from vaccines v cross join facilities f
 where f.is_store;

-- The edge cases the inventory screen exists to surface.
insert into inventories (vaccine_id, batch_number, stock_quantity, expiry_date, facility_id) values
  ((select id from vaccines where code='PENTA'),'PENTA-2025-EXPIRED', 46, current_date - 21, 'f0000000-0000-0000-0000-000000000001'),
  ((select id from vaccines where code='OPV'),  'OPV-2026-NEAR',     180, current_date + 11, 'f0000000-0000-0000-0000-000000000001'),
  ((select id from vaccines where code='BCG'),  'BCG-2026-LOW',       28, current_date + 18, 'f0000000-0000-0000-0000-000000000001'),
  ((select id from vaccines where code='MR'),   'MR-2026-EMPTY',       0, current_date + 240,'f0000000-0000-0000-0000-000000000002'),
  ((select id from vaccines where code='PCV'),  'PCV-2026-NEAR2',    140, current_date + 6,  'f0000000-0000-0000-0000-000000000004'),
  ((select id from vaccines where code='IPV'),  'IPV-2025-EXPIRED2',  12, current_date - 60, 'f0000000-0000-0000-0000-000000000005');

-- stock_quantity is a CACHE of the ledger (report D5, BUG-04), never an authored number. The
-- quantities above are zeroed and rebuilt by receipts, so reconcile_stock() returns 0 from the
-- first minute instead of failing the first nightly check.
create temporary table _opening as select id, stock_quantity as qty from inventories;
update inventories set stock_quantity = 0;

insert into stock_transactions (inventory_id, txn_type, quantity, performed_by, occurred_at, note)
select o.id, 'receipt', o.qty, 'a0000000-0000-0000-0000-000000000004',
       now() - ((30 + (abs(hashtext(o.id::text)) % 120)) || ' days')::interval,
       'জেলা গুদাম থেকে প্রাপ্ত'
  from _opening o where o.qty > 0;

drop table _opening;

-- ---------------------------------------------------------------------------
-- 9. SESSIONS
-- ---------------------------------------------------------------------------
insert into sessions (facility_id, location_id, type, status, session_date, start_time, end_time,
                      team_lead, target_children, notes, cancel_reason, created_by)
select f.id,
       case when f.k % 3 = 1
            then coalesce((select w.id from locations w
                            where w.level in ('ward','urban_ward')
                              and w.path <@ (select fl.path from locations fl where fl.id = f.location_id)
                            order by w.path offset (f.k % 5) limit 1), f.location_id)
            else f.location_id end,
       (array['fixed','outreach','campaign']::session_type[])[1 + f.k % 3],
       case when days.d > current_date then 'planned'::session_status
            when (f.k + days.n) % 11 = 0 then 'cancelled'::session_status
            else 'held'::session_status end,
       days.d, '09:00', '13:00',
       (array['a0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000006',
              'a0000000-0000-0000-0000-000000000003']::uuid[])[1 + f.k % 3],
       15 + (abs(hashtext('t' || f.code || days.d::text)) % 30),
       case when f.k % 7 = 0 then 'নিয়মিত ইপিআই সেশন' end,
       -- Cancellation rate BY REASON is the number that gets outreach transport funded.
       case when days.d <= current_date and (f.k + days.n) % 11 = 0
            then (array['ভারী বৃষ্টিতে রাস্তা বন্ধ, দল পৌঁছাতে পারেনি',
                        'টিকা সরবরাহ সময়মতো পৌঁছায়নি',
                        'দলনেতা অসুস্থ থাকায় স্থগিত']::text[])[1 + f.k % 3] end,
       'a0000000-0000-0000-0000-000000000001'
  from (select fa.*, (row_number() over (order by fa.code) - 1)::int as k
          from facilities fa
         where fa.is_active and fa.type in ('upazila_health_complex','union_health_centre',
                                            'outreach_site','city_corporation_centre')) f
 cross join lateral (select n, (current_date - interval '168 days' + (n * 21 || ' days')::interval)::date as d
                       from generate_series(0, 9) n) days
 where f.k < 9;

-- ---------------------------------------------------------------------------
-- 10. THE VACCINATION HISTORY
-- ---------------------------------------------------------------------------
-- Five adherence profiles, assigned by hash, so the registry contains up-to-date, partially
-- vaccinated, birth-dose-only and zero-dose cohorts rather than one uniform population. That
-- mix is what makes coverage, dropout and the defaulter list mean anything.
--
-- Two rules keep every dose clinically valid, because trg_record_validate checks each row:
--   * the jitter is constant per (child, vaccine), so shifting a whole antigen course cannot
--     violate a minimum interval — the catalog's own due dates already satisfy them;
--   * a dose whose jittered date lands in the future is simply not given yet. Clamping it to
--     today would compress the last dose of a course below its interval.
-- ORDER BY dose_number matters: the validator DOES see earlier rows of the same statement.
insert into vaccination_records (child_id, vaccine_id, dose_number, administered_by,
                                 administered_date, source, created_at)
select s.child_id, s.vaccine_id, s.dose_number,
       (array['a0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000006',
              'a0000000-0000-0000-0000-000000000007']::uuid[])[1 + (abs(hashtext(s.id::text)) % 3)],
       adm.d,
       case when (abs(hashtext('src' || s.id::text)) % 20) = 0 then 'card_transcribed'::dose_source
            when (abs(hashtext('src' || s.id::text)) % 20) = 1 then 'outreach'::dose_source
            else 'facility'::dose_source end,
       now() - ((abs(hashtext('c' || s.id::text)) % 300) || ' days')::interval
  from schedules s
  join children c on c.id = s.child_id
 cross join lateral (select abs(hashtext('adh' || c.id::text)) % 100 as p) adh
 cross join lateral (select (s.due_date + (abs(hashtext('j' || s.child_id::text || s.vaccine_id::text)) % 15))::date as d) adm
 where s.due_date <= current_date - 3
   and adm.d <= current_date
   and (
        (adh.p < 55)                                                              -- up to date
     or (adh.p >= 55 and adh.p < 75 and s.due_date <= c.date_of_birth + 100)      -- dropped out
     or (adh.p >= 75 and adh.p < 85 and s.due_date <= c.date_of_birth + 1)        -- birth doses only
     or (adh.p >= 93)                                                             -- complete
        -- 85..92 receive nothing at all: the zero-dose cohort.
   )
 order by s.child_id, s.vaccine_id, s.dose_number;

select public.reconcile_schedule_status();

-- Doses given on a day their facility ran a session belong to it (FR-29), and the busiest
-- dose-days become sessions so the tally is computed from real records.
insert into sessions (facility_id, location_id, location_path, type, status, session_date,
                      start_time, end_time, team_lead, target_children, created_by)
select d.facility_id, f.location_id, fl.path,
       (array['fixed','outreach']::session_type[])[1 + (abs(hashtext(d.facility_id::text || d.administered_date::text)) % 2)],
       'held', d.administered_date, '09:00', '13:00',
       'a0000000-0000-0000-0000-000000000002', d.n + 5,
       'a0000000-0000-0000-0000-000000000001'
  from (select r.facility_id, r.administered_date, count(*) n
          from vaccination_records r
         where r.facility_id is not null and r.administered_date >= current_date - 180
         group by 1,2 having count(*) >= 3
         order by count(*) desc limit 45) d
  join facilities f  on f.id = d.facility_id
  join locations  fl on fl.id = f.location_id
 where not exists (select 1 from sessions s
                    where s.facility_id = d.facility_id and s.session_date = d.administered_date);

update vaccination_records r set session_id = s.id
  from sessions s
 where s.facility_id = r.facility_id and s.session_date = r.administered_date
   and s.status <> 'cancelled' and r.session_id is null;

-- Spread the forward plan: the generator puts one session per facility on the same relative
-- day, which lands the entire future plan on a single date.
with spread as (
  select s.id, (row_number() over (order by s.facility_id, s.code) - 1)::int as n
    from sessions s where s.session_date >= current_date and s.status <> 'cancelled'
)
update sessions s
   set session_date = current_date + (spread.n % 18),
       status = case when (spread.n % 18) > 0 then 'planned'::session_status else s.status end
  from spread where s.id = spread.id;

-- ---------------------------------------------------------------------------
-- 11. THE DOSE → BATCH LINK, AND THE CONSUMPTION IT IMPLIES
-- ---------------------------------------------------------------------------
-- Only recent doses carry a batch. A registry that has been running longer than its ledger is
-- the normal case, and v_data_quality counts the doses that predate it.
update vaccination_records r
   set inventory_id = (
         select i.id from inventories i
           join facilities f  on f.id = i.facility_id
           join locations  fl on fl.id = f.location_id
          where i.vaccine_id = r.vaccine_id and i.stock_quantity > 0
            and i.expiry_date >= r.administered_date
            and r.location_path <@ fl.path
          order by i.expiry_date limit 1)
 where r.administered_date >= current_date - 120 and r.inventory_id is null and r.voided_at is null;

update vaccination_records r set batch_number = i.batch_number
  from inventories i where i.id = r.inventory_id and r.batch_number is null;

insert into stock_transactions (inventory_id, txn_type, quantity, reference_id, performed_by, occurred_at)
select r.inventory_id, 'administered', -1, r.id, r.administered_by, r.administered_date::timestamptz
  from vaccination_records r
 where r.inventory_id is not null and r.voided_at is null
on conflict (reference_id) where txn_type = 'administered' do nothing;

-- Open-vial is the largest wastage category in every routine programme.
insert into stock_transactions (inventory_id, txn_type, quantity, reason, performed_by, occurred_at, note)
select i.id, 'wastage', -(2 + (abs(hashtext('w' || i.id::text)) % 14)),
       (array['open_vial','open_vial','open_vial','vvm','breakage','expiry','frozen']::wastage_reason[])[1 + (abs(hashtext('wr' || i.id::text)) % 7)],
       'a0000000-0000-0000-0000-000000000004',
       now() - ((abs(hashtext('wd' || i.id::text)) % 80) || ' days')::interval,
       'সেশন শেষে অবশিষ্ট ডোজ ফেলে দেওয়া হয়েছে'
  from inventories i
 where i.stock_quantity > 40 and abs(hashtext('pick' || i.id::text)) % 3 = 0;

insert into stock_transactions (inventory_id, txn_type, quantity, performed_by, occurred_at, note)
select i.id, 'adjustment',
       case when abs(hashtext('adj' || i.id::text)) % 2 = 0 then 6 else -5 end,
       'a0000000-0000-0000-0000-000000000004',
       now() - ((abs(hashtext('adjd' || i.id::text)) % 40) || ' days')::interval,
       'ভৌত গণনার সঙ্গে মিলিয়ে সংশোধন'
  from inventories i
 where i.stock_quantity > 100 and abs(hashtext('apick' || i.id::text)) % 7 = 0;

-- ---------------------------------------------------------------------------
-- 12. LIFECYCLE, DUPLICATES, VOIDS, DEREGISTRATION
-- ---------------------------------------------------------------------------
update children c set status = v.st, status_reason = v.why
  from (select id,
               (array['moved_out','transferred','refused','deceased','aged_out']::child_status[])[1 + (abs(hashtext('st' || id::text)) % 5)] st,
               (array['পরিবার ঢাকায় স্থানান্তরিত হয়েছে','নিকটবর্তী কেন্দ্রে স্থানান্তরিত',
                      'অভিভাবক টিকা দিতে অসম্মত','শিশুটি মারা গেছে',
                      'বয়স নিয়মিত সূচির বাইরে']::text[])[1 + (abs(hashtext('st' || id::text)) % 5)] why
          from children where abs(hashtext('lifecycle' || id::text)) % 12 = 0) v
 where c.id = v.id;

-- Registered a second time at an outreach session by a worker who could not find the first
-- record — differing only by whitespace, which is exactly what normalise_name() collapses.
insert into children (id, full_name, date_of_birth, gender, guardian_id, created_by,
                      location_id, facility_id, created_at)
select ('b2000000-0000-0000-0000-' || lpad(row_number() over (order by c.child_id)::text, 12, '0'))::uuid,
       '  ' || c.full_name || ' ', c.date_of_birth, c.gender, c.guardian_id, c.created_by,
       c.location_id, c.facility_id, now() - interval '9 days'
  from children c
 where c.deleted_at is null and c.status = 'active'
 order by c.child_id limit 6;

update vaccination_records
   set voided_at = now() - interval '5 days',
       voided_by = 'a0000000-0000-0000-0000-000000000001',
       void_reason = 'ভুল শিশুর নামে রেকর্ড হয়েছিল — সংশোধন করা হয়েছে'
 where id in (select id from vaccination_records
               where voided_at is null and administered_date >= current_date - 90
               order by administered_date desc limit 9);

update children
   set deleted_at = now() - interval '3 days',
       deleted_by = 'a0000000-0000-0000-0000-000000000001',
       delete_reason = 'ভুল করে দুইবার নিবন্ধিত হয়েছিল'
 where id in (select id from children where deleted_at is null order by created_at desc limit 3);

-- ---------------------------------------------------------------------------
-- 13. AEFI — typed as a note on the dose, which raises the case (BS-12)
-- ---------------------------------------------------------------------------
update vaccination_records r
   set adverse_event = (array[
         'ইনজেকশনের স্থানে ফোলা ও ৩৮.৫° জ্বর, ২৪ ঘণ্টায় নিজে থেকেই কমে গেছে',
         'টিকার স্থানে লালচে ভাব ও ব্যথা, দুই দিন স্থায়ী ছিল',
         'উচ্চ জ্বর ১০৩°, হাসপাতালে ভর্তি করতে হয়েছে',
         'টিকা দেওয়ার পরপরই অজ্ঞান হয়ে যায়, ১৫ মিনিটে জ্ঞান ফিরে আসে',
         'খিঁচুনি, জরুরি বিভাগে নেওয়া হয়েছে',
         'সামান্য বমি ও খাওয়ায় অরুচি, চিকিৎসা লাগেনি'])[1 + (abs(hashtext('ae' || r.id::text)) % 6)]
 where r.voided_at is null and r.administered_date >= current_date - 200
   and abs(hashtext('aepick' || r.id::text)) % 47 = 0;

update aefi_cases set severity = case
    when symptoms like '%হাসপাতালে%' or symptoms like '%খিঁচুনি%' then 'serious'::aefi_severity
    when symptoms like '%অজ্ঞান%' or symptoms like '%১০৩%'       then 'severe'::aefi_severity
    else 'minor'::aefi_severity end;

update aefi_cases a set status = 'under_investigation',
       investigated_by = 'a0000000-0000-0000-0000-000000000003',
       investigation_note = 'অভিভাবকের সঙ্গে কথা বলা হয়েছে, ব্যাচ ও সংরক্ষণ তাপমাত্রা যাচাই চলছে।'
 where abs(hashtext('inv' || a.id::text)) % 4 = 1;

update aefi_cases a set status = 'classified',
       investigated_by = 'a0000000-0000-0000-0000-000000000003',
       investigation_note = 'তদন্ত সম্পন্ন। ব্যাচের অন্য কোনো শিশুর মধ্যে একই উপসর্গ পাওয়া যায়নি।',
       causality = (array['vaccine_product','immunization_error','immunization_anxiety',
                          'coincidental','unclassifiable','indeterminate']::aefi_causality[])[1 + (abs(hashtext('cz' || a.id::text)) % 6)],
       outcome   = (array['recovered','recovering','recovered_with_sequelae','not_recovered','unknown']::aefi_outcome[])[1 + (abs(hashtext('oc' || a.id::text)) % 5)]
 where abs(hashtext('inv' || a.id::text)) % 4 = 2;

update aefi_cases a set status = 'closed',
       investigated_by = 'a0000000-0000-0000-0000-000000000005',
       investigation_note = 'শ্রেণিবিন্যাস চূড়ান্ত, কেস বন্ধ করা হয়েছে।',
       causality = 'coincidental', outcome = 'recovered'
 where abs(hashtext('inv' || a.id::text)) % 4 = 3;

-- One serious case left past the 48-hour SLA, so investigation_overdue is not always false.
update aefi_cases
   set reported_at = now() - interval '5 days', status = 'reported',
       investigated_by = null, investigation_note = null, causality = null, closed_at = null
 where severity = 'serious'
   and id = (select id from aefi_cases where severity = 'serious' order by onset_date desc limit 1);

-- ---------------------------------------------------------------------------
-- 14. TRACING — raise the board, then walk the loop
-- ---------------------------------------------------------------------------
select public.generate_tracing_tasks(7);

update tracing_tasks set status = 'assigned', assigned_to = 'a0000000-0000-0000-0000-000000000002',
       due_by = current_date + 3
 where id in (select id from tracing_tasks where status='open' order by days_overdue_at_open desc limit 25);

-- Some are already late, which is what makes v_tracing_board.is_late worth rendering.
update tracing_tasks set status = 'assigned', assigned_to = 'a0000000-0000-0000-0000-000000000006',
       due_by = current_date - 2
 where id in (select id from tracing_tasks where status='open' order by days_overdue_at_open desc limit 12);

update tracing_tasks
   set status = 'visited',
       outcome = (array['vaccinated','appointment_given','not_found','unreachable']::tracing_outcome[])[1 + (abs(hashtext('o' || id::text)) % 4)],
       outcome_note = 'বাড়িতে গিয়ে অভিভাবকের সঙ্গে কথা বলা হয়েছে।'
 where id in (select id from tracing_tasks where status='assigned' order by assigned_at limit 14);

update tracing_tasks
   set status = 'closed', outcome = coalesce(outcome, 'vaccinated'),
       outcome_note = coalesce(outcome_note, 'পরবর্তী সেশনে টিকা দেওয়া হয়েছে।')
 where id in (select id from tracing_tasks where status='visited' order by visited_at limit 8);

-- ---------------------------------------------------------------------------
-- 15. COLD CHAIN
-- ---------------------------------------------------------------------------
-- The vaccine carrier is registered and never logged against: "silent" is the failure mode a
-- temperature log exists to catch, and the one a screen that only lists readings cannot show.
insert into cold_chain_devices (facility_id, name, kind, min_c, max_c)
select f.id, 'আইএলআর-১', 'ilr'::cold_chain_device_kind, 2.0, 8.0 from facilities f where f.is_store
union all
select f.id, 'ডিপ ফ্রিজার-১', 'deep_freezer'::cold_chain_device_kind, -25.0, -15.0 from facilities f where f.is_store
union all
select f.id, 'ভ্যাকসিন ক্যারিয়ার-১', 'vaccine_carrier'::cold_chain_device_kind, 2.0, 8.0
  from facilities f where f.code = 'FAC-000002';

-- Twice daily for a fortnight. The freezer sits near -20 and is CORRECT there — under a
-- hardcoded 2-8 rule every one of its readings would be flagged, which is how a store keeper
-- learns to ignore the alerts.
insert into cold_chain_readings (device_id, reading_at, temperature_c, recorded_by, action_taken)
select d.id, now() - ((h * 12) || ' hours')::interval,
       case when d.kind = 'deep_freezer'
              then (-20.0 + ((abs(hashtext(d.id::text || h::text)) % 40) / 10.0))::numeric(4,1)
            when (abs(hashtext('exc' || d.id::text || h::text)) % 23) = 0
              then (9.5 + ((abs(hashtext('e2' || d.id::text || h::text)) % 45) / 10.0))::numeric(4,1)
            else (2.5 + ((abs(hashtext(d.id::text || h::text)) % 50) / 10.0))::numeric(4,1) end,
       'a0000000-0000-0000-0000-000000000004',
       case when (abs(hashtext('exc' || d.id::text || h::text)) % 23) = 0
            then 'টিকা পাশের কেন্দ্রে সরানো হয়েছে, টেকনিশিয়ানকে জানানো হয়েছে' end
  from cold_chain_devices d
 cross join generate_series(0, 27) h
 where d.name <> 'ভ্যাকসিন ক্যারিয়ার-১';

-- ---------------------------------------------------------------------------
-- 16. REQUISITIONS — every state in the machine
-- ---------------------------------------------------------------------------
insert into requisitions (code, from_facility_id, to_facility_id, status, needed_by, note,
                          requested_by, requested_at, decided_by, decided_at, decision_note,
                          issued_at, received_at)
select 'REQ-9' || lpad(v.n::text, 5, '0'), fr.id, to_f.id, v.st, current_date + v.days, v.note,
       'a0000000-0000-0000-0000-000000000002', now() - (v.age || ' days')::interval,
       case when v.st <> 'submitted' then 'a0000000-0000-0000-0000-000000000005'::uuid end,
       case when v.st <> 'submitted' then now() - ((v.age - 1) || ' days')::interval end,
       case when v.st = 'rejected' then 'জেলা গুদামেও মজুদ নেই, পরবর্তী চালানের পর বিবেচনা করা হবে'
            when v.st in ('approved','issued','received') then 'মজুদ অনুযায়ী আংশিক অনুমোদিত' end,
       case when v.st in ('issued','received') then now() - ((v.age - 2) || ' days')::interval end,
       case when v.st = 'received' then now() - ((v.age - 3) || ' days')::interval end
  from (values
    (1,'submitted'::requisition_status, 5, 'আগামী সপ্তাহের আউটরিচ সেশনের জন্য', 3),
    (2,'submitted'::requisition_status, 9, 'পেন্টা প্রায় শেষ', 1),
    (3,'approved'::requisition_status,  2, 'নিয়মিত মাসিক চাহিদা', 6),
    (4,'approved'::requisition_status,  4, 'ক্যাম্পেইনের প্রস্তুতি', 5),
    (5,'rejected'::requisition_status, -1, 'জরুরি চাহিদা', 12),
    (6,'issued'::requisition_status,   -3, 'মাসিক বরাদ্দ', 14),
    (7,'received'::requisition_status, -8, 'গত মাসের বরাদ্দ', 22),
    (8,'cancelled'::requisition_status,-5, 'ভুল করে দুইবার পাঠানো হয়েছিল', 18)
  ) as v(n, st, days, note, age)
 cross join (select id from facilities where code = 'FAC-000002') fr
 cross join (select id from facilities where code = 'FAC-000001') to_f;

insert into requisition_lines (requisition_id, vaccine_id, quantity_requested, quantity_approved, quantity_issued)
select r.id, v.id,
       40 + (abs(hashtext(r.code || v.code)) % 160),
       case when r.status in ('approved','issued','received') then 30 + (abs(hashtext('a' || r.code || v.code)) % 120) end,
       case when r.status in ('issued','received')            then 30 + (abs(hashtext('a' || r.code || v.code)) % 120) end
  from requisitions r cross join vaccines v
 where abs(hashtext(r.code || v.code)) % 3 <> 0;

-- ---------------------------------------------------------------------------
-- 17. NOTIFICATIONS AND PREFERENCES
-- ---------------------------------------------------------------------------
insert into notification_preferences (guardian_id, sms_enabled, email_enabled, opted_out_at, opt_out_reason)
select g.id,
       (abs(hashtext('sms' || g.id::text)) % 9) <> 0,
       (abs(hashtext('eml' || g.id::text)) % 6) <> 0,
       case when abs(hashtext('opt' || g.id::text)) % 17 = 0 then now() - interval '20 days' end,
       case when abs(hashtext('opt' || g.id::text)) % 17 = 0 then 'অভিভাবক এসএমএস বন্ধ করতে বলেছেন' end
  from guardians g where abs(hashtext('pref' || g.id::text)) % 3 = 0;

select public.enqueue_reminders();

-- A delivery history, so every status the notifications screen filters on exists.
insert into notifications (child_id, guardian_id, recipient_id, channel, kind, status, attempts,
                           due_date, send_date, dose_count, recipient_to, scheduled_for, sent_at,
                           provider_ref, provider_status, last_error, template_key, template_version)
select c.id, c.guardian_id, g.user_id,
       (array['sms','email']::notification_channel[])[1 + (d % 2)],
       (array['due_soon','overdue']::notification_kind[])[1 + (abs(hashtext('k' || c.id::text || d::text)) % 2)],
       st.status, st.attempts, (current_date - d)::date, (current_date - d)::date,
       1 + (abs(hashtext('dc' || c.id::text || d::text)) % 3),
       case when (d % 2) = 0 then g.phone else coalesce(g.email, 'guardian@example.bd') end,
       (current_date - d)::timestamptz + interval '20 hours',
       case when st.status = 'sent' then (current_date - d)::timestamptz + interval '20 hours 3 minutes' end,
       case when st.status = 'sent' then 'prv_' || substr(md5(c.id::text || d::text), 1, 12) end,
       case when st.status = 'sent' then 'delivered' end,
       case when st.status = 'failed' then 'গেটওয়ে সাড়া দেয়নি (HTTP 504)'
            when st.status = 'dead'   then 'পাঁচবার চেষ্টার পরেও পাঠানো যায়নি' end,
       case when (abs(hashtext('k' || c.id::text || d::text)) % 2) = 1 then 'dose_overdue' else 'dose_due_soon' end, 1
  from children c
  join guardians g on g.id = c.guardian_id
 cross join generate_series(3, 26, 4) d
 cross join lateral (
    select case when (abs(hashtext('s' || c.id::text || d::text)) % 10) < 7 then 'sent'::notification_status
                when (abs(hashtext('s' || c.id::text || d::text)) % 10) < 8 then 'failed'::notification_status
                when (abs(hashtext('s' || c.id::text || d::text)) % 10) < 9 then 'dead'::notification_status
                else 'queued'::notification_status end as status,
           (abs(hashtext('at' || c.id::text || d::text)) % 5) as attempts) st
 where c.deleted_at is null and abs(hashtext('notif' || c.id::text)) % 4 = 0
on conflict (child_id, channel, kind, send_date) do nothing;

-- ---------------------------------------------------------------------------
-- 18. BREAK-GLASS
-- ---------------------------------------------------------------------------
insert into break_glass_access (user_id, child_id, reason, granted_at, expires_at, reviewed_by, reviewed_at)
select 'a0000000-0000-0000-0000-000000000002', c.id,
       'অন্য উপজেলা থেকে আসা শিশু আজকের সেশনে উপস্থিত, টিকার ইতিহাস দেখা প্রয়োজন',
       now() - ((c.rn * 3) || ' days')::interval,
       now() - ((c.rn * 3) || ' days')::interval + interval '4 hours',
       case when c.rn % 3 = 0 then 'a0000000-0000-0000-0000-000000000003'::uuid end,
       case when c.rn % 3 = 0 then now() - ((c.rn * 3 - 1) || ' days')::interval end
  from (select id, row_number() over (order by child_id) rn
          from children where deleted_at is null limit 7) c;

-- ---------------------------------------------------------------------------
-- 19. PUT THE GUARDS BACK, REFRESH THE READ MODELS
-- ---------------------------------------------------------------------------
alter table stock_transactions  enable trigger stock_immutable;
alter table cold_chain_readings enable trigger cold_chain_readings_immutable;
alter table children            enable trigger children_status_history;
alter table children            enable trigger children_delete_guard;
alter table vaccination_records enable trigger vaccination_records_void_guard;
alter table break_glass_access  enable trigger break_glass_limit;

refresh materialized view mv_daily_doses;
refresh materialized view mv_coverage_monthly;

-- Job health: a plausible last run for each, and one visibly stale so v_job_health.is_stale is
-- exercised rather than merely defined.
update job_runs set last_started_at = now() - interval '11 hours',
                    last_success_at = now() - interval '11 hours',
                    last_duration_ms = 200 + (abs(hashtext(job_name)) % 4000),
                    last_result = 'ok', runs_total = 40 + (abs(hashtext(job_name)) % 60),
                    failures_total = abs(hashtext(job_name)) % 3;
update job_runs set last_success_at = now() - interval '6 days',
                    last_error = 'গেটওয়ে সংযোগ ব্যর্থ', last_result = null, failures_total = 4
 where job_name = 'enqueue-reminders';

commit;

-- The cache must equal the ledger from the first minute, or the first nightly reconciliation
-- reports a defect that the seed itself created. Expected result: 0.
select public.reconcile_stock() as stock_rows_corrected;
