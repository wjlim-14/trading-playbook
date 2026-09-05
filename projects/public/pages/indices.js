/* ============================================================
   J.TRADEBOOK — INDICES
   Embedded TradingView charts (live, free), grouped Malaysia / US /
   Sector, stacked full-size. Watchlist persists in PREFS.indices.
   ============================================================ */

var IDX_GROUPS = [['MY','Malaysia'], ['US','US'], ['SECTOR','Sector']];
var IDX_PRESETS = [
  { label:'FBM KLCI',   symbol:'FTSEMYX:FBMKLCI', group:'MY' },
  { label:'S&P 500',    symbol:'SP:SPX',          group:'US' },
  { label:'Nasdaq 100', symbol:'NASDAQ:NDX',      group:'US' },
  { label:'Dow Jones',  symbol:'TVC:DJI',         group:'US' }
];

function indicesList(){ return (PREFS && PREFS.indices) ? PREFS.indices : []; }
function _idxId(){ return 'idx-' + Date.now().toString(36) + Math.floor(Math.random()*1000); }
function idxTheme(){ try { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; } catch(e){ return 'light'; } }

/* Accept a raw TradingView symbol (EXCH:TICKER) or a TradingView chart/symbol URL. */
function parseTvSymbol(s){
  s = (s || '').trim();
  if (!s) return '';
  var m = s.match(/[?&]symbol=([^&]+)/i);           // ...?symbol=FTSEMYX%3AFBMKLCI
  if (m) return decodeURIComponent(m[1]).toUpperCase();
  m = s.match(/\/symbols\/([^\/?#]+)/i);             // /symbols/FTSEMYX-FBMKLCI/
  if (m) return m[1].replace('-', ':').toUpperCase();
  return s.toUpperCase();                            // already a symbol
}

function renderIndices(){
  var el = document.getElementById('p-indices');
  var list = indicesList();

  var groupOpts = IDX_GROUPS.map(function(g){ return '<option value="' + g[0] + '">' + g[1] + '</option>'; }).join('');
  var addBar =
    '<div class="idx-add">' +
      '<input class="fi" id="idx-label" placeholder="Label (e.g. KLCI)" style="max-width:170px">' +
      '<input class="fi" id="idx-symbol" placeholder="TradingView symbol or chart link (e.g. FTSEMYX:FBMKLCI)">' +
      '<select class="fi" id="idx-group" style="max-width:130px">' + groupOpts + '</select>' +
      '<button class="btn btn-gold" onclick="idxAdd()">+ Add</button>' +
    '</div>' +
    '<div class="idx-hint">Paste a TradingView symbol (<b>EXCH:TICKER</b>) or a TradingView chart link — I\'ll pull the symbol out. Quick add: ' +
      IDX_PRESETS.map(function(p){ return '<button class="chip mini" onclick="idxQuick(\'' + p.symbol + '\',\'' + escapeHtml(p.label) + '\',\'' + p.group + '\')">' + escapeHtml(p.label) + '</button>'; }).join('') +
    '</div>';

  var groupsHtml = IDX_GROUPS.map(function(g){
    var items = list.filter(function(x){ return (x.group||'MY') === g[0]; });
    if (!items.length) return '';
    var body = items.map(idxCardHtml).join('');
    return '<div class="idx-group"><div class="idx-gh">' + g[1] + '</div>' + body + '</div>';
  }).join('');

  if (!list.length) groupsHtml = '<div class="mind-empty"><div style="font-size:30px;margin-bottom:6px">📈</div>' +
    '<div style="font-weight:600;margin-bottom:4px">No indices yet</div>' +
    '<div style="font-size:13px;color:var(--muted)">Add one above, or use a quick-add button.</div></div>';

  el.innerHTML =
    '<div class="mind-head"><div><h2 class="mind-t">Indices</h2>' +
      '<div class="mind-sub">Live charts — Malaysia, US &amp; sector — powered by TradingView</div></div></div>' +
    addBar + groupsHtml +
    '<div class="idx-attrib">Charts by <a href="https://www.tradingview.com/" target="_blank" rel="noopener">TradingView</a></div>';

  ensureTv(function(){ list.forEach(mountWidget); });
}

function idxCardHtml(x){
  return '<div class="idx-card">' +
    '<div class="idx-card-h">' +
      '<span class="idx-label">' + escapeHtml(x.label || x.symbol) + '</span>' +
      '<span class="idx-sym">' + escapeHtml(x.symbol) + '</span>' +
      '<button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="idxRemove(\'' + x.id + '\')">Remove</button>' +
    '</div>' +
    '<div class="idx-chart" id="tvc-' + x.id + '"></div>' +
  '</div>';
}

/* Load TradingView tv.js once, then run cb. */
function ensureTv(cb){
  if (window.TradingView && window.TradingView.widget) { cb(); return; }
  var s = document.getElementById('tvjs');
  if (s) { s.addEventListener('load', cb); return; }
  s = document.createElement('script');
  s.id = 'tvjs'; s.src = 'https://s3.tradingview.com/tv.js'; s.async = true;
  s.onload = cb;
  s.onerror = function(){ toast('Could not load TradingView charts (network?)','err'); };
  document.head.appendChild(s);
}
function mountWidget(x){
  var cont = document.getElementById('tvc-' + x.id);
  if (!cont || !(window.TradingView && window.TradingView.widget)) return;
  cont.innerHTML = '';
  try {
    new TradingView.widget({
      container_id: 'tvc-' + x.id,
      symbol: x.symbol,
      interval: 'D',
      timezone: 'Asia/Kuala_Lumpur',
      theme: idxTheme(),
      style: '1',
      locale: 'en',
      autosize: true,
      hide_side_toolbar: false,
      allow_symbol_change: false,
      withdateranges: true
    });
  } catch (e) { cont.innerHTML = '<div class="empty" style="padding:16px">Could not load ' + escapeHtml(x.symbol) + '</div>'; }
}

/* ── actions ── */
function idxAdd(){
  var label = (document.getElementById('idx-label').value || '').trim();
  var raw   = (document.getElementById('idx-symbol').value || '').trim();
  var group = document.getElementById('idx-group').value;
  var sym = parseTvSymbol(raw);
  if (!sym) { toast('Enter a TradingView symbol or link','err'); return; }
  _idxSave(indicesList().concat([{ id:_idxId(), label: label || sym, symbol: sym, group: group }]));
}
function idxQuick(symbol, label, group){
  _idxSave(indicesList().concat([{ id:_idxId(), label: label, symbol: symbol, group: group }]));
}
function idxRemove(id){
  _idxSave(indicesList().filter(function(x){ return x.id !== id; }));
}
function _idxSave(arr){
  apiSavePrefs({ indices: arr }).then(function(){ renderIndices(); }).catch(function(e){ toast('Save failed: ' + e.message,'err'); });
}
