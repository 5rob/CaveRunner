// CaveRunner Auto's level (src/auto/level.js) and pace control (src/auto/pilot.js), AUTOBATTLER.md stage 4a:
// the finite plan (same seed same level, the menu's zone order rules, its length from the minutes knob), the
// scene run headless from the start pad through the arena to the exit pad within a frame budget with the team
// never stuck, and the pilot's factors with fake elites and chests.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV;

// ---- the plan ----
const strip = P => JSON.stringify(P.zp.z.map(z => [z.z, z.x0, z.x1, z.ca, z.fo, z.flat || false]));
const A = G.levelPlan(5, 5), B = G.levelPlan(5, 5), C = G.levelPlan(6, 5);
check('same seed, same level', strip(A) === strip(B) && A.exitX === B.exitX);
check('another seed, another level', strip(A) !== strip(C));
const rnd = A.zp.z.filter(z => !z.flat);
check('random zones between the start pad and the arena', A.zp.z[0].flat && rnd.length > 5 && rnd.every(z => z.x0 >= A.z0 && z.x1 <= A.z1), rnd.length);
const kinds = A.zp.z.slice(0, -3).map(z => z.z);
check('the menu\'s order rule: no zone the same kind as either of the two before it',
  kinds.every((k, i) => i < 1 || (k !== kinds[i - 1] && (i < 2 || k !== kinds[i - 2]))), kinds);
check('the zones\' kinds are the menu\'s', rnd.every(z => G.TITLE_ZONES.includes(z.z)));
check('no gaps between zones', A.zp.z.every((z, i) => i === 0 || z.x0 === A.zp.z[i - 1].x1));
const want = 5 * 60 * G.LVL_SCROLL * D.autoLvlPace;
check('total length: 5 minutes at normal pace (to within one zone)', A.len >= want && A.len - want < G.TITLE_ZLEN[1], [A.len, want]);
const A2 = G.levelPlan(5, 2);
check('the minutes knob sets it', Math.abs(A2.len - 2 * 60 * G.LVL_SCROLL * D.autoLvlPace) < G.TITLE_ZLEN[1], A2.len);
check('then the arena, then the exit pad, then the end', A.arena.x0 === A.z1 && A.arena.x1 - A.arena.x0 === G.LVL_ARENA
  && A.exitX > A.arena.x1 && A.zp.z[A.zp.z.length - 1].x1 === 1e9);

// ---- the pilot (fakes) ----
const base = D.autoLvlPace;
const near = (a, b) => Math.abs(a - b) < 1e-9;
check('normal pace', near(G.pilotPace({ x: 100 }), base));
check('an elite alive and near slows it', near(G.pilotPace({ x: 100, elites: [{ x: 150 }] }), base * D.autoLvlElite));
check('a dead elite, or a far one, doesn\'t', near(G.pilotPace({ x: 100, elites: [{ x: 150, alive: false }, { x: 100 + D.autoLvlEliteR + 5 }] }), base));
check('passing a chest slows it', near(G.pilotPace({ x: 100, chests: [{ x: 90 }] }), base * D.autoLvlChest));
check('an opened chest doesn\'t', near(G.pilotPace({ x: 100, chests: [{ x: 90, open: true }] }), base));
check('both: both', near(G.pilotPace({ x: 100, elites: [{ x: 100 }], chests: [{ x: 100 }] }), base * D.autoLvlElite * D.autoLvlChest));
check('stick full right hurries', near(G.pilotPace({ x: 100, hold: 1 }), base * D.autoLvlHurry));
check('stick half right: half way to the hurry', near(G.pilotPace({ x: 100, hold: 0.5 }), base * (1 + (D.autoLvlHurry - 1) / 2)));
check('stick full left slows to the minimum, never 0', near(G.pilotPace({ x: 100, hold: -1 }), base * D.autoLvlSlow) && D.autoLvlSlow > 0);
check('stick half left: between', G.pilotPace({ x: 100, hold: -0.5 }) < base && G.pilotPace({ x: 100, hold: -0.5 }) > base * D.autoLvlSlow);
check('the push clamps to ±1', near(G.pilotPace({ x: 100, hold: -5 }), base * D.autoLvlSlow) && near(G.pilotPace({ x: 100, hold: 5 }), base * D.autoLvlHurry));
check('a stop point: brakes before it, stops at it', G.pilotPace({ x: 100, stopX: 130 }) < base && G.pilotPace({ x: 100, stopX: 100 }) === 0
  && G.pilotPace({ x: 100, stopX: 400 }) === base && G.pilotPace({ x: 100, stopX: 100.5 }) > 0);
check('easing: a step at most the knob × dt', near(G.pilotEase(0, 1, 0.1), D.autoLvlEase * base * 0.1) && G.pilotEase(1, 1, 0.1) === 1);

// ---- headless: pad → arena → exit ----
const keep = { m: D.autoLvlMin, b: D.autoLvlBossT, e: D.autoFoeElites };
D.autoLvlMin = 0.25; D.autoLvlBossT = 2; D.autoFoeElites = 0;   // (no elites: they'd slow the pace these measure)
const P = G.levelPlan(11), S = G.levelScene(190, 11, 4, P), L = G.levelState(S);
check('a short level for the run', P.len < 800, P.len);
check('the team on the start pad, hidden till it comes through, nothing moving', L.phase === 'arrive' && S.runners.every(r => r.hide) && S.pace === 0);
const dt = 1 / 30, BUDGET = 60 * 30;
let f = 0, seenArena = -1, arenaStill = true, arenaX = 0, windows = [], lastX = G.levelTeamX(S), stuck = 0, longDig = 0;
const digT = S.runners.map(() => 0);
for (; f < BUDGET && !G.levelDone(S); f++) {
  G.titleStep(S, dt);
  if (L.phase === 'arena') { if (seenArena < 0) { seenArena = f; arenaX = G.levelTeamX(S); } else if (Math.abs(G.levelTeamX(S) - arenaX) > 0.01) arenaStill = false; }
  if (f % 90 === 89) { if (L.phase === 'run' || L.phase === 'out') windows.push(+(G.levelTeamX(S) - lastX).toFixed(1)); lastX = G.levelTeamX(S); }
  S.runners.forEach((r, i) => { digT[i] = r.dig ? digT[i] + dt : 0; if (digT[i] > 8) longDig++; });
  if (f === 90) check('they came through the pad', L.arrived.every(a => a) && S.runners.every(r => !r.hide));
}
check('pad → arena → exit within the frame budget', G.levelDone(S), [f, L.phase]);
check('stopped in the arena till the boss was dead', seenArena > 0 && arenaStill && Math.abs(arenaX - P.arena.mid) < 1, [seenArena, arenaX, P.arena.mid]);
check('moving every 3 s window on the way (never stuck; the first is the setting off)', windows.length > 3 && windows.slice(1).every(w => w > 5), windows);
check('no one sawing for more than 8 s on end', longDig === 0, longDig);
const ex = P.exitX - S.scroll;
check('everyone on the exit pad, on the floor', S.runners.every(r => Math.abs(r.x + G.PW / 2 - ex) < 15 && r.ground), S.runners.map(r => [r.x + G.PW / 2 - ex, r.ground]));
check('the team stopped at the exit pad', Math.abs(G.levelTeamX(S) - P.exitX) < 1 && S.pace === 0);
// the stick: full left slows the team but never stops it
const S2 = G.levelScene(190, 12, 1, G.levelPlan(12));
for (let i = 0; i < 150; i++) G.titleStep(S2, dt);
G.levelHold(S2, -1);
for (let i = 0; i < 30; i++) G.titleStep(S2, dt);
const x0 = G.levelTeamX(S2);
for (let i = 0; i < 30; i++) G.titleStep(S2, dt);
check('stick full left slows the team to the minimum, still moving', G.levelTeamX(S2) > x0 && Math.abs(S2.pace - D.autoLvlPace * D.autoLvlSlow) < 1e-6, S2.pace);
G.levelHold(S2, 1);
for (let i = 0; i < 90; i++) G.titleStep(S2, dt);
check('stick full right hurries it', Math.abs(S2.pace - D.autoLvlPace * D.autoLvlHurry) < 1e-6, S2.pace);
D.autoLvlMin = keep.m; D.autoLvlBossT = keep.b; D.autoFoeElites = keep.e;
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
