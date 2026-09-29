// The terrain: what's solid where (the questions every system asks: rock at a cell or a point,
// the runner's box, a clear line) and which creature is at a point.

import { CELL, CH, CW, PH, PW } from '../../core/consts.js';
import { losClear } from '../../world/vision.js';

// ---- terrain queries ----
export const solidCell = (W, cx, cy) =>
  cx < 0 || cy < 0 || cx >= CW || cy >= CH || W.mat[cy * CW + cx] !== 0;
export const solidAt = (W, x, y) => solidCell(W, Math.floor(x / CELL), Math.floor(y / CELL));
export const boxHit = (W, x, y) => {
  const x0 = Math.floor(x / CELL), x1 = Math.floor((x + PW - 0.001) / CELL);
  const y0 = Math.floor(y / CELL), y1 = Math.floor((y + PH - 0.001) / CELL);
  for (let cy = y0; cy <= y1; cy++) {
    if (cy < 0 || cy >= CH) return true;
    for (let cx = x0; cx <= x1; cx++) {
      if (cx < 0 || cx >= CW || W.mat[cy * CW + cx]) return true;
    }
  }
  return false;
};
export const lineOfSight = (W, x0, y0, x1, y1) => losClear(x0, y0, x1, y1, (cx, cy) => solidCell(W, cx, cy));
export const enemyAt = (W, x, y, pad) => {
  for (let j = 0; j < W.enemies.length; j++) {
    const e = W.enemies[j];
    if (Math.hypot(x - e.x, y - e.ty) < e.r + pad) return j;
  }
  return -1;
};
