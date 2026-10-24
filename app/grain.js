'use strict';
/* Wood figure for the drawings: each species gets its own grain style (stripes, ribbon, fleck, curl,
   birdseye, spalting, burl, open pores). Drawn in a local frame where the grain runs along x. */

const GR = (() => {
  // Species -> grain style. Anything not listed gets plain straight grain.
  const STYLE = {
    stripe: ['zebrawood', 'macassar-ebony', 'tigerwood', 'goncalo', 'marblewood', 'ovangkol', 'limba', 'bocote', 'ziricote', 'cocobolo', 'kingwood', 'tulipwood-br', 'rosewood', 'pau-ferro', 'granadillo', 'white-ash-olive', 'wenge', 'bubinga', 'honduran-rosewood', 'canarywood', 'curupay', 'mopane'],
    ribbon: ['sapele', 'sapele-quartered', 'khaya', 'sipo', 'makore', 'anigre', 'avodire', 'santos-mahogany', 'honduran-mahogany', 'mahogany', 'afzelia', 'muninga', 'narra', 'padauk', 'jatoba'],
    fleck: ['lacewood', 'leopardwood', 'oak-quartersawn', 'sycamore', 'snakewood', 'bocote-black', 'beech'],
    curl: ['curly-maple', 'quilted-maple', 'koa'],
    birdseye: ['birdseye'],
    spalt: ['spalted-maple', 'cherry-spalted', 'tamarind', 'ambrosia-maple', 'mango', 'olive', 'box-elder'],
    burl: ['walnut-burl', 'maple-burl', 'buckeye-burl'],
    pores: ['oak-white', 'oak-red', 'oak-english', 'oak-live', 'ash', 'hickory', 'pecan', 'hickory-pecan', 'elm', 'red-elm', 'chestnut', 'catalpa', 'sassafras', 'iroko', 'teak', 'cumaru', 'ipe', 'douglas-fir', 'pine']
  };
  const BY_ID = {};
  for (const [st, ids] of Object.entries(STYLE)) ids.forEach(id => BY_ID[id] = st);
  const styleOf = c => (c && (c.grain || BY_ID[c.id])) || 'straight';
  const NAMES = { straight: 'Straight', stripe: 'Striped', ribbon: 'Ribbon', fleck: 'Fleck', curl: 'Curly', birdseye: 'Birdseye', spalt: 'Spalted', burl: 'Burl', pores: 'Open grain' };

  let on = true;
  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
  function hash(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
  const f = n => n.toFixed(2);
  const dark = hex => { const n = parseInt((hex || '#000000').slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 90; };

  // A gently wavy line along x at height y
  function wave(R, x0, x1, y, amp, step = 26) {
    let d = `M${f(x0)},${f(y)}`, py = y;
    for (let x = x0 + step; x < x1 + step; x += step) {
      const ny = y + (R() - .5) * 2 * amp;
      d += ` Q${f(x - step / 2)},${f(py + (R() - .5) * amp)} ${f(Math.min(x, x1))},${f(ny)}`; py = ny;
    }
    return d;
  }

  // Grain inside one strip: x0..x1 along the grain, y0..y1 across it
  function strip(c, x0, x1, y0, y1, seed) {
    if (!on) return '';
    const R = rng(seed), st = styleOf(c), h = y1 - y0, len = x1 - x0, c2 = c.color2 || c.color;
    let s = '';
    const lines = (k, width, op, amp = .35, col = c2) => {
      for (let j = 0; j < k; j++) {
        const y = y0 + h * (j + .25 + R() * .5) / k;
        s += `<path d="${wave(R, x0, x1, y, amp)}" fill="none" stroke="${col}" stroke-width="${f(width * (.6 + R() * .8))}" opacity="${op}"/>`;
      }
    };
    const area = len * h;
    switch (st) {
      case 'stripe': {
        const k = Math.max(3, Math.round(h / 1.4));
        for (let j = 0; j < k; j++) {
          const y = y0 + h * (j + R() * .8) / k, w = .35 + R() * 1.5;
          s += `<path d="${wave(R, x0, x1, y, .7, 18)}" fill="none" stroke="${c2}" stroke-width="${f(w)}" opacity=".9"/>`;
        }
        break;
      }
      case 'ribbon': {
        const k = Math.max(2, Math.round(h / 2.2));
        for (let j = 0; j < k; j++) s += `<rect x="${f(x0)}" y="${f(y0 + h * j / k)}" width="${f(len)}" height="${f(h / k + .1)}" fill="${j % 2 ? '#000' : '#fff'}" opacity=".09"/>`;
        lines(Math.max(2, Math.round(h / 3)), .35, .45, .2);
        break;
      }
      case 'fleck': {
        lines(Math.max(2, Math.round(h / 3)), .3, .4, .25);
        const n = Math.min(400, Math.round(area / 22));
        for (let i = 0; i < n; i++) s += `<ellipse cx="${f(x0 + R() * len)}" cy="${f(y0 + R() * h)}" rx="${f(.8 + R() * 1.8)}" ry="${f(.25 + R() * .35)}" fill="${c2}" opacity=".75"/>`;
        break;
      }
      case 'curl': {
        lines(Math.max(2, Math.round(h / 3)), .3, .35, .2);
        for (let x = x0 + R() * 3; x < x1; x += 2.6 + R() * 2.4) {
          const w = 1 + R() * 1.6, sk = 1.2;
          s += `<polygon points="${f(x)},${f(y0)} ${f(x + w)},${f(y0)} ${f(x + w + sk)},${f(y1)} ${f(x + sk)},${f(y1)}" fill="${R() > .5 ? '#fff' : '#000'}" opacity=".13"/>`;
        }
        break;
      }
      case 'birdseye': {
        lines(Math.max(2, Math.round(h / 3)), .3, .35, .2);
        const n = Math.min(400, Math.round(area / 16));
        for (let i = 0; i < n; i++) { const cx = x0 + R() * len, cy = y0 + R() * h, r = .35 + R() * .45; s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${c2}" opacity=".8"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 2.2)}" fill="none" stroke="${c2}" stroke-width=".2" opacity=".5"/>`; }
        break;
      }
      case 'spalt': {
        lines(Math.max(2, Math.round(h / 3)), .3, .3, .2);
        const ink = dark(c2) ? c2 : '#2a221c';
        const n = 2 + Math.round(R() * 2 + len / 140);
        for (let i = 0; i < n; i++) {
          let x = x0 + R() * len, y = y0 + R() * h, d = `M${f(x)},${f(y)}`;
          for (let k = 0; k < 14; k++) { x += (R() - .3) * 9; y = Math.max(y0, Math.min(y1, y + (R() - .5) * 4)); d += ` L${f(x)},${f(y)}`; }
          s += `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${f(.3 + R() * .5)}" opacity=".8" stroke-linejoin="round"/>`;
        }
        break;
      }
      case 'burl': {
        const n = Math.min(300, Math.round(area / 12));
        for (let i = 0; i < n; i++) {
          const cx = x0 + R() * len, cy = y0 + R() * h, r = .5 + R() * 1.8, a = R() * 6.28;
          s += `<path d="M${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))} A${f(r)},${f(r * .7)} 0 1 1 ${f(cx + r * Math.cos(a + 4))},${f(cy + r * Math.sin(a + 4))}" fill="none" stroke="${c2}" stroke-width=".3" opacity=".7"/>`;
          if (R() > .7) s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(.3 + R() * .3)}" fill="${c2}" opacity=".8"/>`;
        }
        break;
      }
      case 'pores': {
        lines(Math.max(2, Math.round(h / 2.5)), .35, .55, .3);
        const n = Math.min(500, Math.round(area / 10));
        for (let i = 0; i < n; i++) { const x = x0 + R() * len, y = y0 + R() * h; s += `<path d="M${f(x)},${f(y)} h${f(1.2 + R() * 2.5)}" stroke="#000" stroke-width=".28" opacity=".22"/>`; }
        break;
      }
      case 'tight': {   // edge grain: quartered look, tight parallel lines
        lines(Math.max(3, Math.round(h / 1.1)), .3, .55, .12);
        break;
      }
      case 'cathedral': {   // face grain on flat-sawn boards: nested rounded arches (cathedrals) along the length
        lines(2, .3, .3, .15);
        const rings = Math.max(5, Math.min(11, Math.round(h * 1.6)));
        let px = x0 + len * (.35 + R() * .3);
        const peaks = [px]; if (len / h > 5) peaks.push(px + len * (.3 + R() * .2) * (R() > .5 ? 1 : -1));
        for (const p of peaks) {
          const yc = y0 + h * (.4 + R() * .2);
          for (let k = 1; k <= rings; k++) {
            const half = h * .48 * k / rings, run = half * 1.6 + h * .3, tip = p - (rings - k) * h * (.16 + R() * .06);
            const yA = Math.max(y0, yc - half), yB = Math.min(y1, yc + half);
            s += `<path d="M${f(tip - run * 2.2)},${f(yA)} L${f(tip - run)},${f(yA)} C${f(tip - run * .35)},${f(yA)} ${f(tip)},${f(yc - half * .55)} ${f(tip)},${f(yc)} C${f(tip)},${f(yc + half * .55)} ${f(tip - run * .35)},${f(yB)} ${f(tip - run)},${f(yB)} L${f(tip - run * 2.2)},${f(yB)}" fill="none" stroke="${c2}" stroke-width="${f(h * .012 + .12 + R() * .1)}" opacity=".6"/>`;
          }
        }
        break;
      }
      default:
        lines(Math.max(2, Math.round(h / 2.2)), .4, .6, .35);
    }
    return s;
  }

  // A lamination of strips filling v0..v1 (local frame), grain along u
  function laminate(cols, u0, u1, v0, v1, seed = 7) {
    // strips can carry a width (c.w); otherwise they share the blank evenly
    const tot = cols.reduce((t, c) => t + (c.w > 0 ? c.w : 1), 0);
    let s = '', a = v0;
    cols.forEach((c, i) => {
      const bw = (v1 - v0) * (c.w > 0 ? c.w : 1) / tot;
      s += `<rect x="${f(u0)}" y="${f(a)}" width="${f(u1 - u0)}" height="${f(bw + .6)}" fill="${c.color}"/>`;
      s += strip(c, u0, u1, a, a + bw, seed + i * 7919 + hash(c.id || c.color));
      a += bw;
    });
    return s;
  }
  return { strip, laminate, styleOf, NAMES, STYLE, set on(v) { on = !!v; }, get on() { return on; }, hash };
})();
if (typeof module !== 'undefined') module.exports = GR;
