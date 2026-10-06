// @ts-check
// Floor 2's tomb (Level 2 stage 2): the rooms are planned first, then the rock is carved round them.
//   tombPlan     the room list (a type and a shape each, every one symmetric about its middle) and the
//                corridors joining them: straight level galleries and upright shafts with ledges.
//                Plain data, all in terrain pixels (world units = × CELL)
//   roomOpen     is a pixel inside a room's shape?
//   carveTomb    cut the plan into mat (rooms, pillars, corridors, shaft ledges)
//   tombRoomAt   which room is this? (world units)
//   paintMasonry the cut-stone bake: block courses on the rock that lines every room and corridor
// Same seed + the same Dev knobs = the same tomb (its own random stream).

import { CW, CH, ROCK, SHOP_ROOF, SHOP_TOP } from '../core/consts.js';
import { mix } from '../core/util.js';
import { kr } from '../dev/knobs.js';

export const TOMB_TOP = 34;                              // the top gallery's floor: the exits' pads stand on it
export const TOMB_BOTTOM = SHOP_TOP - SHOP_ROOF - 26;    // the top of the shop's shaft: the vestibule's floor
const LOW = SHOP_TOP - SHOP_ROOF - 12;                   // no room floor below this (rock over the shop's roof)
const GATE_W = 72, GATE_H = 28, PAD_KEEP = 14;           // the exit halls, and no shaft under a pad
/** room types: the big ones and the small ones, with how often each comes up */
export const TOMB_TYPES = {
  big: { hall: 3, library: 2, altar: 1, orrery: 1, pillars: 1.5 },
  small: { shrine: 2, ossuary: 2, dorm: 2, store: 2, altar: 0.8 },
};
/** the shapes each type may take @type {Record<string, string[]>} */
export const TOMB_SHAPES = {
  hall: ['rect', 'octagon', 'dome', 'arch', 'ziggurat'], library: ['rect', 'dome'], altar: ['arch', 'ziggurat'],
  orrery: ['round'], pillars: ['rect'], shrine: ['arch', 'dome', 'octagon'], ossuary: ['rect', 'arch', 'ziggurat'],
  dorm: ['rect', 'dome'], store: ['rect', 'octagon'], gate: ['dome'], vestibule: ['arch'],
};

/** @param {Record<string, number>} w @param {Rnd} rnd */
function pickW(w, rnd) {
  let t = 0;
  for (const k in w) t += w[k];
  let u = rnd() * t;
  for (const k in w) { u -= w[k]; if (u < 0) return k; }
  return Object.keys(w)[0];
}

// Is terrain pixel (x, y) inside room r's shape? Measured from the pixel's middle, so a room is exactly
// symmetric about its middle (x + w/2): a flat floor at r.floor, every shape widest at the floor
/** @param {TombRoom} r @param {number} x @param {number} y */
export function roomOpen(r, x, y) {
  if (x < r.x || x >= r.x + r.w || y < r.y || y >= r.floor) return false;
  const dx = Math.abs(x + 0.5 - r.cx), up = r.floor - (y + 0.5), hw = r.w / 2, h = r.h;
  if (r.shape === 'ziggurat') {
    const n = h >= 48 ? 4 : 3, k = Math.min(n - 1, Math.floor(up / (h / n)));
    return dx <= hw * (1 - 0.5 * k / (n - 1));
  }
  if (r.shape === 'octagon') return (hw - dx) + Math.min(up, h - up) >= Math.min(hw, h / 2) * 0.55;
  if (r.shape === 'dome') {
    const dh = Math.min(hw, h * 0.6), s = h - dh;
    return up <= s || (dx / hw) ** 2 + ((up - s) / dh) ** 2 <= 1;
  }
  if (r.shape === 'arch') {                              // a pointed arch: two circles meeting at the top
    const R = hw * 1.6, full = Math.sqrt(R * R - (R - hw) ** 2), ah = Math.min(full, h * 0.65), s = h - ah, k = ah / full;
    return up <= s || (dx + R - hw) ** 2 + ((up - s) / k) ** 2 <= R * R;
  }
  if (r.shape === 'round') {                             // a circle, its bottom cut flat for a floor
    const rad = Math.min(hw, h / 2);
    return dx * dx + (up - h * 0.42) ** 2 <= rad * rad;
  }
  return true;
}

// The pillars of a pillar maze, as rects: mirrored pairs out from the middle, every other one hanging
// from the roof, the rest standing on the floor, a gap of `gap` at the other end (you weave through)
/** @param {TombRoom} r @returns {{ x: number, y: number, w: number, h: number }[]} */
export function roomPillars(r) {
  if (r.type !== 'pillars') return [];
  const out = [], s = 18, pw = 4, gap = 15;
  for (let k = 1; r.cx + k * s + pw / 2 < r.x + r.w - 10; k++) {
    const y = k % 2 ? r.y : r.y + gap, h = r.h - gap;
    for (const sx of [-1, 1]) out.push({ x: Math.round(r.cx + sx * k * s - pw / 2), y, w: pw, h });
  }
  return out;
}

/**
 * The tomb's plan: rooms first, then the corridors that join them.
 * @param {number} seed @param {number} shopExit the shop's way up (terrain x) @param {number[]} exitX the exits along the top
 * @returns {Tomb}
 */
export function tombPlan(seed, shopExit, exitX) {
  let rs = (Math.imul(seed | 0, 69069) + 12345 >>> 0) % 2147483646 + 1;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 8; i++) rnd();
  // the layout's numbers, rolled once (Dev → Level 2: layout & look)
  const want = Math.round(kr('l2Rooms', rnd)), bigShare = kr('l2Big', rnd), gap = Math.round(kr('l2Gap', rnd));
  const C = Math.max(2, Math.round(kr('l2Course', rnd))), loops = kr('l2Loops', rnd);
  const ledgeGap = Math.max(8, Math.round(kr('l2Ledge', rnd)));
  const block = Math.round(kr('l2Block', rnd)), mason = Math.round(kr('l2Mason', rnd));
  const even = (/** @type {number} */ v) => Math.max(2, Math.round(v / 2) * 2);
  const snap = (/** @type {number} */ v) => TOMB_TOP + Math.round((v - TOMB_TOP) / C) * C;   // courses line up with floors
  /** @type {TombRoom[]} */
  const rooms = [];
  /** @param {number} x @param {number} y @param {number} w @param {number} h @param {string} type @param {string} shape @param {boolean} big */
  const add = (x, y, w, h, type, shape, big) => {
    const r = { id: rooms.length, x, y, w, h, cx: x + w / 2, floor: y + h, shape, type, big, links: [] };
    rooms.push(r);
    return r;
  };
  // the fixed ones: an exit hall over each pad, and the vestibule over the shop's way up
  for (const ex of exitX) add(ex - GATE_W / 2, TOMB_TOP - GATE_H, GATE_W, GATE_H, 'gate', 'dome', true);
  add(shopExit - 40, TOMB_BOTTOM - 36, 80, 36, 'vestibule', 'arch', true);
  const gates = rooms.slice(0, exitX.length);
  // the rest: thrown in at random, never closer than `gap` to another (rejection sampling)
  for (let a = 0; a < want * 40 && rooms.length < want + exitX.length + 1; a++) {
    const big = rnd() < bigShare;
    const type = pickW(big ? TOMB_TYPES.big : TOMB_TYPES.small, rnd);
    const shapes = TOMB_SHAPES[type], shape = shapes[Math.floor(rnd() * shapes.length)];
    let w = even(kr(big ? 'l2BigW' : 'l2SmallW', rnd)), h = Math.max(C * 3, Math.round(kr(big ? 'l2BigH' : 'l2SmallH', rnd) / C) * C);
    if (type === 'orrery') { h = Math.max(C * 3, Math.round(Math.min(w, h * 1.3) / C) * C); w = even(h); }
    if (type === 'pillars' && (h < 42 || w < 70)) continue;
    w = Math.min(w, CW - 16);
    const x = 6 + 2 * Math.floor(rnd() * (CW - 12 - w) / 2);
    const lo = TOMB_TOP + gap + h, floor = snap(lo + rnd() * (LOW - lo));
    if (floor > LOW || floor - h < TOMB_TOP + gap) continue;
    const y = floor - h;
    if (rooms.some(o => x < o.x + o.w + gap && o.x < x + w + gap && y < o.floor + gap && o.y < floor + gap)) continue;
    add(x, y, w, h, type, shape, big);
  }

  // ---- the corridors ----
  // a route between two rooms: straight up (a shaft), straight across (a gallery), or an L (a gallery
  // out of one room's side at its floor, then a shaft into the other). null: no clean way
  /** @param {TombRoom} r @param {number} sx @param {number} sw a shaft at sx: clear of the pads? */
  const padOk = (r, sx, sw) => r.type !== 'gate' || Math.abs(sx - r.cx) >= PAD_KEEP + sw / 2;
  /** @param {TombRoom} r @param {number} from the other room's middle */
  // where a shaft meets room r: through its roof, the middle; through its floor, against the wall on the
  // other room's side, so the floor stays whole for the room's kit (Stage 3)
  /** @param {TombRoom} r @param {number} from @param {boolean} [floor] @param {number} [sw] */
  const shaftX = (r, from, floor, sw) => {
    const side = from < r.cx ? -1 : 1;
    if (r.type === 'gate') return r.cx + side * 24;
    if (!floor) return r.cx;
    return r.cx + side * (r.w / 2 - (sw || 16) / 2 - 1);
  };
  /** @param {TombRoom} r @param {number} sx @param {number} sw a shaft through r's floor at sx: against a wall? */
  const floorOk = (r, sx, sw) => r.type === 'gate' || Math.abs(sx - r.cx) >= r.w / 2 - sw / 2 - 3;
  /** @param {TombRoom} A @param {TombRoom} B @param {number} H @param {number} sw */
  const route = (A, B, H, sw) => {
    /** @type {TombCorridor[]} */
    const segs = [];
    const [U, D] = A.floor <= B.y ? [A, B] : B.floor <= A.y ? [B, A] : [null, null];
    const o0 = Math.max(A.x, B.x) + 4, o1 = Math.min(A.x + A.w, B.x + B.w) - 4;
    if (U && o1 - o0 >= sw) {                           // one over the other: a shaft
      const c = [shaftX(U, D.cx, true, sw), shaftX(D, U.cx), (o0 + o1) / 2, o0 + sw / 2, o1 - sw / 2].find(sx => sx - sw / 2 >= o0 && sx + sw / 2 <= o1 && padOk(U, sx, sw) && padOk(D, sx, sw) && floorOk(U, sx, sw));
      if (c === undefined) return null;
      const x = Math.round(c - sw / 2);
      segs.push({ kind: 'shaft', x, y: U.floor, w: sw, h: D.y - U.floor, a: U.id, b: D.id, ledges: [] });
      return segs;
    }
    if (A.x + A.w <= B.x || B.x + B.w <= A.x) {         // side by side: a gallery, if the floors are near enough
      const [L, R] = A.x < B.x ? [A, B] : [B, A];
      const g = Math.min(A.floor, B.floor), low = A.floor > B.floor ? A : B;
      const Hh = Math.min(H, Math.floor(Math.min(A.h, B.h) * 0.6));
      if (Hh >= 13 && g - Hh >= low.floor - low.h * 0.6) {
        segs.push({ kind: 'gallery', x: L.x + L.w, y: g - Hh, w: R.x - L.x - L.w, h: Hh, a: L.id, b: R.id, ledges: [] });
        return segs;
      }
    }
    // the L: out of P's side along its floor, then up or down into Q
    let best = null, bestN = Infinity;
    for (const [P, Q] of [[A, B], [B, A]]) {
      const Hh = Math.min(H, Math.floor(P.h * 0.6));
      if (Hh < 13) continue;
      const top = P.floor - Hh;
      const above = Q.floor <= top, below = Q.y >= P.floor;
      if (!above && !below) continue;
      const sx = shaftX(Q, P.cx, above, sw);
      if (sx + sw / 2 + 2 > P.x && sx - sw / 2 - 2 < P.x + P.w) continue;   // it must leave P sideways
      const right = sx > P.cx, x0 = right ? P.x + P.w : Math.round(sx - sw / 2), x1 = right ? Math.round(sx + sw / 2) : P.x;
      const gal = { kind: 'gallery', x: x0, y: top, w: x1 - x0, h: Hh, a: P.id, b: Q.id, ledges: [] };
      const sh = above ? { kind: 'shaft', x: Math.round(sx - sw / 2), y: Q.floor, w: sw, h: P.floor - Q.floor, a: Q.id, b: P.id, ledges: [] }
        : { kind: 'shaft', x: Math.round(sx - sw / 2), y: top, w: sw, h: Q.y - top, a: P.id, b: Q.id, ledges: [] };
      const n = gal.w + sh.h;
      if (n < bestN) { bestN = n; best = [gal, sh]; }
    }
    return best;
  };
  // how many other rooms a route runs into (it shouldn't; the tree takes one anyway when it must)
  /** @param {TombCorridor[]} segs @param {TombRoom} A @param {TombRoom} B */
  const crossings = (segs, A, B) => {
    let n = 0;
    for (const o of rooms) {
      if (o === A || o === B) continue;
      if (segs.some(s => s.x < o.x + o.w + 3 && o.x - 3 < s.x + s.w && s.y < o.floor + 3 && o.y - 3 < s.y + s.h)) n++;
    }
    return n;
  };
  /** @param {TombCorridor[]} segs */
  const length = segs => segs.reduce((t, s) => t + (s.kind === 'shaft' ? s.h : s.w), 0);
  // every pair, cheapest first: a spanning tree (Kruskal), the exit halls already one piece (the top gallery)
  const N = rooms.length, up = rooms.map((_, i) => i);
  const find = (/** @type {number} */ i) => { while (up[i] !== i) i = up[i] = up[up[i]]; return i; };
  for (const g of gates) up[find(g.id)] = find(gates[0].id);
  const pairs = [];
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const A = rooms[i], B = rooms[j];
    if (A.type === 'gate' && B.type === 'gate') continue;
    const gx = Math.max(0, Math.max(A.x, B.x) - Math.min(A.x + A.w, B.x + B.w)), gy = Math.max(0, Math.max(A.y, B.y) - Math.min(A.floor, B.floor));
    if (gx + gy > 320) continue;
    const H = Math.round(kr('l2Hall', rnd)), sw = even(kr('l2Shaft', rnd));
    const segs = route(A, B, H, sw);
    if (!segs) continue;
    const n = crossings(segs, A, B);
    pairs.push({ A, B, segs, n, cost: length(segs) + 400 * n });
  }
  pairs.sort((p, q) => p.cost - q.cost);
  /** @type {TombCorridor[]} */
  const corridors = [];
  // the top gallery joining the exit halls
  const tH = 18;
  corridors.push({ kind: 'gallery', x: exitX[0], y: TOMB_TOP - tH, w: exitX[exitX.length - 1] - exitX[0], h: tH, a: gates[0].id, b: gates[gates.length - 1].id, ledges: [] });
  const link = (/** @type {typeof pairs[0]} */ p) => {
    for (const s of p.segs) corridors.push(s);
    p.A.links.push(p.B.id); p.B.links.push(p.A.id);
  };
  const rest = [];
  for (const p of pairs) {
    const a = find(p.A.id), b = find(p.B.id);
    if (a !== b) { up[a] = b; link(p); } else rest.push(p);
  }
  // a few loops, so it isn't all dead ends: short clean ones only
  for (const p of rest) if (!p.n && length(p.segs) < 140 && rnd() < loops && !p.A.links.includes(p.B.id)) link(p);
  // a room the tree never reached (no clean way in at all) is left as rock
  const home = find(rooms[exitX.length].id);
  const keep = rooms.filter(r => find(r.id) === home);
  const renum = new Map(keep.map((r, i) => [r.id, i]));
  for (const r of keep) { r.id = renum.get(r.id); r.links = r.links.filter(i => renum.has(i)).map(i => renum.get(i)); }
  for (const c of corridors) { c.a = renum.has(c.a) ? renum.get(c.a) : -1; c.b = renum.has(c.b) ? renum.get(c.b) : -1; }
  const kept = corridors.filter(c => c.a >= 0 && c.b >= 0);
  // the prize: an altar room off the beaten track (fewest ways in), or a small room made one
  const cand = keep.filter(r => r.type === 'altar');
  const pool = cand.length ? cand : keep.filter(r => !r.big);
  let prize = -1;
  if (pool.length) {
    const fewest = Math.min(...pool.map(r => r.links.length)), alt = pool.filter(r => r.links.length === fewest);
    const r = alt[Math.floor(rnd() * alt.length)];
    if (r.type !== 'altar') { r.type = 'altar'; r.shape = TOMB_SHAPES.altar[Math.floor(rnd() * 2)]; }
    prize = r.id;
  }
  return { rooms: keep, corridors: kept, prize, course: C, block, mason, ledgeGap, mended: false };
}

/**
 * Cut the plan into mat: the rooms' shapes, the pillars, the corridors (each pushed on into its rooms
 * until it meets their open air, so a doorway is as short as it can be), then ledges up the shafts.
 * The corridors' rects grow to what was really cut.
 * @param {Uint8Array} mat @param {Tomb} t
 */
export function carveTomb(mat, t) {
  for (const r of t.rooms) {
    for (let y = r.y; y < r.floor; y++) for (let x = r.x; x < r.x + r.w; x++) if (roomOpen(r, x, y)) mat[y * CW + x] = 0;
    for (const p of roomPillars(r)) for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) mat[y * CW + x] = ROCK;
  }
  const open = (/** @type {number} */ x, /** @type {number} */ y) => !mat[y * CW + x];
  /** @param {TombCorridor} c */
  const cut = c => { for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) mat[y * CW + x] = 0; };
  for (const c of t.corridors) {
    cut(c);
    const A = t.rooms[c.a], B = t.rooms[c.b];
    if (c.kind === 'gallery') {
      const colOpen = (/** @type {number} */ x) => { for (let y = c.y; y < c.y + c.h; y++) if (!open(x, y)) return false; return true; };
      // (an end that meets a room's side goes on into it: the room whose right wall the left end is on, and so on)
      const L = [A, B].find(q => q.x + q.w === c.x), R = [A, B].find(q => q.x === c.x + c.w);
      if (L) while (c.x > L.x && !colOpen(c.x - 1)) { c.x--; c.w++; }
      if (R) while (c.x + c.w < R.x + R.w && !colOpen(c.x + c.w)) c.w++;
    } else {
      const rowOpen = (/** @type {number} */ y) => { for (let x = c.x; x < c.x + c.w; x++) if (!open(x, y)) return false; return true; };
      const U = [A, B].find(q => q.floor === c.y), D = [A, B].find(q => q.y === c.y + c.h);
      if (U) while (c.y > U.y && !rowOpen(c.y - 1)) { c.y--; c.h++; }
      if (D) while (c.y + c.h < D.floor && !rowOpen(c.y + c.h)) c.h++;
    }
    cut(c);
  }
  // ledges up the shafts: every ledgeGap, side to side, only where the wall behind is whole rock
  for (const c of t.corridors) {
    if (c.kind !== 'shaft' || c.h < t.ledgeGap * 1.5) continue;
    const len = Math.max(3, Math.min(c.w - 8, Math.round(c.w * 0.35)));
    let side = 0;
    for (let y = c.y + c.h - t.ledgeGap; y > c.y + 12; y -= t.ledgeGap, side ^= 1) {
      const wx = side ? c.x + c.w : c.x - 1;
      let whole = true;
      for (let k = -16; k <= 16 && whole; k++) {
        if (mat[(y + k) * CW + wx] !== ROCK) whole = false;
        for (let x = c.x; x < c.x + c.w && whole; x++) if (!open(x, y + k)) whole = false;
      }
      if (!whole) continue;
      const x0 = side ? c.x + c.w - len : c.x;
      for (let yy = y; yy < y + 3; yy++) for (let x = x0; x < x0 + len; x++) mat[yy * CW + x] = ROCK;
      c.ledges.push({ x: x0, y, w: len, h: 3 });
    }
  }
}

// which room is world point (wx, wy) in? (the room's box; null outside every room)
/** @param {Tomb | null} t @param {number} wx @param {number} wy @param {number} cell world units per terrain pixel */
export function tombRoomAt(t, wx, wy, cell) {
  if (!t) return null;
  const x = wx / cell, y = wy / cell;
  return t.rooms.find(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.floor) || null;
}

/**
 * The cut-stone bake: every block (courses `course` high, `block` long, every other course shifted half
 * a block) that comes within `depth` of open air is dressed stone: brick colours from the floor's
 * palette, mortar lines between, a lit edge where it is a floor and a shadow where it is a roof. Past
 * that the raw rock shows, so the masonry ends block by block. Only ROCK above the shop is painted.
 * @param {Uint8Array} mat @param {Uint8ClampedArray} d the terrain's pixels @param {{ brick: number[][], mortar: number[] }} T
 * @param {{ depth: number, course: number, block: number, seed: number }} o
 */
export function paintMasonry(mat, d, T, o) {
  const Y1 = SHOP_TOP - SHOP_ROOF, D = Math.max(0, Math.round(o.depth)), C = o.course, B = Math.max(4, Math.round(o.block));
  if (!D) return;
  const dist = new Uint8Array(CW * Y1).fill(255), q = new Int32Array(CW * Y1);
  let h = 0, n = 0;
  for (let y = 1; y < Y1 - 1; y++) for (let x = 1; x < CW - 1; x++) {
    const i = y * CW + x;
    if (!mat[i]) continue;
    if (!mat[i - 1] || !mat[i + 1] || !mat[i - CW] || !mat[i + CW]) { dist[i] = 1; q[n++] = i; }
  }
  while (h < n) {
    const i = q[h++], v = dist[i] + 1;
    if (v > D) continue;
    for (const j of [i - 1, i + 1, i - CW, i + CW]) if (j >= 0 && j < CW * Y1 && mat[j] && dist[j] > v) { dist[j] = v; q[n++] = j; }
  }
  const row = (/** @type {number} */ y) => Math.floor((y - TOMB_TOP + C * 1000) / C);
  const cols = Math.ceil(CW / B) + 2, rows = Math.ceil(CH / C) + 1002;
  const dressed = new Uint8Array(cols * rows);
  const key = (/** @type {number} */ x, /** @type {number} */ y) => { const r = row(y); return r * cols + Math.floor((x + (r & 1) * (B >> 1)) / B); };
  for (let y = 0; y < Y1; y++) for (let x = 0; x < CW; x++) if (dist[y * CW + x] <= D) dressed[key(x, y)] = 1;
  const hash = (/** @type {number} */ a, /** @type {number} */ b) => {
    let v = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(o.seed, 982451653)) | 0;
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
  };
  for (let y = 1; y < Y1; y++) for (let x = 0; x < CW; x++) {
    const i = y * CW + x;
    if (mat[i] !== ROCK) continue;
    const k = key(x, y);
    if (!dressed[k]) continue;
    const r = row(y), sx = x + (r & 1) * (B >> 1);
    const mortar = (y - TOMB_TOP + C * 1000) % C === C - 1 || sx % B === B - 1;
    let c;
    if (mortar) c = T.mortar;
    else {
      c = mix(T.brick[0], T.brick[1], hash(k, 7));
      if (!mat[i - CW]) c = c.map(v => v * 1.3);                     // a floor: its lit edge
      else if (y + 1 < CH && !mat[i + CW]) c = c.map(v => v * 0.72); // a roof: in shadow
    }
    const j = (hash(x * 3 + 1, y * 5 + 2) - 0.5) * 8;
    d[i * 4] = c[0] + j; d[i * 4 + 1] = c[1] + j; d[i * 4 + 2] = c[2] + j;
  }
}

// Glyphs carved in the back wall's friezes (owner: the back wall fits the tomb): 3 × 2 bg px each, '#' cut
const GLYPHS = [['#.#', '.#.'], ['###', '#.#'], ['.#.', '###'], ['#..', '###'], ['#.#', '###'], ['##.', '.##'], ['.#.', '#.#']];

/**
 * The tomb's back wall, at terrain resolution (one pixel = one terrain px; the game draws it where the
 * quarter-size back wall goes): dressed stone blocks in staggered courses at the rock lining's scale
 * (owner: the old ones were far bigger than the level's bricks), dark mortar, each block its own tone with a
 * lit top-left lip; now and then a cracked or fallen block; every so many courses a carved frieze of
 * glyphs; pilasters up the wall at intervals; big slow blotches of shadow for depth. Kept dim: it is behind
 * the hologram and the rock. Then the quarter-size copy (bg, averaged) for everything else that reads the
 * back wall. Pure: the same seed, the same wall.
 * @param {ImageData} hi CW × CH @param {ImageData} bg BW × BH @param {number} seed
 * @param {(x: number, y: number) => number} noise 0..1, smooth
 */
export function paintTombWall(hi, bg, seed, noise) {
  const W = hi.width, H = hi.height, d = hi.data, BWK = 7, BHK = 4, FRIEZE = 13, PIL = 41, PW = 5;
  const hash = (/** @type {number} */ a, /** @type {number} */ b) => {
    let v = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(seed + 77, 982451653)) | 0;
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
  };
  const STONE = [[44, 40, 37], [60, 54, 48]], MORTAR = [22, 20, 19], CUT = [26, 23, 21];
  const pilOff = Math.floor(hash(1, 2) * PIL), S = W / bg.width;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const course = Math.floor(y / BHK), cy = y % BHK, fr = course % FRIEZE === FRIEZE - 1;
    const px = (x + pilOff) % PIL, pil = px < PW;
    let c;
    if (pil) {
      // a pilaster: a smooth shaft, lit on its left, shadowed on its right; a capital where a frieze crosses
      const t = hash(Math.floor((x + pilOff) / PIL), 9) * 0.15;
      c = mix(STONE[0], STONE[1], 0.55 + t);
      if (px === 0) c = c.map(v => v * 1.18); else if (px === PW - 1) c = c.map(v => v * 0.7);
      if (fr) c = c.map(v => v * (cy === 0 ? 1.15 : 0.85));
    } else if (fr) {
      // a frieze course: a carved band, glyphs cut into it under a lit border
      const g = GLYPHS[Math.floor(hash(Math.floor(x / 4), course) * GLYPHS.length)], gx = x % 4;
      c = mix(STONE[0], STONE[1], 0.7);
      if (cy === 0) c = c.map(v => v * 1.12);
      else if (cy === BHK - 1) c = MORTAR;
      else if (gx < 3 && g[cy - 1] && g[cy - 1][gx] === '#') c = CUT;
    } else {
      const off = (course & 1) * (BWK >> 1), bx = Math.floor((x + off) / BWK), cx = (x + off) % BWK;
      const r = hash(bx, course);
      if (cx === BWK - 1 || cy === BHK - 1) c = MORTAR;
      else if (r < 0.025) c = MORTAR.map(v => v * 0.8);                    // a fallen block: the dark behind it
      else {
        c = mix(STONE[0], STONE[1], r);
        if (cx === 0 || cy === 0) c = c.map(v => v * 1.1);                   // the lit lip
        if (r > 0.94 && cx === cy + 1) c = MORTAR;                            // a crack
      }
    }
    const big = noise(x / S / 34 + 700, y / S / 34 + 500), shade = 1 - 0.5 * Math.max(0, Math.min(1, (big - 0.35) / 0.3));
    const j = (hash(x + 900, y + 900) - 0.5) * 4, k = (y * W + x) * 4;
    d[k] = c[0] * shade + j; d[k + 1] = c[1] * shade + j; d[k + 2] = c[2] * shade + j; d[k + 3] = 255;
  }
  // the quarter-size copy: each bg pixel the mean of its S × S
  const b = bg.data, n = S * S;
  for (let y = 0; y < bg.height; y++) for (let x = 0; x < bg.width; x++) {
    let r = 0, g = 0, bl = 0;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const k = ((y * S + j) * W + x * S + i) * 4; r += d[k]; g += d[k + 1]; bl += d[k + 2]; }
    const k = (y * bg.width + x) * 4;
    b[k] = r / n; b[k + 1] = g / n; b[k + 2] = bl / n; b[k + 3] = 255;
  }
}
