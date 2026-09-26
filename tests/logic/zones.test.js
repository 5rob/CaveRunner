// v87: floor 1 is two caves in zones — a big slow noise picks built-up (the layered cave)
// or natural (the old noise cave) — the jellies keep to the natural zones, and green floors
// get arched vines slung between ceiling spots. Measured on real caves and hand-made grids.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }\n';
const G = new Function('React', shim + upto +
  'return { makeLevel, boxReach, builtAt, jellyStep, archCurve, archNear, archAt, propAnchored, NATURAL_ONLY, ARCH_KNOBS, DEV, DEV_META, DEV_GROUPS, CW, CH, CELL, SHOP_TOP, SHOP_FLOOR, SHOP_ROOF, ROCK, BRICK };')({ createElement: () => {} });
const { makeLevel, boxReach, builtAt, jellyStep, archCurve, archNear, archAt, propAnchored, ARCH_KNOBS, DEV, DEV_META, DEV_GROUPS, CW, CELL, SHOP_TOP, SHOP_FLOOR, SHOP_ROOF } = G;

let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const mkRnd = s => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const shareOf = L => { let b = 0, n = 0; for (let i = 40 * CW; i < (SHOP_TOP - SHOP_ROOF) * CW; i++) { n++; b += L.zone[i]; } return b / n; };
const reachTop = L => boxReach(L.mat, Math.round(L.start.x / CELL), Math.round(L.start.y / CELL)).top;

const lv = [];
for (let seed = 1; seed <= 12; seed++) lv.push(makeLevel(seed * 7919, 1));

// ---- the zones ----
const shares = lv.map(shareOf);
check('floor 1 has a zone map; floor 2 does not', lv.every(L => L.zone) && makeLevel(5, 2).zone === null);
check('built-up share is about what the knob asks (0.4-0.55)', shares.every(s => s > 0.3 && s < 0.65), shares.map(s => s.toFixed(2)));
{
  // zones are big blobs, not speckle: few edges down a column
  let edges = 0, cols = 0;
  for (const L of lv) for (const x of [100, 320, 540]) {
    cols++;
    for (let y = 41; y < SHOP_TOP - SHOP_ROOF; y++) if (L.zone[y * CW + x] !== L.zone[(y - 1) * CW + x]) edges++;
  }
  check('zones are large: under 16 zone edges down a column on average', edges / cols < 16, (edges / cols).toFixed(1));
  check('but more than one zone down a column', edges / cols >= 1.5, (edges / cols).toFixed(1));
}
check('every cave still reaches the exit', lv.every(reachTop));
check('old workings all sit in built-up zones', lv.every(L => L.works.every(w =>
  L.zone[(w.fy - 4) * CW + w.x0] && L.zone[(w.fy - 4) * CW + w.x1])));
{
  // natural zones get the old cave's built ledges and frames back: brick above the shop
  // there, where the layered cave has none of its own
  let brick = 0;
  for (const L of lv) for (let i = 40 * CW; i < (SHOP_TOP - SHOP_ROOF - 30) * CW; i++) if (L.mat[i] === G.BRICK && !L.zone[i]) brick++;
  check('natural zones have the old ledges and frames', brick > lv.length * 200, brick);
}
{
  const was = [DEV.lvZoneShareLo, DEV.lvZoneShareHi];
  DEV.lvZoneShareLo = DEV.lvZoneShareHi = 0;
  const none = [1, 2, 3].map(s => makeLevel(s, 1));
  DEV.lvZoneShareLo = DEV.lvZoneShareHi = 1;
  const all = [1, 2, 3].map(s => makeLevel(s, 1));
  [DEV.lvZoneShareLo, DEV.lvZoneShareHi] = was;
  check('Dev share 0: no built-up zone', none.every(L => shareOf(L) === 0), none.map(shareOf));
  check('Dev share 1: all built-up', all.every(L => shareOf(L) === 1), all.map(shareOf));
  check('and both still reach the exit with both rooms', [...none, ...all].every(L => reachTop(L) && L.rooms.length === 2));
}

// ---- jellies keep to the natural zones ----
{
  let jellies = 0, inBuilt = 0, foes = 0;
  for (const L of lv) for (const e of L.enemies) {
    foes++;
    if (e.k.act !== 'jelly') continue;
    jellies++;
    if (builtAt(L.zone, e.x, e.y)) inBuilt++;
  }
  check('no jelly spawns in a built-up zone', jellies > 50 && inBuilt === 0, { jellies, inBuilt });
  check('and the floor keeps its mix (jellies still a good share)', jellies / foes > 0.3, (jellies / foes).toFixed(2));
}
{
  // a hand-made open box: natural left of x = 300, built-up right of it
  const solidCell = (cx, cy) => cx < 4 || cy < 4 || cx >= 396 || cy >= 296;
  const stay = x => x < 300;
  let worst = 0;
  for (let s = 1; s <= 6; s++) {
    const R = mkRnd(s * 101), e = { x: 240, y: 300, hx: 240, hy: 300, r: 9 };
    for (let i = 0; i < 60 * 40; i++) { jellyStep(e, { solidCell, rnd: R, stay: (x, y) => stay(x) }, 1 / 60); worst = Math.max(worst, e.x); }
  }
  check('a roaming jelly stays in its zone (home near the edge)', worst < 300 + 25, worst.toFixed(0));
  let hw = 0, moved = 0;
  for (let s = 1; s <= 6; s++) {
    const R = mkRnd(s * 37), e = { x: 150, y: 300, hx: 150, hy: 300, r: 9 };
    for (let i = 0; i < 60 * 30; i++) { jellyStep(e, { solidCell, rnd: R, hunting: true, goal: { x: 700, y: 300 }, stay: (x, y) => stay(x) }, 1 / 60); hw = Math.max(hw, e.x); }
    if (e.x > 220) moved++;
  }
  check('hunting you into a built-up zone, it comes to the edge and stops there', hw < 300 + 25 && moved === 6, { edge: hw.toFixed(0), moved });
  const R = mkRnd(9), e = { x: 350, y: 300, hx: 150, hy: 300, r: 9 };
  for (let i = 0; i < 60 * 40; i++) jellyStep(e, { solidCell, rnd: R, stay: (x, y) => stay(x) }, 1 / 60);
  check('one that finds itself in a built-up zone swims back out', e.x < 300, e.x.toFixed(0));
}

// ---- arched vines ----
check('every arched-vine knob is a min/max pair in its own Dev group', ARCH_KNOBS.every(([k]) =>
  DEV_META.some(m => m.k === k + 'Lo' && m.g === 'arch') && DEV_META.some(m => m.k === k + 'Hi' && m.g === 'arch')) &&
  DEV_GROUPS.some(g => g[0] === 'arch'));
{
  const c = archCurve(0, 0, 100, 0, 1.4, 60);
  let len = 0; for (let k = 1; k < c.length; k++) len += Math.hypot(c[k].x - c[k - 1].x, c[k].y - c[k - 1].y);
  check('archCurve: ends on the two points', c[0].x === 0 && c[0].y === 0 && Math.abs(c[60].x - 100) < 1e-9 && Math.abs(c[60].y) < 1e-9);
  check('it sags below them', Math.min(...c.map(p => -p.y)) < -20, Math.max(...c.map(p => p.y)).toFixed(1));
  check('and its length is about slack × the span', Math.abs(len / 140 - 1) < 0.08, len.toFixed(1));
  check('slack 1 is a straight line', archCurve(0, 0, 100, 30, 1, 10).every((p, k) => Math.abs(p.y - 0.3 * p.x) < 1e-9));
}
{
  let arches = 0, strands = 0, badOpen = 0, badBuilt = 0, badHang = 0, badAnc = 0, long = 0;
  for (const L of lv) {
    const solidC = (cx, cy) => L.mat[cy * CW + cx] !== 0;
    for (const pr of L.props) {
      if (pr.arc) {
        arches++;
        if (pr.alen > 200) long++;
        if (!propAnchored(pr, L.mat)) badAnc++;
        for (const [x, y] of pr.arc) {
          if (builtAt(L.zone, pr.x + x, pr.y + y)) badBuilt++;
        }
        for (let u = 0.02; u < 0.98; u += 0.02) { const q = archAt(pr, u); if (solidC(Math.floor(q.x / CELL), Math.floor(q.y / CELL) + 0)) badOpen++; }
      } else if (pr.on) {
        strands++;
        if (archNear(pr.on, pr.x, pr.y).d > 0.01) badHang++;
      }
    }
  }
  check('floor 1 has arched vines', arches >= lv.length * 5, arches);
  check('some of them long (over 100px of vine)', long >= lv.length, long);
  check('they come dense: strands hanging off them', strands > arches * 4, { arches, strands });
  check('an arch runs through open air only', badOpen === 0, badOpen);
  check('and never in a built-up zone', badBuilt === 0, badBuilt);
  check('each one holds by rock at both ends', badAnc === 0, badAnc);
  check('each strand hangs from its arch', badHang === 0, badHang);
}
{
  // cut one end loose and the arch lets go; its strands go with it
  const L = lv[0], pr = L.props.find(p => p.arc), st = L.props.find(p => p.on === pr);
  const m = L.mat.slice();
  const [bx, by] = pr.anc2;
  for (let dx = -1; dx <= 1; dx++) m[by * CW + bx + dx] = 0;
  check('an arch cut loose at one end is no longer anchored', !propAnchored(pr, m));
  pr.fall = true;
  check('and a strand off a falling arch lets go too', !st || !propAnchored(st, L.mat));
  pr.fall = false;
}
{
  const was = [DEV.arVinesLo, DEV.arVinesHi];
  DEV.arVinesLo = DEV.arVinesHi = 0;
  const n = makeLevel(11, 1).props.filter(p => p.arc).length;
  [DEV.arVinesLo, DEV.arVinesHi] = was;
  check('Dev → arched vine clusters 0 makes none', n === 0, n);
}
{
  // grab: the nearest point on the curve
  const pr = { x: 0, y: 0, arc: archCurve(0, 0, 100, 0, 1.3, 20).map(p => [p.x, p.y]) };
  const mid = archAt(pr, 0.5), q = archNear(pr, mid.x, mid.y + 6);
  check('archNear finds the curve under a point', Math.abs(q.d - 6) < 0.5 && Math.abs(q.x - 50) < 2, q);
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
