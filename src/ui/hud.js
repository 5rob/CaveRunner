// @ts-check
// The in-game HUD: the two thumbsticks with their gauge rings (health + fuel on the left,
// mana + recharge + cast delay on the right), the R key of the buy line, the round deck
// buttons' layout, the gold readout, and holdPress (tap vs hold).

import { mixHex } from '../core/util.js';

// the circumference of the gauge ring (r=46 in a 0..100 viewBox), used to turn a 0..1
// fraction into a stroke-dasharray so the ring is drawn only as far as the stat reaches
export const GAUGE_R = 46, GAUGE_C = 2 * Math.PI * GAUGE_R;
// the three gun stats shown as rings on the right stick and colour-coded in the bag, so a
// ring and its stat read as the same thing: mana gold, recharge blue, cast delay purple
export const GAUGE_COL = { mana: '#ffc93c', rech: '#7ad7ff', cast: '#c58cff', fuel: '#ff9a2e' };
// green -> amber -> red as health falls, so the colour itself reads as danger
/** @param {number} frac @returns {string} */
export function healthCol(frac) {
  return frac > 0.5 ? mixHex('#e6a52c', '#57d267', (frac - 0.5) * 2)
                    : mixHex('#e24a2c', '#e6a52c', frac * 2);
}

