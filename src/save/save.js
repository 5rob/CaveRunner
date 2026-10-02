// @ts-check
// The autosave: readSave / cleanLoadout / cleanGun turn whatever is in localStorage
// (maybe from an older version) into a loadout that loads; loadSave / clearSave touch the
// store. Uses the page's VERSION global to decide whether the exact cave comes back.

import { DEADLINE_MS, LVL_BUY, START_GOLD } from '../core/consts.js';
import { PERKS, SUIT_LEN, SUIT_SLOTS, fitsSlot } from '../data/perks.js';
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
/** @param {any} lo whatever the store held @returns {{ perks: string[], suit: (string | null)[] }} */
export function cleanPerks(lo) {
  const carried = (Array.isArray(lo.perks) ? lo.perks : []).filter(id => PERKS[id]);
  // a perk is fitted once at most (v129): a second copy in the suit goes back to the carried ones
  if (Array.isArray(lo.suit)) {
    const suit = Array.from({ length: SUIT_LEN }, (_, i) => (fitsSlot(lo.suit[i], i) ? lo.suit[i] : null));
    suit.forEach((id, i) => { if (id && suit.indexOf(id) !== i) { carried.push(id); suit[i] = null; } });
    return { perks: carried, suit };
  }
  const off = Array.isArray(lo.perksOff) ? lo.perksOff : [];
  const on = carried.filter((_, i) => !off.includes(i)), rest = carried.filter((_, i) => off.includes(i));
  const fit = on.filter((id, i) => on.indexOf(id) === i).slice(0, SUIT_SLOTS);
  const left = on.slice();
  for (const id of fit) left.splice(left.indexOf(id), 1);
  const suit = Array.from({ length: SUIT_LEN }, (_, i) => (i < SUIT_SLOTS && fit[i]) || null);
  return { perks: rest.concat(left), suit };
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
    // perks carried (LO.perks) and fitted to the Exo Suit (LO.suit). A save from before the suit:
    // its switched-on perks go in the slots, as many as fit, the rest are carried
    ...cleanPerks(lo),
    // v106 put a bought level's price on your gold (it went negative); now it's a debt of its own
    // and an older page loading a v107 save dropped the debt and then paid out the whole sale: a
    // pile of gold that size with no debt is that, so the level's price comes back off it
    gold: num(lo.gold, START_GOLD) < 0 ? Math.max(0, num(lo.gold, 0) + LVL_BUY)
      : num(lo.gold, START_GOLD) >= LVL_BUY && !(num(lo.debt, 0) > 0) ? num(lo.gold, 0) - LVL_BUY : num(lo.gold, START_GOLD),
    debt: Math.max(0, num(lo.debt, 0)) || (num(lo.gold, 0) < 0 ? LVL_BUY : 0),
    // the repayment deadline; a debt from before v107 had none: it gets its hour from now
    due: num(lo.due, 0) || (num(lo.debt, 0) > 0 || num(lo.gold, 0) < 0 ? Date.now() + DEADLINE_MS : 0),
    maxBonus: Math.max(0, num(lo.maxBonus, 0)),
    usedLives: Math.max(0, num(lo.usedLives, 0)),
    // red crystals carried: the floor each came from (the shop's machine turns one into an unlock)
    // the gun machine's offer: its guns cleaned like yours (a sold one stays null)
    gunShop: lo.gunShop && typeof lo.gunShop === 'object' && Array.isArray(lo.gunShop.guns)
      ? { floor: num(lo.gunShop.floor, 0), guns: lo.gunShop.guns.map(cleanGun), rerolls: Math.max(0, num(lo.gunShop.rerolls, 0)),
          boosts: Math.max(0, num(lo.gunShop.boosts, 0)) } : undefined,
    greens: (Array.isArray(lo.greens) ? lo.greens : []).filter(f => Number.isInteger(f) && f > 0),
    crystals: (Array.isArray(lo.crystals) ? lo.crystals : []).filter(f => Number.isInteger(f) && f > 0),
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
      heals: Math.max(0, Math.floor(Number(L.heals) || 0)),
      brood: Array.isArray(L.brood) ? L.brood.filter(b => Array.isArray(b) && Number.isInteger(b[0]) && Number.isInteger(b[1]) && b[1] >= 0) : [],
      pickups: Array.isArray(L.pickups) ? L.pickups.map(q => {
        if (!q || typeof q !== 'object') return null;
        if (q.kind === 'mod') return MODS[q.id] ? q : null;
        if (q.kind === 'perk') return PERKS[q.id] ? q : null;
        if (q.kind === 'crystal') return Number.isInteger(q.floor) && q.floor > 0 ? q : null;
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

// ---- the mod collection: the mods you have unlocked this run, under its own key (not cleared by
// clearSave; a death empties it, game/systems/player.js) ----
export const COLLECTION_KEY = 'caverunner-collection';
/** @param {string | null} raw @returns {string[]} */
export function readCollection(raw) {
  let s;
  try { s = JSON.parse(raw); } catch (_) { return []; }
  return Array.isArray(s) ? [...new Set(s.filter(id => typeof id === 'string' && MODS[id]))] : [];
}
/** @type {() => string[]} */
export const loadCollection = () => { try { return readCollection(localStorage.getItem(COLLECTION_KEY)); } catch (_) { return []; } };
/** @param {string[]} ids */
export const saveCollection = ids => { try { localStorage.setItem(COLLECTION_KEY, JSON.stringify(ids)); } catch (_) {} };

// the perks unlocked at the perk machine, kept across runs (a death keeps them)
export const PERK_COLLECTION_KEY = 'caverunner-perkcollection';
/** @param {string | null} raw @returns {string[]} */
export function readPerkCollection(raw) {
  let s;
  try { s = JSON.parse(raw); } catch (_) { return []; }
  return Array.isArray(s) ? [...new Set(s.filter(id => typeof id === 'string' && PERKS[id]))] : [];
}
/** @type {() => string[]} */
export const loadPerkCollection = () => { try { return readPerkCollection(localStorage.getItem(PERK_COLLECTION_KEY)); } catch (_) { return []; } };
/** @param {string[]} ids */
export const savePerkCollection = ids => { try { localStorage.setItem(PERK_COLLECTION_KEY, JSON.stringify(ids)); } catch (_) {} };
