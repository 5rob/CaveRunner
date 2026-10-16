// Coal Seams' glow worms, stage a (grem, chunk C5a; creatures/glowworm.js, stepped by art/titlescene.js wormsStep): the
// inchworm gait on hand-made rock and in a real Coal Seams level. The gripping foot never slips during its half, the body's
// bones stay their length after FABRIK, it moves forward along a floor, never ends inside rock, and gets round a corner onto
// a wall. Every loop has a frame cap.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV;
D.autoFoeDmg = 0; D.glowTurn = 0;
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const dt = 1 / 60;

// a hand-made room: floor at y 100, a wall at x 120 (rock right of it), roof at y 0
const solid = (x, y) => y >= 100 || x >= 120 || y < 0 || x < -200;
const w = G.newWorm(0, 99.5, 1, solid, rnd);
check('a worm made on the floor', !!w && Math.abs(w.r.ny + 1) < 1e-6 && w.f.x > w.r.x, w && { r: w.r, f: w.f });
let slip = 0, inRock = 0, boneErr = 0, endErr = 0, omega = false, maxGap = 0, minGap = 1e9, x0 = w.r.x;
let grip = null, gripPhase = null;
for (let i = 0; i < 60 * 6; i++) {
  const ext = w.th < Math.PI, g = ext ? w.r : w.f, ph = ext ? 'e' : 'c';
  if (ph !== gripPhase) { gripPhase = ph; grip = { o: g, x: g.x, y: g.y }; }
  G.stepWorm(w, dt, solid, rnd);
  if (w.th < Math.PI === ext) { const h = ext ? w.r : w.f; slip = Math.max(slip, Math.hypot(h.x - grip.x, h.y - grip.y)); }
  for (const p of [w.r, w.f, w.rl, w.fl, ...w.pts]) if (solid(p.x, p.y)) inRock++;
  for (let k = 0; k < 5; k++) boneErr = Math.max(boneErr, Math.abs(Math.hypot(w.pts[k + 1].x - w.pts[k].x, w.pts[k + 1].y - w.pts[k].y) - D.glowLen / 5));
  const e = { x: w.fl.x + w.f.nx * D.glowFoot, y: w.fl.y + w.f.ny * D.glowFoot };
  endErr = Math.max(endErr, Math.hypot(w.pts[5].x - e.x, w.pts[5].y - e.y));
  const gp = w.f.x - w.r.x; maxGap = Math.max(maxGap, gp); minGap = Math.min(minGap, gp);
  // an Ω: some joint further out along the chord than the end joints (the loop wider than its neck)
  if (w.pts.some(p => p.x < w.pts[0].x - 0.3) && w.pts.some(p => p.x > w.pts[5].x + 0.3)) omega = true;
}
check('the gripping foot never slips during its half', slip < 1e-9, slip);
check('every bone its length after FABRIK', boneErr < 1e-6, boneErr);
check('… and the chain reaches the front foot', endErr < 0.05, +endErr.toFixed(4));
const A = D.glowStride / 2, dMid = (D.glowDMin + D.glowDMax) / 2;
check('foot gap swings dMid ± stride/2 on the flat', Math.abs(maxGap - (dMid + A)) < 0.6 && Math.abs(minGap - (dMid - A)) < 0.6, { minGap: +minGap.toFixed(2), maxGap: +maxGap.toFixed(2) });
check('feet close: the body loops into an Ω', omega);
const cycles = 6 * D.glowCrank / (2 * Math.PI), moved = w.r.x - x0;
check('it moves forward along the floor, about a stride a cycle', moved > cycles * D.glowStride * 0.7, { moved: +moved.toFixed(1), cycles: +cycles.toFixed(2) });
check('never inside rock', inRock === 0, inRock);

// round the corner: on along the floor into the wall, up it
let up = false;
for (let i = 0; i < 60 * 90 && !up; i++) {
  G.stepWorm(w, dt, solid, rnd);
  for (const p of [w.r, w.f, w.rl, w.fl, ...w.pts]) if (solid(p.x, p.y)) inRock++;
  if (w.r.nx < -0.9 && w.f.nx < -0.9 && w.r.y < 80) up = true;
}
check('round the corner and up the wall (both feet on it)', up, { r: w.r, f: w.f });
check('… never inside rock', inRock === 0, inRock);
// on up to the roof, and along it (upside down)
let roof = false;
for (let i = 0; i < 60 * 150 && !roof; i++) { G.stepWorm(w, dt, solid, rnd); if (w.r.ny > 0.9 && w.f.ny > 0.9 && w.r.x < 100) roof = true; }
check('… then round onto the roof and along it', roof, { r: w.r, f: w.f });
// a step down off a ledge (a convex corner): over the edge and down its side
const ledge = (x, y) => (x < 50 ? y >= 60 : y >= 100) || x < -200 || x >= 200;
const w2 = G.newWorm(20, 59.5, 1, ledge, rnd);
let down = false, bad = 0;
for (let i = 0; i < 60 * 40 && !down; i++) { G.stepWorm(w2, dt, ledge, rnd); for (const p of [w2.r, w2.f, ...w2.pts]) if (ledge(p.x, p.y)) bad++; if (w2.r.nx > 0.9 && w2.r.y > 75) down = true; }
check('over a ledge (a convex corner) and down its side', down && bad === 0, { down, bad, r: w2.r });

// a Grem level at level 2 (Coal Seams): worms made as it goes, about DEV.glowPerScreen a screen, never in rock
const run = G.newRun(9);
const S = G.levelScene(190, 23, 1, undefined, run.players, 2, run, true), L = G.levelState(S);
S.spawn = 1e9; S.foes.length = 0;
const TC = G.TCELL, rock = (x, y) => !!G.TITLE_SOLID[G.titleCell(S, Math.floor(x / TC), Math.floor(y / TC))];
let dist = 0, seen = new Set(), lv = 0;
for (let i = 0; i < 2000 && S.scroll < L.plan.arena.x0 - 300; i++) {
  S.scroll += 3; dist += 3; G.titleStep(S, dt); S.foes.length = 0;
  for (const r of S.runners) { r.x = 40; r.y = 10; r.out = true; }
  for (const q of S.worms || []) { seen.add(q); if (rock(q.r.x, q.r.y) || rock(q.f.x, q.f.y)) lv++; }
}
const per = seen.size / (dist / G.TITLE_VW);
check('worms in Coal Seams, about DEV.glowPerScreen a screen (within 40%)', Math.abs(per / D.glowPerScreen - 1) < 0.4, { n: seen.size, per: +per.toFixed(2) });
check('… their feet never inside rock', lv === 0, lv);
// the sandbox: the scene held still; the worms on screen crawl on for 10 s and get somewhere
S.lvl.step = null; S.pace = 0; S.still = true; S.props.length = 0;
const mine = (S.worms || []).filter(q => q.r.x > S.scroll - 50 && q.r.x < S.scroll + 270), st = mine.map(q => ({ x: q.r.x, y: q.r.y }));
for (let i = 0; i < 600; i++) { G.titleStep(S, dt); for (const q of mine) if (rock(q.r.x, q.r.y) || rock(q.f.x, q.f.y)) lv++; }
const went = mine.filter((q, i) => Math.hypot(q.r.x - st[i].x, q.r.y - st[i].y) > 6).length;
check('in the level: the worms on screen roam on (most move 6+ units in 10 s)', mine.length > 0 && went >= mine.length * 0.6, { n: mine.length, went });
check('… never inside rock', lv === 0, lv);
const sp = S.parts.filter(p => p.kind === 'wspore');
check('green spores: puffed by the worms and drifting in Coal Seams', sp.length > 5 && sp.every(p => p.col === sp[0].col), sp.length);

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
