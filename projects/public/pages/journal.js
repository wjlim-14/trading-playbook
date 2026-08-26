/* ============================================================
   J.TRADEBOOK V2 — JOURNAL (Stage 4: POST-TRADE REVIEW)
   Pending-review banner, filters, collapsed rows, dual grades,
   exit grade, mistake tags, reflection, post-exit charts.
   ============================================================ */

var JFILTER = { grade:'ALL', text:'', mistake:'', from:'', to:'', preset:'ALL' };
var JVIEW = 'trades';   // trades | week | setup | calendar
var _calMonth = null;   // YYYY-MM for calendar view

function renderJournal() {
  var el = document.getElementById('p-journal');
  var pending = closedTrades().filter(function(t){ return !t.reviewComplete; });

  var banner = pending.length
    ? '<div class="jalert"><div style="font-size:16px">⚠️</div>' +
      '<div class="jat"><strong>' + pending.length + ' closed trade' + (pending.length>1?'s':'') + '</strong> pending review — complete reflection to mark as reviewed.</div>' +
      '<button class="btn btn-red btn-sm" style="margin-left:auto" onclick="jumpToPending()">Review Now</button></div>'
    : '';

  var viewTabs = [['trades','Trades'],['week','By Week'],['setup','By Setup'],['calendar','Calendar']].map(function(v){
    return '<button class="stab' + (JVIEW===v[0]?' active':'') + '" onclick="jSetView(\'' + v[0] + '\')">' + v[1] + '</button>';
  }).join('');

  var content;
  if (JVIEW === 'week') content = weekView();
  else if (JVIEW === 'setup') content = setupView();
  else if (JVIEW === 'calendar') content = calendarView();
  else content = tradesControls() + '<div class="tlist" id="j-list"></div>';

  el.innerHTML =
    (MODE==='BACKTEST' ? '<div class="mock-banner"><span style="font-size:15px">🧪</span><div><strong>Backtest Mode</strong> — reviewing simulated trades.</div></div>' : '') +
    banner +
    disciplineStrip() +
    '<div class="stabs">' + viewTabs + '</div>' +
    content;

  if (JVIEW === 'trades') jRenderList();
  else if (JVIEW === 'week') {
    wireTradeSlots(el, function(){ _afterMutation(); renderJournal(); });
    wireShotSlots(el, function(){ _afterMutation(); renderJournal(); });
  }
}

/* ── DISCIPLINE STRIP (always on top) ── */
function disciplineStrip() {
  var closed = closedTrades();
  var n = closed.length;
  var k = kpiSet(closed);
  var graded = closed.filter(function(t){ return t.entryGrade && t.exitGrade; });
  var clean = graded.filter(function(t){ return t.entryGrade!=='C' && t.exitGrade!=='C'; }).length;
  var disc = graded.length ? round(clean/graded.length*100,0) : 0;
  var reviewed = closed.filter(function(t){ return t.reviewComplete; }).length;
  var base = baseCurrency();
  function tile(label,val,cls){ return '<div class="kpi ' + (cls||'') + '" style="padding:11px 13px"><div class="kpi-l">' + label + '</div><div class="kpi-v ' + (cls||'') + '" style="font-size:18px">' + val + '</div></div>'; }
  return '<div class="kpi-row" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">' +
    tile('Discipline (A/B)', disc + '%', disc>=70?'g':disc>=50?'o':'r') +
    tile('Reviewed', reviewed + '/' + n, reviewed===n?'g':'o') +
    tile('Win Rate', k.winRate + '%', 'b') +
    tile('Avg R', rStr(k.avgR), k.avgR>=0?'g':'r') +
    tile('Grade C Cost', money(k.gradeCCost, base), 'r') +
  '</div>';
}

/* ── PRESET CHIPS + FILTER CONTROLS (trades view) ── */
function tradesControls() {
  var presets = [['ALL','All'],['MONTH','This Month'],['C','Grade C ⚠️'],['WINS','Wins'],['LOSSES','Losses'],['PENDING','Pending review']];
  var chips = presets.map(function(p){
    return '<button class="chip' + (JFILTER.preset===p[0]?' active':'') + '" onclick="jPreset(\'' + p[0] + '\')">' + p[1] + '</button>';
  }).join('');
  var mistakeOpts = '<option value="">All mistakes</option>' + exitReasons().map(function(m){
    return '<option value="' + escapeHtml(m) + '"' + (JFILTER.mistake===m?' selected':'') + '>' + escapeHtml(m) + '</option>';
  }).join('');
  return '<div class="chips" style="margin-bottom:12px">' + chips + '</div>' +
    '<div class="searchbar">' +
      '<input class="fi" id="j-search" placeholder="Search ticker…" value="' + escapeHtml(JFILTER.text) + '" oninput="jSetText(this.value)">' +
      '<select class="fi" style="max-width:180px" onchange="jSetMistake(this.value)">' + mistakeOpts + '</select>' +
      '<input class="fi" type="date" style="max-width:150px" value="' + JFILTER.from + '" onchange="jSetDate(\'from\',this.value)" title="From">' +
      '<input class="fi" type="date" style="max-width:150px" value="' + JFILTER.to + '" onchange="jSetDate(\'to\',this.value)" title="To">' +
    '</div>';
}
function jPreset(p) {
  JFILTER = { grade:'ALL', text:'', mistake:'', from:'', to:'', preset:p };
  if (p === 'C') JFILTER.grade = 'C';
  else if (p === 'MONTH') { JFILTER.from = todayStr().slice(0,8) + '01'; }
  renderJournal();
}

/* Filtered set given current JFILTER over all closed trades (newest first). */
function jFilteredTrades() {
  var all = closedTrades().slice().sort(function(a,b){ return sortByCloseTime(b,a); });
  return all.filter(function(t){
    if (JFILTER.grade !== 'ALL' && t.entryGrade !== JFILTER.grade && t.exitGrade !== JFILTER.grade) return false;
    if (JFILTER.text && (t.ticker||'').toUpperCase().indexOf(JFILTER.text.toUpperCase()) < 0) return false;
    if (JFILTER.mistake && (t.mistakeTags||[]).indexOf(JFILTER.mistake) < 0) return false;
    var d = shortDate(t.exitTimestamp || t.createdAt);
    if (JFILTER.from && d < JFILTER.from) return false;
    if (JFILTER.to && d > JFILTER.to) return false;
    if (JFILTER.preset === 'WINS' && !((tradePnL(t)||0) > 0)) return false;
    if (JFILTER.preset === 'LOSSES' && !((tradePnL(t)||0) < 0)) return false;
    if (JFILTER.preset === 'PENDING' && t.reviewComplete) return false;
    return true;
  });
}
function jSetView(v) { JVIEW = v; renderJournal(); }
function jRenderList() {
  var list = document.getElementById('j-list');
  if (!list) return;
  var rows = jFilteredTrades().map(journalRow).join('');
  list.innerHTML = rows || '<div class="empty">No closed trades match.' + (MODE==='BACKTEST'?' (Backtest)':'') + '</div>';
  wireTradeSlots(list, function(){ _afterMutation(); renderJournal(); });
  wireShotSlots(list, function(){ _afterMutation(); renderJournal(); });
}

/* filters */
function jSetGrade(g){ JFILTER.grade=g; renderJournal(); }
function jSetText(v){ JFILTER.text=v; jRenderList(); }
function jSetMistake(v){ JFILTER.mistake=v; jRenderList(); }
function jSetDate(k,v){ JFILTER[k]=v; jRenderList(); }
function jumpToPending(){ var t=closedTrades().filter(function(x){return !x.reviewComplete;})[0]; if(t){ _reportEdit[t.id]=true; openTradeReport(t.id); } }

/* ── BY WEEK ── */
function weekView() {
  var trades = closedTrades().slice().sort(function(a,b){ return sortByCloseTime(b,a); });
  if (!trades.length) return '<div class="empty">No closed trades yet.</div>';
  var base = baseCurrency();
  var groups = {};
  trades.forEach(function(t){
    var wk = weekKey(t.exitTimestamp || t.createdAt);
    (groups[wk.key] = groups[wk.key] || { label:wk.label, items:[] }).items.push(t);
  });
  return Object.keys(groups).sort().reverse().map(function(k){
    var g = groups[k], net=0, wins=0, cc=0;
    g.items.forEach(function(t){ var p=tradePnLBase(t)||0; net+=p; if(p>0)wins++; if(t.entryGrade==='C'||t.exitGrade==='C')cc++; });
    var wr = round(wins/g.items.length*100,0);
    var head = '<div class="card-h"><div class="card-t">' + g.label + '</div>' +
      '<div style="font-family:var(--mono);font-size:12px"><span class="' + pnlClass(net) + '">' + moneySigned(net,base) + '</span> · ' + g.items.length + ' trades · ' + wr + '% WR' + (cc?' · <span class="text-neg">' + cc + ' C</span>':'') + '</div></div>';
    return '<div class="card">' + head + '<div class="card-b" style="padding:10px"><div class="tlist">' + g.items.map(journalRow).join('') + '</div></div></div>';
  }).join('');
}
function weekKey(iso) {
  var d = new Date(iso || Date.now());
  var dow = (d.getUTCDay()+6)%7;
  var mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()-dow));
  var sun = new Date(mon.getTime() + 6*86400000);
  var f = function(x){ return x.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}); };
  return { key: mon.toISOString().slice(0,10), label: f(mon) + ' – ' + f(sun) };
}

/* ── BY SETUP ── */
function setupView() {
  var closed = closedTrades();
  if (!closed.length) return '<div class="empty">No closed trades yet.</div>';
  var base = baseCurrency(), map = {};
  closed.forEach(function(t){
    (t.entryReasonTags||[]).forEach(function(r){
      var m = map[r] = map[r] || { n:0, wins:0, net:0, rs:[] };
      m.n++; var p = tradePnLBase(t)||0; m.net += p; if (p>0) m.wins++;
      var rr = tradeR(t); if (rr!=null) m.rs.push(rr);
    });
  });
  var rows = Object.keys(map).map(function(r){ var m=map[r];
    return { reason:r, n:m.n, wr:round(m.wins/m.n*100,0), net:round(m.net,2), avgR:m.rs.length?round(m.rs.reduce(function(a,b){return a+b;},0)/m.rs.length,2):0 };
  }).sort(function(a,b){ return b.net-a.net; });
  if (!rows.length) return '<div class="empty">No entry-reason tags on closed trades yet.</div>';
  var header = '<div class="tx-row" style="background:transparent;border:none;color:var(--muted);font-size:10px;text-transform:uppercase"><div style="flex:1">Setup / entry reason</div><div style="width:48px;text-align:right">Trades</div><div style="width:52px;text-align:right">Win%</div><div style="width:56px;text-align:right">Avg R</div><div style="width:90px;text-align:right">Net ' + base + '</div></div>';
  var body = rows.map(function(x){
    return '<div class="tx-row"><div style="flex:1;font-weight:600;font-size:12px">' + escapeHtml(x.reason) + '</div>' +
      '<div style="font-family:var(--mono);font-size:11px;width:48px;text-align:right">' + x.n + '×</div>' +
      '<div style="font-family:var(--mono);font-size:11px;width:52px;text-align:right">' + x.wr + '%</div>' +
      '<div style="font-family:var(--mono);font-size:11px;width:56px;text-align:right" class="' + pnlClass(x.avgR) + '">' + rStr(x.avgR) + '</div>' +
      '<div style="font-family:var(--mono);font-weight:700;width:90px;text-align:right" class="' + pnlClass(x.net) + '">' + moneySigned(x.net,base) + '</div></div>';
  }).join('');
  return '<div class="card"><div class="card-h"><div class="card-t">Performance by Setup</div><div style="font-size:10px;color:var(--muted)">which reasons actually make money</div></div>' +
    '<div class="card-b"><div style="display:flex;flex-direction:column;gap:6px">' + header + body + '</div></div></div>';
}

/* ── CALENDAR HEATMAP ── */
function calendarView() {
  var month = _calMonth || todayStr().slice(0,7);
  var base = baseCurrency(), daily = {};
  closedTrades().forEach(function(t){ var d=shortDate(t.exitTimestamp||t.createdAt); if(d.slice(0,7)===month) daily[d]=(daily[d]||0)+(tradePnLBase(t)||0); });
  var y=+month.slice(0,4), mo=+month.slice(5,7);
  var startDow=(new Date(Date.UTC(y,mo-1,1)).getUTCDay()+6)%7;
  var days=new Date(Date.UTC(y,mo,0)).getUTCDate();
  var dows=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  var head=dows.map(function(d){return '<div style="text-align:center;font-size:9px;color:var(--muted);text-transform:uppercase">'+d+'</div>';}).join('');
  var cells=''; for(var i=0;i<startDow;i++) cells+='<div></div>';
  for(var dn=1; dn<=days; dn++){
    var ds=month+'-'+String(dn).padStart(2,'0'); var pnl=daily[ds];
    var bg='var(--surface2)', col='var(--muted)';
    if(pnl!=null && pnl!==0){ var a=Math.min(0.55,0.14+Math.abs(pnl)/2500);
      if(pnl>0){bg='rgba(42,122,80,'+a.toFixed(2)+')';col='var(--green)';} else {bg='rgba(176,48,48,'+a.toFixed(2)+')';col='var(--red)';} }
    cells+='<div style="min-height:52px;border:1px solid var(--border);border-radius:5px;background:'+bg+';padding:4px;display:flex;flex-direction:column;justify-content:space-between">' +
      '<div style="font-size:10px;color:var(--muted)">'+dn+'</div>' +
      (pnl!=null?'<div style="font-family:var(--mono);font-size:10px;font-weight:700;color:'+col+'">'+moneySigned(pnl,base)+'</div>':'')+'</div>';
  }
  var monthNet=Object.keys(daily).reduce(function(s,d){return s+daily[d];},0);
  var label=new Date(Date.UTC(y,mo-1,1)).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
  return '<div class="card"><div class="card-h"><div style="display:flex;gap:8px;align-items:center"><button class="btn btn-ghost btn-sm" onclick="calMonth(-1)">‹</button><div class="card-t">'+label+'</div><button class="btn btn-ghost btn-sm" onclick="calMonth(1)">›</button></div>' +
    '<div style="font-family:var(--mono);font-weight:700" class="'+pnlClass(monthNet)+'">'+moneySigned(monthNet,base)+'</div></div>' +
    '<div class="card-b"><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:5px">'+head+'</div>' +
    '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px">'+cells+'</div></div></div>';
}
function calMonth(delta){ var m=_calMonth||todayStr().slice(0,7); var y=+m.slice(0,4),mo=+m.slice(5,7); mo+=delta; if(mo<1){mo=12;y--;} if(mo>12){mo=1;y++;} _calMonth=y+'-'+String(mo).padStart(2,'0'); renderJournal(); }

function journalRow(t) {
  var acc = getAccount(t.accountId); var cur = acc?acc.currency:'USD';
  var pnl = tradePnL(t);
  var needsReview = !t.reviewComplete;

  var gradeArea = needsReview
    ? '<div style="display:flex;gap:5px;align-items:center">' + gradePill('Entry', t.entryGrade) + '<span class="review-flag">⚠ REVIEW</span></div>'
    : '<div style="display:flex;gap:5px">' + gradePill('Entry', t.entryGrade) + gradePill('Exit', t.exitGrade) + '</div>';

  return '<div class="tcard' + ((t.entryGrade==='C'||t.exitGrade==='C')?' flag':'') + '">' +
    '<div class="trow" style="cursor:default">' +
      '<div class="tsym">' + escapeHtml(t.ticker) + '</div>' + dirBadge(t.direction) + statusBadge('CLOSED') +
      '<div class="tinfo">' +
        '<div class="tf"><div class="tfl">Avg→Exit</div><div class="tfv">' + fmtN(tradeAvgEntry(t)) + '→' + fmtN(lastExitPrice(t)) + '</div></div>' +
        '<div class="tf"><div class="tfl">R</div><div class="tfv ' + pnlClass(tradeR(t)) + '">' + rStr(tradeR(t)) + '</div></div>' +
      '</div>' + gradeArea +
      '<div class="tpnl ' + pnlClass(pnl) + '">' + moneySigned(pnl,cur) + '</div>' +
      '<button class="btn btn-gold btn-sm" style="margin-left:10px;white-space:nowrap" onclick="openTradeReport(\'' + t.id + '\')">📄 Show trade</button>' +
    '</div>' +
  '</div>';
}

var _reportEdit = {};

var GRADE_LEGEND =
  '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:8px 10px;font-size:10px;color:var(--muted);margin-bottom:10px;line-height:1.6">' +
  '<strong style="color:var(--gold)">Entry Grade</strong> = setup & entry quality (set on the Calculator). ' +
  '<strong style="color:var(--blue)">Exit Grade</strong> = trade management & exit quality.<br>' +
  '<span class="gpill ga" style="padding:1px 6px">A</span> disciplined · ' +
  '<span class="gpill gb" style="padding:1px 6px">B</span> acceptable · ' +
  '<span class="gpill gc" style="padding:1px 6px">C</span> rule-break</div>';

/* ══════════════════════════════════════════════════════════════
   TRADE REPORT — pop-out, report/analytics level. Read-only by
   default; "Edit / Complete review" flips to the review form.
   ══════════════════════════════════════════════════════════════ */
function openTradeReport(id) {
  openModal({
    title: '📄 Trade Report', width: 940,
    body: '<div id="trep-body"></div>',
    footer: '<button class="btn btn-ghost" onclick="closeTradeReport()">Close</button>'
  });
  renderTradeReport(id);
}
function closeTradeReport() {
  closeModal();
  if (document.getElementById('p-journal')) renderJournal();
}
function renderTradeReport(id) {
  var t = TRADES.find(function(x){ return x.id===id; });
  var host = document.getElementById('trep-body');
  if (!t || !host) return;
  host.innerHTML = _reportEdit[id] ? tradeReportEditBody(t) : tradeReportViewBody(t);
  wireShotSlots(host, function(){ renderTradeReport(id); });
}
function tradeReportEdit(id, on) { _reportEdit[id] = on; renderTradeReport(id); }

/* ── small helpers ── */
function _gradeMeaning(kind, g) {
  var m = { entry:{A:'Perfect Setup',B:'Slight Hesitation',C:'Chased / Low Q'},
            exit:{A:'Followed Plan',B:'Early Exit OK',C:'Panic / Moved SL'} };
  return (m[kind] && m[kind][g]) || '';
}
function gLetter(g) {
  if (!g) return '<span class="rep-muted">—</span>';
  return '<span class="gpill g' + g.toLowerCase() + '" style="padding:1px 8px">' + g + '</span>';
}
function gradeBadgeText(kind, g) {
  if (!g) return '<span class="rep-muted">— not graded</span>';
  return gLetter(g) + ' <span style="font-size:12px;color:var(--text2)">' + _gradeMeaning(kind, g) + '</span>';
}
function tradeEntryTime(t) {
  if (t.entryTimestamp) return t.entryTimestamp;
  var e = tradeEntries(t); return (e[0] && e[0].time) || null;
}
function tradeExitTime(t) {
  if (t.exitTimestamp) return t.exitTimestamp;
  var x = tradeExits(t); return (x.length && x[x.length-1].time) || null;
}
function holdDuration(t) {
  var a = tradeEntryTime(t), b = tradeExitTime(t);
  if (!a || !b) return '—';
  var ms = new Date(b) - new Date(a);
  if (!(ms > 0)) return '—';
  var d = Math.floor(ms/86400000), h = Math.floor((ms%86400000)/3600000);
  if (d) return (d + 'd' + (h?' '+h+'h':''));
  var mn = Math.floor((ms%3600000)/60000);
  return h ? (h + 'h' + (mn?' '+mn+'m':'')) : (mn + 'm');
}
/* Big captioned screenshots for the report (read-only). */
function reportShotsHtml(t, stage) {
  var shots = stage==='pre' ? tradePreShots(t) : tradePostShots(t);
  if (!shots.length) return '<div class="rep-noshot">No ' + (stage==='pre'?'pre':'post') + '-trade screenshots</div>';
  var hi = tradeTfHigh(t), lo = tradeTfLow(t);
  return '<div class="repshots">' + shots.map(function(s, i){
    var role = s.tf===hi ? 'HIGH TF' : (s.tf===lo ? 'LOW TF' : '');
    var cap = (role ? role + ' · ' : '') + String(s.tf||'').toUpperCase();
    return '<figure class="repshot" data-shotview="' + t.id + '|' + stage + '|' + i + '">' +
      '<img src="' + escapeHtml(s.url) + '" alt="chart">' +
      '<figcaption>' + escapeHtml(cap) + '</figcaption></figure>';
  }).join('') + '</div>';
}
function reportFills(t) {
  var e = tradeEntries(t), x = tradeExits(t);
  if (!e.length && !x.length) return '';
  var acc = getAccount(t.accountId), cur = acc ? acc.currency : 'USD';
  function row(kind, l, cls, i){
    var cost = fillNotional(t, l.size, l.price);
    var rp = cls==='out' ? legRealized(t, l) : null;
    return '<div class="rep-fill"><span class="rep-fk ' + cls + '">' + kind + ' #' + i + '</span>' +
      '<span class="rep-fp">' + fmtN(l.size) + ' @ ' + fmtN(l.price) + '</span>' +
      '<span class="rep-fc">' + (cls==='out'?'↩ ':'') + money(cost, cur) + '</span>' +
      (rp!=null ? '<span class="rep-frp ' + pnlClass(rp) + '">' + moneySigned(rp, cur) + '</span>' : '') +
      '<span class="rep-ft">' + (l.time?fmtMYT(l.time):'') + '</span>' +
      (l.note ? '<span class="rep-fn">' + escapeHtml(l.note) + '</span>' : '') + '</div>';
  }
  var rows = e.map(function(l,i){ return row('IN', l, 'in', i+1); }).join('') +
             x.map(function(l,i){ return row('OUT', l, 'out', i+1); }).join('');
  var cap = '<div class="rep-cap">' +
    '<span>Deployed <b>' + money(tradeDeployed(t), cur) + '</b></span>' +
    '<span>Taken back <b>' + money(tradeTakenBack(t), cur) + '</b></span>' +
    '<span>Booked <b class="' + pnlClass(tradeRealizedPnL(t)||0) + '">' + moneySigned(tradeRealizedPnL(t)||0, cur) + '</b></span>' +
  '</div>';
  return '<div class="rep-sec"><div class="rep-sech">EXECUTION &amp; CAPITAL</div><div class="rep-fills">' + rows + '</div>' + cap + '</div>';
}

/* ── REPORT · VIEW (read-only, report level) ── */
function tradeReportViewBody(t) {
  var acc = getAccount(t.accountId); var cur = acc?acc.currency:'USD';
  var pnl = tradePnL(t), r = tradeR(t);
  var result = pnl>0 ? 'WIN' : (pnl<0 ? 'LOSS' : 'BREAK-EVEN');
  var acls = acc ? assetClassMeta(acc.assetClass).label : '';
  var unit = acc ? assetClassMeta(acc.assetClass).unit.toLowerCase() : '';
  var _et = tradeEntryTime(t), _xt = tradeExitTime(t);
  var dates = (_et?fmtMYT(_et):'—') + (_xt?'  →  '+fmtMYT(_xt):'');
  var pending = !t.reviewComplete;

  var head =
    '<div class="rep-head">' +
      '<div class="rep-title"><span class="rep-tk">' + escapeHtml(t.ticker) + '</span>' + dirBadge(t.direction) + statusBadge('CLOSED') +
        (pending?' <span class="review-flag">⚠ PENDING REVIEW</span>':'') + '</div>' +
      '<div class="rep-sub">' + escapeHtml(acc?acc.name:'') + ' · ' + escapeHtml(acls) + ' · ' + dates + '</div>' +
      '<button class="btn btn-gold btn-sm rep-editbtn" onclick="tradeReportEdit(\'' + t.id + '\',true)">' + (pending?'✓ Complete review':'✎ Edit') + '</button>' +
    '</div>';

  function tile(l,v,cls){ return '<div class="rep-tile"><div class="rep-tl">' + l + '</div><div class="rep-tv ' + (cls||'') + '">' + v + '</div></div>'; }
  var tiles = '<div class="rep-tiles">' +
    tile('Net P&amp;L', moneySigned(pnl,cur), pnlClass(pnl)) +
    tile('R Multiple', rStr(r), pnlClass(r)) +
    tile('Result', result, pnl>0?'g':(pnl<0?'r':'')) +
    tile('Risk (1R)', money(tradePlannedRisk(t)||0,cur), '') +
    tile('Hold', holdDuration(t), '') +
  '</div>';

  function kv(l,v){ return '<div class="rep-kvi"><div class="rep-kvl">' + l + '</div><div class="rep-kvv">' + v + '</div></div>'; }
  var numbers = '<div class="rep-kv">' +
    kv('Avg Entry', fmtN(tradeAvgEntry(t))) +
    kv('Exit', fmtN(lastExitPrice(t))) +
    kv('Stop', fmtN(t.stopLossPrice)) +
    kv('Target', fmtN(t.targetPrice)) +
    kv('Size', fmtN(tradeEntrySize(t)) + (unit?' '+unit:'')) +
    kv('Planned R:R', t.plannedRR?('1:'+t.plannedRR):'—') +
    kv('Entry Grade', gLetter(t.entryGrade)) +
    kv('Exit Grade', gLetter(t.exitGrade)) +
  '</div>';

  var reasons = (t.entryReasonTags||[]).map(function(x){ return '<span class="ptag sel">' + escapeHtml(x) + '</span>'; }).join('') || '<span class="rep-muted">—</span>';
  var pre = '<div class="rep-sec"><div class="rep-sech">PRE-TRADE ANALYSIS</div>' +
    '<div class="rep-tf">Timeframes &nbsp;<b>High ' + escapeHtml(tradeTfHigh(t)) + '</b> &nbsp;·&nbsp; <b>Low ' + escapeHtml(tradeTfLow(t)) + '</b></div>' +
    reportShotsHtml(t, 'pre') +
    '<div class="rep-lbl">Entry reasons</div><div class="ptags">' + reasons + '</div>' +
    (t.setupNotes ? '<div class="rep-lbl">Plan / setup</div><div class="rep-note">' + escapeHtml(t.setupNotes) + '</div>' : '') +
  '</div>';

  var mtags = (t.mistakeTags||[]).map(function(m){ return '<span class="ptag ' + (m!=='Clean Execution'?'bad ':'') + 'sel">' + escapeHtml(m) + '</span>'; }).join('') || '<span class="rep-muted">—</span>';
  var post = '<div class="rep-sec"><div class="rep-sech">POST-TRADE REVIEW</div>' +
    (pending ? '<div class="rep-pending">⚠ Not reviewed yet — click <b>Complete review</b> above to grade the exit and log your takeaway.</div>' : '') +
    reportShotsHtml(t, 'post') +
    '<div class="rep-lbl">Exit grade</div><div>' + gradeBadgeText('exit', t.exitGrade) + '</div>' +
    '<div class="rep-lbl">Mistake / exit tags</div><div class="ptags">' + mtags + '</div>' +
    '<div class="rep-lbl">Takeaway</div><div class="rep-note">' + (escapeHtml(t.reflectionNote||'') || '<span class="rep-muted">—</span>') + '</div>' +
  '</div>';

  return head + tiles + numbers + pre + post + reportFills(t) + tradeLogHtml(t);
}

/* ── REPORT · EDIT (review form) ── */
function tradeReportEditBody(t) {
  var grades = [['A','Followed Plan'],['B','Early Exit OK'],['C','Panic / Moved SL']];
  var gradeBtns = grades.map(function(g){
    return '<button class="gbtn g' + g[0].toLowerCase() + '-s' + (t.exitGrade===g[0]?' sel':'') + '" onclick="setExitGrade(\'' + t.id + '\',\'' + g[0] + '\')">' +
      '<div class="gl">' + g[0] + '</div><div class="gd">' + g[1] + '</div></button>';
  }).join('');
  var mtags = exitReasons().map(function(m){
    var sel = (t.mistakeTags||[]).indexOf(m) >= 0; var bad = m !== 'Clean Execution';
    return '<span class="ptag' + (bad?' bad':'') + (sel?' sel':'') + '" onclick="toggleMistake(\'' + t.id + '\',\'' + escapeHtml(m).replace(/'/g,"\\'") + '\')">' + escapeHtml(m) + '</span>';
  }).join('');
  var reasons = (t.entryReasonTags||[]).map(function(x){ return '<span class="ptag sel">' + escapeHtml(x) + '</span>'; }).join('');

  return '<div class="rep-editbar"><b>Editing trade</b>' +
      '<button class="btn btn-ghost btn-sm" onclick="openEditFillsModal(\'' + t.id + '\', function(){ openTradeReport(\'' + t.id + '\'); })">✎ Fix price / size</button>' +
      '<button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="tradeReportEdit(\'' + t.id + '\',false)">Done → view</button></div>' +
    GRADE_LEGEND +
    '<div class="jblock jpre"><div class="jblock-h">📋 PRE-TRADE <span>setup &amp; charts</span></div>' +
      tfPickerRow(t) +
      '<div class="rep-lbl">Pre-trade screenshots</div>' + shotsGridHtml(t, 'pre', true) +
      (reasons ? '<div class="rep-lbl">Entry reasons</div><div class="ptags">' + reasons + '</div>' : '') +
    '</div>' +
    '<div class="jblock jpost"><div class="jblock-h">🎯 POST-TRADE <span>exit &amp; review</span></div>' +
      '<div class="rep-lbl">Post-trade screenshots</div>' + shotsGridHtml(t, 'post', true) +
      '<div class="rep-lbl">Exit Grade <span style="color:var(--red)">*required</span></div><div class="grow" style="margin-bottom:12px">' + gradeBtns + '</div>' +
      '<div class="rep-lbl">Exit / Mistake Tags <span style="color:var(--red)">*at least one</span></div><div class="ptags">' + mtags + '</div>' +
      '<div class="rfbox" style="margin-top:8px"><div class="rfl">💭 What did the market teach you?</div>' +
        '<textarea class="rfinp" onblur="saveReflection(\'' + t.id + '\',this.value)" placeholder="One sentence — what did this trade teach you?">' + escapeHtml(t.reflectionNote||'') + '</textarea></div>' +
      '<button class="btn btn-gold btn-full" style="margin-top:10px" onclick="markReviewed(\'' + t.id + '\')">✓ ' + (t.reviewComplete?'Save changes':'Mark as Reviewed & view') + '</button>' +
    '</div>';
}

/* ── ACTIONS ── */
function setExitGrade(id, g) {
  saveTradeLog({ id:id, exitGrade:g }, 'Exit grade set to ' + g).then(function(){ renderTradeReport(id); });
}
function toggleMistake(id, m) {
  var t = TRADES.find(function(x){ return x.id===id; });
  var tags = (t.mistakeTags||[]).slice();
  var i = tags.indexOf(m);
  if (i>=0) tags.splice(i,1); else tags.push(m);
  apiUpdateTrade({ id:id, mistakeTags: tags }).then(function(){ renderTradeReport(id); });
}
function saveReflection(id, val) {
  var t = TRADES.find(function(x){ return x.id===id; });
  if (t && (t.reflectionNote||'') === val) return;
  apiUpdateTrade({ id:id, reflectionNote: val });
}
function markReviewed(id) {
  var t = TRADES.find(function(x){ return x.id===id; });
  if (!t.exitGrade) { toast('Select an exit grade first','err'); return; }
  if (!(t.mistakeTags && t.mistakeTags.length)) { toast('Select at least one exit / mistake tag','err'); return; }
  saveTradeLog({ id:id, reviewComplete:true },
    'Reviewed · Exit grade ' + t.exitGrade + ' · tags: ' + (t.mistakeTags||[]).join(', ')).then(function(){
    _reportEdit[id] = false;
    toast('Review complete','ok'); _afterMutation(); renderTradeReport(id);
  }).catch(function(e){ toast('Failed: '+e.message,'err'); });
}
