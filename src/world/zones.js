// Floor 1's two kinds of zone (built-up and natural): builtAt (which one a point is in)
// and boxReach (where a runner-sized box can get to, used to keep the main route open).

import { CELL, CH, CW } from '../core/consts.js';

// Where can a runner-sized box (6 x 11 terrain pixels) get to from (x, y) (its top-left,
// in the open), walking and flying through open pixels? ok[i] = 2 where its top-left can
// be; top: it got to the top of the map (y <= 40), where the exit is.
export function boxReach(mat, x, y) {
  const PWc = 6, PHc = 11;
  const free = new Uint8Array(CW * CH), ok = new Uint8Array(CW * CH);
  for (let cx = 0; cx < CW; cx++) {
    let run = 0;
    for (let cy = CH - 1; cy >= 0; cy--) { run = mat[cy * CW + cx] ? 0 : run + 1; if (run >= PHc) free[cy * CW + cx] = 1; }
  }
  for (let cy = 0; cy < CH; cy++) {
    let run = 0;
    for (let cx = CW - 1; cx >= 0; cx--) { run = free[cy * CW + cx] ? run + 1 : 0; if (run >= PWc) ok[cy * CW + cx] = 1; }
  }
  const s0 = y * CW + x;
  let top = false;
  if (!ok[s0]) return { ok, top };
  const st = new Int32Array(CW * CH);
  let n = 0;
  ok[s0] = 2; st[n++] = s0;
  while (n) {
    const i = st[--n];
    if (i < 40 * CW) top = true;
    const x0 = i % CW;
    if (x0 > 0 && ok[i - 1] === 1) { ok[i - 1] = 2; st[n++] = i - 1; }
    if (x0 < CW - 1 && ok[i + 1] === 1) { ok[i + 1] = 2; st[n++] = i + 1; }
    if (i >= CW && ok[i - CW] === 1) { ok[i - CW] = 2; st[n++] = i - CW; }
    if (i < CW * (CH - 1) && ok[i + CW] === 1) { ok[i + CW] = 2; st[n++] = i + CW; }
  }
  return { ok, top };
}
// is world point (wx, wy) in a built-up zone? (level.zone; null on floors without zones)
export function builtAt(zone, wx, wy) {
  if (!zone) return false;
  const x = Math.floor(wx / CELL), y = Math.floor(wy / CELL);
  return x >= 0 && y >= 0 && x < CW && y < CH && zone[y * CW + x] === 1;
}
