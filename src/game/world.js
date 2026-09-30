// @ts-check
// The world: the live level's state as one object, `W`. Game makes it once and every part of
// the loop reads and writes it (REFACTOR.md, Phase 3). enterLevel replaces the level-scoped
// parts on each floor; the lists are emptied in place, never replaced, because the death
// replay's recorder holds them by reference.

import { CH, CW, PLAYER_HP, SIGHT, VIEW_MIN_H, VIEW_W } from '../core/consts.js';
import { perkBag } from '../data/perks.js';
import { fireNew } from '../world/fire.js';
import { fogStart } from '../world/vision.js';

/** @returns {World} */
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

    // ---- the clock, the camera, the torch ----
    time: 0,                        // seconds of play (step adds dt)
    levelT: 0,                      // seconds on this floor (the floor's name card)
    best: 0,                        // the highest you've climbed on this floor
    // the camera: draw() eases it toward you, so step() reads last frame's
    camX: 0, camY: 0, camReady: false,
    unitPx: 1,                      // css pixels per world unit, set while drawing
    viewW: VIEW_W, viewH: VIEW_MIN_H,   // the view in world units, set while drawing
    // one flicker number drives the flame and the lamp, so the light breathes with the fire
    flick: 1,
    torchR: SIGHT,                  // how far the lamp reaches this frame
    visPts: [],                     // the line-of-sight fan from you, this frame
    leanX: 0, leanY: 0,             // the hand torch's flame lean (sprung, trails behind you)
    glowN: 0,                       // the torch glow's flicker

    // ---- terrain ----
    mat: null, img: null,           // the rock: solid cells, and its pixels (drawn to the terrain canvas)
    dimg: null,                     // the decoration layer's pixels (walk-through: moss, beams, rubble)
    ore: null,                      // gold seams in the rock (per terrain pixel)
    // rat burrows (a mask over each nest's room and tunnel), and the rock's change count
    // (the rats' way-finding fields rebuild when it moves; see ratSolid / navFor)
    burrow: null, terrainV: 0,

    // ---- the floor's layout (enterLevel sets all of these) ----
    floor: 1,
    // the level above the shop is bought from the vending machine and sold back (vend.js): false
    // while there isn't one (the cave is solid dark, the roof sealed); warp is the teleport under way
    hasLvl: false, warp: null,
    repo: null,                     // the repayment deadline passed: the level is taken back, then the fire
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

    // ---- the run's lists: kept for the whole run, emptied by enterLevel (not fields, beams,
    // toasts), and never replaced: the recorder's RP_ARR holds them by reference ----
    bullets: [], enemyShots: [],    // your shots, and the creatures'
    fields: [], beams: [],          // static projectiles, and instant beam streaks
    arcs: [],                       // lightning forks: jagged lines that flash and fade
    coins: [],
    toasts: [],                     // the messages at the bottom of the view
    smoke: [], sparks: [], flashes: [],
    torchP: [],                     // the embers the torch throws off
    // soft magic particles: the Black Hole's trail ('drift'), motes sucked into the exit
    // portal ('in') and motes wafting out of the arrival portal ('out')
    motes: [],
    burns: [],                      // the fire trail (Levitation Trail), if owned
    // the spiders' silk: webs are the lines they travel on (they stay), silk the strings in
    // flight at you, strings the ones stuck to you (each slows you; pull one too long, it snaps)
    webs: [], silk: [], strings: [],
    // the decoration's particles (glow dots, drips, embers), the theme's ambience, spore
    // clouds, noise rings and dust devils
    dparts: [], amb: [], clouds: [], rings: [], devils: [],

    // ---- frame-to-frame counters and sound loops (each kept by the one part of step() that
    // uses it) ----
    // sound: the jetpack's roar, each live Black Hole's drone, the low-health heartbeat,
    // the exit portal's hum and the dark matter's
    jetLoop: null, beatT: 0, wasEmpty: false,
    jetSt: { cut: 0, onT: 0, start: false },   // the jet's cough clock and how long it's been held
    bhLoops: new Map(),
    portalLoop: null, matterLoop: null, wasJet: false,
    stepT: 0, lastNear: '',         // the footstep clock; what you were last standing by
    portalAcc: 0,                   // the exit portal's motes, spawned by the clock
    // the hand torch's flame lean velocity (a sprung offset dragged opposite to how you move,
    // the same way the jet flame swings), and the torch's flicker and ember clocks
    leanVX: 0, leanVY: 0,
    flickN: 0, torchT: 0, torchAcc: 0,
    smokeAcc: 0,                    // the jetpack's smoke
    webCheck: 0,                    // which web line step() checks this frame (a few per frame)
    webLetGo: 0,                    // pushed off a web or arch: don't grab one again yet
    // decorStep: the plants you're brushing (and last frame's), the rustle pause, its frame
    // count, the drip-damage clock
    plantsNow: new Set(), plantsLast: new Set(), rustle: { t: 0 },
    decoFrame: 0, dripHurt: 0,
    oreBank: 0,                     // the loose change from gold seams dug out
    navYou: {},                     // the shared way-to-you field the hunting rats follow (see navFor)
  };
}
