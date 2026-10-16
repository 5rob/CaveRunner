// Grem Mode's tapped target (owner, v1.0.105: "tapped targets only aim the guns; it needs to make them travel that way and clear
// blockages to eliminate them"): auto/level.js pickChase gives every player a goal just short of it (the autopilot: round or
// through rock), kept while it lives; dead, the goals go. Every loop has a frame cap.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV, dt = 1 / 30;
const keep = { g: D.autoFoeGap0, c0: D.autoFoeCap0, c1: D.autoFoeCap1, e: D.autoFoeElites };
D.autoFoeGap0 = 999; D.autoFoeCap0 = 0; D.autoFoeCap1 = 0; D.autoFoeElites = 0;
const until = (S, done, cap) => { for (let i = 0; i < cap; i++) { if (done(S)) return i; G.titleStep(S, dt); } return done(S) ? cap : -1; };

const run = G.gremRun(G.gremKitLoad());
const S = G.levelScene(300, 91, run.players.length, undefined, run.players, 1, run, true), L = G.levelState(S);
until(S, () => L.phase === 'run' && S.t > 4, 900);
S.foes.length = 0;
const r = S.runners[0], mid = () => ({ x: S.scroll + r.x + G.PW / 2, y: r.y + G.PH / 2 });

// one out in the open, well ahead and up: he goes to it and shoots it
const m0 = mid();
const f = G.titleFoeAt(S, G.gremFoe('meduusa', 1), m0.x + 160);
f.hp = f.hpMax = 400; f.y = f.ty = f.hy = (G.titleCeil(f.x, S) + G.titleFloor(f.x, S)) / 2;
S.pick = f;
G.titleStep(S, dt);
check('a tapped target: a goal on him, just short of it', !!r.goal && r.goal.pick && Math.abs(r.goal.x - f.x) < f.r + 40, r.goal);
const d0 = Math.hypot(f.x - m0.x, f.ty - m0.y);
const got = until(S, () => Math.hypot(f.x - mid().x, f.ty - mid().y) < f.r + 45, 30 * 12);
check('he travels to it', got >= 0, [Math.round(d0), Math.round(Math.hypot(f.x - mid().x, f.ty - mid().y))]);
const hp0 = f.hp;
for (let i = 0; i < 90; i++) G.titleStep(S, dt);
check('… and shoots it', f.hp < hp0, [hp0, f.hp]);
f.hp = 0;
for (let i = 0; i < 3; i++) G.titleStep(S, dt);
check('dead: the chase is over, he plays by himself', !r.goal);

// one buried in the rock ahead: he saws his way toward it
S.foes.length = 0;
const m1 = mid(), bx = m1.x + 120, fl = G.titleFloor(bx, S);
const b = G.titleFoeAt(S, G.gremFoe('meduusa', 1), bx);
b.hp = b.hpMax = 1e6; b.y = b.ty = b.hy = fl + 30; b.je = undefined;
S.pick = b;
let sawed = false, best = Infinity;
for (let i = 0; i < 30 * 10; i++) {
  b.x = bx; b.y = b.ty = fl + 30;   // held in the rock
  G.titleStep(S, dt);
  if (r.dig) sawed = true;
  best = Math.min(best, Math.hypot(b.x - mid().x, b.ty - mid().y));
}
check('a target in the rock: he saws toward it', sawed && best < b.r + 50, [sawed, Math.round(best)]);
S.pick = null;
for (let i = 0; i < 3; i++) G.titleStep(S, dt);
check('let go: the chase is over', !r.goal);

Object.assign(D, { autoFoeGap0: keep.g, autoFoeCap0: keep.c0, autoFoeCap1: keep.c1, autoFoeElites: keep.e });
console.log(fails ? fails + ' FAILED' : 'all ok');
process.exit(fails ? 1 : 0);
