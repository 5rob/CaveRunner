// CaveRunner Auto's drops (src/auto/loot.js, AUTOBATTLER.md stage 6 part 2): killLoot's rates over many rolls, and in a
// level: a kill's drops are vacuumed into the run's bag; with the bag full they wait on the ground. Every loop is capped.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV, dt = 1 / 30;
const keep = { m: D.autoLvlMin, e: D.autoFoeElites, mod: D.autoLootMod, b: D.autoLvlBossT, d: D.autoFoeDmg };

// ---- the rates ----
let s = 7;
const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
const N = 20000, count = (kind, k) => { let c = 0; for (let i = 0; i < N; i++) c += G.killLoot(kind, 3, rnd).filter(it => it.kind === k).length; return c; };
const foes = Array.from({ length: N }, () => G.killLoot('foe', 3, rnd));
check('every kill drops gold', foes.every(l => l.some(it => it.kind === 'gold' && it.n >= 1)));
check('gold × the tier\'s gold scale', G.killLoot('foe', 5, () => 0)[0].n === Math.round(G.goldScale(5)), [G.killLoot('foe', 5, () => 0)[0].n, G.goldScale(5)]);
const modRate = foes.filter(l => l.some(it => it.kind === 'mod')).length / N * 100;
check('a gun mod at about autoLootMod %', Math.abs(modRate - D.autoLootMod) < 1, [modRate, D.autoLootMod]);
check('the mods are real ones', foes.flat().filter(it => it.kind === 'mod').every(it => G.MODS[it.id]));
check('a plain kill drops no gems or exo mods', foes.flat().every(it => it.kind === 'gold' || it.kind === 'mod'));
const els = Array.from({ length: N }, () => G.killLoot('elite', 3, rnd));
check('an elite drops autoLootRed red gems', els.every(l => l.some(it => it.kind === 'red' && it.n === D.autoLootRed)));
const exoRate = els.filter(l => l.some(it => it.kind === 'exo')).length / N * 100;
check('… and an exo mod at about autoLootExo %', Math.abs(exoRate - D.autoLootExo) < 1.5, [exoRate, D.autoLootExo]);
check('… of the run\'s tier, every category', els.flat().filter(it => it.kind === 'exo').every(it => it.tier === 3) &&
  G.EXO_CATS.every(c => els.flat().some(it => it.kind === 'exo' && it.cat === c)));
const bs = Array.from({ length: 500 }, () => G.killLoot('boss', 3, rnd));
check('the boss: a green gem and an exo mod every time', bs.every(l => l.some(it => it.kind === 'green' && it.n === 1) && l.some(it => it.kind === 'exo')));
check('… and its gold × autoLootBossGold', G.killLoot('boss', 1, () => 0, 4)[0].n === 4 * D.autoLootBossGold);
check('mods: rarer than gold, more common than green (one green a level)', modRate < 100 && modRate * 30 / 100 > 1, modRate);

// ---- in a level: drops into the bag ----
D.autoLvlMin = 0.25; D.autoFoeElites = 0; D.autoLvlBossT = 600; D.autoFoeDmg = 0; D.autoLootMod = 100;
const until = (S, done, cap) => { for (let i = 0; i < cap; i++) { if (done(S)) return i; G.titleStep(S, dt); } return done(S) ? cap : -1; };
const run = G.newRun(5);
const S = G.levelScene(190, 33, 1, G.levelPlan(33, undefined, 0), run.players, 2, run);
const L = G.levelState(S);
check('the team is in', until(S, s => L.phase === 'run', 600) >= 0);
const r0 = S.runners[0];
const mods0 = G.bagCount(run, 'mod'), gold0 = G.bagCount(run, 'gold');
const foe = G.titleFoeAt(S, G.eliteOf(G.enemyFor('rotta', 2), 0.5), S.scroll + r0.x + 30);
G.titleKill(S, foe);
check('the kill threw out pickups (a mod, red gems)', (S.loot || []).length >= 2, (S.loot || []).map(g => g.it.kind));
const took = until(S, s => !(s.loot || []).length, 300);
check('they flew to him and into the bag', took >= 0 && G.bagCount(run, 'mod') > mods0 && G.bagCount(run, 'red') === D.autoLootRed, [took, G.bagCount(run, 'mod'), G.bagCount(run, 'red')]);
check('the bag view is told (bagV)', L.bagV >= 2, L.bagV);
until(S, s => !s.coins.length, 300);
check('the gold too', G.bagCount(run, 'gold') > gold0, G.bagCount(run, 'gold'));

// ---- a full bag: they wait ----
for (let i = 0; i < run.bag.length; i++) run.bag[i] = { kind: 'perk', id: 'x' + i, n: 1 };
const f2 = G.titleFoeAt(S, G.enemyFor('rotta', 2), S.scroll + r0.x + 160);     // well ahead: a drop left behind off-screen is lost
G.titleKill(S, f2);
const n2 = (S.loot || []).length;
until(S, () => false, 45);
check('the bag full: the drop waits on the ground', n2 >= 1 && (S.loot || []).length === n2 && S.loot.every(g => g.wait), [n2, (S.loot || []).length]);
run.bag[3] = null;
// (any kind: the drop is random, a mod, a gem or an exo mod; it was 'mod' only and flaked)
const came = until(S, s => !(s.loot || []).length, 300);
check('a slot frees: it comes in', came >= 0 && !!run.bag[3] && run.bag[3].kind !== 'perk', [came, run.bag[3] && run.bag[3].kind]);

// ---- the menu is unchanged: no loot ----
const Sm = G.titleScene(190, 21);
until(Sm, s => s.foes.length > 0, 600);
if (Sm.foes[0]) G.titleKill(Sm, Sm.foes[0]);
check('the menu drops gold only', !(Sm.loot || []).length && Sm.coins.length > 0);

Object.assign(D, { autoLvlMin: keep.m, autoFoeElites: keep.e, autoLootMod: keep.mod, autoLvlBossT: keep.b, autoFoeDmg: keep.d });
console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
