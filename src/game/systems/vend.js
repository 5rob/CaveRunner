// @ts-check
// The level vending machines on the shop's back wall. The level above the shop is bought on
// credit from one (LVL_BUY: your gold goes deep negative) and sold back to the other once no
// biological entities are left in it (LVL_SELL, a thousand more). Buying teleports the level
// in over the shop, selling teleports it away and puts the next floor's level up for sale.
// Without one the cave is solid dark rock (BED) and the shop's roof is sealed (voidCave).

import { SFX } from '../../audio/sfx.js';
import {
  BED, BRICK, CELL, CH, CW, LVL_BUY, LVL_SELL, SHOP_FLOOR, SHOP_ROOF, SHOP_TOP, SHOP_Y, VEND_BUY_X, VEND_SELL_X
} from '../../core/consts.js';
import { bioCount } from '../../creatures/common.js';
import { fireNew } from '../../world/fire.js';
import { fogStart } from '../../world/vision.js';
import { paintFog } from './fog.js';
import { enterLevel, miniEdges } from './level-entry.js';
import { jag } from './lightning.js';
import { burst, toast } from './particles.js';
import { saveRun } from './save-run.js';

export const WARP_SWAP = 0.6;     // seconds from the tap to the flash (the screen goes dark first)
export const WARP_END = 2.4;      // and to the end of the crackle
export const ROOF_Y = (SHOP_TOP - SHOP_ROOF) * CELL;   // the top of the shop's roof
export const VEND_W = 60, VEND_H = 84;                 // a machine's cabinet (world units)
export const VEND_TOP = SHOP_FLOOR * CELL - VEND_H;    // its top

// the machine you're standing at, if its screen is on (null otherwise)
/** @param {World} W @param {number} pcx @param {number} pcy @returns {'buy' | 'sell' | null} */
export function vendNear(W, pcx, pcy) {
  if (W.warp || pcy < SHOP_Y || pcy > SHOP_FLOOR * CELL) return null;
  if (Math.abs(pcx - VEND_BUY_X) < 30 && !W.hasLvl) return 'buy';
  if (Math.abs(pcx - VEND_SELL_X) < 30 && W.hasLvl) return 'sell';
  return null;
}

// can the level be sold? Not while anything biological is left in it
/** @param {World} W */
export const canSell = W => W.hasLvl && bioCount(W.enemies, false) === 0;

// the prompt line for a machine
/** @param {World} W @param {'buy' | 'sell'} kind */
export function vendLabel(W, kind) {
  if (kind === 'buy') return { text: 'Tap R to buy', price: 0, can: true };
  return canSell(W) ? { text: 'Tap R to sell', price: 0, can: true }
    : { text: 'Biological entities detected', price: 0, can: false };
}

// a tap at a machine
/** @param {World} W @param {GameCtx} G @param {'buy' | 'sell'} kind @param {Loadout} LO */
export function vendUse(W, G, kind, LO) {
  if (W.warp) return;
  if (kind === 'buy' && !W.hasLvl) {
    LO.gold -= LVL_BUY;
    W.hasLvl = true;
    W.warp = { dir: 'in', t: 0, done: false, bolts: [] };
    toast(W, 'Level ' + W.floor + ' bought on credit');
    SFX.ui('buy');
  } else if (kind === 'sell' && W.hasLvl) {
    if (!canSell(W)) { toast(W, 'No biological entities accepted'); SFX.ui('poor'); return; }
    LO.gold += LVL_SELL;
    W.hasLvl = false;
    W.warp = { dir: 'out', t: 0, done: false, bolts: [] };
    toast(W, 'Level ' + W.floor + ' sold');
    SFX.ui('buy');
  }
}

// The teleport, a part of step: the machine's screen goes dark, then at WARP_SWAP the flash, and
// the level arrives (revealed from its seed) or goes (and the next floor's is made, hidden). Bolts
// crackle along the roof and up into the cave for a second after
/** @param {World} W @param {GameCtx} G @param {StepFrame} F */
export function stepWarp(W, G, F) {
  const w = W.warp;
  if (!w) return;
  const t0 = w.t;
  w.t += F.dt;
  if (!w.done && w.t >= WARP_SWAP) {
    w.done = true;
    if (w.dir === 'in') enterLevel(W, G, { seed: W.levelSeed, owned: W.levelOwned, alive: null, sold: [], rooms: [], pickups: null }, 'shop');
    else { W.floor++; enterLevel(W, G, undefined, 'you'); voidCave(W, G); }
    SFX.fx('levelWarp');
    const x0 = W.camX, x1 = W.camX + W.viewW;
    for (let i = 0; i < 26; i++) burst(W, x0 + Math.random() * (x1 - x0), ROOF_Y - Math.random() * 6, 3, Math.random() < 0.5 ? '#eafff0' : '#6dffa0');
    saveRun(W, G);
    G.input.current.notify();
  }
  // new bolts: a few before the flash, a storm of them just after, thinning out
  const since = w.t - WARP_SWAP;
  const rate = since < -0.3 ? 0 : since < 0 ? 8 : since < 1.2 ? 30 * (1 - since / 1.2) + 4 : 0;
  const n = Math.floor(w.t * rate) - Math.floor(t0 * rate);
  for (let i = 0; i < n; i++) {
    const x = W.camX + Math.random() * W.viewW, up = since < 0 ? 10 + Math.random() * 30 : 40 + Math.random() * 260;
    const pts = [{ x, y: ROOF_Y }];
    let px = x, py = ROOF_Y;
    const steps = 4 + Math.floor(up / 30);
    for (let k = 1; k <= steps; k++) {
      px += (Math.random() - 0.5) * 26; py -= up / steps;
      pts.push({ x: px, y: py });
    }
    w.bolts.push({ pts: jag(pts, 5), t: 0, max: 0.12 + Math.random() * 0.18 });
  }
  for (let i = w.bolts.length - 1; i >= 0; i--) if ((w.bolts[i].t += F.dt) >= w.bolts[i].max) w.bolts.splice(i, 1);
  if (w.t >= WARP_END && !w.bolts.length) W.warp = null;
}

// No level: everything above the shop's roof becomes solid dark bedrock, the hole in the roof is
// bricked up, and what lived or lay up there goes
/** @param {World} W @param {GameCtx} G */
export function voidCave(W, G) {
  const top = SHOP_TOP - SHOP_ROOF, d = W.img.data, dd = W.dimg.data;
  for (let cy = top; cy < SHOP_TOP; cy++) for (let cx = 0; cx < CW; cx++) {
    const i = cy * CW + cx;
    if (W.mat[i]) continue;
    // the roof's hole: the brick next to it, carried across
    let j = -1;
    for (let k = 1; k < 60 && j < 0; k++) {
      if (cx - k >= 0 && W.mat[i - k] === BRICK) j = i - k;
      else if (cx + k < CW && W.mat[i + k] === BRICK) j = i + k;
    }
    W.mat[i] = BED;
    if (j >= 0) for (let c = 0; c < 4; c++) d[i * 4 + c] = d[j * 4 + c];
  }
  for (let i = 0; i < top * CW; i++) {
    W.mat[i] = BED;
    d[i * 4] = 6; d[i * 4 + 1] = 6; d[i * 4 + 2] = 9; d[i * 4 + 3] = 255;
    dd[i * 4 + 3] = 0;
    if (W.ore) W.ore[i] = 0;
  }
  W.enemies.length = 0; W.total = 0;
  W.pickups = W.pickups.filter(keep);
  W.rooms = [];
  W.props = W.props.filter(keep);
  W.matterProps = W.props.filter(pr => pr.k === 'matter');
  W.sconces = W.sconces.filter(keep);
  for (let i = W.coins.length - 1; i >= 0; i--) if (!keep(W.coins[i])) W.coins.splice(i, 1);   // a run list: in place
  W.webs.length = W.silk.length = W.strings.length = 0;
  W.dparts.length = W.amb.length = W.clouds.length = W.rings.length = W.devils.length = 0;
  W.fire = fireNew(new Uint8Array(CW * CH)); W.firePropN = -1;
  W.burrow = null; W.deepFog = null; W.navYou.F = null;
  W.terrainV++;
  W.levelT = 99;                            // no floor name card for a cave that isn't there
  G.tctx.putImageData(W.img, 0, 0);
  G.dctx.putImageData(W.dimg, 0, 0);
  miniEdges(W);
  W.seen = fogStart(); paintFog(W, G);
}

// in the shop (or its roof), so it stays when the cave goes
/** @param {{ y: number }} q */
const keep = q => q.y >= SHOP_Y - 12;
