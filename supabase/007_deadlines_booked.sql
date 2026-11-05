-- Voting deadlines and booked flights.
-- Run once in Supabase → SQL Editor → New query → Run. Safe to run again.

-- When voting closes for each decision, e.g. {"date": "2026-11-14T03:00:00.000Z"}. When one passes,
-- the leading option is locked automatically.
alter table trips add column if not exists deadlines jsonb not null default '{}';

-- Whether someone has actually bought the flight they picked.
alter table members add column if not exists flight_booked boolean not null default false;

notify pgrst, 'reload schema';
