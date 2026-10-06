// @ts-check
// Your shots in flight: each frame of them (stepBullets, a part of step()), and what a shot
// does when it hits or dies: crits, knockback, Clusterbolt's spray, Death Cross, Teleport Bolt.

import { SFX } from '../../audio/sfx.js';
import { CELL, PH, PW, WH, WW } from '../../core/consts.js';
import { angDiff, clamp, turn } from '../../core/util.js';
import { DEV } from '../../dev/knobs.js';
import { hasPath, pathStep } from '../../spells/paths.js';
import { matchesTarget } from '../../spells/discrim.js';
import { DRIFT_ACC, DRIFT_CHASE, DRIFT_R, driftStep, wigTurn } from '../../spells/trace.js';
import { damageEnemy } from './enemies.js';
import { ignite, setAlight } from './fire.js';
import { pathEnv } from './fields.js';
import { firePayload } from './gun.js';
import { addArc, lightningStep } from './lightning.js';
import { burst } from './particles.js';
import { hurt } from './player.js';
import { shotBounce, shotDeath, shotGrind, shotTrail } from './shotlooks.js';
import { boxHit, dig, enemyAt, explode, lineOfSight, solidAt } from './terrain.js';

// Discriminate (spells/discrim.js): a shot with `only` touches nothing but its target
/** @param {Bullet} b @param {Enemy} e */
const mayHit = (b, e) => !b.only || matchesTarget(b.only, { kind: 'creature', id: e.k.id });
// the creature a targeted shot is touching at x, y (only ones that match), like enemyAt
/** @param {World} W @param {Bullet} b @param {number} x @param {number} y @param {number} pad */
function onlyAt(W, b, x, y, pad) {
  if (!b.only || b.only.kind !== 'creature') return -1;
  for (let j = 0; j < W.enemies.length; j++) {
    const e = W.enemies[j];
    if (mayHit(b, e) && Math.hypot(x - e.x, y - e.ty) < e.r + pad) return j;
  }
  return -1;
}
// a targeted shot's blast: hurts only its target in reach (creatures as explode() does, you as a
// blast hurts you, a prop as a blast knocks it), and leaves the rock, fire and everything else alone
/** @param {World} W @param {GameCtx} G @param {Bullet} b @param {number} x @param {number} y @param {number} R */
function onlyBlast(W, G, b, x, y, R) {
  SFX.boom(x, y, R);
  W.flashes.push({ x, y, r: R, t: 0 });
  burst(W, x, y, 8, b.col);
  for (let j = W.enemies.length - 1; j >= 0; j--) {
    const e = W.enemies[j], dist = Math.hypot(e.x - x, e.ty - y);
    if (b.only && b.only.kind === 'creature' && mayHit(b, e) && dist < R + e.r) damageEnemy(W, j, dist < R * 0.5 ? 3 : 2);
  }
  if (b.only && b.only.kind === 'player' && !W.p.dead) {
    const dist = Math.hypot(W.p.x + PW / 2 - x, W.p.y + PH / 2 - y), reach = R + 10;
    if (dist < reach) hurt(W, G, Math.round(25 * (1 - dist / reach)));
  }
  if (b.only && b.only.kind === 'object') for (const pr of W.props) {
    if (pr.gone || !matchesTarget(b.only, { kind: 'object', id: pr.k })) continue;
    const bx = clamp(x, pr.x + pr.l, pr.x + pr.r), by = clamp(y, pr.y + pr.t0, pr.y + pr.b);
    if (Math.hypot(bx - x, by - y) < R + 6) pr.hurt = (pr.hurt || 0) + 2;
  }
}

// Clusterbolt: the shot bursts into a handful of small explosive bolts
/** @param {World} W @param {Bullet} b */
export function spray(W, b) {
  SFX.fx('cluster', b.x, b.y);
  const n = Math.min(8, b.cluster);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 140 + Math.random() * 120;
    W.bullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.5 + Math.random() * 0.3, dmg: Math.max(0.6, b.dmg * 0.3), size: 2,
      col: b.col, spin: 0, homing: 0, bounce: 0, pierce: 0, explode: 9,
      grav: 300, accel: 0, bore: 0, hit: null, age: 0 });
  }
  burst(W, b.x, b.y, 8, b.col);
}

// Death Cross: four arms of blast rather than one round crater
/** @param {World} W @param {GameCtx} G @param {Bullet} b */
export function explodeCross(W, G, b) {
  const R = b.explode || 20;
  explode(W, G, b.x, b.y, R * 0.6);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
    explode(W, G, b.x + dx * R * 0.9, b.y + dy * R * 0.9, R * 0.55);
}

/** @param {number} dmg @param {number} chance */
export const critRoll = (dmg, chance) => (chance && Math.random() < chance ? (SFX.fx('crit'), dmg * 3) : dmg);
/** @param {Enemy} e @param {number} nx @param {number} ny */
export const shove = (e, nx, ny, force) => {
  e.x += nx * force * 0.03; e.y += ny * force * 0.03; e.tgt = null;
};

// Teleport Bolt: put you where the bolt stopped. It may have stopped against rock, so
// back up along its own track (and nudge up/down) until your whole body fits; if
// nowhere near fits, it fizzles and you stay put.
/** @param {World} W @param {Bullet} b */
export function teleportTo(W, b) {
  if (W.p.dead) return;
  const sp = Math.hypot(b.vx, b.vy), nx = sp ? b.vx / sp : 0, ny = sp ? b.vy / sp : 0;
  for (let back = 0; back <= 40; back += 3)
    for (const dy of [0, -4, 4, -8, 8, -12, 12, -16, 16]) {
      const x = b.x - nx * back - PW / 2, y = b.y - ny * back - PH / 2 + dy;
      if (x < CELL * 3 || y < CELL * 3 || x + PW > WW - CELL * 3 || y + PH > WH - CELL * 3) continue;
      if (boxHit(W, x, y)) continue;
      burst(W, W.p.x + PW / 2, W.p.y + PH / 2, 10, b.col);
      W.p.x = x; W.p.y = y; W.p.vx = 0; W.p.vy = 0;
      burst(W, W.p.x + PW / 2, W.p.y + PH / 2, 12, b.col);
      SFX.fx('warp', W.p.x + PW / 2, W.p.y + PH / 2);
      return;
    }
  burst(W, b.x, b.y, 4, b.col);
  SFX.fx('fizzle', b.x, b.y);
}

// ---- shots (a part of step) ----
// Every shot of yours in flight, one frame: fuse, drag, speed, paths and homing, Black Hole's
// pull, the move in small steps (creatures hit, rock hit or bounced off or dug through), how
// it dies (explosion, fire, a trigger's payload, Teleport Bolt, its look), then the lightning
// arcs fading.
/** @param {World} W @param {GameCtx} G @param {StepFrame} F */
export function stepBullets(W, G, F) {
  const { dt } = F;
  for (let i = W.bullets.length - 1; i >= 0; i--) {
    const b = W.bullets[i];
    b.life -= dt; b.spin += dt * 12; b.age = (b.age || 0) + dt;
    let dead = b.life <= 0, boom = false;
    if (dead && b.lifeBoom && b.explode) { dead = false; boom = true; }   // a bomb's fuse burns down
    if (b.fuse && b.age >= b.fuse) { boom = b.explode ? true : false; if (!b.explode) dead = true;
      else { if (b.only) onlyBlast(W, G, b, b.x, b.y, b.explode); else explodeCross(W, G, b); dead = true; boom = false; } }
    if (b.grav) b.vy += b.grav * dt;
    if (b.drag) { const k = Math.exp(-b.drag * dt); b.vx *= k; b.vy *= k; }
    if (b.accel) { const f = 1 + b.accel * dt; b.vx *= f; b.vy *= f; }
    if (b.vmax) { const v = Math.hypot(b.vx, b.vy); if (v > b.vmax) { b.vx *= b.vmax / v; b.vy *= b.vmax / v; } }
    if (b.wig) turn(b, wigTurn(b.wig, b.age, dt));
    if (b.look) shotTrail(W, b, dt);
    // paths (spells/paths.js): Boomerang, Ping-Pong, Spiral, Orbit, Follow Me; tracePath flies the same
    let ex = 0, ey = 0;
    if (hasPath(b)) {
      [ex, ey] = pathStep(b, dt, pathEnv(W, b, dt));
      if (b.caught) dead = true;                      // a boomerang back in your hand
    }
    if (b.eat && !b.only) dig(W, G, b.x, b.y, b.eat);
    if (b.fire && !b.only) ignite(W, G, b.x, b.y, b.size + 2, 0.5);     // a fire spell lights what it flies through
    if (b.arc) lightningStep(W, b, dt);
    // a timer lets its payload go in mid-air, and the carrier flies on
    if (b.payload && b.timer != null && (b.timer -= dt) <= 0) firePayload(W, G, b);
    if (b.pull) {
      // Black Hole: heavy gravity. It reaches ~2.2x its pull stat and drags harder the
      // closer you are, so creatures get hauled in and held in the middle of it. It
      // swallows enemy shots that come near, and grinds anything in it every 0.3s.
      const reach = DEV.bhPull * b.pull / 70;          // Dev knob: max pull range
      for (const e of W.enemies) {
        if (!mayHit(b, e)) continue;
        const dx = b.x - e.x, dy = b.y - e.ty, d = Math.hypot(dx, dy) || 1;
        if (d < reach) {
          const f = Math.min(d / dt, 60 + 420 * (1 - d / reach));   // never overshoot the centre
          e.x += dx / d * f * dt; e.y += dy / d * f * dt; e.tgt = null;
        }
      }
      for (let k = W.enemyShots.length - 1; k >= 0; k--) {
        const es = W.enemyShots[k];
        const dx = b.x - es.x, dy = b.y - es.y, d = Math.hypot(dx, dy) || 1;
        if (d < b.size + 6) { burst(W, es.x, es.y, 3, '#c58cff'); SFX.fx('absorb', es.x, es.y); W.enemyShots.splice(k, 1); continue; }
        if (d < reach) { es.vx += dx / d * 900 * dt; es.vy += dy / d * 900 * dt; }
      }
      if ((b.grind = (b.grind || 0) + dt) > 0.3) { b.grind = 0; b.hit = null; }
      // the trail of magic it leaves behind
      if (Math.random() < 0.9) {
        const a = Math.random() * 6.28, rr = b.size * (0.6 + Math.random() * 0.5);
        const life = 0.6 + Math.random() * 0.7;
        W.motes.push({ kind: 'drift', x: b.x + Math.cos(a) * rr, y: b.y + Math.sin(a) * rr,
          vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, life, max: life,
          s: 0.8 + Math.random() * 1.6, c: Math.random() < 0.3 ? '#f0e0ff' : Math.random() < 0.6 ? '#c58cff' : '#8a5cff' });
      }
    }
    if (b.split && b.age > 0.28) {                   // one clean split, partway along
      b.split = 0;
      SFX.fx('split', b.x, b.y);
      for (const turnBy of [-0.3, 0.3]) {
        const c = Object.assign({}, b, { hit: null, split: 0, age: 0 });
        const sp = Math.hypot(b.vx, b.vy), a = Math.atan2(b.vy, b.vx) + turnBy;
        c.vx = Math.cos(a) * sp; c.vy = Math.sin(a) * sp;
        W.bullets.push(c);
      }
    }
    if (b.drift) {
      // Pollen: drags to a stop and floats; locks onto the first creature in range
      // it can see, then speeds back up and homes. Loses the lock if that one dies.
      if (b.lock && W.enemies.indexOf(b.lock) < 0) b.lock = null;
      if (!b.lock) {
        const d = driftStep(b.vx, b.vy, dt); b.vx = d[0]; b.vy = d[1];
        let bd = b.homeR || DRIFT_R;
        for (const e of W.enemies) {
          if (!mayHit(b, e)) continue;
          const dd = Math.hypot(e.x - b.x, e.ty - b.y);
          if (dd < bd && lineOfSight(W, b.x, b.y, e.x, e.ty)) { bd = dd; b.lock = e; }
        }
      }
      if (b.lock) {
        const e = b.lock, sp = Math.min(DRIFT_CHASE, Math.hypot(b.vx, b.vy) + DRIFT_ACC * dt);
        const want = Math.atan2(e.ty - b.y, e.x - b.x);
        const ang = Math.hypot(b.vx, b.vy) < 5 ? want
          : Math.atan2(b.vy, b.vx) + clamp(angDiff(want, Math.atan2(b.vy, b.vx)), -b.homing * dt, b.homing * dt);
        b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
      }
    }
    if (b.homing && !b.drift) {
      let best = null, bd = b.homeR || 260;
      for (const e of W.enemies) {
        if (!mayHit(b, e)) continue;
        const d = Math.hypot(e.x - b.x, e.ty - b.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const sp = Math.hypot(b.vx, b.vy) || 1;
        let ang = Math.atan2(b.vy, b.vx);
        let diff = Math.atan2(best.ty - b.y, best.x - b.x) - ang;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        ang += clamp(diff, -b.homing * dt, b.homing * dt);
        b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
      }
    }
    const sn = Math.max(1, Math.ceil(Math.hypot(b.vx * dt + ex, b.vy * dt + ey) / 2));
    for (let st = 0; st < sn && !dead && !boom; st++) {
      const nx = b.x + (b.vx * dt + ex) / sn, ny = b.y + (b.vy * dt + ey) / sn;
      const j = b.only ? onlyAt(W, b, nx, ny, b.size + 1) : enemyAt(W, nx, ny, b.size + 1);
      if (j >= 0 && !(b.hit && b.hit.has(W.enemies[j]))) {
        const e = W.enemies[j];
        const sp = Math.hypot(b.vx, b.vy) || 1;
        damageEnemy(W, j, critRoll(b.dmg, b.crit));
        if (b.fire) setAlight(e);
        burst(W, nx, ny, 4, b.col);
        SFX.hit(nx, ny);
        if (b.knock) shove(e, b.vx / sp, b.vy / sp, b.knock);
        b.x = nx; b.y = ny;
        if (b.payload && b.trig !== 'expire') firePayload(W, G, b);   // a trigger goes off on a hit
        if (b.chain > 0) {                            // hop to the next one along
          (b.hit || (b.hit = new Set())).add(e);
          let best = null, bd = 150;
          for (const o of W.enemies) {
            if (b.hit.has(o) || !mayHit(b, o)) continue;
            const d = Math.hypot(o.x - nx, o.ty - ny);
            if (d < bd) { bd = d; best = o; }
          }
          if (best) {
            b.chain--;
            SFX.fx('chainhop', nx, ny);
            const a = Math.atan2(best.ty - ny, best.x - nx);
            b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
            b.life = Math.max(b.life, 0.4);
            continue;
          }
        }
        if (b.only && (b.cluster || b.pop)) { onlyBlast(W, G, b, nx, ny, b.pop || 12); dead = true; break; }
        if (b.cluster) { spray(W, b); dead = true; break; }
        if (b.explode) { boom = true; break; }
        if (b.pop) { explode(W, G, nx, ny, b.pop, b.dmg * 0.5); dead = true; break; }
        if (b.pull) { (b.hit || (b.hit = new Set())).add(e); continue; }   // a black hole rolls on
        if (b.pierce > 0) { b.pierce--; (b.hit || (b.hit = new Set())).add(e); }
        else { dead = true; break; }
      }
      // aimed at you (Discriminate): it hits you once it's clear of the muzzle
      if (b.only && b.only.kind === 'player' && b.age > 0.12 && !W.p.dead && nx > W.p.x - 2 && nx < W.p.x + PW + 2 &&
          ny > W.p.y - 2 && ny < W.p.y + PH + 2) {
        burst(W, nx, ny, 5, b.col); hurt(W, G, Math.max(1, Math.round(b.dmg * 2)));
        if (b.explode) { b.x = nx; b.y = ny; boom = true; } else dead = true;
        break;
      }
      if (b.friendly && !b.only && !W.p.dead && nx > W.p.x - 2 && nx < W.p.x + PW + 2 &&
          ny > W.p.y - 2 && ny < W.p.y + PH + 2) {
        burst(W, nx, ny, 5, b.col); hurt(W, G, Math.round(b.dmg * 2)); dead = true; break;
      }
      if (solidAt(W, nx, ny)) {
        if (b.payload && b.trig !== 'expire') firePayload(W, G, b);   // so does touching rock
        if (b.bounce > 0 && !b.bore && !b.eat) {
          b.bounce--;
          const hx = solidAt(W, nx, b.y), hy = solidAt(W, b.x, ny);
          if (hx || !hy) b.vx = -b.vx;
          if (hy || !hx) b.vy = -b.vy;
          const be = b.bounceE || 0.92;
          b.vx *= be; b.vy *= be;
          const slow = Math.hypot(b.vx, b.vy) < 60;
          if (slow && b.lifeBoom) b.bounce++;         // a bomb at rest doesn't use up its bounces
          if (!slow) SFX.bounce(b.x, b.y);
          if (b.look) shotBounce(W, b);
          if (b.bounceFx === 'explode' && !b.only) explode(W, G, b.x, b.y, Math.max(10, b.explode || 12));
          break;                      // stay put: b.x/b.y are still outside the rock
        }
        // a targeted shot stops at rock like any other, but never digs, blasts or burns it
        if (b.only) { burst(W, b.x, b.y, 3, b.col); SFX.rock(b.x, b.y); dead = true; break; }
        b.x = nx; b.y = ny;
        if (b.bore > 0) { if (b.look) shotGrind(W, b, nx, ny); dig(W, G, nx, ny, b.bore); continue; }
        // Matter Eater / Black Hole: eat straight through the rock, digging as it goes,
        // so a fast shot can't outrun the small hole its per-frame eat carves ahead
        if (b.eat > 0) { dig(W, G, nx, ny, b.eat); continue; }
        if (b.cluster) { spray(W, b); dead = true; break; }
        if (b.explode) { boom = true; break; }
        if (b.pop) { explode(W, G, b.x, b.y, b.pop, b.dmg * 0.5); dead = true; break; }
        if (b.pit) dig(W, G, nx, ny, b.pit);                // Noita's small hole where a shot lands
        burst(W, b.x, b.y, 3, b.col);
        SFX.rock(b.x, b.y);
        dead = true;
        break;
      }
      b.x = nx; b.y = ny;
    }
    if (boom) { if (b.only) onlyBlast(W, G, b, b.x, b.y, b.explode); else explode(W, G, b.x, b.y, b.explode, undefined, b.fire); dead = true; }
    if (dead && b.fire && !b.only) ignite(W, G, b.x, b.y, b.size + 6, 0.9);
    // an expiration trigger goes off however it dies; a trigger stopped by a prop counts as a hit
    if (dead && b.payload && (b.trig === 'expire' || b.struck)) firePayload(W, G, b);
    if (dead && b.tele) teleportTo(W, b);            // Teleport Bolt: you go where it stopped
    if (dead && b.arc && b.trail) {               // the bolt's path lingers for a blink
      b.trail.push({ x: b.x, y: b.y });
      addArc(W, b.trail, b.col, 1.4, 0.16);
    }
    if (dead && b.look) shotDeath(W, b);
    if (dead) W.bullets.splice(i, 1);
  }
  for (let i = W.arcs.length - 1; i >= 0; i--) if ((W.arcs[i].t += dt) > W.arcs[i].max) W.arcs.splice(i, 1);
}
