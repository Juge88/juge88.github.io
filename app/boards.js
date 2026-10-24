'use strict';
/* Cutting boards: edge grain, end grain (checkerboard, brick & mortar, diagonal, zigzag, stripes, chaos) and
   two-step designs. Sizes snap to whole blocks, the drawing is a top view, and the cut list walks through the
   build step by step. Units are inches. Shared by the app and the customer story page. */

const BD = (() => {
  const PLANE = 1 / 16, FLAT = 1 / 8, KERF = 1 / 8, ENDS = 2, EPS = 1e-6;
  const STYLES = { edge: 'Edge grain', end: 'End grain', multi: 'Two-step' };
  // ratio = block width ÷ row depth when the lock is on (square blocks, 2:1 bricks)
  const PATTERNS = {
    checker:  { name: 'Checkerboard', ratio: 1 },
    brick:    { name: 'Brick & mortar', ratio: 2 },
    diagonal: { name: 'Diagonal', ratio: 1 },
    zigzag:   { name: 'Zigzag', ratio: 1 },
    stripes:  { name: 'Stripes', ratio: 1 },
    chaos:    { name: 'Chaos', ratio: 1 }
  };
  const PROFILES = { round: 'Rounded over', chamfer: 'Chamfered', square: 'Square' };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const numOr = (v, a, b, d) => { v = +v; return Number.isFinite(v) && v > 0 ? clamp(v, a, b) : d; };
  const intOr = (v, a, b, d) => { v = Math.round(+v); return Number.isFinite(v) && v >= a ? Math.min(b, v) : d; };
  const tidy = x => Math.round(x * 1e6) / 1e6;
  const clone = o => JSON.parse(JSON.stringify(o || {}));
  const sumW = list => tidy(list.reduce((a, s) => a + s.w, 0));
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function rng(seed) { let q = seed >>> 0 || 1; return () => (q = (Math.imul(q, 1664525) + 1013904223) >>> 0) / 4294967296; }

  /* ---------- Two-step recipes ---------- */
  // "1.5W .25M 1-1/2C" -> [{w:1.5,key:'W'}, ...]; "(1A .25B)x3" groups expand
  function num(t) { t = String(t).trim(); const m = t.match(/^(\d+)-(\d+)\/(\d+)$/); if (m) return +m[1] + m[2] / m[3]; const f = t.match(/^(\d+)\/(\d+)$/); if (f) return f[1] / f[2]; return parseFloat(t); }
  function expand(str) {
    let s = String(str || ''), guard = 0;
    while (/\(([^()]*)\)\s*[x×*]\s*(\d+)/i.test(s) && guard++ < 20) s = s.replace(/\(([^()]*)\)\s*[x×*]\s*(\d+)/i, (m, a, n) => Array(Math.min(200, +n)).fill(a).join(' '));
    return s.trim().split(/\s+/).filter(Boolean);
  }
  function parseStrips(str) {
    const out = [], bad = [];
    for (const t of expand(str)) { const m = t.match(/^([\d.\/-]+)([A-Za-z])$/); if (m && num(m[1]) > 0) out.push({ w: num(m[1]), key: m[2].toUpperCase() }); else bad.push(t); }
    return { list: out, bad };
  }
  function parseRows(str) {
    const out = [], bad = [];
    for (const t of expand(str)) { const m = t.match(/^([\d.\/-]+)([A-Za-z])(\^?)$/); if (m && num(m[1]) > 0) out.push({ w: num(m[1]), panel: m[2].toUpperCase(), flip: !!m[3] }); else bad.push(t); }
    return { list: out, bad };
  }
  function multiInfo(b) {
    const panels = {}, errs = [], keys = b.keys || {};
    for (const [k, v] of Object.entries(b.panels || {})) {
      const r = parseStrips(v); panels[k] = r.list;
      if (r.bad.length) errs.push(`Panel ${k}: couldn't read ${r.bad.join(', ')}`);
      [...new Set(r.list.map(x => x.key))].forEach(x => { if (!keys[x]) errs.push(`Panel ${k}: no wood set for letter ${x}`); });
    }
    const rows = parseRows(b.rows); if (rows.bad.length) errs.push(`Slices: couldn't read ${rows.bad.join(', ')}`);
    [...new Set(rows.list.map(r => r.panel))].forEach(p => { if (!panels[p] || !panels[p].length) errs.push(`Slices use panel ${p}, which isn't set up`); });
    const widths = Object.fromEntries(Object.entries(panels).map(([k, L]) => [k, sumW(L)]));
    const used = [...new Set(rows.list.map(r => r.panel))].filter(k => widths[k]);
    const W = used.length ? Math.min(...used.map(k => widths[k])) : 0, L = sumW(rows.list);
    if (used.length > 1 && Math.max(...used.map(k => widths[k])) - W > .01) errs.push(`Panels are different widths (${used.map(k => k + ' ' + frac(widths[k])).join(', ')}); the board gets trimmed to the narrowest.`);
    // End grain: a slice shows the thickness of the panel it came from, so very deep slices need splitting
    [...new Set(rows.list.filter(r => r.w > 4).map(r => r.panel))].forEach(k => {
      const r = rows.list.find(x => x.panel === k && x.w > 4), n = Math.ceil(r.w / 1.75);
      errs.push(`A ${frac(r.w)} slice of ${k} would need a panel ${frac(r.w)} thick. Write it as ${n} thinner slices, like (${+(r.w / n).toFixed(3)}${k})x${n}.`);
    });
    return { panels, rows: rows.list, widths, W, L, errs };
  }

  /* ---------- Pattern gallery ---------- */
  // w = woods to use, in order (the board's current woods first, then the shop's)
  const PRESETS = [
    { id: 'stripes', group: 'edge', name: 'Stripes', note: 'Edge grain, the classic everyday board.',
      make: w => ({ style: 'edge', L: 16, edge: [w[0], w[1], w[0], w[2], w[0], w[1], w[0]].map(x => ({ wood: x, w: 1.5 })) }) },
    { id: 'pinstripe', group: 'edge', name: 'Pinstripe', note: 'Wide strips with thin accent lines.',
      make: w => ({ style: 'edge', L: 16, edge: [[w[0], 2], [w[1], .25], [w[0], 2], [w[2], .25], [w[0], 2], [w[1], .25], [w[0], 2]].map(([x, v]) => ({ wood: x, w: v })) }) },
    { id: 'checker', group: 'end', name: 'Checkerboard', note: 'Square end-grain blocks of two woods.',
      make: w => ({ style: 'end', pattern: 'checker', cell: 1.5, lock: true, ratio: 1, nRows: 11, nCols: 8, strips: [w[0], w[1]].map(x => ({ wood: x, w: 1.5 })) }) },
    { id: 'brick', group: 'end', name: 'Brick & mortar', note: 'Bricks in a running bond with thin mortar lines.',
      make: w => ({ style: 'end', pattern: 'brick', cell: 1, lock: true, ratio: 2, nRows: 10, nCols: 7, joint: .25, mortar: w[1], strips: [{ wood: w[0], w: 2 }] }) },
    { id: 'diagonal', group: 'end', name: 'Diagonal', note: 'Stripes that step across the board.',
      make: w => ({ style: 'end', pattern: 'diagonal', cell: 1, lock: true, ratio: 1, nRows: 16, nCols: 12, strips: [w[0], w[1], w[2]].map(x => ({ wood: x, w: 1 })) }) },
    { id: 'zigzag', group: 'end', name: 'Zigzag', note: 'Bands that step one way, then back.',
      make: w => ({ style: 'end', pattern: 'zigzag', cell: .75, lock: true, ratio: 1, amp: 3, nRows: 21, nCols: 16, strips: [w[0], w[0], w[0], w[1], w[1], w[1]].map(x => ({ wood: x, w: .75 })) }) },
    { id: 'end-stripes', group: 'end', name: 'End-grain stripes', note: 'Straight stripes of end-grain blocks.',
      make: w => ({ style: 'end', pattern: 'stripes', cell: 1.5, lock: true, ratio: 1, nRows: 11, nCols: 8, strips: [w[0], w[1], w[0], w[2]].map(x => ({ wood: x, w: 1.5 })) }) },
    { id: 'chaos', group: 'end', name: 'Chaos', note: 'Offcut blocks of every wood, mixed at random.',
      make: w => ({ style: 'end', pattern: 'chaos', cell: 1.25, lock: true, ratio: 1, nRows: 13, nCols: 10, strips: w.slice(0, 4).map(x => ({ wood: x, w: 1.25 })) }) },
    { id: 'windowpane', group: 'multi', name: 'Windowpane', note: 'Squares framed by thin grid lines.',
      make: w => ({ style: 'multi', keys: { W: w[0], M: w[1] }, panels: { A: '(2W .25M)x5 2W', B: '13.25M' }, rows: '(2A .25B)x6 2A' }) },
    { id: 'framed', group: 'multi', name: 'Framed', note: 'A contrasting border all the way around.',
      make: w => ({ style: 'multi', keys: { W: w[0], M: w[1] }, panels: { A: '.75M (1.5W)x7 .75M', B: '12M' }, rows: '.75B (1.5A)x10 .75B' }) },
    { id: 'offset', group: 'multi', name: 'Offset blocks', note: 'Bands that step back and forth.',
      make: w => ({ style: 'multi', keys: { W: w[0], M: w[1], C: w[2] }, panels: { A: '(1.5W 1.5M 1.5C)x3 1.5W' }, rows: '(2A 2A^)x4' }) },
    { id: 'ladder', group: 'multi', name: 'Ladder', note: 'Rungs of an accent wood across the board.',
      make: w => ({ style: 'multi', keys: { W: w[0], M: w[1], C: w[2] }, panels: { A: '1M (2W)x5 1M', B: '1M 10C 1M' }, rows: '(1.5A 1.5A .5B)x4 1.5A 1.5A' }) }
  ];
  const BASE = { T: 1.5, profile: 'round', groove: false, grips: false, feet: false };

  // Swap in a pattern, keeping the woods, thickness, finishing touches and the board's overall size
  function applyPreset(b, id, woods) {
    const pr = PRESETS.find(p => p.id === id); if (!pr) return b;
    const ws = [...(woods || []), 'walnut', 'maple', 'cherry'].filter((x, i, a) => x && a.indexOf(x) === i);
    const out = { ...clone(BASE), ...pr.make(ws), name: pr.name, preset: id, done: [] };
    if (b) for (const k of ['T', 'profile', 'groove', 'grips', 'feet', 'seed']) if (b[k] !== undefined) out[k] = b[k];
    fix(out);
    if (b && b.L > 0 && b.W > 0 && out.style === 'end') { snap(out, 'L', b.L); snap(out, 'W', b.W); }
    else if (b && b.L > 0 && out.style === 'edge') { out.L = b.L; fix(out); }
    return out;
  }
  const defaults = woods => applyPreset(null, 'checker', woods && woods.length ? woods : ['walnut', 'maple']);

  // cuttingboarddesigner.com link -> two-step board
  function importLink(url, woods) {
    const h = String(url).trim().split('/hash/')[1] || String(url).split('#')[1] || '';
    if (!h) throw new Error('No pattern in that link');
    const clean = h.split(/[?&\s]/)[0];
    const js = (typeof atob !== 'undefined' ? atob : (x => Buffer.from(x, 'base64').toString('binary')))(clean.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((clean.length + 3) % 4));
    const d = JSON.parse(decodeURIComponent(escape(js)));
    const P = d.params || {};
    const toIn = v => d.units === 'mm' ? v / 25.4 : v;
    let panels = {}, rows = '';
    if (P.subpatterns && P.pattern) { P.subpatterns.forEach((sp, i) => panels[String.fromCharCode(65 + i)] = sp); rows = P.pattern; }
    else if (P.pattern) { panels = { A: P.pattern }; rows = '(1.5A)x10'; }
    else throw new Error(`"${d.type || 'This'}" designs aren't supported yet`);
    const letters = [...new Set(Object.values(panels).flatMap(v => parseStrips(v).list.map(x => x.key)))];
    const keys = {}; letters.forEach((k, i) => keys[k] = guessWood(k, woods) || woods[i % Math.max(1, woods.length)] || 'maple');
    const b = { ...clone(BASE), style: 'multi', name: d.name || 'Imported', T: toIn(P.thickness || 1.5), keys, panels, rows, done: [] };
    if (d.units === 'mm') { const sc = str => expand(str).map(t => t.replace(/^([\d.]+)/, n => +(n / 25.4).toFixed(4))).join(' '); for (const k in b.panels) b.panels[k] = sc(b.panels[k]); b.rows = sc(b.rows); }
    return fix(b);
  }
  const LETTER = { W: 'walnut', M: 'maple', C: 'cherry', P: 'purpleheart', S: 'sapele', O: 'oak-white', A: 'ash', B: 'bubinga', Z: 'zebrawood', E: 'ebony', Y: 'yellowheart', R: 'padauk', H: 'hickory', T: 'teak' };
  function guessWood(k, woods) { const g = LETTER[k]; return g && (woods.includes(g) || !woods.length) ? g : woods.find(w => w[0].toUpperCase() === k) || g; }

  /* ---------- Normalizing and sizing ---------- */
  // Every edit runs through here: fills gaps, keeps widths in step with the lock and works out the size
  function fix(b) {
    b.fmt = 2;
    b.T = numOr(b.T, .25, 6, 1.5);
    b.done ||= [];
    if (b.style === 'face' || !STYLES[b.style]) b.style = 'edge';
    if (b.style === 'multi') {
      b.keys ||= {}; b.panels ||= {}; b.rows = String(b.rows || ''); b.endUp = true;
      const m = multiInfo(b); b.L = m.L; b.W = m.W; return b;
    }
    if (b.style === 'edge') {
      b.edge = (b.edge || []).filter(s => s && s.wood).map(s => ({ wood: s.wood, w: numOr(s.w, 1 / 32, 24, 1.5) }));
      if (!b.edge.length) b.edge = ['walnut', 'maple', 'walnut'].map(w => ({ wood: w, w: 1.5 }));
      if (b.same) b.edge.forEach(s => s.w = b.edge[0].w);
      b.L = numOr(b.L, 1, 120, 16); b.W = sumW(b.edge);
      return b;
    }
    if (!PATTERNS[b.pattern]) b.pattern = 'checker';
    b.strips = (b.strips || []).filter(s => s && s.wood).map(s => ({ wood: s.wood, w: numOr(s.w, 1 / 16, 12, 1.5) }));
    if (!b.strips.length) b.strips = [{ wood: 'walnut', w: 1.5 }, { wood: 'maple', w: 1.5 }];
    b.cell = numOr(b.cell, 1 / 16, 8, 1.5);
    if (b.lock === undefined) b.lock = true;
    b.ratio = numOr(b.ratio, .1, 12, PATTERNS[b.pattern].ratio);
    if (b.lock) b.strips.forEach(s => s.w = tidy(b.cell * b.ratio));
    else if (b.pattern === 'brick' || b.pattern === 'chaos') b.strips.forEach(s => s.w = b.strips[0].w);
    b.amp = intOr(b.amp, 1, 12, 3);
    if (b.pattern === 'brick') { b.joint = Math.max(0, Math.min(2, +b.joint >= 0 ? +b.joint : .25)); b.mortar ||= 'maple'; }
    b.nRows = intOr(b.nRows, 1, 150, 10); b.nCols = intOr(b.nCols, 1, 150, 8);
    const d = dims(b); b.L = d.L; b.W = d.W;
    return b;
  }
  const across = (b, n) => { let s = 0; for (let k = 0; k < n; k++) s += b.strips[k % b.strips.length].w; return tidy(s); };
  const halfBrick = b => Math.max(0, (b.strips[0].w - (b.joint || 0)) / 2);
  function dims(b) {
    if (b.style === 'multi') { const m = multiInfo(b); return { L: m.L, W: m.W }; }
    if (b.style === 'edge') return { L: b.L, W: sumW(b.edge) };
    if (b.pattern === 'brick') { const a = b.strips[0].w, j = b.joint || 0; return { L: tidy(b.nCols * (a + j) + halfBrick(b)), W: tidy(b.nRows * b.cell + (b.nRows - 1) * j) }; }
    if (b.pattern === 'chaos') return { L: tidy(b.nRows * b.cell), W: tidy(b.nCols * b.strips[0].w) };
    return { L: tidy(b.nRows * b.cell), W: across(b, b.nCols) };
  }
  // Brick rows run along the length; every other pattern's slices run across the width
  const countKey = (b, which) => b.pattern === 'brick' ? (which === 'L' ? 'nCols' : 'nRows') : (which === 'L' ? 'nRows' : 'nCols');
  // Pick the whole number of blocks that comes closest to a target length or width
  function snap(b, which, target) {
    if (b.style === 'edge') { if (which === 'L') b.L = target; return fix(b); }
    if (b.style !== 'end' || !(target > 0)) return fix(b);
    const key = countKey(b, which); let best = b[key] || 1, err = Infinity;
    for (let n = 1; n <= 150; n++) { const v = dims({ ...b, [key]: n })[which], e = Math.abs(v - target); if (e < err - EPS) { err = e; best = n; } if (v > target + 30) break; }
    b[key] = best; return fix(b);
  }
  function step(b, which, delta) { const key = countKey(b, which); b[key] = Math.max(1, (b[key] || 1) + delta); return fix(b); }
  const countOf = (b, which) => b[countKey(b, which)];
  // Block width (strip width or brick length) and depth (row depth or brick height), honoring the lock.
  // The board keeps about the same overall size, so the block counts change instead.
  function setSize(b, which, v) {
    if (b.style !== 'end' || !(v > 0)) return b;
    const L = b.L, W = b.W;
    if (which === 'd') b.cell = v;
    else if (b.lock) b.cell = v / b.ratio;
    else b.strips.forEach(s => s.w = v);
    fix(b); snap(b, 'L', L); snap(b, 'W', W);
    return b;
  }
  function setLock(b, on) {
    b.lock = !!on;
    if (on) {
      const L = b.L, W = b.W;
      if (b.pattern === 'brick') b.ratio = b.strips[0].w / b.cell;
      else { b.ratio = 1; b.cell = b.strips[0].w; }   // square: the depth follows the block width
      fix(b); snap(b, 'L', L); snap(b, 'W', W);
    }
    return b;
  }
  const blockW = b => b.style === 'end' && b.strips.every(s => Math.abs(s.w - b.strips[0].w) < EPS) ? b.strips[0].w : null;
  // Strip list helpers
  const listOf = b => b.style === 'edge' ? b.edge : b.strips;
  function mirror(b) { const L = listOf(b); if (L.length > 1) L.push(...clone(L.slice(0, -1)).reverse()); return fix(b); }
  function repeat(b) { const L = listOf(b); L.push(...clone(L)); return fix(b); }
  function isMirror(b) { const L = listOf(b); return L.length > 1 && L.every((s, i) => s.wood === L[L.length - 1 - i].wood && Math.abs(s.w - L[L.length - 1 - i].w) < EPS); }

  // Boards logged before 1.7: sizes were typed in and rows stretched to fill them; now they snap to whole blocks
  function upgrade(b, woods) {
    woods = woods && woods.length ? woods : ['walnut', 'maple'];
    if (!b || typeof b !== 'object') return defaults(woods);
    b = clone(b);
    if (b.fmt === 2) return fix(b);
    if (b.style === 'face') b.style = 'edge';
    if (!(b.strips || b.edge || b.panels)) {   // 1.4: only a style and a size
      const L = +b.L || 16, W = +b.W || 11, T = +b.T || 1.25;
      if (b.style === 'end' || b.style === 'chaos') {
        const out = applyPreset(null, b.style === 'chaos' ? 'chaos' : 'checker', woods); out.T = T; out.profile = undefined;
        if (b.style === 'chaos') out.strips = woods.map(w => ({ wood: w, w: out.cell }));
        fix(out); snap(out, 'L', L); snap(out, 'W', W); return out;
      }
      return fix({ style: 'edge', L, T, edge: woods.map(w => ({ wood: w, w: +(W / woods.length).toFixed(3) })), done: [] });
    }
    if (b.style === 'multi') return fix(b);
    if (b.style === 'edge' || !b.strips) { b.style = 'edge'; return fix(b); }
    const L = +b.L || 16, W = +b.W || 12, strips = b.strips.filter(s => s && s.wood);
    const uni = strips.length && strips.every(s => Math.abs(s.w - strips[0].w) < EPS);
    if (b.pattern === 'brick') {   // the old "brick" was offset blocks with no mortar
      const used = [...new Set(strips.map(s => s.wood))];
      b.mortar = woods.find(w => !used.includes(w)) || (used.includes('maple') ? 'walnut' : 'maple');
      b.joint = .25; b.lock = true; b.ratio = (strips[0]?.w || 2) / (b.cell || 1);
    } else { b.lock = !!uni && Math.abs(strips[0].w - b.cell) < EPS; b.ratio = 1; }
    fix(b); snap(b, 'L', L); snap(b, 'W', W);
    return b;
  }

  /* ---------- Layout ---------- */
  function shiftOf(b, i) {
    const n = b.strips.length;
    switch (b.pattern) {
      case 'checker': return i % 2;
      case 'diagonal': return i % n;
      case 'zigzag': { const A = Math.max(1, b.amp | 0), k = i % (2 * A); return (k <= A ? k : 2 * A - k) % n; }
      default: return 0;
    }
  }
  const at = (b, k) => b.strips[((k % b.strips.length) + b.strips.length) % b.strips.length];
  // How many strips, starting at strip k0, it takes to cover the board's width
  function span(b, k0) { let y = 0, k = k0; while (y < b.W - EPS && k - k0 < 400) { y += at(b, k).w; k++; } return k - k0; }
  // The brick panel: brick, mortar, brick, mortar … and a half brick at the end, so flipping a slice offsets the joints
  function brickPanel(b) {
    const a = b.strips[0].w, j = b.joint || 0, out = []; let u = 0;
    for (let k = 0; k < b.nCols; k++) {
      out.push({ wood: at(b, k).wood, w: a, u0: u, u1: u + a, brick: true }); u += a;
      if (j > EPS) { out.push({ wood: b.mortar, w: j, u0: u, u1: u + j }); u += j; }
    }
    const h = halfBrick(b); if (h > EPS) out.push({ wood: at(b, b.nCols).wood, w: h, u0: u, u1: u + h, brick: true, half: true });
    return out;
  }
  // Every visible piece of wood on the top face: [{wood, x0, x1, y0, y1, end}], x along the length
  function layout(b) {
    const B = b.fmt === 2 && b.__fixed ? b : fix(clone(b)), cells = [];
    if (B.style === 'edge') { let y = 0; for (const s of B.edge) { cells.push({ wood: s.wood, x0: 0, x1: B.L, y0: y, y1: tidy(y + s.w), end: false }); y = tidy(y + s.w); } return { cells, L: B.L, W: y }; }
    if (B.style === 'multi') {
      const m = multiInfo(B); let x = 0;
      for (const r of m.rows) {
        const P = m.panels[r.panel] || [], PW = m.widths[r.panel] || 0; let y = 0;
        for (const st of P) {
          let y0 = r.flip ? PW - y - st.w : y, y1 = y0 + st.w; y += st.w;
          y0 = Math.max(0, y0); y1 = Math.min(m.W, y1);
          if (y1 > y0 + EPS) cells.push({ wood: B.keys[st.key] || 'maple', x0: x, x1: tidy(x + r.w), y0: tidy(y0), y1: tidy(y1), end: true });
        }
        x = tidy(x + r.w);
      }
      return { cells, L: m.L, W: m.W };
    }
    const d = B.cell;
    if (B.pattern === 'chaos') {
      const ws = B.strips.map(s => s.wood), bw = B.strips[0].w, R = rng(B.seed || 12345), grid = [];
      const many = new Set(ws).size > 2;
      for (let i = 0; i < B.nRows; i++) {
        grid.push([]);
        for (let j = 0; j < B.nCols; j++) {
          let w = ws[Math.floor(R() * ws.length)];
          if (many && (w === grid[i][j - 1] || w === (grid[i - 1] || [])[j])) w = ws[Math.floor(R() * ws.length)];
          grid[i].push(w);
          cells.push({ wood: w, x0: tidy(i * d), x1: tidy((i + 1) * d), y0: tidy(j * bw), y1: tidy((j + 1) * bw), end: true });
        }
      }
      return { cells, L: B.L, W: B.W };
    }
    if (B.pattern === 'brick') {
      const P = brickPanel(B), j = B.joint || 0, len = B.L;
      for (let r = 0; r < B.nRows; r++) {
        const y0 = tidy(r * (d + j)), flip = r % 2 === 1;
        for (const s of P) cells.push({ wood: s.wood, x0: tidy(flip ? len - s.u1 : s.u0), x1: tidy(flip ? len - s.u0 : s.u1), y0, y1: tidy(y0 + d), end: true, mortar: !s.brick });
        if (j > EPS && r < B.nRows - 1) cells.push({ wood: B.mortar, x0: 0, x1: len, y0: tidy(y0 + d), y1: tidy(y0 + d + j), end: true, mortar: true });
      }
      return { cells, L: B.L, W: B.W };
    }
    for (let i = 0; i < B.nRows; i++) {
      let k = shiftOf(B, i), y = 0;
      while (y < B.W - EPS) { const s = at(B, k); cells.push({ wood: s.wood, x0: tidy(i * d), x1: tidy((i + 1) * d), y0: tidy(y), y1: tidy(Math.min(B.W, y + s.w)), end: true }); y = tidy(y + s.w); k++; }
    }
    return { cells, L: B.L, W: B.W };
  }
  const blocks = b => b.style === 'edge' ? 0 : layout(b).cells.length;
  // Woods in the order they appear (brick: bricks, then mortar)
  function woods(b) {
    const B = fix(clone(b)), out = [];
    const add = w => { if (w && !out.includes(w)) out.push(w); };
    if (B.style === 'multi') { const used = new Set(Object.values(B.panels).flatMap(v => parseStrips(v).list.map(x => x.key))); Object.keys(B.keys).sort().forEach(k => used.has(k) && add(B.keys[k])); }
    else if (B.style === 'edge') B.edge.forEach(s => add(s.wood));
    else { B.strips.forEach(s => add(s.wood)); if (B.pattern === 'brick' && B.joint > EPS) add(B.mortar); }
    return out;
  }
  const widthOf = b => fix(clone(b)).W;
  const lengthOf = b => fix(clone(b)).L;

  /* ---------- Drawing ---------- */
  const memo = new Map();
  function shade(hex, f) {
    const n = parseInt(String(hex || '#999999').slice(1, 7), 16) || 0;
    const ch = s => { const v = (n >> s) & 255; return Math.round(clamp(f > 0 ? v + (255 - v) * f : v * (1 + f), 0, 255)); };
    return '#' + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('');
  }
  const f2 = v => (+v).toFixed(2);
  // Top view. colorOf(id) -> wood {color, color2, id, grain}. opts.plain skips grain (thumbnails)
  function draw(b, colorOf, seed = 1, opts = {}) {
    const B = fix(clone(b)); B.__fixed = true;
    const lay = layout(B); delete B.__fixed;
    if (!lay.cells.length || !(lay.L > 0) || !(lay.W > 0)) return '';
    const grainOn = typeof GR !== 'undefined' && GR.on && !opts.plain;
    const col = w => (colorOf && colorOf(w)) || { color: '#c9a57a', color2: '#b08a5c' };
    const key = JSON.stringify([B, seed, woods(B).map(w => { const c = col(w); return [w, c.color, c.color2, c.grain || '', c.id || '']; }), grainOn, !!opts.raw]);
    if (memo.has(key)) return memo.get(key);
    const id = 'bd' + hash(key).toString(36);
    const S = 300 / Math.max(lay.L, lay.W), W = lay.L * S, H = lay.W * S, R = rng(seed);
    const rings = grainOn && lay.cells.length <= 900;
    let s = '', n = 0;
    for (const c of lay.cells) {
      const x = c.x0 * S, y = c.y0 * S, w = (c.x1 - c.x0) * S, h = (c.y1 - c.y0) * S, k = col(c.wood);
      if (c.end) {
        // each block is cut from a different spot in the board, so its tone and rings vary a little
        s += `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w + .4)}" height="${f2(h + .4)}" fill="${shade(k.color, (R() - .5) * .1)}"/>`;
        if (rings && Math.min(c.x1 - c.x0, c.y1 - c.y0) >= .3) {
          const m = Math.max(w, h), cx = x + w * (.15 + R() * .7), above = R() > .5, cy = above ? y - h * (.45 + R() * .5) : y + h * (1.45 + R() * .5), cid = id + 'k' + (++n);
          const step = m * (.22 + R() * .1);
          s += `<clipPath id="${cid}"><rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}"/></clipPath><g clip-path="url(#${cid})" fill="none" stroke="${k.color2 || k.color}" opacity=".55">`;
          for (let q = 1; q <= 9; q++) { const r = step * q + m * .1; s += `<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(r)}" stroke-width="${f2(.55 + R() * .6)}"/>`; }
          s += '</g>';
        }
        s += `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" fill="none" stroke="#000" stroke-opacity="${c.mortar ? .08 : .14}" stroke-width=".5"/>`;
      } else {
        s += `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w + .4)}" height="${f2(h + .4)}" fill="${k.color}"/>`;
        if (grainOn) {
          // long grain: edge grain reads tight and straight unless the wood has its own figure
          const st = GR.styleOf(k), kk = st === 'straight' || st === 'pores' ? { ...k, grain: 'tight' } : k, sc = S / 6;
          s += `<g transform="scale(${sc.toFixed(4)})">${GR.strip(kk, x / sc, (x + w) / sc, y / sc, (y + h) / sc, (seed + Math.round(c.y0 * 100)) >>> 0)}</g>`;
        }
      }
    }
    // Finishing touches
    const rad = (B.profile === 'round' ? .6 : B.profile === 'chamfer' ? .3 : B.profile === 'square' ? .12 : .45) * S;
    let fx = '', defs = '';
    if (B.grips) {
      defs += `<radialGradient id="${id}gr"><stop offset="0" stop-color="#000" stop-opacity=".62"/><stop offset=".7" stop-color="#000" stop-opacity=".3"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`;
      const along = lay.L >= lay.W, len = Math.min((along ? lay.W : lay.L) * .34, 2.25) * S, dep = .7 * S;
      for (const e of [0, 1]) fx += along ? `<ellipse cx="${f2(e * W)}" cy="${f2(H / 2)}" rx="${f2(dep)}" ry="${f2(len)}" fill="url(#${id}gr)"/>` : `<ellipse cx="${f2(W / 2)}" cy="${f2(e * H)}" rx="${f2(len)}" ry="${f2(dep)}" fill="url(#${id}gr)"/>`;
    }
    if (B.groove) {
      const g = clamp(Math.min(lay.L, lay.W) * .045, .45, .85) * S, gw = .375 * S, rr = Math.max(gw * 1.2, rad * 1.4);
      fx += `<rect x="${f2(g)}" y="${f2(g)}" width="${f2(W - 2 * g)}" height="${f2(H - 2 * g)}" rx="${f2(rr)}" fill="none" stroke="#000" stroke-opacity=".38" stroke-width="${f2(gw)}"/>`;
      fx += `<rect x="${f2(g + gw * .3)}" y="${f2(g + gw * .3)}" width="${f2(W - 2 * g - gw * .6)}" height="${f2(H - 2 * g - gw * .6)}" rx="${f2(Math.max(1, rr - gw * .3))}" fill="none" stroke="#fff" stroke-opacity=".13" stroke-width="${f2(gw * .18)}"/>`;
    }
    if (B.profile === 'round') fx += `<rect x="1.2" y="1.2" width="${f2(W - 2.4)}" height="${f2(H - 2.4)}" rx="${f2(Math.max(1, rad - 1.2))}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="2.4"/>`;
    if (B.profile === 'chamfer') { const a = .22 * S; fx += `<rect x="${f2(a / 2)}" y="${f2(a / 2)}" width="${f2(W - a)}" height="${f2(H - a)}" rx="${f2(rad * .5)}" fill="none" stroke="#000" stroke-opacity=".22" stroke-width="${f2(a)}"/><rect x="${f2(a)}" y="${f2(a)}" width="${f2(W - 2 * a)}" height="${f2(H - 2 * a)}" rx="${f2(rad * .3)}" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width=".8"/>`; }
    if (opts.raw) {   // flat texture for the 3D view: no shading, shadow or turning
      const svg = `<svg viewBox="0 0 ${f2(W)} ${f2(H)}" width="${f2(W)}" height="${f2(H)}" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs>${s}${fx}</svg>`;
      memo.set(key, svg); return svg;
    }
    const tall = H > W * 1.02, VW = tall ? H : W, VH = tall ? W : H;
    const body = `<g clip-path="url(#${id})">${s}${fx}<rect width="${f2(W)}" height="${f2(H)}" fill="url(#${id}g)"/></g>`;
    const svg = `<svg viewBox="-5 -5 ${f2(VW + 10)} ${f2(VH + 12)}" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="${id}"><rect width="${f2(W)}" height="${f2(H)}" rx="${f2(rad)}"/></clipPath>
      <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>${defs}</defs>
      <g ${tall ? 'transform="matrix(0 1 1 0 0 0)"' : ''}><rect x="${tall ? 3 : 0}" y="${tall ? 0 : 3}" width="${f2(W)}" height="${f2(H)}" rx="${f2(rad)}" fill="#000" fill-opacity=".45"/>${body}</g></svg>`;
    if (memo.size > 80) memo.delete(memo.keys().next().value);
    memo.set(key, svg);
    return svg;
  }

  /* ---------- Cut list ---------- */
  // opts.nameOf(id) -> wood name, opts.finish -> finish name. Steps are {id, text} so checkmarks survive edits.
  function cutList(b, opts = {}) {
    const B = fix(clone(b)), nm = id => (opts.nameOf ? opts.nameOf(id) : id) || id, lc = id => String(nm(id)).toLowerCase();
    const per = {}, steps = [], st = (id, text) => steps.push({ id, text });
    const add = (w, n, len, wd, th) => { const e = per[w] ||= { wood: w, pieces: 0, length: 0, width: 0, thick: 0, bf: 0 }; e.pieces += n; e.length += len * n; e.width = Math.max(e.width, wd); e.thick = Math.max(e.thick, th); e.bf += n * len * wd * th / 144; };
    const T1 = B.T + FLAT, sliceTxt = `${frac(T1)} wide (the board thickness plus 1/8")`;
    let strips = null, blockCounts = null, layer = null;
    const L = B.L, W = B.W;

    if (B.style === 'edge') {
      const len = B.L + 1;
      strips = B.edge.map((s, i) => ({ i: i + 1, wood: s.wood, top: s.w, cut: `${frac(s.w + PLANE)} thick × ${frac(T1)} tall × ${frac(len)} long` }));
      B.edge.forEach(s => add(s.wood, 1, len, T1, s.w + PLANE));
      st('mill', `Mill ${B.edge.length} strips to the sizes below. Each one stands on edge, so its thickness is the stripe you see on top. They're 1/16" thick and 1/8" tall over size for flattening, and 1" long for trimming.`);
      st('glue', `Glue them up in order, top to bottom, best faces up. Clamp evenly and let it cure overnight.`);
      st('flatten', `Flatten to ${frac(B.T)} thick, then trim to ${frac(L)} × ${frac(W)}.`);
    } else if (B.style === 'multi') {
      const m = multiInfo(B), groups = [];
      for (const r of m.rows) {
        if (!m.panels[r.panel] || !m.panels[r.panel].length) continue;
        let g = groups.find(x => x.k === r.panel && Math.abs(x.d - r.w) < EPS);
        if (!g) groups.push(g = { k: r.panel, d: r.w, n: 0, flips: 0 });
        g.n++; if (r.flip) g.flips++;
      }
      const multiDepth = k => groups.filter(g => g.k === k).length > 1;
      strips = [];
      for (const g of groups) {
        const P = m.panels[g.k], len = g.n * (T1 + KERF) + ENDS, tag = g.k + (multiDepth(g.k) ? ` (${frac(g.d)})` : '');
        const solid = new Set(P.map(x => x.key)).size === 1;
        st('panel-' + g.k + g.d, solid
          ? `Panel ${tag}: plane ${lc(B.keys[P[0].key])} to ${frac(g.d)} thick, at least ${frac(m.widths[g.k])} wide and ${frac(len)} long.`
          : `Panel ${tag}: mill ${P.length} strips ${frac(g.d + PLANE)} thick and ${frac(len)} long (widths below), glue them side by side in order, and flatten the panel to ${frac(g.d)} thick.`);
        P.forEach((x, i) => { const wood = B.keys[x.key] || 'maple'; strips.push({ i: `${g.k}${i + 1}`, wood, top: x.w, cut: `${frac(x.w + PLANE)} wide × ${frac(g.d + PLANE)} thick × ${frac(len)} long` }); add(wood, 1, len, x.w + PLANE, g.d + PLANE); });
      }
      st('slice', `Crosscut slices ${sliceTxt}: ${groups.map(g => `${g.n} from ${g.k}${multiDepth(g.k) ? ` (${frac(g.d)})` : ''}`).join(', ')}.`);
      const seq = []; m.rows.forEach(r => { const t = r.panel + (r.flip ? ' flipped' : ''), last = seq[seq.length - 1]; if (last && last.t === t) last.n++; else seq.push({ t, n: 1 }); });
      st('arrange', `Turn every slice end grain up and lay them out in this order: ${seq.map(x => x.n > 1 ? `${x.t} ×${x.n}` : x.t).join(', ')}.${m.rows.some(r => r.flip) ? ' "Flipped" means turned end for end.' : ''}`);
      st('glue2', `Glue the slices together, flatten to ${frac(B.T)} thick, then trim to about ${frac(m.L)} × ${frac(m.W)}.`);
      const thin = groups.find(g => g.d <= .375 && new Set(m.panels[g.k].map(x => x.key)).size === 1);
      const host = thin && groups.find(g => g.k !== thin.k);
      if (thin && host) st('tip', `Tip: thin solid slices like ${thin.k} snap easily. Instead, glue the ${frac(thin.d)} ${lc(B.keys[m.panels[thin.k][0].key])} onto one face of panel ${host.k} before slicing, and flip slices by turning them over lengthwise so the line stays on the same side.`);
      if (m.errs.length) steps.unshift({ id: 'check', text: 'Check the design: ' + m.errs.join(' ') });
    } else if (B.pattern === 'chaos') {
      const cells = layout(B).cells, counts = {}, bw = B.strips[0].w, d = B.cell;
      cells.forEach(c => counts[c.wood] = (counts[c.wood] || 0) + 1);
      blockCounts = counts;
      Object.entries(counts).forEach(([w, k]) => { const spare = Math.ceil(k * 1.1), len = spare * (T1 + KERF) + ENDS; add(w, 1, len, bw + PLANE, d + PLANE); });
      const sq = Math.abs(bw - d) < EPS;
      st('mill', `Mill a stick of each wood ${frac(bw + PLANE)} × ${frac(d + PLANE)}${sq ? ' (square)' : ''}, long enough for its blocks below.`);
      st('blocks', `Crosscut the sticks into blocks ${frac(T1)} long (the board thickness plus 1/8"). The counts below include 10% spare.`);
      st('arrange', `Lay out ${B.nRows} rows of ${B.nCols} blocks, end grain up, mixing the woods at random. Try not to put the same wood side by side.`);
      st('glue2', `Glue each row into a strip, then glue the strips together. Flatten to ${frac(B.T)} thick and trim to ${frac(L)} × ${frac(W)}.`);
    } else if (B.pattern === 'brick') {
      const P = brickPanel(B), a = B.strips[0].w, j = B.joint || 0, h = B.cell, len = B.nRows * (T1 + KERF) + ENDS, half = halfBrick(B);
      strips = P.map((s, i) => ({ i: i + 1, wood: s.wood, top: s.w, mortar: !s.brick, cut: `${frac(s.w + PLANE)} wide × ${frac(h + PLANE)} thick × ${frac(len)} long${s.half ? ' (half brick)' : ''}` }));
      P.forEach(s => add(s.wood, 1, len, s.w + PLANE, h + PLANE));
      const nb = P.filter(s => s.brick && !s.half).length;
      st('mill', `Strips: mill ${nb} brick strips ${frac(a)} wide${half > EPS ? `, one ${frac(half)} half-brick strip` : ''}${j > EPS ? ` and ${P.filter(s => !s.brick).length} mortar strips ${frac(j)} wide` : ''}, all ${frac(h + PLANE)} thick and ${frac(len)} long. Rip them a hair wide and joint to the sizes below.`);
      st('glue1', `Glue-up 1: glue the strips side by side in the order below${j > EPS ? ' (brick, mortar, brick … ending with the half brick)' : ''} into a panel ${frac(L)} wide. Flatten it to ${frac(h)} thick; that's the brick height.`);
      if (j > EPS) {
        layer = { wood: B.mortar, cut: `${frac(j + PLANE)} thick × ${frac(L + .25)} wide × ${frac(len)} long` };
        add(B.mortar, 1, len, L + .25, j + PLANE);
        st('layer', `Mortar layer: plane ${lc(B.mortar)} to ${frac(j)} thick and glue it flat onto one face of the panel. Trim it flush. It becomes the mortar line between rows.`);
      }
      st('slice', `Square one end and crosscut ${B.nRows} slices, each ${sliceTxt}.`);
      st('arrange', `Turn every slice end grain up${j > EPS ? ' with the mortar line on the same side' : ''}. Flip every other slice end for end${j > EPS ? ', turning it over lengthwise so the mortar stays on the same side' : ''}. The joints now land over the middle of the bricks below, like a brick wall.`);
      st('glue2', `Glue-up 2: glue the slices together in order. Flatten to ${frac(B.T)} thick${j > EPS ? ', rip the extra mortar line off the last row' : ''}, and square it up to ${frac(L)} × ${frac(W)}.`);
    } else {
      const d = B.cell, n = B.strips.length, rowsN = B.nRows;
      let end = 0; for (let i = 0; i < rowsN; i++) { const k0 = shiftOf(B, i); end = Math.max(end, k0 + span(B, k0)); }
      const tile = (k0, cnt) => Array.from({ length: cnt }, (_, k) => at(B, k0 + k));
      const same = (p, q) => p.length === q.length && p.every((s, i) => s.wood === q[i].wood && Math.abs(s.w - q[i].w) < EPS);
      const nc = span(B, 0), flip = B.pattern === 'checker' && rowsN > 1 && same(tile(0, nc).reverse(), tile(1, nc));
      const P = flip ? tile(0, nc) : tile(0, Math.max(end, nc)), PW = sumW(P), len = rowsN * (T1 + KERF) + ENDS;
      strips = P.map((s, i) => ({ i: i + 1, wood: s.wood, top: s.w, cut: `${frac(s.w + PLANE)} wide × ${frac(d + PLANE)} thick × ${frac(len)} long` }));
      P.forEach(s => add(s.wood, 1, len, s.w + PLANE, d + PLANE));
      const extra = PW - W > EPS;
      st('mill', `Strips: mill ${P.length} strips ${frac(d + PLANE)} thick and ${frac(len)} long, in the widths below. Their thickness becomes the row depth (${frac(d)}); their width is the block you see across the board.`);
      st('glue1', `Glue-up 1: glue the strips side by side in order into a panel ${frac(PW)} wide. Flatten it to ${frac(d)} thick.`);
      st('slice', `Square one end and crosscut ${rowsN} slices, each ${sliceTxt}.`);
      const shifts = n => Array.from({ length: n }, (_, i) => shiftOf(B, i)).map(k => k ? '+' + k : '0').join(', ');
      const how = {
        checker: flip ? 'Flip every other slice end for end so the colors alternate.' : `Slide every other slice over one strip (${frac(P[0].w)}) so the colors alternate. The extra strip hangs off one side and gets trimmed.`,
        diagonal: `Slide each slice over one more strip than the one before it, so the stripes step across the board. The slide repeats every ${n} slices: ${shifts(n)} strips.`,
        zigzag: `Slide the slices over one strip at a time, up to ${Math.max(1, B.amp)}, then back the other way: ${shifts(2 * Math.max(1, B.amp))} strips, and repeat.`,
        stripes: 'Keep every slice lined up the same way so the stripes run straight.'
      }[B.pattern];
      st('arrange', `Turn every slice so its end grain faces up. ${how}`);
      st('glue2', `Glue-up 2: glue the slices together in order. Flatten to ${frac(B.T)} thick${extra ? `, trim the overhang off the side` : ''}, and square it up to ${frac(L)} × ${frac(W)}.`);
    }
    finishing(B, st, opts);
    return { steps, strips, blocks: blockCounts, layer, woods: Object.values(per), L, W };
  }
  function finishing(B, st, opts) {
    const end = B.style !== 'edge';
    if (B.groove) st('groove', `Juice groove: rout a groove about ${frac(clamp(Math.min(B.L, B.W) * .045, .5, .875))} in from the edge with a 3/8" core box bit, 1/4" deep${end ? ', in light passes so the end grain doesn\'t tear out' : ''}.`);
    if (B.grips) st('grips', `Finger grips: rout a hand grip into ${B.L >= B.W ? 'each end' : 'each long side'} with a finger grip or cove bit.`);
    if (B.profile === 'round') st('edges', `Round over the edges with a 1/4" roundover bit${end ? '; back-rout or climb carefully at the corners to avoid blowout' : ''}.`);
    else if (B.profile === 'chamfer') st('edges', 'Chamfer the edges with a 45° chamfer bit.');
    else st('edges', 'Break the sharp edges with sandpaper.');
    st('sand', `Sand through ${end ? '220' : '180'} grit, wipe it with a damp cloth to raise the grain, sand lightly again, then ${opts.finish && opts.finish !== 'Unfinished' ? 'finish with ' + opts.finish : 'apply the finish'}.`);
    if (B.feet) st('feet', 'Feet: screw rubber feet into the bottom, about 1" in from each corner.');
  }
  // Older saves kept checkmarks by step number
  function doneIds(b, steps) {
    const d = b.done || [];
    return d.map(x => typeof x === 'number' ? (steps[x] || {}).id : x).filter(Boolean);
  }

  /* ---------- QR payload ---------- */
  // ix(woodId) -> one-character index into the piece's wood list
  function pack(b, ix) {
    const B = fix(clone(b)), o = { s: B.style, T: B.T, sd: B.seed };
    const feat = (B.groove ? 'g' : '') + (B.grips ? 'h' : '') + (B.feet ? 'f' : ''); if (feat) o.f = feat;
    if (B.profile) o.e = B.profile[0];
    if (B.style === 'multi') Object.assign(o, { n: B.name || '', k: Object.entries(B.keys).map(([k, id]) => k + ix(id)).join(''), pa: B.panels, r: B.rows });
    else if (B.style === 'edge') Object.assign(o, { L: B.L, q: B.edge.map(x => ix(x.wood) + ':' + (+x.w.toFixed(4))).join(',') });
    else {
      Object.assign(o, { p: B.pattern, c: B.cell, R: B.nRows, C: B.nCols, q: B.strips.map(x => ix(x.wood) + ':' + (+x.w.toFixed(4))).join(',') });
      if (!B.lock) o.u = 1;
      if (B.pattern === 'zigzag') o.a = B.amp;
      if (B.pattern === 'brick') { o.j = B.joint; o.mo = ix(B.mortar); }
    }
    return o;
  }
  // id(indexChar) -> wood id used with colorOf
  function unpack(q, id) {
    const list = String(q.q || '').split(',').filter(Boolean).map(x => { const [i, w] = x.split(':'); return { wood: id(i), w: +w }; });
    const prof = { r: 'round', c: 'chamfer', s: 'square' }[q.e];
    const base = { T: q.T, seed: q.sd, groove: /g/.test(q.f || ''), grips: /h/.test(q.f || ''), feet: /f/.test(q.f || ''), profile: prof };
    if (q.s === 'multi') { const keys = {}; String(q.k || '').replace(/([A-Z])([0-9a-z])/g, (m, k, i) => keys[k] = id(i)); return fix({ ...base, style: 'multi', name: q.n, keys, panels: q.pa || {}, rows: q.r || '' }); }
    if (q.s !== 'end') return fix({ ...base, style: 'edge', L: q.L, edge: list });
    if (!q.R) return upgrade({ ...base, style: 'end', pattern: q.p, L: q.L, W: q.W, cell: q.c, amp: q.a, strips: list }, []);   // 1.6 tags
    return fix({ ...base, style: 'end', pattern: q.p, cell: q.c, nRows: q.R, nCols: q.C, amp: q.a, lock: !q.u, ratio: list.length && q.c ? list[0].w / q.c : undefined, joint: q.j, mortar: q.mo !== undefined ? id(q.mo) : undefined, strips: list });
  }

  /* ---------- Fractions ---------- */
  function frac(x, den = 16) {
    x = +x || 0; let w = Math.floor(x + 1e-9), n = Math.round((x - w) * den), d = den;
    if (n === d) { w++; n = 0; }
    while (n && n % 2 === 0) { n /= 2; d /= 2; }
    return (w ? w : (n ? '' : '0')) + (n ? (w ? ' ' : '') + n + '/' + d : '') + '"';
  }
  // "1 1/2", "1-1/2", "1.5", "3/4", "1½" -> number
  function parse(v) {
    const U = { '½': .5, '¼': .25, '¾': .75, '⅛': .125, '⅜': .375, '⅝': .625, '⅞': .875 };
    v = String(v).trim().replace(/["”″]/g, '').replace(/in(ches)?$/i, '').trim(); if (!v) return NaN;
    const u = v.match(/^(\d*)\s*([½¼¾⅛⅜⅝⅞])$/); if (u) return (+u[1] || 0) + U[u[2]];
    const m = v.match(/^(\d+)[\s-]+(\d+)\/(\d+)$/); if (m) return +m[1] + m[2] / m[3];
    const f = v.match(/^(\d+)\/(\d+)$/); if (f) return f[1] / f[2];
    return parseFloat(v);
  }

  return { STYLES, PATTERNS, PROFILES, PRESETS, applyPreset, importLink, multiInfo, parseStrips, parseRows, defaults, upgrade, fix, dims, snap, step, countOf, setSize, setLock, blockW, mirror, repeat, isMirror, layout, blocks, woods, widthOf, lengthOf, draw, cutList, doneIds, pack, unpack, frac, parse, shiftOf };
})();
if (typeof module !== 'undefined') module.exports = BD;
