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
