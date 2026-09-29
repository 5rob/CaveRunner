// The creatures and you, in draw() (render/draw.js), each a part it calls in order with its frame
// object F (REFACTOR.md D19): spider silk, the creatures, the jet flame, the aim line and the gun,
// the runner with the torch, the crosshair, Permanent Shield and Angry Ghost

import { COL, PH } from '../../core/consts.js';
import { drawEnemy } from '../../creatures/draw.js';
import { jcol } from '../../dev/knobs.js';

// Spider silk: web lines, lines being shot, strings flying at you and stuck to you
export function drawSilk(W, G) {
  // spider silk: the web lines they travel (anchor to anchor), lines being shot, the
  // strings in flight at you and the ones stuck to you
  G.ctx.lineCap = 'round';
  G.ctx.strokeStyle = '#eef0f6';
  G.ctx.globalAlpha = 0.55; G.ctx.lineWidth = 0.7;
  G.ctx.beginPath();
  for (const L of W.webs) { G.ctx.moveTo(L.a0x, L.a0y); G.ctx.lineTo(L.b0x, L.b0y); }
  for (const e of W.enemies) {
    const sh = e.sp && e.sp.mode === 'shoot' && e.sp.shot;
    if (sh) { G.ctx.moveTo(sh.ax0, sh.ay0); G.ctx.lineTo(sh.x + sh.dx * Math.min(sh.t, sh.len), sh.y + sh.dy * Math.min(sh.t, sh.len)); }
  }
  G.ctx.stroke();
  G.ctx.globalAlpha = 0.85; G.ctx.lineWidth = 0.9;
  G.ctx.beginPath();
  for (const b of W.silk) { G.ctx.moveTo(b.ax, b.ay); G.ctx.lineTo(b.x, b.y); }
  for (const s of W.strings) { G.ctx.moveTo(s.ax, s.ay); G.ctx.lineTo(W.p.x + s.ox, W.p.y + s.oy); }
  G.ctx.stroke();
  G.ctx.globalAlpha = 1;
}

// The creatures in view, each with a health bar (rats and nests only once hurt)
export function drawEnemies(W, G, F) {
  const { vw, vh } = F;
  // enemies
  for (const e of W.enemies) {
    const ey = e.ty;
    if (ey > W.camY + vh + 20 || ey < W.camY - 20 || e.x < W.camX - 20 || e.x > W.camX + vw + 20) continue;
    drawEnemy(G.ctx, e, W.time);
    if ((e.home || e.nest) && e.hp >= e.hpMax) continue;   // rats and nests: a bar only once hurt
    const hw = 20, hx = e.x - hw / 2, hy = ey - e.r - 9;
    G.ctx.fillStyle = COL.barBg; G.ctx.fillRect(hx, hy, hw, 3);
    G.ctx.fillStyle = e.je ? jcol('jeColBody', e.je.u.col) : e.k.col.a;
    G.ctx.fillRect(hx, hy, hw * Math.max(0, e.hp / e.hpMax), 3);
  }
}

// The jetpack's flame, pointing away from the thrust
export function drawJetFlame(W, G, F) {
  const { pcx } = F;
  // jet flame
  if (W.p.flame > 0) {
    let fx = -W.p.jx, fy = -W.p.jy + 0.8;
    const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
    const len = 6 + W.p.flame * 16 + Math.random() * 3;
    const bx = pcx, by = W.p.y + PH - 2;
    G.ctx.fillStyle = COL.flame;
    G.ctx.beginPath(); G.ctx.moveTo(bx - 4, by); G.ctx.lineTo(bx + 4, by); G.ctx.lineTo(bx + fx * len, by + fy * len); G.ctx.fill();
    G.ctx.fillStyle = COL.flame2;
    G.ctx.beginPath(); G.ctx.moveTo(bx - 2, by); G.ctx.lineTo(bx + 2, by); G.ctx.lineTo(bx + fx * len * 0.55, by + fy * len * 0.55); G.ctx.fill();
  }
}
