/* ============================================================
   J.TRADEBOOK V2 — UTILITIES
   Calculation engine: position sizing, PnL/R, cash-flow-isolated
   balances, KPIs, portfolio heat, grade matrix, formatters.
   ============================================================ */

function round(n, d) { return +Number(n).toFixed(d == null ? 2 : d); }

/* ── CURRENCY ── */
var CURRENCY_SYMBOL = { USD:'$', USDT:'$', MYR:'RM', SGD:'S$', EUR:'€', GBP:'£', JPY:'¥', AUD:'A$' };
function curSym(c) { return CURRENCY_SYMBOL[c] || (c ? c + ' ' : '$'); }

/* ── ACCOUNTS ── */
function getAccount(id) { return ACCOUNTS.find(function(a){ return a.id === id; }); }
function activeAccounts() { return ACCOUNTS.filter(function(a){ return !a.isArchived; }); }

/* Cash-flow net for an account (STRICTLY separate from trading PnL). */
function cashflowNet(accountId) {
  return TRANSACTIONS.filter(function(t){ return t.accountId === accountId; })
    .reduce(function(sum, t){
      var v = 0;
      if (t.type === 'DEPOSIT' || t.type === 'PROP_PAYOUT') v = t.amount;
      else if (t.type === 'WITHDRAWAL' || t.type === 'FEE_ADJUSTMENT') v = -t.amount;
      return sum + v - (t.fee || 0);
    }, 0);
}

/* Realized trading PnL for an account (LIVE only by default). */
function accountRealizedPnL(accountId, mode) {
  mode = mode || 'LIVE';
  return TRADES.filter(function(t){
    return t.accountId === accountId && t.mode === mode && t.status === 'CLOSED';
  }).reduce(function(s, t){ return s + (tradePnL(t) || 0); }, 0);
}

/* Current balance = start + realized trading PnL + deposits - withdrawals - fees */
function accountBalance(accountId) {
  var a = getAccount(accountId);
  if (!a) return 0;
  return a.initialBalance + accountRealizedPnL(accountId, 'LIVE') + cashflowNet(accountId);
}

/* Equity used for position sizing (the live balance of the selected account). */
function accountEquity(accountId) { return accountBalance(accountId); }

/* ── POSITION SIZING (asset-type specific, per spec §1) ── */
function computePositionSize(assetType, ticker, entry, sl, riskAmt) {
  var unit = unitLabel(assetType);
  var dist = Math.abs((+entry) - (+sl));
  if (!dist || !riskAmt || !isFinite(dist)) return { size: 0, unit: unit };
  var tk = (ticker || '').toUpperCase();

  if (assetType === 'FOREX') {
    if (tk.indexOf('XAU') >= 0 || tk.indexOf('GOLD') >= 0) {          // XAUUSD
      return { size: round(riskAmt / (dist * 100), 2), unit: 'Lots (Gold)' };
    }
    var pipSize = tk.indexOf('JPY') >= 0 ? 0.01 : 0.0001;            // JPY pairs 2dp
    var pips = dist / pipSize;
    var pipValuePerLot = 10;                                          // ~$10/pip per std lot (USD-quoted majors)
    return { size: round(riskAmt / (pips * pipValuePerLot), 2), unit: 'Std Lots' };
  }
  if (assetType === 'STOCK')  return { size: Math.floor(riskAmt / dist), unit: 'Shares' };
  if (assetType === 'CRYPTO') return { size: round(riskAmt / dist, 4), unit: 'Units' };
  if (assetType === 'KLCI')   return { size: Math.floor(riskAmt / (dist * 100)), unit: 'Lots' };
  return { size: Math.floor(riskAmt / dist), unit: 'Units' };
}

function unitLabel(assetType) {
  return { FOREX:'Std Lots', STOCK:'Shares', CRYPTO:'Units', KLCI:'Lots' }[assetType] || 'Units';
}

/* Target price from entry, SL and R:R multiple. */
function targetFromRR(entry, sl, rr, direction) {
  var dist = Math.abs(entry - sl);
  var dir = direction === 'SHORT' ? -1 : 1;
  return round(entry + dir * dist * rr, priceDp(entry));
}

function priceDp(v) {
  var a = Math.abs(v);
  if (a === 0) return 2;
  if (a < 1) return 5;
  if (a < 100) return 4;
  return 2;
}

/* ── TRADE PnL / R (asset-type independent via R-multiple) ── */
function tradeR(t) {
  if (t.realizedR != null) return t.realizedR;
  if (t.status !== 'CLOSED' || t.exitPrice == null) return null;
  var riskDist = Math.abs(t.entryPrice - t.stopLossPrice);
  if (!riskDist) return null;
  var dir = t.direction === 'SHORT' ? -1 : 1;
  return round(dir * (t.exitPrice - t.entryPrice) / riskDist, 2);
}

function tradePnL(t) {
  if (t.realizedPnL != null) return t.realizedPnL;
  if (t.status !== 'CLOSED') return null;
  var r = tradeR(t);
  if (r == null || t.riskAmount == null) return null;
  return round(r * t.riskAmount, 2);
}

/* ── VIEW FILTERS (respect global MODE + ACTIVE_ACCOUNT) ── */
function inAccount(t) { return ACTIVE_ACCOUNT === 'all' || t.accountId === ACTIVE_ACCOUNT; }

function tradesFor(mode) {
  return TRADES.filter(function(t){ return t.mode === mode && inAccount(t); });
}
function viewTrades()       { return tradesFor(MODE); }
function planningTrades()   { return viewTrades().filter(function(t){ return t.status === 'PLANNING'; }); }
function activeTrades()     { return viewTrades().filter(function(t){ return t.status === 'ACTIVE'; }); }
function closedTrades(mode) { return tradesFor(mode || MODE).filter(function(t){ return t.status === 'CLOSED'; }); }

function isSameDay(iso, ref) {
  if (!iso) return false;
  return String(iso).slice(0,10) === ref;
}
function closedTodayTrades() {
  var today = todayStr();
  return viewTrades().filter(function(t){
    return t.status === 'CLOSED' && (isSameDay(t.exitTimestamp, today) || isSameDay(t.createdAt, today));
  });
}

/* ── KPIs (over a set of CLOSED trades) ── */
function kpiSet(trades) {
  var closed = trades.filter(function(t){ return t.status === 'CLOSED'; });
  var n = closed.length;
  var pnls = closed.map(tradePnL).filter(function(v){ return v != null; });
  var net = pnls.reduce(function(a,b){ return a+b; }, 0);
  var wins = pnls.filter(function(v){ return v > 0; });
  var losses = pnls.filter(function(v){ return v < 0; });
  var grossWin = wins.reduce(function(a,b){ return a+b; }, 0);
  var grossLoss = Math.abs(losses.reduce(function(a,b){ return a+b; }, 0));
  var rs = closed.map(tradeR).filter(function(v){ return v != null; });
  var avgR = rs.length ? rs.reduce(function(a,b){ return a+b; }, 0) / rs.length : 0;
  var gradeCCost = closed.filter(function(t){
    return (t.entryGrade === 'C' || t.exitGrade === 'C') && (tradePnL(t) || 0) < 0;
  }).reduce(function(s,t){ return s + (tradePnL(t) || 0); }, 0);
  return {
    count: n,
    net: round(net, 2),
    winRate: n ? round(wins.length / n * 100, 1) : 0,
    wins: wins.length,
    losses: losses.length,
    profitFactor: grossLoss ? round(grossWin / grossLoss, 2) : (grossWin ? Infinity : 0),
    avgR: round(avgR, 2),
    expectancy: n ? round(net / n, 2) : 0,
    gradeCCost: round(gradeCCost, 2),
    gradeCCount: closed.filter(function(t){ return t.entryGrade==='C'||t.exitGrade==='C'; }).length,
    maxDrawdown: round(maxDrawdown(closed), 2)
  };
}

function maxDrawdown(closed) {
  var seq = closed.slice().sort(sortByCloseTime);
  var peak = 0, run = 0, dd = 0;
  seq.forEach(function(t){
    run += tradePnL(t) || 0;
    if (run > peak) peak = run;
    if (peak - run > dd) dd = peak - run;
  });
  return dd;
}

function sortByCloseTime(a, b) {
  var ka = a.exitTimestamp || a.createdAt || '';
  var kb = b.exitTimestamp || b.createdAt || '';
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

/* Cumulative equity curve points (trading PnL only). */
function equitySeries(trades) {
  var seq = trades.filter(function(t){ return t.status==='CLOSED'; }).slice().sort(sortByCloseTime);
  var run = 0;
  return seq.map(function(t){ run += tradePnL(t) || 0; return { t: t, cum: round(run,2) }; });
}

/* ── ENTRY × EXIT MATRIX (A/B = good, C = bad) ── */
function gradeMatrix(trades) {
  var m = { aa:0, ab:0, ba:0, bb:0 };
  trades.filter(function(t){ return t.status==='CLOSED' && t.entryGrade && t.exitGrade; })
    .forEach(function(t){
      var eGood = t.entryGrade !== 'C';
      var xGood = t.exitGrade !== 'C';
      if (eGood && xGood) m.aa++;
      else if (eGood && !xGood) m.ab++;
      else if (!eGood && xGood) m.ba++;
      else m.bb++;
    });
  return m;
}

/* ── PORTFOLIO HEAT (open risk across ACTIVE trades) ── */
function portfolioHeat() {
  var actives = activeTrades();
  var risk = actives.reduce(function(s,t){ return s + (t.riskAmount || 0); }, 0);
  var equityBase;
  if (ACTIVE_ACCOUNT === 'all') {
    equityBase = activeAccounts().reduce(function(s,a){ return s + accountBalance(a.id); }, 0);
  } else {
    equityBase = accountBalance(ACTIVE_ACCOUNT);
  }
  var pct = equityBase > 0 ? round(risk / equityBase * 100, 1) : 0;
  return { risk: round(risk,2), pct: pct, limit: PREFS.dailyLimitPct || 6, equity: equityBase };
}

/* ── PENDING REVIEWS ── */
function pendingReviews(mode) {
  return closedTrades(mode || MODE).filter(function(t){ return !t.reviewComplete; });
}

/* Duplicate underlying exposure among ACTIVE trades. */
function duplicateExposure() {
  var seen = {}, dups = {};
  activeTrades().forEach(function(t){
    var k = (t.ticker || '').toUpperCase();
    if (seen[k]) dups[k] = (dups[k] || 1) + 1;
    seen[k] = true;
  });
  return Object.keys(dups);
}

/* ── FORMATTERS ── */
function fmt(n, d) {
  if (n == null || isNaN(n)) return '—';
  d = (d === undefined) ? 2 : d;
  var abs = Math.abs(n);
  if (abs >= 1000000) return (n/1000000).toFixed(2) + 'M';
  if (abs >= 1000)    return Number(n).toLocaleString('en', { minimumFractionDigits:0, maximumFractionDigits:0 });
  return Number(n).toFixed(d);
}
function money(n, currency, d) {
  if (n == null || isNaN(n)) return '—';
  var sym = curSym(currency || 'USD');
  var sign = n < 0 ? '-' : '';
  return sign + sym + fmt(Math.abs(n), d == null ? 0 : d);
}
function moneySigned(n, currency) {
  if (n == null || isNaN(n)) return '—';
  var sym = curSym(currency || 'USD');
  var sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return sign + sym + fmt(Math.abs(n), 0);
}
function rStr(v) { if (v==null) return '—'; return (v>0?'+':'') + v.toFixed(1) + 'R'; }
function pnlClass(v) { return v > 0 ? 'text-pos' : v < 0 ? 'text-neg' : 'text-muted'; }

/* ── HTML BADGES ── */
function dirBadge(d) { return '<span class="tdir ' + (d==='LONG'?'dl':'ds') + '">' + d + '</span>'; }
function statusBadge(s) {
  var cls = { PLANNING:'sp', ACTIVE:'sa', CLOSED:'sc' }[s] || 'sc';
  return '<span class="tstat ' + cls + '">' + s + '</span>';
}
function gradePill(label, grade) {
  if (!grade) return '<span class="gpill gb">' + label + ' —</span>';
  var cls = { A:'ga', B:'gb', C:'gc' }[grade] || 'gb';
  return '<span class="gpill ' + cls + '">' + label + ' ' + grade + '</span>';
}
function gradeClass(g) { return { A:'ga', B:'gb', C:'gc' }[g] || 'gb'; }

/* ── DATE HELPERS ── */
function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function nowIso() { return new Date().toISOString(); }
function shortDate(iso) { return iso ? String(iso).slice(0,10) : '—'; }

/* ── constants shared by pages ── */
var ENTRY_REASONS = ['4H Structure Confirmed','1H Consolidation Breakout','SMA26 > SMA69','Price > SMA69',
  'Low Not Breaking Low','High Breaking High','Volume Expansion','R:R >= 1:3','Clean Setup','Second Push','MTF Alignment'];
var MISTAKE_TAGS = ['Clean Execution','Squeezed Target','Chased Entry','Moved SL Early','Exited Too Early','Overleveraged','Revenge Trade'];
var MOODS = [
  { key:'CALIBRATED', label:'😌 Calibrated' },
  { key:'IMPATIENT',  label:'😤 Impatient' },
  { key:'REVENGE',    label:'😡 Revenge' },
  { key:'FOMO',       label:'😱 FOMO' }
];
var ASSET_TYPES = ['FOREX','STOCK','CRYPTO','KLCI'];
