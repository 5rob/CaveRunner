// Creatures keep off the players (owner, v1.0.100: a rat at a player's feet was too close to shoot, inside his gun's tip):
// in a level a creature stays DEV.autoFoeKeep units past its size from every player's middle (art/titlescene.js keepOff),
// its bite still reaches (biteReach), and the team shoots it. Every loop has a frame cap.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV, dt = 1 / 30;
const keep0 = { e: D.autoFoeElites, g: D.autoFoeGap0, c0: D.autoFoeCap0, c1: D.autoFoeCap1, d: D.autoFoeDmg };
D.autoFoeElites = 0; D.autoFoeGap0 = 999; D.autoFoeCap0 = 0; D.autoFoeCap1 = 0; D.autoFoeDmg = 1;

const run = G.newRun(3);
const S = G.levelScene(190, 21, 1, undefined, run.players, 1, run);
for (let i = 0; i < 150; i++) G.titleStep(S, dt);   // through the start pad
S.foes.length = 0;
const r = S.runners[0], pl = run.players[0];
pl.hp = 1e6;
const mid = () => ({ x: S.scroll + r.x + G.PW / 2, y: r.y + G.PH / 2 });
const rat = G.titleFoeAt(S, G.enemyFor('rotta', 1), mid().x + 2);
rat.hp = rat.hpMax = 1e6; rat.aggro = true;
const want = rat.r + D.autoFoeKeep;
let inside = 0;
const hp0 = pl.hp;
for (let i = 0; i < 300; i++) {
  G.titleStep(S, dt);
  if (!S.foes.includes(rat)) S.foes.push(rat);
  const m = mid();
  if (Math.hypot(rat.x - m.x, rat.y - m.y) < want - 1.5) inside++;
}
check('a hunting rat stays out of the gap (its size + autoFoeKeep from his middle; only as he lands on it, a few frames)', inside <= 9, [inside, 300]);
check('… and its bite still reaches him', pl.hp < hp0, [hp0, pl.hp]);

// the team shoots rats that come at it (none sits unshot at his feet)
S.foes.length = 0;
let killed = 0;
for (let n = 0; n < 6; n++) {
  const f = G.titleFoeAt(S, G.autoFoe('rotta', 1), mid().x + (n % 2 ? 8 : -6));
  f.aggro = true;
  for (let i = 0; i < 240 && f.hp > 0 && S.foes.includes(f); i++) G.titleStep(S, dt);
  if (f.hp <= 0) killed++;
  S.foes.length = 0;
}
check('rats put at his feet get shot (most of 6 within 8 s each)', killed >= 4, killed);

D.autoFoeKeep = 0;
const S0 = G.levelScene(190, 22, 1, undefined, run.players, 1, run);
for (let i = 0; i < 150; i++) G.titleStep(S0, dt);
S0.foes.length = 0;
const r0 = S0.runners[0], m0 = { x: S0.scroll + r0.x + G.PW / 2 };
const rat0 = G.titleFoeAt(S0, G.enemyFor('rotta', 1), m0.x + 2), x0 = rat0.x;
G.titleStep(S0, dt);
check('autoFoeKeep 0: off (nothing pushed)', Math.abs(rat0.x - x0) < 6, [x0, rat0.x]);
D.autoFoeKeep = 16;

Object.assign(D, { autoFoeElites: keep0.e, autoFoeGap0: keep0.g, autoFoeCap0: keep0.c0, autoFoeCap1: keep0.c1, autoFoeDmg: keep0.d });
console.log(fails ? fails + ' FAILED' : 'all ok');
process.exit(fails ? 1 : 0);
