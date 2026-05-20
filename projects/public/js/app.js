window.addEventListener('load', function() {
  var loader = document.getElementById('app-loader');

  /* safety timeout — always hide loader after 6s regardless of API state */
  var loaderTimeout = setTimeout(function() {
    if (loader) loader.style.display = 'none';
  }, 6000);

  _initData().then(function() {
    clearTimeout(loaderTimeout);
    _renderSidebarFooter();
    _setLastUpdated();
    nav('p-dashboard');
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

function _setLastUpdated() {
  var el = document.getElementById('sb-last-updated');
  if (!el) return;
  var d  = new Date();
  var yy = d.getFullYear();
  var mo = String(d.getMonth() + 1).padStart(2, '0');
  var dd = String(d.getDate()).padStart(2, '0');
  var hh = String(d.getHours()).padStart(2, '0');
  var mi = String(d.getMinutes()).padStart(2, '0');
  var ss = String(d.getSeconds()).padStart(2, '0');
  el.textContent = yy + '-' + mo + '-' + dd + ' ' + hh + ':' + mi + ':' + ss;
}

function _refreshData() {
  var btn = document.getElementById('sb-refresh-btn');
  if (btn) btn.style.opacity = '0.4';
  _initData().then(function() {
    _renderSidebarFooter();
    refreshCurrentPage();
    _setLastUpdated();
    if (btn) btn.style.opacity = '1';
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
