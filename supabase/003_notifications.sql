-- Foursome notifications. Run once in Supabase → SQL Editor → New query → Run. Safe to run more than once.

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
