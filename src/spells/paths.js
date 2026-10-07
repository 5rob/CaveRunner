// @ts-check
// Flight paths (v0.0.137): Boomerang, Ping-Pong, Spiral Arc, Orbiting Arc, Follow Me and Follow This, in one
// pure function, pathStep, that moves a shot in flight, a static field a path mod set moving, and
// the aim line's pretend shot (tracePath) the same way, so the three always agree.

import { angDiff } from '../core/util.js';

export const BOOM_TURN = 9;          // rad/s a returning boomerang turns (at Boomerang's 3.2)
export const BOOM_CATCH = 10;        // a boomerang back this close to you is caught: gone
export const BOOM_MAX = 3;           // ... and gives up after this many times its flight time
export const PONG_T = 0.28;          // Ping-Pong: out this long, back half as long, and again
export const SPIRAL_HZ = 3;          // Spiral Arc: swings side to side this often a second
export const SPIRAL_GROW = 6;        // ... each swing wider: spiral × this units more a second
export const ORBIT_R = 26;           // Orbiting Arc: the circle's radius
export const ORBIT_IN = 0.2;         // ... seconds to swing out to it
export const ORBIT_W = 14;           // ... the fastest it goes round, rad/s
export const FOLLOW_AHEAD = 34;      // Follow This: a field comes to rest this far ahead of your gun
export const FIELD_SPEED = 150;      // a field a path mod moves travels at this
export const SEEK_ACC = 7;           // ... and steers this hard (1/s) when it heads for something

/** does this shot or field take a path from pathStep? @param {PathMods} o */
export const hasPath = o => !!(o.boomer || o.pong || o.spiral || o.orbit || o.follow || o.followAim || (o.still && o.homing));

// Spiral Arc's sideways offset at age t: a sine wave that widens as it goes
/** @param {number} k the shot's spiral @param {number} t */
export const spiralOff = (k, t) => k * SPIRAL_GROW * t * Math.sin(t * SPIRAL_HZ * 2 * Math.PI);

/**
 * One step of a mover's path. Turns its velocity (or, for a field, steers it), and returns how far
 * it moves on top of vx·dt, vy·dt this step (the spiral's swing, the orbit's pull onto its circle).
 * Sets `caught` when a boomerang is back with you.
 * @param {Mover} o x, y, vx, vy, age (already counting this step), born (its flight time), and its path fields
 * @param {number} dt
 * @param {PathEnv} env home: you (a boomerang comes back to it, an orbit circles it); ahead: where
 *   Follow Me goes; anchor: what an orbit circles instead (a trigger's carrier), else home;
 *   enemies: what a homing field goes for
 * @returns {number[]} [ex, ey]
 */
export function pathStep(o, dt, env) {
  let ex = 0, ey = 0;
  const age = o.age;
  // head for a point: a shot turns (keeping its speed), a field steers and slows as it arrives
  /** @param {number} tx @param {number} ty @param {number} rate */
  const head = (tx, ty, rate) => {
    const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy) || 1;
    if (o.still) {
      const want = Math.min(FIELD_SPEED, d * 5), k = Math.min(1, SEEK_ACC * dt);
      o.vx += (dx / d * want - o.vx) * k; o.vy += (dy / d * want - o.vy) * k;
      return d;
    }
    const sp = Math.hypot(o.vx, o.vy) || 1, a = Math.atan2(o.vy, o.vx);
    const b = a + Math.max(-rate * dt, Math.min(rate * dt, angDiff(Math.atan2(dy, dx), a)));
    o.vx = Math.cos(b) * sp; o.vy = Math.sin(b) * sp;
    return d;
  };
  if (o.boomer) {
    // out for half its flight time, then it turns for home and flies back to you
    if (!o.back && age >= (o.born || 1) * 0.5) o.back = 1;
    if (o.back) {
      const d = head(env.home.x, env.home.y, BOOM_TURN * o.boomer / 3.2);
      if (d < BOOM_CATCH) o.caught = 1;
      else if (o.life != null && o.life < 0.05 && age < (o.born || 1) * BOOM_MAX) o.life = 0.05;   // it isn't back yet
    }
  }
  // Follow Me: to you, shot or field (owner, v0.0.155); Follow This: to the spot ahead of your gun
  if (o.follow) head(env.home.x, env.home.y, o.follow);
  if (o.followAim) head(env.ahead.x, env.ahead.y, o.followAim);
  if (o.still && o.homing && env.enemies) {
    let best = null, bd = o.homeR || 260;
    for (const e of env.enemies) { const d = Math.hypot(e.x - o.x, e.ty - o.y); if (d < bd) { bd = d; best = e; } }
    if (best) head(best.x, best.ty, o.homing);
  }
  if (o.pong) {
    // out PONG_T, back half that, out again: it snaps back and forth but still gets somewhere
    const want = age % (PONG_T * 1.5) < PONG_T ? 1 : -1;
    if (want !== (o.pdir || 1)) { o.vx = -o.vx; o.vy = -o.vy; }
    o.pdir = want;
  }
  if (o.spiral) {
    // a widening side-to-side swing across the way it's heading
    const sp = Math.hypot(o.vx, o.vy), a = sp > 1 ? Math.atan2(o.vy, o.vx) : (o.ang || 0);
    const s = spiralOff(o.spiral, age) - spiralOff(o.spiral, Math.max(0, age - dt));
    ex += -Math.sin(a) * s; ey += Math.cos(a) * s;
  }
  if (o.orbit) {
    // round and round what cast it: you (your gun), or a trigger's carrier wherever it's got to
    const c = env.anchor || env.home;
    if (o.oa == null) {
      o.oa = Math.atan2(o.y - c.y, o.x - c.x); o.or0 = Math.hypot(o.x - c.x, o.y - c.y);
      o.osp = Math.max(o.still ? FIELD_SPEED : 0, Math.hypot(o.vx, o.vy));
    }
    const r = o.or0 + (ORBIT_R - o.or0) * Math.min(1, age / ORBIT_IN);
    const w = Math.min(ORBIT_W, Math.max(o.orbit, (o.osp || 0) / ORBIT_R));
    o.oa += w * dt;
    const tx = c.x + Math.cos(o.oa) * r, ty = c.y + Math.sin(o.oa) * r;
    o.vx = -Math.sin(o.oa) * w * r; o.vy = Math.cos(o.oa) * w * r;
    ex = tx - (o.x + o.vx * dt); ey = ty - (o.y + o.vy * dt);
  }
  return [ex, ey];
}
