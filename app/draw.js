'use strict';
/* Drawing templates and assembled pieces as SVG. Shared by the app and the customer story page. */

const D = (() => {
  let seq = 0;
  const nid = p => p + (++seq) + Math.random().toString(36).slice(2, 5);
  const ptsOf = d => (d.match(/M[^MZ]*Z?/g) || []).map(r => r.replace(/[MZ]/g, '').trim().split(/\s*L\s*/).map(s => s.split(',').map(Number)));
  const mstr = M => `matrix(${M.map(v => +v.toFixed(5)).join(' ')})`;
  const apply = (M, p) => [M[0] * p[0] + M[2] * p[1] + M[4], M[1] * p[0] + M[3] * p[1] + M[5]];
  const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
  const rot = a => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
  const I = [1, 0, 0, 1, 0, 0];

  // Strips filling a box; vertical = strips side by side with the grain running up and down
  function bands(cols, x, y, w, h, vertical) {
    if (typeof GR === 'undefined') { const tot = cols.reduce((t, c) => t + (c.w > 0 ? c.w : 1), 0); let o = 0; return cols.map(c => { const f = (c.w > 0 ? c.w : 1) / tot, r = vertical ? `<rect x="${x + o * w}" y="${y - 2}" width="${f * w + .6}" height="${h + 4}" fill="${c.color}"/>` : `<rect x="${x - 2}" y="${y + o * h}" width="${w + 4}" height="${f * h + .6}" fill="${c.color}"/>`; o += f; return r; }).join(''); }
    return vertical ? `<g transform="matrix(0 1 1 0 0 0)">${GR.laminate(cols, y - 2, y + h + 2, x, x + w)}</g>` : GR.laminate(cols, x - 2, x + w + 2, y, y + h);
  }
  // Strips running at angle a (radians) across the given outline points, sized to cover them exactly
  function bandsAt(cols, pts, a) {
    const d = [Math.cos(a), Math.sin(a)], n = [-Math.sin(a), Math.cos(a)];
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of pts) { const u = p[0] * d[0] + p[1] * d[1], v = p[0] * n[0] + p[1] * n[1]; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const inner = typeof GR !== 'undefined' ? GR.laminate(cols, u0 - 3, u1 + 3, v0 - .3, v1 + .3) : '';
    return { svg: `<g transform="matrix(${[d[0], d[1], n[0], n[1], 0, 0].map(v => +v.toFixed(6)).join(' ')})">${inner}</g>`, frame: { d, n, u0: u0 - 3, u1: u1 + 3, v0: v0 - .3, v1: v1 + .3 } };
  }
  function shade(id, vertical) {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 1 : 0}" y2="${vertical ? 0 : 1}">
      <stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>`;
  }
  const shapeOf = t => t.d ? `<path d="${t.d}" clip-rule="evenodd" fill-rule="evenodd"/>` : t.markup;
  const strokeOf = (t, w = 0.7) => t.d ? `<path d="${t.d}" fill="none" fill-rule="evenodd" stroke="#000" stroke-opacity=".6" stroke-width="${w}"/>` : `<g fill="none" stroke="#000" stroke-opacity=".6" stroke-width="${w}">${t.markup}</g>`;

  // One template on its own, strips running along its long side.
  function single(t, cols) {
    if (!t) return '';
    const id = nid('s'), v = t.h >= t.w, m = 3, solid = cols.length === 1 && cols[0].print;   // plastic: one flat color, no wood grain
    // A long diagonal part (a knife arm) has its grain run along the part itself, not up and down the page
    let inner = null;
    if (t.d) {
      const P = ptsOf(t.d)[0]; let mx = 0, my = 0; P.forEach(q => { mx += q[0]; my += q[1]; }); mx /= P.length; my /= P.length;
      let sxx = 0, syy = 0, sxy = 0; P.forEach(q => { const dx = q[0] - mx, dy = q[1] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; });
      const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy), off = Math.abs(((ang * 180 / Math.PI) % 90 + 90) % 90 - 45);   // 45 = dead diagonal, 0 = straight
      if (45 - off > 12) inner = bandsAt(cols, P, ang).svg;
    }
    return `<svg viewBox="${-m} ${-m} ${t.w + 2 * m} ${t.h + 2 * m}" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="${id}">${shapeOf(t)}</clipPath>${shade(id + 'g', v)}</defs>
      <g clip-path="url(#${id})">${solid ? `<rect x="-2" y="-2" width="${t.w + 4}" height="${t.h + 4}" fill="${cols[0].color}"/>` : inner || bands(cols, 0, 0, t.w, t.h, v)}<rect width="${t.w}" height="${t.h}" fill="url(#${id}g)"/></g>
      ${t.hollowD ? `<path d="${t.hollowD}" fill="none" stroke="#e0a96d" stroke-width=".8" stroke-dasharray="3 2"/>` : ''}${strokeOf(t)}</svg>`;
  }

  // Put two parts together at their dovetail and turn the whole piece to its natural view.
  function assemble(ts) {
    ts = ts.filter(Boolean);
    if (!ts.length) return null;
    const tail = ts.find(t => t.joint && t.joint.kind === 'tail');
    const sock = ts.find(t => t.joint && t.joint.kind === 'socket');
    let parts;
    if (ts.length >= 2 && tail && sock && typeof G !== 'undefined') {
      parts = [{ t: tail, M: I.slice() }, { t: sock, M: G.mateMatrix(sock.joint, tail.joint) }];
    } else if (ts.length === 1 && ts[0].d) {
      const P = ptsOf(ts[0].d)[0]; let mx = 0, my = 0; P.forEach(p => { mx += p[0]; my += p[1]; }); mx /= P.length; my /= P.length;
      let sxx = 0, syy = 0, sxy = 0; P.forEach(p => { const dx = p[0] - mx, dy = p[1] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; });
      const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
      return finish([{ t: ts[0], M: rot(-ang) }], null, false);
    } else {
      let x = 0; parts = ts.map(t => { const p = { t, M: [1, 0, 0, 1, x, 0] }; x += t.w + 12; return p; });
      return finish(parts, null, false);
    }
    // natural view
    let R = I, blade = null;
    if (tail.punches && tail.punches.length === 2) {
      const [p1, p2] = tail.punches;
      R = rot(-Math.atan2(p2[1] - p1[1], p2[0] - p1[0]));
      const a1 = apply(R, p1), a2 = apply(R, p2);
      const cen = centroidOf(tail, R);
      if (cen[1] > a1[1]) R = mul(rot(Math.PI), R);            // the bow sits above the blade
      const hc = centroidOf(sock, mul(R, parts[1].M)), b1 = apply(R, p1), b2 = apply(R, p2);
      if (hc[0] > (b1[0] + b2[0]) / 2) R = mul([-1, 0, 0, 1, 0, 0], R);   // handle on the left
      blade = true;
    } else {
      const c1 = centroidOf(tail, I), c2 = centroidOf(sock, parts[1].M);
      R = rot(-Math.atan2(c2[1] - c1[1], c2[0] - c1[0]));     // handle left, head right
    }
    parts.forEach(p => p.M = mul(R, p.M));
    return finish(parts, blade ? tail.punches.map(q => apply(parts[0].M, q)) : null, true);
  }
  function centroidOf(t, M) {
    const P = ptsOf(t.d || '')[0] || [[0, 0], [t.w, t.h]];
    let x = 0, y = 0; P.forEach(p => { const q = apply(M, p); x += q[0]; y += q[1]; }); return [x / P.length, y / P.length];
  }
  function finish(parts, screws, joined) {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    const grow = q => { minx = Math.min(minx, q[0]); maxx = Math.max(maxx, q[0]); miny = Math.min(miny, q[1]); maxy = Math.max(maxy, q[1]); };
    for (const p of parts) {
      const P = p.t.d ? ptsOf(p.t.d)[0] : [[0, 0], [p.t.w, 0], [p.t.w, p.t.h], [0, p.t.h]];
      P.forEach(q => grow(apply(p.M, q)));
    }
    let blade = null;
    if (screws) {
      const [s1, s2] = screws[0][0] < screws[1][0] ? screws : [screws[1], screws[0]];
      const arm = parts[0], P = ptsOf(arm.t.d)[0].map(q => apply(arm.M, q));
      // the blade is screwed flat to the bottom edge of the bow, so find that edge under each screw
      const edgeAt = sx => {   // lowest point where a vertical line through the screw crosses the outline
        let e = -Infinity;
        for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; if ((a[0] - sx) * (b[0] - sx) <= 0 && a[0] !== b[0]) e = Math.max(e, a[1] + (sx - a[0]) / (b[0] - a[0]) * (b[1] - a[1])); }
        return e;
      };
      const y = (edgeAt(s1[0]) + edgeAt(s2[0])) / 2;
      blade = { x1: s1[0] - 9, x2: s2[0] + 9, y };
    }
    const T = [1, 0, 0, 1, -minx, -miny];
    parts.forEach(p => p.M = mul(T, p.M));
    if (blade) { blade.x1 -= minx; blade.x2 -= minx; blade.y -= miny; screws = screws.map(s => [s[0] - minx, s[1] - miny]); }
    return { parts, W: maxx - minx, H: maxy - miny, blade, screws, joined };
  }

  // Draw an assembled piece. mode: 'finished' (one piece of wood, holes drilled, blade on) or 'templates'.
  function outlinePts(asm) { const out = []; for (const p of asm.parts) if (p.t.d) ptsOf(p.t.d)[0].forEach(q => out.push(apply(p.M, q))); return out; }
  function piece(asm, cols, mode = 'finished', angleDeg = 0) {
    if (!asm) return '';
    const fin = mode === 'finished', id = nid('p'), m = 4, { W, H } = asm;
    let defs = `<clipPath id="${id}">${asm.parts.map(p => p.t.d ? `<path d="${p.t.d}" transform="${mstr(p.M)}" clip-rule="evenodd"/>` : '').join('')}</clipPath>${shade(id + 'g', false)}
      <linearGradient id="${id}st" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset=".45" stop-color="#d3d9df"/><stop offset=".55" stop-color="#e9edf1"/><stop offset="1" stop-color="#a9b1b9"/></linearGradient>
      <radialGradient id="${id}br" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#f4dca0"/><stop offset="1" stop-color="#9a7630"/></radialGradient>
      <radialGradient id="${id}dish" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#000" stop-opacity=".38"/><stop offset=".7" stop-color="#000" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`;
    // drilled holes (finished only): the 3/4" hole at each handle's punch mark
    const holes = [];
    if (fin) for (const p of asm.parts) if (p.t.group && /handle/.test(p.t.group) && p.t.punches && p.t.punches.length === 1) holes.push({ c: apply(p.M, p.t.punches[0]), r: (p.t.holeDia || 19.05) / 2 });
    const woodW = asm.parts.map(p => p.t.d ? `<path d="${p.t.d}" transform="${mstr(p.M)}" fill-rule="evenodd" fill="#fff" stroke="#fff" stroke-width="${fin ? 0.7 : 0}"/>` : '').join('');
    defs += `<mask id="${id}m" maskUnits="userSpaceOnUse" x="-10" y="-10" width="${W + 20}" height="${H + 20}">${woodW}${holes.map(h => `<circle cx="${h.c[0].toFixed(2)}" cy="${h.c[1].toFixed(2)}" r="${h.r}" fill="#000"/>`).join('')}</mask>`;
    let s = '';
    const wood = asm.parts.map(p => p.t.d ? `<path d="${p.t.d}" transform="${mstr(p.M)}" fill-rule="evenodd"/>` : '').join('');
    // outline: a dark copy underneath, so only the outer edge shows and the seam disappears
    if (fin) s += `<g fill="#1c130d" stroke="#1c130d" stroke-width="1.6" stroke-linejoin="round">${wood}</g>`;
    s += `<g ${fin ? `mask="url(#${id}m)"` : `clip-path="url(#${id})"`}>${bandsAt(cols, outlinePts(asm), (angleDeg || 0) * Math.PI / 180).svg}<rect x="-2" y="-2" width="${W + 4}" height="${H + 4}" fill="url(#${id}g)"/>`;
    if (fin) for (const p of asm.parts) if (p.t.hollowD) s += `<path d="${p.t.hollowD}" transform="${mstr(p.M)}" fill="url(#${id}dish)"/>`;
    s += `</g>`;
    // side view: the blade is seen edge-on, a thin steel line along the bottom of the bow
    if (fin && asm.blade) { const b = asm.blade; s += `<rect x="${b.x1.toFixed(2)}" y="${b.y.toFixed(2)}" width="${(b.x2 - b.x1).toFixed(2)}" height=".9" rx=".3" fill="url(#${id}st)" stroke="#6c747c" stroke-width=".2"/>`; }
    for (const h of holes) s += `<circle cx="${h.c[0].toFixed(2)}" cy="${h.c[1].toFixed(2)}" r="${h.r - 0.4}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1"/>`;
    if (!fin) for (const p of asm.parts) {
      s += `<g transform="${mstr(p.M)}">${strokeOf(p.t)}${p.t.hollowD ? `<path d="${p.t.hollowD}" fill="none" stroke="#e0a96d" stroke-width=".8" stroke-dasharray="3 2"/>` : ''}${(p.t.punches || []).map(q => `<circle cx="${q[0]}" cy="${q[1]}" r="1.3" fill="#e0a96d"/>`).join('')}</g>`;
    }
    return `<svg viewBox="${-m} ${-m} ${W + 2 * m} ${H + 2 * m}" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs>${s}</svg>`;
  }
  // Cutting / serving board preview: edge grain stripes, face grain planks, end grain bricks or chaos blocks.
  function board(style, L, Wd, cols, seed = 1) {
    L = +L || 16; Wd = +Wd || 11;
    const W = 300, H = Math.max(80, Math.min(300, W * Wd / L)), id = nid('b'), r = 10;
    let rnd = seed >>> 0 || 1; const R = () => (rnd = (rnd * 1664525 + 1013904223) >>> 0) / 4294967296;
    let s = '';
    if (style === 'end' || style === 'chaos') {
      const bh = H / Math.max(4, Math.round(Wd * 0.9)), bw = bh * 1.6;
      let k = 0;
      for (let y = 0, row = 0; y < H + bh; y += bh, row++) for (let x = (style === 'end' && row % 2 ? -bw / 2 : 0); x < W + bw; x += bw) {
        const c = style === 'chaos' ? cols[Math.floor(R() * cols.length)] : cols[(k++ + row) % cols.length];
        s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw + .4).toFixed(1)}" height="${(bh + .4).toFixed(1)}" fill="${c.color}"/>`;
        // growth rings on each end-grain block
        const cx = x + bw * (0.2 + R() * 0.6), cy = y + bh * (R() > .5 ? -0.6 : 1.6);
        for (let q = 1; q < 4; q++) s += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(bh * q * 0.45).toFixed(1)}" fill="none" stroke="${c.color2 || c.color}" stroke-width=".7" opacity=".7" clip-path="url(#${id}c${k % 1})"/>`;
      }
      s = `<g>${s}</g>`;
    } else {
      const list = style === 'face' ? cols.slice(0, Math.min(3, cols.length)) : cols;
      s = bands(list, 0, 0, W, H, false);
    }
    return `<svg viewBox="-4 -4 ${W + 8} ${H + 8}" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="${id}"><rect width="${W}" height="${H}" rx="${r}"/></clipPath>${shade(id + 'g', false)}<clipPath id="${id}c0"><rect width="${W}" height="${H}"/></clipPath></defs>
      <rect x="-1" y="-1" width="${W + 2}" height="${H + 2}" rx="${r + 1}" fill="#1c130d"/><g clip-path="url(#${id})">${s}<rect width="${W}" height="${H}" fill="url(#${id}g)"/></g></svg>`;
  }
  return { single, assemble, piece, board, bands, bandsAt, outlinePts, ptsOf, apply };
})();
if (typeof module !== 'undefined') module.exports = D;
