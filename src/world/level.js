// @ts-check
// makeLevel(seed, floor, owned): one floor, built whole — terrain, shop, prize rooms,
// enemies, pickups, decoration, gold seams and nests. Pure: the same seed, floor and
// perks owned make the same cave.

import {
  BED, BH, BRICK, BW, CELL, CH, CW, GUN_DROPS, MOD_DROPS, PH, PICKUP_GAP, ROCK,
  SHOP_FLOOR, SHOP_ROOF, SHOP_TOP, WW
} from '../core/consts.js';
import { mix } from '../core/util.js';
import { ELITE_CHANCE, NATURAL_ONLY, eliteOf, enemyFor, rosterFor } from '../data/creatures.js';
import { themeFor } from '../data/themes.js';
import { DEV, kr, kru } from '../dev/knobs.js';
import { decorate } from './decorate.js';
import { ratNests } from './nests.js';
import { paveWorks, strataCave, timberWorks } from './strata.js';
import { goldVeins } from './veins.js';
import { boxReach } from './zones.js';

// a prize room's half-size in world units, shell included (makeLevel's rx/ry + sh, in pixels)
export const ROOM_HW = 23 * CELL, ROOM_HH = 15 * CELL;                   // gold per vein pixel dug out (before the floor's lift)

// The shop's shell, one terrain pixel at (cx, cy): dark steel panels with seams and rivets, a
// strip of ceiling lights under the roof, a bright-edged deck plate for the floor, steel columns
// for the side walls. Pure, so a test can check it
/** @param {number} cx @param {number} cy @returns {number[]} */
export function shopPanel(cx, cy) {
  const top = SHOP_TOP - SHOP_ROOF;
  if (cy < SHOP_FLOOR && (cx < 3 || cx >= CW - 3)) {                    // the side walls
    if (cx === 2 || cx === CW - 3) return [92, 102, 118];
    return (cy % 12 === 0) ? [26, 30, 38] : [50, 57, 70];
  }
  if (cy < SHOP_TOP) {                                                  // the roof
    const r = cy - top;
    if (r === 0) return [74, 82, 98];
    if (r === SHOP_ROOF - 1) return cx % 16 < 11 ? [130, 222, 255] : [40, 54, 70];   // the lights
    if (r === SHOP_ROOF - 2) return [29, 34, 43];
    if (cx % 24 === 0) return [24, 28, 36];
    if (r === 2 && (cx % 24 === 3 || cx % 24 === 21)) return [96, 108, 124];
    return [42, 48, 59];
  }
  const f = cy - SHOP_FLOOR;                                            // the floor
  if (f === 0) return cx % 20 === 0 ? [70, 78, 92] : [150, 162, 180];
  if (f === 1) return cx % 40 === 20 || cx % 40 === 21 ? [100, 210, 255] : [72, 81, 96];
  if (f < 4) return cx % 20 === 0 ? [28, 32, 40] : [46, 52, 63];
  return [20, 23, 29];
}

/** @param {number} seed @param {number} floor @param {string[]} [owned] perks you hold (unused since the room holds a green crystal) @returns {Level} */
export function makeLevel(seed, floor, owned) {
  floor = floor || 1;
  const hash = (x, y) => {
    let v = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653)) | 0;
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    v ^= v >>> 16;
    return (v >>> 0) / 4294967296;
  };
  const vn = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y) => 0.55 * vn(x, y) + 0.3 * vn(x * 2 + 17, y * 2 + 31) + 0.15 * vn(x * 4 + 53, y * 4 + 7);
  let rs = seed % 2147483646 + 1;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 12; i++) rnd();     // this generator starts cold on small seeds

  const mat = new Uint8Array(CW * CH);
  const inside = (x, y) => x >= 0 && y >= 0 && x < CW && y < CH;
  const disc = (ex, ey, r, v) => {
    const r2 = r * r;
    for (let y = Math.floor(ey - r); y <= Math.ceil(ey + r); y++)
      for (let x = Math.floor(ex - r); x <= Math.ceil(ex + r); x++)
        if (inside(x, y) && (x - ex) * (x - ex) + (y - ey) * (y - ey) <= r2) mat[y * CW + x] = v;
  };

  // 1. solid ground with caves eaten out of it.
  //    A slow "openness" noise decides whether an area is cramped or vast.
  //    All three fields are far smoother than one pixel, so they are sampled on a
  //    coarse lattice and interpolated: an fbm per pixel was over half the cost of
  //    generating a level, and the map is four times the area it used to be.
  const lattice = (step, fn) => {
    const gw = Math.ceil(CW / step) + 2, gh = Math.ceil(CH / step) + 2;
    const g = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++)
      for (let i = 0; i < gw; i++) g[j * gw + i] = fn(i * step, j * step);
    return { g, gw, inv: 1 / step };
  };
  const at = (L, x, y) => {
    const fx = x * L.inv, fy = y * L.inv;
    const xi = fx | 0, yi = fy | 0, u = fx - xi, v = fy - yi, i = yi * L.gw + xi;
    const a = L.g[i], b = L.g[i + 1], c = L.g[i + L.gw], d2 = L.g[i + L.gw + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d2) * u * v;
  };
  // Floor 1 mixes two caves in zones (v87). A big, slow noise over the whole map picks, pixel
  // by pixel, built-up (strataCave: layers, old workings, timber, vaults) or natural (the
  // noise cave below, with its ledges, frames and platforms). Both are built whole and
  // stitched along the zone edge, which a small warp roughs up and the smoothing pass melts.
  // Every other floor is the natural cave alone, until it gets its own treatment.
  const layered = floor === 1;
  const openL = lattice(8, (x, y) => fbm(x / 160 + 500, y / 160 + 500));
  const pocketL = lattice(4, (x, y) => fbm(x / 60, y / 60));
  const tunnelL = lattice(4, (x, y) => fbm(x / 90 + 200, y / 90 + 200));
  for (let cy = 0; cy < CH; cy++) {
    for (let cx = 0; cx < CW; cx++) {
      const open = Math.min(1, Math.max(0, (at(openL, cx, cy) - 0.42) / 0.16));
      const pocket = at(pocketL, cx, cy) < 0.34 + 0.24 * open;
      const tunnel = Math.abs(at(tunnelL, cx, cy) - 0.5) < 0.018 + 0.018 * open;
      mat[cy * CW + cx] = pocket || tunnel ? 0 : ROCK;
    }
  }

  // the zones: zone[i] = 1 where the map is built-up. The threshold is the share asked for,
  // measured over the cave, so "half" really is about half.
  let zone = null;
  if (layered) {
    const zs = kr('lvZoneSize', rnd), share = kr('lvZoneShare', rnd), rag = kr('lvZoneRag', rnd), ph = rnd() * 100;
    const zoneL = lattice(8, (x, y) => fbm(x / zs + 1300 + ph, y / zs + 1300));
    const warpX = lattice(4, (x, y) => vn(x / 14 + 1700, y / 14 + 1700));
    const warpY = lattice(4, (x, y) => vn(x / 14 + 1900, y / 14 + 1900));
    const vals = [];
    for (let y = 0; y < SHOP_TOP - SHOP_ROOF; y += 8) for (let x = 0; x < CW; x += 8) vals.push(at(zoneL, x, y));
    vals.sort((a, b) => a - b);
    const thr = share <= 0 ? Infinity : share >= 1 ? -Infinity : vals[Math.min(vals.length - 1, Math.floor((1 - share) * vals.length))];
    zone = new Uint8Array(CW * CH);
    for (let y = 0; y < SHOP_FLOOR; y++) for (let x = 0; x < CW; x++) {
      const wx = Math.max(0, Math.min(CW - 1, x + rag * (2 * at(warpX, x, y) - 1)));
      const wy = Math.max(0, Math.min(CH - 1, y + rag * (2 * at(warpY, x, y) - 1)));
      if (at(zoneL, wx, wy) > thr) zone[y * CW + x] = 1;
    }
  }
  const built = (x, y) => {
    if (!zone) return false;
    x = Math.round(x); y = Math.round(y);
    return x >= 0 && y >= 0 && x < CW && y < CH && zone[y * CW + x] === 1;
  };

  // 2. main route from bottom to top: chambers linked by winding tunnels
  //    that are always wide enough to fly through (side pockets still need blasting)
  const shopExit = 40 + Math.floor(rnd() * (CW - 80));   // the one way out of the shop
  // the built-up cave is built whole in its own buffer, and stitched in below
  const lay = layered ? new Uint8Array(CW * CH) : null;
  const strata = layered ? strataCave(lay, rnd, { vn, fbm, ok: built }, shopExit) : null;
  const points = [{ x: shopExit, y: SHOP_TOP - 30 }];
  const hops = 12;                                       // the cave is twice as tall now
  for (let i = 1; i <= hops; i++) {
    points.push({ x: 40 + rnd() * (CW - 80), y: CH - 26 - (CH - 60) * i / (hops + 1) + (rnd() - 0.5) * 40 });
  }
  points.push({ x: CW / 2, y: 22 });

  const blob = (ex, ey, r) => {
    const r2 = r * 1.3;
    for (let y = Math.floor(ey - r2); y <= ey + r2; y++)
      for (let x = Math.floor(ex - r2); x <= ex + r2; x++) {
        if (!inside(x, y)) continue;
        const a = Math.atan2(y - ey, x - ex);
        const wob = r * (0.75 + 0.5 * vn(Math.cos(a) * 1.5 + ex, Math.sin(a) * 1.5 + ey));
        if (Math.hypot(x - ex, (y - ey) * 1.4) <= wob) mat[y * CW + x] = 0;
      }
  };
  const routePath = [];   // remembered so smoothing can't pinch the links shut
  // keep: the list its path is remembered in. The main route (spine) is only cut through
  // natural zones at first; its built-up stretches go in spineBuilt, cut later only if the
  // layered corridors don't already carry you across (see "the way through" below).
  const spineBuilt = [];
  const worm = (x, y, tx, ty, r, maxSteps, keep, spine) => {
    let ang = tx !== null ? Math.atan2(ty - y, tx - x) : rnd() * Math.PI * 2;
    for (let s = 0; s < maxSteps; s++) {
      if (spine && built(x, y)) spineBuilt.push({ x, y, r: Math.min(r, 7) - 1 });
      else {
        disc(x, y, r, 0);
        if (keep) keep.push({ x, y, r: r - 1 });
      }
      if (tx !== null && Math.hypot(tx - x, ty - y) < 3) break;
      const want = tx !== null ? Math.atan2(ty - y, tx - x) : ang;
      let diff = want - ang;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      ang += diff * 0.12 + (rnd() - 0.5) * 0.9;
      x += Math.cos(ang) * 1.5; y += Math.sin(ang) * 1.5;
      x = Math.max(6, Math.min(CW - 7, x)); y = Math.max(6, Math.min(CH - 12, y));
    }
  };
  for (let i = 1; i < points.length - 1; i++) {
    if (rnd() < 0.7) blob(points[i].x, points[i].y, 16 + rnd() * 30);
  }
  // side branches and dead ends (natural zones only: they're cut before the stitch)
  const side = [];
  for (let i = 0; i < 48; i++) {
    worm(10 + rnd() * (CW - 20), 20 + rnd() * (CH - 60), null, null, 5 + rnd() * 6, 40 + rnd() * 150, side);
  }
  for (const c of side) if (!built(c.x, c.y)) routePath.push(c);
  // the stitch: built-up zones take the layered cave, with its own links through them
  if (layered) {
    for (let i = 0; i < SHOP_FLOOR * CW; i++) if (zone[i]) mat[i] = lay[i];
    for (const c of strata.routePath) if (built(c.x, c.y)) routePath.push(c);
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const r = rnd() < 0.4 ? 7 + rnd() * 2 : 11 + rnd() * 6;   // tight ones are still snug, but you fit
    worm(a.x, a.y, b.x, b.y, r, 2000, routePath, true);
  }
  // the built-up bits that survived the stitch whole: old workings and the vaults
  const works = strata ? strata.works.filter(w => built(w.x0, w.fy - 4) && built(w.x1, w.fy - 4) &&
    built((w.x0 + w.x1) / 2, w.cy + 2)) : [];
  const vaults = strata ? strata.vaults.filter(v => built(v.a, v.y) && built(v.b, v.y) && built(v.px, v.py)) : [];

  // 3. smooth everything into natural shapes. Same 3x3 majority as always, but the
  //    column sums are shared along the row instead of re-read nine times a pixel.
  const src = new Uint8Array(CW * CH), col = new Uint8Array(CW);
  for (let pass = 0; pass < 4; pass++) {
    src.set(mat);
    for (let cy = 1; cy < CH - 1; cy++) {
      const r0 = (cy - 1) * CW, r1 = cy * CW, r2 = (cy + 1) * CW;
      for (let cx = 0; cx < CW; cx++)
        col[cx] = (src[r0 + cx] ? 1 : 0) + (src[r1 + cx] ? 1 : 0) + (src[r2 + cx] ? 1 : 0);
      for (let cx = 1; cx < CW - 1; cx++)
        mat[r1 + cx] = col[cx - 1] + col[cx] + col[cx + 1] >= 5 ? ROCK : 0;
    }
  }
  for (const c of routePath) disc(c.x, c.y, c.r, 0);
  paveWorks(mat, works, vn);

  // solid floor and the exit room at the top
  for (let cy = SHOP_FLOOR; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) mat[cy * CW + cx] = ROCK;
  const carve = (ex, ey, rx, ry, maxY) => {
    for (let y = Math.max(0, ey - ry); y <= Math.min(maxY, ey + ry); y++)
      for (let x = Math.max(0, ex - rx); x <= Math.min(CW - 1, ex + rx); x++) {
        const dx = (x - ex) / rx, dy = (y - ey) / ry;
        if (dx * dx + dy * dy <= 1) mat[y * CW + x] = 0;
      }
  };
  carve(CW / 2, 22, 40, 16, CH);

  const emptyRatio = (x0, y0, w, hh) => {
    let e = 0, n = 0;
    for (let y = y0; y < y0 + hh; y++)
      for (let x = x0; x < x0 + w; x++) { n++; if (inside(x, y) && !mat[y * CW + x]) e++; }
    return e / n;
  };
  const slab = (x0, y0, w, hh) => {
    for (let y = y0; y < y0 + hh; y++)
      for (let x = x0; x < x0 + w; x++) if (inside(x, y)) mat[y * CW + x] = BRICK;
  };

  // 4. built ledges sticking out of cave walls
  // (natural zones only: in a built-up zone the ledges are the layers, and these read as hovering)
  let ledges = 0;
  for (let a = 0; a < 2400 && ledges < 120; a++) {
    const x = 10 + Math.floor(rnd() * (CW - 20)), y = 20 + Math.floor(rnd() * (SHOP_TOP - 50));
    if (mat[y * CW + x] || built(x, y)) continue;
    const dir = rnd() < 0.5 ? -1 : 1;
    let wx = x, dist = 0;
    while (dist < 50 && inside(wx, y) && !mat[y * CW + wx]) { wx += dir; dist++; }
    if (dist >= 50 || dist < 8) continue;
    const len = Math.min(dist + 4, 14 + Math.floor(rnd() * 26));
    const x0 = dir < 0 ? wx - 3 : wx - len + 4;
    if (emptyRatio(dir < 0 ? wx + 1 : x0, y - 12, len - 4, 12) < 0.9) continue;
    if (built(x0, y) || built(x0 + len, y)) continue;
    slab(x0, y, len, 4);
    ledges++;
  }

  // 5. old brick frames half buried in the rock
  for (let i = 0; i < 36; i++) {
    const fw = 30 + Math.floor(rnd() * 40), fh = 20 + Math.floor(rnd() * 20);
    const fx = 8 + Math.floor(rnd() * (CW - 16 - fw)), fy = 60 + Math.floor(rnd() * (SHOP_TOP - 120));
    if (built(fx, fy) || built(fx + fw, fy) || built(fx, fy + fh) || built(fx + fw, fy + fh)) continue;
    const rockRatio = 1 - emptyRatio(fx, fy, fw, fh);
    if (rockRatio < 0.25 || rockRatio > 0.85) continue;
    const gap = Math.floor(rnd() * 4);   // which side gets a doorway
    slab(fx, fy, fw, 4);
    slab(fx, fy + fh - 4, fw, 4);
    slab(fx, fy, 4, fh);
    slab(fx + fw - 4, fy, 4, fh);
    if (gap === 0) for (let y = fy; y < fy + 4; y++) for (let x = fx + 8; x < fx + 22; x++) mat[y * CW + x] = 0;
    if (gap === 1) for (let y = fy + 4; y < fy + fh - 4; y++) for (let x = fx; x < fx + 4; x++) mat[y * CW + x] = 0;
    if (gap === 2) for (let y = fy + 4; y < fy + fh - 4; y++) for (let x = fx + fw - 4; x < fx + fw; x++) mat[y * CW + x] = 0;
  }

  // 6. a few floating platforms in the big open spaces
  let floats = 0;
  for (let a = 0; a < 1600 && floats < 40; a++) {
    const len = 18 + Math.floor(rnd() * 22);
    const x0 = 8 + Math.floor(rnd() * (CW - 16 - len)), y0 = 40 + Math.floor(rnd() * (SHOP_TOP - 80));
    if (built(x0 - 12, y0) || built(x0 + len + 12, y0)) continue;
    if (emptyRatio(x0 - 12, y0 - 18, len + 24, 34) < 0.98) continue;
    slab(x0, y0, len, 4);
    floats++;
  }

  // clear a doorway wherever a ledge, frame or platform landed across a link
  for (const c of routePath) disc(c.x, c.y, Math.min(c.r, 7), 0);

  // ---- the shop: an enclosed room the full width of the level, one hole in the roof ----
  for (let cy = SHOP_TOP; cy < SHOP_FLOOR; cy++)
    for (let cx = 0; cx < CW; cx++) mat[cy * CW + cx] = 0;
  for (let cy = SHOP_TOP - SHOP_ROOF; cy < SHOP_TOP; cy++)
    for (let cx = 0; cx < CW; cx++) mat[cy * CW + cx] = BRICK;
  for (let cy = SHOP_FLOOR; cy < SHOP_FLOOR + 4; cy++)
    for (let cx = 0; cx < CW; cx++) mat[cy * CW + cx] = BRICK;
  // the way up, and a short shaft so the cave above is always reachable
  for (let cy = SHOP_TOP - SHOP_ROOF - 26; cy < SHOP_TOP; cy++)
    for (let cx = shopExit - 9; cx <= shopExit + 9; cx++)
      if (inside(cx, cy)) mat[cy * CW + cx] = 0;

  // exit ledge
  slab(CW / 2 - 24, 34, 48, 3);

  // ---- hidden rooms ----
  // One room (there were two: a perk and a heart), cut out of whatever rock is there and lined with brick
  // the way the shop is, so it reads as somewhere somebody built. The tunnel runs back to
  // a point on the main route, which is the only thing in a level guaranteed to be
  // reachable — a room carved into the rock on its own would be a room nobody ever finds.
  const rect = (x0, y0, w, h, v) => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) if (inside(x, y)) mat[y * CW + x] = v;
  };
  const tunnelTo = (x0, y0, x1, y1, r) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) disc(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, r, 0);
  };
  // On a zoned floor (v88) the two rooms are one in each kind of zone, which one is a coin
  // toss: want = true puts it in a built-up zone (a vault if one's left), false in a natural
  // one. On other floors `want` is ignored.
  const makeRoom = want => {
    for (let tries = 0; tries < 80; tries++) {
      // a built-up zone keeps a thick bit of layer for a room (a vault), and a spot in the
      // corridor under it for the tunnel to come out; with no vault left, the old way
      const v = !layered || want ? vaults.shift() : null;
      const p0 = v ? { x: v.px, y: v.py } : points[1 + Math.floor(rnd() * (points.length - 2))];
      const a = rnd() * Math.PI * 2, d = 50 + rnd() * 100;
      const ex = v ? v.x : Math.round(Math.max(40, Math.min(CW - 40, p0.x + Math.cos(a) * d)));
      const ey = v ? v.y : Math.round(Math.max(70, Math.min(SHOP_TOP - 70, p0.y + Math.sin(a) * d)));
      const rx = 20, ry = 12, sh = 3;
      // the wrong kind of zone (all four corners and the middle must match): try again,
      // unless it's the last go
      if (layered && !v && tries < 79 &&
          [[0, 0], [-rx, -ry], [rx, -ry], [-rx, ry], [rx, ry]].some(([dx, dy]) => built(ex + dx, ey + dy) !== !!want)) continue;
      rect(ex - rx - sh, ey - ry - sh, (rx + sh) * 2, (ry + sh) * 2, BRICK);   // the shell
      rect(ex - rx, ey - ry, rx * 2, ry * 2, 0);                               // and the room
      const back = Math.atan2(p0.y - ey, p0.x - ex);
      tunnelTo(ex + Math.cos(back) * (rx - 2), ey + Math.sin(back) * (ry - 2), p0.x, p0.y, 7);
      rect(ex - rx, ey - ry, rx * 2, ry * 2, 0);         // the tunnel may have eaten an edge
      return { x: ex * CELL, y: ey * CELL };
    }
    return null;
  };
  // on a zoned floor, which kind of zone it's in is a coin toss
  const perkRoom = makeRoom(layered ? rnd() < 0.5 : false);
  // and clear the route again: a room's shell is solid brick and can land straight across
  // the one tunnel the whole level hangs off. Above the shop only, or the same pass would
  // punch extra holes in the shop roof, which is laid down after the first one.
  for (const c of routePath)
    if (c.y < SHOP_TOP - SHOP_ROOF - 9) disc(c.x, c.y, Math.min(c.r, 7), 0);
  // the way through (zoned floors): can the runner get from the shop to the exit room? If
  // the built-up zones' own corridors don't join up the natural stretches of the main route,
  // the route is cut through them too, as a narrow natural shaft down through the layers.
  // Then each hidden room: one whose tunnel ends in a stretch the stitch cut off gets dug on
  // to the nearest place you can reach.
  if (layered) {
    const sx = 17, sy = SHOP_FLOOR - 12;
    let R = boxReach(mat, sx, sy);
    if (!R.top && spineBuilt.length) {
      for (const c of spineBuilt) { disc(c.x, c.y, c.r + 1, 0); routePath.push(c); }
      R = boxReach(mat, sx, sy);
    }
    // still cut off (it happens: a layer that closed over after smoothing): dig the shortest
    // way from anywhere you can get to, to anywhere the exit room can get to
    if (!R.top) {
      const E = boxReach(mat, CW / 2 - 3, 20);
      const prev = new Int32Array(CW * CH).fill(-1), q = new Int32Array(CW * CH);
      let h = 0, t = 0, hit = -1;
      for (let i = 0; i < CW * CH; i++) if (R.ok[i] === 2) { prev[i] = i; q[t++] = i; }
      while (h < t && hit < 0) {
        const i = q[h++], x = i % CW, y = (i / CW) | 0;
        if (E.ok[i] === 2) { hit = i; break; }
        for (const j of [x > 4 ? i - 1 : -1, x < CW - 11 ? i + 1 : -1, y > 4 ? i - CW : -1, y < SHOP_TOP - SHOP_ROOF - 16 ? i + CW : -1])
          if (j >= 0 && prev[j] < 0) { prev[j] = i; q[t++] = j; }
      }
      for (let i = hit, k = 0; i >= 0 && prev[i] !== i; i = prev[i], k++)
        if (k % 3 === 0) { const x = i % CW, y = (i / CW) | 0; disc(x + 3, y + 5, 7, 0); routePath.push({ x: x + 3, y: y + 5, r: 6 }); }
      R = boxReach(mat, sx, sy);
    }
    for (const r of [perkRoom]) {
      if (!r) continue;
      const cx = Math.round(r.x / CELL), cy = Math.round(r.y / CELL);
      let got = false;
      for (let dy = -5; dy <= 5 && !got; dy++) for (let dx = -5; dx <= 5; dx++) if (R.ok[(cy + dy) * CW + cx + dx] === 2) { got = true; break; }
      if (got) continue;
      let bi = -1, bd = Infinity;
      for (let i = 0; i < (SHOP_TOP - SHOP_ROOF - 14) * CW; i++) {
        if (R.ok[i] !== 2) continue;
        const d = (i % CW - cx) ** 2 + (((i / CW) | 0) - cy) ** 2;
        if (d < bd) { bd = d; bi = i; }
      }
      if (bi >= 0) tunnelTo(cx, cy, bi % CW + 3, ((bi / CW) | 0) + 5, 7);
    }
  }
  // and lay the roof back down. A disc is round, so clearing the route anywhere near the
  // roof opens a few columns of it, and a shell across the shaft plugs it: either way the
  // roof stops being a roof. Whatever happened up here, the shop has one hole in it.
  for (let cy = SHOP_TOP - SHOP_ROOF; cy < SHOP_TOP; cy++)
    for (let cx = 0; cx < CW; cx++) mat[cy * CW + cx] = BRICK;
  for (let cy = SHOP_TOP - SHOP_ROOF - 26; cy < SHOP_TOP; cy++)
    for (let cx = shopExit - 9; cx <= shopExit + 9; cx++)
      if (inside(cx, cy)) mat[cy * CW + cx] = 0;
  // rat nests (v88): floor 1 only, most in the built-up zones. Their own random stream, so
  // the rest of the level is what the seed always made. Away from the rooms and the portals.
  let nests = [];
  if (layered) {
    let ns = (Math.imul(seed | 0, 48271) + 7) >>> 0;
    ns = ns % 2147483646 + 1;
    const nr = () => (ns = (ns * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 8; i++) nr();
    const nk = [{ x: CW / 2, y: 22, r: 70 }, { x: shopExit, y: SHOP_TOP - 30, r: 50 },
      ...[perkRoom].filter(Boolean).map(r => ({ x: r.x / CELL, y: r.y / CELL, r: 45 }))];
    nests = ratNests(mat, nr, zone, nk, Math.round(kr('raNests', nr)), Math.round(kr('raNestsWild', nr)));
  }
  const nearNest = (cx, cy) => nests.some(n => Math.hypot(n.x - cx, n.y - cy) < 20 || Math.hypot(n.mouth.x - cx, n.mouth.y - cy) < 10);
  // its prize: a green crystal on the altar (the perk machine turns it into an unlock)
  const rooms = [];
  if (perkRoom) rooms.push({ kind: 'green', x: perkRoom.x, y: perkRoom.y, taken: false, built: built(perkRoom.x / CELL, perkRoom.y / CELL) });

  // unbreakable border
  for (let cy = 0; cy < CH; cy++)
    for (let cx = 0; cx < CW; cx++)
      if (cx < 3 || cx >= CW - 3 || cy < 3 || cy >= CH - 3) mat[cy * CW + cx] = BED;
  // colour the terrain (the rock mottle rides the same interpolated lattice).
  // The palette is the floor's own, so the same floor always looks the same.
  const T = themeFor(floor);
  const tintL = lattice(4, (x, y) => fbm(x / 6 + 100, y / 6 + 100));
  const img = new ImageData(CW, CH);
  const d = img.data;
  for (let cy = 0; cy < CH; cy++) {
    for (let cx = 0; cx < CW; cx++) {
      const i = cy * CW + cx, m = mat[i];
      if (!m) continue;
      const r1 = hash(cx * 7 + 3, cy * 13 + 5);
      let c;
      if (m === ROCK) {
        const exposed = cy > 1 && (mat[i - CW] === 0 || mat[i - 2 * CW] === 0);
        c = exposed ? mix(T.moss[0], T.moss[1], r1)
                    : mix(T.rock[0], T.rock[1], at(tintL, cx, cy));
      } else if (m === BRICK) {
        const k = cx + (cy % 2) * 3;
        if (k % 6 === 0) c = T.mortar;
        else {
          c = mix(T.brick[0], T.brick[1], hash(Math.floor(k / 6), cy));
          if (cy > 0 && mat[i - CW] === 0) c = c.map(v => v * 1.18);
        }
      } else {
        c = mix(T.bed[0], T.bed[1], r1);
      }
      const j = (r1 - 0.5) * 10;
      d[i * 4] = c[0] + j; d[i * 4 + 1] = c[1] + j; d[i * 4 + 2] = c[2] + j; d[i * 4 + 3] = 255;
    }
  }

  // the shop's shell is high-tech, whatever the floor's theme: steel roof, floor and walls
  for (let cy = SHOP_TOP - SHOP_ROOF; cy < CH; cy++)
    for (let cx = 0; cx < CW; cx++) {
      const i = cy * CW + cx;
      if (!mat[i]) continue;
      const c = shopPanel(cx, cy), j = (hash(cx * 5 + 1, cy * 3 + 2) - 0.5) * 4;
      d[i * 4] = c[0] + j; d[i * 4 + 1] = c[1] + j; d[i * 4 + 2] = c[2] + j; d[i * 4 + 3] = 255;
    }
  // the shop's floor can't be dug or blown through: bedrock, painted as the steel above
  for (let cy = SHOP_FLOOR; cy < SHOP_FLOOR + 4; cy++)
    for (let cx = 0; cx < CW; cx++) mat[cy * CW + cx] = BED;

  // the rat nests' mounds: fresh-dug earth, not moss
  for (const n of nests) for (const i of n.mound) {
    if (mat[i] !== ROCK) continue;
    const r1 = hash(i % CW * 3 + 5, ((i / CW) | 0) * 7 + 1), c = mix([92, 70, 48], [128, 98, 66], r1);
    d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2];
  }
  // background
  const bgImg = new ImageData(BW, BH);
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      const t = Math.pow(fbm(x / 10 + 300, y / 10 + 300), 1.6);
      const c = mix(T.bg, T.bg2, Math.min(1, t * 1.3));
      // big, slow blotches of shadow over the pattern, so the back wall has some depth
      const big = fbm(x / 34 + 700, y / 34 + 500);
      const shade = 1 - 0.55 * Math.max(0, Math.min(1, (big - 0.35) / 0.3));
      const j = (hash(x + 900, y + 900) - 0.5) * 4, k = (y * BW + x) * 4;
      bgImg.data[k] = c[0] * shade + j; bgImg.data[k + 1] = c[1] * shade + j; bgImg.data[k + 2] = c[2] * shade + j; bgImg.data[k + 3] = 255;
    }

  const startCX = 14;                                  // far left of the shop room
  const start = { x: startCX * CELL, y: SHOP_FLOOR * CELL - PH };
  const arrival = { x: (startCX + 3) * CELL, y: (SHOP_FLOOR - 13) * CELL };

  // shop stock: just the heal now, beside the portal you arrive through, where you land. Mods
  // are bought from the vending machine in the middle of the room (game/systems/shops.js)
  const stock = [];
  const shelf = (SHOP_FLOOR - 13) * CELL;
  // the heal (free the first time, dearer each time after: healPrice), just along from the portal you arrive through. Far enough along that
  // you are not standing on it the moment you land. The two level vending machines come
  // next along the wall (VEND_BUY_X, VEND_SELL_X)
  stock.push({ kind: 'heal', x: arrival.x + 62, y: shelf, price: 0, sold: false, bought: 0 });
  const portal = { x: WW / 2 - 10, y: 34 * CELL - 30, w: 20, h: 30 };

  // enemies in open spaces. Each one is drawn off this floor's roster, so the mix you
  // meet is the floor's own and stays the same run to run.
  const clear = (cx, cy, r) => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= CW || y >= CH || mat[y * CW + x]) return false;
      }
    return true;
  };
  const enemies = [];
  const roster = rosterFor(floor, rnd);
  const wanted = Math.min(Math.max(136, DEV.enemies), DEV.enemies + (floor - 1) * DEV.enemiesUp);
  // a creature that only lives in the natural zones (the jellies: the built-up corridors are
  // too tight to swim) and was rolled for a built-up spot keeps its turn for the next spot,
  // so the floor's mix stays the same
  let waiting = null, waits = 0;
  for (let a = 0; a < 20000 && enemies.length < wanted; a++) {
    const cx = 8 + Math.floor(rnd() * (CW - 16)), cy = 50 + Math.floor(rnd() * (SHOP_TOP - 70));
    if (!clear(cx, cy, 8) || nearNest(cx, cy)) continue;
    const x = cx * CELL, y = cy * CELL;
    if (Math.hypot(x - start.x, y - start.y) < 200) continue;
    if (enemies.some(e => Math.hypot(e.x - x, e.y - y) < 90)) continue;
    let k = waiting || enemyFor(roster[Math.floor(rnd() * roster.length)], floor);
    waiting = null;
    if (NATURAL_ONLY[k.act] && built(cx, cy)) { if (++waits < 300) waiting = k; continue; }
    waits = 0;
    if (rnd() < ELITE_CHANCE) k = eliteOf(k);   // a few elites: gold, tougher, carrying a crystal
    enemies.push({ x, y, ty: y, r: k.r, phase: rnd() * 6.28, hp: k.hp, hpMax: k.hp,
      cd: 1 + rnd() * 2, flash: 0, lx: 0, ly: 1, hx: x, hy: y, tgt: null, rest: rnd() * 3,
      k, touch: 0, charge: 0 });
  }
  // the nests, as creatures that never move: in world units, the path room → mouth
  for (const n of nests) {
    const k = enemyFor('pesa', floor), x = n.x * CELL, y = n.y * CELL;
    enemies.push({ x, y, ty: y, r: k.r, phase: 0, hp: k.hp, hpMax: k.hp, cd: 0, flash: 0, lx: 0, ly: 1,
      hx: x, hy: y, tgt: null, rest: 0, k, touch: 0, charge: 0,
      nest: { path: n.path.map(q => ({ x: (q.x + 0.5) * CELL, y: (q.y + 0.5) * CELL })),
        mouth: { x: (n.mouth.x + 0.5) * CELL, y: (n.mouth.y + 0.5) * CELL }, built: n.built,
        t: 0.5 + (n.x % 7) * 0.4, stash: 0, max: 0, left: Math.round(kru('raBrood', hash(n.x * 3 + 11, n.y * 5 + 7))) } });
  }

  // guns and red crystals to find: the higher up the cave, the better the roll.
  // Half the mods there used to be (crystals now), and they have to sit far enough apart that the
  // few of them are spread over the whole cave rather than bunched in one corner.
  const pickups = [];
  // the first floor under a spot, so a pickup sits on the ground rather than hanging in
  // the air wherever an open cell happened to be
  let gunsLeft = GUN_DROPS, modsLeft = MOD_DROPS;
  for (let a = 0; a < 20000 && gunsLeft + modsLeft > 0; a++) {
    const cx = 8 + Math.floor(rnd() * (CW - 16)), cy = 30 + Math.floor(rnd() * (SHOP_TOP - 60));
    if (!clear(cx, cy, 6) || nearNest(cx, cy)) continue;
    // and drop it onto the first floor below, but only as far as the open box it was
    // picked for — further than that and it lands in a crack you cannot stand next to.
    // Nothing to land on inside the box means this spot is no good and another is tried.
    let gy = cy;
    while (gy - cy < 6 && !mat[(gy + 1) * CW + cx]) gy++;
    if (!mat[(gy + 1) * CW + cx]) continue;
    const x = cx * CELL, y = (gy + 1) * CELL - 9;
    if (Math.hypot(x - start.x, y - start.y) < 200) continue;
    if (pickups.some(q => Math.hypot(q.x - x, q.y - y) < PICKUP_GAP)) continue;
    // not guns or mods any more: red crystals (the shop's machines turn them into unlocks and
    // boosted rerolls). Still counted as the two kinds, so the spread over the cave is the same
    if (gunsLeft && (!modsLeft || rnd() < gunsLeft / (gunsLeft + modsLeft))) gunsLeft--;
    else modsLeft--;
    pickups.push({ kind: 'crystal', x, y, floor, t: rnd() * 6.28 });
  }

  // pass 2 and 3: decoration, on its own random stream so the cave above is untouched
  const dimg = new ImageData(CW, CH);
  const fuel = new Uint8Array(CW * CH);                 // what burns, and how (see fireStep)
  if (strata) timberWorks(mat, dimg, works, T, rnd, fuel, built);
  const keep = [{ x: start.x, y: start.y, r: 40 }, { x: arrival.x, y: arrival.y, r: 50 },
    { x: portal.x + portal.w / 2, y: portal.y + portal.h / 2, r: 50 },
    ...rooms.map(r => ({ x: r.x, y: r.y, r: 70 })), ...pickups.map(q => ({ x: q.x, y: q.y, r: 22 })),
    ...nests.map(n => ({ x: n.mouth.x * CELL, y: n.mouth.y * CELL, r: 18 }))];
  const deco = decorate(mat, img, dimg, bgImg, floor, seed, keep, fuel, zone);
  // gold seams, painted over whatever the decoration left on the rock
  const ore = goldVeins(mat, seed, floor);
  for (let i = 0; i < ore.length; i++) {
    if (!ore[i] || mat[i] !== ROCK) { ore[i] = 0; continue; }
    fuel[i] = 0;                                          // a seam painted over moss
    const r1 = hash(i % CW * 5 + 11, ((i / CW) | 0) * 3 + 7), k = i * 4;
    const glint = r1 > 0.9 ? 1.25 : 0.8 + r1 * 0.3;
    d[k] = Math.min(255, 222 * glint); d[k + 1] = Math.min(255, 168 * glint); d[k + 2] = 48 * glint; d[k + 3] = 255;
  }

  // the burrows are real holes, hidden only by the fog (the tunnel bends, so no sightline
  // runs down it): clear any decoration the bakes put in them so they read as open
  for (const n of nests) {
    const R = n.r + 3, clear = (x, y) => {
      const i = y * CW + x;
      if (x < 0 || y < 0 || x >= CW || y >= CH || mat[i]) return;
      dimg.data[i * 4 + 3] = 0; fuel[i] = 0;
    };
    for (let y = n.y - R; y <= n.y + R; y++) for (let x = n.x - R; x <= n.x + R; x++) clear(x, y);
    for (const q of n.path) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) clear(Math.round(q.x) + dx, Math.round(q.y) + dy);
  }

  return { mat, img, bgImg, dimg, ore, fuel, props: deco.props, amb: deco.amb, start, portal, enemies, pickups, stock, shopExit, arrival,
    rooms, roster, theme: T.name, works, zone, nests };
}
