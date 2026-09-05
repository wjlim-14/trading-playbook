/* ============================================================
   J.TRADEBOOK — LADDER (double-up plan with profit skims)
   Each round: double the working capital, withdraw X% of the profit,
   carry the rest forward. Runs until the goal is reached.
   Settings persist in PREFS.ladder (no table/endpoint needed).
   ============================================================ */

function ladderCfg(){
  var d = { start:50, goal:1000000, withdrawPct:30, goalMode:'total' };
  return Object.assign(d, (PREFS && PREFS.ladder) || {});
}
function ladderCur(){ return baseCurrency ? baseCurrency() : ((PREFS && PREFS.baseCurrency) || 'USD'); }

function computeLadder(cfg){
  var base = +cfg.start || 0, cum = 0, rows = [], r = 0;
  var goal = +cfg.goal || 0, w = (+cfg.withdrawPct || 0) / 100;
  if (base <= 0) return rows;
  while (r < 100) {
    r++;
    var target = base * 2, profit = base, wd = profit * w, carry = target - wd;
    cum += wd;
    var total = carry + cum;
    var reached = cfg.goalMode === 'account' ? carry >= goal : total >= goal;
    rows.push({ r:r, start:base, target:target, wd:wd, carry:carry, cum:cum, total:total, reached:reached });
    if (reached) break;
    base = carry;
  }
  return rows;
}

function renderLadder(){
  var el = document.getElementById('p-ladder');
  var cfg = ladderCfg(), cur = ladderCur();

  var controls =
    '<div class="lad-controls">' +
      '<div class="field"><div class="fl">Starting capital (' + cur + ')</div><input class="fi" id="lad-start" value="' + cfg.start + '" onchange="ladSetField(\'start\',this.value)"></div>' +
      '<div class="field"><div class="fl">Goal (' + cur + ')</div><input class="fi" id="lad-goal" value="' + cfg.goal + '" onchange="ladSetField(\'goal\',this.value)"></div>' +
      '<div class="field"><div class="fl">Withdraw of profit each double: <b id="lad-wpct">' + cfg.withdrawPct + '%</b></div>' +
        '<input class="rng" type="range" min="0" max="70" step="5" value="' + cfg.withdrawPct + '" oninput="ladSlide(this.value)"></div>' +
      '<div class="field"><div class="fl">Reach goal by</div>' +
        '<div class="rtog"><button class="rtbtn' + (cfg.goalMode==='total'?' active':'') + '" onclick="ladSetMode(\'total\')">Account + withdrawn</button>' +
        '<button class="rtbtn' + (cfg.goalMode==='account'?' active':'') + '" onclick="ladSetMode(\'account\')">Account only</button></div></div>' +
    '</div>';

  el.innerHTML =
    '<div class="mind-head"><div><h2 class="mind-t">Double-Up Ladder</h2>' +
      '<div class="mind-sub">Double the capital, skim a slice of profit each rung, carry the rest — to your goal</div></div></div>' +
    controls +
    '<div id="lad-out"></div>';
  ladPaint();
}

function ladPaint(){
  var host = document.getElementById('lad-out'); if (!host) return;
  var cfg = ladderCfg(), cur = ladderCur();
  var rows = computeLadder(cfg);
  var last = rows[rows.length-1];

  var summary = last ?
    '<div class="lad-sum">' +
      ladTile('Rounds to goal', rows.length + '×') +
      ladTile('Total withdrawn', money(last.cum, cur), 'g') +
      ladTile('Final account', money(last.carry, cur)) +
      ladTile('Final total', money(last.total, cur), 'g') +
    '</div>' : '<div class="empty">Enter a starting capital.</div>';

  var head = '<div class="lad-row lad-h"><div>#</div><div>Start</div><div>Target 2×</div><div>Withdraw</div><div>Keep &amp; carry</div><div>Cum. out</div><div>Total net</div></div>';
  var body = rows.map(function(x){
    return '<div class="lad-row' + (x.reached?' hit':'') + '">' +
      '<div>' + x.r + '</div>' +
      '<div>' + money(x.start,cur) + '</div>' +
      '<div>' + money(x.target,cur) + '</div>' +
      '<div class="text-neg">' + money(x.wd,cur) + '</div>' +
      '<div>' + money(x.carry,cur) + '</div>' +
      '<div class="g">' + money(x.cum,cur) + '</div>' +
      '<div><b>' + money(x.total,cur) + '</b></div>' +
    '</div>';
  }).join('');

  host.innerHTML = summary + '<div class="lad-table">' + head + body + '</div>' +
    '<div class="idx-hint" style="margin-top:10px">Each round targets <b>2× your working capital</b>. When hit, you withdraw ' + cfg.withdrawPct + '% of that round\'s profit and keep the rest trading. "Total net" = money still in the account + everything withdrawn so far.</div>';
}

function ladTile(label, val, cls){
  return '<div class="rep-tile"><div class="rep-tl">' + label + '</div><div class="rep-tv ' + (cls==='g'?'g':'') + '">' + val + '</div></div>';
}
function _ladNum(v){ return parseFloat(String(v).replace(/[^0-9.]/g,'')) || 0; }
function ladSetField(k, v){ var cfg = ladderCfg(); cfg[k] = _ladNum(v); apiSavePrefs({ ladder: cfg }); renderLadder(); }
function ladSetMode(m){ var cfg = ladderCfg(); cfg.goalMode = m; apiSavePrefs({ ladder: cfg }); renderLadder(); }
function ladSlide(v){
  var cfg = ladderCfg(); cfg.withdrawPct = parseFloat(v) || 0;
  var lbl = document.getElementById('lad-wpct'); if (lbl) lbl.textContent = cfg.withdrawPct + '%';
  apiSavePrefs({ ladder: cfg }); ladPaint();   // repaint output only — keep slider drag smooth
}
