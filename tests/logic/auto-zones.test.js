// CaveRunner Auto's zones in a tall level (owner: not straight vertical slices): which zone a point looks like comes from a
// warped noise field (titleZoneLook), so at a fixed x the zone changes with height in places; the same for a seed; pads and
// the arena keep their own look; the mine works stack more tunnels in the tall band; the autopilot still gets start → exit.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV;
const VH = 420;

const P = G.levelPlan(21, undefined, 0), S = G.levelScene(VH, 21, 4, P);
// columns where the zone changes with y (between the start pad and the arena), and a column's look profile
let mixed = 0, cols = 0;
/** @param {any} Sc @param {number} x */
const profile = (Sc, x) => { const a = []; for (let y = Sc.top; y < Sc.bot; y += 6) a.push(G.titleZoneLook(x, y, Sc).i); return a; };
for (let x = G.LVL_PAD + 40; x < P.arena.x0 - 40; x += 10) {
  cols++;
  if (new Set(profile(S, x)).size > 1) mixed++;
}
check('zones are not vertical slices: the zone at an x changes with height in places', mixed > cols * 0.25, [mixed, cols]);
// borders aren't straight: where the zone changes along x at one height differs from another height's
/** @param {number} y */
const borders = y => { const b = []; let last = -1; for (let x = G.LVL_PAD; x < P.arena.x0; x += 2) { const i = G.titleZoneLook(x, y, S).i; if (i !== last && last >= 0) b.push(x); last = i; } return b; };
const bTop = borders(S.top + 40), bBot = borders(S.bot - 40);
check('the borders at the top and the bottom aren\'t in the same places', bTop.join() !== bBot.join(), [bTop.slice(0, 4), bBot.slice(0, 4)]);
// deterministic: a second scene of the same seed has the same looks
const S2 = G.levelScene(VH, 21, 4, G.levelPlan(21, undefined, 0));
let same = true;
for (let x = 200; x < 1500 && same; x += 37) for (let y = S.top; y < S.bot; y += 29) if (G.titleZoneLook(x, y, S).i !== G.titleZoneLook(x, y, S2).i) { same = false; break; }
check('the same seed gives the same zones', same);
// the pads and the arena keep their own look
let padOk = true;
for (let y = S.top; y < S.bot; y += 10) {
  if (!G.titleZoneLook(60, y, S).flat || !G.titleZoneLook(P.arena.mid, y, S).flat) padOk = false;
}
check('the start pad and the arena keep their own look', padOk);
// a mine works fills more of the tall band: more tunnels than at the old height
const mine = P.zp.z.find(z => z.mine), M = mine && mine.mine;
if (M) {
  const tall = G.mineBands(M, S), old = G.mineBands(M, G.levelScene(190, 21, 4, G.levelPlan(21, undefined, 0)));
  check('a mine works stacks more tunnels in the tall band', tall.length > old.length && old.length === M.n, [tall.length, old.length, M.n]);
  check('… all inside the band', tall.every(b => b.c >= S.top - 4 && b.f <= S.bot), tall.map(b => Math.round(b.c)));
} else console.log('  (no mine works in seed 21)');

// start → arena → exit on the autopilot, inside the level
const keep = { m: D.autoLvlMin, b: D.autoLvlBossT };
D.autoLvlMin = 0.25; D.autoLvlBossT = 2;
const dt = 1 / 30, BUDGET = 90 * 30;
for (const seed of [5, 29]) {
  const Pl = G.levelPlan(seed, undefined, 0), Sc = G.levelScene(VH, seed, 4, Pl), L = G.levelState(Sc);
  let f = 0;
  for (; f < BUDGET && !G.levelDone(Sc); f++) G.titleStep(Sc, dt);
  check(`seed ${seed}: pad → exit at vh ${VH}`, G.levelDone(Sc), [f, L.phase]);
}
D.autoLvlMin = keep.m; D.autoLvlBossT = keep.b;
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
