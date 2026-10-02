// @ts-check
// Plain numbers every layer can use: world size, physics tuning, the shop room, the fog grid
// and how far you see. No imports: this is the bottom layer (REFACTOR.md, section 4).

// ---- world ----
export const CELL = 2;                   // world units per terrain pixel
export const CW = 640, CH = 1600;        // terrain size in pixels
export const WW = CW * CELL, WH = CH * CELL;
export const BW = CW / 4, BH = CH / 4;   // background at quarter resolution
export const BCELL = WW / BW;            // world units per background pixel
export const VIEW_W = 360;               // world units visible across a phone screen
export const VIEW_MIN_H = 340;           // wide screens: keep at least this much height in view
export const ROCK = 1, BRICK = 2, BED = 3;

// ---- tuning ----
export const GRAVITY = 1400;
export const WALK = 150, GROUND_ACC = 1400, AIR_ACC = 600;
export const JET = 240, JET_ACC = 900;
export const CLIMB = 90;                 // how fast you climb a vine, chain or frozen fall
export const WEB_HAND = 3;               // hanging from a web line: where your hands are, down from your top
export const DEAD = 0.12;
// the right stick's own dead zone: drag past this fraction of its throw to aim/fire.
// A tap that never leaves it is an interact instead — see Stick() and the pickup/shop
// code in Game.step. 0.35 of the stick's max throw is a big enough circle to land a
// thumb on reliably without eating so much of the throw that aiming feels numb.
export const AIM_DEAD = 0.35;
// The knob's diameter as a share of the stick. Big enough that its edge still shows
// around a thumbprint, which is the whole point of it.
export const KNOB = 0.38;
// The ring drawn on the right stick, as a share of the stick: the throw you have to
// make (AIM_DEAD of the knob's full travel) plus one knob radius. So the ring is the
// line the knob's *edge* crosses at the exact moment the trigger goes live, which is
// what makes it worth drawing rather than just being another circle.
export const AIM_RING = AIM_DEAD * 0.72 + KNOB;
export const PW = 12, PH = 22;
export const FUEL_DRAIN = 0.28, FUEL_REGEN = 0.7, FUEL_RESTART = 0.2;
export const PLAYER_HP = 100;
export const START_GOLD = 40;

export const COIN_PULL = 36;         // gold within this many units flies to you
// how many enemies a floor gets before the floor lift. What they are and how hard
// they hit is the roster's business now — see CREATURES.
export const ENEMY_COUNT = 80;
export const MOD_DROPS = 7;          // red crystals lying in the cave (they were mods: game/systems/shops.js)
export const GUN_DROPS = 5;          // guns lying in the cave, unchanged
export const PICKUP_GAP = 260;       // and no two of them closer than this
export const PATROL_R = 70;          // how far an enemy will drift from where it spawned
                              // (each creature carries its own patrol speed — see CREATURES)
export const PICKUP_COOL = 2;        // a gun you walked away from stays quiet this long

// the shop room sits under the whole cave: floor, interior, then a brick roof
export const SHOP_FLOOR = CH - 10;            // first row of solid floor
export const SHOP_H = 48;                     // interior height
export const SHOP_TOP = SHOP_FLOOR - SHOP_H;  // first open row of the room
export const SHOP_ROOF = 6;                   // roof thickness
export const SHOP_Y = SHOP_TOP * CELL;        // world y of the ceiling, for "am I in the shop?"
// the two level vending machines on the shop's back wall, past the way in and the heal (centre x,
// world units; a screen is 72 wide), and their prices:
// a level costs LVL_BUY on credit and sells back for LVL_SELL, a thousand more
export const VEND_BUY_X = 180, VEND_SELL_X = 280;
export const LVL_BUY = 64000000000, LVL_SELL = 64000001000;
// and it must be repaid within an hour of buying the level (real time, the device clock, ms)
export const DEADLINE_MS = 60 * 60 * 1000;

// ---- fog of war ----
// A coarse reveal grid, never per pixel: one fog cell covers FOG terrain pixels each
// way, and the overlay is a tiny FW x FH canvas scaled up over the view, so hiding the
// map costs one image draw a frame however big the map gets.
export const FOG = 8;                         // terrain pixels per fog cell
export const FOG_U = FOG * CELL;              // world units per fog cell
export const FW = Math.ceil(CW / FOG), FH = Math.ceil(CH / FOG);
// the minimap samples the real terrain at a finer grid than the fog: a cell is an
// outline if a wall passes through it (has both rock and open), which traces every wall
// continuously instead of the scatter you get detecting edges at the coarse fog grid.
export const MINI_D = 4;                      // terrain pixels per minimap cell
export const MMW = Math.ceil(CW / MINI_D), MMH = Math.ceil(CH / MINI_D);
export const SIGHT = 200;                     // how far the torch reaches: line of sight out to
                                       // here lifts the fog, and the lamp then lights the
                                       // ground it lifted. A cell this close and in view is
                                       // marked as somewhere you have been and stays marked
                                       // for the rest of the floor. This is a medium bubble —
                                       // generous, but the cave beyond it stays dark
export const LAMP_REACH = 1.15;               // the lamp's pool is this many times the sight radius,
                                       // so the whole lifted bubble is lit and fades out at
                                       // its edge. The lamp is MASKED by the fog: it brightens
                                       // ground the line of sight has already uncovered and
                                       // leaves the rest dark — see the note on the lamp in draw()
export const FOG_DIM = 0.85;                  // how dark somewhere you have been but cannot see
export const FOG_DARK = 0.99;                 // how dark somewhere you have never been — near black,
                                       // because that darkness is the fog of war now

export const COL = {
  text: '#e9ecf2', muted: 'rgba(233,236,242,0.55)', barBg: 'rgba(255,255,255,0.12)',
  player: '#ff5a36', visor: '#17222e', bullet: '#ffc93c', flame: '#ff8a1f', flame2: '#ffe066',
  enemy: '#b57cff', eye: '#f4f0ff', smoke: '#9aa3ad', hp: '#46c48c', grenade: '#7cc04f', portal: '#5ee0a0',
};
