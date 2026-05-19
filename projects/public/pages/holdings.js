function renderHoldings() {
  var holdings     = getHoldings();
  var totalUnr     = holdings.reduce(function(s,t){ return s + (calcUnrealisedPnL(t)||0); }, 0);
  var totalRiskAmt = holdings.reduce(function(s,t){ return s + calcRiskAmt(t); }, 0);

  var root = document.getElementById('p-holdings');
  root.innerHTML = '<div class="page-content">' +
    '<div class="page-header-row page-header">' +
      '<div><div class="page-title">Holdings</div><div class="page-subtitle">Open positions — live risk tracking</div></div>' +
      '<button class="btn btn-primary" onclick="openTradeModal(null)">+ Add Position</button>' +
    '</div>' +

    /* stats row */
    '<div class="stats-row">' +
      statCard('Open Positions',  holdings.length, 'active trades', 'gold') +
      statCard('Unrealised P&L',  (totalUnr >= 0 ? '+' : '') + fmt(totalUnr, 0), 'across all positions', totalUnr >= 0 ? 'pos' : 'neg') +
    '</div>' +

    /* holdings table */
    '<div class="card mb-16"><div class="card-title">Active Positions</div><div class="tbl-wrap"><table>' +
      '<thead><tr><th>Asset</th><th>Market</th><th>Dir</th><th>Entry</th><th>Current</th><th>SL</th><th>TP</th><th>Units</th><th>Risk Amt</th><th>R Live</th><th>Unrealised</th><th></th></tr></thead>' +
      '<tbody id="holdings-body"></tbody>' +
    '</table></div></div>' +

    /* risk rules section */
    '<div class="card"><div class="card-title-row"><div class="card-title" style="margin:0">Portfolio Risk</div>' +
      '<span class="text-sm text-muted">' + fmt(getTotalOpenRisk(), 2) + '% of ' + PREFS.dailyLimitPct + '% limit</span>' +
    '</div>' + _riskGaugeHtml() + '</div>' +

    '<div class="card"><div class="accordion-header" onclick="_toggleRules()" style="cursor:pointer;">' +
      '<span style="font-weight:600;font-size:13px;">Trading Rules</span>' +
      '<span class="accordion-arrow" id="rules-arrow">▼</span>' +
    '</div>' +
    '<div class="accordion-body" id="rules-body">' + _rulesHtml() + '</div></div>' +

    (typeof journalModal === 'function' ? journalModal() : '') +
  '</div>';

  /* fill holdings table */
  var tbody = document.getElementById('holdings-body');
  if (tbody) {
    tbody.innerHTML = holdings.length ? holdings.map(function(t) {
      var unr  = calcUnrealisedPnL(t);
      var rl   = calcRLive(t);
      var risk = calcRiskAmt(t);
      var acct = getAccount(t.accountId);
      var cur  = acct ? acct.currency : '';
      return '<tr>' +
        '<td class="td-asset">' + t.asset + '</td>' +
        '<td>' + marketBadge(t.market) + '</td>' +
        '<td>' + dirBadge(t.dir) + '</td>' +
        '<td class="td-mono">' + fmt(t.entry, 4) + '</td>' +
        '<td class="td-mono">' + (t.currentPrice ? fmt(t.currentPrice, 4) : '—') + '</td>' +
        '<td class="td-mono text-neg">' + fmt(t.sl, 4) + '</td>' +
        '<td class="td-mono text-pos">' + fmt(t.tp, 4) + '</td>' +
        '<td class="td-mono">' + fmt(t.units, t.units < 10 ? 3 : 0) + '</td>' +
        '<td class="td-mono text-neg">' + fmt(risk, 0) + ' ' + cur + '</td>' +
        '<td>' + rHtml(rl) + '</td>' +
        '<td class="td-mono ' + (unr >= 0 ? 'text-pos' : 'text-neg') + '">' + (unr != null ? (unr >= 0 ? '+' : '') + fmt(unr, 0) + ' ' + cur : '—') + '</td>' +
        '<td><button class="edit-btn" onclick="openTradeModal(' + t.id + ')" title="Edit">✏</button></td>' +
      '</tr>';
    }).join('') : '<tr><td colspan="12" class="empty-state">No open positions</td></tr>';
  }
}

function _riskGaugeHtml() {
  var pct    = getTotalOpenRisk();
  var limit  = PREFS.dailyLimitPct;
  var barPct = Math.min((pct / limit) * 100, 100);
  var cls    = pct <= limit * 0.5 ? 'safe' : pct <= limit * 0.8 ? 'caution' : 'danger';

  var rows = getHoldings().map(function(t) {
    var acct  = getAccount(t.accountId);
    var risk  = calcRiskAmt(t);
    var rpct  = acct ? (risk / acct.equity * 100) : 0;
    var rCls  = rpct <= 2 ? 'text-pos' : rpct <= 3 ? 'text-gold' : 'text-neg';
    return '<div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:12px;padding:5px 0;border-bottom:1px solid var(--border2);">' +
      '<span>' + t.asset + ' <span class="text-muted">' + t.market + '</span></span>' +
      '<span class="' + rCls + '">' + fmt(risk, 0) + ' ' + (acct ? acct.currency : '') + ' (' + rpct.toFixed(2) + '%)</span>' +
    '</div>';
  }).join('');

  return '<div class="risk-bar-wrap">' +
    '<div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:12px;margin-bottom:4px;">' +
      '<span class="' + (pct <= limit ? 'text-pos' : 'text-neg') + '">' + fmt(pct, 2) + '% deployed</span>' +
      '<span class="text-muted">Limit: ' + limit + '%</span>' +
    '</div>' +
    '<div class="risk-bar-track"><div class="risk-bar-fill ' + cls + '" style="width:' + barPct + '%"></div></div>' +
    '<div class="risk-bar-labels"><span>0%</span><span>' + (limit/2) + '%</span><span>' + limit + '%</span></div>' +
  '</div>' +
  (rows ? '<div class="mt-16">' + rows + '</div>' : '');
}

function _rulesHtml() {
  return RULES.map(function(r) {
    return '<div class="rule-item"><div class="rule-dot"></div><div class="rule-text">' + r.text + '</div></div>';
  }).join('');
}

function _toggleRules() {
  var body  = document.getElementById('rules-body');
  var arrow = document.getElementById('rules-arrow');
  if (!body) return;
  body.classList.toggle('open');
  if (arrow) arrow.textContent = body.classList.contains('open') ? '▲' : '▼';
}
