// @ts-check
// Particles and small feedback: sparks thrown out of a point (burst), drops of goo and a spit's
// splat, and the messages at the bottom of the view (toast). Three parts of step(): the messages
// counting down (stepToasts), smoke, sparks and flashes moving on (stepParticles), and the motes
// (stepMotes).

import { SFX } from '../../audio/sfx.js';
import { CELL, COL, PH, SHOP_FLOOR } from '../../core/consts.js';
import { kr } from '../../dev/knobs.js';
import { nearExit } from '../world.js';
import { jetNozzle } from './player.js';
import { solidAt } from './terrain.js';

/** @param {World} W @param {string} text */
export const toast = (W, text) => { W.toasts.push({ text, t: 2.2 }); if (W.toasts.length > 3) W.toasts.shift(); };

// one drop of goo: falls under its own gravity g, lands and sits a moment on rock
/** @param {World} W @param {number} x @param {number} y @param {number} vx @param {number} vy @param {number} g @param {string} c @param {number} [size] @param {string} [c2] */
export function goo(W, x, y, vx, vy, g, c, size, c2) {
  if (W.sparks.length > 800) return;
  const life = 0.5 + Math.random() * 0.5;
  W.sparks.push({ x, y, vx, vy, life, max: life, c: Math.random() < 0.35 ? (c2 || '#c8ff8a') : c,
    size: size || 1.1 + Math.random() * 0.8, heavy: 1, g });
}
// a poison spit bursting: a little ring of goo thrown out, a bit back the way it came
/** @param {World} W @param {EnemyShot} b @param {number} x @param {number} y */
export function splat(W, b, x, y) {
  const sp = Math.hypot(b.vx, b.vy) || 1;
  for (let i = 0; i < b.splat; i++) {
    const a = Math.random() * 6.28, v = b.splatV * (0.4 + Math.random() * 0.6);
    goo(W, x, y, Math.cos(a) * v - b.vx / sp * v * 0.5, Math.sin(a) * v - b.vy / sp * v * 0.5 - v * 0.3,
      b.dripG, b.dripCol || b.col, 1.3 + Math.random(), b.dripCol2);
  }
  SFX.fx('splash', x, y);
}
/** @param {World} W @param {number} x @param {number} y @param {number} n @param {string} color */
export function burst(W, x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, sp = 60 + Math.random() * 160;
    W.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.45, max: 0.45, c: color, size: 3 });
  }
}

// the messages count down and go (a part of step)
/** @param {World} W @param {StepFrame} F */
export function stepToasts(W, F) {
  const { dt } = F;
  for (let i = W.toasts.length - 1; i >= 0; i--) if ((W.toasts[i].t -= dt) <= 0) W.toasts.splice(i, 1);
}

// ---- smoke, sparks and flashes (a part of step) ----
// The jetpack's smoke puffing out while its flame is lit, then every smoke puff, spark (and
// goo drop) and blast flash moved on and aged.
/** @param {World} W @param {StepFrame} F */
export function stepParticles(W, F) {
  const { dt } = F;
  if (W.p.flame > 0) {
    let fx = -W.p.jx, fy = -W.p.jy + 0.8;
    const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
    W.smokeAcc += dt * (25 + 35 * W.p.flame);
    while (W.smokeAcc >= 1) {
      W.smokeAcc--;
      const nz = jetNozzle(W);                 // out of the backpack's nozzle, after the flame
      W.smoke.push({ x: nz.x + fx * 6 + (Math.random() - 0.5) * 3, y: nz.y + fy * 6 + 1,
        vx: fx * 50 + (Math.random() - 0.5) * 20, vy: fy * 50 + (Math.random() - 0.5) * 20,
        r: 1.5 + Math.random(), life: 0.9, max: 0.9, jet: true });
    }
  }
  for (let i = W.smoke.length - 1; i >= 0; i--) {
    const m = W.smoke[i];
    m.x += m.vx * dt; m.y += m.vy * dt;
    m.vx *= 1 - 2.5 * dt; m.vy = m.vy * (1 - 2.5 * dt) - 12 * dt;
    m.r += 5 * dt; m.life -= dt;
    if (m.life <= 0) W.smoke.splice(i, 1);
  }
  for (let i = W.sparks.length - 1; i >= 0; i--) {
    const q = W.sparks[i];
    q.vy += (q.g != null ? q.g : q.heavy ? 600 : 300) * dt;
    const nx = q.x + q.vx * dt, ny = q.y + q.vy * dt;
    if (q.heavy && solidAt(W, nx, ny)) { q.vx *= 0.3; q.vy = 0; }
    else { q.x = nx; q.y = ny; }
    q.life -= dt;
    if (q.life <= 0) W.sparks.splice(i, 1);
  }
  for (let i = W.flashes.length - 1; i >= 0; i--) {
    W.flashes[i].t += dt;
    if (W.flashes[i].t > 0.25) W.flashes.splice(i, 1);
  }
}

// A crystal's sparkle (v0.0.137, in place of its round glow): specks shed off it that float up
// and away on the breeze, and, while it flies, a trail along the way it came (`moved` units
// since last frame, from ox, oy). Drawn as light with the other motes.
export const CRYS_MOTES = 7, CRYS_TRAIL = 2.5;      // specks a second at rest; a trail speck per this many units
/** @param {World} W @param {number} x @param {number} y @param {boolean} green @param {number} dt @param {number} moved @param {number} [ox] @param {number} [oy] */
export function crystalMotes(W, x, y, green, dt, moved, ox, oy) {
  const cols = green ? ['#30ff70', '#8affb0', '#e0ffe8'] : ['#ff2a3a', '#ff7a88', '#ffe0e4'];
  /** @param {number} px @param {number} py @param {number} life @param {number} sp */
  const add = (px, py, life, sp) => W.motes.push({ kind: 'breeze', x: px, y: py,
    vx: (Math.random() - 0.5) * sp, vy: -4 - Math.random() * 8 * sp / 10, life, max: life, age: 0,
    ph: Math.random() * 6.28, s: 0.8 + Math.random() * 0.9, c: cols[Math.random() < 0.55 ? 0 : Math.random() < 0.7 ? 1 : 2] });
  if (Math.random() < CRYS_MOTES * dt) add(x + (Math.random() - 0.5) * 7, y + (Math.random() - 0.5) * 7, 1.1 + Math.random() * 0.9, 10);
  if (moved > 0 && ox != null && oy != null)
    for (let k = 0, n = Math.min(8, Math.ceil(moved / CRYS_TRAIL)); k < n; k++) {
      const t = Math.random();
      add(ox + (x - ox) * t + (Math.random() - 0.5) * 3, oy + (y - oy) * t + (Math.random() - 0.5) * 3, 0.45 + Math.random() * 0.45, 6);
    }
}

// ---- portal motes (a part of step) ----
// Motes drawn into the exit and breathed out of the way in, and every mote's drift (Black
// Hole's trail too), capped at 400.
/** @param {World} W @param {StepFrame} F */
export function stepMotes(W, F) {
  const { dt } = F;
  W.portalAcc += dt;
  while (W.portalAcc > 0.05) {
    W.portalAcc -= 0.05;
    const P = nearExit(W, W.p.x), ex = P.x + P.w / 2, ey = P.y + P.h / 2;
    if (W.hasLvl && Math.abs(ey - W.p.y) < 500) {   // the nearest exit: scattered round it, drawn in
      const a = Math.random() * 6.28, rr = 30 + Math.random() * 38;
      const life = 1.4 + Math.random() * 0.8;
      W.motes.push({ kind: 'in', x: ex + Math.cos(a) * rr, y: ey + Math.sin(a) * rr * 0.9,
        tx: ex, ty: ey, vx: 0, vy: 0, life, max: life, age: 0, ph: Math.random() * 6.28,
        s: 1 + Math.random() * 1.4, c: Math.random() < 0.4 ? '#d8f0ff' : '#5ab8ff' });
    }
    if (Math.abs(W.arrival.y - W.p.y) < 500) { // the way in: rising off the pad, drifting away
      const fy = SHOP_FLOOR * CELL - 3;
      W.motes.push({ kind: 'out', x: W.arrival.x + (Math.random() - 0.5) * 22,
        y: fy, ox: W.arrival.x, oy: fy,
        vx: (Math.random() - 0.5) * 8, vy: -12 - Math.random() * 14, life: 4, max: 4, age: 0,
        ph: Math.random() * 6.28, fade: 34 + Math.random() * 18,
        s: 1 + Math.random() * 1.3, c: Math.random() < 0.4 ? '#d8f0ff' : '#5ab8ff' });
    }
  }
  for (let i = W.motes.length - 1; i >= 0; i--) {
    const q = W.motes[i];
    q.age += dt;
    if (q.kind === 'in') {
      if (q.f) { q.tx = q.f.x; q.ty = q.f.y; }    // a White Hole's: it may be moving
      // accelerate toward the centre, with a sideways wobble so it spirals in unevenly
      const dx = q.tx - q.x, dy = q.ty - q.y, d = Math.hypot(dx, dy) || 1;
      const pullF = 70 + 260 * q.age;
      q.vx += dx / d * pullF * dt; q.vy += dy / d * pullF * dt;
      q.vx *= 1 - 2.2 * dt; q.vy *= 1 - 2.2 * dt;
      const w = Math.sin(q.age * 7 + q.ph) * 26;
      q.x += (q.vx - dy / d * w) * dt; q.y += (q.vy + dx / d * w) * dt;
      if (d < 3) q.life = 0;
    } else if (q.kind === 'out') {
      const w = Math.sin(q.age * 2.3 + q.ph);
      q.vx += w * 18 * dt; q.vy += (Math.cos(q.age * 1.7 + q.ph) * 12 - 3) * dt;
      q.vx *= 1 - 0.4 * dt; q.vy *= 1 - 0.4 * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (Math.hypot(q.x - q.ox, q.y - q.oy) > q.fade) q.life = 0;
    } else if (q.kind === 'breeze') {
      // a crystal's speck: the cave's slow breeze carries it sideways as it rises, wavering
      const wind = 9 + Math.sin(W.time * 0.35) * 6;
      q.vx += ((wind - q.vx) * 0.8 + Math.sin(q.age * 3 + q.ph) * 14) * dt;
      q.vy = q.vy * (1 - 0.6 * dt) - 3 * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
    } else {
      q.vx *= 1 - 1.8 * dt; q.vy = q.vy * (1 - 1.8 * dt) - 6 * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
    }
    if ((q.life -= dt) <= 0) W.motes.splice(i, 1);
  }
  if (W.motes.length > 400) W.motes.splice(0, W.motes.length - 400);
}

// ---- the elites' flames (a part of step, v0.0.137) ----
// Every elite gives off fire from its body, the torch's flame as a spawner (Dev → Elites: flames,
// every number rolled per particle): each speck starts somewhere in its body with the elite's own
// speed, sheds that speed to air resistance (so a moving elite leaves a trail), rises, and swings
// side to side. Its colour and opacity over its life come from the gradient and ramp (drawn by
// drawEliteFire). Capped at ELITE_FX_MAX.
export const ELITE_FX_MAX = 700;
/** @param {World} W @param {StepFrame} F */
export function stepEliteFire(W, F) {
  const { dt } = F;
  if (dt <= 0) return;
  for (const e of W.enemies) {
    if (!e.k.elite) continue;
    const vx = e.fxPx != null ? (e.x - e.fxPx) / dt : 0, vy = e.fxPy != null ? (e.ty - e.fxPy) / dt : 0;
    e.fxPx = e.x; e.fxPy = e.ty;
    e.fxAcc = (e.fxAcc || 0) + kr('elFxRate') * dt;
    for (; e.fxAcc >= 1; e.fxAcc--) {
      const a = Math.random() * Math.PI * 2, rr = e.r * kr('elFxBody') * Math.sqrt(Math.random());
      const life = kr('elFxLife');
      W.eliteFx.push({ x: e.x + Math.cos(a) * rr, y: e.ty + Math.sin(a) * rr,
        vx: Math.max(-400, Math.min(400, vx)), vy: Math.max(-400, Math.min(400, vy)), life, max: life,
        rise: kr('elFxRise'), wave: kr('elFxWave'), hz: kr('elFxWaveHz'), drag: kr('elFxDrag'),
        s: kr('elFxSize'), ph: Math.random() * 6.283, age: 0 });
    }
  }
  for (let i = W.eliteFx.length - 1; i >= 0; i--) {
    const q = W.eliteFx[i];
    q.age += dt;
    const k = Math.exp(-q.drag * dt);
    q.vx *= k; q.vy *= k;
    q.x += (q.vx + Math.sin(q.age * q.hz * 6.283 + q.ph) * q.wave) * dt;
    q.y += (q.vy - q.rise) * dt;
    if ((q.life -= dt) <= 0) W.eliteFx.splice(i, 1);
  }
  if (W.eliteFx.length > ELITE_FX_MAX) W.eliteFx.splice(0, W.eliteFx.length - ELITE_FX_MAX);
}
