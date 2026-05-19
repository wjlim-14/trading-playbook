function renderSettings() {
  var root = document.getElementById('p-settings');
  root.innerHTML = '<div class="page-content">' +
    '<div class="page-header"><div class="page-title">Settings</div><div class="page-subtitle">Account management · preferences · transaction history</div></div>' +

    /* account cards */
    '<div class="card-title mb-12" style="padding:0;">Account Management</div>' +
    '<div class="grid-2 mb-16" id="settings-accounts"></div>' +

    /* preferences */
    '<div class="card mb-16">' +
      '<div class="card-title">Preferences</div>' +
      '<div class="form-grid">' +
        '<div class="form-group"><label>Default Risk % per Trade</label>' +
          '<input type="number" id="pref-risk" value="' + PREFS.defaultRiskPct + '" step="0.5" min="0.5" max="10" onchange="_savePrefs()"></div>' +
        '<div class="form-group"><label>Daily Portfolio Risk Limit %</label>' +
          '<input type="number" id="pref-limit" value="' + PREFS.dailyLimitPct + '" step="1" min="1" max="20" onchange="_savePrefs()"></div>' +
      '</div>' +
      '<div class="alert alert-info mt-16" style="margin:12px 0 0;">These values apply to the Risk Calculator and Holdings risk gauge.</div>' +
    '</div>' +

    /* transaction history */
    '<div class="card">' +
      '<div class="card-title-row"><div class="card-title" style="margin:0;">Transaction History</div>' +
        '<select class="filter-select" id="tx-filter" onchange="_renderTxTable()">' +
          '<option value="">All Accounts</option>' +
          ACCOUNTS.map(function(a){ return '<option value="' + a.id + '">' + a.name + '</option>'; }).join('') +
        '</select>' +
      '</div>' +
      '<div class="tbl-wrap"><table>' +
        '<thead><tr><th>Date</th><th>Account</th><th>Type</th><th>Amount</th><th>Balance After</th><th>Note</th></tr></thead>' +
        '<tbody id="tx-body"></tbody>' +
      '</table></div>' +
    '</div>' +

    /* deposit/withdraw modal */
    '<div id="modal-deposit" class="modal-overlay">' +
      '<div class="modal" style="max-width:440px;">' +
        '<div class="modal-header"><div class="modal-title" id="dep-title">Deposit</div><span class="modal-close" onclick="closeDepositModal()">✕</span></div>' +
        '<div class="form-grid" style="grid-template-columns:1fr;">' +
          '<div class="form-group"><label>Amount</label><input type="number" id="dep-amount" step="any" placeholder="0.00"></div>' +
          '<div class="form-group"><label>Note</label><input type="text" id="dep-note" placeholder="e.g. Monthly top-up"></div>' +
        '</div>' +
        '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeDepositModal()">Cancel</button><button class="btn btn-primary" onclick="saveTransaction()">Save</button></div>' +
      '</div>' +
    '</div>' +
  '</div>';

  _renderAccountCards();
  _renderTxTable();
}

function _renderAccountCards() {
  var el = document.getElementById('settings-accounts');
  if (!el) return;
  el.innerHTML = ACCOUNTS.map(function(a) {
    var txs       = TRANSACTIONS.filter(function(t){ return t.accountId === a.id; });
    var totalDep  = txs.filter(function(t){ return t.type==='deposit'; }).reduce(function(s,t){ return s+t.amount; }, 0);
    var totalWith = txs.filter(function(t){ return t.type==='withdrawal'; }).reduce(function(s,t){ return s+Math.abs(t.amount); }, 0);
    return '<div class="acct-settings-card">' +
      '<div class="acct-settings-header">' +
        '<div><span class="acct-settings-name">' + a.name + '</span><span class="acct-settings-cur">' + a.currency + '</span></div>' +
        '<button class="btn btn-ghost btn-sm" onclick="openDepositModal(\'' + a.id + '\',\'deposit\')">＋</button>' +
      '</div>' +
      '<div id="acct-eq-' + a.id + '">' +
        '<div class="acct-settings-eq">' + a.symbol + fmt(a.equity, 0) + '</div>' +
        '<div class="acct-settings-sub">Current equity</div>' +
      '</div>' +
      '<div class="acct-settings-sub" style="margin-top:10px;display:flex;gap:16px;">' +
        '<span>Deposited: <strong>' + fmt(totalDep, 0) + '</strong></span>' +
        '<span>Withdrawn: <strong>' + fmt(totalWith, 0) + '</strong></span>' +
      '</div>' +
      '<div class="acct-settings-actions">' +
        '<button class="btn btn-outline btn-sm" onclick="openDepositModal(\'' + a.id + '\',\'deposit\')">Deposit</button>' +
        '<button class="btn btn-outline btn-sm" onclick="openDepositModal(\'' + a.id + '\',\'withdrawal\')">Withdraw</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="_editEquity(\'' + a.id + '\')">Edit Equity</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function _renderTxTable() {
  var filter = (document.getElementById('tx-filter') || {}).value || '';
  var txs    = filter ? TRANSACTIONS.filter(function(t){ return t.accountId === filter; }) : TRANSACTIONS;
  var el     = document.getElementById('tx-body');
  if (!el) return;
  el.innerHTML = txs.length ? txs.slice().reverse().map(function(t) {
    var acct  = getAccount(t.accountId);
    var tCls  = t.type === 'deposit' ? 'tx-deposit' : 'tx-withdrawal';
    var sign  = t.type === 'deposit' ? '+' : '-';
    return '<tr>' +
      '<td class="text-muted text-sm">' + t.date + '</td>' +
      '<td>' + (acct ? acct.name : t.accountId) + '</td>' +
      '<td><span class="' + tCls + '">' + t.type.charAt(0).toUpperCase() + t.type.slice(1) + '</span></td>' +
      '<td class="td-mono ' + tCls + '">' + sign + fmt(Math.abs(t.amount), 0) + ' ' + (acct ? acct.currency : '') + '</td>' +
      '<td class="td-mono">' + fmt(t.balanceAfter, 0) + '</td>' +
      '<td class="text-muted text-sm">' + (t.note || '—') + '</td>' +
    '</tr>';
  }).join('') : '<tr><td colspan="6" class="empty-state">No transactions.</td></tr>';
}

var _depositMeta = {};

function openDepositModal(accountId, type) {
  _depositMeta = { accountId: accountId, type: type };
  var acct = getAccount(accountId);
  document.getElementById('dep-title').textContent = (type === 'deposit' ? 'Deposit' : 'Withdraw') + ' — ' + (acct ? acct.name : '');
  document.getElementById('dep-amount').value = '';
  document.getElementById('dep-note').value   = '';
  document.getElementById('modal-deposit').classList.add('open');
}

function closeDepositModal() {
  document.getElementById('modal-deposit').classList.remove('open');
}

function saveTransaction() {
  var amount  = parseFloat(document.getElementById('dep-amount').value);
  var note    = document.getElementById('dep-note').value;
  if (!amount || amount <= 0) { alert('Enter a valid amount.'); return; }

  var acct    = getAccount(_depositMeta.accountId);
  var isWith  = _depositMeta.type === 'withdrawal';
  var change  = isWith ? -amount : amount;
  if (acct) acct.equity = Math.max(0, acct.equity + change);

  var lastTx  = TRANSACTIONS.filter(function(t){ return t.accountId === _depositMeta.accountId; });
  var lastBal = lastTx.length ? lastTx[lastTx.length-1].balanceAfter : 0;

  TRANSACTIONS.push({
    id:           TRANSACTIONS.length + 1,
    date:         new Date().toISOString().split('T')[0],
    accountId:    _depositMeta.accountId,
    type:         _depositMeta.type,
    amount:       isWith ? -amount : amount,
    balanceAfter: lastBal + change,
    note:         note
  });

  closeDepositModal();
  _renderAccountCards();
  _renderTxTable();
}

function _editEquity(accountId) {
  var acct = getAccount(accountId);
  if (!acct) return;
  var val = prompt('Enter new equity for ' + acct.name + ' (' + acct.currency + '):', acct.equity);
  if (val === null) return;
  var num = parseFloat(val);
  if (isNaN(num) || num < 0) { alert('Invalid amount.'); return; }
  acct.equity = num;
  _renderAccountCards();
}

function _savePrefs() {
  var r = parseFloat((document.getElementById('pref-risk')  || {}).value);
  var l = parseFloat((document.getElementById('pref-limit') || {}).value);
  if (!isNaN(r)) PREFS.defaultRiskPct = r;
  if (!isNaN(l)) PREFS.dailyLimitPct  = l;
}
