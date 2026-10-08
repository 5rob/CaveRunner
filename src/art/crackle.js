// @ts-check
// The fire's crackle (owner, v0.0.165/166): something burning drawn as the burning terrain is
// (game/render/cave.js's burning pixels): squares of the fire's colours on the terrain's grid, a new
// flicker each fire tick. crackleAt: one square (a vine's or a silk line's burning stretch, square
// by square); crackleBody: a burning creature, a ragged flickering patch over its body with tongues
// licking up off its top. The title and the game both draw with these.

import { FIRE_COLS } from '../world/fire.js';

// 0..3 for a grid cell at a fire tick (the burning pixels' hash)
/** @param {number} c @param {number} r @param {number} tick */
const fhash = (c, r, tick) => (Math.imul(c * 977 + r, 2654435761) + tick * 40503) >>> 30;

// the grid square (cell world units) holding (x, y), in the fire's colours; ember: the dying colour
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} cell @param {number} tick @param {boolean} [ember] */
export function crackleAt(ctx, x, y, cell, tick, ember) {
  const c = Math.floor(x / cell), r = Math.floor(y / cell), h = fhash(c, r, tick);
  ctx.fillStyle = FIRE_COLS[ember ? 3 : h === 0 ? 0 : h === 3 ? 2 : 1];
  ctx.fillRect(c * cell, r * cell, cell, cell);
}

// a burning body of radius r at (x, y): about half the squares within it alight each tick (bright at
// the top, deeper below), and tongues of fire up to 0.8 r above it, thinning out as they rise
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r @param {number} cell @param {number} tick */
export function crackleBody(ctx, x, y, r, cell, tick) {
  const c0 = Math.floor((x - r) / cell), c1 = Math.floor((x + r) / cell);
  const r0 = Math.floor((y - r * 1.8) / cell), r1 = Math.floor((y + r) / cell);
  for (let c = c0; c <= c1; c++) for (let q = r0; q <= r1; q++) {
    const px = (c + 0.5) * cell - x, py = (q + 0.5) * cell - y, h = fhash(c, q, tick), g = fhash(q * 7 + 3, c * 13 + 1, tick);
    let keep;
    if (py >= -r * 0.4) keep = px * px + py * py <= r * r && g >= 2;               // the body: about half
    else keep = Math.abs(px) < r * 0.7 * (1 + (py + r * 0.4) / (r * 1.4)) && g === 3 && h !== 2;   // the tongues: thin, narrowing up
    if (!keep) continue;
    ctx.fillStyle = FIRE_COLS[py < -r * 0.2 ? (h & 1) : h === 3 ? 2 : h === 0 ? 0 : 1];
    ctx.fillRect(c * cell, q * cell, cell, cell);
  }
}
