// CaveRunner Auto's death (src/auto/death.js, feedback round 2): a fallen player is the old game's ragdoll lying on the
// level's rock; everyone down → the scroll eases to a stop, "Tap A to Teleport back to Hub", A → the helmet light blinks,
// a big blast, then levelLost (home). And the jetpack: the flame points away from the thrust (titleFlameDir), smoke puffs.
// Every loop has a frame cap.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV, dt = 1 / 30;
const keep = { m: D.autoLvlMin, e: D.autoFoeElites, f: D.autoFoeCap0, g: D.autoFoeCap1 };
D.autoLvlMin = 0.5; D.autoFoeElites = 0; D.autoFoeCap0 = 0; D.autoFoeCap1 = 0;
const until = (S, done, cap) => { for (let i = 0; i < cap; i++) { if (done(S)) return i; G.titleStep(S, dt); } return done(S) ? cap : -1; };

// ---- the jetpack ----
const r = { jx: 0, jy: -1 };
const up = G.titleFlameDir(r);
check('thrust straight up: the flame straight down', Math.abs(up.fx) < 1e-9 && up.fy > 0.99, up);
const rt = G.titleFlameDir({ jx: 1, jy: 0 });
check('thrust to the right: the flame back and down (left)', rt.fx < -0.6 && rt.fy > 0.4, rt);

const run = G.newRun(3); G.addPlayer(run) || run.players.push(G.newPlayer(1));
const S = G.levelScene(190, 31, 2, G.levelPlan(31), run.players, 1);
until(S, s => G.levelState(s).phase === 'run', 400);
let smoke = 0, tilt = 0, fly = false;
for (let i = 0; i < 600; i++) {
  G.titleStep(S, dt);
  smoke = Math.max(smoke, S.parts.filter(p => p.kind === 'jsmoke').length);
  for (const q of S.runners) if (q.mode === 'fly' && q.flame > 0) { fly = true; tilt = Math.max(tilt, Math.abs(q.jx || 0)); }
  if (fly && smoke > 4 && tilt > 0.05) break;
}
check('someone jets: the jetpack\'s smoke puffs out', fly && smoke > 4, { fly, smoke });
check('… and the flame tilts with his speed across', tilt > 0.05, tilt);

// ---- a fall: a ragdoll on the rock ----
const L = G.levelState(S);
S.lvl.hurt(S, 0, 1e6);
const r0 = S.runners[0];
check('player 1 falls: a ragdoll, his sprite hidden', !!r0.rag && r0.hide === true && r0.out === true);
until(S, s => r0.rag.still, 200);
const solid = (x, y) => G.titleSolid(S, x - S.scroll, y);
const head = r0.rag.joints[0], feet = r0.rag.joints[4];
check('it comes to rest, lying on the rock (not in it, not in the air)', r0.rag.still && r0.rag.joints.every(j => !solid(j.x, j.y)) &&
  r0.rag.joints.some(j => solid(j.x, j.y + 2.5)), { head, feet });
check('one of two down: the level goes on, no prompt', !G.levelLost(S) && !G.levelDeathPrompt(S) && L.deadT == null);
const hx = r0.rag.joints[2].x, sc0 = S.scroll;
until(S, s => s.scroll > sc0 + 20, 400);
check('the world scrolls on: he is left behind (world x kept, screen x going left)', Math.abs(r0.rag.joints[2].x - hx) < 3 && r0.x < hx - sc0 - 15, [r0.x, hx - sc0]);

// ---- everyone down ----
S.pace = 1;
S.lvl.hurt(S, 1, 1e6);
G.titleStep(S, dt);
check('all down: the death starts', L.deadT != null && !G.levelLost(S));
check('not before the stop: A does nothing', !G.levelTeleportHome(S) && L.tpT == null);
const p0 = S.pace;
G.titleStep(S, D.autoDeathStop * 0.5);
check('the scroll easing down', S.pace > 0 && S.pace < p0, [p0, S.pace]);
until(S, s => G.levelDeathPrompt(s), Math.ceil(D.autoDeathStop / dt) + 10);
check('stopped, and "Tap A to Teleport back to Hub" shows', S.pace === 0 && G.levelDeathPrompt(S));
for (let i = 0; i < 30; i++) G.titleStep(S, dt);
check('it waits for A (not lost by itself)', !G.levelLost(S) && G.levelDeathPrompt(S));
check('A takes the press', G.levelTeleportHome(S) === true && !G.levelDeathPrompt(S));
check('… once', G.levelTeleportHome(S) === false);
const last = S.runners[L.lastI];
const lamp = new Set();
let booms = S.booms.length;
for (let t = 0; t < D.autoTpBlink - 0.05; t += dt) { G.titleStep(S, dt); lamp.add(!!last.lamp); }
check('the last one\'s helmet light blinks (on and off)', L.lastI === 1 && lamp.has(true) && lamp.has(false));
check('no blast yet', !L.boomed && !G.levelLost(S));
const snd0 = S.snd.length;
until(S, () => L.boomed, 10);
check('then the blast: booms, shake, flash, a boom sound', L.boomed && S.booms.length > booms && S.shake > 5 && S.flash > 0.5 && S.snd.slice(snd0 > 0 ? 0 : 0).some(s => s.k === 'boom'));
check('not home at once', !G.levelLost(S));
const n = until(S, s => G.levelLost(s), Math.ceil(D.autoTpBoomWait / dt) + 5);
check('home after the blast (levelLost)', n >= 0 && G.levelLost(S), n);

D.autoLvlMin = keep.m; D.autoFoeElites = keep.e; D.autoFoeCap0 = keep.f; D.autoFoeCap1 = keep.g;
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
