// @ts-check
// Level decoration, pass 2 (baked pixels) and pass 3 (props): decorate places each
// theme's DECOR on its own random stream, cullDecor drops overlaps, propAnchored says if a
// prop still hangs off rock. Props are never in mat; they act only by box overlap.

import { tent } from './sway.js';

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

// ---- kept for the test suites (grem branch: the game no longer calls these; the suites set up with them) ----
// a point on arched vine pr (world units, bent as it is now) at fraction u of the way along its points
/** @param {{ x: number, y: number, arc?: number[][], wx?: number, wy?: number, wu?: number }} pr an arched vine @param {number} u */
export function archAt(pr, u) {
  const A = pr.arc, f = Math.max(0, Math.min(1, u)) * (A.length - 1), k = Math.min(A.length - 2, Math.floor(f)), t = f - k;
  const b = tent(Math.max(0, Math.min(1, u)), pr.wu == null ? 0.5 : pr.wu);
  return { x: pr.x + A[k][0] + (A[k + 1][0] - A[k][0]) * t + b * (pr.wx || 0), y: pr.y + A[k][1] + (A[k + 1][1] - A[k][1]) * t + b * (pr.wy || 0) };
}
