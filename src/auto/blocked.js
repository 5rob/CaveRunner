// @ts-check
// CaveRunner Auto's blocked zones (AUTOBATTLER.md section 2, stage 6b part 1), pure. About DEV.autoBlockN zones a
// level (auto/level.js levelPlan) become blocked: the zone stays its base kind (it generates as that zone does) and
// carries `blk` (ZoneBlock): a variant that suits the base (BLOCK_VARIANTS), a severity rolled in
// DEV.autoBlockMin..autoBlockMax (0 a low lump you jet over or chip through, DEV.autoBlockFull and up blocked all the
// way), its span, and `clears`: the block kind (clear.js CLEAR_BLOCKS) a gun must clear to get through.
// The scene (art/titlescene.js genCol) asks blockCell for each cell of a blocked zone's span and blockCol once per
// column (the web thicket's lines); startDig asks blockKind what it is digging into. The thicket: webs slow the
// team (webSlow, levelStep); enough of them together halt it, until a gun that clears webs burns or cuts them.

import { DEV } from '../dev/knobs.js';
import { PH, PW } from '../core/consts.js';
import { TM, titleNoise, titleRng, titleWebAt, titleZoneSpan } from '../art/titlescene.js';

// The variants: id, name, the base zones it suits, what clears it (a block kind), and its look (blockCell)
/** @typedef {{ id: string, name: string, bases: string[], clears: string, look: string }} BlockVariant */
/** @type {BlockVariant[]} */
export const BLOCK_VARIANTS = [
  { id: 'collapse',   name: 'Collapse',          bases: ['timber', 'paved'],          clears: 'rock',   look: 'rubble heap with broken frames' },
  { id: 'deadend',    name: 'Rounded dead end',  bases: ['moss', 'grove'],            clears: 'rock',   look: 'a mossy rounded rock face' },
  { id: 'thicket',    name: 'Web thicket',       bases: ['webs', 'winding'],          clears: 'web',    look: 'webs criss-crossed roof to floor' },
  { id: 'timberfall', name: 'Fallen timber',     bases: ['timber', 'paved', 'grove'], clears: 'timber', look: 'crossed logs heaped up' },
  { id: 'rockslide',  name: 'Rockslide',         bases: ['moss', 'winding', 'webs'],  clears: 'rock',   look: 'a long scree slope' },
  { id: 'roots',      name: 'Root tangle',       bases: ['grove', 'moss'],            clears: 'timber', look: 'roots hanging from the roof' },
  { id: 'silt',       name: 'Silted pass',       bases: ['winding', 'moss'],          clears: 'rock',   look: 'flat banded mud' },
  { id: 'cart',       name: 'Jammed mine cart',  bases: ['timber'],                   clears: 'rock',   look: 'an iron cart on its side in rubble' },
  { id: 'brickwall',  name: 'Brick wall',        bases: ['paved', 'timber'],          clears: 'rock',   look: 'a straight brick wall' },
  { id: 'crystal',    name: 'Crystal growth',    bases: ['moss', 'webs', 'winding'],  clears: 'rock',   look: 'crystal spikes, floor and roof' },
  { id: 'nest',       name: 'Nest plug',         bases: ['webs', 'grove'],            clears: 'web',    look: 'a resin plug wrapped in webs' },
];
/** @param {string} id */
export const blockVariant = id => BLOCK_VARIANTS.find(v => v.id === id) || BLOCK_VARIANTS[0];
/** @param {string} base @returns {BlockVariant[]} the variants that suit a base zone */
export const variantsFor = base => BLOCK_VARIANTS.filter(v => v.bases.includes(base));

// a zone's blockage: the variant, its severity, what clears it, the span (world x) it fills, full (no way past but through)
// rl, rr: how much of the span each end slopes over (0 a sheer face … 0.45 a long gradual slope; owner: not always
// straight up and down); lean: the faces slant (the top runs ahead or behind the foot); k: its own noise seed
/** @typedef {{ variant: string, base: string, sev: number, clears: string, x0: number, x1: number, full: boolean,
 *   rl?: number, rr?: number, lean?: number, k?: number }} ZoneBlock */

// roll one zone's blockage (R: a seeded random)
/** @param {() => number} R @param {import('../art/titlescene.js').TZone} Z @param {string} [variant] (forced: tests, shots) @returns {ZoneBlock} */
export function rollBlock(R, Z, variant) {
  const can = variantsFor(Z.z), v = variant ? blockVariant(variant) : (can.length ? can[Math.floor(R() * can.length)] : BLOCK_VARIANTS[1]);
  const lo = Math.min(DEV.autoBlockMin, DEV.autoBlockMax), hi = Math.max(DEV.autoBlockMin, DEV.autoBlockMax);
  const sev = lo + R() * (hi - lo), zw = Z.x1 - Z.x0;
  // its size (owner): anything from a thin plug (autoBlockThin) to autoBlockWide of the zone, anywhere in it
  const wMin = Math.min(DEV.autoBlockThin, zw * 0.5), wMax = Math.max(wMin, zw * DEV.autoBlockWide);
  const w = wMin + Math.pow(R(), 1.2) * (wMax - wMin), x0 = Z.x0 + R() * (zw - w);
  // its ends: a sheer face or a slope up to it, each end its own; the faces lean
  const ramp = () => (R() < 0.3 ? R() * 0.06 : 0.12 + R() * 0.33);
  return { variant: v.id, base: Z.z, sev, clears: v.clears, x0, x1: x0 + w, full: sev >= DEV.autoBlockFull,
    rl: ramp(), rr: ramp(), lean: (R() - 0.5) * 0.5, k: Math.floor(R() * 1000) };
}
// the zone kind for display and counting: 'blocked' for one with a blockage, else its own
/** @param {import('../art/titlescene.js').TZone} Z */
export const zoneKind = Z => (Z.blk ? 'blocked' : Z.z);

// Pick the level's blocked zones among its random ones (zs: their indices in the plan), with their own random (the
// rest of the level is the same as without). n: DEV.autoBlockN (a fraction is a chance of one more)
/** @param {import('../art/titlescene.js').TitlePlan} P @param {number[]} zs @param {number} seed @param {number} [n] */
export function planBlocks(P, zs, seed, n = DEV.autoBlockN) {
  const R = titleRng((seed * 4099 + 77) >>> 0);
  let k = Math.floor(n) + (R() < n - Math.floor(n) ? 1 : 0);
  const pool = zs.slice(1);                       // never the first: the team gets going first
  while (k-- > 0 && pool.length) {
    const i = pool.splice(Math.floor(R() * pool.length), 1)[0], Z = P.z[i];
    Z.blk = rollBlock(R, Z);
  }
}

/** @param {number} a @param {number} b */
const h2 = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// One cell of a blocked zone (genCol): the material at (wx, y), cur what the zone made there; cy, fy the open
// band's roof and floor there. Returns cur outside the blockage
/** @param {ZoneBlock} B @param {number} wx @param {number} y @param {number} cy @param {number} fy @param {number} cur @returns {number} */
export function blockCell(B, wx, y, cy, fy, cur) {
  if (wx < B.x0 || wx >= B.x1 || y < cy - 4 || y > fy + 4) return cur;
  const H = Math.max(1, fy - cy), c = Math.floor(wx / 2), r = Math.floor(y / 2);
  const up = fy - y;                               // height above the floor
  // where across it (0-1), the faces slanted (lean) and ragged (noise down the face), so the ends aren't plumb lines
  const u = (wx - B.x0) / (B.x1 - B.x0) + (B.lean || 0) * (up / H - 0.5) + (titleNoise(y / 6, 409 + (B.k || 0)) - 0.5) * 0.08;
  if (u < 0 || u >= 1) return cur;
  if (!B.full && up > H - PH * 1.6 - 12) return cur;      // a partial one always leaves him room over it (in a low mine tunnel too)
  // the ends slope up to it (rl, rr): the height it reaches eases from nothing to all of it
  const rl = B.rl ?? 0, rr = B.rr ?? 0;
  const env = Math.min(1, rl > 0 ? u / rl : 1, rr > 0 ? (1 - u) / rr : 1), ease = env * env * (3 - 2 * env);
  const frac = (B.full ? 1.2 : Math.min(0.75, 0.15 + B.sev / Math.max(0.01, DEV.autoBlockFull) * 0.6)) * ease;   // how much of the band it fills
  const n = titleNoise(wx / 7, 401) * 6 - 3;
  switch (B.variant) {
    case 'collapse': {                             // a heap peaked in the middle, broken frames slanting through
      const h = H * frac * Math.pow(Math.sin(Math.PI * u), 0.4) + n;
      if (up > h) return cur;
      if (Math.abs(((wx - y * 0.7) % 22 + 22) % 22 - 11) < 1.6 && up < h - 3) return TM.BEAMD;
      if (Math.abs(((wx + y * 1.3) % 31 + 31) % 31 - 15) < 1.2 && up < h - 3) return TM.BEAM;
      return h2(c, r) < 0.55 ? TM.RUB : h2(c, r) < 0.8 ? TM.ROCK : TM.RUBM;
    }
    case 'deadend': {                              // a rounded face (a half dome), mossy skin
      const mid = fy - H * frac / 2, half = H * frac / 2 + 2, t = (y - mid) / half;
      if (Math.abs(t) > 1) return cur;
      const face = (B.x1 - B.x0) * 0.8 * (1 - Math.sqrt(1 - t * t));
      const d = (wx - B.x0) - face + n * 0.5;
      if (d < 0) return cur;
      return d < 3 ? (h2(c, r) < 0.3 ? TM.GRASS : TM.MOSS) : TM.ROCK;
    }
    case 'thicket': return cur;                    // its webs: blockCol
    case 'timberfall': {                           // logs heaped, crossing
      const h = H * frac * (0.75 + 0.25 * Math.sin(Math.PI * u)) + n;
      if (up > h) return cur;
      const a = ((wx + up * 0.9) % 13 + 13) % 13, b = ((wx - up * 1.4) % 17 + 17) % 17;
      if (a < 4 || b < 4) return (a < 1 || b < 1) ? TM.BEAMD : TM.WOOD;
      return up < 6 ? TM.RUB : cur === TM.AIR ? TM.AIR : cur;
    }
    case 'rockslide': {                            // a long slope up to a steep front
      const h = H * frac * Math.min(1, u * 1.4) * (u > 0.85 ? (1 - u) / 0.15 : 1) + n * 1.5;
      if (up > h) return cur;
      return h2(c, r) < 0.25 ? TM.RUB : TM.ROCK;
    }
    case 'roots': {                                // single roots hanging from a matted roof: each its own (owner: not a pattern)
      const down = y - cy;
      if (down < 3 + 3 * titleNoise(wx / 4, 403)) return TM.ROOT;
      return rootAt(B, wx, down, H * frac) ? TM.ROOT : cur;
    }
    case 'silt': {                                 // a flat-topped bank, banded
      const h = H * frac * Math.min(1, Math.min(u, 1 - u) * 6) + n * 0.3;
      if (up > h) return cur;
      return Math.floor(up / 3) % 2 ? TM.SILT : TM.SILTD;
    }
    case 'cart': {                                 // an iron cart on its side in rubble
      const h = H * frac, bx = (wx - B.x0) / (B.x1 - B.x0);
      if (up < h * 0.35 + n) return h2(c, r) < 0.6 ? TM.RUB : TM.ROCK;
      if (bx > 0.15 && bx < 0.85 && up < h) {
        const edge = bx < 0.22 || bx > 0.78 || up > h - 3 || Math.abs(bx - 0.5) < 0.03;
        return edge ? TM.IRON : TM.IROND;
      }
      if (up < h * 0.6 && Math.abs(bx - 0.08) < 0.06) return TM.IRON;   // a wheel
      return cur;
    }
    case 'brickwall': {                            // a straight wall, the whole span
      const h = H * frac;
      return up <= h ? TM.BRICK : cur;
    }
    case 'crystal': {                              // spikes up from the floor and down from the roof
      const k = Math.floor(wx / 9), cx = k * 9 + 4.5, hw = 4.5, d = Math.abs(wx - cx) / hw;
      const hf = H * frac * 0.62 * (0.6 + 0.4 * h2(k, 3)), hc = H * frac * 0.5 * (0.5 + 0.5 * h2(k, 7));
      if (up < hf * (1 - d) || (y - cy) < hc * (1 - d)) return d < 0.3 ? TM.CRYSL : TM.CRYS;
      return cur;
    }
    case 'nest': {                                 // a resin plug in the middle, webs round it (blockCol)
      const mid = (cy + fy) / 2, ry = H * frac * 0.45, rx = (B.x1 - B.x0) * 0.22, d = Math.hypot((wx - (B.x0 + B.x1) / 2) / rx, (y - mid) / Math.max(1, ry));
      if (d < 1 + n * 0.05) return d > 0.85 ? TM.NESTD : TM.NEST;
      return cur;
    }
  }
  return cur;
}

// is (wx, down below the roof) on one of a roots block's roots? Roots grow from slots ~6 apart (some empty), each its own
// thickness, length (up to len), sway and drift, tapering to a point, now and then forking
/** @param {ZoneBlock} B @param {number} wx @param {number} down @param {number} len */
function rootAt(B, wx, down, len) {
  const k0 = Math.floor(wx / 6), s = B.k || 0;
  for (let k = k0 - 3; k <= k0 + 3; k++) {
    if (h2(k, s + 1) < 0.22) continue;                                  // a gap
    const L = len * (0.25 + 0.85 * h2(k, s + 2));                       // its length
    if (down > L) continue;
    const t = down / L, w0 = 0.8 + 2.6 * Math.pow(h2(k, s + 3), 1.5);   // how thick at the roof
    const sway = Math.sin(down / (5 + 9 * h2(k, s + 4)) + h2(k, s + 5) * 6.3) * (1 + 4 * h2(k, s + 6)) * t;
    const x = k * 6 + 6 * h2(k, s + 7) + sway + (h2(k, s + 8) - 0.5) * 0.6 * down;
    if (Math.abs(wx - x) < w0 * (1 - t * 0.85)) return true;
    // a fork: a thinner root off it partway down, off to one side
    const fd = L * (0.3 + 0.4 * h2(k, s + 9)), side = h2(k, s + 10) < 0.5 ? -1 : 1;
    if (h2(k, s + 11) < 0.45 && down > fd && down < fd + L * 0.5) {
      const ft = (down - fd) / (L * 0.5);
      if (Math.abs(wx - (x + side * (down - fd) * 0.7)) < Math.max(0.6, w0 * 0.6 * (1 - ft))) return true;
    }
  }
  return false;
}

// once per column of a blocked zone's span (genCol): the thicket's and the nest's web lines (they slow the team)
/** @param {import('../art/titlescene.js').TitleScene} S @param {ZoneBlock} B @param {number} c @param {number} wx @param {number} cy @param {number} fy */
export function blockCol(S, B, c, wx, cy, fy) {
  if ((B.variant !== 'thicket' && B.variant !== 'nest') || wx < B.x0 || wx >= B.x1 || c % 2) return;
  const R = S.rnd, dens = B.variant === 'nest' ? 0.35 : 0.25 + B.sev * 0.75, n = B.variant === 'nest' ? 1 : B.full ? 3 : 1 + (R() < B.sev ? 1 : 0);
  for (let i = 0; i < n; i++) if (R() < dens) webPair(S, B, wx, cy, fy);
}
// one web line roof to floor (or roof to roof), and now and then a low one across the floor
/** @param {import('../art/titlescene.js').TitleScene} S @param {ZoneBlock} B @param {number} wx @param {number} cy @param {number} fy */
function webPair(S, B, wx, cy, fy) {
  const R = S.rnd;
  const down = R() < 0.6, bx = Math.max(B.x0, Math.min(B.x1, wx + (R() - 0.5) * 50));
  const by = down ? fy - 0.5 : cy + 0.5 + R() * 6, ay = down ? cy + 0.5 : cy + 0.5;
  /** @type {WebLine} */
  const L = { ax: wx, ay, bx, by, a0x: wx, a0y: ay, b0x: bx, b0y: by, ain: { x: wx, y: ay - 1.5 }, bin: { x: bx, y: down ? by + 1.5 : by - 1.5 }, owner: null, sag: 0 };
  L.sag = DEV.webSag * Math.abs(bx - wx) * (down ? 1 : 2.5);
  // a low one too, across the floor: a thicket fills the band, not just its roof
  S.webs.push(L);
  if (R() < 0.5) {
    const lx = wx + (R() - 0.5) * 30, ly = fy - 6 - R() * (fy - cy) * 0.5;
    const M = { ax: wx, ay: fy - 0.5, bx: lx, by: ly, a0x: wx, a0y: fy - 0.5, b0x: lx, b0y: ly, ain: { x: wx, y: fy + 1 }, bin: { x: lx, y: ly }, owner: null, sag: 0 };
    S.webs.push(M);
  }
}

// what a dig at world x goes into (startDig): a blocked zone's span its block kind, anywhere else rock
/** @param {import('../art/titlescene.js').TitleScene} S @param {number} wx */
export function blockKind(S, wx) {
  const Z = titleZoneSpan(wx, S), B = Z.blk;
  return B && wx >= B.x0 - 8 && wx < B.x1 + 8 ? B.clears : 'rock';
}

// how many web lines a player is caught in (within 6 of his middle, as the scene's push)
/** @param {import('../art/titlescene.js').TitleScene} S @param {import('../art/titlescene.js').TRunner} r */
export function websOn(S, r) {
  const cx = r.x + PW / 2 + S.scroll, cy = r.y + PH / 2;
  let n = 0;
  for (const L of S.webs) {
    if (L.out || cx < Math.min(L.a0x, L.b0x) - 6 || cx > Math.max(L.a0x, L.b0x) + 6) continue;
    const vx = L.b0x - L.a0x, vy = L.b0y - L.a0y, u = Math.max(0, Math.min(1, ((cx - L.a0x) * vx + (cy - L.a0y) * vy) / (vx * vx + vy * vy || 1)));
    const w = titleWebAt(L, u);
    if (Math.hypot(w.x - cx, w.y - cy) < 6) n++;
  }
  return n;
}
// the team's pace through webs: each line a player is caught in slows him by DEV.autoWebSlow (they multiply); the
// team goes at its most tangled player's. Below DEV.autoWebHalt it's halted. → { k, i } (i: that player, -1 none)
/** @param {import('../art/titlescene.js').TitleScene} S @returns {{ k: number, i: number, halt: boolean }} */
export function webSlow(S) {
  let k = 1, i = -1;
  for (const r of S.runners) {
    if (r.out || r.hide) continue;
    const q = Math.pow(1 - DEV.autoWebSlow, websOn(S, r));
    if (q < k) { k = q; i = r.id; }
  }
  return { k, i, halt: k < DEV.autoWebHalt };
}
