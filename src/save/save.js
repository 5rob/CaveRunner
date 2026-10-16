// @ts-check
// The autosave: readSave / cleanLoadout / cleanGun turn whatever is in localStorage
// (maybe from an older version) into a loadout that loads; loadSave / clearSave touch the
// store. Uses the page's VERSION global to decide whether the exact cave comes back.

import { resetGun } from '../spells/guns.js';
import { ensureMod } from '../spells/discrim.js';
import { gunArt } from '../art/gunart.js';

// ---- save slots (LIST4): three, picked on the title screen. Each holds its own run save and its
// two collections; slot 1 keeps the old keys unchanged (the run from before slots is slot 1), slots
// 2 and 3 add '-2' / '-3'. The active slot is in SLOT_KEY. Dev settings, the audit, clips, gun
// presets, pins and the volume are shared. ----
export const SLOT_KEY = 'caverunner-slot';
export const SLOTS = 3;
/** @returns {number} the active slot, 1..SLOTS */
export const getSlot = () => {
  try { const n = parseInt(localStorage.getItem(SLOT_KEY), 10); return n >= 1 && n <= SLOTS ? n : 1; } catch (_) { return 1; }
};
export const GUN_DEFAULTS = { name: 'Gun', castDelay: 0.2, recharge: 0.5, manaMax: 100, manaRegen: 30,
  spread: 0, multi: 1, shuffle: false, speedMul: 1, hue: 0 };
/** @param {any} g whatever the store held @returns {Gun | null} */
export function cleanGun(g) {
  if (!g || typeof g !== 'object' || !Array.isArray(g.slots) || !g.slots.length) return null;
  const out = Object.assign({}, GUN_DEFAULTS, g);
  out.slots = g.slots.map(id => (id && ensureMod(id) ? id : null));
  // a Gravity Gun saved before v0.0.155 has Follow Me: its trick (the hole held where you aim) is Follow This now
  if (out.name === 'Gravity Gun') out.slots = out.slots.map(id => (id === 'follow' ? 'followaim' : id));
  if (!gunArt(out.art)) delete out.art;               // a skin only if it's still one of GUN_ART
  out.cap = out.slots.length;
  out.mana = Math.max(0, Math.min(Number(g.mana) || 0, out.manaMax));
  return resetGun(out);
}

