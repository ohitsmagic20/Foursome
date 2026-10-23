-- Foursome database schema.
-- Run this once in Supabase → SQL Editor → New query → Run.

create extension if not exists pgcrypto;

-- One row per golf trip. `code` is the unguessable part of the invite link.
create table if not exists trips (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  nights      int  not null default 3 check (nights between 1 and 10),
  deposit     int  not null default 0,
  food        int  not null default 200,      -- food and extras estimate per person
  created_at  timestamptz not null default now()
);

-- Everyone on the trip. `token` is a secret stored on that person's phone; it is how the app knows who is voting.
create table if not exists members (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references trips(id) on delete cascade,
  token            text not null unique,
  name             text not null,
  airport          text not null default '',
  budget           int  not null default 0,
  bed              text not null default 'own' check (bed in ('own','share')),
  is_organizer     boolean not null default false,
  paid             boolean not null default false,
  -- The flight this person picked (from search or entered by hand).
  flight_price     numeric,
  flight_summary   text,
  flight_arrive_at text,          -- local arrival time at destination, ISO string
  flight_depart_at text,          -- local departure time for the trip home, ISO string
  created_at       timestamptz not null default now()
);
create index if not exists members_trip_idx on members(trip_id);

-- Everything the group votes on is an option of a kind:
--   date        data: { "start": "2027-03-11" }
--   destination data: { "name": "Myrtle Beach, SC", "airport": "MYR" }
--   lodging     data: { "name", "url", "image", "total", "bedrooms", "beds" }
--   round       data: { "course", "day", "time", "fee", "booked", "checked" }
create table if not exists options (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips(id) on delete cascade,
  kind        text not null check (kind in ('date','destination','lodging','round')),
  data        jsonb not null default '{}'::jsonb,
  locked      boolean not null default false,
  created_by  uuid references members(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists options_trip_idx on options(trip_id);

create table if not exists votes (
  option_id  uuid not null references options(id) on delete cascade,
  member_id  uuid not null references members(id) on delete cascade,
  value      text not null check (value in ('yes','maybe','no')),
  updated_at timestamptz not null default now(),
  primary key (option_id, member_id)
);

-- The app talks to the database only from its own server with the secret key.
-- Row level security with no policies blocks direct access from browsers.
alter table trips   enable row level security;
alter table members enable row level security;
alter table options enable row level security;
alter table votes   enable row level security;

-- Accounts (also in 002_accounts.sql for projects created before accounts existed).
create table if not exists profiles (
  id          uuid primary key,
  email       text not null unique,
  name        text not null default '',
  phone       text not null default '',
  home_city   text not null default '',
  airport     text not null default '',
  budget      int  not null default 0,
  bed         text not null default 'own' check (bed in ('own','share')),
  created_at  timestamptz not null default now()
);
create table if not exists sessions (
  token       text primary key,
  profile_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create index if not exists sessions_profile_idx on sessions(profile_id);
alter table members add column if not exists profile_id uuid references profiles(id) on delete set null;
create index if not exists members_profile_idx on members(profile_id);
create unique index if not exists members_trip_profile_uniq on members(trip_id, profile_id) where profile_id is not null;
alter table profiles enable row level security;
alter table sessions enable row level security;

-- Sign-in links: the device that asked waits on `nonce`; opening the emailed link (in any browser) fills `session`.
create table if not exists login_requests (
  nonce       text primary key,
  email       text not null,
  session     text,
  created_at  timestamptz not null default now()
);
alter table login_requests enable row level security;

-- App-wide settings the server manages itself (the notification signing keys are generated on first use).
create table if not exists app_settings (
  key    text primary key,
  value  text not null
);

-- One row per phone that turned on notifications for a trip.
create table if not exists push_subs (
  endpoint    text not null,
  member_id   uuid not null references members(id) on delete cascade,
  trip_id     uuid not null references trips(id) on delete cascade,
  sub         jsonb not null,
  last_sent   timestamptz,
  created_at  timestamptz not null default now(),
  primary key (endpoint, trip_id)
);
create index if not exists push_subs_trip_idx on push_subs(trip_id);

-- When the organizer last nudged the group (so nudges can't be spammed).
alter table trips add column if not exists last_nudge timestamptz;

alter table app_settings enable row level security;
alter table push_subs enable row level security;

notify pgrst, 'reload schema';
-- One row per rate-limited action (sign-in emails, new trips, guest joins). Old rows are deleted daily.
create table if not exists rate_events (
  id      bigint generated always as identity primary key,
  bucket  text not null,
  at      timestamptz not null default now()
);
create index if not exists rate_events_bucket_at on rate_events(bucket, at);
alter table rate_events enable row level security;

-- Whether a signed-in person wants reminder emails.
alter table profiles add column if not exists email_updates boolean not null default true;

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
