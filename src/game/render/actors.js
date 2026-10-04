// @ts-check
// The creatures and you, in draw() (render/draw.js), each a part it calls in order with its frame
// object F (REFACTOR.md D19): the creatures, the jet flame, the aim line and the gun, the runner
// with the torch, the crosshair, Permanent Shield and Angry Ghost (the spider's silk, drawn just
// before the creatures, is drawSilk in game/creatures/spider.js)

import { drawGun, drawRagdoll, drawRunner, drawTorch, jetFlame, pixelSprite, torchEmbers } from '../../art/sprites.js';
import { gradLut, lutAt, rampLut } from '../../art/ramps.js';
import { COL, PH, PW } from '../../core/consts.js';
import { hexRgb } from '../../core/util.js';
import { drawEnemy } from '../../creatures/draw.js';
import { DEV, carrotAt, jcol, kcol, kru } from '../../dev/knobs.js';
import { planCast } from '../../spells/cast.js';
import { gunAccent } from '../../spells/guns.js';
import { bhSp, tracePath } from '../../spells/trace.js';
import { jetNozzle, torchHand } from '../systems/player.js';
import { introHeld } from '../systems/shoplights.js';
import { solidAt } from '../systems/terrain.js';

// The elites' flames (stepEliteFire): each speck a square on the player's pixel grid, its colour
// along the gradient and its opacity along the ramp (Dev → Elites: flames), added on as light
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawEliteFire(W, G, F) {
  if (!W.eliteFx.length) return;
  const { vw, vh } = F;
  const cols = gradLut(DEV.elFxGrad), alpha = rampLut(DEV.elFxAlpha), px = DEV.runnerPx || 0;
  G.ctx.globalCompositeOperation = 'lighter';
  for (const q of W.eliteFx) {
    if (q.y > W.camY + vh + 10 || q.y < W.camY - 10 || q.x < W.camX - 10 || q.x > W.camX + vw + 10) continue;
    const t = 1 - q.life / q.max, a = lutAt(alpha, t);
    if (a <= 0.01) continue;
    G.ctx.globalAlpha = a;
    G.ctx.fillStyle = lutAt(cols, t);
    const s = px ? Math.max(px, Math.round(q.s / px) * px) : q.s;
    const x = px ? Math.round(q.x / px) * px : q.x, y = px ? Math.round(q.y / px) * px : q.y;
    G.ctx.fillRect(x - s / 2, y - s / 2, s, s);
  }
  G.ctx.globalCompositeOperation = 'source-over';
  G.ctx.globalAlpha = 1;
}

// The creatures in view, each with a health bar (rats and nests only once hurt)
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawEnemies(W, G, F) {
  const { vw, vh } = F;
  // enemies
  for (const e of W.enemies) {
    const ey = e.ty;
    if (ey > W.camY + vh + 20 || ey < W.camY - 20 || e.x < W.camX - 20 || e.x > W.camX + vw + 20) continue;
    if (e.k.elite) {
      // an elite: a soft glow behind it in its tint (Dev → Elites), strongest at its middle and
      // fading to nothing at its edge (v0.0.137: it was a flat disc with a hard rim)
      const u = e.k.eu || 0, a = Math.max(0, Math.min(1, kru('elGlow', u) * (1 + 0.45 * Math.sin(W.time * 4 + e.x))));
      const R = e.r + kru('elGlowR', u);
      if (a > 0 && R > 0) {
        const rgb = hexRgb(kcol('elTint', u)), g = G.ctx.createRadialGradient(e.x, ey, 0, e.x, ey, R);
        g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')');
        g.addColorStop(0.45, 'rgba(' + rgb + ',' + (a * 0.55) + ')');
        g.addColorStop(1, 'rgba(' + rgb + ',0)');
        G.ctx.fillStyle = g;
        G.ctx.beginPath(); G.ctx.arc(e.x, ey, R, 0, Math.PI * 2); G.ctx.fill();
      }
    }
    drawEnemy(G.ctx, e, W.time);
    if ((e.home || e.nest) && e.hp >= e.hpMax) continue;   // rats and nests: a bar only once hurt
    const hw = 20, hx = e.x - hw / 2, hy = ey - e.r - 9;
    G.ctx.fillStyle = COL.barBg; G.ctx.fillRect(hx, hy, hw, 3);
    G.ctx.fillStyle = e.je ? jcol('jeColBody', e.je.u.col) : e.k.col.a;
    G.ctx.fillRect(hx, hy, hw * Math.max(0, e.hp / e.hpMax), 3);
  }
  drawEliteFire(W, G, F);                  // the elites' flames, over the creatures (light added on)
}

// The jetpack's flame, out of the backpack's nozzle (jetNozzle) pointing away from the thrust: a licking fire (jetFlame), on the player's
// pixel grid (DEV.runnerPx, like the gun and torch; 0 smooth)
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawJetFlame(W, G, F) {
  if (W.p.flame > 0) {
    let fx = -W.p.jx, fy = -W.p.jy + 0.8;
    const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
    const len = 6 + W.p.flame * 16 + Math.random() * 3;
    const nz = jetNozzle(W), bx = nz.x, by = nz.y, px = DEV.runnerPx;   // the backpack's nozzle
    /** @param {CanvasRenderingContext2D} c */
    const paint = c => jetFlame(c, bx, by, fx, fy, len, W.time);
    if (px > 0) {
      const R = len + 8, ox = W.p.x - 14, oy = W.p.y - 8;     // on the body's grid (drawPlayer)
      const x0 = ox + Math.floor((bx - R - ox) / px) * px, y0 = oy + Math.floor((by - R - oy) / px) * px;
      pixelSprite(G.ctx, x0, y0, R * 2 + px, R * 2 + px, px, false, paint);
    } else paint(G.ctx);
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
          { x: pcx, y: gy }, carrotAt('caAim', W.pb.carrot));
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
  if (introHeld(W)) return;                 // a new run: not through the teleporter yet
  // player
  const flashing = W.p.hitT > 0 && Math.floor(W.p.hitT * 30) % 2 === 0;
  const running = W.p.onGround && Math.abs(W.p.vx) > 15;
  const gait = running ? W.time * 13 : null;
  // the body at DEV.runnerPx world units a pixel, scaled up crisp (pixelSprite, on a grid that
  // rides with you); 0 draws it smooth. The gun is its own layer on top (same grid), turning as it aims
  const px = DEV.runnerPx, line = DEV.runnerLine > 0;
  // dead: the ragdoll (from the frame after the death; drawn without the snap nudge, it's in the world)
  if (W.p.dead && W.p.rag) {
    G.ctx.translate(-F.snapX, -F.snapY);
    const R = W.p.rag;
    if (px > 0) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const j of R.joints) { x0 = Math.min(x0, j.x); y0 = Math.min(y0, j.y); x1 = Math.max(x1, j.x); y1 = Math.max(y1, j.y); }
      const hip = R.joints[2];            // the grid rides with the hip
      const ox = hip.x - Math.ceil((hip.x - x0 + 9) / px) * px, oy = hip.y - Math.ceil((hip.y - y0 + 9) / px) * px;
      pixelSprite(G.ctx, ox, oy, x1 + 9 - ox, y1 + 9 - oy, px, line, c => drawRagdoll(c, R));
    } else drawRagdoll(G.ctx, R);
    G.ctx.translate(F.snapX, F.snapY);
  } else {
    const th = torchHand(W);
    const hands = { gun: { x: pcx + ax * 2.5, y: gy }, torch: th };
    /** @param {CanvasRenderingContext2D} c */
    const body = c => drawRunner(c, W.p.x, W.p.y, PW, PH, W.p.face, gait, !W.p.onGround, W.p.flame, flashing, hands);
    /** @param {CanvasRenderingContext2D} c */
    const gun = c => drawGun(c, pcx + ax * 2.5, gy, Math.atan2(ay, ax), 0.55, gunAccent(held));
    if (px > 0) {
      pixelSprite(G.ctx, W.p.x - 14, W.p.y - 8, PW + 28, PH + 16, px, line, body);
      if (held) pixelSprite(G.ctx, W.p.x - 14, W.p.y - 8, PW + 28, PH + 16, px, false, gun);
    } else { body(G.ctx); if (held) gun(G.ctx); }   // no gun yet (a new run's empty hands): none drawn
    // the torch, in the hand the gun is not in: on the same pixel grid, its embers loose on it
    /** @param {CanvasRenderingContext2D} c */
    const torch = c => drawTorch(c, th.x, th.y, ax >= 0 ? -1 : 1, W.flick, W.leanX, W.leanY, W.time);
    if (px > 0) {
      const ox = W.p.x - 14, oy = W.p.y - 8;
      const x0 = ox + Math.floor((th.x - 14 - ox) / px) * px, y0 = oy + Math.floor((th.y - 30 - oy) / px) * px;
      pixelSprite(G.ctx, x0, y0, 28 + px, 38 + px, px, false, torch);
    } else torch(G.ctx);
    torchEmbers(G.ctx, W.torchP, px);
  }
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
