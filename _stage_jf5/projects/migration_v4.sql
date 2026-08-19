-- ============================================================================
-- J.TRADEBOOK V4 — MIGRATION (run AFTER migration_v3.sql)
-- Adds a per-trade audit log. Idempotent.
-- ============================================================================

alter table trades add column if not exists log jsonb default '[]'::jsonb;  -- [{time, text}]

-- ============================================================================
-- Done. New column: trades.log (timestamped audit trail per trade).
-- ============================================================================
