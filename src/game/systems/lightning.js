// Lightning: the zig-zag arcs (jag, addArc) and a lightning bolt's forks as it flies
// (lightningStep). The arcs are drawn in Game's draw().

import { SFX } from '../../audio/sfx.js';
import { rayDist } from '../../world/vision.js';
import { damageEnemy } from './enemies.js';
import { burst } from './particles.js';
import { lineOfSight, solidCell } from './terrain.js';

// Lightning. A zig-zag between points: each leg is split into short kinks knocked
// sideways, so a straight line reads as a crackling bolt.
export function jag(pts, amp) {
  // thin the path to points ~12 apart first, so a slow bolt's crowded trail still kinks
  const th = [pts[0]];
  for (let k = 1; k < pts.length; k++) {
    const q = th[th.length - 1];
    if (k === pts.length - 1 || Math.hypot(pts[k].x - q.x, pts[k].y - q.y) >= 12) th.push(pts[k]);
  }
  pts = th;
  const out = [pts[0]];
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], c = pts[k], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 1;
    const n = Math.max(1, Math.round(d / 9)), px = -dy / d, py = dx / d;
    for (let s = 1; s < n; s++) {
      const f = s / n, o = (Math.random() - 0.5) * 2 * amp;
      out.push({ x: a.x + dx * f + px * o, y: a.y + dy * f + py * o });
    }
    out.push(c);
  }
  return out;
}
export function addArc(W, pts, col, w, max) { W.arcs.push({ pts: jag(pts, 4), col, w, t: 0, max }); }
// A lightning bolt remembers its last stretch of path (drawn as the bolt) and every
// few hundredths of a second throws a fork: at a creature in reach and in sight
// (a little damage), else at a nearby bit of rock (just the flash).
export function lightningStep(W, b, dt) {
  const tr = b.trail || (b.trail = [{ x: b.ox, y: b.oy }]);
  tr.push({ x: b.x, y: b.y });
  let len = 0;
  for (let k = tr.length - 1; k > 0; k--) {
    len += Math.hypot(tr[k].x - tr[k - 1].x, tr[k].y - tr[k - 1].y);
    if (len > 110) { tr.splice(0, k - 1); break; }
  }
  if ((b.arcT = (b.arcT || 0) - dt) > 0) return;
  b.arcT = 0.035 + Math.random() * 0.04;
  const R = 90, near = [];
  for (let j = 0; j < W.enemies.length; j++) {
    const e = W.enemies[j];
    if (Math.hypot(e.x - b.x, e.ty - b.y) < R && lineOfSight(W, b.x, b.y, e.x, e.ty)) near.push(j);
  }
  if (near.length && Math.random() < 0.75) {
    const j = near[Math.floor(Math.random() * near.length)], e = W.enemies[j];
    addArc(W, [{ x: b.x, y: b.y }, { x: e.x, y: e.ty }], b.col, 1, 0.14);
    SFX.arc(e.x, e.ty);
    burst(W, e.x, e.ty, 3, b.col);
    damageEnemy(W, j, b.dmg * 0.3);
    return;
  }
  // no creature: try a few random directions for rock close by
  for (let k = 0; k < 4; k++) {
    const a = Math.random() * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
    const d = rayDist(b.x, b.y, dx, dy, 70, (cx, cy) => solidCell(W, cx, cy));
    if (d < 70 && d > 6) {
      const hx = b.x + dx * d, hy = b.y + dy * d;
      addArc(W, [{ x: b.x, y: b.y }, { x: hx, y: hy }], b.col, 0.8, 0.12);
      SFX.arc(hx, hy);
      burst(W, hx, hy, 2, b.col);
      return;
    }
  }
}
