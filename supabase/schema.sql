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
