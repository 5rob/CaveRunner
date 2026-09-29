// Particles and small feedback: sparks thrown out of a point (burst), drops of goo and a spit's
// splat, and the messages at the bottom of the view (toast). Three parts of step(): the messages
// counting down (stepToasts), smoke, sparks and flashes moving on (stepParticles), and the motes
// (stepMotes).

import { SFX } from '../../audio/sfx.js';
import { COL, PH } from '../../core/consts.js';
import { solidAt } from './terrain.js';

export const toast = (W, text) => { W.toasts.push({ text, t: 2.2 }); if (W.toasts.length > 3) W.toasts.shift(); };

// one drop of goo: falls under its own gravity g, lands and sits a moment on rock
export function goo(W, x, y, vx, vy, g, c, size, c2) {
  if (W.sparks.length > 800) return;
  const life = 0.5 + Math.random() * 0.5;
  W.sparks.push({ x, y, vx, vy, life, max: life, c: Math.random() < 0.35 ? (c2 || '#c8ff8a') : c,
    size: size || 1.1 + Math.random() * 0.8, heavy: 1, g });
}
// a poison spit bursting: a little ring of goo thrown out, a bit back the way it came
export function splat(W, b, x, y) {
  const sp = Math.hypot(b.vx, b.vy) || 1;
  for (let i = 0; i < b.splat; i++) {
    const a = Math.random() * 6.28, v = b.splatV * (0.4 + Math.random() * 0.6);
    goo(W, x, y, Math.cos(a) * v - b.vx / sp * v * 0.5, Math.sin(a) * v - b.vy / sp * v * 0.5 - v * 0.3,
      b.dripG, b.dripCol || b.col, 1.3 + Math.random(), b.dripCol2);
  }
  SFX.fx('splash', x, y);
}
export function burst(W, x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, sp = 60 + Math.random() * 160;
    W.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.45, max: 0.45, c: color, size: 3 });
  }
}

// the messages count down and go (a part of step)
export function stepToasts(W, F) {
  const { dt } = F;
  for (let i = W.toasts.length - 1; i >= 0; i--) if ((W.toasts[i].t -= dt) <= 0) W.toasts.splice(i, 1);
}

// ---- smoke, sparks and flashes (a part of step) ----
// The jetpack's smoke puffing out while its flame is lit, then every smoke puff, spark (and
// goo drop) and blast flash moved on and aged.
export function stepParticles(W, F) {
  const { dt, pcx } = F;
  if (W.p.flame > 0) {
    let fx = -W.p.jx, fy = -W.p.jy + 0.8;
    const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
    W.smokeAcc += dt * (25 + 35 * W.p.flame);
    while (W.smokeAcc >= 1) {
      W.smokeAcc--;
      W.smoke.push({ x: pcx + (Math.random() - 0.5) * 5, y: W.p.y + PH + 3,
        vx: fx * 50 + (Math.random() - 0.5) * 20, vy: fy * 50 + (Math.random() - 0.5) * 20,
        r: 1.5 + Math.random(), life: 0.9, max: 0.9 });
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

// ---- portal motes (a part of step) ----
// Motes drawn into the exit and breathed out of the way in, and every mote's drift (Black
// Hole's trail too), capped at 400.
export function stepMotes(W, F) {
  const { dt } = F;
  W.portalAcc += dt;
  while (W.portalAcc > 0.05) {
    W.portalAcc -= 0.05;
    const ex = W.portal.x + W.portal.w / 2, ey = W.portal.y + W.portal.h / 2;
    if (Math.abs(ey - W.p.y) < 500) {        // the exit: scattered round it, drawn in
      const a = Math.random() * 6.28, rr = 30 + Math.random() * 38;
      const life = 1.4 + Math.random() * 0.8;
      W.motes.push({ kind: 'in', x: ex + Math.cos(a) * rr, y: ey + Math.sin(a) * rr * 0.9,
        tx: ex, ty: ey, vx: 0, vy: 0, life, max: life, age: 0, ph: Math.random() * 6.28,
        s: 1 + Math.random() * 1.4, c: Math.random() < 0.4 ? '#c8ffe4' : COL.portal });
    }
    if (Math.abs(W.arrival.y - W.p.y) < 500) { // the way in: breathed out, drifting away
      const a = Math.random() * 6.28, sp = 10 + Math.random() * 16;
      W.motes.push({ kind: 'out', x: W.arrival.x + (Math.random() - 0.5) * 12,
        y: W.arrival.y + (Math.random() - 0.5) * 18, ox: W.arrival.x, oy: W.arrival.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, life: 4, max: 4, age: 0,
        ph: Math.random() * 6.28, fade: 34 + Math.random() * 18,
        s: 1 + Math.random() * 1.3, c: Math.random() < 0.4 ? '#e6d4ff' : COL.enemy });
    }
  }
  for (let i = W.motes.length - 1; i >= 0; i--) {
    const q = W.motes[i];
    q.age += dt;
    if (q.kind === 'in') {
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
    } else {
      q.vx *= 1 - 1.8 * dt; q.vy = q.vy * (1 - 1.8 * dt) - 6 * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
    }
    if ((q.life -= dt) <= 0) W.motes.splice(i, 1);
  }
  if (W.motes.length > 400) W.motes.splice(0, W.motes.length - 400);
}
