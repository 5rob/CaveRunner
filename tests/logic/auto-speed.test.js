// CaveRunner Auto bug round 2: the hand-steered player moves through the world as fast in a level as in the hub
// (walking right on flat ground: world units per second, the hub's player 1 vs a level's steered player).
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
Object.assign(G.DEV, { autoFoeDmg: 0, autoWallMin: 0, autoWallMax: 0 });
const push = { active: true, nx: 1, ny: 0, mag: 1, dx: 1, dy: 0 };

// the hub
const H = G.hubScene(200, 7, 1, 1, {});
for (let i = 0; i < 6 * 30; i++) G.titleStep(H, 1 / 30);
const hr = H.runners[0];
hr.x = G.hubStopX('enter');
G.hubStick(H, push);
for (let i = 0; i < 15; i++) G.titleStep(H, 1 / 30);
const hx0 = hr.x;
for (let i = 0; i < 30; i++) G.titleStep(H, 1 / 30);
const hub = (hr.x - hx0);

// a level
const S = G.levelScene(200, 7, 2);
for (let i = 0; i < 3 * 30; i++) G.titleStep(S, 1 / 30);
const r = S.runners[0];
G.levelControl(S, r.id, push);
for (let i = 0; i < 15; i++) G.titleStep(S, 1 / 30);
r.x = 8;   // from the left, so he doesn't reach the screen's right edge (the scroll's pace caps him there) while measured
const lx0 = r.x + S.scroll;
let onScreen = [];
for (let i = 0; i < 30; i++) { G.titleStep(S, 1 / 30); onScreen.push(Math.round(r.x)); }
const lvl = r.x + S.scroll - lx0;
check('walking right: the same speed through the world in the hub and a level (within 10%)', Math.abs(lvl - hub) < hub * 0.1, { hub, lvl, onScreen: onScreen.filter((_, i) => i % 6 === 0) });

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
