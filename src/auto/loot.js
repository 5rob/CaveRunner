// @ts-check
// CaveRunner Auto's drops (stage 6 part 2, AUTOBATTLER.md stage 6 "Drops"), pure. killLoot: what a kill leaves,
// as BagItems: gold from every kill; a gun mod now and then (DEV.autoLootMod %, rolled by the tier's mod weights);
// an elite also red gems (+ sometimes an exo mod); the boss a green gem + an exo mod (+ its gold × a knob).
// The scene (art/titlescene.js, through level.js's hooks) throws them out as pickups and vacuums them into the bag.
import { DEV } from '../dev/knobs.js';
import { goldScale } from '../data/creatures.js';
import { STAT_PERKS } from '../data/perks.js';
import { rollMod } from '../spells/spawn.js';
import { MODS } from '../spells/mods.js';
import { EXO_CATS, EXO_STATS, exoMod, itemKey } from './run.js';

/** @typedef {'foe' | 'elite' | 'boss'} LootKind */

// What a kill drops. gold: the creature's own (enemyFor already scales it by goldScale(tier)); default 1 × the scale.
// Gold as the game drops it: its own and up to 2 more (× the tier's scale), × autoLootEliteGold / autoLootBossGold.
/** @param {LootKind} kind @param {number} tier @param {() => number} rnd @param {number} [gold] @returns {BagItem[]} */
export function killLoot(kind, tier, rnd, gold) {
  const sc = goldScale(tier), base = gold == null ? sc : gold;
  const mul = kind === 'boss' ? DEV.autoLootBossGold : kind === 'elite' ? DEV.autoLootEliteGold : 1;
  /** @type {BagItem[]} */
  const out = [{ kind: 'gold', n: Math.max(1, Math.round((base + Math.floor(rnd() * 3) * sc) * mul)) }];
  if (rnd() * 100 < DEV.autoLootMod) out.push({ kind: 'mod', id: rollMod(rnd, Math.max(1, tier)), n: 1 });
  const exo = () => exoMod(EXO_CATS[Math.floor(rnd() * EXO_CATS.length) % EXO_CATS.length], tier);
  if (kind === 'elite') {
    if (DEV.autoLootRed > 0) out.push({ kind: 'red', n: DEV.autoLootRed });
    if (rnd() * 100 < DEV.autoLootExo) out.push(exo());
  }
  if (kind === 'boss') out.push({ kind: 'green', n: 1 }, exo());
  return out;
}

// would the item go into the bag (onto its stack, or an empty slot)?
/** @param {AutoRun} run @param {BagItem} it */
export function bagFits(run, it) {
  const key = itemKey(it);
  return (!!key && run.bag.some(s => s && itemKey(s) === key)) || run.bag.indexOf(null) >= 0;
}

// a pickup's colour: the item's (the mod's, the exo category's tint, the gems')
/** @param {BagItem} it @returns {string} */
export function lootCol(it) {
  if (it.kind === 'mod') { const m = MODS[it.id || '']; return m ? m.col : '#cccccc'; }
  if (it.kind === 'exo') return STAT_PERKS[EXO_STATS[it.cat || 'hp'][0]].tint;
  if (it.kind === 'red') return '#ff4f5e';
  if (it.kind === 'green') return '#5ee05a';
  return '#ffc93c';
}
