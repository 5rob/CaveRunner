// @ts-check
// Where a shot goes: tracePath flies one forward with the same rules as the live
// bullets, for the aim line, plus the flight helpers both share (driftStep, wigTurn, bhSp).
// Anything that changes how a bullet flies goes in the bullet loop AND here, or the line lies.

import { angDiff } from '../core/util.js';
import { DEV } from '../dev/knobs.js';
import { MODS } from './mods.js';
import { FOLLOW_AHEAD, hasPath, pathStep } from './paths.js';

// Black Hole travel speed from the Dev knob, as a multiplier so speed mods still stack
export const bhSp = (/** @type {{ pull: number }} */ sh) => sh.pull ? DEV.bhSpeed / MODS.void.speed : 1;

// Fly a shot forward with the same rules the live bullets use, so the aim line
// shows what this gun with these mods will actually do: gravity, acceleration,
// homing, ricochets and drilling all included.
// Pollen's flight: its launch speed drags away, and once it's nearly still it floats
// upward. It only homes once a creature comes within its lock radius; then it speeds
// back up to DRIFT_CHASE and steers in.
export const DRIFT_DRAG = 2.4, DRIFT_SLOW = 30, DRIFT_FLOAT = 40, DRIFT_RISE = 22;
export const DRIFT_R = 80, DRIFT_CHASE = 130, DRIFT_ACC = 260;
/** @param {number} vx @param {number} vy @param {number} dt @returns {number[]} the new [vx, vy] */
export function driftStep(vx, vy, dt) {
  const k = Math.exp(-DRIFT_DRAG * dt);
  vx *= k; vy *= k;
  if (Math.hypot(vx, vy) < DRIFT_SLOW) vy = Math.max(-DRIFT_RISE, vy - DRIFT_FLOAT * dt);
  return [vx, vy];
}

// Spark's crackle: a fast side-to-side swing of the heading, amp/WIG_HZ radians either way,
// centred on where you aimed. wigTurn is how far to turn this step (from age - dt to age);
// it's pure in the shot's age, so the aim line and the live shot swing the same way.
export const WIG_HZ = 45;
/** @type {(amp: number, t: number) => number} */
export const wigAng = (amp, t) => amp / WIG_HZ * Math.cos(t * WIG_HZ);
/** @type {(amp: number, age: number, dt: number) => number} */
export const wigTurn = (amp, age, dt) => wigAng(amp, age) - (age - dt > 1e-9 ? wigAng(amp, age - dt) : 0);

/**
 * @param {Shot} sh @param {number} x0 @param {number} y0 @param {number} nx @param {number} ny the aim (a unit vector)
 * @param {(x: number, y: number) => unknown} solid is there rock here
 * @param {{ x: number, ty: number }[] | null} enemies what homing and Pollen lock onto
 * @param {number[]} out filled with x, y, x, y, … and returned
 * @param {Pt | null} [home0] where a boomerang comes back to and an orbit circles (you; default x0, y0)
 * @param {number} [far] stretches how far the line runs (the Carrot stat)
 */
export function tracePath(sh, x0, y0, nx, ny, solid, enemies, out, home0, far = 1) {
  const dt = 1 / 60;
  if (sh.flat) { nx = nx >= 0 ? 1 : -1; ny = 0; }
  if (sh.beam) {                       // a beam is a straight line, drawn to whatever stops it
    out.length = 0;
    out.push(x0, y0);
    for (let d = 6; d <= sh.beam; d += 5) {
      const bx = x0 + nx * d, by = y0 + ny * d;
      if (!sh.bore && solid(bx, by)) break;
      out.push(bx, by);
    }
    return out;
  }
  const reach = sh.reach != null ? sh.reach : 10;
  let x = x0 + nx * reach, y = y0 + ny * reach;
  const ox = x, oy = y;
  let vx = nx * sh.speed, vy = ny * sh.speed;
  let life = Math.min(sh.life, 2.5 * far), bounce = sh.bounce || 0;
  let age = 0, lock = false;
  // the pretend shot's path (spells/paths.js), from your gun at x0, y0
  const home = home0 || { x: x0, y: y0 };
  /** @type {PathEnv} */
  const env = { home, ahead: { x: home.x + nx * FOLLOW_AHEAD, y: home.y + ny * FOLLOW_AHEAD }, anchor: null };
  /** @type {Mover} */
  const mv = { x, y, vx, vy, age: 0, born: sh.life, boomer: sh.boomer, pong: sh.pong, spiral: sh.spiral,
    orbit: sh.orbit, follow: sh.follow, followAim: sh.followAim };
  const pathed = hasPath(mv);
  out.length = 0;
  out.push(x, y);
  for (let i = 0, n = 110 * far; i < n && life > 0; i++) {
    life -= dt; age += dt;
    if (sh.grav) vy += sh.grav * dt;
    if (sh.drag) { const k = Math.exp(-sh.drag * dt); vx *= k; vy *= k; }
    if (sh.accel) { const f = 1 + sh.accel * dt; vx *= f; vy *= f; }
    if (sh.vmax) { const v = Math.hypot(vx, vy); if (v > sh.vmax) { vx *= sh.vmax / v; vy *= sh.vmax / v; } }
    // the same bends the live bullets get, so the line stays honest
    const swing = by => { const sp = Math.hypot(vx, vy), a = Math.atan2(vy, vx) + by;
      vx = Math.cos(a) * sp; vy = Math.sin(a) * sp; };
    if (sh.wig) swing(wigTurn(sh.wig, age, dt));
    let ex = 0, ey = 0;
    if (pathed) {
      mv.x = x; mv.y = y; mv.vx = vx; mv.vy = vy; mv.age = age; mv.life = life;
      [ex, ey] = pathStep(mv, dt, env);
      vx = mv.vx; vy = mv.vy; life = Math.min(Math.max(life, mv.life || 0), 2.5 * far - age);
      if (mv.caught) { out.push(x, y); break; }
    }
    if (sh.drift && !lock) {             // Pollen: drags to a stop, then floats up
      const d = driftStep(vx, vy, dt); vx = d[0]; vy = d[1];
      if (enemies) for (const e of enemies) if (Math.hypot(e.x - x, e.ty - y) < (sh.homeR || DRIFT_R)) lock = true;
    }
    if (sh.drift && lock) { const sp = Math.hypot(vx, vy);
      if (sp < DRIFT_CHASE) { const f = Math.min(DRIFT_CHASE, sp + DRIFT_ACC * dt) / (sp || 1);
        vx = sp ? vx * f : 0; vy = sp ? vy * f : -DRIFT_ACC * dt; } }
    if (sh.homing && enemies && enemies.length && (!sh.drift || lock)) {
      let best = null, bd = sh.homeR || 260;
      for (const e of enemies) {
        const d = Math.hypot(e.x - x, e.ty - y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const sp = Math.hypot(vx, vy) || 1;
        let ang = Math.atan2(vy, vx);
        let diff = Math.atan2(best.ty - y, best.x - x) - ang;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        const turn = sh.homing * dt;
        ang += Math.max(-turn, Math.min(turn, diff));
        vx = Math.cos(ang) * sp; vy = Math.sin(ang) * sp;
      }
    }
    const n = Math.max(1, Math.ceil(Math.hypot(vx * dt + ex, vy * dt + ey) / 3));
    let stop = false;
    for (let st = 0; st < n; st++) {
      const ax = x + (vx * dt + ex) / n, ay = y + (vy * dt + ey) / n;
      if (solid(ax, ay)) {
        if (sh.bore > 0 || sh.eat > 0) { x = ax; y = ay; continue; }
        if (bounce > 0) {
          bounce--;
          const hx = solid(ax, y), hy = solid(x, ay);
          if (hx || !hy) vx = -vx;
          if (hy || !hx) vy = -vy;
          const e = sh.bounceE || 0.92;
          vx *= e; vy *= e;
          break;
        }
        stop = true;
        break;
      }
      x = ax; y = ay;
    }
    out.push(x, y);
    if (stop) break;
  }
  return out;
}
