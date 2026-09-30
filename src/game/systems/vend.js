// @ts-check
// The level vending machines on the shop's back wall. The level above the shop is bought on
// credit from one (LVL_BUY goes on your debt, LO.debt, not your gold) and sold back to the other
// once no biological entities are left in it (LVL_SELL pays the debt off, and a thousand to you).
// It must be repaid by LO.due: five real days (DEADLINE_MS), counted down on the buy machine. Buying teleports the level
// in over the shop, selling teleports it away and puts the next floor's level up for sale.
// Without one the cave is solid dark rock (BED) and the shop's roof is sealed (voidCave).

import { SFX } from '../../audio/sfx.js';
import {
  BED, BRICK, CELL, CH, CW, DEADLINE_MS, LVL_BUY, LVL_SELL, SHOP_FLOOR, SHOP_ROOF, SHOP_TOP, SHOP_Y, VEND_BUY_X, VEND_SELL_X
} from '../../core/consts.js';
import { bioCount } from '../../creatures/common.js';
import { fireNew } from '../../world/fire.js';
import { fogStart } from '../../world/vision.js';
import { paintFog } from './fog.js';
import { enterLevel, miniEdges } from './level-entry.js';
import { jag } from './lightning.js';
import { burst, toast } from './particles.js';
import { youAlight } from './fire.js';
import { hurt } from './player.js';
import { saveRun } from './save-run.js';

// the repossession (seconds from the deadline passing): the hologram says so, the level is
// teleported away, the alarm and the red lights, and ten seconds later the floor's fire jets
export const REPO_WARP = 3, REPO_ALARM = 5.6, REPO_FIRE = REPO_ALARM + 10;
export const REPO_JET = 40;       // world units between the fire jets in the shop floor
export const WARP_SWAP = 0.6;     // seconds from the tap to the flash (the screen goes dark first)
export const WARP_END = 2.4;      // and to the end of the crackle
export const ROOF_Y = (SHOP_TOP - SHOP_ROOF) * CELL;   // the top of the shop's roof
export const VEND_W = 60, VEND_H = 84;                 // a machine's cabinet (world units)
export const VEND_TOP = SHOP_FLOOR * CELL - VEND_H;    // its top

// the machine you're standing at, if its screen is on (null otherwise)
/** @param {World} W @param {number} pcx @param {number} pcy @returns {'buy' | 'sell' | null} */
export function vendNear(W, pcx, pcy) {
  if (W.warp || W.repo || pcy < SHOP_Y || pcy > SHOP_FLOOR * CELL) return null;
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
    LO.debt = (LO.debt || 0) + LVL_BUY;       // your wallet is yours: the level goes on your debt
    LO.due = Date.now() + DEADLINE_MS;        // five real days to repay it, on the device's clock
    W.hasLvl = true;
    W.warp = { dir: 'in', t: 0, done: false, bolts: [] };
    toast(W, 'Level ' + W.floor + ' bought on credit');
    SFX.ui('buy');
  } else if (kind === 'sell' && W.hasLvl) {
    if (!canSell(W)) { toast(W, 'No biological entities accepted'); SFX.ui('poor'); return; }
    LO.gold += LVL_SELL - (LO.debt || 0);     // the debt paid off out of the sale, the rest is yours
    LO.debt = 0; LO.due = 0;
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
    if (w.dir === 'repo') {                  // taken back: you land in the shop, the cave goes
      W.p.x = W.start.x; W.p.y = W.start.y; W.p.vx = W.p.vy = 0; W.camReady = false;
      W.hasLvl = false; voidCave(W, G);
    } else if (w.dir === 'in') enterLevel(W, G, { seed: W.levelSeed, owned: W.levelOwned, alive: null, sold: [], rooms: [], pickups: null }, 'shop');
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

// The repayment deadline, a part of step: once the device's clock passes LO.due with the level
// still yours, it is repossessed (W.repo): REPOSSESSED on the hologram, the level teleported away
// (you with it, into the shop), the alarm and the red lights, then after a ten second countdown
// fire jets come up out of the shop floor and the room burns until you're dead. A new run clears it.
/** @param {World} W @param {GameCtx} G @param {StepFrame} F */
export function stepRepo(W, G, F) {
  const LO = F.LO;
  if (!W.repo) {
    if ((W.hasLvl || LO.debt > 0) && !W.warp && !W.p.dead && LO.due && Date.now() >= LO.due) {
      // (no level: it was taken while the game was closed; straight on to the alarm)
      W.repo = { t: W.hasLvl ? 0 : REPO_ALARM - 0.5, hurtT: 0, sndT: 0 };
      toast(W, 'Debt defaulted: level repossessed');
      SFX.fx('ventWarn');
    }
    return;
  }
  const R = W.repo, t0 = R.t;
  R.t += F.dt;
  if (t0 < REPO_WARP && R.t >= REPO_WARP) W.warp = { dir: 'repo', t: 0, done: false, bolts: [] };
  if (R.t < REPO_ALARM) return;
  if ((R.sndT -= F.dt) <= 0) {                 // the klaxon, then the roar of the jets over it
    R.sndT = 0.9;
    SFX.fx('alarm');
    if (R.t >= REPO_FIRE) SFX.fx('ventFire', W.p.x + (Math.random() - 0.5) * 200, SHOP_FLOOR * CELL);
  }
  if (R.t < REPO_FIRE) return;
  const fy = SHOP_FLOOR * CELL, x0 = Math.floor(W.camX / REPO_JET) * REPO_JET, grow = Math.min(1, (R.t - REPO_FIRE) / 2);
  for (let x = x0; x < W.camX + W.viewW + REPO_JET; x += REPO_JET) if (Math.random() < 0.6) {
    W.sparks.push({ x: x + (Math.random() - 0.5) * 6, y: fy - 2, vx: (Math.random() - 0.5) * 40,
      vy: -(120 + Math.random() * 260) * grow, life: 0.6, max: 0.6, c: Math.random() < 0.5 ? '#ffd35a' : '#ff7a1a', size: 3 });
  }
  if (W.p.dead || R.t < REPO_FIRE + 1) return;
  // the room is alight: you burn, harder the longer it goes
  if ((R.hurtT -= F.dt) <= 0) { R.hurtT = 0.3; youAlight(W); hurt(W, G, Math.round(3 + 2.5 * (R.t - REPO_FIRE))); }
}
