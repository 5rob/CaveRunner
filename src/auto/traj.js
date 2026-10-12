// @ts-check
// The purple trajectory mods in CaveRunner Auto (Part A: Orbiting Arc, Spiral Arc, Boomerang, Ping-Pong Path). The old game's
// rules (spells/paths.js pathStep) with Auto's own sizes from the Dev knobs (dev/knobs.js, groups traj…), so the curves fit the
// narrow window. Pure: art/titlescene.js stepShots calls trajStep each frame with the caster's middle (screen coords); the
// logic suites call it directly.

import { DEV } from '../dev/knobs.js';
import { angDiff } from '../core/util.js';

export const TRAJ_COL = '#b57cff';   // the mods' purple (spells/mods.js)
// the old game's strengths, one copy of each mod (spells/mods.js f): a shot's field ÷ this = how many copies
export const TRAJ_ONE = { orbit: 3.4, spiral: 5.5, boomer: 3.2, pong: 4 };

/** @typedef {{ x: number, y: number, vx: number, vy: number, age?: number, life: number, orbit?: number, spiral?: number,
 *   boomer?: number, pong?: number, born?: number, back?: number, caught?: number, oa?: number, or0?: number, odir?: number,
 *   pdir?: number, ang?: number }} TrajShot */

/** does it fly one of these paths? @param {{ orbit?: number, spiral?: number, boomer?: number, pong?: number }} s */
export const hasTraj = s => !!(s.orbit || s.spiral || s.boomer || s.pong);

// Spiral Arc's sideways offset at age t: a sine wave widening by trSpGrow a second (per copy), at most trSpMax either side
/** @param {number} k the shot's spiral @param {number} t */
export const trajSpiralOff = (k, t) => Math.min(DEV.trSpMax, k / TRAJ_ONE.spiral * DEV.trSpGrow * t) * Math.sin(t * DEV.trSpHz * 2 * Math.PI);

// a shot's lifetime × the knobs of the paths it has (shotsOf)
/** @param {{ orbit?: number, spiral?: number, boomer?: number, pong?: number }} s */
export const trajLife = s => (s.orbit ? DEV.trOrbLife : 1) * (s.spiral ? DEV.trSpLife : 1) * (s.boomer ? DEV.trBoLife : 1) * (s.pong ? DEV.trPoLife : 1);

/**
 * One frame of a shot's path: turns its velocity, and returns how far it moves on top of vx·dt, vy·dt (the spiral's swing,
 * the orbit's pull onto its circle). `s.age` already counts this frame. A boomerang back with its caster sets `caught` and
 * its life to 0. No caster (gone): it flies on.
 * @param {TrajShot} s @param {number} dt @param {{ x: number, y: number } | null} home the caster's middle
 * @returns {number[]} [ex, ey]
 */
export function trajStep(s, dt, home) {
  let ex = 0, ey = 0;
  const age = s.age || 0;
  if (s.born == null) s.born = s.life + Math.max(0, age - dt);
  if (s.boomer && home) {
    // out trBoDist from its caster (or trBoOut of its life), then it turns for home (trBoTurn rad/s × copies) and flies back to the caster
    if (!s.back && (age >= s.born * DEV.trBoOut || Math.hypot(s.x - home.x, s.y - home.y) >= DEV.trBoDist)) s.back = 1;
    if (s.back) {
      const dx = home.x - s.x, dy = home.y - s.y, d = Math.hypot(dx, dy);
      if (d < DEV.trBoCatch) { s.caught = 1; s.life = 0; return [0, 0]; }
      const sp = Math.hypot(s.vx, s.vy) || 1, a = Math.atan2(s.vy, s.vx), rate = DEV.trBoTurn * s.boomer / TRAJ_ONE.boomer * dt;
      const b = a + Math.max(-rate, Math.min(rate, angDiff(Math.atan2(dy, dx), a)));
      s.vx = Math.cos(b) * sp; s.vy = Math.sin(b) * sp;
      if (s.life < 0.05 && age < s.born * DEV.trBoMax) s.life = 0.05;   // not back yet
    }
  }
  if (s.pong) {
    // out trPoOut s, back trPoBack × that, out again
    const out = DEV.trPoOut, per = out * (1 + DEV.trPoBack);
    const want = DEV.trPoBack <= 0 || age % per < out ? 1 : -1;
    if (want !== (s.pdir || 1)) { s.vx = -s.vx; s.vy = -s.vy; }
    s.pdir = want;
  }
  if (s.spiral) {
    // a widening side-to-side swing across the way it's heading
    const sp = Math.hypot(s.vx, s.vy), a = sp > 1 ? Math.atan2(s.vy, s.vx) : (s.ang || 0);
    const d = trajSpiralOff(s.spiral, age) - trajSpiralOff(s.spiral, Math.max(0, age - dt));
    ex += -Math.sin(a) * d; ey += Math.cos(a) * d;
  }
  if (s.orbit && home) {
    // round and round its caster, out to trOrbR over trOrbIn s, at trOrbW rad/s × copies, the way it was fired
    if (s.oa == null) {
      s.or0 = Math.hypot(s.x - home.x, s.y - home.y);
      s.oa = s.or0 > 1 ? Math.atan2(s.y - home.y, s.x - home.x) : Math.atan2(s.vy, s.vx);
      const cr = (s.x - home.x) * s.vy - (s.y - home.y) * s.vx;
      s.odir = cr < 0 ? -1 : 1;
    }
    const r = (s.or0 || 0) + (DEV.trOrbR - (s.or0 || 0)) * Math.min(1, DEV.trOrbIn > 0 ? age / DEV.trOrbIn : 1);
    const w = DEV.trOrbW * s.orbit / TRAJ_ONE.orbit * (s.odir || 1);
    s.oa += w * dt;
    const tx = home.x + Math.cos(s.oa) * r, ty = home.y + Math.sin(s.oa) * r;
    s.vx = -Math.sin(s.oa) * w * r; s.vy = Math.cos(s.oa) * w * r;
    ex = tx - (s.x + s.vx * dt); ey = ty - (s.y + s.vy * dt);
  }
  return [ex, ey];
}

// The look of a trajectory shot: the first of its mods (orbit, spiral, boomer, pong, seeker, short-range, homing, auto-aim, gravity,
// anti-gravity, flat) picks the knobs. null: none of them
/** @typedef {{ orbit?: number, spiral?: number, boomer?: number, pong?: number, homN?: number, seekN?: number, nearN?: number, autoaim?: number,
 *   gravN?: number, floatN?: number, flat?: number }} TrajLooks */
/** @param {TrajLooks} s
 *  @returns {{ trail: number, alpha: number, width: number, glow: number, glowA: number, tint: number } | null} */
export function trajLook(s) {
  if (s.orbit) return { trail: DEV.trOrbTrail, alpha: DEV.trOrbTrailA, width: DEV.trOrbTrailW, glow: DEV.trOrbGlow, glowA: DEV.trOrbGlowA, tint: DEV.trOrbTint };
  if (s.spiral) return { trail: DEV.trSpTrail, alpha: DEV.trSpTrailA, width: DEV.trSpTrailW, glow: DEV.trSpGlow, glowA: DEV.trSpGlowA, tint: DEV.trSpTint };
  if (s.boomer) return { trail: DEV.trBoTrail, alpha: DEV.trBoTrailA, width: DEV.trBoTrailW, glow: DEV.trBoGlow, glowA: DEV.trBoGlowA, tint: DEV.trBoTint };
  if (s.pong) return { trail: DEV.trPoTrail, alpha: DEV.trPoTrailA, width: DEV.trPoTrailW, glow: DEV.trPoGlow, glowA: DEV.trPoGlowA, tint: DEV.trPoTint };
  if (s.seekN) return { trail: DEV.trSeTrail, alpha: DEV.trSeTrailA, width: DEV.trSeTrailW, glow: DEV.trSeGlow, glowA: DEV.trSeGlowA, tint: DEV.trSeTint };
  if (s.nearN) return { trail: DEV.trNeTrail, alpha: DEV.trNeTrailA, width: DEV.trNeTrailW, glow: DEV.trNeGlow, glowA: DEV.trNeGlowA, tint: DEV.trNeTint };
  if (s.homN) return { trail: DEV.trHoTrail, alpha: DEV.trHoTrailA, width: DEV.trHoTrailW, glow: DEV.trHoGlow, glowA: DEV.trHoGlowA, tint: DEV.trHoTint };
  if (s.autoaim) return { trail: DEV.trAimTrail, alpha: DEV.trAimTrailA, width: DEV.trAimTrailW, glow: DEV.trAimGlow, glowA: DEV.trAimGlowA, tint: DEV.trAimTint };
  if (s.gravN) return { trail: DEV.trGravTrail, alpha: DEV.trGravTrailA, width: DEV.trGravTrailW, glow: DEV.trGravGlow, glowA: DEV.trGravGlowA, tint: DEV.trGravTint };
  if (s.floatN) return { trail: DEV.trFloatTrail, alpha: DEV.trFloatTrailA, width: DEV.trFloatTrailW, glow: DEV.trFloatGlow, glowA: DEV.trFloatGlowA, tint: DEV.trFloatTint };
  if (s.flat) return { trail: DEV.trFlatTrail, alpha: DEV.trFlatTrailA, width: DEV.trFlatTrailW, glow: DEV.trFlatGlow, glowA: DEV.trFlatGlowA, tint: DEV.trFlatTint };
  return null;
}
// a '#rrggbb' colour mixed k of the way to the mods' purple, as 'r,g,b'
/** @param {string} col @param {number} k */
export function trajRgb(col, k) {
  const a = rgbOf(col), b = rgbOf(TRAJ_COL);
  return a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',');
}
/** @param {string} c @returns {number[]} */
function rgbOf(c) { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); const n = m ? parseInt(m[1], 16) : 0xffffff; return [n >> 16 & 255, n >> 8 & 255, n & 255]; }

// Part B. Homing (homN), Seeker (seekN), Short-range Homing (nearN): which one steers is the strongest kind it has (seeker, then
// short-range, then homing), its turn × copies. Homing: the nearest creature in reach, each frame. Seeker: locks onto one
// and keeps it till it dies, at trSeSpeed × its speed. Short-range: only once one is within trNeReach, a sharp turn.
// Creatures are the scene's (world x, ty; screen x = x - scroll). Returns the creature it steered at, or null
/** @template {{ x: number, ty: number, hp: number }} F
 *  @param {{ x: number, y: number, vx: number, vy: number, age?: number, homN?: number, seekN?: number, nearN?: number, tgt?: F | null, sp1?: number }} s
 *  @param {F[]} foes @param {number} scroll @param {number} dt @returns {F | null} */
export function trajHome(s, foes, scroll, dt) {
  const age = s.age || 0;
  /** @param {number} reach @returns {F | null} */
  const near = reach => { let tg = null, td = reach; for (const f of foes) { const d = Math.hypot(f.x - scroll - s.x, f.ty - s.y); if (f.hp > 0 && d < td) { td = d; tg = f; } } return tg; };
  let tg = null, turn = 0;
  if (s.seekN) {
    if (age < DEV.trSeWait) return null;
    if (!s.tgt || s.tgt.hp <= 0) s.tgt = near(DEV.trSeReach);
    tg = s.tgt; turn = DEV.trSeTurn * s.seekN;
    if (tg && !s.sp1) { s.sp1 = 1; const k = DEV.trSeSpeed; s.vx *= k; s.vy *= k; }
  } else if (s.nearN) { tg = near(DEV.trNeReach); turn = DEV.trNeTurn * s.nearN; }
  else if (s.homN) { if (age < DEV.trHoWait) return null; tg = near(DEV.trHoReach); turn = DEV.trHoTurn * s.homN; }
  if (!tg) return null;
  const sp = Math.hypot(s.vx, s.vy) || 1, want = Math.atan2(tg.ty - s.y, tg.x - scroll - s.x), a = Math.atan2(s.vy, s.vx);
  const b = a + Math.max(-turn * dt, Math.min(turn * dt, angDiff(want, a)));
  s.vx = Math.cos(b) * sp; s.vy = Math.sin(b) * sp;
  return tg;
}
// Auto-Aim: the moment it leaves the barrel, turned straight at the nearest creature within trAimReach (at most trAimMax degrees
// from the way it was fired); once only (s.aimed)
/** @template {{ x: number, ty: number, hp: number }} F
 *  @param {{ x: number, y: number, vx: number, vy: number, aimed?: number }} s @param {F[]} foes @param {number} scroll @returns {F | null} */
export function trajAim(s, foes, scroll) {
  if (s.aimed) return null;
  s.aimed = 1;
  let tg = null, td = DEV.trAimReach;
  for (const f of foes) { const d = Math.hypot(f.x - scroll - s.x, f.ty - s.y); if (f.hp > 0 && d < td) { td = d; tg = f; } }
  if (!tg) return null;
  const sp = Math.hypot(s.vx, s.vy) || 1, a = Math.atan2(s.vy, s.vx), m = DEV.trAimMax * Math.PI / 180;
  const b = a + Math.max(-m, Math.min(m, angDiff(Math.atan2(tg.ty - s.y, tg.x - scroll - s.x), a)));
  s.vx = Math.cos(b) * sp; s.vy = Math.sin(b) * sp;
  return tg;
}
// Gravity and Anti-Gravity in the scene: the shot's own gravity without the mods' (420 down, 340 up each, the old game's), then
// Auto's trGravG / trFloatG per copy; Horizontal Path: none. And the angle it leaves at (the lob knobs): radians to add, toward
// the roof (−) for Gravity, the floor (+) for Anti-Gravity, mirrored for a shot fired left
/** @param {{ grav?: number, gravN?: number, floatN?: number, flat?: number }} sh @param {number} sp the scene's speed scale */
export const trajGrav = (sh, sp) => sh.flat ? 0 : ((sh.grav || 0) - (sh.gravN || 0) * 420 + (sh.floatN || 0) * 340) * sp + (sh.gravN || 0) * DEV.trGravG - (sh.floatN || 0) * DEV.trFloatG;
/** @param {{ gravN?: number, floatN?: number, flat?: number }} sh @param {number} ang */
export function trajLob(sh, ang) {
  if (sh.flat) return 0;
  const d = ((sh.gravN ? -DEV.trGravLob : 0) + (sh.floatN ? DEV.trFloatLob : 0)) * Math.PI / 180;
  return Math.cos(ang) < 0 ? -d : d;
}
