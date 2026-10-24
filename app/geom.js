'use strict';
/* Template geometry: read STL plates, find the outline, holes, punch marks and the dovetail,
   and work out how two parts mate. Shared by the app and the build tools (Node). */

const G = (() => {
  /* ---------- STL ---------- */
  function parseSTL(buf) {
    const u8 = new Uint8Array(buf);
    const head = new TextDecoder().decode(u8.slice(0, 256));
    const dv = new DataView(buf);
    const n = buf.byteLength >= 84 ? dv.getUint32(80, true) : 0;
    const isBinary = buf.byteLength === 84 + n * 50 || !/^\s*solid[\s\S]*facet/.test(head);
    let tris;
    if (isBinary) {
      tris = new Float32Array(n * 9);
      for (let i = 0; i < n; i++) for (let k = 0; k < 9; k++) tris[i * 9 + k] = dv.getFloat32(84 + i * 50 + 12 + k * 4, true);
    } else {
      const txt = new TextDecoder().decode(u8);
      const v = [...txt.matchAll(/vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g)].map(m => [+m[1], +m[2], +m[3]]);
      tris = new Float32Array(v.length * 3);
      v.forEach((p, i) => tris.set(p, i * 3));
    }
    return tris;
  }
  // Cross-section loops at height z above the bottom of the plate
  function slice(tris, dz = 0.3) {
    let zmin = Infinity;
    for (let i = 2; i < tris.length; i += 3) zmin = Math.min(zmin, tris[i]);
    const z = zmin + dz, segs = [];
    for (let t = 0; t < tris.length; t += 9) {
      const P = [[tris[t], tris[t + 1], tris[t + 2]], [tris[t + 3], tris[t + 4], tris[t + 5]], [tris[t + 6], tris[t + 7], tris[t + 8]]];
      const pts = [];
      for (let e = 0; e < 3; e++) {
        const a = P[e], b = P[(e + 1) % 3];
        if ((a[2] - z) * (b[2] - z) < 0) { const k = (z - a[2]) / (b[2] - a[2]); pts.push([a[0] + k * (b[0] - a[0]), a[1] + k * (b[1] - a[1])]); }
      }
      if (pts.length === 2) segs.push(pts);
    }
    // chain segments into loops
    const key = p => Math.round(p[0] * 1e4) + ',' + Math.round(p[1] * 1e4);
    const at = new Map();
    segs.forEach((s, i) => { for (const p of s) { const k = key(p); if (!at.has(k)) at.set(k, []); at.get(k).push(i); } });
    const used = new Uint8Array(segs.length), loops = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      used[i] = 1; const loop = [segs[i][0], segs[i][1]];
      let cur = segs[i][1];
      for (let guard = 0; guard < segs.length; guard++) {
        const cand = (at.get(key(cur)) || []).find(j => !used[j]);
        if (cand == null) break;
        used[cand] = 1;
        const s = segs[cand]; const nxt = key(s[0]) === key(cur) ? s[1] : s[0];
        if (key(nxt) === key(loop[0])) break;
        loop.push(nxt); cur = nxt;
      }
      if (loop.length > 3) loops.push(loop);
    }
    return loops;
  }

  /* ---------- polygon helpers ---------- */
  const area = L => { let a = 0; for (let i = 0, j = L.length - 1; i < L.length; j = i++) a += (L[j][0] + L[i][0]) * (L[j][1] - L[i][1]); return a / 2; };
  const centroid = L => { let x = 0, y = 0, a = 0; for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const f = L[j][0] * L[i][1] - L[i][0] * L[j][1]; x += (L[j][0] + L[i][0]) * f; y += (L[j][1] + L[i][1]) * f; a += f; } return [x / (3 * a), y / (3 * a)]; };
  function inside(L, p) {
    let c = false;
    for (let i = 0, j = L.length - 1; i < L.length; j = i++) {
      const [xi, yi] = L[i], [xj, yj] = L[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function rdp(L, eps) {
    if (L.length < 4) return L;
    const out = []; const keep = new Uint8Array(L.length); keep[0] = keep[L.length - 1] = 1;
    const st = [[0, L.length - 1]];
    while (st.length) {
      const [a, b] = st.pop(); let md = 0, mi = -1;
      const [x1, y1] = L[a], [x2, y2] = L[b], dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1e-9;
      for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * L[i][0] - dx * L[i][1] + x2 * y1 - y2 * x1) / len; if (d > md) { md = d; mi = i; } }
      if (md > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
    }
    L.forEach((p, i) => keep[i] && out.push(p));
    return out;
  }
  const pathD = L => 'M' + L.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L') + 'Z';

  /* ---------- dovetail ---------- */
  // Both the tail tip and the socket bottom are a straight ~16 mm edge. Tell them apart by probing around it.
  function findJoint(L) {
    const n = L.length, segs = [];
    let start = 0;
    const dir = i => { const a = L[i], b = L[(i + 1) % n]; return Math.atan2(b[1] - a[1], b[0] - a[0]); };
    const edges = [...Array(n).keys()];
    // merge nearly collinear consecutive edges
    let i = 0;
    while (i < n) {
      let j = i, d0 = dir(i), len = 0;
      while (j < i + n) {
        const dj = dir(j % n); let diff = Math.abs(dj - d0); if (diff > Math.PI) diff = 2 * Math.PI - diff;
        if (diff > 0.05) break;
        const a = L[j % n], b = L[(j + 1) % n]; len += Math.hypot(b[0] - a[0], b[1] - a[1]); j++;
      }
      if (j === i) j = i + 1;
      segs.push({ a: L[i % n], b: L[j % n], len });
      i = j;
    }
    const found = [];
    for (const s of segs) {
      if (s.len < 14 || s.len > 18.5) continue;
      const m = [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2];
      const u = [(s.b[0] - s.a[0]) / s.len, (s.b[1] - s.a[1]) / s.len];
      let nrm = [-u[1], u[0]];
      if (inside(L, [m[0] + nrm[0] * 0.4, m[1] + nrm[1] * 0.4])) nrm = [-nrm[0], -nrm[1]];   // point out of the material
      const P = (along, lat) => [m[0] + nrm[0] * along + u[0] * lat, m[1] + nrm[1] * along + u[1] * lat];
      const In = p => inside(L, p);
      const tail = In(P(-4.5, 0)) && In(P(-12, 0)) && !In(P(-7, 7.6)) && !In(P(-7, -7.6));
      const socket = !In(P(4.5, 0)) && In(P(2, 9.6)) && In(P(2, -9.6)) && In(P(7, 7.4)) && In(P(7, -7.4));
      if (tail || socket) found.push({ kind: tail ? 'tail' : 'socket', m, n: nrm });
    }
    return found.length ? found[0] : null;
  }
  // Transform to apply to the socket part so it wraps the tail part's tail. Returns [a,b,c,d,e,f] (SVG matrix).
  function mateMatrix(socketJ, tailJ, back = 0.1) {
    // rotate socket normal onto the opposite of the tail normal, then move bottom-mid onto tip-mid
    const ang = Math.atan2(-tailJ.n[1], -tailJ.n[0]) - Math.atan2(socketJ.n[1], socketJ.n[0]);
    const c = Math.cos(ang), s = Math.sin(ang);
    const [sx, sy] = socketJ.m, [tx, ty] = tailJ.m;
    return [c, s, -s, c, tx - tailJ.n[0] * back - (c * sx - s * sy), ty - tailJ.n[1] * back - (s * sx + c * sy)];
  }
  const apply = (M, p) => [M[0] * p[0] + M[2] * p[1] + M[4], M[1] * p[0] + M[3] * p[1] + M[5]];
  const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];

  /* ---------- build a template from STL loops ---------- */
  function fromLoops(loops) {
    const withA = loops.map(L => ({ L, a: Math.abs(area(L)) })).sort((p, q) => q.a - p.a);
    const outer = withA[0].L;
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const [x, y] of outer) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
    const tf = L => L.map(([x, y]) => [x - minx, maxy - y]);   // y down, origin top-left
    const O = tf(outer);
    const holes = withA.slice(1).filter(h => inside(outer, h.L[0])).map(h => ({ L: tf(h.L), a: h.a }));
    const punches = holes.filter(h => h.a < 20).map(h => centroid(h.L).map(v => +v.toFixed(2)));
    const hang = holes.filter(h => h.a > 95 && h.a < 135).map(h => centroid(h.L).map(v => +v.toFixed(2)));
    const big = holes.filter(h => h.a >= 150);
    const hollow = big.filter(h => h.a > withA[0].a * 0.25).map(h => rdp(h.L, 0.15));   // a bowl's hollow guide, not a cut
    const windows = big.filter(h => h.a <= withA[0].a * 0.25).map(h => rdp(h.L, 0.15));
    const Os = rdp(O, 0.12);
    const joint = findJoint(O);
    return {
      w: +(maxx - minx).toFixed(1), h: +(maxy - miny).toFixed(1),
      d: [Os, ...windows].map(pathD).join(' '),
      hollowD: hollow.length ? hollow.map(pathD).join(' ') : undefined,
      punches, hang, joint: joint ? { kind: joint.kind, m: joint.m.map(v => +v.toFixed(2)), n: joint.n.map(v => +v.toFixed(4)) } : null
    };
  }
  function fromSTL(buf) { return fromLoops(slice(parseSTL(buf))); }

  // Is this the same shape as another template? Size, area and balance point all have to agree,
  // so a mirrored copy or a longer variant still counts as different.
  const loopsOf = d => (d.match(/M[^MZ]*Z?/g) || []).map(r => r.replace(/[MZ]/g, '').trim().split(/\s*L\s*/).map(s => s.split(',').map(Number)).filter(p => p.length === 2 && !p.some(isNaN)));
  function sig(t) {
    if (!t || !t.d) return null;
    const L = loopsOf(t.d)[0]; if (!L || L.length < 3) return null;
    const c = centroid(L); return { w: t.w, h: t.h, a: Math.abs(area(L)), cx: c[0] / t.w, cy: c[1] / t.h };
  }
  function sameShape(a, b) {
    const x = sig(a), y = sig(b);
    if (x && y) return Math.abs(x.w - y.w) <= 0.4 && Math.abs(x.h - y.h) <= 0.4 && Math.abs(x.a - y.a) / y.a < 0.01 && Math.abs(x.cx - y.cx) < 0.015 && Math.abs(x.cy - y.cy) < 0.015;
    return !!(a && b && a.markup && a.markup === b.markup);
  }

  // "KJ1_jar_scraper_round.stl" -> { code: 'KJ1', name: 'Jar scraper (round)' }
  function nameFromFile(fn) {
    const base = fn.replace(/\.[^.]+$/, '');
    const m = base.match(/^([A-Za-z]+)0*(\d+)[\s_-]+(.*)$/);
    const code = m ? (m[1].toUpperCase() + m[2]) : '';
    let words = (m ? m[3] : base).replace(/[_-]+/g, ' ').trim().split(/\s+/);
    const kept = words.filter(w => !/^(handle|head|arm|plate|template|knife)$/i.test(w));
    if (kept.length) words = kept;
    const KNOWN = /^(jar scraper|butter spreader|dough paddle|spatula|bowl|spreader|scraper|paddle)/i;
    let s = words.join(' ');
    // move a trailing style word into parentheses: "jar scraper round" -> "Jar scraper (round)"
    const k = s.match(KNOWN);
    if (k && s.length > k[0].length) s = k[0] + ' (' + s.slice(k[0].length).trim() + ')';
    s = s.charAt(0).toUpperCase() + s.slice(1);
    return { code, name: s || base };
  }

  return { parseSTL, slice, fromLoops, fromSTL, sameShape, findJoint, mateMatrix, apply, mul, inside, area, centroid, nameFromFile };
})();
if (typeof module !== 'undefined') module.exports = G;
