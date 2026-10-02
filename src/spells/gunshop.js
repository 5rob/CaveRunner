// @ts-check
// The gun vending machine's offer (ui/gunshop.js): three guns off the current floor's pool, each
// priced on its rolled stats and its level. Rerolling costs gold, dearer each time on the same
// floor; the crystal-boosted reroll costs red crystals (one more each time on the floor) and rolls
// from deeper floors' levels with boosted stats. The offer lives in the loadout (LO.gunShop), so
// it's saved with the run and a new floor starts a fresh one.

import { GUN_LV_MAX, gunLevel, gunPrice, makeGun, resetGun } from './guns.js';

export const GUN_OFFER = 3;                 // guns on offer at once
export const REROLL_BASE = 20, REROLL_GROW = 1.6;   // the first reroll's gold (times the floor lift), times this each use
export const BOOST_UP = [1, 3];             // a boosted roll's levels above the floor: min, max

/** @param {number} v */
const five = v => Math.max(5, Math.round(v / 5) * 5);

// A boosted gun: better on every stat than its level rolls, one more slot
/** @param {Gun} g @returns {Gun} */
export function boostGun(g) {
  g.castDelay *= 0.8; g.recharge *= 0.8; g.spread *= 0.6;
  g.manaMax = Math.round(g.manaMax * 1.25); g.manaRegen = Math.round(g.manaRegen * 1.25);
  g.cap = Math.min(25, g.cap + 1); g.slots.push(null);
  g.boosted = true;
  g.mana = g.manaMax;
  return resetGun(g);
}

// one gun for the machine: the floor's level (now and then a rarer one, gunLevel), or boosted:
// BOOST_UP levels deeper, with boostGun on top
/** @param {() => number} rnd @param {number} floor @param {boolean} boost @returns {Gun} */
export function shopGun(rnd, floor, boost) {
  if (!boost) return makeGun(rnd, gunLevel(floor, rnd));
  const lvl = Math.min(GUN_LV_MAX, Math.max(1, floor) + BOOST_UP[0] + Math.floor(rnd() * (BOOST_UP[1] - BOOST_UP[0] + 1)));
  return boostGun(makeGun(rnd, lvl));
}

// a gun's price at the machine: what its stats are worth (gunPrice), lifted by its level, a
// quarter more for a boosted one
/** @param {Gun} g */
export const shopGunPrice = g => five(gunPrice(g) * (1 + 0.15 * ((g.lvl || 1) - 1)) * (g.boosted ? 1.25 : 1));

// the gold reroll's price: the n-th use on this floor (0 = the first)
/** @param {number} floor @param {number} n */
export const rerollPrice = (floor, n) => five(REROLL_BASE * (1 + (floor - 1) * 0.3) * Math.pow(REROLL_GROW, n));
// the boosted reroll's price in red crystals: one more than the last on this floor
/** @param {number} n boosted rerolls used on this floor */
export const boostCost = n => n + 1;

// a fresh offer for a floor
/** @param {() => number} rnd @param {number} floor @returns {GunOffer} */
export function newOffer(rnd, floor) {
  return { floor, guns: Array.from({ length: GUN_OFFER }, () => shopGun(rnd, floor, false)), rerolls: 0, boosts: 0 };
}

// roll the three again (a reroll); the counts are the caller's
/** @param {() => number} rnd @param {GunOffer} o @param {boolean} boost */
export function rollOffer(rnd, o, boost) {
  o.guns = o.guns.map(() => shopGun(rnd, o.floor, boost));
}
