window.addEventListener('load', function() {
  _initData().then(function() {
    _renderSidebarFooter();
    nav('p-dashboard');
    var loader = document.getElementById('app-loader');
    if (loader) loader.style.display = 'none';
  });
});

function _initData() {
  return Promise.all([
    fetch('/api/accounts').then(function(r)     { if (!r.ok) throw new Error('accounts');     return r.json(); }),
    fetch('/api/journal').then(function(r)      { if (!r.ok) throw new Error('journal');      return r.json(); }),
    fetch('/api/transactions').then(function(r) { if (!r.ok) throw new Error('transactions'); return r.json(); }),
    fetch('/api/prefs').then(function(r)        { if (!r.ok) throw new Error('prefs');        return r.json(); })
  ]).then(function(results) {
    ACCOUNTS     = results[0];
    JOURNAL      = results[1];
    TRANSACTIONS = results[2];
    PREFS        = results[3];
    _apiAvailable = true;
  }).catch(function(e) {
    console.warn('[J.Tradebook] API unavailable — using mock data', e);
  });
}

window.addEventListener('resize', function() {
  var active = document.querySelector('.page.active');
  if (active && ['p-dashboard', 'p-perf'].includes(active.id)) {
    renderPage(active.id);
  }
});

function _renderSidebarFooter() {
  var el = document.getElementById('sb-footer');
  if (!el) return;
  el.innerHTML =
    '<div class="sidebar-footer-title">Account Equity</div>' +
    ACCOUNTS.map(function(a) {
      return '<div class="sidebar-acct">' +
        '<span class="sidebar-acct-name">' + a.name.split(' ')[0] + '</span>' +
        '<span class="sidebar-acct-eq">' + a.symbol + fmt(a.equity, 0) + '</span>' +
      '</div>';
    }).join('');
}
