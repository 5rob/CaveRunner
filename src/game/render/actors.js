// @ts-check
// The creatures and you, in draw() (render/draw.js), each a part it calls in order with its frame
// object F (REFACTOR.md D19): the creatures, the jet flame, the aim line and the gun, the runner
// with the torch, the crosshair, Permanent Shield and Angry Ghost (the spider's silk, drawn just
// before the creatures, is drawSilk in game/creatures/spider.js)

import { drawGun, drawRunner, drawTorch } from '../../art/sprites.js';
import { COL, PH, PW } from '../../core/consts.js';
import { drawEnemy } from '../../creatures/draw.js';
import { ELITE_TINT } from '../../data/creatures.js';
import { DEV, jcol } from '../../dev/knobs.js';
import { planCast } from '../../spells/cast.js';
import { gunAccent } from '../../spells/guns.js';
import { bhSp, tracePath } from '../../spells/trace.js';
import { torchHand } from '../systems/player.js';
import { solidAt } from '../systems/terrain.js';

// The creatures in view, each with a health bar (rats and nests only once hurt)
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawEnemies(W, G, F) {
  const { vw, vh } = F;
  // enemies
  for (const e of W.enemies) {
    const ey = e.ty;
    if (ey > W.camY + vh + 20 || ey < W.camY - 20 || e.x < W.camX - 20 || e.x > W.camX + vw + 20) continue;
    if (e.k.elite) {                       // an elite: a gold glow behind it
      G.ctx.globalAlpha = 0.22 + 0.1 * Math.sin(W.time * 4 + e.x);
      G.ctx.fillStyle = ELITE_TINT;
      G.ctx.beginPath(); G.ctx.arc(e.x, ey, e.r + 6, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.globalAlpha = 1;
    }
    drawEnemy(G.ctx, e, W.time);
    if ((e.home || e.nest) && e.hp >= e.hpMax) continue;   // rats and nests: a bar only once hurt
    const hw = 20, hx = e.x - hw / 2, hy = ey - e.r - 9;
    G.ctx.fillStyle = COL.barBg; G.ctx.fillRect(hx, hy, hw, 3);
    G.ctx.fillStyle = e.je ? jcol('jeColBody', e.je.u.col) : e.k.col.a;
    G.ctx.fillRect(hx, hy, hw * Math.max(0, e.hp / e.hpMax), 3);
  }
}

// The jetpack's flame, pointing away from the thrust
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
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

// The aim: fills in F.held (the gun in hand), F.ax/F.ay (where you aim, or face) and F.gy (the
// gun's height) for the parts after it, then the Trajectory Sight line: where the next pull
// actually goes, mods and perks and all
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawAim(W, G, F) {
  const { pcx } = F;
  // aim, grenade arc preview, gun
  const R = W.p.aim;
  const held = F.held = G.input.current.loadout.guns[G.input.current.loadout.sel];
  const ax = F.ax = R.show ? R.nx : W.p.face, ay = F.ay = R.show ? R.ny : 0;
  const gy = F.gy = W.p.y + PH * 0.52;

  // where the next pull actually goes, mods and all — only with the Trajectory Sight perk
  const tvis = R.vis == null ? 1 : R.vis;
  if (!G.RPV && !W.p.dead && R.show && held && W.pb.trajectory && tvis > 0) {
    const sim = Object.assign({}, held, { slots: held.slots.slice(),
      order: held.order.slice(), idx: held.idx });
    const plan = planCast(sim);                 // a copy, so the real gun is untouched
    const seen = {};
    let drawn = 0;
    for (const sh of plan.shots) {
      if (sh.still) {                    // a field lands in front of you, it does not fly
        const fx = pcx + R.nx * 30, fy = gy + R.ny * 30;
        G.ctx.globalAlpha = 0.5 * tvis; G.ctx.strokeStyle = sh.col; G.ctx.lineWidth = 1.5;
        G.ctx.setLineDash([4, 4]);
        G.ctx.beginPath(); G.ctx.arc(fx, fy, Math.max(8, sh.r), 0, Math.PI * 2); G.ctx.stroke();
        G.ctx.setLineDash([]); G.ctx.globalAlpha = 1;
        continue;
      }
      const key = [Math.round(sh.speed), Math.round(sh.grav), sh.accel, sh.bounce,
        sh.bore, sh.homing, Math.round(sh.life * 20), sh.beam, sh.spiral, sh.orbit,
        sh.pong, sh.boomer, sh.flat].join(',');
      if (seen[key] || drawn >= 3) continue;
      seen[key] = 1;
      const cone = drawn === 0 && sh.spread > 2
        ? [-sh.spread / 2, 0, sh.spread / 2] : [0];
      drawn++;
      // the perks that bend a bullet in flight bend the aim line too, or it lies
      const tsh = Object.assign({}, sh, { bounce: sh.bounce + W.pb.bounce,
        homing: Math.max(sh.homing, W.pb.homing), speed: sh.speed * W.pb.speed * bhSp(sh) });
      for (const off of cone) {
        const a = Math.atan2(R.ny, R.nx) + off * Math.PI / 180;
        tracePath(tsh, pcx, gy, Math.cos(a), Math.sin(a), (x, y) => solidAt(W, x, y), W.enemies, G.aimPath,
          { x: pcx, y: gy });
        G.ctx.fillStyle = sh.col;
        const edge = off !== 0;
        const size = edge ? 1.6 : 2.4;
        for (let i = 2; i < G.aimPath.length; i += edge ? 8 : 4) {
          const t = i / G.aimPath.length;
          G.ctx.globalAlpha = (edge ? 0.3 : 0.9) * (1 - 0.6 * t) * tvis;
          G.ctx.fillRect(G.aimPath[i] - size / 2, G.aimPath[i + 1] - size / 2, size, size);
        }
      }
    }
    G.ctx.globalAlpha = 1;
  }
}

// You: the runner, the gun, the torch in your other hand, the aim crosshair, and the perks you
// can see (Permanent Shield's ring, Angry Ghost)
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawPlayer(W, G, F) {
  const { pcx, pcy, held, ax, ay, gy } = F;
  // player
  if (W.p.dead) G.ctx.globalAlpha = 0.35;
  const flashing = W.p.hitT > 0 && Math.floor(W.p.hitT * 30) % 2 === 0;
  const running = W.p.onGround && Math.abs(W.p.vx) > 15;
  const gait = running ? Math.sin(W.time * 15) : 0;
  drawRunner(G.ctx, W.p.x, W.p.y, PW, PH, W.p.face, gait, !W.p.onGround, W.p.flame, flashing);
  if (!W.p.dead) drawGun(G.ctx, pcx + ax * 2.5, gy, Math.atan2(ay, ax), 0.55, gunAccent(held));
  // the torch, in the hand the gun is not in
  if (!W.p.dead) { const th = torchHand(W); drawTorch(G.ctx, th.x, th.y, ax >= 0 ? -1 : 1, W.flick, W.torchP, W.leanX, W.leanY, W.time); }
  // a small aim crosshair at DEV.aimDist out, rotating round you with the aim: a "+"
  // with the centre cut out (two short verticals, two short horizontals), drawn as thin
  // as the thumbstick lines (~1.5 css px, so 1.5/unitPx world units, whatever the zoom)
  if (!W.p.dead) {
    const cxp = pcx + ax * DEV.aimDist, cyp = gy + ay * DEV.aimDist;
    const inr = 1.25, outr = 3;            // gap radius, arm end (half the v55 size)
    G.ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    G.ctx.lineWidth = 1.5 / W.unitPx;
    G.ctx.lineCap = 'butt';
    G.ctx.beginPath();
    G.ctx.moveTo(cxp, cyp - outr); G.ctx.lineTo(cxp, cyp - inr);   // top
    G.ctx.moveTo(cxp, cyp + inr);  G.ctx.lineTo(cxp, cyp + outr);  // bottom
    G.ctx.moveTo(cxp - outr, cyp); G.ctx.lineTo(cxp - inr, cyp);   // left
    G.ctx.moveTo(cxp + inr, cyp);  G.ctx.lineTo(cxp + outr, cyp);  // right
    G.ctx.stroke();
  }
  G.ctx.globalAlpha = 1;

  // Permanent Shield: a soft ring while it is up, gone the moment it is spent
  if (W.pb.shield && W.p.shieldReady && !W.p.dead) {
    G.ctx.globalAlpha = 0.35 + 0.15 * Math.sin(W.time * 4);
    G.ctx.strokeStyle = '#7ad7ff'; G.ctx.lineWidth = 2;
    G.ctx.beginPath(); G.ctx.arc(pcx, pcy, PW * 1.15, 0, Math.PI * 2); G.ctx.stroke();
    G.ctx.globalAlpha = 1;
  }

  // Angry Ghost: a pale wisp that drifts at your shoulder
  if (W.pb.ghost && W.ghost && !W.p.dead) {
    const gb = Math.sin(W.time * 3) * 2;
    G.ctx.globalAlpha = 0.55;
    G.ctx.fillStyle = '#c9a6ff';
    G.ctx.beginPath(); G.ctx.arc(W.ghost.x, W.ghost.y + gb, 6, Math.PI, 0);
    G.ctx.lineTo(W.ghost.x + 6, W.ghost.y + gb + 6);
    G.ctx.lineTo(W.ghost.x + 2, W.ghost.y + gb + 4);
    G.ctx.lineTo(W.ghost.x - 2, W.ghost.y + gb + 6);
    G.ctx.lineTo(W.ghost.x - 6, W.ghost.y + gb + 4);
    G.ctx.closePath(); G.ctx.fill();
    G.ctx.globalAlpha = 1;
    G.ctx.fillStyle = '#3a2f52';
    G.ctx.fillRect(W.ghost.x - 3, W.ghost.y + gb - 1, 1.6, 2.4);
    G.ctx.fillRect(W.ghost.x + 1.4, W.ghost.y + gb - 1, 1.6, 2.4);
  }
}
