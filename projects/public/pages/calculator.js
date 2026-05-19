var _calcRiskMode = 'pct';

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

        '<div class="form-group">' +
          '<label style="display:flex;align-items:center;gap:8px;">Risk' +
            '<span style="display:inline-flex;border:1px solid var(--border);border-radius:4px;overflow:hidden;font-size:11px;margin-left:2px;">' +
              '<span id="rt-pct" onclick="_setCalcRiskMode(\'pct\')" style="padding:2px 9px;cursor:pointer;background:var(--gold);color:#fff;font-family:var(--font-mono);">%</span>' +
              '<span id="rt-amt" onclick="_setCalcRiskMode(\'amt\')" style="padding:2px 9px;cursor:pointer;background:transparent;color:var(--muted);font-family:var(--font-mono);">Amt</span>' +
            '</span>' +
          '</label>' +
          '<div style="display:flex;gap:6px;align-items:center;">' +
            '<input type="number" id="calc-risk"     value="2"  step="0.5" min="0.5" max="10" oninput="calcUpdate()">' +
            '<input type="number" id="calc-risk-amt" style="display:none;" step="any" placeholder="0.00" oninput="calcUpdate()">' +
            '<span id="calc-risk-suffix" class="text-muted mono" style="font-size:12px;white-space:nowrap;min-width:28px;">%</span>' +
          '</div>' +
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
        '<div><div class="calc-item-label" id="res-risk-label">Risk Amount</div><div class="calc-item-value" id="res-risk">—</div><div class="calc-item-sub" id="res-risk-sub"></div></div>' +
        '<div><div class="calc-item-label">R:R Ratio</div><div class="calc-item-value" id="res-rr">—</div><div class="calc-item-sub" id="res-rr-sub"></div></div>' +
        '<div><div class="calc-item-label">Potential Profit</div><div class="calc-item-value" id="res-profit">—</div><div class="calc-item-sub" id="res-profit-sub">if TP hit</div></div>' +
        '<div id="res-extra-wrap" style="display:none;"><div class="calc-item-label" id="res-extra-label"></div><div class="calc-item-value" id="res-extra">—</div><div class="calc-item-sub" id="res-extra-sub"></div></div>' +
      '</div>' +
      '<div id="calc-alerts" style="margin-top:16px;display:flex;flex-direction:column;gap:8px;"></div>' +
    '</div>' +

    '<div class="card mt-16"><div class="card-title">Open Risk Context</div><div id="calc-open-risk"></div></div>' +
  '</div>';

  _calcRiskMode = 'pct';
  _calcMarketChanged();
  _renderOpenRisk();
}

function _setCalcRiskMode(mode) {
  _calcRiskMode = mode;
  var pctBtn = document.getElementById('rt-pct');
  var amtBtn = document.getElementById('rt-amt');
  var pctInput = document.getElementById('calc-risk');
  var amtInput = document.getElementById('calc-risk-amt');
  var suffix   = document.getElementById('calc-risk-suffix');
  var acct     = _calcAccount((document.getElementById('calc-market') || {}).value || 'KLCI');

  if (mode === 'pct') {
    pctBtn.style.background = 'var(--gold)'; pctBtn.style.color = '#fff';
    amtBtn.style.background = 'transparent'; amtBtn.style.color = 'var(--muted)';
    pctInput.style.display = ''; amtInput.style.display = 'none';
    suffix.textContent = '%';
  } else {
    pctBtn.style.background = 'transparent'; pctBtn.style.color = 'var(--muted)';
    amtBtn.style.background = 'var(--gold)'; amtBtn.style.color = '#fff';
    pctInput.style.display = 'none'; amtInput.style.display = '';
    suffix.textContent = acct ? acct.currency : '';
    /* pre-fill amount from current pct if empty */
    if (!amtInput.value) {
      var eq = parseFloat((document.getElementById('calc-equity') || {}).value) || 0;
      var pct = parseFloat(pctInput.value) || 2;
      if (eq) amtInput.value = (eq * pct / 100).toFixed(2);
    }
  }
  calcUpdate();
}

function _calcMarketChanged() {
  var market = (document.getElementById('calc-market') || {}).value || 'KLCI';
  var acct   = _calcAccount(market);
  var eqEl   = document.getElementById('calc-equity');
  var curEl  = document.getElementById('calc-currency');
  var extra  = document.getElementById('calc-extra-field');
  var slHint = document.getElementById('calc-sl-hint');
  var suffix = document.getElementById('calc-risk-suffix');

  if (eqEl && acct) eqEl.value = acct.equity;
  if (curEl && acct) curEl.textContent = acct.currency;
  if (suffix && _calcRiskMode === 'amt' && acct) suffix.textContent = acct.currency;

  /* extra field — one slot, varies by market */
  if (extra) {
    extra.style.display = 'none';
    extra.innerHTML = '';

    if (market === 'Crypto Lev') {
      extra.style.display = '';
      extra.innerHTML = '<label>Leverage</label><select id="calc-leverage" onchange="calcUpdate()"><option>10</option><option>25</option><option selected>50</option><option>75</option><option>100</option></select>';
    }
    if (market === 'Forex Pair') {
      extra.style.display = '';
      extra.innerHTML = '<label>Pair Type</label><select id="calc-pair-type" onchange="calcUpdate()"><option value="major">4-decimal (EURUSD, GBPUSD, XAUUSD...)</option><option value="jpy">2-decimal (USDJPY, EURJPY...)</option></select>';
    }
    if (market === 'Forex Indices') {
      extra.style.display = '';
      extra.innerHTML = '<label>Point Value / Lot ($)</label><input type="number" id="calc-ptval" value="1" step="any" oninput="calcUpdate()">';
    }
  }

  /* SL hint */
  if (slHint) {
    var hints = {
      'KLCI':          'Enter price in RM. Output: lots (1 lot = 100 shares).',
      'US Stocks':     'Enter price in USD. Output: shares.',
      'Crypto Spot':   'Enter price in USDT. Output: coins.',
      'Crypto Lev':    'Enter price in USDT. Leverage amplifies position — margin shown.',
      'Forex Pair':    'Enter price as quoted (e.g. 1.0850 for EURUSD, 151.20 for USDJPY). Output: lots (1 std lot = 100,000 units, pip value ≈ $10/lot).',
      'Forex Gold':    'Enter price per oz in USD (e.g. 2400.00). 1 lot = 100 oz.',
      'Forex Silver':  'Enter price per oz in USD (e.g. 31.50). 1 lot = 5,000 oz.',
      'Forex Indices': 'Enter price in points (e.g. 18250 for NAS100). Set point value per lot below.'
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
  var entry   = parseFloat((document.getElementById('calc-entry')   || {}).value) || 0;
  var sl      = parseFloat((document.getElementById('calc-sl')      || {}).value) || 0;
  var tp      = parseFloat((document.getElementById('calc-tp')      || {}).value) || 0;

  /* risk amount — from % or direct amount */
  var riskAmt, riskPct;
  if (_calcRiskMode === 'amt') {
    riskAmt = parseFloat((document.getElementById('calc-risk-amt') || {}).value) || 0;
    riskPct = equity > 0 ? riskAmt / equity * 100 : 0;
  } else {
    riskPct = parseFloat((document.getElementById('calc-risk') || {}).value) || 2;
    riskAmt = equity * (riskPct / 100);
  }

  var box = document.getElementById('calc-result-box');
  if (!equity || !entry || !sl || !riskAmt) { if (box) box.style.display = 'none'; return; }
  if (box) box.style.display = 'block';

  var slDist = Math.abs(entry - sl);
  var tpDist = tp > 0 ? Math.abs(tp - entry) : 0;
  var rr     = tpDist > 0 && slDist > 0 ? tpDist / slDist : 0;
  var acct   = _calcAccount(market);
  var cur    = acct ? acct.currency : '';
  var result = {};

  /* ── POSITION SIZE PER MARKET ── */
  if (market === 'KLCI') {
    /* 1 lot = 100 shares. Round down to nearest lot. */
    var lots = Math.floor(riskAmt / (slDist * 100));
    var actualRisk = lots * 100 * slDist;
    result = {
      size: lots + ' lots',
      sizeSub: (lots * 100) + ' shares — enter shares in journal',
      risk: fmt(actualRisk, 0),
      extra: null
    };

  } else if (market === 'US Stocks') {
    /* integer shares */
    var shrs = Math.floor(riskAmt / slDist);
    result = {
      size: shrs + ' shares',
      sizeSub: 'enter shares in journal',
      risk: fmt(shrs * slDist, 2),
      extra: null
    };

  } else if (market === 'Crypto Spot') {
    /* fractional coins */
    var coins = riskAmt / slDist;
    result = {
      size: fmt(coins, 4) + ' coins',
      sizeSub: 'enter coins in journal',
      risk: fmt(riskAmt, 2),
      extra: null
    };

  } else if (market === 'Crypto Lev') {
    /* leveraged: position_value = riskAmt / sl%, margin = posVal / lev */
    var lev    = parseFloat((document.getElementById('calc-leverage') || {}).value) || 50;
    var slPct  = slDist / entry;
    var posVal = slPct > 0 ? riskAmt / slPct : 0;
    var margin = posVal / lev;
    var coins2 = posVal / entry;
    var isLong = sl < entry;
    var liqPx  = entry * (isLong ? (1 - 1 / lev) : (1 + 1 / lev));
    result = {
      size: fmt(coins2, 4) + ' coins',
      sizeSub: lev + 'x — notional ' + fmt(posVal, 0) + ' ' + cur,
      risk: fmt(margin, 2),
      riskLabel: 'Margin Required',
      extra: '~' + fmt(liqPx, 2),
      extraLabel: 'Est. Liq Price',
      extraSub: cur
    };

  } else if (market === 'Forex Pair') {
    /* pip value for standard lot ≈ $10 USD for major pairs */
    var pairType = (document.getElementById('calc-pair-type') || {}).value || 'major';
    var pips     = pairType === 'jpy' ? slDist * 100 : slDist * 10000;
    var pipVal   = 10; /* $10 per pip per standard lot — USD-quoted major pairs */
    var lotsF    = riskAmt / (pips * pipVal);
    var adjLotsF = Math.round(lotsF * 100) / 100;
    result = {
      size: adjLotsF.toFixed(2) + ' lots',
      sizeSub: fmt(pips, 1) + ' pips SL · $' + pipVal + '/pip/lot',
      risk: fmt(riskAmt, 2),
      extra: null
    };

  } else if (market === 'Forex Gold') {
    /* 1 lot = 100 oz, risk = lots × 100 × slDist */
    var lotsG  = riskAmt / (slDist * 100);
    var adjG   = Math.round(lotsG * 100) / 100;
    result = {
      size: adjG.toFixed(2) + ' lots',
      sizeSub: (adjG * 100).toFixed(0) + ' oz (1 lot = 100 oz)',
      risk: fmt(riskAmt, 2),
      extra: null
    };

  } else if (market === 'Forex Silver') {
    /* 1 lot = 5000 oz, risk = lots × 5000 × slDist */
    var lotsS  = riskAmt / (slDist * 5000);
    var adjS   = Math.round(lotsS * 100) / 100;
    result = {
      size: adjS.toFixed(2) + ' lots',
      sizeSub: (adjS * 5000).toFixed(0) + ' oz (1 lot = 5,000 oz)',
      risk: fmt(riskAmt, 2),
      extra: null
    };

  } else if (market === 'Forex Indices') {
    /* risk = lots × slDist × pointValue */
    var ptval  = parseFloat((document.getElementById('calc-ptval') || {}).value) || 1;
    var lotsI  = riskAmt / (slDist * ptval);
    var adjI   = Math.round(lotsI * 100) / 100;
    result = {
      size: adjI.toFixed(2) + ' lots',
      sizeSub: '$' + ptval + '/lot/point · ' + fmt(slDist, 1) + ' pts SL',
      risk: fmt(riskAmt, 2),
      extra: null
    };
  }

  /* ── RENDER RESULTS ── */
  _setEl('res-size', result.size);
  _setEl('res-size-sub', result.sizeSub || '');
  _setEl('res-risk', result.risk + ' ' + cur);
  _setEl('res-risk-sub', result.riskLabel || ('= ' + fmt(riskPct, 2) + '% of equity'));

  if (rr > 0) {
    var rrCls = rr >= 2 ? 'text-pos' : 'text-neg';
    document.getElementById('res-rr').innerHTML = '<span class="' + rrCls + '">1:' + fmt(rr, 2) + '</span>';
    _setEl('res-rr-sub', rr >= 2 ? 'PASS — meets 1:2 minimum' : 'FAIL — below 1:2 minimum');
  } else {
    _setEl('res-rr', '—'); _setEl('res-rr-sub', 'Enter TP to calculate');
  }

  var profitAmt = tpDist > 0 ? fmt(riskAmt * rr, 2) : '—';
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

  /* ── ALERTS ── */
  var alerts = [];
  if (rr > 0 && rr < 2) alerts.push({ cls:'alert-danger', msg: 'R:R is 1:' + fmt(rr, 2) + ' — below 1:2 minimum. Do not enter.' });
  else if (rr >= 2)      alerts.push({ cls:'alert-ok',     msg: 'R:R is 1:' + fmt(rr, 2) + ' — meets the minimum requirement.' });

  var openRiskPct = getTotalOpenRisk();
  var newTotal    = openRiskPct + riskPct;
  if (newTotal > PREFS.dailyLimitPct) {
    alerts.push({ cls:'alert-danger', msg: 'Adding this trade would bring total risk to ' + fmt(newTotal, 2) + '% — exceeds ' + PREFS.dailyLimitPct + '% daily limit.' });
  } else {
    alerts.push({ cls:'alert-ok', msg: 'Portfolio risk after entry: ' + fmt(newTotal, 2) + '% — within ' + PREFS.dailyLimitPct + '% limit.' });
  }

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
      '<span class="text-neg">' + fmt(risk, 2) + ' ' + (acct ? acct.currency : '') + ' (' + fmt(pct, 2) + '%)</span>' +
    '</div>';
  }).join('') +
  '<div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:12px;padding:8px 0;color:var(--muted);">' +
    '<span>Total open risk</span>' +
    '<span class="' + (getTotalOpenRisk() <= PREFS.dailyLimitPct ? 'text-pos' : 'text-neg') + '">' + fmt(getTotalOpenRisk(), 2) + '%</span>' +
  '</div>';
}

function _setEl(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}
