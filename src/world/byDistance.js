// @ts-check
// Decorate by distance: a reusable tool for scattering things across a floor by how far they are
// from some "source" (floor 2's dark zones first: explosions, denser and bigger near them).
// Pure and generic, plain data in, plain data out, on its own random stream:
//   distField     straight-line distance (through rock) from the nearest source cell, out to a reach
//   curveFn       a Curve (a Dev curve knob, dev/knobs.js curveKnobs) as a function of x in 0..1
//   scatterByDistance   seeded points in open air, kept by a density curve of distance, sized by a scale curve
//   destructionOpts     floor 2's Dev knobs (Dev → Level 2: destruction) as scatterByDistance's options
// Not wired into makeLevel yet (the dark zones don't exist yet).

import { bezierAt } from '../core/util.js';
import { DEV, kcurve } from '../dev/knobs.js';

const BIG = 1e20;   // "no source yet" in the squared distances (the exact transform's usual stand-in)

// One line of the exact squared distance transform (Felzenszwalb & Huttenlocher): f in, d out,
// n long; v and z are scratch. Parabolas from every cell, the lower envelope kept.
/** @param {Float64Array} f @param {number} n @param {Float64Array} d @param {Int32Array} v @param {Float64Array} z */
function edt1(f, n, d, v, z) {
  let k = 0;
  v[0] = 0; z[0] = -BIG; z[1] = BIG;
  for (let q = 1; q < n; q++) {
    let r = v[k], s = ((f[q] + q * q) - (f[r] + r * r)) / (2 * (q - r));
    while (s <= z[k]) { k--; r = v[k]; s = ((f[q] + q * q) - (f[r] + r * r)) / (2 * (q - r)); }
    k++; v[k] = q; z[k] = s; z[k + 1] = BIG;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k];
    d[q] = (q - r) * (q - r) + f[r];
  }
}

// Each cell's straight-line distance (in cells, through rock: as the crow flies) from the nearest
// source cell (src[i] nonzero; the source itself is 0), or Infinity past maxDist. Exact (two
// passes of the squared transform: columns, then rows). w*h long, row by row like `mat`.
/** @param {number} w @param {number} h @param {ArrayLike<number>} src @param {number} maxDist @returns {Float32Array} */
export function distField(w, h, src, maxDist) {
  const N = w * h, sq = new Float64Array(N), out = new Float32Array(N);
  const L = Math.max(w, h), f = new Float64Array(L), d = new Float64Array(L), v = new Int32Array(L), z = new Float64Array(L + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = src[y * w + x] ? 0 : BIG;
    edt1(f, h, d, v, z);
    for (let y = 0; y < h; y++) sq[y * w + x] = d[y];
  }
  const m2 = maxDist * maxDist;
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) f[x] = sq[o + x];
    edt1(f, w, d, v, z);
    for (let x = 0; x < w; x++) out[o + x] = d[x] <= m2 ? Math.sqrt(d[x]) : Infinity;
  }
  return out;
}

// A Curve as y(x), x in 0..1 (clamped)
/** @param {Curve} c @returns {(u: number) => number} */
export const curveFn = c => u => bezierAt(u, c.y0, c.x1, c.y1, c.x2, c.y2, c.y3);

/**
 * scatterByDistance's options. Everything in grid cells.
 * @typedef {object} ScatterOpts
 * @property {number} w grid width
 * @property {number} h grid height
 * @property {Float32Array} dist distField's result for this grid
 * @property {number} maxDist the reach: the curves' x = dist / maxDist; nothing past it
 * @property {ArrayLike<number>} [solid] terrain (nonzero = rock): points only in open air, `clear` from it
 * @property {number} n how many points (it stops at n, or when the tries run out)
 * @property {number} [seed] its own random stream (or pass `rnd`)
 * @property {() => number} [rnd] a 0..1 generator to use instead of `seed`
 * @property {number} [clear] open air needed all round a point (cells)
 * @property {number} [jitter] after a point is kept, moved up to ± this (if it lands in open air in reach)
 * @property {number} [sizeMin] size rolled between this and sizeMax, then times scale(x)
 * @property {number} [sizeMax] see sizeMin
 * @property {(u: number) => number} [density] chance a point at x is kept (0..1; default 1)
 * @property {(u: number) => number} [scale] size × at x (default 1)
 * @property {number} [tries] candidates tried per point wanted (default 100)
 */
// Seeded points scattered over the open cells within reach, each kept with chance density(x),
// x = its distance / maxDist: so a curve of 0 far out puts nothing there. Never in rock or within
// `clear` of it (the grid's edge counts as rock). Each gets a size (sizeMin..sizeMax × scale(x)) and
// a spare `roll` (0..1: e.g. roll < fire share = it burns). Same options + seed = the same points.
/** @param {ScatterOpts} o @returns {DistPoint[]} */
export function scatterByDistance(o) {
  const { w, h, dist, maxDist, solid, n } = o;
  let rs = ((o.seed || 1) * 48271 + 7) % 2147483647 || 1;
  const rnd = o.rnd || (() => (rs = (rs * 16807) % 2147483647) / 2147483647);
  const clear = Math.max(0, o.clear || 0), jitter = Math.max(0, o.jitter || 0);
  const sMin = o.sizeMin ?? 1, sMax = o.sizeMax ?? sMin;
  const density = o.density || (() => 1), scale = o.scale || (() => 1);
  /** @type {DistPoint[]} */
  const out = [];
  if (!(n > 0) || !(maxDist > 0)) return out;
  // the open cells within reach: every candidate is one of these
  let m = 0;
  const cand = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) if (dist[i] <= maxDist && !(solid && solid[i])) cand[m++] = i;
  if (!m) return out;
  const c2 = clear * clear, cr = Math.ceil(clear);
  /** open air at (x, y) and `clear` all round @param {number} x @param {number} y */
  const open = (x, y) => {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) return false;
    if (!solid) return true;
    for (let j = -cr; j <= cr; j++) {
      const yy = cy + j;
      for (let i = -cr; i <= cr; i++) {
        if (i * i + j * j > c2) continue;
        const xx = cx + i;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h || solid[yy * w + xx]) return false;
      }
    }
    return true;
  };
  const tries = n * (o.tries || 100);
  for (let t = 0; t < tries && out.length < n; t++) {
    const c = cand[Math.floor(rnd() * m)];
    let x = c % w + rnd(), y = Math.floor(c / w) + rnd(), d = dist[c];
    if (!(rnd() < density(d / maxDist))) continue;
    if (jitter > 0) {
      const jx = x + (rnd() * 2 - 1) * jitter, jy = y + (rnd() * 2 - 1) * jitter;
      const jc = Math.floor(jy) * w + Math.floor(jx);
      if (jx >= 0 && jy >= 0 && jx < w && jy < h && dist[jc] <= maxDist && open(jx, jy)) { x = jx; y = jy; d = dist[jc]; }
    }
    if (!open(x, y)) continue;
    const size = (sMin + rnd() * (sMax - sMin)) * Math.max(0, scale(d / maxDist));
    out.push({ x, y, dist: d, size, roll: rnd() });
  }
  return out;
}

// Floor 2's destruction (Dev → Level 2: destruction) as scatterByDistance's options, in terrain
// pixels; the caller adds w, h, dist, solid and seed. `fire` is the share that burn (roll < fire).
export function destructionOpts() {
  return { maxDist: DEV.l2bMaxDist, n: DEV.l2bCount, fire: DEV.l2bFire / 100, jitter: DEV.l2bJitter, clear: DEV.l2bClear,
    sizeMin: DEV.l2bSizeLo, sizeMax: DEV.l2bSizeHi, density: curveFn(kcurve('l2bDen')), scale: curveFn(kcurve('l2bScale')) };
}
