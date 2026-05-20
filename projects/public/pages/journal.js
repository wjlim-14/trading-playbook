var _jf = { market: '', dir: '', result: '' };

function renderJournal() {
  var root = document.getElementById('p-journal');
  root.innerHTML = '<div class="page-content">' +
    '<div class="page-header-row page-header">' +
      '<div><div class="page-title">Trade Journal</div><div class="page-subtitle">Complete trade history — all accounts</div></div>' +
      '<button class="btn btn-primary" onclick="openTradeModal(null)">+ Log Trade</button>' +
    '</div>' +
    '<div class="card card-sm mb-16"><div class="filter-bar">' +
      '<select class="filter-select" id="jf-market" onchange="_applyJournalFilters()"><option value="">All Markets</option><option>KLCI</option><option>Crypto</option><option>US Stocks</option><option>Forex</option></select>' +
      '<select class="filter-select" id="jf-dir" onchange="_applyJournalFilters()"><option value="">All Directions</option><option>LONG</option><option>SHORT</option></select>' +
      '<select class="filter-select" id="jf-result" onchange="_applyJournalFilters()"><option value="">All Results</option><option value="win">Wins</option><option value="loss">Losses</option><option value="open">Open</option></select>' +
    '</div></div>' +
    '<div class="card"><div class="tbl-wrap"><table>' +
      '<thead><tr><th>Date</th><th>Asset</th><th>Market</th><th>TF</th><th>Dir</th><th>Entry</th><th>SL ⓘ</th><th>TP ⓘ</th><th>Exit</th><th>Units</th><th>P&L</th><th>R</th><th>Mood</th><th>Status</th><th></th></tr></thead>' +
      '<tbody id="journal-body"></tbody>' +
    '</table></div></div>' +
    journalModal() +
  '</div>';

  /* restore saved filter state */
  var mktEl = document.getElementById('jf-market');
  var dirEl = document.getElementById('jf-dir');
  var resEl = document.getElementById('jf-result');
  if (mktEl) mktEl.value = _jf.market;
  if (dirEl) dirEl.value = _jf.dir;
  if (resEl) resEl.value = _jf.result;

  _applyJournalFilters();
}

function _applyJournalFilters() {
  var mkt = (document.getElementById('jf-market')  || {}).value || '';
  var dir = (document.getElementById('jf-dir')     || {}).value || '';
  var res = (document.getElementById('jf-result')  || {}).value || '';
  _jf.market = mkt; _jf.dir = dir; _jf.result = res;

  var trades = JOURNAL.slice().reverse();
  if (mkt) trades = trades.filter(function(t){ return t.market === mkt; });
  if (dir) trades = trades.filter(function(t){ return t.dir === dir; });
  if (res === 'win')  trades = trades.filter(function(t){ var p=calcPnL(t); return p != null && p > 0; });
  if (res === 'loss') trades = trades.filter(function(t){ var p=calcPnL(t); return p != null && p <= 0; });
  if (res === 'open') trades = trades.filter(function(t){ return t.exit == null; });

  var body = document.getElementById('journal-body');
  if (!body) return;

  body.innerHTML = trades.length ? trades.map(function(t) {
    var pnl  = calcPnL(t);
    var r    = calcR(t);
    var acct = getAccount(t.accountId);
    return '<tr class="' + (t.exit == null ? 'row-open' : '') + '">' +
      '<td class="text-muted text-sm">' + t.date + '</td>' +
      '<td class="td-asset">' + t.asset + '</td>' +
      '<td>' + marketBadge(t.market) + '</td>' +
      '<td class="td-mono text-muted" style="font-size:11px;">' + _fmtTfs(t.timeframes) + '</td>' +
      '<td>' + dirBadge(t.dir) + '</td>' +
      '<td class="td-mono">' + fmt(t.entry, 4) + '</td>' +
      '<td class="td-ref">' + fmt(t.sl, 4) + '</td>' +
      '<td class="td-ref">' + fmt(t.tp, 4) + '</td>' +
      '<td class="td-mono">' + (t.exit != null ? fmt(t.exit, 4) : '<span class="text-muted">—</span>') + '</td>' +
      '<td class="td-mono">' + fmt(t.units, t.units < 10 ? 3 : 0) + '</td>' +
      '<td>' + pnlHtml(pnl, acct ? acct.currency : '') + '</td>' +
      '<td>' + rHtml(r) + '</td>' +
      '<td><span class="' + moodClass(t.mood) + '">' + t.mood + '</span></td>' +
      '<td>' + statusBadge(t) + '</td>' +
      '<td style="white-space:nowrap;">' +
        (t.screenshotUrl ? '<a href="' + t.screenshotUrl + '" target="_blank" title="View screenshot" style="margin-right:4px;font-size:14px;text-decoration:none;">📷</a>' : '') +
        '<button class="edit-btn" onclick="openTradeModal(' + t.id + ')" title="Edit">✏</button>' +
      '</td>' +
    '</tr>';
  }).join('') : '<tr><td colspan="15" class="empty-state">No trades match the filter</td></tr>';
}

/* ── MODAL HTML ── */
function journalModal() {
  return '<div id="modal-trade" class="modal-overlay">' +
    '<div class="modal">' +
      '<div class="modal-header">' +
        '<div class="modal-title" id="modal-trade-title">Log Trade</div>' +
        '<span class="modal-close" onclick="closeTradeModal()">✕</span>' +
      '</div>' +

      '<div class="modal-section-label">Trade Details</div>' +
      '<div class="form-grid">' +
        '<div class="form-group"><label>Date</label><input type="date" id="m-date"></div>' +
        '<div class="form-group"><label>Market</label><select id="m-market" onchange="_onModalMarketChange()"><option>KLCI</option><option>Crypto</option><option>US Stocks</option><option>Forex</option></select></div>' +
        '<div class="form-group"><label>Asset</label><input type="text" id="m-asset" placeholder="e.g. MAYBANK"></div>' +
        '<div class="form-group"><label>Direction</label><select id="m-dir"><option>LONG</option><option>SHORT</option></select></div>' +
      '</div>' +

      '<div class="modal-section-label">Timeframes <span class="text-muted" style="font-size:11px;text-transform:none;letter-spacing:0;">(select 2 or more)</span></div>' +
      '<div class="form-group" style="margin-bottom:0;">' +
        '<div class="tf-options" id="tf-options">' +
          ['15min','30min','1H','4H','Daily','Weekly','Monthly'].map(function(tf) {
            return '<button type="button" class="tf-btn" data-tf="' + tf + '" onclick="_toggleTf(this)">' + tf + '</button>';
          }).join('') +
        '</div>' +
        '<div id="tf-error" style="display:none;font-size:11px;color:var(--red);margin-top:6px;">Select at least 2 timeframes.</div>' +
      '</div>' +

      '<div class="modal-section-label">Price Levels</div>' +
      '<div class="form-grid">' +
        '<div class="form-group"><label>Entry Price</label><input type="number" id="m-entry" step="any" placeholder="0.00" oninput="_calcModalRisk()"></div>' +
        '<div class="form-group"><label>Stop Loss <span class="text-muted">(ref)</span></label><input type="number" id="m-sl" step="any" placeholder="0.00" oninput="_calcModalRisk()"></div>' +
        '<div class="form-group"><label>Take Profit <span class="text-muted">(ref)</span></label><input type="number" id="m-tp" step="any" placeholder="0.00"></div>' +
        '<div class="form-group"><label>Exit Price <span class="text-muted">(blank = still open)</span></label><input type="number" id="m-exit" step="any" placeholder="blank = open"></div>' +
      '</div>' +

      '<div class="modal-section-label">Position Size</div>' +
      '<div class="form-grid">' +
        '<div class="form-group"><label id="m-units-label">Units</label><input type="number" id="m-units" step="any" placeholder="0" oninput="_calcModalRisk()"></div>' +
        '<div class="form-group"><label>Current Price <span class="text-muted">(open trades only)</span></label><input type="number" id="m-currentPrice" step="any" placeholder="live price for unrealised P&L"></div>' +
      '</div>' +
      '<div id="modal-risk-preview" style="margin-top:-8px;margin-bottom:4px;padding:8px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);font-family:var(--font-mono);font-size:12px;color:var(--muted);"></div>' +

      '<div class="modal-section-label">Confluences <span class="text-muted" style="font-size:11px;text-transform:none;letter-spacing:0;">(all 3 required)</span></div>' +
      '<div class="form-grid" style="grid-template-columns:1fr;">' +
        '<div class="form-group"><label class="req">Confluence 1</label><input type="text" id="m-c1" placeholder="e.g. SMA26 > SMA69 on Weekly (HTF uptrend)"></div>' +
        '<div class="form-group"><label class="req">Confluence 2</label><input type="text" id="m-c2" placeholder="e.g. Daily body zone entry after SMA26 retest"></div>' +
        '<div class="form-group"><label class="req">Confluence 3</label><input type="text" id="m-c3" placeholder="e.g. Volume confirmation / sector strength"></div>' +
      '</div>' +

      '<div class="modal-section-label">Chart Screenshot <span class="text-muted" style="font-size:11px;text-transform:none;letter-spacing:0;">(optional)</span></div>' +
      '<div class="form-group" style="margin-bottom:0;">' +
        '<label class="screenshot-upload-label" id="m-screenshot-label" onclick="document.getElementById(\'m-screenshot-input\').click()" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px dashed var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--muted);font-size:13px;background:var(--surface2);">' +
          '<span style="font-size:18px;">📎</span>' +
          '<span id="m-screenshot-name">Attach chart screenshot or ⌘V to paste...</span>' +
        '</label>' +
        '<input type="file" id="m-screenshot-input" accept="image/*" style="display:none;" onchange="_onScreenshotSelected(this)">' +
        '<div id="m-screenshot-preview" style="display:none;margin-top:8px;">' +
          '<img id="m-screenshot-img" style="max-width:100%;max-height:180px;border-radius:var(--radius-sm);border:1px solid var(--border);object-fit:contain;" alt="chart">' +
          '<button type="button" class="btn btn-ghost btn-sm" style="margin-top:6px;" onclick="_clearScreenshot()">Remove</button>' +
        '</div>' +
      '</div>' +

      '<div class="modal-section-label">Review</div>' +
      '<div class="form-grid" style="grid-template-columns:1fr 1fr;">' +
        '<div class="form-group"><label>Mood at Entry</label><select id="m-mood"><option>Calm</option><option>Confident</option><option>Neutral</option><option>FOMO</option><option>Rushed</option><option>Impatient</option></select></div>' +
        '<div class="form-group form-span-all"><label>Review <span class="text-muted">(optional)</span></label><textarea id="m-review" placeholder="Did you follow the rules? What worked, what didn\'t?"></textarea></div>' +
      '</div>' +

      '<div id="modal-error" style="display:none;" class="alert alert-danger mb-0"></div>' +

      '<div class="modal-actions">' +
        '<button class="btn btn-ghost" onclick="closeTradeModal()">Cancel</button>' +
        '<button class="btn btn-danger btn-sm" id="modal-delete-btn" style="display:none;margin-right:auto;" onclick="deleteTrade()">Delete</button>' +
        '<button class="btn btn-primary" onclick="saveTrade()">Save Trade</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

var _editingTradeId = null;

function openTradeModal(id) {
  _editingTradeId = id;

  /* inject modal if not present */
  if (!document.getElementById('modal-trade')) {
    document.body.insertAdjacentHTML('beforeend', journalModal());
  }

  var overlay = document.getElementById('modal-trade');
  overlay.classList.add('open');

  var today = new Date().toISOString().split('T')[0];

  if (id) {
    var t = JOURNAL.find(function(x){ return x.id === id; });
    if (!t) return;
    document.getElementById('modal-trade-title').textContent = 'Edit Trade — ' + t.asset;
    document.getElementById('m-date').value   = t.date || today;
    document.getElementById('m-market').value = t.market;
    document.getElementById('m-asset').value  = t.asset;
    document.getElementById('m-dir').value    = t.dir;
    document.getElementById('m-entry').value  = t.entry || '';
    document.getElementById('m-sl').value     = t.sl || '';
    document.getElementById('m-tp').value     = t.tp || '';
    document.getElementById('m-exit').value   = t.exit || '';
    document.getElementById('m-units').value        = t.units || '';
    document.getElementById('m-currentPrice').value = t.currentPrice || '';
    document.getElementById('m-c1').value           = t.confluence1 || '';
    document.getElementById('m-c2').value           = t.confluence2 || '';
    document.getElementById('m-c3').value           = t.confluence3 || '';
    document.getElementById('m-mood').value         = t.mood || 'Calm';
    document.getElementById('m-review').value       = t.review || '';
    _setSelectedTfs(t.timeframes || '');
    _clearScreenshot();
    if (t.screenshotUrl) _loadScreenshotPreview(t.screenshotUrl);
    document.getElementById('modal-delete-btn').style.display = 'inline-flex';
  } else {
    document.getElementById('modal-trade-title').textContent = 'Log Trade';
    document.getElementById('m-date').value         = today;
    document.getElementById('m-market').value       = 'KLCI';
    document.getElementById('m-asset').value        = '';
    document.getElementById('m-dir').value          = 'LONG';
    document.getElementById('m-entry').value        = '';
    document.getElementById('m-sl').value           = '';
    document.getElementById('m-tp').value           = '';
    document.getElementById('m-exit').value         = '';
    document.getElementById('m-units').value        = '';
    document.getElementById('m-currentPrice').value = '';
    document.getElementById('m-c1').value           = '';
    document.getElementById('m-c2').value           = '';
    document.getElementById('m-c3').value           = '';
    document.getElementById('m-mood').value         = 'Calm';
    document.getElementById('m-review').value       = '';
    _setSelectedTfs('');
    _clearScreenshot();
    document.getElementById('modal-delete-btn').style.display = 'none';
  }

  document.getElementById('modal-error').style.display = 'none';
  _onModalMarketChange();
}

function closeTradeModal() {
  var overlay = document.getElementById('modal-trade');
  if (overlay) overlay.classList.remove('open');
  _editingTradeId = null;
}

var _TF_ABBR = { '15min':'15m','30min':'30m','1H':'1H','4H':'4H','Daily':'D','Weekly':'W','Monthly':'M' };
function _fmtTfs(tfsStr) {
  if (!tfsStr) return '<span class="text-muted">—</span>';
  return tfsStr.split(',').map(function(t) { return _TF_ABBR[t.trim()] || t; }).join('·');
}

function _toggleTf(btn) {
  btn.classList.toggle('tf-active');
  document.getElementById('tf-error').style.display = 'none';
}

function _getSelectedTfs() {
  return Array.from(document.querySelectorAll('#tf-options .tf-active'))
    .map(function(b) { return b.getAttribute('data-tf'); });
}

function _setSelectedTfs(tfsStr) {
  document.querySelectorAll('#tf-options .tf-btn').forEach(function(b) {
    b.classList.remove('tf-active');
  });
  if (!tfsStr) return;
  tfsStr.split(',').forEach(function(tf) {
    var btn = document.querySelector('#tf-options [data-tf="' + tf.trim() + '"]');
    if (btn) btn.classList.add('tf-active');
  });
}

var _screenshotDataUrl    = null;
var _screenshotExistingUrl = null;

/* compress image to JPEG below 1MB using canvas */
function _compressImage(dataUrl, callback) {
  var img = new Image();
  img.onload = function() {
    var maxW = 1920, maxH = 1080;
    var w = img.width, h = img.height;
    if (w > maxW || h > maxH) {
      var ratio = Math.min(maxW / w, maxH / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);

    var qualities = [0.8, 0.65, 0.5, 0.35];
    var result;
    for (var i = 0; i < qualities.length; i++) {
      result = canvas.toDataURL('image/jpeg', qualities[i]);
      if (result.length * 0.75 < 1024 * 1024) break;
    }
    callback(result);
  };
  img.src = dataUrl;
}

/* shared handler for both file-picker and paste */
function _processScreenshotFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    _compressImage(e.target.result, function(compressed) {
      _screenshotDataUrl = compressed;
      _screenshotExistingUrl = null;
      document.getElementById('m-screenshot-img').src = compressed;
      document.getElementById('m-screenshot-preview').style.display = 'block';
      var kb = Math.round(compressed.length * 0.75 / 1024);
      document.getElementById('m-screenshot-name').textContent = file.name + ' (' + kb + ' KB, compressed)';
    });
  };
  reader.readAsDataURL(file);
}

function _onScreenshotSelected(input) {
  var file = input.files[0];
  if (file) _processScreenshotFile(file);
}

function _clearScreenshot() {
  _screenshotDataUrl = null;
  _screenshotExistingUrl = null;
  document.getElementById('m-screenshot-input').value = '';
  document.getElementById('m-screenshot-preview').style.display = 'none';
  document.getElementById('m-screenshot-name').textContent = 'Attach chart screenshot or ⌘V to paste...';
}

function _loadScreenshotPreview(url) {
  if (!url) return;
  _screenshotExistingUrl = url;
  document.getElementById('m-screenshot-img').src = url;
  document.getElementById('m-screenshot-preview').style.display = 'block';
  document.getElementById('m-screenshot-name').textContent = 'Screenshot attached';
}

function _uploadScreenshot() {
  if (!_screenshotDataUrl) return Promise.resolve(_screenshotExistingUrl || null);
  return fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: _screenshotDataUrl, name: 'chart.jpg' })
  }).then(function(r) { return r.json(); })
    .then(function(res) { return res.url || null; })
    .catch(function(err) { console.warn('Upload failed', err); return null; });
}

/* paste listener — active whenever the trade modal is open */
document.addEventListener('paste', function(e) {
  var modal = document.getElementById('modal-trade');
  if (!modal || !modal.classList.contains('open')) return;
  var items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (var i = 0; i < items.length; i++) {
    if (items[i].type.startsWith('image/')) {
      e.preventDefault();
      _processScreenshotFile(items[i].getAsFile());
      break;
    }
  }
});

var _UNIT_LABELS = {
  'KLCI':      'Shares <span class="text-muted" style="font-size:11px;">(1 lot = 100 shares)</span>',
  'US Stocks': 'Shares',
  'Crypto':    'Coins',
  'Forex':     'Units <span class="text-muted" style="font-size:11px;">(1 std lot = 100,000)</span>'
};

function _onModalMarketChange() {
  var market = (document.getElementById('m-market') || {}).value || 'KLCI';
  var label  = document.getElementById('m-units-label');
  if (label) label.innerHTML = _UNIT_LABELS[market] || 'Units';
  _calcModalRisk();
}

function _calcModalRisk() {
  var preview = document.getElementById('modal-risk-preview');
  if (!preview) return;
  var entry  = parseFloat(document.getElementById('m-entry').value);
  var sl     = parseFloat(document.getElementById('m-sl').value);
  var units  = parseFloat(document.getElementById('m-units').value);
  var market = (document.getElementById('m-market') || {}).value || 'KLCI';
  var acct   = getAccountForMarket(market);

  if (!entry || !sl || !units) {
    preview.textContent = 'Enter entry, SL and units to preview risk';
    return;
  }
  var risk = Math.abs(entry - sl) * units;
  var pct  = acct ? (risk / acct.equity * 100).toFixed(2) : '?';
  var cur  = acct ? acct.currency : '';
  preview.innerHTML = 'Risk: <strong style="color:var(--red);margin:0 6px;">' + fmt(risk, 0) + ' ' + cur + '</strong> (' + pct + '% of account)';
}

function saveTrade() {
  var errEl = document.getElementById('modal-error');
  errEl.style.display = 'none';
  var saveBtn = document.querySelector('#modal-trade .btn-primary');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

  var asset = document.getElementById('m-asset').value.trim().toUpperCase();
  var c1    = document.getElementById('m-c1').value.trim();
  var c2    = document.getElementById('m-c2').value.trim();
  var c3    = document.getElementById('m-c3').value.trim();

  var tfs = _getSelectedTfs();
  if (!asset)         { _resetSaveBtn(); _showModalError('Asset name is required.'); return; }
  if (tfs.length < 2) { _resetSaveBtn(); document.getElementById('tf-error').style.display = 'block'; return; }
  if (!c1 || !c2 || !c3) { _resetSaveBtn(); _showModalError('All 3 confluences are required before logging a trade.'); return; }

  var entry  = parseFloat(document.getElementById('m-entry').value) || null;
  var sl     = parseFloat(document.getElementById('m-sl').value)    || null;
  var tp     = parseFloat(document.getElementById('m-tp').value)    || null;
  var exit   = parseFloat(document.getElementById('m-exit').value)  || null;
  var units  = parseFloat(document.getElementById('m-units').value) || 0;
  var market = document.getElementById('m-market').value;
  var acct   = getAccountForMarket(market);

  var mood   = document.getElementById('m-mood').value;
  var review = document.getElementById('m-review').value || null;
  var cp     = parseFloat(document.getElementById('m-currentPrice').value) || null;

  _uploadScreenshot().then(function(screenshotUrl) {
    if (_editingTradeId) {
      var idx = JOURNAL.findIndex(function(x){ return x.id === _editingTradeId; });
      if (idx !== -1) {
        JOURNAL[idx].date          = document.getElementById('m-date').value;
        JOURNAL[idx].market        = market;
        JOURNAL[idx].accountId     = acct ? acct.id : 'my';
        JOURNAL[idx].asset         = asset;
        JOURNAL[idx].dir           = document.getElementById('m-dir').value;
        JOURNAL[idx].entry         = entry;
        JOURNAL[idx].sl            = sl;
        JOURNAL[idx].tp            = tp;
        JOURNAL[idx].exit          = exit;
        JOURNAL[idx].units         = units;
        JOURNAL[idx].confluence1   = c1;
        JOURNAL[idx].confluence2   = c2;
        JOURNAL[idx].confluence3   = c3;
        JOURNAL[idx].timeframes    = tfs.join(',');
        JOURNAL[idx].mood          = mood;
        JOURNAL[idx].review        = review;
        JOURNAL[idx].currentPrice  = exit != null ? null : cp;
        if (screenshotUrl) JOURNAL[idx].screenshotUrl = screenshotUrl;
        if (_apiAvailable) _apiSyncTrade('PATCH', JOURNAL[idx]);
      }
    } else {
      var newTrade = {
        id:            nextId(),
        date:          document.getElementById('m-date').value,
        accountId:     acct ? acct.id : 'my',
        market:        market,
        asset:         asset,
        dir:           document.getElementById('m-dir').value,
        entry:         entry,
        sl:            sl,
        tp:            tp,
        exit:          exit,
        units:         units,
        currentPrice:  cp,
        confluence1:   c1,
        confluence2:   c2,
        confluence3:   c3,
        timeframes:    tfs.join(','),
        screenshotUrl: screenshotUrl,
        mood:          mood,
        review:        review
      };
      JOURNAL.push(newTrade);
      if (_apiAvailable) _apiSyncTrade('POST', newTrade);
    }

    _resetSaveBtn();
    closeTradeModal();
    refreshCurrentPage();
  });
}

function _resetSaveBtn() {
  var saveBtn = document.querySelector('#modal-trade .btn-primary');
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Trade'; }
}

function deleteTrade() {
  if (!_editingTradeId) return;
  if (!confirm('Delete this trade permanently?')) return;
  var id = _editingTradeId;
  var idx = JOURNAL.findIndex(function(x){ return x.id === id; });
  if (idx !== -1) JOURNAL.splice(idx, 1);
  if (_apiAvailable) _apiSyncTrade('DELETE', { id: id });
  closeTradeModal();
  refreshCurrentPage();
}

function _apiSyncTrade(method, trade) {
  fetch('/api/journal', {
    method:  method,
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(trade)
  }).then(function(r) {
    if (method === 'POST' && r.ok) {
      return r.json().then(function(saved) {
        var t = JOURNAL.find(function(x) { return x === trade; });
        if (t) t.id = saved.id;
      });
    }
  }).catch(function(e) { console.warn('[API] journal sync failed', e); });
}

function _showModalError(msg) {
  var el = document.getElementById('modal-error');
  el.textContent = msg;
  el.style.display = 'flex';
}
