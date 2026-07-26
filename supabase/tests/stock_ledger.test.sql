-- The gate for the stock ledger, the tracing loop and the AEFI workflow
-- (20260726140000 / 20260726160000; report D5, BUG-04, BS-04, BS-12).
--
-- The claim these migrations make is that `inventories.stock_quantity` stops being a number
-- anybody authors and becomes a consequence of the ledger — which is the actual fix for the
-- lost update, not a lock in the application. A claim like that is worth exactly what its test
-- is worth, so the ledger assertions come first and the impossible writes are asserted as
-- failures rather than inferred from the absence of a policy.
--
-- Run: supabase test db   (requires local `supabase start`)
begin;
select plan(16);

-- ---------------------------------------------------------------------------
-- Fixtures, inserted as postgres so RLS does not interfere with setup.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000001', 'keeper@example.com'),
  ('cccccccc-0000-0000-0000-000000000002', 'supervisor@example.com');

insert into profiles (id, full_name) values
  ('cccccccc-0000-0000-0000-000000000001', 'Store Keeper'),
  ('cccccccc-0000-0000-0000-000000000002', 'Supervisor');

insert into user_roles (user_id, role) values
  ('cccccccc-0000-0000-0000-000000000001', 'worker'),
  ('cccccccc-0000-0000-0000-000000000002', 'worker');

insert into facilities (id, name_bn, name_en, type, location_id, is_store)
values ('cccccccc-1111-0000-0000-000000000001', 'পরীক্ষা কেন্দ্র', 'Test Facility',
        'community_clinic', (select id from locations where path = 'bd.dhaka.gazipur.kaliakair'),
        true);

insert into user_assignments (user_id, role, location_id, facility_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'store_keeper',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair'),
   'cccccccc-1111-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000002', 'supervisor',
   (select id from locations where path = 'bd.dhaka.gazipur.kaliakair'), null);

insert into vaccines (id, code, name_bn, name_en, total_doses)
values ('cccccccc-2222-0000-0000-000000000001', 'TESTV', 'পরীক্ষা টিকা', 'Test Vaccine', 1);

insert into vaccine_doses (vaccine_id, dose_number, recommended_age_days, min_interval_days)
values ('cccccccc-2222-0000-0000-000000000001', 1, 0, 0);

insert into inventories (id, vaccine_id, batch_number, stock_quantity, expiry_date, facility_id)
values ('cccccccc-3333-0000-0000-000000000001', 'cccccccc-2222-0000-0000-000000000001',
        'TEST-B1', 0, current_date + 200, 'cccccccc-1111-0000-0000-000000000001');

-- ---------------------------------------------------------------------------
-- 1. THE BALANCE IS A CONSEQUENCE OF THE LEDGER
-- ---------------------------------------------------------------------------
insert into stock_transactions (inventory_id, txn_type, quantity, performed_by)
values ('cccccccc-3333-0000-0000-000000000001', 'receipt', 100,
        'cccccccc-0000-0000-0000-000000000001');

select is(
  (select stock_quantity from inventories where id = 'cccccccc-3333-0000-0000-000000000001'),
  100,
  'a receipt moves the cached balance without anyone authoring it'
);

insert into stock_transactions (inventory_id, txn_type, quantity, reason, performed_by)
values ('cccccccc-3333-0000-0000-000000000001', 'wastage', -10, 'open_vial',
        'cccccccc-0000-0000-0000-000000000001');

select is(
  (select stock_quantity from inventories where id = 'cccccccc-3333-0000-0000-000000000001'),
  90,
  'wastage debits the same cache'
);

select is(
  (select stock_quantity from inventories where id = 'cccccccc-3333-0000-0000-000000000001'),
  (select sum(quantity)::int from stock_transactions
    where inventory_id = 'cccccccc-3333-0000-0000-000000000001'),
  'the cached balance equals the sum of the ledger — the invariant reconcile_stock() checks'
);

-- ---------------------------------------------------------------------------
-- 2. THE SIGN IS A PROPERTY OF THE TYPE, NOT OF THE CALLER
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into stock_transactions (inventory_id, txn_type, quantity, performed_by)
    values ('cccccccc-3333-0000-0000-000000000001', 'receipt', -5,
            'cccccccc-0000-0000-0000-000000000001')$$,
  '23514',
  null,
  'a receipt cannot be negative'
);

select throws_ok(
  $$insert into stock_transactions (inventory_id, txn_type, quantity, reason, performed_by)
    values ('cccccccc-3333-0000-0000-000000000001', 'wastage', 5, 'breakage',
            'cccccccc-0000-0000-0000-000000000001')$$,
  '23514',
  null,
  'wastage cannot be positive — a balance that will never reconcile is not a typo to tolerate'
);

select throws_ok(
  $$insert into stock_transactions (inventory_id, txn_type, quantity, performed_by)
    values ('cccccccc-3333-0000-0000-000000000001', 'wastage', -1,
            'cccccccc-0000-0000-0000-000000000001')$$,
  '23514',
  null,
  'wastage without a reason is refused'
);

select throws_ok(
  $$insert into stock_transactions (inventory_id, txn_type, quantity, performed_by)
    values ('cccccccc-3333-0000-0000-000000000001', 'adjustment', 5,
            'cccccccc-0000-0000-0000-000000000001')$$,
  '23514',
  null,
  'an adjustment without a note is refused — it is the first row an auditor reads'
);

-- ---------------------------------------------------------------------------
-- 3. OVER-ISSUE AND IMMUTABILITY
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into stock_transactions (inventory_id, txn_type, quantity, performed_by)
    values ('cccccccc-3333-0000-0000-000000000001', 'transfer_out', -1000,
            'cccccccc-0000-0000-0000-000000000001')$$,
  null,
  null,
  'issuing more than the batch holds is refused rather than driving the balance negative'
);

select throws_ok(
  $$update stock_transactions set quantity = 1
     where inventory_id = 'cccccccc-3333-0000-0000-000000000001'$$,
  null,
  null,
  'the ledger cannot be edited'
);

select throws_ok(
  $$delete from stock_transactions
     where inventory_id = 'cccccccc-3333-0000-0000-000000000001'$$,
  null,
  null,
  'the ledger cannot be deleted from — a mistake is corrected by an opposing entry'
);

-- ---------------------------------------------------------------------------
-- 4. A DOSE DEBITS ITS BATCH
-- ---------------------------------------------------------------------------
insert into guardians (id, full_name, phone, location_id, created_by)
values ('cccccccc-4444-0000-0000-000000000001', 'Test Guardian', '+8801700000001',
        (select id from locations where path = 'bd.dhaka.gazipur.kaliakair'),
        'cccccccc-0000-0000-0000-000000000002');

insert into children (id, full_name, date_of_birth, gender, guardian_id, created_by, location_id)
values ('cccccccc-5555-0000-0000-000000000001', 'Test Child', current_date - 400, 'female',
        'cccccccc-4444-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002',
        (select id from locations where path = 'bd.dhaka.gazipur.kaliakair'));

insert into vaccination_records
  (id, child_id, vaccine_id, dose_number, administered_by, administered_date, inventory_id)
values ('cccccccc-6666-0000-0000-000000000001', 'cccccccc-5555-0000-0000-000000000001',
        'cccccccc-2222-0000-0000-000000000001', 1, 'cccccccc-0000-0000-0000-000000000002',
        current_date, 'cccccccc-3333-0000-0000-000000000001');

select is(
  (select stock_quantity from inventories where id = 'cccccccc-3333-0000-0000-000000000001'),
  89,
  'recording a dose out of a known batch debits it, with no store keeper typing a figure'
);

select is(
  (select count(*)::int from stock_transactions
    where reference_id = 'cccccccc-6666-0000-0000-000000000001' and txn_type = 'administered'),
  1,
  'exactly one administered row per dose'
);

-- ---------------------------------------------------------------------------
-- 5. VOIDING A DOSE CREDITS THE BATCH BACK
-- ---------------------------------------------------------------------------
update vaccination_records
   set voided_at = now(), voided_by = 'cccccccc-0000-0000-0000-000000000002',
       void_reason = 'recorded against the wrong child'
 where id = 'cccccccc-6666-0000-0000-000000000001';

select is(
  (select stock_quantity from inventories where id = 'cccccccc-3333-0000-0000-000000000001'),
  90,
  'voiding a dose writes a compensating adjustment, so the batch follows the correction'
);

-- ---------------------------------------------------------------------------
-- 6. SESSION COHERENCE
-- ---------------------------------------------------------------------------
insert into sessions (id, facility_id, location_id, type, session_date, created_by)
values ('cccccccc-7777-0000-0000-000000000001', 'cccccccc-1111-0000-0000-000000000001',
        (select id from locations where path = 'bd.dhaka.gazipur.kaliakair'),
        'fixed', current_date - 3, 'cccccccc-0000-0000-0000-000000000002');

select throws_ok(
  $$insert into vaccination_records
      (child_id, vaccine_id, dose_number, administered_by, administered_date, session_id)
    values ('cccccccc-5555-0000-0000-000000000001', 'cccccccc-2222-0000-0000-000000000001',
            1, 'cccccccc-0000-0000-0000-000000000002', current_date,
            'cccccccc-7777-0000-0000-000000000001')$$,
  null,
  null,
  'a dose attributed to a session must share its date, or the tally and the daily total disagree'
);

-- ---------------------------------------------------------------------------
-- 7. THE TRACING LOOP CLOSES ON THE CHILD, NOT ONLY ON THE TASK
-- ---------------------------------------------------------------------------
insert into tracing_tasks (id, child_id, location_path)
values ('cccccccc-8888-0000-0000-000000000001', 'cccccccc-5555-0000-0000-000000000001',
        'bd.dhaka.gazipur.kaliakair');

select throws_ok(
  $$update tracing_tasks set status = 'closed'
     where id = 'cccccccc-8888-0000-0000-000000000001'$$,
  '23514',
  null,
  'a task cannot be closed without an outcome — that is clearing a list, not finishing a loop'
);

update tracing_tasks
   set status = 'closed', outcome = 'moved_away', outcome_note = 'family left the catchment'
 where id = 'cccccccc-8888-0000-0000-000000000001';

select is(
  (select status::text from children where id = 'cccccccc-5555-0000-0000-000000000001'),
  'moved_out',
  'a moved-away outcome moves the child too, so next month does not trace them again'
);

-- ---------------------------------------------------------------------------
-- 8. AEFI CANNOT BE CLASSIFIED WITHOUT A CLASSIFICATION
-- ---------------------------------------------------------------------------
insert into aefi_cases (id, child_id, location_path, onset_date, symptoms, reported_by)
values ('cccccccc-9999-0000-0000-000000000001', 'cccccccc-5555-0000-0000-000000000001',
        'bd.dhaka.gazipur.kaliakair', current_date - 1, 'fever and swelling',
        'cccccccc-0000-0000-0000-000000000002');

select throws_ok(
  $$update aefi_cases set status = 'classified'
     where id = 'cccccccc-9999-0000-0000-000000000001'$$,
  '23514',
  null,
  'a classified case must carry a WHO causality — this is what stops the workflow degenerating '
  'back into the text box it replaced'
);

select * from finish();
rollback;
