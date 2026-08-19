/* ============================================================
   J.TRADEBOOK V2 — DATA / STATE LAYER
   Global mutable state + thin API client over the Vercel
   serverless functions in /api/*.
   ============================================================ */

var _apiAvailable = false;

/* ── STATE ── */
var ACCOUNTS     = [];   // Account[]
var TRADES       = [];   // TradeRecord[]  (LIVE + BACKTEST, filtered per view)
var TRANSACTIONS = [];   // AccountTransaction[]
var PREFS        = { defaultRiskPct: 2, dailyLimitPct: 6, mode: 'LIVE', activeAccountId: null };

var MODE           = 'LIVE';   // 'LIVE' | 'BACKTEST'
var ACTIVE_ACCOUNT = 'all';    // 'all' | account id
var DEMO_MODE      = false;    // true when running on local mock data (API unavailable)

/* ── BOOTSTRAP ── */
function _initData() {
  // Load each endpoint independently — one failing endpoint must NOT drop the
  // whole app to demo. Demo is only for a truly unreachable backend.
  function getJson(path){ return fetch(path).then(function(r){ if(!r.ok) throw new Error(path+' '+r.status); return r.json(); }); }
  return Promise.allSettled([
    getJson('/api/accounts'),
    getJson('/api/trades'),
    getJson('/api/transactions'),
    getJson('/api/prefs')
  ]).then(function(res) {
    var val = function(r){ return r.status === 'fulfilled' ? r.value : null; };
    var acc = val(res[0]), tr = val(res[1]), tx = val(res[2]), pr = val(res[3]);
    res.forEach(function(r,i){ if (r.status==='rejected') console.warn('[J.Tradebook] endpoint failed:', ['accounts','trades','transactions','prefs'][i], r.reason && r.reason.message); });

    // Backend is "reachable" if the core endpoints (accounts/trades) responded.
    var reachable = acc !== null || tr !== null;
    if (!reachable) {
      _apiAvailable = false;
      if (_demoDisabled()) { DEMO_MODE = false; ACCOUNTS=[]; TRADES=[]; TRANSACTIONS=[]; }
      else loadMockData();
      return;
    }
    _apiAvailable = true;
    DEMO_MODE = false;                 // connected — real data, even if one endpoint hiccuped
    ACCOUNTS     = acc || [];
    TRADES       = tr  || [];
    TRANSACTIONS = tx  || [];
    PREFS        = Object.assign({ defaultRiskPct:2, dailyLimitPct:6 }, pr || {});
    MODE = PREFS.mode || 'LIVE';
    if (PREFS.activeAccountId && ACCOUNTS.some(function(a){return a.id===PREFS.activeAccountId;})) {
      ACTIVE_ACCOUNT = PREFS.activeAccountId;
    }
  });
}

function _demoDisabled() {
  try { return /[?&]nodemo(=1)?(&|$)/.test(location.search); } catch (e) { return false; }
}

/* ── DEMO / MOCK DATA ──
   Loaded when the API is unreachable OR the database is empty, so the whole
   UI can be reviewed without a live backend. Writes are kept in-memory only
   while in DEMO_MODE (they won't persist), which keeps the app fully usable. */
function loadMockData() {
  DEMO_MODE = true;
  ACCOUNTS = [
    { id:'a1', name:'US — Moomoo',   broker:'Moomoo',  accountType:'PERSONAL_SPOT', assetClass:'US_STOCK', env:'LIVE', currency:'USD',  initialBalance:10000, currentBalance:12686, isArchived:false, createdAt:'2026-05-01T00:00:00Z' },
    { id:'a2', name:'Malaysia — RHB', broker:'RHB',    accountType:'PERSONAL_SPOT', assetClass:'MY_STOCK', env:'LIVE', currency:'MYR',  initialBalance:50000, currentBalance:53200, isArchived:false, createdAt:'2026-05-02T00:00:00Z' },
    { id:'a3', name:'Forex — FTMO',   broker:'FTMO',   accountType:'PROP_FIRM',     assetClass:'FOREX',    env:'LIVE', currency:'USD',  initialBalance:100000, currentBalance:104200, isArchived:false, createdAt:'2026-05-03T00:00:00Z' },
    { id:'a4', name:'Crypto — Binance', broker:'Binance', accountType:'MARGIN',     assetClass:'CRYPTO',   env:'LIVE', currency:'USDT', initialBalance:5000,  currentBalance:5920,  isArchived:false, createdAt:'2026-05-05T00:00:00Z' },
    // fixed backtest accounts
    { id:'bt-my', name:'Backtest — Malaysia Stock', broker:'Bursa', accountType:'PERSONAL_SPOT', assetClass:'MY_STOCK', env:'BACKTEST', currency:'MYR',  initialBalance:100000, currentBalance:100000, isArchived:false, createdAt:'2026-05-01T00:00:00Z' },
    { id:'bt-us', name:'Backtest — US Stock',       broker:'',      accountType:'PERSONAL_SPOT', assetClass:'US_STOCK', env:'BACKTEST', currency:'USD',  initialBalance:100000, currentBalance:100000, isArchived:false, createdAt:'2026-05-01T00:00:00Z' },
    { id:'bt-fx', name:'Backtest — Forex',          broker:'',      accountType:'MARGIN',        assetClass:'FOREX',    env:'BACKTEST', currency:'USD',  initialBalance:100000, currentBalance:100000, isArchived:false, createdAt:'2026-05-01T00:00:00Z' },
    { id:'bt-cr', name:'Backtest — Crypto',         broker:'',      accountType:'MARGIN',        assetClass:'CRYPTO',   env:'BACKTEST', currency:'USDT', initialBalance:100000, currentBalance:100000, isArchived:false, createdAt:'2026-05-01T00:00:00Z' }
  ];
  TRANSACTIONS = [
    { id:'x1', accountId:'a1', type:'DEPOSIT',     amount:10000, fee:0,  date:'2026-05-01', notes:'Initial capital', createdAt:'2026-05-01' },
    { id:'x2', accountId:'a1', type:'DEPOSIT',     amount:3000,  fee:0,  date:'2026-06-01', notes:'Top up',          createdAt:'2026-06-01' },
    { id:'x3', accountId:'a1', type:'WITHDRAWAL',  amount:500,   fee:2,  date:'2026-07-15', notes:'Profit take',     createdAt:'2026-07-15' },
    { id:'x4', accountId:'a3', type:'PROP_PAYOUT', amount:4000,  fee:0,  date:'2026-07-20', notes:'Payout cycle 1',  createdAt:'2026-07-20' },
    { id:'x5', accountId:'a4', type:'DEPOSIT',     amount:5000,  fee:0,  date:'2026-05-05', notes:'Seed',            createdAt:'2026-05-05' }
  ];
  TRADES = _mockTrades();
  PREFS = { defaultRiskPct:2, dailyLimitPct:6, mode:'LIVE', activeAccountId:null, baseCurrency:'USD' };
}

function _mk(o) {
  // fill schema defaults so every page renders cleanly
  return Object.assign({
    mode:'LIVE', entryReasonTags:[], mistakeTags:[], reviewComplete:false,
    preChartUrl4H:null, preChartUrl1H:null, postChartUrl4H:null, postChartUrl1H:null,
    tfHigh:'4h', tfLow:'1h', preShots:[], postShots:[],
    setupNotes:'', reflectionNote:'', log:[]
  }, o);
}

function _mockTrades() {
  return _mockTradesV3();
}
function _mockTradesV3() {
  return [
    // US stock — closed, clean A/A
    _mk({ id:'t1', accountId:'a1', ticker:'NVDA', direction:'LONG', assetType:'STOCK', status:'CLOSED',
      entryPrice:118.4, stopLossPrice:112, targetPrice:138, positionSize:19, executedSize:19, riskAmount:122, riskPct:1, plannedRR:3,
      entryGrade:'A', preTradeMood:'CALIBRATED', entryReasonTags:['4H Structure Confirmed','Volume Expansion'],
      entries:[{size:19,price:118.4,time:'2026-08-11T08:00:00Z'}], exits:[{size:19,price:138,time:'2026-08-12T15:00:00Z'}],
      realizedPnL:372, realizedR:3.05, exitGrade:'A', mistakeTags:['Clean Execution'], reflectionNote:'Held the runner, textbook.',
      reviewComplete:true, exitTimestamp:'2026-08-12T15:00:00Z', createdAt:'2026-08-11T08:00:00Z' }),
    // Malaysia stock — closed (shares / lots)
    _mk({ id:'t2', accountId:'a2', ticker:'MAYBANK', direction:'LONG', assetType:'KLCI', status:'CLOSED',
      entryPrice:9.20, stopLossPrice:8.90, targetPrice:10.10, positionSize:1000, executedSize:1000, riskAmount:300, riskPct:0.6, plannedRR:3,
      entryGrade:'B', preTradeMood:'CALIBRATED', entryReasonTags:['SMA26 > SMA69'],
      entries:[{size:1000,price:9.20}], exits:[{size:1000,price:9.68}],
      realizedPnL:480, realizedR:1.6, exitGrade:'B', mistakeTags:['Squeezed Target'], reflectionNote:'Exited a touch early.',
      reviewComplete:true, exitTimestamp:'2026-08-13T09:00:00Z', createdAt:'2026-08-12T02:00:00Z' }),
    // Forex gold — closed (lots, contract value locked)
    _mk({ id:'t3', accountId:'a3', ticker:'XAUUSD', direction:'LONG', assetType:'FOREX', status:'CLOSED',
      entryPrice:2318.5, stopLossPrice:2305, targetPrice:2358.5, positionSize:0.09, executedSize:0.09, contractValue:100, riskAmount:121.5, riskPct:0.12, plannedRR:3,
      entryGrade:'A', preTradeMood:'CALIBRATED', entryReasonTags:['4H Structure Confirmed','R:R >= 1:3'],
      entries:[{size:0.09,price:2318.5}], exits:[{size:0.09,price:2350}],
      realizedPnL:283, realizedR:2.33, exitGrade:'A', mistakeTags:['Clean Execution'], reflectionNote:'Patience on the 1H trigger.',
      reviewComplete:true, exitTimestamp:'2026-08-14T13:00:00Z', createdAt:'2026-08-13T07:00:00Z' }),
    // Crypto — PARTIAL: sold half, SL moved to breakeven, runner open
    _mk({ id:'t4', accountId:'a4', ticker:'BTCUSDT', direction:'LONG', assetType:'CRYPTO', status:'PARTIAL',
      entryPrice:61200, stopLossPrice:61200, targetPrice:66300, positionSize:0.058, executedSize:0.058, riskAmount:98.6, riskPct:1.9, plannedRR:3,
      entryGrade:'A', preTradeMood:'CALIBRATED', entryReasonTags:['1H Consolidation Breakout','High Breaking High'], setupNotes:'Secured initial capital at +2R, runner to the moon.',
      entries:[{size:0.058,price:61200,time:'2026-08-16T18:00:00Z'}],
      exits:[{size:0.029,price:65100,time:'2026-08-17T10:00:00Z',note:'secured initial capital'}],
      exitTimestamp:'2026-08-17T10:00:00Z', createdAt:'2026-08-16T18:00:00Z',
      log:[
        {time:'2026-08-16T18:00:00Z', text:'Planned · LONG BTCUSDT @ 61200, SL 59500 · size 0.058 units · Entry grade A'},
        {time:'2026-08-16T18:05:00Z', text:'Executed · 0.058 @ 61200'},
        {time:'2026-08-17T10:00:00Z', text:'Took partial 0.029 @ 65100 · secured initial capital · 0.029 left'},
        {time:'2026-08-17T10:01:00Z', text:'Moved stop to 61200 (breakeven)'}
      ] }),
    // US stock — active
    _mk({ id:'t5', accountId:'a1', ticker:'AAPL', direction:'LONG', assetType:'STOCK', status:'ACTIVE',
      entryPrice:228.5, stopLossPrice:222, targetPrice:248, positionSize:18, executedSize:18, riskAmount:117, riskPct:0.9, plannedRR:3,
      entryGrade:'A', preTradeMood:'CALIBRATED', entryReasonTags:['4H Structure Confirmed','Price > SMA69'],
      entries:[{size:18,price:228.5}], setupNotes:'Breakout retest holding.', createdAt:'2026-08-18T08:00:00Z' }),
    // Forex — active
    _mk({ id:'t6', accountId:'a3', ticker:'EURUSD', direction:'LONG', assetType:'FOREX', status:'ACTIVE',
      entryPrice:1.0740, stopLossPrice:1.0700, targetPrice:1.0860, positionSize:0.5, executedSize:0.5, contractValue:100000, riskAmount:200, riskPct:0.2, plannedRR:3,
      entryGrade:'B', preTradeMood:'CALIBRATED', entryReasonTags:['MTF Alignment'],
      entries:[{size:0.5,price:1.0740}], createdAt:'2026-08-18T09:30:00Z' }),
    // Crypto — planning
    _mk({ id:'t7', accountId:'a4', ticker:'ETHUSDT', direction:'LONG', assetType:'CRYPTO', status:'PLANNING',
      entryPrice:2620, stopLossPrice:2540, targetPrice:2860, positionSize:1.19, executedSize:1.19, riskAmount:95, riskPct:1.9, plannedRR:3,
      entryGrade:'A', preTradeMood:'CALIBRATED', entryReasonTags:['4H Structure Confirmed'], setupNotes:'Waiting for 1H trigger.', createdAt:'2026-08-18T10:00:00Z' }),
    // Backtest (isolated)
    _mk({ id:'bx1', accountId:'bt-us', mode:'BACKTEST', ticker:'MSFT', direction:'LONG', assetType:'STOCK', status:'CLOSED',
      entryPrice:415, stopLossPrice:405, targetPrice:445, positionSize:10, executedSize:10, riskAmount:100, plannedRR:3,
      entryGrade:'A', entries:[{size:10,price:415}], exits:[{size:10,price:441}], realizedPnL:260, realizedR:2.6, exitGrade:'A',
      reviewComplete:true, exitTimestamp:'2026-08-10T00:00:00Z', createdAt:'2026-08-09T00:00:00Z' }),
    _mk({ id:'bx2', accountId:'bt-fx', mode:'BACKTEST', ticker:'XAUUSD', direction:'SHORT', assetType:'FOREX', status:'CLOSED',
      entryPrice:2402, stopLossPrice:2416, targetPrice:2360, positionSize:0.07, executedSize:0.07, contractValue:100, riskAmount:98, plannedRR:3,
      entryGrade:'B', entries:[{size:0.07,price:2402}], exits:[{size:0.07,price:2374}], realizedPnL:196, realizedR:2, exitGrade:'B',
      reviewComplete:true, exitTimestamp:'2026-08-12T00:00:00Z', createdAt:'2026-08-11T00:00:00Z' })
  ];
}
function _mockTradesOld() {
  var T = [
    // ── LIVE closed (mix of grades for KPIs + matrix) ──
    _mk({ id:'t1', accountId:'a1', ticker:'XAUUSD', direction:'LONG', assetType:'FOREX', status:'CLOSED',
      entryPrice:2318.5, stopLossPrice:2305, targetPrice:2358.5, positionSize:0.62, riskAmount:124, riskPct:1, plannedRR:3,
      entryGrade:'A', preTradeMood:'CALIBRATED', entryReasonTags:['4H Structure Confirmed','R:R >= 1:3','Clean Setup'],
      setupNotes:'4H uptrend, 1H tight consolidation breakout.', exitPrice:2350.2, realizedR:2.35, realizedPnL:291,
      exitGrade:'A', mistakeTags:['Clean Execution'], reflectionNote:'Patience paid off — never touched the SL.',
      reviewComplete:true, entryTimestamp:'2026-08-11T08:00:00Z', exitTimestamp:'2026-08-12T13:00:00Z', createdAt:'2026-08-11T08:00:00Z' }),
    _mk({ id:'t2', accountId:'a1', ticker:'NVDA', direction:'LONG', assetType:'STOCK', status:'CLOSED',
      entryPrice:118.4, stopLossPrice:112, targetPrice:138, positionSize:19, riskAmount:122, riskPct:1, plannedRR:3,
      entryGrade:'A', preTradeMood:'CALIBRATED', entryReasonTags:['SMA26 > SMA69','Volume Expansion'],
      exitPrice:120.1, realizedR:0.27, realizedPnL:32, exitGrade:'C', mistakeTags:['Exited Too Early','Squeezed Target'],
      reflectionNote:'Panicked on a red candle and cut a good runner.', reviewComplete:true,
      exitTimestamp:'2026-08-13T15:00:00Z', createdAt:'2026-08-12T09:00:00Z' }),
    _mk({ id:'t3', accountId:'a2', ticker:'EURUSD', direction:'SHORT', assetType:'FOREX', status:'CLOSED',
      entryPrice:1.0912, stopLossPrice:1.0952, targetPrice:1.0792, positionSize:0.5, riskAmount:200, riskPct:0.2, plannedRR:3,
      entryGrade:'B', preTradeMood:'CALIBRATED', entryReasonTags:['4H Structure Confirmed','MTF Alignment'],
      exitPrice:1.0812, realizedR:2.5, realizedPnL:500, exitGrade:'A', mistakeTags:['Clean Execution'],
      reflectionNote:'Textbook trend continuation.', reviewComplete:true,
      exitTimestamp:'2026-08-14T11:00:00Z', createdAt:'2026-08-13T07:00:00Z' }),
    _mk({ id:'t4', accountId:'a1', ticker:'TSLA', direction:'SHORT', assetType:'STOCK', status:'CLOSED',
      entryPrice:245.6, stopLossPrice:252, targetPrice:226, positionSize:12, riskAmount:82, riskPct:0.6, plannedRR:3,
      entryGrade:'C', preTradeMood:'FOMO', entryReasonTags:['Second Push'], setupNotes:'Chased a breakdown.',
      exitPrice:258.3, realizedR:-1, realizedPnL:-82, exitGrade:'C', mistakeTags:['Chased Entry','Revenge Trade'],
      reflectionNote:'', reviewComplete:false, exitTimestamp:'2026-08-15T14:00:00Z', createdAt:'2026-08-15T09:00:00Z' }),
    _mk({ id:'t5', accountId:'a3', ticker:'BTCUSDT', direction:'LONG', assetType:'CRYPTO', status:'CLOSED',
      entryPrice:61200, stopLossPrice:59500, targetPrice:66300, positionSize:0.058, riskAmount:98, riskPct:1.9, plannedRR:3,
      entryGrade:'B', preTradeMood:'CALIBRATED', entryReasonTags:['1H Consolidation Breakout','High Breaking High'],
      exitPrice:65100, realizedR:2.29, realizedPnL:225, exitGrade:'B', mistakeTags:['Squeezed Target'],
      reflectionNote:'Good trade, left a bit on the table.', reviewComplete:true,
      exitTimestamp:'2026-08-16T20:00:00Z', createdAt:'2026-08-15T18:00:00Z' }),
    // ── LIVE active ──
    _mk({ id:'t6', accountId:'a1', ticker:'AAPL', direction:'LONG', assetType:'STOCK', status:'ACTIVE',
      entryPrice:228.5, stopLossPrice:222, targetPrice:248, positionSize:18, riskAmount:117, riskPct:0.9, plannedRR:3,
      entryGrade:'A', preTradeMood:'CALIBRATED', entryReasonTags:['4H Structure Confirmed','Price > SMA69','Volume Expansion'],
      setupNotes:'Breakout retest holding above SMA69.', entryTimestamp:'2026-08-18T08:00:00Z', createdAt:'2026-08-18T08:00:00Z' }),
    _mk({ id:'t7', accountId:'a2', ticker:'GBPUSD', direction:'LONG', assetType:'FOREX', status:'ACTIVE',
      entryPrice:1.2740, stopLossPrice:1.2700, targetPrice:1.2860, positionSize:0.75, riskAmount:300, riskPct:0.3, plannedRR:3,
      entryGrade:'B', preTradeMood:'CALIBRATED', entryReasonTags:['1H Consolidation Breakout','MTF Alignment'],
      setupNotes:'', entryTimestamp:'2026-08-18T09:30:00Z', createdAt:'2026-08-18T09:30:00Z' }),
    // ── LIVE planning ──
    _mk({ id:'t8', accountId:'a3', ticker:'ETHUSDT', direction:'LONG', assetType:'CRYPTO', status:'PLANNING',
      entryPrice:2620, stopLossPrice:2540, targetPrice:2860, positionSize:1.19, riskAmount:95, riskPct:1.6, plannedRR:3,
      entryGrade:'A', preTradeMood:'CALIBRATED', entryReasonTags:['4H Structure Confirmed','SMA26 > SMA69'],
      setupNotes:'Waiting for the 1H trigger.', entryTimestamp:'2026-08-18T10:00:00Z', createdAt:'2026-08-18T10:00:00Z' }),
    // ── BACKTEST (isolated) ──
    _mk({ id:'b1', accountId:'a1', mode:'BACKTEST', ticker:'AAPL', direction:'LONG', assetType:'STOCK', status:'CLOSED',
      entryPrice:182.4, stopLossPrice:176, targetPrice:200, positionSize:15, riskAmount:96, riskPct:1, plannedRR:2.8,
      entryGrade:'A', exitPrice:196.8, realizedR:2.25, realizedPnL:216, exitGrade:'A', reviewComplete:true,
      exitTimestamp:'2026-08-10T00:00:00Z', createdAt:'2026-08-09T00:00:00Z' }),
    _mk({ id:'b2', accountId:'a1', mode:'BACKTEST', ticker:'MSFT', direction:'LONG', assetType:'STOCK', status:'CLOSED',
      entryPrice:415.2, stopLossPrice:408, targetPrice:437, positionSize:13, riskAmount:94, riskPct:1, plannedRR:3,
      entryGrade:'B', exitPrice:408, realizedR:-1, realizedPnL:-94, exitGrade:'B', reviewComplete:true,
      exitTimestamp:'2026-08-11T00:00:00Z', createdAt:'2026-08-10T00:00:00Z' }),
    _mk({ id:'b3', accountId:'a1', mode:'BACKTEST', ticker:'XAUUSD', direction:'SHORT', assetType:'FOREX', status:'CLOSED',
      entryPrice:2402, stopLossPrice:2416, targetPrice:2360, positionSize:0.5, riskAmount:70, riskPct:0.7, plannedRR:3,
      entryGrade:'A', exitPrice:2364, realizedR:2.71, realizedPnL:190, exitGrade:'A', reviewComplete:true,
      exitTimestamp:'2026-08-12T00:00:00Z', createdAt:'2026-08-11T00:00:00Z' })
  ];
  return T;
}

function okJson(label) {
  return function(r) { if (!r.ok) throw new Error(label + ' ' + r.status); return r.json(); };
}

/* ── GENERIC REST HELPERS ── */
function _req(path, method, body) {
  var opt = { method: method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opt.body = JSON.stringify(body);
  return fetch(path, opt).then(function(r) {
    if (r.status === 204) return null;
    if (!r.ok) return r.json().then(function(j){ throw new Error(j.error || r.status); });
    return r.json();
  });
}

var _demoSeq = 1000;
function _demoId(prefix) { return (prefix || 'd') + '-' + (_demoSeq++); }

/* ── TRADES ── */
function apiCreateTrade(t)  {
  if (DEMO_MODE) { var row = Object.assign({ id:_demoId('t'), createdAt:new Date().toISOString(), entryReasonTags:t.entryReasonTags||[], mistakeTags:t.mistakeTags||[] }, t); TRADES.push(row); return Promise.resolve(row); }
  return _req('/api/trades', 'POST', t).then(function(row){ if(row) TRADES.push(row); return row; });
}
function apiUpdateTrade(t)  {
  if (DEMO_MODE) { var cur = TRADES.find(function(x){return x.id===t.id;}); if(cur) Object.assign(cur, t); return Promise.resolve(cur); }
  return _req('/api/trades', 'PATCH', t).then(function(row){ if(row) _replace(TRADES, row); return row; });
}
function apiDeleteTrade(id) {
  if (DEMO_MODE) { _remove(TRADES, id); return Promise.resolve(); }
  return _req('/api/trades', 'DELETE', { id: id }).then(function(){ _remove(TRADES, id); });
}

/* ── ACCOUNTS ── */
function apiCreateAccount(a)  {
  if (DEMO_MODE) { var row = Object.assign({ id:_demoId('a'), isArchived:false, createdAt:new Date().toISOString() }, a); ACCOUNTS.push(row); return Promise.resolve(row); }
  return _req('/api/accounts', 'POST', a).then(function(row){ if(row) ACCOUNTS.push(row); return row; });
}
function apiUpdateAccount(a)  {
  if (DEMO_MODE) { var cur = ACCOUNTS.find(function(x){return x.id===a.id;}); if(cur) Object.assign(cur, a); return Promise.resolve(cur); }
  return _req('/api/accounts', 'PATCH', a).then(function(row){ if(row) _replace(ACCOUNTS, row); return row; });
}
function apiDeleteAccount(id) {
  if (DEMO_MODE) { _remove(ACCOUNTS, id); return Promise.resolve(); }
  return _req('/api/accounts', 'DELETE', { id: id }).then(function(){ _remove(ACCOUNTS, id); });
}

/* ── TRANSACTIONS ── */
function apiCreateTransaction(t)  {
  if (DEMO_MODE) { var row = Object.assign({ id:_demoId('x'), createdAt:new Date().toISOString(), fee:t.fee||0 }, t); TRANSACTIONS.push(row); return Promise.resolve(row); }
  return _req('/api/transactions', 'POST', t).then(function(row){ if(row) TRANSACTIONS.push(row); return row; });
}
function apiDeleteTransaction(id) {
  if (DEMO_MODE) { _remove(TRANSACTIONS, id); return Promise.resolve(); }
  return _req('/api/transactions', 'DELETE', { id: id }).then(function(){ _remove(TRANSACTIONS, id); });
}

/* ── PREFS ── */
function apiSavePrefs(p) {
  PREFS = Object.assign({}, PREFS, p);
  if (DEMO_MODE) return Promise.resolve(PREFS);
  return _req('/api/prefs', 'PUT', PREFS).catch(function(e){ console.warn('prefs save failed', e); });
}

/* ── IMAGE UPLOAD (base64 -> storage) ── */
function apiUpload(dataUrl, name) {
  if (DEMO_MODE) return Promise.resolve(dataUrl);   // keep the pasted image in-memory
  return _req('/api/upload', 'POST', { data: dataUrl, name: name }).then(function(r){ return r ? r.url : null; });
}

/* ── TRADE LOG (audit trail) ──
   Append a timestamped event to a trade's log and return the new array to
   include in the next PATCH. */
function _appendLog(id, text) {
  var t = TRADES.find(function(x){ return x.id === id; });
  var log = (t && t.log) ? t.log.slice() : [];
  log.push({ time: new Date().toISOString(), text: text });
  return log;
}
/* Update a trade AND record a log line in one call. */
function saveTradeLog(patch, text) {
  if (text) patch.log = _appendLog(patch.id, text);
  return apiUpdateTrade(patch);
}

/* ── local array helpers ── */
function _replace(arr, row) {
  for (var i = 0; i < arr.length; i++) if (arr[i].id === row.id) { arr[i] = row; return; }
  arr.push(row);
}
function _remove(arr, id) {
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { arr.splice(i, 1); return; }
}
