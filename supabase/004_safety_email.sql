-- Foresome: spam limits, email preferences, flexible trip lengths. Run once in Supabase → SQL Editor. Safe to run more than once.

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

notify pgrst, 'reload schema';
