// @ts-check
// Gold seams in the rock (goldVeins), on their own random stream so the cave stays
// exactly as the seed makes it, and what each dug-out pixel is worth (ORE_GOLD).

import { CH, CW, ROCK, SHOP_ROOF, SHOP_TOP } from '../core/consts.js';

// ---- gold veins ----
// Thin wandering seams of gold through the rock, near enough to open cave that you can
// see them and dig in. Returns a CW*CH array, 1 where a rock pixel is gold. Pure, on its
// own random stream so the rest of the cave stays exactly as the seed makes it.
// Only ever marks ROCK, never brick or bedrock, and never down in the shop.
export const ORE_GOLD = 0.25;
/** @param {Uint8Array} mat @param {number} seed @param {number} floor @returns {Uint8Array} */
export function goldVeins(mat, seed, floor) {
  let rs = (seed * 7919 + 12345) % 2147483647 || 1;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const ore = new Uint8Array(CW * CH);
  const n = Math.min(18, 7 + floor);
  const maxY = SHOP_TOP - SHOP_ROOF - 6;
  const rockAt = (x, y) => x >= 4 && y >= 4 && x < CW - 4 && y < maxY && mat[y * CW + x] === ROCK;
  // the nearest open pixel within `r`, looking along 8 directions — close enough to find
  const nearOpen = (x, y, r) => {
    for (let d = 2; d <= r; d += 2)
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4, px = Math.round(x + Math.cos(a) * d), py = Math.round(y + Math.sin(a) * d);
        if (px >= 0 && py >= 0 && px < CW && py < CH && !mat[py * CW + px]) return true;
      }
    return false;
  };
  for (let v = 0; v < n; v++) {
    let x = 0, y = 0, ok = false;
    for (let tries = 0; tries < 200 && !ok; tries++) {
      x = 6 + Math.floor(rnd() * (CW - 12)); y = 6 + Math.floor(rnd() * (maxY - 12));
      // embedded: solid for a few pixels all round, but open cave within reach
      ok = rockAt(x, y) && rockAt(x + 3, y) && rockAt(x - 3, y) && rockAt(x, y + 3) && rockAt(x, y - 3)
        && nearOpen(x, y, 16);
    }
    if (!ok) continue;
    let a = rnd() * Math.PI * 2;
    const len = 18 + Math.floor(rnd() * 40);
    for (let st = 0; st < len; st++) {
      const r = rnd() < 0.2 ? 2 : 1;                   // mostly a thin seam, the odd nugget
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r + 0.5) continue;
          const px = Math.round(x) + dx, py = Math.round(y) + dy;
          if (rockAt(px, py)) ore[py * CW + px] = 1;
        }
      a += (rnd() - 0.5) * 0.9;
      x += Math.cos(a) * 1.2; y += Math.sin(a) * 1.2;
      if (!rockAt(Math.round(x), Math.round(y))) break;   // a seam stops where the rock does
    }
  }
  return ore;
}
