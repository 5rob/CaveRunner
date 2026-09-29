// The terrain: what's solid where (the questions every system asks: rock at a cell or a point,
// the runner's box, a clear line; and which creature is at a point), and changing it: dig,
// paint, and the decoration and gold that go with the rock. Every change is drawn through
// G.tctx / G.dctx, the recorder's wrapped contexts, so the death replay sees it.

import { SFX } from '../../audio/sfx.js';
import { BED, BRICK, CELL, CH, CW, PH, PW } from '../../core/consts.js';
import { ORE_GOLD } from '../../world/veins.js';
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

// clear rock without the bang, for drilling shots
export function dig(W, G, x, y, R) {
  const cx0 = x / CELL, cy0 = y / CELL, rc = R / CELL;
  const minX = Math.max(0, Math.floor(cx0 - rc)), maxX = Math.min(CW - 1, Math.ceil(cx0 + rc));
  const minY = Math.max(0, Math.floor(cy0 - rc)), maxY = Math.min(CH - 1, Math.ceil(cy0 + rc));
  const d = W.img.data;
  let changed = false, nOre = 0;
  for (let cy = minY; cy <= maxY; cy++)
    for (let cx = minX; cx <= maxX; cx++) {
      const i = cy * CW + cx;
      if (!W.mat[i] || W.mat[i] === BED) continue;
      if (Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0) > rc) continue;
      if (W.ore && W.ore[i]) { W.ore[i] = 0; nOre++; }
      W.fire.fuel[i] = 0; W.fire.t[i] = 0;
      W.mat[i] = 0; d[i * 4 + 3] = 0; changed = true;
    }
  if (W.burrow) for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++)
    if (W.burrow[cy * CW + cx] && Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0) <= rc) { W.burrow[cy * CW + cx] = 0; changed = true; }
  if (changed) W.terrainV++;
  if (changed) G.tctx.putImageData(W.img, 0, 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
  unDeco(W, G, cx0, cy0, rc, minX, minY, maxX, maxY);
  if (nOre) dropOre(W, x, y, nOre);
}
// a gold seam cut or blown open: bits of gold tumble out, as much as the rock you took.
// Fractions carry over in oreBank, so nibbling a seam with a drill pays the same as a blast.
export function dropOre(W, x, y, n) {
  W.oreBank += n * ORE_GOLD * (1 + (W.floor - 1) * 0.3) * W.pb.gold;
  let bits = Math.min(12, Math.floor(W.oreBank / 2));
  if (!bits) return;
  const each = Math.floor(W.oreBank / bits);
  W.oreBank -= each * bits;
  for (let k = 0; k < bits; k++)
    W.coins.push({ x: x + (Math.random() - 0.5) * 6, y, amount: each, t: Math.random() * 6.28,
      vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 80 });
  SFX.fx('coinland', x, y);
}
// wipe the decoration layer inside a cleared circle, so baked rubble, beams and pillars
// go with the rock round them
export function unDeco(W, G, cx0, cy0, rc, minX, minY, maxX, maxY) {
  const dd = W.dimg.data;
  let changed = false;
  for (let cy = minY; cy <= maxY; cy++)
    for (let cx = minX; cx <= maxX; cx++) {
      const k = (cy * CW + cx) * 4;
      if (!dd[k + 3] || Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0) > rc) continue;
      dd[k + 3] = 0; changed = true;
      W.fire.fuel[k >> 2] = 0; W.fire.t[k >> 2] = 0;
    }
  if (changed) G.dctx.putImageData(W.dimg, 0, 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
}

// lay solid brick down, the opposite of dig()
export function paint(W, G, x, y, w, hh) {
  const x0 = Math.max(1, Math.round(x / CELL - w / 2)), x1 = Math.min(CW - 2, x0 + w);
  const y0 = Math.max(1, Math.round(y / CELL)), y1 = Math.min(CH - 2, y0 + hh);
  const d = W.img.data;
  for (let cy = y0; cy < y1; cy++)
    for (let cx = x0; cx < x1; cx++) {
      const i = cy * CW + cx;
      if (W.mat[i]) continue;
      W.mat[i] = BRICK;
      const k = i * 4;
      d[k] = 132; d[k + 1] = 99; d[k + 2] = 71; d[k + 3] = 255;
    }
  if (x1 > x0 && y1 > y0) G.tctx.putImageData(W.img, 0, 0, x0, y0, x1 - x0, y1 - y0);
}
