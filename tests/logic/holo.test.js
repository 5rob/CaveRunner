// The background hologram's count: every living creature on a real floor, not the rat nests,
// not the dead, plus one for you while you're out in the level.
const G = require('../load');
const { makeLevel, bioCount } = G;

let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

for (const floor of [1, 3, 6]) {
  const L = makeLevel(1234 + floor, floor);
  const living = L.enemies.filter(e => e.k.act !== 'nest').length;
  check(`floor ${floor}: in the shop it counts the creatures`, bioCount(L.enemies, false) === living, { living });
  check(`floor ${floor}: out in the level it's one more`, bioCount(L.enemies, true) === living + 1);
}
const L = makeLevel(99, 4);
const nests = L.enemies.filter(e => e.k.act === 'nest').length;
check('rat nests are not counted', bioCount(L.enemies, false) === L.enemies.length - nests, { nests, all: L.enemies.length });
const dead = L.enemies.map(e => Object.assign({}, e, { dead: true }));
check('everything dead and you in the shop: zero', bioCount(dead, false) === 0);
check('an empty floor with you out: one', bioCount([], true) === 1);

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
