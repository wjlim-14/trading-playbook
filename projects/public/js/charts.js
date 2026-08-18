/* ============================================================
   J.TRADEBOOK V2 — CHARTS (inline SVG, no dependencies)
   ============================================================ */

/* Trading equity curve. points = [{cum, t}], deposits = [{date}] (markers). */
function equityCurveSVG(points, opts) {
  opts = opts || {};
  var W = 400, H = 170, pad = 6;
  if (!points || points.length === 0) {
    return '<div class="empty">No closed trades yet — your equity curve will appear here.</div>';
  }
  var cums = points.map(function(p){ return p.cum; });
  var min = Math.min(0, Math.min.apply(null, cums));
  var max = Math.max(0, Math.max.apply(null, cums));
  if (min === max) { max = min + 1; }
  var n = points.length;
  function x(i){ return n === 1 ? W/2 : pad + i * (W - 2*pad) / (n - 1); }
  function y(v){ return pad + (max - v) * (H - 2*pad) / (max - min); }

  var line, area, dot = '';
  if (n === 1) {
    var yv = round(y(points[0].cum), 1);
    line = 'M' + pad + ',' + yv + ' L' + (W - pad) + ',' + yv;
    area = line + ' L' + (W - pad) + ',' + (H - pad) + ' L' + pad + ',' + (H - pad) + ' Z';
    dot = '<circle cx="' + round(W/2,1) + '" cy="' + yv + '" r="3" fill="' + (points[0].cum>=0?'var(--green)':'var(--red)') + '"/>';
  } else {
    line = points.map(function(p,i){ return (i===0?'M':'L') + round(x(i),1) + ',' + round(y(p.cum),1); }).join(' ');
    area = line + ' L' + round(x(n-1),1) + ',' + (H-pad) + ' L' + round(x(0),1) + ',' + (H-pad) + ' Z';
  }
  var last = cums[cums.length-1];
  var stroke = last >= 0 ? 'var(--green)' : 'var(--red)';
  var gradId = 'eqg_' + (opts.id || 'x');

  var zeroY = round(y(0),1);
  var grid =
    '<line x1="0" y1="' + zeroY + '" x2="' + W + '" y2="' + zeroY + '" stroke="var(--border2)" stroke-width="1" stroke-dasharray="2,3"/>';

  return '<div class="eq"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%">' +
    '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + stroke + '" stop-opacity=".2"/>' +
      '<stop offset="100%" stop-color="' + stroke + '" stop-opacity="0"/></linearGradient></defs>' +
    grid +
    '<path d="' + area + '" fill="url(#' + gradId + ')"/>' +
    '<path d="' + line + '" fill="none" stroke="' + stroke + '" stroke-width="2" vector-effect="non-scaling-stroke"/>' +
    dot +
  '</svg></div>';
}

/* Simple horizontal bar (used by backtest drawdown etc. if needed). */
function miniBar(pct, color) {
  pct = Math.max(0, Math.min(100, pct));
  return '<div class="heat-bar"><div class="heat-fill" style="width:' + pct + '%;background:' + (color||'var(--gold)') + '"></div></div>';
}
