// @ts-check
// The classic creatures' Game side (REFACTOR.md D20): the acts the not-yet-reworked ones share,
// whatever body they wear (their sprites are in creatures/classic.js). A chaser comes at you and
// bites (the shared contact), a bomber comes at you with a fuse ticking and bursts, a shooter
// patrols and fires on sight, a turret holds station and winds up a long shot. classicMove is
// the hunt-or-patrol move chasers, bombers and shooters share.

import { SFX } from '../../audio/sfx.js';
import { PATROL_R } from '../../core/consts.js';
import { fireEnemyShot } from '../systems/enemies.js';
import { fireBlast } from '../systems/fire.js';
import { burst } from '../systems/particles.js';
import { hurt } from '../systems/player.js';
import { lineOfSight, solidAt } from '../systems/terrain.js';

// Hunting, it comes straight at you, sliding along rock; else it patrols round home
/** @param {World} W @param {GameCtx} G @param {Enemy} e @param {EnemyCtx} C */
export function classicMove(W, G, e, C) {
  const { dt, dx, dy, dist, hunting } = C, k = e.k;
  if (hunting) {
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
}

// Before a bomber's move (ACTS pre)
/** @param {World} W @param {GameCtx} G @param {Enemy} e @param {EnemyCtx} C */
export function bombFuse(W, G, e, C) {
  const { dt, dist, hunting } = C, k = e.k;
  // a bomber closing in ticks like a fuse, faster the nearer it gets
  if (hunting && dist < 160 && (e.fuseT = (e.fuseT || 0) - dt) <= 0) {
    e.fuseT = 0.12 + dist / 400; SFX.creature(k, 'fuse', e.x, e.ty);
  }
}

// A bomber reaching you (ACTS contact): it bursts, and it's gone
/** @param {World} W @param {GameCtx} G @param {Enemy} e @param {EnemyCtx} C */
export function bombBurst(W, G, e, C) {
  const { i } = C, k = e.k;
  burst(W, e.x, e.ty, 22, k.col.a);
  SFX.boom(e.x, e.ty, 26);
  hurt(W, G, k.dmg);
  W.enemies.splice(i, 1);
  // @ts-expect-error k.fire is never set: enemyFor doesn't copy it (REFACTOR.md, Found along the way: Stendari)
  if (k.fire) fireBlast(W, G, e.x, e.ty, 26, 1);
  return true;
}

// A shooter's or turret's firing (ACTS fire). A turret with a wind-up shows the ring first and
// only shoots if it still has a line on you when the ring closes.
/** @param {World} W @param {GameCtx} G @param {Enemy} e @param {EnemyCtx} C */
export function gunFire(W, G, e, C) {
  const { dt, dist, sees, pcx, pcy } = C, k = e.k;
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
