// The saws leave the exit pad's ground alone (owner v1.0.55: players sawed it out and couldn't reach the teleporter):
// before sawing, the autopilot reads the rock's normal against the way on (art/titlescene.js navAround, rockNormal): a floor
// or gentle slope it rises over, a roof it dips under; a wall it saws. Short levels, the boss killed at once.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const dt = 1 / 30;
// the normal: a floor up, a wall back at him, nothing in the open
{
  const S = G.levelScene(400, 5, 1), r = S.runners[0], T = G.TCELL;
  const fill = (/** @type {(x: number, y: number) => boolean} */ solid) => {
    for (let c = 0; c < S.ncol; c++) for (let q = 0; q < S.rows; q++) S.cells[c * S.rows + q] = solid(c * T - S.scroll, q * T) ? G.TM.ROCK : G.TM.AIR;
  };
  r.x = 100; r.y = 200;
  fill((_x, y) => y >= 222);
  const f = G.rockNormal(S, r, 0, 1);
  check('a floor under him: its normal up', f && f.y < -0.9, f);
  fill(x => x >= 112);
  const w = G.rockNormal(S, r, 1, 0);
  check('a wall ahead: its normal back at him (saws)', w && -w.x > G.DEV.autoNavCut, w);
  fill(() => false);
  check('the open: none', G.rockNormal(S, r, 1, 0) === null);
}
// (v1.0.55: one spawned past the boss wiped a team at the exit) no new creatures once the scene's edge nears the arena
{
  const P = G.levelPlan(11, 0.4, 0), S = G.levelScene(400, 11, 1, P), L = G.levelState(S);
  check('creatures come in early in the level', G.levelSpawn(S, L).cap > 0);
  S.scroll = P.arena.x0 - G.TITLE_VW;
  check('… none with the arena in sight', G.levelSpawn(S, L).cap === 0);
}
for (const seed of [11, 12, 14, 17]) {
  const P = G.levelPlan(seed, 0.4, 0), S = G.levelScene(400, seed, 4, P), L = G.levelState(S);
  const T = G.TCELL, fy = G.titleFloor(P.exitX, S);
  const holes = () => { let n = 0; for (let c = Math.floor(P.arena.x1 / T); c < Math.floor((P.arena.x1 + G.LVL_EXITW) / T); c++) for (let r = Math.ceil(fy / T) + 1; r < Math.ceil(fy / T) + 15; r++) if (G.titleCell(S, c, r) === G.TM.AIR) n++; return n; };
  let f = 0, h0 = -1;
  for (; f < 30 * 200 && L.phase !== 'exit'; f++) {
    if (L.phase === 'arena') { for (const e of S.foes) e.hp = 0; L.bossDead = true; }
    G.titleStep(S, dt);
    if (h0 < 0 && S.gen * T > P.arena.x1 + G.LVL_EXITW + 40) h0 = holes();
  }
  for (let i = 0; i < 30 * 3; i++) G.titleStep(S, dt);
  check(`seed ${seed}: the team gets to the exit pad`, L.phase === 'exit' || L.phase === 'gone', L.phase);
  check(`seed ${seed}: the ground under it as it was`, h0 >= 0 && holes() <= h0 + 2, [h0, holes()]);
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
