-- VaxTrace schema: enums, extensions, tables, constraints, indexes.
-- Source: VaxTrace_Engineering_Handbook.md §8.2-8.3 (verbatim).

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_cron;    -- scheduled scans (Supabase-managed)

create type user_role            as enum ('parent', 'worker', 'admin');
create type child_gender         as enum ('male', 'female', 'other');
create type schedule_status      as enum ('pending', 'done', 'missed');
create type notification_channel as enum ('sms', 'email');
create type notification_status  as enum ('queued', 'sent', 'failed', 'dead');

-- IDENTITY ---------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null check (length(full_name) between 1 and 120),
  contact      text,                       -- phone (E.164) or email display
  locale       text not null default 'bn' check (locale in ('bn','en')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table user_roles (
  user_id  uuid not null references auth.users(id) on delete cascade,
  role     user_role not null,
  primary key (user_id, role)
);
-- Read by the Custom Access Token Hook to stamp the JWT `user_role` claim.

-- CATALOG ----------------------------------------------------------------
create table vaccines (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,      -- e.g. 'BCG','PENTA','OPV'
  name_bn       text not null,
  name_en       text not null,
  total_doses   int not null check (total_doses between 1 and 10),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table vaccine_doses (
  vaccine_id           uuid not null references vaccines(id) on delete cascade,
  dose_number          int  not null check (dose_number >= 1),
  recommended_age_days int  not null check (recommended_age_days >= 0),
  min_interval_days    int  not null default 0 check (min_interval_days >= 0),
  primary key (vaccine_id, dose_number)
);

-- CHILDREN ---------------------------------------------------------------
create table children (
  id               uuid primary key default gen_random_uuid(),
  full_name        text not null check (length(full_name) between 1 and 120),
  date_of_birth    date not null check (date_of_birth <= current_date),
  gender           child_gender not null,
  guardian_id      uuid not null references profiles(id) on delete restrict,
  guardian_contact text,
  created_by       uuid references profiles(id),   -- worker or guardian who registered
  created_at       timestamptz not null default now()
);
create index on children (guardian_id);

-- SCHEDULES (generated from catalog at registration) ---------------------
create table schedules (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references children(id) on delete cascade,
  vaccine_id   uuid not null references vaccines(id),
  dose_number  int  not null check (dose_number >= 1),
  due_date     date not null,
  status       schedule_status not null default 'pending',
  created_at   timestamptz not null default now(),
  unique (child_id, vaccine_id, dose_number)      -- one schedule row per dose per child
);
create index on schedules (status, due_date);      -- the reminder-scan index
create index on schedules (child_id);

-- ADMINISTERED DOSES -----------------------------------------------------
create table vaccination_records (
  id                uuid primary key default gen_random_uuid(),
  child_id          uuid not null references children(id) on delete restrict,
  vaccine_id        uuid not null references vaccines(id),
  dose_number       int  not null check (dose_number >= 1),
  administered_by   uuid not null references profiles(id),
  administered_date date not null default current_date check (administered_date <= current_date),
  next_due_date     date,
  batch_number      text,
  created_at        timestamptz not null default now(),
  unique (child_id, vaccine_id, dose_number)       -- a dose is administered at most once
);
create index on vaccination_records (child_id);

-- INVENTORY --------------------------------------------------------------
create table inventories (
  id             uuid primary key default gen_random_uuid(),
  vaccine_id     uuid not null references vaccines(id),
  batch_number   text not null,
  stock_quantity int  not null check (stock_quantity >= 0),
  expiry_date    date not null,
  updated_at     timestamptz not null default now(),
  unique (vaccine_id, batch_number)
);
create index on inventories (vaccine_id, expiry_date);

-- NOTIFICATIONS (durable work list = queue) ------------------------------
create table notifications (
  id            uuid primary key default gen_random_uuid(),
  schedule_id   uuid not null references schedules(id) on delete cascade,
  recipient_id  uuid not null references profiles(id),
  channel       notification_channel not null,
  status        notification_status not null default 'queued',
  attempts      int not null default 0,
  due_date      date not null,
  scheduled_for timestamptz not null default now(),
  sent_at       timestamptz,
  provider_ref  text,
  last_error    text,
  unique (schedule_id, channel, due_date)          -- IDEMPOTENCY: at most one per day per channel
);
create index on notifications (status, scheduled_for);

-- AUDIT ------------------------------------------------------------------
create table audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  action     text not null,             -- 'dose.record','dose.correct','role.grant',...
  entity     text not null,
  entity_id  uuid,
  before     jsonb,
  after      jsonb,
  at         timestamptz not null default now()
);
create index on audit_log (entity, entity_id);
