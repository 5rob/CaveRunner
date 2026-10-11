// Deeper is harder (art/titlescene.js deepK, owner v1.0.52: strong guns blasted the cave away to the bottom edge): a blast
// bites less toward a level's bottom edge (DEV.autoHardDeep) and not at all in its last autoHardEdge; the saw as ever.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV;
const S = G.levelScene(400, 5, 1);
for (let i = 0; i < 30; i++) G.titleStep(S, 1 / 30);
S.still = true;
const T = G.TCELL, cx = 100, c0 = Math.floor((cx + S.scroll) / T);
/** @param {number} c @param {number} r @param {number} m */
const setCell = (c, r, m) => { S.cells[(((c % S.ncol) + S.ncol) % S.ncol) * S.rows + r] = m; };
/** solid rock round (cx, y), a blast (or the saw) there; the cells it took down column c0 */
const hole = (y, rim = true) => {
  const r0 = Math.floor(y / T);
  for (let dc = -30; dc <= 30; dc++) for (let dr = Math.max(0, r0 - 20); dr < S.rows; dr++) setCell(c0 + dc, dr, G.TM.ROCK);
  G.titleCarve(S, cx, y, 24, rim);
  let n = 0; for (let dr = Math.max(0, r0 - 20); dr < S.rows; dr++) if (G.titleCell(S, c0, dr) === G.TM.AIR) n++;
  return n;
};
const edge = S.vh - D.autoHardEdge;
check('full bite well above the bottom, about half midway, none at the edge', G.deepK(S, edge - D.autoHardDeep - 1) === 1
  && Math.abs(G.deepK(S, edge - D.autoHardDeep / 2) - 0.5) < 0.05 && G.deepK(S, S.vh - 2) === 0);
check('the title (no level), an old-height level: never', G.deepK({ vh: 190, top: 45, bot: 175 }, 189) === 1 && G.deepK({ lvl: 1, vh: 190, top: 45, bot: 175 }, 180) === 1);
const high = hole(150), low = hole(edge - 10);
check('a blast high up: the whole radius (as before)', Math.abs(high - 24) <= 1, high);
check('… near the bottom: a much smaller hole', low > 0 && low < high / 3, low);
hole(S.vh - 4);
check('… and never into the bottom edge', [...Array(Math.floor(D.autoHardEdge / T)).keys()].every(k => G.titleCell(S, c0, S.rows - 1 - k) !== G.TM.AIR));
const saw = hole(edge - 30, false);
check('the saw cuts down there as ever', saw >= 20, saw);
// (v1.0.54, owner: the ground under the exit pad got blasted out) the hard line rises to the exit pad's floor
{
  const P = G.levelState(S).plan, fx = P.exitX, fy = G.titleFloor(fx, S);
  check('under the exit pad: nothing bites at its floor or below', G.deepK(S, fy, fx) === 0 && G.deepK(S, fy + 30, fx) === 0, G.deepK(S, fy, fx));
  check('… a little over it, less than out in the level', G.deepK(S, fy - 20, fx) < G.deepK(S, fy - 20, P.z0 + 200), [G.deepK(S, fy - 20, fx), G.deepK(S, fy - 20, P.z0 + 200)]);
  check('… sloping back down past it', G.levelHardY(S, P, P.arena.x1 - 25) > fy && G.levelHardY(S, P, P.arena.x1 - 25) < S.vh - D.autoHardEdge && G.levelHardY(S, P, P.arena.x1 - 200) === S.vh - D.autoHardEdge);
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
