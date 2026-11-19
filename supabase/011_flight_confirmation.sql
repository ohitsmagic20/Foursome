-- Flight confirmation codes, so everyone has theirs in the app. Only its owner is ever sent it.
-- Run once in Supabase → SQL Editor → New query → Run. Safe to run again.
alter table members add column if not exists flight_confirmation text;
notify pgrst, 'reload schema';
