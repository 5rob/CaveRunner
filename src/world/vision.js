// @ts-check
// What you can see: exact ray marching (rayDist, losClear), the visibility fan (visPoly)
// and the fog-of-war memory it lifts (fogReveal, fogStart, nestFog), and the gun light's shape (beamLift). Exact on purpose: a
// fixed-step march jumps clean over a one-cell wall.

import { CELL } from '../core/consts.js';

// How far a ray from (x, y) heading (dx, dy) gets before it walks into a solid cell,
// capped at r. It steps from one cell boundary to the next, so it visits every cell the
// ray crosses — a fixed sampling step would jump clean over a one-pixel wall and let a
// sliver of light through the far side of it.
/** @param {number} x @param {number} y @param {number} dx @param {number} dy @param {number} r @param {(cx: number, cy: number) => unknown} solidCell @returns {number} */
export function rayDist(x, y, dx, dy, r, solidCell) {
  let cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const dtx = dx ? Math.abs(CELL / dx) : Infinity;
  const dty = dy ? Math.abs(CELL / dy) : Infinity;
  let tx = dx ? (dx > 0 ? ((cx + 1) * CELL - x) / dx : (cx * CELL - x) / dx) : Infinity;
  let ty = dy ? (dy > 0 ? ((cy + 1) * CELL - y) / dy : (cy * CELL - y) / dy) : Infinity;
  let t = 0;
  for (;;) {
    if (tx < ty) { t = tx; tx += dtx; cx += sx; }
    else { t = ty; ty += dty; cy += sy; }
    if (t >= r) return r;
    if (solidCell(cx, cy)) return t;
  }
}

// Is the straight line from one point to another clear of rock? Marched the same way the
// light is, so "can I shoot that" and "can I see that" give the same answer, and a
// one-pixel wall stops both.
/** @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @param {(cx: number, cy: number) => unknown} solidCell */
export function losClear(x0, y0, x1, y1, solidCell) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
  if (d < 0.001) return true;
  return rayDist(x0, y0, dx / d, dy / d, d, solidCell) >= d - 0.001;
}

// The fan of points that bound what can be seen from (cx, cy) out to r. The lamp is
// clipped to this, which is what makes walls cast shadows.
/** @param {number} cx @param {number} cy @param {number} r @param {(cx: number, cy: number) => unknown} solidCell @param {number} rays @returns {number[]} x, y, x, y, … */
export function visPoly(cx, cy, r, solidCell, rays) {
  const pts = [];
  for (let i = 0; i < rays; i++) {
    const a = i / rays * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
    const d = rayDist(cx, cy, dx, dy, r, solidCell);
    pts.push(cx + dx * d, cy + dy * d);
  }
  return pts;
}

