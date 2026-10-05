// Level 2 stage 2: floor 2 is a tomb (world/tomb.js). Rooms planned first (a type and a shape each,
// symmetric about their middle), joined by straight galleries and shafts, the rest solid rock, the
// rock lining them dressed as cut stone. Across many seeds: rooms don't overlap, every room is in
// reach of the shop (a 6 x 11 runner box), the shop reaches the top, it's deterministic, fast, and
// floor 1 doesn't change.
const G = require('../load');
const { makeLevel, tombPlan, roomOpen, roomPillars, tombRoomAt, boxReach, EXIT_X, CW, CH, CELL, SHOP_FLOOR, ROCK, DEV, DEV_DEFAULTS, DEV_META, L2_KNOBS } = G;
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const hashMat = m => { let h = 0; for (let i = 0; i < m.length; i++) h = (Math.imul(h, 31) + m[i]) | 0; return h; };
for (const k in DEV_DEFAULTS) if (/^l2/.test(k)) DEV[k] = DEV_DEFAULTS[k];

const SEEDS = 24;
let overlap = 0, unreached = [], noTop = [], mended = 0, asym = 0, rooms = 0, corr = 0, shafts = 0, ledges = 0, ms = 0, worst = 0, noPrize = 0, prizeOff = 0;
const types = {}, shapes = {};
for (let seed = 1; seed <= SEEDS; seed++) {
  const t0 = Date.now();
  const lv = makeLevel(seed, 2);
  const dt = Date.now() - t0; ms += dt; worst = Math.max(worst, dt);
  const T = lv.tomb, R = T.rooms;
  rooms += R.length; corr += T.corridors.length;
  for (const c of T.corridors) if (c.kind === 'shaft') { shafts++; ledges += c.ledges.length; }
  if (T.mended) mended++;
  for (const r of R) { types[r.type] = (types[r.type] || 0) + 1; shapes[r.shape] = (shapes[r.shape] || 0) + 1; }
  // rooms never overlap
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
    const a = R[i], b = R[j];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.floor && b.y < a.floor) overlap++;
  }
  // every room's shape is mirror-symmetric (checked on the plan's own test, then on the cut rock in the room's box, pillars included)
  for (const r of R) {
    for (let y = r.y; y < r.floor; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const m = 2 * r.x + r.w - 1 - x;
      if (roomOpen(r, x, y) !== roomOpen(r, m, y)) asym++;
    }
    const P = roomPillars(r);
    for (const p of P) if (!P.some(q => q.x === 2 * r.cx - p.x - p.w && q.y === p.y && q.h === p.h)) asym++;
  }
  // the reach: a runner-sized box from the shop
  const reach = boxReach(lv.mat, 17, SHOP_FLOOR - 12);
  if (!reach.top) noTop.push(seed);
  // (a room a dark zone took part of, Stage 4: what's left of it, anywhere in its box; a room it took the
  // middle of is the zone's now: tests/logic/dark.test.js)
  const M = lv.darkMask, touched = r => { if (!M) return false; for (let y = r.y - 2; y <= r.floor + 2; y++) for (let x = r.x - 2; x < r.x + r.w + 2; x++) if (M[y * CW + x]) return true; return false; };
  for (const r of R) {
    if (r.dark >= 0) continue;
    // somewhere along its floor, a box standing there is in reach
    let got = false;
    if (touched(r)) { for (let y = r.y; y < r.floor && !got; y++) for (let x = r.x; x < r.x + r.w; x++) if (reach.ok[y * CW + x] === 2) { got = true; break; } }
    for (let x = r.x; x < r.x + r.w - 5 && !got; x++) for (let y = r.floor - 12; y >= r.floor - 16 && !got; y--) if (reach.ok[y * CW + x] === 2) got = true;
    if (!got) unreached.push(`${seed}:${r.id}/${r.type}/${r.shape}`);
  }
  if (lv.rooms.length !== 1) noPrize++;
  else {
    const p = lv.rooms[0], pr = R[T.prize];
    if (!pr || pr.type !== 'altar' || tombRoomAt(T, p.x, p.y, CELL) !== pr) prizeOff++;
  }
}
console.log(`${SEEDS} tombs: ${(rooms / SEEDS).toFixed(1)} rooms, ${(corr / SEEDS).toFixed(1)} corridors (${(shafts / SEEDS).toFixed(1)} shafts, ${(ledges / SEEDS).toFixed(1)} ledges) a tomb; makeLevel ${(ms / SEEDS).toFixed(0)} ms average, ${worst} ms worst`);
console.log('types', JSON.stringify(types));
console.log('shapes', JSON.stringify(shapes));
check('rooms never overlap', overlap === 0, overlap);
check('every room is symmetric about its middle', asym === 0, asym);
check('the shop reaches the top on every seed', noTop.length === 0, noTop);
check('and never needed the fallback shaft', mended === 0, mended);
check('every room is in reach of the shop', unreached.length === 0, unreached.slice(0, 12));
check('a tomb has plenty of rooms', rooms / SEEDS >= 30, rooms / SEEDS);
check('every shape and type shows up', ['rect', 'ziggurat', 'octagon', 'dome', 'arch', 'round'].every(s => shapes[s]) &&
  ['hall', 'library', 'altar', 'orrery', 'pillars', 'shrine', 'ossuary', 'dorm', 'store', 'gate', 'vestibule'].every(s => types[s]), { types, shapes });
check('one prize, on an altar room\'s floor, in the middle', !noPrize && !prizeOff, { noPrize, prizeOff });
check('generation stays quick (makeLevel under 1.5 s average)', ms / SEEDS < 1500, ms / SEEDS);

// deterministic, and only floor 2
const a = makeLevel(7, 2), b = makeLevel(7, 2);
check('same seed, same tomb', hashMat(a.mat) === hashMat(b.mat) && JSON.stringify(a.tomb) === JSON.stringify(b.tomb));
check('another seed, another tomb', hashMat(makeLevel(8, 2).mat) !== hashMat(a.mat));
check('the plan alone is the same too', JSON.stringify(tombPlan(7, a.shopExit, EXIT_X).rooms.map(r => [r.x, r.y, r.w, r.h, r.type])) ===
  JSON.stringify(tombPlan(7, a.shopExit, EXIT_X).rooms.map(r => [r.x, r.y, r.w, r.h, r.type])));
check('floor 1 and 3 have no tomb', makeLevel(3, 1).tomb === null && makeLevel(3, 3).tomb === null);
// v0.0.145's floor 1 and 3 (pinned): untouched by the tomb
check('floor 1 is the cave it was', hashMat(makeLevel(3, 1).mat) === -726997529, hashMat(makeLevel(3, 1).mat));
check('floor 3 is the cave it was', hashMat(makeLevel(3, 3).mat) === 1829628063, hashMat(makeLevel(3, 3).mat));

// no natural cave: every open pixel above the shop is in a room's shape or a corridor's rect
{
  const T = a.tomb, inC = (x, y) => T.corridors.some(c => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h);
  let stray = 0;
  for (let y = 4; y < SHOP_FLOOR - 60; y++) for (let x = 4; x < CW - 4; x++) {
    if (a.mat[y * CW + x]) continue;
    if (Math.abs(x - a.shopExit) <= 9 && y > SHOP_FLOOR - 90) continue;     // the shop's own shaft
    if (a.darkMask && a.darkMask[y * CW + x]) continue;             // a dark zone's own caves (Stage 4)
    if (!T.rooms.some(r => roomOpen(r, x, y)) && !inC(x, y)) stray++;
  }
  check('no open pixel outside a room or a corridor', stray === 0, stray);
}
// the cut stone: rock next to a room is painted in the brick colours, rock far off isn't
{
  DEV.l2Decor = 0;                       // (the room kits inlay the floor: look at the bare stone)
  const a0 = makeLevel(7, 2);
  DEV.l2Decor = DEV_DEFAULTS.l2Decor;
  const T = a0.tomb, r = T.rooms.find(q => q.type !== 'gate' && q.type !== 'vestibule' && !(a0.darkMask && a0.darkMask[q.floor * CW + Math.round(q.cx)])), d = a0.img.data;
  let x0 = Math.round(r.cx);
  while (!a0.mat[r.floor * CW + x0] || a0.mat[(r.floor - 1) * CW + x0]) x0++;
  const i = r.floor * CW + x0, lit = d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2];
  check('a room\'s floor is dressed stone, lit', a0.mat[i] === ROCK && lit > 3 * 80, lit);
}

// the knobs
DEV.l2RoomsLo = DEV.l2RoomsHi = 12;
const few = makeLevel(5, 2).tomb.rooms.length;
DEV.l2RoomsLo = DEV.l2RoomsHi = 90;
const many = makeLevel(5, 2).tomb.rooms.length;
for (const k in DEV_DEFAULTS) if (/^l2/.test(k)) DEV[k] = DEV_DEFAULTS[k];
check('Rooms knob: fewer or more rooms', few < many && few <= 16, [few, many]);
DEV.l2HallLo = DEV.l2HallHi = 30; DEV.l2ShaftLo = DEV.l2ShaftHi = 30;
const wide = makeLevel(5, 2);
check('wide corridors: still reaches the top', boxReach(wide.mat, 17, SHOP_FLOOR - 12).top && !wide.tomb.mended);
for (const k in DEV_DEFAULTS) if (/^l2/.test(k)) DEV[k] = DEV_DEFAULTS[k];
check('every layout knob has a Dev row in Level 2', L2_KNOBS.every(r => DEV_META.some(m => m.k === r[0] + 'Lo' && m.g === 'level2')));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
