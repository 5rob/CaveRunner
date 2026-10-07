// @ts-check
// The level vending machines on the shop's back wall. A level is bought on credit from one: standing
// at it, a right-stick flick up or down picks the floor (W.pick, input.current.lvlStep; one floor past
// what's for sale shows greyed), its screens show that floor, and a tap buys it (buyLevel): lvlBuy(floor) goes on your debt (LO.debt, not your gold). It is sold back
// to the other once no biological entities are left in it (lvlSell(floor): the debt paid off, the
// reward to you, both climbing exponentially with the floor: data/levels.js). Floor N is for sale only
// once floor N - 1 has been sold this run (LO.soldTop). It must be repaid by LO.due: an hour
// (dueMs: floor 1 a Dev knob, DEADLINE_MS after), counted down on the buy machine. Buying teleports
// the level in over the shop, selling teleports it away. Without one the cave is solid dark rock
// (BED) and the shop's roof is sealed (voidCave), and the next floor's level is made off the main
// thread meanwhile (game/levelgen.js), so the flash doesn't freeze; it's drawn in from the bottom up.

import { SFX } from '../../audio/sfx.js';
import {
  BED, BRICK, CELL, CH, CW, SHOP_FLOOR, SHOP_ROOF, SHOP_TOP, SHOP_Y, VEND_BUY_X, VEND_SELL_X
} from '../../core/consts.js';
import { bioCount } from '../../creatures/common.js';
import { LVL_MENU_MAX, canBuyFloor, lvlBuy, lvlReward, pickTop, stepPick } from '../../data/levels.js';
import { dueMs } from '../../dev/knobs.js';
import { fireNew } from '../../world/fire.js';
import { fogStart } from '../../world/vision.js';
import { levelPending, preLevel, takeLevel } from '../levelgen.js';
import { paintFog } from './fog.js';
import { enterLevel, mapPicture } from './level-entry.js';
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
export const WARP_WAIT = 6;       // the longest the dark waits for a level still being made (then it's made here)
export const REVEAL_T = 0.7;      // seconds to draw a bought level's rock in, bottom to top
export const ROOF_Y = (SHOP_TOP - SHOP_ROOF) * CELL;   // the top of the shop's roof
export const PICK_IDLE = 1.5;     // seconds with no stick input before the buy machine's hint fades up
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

// the floor the machines' screens show: the level you're in, else the one picked at the buy machine
/** @param {World} W */
export const pickedFloor = W => W.hasLvl ? W.floor : (W.pick || W.floor);

// a flick at the buy machine: the pick one floor up (+1) or down (-1), up to one past what's for sale
/** @param {World} W @param {Loadout} LO @param {number} d */
export function pickStep(W, LO, d) {
  const top = LO.soldTop || 0, was = Math.min(pickedFloor(W), pickTop(top));
  const f = stepPick(was, top, d);
  W.pick = f;
  SFX.fx(f === was ? 'prompt' : 'switch');
}

// the prompt line for a machine (the buy machine's is two options: flick to select, tap to buy)
/** @param {World} W @param {'buy' | 'sell'} kind @param {Loadout} LO */
export function vendLabel(W, kind, LO) {
  if (kind === 'buy') return { text: 'Tap R to Buy', price: 0, can: canBuyFloor(LO.soldTop || 0, pickedFloor(W)), pick: true };
  return canSell(W) ? { text: 'Tap R to sell', price: 0, can: true }
    : { text: 'Biological entities detected', price: 0, can: false };
}

// a tap at a machine: the buy machine buys the floor picked, the sell machine sells
/** @param {World} W @param {GameCtx} G @param {'buy' | 'sell'} kind @param {Loadout} LO */
export function vendUse(W, G, kind, LO) {
  if (W.warp) return;
  if (kind === 'buy' && !W.hasLvl) {
    const f = pickedFloor(W);
    if (!canBuyFloor(LO.soldTop || 0, f)) { toast(W, 'Sell level ' + (f - 1) + ' first'); SFX.ui('poor'); return; }
    buyLevel(W, G, f, LO);
  } else if (kind === 'sell' && W.hasLvl) {
    if (!canSell(W)) { toast(W, 'No biological entities accepted'); SFX.ui('poor'); return; }
    // the sale pays the debt off and the rest is yours: the reward (always the reward, so a debt run up
    // at another price, before v130's or under other Dev knobs, can't eat your gold)
    LO.gold += lvlReward(W.floor);
    LO.debt = 0; LO.due = 0;
    LO.soldTop = Math.max(LO.soldTop || 0, W.floor);  // the floor above is for sale now
    W.hasLvl = false;
    W.warp = { dir: 'out', t: 0, done: false, bolts: [] };
    toast(W, 'Level ' + W.floor + ' sold');
    SFX.ui('buy');
  }
}

// A tap at the buy machine: that floor's level, bought on credit
/** @param {World} W @param {GameCtx} G @param {number} floor @param {Loadout} LO */
export function buyLevel(W, G, floor, LO) {
  if (W.warp || W.hasLvl || W.repo || !canBuyFloor(LO.soldTop || 0, floor)) return false;
  if (floor !== W.floor) { W.floor = floor; W.levelSeed = 1 + Math.floor(Math.random() * 2147483000); }
  W.pick = 0;
  preLevel(W.floor, W.levelSeed);             // already made (or on its way) for the likely floor
  LO.debt = (LO.debt || 0) + lvlBuy(floor);   // your wallet is yours: the level goes on your debt
  LO.due = Date.now() + dueMs(floor);         // an hour to repay it (floor 1: Dev's knob), on the device's clock
  W.hasLvl = true;
  W.warp = { dir: 'in', t: 0, done: false, bolts: [] };
  toast(W, 'Level ' + floor + ' bought on credit');
  SFX.ui('buy');
  G.input.current.notify();
  return true;
}

// The teleport, a part of step: the machine's screen goes dark, then at WARP_SWAP the flash, and
// the level arrives (made ahead by the worker, or here if it isn't) or goes. Bolts crackle along
// the roof and up into the cave for a second after
/** @param {World} W @param {GameCtx} G @param {StepFrame} F */
export function stepWarp(W, G, F) {
  stepReveal(W, G, F);
  const w = W.warp;
  if (!w) return;
  // arriving: the dark holds while the worker is still making it (up to WARP_WAIT)
  if (!w.done && w.dir === 'in' && w.t + F.dt >= WARP_SWAP && levelPending(W.floor) && (w.wait = (w.wait || 0) + F.dt) < WARP_WAIT) {
    for (let i = w.bolts.length - 1; i >= 0; i--) if ((w.bolts[i].t += F.dt) >= w.bolts[i].max) w.bolts.splice(i, 1);
    return;
  }
  const t0 = w.t;
  w.t += F.dt;
  if (!w.done && w.t >= WARP_SWAP) {
    w.done = true;
    if (w.dir === 'repo') {                  // taken back: you land in the shop, the cave goes
      W.p.x = W.start.x; W.p.y = W.start.y; W.p.vx = W.p.vy = 0; W.camReady = false;
      W.hasLvl = false; voidCave(W, G);
    } else if (w.dir === 'in') {
      const got = takeLevel(W.floor);
      if (got) W.levelSeed = got.seed;
      enterLevel(W, G, { seed: W.levelSeed, owned: [], alive: null, sold: [], rooms: [], pickups: null }, 'shop', got ? got.level : undefined);
    } else {                                 // sold: the cave goes, and the floor above is up next
      W.floor = Math.min(LVL_MENU_MAX, (G.input.current.loadout.soldTop || 0) + 1);
      W.pick = 0;
      W.levelSeed = 1 + Math.floor(Math.random() * 2147483000);
      const heal = W.stock.find(it => it.kind === 'heal');
      if (heal) { heal.bought = 0; heal.price = 0; }   // a new floor's shop: the first heal is free again
      voidCave(W, G);
    }
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

// A bought level's rock and decoration go onto their canvases a band at a time, bottom to top
// (W.reveal: the row drawn down to so far), so the flash doesn't upload the whole cave in one
// frame. Bands go round the recorder (a whole-width ImageData of the rows, not a dirty rect): the
// death replay already starts from the whole level (recReset)
/** @param {World} W @param {GameCtx} G @param {StepFrame} F */
export function stepReveal(W, G, F) {
  if (!W.reveal) return;
  const y1 = W.reveal, y0 = Math.max(0, Math.floor(y1 - CH * Math.max(F.dt, 1 / 120) / REVEAL_T));
  putRows(W, G, y0, y1);
  W.reveal = y0;
}

// rows y0..y1 of the terrain and the decoration onto their canvases
/** @param {World} W @param {GameCtx} G @param {number} y0 @param {number} y1 */
export function putRows(W, G, y0, y1) {
  if (y1 <= y0) return;
  G.tctx.putImageData(new ImageData(W.img.data.subarray(y0 * CW * 4, y1 * CW * 4), CW, y1 - y0), 0, y0);
  if (W.dimg) G.dctx.putImageData(new ImageData(W.dimg.data.subarray(y0 * CW * 4, y1 * CW * 4), CW, y1 - y0), 0, y0);
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
  W.reveal = 0;
  SFX.setAmbience(null);                    // no cave, no drips or creatures in the dark
  G.tctx.putImageData(W.img, 0, 0);
  G.dctx.putImageData(W.dimg, 0, 0);
  mapPicture(W, G);
  W.pins = W.pins.filter(q => q.y >= SHOP_Y);    // the shop's pins stay
  W.seen = fogStart(); paintFog(W, G);
  preLevel(W.floor, W.levelSeed);           // the floor up for sale, made off the main thread meanwhile
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
