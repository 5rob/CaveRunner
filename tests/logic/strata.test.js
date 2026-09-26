// Floor 1's layered cave (strataCave, v85) and the timber placer (timberFrame).
// Measured on real floor-1 caves: stacked layers you can walk, holes up through them, the
// hidden rooms in their vaults, old workings levelled flat and timbered, and every timber
// set standing on rock and carrying rock (the "hovering beams" bug). timberFrame itself is
// checked on hand-made grids.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }\n';
const G = new Function('React', shim + upto +
  'return { makeLevel, timberFrame, timberWorks, CW, CH, SHOP_TOP, SHOP_ROOF, ROCK, BRICK, THEMES, DEV, DEV_DEFAULTS };')({ createElement: () => {} });
const { makeLevel, timberFrame, timberWorks, CW, CH, SHOP_TOP, SHOP_ROOF, ROCK, BRICK, THEMES } = G;
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

// how many separate rock bands a column crosses, from the top of the cave to the shop roof
const bands = (mat, x) => {
  let n = 0, was = 1;
  for (let y = 10; y < SHOP_TOP - SHOP_ROOF; y++) { const r = mat[y * CW + x] ? 1 : 0; if (r && !was) n++; was = r; }
  return n;
};
// level floor: open cell over solid, with the same floor row 24 cells running (only in the
// built-up zones, if a zone map is given)
const flatRuns = (mat, zone) => {
  let n = 0;
  for (let y = 40; y < SHOP_TOP - 20; y++) {
    let run = 0;
    for (let x = 4; x < CW - 4; x++) {
      const ok = !mat[y * CW + x] && mat[(y + 1) * CW + x] && !mat[(y - 8) * CW + x] && (!zone || zone[y * CW + x]);
      run = ok ? run + 1 : 0;
      if (run === 24) n++;
    }
  }
  return n;
};

const lvl = [], t0 = Date.now();
for (let seed = 1; seed <= 12; seed++) lvl.push(makeLevel(seed, 1));
const ms = (Date.now() - t0) / 12;
check('a floor-1 cave builds in well under a second', ms < 600, Math.round(ms));

// layers: a column down the middle of the map crosses a stack of rock bands
const bandN = lvl.map(L => [160, 320, 480].map(x => bands(L.mat, x)).reduce((a, b) => a + b) / 3);
check('floor 1 is layered: 12+ rock bands down a column on average', bandN.every(n => n >= 12), bandN.map(n => n.toFixed(1)));
const f2 = makeLevel(5, 2);
// (v87: floor 1 is zoned, so this is per cell of built-up zone against per cell of floor 2)
const cave = (SHOP_TOP - 60) * (CW - 8);
const share = L => { let b = 0; for (let y = 40; y < SHOP_TOP - 20; y++) for (let x = 4; x < CW - 4; x++) b += L.zone[y * CW + x]; return b / cave; };
const flat1 = lvl.map(L => flatRuns(L.mat, L.zone) / share(L)), flat2 = flatRuns(f2.mat);
const mean1 = flat1.reduce((a, b) => a + b) / flat1.length;
check('floor 1 built-up zones have far more long level floors than the old noise cave (floor 2)',
  mean1 > flat2 * 2 && flat1.every(n => n > flat2 * 1.5), { floor1: flat1.map(Math.round), floor2: flat2 });
check('floor 2 still uses the old cave (no workings)', f2.works.length === 0);

// the hidden rooms land in their vaults
check('both hidden rooms made on every seed', lvl.every(L => L.rooms.length === 2), lvl.map(L => L.rooms.length));

// old workings: levelled, paved, timbered
const worksN = lvl.map(L => L.works.length);
check('each cave has old workings', worksN.every(n => n >= 1), worksN);
let flatOk = 0, flatAll = 0, paved = 0, roofOk = 0, timbered = 0;
for (const L of lvl) for (const w of L.works) {
  flatAll++;
  let solid = 0, brick = 0, roof = 0, wood = 0;
  for (let x = w.x0; x <= w.x1; x++) {
    if (L.mat[w.fy * CW + x]) solid++;
    if (L.mat[w.fy * CW + x] === BRICK) brick++;
    if (L.mat[w.cy * CW + x] && !L.mat[(w.cy + 1) * CW + x]) roof++;
    for (let y = w.cy + 1; y < w.fy; y++) if (L.dimg.data[(y * CW + x) * 4 + 3]) { wood++; break; }
  }
  const n = w.x1 - w.x0 + 1;
  if (solid / n > 0.75) flatOk++;           // holes and caverns can take a bite
  if (brick / n > 0.3) paved++;
  if (roof / n > 0.6) roofOk++;
  if (wood / n > 0.3) timbered++;
}
check('workings have a level floor on one row', flatOk / flatAll > 0.85, { flatOk, flatAll });
check('workings are paved', paved / flatAll > 0.85, { paved, flatAll });
check('workings have a level roof', roofOk / flatAll > 0.8, { roofOk, flatAll });
check('workings are timbered', timbered / flatAll > 0.7, { timbered, flatAll });

// no hovering timber: every piece of timber in a working's gallery is joined, through
// wood, to rock both above and below (posts reach the floor, caps meet the roof). The
// timber is laid again on a clean layer so the decoration's rubble and grass stay out of it.
{
  let bad = 0, total = 0;
  const badAt = [];
  for (const L of lvl) {
    const clean = { data: new Uint8ClampedArray(CW * CH * 4) };
    timberWorks(L.mat, clean, L.works, THEMES[0], (() => { let s = 99; return () => (s = (s * 16807) % 2147483647) / 2147483647; })());
    L.wood = clean;
    L.zones = timberWorks.zones;
  }
  // patchy: far more timber per area inside the propped patches than outside them
  let inW = 0, inA = 0, outW = 0, outA = 0, bare = 0;
  for (const L of lvl) {
    const zin = (x, y) => L.zones.some(z => Math.hypot(x - z.x, y - z.y) < z.r);
    let lvOut = 0;
    for (let y = 40; y < SHOP_TOP - 20; y += 2) for (let x = 4; x < CW - 4; x += 2) {
      if (L.mat[y * CW + x]) continue;
      const w = L.wood.data[(y * CW + x) * 4 + 3] > 0, z = zin(x, y);
      if (z) { inA++; if (w) inW++; } else { outA++; if (w) { outW++; lvOut++; } }
    }
    if (lvOut / outA < 0.01) bare++;
  }
  const dIn = inW / inA, dOut = outW / outA;
  check('timber comes in patches: 5x+ denser inside them than outside', dIn > dOut * 5, { dIn: dIn.toFixed(3), dOut: dOut.toFixed(4) });
  for (const L of lvl) for (const w of L.works) {
    const wood = (x, y) => L.wood.data[(y * CW + x) * 4 + 3] > 0 && !L.mat[y * CW + x];
    const seen = new Uint8Array(CW * CH);
    for (let y = w.cy + 1; y < w.fy - 3; y++) for (let x = w.x0 - 4; x <= w.x1 + 4; x++) {
      if (!wood(x, y) || seen[y * CW + x]) continue;
      // flood this piece of timber; note whether it touches rock above and below
      const q = [[x, y]]; seen[y * CW + x] = 1;
      let up = false, down = false, size = 0;
      while (q.length) {
        const [a, b] = q.pop(); size++;
        if (L.mat[(b - 1) * CW + a]) up = true;
        if (L.mat[(b + 1) * CW + a]) down = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const nx = a + dx, ny = b + dy;
          if (nx < 0 || ny < 0 || nx >= CW || ny >= CH || seen[ny * CW + nx] || !wood(nx, ny)) continue;
          if (Math.abs(ny - y) > 80) continue;
          seen[ny * CW + nx] = 1; q.push([nx, ny]);
        }
      }
      if (size < 20) continue;               // moss drapes
      total++;
      if (!(up && down)) { bad++; badAt.push({ seed: lvl.indexOf(L) + 1, x, y, up, down, size }); }
    }
  }
  check('every timber frame touches rock above and below', total > 30 && bad === 0, { total, bad, badAt });
}

// ---- timberFrame on hand-made grids ----
const T = THEMES[0], R = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const grid = (roof, floor) => {             // roof(x) = last rock row above, floor(x) = first rock row below
  const m = new Uint8Array(CW * CH);
  for (let x = 0; x < 80; x++) for (let y = 0; y < 100; y++) if (y <= roof(x) || y >= floor(x)) m[y * CW + x] = ROCK;
  return m;
};
const paint = m => { const px = []; return { px, set: (x, y) => { if (!m[y * CW + x]) px.push([x, y]); } }; };
{
  const m = grid(() => 20, () => 50), P = paint(m);
  const ok = timberFrame(m, P.set, R, T, 30, 50, 45, false, 50);
  const post = P.px.filter(([x]) => x === 30);
  check('flat floor and flat roof take a set', ok && post.length > 20, post.length);
  check('its post runs from the roof to the floor',
    Math.min(...post.map(p => p[1])) <= 23 && Math.max(...post.map(p => p[1])) === 49);
}
check('a dome over the span is refused (the cap would hang in the air)',
  !timberFrame(grid(x => (x > 34 && x < 46 ? 8 : 20), () => 50), () => {}, R, T, 30, 50, 45, false, 50));
check('a post over a hole is refused',
  !timberFrame(grid(() => 20, x => (x >= 27 && x <= 33 ? 90 : 50)), () => {}, R, T, 30, 50, 45, false, 50));
check('a post on a step is refused', !timberFrame(grid(() => 20, x => (x <= 30 ? 50 : 44)), () => {}, R, T, 30, 50, 40, false));
check('a roof too high is refused', !timberFrame(grid(() => 2, () => 90), () => {}, R, T, 30, 50, 80, false));
check('a pillar between the posts is refused',
  !timberFrame(grid(x => (x === 40 ? 60 : 20), () => 50), () => {}, R, T, 30, 50, 45, false));
{
  const m = grid(x => 20 + Math.round((x - 30) * 0.3), () => 50), P = paint(m);
  check('a sloping roof takes a sloping cap', timberFrame(m, P.set, R, T, 30, 50, 45, false, 50));
}

// the knobs: more workings asked for, more made
{
  const D = G.DEV, was = [D.lvWorksLo, D.lvWorksHi];
  D.lvWorksLo = D.lvWorksHi = 0;
  const none = [1, 2, 3].map(s => makeLevel(s, 1).works.length);
  D.lvWorksLo = D.lvWorksHi = 8;
  const lots = [1, 2, 3].map(s => makeLevel(s, 1).works.length);
  [D.lvWorksLo, D.lvWorksHi] = was;
  check('Dev → old workings 0 makes none', none.every(n => n === 0), none);
  check('Dev → old workings 8 makes many', lots.every(n => n >= 5), lots);
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
