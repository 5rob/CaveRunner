// @ts-check
// Pathfinding for creatures that walk (rats): navField (a cost field out from a goal)
// and navWay (the next waypoint down it).

import { CELL } from '../core/consts.js';

// ---- rat pathfinding ----
// A rat with somewhere to be (you, a coin, its nest) follows a distance field: a Dijkstra
// out from the goal over a grid of NAV-pixel cells, costed for a rat — cheap along rock
// (floors, walls), dear to go up through open air (it can only jump so high), free to drop.
// navWay walks a few cells down the field from the rat to give it a waypoint just ahead,
// which it runs (or jumps) to with ratStep. solid(px, py) is the rat's view of the
// terrain, in pixels. R is the field's half-size in cells.
export const NAV = 4;                               // terrain pixels per nav cell
/** @typedef {{ x0: number, y0: number, w: number, d: Float32Array, surf: Uint8Array }} NavField a cost field: d per cell (Infinity: no way), surf: cells with footing */
/**
 * @param {(px: number, py: number) => unknown} solid @param {number} tx @param {number} ty the goal (world)
 * @param {number} R half-size in cells @param {((px: number, py: number) => unknown) | null} [onWeb] web lines count as footing
 * @returns {NavField}
 */
export function navField(solid, tx, ty, R, onWeb) {
  const gi = Math.floor(tx / CELL / NAV), gj = Math.floor(ty / CELL / NAV);
  const x0 = gi - R, y0 = gj - R, w = 2 * R + 1, n = w * w;
  const open = new Uint8Array(n), surf = new Uint8Array(n);
  const sol = (i, j) => solid((x0 + i) * NAV + 2, (y0 + j) * NAV + 2);
  // open: a rat fits — the middle 2x2 pixels of the cell are all clear, not just one
  // (a hairline crack the centre happened to land in is not a way through)
  const fits = (i, j) => {
    const px = (x0 + i) * NAV, py = (y0 + j) * NAV;
    for (let b = 1; b <= 2; b++) for (let a = 1; a <= 2; a++) if (solid(px + a, py + b)) return false;
    return true;
  };
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) open[j * w + i] = fits(i, j) ? 1 : 0;
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i;
    if (open[k]) surf[k] = sol(i, j + 1) || sol(i - 1, j) || sol(i + 1, j) || sol(i - 1, j + 1) || sol(i + 1, j + 1) ||
      (onWeb && onWeb(((x0 + i) * NAV + 2) * CELL, ((y0 + j) * NAV + 2) * CELL)) ? 1 : 0;
  }
  const d = new Float32Array(n).fill(Infinity), done = new Uint8Array(n);
  // a binary heap of cell indices keyed on d (a cell can be in it more than once)
  const cap = n * 8, hp = new Int32Array(cap);
  let hn = 0;
  const push = k => {
    let c = hn++; hp[c] = k;
    while (c) { const p = (c - 1) >> 1; if (d[hp[p]] <= d[k]) break; hp[c] = hp[p]; hp[p] = k; c = p; }
  };
  const pop = () => {
    const top = hp[0], last = hp[--hn];
    let c = 0;
    if (hn) {
      hp[0] = last;
      while (true) {
        const l = 2 * c + 1, r = l + 1;
        let m = c;
        if (l < hn && d[hp[l]] < d[hp[m]]) m = l;
        if (r < hn && d[hp[r]] < d[hp[m]]) m = r;
        if (m === c) break;
        hp[c] = hp[m]; hp[m] = last; c = m;
      }
    }
    return top;
  };
  // start at the goal's cell, or the nearest open one to it
  let s = -1;
  for (let r = 0; r <= 2 && s < 0; r++) for (let dj = -r; dj <= r && s < 0; dj++) for (let di = -r; di <= r; di++) {
    const q = (R + dj) * w + R + di;
    if (open[q]) { s = q; break; }
  }
  if (s >= 0) { d[s] = 0; push(s); }
  while (hn && hn < cap - 8) {
    const k = pop();
    if (done[k]) continue;
    done[k] = 1;
    const i = k % w, j = (k / w) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= w || b >= w) continue;
      const q = b * w + a;
      if (!open[q] || done[q]) continue;
      if (di && dj && !open[j * w + a] && !open[b * w + i]) continue;    // no squeezing between two corners
      // the rat goes q -> k: dear up through open air, free to drop, cheap along rock
      const up = -dj, step = di && dj ? 1.414 : 1;
      const c = step * (surf[k] ? 1 : up < 0 ? 8 : up > 0 ? 1 : 3);
      if (d[k] + c < d[q]) { d[q] = d[k] + c; push(q); }
    }
  }
  return { x0, y0, w, d, surf };
}
// a point `steps` cells down the field from (x, y) (world units), or null if the rat is off
// the field or can't get to the goal from here. dist: the field's value where it stands.
/** @param {NavField} F @param {number} x @param {number} y @param {number} steps @returns {{ x: number, y: number, dist: number, air: boolean } | null} */
export function navWay(F, x, y, steps) {
  let i = Math.floor(x / CELL / NAV) - F.x0, j = Math.floor(y / CELL / NAV) - F.y0;
  const w = F.w, d = F.d;
  if (i < 1 || j < 1 || i >= w - 1 || j >= w - 1) return null;
  if (!isFinite(d[j * w + i])) {                     // sat on a cell edge: the best one round it
    let b = -1;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const q = (j + dj) * w + i + di;
      if (isFinite(d[q]) && (b < 0 || d[q] < d[b])) b = q;
    }
    if (b < 0) return null;
    i = b % w; j = (b / w) | 0;
  }
  const dist = d[j * w + i];
  let air = false;                                  // the way climbs through open air: a jump
  for (let s = 0; s < steps; s++) {
    let b = j * w + i;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const a = i + di, c = j + dj;
      if (a < 0 || c < 0 || a >= w || c >= w) continue;
      if (d[c * w + a] < d[b]) b = c * w + a;
    }
    if (b === j * w + i) break;
    if ((b / w | 0) <= j && !F.surf[b]) air = true;      // up or across with nothing under it
    i = b % w; j = (b / w) | 0;
    // going up through open air: a jump, so aim for where it lands again (up to 12 cells on)
    if (air && s === steps - 1 && !F.surf[b] && steps < 12) steps++;
  }
  return { x: (F.x0 + i + 0.5) * NAV * CELL, y: (F.y0 + j + 0.5) * NAV * CELL, dist, air };
}
