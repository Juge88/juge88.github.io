'use strict';
/* Bench — piece log, stories, listings, QR tags, template catalog, board and bowl designers, wood stock. */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(3, '0');
const today = () => new Date().toISOString().slice(0, 10);
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const clone = o => JSON.parse(JSON.stringify(o));
const bridge = window.Android || null;
const APP_VERSION = '1.8.6';

/* ---------- Storage ---------- */
const KEY = 'bench.v1';
let S;
function load() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  S = raw || {};
  S.pieces ??= [];
  S.templates ??= [];
  S.finishes ??= structuredClone(DEFAULT_FINISHES);
  S.settings = Object.assign(structuredClone(DEFAULT_SETTINGS), S.settings || {});
  S.printed ??= {};
  S.tplEdits ??= {};
  S.hiddenTpls ??= [];
  S.hiddenGroups ??= [];
  S.woodEdits ??= {};
  S.kinds ??= structuredClone(DEFAULT_KINDS);
  S.stock ??= {};
  S.projects ??= [];
  migrate();
}
function migrate() {
  const v = S.version || 1;
  if (v < 2) {
    // 1.0 kept every wood in S.woods. Library woods move to the shop list; custom ones stay.
    const libIds = new Set(WOOD_LIBRARY.map(w => w[0]));
    const old = S.woods || [];
    S.shop = old.length ? old.filter(w => libIds.has(w.id)).map(w => w.id) : DEFAULT_SHOP.slice();
    S.woods = old.filter(w => !libIds.has(w.id)).map(w => ({ ...w, custom: true }));
    S.woods.forEach(w => S.shop.includes(w.id) || S.shop.push(w.id));
    // Spoon and spatula become one "Kitchen tool" type named by its head
    const custom = (S.types || []).filter(t => !DEFAULT_TYPES.some(d => d.id === t.id) && !['spoon', 'spatula'].includes(t.id));
    S.types = [...structuredClone(DEFAULT_TYPES), ...custom];
    S.pieces.forEach(p => {
      if (p.type === 'spoon' || p.type === 'spatula') p.type = 'kitchen';
      p.buildPhotos ??= []; p.special ??= '';
    });
    const oldGroups = (S.groups || []).filter(g => !DEFAULT_GROUPS.some(d => d.id === g.id));
    S.groups = [...structuredClone(DEFAULT_GROUPS), ...oldGroups];
    if (S.previewWoods) S.previewWoods = S.previewWoods.filter(id => woodById(id));
    S.version = 2; save();
  }
  if ((S.version || 1) < 3) {
    const k = (S.types || []).find(t => t.id === 'knife'), d = DEFAULT_TYPES.find(t => t.id === 'knife');
    if (k && k.care === OLD_DEFAULTS.knifeCare) k.care = d.care;
    if (k && k.build === OLD_DEFAULTS.knifeBuild) k.build = d.build;
    S.version = 3; save();
  }
  if ((S.version || 1) < 4) {
    const d = DEFAULT_TYPES.find(t => t.id === 'bowl');
    if (d && !(S.types || []).some(t => t.id === 'bowl')) { S.types ||= []; const i = S.types.findIndex(t => t.id === 'pushpull'); S.types.splice(i < 0 ? S.types.length : i, 0, structuredClone(d)); }
    S.version = 4; save();
  }
  if ((S.version || 1) < 5) {
    S.types ??= structuredClone(DEFAULT_TYPES);
    S.settings.grain ??= true;
    S.version = 5; save();
  }
  if ((S.version || 1) < 6) {
    // 1.7: boards snap to whole blocks, brick gets real mortar, two-step boards are end grain
    S.types ??= structuredClone(DEFAULT_TYPES);
    S.pieces.forEach(p => {
      if (!typeById(p.type).board) return;
      const old = p.board || null;
      p.board = BD.upgrade(old, p.woods || []);
      if (old && old.done) p.board.done = BD.doneIds(old, BD.cutList(p.board).steps);
      p.woods = BD.woods(p.board);
    });
    S.stock ??= {};
    S.version = 6; save();
  }
  if ((S.version || 1) < 7) {
    // The dovetail is only in the 3D-printed templates, not in the wood, so the story no longer says it
    const k = (S.types || []).find(t => t.id === 'kitchen'), d = DEFAULT_TYPES.find(t => t.id === 'kitchen');
    if (k && d && k.build === OLD_DEFAULTS.kitchenBuild) k.build = d.build;
    S.version = 7; save();
  }
  GR.on = S.settings.grain !== false;
  S.shop ??= DEFAULT_SHOP.slice();
  S.woods ??= [];
  S.types ??= structuredClone(DEFAULT_TYPES);
  S.groups ??= structuredClone(DEFAULT_GROUPS);
  S.previewWoods = (S.previewWoods && S.previewWoods.length) ? S.previewWoods : ['walnut', 'maple', 'walnut', 'cherry', 'walnut', 'maple', 'walnut'];
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Could not save. Storage is full; back up and remove old photos.'); }
}

const db = new Promise((res, rej) => {
  const r = indexedDB.open('bench-photos', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('p');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
async function photoPut(id, dataUrl) { const d = await db; return new Promise((res, rej) => { const t = d.transaction('p', 'readwrite'); t.objectStore('p').put(dataUrl, id); t.oncomplete = res; t.onerror = rej; }); }
async function photoGet(id) { const d = await db; return new Promise(res => { const r = d.transaction('p').objectStore('p').get(id); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); }); }
async function photoDel(id) { const d = await db; return new Promise(res => { const t = d.transaction('p', 'readwrite'); t.objectStore('p').delete(id); t.oncomplete = res; t.onerror = res; }); }
async function fillPhotos(root = document) {
  for (const img of $$('img[data-photo]', root)) { const src = await photoGet(img.dataset.photo); if (src) img.src = src; else img.remove(); }
}

/* ---------- Lookups ---------- */
const LIB = WOOD_LIBRARY.map(([id, name, color, color2, origin, story]) => ({ id, name, color, color2, origin, story, janka: (typeof WOOD_JANKA !== 'undefined' && WOOD_JANKA[id]) || null }));
const lbf = n => n ? Number(n).toLocaleString('en-US') + ' lbf' : '';
function woodById(id) {
  const c = (S.woods || []).find(w => w.id === id); if (c) return c;
  const l = LIB.find(w => w.id === id); return l ? { ...l, ...(S.woodEdits?.[id] || {}) } : null;
}
const woodName = id => woodById(id)?.name || id;
function editDist(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j), cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
// Search woods by name, other names and origin; when nothing matches, offer close spellings ("did you mean").
function findWoods(q, pool = allWoods()) {
  q = norm(q); if (!q) return { hits: pool, guesses: [] };
  const names = w => [w.name, ...((typeof WOOD_ALIASES !== 'undefined' && WOOD_ALIASES[w.id]) || [])].map(norm);
  const hits = pool.filter(w => names(w).some(n => n.includes(q)) || norm(w.origin).includes(q));
  hits.sort((a, b) => (norm(a.name).startsWith(q) ? 0 : 1) - (norm(b.name).startsWith(q) ? 0 : 1) || a.name.localeCompare(b.name));
  if (hits.length) return { hits, guesses: [] };
  if (/\s?wood$/.test(q) && q.replace(/\s?wood$/, '').length > 2) { const r = findWoods(q.replace(/\s?wood$/, ''), pool); if (r.hits.length) return r; }
  const scored = pool.map(w => {
    let best = Infinity;
    for (const n of names(w)) {
      best = Math.min(best, editDist(q, n), editDist(q, n.slice(0, q.length + 1)) + 0.5);
      for (const word of n.split(' ')) if (word.length > 3) best = Math.min(best, editDist(q, word) + 0.3);
    }
    return { w, d: best };
  }).filter(x => x.d <= Math.max(1.5, q.length * 0.34)).sort((a, b) => a.d - b.d);
  return { hits: [], guesses: scored.slice(0, 4).map(x => x.w) };
}
const woodSub = w => [w.origin, w.janka ? lbf(w.janka) : '', stockOf(w.id).bf != null ? `${fmtBf(stockOf(w.id).bf)} bd ft on hand` : ''].filter(Boolean).join(' · ');
const swatch = (w, size = 32, r = 9) => `<span class="sw" style="width:${size}px;height:${size}px;border-radius:${r}px;flex:none;background:linear-gradient(90deg,${w.color},${w.color2 || w.color});box-shadow:inset 0 0 0 1px #0005"></span>`;
const woodRow = (w, extra = '') => `${swatch(w)}<div class="grow"><div class="t">${esc(w.name)}</div><div class="s">${esc(woodSub(w))}</div></div>${extra}`;
const allWoods = () => [...LIB.map(w => woodById(w.id)), ...S.woods].sort((a, b) => a.name.localeCompare(b.name));
const shopWoods = () => S.shop.map(woodById).filter(Boolean);
// Removed built-in templates stay findable by id, so pieces that used them still draw
function allTemplates(withHidden) {
  const custom = new Map(S.templates.map(t => [t.id, t]));
  const out = BUILTIN_TEMPLATES.filter(t => !custom.has(t.id) && (withHidden || !S.hiddenTpls.includes(t.id))).map(t => ({ ...t, ...(S.tplEdits[t.id] || {}) }));
  return [...out, ...S.templates];
}
const tplById = id => allTemplates(true).find(t => t.id === id);
const typeById = id => S.types.find(t => t.id === id) || { id, name: 'Piece', noun: 'piece', slots: [], join: 'none', build: '', care: '' };
const liveGroups = () => S.groups.filter(g => !(S.hiddenGroups || []).includes(g.id));
const groupById = id => S.groups.find(g => g.id === id) || { id, name: id, prefix: '' };
const kindById = id => S.kinds.find(k => k.id === id);
const finishByName = n => S.finishes.find(f => f.name === n);
// widths (inches, one per strip) make strips their real thickness; without them strips share the blank evenly
const colorsOf = (ids, widths, cols) => { const ws = (ids && ids.length ? ids : ['maple']).map((id, i) => { const w = woodById(id); let o = w && widths && widths[i] > 0 ? { ...w, w: widths[i] } : w; if (o && cols && cols[i]) o = { ...o, color: cols[i][0], color2: cols[i][1] || cols[i][0] }; return o; }).filter(Boolean); return ws.length ? ws : [{ color: '#c9a57a', color2: '#d4b088' }]; };
// Colors taken from a photo of the real piece. They only count while the strips are still the ones that photo made.
const colsValid = p => p.cols && p.cols.length === p.woods.length && p.colsSig === p.woods.join(',');
const colsOf = p => colorsOf(p.woods, stripW(p), colsValid(p) ? p.cols : null);
const stripW = p => p.widths && p.widths.length === p.woods.length ? p.widths : null;
const pieceTpls = p => typeById(p.type).slots.map(s => tplById((p.templates || {})[s.name])).filter(Boolean);

function headKind(p) {
  const t = typeById(p.type); if (!t.byKind) return null;
  const head = pieceTpls(p).find(x => x.group === 'kitchen-head' || x.kind);
  return head && head.kind ? (kindById(head.kind) || { id: head.kind, name: cap(head.kind), noun: head.kind, care: '' }) : null;
}
function typeName(p) { const k = headKind(p); return k ? k.name : typeById(p.type).name; }
function nounOf(p) { const k = headKind(p); return k ? k.noun : typeById(p.type).noun; }
function careOf(p) {
  const t = typeById(p.type), k = headKind(p);
  if (k && k.care) return k.care;
  if (t.board && p.board && (p.board.style === 'end' || p.board.style === 'multi') && t.care === CARE.board) return CARE['board-end'];
  if (t.bowl && p.bowl && p.bowl.kind === 'epoxy' && t.care === CARE.bowl) return CARE['bowl-epoxy'];
  return t.care;
}
const pieceTitle = p => `${typeName(p)} No. ${pad(p.no)}`;

/* ---------- Wood stock and money ---------- */
const ROUGH = 1.3;   // rough lumber to milled stock: about 30% goes to jointing, planing and ripping
const stockOf = id => (S.stock && S.stock[id]) || {};
const fmtBf = n => (Math.round(n * 10) / 10).toLocaleString('en-US');
const num$ = v => { const n = parseFloat(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : null; };
const fmt$ = n => '$' + Math.round(n).toLocaleString('en-US');
// Milled board feet the piece needs per wood, from its cut list
function woodNeeds(p) {
  const t = typeById(p.type);
  if (t.board && p.board) return BD.cutList(p.board).woods.map(e => ({ wood: e.wood, bf: e.bf }));
  if (t.bowl && p.bowl && p.bowl.kind === 'seg') {
    const c = B.cutList(p.bowl), out = c.woods.map(e => ({ wood: e.wood, bf: e.length * e.width * e.thick / 144 }));
    if (c.base) { const e = out.find(x => x.wood === c.base.wood); const bf = c.base.size * c.base.size * c.base.thick / 144; if (e) e.bf += bf; else out.push({ wood: c.base.wood, bf }); }
    return out;
  }
  return [];
}
// Wood cost: what you entered, or an estimate from the cut list when every wood has a price
function woodCost(p) {
  const typed = num$(p.cost); if (typed != null && String(p.cost).trim() !== '') return { v: typed, est: false };
  const needs = woodNeeds(p); if (!needs.length) return null;
  let sum = 0; for (const n of needs) { const c = stockOf(n.wood).cost; if (!(c > 0)) return null; sum += n.bf * ROUGH * c; }
  return { v: sum, est: true };
}

// Woods that read well together: keep the first, then whichever contrasts most with it
function contrastPair(ids) {
  const ws = (ids || []).map(woodById).filter(Boolean); if (ws.length < 2) return ids || [];
  const a = ws[0]; let best = ws[1], d = -1;
  for (const w of ws.slice(1, 8)) { const x = Math.abs(lum(w.color) - lum(a.color)); if (x > d) { d = x; best = w; } }
  return [a.id, best.id, ...ids.filter(i => i !== a.id && i !== best.id)];
}
const newBoard = () => BD.defaults(contrastPair(S.shop));

/* ---------- Fractions ---------- */
function fracParts(x, den = 16) { x = +x || 0; let w = Math.floor(x + 1e-9), n = Math.round((x - w) * den), d = den; if (n === d) { w++; n = 0; } while (n && n % 2 === 0) { n /= 2; d /= 2; } return { w, n, d }; }
const onGrid = (x, den = 16) => Math.abs(x * den - Math.round(x * den)) < 1e-6;
// 16.5 -> 16½″ set as a real fraction; values off the 1/16 grid show as decimals
function fracHTML(x, unit = '″') {
  x = +x || 0;
  if (!onGrid(x)) return `${+x.toFixed(3)}${unit}`;
  const { w, n, d } = fracParts(x);
  return `${w || !n ? w : ''}${n ? `<span class="fr${w ? '' : ' solo'}"><span class="nu">${n}</span><span class="sl">⁄</span><span class="de">${d}</span></span>` : ''}${unit}`;
}
const measBtn = (id, label, v, cls = '') => `<button class="meas ${cls}" id="${id}"><span class="ml">${esc(label)}</span><span class="mv">${fracHTML(v)}</span></button>`;

/* ---------- Drawing ---------- */
function pieceArt(p, mode = 'finished') {
  const t = typeById(p.type);
  if (t.bowl) return p.bowl ? B.side(p.bowl, woodById) : '';
  if (t.board) return p.board ? BD.draw(p.board, woodById, seedOf(p)) : '';
  const ts = pieceTpls(p); if (!ts.length) return '';
  return D.piece(D.assemble(ts), colsOf(p), mode, p.angle || 0);
}
// A part you print (not cut from wood) is drawn as solid plastic in its filament color
// Every template is a 3D print unless you switch it to wood. wood = true draws it in the piece's woods instead (used while building a piece).
const FIL_DEFAULT = '#00ae42';
const FILAMENTS = [['#00ae42', 'Bambu Green'], ['#3d4147', 'Black'], ['#8e9399', 'Gray'], ['#e8e4dc', 'White'], ['#223626', 'Dark green'], ['#c8643c', 'Orange'], ['#2f5f8a', 'Blue'], ['#a8322d', 'Red'], ['#d8b43c', 'Yellow']];
const tplArt = (t, ids, widths, wood, cols) => t && t.print !== false && !wood ? D.single(t, [{ color: t.printColor || FIL_DEFAULT, print: true }]) : D.single(t, colorsOf(ids, widths, cols));
const stripHTML = (ids, widths) => `<div class="strip">${colorsOf(ids, widths).map(w => `<i style="background:${w.color};flex:${w.w || 1}"></i>`).join('')}</div>`;
function seedOf(p) { let h = 2166136261; for (const c of String(p.id) + p.no) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }

/* ---------- Story ---------- */
const joinList = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
function uniqWoods(ids) { const seen = new Set(); return ids.filter(i => !seen.has(i) && seen.add(i)).map(woodById).filter(Boolean); }
function monthYear(d) { try { return new Date(d + 'T12:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); } catch (e) { return ''; } }
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? '');
const lum = hex => { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
const ordinal = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const an = w => /^[aeiou]/i.test(w || '') ? 'an' : 'a';

// Bench only knows about pieces you logged. If your numbering starts above 1, earlier pieces are missing,
// so it can't promise a combination is a first. You say so for each piece instead.
function historyKnown() { const nos = S.pieces.map(q => q.no); return nos.length ? Math.min(...nos) <= 1 : (S.settings.nextNumber || 1) <= 1; }
function comboKey(ids) { return [...new Set(ids)].sort().join('+'); }
function comboBefore(p) { const key = comboKey(p.woods); return S.pieces.filter(q => q.id !== p.id && q.no < p.no && comboKey(q.woods) === key).length; }
// true = say it's the first with this combination; false = say nothing
function comboIsFirst(p) {
  if (p.firstCombo === true) return true;
  if (p.firstCombo === false) return false;
  return historyKnown() && comboBefore(p) === 0;
}
function laminationNotes(p) {
  if (p.woods.length < 2) return [];
  if (p.firstCombo === true) return ['It is the first piece from the shop with this combination of woods.'];
  if (p.firstCombo === false || !historyKnown()) return [];
  const before = comboBefore(p);
  return [before === 0 ? 'It is the first piece from the shop with this combination of woods.' : `It is only the ${ordinal(before + 1)} piece from the shop with this mix of woods.`];
}
// The board's own sentences: how it's laid out, its size, and its finishing touches
function boardStory(bd) {
  const out = [], lc = s => String(s).toLowerCase(), size = `${BD.frac(BD.lengthOf(bd))} × ${BD.frac(BD.widthOf(bd))}`;
  const key = bd.style === 'end' ? (bd.pattern === 'chaos' ? 'chaos' : 'end') : bd.style === 'multi' ? 'end' : bd.style;
  const st = BOARD_STYLES.find(x => x.id === key); if (st) out.push(st.story);
  if (bd.style === 'multi') out.push(`It was built in two glue-ups: strips glued into panels, then sliced, turned end grain up and reassembled into ${an(bd.name || 'custom')} ${lc(bd.name || 'custom')} pattern, ${BD.blocks(bd)} pieces of wood in all, about ${size}.`);
  else if (bd.style === 'end' && bd.pattern === 'brick') {
    const bricks = [...new Set(bd.strips.map(s => s.wood))].map(id => lc(woodName(id)));
    out.push(bd.joint > 0 ? `Its bricks of ${joinList(bricks)} are set in a running bond with ${lc(woodName(bd.mortar))} mortar lines, ${BD.blocks(bd)} pieces of wood in all, about ${size}.` : `Its bricks of ${joinList(bricks)} are laid in a running bond, ${BD.blocks(bd)} pieces of wood in all, about ${size}.`);
  }
  else if (bd.style === 'end' && bd.pattern !== 'chaos') out.push(`Its ${BD.blocks(bd)} end-grain blocks are laid out in ${an(BD.PATTERNS[bd.pattern].name)} ${lc(BD.PATTERNS[bd.pattern].name)} pattern, about ${size}.`);
  else out.push(`It is about ${size} and ${BD.frac(bd.T)} thick.`);
  const touches = [];
  if (bd.groove) touches.push('A juice groove runs around the top to catch drips.');
  if (bd.grips) touches.push('Finger grips are routed into the ends so it is easy to pick up.');
  if (bd.feet) touches.push('Rubber feet keep it from sliding on the counter and let air reach the bottom.');
  if (bd.profile === 'round') touches.push('Its edges are rounded over, so it is comfortable to handle.');
  if (bd.profile === 'chamfer') touches.push('Its edges are chamfered for a crisp, clean look.');
  if (touches.length) out.push(touches.join(' '));
  return out;
}

function genStory(p) {
  const st = S.settings, type = typeById(p.type);
  let rnd = seedOf(p); const pick = a => a[((rnd = (Math.imul(rnd, 1103515245) + 12345) >>> 0) >>> 8) % a.length];
  const woods = uniqWoods(p.woods), lc = s => s.toLowerCase();
  const by = st.shop ? `in the ${st.shop} shop` : (st.maker ? `by ${st.maker}` : 'by hand');
  const parts = [];
  parts.push(fill(pick(PHRASES.open), { noun: nounOf(p), no: pad(p.no), by, when: p.date ? ` in ${monthYear(p.date)}` : '' }));
  if (p.special && p.special.trim()) parts.push(p.special.trim().replace(/([^.!?])$/, '$1.'));
  const hardLine = () => {
    const hardest = [...woods].sort((a, b) => (b.janka || 0) - (a.janka || 0))[0];
    if (hardest && hardest.janka >= 2500) parts.push(`With a Janka hardness of about ${Number(hardest.janka).toLocaleString('en-US')} pounds-force, the ${lc(hardest.name)} is ${hardest.janka >= 2900 ? 'about twice as hard as hard maple' : 'far harder than hard maple'}.`);
  };
  if (type.bowl && p.bowl) {
    const bw = p.bowl, names = joinList(woods.map(w => lc(w.name)));
    if (bw.kind === 'seg') parts.push(`It is a segmented bowl: ${B.pieceCount(bw)} pieces of ${names} cut and glued into ${bw.rings.length} rings on a solid base, then turned on the lathe.`);
    else parts.push(`It was turned from a single blank of ${names}${bw.kind === 'epoxy' ? `, with ${bw.epoxy ? lc(bw.epoxy) + ' ' : ''}epoxy filling its cracks and voids.` : '.'}`);
    parts.push(`Its shape is ${(B.SHAPES[bw.shape] || B.SHAPES.open).phrase}, about ${bowlSize(bw)}.`);
    woods.forEach(w => { if (w.story) { const i = pick(PHRASES.woodIntro); parts.push((i ? fill(i, { wood: lc(w.name) }) : '') + w.story); } });
    hardLine();
  } else if (woods.length) {
    const bd = type.board && p.board, blocks = bd && bd.style === 'end', multi = bd && bd.style === 'multi';
    const first = multi ? `It is made from ${joinList(woods.map(w => lc(w.name)))}.` : blocks ? `It is built from blocks of ${joinList(woods.map(w => lc(w.name)))}.`
      : p.woods.length > 1
      ? fill(pick(PHRASES.strips), { n: p.woods.length, woods: joinList(woods.map(w => lc(w.name))) })
      : fill(pick(PHRASES.solid), { wood: lc(woods[0].name) });
    parts.push([cap(first), ...(blocks || multi ? laminationNotes(p).slice(-1) : laminationNotes(p))].join(' '));
    woods.forEach(w => { if (w.story) { const i = pick(PHRASES.woodIntro); parts.push((i ? fill(i, { wood: lc(w.name) }) : '') + w.story); } });
    hardLine();
  }
  if (type.board && p.board) parts.push(...boardStory(p.board));
  type.slots.forEach(s => {
    const t = tplById((p.templates || {})[s.name]);
    if (t && t.inspiration) parts.push(`Its ${lc(s.name)} is the ${t.name}. ${t.inspiration}`);
  });
  if (type.build) parts.push(type.build);
  const fin = finishByName(p.finish); if (fin && fin.story) parts.push(fin.story);
  const care = careOf(p); if (care) parts.push('Care: ' + care);
  parts.push(pick(PHRASES.closing) + (st.maker ? `\n— ${st.maker}` : ''));
  return parts.join('\n\n');
}
const storyOf = p => p.storyEdited && p.story ? p.story : genStory(p);

const featList = bd => [bd.groove && 'juice groove', bd.grips && 'finger grips', bd.feet && 'rubber feet', bd.profile === 'round' && 'rounded edges', bd.profile === 'chamfer' && 'chamfered edges'].filter(Boolean);
function claudePrompt(p) {
  const t = typeById(p.type), lines = [];
  lines.push(`Write the story card for a handmade ${nounOf(p)} I'm selling. It's for the buyer, who will read it after scanning a QR tag. Warm and specific, about 150 to 220 words, short paragraphs, no headings or bullet points. Only use the facts below; don't invent any. Keep the care instructions at the end, starting with "Care:". Sign it from ${S.settings.maker || 'the maker'}.`);
  lines.push('');
  lines.push(`Piece: ${typeName(p)} No. ${pad(p.no)}${p.date ? ', made ' + monthYear(p.date) : ''}`);
  if (p.woods.length) lines.push(`${t.board || t.bowl ? 'Woods' : 'Strips, in order'}: ${p.woods.map((i, k) => woodById(i)?.name + (stripW(p) && !t.board && !t.bowl ? ` (${BD.frac(p.widths[k])})` : '')).join(', ')}`);
  uniqWoods(p.woods).forEach(w => w.story && lines.push(`About ${w.name}: ${w.story}`));
  t.slots.forEach(s => { const x = tplById((p.templates || {})[s.name]); if (x) lines.push(`${s.name}: ${x.name}${x.inspiration ? ' — ' + x.inspiration : ''}`); });
  if (t.board && p.board) { lines.push(`Board: ${boardTitle(p.board)}, ${BD.frac(BD.lengthOf(p.board))} x ${BD.frac(BD.widthOf(p.board))} x ${BD.frac(p.board.T)}`); const f = featList(p.board); if (f.length) lines.push(`Finishing touches: ${f.join(', ')}`); }
  if (t.bowl && p.bowl) lines.push(`Bowl: ${p.bowl.kind === 'seg' ? `segmented, ${B.pieceCount(p.bowl)} pieces in ${p.bowl.rings.length} rings` : p.bowl.kind === 'epoxy' ? 'solid with epoxy fill' : 'turned from one solid blank'}, about ${bowlSize(p.bowl)}`);
  if (p.special) lines.push(`What's special about it: ${p.special}`);
  if (p.finish) lines.push(`Finish: ${p.finish}`);
  lines.push(`Care: ${careOf(p)}`);
  lines.push('');
  lines.push('Here is my current draft for reference:');
  lines.push(storyOf(p));
  return lines.join('\n');
}

function genListing(p) {
  const st = S.settings, t = typeById(p.type), woods = uniqWoods(p.woods).map(w => w.name), L = [];
  L.push(`Handmade ${typeName(p).toLowerCase()}${woods.length ? ' — ' + joinList(woods) : ''}`);
  L.push('');
  L.push(`One of a kind and numbered (No. ${pad(p.no)}). Made by hand, start to finish.`);
  if (p.special) L.push(p.special.trim());
  L.push('');
  if (woods.length) L.push(`• Woods: ${joinList(woods.map(w => w.toLowerCase()))}${p.woods.length > 1 && !t.bowl && !t.board ? ` (${p.woods.length} laminated strips)` : ''}`);
  t.slots.forEach(s => { const x = tplById((p.templates || {})[s.name]); if (x) L.push(`• ${s.name}: ${x.name}`); });
  if (t.bowl && p.bowl) {
    L.push(`• ${p.bowl.kind === 'seg' ? `Segmented: ${B.pieceCount(p.bowl)} pieces in ${p.bowl.rings.length} rings + base` : p.bowl.kind === 'epoxy' ? `Solid ${uniqWoods(p.woods).map(w => w.name.toLowerCase()).join(', ')} with ${p.bowl.epoxy ? p.bowl.epoxy.toLowerCase() + ' ' : ''}epoxy` : 'Turned from one solid blank'}`);
    L.push(`• Size: about ${B.frac(p.bowl.D)} across × ${B.frac(p.bowl.H)} tall`);
  }
  if (t.board && p.board) {
    const bd = p.board;
    L.push(`• ${boardTitle(bd)}${bd.style !== 'edge' ? ` · ${BD.blocks(bd)} pieces` : ''}`);
    L.push(`• Size: ${BD.frac(BD.lengthOf(bd))} × ${BD.frac(BD.widthOf(bd))} × ${BD.frac(bd.T)}`);
    const f = featList(bd); if (f.length) L.push(`• ${cap(joinList(f))}`);
  }
  if (p.finish && p.finish !== 'Unfinished') L.push(`• Finish: ${p.finish}${/rubio|mineral|butter|food/i.test(p.finish) ? ' (food safe)' : ''}`);
  if (p.size) L.push(`• Size: ${p.size}`);
  if (st.pageUrl) L.push('• Comes with a QR tag that tells its story');
  if (p.price) { L.push(''); L.push(`$${String(p.price).replace(/^\$/, '')}`); }
  if (st.listingEnd) { L.push(''); L.push(st.listingEnd); }
  return L.join('\n');
}

/* ---------- QR ---------- */
const b64url = bytes => { let s = ''; bytes.forEach(b => s += String.fromCharCode(b)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
async function deflate(str) {
  const out = new Response(new Blob([new TextEncoder().encode(str)]).stream().pipeThrough(new CompressionStream('deflate-raw')));
  return new Uint8Array(await out.arrayBuffer());
}
function pagePayload(p) {
  const t = typeById(p.type), st = S.settings, ts = pieceTpls(p);
  const o = {
    v: 2, n: p.no, t: typeName(p),
    w: p.woods.map((id, i) => { const w = woodById(id); if (!w) return null; if (colsValid(p)) return [w.name, p.cols[i][0], p.cols[i][1] || p.cols[i][0]]; return LIB.some(l => l.id === id) && !S.woodEdits[id] ? id : [w.name, w.color, w.color2 || w.color]; }).filter(Boolean),
    d: p.date ? monthYear(p.date) : '', f: p.finish === 'Unfinished' ? '' : (p.finish || ''),
    m: st.maker || '', sh: st.shop || '', s: packStory(storyOf(p))
  };
  const ix = id => Math.max(0, p.woods.indexOf(id)).toString(36);
  if (ts.length && ts.every(x => x.builtin)) { o.tp = ts.map(x => x.code); if (p.angle) o.ag = p.angle; }
  const sw = stripW(p); if (sw && new Set(sw).size > 1) o.sw = sw.map(x => +x.toFixed(4));
  if (t.board && p.board) o.bd = { ...BD.pack(p.board, ix), ds: seedOf(p) };   // ds: drawing seed; sd stays the chaos shuffle
  if (t.bowl && p.bowl) {
    const bw = p.bowl;
    o.bw = { k: bw.kind, s: bw.shape, D: bw.D, H: bw.H, rh: bw.ringH, wl: bw.wall };
    if (bw.kind === 'seg') { o.bw.b = ix(bw.base); o.bw.r = bw.rings.map(r => [r.off ? 1 : 0, B.segWoods(r).map(row => row.map(ix).join('')).join('|')]); }
    else o.bw.w = ix(bw.wood);
  }
  return o;
}
async function pageHash(p) { return '#' + b64url(await deflate(JSON.stringify(pagePayload(p)))); }
async function pageLink(p) {
  const base = (S.settings.pageUrl || '').trim().replace(/#.*$/, ''); if (!base) return null;
  if (ghOn() && p.pubId && p.pubHash === pubHash(p)) return base + '#' + p.pubId;   // short link: the details live on the page
  return base + await pageHash(p);   // long link: the details ride inside the QR
}
function qrCanvas(text, px = 900, logo = null) {
  // Short links make small codes with room for the logo (strongest error correction rebuilds the covered squares); long links stay plain
  let qr = qrcode(0, logo ? 'H' : 'L'); qr.addData(text); qr.make();
  if (logo && qr.getModuleCount() > 49) { logo = null; qr = qrcode(0, 'L'); qr.addData(text); qr.make(); }
  const n = qr.getModuleCount(), q = 4, cell = Math.floor(px / (n + 2 * q));
  const o = Math.floor((px - cell * n) / 2), c = document.createElement('canvas'); c.width = c.height = px;   // whole pixels per square; the margin takes the slack
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#1a1410';
  let hole = null;
  if (logo) {   // a white window in the center, about a third of the code wide
    const ar = logo.height / logo.width, bw = Math.round(n * 0.36) | 1, bh = Math.max(5, Math.round(bw * ar + 2) | 1);
    hole = { x0: (n - bw) / 2 | 0, y0: (n - bh) / 2 | 0, bw, bh };
  }
  const inHole = (r, k) => hole && k >= hole.x0 && k < hole.x0 + hole.bw && r >= hole.y0 && r < hole.y0 + hole.bh;
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k) && !inHole(r, k)) g.fillRect(o + k * cell, o + r * cell, cell, cell);
  if (hole) {
    const x = o + hole.x0 * cell, y = o + hole.y0 * cell, w = hole.bw * cell, h = hole.bh * cell, pad = cell * 0.7;
    const lw = w - 2 * pad, lh = Math.min(h - 2 * pad, lw * logo.height / logo.width), lw2 = lh * logo.width / logo.height;
    g.drawImage(logo, x + (w - lw2) / 2, y + (h - lh) / 2, lw2, lh);
  }
  return c;
}
/* ---------- Story page hosting: Bench keeps a free GitHub Pages site up to date by itself ---------- */
const ghOn = () => !!(S.settings.gh && S.settings.gh.token && S.settings.gh.repo);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function gh(path, opt = {}, token = S.settings.gh && S.settings.gh.token) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), opt.timeout || 25000);
  try {
    const r = await fetch('https://api.github.com' + path, { method: opt.method || 'GET', signal: ctl.signal, cache: 'no-store',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', ...(opt.body ? { 'Content-Type': 'application/json' } : {}) },
      body: opt.body ? JSON.stringify(opt.body) : undefined });
    const data = r.status === 204 ? null : await r.json().catch(() => null);
    if (!r.ok) { const e = new Error((data && data.message) || ('HTTP ' + r.status)); e.status = r.status; throw e; }
    return data;
  } finally { clearTimeout(t); }
}
async function storyPageHtml() {
  const logo = await logoDataUrl(); let html = await (await fetch('story.html')).text();
  if (logo) html = html.replace('<head>', `<head><script>window.SHOP_LOGO=${JSON.stringify(logo)}</script>`);
  html = html.replace('<head>', `<head><script>window.SHOP_EMAIL=${JSON.stringify(S.settings.email || '')}</script>`);
  return html;
}
const strHash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const pubHash = p => strHash(JSON.stringify(pagePayload(p)));
const pageVersion = () => APP_VERSION + ':' + strHash(logoSrc() + '|' + (S.settings.email || ''));
function newPubId(used) {
  const abc = '23456789abcdefghjkmnpqrstuvwxyz'; let id;
  do { id = Array.from(crypto.getRandomValues(new Uint8Array(5)), b => abc[b % abc.length]).join(''); } while (used.has(id));
  used.add(id); return id;
}
// Everything goes up in one commit, so the site rebuilds once
async function ghCommit(files, message) {
  const g = S.settings.gh, base = `/repos/${g.owner}/${g.repo}`;
  let ref; for (let k = 0; ; k++) { try { ref = await gh(`${base}/git/ref/heads/${g.branch}`); break; } catch (e) { if (k > 4 || ![404, 409].includes(e.status)) throw e; await sleep(1500); } }
  const head = ref.object.sha, commit = await gh(`${base}/git/commits/${head}`);
  const entries = [];
  for (const f of files) {
    if (f.b64) { const bl = await gh(`${base}/git/blobs`, { method: 'POST', body: { content: f.b64, encoding: 'base64' } }); entries.push({ path: g.dir + f.path, mode: '100644', type: 'blob', sha: bl.sha }); }
    else entries.push({ path: g.dir + f.path, mode: '100644', type: 'blob', content: f.content });
  }
  const tree = await gh(`${base}/git/trees`, { method: 'POST', body: { base_tree: commit.tree.sha, tree: entries } });
  const c = await gh(`${base}/git/commits`, { method: 'POST', body: { message, tree: tree.sha, parents: [head] } });
  await gh(`${base}/git/refs/heads/${g.branch}`, { method: 'PATCH', body: { sha: c.sha } });
}
// The app itself, so it opens in a computer's browser (no data in it; pieces come through the private sync)
async function appMirrorFiles() {
  const out = [];
  try {
    const list = await (await fetch('files.json', { cache: 'no-store' })).json();
    for (const name of list) {
      const r = await fetch(name); if (!r.ok) continue;
      if (/\.(png|jpe?g|woff2?|ico)$/i.test(name)) { const u = new Uint8Array(await r.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); out.push({ path: 'app/' + name, b64: btoa(s) }); }
      else out.push({ path: 'app/' + name, content: await r.text() });
    }
  } catch (e) {}
  return out;
}
let ghQueue = Promise.resolve();
function publishPieces(list) {
  const run = async () => {
    const g = S.settings.gh, files = [], done = [], used = new Set(S.pieces.map(q => q.pubId).filter(Boolean));
    if (g.pageVer !== pageVersion()) files.push({ path: 'index.html', content: await storyPageHtml() }, { path: '.nojekyll', content: '\n' }, ...await appMirrorFiles());
    for (const p of list) {
      const json = JSON.stringify(pagePayload(p)), h = strHash(json);
      if (p.pubId && p.pubHash === h) continue;
      const id = p.pubId || newPubId(used);
      files.push({ path: `p/${id}.json`, content: json }); done.push([p, id, h]);
    }
    if (!files.length) return;
    await ghCommit(files, done.length ? 'Story for ' + done.map(([p]) => 'No. ' + pad(p.no)).join(', ') : 'Update the story page');
    if (files.some(f => f.path === 'index.html')) g.pageVer = pageVersion();
    done.forEach(([p, id, h]) => { p.pubId = id; p.pubHash = h; });
    save();
  };
  return ghQueue = ghQueue.catch(() => {}).then(run);
}
// Upload what's needed, then hand back the links. No internet? The long link still works.
async function readyLinks(list) {
  if (ghOn() && (list.some(p => !p.pubId || p.pubHash !== pubHash(p)) || S.settings.gh.pageVer !== pageVersion())) {
    try { await publishPieces(list); }
    catch (e) { toast(e.status === 401 ? 'GitHub code stopped working. Reconnect in Settings. Using the long QR for now.' : 'Couldn’t upload (no internet?). Using the long QR, which still works.'); }
  }
  return Promise.all(list.map(pageLink));
}
async function connectGitHub(token, say) {
  say('Checking the code…');
  let u; try { u = await gh('/user', {}, token); } catch (e) { throw new Error(e.status === 401 ? 'That code didn’t work. Copy it again from GitHub (it starts with ghp_).' : 'Couldn’t reach GitHub. Check your internet and try again.'); }
  const owner = u.login, repo = (owner + '.github.io').toLowerCase();
  let r, fresh = false;
  try { r = await gh(`/repos/${owner}/${repo}`, {}, token); }
  catch (e) {
    if (e.status !== 404) throw e;
    say('Making your website…');
    try { r = await gh('/user/repos', { method: 'POST', body: { name: repo, description: 'Stories of my handmade pieces', auto_init: true, has_issues: false, has_wiki: false, has_projects: false } }, token); fresh = true; }
    catch (e2) { throw new Error(e2.status === 403 || e2.status === 404 ? 'That code doesn’t have permission. Make a new one with the Get code button and leave the boxes as they are.' : e2.message); }
  }
  // an existing site with something else on it keeps its page; ours goes in its own folder
  let dir = '';
  if (!fresh) { try { const f = await gh(`/repos/${owner}/${repo}/contents/index.html`, {}, token); if (!/bench-story/.test(atob((f.content || '').replace(/\s/g, '')))) dir = 'story/'; } catch (e) { if (e.status !== 404) throw e; } }
  S.settings.gh = { token, owner, repo, branch: r.default_branch || 'main', dir, pageVer: '' };
  say('Putting your story page up…');
  try { await publishPieces([]); } catch (e) { S.settings.gh = null; throw new Error('Couldn’t upload the page: ' + e.message); }
  try { await gh(`/repos/${owner}/${repo}/pages`, { method: 'POST', body: { source: { branch: S.settings.gh.branch, path: '/' } } }); } catch (e) { /* already on */ }
  S.settings.pageUrl = `https://${repo}/${dir}`; save();
}
function pageSetupSheet(then) {
  openSheet(`<h2>Set up your story page</h2>
    <p class="muted">One time, about 5 minutes. After this Bench puts each piece online by itself, and you won’t need to open GitHub again.</p>
    <ol class="steps">
      <li><b>Sign in to GitHub</b>, or make a free account. Your username becomes your page address, so a short shop-style name works well.<div class="row" style="margin-top:8px"><button class="btn small" id="gsU">Open GitHub</button></div></li>
      <li><b>Get a code for Bench.</b> Tap the button. On that page set <b>Expiration</b> to <b>No expiration</b>, scroll down and tap <b>Generate token</b>, then tap the copy icon next to the code.<div class="row" style="margin-top:8px"><button class="btn small" id="gsT">Get code</button></div></li>
      <li><b>Paste it here.</b><div class="row" style="margin-top:8px"><input id="gsK" placeholder="ghp_…" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn small" id="gsP" style="flex:none">Paste</button></div></li>
    </ol>
    <p class="note" id="gsMsg" style="min-height:1.4em"></p>
    <button class="btn primary wide" id="gsGo">Connect</button>`, { over: true });
  const say = t => $('#gsMsg').textContent = t;
  $('#gsU').onclick = () => openUrl('https://github.com/login');
  $('#gsT').onclick = () => openUrl('https://github.com/settings/tokens/new?scopes=repo&description=Bench%20story%20page');
  $('#gsP').onclick = async () => { let t = ''; try { t = bridge ? bridge.readClipboard() : await navigator.clipboard.readText(); } catch (e) {} if (t) $('#gsK').value = t.trim(); else say('Nothing copied yet. Copy the code on GitHub first.'); };
  $('#gsGo').onclick = async () => {
    const token = $('#gsK').value.trim(); if (!token) return say('Paste the code from GitHub first.');
    const b = $('#gsGo'); b.disabled = true;
    try { await connectGitHub(token, say); closeSheet(); toast('Story page is set up. The first time it can take a few minutes to open.'); then ? then() : render(); }
    catch (e) { say(e.message); b.disabled = false; }
  };
}
function askPrint(p) {
  openSheet(`<h2>No. ${pad(p.no)} is finished</h2><p class="muted">Print a card for it? Your logo and email on one side, and a QR that opens the story of this ${esc(nounOf(p))}.</p>
    <div class="row" style="margin-top:18px"><button class="btn" id="apNo">Not now</button><button class="btn primary" id="apYes">Print card</button></div>`);
  $('#apNo').onclick = () => closeSheet();
  $('#apYes').onclick = () => { closeSheet(); S.settings.pageUrl ? printCardsSheet(p) : pageSetupSheet(() => printCardsSheet(p)); };
}

/* ---------- Printed cards: logo + email + this piece's QR ---------- */
const DPI = 300;
function fitText(g, text, font, maxW, size) { do { g.font = font.replace('#', size); } while (g.measureText(text).width > maxW && --size > 10); }
function cardFace(g, x, y, w, h, logo, big) {   // logo and email
  const st = S.settings, email = (st.email || '').trim();
  g.fillStyle = '#1d1611'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const cy = y + h / 2 - (email ? 28 : 0);
  if (logo) { const lw = Math.min(w * (big ? .78 : .86), (h * (big ? .5 : .42)) * logo.width / logo.height), lh = lw * logo.height / logo.width; g.drawImage(logo, x + (w - lw) / 2, cy - lh / 2, lw, lh); }
  else { fitText(g, st.shop || st.maker || 'Handmade', '600 #px Fraunces, Georgia, serif', w * .85, 64); g.fillText(st.shop || st.maker || 'Handmade', x + w / 2, cy + 20); }
  if (email) { g.fillStyle = '#3a2f27'; fitText(g, email, '500 #px system-ui, sans-serif', w * .88, big ? 38 : 33); g.fillText(email, x + w / 2, y + h - (big ? 120 : 92)); }
}
function cardQR(g, x, y, w, h, p, link, logo) {   // this piece's QR
  const size = Math.min(w - 40, h - 170), q = qrCanvas(link, size, logo);
  g.drawImage(q, Math.round(x + (w - q.width) / 2), Math.round(y + 34 + (size - q.width) / 2));   // whole pixels per square keeps the edges sharp
  g.fillStyle = '#1d1611'; g.textAlign = 'center';
  fitText(g, `No. ${pad(p.no)}`, '600 #px Fraunces, Georgia, serif', w - 40, 40); g.fillText(`No. ${pad(p.no)}`, x + w / 2, y + size + 80);
  g.fillStyle = '#6b5b4e'; const cap = `Scan for the story of your ${nounOf(p)}`; fitText(g, cap, '#px system-ui, sans-serif', w - 40, 27); g.fillText(cap, x + w / 2, y + size + 114);
}
// One card, 3.5 x 2 in (side by side) or 3.5 x 4 in (folds to 3.5 x 2: logo on the front, QR on the back)
function cardCanvas(p, link, logo, style) {
  const W = 3.5 * DPI, H = (style === 'fold' ? 4 : 2) * DPI, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  if (style === 'fold') {
    cardFace(g, 0, H / 2, W, H / 2, logo, true);
    // the back panel is printed upside down so it reads right once folded
    g.save(); g.setTransform(-1, 0, 0, -1, W, H / 2); cardQR(g, 0, 0, W, H / 2, p, link, logo); g.restore();
  } else {
    cardFace(g, 0, 0, W * .5, H, logo, false);
    g.strokeStyle = '#e6ddd2'; g.lineWidth = 2; g.beginPath(); g.moveTo(W * .5, 70); g.lineTo(W * .5, H - 70); g.stroke();
    cardQR(g, W * .5, 0, W * .5, H, p, link, logo);
  }
  return c;
}
// Letter pages full of cards, with light cut lines (and a dashed fold line on fold-overs)
function cardSheets(cards, style) {
  const PW = 8.5 * DPI, PH = 11 * DPI, cw = 3.5 * DPI, ch = (style === 'fold' ? 4 : 2) * DPI, cols = 2, rows = style === 'fold' ? 2 : 5, per = cols * rows;
  const mx = (PW - cols * cw) / 2, my = (PH - rows * ch) / 2, pages = [];
  for (let i = 0; i < cards.length; i += per) {
    const c = document.createElement('canvas'); c.width = PW; c.height = PH; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, PW, PH);
    const chunk = cards.slice(i, i + per);
    chunk.forEach((card, k) => g.drawImage(card, mx + (k % cols) * cw, my + Math.floor(k / cols) * ch));
    const usedRows = Math.ceil(chunk.length / cols);
    g.strokeStyle = '#c9c1b8'; g.lineWidth = 2;
    const xs = [0, 1, 2].map(k => mx + k * cw), ys = [...Array(usedRows + 1)].map((_, k) => my + k * ch);
    for (const x of xs) { g.beginPath(); g.moveTo(x, my - 90); g.lineTo(x, ys[usedRows] + 90); g.stroke(); }
    for (const y of ys) { g.beginPath(); g.moveTo(mx - 90, y); g.lineTo(mx + cols * cw + 90, y); g.stroke(); }
    if (style === 'fold') { g.setLineDash([14, 12]); g.strokeStyle = '#b8aea3'; for (let r = 0; r < usedRows; r++) { const y = my + r * ch + ch / 2; g.beginPath(); g.moveTo(mx, y); g.lineTo(mx + cols * cw, y); g.stroke(); } g.setLineDash([]); }
    g.fillStyle = '#9a8f85'; g.font = '30px system-ui, sans-serif'; g.textAlign = 'left';
    g.fillText(style === 'fold' ? 'Cut on the solid lines, fold on the dashed line. Print at 100% / actual size.' : 'Cut on the lines. Print at 100% / actual size.', mx, PH - 70);
    pages.push(c);
  }
  return pages;
}
function printPages(pages, job) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:8.5in 11in;margin:0}html,body{margin:0;padding:0;background:#fff}img{display:block;width:8.5in;height:11in;page-break-after:always;break-after:page}img:last-child{page-break-after:auto;break-after:auto}</style></head><body>${pages.map(c => `<img src="${c.toDataURL('image/png')}">`).join('')}</body></html>`;
  if (bridge && bridge.printHtml) { bridge.printHtml(html, job); return; }
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'; document.body.appendChild(f);
  f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
  f.onload = () => { f.contentWindow.print(); setTimeout(() => f.remove(), 60000); };
}
async function printCardsSheet(first) {
  const st = S.settings, logo = await loadImg(logoSrc());
  try { await document.fonts.load('600 40px Fraunces'); } catch (e) {}
  const others = S.pieces.filter(q => q.id !== first.id && q.status !== 'building' && !q.printed).sort((a, b) => b.no - a.no).slice(0, 40), picked = new Set([first.id]);
  let firstLink = null;
  let style = st.cardStyle === 'fold' ? 'fold' : 'side';
  const per = () => style === 'fold' ? 4 : 10;
  const draw = async () => {
    if (!firstLink) { $('#cprev').innerHTML = '<p class="muted" style="padding:30px;text-align:center;color:#666">Getting the QR ready…</p>'; firstLink = (await readyLinks([first]))[0]; }
    const card = cardCanvas(first, firstLink, logo, style);
    $('#cprev').innerHTML = `<img src="${card.toDataURL()}" alt="Card preview">`;
    const n = picked.size, sheets = Math.ceil(n / per());
    $('#ccount').textContent = `${n} card${n === 1 ? '' : 's'} · ${sheets} sheet${sheets === 1 ? '' : 's'} · room for ${sheets * per() - n} more`;
  };
  openSheet(`<h2>Print cards</h2>
    <div class="seg" id="cstyle"><button data-s="side" class="${style === 'side' ? 'on' : ''}">One side · 10 a page</button><button data-s="fold" class="${style === 'fold' ? 'on' : ''}">Fold-over · 4 a page</button></div>
    <div class="cardprev" id="cprev" style="margin-top:14px;${style === 'fold' ? 'max-width:220px;margin-left:auto;margin-right:auto' : ''}"></div>
    <p class="note" id="cnote">${style === 'fold' ? 'Fold on the dashed line: logo and email on the front, QR on the back.' : 'Logo and email on the left, this piece&rsquo;s QR on the right.'}${(st.email || '').trim() ? '' : ' Add your email in Settings to print it on the card.'}</p>
    ${others.length ? `<div class="tray-h" style="margin-top:16px">Fill the page with more pieces</div><div id="cmore">${others.map(q => `<button class="pickrow" data-pk="${q.id}"><span class="box"></span><span class="grow">${esc(typeName(q))} <span class="muted">No. ${pad(q.no)}</span></span></button>`).join('')}</div>` : ''}
    <p class="muted small" id="ccount" style="margin-top:14px"></p>
    <div class="row" style="margin-top:8px"><button class="btn" id="csave">Save as picture</button><button class="btn primary" id="cprint">Print</button></div>`, { over: true });
  $$('#cstyle button').forEach(b => b.onclick = () => {
    style = b.dataset.s; st.cardStyle = style; save(); $$('#cstyle button').forEach(x => x.classList.toggle('on', x === b));
    $('#cprev').style.cssText = 'margin-top:14px;' + (style === 'fold' ? 'max-width:220px;margin-left:auto;margin-right:auto' : '');
    $('#cnote').firstChild.textContent = style === 'fold' ? 'Fold on the dashed line: logo and email on the front, QR on the back.' : 'Logo and email on the left, this piece’s QR on the right.';
    draw();
  });
  $$('[data-pk]').forEach(b => b.onclick = () => { const id = b.dataset.pk; picked.has(id) ? picked.delete(id) : picked.add(id); b.classList.toggle('on', picked.has(id)); draw(); });
  const build = async () => {
    const list = [first, ...others.filter(q => picked.has(q.id))], links = await readyLinks(list);
    list.forEach(q => q.printed = today()); save();
    return cardSheets(list.map((q, i) => cardCanvas(q, links[i], logo, style)), style);
  };
  $('#cprint').onclick = async () => { const pages = await build(); printPages(pages, `Cards No. ${pad(first.no)}`); };
  $('#csave').onclick = async () => { const pages = await build(); pages.forEach((c, i) => saveImage(c, `bench-cards-${pad(first.no)}${pages.length > 1 ? '-' + (i + 1) : ''}.png`, false)); };
  draw();
}

function tagCanvas(p, url, logo) {
  const st = S.settings, W = 1000, H = 1300, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fbf7f1'; g.fillRect(0, 0, W, H);
  const ws = colsOf(p), tot = ws.reduce((a, w) => a + (w.w || 1), 0); let x0 = 0;
  ws.forEach(w => { const bw = W * (w.w || 1) / tot; g.fillStyle = w.color; g.fillRect(x0, 0, bw + 1, 46); x0 += bw; });
  g.fillStyle = '#1d1611'; g.textAlign = 'center';
  g.font = '600 46px Fraunces, "Noto Serif", Georgia, serif'; g.fillText(st.shop || (st.maker ? `Made by ${st.maker}` : 'Handmade'), W / 2, 140);
  g.font = '600 76px Fraunces, "Noto Serif", Georgia, serif'; g.fillText(`No. ${pad(p.no)}`, W / 2, 240);
  const q = qrCanvas(url, 740, logo); g.drawImage(q, Math.round((W - q.width) / 2), Math.round(290 + (740 - q.width) / 2));
  g.font = '40px Fraunces, "Noto Serif", Georgia, serif'; g.fillStyle = '#4a3b30'; g.fillText(`Scan to read the story of your ${nounOf(p)}`, W / 2, 1110);
  g.font = '32px system-ui, sans-serif'; g.fillStyle = '#7a6a5c'; g.fillText(uniqWoods(p.woods).map(w => w.name).join(' · '), W / 2, 1175);
  return c;
}

/* ---------- Shop logo ---------- */
const logoSrc = () => S.settings.logo || '';
const loadImg = src => new Promise(res => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
async function logoDataUrl() {
  const src = logoSrc(); if (!src || src.startsWith('data:')) return src;
  try { const bl = await (await fetch(src)).blob(); return await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(bl); }); } catch (e) { return ''; }
}
// A photo or scan of a logo: knock out the paper so only the ink is left
async function logoFromFile(file) {
  const url = await resizePhoto(file, 1400), img = await loadImg(url); if (!img) throw new Error('unreadable');
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
  const corner = []; for (const [x, y] of [[2, 2], [c.width - 3, 2], [2, c.height - 3], [c.width - 3, c.height - 3]]) { const k = (y * c.width + x) * 4; corner.push([px[k], px[k + 1], px[k + 2]]); }
  const bg = [0, 1, 2].map(j => corner.map(q => q[j]).sort((a, b) => a - b)[1]);
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const k = (y * c.width + x) * 4, dist = Math.hypot(px[k] - bg[0], px[k + 1] - bg[1], px[k + 2] - bg[2]);
    const a = Math.max(0, Math.min(255, (dist - 30) * 2.4)); px[k + 3] = a;
    if (a > 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  if (x1 <= x0) throw new Error('no logo found');
  g.putImageData(d, 0, 0);
  const pad = 8, o = document.createElement('canvas'); o.width = Math.min(c.width, x1 - x0 + 2 * pad); o.height = Math.min(c.height, y1 - y0 + 2 * pad);
  o.getContext('2d').drawImage(c, Math.max(0, x0 - pad), Math.max(0, y0 - pad), o.width, o.height, 0, 0, o.width, o.height);
  return o.toDataURL('image/png');
}

/* ---------- Native bridge ---------- */
function shareText(text, subject = '') { if (bridge) bridge.shareText(text, subject); else if (navigator.share) navigator.share({ text }).catch(() => {}); else navigator.clipboard?.writeText(text).then(() => toast('Copied')); }
function copyText(text, msg = 'Copied') { if (bridge) { bridge.copyText(text); toast(msg); } else navigator.clipboard?.writeText(text).then(() => toast(msg)).catch(() => toast(msg)); }
function saveImage(canvas, name, share) {
  const b64 = canvas.toDataURL('image/png').split(',')[1];
  if (bridge) { const ok = share ? bridge.shareImage(b64, name) : bridge.saveImage(b64, name); if (!share) toast(ok ? 'Saved to Pictures/Bench' : 'Could not save'); }
  else { const a = document.createElement('a'); a.href = canvas.toDataURL(); a.download = name; a.click(); }
}
function saveFile(text, name, mime) {
  if (bridge) { const ok = bridge.saveFile(text, name, mime); toast(ok ? `Saved to Downloads: ${name}` : 'Could not save'); }
  else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; a.click(); }
}
// A file straight from the app's own folder (the template STLs), saved to Downloads
function saveBytes(buf, name, mime = 'application/octet-stream') {
  if (bridge && bridge.saveBlob) {
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    const ok = bridge.saveBlob(btoa(s), name, mime); toast(ok ? `Saved to Downloads: ${name}` : 'Could not save');
  } else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: mime })); a.download = name; a.click(); }
}
async function saveAsset(path, name, mime) {
  try { const r = await fetch(path); if (!r.ok) throw new Error('missing'); saveBytes(new Uint8Array(await r.arrayBuffer()), name, mime); }
  catch (e) { toast('Could not get that file'); }
}
async function saveStored(key, name, mime) {   // a file kept in the phone's own storage
  const u = await photoGet(key); if (!u) return toast('That file is not stored here');
  const b = atob(u.slice(u.indexOf(',') + 1)); saveBytes(Uint8Array.from(b, c => c.charCodeAt(0)), name, mime);
}
let stlIndex = null;
const stlLoad = () => stlIndex ? Promise.resolve(stlIndex) : fetch('stl/index.json').then(r => r.ok ? r.json() : {}).catch(() => ({})).then(j => stlIndex = j);
function openUrl(u) { if (bridge) bridge.openUrl(u); else window.open(u, '_blank'); }
const haptic = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
function pickFiles(accept, multiple = false) {
  return new Promise(res => {
    const inp = $('#filePick'); inp.value = ''; inp.accept = accept; inp.multiple = multiple;
    inp.onchange = () => res([...inp.files]);
    inp.click();
  });
}
const readText = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(f); });
const bufToDataUrl = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return 'data:model/stl;base64,' + btoa(s); };
const readBuf = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsArrayBuffer(f); });
function resizePhoto(file, max = 1400) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = rej; img.src = url;
  });
}
async function addPhotos(list) {
  const files = await pickFiles('image/*', true), added = [];
  for (const f of files) { try { const id = uid(); await photoPut(id, await resizePhoto(f)); list.push(id); added.push(id); } catch (e) { toast('Could not read that photo'); } }
  return added;
}

/* ---------- Shell ---------- */
let tab = 'pieces', stack = [];
// Snackbar, with an optional action like Undo
function toast(msg, o = {}) {
  const t = $('#toast'); clearTimeout(t._h);
  t.innerHTML = `<span>${esc(msg)}</span>${o.action ? `<button id="tAct">${esc(o.action)}</button>` : ''}`;
  t.classList.toggle('top', !$('#sheet').hidden);
  t.hidden = false; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  if (o.action) $('#tAct').onclick = () => { t.hidden = true; clearTimeout(t._h); o.onAction && o.onAction(); };
  t._h = setTimeout(() => { t.hidden = true; o.onTimeout && o.onTimeout(); }, o.action ? 5000 : 2600);
}
function setTop(title, actions = '', back = stack.length > 1) { $('#title').textContent = title; $('#topActions').innerHTML = actions; $('#backBtn').hidden = !back; }
function go(view, params = {}) { stack.push({ view, params }); render(true); scrollTo(0, 0); }
function back() {
  if (typeof V3 !== 'undefined' && V3.close()) return true;
  if (!$('#sheet').hidden) { closeSheet(); return true; }
  if (stack.length > 1) { const top = stack[stack.length - 1]; if (top.guard && !top.guard()) return true; stack.pop(); render(true); return true; }
  if (tab !== 'pieces') { switchTab('pieces'); return true; }
  return false;
}
window.benchBack = () => back();
function switchTab(t) { tab = t; stack = [{ view: t, params: {} }]; $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); render(true); scrollTo(0, 0); }
function render(anim) {
  const cur = stack[stack.length - 1], v = $('#view');
  v.innerHTML = ''; $$('.fab').forEach(f => f.remove());
  v.classList.remove('enter'); if (anim) { void v.offsetWidth; v.classList.add('enter'); }
  VIEWS[cur.view](cur.params, cur);
  onScroll();
}
// Sheets stack: one can open over another (the keypad over a form) and closing returns to the one below
const sheetStack = [];
function openSheet(html, o = {}) {
  const sh = $('#sheet'), card = $('#sheetCard'), open = !sh.hidden, t = $('#toast');
  if (!t.hidden && !t.classList.contains('top')) { t.hidden = true; clearTimeout(t._h); }
  if (open && o.over) { const frag = document.createDocumentFragment(); while (card.firstChild) frag.appendChild(card.firstChild); sheetStack.push({ frag, top: card.scrollTop }); }
  else if (!open) sheetStack.length = 0;
  card.innerHTML = `<div class="grab"><i></i></div>${html}`;
  card.style.animation = open && !o.over ? 'none' : '';
  if (!open || o.over) { void card.offsetWidth; card.style.animation = ''; if (o.over) card.scrollTop = 0; }
  sh.hidden = false; card.style.transform = '';
  bindGrab();
}
function closeSheet() {
  const sh = $('#sheet'), card = $('#sheetCard');
  if (sheetStack.length) { const prev = sheetStack.pop(); card.innerHTML = ''; card.appendChild(prev.frag); card.scrollTop = prev.top; card.style.transform = ''; return; }
  sh.hidden = true; card.innerHTML = ''; card.style.transform = '';
}
function closeAllSheets() { sheetStack.length = 0; closeSheet(); }
// Pull the sheet down by its handle to dismiss it
function bindGrab() {
  const g = $('#sheetCard .grab'), card = $('#sheetCard'); if (!g) return;
  let y0 = null;
  g.onpointerdown = e => { y0 = e.clientY; g.setPointerCapture(e.pointerId); card.style.transition = 'none'; };
  g.onpointermove = e => { if (y0 == null) return; const dy = Math.max(0, e.clientY - y0); card.style.transform = `translateY(${dy}px)`; };
  g.onpointerup = g.onpointercancel = e => {
    if (y0 == null) return; const dy = e.clientY - y0; y0 = null; card.style.transition = 'transform .35s var(--spring)';
    if (dy > 90) { card.style.transform = 'translateY(100%)'; setTimeout(() => { card.style.transition = ''; closeSheet(); }, 180); }
    else card.style.transform = '';
  };
}
function fab(onClick, label = 'Add', extended = false) {
  const b = document.createElement('button'); b.className = 'fab'; b.setAttribute('aria-label', label);
  b.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>${extended ? `<span>${esc(label)}</span>` : ''}`;
  if (!extended) b.style.padding = '0';
  b.onclick = onClick; document.body.appendChild(b); onScroll();
}
function confirmSheet(msg, yes, onYes, detail = '') {
  openSheet(`<h2>${esc(msg)}</h2>${detail ? `<p class="note" style="margin-top:-6px">${esc(detail)}</p>` : ''}<div class="row" style="margin-top:18px"><button class="btn" id="cNo">Cancel</button><button class="btn primary" id="cYes">${esc(yes)}</button></div>`);
  $('#cNo').onclick = closeSheet; $('#cYes').onclick = () => { closeSheet(); onYes(); };
}
function onScroll() {
  const y = scrollY, top = $('#top');
  if (y > 18) top.classList.add('scrolled'); else if (y < 4) top.classList.remove('scrolled');
  $$('.fab').forEach(f => f.classList.toggle('fold', y > 60));
}
addEventListener('scroll', onScroll, { passive: true });
// Soft honey bloom where the finger lands (instead of a ripple)
const BLOOM = '.btn, button.listrow, button.chip, .seg button, .filters button, .wood, .tpl, .preset, .kp button, .stepper button, .fab, .icon, .tl, .piece, .patpick, .swrow, .lockbtn, .meas, .mini';
document.addEventListener('pointerdown', e => {
  const el = e.target.closest && e.target.closest(BLOOM); if (!el) return;
  const r = el.getBoundingClientRect(); el.style.setProperty('--bx', (e.clientX - r.left) + 'px'); el.style.setProperty('--by', (e.clientY - r.top) + 'px');
  el.classList.add('bloom');
  const off = () => { setTimeout(() => el.classList.remove('bloom'), 90); removeEventListener('pointerup', off); removeEventListener('pointercancel', off); };
  addEventListener('pointerup', off); addEventListener('pointercancel', off);
}, { passive: true });

const ICON = {
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  qr: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2M18 14h2M14 18v2h2M18 18h2v2"/></svg>',
  cube: '<svg viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><path d="M9.5 14.5l5-5"/><path d="M11 6.5l1.6-1.6a4.2 4.2 0 0 1 6 6L17 12.5M13 17.5l-1.6 1.6a4.2 4.2 0 0 1-6-6L7 11.5"/></svg>',
  unlock: '<svg viewBox="0 0 24 24"><path d="M11 6.5l1.6-1.6a4.2 4.2 0 0 1 6 6L17 12.5M13 17.5l-1.6 1.6a4.2 4.2 0 0 1-6-6L7 11.5"/><path d="M5 5l2 2M19 19l-2-2"/></svg>',
  grip: '<svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>'
};
const statusChip = s => s === 'sold' ? '<span class="chip sold">Sold</span>' : s === 'available' ? '<span class="chip avail">Finished</span>' : '<span class="chip">Building</span>';
const stageOf = p => p.status === 'sold' ? 1 : p.status === 'available' ? 2 / 3 : 1 / 3;
// Grain-line progress: wavy where it's done so far, a flat track for what's left, straight once it's complete
let sqN = 0;
function squiggle(frac, o = {}) {
  const W = Math.max(30, Math.round(o.w || 160)), H = 14, mid = 7, amp = o.amp ?? 2.6, wl = o.wl || 20, sw = o.sw || 4;
  frac = Math.max(0, Math.min(1, frac)); const done = frac >= 1, col = o.color || (done ? 'var(--ok)' : 'var(--accent)');
  if (done) return `<svg class="squig" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path d="M2 ${mid}H${W - 2}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/></svg>`;
  const fx = 2 + frac * (W - 4), gap = 7, id = 'sq' + (++sqN);
  let d = `M${-wl} ${mid}`; for (let x = -wl, k = 0; x < fx + wl; x += wl / 2, k++) d += ` Q${(x + wl / 4).toFixed(1)} ${mid + (k % 2 ? 2 * amp : -2 * amp)} ${(x + wl / 2).toFixed(1)} ${mid}`;
  const wave = fx > 3 ? `<clipPath id="${id}"><rect x="0" y="0" width="${fx.toFixed(1)}" height="${H}"/></clipPath><g clip-path="url(#${id})"><path class="${o.animate ? 'wv' : ''}" style="--wl:${-wl}px" d="${d}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/></g>` : '';
  const t0 = Math.min(W - 2, fx + gap);
  return `<svg class="squig" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${wave}${t0 < W - 3 ? `<path d="M${t0.toFixed(1)} ${mid}H${W - 2}" stroke="var(--line)" stroke-width="${sw}" stroke-linecap="round"/>` : ''}<circle cx="${W - 2}" cy="${mid}" r="2" fill="${col}"/></svg>`;
}
const squigInto = (el, frac, o = {}) => { if (el) el.innerHTML = squiggle(frac, { ...o, w: el.clientWidth || o.w || 200 }); };
function spinner() {
  let d = ''; for (let i = 0; i <= 280; i += 4) { const t = i * Math.PI / 180, r = 15 + 1.8 * Math.sin(10 * t); d += (i ? 'L' : 'M') + (22 + r * Math.cos(t)).toFixed(2) + ' ' + (22 + r * Math.sin(t)).toFixed(2); }
  return `<svg class="spin" viewBox="0 0 44 44"><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
const modeSeg = (cur, id = 'mode') => `<div class="seg" id="${id}"><button data-m="finished" class="${cur === 'finished' ? 'on' : ''}">Finished</button><button data-m="templates" class="${cur === 'templates' ? 'on' : ''}">Templates</button><button data-m="3d">3D</button></div>`;
let viewMode = 'finished';
function open3D(p) {
  const t = typeById(p.type), title = esc(p.no ? pieceTitle(p) : typeName(p));
  if (t.bowl) {
    if (!p.bowl) return;
    return V3.open(() => { const g = B.mesh3d(p.bowl, woodById); const size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()); return { group: g, size }; }, null, title);
  }
  if (t.board) { if (!p.board) return; return V3.open(() => V3.board(p.board, woodById, seedOf(p)), null, title, { rotX: .62, rotY: -.45 }); }
  const ts = pieceTpls(p); if (!ts.length) return toast('Pick the parts first'); V3.open(D.assemble(ts), colsOf(p), title, { angle: p.angle || 0 });
}
function bindMode(root, redraw, id = 'mode', piece = null) {
  $$(`#${id} [data-m]`, root).forEach(b => b.onclick = () => {
    if (b.dataset.m === '3d') { const p = typeof piece === 'function' ? piece() : piece; if (p) open3D(p); return; }
    viewMode = b.dataset.m; $$(`#${id} [data-m]`, root).forEach(x => x.classList.toggle('on', x === b)); redraw();
  });
}

/* ---------- Tape-measure keypad ---------- */
// o: { title, value, min, max, quick: [inches], info: v => html, onSet: v, zero: allow 0, fine: start in sixteenths }
function measure(o) {
  const min = o.min ?? 0, max = o.max ?? 48, ppi = max <= 3 ? 120 : max <= 10 ? 84 : 44;
  const fromVal = v => { v = Math.max(0, +v || 0); if (onGrid(v)) { const p = fracParts(v); return { w: String(p.w), n: p.n, d: p.d, dec: null }; } const [a, b] = String(+v.toFixed(3)).split('.'); return { w: a, n: 0, d: 16, dec: b || '' }; };
  let st = fromVal(o.value), fresh = true, six = !!o.fine || !onGrid(+o.value || 0, 8);
  const val = () => (+st.w || 0) + (st.dec != null ? (st.dec ? +('0.' + st.dec) : 0) : (st.n ? st.n / st.d : 0));
  const FR8 = [[1, 8], [5, 8], [1, 4], [3, 4], [3, 8], [7, 8], [1, 2], [0, 0]];
  const FR16 = [[1, 16], [9, 16], [3, 16], [11, 16], [5, 16], [13, 16], [7, 16], [15, 16]];
  const quick = (o.quick || []).map(q => `<button data-q="${q}">${fracHTML(q, '')}</button>`).join('');
  openSheet(`<div class="kp-title"><h2>${esc(o.title)}</h2></div>
    <div class="kp-val" id="kpv"></div><div class="kp-info" id="kpi"></div>
    <div class="ruler" id="kpr"><canvas></canvas><div class="mark"></div></div>
    ${quick ? `<div class="kp-quick">${quick}</div>` : ''}
    <div class="kp-mode"><div class="seg" id="kpm"><button data-six="0">Eighths</button><button data-six="1">16ths</button></div></div>
    <div class="kp" id="kpk"></div>
    <div class="kp-go"><button class="btn" id="kpc">Cancel</button><button class="btn primary" id="kpok">Set</button></div>`, { over: true });
  const keys = () => {
    const fr = six ? FR16 : FR8, digit = k => `<button data-k="${k}">${k}</button>`;
    const fkey = i => { const [n, d] = fr[i]; if (!n) return `<button class="fn" data-f="0">whole</button>`; const on = st.dec == null && st.n === n && st.d === d; return `<button class="fk ${on ? 'on' : ''}" data-f="${n}/${d}">${fracHTML(n / d, '')}</button>`; };
    $('#kpk').innerHTML = [[1, 2, 3, 0, 1], [4, 5, 6, 2, 3], [7, 8, 9, 4, 5]].map(r => digit(r[0]) + digit(r[1]) + digit(r[2]) + '<i class="div"></i>' + fkey(r[3]) + fkey(r[4])).join('')
      + `<button data-k=".">.</button>${digit(0)}<button class="fn" data-k="bk" aria-label="Backspace">⌫</button><i class="div"></i>${fkey(6)}${fkey(7)}`;
    $$('#kpm [data-six]').forEach(b => b.classList.toggle('on', +b.dataset.six === +six));
  };
  const cv = $('#kpr canvas');
  const ruler = () => {
    const dpr = devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight; if (!W) return;
    cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const v = val(), c = W / 2;
    for (let k = Math.ceil((v - c / ppi) * 16); k <= (v + c / ppi) * 16; k++) {
      if (k < 0) continue;
      const x = c + (k / 16 - v) * ppi, lvl = k % 16 === 0 ? 4 : k % 8 === 0 ? 3 : k % 4 === 0 ? 2 : k % 2 === 0 ? 1 : 0;
      if (ppi < 60 && lvl === 0) continue;
      const h = [8, 12, 17, 23, 32][lvl];
      g.strokeStyle = '#2b1907'; g.globalAlpha = lvl === 4 ? 1 : .78; g.lineWidth = lvl >= 3 ? 1.8 : 1.2;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); g.globalAlpha = 1;
      if (lvl === 4) { g.fillStyle = k / 16 % 12 === 0 && k ? '#9c2a1a' : '#2b1907'; g.font = '600 16px Fraunces, Georgia, serif'; g.textAlign = 'center'; g.fillText(String(k / 16), x, 50); }
    }
  };
  const show = () => {
    const v = val(), bad = !(v >= min && v <= max) || (!o.zero && !(v > 0));
    $('#kpv').innerHTML = st.dec != null ? `${st.w || 0}.${st.dec}″` : fracHTML(v);
    $('#kpv').classList.toggle('fresh', fresh);
    $('#kpi').innerHTML = bad ? `<span style="color:var(--danger)">Use ${esc(BD.frac(o.zero ? min : Math.max(min, 1 / 16)))} to ${esc(BD.frac(max))}</span>` : (o.info ? o.info(v) : '');
    $('#kpok').disabled = bad;
    $$('.kp-quick [data-q]').forEach(b => b.classList.toggle('on', Math.abs(+b.dataset.q - v) < 1e-6));
    keys(); ruler();
  };
  $('#kpk').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = b.dataset.k, f = b.dataset.f;
    if (k === 'bk') { if (st.dec != null) { if (st.dec) st.dec = st.dec.slice(0, -1); else st.dec = null; } else if (st.n) st.n = 0; else st.w = st.w.slice(0, -1) || '0'; }
    else if (k === '.') { if (fresh) st = { w: '0', n: 0, d: 16, dec: '' }; else if (st.dec == null) { st.dec = ''; st.n = 0; } }
    else if (k !== undefined) {
      if (fresh) st = { w: k, n: 0, d: 16, dec: null };
      else if (st.dec != null) { if (st.dec.length < 3) st.dec += k; }
      else if (st.w.length < 3) st.w = st.w === '0' ? k : st.w + k;
    } else if (f !== undefined) {
      st.dec = null;
      if (f === '0') st.n = 0; else { const [n, d] = f.split('/').map(Number); st.n = n; st.d = d; }
    }
    fresh = false; show();
  };
  $$('#kpm [data-six]').forEach(b => b.onclick = () => { six = !!+b.dataset.six; show(); });
  $$('.kp-quick [data-q]').forEach(b => b.onclick = () => { closeSheet(); o.onSet(+b.dataset.q); });
  // Scrub the tape: drag left or right, it snaps to the eighth (or sixteenth)
  const rl = $('#kpr'); let drag = null;
  rl.onpointerdown = e => { rl.setPointerCapture(e.pointerId); drag = { x: e.clientX, v: val() }; };
  rl.onpointermove = e => {
    if (!drag) return; const step = six ? 1 / 16 : 1 / 8;
    let nv = Math.round((drag.v - (e.clientX - drag.x) / ppi) / step) * step; nv = Math.max(Math.max(0, min), Math.min(max, nv));
    if (Math.abs(nv - val()) > 1e-9) { st = fromVal(nv); fresh = false; haptic(onGrid(nv, 1) ? 14 : 4); show(); }
  };
  rl.onpointerup = rl.onpointercancel = () => { drag = null; };
  $('#kpc').onclick = closeSheet;
  $('#kpok').onclick = () => { const v = +val().toFixed(4); closeSheet(); o.onSet(v); };
  requestAnimationFrame(show); show();
}

/* ---------- Drag to reorder ---------- */
function dragList(box, onMove) {
  $$('.hdl', box).forEach(h => {
    h.onpointerdown = e => {
      e.preventDefault();
      const row = h.closest('[data-i]'), rows = $$('[data-i]', box), from = rows.indexOf(row);
      const rects = rows.map(r => r.getBoundingClientRect()), y0 = e.clientY, Hh = rects[from].height;
      let to = from; h.setPointerCapture(e.pointerId); row.classList.add('dragging'); haptic(8);
      h.onpointermove = ev => {
        const dy = ev.clientY - y0, mid = rects[from].top + Hh / 2 + dy;
        row.style.transform = `translateY(${dy}px)`;
        to = rows.filter((r, i) => i !== from && rects[i].top + rects[i].height / 2 < mid).length;
        rows.forEach((r, i) => { if (r === row) return; const s = from < to && i > from && i <= to ? -Hh : from > to && i >= to && i < from ? Hh : 0; r.style.transition = 'transform .2s'; r.style.transform = s ? `translateY(${s}px)` : ''; });
      };
      h.onpointerup = h.onpointercancel = () => {
        h.onpointermove = null; rows.forEach(r => { r.style.transform = ''; r.style.transition = ''; }); row.classList.remove('dragging');
        if (to !== from) onMove(from, to);
      };
    };
  });
}

/* ---------- Match the look ---------- */
// Slide a dial until each strip looks like the real one. The piece redraws as you go, so no measuring.
function matchLook(list, widths, art, done) {
  let cur = 0, zoom = false; const orig = widths.slice(), STEP = 1 / 32, PPI = 288;
  openSheet(`<div class="kp-title"><h2>Match the look</h2></div>
    <div class="lk-art" id="lkArt"></div>
    <div class="lk-bar"><span class="small muted">Pick a strip, then slide the dial until it looks like the real one.</span><button class="btn small" id="lkZoom">Zoom in</button></div>
    <div class="lk-chips" id="lkChips"></div>
    <div class="ruler dial" id="lkDial"><canvas></canvas><div class="mark"></div></div>
    <div class="lk-row"><button class="btn" id="lkThin" aria-label="Thinner">Thinner</button><div class="lk-val" id="lkVal"></div><button class="btn" id="lkThick" aria-label="Thicker">Thicker</button></div>
    <div class="kp-go"><button class="btn" id="lkReset">Start over</button><button class="btn" id="lkNext">Next strip</button><button class="btn primary" id="lkOk">Done</button></div>`, { over: true });
  const cv = $('#lkDial canvas');
  const dial = () => {
    const dpr = devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight; if (!W) return;
    cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const v = widths[cur], c = W / 2;
    for (let k = Math.ceil((v - c / PPI) * 32); k <= (v + c / PPI) * 32; k++) {
      if (k < 1) continue;
      const x = c + (k / 32 - v) * PPI, lvl = k % 32 === 0 ? 3 : k % 8 === 0 ? 2 : k % 4 === 0 ? 1 : 0;
      g.strokeStyle = '#2b1907'; g.globalAlpha = Math.max(.15, 1 - Math.abs(x - c) / c) * (lvl ? 1 : .7); g.lineWidth = lvl >= 2 ? 2 : 1.3;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, [10, 16, 24, 34][lvl]); g.stroke();
    }
    g.globalAlpha = 1;
  };
  const show = () => {
    $('#lkArt').innerHTML = art();
    $('#lkChips').innerHTML = list.map((id, i) => { const w = woodById(id) || { color: '#555' }; return `<button class="lkc ${i === cur ? 'on' : ''}" data-c="${i}" style="background:${w.color}" aria-label="Strip ${i + 1}">${i + 1}</button>`; }).join('');
    $$('#lkChips [data-c]').forEach(b => b.onclick = () => { cur = +b.dataset.c; show(); });
    $('#lkVal').innerHTML = `Strip ${cur + 1}<small>${fracHTML(widths[cur])}</small>`;
    $('#lkNext').disabled = list.length < 2;
    $('#lkArt').classList.toggle('zoom', zoom); $('#lkZoom').textContent = zoom ? 'Zoom out' : 'Zoom in';
    dial();
  };
  const set = v => { v = Math.max(STEP, Math.min(6, Math.round(v / STEP) * STEP)); if (Math.abs(v - widths[cur]) < 1e-9) return false; widths[cur] = v; haptic(4); show(); return true; };
  const rl = $('#lkDial'); let drag = null;
  rl.onpointerdown = e => { rl.setPointerCapture(e.pointerId); drag = { x: e.clientX, v: widths[cur] }; };
  rl.onpointermove = e => { if (drag) set(drag.v + (e.clientX - drag.x) / PPI); };
  rl.onpointerup = rl.onpointercancel = () => { drag = null; };
  $('#lkThin').onclick = () => set(widths[cur] - STEP);
  $('#lkThick').onclick = () => set(widths[cur] + STEP);
  $('#lkNext').onclick = () => { cur = (cur + 1) % list.length; show(); };
  $('#lkZoom').onclick = () => { zoom = !zoom; show(); };
  $('#lkReset').onclick = () => { orig.forEach((v, i) => widths[i] = v); show(); };
  $('#lkOk').onclick = () => { closeSheet(); done(); };
  requestAnimationFrame(show); show();
}

/* ---------- Wood checklist ---------- */
// widths (optional): one thickness per strip, kept in step as strips are added, removed and reordered
function woodPicker(el, list, onChange, widths, art, onCols) {
  const W = Array.isArray(widths);
  if (W) { while (widths.length < list.length) widths.push(widths[widths.length - 1] || .75); widths.length = list.length; }
  const add = id => { list.push(id); if (W) widths.push(widths[widths.length - 1] || .75); onChange(list); draw(); };
  function draw() {
    const counts = {}; list.forEach(id => counts[id] = (counts[id] || 0) + 1);
    const shown = [...shopWoods()];
    list.forEach(id => { if (!shown.some(w => w.id === id)) { const w = woodById(id); if (w) shown.push(w); } });
    el.innerHTML = `
      <div class="woodlist">${shown.map(w => `
        <button class="wood ${counts[w.id] ? 'picked' : ''}" data-w="${w.id}">
          <span class="sw" style="background:linear-gradient(90deg,${w.color},${w.color2 || w.color})"></span>
          <span class="wn">${esc(w.name)}</span>${counts[w.id] ? `<span class="cnt">${counts[w.id] > 1 ? '×' + counts[w.id] : '✓'}</span>` : ''}
        </button>`).join('')}
        <button class="wood other" id="otherWood"><span class="sw plus">+</span><span class="wn">Other wood</span></button></div>
      <div class="sec" style="margin-top:18px;font-size:16px">Strip order <span class="small muted">${list.length ? 'drag to reorder · tap to remove' : ''}</span></div>
      <div class="order">${list.length ? list.map((id, i) => { const w = woodById(id) || { name: '?', color: '#555' }; return `<div class="o" data-i="${i}"><b style="background:${w.color}">${i + 1}</b>${esc(w.name)}</div>`; }).join('') : '<div class="empty">Tap woods in the order the strips go. Tap one again if it repeats.</div>'}</div>
      ${W && list.length ? `<div class="sec" style="margin-top:18px;font-size:16px">Strip thickness <span class="small muted">blank ${fracHTML(widths.reduce((a, x) => a + x, 0))} wide</span></div>
      <div class="card flush">${list.map((id, i) => { const w = woodById(id) || { name: '?', color: '#555' }; return `<div class="strow"><div class="who" style="padding-left:8px">${swatch(w, 26, 8)}<div class="grow"><div class="t">${i + 1}. ${esc(w.name)}</div></div></div><button class="meas inline" data-sww="${i}"><span class="mv">${fracHTML(widths[i])}</span></button></div>`; }).join('')}</div>
      <div class="tools-row">${art ? '<button class="btn small primary" id="swLook">Match it to the real one</button>' : ''}<button class="btn small" id="swSame">Make them all the same</button></div>` : ''}`;
    $$('.wood[data-w]', el).forEach(b => b.onclick = () => { if (list.length >= 40) return toast('40 strips max'); add(b.dataset.w); });
    $('#otherWood', el).onclick = () => woodSearchSheet(add);
    $$('.o', el).forEach(dragChip);
    $$('[data-sww]', el).forEach(b => b.onclick = () => { const i = +b.dataset.sww; measure({ title: `Strip ${i + 1}: ${woodName(list[i])}`, value: widths[i], min: 1 / 32, max: 6, quick: [.125, .25, .375, .5, .625, .75, 1], onSet: v => { widths[i] = v; onChange(list); draw(); } }); });
    $('#swLook', el)?.addEventListener('click', () => matchLook(list, widths, art, () => { onChange(list); draw(); }));
    $('#swSame', el)?.addEventListener('click', () => measure({ title: 'Every strip', value: widths[0], min: 1 / 32, max: 6, quick: [.25, .375, .5, .625, .75, 1], onSet: v => { widths.fill(v); onChange(list); draw(); } }));
  }
  function dragChip(o) {
    let sx = null, sy, moved = false; const from = +o.dataset.i;
    o.onpointerdown = e => { sx = e.clientX; sy = e.clientY; moved = false; o.setPointerCapture(e.pointerId); };
    o.onpointermove = e => {
      if (sx == null) return;
      if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) { moved = true; o.classList.add('drag'); }
      if (!moved) return;
      $$('.o', el).forEach(x => x.classList.remove('over'));
      const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('.o'); if (t && t !== o) t.classList.add('over');
    };
    o.onpointerup = e => {
      if (sx == null) return; sx = null;
      if (!moved) { list.splice(from, 1); if (W) widths.splice(from, 1); onChange(list); draw(); return; }
      const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('.o');
      if (t && t !== o) { const to = +t.dataset.i, [x] = list.splice(from, 1); list.splice(to, 0, x); if (W) { const [y] = widths.splice(from, 1); widths.splice(to, 0, y); } onChange(list); }
      draw();
    };
    o.onpointercancel = () => { sx = null; draw(); };
  }
  draw();
}
function woodSearchSheet(onPick, over = false) {
  openSheet(`<h2>Add a wood</h2><div class="search" style="margin-bottom:10px">${ICON.search}<input id="wq" placeholder="Search ${allWoods().length} woods" autocomplete="off"></div><div class="card flush" id="wr" style="max-height:52vh;overflow:auto"></div>
    <p class="note">Picking one also checks it into your shop.</p>`, { over });
  const pick = id => { if (!S.shop.includes(id)) { S.shop.push(id); save(); } closeSheet(); onPick(id); };
  const draw = () => {
    const raw = $('#wq').value.trim(), { hits, guesses } = findWoods(raw);
    const inShop = w => S.shop.includes(w.id) ? '<span class="chip avail">In shop</span>' : '';
    let html = hits.slice(0, 80).map(w => `<button class="listrow" data-w="${w.id}">${woodRow(w, inShop(w))}</button>`).join('');
    if (!hits.length && raw) {
      html = (guesses.length ? `<div class="listrow small muted">Did you mean…</div>` + guesses.map(w => `<button class="listrow" data-w="${w.id}">${woodRow(w, inShop(w))}</button>`).join('') : '')
        + `<button class="listrow add" id="addNew">+ Add "${esc(raw)}" as a new wood</button>`;
    }
    if (!raw) html += `<button class="listrow add" id="idPhoto">Not sure what it is? Identify it from a photo</button>`;
    $('#wr').innerHTML = html;
    $$('[data-w]', $('#wr')).forEach(b => b.onclick = () => pick(b.dataset.w));
    $('#addNew')?.addEventListener('click', () => { closeAllSheets(); newWoodFlow(raw, pick); });
    $('#idPhoto')?.addEventListener('click', () => { closeAllSheets(); identifyWood(pick); });
  };
  $('#wq').oninput = draw; draw(); setTimeout(() => $('#wq')?.focus(), 60);
}
// A wood that isn't in the library: Claude fills in the color, origin and story, then it's saved as a custom wood.
function woodPrompt(name) {
  return `I'm logging a handmade piece made from "${name}" wood. Reply with exactly these five lines and nothing else:\nName: (the common name of this wood, correctly spelled)\nColor: (hex color of the finished wood, like #8a5a3c)\nGrain color: (a slightly different hex for its grain lines)\nFrom: (where it grows, a few words)\nJanka: (typical Janka hardness in lbf, number only, or unknown)\nStory: (one or two warm, factual sentences a customer would enjoy reading about this wood)`;
}
function parseWoodReply(t) {
  const get = k => { const m = String(t).match(new RegExp('^\\s*\\**' + k + '\\**\\s*:\\s*(.+)$', 'im')); return m ? m[1].trim() : ''; };
  const hex = v => (v.match(/#[0-9a-f]{6}/i) || [''])[0].toLowerCase();
  return { name: get('Name'), color: hex(get('Color')), color2: hex(get('Grain color')), origin: get('From'), story: get('Story'), janka: parseInt(get('Janka').replace(/[^\d]/g, '')) || null, confidence: get('Confidence') };
}
function idPrompt() {
  return `Identify the wood species in this photo of a board or piece of lumber. If you can't be sure, give your best guess. Reply with exactly these lines and nothing else:\nName: (common name of the wood)\nConfidence: (high, medium or low, plus what would help confirm it, like a clean end-grain photo)\nColor: (hex color of the finished wood, like #8a5a3c)\nGrain color: (a slightly different hex for its grain lines)\nFrom: (where it grows, a few words)\nJanka: (typical Janka hardness in lbf, number only, or unknown)\nStory: (one or two warm, factual sentences a customer would enjoy reading about this wood)`;
}
async function identifyWood(onDone) {
  const [f] = await pickFiles('image/*'); if (!f) return;
  let data; try { data = await resizePhoto(f, 1600); } catch (e) { return toast('Could not read that photo'); }
  stack.push({ view: 'editWood', params: {}, preset: { name: '' }, identify: data, onDone }); render(true); scrollTo(0, 0);
  sendToClaude(data, idPrompt());
}
function sendToClaude(dataUrl, text) {
  const b64 = dataUrl.split(',')[1];
  if (bridge && bridge.shareImageWithText) { bridge.shareImageWithText(b64, 'wood-id.jpg', text); return; }
  copyText(text, 'Prompt copied');
  try { fetch(dataUrl).then(r => r.blob()).then(bl => navigator.share({ files: [new File([bl], 'wood-id.jpg', { type: 'image/jpeg' })], text })).catch(() => {}); } catch (e) {}
}
function newWoodFlow(name, onDone) {
  stack.push({ view: 'editWood', params: {}, preset: { name }, onDone }); render(true); scrollTo(0, 0);
}

/* ---------- Views ---------- */
const VIEWS = {};
let pieceFilter = 'all', pieceQuery = '';
function pieceText(p) {
  const bd = p.board ? [boardTitle(p.board)] : [];
  return norm([`no ${p.no} ${pad(p.no)}`, typeName(p), ...p.woods.map(woodName), p.soldTo, p.notes, p.special, p.finish, statusWord(p.status), ...bd].join(' '));
}
const statusWord = s => s === 'sold' ? 'sold' : s === 'available' ? 'finished for sale' : 'building';
function pieceCard(p) {
  const price = p.price ? `$${esc(String(p.price).replace(/^\$/, ''))}` : '';
  return `<button class="piece" data-id="${p.id}">
    <div class="thumb">${p.photos?.length ? `<img data-photo="${p.photos[0]}" alt="">` : (pieceArt(p) || '')}</div>
    <div class="meta"><div class="row" style="gap:8px"><div class="no">No. ${pad(p.no)}</div>${price ? `<div class="no" style="flex:none;color:var(--text)">${price}</div>` : ''}</div>
      <div class="nm">${esc(typeName(p))}</div>
      <div class="lc">${squiggle(stageOf(p), { w: 64, sw: 3.5, amp: 2.2, wl: 16 })}${statusChip(p.status)}</div>
      ${p.woods.length ? `<div class="woodline">${colsOf(p).map(w => `<i style="background:${w.color};flex:${w.w || 1}"></i>`).join('')}</div>` : ''}</div></button>`;
}

VIEWS.pieces = () => {
  setTop('Pieces');
  const v = $('#view');
  if (!S.pieces.length) {
    const demo = BD.draw(newBoard(), woodById, 11);
    v.innerHTML = `<div class="empty-state">${logoSrc() ? `<img class="shoplogo" src="${esc(logoSrc())}" alt="" style="width:230px;margin:0 auto 26px">` : ''}<div style="width:180px;margin:0 auto">${demo}</div><h3>Your first piece</h3><p>Log what you make. Bench numbers it, writes its story, builds the listing and makes a QR tag for the buyer.</p><button class="btn primary" id="first">${ICON.plus.replace('<svg', '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"')} Log a piece</button></div>`;
    $('#first').onclick = () => go('editPiece', {});
    return;
  }
  const names = [...new Set(S.pieces.map(typeName))];
  const filters = [['all', 'All'], ['building', 'Building'], ['available', 'Finished'], ['sold', 'Sold'], ...names.map(n => ['t:' + n, n])];
  if (!filters.some(f => f[0] === pieceFilter)) pieceFilter = 'all';
  v.innerHTML = `
    <div class="search">${ICON.search}<input id="pq" type="search" placeholder="Search number, wood, buyer…" value="${esc(pieceQuery)}" autocomplete="off"></div>
    <div class="filters">${filters.map(([k, l]) => `<button data-f="${esc(k)}" class="${pieceFilter === k ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>
    <div id="plist"></div><div style="height:70px"></div>`;
  const draw = () => {
    let list = [...S.pieces].sort((a, b) => b.no - a.no);
    if (pieceFilter.startsWith('t:')) list = list.filter(p => typeName(p) === pieceFilter.slice(2));
    else if (pieceFilter !== 'all') list = list.filter(p => p.status === pieceFilter);
    const q = norm(pieceQuery); if (q) list = list.filter(p => q.split(' ').every(w => pieceText(p).includes(w)));
    $('#plist').innerHTML = list.map(pieceCard).join('') || `<p class="muted center" style="margin-top:30px">${q ? 'Nothing matches that.' : 'Nothing here yet.'}</p>`;
    $$('.piece', v).forEach(b => b.onclick = () => go('piece', { id: b.dataset.id }));
    fillPhotos($('#plist'));
  };
  longPress($('#plist'), '.piece', el => pieceMenu(S.pieces.find(x => x.id === el.dataset.id)));
  $('#pq').oninput = () => { pieceQuery = $('#pq').value; draw(); };
  $$('[data-f]', v).forEach(b => b.onclick = () => { pieceFilter = b.dataset.f; $$('[data-f]', v).forEach(x => x.classList.toggle('on', x === b)); draw(); });
  draw();
  fab(() => go('editPiece', {}), 'New piece', true);
};

VIEWS.piece = ({ id }) => {
  const p = S.pieces.find(x => x.id === id); if (!p) return back();
  const type = typeById(p.type);
  p.buildPhotos ??= [];
  setTop(`No. ${pad(p.no)}`, `<button class="icon" id="dup" aria-label="Make another">${ICON.copy}</button><button class="icon" id="edit" aria-label="Edit">${ICON.edit}</button>`);
  const v = $('#view');
  const art = pieceArt(p, viewMode), wc = woodCost(p), pr = num$(p.price);
  const sub = [p.date ? monthYear(p.date) : '', type.board && p.board ? boardTitle(p.board) : '', type.bowl && p.bowl ? `${B.SHAPES[p.bowl.shape]?.name || ''}` : ''].filter(Boolean).join(' · ');
  const tools = (type.board || type.bowl) && art ? `<div class="pvbar"><span class="pvtag">${type.board ? dimsHTML(p.board) : `${fracHTML(p.bowl.D)} × ${fracHTML(p.bowl.H)}`}</span><span class="tools"><button class="mini" id="b3d">${ICON.cube}3D</button>${type.board || (p.bowl && p.bowl.kind === 'seg') ? `<button class="mini" id="${type.board ? 'bdcut' : 'bcut'}">${ICON.list}Cut list</button>` : ''}</span></div>` : '';
  v.innerHTML = `
    ${p.photos?.length ? `<div class="hero"><img data-photo="${p.photos[0]}" alt=""></div>` : ''}
    ${p.photos?.length > 1 ? `<div class="photos" style="margin-bottom:14px">${p.photos.slice(1).map(ph => `<div class="ph"><img data-photo="${ph}" alt=""></div>`).join('')}</div>` : ''}
    ${art ? `<div class="preview ${tools ? 'bar' : ''}" id="pv" style="margin-bottom:10px">${art}${tools}</div>${type.slots.length ? `<div style="margin-bottom:16px">${modeSeg(viewMode)}</div>` : ''}` : ''}
    <div class="dtitle">${esc(typeName(p))}</div>
    <div class="muted small" style="margin-top:4px">${esc(sub)}</div>
    <div style="margin:16px 2px 8px" id="lcq"></div>
    <div class="seg" id="stage">${[['building', 'Building'], ['available', 'Finished'], ['sold', 'Sold']].map(([k, l]) => `<button data-stage="${k}" ${k === 'sold' ? 'id="markSold"' : ''} class="${p.status === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="actions"><button class="btn primary" id="list">${ICON.share} Listing</button><button class="btn" id="qr">${ICON.qr} QR tag</button></div>
    ${pr != null || wc ? `<div class="money" style="margin-bottom:14px"><div><b>${pr != null ? fmt$(pr) : '—'}</b><span>Price</span></div><div><b>${wc ? fmt$(wc.v) : '—'}</b><span>Wood${wc && wc.est ? ' (est.)' : ''}</span></div><div><b>${pr != null && wc ? fmt$(pr - wc.v) : '—'}</b><span>Profit</span></div></div>` : ''}
    <div class="card"><dl class="kv">
      ${type.slots.map(s => { const t = tplById((p.templates || {})[s.name]); return t ? `<dt>${esc(s.name)}</dt><dd>${esc(t.code)} · ${esc(t.name)}</dd>` : ''; }).join('')}
      ${type.bowl && p.bowl ? `<dt>Bowl</dt><dd>${esc(p.bowl.kind === 'seg' ? `Segmented · ${p.bowl.rings.length} rings + base · ${B.pieceCount(p.bowl)} pieces` : p.bowl.kind === 'epoxy' ? 'Solid with epoxy' : 'Solid')}</dd><dt>Size</dt><dd>${fracHTML(p.bowl.D)} × ${fracHTML(p.bowl.H)} tall</dd>` : ''}
      ${type.board && p.board ? `<dt>Board</dt><dd>${esc(boardTitle(p.board))}${p.board.style !== 'edge' ? ' · ' + BD.blocks(p.board) + ' pieces' : ''}</dd><dt>Size</dt><dd>${fracHTML(BD.lengthOf(p.board))} × ${fracHTML(BD.widthOf(p.board))} × ${fracHTML(p.board.T)}</dd>${featList(p.board).length ? `<dt>Touches</dt><dd>${esc(cap(joinList(featList(p.board))))}</dd>` : ''}` : ''}
      ${p.woods.length ? `<dt>Woods</dt><dd>${stripW(p) ? p.woods.map((i, k) => `${esc(woodById(i)?.name || '?')} ${fracHTML(p.widths[k])}`).join(' → ') : esc(p.woods.map(i => woodById(i)?.name || '?').join(type.board || type.bowl ? ', ' : ' → '))}</dd>` : ''}
      ${p.finish ? `<dt>Finish</dt><dd>${esc(p.finish)}</dd>` : ''}
      ${p.size ? `<dt>Size</dt><dd>${esc(p.size)}</dd>` : ''}
      ${p.soldTo ? `<dt>Sold to</dt><dd>${esc(p.soldTo)}${p.soldDate ? `, ${esc(new Date(p.soldDate + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}` : ''}</dd>` : ''}
      ${p.notes ? `<dt>Notes</dt><dd>${esc(p.notes)}</dd>` : ''}
    </dl></div>
    <div class="sec">Build photos <button class="btn small tonal" id="addBuild">+ Add</button></div>
    ${p.buildPhotos.length ? `<div class="timeline">${[...p.buildPhotos].sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(b => `
      <button class="tl" data-b="${b.id}"><img data-photo="${b.id}" alt=""><div class="tlm"><div class="small muted">${esc(b.date ? new Date(b.date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')}</div><div>${esc(b.caption || 'Add a caption')}</div></div></button>`).join('')}</div>`
      : '<p class="note" style="margin-top:0">Glue-up, shaping, first coat of finish. Snap progress pics as you go; they stay with this piece.</p>'}
    <div class="sec">Story <button class="btn small tonal" id="editStory">Edit</button></div>
    <div class="card"><div class="story">${esc(storyOf(p))}</div></div>
    ${p.storyEdited ? `<p class="note">You edited this story. <button class="btn small" id="regen" style="margin-left:6px">Rewrite from details</button></p>` : ''}
    <div style="height:24px"></div>`;
  fillPhotos(v); squigInto($('#lcq'), stageOf(p));
  if (art && type.slots.length) bindMode(v, () => { $('#pv').innerHTML = pieceArt(p, viewMode); }, 'mode', p);
  $('#edit').onclick = () => go('editPiece', { id });
  $('#dup').onclick = () => duplicatePiece(p);
  $('#b3d', v)?.addEventListener('click', () => open3D(p));
  $('#bcut', v)?.addEventListener('click', () => cutListSheet(p));
  $('#bdcut', v)?.addEventListener('click', () => boardCutSheet(p));
  $$('[data-stage]', v).forEach(b => b.onclick = () => {
    const s = b.dataset.stage; if (s === p.status) return;
    if (s === 'sold') return markSoldSheet(p);
    const was = p.status; p.status = s; save(); render();
    if (s === 'available' && was === 'building') askPrint(p);
  });
  $('#list').onclick = () => {
    openSheet(`<h2>Listing</h2><textarea id="lt" style="min-height:260px">${esc(genListing(p))}</textarea>
      <div class="row" style="margin-top:12px"><button class="btn" id="lc">Copy</button><button class="btn primary" id="ls">Share</button></div>`);
    $('#lc').onclick = () => copyText($('#lt').value); $('#ls').onclick = () => shareText($('#lt').value, pieceTitle(p));
  };
  $('#qr').onclick = () => qrSheet(p);
  $('#addBuild').onclick = async () => {
    const ids = []; await addPhotos(ids); if (!ids.length) return;
    ids.forEach(i => p.buildPhotos.push({ id: i, date: today(), caption: '' })); save(); render();
    buildPhotoSheet(p, p.buildPhotos.find(b => b.id === ids[0]));
  };
  $$('[data-b]', v).forEach(b => b.onclick = () => buildPhotoSheet(p, p.buildPhotos.find(x => x.id === b.dataset.b)));
  $('#editStory').onclick = () => storySheet(p);
  $('#regen', v)?.addEventListener('click', () => { p.storyEdited = false; p.story = ''; save(); render(); });
};
function markSoldSheet(p) {
  openSheet(`<h2>Mark No. ${pad(p.no)} sold</h2><label class="f">Sold to <span>(optional)</span></label><input id="sto" value="${esc(p.soldTo || '')}" placeholder="Name">
    <div class="row"><div><label class="f">Price</label><input id="spr" inputmode="decimal" value="${esc(p.price || '')}" placeholder="$"></div><div><label class="f">Date</label><input id="sdt" type="date" value="${esc(p.soldDate || today())}"></div></div>
    <button class="btn primary wide" id="sok" style="margin-top:18px">Mark sold</button>`);
  $('#sok').onclick = () => { p.status = 'sold'; p.soldTo = $('#sto').value.trim(); p.price = $('#spr').value.trim(); p.soldDate = $('#sdt').value || today(); save(); closeSheet(); render(); toast(`No. ${pad(p.no)} sold`); };
}
// Same design, woods and template; new number, no photos, back to Building
function duplicatePiece(p) {
  const d = clone(p);
  Object.assign(d, { id: uid(), no: nextNo(), date: today(), status: 'building', photos: [], buildPhotos: [], story: '', storyEdited: false, soldTo: '', soldDate: '', stockUsed: null, cost: '', firstCombo: undefined });
  if (d.board) d.board.done = [];
  stack.push({ view: 'editPiece', params: {}, draft: d }); render(true); scrollTo(0, 0);
  toast(`Copy of No. ${pad(p.no)}. Change anything, then Save.`);
}
const nextNo = () => Math.max(S.settings.nextNumber, ...S.pieces.map(x => x.no + 1));
async function buildPhotoSheet(p, b) {
  if (!b) return;
  openSheet(`<h2>Build photo</h2><div class="hero" style="aspect-ratio:auto"><img id="bimg" alt=""></div>
    <label class="f">Caption</label><input id="bcap" value="${esc(b.caption || '')}" placeholder="e.g. Glue-up, strips 1–7">
    <label class="f">Date</label><input id="bdate" type="date" value="${esc(b.date || today())}">
    <div class="row" style="margin-top:16px"><button class="btn danger" id="bdel">Remove</button><button class="btn primary" id="bok">Save</button></div>`);
  $('#bimg').src = await photoGet(b.id) || '';
  $('#bok').onclick = () => { b.caption = $('#bcap').value.trim(); b.date = $('#bdate').value; save(); closeSheet(); render(); };
  $('#bdel').onclick = () => { p.buildPhotos = p.buildPhotos.filter(x => x !== b); photoDel(b.id); save(); closeSheet(); render(); };
}
function storySheet(p) {
  openSheet(`<h2>Story</h2><textarea id="st" style="min-height:300px">${esc(storyOf(p))}</textarea>
    <div class="row" style="margin-top:12px"><button class="btn" id="sr">Rewrite</button><button class="btn" id="sc">Polish with Claude</button></div>
    <p class="note" id="sch" hidden>Copied. Paste it into the Claude app, then paste Claude's story into the box above and tap Save.</p>
    <button class="btn primary wide" id="ss" style="margin-top:10px">Save</button>`);
  $('#sr').onclick = () => { $('#st').value = genStory({ ...p, id: p.id + uid() }); };
  $('#sc').onclick = () => { copyText(claudePrompt(p), 'Copied for Claude'); $('#sch').hidden = false; };
  $('#ss').onclick = () => { const t = $('#st').value.trim(); p.storyEdited = t !== genStory(p); p.story = t; save(); closeSheet(); render(); };
}

async function qrSheet(p) {
  const link = S.settings.pageUrl ? (await readyLinks([p]))[0] : null;
  if (!link) {
    openSheet(`<h2>QR tag</h2><p class="muted">The QR code opens your story page, which needs a home on the web first. Set it up once (about 5 minutes) and Bench handles it from then on.</p>
      <p class="note">Until then you can still preview what the buyer will see.</p>
      <div class="row" style="margin-top:16px"><button class="btn" id="qpv">Preview page</button><button class="btn primary" id="qset">Set up</button></div>`);
    $('#qpv').onclick = async () => { closeSheet(); location.href = 'story.html' + await pageHash(p); };
    $('#qset').onclick = () => pageSetupSheet(() => qrSheet(p));
    return;
  }
  try { await document.fonts.load('600 76px Fraunces'); } catch (e) {}
  const tag = tagCanvas(p, link, await loadImg(logoSrc()));
  openSheet(`<h2>QR tag · No. ${pad(p.no)}</h2><div class="qrbox"><img src="${tag.toDataURL()}" alt="QR tag"></div>
    <p class="note">Print it at least 2.5 inches wide as a hang tag or card. Scanning it opens this piece&rsquo;s story page.</p>
    <div class="row" style="margin-top:12px"><button class="btn" id="qsave">Save</button><button class="btn" id="qshare">Share</button><button class="btn" id="qpv">Preview</button></div>
    <button class="btn primary block" id="qcard" style="margin-top:12px">Print a card</button>`);
  $('#qcard').onclick = () => printCardsSheet(p);
  $('#qsave').onclick = () => saveImage(tag, `bench-tag-${pad(p.no)}.png`, false);
  $('#qshare').onclick = () => saveImage(tag, `bench-tag-${pad(p.no)}.png`, true);
  $('#qpv').onclick = () => openUrl(link);
}

/* ---------- Bowls ---------- */
function bowlWoods(bw) {
  if (!bw) return [];
  if (bw.kind !== 'seg') return bw.wood ? [bw.wood] : [];
  const out = [bw.base]; bw.rings.forEach(r => B.segWoods(r).flat().forEach(w => out.push(w)));
  return [...new Set(out.filter(Boolean))];
}
const bowlSize = bw => `${B.frac(bw.D).replace('"', '')}" across and ${B.frac(bw.H).replace('"', '')}" tall`;
function shapeIcon(key) {
  const pts = B.SHAPES[key].pts, path = [];
  pts.forEach(([t, r]) => path.push([24 + r * 20, 36 - t * 28])); const left = [...path].reverse().map(([x, y]) => [48 - x, y]);
  return `<svg viewBox="0 0 48 40" width="44" height="36"><path d="M${[...left, ...path].map(p => p.map(n => n.toFixed(1)).join(',')).join(' L')}Z" fill="currentColor" opacity=".85"/></svg>`;
}
function woodChips(selected, multi, id = 'wchips') {
  const ws = shopWoods(); selected.forEach(x => { if (!ws.some(w => w.id === x)) { const w = woodById(x); if (w) ws.push(w); } });
  return `<div class="woodlist" id="${id}">${ws.map(w => { const i = selected.indexOf(w.id); return `<button class="wood ${i >= 0 ? 'picked' : ''}" data-cw="${w.id}"><span class="sw" style="background:linear-gradient(90deg,${w.color},${w.color2 || w.color})"></span><span class="wn">${esc(w.name)}</span>${i >= 0 ? `<span class="cnt">${multi ? i + 1 : '✓'}</span>` : ''}</button>`; }).join('')}
    <button class="wood other" data-cw="+"><span class="sw plus">+</span><span class="wn">Other wood</span></button></div>`;
}
function bowlEditor(el, p, changed) {
  const bw = p.bowl;
  const draw = () => {
    const seg = bw.kind === 'seg';
    el.innerHTML = `
      <div class="tray"><div class="tray-h">Bowl</div>
      <div class="seg" id="bk">${[['seg', 'Segmented'], ['solid', 'Solid'], ['epoxy', 'Epoxy fill']].map(([k, l]) => `<button data-bk="${k}" class="${bw.kind === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <label class="f">Shape</label>
      <div class="filters">${Object.entries(B.SHAPES).map(([k, sh]) => `<button data-sh="${k}" class="shapebtn ${bw.shape === k ? 'on' : ''}">${shapeIcon(k)}<span>${esc(sh.name)}</span></button>`).join('')}</div>
      <div class="row">${measBtn('bD', 'Diameter', bw.D)}${measBtn('bH', 'Height', bw.H)}${measBtn('bWl', 'Wall', bw.wall)}</div>
      ${seg ? `<div class="row" style="margin-top:8px">${measBtn('bR', 'Ring thickness', bw.ringH)}<div class="note" style="margin:0">${bw.rings.length} rings come out ${B.frac(B.ringHeight(bw))} each after the base</div></div>` : ''}
      </div>
      ${seg ? `
      <div class="tray"><div class="tray-h">Base</div>
      <button class="card listrow" id="bBase" style="border-radius:16px">${woodRow(woodById(bw.base) || { name: 'Pick a wood', color: '#555' }, '<span class="chip">Solid disc</span>')}</button></div>
      <div class="tray"><div class="tray-h">Rings <span class="small muted">top first · tap to edit</span></div>
      <div class="card flush">${bw.rings.map((r, i) => i).reverse().map(i => { const r = bw.rings[i], rows = B.segWoods(r); return `<button class="listrow" data-ring="${i}">
        <div style="flex:0 0 46px"><div class="t">${i + 1}</div><div class="s">${r.n} seg</div></div>
        <div class="grow">${rows.map(row => `<div class="strip" style="height:10px;margin:3px 0">${row.map(w => `<i style="background:${(woodById(w) || { color: '#555' }).color}"></i>`).join('')}</div>`).join('')}
          <div class="s">${esc({ solid: 'Solid', alt: 'Alternating', checker: 'Checker', custom: 'Custom' }[r.pat] || '')}${r.off ? ' · offset' : ''}</div></div></button>`; }).join('')}</div></div>` : `
      <div class="tray"><div class="tray-h">Wood</div>${woodChips(bw.wood ? [bw.wood] : [], false, 'bsw')}
      ${bw.kind === 'epoxy' ? `<label class="f">Epoxy color</label><input id="bEp" value="${esc(bw.epoxy || '')}" placeholder="e.g. Deep blue, black, clear">` : ''}</div>`}`;
    $$('[data-bk]', el).forEach(b => b.onclick = () => { bw.kind = b.dataset.bk; if (bw.kind !== 'seg' && !bw.wood) bw.wood = bw.base || S.shop[0]; draw(); changed(); });
    $$('[data-sh]', el).forEach(b => b.onclick = () => { bw.shape = b.dataset.sh; draw(); changed(); });
    const num = (sel, key, title, min, max, refit, quick) => $(sel, el)?.addEventListener('click', () => measure({ title, value: bw[key], min, max, quick,
      info: refit ? v => { const t = clone(bw); t[key] = v; B.fitRings(t); return `${t.rings.length} rings of ${esc(B.frac(B.ringHeight(t)))} above the base`; } : null,
      onSet: v => { bw[key] = v; if (refit) B.fitRings(bw); draw(); changed(); } }));
    num('#bD', 'D', 'Diameter', 2, 30, false, [6, 8, 10, 12, 14]); num('#bH', 'H', 'Height', 1, 24, true, [2, 3, 4, 5, 6, 8]);
    num('#bWl', 'wall', 'Wall thickness', .125, 1, false, [.25, .3125, .375, .5]); num('#bR', 'ringH', 'Ring thickness', .25, 3, true, [.5, .625, .75, 1]);
    $('#bBase', el)?.addEventListener('click', () => pickOneWood(bw.base, id => { bw.base = id; draw(); changed(); }));
    $$('[data-ring]', el).forEach(b => b.onclick = () => ringSheet(bw, +b.dataset.ring, () => { draw(); changed(); }));
    $$('#bsw [data-cw]', el).forEach(b => b.onclick = () => {
      if (b.dataset.cw === '+') return woodSearchSheet(id => { bw.wood = id; draw(); changed(); });
      bw.wood = b.dataset.cw; draw(); changed();
    });
    $('#bEp', el)?.addEventListener('change', () => { bw.epoxy = $('#bEp', el).value.trim(); changed(); });
  };
  draw();
}
function pickOneWood(cur, onPick, title = 'Pick a wood') {
  openSheet(`<h2>${esc(title)}</h2>${woodChips(cur ? [cur] : [], false, 'p1')}`);
  $$('#p1 [data-cw]').forEach(b => b.onclick = () => { if (b.dataset.cw === '+') return woodSearchSheet(onPick); closeSheet(); onPick(b.dataset.cw); });
}
function ringSheet(bw, i, done) {
  const r = JSON.parse(JSON.stringify(bw.rings[i]));
  let paint = r.woods[0] || S.shop[0];
  const counts = [6, 8, 10, 12, 14, 16, 18, 20, 24];
  const draw = () => {
    const multi = r.pat !== 'solid' && r.pat !== 'custom';
    openSheet(`<h2>Ring ${i + 1}${i === bw.rings.length - 1 ? ' (top)' : ''}</h2>
      <div class="ringtop" id="rt">${B.ringTop(r, woodById)}</div>
      <label class="f">Segments</label><div class="filters">${counts.map(n => `<button data-n="${n}" class="${r.n === n ? 'on' : ''}">${n}</button>`).join('')}</div>
      <label class="f">Pattern</label><div class="seg">${[['solid', 'Solid'], ['alt', 'Alternating'], ['checker', 'Checker'], ['custom', 'Custom']].map(([k, l]) => `<button data-p="${k}" class="${r.pat === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <label class="f">${r.pat === 'solid' ? 'Wood' : r.pat === 'custom' ? 'Pick a wood, then tap segments above' : 'Woods, in order around the ring'}</label>
      ${woodChips(r.pat === 'custom' ? [paint] : (r.pat === 'solid' ? r.woods.slice(0, 1) : r.woods), multi, 'rw')}
      <button class="swrow" id="roff" style="margin-top:10px"><div class="grow"><div class="t">Offset half a segment</div><div class="s">Bricklays the glue lines over the ring below</div></div><span class="switch ${r.off ? 'on' : ''}"><i></i></span></button>
      ${r.pat === 'checker' ? '<p class="note">A checker ring is two thin rows glued up as one ring, each half the ring thickness.</p>' : ''}
      <div class="row" style="margin-top:14px"><button class="btn" id="rAbove">Use for rings above</button><button class="btn" id="rAll">Use for all</button></div>
      <button class="btn primary wide" id="rok" style="margin-top:10px">Done</button>`);
    $$('[data-n]').forEach(b => b.onclick = () => { r.n = +b.dataset.n; if (r.segs) r.segs = Array.from({ length: r.n }, (_, k) => r.segs[k] || r.woods[k % r.woods.length]); draw(); });
    $$('[data-p]').forEach(b => b.onclick = () => {
      const was = r.pat; r.pat = b.dataset.p;
      if (r.pat === 'custom' && was !== 'custom') r.segs = B.segWoods({ ...r, pat: was })[0].slice();
      if ((r.pat === 'alt' || r.pat === 'checker') && r.woods.length < 2) r.woods.push(S.shop.find(x => x !== r.woods[0]) || 'maple');
      draw();
    });
    $$('#rw [data-cw]').forEach(b => b.onclick = () => {
      const id = b.dataset.cw;
      const apply = wid => {
        if (r.pat === 'custom') { paint = wid; if (!r.woods.includes(wid)) r.woods.push(wid); }
        else if (r.pat === 'solid') r.woods = [wid];
        else { const k = r.woods.indexOf(wid); if (k >= 0) { if (r.woods.length > 1) r.woods.splice(k, 1); } else if (r.woods.length < 6) r.woods.push(wid); }
        draw();
      };
      if (id === '+') return woodSearchSheet(apply);
      apply(id);
    });
    $$('#rt [data-seg]').forEach(seg => seg.onclick = () => {
      if (r.pat !== 'custom') { r.segs = B.segWoods(r)[0].slice(); r.pat = 'custom'; }
      r.segs[+seg.dataset.seg] = paint; draw();
    });
    $('#roff').onclick = () => { r.off = !r.off; draw(); };
    const commit = list => { list.forEach(k => { bw.rings[k] = { ...JSON.parse(JSON.stringify(r)), off: k === i ? r.off : ((k - i) % 2 ? !r.off : r.off) }; }); closeSheet(); done(); };
    $('#rok').onclick = () => commit([i]);
    $('#rAbove').onclick = () => commit(bw.rings.map((_, k) => k).filter(k => k >= i));
    $('#rAll').onclick = () => commit(bw.rings.map((_, k) => k));
  };
  draw();
}
function cutListText(p) {
  const bw = p.bowl, c = B.cutList(bw), L = [];
  L.push(`Cut list: ${pieceTitle(p)} (${B.SHAPES[bw.shape].name}, ${B.frac(bw.D)} × ${B.frac(bw.H)})`);
  L.push(`Rings ${B.frac(B.ringHeight(bw))} thick, 1/8" turning allowance each side.`); L.push('');
  if (c.base) L.push(`Base: ${woodName(c.base.wood)} disc, ${B.frac(c.base.size)} square × ${B.frac(c.base.thick)} thick`);
  [...c.rings].filter(r => !r.base).reverse().forEach(r => {
    const counts = {}; r.rows.flat().forEach(w => counts[w] = (counts[w] || 0) + 1);
    L.push(`Ring ${r.i + 1}: ${r.ring.n} segments, miter ${+r.miter.toFixed(2)}°, outside ${B.frac(r.outer, 32)}, strip ${B.frac(r.width)} wide${r.rows.length > 1 ? ', two rows' : ''} — ${Object.entries(counts).map(([w, n]) => `${n} ${woodName(w)}`).join(', ')}`);
  });
  L.push(''); L.push('Strip stock (with 1/8" kerf + 10% extra):');
  c.woods.forEach(e => L.push(`• ${woodName(e.wood)}: ${B.ft(e.length)} of ${B.frac(e.width)} × ${B.frac(e.thick)} (${e.pieces} pieces)`));
  return L.join('\n');
}
function cutListSheet(p) {
  const bw = p.bowl, c = B.cutList(bw);
  const draw = () => {
    openSheet(`<h2>Cut list</h2>
    <p class="note" style="margin:-8px 0 14px">${esc(B.SHAPES[bw.shape].name)} · ${B.frac(bw.D)} × ${B.frac(bw.H)} · rings ${B.frac(B.ringHeight(bw))} thick · 1/8" turning allowance each side</p>
    ${c.base ? `<div class="card" style="margin-bottom:10px"><div class="t" style="font-weight:600">Base</div><div class="small">${esc(woodName(c.base.wood))} disc, ${B.frac(c.base.size)} square × ${B.frac(c.base.thick)} thick</div></div>` : ''}
    <div class="card flush cut">${[...c.rings].filter(r => !r.base).reverse().map(r => {
      const counts = {}; r.rows.flat().forEach(w => counts[w] = (counts[w] || 0) + 1);
      return `<div class="listrow" style="align-items:flex-start"><div style="flex:0 0 52px"><div class="t">Ring ${r.i + 1}</div><div class="s">${r.ring.n} seg${r.rows.length > 1 ? ' ×2' : ''}</div></div>
        <div class="grow"><div class="cutgrid"><span>Miter</span><b>${+r.miter.toFixed(2)}°</b><span>Outside</span><b>${B.frac(r.outer, 32)}</b><span>Strip width</span><b>${B.frac(r.width)}</b><span>Ring OD</span><b>${B.frac(2 * r.ro)}</b></div>
        <div class="s" style="margin-top:4px">${Object.entries(counts).map(([w, n]) => `${n} ${esc(woodName(w))}`).join(' · ')}</div></div></div>`;
    }).join('')}</div>
    <div class="sec">Strip stock to mill</div>
    <div class="card flush">${c.woods.map(e => `<div class="listrow">${swatch(woodById(e.wood) || { color: '#555' }, 30)}<div class="grow"><div class="t">${esc(woodName(e.wood))}</div><div class="s">${e.pieces} pieces</div></div><div style="text-align:right"><div class="t">${B.ft(e.length)}</div><div class="s">${B.frac(e.width)} × ${B.frac(e.thick)}</div></div></div>`).join('')}</div>
    <p class="note">Lengths include a 1/8" kerf per cut and 10% extra. Segments are cut from a strip flipping end for end, so each one uses about its average length.</p>
    ${stockBlock(p)}
    <div class="row" style="margin-top:14px"><button class="btn" id="cc">Copy</button><button class="btn primary" id="cs">Share</button></div>`);
    $('#cc').onclick = () => copyText(cutListText(p)); $('#cs').onclick = () => shareText(cutListText(p), 'Cut list');
    bindStock(p, draw);
  };
  draw();
}
// Wood needed vs on hand, the cost, and a button to take it out of (or put it back in) stock
function stockBlock(p) {
  const needs = woodNeeds(p); if (!needs.length) return '';
  let total = 0, priced = true, tracked = false; const unpriced = [];
  const rows = needs.map(n => {
    const need = n.bf * ROUGH, st = stockOf(n.wood), used = p.stockUsed && p.stockUsed[n.wood];
    if (st.cost > 0) total += need * st.cost; else { priced = false; unpriced.push(woodName(n.wood).toLowerCase()); }
    let line = '';
    if (st.bf != null) { tracked = true; const have = st.bf + (used || 0), short = have + 1e-9 < need; line = `<div class="need ${short ? 'short' : 'ok'}">${short ? `Short ${fmtBf(need - have)} bd ft` : `${fmtBf(have)} on hand`}</div>`; }
    return `<div class="listrow">${swatch(woodById(n.wood) || { color: '#555' }, 30)}<div class="grow"><div class="t">${esc(woodName(n.wood))}</div><div class="s">${fmtBf(n.bf)} bd ft milled${st.cost > 0 ? ` · ${fmt$(need * st.cost)}` : ''}</div></div><div style="text-align:right"><div class="t">${fmtBf(need)} bd ft</div>${line}</div></div>`;
  }).join('');
  const saved = S.pieces.includes(p);
  return `<div class="sec">Wood to pull <span class="small muted">rough lumber, +30% for milling</span></div>
    <div class="card flush">${rows}</div>
    ${priced ? `<p class="note">About ${fmt$(total)} of wood at your prices.</p>` : total > 0 ? `<p class="note">About ${fmt$(total)} so far. Add a price for ${esc(joinList(unpriced))} (Woods tab) to see the full cost.</p>` : '<p class="note">Add what you pay per board foot on each wood (Woods tab) to see what it costs.</p>'}
    ${tracked ? (saved ? `<button class="btn tonal wide" id="useStock" style="margin-top:6px">${p.stockUsed ? 'Put the wood back in stock' : 'Take it out of stock'}</button>` : '<p class="note">Save the piece to take its wood out of stock.</p>') : ''}`;
}
function bindStock(p, redraw) {
  $('#useStock')?.addEventListener('click', () => {
    if (p.stockUsed) {
      Object.entries(p.stockUsed).forEach(([w, bf]) => { if (S.stock[w]) S.stock[w].bf = +(S.stock[w].bf + bf).toFixed(3); });
      p.stockUsed = null; save(); toast('Put back in stock');
    } else {
      const used = {};
      woodNeeds(p).forEach(n => { const st = S.stock[n.wood]; if (st && st.bf != null) { const take = n.bf * ROUGH; st.bf = +Math.max(0, st.bf - take).toFixed(3); used[n.wood] = take; } });
      p.stockUsed = used;
      const wc = woodCost(p); if (wc && wc.est && !String(p.cost || '').trim()) p.cost = Math.round(wc.v);
      save(); toast('Taken out of stock', { action: 'Undo', onAction: () => { Object.entries(used).forEach(([w, bf]) => { if (S.stock[w]) S.stock[w].bf = +(S.stock[w].bf + bf).toFixed(3); }); p.stockUsed = null; save(); redraw(); } });
    }
    redraw();
  });
}

// Strip direction + grain toggle under a template piece preview
function angleRow(o) {
  const a = o.angle || 0;
  return `<div class="anglerow"><div class="small muted">Strips</div>
    <div class="seg" id="ang">${[[0, 'Along'], [90, 'Across'], [45, '↗'], [-45, '↘']].map(([d, l]) => `<button data-ang="${d}" class="${a === d ? 'on' : ''}">${l}</button>`).join('')}</div>
    <input type="range" id="angr" min="-90" max="90" step="5" value="${a}">
    <button class="chip ${GR.on ? 'avail' : ''}" id="gtog">Grain ${GR.on ? 'on' : 'off'}</button></div>`;
}
function bindAngle(root, o, redraw) {
  const set = d => { o.angle = d; $$('[data-ang]', root).forEach(x => x.classList.toggle('on', +x.dataset.ang === d)); const r = $('#angr', root); if (r) r.value = d; redraw(); };
  $$('[data-ang]', root).forEach(b => b.onclick = () => set(+b.dataset.ang));
  $('#angr', root)?.addEventListener('input', e => set(+e.target.value));
  $('#gtog', root)?.addEventListener('click', e => { GR.on = !GR.on; S.settings.grain = GR.on; save(); e.target.textContent = 'Grain ' + (GR.on ? 'on' : 'off'); e.target.classList.toggle('avail', GR.on); redraw(); });
}

/* ---------- Boards ---------- */
const patName = bd => bd.style === 'multi' ? (bd.name || 'Two-step') : bd.style === 'end' ? (BD.PATTERNS[bd.pattern]?.name || 'End grain') : (bd.preset === 'pinstripe' ? 'Pinstripe' : 'Stripes');
const styleName = bd => bd.style === 'multi' ? 'Two-step end grain' : BD.STYLES[bd.style] || '';
const boardTitle = bd => bd.style === 'edge' ? 'Edge grain' + (bd.preset === 'pinstripe' ? ' · Pinstripe' : '') : `${styleName(bd)} · ${patName(bd)}`;
const boardThumb = bd => BD.draw(bd, woodById, 3, { plain: true });
const dimsText = bd => `${BD.frac(BD.lengthOf(bd))} × ${BD.frac(BD.widthOf(bd))} × ${BD.frac(bd.T)}`;
const dimsHTML = bd => `${fracHTML(BD.lengthOf(bd))} × ${fracHTML(BD.widthOf(bd))} × ${fracHTML(bd.T)}`;
// Woods to carry into a new pattern: the board's own first, then the shop's
const carryWoods = bd => [...BD.woods(bd), ...S.shop].filter((x, i, a) => a.indexOf(x) === i);
const presetWoods = (id, ws) => ['brick', 'windowpane', 'framed'].includes(id) ? contrastPair(ws) : ws;
function patternSheet(bd, onPick) {
  const ws = carryWoods(bd);
  const tile = pr => `<button class="preset ${bd.preset === pr.id ? 'on' : ''}" data-pre="${pr.id}"><div class="pthumb">${BD.draw(BD.applyPreset(bd, pr.id, presetWoods(pr.id, ws)), woodById, 3, { plain: true })}</div><span>${esc(pr.name)}</span></button>`;
  openSheet(`<h2>Choose a pattern</h2><p class="note" style="margin-top:-8px">Shown in your woods, at about the size you set.</p>
    ${[['edge', 'Edge grain'], ['end', 'End grain'], ['multi', 'Two-step, end grain']].map(([g, l]) => `<div class="glabel">${l}</div><div class="pgrid">${BD.PRESETS.filter(p => p.group === g).map(tile).join('')}</div>`).join('')}
    <div class="glabel">Your own</div>
    <div class="card flush"><button class="listrow add" id="bdImport">Import a cuttingboarddesigner.com link</button><button class="listrow add" id="bdCustom">Write your own two-step recipe</button></div>`);
  $$('[data-pre]').forEach(b => b.onclick = () => { closeSheet(); onPick(BD.applyPreset(bd, b.dataset.pre, presetWoods(b.dataset.pre, ws))); });
  $('#bdImport').onclick = () => importBoardSheet(nb => onPick(nb));
  $('#bdCustom').onclick = () => { closeSheet(); const k = carryWoods(bd); onPick(BD.fix({ style: 'multi', name: 'Custom', T: bd.T, profile: bd.profile, groove: bd.groove, grips: bd.grips, feet: bd.feet, keys: { A: k[0] || 'walnut', B: k[1] || 'maple' }, panels: { A: '(1.5A 1.5B)x4' }, rows: '(1.5A 1.5A^)x5' })); };
}
function boardEditor(el, p, changed) {
  const bd = p.board;
  const replace = nb => { Object.keys(bd).forEach(k => delete bd[k]); Object.assign(bd, nb); };
  const commit = () => { BD.fix(bd); draw(); changed(); };
  const list = () => bd.style === 'edge' ? bd.edge : bd.strips;
  const draw = () => {
    BD.fix(bd);
    const end = bd.style === 'end', multi = bd.style === 'multi', edge = bd.style === 'edge', pat = bd.pattern;
    const brick = end && pat === 'brick', chaos = end && pat === 'chaos', shifted = end && (pat === 'diagonal' || pat === 'zigzag');
    const pr = BD.PRESETS.find(x => x.id === bd.preset);
    el.innerHTML = `
      <div class="tray"><div class="tray-h">Pattern</div>
        <button class="patpick" id="bdPat"><div class="pthumb">${boardThumb(bd)}</div><div class="grow"><div class="t">${esc(patName(bd))}</div><div class="s">${esc(styleName(bd))}${pr ? ' · ' + esc(pr.note) : ''}</div></div><span class="chev">›</span></button>
      </div>
      <div class="tray"><div class="tray-h">Size <span class="small muted">${end ? 'whole blocks' : ''}</span></div>${sizeHTML(end, edge, brick, chaos)}</div>
      ${multi ? `<div class="tray"><div class="tray-h">Recipe</div>${multiEditor(bd)}</div>` : `<div class="tray">${woodsHTML(end, edge, brick, chaos, shifted)}</div>`}
      <div class="tray"><div class="tray-h">Finishing touches</div>
        ${[['groove', 'Juice groove', 'A groove around the top catches drips'], ['grips', 'Finger grips', 'Routed into the ends to lift it'], ['feet', 'Rubber feet', 'Keeps it put and lets air under it']].map(([k, t, s]) => `<button class="swrow" data-ft="${k}"><div class="grow"><div class="t">${t}</div><div class="s">${s}</div></div><span class="switch ${bd[k] ? 'on' : ''}"><i></i></span></button>`).join('')}
        <label class="f">Edges</label>
        <div class="seg" id="ftEdge">${Object.entries(BD.PROFILES).map(([k, l]) => `<button data-pf="${k}" class="${(bd.profile || 'square') === k ? 'on' : ''}">${l.split(' ')[0]}</button>`).join('')}</div>
      </div>`;
    bind(end, edge, brick, chaos);
  };
  function sizeHTML(end, edge, brick, chaos) {
    if (edge) return `
      <div class="row">${measBtn('bdL', 'Length', bd.L)}${measBtn('bdT', 'Thickness', bd.T)}</div>
      <p class="note">${fracHTML(bd.W)} wide: the strips below add up to it.</p>`;
    if (!end) return `<div class="row">${measBtn('bdT', 'Thickness', bd.T)}<div class="dims" style="font-size:19px;text-align:center">${fracHTML(BD.lengthOf(bd))}<span class="x">×</span>${fracHTML(BD.widthOf(bd))}</div></div><p class="note">Length and width come from the recipe below.</p>`;
    const bw = BD.blockW(bd), wl = brick ? 'Brick length' : 'Block width', dl = brick ? 'Brick height' : 'Row depth';
    const ratio = +(bd.strips[0].w / bd.cell).toFixed(2);
    const note = bd.lock ? (brick ? `Locked at ${ratio} : 1, so bricks keep their shape` : 'Locked square') : `Unlocked: width and depth change on their own${bw == null ? '; strips have their own widths below' : ''}`;
    const rowsLbl = 'rows', colsLbl = brick ? 'per row' : 'across';
    return `
      <div class="pair">${measBtn('bdBW', wl, bw ?? bd.strips[0].w, bw == null ? 'mixed' : '')}<button class="lockbtn ${bd.lock ? 'on' : ''}" id="bdLock" aria-label="${bd.lock ? 'Unlock' : 'Lock'} the block shape">${bd.lock ? ICON.lock : ICON.unlock}</button>${measBtn('bdD', dl, bd.cell)}</div>
      <div class="locknote">${note}</div>
      <div class="counts">${stepperHTML('bdRows', bd.nRows, rowsLbl)}${stepperHTML('bdCols', bd.nCols, colsLbl)}</div>
      <div class="row" style="margin-top:8px">${measBtn('bdL', 'Length', bd.L, 'sm')}${measBtn('bdW', 'Width', bd.W, 'sm')}${measBtn('bdT', 'Thick', bd.T, 'sm')}</div>
      ${brick ? `<div class="row" style="margin-top:8px">${measBtn('bdJ', 'Mortar', bd.joint || 0, 'sm')}<p class="note" style="margin:0">${bd.joint > 0 ? 'Thin lines of mortar wood between bricks and rows' : 'No mortar: bricks butt right up to each other'}</p></div>` : ''}
      ${bd.pattern === 'zigzag' ? `<div class="counts">${stepperHTML('bdAmp', bd.amp, 'zigzag height')}<p class="note" style="margin:0;align-self:center">Strips it steps over before turning back</p></div>` : ''}
      <p class="note">${BD.blocks(bd)} ${brick ? 'pieces of wood' : 'blocks'}. Tap a size to type it; it snaps to whole ${brick ? 'bricks and rows' : 'blocks'}.</p>`;
  }
  function stepperHTML(id, n, label) { return `<div class="stepper" id="${id}"><button data-d="-1" aria-label="Fewer">−</button><div class="sv"><b>${n}</b><span>${label}</span></div><button data-d="1" aria-label="More">+</button></div>`; }
  function woodsHTML(end, edge, brick, chaos, shifted) {
    const L = list(), showW = edge ? !bd.same : end && !bd.lock && !brick && !chaos;
    const rows = L.map((x, i) => { const w = woodById(x.wood) || { name: '?', color: '#555' }; return `<div class="strow" data-i="${i}"><span class="hdl" aria-label="Drag to reorder">${ICON.grip}</span>
      <button class="who" data-sw="${i}">${swatch(w, 30)}<div class="grow"><div class="t">${i + 1}. ${esc(w.name)}</div>${showW ? '' : `<div class="s">${brick ? 'brick' : chaos ? 'in the mix' : fracHTML(x.w) + ' wide'}</div>`}</div></button>
      ${showW ? `<button class="meas inline" data-sww="${i}"><span class="mv">${fracHTML(x.w)}</span></button>` : ''}
      <button class="icon" data-rm="${i}" aria-label="Remove">${ICON.trash}</button></div>`; }).join('');
    const title = edge ? 'Strips' : brick ? 'Bricks' : chaos ? 'Woods in the mix' : 'Strips';
    const sub = edge ? 'Top to bottom, as they sit in the glue-up.' : brick ? 'The brick woods take turns along each row.' : chaos ? 'Add a wood twice to use more of it.' : 'This set repeats across the board.';
    const few = shifted && new Set(bd.strips.map(x => x.wood)).size < 3 && bd.strips.length < 4;
    return `<div class="tray-h"><span>${title}</span><button class="btn small tonal" id="bdAdd">+ Add</button></div><p class="note" style="margin:-8px 2px 12px">${sub}</p>
      ${edge ? `<button class="swrow" id="bdSame" style="padding-top:0"><div class="grow"><div class="t">Same width for every strip</div></div><span class="switch ${bd.same ? 'on' : ''}"><i></i></span></button>${bd.same ? `<div style="margin:4px 0 12px">${measBtn('bdSW', 'Strip width', L[0].w)}</div>` : ''}` : ''}
      <div class="card flush" id="bdList">${rows}</div>
      ${brick ? `<label class="f">Mortar</label><button class="card listrow" id="bdMortar" style="border-radius:16px">${swatch(woodById(bd.mortar) || { color: '#555' }, 30)}<div class="grow"><div class="t">${esc(woodName(bd.mortar))}</div><div class="s">${bd.joint > 0 ? `${fracHTML(bd.joint)} lines between bricks and rows` : 'Off: set a mortar width above'}</div></div><span class="chip">Change</span></button>` : ''}
      <div class="tools-row">${chaos ? '<button class="btn small" id="bdShuffle">Shuffle</button>' : brick ? '' : '<button class="btn small" id="bdMirror">Mirror</button><button class="btn small" id="bdRepeat">Repeat</button>'}</div>
      ${few ? '<p class="note" style="color:var(--accent)">With only two strips in the repeat this comes out looking like a checkerboard. Add a third wood, or use bands (like 3 walnut + 3 maple strips), to see the pattern.</p>' : ''}
      ${end && !bd.lock && !brick && !chaos ? '<p class="note">Unlocked, so each strip can have its own width.</p>' : ''}`;
  }
  function bind(end, edge, brick, chaos) {
    $('#bdPat', el).onclick = () => patternSheet(bd, nb => { replace(nb); commit(); });
    const snapInfo = which => v => { const t = BD.snap(clone(bd), which, v); return brick ? `${which === 'L' ? t.nCols + ' bricks a row' : t.nRows + ' rows'} · ${fracHTML(t[which])}` : `${which === 'L' ? t.nRows + ' rows' : t.nCols + ' across'} · comes out ${fracHTML(t[which])}`; };
    $('#bdL', el)?.addEventListener('click', () => measure({ title: 'Board length', value: bd.L, min: 1, max: 60, quick: [12, 14, 16, 18, 20, 24], info: end ? snapInfo('L') : null, onSet: v => { BD.snap(bd, 'L', v); commit(); } }));
    $('#bdW', el)?.addEventListener('click', () => measure({ title: 'Board width', value: bd.W, min: 1, max: 40, quick: [8, 10, 11, 12, 14, 16], info: snapInfo('W'), onSet: v => { BD.snap(bd, 'W', v); commit(); } }));
    $('#bdT', el)?.addEventListener('click', () => measure({ title: 'Thickness', value: bd.T, min: .25, max: 4, quick: [.75, 1, 1.25, 1.5, 1.75, 2], onSet: v => { bd.T = v; commit(); } }));
    $('#bdBW', el)?.addEventListener('click', () => measure({ title: brick ? 'Brick length' : 'Block width', value: BD.blockW(bd) ?? bd.strips[0].w, min: .125, max: 8, quick: brick ? [1.5, 2, 2.5, 3, 4] : [.75, 1, 1.25, 1.5, 1.75, 2],
      info: v => bd.lock ? `Depth follows: ${fracHTML(v / bd.ratio)}` : '', onSet: v => { BD.setSize(bd, 'w', v); commit(); } }));
    $('#bdD', el)?.addEventListener('click', () => measure({ title: brick ? 'Brick height' : 'Row depth', value: bd.cell, min: .125, max: 6, quick: brick ? [.75, 1, 1.25, 1.5] : [.75, 1, 1.25, 1.5, 1.75, 2],
      info: v => bd.lock ? `Width follows: ${fracHTML(v * bd.ratio)}` : '', onSet: v => { BD.setSize(bd, 'd', v); commit(); } }));
    $('#bdLock', el)?.addEventListener('click', () => { BD.setLock(bd, !bd.lock); commit(); haptic(10); toast(bd.lock ? (brick ? 'Brick shape locked' : `Locked square: ${BD.frac(bd.cell)} blocks`) : 'Unlocked'); });
    $('#bdJ', el)?.addEventListener('click', () => measure({ title: 'Mortar lines', value: bd.joint || 0, min: 0, max: 1, zero: true, quick: [0, .125, .1875, .25, .375, .5], info: v => v ? '' : 'No mortar', onSet: v => { const L = bd.L, W = bd.W; bd.joint = v; BD.fix(bd); BD.snap(bd, 'L', L); BD.snap(bd, 'W', W); commit(); } }));
    $$('.stepper', el).forEach(s => $$('[data-d]', s).forEach(b => b.onclick = () => {
      const d = +b.dataset.d;
      if (s.id === 'bdRows') { bd.nRows = Math.max(1, bd.nRows + d); }
      else if (s.id === 'bdCols') { bd.nCols = Math.max(1, bd.nCols + d); }
      else if (s.id === 'bdAmp') { bd.amp = Math.max(1, Math.min(12, bd.amp + d)); }
      haptic(5); commit();
    }));
    $('#bdShuffle', el)?.addEventListener('click', () => { bd.seed = (Math.random() * 1e9) | 0; commit(); });
    $('#bdMirror', el)?.addEventListener('click', () => { if (BD.isMirror(bd)) return toast('Already mirrored'); BD.mirror(bd); commit(); toast('Mirrored', { action: 'Undo', onAction: () => { const L = list(); L.splice(Math.ceil(L.length / 2)); commit(); } }); });
    $('#bdRepeat', el)?.addEventListener('click', () => { if (list().length > 30) return toast('That is plenty of strips'); const n = list().length; BD.repeat(bd); commit(); toast('Repeated', { action: 'Undo', onAction: () => { list().splice(n); commit(); } }); });
    $('#bdSame', el)?.addEventListener('click', () => { bd.same = !bd.same; commit(); });
    $('#bdSW', el)?.addEventListener('click', () => measure({ title: 'Strip width', value: bd.edge[0].w, min: 1 / 16, max: 12, quick: [.25, .5, .75, 1, 1.25, 1.5, 2], onSet: v => { bd.edge.forEach(s => s.w = v); commit(); } }));
    $$('[data-sww]', el).forEach(b => b.onclick = () => { const i = +b.dataset.sww, L = list(); measure({ title: `Strip ${i + 1} width`, value: L[i].w, min: 1 / 16, max: 12, quick: [.125, .25, .5, .75, 1, 1.25, 1.5, 2], onSet: v => { L[i].w = v; commit(); } }); });
    $$('[data-sw]', el).forEach(b => b.onclick = () => { const i = +b.dataset.sw; pickOneWood(list()[i].wood, id => { list()[i].wood = id; commit(); }, `Strip ${i + 1}`); });
    $$('[data-rm]', el).forEach(b => b.onclick = () => {
      const L = list(), i = +b.dataset.rm; if (L.length < 2) return toast('Keep at least one');
      const [gone] = L.splice(i, 1); commit();
      toast(`Removed ${woodName(gone.wood)}`, { action: 'Undo', onAction: () => { list().splice(i, 0, gone); commit(); } });
    });
    $('#bdAdd', el)?.addEventListener('click', () => pickOneWood(null, id => { const L = list(); L.push({ wood: id, w: L.length ? L[L.length - 1].w : 1.5 }); commit(); }, edge ? 'Add a strip' : brick ? 'Add a brick wood' : 'Add a wood'));
    $('#bdMortar', el)?.addEventListener('click', () => pickOneWood(bd.mortar, id => { bd.mortar = id; if (!(bd.joint > 0)) bd.joint = .25; commit(); }, 'Mortar wood'));
    const box = $('#bdList', el); if (box) dragList(box, (from, to) => { const L = list(); const [x] = L.splice(from, 1); L.splice(to, 0, x); commit(); });
    $$('[data-ft]', el).forEach(b => b.onclick = () => { bd[b.dataset.ft] = !bd[b.dataset.ft]; haptic(6); commit(); });
    $$('[data-pf]', el).forEach(b => b.onclick = () => { bd.profile = b.dataset.pf; commit(); });
    // two-step
    $$('[data-key]', el).forEach(b => b.onclick = () => pickOneWood(bd.keys[b.dataset.key], id => { bd.keys[b.dataset.key] = id; commit(); }, `Wood for ${b.dataset.key}`));
    $('#bdKeyAdd', el)?.addEventListener('click', () => { const used = Object.keys(bd.keys); const k = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find(c => !used.includes(c) && !Object.keys(bd.panels).includes(c)) || 'X'; pickOneWood(null, id => { bd.keys[k] = id; commit(); }, `Wood for ${k}`); });
    $$('[data-pan]', el).forEach(inp => inp.onchange = () => { bd.panels[inp.dataset.pan] = inp.value.trim(); bd.preset = null; commit(); });
    $$('[data-pdel]', el).forEach(b => b.onclick = () => { delete bd.panels[b.dataset.pdel]; commit(); });
    $('#bdPanelAdd', el)?.addEventListener('click', () => { const k = 'ABCDEFGH'.split('').find(c => !bd.panels[c]); if (!k) return; const first = Object.keys(bd.keys)[0] || 'W'; bd.panels[k] = `${+(BD.multiInfo(bd).W || 12).toFixed(3)}${first}`; commit(); });
    $('#bdRows', el)?.addEventListener('change', e => { bd.rows = e.target.value.trim(); bd.preset = null; commit(); });
  }
  draw();
}
function multiEditor(bd) {
  const mi = BD.multiInfo(bd);
  const keyRow = Object.entries(bd.keys).map(([k, id]) => { const w = woodById(id) || { name: '?', color: '#555' }; return `<button class="keychip" data-key="${k}"><b>${k}</b><i style="background:${w.color}"></i>${esc(w.name)}</button>`; }).join('');
  const panelStrip = k => { const P = mi.panels[k] || [], W = mi.widths[k] || 1; return `<div class="strip" style="height:8px;margin:6px 0 0 30px">${P.map(x => `<i style="flex:${x.w / W};background:${(woodById(bd.keys[x.key]) || { color: '#555' }).color}"></i>`).join('')}</div>`; };
  return `
    <p class="note" style="margin-top:0">Step 1: glue strips into panels. Step 2: slice the panels, turn the slices end grain up and lay them in order. Letters stand for woods, <b>^</b> flips a slice end for end, and <b>(…)x4</b> repeats.</p>
    <label class="f">Woods</label><div class="keys">${keyRow}<button class="keychip" id="bdKeyAdd">+ Wood</button></div>
    <label class="f">Panels <span>(strip width + wood letter, left to right)</span></label>
    ${Object.entries(bd.panels).map(([k, v]) => `<div style="margin-bottom:10px"><div class="row" style="align-items:center"><div style="flex:0 0 22px;font:600 18px var(--serif);color:var(--accent)">${k}</div><input class="recipe" style="flex:4" data-pan="${k}" value="${esc(v)}" autocomplete="off" autocapitalize="characters"><div style="flex:0 0 auto" class="small muted">${fracHTML(mi.widths[k] || 0)}</div>${Object.keys(bd.panels).length > 1 ? `<button class="icon" data-pdel="${k}" aria-label="Remove panel" style="flex:none">${ICON.trash}</button>` : ''}</div>${panelStrip(k)}</div>`).join('')}
    <button class="btn small tonal" id="bdPanelAdd">+ Panel</button>
    <label class="f">Slices, in order <span>(depth + panel letter)</span></label>
    <textarea id="bdRows" class="recipe" style="min-height:76px" autocapitalize="characters">${esc(bd.rows)}</textarea>
    <p class="note">Comes out about ${fracHTML(mi.L)} × ${fracHTML(mi.W)} from ${mi.rows.length} slices.</p>
    ${mi.errs.length ? `<div class="errbox">${mi.errs.map(esc).join('<br>')}</div>` : ''}`;
}
function importBoardSheet(done) {
  openSheet(`<h2>Import a pattern</h2><p class="note" style="margin-top:-8px">Paste a cuttingboarddesigner.com link (from their Share button). Its letters become your woods, and you can change them after.</p>
    <textarea id="impL" placeholder="https://www.cuttingboarddesigner.com/designer/hash/…" style="min-height:90px;margin-top:10px"></textarea>
    <div class="row" style="margin-top:12px"><button class="btn" id="impP">Paste</button><button class="btn primary" id="impOk">Import</button></div>`, { over: true });
  $('#impP').onclick = async () => { let t = ''; try { t = bridge && bridge.readClipboard ? bridge.readClipboard() : await navigator.clipboard.readText(); } catch (e) {} if (t) $('#impL').value = t; };
  $('#impOk').onclick = () => {
    try { const b = BD.importLink($('#impL').value.trim(), S.shop); closeAllSheets(); done(b); toast(`Imported "${b.name}"`); }
    catch (e) { toast("Couldn't read that link: " + e.message); }
  };
}
function boardCutText(p) {
  const bd = p.board, c = BD.cutList(bd, { nameOf: woodName, finish: p.finish }), done = BD.doneIds(bd, c.steps), L = [];
  L.push(`Cut list: ${pieceTitle(p)} — ${boardTitle(bd)}, ${dimsText(bd)}`);
  L.push(''); c.steps.forEach((s, i) => L.push(`${done.includes(s.id) ? '[x]' : '[ ]'} ${i + 1}. ${s.text}`));
  if (c.strips) { L.push(''); L.push('Strips, in glue-up order:'); c.strips.forEach(s => L.push(`  ${s.i}. ${woodName(s.wood)} — ${s.cut}`)); }
  if (c.layer) { L.push(''); L.push(`Mortar layer: ${woodName(c.layer.wood)} — ${c.layer.cut}`); }
  if (c.blocks) { L.push(''); Object.entries(c.blocks).forEach(([w, n]) => L.push(`  ${woodName(w)}: ${n} blocks (cut ${Math.ceil(n * 1.1)})`)); }
  L.push(''); L.push('Wood per species (milled, then rough with 30% for milling):'); c.woods.forEach(e => L.push(`  ${woodName(e.wood)}: ${e.pieces} pieces, ${e.bf.toFixed(2)} bd ft milled, about ${(e.bf * ROUGH).toFixed(1)} rough`));
  return L.join('\n');
}
function boardCutSheet(p) {
  const bd = p.board, saved = S.pieces.includes(p);
  const draw = () => {
    const c = BD.cutList(bd, { nameOf: woodName, finish: p.finish });
    bd.done = BD.doneIds(bd, c.steps);
    const ids = c.steps.map(s => s.id), done = bd.done.filter(x => ids.includes(x)), n = done.length;
    openSheet(`<h2>Cut list</h2>
      <p class="note" style="margin:-8px 0 14px">${esc(boardTitle(bd))} · ${esc(dimsText(bd))}${bd.style !== 'edge' ? ` · ${BD.blocks(bd)} pieces` : ''}</p>
      <div class="walk"><div class="grow" id="wsq"></div><b>${n} of ${c.steps.length} done</b></div>
      <div class="card flush">${c.steps.map((s, i) => `<button class="listrow step ${done.includes(s.id) ? 'done' : ''}" data-step="${i}"><span class="tick">${done.includes(s.id) ? '✓' : i + 1}</span><div class="grow">${esc(s.text)}</div></button>`).join('')}</div>
      ${c.strips ? `<div class="sec">Strips, in glue-up order</div><div class="card flush">${c.strips.map(s => `<div class="listrow">${swatch(woodById(s.wood) || { color: '#555' }, 30)}<div class="grow"><div class="t">${s.i}. ${esc(woodName(s.wood))}</div><div class="s" style="white-space:normal">${esc(s.cut)}</div></div></div>`).join('')}</div>` : ''}
      ${c.layer ? `<div class="sec">Mortar layer</div><div class="card flush"><div class="listrow">${swatch(woodById(c.layer.wood) || { color: '#555' }, 30)}<div class="grow"><div class="t">${esc(woodName(c.layer.wood))}</div><div class="s" style="white-space:normal">${esc(c.layer.cut)}</div></div></div></div>` : ''}
      ${c.blocks ? `<div class="sec">Blocks</div><div class="card flush">${Object.entries(c.blocks).map(([w, k]) => `<div class="listrow">${woodRow(woodById(w) || { name: w, color: '#555' }, `<div class="t">${k} <span class="s">(cut ${Math.ceil(k * 1.1)})</span></div>`)}</div>`).join('')}</div>` : ''}
      ${stockBlock(p)}
      <p class="note">Allowances: 1/16" for planing strips, 1/8" for flattening, 1/8" kerf per cut, and 2" of panel for squaring the ends.${saved ? '' : ' Save the piece to keep your checkmarks.'}</p>
      <div class="row" style="margin-top:12px"><button class="btn" id="cc">Copy</button><button class="btn primary" id="cs">Share</button></div>`);
    squigInto($('#wsq'), n / c.steps.length, { animate: n > 0 && n < c.steps.length });
    $$('[data-step]').forEach(b => b.onclick = () => {
      const id = c.steps[+b.dataset.step].id;
      bd.done = bd.done.includes(id) ? bd.done.filter(x => x !== id) : [...bd.done, id];
      if (!bd.done.includes(id)) haptic(4); else haptic(12);
      if (saved) save(); const top = $('#sheetCard').scrollTop; draw(); $('#sheetCard').scrollTop = top;
      if (bd.done.length === c.steps.length && c.steps.every(s => bd.done.includes(s.id))) toast('Every step done. Nice work.');
    });
    $('#cc').onclick = () => copyText(boardCutText(p)); $('#cs').onclick = () => shareText(boardCutText(p), 'Cut list');
    bindStock(p, () => { const top = $('#sheetCard').scrollTop; draw(); $('#sheetCard').scrollTop = top; });
  };
  draw();
}
const blankPiece = (type, extra = {}) => ({
  id: uid(), no: nextNo(), type: type || S.types[0]?.id, templates: {}, woods: [], finish: S.settings.defaultFinish,
  size: '', price: '', cost: '', status: 'building', date: today(), photos: [], buildPhotos: [], notes: '', special: '', ...extra
});

VIEWS.editPiece = ({ id }, frame) => {
  const existing = id ? S.pieces.find(x => x.id === id) : null;
  const p = frame.draft ||= existing ? structuredClone(existing) : blankPiece();
  p.buildPhotos ??= [];
  frame.guard = () => { confirmSheet('Discard changes?', 'Discard', () => { frame.guard = null; back(); }); return false; };
  setTop(existing ? `Edit No. ${pad(p.no)}` : 'New piece', `<button class="btn small primary" id="saveP">Save</button>`, true);
  const v = $('#view'), type = typeById(p.type), dock = type.board || type.bowl;
  if (type.board) { p.board = p.board ? BD.upgrade(p.board, p.woods.length ? p.woods : S.shop) : newBoard(); p.woods = BD.woods(p.board); }
  if (type.bowl) { if (!p.bowl) p.bowl = B.defaults(contrastPair(S.shop)); p.woods = bowlWoods(p.bowl); }
  const wc = woodCost({ ...p, cost: '' });
  v.innerHTML = `
    <label class="f" style="margin-top:4px">What is it?</label>
    <div class="filters">${S.types.map(t => `<button data-t="${t.id}" class="${p.type === t.id ? 'on' : ''}">${esc(t.name)}</button>`).join('')}<button data-t="+">+ New type</button></div>
    ${dock ? '<div class="pvdock" id="pvw"></div>' : ''}
    <div id="slots"></div>
    ${type.board ? '<div id="boardEd"></div>' : ''}
    ${type.bowl ? '<div id="bowlEd"></div>' : ''}
    ${dock ? '' : '<div id="pvw"></div>'}
    ${type.bowl || type.board ? '' : '<div class="tray"><div class="tray-h">Woods</div><div id="woods"></div></div>'}
    <div class="tray"><div class="tray-h">About this one</div>
      <label class="f">What's special about it? <span>(optional, goes in the story)</span></label>
      <textarea id="special" style="min-height:70px" placeholder="e.g. The cherry came from my grandpa's tree">${esc(p.special)}</textarea>
      <button class="swrow" id="firstCombo" style="padding:10px 2px 4px"><div class="grow"><div class="t">First time I've made this combination</div><div class="s">Adds “the first piece from the shop with this combination of woods” to the story</div></div><span class="switch ${comboIsFirst(p) ? 'on' : ''}"><i></i></span></button>
      <label class="f">Finished photos</label><div class="photos" id="photos"></div></div>
    <div class="tray"><div class="tray-h">Details</div>
      <div class="row"><div><label class="f" style="margin-top:0">Number</label><input id="no" inputmode="numeric" value="${p.no}"></div><div><label class="f" style="margin-top:0">Date</label><input id="date" type="date" value="${esc(p.date)}"></div></div>
      <label class="f">Finish</label><select id="finish">${S.finishes.map(f => `<option ${f.name === p.finish ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select>
      ${type.board || type.bowl ? '' : `<label class="f">Size</label><input id="size" value="${esc(p.size)}" placeholder='e.g. 15 1/2"'>`}
      <div class="row"><div><label class="f">Price</label><input id="price" inputmode="decimal" value="${esc(p.price)}" placeholder="$"></div><div><label class="f">Wood cost</label><input id="cost" inputmode="decimal" value="${esc(p.cost ?? '')}" placeholder="${wc ? '≈ ' + fmt$(wc.v) : '$'}"></div></div>
      ${wc ? `<p class="note">Estimated from the cut list at your prices. Leave it blank to use the estimate.</p>` : ''}
      <label class="f">Status</label>
      <div class="seg" id="status">${[['building', 'Building'], ['available', 'Finished'], ['sold', 'Sold']].map(([k, l]) => `<button data-s="${k}" class="${p.status === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <label class="f">Private notes</label><textarea id="notes" placeholder="Only you see these">${esc(p.notes)}</textarea></div>
    ${existing ? `<button class="btn wide danger" id="delP" style="margin-top:20px">Delete this piece</button>` : ''}<div style="height:30px"></div>`;
  const readFields = () => {
    p.no = parseInt($('#no').value) || p.no; p.date = $('#date').value; p.finish = $('#finish').value;
    p.size = $('#size')?.value.trim() || ''; p.price = $('#price').value.trim(); p.cost = $('#cost').value.trim(); p.notes = $('#notes').value; p.special = $('#special').value;
  };
  $$('[data-t]', v).forEach(b => b.onclick = () => { readFields(); if (b.dataset.t === '+') return go('editType', {}); p.type = b.dataset.t; if (typeById(p.type).bowl && !p.bowl) { p.bowl = B.defaults(contrastPair(S.shop)); p.woods = bowlWoods(p.bowl); } if (typeById(p.type).board && !p.board) { p.board = newBoard(); p.woods = BD.woods(p.board); } render(); });
  const drawPreview = () => {
    const art = pieceArt(p, viewMode);
    if (dock) {
      const tag = type.board ? dimsHTML(p.board) : `${fracHTML(p.bowl.D)} × ${fracHTML(p.bowl.H)}`;
      $('#pvw').innerHTML = `<div class="preview bar" id="pvbox">${art}<div class="pvbar"><span class="pvtag">${tag}</span><span class="tools"><button class="mini" id="b3d">${ICON.cube}3D</button>${type.board ? `<button class="mini" id="bdcut">${ICON.list}Cut list</button>` : p.bowl.kind === 'seg' ? `<button class="mini" id="bcut">${ICON.list}Cut list</button>` : ''}</span></div></div>`;
    } else $('#pvw').innerHTML = art ? `<div class="preview" style="margin-top:14px;min-height:150px" id="pvbox">${art}</div>${type.slots.length ? `<div style="margin-top:10px">${modeSeg(viewMode)}</div>` : ''}${type.slots.length ? angleRow(p) : ''}` : '';
    if (art && type.slots.length) bindMode(v, () => { $('#pvbox').innerHTML = pieceArt(p, viewMode); }, 'mode', p);
    $('#b3d', v)?.addEventListener('click', () => open3D(p));
    $('#bcut', v)?.addEventListener('click', () => cutListSheet(p));
    $('#bdcut', v)?.addEventListener('click', () => boardCutSheet(p));
    if (!dock) bindAngle(v, p, () => { $('#pvbox').innerHTML = pieceArt(p, viewMode); });
  };
  $('#slots').innerHTML = type.slots.map((s, si) => {
    const tpls = allTemplates().filter(t => t.group === s.group);
    return `<label class="f">${esc(s.name)}</label><div class="filters" data-slot="${si}">${tpls.map(t => `<button class="tpl ${p.templates[s.name] === t.id ? 'sel' : ''}" data-tp="${t.id}">
        <div class="pv" style="height:70px">${tplArt(t, p.woods, p.widths, true, colsValid(p) ? p.cols : null)}</div><div class="code">${esc(t.code)}</div><div class="tn">${esc(t.name)}</div></button>`).join('') || '<span class="muted small">No templates here yet. Add them in Catalog.</span>'}</div>`;
  }).join('');
  $$('[data-slot]', v).forEach(row => {
    const s = type.slots[+row.dataset.slot];
    $$('[data-tp]', row).forEach(b => b.onclick = () => {
      p.templates[s.name] = p.templates[s.name] === b.dataset.tp ? undefined : b.dataset.tp;
      $$('[data-tp]', row).forEach(x => x.classList.toggle('sel', x.dataset.tp === p.templates[s.name])); drawPreview();
    });
  });
  if (type.board) boardEditor($('#boardEd'), p, () => { p.woods = BD.woods(p.board); drawPreview(); });
  if (type.bowl) bowlEditor($('#bowlEd'), p, () => { p.woods = bowlWoods(p.bowl); drawPreview(); });
  drawPreview();
  if (!type.bowl && !type.board) { p.widths ||= []; woodPicker($('#woods'), p.woods, () => { drawPreview(); $$('#slots .tpl').forEach(b => { $('.pv', b).innerHTML = tplArt(tplById(b.dataset.tp), p.woods, p.widths, true, colsValid(p) ? p.cols : null); }); }, p.widths, () => pieceArt(p), (cols, url) => { if (cols) { p.cols = cols; p.colsSig = p.woods.join(','); } else { delete p.cols; delete p.colsSig; } if (url) { const id = uid(); photoPut(id, url).then(() => { p.photos.push(id); drawPhotos(); }); } }); }
  const drawPhotos = () => {
    $('#photos').innerHTML = p.photos.map((ph, i) => `<div class="ph"><img data-photo="${ph}" alt=""><button data-rmp="${i}" aria-label="Remove photo">×</button></div>`).join('') + `<button class="add" id="addPh" aria-label="Add photos">+</button>`;
    fillPhotos($('#photos'));
    $$('[data-rmp]', v).forEach(b => b.onclick = () => { p.photos.splice(+b.dataset.rmp, 1); drawPhotos(); });
    $('#addPh').onclick = async () => { await addPhotos(p.photos); drawPhotos(); };
  };
  drawPhotos();
  $('#firstCombo').onclick = () => { const now = !comboIsFirst(p); p.firstCombo = now; $('#firstCombo .switch').classList.toggle('on', now); };
  $$('[data-s]', v).forEach(b => b.onclick = () => { p.status = b.dataset.s; $$('[data-s]', v).forEach(x => x.classList.toggle('on', x === b)); });
  $('#saveP').onclick = () => {
    readFields();
    if (type.bowl) p.woods = bowlWoods(p.bowl);
    if (type.board) { BD.fix(p.board); p.woods = BD.woods(p.board); }
    Object.keys(p.templates).forEach(k => p.templates[k] || delete p.templates[k]);
    if (S.pieces.some(x => x.no === p.no && x.id !== p.id)) return toast(`No. ${pad(p.no)} is already used`);
    if (p.status === 'sold' && !p.soldDate) p.soldDate = today();
    const i = S.pieces.findIndex(x => x.id === p.id), was = i >= 0 ? S.pieces[i].status : 'building';
    if (i >= 0) { S.pieces[i].photos.filter(ph => !p.photos.includes(ph)).forEach(photoDel); S.pieces[i] = p; } else S.pieces.push(p);
    S.settings.nextNumber = Math.max(S.settings.nextNumber, p.no + 1);
    save(); frame.guard = null; stack.pop();
    if (i < 0) { stack.push({ view: 'piece', params: { id: p.id } }); toast(`Logged No. ${pad(p.no)}`); }
    render(true); scrollTo(0, 0);
    if (p.status === 'available' && was === 'building' && !p.printed) askPrint(p);
  };
  $('#delP', v)?.addEventListener('click', () => confirmSheet(`Delete No. ${pad(p.no)}?`, 'Delete', () => {
    const at = S.pieces.findIndex(x => x.id === p.id), gone = S.pieces[at];
    S.pieces.splice(at, 1); save();
    frame.guard = null; stack = [{ view: 'pieces', params: {} }]; render(true);
    toast(`Deleted No. ${pad(gone.no)}`, { action: 'Undo',
      onAction: () => { S.pieces.splice(Math.min(at, S.pieces.length), 0, gone); save(); render(); toast(`No. ${pad(gone.no)} is back`); },
      onTimeout: () => { if (!S.pieces.includes(gone)) [...(gone.photos || []), ...(gone.buildPhotos || []).map(b => b.id)].forEach(photoDel); } });
  }));
};

/* ---------- Long press menus ---------- */
// Hold a tile or tab to get everything you can do with it. Normal taps still open it as before.
function longPress(root, sel, fn) {
  if (!root) return;
  let timer = null, sx = 0, sy = 0, fired = false;
  const cancel = () => clearTimeout(timer);
  root.addEventListener('pointerdown', e => { const el = e.target.closest(sel); fired = false; if (!el || !root.contains(el)) return; sx = e.clientX; sy = e.clientY; cancel(); timer = setTimeout(() => { fired = true; haptic(14); fn(el); }, 480); });
  root.addEventListener('pointermove', e => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 9) cancel(); });
  ['pointerup', 'pointercancel'].forEach(ev => root.addEventListener(ev, cancel));
  root.addEventListener('click', e => { if (fired) { e.stopPropagation(); e.preventDefault(); fired = false; } }, true);
  root.addEventListener('contextmenu', e => { const el = e.target.closest(sel); if (!el) return; e.preventDefault(); if (!fired) { fired = true; cancel(); haptic(14); fn(el); } });
}
function actionSheet(title, items) {
  items = items.filter(Boolean);
  openSheet(`<h2>${esc(title)}</h2><div class="card flush">${items.map((it, i) => `<button class="listrow" data-ai="${i}"><div class="grow"><div class="t" ${it[2] ? 'style="color:var(--danger)"' : ''}>${esc(it[0])}</div></div></button>`).join('')}</div>`);
  $$('#sheetCard [data-ai]').forEach(b => b.onclick = () => { const it = items[+b.dataset.ai]; closeSheet(); setTimeout(it[1], 30); });
}
function askText(title, value, onDone, label = 'Name') {
  openSheet(`<h2>${esc(title)}</h2><label class="f">${esc(label)}</label><input id="atx" value="${esc(value || '')}" autocomplete="off"><button class="btn primary wide" id="atok" style="margin-top:16px">Save</button>`);
  const ok = () => { const v = $('#atx').value.trim(); if (!v) return; closeSheet(); onDone(v); };
  $('#atok').onclick = ok; $('#atx').onkeydown = e => { if (e.key === 'Enter') ok(); };
}
function deletePieceNow(p) {
  confirmSheet(`Delete No. ${pad(p.no)}?`, 'Delete', () => {
    const at = S.pieces.findIndex(x => x.id === p.id), gone = S.pieces[at]; if (!gone) return;
    S.pieces.splice(at, 1); save(); render();
    toast(`Deleted No. ${pad(gone.no)}`, { action: 'Undo',
      onAction: () => { S.pieces.splice(Math.min(at, S.pieces.length), 0, gone); save(); render(); toast(`No. ${pad(gone.no)} is back`); },
      onTimeout: () => { if (!S.pieces.includes(gone)) [...(gone.photos || []), ...(gone.buildPhotos || []).map(b => b.id)].forEach(photoDel); } });
  });
}
function pieceMenu(p) {
  if (!p) return;
  const setSt = k => { const was = p.status; p.status = k; save(); render(); if (k === 'available' && was === 'building' && !p.printed) askPrint(p); };
  actionSheet(`${typeName(p)} No. ${pad(p.no)}`, [
    ['Open', () => go('piece', { id: p.id })],
    ['Edit', () => go('editPiece', { id: p.id })],
    ['Make a copy', () => duplicatePiece(p)],
    p.status !== 'building' && ['Mark as building', () => setSt('building')],
    p.status !== 'available' && ['Mark as finished', () => setSt('available')],
    p.status !== 'sold' && ['Mark as sold', () => setSt('sold')],
    ['Print a card', () => S.settings.pageUrl ? printCardsSheet(p) : pageSetupSheet(() => printCardsSheet(p))],
    ['Delete', () => deletePieceNow(p), true]
  ]);
}
function projectMenu(q) {
  actionSheet(projTitle(q), [['Open', () => go('project', { id: q.id })],
    ['Delete', () => confirmSheet(`Delete ${projTitle(q)}?`, 'Delete', () => { q.photos.forEach(photoDel); S.projects = S.projects.filter(x => x !== q); save(); render(); }), true]]);
}
function removeTplNow(t) {
  const id = t.id, uses = S.pieces.filter(p => Object.values(p.templates || {}).includes(id));
  confirmSheet(`Remove ${t.code} ${t.name}?`, 'Remove', () => {
    const builtin = BUILTIN_TEMPLATES.some(x => x.id === id), custom = S.templates.find(x => x.id === id), printed = S.printed[id];
    S.templates = S.templates.filter(x => x.id !== id); delete S.printed[id];
    if (builtin && !S.hiddenTpls.includes(id)) S.hiddenTpls.push(id);
    save(); render();
    toast(`Removed ${t.code}`, { action: 'Undo', onAction: () => { if (custom) S.templates.push(custom); S.hiddenTpls = S.hiddenTpls.filter(x => x !== id); if (printed) S.printed[id] = printed; save(); render(); } });
  }, uses.length ? `${uses.length} logged piece${uses.length > 1 ? 's use' : ' uses'} it; they keep their drawing.` : 'You can undo this right after.');
}
async function tplMenu(t) {
  if (!t) return;
  const ix = await stlLoad(), file = ix[t.id] || t.stlName;
  actionSheet(`${t.code} · ${t.name}`, [
    ['Open', () => go('template', { id: t.id })],
    [S.printed[t.id] ? 'Mark as not printed' : 'Mark as printed', () => { if (S.printed[t.id]) delete S.printed[t.id]; else S.printed[t.id] = today(); save(); render(); }],
    file && ['Download STL', () => ix[t.id] ? saveAsset('stl/' + file, file, 'model/stl') : saveStored('stl:' + t.id, file, 'model/stl')],
    ['Rename', () => askText('Rename', t.name, v => { editTpl(t, { name: v }); render(); })],
    ['Move to another section', () => {
      openSheet(`<h2>Move ${esc(t.code)}</h2><div class="card flush">${liveGroups().map(g => `<button class="listrow" data-mg="${g.id}"><div class="grow"><div class="t">${esc(g.name)}${g.id === t.group ? ' ✓' : ''}</div></div></button>`).join('')}</div>`);
      $$('#sheetCard [data-mg]').forEach(b => b.onclick = () => { closeSheet(); editTpl(t, { group: b.dataset.mg }); catGroup = b.dataset.mg; render(); toast(`Moved to ${groupById(b.dataset.mg).name}`); });
    }],
    ['Remove', () => removeTplNow(t), true]
  ]);
}
function groupMenu(g) {
  if (!g) return;
  actionSheet(g.name, [
    ['Rename', () => askText('Rename section', g.name, v => { g.name = v; save(); render(); })],
    ['Add or bring back a section', () => sectionsSheet()],
    ['Remove this section', () => removeGroupNow(g), true]
  ]);
}
function removeGroupNow(g) {
  const inG = allTemplates().filter(t => t.group === g.id);
  confirmSheet(`Remove ${g.name}?`, 'Remove', () => {
    const customs = S.templates.filter(t => t.group === g.id), hidBefore = [...S.hiddenTpls], printed = Object.fromEntries(inG.filter(t => S.printed[t.id]).map(t => [t.id, S.printed[t.id]]));
    S.templates = S.templates.filter(t => t.group !== g.id);
    inG.forEach(t => { if (BUILTIN_TEMPLATES.some(x => x.id === t.id) && !S.hiddenTpls.includes(t.id)) S.hiddenTpls.push(t.id); delete S.printed[t.id]; });
    S.hiddenGroups.push(g.id); save(); render();
    toast(`Removed ${g.name}`, { action: 'Undo', onAction: () => { S.templates.push(...customs); S.hiddenTpls = hidBefore; Object.assign(S.printed, printed); S.hiddenGroups = S.hiddenGroups.filter(x => x !== g.id); catGroup = g.id; save(); render(); } });
  }, inG.length ? `Its ${inG.length} template${inG.length > 1 ? 's go' : ' goes'} with it. You can undo this right after, or bring the section back later.` : 'You can bring it back later.');
}
function sectionsSheet() {
  const hid = S.groups.filter(g => S.hiddenGroups.includes(g.id));
  openSheet(`<h2>Sections</h2><label class="f" style="margin-top:0">New section</label><input id="sgn" placeholder="e.g. Cutting boards" autocomplete="off">
    <label class="f">File prefix <span>(optional, so imports sort themselves: B for B1_name.stl)</span></label><input id="sgp" placeholder="B" maxlength="4" autocomplete="off">
    <button class="btn primary wide" id="sgok" style="margin-top:14px">Add section</button>
    ${hid.length ? `<div class="sec" style="margin-top:22px;font-size:16px">Removed sections</div><div class="card flush">${hid.map(g => `<div class="listrow"><div class="grow"><div class="t">${esc(g.name)}</div></div><button class="btn small tonal" data-bk="${g.id}">Bring back</button></div>`).join('')}</div>` : ''}`);
  $('#sgok').onclick = () => { const n = $('#sgn').value.trim(); if (!n) return toast('Name the section'); const gid = 'g-' + uid(); S.groups.push({ id: gid, name: n, prefix: $('#sgp').value.trim().toUpperCase() }); catGroup = gid; save(); closeSheet(); render(); };
  $$('#sheetCard [data-bk]').forEach(b => b.onclick = () => {
    const gid = b.dataset.bk; S.hiddenGroups = S.hiddenGroups.filter(x => x !== gid);
    S.hiddenTpls = S.hiddenTpls.filter(id => { const t = BUILTIN_TEMPLATES.find(x => x.id === id); return !(t && ((S.tplEdits[id] || {}).group || t.group) === gid); });
    catGroup = gid; save(); closeSheet(); render(); toast('Section is back');
  });
}
function woodMenu(id) {
  const w = woodById(id); if (!w) return;
  actionSheet(w.name, [['Open', () => go('editWood', { id })],
    [S.shop.includes(id) ? 'Take out of my shop' : 'Put in my shop', () => { if (S.shop.includes(id)) S.shop = S.shop.filter(x => x !== id); else S.shop.push(id); save(); render(); }]]);
}

/* ---------- Catalog ---------- */
let catGroup = null, catPrinted = 'all';
/* ---------- Gallery ---------- */
let galFilter = 'all', galMode = 'photos';
const projTitle = q => q.title || 'Untitled';
VIEWS.gallery = () => {
  setTop('Gallery');
  S.projects = (S.projects || []).filter(q => q.title || q.notes || (q.photos || []).length);
  const v = $('#view');
  const items = [...(galFilter === 'other' ? [] : S.pieces.map(p => ({ k: 'piece', p, d: p.date || '', t: `${typeName(p)} No. ${pad(p.no)}` }))), ...(galFilter === 'pieces' ? [] : S.projects.map(q => ({ k: 'proj', q, d: q.date || '', t: projTitle(q) })))]
    .sort((a, b) => (b.d || '').localeCompare(a.d || '') || (b.p?.no || 0) - (a.p?.no || 0));
  v.innerHTML = `<div class="filters">${[['all', 'Everything'], ['pieces', 'Knives and boards'], ['other', 'Other projects']].map(([k, l]) => `<button data-f="${k}" class="${galFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${galFilter !== 'other' && S.pieces.length ? `<div class="seg" id="galMode" style="margin:2px 0 12px"><button data-gm="photos" class="${galMode === 'photos' ? 'on' : ''}">My photos</button><button data-gm="renders" class="${galMode === 'renders' ? 'on' : ''}">Renders</button></div>` : ''}
    <div class="ggrid">${items.map((it, i) => {
      let img = '';
      if (it.k === 'piece') { const art = pieceArt(it.p), ph = it.p.photos?.[0]; img = galMode === 'renders' && art || !ph ? (art || '') : `<img data-photo="${ph}" alt="">`; }
      else img = it.q.photos?.length ? `<img data-photo="${it.q.photos[0]}" alt="">` : `<span class="muted">No photo yet</span>`;
      return `<button class="gtile" data-i="${i}"><div class="gimg">${img}</div><div class="gcap"><b>${esc(it.t)}</b><span>${it.k === 'piece' ? esc(woodsLine(it.p)) : esc(it.q.date ? monthYear(it.q.date) : '')}</span></div></button>`;
    }).join('') || `<p class="muted" style="grid-column:1/-1;text-align:center;margin-top:30px">${galFilter === 'pieces' ? 'No pieces yet.' : 'Nothing here yet. Tap + to add a project and its photos.'}</p>`}</div><div style="height:80px"></div>`;
  $$('[data-f]', v).forEach(b => b.onclick = () => { galFilter = b.dataset.f; render(); });
  $$('[data-gm]', v).forEach(b => b.onclick = () => { galMode = b.dataset.gm; render(); });
  $$('.gtile', v).forEach(b => b.onclick = () => { const it = items[+b.dataset.i]; go(it.k === 'piece' ? 'piece' : 'project', { id: (it.p || it.q).id }); });
  longPress(v, '.gtile', el => { const it = items[+el.dataset.i]; if (it.k === 'piece') pieceMenu(it.p); else projectMenu(it.q); });
  fillPhotos(v);
  fab(() => { const q = { id: uid(), title: '', date: today(), notes: '', photos: [] }; S.projects.push(q); save(); go('project', { id: q.id }); }, 'Add a project', true);
};
const woodsLine = p => [...new Set(p.woods.map(i => woodById(i)?.name).filter(Boolean))].slice(0, 3).join(', ');
VIEWS.project = ({ id }) => {
  const q = (S.projects || []).find(x => x.id === id); if (!q) return back();
  setTop(projTitle(q), `<button class="icon" id="delProj" aria-label="Delete">${ICON.trash}</button>`);
  const v = $('#view');
  v.innerHTML = `<div class="tray"><label class="f" style="margin-top:0">What is it?</label><input id="pjT" value="${esc(q.title)}" placeholder="Wood radio, kid's stool…" autocomplete="off">
    <label class="f">Date</label><input id="pjD" type="date" value="${esc(q.date || '')}">
    <label class="f">Notes <span>(optional)</span></label><textarea id="pjN" style="min-height:90px" placeholder="Woods, how it went, who it's for">${esc(q.notes || '')}</textarea></div>
    <div class="sec">Photos</div><div class="photos" id="pjP"></div><div style="height:40px"></div>`;
  const photos = () => {
    $('#pjP').innerHTML = q.photos.map((ph, i) => `<div class="ph"><img data-photo="${ph}" data-big="${ph}" alt=""><button data-rm="${i}" aria-label="Remove photo">×</button></div>`).join('') + `<button class="add" id="pjAdd" aria-label="Add photos">+</button>`;
    fillPhotos($('#pjP'));
    $$('[data-rm]', v).forEach(b => b.onclick = e => { e.stopPropagation(); photoDel(q.photos[+b.dataset.rm]); q.photos.splice(+b.dataset.rm, 1); save(); photos(); });
    $$('img[data-big]', v).forEach(im => im.onclick = () => { openSheet(`<img data-photo="${im.dataset.big}" alt="" style="width:100%;border-radius:12px;display:block">`); fillPhotos($('#sheetCard')); });
    $('#pjAdd').onclick = async () => { await addPhotos(q.photos); save(); photos(); };
  };
  photos();
  $('#pjT').oninput = () => { q.title = $('#pjT').value.trim(); $('#title').textContent = projTitle(q); save(); };
  $('#pjD').onchange = () => { q.date = $('#pjD').value; save(); };
  $('#pjN').oninput = () => { q.notes = $('#pjN').value; save(); };
  $('#delProj').onclick = () => confirmSheet(`Delete ${projTitle(q)}?`, 'Delete', () => { q.photos.forEach(photoDel); S.projects = S.projects.filter(x => x !== q); save(); back(); });
};

VIEWS.catalog = () => {
  setTop('Catalog', `<button class="icon" id="addTpl" aria-label="Add templates">${ICON.plus}</button>`);
  const v = $('#view');
  const groups = liveGroups();   // the standard sections always show, even when empty
  if (!groups.some(g => g.id === catGroup)) catGroup = groups[0]?.id;
  const inGroup = allTemplates().filter(t => t.group === catGroup);
  const nPrinted = inGroup.filter(t => S.printed[t.id]).length;
  let tpls = inGroup;
  if (catPrinted === 'yes') tpls = tpls.filter(t => S.printed[t.id]); else if (catPrinted === 'no') tpls = tpls.filter(t => !S.printed[t.id]);
  v.innerHTML = `
    <div class="filters">${groups.map(g => `<button data-g="${g.id}" class="${g.id === catGroup ? 'on' : ''}">${esc(g.name)}</button>`).join('')}<button id="addSec" aria-label="Add or remove sections">+ Section</button></div>
    ${allTemplates().some(t => t.print === false) ? `<button class="card listrow" id="pw" style="border-radius:20px"><div class="grow"><div class="t">Preview woods</div><div style="margin-top:8px">${stripHTML(S.previewWoods)}</div></div><span class="chip">Change</span></button>` : ''}
    <div class="sec">${esc(groupById(catGroup).name)} <span style="display:flex;align-items:center;gap:10px"><span class="small muted">${nPrinted} of ${inGroup.length} printed</span><button class="btn small" id="secEdit">Edit</button></span></div>
    <div style="margin:0 2px 12px" id="catq"></div>
    <div class="seg" id="pf" style="margin-bottom:12px">${[['all', 'All'], ['yes', 'Printed'], ['no', 'Not printed']].map(([k, l]) => `<button data-pf="${k}" class="${catPrinted === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="grid">${tpls.map(t => `<button class="tpl" data-tp="${t.id}">${S.printed[t.id] ? '<span class="pbadge">✓</span>' : ''}<div class="pv">${tplArt(t, S.previewWoods)}</div><div class="code">${esc(t.code)}</div><div class="tn">${esc(t.name)}</div></button>`).join('') || `<p class="muted" style="grid-column:1/-1">Nothing in ${esc(groupById(catGroup).name.toLowerCase())} yet. Tap + and choose your STL files${groupById(catGroup).prefix ? `. Name them like ${esc(groupById(catGroup).prefix)}1_name.stl and Bench files them here` : ''}.</p>`}</div>
    ${S.hiddenTpls.length ? `<button class="card listrow" id="hidT" style="border-radius:20px;margin-top:16px"><div class="grow"><div class="t">${S.hiddenTpls.length} removed template${S.hiddenTpls.length > 1 ? 's' : ''}</div><div class="s">Tap to bring any back</div></div></button>` : ''}
    <div class="tray" style="margin-top:24px"><div class="tray-h">Try a combination</div><p class="note" style="margin-top:-6px">Pick a type and its parts to see the finished piece.</p>
      <div class="filters" style="padding-bottom:0">${S.types.filter(t => t.slots.length).map(t => `<button data-ct="${t.id}">${esc(t.name)}</button>`).join('')}</div></div>
    <div style="height:30px"></div>`;
  squigInto($('#catq'), inGroup.length ? nPrinted / inGroup.length : 0);
  $('#hidT', v)?.addEventListener('click', () => {
    const list = BUILTIN_TEMPLATES.filter(t => S.hiddenTpls.includes(t.id)).map(t => tplById(t.id));
    openSheet(`<h2>Removed templates</h2><div class="card flush">${list.map(t => `<div class="listrow"><div style="width:56px;height:56px;display:grid;place-items:center;flex:none">${tplArt(t, S.previewWoods)}</div><div class="grow"><div class="t">${esc(t.code)} · ${esc(t.name)}</div><div class="s">${esc(groupById(t.group).name)}</div></div><button class="btn small tonal" data-un="${t.id}">Bring back</button></div>`).join('')}</div>`);
    $$('[data-un]').forEach(b => b.onclick = () => { S.hiddenTpls = S.hiddenTpls.filter(x => x !== b.dataset.un); save(); toast(`${b.dataset.un} is back`); if (!S.hiddenTpls.length) closeSheet(); render(); if (S.hiddenTpls.length) $('#hidT').click(); });
  });
  $$('[data-g]', v).forEach(b => b.onclick = () => { catGroup = b.dataset.g; render(); });
  $('#addSec', v).onclick = () => sectionsSheet();
  $('#secEdit', v).onclick = () => groupMenu(groupById(catGroup));
  longPress(v, '.tpl[data-tp]', el => tplMenu(tplById(el.dataset.tp)));
  longPress(v, '[data-g]', el => groupMenu(groupById(el.dataset.g)));
  $$('[data-pf]', v).forEach(b => b.onclick = () => { catPrinted = b.dataset.pf; render(); });
  $$('[data-tp]', v).forEach(b => b.onclick = () => go('template', { id: b.dataset.tp }));
  $$('[data-ct]', v).forEach(b => b.onclick = () => go('combo', { type: b.dataset.ct }));
  const pwB = $('#pw'); if (pwB) pwB.onclick = () => {
    const list = [...S.previewWoods];
    openSheet(`<h2>Preview woods</h2><div id="pwp"></div><button class="btn primary wide" id="pwok" style="margin-top:16px">Done</button>`);
    woodPicker($('#pwp'), list, () => {});
    $('#pwok').onclick = () => { if (list.length) S.previewWoods = list; save(); closeSheet(); render(); };
  };
  $('#addTpl').onclick = () => {
    openSheet(`<h2>Add templates</h2><p class="note" style="margin-top:-8px">Pick the STL files you print your templates from. Bench reads each outline, dovetail and punch mark, and takes the number and name from the file name (like KJ1_jar_scraper_round.stl).</p>
      <button class="btn primary wide" id="aStl" style="margin-top:14px">Choose STL files</button><button class="btn wide" id="aSvg" style="margin-top:10px">Choose an SVG instead</button>`);
    $('#aStl').onclick = () => { closeSheet(); importSTLs(); };
    $('#aSvg').onclick = () => { closeSheet(); addSvgTemplate(); };
  };
};

function editTpl(t, patch) {
  const x = S.templates.find(y => y.id === t.id);
  if (x) Object.assign(x, patch); else S.tplEdits[t.id] = { ...(S.tplEdits[t.id] || {}), ...patch };
  save();
}
VIEWS.template = ({ id }) => {
  const t = tplById(id); if (!t) return back();
  const isCustom = S.templates.some(x => x.id === id);
  const delBtn = `<button class="icon" id="delT" aria-label="Remove">${ICON.trash}</button>`;
  setTop(`${t.code} · ${t.name}`, delBtn);
  const v = $('#view'), woods = [...S.previewWoods];
  const uses = S.pieces.filter(p => Object.values(p.templates || {}).includes(id));
  const isHead = t.group === 'kitchen-head', guide = guideFor(t);
  v.innerHTML = `<div class="preview" id="big">${tplArt(t, woods)}</div>
    <p class="note center">${esc(groupById(t.group).name)} · about ${(t.w / 25.4).toFixed(1)}″ × ${(t.h / 25.4).toFixed(1)}″</p>
    <div class="tray"><button class="swrow" id="prt" style="padding:4px 2px"><div class="grow"><div class="t">Printed</div><div class="s">${S.printed[id] ? 'Printed ' + esc(new Date(S.printed[id] + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })) : 'Not printed yet'}</div></div><span class="switch ${S.printed[id] ? 'on' : ''}"><i></i></span></button></div>
    ${guide ? `<div class="tray"><div class="tray-h">How to use</div>${guide.print ? `<p class="gprint"><b>Print:</b> ${esc(guide.print)}</p>` : ''}${guide.steps.length ? `<ol class="gsteps">${guide.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}${guide.tip ? `<p class="note" style="margin:8px 0 0">${esc(guide.tip)}</p>` : ''}${guide.img ? `<figure class="gfig"><img id="gimg" src="${guide.img}" alt=""><figcaption>${esc(guide.caption || '')}</figcaption></figure>` : ''}${guide.untested && !S.printed[id] ? '<p class="note" style="margin:8px 0 0">Not test-printed yet. Flip Printed on once you have.</p>' : ''}</div>` : ''}
    <div class="tray" id="stlTray" hidden><button class="swrow" id="stlGet" style="padding:4px 2px"><div class="grow"><div class="t">Download STL</div><div class="s" id="stlName"></div></div><span class="chev">${ICON.chev || '›'}</span></button></div>
    <div class="tray"><label class="f">Name</label><input id="tname" value="${esc(t.name)}">
    ${isHead ? `<label class="f">Makes a…</label><select id="tkind">${S.kinds.map(k => `<option value="${esc(k.id)}" ${k.id === t.kind ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}<option value="+">+ New kind…</option></select>` : ''}
    <label class="f">My notes <span>(print settings, tips, what to fix)</span></label>
    <textarea id="tnotes" style="min-height:70px" placeholder="PETG, 0.2 mm layers, 4 walls…">${esc(t.notes || '')}</textarea>
    <label class="f">Inspiration <span>(goes in the story)</span></label>
    <textarea id="tinsp" style="min-height:90px" placeholder="Where the shape came from">${esc(t.inspiration || '')}</textarea></div>
    <div class="tray"><div class="tray-h">Material</div>
      <div class="seg" id="mat"><button data-pm="1" class="${t.print !== false ? 'on' : ''}">3D print</button><button data-pm="0" class="${t.print === false ? 'on' : ''}">Wood</button></div>
      <div id="tw" style="margin-top:14px"></div></div>
    <div class="sec">Used in</div>
    <div class="card flush">${uses.length ? uses.map(p => `<button class="listrow" data-id="${p.id}"><div class="grow"><div class="t">No. ${pad(p.no)} · ${esc(typeName(p))}</div><div class="s">${esc(p.woods.map(i => woodById(i)?.name).join(', '))}</div></div>${statusChip(p.status)}</button>`).join('') : '<div class="listrow muted">Not used yet</div>'}</div>
    <div style="height:30px"></div>`;
  if (t.print !== false) {
    const cols = FILAMENTS, cur = t.printColor || FIL_DEFAULT;
    $('#tw').innerHTML = `<label class="f" style="margin-top:0">Filament color <span>${esc((cols.find(c => c[0] === cur) || ['', 'custom'])[1])}</span></label><div class="fils">${cols.map(([c, n]) => `<button class="fil ${cur === c ? 'on' : ''}" data-fc="${c}" style="background:${c}" aria-label="${n}"></button>`).join('')}</div>`;
    $$('[data-fc]', v).forEach(b => b.onclick = () => { editTpl(t, { printColor: b.dataset.fc }); t.printColor = b.dataset.fc; $('#big').innerHTML = tplArt(t, woods); $$('[data-fc]', v).forEach(x => x.classList.toggle('on', x === b)); $('#tw .f span').textContent = (FILAMENTS.find(c => c[0] === b.dataset.fc) || ['', ''])[1]; });
  } else woodPicker($('#tw'), woods, () => { $('#big').innerHTML = tplArt(t, woods); });
  $$('[data-pm]', v).forEach(b => b.onclick = () => { editTpl(t, { print: b.dataset.pm === '1' }); render(); });
  stlLoad().then(ix => {
    const f = ix[id] || t.stlName; if (!f || !$('#stlTray')) return; $('#stlTray').hidden = false; $('#stlName').textContent = f;
    $('#stlGet').onclick = () => ix[id] ? saveAsset('stl/' + f, f, 'model/stl') : saveStored('stl:' + id, f, 'model/stl');
  });
  $('#prt').onclick = () => { if (S.printed[id]) delete S.printed[id]; else S.printed[id] = today(); save(); render(); };
  $('#tname').onchange = () => { editTpl(t, { name: $('#tname').value.trim() || t.name }); setTop(`${t.code} · ${$('#tname').value.trim()}`, delBtn); bindDel(); };
  $('#tinsp').onchange = () => editTpl(t, { inspiration: $('#tinsp').value.trim() });
  $('#tnotes').onchange = () => editTpl(t, { notes: $('#tnotes').value.trim() });
  $('#gimg')?.addEventListener('click', () => openSheet(`<img src="${guide.img}" alt="" style="width:100%;border-radius:12px;background:#fff;display:block">`));
  $('#tkind')?.addEventListener('change', () => {
    if ($('#tkind').value === '+') return newKindSheet(k => { editTpl(t, { kind: k.id }); render(); });
    editTpl(t, { kind: $('#tkind').value });
  });
  $$('[data-id]', v).forEach(b => b.onclick = () => go('piece', { id: b.dataset.id }));
  const bindDel = () => $('#delT').onclick = () => confirmSheet(`Remove ${t.code} ${t.name}?`, 'Remove', () => {
    const builtin = BUILTIN_TEMPLATES.some(x => x.id === id), custom = S.templates.find(x => x.id === id), printed = S.printed[id];
    S.templates = S.templates.filter(x => x.id !== id); delete S.printed[id];
    if (builtin && !S.hiddenTpls.includes(id)) S.hiddenTpls.push(id);
    save(); back();
    toast(`Removed ${t.code}`, { action: 'Undo', onAction: () => { if (custom) S.templates.push(custom); S.hiddenTpls = S.hiddenTpls.filter(x => x !== id); if (printed) S.printed[id] = printed; save(); render(); } });
  }, uses.length ? `${uses.length} logged piece${uses.length > 1 ? 's use' : ' uses'} it; they keep their drawing.` : BUILTIN_TEMPLATES.some(x => x.id === id) ? 'You can bring it back from the bottom of the Catalog.' : '');
  bindDel();
};
function newKindSheet(onDone, preset = '') {
  openSheet(`<h2>New kind of head</h2><label class="f">Name</label><input id="kn" value="${esc(cap(preset))}" placeholder="e.g. Honey dipper">
    <label class="f">Care instructions</label><textarea id="kc" style="min-height:90px">${esc(CARE.spoon)}</textarea>
    <button class="btn primary wide" id="kok" style="margin-top:14px">Add</button>`);
  $('#kok').onclick = () => {
    const name = $('#kn').value.trim(); if (!name) return toast('Name it');
    const k = { id: name.toLowerCase(), name: cap(name), noun: name.toLowerCase(), care: $('#kc').value.trim() };
    if (!kindById(k.id)) S.kinds.push(k); save(); closeSheet(); onDone(k);
  };
}

VIEWS.combo = ({ type: typeId }, frame) => {
  const type = typeById(typeId);
  setTop(type.name);
  frame.sel ||= {}; frame.woods ||= [...S.previewWoods];
  type.slots.forEach(s => { if (!frame.sel[s.name]) frame.sel[s.name] = allTemplates().find(t => t.group === s.group)?.id; });
  const v = $('#view');
  const fake = () => ({ id: 'combo', no: 0, type: typeId, templates: frame.sel, woods: frame.woods, angle: frame.angle || 0 });
  v.innerHTML = `<div class="preview" id="cpv"></div><div style="margin-top:10px">${modeSeg(viewMode)}</div>${angleRow(frame)}
    ${type.slots.map((s, si) => `<label class="f">${esc(s.name)}</label><div class="filters" data-slot="${si}">${allTemplates().filter(t => t.group === s.group).map(t => `<button class="tpl" data-tp="${t.id}"><div class="pv" style="height:70px">${tplArt(t, frame.woods, undefined, true)}</div><div class="code">${esc(t.code)}</div><div class="tn">${esc(t.name)}</div></button>`).join('')}</div>`).join('')}
    <div class="tray"><div class="tray-h">Woods</div><div id="cw"></div></div>
    <button class="btn primary wide" id="mk" style="margin-top:18px">Start a piece like this</button><div style="height:30px"></div>`;
  const draw = () => {
    $('#cpv').innerHTML = pieceArt(fake(), viewMode) || '<span class="muted">Pick the parts below</span>';
    $$('[data-slot]', v).forEach(row => { const s = type.slots[+row.dataset.slot]; $$('[data-tp]', row).forEach(b => b.classList.toggle('sel', frame.sel[s.name] === b.dataset.tp)); });
  };
  bindMode(v, draw, 'mode', fake);
  bindAngle(v, frame, draw);
  $$('[data-slot]', v).forEach(row => { const s = type.slots[+row.dataset.slot]; $$('[data-tp]', row).forEach(b => b.onclick = () => { frame.sel[s.name] = b.dataset.tp; draw(); }); });
  woodPicker($('#cw'), frame.woods, () => { draw(); $$('.tpl[data-tp]', v).forEach(b => { $('.pv', b).innerHTML = tplArt(tplById(b.dataset.tp), frame.woods, undefined, true); }); });
  draw();
  $('#mk').onclick = () => { stack.push({ view: 'editPiece', params: {}, draft: blankPiece(type.id, { templates: { ...frame.sel }, woods: [...frame.woods], angle: frame.angle || 0 }) }); render(true); };
};

/* STL / SVG import */
function guessGroup(code, joint) {
  const pre = (code.match(/^[A-Z]+/) || [''])[0];
  if (pre === 'BP' || pre === 'DG') return 'shop-extras';   // blade protectors and drill guides live with the shop extras
  const exact = S.groups.find(g => g.prefix && g.prefix === pre); if (exact) return exact.id;
  if (pre === 'KV') return 'side-view';
  if (pre === 'KH') return 'kitchen-handle';
  if (pre.startsWith('K')) return 'kitchen-head';
  if (pre === 'H') return 'knife-handle';
  if (pre === 'A') return 'knife-arm';
  return joint?.kind === 'tail' ? 'kitchen-handle' : 'kitchen-head';
}
function guessKind(name) {
  const n = name.toLowerCase();
  const k = S.kinds.find(k => n.includes(k.id)); if (k) return k.id;
  if (/bowl|spoon/.test(n)) return 'spoon';
  if (/scraper/.test(n)) return 'jar scraper';
  if (/spread/.test(n)) return 'butter spreader';
  if (/paddle/.test(n)) return 'dough paddle';
  return 'spoon';
}
async function importSTLs() {
  const files = await pickFiles('.stl,model/stl,application/sla,application/octet-stream', true);
  if (!files.length) return;
  openSheet(`<div class="loading">${spinner()}Reading ${files.length} file${files.length > 1 ? 's' : ''}…</div>`);
  await new Promise(r => setTimeout(r, 30));
  const items = [];
  for (const f of files) {
    try {
      const buf = await readBuf(f), t = G.fromSTL(buf), nm = G.nameFromFile(f.name);
      if (!t.d || t.w < 5) throw new Error('empty');
      const code = nm.code || ('T' + (S.templates.length + items.length + 1));
      const group = guessGroup(code, t.joint);
      items.push({ _buf: buf, ...t, id: code, code, name: nm.name, group, print: group === 'shop-extras' || undefined, kind: group === 'kitchen-head' ? guessKind(nm.name) : undefined, inspiration: '', builtin: false, holeDia: /porthole/i.test(f.name) ? 28.575 : 19.05, file: f.name });
    } catch (e) { toast(`Couldn't read ${f.name}`); }
  }
  // Leave out anything that is already in the catalog (removed templates count), or repeated in this batch
  const skipped = [], fresh = [], known = allTemplates(true);
  for (const t of items) {
    const same = known.find(x => G.sameShape(t, x)) || fresh.find(x => G.sameShape(t, x));
    if (same) skipped.push(`${t.file} is the same shape as ${same.code}${S.hiddenTpls.includes(same.id) ? ' (in your Removed list)' : ''}`); else fresh.push(t);
  }
  items.length = 0; items.push(...fresh);
  if (!items.length) { return openSheet(`<h2>Already in your catalog</h2><p class="muted">Nothing new to add. ${skipped.length > 1 ? 'All ' + skipped.length + ' files match templates you already have.' : 'That file matches a template you already have.'}</p><div class="card flush">${skipped.map(s => `<div class="listrow small">${esc(s)}</div>`).join('')}</div><button class="btn wide" id="dupOk" style="margin-top:14px">OK</button>`), $('#dupOk').onclick = () => closeSheet(); }
  const optsG = sel => liveGroups().map(g => `<option value="${g.id}" ${g.id === sel ? 'selected' : ''}>${esc(g.name)}</option>`).join('');
  const optsK = sel => S.kinds.map(k => `<option value="${esc(k.id)}" ${k.id === sel ? 'selected' : ''}>${esc(k.name)}</option>`).join('');
  openSheet(`<h2>Add ${items.length} template${items.length > 1 ? 's' : ''}</h2>
    ${skipped.length ? `<p class="note" style="margin-top:-6px">Left out ${skipped.length} you already have: ${esc(skipped.join('; '))}.</p>` : ''}
    ${items.map((t, i) => `<div class="card" style="margin-bottom:10px"><div class="row" style="align-items:flex-start;gap:12px">
      <div style="flex:0 0 84px;height:84px;display:grid;place-items:center">${tplArt(t, S.previewWoods)}</div>
      <div><div class="row"><input data-i="${i}" data-k="code" value="${esc(t.code)}" style="flex:.6"><input data-i="${i}" data-k="name" value="${esc(t.name)}"></div>
        <select data-i="${i}" data-k="group" style="margin-top:8px">${optsG(t.group)}</select>
        <select data-i="${i}" data-k="kind" style="margin-top:8px" ${t.group === 'kitchen-head' ? '' : 'hidden'}>${optsK(t.kind)}</select>
        <div class="small muted" style="margin-top:6px">${t.joint ? (t.joint.kind === 'tail' ? 'Dovetail tail found' : 'Dovetail socket found') : 'No dovetail found'}${t.punches.length ? ` · ${t.punches.length} punch mark${t.punches.length > 1 ? 's' : ''}` : ''}${allTemplates().some(x => x.id === t.id) ? ' · <b>replaces the current ' + esc(t.code) + '</b>' : ''}</div></div></div></div>`).join('')}
    <button class="swrow" id="imPr"><div class="grow"><div class="t">I've printed these</div></div><span class="switch"><i></i></span></button>
    <button class="btn primary wide" id="imOk" style="margin-top:12px">Add to catalog</button>`);
  let printed = false;
  $('#imPr').onclick = () => { printed = !printed; $('#imPr .switch').classList.toggle('on', printed); };
  $$('#sheetCard [data-i]').forEach(el => el.onchange = () => {
    const t = items[+el.dataset.i]; t[el.dataset.k] = el.value.trim();
    if (el.dataset.k === 'group') { const ks = $(`#sheetCard select[data-i="${el.dataset.i}"][data-k="kind"]`); ks.hidden = el.value !== 'kitchen-head'; if (!ks.hidden && !t.kind) t.kind = ks.value; }
    if (el.dataset.k === 'code') t.id = t.code = el.value.trim().toUpperCase();
  });
  $('#imOk').onclick = () => {
    for (const t of items) {
      if (t.group !== 'kitchen-head') delete t.kind;
      if (!t.print) delete t.print;
      if (t._buf) { t.stlName = t.file; photoPut('stl:' + t.id, bufToDataUrl(t._buf)); }
      delete t._buf;
      const prev = tplById(t.id);
      if (prev && !t.inspiration) t.inspiration = prev.inspiration || '';
      S.templates = S.templates.filter(x => x.id !== t.id); S.templates.push(t);
      if (printed) S.printed[t.id] = today();
    }
    save(); catGroup = items[0].group; closeSheet(); render(); toast(`Added ${items.map(t => t.code).join(', ')}`);
  };
}
function parseSVG(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.querySelector('svg'); if (!root) throw new Error('Not an SVG');
  const holder = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  holder.setAttribute('style', 'position:absolute;left:-9999px;top:0;width:2000px;height:2000px');
  holder.innerHTML = root.innerHTML; document.body.appendChild(holder);
  holder.querySelectorAll('text, metadata, title, desc, style, script, clipPath, mask, pattern, image').forEach(e => e.remove());
  holder.querySelectorAll('[clip-path]').forEach(e => e.removeAttribute('clip-path'));
  const keep = [];
  for (const el of holder.querySelectorAll('path, polygon, polyline, rect, circle, ellipse')) {
    const fill = (el.getAttribute('fill') || el.style.fill || '').toLowerCase().replace(/\s/g, '');
    let bb; try { bb = el.getBBox(); } catch (e) { continue; }
    if (bb.width < 0.5 && bb.height < 0.5) continue;
    if (/^(#fff|#ffffff|white|rgb\(255,255,255\))$/.test(fill)) continue;
    keep.push(el);
  }
  if (!keep.length) { holder.remove(); throw new Error('No shapes found'); }
  const base = holder.getCTM();
  const items = keep.map(el => { const c = el.cloneNode(false); ['style', 'fill', 'stroke', 'class', 'id', 'stroke-width', 'transform'].forEach(a => c.removeAttribute(a)); return { c, m: base && el.getCTM() ? base.inverse().multiply(el.getCTM()) : new DOMMatrix() }; });
  holder.innerHTML = '';
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  items.forEach(({ c, m }) => { const x = c.cloneNode(false); x.setAttribute('transform', `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`); g.appendChild(x); });
  holder.appendChild(g); const bb = g.getBBox(); holder.remove();
  const s = /mm/.test(root.getAttribute('width') || '') ? 1 : 25.4 / 72;
  const markup = items.map(({ c, m }) => { c.setAttribute('transform', `matrix(${[s * m.a, s * m.b, s * m.c, s * m.d, s * (m.e - bb.x), s * (m.f - bb.y)].map(v => +v.toFixed(5)).join(' ')})`); return c.outerHTML; }).join('');
  return { w: +(bb.width * s).toFixed(1), h: +(bb.height * s).toFixed(1), markup };
}
async function addSvgTemplate() {
  const [file] = await pickFiles('.svg,image/svg+xml'); if (!file) return;
  let shape; try { shape = parseSVG(await readText(file)); } catch (e) { return toast('Could not read that SVG: ' + e.message); }
  const nm = G.nameFromFile(file.name);
  const t = { id: nm.code || uid(), code: nm.code || '', name: nm.name, group: catGroup || S.groups[0].id, builtin: false, inspiration: '', punches: [], ...shape };
  const nextCode = gid => { const g = groupById(gid), nums = allTemplates().filter(x => x.group === gid).map(x => parseInt(String(x.code).replace(/\D/g, '')) || 0); return (g.prefix || '') + ((nums.length ? Math.max(...nums) : 0) + 1); };
  if (!t.code) t.code = nextCode(t.group);
  const dup = allTemplates(true).find(x => G.sameShape(t, x));
  if (dup) return toast(`That's the same shape as ${dup.code} ${dup.name}, already in your catalog`);
  openSheet(`<h2>New template</h2><div class="preview" style="min-height:160px">${tplArt(t, S.previewWoods)}</div>
    <label class="f">Group</label><select id="ng">${liveGroups().map(g => `<option value="${g.id}" ${g.id === t.group ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}<option value="+">+ New group…</option></select>
    <div id="newG" hidden><div class="row"><div><label class="f">Group name</label><input id="ngn" placeholder="e.g. Board handles"></div><div style="flex:.5"><label class="f">Code prefix</label><input id="ngp" placeholder="B"></div></div></div>
    <div class="row"><div style="flex:.5"><label class="f">Number</label><input id="nc" value="${esc(t.code)}"></div><div><label class="f">Name</label><input id="nn" value="${esc(t.name)}"></div></div>
    <p class="note">SVGs show the shape only. Use the STL to get the dovetail and punch marks for finished previews.</p>
    <button class="btn primary wide" id="nok" style="margin-top:10px">Add to catalog</button>`);
  $('#ng').onchange = () => { const nw = $('#ng').value === '+'; $('#newG').hidden = !nw; if (!nw) $('#nc').value = nextCode($('#ng').value); };
  $('#ngp').oninput = () => { $('#nc').value = ($('#ngp').value.trim().toUpperCase() || '') + '1'; };
  $('#nok').onclick = () => {
    let gid = $('#ng').value;
    if (gid === '+') { const name = $('#ngn').value.trim(); if (!name) return toast('Name the new group'); gid = 'g-' + uid(); S.groups.push({ id: gid, name, prefix: $('#ngp').value.trim().toUpperCase() }); }
    t.group = gid; t.code = $('#nc').value.trim() || t.code; t.id = t.code || t.id; t.name = $('#nn').value.trim() || t.name;
    if (t.group === 'kitchen-head') t.kind = guessKind(t.name);
    S.templates = S.templates.filter(x => x.id !== t.id); S.templates.push(t); save(); catGroup = gid; closeSheet(); render(); toast(`Added ${t.code}`);
  };
}

/* ---------- Woods ---------- */
let woodScope = 'shop', woodQuery = '', woodSort = 'az';
VIEWS.woods = () => {
  setTop('Woods', `<button class="icon" id="addWood" aria-label="Add a custom wood">${ICON.plus}</button>`);
  const v = $('#view');
  const tracked = S.shop.map(id => stockOf(id)).filter(s => s.bf != null), onHand = tracked.reduce((a, s) => a + s.bf, 0), worth = tracked.reduce((a, s) => a + (s.cost > 0 ? s.bf * s.cost : 0), 0);
  v.innerHTML = `<div class="search">${ICON.search}<input id="wsq" type="search" placeholder="Search ${allWoods().length} woods" value="${esc(woodQuery)}" autocomplete="off"></div>
    <div class="seg" style="margin:0 0 10px"><button data-sc="shop" class="${woodScope === 'shop' ? 'on' : ''}">In my shop (${S.shop.length})</button><button data-sc="all" class="${woodScope === 'all' ? 'on' : ''}">All woods</button></div>
    <div class="row" style="margin-bottom:12px"><div class="seg" id="wsort"><button data-so="az" class="${woodSort === 'az' ? 'on' : ''}">A–Z</button><button data-so="hard" class="${woodSort === 'hard' ? 'on' : ''}">Hardest</button></div>
      <button class="btn small tonal" id="wid" style="flex:none">Identify from photo</button></div>
    ${tracked.length ? `<p class="note" style="margin:0 2px 10px">${fmtBf(onHand)} bd ft on hand${worth ? `, about ${fmt$(worth)} of wood` : ''}.</p>` : ''}
    <div class="card flush" id="wl"></div>
    <p class="note">Only woods in your shop show in the checklist when you log a piece. Tap a wood to track how many board feet you have and what you paid.</p><div style="height:20px"></div>`;
  const draw = () => {
    const q = woodQuery.trim();
    let list = woodScope === 'shop' && !q ? shopWoods() : allWoods(), guesses = [];
    if (q) ({ hits: list, guesses } = findWoods(q));
    if (q && !list.length) list = guesses;
    if (woodSort === 'hard' && !(q && guesses.length && list === guesses)) list = [...list].sort((a, b) => (b.janka || 0) - (a.janka || 0));
    $('#wl').innerHTML = (q && guesses.length ? '<div class="listrow small muted">Did you mean…</div>' : '') + list.map(w => `<div class="listrow"><button class="grow row" data-w="${w.id}" style="gap:12px;text-align:left">${swatch(w, 38, 11)}
      <div class="grow" style="min-width:0"><div class="t">${esc(w.name)}</div><div class="s">${esc(woodSub(w))}</div></div></button>
      <button class="switch ${S.shop.includes(w.id) ? 'on' : ''}" data-sw="${w.id}" aria-label="In my shop"><i></i></button></div>`).join('') + (q && !findWoods(q).hits.length ? `<button class="listrow add" id="addNewW">+ Add "${esc(q)}" as a new wood</button>` : '');
    $('#addNewW', v)?.addEventListener('click', () => newWoodFlow(q, () => { woodQuery = ''; }));
    $$('[data-w]', v).forEach(b => b.onclick = () => go('editWood', { id: b.dataset.w }));
    $$('[data-sw]', v).forEach(b => b.onclick = () => { const id = b.dataset.sw; if (S.shop.includes(id)) S.shop = S.shop.filter(x => x !== id); else S.shop.push(id); save(); b.classList.toggle('on'); $('[data-sc="shop"]').textContent = `In my shop (${S.shop.length})`; });
  };
  $('#wsq').oninput = () => { woodQuery = $('#wsq').value; draw(); };
  $$('[data-so]', v).forEach(b => b.onclick = () => { woodSort = b.dataset.so; $$('[data-so]', v).forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $('#wid').onclick = () => identifyWood(null);
  $$('[data-sc]', v).forEach(b => b.onclick = () => { woodScope = b.dataset.sc; $$('[data-sc]', v).forEach(x => x.classList.toggle('on', x === b)); draw(); });
  draw();
  longPress($('#wl'), '[data-w]', el => woodMenu(el.dataset.w));
  $('#addWood').onclick = () => newWoodFlow('', null);
};
VIEWS.editWood = ({ id }, frame) => {
  const lib = LIB.find(w => w.id === id), custom = S.woods.find(w => w.id === id);
  const w = frame.draft ||= id ? { ...woodById(id) } : { id: 'w-' + uid(), name: frame.preset?.name || '', color: '#9a6b45', color2: '#a87a52', origin: '', story: '', custom: true };
  frame.stock ||= { ...stockOf(w.id) };
  const used = S.pieces.some(p => p.woods.includes(w.id));
  setTop(id ? w.name : 'Custom wood', `<button class="btn small primary" id="sw">Save</button>`, true);
  const v = $('#view'), stk = frame.stock;
  v.innerHTML = `<div id="wsw" style="height:76px;border-radius:22px;box-shadow:inset 0 0 0 1px #0005"></div>
    <div class="tray"><label class="f" style="margin-top:0">Name</label><input id="wn" value="${esc(w.name)}" placeholder="e.g. Grandpa's cherry" autocomplete="off">
    <div id="wdym"></div><div id="wconf"></div></div>
    ${!id ? `<div class="tray"><div class="tray-h">Not in the list? Let Claude fill it in</div>
      <p class="note" style="margin:-6px 0 12px">1. Tap Copy and paste it into the Claude app. 2. Copy Claude's reply. 3. Tap Paste reply. Color, origin and story fill in.</p>
      <div class="row"><button class="btn small" id="wcopy">Copy for Claude</button><button class="btn small primary" id="wpaste">Paste reply</button></div>
      <textarea id="wreply" placeholder="…or paste Claude's reply here" style="min-height:60px;margin-top:10px"></textarea></div>` : ''}
    <div class="tray"><div class="tray-h">In your shop <span class="small muted">optional</span></div>
      <div class="row"><div><label class="f" style="margin-top:0">On hand (bd ft)</label><input id="wbf" inputmode="decimal" value="${stk.bf != null ? esc(+(+stk.bf).toFixed(2)) : ''}" placeholder="—"></div><div><label class="f" style="margin-top:0">Cost per bd ft</label><input id="wcost" inputmode="decimal" value="${stk.cost ? esc(stk.cost) : ''}" placeholder="$"></div></div>
      <button class="btn small tonal" id="wadd" style="margin-top:12px">+ Add boards</button>
      <p class="note">Cut lists compare what a piece needs with what's on hand, and price the wood.</p></div>
    <div class="tray"><div class="tray-h">Look and story</div>
    <div class="row"><div><label class="f" style="margin-top:0">Color</label><input id="wc" type="color" value="${esc(w.color)}" style="height:50px;padding:4px"></div>
      <div><label class="f" style="margin-top:0">Grain color</label><input id="wc2" type="color" value="${esc(w.color2 || w.color)}" style="height:50px;padding:4px"></div></div>
    <div class="row"><div><label class="f">Where it's from</label><input id="wo" value="${esc(w.origin)}" placeholder="e.g. Eastern United States"></div>
      <div style="flex:.55"><label class="f">Janka (lbf)</label><input id="wj" inputmode="numeric" value="${esc(w.janka || '')}" placeholder="—"></div></div>
    <label class="f">Story blurb</label><textarea id="ws" placeholder="A sentence or two the buyer will read about this wood.">${esc(w.story)}</textarea></div>
    ${lib && S.woodEdits[id] ? `<button class="btn wide" id="rw" style="margin-top:18px">Reset to library version</button>` : ''}
    ${custom && !used ? `<button class="btn wide danger" id="dw" style="margin-top:18px">Delete wood</button>` : ''}<div style="height:30px"></div>`;
  const sw = () => $('#wsw').style.background = `repeating-linear-gradient(90deg,${$('#wc').value} 0 18px,${$('#wc2').value} 18px 22px)`;
  $('#wc').oninput = sw; $('#wc2').oninput = sw; sw();
  const dym = () => {
    if (id) return;
    const q = $('#wn').value.trim(); if (q.length < 3) { $('#wdym').innerHTML = ''; return; }
    const { hits, guesses } = findWoods(q, LIB.map(x => woodById(x.id)));
    const list = (hits.length ? hits : guesses).slice(0, 3);
    $('#wdym').innerHTML = list.length ? `<div class="card flush" style="margin-top:10px"><div class="listrow small muted">${hits.length ? 'Already in the library. Tap to use it' : 'Did you mean…'}</div>${list.map(x => `<button class="listrow" data-lib="${x.id}">${woodRow(x, '<span class="chip avail">Use</span>')}</button>`).join('')}</div>` : '';
    $$('[data-lib]', v).forEach(b => b.onclick = () => {
      const lid = b.dataset.lib; if (!S.shop.includes(lid)) S.shop.push(lid); save();
      const done = frame.onDone; stack.pop(); try { if (done) done(lid); } catch (e) {} render(true); toast(`${woodById(lid).name} added to your shop`);
    });
  };
  $('#wn').oninput = dym; dym();
  const applyReply = txt => {
    const r = parseWoodReply(txt);
    if (!r.color && !r.story) return toast("Couldn't read that reply. Copy Claude's whole answer and try again.");
    if (r.name) $('#wn').value = r.name; if (r.color) $('#wc').value = r.color; if (r.color2 || r.color) $('#wc2').value = r.color2 || r.color;
    if (r.origin) $('#wo').value = r.origin; if (r.story) $('#ws').value = r.story; if (r.janka) $('#wj').value = r.janka; sw();
    $('#wconf') && ($('#wconf').innerHTML = r.confidence ? `<div class="card" style="margin-top:10px"><b>Claude's confidence:</b> ${esc(r.confidence)}</div>` : '');
    dym(); toast('Filled in. Check it over, then Save.');
  };
  if (frame.identify) {
    $('#wcopy').textContent = 'Send photo to Claude';
    const h = $('.tray-h', $('#wcopy').closest('.tray')); if (h) h.textContent = 'Identify it with Claude';
    const steps = $('.note', $('#wcopy').closest('.tray')); if (steps) steps.textContent = '1. Tap Send photo and pick the Claude app. 2. Copy Claude\'s reply. 3. Tap Paste reply. If it\'s a wood already in the list, you\'ll be offered that one.';
  }
  $('#wcopy')?.addEventListener('click', () => {
    if (frame.identify) return sendToClaude(frame.identify, idPrompt());
    copyText(woodPrompt($('#wn').value.trim() || 'this'), 'Copied. Paste it into Claude');
  });
  $('#wpaste')?.addEventListener('click', async () => {
    let t = $('#wreply').value;
    if (!t) { try { t = bridge && bridge.readClipboard ? bridge.readClipboard() : await navigator.clipboard.readText(); } catch (e) {} }
    if (!t) return toast('Copy Claude\'s reply first, or paste it in the box');
    applyReply(t);
  });
  $('#wreply')?.addEventListener('input', () => { if (/color\s*:/i.test($('#wreply').value) && /story\s*:/i.test($('#wreply').value)) applyReply($('#wreply').value); });
  $('#wadd').onclick = () => addBoardsSheet(bf => { const cur = num$($('#wbf').value) || 0; $('#wbf').value = +(cur + bf).toFixed(2); toast(`Added ${fmtBf(bf)} bd ft`); });
  $('#sw').onclick = () => {
    const d = { name: $('#wn').value.trim(), color: $('#wc').value, color2: $('#wc2').value, origin: $('#wo').value.trim(), story: $('#ws').value.trim(), janka: parseInt(String($('#wj').value).replace(/\D/g, '')) || null };
    if (!d.name) return toast('Give it a name');
    if (lib) {
      const base = LIB.find(x => x.id === id), same = ['name', 'color', 'color2', 'origin', 'story', 'janka'].every(k => String(d[k] ?? '') === String((S.woodEdits[id] || base)[k] ?? ''));
      if (!same) S.woodEdits[id] = d;
    } else { const i = S.woods.findIndex(x => x.id === w.id); const nw = { ...w, ...d }; if (i >= 0) S.woods[i] = nw; else { S.woods.push(nw); S.shop.push(nw.id); } }
    const bf = num$($('#wbf').value), cost = num$($('#wcost').value);
    if ($('#wbf').value.trim() === '' && !cost) delete S.stock[w.id];
    else S.stock[w.id] = { bf: $('#wbf').value.trim() === '' ? null : bf, cost: cost || null };
    if (S.stock[w.id] && S.stock[w.id].bf == null) delete S.stock[w.id].bf;
    save(); const done = frame.onDone; stack.pop(); try { if (done) done(w.id); } catch (e) {} render(true);
  };
  $('#rw')?.addEventListener('click', () => { delete S.woodEdits[id]; save(); frame.draft = null; render(); });
  $('#dw')?.addEventListener('click', () => confirmSheet(`Delete ${w.name}?`, 'Delete', () => { S.woods = S.woods.filter(x => x.id !== w.id); S.shop = S.shop.filter(x => x !== w.id); delete S.stock[w.id]; save(); back(); }));
};
// Board-foot calculator for a stack of rough lumber
function addBoardsSheet(onAdd) {
  const st = { t: 1, w: 6, l: 96, n: 1 };
  const bf = () => st.t * st.w * st.l / 144 * st.n;
  const draw = () => {
    openSheet(`<h2>Add boards</h2>
      <label class="f" style="margin-top:0">Thickness</label>
      <div class="filters" style="padding-bottom:4px">${[[1, '4/4'], [1.25, '5/4'], [1.5, '6/4'], [2, '8/4'], [2.5, '10/4'], [3, '12/4'], [4, '16/4']].map(([v, l]) => `<button data-th="${v}" class="${st.t === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="row" style="margin-top:8px">${measBtn('abW', 'Width', st.w)}${measBtn('abL', 'Length', st.l)}</div>
      <p class="note">${st.l >= 12 ? `${+(st.l / 12).toFixed(2)} ft long` : ''}</p>
      <div class="counts" style="grid-template-columns:1fr"><div class="stepper" id="abN"><button data-d="-1" aria-label="Fewer">−</button><div class="sv"><b>${st.n}</b><span>board${st.n > 1 ? 's' : ''} like this</span></div><button data-d="1" aria-label="More">+</button></div></div>
      <div class="dims" style="text-align:center;margin:18px 0 6px">${fmtBf(bf())}<span class="sub">board feet</span></div>
      <button class="btn primary wide" id="abOk" style="margin-top:8px">Add ${fmtBf(bf())} bd ft</button>`);
    $$('[data-th]').forEach(b => b.onclick = () => { st.t = +b.dataset.th; draw(); });
    $('#abW').onclick = () => measure({ title: 'Board width', value: st.w, min: .5, max: 30, quick: [4, 5, 6, 7, 8, 10, 12], onSet: v => { st.w = v; draw(); } });
    $('#abL').onclick = () => measure({ title: 'Board length', value: st.l, min: 1, max: 192, quick: [24, 36, 48, 72, 96, 120], info: v => `${+(v / 12).toFixed(2)} ft`, onSet: v => { st.l = v; draw(); } });
    $$('#abN [data-d]').forEach(b => b.onclick = () => { st.n = Math.max(1, st.n + +b.dataset.d); draw(); });
    $('#abOk').onclick = () => { const v = +bf().toFixed(2); closeSheet(); onAdd(v); };
  };
  draw();
}

/* ---------- Settings ---------- */
VIEWS.settings = () => {
  setTop('Settings');
  const st = S.settings, v = $('#view');
  const sold = S.pieces.filter(p => p.status === 'sold');
  const total = sold.reduce((a, p) => a + (num$(p.price) || 0), 0);
  const withCost = sold.map(p => ({ p, c: woodCost(p) })).filter(x => x.c && num$(x.p.price) != null);
  const profit = withCost.reduce((a, x) => a + num$(x.p.price) - x.c.v, 0);
  v.innerHTML = `
    <div class="money" style="grid-template-columns:repeat(${withCost.length ? 4 : 3},1fr);margin-top:4px">
      <div><b>${S.pieces.length}</b><span>logged</span></div><div><b>${sold.length}</b><span>sold</span></div><div><b>${fmt$(total)}</b><span>sales</span></div>${withCost.length ? `<div><b>${fmt$(profit)}</b><span>profit*</span></div>` : ''}</div>
    ${withCost.length ? `<p class="note">*Profit on the ${withCost.length} sold piece${withCost.length > 1 ? 's' : ''} with a wood cost.</p>` : ''}
    <div class="tray"><div class="tray-h">Shop logo</div>
      ${logoSrc() ? `<div class="logocard"><img src="${esc(logoSrc())}" alt="Shop logo"></div>` : '<p class="note" style="margin-top:-6px">Add your logo and it goes on QR tags and the story page customers see.</p>'}
      <div class="row" style="margin-top:12px"><button class="btn small" id="logoPick">${logoSrc() ? 'Change logo' : 'Add a logo'}</button>${logoSrc() ? '<button class="btn small" id="logoRm">Remove</button>' : ''}</div>
      ${logoSrc() ? '<p class="note">On QR tags and the story page. Save the story page file again after you change it.</p>' : ''}</div>
    <div class="tray"><div class="tray-h">You</div>
    <label class="f" style="margin-top:0">Your name <span>(signs each story)</span></label><input id="maker" value="${esc(st.maker)}">
    <label class="f">Shop name <span>(optional)</span></label><input id="shop" value="${esc(st.shop)}" placeholder="Leave blank to use your name">
    <label class="f">Email <span>(printed on cards)</span></label><input id="email" type="email" inputmode="email" value="${esc(st.email || '')}" placeholder="you@example.com">
    <p class="note" style="margin:-4px 0 10px">Starting at a higher number is fine, like 25. Pieces made before Bench aren't counted, so a story only says "the first piece with this combination" when you turn that on for the piece.</p>
    <div class="row"><div><label class="f">Next piece number</label><input id="nextNo" inputmode="numeric" value="${st.nextNumber}"></div><div><label class="f">Default finish</label><select id="dfin">${S.finishes.map(f => `<option ${f.name === st.defaultFinish ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></div></div>
    <label class="f">End of every listing</label><textarea id="lend" style="min-height:70px">${esc(st.listingEnd)}</textarea></div>
    <div class="tray"><div class="tray-h">Story page for QR codes</div>
      ${ghOn() ? `<p class="note" style="margin:-6px 0 10px">Connected. Pieces go online by themselves when you print a QR, and the page updates itself after app updates.</p>
      <div class="pagechip">${esc(st.pageUrl.replace(/^https:\/\//, ''))}</div>
      <div class="row" style="margin-top:12px"><button class="btn small" id="gsOpen">Open page</button><button class="btn small" id="gsOff">Disconnect</button></div>`
      : `<p class="note" style="margin:-6px 0 10px">QR codes open a page with the piece and its story. Set it up once and Bench takes care of it from then on.</p>
      <button class="btn primary wide" id="gsSet">Set up story page</button>
      <details class="adv"><summary>Use my own web address instead</summary>
      <p class="note">The piece details ride inside the QR link, so the codes are busier. Upload the file yourself, and again after app updates.</p>
      <label class="f">Page address</label><input id="purl" value="${esc(st.pageUrl)}" placeholder="https://…" inputmode="url">
      <button class="btn wide" id="getPage" style="margin-top:12px">Save the story page file</button></details>`}</div>
    ${ghOn() ? `<div class="tray"><div class="tray-h">Use on your computer</div>
      <p class="note" style="margin:-6px 0 10px">The same pieces on your phone and your computer, kept in step by themselves. Open the link once on the computer and it signs in on its own.</p>
      <div class="row">${bridge ? '<button class="btn small" id="cpSend">Send link to myself</button>' : ''}<button class="btn small" id="cpCopy">Copy link</button></div>
      <p class="note" id="syStat" style="margin-top:12px"></p><button class="btn small" id="syNow">Sync now</button>
      <p class="note">Keep that link to yourself. Anyone who has it can open your pieces.</p></div>` : ''}
    <div class="sec">Item types</div>
    <div class="card flush">${S.types.map(t => `<button class="listrow" data-type="${t.id}"><div class="grow"><div class="t">${esc(t.name)}</div><div class="s">${t.board ? 'Board designer + cut list' : t.bowl ? 'Bowl designer + cut list' : t.slots.length ? esc(t.slots.map(s => s.name).join(' + ')) : 'No templates'}${t.join === 'dovetail' ? ' · dovetail' : ''}</div></div></button>`).join('')}
      <button class="listrow add" id="addType">+ Add item type</button></div>
    <div class="sec">Head kinds</div>
    <div class="card flush">${S.kinds.map((k, i) => `<button class="listrow" data-kind="${i}"><div class="grow"><div class="t">${esc(k.name)}</div><div class="s">${esc(k.care)}</div></div></button>`).join('')}
      <button class="listrow add" id="addKind">+ Add head kind</button></div>
    <div class="sec">Finishes</div>
    <div class="card flush">${S.finishes.map((f, i) => `<button class="listrow" data-fin="${i}"><div class="grow"><div class="t">${esc(f.name)}</div><div class="s">${esc(f.story || 'No story line')}</div></div></button>`).join('')}
      <button class="listrow add" id="addFin">+ Add finish</button></div>
    <div class="tray"><div class="tray-h">Look</div>
      <button class="swrow" id="grainTog" style="padding:4px 2px"><div class="grow"><div class="t">Wood grain in drawings</div><div class="s">Turn off to make big lists draw faster</div></div><span class="switch ${GR.on ? 'on' : ''}"><i></i></span></button></div>
    <div class="tray"><div class="tray-h">Backup</div>
    <div class="row"><button class="btn" id="bk">Back up</button><button class="btn" id="rs">Restore</button></div>
    <p class="note">Backups go to your Downloads folder and include all photos. Keep one somewhere safe, like Google Drive.</p></div>
    <p class="note center" style="margin-top:30px">Bench ${APP_VERSION}</p><div style="height:20px"></div>`;
  const bind = (sel, key, num) => $(sel).onchange = () => { st[key] = num ? (parseInt($(sel).value) || st[key]) : $(sel).value.trim(); save(); };
  bind('#email', 'email'); bind('#maker', 'maker'); bind('#shop', 'shop'); bind('#nextNo', 'nextNumber', true); bind('#dfin', 'defaultFinish'); bind('#lend', 'listingEnd'); if ($('#purl')) bind('#purl', 'pageUrl');
  $('#gsSet')?.addEventListener('click', () => pageSetupSheet());
  if (ghOn()) {
    syShow();
    $('#cpSend')?.addEventListener('click', () => bridge.shareText(computerLink(), 'Bench on my computer'));
    $('#cpCopy')?.addEventListener('click', async () => { try { bridge ? bridge.copyText(computerLink()) : await navigator.clipboard.writeText(computerLink()); toast('Link copied'); } catch (e) { toast('Could not copy'); } });
    $('#syNow')?.addEventListener('click', async () => { $('#syStat').textContent = 'Syncing…'; await syncNow(); syShow(); });
  }
  $('#gsOpen')?.addEventListener('click', () => openUrl(st.pageUrl));
  $('#gsOff')?.addEventListener('click', () => { const was = st.gh, url = st.pageUrl; st.gh = null; st.pageUrl = ''; save(); render(); toast('Disconnected', { action: 'Undo', onAction: () => { st.gh = was; st.pageUrl = url; save(); render(); } }); });
  if ($('#getPage')) $('#getPage').onclick = async () => { const logo = await logoDataUrl(); let html = await (await fetch('story.html')).text(); if (logo) html = html.replace('<head>', `<head><script>window.SHOP_LOGO=${JSON.stringify(logo)}</script>`); saveFile(html, 'index.html', 'text/html'); };
  $$('[data-type]', v).forEach(b => b.onclick = () => go('editType', { id: b.dataset.type }));
  $('#addType').onclick = () => go('editType', {});
  $$('[data-kind]', v).forEach(b => b.onclick = () => kindSheet(+b.dataset.kind));
  $('#addKind').onclick = () => newKindSheet(() => render());
  $$('[data-fin]', v).forEach(b => b.onclick = () => finishSheet(+b.dataset.fin));
  $('#addFin').onclick = () => finishSheet(-1);
  $('#logoPick').onclick = async () => { const [f] = await pickFiles('image/*'); if (!f) return; try { st.logo = await logoFromFile(f); save(); render(); toast('Logo saved'); } catch (e) { toast('Could not find a logo in that picture'); } };
  $('#logoRm')?.addEventListener('click', () => { const was = st.logo; st.logo = ''; save(); render(); toast('Logo removed', { action: 'Undo', onAction: () => { st.logo = was; save(); render(); } }); });
  $('#grainTog').onclick = () => { GR.on = !GR.on; S.settings.grain = GR.on; save(); render(); };
  $('#bk').onclick = backup; $('#rs').onclick = restore;
};
function kindSheet(i) {
  const k = S.kinds[i];
  openSheet(`<h2>${esc(k.name)}</h2><label class="f">Name</label><input id="kn" value="${esc(k.name)}"><label class="f">Care instructions</label><textarea id="kc" style="min-height:110px">${esc(k.care)}</textarea>
    <button class="btn primary wide" id="kok" style="margin-top:16px">Save</button>`);
  $('#kok').onclick = () => { k.name = $('#kn').value.trim() || k.name; k.care = $('#kc').value.trim(); save(); closeSheet(); render(); };
}
function finishSheet(i) {
  const f = i >= 0 ? S.finishes[i] : { name: '', story: '' };
  openSheet(`<h2>${i >= 0 ? 'Edit finish' : 'New finish'}</h2><label class="f">Name</label><input id="fn" value="${esc(f.name)}"><label class="f">Story line</label><textarea id="fs" style="min-height:90px">${esc(f.story)}</textarea>
    <div class="row" style="margin-top:16px">${i >= 0 ? '<button class="btn danger" id="fd">Delete</button>' : ''}<button class="btn primary" id="fok">Save</button></div>`);
  $('#fok').onclick = () => { const n = $('#fn').value.trim(); if (!n) return toast('Name it'); const nf = { name: n, story: $('#fs').value.trim() }; if (i >= 0) S.finishes[i] = nf; else S.finishes.push(nf); save(); closeSheet(); render(); };
  $('#fd')?.addEventListener('click', () => { S.finishes.splice(i, 1); save(); closeSheet(); render(); });
}
VIEWS.editType = ({ id }, frame) => {
  const ex = S.types.find(t => t.id === id);
  const t = frame.draft ||= ex ? structuredClone(ex) : { id: 't-' + uid(), name: '', noun: '', slots: [], join: 'none', build: '', care: CARE.board };
  setTop(ex ? t.name : 'New item type', `<button class="btn small primary" id="st">Save</button>`, true);
  const v = $('#view'), used = S.pieces.some(p => p.type === t.id);
  v.innerHTML = `
    <div class="tray"><label class="f" style="margin-top:0">Name</label><input id="tn" value="${esc(t.name)}" placeholder="e.g. Charcuterie board">
    <label class="f">In a sentence it's a…</label><input id="tno" value="${esc(t.noun)}" placeholder="e.g. board">
    <label class="f">How it's made</label>
    <div class="seg" id="tk"><button data-tk="tpl" class="${!t.board ? 'on' : ''}">From templates</button><button data-tk="board" class="${t.board ? 'on' : ''}">Board (no template)</button></div></div>
    <div class="tray" id="slotBox" ${t.board ? 'hidden' : ''}>
    <div class="tray-h">Template parts</div>
    <div class="card flush">${t.slots.map((s, i) => `<div class="listrow"><div class="grow"><input data-sn="${i}" value="${esc(s.name)}" style="margin-bottom:8px">
      <select data-sg="${i}">${liveGroups().map(g => `<option value="${g.id}" ${g.id === s.group ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}<option value="+">+ New group…</option></select></div>
      <button class="icon" data-sx="${i}" aria-label="Remove">${ICON.trash}</button></div>`).join('')}
      <button class="listrow add" id="addSlot">+ Add a part (handle, head, arm…)</button></div>
    <label class="f">How parts go together</label>
    <div class="seg" id="join"><button data-j="none" class="${t.join !== 'dovetail' ? 'on' : ''}">Side by side</button><button data-j="dovetail" class="${t.join === 'dovetail' ? 'on' : ''}">Dovetail joined</button></div></div>
    <div class="tray"><label class="f" style="margin-top:0">How it's made <span>(goes in the story)</span></label><textarea id="tb">${esc(t.build)}</textarea>
    <label class="f">Care instructions</label><textarea id="tc">${esc(t.care)}</textarea>
    ${t.byKind ? '<p class="note">Kitchen tools take their name and care from the head you pick. Edit those under Head kinds.</p>' : ''}</div>
    ${ex && !used ? `<button class="btn wide danger" id="dt" style="margin-top:24px">Remove this type</button>` : ex ? `<p class="note center" style="margin-top:24px">${S.pieces.filter(p => p.type === t.id).length} of your pieces use this type, so it can't be removed yet.</p>` : ''}<div style="height:30px"></div>`;
  const read = () => { t.name = $('#tn').value.trim(); t.noun = $('#tno').value.trim(); $$('[data-sn]', v).forEach(i => t.slots[+i.dataset.sn].name = i.value.trim() || 'Part'); t.build = $('#tb').value.trim(); t.care = $('#tc').value.trim(); };
  $$('[data-tk]', v).forEach(b => b.onclick = () => { read(); t.board = b.dataset.tk === 'board'; if (t.board) { t.slots = []; t.join = 'none'; } render(); });
  $$('[data-sg]', v).forEach(sel => sel.onchange = () => {
    const i = +sel.dataset.sg;
    if (sel.value === '+') {
      read();
      openSheet(`<h2>New template group</h2><label class="f">Name</label><input id="gn" placeholder="e.g. Board handles"><label class="f">Code prefix</label><input id="gp" placeholder="e.g. B"><button class="btn primary wide" id="gok" style="margin-top:16px">Add group</button>`);
      $('#gok').onclick = () => { const n = $('#gn').value.trim(); if (!n) return toast('Name it'); const gid = 'g-' + uid(); S.groups.push({ id: gid, name: n, prefix: $('#gp').value.trim().toUpperCase() }); save(); t.slots[i].group = gid; closeSheet(); render(); };
    } else t.slots[i].group = sel.value;
  });
  $$('[data-sx]', v).forEach(b => b.onclick = () => { read(); t.slots.splice(+b.dataset.sx, 1); render(); });
  $('#addSlot').onclick = () => { read(); t.slots.push({ name: t.slots.length ? 'Part ' + (t.slots.length + 1) : 'Handle', group: S.groups[0].id }); render(); };
  $$('[data-j]', v).forEach(b => b.onclick = () => { t.join = b.dataset.j; $$('[data-j]', v).forEach(x => x.classList.toggle('on', x === b)); });
  $('#st').onclick = () => {
    read(); if (!t.name) return toast('Give it a name');
    t.noun ||= t.name.toLowerCase();
    const i = S.types.findIndex(x => x.id === t.id); if (i >= 0) S.types[i] = t; else S.types.push(t);
    save(); stack.pop();
    const prev = stack[stack.length - 1]; if (prev?.view === 'editPiece' && prev.draft && i < 0) prev.draft.type = t.id;
    render(true);
  };
  $('#dt')?.addEventListener('click', () => confirmSheet(`Remove ${t.name}?`, 'Remove', () => { const gone = S.types.find(x => x.id === t.id); S.types = S.types.filter(x => x.id !== t.id); save(); stack.pop(); render(true); toast(`Removed ${t.name}`, { action: 'Undo', onAction: () => { if (!S.types.some(x => x.id === gone.id)) S.types.push(gone); save(); render(true); } }); }, 'You can undo this right after.'));
};

/* ---------- Backup ---------- */
async function backup() {
  const photos = {};
  for (const p of S.pieces) for (const id of [...(p.photos || []), ...(p.buildPhotos || []).map(b => b.id)]) { const d = await photoGet(id); if (d) photos[id] = d; }
  saveFile(JSON.stringify({ app: 'bench', version: 2, saved: new Date().toISOString(), state: S, photos }), `bench-backup-${today()}.json`, 'application/json');
}
async function restore() {
  const [f] = await pickFiles('application/json,.json'); if (!f) return;
  let data; try { data = JSON.parse(await readText(f)); } catch (e) { return toast('That file is not a Bench backup'); }
  if (data.app !== 'bench' || !data.state) return toast('That file is not a Bench backup');
  confirmSheet(`Replace everything with this backup (${data.state.pieces?.length || 0} pieces)?`, 'Restore', async () => {
    for (const [id, d] of Object.entries(data.photos || {})) await photoPut(id, d);
    localStorage.setItem(KEY, JSON.stringify(data.state)); load(); toast('Restored'); switchTab('pieces');
  });
}

/* ---------- Boot ---------- */
$('#backBtn').onclick = () => back();
$$('#tabs button').forEach(b => b.onclick = () => { if (b.dataset.tab === tab && stack.length === 1) return scrollTo({ top: 0, behavior: 'smooth' }); switchTab(b.dataset.tab); });
$('#sheet').onclick = e => { if (e.target.id === 'sheet') closeSheet(); };
load();
switchTab('pieces');
// After an app update, quietly refresh the online story page so new pieces draw right
if (ghOn() && S.settings.gh.pageVer !== pageVersion()) setTimeout(() => publishPieces([]).catch(() => {}), 5000);
