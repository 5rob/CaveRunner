// @ts-check
// Colour gradients and opacity ramps over a particle's life (v0.0.137, the elites' flames), kept as
// short strings so a Dev knob can hold one (and the Dev report can print it):
//   a gradient: "0:#ffffff 0.3:#ffd040 1:#3a0a14"  (stops: where along 0-1, the colour there)
//   a ramp:     "0:0 0.1:1 0.6:0.8 1:0"            (control points: life 0-1, opacity 0-1)
// The ramp is a clamped cubic B-spline over its control points: it starts and ends on the first
// and last, and is pulled smoothly towards the ones between. Both are read through a 64-step
// lookup table, made once per string (gradLut / rampLut).

import { hexArr } from '../core/util.js';

export const LUT_N = 64;
export const GRAD_RE = /^(\s*[\d.]+:#[0-9a-f]{6}\s*)+$/i;
export const RAMP_RE = /^(\s*[\d.]+:[\d.]+\s*)+$/;


const c01 = (/** @type {number} */ v) => Math.max(0, Math.min(1, v));
/** @param {string} s @returns {GradStop[]} sorted by t */
export function parseGrad(s) {
  const out = [];
  for (const part of String(s || '').trim().split(/\s+/)) {
    const [t, c] = part.split(':');
    if (c && /^#[0-9a-f]{6}$/i.test(c) && isFinite(+t)) out.push({ t: c01(+t), c: c.toLowerCase() });
  }
  if (!out.length) out.push({ t: 0, c: '#ffffff' });
  return out.sort((a, b) => a.t - b.t);
}
/** @param {GradStop[]} g */
export const gradStr = g => g.slice().sort((a, b) => a.t - b.t).map(s => +s.t.toFixed(3) + ':' + s.c).join(' ');
/** @param {RampPt[]} r */
export const rampStr = r => r.slice().sort((a, b) => a.x - b.x).map(p => +p.x.toFixed(3) + ':' + +p.y.toFixed(3)).join(' ');
/** @param {string} s @returns {RampPt[]} sorted by x */
export function parseRamp(s) {
  const out = [];
  for (const part of String(s || '').trim().split(/\s+/)) {
    const [x, y] = part.split(':');
    if (y != null && isFinite(+x) && isFinite(+y)) out.push({ x: c01(+x), y: c01(+y) });
  }
  if (!out.length) out.push({ x: 0, y: 1 }, { x: 1, y: 1 });
  if (out.length === 1) out.push({ x: 1, y: out[0].y });
  return out.sort((a, b) => a.x - b.x);
}

// the gradient's colour at t (0-1), as [r, g, b]
/** @param {GradStop[]} g @param {number} t @returns {number[]} */
export function gradAt(g, t) {
  if (t <= g[0].t) return hexArr(g[0].c);
  for (let i = 1; i < g.length; i++) if (t <= g[i].t) {
    const a = hexArr(g[i - 1].c), b = hexArr(g[i].c), u = (t - g[i - 1].t) / ((g[i].t - g[i - 1].t) || 1);
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
  }
  return hexArr(g[g.length - 1].c);
}

// The clamped cubic B-spline through a ramp's control points, sampled as a line: [x, y, x, y, …].
// The end points are tripled so the curve starts and ends exactly on them.
/** @param {RampPt[]} P @param {number} [per] samples per span @returns {number[]} */
export function bspline(P, per = 16) {
  const Q = [P[0], P[0], ...P, P[P.length - 1], P[P.length - 1]];
  const out = [];
  for (let i = 0; i + 3 < Q.length; i++) {
    const [a, b, c, d] = [Q[i], Q[i + 1], Q[i + 2], Q[i + 3]];
    for (let k = 0; k <= per; k++) {
      if (k === per && i + 4 < Q.length) continue;
      const u = k / per, u2 = u * u, u3 = u2 * u;
      const w0 = (1 - u) ** 3 / 6, w1 = (3 * u3 - 6 * u2 + 4) / 6, w2 = (-3 * u3 + 3 * u2 + 3 * u + 1) / 6, w3 = u3 / 6;
      out.push(a.x * w0 + b.x * w1 + c.x * w2 + d.x * w3, a.y * w0 + b.y * w1 + c.y * w2 + d.y * w3);
    }
  }
  return out;
}
// the ramp's opacity at x (0-1): along the spline (its x only ever goes forward)
/** @param {RampPt[]} P @param {number} x */
export function rampAt(P, x) {
  const s = bspline(P);
  if (x <= s[0]) return c01(s[1]);
  for (let i = 2; i < s.length; i += 2) if (x <= s[i]) {
    const u = (x - s[i - 2]) / ((s[i] - s[i - 2]) || 1);
    return c01(s[i - 1] + (s[i + 1] - s[i - 1]) * u);
  }
  return c01(s[s.length - 1]);
}

/** @type {Map<string, string[]>} */
const GL = new Map();
/** @type {Map<string, number[]>} */
const RL = new Map();
// a gradient as LUT_N + 1 'rgb(…)' strings along it, made once per string
/** @param {string} s @returns {string[]} */
export function gradLut(s) {
  let L = GL.get(s);
  if (!L) {
    const g = parseGrad(s);
    L = [];
    for (let i = 0; i <= LUT_N; i++) { const c = gradAt(g, i / LUT_N); L.push('rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'); }
    if (GL.size > 20) GL.clear();
    GL.set(s, L);
  }
  return L;
}
// a ramp as LUT_N + 1 opacities along it, made once per string
/** @param {string} s @returns {number[]} */
export function rampLut(s) {
  let L = RL.get(s);
  if (!L) {
    const P = parseRamp(s);
    L = [];
    for (let i = 0; i <= LUT_N; i++) L.push(rampAt(P, i / LUT_N));
    if (RL.size > 20) RL.clear();
    RL.set(s, L);
  }
  return L;
}
/** @param {any[]} L @param {number} t 0-1 */
export const lutAt = (L, t) => L[Math.max(0, Math.min(LUT_N, Math.round(t * LUT_N)))];
