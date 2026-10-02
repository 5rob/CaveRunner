// @ts-check
// The mod collection the vending machine sells from (ui/vendshop.js, game/systems/shops.js):
// which mods you have unlocked is kept across runs (save/save.js: loadCollection), and a red
// crystal found in the cave unlocks one more, rolled off the drop table of the floor it came from.

import { ALL_IDS, tierOf } from './mods.js';
import { modWeight } from './spawn.js';

// The collection's grid: every mod that can drop, grouped by rarity (MOD_TIER 1–4), each group in
// MODS' own order so a mod always sits in the same cell
/** @returns {{ tier: number, ids: string[] }[]} */
export function modTiers() {
  return [1, 2, 3, 4].map(tier => ({ tier, ids: ALL_IDS.filter(id => tierOf(id) === tier) }));
}

// The mod a crystal from `floor` unlocks: drawn off that floor's drop table (modWeight), never one
// you already own. When the floor's table has nothing left you don't own, any mod you don't own;
// null once you own them all
/** @param {() => number} rnd @param {number} floor @param {string[]} owned @returns {string | null} */
export function crystalRoll(rnd, floor, owned) {
  const have = new Set(owned);
  const left = ALL_IDS.filter(id => !have.has(id));
  if (!left.length) return null;
  let total = 0;
  for (const id of left) total += modWeight(id, floor);
  if (total <= 0) return left[Math.floor(rnd() * left.length)];
  let r = rnd() * total;
  for (const id of left) {
    r -= modWeight(id, floor);
    if (r <= 0 && modWeight(id, floor) > 0) return id;
  }
  return left.filter(id => modWeight(id, floor) > 0).pop() || left[0];
}
