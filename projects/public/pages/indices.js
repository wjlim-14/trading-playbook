/* ============================================================
   J.TRADEBOOK — INDICES
   Two chart sources per entry:
     - tv    : embedded TradingView widget (US indices, crypto, forex)
     - embed : any chart page URL in an iframe (KLSEScreener for Bursa,
               since TradingView's free widget can't stream Bursa data)
   Grouped Malaysia / US / Sector, stacked full-size.
   Watchlist persists in PREFS.indices (no table/endpoint needed).
   ============================================================ */

var IDX_GROUPS = [['MY','Malaysia'], ['US','US'], ['SECTOR','Sector']];
var IDX_PRESETS = [
  { label:'FBM KLCI',   type:'embed', url:'https://www.klsescreener.com/v2/markets/chart/KLSE', group:'MY' },
  { label:'S&P 500',    type:'tv', symbol:'SP:SPX',      group:'US' },
  { label:'Nasdaq 100', type:'tv', symbol:'NASDAQ:NDX',  group:'US' },
  { label:'Dow Jones',  type:'tv', symbol:'TVC:DJI',     group:'US' }
];

function indicesList(){ return (PREFS && PREFS.indices) ? PREFS.indices : []; }
function _idxId(){ return 'idx-' + Date.now().toString(36) + Math.floor(Math.random()*1000); }
function idxTheme(){ try { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; } catch(e){ return 'light'; } }

/* TradingView symbol from a raw symbol or a tradingview.com URL. */
function parseTvSymbol(s){
  s = (s || '').trim();
  var m = s.match(/[?&]symbol=([^&]+)/i);
  if (m) return decodeURIComponent(m[1]).toUpperCase();
  m = s.match(/\/symbols\/([^\/?#]+)/i);
  if (m) return m[1].replace('-', ':').toUpperCase();
  return s.toUpperCase();
}
/* Decide whether an input is a TradingView symbol/link or a plain embeddable URL. */
function parseIdxInput(raw){
  raw = (raw || '').trim();
  if (!raw) return null;
  var isUrl = /^https?:\/\//i.test(raw);
  if (isUrl && /tradingview\.com/i.test(raw)) return { type:'tv', symbol: parseTvSymbol(raw) };
  if (isUrl) return { type:'embed', url: raw };                 // KLSEScreener etc.
  return { type:'tv', symbol: parseTvSymbol(raw) };             // bare symbol
}
function idxOpenUrl(x){
  if (x.type === 'embed') return x.url;
  return 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(x.symbol || '');
}

function renderIndices(){
  var el = document.getElementById('p-indices');
  var list = indicesList();

  var groupOpts = IDX_GROUPS.map(function(g){ return '<option value="' + g[0] + '">' + g[1] + '</option>'; }).join('');
  var addBar =
    '<div class="idx-add">' +
      '<input class="fi" id="idx-label" placeholder="Label (e.g. KLCI)" style="max-width:170px">' +
      '<input class="fi" id="idx-symbol" placeholder="TradingView symbol (SP:SPX) or a chart page URL (KLSEScreener link)">' +
      '<select class="fi" id="idx-group" style="max-width:130px">' + groupOpts + '</select>' +
      '<button class="btn btn-gold" onclick="idxAdd()">+ Add</button>' +
    '</div>' +
    '<div class="idx-hint">US / crypto / forex → paste a <b>TradingView symbol</b>. Malaysia / Bursa → paste a <b>KLSEScreener chart link</b> (TradingView can\'t stream Bursa data free). Quick add: ' +
      IDX_PRESETS.map(function(p, i){ return '<button class="chip mini" onclick="idxQuickPreset(' + i + ')">' + escapeHtml(p.label) + '</button>'; }).join('') +
    '</div>';

  var groupsHtml = IDX_GROUPS.map(function(g){
    var items = list.filter(function(x){ return (x.group||'MY') === g[0]; });
    if (!items.length) return '';
    return '<div class="idx-group"><div class="idx-gh">' + g[1] + '</div>' + items.map(idxCardHtml).join('') + '</div>';
  }).join('');

  if (!list.length) groupsHtml = '<div class="mind-empty"><div style="font-size:30px;margin-bottom:6px">📈</div>' +
    '<div style="font-weight:600;margin-bottom:4px">No indices yet</div>' +
    '<div style="font-size:13px;color:var(--muted)">Add one above, or use a quick-add button.</div></div>';

  el.innerHTML =
    '<div class="mind-head"><div><h2 class="mind-t">Indices</h2>' +
      '<div class="mind-sub">Live charts — Malaysia, US &amp; sector</div></div></div>' +
    addBar + groupsHtml +
    '<div class="idx-attrib">US via <a href="https://www.tradingview.com/" target="_blank" rel="noopener">TradingView</a> · Malaysia via <a href="https://www.klsescreener.com/" target="_blank" rel="noopener">KLSEScreener</a></div>';

  ensureTv(function(){ list.forEach(function(x){ if ((x.type||'tv') === 'tv') mountWidget(x); }); });
}

function idxCardHtml(x){
  var openBtn = '<a class="btn btn-ghost btn-sm" href="' + escapeHtml(idxOpenUrl(x)) + '" target="_blank" rel="noopener">Open ↗</a>';
  var head =
    '<div class="idx-card-h">' +
      '<span class="idx-label">' + escapeHtml(x.label || x.symbol || x.url) + '</span>' +
      '<span class="idx-sym">' + escapeHtml(x.type==='embed' ? 'embed' : (x.symbol||'')) + '</span>' +
      '<div style="margin-left:auto;display:flex;gap:6px">' + openBtn +
        '<button class="btn btn-ghost btn-sm" onclick="idxRemove(\'' + x.id + '\')">Remove</button></div>' +
    '</div>';
  var body = (x.type === 'embed')
    ? '<div class="idx-chart"><iframe src="' + escapeHtml(x.url) + '" loading="lazy" referrerpolicy="no-referrer" style="width:100%;height:100%;border:0"></iframe></div>'
    : '<div class="idx-chart" id="tvc-' + x.id + '"></div>';
  return '<div class="idx-card">' + head + body + '</div>';
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
      container_id: 'tvc-' + x.id, symbol: x.symbol, interval: 'D',
      timezone: 'Asia/Kuala_Lumpur', theme: idxTheme(), style: '1', locale: 'en',
      autosize: true, hide_side_toolbar: false, allow_symbol_change: false, withdateranges: true
    });
  } catch (e) { cont.innerHTML = '<div class="empty" style="padding:16px">Could not load ' + escapeHtml(x.symbol) + '</div>'; }
}

/* ── actions ── */
function idxAdd(){
  var label = (document.getElementById('idx-label').value || '').trim();
  var raw   = (document.getElementById('idx-symbol').value || '').trim();
  var group = document.getElementById('idx-group').value;
  var p = parseIdxInput(raw);
  if (!p) { toast('Enter a TradingView symbol or a chart page URL','err'); return; }
  var entry = { id:_idxId(), label: label || (p.symbol || 'Chart'), group: group, type: p.type };
  if (p.type === 'embed') entry.url = p.url; else entry.symbol = p.symbol;
  _idxSave(indicesList().concat([entry]));
}
function idxQuickPreset(i){
  var p = IDX_PRESETS[i]; if (!p) return;
  var entry = { id:_idxId(), label:p.label, group:p.group, type:p.type };
  if (p.type === 'embed') entry.url = p.url; else entry.symbol = p.symbol;
  _idxSave(indicesList().concat([entry]));
}
function idxRemove(id){ _idxSave(indicesList().filter(function(x){ return x.id !== id; })); }
function _idxSave(arr){
  apiSavePrefs({ indices: arr }).then(function(){ renderIndices(); }).catch(function(e){ toast('Save failed: ' + e.message,'err'); });
}
