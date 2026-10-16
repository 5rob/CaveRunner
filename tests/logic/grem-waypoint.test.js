// Grem Mode taps (owner, v1.0.101; src/auto/level.js levelWaypoint / wayStep, src/auto/chests.js chestAt): a tap that isn't
// a chest or a creature sends the picked player to that spot (steered as by the stick); a new tap moves it; once there he
// stands, and after DEV.autoCtlWait s with no input the autopilot has him again. A chest opens at a tap on it from any
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

// a spot ahead, on the floor (as a tap on the ground)
const m0 = mid(), gx = m0.x + 70, gy = G.titleFloor(gx, S) - 4;
G.levelWaypoint(S, 0, gx, gy);
check('a tap: the waypoint set for the picked player', L.way && L.way.id === 0 && L.way.x === gx);
const f1 = until(S, () => !L.way, 400);
const m1 = mid();
check('he gets there (on his own, steered)', f1 >= 0 && Math.abs(m1.x - gx) < 8, [f1, Math.round(m1.x - gx)]);
check('there: he stands (his stick let go)', !!r.ctl && !r.ctl.active && G.ctlOn(r));
// waits: not handed back before the idle wait, then the autopilot
const wait = Math.round(D.autoCtlWait / dt);
for (let i = 0; i < wait - 10; i++) G.titleStep(S, dt);
check('… still waiting just before the idle wait (autoCtlWait) is up', G.ctlOn(r), r.ctlIdle);
for (let i = 0; i < 20; i++) G.titleStep(S, dt);
check('… then the autopilot has him back', !G.ctlOn(r), r.ctlIdle);

// up in the air: he jets there; a new tap moves the spot
const m2 = mid();
G.levelWaypoint(S, 0, m2.x + 40, m2.y - 40);
for (let i = 0; i < 10; i++) G.titleStep(S, dt);
const m3 = mid(), tx = m3.x + 30, ty = Math.max(S.top + 30, m3.y - 30);
G.levelWaypoint(S, 0, tx, ty);
check('a new tap moves the waypoint', L.way.x === tx && L.way.y === ty);
const f2 = until(S, () => !L.way, 400), m4 = mid();
check('he gets to the new one (jetting up to it)', f2 >= 0 && Math.abs(m4.x - tx) < 8 && Math.abs(m4.y - ty) < 18, [f2, Math.round(m4.x - tx), Math.round(m4.y - ty)]);

// a spot in the rock under the floor: he stops over it (as near as he gets), never later than DEV.gremWayT
G.levelWaypoint(S, 0, mid().x + 40, S.vh + 200);
const f3 = until(S, () => !L.way, Math.round((D.gremWayT + 2) / dt));
check('a spot in the rock below: he stops over it, the waypoint let go (by gremWayT at the latest)', f3 >= 0 && f3 <= Math.round(D.gremWayT / dt) + 2, f3);

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
