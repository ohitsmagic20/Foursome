-- Foursome accounts. Run once in Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.

-- One profile per person who signs in. `id` is the Supabase Auth user id.
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

-- Signed-in devices. The token is stored on the phone; signing out deletes the row.
create table if not exists sessions (
  token       text primary key,
  profile_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create index if not exists sessions_profile_idx on sessions(profile_id);

-- A trip member can belong to an account, so the trip follows them to any device.
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

notify pgrst, 'reload schema';
