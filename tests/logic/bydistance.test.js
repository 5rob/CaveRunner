// Level 2 stage 1: the "decorate by distance" tool (world/byDistance.js). The distance field is the
// exact straight-line distance; a density curve of 0 far out leaves it empty; points stay in open air,
// clear of rock; the same seed makes the same points; and it's quick on a whole floor's grid.
const G = require('../load');
const { distField, scatterByDistance, curveFn, destructionOpts, bezierAt, bezierFade, kcurve, CURVES, DEV, DEV_DEFAULTS, DEV_META, DEV_GROUPS, CW, CH } = G;
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

// ---- the distance field, on a small hand-made grid ----
{
  const w = 9, h = 7, src = new Uint8Array(w * h);
  src[3 * w + 4] = 1;                                   // one source cell in the middle
  const d = distField(w, h, src, 100);
  let exact = true;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    if (Math.abs(d[y * w + x] - Math.hypot(x - 4, y - 3)) > 1e-5) exact = false;
  check('one source: every cell is its straight-line distance', exact);
  const d2 = distField(w, h, src, 2.5);
  check('past the reach: Infinity', d2[3 * w + 4] === 0 && d2[3 * w + 6] === 2 && d2[3 * w + 7] === Infinity && d2[0] === Infinity);
  // a source block plus a far cell: the nearest one wins, and rock doesn't matter (as the crow flies)
  const s3 = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) s3[y * w] = 1;            // the left column
  s3[6 * w + 8] = 1;                                    // and the bottom-right corner
  const d3 = distField(w, h, s3, 100);
  let near = true;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    if (Math.abs(d3[y * w + x] - Math.min(x, Math.hypot(x - 8, y - 6))) > 1e-5) near = false;
  check('several sources: the nearest wins', near);
  check('no source at all: all Infinity', distField(w, h, new Uint8Array(w * h), 100).every(v => v === Infinity));
  // brute force on a random grid
  let rs = 5; const r = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const W = 40, H = 30, s4 = new Uint8Array(W * H);
  for (let i = 0; i < 12; i++) s4[Math.floor(r() * W * H)] = 1;
  const d4 = distField(W, H, s4, 1000);
  let worst = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let best = Infinity;
    for (let j = 0; j < W * H; j++) if (s4[j]) best = Math.min(best, Math.hypot(x - j % W, y - Math.floor(j / W)));
    worst = Math.max(worst, Math.abs(best - d4[y * W + x]));
  }
  check('random sources: matches brute force', worst < 1e-4, worst);
}

// ---- curves ----
check('bezierAt: ends are its start and end y', Math.abs(bezierAt(0, 0.3, 0.2, 2, 0.8, -1, 1.7) - 0.3) < 1e-6 && Math.abs(bezierAt(1, 0.3, 0.2, 2, 0.8, -1, 1.7) - 1.7) < 1e-6);
check('bezierAt: control points on the line give a straight line', Math.abs(bezierAt(0.4, 0, 1 / 3, 1 / 3, 2 / 3, 2 / 3, 1) - 0.4) < 1e-4);
check('bezierFade unchanged (it is bezierAt from 1 to 0)', [0.1, 0.37, 0.8].every(u => Math.abs(bezierFade(u, 0.25, 1, 0.5, 0) - bezierAt(u, 1, 0.25, 1, 0.5, 0, 0)) < 1e-9) && bezierFade(0, 0.25, 1, 0.5, 0) === 1);

// ---- scatter: a sandbox grid, a source column on the left, a rock block in the middle ----
const W = 300, H = 200, src = new Uint8Array(W * H), solid = new Uint8Array(W * H);
for (let y = 0; y < H; y++) src[y * W] = 1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (x >= 100 && x < 140 && y >= 60 && y < 140) solid[y * W + x] = 1;      // a block of rock
  if (y < 4 || y >= H - 4) solid[y * W + x] = 1;                            // roof and floor
}
const dist = distField(W, H, src, 250);
const step = curveFn({ y0: 1, x1: 0.33, y1: 1, x2: 0.66, y2: 1, y3: 1 });
const half = u => u < 0.5 ? 1 : 0;                    // full near, none past half the reach
const base = { w: W, h: H, dist, maxDist: 250, solid, n: 400, seed: 7, clear: 6, sizeMin: 4, sizeMax: 10 };
{
  const pts = scatterByDistance(Object.assign({}, base, { density: half }));
  check('it gives the points asked for', pts.length === 400, pts.length);
  check('density 0 far away: nothing past half the reach', pts.every(p => p.dist <= 125), Math.max(...pts.map(p => p.dist)));
  check('and nothing past the reach at all', scatterByDistance(Object.assign({}, base, { density: step })).every(p => p.dist <= 250));
  const tooClose = pts.filter(p => {
    for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
      if (i * i + j * j > 36) continue;
      const x = Math.floor(p.x) + i, y = Math.floor(p.y) + j;
      if (x < 0 || y < 0 || x >= W || y >= H || solid[y * W + x]) return true;
    }
    return false;
  });
  check('never inside or within the clearance of rock', tooClose.length === 0, tooClose.slice(0, 3));
  const again = scatterByDistance(Object.assign({}, base, { density: half }));
  check('same seed: the same points', JSON.stringify(again) === JSON.stringify(pts));
  const other = scatterByDistance(Object.assign({}, base, { density: half, seed: 8 }));
  check('another seed: other points', JSON.stringify(other) !== JSON.stringify(pts));
  check('sizes in sizeMin..sizeMax (scale 1)', pts.every(p => p.size >= 4 && p.size <= 10));
  check('a spare roll each, 0..1', pts.every(p => p.roll >= 0 && p.roll < 1));
  // the density curve shapes it: a falling curve puts more near than far
  const fall = scatterByDistance(Object.assign({}, base, { density: curveFn({ y0: 1, x1: 0.3, y1: 0.6, x2: 0.6, y2: 0.1, y3: 0 }) }));
  const nearN = fall.filter(p => p.dist < 80).length, farN = fall.filter(p => p.dist >= 170).length;
  check('a falling curve: denser near the source', nearN > farN * 3, [nearN, farN]);
  // the scale curve: bigger near, smaller far
  const sc = scatterByDistance(Object.assign({}, base, { density: step, scale: u => 2 - 2 * u, sizeMin: 5, sizeMax: 5 }));
  check('scale curve multiplies the size by distance', sc.every(p => Math.abs(p.size - 5 * (2 - 2 * p.dist / 250)) < 1e-4));
  // jitter keeps the rules
  const jit = scatterByDistance(Object.assign({}, base, { density: half, jitter: 20 }));
  check('jitter: still the count and still clear of rock', jit.length === 400 && jit.every(p => {
    for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
      if (i * i + j * j > 36) continue;
      const x = Math.floor(p.x) + i, y = Math.floor(p.y) + j;
      if (x < 0 || y < 0 || x >= W || y >= H || solid[y * W + x]) return false;
    }
    return true;
  }));
  check('jitter moves them', JSON.stringify(jit) !== JSON.stringify(pts));
  check('an rnd instead of a seed works too', scatterByDistance(Object.assign({}, base, { rnd: Math.random, n: 10 })).length === 10);
  check('density 0 everywhere: no points', scatterByDistance(Object.assign({}, base, { density: () => 0 })).length === 0);
}

// ---- the Dev group ----
check('Level 2: destruction is on the Dev panel', DEV_GROUPS.some(g => g[0] === 'l2boom' && g[1] === 'Level 2: destruction'));
const keys = ['l2bMaxDist', 'l2bCount', 'l2bFire', 'l2bJitter', 'l2bClear', 'l2bSizeLo', 'l2bSizeHi',
  'l2bDen0', 'l2bDenC1x', 'l2bDenC1y', 'l2bDenC2x', 'l2bDenC2y', 'l2bDen1', 'l2bScale0', 'l2bScaleC1x', 'l2bScale1'];
check('its knobs are there with defaults', keys.every(k => DEV_META.some(m => m.k === k && m.g === 'l2boom') && typeof DEV_DEFAULTS[k] === 'number'), keys.filter(k => !DEV_META.some(m => m.k === k)));
check('both curves are listed for the editor', ['l2bDen', 'l2bScale'].every(p => CURVES.some(c => c.p === p && c.g === 'l2boom')));
check('the scale curve runs 0..2', CURVES.some(c => c.p === 'l2bScale' && c.lo === 0 && c.hi === 2));
{
  const o = destructionOpts();
  check('destructionOpts reads the knobs', o.n === DEV.l2bCount && o.maxDist === DEV.l2bMaxDist && o.fire === DEV.l2bFire / 100 &&
    o.sizeMin === DEV.l2bSizeLo && o.sizeMax === DEV.l2bSizeHi && Math.abs(o.density(0) - DEV.l2bDen0) < 1e-6 && Math.abs(o.scale(1) - DEV.l2bScale1) < 1e-6);
  DEV.l2bDen1 = 0.77;
  check('and a curve knob turned shows at once', Math.abs(destructionOpts().density(1) - 0.77) < 1e-6 && kcurve('l2bDen').y3 === 0.77);
  DEV.l2bDen1 = DEV_DEFAULTS.l2bDen1;
}

// ---- timing on a whole floor's grid (CW × CH terrain pixels), a real floor 2 cave ----
{
  const lv = G.makeLevel(3, 2);
  const N = CW * CH, s = new Uint8Array(N);
  // stand-in dark zones: three discs of open cave
  for (const [cx, cy, r] of [[160, 400, 60], [480, 800, 80], [300, 1200, 50]])
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) s[y * CW + x] = 1;
  const o = destructionOpts();
  distField(CW, CH, s, o.maxDist);                    // warm up
  let t0 = process.hrtime.bigint();
  const d = distField(CW, CH, s, o.maxDist);
  const tField = Number(process.hrtime.bigint() - t0) / 1e6;
  t0 = process.hrtime.bigint();
  const pts = scatterByDistance(Object.assign({ w: CW, h: CH, dist: d, solid: lv.mat, seed: 3 }, o));
  const tScatter = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(`     full grid ${CW}×${CH}: distance field ${tField.toFixed(1)} ms, scatter ${tScatter.toFixed(1)} ms, ${pts.length} points`);
  check('distance field on a whole floor under 100 ms', tField < 100, tField);
  check('scatter on a whole floor under 50 ms', tScatter < 50, tScatter);
  check('it finds its explosions in a real cave', pts.length === o.n, pts.length);
  check('none in the rock of a real cave', pts.every(p => !lv.mat[Math.floor(p.y) * CW + Math.floor(p.x)]));
}

console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
