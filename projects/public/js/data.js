/* ── API STATE ── */
var _apiAvailable = false;

/* ── ACCOUNTS ── */
var ACCOUNTS = [
  { id:'my', name:'Malaysia Stocks', currency:'MYR', symbol:'RM',  equity:50000 },
  { id:'us', name:'US Stocks',       currency:'USD', symbol:'$',   equity:12000 },
  { id:'cr', name:'Crypto',          currency:'USDT',symbol:'₮',   equity:5000  },
  { id:'fx', name:'Forex',           currency:'USD', symbol:'$',   equity:3000  }
];

/* ── PREFERENCES ── */
var PREFS = { defaultRiskPct: 2, dailyLimitPct: 6 };

/* ── JOURNAL (master trade log) ──
   pnl and r are COMPUTED via calcPnL() / calcR() — not stored here.
   exit = null means trade is still open.
   currentPrice = live price for open trades (unrealised P&L).
   sl/tp = reference levels only, not used in P&L calc.
   confluence1/2/3 = required entry justifications.
*/
var JOURNAL = [
  /* ── CLOSED TRADES ── */
  {
    id:1, date:'2026-04-07', accountId:'my', market:'KLCI', asset:'MAYBANK', dir:'LONG',
    entry:9.20, sl:8.90, tp:9.80, exit:9.68, units:3300, currentPrice:null,
    confluence1:'SMA26 > SMA69 on Weekly (HTF uptrend confirmed)',
    confluence2:'SMA26 > SMA69 on Daily, price in body zone',
    confluence3:'High-volume bullish candle on SMA26 retest',
    mood:'Calm', review:'Clean setup. Followed all rules. Could have held to TP.'
  },
  {
    id:2, date:'2026-04-10', accountId:'cr', market:'Crypto', asset:'BTCUSDT', dir:'LONG',
    entry:82500, sl:80000, tp:87500, exit:79200, units:0.04, currentPrice:null,
    confluence1:'Bullish 4H candle (only reason)',
    confluence2:'',
    confluence3:'',
    mood:'FOMO', review:'Entered without HTF check. SMA26 < SMA69 on daily. Rule violation — no confluences.'
  },
  {
    id:3, date:'2026-04-14', accountId:'us', market:'US Stocks', asset:'NVDA', dir:'LONG',
    entry:875, sl:850, tp:950, exit:920, units:9, currentPrice:null,
    confluence1:'SMA26 > SMA69 on Weekly (HTF uptrend)',
    confluence2:'Daily body zone entry after SMA26 retest',
    confluence3:'Sector strength — AI theme intact',
    mood:'Calm', review:'Good setup. Held through drawdown. Clean execution.'
  },
  {
    id:4, date:'2026-04-17', accountId:'my', market:'KLCI', asset:'TENAGA', dir:'LONG',
    entry:14.20, sl:13.80, tp:15.20, exit:14.20, units:2500, currentPrice:null,
    confluence1:'SMA26 > SMA69 on Daily',
    confluence2:'Breakout from consolidation zone',
    confluence3:'Volume pickup on breakout candle',
    mood:'Neutral', review:'Moved SL to entry too early. Stopped at B/E. Should have given more room.'
  },
  {
    id:5, date:'2026-04-21', accountId:'fx', market:'Forex', asset:'USDJPY', dir:'SHORT',
    entry:151.80, sl:152.80, tp:149.00, exit:149.90, units:60, currentPrice:null,
    confluence1:'SMA26 < SMA69 on Weekly (HTF downtrend)',
    confluence2:'Daily body zone rejection at SMA26 resistance',
    confluence3:'BOJ intervention risk — macro bearish catalyst',
    mood:'Calm', review:'Excellent execution. Held through drawdown. Took profit before TP.'
  },
  {
    id:6, date:'2026-04-24', accountId:'cr', market:'Crypto', asset:'ETHUSDT', dir:'LONG',
    entry:3200, sl:3100, tp:3500, exit:3480, units:1, currentPrice:null,
    confluence1:'SMA26 crossing above SMA69 on Daily',
    confluence2:'Strong support at 3100 held for 3 days',
    confluence3:'BTC leading — altcoin follow-through likely',
    mood:'Confident', review:'Good R but exited before TP. Could have been 3R with more patience.'
  },
  {
    id:7, date:'2026-04-28', accountId:'my', market:'KLCI', asset:'PBBANK', dir:'LONG',
    entry:4.10, sl:3.95, tp:4.40, exit:3.95, units:6600, currentPrice:null,
    confluence1:'Earnings play (not a technical setup)',
    confluence2:'',
    confluence3:'',
    mood:'Rushed', review:'Bad trade. No technical basis, entered on news. SMA26 < SMA69 on HTF. Rule violation.'
  },
  {
    id:8, date:'2026-05-02', accountId:'us', market:'US Stocks', asset:'TSLA', dir:'LONG',
    entry:165, sl:158, tp:182, exit:180, units:34, currentPrice:null,
    confluence1:'SMA26 > SMA69 on Weekly (uptrend)',
    confluence2:'Daily body zone retest with strong volume',
    confluence3:'EV sector rotation — institutional buying',
    mood:'Calm', review:'Patient entry. Good follow-through. Almost reached TP.'
  },
  {
    id:9, date:'2026-05-05', accountId:'my', market:'KLCI', asset:'CIMB', dir:'LONG',
    entry:7.20, sl:7.00, tp:7.60, exit:7.55, units:5000, currentPrice:null,
    confluence1:'SMA26 > SMA69 on Daily and Weekly',
    confluence2:'LTF SMA26 support retest, clean bounce',
    confluence3:'Banking sector outperforming KLCI',
    mood:'Calm', review:'Almost at TP. Took profit early. Could have held for full 2R.'
  },
  {
    id:10, date:'2026-05-08', accountId:'fx', market:'Forex', asset:'EURUSD', dir:'LONG',
    entry:1.0820, sl:1.0780, tp:1.0900, exit:1.0760, units:1500, currentPrice:null,
    confluence1:'Oversold dip on 4H',
    confluence2:'',
    confluence3:'',
    mood:'Impatient', review:'Counter-trend entry. HTF was bearish. SMA26 < SMA69 on daily. Avoidable loss.'
  },
  {
    id:11, date:'2026-05-09', accountId:'cr', market:'Crypto', asset:'SOLUSDT', dir:'LONG',
    entry:148, sl:142, tp:165, exit:162, units:16, currentPrice:null,
    confluence1:'SMA26 > SMA69 on Daily and Weekly',
    confluence2:'Retest of breakout zone — previous resistance now support',
    confluence3:'Strong network activity, ecosystem momentum',
    mood:'Calm', review:'Clean setup. Followed all rules. Good R.'
  },
  {
    id:12, date:'2026-05-12', accountId:'us', market:'US Stocks', asset:'AAPL', dir:'LONG',
    entry:198, sl:194, tp:208, exit:205, units:60, currentPrice:null,
    confluence1:'SMA26 > SMA69 on Weekly (sustained uptrend)',
    confluence2:'Daily body zone — price pulled back to SMA26 support',
    confluence3:'Services revenue beat — fundamental support',
    mood:'Calm', review:'Solid setup. Followed all rules. Exited slightly before TP.'
  },
  {
    id:13, date:'2026-05-13', accountId:'my', market:'KLCI', asset:'RHBBANK', dir:'LONG',
    entry:6.30, sl:6.10, tp:6.70, exit:6.10, units:5000, currentPrice:null,
    confluence1:'SMA26 > SMA69 on Daily',
    confluence2:'Support bounce at 6.10 zone',
    confluence3:'Banking sector positive flow',
    mood:'Neutral', review:'SL hit. Market was distributing — missed the sign. Setup looked valid but failed.'
  },
  {
    id:14, date:'2026-05-15', accountId:'my', market:'KLCI', asset:'MAYBANK', dir:'LONG',
    entry:9.50, sl:9.25, tp:10.00, exit:9.85, units:4000, currentPrice:null,
    confluence1:'SMA26 > SMA69 on Weekly and Daily (continuation)',
    confluence2:'LTF: SMA26 support retest held cleanly',
    confluence3:'Dividend catalyst + strong foreign flow',
    mood:'Calm', review:'Good trade. Exited slightly early. Rules followed throughout.'
  },

  /* ── OPEN TRADES (Holdings) ── */
  {
    id:15, date:'2026-05-16', accountId:'cr', market:'Crypto', asset:'BTCUSDT', dir:'LONG',
    entry:103500, sl:101000, tp:110000, exit:null, units:0.04, currentPrice:105800,
    confluence1:'BTC broke 100K resistance on weekly close',
    confluence2:'SMA26 > SMA69 on Daily — HTF aligned',
    confluence3:'Daily body zone entry after breakout retest',
    mood:'Calm', review:null
  },
  {
    id:16, date:'2026-05-17', accountId:'my', market:'KLCI', asset:'TENAGA', dir:'LONG',
    entry:14.50, sl:14.00, tp:16.00, exit:null, units:2000, currentPrice:15.20,
    confluence1:'SMA26 > SMA69 on Weekly (sustained uptrend)',
    confluence2:'Breakout from 3-month consolidation, body zone entry',
    confluence3:'Utility sector rotation + earnings growth expected',
    mood:'Calm', review:null
  },
  {
    id:17, date:'2026-05-18', accountId:'us', market:'US Stocks', asset:'NVDA', dir:'LONG',
    entry:920, sl:895, tp:970, exit:null, units:9, currentPrice:935,
    confluence1:'SMA26 > SMA69 on Weekly — strong AI uptrend',
    confluence2:'Daily body zone support retest after earnings',
    confluence3:'Data center demand — fundamental growth intact',
    mood:'Calm', review:null
  },
  {
    id:18, date:'2026-05-19', accountId:'fx', market:'Forex', asset:'USDJPY', dir:'SHORT',
    entry:152.40, sl:153.40, tp:149.40, exit:null, units:60, currentPrice:151.20,
    confluence1:'SMA26 < SMA69 on Daily (downtrend)',
    confluence2:'Rejection at SMA26 resistance — failed breakout',
    confluence3:'BOJ policy tightening expectations — macro tailwind for short',
    mood:'Calm', review:null
  }
];

/* ── MARKET SENTIMENT ── */
var MARKET = {
  klci:   { dir:'BULLISH', note:'SMA26 > SMA69 on weekly and daily. KLCI holding above 1,580 support. Banks and utilities leading. Body zone intact.', updated:'2026-05-19' },
  us:     { dir:'BULLISH', note:'SPY in uptrend. Nasdaq outperforming. Fed paused — risk-on environment. Watch macro data this week.', updated:'2026-05-19' },
  crypto: { dir:'BULLISH', note:'BTC holding above 100K after breakout. Altseason possible but monitor for distribution signs.', updated:'2026-05-19' },
  fg:     72
};

var MARKET_NOTES = [
  { id:1, date:'2026-05-19', tag:'KLCI',      note:'KLCI daily trend intact. Watch MAYBANK and TENAGA continuation. Avoid counter-trend entries this week.' },
  { id:2, date:'2026-05-17', tag:'Crypto',    note:'BTC consolidating above 103K. Bulls defending well. Monitor LTF for next entry setup.' },
  { id:3, date:'2026-05-16', tag:'US Stocks', note:'SPY weekly body zone holding. Earnings season mostly positive. No bearish signals on HTF.' }
];

/* ── TRANSACTIONS ── */
var TRANSACTIONS = [
  { id:1, date:'2026-04-01', accountId:'my', type:'deposit',    amount:50000, balanceAfter:50000, note:'Initial capital — Malaysia account' },
  { id:2, date:'2026-04-01', accountId:'us', type:'deposit',    amount:12000, balanceAfter:12000, note:'Initial capital — US account' },
  { id:3, date:'2026-04-01', accountId:'cr', type:'deposit',    amount:5000,  balanceAfter:5000,  note:'Initial capital — Crypto account' },
  { id:4, date:'2026-04-01', accountId:'fx', type:'deposit',    amount:3000,  balanceAfter:3000,  note:'Initial capital — Forex account' },
  { id:5, date:'2026-05-01', accountId:'my', type:'withdrawal', amount:2000,  balanceAfter:48000, note:'Monthly personal withdrawal' },
  { id:6, date:'2026-05-10', accountId:'my', type:'deposit',    amount:2000,  balanceAfter:50000, note:'Re-deposit after review' }
];

/* ── TRADING RULES ── */
var RULES = [
  { text:'Risk <strong>2% max</strong> of account equity per trade. Never exceed.', priority:'critical' },
  { text:'Max <strong>6% total portfolio risk</strong> across all open positions (daily limit).', priority:'critical' },
  { text:'Only enter when <strong>SMA26 > SMA69 on HTF</strong> (weekly/daily) confirms trend direction.', priority:'critical' },
  { text:'Use <strong>LTF (1H/4H)</strong> SMA26/69 alignment to time the entry precisely.', priority:'high' },
  { text:'Enter only in the <strong>body zone</strong> — not head, not tail. Avoid extreme candle wicks.', priority:'high' },
  { text:'<strong>R:R ≥ 1:2</strong> minimum before entering. No exceptions.', priority:'critical' },
  { text:'SL must be at a <strong>logical structural level</strong> — below SMA69 for longs, above for shorts.', priority:'high' },
  { text:'Set SL and TP <strong>immediately</strong> after execution. No unprotected trades ever.', priority:'critical' },
  { text:'<strong>No counter-trend trades.</strong> Always trade in the direction of HTF trend.', priority:'critical' },
  { text:'Run every trade through the <strong>Risk Calculator</strong> before entering. Zero exceptions.', priority:'high' },
  { text:'Log every trade in Journal — <strong>under 2 minutes</strong>. Fill all 3 confluences.', priority:'high' },
  { text:'Weekly reflection every <strong>Sunday</strong> — review trades, surface patterns.', priority:'medium' }
];
