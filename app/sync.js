'use strict';
/* Sync: the same pieces on the phone and on a computer.
   Everything goes through a private GitHub repo ("bench-data") that only the owner's code can open.
   state.json holds the pieces and settings, photos/<id> holds each photo.
   Each side remembers when it last changed every piece; the newer change wins, piece by piece. */

const SYK = 'bench.sync';
const SY = (() => { try { return JSON.parse(localStorage.getItem(SYK)) || {}; } catch (e) { return {}; } })();
SY.k ??= {}; SY.p ??= {}; SY.del ??= {};
const sySave = () => { try { localStorage.setItem(SYK, JSON.stringify(SY)); } catch (e) {} };
// Each setting counts on its own, so changing one on each device doesn't clash. The sign-in code stays on its device.
const syKeys = () => [...Object.keys(S).filter(k => !['pieces', 'version', 'settings'].includes(k)), ...Object.keys(S.settings).filter(f => f !== 'gh' && f !== 'theme').map(f => 'settings.' + f)];   // light or dark stays per device
const syGet = k => k.startsWith('settings.') ? S.settings[k.slice(9)] : S[k];
const sySet = (k, v) => { if (k.startsWith('settings.')) S.settings[k.slice(9)] = v; else S[k] = v; };
const syUtf8b64 = str => { const u = new TextEncoder().encode(str); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const syRepo = () => { const g = S.settings.gh; return `/repos/${g.owner}/${g.data}`; };

// Note what changed on this device since last time
function syTouch() {
  const now = Date.now(); let changed = false;
  for (const k of syKeys()) { const h = strHash(JSON.stringify(syGet(k) ?? null)); if (!SY.k[k] || SY.k[k].h !== h) { SY.k[k] = { h, t: now }; changed = true; } }
  const ids = new Set();
  for (const p of S.pieces) { ids.add(p.id); const h = strHash(JSON.stringify(p)); if (!SY.p[p.id] || SY.p[p.id].h !== h) { SY.p[p.id] = { h, t: now }; changed = true; } }
  for (const id of Object.keys(SY.p)) if (!ids.has(id)) { delete SY.p[id]; SY.del[id] = now; changed = true; }
  for (const id of Object.keys(SY.del)) if (now - SY.del[id] > 90 * 864e5) delete SY.del[id];
  if (changed) sySave();
  return changed;
}

const syBuild = () => ({ v: 1, rev: Date.now(), k: SY.k, p: SY.p, del: SY.del, version: S.version, state: Object.fromEntries(syKeys().map(k => [k, syGet(k)])), pieces: S.pieces });

// Make sure the private repo exists
async function syEnsure() {
  const g = S.settings.gh; if (g.data) return;
  const name = 'bench-data';
  try { const r = await gh(`/repos/${g.owner}/${name}`); g.data = name; g.dataBranch = r.default_branch || 'main'; }
  catch (e) {
    if (e.status !== 404) throw e;
    const r = await gh('/user/repos', { method: 'POST', body: { name, private: true, auto_init: true, description: 'Bench pieces and photos (private)', has_issues: false, has_wiki: false, has_projects: false } });
    g.data = name; g.dataBranch = r.default_branch || 'main';
  }
  save();
}

async function syFetch() {
  const g = S.settings.gh;
  try {
    const r = await gh(`${syRepo()}/contents/state.json`);
    let text;
    if (r.content && r.encoding === 'base64') text = new TextDecoder().decode(Uint8Array.from(atob(r.content.replace(/\s/g, '')), c => c.charCodeAt(0)));
    else { const raw = await fetch(`https://api.github.com${syRepo()}/contents/state.json`, { headers: { Authorization: 'Bearer ' + g.token, Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' }); text = await raw.text(); }
    return { doc: JSON.parse(text), sha: r.sha };
  } catch (e) { if (e.status === 404) return null; throw e; }
}

// Fold the other device's changes into this one. Returns what to do next.
function syMerge(R) {
  let changedLocal = false, needPush = false;
  const fresh = !SY.synced;
  // Settings, woods, stock and so on: the newer change wins
  for (const k of Object.keys(R.state)) {
    const rm = R.k[k], lm = SY.k[k], rv = R.state[k];
    if (syGet(k) === undefined) { sySet(k, rv); if (rm) SY.k[k] = rm; changedLocal = true; continue; }
    if (rm && lm && rm.h === lm.h) continue;
    const remoteWins = fresh || !lm || (rm && rm.t > lm.t);
    if (remoteWins) { sySet(k, rv); if (rm) SY.k[k] = rm; changedLocal = true; }
    else needPush = true;
  }
  for (const k of syKeys()) if (!(k in R.state)) needPush = true;
  // Pieces: one at a time
  const rp = new Map(R.pieces.map(p => [p.id, p])), lp = new Map(S.pieces.map(p => [p.id, p]));
  const order = [...S.pieces.map(p => p.id), ...R.pieces.map(p => p.id).filter(id => !lp.has(id))], out = [];
  for (const id of order) {
    const r = rp.get(id), l = lp.get(id), rm = R.p[id], lm = SY.p[id], rdel = R.del[id] || 0, ldel = SY.del[id] || 0;
    if (r && l) {
      if (rm && lm && rm.h === lm.h) out.push(l);
      else if (fresh || !lm || (rm && rm.t > lm.t)) { out.push(r); if (rm) SY.p[id] = rm; changedLocal = true; }
      else { out.push(l); needPush = true; }
    } else if (r) {
      if (ldel > (rm ? rm.t : 0)) needPush = true;                       // removed here after the last edit there
      else { out.push(r); if (rm) SY.p[id] = rm; changedLocal = true; }   // new from the other device
    } else {
      if (rdel > (lm ? lm.t : 0)) { delete SY.p[id]; changedLocal = true; }   // removed on the other device
      else { out.push(l); needPush = true; }                              // new here
    }
  }
  S.pieces = out;
  for (const [id, t] of Object.entries(R.del)) if (!(id in SY.del) || SY.del[id] < t) SY.del[id] = t;
  for (const id of Object.keys(SY.del)) if (!(id in R.del)) needPush = true;
  if (S.pieces.some(p => p.no != null) && changedLocal) S.settings.nextNumber = Math.max(S.settings.nextNumber || 1, ...S.pieces.map(p => p.no + 1));
  if (R.version && R.version > (S.version || 0)) S.version = R.version;
  return { changedLocal, needPush };
}

function syApply() {
  const g = S.settings.gh;
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  load(); S.settings.gh = g;
  const top = stack[stack.length - 1], editing = top && /^(editPiece|combo|boardEditor)/.test(top.view);
  if (!editing && $('#sheet').hidden) render(true);
}

async function syPut(sha) {
  const body = { message: 'Sync ' + new Date().toISOString().slice(0, 16).replace('T', ' '), content: syUtf8b64(JSON.stringify(syBuild())), branch: S.settings.gh.dataBranch || 'main' };
  if (sha) body.sha = sha;
  await gh(`${syRepo()}/contents/state.json`, { method: 'PUT', body, timeout: 60000 });
}

async function syPhotos() {
  const ids = new Set(); S.pieces.forEach(p => { (p.photos || []).forEach(i => ids.add(i)); (p.buildPhotos || []).forEach(b => ids.add(b.id)); });
  (S.projects || []).forEach(q => (q.photos || []).forEach(i => ids.add(i)));
  if (!ids.size) return false;
  const remote = new Set();
  try { (await gh(`${syRepo()}/contents/photos`)).forEach(f => remote.add(f.name)); } catch (e) { if (e.status !== 404) throw e; }
  let moved = 0, got = false; const g = S.settings.gh;
  for (const id of ids) {
    if (moved >= 12) { SY.more = true; break; }
    const have = await photoGet(id);
    if (have && !remote.has(id)) {
      await gh(`${syRepo()}/contents/photos/${id}`, { method: 'PUT', body: { message: 'Photo', content: syUtf8b64(have), branch: g.dataBranch || 'main' }, timeout: 60000 }); moved++;
    } else if (!have && remote.has(id)) {
      const r = await fetch(`https://api.github.com${syRepo()}/contents/photos/${id}`, { headers: { Authorization: 'Bearer ' + g.token, Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' });
      if (r.ok) { await photoPut(id, await r.text()); moved++; got = true; }
    }
  }
  return got;
}

let syBusy = false, syAgain = false, syTimer = null;
async function syncNow() {
  if (!ghOn()) return;
  if (syBusy) { syAgain = true; return; }
  syBusy = true; SY.err = '';
  try {
    await syEnsure();
    for (let i = 0; i < 4; i++) {
      syTouch();
      const remote = await syFetch();
      let push = true, sha = null;
      if (remote) { sha = remote.sha; const m = syMerge(remote.doc); push = m.needPush; if (m.changedLocal) { syApply(); syTouch(); } }
      if (push) { try { await syPut(sha); } catch (e) { if (e.status === 409 || e.status === 422) continue; throw e; } }
      SY.synced = true; SY.last = Date.now(); break;
    }
    if (await syPhotos()) { const top = stack[stack.length - 1]; if (!/^(editPiece|combo)/.test(top?.view || '') && $('#sheet').hidden) render(true); }
  } catch (e) {
    SY.err = e.status === 401 ? 'The sign-in code stopped working. Set up the story page again in Shop.' : 'Waiting for the internet';
  } finally { syBusy = false; sySave(); syShow(); if (syAgain) { syAgain = false; syQueue(1500); } }
}
function syQueue(ms = 5000) { if (!ghOn()) return; clearTimeout(syTimer); syTimer = setTimeout(syncNow, ms); }

// Anything saved on this device goes up a few seconds later
{
  const plainSave = save;
  save = function () { plainSave.apply(this, arguments); if (ghOn()) { syTouch(); syQueue(); } };   // stamp the change now, upload a few seconds later
}
const syAgo = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hr ago` : `${Math.round(m / 1440)} days ago`; };
function syShow() { const el = $('#syStat'); if (el) el.textContent = SY.err || (SY.last ? 'Synced ' + syAgo(SY.last) : 'Not synced yet'); }

// The link that signs a computer in. The code sits after the # so it never goes to any server.
const computerLink = () => { const g = S.settings.gh; return `https://${g.repo}/${g.dir}app/#k=${encodeURIComponent(g.token)}&o=${encodeURIComponent(g.owner)}&r=${encodeURIComponent(g.repo)}&d=${encodeURIComponent(g.dir)}&b=${encodeURIComponent(g.branch)}`; };

// Opened from that link? Sign in and pull everything down.
function syLoginFromLink() {
  const h = location.hash; if (!/^#k=/.test(h)) return false;
  const q = new URLSearchParams(h.slice(1)), token = q.get('k'), owner = q.get('o'), repo = q.get('r');
  history.replaceState(null, '', location.pathname + location.search);
  if (!token || !owner || !repo) return false;
  S.settings.gh = { token, owner, repo, branch: q.get('b') || 'main', dir: q.get('d') || '', pageVer: pageVersion(), data: '' };
  S.settings.pageUrl = `https://${repo}/${S.settings.gh.dir}`;
  save(); toast('Signing in…'); syncNow().then(() => { if (!SY.err) toast('Your pieces are here'); });
  return true;
}

document.addEventListener('visibilitychange', () => { if (!document.hidden && ghOn() && (!SY.last || Date.now() - SY.last > 20000)) syncNow(); });
window.addEventListener('online', () => syQueue(500));
if (!syLoginFromLink() && ghOn()) setTimeout(syncNow, 2500);
setInterval(syShow, 30000);
