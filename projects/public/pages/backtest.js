/* ============================================================
   J.TRADEBOOK V2 — BACKTEST JOURNAL
   Always shows BACKTEST-mode trades (isolated from Live), with
   independent KPIs, equity curve and trade list.
   ============================================================ */

function backtestTrades() {
  return TRADES.filter(function(t){ return t.mode === 'BACKTEST' && inAccount(t); });
}

function renderBacktest() {
  var el = document.getElementById('p-backtest');
  var trades = backtestTrades();
  var k = kpiSet(trades);
  var closed = trades.filter(function(t){ return t.status==='CLOSED'; });
  var series = equitySeries(trades);
  var pf = k.profitFactor === Infinity ? '∞' : k.profitFactor;

  var rows = trades.slice().sort(function(a,b){
    var ka=(a.exitTimestamp||a.createdAt||''), kb=(b.exitTimestamp||b.createdAt||'');
    return ka<kb?1:ka>kb?-1:0;
  }).map(btRow).join('');

  el.innerHTML =
    '<div class="mock-banner"><span style="font-size:15px">🧪</span><div><strong>Backtest Journal</strong> — trades here are isolated from Live journal and statistics.</div></div>' +
    '<div class="kpi-row">' +
      kpiCard('g','Backtest PnL', moneySigned(k.net,'USD'), 'Simulated', k.net>=0?'g':'r') +
      kpiCard('b','Win Rate', k.winRate + '%', k.wins + 'W / ' + k.losses + 'L', 'b') +
      kpiCard('o','Avg R-Multiple', rStr(k.avgR), 'PF: ' + pf, 'o') +
      kpiCard('r','Max Drawdown', moneySigned(-k.maxDrawdown,'USD'), k.count + ' closed', 'r') +
    '</div>' +
    '<div class="card"><div class="card-h"><div class="card-t">Simulated Equity Curve</div></div>' +
      '<div class="card-b">' + equityCurveSVG(series, {id:'bt'}) + '</div></div>' +
    '<div class="card"><div class="card-h"><div class="card-t">Backtest Trades</div>' +
      '<button class="btn btn-gold btn-sm" onclick="addBacktestTrade()">+ Add Backtest Trade</button></div>' +
      '<div class="card-b"><div class="tlist">' + (rows || '<div class="empty">No backtest trades yet — switch to 🧪 BACKTEST mode and plan a trade.</div>') + '</div></div></div>';
}

function btRow(t) {
  var acc = getAccount(t.accountId); var cur = acc?acc.currency:'USD';
  var right, mid;
  if (t.status==='CLOSED') {
    mid = '<div class="tf"><div class="tfl">Entry→Exit</div><div class="tfv">' + t.entryPrice + '→' + t.exitPrice + '</div></div>' +
          '<div class="tf"><div class="tfl">R</div><div class="tfv ' + pnlClass(tradeR(t)) + '">' + rStr(tradeR(t)) + '</div></div>';
    right = '<div class="gpill ' + gradeClass(t.entryGrade) + '">' + (t.entryGrade||'—') + '/' + (t.exitGrade||'—') + '</div>' +
            '<div class="tpnl ' + pnlClass(tradePnL(t)) + '">' + moneySigned(tradePnL(t),cur) + '</div>';
  } else {
    mid = '<div class="tf"><div class="tfl">Entry</div><div class="tfv">' + t.entryPrice + '</div></div>' +
          '<div class="tf"><div class="tfl">Risk</div><div class="tfv text-neg">' + money(t.riskAmount,cur) + '</div></div>';
    right = statusBadge(t.status);
  }
  return '<div class="tcard"><div class="trow" style="cursor:default">' +
    '<div class="tsym">' + escapeHtml(t.ticker) + '</div>' + dirBadge(t.direction) + statusBadge(t.status) +
    '<div class="tinfo">' + mid + '</div>' +
    '<div style="margin-left:auto;display:flex;align-items:center;gap:8px">' + right + '</div>' +
  '</div></div>';
}

function addBacktestTrade() {
  if (MODE !== 'BACKTEST') setMode('BACKTEST');
  nav('p-calculator');
}
