// Grem Mode taps (owner, v1.0.101/102; src/auto/level.js levelWaypoint, art/titlescene.js goalStep, src/auto/chests.js chestAt): a
// tap that isn't a chest or a creature gives the picked player a goal the autopilot heads for (round or through rock as ever); a
// new tap moves it; there he holds it DEV.autoCtlWait s, then plays by himself again. A chest opens at a tap on it from any
// distance. Every loop has a frame cap.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV, dt = 1 / 30;
const keep = { g: D.autoFoeGap0, c0: D.autoFoeCap0, c1: D.autoFoeCap1, e: D.autoFoeElites };
D.autoFoeGap0 = 999; D.autoFoeCap0 = 0; D.autoFoeCap1 = 0; D.autoFoeElites = 0;
const until = (S, done, cap) => { for (let i = 0; i < cap; i++) { if (done(S)) return i; G.titleStep(S, dt); } return done(S) ? cap : -1; };

const run = G.gremRun(G.gremKitLoad());
const S = G.levelScene(190, 51, run.players.length, undefined, run.players, 1, run, true), L = G.levelState(S);
until(S, () => L.phase === 'run', 600);
const r = S.runners[0], mid = () => ({ x: S.scroll + r.x + G.PW / 2, y: r.y + G.PH / 2 });

const goal = () => r.goal;
const near = (gx, gy) => Math.hypot(mid().x - gx, mid().y - gy) < 9;

// a spot ahead, on the floor (as a tap on the ground): the autopilot flies him there
const m0 = mid(), gx = m0.x + 70, gy = G.titleFloor(gx, S) - G.PH / 2 - 2;
G.levelWaypoint(S, 0, gx, gy);
check('a tap: the goal set on the picked player, the view following him (levelLead)', !!goal() && goal().x === gx && G.levelLead(S) === r);
const f1 = until(S, () => near(gx, gy), 400);
check('he gets there on the autopilot (no stick)', f1 >= 0 && !G.ctlOn(r), [f1, Math.round(mid().x - gx), Math.round(mid().y - gy)]);
// (owner v1.0.103) there: no wait, the goal is gone and he plays by himself again at once
check('… there: the goal is gone at once, he plays by himself again (no wait)', until(S, () => !goal(), 10) >= 0 && G.levelLead(S) === null);

// up in the air; a new tap moves it
const m2 = mid();
G.levelWaypoint(S, 0, m2.x + 40, m2.y - 40);
for (let i = 0; i < 10; i++) G.titleStep(S, dt);
const m3 = mid(), tx = m3.x + 30, ty = Math.max(S.top + 30, m3.y - 30);
G.levelWaypoint(S, 0, tx, ty);
check('a new tap moves the goal', goal().x === tx && goal().y === ty);
check('he gets to the new one (flying up to it)', until(S, () => near(tx, ty), 400) >= 0, [Math.round(mid().x - tx), Math.round(mid().y - ty)]);
G.levelWaypoint(S, 0, null);
check('null clears it (the stick took over)', !goal());

// a spot inside the rock under the floor: he saws down into it (as the autopilot saws anywhere it's going)
const m5 = mid(), rx = m5.x + 30, ry = G.titleFloor(rx, S) + 14;
G.levelWaypoint(S, 0, rx, ry);
let sawed = false;
const f5 = until(S, s => { if (r.dig) sawed = true; return near(rx, ry); }, Math.round(D.gremWayT / dt));
check('a spot in the rock: he saws his way to it', sawed && f5 >= 0, [sawed, f5, Math.round(mid().x - rx), Math.round(mid().y - ry)]);
G.levelWaypoint(S, 0, null);

// one he can never get to (over the level): let go after gremWayT
G.levelWaypoint(S, 0, mid().x + 20, S.top - 400);   // (over the top of the level: never reachable)
const f6 = until(S, () => !goal(), Math.round((D.gremWayT + 2) / dt));
check('out of reach: let go after gremWayT', f6 >= Math.round(D.gremWayT / dt) - 2 && f6 <= Math.round(D.gremWayT / dt) + 2, f6);

// a chest far ahead opens at a tap on it
const ch = L.chests.find(c => !c.open && c.x > mid().x + 100);
if (ch) {
  const cy = (ch.y == null ? G.titleFloor(ch.x, S) : ch.y) - 6;
  check('a chest far from everyone: not in reach', G.chestInRange(S) !== ch);
  const at = G.chestAt(S, ch.x + 5, cy - 3, D.gremChestTapR);
  check('a tap on it finds it', at === ch);
  check('… and opens it', G.chestOpen(S, at) && ch.open);
  check('a tap away from any chest finds none', G.chestAt(S, mid().x, S.top + 10, D.gremChestTapR) === null);
} else check('a chest ahead to tap', false);

Object.assign(D, { autoFoeGap0: keep.g, autoFoeCap0: keep.c0, autoFoeCap1: keep.c1, autoFoeElites: keep.e });
console.log(fails ? fails + ' FAILED' : 'all ok');
process.exit(fails ? 1 : 0);
