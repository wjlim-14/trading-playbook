function renderDashboard() {
  var now     = new Date();
  var month   = now.toLocaleDateString('en-US', { month:'long', year:'numeric' });
  var monthStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');

  /* subtitle */
  var sub = document.getElementById('dash-subtitle');
  if (sub) sub.textContent = month;

  /* ── ACCOUNT CARDS ── */
  var closed = getClosedTrades();
  var html = ACCOUNTS.map(function(acct) {
    var trades  = closed.filter(function(t){ return t.accountId === acct.id; });
    var open    = getHoldings().filter(function(t){ return t.accountId === acct.id; });
    var wr      = winRate(trades);
    var ar      = avgR(trades);
    var netPnl  = trades.reduce(function(s,t){ return s + (calcPnL(t)||0); }, 0);
    var pnlCls  = netPnl >= 0 ? 'text-pos' : 'text-neg';
    var pnlSign = netPnl >= 0 ? '+' : '';

    return '<div class="acct-card">' +
      '<div class="acct-card-name">' + acct.name + '</div>' +
      '<div style="display:flex;align-items:baseline;gap:4px;">' +
        '<span class="acct-card-eq">' + acct.symbol + fmt(acct.equity, 0) + '</span>' +
        '<span class="acct-card-cur">' + acct.currency + '</span>' +
      '</div>' +
      '<div class="acct-card-sub">' +
        '<span class="' + pnlCls + '">' + pnlSign + fmt(netPnl, 0) + ' P&L</span>' +
        '<span>' + wr + '% WR</span>' +
        '<span class="' + (ar >= 0 ? 'text-pos' : 'text-neg') + '">' + (ar >= 0 ? '+' : '') + ar + 'R avg</span>' +
        (open.length ? '<span class="text-gold">' + open.length + ' open</span>' : '') +
      '</div>' +
    '</div>';
  }).join('');
  var acctEl = document.getElementById('dash-accounts');
  if (acctEl) acctEl.innerHTML = html;

  /* ── COMBINED STATS ── */
  var wins   = closed.filter(function(t){ return calcPnL(t) > 0; });
  var wr     = closed.length ? (wins.length / closed.length * 100).toFixed(1) : '0.0';
  var ar     = avgR(closed);
  var openCt = getHoldings().length;

  var statsEl = document.getElementById('dash-stats');
  if (statsEl) statsEl.innerHTML =
    statCard('Win Rate', wr + '%', closed.length + ' closed trades', 'gold') +
    statCard('Avg R-Multiple', (ar >= 0 ? '+' : '') + ar + 'R', 'expectancy per trade', ar >= 0 ? 'pos' : 'neg') +
    statCard('Total Trades', closed.length, 'across all accounts', '') +
    statCard('Open Positions', openCt, 'active right now', 'gold');

  /* ── RECENT TRADES ── */
  var recent = JOURNAL.slice().reverse().slice(0, 6);
  var tbody  = document.getElementById('dash-recent');
  if (tbody) tbody.innerHTML = recent.map(function(t) {
    var pnl = calcPnL(t);
    var r   = calcR(t);
    var acct= getAccount(t.accountId);
    return '<tr class="' + (t.exit == null ? 'row-open' : '') + '">' +
      '<td class="text-muted text-sm">' + t.date + '</td>' +
      '<td class="td-asset">' + t.asset + '</td>' +
      '<td>' + marketBadge(t.market) + '</td>' +
      '<td>' + dirBadge(t.dir) + '</td>' +
      '<td class="td-mono">' + fmt(t.entry, 4) + '</td>' +
      '<td class="td-mono">' + (t.exit != null ? fmt(t.exit, 4) : '<span class="text-muted">—</span>') + '</td>' +
      '<td>' + pnlHtml(pnl, acct ? acct.currency : '') + '</td>' +
      '<td>' + rHtml(r) + '</td>' +
    '</tr>';
  }).join('');

  /* ── HOLDINGS MINI TABLE ── */
  var holdings = getHoldings();
  var htbody   = document.getElementById('dash-holdings');
  if (htbody) htbody.innerHTML = holdings.length ? holdings.map(function(t) {
    var unr   = calcUnrealisedPnL(t);
    var rl    = calcRLive(t);
    var acct  = getAccount(t.accountId);
    var unrCls = unr >= 0 ? 'text-pos' : 'text-neg';
    return '<tr>' +
      '<td class="td-asset">' + t.asset + '</td>' +
      '<td>' + marketBadge(t.market) + '</td>' +
      '<td>' + dirBadge(t.dir) + '</td>' +
      '<td class="td-mono">' + fmt(t.entry, 4) + '</td>' +
      '<td class="td-mono">' + (t.currentPrice ? fmt(t.currentPrice, 4) : '—') + '</td>' +
      '<td class="td-mono text-neg">' + fmt(t.sl, 4) + '</td>' +
      '<td>' + rHtml(rl) + '</td>' +
      '<td class="td-mono ' + unrCls + '">' + (unr != null ? (unr >= 0 ? '+' : '') + fmt(unr, 0) : '—') + (acct ? ' ' + acct.currency : '') + '</td>' +
    '</tr>';
  }).join('') : '<tr><td colspan="8" class="empty-state" style="padding:20px 0;">No open positions</td></tr>';

  /* ── CHARTS ── */
  setTimeout(function() {
    drawPnlChart('chart-pnl');
    drawRDist('chart-rdist');
  }, 60);
}

function statCard(label, value, sub, cls) {
  return '<div class="stat-card">' +
    '<div class="stat-label">' + label + '</div>' +
    '<div class="stat-value ' + (cls||'') + '">' + value + '</div>' +
    '<div class="stat-sub">' + sub + '</div>' +
  '</div>';
}
