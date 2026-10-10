// CaveRunner Auto stage 10a (src/auto/throw.js): gold and gems thrown at the hub's machines. The finger's speed as a world
// speed; which machine takes what; a nugget dropped by the gun machine pulled in and counted (H.paid), gems by theirs;
// the wrong currency knocked off and, after DEV.autoThrowBack, home to player 1 and into H.back; a lump counts its amount.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

const v = G.screenToWorldVel(300, -600, 2, 1.5);
check('finger speed → world: ÷ the screen scale ÷ the zoom', v.vx === 100 && v.vy === -200, v);
check('gun and exo take gold, mod red, perk green; nothing else', G.machineTakes('gun', 'gold') && G.machineTakes('exo', 'gold')
  && G.machineTakes('mod', 'red') && G.machineTakes('perk', 'green') && !G.machineTakes('gun', 'red') && !G.machineTakes('mod', 'gold')
  && !G.machineTakes('perk', 'red'));
check('throwable: gold and gems only', G.throwable({ kind: 'gold' }) && G.throwable({ kind: 'green' }) && !G.throwable({ kind: 'mod' }) && !G.throwable(null));
const fy = 160;
check('the pull: the nearest machine taking it, within reach', G.pullingMachine(G.hubStopX('gun') + 10, fy - 40, 'gold', fy, 45) === 'gun'
  && G.pullingMachine(G.hubStopX('exo') - 5, fy - 30, 'gold', fy, 45) === 'exo' && G.pullingMachine(G.hubStopX('gun'), fy - 30, 'red', fy, 45) === null
  && G.pullingMachine(G.hubStopX('gun'), fy - 200, 'gold', fy, 45) === null);

// a pull step closes the distance
const g0 = { x: 0, y: 0, vx: 0, vy: 0 };
let d = 100;
for (let i = 0; i < 60; i++) d = G.pullStep(g0, 100, 0, 45, 1 / 30);
check('the pull moves it in', d < 10, d);

const run = (S, s) => { for (let i = 0; i < s * 30; i++) G.titleStep(S, 1 / 30); };
const S = G.hubScene(190, 101, 1), H = G.hubState(S);
run(S, 2);    // the player through
check('a new hub: nothing paid, nothing thrown', Object.keys(H.paid).length === 0 && H.thrown.length === 0 && H.back.length === 0);
G.hubThrow(S, 'gold', 1, G.hubStopX('gun') - 20, H.fy - 60, 30, 0);
G.hubThrow(S, 'red', 1, G.hubStopX('mod') + 10, H.fy - 60, 0, 0);
G.hubThrow(S, 'green', 1, G.hubStopX('perk'), H.fy - 70, 0, 0);
G.hubThrow(S, 'gold', 40, G.hubStopX('exo'), H.fy - 50, 0, 0);
run(S, 1.5);
check('the gun machine took the nugget, the exo the 40 lump, mod red, perk green', H.paid.gun === 1 && H.paid.exo === 40 && H.paid.mod === 1 && H.paid.perk === 1, H.paid);
check('all gone', H.thrown.length === 0, H.thrown.length);

// the wrong currency: a red gem into the gun machine bounces off, then home after autoThrowBack
const g = G.hubThrow(S, 'red', 1, G.hubStopX('gun'), H.fy - 60, 0, 0);
run(S, 0.5);
check('the gun machine doesn\'t take red: still out, not paid', H.thrown.includes(g) && H.paid.gun === 1, H.paid);
check('knocked off the cabinet', Math.abs(g.x - G.hubStopX('gun')) >= G.MACH_HALF - 2, g.x - G.hubStopX('gun'));
run(S, G.DEV.autoThrowBack + 3);
check('then home: into H.back, one red', H.thrown.length === 0 && H.back.length === 1 && H.back[0].kind === 'red' && H.back[0].n === 1, H.back);
check('the mod machine never took it (its one gem paid out since: stage 10b)', H.paid.mod === 0, H.paid);

// a held lump doesn't move or count
const L = G.hubThrow(S, 'gold', 9, G.hubStopX('gun'), H.fy - 30, 0, 0, { held: true });
run(S, 1);
check('held: stays put, not taken', H.thrown.includes(L) && L.x === G.hubStopX('gun') && H.paid.gun === 1);
L.held = false;
run(S, 1);
check('let go over the gun machine: taken, 9 more', H.paid.gun === 10, H.paid);

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
