// The world: the live level's state as one object, `W`. Game makes it once and every part of
// the loop reads and writes it (REFACTOR.md, Phase 3). enterLevel replaces the level-scoped
// parts on each floor; the lists are emptied in place, never replaced, because the death
// replay's recorder holds them by reference.

import { CH, CW, PLAYER_HP } from '../core/consts.js';
import { perkBag } from '../data/perks.js';
import { fireNew } from '../world/fire.js';
import { fogStart } from '../world/vision.js';

export function makeWorld() {
  return {
    // ---- you ----
    p: { x: 0, y: 0, vx: 0, vy: 0, onGround: false, face: 1, jet: 0,
      fuel: 1, empty: false, sput: false, flame: 0, cough: 0, hp: PLAYER_HP, hitT: 0, dead: false, kick: 0,
      shieldReady: true, shieldT: 0,        // Permanent Shield: up, and its recharge clock
      jx: 0, jy: 0, aim: { on: false, show: false, nx: 1, ny: 0 } },
    pb: perkBag([]),                // what the perks you carry add up to (refreshBag)
    ghost: null,                    // the Angry Ghost companion, if owned
    // what the props did to you this frame (slowed, slick, holding a vine, gravity flipped),
    // read by next frame's steering; decorStep makes a new one each frame
    zfx: { slow: 1, slick: 0, climb: null, rev: 0, web: null, webs: 0, webMul: 1 },

    // ---- terrain ----
    mat: null, img: null,           // the rock: solid cells, and its pixels (drawn to the terrain canvas)
    dimg: null,                     // the decoration layer's pixels (walk-through: moss, beams, rubble)
    ore: null,                      // gold seams in the rock (per terrain pixel)
    // rat burrows (a mask over each nest's room and tunnel), and the rock's change count
    // (the rats' way-finding fields rebuild when it moves; see ratSolid / navFor)
    burrow: null, terrainV: 0,

    // ---- the floor's layout (enterLevel sets all of these) ----
    floor: 1,
    start: undefined, portal: undefined, arrival: undefined,   // where you come in, the way out
    stock: undefined,               // the shop's plinths
    zone: null,                     // built-up vs natural, per terrain pixel (floor 1)
    rooms: [],                      // the perk room and the heart room
    sconces: [],                    // wall torches: by the portals and the prizes
    levelSeed: 0, levelOwned: [],   // what made this cave, for the autosave
    roster: [], themeName: '',      // this floor's creatures, and its palette
    total: undefined,               // how many creatures the floor started with
    miniEdgeIdx: [],                // the map's wall-outline cells
    matterProps: [],                // the dark matter props (their hum)
    ambKinds: [],                   // the theme's ambience particle kinds
    plantW: 255,                    // the jellies' plant glow: this floor's white point

    // ---- what's in it: new lists from each floor (and swapped for the recorded ones while
    // the death replay draws a frame) ----
    enemies: undefined,             // the creatures, nests included
    pickups: undefined,             // loot on the ground: mods, guns, hearts
    props: [],                      // the decoration that does things (see DECOR): plants, lamps, carts…

    // ---- the fog of war ----
    seen: fogStart(),               // per fog cell: 0 never been, 1 been (draw() lifts it), 2 never fogged (the shop)
    deepFog: null,                  // the fog cells over the rat nests' rooms (no soft edge there)

    // ---- fire (v86, see fireStep): what's alight in the cave, the plants and carts it can
    // take, the burning pixels on view this frame (for the glow after the fog), its crackle ----
    fire: fireNew(new Uint8Array(CW * CH)),
    firePlants: [], fireArches: [], fireCarts: [],   // what can burn (fireList, rebuilt when the props change)
    firePropN: -1, firePropLast: null,              // how fireList notices the props changed
    fireLoop: null,                 // the crackle, at the nearest blaze
    fireN: 0,                       // burning pixels on view (the glow's strength)
    fireVis: [],                    // and which ones, for the glow after the fog
  };
}
