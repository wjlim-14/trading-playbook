# J.Tradebook — Multi-File Refactor + Feature Build Plan

## Context
The current dashboard is a single-file monolithic SPA (`projects/public/index.html`, ~1,655 lines).
The user wants it refactored into a professional multi-file structure for maintainability and debugging,
plus a series of feature changes to theme, navigation, and all 7 active pages.

---

## Target File Structure

```
projects/
  public/
    index.html            ← Shell only: sidebar nav + <div id="page-root">
    css/
      base.css            ← Variables, reset, typography, utility classes
      layout.css          ← Sidebar, main area, responsive breakpoints
      components.css      ← Cards, tables, badges, buttons, forms, modals, charts
    js/
      data.js             ← All mock data + state (JOURNAL, ACCOUNTS, TRANSACTIONS, PREFS)
      utils.js            ← fmt(), pnlFmt(), rFmt(), marketBadge(), calcPnL(), getHoldings()
      charts.js           ← drawPnlChart(), drawRDist(), drawMonthlyBars()
      router.js           ← nav(), PAGE_IDS, script-loader for page JS
      app.js              ← DOMContentLoaded init, resize listener
    pages/
      dashboard.js        ← renderDashboard()
      journal.js          ← renderJournal(), openTradeModal(), editTrade(), saveTrade()
      holdings.js         ← renderHoldings() — reads from getHoldings() not separate array
      calculator.js       ← renderCalculator(), calcKLCI/US/Crypto/Forex()
      sentiment.js        ← renderSentiment()
      performance.js      ← renderPerf(), period/account filters
      settings.js         ← renderSettings(), account edit, deposit/withdraw
  vercel.json             ← { "outputDirectory": "public" }  ← unchanged
```

**JS loading strategy:** Plain `<script src="...">` tags (no ES modules) so file:// works locally.
Load order in index.html: data.js → utils.js → charts.js → router.js → pages/*.js → app.js

---

## Design System (NEW — Light Theme)

```
Sidebar:
  --sb-bg:        #cfa270   ← warm tan/brown
  --sb-border:    rgba(100,60,20,0.2)
  --sb-text:      #3a1a06   ← dark brown text on tan
  --sb-active-bg: rgba(255,255,255,0.28)
  --sb-active:    #1a0f00   ← near-black for active item text

Main content (light):
  --bg:        #f0ebe2   ← warm cream background
  --surface:   #ffffff   ← cards
  --surface2:  #f8f4ef   ← subtle card variant
  --border:    #e3dbd0
  --text:      #1c1108
  --muted:     #7a6550

Accents (same semantic meaning, adjusted for light bg):
  --gold:      #c49a20
  --green:     #1a6b35
  --green-bg:  rgba(26,107,53,0.08)
  --red:       #c02020
  --red-bg:    rgba(192,32,32,0.08)

Fonts:
  Playfair Display  → headings/logo
  JetBrains Mono   → numbers/data/labels
  Inter            → body text (replacing Source Serif 4, better for dense data)
```

---

## Data Schema Changes

### JOURNAL (updated)
```js
{
  id, date, accountId,       // accountId links to ACCOUNTS array
  market, asset, dir,
  entry, sl, tp,             // sl/tp are reference only
  exit,                      // null if open
  units,
  currentPrice,              // for open trades unrealised P&L
  confluence1,               // required
  confluence2,               // required
  confluence3,               // required
  mood, review               // review optional
  // pnl and r are COMPUTED, not stored
}
```

P&L/R computed via utils:
- `calcPnL(t)` = dir=LONG: (exit-entry)×units | dir=SHORT: (entry-exit)×units
- `calcR(t)` = calcPnL(t) / (|entry-sl| × units)
- `getHoldings()` = JOURNAL.filter(t => t.exit == null)  ← no separate HOLDINGS array

### ACCOUNTS (new)
```js
[
  { id:'my', name:'Malaysia Stocks', currency:'MYR', symbol:'RM',  equity:50000 },
  { id:'us', name:'US Stocks',       currency:'USD', symbol:'$',   equity:12000 },
  { id:'cr', name:'Crypto',          currency:'USDT',symbol:'₮',   equity:5000  },
  { id:'fx', name:'Forex',           currency:'USD', symbol:'$',   equity:3000  }
]
```

Market → account mapping: KLCI→my, US Stocks→us, Crypto→cr, Forex→fx

### TRANSACTIONS (new)
```js
{ id, date, accountId, type:'deposit'|'withdrawal', amount, balanceAfter, note }
```

### PREFS (new)
```js
{ defaultRiskPct: 2, dailyLimitPct: 6 }
```

---

## Phases

### Phase 1 — Foundation (file structure + light theme + sidebar)
**Files to create:**
- `css/base.css` — variables, reset, typography, utilities
- `css/layout.css` — sidebar (220px fixed left), main content, mobile bottom nav
- `css/components.css` — all shared UI components
- `js/data.js` — updated schema (JOURNAL with accountId+confluences, ACCOUNTS, TRANSACTIONS, PREFS)
- `js/utils.js` — all helper functions (calcPnL, calcR, getHoldings, fmt, badges)
- `js/charts.js` — chart draw functions
- `js/router.js` — nav(), page switcher
- `js/app.js` — init, resize handler
- `index.html` — shell: sidebar links + `<div id="page-root">` + all script/css tags

**Outcome:** App loads with light theme + left sidebar. Page slots exist, no content yet.

---

### Phase 2 — Dashboard page (`pages/dashboard.js`)
- Dynamic month/year header from `new Date()`
- 4 account equity cards (RM / USD / USDT / USD — each own currency)
- Currency-neutral stats: Win Rate, Avg R, Total Trades, Open Positions
- Cumulative P&L chart + R-distribution chart
- Recent 5 trades table
- Active holdings mini-table (from `getHoldings()`)

---

### Phase 3 — Journal page (`pages/journal.js`)
- Trade table with filters (market, direction, result)
- P&L and R computed (not stored) via calcPnL/calcR
- SL/TP columns styled as "reference" (muted)
- Edit button (pencil icon) on every row
- Log Trade modal — 5 sections:
  1. Date, Market, Asset, Direction
  2. Entry, SL (ref), TP (ref), Exit (blank = open)
  3. Units + risk amount preview
  4. Confluence 1, 2, 3 (all required, validated on save)
  5. Mood, Review
- Edit modal: same form pre-populated; adding exit to open trade closes position + removes from Holdings

---

### Phase 4 — Holdings page (`pages/holdings.js`)
- Holdings = `getHoldings()` (open JOURNAL entries only)
- Stats: open count, total risk, unrealised P&L, free capital
- Table with edit button (pencil) on each row
- Adding exit via edit → closes trade, removes from Holdings
- Risk Rules section at bottom:
  - Portfolio risk gauge
  - Per-trade risk breakdown
  - Trading rules checklist (accordion)
- "+ Add Position" → Log Trade modal (exit left blank)

---

### Phase 5 — Calculator page (`pages/calculator.js`)

**KLCI (MYR):** lots = floor(risk / (|entry-sl| × 100)), display "X lots (X×100 shares)"

**US Stocks (USD):** shares = floor(risk / |entry-sl|)

**Crypto Spot (USDT):** coins = risk / |entry-sl|

**Crypto Leveraged (USDT):** margin = (risk/sl_dist_pct)/leverage, show coins + margin + liq price

**Forex (USD) — 4 sub-types:**
- Major Pairs: lots = risk / (sl_pips × 10), pip_value=$10/lot
- Gold (XAUUSD): lots = risk / (|entry-sl| × 100), 1 lot = 100 oz
- Silver (XAGUSD): lots = risk / (|entry-sl| × 5000), 1 lot = 5000 oz
- US Indices: lots = risk / (|entry-sl| × point_value), point_value configurable (default $1)

All: show R:R, warn if < 1:2, show open portfolio risk context.

---

### Phase 6 — Performance page (`pages/performance.js`)
- Filter 1 — Period: Overall | This Year | This Month | Select Year/Month
- Filter 2 — Account: All | Malaysia | US | Crypto | Forex
- Stats: win rate, avg R, max drawdown (+ P&L in account currency if single account selected)
- By-market table, monthly P&L chart, R-dist chart, bad pattern detector, trade log

---

### Phase 7 — Settings page (`pages/settings.js`)
- 4 account cards: name, currency, equity, totals
- Inline equity edit (pencil)
- Deposit/Withdraw modal → appends to TRANSACTIONS
- Transaction history table (filterable)
- Preferences: Default Risk % + Daily Limit % (feed into Calculator + Holdings gauge)

---

### Phase 8 — Sentiment page (`pages/sentiment.js`)
- Wire up to new file structure, minimal changes
- KLCI / US / Crypto direction cards
- Fear & Greed meter
- Market notes list

---

## Pages Removed
- `p-indicators` (S/R Levels) — removed entirely
- `p-risk` (Risk Rules) — merged into Holdings bottom section

---

## Vercel Deployment
- `vercel.json` unchanged: `{ "outputDirectory": "public" }`
- All static files, no build step
- Script tags load order: data.js → utils.js → charts.js → router.js → pages/*.js → app.js

---

## Execution Order
Build one phase at a time. Confirm working in browser before moving to next phase.
