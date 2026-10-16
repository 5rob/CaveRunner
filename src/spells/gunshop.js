// @ts-check
// The gun vending machine's offer (ui/gunshop.js): three guns off the current floor's pool, each
// priced on its rolled stats and its level. Rerolling costs gold, dearer each time on the same
// floor; the crystal-boosted reroll costs red crystals (one more each time on the floor) and rolls
// from deeper floors' levels with boosted stats. The offer lives in the loadout (LO.gunShop), so
// it's saved with the run and a new floor starts a fresh one.

import { GUN_LV_MAX, gunLevel, makeGun, resetGun } from './guns.js';

export const BOOST_UP = [1, 3];             // a boosted roll's levels above the floor: min, max

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

