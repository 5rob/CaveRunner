// @ts-check
// What you can see: exact ray marching (rayDist, losClear), the visibility fan (visPoly)
// and the fog-of-war memory it lifts (fogReveal, fogStart, nestFog), and the gun light's shape (beamLift). Exact on purpose: a
// fixed-step march jumps clean over a one-cell wall.

import { CELL, FH, FOG, FOG_U, FW, SHOP_ROOF, SHOP_TOP } from '../core/consts.js';
import { DEV } from '../dev/knobs.js';

// What the map is allowed to remember is worked out as a fan of rays out from the player,
// each stopping at the first wall: one ray per fog cell the fan crosses, so a shadow edge
// lands on about the grid it is drawn into. See fogReveal.
export const VIS_RAYS = 160;

// Light every cell within r world units of (wx, wy) that the torch can actually reach,
// and return how many were newly lit so the caller can leave the overlay alone on the
// frames where nothing changed. `pts` is the fan visPoly cast from the same spot, and a
// cell is only lit if the fan reaches at least that far in its direction — so ground
// round the corner of a wall is not seen and never goes on the map.
/** @param {Uint8Array} seen @param {number} wx @param {number} wy @param {number} r @param {number[]} pts visPoly's fan @param {number} rays @returns {number} */
export function fogReveal(seen, wx, wy, r, pts, rays) {
  const cx = wx / FOG_U, cy = wy / FOG_U, cr = r / FOG_U, r2 = cr * cr;
  const x0 = Math.max(0, Math.floor(cx - cr)), x1 = Math.min(FW - 1, Math.ceil(cx + cr));
  const y0 = Math.max(0, Math.floor(cy - cr)), y1 = Math.min(FH - 1, Math.ceil(cy + cr));
  let n = 0;
  for (let y = y0; y <= y1; y++) {
    const row = y * FW, dy = y + 0.5 - cy, dy2 = dy * dy;
    for (let x = x0; x <= x1; x++) {
      if (seen[row + x]) continue;
      const dx = x + 0.5 - cx;
      if (dx * dx + dy2 > r2) continue;
      const d = Math.sqrt(dx * dx + dy2) * FOG_U;            // world units, to match the fan
      // how far the fan got in this direction: the shorter of the two rays either side of
      // it, so a cell only goes on the map if a ray actually reached it. Interpolating
      // between the two would reach a little further than either and mark cells just round
      // a corner — which is the one thing this is here to stop.
      const t = (Math.atan2(dy, dx) / (Math.PI * 2) + 1) % 1 * rays;
      const i0 = Math.floor(t), i1 = (i0 + 1) % rays;
      const a = Math.hypot(pts[i0 * 2] - wx, pts[i0 * 2 + 1] - wy);
      const b = Math.hypot(pts[i1 * 2] - wx, pts[i1 * 2 + 1] - wy);
      if (d > Math.min(a, b)) continue;
      seen[row + x] = 1; n++;
    }
  }
  return n;
}

// A fresh grid for a fresh floor. 0 is never been there, 1 is been there, 2 is never
// fogged at all - which is the shop, a known safe room you are put down in, where a
// haze over the plinths would just hide the stock you came here to buy.
export function fogStart() {
  const seen = new Uint8Array(FW * FH);
  for (let y = Math.floor((SHOP_TOP - SHOP_ROOF) / FOG); y < FH; y++)
    for (let x = 0; x < FW; x++) seen[y * FW + x] = 2;
  return seen;
}

// The fog cells over each rat nest's room (nests in terrain px). The fog bake's soft edge
// never spreads into these, so a room only shows once a real line of sight reaches it —
// down the bent tunnel it can't, so you have to dig to see in.
/** @param {NestSpot[]} [nests] @returns {Uint8Array} */
export function nestFog(nests) {
  const m = new Uint8Array(FW * FH);
  for (const n of nests || []) {
    const R = n.r + 2;
    for (let y = Math.floor((n.y - R) / FOG); y <= Math.floor((n.y + R) / FOG); y++)
      for (let x = Math.floor((n.x - R) / FOG); x <= Math.floor((n.x + R) / FOG); x++)
        if (x >= 0 && y >= 0 && x < FW && y < FH) m[y * FW + x] = 1;
  }
  return m;
}

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

// The gun light's shape (v0.0.145, render/light.js): the cone out along the aim, soft at its sides, and
// a small round glow round you
/** how far off the beam's middle a direction is (0 inside the cone, 1 out past its soft edge) @param {number} ang @param {number} a */
export function beamSide(ang, a) {
  let off = ang - a;
  off = Math.abs(off - Math.round(off / (Math.PI * 2)) * Math.PI * 2);
  const half = DEV.beamDeg * Math.PI / 360, soft = half * 0.4;
  return off < half ? 1 : off < half + soft ? 1 - (off - half) / soft : 0;
}
/** how much the gun light lifts the dark at a spot (0-1): d away from you, (dx, dy) toward it, a the
 * beam's direction, R the cone's reach (0: no gun, no cone), N the round glow's @param {number} d @param {number} dx @param {number} dy @param {number} a @param {number} R @param {number} N */
export function beamLift(d, dx, dy, a, R, N) {
  const round = d < N * 0.5 ? 1 : d < N ? 2 - 2 * d / N : 0, t = d / R;
  if (!(t < 1)) return round;          // past its reach (or no cone at all, R 0)
  return Math.max(round, beamSide(Math.atan2(dy, dx), a) * (t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45));
}
/** the line-of-sight fan (visPoly's, out to the beam's reach) cut back to r everywhere outside the cone:
 * so the beam uncovers the fog further than the glow round you does @param {number[]} pts @param {number} cx @param {number} cy @param {number} r @param {number} a */
export function beamFan(pts, cx, cy, r, a) {
  const rays = pts.length / 2;
  for (let i = 0; i < rays; i++) {
    const dx = pts[2 * i] - cx, dy = pts[2 * i + 1] - cy, d = Math.hypot(dx, dy);
    if (d <= r || beamSide(i / rays * Math.PI * 2, a) > 0) continue;
    pts[2 * i] = cx + dx / d * r; pts[2 * i + 1] = cy + dy / d * r;
  }
  return pts;
}
