/* ============================================================
   J.TRADEBOOK — MINDSET
   Saved meaningful quotes + personal trading lessons.
   Featured hero (shuffle), filter chips, masonry cards.
   ============================================================ */

var WISDOM_CATS = [
  { key:'Mindset',    color:'#c79a3b' },
  { key:'Discipline', color:'#3f6ea5' },
  { key:'Risk',       color:'#b03030' },
  { key:'Patience',   color:'#2a7a50' },
  { key:'Psychology', color:'#8a5cc0' },
  { key:'Strategy',   color:'#2f9e9e' },
  { key:'Mistake',    color:'#c8791f' }
];
function wCatColor(c){ var m = WISDOM_CATS.find(function(x){ return x.key===c; }); return m ? m.color : 'var(--muted)'; }

var WFILTER = { kind:'ALL', cat:'ALL', text:'', fav:false };
var _wFeatured = null;

function renderMindset() {
  var el = document.getElementById('p-mindset');
  var all = WISDOM.slice();

  // ── empty state ──
  if (!all.length) {
    el.innerHTML =
      '<div class="mind-head"><div><h2 class="mind-t">Mindset</h2>' +
        '<div class="mind-sub">Save the quotes and lessons that keep you disciplined.</div></div>' +
        '<button class="btn btn-gold" onclick="wAdd()">+ Add</button></div>' +
      '<div class="mind-empty">' +
        '<div style="font-size:34px;margin-bottom:8px">🧠</div>' +
        '<div style="font-weight:600;margin-bottom:4px">Your wisdom wall is empty</div>' +
        '<div style="font-size:13px;color:var(--muted);margin-bottom:14px">Add a quote that inspires you, or a lesson a trade taught you.</div>' +
        '<button class="btn btn-gold" onclick="wAdd()">+ Add your first note</button>' +
      '</div>';
    return;
  }

  var filtered = wFiltered();
  var counts = { ALL: all.length, quote: all.filter(function(x){return x.kind==='quote';}).length,
                 lesson: all.filter(function(x){return x.kind==='lesson';}).length,
                 fav: all.filter(function(x){return x.favorite;}).length };

  // ── kind + favorite chips ──
  var kindChips = [['ALL','All ('+counts.ALL+')'],['quote','Quotes ('+counts.quote+')'],['lesson','Lessons ('+counts.lesson+')']].map(function(k){
    return '<button class="chip' + (WFILTER.kind===k[0]?' active':'') + '" onclick="wSetKind(\'' + k[0] + '\')">' + k[1] + '</button>';
  }).join('');
  var favChip = '<button class="chip' + (WFILTER.fav?' active':'') + '" onclick="wToggleFav()">★ Favorites (' + counts.fav + ')</button>';

  // ── category chips (only categories in use) ──
  var used = {}; all.forEach(function(x){ if (x.category) used[x.category]=1; });
  var catChips = '<button class="chip mini' + (WFILTER.cat==='ALL'?' active':'') + '" onclick="wSetCat(\'ALL\')">All topics</button>' +
    WISDOM_CATS.filter(function(c){ return used[c.key]; }).map(function(c){
      var on = WFILTER.cat===c.key;
      return '<button class="chip mini' + (on?' active':'') + '" style="' + (on?'background:'+c.color+';border-color:'+c.color+';color:#fff':'border-color:'+c.color+';color:'+c.color) + '" onclick="wSetCat(\'' + c.key + '\')">' + c.key + '</button>';
    }).join('');

  var cards = filtered.map(wCard).join('') ||
    '<div class="mind-empty" style="grid-column:1/-1">No notes match this filter.</div>';

  el.innerHTML =
    '<div class="mind-head"><div><h2 class="mind-t">Mindset</h2>' +
      '<div class="mind-sub">' + all.length + ' saved · quotes & lessons that keep you sharp</div></div>' +
      '<button class="btn btn-gold" onclick="wAdd()">+ Add</button></div>' +
    wHero(all) +
    '<div class="chips" style="margin-bottom:8px">' + kindChips + favChip + '</div>' +
    '<div class="chips" style="margin-bottom:12px">' + catChips + '</div>' +
    '<div class="searchbar" style="margin-bottom:16px"><input class="fi" placeholder="Search notes…" value="' + escapeHtml(WFILTER.text) + '" oninput="wSetText(this.value)"></div>' +
    '<div class="wgrid">' + cards + '</div>';
}

/* ── FEATURED HERO ── */
function wHero(all) {
  var pool = all;
  if (_wFeatured == null || _wFeatured >= pool.length) {
    var favs = pool.filter(function(x){ return x.favorite; });
    var src = favs.length ? favs : pool;
    var pick = src[Math.floor(Math.random()*src.length)];
    _wFeatured = pool.indexOf(pick);
  }
  var f = pool[_wFeatured]; if (!f) return '';
  var col = wCatColor(f.category);
  var by = f.kind==='quote' ? ('— ' + escapeHtml(f.author||'Unknown')) : escapeHtml(f.title||'Lesson learned');
  return '<div class="whero" style="--wc:' + col + '">' +
    '<div class="whero-badge">' + (f.kind==='quote'?'✦ Quote':'💡 Lesson') + (f.category?' · '+escapeHtml(f.category):'') + '</div>' +
    '<div class="whero-q">' + (f.kind==='quote'?'“':'') + escapeHtml(f.text) + (f.kind==='quote'?'”':'') + '</div>' +
    '<div class="whero-by">' + by + '</div>' +
    '<button class="whero-shuffle" onclick="wShuffle()" title="Show another">🔀 Shuffle</button>' +
  '</div>';
}
function wShuffle() {
  var all = WISDOM;
  if (all.length < 2) return;
  var next = _wFeatured;
  while (next === _wFeatured) next = Math.floor(Math.random()*all.length);
  _wFeatured = next;
  renderMindset();
}

/* ── CARD ── */
function wCard(x) {
  var col = wCatColor(x.category);
  var star = '<button class="wstar' + (x.favorite?' on':'') + '" title="Favorite" onclick="wFav(\'' + x.id + '\')">' + (x.favorite?'★':'☆') + '</button>';
  var menu = '<div class="wmenu">' +
    '<button title="Edit" onclick="wAdd(\'' + x.id + '\')">✎</button>' +
    '<button title="Delete" onclick="wDelete(\'' + x.id + '\')">🗑</button></div>';
  var cat = x.category ? '<span class="wcat" style="color:' + col + ';border-color:' + col + '">' + escapeHtml(x.category) + '</span>' : '';
  var date = '<span class="wdate">' + wShortDate(x.createdAt) + '</span>';

  if (x.kind === 'quote') {
    return '<div class="wcard wq" style="--wc:' + col + '">' + star + menu +
      '<div class="wq-mark">“</div>' +
      '<div class="wq-text">' + escapeHtml(x.text) + '</div>' +
      '<div class="wq-by">— ' + escapeHtml(x.author||'Unknown') + '</div>' +
      '<div class="wcard-foot">' + cat + date + '</div>' +
    '</div>';
  }
  return '<div class="wcard wl" style="--wc:' + col + '">' + star + menu +
    '<div class="wl-h"><span class="wl-ic">💡</span>' + escapeHtml(x.title || 'Lesson') + '</div>' +
    '<div class="wl-text">' + escapeHtml(x.text) + '</div>' +
    '<div class="wcard-foot">' + cat + date + '</div>' +
  '</div>';
}

/* ── FILTERS ── */
function wFiltered() {
  var q = (WFILTER.text||'').toLowerCase();
  return WISDOM.filter(function(x){
    if (WFILTER.kind !== 'ALL' && x.kind !== WFILTER.kind) return false;
    if (WFILTER.cat !== 'ALL' && x.category !== WFILTER.cat) return false;
    if (WFILTER.fav && !x.favorite) return false;
    if (q && (x.text+' '+(x.author||'')+' '+(x.title||'')).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}
function wSetKind(k){ WFILTER.kind=k; renderMindset(); }
function wSetCat(c){ WFILTER.cat=c; renderMindset(); }
function wToggleFav(){ WFILTER.fav=!WFILTER.fav; renderMindset(); }
function wSetText(v){ WFILTER.text=v; renderMindset(); }

/* ── ACTIONS ── */
function wFav(id) {
  var x = WISDOM.find(function(w){ return w.id===id; }); if (!x) return;
  apiUpdateWisdom({ id:id, favorite: !x.favorite }).then(function(){ renderMindset(); });
}
function wDelete(id) {
  var x = WISDOM.find(function(w){ return w.id===id; }); if (!x) return;
  openModal({ title:'Delete note?',
    body:'<p style="font-size:13px;color:var(--text2)">Remove this ' + (x.kind==='quote'?'quote':'lesson') + ' permanently?</p>' +
      '<div class="rep-note" style="margin-top:8px">' + escapeHtml(x.text.slice(0,140)) + (x.text.length>140?'…':'') + '</div>',
    footer:'<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>' +
           '<button class="btn btn-red" onclick="wConfirmDelete(\'' + id + '\')">Delete</button>' });
}
function wConfirmDelete(id) {
  apiDeleteWisdom(id).then(function(){ closeModal(); toast('Deleted','ok'); _wFeatured=null; renderMindset(); });
}

var _wEdit = null;
function wAdd(id) {
  _wEdit = id ? Object.assign({}, WISDOM.find(function(w){ return w.id===id; })) : { kind:'quote', text:'', author:'', title:'', category:'Mindset', favorite:false };
  openModal({
    title: id ? 'Edit note' : 'Add to Mindset',
    width: 560,
    body: '<div id="wform"></div>',
    footer:'<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>' +
           '<button class="btn btn-gold" onclick="wSave()">Save</button>',
    onMount: wPaintForm
  });
}
function wPaintForm() {
  var host = document.getElementById('wform'); if (!host) return;
  var e = _wEdit;
  var kindToggle =
    '<div class="rtog" style="margin-bottom:12px">' +
      '<button class="rtbtn' + (e.kind==='quote'?' active':'') + '" onclick="wSet(\'kind\',\'quote\')">✦ Quote</button>' +
      '<button class="rtbtn' + (e.kind==='lesson'?' active':'') + '" onclick="wSet(\'kind\',\'lesson\')">💡 Lesson</button>' +
    '</div>';
  var catOpts = WISDOM_CATS.map(function(c){ return '<option value="' + c.key + '"' + (e.category===c.key?' selected':'') + '>' + c.key + '</option>'; }).join('');
  var titleField = e.kind==='lesson'
    ? '<div class="field" style="margin-bottom:10px"><div class="fl">Title / headline</div><input class="fi" id="w-title" placeholder="e.g. No revenge trades" value="' + escapeHtml(e.title||'') + '" oninput="wSet(\'title\',this.value)"></div>' : '';
  var authorField = e.kind==='quote'
    ? '<div class="field" style="margin-bottom:10px"><div class="fl">Author / source</div><input class="fi" id="w-author" placeholder="e.g. Jesse Livermore" value="' + escapeHtml(e.author||'') + '" oninput="wSet(\'author\',this.value)"></div>' : '';

  host.innerHTML =
    kindToggle +
    titleField +
    '<div class="field" style="margin-bottom:10px"><div class="fl">' + (e.kind==='quote'?'Quote':'Lesson') + ' <span style="color:var(--red)">*</span></div>' +
      '<textarea class="rfinp" id="w-text" style="min-height:90px" placeholder="' + (e.kind==='quote'?'Type the quote…':'What did the trade teach you?') + '" oninput="wSet(\'text\',this.value)">' + escapeHtml(e.text||'') + '</textarea></div>' +
    authorField +
    '<div class="cg2"><div class="field"><div class="fl">Topic</div><select class="fi" id="w-cat" onchange="wSet(\'category\',this.value)">' + catOpts + '</select></div>' +
      '<div class="field"><div class="fl">Favorite</div>' +
        '<button class="btn btn-ghost btn-full" onclick="wSet(\'favorite\',' + (!e.favorite) + ');wPaintForm()">' + (e.favorite?'★ Favorited':'☆ Mark favorite') + '</button></div></div>';
}
function wSet(k, v) { _wEdit[k] = v; if (k==='kind') wPaintForm(); }
function wSave() {
  var e = _wEdit;
  var text = (e.text||'').trim();
  if (!text) { toast('Write something first','err'); return; }
  var payload = { kind:e.kind, text:text, author:(e.author||'').trim(), title:(e.title||'').trim(), category:e.category||'', favorite:!!e.favorite };
  var p = e.id ? apiUpdateWisdom(Object.assign({ id:e.id }, payload)) : apiCreateWisdom(payload);
  p.then(function(){ closeModal(); toast(e.id?'Updated':'Saved','ok'); _wFeatured=null; renderMindset(); })
   .catch(function(err){ toast('Failed: ' + err.message,'err'); });
}

/* ── util ── */
function wShortDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-GB',{ day:'2-digit', month:'short', year:'numeric' }); }
  catch (e) { return ''; }
}
