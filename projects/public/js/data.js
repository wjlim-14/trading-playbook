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

/* ── BOOTSTRAP ── */
function _initData() {
  return Promise.all([
    fetch('/api/accounts').then(okJson('accounts')),
    fetch('/api/trades').then(okJson('trades')),
    fetch('/api/transactions').then(okJson('transactions')),
    fetch('/api/prefs').then(okJson('prefs'))
  ]).then(function(r) {
    ACCOUNTS     = r[0] || [];
    TRADES       = r[1] || [];
    TRANSACTIONS = r[2] || [];
    PREFS        = Object.assign({ defaultRiskPct:2, dailyLimitPct:6 }, r[3] || {});
    MODE = PREFS.mode || 'LIVE';
    // default active account = first non-archived, or 'all'
    if (PREFS.activeAccountId && ACCOUNTS.some(function(a){return a.id===PREFS.activeAccountId;})) {
      ACTIVE_ACCOUNT = PREFS.activeAccountId;
    }
    _apiAvailable = true;
  }).catch(function(e) {
    console.warn('[J.Tradebook] API unavailable', e);
    _apiAvailable = false;
  });
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

/* ── TRADES ── */
function apiCreateTrade(t)  { return _req('/api/trades', 'POST', t).then(function(row){ if(row) TRADES.push(row); return row; }); }
function apiUpdateTrade(t)  { return _req('/api/trades', 'PATCH', t).then(function(row){ if(row) _replace(TRADES, row); return row; }); }
function apiDeleteTrade(id) { return _req('/api/trades', 'DELETE', { id: id }).then(function(){ _remove(TRADES, id); }); }

/* ── ACCOUNTS ── */
function apiCreateAccount(a)  { return _req('/api/accounts', 'POST', a).then(function(row){ if(row) ACCOUNTS.push(row); return row; }); }
function apiUpdateAccount(a)  { return _req('/api/accounts', 'PATCH', a).then(function(row){ if(row) _replace(ACCOUNTS, row); return row; }); }
function apiDeleteAccount(id) { return _req('/api/accounts', 'DELETE', { id: id }).then(function(){ _remove(ACCOUNTS, id); }); }

/* ── TRANSACTIONS ── */
function apiCreateTransaction(t)  { return _req('/api/transactions', 'POST', t).then(function(row){ if(row) TRANSACTIONS.push(row); return row; }); }
function apiDeleteTransaction(id) { return _req('/api/transactions', 'DELETE', { id: id }).then(function(){ _remove(TRANSACTIONS, id); }); }

/* ── PREFS ── */
function apiSavePrefs(p) {
  PREFS = Object.assign({}, PREFS, p);
  return _req('/api/prefs', 'PUT', PREFS).catch(function(e){ console.warn('prefs save failed', e); });
}

/* ── IMAGE UPLOAD (base64 -> storage) ── */
function apiUpload(dataUrl, name) {
  return _req('/api/upload', 'POST', { data: dataUrl, name: name }).then(function(r){ return r ? r.url : null; });
}

/* ── local array helpers ── */
function _replace(arr, row) {
  for (var i = 0; i < arr.length; i++) if (arr[i].id === row.id) { arr[i] = row; return; }
  arr.push(row);
}
function _remove(arr, id) {
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { arr.splice(i, 1); return; }
}
