// Grem Mode's bosses come on screen every level (owner, v1.0.104: from level 2 on, the old floors' shooters and turrets stayed
// off screen to the right: auto/level.js levelOnward never reset L.introDone, so the boss made off screen never slid in).
// Three levels in a row: each boss, once its title is done, is on screen. Every loop has a frame cap.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV, dt = 1 / 30;
const keep = { m: D.autoLvlMin, g: D.autoFoeGap0, c0: D.autoFoeCap0, c1: D.autoFoeCap1, e: D.autoFoeElites };
D.autoLvlMin = 0.25; D.autoFoeGap0 = 999; D.autoFoeCap0 = 0; D.autoFoeCap1 = 0; D.autoFoeElites = 0;
const until = (S, done, cap) => { for (let i = 0; i < cap; i++) { if (done(S)) return i; G.titleStep(S, dt); } return done(S) ? cap : -1; };

const run = G.gremRun(G.gremKitLoad());
const S = G.levelScene(300, 81, run.players.length, undefined, run.players, 1, run, true), L = G.levelState(S);
for (let lv = 1; lv <= 3; lv++) {
  const got = until(S, () => !!L.boss, 30 * 180);
  if (got < 0) { check('level ' + lv + ': a boss came', false, L.phase); break; }
  const B = L.boss;
  until(S, () => !!L.introDone, Math.round((D.gremBossT + 1) / dt));
  for (let i = 0; i < 15; i++) G.titleStep(S, dt);
  const sx = B.x - S.scroll;
  check('level ' + lv + ' (' + B.k.name + ', ' + B.k.act + '): on screen after its title', sx > 0 && sx < G.TITLE_VW, Math.round(sx));
  B.hp = 0;
  until(S, () => L.phase === 'run' && !L.boss, 30 * 30);
}

Object.assign(D, { autoLvlMin: keep.m, autoFoeGap0: keep.g, autoFoeCap0: keep.c0, autoFoeCap1: keep.c1, autoFoeElites: keep.e });
console.log(fails ? fails + ' FAILED' : 'all ok');
process.exit(fails ? 1 : 0);
