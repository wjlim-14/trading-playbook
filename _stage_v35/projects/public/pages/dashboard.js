/* ============================================================
   J.TRADEBOOK V2 — DASHBOARD
   KPIs, clean trading equity curve, Entry×Exit matrix, recent.
   ============================================================ */

function renderDashboard() {
  var el = document.getElementById('p-dashboard');
  var trades = viewTrades();
  var k = kpiSet(trades);
  var heat = portfolioHeat();

  var equityBase = heat.equity || 1;
  var netPct = round(k.net / equityBase * 100, 1);
  var pf = k.profitFactor === Infinity ? '∞' : k.profitFactor;

  var kpis1 =
    kpiCard('g', 'Net P&L' + (MODE==='BACKTEST'?' (Sim)':''), moneySigned(k.net,'USD'), (k.net>=0?'+':'') + netPct + '% on equity', k.net>=0?'g':'r') +
    kpiCard('b', 'Win Rate', k.winRate + '%', k.wins + 'W / ' + k.losses + 'L — ' + k.count + ' trades', 'b') +
    kpiCard('o', 'Avg R-Multiple', rStr(k.avgR), 'Expectancy: ' + moneySigned(k.expectancy,'USD') + '/trade', 'o') +
    kpiCard('r', 'Grade C Cost', moneySigned(k.gradeCCost,'USD'), k.gradeCCount + ' rule-break trades', 'r');

  var kpis2 =
    kpiCard('o', 'Profit Factor', String(pf), 'gross win / gross loss', 'o') +
    kpiCard('g', 'Expectancy', moneySigned(k.expectancy,'USD'), 'per closed trade', k.expectancy>=0?'g':'r') +
    kpiCard('b', 'Open Positions', String(activeTrades().length), money(heat.risk,'USD') + ' open risk (' + heat.pct + '%)', 'b') +
    kpiCard('r', 'Max Drawdown', moneySigned(-k.maxDrawdown,'USD'), 'peak-to-trough', 'r');

  var series = equitySeries(trades);
  var mx = gradeMatrix(trades);
  var curCur = (ACTIVE_ACCOUNT !== 'all' && getAccount(ACTIVE_ACCOUNT)) ? getAccount(ACTIVE_ACCOUNT).currency : 'USD';
  var deposits = TRANSACTIONS.filter(function(x){
    var a = getAccount(x.accountId);
    return a && (a.env||'LIVE')===MODE && inAccount({accountId:x.accountId, mode:MODE}) &&
      (x.type==='DEPOSIT'||x.type==='PROP_PAYOUT'||x.type==='WITHDRAWAL');
  }).map(function(x){ return { date: shortDate(x.date), amount: x.amount }; });

  var recent = trades.slice().sort(function(a,b){
    var ka=(a.exitTimestamp||a.entryTimestamp||a.createdAt||''), kb=(b.exitTimestamp||b.entryTimestamp||b.createdAt||'');
    return ka<kb?1:ka>kb?-1:0;
  }).slice(0,6);

  el.innerHTML =
    (MODE==='BACKTEST' ? '<div class="mock-banner"><span style="font-size:15px">🧪</span><div><strong>Backtest Mode</strong> — these stats reflect simulated trades only.</div></div>' : '') +
    '<div class="kpi-row">' + kpis1 + '</div>' +
    '<div class="kpi-row">' + kpis2 + '</div>' +
    '<div class="g32">' +
      '<div class="card"><div class="card-h"><div class="card-t">Trading Equity Curve</div>' +
        '<div style="font-size:10px;color:var(--muted)">Trading PnL only</div></div>' +
        '<div class="card-b">' + equityCurveSVG(series, {id:'dash', currency:curCur, deposits:deposits}) +
          '<div class="eq-legend">' +
            '<div><div style="width:14px;height:2px;background:' + (k.net>=0?'var(--green)':'var(--red)') + '"></div>Cumulative trading PnL</div>' +
            '<div><div style="width:14px;height:1px;border-top:1px dashed var(--gold)"></div>Cash events excluded</div>' +
          '</div></div></div>' +
      '<div class="card"><div class="card-h"><div class="card-t">Entry × Exit Matrix</div></div>' +
        '<div class="card-b">' + matrixHtml(mx) + '</div></div>' +
    '</div>' +
    '<div class="card"><div class="card-h"><div class="card-t">Recent Trades</div>' +
      '<button class="btn btn-ghost btn-sm" onclick="nav(\'p-journal\')">View All →</button></div>' +
      '<div class="card-b"><div class="tlist">' + (recent.map(recentRow).join('') || '<div class="empty">No trades yet.</div>') + '</div></div></div>';
}

function kpiCard(accent, label, value, sub, vcls) {
  return '<div class="kpi ' + accent + '"><div class="kpi-l">' + label + '</div>' +
    '<div class="kpi-v ' + (vcls||'') + '">' + value + '</div><div class="kpi-s">' + sub + '</div></div>';
}

function matrixHtml(m) {
  return '<div class="mx">' +
    '<div></div>' +
    '<div class="mx-l" style="color:var(--green)">Good Exit</div>' +
    '<div class="mx-l" style="color:var(--red)">Bad Exit</div>' +
    '<div class="mx-l" style="writing-mode:vertical-lr;transform:rotate(180deg);color:var(--green)">Good Entry</div>' +
    '<div class="mx-c mx-aa"><div class="mc-n">Flawless</div><div class="mc-v" style="color:var(--gold)">' + m.aa + '</div><div class="mc-s">Edge</div></div>' +
    '<div class="mx-c mx-ab"><div class="mc-n">Mgmt Issue</div><div class="mc-v" style="color:var(--blue)">' + m.ab + '</div><div class="mc-s">fix exits</div></div>' +
    '<div class="mx-l" style="writing-mode:vertical-lr;transform:rotate(180deg);color:var(--red)">Bad Entry</div>' +
    '<div class="mx-c mx-ba"><div class="mc-n">Lucky Save</div><div class="mc-v" style="color:var(--amber)">' + m.ba + '</div><div class="mc-s">dangerous</div></div>' +
    '<div class="mx-c mx-bb"><div class="mc-n">Gamble</div><div class="mc-v" style="color:var(--red)">' + m.bb + '</div><div class="mc-s">avoid</div></div>' +
  '</div>';
}

function recentRow(t) {
  var acc = getAccount(t.accountId); var cur = acc?acc.currency:'USD';
  var right, mid;
  if (t.status === 'CLOSED') {
    mid = '<div class="tf"><div class="tfl">Entry→Exit</div><div class="tfv">' + t.entryPrice + '→' + t.exitPrice + '</div></div>' +
          '<div class="tf"><div class="tfl">R</div><div class="tfv ' + pnlClass(tradeR(t)) + '">' + rStr(tradeR(t)) + '</div></div>';
    right = '<div class="gpill ' + gradeClass(t.entryGrade) + '">' + (t.entryGrade||'—') + '/' + (t.exitGrade||'—') + '</div>' +
            '<div class="tpnl ' + pnlClass(tradePnL(t)) + '">' + moneySigned(tradePnL(t),cur) + '</div>';
  } else {
    mid = '<div class="tf"><div class="tfl">Entry</div><div class="tfv">' + t.entryPrice + '</div></div>' +
          '<div class="tf"><div class="tfl">Risk</div><div class="tfv text-neg">' + money(t.riskAmount,cur) + '</div></div>';
    right = gradePill('Entry', t.entryGrade) + '<div class="tpnl text-muted">Open</div>';
  }
  return '<div class="tcard"><div class="trow" style="cursor:default">' +
    '<div class="tsym">' + escapeHtml(t.ticker) + '</div>' + dirBadge(t.direction) + statusBadge(t.status) +
    '<div class="tinfo">' + mid + '</div>' +
    '<div style="margin-left:auto;display:flex;align-items:center;gap:8px">' + right + '</div>' +
  '</div></div>';
}
