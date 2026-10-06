// @ts-check
// The alien's Game side (Level 2 stage 7b; its brain, alienStep, and its sprite, drawAlien, are in
// creatures/alien.js): its part of the enemy loop (alienMove). Once a frame (the first alien to move)
// it makes the two lookups every alien shares: the bucket grid of aliens (the packs' neighbours) and the
// fire points (burning cells, sampled; explosions; burning bodies) in buckets, so hundreds stay cheap.
// Far aliens (past AL_FAR) think every fourth frame.

import { SFX } from '../../audio/sfx.js';
import { CELL, CW, PH, PW } from '../../core/consts.js';
import { alienGrid, alienNear, alienStep } from '../../creatures/alien.js';
import { kr } from '../../dev/knobs.js';
import { hurt } from '../systems/player.js';
import { solidCell } from '../systems/terrain.js';

const AL_FAR = 700, FIRE_B = 64;
/** @type {{ W: World | null, t: number, grid: AlienGrid | null, fire: Map<number, Pt[]>, nf: number, dark: boolean, near: Enemy[] }} */
const F = { W: null, t: -1, grid: null, fire: new Map(), nf: 0, dark: false, near: [] };

// this frame's lookups (made by the first alien to move)
/** @param {World} W */
function frameData(W) {
  if (F.W === W && F.t === W.time) return;
  F.W = W; F.t = W.time;
  F.grid = alienGrid(W.enemies.filter(e => e.k.act === 'alien'), 24);
  F.fire.clear(); F.nf = 0;
  /** @param {number} x @param {number} y */
  const add = (x, y) => {
    const k = Math.floor(x / FIRE_B) * 4096 + Math.floor(y / FIRE_B), b = F.fire.get(k);
    if (b) b.push({ x, y }); else F.fire.set(k, [{ x, y }]);
    F.nf++;
  };
  const fl = W.fire.list, st = Math.max(1, Math.ceil(fl.length / 400));
  for (let k = 0; k < fl.length; k += st) { const i = fl[k]; add((i % CW + 0.5) * CELL, (((i / CW) | 0) + 0.5) * CELL); }
  for (const f of W.flashes) add(f.x, f.y);
  for (const e of W.enemies) if (e.burn && e.burn > 0) add(e.x, e.ty);
  if (W.p.burn > 0 && !W.p.dead) add(W.p.x + PW / 2, W.p.y + PH / 2);
  // you in the dark: in a zone, no fire near you
  const px = W.p.x + PW / 2, py = W.p.y + PH / 2;
  F.dark = !!zoneAt(W, px, py) && !fireNear(px, py, kr('alFleeR'));
}
/** @param {World} W @param {number} x @param {number} y */
function zoneAt(W, x, y) {
  const m = W.darkMask, cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  return m && cx >= 0 && cy >= 0 && cx < CW ? m[cy * CW + cx] || 0 : 0;
}
/** the nearest fire point within R, or null @param {number} x @param {number} y @param {number} R @returns {Pt | null} */
function fireNear(x, y, R) {
  if (!F.nf || R <= 0) return null;
  let best = null, bd = R * R;
  for (let bx = Math.floor((x - R) / FIRE_B); bx <= Math.floor((x + R) / FIRE_B); bx++)
    for (let by = Math.floor((y - R) / FIRE_B); by <= Math.floor((y + R) / FIRE_B); by++) {
      const b = F.fire.get(bx * 4096 + by);
      if (b) for (const p of b) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p; } }
    }
  return best;
}

/** @type {AlienEnv} */
const ENV = { solidCell: () => 0, zone: () => 0, silk: () => false, near: [], fireNear, home: () => null,
  you: { x: 0, y: 0 }, look: false, hunting: false, youDark: false, rnd: Math.random };

// An alien's frame (ACTS): the brain, its bite; true = the whole frame done (no shared bite: it bites only
// in the dark, alienStep says when)
/** @param {World} W @param {GameCtx} G @param {Enemy} e @param {EnemyCtx} C @returns {boolean} */
export function alienMove(W, G, e, C) {
  const { dt, dist, sees, hunting, pcx, pcy } = C;
  frameData(W);
  e.chill = 1;
  // far away: think every fourth frame (the time saved up)
  const S = e.al;
  if (S && dist > AL_FAR) {
    S.acc = (S.acc || 0) + dt; S.skip = ((S.skip || 0) + 1) % 4;
    if (S.skip) return true;
  }
  const t = S && S.acc ? S.acc : dt;
  if (S) S.acc = 0;
  ENV.solidCell = (cx, cy) => solidCell(W, cx, cy);
  ENV.zone = (x, y) => zoneAt(W, x, y);
  ENV.silk = (x, y) => { const w = W.webbing, cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); return !!w && cx >= 0 && cx < CW && w[cy * CW + cx] > 0; };
  ENV.home = (x, y) => {
    let best = null, bd = Infinity;
    for (const z of W.dark) { const zx = z.chamber.x * CELL, zy = z.chamber.y * CELL, d = (zx - x) ** 2 + (zy - y) ** 2; if (d < bd) { bd = d; best = { x: zx, y: zy }; } }
    return best;
  };
  ENV.near = F.grid ? alienNear(F.grid, e.x, e.y, 24, e, F.near) : [];
  ENV.you.x = pcx; ENV.you.y = pcy; ENV.hunting = hunting; ENV.youDark = F.dark;
  ENV.look = hunting || dist < e.k.aggro * sees * (e.aggroM || 1);
  const r = alienStep(e, ENV, Math.min(t, 0.1));
  e.ty = e.y;
  if (r === 'bite') {
    SFX.creature(e.k, 'bite', e.x, e.y);
    hurt(W, G, Math.round(kr('alBite')));
    e.touch = kr('alBiteCd');
  }
  return true;
}
