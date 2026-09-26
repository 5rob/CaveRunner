// Rats and rat nests (v88), and the two hidden rooms splitting across the zone types.
//
// ratNests is pure and runs inside makeLevel, so real floor-1 caves are measured here: how
// many nests land in each kind of zone, that the nest room can't be walked or seen into, and
// that the tunnel is too thin for you. ratStep is pure too, so it runs on hand-made grids.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }\n';
const G = new Function('React', shim + upto +
  'return { ratStep, ratNests, pathAt, pathLen, navField, navWay, RAT, CELL, CW, CH, CREATURES, HUNTERS, enemyFor, DEV, DEV_META, RA_KNOBS, makeLevel, boxReach, losClear, builtAt };')({ createElement: () => {} });
const { ratStep, navField, navWay, pathAt, pathLen, RAT, CELL, CW, CREATURES, HUNTERS, enemyFor, DEV, DEV_META, RA_KNOBS, makeLevel, boxReach, losClear, builtAt } = G;

let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const mkRnd = s => () => ((s = (s * 16807) % 2147483647) / 2147483647);

// ---- the table ----
check('Rotta is a rat, and a hunter', CREATURES.rotta.act === 'rat' && CREATURES.rotta.kp === 'ra' && HUNTERS.rat === 1);
check('the nest is a creature that never moves', CREATURES.pesa.act === 'nest' && !CREATURES.pesa.spd && !HUNTERS.nest);
const knobs = DEV_META.filter(m => m.g === 'rat');
check('every rat knob is a min/max pair on the Dev panel', RA_KNOBS.every(([k]) => knobs.some(m => m.k === k + 'Lo') && knobs.some(m => m.k === k + 'Hi')) &&
  knobs.length === RA_KNOBS.length * 2 && knobs.every(m => typeof DEV[m.k] === 'number'));
check('rats per nest defaults to 3-7, triple bite when broke', DEV.raMaxLo === 3 && DEV.raMaxHi === 7 && DEV.raBrokeLo === 3 && DEV.raBrokeHi === 3);
check('a dead nest pays 60', DEV.raNestGoldLo === 60 && DEV.raNestGoldHi === 60);
check('the rat and the nest each have a sprite', /function drawRat\(ctx/.test(src) && /function drawNest\(ctx/.test(src));

// ---- nests on real floor-1 caves ----
let nb = 0, nw = 0, levels = 0, hidden = 0, total = 0, walled = 0, thin = 0, mounded = 0, enemies = 0, reach = 0;
let painted = 0, roomsSplit = 0, heartBuilt = 0, lanterns = 0, lampBuilt = 0, apart = 0;
for (let seed = 1; seed <= 8; seed++) {
  const lv = makeLevel(seed * 97 + 3, 1);
  levels++;
  const { mat, nests, zone } = lv;
  nb += nests.filter(n => n.built).length; nw += nests.filter(n => !n.built).length;
  enemies += lv.enemies.filter(e => e.nest).length === nests.length ? 1 : 0;
  // what a runner-sized box can get to from the shop
  const R = boxReach(mat, Math.round(lv.start.x / CELL), Math.round(lv.start.y / CELL));
  if (R.top) reach++;
  const solidCell = (cx, cy) => cx < 0 || cy < 0 || cx >= CW || cy >= 1600 || mat[cy * CW + cx] !== 0;
  for (const n of nests) {
    total++;
    // the room is open, and a runner can't get to within its radius
    let reached = false;
    for (let dy = -12; dy <= 12 && !reached; dy++) for (let dx = -8; dx <= 8; dx++) {
      const i = (n.y + dy) * CW + n.x + dx;
      if (R.ok[i] === 2 && Math.hypot(dx + 3, dy + 5) < n.r + 2) { reached = true; break; }
    }
    if (!mat[n.y * CW + n.x] && !reached) walled++;
    // no sightline from the open air in front of the mouth to the room's middle
    let seen = false;
    for (let k = 4; k <= 40 && !seen; k += 4) for (const s of [-8, 0, 8]) {
      const ox = (n.mouth.x + n.nx * k - n.ny * s) * CELL, oy = (n.mouth.y + n.ny * k + n.nx * s) * CELL;
      if (solidCell(Math.floor(ox / CELL), Math.floor(oy / CELL))) continue;
      if (losClear(ox, oy, n.x * CELL, n.y * CELL, solidCell)) { seen = true; break; }
    }
    if (!seen) hidden++;
    // the tunnel's open width stays under a runner's (6px): measured across it halfway down
    const q = pathAt(n.path, pathLen(n.path) * 0.5);
    let w = 0;
    for (let s = -6; s <= 6; s += 0.5) if (!mat[Math.round(q.y + q.dx * s) * CW + Math.round(q.x - q.dy * s)]) w += 0.5;
    if (w <= 5) thin++;
    // painted over with earth on the decoration layer, room and tunnel, all but the hole
    const dd = lv.dimg.data, covered = [[n.x, n.y], ...n.path.filter(q => Math.hypot(q.x - n.mouth.x, q.y - n.mouth.y) > 5).map(q => [q.x, q.y])]
      .every(([x, y]) => mat[Math.round(y) * CW + Math.round(x)] || dd[(Math.round(y) * CW + Math.round(x)) * 4 + 3] === 255);
    if (covered) painted++;
    // a mound: rock just out in front of the surface, round the hole
    if (n.mound.length >= 10) mounded++;
  }
  // the heart and the perk: one in each kind of zone
  const hr = lv.rooms.find(r => r.kind === 'heart'), pr = lv.rooms.find(r => r.kind === 'perk');
  if (hr && pr && hr.built !== pr.built) roomsSplit++;
  if (hr && hr.built) heartBuilt++;
  // lanterns through the built-up zones
  const lamps = lv.props.filter(p => p.k === 'lamp' && (p.st === 'lantern' || p.st === 'hanglamp'));
  lanterns += lamps.length;
  lampBuilt += lamps.filter(p => builtAt(zone, p.x, p.y)).length;
  if (lamps.every(a => lamps.every(b => a === b || Math.hypot(a.x - b.x, a.y - b.y) > 60))) apart++;
}
check('most nests are in the built-up zones, a few in the natural caves', nb > nw * 2.5 && nw >= levels, { nb, nw, levels });
check('about 14-18 built-up nests a floor', nb / levels >= 9, (nb / levels).toFixed(1));
check('every nest is a creature in the level', enemies === levels);
check('you can still get from the shop to the exit', reach === levels, { reach, levels });
check('no runner can get into a nest room', walled === total, { walled, total });
check('no sightline runs down a nest tunnel to the room', hidden >= total * 0.95, { hidden, total });
check('the tunnel is thinner than you', thin >= total * 0.95, { thin, total });
check('every burrow is hidden behind painted earth until dug', painted === total, { painted, total });
check('every nest has a mound at its mouth', mounded === total, { mounded, total });
check('the heart and perk rooms are in different kinds of zone', roomsSplit === levels, { roomsSplit, levels });
check('and which one gets the built-up zone is a coin toss', heartBuilt > 0 && heartBuilt < levels, heartBuilt);
check('lanterns hang all through the built-up zones', lanterns / levels >= 25 && lampBuilt >= lanterns * 0.97, { per: lanterns / levels, lampBuilt, lanterns });
check('and they are spread out', apart === levels);
{
  const lv = makeLevel(11, 3);
  check('floors without zones have no nests and no new lanterns', !lv.nests.length && !lv.props.some(p => p.st === 'hanglamp'));
}

// ---- ratStep on hand-made grids ----
function grid(W, H, fill) {
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[y * W + x] = fill(x, y) ? 1 : 0;
  return { m, solidCell: (cx, cy) => cx < 0 || cy < 0 || cx >= W || cy >= H || m[cy * W + cx] !== 0 };
}
const inRock = (g, x, y) => g.solidCell(Math.floor(x / CELL), Math.floor(y / CELL));
const rat = (x, y) => ({ x, y, hx: x, hy: y, r: 4 });
function run(g, e, secs, env, watch) {
  const E = Object.assign({ solidCell: g.solidCell, rnd: mkRnd(11), hunting: true, goal: null }, env);
  const evs = [];
  for (let t = 0; t < secs; t += 1 / 60) {
    const ev = ratStep(e, E, 1 / 60);
    if (ev) evs.push(ev);
    if (watch) watch(e, E);
    if (E.stop && E.stop(e)) break;
  }
  return evs;
}
{
  // a room with a flat floor at row 80 and a ledge on the right, 20 rows up
  const g = grid(200, 100, (x, y) => y >= 80 || x < 2 || x > 197 || (x >= 150 && y >= 60));
  const e = rat(60, 120);
  let inside = 0;
  run(g, e, 1.5, { goal: { x: 120, y: 157 } }, e => { if (inRock(g, e.x, e.y)) inside++; });
  check('dropped in the air, it lands on the floor', e.ra.mode === 'surf' && Math.abs(e.y - (160 - RAT.hold)) < 1.5, { y: e.y, mode: e.ra.mode });
  run(g, e, 3, { goal: { x: 200, y: 157 } }, e => { if (inRock(g, e.x, e.y)) inside++; });
  check('it runs along the floor to where it wants to be', Math.abs(e.x - 200) < 10 && Math.abs(e.y - 156.5) < 2, { x: e.x, y: e.y });
  check('and never goes into the rock', inside === 0, inside);
  // up onto the ledge: it runs up the wall
  run(g, e, 4, { goal: { x: 320, y: 117 } }, e => { if (inRock(g, e.x, e.y)) inside++; });
  check('a ledge by a wall: it runs up the wall onto it', e.y < 125 && e.x > 290, { x: e.x, y: e.y });
  check('still never inside the rock', inside === 0, inside);
  // a slab floating in the air, nothing to climb: it jumps
  const f = grid(200, 100, (x, y) => y >= 80 || (x >= 140 && x < 180 && y >= 56 && y < 60));
  const j = rat(370, 150);
  run(f, j, 0.5, { goal: { x: 420, y: 157 } });
  const evs = run(f, j, 3, { goal: { x: 330, y: 109 } }, e => { if (inRock(f, e.x, e.y)) inside++; });
  check('something up off the floor and near: it jumps for it', evs.includes('jump'), evs.slice(0, 6));
  check('and lands on it', Math.abs(j.y - (112 - RAT.hold)) < 2 && j.x > 280 && j.x < 360, { x: j.x, y: j.y });
  check('never inside the rock', inside === 0, inside);
  // roaming it doesn't jump
  const r2 = rat(60, 150), ev2 = run(g, r2, 4, { goal: { x: 90, y: 110 }, hunting: false, jump: false });
  check('roaming, it only runs', !ev2.includes('jump'));
}
{
  // a nest: a room down in the rock and a winding path up to a hole in the floor
  const g = grid(200, 100, (x, y) => y >= 60 && !(Math.hypot(x - 60, y - 85) < 6));
  const P = [{ x: 120, y: 170 }, { x: 140, y: 150 }, { x: 125, y: 135 }, { x: 140, y: 121 }, { x: 140, y: 116.5 }];
  const e = rat(P[0].x, P[0].y);
  e.ra = { mode: 'tunnel', vx: 0, vy: 0, nx: 0, ny: -1, on: 0, rest: 0, side: 1, face: 1, s: 0, dir: 1, wait: 0 };
  const evs = run(g, e, 3, { path: P, goal: { x: 250, y: 116 } }, null);
  check('a new rat walks up its tunnel and out of the hole', evs[0] === 'out' && e.ra.mode === 'surf', evs);
  check('and is off across the floor', e.x > 160, e.x);
  // carrying: back to the hole, down the tunnel, and it arrives home
  const evs2 = run(g, e, 6, { path: P, home: true, goal: P[P.length - 1], stop: e => e.ra.mode === 'tunnel' && e.ra.s <= 0 });
  check('wanting home, it goes back down the hole', evs2.includes('home'), evs2);
  check('and ends up in the nest room', Math.hypot(e.x - P[0].x, e.y - P[0].y) < 1, { x: e.x, y: e.y });
  const evs3 = run(g, e, 8, { path: P, goal: { x: 60, y: 116 } });
  check('after a rest in there it comes out again', evs3.includes('out'), evs3);
}
{
  // a ceiling: it never hangs under one
  const g = grid(200, 100, (x, y) => y < 20 || y >= 80);
  const e = rat(100, 42);
  run(g, e, 0.1, { goal: { x: 100, y: 30 } });
  check('it falls off a ceiling rather than hang there', e.ra.mode === 'air' || e.y > 60, { y: e.y, mode: e.ra.mode });
}

// ---- pathfinding (v89) ----
{
  // a floor at row 80 with a wall at x 100-104 up to row 30: the way over is up the wall and down
  const g = grid(200, 100, (x, y) => y >= 80 || x < 2 || x > 197 || (x >= 100 && x <= 104 && y >= 30));
  const px = (x, y) => g.solidCell(x, y);
  const F = navField(px, 300, 155, 40);
  const w = navWay(F, 120, 155, 1);
  check('the way to the far side of a wall heads for the wall', w && w.x > 120 && w.dist > 0, w);
  // follow it all the way with ratStep's path mode
  const e = rat(120, 156.5);
  let inside = 0, got = false;
  for (let t = 0; t < 8 && !got; t += 1 / 60) {
    const way = navWay(F, e.x, e.y, 1);
    ratStep(e, { solidCell: g.solidCell, rnd: mkRnd(3), goal: way && way.dist > 2 ? way : { x: 300, y: 156 }, hunting: true, follow: !!way }, 1 / 60);
    if (inRock(g, e.x, e.y)) inside++;
    if (Math.hypot(e.x - 300, e.y - 156) < 10) got = true;
  }
  check('a rat following the way gets over the wall to the other side', got, { x: e.x, y: e.y });
  check('and never goes through the rock', inside === 0, inside);
  // a hairline crack (1px) through a thick wall is not a way through
  const c = grid(200, 100, (x, y) => y >= 80 || y < 2 || x < 2 || x > 197 || (x >= 90 && x <= 110 && y !== 70));
  const Fc = navField((x, y) => c.solidCell(x, y), 300, 155, 40);
  check('a crack thinner than a rat is not a way', navWay(Fc, 120, 155, 1) === null);
}
{
  // it runs flat out with a job on: no rests on a long stretch of floor
  const g = grid(400, 100, (x, y) => y >= 80);
  const e = rat(40, 156.5);
  ratStep(e, { solidCell: g.solidCell, rnd: mkRnd(5), goal: { x: 700, y: 156 }, hunting: true }, 1 / 60);
  let still = 0;
  for (let t = 0; t < 2; t += 1 / 60) {
    const x0 = e.x;
    ratStep(e, { solidCell: g.solidCell, rnd: mkRnd(5), goal: { x: 700, y: 156 }, hunting: true }, 1 / 60);
    if (Math.abs(e.x - x0) < 0.01) still++;
  }
  check('with a job on it barely stops (a frame to pick its way, no rests)', still <= 6, still);
}

console.log(fails ? `\n${fails} FAILED` : '\nall rat checks passed');
process.exit(fails ? 1 : 0);
