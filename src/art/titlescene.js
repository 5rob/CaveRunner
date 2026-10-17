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

import { COL, AIR_ACC, CELL, COIN_PULL, DEAD, GRAVITY, GROUND_ACC, JET as P_JET, JET_ACC, PATROL_R, PW, PH, WALK, WEB_HAND } from '../core/consts.js';
import { approach } from '../core/util.js';
import { NATURAL_ONLY, ROSTERS, enemyFor } from '../data/creatures.js';
import { THEMES } from '../data/themes.js';
import { DEV, carrotAt, kcol, kr, kru, spr } from '../dev/knobs.js';
import { jellyPal, jellyStep } from '../creatures/jelly.js';
import { ratSpread, ratStep } from '../creatures/rat.js';
import { spiderHold, spiderStep } from '../creatures/spider.js';
import { addSpawner, dropBats, newBats, panicGroup, stepBats } from '../creatures/bats.js';
import { newWorm, stepWorm } from '../creatures/glowworm.js';
import { roamStep } from '../creatures/common.js';
import { FIRE_CATCH, FIRE_COLS, FIRE_KNOB, FIRE_TICK, FIRE_UPW, FLAMMABLE } from '../world/fire.js';
import { navField, navWay } from '../world/nav.js';
import { collideNuggets, spillGold, stepNugget } from '../world/nuggets.js';
import { losClear } from '../world/vision.js';
import { archCurve, archNear } from '../world/decorate.js';
import { orbHeld, orbHubRest, orbPlace, orbSpring } from '../world/orbweb.js';
import { bendPush, swingStep, tailStep, vinePt, webAt, webNearU } from '../world/sway.js';
import { MODS, VAC_PULL } from '../spells/mods.js';
import { gunPassives } from '../spells/cast.js';
import { matchesTarget, targetsOf } from '../spells/discrim.js';
import { FIELD_SPEED, FOLLOW_PULL, SEEK_ACC } from '../spells/paths.js';
import { rustleStep } from '../audio/recipes.js';
import { pixText, pixWidth } from './pixfont.js';
import { GUN_HELD, gunMuzzle } from './sprites.js';
import { GUN_ART } from './gunart.js';
import { timberFallen, timberRng, timberSet, timberSlant } from './timber.js';
import { VIG_HP, VIG_TICK, gunPull, gunTick, perkDmg, planShots, shotsOf } from './scenegun.js';
import { playerStats } from '../auto/run.js';
import { hasTraj, trajAim, trajHome, trajLook, trajStep } from '../auto/traj.js';
import { FX_ROOM, MISSILE_TURN, MISSILE_WAIT, fireSpray, keepTrail, muzzleFx, nearestFoe, autoTrail, steerTo, zapFork, traceBeam, bigBoomFx, boomLook, holePull, vacPull } from '../auto/shotfx.js';
import { teamClearer } from '../auto/clear.js';
import { FUEL_TAKEOFF, fuelCan, fuelForClimb, fuelTick } from '../auto/fuel.js';
import { hangFind, hangSteer, lineHold, vineHeld, archView } from '../auto/hang.js';
import { ghostHome, ghostTarget, perkOn, shieldTick } from '../auto/perks.js';

export const TITLE_VW = 220;          // world units across the screen
export const TITLE_FOES = 24;         // at most this many creatures at once (a rat swarm counts each rat; v0.0.165: ×2)
export const TITLE_PARTS = 320;       // particle cap
export const FIRE_PARTS = 200;        // (owner v1.0.74: burning vines and silk lost their flames and smoke) room kept over the cap for the fire's specks (rock chunks filled it)
export const TITLE_GOLD = 90;         // nugget cap
export const TITLE_FIRE = 600;        // burning terrain cells at once
export const TCELL = 2;               // the terrain grid's cell (world units)
export const TITLE_ZLEN = [200, 360]; // a zone's length, the shortest and longest (world units; each zone its own, titlePlan)
// the zones it travels through (floor 1's natural and built-up looks), in a random order (owner: no repeats)
export const TITLE_ZONES = ['moss', 'webs', 'timber', 'paved', 'grove', 'winding', 'spider'];   // winding: v0.0.172 (owner); spider: after v1.0.74 (owner)
export const TITLE_MENU_ZONES = TITLE_ZONES.filter(z => z !== 'spider');   // the title menu's (the spider zone is the levels' only)
// (Coal Seams, owner 2026-10-16) an old floor's own zone set: floor 2 has the Mines (mine works), the Digging zone (winding caves) and
// the Cavern (the spider zone's boulders); every other floor the levels' every kind. Its decoration set: 'coal' (Mossy's plants off,
// the old game's mine set on: coalDeco), '' (Mossy Caves')
export const COAL_ZONES = ['timber', 'winding', 'spider'];
/** @param {number} floor */
export const floorZones = floor => (floor === 2 ? COAL_ZONES : TITLE_ZONES);
/** @param {number} floor */
export const floorDeco = floor => (floor === 2 ? 'coal' : '');
const ZMIX = 40;                      // the roof's and floor's shapes blend this far either side of a zone's border
export const ZBLEND = 28;             // a zone's border frays this far (world units) each way, by noise
export const TITLE_PACKY = 45;        // (Auto's tall level) a flyer's target at most this far up or down from the rest of the team
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
// STEEL, BWALL (a brick back wall, open) and SWALL (a steel back wall, open): the auto hub's room (auto/hub.js)
export const TM = { AIR: 0, ROCK: 1, MOSS: 2, BRICK: 3, WOOD: 4, CHAR: 5, BEAM: 6, BEAMD: 7, GRASS: 8, RUB: 9, RUBM: 10, STEEL: 11, BWALL: 12, SWALL: 13,
  ROOT: 14, SILT: 15, SILTD: 16, IRON: 17, IROND: 18, CRYS: 19, CRYSL: 20, NEST: 21, NESTD: 22, COAL: 23, RAIL: 24, ROCKL: 25 };   // 14 on: CaveRunner Auto's blocked zones (auto/blocked.js); COAL, RAIL (open: a minecart rail): Grem's Coal Seams
export const TITLE_SOLID = [0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1];
const SOLID = TITLE_SOLID;
// (Auto's level, owner v1.0.52: strong guns blasted the cave away down to the bottom edge) a blast bites less toward the
// play area's bottom (a tall level: the old height's stay as they were): × 1 down to DEV.autoHardDeep above the hard line,
// easing to 0 at it: autoHardEdge above the bottom edge, or the level's own (S.lvl.hardY at world x wx: auto/level.js raises it
// under the exit pad, v1.0.54) (pure)
/** @param {{ lvl?: { hardY?: (S: any, wx: number) => number }, vh: number, top: number, bot: number }} S @param {number} y @param {number} [wx] */
export const deepK = (S, y, wx) => (!S.lvl || DEV.autoHardDeep <= 0 || S.bot - S.top <= MINE_TALL ? 1
  : Math.max(0, Math.min(1, ((S.lvl.hardY && wx != null ? S.lvl.hardY(S, wx) : S.vh - DEV.autoHardEdge) - y) / DEV.autoHardDeep)));
const FUEL = [0, 0, 2, 0, 3, 0, 3, 3, 1, 0, 1, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 1, 1, 4, 0, 0];   // the fuel kind each burns as (world/fire.js: 1 grass, 2 moss, 3 timber, 4 coal)
// how readily a fuel kind catches (coal: × the Coal Seams knob)
/** @param {number} kind */
const catchOf = kind => FIRE_CATCH[kind] * (kind === 4 ? DEV.coalCatch : 1);
export const FRAME_GAP = 72;          // the built-up layers: a timber frame every this far (world units)
export const FRAME_W = 36;            // its width, post to post
const SCROLL = 34;                    // the world's scroll speed (world units / s)
// the scroll's speed now: SCROLL × the scene's pace (CaveRunner Auto's level, auto/pilot.js: S.pace; the title's is 1)
/** @param {{ pace?: number }} S */
const sv = S => SCROLL * (S.pace == null ? 1 : S.pace);
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
export const TITLE_SEP = 24;          // players closer than this (world units, height counted at 0.6) are eased apart
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
  winding: [['meduusa', 2], ['hamahakki', 1], ['rotta', 1]],
  spider: [['hamahakki', 5], ['meduusa', 1]],
};
// who comes into a zone: its TITLE_HOME list (a spider mine, Z.spid: the spiders')
/** @param {TZone} Z */
export const zoneHome = Z => TITLE_HOME[Z.spid ? 'spider' : Z.z] || TITLE_HOME.moss;
// the old floor's look at world x (S.looks: the last one starting at or before it; null: none, Mossy Caves)
/** @param {TitleScene} S @param {number} wx @returns {TLook | null} */
export function lookAt(S, wx) {
  if (!S.looks) return null;
  let L = null;
  for (const l of S.looks) if (l.x0 <= wx) L = l;
  return L;
}
// the kind that comes in at world x: an old floor's (its look's roster: the old game's makeLevel, each as likely, a jellyfish only where
// it isn't built up), else the zone's home list, weighted
/** @param {TitleScene} S @param {number} wx @returns {string} */
export function titleKind(S, wx) {
  const R = S.rnd, look = lookAt(S, wx), roster = look && look.roster;
  if (roster && roster.length) {
    const ok = roster.filter(id => !NATURAL_ONLY[enemyFor(id, 1).act] || built(wx, S) === 0);
    const from = ok.length ? ok : roster;
    return from[Math.floor(R() * from.length)];
  }
  const home = zoneHome(titleZoneSpan(wx, S));
  let roll = R() * home.reduce((a, h) => a + h[1], 0);
  for (const [q, w] of home) { if (roll < w) return q; roll -= w; }
  return home[0][0];
}
// the old game's classic creatures (data/creatures.js acts): they float (no gravity), shooters patrol and fire on sight,
// turrets hold station and fire, chasers come at you and bite, bombers come at you and burst (game/creatures/classic.js)
/** @type {Record<string, number>} */
const CLASSIC = { shoot: 1, turret: 1, chase: 1, bomb: 1 };

/** @typedef {{ art: string, shot: string, mods: string[], name: string, cd: number, n: number, dmg: number, speed: number, spread: number, size: number,
 *   life: number, grav: number, drag: number, explode: number, pit: number, fire: number, bounce: number, bounceE: number, pierce: number, homing: number,
 *   accel: number, vmax: number, chain: number, col: string, look: string }} TKit */
/** @typedef {{ x: number, y: number, vx: number, vy: number, face: number, ang: number, cd: number, kit: TKit, flame: number, id: number, col: string,
 *   mode: string, modeT: number, tx: number, ty: number, retarget: number, gait: number, ground: boolean, swapT: number, swap: number, wvx: number, wvy: number,
 *   dig: number, clearT: number, keep: TKit | null, dx: number, dy: number, digY: number, sawT: number, switches: number[],
 *   bursty: number, burst: boolean, jet: boolean, jetT: number, jetCd: number, pace: number, spd: number,
 *   nav: { F: any, fx: number, fy: number, t: number }, stepT?: number, sawS?: number, rst?: { t?: number }, rub?: string, rubWas?: boolean,
 *   hide?: boolean, out?: boolean, outT?: number, stand?: boolean, dealt?: number, shieldT?: number, fuel?: number, empty?: boolean, jetSt?: { cut: number, onT: number, start: boolean, gap?: number }, sputN?: number, dry?: boolean, shieldHit?: number, ghost?: { x: number, y: number, cd: number, fired: number } | null, clr?: { p: number, g: number } | null, clrT?: number,
 *   ctl?: RunnerCtl | null, ctlWas?: boolean, cvx?: number, jetIn?: { nx: number, ny: number } | null, jx?: number, jy?: number, smokeAcc?: number, smokeN?: number, rag?: import('../world/ragdoll.js').Ragdoll | null, lamp?: boolean,
 *   hang?: TProp | WebLine | null, hangGo?: number, swing?: number, ctlIdle?: number, navT?: number, goal?: TGoal | null }} TRunner */
// (goal: Grem Mode's tapped spot, owner v1.0.102: the autopilot heads there as it heads anywhere; goalStep)
/** @typedef {{ x: number, y: number, t: number, pick?: boolean }} TGoal */   // (pick: chasing Grem's tapped target, auto/level.js pickChase)
/** a player steered by hand (CaveRunner Auto, feedback round 2: the selected player in a level): the pill stick's push
 * @typedef {{ active: boolean, nx: number, ny: number, mag: number }} RunnerCtl */
// a fixed strip in place of the scrolling ring (CaveRunner Auto's hub, auto/hub.js): w columns, each cell's material from
// cell(c, r, rows); step runs after titleStep's own (the runners are its: S.still); data is the strip's own state;
// fits / take: as the level's, for the machines' payouts (S.loot) going into the bag (CaveRunner Auto stage 10b)
/** @typedef {{ w: number, cell: (c: number, r: number, rows: number) => number, step?: (S: TitleScene, dt: number) => void, data?: any,
 *   fits?: (S: TitleScene, it: BagItem) => boolean, take?: (S: TitleScene, it: BagItem) => boolean, pv?: any }} TitleHub */
/** @typedef {{ x: number, y: number, vx: number, vy: number, size: number, col: string, look: string, life: number, foe: boolean, spin: number,
 *   grav: number, drag: number, explode: number, pit: number, fire: number, bounce: number, bounceE: number, pierce: number, dmg: number,
 *   homing?: number, accel?: number, vmax?: number, chain?: number, hitFoe?: boolean, bore?: number, grindT?: number,
 *   real?: boolean, by?: number, trig?: string | null, timer?: number, pay?: Shot[] | null, age?: number,
 *   sid?: string, tr?: number[], homeR?: number, light?: string, lightR?: number,
 *   beam?: number, ang?: number, bx?: number, by2?: number, pull?: number, vac?: number, heal?: number, tick?: number, follow?: number, sp0?: number, orbit?: number, spiral?: number, boomer?: number, pong?: number, born?: number, back?: number, caught?: number, oa?: number, or0?: number, odir?: number, pdir?: number, ptr?: number[], homN?: number, seekN?: number, nearN?: number, autoaim?: number, aimed?: number, gravN?: number, floatN?: number, flat?: number, tgt?: Enemy | null, sp1?: number, max?: number, hopT?: number, hx?: number, hy?: number, only?: DiscrimTarget | null, manaB?: number, mana?: number }} TShot */
/** @typedef {{ x: number, y: number, vx: number, vy: number, life: number, max: number, r: number, col: string, kind: string, to?: { x: number, y: number, life: number }, fx?: boolean, u?: number, a?: number, g?: number, kx?: number, ky?: number }} TPart */
/** @typedef {{ x: number, y: number, r: number, t: number, max: number, sid?: string }} TBoom */
/** a nuke's mushroom cloud (game/render/autolooks.js drawMushroom): wx its world x, y the blast's, r its size
 * @typedef {{ wx: number, y: number, r: number, t: number, max: number, seed: number }} MushCloud */
/** @typedef {{ pts: { x: number, y: number }[], t: number, col: string, fade?: boolean }} TZap */
// a prop: `ox` its world x (not `wx`: art/props.js reads that as an arch's or a vine's sideways bend)
/** @typedef {{ k: string, st: string, ox: number, x: number, y: number, len: number, seed: number, side: number, burn: number, ac: number, ar: number, lit?: number, ch?: number, rot?: number, rv?: number, rp?: number[], rq?: number[], rs?: number,
 *   arc?: number[][], thick?: number, t?: number, span?: number, host?: TProp, gone?: boolean, u0?: number, u1?: number, alen?: number, u?: number,
 *   fall?: boolean, vy?: number, sw?: number, swv?: number, sj?: number, tl?: number[], tq?: number[], wx?: number, wy?: number, wvx?: number,
 *   wvy?: number, wu?: number, on?: TProp | null, drop?: boolean, links?: number, rust?: number, fuse?: number }} TProp */
// (rust: Coal Seams' rusted lantern; fuse: an explosive minecart's, s till it goes off)
/** @typedef {{ c: number, r: number, t: number }} TFire */
// (Coal Seams) a gas pocket: invisible methane in a low corner, world x wx, floor y; r its size; fuse: s till it goes off
/** @typedef {{ wx: number, y: number, r: number, fuse?: number, gone?: boolean }} TGas */
/** @typedef {{ t: number, vh: number, top: number, bot: number, seed: number, rnd: () => number, scroll: number, shake: number, spawn: number,
 *   kills: number, gold: number, got: number, runner: TRunner, runners: TRunner[], foes: Enemy[], shots: TShot[], parts: TPart[], coins: Coin[],
 *   booms: TBoom[], zaps: TZap[], flash: number, rows: number, ncol: number, cells: Uint8Array, gen: number, props: TProp[],
 *   fire: TFire[], lightLater?: number[][], tim?: Record<number, { x: number, sets: import('./timber.js').TSet[] }>, timCol?: Map<number, Uint8Array>, chutes?: { x: number, y: number, s: number }[], gas?: TGas[], gasNext?: number, bats?: import('../creatures/bats.js').Bats, batNext?: number, worms?: import('../creatures/glowworm.js').GlowWorm[], wormSlices?: Set<number>, wormPend?: { x: number, span: number, n: number, z: string, done?: boolean }[], wormClusters?: { x: number, y: number, n: number, z: string }[], wormRnd?: () => number, lootLater?: { f: Enemy, t: number }[], dirty: number[][], dirtyAll: boolean, carved: number, burnt: number, swaps: number, groundT: number, flyT: number, kinds: Record<string, number>,
 *   webs: WebLine[], orbN?: number, orbs?: Record<number, OrbRig>, mush?: MushCloud[], orbHub?: { x: number, y: number, r: number }[], orbT?: number, cut: number, lineT: number, silk: { x: number, y: number, ax: number, ay: number, vx: number, vy: number, life: number }[],
 *   nav: { F: any, fx: number, fy: number, t: number }, fireAcc: number, fireN: number, burning: Set<number>, gotN: number, pops: number, lampsPopped: number, kitNames: Set<string>,
 *   digT: number, digs: number, digWhy: Record<string, number>, still?: boolean, zp: TitlePlan, snd: TSnd[], hub?: TitleHub, lvl?: TitleLevel, lab?: boolean, back?: (ctx: CanvasRenderingContext2D, S: TitleScene) => void, pace?: number, team?: RunPlayer[], blocked?: number, blockedKind?: string, huddle?: boolean, gunsOff?: boolean, dmgMul?: number, coinWait?: number, hgoal?: number, hgoalT?: number, fuelWait?: number, tier?: number, loot?: TLoot[],
 *   onTake?: (it: BagItem, x: number, y: number) => void, pick?: Enemy | null, looks?: TLook[], eliteFx?: Particle[] }} TitleScene */
// (eliteFx: the elites' flames, world coordinates: stepEliteFx, drawn by titledraw.js; owner v1.0.103)
// (looks: a CaveRunner Auto level past the first plays as an old floor, auto/maps.js levelLook: its palette (titledraw.js), its
// ambience and its creatures, each as likely, jellyfish only in the natural zones (titleKind); none: Mossy Caves and the zones'
// own. In x order, each from its x0 on (Grem Mode: a new one past each boss's arena; the painter blends the seam, DEV.gremSeam*))
/** @typedef {{ x0: number, theme: Theme, name: string, roster: string[] | null, floor?: number }} TLook */
// (pick: Grem Mode's tapped target, ui/auto/GremScreen.js: every player aims at it while it lives, titleAimPick)
// a finite level in the scrolling ring (CaveRunner Auto, auto/level.js levelScene): zp its plan (made whole up front); step runs
// after titleStep's own; data is the level's own state. S.pace (0..) scales the scroll (auto/pilot.js)
// hurt(S, i, dmg): a creature hit player i for dmg (its kind's damage; auto/enemies.js levelHurt)
/** @typedef {{ zp: TitlePlan, kind?: (id: string, tier: number) => CreatureKind, hardY?: (S: TitleScene, wx: number) => number, step?: (S: TitleScene, dt: number) => void, data?: any, hurt?: (S: TitleScene, i: number, dmg: number) => void,
 *   loot?: (S: TitleScene, f: Enemy) => BagItem[], fits?: (S: TitleScene, it: BagItem) => boolean, take?: (S: TitleScene, it: BagItem) => boolean, lootCol?: (it: BagItem) => string,
 *   blockCell?: (B: import('../auto/blocked.js').ZoneBlock, wx: number, y: number, cy: number, fy: number, cur: number) => number,
 *   blockCol?: (S: TitleScene, B: import('../auto/blocked.js').ZoneBlock, c: number, wx: number, cy: number, fy: number) => void, blockKind?: (S: TitleScene, wx: number) => string, free?: (S: TitleScene, r?: TRunner) => boolean, fuel?: (S: TitleScene, r: TRunner) => { fuel: number, refuel: number } | null, spawn?: (S: TitleScene) => { gap: number, cap: number } }} TitleLevel */
// blockCell, blockCol, blockKind (CaveRunner Auto stage 6b, auto/blocked.js): a blocked zone's cells and web lines, and what a dig goes into
// loot (CaveRunner Auto, auto/level.js): what a kill drops (its gold spills as nuggets, the rest as TLoot pickups); fits: would it go in the bag;
// take: put it in the bag (false: it didn't fit). A pickup: the item, its colour, nopull (s before it can fly), wait (the bag is full)
/** @typedef {{ x: number, y: number, vx: number, vy: number, it: BagItem, col: string, t: number, nopull?: number, land?: number, ground?: number, wait?: boolean, fly?: boolean, amount?: number, left?: boolean,
 *   reach?: number, minT?: number }} TLoot */
// (reach, minT: a hub machine's item, feedback round 2: picked up only once minT s old and a player within reach of it: walk over it)
// a sound the scene asks for this frame (v0.0.174): ui/titlesound.js plays it with the game's own voice. k its name, x, y where (screen
// units), a what it needs (a creature's kind, a shot, a radius)
/** @typedef {{ k: string, x: number, y: number, a?: any }} TSnd */
// a zone of the plan (titlePlan): its kind, x0..x1, i its place in the plan; its roof's and floor's offset (co, fo), hills' height (ca, fa),
// stretch (cf, ff) and phases (ph); dens its plants and webs
/** @typedef {{ z: string, x0: number, x1: number, i: number, ph: number[], ca: number, fa: number, cf: number, ff: number, co: number, fo: number, dens: number, mine?: TMine, flat?: boolean, blk?: import('../auto/blocked.js').ZoneBlock, sv?: string, spid?: boolean, veg?: boolean }} TZone */
// (sv: the spider zone's variant, 'rocks' / 'vines' / 'beams'; spid: a zone the spiders have taken over, orb webs ×3 and spiders its creatures; veg: heavy vegetation,
// big patches of vines off the roof and every rock underside; which zone kinds may have them: zoneMay)
// (flat: a level's pad or arena, auto/level.js: no rubble, no ledges)
// a mine works' own layout (v0.0.170, mkMine): n tunnels stacked (0 the lowest), `ein` the one the cave comes in at, `eout`
// the one it leaves by; `lf` how high the stack sits (0 low .. 1 high, where there's room); `sh` the rock shelf over each;
// each tunnel's walled ends `L` / `Rx` (±Infinity: open, the way in or out); `holes` through a shelf (k: over tunnel k), and
// `steps`: where the way through moves to another tunnel (at a hole)
/** @typedef {{ n: number, ein: number, eout: number, lf: number, sh: number[], L: number[], Rx: number[], holes: { k: number, x: number, w: number }[],
 *   steps: { x: number, to: number }[] }} TMine */
/** @typedef {{ R: () => number, z: TZone[], kinds: string[], fk?: { x0: number, kinds: string[], deco: string }[] }} TitlePlan */
// (kinds: the zone kinds it picks from: the title's TITLE_MENU_ZONES, a level's all of TITLE_ZONES; fk (Grem Mode, Coal Seams): from
// each x0 on, an old floor's own kinds and decoration set instead (floorZones), the last one starting at or before a zone's x0)
// (still: the players stand where they are, for a test of something they'd otherwise saw through or shoot)

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

// The zone plan (owner, v0.0.168: the zones were one fixed loop): made from the scene's seed as the
// scroll needs it, each zone a random kind (none of the last two), its own length (TITLE_ZLEN), and its
// own roof and floor (how high, how hilly, how stretched, where the hills fall: `ph`), its plants'
// and webs' density `dens`. Pure; S.zp. A band given without one (a test's { top, bot }) uses seed 7's
/** @param {number} seed @param {string[]} [kinds] @returns {TitlePlan} */
export function titlePlan(seed, kinds = TITLE_MENU_ZONES) {
  return { R: titleRng((seed * 7919 + 13) >>> 0), z: [], kinds };
}
/** @param {TitlePlan} P @param {number} wx @returns {TZone} the zone at world x (the plan grown to it) */
function zoneIn(P, wx) {
  const Z = P.z, R = P.R;
  if (!Z.length) Z.push(mkZone(R, -300, [], kindsAt(P, -300)));
  while (Z[Z.length - 1].x1 <= wx) Z.push(mkZone(R, Z[Z.length - 1].x1, Z, kindsAt(P, Z[Z.length - 1].x1)));
  let lo = 0, hi = Z.length - 1;
  if (wx < Z[0].x0) return Z[0];
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (Z[m].x0 <= wx) lo = m; else hi = m - 1; }
  return Z[lo];
}
// the plan's next zone from x0, by the same rules (CaveRunner Auto's finite level, auto/level.js)
/** @param {TitlePlan} P @param {number} x0 @returns {TZone} */
export const titleZoneAdd = (P, x0) => { const z = mkZone(P.R, x0, P.z, kindsAt(P, x0)); P.z.push(z); return z; };
// the zone kinds (and decoration set) a zone starting at x0 picks from: the plan's own, or an old floor's (P.fk)
/** @param {TitlePlan} P @param {number} x0 @returns {{ kinds: string[], deco: string }} */
function kindsAt(P, x0) {
  /** @type {{ kinds: string[], deco: string }} */
  let k = { kinds: P.kinds, deco: '' };
  for (const f of P.fk || []) if (f.x0 <= x0) k = f;
  return k;
}
/** @param {() => number} R @param {number} x0 @param {TZone[]} Z the zones so far @param {{ kinds: string[], deco: string }} K the kinds it picks from, the decoration set @returns {TZone} */
function mkZone(R, x0, Z, K) {
  // (none of the last two; a set of three or fewer, Coal Seams': not the last one, so it isn't a fixed loop)
  const kinds = K.kinds, last = Z.slice(kinds.length > 3 ? -2 : -1).map(q => q.z), can = kinds.filter(z => !last.includes(z));
  const z = can[Math.floor(R() * can.length)], len = (TITLE_ZLEN[0] + R() * (TITLE_ZLEN[1] - TITLE_ZLEN[0])) * zk(z, 'len');
  // (Dev → Zones) each kind's own knobs (zk) scale what's rolled: hills, how close they are, roof and floor up or down, density
  /** @type {TZone} */
  const Zn = { z, x0, x1: x0 + len, i: Z.length, ph: [R() * 99, R() * 99, R() * 99, R() * 99, R() * 99],
    ca: (0.5 + R() * 0.9) * zk(z, 'hillsC'), fa: (0.5 + R() * 0.9) * zk(z, 'hillsF'), cf: (0.6 + R() * 0.8) * zk(z, 'close'), ff: (0.6 + R() * 0.8) * zk(z, 'close'),
    co: -6 + R() * 16 + zk(z, 'roof', 0), fo: -10 + R() * 16 + zk(z, 'floor', 0), dens: (0.6 + R() * 0.8) * zk(z, 'dens'),
    mine: z === 'timber' ? mkMine(R, x0, x0 + len) : undefined };
  // (owner, after v1.0.74) the spider zone's variant, and the spiders' mines: their own numbers (seeded by x0), so the plan's
  // draws stay as they were
  const v = titleRng((Math.floor(x0) * 53 + 11) >>> 0)();
  // (Dev → Zones) each zone kind may have each variant or not (zoneMay): the spider zone's vines look is its heavy vegetation
  // (Coal Seams: no heavy vegetation, so the spider zone's vines look is its boulders)
  const veg = K.deco !== 'coal';
  if (z === 'spider') Zn.sv = v < 0.4 ? 'rocks' : v < 0.7 ? (veg && zoneMay(z, 'veg') ? 'vines' : 'rocks') : 'beams';
  if (z === 'spider') Zn.veg = Zn.sv === 'vines';
  else if (veg && zoneMay(z, 'veg') && titleRng((Math.floor(x0) * 71 + 5) >>> 0)() < DEV.autoVegChance) Zn.veg = true;
  if (z !== 'spider' && zoneMay(z, 'spid') && v < DEV.autoSpiderMine) Zn.spid = true;
  return Zn;
}
// (Dev → Zones) zone kind z's knob k (DEV.zl_<z>_<k>; d when it has none: a kind without that knob, the old numbers)
/** @param {string} z @param {string} k @param {number} [d] */
export const zk = (z, k, d = 1) => { const v = DEV['zl_' + z + '_' + k]; return typeof v === 'number' ? v : d; };
// The zone variants (Dev → Zones, ui/zonesim.js): heavy vegetation, spider web filled. Which zone kinds may roll each is a Dev
// flag (DEV.zv_<variant>_<zone>, 1 / 0, set on that page); the spider zone is always web filled
/** @type {[string, string][]} */
export const ZONE_VARIANTS = [['veg', 'Heavy vegetation'], ['spid', 'Spider web filled']];
/** @param {string} z zone kind @param {string} v variant */
export const zoneMay = (z, v) => (v === 'spid' && z === 'spider') || !!DEV['zv_' + v + '_' + z];
// a zone of kind z with the variants vars, forced (Dev → Zones' preview, art/zonelab.js): the plan's next zone from x0
/** @param {TitlePlan} P @param {number} x0 @param {string} z @param {{ veg?: boolean, spid?: boolean }} vars @returns {TZone} */
export function titleZoneForce(P, x0, z, vars) {
  const Zn = mkZone(P.R, x0, [], { kinds: [z], deco: '' });
  Zn.i = P.z.length;
  if (z === 'spider') { if (vars.veg) Zn.sv = 'vines'; else if (Zn.sv === 'vines') Zn.sv = 'rocks'; }
  Zn.veg = !!vars.veg; Zn.spid = z !== 'spider' && !!vars.spid;
  P.z.push(Zn);
  return Zn;
}
// A mine works' layout (owner, v0.0.170: it was always one low tunnel with a closed one over it): 1–3 tunnels,
// come in at any of them and leave by any (a high way in, a low way out…), the others walled off at that end
// some way in; holes through the shelves, one at least on the way through (in order along it), more at random
/** @param {() => number} R @param {number} x0 @param {number} x1 @returns {TMine} */
function mkMine(R, x0, x1) {
  const n = R() < 0.3 ? 1 : R() < 0.55 ? 2 : 3, ein = Math.floor(R() * n), eout = Math.floor(R() * n);
  const sh = Array.from({ length: n - 1 }, () => (n === 3 ? 12 + R() * 5 : 14 + R() * 8));   // three fit under the title
  const L = Array.from({ length: n }, (_, k) => (k === ein ? -Infinity : x0 + 44 + R() * 60));
  const Rx = Array.from({ length: n }, (_, k) => (k === eout ? Infinity : x1 - 44 - R() * 60));
  /** @type {{ k: number, x: number, w: number }[]} */
  const holes = [], steps = [];
  // the way through: one hole per shelf between ein and eout, at rising x across the middle of the works
  const dir = Math.sign(eout - ein), m = Math.abs(eout - ein);
  for (let i = 0; i < m; i++) {
    const lo = Math.min(ein + i * dir, ein + (i + 1) * dir), a = x0 + 70 + (x1 - x0 - 140) * (i + 0.2 + R() * 0.6) / m;
    holes.push({ k: lo, x: a, w: 14 + R() * 10 });
    steps.push({ x: a, to: ein + (i + 1) * dir });
  }
  // and now and then another, anywhere both tunnels are open
  for (let k = 0; k < n - 1; k++) if (R() < 0.45) {
    const a0 = Math.max(L[k], L[k + 1], x0 + 50) + 12, a1 = Math.min(Rx[k], Rx[k + 1], x1 - 50) - 12;
    if (a1 > a0) holes.push({ k, x: a0 + R() * (a1 - a0), w: 12 + R() * 10 });
  }
  // (Auto's tall level) up to MINE_MORE more tunnels over the stack, dead-ended both ends, linked by holes now and then: mineBands
  // stacks as many as the band has room for. Their own numbers (seeded by x0), so the plan's draws stay as they were
  const R2 = titleRng((Math.floor(x0) * 31 + 7) >>> 0);
  for (let e = 0; e < MINE_MORE; e++) {
    const k = n + e;
    L.push(x0 + 44 + R2() * 60); Rx.push(x1 - 44 - R2() * 60); sh.push(12 + R2() * 8);
    const a0 = Math.max(L[k - 1], L[k], x0 + 50) + 12, a1 = Math.min(Rx[k - 1], Rx[k], x1 - 50) - 12;
    if (a1 > a0 && R2() < 0.8) holes.push({ k: k - 1, x: a0 + R2() * (a1 - a0), w: 12 + R2() * 10 });
  }
  return { n, ein, eout, lf: R() * 0.6, sh, L, Rx, holes, steps };
}
const MINE_TALL = 200;                // … only in a band taller than this (world units: the old height's stays as it was)
const MINE_MORE = 5;                  // a mine's extra tunnels at most (a tall level's; none fit at the old height)
// a mine's tunnels in a band (top, bot): each one's roof c and floor f, the stack set by lf in the room there is
/** @param {TMine} M @param {{ top: number, bot: number }} B @returns {{ c: number, f: number }[]} */
export function mineBands(M, B) {
  const lo = B.bot - 10, hi = B.top - 2;
  let total = M.n * TIMBER_H + M.sh.slice(0, M.n - 1).reduce((a, v) => a + v, 0), nk = M.n;
  while (lo - hi > MINE_TALL && nk < M.L.length && total + M.sh[nk - 1] + TIMBER_H + 30 <= lo - hi) { total += M.sh[nk - 1] + TIMBER_H; nk++; }
  let f = lo - M.lf * Math.max(0, lo - hi - total - 10) - (nk < 3 ? 10 : 0);
  const out = [];
  for (let k = 0; k < nk; k++) { out.push({ c: f - TIMBER_H, f }); f = f - TIMBER_H - (M.sh[k] || 0); }
  return out;
}
// how far a tunnel is dug past its frames at x: its roof up, its floor down (big lumps and a fine fray)
/** @param {number} wx @param {number} k */
const dig = (wx, k) => ({ up: 2 + titleNoise(wx / 11, 31 + k * 5) * 8 + titleNoise(wx / 3, 37 + k * 5) * 4,
  dn: titleNoise(wx / 9, 61 + k * 5) * 2.5 + titleNoise(wx / 2.5, 67 + k * 5) * 1.5 });
// the tunnel the way through is in at x
/** @param {TMine} M @param {number} wx */
const mainBand = (M, wx) => M.steps.reduce((b, s) => (wx >= s.x ? s.to : b), M.ein);
const DEF_PLAN = titlePlan(7);
/** @param {{ zp?: TitlePlan }} [B] */
const planOf = B => (B && B.zp) || DEF_PLAN;
/** @param {number} wx @param {{ zp?: TitlePlan }} [B] the scene (its plan) @returns {TZone} */
export const titleZoneSpan = (wx, B) => zoneIn(planOf(B), wx);
/** @param {TZone} Z @param {number} i @param {{ zp?: TitlePlan }} [B] @returns {TZone} the zone i on from Z (−1: the one before) */
const zoneNext = (Z, i, B) => { const P = planOf(B); zoneIn(P, Z.x1 + 1); return P.z[Math.max(0, Z.i + i)]; };
// which zone a world x is in, and how built-up it is there (0 natural .. 1 in a works, ramped at the ends)
/** @param {number} wx @param {{ zp?: TitlePlan }} [B] @returns {string} */
export const titleZone = (wx, B) => titleZoneSpan(wx, B).z;
/** @param {number} wx @param {{ zp?: TitlePlan }} [B] */
const built = (wx, B) => {
  const Z = titleZoneSpan(wx, B);
  if (Z.z !== 'timber' && Z.z !== 'paved') return 0;
  return Math.max(0, Math.min(1, Math.min(wx - Z.x0, Z.x1 - wx) / 36));
};
// a shape that's each zone's own, blended into the next zone's over ZMIX either side of their border
/** @param {number} wx @param {{ zp?: TitlePlan }} B @param {(wx: number, Z: TZone) => number} f */
const zoneMix = (wx, B, f) => {
  const Z = titleZoneSpan(wx, B), u = wx - Z.x0, v = Z.x1 - wx;
  /** @param {number} t */
  const sm = t => t * t * (3 - 2 * t);
  if (u < ZMIX && Z.i > 0) { const t = sm((u + ZMIX) / (2 * ZMIX)); return f(wx, zoneNext(Z, -1, B)) * (1 - t) + f(wx, Z) * t; }
  if (v < ZMIX) { const t = sm((v + ZMIX) / (2 * ZMIX)); return f(wx, zoneNext(Z, 1, B)) * (1 - t) + f(wx, Z) * t; }
  return f(wx, Z);
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
/** @param {number} wx @param {number} y @param {{ zp?: TitlePlan }} [B] */
export const titleZoneAt = (wx, y, B) => titleZoneLook(wx, y, B).z;
// (CaveRunner Auto's tall level; owner: not straight vertical slices) the zone a point looks like, as the old game's
// level.js zones: the plan's order along x kept, but x pushed by a big domain-warped noise field (DEV.autoZoneWarp at
// most, its lumps autoZoneScale across, warped by autoZoneRag), so borders curve and slant up and down the height,
// plus islands of the next zone (autoZoneIsle: their share). A pad or the arena keeps its own look, and lends none.
// Pure (position and the knobs). The title (no lvl) keeps the old ragged edge only
/** @param {number} wx @param {number} y @param {{ zp?: TitlePlan, lvl?: unknown }} [B] @returns {TZone} */
export function titleZoneLook(wx, y, B) {
  const fray = (titleNoise(wx / 24, y / 14) - 0.5) * 2 * ZBLEND + (titleNoise(wx / 4, y / 4) - 0.5) * 12;
  if (!B || !B.lvl) return titleZoneSpan(wx + fray, B);
  const Zs = titleZoneSpan(wx, B);
  if (Zs.flat) return Zs;
  const sc = DEV.autoZoneScale, g = DEV.autoZoneRag, h = sc * 0.45;
  const qx = wx / sc + (fbm(wx / h + 5.2, y / h + 1.3) - 0.5) * 2 * g, qy = y / sc + (fbm(wx / h + 9.7, y / h + 4.1) - 0.5) * 2 * g;
  let x2 = wx + (fbm(qx, qy) - 0.5) * 2 * DEV.autoZoneWarp + fray;
  if (titleNoise(wx / 46 + 3.3, y / 46 + 7.7) > 1 - DEV.autoZoneIsle) {
    const Zw = titleZoneSpan(x2, B);
    x2 = x2 - Zw.x0 < Zw.x1 - x2 ? Zw.x0 - 1 : Zw.x1 + 1;
  }
  const Z = titleZoneSpan(x2, B);
  return Z.flat ? Zs : Z;
}
// three octaves of titleNoise, about 0..1, stretched to fill it (pure)
/** @param {number} x @param {number} y */
const fbm = (x, y) => Math.max(0, Math.min(1, ((titleNoise(x, y) + 0.5 * titleNoise(x * 2.03 + 17, y * 2.03 + 31) + 0.25 * titleNoise(x * 4.1 + 41, y * 4.1 + 7)) / 1.75 - 0.5) * 1.7 + 0.5));
// The winding caves (owner, v0.0.172: the natural caves that aren't big and open): rock, a narrow tunnel snaking up
// and down through it (its middle windMid, its half height windHalf: 15–26), now and then a side branch off it above or
// below, and pockets of air in the rock round it (windAir), fading in from the zone's ends
/** @param {number} x @param {TZone} Z @param {{ top: number, bot: number }} B */
const windMid = (x, Z, B) => Math.max(B.top + 26, Math.min(B.bot - 32, (B.top + B.bot) / 2 + 4
  + (titleNoise(x / 70 + Z.ph[0], 3.7) - 0.5) * 80 * bandK(B) + (titleNoise(x / 23 + Z.ph[1], 5.1) - 0.5) * 16));
// (CaveRunner Auto's tall level) how many times 150 (the old level band's height, 130 at vh 190, with room) this band is: the
// roof's and floor's waves, the winding tunnel's swing and the tall cave's big lumps grow with it (1 on the title, the hub)
/** @param {{ top: number, bot: number, lvl?: unknown }} B */
const bandK = B => (B.lvl ? Math.max(1, (B.bot - B.top) / 150) : 1);
/** @param {number} x @param {TZone} Z */
const windHalf = (x, Z) => 15 + titleNoise(x / 28 + Z.ph[2], 7.3) * 11;
/** open air off the main tunnel at (x, y): a side branch or a pocket @param {number} x @param {number} y @param {TZone} Z @param {{ top: number, bot: number }} B */
function windAir(x, y, Z, B) {
  if (y < B.top - 6 || y > B.bot + 2) return false;
  const edge = Math.min(x - Z.x0, Z.x1 - x);
  if (edge < 12) return false;
  const fade = Math.max(0, (40 - edge) / 40) * 0.3;
  if (titleNoise(x / 16 + Z.ph[3], y / 11) > 0.7 + fade) return true;          // pockets
  const on = titleNoise(x / 55 + Z.ph[4], 11.3) - fade;                         // a branch, while 'on'
  if (on <= 0.5) return false;
  const mid = windMid(x, Z, B), half = windHalf(x, Z), side = titleNoise(x / 90 + Z.ph[4], 2.2) > 0.5 ? -1 : 1;
  const m2 = mid + side * (half + 14 + titleNoise(x / 30 + Z.ph[0], 13) * 16);
  return Math.abs(y - m2) < (on - 0.5) * 2 * 11;
}
// one zone's own roof and floor at x (no blending; the mine works' slope is titleCeil's)
/** @param {number} x @param {TZone} Z @param {{ top: number, bot: number, lvl?: unknown }} B */
const zCeil = (x, Z, B) => (Z.z === 'winding' ? windMid(x, Z, B) - windHalf(x, Z)
  : B.top - 4 + Z.co + (Math.sin(x * 0.018 * Z.cf + Z.ph[0]) * 10 + Math.sin(x * 0.049 * Z.cf + Z.ph[1]) * 6) * Z.ca * bandK(B)
    + (bandK(B) - 1) * 45 * titleNoise(x / 90 + Z.ph[2], 9.1));
/** @param {number} x @param {TZone} Z @param {{ top: number, bot: number, lvl?: unknown }} B */
const zFloor = (x, Z, B) => (Z.z === 'winding' ? windMid(x, Z, B) + windHalf(x, Z)
  : B.bot - 22 + Z.fo + (Math.sin(x * 0.021 * Z.ff + Z.ph[2]) * 7 + Math.sin(x * 0.057 * Z.ff + Z.ph[3]) * 4) * Z.fa * bandK(B)
    - (bandK(B) - 1) * 30 * titleNoise(x / 80 + Z.ph[3], 4.3));
// THE SPIDER ZONE (owner, after v1.0.74): the open cave (its roof and floor as moss's) with rock scattered through its
// open air, natural: boulders (lumps of a noise field, DEV.autoSpiderRock their share), spikes down off the roof and up off
// the floor; none near its ends. Something for webs to hang from (world/orbweb.js). Pure
/** @param {number} wx @param {number} y @param {TZone} Z @param {number} cy @param {number} fy the column's roof and floor
 * @param {boolean} [bare] no spikes (Coal Seams: its stalactites and stalagmites instead, stalCol) */
export function spiderRock(wx, y, Z, cy, fy, bare) {
  const edge = Math.min(wx - Z.x0, Z.x1 - wx);
  if (edge < 24 || y < cy || y > fy) return false;
  const fade = Math.max(0, (70 - edge) / 70) * 0.15;
  if (y > cy + 22 && y < fy - 26) {
    const n = titleNoise(wx / 32 + Z.ph[0], y / 24 + Z.ph[1]) * 0.84 + titleNoise(wx / 8 + Z.ph[2], y / 8 + Z.ph[3]) * 0.16;   // (big lumps, a little ragged)
    if (n > 1 - DEV.autoSpiderRock + fade) return true;
  }
  const k = Math.floor(wx / 34), i = Z.i * 7, sx = k * 34 + 8 + h2(k, i + 21) * 18, sw = 3 + h2(k, i + 22) * 5, d = Math.abs(wx - sx) / sw;
  if (!bare && d < 1 && h2(k, i + 25) < 0.6) {
    const len = (16 + h2(k, i + 23) * 44) * (1 - d * d) * (1 - fade * 3);
    return h2(k, i + 24) < 0.55 ? y < cy + len : y > fy - len * 0.6;
  }
  return false;
}
// (Coal Seams, chunk C2) the Cavern's stalactites (hanging off every underside: the roof, the boulders' bottoms) and
// stalagmites (rising off the floor and the boulders' tops, shorter and blunter), in clusters of mixed lengths. One point
// per slot along x (10 units stalactites, 13 stalagmites), there by DEV.coal{Stal,Mite}Dense where a noise field is over
// DEV.coal{Stal,Mite}Clus (the bare gaps between clusters), its length in DEV.coal{Stal,Mite}Len{Lo,Hi} (shorter at a
// cluster's edge) × g (the open space it faces over DEV.coalStalRoom: a big cave, big points). At column wx: [this
// column's length, the point's whole length] (0s: none). Pure
/** @param {number} wx @param {boolean} up a stalagmite @param {number} ph the zone's phase @param {number} [g] */
export function stalLen(wx, up, ph, g = 1) {
  const sp = up ? 13 : 10, s = up ? 41 : 47, k0 = Math.floor(wx / sp);
  const dense = up ? DEV.coalMiteDense : DEV.coalStalDense, clus = up ? DEV.coalMiteClus : DEV.coalStalClus;
  const lo = up ? DEV.coalMiteLenLo : DEV.coalStalLenLo, hi = up ? DEV.coalMiteLenHi : DEV.coalStalLenHi;
  let best = 0, whole = 0;
  for (let k = k0 - 2; k <= k0 + 2; k++) {
    const sx = k * sp + sp / 2 + (h2(k, s + 1) - 0.5) * sp * 0.6;
    const cl = titleNoise(sx / 70 + ph, s);
    if (cl <= clus || h2(k, s + 3) >= dense) continue;
    const L = (lo + (hi - lo) * h2(k, s + 2)) * Math.min(1, (cl - clus) / 0.1) * g;
    const w = up ? 3 + L * 0.36 : 2 + L * 0.16, d = Math.abs(wx - sx) / w;
    if (d >= 1) continue;
    const h = up ? L * (1 - Math.pow(d, 1.6)) : L * Math.pow(1 - d, 1.3);   // (tapering to a point; a stalagmite blunter)
    if (h > best) { best = h; whole = L; }
  }
  return [best, whole];
}
// a Coal Seams Cavern column's rock: 0 air, 1 rock (roof, floor, boulders), 2 a point's rock, 3 a point's lighter tip.
// Each point grows with the air past its edge, cut to a share of it (DEV.coalStalCap, coalMiteCap), so none seals a way through. Pure
/** @param {number} wx @param {TZone} Z @param {number} cy @param {number} fy @param {number} rows */
export function stalCol(wx, Z, cy, fy, rows) {
  const a = new Uint8Array(rows);
  for (let r = 0; r < rows; r++) { const y = (r + 0.5) * TCELL; a[r] = y < cy || y >= fy || spiderRock(wx, y, Z, cy, fy, true) ? 1 : 0; }
  if (Math.min(wx - Z.x0, Z.x1 - wx) < 24) return a;
  const b = a.slice();
  for (let r = 0; r < rows; ) {
    if (b[r]) { r++; continue; }
    let e = r;
    while (e < rows && !b[e]) e++;   // air rows r..e-1, rock (or the column's end) past each end
    const room = (e - r) * TCELL, y0 = r * TCELL, y1 = e * TCELL, g = Math.max(0.4, room / DEV.coalStalRoom);
    const dn = stalLen(wx, false, Z.ph[0], g), upL = stalLen(wx, true, Z.ph[1], g);
    let low = r - 1;   // (the last row a stalactite took: a stalagmite stops 2 rows short of it, always a way through)
    if (r > 0 && dn[0] > 0) {
      const h = Math.min(dn[0], room * DEV.coalStalCap), tip = Math.max(2, dn[1] * 0.3);
      for (let q = r; q < e - 2 && (q + 0.5) * TCELL < y0 + h; q++, low++) a[q] = (q + 0.5) * TCELL - y0 > Math.min(h, dn[1]) - tip && h > dn[1] - tip ? 3 : 2;
    }
    if (e < rows && upL[0] > 0) {
      const h = Math.min(upL[0], room * DEV.coalMiteCap), tip = Math.max(2, upL[1] * 0.25);
      for (let q = e - 1; q > low + 2 && (q + 0.5) * TCELL > y1 - h; q--) if (!a[q]) a[q] = y1 - (q + 0.5) * TCELL > h - tip && h > upL[1] - tip ? 3 : 2;
    }
    r = e;
  }
  return a;
}
// ('beams') a mine's old timbering left standing in it: crossbeams at random heights (two rows: lit over shaded), a post
// under each end down to the floor, a brace inside each. Not solid (as a mine's frames): it burns; webs hang off it.
// The material at (wx, y), or -1 (none). Pure
/** @param {number} wx @param {number} y @param {TZone} Z @param {number} cy @param {number} fy */
export function spiderBeam(wx, y, Z, cy, fy) {
  if (Math.min(wx - Z.x0, Z.x1 - wx) < 30 || y < cy || y >= fy) return -1;
  for (let j = 0; j < 2; j++) {
    const k = Math.floor(wx / 64), q = k * 2 + j, i = Z.i * 5;
    if (h2(q, i + 31) > 0.7) continue;
    const x0 = k * 64 + h2(q, i + 32) * 24, w = 24 + h2(q, i + 33) * 34, by = cy + 18 + h2(q, i + 34) * Math.max(0, fy - cy - 50), u = wx - x0;
    if (u < 0 || u >= w || y < by) continue;
    const under = y - by;
    if (under < 2) return TM.BEAM;
    if (under < 4) return TM.BEAMD;
    if (u < 3 || u >= w - 3) return u < 1.5 || (u >= w - 3 && u < w - 1.5) ? TM.BEAM : TM.BEAMD;
    if ((u >= 3 && u <= 11 && Math.abs(under - 4 - (11 - u)) < 1) || (u >= w - 11 && u < w - 3 && Math.abs(under - 4 - (u - (w - 11))) < 1)) return TM.BEAMD;
  }
  return -1;
}

// the cave's roof and floor as made (world x; B the band: top, bot in world units, under the title, over the menu).
// The timber works come down to TIMBER_H over the floor, the height of their frames
/** @param {number} wx @param {{ top: number, bot: number, zp?: TitlePlan }} B */
export const titleCeil = (wx, B) => {
  const nat = zoneMix(wx, B, (x, Z) => zCeil(x, Z, B)) + Math.sin(wx * 0.11) * 2;
  // the layer's roof comes down over a natural slope (owner, v0.0.165: the old short step was too steep and
  // straight): an S-curve about TIMBER_RAMP long, starting a little before the works, where it starts shifted
  // by noise, the rock along it lumpy (big lumps and a fine fray, none once it's down)
  // (v0.0.170) to whichever tunnel the mine is come into or left by: down, or up to a high one
  const T = mineNear(wx, B);
  if (!T) return nat;
  const lump = Math.sin(Math.PI * T.bt) * ((titleNoise(wx / 16, 47) - 0.5) * 22 + (titleNoise(wx / 6, 40) - 0.5) * 9 + (titleNoise(wx / 2.5, 43) - 0.5) * 3);
  return Math.min(nat + (T.band.c - nat) * T.bt + lump, titleFloor(wx, B) - 24);
};
// the mine works a point is in or near (within TIMBER_RAMP): bt 0..1 how far along the slope into it (1 inside), and
// the tunnel that slope leads to (the way in at its left end, the way out at its right; inside, the one the way through is in)
/** @param {number} wx @param {{ top: number, bot: number, zp?: TitlePlan }} B */
const mineNear = (wx, B) => {
  const d = timberD(wx, B);
  if (d < -TIMBER_RAMP) return null;
  const q = Math.max(0, Math.min(1, (d + TIMBER_RAMP - 30 + (titleNoise(wx / 40, 44) - 0.5) * 20) / TIMBER_RAMP)), bt = q * q * (3 - 2 * q);
  if (!bt) return null;
  const Z = titleZoneSpan(wx, B), T = Z.z === 'timber' ? Z : zoneNext(Z, wx < (Z.x0 + Z.x1) / 2 ? -1 : 1, B), M = T.mine;
  if (!M) return null;
  const k = wx < T.x0 ? M.ein : wx >= T.x1 ? M.eout : mainBand(M, wx);
  return { bt, band: mineBands(M, B)[k], T };
};
const TIMBER_RAMP = 120;              // the timber works' roof slope's length (world units; it ends ~30 into the works)
// how far world x is into a timber works zone (its nearer end; negative before it, -Infinity away from one)
/** @param {number} wx @param {{ zp?: TitlePlan }} B */
const timberD = (wx, B) => {
  const Z = titleZoneSpan(wx, B);
  if (Z.z === 'timber') return Math.min(wx - Z.x0, Z.x1 - wx);
  let d = -Infinity;
  if (zoneNext(Z, 1, B).z === 'timber') d = -(Z.x1 - wx);
  if (Z.i > 0 && zoneNext(Z, -1, B).z === 'timber') d = Math.max(d, -(wx - Z.x0));
  return d;
};
// a web line's point at fraction u: straight a0..b0, sagging in the middle (as world/sway.js webAt)
/** @param {WebLine} L @param {number} u */
export const titleWebAt = webAt;   // (and bent where a player pushed through it)
/** @param {number} wx @param {{ top: number, bot: number, zp?: TitlePlan }} B */
export const titleFloor = (wx, B) => {
  const nat = zoneMix(wx, B, (x, Z) => zFloor(x, Z, B)) + Math.sin(wx * 0.13) * 1.5;
  const b = built(wx, B), base = nat * (1 - b) + (B.bot - 20) * b, T = mineNear(wx, B);
  return T ? base + (T.band.f - base) * T.bt : base;
};
// (CaveRunner Auto's tall level, DEV.autoZoneOpen) rock at (wx, y) that another zone's look opens: that zone's own cave air
// (Zn the column's zone by x, Zc the look at y), never in a pad, the arena, a blocked zone or a mine's look, nor under the
// column's floor. Pure: genCol carves by it, titleRoof finds the real roof with it
/** @param {number} wx @param {number} y @param {TitleScene} B @param {TZone} [Zn] @param {number} [fy] @param {TZone} [Zc] */
export function zoneOpenAt(wx, y, B, Zn = titleZoneSpan(wx, B), fy = titleFloor(wx, B), Zc = titleZoneLook(wx, y, B)) {
  if (!DEV.autoZoneOpen || !B.lvl || B.bot - B.top <= MINE_TALL || Zc === Zn || Zn.blk || Zc.blk || Zn.flat || Zc.z === 'timber' || y <= B.top + 24 || y >= fy) return false;
  return (y >= zCeil(wx, Zc, B) && y < zFloor(wx, Zc, B)) || (Zc.z === 'winding' && windAir(wx, y, Zc, B));
}
// the roof over a column's floor as carved: titleCeil, or higher where another zone opened the rock above it (pure)
/** @param {number} wx @param {TitleScene} B */
export function titleRoof(wx, B) {
  const cy = titleCeil(wx, B);
  if (!DEV.autoZoneOpen || !B.lvl || B.bot - B.top <= MINE_TALL) return cy;
  const Zn = titleZoneSpan(wx, B), fy = titleFloor(wx, B);
  let r = Math.ceil(cy / TCELL - 0.5) - 1;   // the lowest rock row over the roof
  if (r < 0 || !zoneOpenAt(wx, (r + 0.5) * TCELL, B, Zn, fy)) return cy;
  while (r > 0 && zoneOpenAt(wx, (r + 0.5) * TCELL, B, Zn, fy)) r--;
  return (r + 1) * TCELL;
}

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
  const wx = c * TCELL, Zn = titleZoneSpan(wx, S), z = Zn.z, b = built(wx, S), R = S.rnd;
  const cy = titleCeil(wx, S), fy = titleFloor(wx, S), base = ci(S, c, 0);
  // (Coal Seams, owner 2026-10-16) the old floor here has its own decoration set: none of Mossy's moss, grass, rubble, brick
  // ledges or plants; the timber sets (timberCol, art/timber.js), and the old game's mine set (coalDeco)
  const coal = coalAt(S, wx), seam = coal && !Zn.flat;
  // the built-up layers' timber frames, as strata.js timberFrame makes them: two posts (lit on the
  // left), a cap beam two rows deep running a little past them, a knee brace inside each post's top,
  // a footing under each post
  const u = ((wx % FRAME_GAP) + FRAME_GAP) % FRAME_GAP;
  // a mine works (v0.0.170): its tunnels open here (each its frames, staggered tunnel to tunnel; whole frames only,
  // clear of its walled ends), and the holes through its shelves
  const M = z === 'timber' ? Zn.mine : undefined, bands = M ? mineBands(M, S) : [];
  const tun = bands.map((q, k) => {
    const v = ((wx + k * FRAME_GAP / 2) % FRAME_GAP + FRAME_GAP) % FRAME_GAP, uc = v > FRAME_GAP - 5 ? v - FRAME_GAP : v;
    const fx0 = wx - uc - 4, fx1 = wx - uc + FRAME_W + 4;
    // hewn, not cut (owner, v0.0.170): the roof dug up 2–14 past the frames' caps (leaving 4 of the shelf under the
    // tunnel above), the floor down 0–4, the walled ends crooked (±12 by height); the frames stay straight in it
    const dn = dig(wx, k).dn, up = Math.min(dig(wx, k).up, k < bands.length - 1 ? M.sh[k] - dig(wx, k + 1).dn - 4 : 99);
    const open = !!M && wx > M.L[k] - 14 && wx < M.Rx[k] + 14;
    // (Coal Seams) minecart rails along stretches of a tunnel's floor (the floor flat under them), heaps of loose coal against
    // its walled ends (DEV.coalRails, coalPiles)
    const rail = coal && open && railOn(wx, k);
    let pile = 0;
    if (coal && M) for (const [e, d] of [[0, wx - M.L[k]], [1, M.Rx[k] - wx]]) if (d < PILE_W && h2(Math.floor(e ? M.Rx[k] : M.L[k]) + k * 7, 77 + e) < DEV.coalPiles)
      pile = Math.max(pile, PILE_H * (0.6 + 0.4 * h2(k, 78 + e)) * Math.pow(1 - Math.max(0, d) / PILE_W, 1.4) + (titleNoise(wx / 3, 79 + k) - 0.5) * 2);
    return { c: q.c, f: q.f, rc: q.c - up, rf: q.f + dn, k, open, uc, v, rail, pile,
      frame: !coal && open && !!M && uc < FRAME_W + 4 && built(fx0, S) > 0.95 && built(fx1, S) > 0.95 && fx0 > M.L[k] + 12 && fx1 < M.Rx[k] - 12 };
  });
  /** @param {{ k: number }} t @param {number} y the end walls, crooked */
  const inside = (t, y) => !!M && wx > M.L[t.k] + (titleNoise(y / 9, 71 + t.k * 3) - 0.5) * 18 + (titleNoise(y / 3, 73 + t.k * 3) - 0.5) * 6
    && wx < M.Rx[t.k] + (titleNoise(y / 9, 79 + t.k * 3) - 0.5) * 18 + (titleNoise(y / 3, 83 + t.k * 3) - 0.5) * 6;
  // the holes through the shelves, ragged (their width ±4 by height)
  const near = M ? M.holes.filter(h => h.k + 1 < bands.length && Math.abs(wx - h.x) < h.w / 2 + 4) : [];
  /** @param {number} y */
  const inHole = y => near.some(h => y >= bands[h.k + 1].f - 0.5 && y < bands[h.k].c + 0.5 && Math.abs(wx - h.x) < h.w / 2 + (titleNoise(y / 5, h.x) - 0.5) * 8);
  // (Coal Seams) wooden chutes down some of the holes: from the tunnel above, across the hole, into the one below (chuteOf)
  const chutes = coal && M ? M.holes.map(h => chuteOf(h, bands, wx)).filter(q => !!q) : [];
  const tc = coal && !Zn.flat && !Zn.blk ? timberCol(S, c, M, bands) : null;
  // moss patches on the floor (thicker moss, bright grass tufts on top), as decorate.js bakes them
  const patch = !coal && titleNoise(wx / 14, 11) > 0.52, tuft = patch && h2(c, 5) < 0.4 ? (h2(c, 6) < 0.4 ? 2 : 1) : 0;
  const mossDeep = 2 + (patch ? 1 + Math.floor(h2(c, 7) * 3) : 0);
  // rubble: a low mound of broken brick, moss over its top (decorate.js rubble), now and then on a floor
  const rk = Math.floor(wx / 60), rcx = rk * 60 + 10 + h2(rk, 1) * 40, rw = 6 + h2(rk, 2) * 6, rd = (wx - rcx) / rw;
  const rub = !coal && !Zn.flat && z !== 'paved' && h2(rk, 3) < 0.45 && Math.abs(rd) < 1 ? (2 + h2(rk, 4) * 2.5) * (1 - rd * rd) : 0;
  // a small brick ledge out in the air of a natural cave (the level's built ledges)
  const lk = Math.floor(wx / 90), lx0 = lk * 90 + 15 + h2(lk, 8) * 35, lw = 14 + h2(lk, 9) * 14;
  const lmid = lx0 + lw / 2, lc = titleCeil(lmid, S), lf = titleFloor(lmid, S), ly = lc + 14 + h2(lk, 10) * Math.max(0, lf - lc - 52);
  const ledge = !coal && !Zn.flat && (z === 'moss' || z === 'grove' || z === 'webs' || z === 'spider') && built(lmid, S) === 0 && h2(lk, 11) < 0.5 && wx >= lx0 && wx < lx0 + lw && lf - lc > 60;
  // a blocked zone (CaveRunner Auto, auto/blocked.js): its blockage over the open band (a mine's: its tunnels' stack)
  const bk0 = Zn.blk, bk = bk0 && S.lvl && S.lvl.blockCell ? S.lvl.blockCell : null;
  const by0 = M && bands.length ? bands[Math.min(M.n, bands.length) - 1].c - 14 : cy, by1 = M && bands.length ? bands[0].f + 3 : fy;
  if (bk0 && S.lvl && S.lvl.blockCol) S.lvl.blockCol(S, bk0, c, wx, by0, by1);
  const stal = coal && z === 'spider' ? stalCol(wx, Zn, cy, fy, S.rows) : null;   // (Coal Seams) the Cavern's rock, its points
  let carved = false;
  for (let r = 0; r < S.rows; r++) {
    const y = (r + 0.5) * TCELL, Zc = titleZoneLook(wx, y, S), zc = Zc.z;   // the skin (moss or bricks) frays at a border
    let m = TM.AIR;
    const t = tun.find(t => t.open && y >= t.rc && y < t.rf && inside(t, y));
    if (M && !t && y < cy && !inHole(y)) m = TM.ROCK;
    else if (M && t) {
      if (t.frame && y >= t.c) m = frameCell(t.uc, y - t.c, t.f - y);
      if (t.rail && y >= t.f) m = TM.ROCK;   // (the rails: on sleepers, the floor flat under them)
      else if (t.rail && y >= t.f - TCELL) m = c % 3 ? m : TM.BEAMD;
      else if (t.rail && y >= t.f - 2 * TCELL) m = TM.RAIL;
      if (t.pile > 0 && y >= (t.rail ? t.f : t.rf) - t.pile) m = TM.COAL;
    } else if (M && inHole(y)) m = TM.AIR;
    else if (y < cy) m = TM.ROCK;
    else if (y >= fy) {
      m = TM.ROCK;
      if (zc === 'paved' && b > 0.3 && y < fy + 6) m = TM.BRICK;
      else if (!coal && y < fy + mossDeep * TCELL) m = TM.MOSS;
    } else if (stal) m = stal[r] === 3 ? TM.ROCKL : stal[r] ? TM.ROCK : m;
    else if (z === 'spider' && spiderRock(wx, y, Zn, cy, fy)) m = coal || spiderRock(wx, y - 2 * TCELL, Zn, cy, fy) ? TM.ROCK : TM.MOSS;   // (moss on their tops)
    else if (z === 'spider' && Zn.sv === 'beams' && spiderBeam(wx, y, Zn, cy, fy) >= 0) m = spiderBeam(wx, y, Zn, cy, fy);
    else if (ledge && y >= ly && y < ly + 4) m = TM.BRICK;
    else if (ledge && y >= ly - 2 && y < ly && tuft) m = TM.GRASS;
    if (m === TM.AIR && y >= fy - rub && y < fy) m = y < fy - rub + 2 && h2(c, r) < 0.7 ? TM.RUBM : TM.RUB;
    if (m === TM.AIR && y >= fy - tuft * TCELL && y < fy && zc !== 'paved') m = TM.GRASS;
    if (z === 'winding' && TITLE_SOLID[m] && windAir(wx, y, Zn, S)) m = TM.AIR;
    // (Auto's tall level) another zone's look here: its open air opens too, over this column's floor (DEV.autoZoneOpen; off: it upset the autopilot, auto-level and auto-tall)
    if (TITLE_SOLID[m] && zoneOpenAt(wx, y, S, Zn, fy, Zc)) { m = TM.AIR; carved = true; }
    if (tc && (m === TM.AIR || m === TM.RAIL) && tc.cells.has(r)) m = tc.cells.get(r) || m;   // (the timber: in front of a rail)
    if (m === TM.AIR) for (const q of chutes) if (y >= q.y - 1 && y < q.y + 5) m = y < q.y + 1 ? TM.BEAMD : TM.BEAM;   // (the trough's inside, its boards under it)
    if (seam && m === TM.ROCK && !(stal && stal[r] > 1) && coalCell(S, wx, y)) m = TM.COAL;   // (the points stay rock)
    if (bk) m = bk(bk0, wx, y, by0, by1, m);
    S.cells[base + r] = m;
  }
  // (Coal Seams, smouldering seams) now and then a bare coal face is alight from the start (lit once the column is made)
  if (seam && DEV.coalSmoulder > 0) for (let r = 1; r < S.rows - 1; r++)
    if (S.cells[base + r] === TM.COAL && (!S.cells[base + r - 1] || !S.cells[base + r + 1]) && h2(c * 7 + 3, r * 13 + 977) < DEV.coalSmoulder) (S.lightLater || (S.lightLater = [])).push([c, r]);
  // where another zone opened the rock, the new floor gets its skin (moss; bricks in the brick works' look)
  if (carved && !coal) for (let r = 0; r < S.rows - 1; r++) if (S.cells[base + r] === TM.AIR && S.cells[base + r + 1] === TM.ROCK) {
    const brick = titleZoneAt(wx, (r + 1.5) * TCELL, S) === 'paved';
    for (let k = 1; k <= 2 && r + k < S.rows && S.cells[base + r + k] === TM.ROCK; k++) S.cells[base + r + k] = brick ? TM.BRICK : TM.MOSS;
  }
  // a lantern hanging on its chain under each tunnel's roof: between the frames, and some inside them
  if (b > 0.95) for (const t of tun) if (t.open && inside(t, t.c + 4) && (Math.abs(t.v - (FRAME_W + FRAME_GAP) / 2) < 1 || Math.abs(t.v - FRAME_W / 2) < 1) && R() < 0.7)
    lamp(S, c, wx, t.c + 10, 4 + R() * 8, coal);
  // and down long chains from the brick works' high roof
  if (z === 'paved' && b > 0.9 && Math.abs(u - FRAME_GAP / 2) < 1 && R() < 0.8)
    lamp(S, c, wx, cy + 10, 14 + R() * 30);
  // (Auto's tall level) plants and webs follow the zone the roof (or the floor, for pads) looks like here, the curving
  // zones, and hang from the roof as carved (titleRoof); outside that zone's own x span it counts as its middle
  const rcy = titleRoof(wx, S), Zr = S.lvl ? titleZoneLook(wx, rcy + 1, S) : Zn, Zf = S.lvl ? titleZoneLook(wx, fy - 1, S) : Zn, zr = Zr.z;
  // the spiders' zone: web lines everywhere, roof to floor (slanting either way) and roof to roof (sagging)
  // (owner, after v1.0.74) and now and then an orb web (world/orbweb.js): a hub in the open between roof and floor, spokes to
  // the rock round it, the spiral across them; each thread a web line (L.orb: its web, L.sp: a spiral thread)
  const spz = zr === 'spider' || !!Zn.spid;   // (the spider zone, a spider mine: more orb webs, hubs anywhere up the height)
  if ((zr === 'webs' || spz) && (b === 0 || Zn.spid) && !(c % 4) && R() < DEV.autoOrbChance * (spz ? zk(Zr.spid ? Zr.z : 'spider', 'spidOrb', 3) : 1) * Zr.dens && (S.orbHub || []).filter(h => h.x > wx - TITLE_VW * 1.5).length < DEV.autoOrbMax) {
    // (at most autoOrbMax over the last screen and a half, after v1.0.75: the old cap, by all still kept, used them all up at a zone's start)
    // (the stretch behind this column is made: the hub at most a spoke's reach back from it, near the floor or the roof)
    // (owner, after v1.0.75: large ones too) each its own size, autoOrbRMin..autoOrbR; bigger: more spokes, the spiral wider spaced
    const rr = DEV.autoOrbRMin + R() * Math.max(0, DEV.autoOrbR - DEV.autoOrbRMin), sz = Math.sqrt(rr / 50);
    const hx = wx - rr - 8 - R() * 30, hr = titleRoof(hx, S), hf = titleFloor(hx, S), pick = R();
    const hy = spz && pick < 0.6 ? hr + (hf - hr) * (0.1 + R() * 0.8) : pick < 0.8 ? hf - 12 - R() * 25 : hr + 12 + R() * 25;
    /** @param {Pt | null} p */
    const holds = p => !!p && p.x < wx && !!HOLDS[titleCell(S, Math.floor(p.x / TCELL), Math.floor(p.y / TCELL))];   // (timber holds a web too)
    // (after v1.0.76: past the columns made is open, not rock: a spoke ended there hung on air once it was made)
    const W = orbPlace((x, y) => holds({ x, y }), hx, hy, R,
      { spokes: Math.round(DEV.autoOrbSpokes * Math.max(1, sz)), maxR: rr, gap: DEV.autoOrbGap * Math.max(1, sz), hole: 4 * Math.max(1, sz), tries: 6, spread: 25 * Math.max(1, sz) });
    // (kept apart: none over another's hub)
    const hub = W && W.find(t => !t.spiral && !t.bin) || null, apart = !!hub && !(S.orbHub || []).some(h => Math.hypot(h.x - hub.bx, h.y - hub.by) < (h.r + rr) * 0.6);
    // (none strung where it shows: it popped on; the level makes columns far enough ahead for the big ones)
    const seen = S.t > 0 && Math.min(...(W || []).map(t => Math.min(t.ax, t.bx))) - 4 < S.scroll + TITLE_VW;
    if (W && apart && !seen && W.every(t => t.spiral || ((!t.ain || holds(t.ain)) && (!t.bin || holds(t.bin))))) {
      S.orbHub = (S.orbHub || []).filter(h => h.x > wx - TITLE_VW * 3);
      S.orbHub.push({ x: hub.bx, y: hub.by, r: rr });
      const id = (S.orbN = (S.orbN || 0) + 1), made = S.webs.length;
      for (const t of W) {
        /** @type {WebLine} */
        const L = { ax: t.ax, ay: t.ay, bx: t.bx, by: t.by, a0x: t.ax, a0y: t.ay, b0x: t.bx, b0y: t.by, ain: t.ain, bin: t.bin || { x: t.bx, y: t.by }, owner: null, orb: id, sp: t.spiral, fr: !t.spiral && !!t.bin };
        L.sag = DEV.webSag * Math.hypot(t.bx - t.ax, t.by - t.ay) * (t.spiral ? 0.6 : 0.3);
        S.webs.push(L);
      }
      orbRig(S, id, S.webs.slice(made));
    }
  }
  // (owner, after v1.0.75: too many tall single strands) a level's webs and spider zones: orb webs only (spiders spin their own lines)
  if ((zr === 'webs' || zr === 'spider') && !S.lvl && b === 0 && !(c % 4) && R() < 0.42 * Zr.dens && S.webs.filter(L => !L.orb).length < TITLE_WEBS) {
    const down = R() < 0.55, bx = down ? wx + (R() - 0.35) * 70 : wx + 18 + R() * 44;
    const by = down ? titleFloor(bx, S) - 0.5 : titleRoof(bx, S) + 0.5;
    /** @type {WebLine} */
    const L = { ax: wx, ay: rcy + 0.5, bx, by, a0x: wx, a0y: rcy + 0.5, b0x: bx, b0y: by, ain: { x: wx, y: rcy - 1 }, bin: { x: bx, y: down ? by + 1.5 : by - 1.5 }, owner: null, sag: 0 };
    L.sag = DEV.webSag * Math.abs(L.b0x - L.a0x) * (down ? 1 : 2.5);
    S.webs.push(L);
  }
  if (coal && M) for (const h of M.holes) { const q = chuteOf(h, bands, wx); if (q && q.end) (S.chutes || (S.chutes = [])).push({ x: wx, y: q.y - 1.5, s: q.s }); }
  if (coal) batCol(S, c, wx);
  if (coal) wormCol(S, c, wx);
  if (coal) { coalDeco(S, c, wx, Zn, tc && tc.lamp, rcy, fy, tun.filter(t => t.open && inside(t, t.rf - 3))); return; }
  // plants: vines, mycelium and roots under the roof, bouncy mushrooms on the floor
  // the grove: a curtain of long vines, every other column, some down near the floor (thick in its
  // middle, thinning to its ends)
  const nat = 1 - b, grove = zr === 'grove';
  // the grove's vine arches (decorate.js arches, drawn by art/props.js drawArch): roof to roof, sagging,
  // thick with leaves, strands hanging off them
  const zl = Zr.x1 - Zr.x0, zu = wx >= Zr.x0 && wx < Zr.x1 ? wx - Zr.x0 : zl / 2;
  // A cluster every 80: the arch knobs' (ARCH_KNOBS) arches per cluster, span (capped to the screen), sag
  // (slack), stems, strands per 10 px and their length, and open air under each (else it hangs less)
  if (grove && zu > 20 && zu < zl - 90 && ((wx % 80) + 80) % 80 < TCELL) {
    const na = Math.max(1, Math.round(kru('arCluster', R())));
    for (let a = 0; a < na; a++) {
      const ax = wx + (R() - 0.3) * 60, span = kru('arSpan', R()) * TCELL * 0.6, bx = ax + span;   // the knob's spans, scaled to the title's narrow screen
      const ay = titleRoof(ax, S) + 1, by = titleRoof(bx, S) + 1, n = Math.max(8, Math.min(40, Math.round(span / 6)));
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
    const mid = Math.min(1, Math.min(zu, zl - zu) / 70);
    if (R() < (0.12 + 0.2 * mid) * Zr.dens) {
      const room = fy - rcy, st = R() < 0.82 ? 'vine' : R() < 0.5 ? 'root' : 'myc';
      S.props.push({ k: 'climb', st, ox: wx, x: 0, y: rcy, len: room * (0.2 + R() * (0.35 + 0.45 * mid)), seed: R(), side: 1, burn: 0,
        ac: c, ar: Math.floor((rcy - 1) / TCELL) });
      return;
    }
  }
  // ('vines', owner after v1.0.74) the spider zone's big patches of vines: hung thick from the roof and the boulders' undersides;
  // (Dev → Zones) any zone with heavy vegetation (Z.veg)
  if (Zr.veg && !(c % 2) && titleNoise(wx / 70 + Zr.ph[4], 3.3) > 1 - zk(zr, 'vegPatch', 0.5)) {
    const r0 = Math.floor(rcy / TCELL);
    for (let r = r0; r < S.rows - 1; r++) {
      const top = r === r0, y = top ? rcy : (r + 1) * TCELL;
      if (y >= fy - 8) break;
      if (!(top || (SOLID[S.cells[base + r]] && !SOLID[S.cells[base + r + 1]])) || R() > (top ? 0.75 : 0.5) * Zr.dens * zk(zr, 'vegThick')) continue;
      const room = titleSurf(S, wx - S.scroll, y + 2, 1) - y;
      if (room < 10) continue;
      S.props.push({ k: 'climb', st: R() < 0.85 ? 'vine' : 'root', ox: wx, x: 0, y, len: room * Math.min(0.95, (0.25 + R() * 0.5) * zk(zr, 'vegLen')), seed: R(), side: 1, burn: 0, ac: c, ar: Math.floor((y - 1) / TCELL) });
    }
    return;
  }
  if (c % 3) return;
  const p = R();
  if (!grove && p < (zr === 'moss' ? 0.2 : 0.04) * zk(zr, 'plants') * Math.max(nat, 0.2) * Zr.dens) {
    const st = R() < 0.5 ? 'vine' : R() < 0.5 ? 'myc' : 'root';
    S.props.push({ k: 'climb', st, ox: wx, x: 0, y: rcy, len: (10 + R() * (zr === 'moss' ? 40 : 24)) * zk(zr, 'plantLen'), seed: R(), side: 1, burn: 0,
      ac: c, ar: Math.floor((rcy - 1) / TCELL) });
  } else if (zr === 'paved' && b > 0.5 && p < 0.08) {
    S.props.push({ k: 'climb', st: 'chain', ox: wx, x: 0, y: rcy, len: 8 + R() * 16, seed: R(), side: 1, burn: 0, ac: c, ar: Math.floor((rcy - 1) / TCELL) });
  } else if (nat > 0.5 && R() < (Zf.z === 'grove' ? 0.09 : 0.04)) {
    S.props.push({ k: 'pad', st: '', ox: wx, x: 0, y: fy, len: 0, seed: R(), side: 1, burn: 0, ac: c, ar: Math.floor((fy + 1) / TCELL) });
  }
}

// a lantern on its chain in column c, hung from whatever is right above (world) y0: straight up from there
// to the first rock or timber, the roof's underside or a frame's cap beam, so the chain meets it
// (rust: Coal Seams' rusted lantern, warmer and dimmer)
/** @param {TitleScene} S @param {number} c @param {number} wx @param {number} y0 @param {number} len @param {boolean} [rust] */
function lamp(S, c, wx, y0, len, rust = false) {
  const base = ci(S, c, 0);
  let r = Math.floor(y0 / TCELL);
  while (r > 0 && !HOLDS[S.cells[base + r]]) r--;
  /** @type {TProp} */
  const p = { k: 'lamp', st: 'hanglamp', ox: wx, x: 0, y: (r + 1) * TCELL, len, seed: S.rnd(), side: 1, burn: 0, ac: c, ar: r };
  if (rust) p.rust = 1;
  S.props.push(p);
}
// what a hanging thing can hang from: rock, and a frame's timber (it falls when that's burnt or blown away)
const HOLDS = TITLE_SOLID.map((v, m) => (v || m === TM.BEAM || m === TM.BEAMD ? 1 : 0));

// one cell of a timber frame, as strata.js timberFrame makes it: two posts (lit on the left), a cap beam two rows deep running a
// little past them, a knee brace inside each post's top, a footing under each post. uc: the column's x from the left post's
// left edge; under: how far under the cap's top; toFloor: how far over the floor (the mine works' frames, Coal Seams' supports)
/** @param {number} uc @param {number} under @param {number} toFloor @returns {number} the material (TM.AIR: none here) */
function frameCell(uc, under, toFloor) {
  if (uc >= -4 && uc < FRAME_W + 4 && under < 4) return under < 2 ? TM.BEAM : TM.BEAMD;
  if ((uc >= 0 && uc < 4) || (uc >= FRAME_W - 4 && uc < FRAME_W)) return (uc < 2 || (uc >= FRAME_W - 4 && uc < FRAME_W - 2)) ? TM.BEAM : TM.BEAMD;
  if ((uc >= 4 && uc <= 12 && Math.abs(under - 4 - (12 - uc)) < 1) || (uc >= FRAME_W - 12 && uc < FRAME_W - 4 && Math.abs(under - 4 - (uc - (FRAME_W - 12))) < 1)) return TM.BEAMD;
  if (toFloor <= 2 && ((uc >= -1 && uc < 5) || (uc >= FRAME_W - 5 && uc < FRAME_W + 1))) return TM.BEAMD;
  return TM.AIR;
}

// (Coal Seams, owner 2026-10-16) does world x play as Coal Seams (its look's old floor: floorDeco)?
/** @param {TitleScene} S @param {number} wx */
export const coalAt = (S, wx) => { const L = lookAt(S, wx); return !!L && floorDeco(L.floor || 1) === 'coal'; };
const PILE_W = 22, PILE_H = 9;
const CHUTE_W = 40, CHUTE_D = 24;   // (Coal Seams) a coal chute's run and drop (world units)        // (Coal Seams) a heap of coal against a tunnel's end: this far out from the wall, up to this high
// (Coal Seams) the wooden chute down hole h (if it has one: DEV.coalChutes of them), at column wx: from the tunnel above's floor at
// one edge of the hole, sloping down (CHUTE_W across, CHUTE_D down) through it into the tunnel below, either way. → its top edge's y here, its way (s), and whether wx is its lower lip (end), or null where it isn't
/** @param {{ k: number, x: number, w: number }} h @param {{ c: number, f: number }[]} bands @param {number} wx */
function chuteOf(h, bands, wx) {
  if (h.k + 1 >= bands.length || h2(Math.floor(h.x), 88 + h.k) >= DEV.coalChutes) return null;
  const s = h2(Math.floor(h.x), 89) < 0.5 ? 1 : -1, xa = h.x - s * (h.w / 2 + 2), xb = xa + s * CHUTE_W;
  const u = (wx - xa) / (xb - xa);
  if (u < 0 || u > 1) return null;
  const ya = bands[h.k + 1].f - 3, yb = ya + CHUTE_D;
  return { y: ya + (yb - ya) * u, s, end: (wx + TCELL - xa) / (xb - xa) > 1 };   // (the last column before it ends)
}
// (Coal Seams, step 2) is the rock at (wx, y) coal? Big irregular patches (two octaves of noise over DEV.coalPatch, the top
// DEV.coalAmount of it: COAL_Q maps a share to the noise's level) and long veins (DEV.coalVeins a screen, about: each wanders
// up and down for screens and comes and goes, coalVeinW cells thick, swelling and thinning). Seeded by the scene's seed, so a
// level always has the same seams; none in the bottom's hard band (deepK), so fire never digs out the floor's last rock
const COAL_Q = [[0, 1.01], [0.05, 0.769], [0.1, 0.717], [0.15, 0.68], [0.2, 0.649], [0.3, 0.595], [0.4, 0.548], [0.5, 0.501], [0.6, 0.45], [1, -0.01]];
/** @param {number} a the share @returns {number} the noise level over which that share lies */
function coalQ(a) {
  for (let k = 1; k < COAL_Q.length; k++) if (a <= COAL_Q[k][0]) { const [a0, q0] = COAL_Q[k - 1], [a1, q1] = COAL_Q[k]; return q0 + (q1 - q0) * (a - a0) / (a1 - a0); }
  return -0.01;
}
/** @param {TitleScene} S @param {number} wx @param {number} y */
export function coalCell(S, wx, y) {
  if (deepK(S, y, wx) < 0.99) return false;
  const sd = (S.seed % 997) * 3.17, ps = DEV.coalPatch;
  if (titleNoise(wx / ps + sd, y / ps + 31) * 0.7 + titleNoise(wx / ps * 2.4 + 2 + sd, y / ps * 2.4 + 7) * 0.3 > coalQ(DEV.coalAmount)) return true;
  // the veins: twice as many lines as wanted, each there about half the time
  const n = Math.ceil(DEV.coalVeins * 2), span = S.bot - S.top + 120;
  for (let k = 0; k < n; k++) {
    if (titleNoise(wx / 260 + sd + k * 5.1, 90 + k * 7) < 0.5) continue;
    const vy = S.top - 60 + span * (titleNoise(wx / 140 + sd + k * 3.3, 50 + k * 13) * 1.6 - 0.3);
    const w = kru('coalVeinW', titleNoise(wx / 30 + sd + k, 70 + k * 11)) * TCELL;
    if (Math.abs(y - vy) < w / 2) return true;
  }
  return false;
}
const SOOT_GAP = 30;                  // (Coal Seams) a soot fall's spot on the roof every this far (world units)
// (Coal Seams) is there a rail along tunnel k's floor at wx (DEV.coalRails of them)?
/** @param {number} wx @param {number} k */
const railOn = (wx, k) => titleNoise(wx / 90 + k * 3.7 + 11, 210 + k * 9) > 1 - DEV.coalRails;

// (Coal Seams, owner 2026-10-17: "too copy and paste") the timber: sets measured off the rock (art/timber.js, the old game's
// timberFrame), planned a little ahead of the columns being made, lane by lane: the natural zones' floor (lane 0) and each mine
// tunnel. As the old game's timberWorks: in propped patches (DEV.coalSupports of the slice) sets stand side by side, every bay;
// outside them a tunnel keeps a sparse, half-rotted run (coalSupSparse of its bays gone, a fallen prop lying in some) and the
// natural cave the odd lone set (coalSupLone)
const TIM_AHEAD = 48;                 // columns planned ahead of the one being made
/** @param {TitleScene} S @param {number} wx */
const timPatch = (S, wx) => { const a = wx / 340 + (S.seed % 997) * 1.7; return titleNoise(a, 333) * 0.7 + titleNoise(a * 2.4 + 5, 335) * 0.3 > coalQ(DEV.coalSupports); };
// a natural column's rock (as genCol carves it: roof, floor, the Cavern's boulders, the Digging zone's pockets), cached
/** @param {TitleScene} S @param {number} c @returns {Uint8Array} */
function natCol(S, c) {
  const C = S.timCol || (S.timCol = new Map());
  let a = C.get(c);
  if (a) return a;
  const wx = c * TCELL, Zn = titleZoneSpan(wx, S), cy = titleCeil(wx, S), fy = titleFloor(wx, S);
  a = new Uint8Array(S.rows);
  const st = Zn.z === 'spider' && coalAt(S, wx) ? stalCol(wx, Zn, cy, fy, S.rows) : null;   // (as genCol: the Cavern's points)
  for (let r = 0; r < S.rows; r++) {
    const y = (r + 0.5) * TCELL;
    let s = y < cy || y >= fy || (st ? st[r] > 0 : Zn.z === 'spider' && spiderRock(wx, y, Zn, cy, fy));
    if (s && Zn.z === 'winding' && windAir(wx, y, Zn, S)) s = false;
    a[r] = s ? 1 : 0;
  }
  if (C.size > 500) C.delete(C.keys().next().value);
  C.set(c, a);
  return a;
}
/** @param {TitleScene} S @param {number} wx */
const natOk = (S, wx) => { const Z = titleZoneSpan(wx, S); return Z.z !== 'timber' && !Z.flat && !Z.blk && Z.z !== 'spider' && coalAt(S, wx); };   // (the Cavern: its own, cavPlan)
// plan one lane up to TIM_AHEAD past column c: n its number, [from, to) its columns, solid its rock, rowOf a row in the open
// over its floor at a column (-1: none), gallery (a mine tunnel's run), skip (no set over these columns)
/** @param {TitleScene} S @param {number} n @param {number} c @param {number} from @param {number} to @param {(c: number, r: number) => boolean} solid
 * @param {(c: number) => number} rowOf @param {boolean} gallery @param {(a: number, b: number) => boolean} skip */
function timberPlan(S, n, c, from, to, solid, rowOf, gallery, skip) {
  const P = S.tim || (S.tim = {}), L = P[n] || (P[n] = { x: Math.max(from, c), sets: [] });
  L.sets = L.sets.filter(t => t.c1 * TCELL > S.scroll - 60);   // (kept till they scroll off: the shots find them)
  const o = { L: TM.BEAM, D: TM.BEAMD, minH: 9, maxH: Math.round(DEV.coalSupMaxH / TCELL), gapMax: 8, rot: DEV.coalSupRot, broken: DEV.coalSupBroken };
  for (let i = 0; i < 400 && L.x < Math.min(to, c + TIM_AHEAD); i++) {
    const x = L.x, R = timberRng(h2(x + n * 7919, 501 + (S.seed % 997))), patch = timPatch(S, x * TCELL);
    const wd = Math.round(kru('coalSupW', R()) / TCELL), gap = Math.round(kru('coalSupGap', R()) / TCELL), y = rowOf(x + (wd >> 1));
    const fits = () => y >= 0 && x + wd + 3 < to && !skip(x - 3, x + wd + 3) ? timberSet(solid, x, x + wd, y, R, o) : null;
    const fallen = () => {
      const len = 8 + Math.floor(R() * 8), F = R() < DEV.coalSupFallen && y >= 0 && x + len < to && !skip(x, x + len) ? timberFallen(solid, x, len, y, o) : null;
      if (F) L.sets.push(F);
    };
    if (!patch && !gallery) {                         // the natural cave outside a patch: the odd lone set
      const T = R() < DEV.coalSupLone ? fits() : null;
      if (T) L.sets.push(T); else fallen();
      L.x = x + 30; continue;
    }
    const T = fits();
    if (!T) { L.x = x + 1; continue; }
    if (patch || R() >= DEV.coalSupSparse) L.sets.push(T); else fallen();
    L.x = x + wd + gap;
  }
}
// (Coal Seams, C3) the Cavern's timber and ladders, planned ahead as timberPlan: lane -1 timber sets (about DEV.coalCavSup a
// screen, DEV.coalCavBroken of them with a snapped post, DEV.coalCavLean of them a lone prop leaning up to the rock instead), on
// the floor or a boulder's top, up to the roof or a boulder's underside; lane -2 ladders (about DEV.coalLadders a screen, leaning
// up to DEV.coalLadLean): from the floor up to a boulder, or from a boulder's top up to the rock over it. Measured off natCol
// (the stalactites and stalagmites in it), so they stand in the room those leave
/** @param {TitleScene} S @param {number} c */
function cavPlan(S, c) {
  const P = S.tim || (S.tim = {}), rows = S.rows, sd = (/** @type {number} */ r) => r < 0 || r >= rows;
  const solid = (/** @type {number} */ cc, /** @type {number} */ r) => sd(r) || !!natCol(S, cc)[r];
  /** @param {number} wx */
  const ok = wx => { const Z = titleZoneSpan(wx, S); return Z.z === 'spider' && !Z.flat && !Z.blk && Math.min(wx - Z.x0, Z.x1 - wx) > 30 && coalAt(S, wx); };
  /** the open runs of column x: [first open row, the rock row under it, is that rock a boulder's top, is the rock over it a boulder's] @param {number} x */
  const runs = x => {
    const a = natCol(S, x), wx = x * TCELL, cr = titleCeil(wx, S) / TCELL + 1, fr = titleFloor(wx, S) / TCELL - 1, out = [];
    for (let r = 1; r < rows; r++) if (!a[r] && a[r - 1]) {
      let e = r; while (e < rows && !a[e]) e++;
      if (e < rows) out.push({ t: r, b: e, onB: e < fr, unB: r - 1 > cr });
      r = e;
    }
    return out;
  };
  const o = { L: TM.BEAM, D: TM.BEAMD, minH: 9, maxH: Math.round(DEV.coalSupMaxH / TCELL), gapMax: 8, rot: DEV.coalSupRot, broken: DEV.coalCavBroken };
  const scr = TITLE_VW / TCELL;
  for (const n of [-1, -2]) {
    const L = P[n] || (P[n] = { x: c, sets: [] }), per = n === -1 ? DEV.coalCavSup : DEV.coalLadders;
    L.sets = L.sets.filter(t => t.c1 * TCELL > S.scroll - 60);
    for (let i = 0; i < 200 && L.x < c + TIM_AHEAD; i++) {
      const x = L.x, R = timberRng(h2(x * 3 + n, 611 + (S.seed % 997)));
      if (per <= 0 || !ok(x * TCELL)) { L.x = x + 4; continue; }
      const top = Math.round((n === -1 ? DEV.coalSupMaxH : DEV.coalLadMaxH) / TCELL);
      const ru = runs(x).filter(q => q.b - q.t >= (n === -1 ? 9 : 12) && q.b - q.t <= top + 6 && (n === -1 || q.onB || q.unB));
      const q = ru.length ? ru[Math.floor(R() * ru.length)] : null;
      /** @type {import('./timber.js').TSet | null} */
      let T = null;
      if (q && n === -1 && R() >= DEV.coalCavLean) {
        const wd = Math.round(kru('coalSupW', R()) / TCELL);
        if (ok((x + wd) * TCELL)) T = timberSet(solid, x, x + wd, q.b - 4, R, o);
      }
      if (q && !T) {
        const lad = n === -2, lean = lad ? (R() * 2 - 1) * DEV.coalLadLean : (0.25 + 0.35 * R()) * (R() < 0.5 ? 1 : -1);
        T = timberSlant(solid, x, q.b - 1, lean, lad ? 5 : 2, lad ? 12 : 9, Math.round((lad ? DEV.coalLadMaxH : DEV.coalSupMaxH) / TCELL), o);
      }
      if (!T) { L.x = x + 2; continue; }
      L.sets.push(T);
      L.x = Math.max(T.c1 + 4, x + Math.round(scr / per * (0.3 + 1.4 * R())));
    }
  }
}
// the timber over column c: its cells (row → material) from every lane's sets, and a set's cap row if c is its middle
/** @param {TitleScene} S @param {number} c @param {TMine | undefined} M @param {{ c: number, f: number }[]} bands
 * @returns {{ cells: Map<number, number>, lamp: number | null }} */
function timberCol(S, c, M, bands) {
  const rows = S.rows, sd = (/** @type {number} */ r) => r < 0 || r >= rows;
  // the natural zones' floor
  timberPlan(S, 0, c, -Infinity, Infinity, (cc, r) => sd(r) || !!natCol(S, cc)[r], cc => {
    const r = Math.floor(titleFloor(cc * TCELL, S) / TCELL) - 4;
    return r > 0 && r < rows && !natCol(S, cc)[r] ? r : -1;
  }, false, (a, b) => !natOk(S, a * TCELL) || !natOk(S, b * TCELL) || !natOk(S, (a + b) / 2 * TCELL));
  // each mine tunnel: its hewn roof and floor; none by a hole between tunnels (or its chute), clear of the walled ends
  if (M) bands.forEach((q, k) => {
    const n = 1 + (M.L[0] | 0) * 8 + k;
    /** @param {number} cc @param {number} r */
    const solid = (cc, r) => {
      const x = cc * TCELL, y = (r + 0.5) * TCELL, d = dig(x, k);
      const up = Math.min(d.up, k < bands.length - 1 ? M.sh[k] - dig(x, k + 1).dn - 4 : 99);
      return sd(r) || y < q.c - up || y >= (railOn(x, k) ? q.f : q.f + d.dn);
    };
    timberPlan(S, n, c, Math.ceil((M.L[k] + 24) / TCELL), Math.floor((M.Rx[k] - 24) / TCELL), solid, () => Math.floor(q.f / TCELL) - 4, true, (a, b) => {
      if (built(a * TCELL, S) < 0.95 || built(b * TCELL, S) < 0.95) return true;
      return M.holes.some(h => (h.k === k || h.k + 1 === k) && h.k + 1 < bands.length && b * TCELL > h.x - h.w / 2 - (h2(Math.floor(h.x), 88 + h.k) < DEV.coalChutes ? 46 : 8)
        && a * TCELL < h.x + h.w / 2 + (h2(Math.floor(h.x), 88 + h.k) < DEV.coalChutes ? 46 : 8));
    });
  });
  if (DEV.coalCavSup > 0 || DEV.coalLadders > 0) cavPlan(S, c);
  /** @type {Map<number, number>} */
  const cells = new Map();
  let lamp = null;
  for (const L of Object.values(S.tim || {})) for (const T of L.sets) {
    if (c < T.c0 || c > T.c1) continue;
    const col = T.cols.get(c);
    if (col) for (const [r, m] of col) if (!cells.has(r)) cells.set(r, m);
    if (T.mid === c) lamp = T.cap;
  }
  return { cells, lamp };
}
// Coal Seams' bat spawners, about DEV.batSpawners a screen: one under a downward-facing rock face in column c (the roof, a
// boulder's or a tunnel's underside), with room under it; its bats (creatures/bats.js) hang there and fly in the space below
/** @param {TitleScene} S @param {number} c @param {number} wx */
function batCol(S, c, wx) {
  if (DEV.batSpawners <= 0 || wx < (S.batNext ?? TITLE_VW * 0.6)) return;
  const base = ci(S, c, 0), cand = [];
  for (let r = 1; r < S.rows - 8; r++) {
    if (!SOLID[S.cells[base + r - 1]] || SOLID[S.cells[base + r]]) continue;
    let a = 0; while (r + a < S.rows && !SOLID[S.cells[base + r + a]]) a++;
    if (a >= 12) cand.push([r, r + a]);   // (24 units open under it at least)
  }
  if (!cand.length) return;
  const [r] = cand[Math.floor(S.rnd() * cand.length)];
  addSpawner(S.bats ||= newBats(), wx, r * TCELL, S.rnd);
  S.batNext = wx + TITLE_VW / Math.max(0.01, DEV.batSpawners) * (0.5 + S.rnd());
}
// the bats' frame (creatures/bats.js): the players scare them; a bite only with DEV.batBite over 0
/** @param {TitleScene} S @param {number} dt */
function batsStep(S, dt) {
  const B = S.bats; if (!B) return;
  dropBats(B, Math.max(S.scroll - TITLE_BACK - 50, (S.gen - S.ncol) * TCELL + 40));   // (and before the ring of columns reuses theirs)
  const live = S.runners.filter(r => !r.out), preds = live.map(r => ({ x: S.scroll + r.x + PW / 2, y: r.y + PH / 2 }));
  // (owner: they're enemies) each bat has a stand-in among the foes (f.bat) the guns aim at and hit; one hurt or killed: its group flees
  const R = S.rnd, inF = new Set(S.foes), CS = csolid(S), solid = (/** @type {number} */ x, /** @type {number} */ y) => !!CS(Math.floor(x / TCELL), Math.floor(y / TCELL));   // (columns not made yet count as rock: no spot picked in them)
  for (const b of B.list) {
    if (b.gone || !b.placed) continue;
    const f = b.f || (b.f = batFoe(S, b));
    if (f.hp < (b.hpSeen ?? f.hp)) panicGroup(B, b.sp, R, solid, preds.length ? preds[0] : null);
    b.hpSeen = f.hp;
    if (f.hp <= 0) b.gone = true;
  }
  stepBats(B, dt, preds, solid, R, (i, d) => { if (S.lvl && S.lvl.hurt) S.lvl.hurt(S, live[i].id, d); });
  for (const b of B.list) {
    const f = b.f; if (!f) continue;
    f.x = f.hx = b.x; f.y = f.ty = f.hy = b.y + (b.st === 'hang' ? 2 * DEV.batSize : 0); f.r = 2 * DEV.batSize;
    const sx = b.x - S.scroll;
    if (!inF.has(f) && f.hp > 0 && sx > -40 && sx < TITLE_VW + 40) S.foes.push(f);
  }
}
// a bat's stand-in foe: a spider's kind made over (no brain: stepFoes skips it), DEV.batHp health, a nugget's worth of gold
/** @param {TitleScene} S @param {import('../creatures/bats.js').Bat} b @returns {Enemy} */
function batFoe(S, b) {
  const base = S.lvl && S.lvl.kind ? S.lvl.kind('hamahakki', 1) : enemyFor('hamahakki', 1);
  const k = { ...base, id: 'bat', name: 'Bat', act: 'bat', kp: undefined, elite: false, boss: false, dmg: 0, r: 2, hp: DEV.batHp, gold: 1, col: { ...base.col, a: '#4a3a4c' } };
  return { x: b.x, y: b.y, ty: b.y, r: 2 * DEV.batSize, phase: 0, hp: DEV.batHp, hpMax: DEV.batHp, cd: 1e9, flash: 0, lx: 0, ly: 1, hx: b.x, hy: b.y, tgt: null, rest: 0, k, touch: 1e9, charge: 0, bat: true };
}
// the scene's rock at a world point
/** @param {TitleScene} S @returns {(x: number, y: number) => boolean} */
const rockAt = S => (x, y) => !!SOLID[titleCell(S, Math.floor(x / TCELL), Math.floor(y / TCELL))];
// the worms' own random numbers (so they leave the level's own stream, and so its layout, as it was)
/** @param {number} seed @returns {() => number} */
const wormRng = seed => { let q = (Math.floor(seed * 7919) % 2147483646 + 2147483646) % 2147483646 + 1; return () => (q = (q * 16807) % 2147483647) / 2147483647; };
// (C5, the owner) Coal Seams' glow worms come in clusters: a zone slice (one the Dev allows: glowInMines / glowInDig /
// glowInCavern) gets one with DEV.glowCluster's chance, DEV.glowClusterMin..Max worms close together on the rock round a spot in
// it (a floor or a roof), put down once the columns round the spot are made. creatures/glowworm.js; they roam on from there
/** @param {TitleScene} S @param {number} c @param {number} wx */
function wormCol(S, c, wx) {
  const R = S.wormRnd ||= wormRng(S.seed), Z = titleZoneSpan(wx, S), D = DEV;
  if (!S.wormSlices) S.wormSlices = new Set();
  if (!S.wormSlices.has(Z.x0)) {
    S.wormSlices.add(Z.x0);
    const ok = { timber: D.glowInMines, winding: D.glowInDig, spider: D.glowInCavern }[Z.z] ?? 0;
    if (ok > 0.5 && R() < D.glowCluster && Z.x1 - Z.x0 > 60) {
      const n = Math.round(D.glowClusterMin + R() * Math.max(0, D.glowClusterMax - D.glowClusterMin));
      const span = Math.min(80, 6 + n * 3), cx = Math.max(wx + span, Z.x0 + span + (Z.x1 - Z.x0 - 2 * span) * (0.2 + 0.6 * R()));
      (S.wormPend ||= []).push({ x: cx, span, n, z: Z.z });
    }
  }
  if (!S.wormPend) return;
  for (const P of S.wormPend) if (!P.done && wx >= P.x + P.span + 4) { P.done = true; wormCluster(S, P, R); }
  S.wormPend = S.wormPend.filter(P => !P.done);
}
// the rock surfaces (floor: air over rock; roof: rock over air) in column c, as y just off them
/** @param {TitleScene} S @param {number} c @returns {number[]} */
function wormSurfs(S, c) {
  const base = ci(S, c, 0), cand = [];
  for (let r = 4; r < S.rows - 4; r++) {
    if (SOLID[S.cells[base + r]] && !SOLID[S.cells[base + r - 1]] && !SOLID[S.cells[base + r - 4]]) cand.push(r * TCELL - 0.5);
    if (SOLID[S.cells[base + r - 1]] && !SOLID[S.cells[base + r]] && !SOLID[S.cells[base + r + 3]]) cand.push(r * TCELL + 0.5);
  }
  return cand;
}
// a cluster put down: a spot's surface, then each worm on the surface nearest it in a column within span of the spot
/** @param {TitleScene} S @param {{ x: number, span: number, n: number, z: string }} P @param {() => number} R */
function wormCluster(S, P, R) {
  const solid = rockAt(S), c0 = Math.floor(P.x / TCELL), home = wormSurfs(S, c0);
  if (!home.length) return;
  const hy = home[Math.floor(R() * home.length)];
  let made = 0;
  for (let k = 0; k < P.n * 4 && made < P.n; k++) {
    const x = P.x + (R() * 2 - 1) * P.span, ys = wormSurfs(S, Math.floor(x / TCELL));
    let y = NaN, d = 30;
    for (const q of ys) if (Math.abs(q - hy) < d) { d = Math.abs(q - hy); y = q; }
    if (isNaN(y)) continue;
    const w = newWorm(x, y, R() < 0.5 ? 1 : -1, solid, R);
    if (w) { (S.worms ||= []).push(w); made++; }
  }
  if (made) (S.wormClusters ||= []).push({ x: P.x, y: hy, n: made, z: P.z });
}
// the glow worms' frame: each crawls on (stage a: no agro yet); those far behind the view dropped
/** @param {TitleScene} S @param {number} dt */
function wormsStep(S, dt) {
  if (!S.worms) return;
  const x0 = Math.max(S.scroll - TITLE_BACK - 50, (S.gen - S.ncol) * TCELL + 40);   // (and before the ring of columns reuses theirs)
  if (S.worms.some(w => w.r.x < x0)) S.worms = S.worms.filter(w => w.r.x >= x0);
  const solid = rockAt(S);
  const R = S.wormRnd ||= wormRng(S.seed), D = DEV;
  if (S.lootLater) { for (const q of S.lootLater) if ((q.t -= dt) <= 0) dropLoot(S, q.f); S.lootLater = S.lootLater.filter(q => q.t > 0); }
  // killed: it lies still for DEV.glowFuse (f.fuse, set by killFoe), then blows up and goes
  for (const w of S.worms) { const f = w.foe; if (f && f.hp <= 0 && (f.fuse || 0) > 0 && (f.fuse -= dt) <= 0) { f.fuse = 0; wormBlast(S, f); } }
  if (S.worms.some(w => w.foe && w.foe.hp <= 0 && !(w.foe.fuse || 0))) S.worms = S.worms.filter(w => !(w.foe && w.foe.hp <= 0 && !(w.foe.fuse || 0)));
  const live = S.runners.filter(r => !r.out), inF = new Set(S.foes);
  for (const w of S.worms) {
    if (w.foe && w.foe.hp <= 0) continue;   // (dead, its fuse burning)
    // the nearest player's middle: agro, strike (a strike at its height hurts him: DEV.glowStrikeDmg)
    let tgt = null, td = Infinity, ti = -1;
    for (let i = 0; i < live.length; i++) { const x = S.scroll + live[i].x + PW / 2, y = live[i].y + PH / 2, q = Math.hypot(x - w.r.x, y - w.r.y); if (q < td) { td = q; tgt = { x, y }; ti = i; } }
    const ev = stepWorm(w, dt, solid, R, tgt);
    if (ev === 'strike' && ti >= 0 && S.lvl && S.lvl.hurt) S.lvl.hurt(S, live[ti].id, D.glowStrikeDmg);
    // its stand-in among the foes (as a bat's): the guns aim at it and hit it; killed, it blows up (killFoe → wormBlast)
    const f = w.foe || (w.foe = wormFoe(S, w)), j2 = w.pts[2], j3 = w.pts[3];
    f.x = f.hx = (j2.x + j3.x) / 2; f.y = f.ty = f.hy = (j2.y + j3.y) / 2; f.r = (D.glowW + 1.5) * w.sz;
    const sx = f.x - S.scroll;
    if (!inF.has(f) && f.hp > 0 && sx > -40 && sx < TITLE_VW + 40) S.foes.push(f);
    if (ev !== 'plant' || S.parts.length >= TITLE_PARTS - 20) continue;
    // a foot down: a puff of green spores off the middle of its back, out from the rock (the jellyfish's puff, devpanel.js JellyPreview)
    const a0 = Math.atan2(w.r.ny + w.f.ny, w.r.nx + w.f.nx);
    for (let i = 0, k = Math.round(D.glowSpores); i < k; i++) {
      const a = a0 + (R() * 2 - 1) * D.glowSporeSpread * Math.PI / 180, v = D.glowSporeSpd * (0.6 + 0.4 * R()), l = 4 + R() * 3;
      S.parts.push({ x: f.x - S.scroll, y: f.y, vx: (R() - 0.5) * 4, vy: -1 - R() * 2, life: l, max: l, r: 0.8, col: WORM_SPORE, kind: 'wspore', kx: Math.cos(a) * v, ky: Math.sin(a) * v });
    }
  }
  // the green spores drifting round each cluster in view (the natural caves' luminescent spores, in the worms' green), DEV.glowAmbient
  // a second each, within DEV.glowAmbientR of it
  for (const C of S.wormClusters || []) {
    if (C.x - S.scroll < -D.glowAmbientR || C.x - S.scroll > TITLE_VW + D.glowAmbientR || S.parts.length >= TITLE_PARTS - 40 || R() >= dt * D.glowAmbient) continue;
    const wx = C.x + (R() * 2 - 1) * D.glowAmbientR, y = C.y + (R() * 2 - 1) * D.glowAmbientR * 0.6, l = 5 + R() * 3;
    if (!solid(wx, y)) S.parts.push({ x: wx - S.scroll, y, vx: (R() - 0.5) * 8, vy: -2 - R() * 3, life: l, max: l, r: 0.9, col: WORM_SPORE, kind: 'wspore', kx: 0, ky: 0 });
  }
  if (S.wormClusters) S.wormClusters = S.wormClusters.filter(C => C.x > S.scroll - TITLE_BACK);
}
const WORM_SPORE = '#7dff3a';   // (the worms' neon green)
// a worm's stand-in foe: a spider's kind made over (no brain: stepFoes skips it; creatures/glowworm.js moves it), DEV.glowHp health
/** @param {TitleScene} S @param {import('../creatures/glowworm.js').GlowWorm} w @returns {Enemy} */
function wormFoe(S, w) {
  const base = S.lvl && S.lvl.kind ? S.lvl.kind('hamahakki', 1) : enemyFor('hamahakki', 1), x = w.r.x, y = w.r.y;
  const k = { ...base, id: 'glowworm', name: 'Glow worm', act: 'worm', kp: undefined, elite: false, boss: false, dmg: 0, r: 2, hp: DEV.glowHp, gold: 2, col: { ...base.col, a: WORM_SPORE } };
  return { x, y, ty: y, r: (DEV.glowW + 1.5) * w.sz, phase: 0, hp: DEV.glowHp, hpMax: DEV.glowHp, cd: 1e9, flash: 0, lx: 0, ly: 1, hx: x, hy: y, tgt: null, rest: 0, k, touch: 1e9, charge: 0, worm: true };
}
// (C5b) a glow worm killed: a burst of bright green, a hole blasted in the rock (DEV.glowHole), the creatures in DEV.glowBlastR hurt
// (DEV.glowBlastDmg: other worms too, so a patch of them goes off in a chain), and the team at DEV.glowTeam of it
/** @param {TitleScene} S @param {Enemy} f */
function wormBlast(S, f) {
  const x = f.x - S.scroll, y = f.ty, r = DEV.glowBlastR, D = DEV;
  snd(S, 'boom', x, y, r * 1.6);
  S.booms.push({ x, y, r: r * 1.6, t: 0, max: 0.55, sid: 'worm' });
  burst(S, x, y, 40, WORM_SPORE, 170, 'spark', 0.8);
  burst(S, x, y, 20, '#eaffd8', 90, 'spark', 0.5);
  burst(S, x, y, 16, '#2fd23a', 110, 'chunk', 1);
  S.shake = Math.min(7, S.shake + 1.5); S.flash = Math.min(0.3, S.flash + 0.06);
  if (D.glowHole > 0) titleCarve(S, x, y, D.glowHole);
  for (const g of S.foes) if (g !== f && g.hp > 0 && Math.hypot(g.x - S.scroll - x, g.ty - y) < r + g.r) hitFoe(S, g, D.glowBlastDmg, WORM_SPORE);
  if (S.lvl && S.lvl.hurt && D.glowTeam > 0) for (const ru of S.runners) if (!ru.out && Math.hypot(ru.x + PW / 2 - x, ru.y + PH / 2 - y) < r + 6) S.lvl.hurt(S, ru.id, D.glowBlastDmg * D.glowTeam);
}
// Coal Seams' mine set in column c (the old game's floor 2 decorations): rusted lanterns hung off whatever rock or timber is over a
// spot in the open (the roof, a boulder's underside) and under a support's cap now and then; explosive minecarts (the floor flat
// under the whole cart) and pickaxes lying on the floors: a natural zone's, a mine's tunnels' (tuns: those open here)
/** @param {TitleScene} S @param {number} c @param {number} wx @param {TZone} Zn @param {number | null | undefined} cap a timber set's cap row, at its middle column
 * @param {number} rcy @param {number} fy @param {{ rf: number, f: number, rail: boolean }[]} tuns */
function coalDeco(S, c, wx, Zn, cap, rcy, fy, tuns) {
  const R = S.rnd, base = ci(S, c, 0);
  if (cap != null && R() < 0.5) lamp(S, c, wx, (cap + 2.5) * TCELL, 3 + R() * 5, true);
  if (Zn.z !== 'timber' && !(c % 5) && R() < DEV.coalLamps) {
    const y0 = rcy + 2 + R() * Math.max(0, fy - rcy - 40);
    if (!HOLDS[S.cells[base + Math.floor(y0 / TCELL)]]) lamp(S, c, wx, y0, 4 + R() * 14, true);
  }
  if (c % 3) return;
  for (const { f, rail } of Zn.z === 'timber' ? tuns.map(t => ({ f: t.rail ? t.f : t.rf, rail: t.rail })) : [{ f: fy, rail: false }]) {
    const r = Math.ceil(f / TCELL - 0.5);   // the floor's top rock row
    if (r <= 8 || r >= S.rows || !SOLID[S.cells[base + r]] || SOLID[S.cells[base + r - 1]]) continue;
    const lc = wx >= (S.gasNext ?? 0) ? lowCorner(S, c, r) : null;
    if (lc) {   // a gas pocket in a low corner, about DEV.coalGas a screen
      (S.gas ||= []).push({ wx: (lc.c + 0.5) * TCELL, y: lc.r * TCELL, r: DEV.coalGasSize * (0.7 + 0.6 * h2(wx, 71)) });
      S.gasNext = wx + TITLE_VW / Math.max(0.01, DEV.coalGas) * (0.15 + 0.9 * h2(wx, 73));   // (a gap a little short of the mean: the next corner after it comes a little later)
    }
    const p = R(), y = r * TCELL;
    const cp = DEV.coalCarts * (rail ? 3 : 1);   // (carts mostly on the rails)
    if (p < cp) {
      // the cart's 9 columns back from here (made: the ones ahead aren't yet) all floor at row r with open air over it
      let flat = true;
      for (let k = 0; k <= 8 && flat; k++) {
        const b = ci(S, c - k, 0);
        if (!SOLID[S.cells[b + r]]) flat = false;
        for (let q = r - 7; q < r && flat; q++) if (SOLID[S.cells[b + q]]) flat = false;
      }
      if (flat) S.props.push({ k: 'barrel', st: 'cart', ox: (c - 3.5) * TCELL, x: 0, y, len: 0, seed: R(), side: 1, burn: 0, ac: c - 4, ar: r });
    } else if (p < cp + DEV.coalPicks) {
      S.props.push({ k: 'bake', st: 'pickaxe', ox: wx + 1, x: 0, y, len: 0, seed: R(), side: R() < 0.5 ? 1 : -1, burn: 0, ac: c, ar: r });
    }
  }
}
// a low corner by column c's floor (top rock row r), as { c, r } of the floor there: c's own floor when rock rises 3+ cells
// over it within 6 columns behind; or, c's floor being a step's top, a floor 3+ cells lower within 6 columns behind (rock rising
// on its right: judged once this column exists). A hollow's side, a tunnel's dead end
/** @param {TitleScene} S @param {number} c @param {number} r @returns {{ c: number, r: number } | null} */
function lowCorner(S, c, r) {
  for (let k = 2; k <= 6; k++) { const b = ci(S, c - k, 0); if (SOLID[S.cells[b + r - 3]] && SOLID[S.cells[b + r - 5]]) return { c, r }; }
  for (let k = 2; k <= 6; k++) {
    const b = ci(S, c - k, 0);
    for (let q = r; q < Math.min(S.rows, r + 14); q++) if (SOLID[S.cells[b + q]]) { if (q - r >= 3) return { c: c - k, r: q }; break; }
  }
  return null;
}
// (Coal Seams) a gas pocket goes off: a pale blue whoomph, a flash, a soft blast (no rock bitten) that hurts the creatures in it
// (DEV.coalGasDmg), sets fire round it and sets off carts; its boom (sid 'gas') sets off pockets near it (stepGas)
/** @param {TitleScene} S @param {TGas} g */
function gasBoom(S, g) {
  if (g.gone) return;
  g.gone = true;
  const x = g.wx - S.scroll, y = g.y - g.r * 0.5, r = DEV.coalGasBoom;
  snd(S, 'whoosh', x, y, r * 2);
  S.booms.push({ x, y, r: r * 1.6, t: 0, max: 0.6, sid: 'gas' });
  burst(S, x, y, 14, kcol('coalGasCol', 0.3), 70, 'fire', 0.5);
  S.shake = Math.min(7, S.shake + 1.5); S.flash = Math.min(0.3, S.flash + 0.08);
  titleIgnite(S, x, y, r + 3);
  for (const f of S.foes) if (f.hp > 0 && Math.hypot(f.x - S.scroll - x, f.ty - y) < r + f.r) hitFoe(S, f, DEV.coalGasDmg, '#9cc8ff');
  for (const q of S.props) if (!q.gone && q.k === 'barrel' && cartHit(q, x, y, r)) q.fuse = Math.min(q.fuse ?? 1, CART_FUSE + S.rnd() * 0.15);
}
// the gas pockets each frame: fire at one, or a fresh blast reaching it, lights it (a short fuse, so a chain ripples)
/** @param {TitleScene} S @param {number} dt */
function stepGas(S, dt) {
  if (!S.gas || !S.gas.length) return;
  for (const g of S.gas) {
    if (g.gone) continue;
    if (g.fuse != null) { if ((g.fuse -= dt) <= 0) gasBoom(S, g); continue; }
    const x = g.wx - S.scroll;
    if (x < -40 || x > TITLE_VW + 40) continue;
    if (S.fire.length && fireNear(S, g.wx, g.y - g.r * 0.5, g.r)) { g.fuse = 0.05; continue; }
    for (const b of S.booms) if (b.t < 0.15 && Math.hypot(b.x - x, b.y - (g.y - g.r * 0.5)) < b.r * 0.6 + g.r) { g.fuse = 0.08 + S.rnd() * 0.1; break; }
  }
  S.gas = S.gas.filter(g => !g.gone && g.wx - S.scroll > -80);
}
// an explosive minecart's body (screen), where a shot or a blast finds it
/** @param {TProp} p @param {number} x @param {number} y @param {number} r */
const cartHit = (p, x, y, r) => x > p.x - 9 - r && x < p.x + 9 + r && y > p.y - 13 - r && y < p.y + r;
const CART_FUSE = 0.12;               // a cart caught in another's blast goes off this long after (+ up to 0.15 s)
// (Coal Seams) an explosive minecart goes off (a shot, a blast, fire beside it): a blast that bites the rock (DEV.coalCartR),
// hurts the creatures in it (DEV.coalCartDmg) and sets fire round it; lanterns in it pop, carts near it go off after a moment
/** @param {TitleScene} S @param {TProp} p */
function cartBoom(S, p) {
  if (p.gone) return;
  p.gone = true;
  const x = p.x, y = p.y - 6, r = DEV.coalCartR;
  snd(S, 'boom', x, y, r * 2.4);
  S.booms.push({ x, y, r: r * 1.6, t: 0, max: 0.5 });
  burst(S, x, y, 18, '#ffb02e', 110, 'fire', 0.55);
  burst(S, x, y, 6, '#3a3346', 30, 'smoke', 1.3);
  burst(S, x, y, 8, '#6e4a32', 120, 'chunk', 0.9);
  burst(S, x, y, 4, '#8c8f96', 120, 'chunk', 0.9);
  S.shake = Math.min(7, S.shake + 3); S.flash = Math.min(0.35, S.flash + 0.12);
  titleCarve(S, x, y, r);
  titleIgnite(S, x, y, r + 5);
  for (const g of S.foes) if (g.hp > 0 && Math.hypot(g.x - S.scroll - x, g.ty - y) < r + g.r) hitFoe(S, g, DEV.coalCartDmg, '#ffb02e');
  for (const q of S.props) if (!q.gone && q !== p) {
    if (q.k === 'lamp' && lampHit(q, x, y, r)) popLamp(S, q);
    else if (q.k === 'barrel' && cartHit(q, x, y, r)) q.fuse = Math.min(q.fuse ?? 1, CART_FUSE + S.rnd() * 0.15);
  }
}

// A gun for the title: a random skin, shot and 0–2 modifiers. The shot's numbers go through each modifier's
// own f (spells/mods.js) as the game's cast does; double / triple fire that many of it at once. cd: the
// shot's cast delay (+ the modifiers' d) at the title's pace
/** @param {() => number} R @returns {TKit} */
export function titleKit(R) {
  const pick = (/** @type {string[]} */ a) => a[Math.floor(R() * a.length)];
  const shot = pick(TITLE_SHOTS), nm = R() < 0.2 ? 0 : R() < 0.55 ? 1 : 2, mods = [];
  for (let i = 0; i < nm; i++) { const m = pick(TITLE_MODS); if (!mods.includes(m)) mods.push(m); }
  return kitOf(shot, mods, pick(GUN_ART.map(a => a.id)));
}
// the gun a player swaps to when rock is in its way (owner, v0.0.166): the Buzzsaw, cutting a tunnel
export const TITLE_SAW = 'irongatling';
export const TITLE_DIGR = 13;         // the tunnel's radius (world units; he's 12 × 22)
const JET = GRAV * 2.4;                // the jetpack's push, full blast (v0.0.171: gravity pulls a flying player too)
const DIGV = 30;                      // the most he moves while sawing (world units / s, the scroll on top)
// that gun from its shot, modifiers and skin
/** @param {string} shot @param {string[]} mods @param {string} art @returns {TKit} */
function kitOf(shot, mods, art) {
  const M = MODS[shot];
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
  return { art, shot, mods, name: [shot, ...mods].join('+'), cd: Math.max(0.06, d * 1.7) * (n > 1 ? 1.3 : 1), n: s.count * n,
    dmg: s.dmg, speed: s.speed, spread: s.spread + (n > 1 ? 6 : 0), size: Math.min(8, s.size), life: Math.min(4, s.life), grav: s.grav, drag: s.drag,
    explode: Math.min(40, s.explode), pit: Math.min(10, s.pit), fire: s.fire, bounce: s.bounce, bounceE: s.bounceE, pierce: s.pierce, homing: s.homing,
    accel: s.accel, vmax: s.vmax, chain: M.chain || 0, col: M.col, look: M.look || '' };
}

// opts.runners: how many players (1-4; default TITLE_RUNNERS): CaveRunner Auto shows the run's players
// opts.hub: a fixed strip instead of the scrolling ring (TitleHub; auto/hub.js hubScene): no creatures, no scroll
// opts.level: a finite plan in the scrolling ring (TitleLevel; auto/level.js levelScene)
// opts.ncol: the ring's width in columns (Dev → Zones: wide enough to keep its whole strip as it pans back)
// opts.team: the run's players (RunPlayer, CaveRunner Auto): each runner fires its player's active gun (art/scenegun.js) in place of the menu's kits
// opts.looks: the old floors' looks (S.looks), there before the first columns are made (Coal Seams' decorations go by them: coalAt)
/** @param {number} vh the view's height in world units @param {number} [seed] @param {number} [top] the action's band (world units) @param {number} [bot] @param {{ runners?: number, hub?: TitleHub, level?: TitleLevel, team?: RunPlayer[], tier?: number, ncol?: number, looks?: TLook[] }} [opts] @returns {TitleScene} */
export function titleScene(vh, seed = 7, top = vh * 0.3, bot = vh * 0.62, opts = {}) {
  const rnd = titleRng(seed), rows = Math.ceil(vh / TCELL) + 1, hub = opts.hub, ncol = hub ? hub.w : opts.ncol || Math.ceil((TITLE_VW + 50 + (opts.level ? AHEAD_LVL + TITLE_BACK : AHEAD)) / TCELL);
  /** @type {TitleScene} */
  const S = { t: 0, vh, top, bot, seed, rnd, zp: titlePlan(seed), scroll: 0, shake: 0, spawn: 0, kills: 0, gold: 0, got: 0, runner: null, runners: [], foes: [], shots: [],
    parts: [], coins: [], booms: [], zaps: [], flash: 0, rows, ncol, cells: new Uint8Array(rows * ncol), gen: -25, props: [],
    fire: [], dirty: [], dirtyAll: true, carved: 0, burnt: 0, swaps: 0, groundT: 0, flyT: 0, kinds: {}, webs: [], cut: 0, lineT: 0,
    silk: [], nav: { F: null, fx: 0, fy: 0, t: -9 }, fireAcc: 0, fireN: 0, burning: new Set(), gotN: 0, pops: 0, lampsPopped: 0, kitNames: new Set(), digT: 0, digs: 0, digWhy: {}, snd: [] };
  if (opts.level) { S.zp = opts.level.zp; S.lvl = opts.level; }
  if (opts.team) S.team = opts.team;
  if (opts.tier) S.tier = opts.tier;
  if (opts.looks) S.looks = opts.looks;
  if (hub) {                            // a fixed strip: every column made now, nothing comes in
    S.hub = hub; S.still = true; S.gen = ncol;
    for (let c = 0; c < ncol; c++) for (let r = 0; r < rows; r++) S.cells[ci(S, c, r)] = hub.cell(c, r, rows);
  }
  genTo(S);
  // four players, spread along the left side, each on its own clock (S.runner: player 1)
  for (let i = 0, n = Math.max(1, Math.min(TITLE_RUNNERS, opts.runners || TITLE_RUNNERS)); i < n; i++) {
    const x = 18 + i * 30, y = titleSurf(S, x + PW / 2, (top + bot) / 2, 1) - PH;
    S.runners.push(titleRunner(S, i, x, y));
  }
  S.runner = S.runners[0];
  if (!hub) for (let i = 0; i < 6; i++) addFoe(S, 130 + rnd() * 90);
  return S;
}
// one runner (player i, 0-3) at x, y: titleScene's, and CaveRunner Auto's player added mid-scene (auto/addrunner.js)
/** @param {TitleScene} S @param {number} i @param {number} x @param {number} y @returns {TRunner} */
export function titleRunner(S, i, x, y) {
  const rnd = S.rnd;
  return { x, y, vx: 0, vy: 0, face: 1, ang: 0, cd: 0.5 + i * 0.2, kit: titleKit(rnd), flame: 0, id: i, col: TITLE_COLS[i],
    mode: 'run', modeT: runTime(rnd), tx: x, ty: y, retarget: 0, gait: i * 1.7, ground: true, swapT: 2 + i * 1.2 + rnd() * 2, swap: 0, wvx: 0, wvy: 0,
    dig: 0, clearT: 0, keep: null, dx: 1, dy: 0, digY: 0, sawT: 0, switches: [],
    bursty: [0.75, 0.15, 0.5, 0.3][i], burst: false, jet: false, jetT: 0, jetCd: 0, pace: 0.75 + rnd() * 0.5, spd: 1,
    nav: { F: null, fx: 0, fy: 0, t: -9 } };
}
// the terrain is made this far past the screen's right edge (v0.0.170: was 40, and a rat swarm coming in
// at the edge spread past it, into what wasn't made yet, and sank into the rock)
const AHEAD = 130;
// (owner, after v1.0.78: webs popped on) a level makes its columns further ahead, so an orb web (up to autoOrbR across
// each way, its hub behind the column that makes it) is strung before it comes into view; one that would show is skipped
const AHEAD_LVL = 340;
// (CaveRunner Auto's level, feedback round 2: roaming back by hand) a level keeps this much more behind the screen's left
// edge: its ring of columns is this much wider, and props, webs, creatures, coins and loot are culled only past it
export const TITLE_BACK = 400;
// how far behind the screen's left edge things are culled (world units, negative): d on the title, TITLE_BACK in a level
/** @param {TitleScene} S @param {number} d */
const behind = (S, d) => (S.lab ? -Infinity : S.lvl ? -TITLE_BACK : d);   // (Dev's fire sim pans both ways: nothing culled, v1.0.61)
// a sound for the title's player (ui/titlesound.js), at screen point (x, y); a frame's are played and cleared there
/** @param {TitleScene} S @param {string} k @param {number} x @param {number} y @param {any} [a] */
const snd = (S, k, x, y, a) => { if (S.snd.length < 80) S.snd.push({ k, x, y, a }); };
/** @param {TitleScene} S */
function genTo(S) {
  if (S.hub) return;
  while (S.gen * TCELL < S.scroll + TITLE_VW + (S.lvl ? AHEAD_LVL : AHEAD)) { genCol(S, S.gen); S.gen++; }
  if (S.lightLater) { for (const [c, r] of S.lightLater) light(S, c, r); S.lightLater = undefined; }
}

// the terrain as the creatures' brains see it (the game's terrain cells, world coordinates): out
// of the ring of columns made so far, rock (they keep to the stretch on and near the screen)
/** @param {TitleScene} S @returns {(cx: number, cy: number) => number} */
// (exported for the painter's lights: their shadows, v0.0.171)
export const titleSolidCell = (/** @type {TitleScene} */ S) => csolid(S);
const csolid = S => (cx, cy) => (cy < 0 || cy >= S.rows || cx < S.gen - S.ncol || cx >= S.gen ? 1 : SOLID[S.cells[ci(S, cx, cy)]]);
/** @param {TitleScene} S @returns {(x: number, y: number) => boolean} world point in rock */
const wsolid = S => { const C = csolid(S); return (x, y) => !!C(Math.floor(x / CELL), Math.floor(y / CELL)); };

// A creature comes in at the right (screen x; default just off it): only what lives in that zone
// (TITLE_HOME, weighted), made as makeLevel makes them (enemyFor: the real kind, floor 1), in WORLD
// coordinates, so the game's own brains move them over the terrain. A jellyfish in the open, a
// spider on the roof or the floor, rats a few at once on the floor (no nests on the title)
/** @param {TitleScene} S @param {number} [x] @param {number} [cap] (a swarm stops at it too) */
function addFoe(S, x, cap = TITLE_FOES) {
  const R = S.rnd, wx = (x === undefined ? TITLE_VW + 16 : x) + S.scroll;
  const id = titleKind(S, wx);
  S.kinds[id] = (S.kinds[id] || 0) + 1;
  const n = id === 'rotta' ? 3 + Math.floor(R() * 4) : id === 'hamahakki' ? 1 + Math.floor(R() * 2) : 1;
  for (let i = 0; i < n && S.foes.length < Math.min(cap, TITLE_FOES); i++) {
    const ex = wx + i * (8 + R() * 8);
    if (i && titleZone(ex, S) !== titleZone(wx, S)) break;          // a swarm stops at its zone's end
    if (ex >= S.gen * TCELL - 6) break;                               // … and where the terrain isn't made yet
    titleFoeAt(S, S.lvl && S.lvl.kind ? S.lvl.kind(id, S.tier || 1) : enemyFor(id, S.tier || 1), ex);   // (a level: its own scaling, auto/enemies.js autoFoe)
  }
}
// one creature of kind k (enemyFor, or an elite / a boss: CaveRunner Auto) at world x: a jellyfish in the open, a spider
// on the roof or the floor, a rat on the floor. In the level the run's tier scales them (S.tier, auto/level.js)
/** @param {TitleScene} S @param {CreatureKind} k @param {number} ex world x @returns {Enemy} */
export function titleFoeAt(S, k, ex) {
  const R = S.rnd, id = k.id, cy = titleCeil(ex, S), fy = titleFloor(ex, S);
  const ey = id === 'meduusa' || CLASSIC[k.act] ? cy + (fy - cy) * (0.25 + 0.45 * R()) : id === 'hamahakki' && R() < 0.5 ? cy + k.r : fy - k.r - 1;
  /** @type {Enemy} */
  const f = { x: ex, y: ey, ty: ey, r: k.r, phase: R() * 6.28, hp: k.hp, hpMax: k.hp, cd: 1 + R() * 2, flash: 0, lx: 0, ly: 1,
    hx: ex, hy: ey, tgt: null, rest: R() * 3, k, touch: 0, charge: 0 };
  S.foes.push(f);
  return f;
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
  if (S.parts.length >= TITLE_PARTS + FIRE_PARTS) return;
  const R = S.rnd;
  if (autoOn(S)) {   // (owner v1.0.60) Dev → Fire: flames and smoke
    for (let n = fxCount(R, DEV.fxFlRate); n > 0; n--)
      fxPart(S, 'flame', x, y, (R() * 2 - 1) * kr('fxFlSide', R), -kr('fxFlRise', R), kr('fxFlLife', R), kr('fxFlSize', R));
    return;
  }
  const l = 0.25 + R() * 0.3;
  S.parts.push({ x, y, vx: (R() - 0.5) * 16, vy: -30 - R() * 40, life: l, max: 0.55, r: 1 + R() * 1.2,
    col: R() < 0.4 ? '#ffd35a' : R() < 0.6 ? '#ff8a2a' : '#e8461c', kind: 'flame' });
}
// (owner v1.0.60) how many of a particle for a rate (× the usual: 1.5 is one, and another half the time)
/** @param {() => number} R @param {number} rate */
const fxCount = (R, rate) => Math.floor(rate) + (R() < rate % 1 ? 1 : 0);
// a flame speck or a puff of smoke whose look comes from Dev → Fire: flames and smoke (titledraw.js): fx, its own shift along
// the colour (u), its own opacity (a), smoke's growth (g)
/** @param {TitleScene} S @param {string} kind @param {number} x @param {number} y @param {number} vx @param {number} vy @param {number} life @param {number} r */
function fxPart(S, kind, x, y, vx, vy, life, r) {
  if (S.parts.length >= TITLE_PARTS + FIRE_PARTS) return;
  const R = S.rnd, sm = kind === 'fsmoke';
  S.parts.push({ x, y, vx, vy, life, max: life, r, col: '', kind, fx: true, u: R(), a: 1 - (sm ? DEV.fxSmAlphaJit : DEV.fxFlAlphaJit) * R(), g: sm ? kr('fxSmGrow', R) : 0 });
}
// A jet of flame out of the floor at screen x sx, the floor at fy (Dev's fire sim, Fire held: art/firelab.js labStep), h high
// this frame (0: none): flame specks shooting up it, smoke off its top now and then, and what it reaches catching
/** @param {TitleScene} S @param {number} sx @param {number} fy @param {number} h @param {number} dt */
export function titleJet(S, sx, fy, h, dt) {
  if (h < 2) return;
  const R = S.rnd;
  for (let n = Math.ceil(dt * (40 + h * 2)); n > 0 && S.parts.length < TITLE_PARTS; n--) {
    const l = 0.25 + R() * 0.3, v = h / 0.4 * (0.6 + R() * 0.5);
    fxPart(S, 'flame', sx + (R() - 0.5) * 3, fy - 1.5, (R() - 0.5) * 14, -v, l, kr('fxFlSize', R) * 1.2);
  }
  if (R() < dt * 4) fireSmoke(S, sx, fy - h);
  if (R() < dt * 12) titleIgnite(S, sx + (R() - 0.5) * 4, fy - R() * h, 5, 0.8);
}
/** @param {TitleScene} S @param {number} x @param {number} y */
function fireSmoke(S, x, y) {
  if (S.parts.length >= TITLE_PARTS + FIRE_PARTS) return;
  const R = S.rnd;
  if (autoOn(S)) {   // (owner v1.0.60) Dev → Fire: flames and smoke
    for (let n = fxCount(R, DEV.fxSmRate); n > 0; n--)
      fxPart(S, 'fsmoke', x, y, (R() * 2 - 1) * kr('fxSmSide', R), -kr('fxSmRise', R), kr('fxSmLife', R), kr('fxSmSize', R));
    return;
  }
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
  snd(S, 'lamp', x, y);
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
/** @param {TitleScene} S @param {number} sx @param {number} y @param {number} r @param {boolean} [rim] blasted: the rock round it chars (not a saw's cut) */
export function titleCarve(S, sx, y, r, rim = true) {
  const wx = sx + S.scroll, c0 = Math.floor((wx - r - 2) / TCELL), c1 = Math.floor((wx + r + 2) / TCELL);
  const r0 = Math.max(0, Math.floor((y - r - 2) / TCELL)), r1 = Math.min(S.rows - 1, Math.floor((y + r + 2) / TCELL));
  let n = 0;
  for (let c = Math.max(c0, S.gen - S.ncol); c <= Math.min(c1, S.gen - 1); c++) for (let rr = r0; rr <= r1; rr++) {
    const d = Math.hypot((c + 0.5) * TCELL - wx, (rr + 0.5) * TCELL - y), i = ci(S, c, rr), m = S.cells[i];
    const reach = rim ? r * deepK(S, (rr + 0.5) * TCELL, (c + 0.5) * TCELL) : r;   // (a blast: less toward the bottom edge; the saw: as ever)
    if (d <= reach) { if (m !== TM.AIR) { S.cells[i] = TM.AIR; n++; S.burning.delete(c * S.rows + rr); } }
    else if (rim && d <= reach + 2 && SOLID[m] && m !== TM.CHAR) S.cells[i] = TM.CHAR;
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
function catchPlant(S, p) { if (!p.burn && !p.gone) { p.burn = 1; S.burnt++; snd(S, 'whoosh', p.x, p.y + p.len); } }
// an arched vine catches at fraction u: it burns through there (owner, v0.0.165), and each side hangs
// from its end, swinging down, burning up from the cut (cutArch)
/** @param {TitleScene} S @param {TProp} p @param {number} u */
function catchArch(S, p, u) { if (!p.burn && !p.gone) { S.burnt++; snd(S, 'whoosh', p.x + (p.span || 0) * u, p.y); cutArch(S, p, u, true, true); } }
// a web line catches at fraction u: the same, the two halves of silk hanging from its ends (cutWeb)
/** @param {TitleScene} S @param {WebLine} L @param {number} u */
function catchWeb(S, L, u) { if (!L.fu && !L.out) { S.burnt++; const w = titleWebAt(L, u); snd(S, 'whoosh', w.x - S.scroll, w.y); cutWeb(S, L, u, true); } }

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
  if (L.sp) return;   // (an orb web's spiral thread: just gone, no pieces hanging)
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
    if (titleSolid(S, x - S.scroll, y + 2)) return;   // (v1.0.61) its end on the floor: nothing to hang down from (it hung into the rock)
    const h = hold(x, y), p = hangPiece(S, 'silk', x, y, P, burn, !!h);
    if (p && h) { p.ac = h[0]; p.ar = h[1]; }
  };
  piece(L.a0x, L.a0y, pts);
  piece(L.b0x, L.b0y, qts);
  if (L.orb) orbSettle(S, L.orb);
}
// (owner, after v1.0.76: whole webs left on nothing) an orb web after a thread goes, or the rock it's strung on: what
// no longer holds (world/orbweb.js orbHeld) comes down, a spoke still on its rock hanging from there
/** @param {TitleScene} S @param {number} id */
function orbSettle(S, id) {
  const T = S.webs.filter(L => L.orb === id);
  if (!T.length) return;
  /** @param {Pt | null} p */
  const at = p => !!p && !!HOLDS[titleCell(S, Math.floor(p.x / TCELL), Math.floor(p.y / TCELL))];
  const fate = orbHeld(T.map(L => ({ ax: L.a0x, ay: L.a0y, bx: L.b0x, by: L.b0y, sp: L.sp, fr: L.fr })), i => (T[i].fr ? at(T[i].ain) && at(T[i].bin) : at(T[i].ain)));
  const gone = new Set();
  T.forEach((L, i) => {
    if (fate[i] === 'keep') return;
    L.out = true; gone.add(L);
    const hang = fate[i] === 'hang';
    if (hang && titleSolid(S, L.a0x - S.scroll, L.a0y + 2)) return;   // (on the floor: nothing to hang down from)
    const pts = [];
    for (let k = 0; k <= 8; k++) pts.push(titleWebAt(L, k / 8));
    const p = hangPiece(S, 'silk', L.a0x, L.a0y, pts, !!L.fu, hang);
    if (p && hang && L.ain) { p.ac = Math.floor(L.ain.x / TCELL); p.ar = Math.floor(L.ain.y / TCELL); }
  });
  if (gone.size) S.webs = S.webs.filter(L => !gone.has(L));
  // what still holds: the hub's new rest point
  const H = S.orbs && S.orbs[id];
  if (H && H.spokes.some(s => !s.out)) {
    const r = orbHubRest(H.x0, H.y0, H.spokes.map(s => ({ ax: s.a0x, ay: s.a0y })), H.spokes.map(s => !s.out));
    if (Math.abs(r.x - H.tx) + Math.abs(r.y - H.ty) > 0.01) { H.tx = r.x; H.ty = r.y; H.moving = true; }
  }
}
// (owner, after v1.0.78) an orb web's hub hangs on its spokes (world/orbweb.js orbHubRest, orbSpring): its rig keeps the
// hub, its spokes, and each spiral thread's ends as a spoke and a fraction along it, so they ride the hub when it moves
/** @typedef {{ x: number, y: number, vx: number, vy: number, tx: number, ty: number, x0: number, y0: number, spokes: WebLine[], moving: boolean }} OrbRig */
/** @param {TitleScene} S @param {number} id @param {WebLine[]} T */
function orbRig(S, id, T) {
  const spokes = T.filter(L => !L.sp && !L.fr);
  if (!spokes.length) return;
  const hx = spokes[0].b0x, hy = spokes[0].b0y;
  /** @param {number} x @param {number} y */
  const on = (x, y) => {
    for (const s of spokes) {
      const vx = s.b0x - s.a0x, vy = s.b0y - s.a0y, u = Math.max(0, Math.min(1, ((x - s.a0x) * vx + (y - s.a0y) * vy) / (vx * vx + vy * vy || 1)));
      if (Math.hypot(s.a0x + vx * u - x, s.a0y + vy * u - y) < 1) return { s, u };
    }
    return null;
  };
  for (const L of T) if (L.sp) { L.oa = on(L.a0x, L.a0y); L.ob = on(L.b0x, L.b0y); }
  (S.orbs || (S.orbs = {}))[id] = { x: hx, y: hy, vx: 0, vy: 0, tx: hx, ty: hy, x0: hx, y0: hy, spokes, moving: false };
}
// the hub's swing to its rest point after a spoke went; its spokes and spiral threads follow (on screen only)
/** @param {TitleScene} S @param {number} dt */
function orbSwing(S, dt) {
  if (!S.orbs) return;
  for (const k in S.orbs) {
    const H = S.orbs[k];
    if (H.x0 - S.scroll < behind(S, -40) - 200) { delete S.orbs[k]; continue; }
    if (!H.moving || H.x0 > S.scroll + TITLE_VW + 120) continue;
    H.moving = orbSpring(H, Math.min(dt, 0.05));
    for (const s of H.spokes) if (!s.out) { s.b0x = s.bx = H.x; s.b0y = s.by = H.y; }
  }
  for (const L of S.webs) if (L.sp && L.orb && S.orbs[L.orb] && S.orbs[L.orb].moving) {
    const a = L.oa, b = L.ob;
    if (a) { L.a0x = a.s.a0x + (a.s.b0x - a.s.a0x) * a.u; L.a0y = a.s.a0y + (a.s.b0y - a.s.a0y) * a.u; }
    if (b) { L.b0x = b.s.a0x + (b.s.b0x - b.s.a0x) * b.u; L.b0y = b.s.a0y + (b.s.b0y - b.s.a0y) * b.u; }
    L.ax = L.a0x; L.ay = L.a0y; L.bx = L.b0x; L.by = L.b0y;
  }
}
// can a title prop swing (a hanging vine, chain, root or strand; a cut piece)?
/** @param {TProp} p */
const canSwing = p => p.k === 'climb' && !p.arc && !!p.len;

// The players' push on the vines and webs they pass (game/systems/props.js): a hanging vine swings the way
// he went (DEV.vinePush), its tail trailing (tailStep); an arch or a web line gives where he goes through it
// (bendPush) and springs back (bendStep). Cut pieces swing down under their own weight the same way
/** @param {TitleScene} S @param {number} dt */
function stepSway(S, dt) {
  for (const r of S.runners) r.rub = '';
  for (const p of S.props) {
    if (p.gone || p.k !== 'climb') continue;
    const x = p.ox - S.scroll;
    if (x + (p.span || 0) < -30 || x > TITLE_VW + 30) continue;
    /** @type {any} */
    const pa = p;
    // (auto/hang.js) the hand-steered player holding on: an arch or a web line dips under him, a vine he swings on hangs
    // through his hands (the old game's props.js)
    const hr = S.runners.find(r => r.hang === p);
    if (p.arc) {
      const n = p.arc.length - 1;
      for (const r of S.runners) {
        if (r === hr) continue;
        const cx = r.x + PW / 2 + S.scroll, cy = r.y + PH / 2;
        if (cx < p.ox - 8 || cx > p.ox + (p.span || 0) + 8) continue;
        let best = -1, bd = 7;
        for (let k = 0; k <= n; k++) { const d = Math.hypot(p.ox + p.arc[k][0] - cx, p.y + p.arc[k][1] - cy); if (d < bd) { bd = d; best = k; } }
        if (best >= 0) { bendPush(pa, best / n, r.wvx, r.wvy, DEV.bendPush, dt); r.rub = p.st === 'root' ? 'root' : 'vine'; }
      }
      lineHold(pa, !!hr, hr ? archNear(archView(p), hr.x + PW / 2 + S.scroll, hr.y + WEB_HAND).u : 0, hr ? hr.cvx || 0 : 0, hr ? hr.vy : 0, dt);
      continue;
    }
    if (hr && hr.swing && canSwing(p)) {
      vineHeld(pa, hr.x + PW / 2 + S.scroll, hr.y, hr.cvx || 0);
      if (p.sw || p.swv || p.tl) tailStep(pa, p.links || DEV.vineLinks, GRAVITY, DEV.vineTailDamp, dt);
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
        r.rub = p.st === 'silk' ? 'myc' : p.st === 'root' ? 'root' : 'vine';
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
    const hr = S.runners.find(r => r.hang === L);
    for (const r of S.runners) {
      if (r === hr) continue;
      const cx = r.x + PW / 2 + S.scroll, cy = r.y + PH / 2;
      if (cx < Math.min(L.a0x, L.b0x) - 6 || cx > Math.max(L.a0x, L.b0x) + 6) continue;
      const vx = L.b0x - L.a0x, vy = L.b0y - L.a0y, u = Math.max(0, Math.min(1, ((cx - L.a0x) * vx + (cy - L.a0y) * vy) / (vx * vx + vy * vy || 1)));
      const w = titleWebAt(L, u);
      if (Math.hypot(w.x - cx, w.y - cy) < 6) { bendPush(L, u, r.wvx, r.wvy, DEV.bendPush, dt); r.rub = 'myc'; }
    }
    lineHold(L, !!hr, hr ? webNearU(L, hr.x + PW / 2 + S.scroll, hr.y + WEB_HAND).u : 0, hr ? hr.cvx || 0 : 0, hr ? hr.vy : 0, dt);
  }
  for (const r of S.runners) {
    const str = rustleStep(r.rst || (r.rst = {}), dt, r.rub, r.rub && !r.rubWas, Math.hypot(r.wvx, r.wvy) * 2, S.rnd);
    r.rubWas = !!r.rub;
    if (str) snd(S, 'rustle', r.x + PW / 2, r.y + PH / 2, { st: r.rub, v: str });
  }
}

/** @param {TitleScene} S @param {Enemy} f */
function killFoe(S, f) {
  f.hp = 0;
  S.kills++;
  const big = f.k.id !== 'rotta' && !f.bat && !f.worm, x = f.x - S.scroll, y = f.ty;
  snd(S, 'die', x, y, f.k);
  if (f.worm) { if (DEV.glowFuse > 0) f.fuse = DEV.glowFuse; else wormBlast(S, f); }
  else if (f.bat) {   // (a bat: a small puff, and it drops, a little dark lump falling till it lands)
    burst(S, x, y, 5, '#8a7a90', 40, 'smoke', 0.5);
    burst(S, x, y, 4, '#ffffff', 90, 'spark', 0.2);
    if (S.parts.length < TITLE_PARTS) S.parts.push({ x, y, vx: (S.rnd() - 0.5) * 10, vy: 10, life: 3, max: 3, r: 1.2 * DEV.batSize, col: '#2a2230', kind: 'lump' });
  } else {
  if (big) snd(S, 'boom', x, y, f.r * 3);
  S.booms.push({ x, y, r: f.r * (big ? 3 : 1.6), t: 0, max: 0.4 });
  burst(S, x, y, big ? 22 : 8, '#ffd27a', 110, 'fire', 0.55);
  burst(S, x, y, 8, '#ffffff', 190, 'spark', 0.3);
  burst(S, x, y, big ? 6 : 2, '#3a3346', 30, 'smoke', 1.3);
  burst(S, x, y, 5, f.k.col.a, 90, 'chunk', 0.9);
  }
  if (big) { S.shake = Math.min(7, S.shake + 3); S.flash = Math.min(0.35, S.flash + 0.15); }
  // its gold as the game drops it (systems/enemies.js damageEnemy): its kind's gold and up to 2 more,
  // split into big, medium and small nuggets (world/nuggets.js spillGold), thrown up out of it
  // CaveRunner Auto: the level's drops (auto/loot.js killLoot): the gold as nuggets, the rest as pickups (S.loot) thrown up
  if (f.worm) (S.lootLater ||= []).push({ f, t: 0.35 });   // (a glow worm: its loot after the burst, wormsStep)
  else dropLoot(S, f);
  if (S.coins.length > TITLE_GOLD) S.coins.splice(0, S.coins.length - TITLE_GOLD);
}

// a killed creature's loot: the level's drops, else its gold
/** @param {TitleScene} S @param {Enemy} f */
function dropLoot(S, f) {
  const items = S.lvl && S.lvl.loot ? S.lvl.loot(S, f) : null;
  if (items) titleSpill(S, f.x, f.ty, items);
  else { const amount = Math.round(f.k.gold + Math.floor(S.rnd() * 3)); spillWait(S, f.x, f.ty, amount); S.gold += amount; }
}
// gold thrown out as nuggets; (Grem Mode, owner v1.0.92) S.coinWait: they bounce that long before they fly to the team
/** @param {TitleScene} S @param {number} x @param {number} y @param {number} amount */
function spillWait(S, x, y, amount) {
  const n = S.coins.length;
  spillGold(S.coins, x, y, amount);
  if (S.coinWait) for (let i = n; i < S.coins.length; i++) S.coins[i].nopull = S.coinWait;
}

// CaveRunner Auto: BagItems thrown out at (world x, y): the gold as nuggets (S.coins), the rest as pickups (S.loot) thrown up;
// both vacuumed into the bag (stepLoot, the coins'). up: how hard they're thrown up (× the kill's; a chest's spill: auto/chests.js)
/** @param {TitleScene} S @param {number} x @param {number} y @param {BagItem[]} items @param {number} [up] */
export function titleSpill(S, x, y, items, up = 1) {
  const amount = items.filter(it => it.kind === 'gold').reduce((a, it) => a + it.n, 0);
  if (amount > 0) { spillWait(S, x, y, amount); S.gold += amount; }
  for (const it of items) {
    if (it.kind === 'gold') continue;
    const a = -Math.PI / 2 + (S.rnd() - 0.5) * 1.6, sp = (70 + S.rnd() * 60) * up;
    (S.loot || (S.loot = [])).push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, it, col: S.lvl && S.lvl.lootCol ? S.lvl.lootCol(it) : '#ffffff', t: S.rnd() * 6, nopull: LOOT_WAIT + S.rnd() * 0.3 });
  }
}

/** @param {TitleScene} S @param {Enemy} f @param {number} dmg @param {string} col @param {number} [by] the runner who did it (its damage dealt, r.dealt) */
function hitFoe(S, f, dmg, col, by) {
  if (f.hp <= 0 || f.waiting) return;   // (v2.0.16) the boss waiting in its arena: untouchable till the fight
  if (S.dmgMul) dmg *= S.dmgMul;   // (Grem Mode, owner v1.0.92: the guns keep up with the level, auto/grem.js gremDmgMul)
  const ru = by != null && by >= 0 ? S.runners[by] : null;
  if (ru) ru.dealt = (ru.dealt || 0) + Math.min(dmg, f.hp);
  f.hp -= dmg; f.flash = 0.08;
  if (f.hp > 0 && dmg >= 0.5) snd(S, 'hurt', f.x - S.scroll, f.ty, f.k);
  if (f.k.kp) f.aggro = true;          // as in the game: hurt a spider, a jelly or a rat and it comes for you
  burst(S, f.x - S.scroll, f.ty, 4, col, 80, 'spark', 0.25);
  if (f.hp <= 0) killFoe(S, f);
}

// a shot ends: blows up (a hole, fire), digs its pit, or sets things alight, as its mod does in the game
// (owner, after v1.0.78) a mushroom cloud rising off a blast at screen point (sx, y), size r (it lasts DEV.autoMushT s)
/** @param {TitleScene} S @param {number} sx @param {number} y @param {number} r */
export function titleMushroom(S, sx, y, r) {
  (S.mush || (S.mush = [])).push({ wx: sx + S.scroll, y, r, t: 0, max: DEV.autoMushT, seed: S.rnd() * 100 });
  if (S.mush.length > 4) S.mush.shift();
}
/** @param {TitleScene} S @param {TShot} s */
function shotEnd(S, s) {
  s.life = 0;
  if (s.explode) {
    const r = s.explode * 0.42;
    snd(S, 'boom', s.x, s.y, s.explode);
    const bl = boomLook(s.sid);   // a nuke's and meteor's blast looks far bigger (looks only: the radius stays r)
    S.booms.push({ x: s.x, y: s.y, r: r * 1.6 * bl.k, t: 0, max: bl.max, sid: s.sid });
    if (s.sid === 'nuke') titleMushroom(S, s.x, s.y, r * DEV.autoMushK);
    if (bl.k > 1) { for (const p of bigBoomFx(s.sid || '', s.x, s.y, r, Math.random)) if (S.parts.length < TITLE_PARTS) S.parts.push(p); S.flash = Math.max(S.flash, 0.5); }
    burst(S, s.x, s.y, 14, '#ffb02e', 90, 'fire', 0.5);
    burst(S, s.x, s.y, 4, '#3a3346', 25, 'smoke', 1.2);
    S.shake = Math.min(7, S.shake + 2);
    titleCarve(S, s.x, s.y, r);
    for (const g of S.foes) if (Math.hypot(g.x - S.scroll - s.x, g.ty - s.y) < r + g.r && foeOk(s, g)) hitFoe(S, g, s.real ? s.dmg : 4, s.col, s.by);
    // Discriminate:Pn: its blast hurts only that player (each player it names)
    if (s.only && S.lvl && S.lvl.hurt) for (const o of targetsOf(s.only)) {
      const ru = o.kind === 'player' ? S.runners[Number(o.id) - 1] : null;
      if (ru && !ru.out && Math.hypot(ru.x + PW / 2 - s.x, ru.y + PH / 2 - s.y) < r + 8) S.lvl.hurt(S, ru.id, s.real ? s.dmg : 4);
    }
    for (const p of S.props) if (p.k === 'lamp' && !p.gone && lampHit(p, s.x, s.y, r)) popLamp(S, p);
    for (const p of S.props) if (p.k === 'barrel' && !p.gone && cartHit(p, s.x, s.y, r)) p.fuse = Math.min(p.fuse ?? 1, CART_FUSE);
  } else if (s.pit) { titleCarve(S, s.x, s.y, s.pit * 0.7); snd(S, 'debris', s.x, s.y); }
  else if (!s.hitFoe) snd(S, 'rock', s.x, s.y);
  // fire reaches past a blast's charred rim, into the moss, timber and plants round it
  if (s.fire || s.explode) titleIgnite(S, s.x, s.y, (s.fire ? 7 : 0) + (s.explode ? s.explode * 0.42 + 5 : 0));
  burst(S, s.x, s.y, 3, s.col, 50, 'spark', 0.25);
  if (s.manaB) manaBurst(S, s);
  // a fireball throws a spread of burning drops where it lands (auto/shotfx.js fireSpray)
  if (S.shots.length < 400) for (const d of fireSpray(s, S.rnd)) S.shots.push(d);
  release(S, s);
}
// a trigger's payload out where its carrier is (a real gun's, art/scenegun.js), the way it was going; once
/** @param {TitleScene} S @param {TShot} s */
function release(S, s) {
  if (!s.pay) return;
  const pay = s.pay, a = Math.atan2(s.vy, s.vx) || 0;
  s.pay = null;
  if (S.shots.length < 400) for (const sh of pay) for (const n of shotsOf(sh, a, s.x, s.y, S.rnd, s.by)) S.shots.push(n);
}

/** @param {TitleScene} S @param {number} dt seconds */
export function titleStep(S, dt) {
  dt = Math.min(dt, 0.05);
  const R = S.rnd;
  S.t += dt; if (!S.hub) S.scroll += sv(S) * dt;
  genTo(S);
  S.shake = Math.max(0, S.shake - dt * 18);
  S.flash = Math.max(0, S.flash - dt * 1.6);
  S.spawn -= dt;
  // (CaveRunner Auto's level: S.lvl.spawn sets the gap and how many at once, a trickle that builds: auto/level.js levelSpawn)
  const sp = S.lvl && S.lvl.spawn ? S.lvl.spawn(S) : { gap: 0.4, cap: TITLE_FOES - 10 };
  if (S.spawn <= 0 && !S.hub && S.foes.filter(f => !f.bat && !f.worm).length < sp.cap) { addFoe(S, undefined, sp.cap); S.spawn = sp.gap * (1 + R() * 1.5); }
  if (!S.still) { for (const r of S.runners) if (!r.out) stepRunner(S, r, dt); separate(S, dt); }
  stepFoes(S, dt);
  batsStep(S, dt);
  wormsStep(S, dt);
  stepEliteFx(S, dt);
  stepShots(S, dt);
  stepFire(S, dt);
  // (Coal Seams) a lump of coal off a chute's lower lip now and then (DEV.coalSpill a second each), falling till it lands
  if (S.chutes && S.chutes.length) {
    S.chutes = S.chutes.filter(q => q.x > S.scroll - TITLE_BACK - 50);
    for (const q of S.chutes) if (q.x > S.scroll - 10 && q.x < S.scroll + TITLE_VW + 10 && S.parts.length < TITLE_PARTS && S.rnd() < dt * DEV.coalSpill) {
      const l = 3;
      S.parts.push({ x: q.x - S.scroll, y: q.y, vx: q.s * (6 + S.rnd() * 10), vy: 4, life: l, max: l, r: 0.8 + S.rnd() * 0.7, col: S.rnd() < 0.5 ? '#16161c' : '#2c2e38', kind: 'lump' });
    }
  }
  // the natural caves' ambience, as the level has it: water dripping from the roof, luminescent spores drifting
  if (S.parts.length < TITLE_PARTS - 40 && !S.hub) {
    if (R() < dt * 3) {
      const x = R() * TITLE_VW, wx = x + S.scroll;
      if (built(wx, S) === 0 && !coalAt(S, wx)) S.parts.push({ x, y: titleCeil(wx, S) + 1.5, vx: 0, vy: 0, life: 4, max: 4, r: 1, col: '#7ab8ff', kind: 'drip' });
    }
    if (R() < dt * 5) {
      const x = R() * TITLE_VW, wx = x + S.scroll, l = 5 + R() * 3;
      if (built(wx, S) === 0 && !coalAt(S, wx)) S.parts.push({ x, y: titleCeil(wx, S) + 10 + R() * (titleFloor(wx, S) - titleCeil(wx, S) - 20), vx: (R() - 0.5) * 8, vy: -2 - R() * 3,
        life: l, max: l, r: 1.3, col: 'rgb(' + THEMES[0].moss[1].join(',') + ')', kind: 'spore' });
    }
    // (Coal Seams) soot falls: black dust trickling in a thin stream from spots on the roof (one spot in SOOT_GAP has one, by x)
    // (only with Coal Seams in view: elsewhere the scene's random numbers run as they did)
    if ((coalAt(S, S.scroll) || coalAt(S, S.scroll + TITLE_VW)) && R() < dt * DEV.coalSoot) {
      const k0 = Math.floor(S.scroll / SOOT_GAP), k = k0 + Math.floor(R() * (TITLE_VW / SOOT_GAP + 1)), wx = (k + 0.2 + h2(k, 62) * 0.6) * SOOT_GAP;
      if (h2(k, 61) < 0.45 && coalAt(S, wx)) {
        const l = 6;
        S.parts.push({ x: wx - S.scroll + (R() - 0.5) * 1.4, y: titleRoof(wx, S) + 1, vx: 0, vy: 4 + R() * 8, life: l, max: l, r: 0.6 + R() * 0.5, col: R() < 0.5 ? '#3c3c44' : '#5a5a64', kind: 'soot' });
      }
    }
  }
  // particles
  for (const p of S.parts) {
    p.life -= dt;
    if (p.kind === 'drip') {
      // falls with the rock (the scroll carries it), until it lands: a splash
      p.vy += GRAV * dt; p.y += p.vy * dt; p.x -= sv(S) * dt;
      if (titleSolid(S, p.x, p.y + 1)) { p.life = 0; burst(S, p.x, p.y, 2, '#7ab8ff', 25, 'spark', 0.2); snd(S, 'drip', p.x, p.y); }
      continue;
    }
    if (p.kind === 'ember') {
      p.vy += GRAVITY * 0.45 * dt; p.x += (p.vx - sv(S)) * dt; p.y += p.vy * dt;
      const c = Math.floor((p.x + S.scroll) / TCELL), r = Math.floor(p.y / TCELL), m = titleCell(S, c, r);
      if (FUEL[m]) lightArea(S, p.x + S.scroll, p.y, 2, 0.6);
      if (SOLID[m]) { lightArea(S, p.x + S.scroll - p.vx * dt, p.y - p.vy * dt, 4, 0.85); p.life = 0; }
      continue;
    }
    if (p.kind === 'flame') {          // world/props.js's dparts: GRAVITY × g (-0.03), gone on rock
      p.vy += GRAVITY * -0.03 * dt; p.x += (p.vx - sv(S)) * dt; p.y += p.vy * dt;
      if (titleSolid(S, p.x, p.y)) p.life = 0;
      continue;
    }
    if (p.kind === 'fsmoke' || p.kind === 'jsmoke') {         // game/systems/particles.js smoke (the jetpack's too)
      p.x += (p.vx - sv(S)) * dt; p.y += p.vy * dt; p.vx *= 1 - 2.5 * dt; p.vy = p.vy * (1 - 2.5 * dt) - 12 * dt; p.r += (p.g || 5) * dt;
      continue;
    }
    if (p.to) {                       // White Hole motes (v1.0.40): pulled onto it, faster the closer, swirling a little; gone at its core
      const dx = p.to.x - p.x, dy = p.to.y - p.y, d = Math.hypot(dx, dy) || 1, a = 260 + 2600 / (d + 4);
      p.vx += (dx / d * a - dy / d * 60) * dt; p.vy += (dy / d * a + dx / d * 60) * dt;
      const sp = Math.hypot(p.vx, p.vy), top = 40 + 1400 / (d + 6);
      if (sp > top) { p.vx *= top / sp; p.vy *= top / sp; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (d < 2.5 || p.to.life <= 0) p.life = 0;
      continue;
    }
    if (p.kind === 'lump') {            // (Coal Seams) a coal lump off a chute: falls, gone where it lands
      p.vy += GRAV * dt; p.y += p.vy * dt; p.x += (p.vx - sv(S)) * dt;
      if (titleSolid(S, p.x, p.y + 0.5)) { p.life = 0; burst(S, p.x, p.y, 2, '#2c2e38', 20, 'chunk', 0.3); }
      continue;
    }
    if (p.kind === 'soot') {            // (Coal Seams) falls slowly with the rock, gone where it lands
      p.vy = Math.min(38, p.vy + 30 * dt); p.y += p.vy * dt; p.x -= sv(S) * dt;
      if (titleSolid(S, p.x, p.y + 0.5)) p.life = 0;
      continue;
    }
    if (p.kind === 'wspore') {   // (C5a) a worm's spore: the puff's kick settling (DEV.glowSporeDrag), then a spore's drift
      const kk = Math.exp(-DEV.glowSporeDrag * dt); p.kx = (p.kx || 0) * kk; p.ky = (p.ky || 0) * kk;
      p.x += (p.vx + (p.kx || 0) + Math.sin(S.t * 1.7 + p.max * 9) * 3 - sv(S)) * dt; p.y += (p.vy + (p.ky || 0)) * dt; continue;
    }
    if (p.kind === 'spore') { p.x += (p.vx + Math.sin(S.t * 1.7 + p.max * 9) * 3 - sv(S)) * dt; p.y += p.vy * dt; continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    const drag = p.kind === 'smoke' ? 1.5 : 3;
    p.vx -= p.vx * drag * dt; p.vy -= p.vy * drag * dt;
    if (p.kind === 'chunk') p.vy += GRAV * 0.6 * dt;
    if (p.kind === 'fire') p.vy -= 30 * dt;
    if (p.kind === 'fall') p.vy += GRAV * 0.5 * dt + p.vy * drag * dt;   // a shot's falling specks: the drag undone downward, and falling
    p.x -= (p.kind === 'smoke' || p.kind === 'chunk' ? sv(S) * 0.5 : 0) * dt;
  }
  S.parts = S.parts.filter(p => p.life > 0);
  stepGold(S, dt);
  stepLoot(S, dt);
  for (const b of S.booms) b.t += dt;
  if (S.mush) { for (const m of S.mush) m.t += dt; S.mush = S.mush.filter(m => m.t < m.max); }
  S.booms = S.booms.filter(b => b.t < b.max);
  stepGas(S, dt);
  for (const z of S.zaps) z.t -= dt;
  S.zaps = S.zaps.filter(z => z.t > 0);
  stepSway(S, dt);
  orbSwing(S, dt);
  // plants whose rock is gone fall away (and an arch's strands with it)
  for (const p of S.props) {
    p.x = p.ox - S.scroll;
    if (p.gone) continue;
    if (p.drop) {                       // falling: down until it hits rock (a burning one lights it) or leaves
      p.vy = (p.vy || 0) + GRAVITY * 0.5 * dt; p.y += p.vy * dt;
      if (p.rp) { ropeStep(S, p, dt); if (p.y > S.vh + 20) p.gone = true; continue; }   // (a burnt-off piece: a loose rope, v1.0.63)
      if (p.rv != null) p.rot = (p.rot || 0) + p.rv * dt;
      const lo = p.rv != null ? titleTumbleLow(p) : { x: p.x, y: p.y + 1 };
      if (p.y > S.vh) p.gone = true;
      else if (titleSolid(S, lo.x, lo.y)) {
        p.gone = true; burst(S, p.x, p.y, 3, p.st === 'silk' ? '#eef0f6' : '#5a8a3a', 40, 'chunk', 0.6);
        snd(S, 'rustle', p.x, p.y, { st: p.st === 'silk' ? 'myc' : 'vine', v: 0.4 });
        if (p.burn) lightArea(S, p.ox, p.y, 6, 0.8);
      }
      continue;
    }
    if (p.burn && p.k !== 'climb') continue;
    if (p.k === 'barrel') {             // (Coal Seams) an explosive minecart: a lit fuse goes off; fire beside it lights one; it falls when its floor goes
      if (p.fuse != null && (p.fuse -= dt) <= 0) { cartBoom(S, p); continue; }
      const near = p.x > -20 && p.x < TITLE_VW + 20;
      if (p.fuse == null && near && S.fire.length && fireNear(S, p.ox, p.y - 4, 8)) p.fuse = 0.4 + S.rnd() * 0.5;
      if (p.fall || (near && !SOLID[titleCell(S, p.ac, p.ar)])) {
        p.fall = true; p.vy = (p.vy || 0) + GRAVITY * 0.5 * dt; p.y += p.vy * dt;
        if (titleSolid(S, p.x, p.y + 0.5)) { p.fall = false; p.vy = 0; p.ar = Math.floor((p.y + 0.5) / TCELL); p.ac = Math.floor(p.ox / TCELL); p.y = p.ar * TCELL; }
        if (p.y > S.vh + 20) p.gone = true;
      }
      continue;
    }
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
  S.props = S.props.filter(p => !p.gone && p.ox + (p.span || 0) - S.scroll > behind(S, -60));
  S.webs = S.webs.filter(L => Math.max(L.a0x, L.b0x) - S.scroll > behind(S, -40));
  // (after v1.0.76) orb webs on screen whose rock was dug or blasted away: what no longer holds comes down
  if (S.t - (S.orbT || 0) > 0.2) { S.orbT = S.t; for (const id of new Set(S.webs.filter(L => L.orb && L.a0x - S.scroll > -60 && L.a0x - S.scroll < TITLE_VW + 20).map(L => L.orb))) orbSettle(S, id || 0); }
  if (S.hub && S.hub.step) S.hub.step(S, dt);
  if (S.lvl && S.lvl.step) S.lvl.step(S, dt);
}

/** @param {TitleScene} S @param {TRunner} r @param {number} dt */
function stepRunner(S, r, dt) {
  const x0 = r.x, y0 = r.y;
  stepRunnerMove(S, r, dt);
  jetStep(S, r, dt);
  // how fast he's going through the world (it scrolls under him): what pushes the vines and webs he passes
  const k = Math.min(1, 12 * dt);
  r.wvx += (Math.max(-250, Math.min(250, (r.x - x0) / Math.max(dt, 1e-3) + sv(S))) - r.wvx) * k;
  r.wvy += (Math.max(-250, Math.min(250, (r.y - y0) / Math.max(dt, 1e-3))) - r.wvy) * k;
  stepRunnerGun(S, r, dt);
  stepRunnerPerks(S, r, dt);
}
// CaveRunner Auto's perks in a level (auto/perks.js): the shield's recharge, the Angry Ghost trailing him and firing
/** @param {TitleScene} S @param {TRunner} r @param {number} dt */
function stepRunnerPerks(S, r, dt) {
  const pl = S.team && S.team[r.id];
  if (!pl) return;
  shieldTick(r, dt);
  if (r.out || pl.alive === false || !perkOn(pl, 'ghost')) { r.ghost = null; return; }
  const h = ghostHome(r, PW);
  if (!r.ghost) r.ghost = { x: h.x, y: h.y, cd: DEV.autoGhostCd, fired: -9 };
  const g = r.ghost, lp = Math.min(1, dt * 4);
  g.x += (h.x - g.x) * lp; g.y += (h.y - g.y) * lp;
  if ((g.cd -= dt) > 0) return;
  const f = ghostTarget(g, S.foes, S.scroll, DEV.autoGhostRange);
  if (!f) { g.cd = 0; return; }
  g.cd = DEV.autoGhostCd; g.fired = S.t;
  const a = Math.atan2(f.ty - g.y, f.x - S.scroll - g.x), v = 300;
  S.shots.push({ x: g.x, y: g.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: 2, col: '#c9a6ff', look: '', life: 1.2, foe: false, spin: 0,
    grav: 0, drag: 0, explode: 0, pit: 0, fire: 0, bounce: 0, bounceE: 0.92, pierce: 0, dmg: DEV.autoGhostDmg, homing: 2, accel: 0, vmax: 0, chain: 0,
    real: true, by: r.id, trig: null, timer: 0, pay: null, age: 0 });
  burst(S, g.x, g.y, 3, '#c9a6ff', 30, 'spark', 0.15);
}
// The jetpack as the old game's (game/systems/player.js, particles.js, render/actors.js drawJetFlame): the thrust's way
// (r.jx, r.jy: a hand-steered player's stick; the autopilot's mostly up, tilted by how fast he's going across), the
// flame pointing away from it out of the backpack's nozzle (titleNozzle), and smoke puffing out after it (parts 'jsmoke')
export const TITLE_NOZZLE_X = 4.4, TITLE_NOZZLE_Y = 17.6;    // as game/systems/player.js NOZZLE_X / NOZZLE_Y
/** @param {TRunner} r */
export const titleNozzle = r => ({ x: r.x + PW / 2 - TITLE_NOZZLE_X * (r.face || 1), y: r.y + TITLE_NOZZLE_Y });
// the flame's way (unit): away from the thrust, sagging down (drawJetFlame's -jx, -jy + 0.8)
/** @param {TRunner} r */
export function titleFlameDir(r) {
  let fx = -(r.jx || 0), fy = -(r.jy == null ? -1 : r.jy) + 0.8;
  const d = Math.hypot(fx, fy) || 1; fx /= d; fy /= d;
  return { fx, fy };
}
// (feedback round 2: the flame away from the way he travels) a stick (a steered player's r.ctl, the hub's player 1 r.jetIn) sets
// the thrust; else it leans the way he's going through the world (the hub: his speed; a level: r.wvx, the scroll counted)
/** @param {TitleScene} S @param {TRunner} r @param {number} dt */
export function jetStep(S, r, dt) {
  let jx, jy;
  const st = ctlOn(r) ? r.ctl : r.jetIn;
  if (st) { jx = st.nx; jy = st.ny; }
  else { const wv = S.hub ? r.vx : r.wvx, tl = Math.max(-DEV.autoJetTilt, Math.min(DEV.autoJetTilt, wv / 70)), d = Math.hypot(tl, 1); jx = tl / d; jy = -1 / d; }
  const k = Math.min(1, 10 * dt);
  r.jx = (r.jx == null ? jx : r.jx) + (jx - (r.jx == null ? jx : r.jx)) * k;
  r.jy = (r.jy == null ? jy : r.jy) + (jy - (r.jy == null ? jy : r.jy)) * k;
  if (!(r.flame > 0) || r.mode !== 'fly' || r.dig) { r.smokeAcc = 0; return; }
  // (its own hashed random, not S.rnd: the smoke must not shift the scene's seeded stream: the title's runs stay as they were)
  const { fx, fy } = titleFlameDir(r), R = () => { const v = Math.sin((r.smokeN = (r.smokeN || 0) + 1) * 12.9898 + r.id * 78.233) * 43758.5453; return v - Math.floor(v); };
  r.smokeAcc = (r.smokeAcc || 0) + dt * (25 + 35 * r.flame) * DEV.autoJetSmoke;
  while (r.smokeAcc >= 1) {
    r.smokeAcc--;
    if (S.parts.length >= TITLE_PARTS - 60) continue;
    const nz = titleNozzle(r);
    S.parts.push({ x: nz.x + fx * 6 + (R() - 0.5) * 3, y: nz.y + fy * 6 + 1, vx: fx * 50 + (R() - 0.5) * 20, vy: fy * 50 + (R() - 0.5) * 20,
      life: 0.9, max: 0.9, r: 1.5 + R(), col: COL.smoke, kind: 'jsmoke' });
  }
}
// is any of the body's box (screen x, y: its top left) in rock? (a grid of points just inside it)
// (feet: false leaves out the bottom row, so a step under his feet isn't rock in his way)
/** @param {TitleScene} S @param {number} x @param {number} y @param {boolean} [feet] */
const boxRock = (S, x, y, feet = true) => {
  for (let i = 0; i <= 2; i++) for (let j = 0; j <= (feet ? 4 : 3); j++) if (titleSolid(S, x + 1 + (PW - 2) * i / 2, y + 1 + (PH - 2) * j / 4)) return true;
  return false;
};
// (Grem Mode, owner v1.0.102: "it should work just like the auto movement, but with a temporary position goal") a tapped spot
// (r.goal, world x, y: auto/level.js levelWaypoint): he flies there on the autopilot (flyStep's thrust and steering, rock in his
// way risen over, dipped under or sawn through as ever: pickTarget aims only at it). DEV.gremWayDone from it he's there (v1.0.107: was 8, he fussed over the last few): the goal's gone
// and he plays by himself again at once (v1.0.103: it held the spot for the idle wait first); not there in DEV.gremWayT s, the same
/** @param {TitleScene} S @param {TRunner} r */
function goalAim(S, r) {
  const g = r.goal;
  if (!g) return;
  r.tx = Math.max(8, Math.min(TITLE_VW - PW - 8, g.x - S.scroll - PW / 2)); r.ty = g.y - PH / 2; r.retarget = 0.25;
}
/** @param {TitleScene} S @param {TRunner} r @param {number} dt */
function goalStep(S, r, dt) {
  const g = r.goal;
  if (!g) return;
  // (owner v1.0.103: no wait) there, or not there in DEV.gremWayT s: the goal's gone and he plays on at once
  if (Math.hypot(g.x - (S.scroll + r.x + PW / 2), g.y - (r.y + PH / 2)) < DEV.gremWayDone || S.t - g.t > DEV.gremWayT) { r.goal = null; r.retarget = 0; return; }
  // in the air for it (a run along the floor can't reach a height): off the floor as a flight starts, unless the tank's low
  if (r.mode === 'run' && !r.dig && !(fuelOn(S) && fuelOf(r) < FUEL_TAKEOFF)) { setMode(S, r, 'fly', 1); r.vy = -40; r.ground = false; r.burst = false; r.jet = false; }
  if (r.mode === 'fly' && !(fuelOn(S) && r.empty)) r.modeT = Math.max(r.modeT, 0.5);   // no landing on the way (dry: he lands to refill)
  goalAim(S, r);
}
// how long a player runs, and flies, before switching (each its own roll: owner, v0.0.166)
/** @param {() => number} R */
const runTime = R => 1.2 + R() * 5.5;
/** @param {() => number} R */
const flyTime = R => 1.5 + R() * 5;
// where a flying player heads next: mostly somewhere in the open, now and then into the ground under the
// floor or up into the roof (it saws its way there: tunnels)
/** @param {TitleScene} S @param {TRunner} r */
function pickTarget(S, r) {
  if (r.goal) { goalAim(S, r); return; }   // (v1.0.102) a tapped spot: there, nowhere else
  const R = S.rnd;
  r.tx = 18 + R() * (TITLE_VW * 0.5);
  const twx = r.tx + PW / 2 + S.scroll + 20, c = titleCeil(twx, S), f = titleFloor(twx, S), roll = R();
  if (roll < 0.09) r.ty = f - PH + 8 + R() * 22;
  else if (roll < 0.15) r.ty = c - 10 - R() * 22;
  else r.ty = c + 4 + R() * Math.max(0, f - c - PH - 8);
  r.ty = Math.max(S.top - 32, Math.min(S.bot + 6, r.ty));
  // (CaveRunner Auto's tall level, owner: "keep them together") a tall level's flyer heads no further than TITLE_PACKY from
  // the others' middle height and a height wandering over the band as they go (so the pack goes up as well as down), in the
  // open there if there's any; after the boss (S.huddle, auto/level.js) only the others' middle: they keep together for the camera
  if (bandK(S) > 1.2) {
    const os = S.runners.filter(o => o !== r && !o.hide && !o.out);
    if (os.length) {
      const oy = os.reduce((a, o) => a + o.y, 0) / os.length, m = S.huddle ? oy : S.lvl ? roamGoal(S) * 0.7 + oy * 0.3 : (oy + S.top + (S.bot - S.top - PH) * titleNoise(S.scroll / 260 + S.seed % 97, 1.7)) / 2, lo = Math.max(c + 4, m - TITLE_PACKY), hi = Math.min(f - PH - 4, m + TITLE_PACKY);
      r.ty = lo <= hi ? Math.max(lo, Math.min(hi, r.ty)) : Math.max(m - TITLE_PACKY, Math.min(m + TITLE_PACKY, r.ty));
    }
  }
  r.retarget = 0.8 + R() * 1.6;
}
// (owner v1.0.74: "they tend to just walk the bottom of frame") a tall level's team height goal: every DEV.autoRoamT s a new
// one, in the top third (chance DEV.autoRoamHi), the middle (DEV.autoRoamMid) or the bottom (the rest); the flyers head
// there (pickTarget), kept together
/** @param {TitleScene} S @param {number} k a knob: it in a tall level, else 1 */
const tallK = (S, k) => (S.lvl && bandK(S) > 1.2 ? k : 1);
/** @param {TitleScene} S */
function roamGoal(S) {
  if (S.hgoal == null || S.t >= (S.hgoalT || 0)) {
    const R = S.rnd, roll = R(), band = S.bot - S.top - PH, third = roll < DEV.autoRoamHi ? 0 : roll < DEV.autoRoamHi + DEV.autoRoamMid ? 1 : 2;
    S.hgoal = S.top + band * (third + 0.2 + R() * 0.6) / 3;
    S.hgoalT = S.t + DEV.autoRoamT * (0.7 + R() * 0.6);
  }
  return S.hgoal;
}
// rock in his way: out comes the Buzzsaw (TITLE_SAW), and he cuts through until he's in the open again
/** @param {TitleScene} S @param {TRunner} r @param {number} dx @param {number} dy @param {string} why (counted in S.digWhy) */
function startDig(S, r, dx, dy, why) {
  if (navAround(S, r, dx, dy, why)) return;
  // CaveRunner Auto's level (stage 5b, the clearing rule): his own best clearing gun, else a teammate's; no gun in play
  // can clear rock: he doesn't dig (the scroll's push: blocked, the pilot stops the team; his own aim: somewhere else)
  // (feedback round 1: early in a level, S.lvl.free, nothing blocks: he digs through as on the title)
  if (!r.dig && S.team && S.lvl && !(S.lvl.free && S.lvl.free(S, r))) {
    const kind = S.lvl.blockKind ? S.lvl.blockKind(S, r.x + PW / 2 + S.scroll + 8 * Math.sign(dx || 1)) : 'rock';
    const c = teamClearer(S.team, kind, r.id);
    if (!c) {
      if (ctlOn(r)) return;   // (bug round 1) one steered by hand: just stopped by it (no jetting over, no target of his own)
      if (why === 'aim' || why === 'fly') { r.vx = 0; r.vy = Math.min(r.vy, 0); pickTarget(S, r); return; }
      if (jetOver(S, r)) return;   // stage 6b: a partial blockage he can't clear, he jets over it
      S.blocked = S.t; S.blockedKind = kind; S.digWhy.blocked = (S.digWhy.blocked || 0) + 1;
      r.x = Math.max(8, r.x - 1);
      return;
    }
    r.clr = c; r.clrT = 0;
  }
  // (v1.0.68) the saw starts from his own speed on screen, not a stale r.vx (at the faster pace a hand-steered one slid ~20 units)
  if (!r.dig) { r.vx = (r.cvx || 0) - sv(S); r.keep = r.kit; r.kit = kitOf('saw', [], TITLE_SAW); r.swap = 0.2; S.digs++; r.digY = r.y; S.digWhy[why] = (S.digWhy[why] || 0) + 1; }
  const d = Math.hypot(dx, dy) || 1;
  r.dig = Math.max(r.dig, 1e-3); r.clearT = 0; r.dx = dx / d; r.dy = dy / d;
}
// Round it before sawing it (CaveRunner Auto's level, owner v1.0.55: the saws dug out the ground under the exit pad): the
// rock's average normal where he meets it (rockNormal) against the way on (+x); facing back at him less than DEV.autoNavCut
// (dot product), a floor or slope he rises over, a roof he dips under; steeper, or tried for autoNavGive s: he saws (as ever).
// Not by hand, not the title
/** @param {TitleScene} S @param {TRunner} r @param {number} dx @param {number} dy @param {string} why */
function navAround(S, r, dx, dy, why) {
  if (!S.lvl || r.dig || ctlOn(r) || why === 'down' || (r.navT || 0) > DEV.autoNavGive) return false;
  const n = rockNormal(S, r, dx, dy);
  if (!n || -n.x > DEV.autoNavCut || Math.abs(n.y) < 0.2) return false;
  r.navT = (r.navT || 0) + 2 * (1 / 30);
  // over: open air above it he can reach (jetOver: the fuel wait too); under: a gap below as tall as he is; neither: he saws
  if (n.y < 0) {
    // (dry in the air: the tank fills only on the ground) out of the rock and down he drops to land, not hung waiting up there
    if (fuelOn(S) && !r.ground && (r.empty || !fuelCan(r)) && boxRock(S, r.x, r.y)) {   // (stuck in it: only touching it, he waits as ever)
      let k = 1;
      while (k <= 4 && boxRock(S, r.x, r.y - k)) k++;
      if (k <= 4) { r.y -= k; r.vy = Math.max(r.vy, 0); r.modeT = Math.min(r.modeT, 0); return true; }
    }
    return jetOver(S, r, false);
  }
  const sx = r.x + PW / 2 + 10;
  let run = 0;
  for (let y = r.y; y < S.bot + 6; y += TCELL) {
    if (titleSolid(S, sx, y) || titleSolid(S, sx + 8, y)) { run = 0; continue; }
    if ((run += TCELL) >= PH + 4) {
      if (!boxRock(S, r.x, r.y + 2)) r.y += 2;
      setMode(S, r, 'fly', 1); r.ground = false; r.burst = false;
      r.tx = r.x + 12; r.ty = y - PH; r.retarget = 0.8; r.vy = Math.max(r.vy, 40);
      return true;
    }
  }
  return false;
}
// the average normal (unit, pointing out of the rock) of the rock round where he meets it: 9 out from his middle the way he
// was going (dx, dy), the free-to-solid ring of radius 10 summed; null: no rock there
/** @param {TitleScene} S @param {TRunner} r @param {number} dx @param {number} dy */
export function rockNormal(S, r, dx, dy) {
  const d = Math.hypot(dx, dy) || 1, cx = r.x + PW / 2 + 9 * dx / d, cy = r.y + PH / 2 + 9 * dy / d;
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12, ux = Math.cos(a), uy = Math.sin(a);
    if (titleSolid(S, cx + ux * 10, cy + uy * 10)) { sx -= ux; sy -= uy; n++; }
  }
  const m = Math.hypot(sx, sy);
  return n && m > 1e-6 ? { x: sx / m, y: sy / m } : null;
}
// a wall ahead he can't clear (CaveRunner Auto's level): open air above it, tall enough for him, within reach? Up he
// jets to it (flying, aimed just over it). false: there's none (blocked all the way). wait false (navAround, going round
// rock he could saw: v1.0.56, it held the whole team for a low tank mid-air): not enough fuel, false, he saws instead
/** @param {TitleScene} S @param {TRunner} r @param {boolean} [wait] */
function jetOver(S, r, wait = true) {
  const sx = r.x + PW / 2 + 10;
  let run = 0;
  // (from a little below his feet: already flying through the gap over it, the air under him counts too)
  for (let y = r.y + PH + 10; y > S.top - 30; y -= TCELL) {
    if (titleSolid(S, sx, y) || titleSolid(S, sx + 8, y)) { run = 0; continue; }
    run += TCELL;
    if (run >= PH + 4) {
      // (owner, exo Jetpack) not enough in the tank for the climb: he waits at the wall (the level holds its scroll) and refills
      if (fuelOn(S) && (r.empty || fuelOf(r) < fuelForClimb(r.y - y, tankOf(S, r).fuel))) {
        if (!wait) return false;
        S.fuelWait = S.t; r.x = Math.max(8, r.x - 1);
        // (after v1.0.74: in the air the tank never fills) he comes down to land and wait there, sliding down off the rock
        if (!r.ground && r.mode === 'fly') { r.modeT = Math.min(r.modeT, 0); r.vy = Math.max(r.vy, 40); r.x = Math.max(8, r.x - 1); if (!boxRock(S, r.x, r.y + 2)) r.y += 2; }
        return true;
      }
      setMode(S, r, 'fly', 1.5); r.tx = r.x + 12; r.ty = y - 2; r.retarget = 1.2; r.vy = Math.min(r.vy, -60); r.ground = false;
      r.burst = false; r.x = Math.max(8, r.x - 1);
      return true;
    }
  }
  return false;
}
/** @param {TitleScene} S @param {TRunner} r @param {string} mode @param {number} t */
function setMode(S, r, mode, t) {
  if (r.mode !== mode) r.switches.push(S.t);
  r.mode = mode; r.modeT = t;
}

// A player's move (owner, v0.0.166): running and flying each last its own random while; nothing moves him
// but his own steering, gravity on the ground and the floor under his feet: rock in the way (a wall ahead,
// a low roof, the ground he's aiming into, or the rock the scroll brings to him) and he saws through it
/** @param {TitleScene} S @param {TRunner} r @param {number} dt */
function stepRunnerMove(S, r, dt) {
  // (the picked one keeps the whole screen, steered or not: never snapped back inside 0.62; on the autopilot he walks back)
  r.modeT -= dt; r.retarget -= dt;
  r.navT = Math.max(0, (r.navT || 0) - dt / 2);   // (navAround's tries: they wear off once he's moving freely)
  // (bug round 2) semi-automatic: the picked player (r.ctl) plays by himself till the stick is pushed; let go, he's back on
  // the autopilot from where he is (a fresh target; in the air, flying)
  const on = ctlOn(r);
  if (r.ctlWas && !on) { r.cvx = 0; r.retarget = 0; if (!r.ground) { r.mode = 'fly'; r.modeT = 0; } }
  r.ctlWas = on;
  if (!on || r.dig) r.hang = null;
  if (r.goal && !on) goalStep(S, r, dt);
  if (r.dig) digStep(S, r, dt);
  else if (on && r.ctl) ctlStep(S, r, r.ctl, dt);
  else if (r.mode === 'run') runStep(S, r, dt);
  else flyStep(S, r, dt);
  r.x = Math.max(8, Math.min(r.ctl || r.goal ? TITLE_VW - PW - 8 : TITLE_VW * 0.62, r.x));   // (one steered by hand, or heading for a tapped spot: the whole screen)
  // (Auto's tall level) never below the play area's bottom edge: a player sawing down there went out of the level
  r.y = Math.max(S.top - 40, Math.min(S.bot + 10, S.lvl && S.bot - S.top > MINE_TALL ? S.vh - PH - 1 : Infinity, r.y));
  if (fuelOn(S)) {
    const P = tankOf(S, r);
    fuelTick(r, r.dig || r.mode !== 'fly' ? 0 : r.flame, r.ground || !!r.hang || (!!r.dig && r.mode === 'run'), dt, P.fuel, P.refuel);
    // the old game's cough: a cut-out dips him a little and spits a grey puff; running dry, the sputter
    if (r.jetSt && r.jetSt.start) {
      r.vy += DEV.sputDip * SP;
      const nz = titleNozzle(r);
      for (let i = 0; i < 3 && S.parts.length < TITLE_PARTS - 10; i++)
        S.parts.push({ x: nz.x + (S.t * 7.3 + i * 1.7) % 4 - 2, y: nz.y + 2, vx: Math.sin(S.t * 13 + i * 2.1) * 20, vy: 10 + i * 8,
          life: 0.9, max: 0.9, r: 1.6 + i * 0.3, col: '#6f767e', kind: 'jsmoke' });
      snd(S, 'sputter', nz.x, nz.y);
    }
    if (r.dry) snd(S, 'sputter', r.x, r.y);
  }
}
// CaveRunner Auto's jet fuel (auto/fuel.js): only in a level (the title and the hub fly on a bottomless tank)
/** @param {TitleScene} S */
const fuelOn = S => !!(S.team && S.lvl && S.lvl.fuel);
/** @param {TRunner} r */
const fuelOf = r => (r.fuel == null ? 1 : r.fuel);
/** @param {TitleScene} S @param {TRunner} r */
const tankOf = (S, r) => (S.lvl && S.lvl.fuel && S.lvl.fuel(S, r)) || { fuel: 1, refuel: 1 };
// The players keep apart (owner, v0.0.167): within TITLE_SEP of each other they're eased apart (sideways on the
// ground, any way in the air), and they never overlap: two bodies that do are pushed out along the shallower
// way (sideways for one on the ground), each half, or all of it on the one with room (never into rock); one steered by hand
// (ctlOn) isn't pushed or pushing: he passes through
/** @param {TitleScene} S @param {number} dt */
function separate(S, dt) {
  const P = S.runners;
  /** @param {TRunner} r @param {number} dx @param {number} dy */
  const shove = (r, dx, dy) => {
    if (r.mode === 'run' && !r.dig) dy = 0;
    if (!dx && !dy) return false;
    const nx = Math.max(8, Math.min(r.ctl ? TITLE_VW - PW - 8 : TITLE_VW * 0.62, r.x + dx)), ny = r.y + dy;   // (bug round 1: the hand-steered one isn't snapped back to 0.62)
    if (boxRock(S, nx, ny, !(r.mode === 'run' && !r.dig))) return false;
    if (r.mode === 'run') r.tx += nx - r.x;
    r.x = nx; r.y = ny;
    return true;
  };
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const a = P[i], b = P[j];
    if (ctlOn(a) || ctlOn(b)) continue;   // (owner, v2.0.16) the one steered by hand passes through the others: pushing felt like the stick being fought
    let dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy * 0.6);
    if (d < TITLE_SEP) {                                   // a gentle push apart
      const ux = d > 0.01 ? dx / d : (a.id < b.id ? 1 : -1), uy = d > 0.01 ? dy * 0.6 / d : 0, k = (TITLE_SEP - d) * 2.5 * dt;
      shove(a, -ux * k, -uy * k); shove(b, ux * k, uy * k);
      dx = b.x - a.x; dy = b.y - a.y;
    }
    const ox = PW - Math.abs(dx), oy = PH - Math.abs(dy);
    if (ox <= 0 || oy <= 0) continue;                      // no overlap
    const ground = (a.mode === 'run' && !a.dig) || (b.mode === 'run' && !b.dig);
    if (ox < oy || ground) {
      const sx = dx > 0 || (dx === 0 && a.id < b.id) ? 1 : -1;
      if (!(shove(a, -sx * ox / 2, 0) && shove(b, sx * ox / 2, 0))) shove(b, sx * ox, 0) || shove(a, -sx * ox, 0);
    } else {
      const sy = dy > 0 ? 1 : -1;
      if (!(shove(a, 0, -sy * oy / 2) && shove(b, 0, sy * oy / 2))) shove(b, 0, sy * oy) || shove(a, 0, -sy * oy);
    }
  }
}
// (owner, feedback round 2) the jet's lift by how far up the stick is (all × DEV.autoMoveK, the hand-steered speed, as the walk): full up, the old game's climb (P_JET); lowered
// toward level it eases off until he sinks (JET_SINK at level), so lowering the stick lowers the thrust; and the flame
/** the vertical speed aimed for (down +) @param {number} ny the stick's way, up − @param {number} m its push 0..1 */
export const jetLift = (ny, m) => { const up = Math.max(0, -ny) * m; return (-up * P_JET + (1 - up) * JET_SINK) * DEV.autoMoveK; };   // (× autoMoveK: owner, "way too fast")
/** the flame, 0..1 @param {number} ny @param {number} m */
export const jetThrottle = (ny, m) => Math.max(0.15, Math.max(0, -ny) * m);
export const JET_SINK = 110;
// (bug round 2) is the picked player being steered right now (the stick pushed past the dead zone)? else he's on the autopilot
/** @param {TRunner} r */
// (hanging on a vine or a web line, auto/hang.js: he stays steered with the stick at rest, holding on)
// (owner, v1.0.42) and stays steered till the stick has rested DEV.autoCtlWait s (ctlIdle, counted in ctlStep), so letting
// go of the jet drops him rather than the autopilot flying him on up
export const ctlOn = r => !!r.ctl && (r.ctl.active && r.ctl.mag > DEAD || !!r.hang || (r.ctlIdle ?? 1e9) < DEV.autoCtlWait);
// (CaveRunner Auto, feedback round 2) the selected player, steered by the pill stick as the old game's left stick (the
// hub's steering, auto/hub.js hubMove: walk, jet up, gravity; r.cvx his speed through the world, the screen's is that
// less the scroll). A step up to 8 he takes; rock in the way he's pushing toward (or the scroll pushes him into) he saws
// as anyone does (startDig: the clearing rule). His gun aims and fires by itself
/** @param {TitleScene} S @param {TRunner} r @param {RunnerCtl} st @param {number} dt */
function ctlStep(S, r, st, dt) {
  const m = st.active && st.mag > DEAD ? (st.mag - DEAD) / (1 - DEAD) : 0, jet = m > 0 && st.ny < 0 && !(fuelOn(S) && !fuelCan(r)), mv = DEV.move;   // (dry, or a cough: no thrust)
  r.cvx = r.cvx || 0;
  // (owner: the old game's hanging, auto/hang.js) a vine, chain, root, arch or web line in his hands and no jet: he hangs
  // on; web lines he touches slow him (tied)
  r.ctlIdle = m > 0 ? 0 : (r.ctlIdle || 0) + dt;   // the stick's rest (ctlOn)
  r.hangGo = (r.hangGo || 0) - dt;
  const hold = hangFind(S.props, S.webs.filter(L => !L.sp), r.x + PW / 2 + S.scroll, r.y, r.hangGo > 0), tied = hold.webMul;   // (an orb web's spiral threads: not to hang on, nor each a slow)
  r.hang = hold.climb && !jet ? hold.climb : null;
  if (r.hang) hangSteer(r, hold, st.nx, st.ny, m, r.x + PW / 2 + S.scroll, r.y, DEV.autoMoveK * mv, dt);
  else if (jet) {
    r.swing = 0;
    r.cvx = approach(r.cvx, st.nx * m * P_JET * DEV.autoMoveK * mv * tied, JET_ACC * DEV.autoMoveK * dt);
    const ty = jetLift(st.ny, m) * mv * tied;   // (feedback round 2: lowering the stick lowers the thrust)
    r.vy = ty < r.vy ? approach(r.vy, ty, JET_ACC * DEV.autoMoveK * 2 * dt) : approach(r.vy, ty, JET_ACC * DEV.autoMoveK * dt);
  } else {
    r.swing = 0;
    r.cvx = approach(r.cvx, m > 0 ? st.nx * m * WALK * DEV.autoMoveK * mv * tied : 0, (r.ground ? GROUND_ACC : AIR_ACC) * DEV.autoMoveK * dt);
    r.vy = Math.min(r.vy + GRAVITY * dt, 900);
  }
  r.flame = jet ? jetThrottle(st.ny, m) : 0;
  const vx = r.cvx - sv(S), nx = r.x + vx * dt;
  if (!boxRock(S, nx, r.y, false)) r.x = nx;
  else if (r.ground && !boxRock(S, nx, r.y - 8, false)) { r.x = nx; r.y -= 8; }
  else {
    const dir = Math.abs(r.cvx) > 5 ? Math.sign(r.cvx) : 1;
    r.cvx = 0;
    startDig(S, r, dir, 0, dir > 0 ? 'wall' : 'aim');
    if (r.dig) return;
  }
  // (owner, bug round 1) the stick pushed down while standing: he saws down into the floor
  if (r.ground && m > 0 && st.ny > 0.5 && boxRock(S, r.x, r.y + 3)) { r.cvx = 0; startDig(S, r, st.nx, st.ny, 'down'); if (r.dig) return; }
  const ny = r.y + r.vy * dt, cx = r.x + PW / 2;
  if (!boxRock(S, r.x, ny)) { r.y = ny; r.ground = false; }
  else if (r.vy > 0) {
    if (r.vy > 100) snd(S, 'land', cx, r.y + PH, r.vy * 2);
    const g = titleSurf(S, cx, r.y + PH - 9, 1);
    if (g >= r.y + PH - 9 && !boxRock(S, r.x, g - PH)) r.y = g - PH;
    r.vy = 0; r.ground = true;
  } else r.vy = 0;
  r.mode = r.ground ? 'run' : 'fly';
  r.vx = vx;
  if (Math.abs(r.cvx) > 1) r.face = Math.sign(r.cvx);
  if (r.ground) {
    r.gait += Math.abs(r.cvx) * dt * 0.38;
    if (Math.abs(r.cvx) > 10 && (r.stepT = (r.stepT || 0) - dt * Math.abs(r.cvx) / 20) <= 0) { r.stepT = 1; snd(S, 'step', cx, r.y + PH); }
  }
}
/** @param {TitleScene} S @param {TRunner} r @param {number} dt */
function runStep(S, r, dt) {
  const R = S.rnd, cx = r.x + PW / 2;
  S.groundT += dt;
  r.flame = 0;
  // run along the floor (the world scrolls under him: he keeps pace, drifting about the left half)
  // (owner, v0.0.171) each at its own pace, and now and then walking (dropping back: the world goes by faster) or sprinting
  if (r.retarget <= 0) {
    const roll = R();
    r.spd = roll < 0.25 ? -(0.3 + R() * 0.25) : roll < 0.45 ? 1.6 + R() * 0.4 : 1;
    r.tx = r.spd < 0 ? 8 : 18 + R() * 90; r.retarget = r.spd === 1 ? 1 + R() * 1.5 : 0.8 + R() * 1.2;
  }
  const vx = r.spd < 0 ? Math.max(r.spd * sv(S), (8 - r.x) * 2) : Math.max(-26 * r.pace, Math.min(26 * r.pace * r.spd, (r.tx - r.x) * 1.2));
  // his feet: a step up to 8 he takes in his stride; a hole he drops into; rock higher than that at his feet
  // (the scroll brought a wall into him) he saws
  const ground = titleSurf(S, cx, r.y + PH - 9, 1);
  if (ground < r.y + PH - 8) { r.ground = false; startDig(S, r, 1, 0, 'feet'); return; }
  if (ground > r.y + PH + 1.5) {
    r.vy += GRAV * dt; r.y += r.vy * dt; r.ground = false;
    if (r.y + PH >= ground) { if (r.vy > 100) snd(S, 'land', cx, ground, r.vy * 2); r.y = ground - PH; r.vy = 0; r.ground = true; }
  } else { r.y = ground - PH; r.vy = 0; r.ground = true; }
  // a wall ahead too tall to step, or a roof too low: saw a tunnel straight on
  const ahead = titleSurf(S, cx + 7, r.y + PH - 9, 1);
  if (ahead < r.y + PH - 7) { startDig(S, r, 1, 0, 'wall'); return; }
  if (boxRock(S, r.x, r.y, false) || boxRock(S, r.x + vx * dt + 2, r.y, false)) { startDig(S, r, 1, 0, 'roof'); return; }
  r.x += vx * dt;
  r.gait += (sv(S) + vx) * dt * 0.38;
  if ((r.stepT = (r.stepT || 0) - dt * Math.abs(sv(S) + vx) / 20) <= 0) { r.stepT = 1; snd(S, 'step', cx, r.y + PH); }
  // (owner, after v1.0.74) after the boss (S.huddle in a level) nobody takes off: they run along the floor to the exit
  if (r.modeT <= 0 && !(S.huddle && S.lvl) && !(fuelOn(S) && fuelOf(r) < FUEL_TAKEOFF)) { setMode(S, r, 'fly', flyTime(R) * tallK(S, DEV.autoRoamFly));   // (a tall level: longer flights, owner v1.0.74) (low on fuel: he runs on till it's refilled)
    pickTarget(S, r); r.vy = -40; r.ground = false; r.burst = R() < r.bursty; r.jet = r.burst; r.jetT = 0.3; r.jetCd = 0; }
}
/** @param {TitleScene} S @param {TRunner} r @param {number} dt */
function flyStep(S, r, dt) {
  const R = S.rnd, cx = r.x + PW / 2;
  S.flyT += dt;
  r.ground = false;
  const landing = r.modeT <= 0 || (!!S.huddle && !!S.lvl);   // (after the boss in a level: everyone comes down to run to the exit)
  if (landing && r.modeT < -4) r.modeT = flyTime(R);     // nowhere to land: fly on
  if (!landing && (r.retarget <= 0 || Math.hypot(r.tx - r.x, r.ty - r.y) < 6)) pickTarget(S, r);
  if (landing) { r.tx = r.x; r.ty = Math.min(S.bot + 6, titleSurf(S, cx, r.y + PH - 9, 1) - PH + 2); }
  // (owner, v0.0.171) gravity always pulls; the jetpack pushes up against it. Some fly on a steady throttle, some
  // (r.burst: rolled each flight, more often for the bursty) fire it full in short bursts and bob about; jet off,
  // they fall as anything falls. Coming in to land: off, a burst to brake if they're dropping fast near the floor
  const ax = (r.tx - r.x) * 2.2 - r.vx * 1.6;
  r.vx += ax * dt;
  let thr = 0;
  if (landing) {
    r.tx = r.x;
    thr = r.vy > 70 && titleSurf(S, cx, r.y + PH - 9, 1) - (r.y + PH) < 26 ? 1 : 0;
  } else if (r.burst) {
    if (r.jet) { r.jetT -= dt; if (r.jetT <= 0 || r.y < r.ty - 14 || r.y - titleSurf(S, cx, r.y + 2, -1) < 10 - r.vy * 0.06) { r.jet = false; r.jetCd = 0.05 + R() * 0.3; } }
    else if ((r.jetCd -= dt) <= 0 && (r.y > r.ty - 2 || r.vy > 70)) { r.jet = true; r.jetT = 0.1 + R() * 0.25; }
    thr = r.jet ? 1 : 0;
  } else {
    const want = (r.ty - r.y) * 2.2 - r.vy * 1.6;                 // the pull toward where he's going (down +)
    thr = Math.max(0, Math.min(1, (GRAV - want) / JET));
  }
  // (owner, exo Jetpack) dry: no thrust, and he comes down to land and refill; a cough cuts it for a blink
  if (fuelOn(S) && !fuelCan(r)) { thr = 0; if (r.empty && !landing) r.modeT = Math.min(r.modeT, 0); }
  r.vy += (GRAV - JET * thr) * dt;
  r.vy = Math.max(-170, Math.min(240, r.vy));
  r.flame = thr;
  // the floor rising under his feet (skimming it) he rides up over; the rock otherwise come to him (it scrolls) he saws
  const g0 = titleSurf(S, cx, r.y + PH - 9, 1);
  if (g0 < r.y + PH && g0 >= r.y + PH - 9 && !boxRock(S, r.x, g0 - PH)) r.y = g0 - PH;
  if (boxRock(S, r.x, r.y)) { startDig(S, r, r.vx + sv(S), r.vy, 'came'); return; }
  // coming down to land: once his feet are at the floor, he's running
  if (landing && g0 - (r.y + PH) < 1.5) { if (r.vy > 100) snd(S, 'land', cx, g0, r.vy * 2); r.y = g0 - PH; r.vy = 0; setMode(S, r, 'run', runTime(R) * tallK(S, DEV.autoRoamRun)); r.vx = 0; r.ground = true; r.retarget = 0; return; }
  const nx = r.x + r.vx * dt, ny = r.y + r.vy * dt;
  if (!boxRock(S, nx, ny)) { r.x = nx; r.y = ny; return; }
  // the floor under him, going down and not aiming into it: he lands on it (or skims it, on his way)
  const g2 = titleSurf(S, nx + PW / 2, r.y + PH - 9, 1), into = r.ty + PH > g2 + 4;
  if (!into && g2 >= r.y + PH - 9 && g2 - (r.y + PH) < 6 + Math.max(0, r.vy) * dt && !boxRock(S, nx, g2 - PH)) {   // (falling fast: the floor's further in a frame)
    r.x = nx; r.y = g2 - PH; r.vy = 0;
    if (landing) { setMode(S, r, 'run', runTime(R) * tallK(S, DEV.autoRoamRun)); r.vx = 0; r.ground = true; r.retarget = 0; }
    return;
  }
  startDig(S, r, r.vx + sv(S), r.vy, into ? 'aim' : 'fly');
}
// sawing through: slower, steered as he was going (running: straight on at the height he started), the
// tunnel cut round him and ahead; once he's been clear of rock a moment, his gun comes back
/** @param {TitleScene} S @param {TRunner} r @param {number} dt */
function digStep(S, r, dt) {
  const R = S.rnd;
  // (feedback round 1) a free dig (no clearing gun, S.lvl.free) ends with the level's free stretch: the rock decides again
  if (S.lvl && S.team && !r.clr && S.lvl.free && !S.lvl.free(S, r)) {
    r.dig = 0; r.clearT = 0; if (r.keep) r.kit = r.keep; r.keep = null;
    startDig(S, r, r.dx || 1, r.dy || 0, 'came');
    if (!r.dig) return;
  }
  S.digT += dt; r.dig += dt;
  if (ctlOn(r)) { ctlDig(S, r, r.ctl, dt); return; }
  if (r.mode === 'fly' && (r.retarget <= 0 || Math.hypot(r.tx - r.x, r.ty - r.y) < 6)) pickTarget(S, r);
  if (r.dig > 6 && r.mode === 'fly' && !r.goal) {        // long enough underground: up to the open air (not while a tapped spot's in there)
    const twx = r.x + PW / 2 + S.scroll, c = titleCeil(twx, S), f = titleFloor(twx, S);
    r.ty = c + (f - c) * 0.4; r.tx = r.x;
  }
  // running: straight on at the height he started, but never below the floor's line (out of a hole he was pushed into)
  const ty = r.mode === 'run' ? Math.min(r.digY, titleFloor(r.x + PW / 2 + S.scroll, S) - PH - 1) : r.ty;
  r.vx += ((r.tx - r.x) * 1.5 - r.vx * 1.6) * dt; r.vy += ((ty - r.y) * 1.5 - r.vy * 1.6) * dt;
  const v = Math.hypot(r.vx, r.vy);
  if (v > DIGV) { r.vx *= DIGV / v; r.vy *= DIGV / v; }
  r.x += r.vx * dt; r.y += r.vy * dt;
  r.flame = r.mode === 'fly' ? 0.3 : 0;
  r.ground = false;
  if (r.mode === 'run') r.gait += (sv(S) + r.vx) * dt * 0.3;
  // his way through the rock (it scrolls past at SCROLL), and the tunnel round him and ahead
  const dx = r.vx + sv(S), dy = r.vy, d = Math.hypot(dx, dy) || 1;
  r.dx = dx / d; r.dy = dy / d;
  if (!r.clr || (r.clrT || 0) < DEV.autoClearGap) titleCarve(S, r.x + PW / 2 + r.dx * 4, r.y + PH / 2 + r.dy * 4, TITLE_DIGR, false);
  if (!boxRock(S, r.x, r.y, false) && !boxRock(S, r.x + r.dx * 7, r.y + r.dy * 7, false)) r.clearT += dt; else r.clearT = 0;
  if (r.clearT > 0.25) {
    r.dig = 0; r.clearT = 0; r.swap = 0.3;
    if (r.keep) r.kit = r.keep;
    r.keep = null; r.clr = null;
    if (r.mode === 'fly' && R() < 0.5) pickTarget(S, r);
  }
}
// (owner, bug round 1) one steered by hand saws where the stick points, at the saw's pace (no autopilot target, no
// "up to the open air"); the stick let go, or pointing out of the rock, and he stops sawing
/** @param {TitleScene} S @param {TRunner} r @param {RunnerCtl} st @param {number} dt */
function ctlDig(S, r, st, dt) {
  const m = st.active && st.mag > DEAD ? (st.mag - DEAD) / (1 - DEAD) : 0;
  const end = () => { r.dig = 0; r.clearT = 0; r.swap = 0.3; if (r.keep) r.kit = r.keep; r.keep = null; r.clr = null; };
  if (!m) { end(); return; }
  const tvx = st.nx * m * DIGV - sv(S), tvy = st.ny * m * DIGV;
  r.vx += (tvx - r.vx) * Math.min(1, 6 * dt); r.vy += (tvy - r.vy) * Math.min(1, 6 * dt);
  r.x += r.vx * dt; r.y += r.vy * dt; r.cvx = r.vx + sv(S);
  r.flame = st.ny < 0 ? 0.3 : 0; r.ground = false;
  r.dx = st.nx; r.dy = st.ny;
  if (Math.abs(st.nx) > 0.2) r.face = Math.sign(st.nx);
  if (!r.clr || (r.clrT || 0) < DEV.autoClearGap) titleCarve(S, r.x + PW / 2 + r.dx * 4, r.y + PH / 2 + r.dy * 4, TITLE_DIGR, false);
  if (!boxRock(S, r.x, r.y, false) && !boxRock(S, r.x + r.dx * 7, r.y + r.dy * 7, false)) r.clearT += dt; else r.clearT = 0;
  if (r.clearT > 0.25) end();
}
// the creature player r shoots at, or null (the runner's gun below; owner v1.0.59, suite auto-aim)
/** @param {TitleScene} S @param {TRunner} r @returns {Enemy | null} */
export function titleAimPick(S, r) {
  // aim at the nearest creature within TITLE_AIM, well on screen (owner: they come into view before he blasts them). A level
  // (owner v1.0.59: the tall level's roof was out of reach): within DEV.autoAimR, any height, but never in the strip
  // DEV.autoAimEdge wide down the screen's right side or past it (they come into view first); on the left, a hail mary at
  // ones that have just left the screen, up to DEV.autoAimLeft past its edge
  // (the gun panel's window, auto/preview.js: its one target, anywhere in the room, so the grown window still fires)
  const lvl = !!S.lvl, E = DEV.autoAimEdge, pv = !!(S.hub && S.hub.pv);
  // (Grem Mode) a creature tapped on the screen: everyone aims at it till it's dead or gone
  if (S.pick) { if (S.pick.hp > 0 && !S.pick.waiting && S.foes.includes(S.pick)) return S.pick; S.pick = null; }
  let best = null, bd = lvl ? DEV.autoAimR : pv ? Infinity : TITLE_AIM;
  // (CaveRunner Auto's boss, feedback round 1: measured to its edge, and shot from behind too, so the team finishes it)
  for (const f of S.foes) {
    const fx = f.x - S.scroll, boss = f.k && f.k.boss, d = Math.hypot(fx - r.x, f.ty - r.y) - (boss ? f.r : 0);
    const seen = pv || (lvl ? fx > -DEV.autoAimLeft && fx < TITLE_VW - E : fx < TITLE_VW - 24 && fx > r.x + PW / 2 - 30);
    if (f.hp > 0 && !f.waiting && (boss || seen) && d < bd) { bd = d; best = f; }   // (v2.0.16: not the boss waiting in its arena)
  }
  return best;
}
// (exported for the gun panel's preview, auto/preview.js: its one player fires by this, as in a level)
/** @param {TitleScene} S @param {TRunner} r @param {number} dt */
export function stepRunnerGun(S, r, dt) {
  const R = S.rnd, cx = () => r.x + PW / 2;
  r.swap = Math.max(0, r.swap - dt);
  if (r.dig) {
    // sawing: the blade the way he's cutting; a creature it reaches is cut too
    let d = Math.atan2(r.dy, r.dx) - r.ang; d = Math.atan2(Math.sin(d), Math.cos(d));
    r.ang += d * Math.min(1, dt * 10);
    r.face = Math.cos(r.ang) >= 0 ? 1 : -1;
    r.sawT -= dt;
    const mz = gunMuzzle(cx() + Math.cos(r.ang) * 2.5, r.y + PH * 0.45, r.ang, GUN_HELD, r.kit.art), bx = mz.x + Math.cos(r.ang) * 3, by = mz.y + Math.sin(r.ang) * 3;
    // CaveRunner Auto: the clearing gun (his own, or a teammate's) really fires at the rock; the tunnel's cut while it does
    const cp = r.clr && S.team ? S.team[r.clr.p] : null, cg = cp ? cp.guns[r.clr.g] : null;
    if (cp && cg) {
      r.clrT = (r.clrT || 0) + dt;
      gunTick(cg, dt);
      const plan = gunPull(cg, cp.guns);
      if (plan) {
        const out = planShots(plan, r.ang, mz.x, mz.y, R, r.id);
        for (const s of out) S.shots.push(s);
        if (out.length) { r.clrT = 0; snd(S, 'cast', mz.x, mz.y, r.kit); }
      }
      if (R() < dt * 25) burst(S, bx, by, 1, R() < 0.5 ? '#ffd27a' : '#fff2c0', 70, 'spark', 0.15);
      return;
    }
    if (R() < dt * 25) burst(S, bx, by, 1, R() < 0.5 ? '#ffd27a' : '#fff2c0', 70, 'spark', 0.15);
    if ((r.sawS = (r.sawS || 0) - dt) <= 0) { r.sawS = r.kit.cd; snd(S, 'cast', bx, by, r.kit); }
    if (r.sawT <= 0) for (const f of S.foes) if (f.hp > 0 && Math.hypot(f.x - S.scroll - bx, f.ty - by) < f.r + 6) { hitFoe(S, f, MODS.saw.dmg * 0.5, '#d9dde4'); r.sawT = 0.15; }
    return;
  }
  // (owner v1.0.74) the boss dead (CaveRunner Auto's level, S.gunsOff): every gun put down, the aim eased level
  if (S.gunsOff) { r.ang += (0 - r.ang) * Math.min(1, dt * 4); r.face = Math.cos(r.ang) >= 0 ? 1 : -1; return; }
  const best = titleAimPick(S, r);
  const gx0 = cx(), gy0 = r.y + PH * 0.45;
  if (best) {
    const want = Math.atan2(best.ty - gy0, best.x - S.scroll - gx0);
    let d = want - r.ang; d = Math.atan2(Math.sin(d), Math.cos(d));
    r.ang += d * Math.min(1, dt * 10);
  } else r.ang += (0 - r.ang) * Math.min(1, dt * 4);
  r.face = Math.cos(r.ang) >= 0 ? 1 : -1;
  // CaveRunner Auto: the player's active gun, real (its mana, cast delay and recharge; planCast's shots)
  const pl = S.team && S.team[r.id];
  if (pl) {
    const g = pl.alive === false ? null : pl.guns[pl.active];
    if (!g) return;
    gunTick(g, dt);
    // Questions Later (owner v1.0.65): the trigger always down, nothing in sight or not, in a level (not the hub); aimed ahead when nothing is
    if (!best && !(S.lvl && gunPassives(g).auto)) return;
    const plan = gunPull(g, pl.guns);
    if (!plan) return;
    const mz = gunMuzzle(gx0 + Math.cos(r.ang) * 2.5, gy0, r.ang, GUN_HELD, r.kit.art), out = planShots(plan, r.ang, mz.x, mz.y, R, r.id), dm = perkDmg(pl);
    for (const s of out) { s.dmg *= dm; S.shots.push(s); }
    if (out.length) {
      burst(S, mz.x, mz.y, 3, out[0].col, 40, 'spark', 0.12); snd(S, 'cast', mz.x, mz.y, r.kit);
      for (const p of muzzleFx(out[0].sid || '', mz.x, mz.y, r.ang, R)) if (S.parts.length < TITLE_PARTS) S.parts.push(p);   // Slug's puff of smoke
    }
    return;
  }
  // every few seconds: another gun
  r.swapT -= dt;
  if (r.swapT <= 0) {
    r.kit = titleKit(R); S.kitNames.add(r.kit.name);
    r.swapT = 3.5 + R() * 2.5; r.swap = 0.3; r.cd = 0.35; S.swaps++;
    snd(S, 'swap', cx(), r.y + PH / 2);
  }
  r.cd -= dt;
  if (!best || r.cd > 0 || r.swap > 0) return;
  const K = r.kit, mz = gunMuzzle(gx0 + Math.cos(r.ang) * 2.5, gy0, r.ang, GUN_HELD, K.art), gx = mz.x, gy = mz.y;   // out of its barrel
  r.cd = K.cd * (0.85 + R() * 0.3);
  const n = Math.min(12, K.n);
  if (K.shot === 'zap') {
    // lightning: an arc into the creature (more of them: the next nearest), and one throwing off into the rock below it
    snd(S, 'cast', gx, gy, K);
    const near = S.foes.filter(f => f.hp > 0 && f.x - S.scroll < TITLE_VW).sort((a, b) => Math.hypot(a.x - best.x, a.ty - best.ty) - Math.hypot(b.x - best.x, b.ty - best.ty));
    for (const f of near.slice(0, Math.min(4, n))) {
      const bx = f.x - S.scroll, by = f.ty;
      zapArc(S, gx, gy, bx, by, K.col);
      const fl = titleSurf(S, bx, by + f.r, 1);
      if (fl - by < 50 && R() < 0.6) { snd(S, 'arc', bx, fl); zapArc(S, bx, by, bx + (R() - 0.5) * 16, fl + 1, K.col); titleCarve(S, bx, fl + 1, 2.5); titleIgnite(S, bx, fl + 1, 4); }
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
  snd(S, 'cast', gx, gy, K);
}

// Follow Me on a field (owner v1.0.66, the old game's spells/paths.js rule): it steers to its caster's middle, slowing as it
// arrives, and stays with him (none left: it stays put). (owner, after v1.0.81) with Discriminate set on a player, it follows
// that player instead
/** @param {TitleScene} S @param {TShot} s @param {number} dt */
function fieldFollow(S, s, dt) {
  const pt = targetsOf(s.only).find(o => o.kind === 'player');   // (the first player it names)
  const r = pt ? S.runners.find(u => String(u.id + 1) === pt.id) : S.runners[s.by];
  if (!r || r.out) { s.vx = s.vy = 0; return; }
  const dx = r.x + PW / 2 - s.x, dy = r.y + PH / 2 - s.y, d = Math.hypot(dx, dy) || 1;
  const want = Math.min(FIELD_SPEED * 2, d * 5), k = Math.min(1, SEEK_ACC * dt);
  s.vx += (dx / d * want - s.vx) * k; s.vy += (dy / d * want - s.vy) * k;
}
// a trajectory shot's light trail (auto/traj.js trajLook: its points, DEV.tr…Trail long; drawn by game/render/titledraw.js)
/** @param {TShot} s */
function trajTrail(s) {
  const L = trajLook(s), n = L ? Math.round(L.trail) : 0;
  if (!n) { s.ptr = undefined; return; }
  const t = s.ptr || (s.ptr = []);
  t.unshift(s.x, s.y);
  if (t.length > n * 2) t.length = n * 2;
}
// Follow Me on a shot (owner v1.0.67, the old game's spells/paths.js rule): a steady pull to its caster's middle, FOLLOW_PULL × its
// strength, never faster than it set out, so it slows, stops and comes straight back (caster gone: it flies on)
/** @param {TitleScene} S @param {TShot} s @param {number} dt */
function shotFollow(S, s, dt) {
  const r = S.runners[s.by];
  if (!r || r.out) return;
  const dx = r.x + PW / 2 - s.x, dy = r.y + PH / 2 - s.y, d = Math.hypot(dx, dy) || 1;
  const sp0 = s.sp0 || (s.sp0 = Math.hypot(s.vx, s.vy) || 1), a = FOLLOW_PULL * (s.follow || 0) * SP * dt;
  s.vx += dx / d * a; s.vy += dy / d * a;
  const sp = Math.hypot(s.vx, s.vy);
  if (sp > sp0) { s.vx *= sp0 / sp; s.vy *= sp0 / sp; }
}
// Circle of Vigour (owner v1.0.66; art/scenegun.js vigourCircle): each living player inside, under his max, heals VIG_HP (× his
// heal perks; players only, never creatures) every VIG_TICK s, a green sparkle and the old game's heal tick
/** @param {TitleScene} S @param {TShot} s @param {number} dt */
function vigourStep(S, s, dt) {
  if ((s.tick = (s.tick || 0) - dt) > 0 || !S.team) return;
  let healed = false;
  for (const r of S.runners) {
    const pl = S.team[r.id], cx = r.x + PW / 2, cy = r.y + PH / 2;
    if (!pl || pl.alive === false || r.out || Math.hypot(cx - s.x, cy - s.y) > (s.heal || 0)) continue;
    if (!matchesTarget(s.only, { kind: 'player', id: String(r.id + 1) })) continue;   // (owner v1.0.74) Discriminate: only its player (never a creature)
    // (owner, after v1.0.83) Mana Spring: his gun's mana, not his health
    if (s.mana) { if (giveMana(S, r, s.mana)) { healed = true; burst(S, cx, r.y + 2, 3, '#9fd0ff', 30, 'spark', 0.35); } continue; }
    const st = playerStats(pl);
    if (pl.hp >= st.maxHp) continue;
    pl.hp = Math.min(st.maxHp, pl.hp + VIG_HP * (st.heal || 1)); healed = true;
    burst(S, cx, r.y + 2, 3, '#9dff9a', 30, 'spark', 0.35);
  }
  if (healed) { s.tick = VIG_TICK; snd(S, 'healtick', s.x, s.y); }
}

// Mana Burst (owner, after v1.0.83; spells/mods.js manaburst): where the shot ends, each living player within MANA_BURST_R gets
// s.manaB mana in his gun (to its max), a blue ring and sparkle
export const MANA_BURST_R = 60;
/** @param {TitleScene} S @param {TShot} s */
function manaBurst(S, s) {
  const n = s.manaB || 0;
  s.manaB = 0;
  S.booms.push({ x: s.x, y: s.y, r: MANA_BURST_R, t: 0, max: 0.45, sid: 'manaburst' });
  burst(S, s.x, s.y, 12, '#7cc0ff', 80, 'spark', 0.4);
  if (!S.team) return;
  for (const r of S.runners) {
    const cx = r.x + PW / 2, cy = r.y + PH / 2;
    if (r.out || Math.hypot(cx - s.x, cy - s.y) > MANA_BURST_R) continue;
    if (giveMana(S, r, n)) burst(S, cx, r.y + 2, 4, '#9fd0ff', 30, 'spark', 0.35);
  }
  snd(S, 'healtick', s.x, s.y);
}
// mana into runner r's gun in hand, to its max: true when it took some
/** @param {TitleScene} S @param {TRunner} r @param {number} n */
function giveMana(S, r, n) {
  const pl = S.team && S.team[r.id], g = pl && pl.alive !== false ? pl.guns[pl.active] : null;
  if (!g) return false;
  const max = g.manaMax + gunPassives(g).manaMax, was = g.mana == null ? max : g.mana;
  if (was >= max) return false;
  g.mana = Math.min(max, was + n);
  return true;
}

// a lightning arc from one point to another (drawn with the game's drawBolt)
/** @param {TitleScene} S @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @param {string} col @param {boolean} [fade] fading in from its start (a teleport's, from above) */
export function zapArc(S, x0, y0, x1, y1, col, fade) {
  const R = S.rnd, pts = [{ x: x0, y: y0 }];
  for (let i = 1; i < 7; i++) { const k = i / 7; pts.push({ x: x0 + (x1 - x0) * k + (R() - 0.5) * 9, y: y0 + (y1 - y0) * k + (R() - 0.5) * 9 }); }
  pts.push({ x: x1, y: y1 });
  S.zaps.push({ pts, t: 0.16, col, fade });
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
// CaveRunner Auto's web thicket (auto/blocked.js): a player's clearing gun at the webs round him; fire burns them, else cut
/** @param {TitleScene} S @param {TRunner} r @param {boolean} fire @param {number} rad */
export function titleClearWebs(S, r, fire, rad) {
  const cx = r.x + PW / 2 + 6, cy = r.y + PH / 2;
  if (fire) { titleIgnite(S, cx, cy, rad, 1); burst(S, cx, cy, 4, '#ff9a3a', 50, 'spark', 0.3); }
  else cutWebs(S, cx + S.scroll, cy, rad);
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
    if (e.bat || e.worm) continue;   // (a bat's or a worm's stand-in: creatures/bats.js, glowworm.js move it)
    const k = e.k, ru = nearestRunner(S, e.x - S.scroll, e.ty);
    const pcx = S.scroll + ru.x + PW / 2, pcy = ru.y + PH / 2, goal = { x: pcx, y: pcy };
    e.flash -= dt; e.cd -= dt; e.touch -= dt;
    const dx = pcx - e.x, dy = pcy - e.ty, dist = Math.hypot(dx, dy) || 1;
    e.lx = dx / dist; e.ly = dy / dist;
    if (k.kp && ((e.aggroT = (e.aggroT || 0) - dt) <= 0)) { e.aggroM = kr(k.kp + 'Aggro', R); e.aggroT = 1; }
    const reach = k.aggro * sees * DEV.aggro * carrotAt('caAggro', 0) * (k.kp ? e.aggroM : 1);
    if (!e.aggro) { if (dist < reach && losClear(e.x, e.ty, pcx, pcy, CS)) { e.aggro = true; snd(S, 'alert', e.x - S.scroll, e.ty, k); } }
    else if (dist > reach * DEV.loseAggro) e.aggro = false;
    const hunting = !!e.aggro;
    if (k.act === 'jelly') jellyAct(S, e, hunting, goal, sees, CS, dt);
    else if (k.act === 'spider') spiderAct(S, e, hunting, goal, sees, dist, dx, dy, CS, dt);
    else if (k.act === 'rat') ratAct(S, e, ru, hunting, CS, dt);
    if (CLASSIC[k.act]) { if (classicAct(S, e, hunting, goal, dist, dx, dy, CS, dt)) continue; }
    else e.ty = e.y;
    if (S.lvl) keepOff(S, e, CS);   // (owner, v1.0.100) not inside a player's gun reach
    // a bite when it reaches him (he takes no harm here: a puff where it lands)
    if (!hunting && R() < 0.07 * dt) snd(S, 'idle', e.x - S.scroll, e.ty, k);
    if (hunting && dist < biteReach(S, e) && e.touch <= 0) {
      e.touch = k.kp ? kr(k.kp + 'BiteCd', R) : 0.9; snd(S, 'bite', e.x - S.scroll, e.ty, k); burst(S, ru.x + PW / 2, ru.y + PH / 2, 4, '#ff6a5a', 50, 'spark', 0.2);
      if (S.lvl && S.lvl.hurt) S.lvl.hurt(S, ru.id, k.dmg * (CLASSIC[k.act] ? DEV.autoOldDmg : 1));   // CaveRunner Auto: it hurts (auto/enemies.js levelHurt; an old floor's creature × autoOldDmg)
    }
    // on fire (game/systems/fire.js): it catches from burning cells, burns for a while, hurt as it goes
    if (!(e.burn > 0) && S.fire.length && fireNear(S, e.x, e.ty, e.r * 0.7)) { e.burn = kr('fireBurn', R); snd(S, 'whoosh', e.x - S.scroll, e.ty); }
    if (e.burn > 0) {
      e.burn -= dt;
      if (R() < dt * 40) flameAt(S, e.x - S.scroll + (R() - 0.5) * e.r, e.ty + (R() - 0.5) * e.r);
      if (R() < dt * 6) fireSmoke(S, e.x - S.scroll, e.ty - e.r);
      e.burnAcc = (e.burnAcc || 0) + kr('fireDps', R) * dt;   // hurt in chunks (as the game): a flash now and then, not white all the time
      if (e.burnAcc >= 0.5 || e.burn <= 0) { const d = e.burnAcc; e.burnAcc = 0; hitFoe(S, e, d, '#ff9a2e'); }
    }
  }
  S.foes = S.foes.filter(e => e.hp > 0 && e.x - S.scroll > behind(S, -40) && e.y < S.vh + 20);
  // spider strings in flight (game/creatures/spider.js spiderFrame): rock stops them; reaching him, gone
  for (const b of S.silk) {
    b.life -= dt;
    const n = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 2);
    for (let s = 0; s < n && b.life > 0; s++) {
      b.x += b.vx * dt / n; b.y += b.vy * dt / n;
      if (CS(Math.floor(b.x / CELL), Math.floor(b.y / CELL))) b.life = 0;
      else if (S.runners.some(q => Math.abs(b.x - S.scroll - q.x - PW / 2) < PW / 2 + 3 && Math.abs(b.y - q.y - PH / 2) < PH / 2 + 3)) { b.life = 0; snd(S, 'lash', b.x - S.scroll, b.y); }
    }
  }
  S.silk = S.silk.filter(b => b.life > 0);
}
// (owner, v1.0.100: a rat at his feet was too close to shoot: a shot starts at the gun's tip, ~18 units out) in a level a
// creature keeps DEV.autoFoeKeep units past its own size from every player's middle: pushed straight out sideways (a
// walker stays on its floor), else straight away from him, else left where it is (rock both ways). Its bite (and a bomber's
// burst) reaches BITE_PAST further, so it still hurts
const BITE_PAST = 4;
/** @param {TitleScene} S @param {Enemy} e @returns {number} the bite's reach from his middle */
const biteReach = (S, e) => e.r + (S.lvl ? Math.max(14, DEV.autoFoeKeep + BITE_PAST) : 14);
/** @param {TitleScene} S @param {Enemy} e @param {(cx: number, cy: number) => number} CS */
function keepOff(S, e, CS) {
  const keep = e.r + DEV.autoFoeKeep;
  if (keep <= 0) return;
  /** @param {number} x @param {number} y */
  const free = (x, y) => !CS(Math.floor(x / CELL), Math.floor(y / CELL));
  for (const r of S.runners) {
    if (r.out || r.hide) continue;
    const cx = S.scroll + r.x + PW / 2, cy = r.y + PH / 2, dx = e.x - cx, dy = e.y - cy, d = Math.hypot(dx, dy);
    if (d >= keep) continue;
    const side = dx === 0 ? (e.lx > 0 ? -1 : 1) : Math.sign(dx);
    const hx = cx + side * Math.sqrt(Math.max(0, keep * keep - dy * dy));
    let nx = e.x, ny = e.y;
    if (free(hx, e.y)) nx = hx;
    else if (d > 0.01 && free(cx + dx / d * keep, cy + dy / d * keep)) { nx = cx + dx / d * keep; ny = cy + dy / d * keep; }
    else continue;
    e.ty += ny - e.y; e.x = nx; e.y = ny;
  }
}
// (owner v1.0.103: "elites need their particle effects from the normal game") every elite gives off fire from its body, as the
// old game's stepEliteFire (game/systems/particles.js; Dev → Elites: flames, every number rolled per speck): each speck starts
// in its body with the elite's own speed, sheds it to drag, rises and swings side to side; its colour and opacity over its life
// from the gradient and ramp (titledraw.js). World coordinates; at most ELITE_FX_MAX
const ELITE_FX_MAX = 700;
/** @param {TitleScene} S @param {number} dt */
function stepEliteFx(S, dt) {
  if (dt <= 0) return;
  const Q = S.eliteFx || (S.eliteFx = []);
  for (const e of S.foes) {
    if (!e.k.elite) continue;
    const vx = e.fxPx != null ? (e.x - e.fxPx) / dt : 0, vy = e.fxPy != null ? (e.ty - e.fxPy) / dt : 0;
    e.fxPx = e.x; e.fxPy = e.ty;
    e.fxAcc = (e.fxAcc || 0) + kr('elFxRate') * dt;
    for (; e.fxAcc >= 1; e.fxAcc--) {
      const a = Math.random() * Math.PI * 2, rr = e.r * kr('elFxBody') * Math.sqrt(Math.random()), life = kr('elFxLife');
      Q.push({ x: e.x + Math.cos(a) * rr, y: e.ty + Math.sin(a) * rr, vx: Math.max(-400, Math.min(400, vx)), vy: Math.max(-400, Math.min(400, vy)),
        life, max: life, rise: kr('elFxRise'), wave: kr('elFxWave'), hz: kr('elFxWaveHz'), drag: kr('elFxDrag'), s: kr('elFxSize'), ph: Math.random() * 6.283, age: 0 });
    }
  }
  for (let i = Q.length - 1; i >= 0; i--) {
    const q = Q[i];
    q.age = (q.age || 0) + dt;
    const k = Math.exp(-(q.drag || 0) * dt);
    q.vx *= k; q.vy *= k;
    q.x += (q.vx + Math.sin(q.age * (q.hz || 0) * 6.283 + (q.ph || 0)) * (q.wave || 0)) * dt;
    q.y += (q.vy - (q.rise || 0)) * dt;
    if ((q.life -= dt) <= 0) Q.splice(i, 1);
  }
  if (Q.length > ELITE_FX_MAX) Q.splice(0, Q.length - ELITE_FX_MAX);
}
// a classic creature's frame (game/creatures/classic.js classicMove, bombBurst, gunFire, as the old game): hunting (chasers and
// bombers) it comes straight at him sliding along rock, else it patrols round home; it hovers (e.ty bobs); a bomber reaching him
// bursts (true: it's gone); a shooter or turret fires on him within its range (a turret with a wind-up, k.tele, shows its ring
// first) through the level's hurt. (Auto plays itself: no dodging, so DEV.autoOldDmg / autoOldCd soften them)
/** @param {TitleScene} S @param {Enemy} e @param {boolean} hunting @param {Pt} goal @param {number} dist @param {number} dx @param {number} dy @param {(cx: number, cy: number) => number} CS @param {number} dt @returns {boolean} */
function classicAct(S, e, hunting, goal, dist, dx, dy, CS, dt) {
  const R = S.rnd, k = e.k;
  /** @param {number} x @param {number} y */
  const solid = (x, y) => !!CS(Math.floor(x / CELL), Math.floor(y / CELL));
  /** @param {number} x @param {number} y */
  const blocked = (x, y) => solid(x - e.r, y) || solid(x + e.r, y) || solid(x, y - e.r) || solid(x, y + e.r);
  if (k.act !== 'turret') {
    const step = k.spd * dt;
    if (hunting) {
      const wx = e.x + dx / dist * step, wy = e.y + dy / dist * step;
      if (!blocked(wx, wy)) { e.x = wx; e.y = wy; }
      else if (!solid(wx, e.y)) e.x = wx;
      else if (!solid(e.x, wy)) e.y = wy;
      else { e.tgt = null; e.rest = 0; }
    } else {
      e.rest -= dt;
      if (!e.tgt || e.rest <= 0 || Math.hypot(e.tgt.x - e.x, e.tgt.y - e.y) < 6) {
        const a = R() * Math.PI * 2, r = 10 + R() * PATROL_R;
        e.tgt = { x: e.hx + Math.cos(a) * r, y: e.hy + Math.sin(a) * r };
        e.rest = 2 + R() * 3.5;
      }
      const tdx = e.tgt.x - e.x, tdy = e.tgt.y - e.y, td = Math.hypot(tdx, tdy) || 1;
      const wx = e.x + tdx / td * step, wy = e.y + tdy / td * step;
      if (blocked(wx, wy)) { e.tgt = null; e.rest = 0; } else { e.x = wx; e.y = wy; }
    }
  }
  e.ty = e.y + Math.sin(S.t * 2 + e.phase) * (hunting ? 2 : 4);
  // a bomber: its fuse ticks closing in, and it bursts on reaching him (gone, no drop)
  if (k.act === 'bomb' && hunting) {
    if (dist < 160 && (e.fuseT = (e.fuseT || 0) - dt) <= 0) { e.fuseT = 0.12 + dist / 400; snd(S, 'fuse', e.x - S.scroll, e.ty, k); }
    if (dist < biteReach(S, e)) {
      burst(S, e.x - S.scroll, e.ty, 22, k.col.a, 90, 'spark', 0.4);
      snd(S, 'boom', e.x - S.scroll, e.ty, 10);
      const ru = nearestRunner(S, e.x - S.scroll, e.ty);
      if (S.lvl && S.lvl.hurt) S.lvl.hurt(S, ru.id, k.dmg * DEV.autoOldDmg);
      if (k.id === 'tuli') titleIgnite(S, e.x - S.scroll, e.ty, 26, 1);   // Stendari: a fire bomb
      e.hp = 0;
      return true;
    }
  }
  // a shooter or turret: within its range and in sight, a shot (or the wind-up first)
  if (k.range > 0) {
    if (e.charge > 0) { e.charge -= dt; if (e.charge <= 0) foeShot(S, e, goal, CS); }
    else if (dist < k.range / DEV.zoom && e.cd <= 0) {
      e.cd = 0.4;
      if (losClear(e.x, e.ty, goal.x, goal.y, CS)) {
        e.cd = k.cd * DEV.autoOldCd * (0.85 + R() * 0.3);
        if (!e.spotted) { e.spotted = true; snd(S, 'alert', e.x - S.scroll, e.ty, k); }
        if (k.tele) { e.charge = k.tele; snd(S, 'charge', e.x - S.scroll, e.ty, k); } else foeShot(S, e, goal, CS);
      }
    }
  }
  return false;
}
// a classic creature's shot(s) at him (game/systems/enemies.js fireEnemyShot): k.shots in a fan, a little spread; a foe shot
// in the scene (screen x), its colour the creature's
/** @param {TitleScene} S @param {Enemy} e @param {Pt} goal @param {(cx: number, cy: number) => number} CS */
function foeShot(S, e, goal, CS) {
  const k = e.k, R = S.rnd;
  if (!losClear(e.x, e.ty, goal.x, goal.y, CS)) return;
  const base = Math.atan2(goal.y - e.ty, goal.x - e.x), n = k.shots || 1;
  snd(S, 'fire', e.x - S.scroll, e.ty, k);
  for (let s = 0; s < n; s++) {
    const a = base + (n > 1 ? (s - (n - 1) / 2) * 0.15 : 0) + (R() - 0.5) * 0.22;
    S.shots.push({ x: e.x - S.scroll + Math.cos(a) * (e.r + 4), y: e.ty + Math.sin(a) * (e.r + 4), vx: Math.cos(a) * k.bspd, vy: Math.sin(a) * k.bspd,
      size: k.body === 'blob' ? 4 : 3, col: k.col.a, look: 'ball', life: 2.5, foe: true, spin: 0, grav: 0, drag: 0, explode: 0, pit: 0, fire: 0, bounce: 0, bounceE: 0, pierce: 0, dmg: k.dmg * DEV.autoOldDmg });
  }
}
/** @param {TitleScene} S @param {Enemy} e @param {boolean} hunting @param {Pt} goal @param {number} sees @param {(cx: number, cy: number) => number} CS @param {number} dt */
function jellyAct(S, e, hunting, goal, sees, CS, dt) {
  const R = S.rnd;
  // (owner v1.0.74) deeper levels: it turns faster, DEV.autoJeTurnTier more a level past the first, at most × DEV.autoJeTurnMax
  const turnMul = S.lvl ? Math.min(DEV.autoJeTurnMax, 1 + DEV.autoJeTurnTier * Math.max(0, (S.tier || 1) - 1) * (S.lvl.data && S.lvl.data.grem ? DEV.gremHard : 1)) : 1;
  jellyStep(e, { solidCell: CS, hunting, goal, rnd: R, speedMul: 1, rangeMul: sees, turnMul, stay: x => built(x, S) === 0 }, dt);
  const J = e.je;
  if (hunting && J && J.inRange && J.aimed && e.cd <= 0) {
    e.cd = 0.25;                                // no clear line: look again shortly
    const hx = e.x + Math.cos(J.hd) * e.r * 0.9, hy = e.y + Math.sin(J.hd) * e.r * 0.9;
    if (losClear(hx, hy, goal.x, goal.y, CS)) {
      e.cd = kr('jeShotCd', R);
      snd(S, 'fire', hx - S.scroll, hy, e.k);
      const a = Math.atan2(goal.y - hy, goal.x - hx) + (R() * 2 - 1) * kr('jeSpread', R) * Math.PI / 180, v = kr('jeShotSpd', R), P = jellyPal(J.u.col);
      S.shots.push({ x: hx - S.scroll, y: hy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: kr('jeShotSize', R), col: P.spit, look: 'glob', life: 3, foe: true, spin: 0,
        grav: 0, drag: 0, explode: 0, pit: 0, fire: 0, bounce: 0, bounceE: 0, pierce: 0, dmg: e.k.dmg });
    }
  }
}
/** @param {TitleScene} S @param {Enemy} e @param {boolean} hunting @param {Pt} goal @param {number} sees @param {number} dist @param {number} dx @param {number} dy @param {(cx: number, cy: number) => number} CS @param {number} dt */
function spiderAct(S, e, hunting, goal, sees, dist, dx, dy, CS, dt) {
  const R = S.rnd;
  // on a line it rides the line's sag, which spiderStep doesn't know about: last frame's off, this frame's on
  if (e.wox || e.woy) { e.x -= e.wox || 0; e.y -= e.woy || 0; e.wox = e.woy = 0; }
  const x0 = e.x, y0 = e.y;
  if (spiderStep(e, { solidCell: CS, webs: S.webs, hunting, goal, rnd: R, speedMul: 1, hold: S.lvl ? spiderHold(e) : undefined }, dt) === 'web') snd(S, 'lash', e.x - S.scroll, e.y);
  const P = e.sp;
  // (owner v1.0.74: the boss's and elites' legs didn't walk) a level's spider: the legs cycle by the distance walked, a stride
  // as long as DEV.autoSpStride × its size (not falling)
  if (P && S.lvl) P.gait = (P.gait || 0) + (P.mode === 'fall' ? 0 : Math.hypot(e.x - x0, e.y - y0) / Math.max(0.5, e.r * DEV.autoSpStride));
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
      snd(S, 'fire', e.x - S.scroll, e.y, e.k);
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
  if (ratStep(e, { solidCell: CS, rnd: R, goal: way, hunting, home: false, path: undefined, follow, air, onWeb: onWeb(S),
    speedMul: 1, arrive: way === goal && hunting ? e.arrive : 3, jump }, dt) === 'jump') snd(S, 'alert', e.x - S.scroll, e.y, e.k);
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
  let best = S.runners.find(r => !r.out) || S.runners[0], bd = Infinity;
  for (const r of S.runners) {
    if (r.out) continue;
    const d = Math.hypot(r.x + PW / 2 - x, r.y + PH / 2 - y);
    if (d < bd) { bd = d; best = r; }
  }
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
    if (d < COIN_PULL && !(g.nopull > 0) && !(S.lvl && S.lvl.fits && !S.lvl.fits(S, { kind: 'gold', n: g.amount }))) {
      g.fly = true;
      const grab = 180 + 900 * (1 - d / COIN_PULL);
      g.vx = (g.vx || 0) + (dx / d) * grab * dt * 6; g.vy = (g.vy || 0) + (dy / d) * grab * dt * 6;
      g.vx *= 0.88; g.vy *= 0.88;
      g.x += g.vx * dt; g.y += g.vy * dt;
      if (d < 12 && S.lvl && S.lvl.take && !S.lvl.take(S, { kind: 'gold', n: g.amount })) { g.fly = false; continue; }
      if (d < 12) { S.got += g.amount; S.gotN++; S.coins.splice(i, 1); snd(S, 'coin', g.x - S.scroll, g.y); }
      continue;
    }
    if (stepNugget(g, dt, solid)) snd(S, 'coinland', g.x - S.scroll, g.y);
    if (g.x - S.scroll < behind(S, -30)) S.coins.splice(i, 1);
  }
  collideNuggets(S.coins, solid);
}

const LOOT_WAIT = 0.6;   // a drop flies to the team after this long (s), once it has been seen thrown up
// CaveRunner Auto's drops (S.loot, killFoe): each falls and bounces as a nugget, then (once LOOT_WAIT is up) is vacuumed to
// the nearest player still in, from anywhere, straight through rock, and goes into the bag (S.lvl.take) at 12. The bag
// full (S.lvl.fits): it waits on the ground. Left behind off the screen, it's gone
/** @param {TitleScene} S @param {number} dt */
function stepLoot(S, dt) {
  if (!S.loot || !S.loot.length) return;
  const solid = wsolid(S), L = S.lvl || S.hub;
  for (let i = S.loot.length - 1; i >= 0; i--) {
    const g = S.loot[i], ru = nearestRunner(S, g.x - S.scroll, g.y), pcx = S.scroll + ru.x + PW / 2, pcy = ru.y + PH / 2;
    const dx = pcx - g.x, dy = pcy - g.y, d = Math.hypot(dx, dy) || 1;
    g.t += dt;
    if (g.nopull > 0) g.nopull -= dt;
    // (a hub machine's item, feedback round 1: g.land) it falls and lands first, rests g.land s on the floor, then the pull
    if (g.land > 0 && (g.ground || g.t > 3)) g.land -= dt;
    g.wait = !!(L && L.fits && !L.fits(S, g.it));
    g.fly = !g.left && !(g.nopull > 0) && !(g.land > 0) && !g.wait && !ru.out && !(g.reach && (g.t < (g.minT || 0) || d > g.reach));
    if (g.fly) {
      const grab = 260 + 900 * Math.max(0, 1 - d / COIN_PULL);
      g.vx += (dx / d) * grab * dt * 6; g.vy += (dy / d) * grab * dt * 6;
      g.vx *= 0.88; g.vy *= 0.88;
      g.x += g.vx * dt; g.y += g.vy * dt;
      if (d < 12 && (!L || !L.take || L.take(S, g.it))) {
        S.loot.splice(i, 1); snd(S, 'coin', g.x - S.scroll, g.y);
        if (S.onTake) S.onTake(g.it, g.x - S.scroll, g.y);   // the screen flies a copy of its tile into the bag (AutoScreen)
      }
      continue;
    }
    g.amount = g.it.kind === 'red' || g.it.kind === 'green' ? 25 : 5;     // a gem lies as the biggest nugget (drawn as the game's crystal)
    stepNugget(g, dt, solid);
    if (g.x - S.scroll < behind(S, -30)) S.loot.splice(i, 1);
  }
}

// a beam (Plasma Beam, Luminous Drill: CaveRunner Auto, stage shots 2) fires along its angle the frame it's cast, to
// its length or the first rock (auto/shotfx.js traceBeam): every creature on the line hit once, Plasma sets alight
// what it lands on and the creatures it hits, the drill digs where it ends. Then it hangs, drawn, for its short life
/** @param {TitleScene} S @param {TShot} s */
function castBeam(S, s) {
  const e = traceBeam(s, (x, y) => titleSolid(S, x, y)), a = s.ang || 0, cx = Math.cos(a), cy = Math.sin(a);
  s.bx = e.x; s.by2 = e.y;
  for (const f of S.foes) {
    if (f.hp <= 0) continue;
    const fx = f.x - S.scroll - s.x, fy = f.ty - s.y, along = fx * cx + fy * cy;
    if (along < 0 || along > e.len || Math.abs(fx * cy - fy * cx) > f.r + s.size) continue;
    hitFoe(S, f, s.dmg, s.col, s.by);
    if (s.sid === 'plasma') f.burn = Math.max(f.burn || 0, kr('fireBurn', S.rnd));
  }
  if (e.rock) {
    if (s.sid === 'plasma') titleIgnite(S, e.x, e.y, 7);
    if (s.pit) titleCarve(S, e.x, e.y, s.pit * 0.7);
  }
}

// Discriminate (owner, v1.0.71): a shot carrying `only` (a set copy before it) touches only that creature kind, passing through the rest
/** @param {TShot} s @param {Enemy} f */
const foeOk = (s, f) => !s.only || matchesTarget(s.only, { kind: 'creature', id: f.k.id });
/** @param {TitleScene} S @param {number} dt */
function stepShots(S, dt) {
  for (const s of S.shots) {
    // homing (pollen, Homing, Seeker): turns onto the nearest creature; accelerating ones speed up to their top speed
    s.age = (s.age || 0) + dt;
    if (s.beam && s.bx == null) castBeam(S, s);
    if (s.autoaim && !s.aimed && !s.foe) trajAim(s, S.foes, S.scroll);   // Auto-Aim: at the nearest creature as it leaves the barrel
    // Magic Missile (stage: shots): out at the angle fired, then curving onto the nearest creature
    if (s.sid === 'missile') {
      const tg = s.age > MISSILE_WAIT ? nearestFoe(S.foes, s.x, s.y, S.scroll, s.homeR || 400) : null;
      if (tg) steerTo(s, tg.x - S.scroll, tg.ty, MISSILE_TURN * dt);
    } else if ((s.homN || s.seekN || s.nearN) && !s.foe) trajHome(s, S.foes, S.scroll, dt);   // Homing / Seeker / Short-range (auto/traj.js)
    else if (s.homing && !s.foe) {
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
    if (s.follow && !s.beam && !s.heal && !s.vac) shotFollow(S, s, dt);   // Follow Me: pulled back to its caster (a field: fieldFollow)
    // the purple trajectory mods (auto/traj.js): round, across, back, and to and fro, by the caster
    let ex = 0, ey = 0;
    const path = hasTraj(s) && !s.beam && !s.heal;
    if (path) {
      const r = S.runners[s.by], home = r && !r.out ? { x: r.x + PW / 2, y: r.y + PH / 2 } : null;
      [ex, ey] = trajStep(s, dt, home);
      if (s.life <= 0) continue;   // a boomerang caught
    }
    if (s.flat) s.vy = 0;   // Horizontal Path: dead level whatever else turns it
    s.x += s.vx * dt + ex; s.y += s.vy * dt + ey; s.life -= dt; s.spin += dt * 10;
    trajTrail(s);
    if (s.pay && s.trig === 'timer' && s.age >= (s.timer || 0)) release(S, s);
    // each shot's own trail (auto/shotfx.js); the old flame specks for the shots it doesn't know
    keepTrail(s);
    // trails are looks only: their own random numbers (Math.random), so the run plays the same
    if (s.sid) { if (S.parts.length < TITLE_PARTS - FX_ROOM) for (const p of autoTrail(s, dt, Math.random)) S.parts.push(p); }
    if (s.pull && !s.foe) for (const a of holePull(s, S.foes, S.scroll, S.shots, dt, DEV.bhPull * s.pull / 70)) burst(S, a.x, a.y, 3, '#c58cff', 40, 'spark', 0.25);
    if (s.vac) { if (s.follow) fieldFollow(S, s, dt); vacPull(s, S.foes, S.scroll, S.shots, dt, VAC_PULL, S.coins, S.loot, S.runners); continue; }   // White Hole: hangs (with Follow Me: comes to its caster), pulls, hits nothing
    if (s.heal) { if (!S.hub) s.x -= sv(S) * dt; if (s.follow) fieldFollow(S, s, dt); vigourStep(S, s, dt); continue; }   // Circle of Vigour: stays on the ground, heals, hits nothing
    if (s.sid === 'zap' && S.zaps.length < 24) { const fk = zapFork(s, S.foes, S.scroll, dt, Math.random); if (fk) S.zaps.push({ pts: fk, t: 0.12, col: s.col }); }
    if (s.hopT) s.hopT = Math.max(0, s.hopT - dt);
    else if (s.look === 'flame' && S.rnd() < dt * 20) burst(S, s.x, s.y, 1, '#ff7a1a', 15, 'fire', 0.3);
    if (s.foe) {
      const hit = S.runners.find(ru => !ru.out && Math.abs(ru.x + PW / 2 - s.x) < 7 && Math.abs(ru.y + PH / 2 - s.y) < 11);
      if (hit) { s.life = 0; burst(S, s.x, s.y, 6, s.col, 60, 'spark', 0.25); snd(S, 'hit', s.x, s.y); if (S.lvl && S.lvl.hurt) S.lvl.hurt(S, hit.id, s.dmg); }
      else if (titleSolid(S, s.x, s.y)) { s.life = 0; burst(S, s.x, s.y, 4, s.col, 40, 'spark', 0.3); snd(S, 'fizzle', s.x, s.y); }
      continue;
    }
    for (const p of S.props) if ((p.k === 'lamp' || p.k === 'barrel') && !p.gone && (p.k === 'lamp' ? lampHit : cartHit)(p, s.x, s.y, s.size)) {
      if (p.k === 'lamp') popLamp(S, p); else cartBoom(S, p);
      if (!s.pierce) { s.life = 0; burst(S, s.x, s.y, 3, s.col, 50, 'spark', 0.2); }
    }
    if (s.life <= 0) { if (s.manaB) manaBurst(S, s); continue; }   // (a Mana Burst goes off however it ended)
    // Discriminate:Pn (owner, v1.0.71; the old game's bullets.js): once clear of the muzzle it hits player n (runner n - 1) through
    // the level's hurt (shields apply); in the hub and the gun preview there's no hurt: it passes through
    if (s.only && s.age > 0.12 && S.lvl && S.lvl.hurt) {
      const ru = S.runners.find(u => !u.out && matchesTarget(s.only, { kind: 'player', id: String(u.id + 1) })
        && Math.abs(u.x + PW / 2 - s.x) < 7 + s.size && Math.abs(u.y + PH / 2 - s.y) < 11 + s.size);
      if (ru && S.lvl.hurt) {
        burst(S, s.x, s.y, 6, s.col, 60, 'spark', 0.25); snd(S, 'hit', s.x, s.y);
        if (s.explode) shotEnd(S, s); else { s.life = 0; S.lvl.hurt(S, ru.id, s.dmg); }
        continue;
      }
    }
    for (const f of S.foes) {
      if (f.hp > 0 && Math.hypot(f.x - S.scroll - s.x, f.ty - s.y) < f.r + s.size && foeOk(s, f)) {
        hitFoe(S, f, s.real ? s.dmg : s.dmg * 1.5, s.col, s.by);
        if (s.trig === 'hit') { s.hitFoe = true; shotEnd(S, s); break; }
        snd(S, 'hit', s.x, s.y);
        if (s.fire) f.burn = Math.max(f.burn || 0, kr('fireBurn', S.rnd));
        // a chain bolt leaps on to the next creature
        if (s.chain && !s.explode) {
          let nx = null, nd = 80;
          for (const g of S.foes) { const d = Math.hypot(g.x - S.scroll - s.x, g.ty - s.y); if (g !== f && g.hp > 0 && d < nd) { nd = d; nx = g; } }
          if (nx) {
            s.chain--; const sp = Math.hypot(s.vx, s.vy) || 1, a = Math.atan2(nx.ty - s.y, nx.x - S.scroll - s.x);
            s.hopT = 0.14; s.hx = s.x; s.hy = s.y;   // the fast streak it leaves as it leaps (autolooks.js)
            s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp; s.x += s.vx * dt * 2; s.y += s.vy * dt * 2;
            zapArc(S, f.x - S.scroll, f.ty, nx.x - S.scroll, nx.ty, s.col); snd(S, 'chainhop', s.x, s.y); break;
          }
        }
        if (s.explode || s.pierce <= 0) { s.hitFoe = true; shotEnd(S, s); break; }
        s.pierce--;
      }
    }
    if (s.life <= 0) { if (s.manaB) manaBurst(S, s); continue; }
    if (titleSolid(S, s.x, s.y) && !(s.orbit && DEV.trOrbRock && s.oa != null) && !(s.boomer && DEV.trBoRock && s.back)) {
      // (owner v1.0.74) a Borer shot drills on through the rock (the old game's bullets.js rule): bounces don't stop it
      if (s.bore && !s.only) {
        titleCarve(S, s.x, s.y, s.bore * 0.7, false);
        if ((s.grindT = (s.grindT || 0) - dt) <= 0) { s.grindT = 0.12; snd(S, 'debris', s.x, s.y); if (S.parts.length < TITLE_PARTS) burst(S, s.x, s.y, 2, '#8a7a66', 40, 'spark', 0.25); }
      } else if (s.bounce > 0) {
        s.bounce--;
        snd(S, 'bounce', s.x, s.y);
        // back out and flip whichever way it came in
        s.x -= s.vx * dt; s.y -= s.vy * dt;
        if (titleSolid(S, s.x, s.y + s.vy * dt)) s.vy = -s.vy * s.bounceE; else s.vx = -s.vx * s.bounceE;
      } else shotEnd(S, s);
    } else if (s.life <= 0.02 && (s.explode || s.fire)) shotEnd(S, s);
  }
  for (const s of S.shots.slice()) if (s.pay && s.life <= 0) release(S, s);
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
    const fs = fireK(S), sp = kr('fireSpread', R) * fs, keep = [], n0 = S.fire.length;
    for (let k = 0; k < n0; k++) {
      const f = S.fire[k];
      if (f.c < S.gen - S.ncol || !FUEL[S.cells[ci(S, f.c, f.r)]]) { S.burning.delete(f.c * S.rows + f.r); continue; }   // carved away, or scrolled off
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (!dx && !dy) continue;
        const c = f.c + dx, r = f.r + dy;
        if (r < 0 || r >= S.rows || c < S.gen - S.ncol || c >= S.gen) continue;
        const kind = FUEL[S.cells[ci(S, c, r)]];
        if (kind && !S.burning.has(c * S.rows + r) && R() < sp * FIRE_UPW(dy) * (Math.max(Math.abs(dx), Math.abs(dy)) === 2 ? 0.3 : 1) * catchOf(kind)) light(S, c, r);
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
        if (p.burn || p.gone || !burns(p) || R() > fs) continue;
        if (p.arc) {
          const n = p.arc.length - 1;
          for (let k = 0; k <= n; k += 2) if (fireNear(S, p.ox + p.arc[k][0], p.y + p.arc[k][1], 2)) { catchArch(S, p, k / n); break; }
        } else if ((q++ & 3) === (S.fireN & 3)) {
          for (let yy = p.y + 2; yy < p.y + p.len; yy += 8) if (fireNear(S, p.ox, yy, 2)) { catchPlant(S, p); break; }
        }
      }
      for (const L of S.webs.slice()) if (!L.fu && R() < fs) for (let u = 0; u <= 1; u += 0.25) {
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
    // up from its tip (silk TITLE_WEBFIRE × faster), at TITLE_FIRESPEED × the game's (a CaveRunner Auto level: DEV.autoVineFire ×,
    // owner v1.0.50: it was too slow to see); a swinging one's tip where it hangs
    // (owner v1.0.61) silk has its own knobs in Auto's rules (Dev → Fire: webs (silk)); vines theirs
    const sk = autoOn(S) && p.st === 'silk';
    const vf = autoOn(S) ? DEV.autoVineFire : TITLE_FIRESPEED, rate = kr('firePlant', R) * vf * (p.st === 'silk' ? (autoOn(S) ? DEV.autoWebFire : TITLE_WEBFIRE) : 1);
    // Auto's level (owner v1.0.55: only the tip looked alight) three states along it: unburnt from the root to p.lit, burning
    // p.lit..p.ch (alight all along, drawn so: titledraw), charred and crumbling p.ch..p.len (DEV.autoVineAsh long), its end
    // falling away as ash; the title: burning at the tip, as ever (p.ch = p.len)
    const was = p.len;
    if (autoOn(S)) { p.ch = (p.ch ?? p.len) - rate * dt; p.len = Math.min(p.len, p.ch + (sk ? DEV.autoSilkAsh : DEV.autoVineAsh)); } else p.ch = p.len -= rate * dt;
    const top = Math.max(0, p.ch);
    // the flames run up ahead of it: the front climbing at DEV.autoVineSpread × the burn (the title: 1, only the tip); in a level
    // (owner v1.0.55: not so even) spurting and stalling by noise along it and in time, ± DEV.autoVineJitter
    const lit0 = p.lit ?? top, jit = autoOn(S) ? 1 + (sk ? DEV.autoSilkJitter : DEV.autoVineJitter) * (2 * titleNoise(lit0 * 0.12 + p.seed * 97, p.seed * 31 + S.t * 1.5) - 1) : 1;
    p.lit = Math.max(0, Math.min(top, lit0 - rate * (autoOn(S) ? (sk ? DEV.autoSilkSpread : DEV.autoVineSpread) * jit : 1) * dt));
    /** @type {any} */
    const pa = p;
    /** @param {number} k a point k along it from the root, world */
    const at = k => { const q = p.sw || p.tl ? vinePt(pa, Math.max(0, k)) : { x: 0, y: Math.max(0, k) }; return { x: p.ox + q.x, y: p.y + q.y }; };
    const T = at(top), F = at(p.lit), tx = T.x, ty = T.y, span = Math.max(0, top - p.lit);
    if (autoOn(S) && was > p.len && R() < dt * 25) { const q = at(p.len); burst(S, q.x - S.scroll, q.y, 1, R() < 0.3 ? '#ff7a2a' : '#2a201a', 15, 'chunk', 0.7); }
    for (let n = R() < dt * (30 + span * 1.5) * (sk ? DEV.autoSilkFlames : 1) ? 1 + Math.floor(span / 25) : 0; n > 0; n--) { const q = at(p.lit + R() * span); flameAt(S, q.x - S.scroll + (R() - 0.5) * 4, q.y); }
    // smoke along the burning stretch (silk: DEV.autoSilkSmoke puffs a second a strand, owner v1.0.61: it burns too short to smoke)
    if (R() < dt * (sk ? DEV.autoSilkSmoke : 4 + span * 0.2)) { const q = at(p.lit + R() * Math.max(1, span)); fireSmoke(S, q.x - S.scroll, q.y); }
    // (Auto's level, owner v1.0.53/55) the whole burning stretch lights what's beside it, sideways too: a point every 6 along it
    // (at most 16), jumping DEV.autoFireJump at autoFireJumpP a tick; the title: the tip and the front, as ever
    const pts = [T];
    if (span > 4) pts.push(F);
    if (autoOn(S) && span > 6) for (let k = 1, n = Math.min(16, Math.floor(span / 6)); k < n; k++) pts.push(at(p.lit + span * k / n));
    // (owner v1.0.56) its leaves as well (where art/props.js draws them: every 5 along, either side), at most 12
    if (autoOn(S) && LEAFY(p.st)) {
      const st = p.st === 'kelp' ? 7 : 5, k0 = 4 + Math.ceil(Math.max(0, p.lit - 4) / st) * st, n = Math.max(0, Math.floor((top - k0) / st) + 1), step = Math.max(1, Math.ceil(n / 12));
      for (let i = 0; i < n; i += step) { const k = k0 + i * st, q = at(k), s = ((k - 4) / st) % 2 ? -1 : 1; pts.push({ x: q.x + s * 2.5, y: q.y }); }
    }
    if (ticks) for (const E of pts) {
      if (autoOn(S)) lightArea(S, E.x, E.y, DEV.autoLeafReach, DEV.autoLeafLight);
      else if (E === T || E === F) lightArea(S, E.x, E.y, 5, 0.3 * fireK(S));
      if (sk) spreadFrom(S, E.x, E.y, DEV.autoSilkJump, DEV.autoSilkJumpP); else if (autoOn(S)) spreadFrom(S, E.x, E.y, DEV.autoFireJump, DEV.autoFireJumpP); else spreadFrom(S, E.x, E.y);
      for (const o of S.props) if (!o.burn && !o.gone && !o.arc && burns(o) && Math.abs(o.ox - E.x) < 10 && E.y > o.y - 4 && E.y < o.y + o.len + 4 && R() < (autoOn(S) ? DEV.autoVineCatch : 0.25 * Math.min(1, vf))) catchPlant(S, o);
    }
    // (Auto's rules, owner v1.0.57) now and then it burns right through somewhere along the burning stretch: the rest below
    // drops away, still burning, turning as it falls (DEV.autoBurnCut a fire tick, spin up to autoBurnSpin rad/s either way)
    if (autoOn(S) && ticks && !p.drop && span > 6 && p.len - p.lit > 8 && R() < 1 - Math.pow(1 - (sk ? DEV.autoSilkCut : DEV.autoBurnCut), ticks)) {
      const k = p.lit + 2 + R() * (span - 4), q = at(k), plen = p.len - k;
      /** @type {TProp} */
      const piece = { k: 'climb', st: p.st, ox: q.x, x: q.x - S.scroll, y: q.y, len: plen, seed: R(), side: 1, burn: 1, ac: p.ac, ar: p.ar,
        lit: 0, ch: Math.max(0, (p.ch ?? p.len) - k), drop: true, vy: 0, sw: 0, sj: 0 };
      // (owner v1.0.63: they fell as rigid sticks) a loose rope along where it hung, turning at first by the spin knob
      /** @type {{ x: number, y: number }[]} */
      const rope = [];
      for (let i = 0, n = Math.max(3, Math.min(16, Math.round(plen / 4))); i <= n; i++) rope.push(at(k + plen * i / n));
      ropeMake(piece, rope, (R() * 2 - 1) * (sk ? DEV.autoSilkSpin : DEV.autoBurnSpin), 1 / 30);
      S.props.push(piece);
      p.len = k; p.ch = Math.min(p.ch ?? k, k);
      snd(S, 'rustle', q.x - S.scroll, q.y, { st: p.st === 'silk' ? 'myc' : 'vine', v: 0.3 });
    }
    if (p.len < 3) { p.gone = true; lightArea(S, tx, ty, 6, 0.5); }
  }
  // a web line lit by hand (fu): it's cut there
  for (const L of S.webs.slice()) if (L.fu) cutWeb(S, L, (L.fu[0] + L.fu[1]) / 2, true);
}
// Auto's fire rules (vines alight all along, the knobs of Dev's Fire sim page): a level, or that page's room (S.lab, art/firelab.js)
/** @param {TitleScene} S */
export const autoOn = S => !!(S.lvl || S.lab);
// how fast fire spreads cell to cell and onto plants and webs: the title TITLE_FIRESPEED × the game's, a level DEV.autoFireSpread
/** @param {TitleScene} S */
const fireK = S => autoOn(S) ? DEV.autoFireSpread : TITLE_FIRESPEED;
// A burnt-off piece of vine or silk falling (owner v1.0.63: not a stick): a loose rope of points p.rp (world x, y), last frame's
// p.rq, links p.rs long. Gravity on every point, each link held to its length, a point stopped by rock (it slides a little):
// it falls, drapes over what's below and burns away there (stepFire: links past its length go as it shortens). The plant is
// drawn from it as a hanging tail is: root (ox, y) = its first point, p.tl the rest from there
/** @param {TProp} p @param {{ x: number, y: number }[]} pts along it, root first @param {number} spin a turn (rad/s) about its middle @param {number} dt */
function ropeMake(p, pts, spin, dt) {
  const mx = pts.reduce((a, q) => a + q.x, 0) / pts.length, my = pts.reduce((a, q) => a + q.y, 0) / pts.length;
  /** @type {number[]} */
  const P = [], Q = [];
  for (const q of pts) { P.push(q.x, q.y); Q.push(q.x + (q.y - my) * spin * dt, q.y - (q.x - mx) * spin * dt); }
  p.rp = P; p.rq = Q; p.rs = p.len / (pts.length - 1);
  ropeTail(p);
}
/** @param {TProp} p the plant's root and tail from its rope */
function ropeTail(p) {
  const P = p.rp || [];
  p.ox = P[0]; p.y = P[1];
  /** @type {number[]} */
  const tl = [];
  for (let i = 2; i < P.length; i += 2) tl.push(P[i] - P[0], P[i + 1] - P[1]);
  p.tl = tl; p.tq = tl.slice(); p.links = tl.length / 2;
}
/** @param {TitleScene} S @param {TProp} p @param {number} dt */
function ropeStep(S, p, dt) {
  const P = p.rp, Q = p.rq;
  if (!P || !Q) return;
  // burnt shorter: the links past its length go
  const n = Math.max(1, Math.min(P.length / 2 - 1, Math.ceil(p.len / (p.rs || 4) - 1e-6)));
  if (P.length > 2 * (n + 1)) { P.length = 2 * (n + 1); Q.length = 2 * (n + 1); }
  const seg = p.len / n, keep = Math.max(0, 1 - 1.2 * dt), g = GRAVITY * 0.5 * dt * dt;
  for (let i = 0; i < P.length; i += 2) {
    const vx = (P[i] - Q[i]) * keep, vy = (P[i + 1] - Q[i + 1]) * keep;
    Q[i] = P[i]; Q[i + 1] = P[i + 1];
    P[i] += vx; P[i + 1] += vy + g;
  }
  for (let it = 0; it < 4; it++) for (let i = 2; i < P.length; i += 2) {
    const dx = P[i] - P[i - 2], dy = P[i + 1] - P[i - 1], d = Math.hypot(dx, dy) || 1e-6, e = (d - seg) / d * 0.5;
    P[i] -= dx * e; P[i + 1] -= dy * e; P[i - 2] += dx * e; P[i - 1] += dy * e;
  }
  // rock: back up out of it, most of its speed lost (it lies there)
  for (let i = 0; i < P.length; i += 2) {
    if (!titleSolid(S, P[i] - S.scroll, P[i + 1])) continue;
    let y = P[i + 1];
    for (let k = 0; k < 10 && titleSolid(S, P[i] - S.scroll, y); k++) y -= 0.5;
    P[i + 1] = y; Q[i + 1] = y; Q[i] = P[i] - (P[i] - Q[i]) * 0.2;
  }
  ropeTail(p);
  p.x = p.ox - S.scroll;
}
// a burnt-through piece turning as it falls (rot about its middle): its lower end, screen x
/** @param {TProp} p */
export const titleTumbleLow = p => { const h = p.len / 2, s = Math.sin(p.rot || 0) * h, c = Math.cos(p.rot || 0) * h, e = c >= 0 ? 1 : -1; return { x: p.x - s * e, y: p.y + h + c * e }; };
// a hanging plant drawn with leaves either side of its stem (art/props.js drawProp; titledraw.js lights them)
/** @param {string} st */
export const LEAFY = st => !['silk', 'root', 'chain', 'myc', 'icefall'].includes(st);
// what the title's fire burns: the game's flammable plants, and cut silk
/** @param {TProp} p */
const burns = p => !!FLAMMABLE[p.st] || p.st === 'silk';

// Fire jumps across (owner, v0.0.164): a flame at world point (wx, y) lights any vine, arch or web line
// within TITLE_JUMP of it, at TITLE_JUMPP a fire tick
/** @param {TitleScene} S @param {number} wx @param {number} y @param {number} [J] how near @param {number} [P] the chance a tick */
function spreadFrom(S, wx, y, J = TITLE_JUMP, P = TITLE_JUMPP) {
  const R = S.rnd;
  for (const p of S.props) {
    if (p.burn || p.gone || !burns(p) || R() > P) continue;
    if (p.arc) { const k = archK(p, wx, y, J - 3); if (k >= 0) catchArch(S, p, k / (p.arc.length - 1)); }
    else if (Math.abs(p.ox - wx) < J + 1 && y > p.y - J && y < p.y + p.len + J) catchPlant(S, p);
  }
  for (const L of S.webs.slice()) {
    if (L.fu || R() > P) continue;
    for (let i = 0; i <= 8; i++) { const w = titleWebAt(L, i / 8); if (Math.hypot(w.x - wx, w.y - y) < J) { catchWeb(S, L, i / 8); break; } }
  }
}

// The title's camera (owner, v0.0.168): pinch to zoom (1 = the whole screen, up to TITLE_ZMAX), drag to pan,
// tap a player to follow them (tap again to let go); it never shows past the box seen at zoom 1: TITLE_VW
// across, the screen's top down to `by` (the menu's top). It zooms about the action band's middle (screen
// x TITLE_VW / 2, y `ay`), so a followed player sits there, between the title and the menu. x, y: the scene
// point at that middle (screen units, as the runners' x, y); lock: the followed player's id, -1 none;
// zt: a zoom it eases to (a lock zooms in to TITLE_ZLOCK)
export const TITLE_ZMAX = 4;
export const TITLE_ZLOCK = 2;
// w: the strip's width when wider than the screen (the hub), zmin: how far out it zooms (below 1: the whole strip)
// view: the screen's height when it shows less than the box (CaveRunner Auto's tall level with the UI open; default by);
// pack: follow the team's middle height (camPack) when nobody is locked
/** @typedef {{ z: number, x: number, y: number, lock: number, zt: number, ay: number, by: number, w?: number, zmin?: number, view?: number, pack?: boolean }} TitleCam */
/** @param {number} ay the band's middle @param {number} by the box's bottom (screen units) @returns {TitleCam} */
export const titleCam = (ay, by) => ({ z: 1, x: TITLE_VW / 2, y: ay, lock: -1, zt: 0, ay, by });
/** @param {TitleCam} C keep the view inside the box */
export function camClamp(C) {
  C.z = Math.max(C.zmin || 1, Math.min(TITLE_ZMAX, C.z));
  const hw = TITLE_VW / 2 / C.z, W = C.w || TITLE_VW;
  C.x = hw * 2 >= W ? W / 2 : Math.max(hw, Math.min(W - hw, C.x));
  const y0 = C.ay / C.z, y1 = C.by - ((C.view || C.by) - C.ay) / C.z;
  C.y = y0 > y1 ? (y0 + y1) / 2 : Math.max(y0, Math.min(y1, C.y));
}
// the scene point under a screen point (sx, sy in screen units: css px / the screen's scale)
/** @param {TitleCam} C @param {number} sx @param {number} sy */
export const camAt = (C, sx, sy) => ({ x: C.x + (sx - TITLE_VW / 2) / C.z, y: C.y + (sy - C.ay) / C.z });
// and back: a scene point (x on screen as drawn, y) to the view (TITLE_VW across; × the canvas width / TITLE_VW for css px)
/** @param {TitleCam} C @param {number} x @param {number} y */
export const camTo = (C, x, y) => ({ x: (x - C.x) * C.z + TITLE_VW / 2, y: (y - C.y) * C.z + C.ay });
// follow the locked player (eased), ease to zt
/** @param {TitleCam} C @param {TitleScene} S @param {number} dt */
export function camStep(C, S, dt) {
  const e = 1 - Math.exp(-8 * dt), r = C.lock >= 0 ? S.runners[C.lock] : null;
  if (C.zt) { C.z += (C.zt - C.z) * e; if (Math.abs(C.zt - C.z) < 0.01) { C.z = C.zt; C.zt = 0; } }
  if (r) { C.x += (r.x + PW / 2 - C.x) * e; C.y += (r.y + PH / 2 - C.y) * e; }
  else if (C.pack) { camPack(C, S, 1 - Math.exp(-3 * dt)); return; }
  camClamp(C);
}
// (CaveRunner Auto's tall level) ease the camera's y a fraction e toward the team's middle height (the living, shown
// runners; none shown yet: where they'll land; all fallen: the last to fall; none at all: the level's middle), kept inside the level
/** @param {TitleCam} C @param {TitleScene} S @param {number} e 0..1 (1: there at once) */
export function camPack(C, S, e) {
  // (owner v1.0.74) everyone down: the last one to fall (his ragdoll: deathRags keeps his box on its hip)
  /** @type {TRunner[]} */
  const last = [];
  for (const r of S.runners) if (r.out && (!last[0] || (r.outT || 0) >= (last[0].outT || 0))) last[0] = r;
  const up = S.runners.filter(r => !r.out), shown = up.filter(r => !r.hide), rs = shown.length ? shown : up.length ? up : last;
  const y = rs.length ? (Math.min(...rs.map(r => r.y)) + Math.max(...rs.map(r => r.y))) / 2 + PH / 2 : C.by / 2;
  C.y += (y - C.y) * e;
  camClamp(C);
}
// a tap at a scene point: on a player, follow them (or let go if it's the one followed); null: no player there
/** @param {TitleCam} C @param {TitleScene} S @param {number} x @param {number} y @param {number} reach how far off a tap still counts (screen units) */
export function camTap(C, S, x, y, reach) {
  let best = null, bd = Infinity;
  for (const r of S.runners) {
    const d = Math.hypot(r.x + PW / 2 - x, r.y + PH / 2 - y);
    if (d < PH / 2 + reach / C.z && d < bd) { bd = d; best = r; }
  }
  if (!best) return null;
  C.lock = C.lock === best.id ? -1 : best.id;
  if (C.lock >= 0 && C.z < TITLE_ZLOCK * 0.8) C.zt = TITLE_ZLOCK;
  return best;
}

// The big title: CAVE over RUNNER in the game's blocky pixel font, each letter bobbing on its own
// beat, a deep 3D extrusion, a hot gradient face, a glow, and a shine sweeping across now and then.
/** @param {CanvasRenderingContext2D} ctx @param {number} t seconds @param {number} cw css width @param {number} top css y of the title's top @param {number} [tagY] */
export function titleText(ctx, t, cw, top, tagY) {
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
      // the shine: a white band sweeping across the whole title
      const lx = (cx + pixWidth(c, px, 1) / 2) / cw;
      titleLetter(ctx, c, cx, cy, px, 1 - Math.abs(lx - shine) * 5);
      x += pixWidth(c, px, 1) + (1) * px;
    });
    y += 7 * ph + Math.ceil(px * 2.2);
  });
  // the tagline under it (tagY: lower, under the Grem lines, art/gremtitle.js)
  const ty = tagY === undefined ? titleBottom(cw, top) - 4 : tagY;
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
// One letter in the title's look (titleText; the auto level's LEVEL CLEARED, art/cleared.js): a deep extrusion
// down-right, the face yellow to orange to red down the letter with a glow, and sh (0-1; none at or below 0) of the
// white shine over it. (cx, cy) its baseline's left, px its pixel size
/** @param {CanvasRenderingContext2D} ctx @param {string} c @param {number} cx @param {number} cy @param {number} px @param {number} sh @param {boolean} [red] (Grem's boss title) */
export function titleLetter(ctx, c, cx, cy, px, sh, red = false) {
  const ph = px;
  for (let d = Math.ceil(px * 0.9); d > 0; d--) {
    ctx.fillStyle = d > px * 0.45 ? (red ? '#1a0206' : '#2a0610') : (red ? '#4a0610' : '#6a1220');
    pixText(ctx, c, cx + d * 0.5, cy + d, px, ph, 1, 8);
  }
  const g = ctx.createLinearGradient(0, cy - 7 * ph, 0, cy);
  // (Grem's boss title, owner v1.0.92: red) white-hot to blood red
  if (red) { g.addColorStop(0, '#ffe2e2'); g.addColorStop(0.35, '#ff5a5a'); g.addColorStop(0.7, '#e0182a'); g.addColorStop(1, '#8a0816'); }
  else { g.addColorStop(0, '#fff6b0'); g.addColorStop(0.35, '#ffd23a'); g.addColorStop(0.7, '#ff8a1f'); g.addColorStop(1, '#e8361a'); }
  ctx.shadowColor = red ? 'rgba(255,30,40,0.95)' : 'rgba(255,140,40,0.9)'; ctx.shadowBlur = px * 2.2;
  ctx.fillStyle = g;
  pixText(ctx, c, cx, cy, px, ph, 1, 8);
  ctx.shadowBlur = 0;
  if (sh > 0) { const a = ctx.globalAlpha; ctx.globalAlpha = a * sh * 0.8; ctx.fillStyle = '#ffffff'; pixText(ctx, c, cx, cy, px, ph, 1, 8); ctx.globalAlpha = a; }
}
// the title's pixel size, and where it and its tagline end (css px), for a screen cw wide
/** @param {number} cw */
export const titlePx = cw => Math.max(4, Math.floor(Math.min(cw * 0.92 / pixWidth('RUNNER', 1, 1), 15)));
/** @param {number} cw css width @param {number} top the title's top @returns {number} */
export const titleBottom = (cw, top) => top + titlePx(cw) * 16 + Math.ceil(titlePx(cw) * 2.2) + 20;
// RUNNER's left edge (css px): the Grem lines' AUTO lines up under it
/** @param {number} cw */
export const titleLeft = cw => (cw - pixWidth('RUNNER', titlePx(cw), 1)) / 2;

// ---- kept for the test suites (grem branch: the game no longer calls these; the suites set up with them) ----
export const titleOrbSettle = orbSettle;   // (the orbweb suite)
// a creature killed outright (the logic suites: auto-loot)
/** @param {TitleScene} S @param {Enemy} f */
export const titleKill = (S, f) => killFoe(S, f);
