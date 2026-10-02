// @ts-check
// The death replay's pure part: what is recorded (RP_LISTS, RP_DEEP, RP_LERP…), cloning
// and blending snapshots (rpClone, rpLerp, rpFrame) and terrain patches (rpCut, rpPaste,
// rpMerge). The recorder and player live in the Game for now.

import { angDiff } from '../core/util.js';

// ---- the death replay ("Witness yourself", v90) ----
// The Game keeps the last few seconds as snapshots, RP_HZ a second: a copy of everything draw()
// reads in a box round you. On the death screen the replay feeds them back through draw(),
// blended between snapshots so slow motion stays smooth. Terrain isn't in the snapshots: it's a
// base picture from the start of the window plus the patches dug or burnt since (rpCut/rpPaste),
// and the fog is a base plus a log of the cells that changed.
export const RP_HZ = 20;                  // snapshots a second
export const RP_BEFORE = 10;              // seconds shown before the death
export const RP_AFTER = 3;                // and after it: the recording runs on this long
export const RP_KEEP = RP_BEFORE + 0.5;   // seconds kept while you're alive
export const RP_W = 320, RP_H = 440;      // half-size of the box round you that gets recorded (world units)
// the lists draw() reads that go into a snapshot (enemies, pickups and props are handled the same)
export const RP_LISTS = ['bullets', 'enemyShots', 'smoke', 'sparks', 'flashes', 'coins', 'fields', 'beams', 'arcs',
  'torchP', 'motes', 'burns', 'webs', 'silk', 'strings', 'dparts', 'amb', 'clouds', 'rings', 'devils',
  'enemies', 'pickups', 'props'];
// single numbers draw() reads, blended between snapshots
export const RP_NUMS = ['time', 'flick', 'leanX', 'leanY', 'glowN'];
// nested state worth copying (creature brains the sprites read, tentacles, lightning trails, the
// aim, your corpse's ragdoll); any other object inside an entity is shared, not copied
/** @type {Record<string, number>} */
export const RP_DEEP = { sp: 1, ra: 1, je: 1, nest: 1, shot: 1, tent: 1, trail: 1, aim: 1, rag: 1, joints: 1 };
// fields that slide between snapshots; everything else jumps at the halfway point
/** @type {Record<string, number>} */
export const RP_LERP = { x: 1, y: 1, ty: 1, lx: 1, ly: 1, vx: 1, vy: 1, nx: 1, ny: 1, jx: 1, jy: 1, ox: 1, oy: 1,
  life: 1, t: 1, age: 1, r: 1, size: 1, shape: 1, flame: 1, fuel: 1, hp: 1, charge: 1, len: 1, hitT: 1 };
/** @type {Record<string, number>} */
export const RP_ANGLE = { hd: 1 };        // angles blend the short way round
/** @type {(v: unknown) => boolean} */
export const rpPlain = v => v !== null && typeof v === 'object' &&
  (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype);
// a snapshot copy of one entity: its own fields, plus copies of the RP_DEEP parts; `id` ties
// the copies of one entity together across snapshots
/** @param {Record<string, any>} o @param {number} [id] @returns {Record<string, any>} */
export function rpClone(o, id) {
  const c = {};
  for (const k in o) {
    const v = o[k];
    c[k] = RP_DEEP[k] && rpPlain(v) ? rpCopy(v) : v;
  }
  if (id !== undefined) c._r = id;
  return c;
}
/** @param {any} v @returns {any} */
export function rpCopy(v) {
  return Array.isArray(v) ? v.map(rpCopy) : rpPlain(v) ? rpClone(v) : v;
}
// one entity at fraction u of the way from snapshot copy a to b
/** @param {any} a @param {any} b @param {number} u @returns {any} */
export function rpLerp(a, b, u) {
  if (!b || a === b) return a;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return u < 0.5 ? a : b;
    return a.map((x, i) => rpLerp(x, b[i], u));
  }
  if (!rpPlain(a) || !rpPlain(b)) return u < 0.5 ? a : b;
  const c = Object.assign({}, u < 0.5 ? a : b);
  for (const k in c) {
    const va = a[k], vb = b[k];
    if (typeof va === 'number' && typeof vb === 'number') {
      if (RP_LERP[k]) c[k] = va + (vb - va) * u;
      else if (RP_ANGLE[k]) c[k] = va + angDiff(vb, va) * u;
    } else if (RP_DEEP[k] && va && vb && typeof va === 'object') c[k] = rpLerp(va, vb, u);
  }
  return c;
}
// a whole list at fraction u: matched entities blend; one that only exists in the earlier
// snapshot shows until halfway, one born in the later shows from halfway
/** @param {any[]} A @param {any[]} B @param {number} u @returns {any[]} */
export function rpList(A, B, u) {
  const out = [], mb = new Map();
  for (const o of B) mb.set(o._r, o);
  for (const a of A) {
    const b = mb.get(a._r);
    if (b) { out.push(rpLerp(a, b, u)); mb.delete(a._r); }
    else if (u < 0.5) out.push(a);
  }
  if (u >= 0.5) for (const b of mb.values()) out.push(b);
  return out;
}
// the two snapshots either side of time t, and how far between them
/** @param {RpSnap[]} snaps @param {number} t @returns {{ a: RpSnap, b: RpSnap, u: number }} */
export function rpAt(snaps, t) {
  let lo = 0, hi = snaps.length - 1;
  if (t <= snaps[0].t) return { a: snaps[0], b: snaps[0], u: 0 };
  if (t >= snaps[hi].t) return { a: snaps[hi], b: snaps[hi], u: 0 };
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (snaps[m].t <= t) lo = m; else hi = m; }
  const a = snaps[lo], b = snaps[hi];
  return { a, b, u: (t - a.t) / (b.t - a.t || 1) };
}
// the whole scene at time t, ready to swap in for the live one
/** @param {RpSnap[]} snaps @param {number} t @returns {RpFrame} */
export function rpFrame(snaps, t) {
  const { a, b, u } = rpAt(snaps, t), F = { near: u < 0.5 ? a : b };
  for (const k of RP_LISTS) F[k] = rpList(a[k], b[k], u);
  for (const k of RP_NUMS) F[k] = a[k] + (b[k] - a[k]) * u;
  F.p = rpLerp(a.p, b.p, u);
  F.ghost = a.ghost && b.ghost ? rpLerp(a.ghost, b.ghost, u) : F.near.ghost;
  return F;
}
// terrain patches: copy a rectangle out of (and back into) a W-wide RGBA pixel array
/** @param {Uint8ClampedArray} data @param {number} W @param {number} x @param {number} y @param {number} w @param {number} h @returns {Uint8ClampedArray<ArrayBuffer>} */
export function rpCut(data, W, x, y, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let r = 0; r < h; r++) out.set(data.subarray(((y + r) * W + x) * 4, ((y + r) * W + x + w) * 4), r * w * 4);
  return out;
}
/** @param {Uint8ClampedArray} data @param {number} W @param {RpPatch} P */
export function rpPaste(data, W, P) {
  for (let r = 0; r < P.h; r++) data.set(P.px.subarray(r * P.w * 4, (r + 1) * P.w * 4), ((P.y + r) * W + P.x) * 4);
}
// the dirty rectangles of one snapshot ([which, x, y, w, h]), clipped to the W x H map and
// merged per layer into one box when that box isn't much bigger than the pieces
/** @param {RpRect[]} rects @param {number} W @param {number} H @returns {RpRect[]} */
export function rpMerge(rects, W, H) {
  const out = [];
  for (const which of ['t', 'd']) {
    const rs = [];
    for (const [c, x, y, w, h] of rects) {
      if (c !== which) continue;
      const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
      if (x1 > x0 && y1 > y0) rs.push([x0, y0, x1, y1]);
    }
    if (!rs.length) continue;
    let area = 0, X0 = W, Y0 = H, X1 = 0, Y1 = 0;
    for (const [x0, y0, x1, y1] of rs) {
      area += (x1 - x0) * (y1 - y0);
      X0 = Math.min(X0, x0); Y0 = Math.min(Y0, y0); X1 = Math.max(X1, x1); Y1 = Math.max(Y1, y1);
    }
    if ((X1 - X0) * (Y1 - Y0) <= Math.max(4096, area * 3)) out.push([which, X0, Y0, X1 - X0, Y1 - Y0]);
    else for (const [x0, y0, x1, y1] of rs) out.push([which, x0, y0, x1 - x0, y1 - y0]);
  }
  return out;
}
