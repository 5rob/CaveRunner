// One frame of the picture: draw(W, G). Game's loop runs it every frame (after step(), unless
// paused), and the death replay (drawReplay, systems/recorder.js) runs it with a recorded moment
// swapped into W. Moved whole out of Game in P3.4; REFACTOR.md plans its split into layers.
// It is not only a picture, so keep its order: it draws from the sim's Math.random stream,
// writes the fog memory (fogReveal) and moves the camera.

import { propGlow } from '../../art/props.js';
import { drawGun, drawRunner, drawSconce, drawTorch, glowAt } from '../../art/sprites.js';
import {
  CELL, CH, COL, CW, FH, FOG, FOG_U, FW, LAMP_REACH, MINI_D, MMH, MMW, PH, PW, SIGHT, VIEW_MIN_H,
  VIEW_W, WH, WW
} from '../../core/consts.js';
import { clamp, hexRgb } from '../../core/util.js';
import { PERKS } from '../../data/perks.js';
import { themeFor } from '../../data/themes.js';
import { DEV, jcol, kru } from '../../dev/knobs.js';
import { effRecharge, gunPassives, planCast } from '../../spells/cast.js';
import { gunAccent } from '../../spells/guns.js';
import { bhSp, tracePath } from '../../spells/trace.js';
import { ROOM_HH, ROOM_HW } from '../../world/level.js';
import { VIS_RAYS, fogReveal, visPoly } from '../../world/vision.js';
import { fogLit, roomSeen } from '../systems/fog.js';
import { plantGlow } from '../systems/plantglow.js';
import { maxHp, torchHand } from '../systems/player.js';
import { solidAt, solidCell } from '../systems/terrain.js';
import { drawEnemies, drawSilk } from './actors.js';
import {
  drawArrival, drawLoot, drawPortal, drawProps, drawRooms, drawShop, drawTerrain
} from './cave.js';
import { drawSmoke } from './effects.js';
import { drawBeams, drawFields, drawShots } from './looks.js';

export function draw(W, G) {
  // the frame: what draw's parts hand on to each other (REFACTOR.md D19). drawCamera fills
  // in the view and where you are, drawProps the theme (TH) and onView
  const F = { dpr: 0, playPx: 0, vw: 0, vh: 0, pcx: 0, pcy: 0, TH: null, onView: null };
  drawCamera(W, G, F);                      // the view, the camera, the canvas cleared
  const { dpr, playPx, vw, vh, pcx, pcy } = F;

  drawTerrain(W, G, F);                     // background, shop wall, rock, burning pixels (cave.js)

  drawProps(W, G, F);                       // props, drips, ambience; fills TH, onView (cave.js)
  const { TH, onView } = F;

  drawPortal(W, G);                         // the exit (cave.js)

  drawSmoke(W, G);                          // smoke (effects.js)

  drawFields(W, G, F);                      // static fields (looks.js)

  drawSilk(W, G);                           // spider silk (actors.js)

  drawEnemies(W, G, F);                     // the creatures (actors.js)

  drawShots(W, G);                          // shots in flight, lightning arcs (looks.js)
  drawBeams(W, G);                          // beams (looks.js)

  drawArrival(W, G, F);                     // the way in (cave.js)

  drawShop(W, G, F);                        // the shop's stock (cave.js)

  drawLoot(W, G, F);                        // gold, guns and mods lying about (cave.js)

  drawRooms(W, G, F);                       // the hidden rooms' prizes (cave.js)

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
