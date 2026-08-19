/* ============================================================
   J.TRADEBOOK V2 — JOURNAL (Stage 4: POST-TRADE REVIEW)
   Pending-review banner, filters, collapsed rows, dual grades,
   exit grade, mistake tags, reflection, post-exit charts.
   ============================================================ */

var JFILTER = { grade:'ALL', text:'', mistake:'', from:'', to:'' };
var _jexpanded = {};

function renderJournal() {
  var el = document.getElementById('p-journal');
  var all = closedTrades().slice().sort(function(a,b){ return sortByCloseTime(b,a); }); // newest first
  var pending = all.filter(function(t){ return !t.reviewComplete; });

  var filtered = all.filter(function(t){
    if (JFILTER.grade !== 'ALL' && t.entryGrade !== JFILTER.grade && t.exitGrade !== JFILTER.grade) return false;
    if (JFILTER.text && (t.ticker||'').toUpperCase().indexOf(JFILTER.text.toUpperCase()) < 0) return false;
    if (JFILTER.mistake && (t.mistakeTags||[]).indexOf(JFILTER.mistake) < 0) return false;
    var d = shortDate(t.exitTimestamp || t.createdAt);
    if (JFILTER.from && d < JFILTER.from) return false;
    if (JFILTER.to && d > JFILTER.to) return false;
    return true;
  });

  var banner = pending.length
    ? '<div class="jalert"><div style="font-size:16px">⚠️</div>' +
      '<div class="jat"><strong>' + pending.length + ' closed trade' + (pending.length>1?'s':'') + '</strong> pending review — complete reflection to mark as reviewed.</div>' +
      '<button class="btn btn-red btn-sm" style="margin-left:auto" onclick="jumpToPending()">Review Now</button></div>'
    : '';

  var gradeTabs = [['ALL','All'],['A','Grade A'],['B','Grade B'],['C','Grade C ⚠️']].map(function(g){
    return '<button class="tab' + (JFILTER.grade===g[0]?' active':'') + '" onclick="jSetGrade(\'' + g[0] + '\')">' + g[1] + '</button>';
  }).join('');

  var mistakeOpts = '<option value="">All mistakes</option>' + exitReasons().map(function(m){
    return '<option value="' + escapeHtml(m) + '"' + (JFILTER.mistake===m?' selected':'') + '>' + escapeHtml(m) + '</option>';
  }).join('');

  el.innerHTML =
    (MODE==='BACKTEST' ? '<div class="mock-banner"><span style="font-size:15px">🧪</span><div><strong>Backtest Mode</strong> — reviewing simulated trades.</div></div>' : '') +
    banner +
    '<div class="tabs">' + gradeTabs + '</div>' +
    '<div class="searchbar">' +
      '<input class="fi" id="j-search" placeholder="Search ticker…" value="' + escapeHtml(JFILTER.text) + '" oninput="jSetText(this.value)">' +
      '<select class="fi" style="max-width:180px" onchange="jSetMistake(this.value)">' + mistakeOpts + '</select>' +
      '<input class="fi" type="date" style="max-width:150px" value="' + JFILTER.from + '" onchange="jSetDate(\'from\',this.value)" title="From">' +
      '<input class="fi" type="date" style="max-width:150px" value="' + JFILTER.to + '" onchange="jSetDate(\'to\',this.value)" title="To">' +
    '</div>' +
    '<div class="tlist" id="j-list"></div>';

  jRenderList();
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
    return true;
  });
}
function jRenderList() {
  var list = document.getElementById('j-list');
  if (!list) return;
  var rows = jFilteredTrades().map(journalRow).join('');
  list.innerHTML = rows || '<div class="empty">No closed trades match.' + (MODE==='BACKTEST'?' (Backtest)':'') + '</div>';
  wireTradeSlots(list, function(){ _afterMutation(); renderJournal(); });
}

/* filters */
function jSetGrade(g){ JFILTER.grade=g; renderJournal(); }
function jSetText(v){ JFILTER.text=v; jRenderList(); }
function jSetMistake(v){ JFILTER.mistake=v; jRenderList(); }
function jSetDate(k,v){ JFILTER[k]=v; jRenderList(); }
function jToggle(id){ _jexpanded[id]=!_jexpanded[id]; renderJournal(); }
function jumpToPending(){ var t=closedTrades().filter(function(x){return !x.reviewComplete;})[0]; if(t){_jexpanded[t.id]=true; renderJournal();} }

function journalRow(t) {
  var acc = getAccount(t.accountId); var cur = acc?acc.currency:'USD';
  var open = !!_jexpanded[t.id];
  var pnl = tradePnL(t);
  var needsReview = !t.reviewComplete;

  var gradeArea = needsReview && !t.exitGrade
    ? '<div style="display:flex;gap:5px;align-items:center">' + gradePill('Entry', t.entryGrade) +
      '<span class="review-flag">⚠ REVIEW NEEDED</span></div>'
    : '<div style="display:flex;gap:5px">' + gradePill('Entry', t.entryGrade) + gradePill('Exit', t.exitGrade) + '</div>';

  return '<div class="tcard' + ((t.entryGrade==='C'||t.exitGrade==='C')?' flag':'') + '">' +
    '<div class="trow" onclick="jToggle(\'' + t.id + '\')">' +
      '<div class="tsym">' + escapeHtml(t.ticker) + '</div>' + dirBadge(t.direction) + statusBadge('CLOSED') +
      '<div class="tinfo">' +
        '<div class="tf"><div class="tfl">Avg→Exit</div><div class="tfv">' + fmtN(tradeAvgEntry(t)) + '→' + fmtN(lastExitPrice(t)) + '</div></div>' +
        '<div class="tf"><div class="tfl">R</div><div class="tfv ' + pnlClass(tradeR(t)) + '">' + rStr(tradeR(t)) + '</div></div>' +
      '</div>' + gradeArea +
      '<div class="tpnl ' + pnlClass(pnl) + '">' + moneySigned(pnl,cur) + '</div>' +
    '</div>' +
    '<div class="tdetail' + (open?' show':'') + '" id="jdet-' + t.id + '">' + (open?journalDetail(t):'') + '</div>' +
  '</div>';
}

function journalDetail(t) {
  var grades = [['A','Followed Plan'],['B','Early Exit OK'],['C','Panic / Moved SL']];
  var gradeBtns = grades.map(function(g){
    return '<button class="gbtn g' + g[0].toLowerCase() + '-s' + (t.exitGrade===g[0]?' sel':'') + '" onclick="setExitGrade(\'' + t.id + '\',\'' + g[0] + '\')">' +
      '<div class="gl">' + g[0] + '</div><div class="gd">' + g[1] + '</div></button>';
  }).join('');

  var mtags = exitReasons().map(function(m){
    var sel = (t.mistakeTags||[]).indexOf(m) >= 0;
    var bad = m !== 'Clean Execution';
    return '<span class="ptag' + (bad?' bad':'') + (sel?' sel':'') + '" onclick="toggleMistake(\'' + t.id + '\',\'' + escapeHtml(m).replace(/'/g,"\\'") + '\')">' + escapeHtml(m) + '</span>';
  }).join('');

  var reasons = (t.entryReasonTags||[]).map(function(r){ return '<span class="ptag sel">' + escapeHtml(r) + '</span>'; }).join('');

  return '<div class="cpair">' +
      chartSlotHtml(t.preChartUrl4H, '4H Pre-Trade', t.id + '|preChartUrl4H') +
      chartSlotHtml(t.preChartUrl1H, '1H Pre-Trade', t.id + '|preChartUrl1H') +
    '</div>' +
    '<div class="cpair">' +
      chartSlotHtml(t.postChartUrl4H, '4H Post-Exit', t.id + '|postChartUrl4H') +
      chartSlotHtml(t.postChartUrl1H, '1H Post-Exit', t.id + '|postChartUrl1H') +
    '</div>' +
    (reasons ? '<div class="fl" style="margin:10px 0 4px">Entry Reasons</div><div class="ptags">' + reasons + '</div>' : '') +
    '<div class="fl" style="margin:10px 0 6px">Exit Grade</div><div class="grow" style="margin-bottom:12px">' + gradeBtns + '</div>' +
    '<div class="fl" style="margin-bottom:6px">Mistake Tags</div><div class="ptags">' + mtags + '</div>' +
    '<div class="rfbox" style="margin-top:8px"><div class="rfl">💭 What did the market teach you?</div>' +
      '<textarea class="rfinp" onblur="saveReflection(\'' + t.id + '\',this.value)" placeholder="One sentence — what did this trade teach you?">' + escapeHtml(t.reflectionNote||'') + '</textarea></div>' +
    (t.reviewComplete
      ? '<div class="review-done">✓ Review complete</div>'
      : '<button class="btn btn-gold btn-full" style="margin-top:10px" onclick="markReviewed(\'' + t.id + '\')">✓ Mark as Reviewed</button>');
}

/* ── ACTIONS ── */
function setExitGrade(id, g) {
  apiUpdateTrade({ id:id, exitGrade:g }).then(function(){ renderJournal(); });
}
function toggleMistake(id, m) {
  var t = TRADES.find(function(x){ return x.id===id; });
  var tags = (t.mistakeTags||[]).slice();
  var i = tags.indexOf(m);
  if (i>=0) tags.splice(i,1); else tags.push(m);
  apiUpdateTrade({ id:id, mistakeTags: tags }).then(function(){ renderJournal(); });
}
function saveReflection(id, val) {
  var t = TRADES.find(function(x){ return x.id===id; });
  if (t && (t.reflectionNote||'') === val) return;
  apiUpdateTrade({ id:id, reflectionNote: val });
}
function markReviewed(id) {
  var t = TRADES.find(function(x){ return x.id===id; });
  if (!t.exitGrade) { toast('Select an exit grade first','err'); return; }
  apiUpdateTrade({ id:id, reviewComplete:true }).then(function(){
    toast('Review complete','ok'); _afterMutation(); renderJournal();
  }).catch(function(e){ toast('Failed: '+e.message,'err'); });
}
