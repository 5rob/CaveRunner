// The mod collection (src/spells/collection.js, save/save.js): the vending machine's grid groups
// every droppable mod by rarity, a red crystal unlocks one off its floor's drop table and never
// one you own, and the stored list reads back clean.
const G = require('../load');
const { ALL_IDS, modTiers, crystalRoll, modWeight, readCollection, tierOf } = G;
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

const tiers = modTiers();
const flat = tiers.flatMap(t => t.ids);
check('four rarity groups', tiers.length === 4 && tiers.every((t, i) => t.tier === i + 1));
check('every droppable mod has exactly one cell', flat.length === ALL_IDS.length && new Set(flat).size === ALL_IDS.length);
check('each in its own rarity', tiers.every(t => t.ids.every(id => tierOf(id) === t.tier)));

// seeded
let s = 7;
const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
for (const floor of [1, 3, 6, 10]) {
  const got = [];
  for (let i = 0; i < 40; i++) got.push(crystalRoll(rnd, floor, []));
  check(`floor ${floor}: only mods that drop there`, got.every(id => modWeight(id, floor) > 0), got.filter(id => modWeight(id, floor) <= 0));
}
// never one you own; once the floor's table is used up, any you don't; then null
const own = [];
for (let i = 0; i < ALL_IDS.length; i++) {
  const id = crystalRoll(rnd, 1, own);
  if (!id || own.includes(id)) { check('never rolls one you own', false, { i, id }); break; }
  own.push(id);
}
check('a crystal at a time unlocks the whole collection', own.length === ALL_IDS.length, own.length);
check('then nothing is left to unlock', crystalRoll(rnd, 1, own) === null);
const f1 = ALL_IDS.filter(id => modWeight(id, 1) > 0).length;
check('floor 1\'s own mods come first', own.slice(0, f1).every(id => modWeight(id, 1) > 0), f1);

check('the stored list reads back without junk or repeats',
  JSON.stringify(readCollection(JSON.stringify(['bolt', 'nope', 'bolt', 3, 'spark']))) === '["bolt","spark"]');
check('a broken store is an empty collection', readCollection('{') .length === 0 && readCollection(null).length === 0);

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
