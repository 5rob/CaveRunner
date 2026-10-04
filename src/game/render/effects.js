// @ts-check
// Particles and effects of draw() (render/draw.js), each a part it calls in order with its frame
// object F (REFACTOR.md D19): smoke, Levitation Trail, sparks, motes, explosion flashes

import { pixelSoft } from '../../art/sprites.js';
import { COL } from '../../core/consts.js';
import { DEV } from '../../dev/knobs.js';

// Smoke: the jetpack's (grey puffs when it sputters), the fire's, blasts', vents' and shot trails'.
// The jetpack's (m.jet) is drawn on the player's pixel grid (DEV.runnerPx, pixelSoft: see-through kept)
/** @param {World} W @param {GameCtx} G */
export function drawSmoke(W, G) {
  const px = DEV.runnerPx;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  /** @param {CanvasRenderingContext2D} c @param {Particle} m */
  const puff = (c, m) => {
    c.fillStyle = m.c || COL.smoke;
    c.globalAlpha = Math.max(0, m.life / m.max) * (m.a || 0.5);
    c.beginPath(); c.arc(m.x, m.y, m.r, 0, Math.PI * 2); c.fill();
  };
  for (const m of W.smoke) {
    if (m.jet && px > 0) {
      x0 = Math.min(x0, m.x - m.r); y0 = Math.min(y0, m.y - m.r); x1 = Math.max(x1, m.x + m.r); y1 = Math.max(y1, m.y + m.r);
      continue;
    }
    puff(G.ctx, m);
  }
  G.ctx.globalAlpha = 1;
  if (x1 > x0 && x1 - x0 < 600 && y1 - y0 < 600) {
    const gx = Math.floor(x0 / px) * px, gy = Math.floor(y0 / px) * px;
    pixelSoft(G.ctx, gx, gy, x1 - gx + px, y1 - gy + px, px, c => {
      for (const m of W.smoke) if (m.jet) puff(c, m);
      c.globalAlpha = 1;
    });
  } else if (x1 > x0) {                       // spread too far for one layer: drawn smooth
    for (const m of W.smoke) if (m.jet) puff(G.ctx, m);
    G.ctx.globalAlpha = 1;
  }
}

// Levitation Trail: the fire you left behind, still burning
/** @param {World} W @param {GameCtx} G */
export function drawTrail(W, G) {
  // Levitation Trail: the fire you left behind, still burning
  for (const bn of W.burns) {
    const t = bn.life / bn.max;
    G.ctx.globalAlpha = t * 0.8;
    G.ctx.fillStyle = t > 0.5 ? COL.flame2 : COL.flame;
    G.ctx.beginPath(); G.ctx.arc(bn.x, bn.y, 3 + (1 - t) * 5, 0, Math.PI * 2); G.ctx.fill();
  }
  G.ctx.globalAlpha = 1;
}

// Sparks and debris
/** @param {World} W @param {GameCtx} G */
export function drawSparks(W, G) {
  // sparks and debris
  for (const q of W.sparks) {
    G.ctx.fillStyle = q.c;
    G.ctx.globalAlpha = Math.max(0, q.life / q.max);
    G.ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  G.ctx.globalAlpha = 1;
}

// Magic motes, added on as light: the Black Hole's trail and the portals' drift
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawMotes(W, G, F) {
  const { vh } = F;
  // magic motes: the Black Hole's trail and the portals' drift, added on as light
  G.ctx.globalCompositeOperation = 'lighter';
  for (const q of W.motes) {
    if (q.y > W.camY + vh + 20 || q.y < W.camY - 20) continue;
    let a;
    if (q.kind === 'in') a = Math.min(1, q.age / 0.6) * 0.9;              // fade in, never pop
    else if (q.kind === 'out') a = Math.min(1, q.age / 0.3) *
      Math.max(0, 1 - Math.hypot(q.x - q.ox, q.y - q.oy) / q.fade) * 0.9;  // fade with distance
    else if (q.kind === 'breeze') a = Math.min(1, q.age / 0.15) * Math.max(0, q.life / q.max) * 0.95;   // a crystal's: a quick fade in
    else a = Math.max(0, q.life / q.max) * 0.9;
    G.ctx.globalAlpha = a;
    G.ctx.fillStyle = q.c;
    G.ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
  }
  G.ctx.globalCompositeOperation = 'source-over';
  G.ctx.globalAlpha = 1;
}

// Explosion flashes
/** @param {World} W @param {GameCtx} G */
export function drawFlashes(W, G) {
  // explosion flashes
  for (const f of W.flashes) {
    const t = f.t / 0.25;
    G.ctx.globalAlpha = 1 - t;
    G.ctx.fillStyle = COL.flame;
    G.ctx.beginPath(); G.ctx.arc(f.x, f.y, f.r * (0.6 + 0.5 * t), 0, Math.PI * 2); G.ctx.fill();
    G.ctx.fillStyle = COL.flame2;
    G.ctx.beginPath(); G.ctx.arc(f.x, f.y, f.r * (0.35 + 0.3 * t), 0, Math.PI * 2); G.ctx.fill();
  }
  G.ctx.globalAlpha = 1;
}
