-- J.Tradebook migration v8
-- In-trade management journal: timestamped decisions (move stop, re-entry,
-- partial, note) each with a reason and optional screenshots.
-- Safe to re-run.

alter table trades add column if not exists manage_events jsonb not null default '[]'::jsonb;
