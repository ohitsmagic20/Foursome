-- The Cup: two teams, a draft, match-play matches per round and their results.
-- Run once in Supabase → SQL Editor → New query → Run. Safe to run again.
alter table trips add column if not exists cup jsonb;
notify pgrst, 'reload schema';
