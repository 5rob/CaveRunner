// CaveRunner Auto (feedback round 1): one starter gun finishes a full-health boss before the arena's fallback
// (DEV.autoLvlBossT), on a few seeds. The team takes no damage (autoFoeDmg 0) so the run measures only the kill.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV, dt = 1 / 30;
D.autoLvlMin = 0.25; D.autoLvlBossT = 600; D.autoFoeElites = 0; D.autoFoeDmg = 0;
const digger = r => { r.players[0].guns[1] = { name: 'd', cap: 1, castDelay: 0.2, recharge: 0.5, manaMax: 200, manaRegen: 60, spread: 0, multi: 1, shuffle: false, speedMul: 1, mana: 200, slots: ['saw'] }; return r.players; };
for (const seed of [24, 31, 66]) {
  const run = G.newRun(seed);
  const S = G.levelScene(190, seed, 1, G.levelPlan(seed), digger(run), 1), L = G.levelState(S);
  for (let i = 0; i < 8000 && L.phase !== 'arena'; i++) G.titleStep(S, dt);
  for (let t = 0; t < 110 * 30 && !L.bossDead; t++) G.titleStep(S, dt);
  check(`seed ${seed}: the starter gun kills the boss inside 110 s (the fallback is 120)`, L.bossDead && S.t - L.arenaT < 110,
    [L.phase, +(S.t - L.arenaT).toFixed(1), L.boss && Math.round(L.boss.hp), L.boss && L.boss.hpMax]);
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
