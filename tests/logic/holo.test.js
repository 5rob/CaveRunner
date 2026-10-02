// The background hologram's count: every living creature on a real floor, not the rat nests
// themselves but the rats still inside them (v125: a nest's fixed brood), not the dead, plus one
// for you while you're out in the level.
const G = require('../load');
const { makeLevel, bioCount } = G;

let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

for (const floor of [1, 3, 6]) {
  const L = makeLevel(1234 + floor, floor);
  const living = L.enemies.filter(e => e.k.act !== 'nest').length + L.enemies.reduce((s, e) => s + (e.nest ? e.nest.left : 0), 0);
  check(`floor ${floor}: in the shop it counts the creatures`, bioCount(L.enemies, false) === living, { living });
  check(`floor ${floor}: out in the level it's one more`, bioCount(L.enemies, true) === living + 1);
}
const L = makeLevel(99, 4);
const nests = L.enemies.filter(e => e.k.act === 'nest').length;
const inside = L.enemies.reduce((s, e) => s + (e.nest ? e.nest.left : 0), 0);
check('a rat nest counts its rats inside, not itself', bioCount(L.enemies, false) === L.enemies.length - nests + inside, { nests, inside, all: L.enemies.length });
const dead = L.enemies.map(e => Object.assign({}, e, { dead: true }));
check('everything dead and you in the shop: zero', bioCount(dead, false) === 0);
check('an empty floor with you out: one', bioCount([], true) === 1);

// the flash on a kill (v116): it rests dark, and fades along a bezier curve from full to nothing
const { bezierFade, DEV_DEFAULTS } = G;
check('it rests at brightness 0 (no hologram work at all)', DEV_DEFAULTS.holoMin === 0 && DEV_DEFAULTS.holoMax > 0);
check('the fade starts full and ends at nothing', bezierFade(0, 0.25, 1, 0.5, 0) === 1 && bezierFade(1, 0.25, 1, 0.5, 0) === 0);
const lin = [0.1, 0.3, 0.5, 0.9].map(u => bezierFade(u, 1 / 3, 2 / 3, 2 / 3, 1 / 3));
check('handles on the straight line: a straight fade', lin.every((v, i) => Math.abs(v - (1 - [0.1, 0.3, 0.5, 0.9][i])) < 0.002), lin);
const curve = [];
for (let u = 0; u <= 1.0001; u += 0.05) curve.push(bezierFade(u, 0.25, 1, 0.5, 0));
check('the default only ever falls', curve.every((v, i) => i === 0 || v <= curve[i - 1] + 1e-9), curve.map(v => v.toFixed(2)));
check('and holds bright at first', curve[2] > 0.9, curve[2]);
check('a handle above the top overshoots', Math.max(...[0.1, 0.2, 0.3].map(u => bezierFade(u, 0.2, 1.5, 0.6, 0))) > 1);
check('past the end it stays at 0, before the start at 1', bezierFade(5, 0.25, 1, 0.5, 0) === 0 && bezierFade(-1, 0.25, 1, 0.5, 0) === 1);

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
