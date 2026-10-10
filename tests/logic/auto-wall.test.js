// CaveRunner Auto (feedback round 1, the owner: no wall in the first 20 s, and not always at 20): each level makes sure
// of one of its blocked zones (blocked all the way) past its own random time (levelWallT from the seed); before it
// nothing blocks a team of starter guns.
// The team takes no damage (autoFoeDmg 0) so a lone starter player lives to reach it. Frame-capped.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV, dt = 1 / 30;
D.autoFoeDmg = 0;
const ts = [1, 2, 3, 4, 5, 6, 7, 8].map(s => G.levelWallT(s));
check('the wall time is random per level, inside the knobs', ts.every(t => t >= D.autoWallMin && t <= D.autoWallMax) && new Set(ts.map(t => t.toFixed(1))).size > 4, ts.map(t => +t.toFixed(1)));
check('same seed, same wall', G.levelPlan(9).wallX === G.levelPlan(9).wallX && G.levelPlan(9).wallX !== G.levelPlan(10).wallX);
for (const [seed, hold] of [[2, 0], [5, 0], [6, 1], [7, 1]]) {
  const run = G.newRun(seed, () => 0.4);
  const S = G.levelScene(190, seed, 1, G.levelPlan(seed), run.players, 1), L = G.levelState(S);
  let i = 0; for (; i < 30 * 90 && !L.blocked; i++) { L.hold = hold; G.titleStep(S, dt); }
  const t = S.t - L.goT, x = G.levelTeamX(S);
  check(`seed ${seed} ${hold ? 'hurrying' : 'normal pace'}: first blocked after 20 s, at the wall (its blocked zone)`, L.blocked && t >= 20 && x < L.plan.wallX + 130, [+t.toFixed(1), Math.round(x), Math.round(L.plan.wallX)]);
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
