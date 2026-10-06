// @ts-check
// Floor 2's dark zones (Level 2 stage 4): organic blobs cut into the tomb, where the gun light dies
// and everything is a silhouette against a coat of spun silk.
//   darkZones   place them (away from the shop, the exits, the main route and the prize), cut the tomb out
//               inside each, carve the zone's own caves (a chamber in the middle, a tunnel to every
//               corridor or room it cut through, a few side pockets) and spin the silk. Plain data
//   darkAt      which zone is a world point in (-1: none)
//   silkErase   blow a hole in the silk (a disc), for explosions; returns the box it touched
//   silkColour  a silk cell's colour seen plainly (maps, probes); silkTint its multiply tint (the game's silk layer)
//   torchStep / torchLit  the torch failing at a zone's edge (flickers out going in, back on coming out)
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
 * @returns {{ zones: DarkZone[], mask: Uint8Array, web: Uint8Array, shade: Uint8Array, depth: Uint8Array }}
 */
export function darkZones(mat, tomb, seed, shopExit) {
  // (round 5, owner: zones twice the size, every transition kept at the size it had: the rim's raggedness, the
  // fringe, the rough walls, the tunnels; the chamber keeps round 4's sizes)
  let rs = (Math.imul(seed | 0, 22695477) + 777 >>> 0) % 2147483646 + 1;
  const R = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9; i++) R();
  const mask = new Uint8Array(CW * CH), web = new Uint8Array(CW * CH);
  const own = new Uint16Array(CW * CH);              // which small tunnel dug each cell (darkZones' second pass)
  let stamps = 0;
  /** @type {DarkZone[]} */
  const zones = [];
  const want = Math.round(kr('l2dCount', R)), space = DEV.l2dSpace, shopKeep = DEV.l2dShop, topKeep = DEV.l2dTop;
  if (want <= 0) return { zones, mask, web, shade: new Uint8Array(0), depth: new Uint8Array(0) };
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
  // (round 5, zones twice as big: a zone no longer has to keep wholly clear of these; it goes round them, KEEP_M px
  // off give or take KEEP_RAG (noise ~8 px across, so that side of it is as ragged as its rim), and only its
  // middle, KEEP_MID px round, must be clear)
  const KEEP_M = 22, KEEP_RAG = 10, KEEP_MID = 70, nearKeep = new Uint8Array(CW * CH), kd = new Float32Array(CW * CH).fill(1e9);
  for (const b of keep) {
    const m = KEEP_M + KEEP_RAG;
    const bx0 = Math.max(0, Math.floor(b.x - m)), bx1 = Math.min(CW - 1, Math.ceil(b.x + b.w + m));
    const by0 = Math.max(0, Math.floor(b.y - m)), by1 = Math.min(CH - 1, Math.ceil(b.y + b.h + m));
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const dx = Math.max(b.x - x, 0, x - b.x - b.w), dy = Math.max(b.y - y, 0, y - b.y - b.h), d = Math.hypot(dx, dy), i = y * CW + x;
      if (d < kd[i]) kd[i] = d;
    }
  }
  for (let i = 0; i < CW * CH; i++) if (kd[i] < KEEP_M + KEEP_RAG && kd[i] < KEEP_M + KEEP_RAG * (2 * valueNoise((i % CW) / 8, ((i / CW) | 0) / 8, seed + 41) - 1)) nearKeep[i] = 1;
  // the candidates: rooms (each zone swallows one whole), in a shuffled order
  const cand = rooms.filter(r => !keep.some(b => b.x === r.x && b.y === r.y && b.w === r.w)).map(r => ({ r, k: R() })).sort((a, b) => a.k - b.k).map(o => o.r);
  // a free shop-to-top route, with every zone so far (and this one) solid?
  const routeOk = () => {
    const m2 = Uint8Array.from(mat);
    for (let i = 0; i < m2.length; i++) if (mask[i]) m2[i] = ROCK;
    return boxReach(m2, 17, SHOP_TOP + 36).top;
  };
  // which tomb rooms the shop reaches before any zone (1: somewhere in the room's box, 2: a runner box standing on
  // its floor too): a zone may cut a way through it, never cut a room off (each zone is checked, below)
  /** @param {Uint8Array} ok boxReach's @param {TombRoom} r */
  const roomReach = (ok, r) => {
    for (let x = r.x; x < r.x + r.w - 5; x++) for (let y = r.floor - 12; y >= r.floor - 16; y--) if (ok[y * CW + x] === 2) return 2;
    for (let y = r.y; y < r.floor; y++) for (let x = r.x; x < r.x + r.w; x++) if (ok[y * CW + x] === 2) return 1;
    return 0;
  };
  const SHOP_AT = SHOP_TOP + 36, ok0 = boxReach(mat, 17, SHOP_AT).ok, pre = rooms.map(r => roomReach(ok0, r));
  /** @param {TombRoom} r */
  const touched = r => { for (let y = r.y - 2; y <= r.floor + 2; y++) for (let x = r.x - 2; x < r.x + r.w + 2; x++) if (mask[y * CW + x]) return true; return false; };
  for (const room of cand) {
    if (zones.length >= want) break;
    const rad = Math.round(kr('l2dSize', R)), cx = Math.round(room.cx), cy = Math.round(room.y + room.h / 2);
    if (cx < KEEP_MID || cx > CW - KEEP_MID || cy - KEEP_MID < topKeep) continue;
    if (hits(cx, cy, KEEP_MID)) continue;
    if (zones.some(z => Math.hypot(z.cx - cx, z.cy - cy) < space + (z.r + rad) * 0.5)) continue;
    // the blob: a wobbling circle (two slow waves round it)
    const p1 = R() * 6.28, p2 = R() * 6.28, a1 = 0.18 + R() * 0.12, a2 = 0.08 + R() * 0.1;
    // and a ragged rim on that: random spokes round it, one every ~8 px of rim, ±12 px (the same size for any
    // zone size), sharp between, so the edge has fingers and bites (still one radius per direction, so a
    // tunnel straight to the middle never leaves the zone)
    const NS = Math.max(24, Math.round(6.2832 * rad / 8.3)), spokes = Array.from({ length: NS }, () => (R() - 0.5) * 2);
    const rag = (/** @type {number} */ a) => {
      const f = ((a / 6.2832 + 1) % 1) * NS, k = Math.floor(f), t = f - k, u = spokes[k % NS], v = spokes[(k + 1) % NS];
      return u + (v - u) * t * t * (3 - 2 * t);
    };
    const edge = (/** @type {number} */ a) => rad * (1 + a1 * Math.sin(3 * a + p1) + a2 * Math.sin(5 * a + p2)) + 12 * rag(a);
    const id = zones.length + 1, x0 = Math.max(3, cx - Math.ceil(rad * 1.4)), x1 = Math.min(CW - 4, cx + Math.ceil(rad * 1.4));
    const y0 = Math.max(3, cy - Math.ceil(rad * 1.4)), y1 = Math.min(SHOP_TOP - SHOP_ROOF - 4, cy + Math.ceil(rad * 1.4));
    const snap = mat.slice(), msnap = mask.slice();
    let n = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * CW + x;
      if (mask[i] || mat[i] === BED || nearKeep[i]) continue;
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (Math.hypot(dx, dy) < edge(Math.atan2(dy, dx))) { mask[i] = id; n++; }
    }
    // (cut off from its middle by a kept room or a route: those bits aren't the zone's)
    {
      const seen = new Uint8Array((x1 - x0 + 1) * (y1 - y0 + 1)), w = x1 - x0 + 1, st = [(cy - y0) * w + cx - x0];
      seen[st[0]] = 1;
      while (st.length) {
        const k = st.pop(), x = k % w + x0, y = ((k / w) | 0) + y0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, nk = (ny - y0) * w + nx - x0;
          if (nx < x0 || ny < y0 || nx > x1 || ny > y1 || seen[nk] || mask[ny * CW + nx] !== id) continue;
          seen[nk] = 1; st.push(nk);
        }
      }
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (mask[y * CW + x] === id && !seen[(y - y0) * w + x - x0]) { mask[y * CW + x] = 0; n--; }
    }
    // too much of it lost round the kept rooms: not here
    if (n < 0.5 * Math.PI * rad * rad) { mask.set(msnap); continue; }
    // where the tomb runs into it: its ring cells with open tomb just outside, grouped by angle
    const ring = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * CW + x;
      if (mask[i] !== id) continue;
      if ((!mask[i - 1] && !mat[i - 1]) || (!mask[i + 1] && !mat[i + 1]) || (!mask[i - CW] && !mat[i - CW]) || (!mask[i + CW] && !mat[i + CW]))
        ring.push({ x, y, a: Math.atan2(y + 0.5 - cy, x + 0.5 - cx) });
    }
    // each stretch of it (ring cells touching, 8 ways) is a doorway; a long one gets a door every 32 cells.
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
      for (let i = Math.floor(Math.min(comp.length, 32) / 2); i < comp.length; i += 32) entries.push(comp[i]);
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
    // the chamber's floor and the rock just under it stay whole (the prize stands there): the pockets and the
    // small tunnels keep off it (a tunnel from a door below may still come up through it)
    const cr = rad * 0.5, crx0 = Math.max(15, Math.round(cr * 0.38)), fl0 = cy + Math.max(12, Math.round(cr * 0.26));
    const under = (/** @type {number} */ x, /** @type {number} */ y) => x >= cx - crx0 - 2 && x <= cx + crx0 + 2 && y >= fl0 && y <= fl0 + 6;
    const digS = (/** @type {number} */ ex, /** @type {number} */ ey, /** @type {number} */ r, stamp = 0) => {
      let c = 0;
      for (let y = Math.floor(ey - r); y <= Math.ceil(ey + r); y++) for (let x = Math.floor(ex - r); x <= Math.ceil(ex + r); x++) {
        const i = y * CW + x;
        if (x > 0 && y > 0 && x < CW && y < CH && mask[i] === id && mat[i] && !under(x, y) && (x + 0.5 - ex) ** 2 + (y + 0.5 - ey) ** 2 <= r * r) { mat[i] = 0; c++; if (stamp) own[i] = stamp; }
      }
      return c;
    };
    // the chamber in the middle: a lumpy oval, a flat-ish floor
    const crx = Math.max(15, Math.round(cr * 0.38)), cry = Math.max(12, Math.round(cr * 0.26));
    for (let y = cy - cry - 3; y <= cy + cry; y++) for (let x = cx - crx - 3; x <= cx + crx + 3; x++) {
      // a lumpy dome over a flat floor (cy + cry), wide enough to stand and fight on
      const dx = (x + 0.5 - cx) / crx, dy = (y + 0.5 - cy) / cry, w = 1 + 0.12 * Math.sin(Math.atan2(dy, dx) * 4 + p1);
      const i = y * CW + x;
      if (mask[i] === id && (dx * dx + Math.min(0, dy) ** 2 <= w * w) && y < cy + cry) mat[i] = 0;
    }
    // a worm from (sx, sy) to (tx, ty): wanders, always gets there
    const worm = (/** @type {number} */ sx, /** @type {number} */ sy, /** @type {number} */ tx, /** @type {number} */ ty, /** @type {number} */ r, /** @type {number} */ steps, guard = false) => {
      let x = sx, y = sy, ang = Math.atan2(ty - y, tx - x);
      for (let s = 0; s < steps; s++) {
        if (guard) digS(x, y, r); else dig(x, y, r);
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
    for (const p of mouths) dig(p.x + 0.5, p.y + 0.5, 4.5);
    // a door below the chamber's floor comes up beside it, not through it (the floor stays whole)
    const aim = (/** @type {Pt} */ e) => (e.y > cy + cry - 4 ? { x: cx + (e.x < cx ? -1 : 1) * (crx + 3), y: cy + cry - 7 } : { x: cx, y: cy });
    for (const e of entries) { const t = aim(e); worm(e.x, e.y, t.x, t.y, 6.5 + R() * 1.5, 900); }
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
    const area = Math.max(1, (rad / 74) ** 2);                  // (a zone's area against round 4's: more of everything)
    const pockets = Math.round((2 + Math.floor(R() * 3)) * area);
    for (let k = 0; k < pockets; k++) {
      const a = R() * 6.28, d = rad * (0.45 + R() * 0.35);
      worm(cx, cy, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, 5 + R() * 2.5, 400, true);
    }
    // rough walls: every wall pushed in or out by noise (lumps ~12 px across with smaller ones on them, up to
    // DEV.l2dRough x 6 px), then crumbs bitten off and grown on (cell noise, 2 px then 1); the chamber's floor
    // stays flat for its prize (teeth and boulders after: below)
    const rough = Math.max(0, DEV.l2dRough), fx0 = cx - Math.round(crx * 0.8), fx1 = cx + Math.round(crx * 0.8), fl = cy + cry;
    const flat = (/** @type {number} */ x, /** @type {number} */ y) => x >= fx0 && x <= fx1 && y >= fl - 13 && y <= fl;
    /** @type {number[]} */
    const changed = [];                                          // (cell, what it was), to undo the roughness alone
    // the chamber's floor: a solid slab under its middle, whatever dug near it
    for (let y = fl; y <= fl + 3; y++) for (let x = fx0 - 1; x <= fx1 + 1; x++) if (mask[y * CW + x] === id) mat[y * CW + x] = ROCK;
    // (and digging after it keeps off it)
    const digF = (/** @type {number} */ ex, /** @type {number} */ ey, /** @type {number} */ r) => {
      for (let y = Math.floor(ey - r); y <= Math.ceil(ey + r); y++) for (let x = Math.floor(ex - r); x <= Math.ceil(ex + r); x++) {
        const i = y * CW + x;
        if (x > 0 && y > 0 && x < CW && y < CH && mask[i] === id && mat[i] && !(y >= fl && y <= fl + 3 && x >= fx0 - 1 && x <= fx1 + 1) && (x + 0.5 - ex) ** 2 + (y + 0.5 - ey) ** 2 <= r * r) mat[i] = 0;
      }
    };
    // every door must lead to the chamber for a runner-sized box (a ragged rim can pinch a wandering tunnel):
    // one that doesn't gets a straight one dug from it to the middle (before the rough walls: see the spine)
    const fromC = boxReach(mat, cx - 3, fl - 12);
    const linked = (/** @type {{ x: number, y: number }} */ p) => {
      for (let y = p.y - 18; y <= p.y + 8; y++) for (let x = p.x - 14; x <= p.x + 8; x++) if (x > 0 && y > 0 && x < CW && y < CH && fromC.ok[y * CW + x] === 2 && !mask[y * CW + x]) return true;   // (on the tomb side: through the door)
      return false;
    };
    for (const e of entries) {
      const p = { x: Math.round(e.x), y: Math.round(e.y) };
      if (linked(p)) continue;
      digF(p.x + 0.5, p.y + 0.5, 11);                         // a wide mouth at the door itself
      const t = aim(p), len = Math.hypot(t.x - p.x, t.y - p.y);
      for (let k = 0; k <= len; k += 1.5) digF(p.x + (t.x - p.x) * k / len, p.y + (t.y - p.y) * k / len, 9);
    }
    // the spine: one runner-box way from each door to the chamber, kept clear of everything the rough walls
    // grow (they may still bite into it), so the roughness can never shut a door off
    const keepC = new Uint8Array(CW * CH);
    {
      const okm = boxReach(mat, cx - 3, fl - 12).ok, m = 24;
      const bx0 = Math.max(1, x0 - m), by0 = Math.max(1, y0 - m), bx1 = Math.min(CW - 8, x1 + m), by1 = Math.min(CH - 13, y1 + m);
      const w = bx1 - bx0 + 1, h = by1 - by0 + 1, par = new Int32Array(w * h).fill(-2);
      const s0 = (fl - 12 - by0) * w + cx - 3 - bx0;
      if (okm[(fl - 12) * CW + cx - 3] === 2) {
        const q = [s0];
        par[s0] = -1;
        for (let h0 = 0; h0 < q.length; h0++) {
          const k = q[h0], x = k % w, y = (k / w) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy, nk = ny * w + nx;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || par[nk] !== -2 || okm[(ny + by0) * CW + nx + bx0] !== 2) continue;
            par[nk] = k; q.push(nk);
          }
        }
        for (const e of entries) {
          let bk = -1, bd = 22 * 22;
          for (let y = e.y - 22; y <= e.y + 6; y++) for (let x = e.x - 20; x <= e.x + 14; x++) {
            const lx = x - bx0, ly = y - by0;
            if (lx < 0 || ly < 0 || lx >= w || ly >= h || par[ly * w + lx] === -2) continue;
            const d = (x + 3 - e.x) ** 2 + (y + 6 - e.y) ** 2;
            if (d < bd) { bd = d; bk = ly * w + lx; }
          }
          for (let k = bk; k >= 0; k = par[k]) {
            const x = k % w + bx0, y = ((k / w) | 0) + by0;
            for (let yy = y - 1; yy <= y + 11; yy++) for (let xx = x - 1; xx <= x + 6; xx++) keepC[yy * CW + xx] = 1;
          }
        }
      }
    }
    const A = rough * 6, A1 = Math.ceil(A) + 1;
    if (A > 0.5) {
      const src2 = mat.slice();
      for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) {
        const i = y * CW + x;
        if (mask[i] !== id || flat(x, y) || under(x, y) || src2[i] === BED) continue;
        // how far to the other side (open: to rock; rock: to air), up to A1
        const o = !src2[i];
        let d = A1 + 1;
        for (let dy = -A1; dy <= A1; dy++) for (let dx = -A1; dx <= A1; dx++) {
          const j = i + dy * CW + dx;
          if ((!src2[j]) !== o) { const e = Math.hypot(dx, dy); if (e < d) d = e; }
        }
        if (d > A1) continue;
        const n = 0.65 * valueNoise(x / 12, y / 12, seed + id * 5) + 0.35 * valueNoise(x / 4, y / 4, seed + id * 11);
        const p = (o ? d - 0.5 : 0.5 - d) + A * (2 * n - 1);
        if (o && p < 0 && !keepC[i]) { changed.push(i, mat[i]); mat[i] = ROCK; }
        else if (!o && p > 0) { changed.push(i, mat[i]); mat[i] = 0; }
      }
    }
    // teeth: tapering spikes of rock off the walls into the air (down from a roof, up from a floor, out of
    // a side), and loose boulders in the open
    if (rough > 0) {
      /** @type {number[]} */
      const wall = [];
      for (let y = y0 + 2; y < y1 - 1; y++) for (let x = x0 + 2; x < x1 - 1; x++) {
        const i = y * CW + x;
        if (mask[i] === id && !mat[i] && (mat[i - 1] || mat[i + 1] || mat[i - CW] || mat[i + CW])) wall.push(i);
      }
      const teeth = Math.round(wall.length / 14 * rough);
      for (let k = 0; k < teeth && wall.length; k++) {
        const i = wall[Math.floor(R() * wall.length)], x = i % CW, y = (i / CW) | 0;
        // the way out of the wall: towards the open cells round it
        let nx = 0, ny = 0;
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (!mat[i + dy * CW + dx]) { nx += dx; ny += dy; }
        const nl = Math.hypot(nx, ny);
        if (nl < 3) continue;
        nx /= nl; ny /= nl;
        const L = 3 + R() * 9 * rough, w0 = 1.2 + R() * 1.8, bend = (R() - 0.5) * 0.5;
        for (let t = 0; t <= L; t += 0.7) {
          const a = Math.atan2(ny, nx) + bend * t / L, px = x + 0.5 + Math.cos(a) * t, py = y + 0.5 + Math.sin(a) * t, r = w0 * (1 - t / (L + 1));
          for (let yy = Math.floor(py - r); yy <= Math.ceil(py + r); yy++) for (let xx = Math.floor(px - r); xx <= Math.ceil(px + r); xx++) {
            const j = yy * CW + xx;
            if (mask[j] !== id || mat[j] || keepC[j] || flat(xx, yy) || (xx + 0.5 - px) ** 2 + (yy + 0.5 - py) ** 2 > r * r + 0.3) continue;
            changed.push(j, mat[j]); mat[j] = ROCK;
          }
        }
      }
      const boulders = Math.round(wall.length / 90 * rough);
      for (let k = 0, tries = 0; k < boulders && tries < boulders * 20; tries++) {
        const x = Math.floor(x0 + R() * (x1 - x0)), y = Math.floor(y0 + R() * (y1 - y0)), i = y * CW + x, r = 1.2 + R() * 2.3;
        if (mask[i] !== id || mat[i] || flat(x, y) || flat(x, y + 13)) continue;
        let clear = true;
        for (let dy = -7; dy <= 7 && clear; dy++) for (let dx = -7; dx <= 7; dx++) if (mat[i + dy * CW + dx]) { clear = false; break; }
        if (!clear) continue;
        k++;
        for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) {
          const j = yy * CW + xx;
          if (mask[j] === id && !mat[j] && !keepC[j] && !flat(xx, yy) && (xx - x) ** 2 + (yy - y) ** 2 <= r * r * (0.7 + 0.6 * cellNoise(xx, yy, seed))) { changed.push(j, mat[j]); mat[j] = ROCK; }
        }
      }
    }
    for (let pass = 0; pass < 2 && rough > 0; pass++) {
      const src2 = mat.slice(), sh = 1 - pass;
      for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) {
        const i = y * CW + x;
        if (mask[i] !== id || flat(x, y) || under(x, y)) continue;
        let nb = 0;
        for (const j of [i - 1, i + 1, i - CW, i + CW, i - CW - 1, i - CW + 1, i + CW - 1, i + CW + 1]) if (src2[j]) nb++;
        const v = cellNoise(x >> sh, y >> sh, seed + id * 7 + pass);
        if (!src2[i] && nb >= 3 && v < 0.18 * rough && !keepC[i]) { changed.push(i, mat[i]); mat[i] = ROCK; }
        else if (src2[i] && src2[i] !== BED && nb <= 5 && v > 1 - 0.25 * rough) { changed.push(i, mat[i]); mat[i] = 0; }
      }
    }
    // the second pass: small tunnels winding out of the open cave through the rock left, until the zone's
    // open share reaches DEV's l2dOpen. Most are for the aliens alone (3 to 6 px across; the runner is 6 x 11),
    // one in four wide enough to squeeze through (9 to 13): which ones the runner fits is worked out at the end
    let open = 0, tot = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * CW + x; if (mask[i] === id) { tot++; if (!mat[i]) open++; } }
    const goal = kr('l2dOpen', R) * tot;
    /** @type {DarkTunnel[]} */
    const tunnels = [];
    const rockAt = (/** @type {number} */ x, /** @type {number} */ y) => { const i = Math.floor(y) * CW + Math.floor(x); return mask[i] === id && mat[i] !== 0 && !under(Math.floor(x), Math.floor(y)); };
    for (let t = 0, tries = 1500 * area; t < tries && open < goal; t++) {
      const x = Math.floor(x0 + R() * (x1 - x0)), y = Math.floor(y0 + R() * (y1 - y0)), i = y * CW + x;
      if (mask[i] !== id || mat[i]) continue;
      // start on a wall (open here, rock within 3 px), heading into the rock: the way with most rock ahead
      let ang = 0, best = -1;
      for (let k = 0; k < 16; k++) {
        const a = k * 0.3927 + R() * 0.3;
        let n = 0;
        for (let d = 2; d <= 14; d += 2) if (rockAt(x + 0.5 + Math.cos(a) * d, y + 0.5 + Math.sin(a) * d)) n++;
        if (!rockAt(x + 0.5 + Math.cos(a) * 3, y + 0.5 + Math.sin(a) * 3)) n = 0;
        if (n > best) { best = n; ang = a; }
      }
      if (best < 5) continue;
      let px = x + 0.5, py = y + 0.5, dug = 0, inRock = 0;
      const stamp = ++stamps;
      const wide = R() < 0.25, r = wide ? 4.5 + R() * 2 : 1.5 + R() * 1.5, len = 20 + Math.floor(R() * 60);
      /** @type {Pt[]} */
      const pts = [];
      for (let st = 0; st < len; st++) {
        const was = rockAt(px, py) || own[Math.floor(py) * CW + Math.floor(px)] === stamp;   // (rock until this tunnel dug it)
        dug += digS(px, py, r, stamp);
        if (was && inRock % 3 === 0) pts.push({ x: Math.floor(px), y: Math.floor(py) });     // (its way through rock only)
        if (was) inRock++;
        else if (inRock > 8) break;                                  // broke into open cave again: a way through
        ang += (R() - 0.5) * 0.8;
        // keep to the rock: look ahead and bend towards the side with more of it; never out of the zone
        const l = rockAt(px + Math.cos(ang - 0.6) * 5, py + Math.sin(ang - 0.6) * 5), rr = rockAt(px + Math.cos(ang + 0.6) * 5, py + Math.sin(ang + 0.6) * 5);
        if (l && !rr) ang -= 0.25; else if (rr && !l) ang += 0.25;
        const nx = px + Math.cos(ang) * 1.5, ny = py + Math.sin(ang) * 1.5;
        if (mask[Math.floor(ny) * CW + Math.floor(nx)] !== id || under(Math.floor(nx), Math.floor(ny))) { ang += 2.2; continue; }
        px = nx; py = ny;
      }
      open += dug;
      if (dug > r * 6 && pts.length >= 2) tunnels.push({ pts, w: Math.round(r * 2), fits: false });
    }
    // the main route must still run from the shop to the top with every zone shut: if not, no zone here
    if (!routeOk()) { mat.set(snap); mask.set(msnap); continue; }
    // and with this zone open: its chamber is in reach of the shop, and every tomb room it didn't swallow is
    // reached as before (the rough walls can pinch a way shut: then they go, the caves stay smooth; still
    // not: no zone here)
    const reachOk = () => {
      const ok = boxReach(mat, 17, SHOP_AT).ok;
      // (this chamber and every earlier zone's: a big zone may swallow the way into one next to it)
      const reached = (/** @type {number} */ ccx, /** @type {number} */ crx1, /** @type {number} */ cfl) => {
        for (let x = ccx - crx1 + 3; x < ccx + crx1 - 6; x++) for (let y = cfl - 12; y >= cfl - 16; y--) if (ok[y * CW + x] === 2) return true;
        return false;
      };
      return reached(cx, crx, fl) && zones.every(z => reached(z.chamber.x, z.chamber.rx, z.chamber.floor)) && rooms.every((r, k) => {
        if (!pre[k] || mask[Math.round(r.y + r.h / 2) * CW + Math.round(r.cx)]) return true;
        const now = roomReach(ok, r);
        return now >= (touched(r) ? 1 : pre[k]);
      });
    };
    if (!reachOk()) {
      for (let k = changed.length - 2; k >= 0; k -= 2) mat[changed[k]] = changed[k + 1];
      if (!reachOk()) { mat.set(snap); mask.set(msnap); continue; }
    }
    zones.push({ id: id - 1, cx, cy, r: rad, x0, y0, x1, y1, room: room.id, cells: n, doors: entries.map(e => ({ x: Math.round(e.x), y: Math.round(e.y) })),
      chamber: { x: cx, y: cy, rx: crx, ry: cry, floor: cy + cry }, tunnels, open: 0 });
  }
  // the small tunnels the runner fits through: most of the way along one a 6 x 11 box stands somewhere over
  // each point (the box's room, from boxReach, spread over the cells it covers); and each zone's open share
  if (zones.length) {
    const ok = boxReach(mat, 17, SHOP_AT).ok;
    for (const z of zones) {
      const id = z.id + 1, w = z.x1 - z.x0 + 1, h = z.y1 - z.y0 + 1, P = new Int32Array((w + 1) * (h + 1));
      let o = 0, t = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (z.y0 + y) * CW + z.x0 + x;
        if (mask[i] === id) { t++; if (!mat[i]) o++; }
        P[(y + 1) * (w + 1) + x + 1] = (ok[i] ? 1 : 0) + P[y * (w + 1) + x + 1] + P[(y + 1) * (w + 1) + x] - P[y * (w + 1) + x];
      }
      z.open = t ? o / t : 0;
      const box = (/** @type {number} */ ax, /** @type {number} */ ay) => {     // any box top-left in [ax-5..ax] x [ay-10..ay]?
        const a0 = Math.max(0, ax - 5 - z.x0), a1 = Math.min(w - 1, ax - z.x0), b0 = Math.max(0, ay - 10 - z.y0), b1 = Math.min(h - 1, ay - z.y0);
        if (a1 < a0 || b1 < b0) return false;
        return P[(b1 + 1) * (w + 1) + a1 + 1] - P[b0 * (w + 1) + a1 + 1] - P[(b1 + 1) * (w + 1) + a0] + P[b0 * (w + 1) + a0] > 0;
      };
      for (const tn of z.tunnels) {
        const inn = tn.pts.filter(p => !mat[p.y * CW + p.x]);
        tn.fits = tn.w >= 6 && inn.length > 2 && inn.filter(p => box(p.x, p.y)).length >= inn.length * 0.9;   // (one dug narrower never does: a box standing in the cave beside it isn't in it)
      }
    }
  }
  // (round 5: a big zone can run up to the floor's side wall: the bedrock there is the zone's too, so its depth
  // counts from the tomb side alone and the wall isn't a coloured edge seen from deep inside; all digging is done)
  for (let y = 3; y < CH - 3; y++) {
    const l = mask[y * CW + 3], r = mask[y * CW + CW - 4];
    if (l) mask.fill(l, y * CW, y * CW + 3);
    if (r) mask.fill(r, y * CW + CW - 3, y * CW + CW);
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
  return { zones, mask, web, shade, depth: zoneDepth(mask) };
}

// how deep into a zone each cell is: px (4-way steps) from the nearest cell outside every zone, 0 outside, up
// to 255 (round 3: the black fades in over DEV.l2dTintDepth of it; the torch fails at DEV.l2dTorchDepth)
/** @param {Uint8Array} mask */
export function zoneDepth(mask) {
  const n = CW * CH, d = new Uint8Array(n), q = new Int32Array(n);
  let qn = 0;
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    const x = i % CW;
    if ((x > 0 && !mask[i - 1]) || (x < CW - 1 && !mask[i + 1]) || (i >= CW && !mask[i - CW]) || (i < n - CW && !mask[i + CW])) { d[i] = 1; q[qn++] = i; }
  }
  for (let h = 0; h < qn; h++) {
    const i = q[h], x = i % CW, v = Math.min(255, d[i] + 1);
    for (const j of [x > 0 ? i - 1 : -1, x < CW - 1 ? i + 1 : -1, i - CW, i + CW]) if (j >= 0 && j < n && mask[j] && !d[j]) { d[j] = v; q[qn++] = j; }
  }
  return d;
}
// how black a zone is at a depth (px): a smooth ramp in from its edge over DEV.l2dTintDepth, 0..1
/** @param {number} depth */
export function tintRamp(depth) {
  const u = clamp01(depth / Math.max(1, DEV.l2dTintDepth));
  return u * u * (3 - 2 * u);
}
/** @param {number} v */
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
// the depth into a zone at world point (wx, wy) (0 outside, or no zones)
/** @param {{ darkDepth: Uint8Array | null }} level @param {number} wx @param {number} wy @param {number} cell */
export function darkDepthAt(level, wx, wy, cell) {
  const m = level.darkDepth, x = Math.floor(wx / cell), y = Math.floor(wy / cell);
  return m && x >= 0 && y >= 0 && x < CW && y < CH ? m[y * CW + x] : 0;
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

// the silk as a multiply tint over the back wall and the hologram (render/dark.js): near white where it is thin
// (it hardly darkens), a cold grey-violet where it is thick; alpha with it (thin silk barely there)
/** @param {number} v 1..255 @returns {number[]} r, g, b, a */
export function silkTint(v) {
  const t = v / 255;
  return [Math.round(175 - 115 * t), Math.round(170 - 115 * t), Math.round(192 - 105 * t), Math.round(150 + 105 * t)];
}

// the torch failing in a dark zone (owner, round 3): once you are DEV.l2dTorchDepth px in (the tail of the black
// fading in), the gun light and the glow round you flicker for TORCH_FLICKER s, then stay off; coming back out past
// DEV.l2dTorchDepth - DEV.l2dTorchHyst px they flicker back on (the gap: standing on the line doesn't strobe).
// s: { inside, t } (t: seconds since the last crossing; 99 at a floor's start). torchStep moves it on (depth: px
// into the zone where you are); torchLit is how lit, 0 or 1, never random (a hash of the flicker's own clock, so
// the simulation's Math.random stream is untouched)
export const TORCH_FLICKER = 0.8;
/** @param {{ inside: boolean, t: number }} s @param {number} depth @param {number} dt */
export function torchStep(s, depth, dt) {
  const T = DEV.l2dTorchDepth, inside = s.inside ? depth > T - Math.max(0, DEV.l2dTorchHyst) : depth >= T;
  if (inside !== s.inside) { s.inside = inside; s.t = 0; } else s.t += dt;
  return torchLit(s);
}
/** @param {{ inside: boolean, t: number }} s */
export function torchLit(s) {
  if (s.t >= TORCH_FLICKER) return s.inside ? 0 : 1;
  const u = s.t / TORCH_FLICKER, k = Math.floor(s.t * 22), h = Math.sin(k * 12.9898 + 78.233) * 43758.5453, r = h - Math.floor(h);
  const on = s.inside ? 1 - u * u : u * u;                 // going in: mostly on at first, dying; coming out: the other way
  return r < on ? 1 : 0;
}

// the zone's rock: raw, darker than the tomb's, a little purple (the cut stone is gone)
/** @param {number} n 0..1 noise */
export function zoneRock(n) { return mix([34, 30, 40], [58, 52, 66], n); }
