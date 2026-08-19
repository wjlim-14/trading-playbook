/* ============================================================
   J.TRADEBOOK V2 — APP BOOTSTRAP & GLOBAL CHROME
   ============================================================ */

window.addEventListener('load', function() {
  var loader = document.getElementById('app-loader');
  var loaderTimeout = setTimeout(function(){ if (loader) loader.style.display = 'none'; }, 8000);

  _initData().then(function() {
    clearTimeout(loaderTimeout);
    _syncModeUI();
    _renderAccountSwitcher();
    _renderSidebarHeat();
    _renderNavBadges();
    _setLastUpdated();
    _renderDemoBadge();
    nav('p-dashboard');
    if (loader) loader.style.display = 'none';
  });
});

function _renderDemoBadge() {
  var tl = document.querySelector('.topbar-l');
  if (!tl) return;
  var existing = document.getElementById('demo-badge');
  if (!DEMO_MODE) { if (existing) existing.remove(); return; }
  if (existing) return;
  var b = document.createElement('div');
  b.id = 'demo-badge';
  b.title = 'Showing sample data — connect Supabase to persist real trades';
  b.style.cssText = 'display:inline-block;background:rgba(154,124,58,.12);border:1px solid rgba(154,124,58,.35);border-radius:4px;padding:2px 8px;font-size:10px;color:var(--gold);font-weight:700;';
  b.textContent = '● DEMO';
  tl.appendChild(b);
}

/* ── MODE (LIVE / BACKTEST) ── */
function setMode(m) {
  MODE = m;
  ACTIVE_ACCOUNT = 'all';          // account sets differ between LIVE and BACKTEST
  CALC = null;                     // reset calculator to a valid account
  _syncModeUI();
  apiSavePrefs({ mode: m });
  _renderAccountSwitcher();
  _renderSidebarHeat();
  _renderNavBadges();
  refreshCurrentPage();
}
function envAccountsLive() { return ACCOUNTS.filter(function(a){ return !a.isArchived && (a.env||'LIVE')===MODE; }); }
function _syncModeUI() {
  var live = document.getElementById('btn-live');
  var bt = document.getElementById('btn-backtest');
  if (live) live.classList.toggle('active', MODE === 'LIVE');
  if (bt) { bt.classList.toggle('active', MODE === 'BACKTEST'); bt.classList.toggle('mock', MODE === 'BACKTEST'); }
  var badge = document.getElementById('mock-badge');
  if (badge) badge.style.display = MODE === 'BACKTEST' ? 'inline-block' : 'none';
}

/* ── ACCOUNT SWITCHER ── */
function _renderAccountSwitcher() {
  var sel = document.getElementById('acct-switch');
  if (!sel) return;
  var opts = '<option value="all">All Consolidated</option>';
  envAccountsLive().forEach(function(a){
    opts += '<option value="' + a.id + '"' + (a.id === ACTIVE_ACCOUNT ? ' selected' : '') + '>' +
      escapeHtml(a.name) + '</option>';
  });
  sel.innerHTML = opts;
  sel.value = ACTIVE_ACCOUNT;
  _renderSwitcherBalance();
}
function _renderSwitcherBalance() {
  var el = document.getElementById('acct-switch-bal');
  if (!el) return;
  if (ACTIVE_ACCOUNT === 'all') {
    var total = consolidatedBalanceBase();
    el.textContent = '≈ ' + money(total, baseCurrency()) + ' ' + baseCurrency();
  } else {
    var a = getAccount(ACTIVE_ACCOUNT);
    el.textContent = a ? money(accountBalance(a.id), a.currency, 2) + ' ' + a.currency : '—';
  }
}
function setActiveAccount(id) {
  ACTIVE_ACCOUNT = id;
  apiSavePrefs({ activeAccountId: id === 'all' ? null : id });
  _renderSwitcherBalance();
  _renderSidebarHeat();
  _renderNavBadges();
  refreshCurrentPage();
}

/* ── SIDEBAR HEAT + BADGES ── */
function _renderSidebarHeat() {
  var h = portfolioHeat();
  var fill = document.getElementById('sb-heat-fill');
  var val = document.getElementById('sb-heat-val');
  var pctOfLimit = h.limit ? Math.min(100, h.pct / h.limit * 100) : 0;
  if (fill) fill.style.width = pctOfLimit + '%';
  if (val) val.innerHTML = 'Open Risk: <span>' + money(h.risk,h.currency) + ' (' + h.pct + '%)</span> of ' + h.limit + '%';
  // topbar heat badge
  var tb = document.getElementById('topbar-heat-txt');
  if (tb) tb.textContent = activeTrades().length + ' Active · ' + money(h.risk,h.currency) + ' Heat';
}
function _renderNavBadges() {
  var hb = document.getElementById('badge-holdings');
  var jb = document.getElementById('badge-journal');
  var openCount = planningTrades().length + activeTrades().length;
  var pending = pendingReviews().length;
  if (hb) { hb.textContent = openCount; hb.style.display = openCount ? 'inline-block' : 'none'; }
  if (jb) { jb.textContent = pending; jb.style.display = pending ? 'inline-block' : 'none'; }
}

/* ── REFRESH ── */
function _refreshData() {
  var btn = document.getElementById('sb-refresh-btn');
  if (btn) btn.style.opacity = '0.4';
  _initData().then(function() {
    _syncModeUI();
    _renderAccountSwitcher();
    _renderSidebarHeat();
    _renderNavBadges();
    refreshCurrentPage();
    _setLastUpdated();
    if (btn) btn.style.opacity = '1';
  });
}
function _setLastUpdated() {
  var el = document.getElementById('sb-last-updated');
  if (!el) return;
  var d = new Date();
  el.textContent = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

/* Called by pages after a data mutation to keep chrome in sync. */
function _afterMutation() {
  _renderAccountSwitcher();
  _renderSidebarHeat();
  _renderNavBadges();
}

/* ── MOBILE SIDEBAR ── */
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sb-backdrop').classList.add('show');
}
function closeSidebar() {
  var sb = document.getElementById('sidebar');
  var bd = document.getElementById('sb-backdrop');
  if (sb) sb.classList.remove('open');
  if (bd) bd.classList.remove('show');
}

window.addEventListener('resize', function() {
  if (['p-dashboard','p-backtest'].indexOf(_currentPage) >= 0) refreshCurrentPage();
});
