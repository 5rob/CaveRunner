// (owner v1.0.74) tall levels: the auto players roam the top and middle of the cave too, not just its floor
// (art/titlescene.js roamGoal: a team height goal, DEV.autoRoamT / autoRoamHi / autoRoamMid / autoRoamFly)
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV;
const share = (seed, hi, mid) => {
  const k = { h: D.autoRoamHi, m: D.autoRoamMid, e: D.autoFoeElites, c: D.autoChestN };
  D.autoRoamHi = hi; D.autoRoamMid = mid; D.autoFoeElites = 0; D.autoChestN = 0;
  const S = G.levelScene(560, seed, 3, G.levelPlan(seed, undefined, 0)), dt = 1 / 30;
  const n = [0, 0, 0];
  for (let f = 0; f < 30 * 60; f++) {
    G.titleStep(S, dt);
    S.foes.length = 0;   // (no fights: only where they roam)
    if (G.levelState(S).phase !== 'run') continue;
    for (const r of S.runners) if (!r.out && !r.hide) n[Math.max(0, Math.min(2, Math.floor((r.y - S.top) / ((S.bot - S.top) / 3))))]++;
  }
  Object.assign(D, { autoRoamHi: k.h, autoRoamMid: k.m, autoFoeElites: k.e, autoChestN: k.c });
  const t = n[0] + n[1] + n[2] || 1;
  return n.map(v => +(v / t).toFixed(2));
};
const a = share(21, D.autoRoamHi, D.autoRoamMid), b = share(5, D.autoRoamHi, D.autoRoamMid);
console.log('top / middle / bottom thirds:', a, b);
// (measured: before roamGoal 0.07 and 0.18 of the time up there; with it 0.55 and 0.28: the rock above often stops them)
check('the top and middle thirds get a real share of the time (a minute, two seeds)', a[0] + a[1] > 0.22 && b[0] + b[1] > 0.22 && a[0] + a[1] + b[0] + b[1] > 0.6, [a, b]);
const low = share(21, 0, 0);
check('goals all at the bottom: they keep lower than with the defaults', low[2] > a[2], [low, a]);
console.log(fails ? `\n${fails} failed` : '\nall ok');
process.exit(fails ? 1 : 0);
