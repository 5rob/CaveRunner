// @ts-check
// The title screen's background (LIST4 #4, redone v0.0.161): one runner travelling through
// Mossy Caves (floor 1) — running along the ground, then jetpacking — past its zones (natural
// moss, timbered works, paved works, a grove), blasting floor 1's creatures (jellyfish,
// spiders, rat swarms) with a gun he swaps every few seconds (the game's gun art and shots).
// Explosions and digging shots carve the terrain, fire shots set moss, timber and the hanging
// plants alight. Kills drop gold that he vacuums up.
// titleScene makes it, titleStep moves it (pure: its own seeded random, no canvas, so a logic
// suite runs it); game/render/titledraw.js paints it (it needs the game's bullet looks, layer 5);
// titleText paints the big CAVE RUNNER. ui/title.js runs it on one requestAnimationFrame.

import { PW, PH } from '../core/consts.js';
import { CREATURES, ROSTERS } from '../data/creatures.js';
import { THEMES } from '../data/themes.js';
import { DEV, kru } from '../dev/knobs.js';
import { archCurve } from '../world/decorate.js';
import { MODS } from '../spells/mods.js';
import { pixText, pixWidth } from './pixfont.js';

export const TITLE_VW = 220;          // world units across the screen
export const TITLE_FOES = 12;         // at most this many creatures at once (a rat swarm counts each rat)
export const TITLE_PARTS = 320;       // particle cap
export const TITLE_GOLD = 90;         // nugget cap
export const TITLE_FIRE = 160;        // burning terrain cells at once
export const TCELL = 2;               // the terrain grid's cell (world units)
export const TITLE_ZLEN = 280;        // one zone's length (world units)
// the zones it travels through, in order (floor 1's natural and built-up looks)
export const TITLE_ZONES = ['moss', 'webs', 'timber', 'paved', 'grove'];
export const ZBLEND = 28;             // a zone's border frays this far (world units) each way, by noise
export const TIMBER_H = 38;           // the timber works' height, floor to roof: the mine frames' height
export const TITLE_WEBS = 60;         // web lines at once
// cell materials: air (the back wall shows), rock (painted as the game paints it: moss where it faces
// up), moss (burns, chars), brick, wood (burns away), char (burnt or blasted rock); not solid: beam and
// beamD (a timber frame's lit and shaded wood, burn away), grass (the bright tufts on a moss patch),
// rub and rubM (a rubble mound, its mossy top)
export const TM = { AIR: 0, ROCK: 1, MOSS: 2, BRICK: 3, WOOD: 4, CHAR: 5, BEAM: 6, BEAMD: 7, GRASS: 8, RUB: 9, RUBM: 10 };
export const TITLE_SOLID = [0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
const SOLID = TITLE_SOLID;
const FUEL = [0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1];
export const FRAME_GAP = 72;          // the built-up layers: a timber frame every this far (world units)
export const FRAME_W = 36;            // its width, post to post
const SCROLL = 34;                    // the world's scroll speed (world units / s)
const GRAV = 260;
const SP = 0.5;                       // the game's shot speeds, scaled to the title's screen
// the guns he swaps between: a real shot mod (its look, colour, size, speed, how it hits) and a real gun skin
export const TITLE_KITS = [
  { mod: 'bolt', art: 'pinkcarbine', cd: 0.13 },
  { mod: 'buck', art: 'ambershotgun', cd: 0.5 },
  { mod: 'fball', art: 'greenbazooka', cd: 0.7 },
  { mod: 'zap', art: 'skyrifle', cd: 0.5 },
  { mod: 'flamer', art: 'reddrum', cd: 0.06 },
  { mod: 'blast', art: 'toxiclauncher', cd: 0.9 },
  { mod: 'slug', art: 'goldblaster', cd: 0.3 },
];
// floor 1's creatures (its roster, and the rats that live there)
export const TITLE_KINDS = [...ROSTERS[0], 'rotta'];
// who comes into each zone, weighted, as the game spawns them: jellyfish only in the natural caves
// (NATURAL_ONLY), rats in the built-up works (their nests; a few stray into the wild), spiders in
// their own webbed caves
/** @type {Record<string, [string, number][]>} */
export const TITLE_HOME = {
  moss: [['meduusa', 3], ['rotta', 1]],
  webs: [['hamahakki', 4], ['meduusa', 1]],
  timber: [['rotta', 3], ['hamahakki', 1]],   // spiders turn up in the layers too (the level's roster spawns anywhere)
  paved: [['rotta', 1]],
  grove: [['meduusa', 3], ['rotta', 1]],
};

/** @typedef {{ x: number, y: number, vx: number, vy: number, face: number, ang: number, cd: number, kit: number, flame: number,
 *   mode: string, modeT: number, tx: number, ty: number, retarget: number, gait: number, ground: boolean, swapT: number, swap: number }} TRunner */
/** @typedef {{ x: number, y: number, vx: number, vy: number, r: number, hp: number, k: string, flash: number, phase: number, cd: number,
 *   surf: number, br: any, spd?: number, L?: TWeb | null, u?: number, walkT?: number }} TFoe */
/** @typedef {{ x: number, y: number, vx: number, vy: number, size: number, col: string, look: string, life: number, foe: boolean, spin: number,
 *   grav: number, drag: number, explode: number, pit: number, fire: number, bounce: number, bounceE: number, pierce: number, dmg: number }} TShot */
/** @typedef {{ x: number, y: number, vx: number, vy: number, life: number, max: number, r: number, col: string, kind: string }} TPart */
/** @typedef {{ x: number, y: number, vx: number, vy: number, r: number, seed: number, ang: number, spin: number, life: number, ground: boolean, pull: number }} TGold */
/** @typedef {{ x: number, y: number, r: number, t: number, max: number }} TBoom */
/** @typedef {{ pts: { x: number, y: number }[], t: number, col: string }} TZap */
/** @typedef {{ k: string, st: string, wx: number, x: number, y: number, len: number, seed: number, side: number, burn: number, ac: number, ar: number,
 *   arc?: number[][], thick?: number, t?: number, span?: number, host?: TProp }} TProp */
/** @typedef {{ c: number, r: number, t: number }} TFire */
/** @typedef {{ a0x: number, a0y: number, b0x: number, b0y: number, sag: number }} TWeb a web line, world x (the spiders' zone) */
/** @typedef {{ t: number, vh: number, top: number, bot: number, seed: number, rnd: () => number, scroll: number, shake: number, spawn: number,
 *   kills: number, gold: number, got: number, runner: TRunner, foes: TFoe[], shots: TShot[], parts: TPart[], nuggets: TGold[],
 *   booms: TBoom[], zaps: TZap[], flash: number, rows: number, ncol: number, cells: Uint8Array, gen: number, props: TProp[],
 *   fire: TFire[], dirty: number[][], dirtyAll: boolean, carved: number, burnt: number, swaps: number, groundT: number, flyT: number, kinds: Record<string, number>,
 *   webs: TWeb[], cut: number, lineT: number }} TitleScene */

/** @param {number} seed @returns {() => number} a seeded random 0..1 (mulberry32) */
export function titleRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// which zone a world x is in, and how built-up it is there (0 natural .. 1 in a works, ramped at the ends)
/** @param {number} wx @returns {string} */
export const titleZone = wx => TITLE_ZONES[((Math.floor(wx / TITLE_ZLEN) % TITLE_ZONES.length) + TITLE_ZONES.length) % TITLE_ZONES.length];
/** @param {number} wx @param {string} [only] just this zone's (else timber or paved) */
const built = (wx, only) => {
  const z = titleZone(wx);
  if (only ? z !== only : z !== 'timber' && z !== 'paved') return 0;
  const u = wx - Math.floor(wx / TITLE_ZLEN) * TITLE_ZLEN;
  return Math.max(0, Math.min(1, Math.min(u, TITLE_ZLEN - u) / 36));
};
// smooth value noise, about 0..1, one bump a unit (pure)
/** @param {number} x @param {number} y */
const h2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
/** @param {number} x @param {number} y */
export function titleNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// the zone at a point, with a ragged border: pushed up to ZBLEND either way by noise (big lumps and a
// fine fray), so one zone's rock, moss, bricks and back wall break up into the next instead of a cut
/** @param {number} wx @param {number} y */
export const titleZoneAt = (wx, y) => titleZone(wx + (titleNoise(wx / 24, y / 14) - 0.5) * 2 * ZBLEND + (titleNoise(wx / 4, y / 4) - 0.5) * 12);
// the cave's roof and floor as made (world x; B the band: top, bot in world units, under the title, over the menu).
// The timber works come down to TIMBER_H over the floor, the height of their frames
/** @param {number} wx @param {{ top: number, bot: number }} B */
export const titleCeil = (wx, B) => {
  const nat = B.top - 4 + Math.sin(wx * 0.018 + 6) * 10 + Math.sin(wx * 0.049 + 3) * 6 + Math.sin(wx * 0.11) * 2;
  // the layer's roof comes down in a short step, not a long slope (the level's shelves end in a rough edge)
  const bt = Math.max(0, Math.min(1, (built(wx, 'timber') - 0.2) / 0.35));
  const edge = bt > 0 && bt < 1 ? (titleNoise(wx / 3, 40) - 0.5) * 6 : 0;
  return bt ? nat + (Math.max(nat, titleFloor(wx, B) - TIMBER_H) - nat) * bt + edge : nat;
};
// a web line's point at fraction u: straight a0..b0, sagging in the middle (as world/sway.js webAt)
/** @param {TWeb} L @param {number} u */
export const titleWebAt = (L, u) => ({ x: L.a0x + (L.b0x - L.a0x) * u, y: L.a0y + (L.b0y - L.a0y) * u + 4 * u * (1 - u) * L.sag });
/** @param {number} wx @param {{ top: number, bot: number }} B */
export const titleFloor = (wx, B) => {
  const nat = B.bot - 22 + Math.sin(wx * 0.021 + 4) * 7 + Math.sin(wx * 0.057 + 2) * 4 + Math.sin(wx * 0.13) * 1.5;
  const b = built(wx);
  return nat * (1 - b) + (B.bot - 20) * b;
};

/** @param {TitleScene} S @param {number} c @param {number} r */
const ci = (S, c, r) => (((c % S.ncol) + S.ncol) % S.ncol) * S.rows + r;
/** @param {TitleScene} S @param {number} c @param {number} r @returns {number} the material, rock out of range */
export function titleCell(S, c, r) {
  if (r < 0) return TM.ROCK;
  if (r >= S.rows || c < S.gen - S.ncol || c >= S.gen) return r >= S.rows ? TM.ROCK : TM.AIR;
  return S.cells[ci(S, c, r)];
}
/** @param {TitleScene} S @param {number} sx screen x @param {number} y @returns {boolean} */
export const titleSolid = (S, sx, y) => !!SOLID[titleCell(S, Math.floor((sx + S.scroll) / TCELL), Math.floor(y / TCELL))];
// the first solid surface below (dir 1) or above (dir -1) a point; screen x
/** @param {TitleScene} S @param {number} sx @param {number} y @param {number} dir */
export function titleSurf(S, sx, y, dir) {
  const c = Math.floor((sx + S.scroll) / TCELL);
  let r = Math.floor(y / TCELL);
  for (let i = 0; i < S.rows + 2; i++, r += dir) if (SOLID[titleCell(S, c, r)]) return dir > 0 ? r * TCELL : (r + 1) * TCELL;
  return dir > 0 ? S.vh : 0;
}
/** @param {TitleScene} S @param {number} c0 @param {number} c1 @param {number} r0 @param {number} r1 */
function dirty(S, c0, c1, r0, r1) {
  if (S.dirty.length > 300) { S.dirtyAll = true; S.dirty.length = 0; }
  if (!S.dirtyAll) S.dirty.push([c0, c1, r0, r1]);
}

// make one terrain column (and the plants on it)
/** @param {TitleScene} S @param {number} c */
function genCol(S, c) {
  const wx = c * TCELL, z = titleZone(wx), b = built(wx), R = S.rnd;
  const cy = titleCeil(wx, S), fy = titleFloor(wx, S), base = ci(S, c, 0);
  // the built-up layers' timber frames, as strata.js timberFrame makes them: two posts (lit on the
  // left), a cap beam two rows deep running a little past them, a knee brace inside each post's top,
  // a footing under each post
  const u = ((wx % FRAME_GAP) + FRAME_GAP) % FRAME_GAP, uc = u > FRAME_GAP - 5 ? u - FRAME_GAP : u;
  const frame = z === 'timber' && uc < FRAME_W + 4 && built(wx - uc - 4) > 0.95 && built(wx - uc + FRAME_W + 4) > 0.95;   // whole frames only
  // moss patches on the floor (thicker moss, bright grass tufts on top), as decorate.js bakes them
  const patch = titleNoise(wx / 14, 11) > 0.52, tuft = patch && h2(c, 5) < 0.4 ? (h2(c, 6) < 0.4 ? 2 : 1) : 0;
  const mossDeep = 2 + (patch ? 1 + Math.floor(h2(c, 7) * 3) : 0);
  // rubble: a low mound of broken brick, moss over its top (decorate.js rubble), now and then on a floor
  const rk = Math.floor(wx / 60), rcx = rk * 60 + 10 + h2(rk, 1) * 40, rw = 6 + h2(rk, 2) * 6, rd = (wx - rcx) / rw;
  const rub = z !== 'paved' && h2(rk, 3) < 0.45 && Math.abs(rd) < 1 ? (2 + h2(rk, 4) * 2.5) * (1 - rd * rd) : 0;
  // a small brick ledge out in the air of a natural cave (the level's built ledges)
  const lk = Math.floor(wx / 90), lx0 = lk * 90 + 15 + h2(lk, 8) * 35, lw = 14 + h2(lk, 9) * 14;
  const lmid = lx0 + lw / 2, lc = titleCeil(lmid, S), lf = titleFloor(lmid, S), ly = lc + 14 + h2(lk, 10) * Math.max(0, lf - lc - 52);
  const ledge = (z === 'moss' || z === 'grove' || z === 'webs') && built(lmid) === 0 && h2(lk, 11) < 0.5 && wx >= lx0 && wx < lx0 + lw && lf - lc > 60;
  // the layers stack (strataCave): over the shelf you run under, another open band with its own frames
  const shelf = z === 'timber' && built(wx) > 0.9 ? 18 + titleNoise(wx / 20, 50) * 6 : 0, upBot = cy - shelf, upTop = upBot - 34;
  const fu = ((wx + FRAME_GAP / 2) % FRAME_GAP + FRAME_GAP) % FRAME_GAP, upPost = shelf && (fu < 4 || (fu >= FRAME_W - 4 && fu < FRAME_W));
  for (let r = 0; r < S.rows; r++) {
    const y = (r + 0.5) * TCELL, zc = titleZoneAt(wx, y);   // the skin (moss or bricks) frays at a border
    let m = TM.AIR;
    if (shelf && y >= upTop && y < upBot) m = upPost || (fu < FRAME_W + 4 && y < upTop + 4) ? TM.BEAMD : TM.AIR;
    else if (y < cy) m = TM.ROCK;
    else if (y >= fy) {
      m = TM.ROCK;
      if (zc === 'paved' && b > 0.3 && y < fy + 6) m = TM.BRICK;
      else if (y < fy + mossDeep * TCELL) m = TM.MOSS;
    } else if (ledge && y >= ly && y < ly + 4) m = TM.BRICK;
    else if (ledge && y >= ly - 2 && y < ly && tuft) m = TM.GRASS;
    else if (frame) {
      const under = y - cy, post = (uc >= 0 && uc < 4) || (uc >= FRAME_W - 4 && uc < FRAME_W);
      if (uc >= -4 && uc < FRAME_W + 4 && under < 4) m = under < 2 ? TM.BEAM : TM.BEAMD;
      else if (post) m = (uc < 2 || (uc >= FRAME_W - 4 && uc < FRAME_W - 2)) ? TM.BEAM : TM.BEAMD;
      else if ((uc >= 4 && uc <= 12 && Math.abs(under - 4 - (12 - uc)) < 1) || (uc >= FRAME_W - 12 && uc < FRAME_W - 4 && Math.abs(under - 4 - (uc - (FRAME_W - 12))) < 1)) m = TM.BEAMD;
      else if (y >= fy - 2 && ((uc >= -1 && uc < 5) || (uc >= FRAME_W - 5 && uc < FRAME_W + 1))) m = TM.BEAMD;
    }
    if (m === TM.AIR && y >= fy - rub && y < fy) m = y < fy - rub + 2 && h2(c, r) < 0.7 ? TM.RUBM : TM.RUB;
    if (m === TM.AIR && y >= fy - tuft * TCELL && y < fy && zc !== 'paved') m = TM.GRASS;
    S.cells[base + r] = m;
  }
  // a lantern hanging on its chain under the layers' roof: between the frames, and some inside them
  if (z === 'timber' && built(wx) > 0.95 && (Math.abs(u - (FRAME_W + FRAME_GAP) / 2) < 1 || Math.abs(u - FRAME_W / 2) < 1) && R() < 0.75)
    S.props.push({ k: 'lamp', st: 'hanglamp', wx, x: 0, y: cy + 4, len: 4 + R() * 8, seed: R(), side: 1, burn: 0, ac: c, ar: Math.floor((cy - 1) / TCELL) });
  // and in the band above, and down long chains from the brick works' high roof
  if (shelf && Math.abs(fu - FRAME_W / 2) < 1 && R() < 0.6)
    S.props.push({ k: 'lamp', st: 'hanglamp', wx, x: 0, y: upTop + 4, len: 3 + R() * 6, seed: R(), side: 1, burn: 0, ac: c, ar: Math.floor((upTop - 1) / TCELL) });
  if (z === 'paved' && built(wx) > 0.9 && Math.abs(u - FRAME_GAP / 2) < 1 && R() < 0.8)
    S.props.push({ k: 'lamp', st: 'hanglamp', wx, x: 0, y: cy, len: 14 + R() * 30, seed: R(), side: 1, burn: 0, ac: c, ar: Math.floor((cy - 1) / TCELL) });
  // the spiders' zone: web lines everywhere, roof to floor (slanting either way) and roof to roof (sagging)
  if (z === 'webs' && b === 0 && !(c % 4) && R() < 0.42 && S.webs.length < TITLE_WEBS) {
    const down = R() < 0.55, bx = down ? wx + (R() - 0.35) * 70 : wx + 18 + R() * 44;
    const L = { a0x: wx, a0y: cy + 0.5, b0x: bx, b0y: down ? titleFloor(bx, S) - 0.5 : titleCeil(bx, S) + 0.5, sag: 0 };
    L.sag = DEV.webSag * Math.abs(L.b0x - L.a0x) * (down ? 1 : 2.5);
    S.webs.push(L);
  }
  // plants: vines, mycelium and roots under the roof, bouncy mushrooms on the floor
  // the grove: a curtain of long vines, every other column, some down near the floor (thick in its
  // middle, thinning to its ends)
  const nat = 1 - b, grove = z === 'grove';
  // the grove's vine arches (decorate.js arches, drawn by art/props.js drawArch): roof to roof, sagging,
  // thick with leaves, strands hanging off them
  const zu = wx - Math.floor(wx / TITLE_ZLEN) * TITLE_ZLEN;
  // A cluster every 80: the arch knobs' (ARCH_KNOBS) arches per cluster, span (capped to the screen), sag
  // (slack), stems, strands per 10 px and their length, and open air under each (else it hangs less)
  if (grove && zu > 20 && zu < TITLE_ZLEN - 90 && ((wx % 80) + 80) % 80 < TCELL) {
    const na = Math.max(1, Math.round(kru('arCluster', R())));
    for (let a = 0; a < na; a++) {
      const ax = wx + (R() - 0.3) * 60, span = Math.min(170, kru('arSpan', R()) * TCELL), bx = ax + span;
      const ay = titleCeil(ax, S) + 1, by = titleCeil(bx, S) + 1, n = Math.max(8, Math.min(40, Math.round(span / 6)));
      let slack = kru('arSlack', R()), pts = archCurve(ax, ay, bx, by, slack, n);
      const clear = kru('arClear', R()) * TCELL, low = () => pts.reduce((m, p) => (p.y > m.y ? p : m), pts[0]);
      for (let k = 0; k < 4 && titleFloor(low().x, S) - low().y < clear + PH; k++) { slack = 1 + (slack - 1) * 0.6; pts = archCurve(ax, ay, bx, by, slack, n); }
      if (titleFloor(low().x, S) - low().y < clear) continue;
      const arch = { k: 'climb', st: 'vine', wx: ax, x: 0, y: ay, len: 0, seed: R(), side: 1, burn: 0, ac: Math.floor(ax / TCELL), ar: Math.floor((ay - 2) / TCELL),
        arc: pts.map(p => [p.x - ax, p.y - ay]), thick: Math.round(kru('arThick', R())), t: R() * 10, span };
      S.props.push(arch);
      let alen = 0;
      for (let k = 0; k < n; k++) alen += Math.hypot(pts[k + 1].x - pts[k].x, pts[k + 1].y - pts[k].y);
      const ns = Math.round(kru('arStrands', R()) * alen / (10 * TCELL));
      for (let s = 0; s < ns; s++) {
        const q = pts[Math.min(n - 1, Math.floor(R() * n))], room = titleFloor(q.x, S) - q.y;
        const len = Math.min(kru('arStrandLen', R()) * TCELL, room * 0.7);
        if (len >= 4) S.props.push({ k: 'climb', st: 'vine', wx: q.x, x: 0, y: q.y, len, seed: R(), side: 1, burn: 0, ac: arch.ac, ar: arch.ar, host: arch });
      }
    }
  }
  if (grove && !(c % 2)) {
    const mid = Math.min(1, Math.min(zu, TITLE_ZLEN - zu) / 70);
    if (R() < 0.12 + 0.2 * mid) {
      const room = fy - cy, st = R() < 0.82 ? 'vine' : R() < 0.5 ? 'root' : 'myc';
      S.props.push({ k: 'climb', st, wx, x: 0, y: cy, len: room * (0.2 + R() * (0.35 + 0.45 * mid)), seed: R(), side: 1, burn: 0,
        ac: c, ar: Math.floor((cy - 1) / TCELL) });
      return;
    }
  }
  if (c % 3) return;
  const p = R();
  if (!grove && p < (z === 'moss' ? 0.2 : 0.04) * Math.max(nat, 0.2)) {
    const st = R() < 0.5 ? 'vine' : R() < 0.5 ? 'myc' : 'root';
    S.props.push({ k: 'climb', st, wx, x: 0, y: cy, len: 10 + R() * (z === 'moss' ? 40 : 24), seed: R(), side: 1, burn: 0,
      ac: c, ar: Math.floor((cy - 1) / TCELL) });
  } else if (z === 'paved' && b > 0.5 && p < 0.08) {
    S.props.push({ k: 'climb', st: 'chain', wx, x: 0, y: cy, len: 8 + R() * 16, seed: R(), side: 1, burn: 0, ac: c, ar: Math.floor((cy - 1) / TCELL) });
  } else if (nat > 0.5 && R() < (grove ? 0.09 : 0.04)) {
    S.props.push({ k: 'pad', st: '', wx, x: 0, y: fy, len: 0, seed: R(), side: 1, burn: 0, ac: c, ar: Math.floor((fy + 1) / TCELL) });
  }
}

/** @param {number} vh the view's height in world units @param {number} [seed] @param {number} [top] the action's band (world units) @param {number} [bot] @returns {TitleScene} */
export function titleScene(vh, seed = 7, top = vh * 0.3, bot = vh * 0.62) {
  const rnd = titleRng(seed), rows = Math.ceil(vh / TCELL) + 1, ncol = Math.ceil((TITLE_VW + 90) / TCELL);
  /** @type {TitleScene} */
  const S = { t: 0, vh, top, bot, seed, rnd, scroll: 0, shake: 0, spawn: 0, kills: 0, gold: 0, got: 0, runner: null, foes: [], shots: [],
    parts: [], nuggets: [], booms: [], zaps: [], flash: 0, rows, ncol, cells: new Uint8Array(rows * ncol), gen: -25, props: [],
    fire: [], dirty: [], dirtyAll: true, carved: 0, burnt: 0, swaps: 0, groundT: 0, flyT: 0, kinds: {}, webs: [], cut: 0, lineT: 0 };
  genTo(S);
  const x = 60, y = titleSurf(S, x + PW / 2, (top + bot) / 2, 1) - PH;
  S.runner = { x, y, vx: 0, vy: 0, face: 1, ang: 0, cd: 0.5, kit: 0, flame: 0, mode: 'run', modeT: 3, tx: x, ty: y, retarget: 0,
    gait: 0, ground: true, swapT: 4, swap: 0 };
  for (let i = 0; i < 3; i++) addFoe(S, 140 + rnd() * 70);
  return S;
}
/** @param {TitleScene} S */
function genTo(S) {
  while (S.gen * TCELL < S.scroll + TITLE_VW + 40) { genCol(S, S.gen); S.gen++; }
}

/** @param {TitleScene} S @param {number} [x] */
function addFoe(S, x) {
  const R = S.rnd, sx = x === undefined ? TITLE_VW + 16 : x;
  // only what lives in the zone it comes into (TITLE_HOME, weighted)
  const home = TITLE_HOME[titleZone(sx + S.scroll)];
  let roll = R() * home.reduce((a, h) => a + h[1], 0), k = home[0][0];
  for (const [q, w] of home) { if (roll < w) { k = q; break; } roll -= w; }
  const C = CREATURES[k];
  S.kinds[k] = (S.kinds[k] || 0) + 1;
  if (k === 'rotta') {
    // a swarm: several running along the floor together
    const n = 3 + Math.floor(R() * 4), v = -(30 + R() * 25);
    for (let i = 0; i < n && S.foes.length < TITLE_FOES; i++) {
      S.foes.push({ x: sx + i * (7 + R() * 6), y: 0, vx: v * (0.9 + R() * 0.2), vy: 0, r: C.r, hp: 1, k, flash: 0, phase: R() * 6.28, cd: 0, surf: 1,
        br: { mode: 'surf', nx: 0, ny: -1, face: -1, on: 1 } });
    }
    return;
  }
  if (k === 'hamahakki') {
    // two or three, each on a web line near where they come in, else walking the floor or the roof
    const wx = sx + S.scroll, on = S.webs.filter(L => Math.abs((L.a0x + L.b0x) / 2 - wx) < 50);
    const n = 2 + Math.floor(R() * 2);
    for (let i = 0; i < n && S.foes.length < TITLE_FOES; i++) {
      const L = on.length ? on[Math.floor(R() * on.length)] : null, surf = R() < 0.5 ? 1 : -1;
      const f = { x: sx + i * 12, y: 0, vx: 0, vy: 0, r: C.r, hp: 4, k, flash: 0, phase: R() * 6.28, cd: 0, surf,
        spd: 12 + R() * 12, L, u: 0.15 + R() * 0.7, walkT: 1 + R() * 2,
        br: { mode: L ? 'line' : 'surf', line: null, dir: R() < 0.5 ? 1 : -1, nx: 0, ny: surf > 0 ? -1 : 1, side: -1, on: 1 } };
      if (!L) f.vx = -f.spd;
      S.foes.push(f);
    }
    return;
  }
  // a jellyfish: its tentacles as the game makes them (the jellyfish knobs: how many, points, length, sway, droop)
  const u = { col: R(), sq: R(), len: R(), wave: R(), sag: R(), thin: R(), glow: R(), glowR: R(), flare: R(), plant: R() }, tent = [];
  const nt = Math.round(kru('jeTents', R())), nv = Math.max(2, Math.round(kru('jeVerts', R())));
  for (let i = 0; i < nt; i++) { const T = []; for (let j = 0; j < nv; j++) T.push({ x: NaN, y: NaN }); tent.push(T); }
  S.foes.push({ x: sx, y: S.top + (S.bot - S.top) * (0.1 + 0.4 * R()), vx: -(14 + R() * 18), vy: 0, r: C.r * (0.9 + R() * 0.3), hp: 3, k,
    flash: 0, phase: R() * 6.28, cd: 1 + R() * 2, surf: 0,
    br: { hd: Math.PI, shape: 0, pulse: R() * 1.2, tent, u, t: R() * 10 } });
}

/** @param {TitleScene} S @param {number} x @param {number} y @param {number} n @param {string} col @param {number} spd @param {string} kind @param {number} life */
function burst(S, x, y, n, col, spd, kind, life) {
  for (let i = 0; i < n && S.parts.length < TITLE_PARTS; i++) {
    const a = S.rnd() * Math.PI * 2, v = spd * (0.25 + S.rnd());
    const l = life * (0.5 + S.rnd() * 0.7);
    S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (kind === 'smoke' ? 20 : 0), life: l, max: l,
      r: kind === 'smoke' ? 3 + S.rnd() * 4 : kind === 'fire' ? 1.5 + S.rnd() * 2.5 : 0.6 + S.rnd() * 0.8, col, kind });
  }
}

// blow a hole: every cell within r of (sx, y) goes, the rock round its rim chars, plants on it fall
/** @param {TitleScene} S @param {number} sx @param {number} y @param {number} r */
export function titleCarve(S, sx, y, r) {
  const wx = sx + S.scroll, c0 = Math.floor((wx - r - 2) / TCELL), c1 = Math.floor((wx + r + 2) / TCELL);
  const r0 = Math.max(0, Math.floor((y - r - 2) / TCELL)), r1 = Math.min(S.rows - 1, Math.floor((y + r + 2) / TCELL));
  let n = 0;
  for (let c = Math.max(c0, S.gen - S.ncol); c <= Math.min(c1, S.gen - 1); c++) for (let rr = r0; rr <= r1; rr++) {
    const d = Math.hypot((c + 0.5) * TCELL - wx, (rr + 0.5) * TCELL - y), i = ci(S, c, rr), m = S.cells[i];
    if (d <= r) { if (m !== TM.AIR) { S.cells[i] = TM.AIR; n++; } } else if (d <= r + 2 && SOLID[m] && m !== TM.CHAR) S.cells[i] = TM.CHAR;
  }
  if (n) {
    S.carved += n;
    dirty(S, c0, c1, r0, r1);
    burst(S, sx, y, Math.min(8, n), '#7a6a5a', 70, 'chunk', 0.8);
  }
  cutWebs(S, wx, y, r);
  return n;
}
// set alight everything that burns within r: fuel cells and plants
/** @param {TitleScene} S @param {number} sx @param {number} y @param {number} r */
export function titleIgnite(S, sx, y, r) {
  const wx = sx + S.scroll, c0 = Math.floor((wx - r) / TCELL), c1 = Math.floor((wx + r) / TCELL);
  const r0 = Math.max(0, Math.floor((y - r) / TCELL)), r1 = Math.min(S.rows - 1, Math.floor((y + r) / TCELL));
  for (let c = Math.max(c0, S.gen - S.ncol); c <= Math.min(c1, S.gen - 1); c++) for (let rr = r0; rr <= r1; rr++)
    if (Math.hypot((c + 0.5) * TCELL - wx, (rr + 0.5) * TCELL - y) <= r) light(S, c, rr);
  for (const p of S.props) if (!p.burn && p.st !== 'chain' && p.k !== 'lamp' && near(p, wx, y, r)) { p.burn = 1.4; S.burnt++; }
  cutWebs(S, wx, y, r);
}
/** @param {TProp} p @param {number} wx @param {number} y @param {number} r */
const near = (p, wx, y, r) => p.arc ? p.arc.some(q => Math.hypot(p.wx + q[0] - wx, p.y + q[1] - y) < r + 3)
  : Math.abs(p.wx - wx) < r + 4 && y > Math.min(p.y, p.y + (p.k === 'pad' ? -9 : p.len)) - r && y < Math.max(p.y, p.y + (p.k === 'pad' ? 0 : p.len)) + r;
/** @param {TitleScene} S @param {number} c @param {number} r */
function light(S, c, r) {
  if (S.fire.length >= TITLE_FIRE || c < S.gen - S.ncol || c >= S.gen || r < 0 || r >= S.rows) return;
  const i = ci(S, c, r);
  if (!FUEL[S.cells[i]] || S.fire.some(f => f.c === c && f.r === r)) return;
  S.fire.push({ c, r, t: 0.6 + S.rnd() * 0.8 });
  S.burnt++;
}

/** @param {TitleScene} S @param {TFoe} f */
function killFoe(S, f) {
  f.hp = 0;
  S.kills++;
  const big = f.k !== 'rotta';
  S.booms.push({ x: f.x, y: f.y, r: f.r * (big ? 3 : 1.6), t: 0, max: 0.4 });
  burst(S, f.x, f.y, big ? 22 : 8, '#ffd27a', 110, 'fire', 0.55);
  burst(S, f.x, f.y, 8, '#ffffff', 190, 'spark', 0.3);
  burst(S, f.x, f.y, big ? 6 : 2, '#3a3346', 30, 'smoke', 1.3);
  burst(S, f.x, f.y, 5, CREATURES[f.k].col.a, 90, 'chunk', 0.9);
  if (big) { S.shake = Math.min(7, S.shake + 3); S.flash = Math.min(0.35, S.flash + 0.15); }
  const n = (big ? 5 : 2) + Math.floor(S.rnd() * (big ? 6 : 2));
  for (let i = 0; i < n && S.nuggets.length < TITLE_GOLD; i++) {
    const a = -Math.PI / 2 + (S.rnd() - 0.5) * 2.2, v = 60 + S.rnd() * 90;
    S.nuggets.push({ x: f.x, y: f.y, vx: Math.cos(a) * v + f.vx, vy: Math.sin(a) * v, r: 1.2 + S.rnd() * 1.3, seed: S.rnd() * 99,
      ang: S.rnd() * 6, spin: (S.rnd() - 0.5) * 14, life: 6, ground: false, pull: 0.5 + S.rnd() * 0.5 });
    S.gold++;
  }
}

/** @param {TitleScene} S @param {TFoe} f @param {number} dmg @param {string} col */
function hitFoe(S, f, dmg, col) {
  if (f.hp <= 0) return;
  f.hp -= dmg; f.flash = 0.08;
  burst(S, f.x, f.y, 4, col, 80, 'spark', 0.25);
  if (f.hp <= 0) killFoe(S, f);
}

// a shot ends: blows up (a hole, fire), digs its pit, or sets things alight, as its mod does in the game
/** @param {TitleScene} S @param {TShot} s */
function shotEnd(S, s) {
  s.life = 0;
  if (s.explode) {
    const r = s.explode * 0.42;
    S.booms.push({ x: s.x, y: s.y, r: r * 1.6, t: 0, max: 0.38 });
    burst(S, s.x, s.y, 14, '#ffb02e', 90, 'fire', 0.5);
    burst(S, s.x, s.y, 4, '#3a3346', 25, 'smoke', 1.2);
    S.shake = Math.min(7, S.shake + 2);
    titleCarve(S, s.x, s.y, r);
    for (const g of S.foes) if (Math.hypot(g.x - s.x, g.y - s.y) < r + g.r) hitFoe(S, g, 4, s.col);
  } else if (s.pit) titleCarve(S, s.x, s.y, s.pit * 0.7);
  // fire reaches past a blast's charred rim, into the moss, timber and plants round it
  if (s.fire || s.explode) titleIgnite(S, s.x, s.y, (s.fire ? 7 : 0) + (s.explode ? s.explode * 0.42 + 5 : 0));
  burst(S, s.x, s.y, 3, s.col, 50, 'spark', 0.25);
}

/** @param {TitleScene} S @param {number} dt seconds */
export function titleStep(S, dt) {
  dt = Math.min(dt, 0.05);
  const R = S.rnd;
  S.t += dt; S.scroll += SCROLL * dt;
  genTo(S);
  S.shake = Math.max(0, S.shake - dt * 18);
  S.flash = Math.max(0, S.flash - dt * 1.6);
  S.spawn -= dt;
  if (S.spawn <= 0 && S.foes.length < TITLE_FOES - 5) { addFoe(S); S.spawn = 0.8 + R() * 1.2; }
  stepRunner(S, dt);
  stepFoes(S, dt);
  stepShots(S, dt);
  stepFire(S, dt);
  // the natural caves' ambience, as the level has it: water dripping from the roof, luminescent spores drifting
  if (S.parts.length < TITLE_PARTS - 40) {
    if (R() < dt * 3) {
      const x = R() * TITLE_VW, wx = x + S.scroll;
      if (built(wx) === 0) S.parts.push({ x, y: titleCeil(wx, S) + 1.5, vx: 0, vy: 0, life: 4, max: 4, r: 1, col: '#7ab8ff', kind: 'drip' });
    }
    if (R() < dt * 5) {
      const x = R() * TITLE_VW, wx = x + S.scroll, l = 5 + R() * 3;
      if (built(wx) === 0) S.parts.push({ x, y: titleCeil(wx, S) + 10 + R() * (titleFloor(wx, S) - titleCeil(wx, S) - 20), vx: (R() - 0.5) * 8, vy: -2 - R() * 3,
        life: l, max: l, r: 1.3, col: 'rgb(' + THEMES[0].moss[1].join(',') + ')', kind: 'spore' });
    }
  }
  // particles
  for (const p of S.parts) {
    p.life -= dt;
    if (p.kind === 'drip') {
      // falls with the rock (the scroll carries it), until it lands: a splash
      p.vy += GRAV * dt; p.y += p.vy * dt; p.x -= SCROLL * dt;
      if (titleSolid(S, p.x, p.y + 1)) { p.life = 0; burst(S, p.x, p.y, 2, '#7ab8ff', 25, 'spark', 0.2); }
      continue;
    }
    if (p.kind === 'spore') { p.x += (p.vx + Math.sin(S.t * 1.7 + p.max * 9) * 3 - SCROLL) * dt; p.y += p.vy * dt; continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    const drag = p.kind === 'smoke' ? 1.5 : 3;
    p.vx -= p.vx * drag * dt; p.vy -= p.vy * drag * dt;
    if (p.kind === 'chunk') p.vy += GRAV * 0.6 * dt;
    if (p.kind === 'fire') p.vy -= 30 * dt;
    p.x -= (p.kind === 'smoke' || p.kind === 'chunk' ? SCROLL * 0.5 : 0) * dt;
  }
  S.parts = S.parts.filter(p => p.life > 0);
  // the gold: flies, falls, bounces, then the runner's vacuum pulls it in
  const ru = S.runner, hx = ru.x + PW / 2, hy = ru.y + PH * 0.5;
  for (const g of S.nuggets) {
    g.life -= dt; g.pull -= dt; g.ang += g.spin * dt;
    if (g.pull <= 0) {
      const dx = hx - g.x, dy = hy - g.y, d = Math.hypot(dx, dy) || 1, v = Math.min(420, 60 + -g.pull * 500);
      g.x += dx / d * Math.min(d, v * dt); g.y += dy / d * Math.min(d, v * dt);
      if (d < 4) { g.life = 0; S.got++; if (S.parts.length < TITLE_PARTS) burst(S, g.x, g.y, 1, '#ffe27a', 30, 'spark', 0.2); }
      continue;
    }
    g.vy += GRAV * dt; g.x += g.vx * dt - SCROLL * dt * (g.ground ? 1 : 0); g.y += g.vy * dt;
    const fl = titleSurf(S, g.x, g.y - 3, 1) - g.r;
    if (g.y > fl && fl - g.y > -6) { g.y = fl; g.vy *= -0.45; g.vx *= 0.6; if (Math.abs(g.vy) < 25) { g.ground = true; g.vy = 0; } }
  }
  S.nuggets = S.nuggets.filter(g => g.life > 0 && g.x > -20);
  for (const b of S.booms) b.t += dt;
  S.booms = S.booms.filter(b => b.t < b.max);
  for (const z of S.zaps) z.t -= dt;
  S.zaps = S.zaps.filter(z => z.t > 0);
  // plants whose rock is gone fall away; burnt ones crumble
  for (const p of S.props) {
    p.x = p.wx - S.scroll;
    if (p.burn > 0) {
      p.burn -= dt;
      if (R() < dt * 14) burst(S, p.x + (R() - 0.5) * 3, p.k === 'pad' ? p.y - R() * 8 : p.y + R() * p.len, 1, '#ff9a2e', 15, 'fire', 0.5);
      if (R() < dt * 4) titleIgnite(S, p.x, p.k === 'pad' ? p.y : p.y + R() * p.len, 4);
      if (p.burn <= 0) p.burn = -1;
    }
    if (p.burn === 0 && p.host && p.host.burn !== 0) { p.burn = Math.max(0.3, p.host.burn); S.burnt++; }   // its arch burns: the strand goes with it
    if (p.burn === 0 && p.x > -10 && p.x < TITLE_VW + 10 && !SOLID[titleCell(S, p.ac, p.ar)]) { p.burn = -1; burst(S, p.x, p.y, 3, '#5a8a3a', 40, 'chunk', 0.7); }
  }
  S.props = S.props.filter(p => p.burn !== -1 && p.wx + (p.span || 0) - S.scroll > -60);
  S.webs = S.webs.filter(L => Math.max(L.a0x, L.b0x) - S.scroll > -40);
}

/** @param {TitleScene} S @param {number} dt */
function stepRunner(S, dt) {
  const r = S.runner, R = S.rnd, cx = () => r.x + PW / 2;
  r.modeT -= dt;
  const ground = titleSurf(S, cx(), r.y + PH - 9, 1);
  if (r.mode === 'run') {
    S.groundT += dt;
    r.flame = 0;
    // run along the floor (the world scrolls under him: he keeps pace, drifting about the left half)
    r.retarget -= dt;
    if (r.retarget <= 0) { r.tx = 25 + R() * 80; r.retarget = 1 + R() * 1.5; }
    const vx = Math.max(-26, Math.min(26, (r.tx - r.x) * 1.2));
    r.x += vx * dt;
    r.gait += (SCROLL + vx) * dt * 0.38;
    if (ground < r.y + PH - 8) { r.mode = 'fly'; r.modeT = 2 + R() * 2; r.vy = -40; r.ground = false; return; }
    if (ground > r.y + PH + 1.5) {                       // a hole: he drops into it
      r.vy += GRAV * dt; r.y += r.vy * dt; r.ground = false;
      if (r.y + PH >= ground) { r.y = ground - PH; r.vy = 0; r.ground = true; }
    } else { r.y = ground - PH; r.vy = 0; r.ground = true; }
    // a wall ahead too tall to step up, a deep hole, or his time's up: up he goes (not on time
    // under the timber works' low roof: he runs them)
    const ahead = titleSurf(S, cx() + 6, r.y + PH - 9, 1), low = built(cx() + S.scroll + 40, 'timber') > 0;
    if (low && r.modeT <= 0) r.modeT = 0.5;
    if (r.modeT <= 0 || ahead < r.y + PH - 7 || ground - (r.y + PH) > 20) {
      r.mode = 'fly'; r.modeT = 2.2 + R() * 2; r.retarget = 0; r.vy = -40; r.ground = false;
    }
  } else {
    S.flyT += dt;
    r.retarget -= dt;
    const land = r.modeT <= 0 || built(cx() + S.scroll + 30, 'timber') > 0;   // the timber works coming: down he comes
    if (!land && (r.retarget <= 0 || Math.hypot(r.tx - r.x, r.ty - r.y) < 6)) {
      r.tx = 20 + R() * (TITLE_VW * 0.5); r.ty = S.top + (S.bot - S.top) * (0.02 + R() * 0.45); r.retarget = 0.8 + R() * 1.4;
    }
    if (land) { r.tx = r.x; r.ty = ground - PH + 2; }
    const ax = (r.tx - r.x) * 2.2 - r.vx * 1.6, ay = (r.ty - r.y) * (land ? 1.2 : 2.2) - r.vy * 1.6;
    r.vx += ax * dt; r.vy += ay * dt;
    r.x += r.vx * dt; r.y += r.vy * dt;
    r.flame = Math.max(0, Math.min(1, -ay / 60 + (land ? 0.1 : 0.35)));
    const roof = titleSurf(S, cx(), r.y + 6, -1);
    if (r.y < roof) { r.y = roof; r.vy = Math.abs(r.vy) * 0.3; }
    const g2 = titleSurf(S, cx(), r.y + PH - 9, 1);
    if (r.y + PH > g2 && g2 >= r.y + PH - 8) { r.y = g2 - PH; r.vy = 0; if (land) { r.mode = 'run'; r.modeT = 2.5 + R() * 2.5; r.vx = 0; r.ground = true; r.retarget = 0; } }
    if (land && r.modeT < -3) { r.mode = 'run'; r.modeT = 2.5 + R() * 2.5; r.y = g2 - PH; }
    r.ground = r.mode === 'run';
  }
  r.x = Math.max(8, Math.min(TITLE_VW * 0.62, r.x));
  // aim at the nearest creature
  let best = null, bd = 1e9;
  for (const f of S.foes) { const d = Math.hypot(f.x - r.x, f.y - r.y); if (f.hp > 0 && f.x < TITLE_VW + 5 && f.x > cx() - 30 && d < bd) { bd = d; best = f; } }
  const gx0 = cx(), gy0 = r.y + PH * 0.45;
  if (best) {
    const want = Math.atan2(best.y - gy0, best.x - gx0);
    let d = want - r.ang; d = Math.atan2(Math.sin(d), Math.cos(d));
    r.ang += d * Math.min(1, dt * 10);
  } else r.ang += (0 - r.ang) * Math.min(1, dt * 4);
  r.face = Math.cos(r.ang) >= 0 ? 1 : -1;
  // every few seconds: another gun
  r.swapT -= dt; r.swap = Math.max(0, r.swap - dt);
  if (r.swapT <= 0) {
    r.kit = (r.kit + 1 + Math.floor(R() * (TITLE_KITS.length - 1))) % TITLE_KITS.length;
    r.swapT = 3.5 + R() * 2.5; r.swap = 0.3; r.cd = 0.35; S.swaps++;
  }
  r.cd -= dt;
  if (!best || r.cd > 0 || r.swap > 0) return;
  const K = TITLE_KITS[r.kit], M = MODS[K.mod], gx = gx0 + Math.cos(r.ang) * 10, gy = gy0 + Math.sin(r.ang) * 10;
  r.cd = K.cd * (0.85 + R() * 0.3);
  if (K.mod === 'zap') {
    // lightning: an arc into the creature, and one throwing off into the rock below it
    zapArc(S, gx, gy, best.x, best.y, M.col);
    const fl = titleSurf(S, best.x, best.y + best.r, 1);
    if (fl - best.y < 50 && R() < 0.6) { zapArc(S, best.x, best.y, best.x + (R() - 0.5) * 16, fl + 1, M.col); titleCarve(S, best.x, fl + 1, 2.5); titleIgnite(S, best.x, fl + 1, 4); }
    hitFoe(S, best, 3, M.col);
    return;
  }
  const n = M.count || 1;
  for (let i = 0; i < n; i++) {
    const spread = (M.spread || 0) * Math.PI / 180;
    const a = r.ang + (n > 1 ? (i / (n - 1) - 0.5) * spread * 2 : (R() - 0.5) * spread);
    const v = (M.speed || 300) * SP * (0.9 + R() * 0.2);
    S.shots.push({ x: gx, y: gy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: M.size || 2, col: M.col, look: M.look || '', life: (M.life || 1) * 1.6,
      foe: false, spin: R() * 6, grav: (M.grav || 0) * SP, drag: M.drag || 0, explode: M.explode || 0, pit: M.pit || 0, fire: M.fire || 0,
      bounce: M.bounce || 0, bounceE: M.bounceE || 0.5, pierce: M.pierce || 0, dmg: M.dmg || 1 });
  }
  burst(S, gx, gy, 3, M.col, 40, 'spark', 0.12);
}

// a lightning arc from one point to another (drawn with the game's drawBolt)
/** @param {TitleScene} S @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @param {string} col */
function zapArc(S, x0, y0, x1, y1, col) {
  const R = S.rnd, pts = [{ x: x0, y: y0 }];
  for (let i = 1; i < 7; i++) { const k = i / 7; pts.push({ x: x0 + (x1 - x0) * k + (R() - 0.5) * 9, y: y0 + (y1 - y0) * k + (R() - 0.5) * 9 }); }
  pts.push({ x: x1, y: y1 });
  S.zaps.push({ pts, t: 0.16, col });
}

// a spider: walks its web lines and the rock (floor or roof, upside down), stop-start; at a line's
// end it steps off onto the rock there, and from the rock onto the next line that starts near it.
// A cut line drops it: it falls to the floor and walks on
/** @param {TitleScene} S @param {TFoe} f @param {number} dt */
function stepSpider(S, f, dt) {
  const R = S.rnd, b = f.br, go = Math.sin(S.t * 1.4 + f.phase) > -0.35 ? 1 : 0, spd = (f.spd || 16) * go;
  b.on = go;
  if (b.mode === 'line' && f.L && S.webs.indexOf(f.L) < 0) { b.mode = 'fall'; f.L = null; f.vy = 0; }
  if (b.mode === 'line' && f.L) {
    const L = f.L, len = Math.hypot(L.b0x - L.a0x, L.b0y - L.a0y) || 1;
    f.u = Math.max(0, Math.min(1, (f.u || 0) + b.dir * spd * dt / len));
    const p = titleWebAt(L, f.u);
    f.x = p.x - S.scroll; f.y = p.y;
    b.line = { ax: L.a0x - S.scroll, ay: L.a0y, bx: L.b0x - S.scroll, by: L.b0y };
    S.lineT += dt;
    if ((f.u >= 1 && b.dir > 0) || (f.u <= 0 && b.dir < 0)) {
      // the end: onto the rock there, the floor or the roof (whichever the end is nearer)
      const ey = f.u >= 1 ? L.b0y : L.a0y;
      f.surf = Math.abs(ey - titleFloor(f.x + S.scroll, S)) < Math.abs(ey - titleCeil(f.x + S.scroll, S)) ? 1 : -1;
      b.mode = 'surf'; f.L = null; f.walkT = 1 + R() * 2;
      f.vx = (R() < 0.5 ? -1 : 1) * (f.spd || 16);
    }
    return;
  }
  if (b.mode === 'fall') {
    f.vy += GRAV * dt; f.y += f.vy * dt; f.x -= SCROLL * dt;
    const fl = titleSurf(S, f.x, f.y - 2, 1);
    if (f.y + f.r * 0.9 >= fl) { f.y = fl - f.r * 0.9; b.mode = 'surf'; f.surf = 1; f.vx = -(f.spd || 16); f.walkT = 0.5 + R(); }
    return;
  }
  // on the rock: walk (world-anchored, so the scroll carries it), then look for a line that starts here
  f.x += (f.vx * go - SCROLL) * dt;
  const s = surfAt(S, f.x, f.surf);
  f.y = s - f.surf * f.r * 0.9;
  b.nx = 0; b.ny = f.surf > 0 ? -1 : 1; b.side = f.vx < 0 ? -1 : 1;
  f.walkT = (f.walkT || 0) - dt;
  if (f.walkT > 0) return;
  const wx = f.x + S.scroll;
  let best = null, bd = 9;
  for (const L of S.webs) for (const end of [0, 1]) {
    const ex = end ? L.b0x : L.a0x, ey = end ? L.b0y : L.a0y, d = Math.abs(ex - wx);
    if (d < bd && Math.abs(ey - f.y) < f.r + 6) { bd = d; best = { L, end }; }
  }
  if (best) { f.L = best.L; f.u = best.end; b.dir = best.end ? -1 : 1; b.mode = 'line'; }
  else {
    // none here: head for the nearest one on this side, a little way off
    let tx = null, td = 70;
    for (const L of S.webs) for (const end of [0, 1]) {
      const ex = end ? L.b0x : L.a0x, ey = end ? L.b0y : L.a0y, d = Math.abs(ex - wx);
      if (d < td && Math.abs(ey - f.y) < f.r + 6) { td = d; tx = ex; }
    }
    if (tx != null) f.vx = Math.sign(tx - wx) * (f.spd || 16);
    f.walkT = 0.3;
  }
}
// the floor (surf 1) or roof (-1) under or over a creature at screen x: searched from just inside the
// cave as made there, so the timber works' low roof doesn't trap it in the rock
/** @param {TitleScene} S @param {number} x @param {number} surf */
function surfAt(S, x, surf) {
  const wx = x + S.scroll;
  return surf > 0 ? titleSurf(S, x, titleFloor(wx, S) - 10, 1) : titleSurf(S, x, titleCeil(wx, S) + 10, -1);
}
// blasts and fire cut the web lines they touch
/** @param {TitleScene} S @param {number} wx @param {number} y @param {number} r */
function cutWebs(S, wx, y, r) {
  const before = S.webs.length;
  S.webs = S.webs.filter(L => {
    const vx = L.b0x - L.a0x, vy = L.b0y - L.a0y, ll = vx * vx + vy * vy || 1;
    const u = Math.max(0, Math.min(1, ((wx - L.a0x) * vx + (y - L.a0y) * vy) / ll)), p = titleWebAt(L, u);
    return Math.hypot(p.x - wx, p.y - y) > r + 1.5;
  });
  if (S.webs.length < before) { S.cut += before - S.webs.length; burst(S, wx - S.scroll, y, 3, '#eef0f6', 40, 'spark', 0.3); }
}

/** @param {TitleScene} S @param {number} dt */
function stepFoes(S, dt) {
  const R = S.rnd, ru = S.runner;
  for (const f of S.foes) {
    f.flash = Math.max(0, f.flash - dt);
    if (f.k === 'hamahakki') { stepSpider(S, f, dt); continue; }
    if (f.surf) {
      // spiders and rats: along the floor (or a spider upside-down on the roof), carried by the scroll
      f.x += (f.vx - SCROLL) * dt;
      const s = surfAt(S, f.x, f.surf);
      f.y = s - f.surf * f.r * (f.k === 'rotta' ? 0.75 : 0.9);
      f.br.on = Math.abs(f.vx) > 5 ? 1 : 0;
      continue;
    }
    // jellyfish: pulse along, head first, trailing tentacles; spit poison at him now and then
    const b = f.br;
    f.x -= SCROLL * 0.35 * dt;
    // a natural-zone creature (NATURAL_ONLY): drifting into the works, it swims back out
    if (built(f.x + S.scroll) > 0) f.vx = Math.min(f.vx, -40);
    b.pulse -= dt;
    if (b.pulse <= 0) {
      const tx = ru.x + 40 + R() * 100, ty = S.top + (S.bot - S.top) * (0.05 + R() * 0.5);
      b.hd = Math.atan2(ty - f.y, tx - f.x); b.pulse = 1 + R() * 1.2;
      f.vx += Math.cos(b.hd) * 45; f.vy += Math.sin(b.hd) * 45;
    }
    const k = Math.exp(-1.6 * dt);
    f.vx *= k; f.vy = f.vy * k + 6 * dt;
    f.x += f.vx * dt; f.y += f.vy * dt;
    { const wx = f.x + S.scroll; f.y = Math.max(titleCeil(wx, S) + f.r + 3, Math.min(titleFloor(wx, S) - f.r - 12, f.y)); }   // under this roof, over this floor
    b.shape = Math.min(1, Math.hypot(f.vx, f.vy) / 40);
    // tentacles as creatures/jelly.js jellyStep lays them: the first point on the rim, the rest
    // following at the knobs' spacing, swaying and drooping, streaming out behind a push
    b.t += dt;
    const c = Math.cos(b.hd), sn = Math.sin(b.hd), n = b.tent.length;
    const len = kru('jeTentLen', b.u.len), wave = kru('jeWave', b.u.wave), sag = kru('jeSag', b.u.sag);
    for (let i = 0; i < n; i++) {
      const T = b.tent[i], seg = len / (T.length - 1), lx = n > 1 ? (i / (n - 1) - 0.5) * f.r * 1.1 : 0;
      T[0].x = f.x - lx * sn - f.r * 0.35 * c; T[0].y = f.y + lx * c - f.r * 0.35 * sn;
      for (let j = 1; j < T.length; j++) {
        const q = T[j], pq = T[j - 1];
        if (isNaN(q.x)) { q.x = pq.x - c * seg; q.y = pq.y - sn * seg; }
        const sw = Math.sin(b.t * 3.1 + i * 0.5 - j * 0.9) * wave * dt * j / (T.length - 1);
        q.x += -sn * sw - SCROLL * 0.35 * dt; q.y += c * sw + sag * dt;
        const dx = q.x - pq.x, dy = q.y - pq.y, d = Math.hypot(dx, dy) || 1;
        q.x = pq.x + dx / d * seg; q.y = pq.y + dy / d * seg;
      }
    }
    f.cd -= dt;
    if (f.cd <= 0 && f.x < TITLE_VW) {
      f.cd = 2 + R() * 2.5;
      const a = Math.atan2(ru.y + PH / 2 - f.y, ru.x + PW / 2 - f.x);
      S.shots.push({ x: f.x, y: f.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, size: 2, col: '#a6ff7c', look: 'glob', life: 2, foe: true, spin: 0,
        grav: 40, drag: 0, explode: 0, pit: 0, fire: 0, bounce: 0, bounceE: 0, pierce: 0, dmg: 0 });
    }
  }
  S.foes = S.foes.filter(f => f.hp > 0 && f.x > -30);
}

/** @param {TitleScene} S @param {number} dt */
function stepShots(S, dt) {
  const ru = S.runner;
  for (const s of S.shots) {
    s.vy += s.grav * dt;
    if (s.drag) { const k = Math.exp(-s.drag * dt); s.vx *= k; s.vy *= k; }
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; s.spin += dt * 10;
    if (s.look === 'flame' && S.rnd() < dt * 20) burst(S, s.x, s.y, 1, '#ff7a1a', 15, 'fire', 0.3);
    if (s.foe) {
      if (Math.abs(ru.x + PW / 2 - s.x) < 7 && Math.abs(ru.y + PH / 2 - s.y) < 11) { s.life = 0; burst(S, s.x, s.y, 6, '#a6ff7c', 60, 'spark', 0.25); }
      if (titleSolid(S, s.x, s.y)) { s.life = 0; burst(S, s.x, s.y, 4, '#a6ff7c', 40, 'spark', 0.3); }
      continue;
    }
    for (const f of S.foes) {
      if (f.hp > 0 && Math.hypot(f.x - s.x, f.y - s.y) < f.r + s.size) {
        hitFoe(S, f, s.dmg * 1.5, s.col);
        if (s.explode || s.pierce <= 0) { shotEnd(S, s); break; }
        s.pierce--;
      }
    }
    if (s.life <= 0) continue;
    if (titleSolid(S, s.x, s.y)) {
      if (s.bounce > 0) {
        s.bounce--;
        // back out and flip whichever way it came in
        s.x -= s.vx * dt; s.y -= s.vy * dt;
        if (titleSolid(S, s.x, s.y + s.vy * dt)) s.vy = -s.vy * s.bounceE; else s.vx = -s.vx * s.bounceE;
      } else shotEnd(S, s);
    } else if (s.life <= 0.02 && (s.explode || s.fire)) shotEnd(S, s);
  }
  S.shots = S.shots.filter(s => s.life > 0 && s.x > -10 && s.x < TITLE_VW + 30 && s.y < S.vh);
}

// burning cells: flicker, spread to fuel beside them, then burn out (moss chars, timber goes)
/** @param {TitleScene} S @param {number} dt */
function stepFire(S, dt) {
  const R = S.rnd, keep = [];
  for (const f of S.fire) {
    if (f.c < S.gen - S.ncol) continue;
    f.t -= dt;
    const x = (f.c + 0.5) * TCELL - S.scroll, y = (f.r + 0.5) * TCELL;
    if (R() < dt * 6) burst(S, x, y, 1, '#ff9a2e', 12, 'fire', 0.45);
    if (R() < dt * 0.8) burst(S, x, y, 1, '#3a3346', 10, 'smoke', 1.2);
    if (R() < dt * 5) { const d = Math.floor(R() * 8), dc = [1, -1, 0, 0, 1, -1, 1, -1][d], dr = [0, 0, 1, -1, 1, 1, -1, -1][d]; light(S, f.c + dc, f.r + dr); }
    if (R() < dt * 1.5) for (const p of S.props) if (!p.burn && p.st !== 'chain' && p.k !== 'lamp' && near(p, x + S.scroll, y, 3)) { p.burn = 1.4; S.burnt++; }
    if (f.t > 0) { keep.push(f); continue; }
    const i = ci(S, f.c, f.r), m = S.cells[i];
    S.cells[i] = m === TM.MOSS ? TM.CHAR : TM.AIR;
    dirty(S, f.c, f.c, f.r, f.r + 2);   // and the rock under it, which may face up now (moss)
  }
  S.fire = keep;
}

// The big title: CAVE over RUNNER in the game's blocky pixel font, each letter bobbing on its own
// beat, a deep 3D extrusion, a hot gradient face, a glow, and a shine sweeping across now and then.
/** @param {CanvasRenderingContext2D} ctx @param {number} t seconds @param {number} cw css width @param {number} top css y of the title's top */
export function titleText(ctx, t, cw, top) {
  const lines = ['CAVE', 'RUNNER'];
  const px = titlePx(cw), ph = px;
  let y = top + 7 * ph;
  const shine = ((t * 0.45) % 1.6) - 0.3;          // a sweep across, then a rest
  lines.forEach((s, li) => {
    const w = pixWidth(s, px, 1);
    let x = (cw - w) / 2;
    [...s].forEach((c, i) => {
      const n = li * 4 + i;
      const bob = Math.sin(t * 3.2 + n * 0.7) * px * 0.45, cx = x, cy = y + bob;
      // extrusion: dark layers down-right
      for (let d = Math.ceil(px * 0.9); d > 0; d--) {
        ctx.fillStyle = d > px * 0.45 ? '#2a0610' : '#6a1220';
        pixText(ctx, c, cx + d * 0.5, cy + d, px, ph, 1, 8);
      }
      // the face: yellow to orange to red down the letter, with a glow
      const g = ctx.createLinearGradient(0, cy - 7 * ph, 0, cy);
      g.addColorStop(0, '#fff6b0'); g.addColorStop(0.35, '#ffd23a'); g.addColorStop(0.7, '#ff8a1f'); g.addColorStop(1, '#e8361a');
      ctx.shadowColor = 'rgba(255,140,40,0.9)'; ctx.shadowBlur = px * 2.2;
      ctx.fillStyle = g;
      pixText(ctx, c, cx, cy, px, ph, 1, 8);
      ctx.shadowBlur = 0;
      // the shine: a white band sweeping across the whole title
      const lx = (cx + pixWidth(c, px, 1) / 2) / cw;
      const sh = 1 - Math.abs(lx - shine) * 5;
      if (sh > 0) { ctx.globalAlpha = sh * 0.8; ctx.fillStyle = '#ffffff'; pixText(ctx, c, cx, cy, px, ph, 1, 8); ctx.globalAlpha = 1; }
      x += pixWidth(c, px, 1) + (1) * px;
    });
    y += 7 * ph + Math.ceil(px * 2.2);
  });
  // the tagline under it
  const ty = titleBottom(cw, top) - 4;
  ctx.font = '800 12px ui-monospace,SFMono-Regular,Menlo,monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
  ctx.shadowColor = 'rgba(255,110,30,0.95)'; ctx.shadowBlur = 8;
  ctx.fillStyle = '#ffe2b0';
  ctx.fillText('JETPACK · BLAST · LOOT · DIG', cw / 2 + 2, ty);
  ctx.shadowBlur = 0;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.textAlign = 'start';
}
// the title's pixel size, and where it and its tagline end (css px), for a screen cw wide
/** @param {number} cw */
const titlePx = cw => Math.max(4, Math.floor(Math.min(cw * 0.92 / pixWidth('RUNNER', 1, 1), 15)));
/** @param {number} cw css width @param {number} top the title's top @returns {number} */
export const titleBottom = (cw, top) => top + titlePx(cw) * 16 + Math.ceil(titlePx(cw) * 2.2) + 20;
