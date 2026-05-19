# Decision Log

Append-only. When a meaningful decision is made, log it here.

Format: [YYYY-MM-DD] DECISION: ... | REASONING: ... | CONTEXT: ...

---

[2026-05-19] DECISION: Refactor dashboard from single index.html into multi-file structure (css/, js/, pages/ folders) | REASONING: Single 1655-line file is hard to debug and maintain; professional structure separates concerns, each page has its own JS file | CONTEXT: User explicitly requested this after first monolithic build was delivered

[2026-05-19] DECISION: Use plain `<script src="...">` tags (no ES modules, no bundler) | REASONING: Works with both file:// local testing and Vercel HTTP deployment; no build step required; simplest for solo developer | CONTEXT: Static site deployed to Vercel, no CI/CD pipeline

[2026-05-19] DECISION: Switch to light theme (cream main area + dark sidebar) | REASONING: Dark-only theme made data hard to read; financial dashboards benefit from high contrast; dark sidebar preserves brand identity | CONTEXT: User feedback after first dark theme build

[2026-05-19] DECISION: Holdings page = computed view of open JOURNAL entries (no separate data store) | REASONING: Journal is the source of truth; Holdings is just a filter (exit == null); removing HOLDINGS array eliminates sync bugs | CONTEXT: User reported confusion about whether Holdings and Journal were linked

[2026-05-19] DECISION: P&L and R-multiple are computed on-the-fly, not stored in JOURNAL | REASONING: Prevents data inconsistency if entry/exit/SL/units are edited later; single source of truth | CONTEXT: User confirmed SL/TP are reference only; P&L should derive from entry/exit/units/direction

[2026-05-19] DECISION: Calculator logic is market-specific — KLCI in lots (100 shares), Crypto with leverage, Forex/Gold/Silver/Indices in lots with instrument-specific pip/point values | REASONING: Each market has fundamentally different position sizing conventions; one-size formula gives wrong results | CONTEXT: User flagged incorrect position sizes for non-US-stock markets
