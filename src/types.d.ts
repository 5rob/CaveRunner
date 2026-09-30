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
  spiral: number; pong: number; orbit: number; autoaim: number; homeR: number; flat: number;
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
  // no `fire`: enemyFor doesn't copy CreatureType's (REFACTOR.md, Found along the way)
}

/** a creature in the level: makeLevel's enemies, then the enemy loop's own fields */
interface Enemy {
  x: number; y: number; ty: number; r: number; phase: number;
  hp: number; hpMax: number; cd: number; flash: number;
  lx: number; ly: number; hx: number; hy: number;
  tgt: Pt | null; rest: number; touch: number; charge: number;
  k: CreatureKind;
  nest?: NestState;           // a rat nest
  sid?: number;               // its index on the floor (the autosave)
  // the reworked creatures' brains, on the creature (made on their first step)
  sp?: SpiderBrain; je?: JellyBrain; ra?: RatBrain;
  aggro?: boolean; aggroT?: number; aggroM?: number; spotted?: boolean;
  dead?: boolean; chill?: number; burn?: number; burnAcc?: number; fuseT?: number;
  // a rat's jobs and fallbacks
  home?: Enemy; carry?: number; giveUp?: number; bestD?: number; bestT?: number;
  roam?: any; path?: any; smell?: number; arrive?: number; jobO?: any;
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
}

// ---- perks (data/perks.js) ----

/** a perk: one entry of PERKS. Its numbers fold into a PerkBag */
interface Perk extends Partial<Omit<PerkBag, 'maxHp'>> {   // dmg, speed, shield, …: the bag fields it moves
  name: string; glyph: string; tint: string; info: string;
}
/** every perk you own folded into one bag: perkBag (data/perks.js), W.pb */
interface PerkBag {
  dmg: number; speed: number; spread: number; bounce: number; recoil: number; crit: number;
  mana: number; delay: number; rech: number; walk: number; jet: number; hpMul: number;
  hpAdd: number; heal: number; gold: number; goldPull: number; shield: number; lives: number;
  ghost: number; homing: number; trail: number; contact: number; close: number; invis: number;
  repel: number; seeAll: number; radarEnemy: number; radarItem: number; radarWand: number;
  tinker: number; extraItem: number; pinpointer: number; trajectory: number;
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
  // what the game adds as it plays (decorStep, fire, drips)
  fall?: number; vy?: number; gone?: boolean; burn?: number; hp?: number; hitT?: number;
  acc?: number; dn?: number; di?: number; cd?: number; ecd?: number; shake?: number;
  warn?: number; ring?: number; heard?: boolean; hurt?: number; hs?: number; sq?: number;
  stand?: number; grab?: number; ang?: number; aimA?: number; ext?: number;
}

/** a thing on the ground: a mod, a gun, a heart */
interface Pickup {
  kind: 'mod' | 'gun' | 'heart' | 'perk' | 'heal';
  x: number; y: number; t: number;
  id?: string;                // a mod's or perk's id
  gun?: Gun;
  taken?: boolean; old?: boolean;
}
/** a shop plinth (makeLevel's stock) */
interface StockItem { kind: string; x: number; y: number; price: number; sold: boolean; id?: string; gun?: Gun }
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
  img: Pixels; bgImg: Pixels; dimg: Pixels;
  ore: Uint8Array; fuel: Uint8Array;
  props: Prop[];
  amb: string[];              // the theme's ambience particle kinds
  start: Pt;
  portal: { x: number; y: number; w: number; h: number };
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
  [k: string]: any;
}
/** one Dev panel row (DEV_META) */
interface DevRow { k: string; g: string; label: string; min?: number; max?: number; step?: number; type?: 'color' | 'slider' }

// ---- the game (game/, layer 5) ----

/** a shot in flight (spawnShot, game/systems/gun.js): the Shot's numbers and where it is */
interface Bullet {
  x: number; y: number; vx: number; vy: number;
  life: number; dmg: number; size: number; col: string; spin: number;
  homing: number; bounce: number; pierce: number; explode: number; grav: number; accel: number;
  bore: number; hit: any; knock: number; crit: number; boomer: number; spiral: number;
  pong: number; orbit: number; homeR: number; eat: number; pull: number; split: number;
  cluster: number; bounceFx: any; friendly: number; chain: number; fuse: number;
  payload: Shot[] | null; hidden: number; arc: number; drift: number; pop: number; tele: number;
  fire: number; drag: number; bounceE: number; pit: number; wig: number; look: string | null;
  light: string | null; lightR: number; vmax: number; lifeBoom: number;
  trig: TrigKind | null; timer: number | null;
  ox: number; oy: number; age: number; born: number;
  // set as it flies
  ang?: number; struck?: boolean; propHit?: any; lock?: Enemy | null; arcT?: number;
  ax?: number; ay?: number; da?: number; grind?: number; trail?: any;
}

/** the live level, `W`: makeWorld (game/world.js). enterLevel refills the floor's parts */
interface World {
  p: Player;
  pb: PerkBag;
  ghost: any;
  zfx: { slow: number; slick: number; climb: Prop | null; rev: number; web: any; webs: number; webMul: number;
    arch?: Prop | null; surface?: string };
  time: number; levelT: number; best: number;
  camX: number; camY: number; camReady: boolean; unitPx: number; viewW: number; viewH: number;
  flick: number; torchR: number; visPts: number[]; leanX: number; leanY: number; glowN: number;
  mat: Uint8Array; img: Pixels; dimg: Pixels; ore: Uint8Array; burrow: Uint8Array; terrainV: number;
  floor: number;
  start: Pt; portal: Level['portal']; arrival: Pt; stock: StockItem[];
  zone: Uint8Array | null; rooms: Room[]; sconces: any[];
  levelSeed: number; levelOwned: string[]; roster: string[]; themeName: string; total: number;
  miniEdgeIdx: number[]; matterProps: Prop[]; ambKinds: string[]; plantW: number;
  enemies: Enemy[]; pickups: Pickup[]; props: Prop[];
  seen: Uint8Array; deepFog: any;
  fire: FireState;
  firePlants: Prop[]; fireArches: Prop[]; fireCarts: Prop[];
  firePropN: number; firePropLast: any; fireLoop: any; fireN: number; fireVis: number[];
  bullets: Bullet[]; enemyShots: any[]; fields: any[]; beams: any[]; arcs: any[]; coins: any[];
  toasts: any[]; smoke: any[]; sparks: any[]; flashes: any[]; torchP: any[]; motes: any[];
  burns: any[]; webs: WebLine[]; silk: any[]; strings: any[];
  dparts: any[]; amb: any[]; clouds: any[]; rings: any[]; devils: any[];
  jetLoop: any; beatT: number; wasEmpty: boolean;
  jetSt: { cut: number; onT: number; start: boolean };
  bhLoops: Map<Bullet, any>;
  portalLoop: any; matterLoop: any; wasJet: boolean;
  stepT: number; lastNear: string; portalAcc: number;
  leanVX: number; leanVY: number; flickN: number; torchT: number; torchAcc: number; smokeAcc: number;
  webCheck: number; webLetGo: number;
  plantsNow: Set<Prop>; plantsLast: Set<Prop>; rustle: { t: number };
  decoFrame: number; dripHurt: number; oreBank: number;
  navYou: any;
}
/** you: W.p */
interface Player {
  x: number; y: number; vx: number; vy: number; onGround: boolean; face: number; jet: number;
  fuel: number; empty: boolean; sput: boolean; flame: number; cough: number; hp: number; hitT: number;
  dead: boolean; kick: number; shieldReady: boolean; shieldT: number; jx: number; jy: number;
  aim: { on: boolean; show: boolean; nx: number; ny: number };
  burn?: number; burnAcc?: number;
  [k: string]: any;           // step() adds more as it goes; typed with the game folder
}

/**
 * `G`, what the systems need that isn't world state (Game.js, REFACTOR.md D16): the React
 * bridge, the canvases (tctx/dctx are the recorder's wrapped ones), the recorder, the fire's
 * dirty boxes, the rats' web test, the plant glow's scratch, the replay's view.
 */
interface GameCtx {
  input: { current: any };    // App's input ref: typed with the ui folder
  c: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  terrain: HTMLCanvasElement; tctx: CanvasRenderingContext2D;
  bg: HTMLCanvasElement; bgctx: CanvasRenderingContext2D;
  fogC: HTMLCanvasElement; fctx: CanvasRenderingContext2D; fogImg: ImageData;
  fogBlurC: HTMLCanvasElement; fbctx: CanvasRenderingContext2D;
  miniC: HTMLCanvasElement; mctx: CanvasRenderingContext2D; miniImg: ImageData; mini32: Uint32Array;
  decoC: HTMLCanvasElement; dctx: CanvasRenderingContext2D;
  REC: any; RT: any;          // the recorder and the replay's player (systems/recorder.js)
  fireBox: { t: number[]; d: number[] };
  ratOnWeb: (x: number, y: number) => any;
  mouse: any; aimPath: any[];
  pgArt: any; pgC: HTMLCanvasElement | null; pgCtx: CanvasRenderingContext2D | null;
  pgGlow: HTMLCanvasElement; pgGlowCtx: CanvasRenderingContext2D;
  RP_ARR: Record<string, any[]>; rid: WeakMap<object, number>; ridN: number;
  RPV: any;                   // while draw() draws a replay frame: the view
}

/** step()'s frame object `F` (systems/step.js, D18) */
interface StepFrame { dt: number; LO: any; MHP: number; pcx: number; pcy: number }
/** draw()'s frame object `F` (render/draw.js, D19) */
interface DrawFrame {
  dpr: number; playPx: number; vw: number; vh: number; pcx: number; pcy: number;
  TH: any; onView: ((x: number, y: number, m?: number) => boolean) | null;
  held: Gun | null; ax: number; ay: number; gy: number; cw: number;
}
