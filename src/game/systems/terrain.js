// @ts-check
// The terrain: what's solid where (the questions every system asks: rock at a cell or a point,
// the runner's box, a clear line; and which creature is at a point), and changing it: dig,
// paint, and the decoration and gold that go with the rock. Every change is drawn through
// G.tctx / G.dctx, the recorder's wrapped contexts, so the death replay sees it.

import { SFX } from '../../audio/sfx.js';
import { BED, BRICK, CELL, CH, CW, PH, PW } from '../../core/consts.js';
import { clamp } from '../../core/util.js';
import { silkErase } from '../../world/dark.js';
import { spillGold } from '../../world/nuggets.js';
import { ragPush } from '../../world/ragdoll.js';
import { ORE_GOLD } from '../../world/veins.js';
import { losClear } from '../../world/vision.js';
import { damageEnemy } from './enemies.js';
import { fireBlast } from './fire.js';
import { hurt } from './player.js';

// ---- terrain queries ----
/** @param {World} W @param {number} cx @param {number} cy */
export const solidCell = (W, cx, cy) =>
  cx < 0 || cy < 0 || cx >= CW || cy >= CH || W.mat[cy * CW + cx] !== 0;
/** @param {World} W @param {number} x @param {number} y */
export const solidAt = (W, x, y) => solidCell(W, Math.floor(x / CELL), Math.floor(y / CELL));
/** @param {World} W @param {number} x @param {number} y */
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
/** @param {World} W @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 */
export const lineOfSight = (W, x0, y0, x1, y1) => losClear(x0, y0, x1, y1, (cx, cy) => solidCell(W, cx, cy));
/** @param {World} W @param {number} x @param {number} y @param {number} pad */
export const enemyAt = (W, x, y, pad) => {
  for (let j = 0; j < W.enemies.length; j++) {
    const e = W.enemies[j];
    if (Math.hypot(x - e.x, y - e.ty) < e.r + pad) return j;
  }
  return -1;
};

// clear rock without the bang, for drilling shots
/** @param {World} W @param {GameCtx} G @param {number} x @param {number} y @param {number} R */
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
/** @param {World} W @param {number} x @param {number} y @param {number} n */
export function dropOre(W, x, y, n) {
  W.oreBank += n * ORE_GOLD * (1 + (W.floor - 1) * 0.3) * W.pb.gold;
  const amt = Math.floor(W.oreBank);
  if (amt < 2) return;
  W.oreBank -= amt;
  spillGold(W.coins, x, y, amt, { vx: 60, vy: 100 });     // as nuggets, big ones when there's plenty
  SFX.fx('coinland', x, y);
}
// wipe the decoration layer inside a cleared circle, so baked rubble, beams and pillars
// go with the rock round them
/** @param {World} W @param {GameCtx} G @param {number} cx0 @param {number} cy0 @param {number} rc @param {number} minX @param {number} minY @param {number} maxX @param {number} maxY */
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
/** @param {World} W @param {GameCtx} G @param {number} x @param {number} y @param {number} w @param {number} hh */
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

// `splash` set = a small pop (Pollen): enemies take that instead, and it never hurts you.
// Any other blast can set things alight (fireBoom); `hot` (fire spells, minecarts) nearly always does.
/** @param {World} W @param {GameCtx} G @param {number} x @param {number} y @param {number} R @param {number} [splash] @param {number} [hot] */
export function explode(W, G, x, y, R, splash, hot) {
  SFX.boom(x, y, R);
  const cx0 = x / CELL, cy0 = y / CELL, rc = R / CELL, ring = rc + 2.5;
  const minX = Math.max(0, Math.floor(cx0 - ring)), maxX = Math.min(CW - 1, Math.ceil(cx0 + ring));
  const minY = Math.max(0, Math.floor(cy0 - ring)), maxY = Math.min(CH - 1, Math.ceil(cy0 + ring));
  const d = W.img.data;
  let debris = 0, nOre = 0;
  for (let cy = minY; cy <= maxY; cy++) {
    for (let cx = minX; cx <= maxX; cx++) {
      const i = cy * CW + cx, m = W.mat[i];
      if (!m) continue;
      const dist = Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0);
      const k = i * 4;
      if (dist <= rc && m !== BED) {
        if (debris < 40 && Math.random() < 0.08) {
          debris++;
          const f = 0.5 + Math.random();
          W.sparks.push({ x: cx * CELL, y: cy * CELL,
            vx: (cx - cx0) / rc * 220 * f, vy: ((cy - cy0) / rc * 220 - 140) * f,
            life: 0.8 + Math.random() * 0.4, max: 1.2, c: `rgb(${d[k]},${d[k + 1]},${d[k + 2]})`, size: 2, heavy: true });
        }
        if (W.ore && W.ore[i]) { W.ore[i] = 0; nOre++; }
        W.fire.fuel[i] = 0; W.fire.t[i] = 0;
        W.mat[i] = 0;
        d[k + 3] = 0;
      } else if (dist <= ring) {
        d[k] *= 0.72; d[k + 1] *= 0.72; d[k + 2] *= 0.72;   // scorch the crater edge
      }
    }
  }
  G.tctx.putImageData(W.img, 0, 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
  unDeco(W, G, cx0, cy0, rc, minX, minY, maxX, maxY);
  // a blast tears the dark zones' silk (world/dark.js; render/dark.js repaints the hole)
  const torn = silkErase(W.webbing, cx0, cy0, rc + 1.5);
  if (torn) W.webDirty.push(torn);
  if (nOre) dropOre(W, x, y, nOre);
  if (W.burrow) for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++)
    if (Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0) <= rc) W.burrow[cy * CW + cx] = 0;
  W.terrainV++;
  // a blast knocks the props about: carts and pods go off, pillars crack, icicles let go
  for (const pr of W.props) {
    if (pr.gone || Math.abs(pr.x - x) > R + 40 || Math.abs(pr.y - y) > R + 40) continue;
    const bx = clamp(x, pr.x + pr.l, pr.x + pr.r), by = clamp(y, pr.y + pr.t0, pr.y + pr.b);
    if (Math.hypot(bx - x, by - y) < R + 6) pr.hurt = (pr.hurt || 0) + 2;
  }

  W.flashes.push({ x, y, r: R, t: 0 });
  for (let i = 0; i < (splash != null ? 2 : 10); i++) {
    W.smoke.push({ x: x + (Math.random() - 0.5) * R, y: y + (Math.random() - 0.5) * R,
      vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40 - 20,
      r: 4 + Math.random() * 5, life: 1.2, max: 1.2 });
  }
  for (let j = W.enemies.length - 1; j >= 0; j--) {
    const e = W.enemies[j], dist = Math.hypot(e.x - x, e.ty - y);
    if (dist < R + e.r) damageEnemy(W, j, splash != null ? splash : dist < R * 0.5 ? 3 : 2);
  }
  if (splash != null) return;
  fireBlast(W, G, x, y, R, hot);
  const pcx = W.p.x + PW / 2, pcy = W.p.y + PH / 2;
  const dist = Math.hypot(pcx - x, pcy - y), reach = R + 10;
  if (dist < reach && !W.p.dead) {
    const f = 1 - dist / reach;
    hurt(W, G, Math.round(25 * f));
    const nx = (pcx - x) / (dist || 1), ny = (pcy - y) / (dist || 1);
    W.p.vx += nx * 500 * f;
    W.p.vy += ny * 500 * f - 150 * f;
    W.p.kick = 0.25;
  } else if (W.p.dead && W.p.rag) ragPush(W.p.rag, x, y, reach);       // a blast throws the corpse
}
