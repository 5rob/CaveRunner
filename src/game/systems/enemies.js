// The creatures: a frame of them all (stepEnemies, a part of step(): the enemy loop, their
// shots, spider silk), shooting at you, taking damage (a kill drops its gold; a nest showers
// what its rats brought home), and where a jelly may swim (natural).

import { SFX } from '../../audio/sfx.js';
import { COL, PATROL_R, PH, PW } from '../../core/consts.js';
import { hexRgb } from '../../core/util.js';
import { jellyPal, jellyStep, tentacleTouch } from '../../creatures/jelly.js';
import { spiderStep } from '../../creatures/spider.js';
import { HUNTERS } from '../../data/creatures.js';
import { DEV, jcol, kr, spr } from '../../dev/knobs.js';
import { fireArea } from '../../world/fire.js';
import { builtAt } from '../../world/zones.js';
import { ACTS } from '../creatures/acts.js';
import { puffSpores } from './ambience.js';
import { fireBlast, ignite, youAlight } from './fire.js';
import { burst, goo, splat } from './particles.js';
import { hurt } from './player.js';
import { ratFrame } from './rats.js';
import { lineOfSight, solidAt, solidCell } from './terrain.js';

// one pull of an enemy's trigger: aimed at the player, and a shotgun type throws
// its pellets in a cone. Refuses the shot if the player has broken line of sight
// since it decided to take it.
export function fireEnemyShot(W, e, tx, ty) {
  const k = e.k;
  if (!lineOfSight(W, e.x, e.ty, tx, ty)) return;
  const base = Math.atan2(ty - e.ty, tx - e.x);
  SFX.creature(k, 'fire', e.x, e.ty);
  for (let s = 0; s < k.shots; s++) {
    const cone = k.shots > 1 ? (s - (k.shots - 1) / 2) * 0.15 : 0;
    const a = base + cone + (Math.random() - 0.5) * 0.22;
    W.enemyShots.push({ x: e.x + Math.cos(a) * (e.r + 4), y: e.ty + Math.sin(a) * (e.r + 4),
      vx: Math.cos(a) * k.bspd, vy: Math.sin(a) * k.bspd, life: 2.5,
      col: k.col.a, dmg: k.dmg, size: k.body === 'blob' ? 4 : 3, fire: k.fire });
  }
}
export function damageEnemy(W, j, dmg) {
  const e = W.enemies[j];
  e.hp -= dmg; e.flash = 0.08;
  if (e.k.kp) e.aggro = true;          // hurt a spider or a jelly and it comes for you
  if (e.hp > 0) { if (dmg >= 0.5) SFX.creature(e.k, 'hurt', e.x, e.ty); return; }
  burst(W, e.x, e.ty, 16, e.je ? jcol('jeColBody', e.je.u.col) : e.k.col.a);
  SFX.creature(e.k, 'die', e.x, e.ty);
  W.enemies.splice(j, 1);
  e.dead = true;                        // its rats find out they've no home to go to
  // a creature's own end (ACTS, D20): a nest showers its gold instead of the one coin
  const A = ACTS[e.k.act];
  if (A && A.die && A.die(W, e)) return;
  W.coins.push({ x: e.x, y: e.ty,
    amount: Math.round((e.k.gold + Math.floor(Math.random() * 3)) * W.pb.gold),
    t: Math.random() * 6.28, vy: -60 - Math.random() * 40 });
  // a rat drops what it was carrying home
  if (e.carry > 0) W.coins.push({ x: e.x, y: e.ty, amount: e.carry, t: Math.random() * 6.28,
    vx: (Math.random() - 0.5) * 60, vy: -90 - Math.random() * 40 });
}

export const natural = (W, x, y) => !builtAt(W.zone, x, y);      // jellies keep to the natural zones

// ---- the creatures (a part of step) ----
// The enemy loop (aggro, each kind's move, contact, firing), Contact Damage, the creatures'
// shots, spider strings in flight and on you, web lines whose rock is gone, and the red
// flash of your last hit fading.
export function stepEnemies(W, G, F) {
  const { dt, pcx, pcy } = F;
  // one creature's frame, for its act's hooks (ACTS, D20): made once, refilled per enemy
  const C = { dt, pcx, pcy, i: 0, dx: 0, dy: 0, dist: 0, sees: 0, hunting: false };
  // What an enemy does is what it is. Shooters hold a hover and fire on sight,
  // turrets never move and wind up a long shot, chasers come at you and hurt on
  // contact, bombers come at you and burst. Runs backwards because a bomber
  // takes itself out of the list.
  for (let i = W.enemies.length - 1; i >= 0; i--) {
    const e = W.enemies[i], k = e.k;
    e.flash -= dt;
    e.cd -= dt;
    e.touch -= dt;
    const dx = pcx - e.x, dy = pcy - e.ty, dist = Math.hypot(dx, dy) || 1;
    e.lx = dx / dist; e.ly = dy / dist;
    // Aggro (k.aggro) and firing (k.range) reaches are in world units, but the
    // camera zoom changes how much world fits on screen — zoomed in, an enemy off
    // the edge of the view could still hunt and shoot you. Scale both by 1/zoom so
    // they engage at roughly the same on-screen distance whatever the zoom.
    // Invisibility still folds in on top: creatures notice you far later.
    const sees = (W.pb.invis ? 0.4 : 1) / DEV.zoom;
    // aggro only on a real sightline: a chaser or bomber won't come for you through a
    // wall any more, only once it can actually see you (and within its aggro reach).
    // The range check comes first so the line-of-sight march only runs for the few
    // enemies already close enough to care.
    // DEV.aggro is an extra hand-tuning multiplier on the aggro reach, on top of the
    // zoom-relative `sees` scaling — firing range (k.range) is left alone.
    // Aggro is sticky: once a chaser/bomber has you it keeps coming (even out of the
    // initial reach and even round a wall), and only drops back to patrol once you've
    // put DEV.loseAggro times the aggro reach between you — so you can outrun it.
    const chaser = HUNTERS[k.act] && !W.p.dead;
    // a reworked creature rolls its own aggro reach from its knobs, once a second
    if (k.kp && ((e.aggroT = (e.aggroT || 0) - dt) <= 0)) { e.aggroM = kr(k.kp + 'Aggro'); e.aggroT = 1; }
    const reach = k.aggro * sees * DEV.aggro * (k.kp ? e.aggroM : 1);
    if (chaser) {
      if (!e.aggro) { if (dist < reach && lineOfSight(W, e.x, e.ty, pcx, pcy)) { e.aggro = true; SFX.creature(k, 'alert', e.x, e.ty); } }
      else if (dist > reach * DEV.loseAggro) e.aggro = false;
    } else e.aggro = false;
    const hunting = chaser && e.aggro;
    C.i = i; C.dx = dx; C.dy = dy; C.dist = dist; C.sees = sees; C.hunting = hunting;
    // the odd noise from anything near, seen or not: you hear the cave before you see it
    if (dist < 380 && Math.random() < 0.07 * dt) SFX.creature(k, 'idle', e.x, e.ty);
    // a bomber closing in ticks like a fuse, faster the nearer it gets
    if (hunting && k.act === 'bomb' && dist < 160 && (e.fuseT = (e.fuseT || 0) - dt) <= 0) {
      e.fuseT = 0.12 + dist / 400; SFX.creature(k, 'fuse', e.x, e.ty);
    }
    // the act's move (ACTS, D20); true = it did its whole frame, nothing below runs for it
    const A = ACTS[k.act];
    if (A && A.move) { if (A.move(W, G, e, C)) continue; }
    else if (k.act === 'rat') {
      ratFrame(W, G, e, dt, dist, hunting, pcx, pcy);
      e.chill = 1; e.ty = e.y;
      continue;
    } else if (k.act === 'spider') {
      // only on rock and its own lines (spiderStep); strings you when it has a clear line
      const cold = e.chill && e.chill < 1 ? e.chill : 1;
      if (spiderStep(e, { solidCell: (cx, cy) => solidCell(W, cx, cy), webs: W.webs, hunting, goal: { x: pcx, y: pcy }, rnd: Math.random,
        speedMul: cold }, dt) === 'web') SFX.fx('lash', e.x, e.y);
      e.silkT = (e.silkT || 0) - dt;
      const S = e.sp;
      if (hunting && e.silkT <= 0 && S && (S.mode === 'surf' || S.mode === 'line') &&
          dist < (e.silkR || (e.silkR = spr('spSilk'))) * sees && dist > e.r + 24) {
        e.silkT = 0.4;
        if (lineOfSight(W, e.x, e.y, pcx, pcy)) {
          e.silkT = spr('spSilkCd'); e.silkR = spr('spSilk');
          const v = spr('spSilkSpd');
          W.silk.push({ x: e.x, y: e.y, ax: e.x, ay: e.y, vx: dx / dist * v, vy: dy / dist * v,
            life: 400 / v * 1.3 + 0.1 });
          SFX.creature(k, 'fire', e.x, e.y);
        }
      }
    } else if (k.act === 'jelly') {
      // swims in pulses (jellyStep); spits when its head is lined up on you, in range
      const cold = e.chill && e.chill < 1 ? e.chill : 1;
      if (jellyStep(e, { solidCell: (cx, cy) => solidCell(W, cx, cy), hunting, goal: { x: pcx, y: pcy }, rnd: Math.random,
        speedMul: cold, rangeMul: sees, stay: W.zone ? ((x, y) => natural(W, x, y)) : null }, dt) === 'pulse') puffSpores(W, e);
      const S = e.je;
      // brush its tentacles and you're stung, hunting or not (same sting knobs as the bell)
      if (!W.p.dead && e.touch <= 0 && dist < 180) {
        const t = tentacleTouch(S, W.p.x, W.p.y, W.p.x + PW, W.p.y + PH);
        if (t) {
          hurt(W, G, Math.round(kr('jeBite'))); e.touch = kr('jeBiteCd');
          burst(W, t.x, t.y, 5, jellyPal(S.u.col).tent);
          SFX.creature(k, 'bite', t.x, t.y);
        }
      }
      if (hunting && S.inRange && S.aimed && e.cd <= 0) {
        e.cd = 0.25;                                // no clear line: look again shortly
        const hx = e.x + Math.cos(S.hd) * e.r * 0.9, hy = e.y + Math.sin(S.hd) * e.r * 0.9;
        if (lineOfSight(W, hx, hy, pcx, pcy)) {
          e.cd = kr('jeShotCd');
          const a = Math.atan2(pcy - hy, pcx - hx) + (Math.random() * 2 - 1) * kr('jeSpread') * Math.PI / 180;
          const v = kr('jeShotSpd'), P = jellyPal(S.u.col);
          W.enemyShots.push({ x: hx, y: hy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 3,
            col: P.spit, edge: P.spitEdge, shine: P.spitShine, dripCol: P.drip, dripCol2: P.drip2, glow: hexRgb(P.glow),
            dmg: Math.round(kr('jeShotDmg')), size: kr('jeShotSize'), goo: 1,
            drip: kr('jeDrip'), da: 0, dripG: kr('jeDripG'), splat: Math.round(kr('jeSplat')), splatV: kr('jeSplatSpd') });
          SFX.creature(k, 'fire', e.x, e.y);
        }
      }
    } else if (k.act === 'turret') {
      // holds station: the hover is all the movement it gets
    } else if (hunting) {
      const step = k.spd * (e.chill || 1) * dt;
      const wx = e.x + dx / dist * step, wy = e.y + dy / dist * step;
      if (!solidAt(W, wx - e.r, wy) && !solidAt(W, wx + e.r, wy) &&
          !solidAt(W, wx, wy - e.r) && !solidAt(W, wx, wy + e.r)) { e.x = wx; e.y = wy; }
      else if (!solidAt(W, wx, e.y)) e.x = wx;            // slide along whatever it hit
      else if (!solidAt(W, e.x, wy)) e.y = wy;
      else { e.tgt = null; e.rest = 0; }
    } else {
      // patrol: pick a spot near home, drift to it, pause, pick another. Rock in
      // the way just means the spot was a bad idea, so it chooses a different one.
      e.rest -= dt;
      if (!e.tgt || e.rest <= 0 || Math.hypot(e.tgt.x - e.x, e.tgt.y - e.y) < 6) {
        const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * PATROL_R;
        e.tgt = { x: e.hx + Math.cos(a) * r, y: e.hy + Math.sin(a) * r };
        e.rest = 2 + Math.random() * 3.5;
      }
      const tdx = e.tgt.x - e.x, tdy = e.tgt.y - e.y, td = Math.hypot(tdx, tdy) || 1;
      const step = k.spd * (e.chill || 1) * dt;
      const wx = e.x + tdx / td * step, wy = e.y + tdy / td * step;
      if (solidAt(W, wx - e.r, wy) || solidAt(W, wx + e.r, wy) ||
          solidAt(W, wx, wy - e.r) || solidAt(W, wx, wy + e.r)) { e.tgt = null; e.rest = 0; }
      else { e.x = wx; e.y = wy; }
    }
    e.chill = 1;                                  // fields re-apply it every frame
    e.ty = k.kp ? e.y : e.y + Math.sin(W.time * 2 + e.phase) * (hunting ? 2 : 4);

    // contact: a chaser hurts you by reaching you, a bomber goes off
    if (hunting && dist < e.r + 14 && e.touch <= 0) {
      if (k.act === 'bomb') {
        burst(W, e.x, e.ty, 22, k.col.a);
        SFX.boom(e.x, e.ty, 26);
        hurt(W, G, k.dmg);
        W.enemies.splice(i, 1);
        if (k.fire) fireBlast(W, G, e.x, e.ty, 26, 1);
        continue;
      }
      SFX.creature(k, 'bite', e.x, e.ty);
      hurt(W, G, k.kp ? Math.round(kr(k.kp + 'Bite')) : k.dmg);
      e.touch = k.kp ? kr(k.kp + 'BiteCd') : 0.9;
    }

    // firing. A turret with a wind-up shows the ring first and only shoots if it
    // still has a line on you when the ring closes.
    if (k.act === 'shoot' || k.act === 'turret') {
      if (e.charge > 0) {
        e.charge -= dt;
        if (e.charge <= 0) fireEnemyShot(W, e, pcx, pcy);
      } else if (!W.p.dead && dist < k.range * sees && e.cd <= 0) {
        e.cd = 0.4;   // re-check soon if we can't see the player
        if (lineOfSight(W, e.x, e.ty, pcx, pcy)) {
          e.cd = k.cd * (0.85 + Math.random() * 0.3);
          if (!e.spotted) { e.spotted = true; SFX.creature(k, 'alert', e.x, e.ty); }
          if (k.tele) { e.charge = k.tele; SFX.creature(k, 'charge', e.x, e.ty, k.tele); } else fireEnemyShot(W, e, pcx, pcy);
        }
      }
    }
  }
  // Contact Damage: anything touching you is hurt for it, whether or not it's hunting
  if (W.pb.contact && !W.p.dead) {
    for (let i = W.enemies.length - 1; i >= 0; i--) {
      const e = W.enemies[i];
      if (Math.hypot(e.x - pcx, e.ty - pcy) < e.r + 12) damageEnemy(W, i, 45 * dt);
    }
  }

  for (let i = W.enemyShots.length - 1; i >= 0; i--) {
    const b = W.enemyShots[i];
    b.life -= dt;
    // Projectile Repulsion Field: shots on their way to you are shoved aside
    if (W.pb.repel) {
      const rx = b.x - pcx, ry = b.y - pcy, rd = Math.hypot(rx, ry) || 1;
      if (rd < 72) { b.vx += rx / rd * 1100 * dt; b.vy += ry / rd * 1100 * dt; }
    }
    // poison spit drips as it flies
    if (b.drip) for (b.da += b.drip * dt; b.da >= 1; b.da--)
      goo(W, b.x + (Math.random() - 0.5) * b.size, b.y + b.size * 0.5, b.vx * 0.08, 8 + Math.random() * 18, b.dripG, b.dripCol || b.col, 0, b.dripCol2);
    let gone = b.life <= 0;
    if (b.fire) fireArea(W.fire, b.x, b.y, 4, 0.5);
    const sn = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 2);
    for (let s = 0; s < sn && !gone; s++) {
      b.x += b.vx * dt / sn; b.y += b.vy * dt / sn;
      if (solidAt(W, b.x, b.y)) {
        gone = true;
        if (b.splat != null) splat(W, b, b.x - b.vx * dt / sn, b.y - b.vy * dt / sn);
        else SFX.fx('fizzle', b.x, b.y);
        if (b.fire) ignite(W, G, b.x - b.vx * dt / sn, b.y - b.vy * dt / sn, 8, 0.9);
        break;
      }
      if (!W.p.dead && b.x > W.p.x - 2 && b.x < W.p.x + PW + 2 && b.y > W.p.y - 2 && b.y < W.p.y + PH + 2) {
        gone = true;
        if (b.splat != null) splat(W, b, b.x, b.y); else burst(W, b.x, b.y, 5, COL.player);
        hurt(W, G, b.dmg);
        if (b.fire) youAlight(W);
      }
    }
    if (gone) W.enemyShots.splice(i, 1);
  }
  // spider strings in flight: rock stops them, you catch them
  for (let i = W.silk.length - 1; i >= 0; i--) {
    const b = W.silk[i];
    b.life -= dt;
    let gone = b.life <= 0;
    const sn = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 2);
    for (let s = 0; s < sn && !gone; s++) {
      b.x += b.vx * dt / sn; b.y += b.vy * dt / sn;
      if (solidAt(W, b.x, b.y)) { gone = true; break; }
      if (!W.p.dead && b.x > W.p.x - 3 && b.x < W.p.x + PW + 3 && b.y > W.p.y - 3 && b.y < W.p.y + PH + 3) {
        gone = true;
        W.strings.push({ ax: b.ax, ay: b.ay, ox: b.x - W.p.x, oy: b.y - W.p.y, slow: spr('spSlow'), max: spr('spSilkMax') });
        SFX.fx('lash', b.x, b.y);
      }
    }
    if (gone) W.silk.splice(i, 1);
  }
  // strings on you: pulled past their length, they snap
  for (let i = W.strings.length - 1; i >= 0; i--) {
    const s = W.strings[i];
    if (Math.hypot(W.p.x + s.ox - s.ax, W.p.y + s.oy - s.ay) > s.max) {
      W.strings.splice(i, 1);
      burst(W, W.p.x + s.ox, W.p.y + s.oy, 4, '#e8e8f0');
      SFX.fx('lash', W.p.x + s.ox, W.p.y + s.oy);
    }
  }
  // a web line whose rock has been blasted away comes down (a few checked a frame)
  for (let n = Math.min(W.webs.length, 6); n > 0; n--) {
    W.webCheck = (W.webCheck + 1) % W.webs.length;
    const L = W.webs[W.webCheck];
    if ((L.bin && !solidAt(W, L.bin.x, L.bin.y)) || (L.ain && !solidAt(W, L.ain.x, L.ain.y))) {
      W.webs.splice(W.webCheck, 1);
      if (!W.webs.length) break;
    }
  }
  W.p.hitT -= dt;
}
