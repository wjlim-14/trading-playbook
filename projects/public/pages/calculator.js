function renderCalculator() {
  var root = document.getElementById('p-calculator');
  root.innerHTML = '<div class="page-content">' +
    '<div class="page-header"><div class="page-title">Risk Calculator</div><div class="page-subtitle">Eliminate all manual math before entering a trade</div></div>' +

    '<div class="card">' +
      '<div class="card-title">Market & Account</div>' +
      '<div class="form-grid">' +
        '<div class="form-group"><label>Market</label>' +
          '<select id="calc-market" onchange="_calcMarketChanged()">' +
            '<option value="KLCI">KLCI (Malaysia)</option>' +
            '<option value="US Stocks">US Stocks</option>' +
            '<option value="Crypto Spot">Crypto — Spot</option>' +
            '<option value="Crypto Lev">Crypto — Leveraged</option>' +
            '<option value="Forex Pair">Forex — Major Pair</option>' +
            '<option value="Forex Gold">Forex — Gold (XAUUSD)</option>' +
            '<option value="Forex Silver">Forex — Silver (XAGUSD)</option>' +
            '<option value="Forex Indices">Forex — US Indices</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-group"><label>Account Equity</label>' +
          '<div style="display:flex;gap:6px;align-items:center;">' +
            '<input type="number" id="calc-equity" oninput="calcUpdate()">' +
            '<span id="calc-currency" class="text-muted mono" style="white-space:nowrap;font-size:12px;min-width:36px;">MYR</span>' +
          '</div>' +
        '</div>' +
        '<div class="form-group"><label>Risk %</label>' +
          '<input type="number" id="calc-risk" value="2" step="0.5" min="0.5" max="10" oninput="calcUpdate()">' +
        '</div>' +
        '<div id="calc-extra-field" class="form-group" style="display:none;"></div>' +
      '</div>' +
    '</div>' +

    '<div class="card">' +
      '<div class="card-title">Price Levels</div>' +
      '<div class="form-grid">' +
        '<div class="form-group"><label>Entry Price</label><input type="number" id="calc-entry" step="any" placeholder="0.00" oninput="calcUpdate()"></div>' +
        '<div class="form-group"><label>Stop Loss</label><input type="number" id="calc-sl" step="any" placeholder="0.00" oninput="calcUpdate()"></div>' +
        '<div class="form-group"><label>Take Profit</label><input type="number" id="calc-tp" step="any" placeholder="0.00" oninput="calcUpdate()"></div>' +
      '</div>' +
      '<div id="calc-sl-hint" class="form-hint" style="margin-top:4px;"></div>' +
    '</div>' +

    '<div id="calc-result-box" class="calc-result" style="display:none;">' +
      '<div style="font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:16px;">Results</div>' +
      '<div class="calc-result-grid">' +
        '<div><div class="calc-item-label" id="res-size-label">Position Size</div><div class="calc-item-value highlight" id="res-size">—</div><div class="calc-item-sub" id="res-size-sub"></div></div>' +
        '<div><div class="calc-item-label">Risk Amount</div><div class="calc-item-value" id="res-risk">—</div><div class="calc-item-sub" id="res-risk-sub"></div></div>' +
        '<div><div class="calc-item-label">R:R Ratio</div><div class="calc-item-value" id="res-rr">—</div><div class="calc-item-sub" id="res-rr-sub"></div></div>' +
        '<div><div class="calc-item-label">Potential Profit</div><div class="calc-item-value" id="res-profit">—</div><div class="calc-item-sub" id="res-profit-sub">if TP hit</div></div>' +
        '<div id="res-extra-wrap" style="display:none;"><div class="calc-item-label" id="res-extra-label"></div><div class="calc-item-value" id="res-extra">—</div><div class="calc-item-sub" id="res-extra-sub"></div></div>' +
      '</div>' +
      '<div id="calc-alerts" style="margin-top:16px;display:flex;flex-direction:column;gap:8px;"></div>' +
    '</div>' +

    '<div class="card mt-16"><div class="card-title">Open Risk Context</div><div id="calc-open-risk"></div></div>' +
  '</div>';

  _calcMarketChanged();
  _renderOpenRisk();
}

function _calcMarketChanged() {
  var market  = (document.getElementById('calc-market') || {}).value || 'KLCI';
  var acct    = _calcAccount(market);
  var eqEl    = document.getElementById('calc-equity');
  var curEl   = document.getElementById('calc-currency');
  var extra   = document.getElementById('calc-extra-field');
  var slHint  = document.getElementById('calc-sl-hint');

  if (eqEl && acct) eqEl.value = acct.equity;
  if (curEl && acct) curEl.textContent = acct.currency;

  /* extra field */
  if (extra) {
    extra.style.display = 'none';
    extra.innerHTML = '';
    if (market === 'Crypto Lev') {
      extra.style.display = '';
      extra.innerHTML = '<label>Leverage</label><select id="calc-leverage" onchange="calcUpdate()"><option>10</option><option>25</option><option selected>50</option><option>75</option><option>100</option></select>';
    }
    if (market === 'Forex Indices') {
      extra.style.display = '';
      extra.innerHTML = '<label>Point Value / Lot ($)</label><input type="number" id="calc-ptval" value="1" step="any" oninput="calcUpdate()">';
    }
  }

  /* SL hint */
  if (slHint) {
    var hints = {
      'KLCI':          'KLCI: enter price in RM',
      'US Stocks':     'US Stocks: enter price in USD',
      'Crypto Spot':   'Crypto: enter price in USDT',
      'Crypto Lev':    'Crypto: enter price in USDT. Leverage amplifies position size.',
      'Forex Pair':    'Forex pairs: enter actual price (e.g. 1.0850 for EURUSD)',
      'Forex Gold':    'Gold: enter price per oz in USD (e.g. 2400.00)',
      'Forex Silver':  'Silver: enter price per oz in USD (e.g. 31.50)',
      'Forex Indices': 'Indices: enter price in points (e.g. 18250 for NAS100)'
    };
    slHint.textContent = hints[market] || '';
  }

  calcUpdate();
}

function _calcAccount(market) {
  var map = {
    'KLCI':'my', 'US Stocks':'us',
    'Crypto Spot':'cr', 'Crypto Lev':'cr',
    'Forex Pair':'fx', 'Forex Gold':'fx', 'Forex Silver':'fx', 'Forex Indices':'fx'
  };
  return getAccount(map[market] || 'my');
}

function calcUpdate() {
  var market  = (document.getElementById('calc-market')  || {}).value || 'KLCI';
  var equity  = parseFloat((document.getElementById('calc-equity')  || {}).value) || 0;
  var riskPct = parseFloat((document.getElementById('calc-risk')    || {}).value) || 2;
  var entry   = parseFloat((document.getElementById('calc-entry')   || {}).value) || 0;
  var sl      = parseFloat((document.getElementById('calc-sl')      || {}).value) || 0;
  var tp      = parseFloat((document.getElementById('calc-tp')      || {}).value) || 0;

  var box = document.getElementById('calc-result-box');
  if (!equity || !entry || !sl) { if (box) box.style.display = 'none'; return; }
  if (box) box.style.display = 'block';

  var riskAmt  = equity * (riskPct / 100);
  var slDist   = Math.abs(entry - sl);
  var tpDist   = tp > 0 ? Math.abs(tp - entry) : 0;
  var rr       = tpDist > 0 && slDist > 0 ? tpDist / slDist : 0;
  var acct     = _calcAccount(market);
  var cur      = acct ? acct.currency : '';
  var result   = {};

  if (market === 'KLCI') {
    var shares = riskAmt / slDist;
    var lots   = Math.floor(shares / 100);
    result = { size: lots + ' lots', sizeSub: (lots * 100) + ' shares', risk: fmt(lots * 100 * slDist, 0), extra: null };
  } else if (market === 'US Stocks') {
    var shrs = Math.floor(riskAmt / slDist);
    result = { size: shrs + ' shares', sizeSub: '', risk: fmt(shrs * slDist, 0), extra: null };
  } else if (market === 'Crypto Spot') {
    var coins = riskAmt / slDist;
    result = { size: fmt(coins, 4) + ' coins', sizeSub: '', risk: fmt(riskAmt, 0), extra: null };
  } else if (market === 'Crypto Lev') {
    var lev     = parseFloat((document.getElementById('calc-leverage') || {}).value) || 50;
    var slPct   = slDist / entry;
    var posVal  = slPct > 0 ? riskAmt / slPct : 0;
    var margin  = posVal / lev;
    var coins2  = posVal / entry;
    var liqDir  = (document.getElementById('calc-sl') && parseFloat(document.getElementById('calc-sl').value) < entry) ? (1 - 1/lev) : (1 + 1/lev);
    var liqPx   = entry * liqDir;
    result = { size: fmt(coins2, 4) + ' coins', sizeSub: lev + 'x leverage', risk: fmt(margin, 0), riskLabel:'Margin Required',
               extra: '~' + fmt(liqPx, 0), extraLabel:'Est. Liq Price', extraSub:cur };
  } else if (market === 'Forex Pair') {
    var pips    = slDist > 0.01 ? slDist * 10000 : slDist * 100;
    var lots2   = riskAmt / (pips * 10);
    var adjLots = Math.round(lots2 * 100) / 100;
    result = { size: adjLots.toFixed(2) + ' lots', sizeSub: fmt(pips, 0) + ' pips SL', risk: fmt(riskAmt, 0), extra: null };
  } else if (market === 'Forex Gold') {
    var lots3   = riskAmt / (slDist * 100);
    var adjL3   = Math.round(lots3 * 100) / 100;
    result = { size: adjL3.toFixed(2) + ' lots', sizeSub: '1 lot = 100 oz', risk: fmt(riskAmt, 0), extra: null };
  } else if (market === 'Forex Silver') {
    var lots4   = riskAmt / (slDist * 5000);
    var adjL4   = Math.round(lots4 * 100) / 100;
    result = { size: adjL4.toFixed(2) + ' lots', sizeSub: '1 lot = 5000 oz', risk: fmt(riskAmt, 0), extra: null };
  } else if (market === 'Forex Indices') {
    var ptval   = parseFloat((document.getElementById('calc-ptval') || {}).value) || 1;
    var lots5   = riskAmt / (slDist * ptval);
    var adjL5   = Math.round(lots5 * 100) / 100;
    result = { size: adjL5.toFixed(2) + ' lots', sizeSub: '$' + ptval + '/lot/point', risk: fmt(riskAmt, 0), extra: null };
  }

  /* render results */
  _setEl('res-size', result.size);
  _setEl('res-size-sub', result.sizeSub || '');
  _setEl('res-risk', result.risk + ' ' + cur);
  _setEl('res-risk-sub', result.riskLabel || 'at risk this trade');

  if (rr > 0) {
    var rrCls = rr >= 2 ? 'text-pos' : 'text-neg';
    document.getElementById('res-rr').innerHTML = '<span class="' + rrCls + '">1:' + fmt(rr, 2) + '</span>';
    _setEl('res-rr-sub', rr >= 2 ? 'PASS — meets 1:2 minimum' : 'FAIL — below 1:2 minimum');
  } else {
    _setEl('res-rr', '—'); _setEl('res-rr-sub', 'Enter TP to calculate');
  }

  var profitAmt = tpDist > 0 ? fmt(riskAmt * rr, 0) : '—';
  _setEl('res-profit', profitAmt + (tpDist > 0 ? ' ' + cur : ''));

  var extraWrap = document.getElementById('res-extra-wrap');
  if (result.extra && extraWrap) {
    extraWrap.style.display = '';
    _setEl('res-extra-label', result.extraLabel || '');
    _setEl('res-extra', result.extra);
    _setEl('res-extra-sub', result.extraSub || '');
  } else if (extraWrap) {
    extraWrap.style.display = 'none';
  }

  /* warnings */
  var alerts = [];
  if (rr > 0 && rr < 2) alerts.push({ cls:'alert-danger', msg: 'R:R is 1:' + fmt(rr,2) + ' — below 1:2 minimum. Do not enter.' });
  else if (rr >= 2)     alerts.push({ cls:'alert-ok',     msg: 'R:R is 1:' + fmt(rr,2) + ' — meets the minimum requirement.' });
  var openRiskPct = getTotalOpenRisk();
  var newTotal    = openRiskPct + riskPct;
  if (newTotal > PREFS.dailyLimitPct) alerts.push({ cls:'alert-danger', msg: 'Adding this trade would bring total risk to ' + fmt(newTotal,2) + '% — exceeds ' + PREFS.dailyLimitPct + '% daily limit.' });
  else alerts.push({ cls:'alert-ok', msg: 'Portfolio risk after entry: ' + fmt(newTotal,2) + '% — within ' + PREFS.dailyLimitPct + '% limit.' });

  var alertEl = document.getElementById('calc-alerts');
  if (alertEl) alertEl.innerHTML = alerts.map(function(a){ return '<div class="alert ' + a.cls + '">' + a.msg + '</div>'; }).join('');
}

function _renderOpenRisk() {
  var el = document.getElementById('calc-open-risk');
  if (!el) return;
  var holdings = getHoldings();
  if (!holdings.length) { el.innerHTML = '<div class="text-muted text-sm">No open positions.</div>'; return; }
  el.innerHTML = holdings.map(function(t) {
    var acct = getAccount(t.accountId);
    var risk = calcRiskAmt(t);
    var pct  = acct ? (risk / acct.equity * 100) : 0;
    return '<div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:12px;padding:6px 0;border-bottom:1px solid var(--border2);">' +
      '<span>' + t.asset + ' <span class="text-muted">' + t.market + '</span></span>' +
      '<span class="text-neg">' + fmt(risk,0) + ' ' + (acct?acct.currency:'') + ' (' + fmt(pct,2) + '%)</span>' +
    '</div>';
  }).join('') +
  '<div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:12px;padding:8px 0;color:var(--muted);">' +
    '<span>Total open risk</span><span class="' + (getTotalOpenRisk() <= PREFS.dailyLimitPct ? 'text-pos' : 'text-neg') + '">' + fmt(getTotalOpenRisk(),2) + '%</span>' +
  '</div>';
}

function _setEl(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}
