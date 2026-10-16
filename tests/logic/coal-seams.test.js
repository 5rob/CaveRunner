// Coal Seams' burnable coal (grem, step 2; art/titlescene.js coalCell): patches and long veins of coal through level 2's
// rock, the same each time for a seed; solid like rock; a fourth fire fuel that burns out to open air (a tunnel); plain rock
// beside it never burns; a few seams alight from the start (smouldering). Every loop has a frame cap.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV, TM = G.TM, TC = G.TCELL;
D.autoFoeDmg = 0;

/** @param {number} lv */
function scene(lv) {
  const run = G.newRun(9);
  const S = G.levelScene(190, 23, 1, undefined, run.players, lv, run, true);
  S.spawn = 1e9; S.foes.length = 0;
  return S;
}
// count the materials along the stretch before the arena, and whether anything was alight from the start
function walk(S) {
  const L = G.levelState(S), mats = new Map();
  let x = 0, lit = 0;
  for (let i = 0; i < 3000 && S.scroll < L.plan.arena.x0 - 300; i++) {
    S.scroll += 3; G.titleStep(S, 1 / 60); S.foes.length = 0;
    for (const r of S.runners) { r.x = 40; r.y = 10; r.out = true; }
    const c0 = Math.floor(S.scroll / TC), c1 = c0 + Math.floor(G.TITLE_VW / TC);
    for (let c = Math.max(c0, x); c < c1; c++) for (let r = 0; r < S.rows; r++) { const m = G.titleCell(S, c, r); mats.set(m, (mats.get(m) || 0) + 1); }
    x = Math.max(x, c1);
    lit = Math.max(lit, S.fire.filter(f => G.titleCell(S, f.c, f.r) === TM.COAL).length);
  }
  return { mats, lit };
}
const S = scene(2), w = walk(S), coal = w.mats.get(TM.COAL) || 0, rock = w.mats.get(TM.ROCK) || 0;
const share = coal / (coal + rock);
check('coal through Coal Seams\' rock: about a fifth', share > 0.1 && share < 0.4, share.toFixed(3));
check('coal is solid', !!G.TITLE_SOLID[TM.COAL]);
check('some seams smouldering (alight with no shot fired)', w.lit > 0, w.lit);
// the same seed: the same seams (a fresh scene's first screen)
const A = scene(2), B = scene(2);
const cellsAt = T => { const o = []; for (let c = 0; c < 200; c++) for (let r = 0; r < T.rows; r++) o.push(G.titleCell(T, c + 20, r)); return o.join(''); };
check('the same level, the same seams', cellsAt(A) === cellsAt(B) && cellsAt(A).includes(String(TM.COAL)));
// level 1 (Mossy Caves): no coal
const w1 = walk(scene(1));
check('no coal in Mossy Caves', !w1.mats.get(TM.COAL), w1.mats.get(TM.COAL));

// ---- a lit coal cell burns out to open air; plain rock beside a fire stays (in the still scene) ----
const T = scene(2);
T.lvl.step = null; T.pace = 0; T.still = true; T.props.length = 0; T.fire.length = 0; T.burning.clear();
// a block of coal with rock round it, inside the made columns
const cc = Math.floor((T.scroll + 110) / TC), rr = Math.floor(T.rows / 2);
const set = (c, r, m) => { T.cells[((c % T.ncol + T.ncol) % T.ncol) * T.rows + r] = m; };
for (let dc = -8; dc <= 8; dc++) for (let dr = -8; dr <= 8; dr++) set(cc + dc, rr + dr, Math.abs(dc) <= 4 && Math.abs(dr) <= 4 ? TM.COAL : TM.ROCK);
check('(the test block is coal in rock)', G.titleCell(T, cc, rr) === TM.COAL && G.titleCell(T, cc + 6, rr) === TM.ROCK, G.titleCell(T, cc, rr));
D.fireCoalLo = D.fireCoalHi = 0.3; D.coalCatch = 3;
G.titleIgnite(T, (cc + 0.5) * TC - T.scroll, (rr + 0.5) * TC, 1, 1);
for (let i = 0; i < 60 * 20 && T.fire.length; i++) G.titleStep(T, 1 / 60);
let air = 0, rockLeft = 0;
for (let dc = -8; dc <= 8; dc++) for (let dr = -8; dr <= 8; dr++) {
  const m = G.titleCell(T, cc + dc, rr + dr);
  if (Math.abs(dc) <= 4 && Math.abs(dr) <= 4) { if (m === TM.AIR) air++; } else if (m === TM.ROCK) rockLeft++;
}
check('the lit coal burnt out to open air (a tunnel): most of the block', air >= 45, air);   // (of 81: how far a fire runs is chance)
check('… and the plain rock round it never burnt', rockLeft === 17 * 17 - 81, rockLeft);

process.exitCode = fails ? 1 : 0;
console.log(fails ? fails + ' failed' : 'all passed');
