// Dev → Fire sim's room (art/firelab.js, owner v1.0.56, spots v1.0.58): a still, long room, each kind of thing that burns in its own spot under Auto's fire rules
// (S.lab), each with an ignition point; and the leaves passing fire on (titlescene.js stepFire: every point of a burning
// stretch, leaves too, lights fuel cells within DEV.autoLeafReach at autoLeafLight a tick). Frame-capped.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV, dt = 1 / 30, VH = 120;
// the fire knobs these were measured at (the owner retunes the defaults: v1.0.68 slowed the burn)
Object.assign(D, { autoVineFire: 3, autoVineSpread: 24, autoFireJump: 14, autoFireSpread: 0.1, autoWebFire: 3, autoSilkSpread: 24, autoSilkCut: 0.015, autoVineAsh: 6 });

{
  const { S, pts } = G.labScene(VH, 3);
  check('a still room: no players, no creatures, Auto fire rules', S.lab && !S.runners.length && !S.foes.length && G.autoOn(S));
  check('a spot for each kind, 2/3 of the screen wide, in order', pts.map(p => p.kind).join() === G.LAB_KINDS.join() && G.LAB_SPOT === Math.round(G.TITLE_VW * 2 / 3), pts.map(p => p.kind));
  // (v1.0.58) each spot keeps to itself: no fuel cell, plant or web line in the gaps between
  const T = G.TCELL, inSpot = x => G.LAB_SPOTS.some(q => x >= q.x0 - 8 && x < q.x0 + G.LAB_SPOT + 8);
  let stray = 0;
  for (let c = 0; c < Math.ceil(G.LAB_W / T); c++) for (let r = 0; r < S.rows; r++) { const m = G.titleCell(S, c, r); if ([G.TM.MOSS, G.TM.WOOD, G.TM.BEAM, G.TM.BEAMD, G.TM.GRASS].includes(m) && !inSpot((c + 0.5) * T)) stray++; }
  const strayP = S.props.filter(p => !inSpot(p.ox) || (p.arc && !inSpot(p.ox + p.span))).length, strayW = S.webs.filter(L => !inSpot(L.a0x) || !inSpot(L.b0x)).length;
  check('nothing that burns between the spots', !stray && !strayP && !strayW, { stray, strayP, strayW });
  // (v1.0.62) and it keeps LAB_IN of the spot's width in from each side
  const inner = x => G.LAB_SPOTS.some(q => x >= q.x0 + G.LAB_SPOT * G.LAB_IN - 1.5 && x <= q.x0 + G.LAB_SPOT * (1 - G.LAB_IN) + 1.5);
  let edge = 0;
  for (let c = 0; c < Math.ceil(G.LAB_W / T); c++) for (let r = 0; r < S.rows; r++) { const m = G.titleCell(S, c, r); if ([G.TM.MOSS, G.TM.WOOD, G.TM.BEAM, G.TM.BEAMD, G.TM.GRASS].includes(m) && !inner((c + 0.5) * T)) edge++; }
  const edgeP = S.props.filter(p => !inner(p.ox) || (p.arc && !inner(p.ox + p.span))).length, edgeW = S.webs.filter(L => !inner(L.a0x) || !inner(L.b0x)).length;
  check('… and keeps 10% in from each side of its spot', !edge && !edgeP && !edgeW, { edge, edgeP, edgeW });
  check('the vines spot: hanging vines and arches', S.props.filter(p => p.st === 'vine' && !p.arc && !p.host).length >= 8 && S.props.filter(p => p.arc).length === 3);
  check('the webs spot: single strands and a dense hatch', S.webs.length >= 20);
  check('the timber spot: lanterns hanging off it', S.props.filter(p => p.k === 'lamp').length === 3);
  const x0 = S.scroll;
  for (let i = 0; i < 60; i++) G.titleStep(S, dt);
  check('it holds still, the lanterns hang on', S.scroll === x0 && !S.foes.length && S.props.filter(p => p.k === 'lamp' && !p.gone && !p.fall).length === 3);
  check('the pan stays in the room', G.labClamp(-50) === 0 && G.labClamp(1e6) === G.LAB_W - G.TITLE_VW);
}
// each spot lit at its point: something burns
for (const kind of G.LAB_KINDS) {
  const { S, pts } = G.labScene(VH, 4), p = pts.find(q => q.kind === kind);
  S.scroll = G.labClamp(p.x - G.TITLE_VW / 2);
  const b0 = S.burnt;
  G.titleIgnite(S, p.x - S.scroll, p.y, 6, 1);
  for (let i = 0; i < 30; i++) G.titleStep(S, dt);
  check(`Fire at ${kind}: it burns`, S.burnt > b0, S.burnt - b0);
}
// (v1.0.58) Fire held: jets out of the floor across the view, flames up them, things catch; let go: they stop
{
  const L = G.labScene(VH, 5), S = L.S, sp = G.LAB_SPOTS.find(q => q.kind === 'grass');
  S.scroll = G.labClamp(sp.x0 + G.LAB_SPOT / 2 - G.TITLE_VW / 2);
  const b0 = S.burnt;
  let most = 0;
  for (let i = 0; i < 60; i++) { G.titleStep(S, dt); G.labStep(L, dt, true); most = Math.max(most, L.jets.length); }
  check('held: jets come and go', most >= 1 && S.parts.some(p => p.kind === 'flame'), most);
  check('… and set the grass alight', S.burnt > b0, S.burnt - b0);
  for (let i = 0; i < 90; i++) { G.titleStep(S, dt); G.labStep(L, dt, false); }
  check('let go: no more jets', L.jets.length === 0);
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
const bendOf = p => { const P = p.rp, n = P.length / 2 - 1; if (n < 2) return 0; const ax = P[0], ay = P[1], bx = P[2 * n], by = P[2 * n + 1], L = Math.hypot(bx - ax, by - ay) || 1; let m = 0; for (let i = 1; i < n; i++) m = Math.max(m, Math.abs((P[2 * i] - ax) * (by - ay) - (P[2 * i + 1] - ay) * (bx - ax)) / L); return m; };
const cutTest = P => {
  const keep = D.autoBurnCut; D.autoBurnCut = P;
  const { S } = G.labScene(VH, 3);
  S.props.length = 0; S.webs.length = 0;
  S.props.push({ k: 'climb', st: 'vine', ox: 300, x: 0, y: G.LAB_ROOF, len: 80, seed: 0.3, side: 1, burn: 1, ac: Math.floor(300 / G.TCELL), ar: Math.floor((G.LAB_ROOF - 1) / G.TCELL) });
  S.scroll = G.labClamp(190);
  const seen = new Set();
  for (let i = 0; i < 30 * 6; i++) { G.titleStep(S, dt); for (const p of S.props) if (p.drop && p.rp) { seen.add(p); p.bend = Math.max(p.bend || 0, bendOf(p)); } }
  D.autoBurnCut = keep;
  return [...seen];
};
const cut = cutTest(0.5), none = cutTest(0);
check('burns through: pieces fall away as loose ropes that bend (v1.0.63, not sticks)', cut.length >= 2 && cut.some(p => p.bend > 2), cut.map(p => +(p.bend || 0).toFixed(1)));
check('… and burn away (gone)', cut.every(p => p.gone));
check('… none with autoBurnCut 0', none.length === 0);
// (v1.0.58) burning pixels twinkle: over 2 s (40 fire ticks) nearly every square changes colour several times; knobs 0: still
const changes = () => { let n = 0; for (let c = 0; c < 20; c++) for (let r = 0; r < 10; r++) { let k = 0, was = G.fireTone(c, r, 0); for (let t = 1; t <= 40; t++) { const v = G.fireTone(c, r, t); if (v !== was) k++; was = v; } if (k >= 3) n++; } return n / 200; };
const tw = changes();
const keepT = [D.fireTwinkle, D.fireFlare]; D.fireTwinkle = 0; D.fireFlare = 0;
const still = changes();
[D.fireTwinkle, D.fireFlare] = keepT;
check('burning pixels twinkle (most squares change 3+ times in 2 s)', tw > 0.8, +tw.toFixed(2));
check('… still with the twinkle knobs at 0', still === 0, still);
// (v1.0.60) flame specks and smoke come from Dev → Fire: flames and smoke: sizes and lives in the knobs' ranges; rate 0: none
const fxRun = (flRate, smRate) => {
  const keep = [D.fxFlRate, D.fxSmRate]; D.fxFlRate = flRate; D.fxSmRate = smRate;
  const L = G.labScene(VH, 6), S = L.S, sp = G.LAB_SPOTS.find(q => q.kind === 'timber');
  S.scroll = G.labClamp(sp.x0 + G.LAB_SPOT / 2 - G.TITLE_VW / 2);
  G.titleIgnite(S, sp.x0 + 20 - S.scroll, L.pts[2].y, 8, 1);
  const seen = [];
  for (let i = 0; i < 45; i++) { G.titleStep(S, dt); for (const p of S.parts) if (p.fx && !seen.includes(p)) seen.push({ kind: p.kind, r: p.r, max: p.max, a: p.a, fx: p.fx, p }); }
  [D.fxFlRate, D.fxSmRate] = keep;
  return seen;
};
const fx = fxRun(1, 1), fl = fx.filter(q => q.kind === 'flame'), sm = fx.filter(q => q.kind === 'fsmoke');
check('flame specks: rolled from the knobs', fl.length > 5 && fl.every(q => q.r >= D.fxFlSizeLo - 1e-9 && q.r <= D.fxFlSizeHi + 1e-9 && q.max >= D.fxFlLifeLo - 1e-9 && q.max <= D.fxFlLifeHi + 1e-9), fl.length);
check('smoke: rolled from the knobs', sm.length > 0 && sm.every(q => q.max >= D.fxSmLifeLo - 1e-9 && q.max <= D.fxSmLifeHi + 1e-9 && q.a <= 1 && q.a >= 1 - D.fxSmAlphaJit - 1e-9), sm.length);
const off = fxRun(0, 0);
check('… none with their rates at 0', off.length === 0, off.length);
// (v1.0.61) silk on its own knobs: a burning strand smokes at autoSilkSmoke; its burn-through is autoSilkCut, not the vines'
const silkRun = (smoke, cut, vineCut) => {
  const keep = [D.autoSilkSmoke, D.autoSilkCut, D.autoBurnCut]; D.autoSilkSmoke = smoke; D.autoSilkCut = cut; D.autoBurnCut = vineCut;
  const { S } = G.labScene(VH, 3);
  S.props.length = 0; S.webs.length = 0; S.parts.length = 0;
  S.props.push({ k: 'climb', st: 'silk', ox: 300, x: 0, y: G.LAB_ROOF, len: 70, seed: 0.3, side: 1, burn: 1, ac: Math.floor(300 / G.TCELL), ar: Math.floor((G.LAB_ROOF - 1) / G.TCELL) });
  S.scroll = G.labClamp(190);
  let puffs = 0, drops = 0;
  const seen = new Set();
  for (let i = 0; i < 30 * 3; i++) {
    G.titleStep(S, dt);
    for (const p of S.parts) if (p.kind === 'fsmoke' && !seen.has(p)) { seen.add(p); puffs++; }
    for (const p of S.props) if (p.drop && p.rp && !seen.has(p)) { seen.add(p); drops++; }
  }
  [D.autoSilkSmoke, D.autoSilkCut, D.autoBurnCut] = keep;
  return { puffs, drops };
};
const sm1 = silkRun(30, 0, 0), sm0 = silkRun(0, 0, 0);
check('a burning strand smokes (autoSilkSmoke), not at 0', sm1.puffs >= 3 && sm0.puffs === 0, [sm1.puffs, sm0.puffs]);
check("silk burns through by autoSilkCut, not the vines' knob", silkRun(0, 0.5, 0).drops > 0 && silkRun(0, 0, 0.5).drops === 0);
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
