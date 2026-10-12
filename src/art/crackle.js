// @ts-check
// The fire's crackle (owner, v0.0.165/166): something burning drawn as the burning terrain is
// (game/render/cave.js's burning pixels): squares of the fire's colours on the terrain's grid, a new
// flicker each fire tick. crackleAt: one square (a vine's or a silk line's burning stretch, square
// by square); crackleBody: a burning creature, a ragged flickering patch over its body with tongues
// licking up off its top. The title and the game both draw with these.

import { DEV } from '../dev/knobs.js';
import { FIRE_COLS } from '../world/fire.js';

// 0..1 for a grid cell and a salt, well mixed (the old hash added the tick after the multiply, so its top bits, the colour,
// hardly ever changed: the fire stood still, owner v1.0.58)
/** @param {number} c @param {number} r @param {number} s */
const hh = (c, r, s) => (Math.imul(Math.imul(c, 73856093) ^ Math.imul(r, 19349663) ^ Math.imul(s, 83492791), 2654435761) >>> 0) / 4294967296;
// a burning square's colour (FIRE_COLS 0 bright, 1 flame, 2 deep) at a fire tick (20 a second), twinkling: each square
// breathes at its own pace and phase (DEV.fireTwinkle × a period of about 0.4-0.9 s), and now and then flares bright
// (DEV.fireFlare a tick)
/** @param {number} c @param {number} r @param {number} tick */
export function fireTone(c, r, tick) {
  const w = (0.35 + 0.5 * hh(c, r, 1)) * DEV.fireTwinkle, v = hh(c, r, tick + 7) < DEV.fireFlare ? 1 : 0.5 + 0.5 * Math.sin(tick * w + hh(c, r, 2) * 6.283);
  return v > 0.8 ? 0 : v > 0.4 ? 1 : 2;
}

// the grid square (cell world units) holding (x, y), in the fire's colours; ember: the dying colour
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} cell @param {number} tick @param {boolean} [ember] */
export function crackleAt(ctx, x, y, cell, tick, ember) {
  const c = Math.floor(x / cell), r = Math.floor(y / cell);
  ctx.fillStyle = FIRE_COLS[ember ? 3 : fireTone(c, r, tick)];
  ctx.fillRect(c * cell, r * cell, cell, cell);
}

// a burning body of radius r at (x, y): about half the squares within it alight each tick (bright at
// the top, deeper below), and tongues of fire up to 0.8 r above it, thinning out as they rise
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r @param {number} cell @param {number} tick */
export function crackleBody(ctx, x, y, r, cell, tick) {
  const c0 = Math.floor((x - r) / cell), c1 = Math.floor((x + r) / cell);
  const r0 = Math.floor((y - r * 1.8) / cell), r1 = Math.floor((y + r) / cell);
  for (let c = c0; c <= c1; c++) for (let q = r0; q <= r1; q++) {
    // (v1.0.58) which squares show changes every other tick, the tongues each tick: it licks, not a fixed stencil
    const px = (c + 0.5) * cell - x, py = (q + 0.5) * cell - y, g = hh(c, q, (tick >> 1) + 11), t = hh(c, q, tick + 13);
    let keep;
    if (py >= -r * 0.4) keep = px * px + py * py <= r * r && g >= 0.45;               // the body: about half
    else keep = Math.abs(px) < r * 0.7 * (1 + (py + r * 0.4) / (r * 1.4)) && t < 0.2;   // the tongues: thin, narrowing up
    if (!keep) continue;
    const tone = fireTone(c, q, tick);
    ctx.fillStyle = FIRE_COLS[py < -r * 0.2 ? Math.min(1, tone) : tone];
    ctx.fillRect(c * cell, q * cell, cell, cell);
  }
}
