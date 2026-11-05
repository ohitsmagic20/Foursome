-- Weekend availability and in-app feedback.
-- Run once in Supabase → SQL Editor → New query → Run. Safe to run again.

-- Weekends someone can't make it, as the Friday of each weekend ('2027-03-12').
-- null = hasn't answered yet; [] = free every weekend shown.
alter table members add column if not exists blackout jsonb;

-- Notes people send from the Feedback link.
create table if not exists feedback (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  message     text not null,
  email       text not null default '',
  path        text not null default '',
  trip_code   text not null default ''
);
create index if not exists feedback_at_idx on feedback(at);
alter table feedback enable row level security;

notify pgrst, 'reload schema';
