// @ts-check
// The autosave: readSave / cleanLoadout / cleanGun turn whatever is in localStorage
// (maybe from an older version) into a loadout that loads; loadSave / clearSave touch the
// store. Uses the page's VERSION global to decide whether the exact cave comes back.

import { DEADLINE_MS, OLD_LVL_BUY, START_GOLD } from '../core/consts.js';
import { PERKS, SUIT_LEN, SUIT_SLOTS, fitsSlot } from '../data/perks.js';
import { resetGun } from '../spells/guns.js';
import { MODS } from '../spells/mods.js';
import { ensureMod } from '../spells/discrim.js';
import { gunArt } from '../art/gunart.js';

// ---- autosave ----
// The run is kept in localStorage under SAVE_KEY and read back on the next launch. In the
// Android app the page is always served from the same address, so the save survives a game
// update too. A save from an older version may name mods or perks that no longer exist, or
// miss gun fields added since: cleanLoadout / cleanGun drop the unknowns and fill the gaps,
// so an old save always loads. The exact cave is only restored when the version matches —
// after an update the generator may have changed, so you get a fresh cave on the same floor.
export const SAVE_KEY = 'caverunner-save';

// ---- save slots (LIST4): three, picked on the title screen. Each holds its own run save and its
// two collections; slot 1 keeps the old keys unchanged (the run from before slots is slot 1), slots
// 2 and 3 add '-2' / '-3'. The active slot is in SLOT_KEY. Dev settings, the audit, clips, gun
// presets, pins and the volume are shared. ----
export const SLOT_KEY = 'caverunner-slot';
export const SLOTS = 3;
/** @param {string} base a key for slot 1 @param {number} slot 1..SLOTS @returns {string} that slot's key */
export const slotKey = (base, slot) => (slot >= 2 && slot <= SLOTS ? base + '-' + Math.floor(slot) : base);
/** @returns {number} the active slot, 1..SLOTS */
export const getSlot = () => {
  try { const n = parseInt(localStorage.getItem(SLOT_KEY), 10); return n >= 1 && n <= SLOTS ? n : 1; } catch (_) { return 1; }
};
/** @param {number} slot */
export const setSlot = slot => { try { localStorage.setItem(SLOT_KEY, String(slot)); } catch (_) {} };
/** @param {number} [slot] @returns {string} where that slot's (else the active slot's) run is saved */
export const saveKey = slot => slotKey(SAVE_KEY, slot || getSlot());
/** A slot's line on the title screen, from its stored save text: null when there is no run in it.
 * @param {string | null} raw @returns {{ floor: number, gold: number, guns: number, mods: number } | null} */
export function slotSummary(raw) {
  const s = readSave(raw);
  if (!s) return null;
  const lo = s.loadout;
  return { floor: s.floor, gold: Math.floor(lo.gold || 0), guns: lo.guns.filter(Boolean).length,
    mods: lo.bag.length + lo.guns.reduce((n, g) => n + (g ? g.slots.filter(Boolean).length : 0), 0) };
}
/** @param {number} slot @returns {ReturnType<typeof slotSummary>} */
export const loadSlotSummary = slot => { try { return slotSummary(localStorage.getItem(slotKey(SAVE_KEY, slot))); } catch (_) { return null; } };
/** Empties a slot: its run and both its collections. @param {number} slot */
export const deleteSlot = slot => {
  try { for (const k of [SAVE_KEY, COLLECTION_KEY, PERK_COLLECTION_KEY]) localStorage.removeItem(slotKey(k, slot)); } catch (_) {}
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
  if (!Array.isArray(lo.guns)) return null;           // not a loadout (no guns at all is fine: a new run starts empty)
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  let sel = num(lo.sel, 0);
  if (!guns[sel]) sel = Math.max(0, guns.findIndex(Boolean));
  return {
    guns, sel,
    bag: (Array.isArray(lo.bag) ? lo.bag : []).filter(id => ensureMod(id)),
    // perks carried (LO.perks) and fitted to the Exo Suit (LO.suit). A save from before the suit:
    // its switched-on perks go in the slots, as many as fit, the rest are carried
    ...cleanPerks(lo),
    // v106 put a bought level's price on your gold (it went negative); now it's a debt of its own
    // and an older page loading a v107 save dropped the debt and then paid out the whole sale: a
    // pile of gold that size with no debt is that, so the level's price comes back off it
    gold: num(lo.gold, START_GOLD) < 0 ? Math.max(0, num(lo.gold, 0) + OLD_LVL_BUY)
      : num(lo.gold, START_GOLD) >= OLD_LVL_BUY && !(num(lo.debt, 0) > 0) ? num(lo.gold, 0) - OLD_LVL_BUY : num(lo.gold, START_GOLD),
    debt: Math.max(0, num(lo.debt, 0)) || (num(lo.gold, 0) < 0 ? OLD_LVL_BUY : 0),
    // the repayment deadline; a debt from before v107 had none: it gets its hour from now
    due: num(lo.due, 0) || (num(lo.debt, 0) > 0 || num(lo.gold, 0) < 0 ? Date.now() + DEADLINE_MS : 0),
    soldTop: Math.max(0, Math.floor(num(lo.soldTop, 0))),   // the highest floor sold this run (data/levels.js)
    maxBonus: Math.max(0, num(lo.maxBonus, 0)),
    usedLives: Math.max(0, num(lo.usedLives, 0)),
    // red crystals carried: the floor each came from (the shop's machine turns one into an unlock)
    // the gun machine's offer: its guns cleaned like yours (a sold one stays null)
    gunShop: lo.gunShop && typeof lo.gunShop === 'object' && Array.isArray(lo.gunShop.guns)
      ? { floor: num(lo.gunShop.floor, 0), guns: lo.gunShop.guns.map(cleanGun), rerolls: Math.max(0, num(lo.gunShop.rerolls, 0)),
          boosts: Math.max(0, num(lo.gunShop.boosts, 0)) } : undefined,
    greens: (Array.isArray(lo.greens) ? lo.greens : []).filter(f => Number.isInteger(f) && f > 0),
    crystals: (Array.isArray(lo.crystals) ? lo.crystals : []).filter(f => Number.isInteger(f) && f > 0),
    fed: (Array.isArray(lo.fed) ? lo.fed : []).filter(k => typeof k === 'string'),
    debug: !!lo.debug,
    debugPerks: !!lo.debugPerks,
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
      // the gold on the ground (floor 2's loot): a place and a worth
      coins: Array.isArray(L.coins) ? L.coins.filter(c => c && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.amount) && c.amount > 0)
        .map(c => ({ x: c.x, y: c.y, amount: c.amount, t: Number(c.t) || 0, ...(c.sz >= 0 && c.sz <= 2 ? { sz: c.sz } : {}) })) : undefined,
      // the map's pins (v0.0.141): a spot and one character
      pins: Array.isArray(L.pins) ? L.pins.filter(q => q && Number.isFinite(q.x) && Number.isFinite(q.y) && typeof q.e === 'string' && q.e)
        .map(q => ({ x: q.x, y: q.y, e: q.e })) : [],
    };
  }
  return out;
}
/** @type {() => SaveData | null} */
export const loadSave = () => { try { return readSave(localStorage.getItem(saveKey())); } catch (_) { return null; } };
export const clearSave = () => { try { localStorage.removeItem(saveKey()); } catch (_) {} };

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
export const loadCollection = () => { try { return readCollection(localStorage.getItem(slotKey(COLLECTION_KEY, getSlot()))); } catch (_) { return []; } };
/** @param {string[]} ids */
export const saveCollection = ids => { try { localStorage.setItem(slotKey(COLLECTION_KEY, getSlot()), JSON.stringify(ids)); } catch (_) {} };

// the perks unlocked at the perk machine, kept across runs (a death keeps them)
export const PERK_COLLECTION_KEY = 'caverunner-perkcollection';
/** @param {string | null} raw @returns {string[]} */
export function readPerkCollection(raw) {
  let s;
  try { s = JSON.parse(raw); } catch (_) { return []; }
  return Array.isArray(s) ? [...new Set(s.filter(id => typeof id === 'string' && PERKS[id]))] : [];
}
/** @type {() => string[]} */
export const loadPerkCollection = () => { try { return readPerkCollection(localStorage.getItem(slotKey(PERK_COLLECTION_KEY, getSlot()))); } catch (_) { return []; } };
/** @param {string[]} ids */
export const savePerkCollection = ids => { try { localStorage.setItem(slotKey(PERK_COLLECTION_KEY, getSlot()), JSON.stringify(ids)); } catch (_) {} };
