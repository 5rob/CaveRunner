// Coal Seams' bats (grem, chunk C4a; creatures/bats.js, stepped by art/titlescene.js batsStep): roosts under rock, slots
// filling outwards alternating sides, a near player scares a roost into flight, they come back and re-roost, never inside
// rock, and a bite of 0 hurts nobody. Every loop has a frame cap.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV;
D.autoFoeDmg = 0;
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// slots: 0 the anchor, then 1, -1, 2, -2…
check('slots fill outwards, alternating sides', JSON.stringify([0, 1, 2, 3, 4, 5].map(G.slotOff)) === JSON.stringify([0, 1, -1, 2, -2, 3]));

// a hand-made room: a flat roof at y 20, floor at 140, walls at ±200
const solid = (x, y) => y < 20 || y >= 140 || x < -200 || x >= 200;
const B = G.newBats(), ro = G.addRoost(B, 0, 20, rnd, 134);
G.stepBats(B, 1 / 60, [], solid, rnd);
check('a roost of DEV.batsPerRoost bats', B.list.length === D.batsPerRoost, B.list.length);
const xs = B.list.map(b => b.x);
check('… hanging in their slots, slotSpacing apart, alternating sides', xs[1] === D.batSlotSpacing && xs[2] === -D.batSlotSpacing && xs[3] === 2 * D.batSlotSpacing, xs.slice(0, 5));
check('… under the roof (y 20)', B.list.every(b => b.y === 20 && b.st === 'roost'));

// a near player scares them off; away again, they fly a while, come back and re-roost
D.batTakeoff = 0;
const P = [{ x: 0, y: 70 }];
let inRock = 0, maxSp = 0;
G.stepBats(B, 1 / 60, P, solid, rnd);
check('a near player scares the roost into flight', B.list.filter(b => b.st === 'fly' && b.scared).length >= B.list.length - 2, B.list.map(b => b.st[0]).join(''));
for (let i = 0; i < 60; i++) G.stepBats(B, 1 / 60, P, solid, rnd);
const far = [{ x: 0, y: 1e5 }];
let back = -1;
for (let i = 0; i < 60 * 40; i++) {
  G.stepBats(B, 1 / 60, far, solid, rnd);
  for (const b of B.list) { if (solid(b.x, b.y)) inRock++; maxSp = Math.max(maxSp, Math.hypot(b.vx, b.vy)); }
  if (B.list.every(b => b.st === 'roost')) { back = i / 60; break; }
}
check('… they come back and re-roost (within flightMax + a few seconds)', back > 0 && back < D.batFlightMax + 6, back);
check('… each in its own slot', B.list.every(b => Math.abs(b.x - G.slotPos(ro, b.slot, solid).x) < 0.01 && b.y === 20));
check('… never inside rock', inRock === 0, inRock);
check('… never past maxSpeed', maxSp <= D.batMaxSpeed + 1e-6, Math.round(maxSp));
// flying as a flock: scared all (the button), a second on they stay together (cohesion) and apart (separation)
G.BAT_CMD.scare = true;
for (let i = 0; i < 90; i++) G.stepBats(B, 1 / 60, far, solid, rnd);
const fl = B.list.filter(b => b.st === 'fly');
let close = 0, mean = 0;
for (const a of fl) { let m = Infinity; for (const o of fl) if (o !== a) m = Math.min(m, Math.hypot(a.x - o.x, a.y - o.y)); mean += m; if (m < 1) close++; }
check('Scare all: every bat flying', fl.length === B.list.length, fl.length);
check('… a flock: nearest neighbour within perception, no two on top of each other', mean / fl.length < D.batPerception && close <= 1, { mean: +(mean / fl.length).toFixed(1), close });
G.BAT_CMD.reset = true; G.stepBats(B, 1 / 60, far, solid, rnd);
check('Reset bats: all back in their slots', B.list.every(b => b.st === 'roost' && b.y === 20));
// the toggle off: a near player doesn't scare them
D.batScare = 0; G.stepBats(B, 1 / 60, P, solid, rnd);
check('players-scare off: no take-off', B.list.every(b => b.st === 'roost'));
D.batScare = 1;

// a Grem level at level 2 (Coal Seams): roosts made as it goes, each under rock
const run = G.newRun(9);
const S = G.levelScene(190, 23, 1, undefined, run.players, 2, run, true), L = G.levelState(S);
S.spawn = 1e9; S.foes.length = 0;
let dist = 0, roosts = new Set();
for (let i = 0; i < 2000 && S.scroll < L.plan.arena.x0 - 300; i++) {
  S.scroll += 3; dist += 3; G.titleStep(S, 1 / 60); S.foes.length = 0;
  for (const r of S.runners) { r.x = 40; r.y = 10; r.out = true; }
  for (const q of (S.bats && S.bats.roosts) || []) roosts.add(q);
}
const per = roosts.size / (dist / G.TITLE_VW);
check('roosts in Coal Seams, about DEV.batRoosts a screen (within 40%)', Math.abs(per / D.batRoosts - 1) < 0.4, { n: roosts.size, per: +per.toFixed(2) });
const TC = G.TCELL, rock = (x, y) => !!G.TITLE_SOLID[G.titleCell(S, Math.floor(x / TC), Math.floor(y / TC))];
const ro2 = [...roosts].filter(q => S.bats.roosts.includes(q));
check('… each anchored on a rock underside (rock over, air at it)', ro2.length > 0 && ro2.every(q => rock(q.x, q.y - 1) && !rock(q.x, q.y + 0.5)), ro2.length);
// the sandbox: the scene still, a player walked under a roost: they fly, never into rock, and a bite of 0 hurts nobody
S.lvl.step = null; S.pace = 0; S.still = true; S.props.length = 0; S.foes.length = 0;
const q = ro2[ro2.length - 1], ru = S.runners[0];
ru.out = false; ru.x = q.x - S.scroll - G.PW / 2; ru.y = q.y + 30;
let hurt = 0; S.lvl.hurt = () => { hurt++; };
let bad = 0;
const mine = S.bats.list.filter(b => b.ro === q);
for (let i = 0; i < 240; i++) { G.titleStep(S, 1 / 60); for (const b of mine) if (b.st !== 'roost' && rock(b.x, b.y)) bad++; }
check('in the level: a player under a roost scares its bats', mine.some(b => b.st === 'fly'), mine.map(b => b.st[0]).join(''));
check('… flying bats never inside rock', bad === 0, bad);
check('… bite 0 (the default): nobody hurt', D.batBite === 0 && hurt === 0, hurt);

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
