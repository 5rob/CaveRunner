// @ts-check
// Fire: the pixel-by-pixel spread of burning grass, moss and timber (fireNew, fireStep,
// fireArea, fireDouse…) and what burns or puts you out. Pure: the Game owns one state F.

import { CW } from '../core/consts.js';

/** @type {Record<string, number>} */
export const FLAMMABLE = { vine: 1, myc: 1 };                  // the ones that burn (kelp's wet, the roots are fossil)
export const FIRE_COLS = ['#ffe07a', '#ff9a2e', '#f0561c', '#8a2a14'];   // bright, flame, deep, dying ember

export const FIRE_TICK = 0.05;                 // the fire moves on 20 times a second, not every frame
export const FIRE_CATCH = [0, 1, 0.6, 0.45];   // how readily each kind catches: grass, moss, timber
export const FIRE_KNOB = [null, 'fireGrass', 'fireMoss', 'fireWood'];
// Fire climbs: a pixel above catches about three times as readily as one below, one beside
// nearly as readily as above. FIRE_NB is every spot within two pixels as [pixel-index offset,
// weight]; the ring two out is at 0.3 of that, so fire crosses a hairline gap but not open air.
export const FIRE_UPW = (/** @type {number} */ dy) => dy < 0 ? 1 : dy === 0 ? 0.9 : 0.35;
/** @type {[offset: number, weight: number][]} */
export const FIRE_NB = [];
for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
  if (dx || dy) FIRE_NB.push([dy * CW + dx, FIRE_UPW(dy) * (Math.max(Math.abs(dx), Math.abs(dy)) === 2 ? 0.3 : 1)]);
