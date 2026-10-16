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

export const FIRST_X = 76;            // the first section's middle: the teleporter and its sign

/** the middle of each light section, left to right (world x), SHOP_SLOT apart: each machine
 * (VEND_BUY_X on, SHOP_SLOT apart too) is the middle of one */
export const LIGHT_X = [FIRST_X];
for (let x = FIRST_X + SHOP_SLOT; x < WW; x += SHOP_SLOT) LIGHT_X.push(x);
const PERK_I = LIGHT_X.indexOf(SHOP_MACHINE_X[2]);   // the perk machine's section: the last with something in it

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

