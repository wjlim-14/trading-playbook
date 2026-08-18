var _pf = { period: 'all', acct: '', yearVal: '', monthVal: '' };

function renderPerformance() {
  var root = document.getElementById('p-perf');
  root.innerHTML = '<div class="page-content">' +
    '<div class="page-header-row page-header">' +
      '<div><div class="page-title">Performance</div><div class="page-subtitle">Pattern analysis — closed trades only</div></div>' +
      '<div class="filter-bar" style="margin:0;flex-wrap:wrap;">' +
        '<select class="filter-select" id="pf-period" onchange="_onPerfPeriodChange()">' +
          '<option value="all">Overall</option>' +
          '<option value="year">This Year</option>' +
          '<option value="month">This Month</option>' +
          '<option value="sel-year">Select Year</option>' +
          '<option value="sel-month">Select Month</option>' +
        '</select>' +
        '<input type="number" class="filter-select" id="pf-year-val" min="2020" max="2035" placeholder="2026" style="display:none;width:90px;" oninput="_renderPerfData()">' +
        '<input type="month" class="filter-select" id="pf-month-val" style="display:none;" onchange="_renderPerfData()">' +
        '<select class="filter-select" id="pf-acct" onchange="_renderPerfData()">' +
          '<option value="">All Accounts</option>' +
          ACCOUNTS.map(function(a){ return '<option value="' + a.id + '">' + a.name + '</option>'; }).join('') +
        '</select>' +
      '</div>' +
    '</div>' +
    '<div class="stats-row" id="perf-stats"></div>' +
    '<div class="grid-2">' +
      '<div class="card"><div class="card-title">By Market</div><div class="tbl-wrap"><table><thead><tr><th>Market</th><th>Trades</th><th>Wins</th><th>Win %</th><th>Avg R</th></tr></thead><tbody id="perf-mkt"></tbody></table></div></div>' +
      '<div class="card"><div class="card-title">Monthly P&amp;L</div><div class="chart-wrap"><canvas id="chart-monthly" height="190"></canvas></div></div>' +
    '</div>' +
    '<div class="grid-2">' +
      '<div class="card"><div class="card-title">R-Multiple Distribution</div><div class="chart-wrap"><canvas id="chart-rdist2" height="190"></canvas></div></div>' +
      '<div class="card"><div class="card-title">Bad Trade Patterns</div><div id="perf-patterns"></div></div>' +
    '</div>' +
    '<div class="card"><div class="card-title">Closed Trade Log</div><div class="tbl-wrap"><table>' +
      '<thead><tr><th>Date</th><th>Asset</th><th>Market</th><th>R</th><th>P&amp;L</th><th>Mood</th><th>Review</th></tr></thead>' +
      '<tbody id="perf-trades"></tbody>' +
    '</table></div></div>' +
  '</div>';

  /* restore saved filter state */
  var periodEl = document.getElementById('pf-period');
  var acctEl   = document.getElementById('pf-acct');
  var yearEl   = document.getElementById('pf-year-val');
  var monthEl  = document.getElementById('pf-month-val');
  if (periodEl) periodEl.value = _pf.period;
  if (acctEl)   acctEl.value   = _pf.acct;
  if (yearEl  && _pf.yearVal)  yearEl.value  = _pf.yearVal;
  if (monthEl && _pf.monthVal) monthEl.value = _pf.monthVal;

  _onPerfPeriodChange();
}

function _onPerfPeriodChange() {
  var period  = (document.getElementById('pf-period') || {}).value || 'all';
  var yearEl  = document.getElementById('pf-year-val');
  var monthEl = document.getElementById('pf-month-val');
  if (yearEl)  yearEl.style.display  = period === 'sel-year'  ? '' : 'none';
  if (monthEl) monthEl.style.display = period === 'sel-month' ? '' : 'none';
  _renderPerfData();
}

function _renderPerfData() {
  var period   = (document.getElementById('pf-period')    || {}).value || 'all';
  var acctId   = (document.getElementById('pf-acct')      || {}).value || '';
  var yearVal  = (document.getElementById('pf-year-val')  || {}).value || '';
  var monthVal = (document.getElementById('pf-month-val') || {}).value || '';

  _pf.period   = period;
  _pf.acct     = acctId;
  _pf.yearVal  = yearVal;
  _pf.monthVal = monthVal;

  var trades = getClosedTrades();
  if (acctId) trades = trades.filter(function(t){ return t.accountId === acctId; });

  var periodLabel = 'all time';
  if (period === 'year') {
    var yr = currentYearStr();
    trades = trades.filter(function(t){ return t.date.startsWith(yr); });
    periodLabel = 'this year';
  } else if (period === 'month') {
    var mo = currentMonthStr();
    trades = trades.filter(function(t){ return t.date.startsWith(mo); });
    periodLabel = 'this month';
  } else if (period === 'sel-year' && yearVal) {
    trades = trades.filter(function(t){ return t.date.startsWith(yearVal); });
    periodLabel = yearVal;
  } else if (period === 'sel-month' && monthVal) {
    trades = trades.filter(function(t){ return t.date.startsWith(monthVal); });
    periodLabel = monthVal;
  }

  /* stats */
  var wins   = trades.filter(function(t){ return calcPnL(t) > 0; });
  var wr     = trades.length ? (wins.length / trades.length * 100).toFixed(1) : '0.0';
  var ar     = avgR(trades);
  var dd     = maxDrawdown(trades);
  var acct   = acctId ? getAccount(acctId) : null;
  var netPnl = trades.reduce(function(s,t){ return s + (calcPnL(t)||0); }, 0);
  var cur    = acct ? acct.currency : '';

  var statsEl = document.getElementById('perf-stats');
  if (statsEl) statsEl.innerHTML =
    statCard('Win Rate', wr + '%', wins.length + 'W / ' + (trades.length - wins.length) + 'L', 'gold') +
    statCard('Avg R-Multiple', (ar >= 0 ? '+' : '') + ar + 'R', 'expectancy per trade', ar >= 0 ? 'pos' : 'neg') +
    statCard('Total Trades', trades.length, periodLabel, '') +
    (acct ? statCard('Net P&L', (netPnl >= 0 ? '+' : '') + fmt(netPnl, 0) + ' ' + cur, 'closed trades', netPnl >= 0 ? 'pos' : 'neg') : statCard('Max Drawdown', '-' + fmt(dd, 0), 'peak to trough', 'neg'));

  /* by market */
  var mkts  = ['KLCI','Crypto','US Stocks','Forex'];
  var mktEl = document.getElementById('perf-mkt');
  if (mktEl) mktEl.innerHTML = mkts.map(function(m) {
    var mt  = trades.filter(function(t){ return t.market === m; });
    var mw  = mt.filter(function(t){ return calcPnL(t) > 0; });
    var mwr = mt.length ? (mw.length / mt.length * 100).toFixed(0) : 0;
    var mar = avgR(mt);
    return '<tr>' +
      '<td>' + marketBadge(m) + '</td>' +
      '<td class="td-mono">' + mt.length + '</td>' +
      '<td class="td-mono">' + mw.length + '</td>' +
      '<td class="td-mono ' + (parseFloat(mwr) >= 50 ? 'text-pos' : 'text-neg') + '">' + mwr + '%</td>' +
      '<td class="td-mono ' + (mar >= 0 ? 'text-pos' : 'text-neg') + '">' + (mar >= 0 ? '+' : '') + mar + 'R</td>' +
    '</tr>';
  }).join('');

  /* bad patterns */
  var emotional = trades.filter(function(t){ return ['FOMO','Rushed','Impatient'].includes(t.mood); });
  var noConf    = trades.filter(function(t){ return !t.confluence1 || !t.confluence2 || !t.confluence3; });
  var earlyExit = trades.filter(function(t){ return t.review && t.review.toLowerCase().includes('early'); });
  var calmWin   = trades.filter(function(t){ return t.mood === 'Calm' && calcPnL(t) > 0; });
  var patEl     = document.getElementById('perf-patterns');
  if (patEl) patEl.innerHTML = [
    { dot:'var(--red)',    text: 'Emotional entries (FOMO/Rushed/Impatient): <strong>' + emotional.length + ' trades</strong> — review and avoid.' },
    { dot:'var(--red)',    text: 'Missing confluences: <strong>' + noConf.length + ' trades</strong> — all 3 required before entry.' },
    { dot:'var(--orange)', text: 'Early exits — left R on table: <strong>' + earlyExit.length + ' trades</strong>' },
    { dot:'var(--green)',  text: 'Calm + profitable entries: <strong>' + calmWin.length + ' trades</strong> — keep this up.' }
  ].map(function(p) {
    return '<div class="rule-item"><div class="rule-dot" style="background:' + p.dot + '"></div><div class="rule-text">' + p.text + '</div></div>';
  }).join('');

  /* trade log */
  var tlEl = document.getElementById('perf-trades');
  if (tlEl) tlEl.innerHTML = trades.length ? trades.slice().reverse().map(function(t) {
    var acctT = getAccount(t.accountId);
    return '<tr>' +
      '<td class="text-muted text-sm">' + t.date + '</td>' +
      '<td class="td-asset">' + t.asset + '</td>' +
      '<td>' + marketBadge(t.market) + '</td>' +
      '<td>' + rHtml(calcR(t)) + '</td>' +
      '<td>' + pnlHtml(calcPnL(t), acctT ? acctT.currency : '') + '</td>' +
      '<td><span class="' + moodClass(t.mood) + '">' + t.mood + '</span></td>' +
      '<td style="white-space:normal;font-size:12px;color:var(--muted);max-width:220px;">' + (t.review || '—') + '</td>' +
    '</tr>';
  }).join('') : '<tr><td colspan="7" class="empty-state">No closed trades for this filter.</td></tr>';

  /* charts */
  setTimeout(function() {
    drawMonthlyBars('chart-monthly', trades);
    drawRDist('chart-rdist2', trades);
  }, 60);
}
