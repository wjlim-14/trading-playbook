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
