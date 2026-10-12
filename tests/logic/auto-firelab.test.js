// Dev → Fire sim's room (art/firelab.js, owner v1.0.56): a still, long room of things that burn under Auto's fire rules
// (S.lab), each with an ignition point; and the leaves passing fire on (titlescene.js stepFire: every point of a burning
// stretch, leaves too, lights fuel cells within DEV.autoLeafReach at autoLeafLight a tick). Frame-capped.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV, dt = 1 / 30, VH = 120;

{
  const { S, pts } = G.labScene(VH, 3);
  check('a still room: no players, no creatures, Auto fire rules', S.lab && !S.runners.length && !S.foes.length && G.autoOn(S));
  check('a test object every 120 along it', pts.length >= 10, pts.length);
  const kinds = new Set();
  for (const s of [3, 4, 5]) for (const p of G.labScene(VH, s).pts) kinds.add(p.kind);
  check('every kind turns up', ['vines', 'arch', 'webs', 'moss', 'crate', 'frame', 'grass', 'mix'].every(k => kinds.has(k)), [...kinds]);
  const x0 = S.scroll;
  for (let i = 0; i < 60; i++) G.titleStep(S, dt);
  check('it holds still', S.scroll === x0 && !S.foes.length);
  check('the pan stays in the room', G.labClamp(-50) === 0 && G.labClamp(1e6) === G.LAB_W - G.TITLE_VW);
}
// Fire at each kind: something burns
for (const kind of ['vines', 'webs', 'crate', 'moss', 'arch']) {
  let p = null, S = null;
  for (let s = 1; s < 20 && !p; s++) { const m = G.labScene(VH, s); p = m.pts.find(q => q.kind === kind); S = m.S; }
  S.scroll = G.labClamp(p.x - G.TITLE_VW / 2);
  const b0 = S.burnt;
  G.titleIgnite(S, p.x - S.scroll, p.y, 6, 1);
  for (let i = 0; i < 30; i++) G.titleStep(S, dt);
  check(`Fire at ${kind}: it burns`, S.burnt > b0 && (S.fire.length > 0 || S.props.some(q => q.burn) || S.webs.length < 9), S.burnt - b0);
}
// the leaves light the fuel beside them: a vine, a column of timber a leaf's reach off its stem (out of the stem's reach)
const leafTest = light => {
  const keep = D.autoLeafLight; D.autoLeafLight = light;
  const { S } = G.labScene(VH, 3);
  S.props.length = 0; S.webs.length = 0; S.fire.length = 0; S.burning.clear();
  const x = 300, T = G.TCELL;
  S.props.push({ k: 'climb', st: 'vine', ox: x, x: 0, y: G.LAB_ROOF, len: 60, seed: 0.3, side: 1, burn: 1, ac: Math.floor(x / T), ar: Math.floor((G.LAB_ROOF - 1) / T) });
  const c = Math.floor((x + 7) / T);
  for (let r = Math.floor(30 / T); r < Math.floor(60 / T); r++) S.cells[(((c % S.ncol) + S.ncol) % S.ncol) * S.rows + r] = G.TM.WOOD;
  S.scroll = G.labClamp(x - 110);
  for (let i = 0; i < 45 && !S.fire.length; i++) G.titleStep(S, dt);
  D.autoLeafLight = keep;
  return S.fire.length;
};
check('a burning vine\'s leaves light timber beside it', leafTest(0.3) > 0);
check('… not with autoLeafLight 0', leafTest(0) === 0);
// (v1.0.57) burning through: with autoBurnCut a lit vine drops pieces below the cut, turning as they fall, and they land
const cutTest = P => {
  const keep = D.autoBurnCut; D.autoBurnCut = P;
  const { S } = G.labScene(VH, 3);
  S.props.length = 0; S.webs.length = 0;
  S.props.push({ k: 'climb', st: 'vine', ox: 300, x: 0, y: G.LAB_ROOF, len: 80, seed: 0.3, side: 1, burn: 1, ac: Math.floor(300 / G.TCELL), ar: Math.floor((G.LAB_ROOF - 1) / G.TCELL) });
  S.scroll = G.labClamp(190);
  const seen = new Set();
  for (let i = 0; i < 30 * 6; i++) { G.titleStep(S, dt); for (const p of S.props) if (p.drop && p.rv != null) seen.add(p); }
  D.autoBurnCut = keep;
  return [...seen];
};
const cut = cutTest(0.5), none = cutTest(0);
check('burns through: pieces fall away, each turning its own way', cut.length >= 2 && new Set(cut.map(p => p.rv.toFixed(3))).size === cut.length && cut.some(p => Math.abs(p.rot) > 0.05), cut.length);
check('… and land (gone)', cut.every(p => p.gone));
check('… none with autoBurnCut 0', none.length === 0);
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
