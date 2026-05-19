window.addEventListener('load', function() {
  _renderSidebarFooter();
  nav('p-dashboard');
});

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
