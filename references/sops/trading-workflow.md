# SOP: Full Trading Workflow

J's complete process from spotting a chart to logging the trade.

---

## Step 1 — Technical Validation
**Agent:** trade-research-agent

- Spot a chart setup on TradingView
- Check SMA 26 / SMA 69 on higher timeframe (HTF) → confirm trend
- Check SMA 26 / SMA 69 on lower timeframe (LTF) → time the entry
- Confirm price is in the BODY zone (not head, not tail)
- Send setup to trade-research-agent → must return PASS

If FAIL or REVIEW → do not proceed. Wait for a better setup.

---

## Step 2 — Risk Management
**Agent:** risk-operations-agent

- Default risk: 2% of account equity per trade
- Calculate: position size, risk amount, R:R ratio
- Check portfolio risk: total risk deployed across all open trades
- Check free capital: equity not currently at risk
- Only proceed if:
  - R:R ≥ 1:2
  - Total portfolio risk stays within daily limit (6%)
  - SL is placed at a logical level (below SMA 69 for longs)

---

## Step 3 — Execute Trade
- Place order on broker (Moomoo or relevant platform)
- Set SL and TP immediately

---

## Step 4 — Log the Trade
**Dashboard:** Trading History (`p-journal`)

Fields to fill:
- Asset, market, direction
- Entry price, SL, TP
- Units / position size
- Risk amount, R:R
- Mood at time of entry
- Reason for entry (pattern seen, MTF alignment)

---

## Step 5 — Monitor & Manage
- Body zone: hold the position
- Approaching tail (SMA 26 flattening / crossing down on LTF): consider trimming
- SMA 26 crosses below SMA 69 on LTF: exit or move SL to breakeven

---

## Step 6 — Close & Review
- Log exit price, actual P&L, R-multiple achieved
- Note: did you follow the rules? What worked, what didn't?

---

## Step 7 — Weekly Reflection
**Agent:** weekly-analysis-agent

- Run every week (Sundays recommended)
- Reviews all trades from past 7 days
- Surfaces patterns, bad trades, rule violations
- Results displayed on `p-perf` dashboard
- Archive saved to `archives/YYYY-MM-DD-weekly.md`
