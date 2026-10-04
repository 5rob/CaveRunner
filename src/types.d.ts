// The game's shared shapes, for the type check (tsconfig.json, REFACTOR.md Phase 4). Not code:
// esbuild never sees this file, and nothing here reaches index.html.
//
// Written from the real objects (the functions named on each), not from what they ought to be.
// A field a shape only sometimes has is optional (`?`). These are global: a checked file names
// them straight in JSDoc (`@param {Gun} g`), with no import.
//
// Where a shape is left loose on purpose (`any`, or an index signature) the comment says why.

// ---- small pieces ----

/** a point in world units */
interface Pt { x: number; y: number }
/** a spot nothing may be put on (portals, loot, rooms): a circle, world units or terrain px as the caller says */
interface Spot { x: number; y: number; r: number }
/** a random number source: Math.random, or a seeded one (0 <= n < 1) */
type Rnd = () => number;
/** an `ImageData`, or the stand-in tests/load.js gives the logic suites under Node */
interface Pixels { width: number; height: number; data: Uint8ClampedArray }
/** a level vending machine's screen: its hue and the lines cut out of the top box / written in the bottom one; deal: laid out as an offer, top [verb, "01"] and bot [price, ...fine print], the price sized to fit the text in deal (game/render/vend.js) */
interface VendLook { hue: string; top: string[]; bot: string[]; deal?: string }

// ---- spells and guns (spells/) ----

/** what a spell is: one entry of MODS (spells/mods.js). `kind` decides which fields matter */
interface Mod {
  id?: string;                // its key in MODS: always there, but filled in after the table
  name: string;
  kind: 'shot' | 'static' | 'mod' | 'util' | 'passive';
  glyph: string;
  col: string;
  mana: number;
  info: string;
  off?: number;               // kept, never handed out (the Greek letters)
  // a shot's or field's own numbers, copied onto the Shot by blankShot
  dmg?: number; speed?: number; spread?: number; delay?: number; size?: number; life?: number;
  count?: number; recoil?: number; grav?: number; drag?: number; pit?: number; bounce?: number;
  bounceE?: number; pierce?: number; accel?: number; vmax?: number; bore?: number; eat?: number;
  reach?: number; hidden?: number; explode?: number; lifeBoom?: number; knock?: number;
  homing?: number; homeR?: number; drift?: number; pop?: number; tele?: number; fire?: number;
  arc?: number; chain?: number; pull?: number; beam?: number; fuse?: number; wig?: number;
  embers?: number; look?: string; light?: string; lightR?: number;
  field?: string; r?: number; // a static: which field, and its radius
  // a modifier's effect on the shots after it, and what it does to the cast
  f?: (s: Shot) => void;
  d?: number;                 // cast delay it adds (a modifier's; a shot's own is `delay`)
  setDelay?: number;          // resets cast delay outright (Buzzsaw)
  multi?: number; myriad?: number; form?: number[]; copy?: string; addTrig?: TrigKind;
  manaMul?: number; hp?: number; act?: string;
  // what it does to the gun from anywhere on it (gunPassives)
  rech?: number; rechMul?: number; manaMax?: number; manaRegen?: number;
  auto?: number;              // passive: the gun fires on its own (Questions Later)
  // a trigger variant (TRIG_VARIANTS): its base spell, kind, how many casts it carries
  trig?: TrigKind; draw?: number; base?: string; mark?: string; timer?: number;
}
type TrigKind = 'hit' | 'timer' | 'expire';

/** a gun: makeGun / startingGuns (spells/guns.js), plus what casting and the save add */
interface Gun {
  name: string;
  lvl?: number;               // 1-10; the starter guns have none
  cap: number;                // slots
  castDelay: number; recharge: number;
  manaMax: number; manaRegen: number;
  spread: number; speedMul: number; multi: number; shuffle: boolean;
  slots: (string | null)[];   // mod ids, null for an empty slot
  boosted?: boolean;          // rolled by the gun machine's crystal reroll (spells/gunshop.js boostGun)
  hue?: number;               // its colour; a gun without one (an old save, a preview) hashes its name (gunHue)
  // Always there on a gun in play; optional only because the gun makers build the object
  // first and fill these in after (makeGun sets mana, resetGun the rest):
  mana?: number;
  idx?: number; order?: number[];   // where it is in its slot list, and the order it walks them
  delayT?: number; rechT?: number;  // cast delay and recharge counting down
  delayMax?: number;          // the cast delay last set (the right stick's ring)
  rechLen?: number;           // the recharge last started (the "ready" click)
  skipRech?: boolean;
  old?: boolean;              // swapped out on the ground: no "never held" glow
}

/** one shot out of the barrel: blankShot's fields (spells/cast.js), after the modifiers */
interface Shot {
  dmg: number; speed: number; spread: number; size: number; life: number; count: number;
  bounce: number; pierce: number; explode: number; grav: number; homing: number; accel: number;
  bore: number; recoil: number; col: string; knock: number; crit: number; boomer: number;
  spiral: number; pong: number; orbit: number; follow: number; autoaim: number; homeR: number; flat: number;
  eat: number; pull: number; split: number; cluster: number;
  bounceFx: any;              // a modifier's (unused today: always null)
  friendly: number; chain: number; fuse: number; beam: number;
  payload: Shot[] | null;     // a carrier's payload (planCast fills it)
  trig: TrigKind | null; timer: number; reach: number; hidden: number; drift: number; pop: number;
  arc: number; fire: number; tele: number; drag: number; bounceE: number; pit: number; wig: number;
  look: string | null; light: string | null; lightR: number; embers: number; vmax: number;
  lifeBoom: number;
  sid: string;                // the spell's id (its sound)
  still: number;              // 1 for a static (a field)
  field: string | null; r: number;
  ang?: number;               // a formation's angle (planCast, `form`)
}

/** what one pull of the trigger fires: planCast's return (spells/cast.js) */
interface Plan {
  shots: Shot[];
  defs: Mod[];                // the spells cast, in order
  start: number;              // g.idx before the pull
  cost: number;               // mana
  acts: string[];             // util acts to run
  hp: number;                 // health it costs
  delay: number;              // cast delay after it
  wrap: boolean;              // the gun ran out (recharge next)
}

// ---- creatures (data/creatures.js) ----

/** a creature type: one entry of CREATURES */
interface CreatureType {
  name: string; body: string; act: string;
  kp?: string;                // a reworked creature's Dev-knob prefix ('sp', 'je', 'ra')
  aggro?: number;
  col: { a: string; b: string; c: string; eye: string };
  glow?: string;              // 'r,g,b'
  hp: number; dmg: number; bspd: number; range: number; cd: number; gold: number; r: number; spd: number;
  shots?: number; tele?: number; noRoster?: number; fire?: number;
}
/** one creature's floor-scaled stats: enemyFor (data/creatures.js), carried as `e.k` */
interface CreatureKind {
  id: string; name: string; body: string; act: string;
  col: CreatureType['col'];
  hp: number; dmg: number; bspd: number; gold: number; range: number; cd: number;
  tele: number; shots: number; r: number; spd: number; aggro: number;
  kp: string | null; glow: string | null;
  elite?: boolean;            // an elite (eliteOf): boosted, tinted, drops gold and red and green crystals
  eu?: number; r0?: number; col0?: CreatureType['col']; tintKey?: string;   // an elite: its roll, its kind's size and colours, the tint it has
  // no `fire`: enemyFor doesn't copy CreatureType's (REFACTOR.md, Found along the way)
}

/** a creature in the level: makeLevel's enemies, then the enemy loop's own fields */
interface Enemy {
  x: number; y: number; ty: number; r: number; phase: number;
  wox?: number; woy?: number;   // a spider on a web line: the sag and bend it rides (game/creatures/spider.js)
  hp: number; hpMax: number; cd: number; flash: number;
  lx: number; ly: number; hx: number; hy: number;
  tgt: Pt | null; rest: number; touch: number; charge: number;
  fxAcc?: number; fxPx?: number; fxPy?: number;   // an elite's flames: specks owed, where it was last frame
  k: CreatureKind;
  nest?: NestState;           // a rat nest
  sid?: number;               // its index on the floor (the autosave)
  // the reworked creatures' brains, on the creature (made on their first step)
  sp?: SpiderBrain; je?: JellyBrain; ra?: RatBrain;
  aggro?: boolean; aggroT?: number; aggroM?: number; spotted?: boolean;
  dead?: boolean; chill?: number; burn?: number; burnAcc?: number; fuseT?: number;
  // a rat's jobs and fallbacks
  home?: Enemy; carry?: number; giveUp?: number; bestD?: number; bestT?: number;
  roam?: RoamState; path?: Pt[]; smell?: number; arrive?: number;
  jobO?: object;              // what it was last heading for (its nest, a coin, W.navYou): progress is judged per job
  stN?: number; stT?: number; stX?: number; stY?: number; rockT?: number;
  silkT?: number; silkR?: number; spread?: number;
}
/** is terrain cell (cx, cy) rock? (truthy: rock). What the pure movement code is handed */
type SolidCell = (cx: number, cy: number) => unknown;
/** a creature's colours (CreatureType['col']) */
type CreatureCol = CreatureType['col'];

/** the roam spot a brain carries (roamStep, creatures/common.js): made on its first call */
interface RoamState { rx?: number; ry?: number; ra?: number; roamR?: number; roamSpd?: number }
/** a surface crawler's seat (surfSeat): the smoothed normal, and straight out from the nearest rock */
interface SurfState { nx: number; ny: number; py?: number }

/** a spider's web line (spiderStep pushes it onto W.webs): it rides a..b, draws a0..b0 */
interface WebLine {
  ax: number; ay: number; bx: number; by: number;
  a0x: number; a0y: number; b0x: number; b0y: number;
  ain: Pt | null; bin: Pt;    // points inside the rock at each end: dig one out and the line comes down
  owner: Enemy;
  // rolled once per line when you first touch it (decorStep)
  slow?: number; grab?: number; climb?: number;
  // giving (world/sway.js): its sag at rest, its bend (wx, wy) peaking at wu, the bend's speed, held last frame
  sag?: number; wx?: number; wy?: number; wvx?: number; wvy?: number; wu?: number; wh?: boolean;
}
/** a line being shot (e.sp.shot) */
interface SpiderShot {
  spd: number; x: number; y: number; dx: number; dy: number; len: number; t: number;
  from: 'surf' | 'line'; ax0: number; ay0: number; ain: Pt | null;
}
/** the spider's brain, `e.sp` (spiderStep, creatures/spider.js) */
interface SpiderBrain extends RoamState, SurfState {
  mode: string;               // 'fall' | 'surf' | 'line' | 'shoot' (a string: decide() changes it under a narrowed check)
  vy: number; on: number; rest: number; side: number;
  line: WebLine | null; u: number; dir: number; shot: SpiderShot | null; high: boolean;
  webT?: number; spd?: number; arrive?: number; dot?: number; go?: boolean;
}
/** what spiderStep is handed */
interface SpiderEnv {
  solidCell: SolidCell; webs: WebLine[]; goal: Pt; hunting: boolean; rnd: Rnd;
  speed?: number; reach?: number; speedMul?: number;
}
/** the rat's brain, `e.ra` (ratStep, creatures/rat.js) */
interface RatBrain extends SurfState {
  mode: 'air' | 'surf' | 'path' | 'tunnel';
  vx: number; vy: number; on: number; rest: number; side: number; face: number;
  s: number; dir: number; wait: number;   // tunnel mode: how far along the nest path, which way, a pause
  len?: number; noT?: number; noSide?: number; blockT?: number;
  spd?: number; arrive?: number; dot?: number; high?: boolean;
}
/** what ratStep is handed */
interface RatEnv {
  solidCell: SolidCell; rnd: Rnd; goal: Pt | null; path: Pt[] | null;
  home?: boolean; hunting?: boolean; follow?: boolean; air?: boolean; jump?: boolean;
  arrive?: number; speed?: number; speedMul?: number;
  onWeb?: ((x: number, y: number) => unknown) | null;
}
/** a jelly's looks, rolled once as fractions of their knob ranges (kru) */
interface JellyLooks { thin: number; sq: number; len: number; wave: number; sag: number; glow: number; glowR: number; flare: number; col: number; plant: number }
/** the jelly's brain, `e.je` (jellyStep, creatures/jelly.js) */
interface JellyBrain extends RoamState {
  hd: number;                 // heading: where its head points
  vx: number; vy: number; push: number; pushA: number; rest: number;
  shape: number;              // the bell: 0 flat .. 1 thin
  vref: number; t: number;
  tent: Pt[][];               // tentacles, world points from the rim out
  u: JellyLooks;
  turn?: number; tol?: number; drag?: number; sink?: number; bounce?: number; aimTol?: number;
  range?: number; inRange?: boolean; aimed?: boolean;
}
/** what jellyStep is handed */
interface JellyEnv {
  solidCell: SolidCell; rnd: Rnd; goal: Pt | null; hunting: boolean;
  speedMul?: number; rangeMul?: number; stay?: ((x: number, y: number) => boolean) | null;
}

/** a nest's state, `e.nest` (made in makeLevel from a ratNests entry) */
interface NestState {
  path: Pt[]; mouth: Pt; built: boolean;
  t: number;                  // until it may let the next rat out
  stash: number;              // gold carried home
  max: number; wake?: number; // rats out at once, and how near you wake it (rolled from the knobs)
  left: number;               // rats still inside, to come out (a fixed brood: the count only goes down)
}

// ---- perks (data/perks.js) ----

/** a perk: one entry of PERKS. Its numbers fold into a PerkBag */
interface Perk extends Partial<Omit<PerkBag, 'maxHp'>> {   // dmg, speed, shield, …: the bag fields it moves
  name: string; glyph: string; tint: string; info: string;
  stat?: string; tier?: number;   // a stat perk (STAT_PERKS): which stat, and its level 1-5
}
/** every perk you own folded into one bag: perkBag (data/perks.js), W.pb */
interface PerkBag {
  dmg: number; speed: number; spread: number; bounce: number; recoil: number; crit: number;
  mana: number; delay: number; rech: number; walk: number; jet: number; hpMul: number;
  hpAdd: number; heal: number; gold: number; goldPull: number; shield: number; lives: number;
  ghost: number; homing: number; trail: number; contact: number; close: number; invis: number;
  repel: number; seeAll: number; radarEnemy: number; radarItem: number; radarWand: number;
  tinker: number; extraItem: number; pinpointer: number; trajectory: number;
  carrot: number;   // the Carrot stat's level, 0-5 (carrotAt turns it into each multiplier)
  fuel: number; refuel: number;   // the jetpack's tank (drains slower) and how fast it refills (stat perks)
  // always there on a bag perkBag returns; optional only because it is filled in after the rest
  maxHp?: number;
}

// ---- the level (world/) ----

/** a decoration prop (world/decorate.js): never in `mat`, it acts by box overlap */
interface Prop {
  id: string;                 // its DECOR entry
  k: string;                  // kind: 'climb', 'lamp', 'cover', 'drop', 'vent', …
  st: string;                 // style: 'vine', 'lantern', 'cart', …
  x: number; y: number; t: number; seed: number;
  l: number; t0: number; r: number; b: number;   // its box about x, y
  hang: number;
  anc?: number[];             // the rock cell it hangs on (propAnchored)
  anc2?: number[];            // an arch's second anchor
  len?: number; side?: number;
  arc?: number[][]; thick?: number; alen?: number;   // an arched vine: its curve as [x, y] from x, y
  on?: Prop; u?: number;      // a strand on an arch, and where along it
  u0?: number; u1?: number;   // an arch burning: the burnt stretch (catchArch)
  // what the game adds as it plays (decorStep, fire, drips)
  fall?: boolean; vy?: number; gone?: boolean; burn?: number; hp?: number; hitT?: number;
  acc?: number; dn?: number; di?: number; cd?: number; ecd?: number; shake?: number;
  warn?: boolean; ring?: number; heard?: number; hurt?: number; hs?: number; sq?: number;
  stand?: number; grab?: number; ang?: number; aimA?: number; ext?: number;
  climb?: number;             // an arch: its climbing speed, rolled when you first hang on it
  // giving (world/sway.js): an arch's bend (as a WebLine's), a hanging vine's swing angle and speed
  wx?: number; wy?: number; wvx?: number; wvy?: number; wu?: number; wh?: boolean; sw?: number; swv?: number;
  sj?: number; tl?: number[]; tq?: number[];   // a swung vine's joint depth and its tail's link ends (now, last step)
}

/** a thing on the ground: a mod, a gun, a heart */
interface Pickup {
  kind: 'mod' | 'gun' | 'heart' | 'perk' | 'heal' | 'crystal';
  floor?: number;             // a red crystal: the floor it came from (its unlock's drop table)
  green?: boolean;            // a crystal: a green one (an elite's drop; the perk machine's currency)
  vx?: number; vy?: number;   // popping out of a vending machine's chute (game/systems/shops.js) until it lands
  x: number; y: number; t: number;
  id?: string;                // a mod's or perk's id
  gun?: Gun;
  taken?: boolean; old?: boolean;
  cool?: number;              // just dropped or swapped: not takeable yet
  nopull?: number;            // a crystal: seconds before it may fly to you (an elite's pile, SPILL_WAIT)
  fly?: boolean; fvy?: number; // a crystal flying into its machine (fvy: its upward speed)
  a?: number; ground?: number; // a crystal: its turn as it rolls, resting on rock (world/nuggets.js)
  into?: string;              // a crystal: the SHOPS machine sucking it in
  hold?: number;              // a crystal: seconds left of a White Hole's grip (no gravity meanwhile)
}
/** a shop plinth (makeLevel's stock) */
interface StockItem { kind: string; x: number; y: number; price: number; sold: boolean; id?: string; gun?: Gun; bought?: number /* the heal: times bought this floor */ }
/** a hidden prize room */
interface Room { kind: string; id?: string; x: number; y: number; taken: boolean; built: boolean }
/** a rat nest as ratNests makes it (world/nests.js) */
interface NestSpot {
  x: number; y: number; r: number; path: Pt[]; mouth: Pt; built: boolean;
  mound: number[]; nx: number; ny: number;   // mound: the terrain pixels of earth at the mouth
}

/** an old working (strataCave): a levelled stretch of corridor, x0..x1 at floor row fy (terrain px) */
interface Working { ci: number; x0: number; x1: number; fy: number; cy: number }
/** a floor's palette: one entry of THEMES (data/themes.js) */
type Theme = (typeof import('./data/themes.js').THEMES)[number];
/** the level's seeded 2D noise (makeLevel's vn / fbm), 0..1 */
type Noise2 = (x: number, y: number) => number;

/** a new floor: makeLevel's return (world/level.js) */
interface Level {
  mat: Uint8Array;            // per terrain cell: open or which rock
  img: ImageData; bgImg: ImageData; dimg: ImageData;   // made with new ImageData (a stand-in under Node: tests/load.js)
  ore: Uint8Array; fuel: Uint8Array;
  props: Prop[];
  amb: string[];              // the theme's ambience particle kinds
  start: Pt;
  portal: { x: number; y: number; w: number; h: number };   // the middle exit (portals[1])
  portals: { x: number; y: number; w: number; h: number }[];   // the exits along the top, left to right (EXIT_X)
  arrival: Pt;
  enemies: Enemy[]; pickups: Pickup[]; stock: StockItem[]; rooms: Room[];
  shopExit: number;
  roster: string[];
  theme: string;              // the palette's name
  works: Working[];
  zone: Uint8Array | null;    // built-up vs natural, floor 1 only
  nests: NestSpot[];
}

/** the fire's state: fireNew (world/fire.js) */
interface FireState { fuel: Uint8Array; t: Uint16Array; list: number[]; acc: number }

// ---- the run (save/save.js, ui/app.js) ----

/** what you carry: App's loadout (`LO` in step), and what the save keeps */
interface Loadout {
  guns: (Gun | null)[];       // four slots
  sel: number;                // the held one
  bag: string[];              // mod ids not on a gun
  perks: string[];            // perks carried, not fitted (the Bag's Exo Suit tab)
  suit?: (string | null)[];   // the Exo Suit's SUIT_SLOTS: the perks that count (activePerks)
  perksOff?: number[];        // before the suit: places in `perks` switched off (cleanPerks reads it once)
  greens?: number[];          // green crystals carried: the floor each came from (the perk machine)
  gold: number;
  debt?: number;              // owed to the company for the level you're on (game/systems/vend.js)
  due?: number;               // when it must be repaid: Date.now() ms, the device's clock (0 = no debt)
  soldTop?: number;           // the highest floor sold this run: floors up to one above it are for sale (data/levels.js)
  maxBonus: number;           // the +25 hearts: raises max health only
  usedLives: number;
  gunShop?: GunOffer;         // the gun machine's offer on this floor (spells/gunshop.js)
  crystals?: number[];        // red crystals carried: the floor each came from (game/systems/shops.js)
  fed?: string[];             // the crystal machines a real crystal has gone into this run (SHOPS keys): no more demo there
  debug: boolean;             // Dev → All mods
}
/** the gun machine's offer (spells/gunshop.js): a sold gun is null; the reroll counts are this floor's */
interface GunOffer { floor: number; guns: (Gun | null)[]; rerolls: number; boosts: number }
/** a save read back: readSave (save/save.js) */
interface SaveData {
  loadout: Loadout; floor: number; hp: number | null;
  hasLvl: boolean;            // is the floor's level bought (v106; older saves: true)
  level: SavedLevel | null;   // the exact cave, only on the same version
}
/** the cave part of a save */
interface SavedLevel {
  seed: number; owned: string[]; alive: number[] | null; sold: number[]; rooms: number[]; heals?: number;
  brood?: [number, number][];  // each nest's sid and the rats it still holds (its rats out go back in)
  pickups: Pickup[] | null;
  pins?: MapPin[];            // the map's pins (v0.0.141)
}

// ---- the Dev panel (dev/knobs.js) ----

/**
 * DEV: the live knob values. The fixed ones are named; the range and colour tables add
 * `<key>Lo` / `<key>Hi` pairs by the hundred (numbers, or '#rrggbb' for colours), so the
 * rest are an index signature: `any`, since TS can't tell a range key from a colour key.
 */
interface DevKnobs {
  zoom: number; torch: number; fogDark: number; fogDim: number; move: number; sputDip: number;
  aggro: number; loseAggro: number; aimDist: number; bhPull: number; bhSpeed: number;
  vol: number; amb: number; jetVol: number; vSpell: number; vBoom: number; vHit: number;
  vEnemy: number; vEnemyFire: number; vWorld: number; vDrip: number; vStep: number; vUi: number;
  bagSpeed: number;
  witPad: number; witKbps: number;
  holoAlpha: number; bloom: number; bloomBlur: number; bloomBright: number;
  holoMin: number; holoMax: number; holoFade: number; holoC1x: number; holoC1y: number; holoC2x: number; holoC2y: number;
  guideCps: number; guideWait: number; guideIn: number; shopGap: number; shopTorch: number;
  due1: number; enemies: number; enemiesUp: number; lvlBonus: number; lvlGrow: number; rewardGrow: number; killGrow: number; runnerPx: number; runnerLine: number;
  ptrStart: number; ptrReach: number; ptrSize: number; ptrLine: number; snapR: number; snapPull: number; snapHit: number;
  [k: string]: any;
}
/** one Dev panel row (DEV_META) */
interface DevRow { k: string; g: string; label: string; min?: number; max?: number; step?: number; type?: 'color' | 'slider' | 'curve' | 'grad' | 'ramp' }

// ---- the game (game/, layer 5) ----

/**
 * a shot in flight: spawnShot (game/systems/gun.js) makes the whole thing from a Shot; a cluster's
 * pellets (spray) and the Angry Ghost's shots are pushed with only the first block, so the rest is
 * optional (the bullet loop reads a missing one as 0 / off)
 */
interface Bullet {
  x: number; y: number; vx: number; vy: number;
  life: number; dmg: number; size: number; col: string; spin: number;
  homing: number; bounce: number; pierce: number; explode: number; grav: number; accel: number;
  bore: number; hit: Set<Enemy> | null; age: number;   // hit: what it has already struck (pierce)
  // spawnShot's (the ghost's shots have knock, crit and born too)
  knock?: number; crit?: number; boomer?: number; spiral?: number;
  pong?: number; orbit?: number; follow?: number; anc?: Anchor | null; homeR?: number; eat?: number; pull?: number; split?: number;
  cluster?: number; bounceFx?: any; friendly?: number; chain?: number; fuse?: number;
  payload?: Shot[] | null; hidden?: number; arc?: number; drift?: number; pop?: number; tele?: number;
  fire?: number; drag?: number; bounceE?: number; pit?: number; wig?: number; look?: string | null;
  light?: string | null; lightR?: number; vmax?: number; lifeBoom?: number;
  trig?: TrigKind | null; timer?: number | null;
  ox?: number; oy?: number; born?: number;
  // set as it flies
  ang?: number; struck?: number; propHit?: Set<Prop>; lock?: Enemy | null; arcT?: number;
  ax?: number; ay?: number; da?: number; grind?: number; trail?: Pt[];
  back?: number; pdir?: number; oa?: number; or0?: number; osp?: number; caught?: number;   // its path (spells/paths.js)
}

/** a sound loop (SFX.loop): set it every frame or it fades */
type SoundLoop = ReturnType<typeof import('./audio/sfx.js').SFX.loop>;
/** a way-finding field kept on something the rats head for (navFor, game/creatures/rat.js) */
interface NavCache {
  F?: import('./world/nav.js').NavField;
  v?: number; fx?: number; fy?: number; t?: number; wn?: number;   // what it was made for
}

/**
 * a particle in one of the grab-bag lists (smoke, sparks, torchP, motes, dparts, amb, burns):
 * each is pushed in a dozen places with its own extras (a kind, a colour, a drip's sound,
 * a spore's kick…), so past the common fields it's an index signature: `any`.
 */
interface Particle {
  x: number; y: number; vx?: number; vy?: number; life?: number; max?: number;
  [k: string]: any;
}
/** a creature's shot (fireEnemyShot, a jelly's spit): the common fields, plus a spit's look */
interface EnemyShot {
  x: number; y: number; vx: number; vy: number; life: number; col: string; dmg: number; size: number;
  fire?: number;              // always undefined today (Found along the way: Stendari)
  edge?: string; shine?: string; dripCol?: string; dripCol2?: string; glow?: string;
  goo?: number; drip?: number; da?: number; dripG?: number; splat?: number; splatV?: number;
}
/** a static field (castField, game/systems/fields.js) */
interface Field {
  x: number; y: number; r: number; field: string; life: number; max: number;
  col: string; dmg: number; tick: number; payload: Shot[] | null; ang: number; trig: TrigKind | null;
  near?: boolean;             // a mine: a creature close (it blinks faster)
  dT?: number;                // Stillness, a storm: until they next douse the fire under them
  mAcc?: number;              // a White Hole: motes owed
  // moving (a path mod on it, spells/paths.js): as a Mover, plus what an orbit circles
  still?: number; age: number; born?: number; vx: number; vy: number;
  boomer?: number; pong?: number; spiral?: number; orbit?: number; follow?: number; homing?: number; homeR?: number;
  back?: number; pdir?: number; oa?: number; or0?: number; osp?: number; caught?: number; anc?: Anchor | null;
}
/** a gradient's stop and a ramp's control point (art/ramps.js) */
interface GradStop { t: number; c: string }
interface RampPt { x: number; y: number }
/** the path mods a shot or field can carry (spells/paths.js) */
interface PathMods { boomer?: number; pong?: number; spiral?: number; orbit?: number; follow?: number; homing?: number; still?: number }
/** anything pathStep moves: a shot, a field, the aim line's pretend shot; the rest is its path state */
interface Mover extends PathMods {
  x: number; y: number; vx: number; vy: number; age: number; born?: number; life?: number; homeR?: number; ang?: number;
  back?: number; pdir?: number; oa?: number; or0?: number; osp?: number; caught?: number;
}
/** what an orbit circles: a trigger's carrier while it lasts (of), then where it had got to, drifting on */
interface Anchor { x: number; y: number; vx: number; vy: number; of: Bullet | Field | null }
/** the world a path reads (pathEnv in game/systems/fields.js, or tracePath's own) */
interface PathEnv { home: Pt; ahead: Pt; anchor: Pt | null; enemies?: { x: number, ty: number }[] }
/** an instant beam streak */
interface Beam { x: number; y: number; nx: number; ny: number; len: number; col: string; w: number; t: number; look: string | null }
/** a lightning fork (addArc) */
interface Arc { pts: Pt[]; col: string; w: number; t: number; max: number }
/** a new run's shop lights (world/shoplights.js): start = W.time on arrival, on = when each section's tubes switched on (-1 not yet), zap = the next crackle sound's time */
interface ShopLights { start: number; on: number[]; zap: number }
/** a new run's guide hologram (world/guide.js): its state and t seconds in it, x where it appeared (cam0: the camera's left edge then: it slides with the hologram layer), the box it's on (page, say), gifts handed out, and the light section it holds the hall at */
interface Guide { st: 'wait' | 'appear' | 'wave' | 'talk' | 'give' | 'rude' | 'leave' | 'gone'; t: number; x: number; cam0: number; page: number; say: string; gift: number; hold: number }
/** a pin dropped on the map (ui/map.js): where, and its emoji */
interface MapPin { x: number; y: number; e: string }
/** gold on the ground */
/** anything world/nuggets.js moves: gold, and crystals (v0.0.138) */
interface Nug { x: number; y: number; vx?: number; vy?: number; t?: number; a?: number; ground?: number; fly?: boolean; amount?: number }
interface Coin {
  x: number; y: number; amount: number; t: number;
  vx?: number; vy?: number; pop?: number; nopull?: number;
  a?: number; ground?: number; fly?: boolean;   // world/nuggets.js: its turn, resting on rock, being pulled to you
}
/** a line at the bottom of the view */
interface Toast { text: string; t: number }
/** a blast's flash */
interface Flash { x: number; y: number; r: number; t: number }
/** a spore cloud (a pod popping) */
interface Cloud { x: number; y: number; r: number; life: number; max: number; tick: number }
/** a noise ring (skulls, stones) */
interface Ring { x: number; y: number; t: number }
/** a dust devil */
interface Devil { x: number; y: number; vx: number; life: number; max: number; snd?: number }
/** a spider string in flight at you */
interface Silk { x: number; y: number; ax: number; ay: number; vx: number; vy: number; life: number }
/** a spider string stuck to you: anchored at (ax, ay), held at (ox, oy) off you */
interface SilkString { ax: number; ay: number; ox: number; oy: number; slow: number; max: number }
/** a wall torch */
interface Sconce { x: number; y: number; ph: number }
/** the Angry Ghost companion */
interface Ghost { x: number; y: number; cd: number }
/** what the props did to you this frame (decorStep), read by next frame's steering */
interface Zfx {
  slow: number; slick: number; climb: Prop | WebLine | null; rev: number; web: WebLine | null; webs: number; webMul: number;
  arch?: Prop | null; surface?: string;
}

/** the live level, `W`: makeWorld (game/world.js). enterLevel refills the floor's parts */
/** the level teleporting in (bought) or out (sold): game/systems/vend.js */
interface Warp {
  dir: 'in' | 'out' | 'repo'; t: number; done: boolean;   // done: the swap (at WARP_SWAP) has happened
  wait?: number;              // arriving: how long the dark has held for the worker's level (WARP_WAIT)
  bolts: { pts: Pt[]; t: number; max: number }[];     // the crackle over the shop roof
}
interface World {
  p: Player;
  pb: PerkBag;
  ghost: Ghost | null;
  zfx: Zfx;
  time: number; levelT: number; best: number;
  camX: number; camY: number; camReady: boolean; camT: number; unitPx: number; viewW: number; viewH: number;
  flick: number; torchR: number; visPts: number[]; leanX: number; leanY: number; glowN: number;
  mat: Uint8Array; img: ImageData; dimg: ImageData; ore: Uint8Array; burrow: Uint8Array | null; terrainV: number;
  floor: number;
  hasLvl: boolean; warp: Warp | null;
  padZap: Record<number, number>;   // when each teleporter pad (padSpots seed) was last used: it crackles a moment (render/pads.js)
  reveal: number;             // a bought level's rock is drawn onto its canvas down to this row so far (0: all of it): vend.js stepReveal
  machines: Record<string, { n: number, t: number }>;   // the crystal machines (game/systems/shops.js): crystals in, and the shake (t, -1 idle)
  demo: Record<string, { t: number, side: number }>;    // a crystal machine's hologram demo while you're near (stepDemo): t into it, the side its crystal shows on
  shopLit: ShopLights | null;   // a new run's dark shop lighting up a section at a time (world/shoplights.js); null = all lit
  guide: Guide | null;        // a new run's guide hologram (world/guide.js); null: none this floor
  pins: MapPin[];             // the pins dropped on this floor's map (ui/map.js)
  repo: { t: number; hurtT: number; sndT: number } | null;   // the deadline passed: repossession, then the fire (vend.js)
  start: Pt; portal: Level['portal']; portals: Level['portals']; arrival: Pt; stock: StockItem[];
  zone: Uint8Array | null; rooms: Room[];
  sconces: any[];             // Sconce[]: enterLevel builds [x, y] pairs first and maps them after
  levelSeed: number; levelOwned: string[]; roster: string[]; themeName: string; total: number;
  matterProps: Prop[]; ambKinds: string[]; plantW: number;
  enemies: Enemy[]; pickups: Pickup[]; props: Prop[];
  seen: Uint8Array; deepFog: Uint8Array | null;
  fire: FireState;
  firePlants: Prop[]; fireArches: Prop[]; fireCarts: Prop[];
  firePropN: number; firePropLast: Prop | null; fireLoop: SoundLoop; fireN: number; fireVis: number[];
  bullets: Bullet[]; enemyShots: EnemyShot[]; fields: Field[]; beams: Beam[]; arcs: Arc[]; coins: Coin[];
  toasts: Toast[]; smoke: Particle[]; sparks: Particle[]; flashes: Flash[]; torchP: Particle[]; eliteFx: Particle[]; motes: Particle[];
  burns: Particle[]; webs: WebLine[]; silk: Silk[]; strings: SilkString[];
  dparts: Particle[]; amb: Particle[]; clouds: Cloud[]; rings: Ring[]; devils: Devil[];
  jetLoop: SoundLoop; beatT: number; wasEmpty: boolean;
  jetSt: { cut: number; onT: number; start: boolean; gap?: number };
  bhLoops: Map<Bullet, SoundLoop>;
  portalLoop: SoundLoop; matterLoop: SoundLoop; wasJet: boolean;
  stepT: number; lastNear: string | number; portalAcc: number;
  leanVX: number; leanVY: number; flickN: number; torchT: number; torchAcc: number; smokeAcc: number;
  webCheck: number; webLetGo: number;
  plantsNow: Set<Prop>; plantsLast: Set<Prop>; rustle: { t: number };
  decoFrame: number; dripHurt: number; oreBank: number;
  navYou: NavCache;
}
/** you: W.p */
interface Player {
  x: number; y: number; vx: number; vy: number; onGround: boolean; face: number; jet: number;
  fuel: number; empty: boolean; sput: boolean; flame: number; cough: number; hp: number; hitT: number;
  dead: boolean; kick: number; shieldReady: boolean; shieldT: number; jx: number; jy: number;
  aim: { on: boolean; show: boolean; nx: number; ny: number; vis?: number };   // vis: the aim line's fade with the push
  burn?: number; burnAcc?: number;
  swing?: number;   // 1 while you swing on a hanging vine this frame (movePlayer): the vine follows you
  rag?: import('./world/ragdoll.js').Ragdoll | null;   // dead: the body (corpseStep)
}

/** one thumbstick's state, written by the Stick (ui/hud.js), read by step */
interface StickState { active: boolean; nx: number; ny: number; mag: number; dy: number; on: boolean;
  cx?: number; cy?: number; size?: number;   // where the stick sits on screen (css px), for the menus' pointer (useMenuNav)
}
/** the gauges draw() hands the sticks each frame (all 0..1) */
interface Hud { hp: number; low: boolean; fuel: number; empty: boolean; mana: number; rech: number; cast: number; recharging: boolean; hasGun: boolean }
/** what the pickup panel shows (pickups.js): the item near you */
interface Prompt {
  text: string; price: number; can: boolean;
  id?: string; gun?: Gun; perk?: string; heart?: boolean; found?: boolean;
  crystal?: number;           // a red crystal: the floor it came from
  green?: number;             // a green crystal (the hidden room's prize): the floor it came from
  shop?: string;              // a vending machine's menu (SHOPS key): no card, just the line
}
/** the death replay's span, once recorded: from t0 to t1, the death at `death` (REC's clock): the clip itself */
type Witness = Clip;
/** a death replay to play (systems/recorder.js drawReplay): the live one (REC's own arrays) or a saved one
 * blown back up (replay/clip.js clipHydrate), which brings its floor (`scene`), camera limits and background */
interface Clip {
  t0: number; t1: number; death: number;
  snaps: RpSnap[]; patches: RpPatch[];
  tBase: Uint8ClampedArray<ArrayBuffer>; dBase: Uint8ClampedArray<ArrayBuffer> | null;
  fogBase: Uint8Array; fogLog: ArrayLike<number>;
  sfx: any[];                 // [t, SFX name, args] (recorder.js recSfx)
  scene?: Record<string, any> | null;   // saved: the floor's SCENE_KEYS and `held`
  lim?: number[] | null;      // saved: where the camera's centre may go [x0, y0, x1, y1]
  bgPx?: Uint8ClampedArray | null; bgW?: number; bgH?: number;   // saved: the background's pixels
  bgC?: HTMLCanvasElement | null;   // and on a canvas, once played
  id?: string; name?: string;
}
/** a clip as stored (replay/clip.js clipCrop): cut to a box round your path */
interface SavedClip {
  v: number; t0: number; t1: number; death: number; lim: number[];
  box: number[]; fbox: number[];
  tBase: Uint8ClampedArray<ArrayBuffer>; dBase: Uint8ClampedArray<ArrayBuffer> | null;
  fogBase: Uint8Array; fogLog: Float64Array; patches: RpPatch[]; snaps: RpSnap[]; sfx: any[];
  scene: Record<string, any>; bg: Uint8ClampedArray | null; bgW: number; bgH: number;
}
/** a saved clip's card in the gallery (save/clips.js) */
interface ClipMeta { id: string; name: string; date: number; floor: number; secs: number; bytes: number; thumb: string }
/** the replay's view (App's Witness sets it; draw() reads it as G.RPV) */
interface ReplayView {
  t: number; speed: number; playing: boolean; fog: boolean; follow: boolean; loop?: boolean;
  full?: boolean;             // exporting: drawn on the whole screen (the video is the screen's shape), not just above the panel
  bio?: number;               // the hologram's number at this moment of the replay (from the snapshot)
  zoom: number; cx: number; cy: number; unit?: number; panelH?: number;
  clip: Clip;                 // what's playing
  playPx?: number;            // the play area's height in canvas px (drawCamera sets it)
  onFrame?: ((c: HTMLCanvasElement, playPx: number) => void) | null;   // each drawn frame (the video export)
  st?: number;                // the clock at the last sound check (rpSound)
  mute?: boolean;
}
/** what the map screen (ui/map.js) draws: the floor's picture, the fog memory, you, the pins */
interface MapView { img: HTMLCanvasElement; seen: Uint8Array; x: number; y: number; face: number; pins: MapPin[] }
/** App's input ref: the React bridge (ui/app.js makes it, Game and the systems read and write it) */
interface GameInput {
  left: StickState; right: StickState;
  loadout: Loadout;
  saved: SaveData | null;
  paused: boolean; notify: () => void; inShop: boolean;
  prompt: Prompt | null; interact: boolean; sig: string;
  perksDirty?: boolean;       // a perk was switched: Game re-adds the bag before the next step
  found: Pickup | null;
  // legacy: a two-way confirm the right stick answered by pointing (Stick still reads them; nothing sets them)
  confirmAct: Record<string, () => void> | null; confirmAim: string | null;
  pendingToast: string | null;
  keys: { w: boolean; a: boolean; s: boolean; d: boolean };
  mouse: { x: number; y: number; inside: boolean; down: boolean };
  // set as it runs
  hud?: Hud; witness?: Witness | null; replay?: ReplayView | null; spawnGun?: number;
  saveClip?: (C: Clip) => Promise<ClipMeta | null>;   // Game: keep a death replay (systems/recorder.js clipKeep)
  clipFromSaved?: (S: SavedClip) => Clip;            // Game: a stored clip ready to play
  requestRestart?: () => void; promptBottom?: number; newCave?: boolean | number; ctlH?: number;   // newCave (Dev): true = this floor again, a number = go to that floor
  mapOpen?: boolean; floor?: number; saveRun?: () => void;
  mapView?: () => MapView;    // Game: what the map screen draws (ui/map.js)
  dropPin?: (e: string) => void;   // Game: a pin with that emoji where you stand
  perkCollection: string[];   // the perks unlocked at the perk machine, across runs
  collection: string[];       // the mods unlocked, kept across runs (save/save.js loadCollection)
  shopOpen?: string | null;   // a vending machine's menu is up: its SHOPS key (game/systems/shops.js), or 'levels' (the buy machine)
  buyFloor?: number;          // the level menu's choice: step buys that floor's level (vend.js buyLevel)
  menuTap?: (() => void) | null;   // a menu is up: a right-stick tap (or r/f/enter) confirms in it
  dispense?: { shop: string, id?: string, gun?: Gun, perk?: string } | null;   // bought: the machine pops it out (stepShops)
}

/** the death replay's recorder (systems/recorder.js) */
interface Recorder {
  t: number; acc: number; snaps: RpSnap[]; patches: RpPatch[]; dirty: RpRect[];
  fogLog: number[];           // flat: time, cell, value
  tBase: Uint8ClampedArray<ArrayBuffer> | null; dBase: Uint8ClampedArray<ArrayBuffer> | null;
  fogBase: Uint8Array | null; fogPrev: Uint8Array | null;
  deathT: number; done: boolean;
  sfx: any[];                 // the sounds made: [t, SFX name, args]
}
/** the replay's player: its own terrain canvases and fog (rpTerrain) */
interface ReplayPlayer {
  tC: HTMLCanvasElement | null; dC: HTMLCanvasElement | null; n: number; at: number;
  fog: Uint8Array | null; fireT: Uint16Array | null;
  clip: Clip | null;          // the clip the canvases were built for
  mat: Uint8Array | null;     // the rock at the replay's time, from the terrain's pixels (solid where opaque)
  loops: Map<number, any>;    // the sound loops playing for the replay, by recorded id
}

/**
 * `G`, what the systems need that isn't world state (Game.js, REFACTOR.md D16): the React
 * bridge, the canvases (tctx/dctx are the recorder's wrapped ones), the recorder, the fire's
 * dirty boxes, the rats' web test, the plant glow's scratch, the replay's view.
 */
interface GameCtx {
  input: { current: GameInput };
  c: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  terrain: HTMLCanvasElement; tctx: CanvasRenderingContext2D;
  bg: HTMLCanvasElement; bgctx: CanvasRenderingContext2D;
  fogC: HTMLCanvasElement; fctx: CanvasRenderingContext2D; fogImg: ImageData;
  fogBlurC: HTMLCanvasElement; fbctx: CanvasRenderingContext2D;
  mapC: HTMLCanvasElement;    // the map's picture: this floor as it was made, rock and decoration (level-entry.js mapPicture)
  decoC: HTMLCanvasElement; dctx: CanvasRenderingContext2D;
  REC: Recorder; RT: ReplayPlayer;
  fireBox: { t: number[]; d: number[] };
  ratOnWeb: (x: number, y: number) => boolean;
  mouse: GameInput['mouse']; aimPath: number[];   // aimPath: tracePath's x, y, x, y, …
  pgArt: Uint8ClampedArray | null; pgC: HTMLCanvasElement | null; pgCtx: CanvasRenderingContext2D | null;
  pgGlow: HTMLCanvasElement; pgGlowCtx: CanvasRenderingContext2D;
  RP_ARR: Record<string, any[]>;   // W's own lists by name, whatever they hold
  rid: WeakMap<object, number>; ridN: number;
  RPV: ReplayView | null;     // while draw() draws a replay frame: the view
}

/** step()'s frame object `F` (systems/step.js, D18) */
interface StepFrame { dt: number; LO: Loadout; MHP: number; pcx: number; pcy: number }
/** draw()'s frame object `F` (render/draw.js, D19) */
interface DrawFrame {
  dpr: number; playPx: number; vw: number; vh: number; pcx: number; pcy: number;
  TH: Theme; onView: ((x: number, y: number, m?: number) => boolean) | null;
  held: Gun | null; ax: number; ay: number; gy: number; cw: number; snapX: number; snapY: number;
}
/** stepEnemies' per-enemy object `C` (systems/enemies.js, D20): refilled for each creature */
interface EnemyCtx {
  dt: number; pcx: number; pcy: number;
  i: number; dx: number; dy: number; dist: number; sees: number; hunting: boolean;
}
/** one act's hooks in ACTS (game/creatures/acts.js, D20) */
interface ActHooks {
  move?: (W: World, G: GameCtx, e: Enemy, C: EnemyCtx) => boolean | void;
  pre?: (W: World, G: GameCtx, e: Enemy, C: EnemyCtx) => void;
  contact?: (W: World, G: GameCtx, e: Enemy, C: EnemyCtx) => boolean | void;
  fire?: (W: World, G: GameCtx, e: Enemy, C: EnemyCtx) => void;
  die?: (W: World, e: Enemy) => boolean | void;
  frame?: (W: World, G: GameCtx, F: StepFrame) => void;
}

// ---- the death replay (replay/replay.js, game/systems/recorder.js) ----

/**
 * one snapshot: `t`, `p`, `ghost`, the RP_NUMS, and a copy of each RP_LISTS list (entities cloned
 * with rpClone, so any shape: `any`). Keyed by list name, which a type can't spell out cheaply.
 */
interface RpSnap { t: number; p: any; ghost: any; [k: string]: any }
/** the scene at one time (rpFrame): the lists, numbers, p and ghost, and the nearer snapshot */
interface RpFrame { near: RpSnap; p?: any; ghost?: any; [k: string]: any }
/** a dirty rectangle: which layer ('t' rock, 'd' decoration), x, y, w, h in terrain px */
type RpRect = [string, number, number, number, number];
/** a terrain patch: the rectangle's pixels after the change */
interface RpPatch { x: number; y: number; w: number; h: number; px: Uint8ClampedArray<ArrayBuffer>; [k: string]: any }
