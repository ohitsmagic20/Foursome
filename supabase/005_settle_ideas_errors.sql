-- Settle up, payment handles, shared trip ideas, and error log.
-- Run once in Supabase → SQL Editor → New query → Run. Safe to run again.

-- Money someone paid for the group (the house, a dinner, tee times). Split equally among `split_with`
-- (member ids), or among everyone on the trip when it's empty.
create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips(id) on delete cascade,
  paid_by     uuid not null references members(id) on delete cascade,
  amount      numeric not null check (amount > 0 and amount < 1000000),
  note        text not null default '',
  split_with  uuid[] not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists expenses_trip_idx on expenses(trip_id);
alter table expenses enable row level security;

-- Where to send someone money: their Venmo username and Cash App $cashtag.
alter table members  add column if not exists venmo   text not null default '';
alter table members  add column if not exists cashapp text not null default '';
alter table profiles add column if not exists venmo   text not null default '';
alter table profiles add column if not exists cashapp text not null default '';

-- Trips an organizer shared as a trip idea for other groups (courses and prices only; no names).
create table if not exists trip_ideas (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid unique references trips(id) on delete set null,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);
alter table trip_ideas enable row level security;

-- Errors people hit in the app, so the owner hears about them (kept 30 days by the daily job).
create table if not exists app_errors (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  source      text not null default 'client',
  message     text not null,
  path        text not null default '',
  detail      text not null default ''
);
create index if not exists app_errors_at_idx on app_errors(at);
alter table app_errors enable row level security;

notify pgrst, 'reload schema';
