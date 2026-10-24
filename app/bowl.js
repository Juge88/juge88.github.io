'use strict';
/* Segmented / solid bowls: shape profiles, ring sizing, cut list, side-view drawing and 3D geometry.
   Units are inches. Shared by the app and the customer story page. */

const B = (() => {
  // Outer profile presets: [height 0..1 from the foot, radius 0..1 of the widest point]
  const SHAPES = {
    open:    { name: 'Open bowl', phrase: 'an open bowl',   pts: [[0, .46], [.15, .63], [.35, .80], [.6, .93], [.85, .99], [1, 1]] },
    round:   { name: 'Rounded', phrase: 'a rounded bowl',     pts: [[0, .40], [.18, .68], [.42, .88], [.68, .98], [.88, 1], [1, .98]] },
    steep:   { name: 'Steep wall', phrase: 'a steep-walled bowl',  pts: [[0, .62], [.12, .84], [.3, .96], [.6, 1], [1, 1]] },
    vase:    { name: 'Vase', phrase: 'a vase',        pts: [[0, .52], [.22, .86], [.42, 1], [.66, .84], [.84, .6], [1, .64]] },
    platter: { name: 'Platter', phrase: 'a platter',     pts: [[0, .62], [.4, .86], [.8, .98], [1, 1]] },
    flared:  { name: 'Flared', phrase: 'a flared bowl',      pts: [[0, .36], [.3, .5], [.6, .7], [.85, .9], [1, 1]] }
  };
  const ALLOW = 0.125;   // extra wood left on each side of the turned wall, inches

  // Monotone cubic through the preset points
  function curve(pts) {
    const n = pts.length, x = pts.map(p => p[0]), y = pts.map(p => p[1]);
    const d = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    return t => {
      t = Math.max(0, Math.min(1, t));
      let i = 0; while (i < n - 2 && t > x[i + 1]) i++;
      const h = x[i + 1] - x[i], s = (t - x[i]) / h, s2 = s * s, s3 = s2 * s;
      return (2 * s3 - 3 * s2 + 1) * y[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * y[i + 1] + (s3 - s2) * h * m[i + 1];
    };
  }
  const profile = bw => { const c = curve((SHAPES[bw.shape] || SHAPES.open).pts), R = bw.D / 2; return y => R * c(y / bw.H); };

  function defaults(woods) {
    const a = woods[0] || 'walnut', b = woods[1] || 'maple';
    const bw = { kind: 'seg', shape: 'open', D: 10, H: 4, ringH: 0.75, wall: 0.3125, base: a, rings: [] };
    return fitRings(bw, { n: 12, pat: 'alt', woods: [a, b], off: false });
  }
  // Keep one ring per band of height above the base; new rings copy the one below, alternating the offset.
  function fitRings(bw, tmpl) {
    const count = Math.max(1, Math.round((bw.H - bw.ringH) / bw.ringH));
    while (bw.rings.length < count) {
      const last = bw.rings[bw.rings.length - 1] || tmpl;
      bw.rings.push({ ...JSON.parse(JSON.stringify(last)), off: last === tmpl ? false : !last.off });
    }
    bw.rings.length = count;
    return bw;
  }
  // Wood for every segment of a ring (two rows for a checker ring)
  function segWoods(r) {
    if (r.rows) return r.rows;
    const n = r.n, ws = r.woods && r.woods.length ? r.woods : ['maple'];
    if (r.pat === 'solid') return [Array(n).fill(ws[0])];
    if (r.pat === 'custom') return [Array.from({ length: n }, (_, i) => (r.segs && r.segs[i]) || ws[i % ws.length])];
    const row = Array.from({ length: n }, (_, i) => ws[i % ws.length]);
    if (r.pat === 'checker') return [row, row.map((_, i) => ws[(i + 1) % ws.length])];
    return [row];
  }
  // Every ring with its height band, turning radii and cut sizes
  function rings(bw) {
    const R = profile(bw), out = [];
    const band = (y0, y1) => { let mx = 0, mn = Infinity; for (let k = 0; k <= 12; k++) { const r = R(y0 + (y1 - y0) * k / 12); mx = Math.max(mx, r); mn = Math.min(mn, r); } return [mx, mn]; };
    const [bMax] = band(0, bw.ringH);
    out.push({ base: true, y0: 0, y1: bw.ringH, wood: bw.base, disc: 2 * (bMax + ALLOW) });
    const rh = ringHeight(bw);
    bw.rings.forEach((r, i) => {
      const y0 = bw.ringH + rh * i, y1 = y0 + rh, [mx, mn] = band(y0, y1);
      const ro = mx + ALLOW, ri = Math.max(0, mn - bw.wall - ALLOW);
      const half = Math.PI / r.n;
      const apIn = ri * Math.cos(half);                          // inner flat sits inside the hollow
      const outer = 2 * ro * Math.tan(half), inner = 2 * apIn * Math.tan(half);
      out.push({ i, ring: r, y0, y1, ro, ri, miter: 180 / r.n, outer, inner, width: ro - apIn, rows: segWoods(r) });
    });
    return out;
  }
  // Rings share the height above the base evenly, so the top comes out exactly at H
  const ringHeight = bw => (bw.H - bw.ringH) / Math.max(1, bw.rings.length);
  // Cut list: per ring sizes plus total strip length per wood (segments flipped end-for-end along the strip)
  function cutList(bw, kerf = 0.125) {
    const rs = rings(bw), per = {}; let base = null;
    const add = (w, len, width, thick) => { const e = per[w] ||= { wood: w, length: 0, width: 0, thick, pieces: 0 }; e.length += len; e.width = Math.max(e.width, width); e.pieces++; };
    for (const r of rs) {
      if (r.base) { base = { wood: r.wood, size: r.disc, thick: bw.ringH }; continue; }
      const t = r.rows.length > 1 ? ringHeight(bw) / 2 : ringHeight(bw);
      for (const row of r.rows) for (const w of row) add(w, (r.outer + r.inner) / 2 + kerf, r.width, t);
    }
    Object.values(per).forEach(e => e.length *= 1.1);         // 10% for waste and trimming
    return { rings: rs, woods: Object.values(per), base };
  }
  // 3 7/16"
  function frac(x, den = 16) {
    const neg = x < 0; x = Math.abs(x);
    let w = Math.floor(x), n = Math.round((x - w) * den), d = den;
    if (n === d) { w++; n = 0; }
    while (n && n % 2 === 0) { n /= 2; d /= 2; }
    return (neg ? '-' : '') + (w ? w : (n ? '' : '0')) + (n ? (w ? ' ' : '') + n + '/' + d : '') + '"';
  }
  const ft = x => x >= 24 ? `${frac(x)} (${(x / 12).toFixed(1)} ft)` : frac(x);
  const pieceCount = bw => rings(bw).reduce((a, r) => a + (r.base ? 1 : r.rows.reduce((s, row) => s + row.length, 0)), 0);

  // Side elevation as SVG. colorOf(id) -> {color, color2}
  function side(bw, colorOf) {
    const R = profile(bw), S = 30, W = bw.D * S + 20, Hh = bw.H * S + 20, cx = W / 2, base = Hh - 10;
    const id = 'b' + Math.random().toString(36).slice(2, 7);
    let s = '';
    const col = w => (colorOf(w) || { color: '#c9a57a' });
    const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = c => Math.max(0, Math.min(255, Math.round(c * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
    const view = a => [Math.sin(a), Math.cos(a)];   // angle 0 faces the viewer
    const drawBand = (y0, y1, ring, rowWoods, rot) => {
      const n = rowWoods.length, step = 2 * Math.PI / n, sub = 4;
      for (let k = 0; k < n; k++) {
        const a0 = -Math.PI + k * step + rot, a1 = a0 + step;
        for (let q = 0; q < sub; q++) {
          let b0 = a0 + (a1 - a0) * q / sub, b1 = a0 + (a1 - a0) * (q + 1) / sub;
          const m = ((b0 + b1) / 2 + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
          if (Math.abs(m) > Math.PI / 2) continue;
          const pts = [];
          for (let j = 0; j <= 3; j++) { const y = y0 + (y1 - y0) * j / 3; pts.push([cx + R(y) * Math.sin(b0) * S, base - y * S]); }
          for (let j = 3; j >= 0; j--) { const y = y0 + (y1 - y0) * j / 3; pts.push([cx + R(y) * Math.sin(b1) * S, base - y * S]); }
          const c = col(rowWoods[k]), lit = 0.55 + 0.5 * Math.cos(m - 0.35);
          s += `<path d="M${pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L')}Z" fill="${shade(c.color, lit)}" stroke="${shade(c.color, lit)}" stroke-width=".6"/>`;
        }
        // glue line at the segment edge
        const e = ((a1 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
        if (Math.abs(e) < Math.PI / 2 - .05) s += `<path d="M${(cx + R(y0) * Math.sin(a1) * S).toFixed(1)},${(base - y0 * S).toFixed(1)} L${(cx + R(y1) * Math.sin(a1) * S).toFixed(1)},${(base - y1 * S).toFixed(1)}" stroke="#000" stroke-opacity=".18" stroke-width=".5"/>`;
      }
    };
    const rs = bw.kind === 'seg' ? rings(bw) : null;
    if (rs) for (const r of rs) {
      if (r.base) { drawBand(r.y0, r.y1, null, Array(24).fill(r.wood), 0); continue; }
      const rot = r.ring.off ? Math.PI / r.ring.n : 0;
      if (r.rows.length === 2) { const m = (r.y0 + r.y1) / 2; drawBand(r.y0, m, r.ring, r.rows[0], rot); drawBand(m, r.y1, r.ring, r.rows[1], rot); }
      else drawBand(r.y0, r.y1, r.ring, r.rows[0], rot);
      s += `<path d="M${(cx - R(r.y0) * S).toFixed(1)},${(base - r.y0 * S).toFixed(1)} L${(cx + R(r.y0) * S).toFixed(1)},${(base - r.y0 * S).toFixed(1)}" stroke="#000" stroke-opacity=".2" stroke-width=".6"/>`;
    } else {
      // solid or epoxy: one wood, end-grain rings across the face
      const w = bw.wood || 'walnut', c = col(w);
      for (let q = 0; q < 48; q++) {
        const b0 = -Math.PI / 2 + Math.PI * q / 48, b1 = b0 + Math.PI / 48, m = (b0 + b1) / 2, lit = 0.55 + 0.5 * Math.cos(m - 0.35);
        const pts = [];
        for (let j = 0; j <= 16; j++) { const y = bw.H * j / 16; pts.push([cx + R(y) * Math.sin(b0) * S, base - y * S]); }
        for (let j = 16; j >= 0; j--) { const y = bw.H * j / 16; pts.push([cx + R(y) * Math.sin(b1) * S, base - y * S]); }
        s += `<path d="M${pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L')}Z" fill="${shade(c.color, lit)}" stroke="${shade(c.color, lit)}" stroke-width=".6"/>`;
      }
      for (let k = 1; k < 9; k++) {
        const yy = bw.H * k / 9, r = R(yy);
        s += `<path d="M${(cx - r * S).toFixed(1)},${(base - yy * S).toFixed(1)} Q${cx},${(base - yy * S + 10 + 6 * Math.sin(k)).toFixed(1)} ${(cx + r * S).toFixed(1)},${(base - yy * S).toFixed(1)}" fill="none" stroke="${c.color2 || c.color}" stroke-opacity=".6" stroke-width="1.2"/>`;
      }
    }
    // rim: a thin ellipse lip
    const rt = R(bw.H), ri = Math.max(0, rt - bw.wall);
    s += `<ellipse cx="${cx}" cy="${base - bw.H * S}" rx="${(rt * S).toFixed(1)}" ry="${(rt * S * .12).toFixed(1)}" fill="#1b130e" stroke="${shade(col(bw.kind === 'seg' && bw.rings.length ? segWoods(bw.rings[bw.rings.length - 1])[0][0] : bw.wood || bw.base).color, .9)}" stroke-width="${(bw.wall * S * .5).toFixed(1)}"/>`;
    s += `<ellipse cx="${cx}" cy="${base - bw.H * S + 2}" rx="${(ri * S * .9).toFixed(1)}" ry="${(ri * S * .09).toFixed(1)}" fill="#000" fill-opacity=".35"/>`;
    return `<svg viewBox="0 0 ${W} ${Hh}" xmlns="http://www.w3.org/2000/svg"><ellipse cx="${cx}" cy="${base + 3}" rx="${(R(0) * S * 1.1).toFixed(1)}" ry="5" fill="#000" fill-opacity=".35"/>${s}</svg>`;
  }

  // Top-down ring diagram; segments get data-seg for tapping
  function ringTop(ring, colorOf, rowIdx = 0) {
    const rows = segWoods(ring), row = rows[Math.min(rowIdx, rows.length - 1)], n = row.length, R1 = 100, R0 = 62, cx = 110, cy = 110;
    const rot = (ring.off ? Math.PI / n : 0) - Math.PI / 2;
    let s = '';
    for (let k = 0; k < n; k++) {
      const a0 = rot + k * 2 * Math.PI / n, a1 = a0 + 2 * Math.PI / n, c = (colorOf(row[k]) || { color: '#c9a57a' }).color;
      const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
      s += `<path data-seg="${k}" d="M${p(R0, a0)} L${p(R1, a0)} L${p(R1, a1)} L${p(R0, a1)} Z" fill="${c}" stroke="#1a120c" stroke-width="1.2"/>`;
    }
    return `<svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">${s}<text x="110" y="116" text-anchor="middle" font-size="16" fill="#a8998a" font-family="system-ui">${n} segments</text></svg>`;
  }

  // 3D: returns a THREE.Group (needs three.js)
  function mesh3d(bw, colorOf) {
    const R = profile(bw), g = new THREE.Group(), mats = {};
    const mat = w => mats[w] ||= new THREE.MeshPhongMaterial({ color: new THREE.Color((colorOf(w) || { color: '#c9a57a' }).color).convertSRGBToLinear(), shininess: 26, specular: 0x2a2018, side: THREE.DoubleSide });
    const inner = y => Math.max(0.05, R(y) - bw.wall);
    const floorY = bw.ringH * 0.6;
    // one patch of surface between two angles and heights
    const patch = (w, a0, a1, y0, y1, rad, flip) => {
      const nu = 4, nv = 4, pos = [], idx = [];
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const a = a0 + (a1 - a0) * i / nu, y = y0 + (y1 - y0) * j / nv, r = rad(y);
        pos.push(r * Math.sin(a), y, r * Math.cos(a));
      }
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const p = j * (nu + 1) + i, q = p + nu + 1;
        if (flip) idx.push(p, p + 1, q, p + 1, q + 1, q); else idx.push(p, q, p + 1, p + 1, q, q + 1);
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      g.add(new THREE.Mesh(geo, mat(w)));
    };
    const disc = (w, y, r, up) => {
      const geo = new THREE.CircleGeometry(r, 48); geo.rotateX(up ? -Math.PI / 2 : Math.PI / 2); geo.translate(0, y, 0);
      g.add(new THREE.Mesh(geo, mat(w)));
    };
    const ring = (rowWoods, y0, y1, rot, inside) => {
      const n = rowWoods.length, st = 2 * Math.PI / n;
      rowWoods.forEach((w, k) => {
        const a0 = rot + k * st, a1 = a0 + st;
        patch(w, a0, a1, y0, y1, R, false);
        if (inside) patch(w, a0, a1, Math.max(y0, floorY), y1, inner, true);
      });
    };
    if (bw.kind === 'seg') {
      for (const r of rings(bw)) {
        if (r.base) { ring(Array(16).fill(r.wood), 0, r.y1, 0, true); disc(r.wood, 0, R(0), false); disc(r.wood, floorY, inner(floorY), true); continue; }
        const rot = r.ring.off ? Math.PI / r.ring.n : 0;
        if (r.rows.length === 2) { const m = (r.y0 + r.y1) / 2; ring(r.rows[0], r.y0, m, rot, true); ring(r.rows[1], m, r.y1, rot, true); }
        else ring(r.rows[0], r.y0, r.y1, rot, true);
      }
      const top = rings(bw).pop(), tw = top.base ? top.wood : top.rows[top.rows.length - 1];
      const n = Array.isArray(tw) ? tw.length : 1;
      for (let k = 0; k < n; k++) {   // rim
        const w = Array.isArray(tw) ? tw[k] : tw, rot = top.ring && top.ring.off ? Math.PI / top.ring.n : 0, a0 = rot + k * 2 * Math.PI / n, a1 = a0 + 2 * Math.PI / n;
        const geo = new THREE.RingGeometry(inner(bw.H), R(bw.H), 4, 1, a0 + Math.PI / 2, a1 - a0); geo.rotateX(-Math.PI / 2); geo.rotateY(Math.PI); geo.translate(0, bw.H, 0);
        g.add(new THREE.Mesh(geo, mat(w)));
      }
    } else {
      const w = bw.wood || 'walnut';
      ring(Array(24).fill(w), 0, bw.H, 0, true); disc(w, 0, R(0), false); disc(w, floorY, inner(floorY), true);
      const geo = new THREE.RingGeometry(inner(bw.H), R(bw.H), 64, 1); geo.rotateX(-Math.PI / 2); geo.translate(0, bw.H, 0); g.add(new THREE.Mesh(geo, mat(w)));
    }
    g.position.y = -bw.H / 2;
    const wrap = new THREE.Group(); wrap.add(g); wrap.scale.setScalar(25.4);   // inches to the viewer's mm
    return wrap;
  }

  return { SHAPES, ringHeight, defaults, fitRings, segWoods, rings, cutList, frac, ft, pieceCount, side, ringTop, mesh3d, profile };
})();
if (typeof module !== 'undefined') module.exports = B;
