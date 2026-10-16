// @ts-check
// The shop's vending machines (the menu is ui/vendshop.js, the look render/shops.js). Each is an
// entry in SHOPS: where it stands and its hologram. Standing at one shows "Tap R to shop"; the tap
// opens its menu (input.current.shopOpen = its key, the game pauses), and what you buy there comes
// back as input.current.dispense, popped out of the machine's chute onto the floor (stepShops).
// Since v0.0.138 the mod and perk machines are crystal machines (`takes`): no menu (archived: the
// menu code is all still there, ui/vendshop.js + ui/modshop.js; drop `takes` to bring one back). A
// crystal of its colour that comes near (you can't carry them: you push them, or drag them with the
// Gravity Gun) is sucked in, the machine's lights speed up and it shakes faster and faster for CYCLE
// seconds, then pops out a mod off the floor's drop table (repeats allowed) or a perk you've never had (stepCrystals).
// Since v0.0.142 one that hasn't had a real crystal yet this run (LO.fed) shows how while you stand near:
// a hologram crystal blinks in on the floor beside it and is sucked into its slot, on a loop (stepDemo).

import { CELL, SHOP_FLOOR, SHOP_MACHINE_X } from '../../core/consts.js';

export const MACHINE_W = 56, MACHINE_H = 84;                   // a machine's cabinet (world units)
export const MACHINE_TOP = SHOP_FLOOR * CELL - MACHINE_H;      // its top
export const CHUTE_Y = SHOP_FLOOR * CELL - 14;           // where a bought thing comes out

/** @typedef {{ x: number, icon: string, hue: string, label: string, takes?: 'red' | 'green' }} ShopMachine  icon: an emoji, or 'gun' for the gun sprite; takes: a crystal machine (no menu) */
/** @type {Record<string, ShopMachine>} */
export const SHOPS = {                                   // left to right: guns, mods, perks (owner, v0.0.142: guns and mods swapped)
  mods: { x: SHOP_MACHINE_X[1], icon: '⚙️', hue: '#ff3a4a', label: 'Tap R to shop', takes: 'red' },
  guns: { x: SHOP_MACHINE_X[0], icon: 'gun', hue: '#ffd95a', label: 'Tap R to shop' },
  perks: { x: SHOP_MACHINE_X[2], icon: '✦', hue: '#3dff7a', label: 'Tap R to shop', takes: 'green' },
};

export const SLOT_Y = MACHINE_TOP + 52;                   // where a crystal goes into the machine
const INTAKE_X = MACHINE_W / 2 + 26, INTAKE_TOP = MACHINE_TOP - 26;   // how close one must come to be sucked in

export const DEMO_SIDE = MACHINE_W / 2 + 18;              // the crystal's x, out from the machine's middle
export const DEMO_IN = 0.45, DEMO_SIT = 0.9, DEMO_SUCK = 0.55, DEMO_FLASH = 0.3, DEMO_GAP = 2;
export const DEMO_LOOP = DEMO_IN + DEMO_SIT + DEMO_SUCK + DEMO_FLASH + DEMO_GAP;

// Where a loop is, t seconds into the demo: the part ('in' glitching in, 'sit', 'suck', 'flash' at
// the slot, 'gap' nothing) and how far through it (0-1)
/** @param {number} t @returns {{ ph: 'in' | 'sit' | 'suck' | 'flash' | 'gap', u: number }} */
export function demoAt(t) {
  let r = ((t % DEMO_LOOP) + DEMO_LOOP) % DEMO_LOOP;
  /** @type {[('in' | 'sit' | 'suck' | 'flash'), number][]} */
  const parts = [['in', DEMO_IN], ['sit', DEMO_SIT], ['suck', DEMO_SUCK], ['flash', DEMO_FLASH]];
  for (const [ph, len] of parts) {
    if (r < len) return { ph, u: r / len };
    r -= len;
  }
  return { ph: 'gap', u: r / DEMO_GAP };
}

