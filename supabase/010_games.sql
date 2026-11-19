-- Side games (skins, closest to the pin, long drive, Nassau); winnings go into Settle up.
-- Run once in Supabase → SQL Editor → New query → Run. Safe to run again.
alter table trips add column if not exists games jsonb;
notify pgrst, 'reload schema';
