// @ts-check
// Floor 2's tomb, furnished (Level 2 stage 3): every room gets its type's kit, painted as pixels.
//   furnishTomb   each room: a floor mosaic and carvings on the rock round it (img), then its kit in the
//                 decoration layer (dimg: altars, idols, shelves, bunks, urns, tables, an orrery…, and
//                 skeletons), mirrored about the room's middle; a few bones along the galleries.
// No props: it's all baked, so a blast or a dig wipes it like any decoration (unDeco). Nothing is ever
// painted on rock in dimg, or on anything but ROCK in img. Each room's pieces are listed on it (room.kit).
// Its own random stream, so the tomb, the creatures and the loot never move.

import { BRICK, CH, CW, ROCK } from '../core/consts.js';
import { DEV, kr } from '../dev/knobs.js';
import { FUEL_WOOD } from './fire.js';
import { roomPillars } from './tomb.js';

/** the kits' colours: carved stone, bone, bronze and verdigris, faded cloth, wood, parchment @type {Record<string, number[]>} */
export const KIT_PAL = {
  S: [158, 152, 170], s: [112, 108, 126], d: [66, 64, 78], k: [16, 14, 20],
  B: [226, 218, 194], b: [164, 154, 128],
  G: [222, 178, 74], g: [150, 108, 48], T: [78, 166, 152], t: [44, 100, 96],
  C: [132, 48, 62], c: [84, 30, 44], V: [92, 64, 130], v: [58, 42, 88],
  W: [124, 86, 52], w: [82, 56, 34], P: [206, 190, 146], p: [150, 132, 96],
  F: [255, 226, 130], O: [236, 128, 44],
};
const BURNS = 'WwCcVvPp';                   // what's wood, cloth or parchment: it burns

// ---- the sprites (rows top to bottom; '.' is clear). Side pieces are drawn on the right of the
// middle, facing out, and mirrored; `flip` turns them to face the middle ----
const SKULL = ['.BBB.', 'BkBkB', 'BBBBB', '.b.b.'];
const BONES = ['B...bB', '.BBbB.'];
const SKULLS = ['...BBB...', '..BkBkB..', '.BBbBBbB.', 'BkBBkBBkB'];
const LYING = ['.BB..b.b.b..', 'BkBBBBBBBBBB', '.B...b.b.bBB'];
const SITTING = ['.BB..', '.BkB.', '..B..', '.BBB.', '.BbBB', '.BB..', '.BBBB', '.B..B'];
const KNEEL = ['..BB..', '..BkB.', '..BB..', '.BBBBB', '.BB...', 'BBBBB.'];
const URN = ['.dssd.', '..ss..', '.sSSs.', 'sSTTSs', 'sSSSSs', 'sSggSs', '.sSSs.', '..dd..'];
const AMPHORA = ['..ss..', '.s..s.', '.sSSs.', 'sSSSSs', 'sSTTSs', 'sSSSSs', '.sSSs.', '.sSSs.', '..ss..', '..dd..'];
const JAR = ['.ss.', 'sSSs', 'sggs', 'sSSs', '.ss.'];
const CRATE = ['wwwwwww', 'wWwWwWw', 'wWWwWWw', 'wWwWwWw', 'wWWwWWw', 'wwwwwww'];
const CHEST = ['wwwwwwww', 'wWWGGWWw', 'wwwGGwww', 'wWWWWWWw', 'wwwwwwww'];
const SCROLLS = ['..PpP..', '.PpPPp.', 'PPpPpPP'];
const BOWL = ['gTTTg', '.ggg.'];
const CANDLE = ['F', 'O', 'P', 'P', 'p'];
const IDOL = ['..SSSS..', '.SSSSSS.', '.SkSSkS.', '..SSSS..', '...SS...', '.SSSSSS.', 'SSsSSsSS', 'S.SSSS.S',
  'S.SGGS.S', 's.SSSS.s', '..SSSS..', '..SssS..', '..S..S..', '..S..S..', 'dddddddd', 'dssssssd', 'dddddddd'];
const SMALL_IDOL = ['.SSSS.', 'SkSSkS', '.SSSS.', '..SS..', 'SSSSSS', '.SGGS.', '.SSSS.', '.S..S.', 'dddddd', 'dssssd'];
const GUARD = ['...SSSS...', '..SSSSSS..', '..SkSSkS..', '...SSSS...', '....SS....', '.SSSSSSSS.', 'SSSsSSsSSS',
  'SS.SSSS.SS', 'Sg.SGGS.gS', 'S..SSSS..S', 'T..SSSS..T', 'T..SssS..T', 'T..S..S..T', 'T..S..S..T', 'T..S..S..T',
  'T.SS..SS.T', 'dddddddddd', 'dssssssssd', 'dddddddddd'];
// the alien glyphs carved round the rooms: 3 wide, 5 tall, a gap row after (bit = column + 3 × row)
const GLYPHS = [0b111101111101111, 0b010111010111010, 0b111001111100111, 0b101101111001001,
  0b111010010010111, 0b100111101111001, 0b011100110001110, 0b111101101101111];
const glyphBit = (/** @type {number} */ g, /** @type {number} */ col, /** @type {number} */ row) => (GLYPHS[g % GLYPHS.length] >> (col + 3 * row)) & 1;
// each type's inlay colour (floor mosaic, the carvings' fill)
/** @type {Record<string, string>} */
const ACCENT = { altar: 'G', gate: 'T', vestibule: 'T', hall: 'C', library: 'g', ossuary: 'b', dorm: 'V', store: 'g', orrery: 'G', pillars: 'T', shrine: 'G' };

/**
 * Furnish the tomb: every room's kit, its carvings and mosaic, bones along the galleries.
 * @param {Uint8Array} mat @param {Pixels} img @param {Pixels} dimg @param {Uint8Array | null} fuel @param {Tomb} t @param {number} seed
 */
export function furnishTomb(mat, img, dimg, fuel, t, seed) {
  let rs = (Math.imul(seed | 0, 40503) + 991 >>> 0) % 2147483646 + 1;
  const R = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 6; i++) R();
  const all = DEV.l2Decor, Kf = kr('l2Furn', R) * all, Kb = kr('l2Bones', R) * all;
  if (all <= 0) { for (const r of t.rooms) r.kit = []; return; }
  for (const r of t.rooms) furnishRoom(mat, img, dimg, fuel, r, seed, R, Kf, Kb, t.prize === r.id);
  // bones along the galleries (not in a room's box), now and then
  const dd = dimg.data;
  const inRoom = (/** @type {number} */ x, /** @type {number} */ y) => t.rooms.some(r => x >= r.x - 2 && x < r.x + r.w + 2 && y >= r.y - 2 && y <= r.floor + 2);
  for (const c of t.corridors) {
    if (c.kind !== 'gallery') continue;
    const fy = c.y + c.h - 1;
    for (let x = c.x + 4; x < c.x + c.w - 10; x += 14) {
      if (R() > 0.22 * Kb) continue;
      const art = R() < 0.5 ? SKULL : R() < 0.5 ? BONES : LYING;
      const w = art[0].length, h = art.length;
      if (inRoom(x, fy) || inRoom(x + w, fy) || inRoom(x, fy - h) || inRoom(x + w, fy - h)) continue;
      let ok = true;
      for (let k = 0; k < w && ok; k++) if (fy + 1 >= CH || !mat[(fy + 1) * CW + x + k]) ok = false;
      for (let j = 0; j < h && ok; j++) for (let k = 0; k < w; k++) if (mat[(fy - j) * CW + x + k]) ok = false;
      if (!ok) continue;
      for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) {
        const ch = art[j][k];
        if (ch === '.') continue;
        const i = (fy - h + 1 + j) * CW + x + k, c0 = KIT_PAL[ch];
        dd[i * 4] = c0[0]; dd[i * 4 + 1] = c0[1]; dd[i * 4 + 2] = c0[2]; dd[i * 4 + 3] = 255;
      }
    }
  }
}

/**
 * One room: its carvings, its mosaic and its kit, all mirrored about its middle.
 * @param {Uint8Array} mat @param {Pixels} img @param {Pixels} dimg @param {Uint8Array | null} fuel @param {TombRoom} r
 * @param {number} seed @param {Rnd} R @param {number} Kf furniture × @param {number} Kb bones × @param {boolean} prize the green crystal's room (its altar is the game's)
 */
function furnishRoom(mat, img, dimg, fuel, r, seed, R, Kf, Kb, prize) {
  const cx = r.cx, F = r.floor, dd = dimg.data, id = img.data, hw = Math.floor(r.w / 2);
  /** @type {TombItem[]} */
  const kit = r.kit = [];
  const hash = (/** @type {number} */ a, /** @type {number} */ b) => {
    let v = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(seed + r.id * 31, 982451653)) | 0;
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
  };
  const inb = (/** @type {number} */ x, /** @type {number} */ y) => x >= 0 && y >= 0 && x < CW && y < CH;
  const open = (/** @type {number} */ x, /** @type {number} */ y) => inb(x, y) && !mat[y * CW + x];
  const solid = (/** @type {number} */ x, /** @type {number} */ y) => inb(x, y) && (mat[y * CW + x] === ROCK || mat[y * CW + x] === BRICK);
  const rock = (/** @type {number} */ x, /** @type {number} */ y) => inb(x, y) && mat[y * CW + x] === ROCK;
  const XR = (/** @type {number} */ u) => cx + u, XL = (/** @type {number} */ u) => cx - 1 - u, Y = (/** @type {number} */ up) => F - 1 - up;
  // one pixel and its mirror, in the decoration layer (both open, or neither)
  /** @param {number} u @param {number} up @param {string} ch @param {number} [a] */
  const pair = (u, up, ch, a) => {
    const y = Y(up), xr = XR(u), xl = XL(u);
    if (u < 0 || !open(xr, y) || !open(xl, y)) return;
    const c = KIT_PAL[ch], j = (hash(u * 7 + 1, up * 13 + 5) - 0.5) * 12, al = a == null ? 255 : a;
    for (const x of [xr, xl]) {
      const i = y * CW + x, k = i * 4;
      dd[k] = c[0] + j; dd[k + 1] = c[1] + j; dd[k + 2] = c[2] + j; dd[k + 3] = al;
      if (fuel) fuel[i] = BURNS.includes(ch) ? FUEL_WOOD : 0;
    }
  };
  // a carving on the rock: pixel (u, up) and its mirror, if both are ROCK
  /** @param {number} u @param {number} up @param {number} f darken × @param {string | null} ch inlay */
  const carve = (u, up, f, ch) => {
    const y = Y(up), xr = XR(u), xl = XL(u);
    if (u < 0 || !rock(xr, y) || !rock(xl, y)) return;
    const c = ch ? KIT_PAL[ch] : null;
    for (const x of [xr, xl]) {
      const k = (y * CW + x) * 4;
      for (let n = 0; n < 3; n++) id[k + n] = c ? (id[k + n] * 0.35 + c[n] * 0.65) * f : id[k + n] * f;
    }
  };
  // does a w × h box at (u0, up0) fit, on both sides? ground: standing on rock all along
  /** @param {number} u0 @param {number} up0 @param {number} w @param {number} h @param {boolean} [ground] */
  const fits = (u0, up0, w, h, ground) => {
    if (u0 < 0 || up0 < 0) return false;
    for (let up = up0; up < up0 + h; up++) for (let u = u0; u < u0 + w; u++) if (!open(XR(u), Y(up)) || !open(XL(u), Y(up))) return false;
    if (ground) for (let u = u0; u < u0 + w; u++) if (!solid(XR(u), Y(up0 - 1)) || !solid(XL(u), Y(up0 - 1))) return false;
    return true;
  };
  /** @param {string} name @param {number} u0 @param {number} up0 @param {number} w @param {number} h */
  const note = (name, u0, up0, w, h) => kit.push({ id: name, x: XR(u0), y: Y(up0 + h - 1), w, h, m: u0 > 0 });
  // a sprite on the right of the middle at (u0, up0) (its bottom-left), mirrored; flip: facing the middle
  /** @param {string} name @param {string[]} art @param {number} u0 @param {number} up0 @param {{ flip?: boolean, a?: number, air?: boolean }} [o] */
  const spr = (name, art, u0, up0, o) => {
    o = o || {};
    const h = art.length, w = art[0].length;
    if (!fits(u0, up0, w, h, !o.air && up0 === 0)) return false;
    for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
      const ch = art[row][o.flip ? w - 1 - col : col];
      if (ch !== '.') pair(u0 + col, up0 + h - 1 - row, ch, o.a);
    }
    note(name, u0, up0, w, h);
    return true;
  };
  // a sprite in the middle (even width; its right half, mirrored, so it is exactly symmetric)
  /** @param {string} name @param {string[]} art @param {number} up0 @param {{ air?: boolean }} [o] */
  const sprC = (name, art, up0, o) => {
    const h = art.length, w = art[0].length, hf = w >> 1;
    if (!fits(0, up0, hf, h, !(o && o.air) && up0 === 0)) return false;
    for (let row = 0; row < h; row++) for (let col = hf; col < w; col++) {
      const ch = art[row][col];
      if (ch !== '.') pair(col - hf, up0 + h - 1 - row, ch);
    }
    note(name, 0, up0, hf, h);
    return true;
  };
  /** @param {number} u0 @param {number} up0 @param {number} w @param {number} h @param {string} ch */
  const rect = (u0, up0, w, h, ch) => { for (let up = up0; up < up0 + h; up++) for (let u = u0; u < u0 + w; u++) pair(u, up, ch); };
  // how many open rows above the floor at column u (both sides)
  // (never past the room's own box: a shaft up through the roof would lead into the next room)
  const ceil = (/** @type {number} */ u) => { let up = 0; while (up < r.h && open(XR(u), Y(up)) && open(XL(u), Y(up))) up++; return up; };
  const roofed = (/** @type {number} */ u, /** @type {number} */ top) => solid(XR(u), Y(top)) && solid(XL(u), Y(top));
  const wallAt = (/** @type {number} */ up) => { let u = 0; while (u < hw + 2 && open(XR(u), Y(up)) && open(XL(u), Y(up))) u++; return u; };
  // something hung from the roof at column u0 on a chain `len` long (the art centred under it)
  /** @param {string} name @param {string[]} art @param {number} u0 @param {number} len */
  const hang = (name, art, u0, len) => {
    const w = art[0].length, hgt = art.length, top = ceil(u0 + (w >> 1));
    const up0 = top - len - hgt;
    if (up0 < 14 || !roofed(u0 + (w >> 1), top) || !fits(u0, up0, w, hgt + len)) return false;
    for (let k = 0; k < len; k++) pair(u0 + (w >> 1), top - 1 - k, 'd');
    for (let row = 0; row < hgt; row++) for (let col = 0; col < w; col++) if (art[row][col] !== '.') pair(u0 + col, up0 + hgt - 1 - row, art[row][col]);
    note(name, u0, up0, w, hgt + len);
    return true;
  };
  const acc = ACCENT[r.type] || 'T';
  const H = ceil(0) || r.h;

  // ---- the rock round it: a mosaic in the floor, glyphs down the walls, dentils under the roof ----
  for (let u = 0; u < hw; u++) {
    if (!open(XR(u), Y(0)) || !open(XL(u), Y(0))) continue;
    const m = u % 6;
    carve(u, -1, m === 0 ? 0.6 : 1.05, m === 0 ? null : (u % 12 < 6 ? acc : 's'));
    if (m === 3) carve(u, -2, 0.75, acc);
  }
  for (let up = 2; up < H - 3; up++) {
    const e = wallAt(up), row = up % 6;
    if (row === 5) continue;
    const g = Math.floor(up / 6) + r.id * 3;
    for (let k = 0; k < 3; k++) if (glyphBit(g, k, row)) carve(e + k, up, 0.5, (up / 6 | 0) % 2 ? acc : null);
  }
  for (let u = 0; u < hw; u++) {
    const top = ceil(u);
    if (top < 6 || top >= 400) continue;
    carve(u, top, u % 4 < 2 ? 0.45 : 1, null);
    carve(u, top + 1, 0.9, acc);
  }

  // ---- bones everywhere, a little (the tomb's dead) ----
  const scatter = (/** @type {number} */ n, /** @type {number} */ from) => {
    for (let i = 0; i < n; i++) {
      const art = R() < 0.4 ? SKULL : BONES, u0 = from + Math.floor(R() * Math.max(1, hw - from - 6));
      spr('bones', art, u0, 0, { flip: R() < 0.5 });
    }
  };
  const n = (/** @type {number} */ v) => Math.round(v);
  const T = r.type;

  // ---- a tall room's upper walls: carved relief panels on the back wall (half see-through, in the
  // decoration layer), and a great unlit ring hung from the middle of the roof ----
  if (H >= 40 && T !== 'ossuary' && T !== 'pillars' && T !== 'gate') {
    const pu = Math.round(H * 0.5), ph = Math.min(14, Math.round(H * 0.22));
    let made = 0;
    for (let u0 = 3; u0 + 10 < hw; u0 += 15) {
      if (!fits(u0, pu, 10, ph)) continue;
      for (let up = pu; up < pu + ph; up++) for (let u = u0; u < u0 + 10; u++) {
        const edge = up === pu || up === pu + ph - 1 || u === u0 || u === u0 + 9;
        pair(u, up, edge ? 's' : 'd', edge ? 150 : 170);
      }
      // two columns of small script, a glyph to a line
      for (let line = 0; line * 6 + 7 <= ph; line++) for (const [k, gx] of [[0, u0 + 2], [1, u0 + 6]]) {
        const g = r.id * 3 + made * 7 + line * 2 + k;
        for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++)
          if (glyphBit(g, col, row)) pair(gx + col - (k ? 1 : 0), pu + ph - 2 - line * 6 - row, acc, 150);
      }
      note('relief', u0, pu, 10, ph);
      made++;
    }
    const top = ceil(0), len = Math.max(4, Math.round(top * 0.25)), cy = top - len - 4;
    if (top >= 50 && roofed(0, top) && fits(0, cy - 3, 6, 8)) {
      for (let k = 0; k < len; k++) pair(0, top - 1 - k, 'd');
      for (let a = 0; a <= Math.PI; a += 0.15) pair(Math.floor(5 * Math.sin(a)), Math.round(cy + 2 * Math.cos(a)), 'g');
      pair(0, cy - 2, 'G'); pair(1, cy - 2, 'G'); pair(0, cy - 3, 'T');
      note('ring', 0, cy - 3, 6, len + 7);
    }
  }

  if (T === 'altar') {
    if (!prize) {
      // as big a stepped altar as the floor's middle takes
      const aw = [12, 9, 6].find(w => fits(0, 0, w + 1, 12, true));
      if (aw) {
        rect(0, 0, aw, 3, 'd'); rect(0, 3, aw - 2, 3, 's'); rect(0, 6, aw - 4, 4, 'S'); rect(0, 9, aw - 4, 1, 'G');
        note('altar', 0, 0, aw, 10);
        sprC('offering', ['gGGg', '.gg.'], 10, { air: true });
        if (aw >= 9) spr('candle', CANDLE, aw - 6, 10, { air: true });
      }
    }
    const iu = Math.max(prize ? 16 : 15, n(hw * 0.5));
    if (!spr('idol', IDOL, iu, 0) && !spr('idol', SMALL_IDOL, iu, 0)) spr('idol', SMALL_IDOL, Math.max(14, iu - 6), 0);
    for (let k = 0; k < n(2 * Kb); k++) spr('kneeling', KNEEL, (prize ? 15 : 13) + k * 8, 0, { flip: true }) || spr('bones', SKULL, 15 + k * 8, 0);
    if (Kf > 0.3) { spr('candle', CANDLE, iu - 3, 0); spr('candle', CANDLE, iu + 10, 0); }
    hang('censer', ['gGg', '.g.'], Math.max(8, n(hw * 0.3)), 6);
    scatter(n(Kb * hw / 30), iu + 8);
  } else if (T === 'library') {
    const sh = Math.min(H - 6, 24);
    let u0 = hw - 12, made = 0;
    while (u0 > 10 && made < n(4 * Kf)) {
      if (fits(u0, 0, 10, sh, true)) {
        rect(u0, 0, 10, sh, 'w');
        for (let up = 2; up < sh - 1; up += 5) for (let u = u0 + 1; u < u0 + 9; u++) {
          const hgt = 3 + (hash(u, up) < 0.4 ? 0 : 0), col = 'CVgTPc'[Math.floor(hash(u * 3, up) * 6)];
          for (let q = 0; q < hgt; q++) pair(u, up + q, hash(u, up + 99) < 0.12 ? 'w' : col);
        }
        note('shelf', u0, 0, 10, sh);
        made++;
        u0 -= 14;
      } else u0 -= 3;
    }
    if (fits(0, 0, 5, 10, true)) {
      rect(0, 0, 1, 6, 's'); rect(0, 6, 4, 1, 'w'); rect(0, 7, 5, 1, 'w'); rect(0, 8, 4, 1, 'P'); pair(0, 8, 'p');
      note('lectern', 0, 0, 5, 9);
    }
    spr('reader', SITTING, 6, 0, { flip: true });
    for (let k = 0; k < n(2 * Kf); k++) spr('scrolls', SCROLLS, 12 + Math.floor(R() * Math.max(1, hw - 24)), 0);
    scatter(n(Kb * hw / 40), 8);
  } else if (T === 'ossuary') {
    const top = Math.min(H - 4, 40);
    // the back wall: rows of niches, a skull in nearly every one
    for (let up = 3; up + 6 < top; up += 8) for (let u = 1; u + 7 < hw - 1; u += 8) {
      if (!fits(u, up, 7, 7)) continue;
      rect(u, up, 7, 7, 's'); rect(u + 1, up + 1, 5, 5, 'k'); rect(u, up, 7, 1, 'S');
      if (hash(u, up) < 0.85) for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) {
        const ch = SKULL[row][col];
        if (ch !== '.') pair(u + 1 + col, up + 4 - row, ch);
      }
      note('niche', u, up, 7, 7);
    }
    sprC('skulls', SKULLS.map(s => s + '.'), 0);
    for (let k = 0; k < n(3 * Kb); k++) spr('skulls', SKULLS, 8 + Math.floor(R() * Math.max(1, hw - 18)), 0) || spr('bones', BONES, 8 + k * 6, 0);
    scatter(n(Kb * hw / 15), 4);
  } else if (T === 'dorm') {
    let u0 = hw - 18, made = 0;
    while (u0 > 0 && made < n(4 * Kf)) {
      if (fits(u0, 0, 16, 6, true)) {
        const bunk = (/** @type {number} */ b) => {
          rect(u0, b, 1, 3, 'd'); rect(u0 + 15, b, 1, 3, 'd'); rect(u0, b + 3, 16, 2, 's'); rect(u0 + 2, b + 5, 12, 1, 'V');
          if (R() < 0.7 * Kb) spr('sleeper', LYING, u0 + 2, b + 5, { air: true, flip: R() < 0.5 });
          else pair(u0 + 3, b + 6, 'v');
        };
        bunk(0);
        if (fits(u0, 12, 16, 8)) { bunk(12); rect(u0, 6, 1, 6, 'd'); rect(u0 + 15, 6, 1, 6, 'd'); }
        note('bunk', u0, 0, 16, 6);
        made++;
        u0 -= 19;
      } else u0 -= 3;
    }
    if (!made && fits(0, 0, 7, 6, true)) {          // a narrow room: one bunk across the middle
      rect(6, 0, 1, 3, 'd'); rect(0, 3, 7, 2, 's'); rect(0, 5, 5, 1, 'V'); pair(4, 6, 'v');
      spr('skull', SKULL, 1, 5, { air: true });
      note('bunk', 0, 0, 7, 6);
    }
    spr('chest', CHEST, Math.max(0, u0 + 4), 0) || sprC('chest', CHEST, 0);
    scatter(n(Kb * hw / 30), 2);
  } else if (T === 'store') {
    let u = 1;
    const kinds = [URN, JAR, CRATE, AMPHORA, JAR, URN];
    // a stone shelf along the back wall, jars and urns on it
    const su = Math.min(hw - 2, wallAt(12) - 2);
    if (su > 6 && fits(0, 12, su, 1)) {
      rect(0, 11, su, 1, 's'); rect(0, 12, su, 1, 'S');
      for (let k = 0; k < su - 3; k += 6) rect(k + 2, 6, 1, 5, 'd');
      for (let k = 1; k < su - 5; k += 5 + Math.floor(R() * 2)) if (R() < 0.8 * Kf) spr(R() < 0.6 ? 'jar' : 'urn', R() < 0.6 ? JAR : URN, k, 13, { air: true });
      note('shelf', 0, 11, su, 2);
    }
    while (u < hw - 3) {
      if (R() > 0.9 * Math.min(1.1, Kf)) { u += 3; continue; }
      const art = kinds[Math.floor(R() * kinds.length)], w = art[0].length;
      const name = art === CRATE ? 'crate' : art === JAR ? 'jar' : 'urn';
      if (spr(name, art, u, 0)) {
        if (art === CRATE && R() < 0.5) spr('crate', CRATE, u, 6, { air: true });
        else if (art === CRATE && R() < 0.6) spr('jar', JAR, u + 1, 6, { air: true });
        u += w + 1;
      } else u += 2;
    }
    if (!kit.length) sprC('urn', AMPHORA, 0) || sprC('jar', JAR, 0);
    scatter(n(Kb * hw / 50), 4);
  } else if (T === 'hall') {
    if (fits(0, 0, 9, 16, true)) {
      rect(0, 0, 9, 2, 'd'); rect(0, 2, 5, 3, 's'); rect(4, 2, 1, 6, 'S'); rect(0, 5, 4, 10, 's');
      rect(0, 15, 4, 1, 'G'); rect(3, 6, 1, 9, 'S'); pair(1, 12, 'T'); pair(0, 12, 'T');
      note('throne', 0, 0, 9, 16);
      spr('king', ['.BB.', 'BkkB', '.BB.', 'BBBB', '.BB.', 'B..B'], 0, 5, { air: true });
    }
    const tw = Math.min(28, hw - 24);
    if (tw >= 10 && fits(14, 0, tw, 6, true)) {
      rect(14, 4, tw, 2, 'W'); rect(15, 0, 1, 4, 'w'); rect(14 + tw - 2, 0, 1, 4, 'w');
      for (let u = 17; u < 14 + tw - 3; u += 5) rect(u, 6, 1, hash(u, 1) < 0.5 ? 2 : 1, hash(u, 2) < 0.5 ? 'g' : 'G');
      note('table', 14, 0, tw, 6);
      for (const bu of [11, 14 + tw + 1]) if (fits(bu, 0, 3, 3, true)) {
        rect(bu, 0, 1, 2, 'w'); rect(bu + 2, 0, 1, 2, 'w'); rect(bu, 2, 3, 1, 'W'); note('bench', bu, 0, 3, 3);
        if (R() < Kb) spr('diner', SITTING, bu - 1, 3, { air: true, flip: bu > 14 });
      }
    }
    for (const f of [0.35, 0.75]) {
      const bu = n(hw * f);
      hang('banner', ['gGGGGg', 'CCCCCC', 'CcGGcC', 'CCGGCC', 'CcGGcC', 'CCCCCC', 'CCCCCC', 'C.CC.C', 'C....C'], bu, 3);
    }
    scatter(n(Kb * hw / 25), 6);
  } else if (T === 'orrery') {
    const c = Math.max(10, Math.min(Math.round(H * 0.5), 30)), Rr = Math.max(6, Math.min(hw - 4, Math.round(H * 0.32), 22));
    rect(0, 0, 4, 2, 'd'); rect(0, 2, 1, c - 3, 's'); rect(0, 2, 2, 1, 's');
    note('orrery', 0, 0, Rr, c + Rr);
    /** @param {number} rx @param {number} ry @param {string} ch */
    const ring = (rx, ry, ch) => {
      for (let a = -Math.PI / 2; a <= Math.PI / 2; a += 0.5 / Math.max(rx, ry)) {
        const u = Math.floor(rx * Math.cos(a)), up = Math.round(c + ry * Math.sin(a));
        if (u >= 0) pair(u, up, ch);
      }
    };
    ring(Rr, Math.round(Rr * 0.32), 'g'); ring(Math.round(Rr * 0.32), Rr, 'G'); ring(Math.round(Rr * 0.7), Math.round(Rr * 0.7), 't');
    for (let dy = -3; dy <= 3; dy++) for (let u = 0; u < 3; u++) if (u * u + dy * dy <= 9) pair(u, c + dy, dy < 0 && u < 2 ? 'G' : 'g');
    /** @type {[number, number, string][]} */
    const planets = [[Math.round(Rr * 0.85), 0, 'T'], [Math.round(Rr * 0.55), Math.round(Rr * 0.6), 'C']];
    for (const [pu, pu2, ch] of planets) {
      pair(pu, c + pu2, ch); pair(pu + 1, c + pu2, ch); pair(pu, c + pu2 + 1, ch); pair(pu + 1, c + pu2 + 1, ch);
    }
    for (const f of [0.55, 0.85]) hang('planet', ['.TT.', 'TttT', '.TT.'], n(hw * f) - 2, 4 + n(f * 10));
    scatter(n(Kb * hw / 30), Rr + 2);
  } else if (T === 'pillars') {
    for (const p of roomPillars(r)) {
      if (p.x < cx) continue;
      for (let y = p.y + 2; y < p.y + p.h - 2; y++) {
        const row = (y - p.y) % 6;
        if (row === 5) continue;
        const g = Math.floor((y - p.y) / 6) + p.x;
        for (let k = 0; k < 3; k++) if (glyphBit(g, k, row)) carve(p.x - cx + k + 1, F - 1 - y, 0.45, (g & 1) ? 'T' : null);
      }
      if (p.y + p.h >= F) spr('skulls', SKULL, p.x - cx + p.w + 2, 0);
      else spr('bowl', BOWL, p.x - cx, 0);
    }
    note('glyphs', 0, 0, 1, 1);
    scatter(n(Kb * hw / 20), 2);
  } else if (T === 'shrine') {
    const big = H >= 30;
    sprC('statue', big ? IDOL : SMALL_IDOL, 0);
    for (let dy = -6; dy <= 6; dy++) for (let u = 0; u <= 6; u++) {
      const d2 = u * u + dy * dy;
      if (d2 <= 36 && d2 >= 20) pair(u, (big ? IDOL : SMALL_IDOL).length + 6 + dy, 'G', 120);
    }
    spr('bowl', BOWL, (big ? 4 : 3) + 2, 0);
    spr('candle', CANDLE, big ? 11 : 9, 0);
    for (let k = 0; k < Math.max(1, n(Kb)); k++) spr('kneeling', KNEEL, 13 + k * 8, 0, { flip: true });
    scatter(n(Kb * hw / 35), 20);
  } else if (T === 'gate') {
    let ou = 8, oh = 0;
    for (; ou < hw - 6; ou++) { oh = Math.min(ceil(ou + 5) - 3, 22); if (oh >= 10 && fits(ou, 0, 6, oh, true)) break; }
    if (ou < hw - 6) {
      rect(ou, 0, 6, 2, 'd'); rect(ou + 1, 2, 4, oh - 4, 's'); rect(ou + 2, oh - 2, 2, 2, 'S');
      for (let up = 4; up < oh - 4; up += 3) pair(ou + 2, up, 'T');
      note('obelisk', ou, 0, 6, oh);
    }
    spr('skulls', SKULL, ou - 5, 0);
  } else if (T === 'vestibule') {
    spr('guardian', GUARD, 18, 0) || spr('guardian', SMALL_IDOL, 18, 0);
    spr('bones', LYING, 30, 0);
    scatter(n(Kb * 2), 14);
  }
}
