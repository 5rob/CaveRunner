// Gun presets (owner, LIST4 #1): the Bag's 💾 saves the gun in the Bag with its mods, under a name;
// Dev → Spawn gun lists them and drops an exact copy. Shared across runs and save slots, never cleared
// by the game: localStorage PRESET_KEY = [{ name, gun }].
import { cleanGun } from './save.js';
import { DEFAULT_PRESETS } from './presetdefaults.js';

export const PRESET_KEY = 'caverunner-gunpresets';
export const PRESET_NAME_MAX = 40;

/** @param {any} name @param {string} fallback */
const cleanName = (name, fallback) => {
  const s = typeof name === 'string' ? name.trim().slice(0, PRESET_NAME_MAX) : '';
  return s || fallback;
};

/** A plain copy of a gun for storing: its build and stats, none of its firing state.
 * @param {Gun} gun @returns {Gun | null} */
function storeGun(gun) {
  const g = cleanGun(JSON.parse(JSON.stringify(gun)));
  if (!g) return null;
  g.mana = g.manaMax;
  return g;
}

/** Whatever the store held → a clean list (junk entries dropped).
 * @param {any} list @returns {GunPreset[]} */
export function cleanPresets(list) {
  if (!Array.isArray(list)) return [];
  /** @type {GunPreset[]} */
  const out = [];
  for (const p of list) {
    if (!p || typeof p !== 'object') continue;
    const gun = storeGun(p.gun);
    if (gun) out.push({ name: cleanName(p.name, gun.name), gun });
  }
  return out;
}

/** @returns {GunPreset[]} */
export const loadPresets = () => {
  // (v1.0.94) never saved on this device: the built-in list (save/presetdefaults.js)
  try { const raw = localStorage.getItem(PRESET_KEY); return cleanPresets(raw == null ? DEFAULT_PRESETS : JSON.parse(raw)); } catch (_) { return cleanPresets(DEFAULT_PRESETS); }
};
/** @param {GunPreset[]} list */
export const savePresets = list => { try { localStorage.setItem(PRESET_KEY, JSON.stringify(list)); } catch (_) {} };

/** A new list with this gun added at the end as `name` (the gun's own name if blank); unchanged if the gun is junk.
 * @param {GunPreset[]} list @param {string} name @param {Gun} gun @returns {GunPreset[]} */
export function addPreset(list, name, gun) {
  const g = gun && storeGun(gun);
  if (!g) return list.slice();
  return list.concat([{ name: cleanName(name, g.name), gun: g }]);
}

/** A new list without entry i. @param {GunPreset[]} list @param {number} i @returns {GunPreset[]} */
export const removePreset = (list, i) => list.filter((_, k) => k !== i);

/** A fresh gun from a preset, ready to drop (its own copy: the preset stays as saved).
 * @param {GunPreset} p @returns {Gun | null} */
export const presetGun = p => storeGun(p.gun);

// (Dev → Presets, CaveRunner Auto) entry i replaced by this gun as `name` (its save changes); unchanged if the gun is junk
/** @param {GunPreset[]} list @param {number} i @param {string} name @param {Gun} gun @returns {GunPreset[]} */
export function setPreset(list, i, name, gun) {
  const g = gun && storeGun(gun);
  if (!g || i < 0 || i >= list.length) return list.slice();
  return list.map((p, k) => (k === i ? { name: cleanName(name, g.name), gun: g } : p));
}
// entry i moved d places (Grem Mode unlocks them in this order); kept inside the list
/** @param {GunPreset[]} list @param {number} i @param {number} d @returns {GunPreset[]} */
export function movePreset(list, i, d) {
  const j = Math.max(0, Math.min(list.length - 1, i + d)), out = list.slice();
  if (i < 0 || i >= list.length || j === i) return out;
  const [p] = out.splice(i, 1);
  out.splice(j, 0, p);
  return out;
}
