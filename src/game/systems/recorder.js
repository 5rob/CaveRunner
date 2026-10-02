// @ts-check
// The death replay (see RP_HZ in replay/replay.js): the recorder, which snapshots the world round you
// RP_HZ a second (and notes every sound), and the player, which rebuilds a moment of a clip — the
// live death's or a saved one (replay/clip.js) — draws it through the real draw() and plays its sounds.
// clipKeep cuts the live clip down and stores it (save/clips.js).

import { SFX } from '../../audio/sfx.js';
import { BH, BW, CELL, CH, CW, PH, PW } from '../../core/consts.js';
import { clamp } from '../../core/util.js';
import { DEV } from '../../dev/knobs.js';
import { SCENE_KEYS, clipCrop, clipHydrate, sfxArgs } from '../../replay/clip.js';
import {
  RP_AFTER, RP_BEFORE, RP_H, RP_HZ, RP_KEEP, RP_W, rpAt, rpClone, rpCut, rpFrame, rpMerge, rpPaste
} from '../../replay/replay.js';
import { clipName, clipPut } from '../../save/clips.js';
import { draw } from '../render/draw.js';
import { holoCount } from '../render/holo.js';

// every partial put on the two terrain canvases (dig, blast, burn, paint) lands in REC.dirty:
// Game wraps their putImageData once, as soon as G is made, before anything draws on them
/** @param {GameCtx} G */
export function recWrap(G) {
  for (const [cx, which] of [[G.tctx, 't'], [G.dctx, 'd']]) {
    // @ts-expect-error the loop's [context, 't'/'d'] rows are read as a union of their elements (noise)
    const put = cx.putImageData.bind(cx);
    // @ts-expect-error the loop's [context, 't'/'d'] rows are read as a union of their elements (noise)
    cx.putImageData = (im, dx, dy, x, y, w, h) => {
      if (w === undefined) return put(im, dx, dy);
      put(im, dx, dy, x, y, w, h);
      // @ts-expect-error the loop's [context, 't'/'d'] rows are read as a union of their elements (noise)
      if (G.REC.tBase && !G.REC.done) G.REC.dirty.push([which, x, y, w, h]);
    };
  }
}

// ---- the sounds: every one-shot the game makes while recording is noted in REC.sfx as
// [t, name, args], and the loops (jet, black holes, fire…) are sampled with each snapshot.
// SFX is wrapped once for the page; SFX0 keeps the real calls, which the player uses ----
export const SFX_REC = ['cast', 'hit', 'rock', 'bounce', 'boom', 'arc', 'debris', 'pop', 'rustle', 'fx', 'creature', 'ui', 'env'];
/** @type {Record<string, (...a: any[]) => any>} */
export const SFX0 = {};
/** @type {GameCtx | null} */
let recG = null;                        // the Game recording (a Restart makes a new one)
const liveLoops = new Set();            // the loops going now, each tagged with an id and its last set()
let loopN = 0;
/** @param {GameCtx} G */
export function recSfxHook(G) {
  recG = G;
  if (SFX0.loop) return;
  /** @type {Record<string, any>} */
  const S = SFX;
  const hearing = () => recG && recG.REC.tBase && !recG.REC.done && !recG.input.current.paused;
  for (const k of SFX_REC) {
    const f = SFX0[k] = S[k];
    S[k] = function () {
      const a = Array.prototype.slice.call(arguments);
      if (hearing()) recG.REC.sfx.push([recG.REC.t, k, sfxArgs(k, a)]);
      return f.apply(null, a);
    };
  }
  const lf = SFX0.loop = S.loop;
  S.loop = kind => {
    const h = lf(kind);
    if (!h) return h;
    const set = h.set, stop = h.stop;
    h._k = kind; h._i = ++loopN;
    h.set = (level, x, y, pitch) => { h._s = [level, x, y, pitch]; h._at = performance.now(); return set(level, x, y, pitch); };
    h.stop = () => { liveLoops.delete(h); return stop(); };
    liveLoops.add(h);
    return h;
  };
}

/** @param {World} W @param {GameCtx} G @param {object} o */
export const idOf = (W, G, o) => { let i = G.rid.get(o); if (i === undefined) G.rid.set(o, i = ++G.ridN); return i; };

/** @param {World} W @param {GameCtx} G */
export function recReset(W, G) {
  G.REC.t = 0; G.REC.acc = 0; G.REC.snaps = []; G.REC.patches = []; G.REC.dirty = []; G.REC.fogLog = []; G.REC.sfx = [];
  G.REC.tBase = W.img.data.slice(); G.REC.dBase = W.dimg ? W.dimg.data.slice() : null;
  G.REC.fogBase = W.seen.slice(); G.REC.fogPrev = W.seen.slice();
  G.REC.deathT = -1; G.REC.done = false;
  G.RT.n = 0; G.RT.at = -1; G.RT.clip = null;
  G.input.current.witness = null;
}
/** @param {World} W @param {GameCtx} G */
export function recSample(W, G) {
  const pcx = W.p.x + PW / 2, pcy = W.p.y + PH / 2;
  const grab = (list, m, ty) => {
    const out = [];
    for (const o of list) {
      const x = o.x !== undefined ? o.x : o.a0x !== undefined ? o.a0x : o.ax;
      const y = ty && o[ty] !== undefined ? o[ty] : o.y !== undefined ? o.y : o.a0y !== undefined ? o.a0y : o.ay;
      if (x === undefined || (Math.abs(x - pcx) < RP_W + m && Math.abs(y - pcy) < RP_H + m)) out.push(rpClone(o, idOf(W, G, o)));
    }
    return out;
  };
  const S = { t: G.REC.t, time: W.time, flick: W.flick, leanX: W.leanX, leanY: W.leanY, glowN: W.glowN, fireN: W.fireN, p: rpClone(W.p),
    ghost: W.ghost ? rpClone(W.ghost) : null, bio: holoCount(W) };   // the hologram's number (the snapshot only holds what's near)
  for (const k in G.RP_ARR) S[k] = grab(G.RP_ARR[k], 40);
  S.enemies = grab(W.enemies, 40, 'ty'); S.pickups = grab(W.pickups, 40); S.props = grab(W.props, 120);
  // the burning pixels in the box, and how much fuel each has left
  const fi = [];
  for (const i of W.fire.list) {
    const x = (i % CW) * CELL, y = ((i / CW) | 0) * CELL;
    if (Math.abs(x - pcx) < RP_W && Math.abs(y - pcy) < RP_H) fi.push(i);
  }
  S.fire = Int32Array.from(fi);
  S.fireT = Uint16Array.from(fi, i => W.fire.t[i]);
  // the sound loops going: [id, kind, level, x, y, pitch]
  const now = performance.now();
  S.loops = [];
  for (const h of liveLoops) if (h._s && now - h._at < 150) S.loops.push([h._i, h._k, h._s[0], h._s[1], h._s[2], h._s[3]]);
  G.REC.snaps.push(S);
  // terrain changed since the last snapshot, as it stands now
  if (G.REC.dirty.length) {
    for (const [w, x, y, ww, hh] of rpMerge(G.REC.dirty, CW, CH)) {
      const src = w === 't' ? W.img : W.dimg;
      if (src) G.REC.patches.push({ t: G.REC.t, c: w, x, y, w: ww, h: hh, px: rpCut(src.data, CW, x, y, ww, hh) });
    }
    G.REC.dirty.length = 0;
  }
  for (let i = 0; i < W.seen.length; i++)
    if (W.seen[i] !== G.REC.fogPrev[i]) { G.REC.fogLog.push(G.REC.t, i, W.seen[i]); G.REC.fogPrev[i] = W.seen[i]; }
  if (G.REC.deathT >= 0) return;
  // alive: drop what's older than RP_KEEP, folding its terrain and fog into the base
  const cut = G.REC.t - RP_KEEP;
  let n = 0;
  while (n < G.REC.snaps.length && G.REC.snaps[n].t < cut) n++;
  if (n) G.REC.snaps.splice(0, n);
  n = 0;
  while (n < G.REC.patches.length && G.REC.patches[n].t < cut) {
    const P = G.REC.patches[n++], base = P.c === 't' ? G.REC.tBase : G.REC.dBase;
    if (base) rpPaste(base, CW, P);
  }
  if (n) G.REC.patches.splice(0, n);
  n = 0;
  while (n < G.REC.fogLog.length && G.REC.fogLog[n] < cut) { G.REC.fogBase[G.REC.fogLog[n + 1]] = G.REC.fogLog[n + 2]; n += 3; }
  if (n) G.REC.fogLog.splice(0, n);
  n = 0;
  while (n < G.REC.sfx.length && G.REC.sfx[n][0] < cut) n++;
  if (n) G.REC.sfx.splice(0, n);
}
// every stepped frame: keep the clock, snapshot RP_HZ a second, and stop RP_AFTER after a death
/** @param {World} W @param {GameCtx} G @param {number} dt */
export function recFrame(W, G, dt) {
  if (G.REC.done || !G.REC.tBase) return;
  G.REC.t += dt;
  if (W.p.dead && G.REC.deathT < 0) G.REC.deathT = G.REC.t;
  if ((G.REC.acc -= dt) > 0) return;
  G.REC.acc = Math.max(0, G.REC.acc + 1 / RP_HZ);
  recSample(W, G);
  if (G.REC.deathT >= 0 && G.REC.t >= G.REC.deathT + RP_AFTER) {
    G.REC.done = true;
    const R = G.REC;
    // the live clip: the recorder's own arrays, which stop changing now
    G.input.current.witness = { t0: Math.max(R.snaps[0].t, R.deathT - RP_BEFORE), t1: R.t, death: R.deathT,
      snaps: R.snaps, patches: R.patches, tBase: R.tBase, dBase: R.dBase, fogBase: R.fogBase, fogLog: R.fogLog, sfx: R.sfx };
    G.input.current.notify();
  }
}

// The clip's terrain, decoration and fog at time T on RT's own canvases, and the rock (RT.mat:
// solid where the terrain's pixel is opaque) so line of sight sees the cave as it was
/** @param {World} W @param {GameCtx} G @param {Clip} C @param {number} T */
export function rpTerrain(W, G, C, T) {
  const RT = G.RT;
  if (!RT.tC) {
    RT.tC = document.createElement('canvas'); RT.tC.width = CW; RT.tC.height = CH;
    RT.dC = document.createElement('canvas'); RT.dC.width = CW; RT.dC.height = CH;
    RT.fireT = new Uint16Array(CW * CH);
    RT.mat = new Uint8Array(CW * CH);
  }
  const tc = RT.tC.getContext('2d'), dc = RT.dC.getContext('2d');
  if (RT.clip !== C || RT.at < 0 || (RT.n > 0 && C.patches[RT.n - 1].t > T)) {     // first look, or scrubbed back
    RT.clip = C;
    tc.putImageData(new ImageData(C.tBase, CW, CH), 0, 0);
    dc.clearRect(0, 0, CW, CH);
    if (C.dBase) dc.putImageData(new ImageData(C.dBase, CW, CH), 0, 0);
    for (let i = 0, k = 3; i < RT.mat.length; i++, k += 4) RT.mat[i] = C.tBase[k] ? 1 : 0;
    RT.n = 0;
  }
  while (RT.n < C.patches.length && C.patches[RT.n].t <= T) {
    const P = C.patches[RT.n++];
    (P.c === 't' ? tc : dc).putImageData(new ImageData(P.px, P.w, P.h), P.x, P.y);
    if (P.c === 't') for (let r = 0; r < P.h; r++)
      for (let c = 0, i = (P.y + r) * CW + P.x, k = r * P.w * 4 + 3; c < P.w; c++, i++, k += 4) RT.mat[i] = P.px[k] ? 1 : 0;
  }
  RT.at = T;
  if (!RT.fog || RT.fog.length !== C.fogBase.length) RT.fog = new Uint8Array(C.fogBase.length);
  RT.fog.set(C.fogBase);
  const L = C.fogLog;
  for (let n = 0; n < L.length && L[n] <= T; n += 3) RT.fog[L[n + 1]] = L[n + 2];
}
/** @param {World} W @param {GameCtx} G @param {ReplayView} V */
export function drawReplay(W, G, V) {
  const C = V.clip;
  V.t = clamp(V.t, C.t0, C.t1);
  const F = rpFrame(C.snaps, V.t);
  rpTerrain(W, G, C, V.t);
  if (!V.fog) G.RT.fog.fill(1);          // fog off: everything counts as seen, and no overlay
  if (V.follow) { V.cx = F.p.x + PW / 2; V.cy = F.p.y + PH / 2; }
  else if (C.lim) {                      // a saved clip only kept so much round your path
    V.zoom = Math.max(1, V.zoom);
    V.cx = clamp(V.cx, C.lim[0], C.lim[2]); V.cy = clamp(V.cy, C.lim[1], C.lim[3]);
  }
  const near = F.near;
  V.bio = near.bio;                      // the hologram shows the count as it was (holo.js)
  for (let k = 0; k < near.fire.length; k++) G.RT.fireT[near.fire[k]] = near.fireT[k];
  // swap the recording in
  const keepL = {};
  for (const k in G.RP_ARR) { const L = G.RP_ARR[k]; keepL[k] = L.splice(0, L.length, ...F[k]); }
  const keep = { enemies: W.enemies, pickups: W.pickups, props: W.props, fire: W.fire, firePlants: W.firePlants, seen: W.seen, ghost: W.ghost, time: W.time, flick: W.flick, leanX: W.leanX, leanY: W.leanY, glowN: W.glowN,
    fireN: W.fireN, camX: W.camX, camY: W.camY, unitPx: W.unitPx, torchR: W.torchR, visPts: W.visPts, viewW: W.viewW, viewH: W.viewH, mat: W.mat, deepFog: W.deepFog,
    p: Object.assign({}, W.p) };
  // a saved clip brings its floor: the theme, the portals, the shop, the background, the gun in hand
  const keepS = {}, scene = C.scene, LO = G.input.current.loadout, bg = G.bg;
  if (scene) {
    for (const k of SCENE_KEYS) { keepS[k] = W[k]; W[k] = scene[k]; }
    W.deepFog = null;
    if (C.bgC) G.bg = C.bgC;
    G.input.current.loadout = Object.assign({}, LO, { guns: [scene.held || null], sel: 0 });
  }
  W.enemies = F.enemies; W.pickups = F.pickups; W.props = F.props; W.firePlants = [];
  // @ts-expect-error the replay's stand-in fire: only the burning pixels draw() reads, no fuel (noise)
  W.fire = { list: near.fire, t: G.RT.fireT }; W.seen = G.RT.fog; W.mat = G.RT.mat;
  W.ghost = F.ghost; W.time = F.time; W.flick = F.flick; W.leanX = F.leanX; W.leanY = F.leanY; W.glowN = F.glowN; W.fireN = near.fireN;
  Object.assign(W.p, F.p);
  if (!F.p.rag) W.p.rag = null;
  G.RPV = V;
  try { draw(W, G); } finally {
    // and the live world back, exactly as it was
    G.RPV = null;
    for (const k in G.RP_ARR) { const L = G.RP_ARR[k]; L.splice(0, L.length, ...keepL[k]); }
    ({ enemies: W.enemies, pickups: W.pickups, props: W.props, fire: W.fire, firePlants: W.firePlants, seen: W.seen, ghost: W.ghost, time: W.time, flick: W.flick, leanX: W.leanX, leanY: W.leanY, glowN: W.glowN,
      fireN: W.fireN, camX: W.camX, camY: W.camY, unitPx: W.unitPx, torchR: W.torchR, visPts: W.visPts, viewW: W.viewW, viewH: W.viewH, mat: W.mat, deepFog: W.deepFog } = keep);
    for (const k in W.p) if (!(k in keep.p)) delete W.p[k];
    Object.assign(W.p, keep.p);
    if (scene) {
      for (const k of SCENE_KEYS) W[k] = keepS[k];
      G.bg = bg; G.input.current.loadout = LO;
    }
    for (let k = 0; k < near.fire.length; k++) G.RT.fireT[near.fire[k]] = 0;
  }
}

// The replay's sounds, as its clock runs from `prev` to V.t: the one-shots in between, heard from
// where you were, and the loops as the nearest snapshot had them. A scrub, a jump or a pause is silent.
/** @param {GameCtx} G @param {ReplayView} V @param {number} prev */
export function rpSound(G, V, prev) {
  const C = V.clip;
  if (!V.playing || V.mute || V.t < prev || V.t - prev > 0.5 || !C.sfx) return;
  const { a } = rpAt(C.snaps, V.t);
  SFX.ear(a.p.x + PW / 2, a.p.y + PH / 2);
  for (const e of C.sfx) if (e[0] > prev && e[0] <= V.t) {
    const f = SFX0[e[1]] || SFX[e[1]];
    if (f) f.apply(null, e[2]);
  }
  for (const L of a.loops || []) {
    let h = G.RT.loops.get(L[0]);
    if (!h) { h = (SFX0.loop || SFX.loop)(L[1]); if (!h) continue; G.RT.loops.set(L[0], h); }
    h.set(L[2], L[3], L[4], L[5]);
  }
}
// the replay is over (or another clip is up): its loops stop
/** @param {GameCtx} G */
export function rpSoundOff(G) {
  for (const h of G.RT.loops.values()) try { h.stop(); } catch (_) {}
  G.RT.loops.clear();
}

// ---- saved clips ----
// Keep a clip: cut to the box round your path (DEV.witPad past it), with this floor's scene and
// background, a thumbnail of the moment of death, into the store. Resolves to its gallery card.
/** @param {World} W @param {GameCtx} G @param {Clip} C @returns {Promise<ClipMeta | null>} */
export async function clipKeep(W, G, C) {
  const scene = {};
  for (const k of SCENE_KEYS) scene[k] = W[k];
  const LO = G.input.current.loadout;
  scene.held = LO.guns[LO.sel] || null;
  const bg = G.bgctx.getImageData(0, 0, BW, BH).data;
  const S = clipCrop(C, { pad: DEV.witPad, scene, bg, bgW: BW, bgH: BH });
  const date = Date.now();
  const meta = { id: 'c' + date.toString(36) + Math.floor(Math.random() * 1e4).toString(36), name: clipName(W.floor, date), date,
    floor: W.floor, secs: Math.round((C.t1 - C.t0) * 10) / 10, bytes: 0, thumb: clipThumb(W, G, C) };
  return (await clipPut(meta, S)) ? meta : null;
}
// a small picture of the moment of death: the replay drawn there, the play area cut from the canvas
/** @param {World} W @param {GameCtx} G @param {Clip} C @returns {string} */
export function clipThumb(W, G, C) {
  try {
    const live = G.input.current.replay;
    /** @type {ReplayView} */
    const V = { t: C.death + 0.3, speed: 1, playing: false, fog: true, follow: true, zoom: 1, cx: 0, cy: 0, clip: C,
      panelH: live ? live.panelH : 0 };
    drawReplay(W, G, V);
    G.RT.at = -1;                        // the next frame rebuilds its own moment
    const ph = Math.max(1, Math.round(V.playPx || G.c.height)), w = 200, h = Math.max(1, Math.round(w * Math.min(1.6, ph / G.c.width)));
    const t = document.createElement('canvas'); t.width = w; t.height = h;
    const sh = Math.min(ph, G.c.width * h / w), sy = Math.max(0, (ph - sh) / 2);
    t.getContext('2d').drawImage(G.c, 0, sy, G.c.width, sh, 0, 0, w, h);
    return t.toDataURL('image/jpeg', 0.7);
  } catch (_) { return ''; }
}
// a stored clip, ready to play: world-size arrays and its background on a canvas
/** @param {SavedClip} S @returns {Clip} */
export function clipFromSaved(S) {
  const C = clipHydrate(S);
  if (C.bgPx && C.bgW) {
    const c = document.createElement('canvas'); c.width = C.bgW; c.height = C.bgH;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(C.bgPx), C.bgW, C.bgH), 0, 0);
    C.bgC = c;
  }
  return C;
}
