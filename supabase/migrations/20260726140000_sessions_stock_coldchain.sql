-- ===========================================================================
-- SERVICE DELIVERY AND SUPPLY
--   sessions · the stock ledger · requisitions · the cold chain
-- ===========================================================================
-- Report decision D2 (second half) and D5, plus BS-03, BUG-04, FR-29 and FR-24…FR-28.
--
-- Round 1 answered *where* a dose happened by adding geography and facilities. It stopped one
-- step short of *when and at what event*, and left the stock number as a single mutable
-- integer. This migration closes both, and they are one migration rather than two because the
-- link between them is the point: a dose is given at a session, out of a batch, and the batch
-- balance is the consequence of the doses given. Modelling either half alone leaves the other
-- unreconcilable.
--
-- The three things it makes true, none of which were true before:
--
--   1. `vaccination_records.session_id` — a dose belongs to a service delivery event, so a
--      session tally is a query rather than a paper form.
--   2. `inventories.stock_quantity` stops being an authored value and becomes a *cache* of the
--      ledger. Nothing in the application may assign it; it moves only by `+ delta` inside a
--      trigger, under the row lock, which is the actual fix for BUG-04's lost update.
--   3. Wastage, expiry, FEFO and recall become answerable, because every movement of every
--      vial is a row with a reason and an actor.
--
-- What is deliberately NOT here: temperature sensor hardware (report §1.4), multi-echelon
-- forecasting, and vial-level (rather than batch-level) tracking. Batch is the granularity a
-- recall actually operates at.

-- ===========================================================================
-- 1. SESSIONS
-- ===========================================================================
-- An immunization session is the unit of work a programme plans, staffs, supplies and counts:
-- fixed-site sessions run on a weekly rota at a facility, outreach sessions travel to a ward
-- on a date, campaign sessions run outside the routine schedule entirely. Attributing doses to
-- a facility alone cannot distinguish "the clinic had a bad month" from "we cancelled four
-- outreach sessions in the haor", which is the operational question a supervisor asks.
create type session_type as enum (
  'fixed',      -- at the facility, on its routine rota
  'outreach',   -- the team travels to a ward or village
  'campaign'    -- supplementary immunization activity, outside the routine schedule
);

create type session_status as enum ('planned', 'held', 'cancelled');

create sequence public.session_code_seq start with 1;

create table sessions (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique
                   default 'SES-' || lpad(nextval('public.session_code_seq')::text, 6, '0'),
  -- Two different places, exactly as with facilities: the facility that *runs* the session and
  -- the location it is *held in*. For a fixed session they coincide; for outreach they do not,
  -- and reporting outreach against the facility's own ward is how a ward with no service at
  -- all comes to look served.
  facility_id    uuid not null references facilities(id) on delete restrict,
  location_id    uuid not null references locations(id)  on delete restrict,
  location_path  ltree not null,
  type           session_type   not null default 'fixed',
  status         session_status not null default 'planned',
  session_date   date not null,
  start_time     time,
  end_time       time,
  team_lead      uuid references profiles(id),
  target_children int check (target_children is null or target_children >= 0),
  notes          text check (notes is null or length(notes) <= 400),
  cancel_reason  text check (cancel_reason is null or length(cancel_reason) between 3 and 300),
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now(),
  constraint sessions_code_format check (code ~ '^SES-[0-9]{6}$'),
  constraint sessions_time_order  check (end_time is null or start_time is null or end_time > start_time),
  -- A cancelled session without a reason is indistinguishable from a data-entry slip, and the
  -- cancellation rate by reason is the number that gets outreach transport funded.
  constraint sessions_cancel_reason check (
    (status = 'cancelled') = (cancel_reason is not null)
  )
);

create index sessions_date_idx     on sessions (session_date desc);
create index sessions_facility_idx on sessions (facility_id, session_date desc);
create index sessions_location_gist on sessions using gist (location_path);
create index sessions_team_lead_idx on sessions (team_lead);
create index sessions_created_by_idx on sessions (created_by);
create index sessions_planned_idx   on sessions (session_date) where status = 'planned';

comment on table public.sessions is
  'A service delivery event: fixed, outreach or campaign. Doses attach to it, so the session '
  'tally is a query and the cancellation rate is measurable (report BS-03, FR-29).';

-- location_path is denormalised for the same reason it is on children: scoped RLS has to be a
-- GiST index probe, not a join. Stamped here so no caller can set it inconsistently.
create or replace function public.trg_session_location() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select l.path into new.location_path from locations l where l.id = new.location_id;
  if new.location_path is null then
    raise exception 'Unknown location for session';
  end if;
  return new;
end $$;

create trigger sessions_location before insert or update of location_id on sessions
  for each row execute function public.trg_session_location();

revoke execute on function public.trg_session_location() from anon, authenticated, public;

create trigger sessions_audit after insert or update or delete on sessions
  for each row execute function trg_admin_audit();

-- ---------------------------------------------------------------------------
-- FR-29: the dose knows its session
-- ---------------------------------------------------------------------------
alter table vaccination_records
  add column session_id uuid references sessions(id) on delete restrict;

create index vaccination_records_session_idx on vaccination_records (session_id)
  where session_id is not null;

-- Nullable, and it stays nullable: a dose transcribed from a family's home-based card was
-- given at a session this system never knew about, and forcing a fabricated session row to
-- exist for it would put a fictional service event into every tally. The constraint that does
-- hold is coherence — an attributed dose must match its session's date and facility, or the
-- tally and the daily total disagree and neither can be trusted.
create or replace function public.trg_record_session() returns trigger
language plpgsql set search_path = public as $$
declare s record;
begin
  if new.session_id is null then
    return new;
  end if;

  select * into s from sessions where id = new.session_id;
  if not found then
    raise exception 'Unknown session';
  end if;
  if s.status = 'cancelled' then
    raise exception 'Cannot record a dose against a cancelled session (%)', s.code;
  end if;
  if new.administered_date <> s.session_date then
    raise exception 'Dose date % does not match session % held on %',
      new.administered_date, s.code, s.session_date;
  end if;

  -- The session is the more specific fact, so it wins over the child's home facility that
  -- trg_record_location defaulted in.
  new.facility_id := s.facility_id;
  return new;
end $$;

-- AFTER record_location (alphabetical order on the same event: record_location < record_session
-- < record_validate), so it overrides the defaulted facility and is itself visible to
-- validation.
create trigger record_session before insert on vaccination_records
  for each row execute function public.trg_record_session();

-- A session that has recorded doses is held, whatever the planner last saved. Deriving this
-- rather than asking a worker to remember to flip a status is the difference between a
-- cancellation rate that means something and one that measures form-filling discipline.
create or replace function public.trg_session_held() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.session_id is not null then
    update sessions set status = 'held'
     where id = new.session_id and status = 'planned';
  end if;
  return null;
end $$;

create trigger record_session_held after insert on vaccination_records
  for each row execute function public.trg_session_held();

revoke execute on function public.trg_session_held() from anon, authenticated, public;

-- ===========================================================================
-- 2. THE STOCK LEDGER
-- ===========================================================================
-- BUG-04 was a lost update: two concurrent issues both read `stock_quantity`, both subtracted
-- from the value they read, and one of the two subtractions vanished. The fix is not a lock in
-- the application. It is to stop *authoring* the balance at all.
--
-- From here, `inventories.stock_quantity` is a cache of `sum(stock_transactions.quantity)`.
-- The only writer is the trigger below, and it writes `stock_quantity + new.quantity` — a
-- read-modify-write performed by Postgres inside the row lock it already takes, which cannot
-- lose an update no matter how many sessions run at once. `reconcile_stock()` proves the cache
-- still equals the ledger, and runs nightly.
create type stock_txn_type as enum (
  'receipt',       -- arrived from outside the system (national/district store, supplier)
  'transfer_in',   -- arrived from another facility in this system
  'transfer_out',  -- issued to another facility in this system
  'administered',  -- given to a child; written automatically from vaccination_records
  'wastage',       -- discarded; always with a reason
  'adjustment'     -- physical count correction, either direction, always with a note
);

create type wastage_reason as enum (
  'open_vial',   -- multi-dose vial discarded at the end of a session (the largest category)
  'vvm',         -- vaccine vial monitor at stage 3 or 4
  'breakage',
  'expiry',
  'frozen',      -- freeze-sensitive antigen exposed below 0 °C
  'other'
);

create table stock_transactions (
  id           uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references inventories(id) on delete restrict,
  -- Denormalised from the batch so a store keeper's RLS predicate and the ledger index do not
  -- both have to join. Stamped by trigger, never by the caller.
  facility_id  uuid references facilities(id) on delete restrict,
  txn_type     stock_txn_type not null,
  -- SIGNED, and the sign is derived from the type by a constraint rather than trusted from the
  -- caller. An 'administered' row with a positive quantity is not a typo to be tolerated; it is
  -- a batch balance that will never reconcile.
  quantity     int not null check (quantity <> 0),
  reason       wastage_reason,
  note         text check (note is null or length(note) between 3 and 300),
  -- What caused it: the dose record, the requisition, whatever the ledger is explaining.
  reference_id uuid,
  counterparty_facility_id uuid references facilities(id) on delete restrict,
  performed_by uuid not null references profiles(id),
  occurred_at  timestamptz not null default now(),
  constraint stock_txn_sign check (
    case txn_type
      when 'receipt'      then quantity > 0
      when 'transfer_in'  then quantity > 0
      when 'transfer_out' then quantity < 0
      when 'administered' then quantity < 0
      when 'wastage'      then quantity < 0
      when 'adjustment'   then true          -- a count correction goes either way
    end
  ),
  constraint stock_txn_reason check (
    (txn_type = 'wastage') = (reason is not null)
  ),
  -- An adjustment with no explanation is indistinguishable from a cover-up, and it is the one
  -- transaction type an auditor reads first.
  constraint stock_txn_adjustment_note check (
    txn_type <> 'adjustment' or note is not null
  )
);

create index stock_transactions_inventory_idx on stock_transactions (inventory_id, occurred_at desc);
create index stock_transactions_facility_idx  on stock_transactions (facility_id, occurred_at desc);
create index stock_transactions_type_idx      on stock_transactions (txn_type, occurred_at desc);
create index stock_transactions_performed_by_idx on stock_transactions (performed_by);
create index stock_transactions_counterparty_idx on stock_transactions (counterparty_facility_id);
-- One ledger row per dose, enforced rather than assumed: a retried insert must not debit the
-- batch twice.
create unique index stock_transactions_dose_key
  on stock_transactions (reference_id) where txn_type = 'administered';

comment on table public.stock_transactions is
  'The append-only stock ledger (report D5). inventories.stock_quantity is a cache of the sum '
  'of these rows; only trg_stock_apply writes it, and only as a delta. Nothing is ever '
  'deleted — a wrong movement is corrected by an opposing adjustment, so the history of the '
  'error survives.';

-- ---------------------------------------------------------------------------
-- The single writer of the cached balance
-- ---------------------------------------------------------------------------
create or replace function public.trg_stock_apply() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_new int;
begin
  -- Stamp the facility from the batch. Doing it here rather than trusting the caller keeps the
  -- RLS predicate on this table and the predicate on inventories talking about the same thing.
  select i.facility_id into new.facility_id from inventories i where i.id = new.inventory_id;

  -- The atomic part. `stock_quantity + new.quantity` is evaluated by Postgres while it holds
  -- the row's write lock, so two concurrent issues serialise instead of overwriting each other.
  update inventories
     set stock_quantity = stock_quantity + new.quantity,
         updated_at     = now()
   where id = new.inventory_id
  returning stock_quantity into v_new;

  if v_new is null then
    raise exception 'Unknown batch';
  end if;
  -- inventories.stock_quantity carries `check (stock_quantity >= 0)`, so an over-issue already
  -- fails. Catching it here first turns a constraint name into a sentence the store keeper can
  -- act on.
  if v_new < 0 then
    raise exception 'Not enough stock in this batch: % available, % requested',
      v_new - new.quantity, abs(new.quantity);
  end if;

  return new;
end $$;

create trigger stock_apply before insert on stock_transactions
  for each row execute function public.trg_stock_apply();

revoke execute on function public.trg_stock_apply() from anon, authenticated, public;

-- The ledger is append-only. Not by convention — by the absence of an UPDATE or DELETE policy
-- below, and by this, which also stops a table owner's stray statement.
--
-- Written against TG_TABLE_NAME so the temperature log can reuse it: both tables record what
-- happened, and editing either is rewriting evidence rather than correcting data.
create or replace function public.trg_append_only() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception
    '% is append-only. Correct a mistake by adding an opposing entry, not by editing history.',
    tg_table_name;
end $$;

create trigger stock_immutable before update or delete on stock_transactions
  for each row execute function public.trg_append_only();

-- ---------------------------------------------------------------------------
-- Doses move stock, automatically
-- ---------------------------------------------------------------------------
-- The link BUG-05 created (`vaccination_records.inventory_id`) becomes a real one here: a dose
-- out of a known batch debits that batch, and voiding the dose credits it back. A worker never
-- types a stock figure, which is the only way the ledger stays true in a field programme.
create or replace function public.trg_dose_stock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.inventory_id is null then
    return null;                     -- transcribed or externally-given dose: no batch to debit
  end if;

  insert into stock_transactions
    (inventory_id, txn_type, quantity, reference_id, performed_by, occurred_at, note)
  values
    (new.inventory_id, 'administered', -1, new.id, new.administered_by,
     new.administered_date::timestamptz, null)
  on conflict (reference_id) where txn_type = 'administered' do nothing;

  return null;
end $$;

create trigger record_stock after insert on vaccination_records
  for each row execute function public.trg_dose_stock();

revoke execute on function public.trg_dose_stock() from anon, authenticated, public;

create or replace function public.trg_dose_stock_void() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.voided_at is not null and old.voided_at is null and new.inventory_id is not null then
    -- An adjustment, not a 'return': the vial was opened and used. What is being corrected is
    -- the *record*, and saying so in the ledger is more honest than implying a vial came back.
    insert into stock_transactions
      (inventory_id, txn_type, quantity, reference_id, performed_by, note)
    values
      (new.inventory_id, 'adjustment', 1, new.id, coalesce(new.voided_by, auth.uid()),
       'ভুল রেকর্ড বাতিল — ' || coalesce(new.void_reason, ''));
  end if;
  return null;
end $$;

create trigger record_stock_void after update of voided_at on vaccination_records
  for each row execute function public.trg_dose_stock_void();

revoke execute on function public.trg_dose_stock_void() from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- Reconciliation — the check that makes the cache trustworthy
-- ---------------------------------------------------------------------------
-- A cached aggregate that is never verified is a cached aggregate that is wrong and nobody
-- knows. This recomputes every balance from the ledger, returns how many rows disagreed, and
-- runs nightly. A non-zero result is a defect, not routine drift; it is reported, not hidden.
create or replace function public.reconcile_stock() returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  with truth as (
    select i.id,
           coalesce((select sum(t.quantity) from stock_transactions t where t.inventory_id = i.id), 0)
             as ledger_qty
      from inventories i
  )
  update inventories i
     set stock_quantity = t.ledger_qty,
         updated_at     = now()
    from truth t
   where t.id = i.id
     and i.stock_quantity <> t.ledger_qty
     -- Batches that pre-date the ledger have no transactions at all and would be zeroed by a
     -- naive "sum is truth" rule. Their opening balance is migrated below as a receipt, so
     -- after this migration `no rows` and `zero` mean the same thing again.
     and exists (select 1 from stock_transactions s where s.inventory_id = i.id);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke execute on function public.reconcile_stock() from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- FEFO
-- ---------------------------------------------------------------------------
-- First-Expiry-First-Out, not first-in-first-out: what matters is which vial dies first, and
-- a batch received later can expire sooner. Issuing out of order is the single largest
-- avoidable source of expiry wastage in a routine programme.
create or replace function public.fefo_batch(p_vaccine_id uuid, p_facility_id uuid default null)
returns uuid
language sql stable security definer set search_path = public as $$
  select i.id
    from inventories i
   where i.vaccine_id = p_vaccine_id
     and i.stock_quantity > 0
     and i.expiry_date >= current_date
     and (p_facility_id is null or i.facility_id is not distinct from p_facility_id)
   order by i.expiry_date, i.stock_quantity desc
   limit 1
$$;

revoke execute on function public.fefo_batch(uuid, uuid) from anon, public;
grant  execute on function public.fefo_batch(uuid, uuid) to authenticated;

comment on function public.fefo_batch(uuid, uuid) is
  'The batch that should be opened next: earliest expiry with stock left, at this facility. '
  'Advisory — the UI defaults to it and a store keeper may override, because the vial in the '
  'carrier is a physical fact this function cannot see.';

-- ---------------------------------------------------------------------------
-- Opening balances
-- ---------------------------------------------------------------------------
-- Every batch that already carries a quantity gets one ledger row for it, so the ledger sums
-- to the balance from the first day and `reconcile_stock()` is meaningful immediately. Dated
-- to the batch's own updated_at rather than to now(), so a wastage rate computed over the last
-- month does not suddenly include the entire opening stock as a receipt today.
insert into stock_transactions
  (inventory_id, txn_type, quantity, performed_by, occurred_at, note)
select i.id,
       'receipt',
       i.stock_quantity,
       coalesce((select ur.user_id from user_roles ur where ur.role = 'admin' limit 1),
                (select p.id from profiles p limit 1)),
       i.updated_at,
       'মাইগ্রেশনের সময় নেওয়া প্রারম্ভিক মজুদ'
  from inventories i
 where i.stock_quantity > 0;

-- ===========================================================================
-- 3. REQUISITIONS
-- ===========================================================================
-- The other half of FR-25: stock does not only *move*, it is *asked for*. Without a request
-- record, a facility that ran out has no evidence it asked, and the store that failed to
-- supply has no queue. Five states, no draft — the form on the screen is the draft.
create type requisition_status as enum (
  'submitted', 'approved', 'rejected', 'issued', 'received', 'cancelled'
);

create sequence public.requisition_code_seq start with 1;

create table requisitions (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique
                    default 'REQ-' || lpad(nextval('public.requisition_code_seq')::text, 6, '0'),
  from_facility_id uuid not null references facilities(id) on delete restrict,  -- who is asking
  to_facility_id   uuid not null references facilities(id) on delete restrict,  -- the supplying store
  status          requisition_status not null default 'submitted',
  needed_by       date not null,
  note            text check (note is null or length(note) <= 300),
  requested_by    uuid not null references profiles(id),
  requested_at    timestamptz not null default now(),
  decided_by      uuid references profiles(id),
  decided_at      timestamptz,
  decision_note   text check (decision_note is null or length(decision_note) between 3 and 300),
  issued_at       timestamptz,
  received_at     timestamptz,
  constraint requisitions_code_format check (code ~ '^REQ-[0-9]{6}$'),
  constraint requisitions_not_self check (from_facility_id <> to_facility_id),
  -- A rejection with no reason is an unanswerable question for the facility that made the
  -- request, and it is the field the supply-chain review reads.
  constraint requisitions_rejection_note check (
    status <> 'rejected' or decision_note is not null
  ),
  constraint requisitions_decided check (
    (decided_by is null) = (decided_at is null)
  )
);

create index requisitions_from_idx   on requisitions (from_facility_id, requested_at desc);
create index requisitions_to_idx     on requisitions (to_facility_id, requested_at desc);
create index requisitions_open_idx   on requisitions (status) where status in ('submitted','approved');
create index requisitions_requested_by_idx on requisitions (requested_by);
create index requisitions_decided_by_idx   on requisitions (decided_by);

create table requisition_lines (
  requisition_id     uuid not null references requisitions(id) on delete cascade,
  vaccine_id         uuid not null references vaccines(id) on delete restrict,
  quantity_requested int not null check (quantity_requested > 0),
  quantity_approved  int check (quantity_approved >= 0),
  quantity_issued    int check (quantity_issued >= 0),
  -- Which batch was actually issued. Set at issue time, because the answer depends on what is
  -- in the store on the day, not on what was requested a week earlier.
  inventory_id       uuid references inventories(id) on delete restrict,
  primary key (requisition_id, vaccine_id)
);

create index requisition_lines_vaccine_idx   on requisition_lines (vaccine_id);
create index requisition_lines_inventory_idx on requisition_lines (inventory_id);

create trigger requisitions_audit after insert or update or delete on requisitions
  for each row execute function trg_admin_audit();

-- ---------------------------------------------------------------------------
-- Issuing — the one operation that must be a transaction, not three writes
-- ---------------------------------------------------------------------------
-- Issuing moves stock between two facilities. Done as three separate statements from the
-- application it can half-happen: the sending store debited, the receiving store never
-- credited, and a quantity of vaccine that exists nowhere. One function, one transaction.
--
-- The receiving side gets its own inventories row for the same batch number — same vaccine,
-- same batch, same expiry, different facility. That is exactly why 20260726110000 moved the
-- unique key to (facility, vaccine, batch).
create or replace function public.issue_requisition(p_requisition_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  r         record;
  ln        record;
  v_dest    uuid;
  v_actor   uuid := auth.uid();
  v_lines   int  := 0;
  v_qty     int;
begin
  select * into r from requisitions where id = p_requisition_id for update;
  if not found then
    raise exception 'Unknown requisition';
  end if;
  if r.status <> 'approved' then
    raise exception 'Only an approved requisition can be issued (this one is %)', r.status;
  end if;

  -- Authorization is checked here rather than left to RLS: this function is SECURITY DEFINER,
  -- so the policies on inventories and stock_transactions do not apply to what it writes. The
  -- rule is the same one those policies state — you may issue out of a store you hold.
  if not (
    r.to_facility_id = any (public.auth_facilities())
    or exists (select 1 from facilities f join locations l on l.id = f.location_id
                where f.id = r.to_facility_id and l.path <@ any (public.auth_scopes()))
  ) then
    raise exception 'You cannot issue stock from that store';
  end if;
  if not public.auth_has_role(array['store_keeper','supervisor','programme_manager','system_admin']::app_role[]) then
    raise exception 'Issuing stock requires a store keeper or above';
  end if;

  for ln in
    select * from requisition_lines
     where requisition_id = p_requisition_id
       and coalesce(quantity_approved, 0) > 0
  loop
    v_qty := ln.quantity_approved;

    -- FEFO by default. An explicitly chosen batch on the line wins, because the store keeper
    -- can see the shelf and this function cannot.
    v_dest := coalesce(ln.inventory_id, public.fefo_batch(ln.vaccine_id, r.to_facility_id));
    if v_dest is null then
      raise exception 'No usable batch of that vaccine in the issuing store';
    end if;

    -- Out of the supplying store. The balance check lives in trg_stock_apply, so an
    -- over-issue aborts the whole transaction rather than half-issuing the requisition.
    insert into stock_transactions
      (inventory_id, txn_type, quantity, reference_id, counterparty_facility_id, performed_by, note)
    values
      (v_dest, 'transfer_out', -v_qty, p_requisition_id, r.from_facility_id, v_actor, r.code);

    -- Into the receiving facility, same batch, its own row.
    insert into inventories (vaccine_id, batch_number, stock_quantity, expiry_date, facility_id)
    select i.vaccine_id, i.batch_number, 0, i.expiry_date, r.from_facility_id
      from inventories i where i.id = v_dest
    on conflict (coalesce(facility_id, '00000000-0000-0000-0000-000000000000'::uuid),
                 vaccine_id, batch_number) do nothing;

    insert into stock_transactions
      (inventory_id, txn_type, quantity, reference_id, counterparty_facility_id, performed_by, note)
    select i2.id, 'transfer_in', v_qty, p_requisition_id, r.to_facility_id, v_actor, r.code
      from inventories i1
      join inventories i2
        on i2.vaccine_id   = i1.vaccine_id
       and i2.batch_number = i1.batch_number
       and i2.facility_id  is not distinct from r.from_facility_id
     where i1.id = v_dest;

    update requisition_lines
       set quantity_issued = v_qty, inventory_id = v_dest
     where requisition_id = p_requisition_id and vaccine_id = ln.vaccine_id;

    v_lines := v_lines + 1;
  end loop;

  if v_lines = 0 then
    raise exception 'Nothing to issue: no line has an approved quantity';
  end if;

  update requisitions set status = 'issued', issued_at = now() where id = p_requisition_id;
  return v_lines;
end $$;

revoke execute on function public.issue_requisition(uuid) from anon, public;
grant  execute on function public.issue_requisition(uuid) to authenticated;

comment on function public.issue_requisition(uuid) is
  'Issues an approved requisition as one transaction: transfer_out at the supplying store, '
  'transfer_in at the receiver, lines stamped with the batch actually sent. Authorization is '
  'checked inside because SECURITY DEFINER bypasses the RLS that would otherwise state it.';

-- ===========================================================================
-- 4. THE COLD CHAIN
-- ===========================================================================
-- A vaccine held outside its temperature range is not a vaccine, and no screen in this system
-- could previously say whether any had been. Two tables: the equipment, and its readings.
--
-- The range lives on the device, not in a constant, because it genuinely differs: the routine
-- EPI range is +2 to +8 °C in an ILR, while a freezer holding OPV runs at −25 to −15 °C. One
-- hardcoded 2–8 would have flagged every correct freezer reading as an excursion, which is the
-- fastest way to teach a store keeper to ignore the alerts.
create type cold_chain_device_kind as enum (
  'ilr',              -- ice-lined refrigerator
  'deep_freezer',
  'vaccine_carrier',
  'cold_box',
  'walk_in_cooler'
);

create table cold_chain_devices (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete restrict,
  name        text not null check (length(name) between 1 and 80),
  kind        cold_chain_device_kind not null,
  min_c       numeric(4,1) not null default 2.0,
  max_c       numeric(4,1) not null default 8.0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (facility_id, name),
  constraint cold_chain_devices_range check (max_c > min_c)
);

create index cold_chain_devices_facility_idx on cold_chain_devices (facility_id)
  where is_active;

create table cold_chain_readings (
  id            uuid primary key default gen_random_uuid(),
  device_id     uuid not null references cold_chain_devices(id) on delete restrict,
  reading_at    timestamptz not null default now(),
  temperature_c numeric(4,1) not null check (temperature_c between -80 and 60),
  recorded_by   uuid not null references profiles(id),
  action_taken  text check (action_taken is null or length(action_taken) between 3 and 300),
  created_at    timestamptz not null default now()
);

create index cold_chain_readings_device_idx on cold_chain_readings (device_id, reading_at desc);
create index cold_chain_readings_recorded_by_idx on cold_chain_readings (recorded_by);

-- Readings are a record of what a thermometer said. Correcting one is rewriting evidence, so
-- the table is append-only for the same reason the stock ledger is.
create trigger cold_chain_readings_immutable before update or delete on cold_chain_readings
  for each row execute function public.trg_append_only();

comment on table public.cold_chain_readings is
  'Twice-daily temperature log (FR-27). Append-only. Excursion is derived per device from its '
  'own range in v_cold_chain, never from a hardcoded 2-8.';

create or replace view v_cold_chain
with (security_invoker = true) as
select d.id            as device_id,
       d.facility_id,
       f.name_bn       as facility_name_bn,
       d.name          as device_name,
       d.kind,
       d.min_c,
       d.max_c,
       d.is_active,
       last_reading.temperature_c as last_temperature_c,
       last_reading.reading_at    as last_reading_at,
       stats.readings_7d,
       stats.excursions_7d,
       -- The two failure modes, and they are different. An excursion is a device that reported
       -- a bad number. Silence is a device that reported nothing — worse, because a programme
       -- that stopped logging usually stopped looking as well.
       (stats.excursions_7d > 0)                                          as has_excursion,
       (last_reading.reading_at is null
        or last_reading.reading_at < now() - interval '24 hours')          as is_silent
  from cold_chain_devices d
  join facilities f on f.id = d.facility_id
  left join lateral (
    select r.temperature_c, r.reading_at
      from cold_chain_readings r
     where r.device_id = d.id
     order by r.reading_at desc
     limit 1
  ) last_reading on true
  left join lateral (
    select count(*)                                                        as readings_7d,
           count(*) filter (where r.temperature_c < d.min_c
                               or r.temperature_c > d.max_c)               as excursions_7d
      from cold_chain_readings r
     where r.device_id = d.id
       and r.reading_at >= now() - interval '7 days'
  ) stats on true;

comment on view public.v_cold_chain is
  'Per-device cold chain state: last reading, seven-day excursion count, and whether the '
  'device has gone silent. Silence is reported as loudly as an excursion (report FR-27).';

-- ===========================================================================
-- 5. STOCK REPORTING
-- ===========================================================================
-- Wastage rate, per WHO: doses wasted / doses issued for use, where "issued for use" is what
-- left the store to be given — the doses administered plus the doses wasted. Computing it
-- against doses administered alone (the intuitive denominator) understates it, and it is the
-- indicator that drives vial-size policy.
create or replace view v_stock_ledger
with (security_invoker = true) as
select t.id,
       t.occurred_at,
       t.txn_type,
       t.quantity,
       t.reason,
       t.note,
       t.reference_id,
       t.inventory_id,
       i.batch_number,
       i.expiry_date,
       i.stock_quantity                            as batch_balance,
       v.id                                        as vaccine_id,
       v.code                                      as vaccine_code,
       v.name_bn                                   as vaccine_name_bn,
       t.facility_id,
       f.name_bn                                   as facility_name_bn,
       cp.name_bn                                  as counterparty_name_bn,
       t.performed_by,
       p.full_name                                 as performed_by_name
  from stock_transactions t
  join inventories i on i.id = t.inventory_id
  join vaccines    v on v.id = i.vaccine_id
  left join facilities f  on f.id = t.facility_id
  left join facilities cp on cp.id = t.counterparty_facility_id
  left join profiles   p  on p.id = t.performed_by;

create or replace view v_stock_summary
with (security_invoker = true) as
select v.id      as vaccine_id,
       v.code    as vaccine_code,
       v.name_bn as vaccine_name_bn,
       i.facility_id,
       f.name_bn as facility_name_bn,
       sum(i.stock_quantity)                                                as on_hand,
       count(*) filter (where i.expiry_date < current_date
                          and i.stock_quantity > 0)                         as expired_batches,
       count(*) filter (where i.expiry_date >= current_date
                          and i.expiry_date < current_date + 30
                          and i.stock_quantity > 0)                         as expiring_batches,
       min(i.expiry_date) filter (where i.stock_quantity > 0)               as next_expiry,
       coalesce(-sum(w.wasted), 0)                                          as wasted_90d,
       coalesce(-sum(a.administered), 0)                                    as administered_90d,
       -- The N stays next to the rate, as everywhere else in this schema.
       case when coalesce(-sum(w.wasted), 0) + coalesce(-sum(a.administered), 0) > 0
            then coalesce(-sum(w.wasted), 0)::numeric
                 / (coalesce(-sum(w.wasted), 0) + coalesce(-sum(a.administered), 0))
       end                                                                  as wastage_rate_90d
  from inventories i
  join vaccines v on v.id = i.vaccine_id
  left join facilities f on f.id = i.facility_id
  left join lateral (
    select sum(t.quantity) as wasted from stock_transactions t
     where t.inventory_id = i.id and t.txn_type = 'wastage'
       and t.occurred_at >= now() - interval '90 days'
  ) w on true
  left join lateral (
    select sum(t.quantity) as administered from stock_transactions t
     where t.inventory_id = i.id and t.txn_type = 'administered'
       and t.occurred_at >= now() - interval '90 days'
  ) a on true
 group by v.id, v.code, v.name_bn, i.facility_id, f.name_bn;

comment on view public.v_stock_summary is
  'Stock position per vaccine per facility, with the WHO wastage rate over 90 days: '
  'wasted / (wasted + administered). Doses administered alone is the intuitive denominator '
  'and it is the wrong one.';

-- Session tally: what a supervisor signs at the end of a session, and what a paper form
-- exists to produce. One query replaces it.
create or replace view v_session_tally
with (security_invoker = true) as
select s.id            as session_id,
       s.code,
       s.session_date,
       s.type,
       s.status,
       s.facility_id,
       f.name_bn       as facility_name_bn,
       s.location_id,
       s.location_path,
       s.target_children,
       count(r.id) filter (where r.voided_at is null)                    as doses_given,
       count(distinct r.child_id) filter (where r.voided_at is null)     as children_served,
       count(r.id) filter (where r.voided_at is not null)                as doses_voided,
       count(r.id) filter (where r.voided_at is null
                             and r.adverse_event is not null)            as aefi_flagged
  from sessions s
  left join facilities f on f.id = s.facility_id
  left join vaccination_records r on r.session_id = s.id
 group by s.id, s.code, s.session_date, s.type, s.status, s.facility_id, f.name_bn,
          s.location_id, s.location_path, s.target_children;

-- ===========================================================================
-- 6. RLS
-- ===========================================================================
alter table sessions            enable row level security;
alter table stock_transactions  enable row level security;
alter table requisitions        enable row level security;
alter table requisition_lines   enable row level security;
alter table cold_chain_devices  enable row level security;
alter table cold_chain_readings enable row level security;

-- Sessions are the work plan. Every staff member in scope reads it — a worker has to know
-- where they are posted tomorrow — and a supervisor or above plans it.
create policy sessions_select on sessions for select using (
  (select auth_role()) in ('worker','admin')
  and location_path <@ any ((select auth_scopes()))
);
create policy sessions_insert on sessions for insert with check (
  (select auth_has_role(array['supervisor','programme_manager','system_admin']::app_role[]))
  and location_path <@ any ((select auth_scopes()))
);
create policy sessions_update on sessions for update
  using (
    (select auth_has_role(array['supervisor','programme_manager','system_admin']::app_role[]))
    and location_path <@ any ((select auth_scopes()))
  )
  with check (
    (select auth_has_role(array['supervisor','programme_manager','system_admin']::app_role[]))
    and location_path <@ any ((select auth_scopes()))
  );
create policy sessions_delete on sessions for delete using (
  (select auth_app_role()) = 'system_admin'
  and location_path <@ any ((select auth_scopes()))
);

-- The ledger follows the batch's visibility exactly: if you can see the stock you can see how
-- it got there. The predicate is written out per action rather than factored into a helper for
-- the reason 20260726110000 records — a helper taking facility_id becomes a per-row SubPlan.
create policy stock_transactions_select on stock_transactions for select using (
  (select auth_role()) in ('worker','admin')
  and (
    facility_id is null
    or facility_id = any ((select auth_facilities())::uuid[])
    or exists (select 1 from facilities f join locations l on l.id = f.location_id
                where f.id = stock_transactions.facility_id
                  and l.path <@ any ((select auth_scopes())))
  )
);

-- Writing to the ledger is a store keeper's act or above. `administered` rows are written by
-- the dose trigger under SECURITY DEFINER and do not pass through this policy, which is what
-- lets a field worker record a dose without holding stock rights.
create policy stock_transactions_insert on stock_transactions for insert with check (
  (select auth_has_role(array['store_keeper','supervisor','programme_manager','system_admin']::app_role[]))
  and performed_by = (select auth.uid())
  and exists (
    select 1 from inventories i
     where i.id = stock_transactions.inventory_id
       and (
         i.facility_id is null
         or i.facility_id = any ((select auth_facilities())::uuid[])
         or exists (select 1 from facilities f join locations l on l.id = f.location_id
                     where f.id = i.facility_id
                       and l.path <@ any ((select auth_scopes())))
       )
  )
);
-- No update policy and no delete policy. The ledger is append-only, and the absence of a
-- policy is how that is enforced for the client — the trigger is the belt to this braces.

-- A requisition is visible to both ends of it, which is the point: the requester needs to see
-- the decision and the store needs to see the queue.
create policy requisitions_select on requisitions for select using (
  (select auth_role()) in ('worker','admin')
  and exists (
    select 1 from facilities f join locations l on l.id = f.location_id
     where f.id in (requisitions.from_facility_id, requisitions.to_facility_id)
       and (f.id = any ((select auth_facilities())::uuid[]) or l.path <@ any ((select auth_scopes())))
  )
);
create policy requisitions_insert on requisitions for insert with check (
  (select auth_has_role(array['store_keeper','supervisor','programme_manager','system_admin']::app_role[]))
  and requested_by = (select auth.uid())
  and exists (
    select 1 from facilities f join locations l on l.id = f.location_id
     where f.id = requisitions.from_facility_id
       and (f.id = any ((select auth_facilities())::uuid[]) or l.path <@ any ((select auth_scopes())))
  )
);
-- Deciding is the supplying store's call, not the requester's. Restricting the UPDATE to the
-- supplying side is what stops a facility approving its own request.
create policy requisitions_update on requisitions for update
  using (
    (select auth_has_role(array['store_keeper','supervisor','programme_manager','system_admin']::app_role[]))
    and exists (
      select 1 from facilities f join locations l on l.id = f.location_id
       where f.id = requisitions.to_facility_id
         and (f.id = any ((select auth_facilities())::uuid[]) or l.path <@ any ((select auth_scopes())))
    )
  )
  with check (
    (select auth_has_role(array['store_keeper','supervisor','programme_manager','system_admin']::app_role[]))
    and exists (
      select 1 from facilities f join locations l on l.id = f.location_id
       where f.id = requisitions.to_facility_id
         and (f.id = any ((select auth_facilities())::uuid[]) or l.path <@ any ((select auth_scopes())))
    )
  );

-- Confirming receipt is the REQUESTER's act, and the policy above deliberately excludes them.
-- A second permissive UPDATE policy is how that one transition is granted without also handing
-- the requester the ability to approve their own request: the `using` clause pins the row's
-- current state to `issued` and the `with check` pins its next state to `received`, so this
-- policy authorises exactly one edge of the state machine and nothing else.
create policy requisitions_receive on requisitions for update
  using (
    status = 'issued'
    and exists (
      select 1 from facilities f join locations l on l.id = f.location_id
       where f.id = requisitions.from_facility_id
         and (f.id = any ((select auth_facilities())::uuid[]) or l.path <@ any ((select auth_scopes())))
    )
  )
  with check (
    status = 'received'
    and exists (
      select 1 from facilities f join locations l on l.id = f.location_id
       where f.id = requisitions.from_facility_id
         and (f.id = any ((select auth_facilities())::uuid[]) or l.path <@ any ((select auth_scopes())))
    )
  );

create policy requisition_lines_select on requisition_lines for select using (
  exists (select 1 from requisitions r where r.id = requisition_lines.requisition_id)
);
create policy requisition_lines_insert on requisition_lines for insert with check (
  exists (select 1 from requisitions r
           where r.id = requisition_lines.requisition_id
             and r.requested_by = (select auth.uid())
             and r.status = 'submitted')
);
-- Setting the approved quantity is the supplying store's decision, so the line follows the
-- same side as the decision itself. Without this, a requester could approve their own lines
-- and only the requisition's own status would stop them.
create policy requisition_lines_update on requisition_lines for update
  using (
    exists (select 1 from requisitions r
             join facilities f on f.id = r.to_facility_id
             join locations  l on l.id = f.location_id
            where r.id = requisition_lines.requisition_id
              and (f.id = any ((select auth_facilities())::uuid[])
                   or l.path <@ any ((select auth_scopes()))))
  )
  with check (
    exists (select 1 from requisitions r
             join facilities f on f.id = r.to_facility_id
             join locations  l on l.id = f.location_id
            where r.id = requisition_lines.requisition_id
              and (f.id = any ((select auth_facilities())::uuid[])
                   or l.path <@ any ((select auth_scopes()))))
  );

-- The line SELECT policy leans on requisitions_select being applied to its EXISTS subquery,
-- which it is: RLS applies to every table reference in a policy expression evaluated as the
-- invoking role. So a line is visible exactly when its requisition is.

create policy cold_chain_devices_select on cold_chain_devices for select using (
  (select auth_role()) in ('worker','admin')
  and (
    facility_id = any ((select auth_facilities())::uuid[])
    or exists (select 1 from facilities f join locations l on l.id = f.location_id
                where f.id = cold_chain_devices.facility_id
                  and l.path <@ any ((select auth_scopes())))
  )
);
create policy cold_chain_devices_insert on cold_chain_devices for insert with check (
  (select auth_has_role(array['store_keeper','supervisor','programme_manager','system_admin']::app_role[]))
  and exists (select 1 from facilities f join locations l on l.id = f.location_id
               where f.id = cold_chain_devices.facility_id
                 and l.path <@ any ((select auth_scopes())))
);
create policy cold_chain_devices_update on cold_chain_devices for update
  using (
    (select auth_has_role(array['store_keeper','supervisor','programme_manager','system_admin']::app_role[]))
    and exists (select 1 from facilities f join locations l on l.id = f.location_id
                 where f.id = cold_chain_devices.facility_id
                   and l.path <@ any ((select auth_scopes())))
  )
  with check (
    (select auth_has_role(array['store_keeper','supervisor','programme_manager','system_admin']::app_role[]))
    and exists (select 1 from facilities f join locations l on l.id = f.location_id
                 where f.id = cold_chain_devices.facility_id
                   and l.path <@ any ((select auth_scopes())))
  );

-- Anyone who can see the device can read its log, and any staff member at that facility can
-- add a reading. Logging is a twice-daily chore done by whoever is there; making it a
-- privileged act is how the log stops being kept.
create policy cold_chain_readings_select on cold_chain_readings for select using (
  exists (select 1 from cold_chain_devices d where d.id = cold_chain_readings.device_id)
);
create policy cold_chain_readings_insert on cold_chain_readings for insert with check (
  (select auth_role()) in ('worker','admin')
  and recorded_by = (select auth.uid())
  and exists (select 1 from cold_chain_devices d where d.id = cold_chain_readings.device_id)
);

-- ===========================================================================
-- 7. GRANTS
-- ===========================================================================
grant select                 on public.sessions            to authenticated;
grant insert, update, delete on public.sessions            to authenticated;
grant select, insert         on public.stock_transactions  to authenticated;
grant select, insert, update on public.requisitions        to authenticated;
grant select, insert, update on public.requisition_lines   to authenticated;
grant select, insert, update on public.cold_chain_devices  to authenticated;
grant select, insert         on public.cold_chain_readings to authenticated;
grant select on public.v_stock_ledger, public.v_stock_summary,
                public.v_session_tally, public.v_cold_chain to authenticated;

-- ===========================================================================
-- 8. THE NIGHTLY RECONCILIATION
-- ===========================================================================
insert into job_runs (job_name, expected_interval)
values ('reconcile-stock', interval '1 day')
on conflict (job_name) do nothing;

create or replace function public.job_reconcile_stock() returns void
language plpgsql security definer set search_path = public as $$
declare v_started timestamptz := public.job_begin('reconcile-stock'); v_n int;
begin
  v_n := public.reconcile_stock();
  -- Reported as an error when non-zero, deliberately. A cached balance that had drifted from
  -- its ledger is a defect somebody has to look at, not a nightly housekeeping statistic, and
  -- v_job_health is where it will be seen.
  if v_n > 0 then
    perform public.job_end('reconcile-stock', v_started, v_n || ' batches corrected',
                           v_n || ' batch balances disagreed with the ledger');
  else
    perform public.job_end('reconcile-stock', v_started, 'in balance');
  end if;
exception when others then
  perform public.job_end('reconcile-stock', v_started, null, sqlerrm);
  raise;
end $$;

revoke execute on function public.job_reconcile_stock() from anon, authenticated, public;

select cron.schedule('reconcile-stock', '45 2 * * *',
                     $cron$select public.job_reconcile_stock()$cron$);
