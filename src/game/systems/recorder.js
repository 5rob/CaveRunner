// The death replay (see RP_HZ in replay/replay.js): the recorder, which snapshots the world round you
// RP_HZ a second, and the player, which rebuilds a moment and draws it through the real draw().

import { CELL, CH, CW, PH, PW } from '../../core/consts.js';
import { clamp } from '../../core/util.js';
import {
  RP_AFTER, RP_BEFORE, RP_H, RP_HZ, RP_KEEP, RP_W, rpClone, rpCut, rpFrame, rpMerge, rpPaste
} from '../../replay/replay.js';
import { draw } from '../render/draw.js';

// every partial put on the two terrain canvases (dig, blast, burn, paint) lands in REC.dirty:
// Game wraps their putImageData once, as soon as G is made, before anything draws on them
export function recWrap(G) {
  for (const [cx, which] of [[G.tctx, 't'], [G.dctx, 'd']]) {
    const put = cx.putImageData.bind(cx);
    cx.putImageData = (im, dx, dy, x, y, w, h) => {
      if (w === undefined) return put(im, dx, dy);
      put(im, dx, dy, x, y, w, h);
      if (G.REC.tBase && !G.REC.done) G.REC.dirty.push([which, x, y, w, h]);
    };
  }
}

export const idOf = (W, G, o) => { let i = G.rid.get(o); if (i === undefined) G.rid.set(o, i = ++G.ridN); return i; };

export function recReset(W, G) {
  G.REC.t = 0; G.REC.acc = 0; G.REC.snaps = []; G.REC.patches = []; G.REC.dirty = []; G.REC.fogLog = [];
  G.REC.tBase = W.img.data.slice(); G.REC.dBase = W.dimg ? W.dimg.data.slice() : null;
  G.REC.fogBase = W.seen.slice(); G.REC.fogPrev = W.seen.slice();
  G.REC.deathT = -1; G.REC.done = false;
  G.RT.n = 0; G.RT.at = -1;
  G.input.current.witness = null;
}
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
    ghost: W.ghost ? rpClone(W.ghost) : null };
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
}
// every stepped frame: keep the clock, snapshot RP_HZ a second, and stop RP_AFTER after a death
export function recFrame(W, G, dt) {
  if (G.REC.done || !G.REC.tBase) return;
  G.REC.t += dt;
  if (W.p.dead && G.REC.deathT < 0) G.REC.deathT = G.REC.t;
  if ((G.REC.acc -= dt) > 0) return;
  G.REC.acc = Math.max(0, G.REC.acc + 1 / RP_HZ);
  recSample(W, G);
  if (G.REC.deathT >= 0 && G.REC.t >= G.REC.deathT + RP_AFTER) {
    G.REC.done = true;
    G.input.current.witness = { t0: Math.max(G.REC.snaps[0].t, G.REC.deathT - RP_BEFORE), t1: G.REC.t, death: G.REC.deathT };
    G.input.current.notify();
  }
}

export function rpTerrain(W, G, T) {
  if (!G.RT.tC) {
    G.RT.tC = document.createElement('canvas'); G.RT.tC.width = CW; G.RT.tC.height = CH;
    G.RT.dC = document.createElement('canvas'); G.RT.dC.width = CW; G.RT.dC.height = CH;
    G.RT.fireT = new Uint16Array(CW * CH);
  }
  const tc = G.RT.tC.getContext('2d'), dc = G.RT.dC.getContext('2d');
  if (G.RT.at < 0 || (G.RT.n > 0 && G.REC.patches[G.RT.n - 1].t > T)) {     // first look, or scrubbed back
    tc.putImageData(new ImageData(G.REC.tBase, CW, CH), 0, 0);
    dc.clearRect(0, 0, CW, CH);
    if (G.REC.dBase) dc.putImageData(new ImageData(G.REC.dBase, CW, CH), 0, 0);
    G.RT.n = 0;
  }
  while (G.RT.n < G.REC.patches.length && G.REC.patches[G.RT.n].t <= T) {
    const P = G.REC.patches[G.RT.n++];
    (P.c === 't' ? tc : dc).putImageData(new ImageData(P.px, P.w, P.h), P.x, P.y);
  }
  G.RT.at = T;
  if (!G.RT.fog || G.RT.fog.length !== G.REC.fogBase.length) G.RT.fog = new Uint8Array(G.REC.fogBase.length);
  G.RT.fog.set(G.REC.fogBase);
  const L = G.REC.fogLog;
  for (let n = 0; n < L.length && L[n] <= T; n += 3) G.RT.fog[L[n + 1]] = L[n + 2];
}
export function drawReplay(W, G, V) {
  const wit = G.input.current.witness;
  V.t = clamp(V.t, wit.t0, wit.t1);
  const F = rpFrame(G.REC.snaps, V.t);
  rpTerrain(W, G, V.t);
  if (!V.fog) G.RT.fog.fill(1);          // fog off: everything counts as seen, and no overlay
  if (V.follow) { V.cx = F.p.x + PW / 2; V.cy = F.p.y + PH / 2; }
  const near = F.near;
  for (let k = 0; k < near.fire.length; k++) G.RT.fireT[near.fire[k]] = near.fireT[k];
  // swap the recording in
  const keepL = {};
  for (const k in G.RP_ARR) { const L = G.RP_ARR[k]; keepL[k] = L.splice(0, L.length, ...F[k]); }
  const keep = { enemies: W.enemies, pickups: W.pickups, props: W.props, fire: W.fire, firePlants: W.firePlants, seen: W.seen, ghost: W.ghost, time: W.time, flick: W.flick, leanX: W.leanX, leanY: W.leanY, glowN: W.glowN,
    fireN: W.fireN, camX: W.camX, camY: W.camY, unitPx: W.unitPx, torchR: W.torchR, visPts: W.visPts, viewW: W.viewW, viewH: W.viewH, p: Object.assign({}, W.p) };
  W.enemies = F.enemies; W.pickups = F.pickups; W.props = F.props; W.firePlants = [];
  W.fire = { list: near.fire, t: G.RT.fireT }; W.seen = G.RT.fog;
  W.ghost = F.ghost; W.time = F.time; W.flick = F.flick; W.leanX = F.leanX; W.leanY = F.leanY; W.glowN = F.glowN; W.fireN = near.fireN;
  Object.assign(W.p, F.p);
  G.RPV = V;
  try { draw(W, G); } finally {
    // and the live world back, exactly as it was
    G.RPV = null;
    for (const k in G.RP_ARR) { const L = G.RP_ARR[k]; L.splice(0, L.length, ...keepL[k]); }
    ({ enemies: W.enemies, pickups: W.pickups, props: W.props, fire: W.fire, firePlants: W.firePlants, seen: W.seen, ghost: W.ghost, time: W.time, flick: W.flick, leanX: W.leanX, leanY: W.leanY, glowN: W.glowN,
      fireN: W.fireN, camX: W.camX, camY: W.camY, unitPx: W.unitPx, torchR: W.torchR, visPts: W.visPts, viewW: W.viewW, viewH: W.viewH } = keep);
    Object.assign(W.p, keep.p);
    for (let k = 0; k < near.fire.length; k++) G.RT.fireT[near.fire[k]] = 0;
  }
}
