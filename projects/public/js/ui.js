/* ============================================================
   J.TRADEBOOK V2 — UI PRIMITIVES (modal, toast, helpers)
   ============================================================ */

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
  });
}

/* ── TOAST ── */
function toast(msg, type) {
  var wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  var el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(function(){ el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2200);
  setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 2600);
}

/* ── MODAL ── */
function openModal(opts) {
  // opts: { title, body (html), footer (html), onMount(fn) , width }
  var root = document.getElementById('modal-root');
  root.innerHTML =
    '<div class="modal-backdrop" id="modal-bd">' +
      '<div class="modal" style="' + (opts.width ? 'max-width:' + opts.width + 'px' : '') + '" onclick="event.stopPropagation()">' +
        '<div class="modal-h"><div class="modal-t">' + opts.title + '</div>' +
          '<button class="modal-x" onclick="closeModal()">&times;</button></div>' +
        '<div class="modal-b">' + (opts.body || '') + '</div>' +
        (opts.footer ? '<div class="modal-f">' + opts.footer + '</div>' : '') +
      '</div>' +
    '</div>';
  document.getElementById('modal-bd').addEventListener('click', closeModal);
  if (opts.onMount) opts.onMount();
}
function closeModal() {
  var root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
}

/* ── CLIPBOARD IMAGE PASTE ──
   Attach a paste handler to an element; on image paste, uploads and calls back
   with the public URL. Also supports click-to-choose-file. */
function wireChartSlot(el, onUrl) {
  function handleFile(file) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast('Image exceeds 3MB', 'err'); return; }
    var reader = new FileReader();
    reader.onload = function() {
      el.classList.add('uploading');
      var cap = el.querySelector('.cthumb-cap');
      if (cap) cap.textContent = 'Uploading…';
      apiUpload(reader.result, file.name || 'chart.png').then(function(url){
        if (url) { onUrl(url); toast('Chart uploaded', 'ok'); }
        else toast('Upload failed', 'err');
      }).catch(function(){ toast('Upload failed', 'err'); });
    };
    reader.readAsDataURL(file);
  }
  el.addEventListener('click', function(){
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = function(){ handleFile(inp.files[0]); };
    inp.click();
  });
  el.addEventListener('paste', function(e){
    var items = (e.clipboardData || {}).items || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') === 0) { handleFile(items[i].getAsFile()); e.preventDefault(); return; }
    }
  });
  el.setAttribute('tabindex', '0');
}

/* Global paste: routes an image paste to the currently focused/last-hovered slot. */
var _activeSlotCb = null;
document.addEventListener('paste', function(e){
  if (!_activeSlotCb) return;
  var items = (e.clipboardData || {}).items || [];
  for (var i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') === 0) {
      var file = items[i].getAsFile();
      if (file.size > 3*1024*1024) { toast('Image exceeds 3MB','err'); return; }
      var reader = new FileReader();
      reader.onload = function(){ apiUpload(reader.result, 'paste.png').then(function(url){ if(url) _activeSlotCb(url); }); };
      reader.readAsDataURL(file);
      e.preventDefault();
      return;
    }
  }
});

/* Wire every [data-slot="tradeId|field"] chart thumb inside root: click/paste
   uploads and PATCHes the trade field; [data-rm] clears it. onDone re-renders. */
function wireTradeSlots(root, onDone) {
  root.querySelectorAll('.cthumb[data-slot]').forEach(function(el){
    var parts = el.getAttribute('data-slot').split('|');
    var id = parts[0], field = parts[1];
    if (el.classList.contains('filled')) return;
    var patch = function(url){
      var p = { id: id }; p[field] = url;
      apiUpdateTrade(p).then(function(){ if (onDone) onDone(); });
    };
    wireChartSlot(el, patch);
    el.addEventListener('mouseenter', function(){ _activeSlotCb = patch; });
    el.addEventListener('focus', function(){ _activeSlotCb = patch; });
  });
  root.querySelectorAll('[data-rm]').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var parts = btn.getAttribute('data-rm').split('|');
      var p = { id: parts[0] }; p[parts[1]] = null;
      apiUpdateTrade(p).then(function(){ if (onDone) onDone(); });
    });
  });
}

/* renders a chart slot; filled shows the image, empty shows the placeholder */
function chartSlotHtml(url, label, slotId) {
  if (url) {
    return '<div class="cslot"><div class="cthumb filled" data-slot="' + slotId + '">' +
      '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(label) + '">' +
      '<button class="rm" data-rm="' + slotId + '">remove</button></div>' +
      '<div class="cslot-label">' + label + '</div></div>';
  }
  return '<div class="cslot"><div class="cthumb" data-slot="' + slotId + '">' +
    '<div class="cthumb-icon">📈</div><div class="cthumb-cap">' + label + ' · Ctrl+V</div></div>' +
    '<div class="cslot-label">' + label + '</div></div>';
}

/* ── FLEXIBLE CHART SCREENSHOTS (tagged by timeframe) ──
   shotsGridHtml renders a trade's pre/post screenshots as a grid: each shot
   shows the image + an editable timeframe tag + remove; an "add" tile lets
   you paste/upload more. wireShotSlots wires paste/upload/remove/tf-change
   and the High/Low timeframe pickers. */
function tfSelectHtml(dataAttr, val) {
  var opts = TF_OPTIONS.map(function(o){ return '<option value="' + o + '"' + (o===val?' selected':'') + '>' + o + '</option>'; }).join('');
  return '<select class="fi shot-tf" ' + dataAttr + '>' + opts + '</select>';
}
function tfPickerRow(t) {
  return '<div class="tf-pick">' +
    '<span class="fl" style="margin:0">Timeframes</span>' +
    '<label class="tf-lab">High' + tfSelectHtml('data-tfset="' + t.id + '|tfHigh"', tradeTfHigh(t)) + '</label>' +
    '<label class="tf-lab">Low' + tfSelectHtml('data-tfset="' + t.id + '|tfLow"', tradeTfLow(t)) + '</label>' +
  '</div>';
}
function shotsGridHtml(t, stage, editable) {
  var shots = stage==='pre' ? tradePreShots(t) : tradePostShots(t);
  var cells = shots.map(function(s, i){
    var tag = editable
      ? tfSelectHtml('data-shottf="' + t.id + '|' + stage + '|' + i + '"', s.tf||'')
      : '<span class="shot-tflabel">' + escapeHtml(s.tf||'—') + '</span>';
    return '<div class="cslot">' +
      '<div class="cthumb filled shotcell" data-shotview="' + t.id + '|' + stage + '|' + i + '">' +
        '<img src="' + escapeHtml(s.url) + '" alt="chart">' +
        (editable ? '<button class="rm" data-shotrm="' + t.id + '|' + stage + '|' + i + '">remove</button>' : '') +
      '</div><div class="shot-meta">' + tag + '</div></div>';
  }).join('');
  var add = editable
    ? '<div class="cslot"><div class="cthumb addshot" data-addshot="' + t.id + '|' + stage + '" tabindex="0">' +
        '<div class="cthumb-icon">＋</div><div class="cthumb-cap">Add · Ctrl+V</div></div>' +
        '<div class="shot-meta" style="opacity:.55;font-size:9px">paste or click</div></div>'
    : '';
  var inner = cells + add;
  if (!inner) inner = '<div class="empty" style="grid-column:1/-1;font-size:11px;padding:8px">No screenshots.</div>';
  return '<div class="shotgrid">' + inner + '</div>';
}
function viewShot(url) {
  openModal({ title:'Chart', body:'<img src="' + escapeHtml(url) + '" style="width:100%;border-radius:6px;display:block">',
    footer:'<button class="btn btn-ghost" onclick="closeModal()">Close</button>' });
}

/* Persist mutations (works in demo + live via apiUpdateTrade). */
function _shotField(stage){ return stage==='pre' ? 'preShots' : 'postShots'; }
function _shotArr(t, stage){ return (stage==='pre' ? tradePreShots(t) : tradePostShots(t)).slice(); }
function addShot(id, stage, url) {
  var t = TRADES.find(function(x){ return x.id===id; }); if (!t) return Promise.resolve();
  var arr = _shotArr(t, stage);
  arr.push({ url:url, tf: tradeTfHigh(t), note:'' });
  var p = { id:id }; p[_shotField(stage)] = arr;
  return apiUpdateTrade(p);
}
function removeShot(id, stage, idx, onDone) {
  var t = TRADES.find(function(x){ return x.id===id; }); if (!t) return;
  var arr = _shotArr(t, stage); arr.splice(idx,1);
  var p = { id:id }; p[_shotField(stage)] = arr;
  apiUpdateTrade(p).then(function(){ if (onDone) onDone(); });
}
function setShotTf(id, stage, idx, tf, onDone) {
  var t = TRADES.find(function(x){ return x.id===id; }); if (!t) return;
  var arr = _shotArr(t, stage); if (!arr[idx]) return; arr[idx].tf = tf;
  var p = { id:id }; p[_shotField(stage)] = arr;
  apiUpdateTrade(p).then(function(){ if (onDone) onDone(); });
}
function wireShotSlots(root, onDone) {
  if (!root) return;
  root.querySelectorAll('.cthumb[data-addshot]').forEach(function(el){
    var parts = el.getAttribute('data-addshot').split('|');
    var id = parts[0], stage = parts[1];
    var cb = function(url){ addShot(id, stage, url).then(function(){ if (onDone) onDone(); }); };
    wireChartSlot(el, cb);
    el.addEventListener('mouseenter', function(){ _activeSlotCb = cb; });
    el.addEventListener('focus', function(){ _activeSlotCb = cb; });
  });
  root.querySelectorAll('[data-shotrm]').forEach(function(btn){
    btn.addEventListener('click', function(e){ e.stopPropagation();
      var p = btn.getAttribute('data-shotrm').split('|'); removeShot(p[0], p[1], +p[2], onDone);
    });
  });
  root.querySelectorAll('[data-shottf]').forEach(function(sel){
    sel.addEventListener('click', function(e){ e.stopPropagation(); });
    sel.addEventListener('change', function(){
      var p = sel.getAttribute('data-shottf').split('|'); setShotTf(p[0], p[1], +p[2], sel.value, onDone);
    });
  });
  root.querySelectorAll('[data-shotview]').forEach(function(el){
    el.addEventListener('click', function(){
      var p = el.getAttribute('data-shotview').split('|');
      var t = TRADES.find(function(x){ return x.id===p[0]; }); if (!t) return;
      var arr = p[1]==='pre' ? tradePreShots(t) : tradePostShots(t);
      var s = arr[+p[2]]; if (s) viewShot(s.url);
    });
  });
  root.querySelectorAll('[data-tfset]').forEach(function(sel){
    sel.addEventListener('click', function(e){ e.stopPropagation(); });
    sel.addEventListener('change', function(){
      var p = sel.getAttribute('data-tfset').split('|');
      var patch = { id:p[0] }; patch[p[1]] = sel.value;
      apiUpdateTrade(patch).then(function(){ if (onDone) onDone(); });
    });
  });
}
