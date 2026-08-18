/* ============================================================
   J.TRADEBOOK V3 — CHARTS (inline SVG + HTML label overlay)
   ============================================================ */

/* Trading equity curve with labels.
   points = [{cum, t}]  (t = the closed trade, for time axis)
   opts   = { id, currency, deposits:[{date, amount}] } */
function equityCurveSVG(points, opts) {
  opts = opts || {};
  var cur = opts.currency || 'USD';
  if (!points || points.length === 0) {
    return '<div class="empty">No closed trades yet — your equity curve will appear here.</div>';
  }
  var W = 400, H = 170, pad = 6;
  var cums = points.map(function(p){ return p.cum; });
  var min = Math.min(0, Math.min.apply(null, cums));
  var max = Math.max(0, Math.max.apply(null, cums));
  if (min === max) max = min + 1;
  var n = points.length;
  function x(i){ return n === 1 ? W/2 : pad + i * (W - 2*pad) / (n - 1); }
  function y(v){ return pad + (max - v) * (H - 2*pad) / (max - min); }
  function yFrac(v){ return (max - v) / (max - min); }   // 0..1 for HTML overlay

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

  // deposit markers (cash events, excluded from the curve)
  var times = points.map(function(p){ return String((p.t && (p.t.exitTimestamp||p.t.createdAt)) || '').slice(0,10); });
  var tmin = times[0], tmax = times[times.length-1] || times[0];
  var depLines = '';
  (opts.deposits || []).forEach(function(d){
    if (!d.date) return;
    var frac = (tmax === tmin) ? 0.5 : (d.date <= tmin ? 0 : d.date >= tmax ? 1 : (Date.parse(d.date)-Date.parse(tmin))/(Date.parse(tmax)-Date.parse(tmin)));
    var px = round(pad + frac*(W-2*pad),1);
    depLines += '<line x1="' + px + '" y1="0" x2="' + px + '" y2="' + H + '" stroke="var(--gold)" stroke-width="1" stroke-dasharray="3,3" opacity=".55"/>';
  });

  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%">' +
    '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + stroke + '" stop-opacity=".2"/><stop offset="100%" stop-color="' + stroke + '" stop-opacity="0"/></linearGradient></defs>' +
    '<line x1="0" y1="' + zeroY + '" x2="' + W + '" y2="' + zeroY + '" stroke="var(--border2)" stroke-width="1" stroke-dasharray="2,3"/>' +
    depLines +
    '<path d="' + area + '" fill="url(#' + gradId + ')"/>' +
    '<path d="' + line + '" fill="none" stroke="' + stroke + '" stroke-width="2" vector-effect="non-scaling-stroke"/>' + dot +
  '</svg>';

  // HTML overlay labels (immune to non-uniform SVG scaling)
  function ylab(v, cls){ return '<div style="position:absolute;right:4px;top:calc(' + round(yFrac(v)*100,1) + '% - 7px);font-family:var(--mono);font-size:9px;color:var(--muted);' + (cls||'') + '">' + moneySigned(v,cur) + '</div>'; }
  var overlay =
    ylab(max) +
    (min < 0 && max > 0 ? '<div style="position:absolute;left:4px;top:calc(' + round(yFrac(0)*100,1) + '% - 7px);font-family:var(--mono);font-size:9px;color:var(--muted)">0</div>' : '') +
    ylab(min) +
    '<div style="position:absolute;left:6px;bottom:3px;font-size:9px;color:var(--muted)">' + tmin + '</div>' +
    '<div style="position:absolute;right:6px;bottom:3px;font-size:9px;color:var(--muted)">' + tmax + '</div>' +
    '<div style="position:absolute;left:8px;top:6px;font-family:var(--mono);font-size:12px;font-weight:700;color:' + stroke + '">' + moneySigned(last,cur) + '<span style="font-size:9px;color:var(--muted);font-weight:400"> net</span></div>';

  return '<div class="eq" style="position:relative">' + svg + overlay + '</div>';
}

function miniBar(pct, color) {
  pct = Math.max(0, Math.min(100, pct));
  return '<div class="heat-bar"><div class="heat-fill" style="width:' + pct + '%;background:' + (color||'var(--gold)') + '"></div></div>';
}
