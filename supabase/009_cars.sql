-- Rental cars: each with a total and who rides in it; the total splits between the riders.
-- Run once in Supabase → SQL Editor → New query → Run. Safe to run again.
alter table trips add column if not exists cars jsonb;
notify pgrst, 'reload schema';
