// @ts-check
// The autosave: readSave / cleanLoadout / cleanGun turn whatever is in localStorage
// (maybe from an older version) into a loadout that loads; loadSave / clearSave touch the
// store. Uses the page's VERSION global to decide whether the exact cave comes back.

import { START_GOLD } from '../core/consts.js';
import { PERKS } from '../data/perks.js';
import { resetGun } from '../spells/guns.js';
import { MODS } from '../spells/mods.js';

// ---- autosave ----
// The run is kept in localStorage under SAVE_KEY and read back on the next launch. In the
// Android app the page is always served from the same address, so the save survives a game
// update too. A save from an older version may name mods or perks that no longer exist, or
// miss gun fields added since: cleanLoadout / cleanGun drop the unknowns and fill the gaps,
// so an old save always loads. The exact cave is only restored when the version matches —
// after an update the generator may have changed, so you get a fresh cave on the same floor.
export const SAVE_KEY = 'caverunner-save';
export const GUN_DEFAULTS = { name: 'Gun', castDelay: 0.2, recharge: 0.5, manaMax: 100, manaRegen: 30,
  spread: 0, multi: 1, shuffle: false, speedMul: 1, hue: 0 };
/** @param {any} g whatever the store held @returns {Gun | null} */
export function cleanGun(g) {
  if (!g || typeof g !== 'object' || !Array.isArray(g.slots) || !g.slots.length) return null;
  const out = Object.assign({}, GUN_DEFAULTS, g);
  out.slots = g.slots.map(id => (id && MODS[id] ? id : null));
  out.cap = out.slots.length;
  out.mana = Math.max(0, Math.min(Number(g.mana) || 0, out.manaMax));
  return resetGun(out);
}
/** @param {any} lo whatever the store held @returns {Loadout | null} */
export function cleanLoadout(lo) {
  lo = lo && typeof lo === 'object' ? lo : {};
  const guns = [0, 1, 2, 3].map(i => cleanGun((lo.guns || [])[i]));
  if (!guns.some(Boolean)) return null;               // nothing to fight with: not a usable save
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  let sel = num(lo.sel, 0);
  if (!guns[sel]) sel = guns.findIndex(Boolean);
  return {
    guns, sel,
    bag: (Array.isArray(lo.bag) ? lo.bag : []).filter(id => MODS[id]),
    perks: (Array.isArray(lo.perks) ? lo.perks : []).filter(id => PERKS[id]),
    perksOff: (Array.isArray(lo.perksOff) ? lo.perksOff : []).filter(i => Number.isInteger(i) && i >= 0),
    gold: num(lo.gold, START_GOLD),               // negative while a level is on credit
    maxBonus: Math.max(0, num(lo.maxBonus, 0)),
    usedLives: Math.max(0, num(lo.usedLives, 0)),
    debug: !!lo.debug,
  };
}
// Turn the stored text back into a run, or null if there isn't a usable one.
/** @param {string | null} raw @returns {SaveData | null} */
export function readSave(raw) {
  let s;
  try { s = JSON.parse(raw); } catch (_) { return null; }
  if (!s || typeof s !== 'object') return null;
  const loadout = cleanLoadout(s.loadout);
  if (!loadout) return null;
  const floor = Math.max(1, Math.floor(Number(s.floor) || 1));
  const out = { loadout, floor, hp: Number.isFinite(s.hp) && s.hp > 0 ? s.hp : null, level: null,
    hasLvl: s.hasLvl !== false };               // a save from before the vending machines was mid-level
  // the cave itself only comes back on the same version, where the seed makes the same cave
  const L = s.level;
  if (s.ver === VERSION && L && Number.isFinite(L.seed)) {
    out.level = {
      seed: L.seed,
      owned: (Array.isArray(L.owned) ? L.owned : []).filter(id => PERKS[id]),
      alive: Array.isArray(L.alive) ? L.alive : null,
      sold: Array.isArray(L.sold) ? L.sold : [],
      rooms: Array.isArray(L.rooms) ? L.rooms : [],
      pickups: Array.isArray(L.pickups) ? L.pickups.map(q => {
        if (!q || typeof q !== 'object') return null;
        if (q.kind === 'mod') return MODS[q.id] ? q : null;
        if (q.kind === 'gun') { const gun = cleanGun(q.gun); return gun ? Object.assign({}, q, { gun }) : null; }
        return null;
      }).filter(Boolean) : null,
    };
  }
  return out;
}
/** @type {() => SaveData | null} */
export const loadSave = () => { try { return readSave(localStorage.getItem(SAVE_KEY)); } catch (_) { return null; } };
export const clearSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch (_) {} };
