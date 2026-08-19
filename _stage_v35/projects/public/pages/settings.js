/* ============================================================
   J.TRADEBOOK V3 — SETTINGS
   Edit risk defaults, entry/exit reason tags, and the instrument
   contract table. All persisted to the prefs row (jsonb).
   ============================================================ */

function _prefList(key, fallback) {
  var v = PREFS && PREFS[key];
  return (v && v.length) ? v.slice() : fallback.slice();
}

function renderSettings() {
  var el = document.getElementById('p-settings');
  var entry = _prefList('entryReasons', DEFAULT_ENTRY_REASONS);
  var exit  = _prefList('exitReasons', DEFAULT_MISTAKE_TAGS);
  var instr = instrumentTable();

  el.innerHTML =
    '<div class="card"><div class="card-h"><div class="card-t">Risk Defaults</div></div>' +
      '<div class="card-b"><div class="cg2">' +
        '<div class="field"><div class="fl">Default Risk % per trade</div><input class="fi" id="set-risk" value="' + (PREFS.defaultRiskPct||2) + '" onchange="saveRiskDefaults()"></div>' +
        '<div class="field"><div class="fl">Daily Portfolio Heat Limit %</div><input class="fi" id="set-limit" value="' + (PREFS.dailyLimitPct||6) + '" onchange="saveRiskDefaults()"></div>' +
      '</div></div></div>' +

    tagEditorCard('Entry Reasons', 'entryReasons', entry, 'Used on the Calculator when planning a trade.') +
    tagEditorCard('Exit / Mistake Tags', 'exitReasons', exit, 'Used on the Journal when reviewing a closed trade.') +

    '<div class="card"><div class="card-h"><div class="card-t">Instrument Contract Table (Forex / CFD)</div></div>' +
      '<div class="card-b">' +
        '<div style="font-size:11px;color:var(--muted);margin-bottom:10px">Value of a 1.0 price move per 1.0 lot. Drives forex/CFD lot sizing. FX pairs auto-use $10/pip if not listed.</div>' +
        '<div id="instr-list" style="display:flex;flex-direction:column;gap:6px">' + instrRows(instr) + '</div>' +
        '<div class="cg3" style="margin-top:12px;align-items:end">' +
          '<div class="field" style="margin:0"><div class="fl">Symbol</div><input class="fi" id="in-sym" placeholder="XAUUSD"></div>' +
          '<div class="field" style="margin:0"><div class="fl">Value / point / lot</div><input class="fi" id="in-vpp" placeholder="100"></div>' +
          '<div class="field" style="margin:0"><div class="fl">Pip size</div><input class="fi" id="in-pip" placeholder="0.1"></div>' +
        '</div>' +
        '<button class="btn btn-gold btn-sm" style="margin-top:10px" onclick="addInstrument()">+ Add / Update instrument</button>' +
      '</div></div>';
}

function tagEditorCard(title, key, list, hint) {
  var tags = list.map(function(r, i){
    return '<span class="ptag sel" style="display:inline-flex;gap:6px;align-items:center">' + escapeHtml(r) +
      '<button onclick="removeTag(\'' + key + '\',' + i + ')" style="background:none;border:none;color:var(--red);cursor:pointer;font-weight:700;font-size:13px;line-height:1">×</button></span>';
  }).join('');
  return '<div class="card"><div class="card-h"><div class="card-t">' + title + '</div></div>' +
    '<div class="card-b"><div style="font-size:11px;color:var(--muted);margin-bottom:8px">' + hint + '</div>' +
    '<div class="ptags" id="tags-' + key + '">' + tags + '</div>' +
    '<div style="display:flex;gap:8px;margin-top:10px"><input class="fi" id="new-' + key + '" placeholder="Add a tag…" style="max-width:260px">' +
    '<button class="btn btn-ghost btn-sm" onclick="addTag(\'' + key + '\')">Add</button></div></div></div>';
}

function instrRows(instr) {
  var keys = Object.keys(instr).sort();
  if (!keys.length) return '<div class="empty">No instruments.</div>';
  return keys.map(function(k){
    var v = instr[k];
    var custom = PREFS.instruments && PREFS.instruments[k];
    return '<div class="tx-row"><div style="font-family:var(--mono);font-weight:700;width:90px">' + escapeHtml(k) + '</div>' +
      '<div style="font-family:var(--mono);font-size:11px;flex:1">$' + v.valuePerPoint + ' / point · pip ' + v.pip + (v.label?' · '+escapeHtml(v.label):'') + (custom?'':' <span style="color:var(--muted)">(default)</span>') + '</div>' +
      (custom ? '<button class="modal-x" style="font-size:16px" onclick="removeInstrument(\'' + k + '\')" title="Reset">&times;</button>' : '') + '</div>';
  }).join('');
}

/* ── actions ── */
function saveRiskDefaults() {
  var r = parseFloat(document.getElementById('set-risk').value);
  var l = parseFloat(document.getElementById('set-limit').value);
  apiSavePrefs({ defaultRiskPct: isFinite(r)?r:2, dailyLimitPct: isFinite(l)?l:6 }).then(function(){ toast('Saved','ok'); _afterMutation(); });
}
function addTag(key) {
  var inp = document.getElementById('new-' + key);
  var val = (inp.value||'').trim(); if (!val) return;
  var list = _prefList(key, key==='entryReasons'?DEFAULT_ENTRY_REASONS:DEFAULT_MISTAKE_TAGS);
  if (list.indexOf(val) < 0) list.push(val);
  var p = {}; p[key] = list;
  apiSavePrefs(p).then(function(){ renderSettings(); toast('Added','ok'); });
}
function removeTag(key, idx) {
  var list = _prefList(key, key==='entryReasons'?DEFAULT_ENTRY_REASONS:DEFAULT_MISTAKE_TAGS);
  list.splice(idx,1);
  var p = {}; p[key] = list;
  apiSavePrefs(p).then(function(){ renderSettings(); });
}
function addInstrument() {
  var sym = (document.getElementById('in-sym').value||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  var vpp = parseFloat(document.getElementById('in-vpp').value);
  var pip = parseFloat(document.getElementById('in-pip').value);
  if (!sym || !isFinite(vpp) || vpp<=0) { toast('Enter symbol & value/point','err'); return; }
  var instr = Object.assign({}, PREFS.instruments || {});
  instr[sym] = { valuePerPoint: vpp, pip: isFinite(pip)&&pip>0?pip:0.0001 };
  apiSavePrefs({ instruments: instr }).then(function(){ renderSettings(); toast('Saved '+sym,'ok'); });
}
function removeInstrument(sym) {
  var instr = Object.assign({}, PREFS.instruments || {});
  delete instr[sym];
  apiSavePrefs({ instruments: instr }).then(function(){ renderSettings(); });
}
