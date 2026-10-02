// @ts-check
// Level decoration, pass 2 (baked pixels) and pass 3 (props): decorate places each
// theme's DECOR on its own random stream, cullDecor drops overlaps, propAnchored says if a
// prop still hangs off rock. Props are never in mat; they act only by box overlap.

import { BH, BRICK, BW, CELL, CH, CW, ROCK, SHOP_TOP } from '../core/consts.js';
import { mix } from '../core/util.js';
import { decorFor, themeFor } from '../data/themes.js';
import { DEV, kr } from '../dev/knobs.js';
import { FUEL_GRASS, FUEL_MOSS, FUEL_WOOD } from './fire.js';
import { tent } from './sway.js';
import { timberFrame } from './strata.js';

// v59: three times as much of everything as v58 had, and vines come in clumps and groves
export const DECOR_DENSITY = 3;
export const GROVES = 14;                     // patches of thick growth per floor, on the green themes
/** @type {Record<string, number>} */
export const PLANTS = { vine: 1, myc: 1, root: 1, kelp: 1 };   // the hanging plants (not chains, not ice)
// the hit box of each prop kind about its attach point (x, y), in world units: [l, t, r, b].
// Ceiling props hang down from y, floor props stand up from it, wall props sit beside it.
export const PROP_BOX = {
  drop:   { icicle: [-4, 0, 4, 16], geode: [-7, 0, 7, 12] },
  spike:  [-6, -10, 6, 0],
  barrel: [-9, -12, 9, 0],
  lamp:   { lantern: [-5, -7, 5, 7], cap: [-6, -10, 6, 0], hanglamp: [-4, 0, 4, 16] },
  vent:   [-5, -3, 5, 0],
  pad:    [-10, -11, 10, 0],
  pod:    [-5, -11, 5, 0],
  noise:  { skulls: [-8, -7, 8, 0], stone: [-5, -10, 5, 10] },
  shard:  [-3, -5, 3, 5],
  eyes:   [-7, -4, 7, 4],
  cover:  { statue: [-8, -28, 8, 0], pillar: [-7, -30, 7, 0], monolith: [-7, -34, 7, 0] },
  matter: [-12, -12, 12, 12],
  tendril: [-4, -8, 4, 0],
  drip:   [-3, 0, 3, 4],
};
// what a hazard does to you when it lands a hit, and how often
/** @type {Record<string, number>} */
export const PROP_DMG = { spike: 8, drop: 12, vent: 7, tendril: 8, matter: 4, lava: 5, cloud: 3 };

// `fuel` (optional) gets the fuel kind of every pixel painted: whatever FU is at the time
// (see the fire section) — grass, moss and timber burn, everything else paints a 0.
// An arched vine's curve (v87): hung from (ax, ay) to (bx, by), `slack` times as long as the
// straight line between them, so it sags. A parabola under the chord, its depth set so the
// curve's length comes out near slack × chord (for a shallow sag, length ≈ c(1 + 8/3 (s/c)²)).
// n + 1 points, world units.
/** @param {number} ax @param {number} ay @param {number} bx @param {number} by @param {number} slack @param {number} n @returns {Pt[]} */
export function archCurve(ax, ay, bx, by, slack, n) {
  const c = Math.hypot(bx - ax, by - ay), s = c * Math.sqrt(3 * Math.max(0, slack - 1) / 8);
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    pts.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t + 4 * s * t * (1 - t) });
  }
  return pts;
}
// the nearest point on arched vine pr to (x, y), bent as it is now (world/sway.js):
// { x, y, d, k, u } (k = the segment it's on, u = how far along the whole vine)
/** @param {{ x: number, y: number, arc?: number[][], wx?: number, wy?: number, wu?: number }} pr an arched vine @param {number} x @param {number} y */
export function archNear(pr, x, y) {
  const A = pr.arc, n = A.length - 1, bx0 = pr.wx || 0, by0 = pr.wy || 0, pu = pr.wu == null ? 0.5 : pr.wu;
  let best = null, ax = 0, ay = 0;
  for (let k = 0; k + 1 < A.length; k++) {
    if (k === 0) { const t = tent(0, pu); ax = pr.x + A[0][0] + t * bx0; ay = pr.y + A[0][1] + t * by0; }
    const t = tent((k + 1) / n, pu), bx = pr.x + A[k + 1][0] + t * bx0, by = pr.y + A[k + 1][1] + t * by0;
    const vx = bx - ax, vy = by - ay, ll = vx * vx + vy * vy || 1;
    const u = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / ll));
    const qx = ax + vx * u, qy = ay + vy * u, d = Math.hypot(qx - x, qy - y);
    if (!best || d < best.d) best = { x: qx, y: qy, d, k, u: (k + u) / n };
    ax = bx; ay = by;
  }
  return best;
}
// a point on arched vine pr (world units, bent as it is now) at fraction u of the way along its points
/** @param {{ x: number, y: number, arc?: number[][], wx?: number, wy?: number, wu?: number }} pr an arched vine @param {number} u */
export function archAt(pr, u) {
  const A = pr.arc, f = Math.max(0, Math.min(1, u)) * (A.length - 1), k = Math.min(A.length - 2, Math.floor(f)), t = f - k;
  const b = tent(Math.max(0, Math.min(1, u)), pr.wu == null ? 0.5 : pr.wu);
  return { x: pr.x + A[k][0] + (A[k + 1][0] - A[k][0]) * t + b * (pr.wx || 0), y: pr.y + A[k][1] + (A[k + 1][1] - A[k][1]) * t + b * (pr.wy || 0) };
}

/**
 * @param {Uint8Array} mat @param {Pixels} img @param {Pixels} dimg @param {Pixels} bgImg @param {number} floor @param {number} seed
 * @param {Spot[]} keep @param {Uint8Array | null} [fuel] @param {Uint8Array | null} [zone]
 * @returns {{ props: Prop[], amb: string[], baked: Record<string, number> }}
 */
export function decorate(mat, img, dimg, bgImg, floor, seed, keep, fuel, zone) {
  let rs = (Math.imul(seed | 0, 7919) + floor * 104729 >>> 0) % 2147483646 + 1;
  const R = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const T = themeFor(floor), list = decorFor(floor);
  const d = img.data, dd = dimg.data, bd = bgImg.data;
  const inb = (cx, cy) => cx >= 0 && cy >= 0 && cx < CW && cy < CH;
  const solidC = (cx, cy) => inb(cx, cy) && (mat[cy * CW + cx] === ROCK || mat[cy * CW + cx] === BRICK);
  const openC = (cx, cy) => inb(cx, cy) && !mat[cy * CW + cx];
  const put = (arr, i, c, a) => { arr[i * 4] = c[0]; arr[i * 4 + 1] = c[1]; arr[i * 4 + 2] = c[2]; arr[i * 4 + 3] = a == null ? 255 : a; };
  let FU = 0;                                         // the fuel kind of what's being painted
  const tset = (cx, cy, c) => { if (solidC(cx, cy)) { put(d, cy * CW + cx, c); if (fuel) fuel[cy * CW + cx] = FU; } };      // onto the rock
  const dset = (cx, cy, c, a) => { if (openC(cx, cy)) { put(dd, cy * CW + cx, c, a); if (fuel) fuel[cy * CW + cx] = FU; } }; // the decoration layer
  const jit = (c, j) => [c[0] + (R() - 0.5) * j, c[1] + (R() - 0.5) * j, c[2] + (R() - 0.5) * j];
  const shade = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  const pick = (a, b) => mix(a, b, R());

  // ---- where things can go: one scan of the cave, above the shop ----
  const Y0 = 40, Y1 = SHOP_TOP - 14;
  const sites = { floor: [], ceil: [], wall: [], air: [] };
  const openRun = (cx, cy, dir, n) => { for (let k = 1; k <= n; k++) if (!openC(cx, cy + dir * k)) return false; return true; };
  for (let cy = Y0; cy < Y1; cy++) for (let cx = 8; cx < CW - 8; cx++) {
    const i = cy * CW + cx;
    if (mat[i]) continue;
    if (solidC(cx, cy + 1) && openRun(cx, cy, -1, 12)) sites.floor.push(i);
    if (solidC(cx, cy - 1) && openRun(cx, cy, 1, 12)) sites.ceil.push(i);
    if (!(cy & 1)) {
      const s = solidC(cx - 1, cy) ? -1 : solidC(cx + 1, cy) ? 1 : 0;
      if (s && solidC(cx + s, cy - 3) && solidC(cx + s, cy + 3) && openC(cx - s * 6, cy) && openC(cx - s * 3, cy))
        sites.wall.push(i * 2 + (s > 0 ? 1 : 0));
    }
    if (cx % 5 === 0 && cy % 5 === 0 && openC(cx - 12, cy) && openC(cx + 12, cy) && openC(cx, cy - 12) &&
        openC(cx, cy + 12) && openC(cx - 8, cy - 8) && openC(cx + 8, cy + 8) && openC(cx + 8, cy - 8) && openC(cx - 8, cy + 8))
      sites.air.push(i);
  }
  // a level stretch of floor `w` cells either side, with the air above it clear
  const flatAt = (cx, cy, w) => {
    for (let dx = -w; dx <= w; dx++)
      if (!solidC(cx + dx, cy + 1) || !openC(cx + dx, cy) || !openC(cx + dx, cy - 3)) return false;
    return true;
  };
  // a dip: the floor climbs at least two cells within a few cells on both sides
  const pitAt = (cx, cy) => {
    const side = s => { for (let k = 3; k <= 14; k++) if (solidC(cx + s * k, cy - 2)) return true; return false; };
    return side(-1) && side(1);
  };
  // how far the floor runs level either side, capped, for the width of a zone
  const runOf = (cx, cy, s, cap) => {
    let k = 0;
    while (k < cap && solidC(cx + s * (k + 1), cy + 1) && openC(cx + s * (k + 1), cy)) k++;
    return k;
  };
  const upTo = (cx, cy, cap) => { let k = 0; while (k < cap && openC(cx, cy - k - 1)) k++; return k; };
  const downTo = (cx, cy, cap) => { let k = 0; while (k < cap && openC(cx, cy + k + 1)) k++; return k; };

  // ---- pass 2 bakes ----
  const bake = {
    moss(cx, cy) {                       // a thick soft patch on the ground, grass tufts on top
      const w = 5 + Math.floor(R() * 8);
      for (let dx = -w; dx <= w; dx++) {
        const deep = Math.round((2 + R() * 3) * (1 - Math.abs(dx) / (w + 1)) + 1);
        FU = FUEL_MOSS;
        for (let k = 1; k <= deep; k++) tset(cx + dx, cy + k, jit(pick(T.moss[0], T.moss[1]), 14));
        FU = FUEL_GRASS;
        // @ts-expect-error a boolean counts as 0 or 1 here, on purpose (1 or 2 rows tall)
        if (R() < 0.35) { const tall = 1 + (R() < 0.4); for (let k = 0; k < tall; k++) dset(cx + dx, cy - k, jit(T.moss[1], 20)); }
      }
      FU = 0;
    },
    rubble(cx, cy) {                     // a mound of broken brick with moss grown over it
      const w = 3 + Math.floor(R() * 4), hh = 2 + R() * 2.5;
      for (let dx = -w; dx <= w; dx++) {
        const top = Math.round((1 - (dx / (w + 1)) ** 2) * hh);
        for (let k = 0; k < top; k++) {
          const mossy = k === top - 1 && R() < 0.7;
          const c = mossy ? pick(T.moss[0], T.moss[1])
            : R() < 0.2 ? T.mortar : pick(T.brick[0], T.brick[1]);
          FU = mossy ? FUEL_GRASS : 0;
          dset(cx + dx, cy - k, jit(c, 12));
        }
      }
      FU = 0;
    },
    beams(cx, cy) {                      // pit props: a timber set, only where the roof will bear on it
      FU = FUEL_WOOD;
      const ok = timberFrame(mat, dset, R, T, cx - 8, cx + 8, cy - 3, false, cy + 1);
      FU = 0;
      if (!ok) return false;
    },
    pickaxe(cx, cy) {                    // head buried in the rock, the haft sticking out
      const s = R() < 0.5 ? -1 : 1, haft = [104, 74, 46], iron = [120, 124, 132];
      FU = FUEL_WOOD;
      for (let k = 0; k < 7; k++) dset(cx + s * k, cy - k, jit(haft, 12));
      FU = 0;
      for (let k = -2; k <= 2; k++) tset(cx + k, cy + 1 + (Math.abs(k) === 2), jit(iron, 16));
      tset(cx, cy + 2, iron);
    },
    cracks(cx, cy, c) {                  // a dry crack wandering down into the ground
      c = c || shade(T.mortar, 0.8);
      let x = cx, y = cy + 1;
      for (let k = 0; k < 8 + R() * 8; k++) {
        tset(x, y, jit(c, 8));
        if (R() < 0.15) { let bx = x, by = y; for (let j = 0; j < 4; j++) { bx += R() < 0.5 ? -1 : 1; by++; tset(bx, by, jit(c, 8)); } }
        y++; x += Math.floor(R() * 3) - 1;
      }
    },
    fissure(cx, cy, side) {              // glowing neon cracks, into the floor or into a wall
      const glow = T.moss[1], halo = T.moss[0];
      let x = side ? cx + side : cx, y = side ? cy : cy + 1;
      for (let k = 0; k < 10 + R() * 10; k++) {
        tset(x, y, glow);
        if (side) { tset(x, y - 1, halo); tset(x, y + 1, halo); x += side; y += Math.floor(R() * 3) - 1; }
        else { tset(x - 1, y, halo); tset(x + 1, y, halo); y++; x += Math.floor(R() * 3) - 1; }
      }
    },
    bones(cx, cy) {                      // a bone half sunk in the ground
      const len = 4 + Math.floor(R() * 4), bone = [222, 214, 192];
      for (let k = 0; k < len; k++) { dset(cx + k, cy, jit(bone, 12)); tset(cx + k, cy + 1, jit(shade(bone, 0.85), 12)); }
      dset(cx - 1, cy - 1, bone); dset(cx + len, cy - 1, bone);
    },
    pillar(cx, cy) {                     // a salt column from the floor to the roof, behind you
      const hgt = upTo(cx, cy, 90);
      if (hgt < 20 || hgt >= 90) return false;
      const w = 2 + Math.floor(R() * 3), top = cy - hgt;
      for (let y = top; y <= cy; y++) {
        const flare = Math.max(0, 3 - Math.min(y - top, cy - y));
        for (let dx = -w - flare; dx <= w + flare; dx++) {
          const c = dx < 0 ? T.moss[1] : dx === 0 ? [236, 232, 214] : T.moss[0];
          dset(cx + dx, y, jit(shade(c, 0.72), 8));
        }
      }
    },
    gear(cx, cy) {                       // a big rusted cog set into the back wall
      const r = 5 + Math.floor(R() * 9), teeth = 8 + Math.floor(R() * 5), rust = shade(T.rock[1], 0.7);
      const ph = R() * 6.28;
      for (let dy = -r - 2; dy <= r + 2; dy++) for (let dx = -r - 2; dx <= r + 2; dx++) {
        const dist = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        const tooth = Math.cos((a + ph) * teeth) > 0.3 ? 2 : 0;
        const rim = dist <= r + tooth && dist >= r - 2;
        const spoke = dist < r - 2 && (Math.abs(Math.sin((a + ph) * 2)) < 0.18 || dist < 2.5);
        if (rim || spoke) dset(cx + dx, cy + dy, jit(shade(rust, rim && tooth ? 0.85 : 1), 12));
      }
    },
    ribs(cx, cy) {                       // a ribcage arching over the floor, behind you
      const hgt = upTo(cx, cy, 80);
      if (hgt < 24) return false;
      const bone = [214, 206, 184], H = Math.min(hgt - 2, 36);
      for (let k = 0; k < 4; k++) {
        const a = 16 - k * 3, b = H - k * 5, ox = cx + k * 4 - 6, f = 0.78 - k * 0.1;
        for (let t = 0; t <= 60; t++) {
          const th = Math.PI * t / 60, x = ox + Math.cos(th) * a, y = cy - Math.sin(th) * b;
          dset(Math.round(x), Math.round(y), jit(shade(bone, f), 8));
          dset(Math.round(x) + 1, Math.round(y), jit(shade(bone, f * 0.85), 8));
        }
      }
    },
    charred(cx, cy) {                    // a burnt log or a heap of cinders
      const len = 3 + Math.floor(R() * 5);
      for (let k = 0; k < len; k++) {
        dset(cx + k, cy, R() < 0.12 ? [190, 84, 30] : jit([34, 28, 26], 10));
        if (R() < 0.5) dset(cx + k, cy - 1, jit([48, 42, 40], 10));
      }
    },
    soot(bx, by) {                       // a soot stain darkening the back wall
      const r = 5 + R() * 10;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = Math.round(bx + dx), y = Math.round(by + dy), f = 1 - Math.hypot(dx, dy) / r;
        if (f <= 0 || x < 0 || y < 0 || x >= BW || y >= BH) continue;
        const k = (y * BW + x) * 4, m = 1 - 0.55 * f;
        bd[k] *= m; bd[k + 1] *= m; bd[k + 2] *= m;
      }
    },
    algae(cx, cy) {                      // the ground here was laid as brick once, long ago
      const w = 6 + Math.floor(R() * 9);
      for (let dx = -w; dx <= w; dx++) for (let k = 1; k <= 7; k++) {
        const x = cx + dx, y = cy + k;
        if (!inb(x, y) || mat[y * CW + x] !== ROCK) continue;
        mat[y * CW + x] = BRICK;                    // brick for rock: just as solid
        const kk = x + (y % 2) * 3;
        const top = !mat[(y - 1) * CW + x] || (y > 1 && !mat[(y - 2) * CW + x]);
        put(d, y * CW + x, top ? jit(pick(T.moss[0], T.moss[1]), 16)
          : kk % 6 === 0 ? T.mortar : jit(pick(T.brick[0], T.brick[1]), 8));
      }
    },
  };

  // ---- pass 3 props ----
  const props = [], baked = {}, amb = [];
  const boxOf = (kind, style, side) => {
    let b = PROP_BOX[kind];
    if (b && !Array.isArray(b)) b = b[style];
    b = b ? b.slice() : [-4, -4, 4, 4];
    if (side === 'ceil' && kind === 'spike') b = [b[0], 0, b[2], -b[1]];   // hanging the other way
    return b;
  };
  // the first ceiling (open cell, rock above, room below) in column cx within `span` rows of cy
  const ceilNear = (cx, cy, span) => {
    for (let k = 0; k <= span; k++) for (const y of k ? [cy - k, cy + k] : [cy]) {
      if (y < Y0 || y >= Y1 || cx < 8 || cx >= CW - 8) continue;
      if (openC(cx, y) && solidC(cx, y - 1) && openRun(cx, y, 1, 12)) return y;
    }
    return -1;
  };
  // one prop of kind `it` at cell (cx, cy), or null if the spot doesn't suit it
  function makeProp(it, cx, cy, at, side) {
    const x = at === 'wall' ? (side < 0 ? cx : cx + 1) * CELL : (cx + 0.5) * CELL;
    const y = at === 'floor' || it.at === 'flat' || it.at === 'pit' ? (cy + 1) * CELL : at === 'ceil' ? cy * CELL : (cy + 0.5) * CELL;
    const pr = { id: it.id, k: it.kind, st: it.style, x, y, t: R() * 10, seed: R() };
    if (at === 'ceil') pr.anc = [cx, cy - 1];
    else if (at === 'wall') { pr.anc = [cx + side, cy]; pr.side = side; }
    else if (at === 'floor' || it.at === 'flat' || it.at === 'pit') pr.anc = [cx, cy + 1];
    pr.hang = at === 'ceil' ? 1 : 0;
    let box = boxOf(it.kind, it.style, at);
    if (it.kind === 'climb') {
      if (at === 'wall') {                   // a frozen fall runs down the wall face
        let k = 0; while (k < 50 && solidC(cx + side, cy + k + 1) && openC(cx, cy + k + 1)) k++;
        if (k < 10) return null;
        pr.len = k * CELL;
        box = side < 0 ? [0, -4, 7, pr.len] : [-7, -4, 0, pr.len];
      } else {                               // plants hang anywhere from a short tuft to long
        const room = downTo(cx, cy, 90);
        if (room < 12) return null;
        const most = Math.min(64, SHOP_TOP - 16 - cy);          // never down into the shop
        if (most < 8) return null;
        pr.len = Math.round(Math.max(8, Math.min(room * (0.25 + R() * 0.55), most)) * CELL);
        box = [-5, 0, 5, pr.len];
      }
    } else if (it.kind === 'zone') {
      const cap = it.at === 'pit' ? 10 : 16;
      const lft = runOf(cx, cy, -1, cap), rgt = runOf(cx, cy, 1, cap);
      if (lft + rgt < 6) return null;
      box = [-lft * CELL, -5, (rgt + 1) * CELL, 1];
      pr.x = cx * CELL; pr.anc = [cx, cy + 1];
    } else if (it.kind === 'drip' && at === 'wall') {
      box = side < 0 ? [0, -4, 8, 4] : [-8, -4, 0, 4];
    } else if (it.kind === 'lamp' && at === 'wall') {
      box = side < 0 ? [0, -7, 9, 7] : [-9, -7, 0, 7];
    } else if (it.kind === 'noise' && at === 'wall') {
      box = side < 0 ? [0, -10, 10, 10] : [-10, -10, 0, 10];
    } else if (it.kind === 'shard' && at === 'wall') {
      box = side < 0 ? [0, -4, 6, 4] : [-6, -4, 0, 4];
    }
    if (it.kind === 'cover') pr.hp = it.hp || 0;          // 0: it can't be broken
    if (it.kind === 'tendril') pr.ang = -Math.PI / 2 + (R() - 0.5) * 1.2;
    pr.l = box[0]; pr.t0 = box[1]; pr.r = box[2]; pr.b = box[3];
    return pr;
  }
  const plant = it => it.kind === 'climb' && PLANTS[it.style];
  // a few more of the same plant hanging right beside one, so a vine is never on its own
  const clump = (it, cx, cy, n) => {
    for (let k = 0; k < n; k++) {
      const sx = cx + Math.round((R() - 0.5) * 18), sy = ceilNear(sx, cy, 6);
      const pr = sy >= 0 && makeProp(it, sx, sy, 'ceil', 0);
      if (pr) props.push(pr);
    }
  };
  function place(it) {
    const want = it.n * DECOR_DENSITY * (floor === 2 ? DEV.l2Decor : 1), got = [];   // floor 2: its Dev knob
    const pool = it.at === 'surf' ? null : it.at === 'flat' || it.at === 'pit' ? sites.floor : sites[it.at];
    for (let a = 0; a < want * 40 && got.length < want; a++) {
      let at = it.at, i, side = 0;
      if (at === 'bg') {                       // anywhere on the back wall
        const bx = R() * BW, by = R() * (SHOP_TOP / 4 - 10);
        if (bake[it.style](bx, by) !== false) got.push(1);
        continue;
      }
      if (at === 'surf') at = R() < 0.5 ? 'floor' : 'wall';
      if (it.both && R() < 0.4) at = 'ceil';
      const src = at === 'floor' || at === 'ceil' || at === 'wall' || at === 'air' ? sites[at] : pool;
      if (!src.length) break;
      i = src[Math.floor(R() * src.length)];
      if (at === 'wall') { side = i & 1 ? 1 : -1; i >>= 1; }
      const cx = i % CW, cy = (i / CW) | 0;
      if (it.at === 'flat' && !flatAt(cx, cy, it.w || 3)) continue;
      if (it.at === 'pit' && !pitAt(cx, cy)) continue;
      // keep the same kind spread out over the cave
      const x = (cx + 0.5) * CELL, y = cy * CELL;
      const gap = it.kind === 'bake' ? 14 : 40;
      if (got.some(g => Math.abs(g.x - x) < gap && Math.abs(g.y - y) < gap)) continue;
      if (it.kind === 'bake') {
        if (bake[it.style](cx, cy, it.style === 'fissure' && at === 'wall' ? side : undefined) === false) continue;
        got.push({ x, y });
        continue;
      }
      const pr = makeProp(it, cx, cy, at, side);
      if (!pr) continue;
      got.push({ x, y });
      props.push(pr);
      if (plant(it)) clump(it, cx, cy, 1 + Math.floor(R() * 3));
    }
    baked[it.id] = it.kind === 'bake' ? got.length : 0;
  }
  for (const it of list) {
    if (it.kind === 'amb') { amb.push(it.style); baked[it.id] = 0; continue; }
    place(it);
  }

  // ---- groves: patches of thick growth, densest in the middle and thinning outwards ----
  // Each is a ceiling spot with a radius. Hanging plants are dropped at a distance picked
  // uniformly from 0..r, which crowds them toward the middle (the same count spread over a
  // ring that grows with distance), and the overgrowth bake paints moss, grass, drapes and
  // leaves with a chance that fades to nothing at the edge.
  const green = list.find(plant);
  baked.groves = 0;
  if (green && sites.ceil.length) {
    const groves = [];
    for (let a = 0; a < 600 && groves.length < GROVES; a++) {
      const i = sites.ceil[Math.floor(R() * sites.ceil.length)];
      const cx = i % CW, cy = (i / CW) | 0;
      if (groves.some(g => Math.hypot(g.cx - cx, g.cy - cy) < 100)) continue;
      groves.push({ cx, cy, r: 32 + R() * 34 });
    }
    for (const g of groves) {
      overgrow(g.cx, g.cy, g.r * 1.5);
      const n = 14 + Math.floor(R() * 12);
      for (let k = 0, got = 0; k < n * 4 && got < n; k++) {
        const d = g.r * R(), a = R() * 6.283;
        const sx = Math.round(g.cx + Math.cos(a) * d), sy = ceilNear(sx, Math.round(g.cy + Math.sin(a) * d * 0.6), 24);
        const pr = sy >= 0 && makeProp(green, sx, sy, 'ceil', 0);
        if (pr) { props.push(pr); got++; }
      }
    }
    baked.groves = groves.length;
  }

  // ---- arched vines (v87): a long vine slung between two ceiling spots over an open pocket,
  // thick with leaves, with strands hanging off it. They come in clusters, and on a zoned
  // floor only in the natural zones (the built-up corridors are too low for them).
  baked.arches = 0;
  if (green && sites.ceil.length) {
    const K = k => kr(k, R), cnt = v => Math.floor(v) + (R() < v % 1 ? 1 : 0);
    const nat = (cx, cy) => !zone || !zone[cy * CW + cx];
    const spots = [], nC = cnt(Math.max(0, K('arVines')));
    for (let tries = 0; spots.length < nC && tries < nC * 80 + 80; tries++) {
      const i = sites.ceil[Math.floor(R() * sites.ceil.length)];
      const cx = i % CW, cy = (i / CW) | 0;
      if (!nat(cx, cy) || spots.some(g => Math.hypot(g.cx - cx, g.cy - cy) < 80)) continue;
      const want = Math.max(1, cnt(K('arCluster')));
      let got = 0;
      for (let t = 0; t < want * 30 && got < want; t++) {
        const ax = got ? cx + Math.round((R() - 0.5) * 50) : cx, ay = got ? ceilNear(ax, cy, 24) : cy;
        if (ay < 0 || !nat(ax, ay)) continue;
        const span = K('arSpan'), bx = Math.round(ax + (R() < 0.5 ? -1 : 1) * span);
        const by = ceilNear(bx, Math.round(ay + K('arRise') * span * (R() < 0.5 ? -1 : 1)), Math.round(span * 0.25) + 4);
        if (by < 0 || !nat(bx, by)) continue;
        if (archProp(ax, ay, bx, by, K, cnt, nat)) { got++; baked.arches++; }
      }
      if (got) spots.push({ cx, cy });
    }
  }
  // one arch from ceiling spot (ax, ay) to (bx, by), terrain pixels, and its strands; null if
  // it would pass through rock or doesn't hang over enough open air
  function archProp(ax, ay, bx, by, K, cnt, nat) {
    const A = { x: (ax + 0.5) * CELL, y: ay * CELL }, B = { x: (bx + 0.5) * CELL, y: by * CELL };
    const slack = K('arSlack'), chord = Math.hypot(B.x - A.x, B.y - A.y);
    const n = Math.max(8, Math.min(40, Math.round(chord / 6)));
    const pts = archCurve(A.x, A.y, B.x, B.y, slack, n);
    // walk it half a pixel at a time: all of it in open air, in a natural zone
    let low = pts[0], alen = 0;
    for (let k = 0; k < n; k++) {
      const p = pts[k], q = pts[k + 1], l = Math.hypot(q.x - p.x, q.y - p.y), m = Math.max(1, Math.ceil(l * 2 / CELL));
      alen += l;
      for (let j = 0; j <= m; j++) {
        const x = p.x + (q.x - p.x) * j / m, y = p.y + (q.y - p.y) * j / m;
        const cx = Math.floor(x / CELL);
        if (!openC(cx, Math.floor(y / CELL)) || !openC(cx, Math.floor((y + 1) / CELL)) || !nat(cx, Math.floor(y / CELL))) return null;
      }
      if (q.y > low.y) low = q;
    }
    const lx = Math.floor(low.x / CELL), ly = Math.floor(low.y / CELL);
    if (downTo(lx, ly, 150) < K('arClear') || ly >= SHOP_TOP - 24) return null;
    const pr = { id: 'arch', k: 'climb', st: green.style, x: A.x, y: A.y, t: R() * 10, seed: R(), hang: 1,
      anc: [ax, ay - 1], anc2: [bx, by - 1], arc: pts.map(p => [p.x - A.x, p.y - A.y]),
      thick: Math.max(1, Math.round(K('arThick'))), alen };
    let l = 0, r = 0, t0 = 0, b = 0;
    for (const [x, y] of pr.arc) { l = Math.min(l, x); r = Math.max(r, x); t0 = Math.min(t0, y); b = Math.max(b, y); }
    props.push(pr);
    // strands hanging off it, spaced at random along it
    const ns = cnt(K('arStrands') * alen / (10 * CELL));
    for (let s = 0; s < ns; s++) {
      const u = R(), q = archAt(pr, u);
      q.u = u;
      const room = downTo(Math.floor(q.x / CELL), Math.floor(q.y / CELL), 90);
      const len = Math.round(Math.min(K('arStrandLen'), room * 0.7, SHOP_TOP - 20 - q.y / CELL) * CELL);
      if (len < 4) continue;
      props.push({ id: 'archStrand', k: 'climb', st: green.style, x: q.x, y: q.y, t: R() * 10, seed: R(), hang: 1,
        len, on: pr, u: q.u, l: -5, t0: 0, r: 5, b: len });
      b = Math.max(b, q.y - A.y + len);
    }
    pr.l = l - 4; pr.r = r + 4; pr.t0 = t0 - 3; pr.b = b + 3;
    return pr;
  }
  // thick growth round (gx, gy) out to radius rr, fading with distance
  function overgrow(gx, gy, rr) {
    const leaf = T.moss[1], dark = shade(T.moss[0], 0.8);
    const bloom = [[236, 214, 120], [226, 140, 170], [240, 240, 230]];
    for (let y = Math.max(Y0, Math.round(gy - rr)); y <= Math.min(Y1, Math.round(gy + rr)); y++)
      for (let x = Math.max(4, Math.round(gx - rr)); x <= Math.min(CW - 5, Math.round(gx + rr)); x++) {
        const f = 1 - Math.hypot(x - gx, (y - gy) * 1.3) / rr;
        if (f <= 0 || !openC(x, y)) continue;
        const p = Math.pow(f, 1.2);
        FU = FUEL_MOSS;
        if (solidC(x, y + 1)) {                    // floor: moss into the rock, grass on top
          if (R() < p) { tset(x, y + 1, jit(pick(T.moss[0], T.moss[1]), 16)); if (R() < p) tset(x, y + 2, jit(dark, 12)); }
          FU = FUEL_GRASS;
          if (R() < p * 0.85) {
            const tall = 1 + Math.floor(R() * (1 + 4 * f));
            for (let k = 0; k < tall; k++) dset(x, y - k, jit(k === tall - 1 ? leaf : pick(T.moss[0], leaf), 18));
            if (R() < 0.06 * f) dset(x, y - tall, bloom[Math.floor(R() * bloom.length)]);
          }
        } else if (solidC(x, y - 1)) {             // ceiling: moss drapes hanging down
          if (R() < p) tset(x, y - 1, jit(pick(T.moss[0], T.moss[1]), 16));
          FU = FUEL_GRASS;
          if (R() < p * 0.75) {
            const len = 1 + Math.floor(R() * (2 + 9 * f));
            for (let k = 0; k < len; k++) dset(x, y + k, jit(k > len - 2 ? leaf : dark, 14));
          }
        } else if ((solidC(x - 1, y) || solidC(x + 1, y)) && R() < p * 0.5) {
          FU = FUEL_GRASS;
          dset(x, y, jit(pick(T.moss[0], leaf), 16));   // wall: creeping leaves
        }
        FU = 0;
      }
  }
  // lanterns all through the built-up zones (v88): on the walls, and hung off the roof on a
  // chain. Shoot one and it pops, throwing burning oil (see popLamp in the Game).
  baked.lanterns = 0;
  if (zone && (sites.ceil.length || sites.wall.length)) {
    const want = Math.round(kr('lvLamps', R)), got = [];
    const isB = (cx, cy) => zone[cy * CW + cx] === 1;
    for (let a = 0; a < want * 40 && got.length < want; a++) {
      const wall = sites.wall.length && (R() < 0.35 || !sites.ceil.length);
      let i = wall ? sites.wall[Math.floor(R() * sites.wall.length)] : sites.ceil[Math.floor(R() * sites.ceil.length)], side = 0;
      if (wall) { side = i & 1 ? 1 : -1; i >>= 1; }
      const cx = i % CW, cy = (i / CW) | 0;
      if (!isB(cx, cy) || got.some(g => Math.hypot(g.x - cx, g.y - cy) < 36)) continue;
      let pr;
      if (wall) pr = makeProp({ id: 'lanterns', kind: 'lamp', style: 'lantern', at: 'wall' }, cx, cy, 'wall', side);
      else {
        const room = downTo(cx, cy, 60);
        if (room < 18) continue;
        pr = makeProp({ id: 'hanglamps', kind: 'lamp', style: 'hanglamp', at: 'ceil' }, cx, cy, 'ceil', 0);
        if (pr) { pr.len = Math.round((2 + R() * Math.min(7, room * 0.3)) * CELL); pr.b = pr.len + 9; }
      }
      if (!pr) continue;
      got.push({ x: cx, y: cy });
      props.push(pr);
    }
    baked.lanterns = got.length;
  }
  return { props: cullDecor(props, keep || []), amb, baked };
}
// Load-time cleanup: drop any prop whose box overlaps one already kept (first placed wins),
// or that sits on a keep-out spot, so nothing starts life clipped into something else.
/** @param {Prop[]} props @param {Spot[]} keep @returns {Prop[]} */
export function cullDecor(props, keep) {
  const out = [];
  const pad = 3;
  const dropped = new Set();
  for (const pr of props) {
    if (pr.arc) {                          // an arched vine: its curve, not its big box
      if (pr.arc.some(([x, y]) => keep.some(k => Math.hypot(pr.x + x - k.x, pr.y + y - k.y) < k.r) ||
        out.some(o => o.k !== 'climb' && pr.x + x > o.x + o.l - pad && pr.x + x < o.x + o.r + pad &&
          pr.y + y > o.y + o.t0 - pad && pr.y + y < o.y + o.b + pad))) { dropped.add(pr); continue; }
      out.push(pr);
      continue;
    }
    if (pr.on && dropped.has(pr.on)) continue;
    const x0 = pr.x + pr.l - pad, x1 = pr.x + pr.r + pad, y0 = pr.y + pr.t0 - pad, y1 = pr.y + pr.b + pad;
    if (keep.some(k => k.x + k.r > x0 && k.x - k.r < x1 && k.y + k.r > y0 && k.y - k.r < y1)) continue;
    // plants may hang through each other (that's what a clump is); nothing else may overlap
    if (out.some(o => !(o.k === 'climb' && pr.k === 'climb') && !o.arc &&
      o.x + o.l < x1 && o.x + o.r > x0 && o.y + o.t0 < y1 && o.y + o.b > y0)) continue;
    out.push(pr);
  }
  return out;
}
// is a prop's anchoring rock still there? The cell it hangs off, or either neighbour, so a
// one-pixel nick doesn't drop it — you have to really cut it loose.
/** @param {{ on?: Prop, anc?: number[], anc2?: number[] }} pr @param {Uint8Array} mat @returns {boolean} */
export function propAnchored(pr, mat) {
  if (pr.on) return !pr.on.fall && !pr.on.gone;          // a strand hangs off its arched vine
  if (pr.anc2 && !propAnchored({ anc: pr.anc2 }, mat)) return false;   // an arch needs both ends
  if (!pr.anc) return true;
  const [cx, cy] = pr.anc;
  for (let dx = -1; dx <= 1; dx++) {
    const x = cx + dx;
    if (x >= 0 && x < CW && cy >= 0 && cy < CH && mat[cy * CW + x]) return true;
  }
  return false;
}
