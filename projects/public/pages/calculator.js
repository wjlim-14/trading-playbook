/* ============================================================
   J.TRADEBOOK V2 — CALCULATOR (Stage 1: PLAN)
   Asset-type position sizing, %/$ risk, RR auto-TP, entry grade,
   mindset, entry reasons -> Save to Plan (PLANNING trade).
   ============================================================ */

var CALC = null;
function _calcDefaults() {
  var acc = (ACTIVE_ACCOUNT !== 'all' && getAccount(ACTIVE_ACCOUNT)) ? ACTIVE_ACCOUNT
          : (activeAccounts()[0] ? activeAccounts()[0].id : null);
  return {
    accountId: acc, ticker: '', assetType: 'FOREX', direction: 'LONG',
    entry: '', sl: '', riskMode: 'pct', riskPct: PREFS.defaultRiskPct || 1.0, riskDollar: '',
    rr: 3, entryGrade: 'A', mood: 'CALIBRATED', reasons: [], setupNotes: ''
  };
}

function renderCalculator() {
  if (!CALC) CALC = _calcDefaults();
  var el = document.getElementById('p-calculator');

  if (!activeAccounts().length) {
    el.innerHTML = '<div class="card"><div class="card-b empty">No accounts yet. Create an account first in ' +
      '<a class="text-gold" style="cursor:pointer;text-decoration:underline" onclick="nav(\'p-accounts\')">Accounts</a> to size positions against its equity.</div></div>';
    return;
  }
  if (!CALC.accountId || !getAccount(CALC.accountId)) CALC.accountId = activeAccounts()[0].id;

  var acctOpts = activeAccounts().map(function(a){
    return '<option value="' + a.id + '"' + (a.id===CALC.accountId?' selected':'') + '>' +
      escapeHtml(a.name) + ' (' + money(accountBalance(a.id), a.currency, 0) + ')</option>';
  }).join('');

  var assetOpts = ASSET_TYPES.map(function(t){
    return '<option value="' + t + '"' + (t===CALC.assetType?' selected':'') + '>' + (t==='KLCI'?'KLCI (MYR)':t) + '</option>';
  }).join('');

  var riskChips = [0.5,1.0,1.5,2.0].map(function(p){
    return '<button class="chip' + (CALC.riskMode==='pct'&&CALC.riskPct===p?' active':'') + '" onclick="calcSetRP(' + p + ')">' + p.toFixed(1) + '%</button>';
  }).join('');
  var rrChips = [2,3,4,5].map(function(r){
    return '<button class="chip' + (CALC.rr===r?' active':'') + '" onclick="calcSetRR(' + r + ')">' + r + 'R</button>';
  }).join('');

  var grades = [['A','Perfect Setup'],['B','Slight Hesitation'],['C','Chased / Low Q']];
  var gradeBtns = grades.map(function(g){
    return '<button class="gbtn g' + g[0].toLowerCase() + '-s' + (CALC.entryGrade===g[0]?' sel':'') + '" onclick="calcSetGrade(\'' + g[0] + '\')">' +
      '<div class="gl">' + g[0] + '</div><div class="gd">' + g[1] + '</div></button>';
  }).join('');

  var moodBtns = MOODS.map(function(m){
    return '<button class="mood' + (CALC.mood===m.key?' active':'') + '" onclick="calcSetMood(\'' + m.key + '\')">' + m.label + '</button>';
  }).join('');

  var reasonBtns = ENTRY_REASONS.map(function(r){
    var sel = CALC.reasons.indexOf(r) >= 0;
    return '<button class="rtag' + (sel?' sel':'') + '" onclick="calcToggleReason(this,\'' + escapeHtml(r).replace(/'/g,"\\'") + '\')">' + escapeHtml(r) + (sel?' ✓':'') + '</button>';
  }).join('');

  el.innerHTML =
    (MODE==='BACKTEST' ? '<div class="mock-banner"><span style="font-size:15px">🧪</span><div><strong>Backtest Mode</strong> — this plan will be saved to the isolated Backtest journal.</div></div>' : '') +
    '<div class="calc-card">' +
      '<div class="calc-t">⚡ Position Sizing Calculator</div>' +
      '<div class="cg3">' +
        '<div class="fg"><div class="fl">Account</div><select class="fi" onchange="calcSet(\'accountId\',this.value);renderCalculator()">' + acctOpts + '</select></div>' +
        '<div class="fg"><div class="fl">Ticker</div><input class="fi" id="c-tk" value="' + escapeHtml(CALC.ticker) + '" placeholder="e.g. XAUUSD" oninput="calcSet(\'ticker\',this.value);calcPaint()"></div>' +
        '<div class="fg"><div class="fl">Asset Type</div><select class="fi" onchange="calcSet(\'assetType\',this.value);calcPaint()">' + assetOpts + '</select></div>' +
      '</div>' +
      '<div class="cg3">' +
        '<div class="fg"><div class="fl">Direction</div><div style="display:flex;gap:6px">' +
          '<button class="btn btn-' + (CALC.direction==='LONG'?'green':'ghost') + ' btn-sm" style="flex:1" onclick="calcSetDir(\'LONG\')">▲ LONG</button>' +
          '<button class="btn btn-' + (CALC.direction==='SHORT'?'red':'ghost') + ' btn-sm" style="flex:1" onclick="calcSetDir(\'SHORT\')">▼ SHORT</button></div></div>' +
        '<div class="fg"><div class="fl">Entry Price</div><input class="fi" id="c-en" value="' + (CALC.entry) + '" placeholder="0.00" oninput="calcSet(\'entry\',this.value);calcPaint()"></div>' +
        '<div class="fg"><div class="fl">Stop Loss</div><input class="fi" id="c-sl" value="' + (CALC.sl) + '" placeholder="0.00" oninput="calcSet(\'sl\',this.value);calcPaint()"></div>' +
      '</div>' +
      '<div class="fl" style="margin-bottom:6px">Risk Mode</div>' +
      '<div class="rtog">' +
        '<button class="rtbtn' + (CALC.riskMode==='pct'?' active':'') + '" onclick="calcSetRM(\'pct\')">% of Account</button>' +
        '<button class="rtbtn' + (CALC.riskMode==='dol'?' active':'') + '" onclick="calcSetRM(\'dol\')">Fixed $</button></div>' +
      (CALC.riskMode==='pct'
        ? '<div class="fl" style="margin-bottom:6px">Risk %</div><div class="chips" style="margin-bottom:12px">' + riskChips + '</div>'
        : '<div class="fg" style="max-width:220px;margin-bottom:12px"><div class="fl">Fixed Risk ($)</div><input class="fi" id="c-dol" value="' + CALC.riskDollar + '" placeholder="e.g. 125" oninput="calcSet(\'riskDollar\',this.value);calcPaint()"></div>') +
      '<div class="fl" style="margin-bottom:6px">Target R:R</div><div class="chips" style="margin-bottom:14px">' + rrChips + '</div>' +
      '<div class="cout">' +
        '<div class="oi"><div class="ol">Position Size</div><div class="ov" id="o-sz" style="color:var(--gold)">—</div><div class="os" id="o-unit">—</div></div>' +
        '<div class="oi"><div class="ol">Cash Risk</div><div class="ov" id="o-risk" style="color:var(--red)">—</div><div class="os" id="o-rp">—</div></div>' +
        '<div class="oi"><div class="ol">Potential Reward</div><div class="ov" id="o-rew" style="color:var(--green)">—</div><div class="os" id="o-tp">—</div></div>' +
        '<div class="oi"><div class="ol">R:R Ratio</div><div class="ov" id="o-rr" style="color:var(--gold)">—</div><div class="os">Planned</div></div>' +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="fl" style="margin-bottom:8px">Entry Grade</div><div class="grow" style="margin-bottom:14px">' + gradeBtns + '</div>' +
      '<div class="fl" style="margin-bottom:8px">Pre-Trade Mindset</div><div class="mrow" style="margin-bottom:12px">' + moodBtns + '</div>' +
      '<div class="fl" style="margin-bottom:6px">Entry Reasons (multi-select)</div><div class="rtags" style="margin-bottom:14px">' + reasonBtns + '</div>' +
      '<div class="rfbox" style="margin-bottom:14px"><div class="rfl">Setup Notes (optional)</div>' +
        '<textarea class="rfinp" id="c-notes" placeholder="What is the setup?" oninput="calcSet(\'setupNotes\',this.value)">' + escapeHtml(CALC.setupNotes) + '</textarea></div>' +
      '<button class="btn btn-gold btn-full" onclick="calcSaveToPlan()">💾 Save to Plan → Holdings</button>' +
    '</div>';

  calcPaint();
}

/* ── state setters ── */
function calcSet(k, v) { CALC[k] = v; }
function calcSetDir(d) { CALC.direction = d; renderCalculator(); }
function calcSetRM(m) { CALC.riskMode = m; renderCalculator(); }
function calcSetRP(p) { CALC.riskPct = p; CALC.riskMode = 'pct'; renderCalculator(); }
function calcSetRR(r) { CALC.rr = r; renderCalculator(); }
function calcSetGrade(g) { CALC.entryGrade = g; renderCalculator(); }
function calcSetMood(m) { CALC.mood = m; renderCalculator(); }
function calcToggleReason(elBtn, r) {
  var i = CALC.reasons.indexOf(r);
  if (i >= 0) CALC.reasons.splice(i,1); else CALC.reasons.push(r);
  renderCalculator();
}

/* ── computed outputs ── */
function calcCompute() {
  var entry = parseFloat(CALC.entry), sl = parseFloat(CALC.sl);
  var equity = accountEquity(CALC.accountId);
  var riskAmt;
  if (CALC.riskMode === 'pct') riskAmt = equity * (CALC.riskPct / 100);
  else riskAmt = parseFloat(CALC.riskDollar) || 0;
  var ps = computePositionSize(CALC.assetType, CALC.ticker, entry, sl, riskAmt);
  var reward = riskAmt * CALC.rr;
  var tp = (isFinite(entry) && isFinite(sl)) ? targetFromRR(entry, sl, CALC.rr, CALC.direction) : null;
  var acc = getAccount(CALC.accountId);
  return { entry:entry, sl:sl, equity:equity, riskAmt:riskAmt, ps:ps, reward:reward, tp:tp, currency: acc?acc.currency:'USD' };
}
function calcPaint() {
  var c = calcCompute();
  var set = function(id,v){ var e=document.getElementById(id); if(e) e.textContent=v; };
  set('o-sz', c.ps.size ? c.ps.size : '—');
  set('o-unit', c.ps.unit);
  set('o-risk', c.riskAmt ? money(c.riskAmt, c.currency) : '—');
  set('o-rp', CALC.riskMode==='pct' ? CALC.riskPct + '% of acct' : 'Fixed $');
  set('o-rew', c.reward ? money(c.reward, c.currency) : '—');
  set('o-tp', c.tp!=null ? 'TP: ' + c.tp : 'TP: —');
  set('o-rr', '1:' + Number(CALC.rr).toFixed(1));
}

/* ── SAVE TO PLAN ── */
function calcSaveToPlan() {
  var c = calcCompute();
  if (!CALC.ticker.trim()) { toast('Enter a ticker', 'err'); return; }
  if (!isFinite(c.entry) || !isFinite(c.sl)) { toast('Enter entry & stop loss', 'err'); return; }
  if (!c.riskAmt) { toast('Set a risk amount', 'err'); return; }
  if (c.entry === c.sl) { toast('Entry and SL cannot be equal', 'err'); return; }

  var trade = {
    accountId: CALC.accountId,
    mode: MODE,
    ticker: CALC.ticker.trim().toUpperCase(),
    direction: CALC.direction,
    assetType: CALC.assetType,
    status: 'PLANNING',
    entryPrice: c.entry,
    stopLossPrice: c.sl,
    targetPrice: c.tp,
    positionSize: c.ps.size,
    riskAmount: round(c.riskAmt, 2),
    riskPct: CALC.riskMode==='pct' ? CALC.riskPct : round(c.equity ? c.riskAmt/c.equity*100 : 0, 2),
    plannedRR: CALC.rr,
    entryGrade: CALC.entryGrade,
    preTradeMood: CALC.mood,
    entryReasonTags: CALC.reasons.slice(),
    setupNotes: CALC.setupNotes,
    entryTimestamp: nowIso()
  };

  apiCreateTrade(trade).then(function(row){
    if (!row) { toast('Save failed', 'err'); return; }
    toast('Saved to Plan → Holdings', 'ok');
    CALC = _calcDefaults();
    _afterMutation();
    nav('p-holdings');
  }).catch(function(e){ toast('Save failed: ' + e.message, 'err'); });
}
