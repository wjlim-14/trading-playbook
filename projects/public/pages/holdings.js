/* ============================================================
   J.TRADEBOOK V3 — HOLDINGS (Execute · Scale · Exit)
   Fills lifecycle: Mark Executed, Add to position, Take partial,
   Move stop, Close all. Status PLANNING/ACTIVE/PARTIAL/CLOSED.
   ============================================================ */

var HOLD_TAB = 'ACTIVE';
var _expanded = {};

function renderHoldings() {
  var el = document.getElementById('p-holdings');
  var heat = portfolioHeat();
  var over = heat.pct > heat.limit;

  var planning = planningTrades();
  var actives = activeTrades();                 // ACTIVE + PARTIAL
  var closedToday = closedTodayTrades();
  var counts = { PLANNING: planning.length, ACTIVE: actives.length, 'CLOSED TODAY': closedToday.length };
  var lists = { PLANNING: planning, ACTIVE: actives, 'CLOSED TODAY': closedToday };

  var dups = duplicateExposure();
  var dupHtml = dups.length
    ? '<div class="warn-banner">⚠️ Multiple open positions on: <strong>' + dups.join(', ') + '</strong> — combined exposure.</div>' : '';

  var tabs = ['PLANNING','ACTIVE','CLOSED TODAY'].map(function(t){
    return '<button class="stab' + (HOLD_TAB===t?' active':'') + '" onclick="setHoldTab(\'' + t + '\')">' + t + ' (' + counts[t] + ')</button>';
  }).join('');

  var rows = lists[HOLD_TAB].map(holdingRow).join('');
  if (!rows) rows = '<div class="empty">No ' + HOLD_TAB.toLowerCase() + ' trades' + (MODE==='BACKTEST'?' (Backtest)':'') + '.</div>';

  el.innerHTML =
    (MODE==='BACKTEST' ? '<div class="mock-banner"><span style="font-size:15px">🧪</span><div><strong>Backtest Mode</strong> — simulated positions.</div></div>' : '') +
    '<div class="heat-banner' + (over?' over':'') + '">' +
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><div class="dot"></div><span style="font-weight:500">Portfolio Heat</span>' +
        '<span style="font-family:var(--mono);font-weight:700;color:' + (over?'var(--red)':'var(--amber)') + '">' + money(heat.risk,heat.currency) + ' (' + heat.pct + '%) open risk' + (ACTIVE_ACCOUNT==='all'?' ≈'+heat.currency:'') + '</span></div>' +
      '<span style="font-size:10px;color:var(--muted)">Limit: ' + heat.limit + '%</span>' +
    '</div>' +
    (ACTIVE_ACCOUNT==='all' ? perAccountHeatRow() : '') + dupHtml +
    '<div class="stabs">' + tabs + '</div>' +
    '<div class="tlist">' + rows + '</div>';

  wireTradeSlots(el, function(){ _afterMutation(); renderHoldings(); });
  wireShotSlots(el, function(){ _afterMutation(); renderHoldings(); });
}

function perAccountHeatRow() {
  var rows = perAccountHeat();
  if (!rows.length) return '';
  var chips = rows.map(function(r){
    var over = r.pct > (PREFS.dailyLimitPct||6);
    return '<span style="display:inline-flex;gap:6px;align-items:center;background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:4px 11px;font-size:11px">' +
      '<span style="font-weight:600">' + escapeHtml(r.account.name.split(' ')[0]) + '</span>' +
      '<span style="font-family:var(--mono);color:' + (over?'var(--red)':'var(--amber)') + '">' + money(r.risk,r.currency) + ' (' + r.pct + '%)</span></span>';
  }).join('');
  return '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">' + chips + '</div>';
}

function setHoldTab(t) { HOLD_TAB = t; renderHoldings(); }
function toggleExpand(id) { _expanded[id] = !_expanded[id]; renderHoldings(); }

function holdingRow(t) {
  var acc = getAccount(t.accountId); var cur = acc ? acc.currency : 'USD';
  var open = !!_expanded[t.id];
  var st = tradeStatus(t);
  var meta = assetClassMeta(assetClassOf(t));

  var infoFields, right, actionBtn = '';
  if (st === 'CLOSED') {
    infoFields =
      '<div class="tf"><div class="tfl">Avg→Exit</div><div class="tfv">' + fmtN(tradeAvgEntry(t)) + '→' + fmtN(lastExitPrice(t)) + '</div></div>' +
      '<div class="tf"><div class="tfl">R</div><div class="tfv ' + pnlClass(tradeR(t)) + '">' + rStr(tradeR(t)) + '</div></div>';
    right = '<div class="tpnl ' + pnlClass(tradePnL(t)) + '">' + moneySigned(tradePnL(t),cur) + '</div>';
  } else {
    var realized = tradeRealizedPnL(t);
    infoFields =
      '<div class="tf"><div class="tfl">Avg Entry</div><div class="tfv">' + fmtN(tradeAvgEntry(t)) + '</div></div>' +
      '<div class="tf"><div class="tfl">Open</div><div class="tfv">' + fmtN(tradeOpenSize(t)) + ' ' + meta.unit.toLowerCase() + '</div></div>' +
      '<div class="tf"><div class="tfl">SL</div><div class="tfv">' + fmtN(t.stopLossPrice) + '</div></div>' +
      '<div class="tf"><div class="tfl">Open Risk</div><div class="tfv text-neg">' + money(tradeOpenRisk(t),cur) + '</div></div>' +
      (st==='PARTIAL' ? '<div class="tf"><div class="tfl">Booked</div><div class="tfv ' + pnlClass(realized) + '">' + moneySigned(realized,cur) + '</div></div>' : '');
    if (t.status === 'PLANNING')
      actionBtn = '<button class="btn btn-green btn-sm" onclick="event.stopPropagation();markExecuted(\'' + t.id + '\')">✓ Executed</button>';
    else
      actionBtn = '<button class="btn btn-red btn-sm" onclick="event.stopPropagation();openPartialModal(\'' + t.id + '\')">Take Profit</button>';
    right = gradePill('Entry', t.entryGrade);
  }

  return '<div class="tcard">' +
    '<div class="trow" onclick="toggleExpand(\'' + t.id + '\')">' +
      '<div class="tsym">' + escapeHtml(t.ticker) + '</div>' + dirBadge(t.direction) + statusBadge(st) +
      '<div class="tinfo">' + infoFields + '</div>' +
      '<div style="margin-left:auto;display:flex;align-items:center;gap:8px">' + right + actionBtn + '</div>' +
    '</div>' +
    '<div class="tdetail' + (open?' show':'') + '" id="det-' + t.id + '">' + (open ? holdingDetail(t, st) : '') + '</div>' +
  '</div>';
}

/* fmtN + lastExitPrice live in utils.js (shared) */

function holdingDetail(t, st) {
  var reasons = (t.entryReasonTags||[]).map(function(r){ return '<span class="ptag sel">' + escapeHtml(r) + '</span>'; }).join('');
  var charts =
    tfPickerRow(t) +
    '<div class="fl" style="margin:2px 0 5px">Pre-Trade Charts</div>' +
    shotsGridHtml(t, 'pre', true);

  var fills = fillsHistory(t);

  var actions = '';
  if (t.status === 'PLANNING') {
    actions = '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-green btn-full" onclick="markExecuted(\'' + t.id + '\')">✓ Mark as Executed</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="deleteTrade(\'' + t.id + '\')">Delete</button></div>';
  } else if (st === 'ACTIVE' || st === 'PARTIAL') {
    actions =
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">' +
        '<button class="btn btn-green btn-sm" onclick="openAddModal(\'' + t.id + '\')">+ Add to position</button>' +
        '<button class="btn btn-gold btn-sm" onclick="openPartialModal(\'' + t.id + '\')">Take partial</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="openStopModal(\'' + t.id + '\')">Move stop</button>' +
        '<button class="btn btn-red btn-sm" onclick="openCloseModal(\'' + t.id + '\')">Close all</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="openEditFillsModal(\'' + t.id + '\', renderHoldings)">✎ Edit fills</button>' +
      '</div>';
  } else if (st === 'CLOSED') {
    actions =
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">' +
        '<button class="btn btn-ghost btn-sm" onclick="openEditFillsModal(\'' + t.id + '\', renderHoldings)">✎ Edit fills (fix price / re-open)</button>' +
      '</div>';
  }

  return charts +
    (reasons ? '<div class="ptags">' + reasons + '</div>' : '') +
    fills +
    '<div class="rfbox"><div class="rfl">Setup Notes</div>' +
      '<textarea class="rfinp" onblur="saveSetupNotes(\'' + t.id + '\',this.value)" placeholder="Setup notes…">' + escapeHtml(t.setupNotes||'') + '</textarea></div>' +
    tradeLogHtml(t) +
    actions;
}

/* Timestamped audit trail (Malaysia time), newest first. */
function tradeLogHtml(t) {
  var log = t.log || [];
  if (!log.length) return '';
  var rows = log.slice().reverse().map(function(e){
    return '<div style="display:flex;gap:8px;align-items:baseline"><span style="font-family:var(--mono);font-size:10px;color:var(--muted);white-space:nowrap;flex-shrink:0">' + fmtMYT(e.time) + '</span>' +
      '<span style="font-size:11px">' + escapeHtml(e.text) + '</span></div>';
  }).join('');
  return '<div class="rfbox" style="margin-top:8px"><div class="rfl">📋 Trade Log</div>' +
    '<div style="display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto">' + rows + '</div></div>';
}

function fillsHistory(t) {
  var e = tradeEntries(t), x = tradeExits(t);
  if (!e.length && !x.length) return '';
  var acc = getAccount(t.accountId), cur = acc ? acc.currency : 'USD';
  var rows = [];
  e.forEach(function(l, i){ rows.push(fillLine('IN #' + (i+1), l, 'var(--green)', cur, t)); });
  x.forEach(function(l, i){ rows.push(fillLine('OUT #' + (i+1), l, 'var(--red)', cur, t)); });

  var deployed = tradeDeployed(t), takenBack = tradeTakenBack(t), openCost = tradeOpenCost(t), realized = tradeRealizedPnL(t) || 0;
  var summary =
    '<div class="fill-sum">' +
      capCell('Capital deployed', money(deployed, cur)) +
      capCell('Taken back', money(takenBack, cur)) +
      capCell('Still in market', money(openCost, cur)) +
      capCell('Booked P&L', moneySigned(realized, cur), pnlClass(realized)) +
    '</div>';

  return '<div class="rfbox" style="margin-top:8px"><div class="rfl">Fills &amp; Capital</div>' +
    '<div style="display:flex;flex-direction:column;gap:4px">' + rows.join('') + '</div>' + summary + '</div>';
}
function fillLine(kind, l, color, cur, t) {
  var cost = fillNotional(t, l.size, l.price);
  var isOut = kind.indexOf('OUT') === 0;
  var rp = isOut ? legRealized(t, l) : null;
  return '<div class="fill-row">' +
    '<span class="fill-k" style="color:' + color + '">' + kind + '</span>' +
    '<span class="fill-sz">' + fmtN(l.size) + ' @ ' + fmtN(l.price) + '</span>' +
    '<span class="fill-cost">' + (isOut ? '↩ ' : '') + money(cost, cur) + '</span>' +
    (rp != null ? '<span class="fill-pnl ' + pnlClass(rp) + '">' + moneySigned(rp, cur) + '</span>' : '<span class="fill-pnl"></span>') +
    (l.note ? '<span class="fill-note">' + escapeHtml(l.note) + '</span>' : '') +
  '</div>';
}
function capCell(label, val, cls) {
  return '<div class="cap-cell"><div class="cap-l">' + label + '</div><div class="cap-v ' + (cls||'') + '">' + val + '</div></div>';
}

/* ── EXECUTE ── */
function markExecuted(id) {
  var t = TRADES.find(function(x){ return x.id===id; });
  var size = (t.executedSize != null && t.executedSize>0) ? t.executedSize : t.positionSize;
  var entries = [{ size: size, price: t.entryPrice, time: nowIso() }];
  saveTradeLog({ id:id, status:'ACTIVE', entries: entries, executedSize: size, entryTimestamp: t.entryTimestamp || nowIso() },
    'Executed · ' + size + ' @ ' + t.entryPrice).then(function(){
    toast('Marked ACTIVE', 'ok'); HOLD_TAB = 'ACTIVE'; _afterMutation(); renderHoldings();
  }).catch(function(e){ toast('Failed: ' + e.message, 'err'); });
}

function saveSetupNotes(id, val) {
  var t = TRADES.find(function(x){ return x.id===id; });
  if (t && (t.setupNotes||'') === val) return;
  apiUpdateTrade({ id:id, setupNotes: val });
}
function deleteTrade(id) {
  openModal({ title:'Delete trade?', body:'<p style="font-size:13px;color:var(--text2)">Remove this planned trade.</p>',
    footer:'<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-red" onclick="confirmDeleteTrade(\'' + id + '\')">Delete</button>' });
}
function confirmDeleteTrade(id) { apiDeleteTrade(id).then(function(){ closeModal(); toast('Deleted','ok'); _afterMutation(); renderHoldings(); }); }

/* ── ADD TO POSITION (mini position-sizer) ── */
var _add = null;
function openAddModal(id) {
  var t = TRADES.find(function(x){ return x.id===id; }); if (!t) return;
  var avg = tradeAvgEntry(t) || t.entryPrice || 0;
  _add = { id:id, method:'pct', pct:30, riskMode:'dol', riskAmt:'', price: round(avg, priceDp(avg)), size:0, note:'' };
  addComputeSize();
  openModal({
    title: 'Add to ' + escapeHtml(t.ticker),
    width: 580,
    body: '<div id="add-wrap">' + addBody() + '</div>',
    footer:'<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-green" onclick="confirmAdd()">Add to position</button>'
  });
}
function _addTrade() { return TRADES.find(function(x){ return x.id===_add.id; }); }
function addComputeSize() {
  var t = _addTrade(); var price = parseFloat(_add.price);
  var open = tradeOpenSize(t), vpp = tradeVPP(t, price), size = 0;
  if (_add.method === 'pct') {
    size = open * (parseFloat(_add.pct)||0) / 100;
  } else if (_add.method === 'risk') {
    var riskAmt = _add.riskMode === 'pct' ? (accountBalance(t.accountId) * (parseFloat(_add.riskAmt)||0)/100) : (parseFloat(_add.riskAmt)||0);
    var sl = t.stopLossPrice;
    if (isFinite(price) && sl != null && Math.abs(price - sl) > 0 && vpp > 0) size = riskAmt / (Math.abs(price - sl) * vpp);
  } else if (_add.method === 'profit') {
    var prof = tradeRunningProfit(t, price);
    if (prof > 0 && isFinite(price) && price > 0 && vpp > 0) size = prof / (price * vpp);
  }
  _add.size = (size > 0 && isFinite(size)) ? round(size, 4) : 0;
}
function addBody() {
  var t = _addTrade();
  var acc = getAccount(t.accountId), cur = acc ? acc.currency : 'USD';
  var meta = assetClassMeta(assetClassOf(t)), unit = meta.unit.toLowerCase();
  var open = tradeOpenSize(t), avg = tradeAvgEntry(t);
  var running = tradeRunningProfit(t, parseFloat(_add.price));

  var stats =
    '<div class="add-stats">' +
      capCell('Open ' + unit, fmtN(open)) +
      capCell('Avg entry', fmtN(avg)) +
      capCell('Open risk', money(tradeOpenRisk(t), cur), 'r') +
      capCell('Running P&L', moneySigned(running, cur), pnlClass(running)) +
    '</div>';

  var tabs = '<div class="rtog" style="margin:10px 0 8px">' +
    [['pct','% of open'],['risk','By risk'],['profit','Reinvest P&L']].map(function(m){
      return '<button class="rtbtn' + (_add.method===m[0]?' active':'') + '" onclick="addMethod(\'' + m[0] + '\')">' + m[1] + '</button>';
    }).join('') + '</div>';

  var controls = '';
  if (_add.method === 'pct') {
    controls =
      '<div class="fl" style="margin-bottom:4px">Portion of open position: <b>' + (parseFloat(_add.pct)||0) + '%</b></div>' +
      '<input class="rng" type="range" min="0" max="100" step="5" value="' + (parseFloat(_add.pct)||0) + '" oninput="addSetPct(this.value)">' +
      '<div style="display:flex;gap:6px;margin-top:6px">' + [20,30,40,50].map(function(p){
        return '<button class="btn btn-ghost btn-sm" style="flex:1" onclick="addSetPct(' + p + ')">' + p + '%</button>'; }).join('') + '</div>';
  } else if (_add.method === 'risk') {
    var slTxt = t.stopLossPrice != null ? fmtN(t.stopLossPrice) : '— set a stop first';
    controls =
      '<div class="rtog" style="margin-bottom:8px">' +
        '<button class="rtbtn' + (_add.riskMode==='dol'?' active':'') + '" onclick="addRiskMode(\'dol\')">' + curSym(cur) + ' amount</button>' +
        '<button class="rtbtn' + (_add.riskMode==='pct'?' active':'') + '" onclick="addRiskMode(\'pct\')">% of account</button>' +
      '</div>' +
      '<div class="field"><div class="fl">Risk for this add ' + (_add.riskMode==='pct'?'(% of account)':'(' + curSym(cur) + ')') + '</div>' +
        '<input class="fi" value="' + escapeHtml(String(_add.riskAmt)) + '" placeholder="' + (_add.riskMode==='pct'?'e.g. 0.5':'e.g. 100') + '" oninput="addSetRisk(this.value)"></div>' +
      '<div class="isolation-note" style="margin-top:6px">Sizes off your current stop (' + slTxt + ') so this add stays inside its own risk budget.</div>';
  } else {
    var running2 = tradeRunningProfit(t, parseFloat(_add.price));
    controls = running2 > 0
      ? '<div class="isolation-note">Deploys your running profit (' + moneySigned(running2, cur) + ', marked at the fill price) into more ' + unit + ' — compounds the winner without adding fresh capital.</div>'
      : '<div class="isolation-note" style="border-color:var(--red)">Running P&L is not positive yet — nothing to reinvest.</div>';
  }

  var priceSize =
    '<div class="cg2" style="margin-top:10px">' +
      '<div class="field"><div class="fl">Fill price</div><input class="fi" id="add-price" value="' + _add.price + '" oninput="addSetPrice(this.value)"></div>' +
      '<div class="field"><div class="fl">Add size (' + unit + ') — editable</div><input class="fi" id="add-size" value="' + fmtN(_add.size) + '" oninput="addSetSize(this.value)"></div>' +
    '</div>' +
    '<div class="field" style="margin-top:8px"><div class="fl">Note</div><input class="fi" id="add-note" value="' + escapeHtml(_add.note||'') + '" placeholder="e.g. added on breakout retest" oninput="_add.note=this.value"></div>';

  return stats + tabs + controls + priceSize + '<div id="add-out">' + addOutHtml() + '</div>';
}
function addOutHtml() {
  var t = _addTrade();
  var acc = getAccount(t.accountId), cur = acc ? acc.currency : 'USD';
  var price = parseFloat(_add.price), size = parseFloat(_add.size);
  if (!(isFinite(price) && isFinite(size) && size > 0)) {
    return '<div class="cout" style="margin-top:12px"><div class="oi"><div class="ol">Enter a valid size</div><div class="ov">—</div></div></div>';
  }
  var entries = (t.entries && t.entries.length ? t.entries.slice() : tradeEntries(t).slice());
  entries.push({ size:size, price:price });
  var tmp = Object.assign({}, t, { entries: entries });
  var newAvg = tradeAvgEntry(tmp), newOpen = tradeOpenSize(tmp);
  var addCost = fillNotional(t, size, price);
  var riskBefore = tradeOpenRisk(t), riskAfter = tradeOpenRisk(tmp);

  // account heat after this add
  var eq = accountBalance(t.accountId) || 0;
  var acctRiskAfter = (accountOpenRisk(t.accountId) - riskBefore) + riskAfter;
  var heatAfter = eq > 0 ? round(acctRiskAfter / eq * 100, 1) : 0;
  var limit = (PREFS && PREFS.dailyLimitPct) || 6;
  var over = heatAfter > limit;

  function oi(l,v,cls){ return '<div class="oi"><div class="ol">' + l + '</div><div class="ov ' + (cls||'') + '">' + v + '</div></div>'; }
  return '<div class="cout" style="grid-template-columns:1fr 1fr 1fr;margin-top:12px">' +
      oi('New avg entry', fmtN(newAvg)) +
      oi('New open size', fmtN(newOpen)) +
      oi('Add cost', money(addCost, cur)) +
    '</div>' +
    '<div class="cout" style="grid-template-columns:1fr 1fr;margin-top:8px">' +
      oi('Trade risk after', money(riskAfter, cur) + ' (was ' + money(riskBefore, cur) + ')', 'r') +
      oi('Account heat after', heatAfter + '% of ' + limit + '%', over ? 'r' : '') +
    '</div>' +
    (over ? '<div class="isolation-note" style="border-color:var(--red);color:var(--red);margin-top:6px">⚠ This add pushes account heat over your ' + limit + '% limit.</div>' : '');
}
function addRerender(){ var w = document.getElementById('add-wrap'); if (w) w.innerHTML = addBody(); }
function addPaintLive(){
  var sz = document.getElementById('add-size'); if (sz && document.activeElement !== sz) sz.value = fmtN(_add.size);
  var out = document.getElementById('add-out'); if (out) out.innerHTML = addOutHtml();
}
function addMethod(m){ _add.method = m; addComputeSize(); addRerender(); }
function addRiskMode(m){ _add.riskMode = m; addComputeSize(); addRerender(); }
function addSetPct(v){ _add.pct = v; addComputeSize(); addRerender(); }
function addSetRisk(v){ _add.riskAmt = v; addComputeSize(); addPaintLive(); }
function addSetPrice(v){ _add.price = v; addComputeSize(); addPaintLive(); }
function addSetSize(v){ _add.size = parseFloat(v)||0; var out=document.getElementById('add-out'); if(out) out.innerHTML=addOutHtml(); }
function confirmAdd() {
  var t = _addTrade();
  var size = parseFloat(_add.size), price = parseFloat(_add.price);
  if (!isFinite(size) || size<=0 || !isFinite(price)) { toast('Enter a valid size & price','err'); return; }
  var entries = (t.entries&&t.entries.length?t.entries.slice():tradeEntries(t).slice());
  entries.push({ size:size, price:price, time:nowIso(), note:(_add.note||'').trim() });
  var methodTxt = _add.method==='pct' ? _add.pct+'% of open' : (_add.method==='risk'?'risk-based':'reinvest P&L');
  saveTradeLog({ id:t.id, entries:entries, status:'ACTIVE' },
    'Added ' + fmtN(size) + ' @ ' + price + ' (' + methodTxt + ')' + (_add.note?' · '+_add.note.trim():'')).then(function(){
    closeModal(); toast('Added to position','ok'); _afterMutation(); renderHoldings();
  }).catch(function(e){ toast('Failed: '+e.message,'err'); });
}

/* ── TAKE PARTIAL ── */
var _partial = null;
function openPartialModal(id) {
  var t = TRADES.find(function(x){ return x.id===id; }); if (!t) return;
  var openSz = tradeOpenSize(t);
  var acc = getAccount(t.accountId), cur = acc?acc.currency:'USD';
  _partial = { id:id, pct:30, size: round(openSz*0.3,4), price: t.targetPrice!=null?t.targetPrice:t.entryPrice };
  openModal({
    title: 'Take profit · ' + escapeHtml(t.ticker),
    width: 560,
    body:
      '<div class="fl" style="margin-bottom:4px">Close <b id="p-pctlbl">' + _partial.pct + '%</b> of open (' + fmtN(openSz) + ' ' + assetClassMeta(assetClassOf(t)).unit.toLowerCase() + ')</div>' +
      '<input class="rng" id="p-slider" type="range" min="0" max="100" step="5" value="' + _partial.pct + '" oninput="partialSlide(this.value)">' +
      '<div style="display:flex;gap:6px;margin-top:6px">' +
        [30,40,50,100].map(function(p){ return '<button class="btn btn-ghost btn-sm" style="flex:1" onclick="partialSlide(' + p + ')">' + p + '%</button>'; }).join('') +
      '</div>' +
      '<div class="cg2" style="margin-top:10px"><div class="field"><div class="fl">Close size</div><input class="fi" id="p-size" value="' + _partial.size + '" oninput="partialSetSize(this.value)"></div>' +
      '<div class="field"><div class="fl">Exit price</div><input class="fi" id="p-price" value="' + _partial.price + '" oninput="_partial.price=parseFloat(this.value);partialPaint()"></div></div>' +
      '<div class="field"><div class="fl">Note</div><input class="fi" id="p-note" placeholder="e.g. secured initial capital, runner on"></div>' +
      '<div class="cout" style="grid-template-columns:1fr 1fr 1fr;margin:4px 0 0">' +
        '<div class="oi"><div class="ol">Booked P&L</div><div class="ov" id="p-pnl">—</div></div>' +
        '<div class="oi"><div class="ol">Taken back</div><div class="ov" id="p-cap">—</div></div>' +
        '<div class="oi"><div class="ol">Remaining</div><div class="ov" id="p-rem">—</div></div></div>',
    footer:'<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-gold" onclick="confirmPartial()">Book it</button>',
    onMount: partialPaint
  });
}
function partialSlide(p) {
  var t = TRADES.find(function(x){ return x.id===_partial.id; });
  _partial.pct = parseFloat(p)||0;
  _partial.size = round(tradeOpenSize(t) * _partial.pct/100, 4);
  var i=document.getElementById('p-size'); if(i)i.value=_partial.size;
  var s=document.getElementById('p-slider'); if(s)s.value=_partial.pct;
  var l=document.getElementById('p-pctlbl'); if(l)l.textContent=_partial.pct+'%';
  partialPaint();
}
function partialSetSize(v) {
  var t = TRADES.find(function(x){ return x.id===_partial.id; });
  _partial.size = parseFloat(v)||0;
  var open = tradeOpenSize(t);
  _partial.pct = open>0 ? round(_partial.size/open*100,0) : 0;
  var s=document.getElementById('p-slider'); if(s)s.value=_partial.pct;
  var l=document.getElementById('p-pctlbl'); if(l)l.textContent=_partial.pct+'%';
  partialPaint();
}
function partialPaint() {
  var t = TRADES.find(function(x){ return x.id===_partial.id; });
  var acc = getAccount(t.accountId), cur = acc?acc.currency:'USD';
  var avg = tradeAvgEntry(t), dir = dirSign(t), vpp = tradeVPP(t, _partial.price);
  var pnl = (isFinite(_partial.size)&&isFinite(_partial.price)) ? round(_partial.size*(_partial.price-avg)*dir*vpp,2) : null;
  var cap = (isFinite(_partial.size)&&isFinite(_partial.price)) ? round(_partial.size*vpp*_partial.price,2) : null;
  var rem = round(tradeOpenSize(t) - (_partial.size||0), 4);
  var pe=document.getElementById('p-pnl'), ce=document.getElementById('p-cap'), re=document.getElementById('p-rem');
  if (pe){ pe.textContent = pnl==null?'—':moneySigned(pnl,cur); pe.className='ov '+pnlClass(pnl); }
  if (ce) ce.textContent = cap==null?'—':money(cap,cur);
  if (re) re.textContent = isFinite(rem)?fmtN(rem):'—';
}
function confirmPartial() {
  var t = TRADES.find(function(x){ return x.id===_partial.id; });
  var openSz = tradeOpenSize(t);
  var size = _partial.size, price = _partial.price;
  if (!isFinite(size) || size<=0 || !isFinite(price)) { toast('Enter size & price','err'); return; }
  if (size > openSz + 1e-6) { toast('Size exceeds open position','err'); return; }
  var exits = (t.exits&&t.exits.length?t.exits.slice():tradeExits(t).filter(function(){return false;}));
  var pnote = document.getElementById('p-note').value.trim();
  exits.push({ size:size, price:price, time:nowIso(), note:pnote });
  var remaining = round(openSz - size, 6);
  var patch = { id:_partial.id, exits:exits, exitTimestamp: nowIso() };
  if (remaining <= 1e-6) {
    patch.status = 'CLOSED';
    patch.exitPrice = price;
    // finalize realized totals for reporting
    var tmp = Object.assign({}, t, { exits: exits });
    patch.realizedPnL = tradeRealizedPnL(tmp);
    patch.realizedR = patch.realizedPnL!=null && tradePlannedRisk(tmp) ? round(patch.realizedPnL/tradePlannedRisk(tmp),2) : null;
  } else {
    patch.status = 'PARTIAL';
  }
  var logTxt = 'Took partial ' + size + ' @ ' + price + (pnote?' · '+pnote:'') + (remaining<=1e-6 ? ' · position CLOSED' : ' · ' + remaining + ' left');
  saveTradeLog(patch, logTxt).then(function(){
    closeModal();
    toast(remaining<=1e-6 ? 'Trade closed' : 'Partial booked', 'ok');
    HOLD_TAB = remaining<=1e-6 ? 'CLOSED TODAY' : 'ACTIVE';
    _afterMutation(); renderHoldings();
  }).catch(function(e){ toast('Failed: '+e.message,'err'); });
}

/* ── EDIT FILLS (fix wrong price / size / mistaken close) ──
   Works from Journal and Holdings. Editable list of every entry (IN)
   and exit (OUT) leg; recomputes status/PnL. Reducing exits below the
   entry size re-opens the trade (CLOSED → PARTIAL/ACTIVE).            */
var _editFills = null;
var _editFillsRerender = null;

function openEditFillsModal(id, rerender) {
  var t = TRADES.find(function(x){ return x.id===id; }); if (!t) return;
  _editFillsRerender = rerender || function(){ _afterMutation(); };
  _editFills = {
    id: id,
    entries: tradeEntries(t).map(function(f){ return { size:f.size, price:f.price, time:f.time||null, note:f.note||'' }; }),
    exits:   tradeExits(t).map(function(f){ return { size:f.size, price:f.price, time:f.time||null, note:f.note||'' }; })
  };
  openModal({
    title: 'Edit trade · ' + escapeHtml(t.ticker),
    body: editFillsBody(),
    footer: '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>' +
            '<button class="btn btn-gold" onclick="confirmEditFills()">Save changes</button>'
  });
}
function efCleanFill(f){ return { size:parseFloat(f.size)||0, price:parseFloat(f.price)||0, time:f.time||nowIso(), note:f.note||'' }; }
function efArr(kind){ return _editFills[kind==='in'?'entries':'exits']; }
function efSet(kind,i,k,v){ efArr(kind)[i][k]=v; efPaintSum(); }
function efAdd(kind){ efArr(kind).push({ size:'', price:'', time:nowIso(), note:'' }); efPaintWrap(); }
function efDel(kind,i){ efArr(kind).splice(i,1); efPaintWrap(); }
function efPaintWrap(){ var w=document.getElementById('ef-wrap'); if(w) w.outerHTML=editFillsBody(); }
function efPaintSum(){ var s=document.getElementById('ef-sum'); if(s) s.outerHTML=efSummaryHtml(); }

function efSection(kind, arr, color, label, addLabel) {
  var rows = arr.map(function(f,i){
    return '<div style="display:flex;gap:6px;align-items:center;margin-bottom:5px">' +
      '<input class="fi" style="flex:1;min-width:0" data-k="size" value="' + (f.size!=null?f.size:'') + '" placeholder="size" oninput="efSet(\'' + kind + '\',' + i + ',\'size\',this.value)">' +
      '<span style="color:var(--muted);font-size:12px">@</span>' +
      '<input class="fi" style="flex:1;min-width:0" data-k="price" value="' + (f.price!=null?f.price:'') + '" placeholder="price" oninput="efSet(\'' + kind + '\',' + i + ',\'price\',this.value)">' +
      '<button class="btn btn-ghost btn-sm" title="Remove" onclick="efDel(\'' + kind + '\',' + i + ')">✕</button>' +
    '</div>';
  }).join('') || '<div style="font-size:11px;color:var(--muted);margin-bottom:5px">— none —</div>';
  return '<div class="fl" style="margin:10px 0 5px;color:' + color + '">' + label + '</div>' + rows +
    '<button class="btn btn-ghost btn-sm" onclick="efAdd(\'' + kind + '\')">+ ' + addLabel + '</button>';
}
function efSummaryHtml() {
  var t = TRADES.find(function(x){ return x.id===_editFills.id; });
  var acc = getAccount(t.accountId), cur = acc?acc.currency:'USD';
  var meta = assetClassMeta(assetClassOf(t)), unit = meta.unit.toLowerCase();
  var totIn = efArr('in').reduce(function(s,f){ return s+(parseFloat(f.size)||0); }, 0);
  var totOut = efArr('out').reduce(function(s,f){ return s+(parseFloat(f.size)||0); }, 0);
  var st = totOut<=1e-6 ? 'ACTIVE' : (totOut < totIn-1e-6 ? 'PARTIAL' : 'CLOSED');
  var tmp = Object.assign({}, t, { entries: efArr('in').map(efCleanFill), exits: efArr('out').map(efCleanFill) });
  var pnl = totOut>0 ? tradeRealizedPnL(tmp) : null;
  return '<div id="ef-sum" class="cout" style="grid-template-columns:1fr 1fr 1fr;margin:12px 0 0">' +
    '<div class="oi"><div class="ol">New status</div><div class="ov">' + st + '</div></div>' +
    '<div class="oi"><div class="ol">Open ' + unit + '</div><div class="ov">' + fmtN(round(totIn-totOut,4)) + '</div></div>' +
    '<div class="oi"><div class="ol">Realized PnL</div><div class="ov ' + pnlClass(pnl) + '">' + (pnl==null?'—':moneySigned(pnl,cur)) + '</div></div>' +
  '</div>';
}
function editFillsBody() {
  return '<div id="ef-wrap">' +
    '<div class="isolation-note" style="margin-bottom:2px">Fix a wrong price or size. Reducing exits below your entry size re-opens the trade.</div>' +
    efSection('in',  efArr('in'),  'var(--green)', 'Entries (IN)', 'Add entry') +
    efSection('out', efArr('out'), 'var(--red)',   'Exits (OUT)',  'Add exit') +
    efSummaryHtml() +
  '</div>';
}
function confirmEditFills() {
  var t = TRADES.find(function(x){ return x.id===_editFills.id; }); if (!t) return;
  var entries = efArr('in').map(efCleanFill).filter(function(f){ return f.size>0 && isFinite(f.price) && f.price>0; });
  var exits   = efArr('out').map(efCleanFill).filter(function(f){ return f.size>0 && isFinite(f.price) && f.price>0; });
  if (!entries.length) { toast('Need at least one entry fill (size & price)','err'); return; }
  var totIn = entries.reduce(function(s,f){ return s+f.size; }, 0);
  var totOut = exits.reduce(function(s,f){ return s+f.size; }, 0);
  if (totOut > totIn + 1e-6) { toast('Exits exceed entries — reduce exit size','err'); return; }
  var status = totOut<=1e-6 ? 'ACTIVE' : (totOut < totIn-1e-6 ? 'PARTIAL' : 'CLOSED');
  var patch = { id:t.id, entries:entries, exits:exits, status:status, executedSize:round(totIn,6) };
  var tmp = Object.assign({}, t, { entries:entries, exits:exits });
  if (status === 'CLOSED') {
    patch.exitPrice = exits[exits.length-1].price;
    patch.exitTimestamp = t.exitTimestamp || nowIso();
    patch.realizedPnL = tradeRealizedPnL(tmp);
    patch.realizedR = (patch.realizedPnL!=null && tradePlannedRisk(tmp)) ? round(patch.realizedPnL/tradePlannedRisk(tmp),2) : null;
  } else {
    patch.exitPrice = null; patch.realizedPnL = null; patch.realizedR = null;
    if (!exits.length) patch.exitTimestamp = null;
  }
  saveTradeLog(patch, 'Edited fills · ' + entries.length + ' in / ' + exits.length + ' out · now ' + status)
    .then(function(){
      closeModal();
      toast(status==='CLOSED' ? 'Trade updated' : 'Trade re-opened → Holdings', 'ok');
      _afterMutation();
      if (_editFillsRerender) _editFillsRerender();
    }).catch(function(e){ toast('Failed: ' + e.message, 'err'); });
}

/* ── MOVE STOP ── */
function openStopModal(id) {
  var t = TRADES.find(function(x){ return x.id===id; }); if (!t) return;
  var be = round(tradeAvgEntry(t), priceDp(tradeAvgEntry(t)));
  openModal({
    title: 'Move stop · ' + escapeHtml(t.ticker),
    body:'<div class="field"><div class="fl">New Stop Loss</div><input class="fi" id="s-sl" value="' + fmtN(t.stopLossPrice) + '"></div>' +
      '<button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'s-sl\').value=' + be + '">Set to breakeven (' + be + ')</button>' +
      '<div class="isolation-note" style="margin-top:10px">Moving the stop to breakeven drops your open risk toward zero while the runner stays on.</div>',
    footer:'<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-gold" onclick="confirmStop(\'' + id + '\')">Update stop</button>'
  });
}
function confirmStop(id) {
  var sl = parseFloat(document.getElementById('s-sl').value);
  if (!isFinite(sl)) { toast('Enter a stop price','err'); return; }
  saveTradeLog({ id:id, stopLossPrice:sl }, 'Moved stop to ' + sl).then(function(){ closeModal(); toast('Stop moved','ok'); _afterMutation(); renderHoldings(); });
}

/* ── CLOSE ALL ── */
var _closeState = null;
function openCloseModal(id) {
  var t = TRADES.find(function(x){ return x.id===id; }); if (!t) return;
  _closeState = { id:id, exit: t.targetPrice!=null?t.targetPrice:tradeAvgEntry(t) };
  openModal({
    title: 'Close all · ' + escapeHtml(t.ticker) + ' (' + fmtN(tradeOpenSize(t)) + ' open)',
    body:
      '<div class="field"><div class="fl">Quick Exit</div><div style="display:flex;gap:6px;margin-top:5px">' +
        '<button class="btn btn-green btn-sm" style="flex:1" onclick="closePreset(' + t.targetPrice + ')">Hit TP</button>' +
        '<button class="btn btn-red btn-sm" style="flex:1" onclick="closePreset(' + t.stopLossPrice + ')">Hit SL</button>' +
        '<button class="btn btn-ghost btn-sm" style="flex:1" onclick="closePreset(' + tradeAvgEntry(t) + ')">Breakeven</button></div></div>' +
      '<div class="field"><div class="fl">Exit Price</div><input class="fi" id="close-exit" value="' + fmtN(_closeState.exit) + '" oninput="_closeState.exit=parseFloat(this.value);closePaint()"></div>' +
      '<div class="cout" style="grid-template-columns:1fr 1fr;margin:6px 0 0"><div class="oi"><div class="ol">Realized R (total)</div><div class="ov" id="close-r">—</div></div>' +
        '<div class="oi"><div class="ol">Realized PnL (total)</div><div class="ov" id="close-pnl">—</div></div></div>',
    footer:'<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-gold" onclick="confirmClose()">Close trade</button>',
    onMount: closePaint
  });
}
function closePreset(p){ _closeState.exit=p; var i=document.getElementById('close-exit'); if(i)i.value=fmtN(p); closePaint(); }
function closePaint() {
  var t = TRADES.find(function(x){ return x.id===_closeState.id; });
  var acc = getAccount(t.accountId), cur = acc?acc.currency:'USD';
  var exit = parseFloat(_closeState.exit);
  var rEl=document.getElementById('close-r'), pEl=document.getElementById('close-pnl');
  if (!isFinite(exit)) { if(rEl)rEl.textContent='—'; if(pEl)pEl.textContent='—'; return; }
  var exits = (t.exits&&t.exits.length?t.exits.slice():[]);
  exits.push({ size: tradeOpenSize(t), price: exit });
  var tmp = Object.assign({}, t, { exits: exits });
  var pnl = tradeRealizedPnL(tmp), risk = tradePlannedRisk(tmp);
  var r = pnl!=null && risk ? round(pnl/risk,2) : null;
  if (rEl){ rEl.textContent=rStr(r); rEl.className='ov '+pnlClass(r); }
  if (pEl){ pEl.textContent=moneySigned(pnl,cur); pEl.className='ov '+pnlClass(pnl); }
}
function confirmClose() {
  var t = TRADES.find(function(x){ return x.id===_closeState.id; });
  var exit = parseFloat(_closeState.exit);
  if (!isFinite(exit)) { toast('Enter exit price','err'); return; }
  var exits = (t.exits&&t.exits.length?t.exits.slice():[]);
  exits.push({ size: tradeOpenSize(t), price: exit, time: nowIso(), note:'close all' });
  var tmp = Object.assign({}, t, { exits: exits });
  var pnl = tradeRealizedPnL(tmp), risk = tradePlannedRisk(tmp);
  var rMult = pnl!=null&&risk?round(pnl/risk,2):null;
  saveTradeLog({ id:t.id, status:'CLOSED', exits:exits, exitPrice:exit, exitTimestamp:nowIso(),
    realizedPnL: pnl, realizedR: rMult },
    'Closed all @ ' + exit + ' · ' + rStr(rMult) + ' · PnL ' + moneySigned(pnl, (getAccount(t.accountId)||{}).currency||'USD')).then(function(){
    closeModal(); toast('Trade closed · ' + rStr(rMult), 'ok');
    HOLD_TAB='CLOSED TODAY'; _afterMutation(); renderHoldings();
  }).catch(function(e){ toast('Failed: '+e.message,'err'); });
}
