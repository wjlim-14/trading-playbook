-- ============================================================================
-- J.TRADEBOOK V3 — MIGRATION (run AFTER migration_v2.sql)
-- Adds: account asset-class + LIVE/BACKTEST scope, trade fills (partial exits),
-- executed size, and the 4 fixed backtest accounts.
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ── accounts: asset class + environment ──
alter table accounts add column if not exists asset_class text default 'US_STOCK';  -- MY_STOCK | US_STOCK | CRYPTO | FOREX
alter table accounts add column if not exists env         text default 'LIVE';       -- LIVE | BACKTEST

-- ── trades: fills model + actual executed size ──
alter table trades add column if not exists entries        jsonb   default '[]'::jsonb;  -- [{size,price,time,note}]
alter table trades add column if not exists exits          jsonb   default '[]'::jsonb;  -- [{size,price,time,note}]
alter table trades add column if not exists executed_size  numeric;                       -- actual size you executed
alter table trades add column if not exists avg_entry      numeric;                       -- size-weighted average entry
alter table trades add column if not exists open_size      numeric;                       -- remaining open size
alter table trades add column if not exists contract_value numeric;                       -- per-lot override (forex/CFD)
-- status may now be PLANNING | ACTIVE | PARTIAL | CLOSED (column already text)

-- ── the 4 fixed BACKTEST accounts (created once) ──
insert into accounts (name, broker, account_type, asset_class, env, currency, initial_balance, current_balance)
select v.name, v.broker, v.account_type, v.asset_class, 'BACKTEST', v.currency, v.bal, v.bal
from (values
  ('Backtest — Malaysia Stock', 'Bursa',   'PERSONAL_SPOT', 'MY_STOCK', 'MYR',  100000::numeric),
  ('Backtest — US Stock',       'Generic', 'PERSONAL_SPOT', 'US_STOCK', 'USD',  100000::numeric),
  ('Backtest — Forex',          'Generic', 'MARGIN',        'FOREX',    'USD',  100000::numeric),
  ('Backtest — Crypto',         'Generic', 'MARGIN',        'CRYPTO',   'USDT', 100000::numeric)
) as v(name, broker, account_type, asset_class, currency, bal)
where not exists (
  select 1 from accounts a where a.env = 'BACKTEST' and a.name = v.name
);

-- ============================================================================
-- Done. New account columns: asset_class, env.
-- New trade columns: entries, exits, executed_size, avg_entry, open_size, contract_value.
-- 4 backtest accounts seeded (Malaysia Stock / US Stock / Forex / Crypto).
-- Reason lists + instrument contract table are stored in the prefs row (jsonb) —
-- no schema change needed; edit them in the app's Settings tab.
-- ============================================================================
