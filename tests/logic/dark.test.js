// Level 2 stage 4: floor 2's dark zones (world/dark.js). Across seeds: they keep clear of the shop, the
// exits, the prize room and each other; the shop still reaches the top with every zone shut (the main
// route never needs one); each zone's chamber is open and in reach of the shop; the silk is only on open
// cells inside zones; darkAt, silkErase and distField work on it; deterministic; quick; floors 1 and 3
// as they were; the knobs work.
const G = require('../load');
const { makeLevel, darkAt, silkErase, distField, boxReach, CW, CH, CELL, SHOP_FLOOR, SHOP_TOP, SHOP_ROOF, ROCK,
  DEV, DEV_DEFAULTS, DEV_META, DEV_GROUPS, L2D_KNOBS } = G;
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const hash = a => { let h = 0; for (let i = 0; i < a.length; i++) h = (Math.imul(h, 31) + a[i]) | 0; return h; };
const reset = () => { for (const k in DEV_DEFAULTS) if (/^l2/.test(k)) DEV[k] = DEV_DEFAULTS[k]; };
reset();

const SEEDS = 20;
let zones = 0, ms = 0, worst = 0;
const bad = { shop: [], top: [], prize: [], apart: [], route: [], chamber: [], webOut: 0, mended: [], rooms: [], floor: [], tunnelData: [], fitsWrong: [] };
let tunnels = 0, fits = 0, openSum = 0, openN = 0;
for (let seed = 1; seed <= SEEDS; seed++) {
  const t0 = Date.now(), lv = makeLevel(seed, 2), dt = Date.now() - t0;
  ms += dt; worst = Math.max(worst, dt);
  const { mat, darkMask: M, webbing: web, dark, tomb } = lv;
  zones += dark.length;
  if (tomb.mended) bad.mended.push(seed);
  if (!dark.length) continue;
  let lowest = 0, highest = CH;
  for (let i = 0; i < CW * CH; i++) if (M[i]) { const y = (i / CW) | 0; lowest = Math.max(lowest, y); highest = Math.min(highest, y); }
  if (lowest > SHOP_TOP - SHOP_ROOF - DEV.l2dShop) bad.shop.push(seed);
  if (highest < DEV.l2dTop) bad.top.push(seed);
  const pr = tomb.rooms[tomb.prize];
  let inPrize = 0;
  for (let y = pr.y; y < pr.floor; y++) for (let x = pr.x; x < pr.x + pr.w; x++) if (M[y * CW + x]) inPrize++;
  if (inPrize) bad.prize.push(seed);
  for (let a = 0; a < dark.length; a++) for (let b = a + 1; b < dark.length; b++)
    if (Math.hypot(dark[a].cx - dark[b].cx, dark[a].cy - dark[b].cy) < DEV.l2dSpace) bad.apart.push(seed);
  // the main route without the zones: every zone cell shut
  const shut = Uint8Array.from(mat);
  for (let i = 0; i < shut.length; i++) if (M[i]) shut[i] = ROCK;
  if (!boxReach(shut, 17, SHOP_FLOOR - 12).top) bad.route.push(seed);
  // each chamber: open, on its floor, and a runner box standing there is in reach of the shop
  const R = boxReach(mat, 17, SHOP_FLOOR - 12);
  for (const z of dark) {
    const c = z.chamber;
    let got = false;
    for (let x = c.x - c.rx + 3; x < c.x + c.rx - 6 && !got; x++) for (let y = c.floor - 12; y >= c.floor - 16 && !got; y--) if (R.ok[y * CW + x] === 2) got = true;
    if (!got || darkAt(lv, c.x * CELL, c.y * CELL, CELL) !== z.id) bad.chamber.push(`${seed}:${z.id}`);
  }
  for (let i = 0; i < CW * CH; i++) if (web[i] && (mat[i] || !lv.darkShade[i])) bad.webOut++;
  // every tomb room no zone swallowed is still in reach of the shop (somewhere in its box: a zone may take part of it)
  for (const r of tomb.rooms) {
    if (r.dark >= 0) continue;
    let got = false;
    for (let y = r.y; y < r.floor && !got; y++) for (let x = r.x; x < r.x + r.w; x++) if (R.ok[y * CW + x] === 2) { got = true; break; }
    if (!got) bad.rooms.push(seed + ':' + r.id);
  }
  for (const z of dark) {
    const c = z.chamber;
    // the chamber's floor flat for its prize: solid along its middle 80%, open over it
    let rough = 0;
    for (let x = c.x - Math.round(c.rx * 0.8); x <= c.x + Math.round(c.rx * 0.8); x++) if (!mat[c.floor * CW + x] || mat[(c.floor - 1) * CW + x]) rough++;
    if (rough) bad.floor.push(seed + ':' + z.id + ':' + rough);
    // the small tunnels: data on the zone, open where they ran, each flagged whether a 6 x 11 runner box fits
    openSum += z.open; openN++;
    for (const t of z.tunnels) {
      tunnels++; if (t.fits) fits++;
      if (!t.pts.length || typeof t.fits !== 'boolean' || !(t.w > 0) || t.pts.some(p => M[p.y * CW + p.x] !== z.id + 1)) bad.tunnelData.push(seed + ':' + z.id);
      // a tunnel dug narrower than the runner (3 to 6 px) on its own can't fit it; one marked fits has room for the box over most of it
      if (t.fits && t.w < 6) bad.fitsWrong.push(seed + ':' + z.id + ':w' + t.w);
    }
  }
}
console.log(`${SEEDS} floors: ${(zones / SEEDS).toFixed(1)} zones each; makeLevel ${(ms / SEEDS).toFixed(0)} ms average, ${worst} worst`);
check('zones on most floors', zones >= SEEDS * 1.5, zones);
check('kept away from the shop', !bad.shop.length, bad.shop);
check('kept away from the exits along the top', !bad.top.length, bad.top);
check('never over the prize room', !bad.prize.length, bad.prize);
check('kept apart', !bad.apart.length, bad.apart);
check('the shop reaches the top with every zone shut (the main route needs none)', !bad.route.length, bad.route);
check('every zone\'s chamber is open, its own, and in reach of the shop', !bad.chamber.length, bad.chamber);
check('the silk is only on open cells, in a zone or its fringe', bad.webOut === 0, bad.webOut);
check('every tomb room a zone didn\'t swallow is still in reach of the shop', !bad.rooms.length, bad.rooms);
check('each chamber\'s floor is flat (the prize goes there)', !bad.floor.length, bad.floor);
console.log(`small tunnels: ${(tunnels / Math.max(1, openN)).toFixed(1)} a zone, ${fits} of ${tunnels} the runner fits; open share ${(openSum / Math.max(1, openN)).toFixed(2)} a zone`);
check('zones are filled with small tunnels, most for the aliens alone, some the runner fits', tunnels >= openN * 4 && fits > 0 && fits < tunnels * 0.6, { tunnels, fits, zones: openN });
check('each tunnel is on its zone with its data', !bad.tunnelData.length, bad.tunnelData.slice(0, 8));
check('none dug narrower than the runner is marked as fitting it', !bad.fitsWrong.length, bad.fitsWrong.slice(0, 8));
check('the tomb never needed its fallback shaft', !bad.mended.length, bad.mended);
check('quick (under 1.5 s average)', ms / SEEDS < 1500, ms / SEEDS);

// the tools later stages use
const lv = makeLevel(3, 2), z = lv.dark[0];
check('darkAt: a zone\'s middle is in it, the shop is not', darkAt(lv, z.cx * CELL, z.cy * CELL, CELL) === z.id && darkAt(lv, 100, (SHOP_FLOOR - 5) * CELL, CELL) === -1);
const web = lv.webbing.slice();
let before = 0, after = 0;
for (let i = 0; i < web.length; i++) if (web[i]) before++;
const box = silkErase(web, z.cx, z.cy, 12);
for (let i = 0; i < web.length; i++) if (web[i]) after++;
check('silkErase blows a hole and says where', box && after < before && box.x0 <= z.cx && box.x1 >= z.cx, { before, after, box });
const src = new Uint8Array(CW * CH);
for (let i = 0; i < src.length; i++) if (lv.darkMask[i]) src[i] = 1;
const dist = distField(CW, CH, src, 200);
// (outside: 20 px past the zone's side, the side with room: since round 5 a zone can reach the floor's wall)
const outX = z.x1 + 20 < CW - 3 ? z.x1 + 20 : z.x0 - 20;
check('distField takes the zones as its source (0 inside, growing outside)', dist[z.cy * CW + z.cx] === 0 && !lv.darkMask[z.cy * CW + outX] && dist[z.cy * CW + outX] > 0, outX);

// deterministic, and only floor 2
const a = makeLevel(6, 2), b = makeLevel(6, 2);
check('same seed, same zones', hash(a.darkMask) === hash(b.darkMask) && hash(a.webbing) === hash(b.webbing) && hash(a.mat) === hash(b.mat));
const f1 = makeLevel(3, 1), f3 = makeLevel(3, 3);
check('floor 1 is what it was', hash(f1.img.data) === 1936234780 && f1.dark.length === 0 && f1.darkMask === null);
check('floor 3 is what it was', hash(f3.img.data) === -672481880 && f3.dark.length === 0 && f3.webbing === null);

// the knobs
DEV.l2dCountLo = DEV.l2dCountHi = 0;
check('no zones at count 0', makeLevel(6, 2).dark.length === 0 && makeLevel(6, 2).darkMask === null);
reset();
DEV.l2dSizeLo = DEV.l2dSizeHi = 40;
const small = makeLevel(6, 2).dark.reduce((t, q) => t + q.cells, 0) / Math.max(1, makeLevel(6, 2).dark.length);
reset();
const big = a.dark.reduce((t, q) => t + q.cells, 0) / Math.max(1, a.dark.length);
check('the size knob makes them smaller', small < big * 0.7, [small, big]);
// the open share: the knob sets how much of a zone ends up open (the small tunnels fill it to that)
const share = (lo, hi) => { DEV.l2dOpenLo = lo; DEV.l2dOpenHi = hi; let o = 0, n = 0, t = 0; for (const sd of [2, 4, 6]) for (const q of makeLevel(sd, 2).dark) { o += q.open; n++; t += q.tunnels.length; } reset(); return { open: o / Math.max(1, n), tunnels: t / Math.max(1, n) }; };
const lo = share(0, 0), hi = share(0.8, 0.8);
check('open share 0: no small tunnels', lo.tunnels === 0, lo);
check('open share 0.8: about that much of a zone open, filled by tunnels', hi.open > 0.74 && hi.open < 0.9 && hi.tunnels > 10 && hi.open > lo.open + 0.1, { lo, hi });
DEV.l2dSilk = 0;
check('no silk at silk 0', !makeLevel(6, 2).webbing.some(v => v));
reset();
check('the group and its knobs are on the panel', DEV_GROUPS.some(g => g[0] === 'l2dark') &&
  L2D_KNOBS.every(r => DEV_META.some(m => m.k === r[0] + 'Lo' && m.g === 'l2dark')) &&
  ['l2dSpace', 'l2dShop', 'l2dTop', 'l2dSilk', 'l2dDark', 'l2dEdge', 'l2dHolo', 'l2dBlur', 'l2dBack', 'l2dRough', 'l2dFringe', 'l2dFireR', 'l2dTintDepth', 'l2dTorchDepth', 'l2dTorchHyst', 'l2dFire0', 'l2dFire1'].every(k => DEV_META.some(m => m.k === k && m.g === 'l2dark')));

// round 3: the black fades in with depth, the torch fails near the end of the fade (and comes back with a gap)
const { tintRamp, zoneDepth, darkDepthAt, torchStep, torchLit, TORCH_FLICKER } = G;
let mono = true;
for (let d = 0; d < 80; d++) if (tintRamp(d + 1) < tintRamp(d)) mono = false;
check('the black tint rises steadily with depth, 0 at the edge, full by l2dTintDepth', mono && tintRamp(0) === 0 && tintRamp(DEV.l2dTintDepth) === 1 && tintRamp(DEV.l2dTintDepth / 2) > 0.3 && tintRamp(DEV.l2dTintDepth / 2) < 0.7);
const dep = lv.darkDepth;
let depOk = !!dep;
for (let i = 0; dep && i < CW * CH; i++) if (!lv.darkMask[i] !== !dep[i]) { depOk = false; break; }
check('darkDepth: 0 outside a zone, from 1 at its edge, deepest in its middle', depOk && darkDepthAt(lv, z.cx * CELL, z.cy * CELL, CELL) > 20 && darkDepthAt(lv, 100, (SHOP_FLOOR - 5) * CELL, CELL) === 0, darkDepthAt(lv, z.cx * CELL, z.cy * CELL, CELL));
// walk in a step a frame, then stand, then back out: off once past l2dTorchDepth, after a flicker; back on outside
const TQ = DEV.l2dTorchDepth, H = DEV.l2dTorchHyst, ts = { inside: false, t: 99 }, dt = 1 / 60;
const run = (depth, n) => { const out = []; for (let k = 0; k < n; k++) out.push(torchStep(ts, depth, dt)); return out; };
const short = run(TQ - 1, 60), flick = run(TQ + 1, Math.ceil(TORCH_FLICKER / dt)), blind = run(TQ + 1, 30);
check("the torch works short of the trigger depth", short.every(v => v === 1));
check('past it, it flickers (on and off) and goes out', flick.includes(0) && flick.includes(1) && blind.every(v => v === 0), flick.join(''));
const hold = run(TQ - H + 1, 60);
check('standing just inside the gap it stays out (no strobing)', hold.every(v => v === 0));
const back = run(TQ - H - 1, Math.ceil(TORCH_FLICKER / dt)), lit = run(TQ - H - 1, 30);
check('back out past the gap it flickers back on', back.includes(0) && back.includes(1) && lit.every(v => v === 1), back.join(''));
check('the flicker is the same every time (no Math.random)', torchLit({ inside: true, t: 0.3 }) === torchLit({ inside: true, t: 0.3 }));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
