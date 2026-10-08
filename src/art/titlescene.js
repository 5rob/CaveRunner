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

import { CELL, COIN_PULL, GRAVITY, PW, PH } from '../core/consts.js';
import { ROSTERS, enemyFor } from '../data/creatures.js';
import { THEMES } from '../data/themes.js';
import { DEV, carrotAt, kr, kru, spr } from '../dev/knobs.js';
import { jellyPal, jellyStep } from '../creatures/jelly.js';
import { ratSpread, ratStep } from '../creatures/rat.js';
import { spiderStep } from '../creatures/spider.js';
import { roamStep } from '../creatures/common.js';
import { FIRE_CATCH, FIRE_COLS, FIRE_KNOB, FIRE_TICK, FIRE_UPW, FLAMMABLE } from '../world/fire.js';
import { navField, navWay } from '../world/nav.js';
import { collideNuggets, spillGold, stepNugget } from '../world/nuggets.js';
import { losClear } from '../world/vision.js';
import { archCurve } from '../world/decorate.js';
import { bendAwake, bendPush, bendStep, swingStep, swings, tailStep, vinePt, webAt } from '../world/sway.js';
import { MODS } from '../spells/mods.js';
import { pixText, pixWidth } from './pixfont.js';
import { GUN_HELD, gunMuzzle } from './sprites.js';
import { GUN_ART } from './gunart.js';

export const TITLE_VW = 220;          // world units across the screen
export const TITLE_FOES = 24;         // at most this many creatures at once (a rat swarm counts each rat; v0.0.165: ×2)
export const TITLE_PARTS = 320;       // particle cap
export const TITLE_GOLD = 90;         // nugget cap
export const TITLE_FIRE = 600;        // burning terrain cells at once
export const TCELL = 2;               // the terrain grid's cell (world units)
export const TITLE_ZLEN = 280;        // one zone's length (world units)
// the zones it travels through, in order (floor 1's natural and built-up looks)
export const TITLE_ZONES = ['moss', 'webs', 'timber', 'paved', 'grove'];
export const ZBLEND = 28;             // a zone's border frays this far (world units) each way, by noise
export const TIMBER_H = 38;           // the timber works' height, floor to roof: the mine frames' height
export const TITLE_WEBS = 60;         // web lines at once
export const TITLE_JUMP = 5;          // fire jumps from a burning vine, arch or web to one this near (world units)
export const TITLE_JUMPP = 0.05;      // … at this chance a fire tick (v0.0.165: ×0.1, was 0.5)
export const TITLE_FIRESPEED = 0.1;   // the title's fire spreads (cell to cell, onto plants) and burns along vines and silk at this × the game's (owner, v0.0.165)
export const TITLE_LINKS = 8;         // a cut vine's or web line's piece hangs as this many links (world/sway.js tailStep)
export const TITLE_WEBFIRE = 3;       // a web line burns along this many times an arch's speed (fireArch)
export const TITLE_AIM = 90;         // he shoots only at creatures this near (world units; v0.0.164, was the whole screen)
// cell materials: air (the back wall shows), rock (painted as the game paints it: moss where it faces
// up), moss (burns, chars), brick, wood (burns away), char (burnt or blasted rock); not solid: beam and
// beamD (a timber frame's lit and shaded wood, burn away), grass (the bright tufts on a moss patch),
// rub and rubM (a rubble mound, its mossy top)
export const TM = { AIR: 0, ROCK: 1, MOSS: 2, BRICK: 3, WOOD: 4, CHAR: 5, BEAM: 6, BEAMD: 7, GRASS: 8, RUB: 9, RUBM: 10 };
export const TITLE_SOLID = [0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
const SOLID = TITLE_SOLID;
const FUEL = [0, 0, 2, 0, 3, 0, 3, 3, 1, 0, 1];   // the fuel kind each burns as (world/fire.js: 1 grass, 2 moss, 3 timber)
export const FRAME_GAP = 72;          // the built-up layers: a timber frame every this far (world units)
export const FRAME_W = 36;            // its width, post to post
const SCROLL = 34;                    // the world's scroll speed (world units / s)
const GRAV = 260;
const SP = 0.5;                       // the game's shot speeds, scaled to the title's screen
// the guns they swap between, made up at each swap (titleKit): a real gun skin, a real shot mod (its look,
// colour, size, speed, how it hits) and 0–2 real modifiers worked on it by their own `f` (owner, v0.0.165:
// more variety). The shots that fly (no beams, saw, black hole, teleports; nuke and meteor too big)
export const TITLE_SHOTS = ['bolt', 'spark', 'slug', 'buck', 'lance', 'orb', 'blast', 'arrow', 'missile', 'fball', 'fbolt', 'flamer',
  'bubble', 'spit', 'eorb', 'esph', 'zap', 'chain', 'glance', 'cross', 'pollen', 'disc', 'digbolt'];
// the modifiers a title gun may carry (double / triple: that many of the shot at once)
export const TITLE_MODS = ['scatter', 'double', 'triple', 'bounce', 'pierce', 'homing', 'seeker', 'big', 'grow', 'shrink', 'tip',
  'heavy', 'light', 'speed', 'accel', 'range', 'over', 'borer'];
export const TITLE_RUNNERS = 4;
// each player's colour (backpack and helmet stripe), so they read as four players
export const TITLE_COLS = ['#3fb8ff', '#ff4f5e', '#5ee05a', '#ffc93a'];
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

/** @typedef {{ art: string, shot: string, mods: string[], name: string, cd: number, n: number, dmg: number, speed: number, spread: number, size: number,
 *   life: number, grav: number, drag: number, explode: number, pit: number, fire: number, bounce: number, bounceE: number, pierce: number, homing: number,
 *   accel: number, vmax: number, chain: number, col: string, look: string }} TKit */
/** @typedef {{ x: number, y: number, vx: number, vy: number, face: number, ang: number, cd: number, kit: TKit, flame: number, id: number, col: string,
 *   mode: string, modeT: number, tx: number, ty: number, retarget: number, gait: number, ground: boolean, swapT: number, swap: number, wvx: number, wvy: number,
 *   nav: { F: any, fx: number, fy: number, t: number } }} TRunner */
/** @typedef {{ x: number, y: number, vx: number, vy: number, size: number, col: string, look: string, life: number, foe: boolean, spin: number,
 *   grav: number, drag: number, explode: number, pit: number, fire: number, bounce: number, bounceE: number, pierce: number, dmg: number,
 *   homing?: number, accel?: number, vmax?: number, chain?: number }} TShot */
/** @typedef {{ x: number, y: number, vx: number, vy: number, life: number, max: number, r: number, col: string, kind: string }} TPart */
/** @typedef {{ x: number, y: number, r: number, t: number, max: number }} TBoom */
/** @typedef {{ pts: { x: number, y: number }[], t: number, col: string }} TZap */
// a prop: `ox` its world x (not `wx`: art/props.js reads that as an arch's or a vine's sideways bend)
/** @typedef {{ k: string, st: string, ox: number, x: number, y: number, len: number, seed: number, side: number, burn: number, ac: number, ar: number,
 *   arc?: number[][], thick?: number, t?: number, span?: number, host?: TProp, gone?: boolean, u0?: number, u1?: number, alen?: number, u?: number,
 *   fall?: boolean, vy?: number, sw?: number, swv?: number, sj?: number, tl?: number[], tq?: number[], wx?: number, wy?: number, wvx?: number,
 *   wvy?: number, wu?: number, on?: TProp | null, drop?: boolean, links?: number }} TProp */
/** @typedef {{ c: number, r: number, t: number }} TFire */
/** @typedef {{ t: number, vh: number, top: number, bot: number, seed: number, rnd: () => number, scroll: number, shake: number, spawn: number,
 *   kills: number, gold: number, got: number, runner: TRunner, runners: TRunner[], foes: Enemy[], shots: TShot[], parts: TPart[], coins: Coin[],
 *   booms: TBoom[], zaps: TZap[], flash: number, rows: number, ncol: number, cells: Uint8Array, gen: number, props: TProp[],
 *   fire: TFire[], dirty: number[][], dirtyAll: boolean, carved: number, burnt: number, swaps: number, groundT: number, flyT: number, kinds: Record<string, number>,
 *   webs: WebLine[], cut: number, lineT: number, silk: { x: number, y: number, ax: number, ay: number, vx: number, vy: number, life: number }[],
 *   nav: { F: any, fx: number, fy: number, t: number }, fireAcc: number, fireN: number, burning: Set<number>, gotN: number, pops: number, lampsPopped: number, kitNames: Set<string> }} TitleScene */

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
  // the layer's roof comes down over a natural slope (owner, v0.0.165: the old short step was too steep and
  // straight): an S-curve about TIMBER_RAMP long, starting a little before the works, where it starts shifted
  // by noise, the rock along it lumpy (big lumps and a fine fray, none once it's down)
  const d = timberD(wx);
  if (d < -TIMBER_RAMP) return nat;
  const q = Math.max(0, Math.min(1, (d + TIMBER_RAMP - 30 + (titleNoise(wx / 40, 44) - 0.5) * 20) / TIMBER_RAMP)), bt = q * q * (3 - 2 * q);
  if (!bt) return nat;
  const lump = Math.sin(Math.PI * bt) * ((titleNoise(wx / 16, 47) - 0.5) * 22 + (titleNoise(wx / 6, 40) - 0.5) * 9 + (titleNoise(wx / 2.5, 43) - 0.5) * 3);
  return nat + (Math.max(nat, titleFloor(wx, B) - TIMBER_H) - nat) * bt + lump;
};
const TIMBER_RAMP = 120;              // the timber works' roof slope's length (world units; it ends ~30 into the works)
// how far world x is into a timber works zone (its nearer end; negative before it, -Infinity away from one)
/** @param {number} wx */
const timberD = wx => {
  const u = wx - Math.floor(wx / TITLE_ZLEN) * TITLE_ZLEN, z = titleZone(wx);
  if (z === 'timber') return Math.min(u, TITLE_ZLEN - u);
  if (titleZone(wx + TITLE_ZLEN) === 'timber') return -(TITLE_ZLEN - u);
  if (titleZone(wx - TITLE_ZLEN) === 'timber') return -u;
  return -Infinity;
};
// a web line's point at fraction u: straight a0..b0, sagging in the middle (as world/sway.js webAt)
/** @param {WebLine} L @param {number} u */
export const titleWebAt = webAt;   // (and bent where a player pushed through it)
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
    lamp(S, c, wx, cy + 10, 4 + R() * 8);
  // and in the band above, and down long chains from the brick works' high roof
  if (shelf && Math.abs(fu - FRAME_W / 2) < 1 && R() < 0.6)
    lamp(S, c, wx, upTop + 10, 3 + R() * 6);
  if (z === 'paved' && built(wx) > 0.9 && Math.abs(u - FRAME_GAP / 2) < 1 && R() < 0.8)
    lamp(S, c, wx, cy + 10, 14 + R() * 30);
  // the spiders' zone: web lines everywhere, roof to floor (slanting either way) and roof to roof (sagging)
  if (z === 'webs' && b === 0 && !(c % 4) && R() < 0.42 && S.webs.length < TITLE_WEBS) {
    const down = R() < 0.55, bx = down ? wx + (R() - 0.35) * 70 : wx + 18 + R() * 44;
    const by = down ? titleFloor(bx, S) - 0.5 : titleCeil(bx, S) + 0.5;
    /** @type {WebLine} */
    const L = { ax: wx, ay: cy + 0.5, bx, by, a0x: wx, a0y: cy + 0.5, b0x: bx, b0y: by, ain: { x: wx, y: cy - 1 }, bin: { x: bx, y: down ? by + 1.5 : by - 1.5 }, owner: null, sag: 0 };
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
      const ax = wx + (R() - 0.3) * 60, span = kru('arSpan', R()) * TCELL * 0.6, bx = ax + span;   // the knob's spans, scaled to the title's narrow screen
      const ay = titleCeil(ax, S) + 1, by = titleCeil(bx, S) + 1, n = Math.max(8, Math.min(40, Math.round(span / 6)));
      let slack = kru('arSlack', R()), pts = archCurve(ax, ay, bx, by, slack, n);
      const clear = kru('arClear', R()) * TCELL, low = () => pts.reduce((m, p) => (p.y > m.y ? p : m), pts[0]);
      for (let k = 0; k < 3 && titleFloor(low().x, S) - low().y < clear; k++) { slack = 1 + (slack - 1) * 0.75; pts = archCurve(ax, ay, bx, by, slack, n); }
      if (titleFloor(low().x, S) - low().y < clear) continue;
      const arch = { k: 'climb', st: 'vine', ox: ax, x: 0, y: ay, len: 0, seed: R(), side: 1, burn: 0, ac: Math.floor(ax / TCELL), ar: Math.floor((ay - 2) / TCELL),
        arc: pts.map(p => [p.x - ax, p.y - ay]), thick: Math.round(kru('arThick', R())), t: R() * 10, span };
      S.props.push(arch);
      let alen = 0;
      for (let k = 0; k < n; k++) alen += Math.hypot(pts[k + 1].x - pts[k].x, pts[k + 1].y - pts[k].y);
      arch.alen = alen;
      const ns = Math.round(kru('arStrands', R()) * alen / (10 * TCELL));
      for (let s = 0; s < ns; s++) {
        const kq = Math.min(n - 1, Math.floor(R() * n)), q = pts[kq], room = titleFloor(q.x, S) - q.y;
        const len = Math.min(kru('arStrandLen', R()) * TCELL, room * 0.7);
        if (len >= 4) S.props.push({ k: 'climb', st: 'vine', ox: q.x, x: 0, y: q.y, len, seed: R(), side: 1, burn: 0, ac: arch.ac, ar: arch.ar, host: arch, on: arch, u: kq / n });
      }
    }
  }
  if (grove && !(c % 2)) {
    const mid = Math.min(1, Math.min(zu, TITLE_ZLEN - zu) / 70);
    if (R() < 0.12 + 0.2 * mid) {
      const room = fy - cy, st = R() < 0.82 ? 'vine' : R() < 0.5 ? 'root' : 'myc';
      S.props.push({ k: 'climb', st, ox: wx, x: 0, y: cy, len: room * (0.2 + R() * (0.35 + 0.45 * mid)), seed: R(), side: 1, burn: 0,
        ac: c, ar: Math.floor((cy - 1) / TCELL) });
      return;
    }
  }
  if (c % 3) return;
  const p = R();
  if (!grove && p < (z === 'moss' ? 0.2 : 0.04) * Math.max(nat, 0.2)) {
    const st = R() < 0.5 ? 'vine' : R() < 0.5 ? 'myc' : 'root';
    S.props.push({ k: 'climb', st, ox: wx, x: 0, y: cy, len: 10 + R() * (z === 'moss' ? 40 : 24), seed: R(), side: 1, burn: 0,
      ac: c, ar: Math.floor((cy - 1) / TCELL) });
  } else if (z === 'paved' && b > 0.5 && p < 0.08) {
    S.props.push({ k: 'climb', st: 'chain', ox: wx, x: 0, y: cy, len: 8 + R() * 16, seed: R(), side: 1, burn: 0, ac: c, ar: Math.floor((cy - 1) / TCELL) });
  } else if (nat > 0.5 && R() < (grove ? 0.09 : 0.04)) {
    S.props.push({ k: 'pad', st: '', ox: wx, x: 0, y: fy, len: 0, seed: R(), side: 1, burn: 0, ac: c, ar: Math.floor((fy + 1) / TCELL) });
  }
}

// a lantern on its chain in column c, hung from whatever is right above (world) y0: straight up from there
// to the first rock or timber, the roof's underside or a frame's cap beam, so the chain meets it
/** @param {TitleScene} S @param {number} c @param {number} wx @param {number} y0 @param {number} len */
function lamp(S, c, wx, y0, len) {
  const base = ci(S, c, 0);
  let r = Math.floor(y0 / TCELL);
  while (r > 0 && !HOLDS[S.cells[base + r]]) r--;
  S.props.push({ k: 'lamp', st: 'hanglamp', ox: wx, x: 0, y: (r + 1) * TCELL, len, seed: S.rnd(), side: 1, burn: 0, ac: c, ar: r });
}
// what a hanging thing can hang from: rock, and a frame's timber (it falls when that's burnt or blown away)
const HOLDS = TITLE_SOLID.map((v, m) => (v || m === TM.BEAM || m === TM.BEAMD ? 1 : 0));

// A gun for the title: a random skin, shot and 0–2 modifiers. The shot's numbers go through each modifier's
// own f (spells/mods.js) as the game's cast does; double / triple fire that many of it at once. cd: the
// shot's cast delay (+ the modifiers' d) at the title's pace
/** @param {() => number} R @returns {TKit} */
export function titleKit(R) {
  const pick = (/** @type {string[]} */ a) => a[Math.floor(R() * a.length)];
  const shot = pick(TITLE_SHOTS), M = MODS[shot], nm = R() < 0.2 ? 0 : R() < 0.55 ? 1 : 2, mods = [];
  for (let i = 0; i < nm; i++) { const m = pick(TITLE_MODS); if (!mods.includes(m)) mods.push(m); }
  /** @type {any} */
  const s = { dmg: M.dmg || 1, speed: M.speed || 300, spread: M.spread || 0, size: M.size || 2, life: M.life || 1, count: M.count || 1, recoil: 0,
    grav: M.grav || 0, drag: M.drag || 0, explode: M.explode || 0, pit: Math.max(M.pit || 0, M.bore || 0), fire: M.fire || 0,
    bounce: M.bounce || 0, bounceE: M.bounceE || 0.5, pierce: M.pierce || 0, homing: M.homing || 0, accel: M.accel || 0, vmax: M.vmax || 0,
    bore: 0, r: 0, pull: 0, eat: 0, pop: M.pop || 0 };
  let d = M.delay || 0.2, n = 1;
  for (const k of mods) {
    const X = MODS[k];
    if (X.f) X.f(s);
    if (X.multi) n += X.multi;
    d += X.d || 0;
  }
  if (s.bore) s.pit = Math.max(s.pit, s.bore);
  if (M.fuse) s.life = Math.min(s.life, M.fuse + 0.5);
  const art = pick(GUN_ART.map(a => a.id));
  return { art, shot, mods, name: [shot, ...mods].join('+'), cd: Math.max(0.06, d * 1.7) * (n > 1 ? 1.3 : 1), n: s.count * n,
    dmg: s.dmg, speed: s.speed, spread: s.spread + (n > 1 ? 6 : 0), size: Math.min(8, s.size), life: Math.min(4, s.life), grav: s.grav, drag: s.drag,
    explode: Math.min(40, s.explode), pit: Math.min(10, s.pit), fire: s.fire, bounce: s.bounce, bounceE: s.bounceE, pierce: s.pierce, homing: s.homing,
    accel: s.accel, vmax: s.vmax, chain: M.chain || 0, col: M.col, look: M.look || '' };
}

/** @param {number} vh the view's height in world units @param {number} [seed] @param {number} [top] the action's band (world units) @param {number} [bot] @returns {TitleScene} */
export function titleScene(vh, seed = 7, top = vh * 0.3, bot = vh * 0.62) {
  const rnd = titleRng(seed), rows = Math.ceil(vh / TCELL) + 1, ncol = Math.ceil((TITLE_VW + 90) / TCELL);
  /** @type {TitleScene} */
  const S = { t: 0, vh, top, bot, seed, rnd, scroll: 0, shake: 0, spawn: 0, kills: 0, gold: 0, got: 0, runner: null, runners: [], foes: [], shots: [],
    parts: [], coins: [], booms: [], zaps: [], flash: 0, rows, ncol, cells: new Uint8Array(rows * ncol), gen: -25, props: [],
    fire: [], dirty: [], dirtyAll: true, carved: 0, burnt: 0, swaps: 0, groundT: 0, flyT: 0, kinds: {}, webs: [], cut: 0, lineT: 0,
    silk: [], nav: { F: null, fx: 0, fy: 0, t: -9 }, fireAcc: 0, fireN: 0, burning: new Set(), gotN: 0, pops: 0, lampsPopped: 0, kitNames: new Set() };
  genTo(S);
  // four players, spread along the left side, each on its own clock (S.runner: player 1)
  for (let i = 0; i < TITLE_RUNNERS; i++) {
    const x = 18 + i * 30, y = titleSurf(S, x + PW / 2, (top + bot) / 2, 1) - PH;
    S.runners.push({ x, y, vx: 0, vy: 0, face: 1, ang: 0, cd: 0.5 + i * 0.2, kit: titleKit(rnd), flame: 0, id: i, col: TITLE_COLS[i],
      mode: 'run', modeT: 1.5 + i * 1.3 + rnd() * 2, tx: x, ty: y, retarget: 0, gait: i * 1.7, ground: true, swapT: 2 + i * 1.2 + rnd() * 2, swap: 0, wvx: 0, wvy: 0,
      nav: { F: null, fx: 0, fy: 0, t: -9 } });
  }
  S.runner = S.runners[0];
  for (let i = 0; i < 6; i++) addFoe(S, 130 + rnd() * 90);
  return S;
}
/** @param {TitleScene} S */
function genTo(S) {
  while (S.gen * TCELL < S.scroll + TITLE_VW + 40) { genCol(S, S.gen); S.gen++; }
}

// the terrain as the creatures' brains see it (the game's terrain cells, world coordinates): out
// of the ring of columns made so far, rock (they keep to the stretch on and near the screen)
/** @param {TitleScene} S @returns {(cx: number, cy: number) => number} */
const csolid = S => (cx, cy) => (cy < 0 || cy >= S.rows || cx < S.gen - S.ncol || cx >= S.gen ? 1 : SOLID[S.cells[ci(S, cx, cy)]]);
/** @param {TitleScene} S @returns {(x: number, y: number) => boolean} world point in rock */
const wsolid = S => { const C = csolid(S); return (x, y) => !!C(Math.floor(x / CELL), Math.floor(y / CELL)); };

// A creature comes in at the right (screen x; default just off it): only what lives in that zone
// (TITLE_HOME, weighted), made as makeLevel makes them (enemyFor: the real kind, floor 1), in WORLD
// coordinates, so the game's own brains move them over the terrain. A jellyfish in the open, a
// spider on the roof or the floor, rats a few at once on the floor (no nests on the title)
/** @param {TitleScene} S @param {number} [x] */
function addFoe(S, x) {
  const R = S.rnd, wx = (x === undefined ? TITLE_VW + 16 : x) + S.scroll;
  const home = TITLE_HOME[titleZone(wx)];
  let roll = R() * home.reduce((a, h) => a + h[1], 0), id = home[0][0];
  for (const [q, w] of home) { if (roll < w) { id = q; break; } roll -= w; }
  S.kinds[id] = (S.kinds[id] || 0) + 1;
  const n = id === 'rotta' ? 3 + Math.floor(R() * 4) : id === 'hamahakki' ? 1 + Math.floor(R() * 2) : 1;
  for (let i = 0; i < n && S.foes.length < TITLE_FOES; i++) {
    const ex = wx + i * (8 + R() * 8), k = enemyFor(id, 1), cy = titleCeil(ex, S), fy = titleFloor(ex, S);
    const ey = id === 'meduusa' ? cy + (fy - cy) * (0.25 + 0.45 * R()) : id === 'hamahakki' && R() < 0.5 ? cy + k.r : fy - k.r - 1;
    S.foes.push({ x: ex, y: ey, ty: ey, r: k.r, phase: R() * 6.28, hp: k.hp, hpMax: k.hp, cd: 1 + R() * 2, flash: 0, lx: 0, ly: 1,
      hx: ex, hy: ey, tgt: null, rest: R() * 3, k, touch: 0, charge: 0 });
  }
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

// A flame speck off something burning, as game/systems/fire.js flameAt (screen x): it rises, three
// fire colours, gone in half a second or on rock; and its smoke (fireSmoke): a dark puff, swelling as it rises
/** @param {TitleScene} S @param {number} x @param {number} y */
function flameAt(S, x, y) {
  if (S.parts.length >= TITLE_PARTS) return;
  const R = S.rnd, l = 0.25 + R() * 0.3;
  S.parts.push({ x, y, vx: (R() - 0.5) * 16, vy: -30 - R() * 40, life: l, max: 0.55, r: 1 + R() * 1.2,
    col: R() < 0.4 ? '#ffd35a' : R() < 0.6 ? '#ff8a2a' : '#e8461c', kind: 'flame' });
}
/** @param {TitleScene} S @param {number} x @param {number} y */
function fireSmoke(S, x, y) {
  if (S.parts.length >= TITLE_PARTS) return;
  const R = S.rnd;
  S.parts.push({ x, y, vx: (R() - 0.5) * 12, vy: -25 - R() * 20, life: 1.4, max: 1.4, r: 2 + R() * 2.5, col: '#2a2624', kind: 'fsmoke' });
}

// A lantern shot, blasted or dropped (game/systems/props.js popLamp): the glass goes in a white spray, its
// burning oil is thrown out in 16 blobs (embers) that light the fuel they fall through and where they land,
// and the spot itself catches
/** @param {TitleScene} S @param {TProp} p */
function popLamp(S, p) {
  if (p.gone) return;
  p.gone = true; S.lampsPopped++;
  const R = S.rnd, x = p.x, y = p.y + p.len + 4.5;
  burst(S, x, y, 6, '#fff2c0', 80, 'spark', 0.3);
  for (let k = 0; k < 16 && S.parts.length < TITLE_PARTS; k++) {
    const a = -Math.PI / 2 + (R() - 0.5) * 3.4, v = 50 + R() * 120;
    S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: 1.2 + R() * 0.8, max: 2, r: 1.2 + R() * 0.9,
      col: FIRE_COLS[Math.floor(R() * 3)], kind: 'ember' });
  }
  titleIgnite(S, x, y, 6, 0.8);
}
// a lantern's body (screen), where a shot or a blast finds it
/** @param {TProp} p @param {number} x @param {number} y @param {number} r */
const lampHit = (p, x, y, r) => x > p.x - 3.5 - r && x < p.x + 3.5 + r && y > p.y + p.len - r && y < p.y + p.len + 9 + r;

// blow a hole: every cell within r of (sx, y) goes, the rock round its rim chars, plants on it fall
/** @param {TitleScene} S @param {number} sx @param {number} y @param {number} r */
export function titleCarve(S, sx, y, r) {
  const wx = sx + S.scroll, c0 = Math.floor((wx - r - 2) / TCELL), c1 = Math.floor((wx + r + 2) / TCELL);
  const r0 = Math.max(0, Math.floor((y - r - 2) / TCELL)), r1 = Math.min(S.rows - 1, Math.floor((y + r + 2) / TCELL));
  let n = 0;
  for (let c = Math.max(c0, S.gen - S.ncol); c <= Math.min(c1, S.gen - 1); c++) for (let rr = r0; rr <= r1; rr++) {
    const d = Math.hypot((c + 0.5) * TCELL - wx, (rr + 0.5) * TCELL - y), i = ci(S, c, rr), m = S.cells[i];
    if (d <= r) { if (m !== TM.AIR) { S.cells[i] = TM.AIR; n++; S.burning.delete(c * S.rows + rr); } }
    else if (d <= r + 2 && SOLID[m] && m !== TM.CHAR) S.cells[i] = TM.CHAR;
  }
  if (n) {
    S.carved += n;
    dirty(S, c0, c1, r0, r1);
    burst(S, sx, y, Math.min(8, n), '#7a6a5a', 70, 'chunk', 0.8);
  }
  cutWebs(S, wx, y, r);
  return n;
}
// A blast's or a fire shot's heat (game/systems/fire.js ignite): every fuel cell within r catches at
// `chance`, and the plants, arches and web lines there
/** @param {TitleScene} S @param {number} sx @param {number} y @param {number} r @param {number} [chance] */
export function titleIgnite(S, sx, y, r, chance = 0.9) {
  const R = S.rnd, wx = sx + S.scroll;
  lightArea(S, wx, y, r, chance);
  for (const p of S.props) if (!p.burn && !p.gone && burns(p) && R() < chance) {
    if (p.arc) { const k = archK(p, wx, y, r); if (k >= 0) catchArch(S, p, k / (p.arc.length - 1)); }
    else if (wx > p.ox - 5 - r && wx < p.ox + 5 + r && y > p.y - r && y < p.y + p.len + r) catchPlant(S, p);
  }
  // web lines in the heat catch where they pass nearest (a blast's own hole cuts them: titleCarve)
  for (const L of S.webs) if (!L.fu && R() < chance) {
    const vx = L.b0x - L.a0x, vy = L.b0y - L.a0y, ll = vx * vx + vy * vy || 1;
    const u = Math.max(0, Math.min(1, ((wx - L.a0x) * vx + (y - L.a0y) * vy) / ll)), p = titleWebAt(L, u);
    if (Math.hypot(p.x - wx, p.y - y) <= r + 1.5) catchWeb(S, L, u);
  }
}
// every fuel cell within r of world point (wx, y) catches at `chance` (world/fire.js fireArea)
/** @param {TitleScene} S @param {number} wx @param {number} y @param {number} r @param {number} chance */
function lightArea(S, wx, y, r, chance) {
  const R = S.rnd, c0 = Math.floor((wx - r) / TCELL), c1 = Math.floor((wx + r) / TCELL);
  const r0 = Math.max(0, Math.floor((y - r) / TCELL)), r1 = Math.min(S.rows - 1, Math.floor((y + r) / TCELL));
  for (let c = Math.max(c0, S.gen - S.ncol); c <= Math.min(c1, S.gen - 1); c++) for (let rr = r0; rr <= r1; rr++)
    if (Math.hypot((c + 0.5) * TCELL - wx, (rr + 0.5) * TCELL - y) <= r && R() < chance) light(S, c, rr);
}
// the index of the arch's point within r of (wx, y), or -1
/** @param {TProp} p @param {number} wx @param {number} y @param {number} r */
const archK = (p, wx, y, r) => (p.arc ? p.arc.findIndex(q => Math.hypot(p.ox + q[0] - wx, p.y + q[1] - y) < r + 3) : -1);
// a fuel cell catches (world/fire.js fireLight): it burns for its kind's time (the fire knobs)
/** @param {TitleScene} S @param {number} c @param {number} r */
function light(S, c, r) {
  if (S.fire.length >= TITLE_FIRE || c < S.gen - S.ncol || c >= S.gen || r < 0 || r >= S.rows) return false;
  const kind = FUEL[S.cells[ci(S, c, r)]], key = c * S.rows + r;
  if (!kind || S.burning.has(key)) return false;
  S.fire.push({ c, r, t: Math.max(1, Math.round(kr(FIRE_KNOB[kind], S.rnd) / FIRE_TICK)) });
  S.burning.add(key);
  S.burnt++;
  return true;
}
// is anything alight within r of world point (wx, y)? (world/fire.js fireNear: a square test)
/** @param {TitleScene} S @param {number} wx @param {number} y @param {number} r */
function fireNear(S, wx, y, r) {
  const c0 = Math.floor((wx - r) / TCELL), c1 = Math.floor((wx + r) / TCELL), r0 = Math.floor((y - r) / TCELL), r1 = Math.floor((y + r) / TCELL);
  for (let c = c0; c <= c1; c++) for (let q = r0; q <= r1; q++) if (S.burning.has(c * S.rows + q)) return true;
  return false;
}
// a plant catches: it burns up from its tip toward the rock (game/systems/fire.js catchPlant)
/** @param {TitleScene} S @param {TProp} p */
function catchPlant(S, p) { if (!p.burn && !p.gone) { p.burn = 1; S.burnt++; } }
// an arched vine catches at fraction u: it burns through there (owner, v0.0.165), and each side hangs
// from its end, swinging down, burning up from the cut (cutArch)
/** @param {TitleScene} S @param {TProp} p @param {number} u */
function catchArch(S, p, u) { if (!p.burn && !p.gone) { S.burnt++; cutArch(S, p, u, true, true); } }
// a web line catches at fraction u: the same, the two halves of silk hanging from its ends (cutWeb)
/** @param {TitleScene} S @param {WebLine} L @param {number} u */
function catchWeb(S, L, u) { if (!L.fu && !L.out) { S.burnt++; cutWeb(S, L, u, true); } }

// ---- cut lines (owner, v0.0.165): a vine or web line held at both ends, cut, hangs from each end that still
// holds, a rope of TITLE_LINKS links (world/sway.js tailStep: the game's hanging-vine tail) swinging down from
// where it lay, burning up from the cut if it was fire; an end that doesn't hold falls
// a hanging piece: anchored at (ax, ay) (world), first lying along pts (world, from the anchor out)
/** @param {TitleScene} S @param {string} st @param {number} ax @param {number} ay @param {{ x: number, y: number }[]} pts @param {boolean} burn @param {boolean} holds */
function hangPiece(S, st, ax, ay, pts, burn, holds) {
  let len = 0;
  /** @type {number[]} */
  const cum = [0];
  for (let i = 1; i < pts.length; i++) { len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); cum.push(len); }
  if (len < 3) return null;
  /** @type {number[]} */
  const tl = [];
  for (let i = 1, j = 1; i <= TITLE_LINKS; i++) {
    const want = len * i / TITLE_LINKS;
    while (j < pts.length - 1 && cum[j] < want) j++;
    const a = pts[j - 1], b = pts[j], t = Math.max(0, Math.min(1, (want - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1)));
    tl.push(a.x + (b.x - a.x) * t - ax, a.y + (b.y - a.y) * t - ay);
  }
  /** @type {TProp} */
  const p = { k: 'climb', st, ox: ax, x: ax - S.scroll, y: ay, len, seed: S.rnd(), side: 1, burn: burn ? 1 : 0, ac: Math.floor(ax / TCELL), ar: Math.floor((ay - 2) / TCELL),
    sw: 0, swv: 0, sj: 0, tl, tq: tl.slice(), links: TITLE_LINKS, drop: !holds, vy: 0 };
  S.props.push(p);
  return p;
}
// an arch cut at fraction u (0 or 1: its hold lost at that end); hold0 / hold1: whether each end still holds
/** @param {TitleScene} S @param {TProp} p @param {number} u @param {boolean} burn @param {boolean} [hold0] @param {boolean} [hold1] */
function cutArch(S, p, u, burn, hold0 = true, hold1 = true) {
  if (p.gone || !p.arc) return;
  p.gone = true;
  const n = p.arc.length - 1, k = Math.max(0, Math.min(n, Math.round(u * n)));
  const pt = (/** @type {number} */ i) => ({ x: p.ox + p.arc[i][0], y: p.y + p.arc[i][1] });
  const left = [], right = [];
  for (let i = 0; i <= k; i++) left.push(pt(i));
  for (let i = n; i >= k; i--) right.push(pt(i));
  if (left.length > 1) hangPiece(S, 'vine', left[0].x, left[0].y, left, burn, hold0);
  if (right.length > 1) hangPiece(S, 'vine', right[0].x, right[0].y, right, burn, hold1);
  // the strands hanging off it drop (one by the cut catches)
  for (const o of S.props) if (o.host === p) {
    o.host = null; o.on = null; o.drop = true; o.vy = 0;
    if (burn && Math.abs((o.u || 0) - u) < 0.15) catchPlant(S, o);
  }
}
// a web line cut at fraction u: the two halves hang from its ends where rock above or beside holds them
// (one stuck to the floor falls away)
/** @param {TitleScene} S @param {WebLine} L @param {number} u @param {boolean} burn */
function cutWeb(S, L, u, burn) {
  L.out = true; L.fu = null; S.cut++;
  S.webs = S.webs.filter(o => o !== L);
  const pts = [];
  for (let i = 0; i <= 8; i++) pts.push(titleWebAt(L, u * i / 8));
  const qts = [];
  for (let i = 0; i <= 8; i++) qts.push(titleWebAt(L, 1 - (1 - u) * i / 8));
  /** @param {number} x @param {number} y @returns {number[] | null} the holding cell */
  const hold = (x, y) => {
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [-1, -1], [1, -1]]) {
      const c = Math.floor((x + dx * 1.5) / TCELL), r = Math.floor((y + dy * 1.5) / TCELL);
      if (SOLID[titleCell(S, c, r)]) return [c, r];
    }
    return null;
  };
  /** @param {number} x @param {number} y @param {Pt[]} P */
  const piece = (x, y, P) => {
    const h = hold(x, y), p = hangPiece(S, 'silk', x, y, P, burn, !!h);
    if (p && h) { p.ac = h[0]; p.ar = h[1]; }
  };
  piece(L.a0x, L.a0y, pts);
  piece(L.b0x, L.b0y, qts);
}
// can a title prop swing (a hanging vine, chain, root or strand; a cut piece)?
/** @param {TProp} p */
const canSwing = p => p.k === 'climb' && !p.arc && !!p.len;

// The players' push on the vines and webs they pass (game/systems/props.js): a hanging vine swings the way
// he went (DEV.vinePush), its tail trailing (tailStep); an arch or a web line gives where he goes through it
// (bendPush) and springs back (bendStep). Cut pieces swing down under their own weight the same way
/** @param {TitleScene} S @param {number} dt */
function stepSway(S, dt) {
  for (const p of S.props) {
    if (p.gone || p.k !== 'climb') continue;
    const x = p.ox - S.scroll;
    if (x + (p.span || 0) < -30 || x > TITLE_VW + 30) continue;
    /** @type {any} */
    const pa = p;
    if (p.arc) {
      const n = p.arc.length - 1;
      for (const r of S.runners) {
        const cx = r.x + PW / 2 + S.scroll, cy = r.y + PH / 2;
        if (cx < p.ox - 8 || cx > p.ox + (p.span || 0) + 8) continue;
        let best = -1, bd = 7;
        for (let k = 0; k <= n; k++) { const d = Math.hypot(p.ox + p.arc[k][0] - cx, p.y + p.arc[k][1] - cy); if (d < bd) { bd = d; best = k; } }
        if (best >= 0) bendPush(pa, best / n, r.wvx, r.wvy, DEV.bendPush, dt);
      }
      if (bendAwake(pa)) bendStep(pa, 0, 0, DEV.bendK, DEV.bendDamp, DEV.bendMax, dt);
      continue;
    }
    if (!canSwing(p) || p.drop || p.host) continue;
    for (const r of S.runners) {
      const ry = r.y + PH / 2 - p.y;
      if (r.y + PH < p.y || r.y > p.y + p.len) continue;
      const q = vinePt(pa, Math.max(0, Math.min(p.len, ry)));
      if (Math.abs(x + q.x - (r.x + PW / 2)) < PW / 2 + 1) {
        const k = Math.min(1, 10 * dt);
        p.swv = (p.swv || 0) + (r.wvx * DEV.vinePush / Math.max(12, p.len) - (p.swv || 0)) * k;
      }
    }
    if (p.sw || p.swv) swingStep(pa, p.len * 0.6, GRAVITY * DEV.vineGrav, DEV.vineDamp, DEV.vineMax, dt);
    if (p.sw || p.swv || p.tl) tailStep(pa, p.links || DEV.vineLinks, GRAVITY, DEV.vineTailDamp, dt);
    // a cut piece long enough to reach the ground rests on it: its end in the rock, it gathers up out of it
    if (p.links && p.len > 3) { const q = vinePt(pa, p.len); if (titleSolid(S, x + q.x, p.y + q.y)) p.len = Math.max(3, p.len - 60 * dt); }
  }
  // web lines: the game's rest sag, pushed where a player goes through
  for (const L of S.webs) {
    if (Math.max(L.a0x, L.b0x) < S.scroll - 20 || Math.min(L.a0x, L.b0x) > S.scroll + TITLE_VW + 20) continue;
    for (const r of S.runners) {
      const cx = r.x + PW / 2 + S.scroll, cy = r.y + PH / 2;
      if (cx < Math.min(L.a0x, L.b0x) - 6 || cx > Math.max(L.a0x, L.b0x) + 6) continue;
      const vx = L.b0x - L.a0x, vy = L.b0y - L.a0y, u = Math.max(0, Math.min(1, ((cx - L.a0x) * vx + (cy - L.a0y) * vy) / (vx * vx + vy * vy || 1)));
      const w = titleWebAt(L, u);
      if (Math.hypot(w.x - cx, w.y - cy) < 6) bendPush(L, u, r.wvx, r.wvy, DEV.bendPush, dt);
    }
    if (bendAwake(L)) bendStep(L, 0, 0, DEV.bendK, DEV.bendDamp, DEV.bendMax, dt);
  }
}

/** @param {TitleScene} S @param {Enemy} f */
function killFoe(S, f) {
  f.hp = 0;
  S.kills++;
  const big = f.k.id !== 'rotta', x = f.x - S.scroll, y = f.ty;
  S.booms.push({ x, y, r: f.r * (big ? 3 : 1.6), t: 0, max: 0.4 });
  burst(S, x, y, big ? 22 : 8, '#ffd27a', 110, 'fire', 0.55);
  burst(S, x, y, 8, '#ffffff', 190, 'spark', 0.3);
  burst(S, x, y, big ? 6 : 2, '#3a3346', 30, 'smoke', 1.3);
  burst(S, x, y, 5, f.k.col.a, 90, 'chunk', 0.9);
  if (big) { S.shake = Math.min(7, S.shake + 3); S.flash = Math.min(0.35, S.flash + 0.15); }
  // its gold as the game drops it (systems/enemies.js damageEnemy): its kind's gold and up to 2 more,
  // split into big, medium and small nuggets (world/nuggets.js spillGold), thrown up out of it
  const amount = Math.round(f.k.gold + Math.floor(S.rnd() * 3));
  spillGold(S.coins, f.x, f.ty, amount);
  S.gold += amount;
  if (S.coins.length > TITLE_GOLD) S.coins.splice(0, S.coins.length - TITLE_GOLD);
}

/** @param {TitleScene} S @param {Enemy} f @param {number} dmg @param {string} col */
function hitFoe(S, f, dmg, col) {
  if (f.hp <= 0) return;
  f.hp -= dmg; f.flash = 0.08;
  if (f.k.kp) f.aggro = true;          // as in the game: hurt a spider, a jelly or a rat and it comes for you
  burst(S, f.x - S.scroll, f.ty, 4, col, 80, 'spark', 0.25);
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
    for (const g of S.foes) if (Math.hypot(g.x - S.scroll - s.x, g.ty - s.y) < r + g.r) hitFoe(S, g, 4, s.col);
    for (const p of S.props) if (p.k === 'lamp' && !p.gone && lampHit(p, s.x, s.y, r)) popLamp(S, p);
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
  if (S.spawn <= 0 && S.foes.length < TITLE_FOES - 10) { addFoe(S); S.spawn = 0.4 + R() * 0.6; }
  for (const r of S.runners) stepRunner(S, r, dt);
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
    if (p.kind === 'ember') {
      p.vy += GRAVITY * 0.45 * dt; p.x += (p.vx - SCROLL) * dt; p.y += p.vy * dt;
      const c = Math.floor((p.x + S.scroll) / TCELL), r = Math.floor(p.y / TCELL), m = titleCell(S, c, r);
      if (FUEL[m]) lightArea(S, p.x + S.scroll, p.y, 2, 0.6);
      if (SOLID[m]) { lightArea(S, p.x + S.scroll - p.vx * dt, p.y - p.vy * dt, 4, 0.85); p.life = 0; }
      continue;
    }
    if (p.kind === 'flame') {          // world/props.js's dparts: GRAVITY × g (-0.03), gone on rock
      p.vy += GRAVITY * -0.03 * dt; p.x += (p.vx - SCROLL) * dt; p.y += p.vy * dt;
      if (titleSolid(S, p.x, p.y)) p.life = 0;
      continue;
    }
    if (p.kind === 'fsmoke') {         // game/systems/particles.js smoke
      p.x += (p.vx - SCROLL) * dt; p.y += p.vy * dt; p.vx *= 1 - 2.5 * dt; p.vy = p.vy * (1 - 2.5 * dt) - 12 * dt; p.r += 5 * dt;
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
  stepGold(S, dt);
  for (const b of S.booms) b.t += dt;
  S.booms = S.booms.filter(b => b.t < b.max);
  for (const z of S.zaps) z.t -= dt;
  S.zaps = S.zaps.filter(z => z.t > 0);
  stepSway(S, dt);
  // plants whose rock is gone fall away (and an arch's strands with it)
  for (const p of S.props) {
    p.x = p.ox - S.scroll;
    if (p.gone) continue;
    if (p.drop) {                       // falling: down until it hits rock (a burning one lights it) or leaves
      p.vy = (p.vy || 0) + GRAVITY * 0.5 * dt; p.y += p.vy * dt;
      if (p.y > S.vh) p.gone = true;
      else if (titleSolid(S, p.x, p.y + 1)) {
        p.gone = true; burst(S, p.x, p.y, 3, p.st === 'silk' ? '#eef0f6' : '#5a8a3a', 40, 'chunk', 0.6);
        if (p.burn) lightArea(S, p.ox, p.y, 6, 0.8);
      }
      continue;
    }
    if (p.burn && p.k !== 'climb') continue;
    if (p.k === 'lamp') {
      if (p.fall) {
        p.vy = (p.vy || 0) + GRAVITY * 0.5 * dt; p.y += p.vy * dt;
        if (titleSolid(S, p.x, p.y + p.len + 9)) popLamp(S, p);
      } else if (p.x > -10 && p.x < TITLE_VW + 10 && !HOLDS[titleCell(S, p.ac, p.ar)]) { p.fall = true; p.vy = 0; }
      continue;
    }
    if (p.arc) {                        // an arch whose end has lost its rock: cut there, the rest hangs from the other end
      const n = p.arc.length - 1, bc = Math.floor((p.ox + p.arc[n][0]) / TCELL), br = Math.floor((p.y + p.arc[n][1] - 2) / TCELL);
      // (an end only once its rock is made: titleCell is air past the columns made so far)
      const ok0 = p.ac >= S.gen || !!SOLID[titleCell(S, p.ac, p.ar)], ok1 = bc >= S.gen || !!SOLID[titleCell(S, bc, br)];
      if (p.x + (p.span || 0) > -10 && p.x < TITLE_VW + 10 && (!ok0 || !ok1)) cutArch(S, p, ok0 ? 1 : 0, false, ok0, ok1);
      continue;
    }
    if (p.host && p.host.gone) { p.host = null; p.on = null; p.drop = true; p.vy = 0; continue; }
    if (!p.host && p.ac != null && p.x > -10 && p.x < TITLE_VW + 10 && !SOLID[titleCell(S, p.ac, p.ar)]) {
      if (canSwing(p)) { p.drop = true; p.vy = 0; }
      else { p.gone = true; burst(S, p.x, p.y, 3, '#5a8a3a', 40, 'chunk', 0.7); }
    }
  }
  S.props = S.props.filter(p => !p.gone && p.ox + (p.span || 0) - S.scroll > -60);
  S.webs = S.webs.filter(L => Math.max(L.a0x, L.b0x) - S.scroll > -40);
}

/** @param {TitleScene} S @param {TRunner} r @param {number} dt */
function stepRunner(S, r, dt) {
  const x0 = r.x, y0 = r.y;
  stepRunnerMove(S, r, dt);
  // how fast he's going through the world (it scrolls under him): what pushes the vines and webs he passes
  const k = Math.min(1, 12 * dt);
  r.wvx += (Math.max(-250, Math.min(250, (r.x - x0) / Math.max(dt, 1e-3) + SCROLL)) - r.wvx) * k;
  r.wvy += (Math.max(-250, Math.min(250, (r.y - y0) / Math.max(dt, 1e-3))) - r.wvy) * k;
  stepRunnerGun(S, r, dt);
}
/** @param {TitleScene} S @param {TRunner} r @param {number} dt */
function stepRunnerMove(S, r, dt) {
  const R = S.rnd, cx = () => r.x + PW / 2;
  // first, a safety net (owner saw him stuck under the floor, shooting from inside it): his middle in rock, or
  // his feet well below the cave's floor line (down a blast hole that closed over him), and he's
  // popped back up onto the first surface under the roof
  {
    const wx = cx() + S.scroll, fl = titleFloor(wx, S);
    if (titleSolid(S, cx(), r.y + PH * 0.5) || r.y + PH > fl + 16) {
      r.y = titleSurf(S, cx(), titleCeil(wx, S) + 4, 1) - PH; r.vy = 0; S.pops++;
    }
  }
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
  // the players keep out of each other's way: one too close alongside, and they ease apart
  for (const o of S.runners) if (o !== r && Math.abs(o.x - r.x) < 16 && Math.abs(o.y - r.y) < PH) {
    const push = (16 - Math.abs(o.x - r.x)) * 3 * dt * (r.x < o.x || (r.x === o.x && r.id < o.id) ? -1 : 1);
    r.x += push; if (r.mode === 'run') r.tx += push;
  }
  r.x = Math.max(8, Math.min(TITLE_VW * 0.62, r.x));
}
/** @param {TitleScene} S @param {TRunner} r @param {number} dt */
function stepRunnerGun(S, r, dt) {
  const R = S.rnd, cx = () => r.x + PW / 2;
  // aim at the nearest creature within TITLE_AIM, well on screen (owner: they come into view before he blasts them)
  let best = null, bd = TITLE_AIM;
  for (const f of S.foes) { const fx = f.x - S.scroll, d = Math.hypot(fx - r.x, f.ty - r.y); if (f.hp > 0 && fx < TITLE_VW - 24 && fx > cx() - 30 && d < bd) { bd = d; best = f; } }
  const gx0 = cx(), gy0 = r.y + PH * 0.45;
  if (best) {
    const want = Math.atan2(best.ty - gy0, best.x - S.scroll - gx0);
    let d = want - r.ang; d = Math.atan2(Math.sin(d), Math.cos(d));
    r.ang += d * Math.min(1, dt * 10);
  } else r.ang += (0 - r.ang) * Math.min(1, dt * 4);
  r.face = Math.cos(r.ang) >= 0 ? 1 : -1;
  // every few seconds: another gun
  r.swapT -= dt; r.swap = Math.max(0, r.swap - dt);
  if (r.swapT <= 0) {
    r.kit = titleKit(R); S.kitNames.add(r.kit.name);
    r.swapT = 3.5 + R() * 2.5; r.swap = 0.3; r.cd = 0.35; S.swaps++;
  }
  r.cd -= dt;
  if (!best || r.cd > 0 || r.swap > 0) return;
  const K = r.kit, mz = gunMuzzle(gx0 + Math.cos(r.ang) * 2.5, gy0, r.ang, GUN_HELD, K.art), gx = mz.x, gy = mz.y;   // out of its barrel
  r.cd = K.cd * (0.85 + R() * 0.3);
  const n = Math.min(12, K.n);
  if (K.shot === 'zap') {
    // lightning: an arc into the creature (more of them: the next nearest), and one throwing off into the rock below it
    const near = S.foes.filter(f => f.hp > 0 && f.x - S.scroll < TITLE_VW).sort((a, b) => Math.hypot(a.x - best.x, a.ty - best.ty) - Math.hypot(b.x - best.x, b.ty - best.ty));
    for (const f of near.slice(0, Math.min(4, n))) {
      const bx = f.x - S.scroll, by = f.ty;
      zapArc(S, gx, gy, bx, by, K.col);
      const fl = titleSurf(S, bx, by + f.r, 1);
      if (fl - by < 50 && R() < 0.6) { zapArc(S, bx, by, bx + (R() - 0.5) * 16, fl + 1, K.col); titleCarve(S, bx, fl + 1, 2.5); titleIgnite(S, bx, fl + 1, 4); }
      hitFoe(S, f, 3 * K.dmg / 2.2, K.col);
    }
    return;
  }
  for (let i = 0; i < n; i++) {
    const spread = K.spread * Math.PI / 180;
    const a = r.ang + (n > 1 ? (i / (n - 1) - 0.5) * spread * 2 : (R() - 0.5) * spread);
    const v = K.speed * SP * (0.9 + R() * 0.2);
    S.shots.push({ x: gx, y: gy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: K.size, col: K.col, look: K.look, life: K.life * 1.6,
      foe: false, spin: R() * 6, grav: K.grav * SP, drag: K.drag, explode: K.explode, pit: K.pit, fire: K.fire,
      bounce: K.bounce, bounceE: K.bounceE, pierce: K.pierce, dmg: K.dmg, homing: K.homing, accel: K.accel, vmax: K.vmax * SP, chain: K.chain });
  }
  burst(S, gx, gy, 3, K.col, 40, 'spark', 0.12);
}

// a lightning arc from one point to another (drawn with the game's drawBolt)
/** @param {TitleScene} S @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @param {string} col */
function zapArc(S, x0, y0, x1, y1, col) {
  const R = S.rnd, pts = [{ x: x0, y: y0 }];
  for (let i = 1; i < 7; i++) { const k = i / 7; pts.push({ x: x0 + (x1 - x0) * k + (R() - 0.5) * 9, y: y0 + (y1 - y0) * k + (R() - 0.5) * 9 }); }
  pts.push({ x: x1, y: y1 });
  S.zaps.push({ pts, t: 0.16, col });
}

// blasts and fire cut the web lines they touch
/** @param {TitleScene} S @param {number} wx @param {number} y @param {number} r */
function cutWebs(S, wx, y, r) {
  let n = 0;
  for (const L of S.webs.slice()) {
    const vx = L.b0x - L.a0x, vy = L.b0y - L.a0y, ll = vx * vx + vy * vy || 1;
    const u = Math.max(0, Math.min(1, ((wx - L.a0x) * vx + (y - L.a0y) * vy) / ll)), p = titleWebAt(L, u);
    if (Math.hypot(p.x - wx, p.y - y) <= r + 1.5) { cutWeb(S, L, u, false); n++; }
  }
  if (n) burst(S, wx - S.scroll, y, 3, '#eef0f6', 40, 'spark', 0.3);
}

// The creatures' frame, as the game's (game/systems/enemies.js stepEnemies and the acts in
// game/creatures/): timers; aggro on a sightline within reach (its kind's aggro × the zoom × DEV.aggro
// × its own roll, kept until he's DEV.loseAggro times that away); then its act, run on the real brain:
// a jellyfish swims (jellyStep, keeping to the natural zones) and spits when lined up; a spider crawls
// rock and its own lines and spins new ones (spiderStep) and strings him from range; a rat roams
// (roamStep, fanning out, ratSpread) or runs him down along the way (navField / navWay, ratStep) and
// bites. He isn't hurt on the title. Then fire on them (burning hurts) and the ones left behind go
/** @param {TitleScene} S @param {number} dt */
function stepFoes(S, dt) {
  const R = S.rnd, CS = csolid(S), sees = 1 / DEV.zoom;
  for (const e of S.foes) {
    const k = e.k, ru = nearestRunner(S, e.x - S.scroll, e.ty);
    const pcx = S.scroll + ru.x + PW / 2, pcy = ru.y + PH / 2, goal = { x: pcx, y: pcy };
    e.flash -= dt; e.cd -= dt; e.touch -= dt;
    const dx = pcx - e.x, dy = pcy - e.ty, dist = Math.hypot(dx, dy) || 1;
    e.lx = dx / dist; e.ly = dy / dist;
    if (k.kp && ((e.aggroT = (e.aggroT || 0) - dt) <= 0)) { e.aggroM = kr(k.kp + 'Aggro', R); e.aggroT = 1; }
    const reach = k.aggro * sees * DEV.aggro * carrotAt('caAggro', 0) * (k.kp ? e.aggroM : 1);
    if (!e.aggro) { if (dist < reach && losClear(e.x, e.ty, pcx, pcy, CS)) e.aggro = true; }
    else if (dist > reach * DEV.loseAggro) e.aggro = false;
    const hunting = !!e.aggro;
    if (k.act === 'jelly') jellyAct(S, e, hunting, goal, sees, CS, dt);
    else if (k.act === 'spider') spiderAct(S, e, hunting, goal, sees, dist, dx, dy, CS, dt);
    else if (k.act === 'rat') ratAct(S, e, ru, hunting, CS, dt);
    e.ty = e.y;
    // a bite when it reaches him (he takes no harm here: a puff where it lands)
    if (hunting && dist < e.r + 14 && e.touch <= 0) { e.touch = kr(k.kp + 'BiteCd', R); burst(S, ru.x + PW / 2, ru.y + PH / 2, 4, '#ff6a5a', 50, 'spark', 0.2); }
    // on fire (game/systems/fire.js): it catches from burning cells, burns for a while, hurt as it goes
    if (!(e.burn > 0) && S.fire.length && fireNear(S, e.x, e.ty, e.r * 0.7)) e.burn = kr('fireBurn', R);
    if (e.burn > 0) {
      e.burn -= dt;
      if (R() < dt * 40) flameAt(S, e.x - S.scroll + (R() - 0.5) * e.r, e.ty + (R() - 0.5) * e.r);
      if (R() < dt * 6) fireSmoke(S, e.x - S.scroll, e.ty - e.r);
      hitFoe(S, e, kr('fireDps', R) * dt, '#ff9a2e');
    }
  }
  S.foes = S.foes.filter(e => e.hp > 0 && e.x - S.scroll > -40 && e.y < S.vh + 20);
  // spider strings in flight (game/creatures/spider.js spiderFrame): rock stops them; reaching him, gone
  for (const b of S.silk) {
    b.life -= dt;
    const n = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 2);
    for (let s = 0; s < n && b.life > 0; s++) {
      b.x += b.vx * dt / n; b.y += b.vy * dt / n;
      if (CS(Math.floor(b.x / CELL), Math.floor(b.y / CELL)) || S.runners.some(q => Math.abs(b.x - S.scroll - q.x - PW / 2) < PW / 2 + 3 && Math.abs(b.y - q.y - PH / 2) < PH / 2 + 3)) b.life = 0;
    }
  }
  S.silk = S.silk.filter(b => b.life > 0);
}
/** @param {TitleScene} S @param {Enemy} e @param {boolean} hunting @param {Pt} goal @param {number} sees @param {(cx: number, cy: number) => number} CS @param {number} dt */
function jellyAct(S, e, hunting, goal, sees, CS, dt) {
  const R = S.rnd;
  jellyStep(e, { solidCell: CS, hunting, goal, rnd: R, speedMul: 1, rangeMul: sees, stay: x => built(x) === 0 }, dt);
  const J = e.je;
  if (hunting && J && J.inRange && J.aimed && e.cd <= 0) {
    e.cd = 0.25;                                // no clear line: look again shortly
    const hx = e.x + Math.cos(J.hd) * e.r * 0.9, hy = e.y + Math.sin(J.hd) * e.r * 0.9;
    if (losClear(hx, hy, goal.x, goal.y, CS)) {
      e.cd = kr('jeShotCd', R);
      const a = Math.atan2(goal.y - hy, goal.x - hx) + (R() * 2 - 1) * kr('jeSpread', R) * Math.PI / 180, v = kr('jeShotSpd', R), P = jellyPal(J.u.col);
      S.shots.push({ x: hx - S.scroll, y: hy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: kr('jeShotSize', R), col: P.spit, look: 'glob', life: 3, foe: true, spin: 0,
        grav: 0, drag: 0, explode: 0, pit: 0, fire: 0, bounce: 0, bounceE: 0, pierce: 0, dmg: 0 });
    }
  }
}
/** @param {TitleScene} S @param {Enemy} e @param {boolean} hunting @param {Pt} goal @param {number} sees @param {number} dist @param {number} dx @param {number} dy @param {(cx: number, cy: number) => number} CS @param {number} dt */
function spiderAct(S, e, hunting, goal, sees, dist, dx, dy, CS, dt) {
  const R = S.rnd;
  // on a line it rides the line's sag, which spiderStep doesn't know about: last frame's off, this frame's on
  if (e.wox || e.woy) { e.x -= e.wox || 0; e.y -= e.woy || 0; e.wox = e.woy = 0; }
  spiderStep(e, { solidCell: CS, webs: S.webs, hunting, goal, rnd: R, speedMul: 1 }, dt);
  const P = e.sp;
  if (P && P.mode === 'line' && P.line) {
    S.lineT += dt;
    const L = P.line, vx = L.b0x - L.a0x, vy = L.b0y - L.a0y, u = Math.max(0, Math.min(1, ((e.x - L.a0x) * vx + (e.y - L.a0y) * vy) / (vx * vx + vy * vy || 1)));
    e.woy = 4 * u * (1 - u) * (L.sag || 0); e.y += e.woy;
  }
  e.silkT = (e.silkT || 0) - dt;
  if (hunting && e.silkT <= 0 && P && (P.mode === 'surf' || P.mode === 'line') && dist < (e.silkR || (e.silkR = spr('spSilk', R))) * sees && dist > e.r + 24) {
    e.silkT = 0.4;
    if (losClear(e.x, e.y, goal.x, goal.y, CS)) {
      e.silkT = spr('spSilkCd', R); e.silkR = spr('spSilk', R);
      const v = spr('spSilkSpd', R);
      S.silk.push({ x: e.x, y: e.y, ax: e.x, ay: e.y, vx: dx / dist * v, vy: dy / dist * v, life: 400 / v * 1.3 + 0.1 });
    }
  }
}
// a rat (game/creatures/rat.js ratFrame, without a nest or gold to carry home)
/** @param {TitleScene} S @param {Enemy} e @param {TRunner} ru the player it's after @param {boolean} hunting @param {(cx: number, cy: number) => number} CS @param {number} dt */
function ratAct(S, e, ru, hunting, CS, dt) {
  const R = S.rnd;
  let goal, jump = true;
  if (hunting) goal = { x: S.scroll + ru.x + PW / 2, y: ru.y + PH - 2 };
  else {
    const Ro = e.roam || (e.roam = {});
    roamStep(Ro, e, dt, R, 'ra');
    const D = e.spread || (e.spread = kr('raSpread', R)), sp = ratSpread(e, S.foes.filter(o => o.ra && Math.abs(o.x - e.x) < D && Math.abs(o.y - e.y) < D), D);
    Ro.rx += sp.x * D * 1.5 * dt; Ro.ry += sp.y * D * 1.5 * dt;
    goal = { x: Ro.rx + sp.x * D, y: Ro.ry + sp.y * D }; jump = false;
  }
  if (!e.arrive || R() < dt) e.arrive = kr('raArrive', R);
  let way = goal, follow = false, air = false;
  if (hunting && e.ra) {
    const F = navYou(S, ru, goal, CS), w = F && navWay(F, e.x, e.y, 1);
    if (w) { way = w.dist > 2 ? w : goal; follow = true; air = !!w.air && w.dist > 2; }
  }
  ratStep(e, { solidCell: CS, rnd: R, goal: way, hunting, home: false, path: undefined, follow, air, onWeb: onWeb(S),
    speedMul: 1, arrive: way === goal && hunting ? e.arrive : 3, jump }, dt);
}
// the way to a player, as the rats' distance field (world/nav.js navField), made again when he's moved
// on or every 0.4 s (game/creatures/rat.js navFor); one per player
/** @param {TitleScene} S @param {TRunner} ru @param {Pt} goal @param {(cx: number, cy: number) => number} CS */
function navYou(S, ru, goal, CS) {
  const o = ru.nav;
  if (!o.F || Math.hypot(goal.x - o.fx, goal.y - o.fy) > 12 || S.t - o.t > 0.4) {
    o.F = navField(CS, goal.x, goal.y, 56, onWeb(S)); o.fx = goal.x; o.fy = goal.y; o.t = S.t;
  }
  return o.F;
}
// the player nearest a screen point
/** @param {TitleScene} S @param {number} x @param {number} y */
function nearestRunner(S, x, y) {
  let best = S.runners[0], bd = Infinity;
  for (const r of S.runners) { const d = Math.hypot(r.x + PW / 2 - x, r.y + PH / 2 - y); if (d < bd) { bd = d; best = r; } }
  return best;
}
// a web line under a rat's feet counts as ground (game/creatures/rat.js onWebIn)
/** @param {TitleScene} S @returns {(x: number, y: number) => boolean} */
const onWeb = S => (x, y) => S.webs.some(L => {
  const vx = L.bx - L.ax, vy = L.by - L.ay, u = Math.max(0, Math.min(1, ((x - L.ax) * vx + (y - L.ay) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(L.ax + vx * u - x, L.ay + vy * u - y) < 3;
});

// the gold, as the game's (game/systems/pickups.js): a nugget falls, bounces and rolls (stepNugget),
// they push apart (collideNuggets); within COIN_PULL of him (and once its spill wait is up) it flies
// to him, straight through rock, faster the nearer, and is his at 12. Left behind, it goes
/** @param {TitleScene} S @param {number} dt */
function stepGold(S, dt) {
  const solid = wsolid(S);
  for (let i = S.coins.length - 1; i >= 0; i--) {
    const g = S.coins[i], ru = nearestRunner(S, g.x - S.scroll, g.y), pcx = S.scroll + ru.x + PW / 2, pcy = ru.y + PH / 2;
    const dx = pcx - g.x, dy = pcy - g.y, d = Math.hypot(dx, dy) || 1;
    if (g.nopull > 0) g.nopull -= dt;
    g.fly = false;
    if (d < COIN_PULL && !(g.nopull > 0)) {
      g.fly = true;
      const grab = 180 + 900 * (1 - d / COIN_PULL);
      g.vx = (g.vx || 0) + (dx / d) * grab * dt * 6; g.vy = (g.vy || 0) + (dy / d) * grab * dt * 6;
      g.vx *= 0.88; g.vy *= 0.88;
      g.x += g.vx * dt; g.y += g.vy * dt;
      if (d < 12) { S.got += g.amount; S.gotN++; S.coins.splice(i, 1); }
      continue;
    }
    stepNugget(g, dt, solid);
    if (g.x - S.scroll < -30) S.coins.splice(i, 1);
  }
  collideNuggets(S.coins, solid);
}

/** @param {TitleScene} S @param {number} dt */
function stepShots(S, dt) {
  for (const s of S.shots) {
    // homing (pollen, Homing, Seeker): turns onto the nearest creature; accelerating ones speed up to their top speed
    if (s.homing && !s.foe) {
      let tg = null, td = 90;
      for (const f of S.foes) { const d = Math.hypot(f.x - S.scroll - s.x, f.ty - s.y); if (f.hp > 0 && d < td) { td = d; tg = f; } }
      if (tg) {
        const sp = Math.hypot(s.vx, s.vy) || 1, want = Math.atan2(tg.ty - s.y, tg.x - S.scroll - s.x), a = Math.atan2(s.vy, s.vx);
        const da = Math.atan2(Math.sin(want - a), Math.cos(want - a)), na = a + Math.max(-1, Math.min(1, da)) * Math.min(1, s.homing * dt);
        s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp;
      }
    }
    if (s.accel) { const sp = Math.hypot(s.vx, s.vy) || 1, k = Math.min(1 + s.accel * dt, (s.vmax || 600) / sp); if (k > 1) { s.vx *= k; s.vy *= k; } }
    s.vy += s.grav * dt;
    if (s.drag) { const k = Math.exp(-s.drag * dt); s.vx *= k; s.vy *= k; }
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; s.spin += dt * 10;
    if (s.look === 'flame' && S.rnd() < dt * 20) burst(S, s.x, s.y, 1, '#ff7a1a', 15, 'fire', 0.3);
    if (s.foe) {
      if (S.runners.some(ru => Math.abs(ru.x + PW / 2 - s.x) < 7 && Math.abs(ru.y + PH / 2 - s.y) < 11)) { s.life = 0; burst(S, s.x, s.y, 6, s.col, 60, 'spark', 0.25); }
      if (titleSolid(S, s.x, s.y)) { s.life = 0; burst(S, s.x, s.y, 4, s.col, 40, 'spark', 0.3); }
      continue;
    }
    for (const p of S.props) if (p.k === 'lamp' && !p.gone && lampHit(p, s.x, s.y, s.size)) {
      popLamp(S, p);
      if (!s.pierce) { s.life = 0; burst(S, s.x, s.y, 3, s.col, 50, 'spark', 0.2); }
    }
    if (s.life <= 0) continue;
    for (const f of S.foes) {
      if (f.hp > 0 && Math.hypot(f.x - S.scroll - s.x, f.ty - s.y) < f.r + s.size) {
        hitFoe(S, f, s.dmg * 1.5, s.col);
        if (s.fire) f.burn = Math.max(f.burn || 0, kr('fireBurn', S.rnd));
        // a chain bolt leaps on to the next creature
        if (s.chain && !s.explode) {
          let nx = null, nd = 80;
          for (const g of S.foes) { const d = Math.hypot(g.x - S.scroll - s.x, g.ty - s.y); if (g !== f && g.hp > 0 && d < nd) { nd = d; nx = g; } }
          if (nx) {
            s.chain--; const sp = Math.hypot(s.vx, s.vy) || 1, a = Math.atan2(nx.ty - s.y, nx.x - S.scroll - s.x);
            s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp; s.x += s.vx * dt * 2; s.y += s.vy * dt * 2;
            zapArc(S, f.x - S.scroll, f.ty, nx.x - S.scroll, nx.ty, s.col); break;
          }
        }
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

// The fire, by the game's rules (world/fire.js fireStep, game/systems/fire.js fireFrame), in its
// FIRE_TICK steps: each burning cell tries every cell within two (up beats sideways beats down, two
// out a long shot) at the spread chance (fireSpread) × how readily its kind lights (FIRE_CATCH), and
// burns its kind's time (fireGrass / fireMoss / fireWood) before it's spent: moss chars, the rest go.
// Plants beside a fire catch and burn from the tip up at firePlant (lighting what's round the flame);
// an arched vine burns out both ways from where it caught at fireArch, lighting its strands as it
// reaches them; a web line near a fire burns out both ways, fast. Any of them burning lights the
// others it nearly touches (spreadFrom)
/** @param {TitleScene} S @param {number} dt */
function stepFire(S, dt) {
  const R = S.rnd;
  S.fireAcc = Math.min(S.fireAcc + dt, FIRE_TICK * 4);
  let ticks = 0;
  while (S.fireAcc >= FIRE_TICK) {
    S.fireAcc -= FIRE_TICK; ticks++; S.fireN++;
    const sp = kr('fireSpread', R) * TITLE_FIRESPEED, keep = [], n0 = S.fire.length;
    for (let k = 0; k < n0; k++) {
      const f = S.fire[k];
      if (f.c < S.gen - S.ncol || !FUEL[S.cells[ci(S, f.c, f.r)]]) { S.burning.delete(f.c * S.rows + f.r); continue; }   // carved away, or scrolled off
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (!dx && !dy) continue;
        const c = f.c + dx, r = f.r + dy;
        if (r < 0 || r >= S.rows || c < S.gen - S.ncol || c >= S.gen) continue;
        const kind = FUEL[S.cells[ci(S, c, r)]];
        if (kind && !S.burning.has(c * S.rows + r) && R() < sp * FIRE_UPW(dy) * (Math.max(Math.abs(dx), Math.abs(dy)) === 2 ? 0.3 : 1) * FIRE_CATCH[kind]) light(S, c, r);
      }
      if (--f.t > 0) { keep.push(f); continue; }
      const i = ci(S, f.c, f.r);
      S.cells[i] = S.cells[i] === TM.MOSS ? TM.CHAR : TM.AIR;
      S.burning.delete(f.c * S.rows + f.r);
      dirty(S, f.c, f.c, f.r, f.r + 2);   // and the rock under it, which may face up now (moss)
    }
    for (let k = n0; k < S.fire.length; k++) keep.push(S.fire[k]);   // the ones lit this tick
    S.fire = keep;
    // plants and arches beside the fire catch (a quarter of the plants a tick); web lines flare
    if (S.fire.length) {
      let q = 0;
      for (const p of S.props) {
        if (p.burn || p.gone || !burns(p) || R() > TITLE_FIRESPEED) continue;
        if (p.arc) {
          const n = p.arc.length - 1;
          for (let k = 0; k <= n; k += 2) if (fireNear(S, p.ox + p.arc[k][0], p.y + p.arc[k][1], 2)) { catchArch(S, p, k / n); break; }
        } else if ((q++ & 3) === (S.fireN & 3)) {
          for (let yy = p.y + 2; yy < p.y + p.len; yy += 8) if (fireNear(S, p.ox, yy, 2)) { catchPlant(S, p); break; }
        }
      }
      for (const L of S.webs.slice()) if (!L.fu && R() < TITLE_FIRESPEED) for (let u = 0; u <= 1; u += 0.25) {
        const w = titleWebAt(L, u);
        if (fireNear(S, w.x, w.y, 2)) { catchWeb(S, L, u); break; }
      }
    }
  }
  // flames and smoke off the burning cells, as game/systems/fire.js fireFrame: 2.5 a second a cell (at
  // most 20 a frame), off random ones, a puff of smoke with one in eight
  if (S.fire.length) {
    const want = Math.min(20, Math.ceil(S.fire.length * dt * 2.5));
    for (let a = 0; a < want; a++) {
      const f = S.fire[Math.floor(R() * S.fire.length)], x = (f.c + R()) * TCELL - S.scroll, y = f.r * TCELL;
      flameAt(S, x, y);
      if (R() < 0.12) fireSmoke(S, x, y - 3);
    }
  }
  // burning plants: from the tip toward the rock
  for (const p of S.props.slice()) {
    if (!p.burn || p.gone) continue;
    if (p.arc) { cutArch(S, p, ((p.u0 || 0.5) + (p.u1 || 0.5)) / 2, true); continue; }   // lit by hand: cut there
    // up from its tip (silk TITLE_WEBFIRE × faster), at TITLE_FIRESPEED × the game's; a swinging one's tip where it hangs
    p.len -= kr('firePlant', R) * TITLE_FIRESPEED * (p.st === 'silk' ? TITLE_WEBFIRE : 1) * dt;
    /** @type {any} */
    const pa = p;
    const tip = p.sw || p.tl ? vinePt(pa, Math.max(0, p.len)) : { x: 0, y: Math.max(0, p.len) }, tx = p.ox + tip.x, ty = p.y + tip.y;
    if (R() < dt * 30) flameAt(S, tx - S.scroll + (R() - 0.5) * 4, ty);
    if (R() < dt * 4) fireSmoke(S, tx - S.scroll, ty);
    if (ticks) {
      lightArea(S, tx, ty, 5, 0.3 * TITLE_FIRESPEED);
      spreadFrom(S, tx, ty);
      for (const o of S.props) if (!o.burn && !o.gone && !o.arc && burns(o) && Math.abs(o.ox - tx) < 10 && ty > o.y - 4 && ty < o.y + o.len + 4 && R() < 0.25 * TITLE_FIRESPEED) catchPlant(S, o);
    }
    if (p.len < 3) { p.gone = true; lightArea(S, tx, ty, 6, 0.5); }
  }
  // a web line lit by hand (fu): it's cut there
  for (const L of S.webs.slice()) if (L.fu) cutWeb(S, L, (L.fu[0] + L.fu[1]) / 2, true);
}
// what the title's fire burns: the game's flammable plants, and cut silk
/** @param {TProp} p */
const burns = p => !!FLAMMABLE[p.st] || p.st === 'silk';

// Fire jumps across (owner, v0.0.164): a flame at world point (wx, y) lights any vine, arch or web line
// within TITLE_JUMP of it, at TITLE_JUMPP a fire tick
/** @param {TitleScene} S @param {number} wx @param {number} y */
function spreadFrom(S, wx, y) {
  const R = S.rnd, J = TITLE_JUMP;
  for (const p of S.props) {
    if (p.burn || p.gone || !burns(p) || R() > TITLE_JUMPP) continue;
    if (p.arc) { const k = archK(p, wx, y, J - 3); if (k >= 0) catchArch(S, p, k / (p.arc.length - 1)); }
    else if (Math.abs(p.ox - wx) < J + 1 && y > p.y - J && y < p.y + p.len + J) catchPlant(S, p);
  }
  for (const L of S.webs.slice()) {
    if (L.fu || R() > TITLE_JUMPP) continue;
    for (let i = 0; i <= 8; i++) { const w = titleWebAt(L, i / 8); if (Math.hypot(w.x - wx, w.y - y) < J) { catchWeb(S, L, i / 8); break; } }
  }
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
