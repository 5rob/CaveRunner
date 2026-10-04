// @ts-check
// A new run's dark shop (v0.0.136): you arrive in a dark corridor lit only by the teleporter's
// blue and your torch. The ceiling's tube lights come on a section at a time, each with a
// fluorescent tube's stuttering start: the teleporter and heal after LIGHT_WAIT, then the next
// section along every time you reach the middle of the last one lit (one vending machine a
// section, SHOP_SLOT apart). Once the perk machine's section has been on a while, or you leave
// the shop, the rest of the hall comes on in a run. Pure: game/systems/shoplights.js steps it,
// render/light.js darkens by it, render/shoplights.js draws the tubes.
// Since v0.0.141 the hall is longer (the heal and machines stand at the far right) and the guide
// hologram (world/guide.js) holds the lights: from its section on nothing comes on until it has gone
// (lightsStep's hold), and its own section snaps on when it jumps out (lightNear).

import { SHOP_MACHINE_X, SHOP_SLOT, WW } from '../core/consts.js';

export const LIGHT_WAIT = 2;          // seconds from arriving to the first tubes
export const LIGHT_REST = 3;          // the perk section on this long: the rest of the hall comes on
export const LIGHT_RUN = 0.22;        // and one more section every this many seconds
export const TUBE_MAX = 1.6;          // no tube takes longer than this to settle
export const FIRST_X = 76;            // the first section's middle: the teleporter and its sign
export const FIRST_TRIGGER = 100;     // walk this far (your middle, world x) into it: the next one comes on
export const PAD_LIT = 56;           // the teleporter's blue lifts the dark this far round it (world units)

/** the middle of each light section, left to right (world x), SHOP_SLOT apart: each machine
 * (VEND_BUY_X on, SHOP_SLOT apart too) is the middle of one */
export const LIGHT_X = [FIRST_X];
for (let x = FIRST_X + SHOP_SLOT; x < WW; x += SHOP_SLOT) LIGHT_X.push(x);
const PERK_I = LIGHT_X.indexOf(SHOP_MACHINE_X[2]);   // the perk machine's section: the last with something in it

/** @param {number} time @returns {ShopLights} */
export const lightsNew = time => ({ start: time, on: LIGHT_X.map(() => -1), zap: time });

const hs = (/** @type {number} */ n) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

// How bright a tube is (0-1), `age` seconds after it was switched on: a fluorescent start, some
// blinks at random lengths, the ends glowing dimly between, more on than off as it warms up, then
// steady. The same `seed` always stutters the same way
/** @param {number} age @param {number} seed */
export function tubeLevel(age, seed) {
  if (age < 0) return 0;
  const dur = 0.55 + 0.9 * hs(seed * 7.1 + 1);
  if (age >= dur) return 1;
  let t = 0;
  for (let n = 0; n < 60; n++) {
    const len = 0.03 + 0.13 * hs(seed * 13.7 + n * 3.1);
    if (age < t + len) {
      const warm = t / dur;
      // always a blink first (off, on, off), then chance
      const lit = n < 3 ? n === 1 : hs(seed * 5.3 + n * 9.7) < 0.2 + 0.65 * warm;
      return lit ? 0.45 + 0.55 * hs(seed + n * 1.9) : 0.06;
    }
    t += len;
  }
  return 1;
}

/** how far section i's tubes are on (0-1) at `time` @param {ShopLights} L @param {number} i @param {number} time */
export const sectionLevel = (L, i, time) => (L.on[i] < 0 ? 0 : tubeLevel(time - L.on[i], i + 1));

/** half the width a section lights fully @param {number} i */
const halfW = i => (i === 0 ? 68 : SHOP_SLOT / 2 - 12);

// How dark the shop is at world x (1 = unlit, 0 = in full light): the best of the sections'
// light pools, each fully lit across its middle and fading out over 30 units past its edge
/** @param {ShopLights} L @param {number} x @param {number} time */
export function shopDark(L, x, time) {
  let best = 0;
  for (let i = 0; i < LIGHT_X.length; i++) {
    if (L.on[i] < 0) continue;
    const d = Math.abs(x - LIGHT_X[i]) - halfW(i);
    const pool = d <= 0 ? 1 : d >= 30 ? 0 : 1 - d / 30;
    best = Math.max(best, pool * sectionLevel(L, i, time));
  }
  return 1 - best;
}

// One step: switch on whatever is due. pcx: your middle (world x); inShop: you're in the shop room.
// hold: sections from this one on wait (the guide still to come, or talking: world/guide.js).
// Returns the sections switched on this step, and true in `done` once every tube is on and settled
// (the caller drops the lights then: a lit shop is the normal shop)
/** @param {ShopLights} L @param {number} time @param {number} pcx @param {boolean} inShop @param {number} [hold] @returns {{ lit: number[], done: boolean }} */
export function lightsStep(L, time, pcx, inShop, hold = Infinity) {
  const lit = [];
  const on = (/** @type {number} */ i, /** @type {number} */ at) => { if (L.on[i] < 0) { L.on[i] = at; lit.push(i); } };
  if (time - L.start >= LIGHT_WAIT) on(0, L.start + LIGHT_WAIT);
  // the next section: once you reach the middle of the last one lit (LIGHT_RUN apart at the least,
  // so running ahead still lights them one at a time); or, the perk section on long enough or you've
  // left the shop, the rest come on, one after another
  const k = L.on.indexOf(-1), latest = Math.max(...L.on), perks = L.on[PERK_I];
  if (k > 0 && k < hold && time - latest >= LIGHT_RUN &&
      (pcx >= (k === 1 ? FIRST_TRIGGER : LIGHT_X[k - 1] - 20) || (perks >= 0 && time - perks >= LIGHT_REST) || !inShop)) on(k, time);
  const done = L.on.every(t => t >= 0 && time - t >= TUBE_MAX);
  return { lit, done };
}

// The guide jumping out at world x: every dark section whose light reaches it comes on at once
// (its tube still stutters on). Returns the ones switched on
/** @param {ShopLights} L @param {number} x @param {number} time @returns {number[]} */
export function lightNear(L, x, time) {
  const lit = [];
  for (let i = 0; i < LIGHT_X.length; i++)
    if (L.on[i] < 0 && Math.abs(LIGHT_X[i] - x) < halfW(i) + 30) { L.on[i] = time; lit.push(i); }
  return lit;
}
