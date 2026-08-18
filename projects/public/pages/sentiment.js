function renderSentiment() {
  var root = document.getElementById('p-market');
  root.innerHTML = '<div class="page-content">' +
    '<div class="page-header"><div class="page-title">Market Sentiment</div><div class="page-subtitle">KLCI · US · Crypto — updated ' + MARKET.klci.updated + '</div></div>' +

    '<div class="grid-3 mb-16">' +
      _sentimentCard('KLCI (Malaysia)', MARKET.klci) +
      _sentimentCard('US Markets', MARKET.us) +
      _sentimentCard('Crypto', MARKET.crypto) +
    '</div>' +

    '<div class="card mb-16">' +
      '<div class="card-title">Fear &amp; Greed Index (US)</div>' +
      '<div style="max-width:520px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">' +
          '<span style="font-family:var(--font-mono);font-size:36px;font-weight:700;color:var(--text);">' + MARKET.fg + '</span>' +
          '<span style="font-family:var(--font-mono);font-size:14px;color:var(--muted);">' + _fgLabel(MARKET.fg) + '</span>' +
        '</div>' +
        '<div class="fg-meter"><div class="fg-needle" style="left:' + MARKET.fg + '%"></div></div>' +
        '<div class="fg-labels"><span>Extreme Fear</span><span>Fear</span><span>Neutral</span><span>Greed</span><span>Extreme Greed</span></div>' +
      '</div>' +
    '</div>' +

    '<div class="card">' +
      '<div class="card-title">Market Notes</div>' +
      MARKET_NOTES.map(function(n) {
        var badge = marketBadge(n.tag === 'US Stocks' ? 'US Stocks' : n.tag);
        return '<div style="padding:12px 0;border-bottom:1px solid var(--border2);">' +
          '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">' +
            '<span class="text-muted text-xs mono">' + n.date + '</span>' + badge +
          '</div>' +
          '<div style="font-size:13px;line-height:1.6;">' + n.note + '</div>' +
        '</div>';
      }).join('') +
    '</div>' +
  '</div>';
}

function _sentimentCard(title, data) {
  var cls = data.dir === 'BULLISH' ? 'badge-bull' : data.dir === 'BEARISH' ? 'badge-bear' : 'badge-neut';
  return '<div class="card">' +
    '<div class="card-title">' + title + '</div>' +
    '<div class="mb-8"><span class="badge ' + cls + '">' + data.dir + '</span></div>' +
    '<div style="font-size:13px;line-height:1.6;color:var(--text2);">' + data.note + '</div>' +
    '<div class="text-muted text-xs mono mt-8">Updated ' + data.updated + '</div>' +
  '</div>';
}

function _fgLabel(v) {
  if (v >= 75) return 'Extreme Greed';
  if (v >= 55) return 'Greed';
  if (v >= 45) return 'Neutral';
  if (v >= 25) return 'Fear';
  return 'Extreme Fear';
}
