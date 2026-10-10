// CaveRunner Auto feedback round 2 (src/auto/level.js levelControl, art/titlescene.js ctlStep): in a level the selected
// player is steered by the pill stick: pushed right he walks through the world faster than the scroll (gains on screen),
// left he drops back, up he jets; the stick at rest he stands (manual mode: the view eases to him); his gun still fires by itself;
// let go (B) he's back on the autopilot. A fallen player isn't steered.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV;
Object.assign(D, { autoFoeDmg: 0, autoWallMin: 0, autoWallMax: 0 });

const S = G.levelScene(200, 7, 2);
const run = s => { for (let i = 0; i < s * 30; i++) G.titleStep(S, 1 / 30); };
run(3);
const r = S.runners[0], o = S.runners[1];
const push = (nx, ny) => ({ active: true, nx, ny, mag: 1 });

G.levelControl(S, r.id, null);
check('picked: he is steered (the stick at rest), the other is not', !!r.ctl && !r.ctl.active && !o.ctl);
const x0 = r.x;
run(1.5);
check('the stick at rest: he stands; (manual mode, auto-roam) the view eases to him, so he drifts toward the middle', Math.abs(r.x + G.PW / 2 - G.TITLE_VW / 2) < Math.abs(x0 + G.PW / 2 - G.TITLE_VW / 2) && Math.abs(r.cvx || 0) < 1, [x0, r.x]);

r.x = 40;
G.levelControl(S, r.id, push(1, 0));
const shots0 = S.shots.length + S.kills;
run(1);
check('pushed right: he walks right through the world faster than the scroll', r.cvx > G.WALK * D.autoMoveK * 0.9 && r.x > 40, [r.cvx, r.x]);

G.levelControl(S, r.id, push(-1, 0));
run(0.6);
check('pushed left: he walks back (he faces where his gun aims)', r.cvx < -G.WALK * D.autoMoveK * 0.9, r.cvx);

const y0 = r.y;
G.levelControl(S, r.id, push(0, -1));
run(0.5);
check('pushed up: he jets up', r.y < y0 - 10 && r.flame > 0.5, [y0, r.y, r.flame]);

G.levelControl(S, r.id, push(1, 0));
let fired = false;
for (let i = 0; i < 90 && !fired; i++) { G.titleStep(S, 1 / 30); fired = S.shots.some(s => !s.foe) || S.kills + S.shots.length > shots0; }
check('his gun still aims and fires by itself', fired);

G.levelControl(S, -1, null);
check('let go: back on the autopilot', !r.ctl && !o.ctl);
run(2);
check('… and the autopilot moves him again', r.x >= 8 && !r.ctl);

r.out = true;
G.levelControl(S, r.id, push(1, 0));
check('a fallen player is not steered', !r.ctl);
r.out = false;

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
