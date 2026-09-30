// Particles and effects of draw() (render/draw.js), each a part it calls in order with its frame
// object F (REFACTOR.md D19): smoke, Levitation Trail, sparks, motes, explosion flashes

import { COL } from '../../core/consts.js';

// Smoke: the jetpack's (grey puffs when it sputters), the fire's, blasts', vents' and shot trails'
export function drawSmoke(W, G) {
  // smoke
  for (const m of W.smoke) {
    G.ctx.fillStyle = m.c || COL.smoke;
    G.ctx.globalAlpha = Math.max(0, m.life / m.max) * (m.a || 0.5);
    G.ctx.beginPath(); G.ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); G.ctx.fill();
  }
  G.ctx.globalAlpha = 1;
}

// Levitation Trail: the fire you left behind, still burning
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
    else a = Math.max(0, q.life / q.max) * 0.9;
    G.ctx.globalAlpha = a;
    G.ctx.fillStyle = q.c;
    G.ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
  }
  G.ctx.globalCompositeOperation = 'source-over';
  G.ctx.globalAlpha = 1;
}

// Explosion flashes
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
