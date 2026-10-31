'use strict';
/* 3D spin view of an assembled piece: the outline extruded with a rounded-over edge,
   lamination strips running through the wood, blade and screws for knives. */

const V3 = (() => {
  let live = null;
  const THICK = 15;          // wood thickness, mm
  const ROUND = 3.2;         // roundover radius, mm

  // The lamination drawn flat with real grain, rendered into a texture (frame from D.bandsAt)
  function woodTexture(cols, fr) {
    const uw = fr.u1 - fr.u0, vh = fr.v1 - fr.v0, ppm = Math.min(6, 4096 / uw, 2048 / vh);
    const c = document.createElement('canvas'); c.width = Math.max(64, Math.round(uw * ppm)); c.height = Math.max(64, Math.round(vh * ppm));
    const g = c.getContext('2d'); g.fillStyle = cols[0].color; g.fillRect(0, 0, c.width, c.height);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    if ('colorSpace' in t) t.colorSpace = THREE.SRGBColorSpace; else t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}" viewBox="${fr.u0} ${fr.v0} ${uw} ${vh}" preserveAspectRatio="none">${GR.laminate(cols, fr.u0, fr.u1, fr.v0, fr.v1)}</svg>`;
    const img = new Image();
    img.onload = () => { g.drawImage(img, 0, 0, c.width, c.height); t.needsUpdate = true; };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return t;
  }

  // Fuse the parts into one outline so the finished piece has no seam (handle + arm = one piece of wood)
  function fused(asm) {
    const holes = [];
    for (const part of asm.parts) if (/handle/.test(part.t.group || '') && part.t.punches && part.t.punches.length === 1) holes.push({ c: D.apply(part.M, part.t.punches[0]), r: (part.t.holeDia || 19.05) / 2 });
    const parts = asm.parts.filter(p => p.t.d).map(p => D.ptsOf(p.t.d).map(L => L.map(q => D.apply(p.M, q))));
    if (typeof ClipperLib === 'undefined' || parts.length < 2) return parts.map(loops => ({ outer: loops[0], holes: loops.slice(1) })).map(x => ({ ...x, drill: holes }));
    const K = 1000, C = ClipperLib, toC = L => L.map(p => ({ X: Math.round(p[0] * K), Y: Math.round(p[1] * K) }));
    let all = [];
    for (const loops of parts) {
      const c = new C.Clipper(), sol = new C.Paths(); c.AddPaths(loops.map(toC), C.PolyType.ptSubject, true);
      c.Execute(C.ClipType.ctUnion, sol, C.PolyFillType.pftEvenOdd, C.PolyFillType.pftEvenOdd);
      const off = new C.ClipperOffset(), grown = new C.Paths(); off.AddPaths(sol, C.JoinType.jtRound, C.EndType.etClosedPolygon); off.Execute(grown, 0.25 * K);
      all = all.concat(grown);
    }
    const u = new C.Clipper(), merged = new C.Paths(); u.AddPaths(all, C.PolyType.ptSubject, true);
    u.Execute(C.ClipType.ctUnion, merged, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
    const off = new C.ClipperOffset(), back = new C.Paths(); off.AddPaths(merged, C.JoinType.jtRound, C.EndType.etClosedPolygon); off.Execute(back, -0.25 * K);
    const from = P => P.map(q => [q.X / K, q.Y / K]);
    const outers = back.filter(P => C.Clipper.Orientation(P)).map(P => ({ outer: from(P), holes: [], drill: [] }));
    const inside = (L, p) => { let c = false; for (let i = 0, j = L.length - 1; i < L.length; j = i++) { if ((L[i][1] > p[1]) !== (L[j][1] > p[1]) && p[0] < (L[j][0] - L[i][0]) * (p[1] - L[i][1]) / (L[j][1] - L[i][1]) + L[i][0]) c = !c; } return c; };
    back.filter(P => !C.Clipper.Orientation(P)).forEach(P => { const h = from(P), o = outers.find(o => inside(o.outer, h[0])); if (o) o.holes.push(h); });
    holes.forEach(h => { const o = outers.find(o => inside(o.outer, h.c)) || outers[0]; if (o) o.drill.push(h); });
    return outers;
  }

  function toShape(outer, loops, holes) {
    const sh = new THREE.Shape(outer.map(p => new THREE.Vector2(p[0], -p[1])));
    loops.forEach(L => sh.holes.push(new THREE.Path(L.map(p => new THREE.Vector2(p[0], -p[1])))));
    holes.forEach(h => { const p = new THREE.Path(); p.absarc(h.c[0], -h.c[1], h.r, 0, Math.PI * 2, true); sh.holes.push(p); });
    return sh;
  }

  function build(asm, cols, angleDeg = 0) {
    const group = new THREE.Group();
    const fr = D.bandsAt(cols, D.outlinePts(asm), angleDeg * Math.PI / 180).frame;
    const woodMat = new THREE.MeshPhongMaterial({ map: woodTexture(cols, fr), shininess: 22, specular: 0x2a2018 });
    for (const piece of fused(asm)) {
      const geo = new THREE.ExtrudeGeometry(toShape(piece.outer, piece.holes, piece.drill), {
        depth: THICK - 2 * ROUND, bevelEnabled: true, bevelThickness: ROUND, bevelSize: ROUND * 0.85, bevelOffset: -ROUND * 0.85, bevelSegments: 5, curveSegments: 18
      });
      geo.translate(0, 0, -(THICK - 2 * ROUND) / 2);
      // strips run through the whole blank at the chosen angle
      const pos = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = -pos.getY(i);
        const u = x * fr.d[0] + y * fr.d[1], v = x * fr.n[0] + y * fr.n[1];
        uv.setXY(i, (u - fr.u0) / (fr.u1 - fr.u0), 1 - (v - fr.v0) / (fr.v1 - fr.v0));
      }
      uv.needsUpdate = true; geo.computeVertexNormals();
      group.add(new THREE.Mesh(geo, woodMat));
    }
    if (asm.blade) {
      // Flat on the bottom edge of the bow; its width runs across the wood and the scallops face sideways.
      const b = asm.blade, half = 5, r = 1.5, step = 2 * r + 1.2;   // about 3/8" wide, narrower than the wood
      const sh = new THREE.Shape();
      sh.moveTo(b.x1, -half); sh.lineTo(b.x2, -half); sh.lineTo(b.x2, half);
      for (let x = b.x2 - 1.2; x - 2 * r > b.x1 + 1.2; x -= step) { sh.lineTo(x, half); sh.absarc(x - r, half, r, 0, Math.PI, true); }
      sh.lineTo(b.x1, half); sh.lineTo(b.x1, -half);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.6, bevelEnabled: false, curveSegments: 8 });
      geo.rotateX(Math.PI / 2);                 // shape's y -> world z, thickness hangs below
      geo.translate(0, -b.y, 0);
      const steel = new THREE.MeshPhongMaterial({ color: 0xd9dee3, specular: 0xffffff, shininess: 120, side: THREE.DoubleSide });
      group.add(new THREE.Mesh(geo, steel));
      if (asm.screws) for (const c of asm.screws) {
        const hd = new THREE.CylinderGeometry(2.1, 2.1, 0.9, 20);
        const h = new THREE.Mesh(hd, new THREE.MeshPhongMaterial({ color: 0xb8bec4, specular: 0xffffff, shininess: 90 }));
        h.position.set(c[0], -b.y - 1.0, 0); group.add(h);
      }
    }
    // center it
    const box = new THREE.Box3().setFromObject(group), ctr = box.getCenter(new THREE.Vector3());
    group.children.forEach(m => m.position.sub(ctr));
    return { group, size: box.getSize(new THREE.Vector3()) };
  }

  // A cutting board: a rounded slab with the pattern on top and bottom, the grain on its sides, feet underneath
  function board(b, colorOf, seed = 1) {
    const MM = 25.4, B = BD.fix(JSON.parse(JSON.stringify(b))), lay = BD.layout(B);
    const L = lay.L * MM, W = lay.W * MM, T = B.T * MM, prof = B.profile || 'square';
    const rad = (prof === 'round' ? .6 : prof === 'chamfer' ? .3 : prof === 'square' ? .12 : .45) * MM;
    const bev = prof === 'round' ? Math.min(6.35, T * .3) : prof === 'chamfer' ? Math.min(4.5, T * .22) : Math.min(1, T * .05);
    const sh = new THREE.Shape(), r = Math.min(rad, L / 2 - 1, W / 2 - 1);
    sh.moveTo(r, 0); sh.lineTo(L - r, 0); sh.absarc(L - r, r, r, -Math.PI / 2, 0); sh.lineTo(L, W - r); sh.absarc(L - r, W - r, r, 0, Math.PI / 2);
    sh.lineTo(r, W); sh.absarc(r, W - r, r, Math.PI / 2, Math.PI); sh.lineTo(0, r); sh.absarc(r, r, r, Math.PI, Math.PI * 1.5);
    const depth = Math.max(1, T - 2 * bev);
    const UV = {
      generateTopUV(g, v, a, b2, c) { return [a, b2, c].map(i => new THREE.Vector2(v[i * 3] / L, 1 - v[i * 3 + 1] / W)); },
      generateSideWallUV(g, v, a, b2, c, d) {
        const P = i => [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]], q = [a, b2, c, d].map(P);
        const mx = q.reduce((s, p) => s + p[0], 0) / 4, my = q.reduce((s, p) => s + p[1], 0) / 4;
        const dist = [my, L - mx, W - my, mx], wi = dist.indexOf(Math.min(...dist));
        const u = p => wi === 0 ? p[0] / L : wi === 1 ? p[1] / W : wi === 2 ? 1 - p[0] / L : 1 - p[1] / W;
        const z = p => Math.min(1, Math.max(0, (p[2] + bev) / (depth + 2 * bev)));
        return q.map(p => new THREE.Vector2(u(p), (wi + .04 + z(p) * .92) / 4));
      }
    };
    const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bev > .2, bevelThickness: bev, bevelSize: bev * .9, bevelOffset: -bev * .9, bevelSegments: prof === 'chamfer' ? 1 : prof === 'round' ? 6 : 2, curveSegments: 10, UVGenerator: UV });
    // top: the drawing itself
    const svg = BD.draw(B, colorOf, seed, { raw: true });
    const tw = 2048, th = Math.max(64, Math.round(tw * W / L));
    const tc = document.createElement('canvas'); tc.width = tw; tc.height = th;
    const tg = tc.getContext('2d'); tg.fillStyle = (colorOf(lay.cells[0].wood) || {}).color || '#9a7b5a'; tg.fillRect(0, 0, tw, th);
    const top = new THREE.CanvasTexture(tc); top.anisotropy = 8;
    if ('colorSpace' in top) top.colorSpace = THREE.SRGBColorSpace; else top.encoding = THREE.sRGBEncoding;
    const img = new Image(); img.onload = () => { tg.drawImage(img, 0, 0, tw, th); top.needsUpdate = true; };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    // sides: the woods along each edge; end grain shows its fibers running up and down
    const sc = document.createElement('canvas'), SW = 1024, SH = 64; sc.width = SW; sc.height = SH * 4;
    const sg = sc.getContext('2d'), end = B.style !== 'edge';
    let R = (seed >>> 0) || 1; const rnd = () => (R = (Math.imul(R, 1664525) + 1013904223) >>> 0) / 4294967296;
    const walls = [
      lay.cells.filter(c => c.y0 < 1e-6).map(c => [c.x0 / lay.L, c.x1 / lay.L, c]),
      lay.cells.filter(c => c.x1 > lay.L - 1e-6).map(c => [c.y0 / lay.W, c.y1 / lay.W, c]),
      lay.cells.filter(c => c.y1 > lay.W - 1e-6).map(c => [1 - c.x1 / lay.L, 1 - c.x0 / lay.L, c]),
      lay.cells.filter(c => c.x0 < 1e-6).map(c => [1 - c.y1 / lay.W, 1 - c.y0 / lay.W, c])];
    walls.forEach((bands, wi) => {
      const y0 = wi * SH;
      for (const [u0, u1, c] of bands) {
        const k = colorOf(c.wood) || { color: '#9a7b5a' }, x0 = u0 * SW, x1 = u1 * SW;
        sg.fillStyle = k.color; sg.fillRect(x0, y0, x1 - x0 + .6, SH);
        sg.strokeStyle = k.color2 || k.color; sg.globalAlpha = .55; sg.lineWidth = 1;
        const along = !end && (wi === 0 || wi === 2);   // edge grain: long sides show the face of the outer strip
        if (along) for (let j = 0; j < 6; j++) { const yy = y0 + SH * (j + .2 + rnd() * .6) / 6; sg.beginPath(); sg.moveTo(x0, yy); sg.bezierCurveTo(x0 + (x1 - x0) * .3, yy + (rnd() - .5) * 4, x0 + (x1 - x0) * .7, yy + (rnd() - .5) * 4, x1, yy); sg.stroke(); }
        else if (end) for (let x = x0 + rnd() * 3; x < x1; x += 2 + rnd() * 4) { sg.beginPath(); sg.moveTo(x, y0); sg.lineTo(x + (rnd() - .5) * 2, y0 + SH); sg.stroke(); }
        else { const cx = (x0 + x1) / 2 + (rnd() - .5) * (x1 - x0), cy = y0 + SH * (rnd() > .5 ? -.6 : 1.6); sg.save(); sg.beginPath(); sg.rect(x0, y0, x1 - x0, SH); sg.clip(); for (let q = 1; q < 9; q++) { sg.beginPath(); sg.arc(cx, cy, q * SH * .28, 0, Math.PI * 2); sg.stroke(); } sg.restore(); }
        sg.globalAlpha = .25; sg.strokeStyle = '#000'; sg.beginPath(); sg.moveTo(x0, y0); sg.lineTo(x0, y0 + SH); sg.stroke(); sg.globalAlpha = 1;
      }
    });
    const side = new THREE.CanvasTexture(sc); side.anisotropy = 8; side.flipY = false;
    if ('colorSpace' in side) side.colorSpace = THREE.SRGBColorSpace; else side.encoding = THREE.sRGBEncoding;
    const mats = [new THREE.MeshPhongMaterial({ map: top, shininess: 26, specular: 0x2a2018 }), new THREE.MeshPhongMaterial({ map: side, shininess: 20, specular: 0x221a14 })];
    const group = new THREE.Group(), slab = new THREE.Mesh(geo, mats);
    slab.position.set(-L / 2, -W / 2, -depth / 2);
    const holder = new THREE.Group(); holder.add(slab);
    if (B.feet) {
      const rub = new THREE.MeshPhongMaterial({ color: 0x1d1d1f, shininess: 8 }), fr = 11, fh = 7, inset = 25.4 + fr;
      for (const [x, y] of [[inset, inset], [L - inset, inset], [inset, W - inset], [L - inset, W - inset]]) {
        const f = new THREE.Mesh(new THREE.CylinderGeometry(fr, fr * .9, fh, 24), rub);
        f.rotation.x = Math.PI / 2; f.position.set(x - L / 2, y - W / 2, -depth / 2 - bev - fh / 2); holder.add(f);
      }
    }
    holder.rotation.x = -Math.PI / 2;   // lying flat; the view tilts it toward you
    group.add(holder);
    return { group, size: new THREE.Vector3(Math.hypot(L, W) * .92, W * .62 + T, T) };
  }

  // A template's STL as it prints: the plate in its filament color, lying flat on a slow turntable
  function stl(buf, color) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(G.parseSTL(buf), 3));
    geo.computeBoundingBox();
    const bb = geo.boundingBox, c = bb.getCenter(new THREE.Vector3()), dims = bb.getSize(new THREE.Vector3());
    geo.translate(-c.x, -c.y, -c.z);
    geo.computeVertexNormals();   // every triangle keeps its own normal, so engraving and edges stay crisp
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).convertSRGBToLinear(), roughness: 0.55, metalness: 0, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    const holder = new THREE.Group(); holder.add(mesh); holder.rotation.x = -Math.PI / 2;   // the print bed is the floor
    const group = new THREE.Group(); group.add(holder);
    const diag = Math.hypot(dims.x, dims.y);
    return { group, size: new THREE.Vector3(diag * 0.94, diag * 0.62 + dims.z, dims.z), dims };
  }
  const freeTree = o => o.traverse(x => { x.geometry?.dispose(); [].concat(x.material || []).forEach(m => { m.map?.dispose?.(); m.dispose?.(); }); });

  function open(asm, cols, title, opts = {}) {
    close();
    if (typeof THREE === 'undefined') return;
    const ov = document.createElement('div'); ov.className = 'v3';
    ov.innerHTML = `<div class="v3top"><div class="v3h"><div class="v3t"></div><div class="v3s" hidden></div></div><button class="v3x" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <canvas></canvas><div class="v3nav" hidden><button class="v3p" aria-label="Previous"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><span class="v3n"></span><button class="v3q" aria-label="Next"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></div><div class="v3hint">Drag to turn it · pinch to zoom · double-tap to reset</div>`;
    document.body.appendChild(ov);
    const canvas = ov.querySelector('canvas');
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
    catch (e) { ov.querySelector('.v3hint').textContent = '3D is not available on this device.'; return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace; else renderer.outputEncoding = THREE.sRGBEncoding;
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(32, 1, 1, 5000);
    scene.add(new THREE.HemisphereLight(0xfff4e6, 0x26221e, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 0.8); key.position.set(-1, 1.4, 2); scene.add(key);
    const rim = new THREE.DirectionalLight(0xffe0c0, 0.35); rim.position.set(1.5, -0.6, -1.5); scene.add(rim);
    const pivot = new THREE.Group(); scene.add(pivot);
    let group = null, size = new THREE.Vector3(1, 1, 1);
    const r0 = [0.25, -0.5]; let rotY = r0[1], rotX = r0[0], zoom = 1, auto = true;
    // Put a model on the stand. Paging through templates swaps the model and keeps the same 3D view open.
    const set = (asm, cols, title, o = {}) => {
      if (group) { pivot.remove(group); freeTree(group); }
      ({ group, size } = typeof asm === 'function' ? asm() : build(asm, cols, o.angle || 0));
      pivot.add(group);
      r0[0] = o.rotX ?? 0.25; r0[1] = o.rotY ?? -0.5; rotX = r0[0]; rotY = r0[1]; zoom = 1; auto = true;
      ov.querySelector('.v3t').innerHTML = title || '';
      const sub = ov.querySelector('.v3s'); sub.innerHTML = o.sub || ''; sub.hidden = !o.sub;
      ov.classList.toggle('light', !!o.light);
      const nav = ov.querySelector('.v3nav'), n = o.nav; nav.hidden = !n || n.count < 2;
      if (n) {
        ov.querySelector('.v3n').textContent = `${n.at + 1} of ${n.count}`;
        const p = ov.querySelector('.v3p'), q = ov.querySelector('.v3q');
        p.disabled = n.at <= 0; q.disabled = n.at >= n.count - 1;
        p.onclick = () => n.go(-1); q.onclick = () => n.go(1);
      }
    };
    set(asm, cols, title, opts);
    const fitDist = () => { const aspect = canvas.clientWidth / canvas.clientHeight; const r = Math.max(size.x / aspect, size.y) * 0.56; return r / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)); };
    const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    resize();
    const pts = new Map(); let last = null, pinch0 = 0, tapT = 0;
    canvas.onpointerdown = e => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); auto = false; last = [e.clientX, e.clientY]; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]) / zoom; } const now = Date.now(); if (now - tapT < 300) { rotX = r0[0]; rotY = r0[1]; zoom = 1; } tapT = now; };
    canvas.onpointermove = e => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { const [a, b] = [...pts.values()]; zoom = Math.min(4, Math.max(0.5, Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch0)); return; }
      rotY += (e.clientX - last[0]) * 0.01; rotX = Math.max(-1.4, Math.min(1.4, rotX + (e.clientY - last[1]) * 0.01)); last = [e.clientX, e.clientY];
    };
    canvas.onpointerup = canvas.onpointercancel = e => { pts.delete(e.pointerId); if (pts.size === 1) last = [...pts.values()][0]; };
    canvas.onwheel = e => { zoom = Math.min(4, Math.max(0.5, zoom * (e.deltaY > 0 ? 0.92 : 1.08))); e.preventDefault(); };
    let raf;
    const loop = () => {
      if (auto) rotY += 0.006;
      pivot.rotation.set(rotX, rotY, 0);
      cam.position.set(0, 0, fitDist() / zoom); cam.lookAt(0, 0, 0);
      renderer.render(scene, cam); raf = requestAnimationFrame(loop);
    };
    loop();
    window.addEventListener('resize', resize);
    ov.querySelector('.v3x').onclick = close;
    live = { ov, renderer, set, stop: () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); freeTree(scene); renderer.dispose(); } };
  }
  // Swap the model in the open 3D view (false when nothing is open)
  function swap(asm, cols, title, opts) { if (!live || !live.set) return false; live.set(asm, cols, title, opts); return true; }
  function close() { if (!live) return false; live.stop(); live.ov.remove(); live = null; return true; }
  return { open, close, swap, board, stl, isOpen: () => !!live };
})();
