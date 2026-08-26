-- J.Tradebook migration v7
-- Manual/live "current price" mark on trades, to compute unrealized P&L.
-- Safe to re-run.

alter table trades add column if not exists current_price numeric;
