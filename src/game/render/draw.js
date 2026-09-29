// One frame of the picture: draw(W, G). Game's loop runs it every frame (after step(), unless
// paused), and the death replay (drawReplay, systems/recorder.js) runs it with a recorded moment
// swapped into W. Moved whole out of Game in P3.4; REFACTOR.md plans its split into layers.
// It is not only a picture, so keep its order: it draws from the sim's Math.random stream,
// writes the fog memory (fogReveal) and moves the camera.

import { drawProp, propGlow, rgbA } from '../../art/props.js';
import {
  drawGun, drawGunGlow, drawRunner, drawSconce, drawTorch, glowAt
} from '../../art/sprites.js';
import {
  CELL, CH, COL, CW, FH, FOG, FOG_U, FW, LAMP_REACH, MINI_D, MMH, MMW, PH, PW, SHOP_FLOOR, SIGHT,
  VIEW_MIN_H, VIEW_W, WH, WW
} from '../../core/consts.js';
import { clamp, hexRgb, mix } from '../../core/util.js';
import { drawEnemy } from '../../creatures/draw.js';
import { PERKS } from '../../data/perks.js';
import { themeFor } from '../../data/themes.js';
import { DEV, jcol, kru } from '../../dev/knobs.js';
import { effRecharge, gunPassives, planCast } from '../../spells/cast.js';
import { gunAccent } from '../../spells/guns.js';
import { MODS, famCol } from '../../spells/mods.js';
import { bhSp, tracePath } from '../../spells/trace.js';
import { ROOM_HH, ROOM_HW } from '../../world/level.js';
import { VIS_RAYS, fogReveal, visPoly } from '../../world/vision.js';
import { fogLit, roomSeen } from '../systems/fog.js';
import { jag } from '../systems/lightning.js';
import { plantGlow } from '../systems/plantglow.js';
import { maxHp, torchHand } from '../systems/player.js';
import { solidAt, solidCell } from '../systems/terrain.js';
import { drawTerrain } from './cave.js';
import { drawBolt, drawFieldLook, drawLook } from './looks.js';

export function draw(W, G) {
  // the frame: what draw's parts hand on to each other (REFACTOR.md D19). drawCamera fills
  // in the view and where you are
  const F = { dpr: 0, playPx: 0, vw: 0, vh: 0, pcx: 0, pcy: 0 };
  drawCamera(W, G, F);                      // the view, the camera, the canvas cleared
  const { dpr, playPx, vw, vh, pcx, pcy } = F;

  drawTerrain(W, G, F);                     // background, shop wall, rock, burning pixels (cave.js)

  // the props (pass 3), their drips and the theme's ambience
  const TH = themeFor(W.floor);
  const onView = (x, y, m) => x > W.camX - m && x < W.camX + vw + m && y > W.camY - m && y < W.camY + vh + m;
  for (const pr of W.props)
    if (pr.x + pr.r > W.camX - 70 && pr.x + pr.l < W.camX + vw + 70 && pr.y + pr.b > W.camY - 90 && pr.y + pr.t0 < W.camY + vh + 90)
      drawProp(G.ctx, pr, W.time, TH);
  for (const q of W.dparts) {
    if (q.glow) continue;
    G.ctx.globalAlpha = Math.min(1, q.life / q.max * 3);
    G.ctx.fillStyle = q.c; G.ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
  }
  G.ctx.lineWidth = 0.8;
  for (const q of W.amb) {
    if (q.glow) continue;
    G.ctx.globalAlpha = Math.min(1, q.life);
    if (q.streak) {
      G.ctx.strokeStyle = q.c; G.ctx.beginPath();
      G.ctx.moveTo(q.x - Math.sign(q.vx) * q.streak, q.y); G.ctx.lineTo(q.x, q.y); G.ctx.stroke();
    } else { G.ctx.fillStyle = q.c; G.ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
  }
  G.ctx.fillStyle = rgbA(mix(TH.rock[1], [255, 255, 255], 0.2));
  for (const dv of W.devils) {                          // a dust devil: a funnel of grit
    G.ctx.globalAlpha = 0.7 * Math.min(1, dv.life / 1.5, (dv.max - dv.life) / 1);
    for (let k = 0; k < 24; k++) {
      const hh = k / 24 * 30, r = 1.5 + hh * 0.35, a = W.time * 10 + k * 1.1;
      G.ctx.fillRect(dv.x + Math.cos(a) * r + Math.sin(W.time * 3 + k) - 0.6, dv.y - hh - 0.6, 1.2, 1.2);
    }
  }
  for (const cl of W.clouds) {                          // a burst pod's spore cloud
    const a = Math.min(1, cl.life / 1.5) * 0.28;
    for (let k = 0; k < 5; k++) {
      const ang = k * 1.26 + W.time * 0.6, rr = cl.r * 0.45;
      G.ctx.globalAlpha = a; G.ctx.fillStyle = '#a8d85a';
      G.ctx.beginPath(); G.ctx.arc(cl.x + Math.cos(ang) * rr, cl.y + Math.sin(ang) * rr * 0.7, cl.r * 0.6, 0, 6.29); G.ctx.fill();
    }
  }
  for (const rg of W.rings) {                           // a noise going out
    G.ctx.globalAlpha = 1 - rg.t / 0.9; G.ctx.strokeStyle = '#f0e6ff'; G.ctx.lineWidth = 1.2;
    G.ctx.beginPath(); G.ctx.arc(rg.x, rg.y, 8 + rg.t * 140, 0, 6.29); G.ctx.stroke();
  }
  G.ctx.globalAlpha = 1;

  // exit portal: a glowing pool with a slow swirl of dashes round its rim
  const pulse = 0.55 + 0.25 * Math.sin(W.time * 3);
  const pcxE = W.portal.x + W.portal.w / 2, pcyE = W.portal.y + W.portal.h / 2;
  G.ctx.globalAlpha = pulse * 0.35;
  G.ctx.fillStyle = COL.portal;
  G.ctx.beginPath(); G.ctx.ellipse(pcxE, pcyE, W.portal.w, W.portal.h * 0.75, 0, 0, Math.PI * 2); G.ctx.fill();
  G.ctx.globalAlpha = pulse;
  G.ctx.beginPath(); G.ctx.ellipse(pcxE, pcyE, W.portal.w / 2, W.portal.h / 2, 0, 0, Math.PI * 2); G.ctx.fill();
  G.ctx.globalAlpha = 0.9;
  G.ctx.fillStyle = '#d8fff0';
  G.ctx.beginPath(); G.ctx.ellipse(pcxE, pcyE, W.portal.w * 0.22, W.portal.h * 0.26, 0, 0, Math.PI * 2); G.ctx.fill();
  G.ctx.globalAlpha = 0.6;
  G.ctx.strokeStyle = '#c8ffe4'; G.ctx.lineWidth = 1.2;
  G.ctx.setLineDash([3, 5]); G.ctx.lineDashOffset = W.time * 12;
  G.ctx.beginPath(); G.ctx.ellipse(pcxE, pcyE, W.portal.w * 0.62, W.portal.h * 0.6, 0, 0, Math.PI * 2); G.ctx.stroke();
  G.ctx.setLineDash([]);
  G.ctx.globalAlpha = 1;

  // smoke
  for (const m of W.smoke) {
    G.ctx.fillStyle = m.c || COL.smoke;
    G.ctx.globalAlpha = Math.max(0, m.life / m.max) * (m.a || 0.5);
    G.ctx.beginPath(); G.ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); G.ctx.fill();
  }
  G.ctx.globalAlpha = 1;

  // static fields
  for (const f of W.fields) {
    if (f.y > W.camY + vh + f.r || f.y < W.camY - f.r) continue;
    const t = f.life / f.max;
    const beat = 0.75 + 0.25 * Math.sin(W.time * (f.field === 'mine' ? 7 : 3));
    G.ctx.globalAlpha = 0.14 * beat * (f.field === 'mine' || f.field === 'dormant' ? 2 : 1);
    G.ctx.fillStyle = f.col;
    G.ctx.beginPath(); G.ctx.arc(f.x, f.y, f.r * (f.field === 'mine' ? 0.35 : 1), 0, Math.PI * 2); G.ctx.fill();
    G.ctx.globalAlpha = 0.55 * beat;
    G.ctx.strokeStyle = f.col;
    G.ctx.lineWidth = 1.5;
    G.ctx.setLineDash([5, 4]);
    G.ctx.lineDashOffset = -W.time * 14;
    G.ctx.beginPath(); G.ctx.arc(f.x, f.y, f.r * (0.4 + 0.6 * t), 0, Math.PI * 2); G.ctx.stroke();
    G.ctx.setLineDash([]);
    G.ctx.globalAlpha = 1;
    if (!drawFieldLook(W, G, f, beat)) { G.ctx.fillStyle = f.col; G.ctx.beginPath(); G.ctx.arc(f.x, f.y, 3.5, 0, Math.PI * 2); G.ctx.fill(); }
  }
  G.ctx.globalAlpha = 1;
  G.ctx.globalAlpha = 1;

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

  // projectiles
  for (const b of W.enemyShots) {
    if (b.goo) {                           // poison spit: a wobbling glob with a wet highlight
      const s = b.size, wob = 1 + 0.12 * Math.sin(W.time * 30 + b.x * 0.1);
      G.ctx.save(); G.ctx.translate(b.x, b.y); G.ctx.rotate(Math.atan2(b.vy, b.vx));
      G.ctx.fillStyle = b.edge || '#123d18';
      G.ctx.beginPath(); G.ctx.ellipse(0, 0, s * 1.45 * wob, s * 1.05 / wob, 0, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.fillStyle = b.col;
      G.ctx.beginPath(); G.ctx.ellipse(-s * 0.08, 0, s * 1.2 * wob, s * 0.82 / wob, 0, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.fillStyle = b.shine || '#e6ffb8';
      G.ctx.beginPath(); G.ctx.arc(s * 0.3, -s * 0.28, s * 0.32, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.restore();
      continue;
    }
    G.ctx.fillStyle = b.col;
    G.ctx.beginPath(); G.ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2); G.ctx.fill();
  }
  // shots are drawn as streaks along their own velocity, so a fast one reads
  // as a long dash and a slow heavy one as a stub
  G.ctx.lineCap = 'round';
  for (const b of W.bullets) {
    if (b.hidden) continue;                 // Buzzsaw cuts without drawing a circle
    if (b.pull) {                           // Black Hole: purple haze, starry black core
      const r = b.size, core = b.eat || r * 0.78, beat = 1 + 0.06 * Math.sin(W.time * 6 + b.spin);
      const g = G.ctx.createRadialGradient(b.x, b.y, core * 0.8, b.x, b.y, r * 1.55 * beat);
      g.addColorStop(0, 'rgba(197,140,255,0.75)');
      g.addColorStop(0.3, 'rgba(150,90,255,0.35)');
      g.addColorStop(1, 'rgba(110,50,220,0)');
      G.ctx.fillStyle = g;
      G.ctx.beginPath(); G.ctx.arc(b.x, b.y, r * 1.55 * beat, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.fillStyle = '#050208';
      G.ctx.beginPath(); G.ctx.arc(b.x, b.y, core, 0, Math.PI * 2); G.ctx.fill();
      for (let k = 0; k < 14; k++) {       // twinkling stars wheeling inside
        const tw = Math.sin(W.time * 8 + k * 1.7);
        if (tw < 0.1) continue;
        const ang = k * 2.4 + W.time * (0.5 + (k % 3) * 0.35), rad = core * (0.15 + ((k * 0.37) % 0.75));
        const sx = b.x + Math.cos(ang) * rad, sy = b.y + Math.sin(ang) * rad, sz = 0.6 + tw * 0.9;
        G.ctx.globalAlpha = tw;
        G.ctx.fillStyle = k % 3 ? '#e6d4ff' : '#ffffff';
        G.ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
      }
      G.ctx.globalAlpha = 0.8;
      G.ctx.strokeStyle = '#b98aff'; G.ctx.lineWidth = 1.2;
      G.ctx.beginPath(); G.ctx.arc(b.x, b.y, core, 0, Math.PI * 2); G.ctx.stroke();
      G.ctx.globalAlpha = 1;
      continue;
    }
    if (b.look && drawLook(W, G, b)) continue;
    if (b.arc && b.trail && b.trail.length > 1) {   // lightning: a fresh zig-zag every frame
      drawBolt(G, jag(b.trail.concat([{ x: b.x, y: b.y }]), 5), b.col, 1.6, 1);
      continue;
    }
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const len = Math.max(0.5, Math.min(46, sp * 0.022));   // length is speed alone
    const hx = b.vx / sp * len, hy = b.vy / sp * len;
    if (b.homing) {
      G.ctx.globalAlpha = 0.3;
      G.ctx.strokeStyle = COL.enemy;
      G.ctx.lineWidth = b.size * 1.7 + 4;
      G.ctx.beginPath(); G.ctx.moveTo(b.x - hx, b.y - hy); G.ctx.lineTo(b.x, b.y); G.ctx.stroke();
      G.ctx.globalAlpha = 1;
    }
    G.ctx.strokeStyle = b.col;
    G.ctx.lineWidth = b.size * 1.7;
    G.ctx.beginPath(); G.ctx.moveTo(b.x - hx, b.y - hy); G.ctx.lineTo(b.x, b.y); G.ctx.stroke();
    if (b.explode) {
      G.ctx.fillStyle = Math.sin(b.spin) > 0 ? COL.flame2 : COL.visor;
      G.ctx.fillRect(b.x - 1, b.y - 1, 2, 2);
    }
  }
  for (const a of W.arcs) drawBolt(G, a.pts, a.col, a.w, 1 - a.t / a.max);
  // instant beams, which fade over a few frames
  for (const bm of W.beams) {
    const fade = 1 - bm.t / 0.12;
    if (bm.look) {                          // v96: a wide wavering halo under the beam
      G.ctx.globalAlpha = fade * 0.18;
      G.ctx.strokeStyle = bm.col; G.ctx.lineWidth = bm.w * (7 + Math.random() * 2);
      G.ctx.beginPath(); G.ctx.moveTo(bm.x, bm.y); G.ctx.lineTo(bm.x + bm.nx * bm.len, bm.y + bm.ny * bm.len); G.ctx.stroke();
    }
    G.ctx.globalAlpha = fade * 0.35;
    G.ctx.strokeStyle = bm.col; G.ctx.lineWidth = bm.w * 3.5;
    G.ctx.beginPath(); G.ctx.moveTo(bm.x, bm.y);
    G.ctx.lineTo(bm.x + bm.nx * bm.len, bm.y + bm.ny * bm.len); G.ctx.stroke();
    G.ctx.globalAlpha = fade;
    G.ctx.lineWidth = bm.w * 1.2;
    G.ctx.beginPath(); G.ctx.moveTo(bm.x, bm.y);
    G.ctx.lineTo(bm.x + bm.nx * bm.len, bm.y + bm.ny * bm.len); G.ctx.stroke();
  }
  G.ctx.globalAlpha = 1;

  // the portal you arrived through: scenery only
  if (W.arrival.y < W.camY + vh + 40 && W.arrival.y > W.camY - 40) {
    const sway = 0.5 + 0.18 * Math.sin(W.time * 1.6);
    G.ctx.fillStyle = '#4a4550';
    G.ctx.fillRect(W.arrival.x - 16, W.arrival.y + 12, 32, 5);
    G.ctx.globalAlpha = 0.22 * sway;
    G.ctx.fillStyle = COL.enemy;
    G.ctx.beginPath(); G.ctx.ellipse(W.arrival.x, W.arrival.y, 17, 21, 0, 0, Math.PI * 2); G.ctx.fill();
    G.ctx.globalAlpha = 0.5 * sway;
    G.ctx.beginPath(); G.ctx.ellipse(W.arrival.x, W.arrival.y, 10, 14, 0, 0, Math.PI * 2); G.ctx.fill();
    G.ctx.globalAlpha = 1;
    G.ctx.strokeStyle = '#6c6480'; G.ctx.lineWidth = 2.5;
    G.ctx.beginPath(); G.ctx.ellipse(W.arrival.x, W.arrival.y, 13, 17, 0, 0, Math.PI * 2); G.ctx.stroke();
    G.ctx.fillStyle = 'rgba(233,236,242,0.34)';
    G.ctx.font = '600 7px system-ui, sans-serif';
    G.ctx.textAlign = 'center';
    G.ctx.fillText('WAY IN', W.arrival.x, W.arrival.y - 22);
    G.ctx.textAlign = 'left';
  }

  // shop stock on its plinths
  for (const it of W.stock) {
    if (it.y > W.camY + vh + 40 || it.y < W.camY - 40) continue;
    const bob = Math.sin(W.time * 2 + it.x) * 2;
    // the plinth: a narrow column dropping from just under the item down to the shop
    // floor (so it isn't left hovering), with a wider foot resting on the floor
    const floorY = SHOP_FLOOR * CELL;
    G.ctx.fillStyle = '#4a4550';
    G.ctx.fillRect(it.x - 6, it.y + 4, 12, Math.max(9, floorY - (it.y + 4)));
    G.ctx.fillRect(it.x - 11, floorY - 5, 22, 5);
    if (it.sold) {
      G.ctx.fillStyle = COL.muted;
      G.ctx.font = '600 8px system-ui, sans-serif';
      G.ctx.textAlign = 'center';
      G.ctx.fillText('SOLD', it.x, it.y - 2);
      G.ctx.textAlign = 'left';
      continue;
    }
    if (it.kind === 'heal') {
      G.ctx.globalAlpha = 0.25; G.ctx.fillStyle = COL.hp;
      G.ctx.beginPath(); G.ctx.arc(it.x, it.y + bob, 13, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.globalAlpha = 1; G.ctx.fillStyle = COL.hp;
      G.ctx.fillRect(it.x - 7, it.y - 2.5 + bob, 14, 5);
      G.ctx.fillRect(it.x - 2.5, it.y - 7 + bob, 5, 14);
    } else if (it.kind === 'gun') {
      G.ctx.globalAlpha = 0.22; G.ctx.fillStyle = gunAccent(it.gun);
      G.ctx.beginPath(); G.ctx.arc(it.x, it.y + bob, 14, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.globalAlpha = 1;
      drawGun(G.ctx, it.x - 5, it.y + 1 + bob, -0.22, 0.9, gunAccent(it.gun));
      G.ctx.fillStyle = COL.bullet;
      G.ctx.font = '600 9px system-ui, sans-serif';
      G.ctx.textAlign = 'center';
      G.ctx.fillText(it.price + 'g', it.x, it.y - 13 + bob);
      G.ctx.fillStyle = COL.muted;
      G.ctx.font = '600 8px system-ui, sans-serif';
      G.ctx.fillText(it.gun.cap + ' slots', it.x, it.y + 24 + bob);
      G.ctx.textAlign = 'left';
    } else {
      const m = MODS[it.id];
      G.ctx.globalAlpha = 0.22; G.ctx.fillStyle = famCol(it.id);
      G.ctx.beginPath(); G.ctx.arc(it.x, it.y + bob, 13, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.globalAlpha = 1; G.ctx.fillStyle = famCol(it.id);
      G.ctx.beginPath();
      G.ctx.moveTo(it.x, it.y - 8 + bob); G.ctx.lineTo(it.x + 8, it.y + bob);
      G.ctx.lineTo(it.x, it.y + 8 + bob); G.ctx.lineTo(it.x - 8, it.y + bob);
      G.ctx.fill();
      G.ctx.fillStyle = '#12141a';
      G.ctx.font = '600 9px system-ui, sans-serif';
      G.ctx.textAlign = 'center'; G.ctx.textBaseline = 'middle';
      G.ctx.fillText(m.glyph, it.x, it.y + 0.5 + bob);
      G.ctx.textBaseline = 'alphabetic';
      G.ctx.fillStyle = COL.bullet;
      G.ctx.font = '600 9px system-ui, sans-serif';
      G.ctx.fillText(it.price + 'g', it.x, it.y - 12 + bob);
      G.ctx.textAlign = 'left';
    }
  }

  // gold
  for (const g of W.coins) {
    if (g.y > W.camY + vh + 30 || g.y < W.camY - 30) continue;
    const bob = Math.sin(W.time * 4 + g.t) * 1.5;
    G.ctx.fillStyle = '#d8a52a';
    G.ctx.beginPath(); G.ctx.ellipse(g.x, g.y + bob, 3.2, 4, 0, 0, Math.PI * 2); G.ctx.fill();
    G.ctx.fillStyle = COL.flame2;
    G.ctx.beginPath(); G.ctx.ellipse(g.x - 0.8, g.y - 0.8 + bob, 1.2, 1.8, 0, 0, Math.PI * 2); G.ctx.fill();
  }

  // pickups
  for (const q of W.pickups) {
    const qy = q.y + Math.sin(W.time * 2 + q.t) * 3;
    if (qy > W.camY + vh + 30 || qy < W.camY - 30 || q.x < W.camX - 30 || q.x > W.camX + vw + 30) continue;
    if (q.kind === 'gun') {
      // a gun you've never held glows, with sparks streaking out of it; one you swapped
      // out and left on the ground doesn't, so you can tell new from discarded at a glance
      if (!q.old) drawGunGlow(G.ctx, q.x, qy, W.time, q.t);
      drawGun(G.ctx, q.x - 5, qy + 1, -0.22, 0.85, gunAccent(q.gun));
    } else {
      const m = MODS[q.id];
      G.ctx.globalAlpha = 0.22; G.ctx.fillStyle = famCol(q.id);
      G.ctx.beginPath(); G.ctx.arc(q.x, qy, 12, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.globalAlpha = 1;
      G.ctx.fillStyle = famCol(q.id);
      G.ctx.beginPath();
      G.ctx.moveTo(q.x, qy - 8); G.ctx.lineTo(q.x + 8, qy); G.ctx.lineTo(q.x, qy + 8); G.ctx.lineTo(q.x - 8, qy);
      G.ctx.fill();
      G.ctx.fillStyle = '#12141a';
      G.ctx.font = '600 9px system-ui, sans-serif';
      G.ctx.textAlign = 'center'; G.ctx.textBaseline = 'middle';
      G.ctx.fillText(m.glyph, q.x, qy + 0.5);
      G.ctx.textAlign = 'left'; G.ctx.textBaseline = 'alphabetic';
    }
  }

  // the hidden rooms' prizes on their altars: a glowing perk sigil, or the +25 heart
  for (const r of W.rooms) {
    if (r.taken) continue;
    if (r.y > W.camY + vh + 40 || r.y < W.camY - 40 || r.x < W.camX - 40 || r.x > W.camX + vw + 40) continue;
    const bob = Math.sin(W.time * 2 + r.x) * 2.5;
    G.ctx.fillStyle = '#4a4550';
    G.ctx.fillRect(r.x - 12, r.y + 14, 24, 5);
    G.ctx.fillRect(r.x - 7, r.y + 5, 14, 10);
    if (r.kind === 'perk') {
      const pk = PERKS[r.id], col = pk.tint || COL.portal;
      G.ctx.globalAlpha = 0.22 + 0.12 * Math.sin(W.time * 3);
      G.ctx.fillStyle = col;
      G.ctx.beginPath(); G.ctx.arc(r.x, r.y + bob, 16, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.globalAlpha = 1;
      G.ctx.fillStyle = col;
      G.ctx.font = '700 20px system-ui, sans-serif';
      G.ctx.textAlign = 'center'; G.ctx.textBaseline = 'middle';
      G.ctx.fillText(pk.glyph, r.x, r.y + 0.5 + bob);
      G.ctx.textBaseline = 'alphabetic'; G.ctx.textAlign = 'left';
    } else {
      G.ctx.globalAlpha = 0.25 + 0.12 * Math.sin(W.time * 3);
      G.ctx.fillStyle = COL.hp;
      G.ctx.beginPath(); G.ctx.arc(r.x, r.y + bob, 16, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.globalAlpha = 1; G.ctx.fillStyle = COL.hp;
      // a plump heart
      G.ctx.beginPath();
      G.ctx.moveTo(r.x, r.y + 7 + bob);
      G.ctx.bezierCurveTo(r.x - 11, r.y - 2 + bob, r.x - 6, r.y - 11 + bob, r.x, r.y - 4 + bob);
      G.ctx.bezierCurveTo(r.x + 6, r.y - 11 + bob, r.x + 11, r.y - 2 + bob, r.x, r.y + 7 + bob);
      G.ctx.fill();
      G.ctx.fillStyle = '#0c130f';
      G.ctx.font = '700 8px system-ui, sans-serif';
      G.ctx.textAlign = 'center';
      G.ctx.fillText('+25', r.x, r.y - 14 + bob);
      G.ctx.textAlign = 'left';
    }
  }

  // Levitation Trail: the fire you left behind, still burning
  for (const bn of W.burns) {
    const t = bn.life / bn.max;
    G.ctx.globalAlpha = t * 0.8;
    G.ctx.fillStyle = t > 0.5 ? COL.flame2 : COL.flame;
    G.ctx.beginPath(); G.ctx.arc(bn.x, bn.y, 3 + (1 - t) * 5, 0, Math.PI * 2); G.ctx.fill();
  }
  G.ctx.globalAlpha = 1;

  // sparks and debris
  for (const q of W.sparks) {
    G.ctx.fillStyle = q.c;
    G.ctx.globalAlpha = Math.max(0, q.life / q.max);
    G.ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  G.ctx.globalAlpha = 1;

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

  // aim, grenade arc preview, gun
  const R = W.p.aim;
  const held = G.input.current.loadout.guns[G.input.current.loadout.sel];
  const ax = R.show ? R.nx : W.p.face, ay = R.show ? R.ny : 0;
  const gy = W.p.y + PH * 0.52;

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

  // ---- torchlight, masked by the fog of war ----
  // Line of sight is what lifts the fog: fogReveal marks every cell the fan reaches as
  // somewhere you have been, and it stays marked for the rest of the floor. The lamp
  // then lights that lifted ground — brightest at your feet, fading out to torchR — but
  // it is MASKED by the fog: a cell you have never had line of sight to stays dark even
  // with the torch right on top of it, so the cave ahead of you is a real unknown. The
  // lamp does not itself stop at walls; it is the *reveal* that respects them, so what
  // you have already uncovered round a corner still lights up. `flick` is the flame's
  // own number, so both the reach and the brightness breathe exactly as the fire does.
  const sight = SIGHT * DEV.torch;                       // dev knob scales the whole bubble
  W.torchR = clamp(sight * LAMP_REACH * (0.5 + 0.55 * W.flick), 120, 1400);
  W.visPts = visPoly(pcx, pcy, sight, (cx, cy) => solidCell(W, cx, cy), VIS_RAYS);
  fogReveal(W.seen, pcx, pcy, sight, W.visPts, VIS_RAYS);   // line of sight lifts the fog
  if (!G.RPV || G.RPV.fog) {                                 // a replay can turn the fog off
    // bake the visible slab of the overlay every frame: the base darkness is the fog
    // state, then the lamp brightens the cells the fog has already been lifted from
    const fdat = G.fogImg.data;
    const dim = Math.round(255 * DEV.fogDim), dark = Math.round(255 * DEV.fogDark);
    const lr2 = W.torchR * W.torchR;
    const fx0 = clamp(Math.floor(W.camX / FOG_U) - 1, 0, FW - 1), fy0 = clamp(Math.floor(W.camY / FOG_U) - 1, 0, FH - 1);
    const fx1 = clamp(Math.ceil((W.camX + vw) / FOG_U) + 2, 1, FW), fy1 = clamp(Math.ceil((W.camY + vh) / FOG_U) + 2, 1, FH);
    for (let cy = fy0; cy < fy1; cy++) {
      const ddy = (cy + 0.5) * FOG_U - pcy;
      for (let cx = fx0; cx < fx1; cx++) {
        const i = cy * FW + cx, k = i * 4;
        fdat[k] = 9; fdat[k + 1] = 10; fdat[k + 2] = 14;
        let s = W.seen[i];
        // push the dark off ground you have seen: an unseen cell that borders a seen one
        // is treated as remembered (dim + lamp), so a bit more of the uncovered surface
        // shows instead of the darkness sitting right on its edge
        if (!s && !(W.deepFog && W.deepFog[i]) && ((cx > 0 && W.seen[i - 1]) || (cx < FW - 1 && W.seen[i + 1]) ||
            (cy > 0 && W.seen[i - FW]) || (cy < FH - 1 && W.seen[i + FW]) ||
            (cx > 0 && cy > 0 && W.seen[i - FW - 1]) || (cx < FW - 1 && cy > 0 && W.seen[i - FW + 1]) ||
            (cx > 0 && cy < FH - 1 && W.seen[i + FW - 1]) || (cx < FW - 1 && cy < FH - 1 && W.seen[i + FW + 1]))) s = 1;
        let a = s === 2 ? 0 : s ? dim : dark;
        if (s && a) {                        // the lamp only reaches ground the fog has lifted
          const ddx = (cx + 0.5) * FOG_U - pcx, dd2 = ddx * ddx + ddy * ddy;
          if (dd2 < lr2) {
            const t = Math.sqrt(dd2) / W.torchR;               // 0 at your feet, 1 at the edge
            const lift = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
            a = a * (1 - lift);
          }
        }
        fdat[k + 3] = a;
      }
    }
    G.fctx.putImageData(G.fogImg, 0, 0, fx0, fy0, fx1 - fx0, fy1 - fy0);
    // blur the slab at source resolution (cheap: an 80x200 canvas), then upscale the soft
    // copy — a source-px of blur becomes ~a fog cell of blur on screen, so the fog edge
    // reads as a gradient rather than a hard line
    G.fbctx.clearRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
    G.fbctx.filter = 'blur(0.9px)';
    G.fbctx.drawImage(G.fogC, fx0, fy0, fx1 - fx0, fy1 - fy0, fx0, fy0, fx1 - fx0, fy1 - fy0);
    G.fbctx.filter = 'none';
    G.ctx.imageSmoothingEnabled = true;     // the upscale further softens the edge
    G.ctx.drawImage(G.fogBlurC, fx0, fy0, fx1 - fx0, fy1 - fy0,
      fx0 * FOG_U, fy0 * FOG_U, (fx1 - fx0) * FOG_U, (fy1 - fy0) * FOG_U);
    G.ctx.imageSmoothingEnabled = false;
  }

  // ---- firelight on top of the fog: the wall torches (where you have been) and the hand
  // torch's glow plus its small, warm second light round you. Additive, so it only ever
  // brightens; the map lighting under it is unchanged. The glow gutters on its own,
  // quicker and deeper than the lamp.
  G.ctx.globalCompositeOperation = 'lighter';
  const gl = clamp(0.82 + W.glowN + 0.08 * Math.sin(W.time * 23) + 0.06 * Math.sin(W.time * 37), 0.5, 1.1);
  const scOn = sc => !(sc.y > W.camY + vh + 30 || sc.y < W.camY - 30 || sc.x < W.camX - 30 || sc.x > W.camX + vw + 30) &&
    fogLit(W, sc.x, sc.y);
  for (const sc of W.sconces) {
    if (!scOn(sc)) continue;
    const sg = 0.85 + 0.15 * Math.sin(W.time * 11 + sc.ph) * Math.sin(W.time * 5.3 + sc.ph);
    glowAt(G.ctx, sc.x, sc.y - 6, 34, 0.16 * sg, '255,140,50');
    glowAt(G.ctx, sc.x, sc.y - 7, 9, 0.45 * sg, '255,190,90');
  }
  // lit props and glowing motes, only where the fog has lifted — except the eyes, which
  // watch from the dark
  for (const pr of W.props) {
    if (!(pr.k === 'lamp' || pr.k === 'vent' || pr.k === 'shard' || pr.k === 'eyes' || pr.k === 'matter' ||
      (pr.k === 'drip' && pr.st === 'lava')) || !onView(pr.x, pr.y, 60)) continue;
    if (pr.k !== 'eyes' && !fogLit(W, pr.x, pr.y)) continue;
    propGlow(G.ctx, pr, W.time, TH, Math.hypot(pr.x - pcx, pr.y - pcy), W.torchR);
  }
  // and the green round each jelly glows and twinkles in its colour (plantGlow)
  for (const e of W.enemies)
    if (e.je && onView(e.x, e.ty, 160) && fogLit(W, e.x, e.ty)) plantGlow(W, G, e, TH);
  // glowing creatures (the jellyfish) light the cave round them, flaring as they pulse.
  // Radius, brightness and flare are its kp+'GlowR' / 'Glow' / 'Flare' knobs, and like
  // every other light out here it shows only where the fog has lifted
  for (const e of W.enemies) {
    const k = e.k;
    if (!k.glow || !k.kp || !onView(e.x, e.ty, 120) || !fogLit(W, e.x, e.ty)) continue;
    const u = (e.je && e.je.u) || { glowR: 0.5, glow: 0.5, flare: 0.5 }, sh = e.je ? e.je.shape : 0;
    const a = kru(k.kp + 'Glow', u.glow) * (1 + kru(k.kp + 'Flare', u.flare) * sh);
    const rgb = e.je ? hexRgb(jcol('jeColGlow', e.je.u.col)) : k.glow;
    glowAt(G.ctx, e.x, e.ty, kru(k.kp + 'GlowR', u.glowR), a, rgb);
    glowAt(G.ctx, e.x, e.ty, e.r * 1.6, a * 1.4, rgb);
  }
  for (const b of W.enemyShots) if (b.glow && onView(b.x, b.y, 30) && fogLit(W, b.x, b.y)) glowAt(G.ctx, b.x, b.y, b.size * 6, 0.3, b.glow);
  // v95: your glowing shots light the cave round them (the Bubble Spark most of all)
  for (const b of W.bullets) if (b.light && !b.hidden && onView(b.x, b.y, 50) && fogLit(W, b.x, b.y))
    glowAt(G.ctx, b.x, b.y, b.lightR || 20, 0.28, b.light);
  // fire: the burning pixels brighten and throw a warm glow — only on ground you have seen
  if (W.fireVis.length) {
    G.ctx.fillStyle = 'rgba(255,140,50,0.32)';
    G.ctx.beginPath();
    for (const i of W.fireVis) {
      const x = (i % CW) * CELL, y = ((i / CW) | 0) * CELL;
      if (W.seen[clamp(Math.floor(y / FOG_U), 0, FH - 1) * FW + clamp(Math.floor(x / FOG_U), 0, FW - 1)]) G.ctx.rect(x, y, CELL, CELL);
    }
    G.ctx.fill();
    const st = Math.max(1, Math.ceil(W.fireVis.length / 24));
    for (let k = W.fireN % st; k < W.fireVis.length; k += st) {
      const i = W.fireVis[k], x = (i % CW + 0.5) * CELL, y = (((i / CW) | 0) + 0.5) * CELL;
      if (fogLit(W, x, y)) glowAt(G.ctx, x, y, 20, Math.min(0.14, 0.03 + W.fireVis.length / 3000) * W.flick, '255,120,40');
    }
  }
  for (const e of W.enemies)
    if (e.burn > 0 && onView(e.x, e.ty, 40) && fogLit(W, e.x, e.ty)) glowAt(G.ctx, e.x, e.ty, e.r * 2.4, 0.22 * W.flick, '255,130,50');
  for (const pr of W.firePlants)
    if (pr.burn && !pr.gone && onView(pr.x, pr.y + pr.len, 40) && fogLit(W, pr.x, pr.y + pr.len))
      glowAt(G.ctx, pr.x, pr.y + pr.len, 16, 0.2 * W.flick, '255,130,50');
  if (W.p.burn > 0 && !W.p.dead) glowAt(G.ctx, W.p.x + PW / 2, W.p.y + PH / 2, 22, 0.25 * W.flick, '255,130,50');
  for (const list of [W.dparts, W.amb]) for (const q of list) {
    if (!q.glow || !onView(q.x, q.y, 10) || !fogLit(W, q.x, q.y)) continue;
    G.ctx.globalAlpha = Math.min(1, q.life / (q.max * 0.3));
    G.ctx.fillStyle = q.c; G.ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
  }
  G.ctx.globalAlpha = 1;
  if (!W.p.dead) {
    const th = torchHand(W), gfx = th.x + (ax >= 0 ? -1 : 1) * 1.6, gfy = th.y - 11;
    glowAt(G.ctx, gfx, gfy, 70 * (0.9 + 0.1 * gl), 0.2 * gl, '255,150,60');            // the second light
    glowAt(G.ctx, gfx + W.leanX * 0.5, gfy + W.leanY * 0.5, 12, 0.5 * gl, '255,190,90');   // the halo
  }
  G.ctx.globalCompositeOperation = 'source-over';
  for (const sc of W.sconces) if (scOn(sc)) drawSconce(G.ctx, sc.x, sc.y, W.time, sc.ph);
  if (G.RPV) return;                        // a replay frame has no HUD

  // ---- HUD ----
  // The old top-left stack (floor / enemies / health / fuel / mana / gun) is gone:
  // health, mana and fuel are the rings and top-half wipe on the thumbsticks now,
  // the floor number is written big along the shop wall, and gold sits in the deck
  // between the sticks (a DOM readout in App). Only the version is drawn up here.
  G.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cw = G.c.width / dpr;
  G.ctx.shadowColor = 'rgba(0,0,0,0.6)'; G.ctx.shadowBlur = 3;
  G.ctx.fillStyle = COL.muted;
  G.ctx.font = '500 12px system-ui, sans-serif';
  G.ctx.textAlign = 'left';
  G.ctx.fillText(VERSION, 12, 22);
  G.ctx.shadowBlur = 0;

  // hand the sticks the live health / fuel / mana so they can draw their gauges:
  // the green ring round the left stick, the amber fuel wipe in its top half, and
  // the gold ring round the right stick. Written every frame the loop draws.
  const MHP = maxHp(W, G);
  const gpas = held ? gunPassives(held) : null;
  // recharge / cast-delay "readiness": 1 when ready, dropping to 0 the moment it fires
  // and filling back over its own time — so the ring that spends the most time refilling
  // is the one gating your fire. Both normalise by their own max so the wipe is 0..1.
  const effRech = held ? Math.max(0.001, effRecharge(held) * W.pb.rech) : 1;
  G.input.current.hud = {
    hp: MHP > 0 ? Math.max(0, Math.min(1, W.p.hp / MHP)) : 0,
    low: W.p.hp <= 30,
    fuel: Math.max(0, Math.min(1, W.p.fuel)),
    empty: !!W.p.empty,
    mana: held ? Math.max(0, Math.min(1, held.mana / (held.manaMax + gpas.manaMax))) : 0,
    rech: held ? (held.rechT > 0 ? clamp(1 - held.rechT / effRech, 0, 1) : 1) : 0,
    cast: held ? (held.delayT > 0 && held.delayMax ? clamp(1 - held.delayT / held.delayMax, 0, 1) : 1) : 0,
    recharging: !!(held && held.rechT > 0),
    hasGun: !!held,
  };

  // ---- radar perks: point at the nearest enemy / mod / gun still out there ----
  if (W.pb.radarEnemy || W.pb.radarItem || W.pb.radarWand) {
    const cwv = G.c.width / dpr, chv = playPx / dpr, m = 18;
    const nearest = list => {
      let best = null, bd = 1e18;
      for (const t of list) { const d = (t.x - pcx) * (t.x - pcx) + ((t.ty || t.y) - pcy) * ((t.ty || t.y) - pcy); if (d < bd) { bd = d; best = t; } }
      return best;
    };
    const marker = (t, col) => {
      if (!t) return;
      const sx = (t.x - W.camX) * W.unitPx, sy = ((t.ty || t.y) - W.camY) * W.unitPx;
      if (sx > m && sx < cwv - m && sy > m && sy < chv - m) {
        G.ctx.strokeStyle = col; G.ctx.lineWidth = 2; G.ctx.globalAlpha = 0.85;
        G.ctx.beginPath(); G.ctx.arc(sx, sy, 11, 0, Math.PI * 2); G.ctx.stroke();
        G.ctx.globalAlpha = 1; return;
      }
      const ex = clamp(sx, m, cwv - m), ey = clamp(sy, m, chv - m);
      const a = Math.atan2(sy - ey, sx - ex);
      G.ctx.save(); G.ctx.translate(ex, ey); G.ctx.rotate(a);
      G.ctx.fillStyle = col; G.ctx.globalAlpha = 0.9;
      G.ctx.beginPath(); G.ctx.moveTo(9, 0); G.ctx.lineTo(-7, -6); G.ctx.lineTo(-7, 6); G.ctx.closePath(); G.ctx.fill();
      G.ctx.restore(); G.ctx.globalAlpha = 1;
    };
    if (W.pb.radarEnemy) marker(nearest(W.enemies), PERKS.eradar.tint);
    if (W.pb.radarItem) marker(nearest(W.pickups.filter(q => q.kind === 'mod')), '#b57cff');
    if (W.pb.radarWand) marker(nearest(W.pickups.filter(q => q.kind === 'gun')), COL.bullet);
  }

  // pickup messages
  G.ctx.textAlign = 'center';
  const ch = playPx / dpr;
  for (let i = 0; i < W.toasts.length; i++) {
    const tm = W.toasts[i];
    G.ctx.globalAlpha = Math.min(1, tm.t * 1.5);
    G.ctx.fillStyle = COL.text;
    G.ctx.font = '600 14px system-ui, sans-serif';
    G.ctx.fillText(tm.text, cw / 2, ch - 18 - (W.toasts.length - 1 - i) * 19);
  }
  G.ctx.globalAlpha = 1;
  G.ctx.textAlign = 'left';

  G.ctx.textAlign = 'center';
  if (W.levelT < 3) {
    G.ctx.fillStyle = COL.text;
    G.ctx.globalAlpha = Math.min(1, 3 - W.levelT);
    G.ctx.font = '700 22px system-ui, sans-serif';
    G.ctx.fillText(themeFor(W.floor).name, cw / 2, 196);
    G.ctx.font = '500 14px system-ui, sans-serif';
    G.ctx.fillText('Find the green exit at the top', cw / 2, 218);
    G.ctx.fillText('Buy and fit mods here, then climb', cw / 2, 236);
    G.ctx.globalAlpha = 1;
  }
  const msgY = 196;
  G.ctx.fillStyle = COL.text;
  if (W.p.dead) {
    G.ctx.font = '700 22px system-ui, sans-serif';
    G.ctx.fillText('You were shot down', cw / 2, msgY);
    G.ctx.font = '500 14px system-ui, sans-serif';
    G.ctx.fillText('Tap the right stick to restart', cw / 2, msgY + 22);
  } else if (W.enemies.length === 0) {
    G.ctx.font = '700 18px system-ui, sans-serif';
    G.ctx.fillText('All enemies destroyed', cw / 2, msgY);
  }
  G.ctx.textAlign = 'left';
  G.ctx.shadowBlur = 0;

  // mouse reticule
  if (G.mouse.inside) {
    const mx = G.mouse.x, my = G.mouse.y;
    for (const [w, colr] of [[4, 'rgba(0,0,0,0.6)'], [2, G.mouse.down ? COL.flame2 : COL.text]]) {
      G.ctx.strokeStyle = colr; G.ctx.lineWidth = w;
      G.ctx.beginPath(); G.ctx.arc(mx, my, 9, 0, Math.PI * 2); G.ctx.stroke();
      G.ctx.beginPath();
      G.ctx.moveTo(mx - 15, my); G.ctx.lineTo(mx - 5, my);
      G.ctx.moveTo(mx + 5, my); G.ctx.lineTo(mx + 15, my);
      G.ctx.moveTo(mx, my - 15); G.ctx.lineTo(mx, my - 5);
      G.ctx.moveTo(mx, my + 5); G.ctx.lineTo(mx, my + 15);
      G.ctx.stroke();
    }
  }

  // ---- the map (toggled by the map button; the run is paused while it is up) ----
  // Covers the whole play area above the controls on solid black: the revealed cave as
  // white outlines, fitted and centred, with a yellow dot for you. Only outline cells the
  // fog has revealed are painted; the source is finer than the display and smooth-scaled,
  // so the walls read as continuous lines, not a scatter.
  if (G.input.current.mapOpen) {
    G.mini32.fill(0);
    for (let k = 0; k < W.miniEdgeIdx.length; k++) {
      const i = W.miniEdgeIdx[k];
      const tx = (i % MMW) * MINI_D, ty = ((i / MMW) | 0) * MINI_D;
      const fi = ((ty / FOG) | 0) * FW + ((tx / FOG) | 0);
      if (W.seen[fi]) G.mini32[i] = 0xe6ffffff;            // white, ~0.9 alpha
    }
    G.mctx.putImageData(G.miniImg, 0, 0);
    const pw = G.c.width / dpr, ph = playPx / dpr, pad = 10;
    G.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    G.ctx.fillStyle = 'rgba(0,0,0,0.8)';            // a touch see-through, so the cave shows behind
    G.ctx.fillRect(0, 0, pw, ph);
    const k = Math.min((pw - 2 * pad) / MMW, (ph - 2 * pad) / MMH);
    const mw = MMW * k, mh = MMH * k, mx0 = (pw - mw) / 2, my0 = (ph - mh) / 2;
    G.ctx.imageSmoothingEnabled = true;
    G.ctx.drawImage(G.miniC, 0, 0, MMW, MMH, mx0, my0, mw, mh);
    const wW = CW * CELL, wH = CH * CELL;
    const mX = x => mx0 + (x / wW) * mw, mY = y => my0 + (y / wH) * mh;
    // the prize rooms you've found: a yellow outline, crossed out once you've had the prize
    G.ctx.strokeStyle = '#ffd23c'; G.ctx.lineWidth = 1.5;
    for (const r of W.rooms) {
      if (!roomSeen(W, r)) continue;
      const x0 = mX(r.x - ROOM_HW), y0 = mY(r.y - ROOM_HH), x1 = mX(r.x + ROOM_HW), y1 = mY(r.y + ROOM_HH);
      G.ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      if (r.taken) {
        const ix = (x1 - x0) * 0.25, iy = (y1 - y0) * 0.2;
        G.ctx.beginPath();
        G.ctx.moveTo(x0 + ix, y0 + iy); G.ctx.lineTo(x1 - ix, y1 - iy);
        G.ctx.moveTo(x1 - ix, y0 + iy); G.ctx.lineTo(x0 + ix, y1 - iy);
        G.ctx.stroke();
      }
    }
    // loot you've seen and left: green for mods, yellow for guns (a ring if you threw it back)
    for (const q of W.pickups) {
      if (q.taken || !fogLit(W, q.x, q.y)) continue;
      const col = q.kind === 'gun' ? '#ffd23c' : '#46e07a';
      G.ctx.beginPath(); G.ctx.arc(mX(q.x), mY(q.y), 2.6, 0, Math.PI * 2);
      if (q.old) { G.ctx.strokeStyle = col; G.ctx.lineWidth = 1.2; G.ctx.stroke(); }
      else { G.ctx.fillStyle = col; G.ctx.fill(); }
    }
    // you: a bigger dot with a white rim, so it can't be mistaken for a gun
    G.ctx.fillStyle = '#ffd23c'; G.ctx.strokeStyle = '#fff'; G.ctx.lineWidth = 1.5;
    G.ctx.beginPath();
    G.ctx.arc(mX(W.p.x + PW / 2), mY(W.p.y + PH / 2), 4, 0, Math.PI * 2);
    G.ctx.fill(); G.ctx.stroke();
    G.ctx.imageSmoothingEnabled = false;
  }
}

// The view for this frame (F.dpr, F.playPx: the play area above the controls, F.vw/F.vh: the
// view in world units, F.pcx/F.pcy: your centre), the camera eased toward you (a replay's
// is the viewer's), and the canvas cleared to the floor's colour under the world's transform
export function drawCamera(W, G, F) {
  const dpr = F.dpr = window.devicePixelRatio || 1;
  // the controls overlay the bottom of the canvas (see-through), so the play area is the
  // part above them: scale and frame to that, but still draw (and cull) the full canvas
  const ctlPx = Math.min(G.c.height * 0.8, (G.RPV ? G.RPV.panelH || 0 : G.input.current.ctlH || 0) * dpr);   // a replay: its panel
  const playPx = F.playPx = G.c.height - ctlPx;
  const s = Math.min(G.c.width / VIEW_W, playPx / VIEW_MIN_H) * DEV.zoom * (G.RPV ? G.RPV.zoom : 1), vw = F.vw = G.c.width / s, vh = F.vh = G.c.height / s;
  const vhp = playPx / s;
  W.unitPx = s / dpr;
  const pcx = F.pcx = W.p.x + PW / 2, pcy = F.pcy = W.p.y + PH / 2;

  // camera (a replay's is wherever the viewer has dragged it, or on you)
  if (G.RPV) {
    if (G.RPV.follow) {                     // framed on you like the live camera, then kept as the centre
      G.RPV.cx = vw >= WW ? WW / 2 : clamp(G.RPV.cx - vw / 2, 0, WW - vw) + vw / 2;
      G.RPV.cy = clamp(G.RPV.cy - vhp * 0.55, 0, Math.max(0, WH - vhp)) + vhp / 2;
    }
    W.camX = G.RPV.cx - vw / 2; W.camY = G.RPV.cy - vhp / 2; G.RPV.unit = W.unitPx;
  } else {
    const tx = vw >= WW ? (WW - vw) / 2 : clamp(pcx - vw / 2, 0, WW - vw);
    const ty = clamp(pcy - vhp * 0.55, 0, Math.max(0, WH - vhp));
    if (!W.camReady) { W.camX = tx; W.camY = ty; W.camReady = true; }
    W.camX += (tx - W.camX) * 0.15;
    W.camY += (ty - W.camY) * 0.15;
  }

  G.ctx.setTransform(1, 0, 0, 1, 0, 0);
  G.ctx.imageSmoothingEnabled = false;
  G.ctx.fillStyle = 'rgb(' + themeFor(W.floor).bg.join(',') + ')';
  G.ctx.fillRect(0, 0, G.c.width, G.c.height);
  G.ctx.setTransform(s, 0, 0, s, -Math.round(W.camX * s), -Math.round(W.camY * s));
}
