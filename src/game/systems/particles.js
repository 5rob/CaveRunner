// Particles and small feedback: sparks thrown out of a point (burst), drops of goo and a spit's
// splat, and the messages at the bottom of the view (toast; stepToasts, a part of step(), counts
// them down).

import { SFX } from '../../audio/sfx.js';

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
