/* ── SHARED CHART HELPERS ── */
function chartSetup(id, h) {
  var canvas = document.getElementById(id);
  if (!canvas) return null;
  var ctx = canvas.getContext('2d');
  var W   = canvas.offsetWidth || 400;
  var H   = h || parseInt(canvas.getAttribute('height')) || 180;
  canvas.width  = W;
  canvas.height = H;
  ctx.clearRect(0, 0, W, H);
  return { ctx:ctx, W:W, H:H };
}

function chartGrid(ctx, W, H, pad, steps, maxV, minV) {
  var range = maxV - minV || 1;
  ctx.strokeStyle = 'rgba(28,17,8,0.06)';
  ctx.lineWidth = 1;
  for (var i = 0; i <= steps; i++) {
    var y = pad.t + (H - pad.t - pad.b) * (i / steps);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    var val = maxV - (range * i / steps);
    ctx.fillStyle = 'rgba(122,101,80,0.7)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText((val >= 0 ? '+' : '') + Math.round(val), pad.l - 4, y + 4);
  }
}

/* ── CUMULATIVE P&L LINE CHART ── */
function drawPnlChart(id, trades) {
  var c = chartSetup(id, 170);
  if (!c) return;
  var ctx = c.ctx, W = c.W, H = c.H;

  var closed = (trades || getClosedTrades()).filter(function(t){ return calcPnL(t) != null; });
  var running = 0;
  var points  = [0];
  closed.forEach(function(t){ running += calcPnL(t); points.push(+running.toFixed(2)); });

  var maxV  = Math.max.apply(null, points);
  var minV  = Math.min.apply(null, points);
  var range = maxV - minV || 1;
  var pad   = { l:52, r:12, t:10, b:28 };
  var plotW = W - pad.l - pad.r;
  var plotH = H - pad.t - pad.b;

  chartGrid(ctx, W, H, pad, 4, maxV, minV);

  /* zero line */
  var zeroY = pad.t + ((maxV - 0) / range) * plotH;
  if (zeroY >= pad.t && zeroY <= pad.t + plotH) {
    ctx.strokeStyle = 'rgba(196,154,32,0.3)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(pad.l, zeroY); ctx.lineTo(W - pad.r, zeroY); ctx.stroke();
    ctx.setLineDash([]);
  }

  if (points.length < 2) return;

  var coords = points.map(function(v, i) {
    return {
      x: pad.l + (plotW * i / (points.length - 1)),
      y: pad.t + ((maxV - v) / range) * plotH
    };
  });
  var last  = coords[coords.length - 1];
  var isPos = points[points.length - 1] >= 0;

  /* fill */
  var grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
  grad.addColorStop(0, isPos ? 'rgba(26,107,53,0.2)' : 'rgba(192,32,32,0.2)');
  grad.addColorStop(1, 'rgba(240,235,226,0)');
  ctx.beginPath();
  ctx.moveTo(coords[0].x, H - pad.b);
  coords.forEach(function(c){ ctx.lineTo(c.x, c.y); });
  ctx.lineTo(last.x, H - pad.b);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  /* line */
  ctx.beginPath();
  ctx.strokeStyle = isPos ? '#1a6b35' : '#c02020';
  ctx.lineWidth   = 2;
  coords.forEach(function(c, i){ i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y); });
  ctx.stroke();

  /* end dot */
  ctx.beginPath();
  ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = isPos ? '#1a6b35' : '#c02020';
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(last.x, last.y, 2, 0, Math.PI * 2);
  ctx.fill();
}

/* ── R-MULTIPLE DISTRIBUTION BAR CHART ── */
function drawRDist(id, trades) {
  var c = chartSetup(id, 170);
  if (!c) return;
  var ctx = c.ctx, W = c.W, H = c.H;

  var closed  = (trades || getClosedTrades()).filter(function(t){ return calcR(t) != null; });
  var buckets = { '<-1':0, '-1–0':0, '0–1':0, '1–2':0, '2–3':0, '>3':0 };
  var keys    = Object.keys(buckets);

  closed.forEach(function(t) {
    var r = calcR(t);
    if      (r < -1) buckets['<-1']++;
    else if (r <  0) buckets['-1–0']++;
    else if (r <  1) buckets['0–1']++;
    else if (r <  2) buckets['1–2']++;
    else if (r <  3) buckets['2–3']++;
    else             buckets['>3']++;
  });

  var vals   = keys.map(function(k){ return buckets[k]; });
  var maxVal = Math.max.apply(null, vals) || 1;
  var pad    = { l:20, r:12, t:10, b:28 };
  var plotW  = W - pad.l - pad.r;
  var plotH  = H - pad.t - pad.b;
  var bw     = plotW / keys.length;

  /* axis */
  ctx.strokeStyle = 'rgba(28,17,8,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad.l, pad.t + plotH); ctx.lineTo(W - pad.r, pad.t + plotH); ctx.stroke();

  keys.forEach(function(k, i) {
    var v    = buckets[k];
    var bH   = (v / maxVal) * plotH;
    var x    = pad.l + i * bw;
    var y    = pad.t + plotH - bH;
    var isP  = ['1–2','2–3','>3'].includes(k);
    var isN  = ['<-1','-1–0'].includes(k);

    ctx.fillStyle = isP ? 'rgba(26,107,53,0.75)' : isN ? 'rgba(192,32,32,0.75)' : 'rgba(196,154,32,0.5)';
    var gap = 5;
    ctx.fillRect(x + gap, y, bw - gap * 2, bH);

    ctx.fillStyle = 'rgba(122,101,80,0.8)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(k, x + bw / 2, H - pad.b + 14);
    if (v > 0) {
      ctx.fillStyle = 'rgba(28,17,8,0.7)';
      ctx.fillText(v, x + bw / 2, y - 3);
    }
  });
}

/* ── MONTHLY P&L BAR CHART ── */
function drawMonthlyBars(id, trades) {
  var c = chartSetup(id, 200);
  if (!c) return;
  var ctx = c.ctx, W = c.W, H = c.H;

  var closed  = (trades || getClosedTrades()).filter(function(t){ return calcPnL(t) != null; });
  var monthly = {};
  closed.forEach(function(t) {
    var m = t.date.substring(0, 7);
    monthly[m] = (monthly[m] || 0) + (calcPnL(t) || 0);
  });

  var months = Object.keys(monthly).sort();
  if (!months.length) return;

  var vals    = months.map(function(m){ return monthly[m]; });
  var maxAbs  = Math.max.apply(null, vals.map(Math.abs)) || 1;
  var pad     = { l:56, r:12, t:14, b:28 };
  var plotW   = W - pad.l - pad.r;
  var plotH   = H - pad.t - pad.b;
  var mid     = pad.t + plotH / 2;
  var bw      = plotW / months.length;

  /* grid */
  ctx.strokeStyle = 'rgba(28,17,8,0.06)';
  ctx.lineWidth = 1;
  [0, 0.25, 0.5, 0.75, 1].forEach(function(f) {
    var y = pad.t + f * plotH;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
  });

  /* zero line */
  ctx.strokeStyle = 'rgba(196,154,32,0.35)';
  ctx.beginPath(); ctx.moveTo(pad.l, mid); ctx.lineTo(W - pad.r, mid); ctx.stroke();

  /* y labels */
  ctx.fillStyle = 'rgba(122,101,80,0.8)';
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.textAlign = 'right';
  [[maxAbs, pad.t], [0, mid], [-maxAbs, pad.t + plotH]].forEach(function(pair) {
    ctx.fillText((pair[0] >= 0 ? '+' : '') + Math.round(pair[0]), pad.l - 4, pair[1] + 4);
  });

  months.forEach(function(m, i) {
    var v   = monthly[m];
    var bH  = Math.abs(v / maxAbs) * (plotH / 2 - 4);
    var x   = pad.l + i * bw;
    var y   = v >= 0 ? mid - bH : mid;
    ctx.fillStyle = v >= 0 ? 'rgba(26,107,53,0.8)' : 'rgba(192,32,32,0.8)';
    var gap = 5;
    ctx.fillRect(x + gap, y, bw - gap * 2, bH);

    ctx.fillStyle = 'rgba(122,101,80,0.8)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(m.substring(5), x + bw / 2, H - pad.b + 14);

    if (v !== 0) {
      ctx.fillStyle = v >= 0 ? '#1a6b35' : '#c02020';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText((v > 0 ? '+' : '') + Math.round(v), x + bw / 2, v >= 0 ? y - 3 : y + bH + 11);
    }
  });
}
