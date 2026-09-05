/* ============================================================
   J.TRADEBOOK V2 — ROUTER
   ============================================================ */
var PAGE_IDS = ['p-dashboard','p-calculator','p-holdings','p-journal','p-mindset','p-indices','p-accounts','p-backtest','p-settings'];
var PAGE_TITLES = {
  'p-dashboard':'Dashboard', 'p-calculator':'Calculator', 'p-holdings':'Holdings',
  'p-journal':'Journal', 'p-mindset':'Mindset', 'p-indices':'Indices', 'p-accounts':'Accounts & Cash Flow', 'p-backtest':'Backtest Journal', 'p-settings':'Settings'
};
var _currentPage = 'p-dashboard';

function nav(pageId) {
  PAGE_IDS.forEach(function(id){ var el = document.getElementById(id); if (el) el.classList.remove('active'); });
  document.querySelectorAll('.nav-item, .mobile-tab').forEach(function(el){ el.classList.remove('active'); });

  var page = document.getElementById(pageId);
  if (page) page.classList.add('active');
  document.querySelectorAll('[data-page="' + pageId + '"]').forEach(function(el){ el.classList.add('active'); });

  var title = document.getElementById('page-title');
  if (title) title.textContent = PAGE_TITLES[pageId] || '';

  _currentPage = pageId;
  window.scrollTo(0, 0);
  closeSidebar();
  renderPage(pageId);
}

function renderPage(id) {
  switch (id) {
    case 'p-dashboard':  renderDashboard();  break;
    case 'p-calculator': renderCalculator(); break;
    case 'p-holdings':   renderHoldings();   break;
    case 'p-journal':    renderJournal();    break;
    case 'p-mindset':    renderMindset();    break;
    case 'p-indices':    renderIndices();    break;
    case 'p-accounts':   renderAccounts();   break;
    case 'p-backtest':   renderBacktest();   break;
    case 'p-settings':   renderSettings();   break;
  }
}

function refreshCurrentPage() { renderPage(_currentPage); }
