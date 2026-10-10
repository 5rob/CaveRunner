// CaveRunner Auto feedback round 2: manual mode (src/auto/level.js roamStep, levelLead, roamPace, roamMin, roamFollow).
// A player steered by hand in a level: the level's own scroll stops, the view follows him forward and back (the scroll
// at DEV.autoRoamCam × his offset from the middle: slower the nearer he is), never further back than roamMin (what the
// scene keeps: titlescene.js TITLE_BACK); the others follow him; let go, the pilot's pace comes back.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV;
Object.assign(D, { autoFoeDmg: 0, autoWallMin: 0, autoWallMax: 0 });

check('roamPace: proportional to the offset (damped: half the offset, half the speed)', Math.abs(G.roamPace(40) - 2 * G.roamPace(20)) < 1e-9 && G.roamPace(0) === 0 && G.roamPace(-10) < 0);
check('roamMin: autoRoamBack screens behind the furthest point, capped by TITLE_BACK',
  G.roamMin({ far: 1000 }) === 1000 - Math.min(D.autoRoamBack * G.TITLE_VW, G.TITLE_BACK - 50), G.roamMin({ far: 1000 }));

const S = G.levelScene(200, 7, 3);
const L = G.levelState(S);
const step = s => { for (let i = 0; i < s * 30; i++) G.titleStep(S, 1 / 30); };
step(4);
check('the level runs (the pilot\'s pace)', L.phase === 'run' && S.pace > 0.3, [L.phase, S.pace]);
check('a level keeps a wider ring than the title', S.ncol * G.TCELL >= G.TITLE_VW + G.TITLE_BACK);
const r = S.runners[0], push = (nx, ny) => ({ active: true, nx, ny, mag: 1 });
r.x = G.TITLE_VW / 2 - G.PW / 2;
G.levelControl(S, r.id, null);
step(0.5);
check('manual mode, the stick at rest in the middle: the scroll stops', G.levelLead(S) === r && Math.abs(S.pace) < 0.05, S.pace);

const s0 = S.scroll;
G.levelControl(S, r.id, push(1, 0));
step(2);
const s1 = S.scroll, off1 = r.x + G.PW / 2 - G.TITLE_VW / 2;
check('stick right: forward through the world, the scroll follows', s1 > s0 + 40 && S.pace > 0, [s0, s1, S.pace]);
check('… he stays near the middle (offset = his speed / autoRoamCam)', off1 > 0 && off1 < 60, off1);
const lag = S.runners.slice(1).map(o => o.x);
check('the others follow, behind him', lag.every(x => x < r.x + 4), { lead: r.x, lag });

G.levelControl(S, r.id, push(-1, 0));
step(2.5);
const s2 = S.scroll;
check('stick left: back through the world, the scroll goes back', s2 < s1 - 40 && S.pace < 0, [s1, s2, S.pace]);
check('the others follow back (behind him: to his right now)', S.runners.slice(1).every(o => o.x > r.x - 20), S.runners.map(o => o.x));

step(6);
check('never further back than roamMin', S.scroll >= G.roamMin(L) - 0.5 && S.scroll <= G.roamMin(L) + 30, [S.scroll, G.roamMin(L), L.far]);
check('… and the screen still has terrain there (the ring kept it)', S.gen - S.ncol <= Math.floor(S.scroll / G.TCELL));

G.levelControl(S, r.id, null);
r.x = 30;
const fo0 = S.scroll;
step(1);
const ox = r.x + G.PW / 2 - G.TITLE_VW / 2;
check('at rest off the middle: the view eases to him (his screen offset shrinks)', Math.abs(ox) < Math.abs(30 + G.PW / 2 - G.TITLE_VW / 2) * 0.5 || S.scroll === G.roamMin(L), { ox, scroll: S.scroll, fo0 });

G.levelControl(S, -1, null);
step(3);
check('let go: no one steered, the pilot\'s pace back', !G.levelLead(S) && S.pace > 0.3, S.pace);

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
