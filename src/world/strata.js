// Floor 1's layered, built-up cave: strataCave (the layers, corridors, holes, vaults and
// old workings), paveWorks, and the timber that props it (timberWorks, timberFrame).

import { BRICK, CH, CW, ROCK, SHOP_FLOOR, SHOP_ROOF, SHOP_TOP } from '../core/consts.js';
import { mix } from '../core/util.js';
import { DEV, kr } from '../dev/knobs.js';
import { FUEL_WOOD } from './fire.js';

// Pass 2 and 3 for one level. Pure: reads `mat`, paints into the three images, and returns
// the props and the theme's ambient effects. Its own random stream, so adding it changed
// nothing about the cave, the enemies or the loot a seed already made. `keep` is a list of
// {x, y, r} spots (portals, loot, rooms) no prop may sit on.
// A mine's timber set (v85): two posts from the floor to the roof and a cap beam along the
// roof between them, packed tight with wedges wherever the roof lifts away from it. It is
// all measured off the rock at the spot — each post stands on level ground and meets rock
// overhead, and the roof bears on the cap along nearly its whole length — so a set always
// looks like it's holding something up. Anywhere that can't take one is refused (false).
// `set(x, y, rgb)` paints the decoration layer; `y` is a row in the open air between the
// posts; `fy` (optional) is the floor row the posts must stand on; `old` adds moss and rot;
// `maxH` the tallest post (64 by default).
export function timberFrame(mat, set, R, T, xa, xb, y, old, fy, maxH) {
  const solid = (x, yy) => x < 0 || yy < 0 || x >= CW || yy >= CH || mat[yy * CW + x] !== 0;
  const down = x => { let k = y; while (k < y + 70 && !solid(x, k + 1)) k++; return solid(x, k + 1) ? k + 1 : -1; };
  const up = x => { let k = y; while (k > y - 70 && !solid(x, k - 1)) k--; return solid(x, k - 1) ? k - 1 : -1; };
  if (xb - xa < 10 || solid(xa, y) || solid(xb, y)) return false;
  const fa = down(xa), fa2 = down(xa + 1), fb = down(xb), fb2 = down(xb - 1);
  const ca = up(xa), ca2 = up(xa + 1), cb = up(xb), cb2 = up(xb - 1);
  if ([fa, fa2, fb, fb2, ca, ca2, cb, cb2].some(v => v < 0)) return false;
  if (Math.abs(fa - fa2) > 1 || Math.abs(fb - fb2) > 1) return false;       // not on a lip
  if (fy != null && (Math.abs(fa - fy) > 3 || Math.abs(fb - fy) > 3)) return false;
  const topA = Math.max(ca, ca2) + 1, topB = Math.max(cb, cb2) + 1;          // first open row under the roof
  const hA = Math.min(fa, fa2) - topA, hB = Math.min(fb, fb2) - topB;
  if (Math.min(hA, hB) < 12 || Math.max(hA, hB) > (maxH || 64)) return false;
  const capY = x => Math.round(topA + (topB - topA) * (Math.max(xa, Math.min(xb, x)) - xa) / (xb - xa));
  const roof = [];
  let loose = 0;
  for (let x = xa; x <= xb; x++) {
    if (solid(x, y)) return false;                   // a pillar between the posts
    const r = up(x);
    if (r < 0) return false;
    const gap = capY(x) - (r + 1);                   // open rows between the roof and the cap
    if (gap < -2 || gap > 8) return false;
    if (gap > 3) loose++;
    roof.push(r);
  }
  if (loose > (xb - xa + 1) * 0.3) return false;
  const wood = old ? [86, 64, 44] : [112, 80, 50];
  const J = (c, f, j) => [c[0] * f + (R() - 0.5) * j, c[1] * f + (R() - 0.5) * j, c[2] * f + (R() - 0.5) * j];
  const moss = () => mix(T.moss[0], T.moss[1], R());
  // wedges packed between the roof and the cap
  for (let x = xa; x <= xb; x++) for (let yy = roof[x - xa] + 1; yy < capY(x); yy++) set(x, yy, J(wood, 0.5, 8));
  // the cap, two rows, running a little past each post
  for (let x = xa - 2; x <= xb + 2; x++) {
    const cy = capY(x);
    set(x, cy, J(wood, 0.95, 10));
    set(x, cy + 1, J(wood, 0.7, 10));
    if (old && R() < 0.22) { const n = 1 + Math.floor(R() * 4); for (let k = 0; k < n; k++) set(x, cy + 2 + k, moss()); }
  }
  // the posts, lit on the left, and a footing block under each
  for (const [px, top, bot] of [[xa, topA, Math.min(fa, fa2)], [xb - 1, topB, Math.min(fb, fb2)]]) {
    const rot = old && R() < 0.5 ? top + 4 + Math.floor(R() * (bot - top - 8)) : -99;
    for (let yy = top + 2; yy < bot; yy++) {
      const f = Math.abs(yy - rot) < 2 ? 0.6 : 1;
      set(px, yy, J(wood, f, 10));
      set(px + 1, yy, J(wood, 0.76 * f, 10));
    }
    for (let dx = -1; dx <= 2; dx++) set(px + dx, bot - 1, J(wood, 0.58, 8));
    if (old) for (let yy = bot - 1; yy > bot - 7; yy--) if (R() < 0.5 * (yy - bot + 7) / 6) set(px + (R() < 0.5 ? 0 : 1), yy, moss());
  }
  // knee braces from each post up under the cap
  if (Math.min(hA, hB) >= 16) for (let k = 0; k <= 5; k++) {
    set(xa + 2 + k, capY(xa + 2 + k) + 2 + (5 - k), J(wood, 0.66, 8));
    set(xb - 2 - k, capY(xb - 2 - k) + 2 + (5 - k), J(wood, 0.66, 8));
  }
  return true;
}

// ---- floor 1: a layered cave (v85) ----
// Noita's Mines are flat-ish layers of rock stacked up the map with corridors between them,
// holes to move between layers, the odd wall making a dead end, and loops where two holes
// join the same corridors. This builds that from rules rather than drawn tiles:
//   1. layers, bottom (the slab over the shop) to top. Each corridor's roof is measured off
//      the floor under it (headroom, squeezes, stalactite teeth never below the squeeze),
//      so every corridor fits the runner by construction. The next layer's top is its own
//      wavy line, kept at least 5 rows thick. Two layers are made thick in one spot to hold
//      the hidden rooms (vaults).
//   2. walls across corridors (dead ends), then holes: every stretch of corridor between
//      walls gets a hole up, so everything joins the top; extra holes make loops. A stretch
//      that can't get one loses a wall instead.
//   3. old workings: stretches of corridor flattened level, floor and roof, blended into the
//      natural cave at each end (paved and timbered later: paveWorks, timberWorks).
//   4. rasterised, then caverns cut through several layers (broken bits of strata left
//      floating, stalactites and stalagmites), then small bubbles in the rock.
// Returns what makeLevel needs: route points for re-clearing, vaults for the rooms, works.
// N = { vn, fbm, ok } (the level's seeded noise; ok(x, y), if given, is where built-up
// features may go — makeLevel's zones — so workings and vaults land whole inside one).
export function strataCave(mat, rnd, N, shopExit) {
  const { vn, fbm } = N, ok = N.ok || (() => true);
  const K = k => kr(k, rnd);
  const cnt = k => { const v = Math.max(0, K(k)); return Math.floor(v) + (rnd() < v % 1 ? 1 : 0); };
  const X0 = 4, X1 = CW - 5;
  const sm = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const yBase = SHOP_TOP - SHOP_ROOF - 24;          // the lowest corridor's floor; the shop shaft opens into it
  const hFloor = Math.max(12, Math.min(DEV.lvSqueezeLo, DEV.lvSqueezeHi, DEV.lvHeadLo, DEV.lvHeadHi));
  const line = (base, amp, sy) => {                  // swell + ripple + tilt, plus a slow field shared by neighbours
    const a = new Float32Array(CW), ph = rnd() * 50, tilt = (rnd() - 0.5) * 2 * amp;
    for (let x = 0; x < CW; x++)
      a[x] = base + amp * (2 * vn(x / 95 + ph, sy) - 1) + 0.45 * amp * (2 * vn(x / 28 + ph * 3, sy + 40) - 1)
        + tilt * (x / CW - 0.5) + 1.2 * amp * (2 * vn(x / 230 + 700, base / 240 + 700) - 1);
    return a;
  };

  // 1. layers and corridors. layers[i].top is corridor i's floor (first rock row);
  //    layers[i].bot is corridor i-1's roof (last rock row). Corridor i sits on layer i.
  const vaultAt = [];                                 // heights to put the two vaults near
  for (let k = 0; k < 40 && vaultAt.length < 2; k++) {
    const y = 160 + rnd() * (yBase - 420);
    if (vaultAt.every(v => Math.abs(v.y - y) > 300)) vaultAt.push({ y, done: false });
  }
  const layers = [{ top: line(yBase, 2, 3.7), bot: null, holes: [] }];
  const cors = [], vaults = [];
  for (let i = 0; ; i++) {
    const floorL = layers[i].top, H = K('lvHead'), sq = [];
    for (let n = cnt('lvSqz'); n-- > 0;) sq.push({ x: X0 + 20 + rnd() * (X1 - X0 - 40), w: 10 + rnd() * 22, h: K('lvSqueeze') });
    const ph = rnd() * 80, ceil = new Float32Array(CW);
    let cMin = 1e9, cSum = 0;
    for (let x = 0; x < CW; x++) {
      let h = H * (1 + 0.3 * (2 * vn(x / 60 + ph, i * 2.3) - 1));
      for (const s of sq) { const t = 1 - Math.abs(x - s.x) / s.w; if (t > 0) h += (Math.min(h, s.h) - h) * sm(t * 1.6); }
      const drip = Math.max(0, vn(x / 6 + ph, i * 4.1 + 11) - 0.62) * 22;   // teeth hanging off the layer above
      h = Math.max(hFloor, h - drip);
      ceil[x] = floorL[x] - h - 1;
      if (x >= X0 && x <= X1) { cMin = Math.min(cMin, ceil[x]); cSum += ceil[x]; }
    }
    const T = K('lvThick');
    if (cMin - T - Math.max(DEV.lvHeadLo, DEV.lvHeadHi) < 16) {
      // no room for another layer: this corridor runs up to the roof of the map
      for (let x = 0; x < CW; x++) ceil[x] = 4 + 4 * vn(x / 20 + ph, 99);
      cors.push({ i, floor: floorL, ceil, walls: [], top: true });
      break;
    }
    cors.push({ i, floor: floorL, ceil, walls: [] });
    const nt = line(cSum / (X1 - X0 + 1) - T, K('lvWave'), i * 3.1 + 7);
    for (let x = 0; x < CW; x++) nt[x] = Math.max(8, Math.min(nt[x], ceil[x] - 5));
    const L = { top: nt, bot: ceil, holes: [], vault: null };
    // a vault: this layer made 38 rows thick over one span, for a hidden room to sit in
    const want = vaultAt.find(v => !v.done && cSum / (X1 - X0 + 1) - T < v.y);
    if (want && i > 0) {
      want.done = true;
      let vx = Math.round(60 + rnd() * (CW - 120));
      for (let t = 0; t < 30 && !(ok(vx - 50, ceil[vx] - 19) && ok(vx + 50, ceil[vx] - 19) && ok(vx, ceil[vx] + 8)); t++)
        vx = Math.round(60 + rnd() * (CW - 120));
      let cm = 1e9;
      for (let x = vx - 34; x <= vx + 34; x++) cm = Math.min(cm, ceil[x]);
      cm = Math.floor(cm);
      // the corridor above rides up over it; a gentle rise, or the step is too steep to climb
      for (let x = Math.max(0, vx - 80); x <= Math.min(CW - 1, vx + 80); x++) {
        const t = sm((80 - Math.abs(x - vx)) / 46), lift = t * (ceil[x] - (cm - 38));
        nt[x] = Math.max(8, Math.min(nt[x], ceil[x] - Math.max(5, lift)));
      }
      L.vault = { x: vx, a: vx - 34, b: vx + 34, y: cm - 19, below: i };
      vaults.push(L.vault);
    }
    layers.push(L);
  }

  // 2. walls across corridors, then the holes between them
  for (const c of cors) {
    if (c.top) continue;
    for (let n = cnt('lvWalls'), tries = 0; n > 0 && tries < 40; tries++) {
      const x = X0 + 50 + rnd() * (X1 - X0 - 100), w = 8 + rnd() * 16;
      if (c.i === 0 && Math.abs(x - shopExit) < 40) continue;
      if (c.walls.some(q => Math.abs(q.x - x) < 70)) continue;
      c.walls.push({ x, w, a: x - w / 2 - 2, b: x + w / 2 + 2 });
      n--;
    }
    c.walls.sort((p, q) => p.x - q.x);
  }
  const segs = c => {
    const out = [];
    let a = X0;
    for (const w of c.walls) { out.push({ a, b: Math.floor(w.a) - 1 }); a = Math.ceil(w.b) + 1; }
    out.push({ a, b: X1 });
    return out;
  };
  const hits = (list, a, b, m) => list.some(q => a < q.b + m && b > q.a - m);
  const clash = (j, a, b) => {
    const L = layers[j], below = cors[j - 1], above = cors[j];
    return hits(L.holes, a, b, 16) || hits(below.walls, a, b, 6) || (above && hits(above.walls, a, b, 6)) ||
      (L.vault && hits([L.vault], a, b, 8));
  };
  layers[0].holes.push({ a: shopExit - 10, b: shopExit + 10 });          // down into the shop's shaft
  for (let j = 1; j < layers.length; j++) {
    const below = cors[j - 1];
    placing: for (;;) {
      layers[j].holes.length = 0;
      for (const s of segs(below)) {
        let ok = false;
        for (let t = 0; t < 40 && !ok; t++) {
          const hw = Math.max(12, Math.min(K('lvHoleW'), s.b - s.a - 10));
          const a = s.a + 5 + rnd() * Math.max(0, s.b - s.a - 10 - hw), b = a + hw;
          if (!clash(j, a, b)) { layers[j].holes.push({ a, b }); ok = true; }
        }
        if (!ok) {                                   // no way up from here: knock a wall of it down
          const w = below.walls.find(q => Math.abs(q.b + 1 - s.a) < 3) || below.walls.find(q => Math.abs(q.a - 1 - s.b) < 3);
          below.walls.splice(below.walls.indexOf(w), 1);
          continue placing;
        }
      }
      break;
    }
    for (let n = cnt('lvHoles'), t = 0; n > 0 && t < 40; t++) {
      const hw = K('lvHoleW'), a = X0 + 8 + rnd() * (X1 - X0 - 16 - hw);
      if (!clash(j, a, a + hw)) { layers[j].holes.push({ a, b: a + hw }); n--; }
    }
  }

  // 3. old workings: a stretch of corridor levelled, floor and roof, blending out at the ends
  const works = [];
  for (let n = cnt('lvWorks'), tries = 0; n > 0 && tries < 400; tries++) {
    const ci = Math.floor(rnd() * cors.length), c = cors[ci];
    if (c.top) continue;
    const ss = segs(c), s = ss[Math.floor(rnd() * ss.length)];
    if (s.b - s.a < 60) continue;
    const len = Math.min(K('lvWorkW'), s.b - s.a - 8);
    const x0 = Math.round(s.a + 4 + rnd() * (s.b - s.a - 8 - len)), x1 = Math.round(x0 + len);
    if (works.some(w => w.ci === ci && x0 < w.x1 + 40 && x1 > w.x0 - 40)) continue;
    if (vaults.some(v => (v.below === ci || v.below === ci - 1) && x0 < v.b + 24 && x1 > v.a - 24)) continue;
    if (tries < 250 && hits(layers[ci].holes, x0, x1, 4)) continue;   // a gallery floor with no hole in it, if it can
    const fs = Array.from(c.floor.slice(x0, x1 + 1)).sort((p, q) => p - q);
    let Lf = Math.round(fs[fs.length >> 1]);
    const under = layers[ci].bot, over = layers[ci + 1].top;
    let maxOver = 0;
    for (let x = Math.max(0, x0 - 28); x <= Math.min(CW - 1, x1 + 28); x++) {
      if (under) Lf = Math.min(Lf, Math.floor(under[x]) - 6);
      maxOver = Math.max(maxOver, over[x]);
    }
    const Hw = Math.round(Math.min(K('lvWorkH'), Lf - 1 - (maxOver + 6)));
    if (Hw < Math.max(16, hFloor)) continue;
    const Lc = Lf - Hw - 1;
    if (!(ok(x0, Lf - 4) && ok(x1, Lf - 4) && ok((x0 + x1) / 2, Lc + 2) && ok(x0 - 28, Lf - 4) && ok(x1 + 28, Lf - 4))) continue;
    for (let x = Math.max(s.a, x0 - 28); x <= Math.min(s.b, x1 + 28); x++) {
      const t = x < x0 ? sm((x - (x0 - 28)) / 28) : x > x1 ? sm((x1 + 28 - x) / 28) : 1;
      c.floor[x] += (Lf - c.floor[x]) * t;
      c.ceil[x] += (Lc - c.ceil[x]) * t;
    }
    works.push({ ci, x0, x1, fy: Lf, cy: Lc });
    n--;
  }

  // a sloping corridor needs more headroom than a level one (the runner is a box, and a
  // box going uphill needs its height plus the rise across its width): lift the roof where
  // it's steep, never thinning the layer above under 4 rows
  for (let pass = 0; pass < 2; pass++) for (const c of cors) {
    if (c.top) continue;
    const over = layers[c.i + 1].top;
    for (let x = X0 + 4; x <= X1 - 4; x++) {
      const sl = Math.max(Math.abs(c.floor[x + 4] - c.floor[x - 4]), Math.abs(c.ceil[x + 4] - c.ceil[x - 4])) / 8;
      const need = hFloor + 8 * sl;
      if (c.floor[x] - c.ceil[x] - 1 < need) c.ceil[x] = Math.max(over[x] + 4, c.floor[x] - need - 1);
    }
  }

  // 4. rasterise: all rock, then the corridors (walls pinched in the middle), then the holes
  mat.fill(ROCK, 0, SHOP_FLOOR * CW);
  for (const c of cors) {
    for (let x = X0; x <= X1; x++) {
      const y0 = Math.max(3, Math.floor(c.ceil[x]) + 1), y1 = Math.ceil(c.floor[x]) - 1;
      for (let y = y0; y <= y1; y++) {
        let open = true;
        for (const w of c.walls) {
          const t = (y - y0) / Math.max(1, y1 - y0);
          const hw = w.w / 2 * (0.55 + 0.9 * Math.abs(t - 0.5)) + 3 * (vn(x / 4 + w.x, y / 4) - 0.5);
          if (Math.abs(x - w.x) < hw) { open = false; break; }
        }
        if (open) mat[y * CW + x] = 0;
      }
    }
  }
  layers.forEach((L, j) => {
    for (const h of L.holes) {
      for (let x = Math.floor(h.a) - 4; x <= Math.ceil(h.b) + 4; x++) {
        if (x < X0 || x > X1) continue;
        const yT = Math.floor(L.top[x]), yB = j ? Math.ceil(L.bot[x]) : yBase + 8;
        for (let y = yT; y <= yB; y++) {
          const rim = Math.max(0, 3 - Math.min(y - yT, yB - y));      // a little funnel at each lip
          const ja = 2.5 * (vn(y / 5, h.a) - 0.5), jb = 2.5 * (vn(y / 5, h.b + 50) - 0.5);
          if (x >= h.a - rim + ja && x <= h.b + rim + jb) mat[y * CW + x] = 0;
        }
      }
    }
  });

  // caverns: whole stacks of layers fallen in, with broken bits of them left hanging
  const keepOut = [...works.map(w => ({ a: w.x0 - 24, b: w.x1 + 24, t: w.cy - 12, u: w.fy + 12 })),
    ...vaults.map(v => ({ a: v.a - 16, b: v.b + 16, t: v.y - 30, u: v.y + 30 }))];
  const inKeep = (x, y, m) => keepOut.some(k => x > k.a - m && x < k.b + m && y > k.t - m && y < k.u + m);
  const caves = [];
  for (let n = cnt('lvCaves'), tries = 0; n > 0 && tries < 80; tries++) {
    const rx = K('lvCaveW'), ry = K('lvCaveH');
    const cx = X0 + rx * 0.6 + rnd() * Math.max(0, X1 - X0 - rx * 1.2);
    const cy = 90 + ry * 0.5 + rnd() * Math.max(0, yBase - 160 - ry);
    if (keepOut.some(k => k.a < cx + rx * 1.2 && k.b > cx - rx * 1.2 && k.t < cy + ry * 1.2 && k.u > cy - ry * 1.2)) continue;
    if (caves.some(q => Math.hypot((q.cx - cx) / (q.rx + rx), (q.cy - cy) / (q.ry + ry)) < 0.6)) continue;
    caves.push({ cx, cy, rx, ry, k: caves.length });
    n--;
  }
  const inCave = (x, y) => caves.some(q => ((x - q.cx) / q.rx) ** 2 + ((y - q.cy) / q.ry) ** 2 < 1.1);
  for (const q of caves) {
    const ya = Math.max(8, Math.floor(q.cy - q.ry * 1.4)), yb = Math.min(yBase - 4, Math.ceil(q.cy + q.ry * 1.4));
    const xa = Math.max(X0, Math.floor(q.cx - q.rx * 1.4)), xb = Math.min(X1, Math.ceil(q.cx + q.rx * 1.4));
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const i = y * CW + x;
      if (!mat[i]) continue;
      const d = ((x - q.cx) / q.rx) ** 2 + ((y - q.cy) / q.ry) ** 2 + (fbm(x / 40 + q.k * 13, y / 40) - 0.5) * 0.6;
      if (d >= 1) continue;
      if (vn(x / 30 + 300 + q.k * 7, y / 7 + 300) > 0.8 - 0.14 * d) continue;   // a broken bit of layer stays
      mat[i] = 0;
    }
    // stalactites and stalagmites
    for (let m = 5 + Math.floor(rnd() * 8); m-- > 0;) {
      const x = Math.round(q.cx + (rnd() * 2 - 1) * q.rx * 0.8), y = Math.round(q.cy);
      if (x < X0 + 4 || x > X1 - 4 || mat[y * CW + x]) continue;
      let yr = y, yf = y;
      while (yr > 4 && !mat[(yr - 1) * CW + x]) yr--;
      while (yf < yBase && !mat[(yf + 1) * CW + x]) yf++;
      const room = yf - yr + 1;
      if (room < 50) continue;
      const hang = rnd() < 0.6, len = Math.min(room * (hang ? 0.4 : 0.25), (hang ? 10 : 6) + rnd() * (hang ? 30 : 16));
      const w = 2.5 + rnd() * 4;
      for (let k = 0; k < len; k++) {
        const half = w * Math.pow(1 - k / len, 0.8) + (vn(k / 3, x) - 0.5) * 1.5;
        const yy = hang ? yr + k : yf - k;
        for (let dx = -Math.ceil(half); dx <= Math.ceil(half); dx++)
          if (Math.abs(dx) <= half) mat[yy * CW + x + dx] = ROCK;
      }
    }
  }
  // bubbles in the rock
  for (let y = 8; y < yBase - 2; y += 1) for (let x = X0; x <= X1; x++) {
    const i = y * CW + x;
    if (!mat[i] || ((x | y) & 1)) continue;            // sampled on a 2px grid, the pixel and its three neighbours
    if (fbm(x / 26 + 900, y / 18 + 900) >= 0.24 || inKeep(x, y, 6)) continue;
    mat[i] = mat[i + 1] = mat[i + CW] = mat[i + CW + 1] = 0;
  }

  // route: a tube down the middle of every stretch of corridor and up through every hole,
  // re-cleared after rooms and smoothing so nothing laid later can seal a way through
  const routePath = [], points = [{ x: shopExit, y: SHOP_TOP - 30 }];
  const mid = (c, x) => (c.floor[x] + c.ceil[x]) / 2;
  for (const c of cors) for (const s of segs(c)) {
    for (let x = s.a + 6; x <= s.b - 6; x += 3) {
      const y = mid(c, x);
      if (!inCave(x, y)) routePath.push({ x, y, r: Math.min(5, Math.floor((c.floor[x] - c.ceil[x] - 2) / 2)) });
    }
    const xm = Math.round((s.a + s.b) / 2);
    points.push({ x: xm, y: mid(c, xm) });
  }
  layers.forEach((L, j) => {
    if (!j) return;
    for (const h of L.holes) {
      const x = Math.round((h.a + h.b) / 2), ya = mid(cors[j - 1], x), yb = mid(cors[j], x);
      for (let y = ya; y >= yb; y -= 3) if (!inCave(x, y)) routePath.push({ x, y, r: Math.min(5, Math.floor((h.b - h.a - 2) / 2)) });
    }
  });
  points.push({ x: CW / 2, y: 22 });
  // each vault gets its doorway: a spot in the corridor under it, clear of that corridor's walls
  for (const v of vaults) {
    const c = cors[v.below];
    for (let t = 0; t < 20; t++) {
      const px = Math.round(Math.max(X0 + 10, Math.min(X1 - 10, v.x + (rnd() < 0.5 ? -1 : 1) * (48 + rnd() * 24))));
      if (hits(c.walls, px, px, 6) || !ok(px, mid(c, px))) continue;
      v.px = px; v.py = mid(c, px);
      break;
    }
  }
  strataCave.last = { layers, cors, caves };     // for the tests
  return { routePath, points, vaults: vaults.filter(v => v.px != null), works, layers: layers.length };
}

// The old workings' floors: worn paving, with gaps where stones have gone. After smoothing,
// which would turn brick back into rock.
export function paveWorks(mat, works, vn) {
  for (const w of works)
    for (let x = w.x0; x <= w.x1; x++) {
      if (vn(x / 7, w.fy) < 0.3) continue;
      for (let y = w.fy; y < w.fy + 3; y++) if (mat[y * CW + x] === ROCK) mat[y * CW + x] = BRICK;
    }
}

// The old workings' timber: sets along the gallery at the post spacing, each one measured
// off the rock by timberFrame, and the odd prop lying on the floor. It comes in patches
// (v85, owner: "lots of support in some areas, none or minimal in others", then "way too
// dense … a third of that, but the propped areas more common"): several propped patches,
// most round a working, where the galleries keep every bay and the natural tunnels get
// timber sets too wherever the rock will take one, spaced at the post spacing. Outside them
// the galleries keep a sparse, half-rotted run of sets and the natural cave has none.
export function timberWorks(mat, dimg, works, T, R, fuel, ok) {
  const dd = dimg.data;
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= CW || y >= CH || mat[y * CW + x]) return;
    const k = (y * CW + x) * 4;
    dd[k] = c[0]; dd[k + 1] = c[1]; dd[k + 2] = c[2]; dd[k + 3] = 255;
    if (fuel) fuel[y * CW + x] = FUEL_WOOD;
  };
  let sets = 0;
  const zones = [];
  const zn = kr('lvPropZones', R), zc = Math.floor(zn) + (R() < zn % 1 ? 1 : 0);
  for (let k = 0; k < zc; k++) {
    const w = works.length && R() < 0.8 ? works[Math.floor(R() * works.length)] : null;
    zones.push({ x: w ? (w.x0 + w.x1) / 2 : 20 + R() * (CW - 40), y: w ? w.fy - 10 : 60 + R() * (SHOP_TOP - 140),
      r: kr('lvPropR', R), d: Math.max(1, kr('lvPropDense', R)) });
  }
  const zoneAt = (x, y) => zones.find(z => Math.hypot(x - z.x, y - z.y) < z.r);
  for (const w of works) {
    const xs = [];
    for (let x = w.x0 + 3 + R() * 6; x < w.x1 - 3;) {
      xs.push(Math.round(x));
      const z = zoneAt(x, w.fy);
      x += Math.max(12, kr('lvPost', R) / (z ? z.d : 1));
    }
    for (let k = 0; k + 1 < xs.length; k++) {
      if (!zoneAt(xs[k], w.fy) && R() < kr('lvPropRot', R)) continue;
      if (timberFrame(mat, set, R, T, xs[k], xs[k + 1], w.fy - 5, true, w.fy)) sets++;
    }
    if (R() < 0.4) {                                  // a fallen prop
      const len = 10 + Math.floor(R() * 10), x0 = Math.round(w.x0 + R() * Math.max(1, w.x1 - w.x0 - len));
      for (let k = 0; k < len; k++) {
        set(x0 + k, w.fy - 1, [70 + R() * 10, 52 + R() * 8, 36]);
        if (k > 2 && k < len - 2) set(x0 + k, w.fy - 2, [84 + R() * 10, 62 + R() * 8, 42]);
      }
    }
  }
  // the natural tunnels in a patch: walk each floor in it and put a set wherever one fits,
  // side by side at the patch's spacing
  for (const z of zones) {
    const used = [];
    for (let y = Math.max(20, Math.floor(z.y - z.r)); y < Math.min(SHOP_TOP - 20, z.y + z.r); y++) {
      for (let x = Math.max(6, Math.floor(z.x - z.r)); x < Math.min(CW - 30, z.x + z.r); x++) {
        if (mat[y * CW + x] || !mat[(y + 1) * CW + x] || Math.hypot(x - z.x, y - z.y) > z.r) continue;
        if (works.some(w => x > w.x0 - 34 && x < w.x1 + 30 && y > w.cy && y <= w.fy)) continue;   // galleries have their own
        if (ok && !(ok(x, y) && ok(x + 20, y))) continue;                       // built-up zones only
        const wd = 12 + Math.floor(R() * 8), gap = Math.max(4, kr('lvPost', R) / z.d - wd);
        if (used.some(u => Math.abs(u.y - y) < 10 && x < u.b + gap && x + wd > u.a - gap)) continue;
        if (timberFrame(mat, set, R, T, x, x + wd, y - 4, true, y + 1, 36)) { used.push({ a: x, b: x + wd, y }); sets++; x += wd; }
      }
    }
  }
  timberWorks.zones = zones;                       // for the tests
  return sets;
}
