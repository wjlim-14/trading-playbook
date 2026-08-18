/* ============================================================
   J.TRADEBOOK V2 — HOLDINGS (Stage 2 EXECUTE, Stage 3 EXIT)
   Portfolio heat, PLANNING/ACTIVE/CLOSED TODAY tabs, expandable
   rows, chart paste, Mark as Executed, Close Trade modal.
   ============================================================ */

var HOLD_TAB = 'ACTIVE';
var _expanded = {};

function renderHoldings() {
  var el = document.getElementById('p-holdings');
  var heat = portfolioHeat();
  var over = heat.pct > heat.limit;

  var planning = planningTrades();
  var active = activeTrades();
  var closedToday = closedTodayTrades();
  var counts = { PLANNING: planning.length, ACTIVE: active.length, 'CLOSED TODAY': closedToday.length };
  var lists = { PLANNING: planning, ACTIVE: active, 'CLOSED TODAY': closedToday };

  var dups = duplicateExposure();
  var dupHtml = dups.length
    ? '<div class="warn-banner">⚠️ Duplicate exposure — multiple open positions on: <strong>' + dups.join(', ') + '</strong></div>'
    : '';

  var tabs = ['PLANNING','ACTIVE','CLOSED TODAY'].map(function(t){
    return '<button class="stab' + (HOLD_TAB===t?' active':'') + '" onclick="setHoldTab(\'' + t + '\')">' + t + ' (' + counts[t] + ')</button>';
  }).join('');

  var rows = lists[HOLD_TAB].map(holdingRow).join('');
  if (!rows) rows = '<div class="empty">No ' + HOLD_TAB.toLowerCase() + ' trades' + (MODE==='BACKTEST'?' (Backtest)':'') + '.</div>';

  el.innerHTML =
    (MODE==='BACKTEST' ? '<div class="mock-banner"><span style="font-size:15px">🧪</span><div><strong>Backtest Mode</strong> — showing simulated positions.</div></div>' : '') +
    '<div class="heat-banner' + (over?' over':'') + '">' +
      '<div style="display:flex;align-items:center;gap:8px"><div class="dot"></div><span style="font-weight:500">Portfolio Heat</span>' +
        '<span style="font-family:var(--mono);font-weight:700;color:' + (over?'var(--red)':'var(--amber)') + '">' + money(heat.risk,'USD') + ' (' + heat.pct + '%) open risk</span></div>' +
      '<span style="font-size:10px;color:var(--muted)">Limit: ' + heat.limit + '%</span>' +
    '</div>' +
    dupHtml +
    '<div class="stabs">' + tabs + '</div>' +
    '<div class="tlist">' + rows + '</div>';

  wireTradeSlots(el, function(){ _afterMutation(); renderHoldings(); });
}

function setHoldTab(t) { HOLD_TAB = t; renderHoldings(); }
function toggleExpand(id) { _expanded[id] = !_expanded[id]; renderHoldings(); }

function holdingRow(t) {
  var acc = getAccount(t.accountId);
  var cur = acc ? acc.currency : 'USD';
  var open = !!_expanded[t.id];
  var isClosed = t.status === 'CLOSED';

  var infoFields;
  if (isClosed) {
    var pnl = tradePnL(t);
    infoFields =
      '<div class="tf"><div class="tfl">Entry→Exit</div><div class="tfv">' + t.entryPrice + '→' + t.exitPrice + '</div></div>' +
      '<div class="tf"><div class="tfl">R</div><div class="tfv ' + pnlClass(tradeR(t)) + '">' + rStr(tradeR(t)) + '</div></div>';
  } else {
    infoFields =
      '<div class="tf"><div class="tfl">Entry</div><div class="tfv">' + t.entryPrice + '</div></div>' +
      '<div class="tf"><div class="tfl">SL</div><div class="tfv">' + t.stopLossPrice + '</div></div>' +
      '<div class="tf"><div class="tfl">TP</div><div class="tfv">' + (t.targetPrice!=null?t.targetPrice:'—') + '</div></div>' +
      '<div class="tf"><div class="tfl">Risk</div><div class="tfv text-neg">' + money(t.riskAmount,cur) + '</div></div>';
  }

  var actionBtn = '';
  if (t.status === 'PLANNING')
    actionBtn = '<button class="btn btn-green btn-sm" onclick="event.stopPropagation();markExecuted(\'' + t.id + '\')">✓ Executed</button>';
  else if (t.status === 'ACTIVE')
    actionBtn = '<button class="btn btn-red btn-sm" onclick="event.stopPropagation();openCloseModal(\'' + t.id + '\')">Close</button>';

  var right = isClosed
    ? '<div class="tpnl ' + pnlClass(tradePnL(t)) + '">' + moneySigned(tradePnL(t),cur) + '</div>'
    : gradePill('Entry', t.entryGrade);

  return '<div class="tcard">' +
    '<div class="trow" onclick="toggleExpand(\'' + t.id + '\')">' +
      '<div class="tsym">' + escapeHtml(t.ticker) + '</div>' + dirBadge(t.direction) + statusBadge(t.status) +
      '<div class="tinfo">' + infoFields + '</div>' +
      '<div style="margin-left:auto;display:flex;align-items:center;gap:8px">' + right + actionBtn + '</div>' +
    '</div>' +
    '<div class="tdetail' + (open?' show':'') + '" id="det-' + t.id + '">' + (open ? holdingDetail(t) : '') + '</div>' +
  '</div>';
}

function holdingDetail(t) {
  var reasons = (t.entryReasonTags||[]).map(function(r){ return '<span class="ptag sel">' + escapeHtml(r) + '</span>'; }).join('');
  var charts =
    '<div class="cpair">' +
      chartSlotHtml(t.preChartUrl4H, '4H Big TF', t.id + '|preChartUrl4H') +
      chartSlotHtml(t.preChartUrl1H, '1H Entry TF', t.id + '|preChartUrl1H') +
    '</div>';
  var extra = '';
  if (t.status === 'PLANNING')
    extra = '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-green btn-full" onclick="markExecuted(\'' + t.id + '\')">✓ Mark as Executed</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="deleteTrade(\'' + t.id + '\')">Delete</button></div>';
  else if (t.status === 'ACTIVE')
    extra = '<button class="btn btn-red btn-full" style="margin-top:10px" onclick="openCloseModal(\'' + t.id + '\')">Close Trade</button>';

  return charts +
    (reasons ? '<div class="ptags">' + reasons + '</div>' : '') +
    '<div class="rfbox"><div class="rfl">Setup Notes</div>' +
      '<textarea class="rfinp" onblur="saveSetupNotes(\'' + t.id + '\',this.value)" placeholder="Setup notes…">' + escapeHtml(t.setupNotes||'') + '</textarea></div>' +
    extra;
}

/* ── ACTIONS ── */
function markExecuted(id) {
  apiUpdateTrade({ id:id, status:'ACTIVE', entryTimestamp: nowIso() }).then(function(){
    toast('Marked ACTIVE', 'ok'); HOLD_TAB = 'ACTIVE'; _afterMutation(); renderHoldings();
  }).catch(function(e){ toast('Failed: ' + e.message, 'err'); });
}

function saveSetupNotes(id, val) {
  var t = TRADES.find(function(x){ return x.id===id; });
  if (t && t.setupNotes === val) return;
  apiUpdateTrade({ id:id, setupNotes: val });
}

function deleteTrade(id) {
  openModal({
    title: 'Delete trade?',
    body: '<p style="font-size:13px;color:var(--text2)">This permanently removes the planned trade.</p>',
    footer: '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>' +
            '<button class="btn btn-red" onclick="confirmDeleteTrade(\'' + id + '\')">Delete</button>'
  });
}
function confirmDeleteTrade(id) {
  apiDeleteTrade(id).then(function(){ closeModal(); toast('Deleted','ok'); _afterMutation(); renderHoldings(); });
}

/* ── CLOSE TRADE MODAL ── */
var _closeState = null;
function openCloseModal(id) {
  var t = TRADES.find(function(x){ return x.id===id; });
  if (!t) return;
  _closeState = { id:id, exit: t.targetPrice != null ? t.targetPrice : t.entryPrice, preset:'TP' };
  var acc = getAccount(t.accountId);
  openModal({
    title: 'Close Trade · ' + escapeHtml(t.ticker),
    body:
      '<div class="field"><div class="fl">Quick Exit</div><div style="display:flex;gap:6px;margin-top:5px">' +
        '<button class="btn btn-green btn-sm" style="flex:1" id="cp-TP" onclick="closePreset(\'TP\',' + t.targetPrice + ')">Hit TP</button>' +
        '<button class="btn btn-red btn-sm" style="flex:1" id="cp-SL" onclick="closePreset(\'SL\',' + t.stopLossPrice + ')">Hit SL</button>' +
        '<button class="btn btn-ghost btn-sm" style="flex:1" id="cp-BE" onclick="closePreset(\'BE\',' + t.entryPrice + ')">Breakeven</button>' +
      '</div></div>' +
      '<div class="field"><div class="fl">Exit Price</div><input class="fi" id="close-exit" value="' + _closeState.exit + '" oninput="closeCustom(this.value)"></div>' +
      '<div class="cout" style="grid-template-columns:1fr 1fr;margin:6px 0 0">' +
        '<div class="oi"><div class="ol">Realized R</div><div class="ov" id="close-r">—</div></div>' +
        '<div class="oi"><div class="ol">Realized PnL</div><div class="ov" id="close-pnl">—</div></div>' +
      '</div>',
    footer: '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>' +
            '<button class="btn btn-gold" onclick="confirmClose()">Close Trade</button>',
    onMount: function(){ closePaint(); }
  });
}
function closePreset(p, price) { _closeState.preset = p; _closeState.exit = price; var i=document.getElementById('close-exit'); if(i)i.value=price; closePaint(); }
function closeCustom(v) { _closeState.exit = parseFloat(v); _closeState.preset='CUSTOM'; closePaint(); }
function closePaint() {
  var t = TRADES.find(function(x){ return x.id===_closeState.id; });
  var acc = getAccount(t.accountId); var cur = acc?acc.currency:'USD';
  var exit = parseFloat(_closeState.exit);
  var rEl = document.getElementById('close-r'), pEl = document.getElementById('close-pnl');
  if (!isFinite(exit)) { if(rEl)rEl.textContent='—'; if(pEl)pEl.textContent='—'; return; }
  var dir = t.direction==='SHORT'?-1:1;
  var riskDist = Math.abs(t.entryPrice - t.stopLossPrice);
  var r = riskDist ? round(dir*(exit-t.entryPrice)/riskDist, 2) : 0;
  var pnl = round(r * (t.riskAmount||0), 2);
  if (rEl) { rEl.textContent = rStr(r); rEl.className = 'ov ' + pnlClass(r); }
  if (pEl) { pEl.textContent = moneySigned(pnl,cur); pEl.className = 'ov ' + pnlClass(pnl); }
}
function confirmClose() {
  var t = TRADES.find(function(x){ return x.id===_closeState.id; });
  var exit = parseFloat(_closeState.exit);
  if (!isFinite(exit)) { toast('Enter an exit price','err'); return; }
  var dir = t.direction==='SHORT'?-1:1;
  var riskDist = Math.abs(t.entryPrice - t.stopLossPrice);
  var r = riskDist ? round(dir*(exit-t.entryPrice)/riskDist, 2) : 0;
  var pnl = round(r * (t.riskAmount||0), 2);
  apiUpdateTrade({
    id: t.id, status:'CLOSED', exitPrice: exit, exitTimestamp: nowIso(),
    realizedR: r, realizedPnL: pnl
  }).then(function(){
    closeModal(); toast('Trade closed · ' + rStr(r), 'ok');
    HOLD_TAB = 'CLOSED TODAY'; _afterMutation(); renderHoldings();
  }).catch(function(e){ toast('Failed: ' + e.message, 'err'); });
}
