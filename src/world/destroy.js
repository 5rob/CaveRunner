// @ts-check
// Floor 2's destruction (Level 2 stage 5): the wasteland round the dark zones, made as the floor is.
//   destructionPlan   the blasts: scatterByDistance out from the zones' edges (Dev → Level 2: destruction),
//                     none in a zone, none near the shop, the pads or a prize (`keep`)
//   blastTerrain      one blast on the floor's layers, as explode (game/systems/terrain.js) does it: the
//                     disc of rock gone (never BED), its fuel and ore, the decoration and the silk in it;
//                     then a scorch ring past the hole (DEV.l2bScorch × r) and black streaks fanning out of it
//                     (DEV.l2bStreak: length ×; owner, round 5) on rock, decoration and back wall
//   settleFire        the fire blasts' fire lit, then run tick by tick until it has burnt out
//   scatterBones      bones and skulls half sunk in the ground across the wasteland (outside the zones)
//   destroyFloor      all of it, in that order, on its own random stream
// Pure and seeded: same seed, same wasteland. Holes only ever open rock, so every route stays.

import { BED, CELL, CH, CW, ROCK, SHOP_ROOF, SHOP_TOP } from '../core/consts.js';
import { DEV } from '../dev/knobs.js';
import { destructionOpts, distField, scatterByDistance } from './byDistance.js';
import { silkErase } from './dark.js';
import { fireArea, fireNew, fireStep, FIRE_TICK } from './fire.js';
import { KIT_PAL } from './furnish.js';

const SKULL = ['.BBB.', 'BkBkB', 'BBBBB', '.b.b.'];
const BONE = ['B...bB', '.BBbB.'];
const RIBS = ['b.b.b', 'BBBBB', 'b.b.b'];
const SKULL2 = ['.BBBB.', 'BkBBkB', 'BBBBBB', '.bBBb.'];
const LONG = ['B......B', 'BBBBBBBB', 'b......b'];
const REMAINS = [SKULL, SKULL, SKULL2, BONE, BONE, RIBS, LONG];

/** @typedef {{ x: number, y: number, r: number, fire: boolean, dist: number }} Blast */

/**
 * The blasts, in terrain pixels: points by distance from the zones' edges, sized by the curves.
 * @param {Uint8Array} mat @param {Uint8Array} mask darkMask @param {number} seed
 * @param {{ x: number, y: number, r: number }[]} keep world-unit keep-outs (the shop, the pads, the prizes)
 * @returns {Blast[]}
 */
export function destructionPlan(mat, mask, seed, keep) {
  const o = destructionOpts(), dist = distField(CW, CH, mask, o.maxDist);
  // inside a zone is not wasteland: those cells are never candidates
  for (let i = 0; i < CW * CH; i++) if (mask[i]) dist[i] = Infinity;
  // (owner, round 2) a ring of damage round each zone: by default blasts land anywhere in the gradient, rock
  // too (DEV.l2bInRock 0: only in open air, DEV.l2bClear from rock)
  const pts = scatterByDistance({ ...o, w: CW, h: CH, dist, solid: DEV.l2bInRock ? undefined : mat, seed: (seed * 7919 + 5) % 2147483646 + 1 });
  const shopTop = SHOP_TOP - SHOP_ROOF;
  /** @type {Blast[]} */
  const out = [];
  for (const p of pts) {
    const r = p.size;
    if (!(r >= 1)) continue;
    const ring = r + scorchWidth(r) + 2;
    if (p.y + ring >= shopTop - 4) continue;
    if (keep.some(k => Math.hypot(p.x - k.x / CELL, p.y - k.y / CELL) < k.r / CELL + ring)) continue;
    out.push({ x: p.x, y: p.y, r, fire: p.roll < o.fire, dist: p.dist });
  }
  return out;
}

// how far the scorch reaches past a blast's hole (terrain px)
/** @param {number} r */
export const scorchWidth = r => Math.max(3, r * Math.max(0, DEV.l2bScorch) * 0.5);

/**
 * One blast on the floor's layers (terrain pixels). Returns how many rock pixels went.
 * @param {{ mat: Uint8Array, img: Pixels, dimg: Pixels, bgImg: Pixels, fuel: Uint8Array, web: Uint8Array | null }} L
 * @param {Blast} b @param {() => number} rnd
 */
export function blastTerrain(L, b, rnd) {
  const { mat, fuel } = L, d = L.img.data, dd = L.dimg.data, bd = L.bgImg.data, BWd = L.bgImg.width;
  const sw = scorchWidth(b.r) * (b.fire ? 1.5 : 1), ring = b.r + sw;
  const x0 = Math.max(0, Math.floor(b.x - ring)), x1 = Math.min(CW - 1, Math.ceil(b.x + ring));
  const y0 = Math.max(0, Math.floor(b.y - ring)), y1 = Math.min(CH - 1, Math.ceil(b.y + ring));
  let gone = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * CW + x, k = i * 4, dist = Math.hypot(x + 0.5 - b.x, y + 0.5 - b.y);
    if (dist > ring) continue;
    if (dist <= b.r) {
      dd[k + 3] = 0; fuel[i] = 0;
      if (mat[i] && mat[i] !== BED) { mat[i] = 0; d[k + 3] = 0; gone++; }
      continue;
    }
    // the scorch: darkest at the hole's lip, fading out, a little ragged
    const t = 1 - (dist - b.r) / sw, f = 1 - t * (0.55 + 0.25 * rnd()) * (b.fire ? 1 : 0.8);
    if (mat[i]) { d[k] *= f; d[k + 1] *= f; d[k + 2] *= f; }
    if (dd[k + 3]) { dd[k] *= f; dd[k + 1] *= f; dd[k + 2] *= f; }
  }
  // the back wall: sooted over the hole and its ring (a bg pixel is 4 terrain pixels)
  for (let y = Math.floor(y0 / 4); y <= Math.floor(y1 / 4); y++) for (let x = Math.floor(x0 / 4); x <= Math.floor(x1 / 4); x++) {
    const dist = Math.hypot(x * 4 + 2 - b.x, y * 4 + 2 - b.y);
    if (dist > ring) continue;
    const f = dist <= b.r ? 0.55 + 0.25 * dist / b.r : 0.8 + 0.2 * (dist - b.r) / sw, k = (y * BWd + x) * 4;
    bd[k] *= f; bd[k + 1] *= f; bd[k + 2] *= f;
  }
  // the streaks: black rays out of the hole in varying lengths and widths, darkest at the lip, tapering
  const SL = Math.max(0, DEV.l2bStreak);
  if (SL > 0) {
    const n = 7 + Math.floor(rnd() * 9);
    for (let s = 0; s < n; s++) {
      const a = rnd() * Math.PI * 2, len = b.r * SL * (0.5 + rnd() * 1.6) + sw, w0 = 0.8 + rnd() * Math.max(1, b.r * 0.12);
      const ca = Math.cos(a), sa = Math.sin(a), steps = Math.ceil(len * 2);
      for (let q = 0; q <= steps; q++) {
        const u = q / steps, rr = b.r * 0.85 + u * len, cx = b.x + ca * rr, cy = b.y + sa * rr, hw = w0 * (1 - u * 0.85);
        const f = 1 - (1 - u) * (b.fire ? 0.8 : 0.65);
        for (let yy = Math.floor(cy - hw); yy <= Math.ceil(cy + hw); yy++) for (let xx = Math.floor(cx - hw); xx <= Math.ceil(cx + hw); xx++) {
          if (xx < 0 || yy < 0 || xx >= CW || yy >= CH || Math.hypot(xx + 0.5 - cx, yy + 0.5 - cy) > hw) continue;
          const k = (yy * CW + xx) * 4;
          if (mat[yy * CW + xx]) { d[k] *= f; d[k + 1] *= f; d[k + 2] *= f; }
          if (dd[k + 3]) { dd[k] *= f; dd[k + 1] *= f; dd[k + 2] *= f; }
        }
        // the back wall too, more faintly (a bg pixel is 4 terrain pixels; once per bg pixel along the ray)
        if (q % 8 === 0) {
          const bx = Math.floor(cx / 4), by = Math.floor(cy / 4), bk = (by * BWd + bx) * 4, fb = 1 - (1 - u) * 0.45;
          if (bx >= 0 && by >= 0 && bx < BWd && by < L.bgImg.height) { bd[bk] *= fb; bd[bk + 1] *= fb; bd[bk + 2] *= fb; }
        }
      }
    }
  }
  if (L.web) silkErase(L.web, b.x, b.y, b.r + 1.5);
  return gone;
}

/**
 * The fire blasts' fire, lit and burnt out (what burnt: rock under it charred, decoration gone). Returns the ticks run.
 * @param {{ mat: Uint8Array, img: Pixels, dimg: Pixels, fuel: Uint8Array }} L @param {Blast[]} blasts @param {() => number} rnd @param {number} [cap] most ticks
 */
export function settleFire(L, blasts, rnd, cap = 4000) {
  const F = fireNew(L.fuel), d = L.img.data, dd = L.dimg.data;
  for (const b of blasts) if (b.fire) fireArea(F, b.x * CELL, b.y * CELL, (b.r + scorchWidth(b.r) * 1.5) * CELL * 1.3, 0.9, rnd);
  let t = 0;
  for (; t < cap && F.list.length; t++) fireStep(F, FIRE_TICK, i => {
    const k = i * 4, r = rnd();
    if (L.mat[i]) { d[k] = 34 + r * 16; d[k + 1] = 28 + r * 12; d[k + 2] = 24 + r * 10; }
    else if (r < 0.16) { const a = 30 + r * 120; dd[k] = a; dd[k + 1] = a * 0.9; dd[k + 2] = a * 0.85; }
    else dd[k + 3] = 0;
  }, rnd);
  // whatever still burns past the cap goes out
  for (const i of F.list) F.t[i] = 0;
  return t;
}

/**
 * Bones and skulls in the ground across the wasteland: on open floor outside the zones, sunk 1-2 rows
 * (the sunk rows painted on the rock, the rest in the decoration layer). Returns how many.
 * @param {{ mat: Uint8Array, img: Pixels, dimg: Pixels }} L @param {Uint8Array} mask @param {number} n @param {() => number} rnd
 * @param {{ x: number, y: number, r: number }[]} keep world-unit keep-outs
 */
export function scatterBones(L, mask, n, rnd, keep) {
  const { mat } = L, d = L.img.data, dd = L.dimg.data, shopTop = SHOP_TOP - SHOP_ROOF;
  let put = 0;
  for (let t = 0; t < n * 60 && put < n; t++) {
    const x = 4 + Math.floor(rnd() * (CW - 16)), y0 = 4 + Math.floor(rnd() * (shopTop - 12));
    // fall to the floor below
    let y = y0;
    while (y < shopTop && !mat[y * CW + x]) y++;
    if (y === y0 || y >= shopTop || mat[y * CW + x] !== ROCK) continue;
    const art = REMAINS[Math.floor(rnd() * REMAINS.length)], w = art[0].length, h = art.length, flip = rnd() < 0.5;
    const sink = 1 + Math.floor(rnd() * 2), top = y - h + sink;
    if (keep.some(k => Math.hypot(x - k.x / CELL, y - k.y / CELL) < k.r / CELL)) continue;
    let ok = true;
    for (let k = 0; k < w && ok; k++) {
      const xx = x + k;
      if (xx >= CW - 3 || mat[y * CW + xx] !== ROCK || mat[(y - 1) * CW + xx] || mask[(y - 1) * CW + xx]) ok = false;
      for (let j = top; j < y && ok; j++) if (mat[j * CW + xx] || mask[j * CW + xx] || dd[(j * CW + xx) * 4 + 3]) ok = false;
    }
    if (!ok) continue;
    for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) {
      const ch = art[j][flip ? w - 1 - k : k];
      if (ch === '.') continue;
      const i = (top + j) * CW + x + k, c = KIT_PAL[ch], dark = mat[i] ? 0.8 : 1;
      const px = mat[i] ? d : dd;
      if (mat[i] && mat[i] !== ROCK) continue;
      px[i * 4] = c[0] * dark; px[i * 4 + 1] = c[1] * dark; px[i * 4 + 2] = c[2] * dark; px[i * 4 + 3] = 255;
    }
    put++;
  }
  return put;
}

/**
 * Floor 2's wasteland, whole: the blasts, their fire burnt out, then the bones. Its own random stream.
 * @param {{ mat: Uint8Array, img: Pixels, dimg: Pixels, bgImg: Pixels, fuel: Uint8Array, web: Uint8Array | null, ore?: Uint8Array | null }} L
 * @param {Uint8Array} mask darkMask @param {number} seed @param {{ x: number, y: number, r: number }[]} keep world-unit keep-outs
 * @returns {{ blasts: Blast[], ticks: number, bones: number, gone: number }}
 */
export function destroyFloor(L, mask, seed, keep) {
  let rs = (Math.imul(seed | 0, 69621) + 4441 >>> 0) % 2147483646 + 1;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const blasts = destructionPlan(L.mat, mask, seed, keep);
  let gone = 0;
  for (const b of blasts) gone += blastTerrain(L, b, rnd);
  const ticks = settleFire(L, blasts, rnd);
  const bones = scatterBones(L, mask, Math.max(0, Math.round(DEV.l2bBones * DEV.l2Decor)), rnd, keep);
  return { blasts, ticks, bones, gone };
}
