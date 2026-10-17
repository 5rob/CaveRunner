// (owner, v2.0.17: "streamline the flow between level - boss - level") Grem: the fight starts as the team enters the arena
// (the boss's title at once, it hunts gremBossT s later), and the next level follows the boss's death within gremClearWait s
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV, dt = 1 / 30; D.autoLvlMin = 0.25; D.autoFoeElites = 0; D.autoFoeDmg = 0;
for (const seed of [3, 24, 81]) {
  const run = G.newRun(seed);
  const S = G.levelScene(190, seed, 1, undefined, run.players, 1 + seed % 4, run, true), L = G.levelState(S);
  let t = 0, enter = null, a = null, h = null, d = null, o = null;
  for (let i = 0; i < 30 * 120; i++) {
    G.titleStep(S, dt); t += dt;
    if (enter == null && G.levelTeamX(S) >= L.plan.arena.x0) enter = t;
    if (a == null && L.phase === 'arena') a = t;
    if (h == null && L.boss && L.introDone) { h = t; L.boss.hp = Math.min(L.boss.hp, 2); }
    if (d == null && L.bossDead) d = t;
    if ((L.ups || 0) >= 1) { o = t; break; }
  }
  check(`seed ${seed}: the fight starts on entering the arena`, a != null && Math.abs(a - enter) < 0.1, [enter, a]);
  check(`seed ${seed}: the boss hunts gremBossT s later`, h != null && h - a < D.gremBossT + 0.3, h && h - a);
  check(`seed ${seed}: the next level within gremClearWait s of its death`, o != null && d != null && o - d < D.gremClearWait + 0.2, [d, o]);
}
process.exit(fails ? 1 : 0);
