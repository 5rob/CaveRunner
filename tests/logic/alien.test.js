// Level 2 stage 7b: the aliens' brain (creatures/alien.js), on hand-made grids: the boids terms push apart,
// align and pull together; one flees fire within alFleeR and ignores it beyond; never leaves its zone; a stray
// heads for the nearest zone and turns normal inside; the pupil darts, then locks on within aggro; it bites only
// when you're in the dark; its clock never stops; the neighbour grid finds the right ones. Then on real floor-2
// levels: the aliens spawn inside the zones, the strays outside.
const G = require('../load');
const { alienBoids, alienStep, alienBrain, alienGrid, alienNear, makeLevel, enemyFor, CELL, CW, DEV, DEV_DEFAULTS, DEV_GROUPS } = G;
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
for (const k in DEV_DEFAULTS) if (/^al/.test(k)) DEV[k] = DEV_DEFAULTS[k];
const seeded = s => () => (s = (s * 16807) % 2147483647) / 2147483647;

// ---- boids ----
const W1 = { sep: 1, ali: 0, coh: 0 }, W2 = { sep: 0, ali: 1, coh: 0 }, W3 = { sep: 0, ali: 0, coh: 1 };
let b = alienBoids(0, 0, 0, 0, [{ x: 5, y: 0, al: { vx: 0, vy: 0 } }], 20, W1);
check('separation pushes away from a neighbour', b.x < 0 && Math.abs(b.y) < 1e-9, b);
b = alienBoids(0, 0, 0, 0, [{ x: 5, y: 0, al: { vx: 0, vy: 50 } }, { x: -5, y: 0, al: { vx: 0, vy: 50 } }], 20, W2);
check('alignment turns it the way they go', b.y > 0.9 && Math.abs(b.x) < 1e-9, b);
b = alienBoids(0, 0, 0, 0, [{ x: 15, y: 0, al: { vx: 0, vy: 0 } }, { x: 15, y: 4, al: { vx: 0, vy: 0 } }], 20, W3);
check('cohesion pulls it toward them', b.x > 0.5, b);
b = alienBoids(0, 0, 0, 0, [{ x: 50, y: 0, al: { vx: 0, vy: 0 } }], 20, { sep: 1, ali: 1, coh: 1 });
check('nobody within the radius: no steer', b.x === 0 && b.y === 0, b);

// ---- the neighbour grid ----
const list = [];
for (let i = 0; i < 300; i++) list.push({ x: (i * 37) % 400, y: (i * 91) % 300, k: { act: 'alien' } });
const grid = alienGrid(list, 24), out = [];
let gridOk = true;
for (const e of list.slice(0, 40)) {
  alienNear(grid, e.x, e.y, 24, e, out);
  const brute = list.filter(o => o !== e && (o.x - e.x) ** 2 + (o.y - e.y) ** 2 < 24 * 24);
  if (brute.length !== out.length || brute.some(o => !out.includes(o))) gridOk = false;
}
check('alienNear finds exactly the ones within R', gridOk);

// ---- a hand-made world: 400 x 70 cells, walled; the zone the left half (cells 2-199) ----
const GW = 400, GH = 70;
const solid = (cx, cy) => cx < 2 || cy < 2 || cx >= GW - 2 || cy >= GH - 2;
const zoneOf = (x, y) => { const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); return !solid(cx, cy) && cx < 200 ? 1 : 0; };
const mkEnv = (o = {}) => Object.assign({ solidCell: solid, zone: zoneOf, silk: (x, y) => zoneOf(x, y) > 0, near: [],
  fireNear: () => null, home: () => ({ x: 30 * CELL, y: 35 * CELL }), you: { x: 9999, y: 9999 }, look: false, hunting: false,
  youDark: false, rnd: seeded(7) }, o);
const mkAlien = (x, y, z) => { const e = { x, y, ty: y, r: 2.6, touch: 0, k: enemyFor('alien', 2) }; e.al = alienBrain(z, seeded(3)); return e; };

// flee: a fire 60 away (inside the radius) and 400 away (beyond)
{
  const R = DEV.alFleeRLo;
  const fire = { x: 100 * CELL, y: 35 * CELL };
  const e = mkAlien(fire.x + 30, fire.y, 1), env = mkEnv({ fireNear: (x, y, r) => Math.hypot(x - fire.x, y - fire.y) < r ? fire : null });
  const d0 = Math.hypot(e.x - fire.x, e.y - fire.y);
  for (let i = 0; i < 30; i++) alienStep(e, env, 1 / 60);
  const d1 = Math.hypot(e.x - fire.x, e.y - fire.y);
  check('within the radius it runs from the fire (fast)', d1 > d0 + 40 && e.al.fl > 0, { d0, d1 });
  const f = mkAlien(fire.x + R + 60, fire.y, 1);
  f.x = 150 * CELL; f.y = 35 * CELL; const far = { x: f.x - (DEV.alFleeRHi + 60), y: f.y };
  const env2 = mkEnv({ fireNear: (x, y, r) => Math.hypot(x - far.x, y - far.y) < r ? far : null });
  let flee = 0;
  for (let i = 0; i < 60; i++) { alienStep(f, env2, 1 / 60); if (f.al.fl > 0) flee++; }
  check('beyond the radius it ignores the fire', flee === 0);
}

// never leaves its zone: 40 aliens, 20 s, fire chasing them toward the edge and roaming
{
  let left = 0, frozen = 0;
  const rnd = seeded(99);
  const pack = [];
  for (let i = 0; i < 40; i++) pack.push(mkAlien((150 + rnd() * 45) * CELL, (8 + rnd() * 55) * CELL, 1));
  const fire = { x: 150 * CELL, y: 35 * CELL };
  const g = alienGrid(pack, 24);
  for (let f = 0; f < 1200; f++) {
    const gr = alienGrid(pack, 24);
    for (const e of pack) {
      const env = mkEnv({ rnd, near: alienNear(gr, e.x, e.y, 24, e, []), fireNear: (x, y, r) => f < 600 && Math.hypot(x - fire.x, y - fire.y) < r ? fire : null });
      alienStep(e, env, 1 / 60);
      if (!zoneOf(e.x, e.y)) left++;
    }
  }
  check('no alien ever leaves its zone (20 s, fire driving them to the edge)', left === 0, { left });
  // the clock: each one moved in the last 5 s, and its burst/rest clocks aren't both stuck at zero
  const pos = pack.map(e => [e.x, e.y]);
  for (let f = 0; f < 300; f++) for (const e of pack) alienStep(e, mkEnv({ rnd }), 1 / 60);
  frozen = pack.filter((e, i) => Math.hypot(e.x - pos[i][0], e.y - pos[i][1]) < 1).length;
  check('every alien keeps moving (a clock always running)', frozen === 0, { frozen });
  void g;
}

// a stray: outside the zone, black; sees you -> sprints home and turns normal inside
{
  const e = mkAlien(260 * CELL, 35 * CELL, 0), env = mkEnv({ hunting: true, you: { x: 265 * CELL, y: 35 * CELL } });
  check('a stray starts black', e.al.black === true);
  let res = null, f = 0;
  for (; f < 600 && res !== 'home'; f++) res = alienStep(e, env, 1 / 60);
  check('a stray that sees you reaches the zone and turns normal', res === 'home' && !e.al.black && e.al.z === 1, { f, x: e.x / CELL });
  const s2 = mkAlien(300 * CELL, 35 * CELL, 0), x0 = s2.x;
  for (let i = 0; i < 120; i++) alienStep(s2, mkEnv(), 1 / 60);
  check('a stray that hasn\'t seen you stays black, outside', s2.al.black && !zoneOf(s2.x, s2.y), { moved: s2.x - x0 });
}

// the pupil: darts about, locks on in aggro
{
  const e = mkAlien(30 * CELL, 35 * CELL, 1), env = mkEnv();
  const seen = new Set();
  for (let i = 0; i < 300; i++) { alienStep(e, env, 1 / 60); seen.add(e.al.px.toFixed(3) + ',' + e.al.py.toFixed(3)); }
  check('the pupil darts (several spots in 5 s)', seen.size >= 6 && seen.size <= 30, seen.size);
  const env2 = mkEnv({ look: true, you: { x: e.x + 100, y: e.y } });
  for (let i = 0; i < 10; i++) alienStep(e, env2, 1 / 60);
  check('within aggro it stares at you', e.al.px > 0.95 && Math.abs(e.al.py) < 0.1, { px: e.al.px, py: e.al.py });
}

// attacks only in the dark
{
  const you = { x: 30 * CELL, y: 35 * CELL };
  const a = mkAlien(you.x + 40, you.y, 1), b2 = mkAlien(you.x + 40, you.y, 1);
  let bitesDark = 0, bitesLit = 0, minLit = 1e9;
  for (let i = 0; i < 300; i++) {
    if (alienStep(a, mkEnv({ hunting: true, look: true, youDark: true, you }), 1 / 60) === 'bite') { bitesDark++; a.touch = 0.8; }
    a.touch -= 1 / 60;
    if (alienStep(b2, mkEnv({ hunting: true, look: true, youDark: false, you }), 1 / 60) === 'bite') bitesLit++;
    if (i > 60) minLit = Math.min(minLit, Math.hypot(b2.x - you.x, b2.y - you.y));
  }
  check('in the dark it comes and bites', bitesDark > 0, bitesDark);
  check('in light it never bites and keeps its distance', bitesLit === 0 && minLit > DEV.alKeepLo * 0.6, { bitesLit, minLit });
}

check('the Dev group "Level 2: aliens" is there', DEV_GROUPS.some(g => g[0] === 'l2alien'));

// ---- real floor-2 levels ----
{
  let total = 0, outside = 0, strays = 0, straysIn = 0, levels = 0, inRock = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const lv = makeLevel(seed, 2);
    if (!lv.dark.length) continue;
    levels++;
    const al = lv.enemies.filter(e => e.k.act === 'alien');
    for (const e of al) {
      const i = Math.floor(e.y / CELL) * CW + Math.floor(e.x / CELL);
      if (lv.mat[i]) inRock++;
      if (e.al.black) { strays++; if (lv.darkMask[i]) straysIn++; }
      else { total++; if (lv.darkMask[i] !== e.al.z || !lv.darkMask[i]) outside++; }
    }
    if (seed === 1) console.log('  seed 1:', lv.dark.length, 'zones,', al.length, 'aliens');
  }
  check('floor 2 has aliens (about alCount per zone)', levels > 0 && total >= levels * DEV.alCountLo, { levels, total });
  check('every alien spawns inside its own zone, none in rock', outside === 0 && inRock === 0, { outside, inRock });
  check('strays spawn outside the zones', strays > 0 && straysIn === 0, { strays, straysIn });
  const a = makeLevel(4, 2).enemies.filter(e => e.k.act === 'alien').map(e => e.x + e.y).join();
  const b3 = makeLevel(4, 2).enemies.filter(e => e.k.act === 'alien').map(e => e.x + e.y).join();
  check('deterministic', a === b3);
}
process.exit(fails ? 1 : 0);
