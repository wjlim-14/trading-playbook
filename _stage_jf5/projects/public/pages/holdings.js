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
    '<div class="cpair">' +
      chartSlotHtml(t.preChartUrl4H, '4H Big TF', t.id + '|preChartUrl4H') +
      chartSlotHtml(t.preChartUrl1H, '1H Entry TF', t.id + '|preChartUrl1H') +
    '</div>';

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
  var rows = [];
  e.forEach(function(l){ rows.push(fillLine('IN', l, 'var(--green)')); });
  x.forEach(function(l){ rows.push(fillLine('OUT', l, 'var(--red)')); });
  return '<div class="rfbox" style="margin-top:8px"><div class="rfl">Fills</div>' +
    '<div style="display:flex;flex-direction:column;gap:3px;font-family:var(--mono);font-size:11px">' + rows.join('') + '</div></div>';
}
function fillLine(kind, l, color) {
  return '<div style="display:flex;gap:8px"><span style="color:' + color + ';font-weight:700;width:30px">' + kind + '</span>' +
    '<span>' + fmtN(l.size) + ' @ ' + fmtN(l.price) + '</span>' +
    (l.note ? '<span style="color:var(--muted)">· ' + escapeHtml(l.note) + '</span>' : '') + '</div>';
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

/* ── ADD TO POSITION ── */
function openAddModal(id) {
  var t = TRADES.find(function(x){ return x.id===id; }); if (!t) return;
  openModal({
    title: 'Add to ' + escapeHtml(t.ticker),
    body:
      '<div class="cg2"><div class="field"><div class="fl">Add Size (' + assetClassMeta(assetClassOf(t)).unit.toLowerCase() + ')</div><input class="fi" id="add-size" placeholder="' + fmtN(t.positionSize) + '"></div>' +
      '<div class="field"><div class="fl">Fill Price</div><input class="fi" id="add-price" value="' + fmtN(t.entryPrice) + '"></div></div>' +
      '<div class="field"><div class="fl">Note</div><input class="fi" id="add-note" placeholder="e.g. added on breakout retest"></div>' +
      '<div class="isolation-note">Averages your entry and increases open risk.</div>',
    footer:'<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-green" onclick="confirmAdd(\'' + id + '\')">Add</button>'
  });
}
function confirmAdd(id) {
  var t = TRADES.find(function(x){ return x.id===id; });
  var size = parseFloat(document.getElementById('add-size').value);
  var price = parseFloat(document.getElementById('add-price').value);
  if (!isFinite(size) || size<=0 || !isFinite(price)) { toast('Enter size & price','err'); return; }
  var entries = (t.entries&&t.entries.length?t.entries.slice():tradeEntries(t).slice());
  var addNote = document.getElementById('add-note').value.trim();
  entries.push({ size:size, price:price, time:nowIso(), note:addNote });
  saveTradeLog({ id:id, entries:entries, status:'ACTIVE' },
    'Added ' + size + ' @ ' + price + (addNote?' · '+addNote:'')).then(function(){
    closeModal(); toast('Added to position','ok'); _afterMutation(); renderHoldings();
  }).catch(function(e){ toast('Failed: '+e.message,'err'); });
}

/* ── TAKE PARTIAL ── */
var _partial = null;
function openPartialModal(id) {
  var t = TRADES.find(function(x){ return x.id===id; }); if (!t) return;
  var openSz = tradeOpenSize(t);
  _partial = { id:id, size: round(openSz/2,4), price: t.targetPrice!=null?t.targetPrice:t.entryPrice };
  openModal({
    title: 'Take profit · ' + escapeHtml(t.ticker),
    body:
      '<div class="field"><div class="fl">Portion of open (' + fmtN(openSz) + ')</div><div style="display:flex;gap:6px;margin-top:5px">' +
        [25,50,75,100].map(function(p){ return '<button class="btn btn-ghost btn-sm" style="flex:1" onclick="partialPct(' + p + ')">' + p + '%</button>'; }).join('') + '</div></div>' +
      '<div class="cg2"><div class="field"><div class="fl">Close Size</div><input class="fi" id="p-size" value="' + _partial.size + '" oninput="_partial.size=parseFloat(this.value);partialPaint()"></div>' +
      '<div class="field"><div class="fl">Exit Price</div><input class="fi" id="p-price" value="' + _partial.price + '" oninput="_partial.price=parseFloat(this.value);partialPaint()"></div></div>' +
      '<div class="field"><div class="fl">Note</div><input class="fi" id="p-note" placeholder="e.g. secured initial capital, runner on"></div>' +
      '<div class="cout" style="grid-template-columns:1fr 1fr;margin:4px 0 0"><div class="oi"><div class="ol">Booked PnL</div><div class="ov" id="p-pnl">—</div></div>' +
        '<div class="oi"><div class="ol">Remaining Open</div><div class="ov" id="p-rem">—</div></div></div>',
    footer:'<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-gold" onclick="confirmPartial()">Book it</button>',
    onMount: partialPaint
  });
}
function partialPct(p) {
  var t = TRADES.find(function(x){ return x.id===_partial.id; });
  _partial.size = round(tradeOpenSize(t) * p/100, 4);
  var i=document.getElementById('p-size'); if(i)i.value=_partial.size; partialPaint();
}
function partialPaint() {
  var t = TRADES.find(function(x){ return x.id===_partial.id; });
  var acc = getAccount(t.accountId), cur = acc?acc.currency:'USD';
  var avg = tradeAvgEntry(t), dir = dirSign(t), vpp = tradeVPP(t, _partial.price);
  var pnl = (isFinite(_partial.size)&&isFinite(_partial.price)) ? round(_partial.size*(_partial.price-avg)*dir*vpp,2) : null;
  var rem = round(tradeOpenSize(t) - (_partial.size||0), 4);
  var pe=document.getElementById('p-pnl'), re=document.getElementById('p-rem');
  if (pe){ pe.textContent = pnl==null?'—':moneySigned(pnl,cur); pe.className='ov '+pnlClass(pnl); }
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
