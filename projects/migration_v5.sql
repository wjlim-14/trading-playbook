-- J.Tradebook migration v5
-- Flexible, timeframe-tagged chart screenshots + per-trade High/Low timeframes.
-- Safe to re-run (IF NOT EXISTS). Old pre_chart_url_* / post_chart_url_* columns
-- are kept; the app migrates them into pre_shots/post_shots automatically on read.

alter table trades add column if not exists tf_high   text;
alter table trades add column if not exists tf_low    text;
alter table trades add column if not exists pre_shots  jsonb not null default '[]'::jsonb;
alter table trades add column if not exists post_shots jsonb not null default '[]'::jsonb;

-- Backfill sensible defaults for existing rows
update trades set tf_high = coalesce(tf_high, '4h'),
                  tf_low  = coalesce(tf_low,  '1h');
