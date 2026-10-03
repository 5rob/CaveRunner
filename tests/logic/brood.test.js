// The "biological entities detected" count (bioCount) only ever goes down (v125). Each rat nest
// holds a fixed brood (nest.left, Dev: raBrood), counted while still inside; letting a rat out
// moves it from inside to out without changing the count, so it no longer bounces back up as
// nests refill. Also: the Dev knobs for the enemy count and the level reward.
const G = require('../load');
const { makeLevel, bioCount, nestMove, DEV, DEV_DEFAULTS, readSave, VERSION, ENEMY_COUNT, LVL_BUY, LVL_SELL, lvlSell } = G;

let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

// ---- a real floor-1 cave ----
const lv = makeLevel(4242, 1);
const nests = lv.enemies.filter(e => e.nest);
check('floor 1 has nests', nests.length > 0, nests.length);
check('each nest holds a brood within the Dev range',
  nests.every(n => n.nest.left >= DEV.raBroodLo && n.nest.left <= DEV.raBroodHi), nests.map(n => n.nest.left));
const live = lv.enemies.filter(e => !e.nest).length, inside = nests.reduce((s, n) => s + n.nest.left, 0);
check('the count is the creatures plus the rats still inside', bioCount(lv.enemies, false) === live + inside,
  [bioCount(lv.enemies, false), live, inside]);
check('and you, while you are out in the level', bioCount(lv.enemies, true) === live + inside + 1);

// ---- a nest letting its rats out: the count holds; a kill takes it down; it never goes back up ----
const W = { enemies: lv.enemies, floor: 1, time: 0 };
const nest = nests[0];
let n0 = bioCount(W.enemies, false), up = 0, spawned = 0;
const brood = nest.nest.left;
for (let i = 0; i < 400; i++) {
  const before = W.enemies.length;
  nestMove(W, {}, nest, { dt: 0.5, dist: 0 });
  if (W.enemies.length > before) spawned++;
  // kill a rat now and then, as you would
  if (i % 5 === 4) { const r = W.enemies.findIndex(e => e.home === nest); if (r >= 0) W.enemies.splice(r, 1); }
  const n = bioCount(W.enemies, false);
  if (n > n0) up++;
  n0 = n;
}
check('a nest lets out exactly its brood, then no more', spawned === brood && nest.nest.left === 0, { spawned, brood, left: nest.nest.left });
check('the count never went up', up === 0, up);
check('every rat killed took the count down to what is left outside the nest',
  bioCount(W.enemies, false) === W.enemies.filter(e => !e.nest).length + nests.reduce((s, q) => s + q.nest.left, 0));

// ---- the autosave keeps each nest's brood ----
const save = readSave(JSON.stringify({ ver: VERSION, floor: 1, loadout: { guns: G.startingGuns(), sel: 0, gold: 10 }, level: { seed: 1, owned: [], alive: null, sold: [], rooms: [],
  pickups: null, brood: [[3, 5], [4, 0], ['x', 2], [5, -1]] } }));
check('a save reads back the nests\' broods (and drops junk)', JSON.stringify(save.level.brood) === '[[3,5],[4,0]]', save.level.brood);

// ---- the Dev knobs: how many enemies, and the level's reward ----
check('enemies on floor 1 defaults to the old count, +12 a floor', DEV_DEFAULTS.enemies === ENEMY_COUNT && DEV_DEFAULTS.enemiesUp === 12);
const was = DEV.enemies;
DEV.enemies = 5;
const few = makeLevel(4242, 1).enemies.filter(e => !e.nest).length;
DEV.enemies = was;
check('the enemies knob sets how many a new level gets', few === 5, few);
check('the reward defaults to ten thousand', DEV_DEFAULTS.lvlBonus === LVL_SELL - LVL_BUY && lvlSell() === LVL_SELL);
DEV.lvlBonus = 250000;
check('and the sell price follows the knob', lvlSell() === LVL_BUY + 250000);
DEV.lvlBonus = DEV_DEFAULTS.lvlBonus;

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
