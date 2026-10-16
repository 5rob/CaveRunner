// Coal Seams' stalactites and stalagmites (grem, chunk C2; art/titlescene.js stalLen, stalCol): solid rock points off the
// Cavern's undersides (roof, boulders' bottoms) and tops (floor, boulders' tops), a lighter tip (TM.ROCKL), only in the
// Cavern (the spider zone) of Coal Seams. Every loop has a frame cap.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const TC = G.TCELL, TM = G.TM;
G.DEV.autoFoeDmg = 0;

/** walk a level, sampling every column as it comes into view @param {number} seed @param {number} lv */
function walk(seed, lv) {
  const run = G.newRun(seed);
  const S = G.levelScene(190, seed, 1, undefined, run.players, lv, run, true), L = G.levelState(S);
  S.spawn = 1e9; S.foes.length = 0;
  const cols = new Map();
  for (let i = 0; i < 3000 && S.scroll < L.plan.arena.x0 - 300; i++) {
    S.scroll += 3; G.titleStep(S, 1 / 60); S.foes.length = 0; S.props.length = 0;
    for (const r of S.runners) { r.x = 40; r.y = 10; r.out = true; }
    const c0 = Math.floor((S.scroll + G.TITLE_VW - 8) / TC);
    for (let c = c0 - 3; c <= c0; c++) if (!cols.has(c)) {
      const a = []; for (let r = 0; r < S.rows; r++) a.push(G.titleCell(S, c, r));
      cols.set(c, { z: G.titleZoneSpan(c * TC, S).z, coal: G.coalAt(S, c * TC), a });
    }
  }
  return { S, cols };
}

const W = walk(23, 2);
let cav = 0, tips = 0, tipsOut = 0, solidPts = 0, pts = 0;
const hang = [], rise = [];
for (const [c, q] of W.cols) {
  const t = q.a.filter(m => m === TM.ROCKL).length;
  if (q.z === 'spider' && q.coal) {
    cav++; tips += t;
    const Zn = G.titleZoneSpan(c * TC, W.S), wx = c * TC;
    const st = G.stalCol(wx, Zn, G.titleCeil(wx, W.S), G.titleFloor(wx, W.S), W.S.rows);
    // the points as the scene made them: solid (where nothing carved them since)
    for (let r = 0; r < st.length; r++) if (st[r] > 1) { pts++; if (G.TITLE_SOLID[q.a[r]]) solidPts++; }
    // runs of point cells: hanging (rock over them) or rising (rock under them)
    for (let r = 1; r < st.length - 1; r++) if (st[r] > 1 && st[r - 1] <= 1) {
      let e = r; while (e < st.length && st[e] > 1) e++;
      if (st[r - 1] === 1) hang.push((e - r) * TC); else if (e < st.length && st[e] === 1) rise.push((e - r) * TC);
      r = e;
    }
  } else tipsOut += t;
}
check('the walk met the Cavern on Coal Seams', cav > 50, cav);
check('points there, with lighter tips', tips > 20, tips);
check('the points are solid', pts > 50 && solidPts / pts > 0.95, { pts, solidPts });
check('stalactites (hanging) and stalagmites (rising) both', hang.length > 10 && rise.length > 10, { hang: hang.length, rise: rise.length });
const avg = (/** @type {number[]} */ a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
check('stalagmites shorter than stalactites on average', avg(rise) < avg(hang), { hang: +avg(hang).toFixed(1), rise: +avg(rise).toFixed(1) });
check('no tips outside the Cavern on Coal Seams', tipsOut === 0, tipsOut);
// mossy Level 1: its Cavern (if met) keeps its old spikes, no points
const M = walk(23, 1);
let mt = 0, msp = 0;
for (const q of M.cols.values()) { mt += q.a.filter(m => m === TM.ROCKL).length; if (q.z === 'spider') msp++; }
check('none on another level', mt === 0, { tips: mt, cavernCols: msp });
// the knobs: density 0 makes none
{
  const D = G.DEV, d0 = D.coalStalDense, m0 = D.coalMiteDense;
  D.coalStalDense = 0; D.coalMiteDense = 0;
  let n = 0;
  for (const [c, q] of W.cols) if (q.z === 'spider' && q.coal) {
    const wx = c * TC, st = G.stalCol(wx, G.titleZoneSpan(wx, W.S), G.titleCeil(wx, W.S), G.titleFloor(wx, W.S), W.S.rows);
    for (const v of st) if (v > 1) n++;
  }
  check('density 0: no points', n === 0, n);
  D.coalStalDense = d0; D.coalMiteDense = m0;
}
if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('all ok');
