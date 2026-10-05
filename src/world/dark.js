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
 * @returns {{ zones: DarkZone[], mask: Uint8Array, web: Uint8Array, shade: Uint8Array }}
 */
export function darkZones(mat, tomb, seed, shopExit) {
  let rs = (Math.imul(seed | 0, 22695477) + 777 >>> 0) % 2147483646 + 1;
  const R = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9; i++) R();
  const mask = new Uint8Array(CW * CH), web = new Uint8Array(CW * CH);
  /** @type {DarkZone[]} */
  const zones = [];
  const want = Math.round(kr('l2dCount', R)), space = DEV.l2dSpace, shopKeep = DEV.l2dShop, topKeep = DEV.l2dTop;
  if (want <= 0) return { zones, mask, web, shade: new Uint8Array(0) };
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
  /** @type {{ id: number, changed: number[] }[]} */
  const rougher = [];
  for (const room of cand) {
    if (zones.length >= want) break;
    const rad = Math.round(kr('l2dSize', R)), cx = Math.round(room.cx), cy = Math.round(room.y + room.h / 2);
    if (cx - rad * 1.35 < 6 || cx + rad * 1.35 > CW - 6 || cy - rad * 1.35 < topKeep) continue;
    if (hits(cx, cy, rad * 1.35)) continue;
    if (zones.some(z => Math.hypot(z.cx - cx, z.cy - cy) < space + (z.r + rad) * 0.5)) continue;
    // the blob: a wobbling circle (two slow waves round it)
    const p1 = R() * 6.28, p2 = R() * 6.28, a1 = 0.18 + R() * 0.12, a2 = 0.08 + R() * 0.1;
    // and a ragged rim on that: 56 random spokes round it, sharp between, so the edge has fingers and
    // bites (still one radius per direction, so a tunnel straight to the middle never leaves the zone)
    const spokes = Array.from({ length: 56 }, () => (R() - 0.5) * 2);
    const rag = (/** @type {number} */ a) => {
      const f = ((a / 6.2832 + 1) % 1) * 56, k = Math.floor(f), t = f - k, u = spokes[k % 56], v = spokes[(k + 1) % 56];
      return u + (v - u) * t * t * (3 - 2 * t);
    };
    const edge = (/** @type {number} */ a) => rad * (1 + a1 * Math.sin(3 * a + p1) + a2 * Math.sin(5 * a + p2) + 0.16 * rag(a));
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
    const digN = (/** @type {number} */ ex, /** @type {number} */ ey, /** @type {number} */ r) => {
      let c = 0;
      for (let y = Math.floor(ey - r); y <= Math.ceil(ey + r); y++) for (let x = Math.floor(ex - r); x <= Math.ceil(ex + r); x++) {
        const i = y * CW + x;
        if (x > 0 && y > 0 && x < CW && y < CH && mask[i] === id && mat[i] && (x + 0.5 - ex) ** 2 + (y + 0.5 - ey) ** 2 <= r * r) { mat[i] = 0; c++; }
      }
      return c;
    };
    const dig = (/** @type {number} */ ex, /** @type {number} */ ey, /** @type {number} */ r) => { digN(ex, ey, r); };
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
    // the second pass: small tunnels winding through the rock left, until the zone's open share reaches
    // DEV's l2dOpen (only the aliens fit them: 3 to 6 px across, the runner is 6 x 11)
    let open = 0, tot = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * CW + x; if (mask[i] === id) { tot++; if (!mat[i]) open++; } }
    const goal = kr('l2dOpen', R) * tot;
    for (let t = 0; t < 600 && open < goal; t++) {
      const x = Math.floor(x0 + R() * (x1 - x0)), y = Math.floor(y0 + R() * (y1 - y0)), i = y * CW + x;
      if (mask[i] !== id || mat[i]) continue;
      let px = x + 0.5, py = y + 0.5, ang = R() * 6.28;
      const r = 1.5 + R() * 1.5, len = 15 + Math.floor(R() * 45);
      for (let st = 0; st < len; st++) {
        open += digN(px, py, r);
        ang += (R() - 0.5) * 0.9;
        const nx = px + Math.cos(ang) * 1.5, ny = py + Math.sin(ang) * 1.5;
        if (mask[Math.floor(ny) * CW + Math.floor(nx)] !== id) { ang += 2.2; continue; }
        px = nx; py = ny;
      }
    }
    // rough walls: lumps grown on and bitten out where the rock meets the air (cell noise), bits of rock left
    // in; the chamber's floor stays flat for its prize
    const rough = Math.max(0, DEV.l2dRough), fx0 = cx - Math.round(crx * 0.8), fx1 = cx + Math.round(crx * 0.8), fl = cy + cry;
    const flat = (/** @type {number} */ x, /** @type {number} */ y) => x >= fx0 && x <= fx1 && y >= fl - 13 && y <= fl;
    /** @type {number[]} */
    const changed = [];                                          // (cell, what it was), to undo the roughness alone
    for (let pass = 0; pass < 2 && rough > 0; pass++) {
      const src2 = mat.slice();
      for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) {
        const i = y * CW + x;
        if (mask[i] !== id || flat(x, y)) continue;
        let nb = 0;
        for (const j of [i - 1, i + 1, i - CW, i + CW, i - CW - 1, i - CW + 1, i + CW - 1, i + CW + 1]) if (src2[j]) nb++;
        const v = cellNoise(x >> 1, y >> 1, seed + id * 7 + pass);
        if (!src2[i] && nb >= 3 && v < 0.22 * rough) { changed.push(i, mat[i]); mat[i] = ROCK; }
        else if (src2[i] && src2[i] !== BED && nb <= 5 && v > 1 - 0.3 * rough) { changed.push(i, mat[i]); mat[i] = 0; }
      }
    }
    // every door must lead to the chamber for a runner-sized box (a ragged rim or a rough wall can pinch a
    // wandering tunnel): one that doesn't gets a straight one dug from it to the middle
    const fromC = boxReach(mat, cx - 3, fl - 12);
    const linked = (/** @type {{ x: number, y: number }} */ p) => {
      for (let y = p.y - 18; y <= p.y + 8; y++) for (let x = p.x - 14; x <= p.x + 8; x++) if (x > 0 && y > 0 && x < CW && y < CH && fromC.ok[y * CW + x] === 2 && !mask[y * CW + x]) return true;   // (on the tomb side: through the door)
      return false;
    };
    for (const e of entries) {
      const p = { x: Math.round(e.x), y: Math.round(e.y) };
      if (linked(p)) continue;
      digN(p.x + 0.5, p.y + 0.5, 11);                         // a wide mouth at the door itself
      const len = Math.hypot(cx - p.x, cy - p.y);
      for (let k = 0; k <= len; k += 1.5) digN(p.x + (cx - p.x) * k / len, p.y + (cy - p.y) * k / len, 9);
    }
    // the main route must still run from the shop to the top with every zone shut: if not, no zone here
    if (!routeOk()) { mat.set(snap); mask.set(msnap); continue; }
    rougher.push({ id, changed });
    zones.push({ id: id - 1, cx, cy, r: rad, x0, y0, x1, y1, room: room.id, cells: n, doors: entries.map(e => ({ x: Math.round(e.x), y: Math.round(e.y) })),
      chamber: { x: cx, y: cy, rx: crx, ry: cry, floor: cy + cry } });
  }
  // each chamber, and every door the tomb comes in by, must be in reach of the shop (a runner-sized box): if
  // the rough walls pinched a way shut, that zone goes back to its smooth caves
  if (zones.length) {
    const reach = boxReach(mat, 17, SHOP_TOP + 36);
    const near = (/** @type {number} */ px, /** @type {number} */ py, /** @type {number} */ r) => {
      for (let y = py - r; y <= py + r; y++) for (let x = px - r; x <= px + r; x++) if (x > 0 && y > 0 && x < CW && y < CH && reach.ok[y * CW + x] === 2) return true;
      return false;
    };
    for (const z of zones) {
      const c = z.chamber;
      let got = false;
      for (let x = c.x - c.rx + 3; x < c.x + c.rx - 6 && !got; x++) for (let y = c.floor - 12; y >= c.floor - 16 && !got; y--) if (reach.ok[y * CW + x] === 2) got = true;
      if (got && z.doors.every(p => near(p.x - 3, p.y - 6, 9))) continue;
      const rb = rougher.find(q => q.id === z.id + 1);
      if (rb) for (let k = rb.changed.length - 2; k >= 0; k -= 2) mat[rb.changed[k]] = rb.changed[k + 1];
    }
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
  // the fringe: the zones' darkness and silk reach out past their rock, ragged (noise over a band
  // DEV.l2dFringe px wide), with tendrils crawling out and patches just beyond; the tomb's cut stone there is
  // overgrown and bitten into (makeLevel paints it). shade: 255 in a zone, fading out through the fringe
  const shade = new Uint8Array(CW * CH), B = Math.max(1, DEV.l2dFringe);
  for (let i = 0; i < CW * CH; i++) if (mask[i]) shade[i] = 255;
  for (const z of zones) {
    const id = z.id + 1, ext = Math.ceil(B * 1.7);
    const bx0 = Math.max(3, z.x0 - ext), bx1 = Math.min(CW - 4, z.x1 + ext), by0 = Math.max(3, z.y0 - ext), by1 = Math.min(SHOP_TOP - SHOP_ROOF - 2, z.y1 + ext);
    const w = bx1 - bx0 + 1, h = by1 - by0 + 1, dist = new Float32Array(w * h).fill(1e9), q = [];
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) if (mask[y * CW + x] === id) { dist[(y - by0) * w + x - bx0] = 0; q.push((y - by0) * w + x - bx0); }
    for (let h0 = 0; h0 < q.length; h0++) {
      const k = q[h0], x = k % w, y = (k / w) | 0, v = dist[k] + 1;
      if (v > ext) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || dist[ny * w + nx] <= v) continue;
        dist[ny * w + nx] = v; q.push(ny * w + nx);
      }
    }
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const d = dist[(y - by0) * w + x - bx0], i = y * CW + x;
      if (!d || d > ext || mask[i]) continue;
      const n1 = valueNoise(x / 7, y / 7, seed + id * 13), n2 = valueNoise(x / 2.5, y / 2.5, seed + id * 31);
      let t = 1 - d / B + (n1 - 0.5) * 0.9 + (n2 - 0.5) * 0.35;
      if (n1 > 0.78 && d < B * 1.6) t = Math.max(t, (n1 - 0.78) * 3.5);
      if (t > 0) shade[i] = Math.max(shade[i], Math.min(254, Math.round(255 * Math.min(1, t))));
    }
    // tendrils: thin creeping lines out from the rim, darkness and silk along them
    const nT = Math.round(6 + z.r * 0.12);
    for (let k = 0; k < nT; k++) {
      const a = R() * 6.28;
      let x = z.cx + Math.cos(a) * z.r * 0.9, y = z.cy + Math.sin(a) * z.r * 0.9, ang = a;
      const len = B * (0.8 + R() * 1.2);
      for (let st = 0; st < len + z.r; st++) {
        ang += (R() - 0.5) * 0.7;
        x += Math.cos(ang); y += Math.sin(ang);
        const xi = Math.floor(x), yi = Math.floor(y);
        if (xi < 4 || yi < 4 || xi >= CW - 4 || yi >= SHOP_TOP - SHOP_ROOF - 2) break;
        const i = yi * CW + xi;
        if (mask[i]) continue;
        const v = Math.round(230 * (1 - st / (len + z.r)));
        for (const j of [i, i + 1, i + CW]) shade[j] = Math.max(shade[j], v);
      }
    }
  }
  // the cut stone where the fringe is thick is bitten into: rock touching the air, here and there, gone
  for (let y = 4; y < SHOP_TOP - SHOP_ROOF - 8; y++) for (let x = 4; x < CW - 4; x++) {
    const i = y * CW + x;
    if (mask[i] || shade[i] < 170 || mat[i] !== ROCK) continue;
    if ((mat[i - 1] && mat[i + 1] && mat[i - CW] && mat[i + CW]) || cellNoise(x >> 1, y >> 1, seed + 99) > (shade[i] - 170) / 140) continue;
    mat[i] = 0;
  }
  // silk on the fringe's open tomb cells, as thick as the shade says (patchy)
  for (let i = 0; i < CW * CH; i++) {
    if (mask[i] || !shade[i] || mat[i]) continue;
    const x = i % CW, y = (i / CW) | 0, t = shade[i] / 255;
    if (R() < t * 0.95 * Math.min(1, dens)) web[i] = Math.round(40 + 180 * t * (0.5 + 0.5 * valueNoise(x / 3, y / 3, seed + 7)));
  }
  return { zones, mask, web, shade };
}

// a hash, 0..1, of a cell and a seed
/** @param {number} x @param {number} y @param {number} s */
function cellNoise(x, y, s) {
  let v = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) | 0;
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}
// smooth value noise, 0..1
/** @param {number} x @param {number} y @param {number} s */
function valueNoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = cellNoise(xi, yi, s), b = cellNoise(xi + 1, yi, s), c = cellNoise(xi, yi + 1, s), d = cellNoise(xi + 1, yi + 1, s);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
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
