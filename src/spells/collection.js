// @ts-check
// The mod collection the vending machine sells from (ui/vendshop.js, game/systems/shops.js):
// which mods you have unlocked is kept for the run (save/save.js: loadCollection; a death empties it), and a red
// crystal found in the cave unlocks one more, rolled off the drop table of the floor it came from.

import { ALL_IDS } from './mods.js';
import { modWeight } from './spawn.js';

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

// The Bag's "Collected mods" grid shows one tile per stack (owner, item 9): copies that are the same
// mod share a tile with a count. LO.bag still holds one entry per copy (saves unchanged); this only
// groups it for display. stackKey is what makes two copies "the same": the id, which already carries a
// Discriminate's target ('discrim:creature:konna', spells/discrim.js), so differently-set copies stack apart.
/** @param {string} entry @returns {string} */
export function stackKey(entry) { return entry; }

// ---- kept for the test suites (grem branch: the game no longer calls these; the suites set up with them) ----
// The bag as stacks, in the order each stack first appears: `i` = the bag index of its first copy
// (what a drag takes out), `n` = how many copies
/** @param {string[]} bag @returns {{ key: string, id: string, i: number, n: number }[]} */
export function stackBag(bag) {
  /** @type {Map<string, { key: string, id: string, i: number, n: number }>} */
  const by = new Map();
  bag.forEach((id, i) => {
    const key = stackKey(id);
    const s = by.get(key);
    if (s) s.n++; else by.set(key, { key, id, i, n: 1 });
  });
  return [...by.values()];
}
