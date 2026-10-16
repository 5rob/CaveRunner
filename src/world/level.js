// @ts-check
// makeLevel(seed, floor, owned): one floor, built whole — terrain, shop, prize rooms,
// enemies, pickups, decoration, gold seams and nests. Pure: the same seed, floor and
// perks owned make the same cave.

import { CELL, CW, SHOP_FLOOR, SHOP_ROOF, SHOP_TOP } from '../core/consts.js';

// a prize room's half-size in world units, shell included (makeLevel's rx/ry + sh, in pixels)
export const ROOM_HW = 23 * CELL, ROOM_HH = 15 * CELL;                   // gold per vein pixel dug out (before the floor's lift)

// The shop's shell, one terrain pixel at (cx, cy): dark steel panels with seams and rivets, a
// strip of ceiling lights under the roof, a bright-edged deck plate for the floor, steel columns
// for the side walls. Pure, so a test can check it
/** @param {number} cx @param {number} cy @returns {number[]} */
export function shopPanel(cx, cy) {
  const top = SHOP_TOP - SHOP_ROOF;
  if (cy < SHOP_FLOOR && (cx < 3 || cx >= CW - 3)) {                    // the side walls
    if (cx === 2 || cx === CW - 3) return [92, 102, 118];
    return (cy % 12 === 0) ? [26, 30, 38] : [50, 57, 70];
  }
  if (cy < SHOP_TOP) {                                                  // the roof
    const r = cy - top;
    if (r === 0) return [74, 82, 98];
    if (r === SHOP_ROOF - 1) return cx % 16 < 11 ? [130, 222, 255] : [40, 54, 70];   // the lights
    if (r === SHOP_ROOF - 2) return [29, 34, 43];
    if (cx % 24 === 0) return [24, 28, 36];
    if (r === 2 && (cx % 24 === 3 || cx % 24 === 21)) return [96, 108, 124];
    return [42, 48, 59];
  }
  const f = cy - SHOP_FLOOR;                                            // the floor
  if (f === 0) return cx % 20 === 0 ? [70, 78, 92] : [150, 162, 180];
  if (f === 1) return cx % 40 === 20 || cx % 40 === 21 ? [100, 210, 255] : [72, 81, 96];
  if (f < 4) return cx % 20 === 0 ? [28, 32, 40] : [46, 52, 63];
  return [20, 23, 29];
}

// the exit teleporters' rooms along the top of the cave, evenly spaced across it (terrain cells)
export const EXIT_X = [CW / 6, CW / 2, CW * 5 / 6].map(Math.round);

