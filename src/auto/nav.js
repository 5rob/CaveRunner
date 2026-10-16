// @ts-check
// The context nav (AUTOBATTLER.md stage 8a): the row between the play area and the bag, as a small state machine.
// players → a player's menu (Guns / Exo suit / Perks / Stats) → guns (its 4 gun slots) → a gun (its mod slots);
// exo → a category (Max Health / Movement Speed / Jetpack / Carrot) → its 5 slots; perks (6 slots); stats (stage 9).
// navOpen goes one level down (a tapped cell's `open`), navBack one up (B; at the top it does nothing). navRow says
// what the row shows. Pure: the state is a plain object, every move returns a new one.

import { HUB_MACHINES } from './hub.js';

// the hub machine each part links to (owner): its circle and its rows' edge in that machine's colour (a gun's mod
// slots: the mod machine's)
const MACHINE_COL = { guns: HUB_MACHINES.gun.hue, gun: HUB_MACHINES.mod.hue, exo: HUB_MACHINES.exo.hue, cat: HUB_MACHINES.exo.hue,
  perks: HUB_MACHINES.perk.hue };

/** @typedef {'players' | 'player' | 'guns' | 'gun' | 'exo' | 'cat' | 'perks' | 'stats'} NavLevel */
/** @typedef {{ level: NavLevel, p: number, g: number, cat: ExoCat }} NavState */
/**
 * One cell of the row: a circle (a choice) or a square slot. `open` is what navOpen takes when it's tapped (none: a tap
 * does nothing); `item` a slot's fitted thing (a BagItem, the bag's tile look); `gun` a gun circle's gun.
 * @typedef {{ key: string, glyph?: string, label?: string, col?: string, gun?: Gun | null, item?: BagItem | null,
 *   dim?: boolean, sel?: boolean, open?: string | number,
 *   icon?: string, helm?: boolean, glow?: string, hp?: number }} NavCell
 */
/** @typedef {{ shape: 'circles' | 'slots' | 'stats', cells: NavCell[], col: string | null }} NavRow */

/** the exo categories' names @type {Record<ExoCat, string>} */
export const EXO_NAMES = { hp: 'Max Health', speed: 'Movement Speed', jet: 'Jetpack', carrot: 'Carrot' };

