/* ============================================================
   J.TRADEBOOK V2 — UTILITIES
   Calculation engine: position sizing, PnL/R, cash-flow-isolated
   balances, KPIs, portfolio heat, grade matrix, formatters.
   ============================================================ */

function round(n, d) { return +Number(n).toFixed(d == null ? 2 : d); }

/* ── CURRENCY ── */
var CURRENCY_SYMBOL = { USD:'$', USDT:'$', MYR:'RM', SGD:'S$', EUR:'€', GBP:'£', JPY:'¥', AUD:'A$', HKD:'HK$' };
function curSym(c) { return CURRENCY_SYMBOL[c] || (c ? c + ' ' : '$'); }

/* ── FX / REPORTING CURRENCY ──
   Rates are "1 unit of <currency> = X USD" (USD-anchored). The consolidated
   figure converts every account into the chosen base currency. All editable
   in Settings; sensible defaults below. */
var DEFAULT_FX = { USD:1, USDT:1, MYR:0.21, SGD:0.74, EUR:1.08, GBP:1.27, AUD:0.66, JPY:0.0064, HKD:0.128 };
function baseCurrency() { return (PREFS && PREFS.baseCurrency) || 'USD'; }
function fxRates() { return Object.assign({}, DEFAULT_FX, (PREFS && PREFS.fxRates) || {}); }
function usdPer(cur) { var r = fxRates(); return r[cur] != null ? r[cur] : 1; }
/* convert an amount in <cur> into the reporting base currency */
function toBase(amount, cur) {
  var r = fxRates();
  var usd = (amount || 0) * usdPer(cur);
  var baseUsd = r[baseCurrency()] || 1;
  return usd / baseUsd;
}

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

/* Account balance converted to the reporting base currency. */
function accountBalanceBase(accountId) {
  var a = getAccount(accountId); if (!a) return 0;
  return toBase(accountBalance(accountId), a.currency);
}
/* Consolidated balance across the current env's accounts, in base currency. */
function consolidatedBalanceBase() {
  return activeAccounts().filter(function(a){ return (a.env||'LIVE')===MODE; })
    .reduce(function(s,a){ return s + accountBalanceBase(a.id); }, 0);
}
/* Open risk ($ in the account's own currency) for one account, current mode. */
function accountOpenRisk(accountId) {
  return TRADES.filter(function(t){
    var s = tradeStatus(t);
    return t.accountId === accountId && t.mode === MODE && (s === 'ACTIVE' || s === 'PARTIAL');
  }).reduce(function(sum, t){ return sum + tradeOpenRisk(t); }, 0);
}
/* Per-account heat rows for the current env. */
function perAccountHeat() {
  return activeAccounts().filter(function(a){ return (a.env||'LIVE')===MODE; }).map(function(a){
    var risk = accountOpenRisk(a.id);
    var eq = accountBalance(a.id);
    return { account:a, risk:round(risk,2), pct: eq>0 ? round(risk/eq*100,1) : 0, currency:a.currency };
  }).filter(function(r){ return r.risk > 0; });
}

/* ── ASSET CLASSES ──
   Account-level asset class drives sizing. Sizes are stored in the natural
   unit of the class: shares (stocks), units (crypto), lots (forex/CFD).
   valuePerPoint = $ value of a 1.0 price move for ONE size-unit.
     MY_STOCK / US_STOCK / CRYPTO -> 1  (size counts the underlying directly)
     FOREX                        -> per-lot contract value (instrument table) */
var ASSET_CLASSES = [
  { key:'MY_STOCK', label:'Malaysia Stock (Bursa)', unit:'Shares', currency:'MYR', lotSize:100 },
  { key:'US_STOCK', label:'US Stock',                unit:'Shares', currency:'USD', fractional:true },
  { key:'CRYPTO',   label:'Crypto',                  unit:'Units',  currency:'USDT', fractional:true },
  { key:'FOREX',    label:'Forex / CFD',             unit:'Lots',   currency:'USD' }
];
function assetClassMeta(key) { return ASSET_CLASSES.find(function(a){ return a.key===key; }) || ASSET_CLASSES[1]; }

/* Default instrument contract table (value of a 1.0 price move per 1.0 lot).
   User-editable in Settings; stored in PREFS.instruments (keyed by symbol). */
var DEFAULT_INSTRUMENTS = {
  'XAUUSD': { valuePerPoint:100,    pip:0.1,    label:'Gold' },
  'XAGUSD': { valuePerPoint:5000,   pip:0.01,   label:'Silver' },
  'USOIL':  { valuePerPoint:1000,   pip:0.01,   label:'WTI Oil' },
  'WTI':    { valuePerPoint:1000,   pip:0.01,   label:'WTI Oil' },
  'US30':   { valuePerPoint:1,      pip:1,      label:'Dow' },
  'NAS100': { valuePerPoint:1,      pip:1,      label:'Nasdaq' },
  'SPX500': { valuePerPoint:1,      pip:1,      label:'S&P 500' }
};
function instrumentTable() {
  return Object.assign({}, DEFAULT_INSTRUMENTS, (PREFS && PREFS.instruments) || {});
}

/* Forex/CFD value-per-point + pip size for a symbol (with FX-major/JPY heuristics). */
function forexSpec(ticker, entry) {
  var tk = (ticker || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
  var tbl = instrumentTable();
  if (tbl[tk]) return { valuePerPoint: tbl[tk].valuePerPoint, pip: tbl[tk].pip, source:'table' };
  if (tk.indexOf('XAU') === 0) return { valuePerPoint:100,  pip:0.1,  source:'gold' };
  if (tk.indexOf('XAG') === 0) return { valuePerPoint:5000, pip:0.01, source:'silver' };
  // FX pairs
  var jpy = /JPY$/.test(tk);
  var pip = jpy ? 0.01 : 0.0001;
  // $10 per pip per std lot for USD-quoted majors; JPY pairs converted via price
  var pipValuePerLot = jpy ? (1000 / (entry || 150)) : 10;
  return { valuePerPoint: pipValuePerLot / pip, pip: pip, source: jpy ? 'fx-jpy' : 'fx-major' };
}

/* $ value of a 1.0 price move per 1 size-unit for an account's asset class. */
function valuePerPoint(assetClass, ticker, entry) {
  if (assetClass === 'FOREX') return forexSpec(ticker, entry).valuePerPoint;
  return 1;
}

/* Position size in the class's natural unit. Returns rich detail for the note. */
function computePositionSize(assetClass, ticker, entry, sl, riskAmt) {
  var meta = assetClassMeta(assetClass);
  var dist = Math.abs((+entry) - (+sl));
  var out = { size:0, unit:meta.unit, lots:null, valuePerPoint:1, pip:null, sub:'' };
  if (!dist || !riskAmt || !isFinite(dist)) return out;

  if (assetClass === 'MY_STOCK') {
    var shares = Math.floor(riskAmt / dist);
    out.size = shares; out.unit = 'Shares';
    out.lots = round(shares / (meta.lotSize||100), 2);
    out.valuePerPoint = 1;
    out.sub = out.lots + ' lots (100 sh)';
  } else if (assetClass === 'US_STOCK') {
    out.size = round(riskAmt / dist, 2); out.unit = 'Shares'; out.valuePerPoint = 1;
    out.sub = 'fractional ok';
  } else if (assetClass === 'CRYPTO') {
    out.size = round(riskAmt / dist, 4); out.unit = 'Units'; out.valuePerPoint = 1;
  } else { // FOREX / CFD
    var spec = forexSpec(ticker, entry);
    out.valuePerPoint = spec.valuePerPoint; out.pip = spec.pip;
    out.size = round(riskAmt / (dist * spec.valuePerPoint), 2);
    out.unit = 'Lots';
    out.sub = Math.round(dist / spec.pip) + ' pips';
  }
  return out;
}

/* A concise risk sentence for the calculator. */
function riskNote(assetClass, ticker, entry, sl, riskAmt, account) {
  var dist = Math.abs((+entry) - (+sl));
  if (!dist || !isFinite(dist)) return '';
  var pctOfEntry = round(dist / Math.abs(entry) * 100, 2);
  var priceStr;
  if (assetClass === 'FOREX') {
    var spec = forexSpec(ticker, entry);
    priceStr = Math.round(dist / spec.pip) + ' pips (' + pctOfEntry + '% of price)';
  } else {
    priceStr = fmtPrice(dist, entry) + ' move (' + pctOfEntry + '% of entry)';
  }
  var cur = account ? account.currency : 'USD';
  var acctPct = account ? round(riskAmt / accountEquity(account.id) * 100, 2) : null;
  var cashStr = money(riskAmt, cur) + (acctPct != null ? ' = ' + acctPct + '% of ' + account.name.split(' ')[0] : '');
  return 'Price risk: ' + priceStr + ' · Cash risk: ' + cashStr;
}

function fmtPrice(v, ref) { return Number(v).toFixed(priceDp(ref || v)); }
function unitLabel(assetClass) { return assetClassMeta(assetClass).unit; }

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

/* ── FILLS MODEL ──
   A trade holds entries[] (scale-in) and exits[] (scale-out). Legacy trades
   with only entryPrice/exitPrice are treated as a single fill each. */
function assetClassOf(t) {
  var a = getAccount(t.accountId);
  if (a && a.assetClass) return a.assetClass;
  return { STOCK:'US_STOCK', FOREX:'FOREX', CRYPTO:'CRYPTO', KLCI:'MY_STOCK' }[t.assetType] || 'US_STOCK';
}
function tradeVPP(t, price) {
  if (t.contractValue != null && t.contractValue > 0) return t.contractValue;   // locked at entry
  return valuePerPoint(assetClassOf(t), t.ticker, price != null ? price : t.entryPrice);
}
function dirSign(t) { return t.direction === 'SHORT' ? -1 : 1; }

function tradeEntries(t) {
  if (t.entries && t.entries.length) return t.entries;
  if (t.entryPrice != null) return [{ size: (t.executedSize != null ? t.executedSize : t.positionSize) || 0, price: t.entryPrice }];
  return [];
}
function tradeExits(t) {
  if (t.exits && t.exits.length) return t.exits;
  if (t.exitPrice != null) return [{ size: (t.executedSize != null ? t.executedSize : t.positionSize) || 0, price: t.exitPrice }];
  return [];
}
function sumSize(legs) { return legs.reduce(function(s,l){ return s + (+l.size || 0); }, 0); }
function tradeEntrySize(t) { return sumSize(tradeEntries(t)); }
function tradeExitSize(t)  { return sumSize(tradeExits(t)); }
function tradeOpenSize(t)  { return round(tradeEntrySize(t) - tradeExitSize(t), 6); }
function tradeAvgEntry(t) {
  var e = tradeEntries(t); var tot = sumSize(e);
  if (!tot) return t.entryPrice != null ? t.entryPrice : null;
  return e.reduce(function(s,l){ return s + (+l.size||0)*(+l.price||0); }, 0) / tot;
}

/* Effective status from fills (used to keep stored status honest). */
function tradeStatus(t) {
  if (t.status === 'PLANNING') return 'PLANNING';
  var open = tradeOpenSize(t), exited = tradeExitSize(t);
  if (open <= 1e-9) return 'CLOSED';
  if (exited > 1e-9) return 'PARTIAL';
  return 'ACTIVE';
}

/* Realized $ across all exit legs (asset-class correct via valuePerPoint). */
function tradeRealizedPnL(t) {
  var exits = tradeExits(t);
  if (!exits.length) return t.status === 'CLOSED' && t.realizedPnL != null ? t.realizedPnL : null;
  var avg = tradeAvgEntry(t), dir = dirSign(t);
  var pnl = exits.reduce(function(s, l){
    var vpp = tradeVPP(t, l.price);
    return s + (+l.size||0) * ((+l.price||0) - avg) * dir * vpp;
  }, 0);
  return round(pnl, 2);
}
/* Planned 1R in $ (the cash risk chosen at entry). */
function tradePlannedRisk(t) {
  if (t.riskAmount != null && t.riskAmount > 0) return t.riskAmount;
  var avg = tradeAvgEntry(t);
  if (avg == null || t.stopLossPrice == null) return null;
  return Math.abs(avg - t.stopLossPrice) * tradeEntrySize(t) * tradeVPP(t, avg);
}
/* Remaining open $ risk (drops toward 0 when SL is moved to breakeven). */
function tradeOpenRisk(t) {
  var open = tradeOpenSize(t);
  if (open <= 0 || t.stopLossPrice == null) return 0;
  var avg = tradeAvgEntry(t), dir = dirSign(t);
  var perUnit = (avg - t.stopLossPrice) * dir;   // >0 = risk below entry; <0 = stop in profit
  return Math.max(0, round(perUnit * open * tradeVPP(t, avg), 2));
}

/* Public PnL/R used everywhere. Null while still fully open. */
function tradePnL(t) {
  var st = tradeStatus(t);
  if (st === 'PLANNING' || st === 'ACTIVE') return null;
  var p = tradeRealizedPnL(t);
  return p == null ? null : p;
}
function tradeR(t) {
  var p = tradePnL(t);
  var risk = tradePlannedRisk(t);
  if (p == null || !risk) return null;
  return round(p / risk, 2);
}

/* ── VIEW FILTERS (respect global MODE + ACTIVE_ACCOUNT) ── */
function inAccount(t) { return ACTIVE_ACCOUNT === 'all' || t.accountId === ACTIVE_ACCOUNT; }

function tradesFor(mode) {
  return TRADES.filter(function(t){ return t.mode === mode && inAccount(t); });
}
function viewTrades()       { return tradesFor(MODE); }
function planningTrades()   { return viewTrades().filter(function(t){ return tradeStatus(t) === 'PLANNING'; }); }
/* open positions include partially-closed ones (they still carry risk) */
function activeTrades()     { return viewTrades().filter(function(t){ var s=tradeStatus(t); return s === 'ACTIVE' || s === 'PARTIAL'; }); }
function closedTrades(mode) { return tradesFor(mode || MODE).filter(function(t){ return tradeStatus(t) === 'CLOSED'; }); }

function isSameDay(iso, ref) {
  if (!iso) return false;
  return String(iso).slice(0,10) === ref;
}
function closedTodayTrades() {
  var today = todayStr();
  return viewTrades().filter(function(t){
    return tradeStatus(t) === 'CLOSED' && (isSameDay(t.exitTimestamp, today) || isSameDay(t.createdAt, today));
  });
}

/* ── KPIs (over a set of CLOSED trades) ── */
function kpiSet(trades) {
  var closed = trades.filter(function(t){ return tradeStatus(t) === 'CLOSED'; });
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
  var limit = PREFS.dailyLimitPct || 6;
  if (ACTIVE_ACCOUNT === 'all') {
    // convert each account's open risk to base currency before summing
    var risk = activeAccounts().filter(function(a){ return (a.env||'LIVE')===MODE; })
      .reduce(function(s,a){ return s + toBase(accountOpenRisk(a.id), a.currency); }, 0);
    var equity = consolidatedBalanceBase();
    return { risk: round(risk,2), pct: equity>0 ? round(risk/equity*100,1) : 0, limit: limit, equity: equity, currency: baseCurrency() };
  }
  var acc = getAccount(ACTIVE_ACCOUNT);
  var r = accountOpenRisk(ACTIVE_ACCOUNT);
  var eq = accountBalance(ACTIVE_ACCOUNT);
  return { risk: round(r,2), pct: eq>0 ? round(r/eq*100,1) : 0, limit: limit, equity: eq, currency: acc ? acc.currency : baseCurrency() };
}

/* ── NOTIONAL & MARGIN (account-type aware) ──
   notional = size × valuePerPoint × price  (works across asset classes:
   stocks/crypto valuePerPoint=1 so notional=size×price; forex lots use the
   contract value). Margin = notional ÷ leverage. */
function tradeNotional(assetClass, ticker, price, size) {
  return Math.abs(size) * valuePerPoint(assetClass, ticker, price) * Math.abs(price);
}
function isMarginAccount(a) { return a && (a.accountType === 'MARGIN' || a.assetClass === 'FOREX' || a.assetClass === 'CRYPTO'); }

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
function fmtN(v) { return v==null ? '—' : Number(v).toFixed(priceDp(v)); }
function lastExitPrice(t) { var x = tradeExits(t); return x.length ? x[x.length-1].price : t.exitPrice; }

/* ── HTML BADGES ── */
function dirBadge(d) { return '<span class="tdir ' + (d==='LONG'?'dl':'ds') + '">' + d + '</span>'; }
function statusBadge(s) {
  var cls = { PLANNING:'sp', ACTIVE:'sa', PARTIAL:'spt', CLOSED:'sc' }[s] || 'sc';
  var label = s === 'PARTIAL' ? 'PARTIAL' : s;
  return '<span class="tstat ' + cls + '">' + label + '</span>';
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

/* ── constants shared by pages ──
   Reason/mistake lists have editable defaults; user overrides live in PREFS
   (set in Settings) so they can add/refine/delete their own tags. */
var DEFAULT_ENTRY_REASONS = ['4H Structure Confirmed','1H Consolidation Breakout','SMA26 > SMA69','Price > SMA69',
  'Low Not Breaking Low','High Breaking High','Volume Expansion','R:R >= 1:3','Clean Setup','Second Push','MTF Alignment'];
var DEFAULT_MISTAKE_TAGS = ['Clean Execution','Squeezed Target','Chased Entry','Moved SL Early','Exited Too Early','Overleveraged','Revenge Trade'];

function entryReasons() { return (PREFS && PREFS.entryReasons && PREFS.entryReasons.length) ? PREFS.entryReasons : DEFAULT_ENTRY_REASONS; }
function exitReasons()  { return (PREFS && PREFS.exitReasons && PREFS.exitReasons.length) ? PREFS.exitReasons : DEFAULT_MISTAKE_TAGS; }

/* back-compat aliases used by older page code */
var ENTRY_REASONS = DEFAULT_ENTRY_REASONS;
var MISTAKE_TAGS = DEFAULT_MISTAKE_TAGS;

var MOODS = [
  { key:'CALIBRATED', label:'😌 Calibrated' },
  { key:'IMPATIENT',  label:'😤 Impatient' },
  { key:'REVENGE',    label:'😡 Revenge' },
  { key:'FOMO',       label:'😱 FOMO' }
];
var ASSET_TYPES = ['FOREX','STOCK','CRYPTO','KLCI'];
