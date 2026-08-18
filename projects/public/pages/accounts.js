/* ============================================================
   J.TRADEBOOK V2 — ACCOUNTS & CASH FLOW
   Account CRUD, deposit/withdrawal/payout/fee transactions,
   computed balance with strict cash-flow isolation.
   ============================================================ */

var ACCOUNT_TYPES = [['PERSONAL_SPOT','Personal Spot'],['MARGIN','Margin'],['PROP_FIRM','Prop Firm']];
var TX_TYPES = [['DEPOSIT','Deposit'],['WITHDRAWAL','Withdrawal'],['PROP_PAYOUT','Prop Payout'],['FEE_ADJUSTMENT','Fee Adjustment']];

function renderAccounts() {
  var el = document.getElementById('p-accounts');

  var cards = ACCOUNTS.slice().sort(function(a,b){ return (a.isArchived?1:0)-(b.isArchived?1:0); })
    .map(accountCard).join('');

  var txRows = TRANSACTIONS.slice().sort(function(a,b){ return (a.date<b.date?1:-1); })
    .slice(0,40).map(txRow).join('');

  el.innerHTML =
    '<div class="agrid">' + cards +
      '<div class="acard-add" onclick="openAccountModal()"><div style="font-size:22px;color:var(--muted)">+</div>' +
      '<div style="font-size:12px;color:var(--muted);font-weight:600">Add Account</div></div></div>' +
    '<div class="card"><div class="card-h"><div class="card-t">Cash Flow Transactions</div>' +
      '<button class="btn btn-gold btn-sm" onclick="openTxModal()">+ Transaction</button></div>' +
      '<div class="card-b"><div style="display:flex;flex-direction:column;gap:6px">' +
        (txRows || '<div class="empty">No transactions yet.</div>') + '</div>' +
        '<div class="isolation-note">⚠️ Cash transactions update balance only — <strong style="color:var(--gold)">strictly excluded</strong> from Win Rate, PnL & the trading equity curve.</div>' +
      '</div></div>';
}

function accountCard(a) {
  var bal = accountBalance(a.id);
  var tradePnL = accountRealizedPnL(a.id,'LIVE');
  var deposits = TRANSACTIONS.filter(function(t){return t.accountId===a.id && (t.type==='DEPOSIT'||t.type==='PROP_PAYOUT');}).reduce(function(s,t){return s+t.amount;},0);
  var withdrawals = TRANSACTIONS.filter(function(t){return t.accountId===a.id && t.type==='WITHDRAWAL';}).reduce(function(s,t){return s+t.amount;},0);
  var fees = TRANSACTIONS.filter(function(t){return t.accountId===a.id;}).reduce(function(s,t){return s+(t.fee||0)+(t.type==='FEE_ADJUSTMENT'?t.amount:0);},0);

  return '<div class="acard' + (a.isArchived?' archived':'') + '">' +
    '<div style="display:flex;justify-content:space-between;gap:8px">' +
      '<div><div class="acard-name">' + escapeHtml(a.name) + '</div>' +
        '<div class="acard-meta">' + prettyType(a.accountType) + ' · ' + escapeHtml(a.currency) + (a.broker?' · '+escapeHtml(a.broker):'') + '</div></div>' +
      '<div style="width:8px;height:8px;border-radius:50%;background:' + (a.isArchived?'var(--muted)':'var(--green)') + ';margin-top:4px"></div>' +
    '</div>' +
    '<div class="acard-bal">' + money(bal, a.currency, 2) + '</div>' +
    '<div class="acard-break">Starting: ' + money(a.initialBalance,a.currency,0) +
      ' · Trade PnL: ' + moneySigned(tradePnL,a.currency) + '<br>' +
      'Deposits: ' + moneySigned(deposits,a.currency) + ' · Withdrawals: ' + moneySigned(-withdrawals,a.currency) +
      (fees?' · Fees: ' + moneySigned(-fees,a.currency):'') + '</div>' +
    '<div class="divider" style="margin:8px 0"></div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
      '<button class="btn btn-green btn-sm" onclick="openTxModal(\'' + a.id + '\',\'DEPOSIT\')">+ Deposit</button>' +
      '<button class="btn btn-red btn-sm" onclick="openTxModal(\'' + a.id + '\',\'WITHDRAWAL\')">- Withdraw</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="openAccountModal(\'' + a.id + '\')">Edit</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="toggleArchive(\'' + a.id + '\')">' + (a.isArchived?'Unarchive':'Archive') + '</button>' +
    '</div></div>';
}

function prettyType(t){ var m={PERSONAL_SPOT:'Personal Spot',MARGIN:'Margin',PROP_FIRM:'Prop Firm'}; return m[t]||t; }

function txRow(t) {
  var a = getAccount(t.accountId);
  var cur = a?a.currency:'USD';
  var pos = (t.type==='DEPOSIT'||t.type==='PROP_PAYOUT');
  var typeColors = { DEPOSIT:['var(--green-bg)','var(--green)','var(--green-bd)'], PROP_PAYOUT:['var(--green-bg)','var(--green)','var(--green-bd)'],
    WITHDRAWAL:['var(--red-bg)','var(--red)','var(--red-bd)'], FEE_ADJUSTMENT:['var(--red-bg)','var(--red)','var(--red-bd)'] };
  var c = typeColors[t.type] || typeColors.WITHDRAWAL;
  return '<div class="tx-row">' +
    '<div class="tx-date">' + shortDate(t.date) + '</div>' +
    '<div class="tx-type" style="background:' + c[0] + ';color:' + c[1] + ';border:1px solid ' + c[2] + '">' + t.type + '</div>' +
    '<div style="font-size:11px;color:var(--text2);flex:1">' + escapeHtml(a?a.name:'—') + (t.notes?' · '+escapeHtml(t.notes):'') + (t.fee?' · fee '+money(t.fee,cur):'') + '</div>' +
    '<div class="tx-amt ' + (pos?'text-pos':'text-neg') + '">' + moneySigned(pos?t.amount:-t.amount,cur) + '</div>' +
    '<button class="modal-x" style="font-size:16px" onclick="delTx(\'' + t.id + '\')" title="Delete">&times;</button>' +
  '</div>';
}

/* ── ACCOUNT MODAL ── */
function openAccountModal(id) {
  var a = id ? getAccount(id) : null;
  var typeOpts = ACCOUNT_TYPES.map(function(t){ return '<option value="'+t[0]+'"'+(a&&a.accountType===t[0]?' selected':'')+'>'+t[1]+'</option>'; }).join('');
  openModal({
    title: a ? 'Edit Account' : 'New Account',
    body:
      '<div class="field"><div class="fl">Name</div><input class="fi" id="a-name" value="' + (a?escapeHtml(a.name):'') + '" placeholder="Main"></div>' +
      '<div class="field"><div class="fl">Broker / Exchange</div><input class="fi" id="a-broker" value="' + (a?escapeHtml(a.broker):'') + '" placeholder="Moomoo SG"></div>' +
      '<div class="cg2"><div class="field"><div class="fl">Type</div><select class="fi" id="a-type">' + typeOpts + '</select></div>' +
      '<div class="field"><div class="fl">Currency</div><input class="fi" id="a-cur" value="' + (a?escapeHtml(a.currency):'USD') + '" placeholder="USD"></div></div>' +
      '<div class="field"><div class="fl">Starting Balance</div><input class="fi" id="a-init" value="' + (a?a.initialBalance:'') + '" placeholder="10000"' + (a?' ':'') + '></div>',
    footer: '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>' +
            '<button class="btn btn-gold" onclick="saveAccount(' + (a?'\''+a.id+'\'':'null') + ')">Save</button>'
  });
}
function saveAccount(id) {
  var name = document.getElementById('a-name').value.trim();
  if (!name) { toast('Name required','err'); return; }
  var init = parseFloat(document.getElementById('a-init').value) || 0;
  var payload = {
    name: name,
    broker: document.getElementById('a-broker').value.trim(),
    accountType: document.getElementById('a-type').value,
    currency: document.getElementById('a-cur').value.trim().toUpperCase() || 'USD',
    initialBalance: init
  };
  var p;
  if (id) { payload.id = id; p = apiUpdateAccount(payload); }
  else { payload.currentBalance = init; p = apiCreateAccount(payload); }
  p.then(function(){ closeModal(); toast('Account saved','ok'); _afterMutation(); renderAccounts(); })
   .catch(function(e){ toast('Failed: '+e.message,'err'); });
}
function toggleArchive(id) {
  var a = getAccount(id);
  apiUpdateAccount({ id:id, isArchived: !a.isArchived }).then(function(){
    toast(a.isArchived?'Unarchived':'Archived','ok'); _afterMutation(); renderAccounts();
  });
}

/* ── TRANSACTION MODAL ── */
function openTxModal(accountId, type) {
  if (!activeAccounts().length) { toast('Create an account first','err'); return; }
  var acctOpts = activeAccounts().map(function(a){ return '<option value="'+a.id+'"'+(accountId===a.id?' selected':'')+'>'+escapeHtml(a.name)+'</option>'; }).join('');
  var typeOpts = TX_TYPES.map(function(t){ return '<option value="'+t[0]+'"'+(type===t[0]?' selected':'')+'>'+t[1]+'</option>'; }).join('');
  openModal({
    title: 'New Transaction',
    body:
      '<div class="cg2"><div class="field"><div class="fl">Date</div><input class="fi" type="date" id="t-date" value="' + todayStr() + '"></div>' +
      '<div class="field"><div class="fl">Account</div><select class="fi" id="t-acct">' + acctOpts + '</select></div></div>' +
      '<div class="cg2"><div class="field"><div class="fl">Type</div><select class="fi" id="t-type">' + typeOpts + '</select></div>' +
      '<div class="field"><div class="fl">Amount</div><input class="fi" id="t-amt" placeholder="1000"></div></div>' +
      '<div class="cg2"><div class="field"><div class="fl">Transaction Fee</div><input class="fi" id="t-fee" placeholder="0"></div>' +
      '<div class="field"><div class="fl">Notes</div><input class="fi" id="t-notes" placeholder="optional"></div></div>' +
      '<div class="isolation-note">Balance updates only — never touches trading stats.</div>',
    footer: '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>' +
            '<button class="btn btn-gold" onclick="saveTx()">Save</button>'
  });
}
function saveTx() {
  var amt = parseFloat(document.getElementById('t-amt').value);
  if (!isFinite(amt) || amt <= 0) { toast('Enter an amount','err'); return; }
  var payload = {
    accountId: document.getElementById('t-acct').value,
    type: document.getElementById('t-type').value,
    amount: amt,
    fee: parseFloat(document.getElementById('t-fee').value) || 0,
    date: document.getElementById('t-date').value || todayStr(),
    notes: document.getElementById('t-notes').value.trim()
  };
  apiCreateTransaction(payload).then(function(){ closeModal(); toast('Transaction added','ok'); _afterMutation(); renderAccounts(); })
    .catch(function(e){ toast('Failed: '+e.message,'err'); });
}
function delTx(id) {
  apiDeleteTransaction(id).then(function(){ toast('Removed','ok'); _afterMutation(); renderAccounts(); });
}
