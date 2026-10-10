// CaveRunner Auto's chests (src/auto/chests.js, AUTOBATTLER.md stage 11): placement over many seeds (count, never on
// the pads, in the arena or inside a blockage), the contents' weights over many rolls, and in a level: in range → the
// prompt (chestInRange) and the pilot slows; A (chestOpen) → it opens, spills, and the contents reach the bag. Capped loops.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV, dt = 1 / 30;
const keep = { m: D.autoLvlMin, e: D.autoFoeElites, b: D.autoLvlBossT, d: D.autoFoeDmg };

// ---- placement ----
let bad = [], counts = [];
for (let seed = 1; seed <= 60; seed++) {
  const P = G.levelPlan(seed * 97 + 3, 5, 2), C = G.chestPlan(P);
  counts.push(C.length);
  for (const c of C) {
    const why = c.x < P.z0 + 20 ? 'start pad' : c.x > P.arena.x0 - 20 ? 'arena / exit' :
      P.zp.z.some(Z => Z.blk && c.x >= Z.blk.x0 && c.x <= Z.blk.x1) ? 'blockage' : '';
    if (why) bad.push([seed, Math.round(c.x), why]);
  }
}
check('autoChestN (3) chests a 5-minute level, nearly always', counts.filter(n => n === D.autoChestN).length >= 55, counts.join(''));
check('never on the start pad, in the arena, on the exit pad or inside a blockage', bad.length === 0, bad.slice(0, 5));
const P1 = G.levelPlan(41, 5, 2);
check('same seed, same chests', JSON.stringify(G.chestPlan(P1)) === JSON.stringify(G.chestPlan(G.levelPlan(41, 5, 2))));
check('spread along the level', (() => { const C = G.chestPlan(P1); return C.length === 3 && C[2].x - C[0].x > P1.len * 0.4; })());
check('the count is a knob', G.chestPlan(P1, 6).length === 6 && G.chestPlan(P1, 0).length === 0);

// ---- contents ----
let s = 9;
const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
const N = 20000, by = {};
for (let i = 0; i < N; i++) { const it = G.chestRoll(rnd, 2); check.n = it.length; const k = it[0].kind; by[k] = (by[k] || 0) + 1; }
const pc = k => (by[k] || 0) / N * 100, W = { gold: D.autoChestGold, mod: D.autoChestMod, exo: D.autoChestExo, red: D.autoChestRed, perk: D.autoChestPerk, green: D.autoChestGreen };
const tot = Object.values(W).reduce((a, v) => a + v, 0);
check('each kind at about its weight', Object.keys(W).every(k => Math.abs(pc(k) - W[k] / tot * 100) < 1.2), Object.keys(W).map(k => [k, pc(k).toFixed(1)]));
check('perk and green are the rare ones', pc('perk') < pc('red') && pc('green') < pc('red'));
const sample = Array.from({ length: 400 }, () => G.chestRoll(rnd, 2)[0]);
check('real items: mods, exo mods of the tier, named perks', sample.every(it => it.kind !== 'mod' || G.MODS[it.id]) &&
  sample.every(it => it.kind !== 'exo' || it.tier === 2) && sample.every(it => it.kind !== 'perk' || (G.PERKS[it.id] && !G.PERKS[it.id].stat)));
check('gold: about autoChestGoldN × the gold scale', sample.filter(it => it.kind === 'gold').every(it => it.n >= 0.7 * D.autoChestGoldN * G.goldScale(2) && it.n <= 1.3 * D.autoChestGoldN * G.goldScale(2)));
const keepW = { ...W };
Object.assign(D, { autoChestGold: 0, autoChestMod: 0, autoChestExo: 0, autoChestRed: 0, autoChestPerk: 0, autoChestGreen: 1 });
check('the weights are knobs (only green)', Array.from({ length: 50 }, () => G.chestRoll(rnd, 1)[0]).every(it => it.kind === 'green'));
Object.assign(D, { autoChestGold: keepW.gold, autoChestMod: keepW.mod, autoChestExo: keepW.exo, autoChestRed: keepW.red, autoChestPerk: keepW.perk, autoChestGreen: keepW.green });

// ---- in a level ----
D.autoLvlMin = 0.5; D.autoFoeElites = 0; D.autoLvlBossT = 600; D.autoFoeDmg = 0;
const until = (S, done, cap) => { for (let i = 0; i < cap; i++) { if (done(S)) return i; G.titleStep(S, dt); } return done(S) ? cap : -1; };
const run = G.newRun(5);
const S = G.levelScene(190, 33, 1, G.levelPlan(33, undefined, 0), run.players, 2, run);
const L = G.levelState(S);
check('the level has its chests', L.chests.length === D.autoChestN && L.chests.every(c => !c.open), L.chests.map(c => Math.round(c.x)));
check('the team is in', until(S, () => L.phase === 'run', 600) >= 0);
check('no chest in range at the start', G.chestInRange(S) === null);
check('A with none in range does nothing', G.chestOpen(S) === false);
const c0 = L.chests[0];
// a team of starters is stopped at the first wall (stage 5b): bring the chest to it, by the scroll
const goTo = c => { const r = S.runners[0]; S.scroll = Math.max(S.scroll, c.x - r.x - G.PW / 2 - 10); return until(S, () => G.chestInRange(S) === c, 60); };
check('the team reaches the first chest (capped)', goTo(c0) >= 0, [Math.round(G.levelTeamX(S)), Math.round(c0.x)]);
until(S, () => !!c0.set, 30);
check('… it is that one, on the ground', G.chestInRange(S) === c0 && c0.set && G.titleSolid(S, c0.x - S.scroll, c0.y + 1) && !G.titleSolid(S, c0.x - S.scroll, c0.y - 2), [c0.y]);
const want = G.pilotPace({ x: G.levelTeamX(S), stopX: null, chests: L.chests });
check('the pilot slows by it', want < D.autoLvlPace && want === D.autoLvlPace * D.autoLvlChest, want);
D.autoChestGold = 0; D.autoChestGreen = 0; D.autoChestPerk = 0; D.autoChestRed = 0; D.autoChestExo = 0; D.autoChestMod = 1;
const mods0 = G.bagCount(run, 'mod'), loot0 = (S.loot || []).length;
check('A opens it', G.chestOpen(S) === true && c0.open && c0.items.length === 1 && c0.items[0].kind === 'mod');
check('… its contents spill out (a pickup thrown up)', (S.loot || []).length === loot0 + 1 && S.loot[S.loot.length - 1].vy < 0);
check('… no longer in range, the pilot no longer slows for it', G.chestInRange(S) !== c0 && G.pilotPace({ x: c0.x, stopX: null, chests: [c0] }) === D.autoLvlPace);
check('… and it reaches the bag', until(S, () => G.bagCount(run, 'mod') > mods0, 300) >= 0, G.bagCount(run, 'mod'));
Object.assign(D, { autoChestGold: keepW.gold, autoChestMod: 0 });
const c1 = L.chests[1], gold0 = G.bagCount(run, 'gold');
check('the next chest comes in range', goTo(c1) >= 0);
check('gold spills as nuggets', G.chestOpen(S) && c1.items[0].kind === 'gold' && S.coins.length > 0);
check('… and is vacuumed into the bag', until(S, () => G.bagCount(run, 'gold') > gold0, 300) >= 0, [G.bagCount(run, 'gold'), gold0]);
Object.assign(D, { autoChestMod: keepW.mod });

D.autoLvlMin = keep.m; D.autoFoeElites = keep.e; D.autoLvlBossT = keep.b; D.autoFoeDmg = keep.d;
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
