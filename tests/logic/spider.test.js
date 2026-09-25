// The spider (Hämähäkki) lives on rock and on its own silk, nowhere else.
//
// spiderStep is pure, so it runs here on hand-made grids: a box room, a gap to cross, a
// bumpy floor. Every check watches it for simulated seconds and measures where it went.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }\n';
const G = new Function('React', shim + upto +
  'return { spiderStep, surfNormal, SPIDER, CELL, CW, CH, CREATURES, enemyFor, rayDist, DEV, DEV_META, makeLevel };')({ createElement: () => {} });
const { spiderStep, surfNormal, SPIDER, CELL, CW, CH, CREATURES, enemyFor, DEV, DEV_META, makeLevel } = G;

let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

// a seeded rnd so a failure repeats
const mkRnd = s => () => ((s = (s * 16807) % 2147483647) / 2147483647);

// grid helper: W x H cells, fill(cx, cy) says what's rock
function grid(W, H, fill) {
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[y * W + x] = fill(x, y) ? 1 : 0;
  const solidCell = (cx, cy) => cx < 0 || cy < 0 || cx >= W || cy >= H || m[cy * W + cx] !== 0;
  return { m, solidCell, W, H };
}
const inRock = (g, x, y) => g.solidCell(Math.floor(x / CELL), Math.floor(y / CELL));
const spider = (x, y) => ({ x, y, hx: x, hy: y, r: 9 });
// run the spider for `secs`; watch(e) is called each frame
function run(g, e, secs, env, watch) {
  const E = Object.assign({ solidCell: g.solidCell, webs: [], hunting: false, goal: null, rnd: mkRnd(7), speed: 260, reach: 170 }, env);
  for (let t = 0; t < secs; t += 1 / 60) {
    if (typeof E.goalFn === 'function') E.goal = E.goalFn(t);
    spiderStep(e, E, 1 / 60);
    if (watch) watch(e, E);
  }
  return E;
}

// ---- the table ----
check('Hämähäkki is a spider now', CREATURES.hamahakki.act === 'spider');
const knobs = DEV_META.filter(m => m.g === 'spider');
check('its behaviour is tweakable from the Dev panel', knobs.length >= 20 && knobs.every(m => typeof DEV[m.k] === 'number'), knobs.map(m => m.k));

// ---- the surface normal ----
{
  const g = grid(60, 60, (x, y) => y >= 40);          // floor at y = 80 world
  const n = surfNormal(60, 74, 14, g.solidCell);
  check('the normal off a floor points up', n && n.y < -0.95, n);
  check('and there is none in open air', surfNormal(60, 20, 14, g.solidCell) === null);
}

// ---- it drops from the air onto the floor and then stays on it ----
{
  const g = grid(120, 60, (x, y) => y >= 45 || y < 2 || x < 2 || x >= 118);
  const e = spider(120, 30);
  let inside = 0, offFloor = 0, frames = 0, minX = 1e9, maxX = -1e9;
  run(g, e, 12, { reach: 20 }, (e, E) => {       // short reach: no ceiling to shoot at
    if (inRock(g, e.x, e.y)) inside++;
    if (e.sp.mode === 'surf') {
      frames++;
      const gap = surfNormal(e.x, e.y, 14, g.solidCell).d;   // nearest rock
      if (gap < 4 || gap > 8) offFloor++;
      minX = Math.min(minX, e.x); maxX = Math.max(maxX, e.x);
    }
  });
  check('a spider spawned in the air falls onto the rock', frames > 0, e.sp.mode);
  check('it never goes inside rock', inside === 0, inside);
  check('on the rock it stays a body-width off it', offFloor === 0, { offFloor, frames });
  check('and it roams along it', maxX - minX > 20, { minX, maxX });
}

// ---- it moves in bursts: more resting than moving when roaming ----
{
  const g = grid(200, 60, (x, y) => y >= 45 || x < 2 || x >= 198);
  const e = spider(200, 80);
  let moving = 0, still = 0, lx = e.x, ly = e.y, top = 0;
  run(g, e, 30, { reach: 20 }, e => {
    const d = Math.hypot(e.x - lx, e.y - ly); lx = e.x; ly = e.y;
    if (e.sp.mode !== 'surf') return;
    if (d > 0.01) moving++; else still++;
    top = Math.max(top, d * 60);
  });
  check('roaming, it rests more than it moves', still > moving * 2, { moving, still });
  check('but when it moves it is fast', top > 150, Math.round(top));
  // hunting: rests are short
  const e2 = spider(100, 80);
  let m2 = 0, s2 = 0; lx = e2.x; ly = e2.y;
  run(g, e2, 10, { reach: 20, hunting: true, goalFn: t => ({ x: 40 + 320 * Math.abs(Math.sin(t * 5)), y: 80 }) }, e => {
    const d = Math.hypot(e.x - lx, e.y - ly); lx = e.x; ly = e.y;
    if (e.sp.mode !== 'surf') return;
    if (d > 0.01) m2++; else s2++;
  });
  check('hunting, it moves more than it rests', m2 > s2, { m2, s2 });
}

// ---- it slides over a bumpy, pixel-stepped floor without snagging ----
{
  // stair-stepped bumps every few cells, and a couple of single-pixel spikes
  const floorAt = x => 45 - (Math.floor(x / 5) % 3) - (x % 23 === 0 ? 2 : 0);
  const g = grid(220, 60, (x, y) => y >= floorAt(x) || x < 2 || x >= 218);
  const e = spider(30, 60);
  let inside = 0, reached = false;
  run(g, e, 14, { reach: 20, hunting: true, goal: { x: 400, y: 70 } }, e => {
    if (inRock(g, e.x, e.y)) inside++;
    if (e.x > 380) reached = true;
  });
  check('across a bumpy floor it gets where it is going', reached, Math.round(e.x));
  check('without ever going inside the rock', inside === 0, inside);
}

// ---- walls: it goes up them, round the corner, and across a ceiling ----
{
  // a floor and a tall wall on the right; the goal is on top of a ledge
  const g = grid(120, 100, (x, y) => y >= 90 || x >= 100 || (x >= 60 && y >= 50) || x < 2 || y < 2);
  // ledge top at y=50 cells (100 world), x from 60..100 cells (120..200 world)
  const e = spider(40, 150);
  let inside = 0;
  run(g, e, 16, { reach: 10, hunting: true, goal: { x: 170, y: 90 } }, e => { if (inRock(g, e.x, e.y)) inside++; });
  check('with no line in reach it climbs the step and gets on top', e.y < 100 && e.x > 120, { x: Math.round(e.x), y: Math.round(e.y), mode: e.sp.mode });
  check('never inside rock doing it', inside === 0, inside);
}

// ---- a gap: it shoots a line across and walks over on it ----
{
  // two floors with a pit between; the ceiling is far away so only the far side is in reach
  const g = grid(200, 120, (x, y) => (y >= 60 && (x < 70 || x >= 110)) || y >= 118 || x < 2 || x >= 198);
  const e = spider(60, 110);
  let shot = 0, rodeLine = false, inside = 0, fellIn = false;
  const E = run(g, e, 12, { hunting: true, goal: { x: 300, y: 110 }, reach: 170 }, (e, E) => {
    if (e.sp.mode === 'shoot') shot++;
    if (e.sp.mode === 'line') rodeLine = true;
    if (inRock(g, e.x, e.y)) inside++;
    if (e.y > 140) fellIn = true;
  });
  check('it shoots a line across the gap', E.webs.length > 0, E.webs.length);
  check('and crosses on it', rodeLine && e.x > 220, { x: Math.round(e.x), y: Math.round(e.y), mode: e.sp.mode });
  check('without dropping into the pit', !fellIn);
  check('never inside rock', inside === 0, inside);
  check('the line stays after', E.webs.length > 0 && E.webs.every(L => Math.hypot(L.bx - L.ax, L.by - L.ay) > 10));
  // a second spider on the same side takes the existing line rather than shooting its own
  const e2 = spider(60, 110);
  let shot2 = 0;
  run(g, e2, 12, { hunting: true, goal: { x: 300, y: 110 }, reach: 170, webs: E.webs }, e => { if (e.sp.mode === 'shoot') shot2++; });
  const lines = E.webs.filter(L => L.owner === e2).length;
  check('a line in grabbing reach is ridden, not shot again', lines === 0 && e2.x > 220, { lines, x: Math.round(e2.x) });
}

// ---- goal straight up in open air over a floor: it shoots up to the ceiling ----
{
  const g = grid(100, 100, (x, y) => y >= 90 || y < 20 || x < 2 || x >= 98);   // ceiling at 40, floor at 180
  const e = spider(100, 170);
  const E = run(g, e, 6, { hunting: true, goal: { x: 100, y: 60 }, reach: 170 });
  check('a goal above it, off the surface: it lines up to the ceiling', E.webs.length > 0 && e.y < 120, { y: Math.round(e.y), webs: E.webs.length });
}

// ---- goal along the floor, beside it: it walks, it does not shoot ----
{
  const g = grid(200, 100, (x, y) => y >= 90 || y < 20 || x < 2 || x >= 198);
  const e = spider(60, 170);
  const E = run(g, e, 5, { hunting: true, goal: { x: 300, y: 172 }, reach: 170 });
  check('a goal along the surface (dot < 0.6) is walked to, no line shot', E.webs.length === 0 && e.x > 250, { x: Math.round(e.x), webs: E.webs.length });
}

// ---- rock under it dug away: it falls ----
{
  const g = grid(100, 100, (x, y) => y >= 90 || (y >= 50 && y < 54 && x > 30 && x < 70) || x < 2 || x >= 98);
  const e = spider(100, 90);
  run(g, e, 1, { reach: 10 });
  const onShelf = e.sp.mode === 'surf' && e.y < 100;
  for (let y = 50; y < 54; y++) for (let x = 31; x < 70; x++) g.m[y * 100 + x] = 0;
  let low = 0;
  run(g, e, 2, { reach: 10 }, e => { low = Math.max(low, e.y); });
  check('dig the shelf out from under it and it falls to the floor', onShelf && low > 165, { onShelf, low: Math.round(low) });
}

// ---- it never goes to sleep: reach the goal, wait there, then the goal moves on ----
// (v76 bug: arriving left it with no burst and no rest clock, so it never moved again)
{
  const g = grid(200, 60, (x, y) => y >= 45 || x < 2 || x >= 198);
  const e = spider(100, 80);
  run(g, e, 3, { hunting: true, goal: { x: 100, y: 80 }, reach: 20 });
  const x0 = e.x;
  run(g, e, 3, { hunting: true, goal: { x: 330, y: 80 }, reach: 20 });
  check('after sitting at its goal, it still goes after a new one', e.x - x0 > 150, { x0: Math.round(x0), x: Math.round(e.x) });
}

// ---- the real floor 1: every spider on it gets about, roaming on its own ----
{
  let still = 0, total = 0;
  for (const seed of [11, 222, 3333]) {
    const lv = makeLevel(seed, 1, []);
    const solidCell = (cx, cy) => cx < 0 || cy < 0 || cx >= CW || cy >= CH || lv.mat[cy * CW + cx] !== 0;
    const sp = lv.enemies.filter(e => e.k.act === 'spider');
    const webs = [], rnd = mkRnd(seed);
    const path = sp.map(() => 0);
    for (let t = 0; t < 40 * 60; t++) sp.forEach((e, i) => {
      const x = e.x, y = e.y;
      spiderStep(e, { solidCell, webs, hunting: false, goal: null, rnd, speed: DEV.spSpeed, reach: DEV.spWeb }, 1 / 60);
      if (t > 5 * 60) path[i] += Math.hypot(e.x - x, e.y - y);
    });
    total += sp.length; still += path.filter(p => p < 40).length;
  }
  check('on real floor-1 caves, every roaming spider moves about (40s each)', still === 0 && total > 10, { still, total });
}

if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
console.log('\nall spider checks passed');
