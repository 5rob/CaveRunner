// What a flying shot does when it hits or dies, besides the bullet loop in step(): crits,
// knockback, Clusterbolt's spray, Death Cross, Teleport Bolt.

import { SFX } from '../../audio/sfx.js';
import { CELL, PH, PW, WH, WW } from '../../core/consts.js';
import { burst } from './particles.js';
import { boxHit, explode } from './terrain.js';

// Clusterbolt: the shot bursts into a handful of small explosive bolts
export function spray(W, b) {
  SFX.fx('cluster', b.x, b.y);
  const n = Math.min(8, b.cluster);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 140 + Math.random() * 120;
    W.bullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.5 + Math.random() * 0.3, dmg: Math.max(0.6, b.dmg * 0.3), size: 2,
      col: b.col, spin: 0, homing: 0, bounce: 0, pierce: 0, explode: 9,
      grav: 300, accel: 0, bore: 0, hit: null, age: 0 });
  }
  burst(W, b.x, b.y, 8, b.col);
}

// Death Cross: four arms of blast rather than one round crater
export function explodeCross(W, G, b) {
  const R = b.explode || 20;
  explode(W, G, b.x, b.y, R * 0.6);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
    explode(W, G, b.x + dx * R * 0.9, b.y + dy * R * 0.9, R * 0.55);
}

export const critRoll = (dmg, chance) => (chance && Math.random() < chance ? (SFX.fx('crit'), dmg * 3) : dmg);
export const shove = (e, nx, ny, force) => {
  e.x += nx * force * 0.03; e.y += ny * force * 0.03; e.tgt = null;
};

// Teleport Bolt: put you where the bolt stopped. It may have stopped against rock, so
// back up along its own track (and nudge up/down) until your whole body fits; if
// nowhere near fits, it fizzles and you stay put.
export function teleportTo(W, b) {
  if (W.p.dead) return;
  const sp = Math.hypot(b.vx, b.vy), nx = sp ? b.vx / sp : 0, ny = sp ? b.vy / sp : 0;
  for (let back = 0; back <= 40; back += 3)
    for (const dy of [0, -4, 4, -8, 8, -12, 12, -16, 16]) {
      const x = b.x - nx * back - PW / 2, y = b.y - ny * back - PH / 2 + dy;
      if (x < CELL * 3 || y < CELL * 3 || x + PW > WW - CELL * 3 || y + PH > WH - CELL * 3) continue;
      if (boxHit(W, x, y)) continue;
      burst(W, W.p.x + PW / 2, W.p.y + PH / 2, 10, b.col);
      W.p.x = x; W.p.y = y; W.p.vx = 0; W.p.vy = 0;
      burst(W, W.p.x + PW / 2, W.p.y + PH / 2, 12, b.col);
      SFX.fx('warp', W.p.x + PW / 2, W.p.y + PH / 2);
      return;
    }
  burst(W, b.x, b.y, 4, b.col);
  SFX.fx('fizzle', b.x, b.y);
}
