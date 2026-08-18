-- ============================================================================
-- J.TRADEBOOK V2 — SUPABASE MIGRATION
-- ============================================================================
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Idempotent: safe to run more than once (CREATE ... IF NOT EXISTS + guarded
-- ALTERs). Designed for a fresh V2 project but will also upgrade an old one.
-- ============================================================================

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. accounts  (multi-account CRUD)
-- ----------------------------------------------------------------------------
create table if not exists accounts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  broker          text,
  account_type    text default 'PERSONAL_SPOT',   -- PERSONAL_SPOT | MARGIN | PROP_FIRM
  currency        text default 'USD',
  initial_balance numeric default 0,
  current_balance numeric default 0,
  is_archived     boolean default false,
  created_at      timestamptz default now()
);

-- If an older `accounts` table already exists, add any missing V2 columns.
alter table accounts add column if not exists broker          text;
alter table accounts add column if not exists account_type    text default 'PERSONAL_SPOT';
alter table accounts add column if not exists currency        text default 'USD';
alter table accounts add column if not exists initial_balance numeric default 0;
alter table accounts add column if not exists current_balance numeric default 0;
alter table accounts add column if not exists is_archived     boolean default false;
alter table accounts add column if not exists created_at      timestamptz default now();

-- ----------------------------------------------------------------------------
-- 2. trades  (core lifecycle record — replaces the old `journal` table)
-- ----------------------------------------------------------------------------
create table if not exists trades (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid references accounts(id) on delete set null,
  mode              text default 'LIVE',           -- LIVE | BACKTEST
  ticker            text not null,
  direction         text not null,                 -- LONG | SHORT
  asset_type        text not null,                 -- STOCK | FOREX | CRYPTO | KLCI
  status            text default 'PLANNING',       -- PLANNING | ACTIVE | CLOSED

  -- Entry / plan
  entry_price       numeric,
  stop_loss_price   numeric,
  target_price      numeric,
  position_size     numeric,
  risk_amount       numeric,
  risk_pct          numeric,
  planned_rr        numeric,
  entry_grade       text,                          -- A | B | C
  pre_trade_mood    text,                          -- CALIBRATED | IMPATIENT | REVENGE | FOMO
  entry_reason_tags text[],
  pre_chart_url_4h  text,
  pre_chart_url_1h  text,
  entry_timestamp   timestamptz,
  setup_notes       text,

  -- Exit
  exit_price        numeric,
  exit_timestamp    timestamptz,
  realized_pnl      numeric,
  realized_r        numeric,
  exit_grade        text,                          -- A | B | C
  post_chart_url_4h text,
  post_chart_url_1h text,

  -- Review
  mistake_tags      text[],
  reflection_note   text,
  review_complete   boolean default false,

  created_at        timestamptz default now()
);

create index if not exists trades_account_idx on trades(account_id);
create index if not exists trades_mode_idx    on trades(mode);
create index if not exists trades_status_idx  on trades(status);

-- ----------------------------------------------------------------------------
-- 3. account_transactions  (cash flow — strictly isolated from trading stats)
-- ----------------------------------------------------------------------------
create table if not exists account_transactions (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  type       text not null,                        -- DEPOSIT | WITHDRAWAL | PROP_PAYOUT | FEE_ADJUSTMENT
  amount     numeric not null,
  fee        numeric default 0,
  date       date not null,
  notes      text,
  created_at timestamptz default now()
);

create index if not exists acct_tx_account_idx on account_transactions(account_id);

-- ----------------------------------------------------------------------------
-- 4. prefs  (key/value app settings)
-- ----------------------------------------------------------------------------
create table if not exists prefs (
  key   text primary key,
  value jsonb
);

-- Seed default settings (won't overwrite an existing row).
insert into prefs (key, value)
values ('settings', '{"defaultRiskPct":2,"dailyLimitPct":6,"mode":"LIVE","activeAccountId":null}'::jsonb)
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 5. Storage bucket for chart screenshots
-- ----------------------------------------------------------------------------
-- Create a PUBLIC bucket named 'trade-screenshots'.
insert into storage.buckets (id, name, public)
values ('trade-screenshots', 'trade-screenshots', true)
on conflict (id) do update set public = true;

-- Public read for the bucket; server (service_role) handles writes via api/upload.js.
drop policy if exists "trade-screenshots public read" on storage.objects;
create policy "trade-screenshots public read"
  on storage.objects for select
  using (bucket_id = 'trade-screenshots');

-- ============================================================================
-- OPTIONAL: seed one starter account so the app has something to select.
-- Uncomment to use.
-- ============================================================================
-- insert into accounts (name, broker, account_type, currency, initial_balance, current_balance)
-- values ('Main', 'Moomoo SG', 'PERSONAL_SPOT', 'USD', 10000, 10000);

-- ============================================================================
-- Done. Tables: accounts, trades, account_transactions, prefs.
-- Bucket: trade-screenshots (public).
-- ============================================================================
