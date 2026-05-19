var PAGE_IDS = ['p-dashboard','p-journal','p-holdings','p-calculator','p-market','p-perf','p-settings'];
var _currentPage = 'p-dashboard';

function nav(pageId) {
  /* hide all pages */
  PAGE_IDS.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });

  /* deactivate all nav items */
  document.querySelectorAll('.nav-item').forEach(function(el) {
    el.classList.remove('active');
  });
  document.querySelectorAll('.mobile-tab').forEach(function(el) {
    el.classList.remove('active');
  });

  /* activate target page */
  var page = document.getElementById(pageId);
  if (page) page.classList.add('active');

  /* activate nav items with matching data-page */
  document.querySelectorAll('[data-page="' + pageId + '"]').forEach(function(el) {
    el.classList.add('active');
  });

  _currentPage = pageId;
  window.scrollTo(0, 0);

  /* render the page */
  renderPage(pageId);
}

function renderPage(id) {
  switch (id) {
    case 'p-dashboard':  renderDashboard();   break;
    case 'p-journal':    renderJournal();     break;
    case 'p-holdings':   renderHoldings();    break;
    case 'p-calculator': renderCalculator();  break;
    case 'p-market':     renderSentiment();   break;
    case 'p-perf':       renderPerformance(); break;
    case 'p-settings':   renderSettings();    break;
  }
}

function refreshCurrentPage() {
  renderPage(_currentPage);
}
