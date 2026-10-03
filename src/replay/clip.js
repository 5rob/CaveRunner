// @ts-check
// Saved death replays ("clips"): cutting a recording down to what's round your path so it keeps
// small (clipCrop), making it safe to store (clipSafe), and blowing it back up to world size to
// play (clipHydrate). The recorder and player are game/systems/recorder.js; the store is
// save/clips.js; the gallery is ui/clips.js.

import { CELL, CH, CW, FH, FOG, FW, PH, PW, VIEW_W, WH, WW } from '../core/consts.js';
import { RP_LISTS, rpCut, rpPaste } from './replay.js';

export const CLIP_V = 1;                  // the saved format's version
// how much of the view round you a saved clip keeps (half sizes, world units, at zoom 1): a phone's
// width across, and a tall phone's height up and down (the camera puts you a bit below the middle)
export const WIT_HX = VIEW_W / 2 + 20, WIT_HY = 420;
// the fields of a shot its cast sound reads (audio/recipes.js shotSound): all a recorded cast keeps
export const SHOT_SND = ['sid', 'still', 'r', 'beam', 'speed', 'size', 'count', 'dmg', 'homing', 'spiral', 'orbit',
  'boomer', 'pong', 'explode', 'bore', 'eat', 'cluster', 'pierce', 'crit', 'bounce'];
// the world's fields draw() reads that belong to the floor, not the moment: a saved clip carries
// its own (the player swaps them in, so the clip plays on any floor)
export const SCENE_KEYS = ['floor', 'hasLvl', 'portal', 'portals', 'arrival', 'stock', 'rooms', 'sconces', 'warp', 'repo', 'pb',
  'plantW', 'themeName'];

// a sound call's arguments as they'll be kept: a cast's shots cut to what its sound reads,
// anything else shallow-copied (the live objects go on changing)
/** @param {string} name @param {any[]} a @returns {any[]} */
export function sfxArgs(name, a) {
  if (name === 'cast') {
    const shots = (a[0] || []).map(sh => { const o = {}; for (const k of SHOT_SND) if (sh[k] !== undefined) o[k] = sh[k]; return o; });
    return [shots, a[1], a[2]];
  }
  return a.map(v => (v && typeof v === 'object' ? Object.assign({}, v) : v));
}

// A copy that a store can keep (structured clone): functions and page objects (canvases, sound
// nodes) are dropped, big typed arrays inside creatures (way-finding fields) too; shared and
// circular references stay shared through `memo`. Plain data, typed arrays, Maps and Sets pass.
export const SAFE_BIG = 80000;            // typed arrays bigger than this (bytes) inside an entity are dropped
/** @param {any} v @param {Map<any, any>} [memo] @param {boolean} [top] keep big typed arrays (the clip's own) @returns {any} */
export function clipSafe(v, memo, top) {
  if (v === null || typeof v !== 'object') return typeof v === 'function' || typeof v === 'symbol' ? undefined : v;
  memo = memo || new Map();
  if (memo.has(v)) return memo.get(v);
  if (ArrayBuffer.isView(v)) {
    const keep = top || v.byteLength <= SAFE_BIG ? v : null;
    memo.set(v, keep); return keep;
  }
  if (Array.isArray(v)) {
    const out = []; memo.set(v, out);
    for (const x of v) { const c = clipSafe(x, memo); out.push(c === undefined ? null : c); }
    return out;
  }
  if (v instanceof Map) {
    const out = new Map(); memo.set(v, out);
    for (const [k, x] of v) { const c = clipSafe(x, memo); if (c !== undefined) out.set(k, c); }
    return out;
  }
  if (v instanceof Set) {
    const out = new Set(); memo.set(v, out);
    for (const x of v) { const c = clipSafe(x, memo); if (c !== undefined) out.add(c); }
    return out;
  }
  const pr = Object.getPrototypeOf(v);
  if (pr !== Object.prototype && pr !== null && !(v instanceof Date)) {
    // a page object (canvas, context, sound node, element): nothing to keep
    if (typeof Node !== 'undefined' && v instanceof Node) { memo.set(v, null); return null; }
    if (typeof AudioNode !== 'undefined' && v instanceof AudioNode) { memo.set(v, null); return null; }
    if (typeof CanvasRenderingContext2D !== 'undefined' && v instanceof CanvasRenderingContext2D) { memo.set(v, null); return null; }
  }
  if (v instanceof Date) return v;
  const out = {}; memo.set(v, out);
  for (const k in v) {
    const c = clipSafe(v[k], memo);
    if (c !== undefined) out[k] = c;
  }
  return out;
}

// Where your middle went over the clip: [x0, y0, x1, y1] in world units
/** @param {RpSnap[]} snaps @returns {number[]} */
export function clipPath(snaps) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of snaps) {
    const x = s.p.x + PW / 2, y = s.p.y + PH / 2;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

/** @param {any} o @returns {number} */
const ox = o => (o.x !== undefined ? o.x : o.a0x !== undefined ? o.a0x : o.ax);
/** @param {any} o @returns {number} */
const oy = o => (o.ty !== undefined ? o.ty : o.y !== undefined ? o.y : o.a0y !== undefined ? o.a0y : o.ay);

// A recording cut down to keep: the snapshots from t0 to t1 with only what's in view of your path
// (plus `pad`, how far the camera may still be dragged off you), the terrain, decoration and fog
// in that box, the patches clipped to it, the sounds in the span. `scene` is the floor's
// SCENE_KEYS (and `held`, the gun in your hands), `bg` the background's pixels.
/** @param {Clip} C @param {{ pad: number, scene: Record<string, any>, bg: Uint8ClampedArray | null, bgW?: number, bgH?: number }} o @returns {SavedClip} */
export function clipCrop(C, o) {
  const snaps = C.snaps.filter(s => s.t >= C.t0 - 0.06 && s.t <= C.t1 + 0.06);
  const [px0, py0, px1, py1] = clipPath(snaps);
  const pad = Math.max(0, o.pad);
  const lim = [Math.max(0, px0 - pad), Math.max(0, py0 - pad), Math.min(WW, px1 + pad), Math.min(WH, py1 + pad)];
  // the world box kept: the camera's reach plus a view round it
  const wx0 = Math.max(0, lim[0] - WIT_HX), wy0 = Math.max(0, lim[1] - WIT_HY);
  const wx1 = Math.min(WW, lim[2] + WIT_HX), wy1 = Math.min(WH, lim[3] + WIT_HY);
  const bx = Math.floor(wx0 / CELL), by = Math.floor(wy0 / CELL);
  const bw = Math.min(CW, Math.ceil(wx1 / CELL)) - bx, bh = Math.min(CH, Math.ceil(wy1 / CELL)) - by;
  const fx = Math.floor(bx / FOG), fy = Math.floor(by / FOG);
  const fw = Math.min(FW, Math.ceil((bx + bw) / FOG)) - fx, fh = Math.min(FH, Math.ceil((by + bh) / FOG)) - fy;
  const inBox = (x, y, m) => x === undefined || (x > wx0 - m && x < wx1 + m && y > wy0 - m && y < wy1 + m);
  const memo = new Map();
  const outSnaps = snaps.map(s => {
    const S = { t: s.t, p: null, ghost: null };
    for (const k in s) {
      if (k === 't') continue;
      if (RP_LISTS.includes(k)) S[k] = clipSafe(s[k].filter(e => inBox(ox(e), oy(e), k === 'props' ? 120 : 40)), memo);
      else if (k === 'fire') {
        const keep = [];
        for (let n = 0; n < s.fire.length; n++) {
          const i = s.fire[n], x = i % CW, y = (i / CW) | 0;
          if (x >= bx && x < bx + bw && y >= by && y < by + bh) keep.push(n);
        }
        S.fire = Int32Array.from(keep, n => s.fire[n]); S.fireT = Uint16Array.from(keep, n => s.fireT[n]);
      } else if (k !== 'fireT') S[k] = clipSafe(s[k], memo);
    }
    return S;
  });
  // the patches, clipped to the box
  const patches = [];
  for (const P of C.patches) {
    if (P.t > C.t1 + 0.06) continue;
    const x0 = Math.max(P.x, bx), y0 = Math.max(P.y, by), x1 = Math.min(P.x + P.w, bx + bw), y1 = Math.min(P.y + P.h, by + bh);
    if (x1 <= x0 || y1 <= y0) continue;
    patches.push({ t: P.t, c: P.c, x: x0, y: y0, w: x1 - x0, h: y1 - y0, px: rpCut(P.px, P.w, x0 - P.x, y0 - P.y, x1 - x0, y1 - y0) });
  }
  // the fog: the box's cells as they stood, and the changes to them
  const fogBase = new Uint8Array(fw * fh);
  for (let r = 0; r < fh; r++) fogBase.set(C.fogBase.subarray((fy + r) * FW + fx, (fy + r) * FW + fx + fw), r * fw);
  const log = [];
  for (let n = 0; n < C.fogLog.length; n += 3) {
    if (C.fogLog[n] > C.t1 + 0.06) break;
    const i = C.fogLog[n + 1], cx = i % FW, cy = (i / FW) | 0;
    if (cx >= fx && cx < fx + fw && cy >= fy && cy < fy + fh) log.push(C.fogLog[n], i, C.fogLog[n + 2]);
  }
  const sfx = clipSafe((C.sfx || []).filter(e => e[0] >= C.t0 - 0.06 && e[0] <= C.t1 + 0.06), memo);
  return {
    v: CLIP_V, t0: C.t0, t1: C.t1, death: C.death, lim,
    box: [bx, by, bw, bh], fbox: [fx, fy, fw, fh],
    tBase: rpCut(C.tBase, CW, bx, by, bw, bh),
    dBase: C.dBase ? rpCut(C.dBase, CW, bx, by, bw, bh) : null,
    fogBase, fogLog: Float64Array.from(log), patches, snaps: outSnaps, sfx,
    scene: clipSafe(o.scene, memo), bg: o.bg, bgW: o.bgW || 0, bgH: o.bgH || 0,
  };
}

// A saved clip back at world size, ready for the player (the background stays as pixels: the
// Game puts it on a canvas)
/** @param {SavedClip} S @returns {Clip} */
export function clipHydrate(S) {
  const [bx, by, bw, bh] = S.box, [fx, fy, fw, fh] = S.fbox;
  const tBase = new Uint8ClampedArray(CW * CH * 4);
  rpPaste(tBase, CW, { x: bx, y: by, w: bw, h: bh, px: S.tBase });
  let dBase = null;
  if (S.dBase) { dBase = new Uint8ClampedArray(CW * CH * 4); rpPaste(dBase, CW, { x: bx, y: by, w: bw, h: bh, px: S.dBase }); }
  const fogBase = new Uint8Array(FW * FH);
  for (let r = 0; r < fh; r++) fogBase.set(S.fogBase.subarray(r * fw, (r + 1) * fw), (fy + r) * FW + fx);
  return { t0: S.t0, t1: S.t1, death: S.death, snaps: S.snaps, patches: S.patches, tBase, dBase, fogBase,
    fogLog: S.fogLog, sfx: S.sfx || [], scene: S.scene, lim: S.lim, bgPx: S.bg, bgW: S.bgW, bgH: S.bgH };
}

// roughly how many bytes a saved clip takes (its pixel arrays and an estimate for the rest)
/** @param {SavedClip} S @returns {number} */
export function clipBytes(S) {
  let n = S.tBase.length + (S.dBase ? S.dBase.length : 0) + S.fogBase.length + S.fogLog.length * 8 + (S.bg ? S.bg.length : 0);
  for (const P of S.patches) n += P.px.length + 40;
  const seen = new Set();
  const walk = v => {
    if (v === null || typeof v !== 'object') { n += 8; return; }
    if (seen.has(v)) return;
    seen.add(v);
    if (ArrayBuffer.isView(v)) { n += v.byteLength; return; }
    if (v instanceof Map || v instanceof Set) { for (const x of v.values()) walk(x); return; }
    for (const k in v) { n += k.length; walk(v[k]); }
  };
  walk(S.snaps); walk(S.sfx); walk(S.scene);
  return n;
}

// ---- packing a clip small for the store: clipEnc makes plain JSON of it (shared and circular
// references as $id/$ref, typed arrays as base64, Maps and Sets tagged, decimals cut to 3 places),
// clipPack gzips that; clipUnpack and clipDec turn it back ----
const TYPED = { Uint8Array, Uint8ClampedArray, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array, Float32Array, Float64Array };
/** @param {Uint8Array} u */
function toB64(u) {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
/** @param {string} b */
function fromB64(b) {
  const s = atob(b), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
/** @param {any} v @returns {any} */
export function clipEnc(v) {
  const count = new Map();
  const scan = x => {
    if (x === null || typeof x !== 'object' || ArrayBuffer.isView(x)) return;
    const n = count.get(x) || 0;
    count.set(x, n + 1);
    if (n) return;
    if (x instanceof Map) { for (const [k, y] of x) { scan(k); scan(y); } return; }
    if (x instanceof Set) { for (const y of x) scan(y); return; }
    for (const k in x) scan(x[k]);
  };
  scan(v);
  const ids = new Map();
  const enc = x => {
    if (typeof x === 'number') return Number.isFinite(x) ? (Number.isInteger(x) ? x : Math.round(x * 1000) / 1000) : { $n: String(x) };
    if (x === null || typeof x !== 'object') return x === undefined ? null : x;
    if (ArrayBuffer.isView(x)) return { $t: x.constructor.name, d: toB64(new Uint8Array(x.buffer, x.byteOffset, x.byteLength)) };
    if (ids.has(x)) return { $ref: ids.get(x) };
    const shared = count.get(x) > 1, id = ids.size;
    if (shared) ids.set(x, id);
    let o;
    if (x instanceof Map) o = { $M: [...x].map(([k, y]) => [enc(k), enc(y)]) };
    else if (x instanceof Set) o = { $S: [...x].map(enc) };
    else if (Array.isArray(x)) o = shared ? { $A: x.map(enc) } : x.map(enc);
    else { o = {}; for (const k in x) o[k] = enc(x[k]); }
    if (shared) o.$id = id;
    return o;
  };
  return enc(v);
}
/** @param {any} v @returns {any} */
export function clipDec(v) {
  const ids = new Map();
  const dec = x => {
    if (x === null || typeof x !== 'object') return x;
    if (Array.isArray(x)) return x.map(dec);
    if (x.$n !== undefined) return Number(x.$n);
    if (x.$t) { const u = fromB64(x.d), T = TYPED[x.$t] || Uint8Array; return new T(u.buffer, 0, u.byteLength / (T.BYTES_PER_ELEMENT || 1)); }
    if (x.$ref !== undefined) return ids.get(x.$ref);
    let o;
    if (x.$M) { o = new Map(); if (x.$id !== undefined) ids.set(x.$id, o); for (const [k, y] of x.$M) o.set(dec(k), dec(y)); return o; }
    if (x.$S) { o = new Set(); if (x.$id !== undefined) ids.set(x.$id, o); for (const y of x.$S) o.add(dec(y)); return o; }
    if (x.$A) { o = []; if (x.$id !== undefined) ids.set(x.$id, o); for (const y of x.$A) o.push(dec(y)); return o; }
    o = {};
    if (x.$id !== undefined) ids.set(x.$id, o);
    for (const k in x) if (k !== '$id') o[k] = dec(x[k]);
    return o;
  };
  return dec(v);
}
/** @param {SavedClip} S @returns {Promise<Blob>} gzipped JSON */
export async function clipPack(S) {
  const json = new Blob([JSON.stringify(clipEnc(S))]);
  return new Response(json.stream().pipeThrough(new CompressionStream('gzip'))).blob();
}
/** @param {Blob} b @returns {Promise<SavedClip>} */
export async function clipUnpack(b) {
  const text = await new Response(b.stream().pipeThrough(new DecompressionStream('gzip'))).text();
  return clipDec(JSON.parse(text));
}
