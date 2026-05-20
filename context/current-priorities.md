# Current Priorities
_Last updated: 2026-05-20_

## STATUS: Frontend COMPLETE
All 7 pages built, tested locally, committed to git (branch: master).
See `projects/PLAN.md` for full architecture and decisions.

## Deployment — DONE
- GitHub: https://github.com/wjlim-14/trading-playbook2
- Live URL: **https://jtradebook.vercel.app**

## After deployment confirmed — Backend Phase
- **Supabase PostgreSQL** — replace in-memory mock data with real persistence
  - JOURNAL, ACCOUNTS, TRANSACTIONS tables
  - Vercel serverless functions as API layer
- **Live current prices** (replaces manual update)
  - KLCI/Bursa → Moomoo API (or Yahoo Finance fallback)
  - US Stocks → Yahoo Finance or Alpha Vantage
  - Crypto → CoinGecko API (free, no key needed)
  - Forex → ExchangeRate-API or OANDA
- **Data persistence** — trades survive page refresh

## Feature backlog (J's ideas — parked)
- Any new UI ideas J brings up next session
- Performance page: "Select Year" and "Select Month" period filters (currently only Overall / This Year / This Month)
- Settings: edit account names and add new accounts
