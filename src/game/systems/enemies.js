// The creatures, the part they all share: a frame of them all (stepEnemies, a part of step():
// timers, aggro, the hover, the contact bite, Contact Damage, their shots), one pull of a
// creature's trigger (fireEnemyShot), and taking damage (damageEnemy: a kill drops its gold).
// What each act does on top (its move, a bomber's fuse and burst, firing, a nest's death, the
// spider's silk) is its hooks in ACTS, the files in game/creatures/ (REFACTOR.md D20).

import { SFX } from '../../audio/sfx.js';
import { COL, PH, PW } from '../../core/consts.js';
import { HUNTERS } from '../../data/creatures.js';
import { DEV, jcol, kr } from '../../dev/knobs.js';
import { fireArea } from '../../world/fire.js';
import { ACTS } from '../creatures/acts.js';
import { ignite, youAlight } from './fire.js';
import { burst, goo, splat } from './particles.js';
import { hurt } from './player.js';
import { lineOfSight, solidAt } from './terrain.js';

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

// ---- the creatures (a part of step) ----
// The enemy loop (aggro, each act's hooks: its move, contact, firing), Contact Damage, the
// creatures' shots, each act's once-a-frame part (ACTS: the spider's silk), and the red flash
// of your last hit fading.
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
    // its act's hooks (ACTS, D20); an act not in the table moves like a chaser
    const A = ACTS[k.act] || ACTS.chase;
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
    // the act's part before its move (ACTS, D20): a bomber's fuse
    if (A.pre) A.pre(W, G, e, C);
    // the act's move (ACTS, D20); true = it did its whole frame, nothing below runs for it
    if (A.move && A.move(W, G, e, C)) continue;
    e.chill = 1;                                  // fields re-apply it every frame
    e.ty = k.kp ? e.y : e.y + Math.sin(W.time * 2 + e.phase) * (hunting ? 2 : 4);

    // contact: a chaser hurts you by reaching you, a bomber goes off
    if (hunting && dist < e.r + 14 && e.touch <= 0) {
      if (A.contact && A.contact(W, G, e, C)) continue;   // the bomber: gone
      SFX.creature(k, 'bite', e.x, e.ty);
      hurt(W, G, k.kp ? Math.round(kr(k.kp + 'Bite')) : k.dmg);
      e.touch = k.kp ? kr(k.kp + 'BiteCd') : 0.9;
    }

    // firing (ACTS, D20): shooters and turrets
    if (A.fire) A.fire(W, G, e, C);
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
  // each act's once-a-frame part (ACTS, D20): the spider's silk, strings and web lines
  for (const a in ACTS) { const fr = ACTS[a].frame; if (fr) fr(W, G, F); }
  W.p.hitT -= dt;
}
