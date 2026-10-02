// Vines and web lines that give (world/sway.js): the bend spring settles back to exactly
// straight and never bends past its most; held, it settles at the dip; a hanging vine's swing
// settles and never passes its widest; a web line sags at rest and runs anchor to anchor;
// an arch and a hanging vine are found where they're bent and swung to.
const G = require('../load');
const { tent, bendStep, bendPush, bendAwake, swingStep, webAt, webNearU, archNear, archAt, archCurve, hangX, tailStep, vinePt } = G;
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const dt = 1 / 60;

check('tent: 0 at the ends, 1 at its peak', tent(0, 0.3) === 0 && tent(1, 0.3) === 0 && tent(0.3, 0.3) === 1 && Math.abs(tent(0.15, 0.3) - 0.5) < 1e-9);

// a line knocked hard: it bends, never past max, and sleeps exactly straight again
{
  const o = {};
  bendPush(o, 0.5, 400, -300, 0.3, 0.2);
  let most = 0, n = 0;
  while (bendStep(o, 0, 0, 140, 5, 14, dt) && n < 600) { most = Math.max(most, Math.hypot(o.wx, o.wy)); n++; }
  check('a knocked line bends', most > 2, most);
  check('never past its most', most <= 14 + 1e-9, most);
  check('and settles back to exactly straight (asleep) in a few seconds', n < 300 && !bendAwake(o) && o.wx === 0 && o.wy === 0, n);
}
// held: it settles at the dip under you, bobbing on the way
{
  const o = { wvy: 120 };
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < 240; i++) { bendStep(o, 0, 5, 140, 5, 14, dt); if (i > 5) { lo = Math.min(lo, o.wy); hi = Math.max(hi, o.wy); } }
  check('held: it bobs', hi - lo > 2, [lo, hi]);
  check('held: then hangs at the dip', Math.abs(o.wy - 5) < 0.1 && Math.abs(o.wvy) < 1, o);
}
// a long frame doesn't throw it
{
  const o = { wvx: 300 };
  for (let i = 0; i < 20; i++) bendStep(o, 0, 0, 600, 0, 14, 0.25);
  check('a long frame stays in bounds', Math.hypot(o.wx, o.wy) <= 14 + 1e-9 && isFinite(o.wvx), o);
}

// a hanging vine's swing
{
  const o = { swv: 3 };
  let most = 0, n = 0, cross = 0, last = 0;
  while (swingStep(o, 36, 1400, 1.2, 0.9, dt) && n < 2000) {
    most = Math.max(most, Math.abs(o.sw)); n++;
    if (last && Math.sign(o.sw) !== Math.sign(last) && o.sw) cross++;
    if (o.sw) last = o.sw;
  }
  check('a pushed vine swings back and forth', cross >= 3, cross);
  check('never past its widest', most <= 0.9 + 1e-9, most);
  check('and comes to rest', o.sw === 0 && o.swv === 0 && n < 1200, n);
}

// web lines: anchor to anchor, sagging in the middle, found where they're bent
{
  const L = { a0x: 0, a0y: 100, b0x: 200, b0y: 100, sag: 6 };
  const a = webAt(L, 0), b = webAt(L, 1), m = webAt(L, 0.5);
  check('a web line runs anchor to anchor', a.x === 0 && a.y === 100 && b.x === 200 && b.y === 100);
  check('and sags in the middle', Math.abs(m.y - 106) < 1e-9, m);
  L.wx = 4; L.wy = 10; L.wu = 0.25;
  const q = webNearU(L, 50, 90);
  check('bent: the nearest point is on the bend (its peak at wu)', Math.abs(q.u - 0.25) < 1e-9 && Math.abs(q.x - 54) < 1e-9 && Math.abs(q.y - (100 + 4 * 0.25 * 0.75 * 6 + 10)) < 1e-9, q);
}

// an arch bent down: grabbing finds it there, and its ends stay put
{
  const pts = archCurve(0, 0, 200, 0, 1.2, 20), pr = { x: 0, y: 0, arc: pts.map(p => [p.x, p.y]) };
  const rest = archAt(pr, 0.5);
  pr.wx = 0; pr.wy = 8; pr.wu = 0.5;
  const bent = archAt(pr, 0.5), q = archNear(pr, 100, bent.y);
  check('a bent arch dips where it peaks', Math.abs(bent.y - rest.y - 8) < 1e-9, [rest.y, bent.y]);
  check('and is found there (u along it too)', q.d < 0.5 && Math.abs(q.u - 0.5) < 0.03, q);
  check('its ends stay put', archAt(pr, 0).y === 0 && Math.abs(archAt(pr, 1).y) < 1e-9);
}

// a hanging vine swung: found across by sin(angle) × depth, its root not at all
{
  const pr = { x: 0, y: 0, len: 50, sw: 0.5 };
  check('a swung vine is across by sin(sw) × depth', Math.abs(hangX(pr, 40) - Math.sin(0.5) * 40) < 1e-9 && hangX(pr, 0) === 0 && Math.abs(hangX(pr, 99) - Math.sin(0.5) * 50) < 1e-9);
}

// v129: held near its top and swung, the part below your grip trails (bends) instead of staying
// in line with it, keeps its length, and sleeps (dropped) once the vine is still again
{
  const pr = { x: 0, y: 0, len: 80, sj: 10, sw: 0, swv: 0 };
  let bend = 0, worst = 0;
  for (let i = 0; i < 120; i++) {
    pr.sw = 0.6 * Math.sin(i * dt * 5); pr.swv = 1;     // the grip swinging it to and fro
    tailStep(pr, 3, 1400, 1.5, dt);
    const end = vinePt(pr, 80), rigid = Math.sin(pr.sw) * 80;
    bend = Math.max(bend, Math.abs(end.x - rigid));
    let L = 0, a = vinePt(pr, 10);
    for (let k = 1; k <= 3; k++) { const b = vinePt(pr, 10 + k * 70 / 3); L += Math.hypot(b.x - a.x, b.y - a.y); a = b; }
    worst = Math.max(worst, Math.abs(L - 70));
  }
  check('held near the top and swung, its bottom trails, not in line', bend > 8, bend);
  check('the tail keeps its length', worst < 1.5, worst);
  const j = vinePt(pr, 10);
  check('the vine is joined at your grip', Math.abs(j.x - Math.sin(pr.sw) * 10) < 1e-9 && Math.abs(j.y - Math.cos(pr.sw) * 10) < 1e-9, j);
  pr.sw = 0; pr.swv = 0;
  let n = 0;
  while (tailStep(pr, 3, 1400, 1.5, dt) && n < 3000) n++;
  check('let go: the tail settles straight down and sleeps', !pr.tl && n < 2000 && Math.abs(vinePt(pr, 80).x) < 1e-9, n);
}

// the knobs are on the Dev panel in their own group
{
  const keys = ['webSag', 'bendK', 'bendDamp', 'bendPush', 'bendGrab', 'bendDip', 'bendMax', 'vineGrav', 'vineDamp', 'vinePush', 'vineMax', 'vineLinks', 'vineTailDamp'];
  check('sway knobs: each has a default and a Dev row', keys.every(k => typeof G.DEV_DEFAULTS[k] === 'number' && G.DEV_META.some(m => m.k === k && m.g === 'sway')));
  check('and the group is listed', G.DEV_GROUPS.some(g => g[0] === 'sway'));
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
