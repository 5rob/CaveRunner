// A boss under the ground (owner, v1.0.103: one came in under the level's floor, out of reach, and the level stuck):
// auto/enemies.js unbury puts a creature whose middle is in rock or under the floor's line back on the floor; levelFoes keeps
// the arena's boss and the elites out of the rock, and the team kills a boss that came in buried. The elites' flames
// (art/titlescene.js stepEliteFx, the old game's): specks off every elite, none off a plain creature. Frame caps everywhere.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV, dt = 1 / 30;
const keep = { m: D.autoLvlMin, g: D.autoFoeGap0, c0: D.autoFoeCap0, c1: D.autoFoeCap1, e: D.autoFoeElites, hp: D.autoBossHp };
D.autoLvlMin = 0.25; D.autoFoeGap0 = 999; D.autoFoeCap0 = 0; D.autoFoeCap1 = 0; D.autoFoeElites = 0; D.autoBossHp = 1;
const until = (S, done, cap) => { for (let i = 0; i < cap; i++) { if (done(S)) return i; G.titleStep(S, dt); } return done(S) ? cap : -1; };

// the rule
const run = G.newRun(4);
run.players[0].hp = 1e6;
const S = G.levelScene(190, 61, 1, undefined, run.players, 1, run), L = G.levelState(S);
until(S, () => L.phase === 'run', 600);
const x = S.scroll + 150, fy = G.titleFloor(x, S);
const f = G.titleFoeAt(S, G.bossKind('hiisi', 1), x);
f.y = f.ty = fy + 30;
G.unbury(S, f);
check('a creature under the floor goes back onto it', Math.abs(f.y - (fy - f.r - 1)) < 1.5 || f.y < fy, [Math.round(f.y), Math.round(fy), f.r]);
const y0 = f.y;
G.unbury(S, f);
check('one in the open is left be', f.y === y0);
S.foes.length = 0;

// a buried boss in the arena: unburied, and the team finishes it (the level goes on)
until(S, () => L.phase === 'arena', 30 * 120);
check('the team reached the arena', L.phase === 'arena', L.phase);
until(S, () => !!L.boss, 60);
const B = L.boss;
if (B) {
  B.y = B.ty = G.titleFloor(B.x, S) + 40;   // as if it came in under the ground
  G.titleStep(S, dt);
  check('the boss put under the ground is back on the floor', B.y < G.titleFloor(B.x, S), [Math.round(B.y), Math.round(G.titleFloor(B.x, S))]);
  check('… and the team kills it (the level doesn\'t stick)', until(S, () => L.bossDead, 30 * 40) >= 0, B.hp);
} else check('a boss came in', false);

// the elites' flames
const S2 = G.levelScene(190, 62, 1, undefined, run.players, 1, run);
until(S2, () => G.levelState(S2).phase === 'run', 600);
S2.foes.length = 0;
G.titleFoeAt(S2, G.autoFoe('meduusa', 1), S2.scroll + 200);
for (let i = 0; i < 30; i++) G.titleStep(S2, dt);
check('no flames off a plain creature', !(S2.eliteFx && S2.eliteFx.length), S2.eliteFx && S2.eliteFx.length);
S2.foes.length = 0;
const el = G.titleFoeAt(S2, G.eliteOf(G.autoFoe('meduusa', 1), 0.5), S2.scroll + 200);
el.hp = el.hpMax = 1e6;
for (let i = 0; i < 30; i++) G.titleStep(S2, dt);
const n = (S2.eliteFx || []).length;
check('an elite gives off flames (about elFxRate a second)', n > 0 && n <= G.DEV.elFxRateHi * 1.2 + 5, [n, G.DEV.elFxRateLo, G.DEV.elFxRateHi]);
check('… rising from its body', (S2.eliteFx || []).every(q => Math.abs(q.x - el.x) < 120), null);

Object.assign(D, { autoLvlMin: keep.m, autoFoeGap0: keep.g, autoFoeCap0: keep.c0, autoFoeCap1: keep.c1, autoFoeElites: keep.e, autoBossHp: keep.hp });
console.log(fails ? fails + ' FAILED' : 'all ok');
process.exit(fails ? 1 : 0);
