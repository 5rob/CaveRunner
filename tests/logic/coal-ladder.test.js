// Coal Seams' Cavern ladders and timber (grem, chunk C3; art/titlescene.js cavPlan, art/timber.js timberSlant): background wood
// (not solid, burns as timber), only in the Cavern (the spider zone) of Coal Seams; the Cavern's timber count follows its knob.
// Every loop has a frame cap.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const TC = G.TCELL, TM = G.TM;
G.DEV.autoFoeDmg = 0;

/** walk a level, keeping every Cavern set (lane -1 timber, -2 ladders) as it is planned @param {number} seed @param {number} lv */
function walk(seed, lv) {
  const run = G.newRun(seed);
  const S = G.levelScene(190, seed, 1, undefined, run.players, lv, run, true), L = G.levelState(S);
  S.spawn = 1e9; S.foes.length = 0;
  const sets = { '-1': new Set(), '-2': new Set() };
  let lone = 0;
  for (let i = 0; i < 3000 && S.scroll < L.plan.arena.x0 - 300; i++) {
    S.scroll += 3; G.titleStep(S, 1 / 60); S.foes.length = 0; S.props.length = 0;
    for (const r of S.runners) { r.x = 40; r.y = 10; r.out = true; }
    for (const n of ['-1', '-2']) for (const T of (S.tim && S.tim[n] ? S.tim[n].sets : [])) sets[n].add(T);
    for (const T of (S.tim && S.tim[0] ? S.tim[0].sets : [])) if (G.titleZoneSpan(T.mid * TC, S).z === 'spider') lone++;
  }
  return { S, tim: [...sets['-1']], lad: [...sets['-2']], lone };
}

const W = walk(23, 2);
check('ladders in the Cavern', W.lad.length >= 3, W.lad.length);
check('timber in the Cavern', W.tim.length >= 6, W.tim.length);
check('no old lone sets in the Cavern (it has its own)', W.lone === 0, W.lone);
let out = 0, cells = 0, bad = 0;
for (const T of [...W.lad, ...W.tim]) for (const [c, col] of T.cols) {
  const wx = c * TC, Z = G.titleZoneSpan(wx, W.S);
  if (Z.z !== 'spider' || !G.coalAt(W.S, wx)) out++;
  for (const m of col.values()) { cells++; if (G.TITLE_SOLID[m] || (m !== TM.BEAM && m !== TM.BEAMD)) bad++; }
}
check('every Cavern set only in the Cavern on Coal Seams', out === 0, out);
check('all background timber (not solid, beam / beamD)', cells > 200 && bad === 0, { cells, bad });
// a ladder's two rails and its rungs: a row with 5 cells across, every third row
{
  const T = W.lad[0], rows = new Map();
  for (const [c, col] of T.cols) for (const r of col.keys()) rows.set(r, (rows.get(r) || 0) + 1);
  const rungs = [...rows.values()].filter(v => v >= 5).length, rails = [...rows.values()].filter(v => v === 2).length;
  check('a ladder: rails and rungs', rungs >= 2 && rails >= 4, { rungs, rails });
}
// a ladder burns: lit in a sandbox scene, its wood goes
{
  const S = G.levelScene(200, 5, 1, undefined, G.newRun(5).players);
  S.lvl.step = null; S.pace = 0; S.spawn = 1e9; S.props.length = 0; S.foes.length = 0; S.still = true;
  const c = Math.floor((S.scroll + 100) / TC);
  let r0 = -1;
  for (let r = 10; r < S.rows - 30 && r0 < 0; r++) { let ok = true; for (let q = r; q < r + 20; q++) for (let d = 0; d < 5; d++) if (G.TITLE_SOLID[G.titleCell(S, c + d, q)]) ok = false; if (ok) r0 = r; }
  const T = G.timberSlant((cc, r) => r >= r0 + 20 || r < r0, c, r0 + 19, 0.1, 5, 4, 30, { L: TM.BEAM, D: TM.BEAMD });
  const put = [];
  if (T) for (const [cc, col] of T.cols) for (const [r, m] of col) { S.cells[(((cc % S.ncol) + S.ncol) % S.ncol) * S.rows + r] = m; put.push([cc, r]); }
  const wood = () => put.filter(([cc, r]) => { const m = G.titleCell(S, cc, r); return m === TM.BEAM || m === TM.BEAMD; }).length;
  const n0 = wood();
  G.titleIgnite(S, (c + 2) * TC - S.scroll, (r0 + 18) * TC, 4, 1);
  for (let i = 0; i < 60 * 20; i++) G.titleStep(S, 1 / 60);
  check('a ladder burns away', !!T && n0 > 30 && wood() < n0 * 0.3, { n0, left: wood() });
}
// the knob: more Cavern supports a screen, more sets
{
  const D = G.DEV, s0 = D.coalCavSup;
  D.coalCavSup = 1; const a = walk(23, 2).tim.length;
  D.coalCavSup = 6; const b = walk(23, 2).tim.length;
  D.coalCavSup = s0;
  check('Cavern timber rises with its knob', b > a * 1.5, { one: a, six: b });
}
// another level: none
{
  const M = walk(23, 1);
  check('no Cavern ladders or timber off Coal Seams', M.lad.length === 0 && M.tim.length === 0, { lad: M.lad.length, tim: M.tim.length });
}
if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('all ok');
