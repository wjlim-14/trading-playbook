/* ── ACCOUNT HELPERS ── */
function getAccount(id) {
  return ACCOUNTS.find(function(a){ return a.id === id; });
}

function getAccountForMarket(market) {
  var map = { 'KLCI':'my', 'US Stocks':'us', 'Crypto':'cr', 'Forex':'fx' };
  return getAccount(map[market] || 'my');
}

/* ── TRADE HELPERS ── */
function calcPnL(t) {
  if (t.exit == null) return null;
  var dir = t.dir === 'LONG' ? 1 : -1;
  return +(dir * (t.exit - t.entry) * t.units).toFixed(2);
}

function calcR(t) {
  if (t.exit == null) return null;
  var pnl = calcPnL(t);
  var risk = Math.abs(t.entry - t.sl) * t.units;
  if (!risk) return null;
  return +(pnl / risk).toFixed(2);
}

function calcUnrealisedPnL(t) {
  if (t.exit != null || !t.currentPrice) return null;
  var dir = t.dir === 'LONG' ? 1 : -1;
  return +(dir * (t.currentPrice - t.entry) * t.units).toFixed(2);
}

function calcRLive(t) {
  var unr = calcUnrealisedPnL(t);
  if (unr == null) return null;
  var risk = Math.abs(t.entry - t.sl) * t.units;
  if (!risk) return null;
  return +(unr / risk).toFixed(2);
}

function calcRiskAmt(t) {
  return +(Math.abs(t.entry - t.sl) * t.units).toFixed(2);
}

function getHoldings() {
  return JOURNAL.filter(function(t){ return t.exit == null; });
}

function getClosedTrades() {
  return JOURNAL.filter(function(t){ return t.exit != null; });
}

function getTotalOpenRisk() {
  return getHoldings().reduce(function(sum, t){
    var acct = getAccount(t.accountId);
    if (!acct) return sum;
    return sum + (calcRiskAmt(t) / acct.equity * 100);
  }, 0);
}

/* ── NUMBER FORMATTING ── */
function fmt(n, d) {
  if (n == null || isNaN(n)) return '—';
  d = (d === undefined) ? 2 : d;
  var abs = Math.abs(n);
  if (abs >= 1000000) return (n/1000000).toFixed(1) + 'M';
  if (abs >= 10000)   return Number(n).toLocaleString('en', {minimumFractionDigits:0, maximumFractionDigits:0});
  return Number(n).toFixed(d);
}

function fmtSigned(n, d) {
  if (n == null) return '—';
  var sign = n > 0 ? '+' : '';
  return sign + fmt(n, d);
}

function fmtDate(d) {
  if (!d) return '—';
  return d;
}

/* ── P&L / R FORMATTED HTML ── */
function pnlHtml(v, currency) {
  if (v == null) return '<span class="badge badge-open">OPEN</span>';
  var cls   = v > 0 ? 'text-pos' : v < 0 ? 'text-neg' : 'text-muted';
  var sign  = v > 0 ? '+' : '';
  var cur   = currency ? ' ' + currency : '';
  return '<span class="td-mono ' + cls + '">' + sign + fmt(v, 0) + cur + '</span>';
}

function rHtml(v) {
  if (v == null) return '<span class="text-muted">—</span>';
  var cls  = v > 0 ? 'text-pos' : v < 0 ? 'text-neg' : 'text-muted';
  var sign = v > 0 ? '+' : '';
  return '<span class="td-mono ' + cls + '">' + sign + fmt(v, 2) + 'R</span>';
}

/* ── BADGE HTML ── */
function marketBadge(m) {
  var cls = { 'KLCI':'badge-klci', 'Crypto':'badge-crypto', 'US Stocks':'badge-us', 'Forex':'badge-forex' }[m] || 'badge-neut';
  return '<span class="badge ' + cls + '">' + m + '</span>';
}

function dirBadge(d) {
  return d === 'LONG'
    ? '<span class="badge badge-long">LONG</span>'
    : '<span class="badge badge-short">SHORT</span>';
}

function trendBadge(t) {
  if (t === 'BULLISH') return '<span class="badge badge-bull">BULL</span>';
  if (t === 'BEARISH') return '<span class="badge badge-bear">BEAR</span>';
  return '<span class="badge badge-neut">NEUT</span>';
}

function statusBadge(t) {
  if (t.exit == null) return '<span class="badge badge-open">OPEN</span>';
  var pnl = calcPnL(t);
  if (pnl > 0)  return '<span class="badge badge-win">WIN</span>';
  if (pnl < 0)  return '<span class="badge badge-loss">LOSS</span>';
  return '<span class="badge badge-be">B/E</span>';
}

function moodClass(m) {
  var map = { 'Calm':'mood-calm','Confident':'mood-confident','Neutral':'mood-neutral','FOMO':'mood-fomo','Rushed':'mood-rushed','Impatient':'mood-impatient' };
  return map[m] || '';
}

/* ── STATS HELPERS ── */
function winRate(trades) {
  var closed = trades.filter(function(t){ return t.exit != null; });
  if (!closed.length) return 0;
  var wins = closed.filter(function(t){ return calcPnL(t) > 0; });
  return +(wins.length / closed.length * 100).toFixed(1);
}

function avgR(trades) {
  var closed = trades.filter(function(t){ return t.exit != null; });
  if (!closed.length) return 0;
  var sum = closed.reduce(function(s,t){ return s + (calcR(t)||0); }, 0);
  return +(sum / closed.length).toFixed(2);
}

function maxDrawdown(trades) {
  var closed = trades.filter(function(t){ return t.exit != null; });
  var peak = 0, dd = 0, running = 0;
  closed.forEach(function(t){
    running += calcPnL(t)||0;
    if (running > peak) peak = running;
    if (peak - running > dd) dd = peak - running;
  });
  return +dd.toFixed(2);
}

/* ── NEXT ID ── */
function nextId() {
  if (!JOURNAL.length) return 1;
  return Math.max.apply(null, JOURNAL.map(function(t){ return t.id; })) + 1;
}

/* ── CURRENT DATE HELPERS ── */
function currentMonthLabel() {
  var now = new Date();
  return now.toLocaleDateString('en-US', { month:'long', year:'numeric' });
}

function currentYearStr() {
  return String(new Date().getFullYear());
}

function currentMonthStr() {
  var now = new Date();
  var m   = String(now.getMonth() + 1).padStart(2, '0');
  return now.getFullYear() + '-' + m;
}
