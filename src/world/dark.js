// @ts-check
// Floor 2's dark zones (Level 2 stage 4): organic blobs cut into the tomb, where the gun light dies
// and everything is a silhouette against a coat of spun silk.
//   darkZones   place them (away from the shop, the exits, the main route and the prize), cut the tomb out
//               inside each, carve the zone's own caves (a chamber in the middle, a tunnel to every
//               corridor or room it cut through, a few side pockets) and spin the silk. Plain data
//   darkAt      which zone is a world point in (-1: none)
//   silkErase   blow a hole in the silk (a disc), for explosions; returns the box it touched
//   silkColour  a silk cell's colour (the game paints its canvas with it)
//   zoneRock    the zone's rock colour (makeLevel repaints the cut rock with it)
// All in terrain pixels. Same seed + knobs = same zones (their own random stream).

import { BED, CH, CW, ROCK, SHOP_ROOF, SHOP_TOP } from '../core/consts.js';
import { mix } from '../core/util.js';
import { DEV, kr } from '../dev/knobs.js';
import { boxReach } from './zones.js';

/**
 * Dark zones into mat (floor 2's tomb already cut): returns the zones, the per-cell mask (zone number
 * + 1, 0 outside) and the silk (0 none, else how thick/bright, 1..255; open cells only).
 * @param {Uint8Array} mat @param {Tomb} tomb @param {number} seed @param {number} shopExit
 * @returns {{ zones: DarkZone[], mask: Uint8Array, web: Uint8Array }}
 */
export function darkZones(mat, tomb, seed, shopExit) {
  let rs = (Math.imul(seed | 0, 22695477) + 777 >>> 0) % 2147483646 + 1;
  const R = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9; i++) R();
  const mask = new Uint8Array(CW * CH), web = new Uint8Array(CW * CH);
  /** @type {DarkZone[]} */
  const zones = [];
  const want = Math.round(kr('l2dCount', R)), space = DEV.l2dSpace, shopKeep = DEV.l2dShop, topKeep = DEV.l2dTop;
  if (want <= 0) return { zones, mask, web };
  const rooms = tomb.rooms;
  // the main route: the rooms (and their corridors) from the vestibule to the nearest exit hall, by the tomb's links
  const start = rooms.findIndex(r => r.type === 'vestibule');
  const prev = new Int32Array(rooms.length).fill(-2);
  const q = [start];
  prev[start] = -1;
  let end = -1;
  while (q.length && end < 0) {
    const i = q.shift();
    if (rooms[i].type === 'gate') { end = i; break; }
    for (const j of rooms[i].links) if (prev[j] === -2) { prev[j] = i; q.push(j); }
  }
  const route = new Set();
  for (let i = end; i >= 0; i = prev[i]) route.add(i);
  /** @type {{ x: number, y: number, w: number, h: number }[]} */
  const keep = [];
  for (const r of rooms) if (route.has(r.id) || r.type === 'gate' || r.type === 'vestibule' || r.id === tomb.prize) keep.push({ x: r.x, y: r.y, w: r.w, h: r.h });
  for (const c of tomb.corridors) if (route.has(c.a) && route.has(c.b)) keep.push(c);
  keep.push({ x: 0, y: SHOP_TOP - SHOP_ROOF - shopKeep, w: CW, h: CH });   // the shop and above it
  keep.push({ x: 0, y: 0, w: CW, h: topKeep });                          // the exits along the top
  keep.push({ x: shopExit - 40, y: SHOP_TOP - SHOP_ROOF - 120, w: 80, h: 120 });
  const hits = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ rad) =>
    keep.some(b => { const dx = Math.max(b.x - x, 0, x - b.x - b.w), dy = Math.max(b.y - y, 0, y - b.y - b.h); return dx * dx + dy * dy < rad * rad; });
  // the candidates: rooms (each zone swallows one whole), in a shuffled order
  const cand = rooms.filter(r => !keep.some(b => b.x === r.x && b.y === r.y && b.w === r.w)).map(r => ({ r, k: R() })).sort((a, b) => a.k - b.k).map(o => o.r);
  // a free shop-to-top route, with every zone so far (and this one) solid?
  const routeOk = () => {
    const m2 = Uint8Array.from(mat);
    for (let i = 0; i < m2.length; i++) if (mask[i]) m2[i] = ROCK;
    return boxReach(m2, 17, SHOP_TOP + 36).top;
  };
  for (const room of cand) {
    if (zones.length >= want) break;
    const rad = Math.round(kr('l2dSize', R)), cx = Math.round(room.cx), cy = Math.round(room.y + room.h / 2);
    if (cx - rad * 1.35 < 6 || cx + rad * 1.35 > CW - 6 || cy - rad * 1.35 < topKeep) continue;
    if (hits(cx, cy, rad * 1.35)) continue;
    if (zones.some(z => Math.hypot(z.cx - cx, z.cy - cy) < space + (z.r + rad) * 0.5)) continue;
    // the blob: a wobbling circle (two slow waves round it)
    const p1 = R() * 6.28, p2 = R() * 6.28, a1 = 0.18 + R() * 0.12, a2 = 0.08 + R() * 0.1;
    const edge = (/** @type {number} */ a) => rad * (1 + a1 * Math.sin(3 * a + p1) + a2 * Math.sin(5 * a + p2));
    const id = zones.length + 1, x0 = Math.max(3, cx - Math.ceil(rad * 1.4)), x1 = Math.min(CW - 4, cx + Math.ceil(rad * 1.4));
    const y0 = Math.max(3, cy - Math.ceil(rad * 1.4)), y1 = Math.min(SHOP_TOP - SHOP_ROOF - 4, cy + Math.ceil(rad * 1.4));
    const snap = mat.slice(), msnap = mask.slice();
    let n = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * CW + x;
      if (mask[i] || mat[i] === BED) continue;
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (Math.hypot(dx, dy) < edge(Math.atan2(dy, dx))) { mask[i] = id; n++; }
    }
    // where the tomb runs into it: its ring cells with open tomb just outside, grouped by angle
    const ring = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * CW + x;
      if (mask[i] !== id) continue;
      if ((!mask[i - 1] && !mat[i - 1]) || (!mask[i + 1] && !mat[i + 1]) || (!mask[i - CW] && !mat[i - CW]) || (!mask[i + CW] && !mat[i + CW]))
        ring.push({ x, y, a: Math.atan2(y + 0.5 - cy, x + 0.5 - cx) });
    }
    // each stretch of it (ring cells touching, 8 ways) is a doorway; a long one gets a door every 24 cells.
    // A door is a ring cell itself, so the tunnel dug from it meets the tomb
    /** @type {{ x: number, y: number }[]} */
    const entries = [], mouths = [];
    const on = new Map(ring.map((p, k) => [p.y * CW + p.x, k])), done = new Uint8Array(ring.length);
    for (let k = 0; k < ring.length; k++) {
      if (done[k]) continue;
      const comp = [], st = [k];
      done[k] = 1;
      while (st.length) {
        const p = ring[st.pop()];
        comp.push(p);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const j = on.get((p.y + dy) * CW + p.x + dx);
          if (j !== undefined && !done[j]) { done[j] = 1; st.push(j); }
        }
      }
      comp.sort((p, q) => p.a - q.a);
      for (let i = Math.floor(Math.min(comp.length, 24) / 2); i < comp.length; i += 24) entries.push(comp[i]);
      for (let i = 0; i < comp.length; i += 3) mouths.push(comp[i]);    // and the whole crossing opened up (below)
    }
    // the tomb inside is gone: solid, then the zone's own caves
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * CW + x; if (mask[i] === id) mat[i] = ROCK; }
    const dig = (/** @type {number} */ ex, /** @type {number} */ ey, /** @type {number} */ r) => {
      for (let y = Math.floor(ey - r); y <= Math.ceil(ey + r); y++) for (let x = Math.floor(ex - r); x <= Math.ceil(ex + r); x++) {
        const i = y * CW + x;
        if (x > 0 && y > 0 && x < CW && y < CH && mask[i] === id && (x + 0.5 - ex) ** 2 + (y + 0.5 - ey) ** 2 <= r * r) mat[i] = 0;
      }
    };
    // the chamber in the middle: a lumpy oval, a flat-ish floor
    const crx = Math.max(15, Math.round(rad * 0.38)), cry = Math.max(12, Math.round(rad * 0.26));
    for (let y = cy - cry - 3; y <= cy + cry; y++) for (let x = cx - crx - 3; x <= cx + crx + 3; x++) {
      // a lumpy dome over a flat floor (cy + cry), wide enough to stand and fight on
      const dx = (x + 0.5 - cx) / crx, dy = (y + 0.5 - cy) / cry, w = 1 + 0.12 * Math.sin(Math.atan2(dy, dx) * 4 + p1);
      const i = y * CW + x;
      if (mask[i] === id && (dx * dx + Math.min(0, dy) ** 2 <= w * w) && y < cy + cry) mat[i] = 0;
    }
    // a worm from (sx, sy) to (tx, ty): wanders, always gets there
    const worm = (/** @type {number} */ sx, /** @type {number} */ sy, /** @type {number} */ tx, /** @type {number} */ ty, /** @type {number} */ r, /** @type {number} */ steps) => {
      let x = sx, y = sy, ang = Math.atan2(ty - y, tx - x);
      for (let s = 0; s < steps; s++) {
        dig(x, y, r);
        if (Math.hypot(tx - x, ty - y) < 2) break;
        let d = Math.atan2(ty - y, tx - x) - ang;
        d -= Math.round(d / 6.2832) * 6.2832;
        ang += d * 0.25 + (R() - 0.5) * 0.8;
        // never wander out of the zone (the dig stops at its edge, so the tunnel would break): head straight in
        if (mask[Math.floor(y + Math.sin(ang) * 1.5) * CW + Math.floor(x + Math.cos(ang) * 1.5)] !== id) ang = Math.atan2(ty - y, tx - x);
        x += Math.cos(ang) * 1.5; y += Math.sin(ang) * 1.5;
      }
    };
    // where the tomb ran in, its whole width opens into the zone a little way, so the join is never a pinch
    for (const p of mouths) dig(p.x + 0.5, p.y + 0.5, 6);
    for (const e of entries) worm(e.x, e.y, cx, cy, 6.5 + R() * 1.5, 900);
    if (!entries.length) {                                             // nothing ran into it: dig to the nearest open tomb
      let best = null, bd = Infinity;
      for (let y = Math.max(3, y0 - 40); y <= Math.min(CH - 4, y1 + 40); y++) for (let x = Math.max(3, x0 - 40); x <= Math.min(CW - 4, x1 + 40); x++) {
        const i = y * CW + x;
        if (mat[i] || mask[i]) continue;
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if (d < bd) { bd = d; best = { x, y }; }
      }
      if (best) {
        for (let k = 0; k <= 1; k += 1 / Math.max(1, Math.sqrt(bd))) {
          const x = cx + (best.x - cx) * k, y = cy + (best.y - cy) * k;
          for (let yy = Math.floor(y - 7); yy <= y + 7; yy++) for (let xx = Math.floor(x - 7); xx <= x + 7; xx++) if ((xx - x) ** 2 + (yy - y) ** 2 <= 49 && mat[yy * CW + xx] !== BED) mat[yy * CW + xx] = 0;
        }
      }
    }
    const pockets = 2 + Math.floor(R() * 3);
    for (let k = 0; k < pockets; k++) {
      const a = R() * 6.28, d = rad * (0.45 + R() * 0.35);
      worm(cx, cy, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, 5 + R() * 2.5, 400);
    }
    // the main route must still run from the shop to the top with every zone shut: if not, no zone here
    if (!routeOk()) { mat.set(snap); mask.set(msnap); continue; }
    zones.push({ id: id - 1, cx, cy, r: rad, x0, y0, x1, y1, room: room.id, cells: n, doors: entries.map(e => ({ x: Math.round(e.x), y: Math.round(e.y) })),
      chamber: { x: cx, y: cy, rx: crx, ry: cry, floor: cy + cry } });
  }
  // the silk: a sheet thick along every wall, then strands criss-crossing the open air, layered
  const dens = Math.max(0, DEV.l2dSilk);
  for (const z of zones) {
    const id = z.id + 1;
    let open = 0;
    for (let y = z.y0; y <= z.y1; y++) for (let x = z.x0; x <= z.x1; x++) {
      const i = y * CW + x;
      if (mask[i] !== id || mat[i]) continue;
      open++;
      let near = 9;
      for (let d = 1; d <= 6 && near === 9; d++) if (mat[i - d] || mat[i + d] || mat[i - d * CW] || mat[i + d * CW]) near = d;
      // a sheet over all of it, its thickness wandering in slow folds; thicker against the walls
      const fold = 0.5 + 0.25 * Math.sin(x * 0.21 + y * 0.07 + z.id * 2) + 0.25 * Math.sin(y * 0.17 - x * 0.05 + z.id);
      const v = 30 + fold * 55 + Math.max(0, 7 - near) * 14 + R() * 8;
      if (R() < Math.min(1, dens * (0.75 + 0.35 * fold))) web[i] = Math.min(255, Math.round(v));
    }
    // strands, spun mostly two ways (each zone its own grain), layered over the sheet
    const strands = Math.round(open * 0.09 * dens), grain = R() * 3.14;
    for (let k = 0; k < strands; k++) {
      let x = z.x0 + R() * (z.x1 - z.x0), y = z.y0 + R() * (z.y1 - z.y0);
      if (mask[Math.floor(y) * CW + Math.floor(x)] !== id) continue;
      const a = grain + (R() < 0.5 ? 0 : 1.2) + (R() - 0.5) * 0.5, len = 10 + R() * 40, v = 110 + Math.round(R() * 130), sag = (R() - 0.5) * 0.6;
      for (let s = 0; s < len; s++) {
        x += Math.cos(a); y += Math.sin(a) + sag * (s / len - 0.5);
        const i = Math.floor(y) * CW + Math.floor(x);
        if (i < 0 || i >= CW * CH || mask[i] !== id || mat[i]) break;
        web[i] = Math.max(web[i], v);
      }
    }
  }
  return { zones, mask, web };
}

// which dark zone is world point (wx, wy) in? -1: none (level: makeLevel's, or the world: W)
/** @param {{ darkMask: Uint8Array | null }} level @param {number} wx @param {number} wy @param {number} cell world units per terrain pixel */
export function darkAt(level, wx, wy, cell) {
  const m = level.darkMask;
  if (!m) return -1;
  const x = Math.floor(wx / cell), y = Math.floor(wy / cell);
  if (x < 0 || y < 0 || x >= CW || y >= CH) return -1;
  return m[y * CW + x] - 1;
}

// blow a disc of the silk away (an explosion): terrain pixels; the box it touched, or null
/** @param {Uint8Array | null} web @param {number} cx @param {number} cy @param {number} r */
export function silkErase(web, cx, cy, r) {
  if (!web) return null;
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(CW - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(CH - 1, Math.ceil(cy + r));
  let hit = false;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * CW + x;
    if (web[i] && (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) { web[i] = 0; hit = true; }
  }
  return hit ? { x0, y0, x1, y1 } : null;
}

// a silk cell's colour: pale grey-white, the thicker the brighter; alpha with it
/** @param {number} v 1..255 @returns {number[]} r, g, b, a */
export function silkColour(v) {
  const t = v / 255;
  return [150 + 92 * t, 150 + 90 * t, 158 + 86 * t, Math.round(70 + 170 * t)];
}

// the zone's rock: raw, darker than the tomb's, a little purple (the cut stone is gone)
/** @param {number} n 0..1 noise */
export function zoneRock(n) { return mix([34, 30, 40], [58, 52, 66], n); }
