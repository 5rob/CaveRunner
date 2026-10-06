// @ts-check
// Floor 2's loot (Level 2 stage 6): no creatures in the wasteland, their gold lying where they'd
// have stood instead, a share of the spots with a red crystal too, and a prize in each dark zone's
// chamber (a stash of gold, red crystals or green ones). Pure, on its own random stream from the seed.

import { CELL, CH, CW, SHOP_TOP } from '../core/consts.js';
import { enemyFor } from '../data/creatures.js';
import { NUGGETS } from './nuggets.js';

// the prize kinds and their amounts (owner's brief: 1000–2000 gold, 4–6 red, 1–3 green)
export const PRIZES = { gold: [1000, 2000], red: [4, 6], green: [1, 3] };
/** @type {('gold' | 'red' | 'green')[]} */
export const PRIZE_KINDS = ['gold', 'red', 'green'];
export const STASH_N = 56;               // a gold prize: so many nuggets, scattered over the chamber's floor
export const SIZE_W = [0.3, 0.35, 0.35];  // how often each size (big, medium, small) comes up in a scatter
export const CRYS_Y = 9;                 // a crystal's middle above the ground (as the cave's pickups)

/** a zone's prize, rolled from a 0..1 pair: which kind, and how much
 * @param {number} u @param {number} v @returns {{ kind: 'gold' | 'red' | 'green', n: number }} */
export function rollPrize(u, v) {
  const kind = PRIZE_KINDS[Math.min(2, Math.floor(u * 3))], [lo, hi] = PRIZES[kind];
  return { kind, n: kind === 'gold' ? Math.round(lo + v * (hi - lo)) : lo + Math.min(hi - lo, Math.floor(v * (hi - lo + 1))) };
}

/** the open cell on the ground under (cx, cy): its y, or -1 (no floor within `reach` cells)
 * @param {Uint8Array} mat @param {number} cx @param {number} cy @param {number} reach */
export function groundBelow(mat, cx, cy, reach) {
  if (mat[cy * CW + cx]) return -1;
  let gy = cy;
  while (gy - cy < reach && gy + 1 < CH && !mat[(gy + 1) * CW + cx]) gy++;
  return gy + 1 < CH && mat[(gy + 1) * CW + cx] ? gy : -1;
}

/** an amount as a random scattering of nuggets of all three sizes on the ground round (x, gy) (owner: not
 * piles of one size). n nuggets, each a size rolled by SIZE_W, worth a share of the amount by its size's
 * worth (adding up exactly), each put on the ground under a spot within ± spread world units
 * @param {Coin[]} out @param {Uint8Array} mat @param {number} x world @param {number} gy the open cell on the ground
 * @param {number} amount @param {number} n @param {number} spread @param {() => number} rnd */
export function scatterGold(out, mat, x, gy, amount, n, spread, rnd) {
  n = Math.max(1, Math.min(n, Math.round(amount)));
  const sz = [];
  for (let k = 0; k < n; k++) { const u = rnd(); sz.push(u < SIZE_W[0] ? 0 : u < SIZE_W[0] + SIZE_W[1] ? 1 : 2); }
  const w = sz.map(s => NUGGETS[s].v), tw = w.reduce((a, b) => a + b, 0);
  let given = 0, acc = 0;
  for (let k = 0; k < n; k++) {
    acc += w[k];
    const v = Math.max(1, Math.round(amount * acc / tw) - given);
    given += v;
    const r = NUGGETS[sz[k]].r;
    // a spot along the ground: the floor under it within a few cells of the drop's ground (else at the drop)
    let nx = x + (rnd() * 2 - 1) * spread, c = Math.max(1, Math.min(CW - 2, Math.floor(nx / CELL))), fy = -1;
    for (let dy = -6; dy <= 6 && fy < 0; dy++) { const y = gy + dy; if (y > 0 && y + 1 < CH && !mat[y * CW + c] && mat[(y + 1) * CW + c]) fy = y; }
    if (fy < 0) { nx = x; fy = gy; }
    out.push({ x: nx, y: (fy + 1) * CELL - r, amount: v, sz: sz[k], t: rnd() * 6.28, a: rnd() * 6.28, vx: 0, vy: 0 });
  }
  // the rounding's change on the last one (the total exact)
  if (out.length) out[out.length - 1].amount += Math.round(amount) - given;
}

/**
 * Floor 2's loot. The spots: `want` of them, picked by the enemies' spawn rules (an open disc of
 * 8 px, 200 world units from the start, 90 apart), outside every dark zone and its fringe
 * (`shade` 0), dropped to the ground below. Each gets the gold its creature (rolled off `roster`)
 * would drop as nuggets; `reds` of them also a red crystal. Each zone's chamber gets `zone.prize`.
 * @param {{ mat: Uint8Array, shade: Uint8Array, zones: DarkZone[], start: Pt, seed: number, want: number,
 *   roster: string[], floor: number, reds: number }} o
 * @returns {{ coins: Coin[], pickups: Pickup[], spots: { x: number, y: number, gold: number, red: boolean }[] }}
 */
export function floorLoot(o) {
  const { mat, shade, zones, start, want, roster, floor } = o;
  let rs = (Math.imul(o.seed | 0, 40503) + 2711 >>> 0) % 2147483646 + 1;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 6; i++) rnd();
  /** @param {number} cx @param {number} cy @param {number} r */
  const clear = (cx, cy, r) => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= CW || y >= CH || mat[y * CW + x] || shade[y * CW + x]) return false;
      }
    return true;
  };
  // no zone's shade (the fringe either) in the box round where the loot lies: 12 px each way, 14 up
  /** @param {number} cx @param {number} gy */
  const shadeNear = (cx, gy) => {
    for (let y = Math.max(0, gy - 14); y <= Math.min(CH - 1, gy + 1); y++)
      for (let x = Math.max(0, cx - 12); x <= Math.min(CW - 1, cx + 12); x++) if (shade[y * CW + x]) return true;
    return false;
  };
  /** @type {{ x: number, y: number, gold: number, red: boolean, gy: number }[]} */
  const spots = [];
  for (let a = 0; a < 20000 && spots.length < want; a++) {
    const cx = 8 + Math.floor(rnd() * (CW - 16)), cy = 50 + Math.floor(rnd() * (SHOP_TOP - 70));
    if (!clear(cx, cy, 8)) continue;
    const x = cx * CELL, y = cy * CELL;
    if (Math.hypot(x - start.x, y - start.y) < 200) continue;
    if (spots.some(e => Math.hypot(e.x - x, e.y - y) < 90)) continue;
    const gy = groundBelow(mat, cx, cy, 200);
    if (gy < 0 || shadeNear(cx, gy)) continue;
    const k = enemyFor(roster[Math.floor(rnd() * roster.length)], floor);
    spots.push({ x, y, gold: k.gold + Math.floor(rnd() * 3), red: false, gy });
  }
  // the red crystals: `reds` of the spots, spread (every n-th, from a seeded start)
  const reds = Math.min(o.reds, spots.length), step = spots.length / Math.max(1, reds), off = rnd() * step;
  for (let n = 0; n < reds; n++) spots[Math.floor(off + n * step) % spots.length].red = true;
  /** @type {Coin[]} */
  const coins = [];
  /** @type {Pickup[]} */
  const pickups = [];
  for (const s of spots) {
    scatterGold(coins, mat, s.x, s.gy, s.gold, 3 + Math.floor(rnd() * 5), 26, rnd);
    const side = [14, -14, 0].find(d => !mat[s.gy * CW + Math.round((s.x + d) / CELL)] && mat[(s.gy + 1) * CW + Math.round((s.x + d) / CELL)]);
    if (s.red) pickups.push({ kind: 'crystal', x: s.x + (side || 0), y: (s.gy + 1) * CELL - CRYS_Y, floor, t: rnd() * 6.28 });
  }
  // the prizes, on each chamber's floor in the middle; at least one zone's is green crystals (owner)
  const prizes = zones.map(() => rollPrize(rnd(), rnd())), gv = rnd(), gz = Math.floor(rnd() * zones.length);
  if (zones.length && !prizes.some(p => p.kind === 'green')) prizes[gz] = rollPrize(0.99, gv);
  zones.forEach((z, i) => placePrize(coins, pickups, mat, z, prizes[i], floor, rnd));
  return { coins, pickups, spots: spots.map(s => ({ x: s.x, y: (s.gy + 1) * CELL, gold: s.gold, red: s.red })) };
}

/** a zone's prize put on its chamber's floor in the middle (and recorded as `zone.prize`); tools/lootshots.js
 * calls it to show each kind
 * @param {Coin[]} coins @param {Pickup[]} pickups @param {Uint8Array} mat @param {DarkZone} z
 * @param {{ kind: 'gold' | 'red' | 'green', n: number }} p @param {number} floor @param {() => number} rnd */
export function placePrize(coins, pickups, mat, z, p, floor, rnd) {
  const c = z.chamber, cx = Math.round(c.x);
  const gy = groundBelow(mat, cx, Math.round(c.y), Math.round(c.ry) + 12);
  const fy = gy >= 0 ? gy : Math.round(c.floor) - 1, x = cx * CELL;
  z.prize = { kind: p.kind, n: p.n, x, y: (fy + 1) * CELL };
  if (p.kind === 'gold') {
    // a stash: STASH_N nuggets of all three sizes sharing it, scattered over the middle of the chamber's floor
    scatterGold(coins, mat, x, fy, p.n, STASH_N, Math.max(12, c.rx * 0.6) * CELL, rnd);
  } else for (let k = 0; k < p.n; k++)
    pickups.push({ kind: 'crystal', green: p.kind === 'green' || undefined, x: x + (k - (p.n - 1) / 2) * 16, y: (fy + 1) * CELL - CRYS_Y, floor, t: rnd() * 6.28 });
}
