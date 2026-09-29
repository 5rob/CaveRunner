import { VENT_H, drawProp, propCol, propGlow, rgbA } from './art/props.js';
import { drawGun, drawGunGlow, drawRunner, drawSconce, drawTorch, glowAt } from './art/sprites.js';
import { HEAR_FIRE, jetPitch, rustleStep } from './audio/recipes.js';
import { SFX } from './audio/sfx.js';
import {
  AIM_DEAD, AIM_RING, AIR_ACC, BCELL, BED, BH, BRICK, BW, CELL, CH, CLIMB, COIN_PULL, COL, CW,
  DEAD, FH, FOG, FOG_DARK, FOG_DIM, FOG_U, FUEL_DRAIN, FUEL_REGEN, FUEL_RESTART, FW, GRAVITY,
  GROUND_ACC, JET, JET_ACC, KNOB, LAMP_REACH, MINI_D, MMH, MMW, PATROL_R, PH, PICKUP_COOL,
  PLAYER_HP, PW, SHOP_FLOOR, SHOP_Y, SIGHT, START_GOLD, VIEW_MIN_H, VIEW_W, WALK, WEB_HAND, WH,
  WW
} from './core/consts.js';
import { angDiff, approach, clamp, hexArr, hexRgb, mix, mixHex, turn } from './core/util.js';
import { roamStep } from './creatures/common.js';
import { drawEnemy } from './creatures/draw.js';
import {
  drawJelly, jellyBell, jellyPal, jellyStep, plantGlowFill, plantWhite, tentacleTouch
} from './creatures/jelly.js';
import { pathLen, ratSpread, ratStep } from './creatures/rat.js';
import { spiderStep } from './creatures/spider.js';
import { HUNTERS, enemyFor } from './data/creatures.js';
import { PERKS, perkBag } from './data/perks.js';
import { themeFor } from './data/themes.js';
import {
  DEV, DEV_DEFAULTS, DEV_GROUPS, DEV_META, devReport, devSet, jcol, kr, kru, spr
} from './dev/knobs.js';
import {
  RP_AFTER, RP_BEFORE, RP_H, RP_HZ, RP_KEEP, RP_W, rpClone, rpCut, rpFrame, rpMerge, rpPaste
} from './replay/replay.js';
import { SAVE_KEY, clearSave, loadSave } from './save/save.js';
import { buildAdvice, modPreview } from './spells/advisor.js';
import {
  fireSimGauges, fireSimNew, fireSimStep, gunModDeltas, pullSteps, statQual
} from './spells/bagsim.js';
import { effRecharge, gunPassives, planCast } from './spells/cast.js';
import {
  caveGun, gunAccent, gunColor, gunLvCol, resetGun, shuffleOrder, startingGuns
} from './spells/guns.js';
import { ALL_IDS, FAMILIES, FAMILY_OF, MODS, VACUUM_WAIT, famCol, famOf } from './spells/mods.js';
import {
  DRIFT_ACC, DRIFT_CHASE, DRIFT_R, bhSp, driftStep, tracePath, wigTurn
} from './spells/trace.js';
import { PLANTS, PROP_DMG, archAt, archNear, propAnchored } from './world/decorate.js';
import {
  FIRE_COLS, FIRE_WET, FLAMMABLE, fireArea, fireDouse, fireNear, fireNew, fireStep
} from './world/fire.js';
import { ROOM_HH, ROOM_HW, makeLevel } from './world/level.js';
import { NAV, navField, navWay } from './world/nav.js';
import { ORE_GOLD } from './world/veins.js';
import {
  VIS_RAYS, fogReveal, fogStart, losClear, nestFog, rayDist, visPoly
} from './world/vision.js';
import { builtAt } from './world/zones.js';
import { h, useEffect, useMemo, useRef, useState } from './ui/h.js';

// Near the bottom of the tank the jet coughs: short random cut-outs, more often and a touch
// longer the closer the tank is to dry. `st` keeps the cut-out clock and how long the jet
// has been held on (which bends its pitch). Returns true while it's cut out; `st.start`
// is true on the frame a cut-out begins.
const SPUTTER_FUEL = 0.25;
function sputterStep(st, dt, fuel, on, rnd) {
  rnd = rnd || Math.random;
  st.start = false;
  if (!on) { st.cut = 0; st.gap = 0; st.onT = 0; return false; }
  st.onT = (st.onT || 0) + dt;
  st.cut = Math.max(0, (st.cut || 0) - dt);
  st.gap = Math.max(0, (st.gap || 0) - dt);                  // a catch of breath between coughs
  if (st.gap <= 0 && fuel < SPUTTER_FUEL) {
    const w = 1 - Math.max(0, fuel) / SPUTTER_FUEL;          // 0 at the line, 1 bone dry
    if (rnd() < dt * (1 + 7 * w)) {
      st.cut = 0.04 + rnd() * (0.05 + 0.08 * w);
      st.gap = st.cut + 0.1 + rnd() * 0.2;
      st.start = true;
    }
  }
  return st.cut > 0;
}
const NO_INPUT = { active: false, nx: 0, ny: 0, mag: 0, dy: 0, on: false };

// Gold for the deck readout: a bare number under 1000, and thousands truncated (not
// rounded) to one decimal with a "k" — 999 -> "999", 1234 -> "1.2k", 2000 -> "2k".
// Pure and above makeLevel so the logic suite can load it.
function fmtGold(g) {
  g = Math.max(0, Math.floor(g || 0));
  if (g < 1000) return String(g);
  return (Math.floor(g / 100) / 10).toString() + 'k';
}

// Where the round deck buttons sit, in css px relative to the sticks row's top-left (the
// row is W wide, the two sticks `size` across, spaced evenly). The gun buttons ride an arc
// centred on the right stick: from the top of the gap between the sticks, clockwise over
// the top, to near the right edge. The bag mirrors the last gun on the left, and the map
// button sits straight above the bag. Returns centres plus the button diameter.
function deckLayout(W, size, n) {
  n = n || 4;
  const g = (W - 2 * size) / 3;
  const rc = { x: 2 * g + 1.5 * size, y: size / 2 };
  const btn = Math.round(Math.max(34, Math.min(46, size * 0.24)));
  const sx = W / 2, sy = size * 0.05 + 10;             // the old gold spot
  const R = Math.max(Math.hypot(sx - rc.x, sy - rc.y), size / 2 + btn / 2 + 4);
  const a0 = Math.atan2(sy - rc.y, sx - rc.x);
  const xmax = W - btn / 2 - 4;
  const a1 = Math.max(a0 + 0.3, -Math.acos(Math.max(-1, Math.min(1, (xmax - rc.x) / R))));
  const guns = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * (n > 1 ? i / (n - 1) : 0);
    guns.push({ x: rc.x + Math.cos(a) * R, y: rc.y + Math.sin(a) * R });
  }
  const last = guns[n - 1];
  const bag = { x: W - last.x, y: last.y };
  const map = { x: bag.x, y: bag.y - btn - 8 };
  return { btn, R, rc, guns, bag, map };
}

// The pure part of this file, for the logic tests: src/pure.js re-exports it (and every
// module), and tests/load.js bundles that. It shrinks as the code moves out into modules
// (REFACTOR.md, P1.5); the browser build ignores it.
export {
  SPUTTER_FUEL, sputterStep, NO_INPUT, fmtGold, deckLayout
};

function Game({ input }) {
  const cv = useRef(null);
  useEffect(() => {
    const c = cv.current, ctx = c.getContext('2d');
    const terrain = document.createElement('canvas');
    terrain.width = CW; terrain.height = CH;
    const tctx = terrain.getContext('2d');
    const bg = document.createElement('canvas');
    bg.width = BW; bg.height = BH;
    const bgctx = bg.getContext('2d');
    // the fog overlay: one pixel per fog cell, drawn scaled up over the world
    const fogC = document.createElement('canvas');
    fogC.width = FW; fogC.height = FH;
    const fctx = fogC.getContext('2d');
    const fogImg = new ImageData(FW, FH);
    // a second tiny canvas: the fog is blurred here at source resolution (cheap) and the
    // blurred copy is what gets upscaled, so the fog edge is soft without a full-screen blur
    const fogBlurC = document.createElement('canvas');
    fogBlurC.width = FW; fogBlurC.height = FH;
    const fbctx = fogBlurC.getContext('2d');
    let seen = fogStart(), deepFog = null;
    // the minimap: an MMW x MMH canvas of white cave outlines, smooth-scaled into the
    // bottom-left of the view. miniEdgeIdx lists the wall-outline cells (static per floor);
    // each frame only the ones the fog has revealed are painted white, the rest cleared.
    const miniC = document.createElement('canvas');
    miniC.width = MMW; miniC.height = MMH;
    const mctx = miniC.getContext('2d');
    const miniImg = new ImageData(MMW, MMH);
    const mini32 = new Uint32Array(miniImg.data.buffer);
    let miniEdgeIdx = [];

    let mat, img, start, portal, enemies, pickups, stock, arrival, total, floor = 1, zone = null;
    const natural = (x, y) => !builtAt(zone, x, y);      // jellies keep to the natural zones
    let ore = null, oreBank = 0;                     // gold seams in the rock, and the loose change
    let levelSeed = 0, levelOwned = [];              // what made this cave, for the autosave
    // sound: the jetpack's roar, each live Black Hole's drone, the low-health heartbeat
    let jetLoop = null, beatT = 0, wasEmpty = false;
    const jetSt = { cut: 0, onT: 0, start: false };   // the jet's cough clock and how long it's been held
    const bhLoops = new Map();
    const plantsNow = new Set(), rustle = { t: 0 };  // the plants you're brushing, and the rustle pause
    let portalLoop = null, matterLoop = null, matterProps = [], wasJet = false, stepT = 0, lastNear = '';
    let plantsLast = new Set();
    let rooms = [];                                  // the perk room and the heart room
    let sconces = [];                                // wall torches: by the portals and the prizes
    let roster = [], themeName = '';                 // this floor's creatures, and its palette

    const p = { x: 0, y: 0, vx: 0, vy: 0, onGround: false, face: 1, jet: 0,
      fuel: 1, empty: false, sput: false, flame: 0, cough: 0, hp: PLAYER_HP, hitT: 0, dead: false, kick: 0,
      shieldReady: true, shieldT: 0,        // Permanent Shield: up, and its recharge clock
      jx: 0, jy: 0, aim: { on: false, show: false, nx: 1, ny: 0 } };
    const bullets = [], enemyShots = [], smoke = [], sparks = [], flashes = [], toasts = [], coins = [];
    const fields = [], beams = [];                   // static projectiles, and instant beam streaks
    const arcs = [];                                 // lightning forks: jagged lines that flash and fade
    const torchP = [];                               // the embers the torch throws off
    // soft magic particles: the Black Hole's trail ('drift'), motes sucked into the exit
    // portal ('in') and motes wafting out of the arrival portal ('out')
    const motes = [];
    let portalAcc = 0;
    // ---- level decoration (see DECOR): the props, the decoration layer, their particles,
    // the theme's ambience, spore clouds and noise rings. zfx is what the props did to you
    // this frame (slowed, slick, holding a vine, gravity flipped), read by next frame's steering.
    let props = [], ambKinds = [], dimg = null;
    let plantW = 255, pgArt = null, pgC = null, pgCtx = null;   // the jellies' plant glow (plantGlow)
    const decoC = document.createElement('canvas');
    decoC.width = CW; decoC.height = CH;
    const dctx = decoC.getContext('2d');
    const dparts = [], amb = [], clouds = [], rings = [], devils = [];
    let decoFrame = 0, viewW = VIEW_W, viewH = VIEW_MIN_H, dripHurt = 0;
    let zfx = { slow: 1, slick: 0, climb: null, rev: 0, web: null, webs: 0, webMul: 1 };
    // the hand torch's flame lean: a sprung offset dragged opposite to how you move,
    // the same way the jet flame swings, so the fire trails behind you
    let leanX = 0, leanY = 0, leanVX = 0, leanVY = 0, glowN = 0;
    const aimPath = [];                              // scratch buffer for the aim line
    let smokeAcc = 0, time = 0, levelT = 0, camX = 0, camY = 0, camReady = false;
    // the torch: one flicker number drives both the flame and the lamp, so the light
    // in the cave breathes exactly as much as the fire does
    let flick = 1, flickN = 0, torchT = 0, torchAcc = 0, torchR = SIGHT, visPts = [];

    // The torch hand: whichever one the gun is not in, so the two never sit on top of
    // each other. Aiming behind you swaps hands, the same way the gun does.
    const torchHand = () => {
      const a = p.aim.show ? p.aim.nx : p.face;
      return { x: p.x + PW / 2 + (a >= 0 ? -5.5 : 5.5), y: p.y + 9 };
    };
    // ---- perks ----
    // Everything the perks you are carrying add up to, recomputed whenever the run's perk
    // list changes and read all over step() and draw(). Neutral (all multipliers 1, all
    // flags 0) until a perk is found, so a run with no perks behaves exactly as before.
    let pb = perkBag([]);
    const refreshBag = () => { pb = perkBag(input.current.loadout.perks || []); };
    // the true maximum health: the perk bag's answer plus the running +25 per heart room.
    const maxHp = () => pb.maxHp + (input.current.loadout.maxBonus || 0);
    // the ghost companion (Angry Ghost) and the fire trail (Levitation Trail), if owned
    let ghost = null;
    const burns = [];
    // fire (v86, see fireStep): what's alight in the cave, the plants and carts it can take,
    // the burning pixels on view this frame (for the glow after the fog), and its crackle
    let fire = fireNew(new Uint8Array(CW * CH)), firePlants = [], fireArches = [], fireCarts = [], firePropN = -1, firePropLast = null, fireLoop = null, fireN = 0;
    const fireVis = [];
    // the spiders' silk: webs are the lines they travel on (they stay), silk the strings in
    // flight at you, strings the ones stuck to you (each slows you; pull one too long, it snaps)
    const webs = [], silk = [], strings = [];
    // rat burrows (a mask over each nest's room and tunnel), the rock's change count, and the
    // shared way-to-you field the hunting rats follow (see ratSolid / navFor)
    let burrow = null, terrainV = 0;
    const navYou = {};
    let webCheck = 0, webLetGo = 0;
    // how far a point is from a web line (anchor to anchor, as drawn), and where on it is closest
    const webNear = (L, x, y) => {
      const vx = L.b0x - L.a0x, vy = L.b0y - L.a0y, ll = vx * vx + vy * vy || 1;
      const u = Math.max(0, Math.min(1, ((x - L.a0x) * vx + (y - L.a0y) * vy) / ll));
      return { x: L.a0x + vx * u, y: L.a0y + vy * u };
    };
    const webDist = (L, x, y) => { const q = webNear(L, x, y); return Math.hypot(q.x - x, q.y - y); };

    const toast = text => { toasts.push({ text, t: 2.2 }); if (toasts.length > 3) toasts.shift(); };
    let best = 0, raf, last = performance.now();

    // ---- the death replay's recorder (see RP_HZ) ----
    // REC.snaps: what draw() reads round you, RP_HZ a second. Terrain: tBase/dBase are the rock
    // and decoration pixels as of the oldest snapshot, patches the rectangles changed since
    // (caught by wrapping the two canvases' putImageData, which every dig/blast/burn goes
    // through). Fog: fogBase + fogLog (time, cell, value). While you're alive only the last
    // RP_KEEP seconds are kept (older patches fold into the base); from the death it runs
    // RP_AFTER more seconds and stops.
    const RP_ARR = { bullets, enemyShots, smoke, sparks, flashes, coins, fields, beams, arcs, torchP, motes,
      burns, webs, silk, strings, dparts, amb, clouds, rings, devils };
    const rid = new WeakMap();
    let ridN = 0;
    const idOf = o => { let i = rid.get(o); if (i === undefined) rid.set(o, i = ++ridN); return i; };
    const REC = { t: 0, acc: 0, snaps: [], patches: [], dirty: [], fogLog: [], tBase: null, dBase: null,
      fogBase: null, fogPrev: null, deathT: -1, done: false };
    for (const [cx, which] of [[tctx, 't'], [dctx, 'd']]) {
      const put = cx.putImageData.bind(cx);
      cx.putImageData = (im, dx, dy, x, y, w, h) => {
        if (w === undefined) return put(im, dx, dy);
        put(im, dx, dy, x, y, w, h);
        if (REC.tBase && !REC.done) REC.dirty.push([which, x, y, w, h]);
      };
    }
    function recReset() {
      REC.t = 0; REC.acc = 0; REC.snaps = []; REC.patches = []; REC.dirty = []; REC.fogLog = [];
      REC.tBase = img.data.slice(); REC.dBase = dimg ? dimg.data.slice() : null;
      REC.fogBase = seen.slice(); REC.fogPrev = seen.slice();
      REC.deathT = -1; REC.done = false;
      RT.n = 0; RT.at = -1;
      input.current.witness = null;
    }
    function recSample() {
      const pcx = p.x + PW / 2, pcy = p.y + PH / 2;
      const grab = (list, m, ty) => {
        const out = [];
        for (const o of list) {
          const x = o.x !== undefined ? o.x : o.a0x !== undefined ? o.a0x : o.ax;
          const y = ty && o[ty] !== undefined ? o[ty] : o.y !== undefined ? o.y : o.a0y !== undefined ? o.a0y : o.ay;
          if (x === undefined || (Math.abs(x - pcx) < RP_W + m && Math.abs(y - pcy) < RP_H + m)) out.push(rpClone(o, idOf(o)));
        }
        return out;
      };
      const S = { t: REC.t, time, flick, leanX, leanY, glowN, fireN, p: rpClone(p),
        ghost: ghost ? rpClone(ghost) : null };
      for (const k in RP_ARR) S[k] = grab(RP_ARR[k], 40);
      S.enemies = grab(enemies, 40, 'ty'); S.pickups = grab(pickups, 40); S.props = grab(props, 120);
      // the burning pixels in the box, and how much fuel each has left
      const fi = [];
      for (const i of fire.list) {
        const x = (i % CW) * CELL, y = ((i / CW) | 0) * CELL;
        if (Math.abs(x - pcx) < RP_W && Math.abs(y - pcy) < RP_H) fi.push(i);
      }
      S.fire = Int32Array.from(fi);
      S.fireT = Uint16Array.from(fi, i => fire.t[i]);
      REC.snaps.push(S);
      // terrain changed since the last snapshot, as it stands now
      if (REC.dirty.length) {
        for (const [w, x, y, ww, hh] of rpMerge(REC.dirty, CW, CH)) {
          const src = w === 't' ? img : dimg;
          if (src) REC.patches.push({ t: REC.t, c: w, x, y, w: ww, h: hh, px: rpCut(src.data, CW, x, y, ww, hh) });
        }
        REC.dirty.length = 0;
      }
      for (let i = 0; i < seen.length; i++)
        if (seen[i] !== REC.fogPrev[i]) { REC.fogLog.push(REC.t, i, seen[i]); REC.fogPrev[i] = seen[i]; }
      if (REC.deathT >= 0) return;
      // alive: drop what's older than RP_KEEP, folding its terrain and fog into the base
      const cut = REC.t - RP_KEEP;
      let n = 0;
      while (n < REC.snaps.length && REC.snaps[n].t < cut) n++;
      if (n) REC.snaps.splice(0, n);
      n = 0;
      while (n < REC.patches.length && REC.patches[n].t < cut) {
        const P = REC.patches[n++], base = P.c === 't' ? REC.tBase : REC.dBase;
        if (base) rpPaste(base, CW, P);
      }
      if (n) REC.patches.splice(0, n);
      n = 0;
      while (n < REC.fogLog.length && REC.fogLog[n] < cut) { REC.fogBase[REC.fogLog[n + 1]] = REC.fogLog[n + 2]; n += 3; }
      if (n) REC.fogLog.splice(0, n);
    }
    // every stepped frame: keep the clock, snapshot RP_HZ a second, and stop RP_AFTER after a death
    function recFrame(dt) {
      if (REC.done || !REC.tBase) return;
      REC.t += dt;
      if (p.dead && REC.deathT < 0) REC.deathT = REC.t;
      if ((REC.acc -= dt) > 0) return;
      REC.acc = Math.max(0, REC.acc + 1 / RP_HZ);
      recSample();
      if (REC.deathT >= 0 && REC.t >= REC.deathT + RP_AFTER) {
        REC.done = true;
        input.current.witness = { t0: Math.max(REC.snaps[0].t, REC.deathT - RP_BEFORE), t1: REC.t, death: REC.deathT };
        input.current.notify();
      }
    }

    // ---- the replay's player: rebuilds the terrain and fog for time T and draws the recorded
    // scene through draw() itself, swapped in for the live world and swapped back after ----
    let RPV = null;                       // while draw() is drawing a replay frame: the view
    const RT = { tC: null, dC: null, n: 0, at: -1, fog: null, fireT: null };
    function rpTerrain(T) {
      if (!RT.tC) {
        RT.tC = document.createElement('canvas'); RT.tC.width = CW; RT.tC.height = CH;
        RT.dC = document.createElement('canvas'); RT.dC.width = CW; RT.dC.height = CH;
        RT.fireT = new Uint16Array(CW * CH);
      }
      const tc = RT.tC.getContext('2d'), dc = RT.dC.getContext('2d');
      if (RT.at < 0 || (RT.n > 0 && REC.patches[RT.n - 1].t > T)) {     // first look, or scrubbed back
        tc.putImageData(new ImageData(REC.tBase, CW, CH), 0, 0);
        dc.clearRect(0, 0, CW, CH);
        if (REC.dBase) dc.putImageData(new ImageData(REC.dBase, CW, CH), 0, 0);
        RT.n = 0;
      }
      while (RT.n < REC.patches.length && REC.patches[RT.n].t <= T) {
        const P = REC.patches[RT.n++];
        (P.c === 't' ? tc : dc).putImageData(new ImageData(P.px, P.w, P.h), P.x, P.y);
      }
      RT.at = T;
      if (!RT.fog || RT.fog.length !== REC.fogBase.length) RT.fog = new Uint8Array(REC.fogBase.length);
      RT.fog.set(REC.fogBase);
      const L = REC.fogLog;
      for (let n = 0; n < L.length && L[n] <= T; n += 3) RT.fog[L[n + 1]] = L[n + 2];
    }
    function drawReplay(V) {
      const W = input.current.witness;
      V.t = clamp(V.t, W.t0, W.t1);
      const F = rpFrame(REC.snaps, V.t);
      rpTerrain(V.t);
      if (!V.fog) RT.fog.fill(1);          // fog off: everything counts as seen, and no overlay
      if (V.follow) { V.cx = F.p.x + PW / 2; V.cy = F.p.y + PH / 2; }
      const near = F.near;
      for (let k = 0; k < near.fire.length; k++) RT.fireT[near.fire[k]] = near.fireT[k];
      // swap the recording in
      const keepL = {};
      for (const k in RP_ARR) { const L = RP_ARR[k]; keepL[k] = L.splice(0, L.length, ...F[k]); }
      const keep = { enemies, pickups, props, fire, firePlants, seen, ghost, time, flick, leanX, leanY, glowN,
        fireN, camX, camY, unitPx, torchR, visPts, viewW, viewH, p: Object.assign({}, p) };
      enemies = F.enemies; pickups = F.pickups; props = F.props; firePlants = [];
      fire = { list: near.fire, t: RT.fireT }; seen = RT.fog;
      ghost = F.ghost; time = F.time; flick = F.flick; leanX = F.leanX; leanY = F.leanY; glowN = F.glowN; fireN = near.fireN;
      Object.assign(p, F.p);
      RPV = V;
      try { draw(); } finally {
        // and the live world back, exactly as it was
        RPV = null;
        for (const k in RP_ARR) { const L = RP_ARR[k]; L.splice(0, L.length, ...keepL[k]); }
        ({ enemies, pickups, props, fire, firePlants, seen, ghost, time, flick, leanX, leanY, glowN,
          fireN, camX, camY, unitPx, torchR, visPts, viewW, viewH } = keep);
        Object.assign(p, keep.p);
        for (let k = 0; k < near.fire.length; k++) RT.fireT[near.fire[k]] = 0;
      }
    }

    // a floor is a fresh cave with its own shop at the bottom; you keep everything else
    // `back` is a saved cave to rebuild (same seed, same perks owned on the way in), with
    // what was already taken, sold and killed stripped back out of it
    function enterLevel(back) {
      refreshBag();
      levelSeed = back ? back.seed : 1 + Math.floor(Math.random() * 2147483000);
      levelOwned = back ? back.owned : (input.current.loadout.perks || []).slice();
      const level = makeLevel(levelSeed, floor, levelOwned);
      level.enemies.forEach((e, i) => { e.sid = i; });
      if (back) {
        if (back.alive) { const live = new Set(back.alive); level.enemies = level.enemies.filter(e => live.has(e.sid)); }
        back.sold.forEach(i => { if (level.stock[i]) level.stock[i].sold = true; });
        back.rooms.forEach(i => { if (level.rooms && level.rooms[i]) level.rooms[i].taken = true; });
        if (back.pickups) level.pickups = back.pickups;
      }
      mat = level.mat; img = level.img; ore = level.ore || null;
      // minimap outlines for this floor: scan the real terrain in MINI_D x MINI_D blocks;
      // a block is an outline if a wall runs through it (it holds both rock and open), which
      // traces the cave walls continuously at a much finer grain than the fog grid.
      miniEdgeIdx = [];
      for (let my = 0; my < MMH; my++) for (let mx = 0; mx < MMW; mx++) {
        let solid = 0, open = 0;
        for (let dy = 0; dy < MINI_D; dy++) {
          const ty = my * MINI_D + dy;
          if (ty >= CH) break;
          for (let dx = 0; dx < MINI_D; dx++) {
            const tx = mx * MINI_D + dx;
            if (tx >= CW) break;
            if (mat[ty * CW + tx]) solid++; else open++;
          }
        }
        if (solid && open) miniEdgeIdx.push(my * MMW + mx);
      }
      start = level.start; portal = level.portal; arrival = level.arrival;
      enemies = level.enemies; pickups = level.pickups; stock = level.stock;
      rooms = level.rooms || []; zone = level.zone || null;
      props = level.props || []; ambKinds = level.amb || []; dimg = level.dimg;
      plantW = plantWhite(img.data, dimg && dimg.data);    // the jellies' plant glow keys off this
      dctx.putImageData(dimg, 0, 0);
      dparts.length = amb.length = clouds.length = rings.length = devils.length = 0;
      zfx = { slow: 1, slick: 0, climb: null, rev: 0, web: null, webs: 0, webMul: 1 };
      {
        const pcx0 = portal.x + portal.w / 2, pcy0 = portal.y + portal.h / 2;
        sconces = [[pcx0 - 26, pcy0 - 2], [pcx0 + 26, pcy0 - 2],
          [arrival.x - 26, arrival.y - 2], [arrival.x + 26, arrival.y - 2]];
        for (const r of rooms) sconces.push([r.x - 28, r.y - 2], [r.x + 28, r.y - 2]);
        sconces = sconces.map(([x, y], i) => ({ x, y, ph: i * 1.7 }));
      }
      roster = level.roster; themeName = level.theme;
      SFX.setAmbience(themeName);
      for (const h of bhLoops.values()) h.stop();
      bhLoops.clear();
      total = enemies.length;
      ghost = pb.ghost ? { x: level.start.x, y: level.start.y, cd: 0 } : null;
      burns.length = 0;
      webs.length = silk.length = strings.length = 0;
      // the rat burrows (see ratSolid): each room and tunnel, bar nothing — the hole too
      burrow = null; navYou.F = null;
      if (level.nests && level.nests.length) {
        burrow = new Uint8Array(CW * CH);
        for (const n of level.nests) {
          const mark = (x, y, r) => {
            for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++)
              if (xx >= 0 && yy >= 0 && xx < CW && yy < CH && Math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= r && !mat[yy * CW + xx]) burrow[yy * CW + xx] = 1;
          };
          mark(n.x + 0.5, n.y + 0.5, n.r + 3);
          for (const q of n.path) mark(q.x + 0.5, q.y + 0.5, 2.6);
        }
      }
      fire = fireNew(level.fuel || new Uint8Array(CW * CH));
      firePropN = -1;                         // fireFrame lists the plants and carts that burn
      p.burn = 0; p.burnAcc = 0;
      tctx.putImageData(img, 0, 0);
      bgctx.putImageData(level.bgImg, 0, 0);
      p.x = start.x; p.y = start.y; p.vx = 0; p.vy = 0;
      p.fuel = 1; p.empty = false; p.kick = 0;
      bullets.length = enemyShots.length = smoke.length = 0;
      sparks.length = flashes.length = coins.length = arcs.length = 0;
      torchP.length = 0; motes.length = 0;
      camReady = false; best = 0;
      levelT = 0;                             // the floor's name card gets its three seconds
      seen = fogStart(); deepFog = nestFog(level.nests);
      if (pb.seeAll) seen.fill(2);            // All-Seeing Eye lights the whole floor
      paintFog();                             // otherwise every floor starts dark again
      recReset();                             // the death replay starts afresh each floor
      matterProps = props.filter(pr => pr.k === 'matter');
      // out of the way-in, a moment after the way-out's whump
      setTimeout(() => SFX.fx('portalOut', arrival.x, arrival.y), 260);
    }

    // ---- autosave: the run as it stands, written every couple of seconds and whenever the
    // app is put away, so closing it mid-floor loses almost nothing. A dead run is wiped. ----
    function saveRun() {
      if (p.dead) return;
      const pk = pickups.filter(q => !q.taken && (q.kind === 'mod' || q.kind === 'gun'))
        .map(q => (q.kind === 'mod' ? { kind: 'mod', id: q.id, x: q.x, y: q.y, t: q.t }
          : { kind: 'gun', gun: q.gun, x: q.x, y: q.y, t: q.t, old: !!q.old }));
      const data = { ver: VERSION, floor, hp: p.hp, loadout: input.current.loadout,
        level: { seed: levelSeed, owned: levelOwned, alive: enemies.map(e => e.sid),
          sold: stock.map((it, i) => (it.sold ? i : -1)).filter(i => i >= 0),
          rooms: rooms.map((r, i) => (r.taken ? i : -1)).filter(i => i >= 0),
          pickups: pk } };
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (_) {}
    }

    // Wall torches and lanterns follow the same rule as the loot: they show once the fog
    // over them has lifted (`fogLit`), and never clear it themselves — v59 let them clear
    // a circle round themselves, which lit up every prize room on the map from the start.
    const fogLit = (x, y) => {
      const cx = clamp(Math.floor(x / FOG_U), 0, FW - 1), cy = clamp(Math.floor(y / FOG_U), 0, FH - 1);
      if (deepFog && deepFog[cy * FW + cx]) return seen[cy * FW + cx] > 0;   // a nest room: no soft edge
      // the fog bake's one-cell soft edge counts, so a torch shows exactly when an item there would
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && ny >= 0 && nx < FW && ny < FH && seen[ny * FW + nx]) return true;
      }
      return false;
    };
    // a prize room counts as found once any of it has been in your line of sight
    const roomSeen = r => {
      for (let y = r.y - ROOM_HH; y <= r.y + ROOM_HH; y += FOG_U)
        for (let x = r.x - ROOM_HW; x <= r.x + ROOM_HW; x += FOG_U) {
          const cx = clamp(Math.floor(x / FOG_U), 0, FW - 1), cy = clamp(Math.floor(y / FOG_U), 0, FH - 1);
          if (seen[cy * FW + cx]) return true;
        }
      return false;
    };
    // Repaint the whole overlay mask from the reveal grid. FW x FH is a few thousand
    // cells, and it only runs on the frames where you actually light something new.
    function paintFog() {
      const d = fogImg.data, dim = Math.round(255 * FOG_DIM), dark = Math.round(255 * FOG_DARK);
      for (let i = 0, k = 0; i < FW * FH; i++, k += 4) {
        d[k] = 9; d[k + 1] = 10; d[k + 2] = 14;
        d[k + 3] = seen[i] === 2 ? 0 : seen[i] ? dim : dark;
      }
    }
    {
      // picking up where the last session left off, if App found a save
      const sv = input.current.saved;
      input.current.saved = null;
      if (sv) {
        floor = sv.floor;
        enterLevel(sv.level);
        if (sv.hp) p.hp = Math.min(sv.hp, maxHp());
      } else enterLevel();
    }
    const saveTick = setInterval(saveRun, 2000);
    const saveHidden = () => { if (document.visibilityState === 'hidden') saveRun(); };
    document.addEventListener('visibilitychange', saveHidden);
    window.addEventListener('pagehide', saveRun);
    input.current.saveRun = saveRun;

    const resize = () => {
      const r = c.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(c.parentElement);
    window.addEventListener('resize', resize);

    // ---- mouse ----
    const mouse = input.current.mouse;
    let unitPx = 1;   // css pixels per world unit, set while drawing
    const mMove = e => {
      if (e.pointerType !== 'mouse') return;
      const r = c.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.inside = true;
    };
    const mDown = e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      mMove(e); mouse.down = true;
      try { c.setPointerCapture(e.pointerId); } catch (_) {}
    };
    const mUp = e => { if (e.pointerType === 'mouse') mouse.down = false; };
    const mLeave = e => { if (e.pointerType === 'mouse' && !mouse.down) mouse.inside = false; };
    c.addEventListener('pointermove', mMove);
    c.addEventListener('pointerdown', mDown);
    c.addEventListener('pointerup', mUp);
    c.addEventListener('pointercancel', mUp);
    c.addEventListener('pointerleave', mLeave);

    // ---- terrain queries ----
    const solidCell = (cx, cy) =>
      cx < 0 || cy < 0 || cx >= CW || cy >= CH || mat[cy * CW + cx] !== 0;
    const solidAt = (x, y) => solidCell(Math.floor(x / CELL), Math.floor(y / CELL));
    const boxHit = (x, y) => {
      const x0 = Math.floor(x / CELL), x1 = Math.floor((x + PW - 0.001) / CELL);
      const y0 = Math.floor(y / CELL), y1 = Math.floor((y + PH - 0.001) / CELL);
      for (let cy = y0; cy <= y1; cy++) {
        if (cy < 0 || cy >= CH) return true;
        for (let cx = x0; cx <= x1; cx++) {
          if (cx < 0 || cx >= CW || mat[cy * CW + cx]) return true;
        }
      }
      return false;
    };
    const lineOfSight = (x0, y0, x1, y1) => losClear(x0, y0, x1, y1, solidCell);
    const enemyAt = (x, y, pad) => {
      for (let j = 0; j < enemies.length; j++) {
        const e = enemies[j];
        if (Math.hypot(x - e.x, y - e.ty) < e.r + pad) return j;
      }
      return -1;
    };

    // one drop of goo: falls under its own gravity g, lands and sits a moment on rock
    function goo(x, y, vx, vy, g, c, size, c2) {
      if (sparks.length > 800) return;
      const life = 0.5 + Math.random() * 0.5;
      sparks.push({ x, y, vx, vy, life, max: life, c: Math.random() < 0.35 ? (c2 || '#c8ff8a') : c,
        size: size || 1.1 + Math.random() * 0.8, heavy: 1, g });
    }
    // a poison spit bursting: a little ring of goo thrown out, a bit back the way it came
    function splat(b, x, y) {
      const sp = Math.hypot(b.vx, b.vy) || 1;
      for (let i = 0; i < b.splat; i++) {
        const a = Math.random() * 6.28, v = b.splatV * (0.4 + Math.random() * 0.6);
        goo(x, y, Math.cos(a) * v - b.vx / sp * v * 0.5, Math.sin(a) * v - b.vy / sp * v * 0.5 - v * 0.3,
          b.dripG, b.dripCol || b.col, 1.3 + Math.random(), b.dripCol2);
      }
      SFX.fx('splash', x, y);
    }
    function burst(x, y, n, color) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.28, sp = 60 + Math.random() * 160;
        sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.45, max: 0.45, c: color, size: 3 });
      }
    }
    function hurt(n) {
      if (p.dead || n <= 0) return;
      // Permanent Shield soaks a hit whole, then winds back up over a couple of seconds
      if (pb.shield && p.shieldReady) {
        p.shieldReady = false; p.shieldT = 2.5;
        burst(p.x + PW / 2, p.y + PH / 2, 10, '#7ad7ff');
        SFX.ui('shield');
        return;
      }
      p.hp = Math.max(0, p.hp - n);
      p.hitT = 0.3;
      if (p.hp > 0) SFX.ui('hurt');
      if (p.hp === 0) {
        // Extra Life gets you back up once, at full health
        const LO = input.current.loadout;
        if (pb.lives > (LO.usedLives || 0)) {
          LO.usedLives = (LO.usedLives || 0) + 1;
          p.hp = maxHp();
          p.shieldReady = true; p.shieldT = 0;
          burst(p.x + PW / 2, p.y + PH / 2, 24, '#ff5a36');
          SFX.ui('revive');
          toast('Back from the dead');
          input.current.notify();
          return;
        }
        p.dead = true; burst(p.x + PW / 2, p.y + PH / 2, 24, COL.player);
        strings.length = 0;
        SFX.ui('die');
        clearSave();                          // a death is final: reopening starts a new run
      }
    }
    // one pull of an enemy's trigger: aimed at the player, and a shotgun type throws
    // its pellets in a cone. Refuses the shot if the player has broken line of sight
    // since it decided to take it.
    function fireEnemyShot(e, tx, ty) {
      const k = e.k;
      if (!lineOfSight(e.x, e.ty, tx, ty)) return;
      const base = Math.atan2(ty - e.ty, tx - e.x);
      SFX.creature(k, 'fire', e.x, e.ty);
      for (let s = 0; s < k.shots; s++) {
        const cone = k.shots > 1 ? (s - (k.shots - 1) / 2) * 0.15 : 0;
        const a = base + cone + (Math.random() - 0.5) * 0.22;
        enemyShots.push({ x: e.x + Math.cos(a) * (e.r + 4), y: e.ty + Math.sin(a) * (e.r + 4),
          vx: Math.cos(a) * k.bspd, vy: Math.sin(a) * k.bspd, life: 2.5,
          col: k.col.a, dmg: k.dmg, size: k.body === 'blob' ? 4 : 3, fire: k.fire });
      }
    }
    function damageEnemy(j, dmg) {
      const e = enemies[j];
      e.hp -= dmg; e.flash = 0.08;
      if (e.k.kp) e.aggro = true;          // hurt a spider or a jelly and it comes for you
      if (e.hp > 0) { if (dmg >= 0.5) SFX.creature(e.k, 'hurt', e.x, e.ty); return; }
      burst(e.x, e.ty, 16, e.je ? jcol('jeColBody', e.je.u.col) : e.k.col.a);
      SFX.creature(e.k, 'die', e.x, e.ty);
      enemies.splice(j, 1);
      e.dead = true;                        // its rats find out they've no home to go to
      if (e.nest) {
        // a nest: its own gold and everything its rats brought home, in a little shower
        const all = Math.round(kr('raNestGold') * pb.gold) + e.nest.stash;
        const n = Math.max(1, Math.min(14, Math.ceil(all / 8)));
        for (let k = 0; k < n; k++)
          coins.push({ x: e.x + (Math.random() - 0.5) * 8, y: e.y, amount: Math.floor(all / n) + (k < all % n ? 1 : 0),
            t: Math.random() * 6.28, vx: (Math.random() - 0.5) * 100, vy: -80 - Math.random() * 80 });
        SFX.fx('coinland', e.x, e.y);
        return;
      }
      coins.push({ x: e.x, y: e.ty,
        amount: Math.round((e.k.gold + Math.floor(Math.random() * 3)) * pb.gold),
        t: Math.random() * 6.28, vy: -60 - Math.random() * 40 });
      // a rat drops what it was carrying home
      if (e.carry > 0) coins.push({ x: e.x, y: e.ty, amount: e.carry, t: Math.random() * 6.28,
        vx: (Math.random() - 0.5) * 60, vy: -90 - Math.random() * 40 });
    }
    // ---- rats ----
    // A rat's view of the terrain: rock, plus the burrows (so it runs over a hole rather than
    // falling in and wedging in a tunnel it only ever walks as a path). burrow is per floor.
    const ratSolid = (cx, cy) => solidCell(cx, cy) || (burrow !== null && burrow[cy * CW + cx] === 1);
    // a goal's distance field, kept on `o` and made again when the goal moves or the rock changes
    // a spider's web line under a rat's feet counts as ground: rats run along webs
    const onWebIn = list => (x, y) => { for (const L of list) if (webDist(L, x, y) < 3) return true; return false; };
    const ratOnWeb = onWebIn(webs);
    function navFor(o, goal, R) {
      // (the rock changing only counts once a second, or a drill would rebuild them every frame)
      if (!o.F || (o.v !== terrainV && time - o.t > 1) || Math.hypot(goal.x - o.fx, goal.y - o.fy) > (o === navYou ? 12 : 6) ||
          (o === navYou && time - o.t > 0.4) || (o.wn !== webs.length && time - o.t > 1)) {
        // only the web lines that cross the field's square, so a floor of webs costs nothing
        const half = (R + 1) * NAV * CELL, near = webs.filter(L =>
          Math.max(L.a0x, L.b0x) > goal.x - half && Math.min(L.a0x, L.b0x) < goal.x + half &&
          Math.max(L.a0y, L.b0y) > goal.y - half && Math.min(L.a0y, L.b0y) < goal.y + half);
        o.F = navField(ratSolid, goal.x, goal.y, R, near.length ? onWebIn(near) : null);
        o.v = terrainV; o.fx = goal.x; o.fy = goal.y; o.t = time; o.wn = webs.length;
      }
      return o.F;
    }
    // a new rat, down in nest `n`'s room, on its way out up the tunnel
    function spawnRat(n) {
      const k = enemyFor('rotta', floor), P = n.nest.path, m = n.nest.mouth;
      const e = { x: P[0].x, y: P[0].y, ty: P[0].y, r: k.r, phase: Math.random() * 6.28, hp: 1, hpMax: 1,
        cd: 0, flash: 0, lx: 0, ly: 1, hx: m.x, hy: m.y, tgt: null, rest: 0, k, touch: 0, charge: 0,
        home: n, path: P, carry: 0 };
      e.ra = { mode: 'tunnel', vx: 0, vy: 0, nx: 0, ny: -1, on: 0, rest: 0, side: 1, face: 1, s: 0, dir: 1, wait: 0 };
      enemies.push(e);
      return e;
    }
    // a rat that's stuck with a job on: a hop in some direction; the third time, a carrier
    // slips into a crack and goes home underground, anyone else forgets it for a while
    function unstick(e, S, home) {
      e.stN = (e.stN || 0) + 1;
      if (e.stN >= 3 && home) {
        burst(e.x, e.y, 6, '#6a5a48');
        S.mode = 'tunnel'; S.len = pathLen(e.path); S.s = S.len * 0.7; S.dir = -1; S.wait = 0;
        e.stN = 0;
      } else if (e.stN >= 3) { e.giveUp = 4; e.aggro = false; e.stN = 0; }
      else {
        S.mode = 'air'; S.vx = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 80); S.vy = -150 - Math.random() * 120;
        e.x += S.nx * 1.5; e.y += S.ny * 1.5;
      }
    }
    // One rat's frame. What it wants, in order: home, if it has gold in its mouth; any loose
    // gold it can smell; you, if it has noticed you; else its roam spot round the nest.
    // Reaching you it bites, and knocks gold out of you over its head (triple bite if you've
    // none); reaching gold it picks it up; reaching the nest room it drops it off.
    function ratFrame(e, dt, dist, hunting, pcx, pcy) {
      const N = e.home && !e.home.dead ? e.home : null, k = e.k;
      const wake = N ? N.nest.wake || 520 : 520;
      const S = e.ra;
      // far off and not falling: asleep, so a floor full of rats costs nothing
      if (dist > wake * 1.3 && S && S.mode !== 'air') return;
      let goal = null, home = false, fast = false, jump = true, want = null;
      if (e.giveUp > 0) e.giveUp -= dt;
      if (e.carry > 0 && N) { goal = N.nest.mouth; home = true; fast = true; }
      else if (e.giveUp > 0) {
        const R = e.roam || (e.roam = {});
        roamStep(R, e, dt, Math.random, 'ra');
        goal = { x: R.rx, y: R.ry }; jump = false;
      } else {
        let bd = e.smell || (e.smell = kr('raSmell'));
        for (const g of coins) {
          if (g.nopull > 0 && g.vy < 0) continue;            // still on its way up
          const d = Math.hypot(g.x - e.x, g.y - e.y);
          if (d < bd) { bd = d; want = g; }
        }
        if (want) { goal = want; fast = true; }
        else if (hunting) { goal = { x: pcx, y: p.y + PH - 2 }; fast = true; }
        else {
          const R = e.roam || (e.roam = {});
          roamStep(R, e, dt, Math.random, 'ra');
          // keep apart from the other loose rats: the push walks this rat's roam spot away
          // from the crowd, so the pack fans out round the nest
          const D = e.spread || (e.spread = kr('raSpread')), sp = ratSpread(e, enemies.filter(o => o.ra && o.ra.mode !== 'tunnel' &&
            Math.abs(o.x - e.x) < D && Math.abs(o.y - e.y) < D), D);
          R.rx += sp.x * D * 1.5 * dt; R.ry += sp.y * D * 1.5 * dt;
          goal = { x: R.rx + sp.x * D, y: R.ry + sp.y * D }; jump = false;
        }
      }
      if (!e.arrive || Math.random() < dt) e.arrive = kr('raArrive');
      // with a job on, it follows the way there (navField) rather than a straight line
      let way = goal, follow = false, air = false;
      if (fast && S && S.mode !== 'tunnel') {
        const F = home ? navFor(N.nest, goal, 100) : want ? navFor(want, goal, 36) : navFor(navYou, goal, 56);
        const w = F && navWay(F, e.x, e.y, 1);
        if (w) { way = w.dist > 2 ? w : goal; follow = true; air = w.air && w.dist > 2; }
        // v95: getting no nearer along the way for 4s (hopping back and forth over a gap it
        // can't clear) counts as stuck, the same as standing still
        const job = home ? N : want || navYou;
        if (w && (e.jobO !== job || w.dist < e.bestD - 3)) { e.jobO = job; e.bestD = w.dist; e.bestT = 0; }
        else if (w && (e.bestT += dt) > 4) { e.bestT = 0; e.bestD = w.dist; unstick(e, S, home); }
      }
      const cold = e.chill && e.chill < 1 ? e.chill : 1;
      const ev = ratStep(e, { solidCell: ratSolid, rnd: Math.random, goal: way, hunting: fast, home, path: e.path, follow, air, onWeb: ratOnWeb,
        speedMul: cold, arrive: way === goal && !want && hunting ? e.arrive : 3, jump }, dt);
      // stuck (wedged, or running on the spot) with a job on: a hop in some direction
      if (fast && (S.mode === 'surf' || S.mode === 'path')) {
        e.stT = (e.stT || 0) + dt;
        if (e.stT > 1.2) {
          if (Math.hypot(e.x - (e.stX || 0), e.y - (e.stY || 0)) < 6 && Math.hypot(goal.x - e.x, goal.y - e.y) > 14) unstick(e, S, home);
          else if (!(e.bestT > 0)) e.stN = 0;
          e.stT = 0; e.stX = e.x; e.stY = e.y;
        }
      }
      if (ev === 'home') {
        if (N && e.carry > 0) { N.nest.stash += e.carry; SFX.fx('coinland', e.x, e.y); }
        if (N) e.carry = 0;
      } else if (ev === 'jump') SFX.creature(k, 'alert', e.x, e.y);
      if (e.ra.mode === 'tunnel') return;
      // wedged in the rock or pushed off the map somehow: back out of its hole (or gone)
      const inRock = e.x < 0 || e.x >= WW || e.y < 0 || e.y >= WH || ratSolid(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
      e.rockT = inRock ? (e.rockT || 0) + dt : 0;
      if (e.rockT > 0.5) {
        e.rockT = 0;
        if (N) { e.ra.mode = 'tunnel'; e.ra.len = pathLen(e.path); e.ra.s = e.ra.len * 0.8; e.ra.dir = 1; e.ra.wait = 0; }
        else { const j = enemies.indexOf(e); if (j >= 0) enemies.splice(j, 1); }
        return;
      }
      // a coin in reach: in its mouth
      if (want && Math.hypot(want.x - e.x, want.y - e.y) < e.r + 5) {
        const i = coins.indexOf(want);
        if (i >= 0) { coins.splice(i, 1); e.carry = (e.carry || 0) + want.amount; SFX.fx('coinland', e.x, e.y); }
      }
      // you, in reach: a bite, and a coin knocked out of you over its head
      if (hunting && !want && !(e.giveUp > 0) && !(e.carry > 0 && N) && dist < e.r + 12 && e.touch <= 0 && !p.dead) {
        const LO = input.current.loadout, broke = !(LO.gold > 0);
        hurt(Math.round(kr('raBite') * (broke ? kr('raBroke') : 1)));
        e.touch = kr('raBiteCd');
        SFX.creature(k, 'bite', e.x, e.y);
        if (!broke) {
          const amt = Math.min(LO.gold, Math.max(1, Math.round(kr('raSteal'))));
          LO.gold -= amt;
          input.current.notify();
          const side = e.x >= pcx ? 1 : -1;
          coins.push({ x: pcx, y: p.y + 4, amount: amt, t: Math.random() * 6.28,
            vx: side * kr('raPopX'), vy: -kr('raPopY'), pop: 1, nopull: 0.7 });
          SFX.ui('coin');
        }
      }
    }

    // clear rock without the bang, for drilling shots
    function dig(x, y, R) {
      const cx0 = x / CELL, cy0 = y / CELL, rc = R / CELL;
      const minX = Math.max(0, Math.floor(cx0 - rc)), maxX = Math.min(CW - 1, Math.ceil(cx0 + rc));
      const minY = Math.max(0, Math.floor(cy0 - rc)), maxY = Math.min(CH - 1, Math.ceil(cy0 + rc));
      const d = img.data;
      let changed = false, nOre = 0;
      for (let cy = minY; cy <= maxY; cy++)
        for (let cx = minX; cx <= maxX; cx++) {
          const i = cy * CW + cx;
          if (!mat[i] || mat[i] === BED) continue;
          if (Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0) > rc) continue;
          if (ore && ore[i]) { ore[i] = 0; nOre++; }
          fire.fuel[i] = 0; fire.t[i] = 0;
          mat[i] = 0; d[i * 4 + 3] = 0; changed = true;
        }
      if (burrow) for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++)
        if (burrow[cy * CW + cx] && Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0) <= rc) { burrow[cy * CW + cx] = 0; changed = true; }
      if (changed) terrainV++;
      if (changed) tctx.putImageData(img, 0, 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
      unDeco(cx0, cy0, rc, minX, minY, maxX, maxY);
      if (nOre) dropOre(x, y, nOre);
    }
    // a gold seam cut or blown open: bits of gold tumble out, as much as the rock you took.
    // Fractions carry over in oreBank, so nibbling a seam with a drill pays the same as a blast.
    function dropOre(x, y, n) {
      oreBank += n * ORE_GOLD * (1 + (floor - 1) * 0.3) * pb.gold;
      let bits = Math.min(12, Math.floor(oreBank / 2));
      if (!bits) return;
      const each = Math.floor(oreBank / bits);
      oreBank -= each * bits;
      for (let k = 0; k < bits; k++)
        coins.push({ x: x + (Math.random() - 0.5) * 6, y, amount: each, t: Math.random() * 6.28,
          vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 80 });
      SFX.fx('coinland', x, y);
    }
    // wipe the decoration layer inside a cleared circle, so baked rubble, beams and pillars
    // go with the rock round them
    function unDeco(cx0, cy0, rc, minX, minY, maxX, maxY) {
      const dd = dimg.data;
      let changed = false;
      for (let cy = minY; cy <= maxY; cy++)
        for (let cx = minX; cx <= maxX; cx++) {
          const k = (cy * CW + cx) * 4;
          if (!dd[k + 3] || Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0) > rc) continue;
          dd[k + 3] = 0; changed = true;
          fire.fuel[k >> 2] = 0; fire.t[k >> 2] = 0;
        }
      if (changed) dctx.putImageData(dimg, 0, 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
    }

    // lay solid brick down, the opposite of dig()
    function paint(x, y, w, hh) {
      const x0 = Math.max(1, Math.round(x / CELL - w / 2)), x1 = Math.min(CW - 2, x0 + w);
      const y0 = Math.max(1, Math.round(y / CELL)), y1 = Math.min(CH - 2, y0 + hh);
      const d = img.data;
      for (let cy = y0; cy < y1; cy++)
        for (let cx = x0; cx < x1; cx++) {
          const i = cy * CW + cx;
          if (mat[i]) continue;
          mat[i] = BRICK;
          const k = i * 4;
          d[k] = 132; d[k + 1] = 99; d[k + 2] = 71; d[k + 3] = 255;
        }
      if (x1 > x0 && y1 > y0) tctx.putImageData(img, 0, 0, x0, y0, x1 - x0, y1 - y0);
    }

    // ---- casting ----
    // Walk the gun's slot list from where it left off. Modifiers pile up and apply
    // to the shots that come after them; running off the end triggers the recharge.
    function cast(g, gx, gy, nx, ny) {
      const pas = gunPassives(g);
      const wrap = () => {
        g.idx = 0;
        g.rechT = g.skipRech ? 0 : effRecharge(g) * pb.rech;   // Faster Wands shortens it
        g.rechLen = g.rechT;
        g.skipRech = false;
        shuffleOrder(g);
      };
      const plan = planCast(g, input.current.loadout.guns);
      if (!plan.shots.length) { wrap(); return; }        // modifiers with nothing to modify
      const cost = pb.mana === 0 ? 0 : plan.cost;        // Unlimited Spells: nothing costs mana
      if (g.mana < cost) { g.idx = plan.start; g.delayT = 0.12; g.delayMax = 0.12; SFX.ui('empty'); return; }
      g.mana -= cost;

      const base = Math.atan2(ny, nx);
      const acts = plan.acts || [];
      let bonus = 0;                                   // damage bought with something else

      if (plan.hp && !p.dead) hurt(plan.hp);
      if (acts.includes('refresh')) { g.skipRech = true; SFX.fx('refresh'); }
      if (acts.includes('manapow')) {
        SFX.fx('drain');
        const spare = Math.max(0, g.mana - 50);
        g.mana -= spare; bonus += spare / 12;
      }
      if (acts.includes('gpower')) {
        const LO2 = input.current.loadout;
        const spend = Math.floor(LO2.gold * 0.05);
        LO2.gold -= spend; bonus += spend / 8;
        if (spend) { input.current.notify(); SFX.fx('gspend'); }
      }
      if (acts.includes('saws')) {
        SFX.fx('saws');
        for (const b of bullets) {
          b.dmg = Math.max(b.dmg, 3); b.size = 5; b.bore = 4; b.col = '#d9dde4';
          b.life = Math.max(b.life, 1.2); b.bounce = Math.max(b.bounce, 4); b.explode = 0;
        }
      }

      // where the shots come into the world. A spot buried in rock would eat the
      // whole cast, so anything that moves the origin backs off to clear ground.
      let ox = gx, oy = gy;
      const clearSpot = (tx, ty) => {
        for (let k = 0; k <= 10; k++) {
          const t = k / 10;
          const cx = tx + (gx - tx) * t, cy = ty + (gy - ty) * t;
          if (!solidAt(cx, cy)) return [cx, cy];
        }
        return [gx, gy];
      };
      if (acts.includes('far')) [ox, oy] = clearSpot(gx + nx * 95, gy + ny * 95);
      if (acts.includes('tele')) {
        let best = null, bd = 420;
        for (const e of enemies) {
          const d = Math.hypot(e.x - gx, e.ty - gy);
          if (d < bd) { bd = d; best = e; }
        }
        if (best) [ox, oy] = clearSpot(best.x - nx * 14, best.ty - ny * 14);
      }
      const warp = acts.includes('warp');
      if (warp || acts.includes('far') || acts.includes('tele')) SFX.fx('warp', ox, oy);

      for (const sh of plan.shots) spawnShot(sh, ox, oy, base, bonus, warp, 30);
      SFX.cast(plan.shots, ox === gx && oy === gy ? null : ox, oy);
      let kick = 0;
      for (const sh of plan.shots) kick += sh.recoil;
      if (kick && !p.dead) {
        kick = Math.min(220, kick * 1.4 * pb.recoil);   // Knockback / Concentrated add kick
        p.vx -= Math.cos(base) * kick;
        p.vy -= Math.sin(base) * kick;
      }
      g.delayT = plan.delay * pb.delay;                 // Concentrated slows, Faster Wands quickens
      g.delayMax = Math.max(g.delayT, 0.001);           // for the cast-delay ring on the stick
      if (plan.wrap) wrap();
    }

    // One planned shot into the world: pellets, spread, auto-aim, beams and all. It is
    // its own function because a trigger's payload comes through here too, from
    // wherever the carrier stopped. `fd` is how far ahead of the origin a static field
    // lands: a barrel's length out of the gun, and nothing at all off a trigger.
    function spawnShot(sh, ox, oy, base, bonus, warp, fd) {
      if (sh.still) { castField(sh, ox + Math.cos(base) * fd, oy + Math.sin(base) * fd, base); return; }
      const n = Math.min(24, Math.max(1, Math.round(sh.count)));
      const off = (sh.ang || 0) * Math.PI / 180;
      // perk touches: Glass/Concentrated damage, Critical/Close-Call chance, Faster
      // Projectiles speed, Bouncing/Homing paths. Close Call only counts if something is
      // right on top of you, so it is worked out once per cast, not once per pellet.
      const pd = pb.dmg;
      let pc = pb.crit;
      if (pb.close && enemies.some(e => Math.hypot(e.x - ox, e.ty - oy) < 56)) pc += 0.4;
      for (let i = 0; i < n; i++) {
        let a = base + off + (Math.random() - 0.5) * sh.spread * pb.spread * Math.PI / 180;
        if (sh.autoaim) {
          let best = null, bd = 320;
          for (const e of enemies) {
            const d = Math.hypot(e.x - ox, e.ty - oy);
            if (d < bd) { bd = d; best = e; }
          }
          if (best) a = Math.atan2(best.ty - oy, best.x - ox);
        }
        if (sh.flat) a = Math.cos(a) >= 0 ? 0 : Math.PI;
        if (sh.beam) { fireBeam(sh, ox, oy, Math.cos(a), Math.sin(a), bonus, pd, pc); continue; }
        const reach = sh.reach != null ? sh.reach : 10;
        let bx = ox + Math.cos(a) * reach, by = oy + Math.sin(a) * reach;
        if (warp) {                                   // jump forward, but not into rock
          for (let step = 0; step < 14; step++) {
            const tx = bx + Math.cos(a) * 10, ty = by + Math.sin(a) * 10;
            if (solidAt(tx, ty)) break;
            bx = tx; by = ty;
          }
        }
        bullets.push({ x: bx, y: by,
          vx: Math.cos(a) * sh.speed * pb.speed * bhSp(sh), vy: Math.sin(a) * sh.speed * pb.speed * bhSp(sh),
          life: sh.life, dmg: (sh.dmg + bonus) * pd, size: sh.size, col: sh.col, spin: 0,
          homing: Math.max(sh.homing, pb.homing), bounce: sh.bounce + pb.bounce, pierce: sh.pierce,
          explode: sh.explode, grav: sh.grav, accel: sh.accel, bore: sh.bore, hit: null,
          knock: sh.knock, crit: sh.crit + pc, boomer: sh.boomer, spiral: sh.spiral,
          pong: sh.pong, orbit: sh.orbit, homeR: sh.homeR, eat: sh.eat, pull: sh.pull,
          split: sh.split, cluster: sh.cluster, bounceFx: sh.bounceFx,
          friendly: sh.friendly, chain: sh.chain, fuse: sh.fuse,
          payload: sh.payload && sh.payload.length ? sh.payload : null, hidden: sh.hidden, arc: sh.arc,
          drift: sh.drift, pop: sh.pop, tele: sh.tele, fire: sh.fire,
          drag: sh.drag, bounceE: sh.bounceE, pit: sh.pit, wig: sh.wig, look: sh.look,
          light: sh.light, lightR: sh.lightR, vmax: sh.vmax, lifeBoom: sh.lifeBoom,
          trig: sh.trig, timer: sh.trig === 'timer' ? sh.timer : null,
          ox: bx, oy: by, age: 0, born: sh.life });
      }
    }

    // A carrier lets go of its payload: 'hit' on the first thing it touches, 'timer'
    // when its timer runs out (or on a hit first), 'expire' when it dies. It fires once;
    // anything in the payload that is itself a carrier takes its own payload along.
    function firePayload(b) {
      const list = b.payload;
      b.payload = null;
      const sp = Math.hypot(b.vx, b.vy);
      const nx = sp ? b.vx / sp : Math.cos(b.ang || 0), ny = sp ? b.vy / sp : Math.sin(b.ang || 0);
      releaseAt(list, b.x, b.y, nx, ny, b.col);
    }
    function releaseAt(list, x, y, nx, ny, col) {
      const x0 = x, y0 = y;
      // it may have stopped inside the rock, so back up along its own track until
      // there is open ground for the payload to come out into
      for (let k = 0; k < 6 && solidAt(x + nx * 10, y + ny * 10); k++) { x -= nx * 4; y -= ny * 4; }
      const base = Math.atan2(ny, nx);
      for (const sh of list) spawnShot(sh, x, y, base, 0, false, 0);
      SFX.cast(list, x0, y0);
      burst(x0, y0, 5, col);
    }

    // Lightning. A zig-zag between points: each leg is split into short kinks knocked
    // sideways, so a straight line reads as a crackling bolt.
    function jag(pts, amp) {
      // thin the path to points ~12 apart first, so a slow bolt's crowded trail still kinks
      const th = [pts[0]];
      for (let k = 1; k < pts.length; k++) {
        const q = th[th.length - 1];
        if (k === pts.length - 1 || Math.hypot(pts[k].x - q.x, pts[k].y - q.y) >= 12) th.push(pts[k]);
      }
      pts = th;
      const out = [pts[0]];
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1], c = pts[k], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 1;
        const n = Math.max(1, Math.round(d / 9)), px = -dy / d, py = dx / d;
        for (let s = 1; s < n; s++) {
          const f = s / n, o = (Math.random() - 0.5) * 2 * amp;
          out.push({ x: a.x + dx * f + px * o, y: a.y + dy * f + py * o });
        }
        out.push(c);
      }
      return out;
    }
    function addArc(pts, col, w, max) { arcs.push({ pts: jag(pts, 4), col, w, t: 0, max }); }
    // A lightning bolt remembers its last stretch of path (drawn as the bolt) and every
    // few hundredths of a second throws a fork: at a creature in reach and in sight
    // (a little damage), else at a nearby bit of rock (just the flash).
    function lightningStep(b, dt) {
      const tr = b.trail || (b.trail = [{ x: b.ox, y: b.oy }]);
      tr.push({ x: b.x, y: b.y });
      let len = 0;
      for (let k = tr.length - 1; k > 0; k--) {
        len += Math.hypot(tr[k].x - tr[k - 1].x, tr[k].y - tr[k - 1].y);
        if (len > 110) { tr.splice(0, k - 1); break; }
      }
      if ((b.arcT = (b.arcT || 0) - dt) > 0) return;
      b.arcT = 0.035 + Math.random() * 0.04;
      const R = 90, near = [];
      for (let j = 0; j < enemies.length; j++) {
        const e = enemies[j];
        if (Math.hypot(e.x - b.x, e.ty - b.y) < R && lineOfSight(b.x, b.y, e.x, e.ty)) near.push(j);
      }
      if (near.length && Math.random() < 0.75) {
        const j = near[Math.floor(Math.random() * near.length)], e = enemies[j];
        addArc([{ x: b.x, y: b.y }, { x: e.x, y: e.ty }], b.col, 1, 0.14);
        SFX.arc(e.x, e.ty);
        burst(e.x, e.ty, 3, b.col);
        damageEnemy(j, b.dmg * 0.3);
        return;
      }
      // no creature: try a few random directions for rock close by
      for (let k = 0; k < 4; k++) {
        const a = Math.random() * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
        const d = rayDist(b.x, b.y, dx, dy, 70, solidCell);
        if (d < 70 && d > 6) {
          const hx = b.x + dx * d, hy = b.y + dy * d;
          addArc([{ x: b.x, y: b.y }, { x: hx, y: hy }], b.col, 0.8, 0.12);
          SFX.arc(hx, hy);
          burst(hx, hy, 2, b.col);
          return;
        }
      }
    }

    // A beam is instant: it walks a line, damages what it touches and leaves a streak.
    function fireBeam(sh, x, y, nx, ny, bonus, pd, pc) {
      pd = pd || 1; pc = pc || 0;
      let hitAt = sh.beam;
      for (let d = 6; d <= sh.beam; d += 4) {
        const bx = x + nx * d, by = y + ny * d;
        if (sh.bore) dig(bx, by, sh.bore);
        else if (solidAt(bx, by)) { hitAt = d; break; }
        const j = enemyAt(bx, by, sh.size + 3);
        if (j >= 0) {
          damageEnemy(j, critRoll((sh.dmg + bonus) * pd, sh.crit + pc));
          burst(bx, by, 4, sh.col);
          if (sh.knock) shove(enemies[j], nx, ny, sh.knock);
          if (!sh.pierce) { hitAt = d; break; }
        }
      }
      beams.push({ x, y, nx, ny, len: hitAt, col: sh.col, w: sh.size, t: 0, look: sh.look });
      if (sh.look) {                                   // sparks off the end, and a scorched hole where it meets rock
        const ex = x + nx * hitAt, ey = y + ny * hitAt;
        for (let k = 0; k < 5; k++) glowDot(ex, ey, -nx * rnd(20, 80) + rnd(-50, 50), -ny * rnd(20, 80) + rnd(-50, 30),
          k ? sh.col : '#ffffff', rnd(0.8, 1.3), rnd(0.12, 0.3), 0.3);
        if (sh.pit && hitAt < sh.beam) dig(ex + nx * 2, ey + ny * 2, sh.pit);
      }
      if (sh.explode) explode(x + nx * hitAt, y + ny * hitAt, sh.explode);
      // a beam is instant, so whatever kind of carrier it is, the payload goes off at its end
      if (sh.payload && sh.payload.length) releaseAt(sh.payload, x + nx * hitAt, y + ny * hitAt, nx, ny, sh.col);
    }

    // Clusterbolt: the shot bursts into a handful of small explosive bolts
    function spray(b) {
      SFX.fx('cluster', b.x, b.y);
      const n = Math.min(8, b.cluster);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 140 + Math.random() * 120;
        bullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.5 + Math.random() * 0.3, dmg: Math.max(0.6, b.dmg * 0.3), size: 2,
          col: b.col, spin: 0, homing: 0, bounce: 0, pierce: 0, explode: 9,
          grav: 300, accel: 0, bore: 0, hit: null, age: 0 });
      }
      burst(b.x, b.y, 8, b.col);
    }
    // ---- v95 spell looks: what each Noita-style shot sheds as it flies, bounces and dies.
    // Trails are glowing dparts (drawn after the fog, only where it has lifted), chips are
    // sparks, puffs are smoke. `look` is set on the spell in MODS.
    const glowDot = (x, y, vx, vy, c, s, life, g) =>
      dparts.push({ x, y, vx, vy, g: g || 0, c, s, life, max: life, glow: 1 });
    const rnd = (a, b) => a + Math.random() * (b - a);
    function shotTrail(b, dt) {
      const L = b.look, sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp;
      const chance = n => Math.random() < n * dt;
      if (L === 'spark') {                    // fading pink plasma, a few specks a frame
        if (chance(70)) glowDot(b.x + rnd(-1, 1), b.y + rnd(-1, 1), rnd(-8, 8), rnd(-8, 8),
          Math.random() < 0.3 ? '#ffffff' : Math.random() < 0.6 ? '#ff9cf5' : '#d86ad0', rnd(0.8, 1.5), rnd(0.12, 0.5));
      } else if (L === 'crackle') {           // hot yellow sparks that drop away
        if (chance(22)) glowDot(b.x, b.y, -ux * 40 + rnd(-50, 50), -uy * 40 + rnd(-60, 20),
          Math.random() < 0.5 ? '#fff6c0' : '#ffd23c', rnd(0.7, 1.1), rnd(0.15, 0.35), 0.5);
      } else if (L === 'ember') {             // green flames licking off the pellet
        if (chance(40)) glowDot(b.x + rnd(-1, 1), b.y + rnd(-1, 1), -ux * 20 + rnd(-10, 10), -uy * 20 - rnd(5, 25),
          Math.random() < 0.4 ? '#e6ffc8' : '#8dff5a', rnd(0.7, 1.3), rnd(0.1, 0.25), -0.02);
      } else if (L === 'glob') {              // the odd pink drip
        if (chance(10)) glowDot(b.x, b.y, b.vx * 0.2, b.vy * 0.2, '#f578dc', rnd(0.8, 1.2), rnd(0.3, 0.6), 0.6);
      } else if (L === 'bubble') {            // tiny fizz off the skin
        if (chance(6)) glowDot(b.x + rnd(-3, 3), b.y + rnd(-3, 3), rnd(-6, 6), rnd(-20, -8),
          '#bfe8ff', rnd(0.6, 1), rnd(0.3, 0.6));
      } else if (L === 'arrow') {             // green sparks hanging in the air behind it
        if (chance(35)) glowDot(b.x - ux * 3, b.y - uy * 3, rnd(-6, 6), rnd(-6, 6),
          Math.random() < 0.3 ? '#e8ffd8' : '#78ff50', rnd(0.7, 1.2), rnd(0.5, 1.1), 0.03);
      } else if (L === 'drill') {             // a puff of blue smoke
        if (chance(18)) smoke.push({ x: b.x, y: b.y, vx: rnd(-10, 10), vy: rnd(-12, 4), r: rnd(1.2, 2.2),
          life: 0.5, max: 0.5, c: '#4e7fc8', a: 0.4 });
      } else if (L === 'sparks') {            // it IS its trail: a streak of blue sparks
        const n = Math.min(8, Math.max(1, Math.round(sp * dt / 3)));
        for (let k = 0; k < n; k++) {
          const f = k / n;
          glowDot(b.x - b.vx * dt * f + rnd(-1, 1), b.y - b.vy * dt * f + rnd(-1, 1), rnd(-15, 15), rnd(-15, 15),
            Math.random() < 0.3 ? '#ffffff' : '#8fe8ff', rnd(0.8, 1.4), rnd(0.3, 0.6));
        }
      } else if (L === 'heavy') {             // Magic Bolt: green and yellow sparks spat backward
        if (chance(45)) glowDot(b.x, b.y, -ux * rnd(20, 60) + rnd(-25, 25), -uy * rnd(20, 60) + rnd(-25, 25),
          Math.random() < 0.5 ? '#c8ff5a' : '#ffe84a', rnd(0.8, 1.3), rnd(0.2, 0.45), 0.3);
      } else if (L === 'lance') {             // sparks of its own colour peeling off the shaft
        if (chance(40)) glowDot(b.x - ux * rnd(0, 8), b.y - uy * rnd(0, 8), rnd(-12, 12), rnd(-12, 12),
          Math.random() < 0.3 ? '#ffffff' : b.col, rnd(0.7, 1.1), rnd(0.2, 0.5), 0.05);
      } else if (L === 'rubber') {            // fading green plasma
        if (chance(30)) glowDot(b.x, b.y, rnd(-5, 5), rnd(-5, 5), Math.random() < 0.5 ? '#9ef07a' : '#5ad05a', rnd(0.8, 1.3), rnd(0.2, 0.45));
      } else if (L === 'bomb') {              // the fuse fizzing
        const fx = b.x + Math.cos(b.spin * 0.5 - 1.2) * b.size, fy = b.y + Math.sin(b.spin * 0.5 - 1.2) * b.size;
        if (chance(40)) glowDot(fx, fy, rnd(-30, 30), rnd(-50, 0), Math.random() < 0.4 ? '#ffffff' : '#ffb347', rnd(0.6, 1), rnd(0.1, 0.25), 0.4);
      } else if (L === 'rocket') {            // exhaust: sparks and a rope of grey smoke
        if (chance(50)) glowDot(b.x - ux * 4, b.y - uy * 4, -ux * rnd(30, 90) + rnd(-15, 15), -uy * rnd(30, 90) + rnd(-15, 15),
          FIRE_COLS[Math.floor(Math.random() * 3)], rnd(0.8, 1.3), rnd(0.08, 0.2));
        if (chance(25)) smoke.push({ x: b.x - ux * 5, y: b.y - uy * 5, vx: rnd(-6, 6), vy: rnd(-8, 2), r: rnd(1.2, 2.4),
          life: 0.9, max: 0.9, c: '#5a5652', a: 0.4 });
      } else if (L === 'flame') {             // fire licking up off it, and smoke off the big ones
        const big = b.size >= 4;
        if (chance(big ? 70 : 40)) glowDot(b.x + rnd(-b.size, b.size), b.y + rnd(-b.size, b.size), -ux * 20 + rnd(-15, 15), -uy * 20 - rnd(10, 40),
          FIRE_COLS[Math.floor(Math.random() * 3)], rnd(0.8, 1.2 + b.size * 0.2), rnd(0.12, 0.35), -0.03);
        if (chance(big ? 14 : 5)) smoke.push({ x: b.x, y: b.y, vx: rnd(-6, 6), vy: rnd(-14, -4), r: rnd(1.5, 1 + b.size * 0.6),
          life: 1, max: 1, c: '#3a3430', a: 0.35 });
      } else if (L === 'orb') {               // fading plasma of its colour
        if (chance(35)) glowDot(b.x + rnd(-b.size, b.size) * 0.6, b.y + rnd(-b.size, b.size) * 0.6, rnd(-6, 6), rnd(-6, 6),
          Math.random() < 0.3 ? '#e8f4ff' : b.col, rnd(0.8, 1.4), rnd(0.2, 0.5));
      } else if (L === 'chain') {             // bright violet sparks jumping off it
        if (chance(35)) glowDot(b.x, b.y, rnd(-60, 60), rnd(-60, 60), Math.random() < 0.3 ? '#ffffff' : '#e0a0ff', rnd(0.7, 1.1), rnd(0.08, 0.2));
      } else if (L === 'cross') {             // cyan plasma off its arms
        if (chance(25)) { const a = b.spin * 0.8 + Math.floor(Math.random() * 4) * 1.571;
          glowDot(b.x + Math.cos(a) * b.size * 1.6, b.y + Math.sin(a) * b.size * 1.6, rnd(-6, 6), rnd(-6, 6), b.col, rnd(0.8, 1.2), rnd(0.2, 0.4)); }
      } else if (L === 'nuke') {              // dripping radioactive green, and smoke
        if (chance(20)) glowDot(b.x, b.y + b.size * 0.6, b.vx * 0.1, b.vy * 0.1, Math.random() < 0.5 ? '#b4ff5a' : '#6adf3a', rnd(1, 1.6), rnd(0.5, 0.9), 0.6);
        if (chance(10)) smoke.push({ x: b.x - ux * 6, y: b.y - uy * 6, vx: rnd(-5, 5), vy: rnd(-10, 0), r: rnd(2, 3), life: 1, max: 1, c: '#4a4a40', a: 0.35 });
      } else if (L === 'pollen') {            // yellow dust drifting off it
        if (chance(8)) glowDot(b.x + rnd(-2, 2), b.y + rnd(-2, 2), rnd(-5, 5), rnd(-8, 2),
          '#e8ff9a', rnd(0.6, 0.9), rnd(0.4, 0.8), -0.01);
      }
    }
    function shotBounce(b) {
      const L = b.look;
      if (L === 'glob') for (let k = 0; k < 2; k++)
        glowDot(b.x, b.y, rnd(-40, 40), rnd(-50, -10), '#f578dc', 1, rnd(0.15, 0.3), 0.6);
      else if (L === 'bubble') glowDot(b.x, b.y, 0, 0, '#bfe8ff', 1.4, 0.12);
      else if (L === 'ember') for (let k = 0; k < 3; k++)
        glowDot(b.x, b.y, rnd(-60, 60), rnd(-60, -10), '#8dff5a', 1, rnd(0.1, 0.25), 0.4);
      else if ((L === 'disc' || L === 'flame' || L === 'rubber' || L === 'orb') && Math.hypot(b.vx, b.vy) > 60)
        for (let k = 0; k < (L === 'disc' ? 5 : 2); k++)            // a saw skipping off rock throws sparks
          glowDot(b.x, b.y, rnd(-70, 70), rnd(-80, -10), L === 'disc' ? (Math.random() < 0.5 ? '#ffe7a0' : '#ffb347') : L === 'flame' ? '#ffb347' : b.col,
            rnd(0.7, 1.1), rnd(0.1, 0.25), 0.5);
    }
    function shotDeath(b) {
      const L = b.look;
      if (L === 'bubble') {                   // it pops: a ring of droplets
        SFX.pop(b.x, b.y);
        for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283;
          glowDot(b.x + Math.cos(a) * b.size, b.y + Math.sin(a) * b.size, Math.cos(a) * 45, Math.sin(a) * 45,
            '#bfe8ff', 1, rnd(0.15, 0.3), 0.3); }
      } else if (L === 'spark' || L === 'arrow' || L === 'crackle') {
        const c = L === 'spark' ? '#ff9cf5' : L === 'arrow' ? '#78ff50' : '#ffe066';
        for (let k = 0; k < 5; k++) glowDot(b.x, b.y, rnd(-70, 70), rnd(-70, 40), k ? c : '#ffffff', 1, rnd(0.12, 0.3), 0.3);
      } else if (L === 'glob') {
        for (let k = 0; k < 4; k++) glowDot(b.x, b.y, rnd(-50, 50), rnd(-60, 0), '#f578dc', 1.1, rnd(0.2, 0.4), 0.6);
      } else if (L === 'orb' || L === 'chain' || L === 'rubber' || L === 'heavy') {   // bursts into its own sparks
        for (let k = 0; k < 7; k++) glowDot(b.x, b.y, rnd(-80, 80), rnd(-80, 60), k ? b.col : '#ffffff', rnd(0.8, 1.3), rnd(0.15, 0.35), 0.3);
      }
    }
    // a digging bolt chewing rock: chips of whatever it's chewing thrown back out
    function shotGrind(b, x, y) {
      if (b.look !== 'drill' || Math.random() < 0.5) return;
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
      if (cx < 0 || cy < 0 || cx >= CW || cy >= CH || !mat[cy * CW + cx]) return;
      const k = (cy * CW + cx) * 4, d = img.data, sp = Math.hypot(b.vx, b.vy) || 1;
      sparks.push({ x, y, vx: -b.vx / sp * rnd(40, 110) + rnd(-50, 50), vy: -b.vy / sp * rnd(40, 110) - rnd(20, 70),
        life: rnd(0.4, 0.8), max: 0.8, c: 'rgb(' + d[k] + ',' + d[k + 1] + ',' + d[k + 2] + ')', size: rnd(1, 1.8), heavy: true });
    }
    // Brimstone: burning sparks thrown out of the blast, lighting what they land on
    function throwEmbers(x, y, n) {
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 4.2, v = 60 + Math.random() * 150;
        dparts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, g: 0.45,
          c: FIRE_COLS[Math.floor(Math.random() * 3)], s: 1 + Math.random() * 0.8, life: 0.7 + Math.random() * 0.6, max: 1.3,
          glow: 1, ember: 1 });
      }
    }
    // Death Cross: four arms of blast rather than one round crater
    function explodeCross(b) {
      const R = b.explode || 20;
      explode(b.x, b.y, R * 0.6);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        explode(b.x + dx * R * 0.9, b.y + dy * R * 0.9, R * 0.55);
    }

    const critRoll = (dmg, chance) => (chance && Math.random() < chance ? (SFX.fx('crit'), dmg * 3) : dmg);
    const shove = (e, nx, ny, force) => {
      e.x += nx * force * 0.03; e.y += ny * force * 0.03; e.tgt = null;
    };

    // Static projectiles: they sit where you cast them and work over time.
    function castField(sh, x, y, ang) {
      const pay = sh.payload && sh.payload.length ? sh.payload : null;
      if (sh.field === 'explode') {
        explode(x, y, sh.r, undefined, sh.fire);
        if (sh.embers) throwEmbers(x, y, sh.embers);
        if (pay) releaseAt(pay, x, y, Math.cos(ang || 0), Math.sin(ang || 0), sh.col);
        return;
      }
      fields.push({ x, y, r: sh.r, field: sh.field, life: sh.life, max: sh.life,
        col: sh.col, dmg: sh.dmg || 1, tick: 0, payload: pay, ang: ang || 0, trig: sh.trig });
    }
    // Teleport Bolt: put you where the bolt stopped. It may have stopped against rock, so
    // back up along its own track (and nudge up/down) until your whole body fits; if
    // nowhere near fits, it fizzles and you stay put.
    function teleportTo(b) {
      if (p.dead) return;
      const sp = Math.hypot(b.vx, b.vy), nx = sp ? b.vx / sp : 0, ny = sp ? b.vy / sp : 0;
      for (let back = 0; back <= 40; back += 3)
        for (const dy of [0, -4, 4, -8, 8, -12, 12, -16, 16]) {
          const x = b.x - nx * back - PW / 2, y = b.y - ny * back - PH / 2 + dy;
          if (x < CELL * 3 || y < CELL * 3 || x + PW > WW - CELL * 3 || y + PH > WH - CELL * 3) continue;
          if (boxHit(x, y)) continue;
          burst(p.x + PW / 2, p.y + PH / 2, 10, b.col);
          p.x = x; p.y = y; p.vx = 0; p.vy = 0;
          burst(p.x + PW / 2, p.y + PH / 2, 12, b.col);
          SFX.fx('warp', p.x + PW / 2, p.y + PH / 2);
          return;
        }
      burst(b.x, b.y, 4, b.col);
      SFX.fx('fizzle', b.x, b.y);
    }
    // a crystal "with Trigger" casts what it carries when it goes off
    const fieldPayload = f => {
      if (!f.payload) return;
      const list = f.payload; f.payload = null;
      releaseAt(list, f.x, f.y, Math.cos(f.ang), Math.sin(f.ang), f.col);
    };

    // ---- fire (v86): the cave's fire runs in fireStep; this is what it does to the level ----
    // A pixel whose fuel is spent: grass and timber go (a fleck of ash now and then stays),
    // moss leaves the rock under it scorched. Changed areas are put back once a frame.
    const fireBox = { t: [CW, CH, -1, -1], d: [CW, CH, -1, -1] };
    const growBox = (b, x, y) => { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; };
    function fireOut(i) {
      const x = i % CW, y = (i / CW) | 0, k = i * 4, r = Math.random();
      if (mat[i]) {
        const d = img.data;
        d[k] = 34 + r * 16; d[k + 1] = 28 + r * 12; d[k + 2] = 24 + r * 10;
        growBox(fireBox.t, x, y);
      } else if (dimg) {
        const dd = dimg.data;
        if (r < 0.16) { const a = 30 + r * 120; dd[k] = a; dd[k + 1] = a * 0.9; dd[k + 2] = a * 0.85; }
        else dd[k + 3] = 0;
        growBox(fireBox.d, x, y);
      }
    }
    function flushFire() {
      for (const [b, c, im] of [[fireBox.t, tctx, img], [fireBox.d, dctx, dimg]]) {
        if (b[2] < b[0] || !im) continue;
        c.putImageData(im, 0, 0, b[0], b[1], b[2] - b[0] + 1, b[3] - b[1] + 1);
        b[0] = CW; b[1] = CH; b[2] = -1; b[3] = -1;
      }
    }
    // a plant catches: it burns up from its tip toward the rock it hangs from
    function catchPlant(pr) {
      if (pr.burn || pr.gone) return;
      pr.burn = 1;
      SFX.fx('whoosh', pr.x, pr.y + pr.len);
    }
    // an arched vine catches at fraction u along it; the fire runs out both ways from there
    function catchArch(pr, u) {
      if (pr.burn || pr.gone) return;
      pr.burn = 1; pr.u0 = pr.u1 = u;
      const q = archAt(pr, u);
      SFX.fx('whoosh', q.x, q.y);
    }
    // a web line catches: it flares along its length and is gone
    function burnWeb(w) {
      const L = webs[w];
      for (let u = 0; u <= 1; u += 0.1)
        dparts.push({ x: L.a0x + (L.b0x - L.a0x) * u, y: L.a0y + (L.b0y - L.a0y) * u, vx: (Math.random() - 0.5) * 20,
          vy: -20 - Math.random() * 30, g: -0.02, c: Math.random() < 0.5 ? '#ffd35a' : '#ff8a2a', s: 1.4, life: 0.4, max: 0.4, glow: 1 });
      webs.splice(w, 1);
      SFX.fx('whoosh', (L.a0x + L.b0x) / 2, (L.a0y + L.b0y) / 2);
    }
    // everything that burns within r of (x, y) catches at `chance`: grass, moss and timber
    // pixels, plants, web lines — and a minecart goes up
    function ignite(x, y, r, chance) {
      fireList();
      const n = fireArea(fire, x, y, r, chance);
      for (const pr of firePlants)
        if (!pr.gone && !pr.burn && x > pr.x - 5 - r && x < pr.x + 5 + r && y > pr.y - r && y < pr.y + pr.len + r &&
          Math.random() < chance) catchPlant(pr);
      for (let w = webs.length - 1; w >= 0; w--) if (webDist(webs[w], x, y) < r + 2 && Math.random() < chance) burnWeb(w);
      for (const pr of fireArches) {
        if (pr.gone || pr.burn || x < pr.x + pr.l - r || x > pr.x + pr.r + r || y < pr.y + pr.t0 - r || y > pr.y + pr.b + r) continue;
        const q = archNear(pr, x, y);
        if (q.d < r + 3 && Math.random() < chance) catchArch(pr, q.k / (pr.arc.length - 1));
      }
      for (const pr of fireCarts)
        if (!pr.gone && x > pr.x + pr.l - r && x < pr.x + pr.r + r && y > pr.y + pr.t0 - r && y < pr.y + pr.b + r &&
          Math.random() < chance) blowProp(pr);
      if (n > 4) SFX.fx('whoosh', x, y);
      return n;
    }
    function setAlight(e) {
      if (!(e.burn > 0)) SFX.fx('whoosh', e.x, e.ty);
      e.burn = Math.max(e.burn || 0, kr('fireBurn'));
    }
    function youAlight() {
      if (p.dead) return;
      if (!(p.burn > 0)) { SFX.fx('whoosh', p.x + PW / 2, p.y + PH / 2); strings.length = 0; }   // spider silk burns off
      p.burn = Math.max(p.burn || 0, kr('fireYou'));
    }
    // a blast's heat: fuel round it catches, and creatures (and you) in it may go up
    function fireBlast(x, y, R, hot) {
      const ch = hot ? 0.9 : kr('fireBoom');
      ignite(x, y, R * 1.3, ch);
      for (const e of enemies) if (Math.hypot(e.x - x, e.ty - y) < R + e.r && Math.random() < ch) setAlight(e);
      if (!p.dead && Math.hypot(p.x + PW / 2 - x, p.y + PH / 2 - y) < R + 6 && Math.random() < ch * 0.5) youAlight();
    }
    // a flame licking up off a burning spot
    const flameAt = (x, y, sp) => dparts.push({ x, y, vx: (Math.random() - 0.5) * 16, vy: -30 - Math.random() * (sp || 40),
      g: -0.03, c: Math.random() < 0.4 ? '#ffd35a' : Math.random() < 0.6 ? '#ff8a2a' : '#e8461c', s: 1 + Math.random() * 1.2,
      life: 0.25 + Math.random() * 0.3, max: 0.55, glow: 1 });
    const fireSmoke = (x, y) => smoke.push({ x, y, vx: (Math.random() - 0.5) * 12, vy: -25 - Math.random() * 20,
      r: 2 + Math.random() * 2.5, life: 1.4, max: 1.4, c: '#2a2624', a: 0.35 });
    // One frame of fire: the cave's fire moves on, plants, webs and carts catch off it,
    // burning creatures (and you) take damage and spread it, flames and smoke come off
    // what's on view, and the crackle sits at the nearest blaze.
    // the props that burn, relisted whenever props came or went (a test room, a drop)
    function fireList() {
      if (props.length === firePropN && props[props.length - 1] === firePropLast) return;
      firePropN = props.length; firePropLast = props[props.length - 1];
      firePlants = props.filter(pr => pr.k === 'climb' && FLAMMABLE[pr.st] && !pr.arc);
      fireArches = props.filter(pr => pr.arc && FLAMMABLE[pr.st]);
      fireCarts = props.filter(pr => pr.k === 'barrel');
    }
    function fireFrame(dt, pcx, pcy) {
      fireList();
      const ticks = fireStep(fire, dt, fireOut);
      fireN += ticks;
      const L = fire.list, any = L.length > 0;
      if (ticks && any) {
        for (let k = fireN & 3; k < firePlants.length; k += 4) {       // a quarter of the plants a tick
          const pr = firePlants[k];
          if (pr.gone || pr.burn) continue;
          for (let yy = pr.y + 2; yy < pr.y + pr.len; yy += 8) if (fireNear(fire, pr.x, yy, 2)) { catchPlant(pr); break; }
        }
        for (const pr of fireArches) {
          if (pr.gone || pr.burn) continue;
          const n = pr.arc.length - 1;
          for (let k = 0; k <= n; k += 2) { const q = archAt(pr, k / n); if (fireNear(fire, q.x, q.y, 2)) { catchArch(pr, k / n); break; } }
        }
        for (let w = webs.length - 1; w >= 0; w--) {
          const W = webs[w];
          for (let u = 0; u <= 1; u += 0.25)
            if (fireNear(fire, W.a0x + (W.b0x - W.a0x) * u, W.a0y + (W.b0y - W.a0y) * u, 2)) { burnWeb(w); break; }
        }
        for (const pr of fireCarts) if (!pr.gone && fireNear(fire, pr.x, pr.y - 4, 8)) blowProp(pr);
      }
      // burning plants: the fire climbs from the tip to the rock, lighting what's round it
      for (const pr of firePlants) {
        if (!pr.burn || pr.gone) continue;
        pr.len -= kr('firePlant') * dt; pr.b = Math.max(0, pr.len);
        const ty = pr.y + Math.max(0, pr.len);
        if (Math.random() < dt * 30) flameAt(pr.x + (Math.random() - 0.5) * 4, ty);
        if (Math.random() < dt * 4) fireSmoke(pr.x, ty);
        if (ticks) {
          fireArea(fire, pr.x, ty, 5, 0.3);
          for (const o of firePlants)
            if (!o.burn && !o.gone && Math.abs(o.x - pr.x) < 10 && ty > o.y - 4 && ty < o.y + o.len + 4 && Math.random() < 0.25) catchPlant(o);
          if (!p.dead && zfx.climb === pr) youAlight();
        }
        if (pr.len < 4) { pr.gone = true; fireArea(fire, pr.x, pr.y, 6, 1); }
      }
      // burning arched vines: the fire runs both ways along it from where it caught, lighting
      // the strands as it reaches them, and the vine is gone when it meets both ends
      for (const pr of fireArches) {
        if (!pr.burn || pr.gone) continue;
        const du = kr('fireArch') * dt / Math.max(1, pr.alen);
        pr.u0 = Math.max(0, pr.u0 - du); pr.u1 = Math.min(1, pr.u1 + du);
        for (const u of [pr.u0, pr.u1]) {
          const q = archAt(pr, u);
          if (Math.random() < dt * 30) flameAt(q.x + (Math.random() - 0.5) * 4, q.y);
          if (Math.random() < dt * 4) fireSmoke(q.x, q.y);
          if (ticks) fireArea(fire, q.x, q.y, 5, 0.3);
        }
        if (ticks) {
          for (const o of firePlants) if (o.on === pr && !o.burn && !o.gone && o.u >= pr.u0 && o.u <= pr.u1) catchPlant(o);
          if (!p.dead && zfx.climb === pr) youAlight();
        }
        if (pr.u0 <= 0 && pr.u1 >= 1) pr.gone = true;
      }
      // burning creatures: hurt in chunks (so they flash, not flicker), spread it where they go
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (ticks && any && !(e.burn > 0) && fireNear(fire, e.x, e.ty, e.r * 0.7)) setAlight(e);
        if (!(e.burn > 0)) continue;
        e.burn -= dt;
        e.burnAcc = (e.burnAcc || 0) + kr('fireDps') * dt;
        if (Math.random() < dt * 40) flameAt(e.x + (Math.random() - 0.5) * e.r * 1.4, e.ty + (Math.random() - 0.3) * e.r);
        if (Math.random() < dt * 6) fireSmoke(e.x, e.ty - e.r);
        if (ticks) ignite(e.x, e.ty + e.r * 0.4, e.r * 0.8, 0.35);
        if (!p.dead && Math.hypot(e.x - pcx, e.ty - pcy) < e.r + 8 && Math.random() < dt * 2) youAlight();
        if (e.burnAcc >= 0.5 || e.burn <= 0) { const d = e.burnAcc; e.burnAcc = 0; if (d > 0 && enemies[j] === e) damageEnemy(j, d); }
      }
      // you: fire underfoot or round you lights you; water, snow or slime puts you out
      if (!p.dead) {
        if (ticks && any && !(p.burn > 0) && (fireNear(fire, pcx, p.y + PH - 3, 3) || fireNear(fire, pcx, pcy, 3))) youAlight();
        if (p.burn > 0 && FIRE_WET[zfx.surface]) { p.burn = 0; p.burnAcc = 0; SFX.fx('sizzle', pcx, p.y + PH); }
        if (p.burn > 0) {
          p.burn -= dt;
          p.burnAcc = (p.burnAcc || 0) + kr('fireYouDps') * dt;
          if (Math.random() < dt * 40) flameAt(p.x + Math.random() * PW, p.y + PH * (0.2 + Math.random() * 0.8));
          if (Math.random() < dt * 6) fireSmoke(pcx, p.y);
          if (ticks) fireArea(fire, pcx, p.y + PH - 2, 5, 0.3);
          if (p.burnAcc >= 2 || p.burn <= 0) { const d = Math.round(p.burnAcc); p.burnAcc -= d; if (d > 0) hurt(d); }
        }
      } else p.burn = 0;
      // flames and smoke off the burning pixels you can see, and the crackle at the nearest blaze
      if (any) {
        const x0 = camX / CELL - 4, x1 = (camX + viewW) / CELL + 4, y0 = camY / CELL - 4, y1 = (camY + viewH) / CELL + 4;
        const want = Math.min(20, Math.ceil(L.length * dt * 2.5));
        for (let a = 0, got = 0; a < want * 3 && got < want && dparts.length < 700; a++) {
          const i = L[(Math.random() * L.length) | 0], x = i % CW, y = (i / CW) | 0;
          if (x < x0 || x > x1 || y < y0 || y > y1) continue;
          got++;
          flameAt((x + Math.random()) * CELL, y * CELL);
          if (Math.random() < 0.12) fireSmoke(x * CELL, y * CELL - 3);
        }
        const st = Math.max(1, Math.floor(L.length / 300));
        let bd = HEAR_FIRE, bx = 0, by = 0, near = 0;
        for (let k = 0; k < L.length; k += st) {
          const x = (L[k] % CW) * CELL, y = ((L[k] / CW) | 0) * CELL, d = Math.hypot(x - pcx, y - pcy);
          if (d < 220) near += st;
          if (d < bd) { bd = d; bx = x; by = y; }
        }
        if (bd < HEAR_FIRE) {
          if (!fireLoop && SFX.ready) fireLoop = SFX.loop('fire');
          if (fireLoop) fireLoop.set(Math.min(1, 0.35 + near / 300) * 0.7, bx, by);
        }
      }
      flushFire();
    }
    // `splash` set = a small pop (Pollen): enemies take that instead, and it never hurts you.
    // Any other blast can set things alight (fireBoom); `hot` (fire spells, minecarts) nearly always does.
    function explode(x, y, R, splash, hot) {
      SFX.boom(x, y, R);
      const cx0 = x / CELL, cy0 = y / CELL, rc = R / CELL, ring = rc + 2.5;
      const minX = Math.max(0, Math.floor(cx0 - ring)), maxX = Math.min(CW - 1, Math.ceil(cx0 + ring));
      const minY = Math.max(0, Math.floor(cy0 - ring)), maxY = Math.min(CH - 1, Math.ceil(cy0 + ring));
      const d = img.data;
      let debris = 0, nOre = 0;
      for (let cy = minY; cy <= maxY; cy++) {
        for (let cx = minX; cx <= maxX; cx++) {
          const i = cy * CW + cx, m = mat[i];
          if (!m) continue;
          const dist = Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0);
          const k = i * 4;
          if (dist <= rc && m !== BED) {
            if (debris < 40 && Math.random() < 0.08) {
              debris++;
              const f = 0.5 + Math.random();
              sparks.push({ x: cx * CELL, y: cy * CELL,
                vx: (cx - cx0) / rc * 220 * f, vy: ((cy - cy0) / rc * 220 - 140) * f,
                life: 0.8 + Math.random() * 0.4, max: 1.2, c: `rgb(${d[k]},${d[k + 1]},${d[k + 2]})`, size: 2, heavy: true });
            }
            if (ore && ore[i]) { ore[i] = 0; nOre++; }
            fire.fuel[i] = 0; fire.t[i] = 0;
            mat[i] = 0;
            d[k + 3] = 0;
          } else if (dist <= ring) {
            d[k] *= 0.72; d[k + 1] *= 0.72; d[k + 2] *= 0.72;   // scorch the crater edge
          }
        }
      }
      tctx.putImageData(img, 0, 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
      unDeco(cx0, cy0, rc, minX, minY, maxX, maxY);
      if (nOre) dropOre(x, y, nOre);
      if (burrow) for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++)
        if (Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0) <= rc) burrow[cy * CW + cx] = 0;
      terrainV++;
      // a blast knocks the props about: carts and pods go off, pillars crack, icicles let go
      for (const pr of props) {
        if (pr.gone || Math.abs(pr.x - x) > R + 40 || Math.abs(pr.y - y) > R + 40) continue;
        const bx = clamp(x, pr.x + pr.l, pr.x + pr.r), by = clamp(y, pr.y + pr.t0, pr.y + pr.b);
        if (Math.hypot(bx - x, by - y) < R + 6) pr.hurt = (pr.hurt || 0) + 2;
      }

      flashes.push({ x, y, r: R, t: 0 });
      for (let i = 0; i < (splash != null ? 2 : 10); i++) {
        smoke.push({ x: x + (Math.random() - 0.5) * R, y: y + (Math.random() - 0.5) * R,
          vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40 - 20,
          r: 4 + Math.random() * 5, life: 1.2, max: 1.2 });
      }
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j], dist = Math.hypot(e.x - x, e.ty - y);
        if (dist < R + e.r) damageEnemy(j, splash != null ? splash : dist < R * 0.5 ? 3 : 2);
      }
      if (splash != null) return;
      fireBlast(x, y, R, hot);
      const pcx = p.x + PW / 2, pcy = p.y + PH / 2;
      const dist = Math.hypot(pcx - x, pcy - y), reach = R + 10;
      if (dist < reach && !p.dead) {
        const f = 1 - dist / reach;
        hurt(Math.round(25 * f));
        const nx = (pcx - x) / (dist || 1), ny = (pcy - y) / (dist || 1);
        p.vx += nx * 500 * f;
        p.vy += ny * 500 * f - 150 * f;
        p.kick = 0.25;
      }
    }

    // ---- decoration, pass 3: the props at work ----
    const pOver = (pr, pad) => p.x + PW > pr.x + pr.l - pad && p.x < pr.x + pr.r + pad &&
      p.y + PH > pr.y + pr.t0 - pad && p.y < pr.y + pr.b + pad;
    // a loud noise: every creature within earshot comes looking, and shooters get ready
    function alertAt(x, y) {
      rings.push({ x, y, t: 0 });
      for (const e of enemies) {
        if (Math.hypot(e.x - x, e.ty - y) > 320) continue;
        if (HUNTERS[e.k.act]) e.aggro = true;
        else e.cd = Math.min(e.cd, 0.3);
      }
    }
    // what a breakable prop is made of, for the sound it breaks with
    const MATERIAL = { icicle: 'ice', geode: 'crystal', salt: 'salt', bone: 'bone', obsidian: 'glass', shard: 'glass' };
    function shatter(pr, n) {
      SFX.fx('shatter', pr.x, pr.y + (pr.t0 + pr.b) / 2, MATERIAL[pr.st] || 'stone');
      burst(pr.x, pr.y + (pr.t0 + pr.b) / 2, n || 10, propCol(pr, themeFor(floor)));
      pr.gone = true;
    }
    function blowProp(pr) {
      if (pr.gone) return;
      pr.gone = true;                          // first, so a chain of blasts can't loop
      if (pr.k === 'barrel') { explode(pr.x, pr.y - 6, 105, undefined, 1); SFX.debris(pr.x, pr.y - 6); }
      else if (pr.k === 'pod') {
        SFX.pop(pr.x, pr.y - 6);
        clouds.push({ x: pr.x, y: pr.y - 8, r: 34, life: 4.5, max: 4.5, tick: 0 });
        burst(pr.x, pr.y - 6, 14, '#b6e36a');
      }
    }
    // a lantern shot (or dropped, or blasted): the glass goes and its burning oil is thrown
    // out in blobs that light whatever burnable they fall through or land on
    function popLamp(pr) {
      if (pr.gone) return;
      pr.gone = true;
      let x = pr.x, y = pr.y;
      if (pr.st === 'hanglamp') y += pr.len + 4.5; else x -= pr.side * 5;
      SFX.fx('shatter', x, y, 'glass');
      SFX.fx('whoosh', x, y);
      burst(x, y, 6, '#fff2c0');
      for (let k = 0; k < 16; k++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 3.4, v = 50 + Math.random() * 120;
        dparts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, g: 0.45,
          c: FIRE_COLS[Math.floor(Math.random() * 3)], s: 1.2 + Math.random() * 0.9, life: 1.2 + Math.random() * 0.8, max: 2,
          glow: 1, ember: 1 });
      }
      ignite(x, y, 6, 0.8);
    }
    // a prop whose rock has gone hits the ground: it breaks, blows, or settles there
    function landProp(pr) {
      pr.fall = false; pr.vy = 0;
      if (pr.k === 'barrel' || pr.k === 'pod') { blowProp(pr); return; }
      if (pr.k === 'lamp' && pr.st !== 'cap') { popLamp(pr); return; }
      const stands = !pr.hang && !pr.side && (pr.k === 'cover' || pr.k === 'pad' || pr.k === 'noise' ||
        pr.k === 'spike' || pr.k === 'lamp' || pr.k === 'tendril' || pr.k === 'vent');
      if (!stands) { shatter(pr); return; }
      SFX.fx('propLand', pr.x, pr.y);
      const cy = Math.floor((pr.y + pr.b + 1) / CELL);
      pr.y = cy * CELL - pr.b;
      pr.anc = [Math.floor(pr.x / CELL), cy];
    }
    function spawnDrip(pr) {
      const r = Math.random, st = pr.st;
      if (st === 'water') return { x: pr.x + (r() - 0.5) * 2, y: pr.y + 3, vx: 0, vy: 0, g: 0.9, c: '#7ec8ff', s: 1.5, life: 3, max: 3, splash: 1, snd: 'drip' };
      if (st === 'lava') return { x: pr.x + (r() - 0.5) * 2, y: pr.y + 3, vx: 0, vy: 0, g: 0.8, c: '#ff7a2a', s: 2, life: 3, max: 3, dmg: PROP_DMG.lava, glow: 1, splash: 1, snd: 'sizzle' };
      if (st === 'soot') return { x: pr.x + (r() - 0.5) * 10, y: pr.y + 1, vx: 0, vy: 12 + r() * 14, g: 0.01, c: 'rgba(16,16,20,0.8)', s: 1.3 + r(), life: 3.5, max: 3.5, wob: r() * 9 };
      if (st === 'crystal') return { x: pr.x + (r() - 0.5) * 14, y: pr.y + 2, vx: 0, vy: 6 + r() * 10, g: 0.004, c: r() < 0.5 ? '#e0b0ff' : '#b070ff', s: 1 + r() * 0.6, life: 4, max: 4, wob: r() * 9, glow: 1 };
      if (st === 'cascade') return { x: pr.x + (r() - 0.5) * 9, y: pr.y + 2, vx: (r() - 0.5) * 6, vy: 50 + r() * 40, g: 0.9, c: 'rgba(150,205,255,0.75)', s: 1.6 + r(), life: 2.5, max: 2.5, splash: 1, snd: 'splash' };
      if (st === 'steam') {
        const s = -pr.side, oil = r() < 0.15;
        return oil ? { x: pr.x + s * 8, y: pr.y + 2, vx: s * 10, vy: 0, g: 0.8, c: '#3a2c1a', s: 1.6, life: 2, max: 2 }
          : { x: pr.x + s * 9, y: pr.y, vx: s * (40 + r() * 40), vy: -8 - r() * 20, g: -0.01, c: 'rgba(220,226,232,0.45)', s: 2 + r() * 2, life: 1.1, max: 1.1, grow: 1 };
      }
    }
    const DRIP_RATE = { water: 0.7, lava: 1.1, soot: 6, crystal: 3, cascade: 45, steam: 10 };

    function decorStep(dt, pcx, pcy) {
      decoFrame++;
      plantsNow.clear();
      const z = { slow: 1, slick: 0, climb: null, rev: 0, web: null, webs: 0, webMul: 1 };
      // the runtime anchor check, staggered: a thirtieth of the props each frame, so each one
      // finds out within half a second that the rock it hung off has been blown away
      for (let i = decoFrame % 30; i < props.length; i += 30) {
        const pr = props[i];
        if (!pr.gone && !pr.fall && (pr.anc || pr.on) && !propAnchored(pr, mat)) { pr.fall = true; pr.vy = 0; pr.anc = null; pr.on = null; }
      }
      for (let i = props.length - 1; i >= 0; i--) {
        const pr = props[i];
        if (pr.gone) { props.splice(i, 1); continue; }
        if (pr.fall) {                           // physics hand-off: it drops
          pr.vy = Math.min(pr.vy + GRAVITY * 0.8 * dt, 700);
          pr.y += pr.vy * dt;
          if (pr.y > WH) { pr.gone = true; continue; }
          if (pr.vy > 120 && (pr.k === 'drop' || pr.k === 'spike' || pr.k === 'cover' || pr.k === 'noise')) {
            if (!p.dead && pOver(pr, 0)) { hurt(PROP_DMG.drop); shatter(pr, 14); continue; }
            for (let j = enemies.length - 1; j >= 0; j--) {
              const e = enemies[j];
              if (Math.abs(e.x - pr.x) < e.r + 4 && Math.abs(e.ty - (pr.y + pr.b)) < e.r + 4) { damageEnemy(j, 4); shatter(pr, 14); break; }
            }
            if (pr.gone) continue;
          }
          if (solidAt(pr.x, pr.y + pr.b + 1)) landProp(pr);
          continue;
        }
        if (Math.abs(pr.y - pcy) > 520) continue;     // only what's round you does anything
        pr.cd = (pr.cd || 0) - dt;
        if (pr.hitT > 0) pr.hitT -= dt;
        // shots: cover eats them, and carts, pods, stones, salt spikes and pillars feel them
        const tough = pr.k === 'cover', feels = tough || pr.k === 'barrel' || pr.k === 'pod' ||
          (pr.k === 'noise' && pr.st === 'stone') || (pr.k === 'spike' && pr.st === 'salt') || (pr.k === 'lamp' && pr.st !== 'cap');
        if (feels) {
          const x0 = pr.x + pr.l, x1 = pr.x + pr.r, y0 = pr.y + pr.t0, y1 = pr.y + pr.b;
          for (const b of bullets) {
            if (b.life <= 0 || b.x + b.size < x0 || b.x - b.size > x1 || b.y + b.size < y0 || b.y - b.size > y1) continue;
            if (b.pull || b.eat || b.bore) {          // rolls on through, but only counts once
              const seen = b.propHit || (b.propHit = new Set());
              if (!seen.has(pr)) { seen.add(pr); pr.hurt = (pr.hurt || 0) + 1; }
            } else { pr.hurt = (pr.hurt || 0) + 1; burst(b.x, b.y, 3, b.col); b.life = 0; b.struck = 1; }
          }
          if (tough) for (let k = enemyShots.length - 1; k >= 0; k--) {
            const es = enemyShots[k];
            if (es.x > x0 && es.x < x1 && es.y > y0 && es.y < y1) { burst(es.x, es.y, 3, es.col); SFX.fx('coverHit', es.x, es.y); enemyShots.splice(k, 1); }
          }
        }
        if (pr.hurt) {
          const n = pr.hurt; pr.hurt = 0;
          if (pr.k === 'barrel' || pr.k === 'pod') { blowProp(pr); continue; }
          if (pr.k === 'lamp') { popLamp(pr); continue; }
          if (pr.k === 'noise' && pr.st === 'stone') { alertAt(pr.x, pr.y); pr.ring = 1; SFX.fx('resonate', pr.x, pr.y); }
          if (pr.k === 'spike' && pr.st === 'salt') { shatter(pr, 10); continue; }
          if (pr.k === 'drop') { pr.fall = true; pr.vy = 0; pr.anc = null; continue; }
          if (pr.k === 'cover' && pr.hp > 0) {
            pr.hp -= n; pr.hitT = 0.15;
            SFX.fx('coverHit', pr.x, pr.y + (pr.t0 + pr.b) / 2);
            if (pr.hp <= 0) { shatter(pr, 22); continue; }
          }
        }
        if (pr.ring > 0) pr.ring -= dt;
        const me = !p.dead;
        switch (pr.k) {
          case 'climb':
            if (pr.arc) {                          // an arched vine: latch on like a web line
              if (!me || !pOver(pr, 0)) break;
              const R = pr.grab || (pr.grab = kr('arGrab'));
              const d = archNear(pr, pcx, p.y + WEB_HAND).d, d2 = archNear(pr, pcx, pcy).d;
              if (Math.min(d, d2) < R + 3) plantsNow.add(pr);
              if (d <= R && (!z.arch || d < z.archD)) { z.arch = pr; z.archD = d; }
              break;
            }
            if (me && pOver(pr, 0)) z.climb = pr;
            if (me && PLANTS[pr.st] && pOver(pr, 1)) plantsNow.add(pr);
            break;
          case 'drip':
            if (pr.st === 'sparks') {
              pr.t -= dt;
              if (pr.t <= 0) {
                pr.t = 1.2 + Math.random() * 2.6;
                SFX.fx('sparks', pr.x, pr.y);
                for (let k = 0; k < 10; k++) dparts.push({ x: pr.x, y: pr.y + 4, vx: (Math.random() - 0.5) * 170,
                  vy: -20 + Math.random() * 90, g: 0.5, c: Math.random() < 0.5 ? '#ffe27a' : '#fff6c8', s: 1.2, life: 0.5, max: 0.5, glow: 1 });
              }
            } else {
              // each drip keeps its own random clock, so they never fall in step
              const rate = DRIP_RATE[pr.st];
              if (pr.dn == null) { pr.di = (0.3 + Math.random() * 1.4) / rate; pr.dn = Math.random() * pr.di; }
              pr.dn -= dt;
              if (pr.st === 'steam' && (pr.hs = (pr.hs || Math.random() * 3) - dt) <= 0) { pr.hs = 1.5 + Math.random() * 3; SFX.fx('steam', pr.x, pr.y); }
              while (pr.dn <= 0) { pr.di = (0.3 + Math.random() * 1.4) / rate; pr.dn += pr.di; dparts.push(spawnDrip(pr)); }
              pr.acc = 1 - pr.dn / pr.di;                // how far the next drop has swelled (the sprite reads it)
            }
            break;
          case 'drop':                             // an icicle lets go when you walk under it
            if (pr.st === 'icicle' && !pr.shake && me && Math.abs(pcx - pr.x) < 18 && pcy > pr.y &&
                pcy - pr.y < 170 && lineOfSight(pr.x, pr.y + 18, pcx, pcy)) { pr.shake = 0.35; SFX.fx('iceCreak', pr.x, pr.y); }
            if (pr.shake > 0 && (pr.shake -= dt) <= 0) { pr.fall = true; pr.vy = 0; pr.anc = null; }
            break;
          case 'spike':
            if (me && pOver(pr, -1) && pr.cd <= 0) {
              hurt(pr.st === 'salt' ? 4 : PROP_DMG.spike); pr.cd = 0.7;
              p.vy = pr.hang ? 160 : -280; burst(pcx, pr.hang ? p.y : p.y + PH, 5, '#ff5a5a');
            }
            break;
          case 'vent': {
            pr.t += dt;
            const ph = pr.t % 3.6, wasOn = pr.on, wasWarn = pr.warn;
            pr.on = ph > 2.6; pr.warn = ph > 1.9 && !pr.on;
            if (pr.warn && !wasWarn) SFX.fx('ventWarn', pr.x, pr.y);
            if (pr.on && !wasOn) SFX.fx('ventFire', pr.x, pr.y - 20);
            if (pr.warn && Math.random() < dt * 14) smoke.push({ x: pr.x, y: pr.y - 2, vx: (Math.random() - 0.5) * 10,
              vy: -30, r: 2 + Math.random() * 2, life: 0.8, max: 0.8 });
            if (pr.on) {
              if (Math.random() < dt * 40) dparts.push({ x: pr.x + (Math.random() - 0.5) * 6, y: pr.y - 4, vx: (Math.random() - 0.5) * 20,
                vy: -140 - Math.random() * 80, g: 0, c: Math.random() < 0.5 ? '#ffb050' : '#ff7a2a', s: 1.6, life: 0.4, max: 0.4, glow: 1 });
              if (me && pr.cd <= 0 && p.x + PW > pr.x - 6 && p.x < pr.x + 6 && p.y < pr.y && p.y + PH > pr.y - VENT_H) { hurt(PROP_DMG.vent); youAlight(); pr.cd = 0.4; }
              if ((pr.ecd = (pr.ecd || 0) - dt) <= 0) {
                pr.ecd = 0.4;
                for (let yy = 4; yy < VENT_H; yy += 12) ignite(pr.x, pr.y - yy, 6, 0.5);   // and it lights what hangs over it
                for (let j = enemies.length - 1; j >= 0; j--) {
                  const e = enemies[j];
                  if (Math.abs(e.x - pr.x) < e.r + 6 && e.ty < pr.y && e.ty > pr.y - VENT_H) { setAlight(e); damageEnemy(j, 1); }
                }
              }
            }
            break;
          }
          case 'pad':                               // a bouncy mushroom throws you up
            if (pr.sq > 0) pr.sq -= dt;
            if (me && p.vy >= 0 && Math.abs(pcx - pr.x) < 11 && p.y + PH > pr.y - 12 && p.y + PH < pr.y + 2) {
              p.vy = -680; p.onGround = false; pr.sq = 0.3;
              SFX.fx('shroom', pr.x, pr.y);
              burst(pr.x, pr.y - 8, 5, propCol(pr, themeFor(floor)));
            }
            break;
          case 'zone': {
            const on = me && p.onGround && p.x + PW > pr.x + pr.l && p.x < pr.x + pr.r && Math.abs(p.y + PH - pr.y) < 5;
            const st = pr.st, moving = Math.abs(p.vx) > 30;
            if (st === 'slime') for (const e of enemies)
              if (e.x > pr.x + pr.l && e.x < pr.x + pr.r && e.ty > pr.y - 30 && e.ty < pr.y) e.chill = 0.45;
            if (!on) { pr.stand = 0; break; }
            z.surface = st;
            if (st === 'ice') z.slick = 1;
            else if (st === 'snow') z.slow = Math.min(z.slow, 0.55);
            else if (st === 'slime') z.slow = Math.min(z.slow, 0.45);
            else if (st === 'puddle') {
              z.slow = Math.min(z.slow, 0.7);
              if (moving && Math.random() < dt * 20) dparts.push({ x: pcx, y: pr.y - 2, vx: (Math.random() - 0.5) * 60,
                vy: -60 - Math.random() * 60, g: 0.9, c: 'rgba(150,200,255,0.8)', s: 1.3, life: 0.6, max: 0.6 });
            } else if (st === 'acid') { if (pr.cd <= 0) { hurt(3); pr.cd = 0.5; } }
            else if (st === 'glass') {
              if (Math.abs(p.vx) > 80 && pr.cd <= 0) { hurt(2); pr.cd = 0.35; burst(pcx, pr.y - 1, 3, '#d8f4ff'); }
            } else if (st === 'log') {
              pr.stand = (pr.stand || 0) + dt;
              if (pr.stand > 0.8 && pr.cd <= 0) { hurt(3); pr.cd = 0.5; }
            } else if (st === 'ash' && moving && Math.random() < dt * 30) {
              smoke.push({ x: pcx + (Math.random() - 0.5) * 8, y: pr.y - 2, vx: -p.vx * 0.2 + (Math.random() - 0.5) * 20,
                vy: -15 - Math.random() * 20, r: 1.5 + Math.random() * 2, life: 0.9, max: 0.9 });
            }
            break;
          }
          case 'noise':                              // skulls crunch underfoot
            if (pr.st === 'skulls' && me && pr.cd <= 0 && pOver(pr, 0)) {
              alertAt(pr.x, pr.y); pr.cd = 3; burst(pr.x, pr.y - 4, 6, '#e6dcc4');
              SFX.fx('skulls', pr.x, pr.y);
            }
            break;
          case 'eyes':                               // eyes in the dark whisper as you first come near
            if (me && !pr.heard && Math.hypot(pcx - pr.x, pcy - pr.y) < 170) { pr.heard = 1; SFX.fx('eyes', pr.x, pr.y); }
            break;
          case 'matter': {                           // gravity turns over near it
            const by = pr.y + Math.sin(time * 1.3 + pr.seed * 9) * 3, dd = Math.hypot(pcx - pr.x, pcy - by);
            if (me && dd < 48) z.rev = Math.max(z.rev, 1 - dd / 48);
            if (me && dd < 12 && pr.cd <= 0) { hurt(PROP_DMG.matter); pr.cd = 0.5; }
            break;
          }
          case 'tendril': {                          // lashes out on a beat
            pr.t += dt;
            const ph = (pr.t % 2.4) / 2.4;
            const was = pr.ext || 0;
            pr.ext = ph > 0.55 && ph < 0.85 ? Math.sin((ph - 0.55) / 0.3 * Math.PI) * 46 : 0;
            if (pr.ext > 0 && !was) SFX.fx('lash', pr.x, pr.y);
            pr.aimA = pr.ang + Math.sin(pr.t * 0.7) * 0.3;
            if (me && pr.ext > 18 && pr.cd <= 0) {
              const tx = pr.x + Math.cos(pr.aimA) * pr.ext, ty = pr.y - 2 + Math.sin(pr.aimA) * pr.ext;
              const vx = tx - pr.x, vy = ty - pr.y + 2, t = clamp(((pcx - pr.x) * vx + (pcy - pr.y + 2) * vy) / (vx * vx + vy * vy), 0, 1);
              if (Math.hypot(pr.x + vx * t - pcx, pr.y - 2 + vy * t - pcy) < 10) {
                hurt(PROP_DMG.tendril); pr.cd = 0.8; p.vx += Math.cos(pr.aimA) * 220; p.kick = 0.15;
              }
            }
            break;
          }
        }
      }
      // spore clouds from burst pods
      for (let i = clouds.length - 1; i >= 0; i--) {
        const cl = clouds[i];
        cl.life -= dt; cl.tick -= dt;
        if (cl.tick <= 0) {
          cl.tick = 0.4;
          if (!p.dead && Math.hypot(pcx - cl.x, pcy - cl.y) < cl.r) hurt(PROP_DMG.cloud);
          for (let j = enemies.length - 1; j >= 0; j--)
            if (Math.hypot(enemies[j].x - cl.x, enemies[j].ty - cl.y) < cl.r + enemies[j].r) damageEnemy(j, 1);
        }
        if (cl.life <= 0) clouds.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i--) if ((rings[i].t += dt) > 0.9) rings.splice(i, 1);
      // drips, sparks, steam and splashes
      dripHurt -= dt;
      for (let i = dparts.length - 1; i >= 0; i--) {
        const q = dparts[i];
        q.life -= dt;
        q.vy += GRAVITY * q.g * dt;
        if (q.wob != null) q.vx = Math.sin(time * 2 + q.wob) * 6;
        if (q.grow) q.s += dt * 3;
        q.x += q.vx * dt; q.y += q.vy * dt;
        let dead = q.life <= 0;
        // burning oil from a lantern: lights what it passes through, and where it lands
        if (q.ember) {
          const ex = Math.floor(q.x / CELL), ey = Math.floor(q.y / CELL);
          if (ex >= 0 && ey >= 0 && ex < CW && ey < CH && fire.fuel[ey * CW + ex]) ignite(q.x, q.y, 2, 0.6);
          if (!p.dead && q.x > p.x && q.x < p.x + PW && q.y > p.y && q.y < p.y + PH) { youAlight(); dead = true; }
          if (!dead && solidAt(q.x, q.y)) ignite(q.x - q.vx * dt, q.y - q.vy * dt, 4, 0.85);
        }
        if (!dead && solidAt(q.x, q.y)) {
          dead = true;
          if (q.snd) SFX.fx(q.snd, q.x, q.y);
          if (q.splash) for (let k = 0; k < 2; k++) dparts.push({ x: q.x, y: q.y - 2, vx: (Math.random() - 0.5) * 50,
            vy: -30 - Math.random() * 40, g: 0.8, c: q.c, s: 1, life: 0.35, max: 0.35, glow: q.glow });
        }
        if (!dead && q.dmg && !p.dead && q.x > p.x && q.x < p.x + PW && q.y > p.y && q.y < p.y + PH) {
          if (dripHurt <= 0) { hurt(q.dmg); dripHurt = 0.4; }
          dead = true;
        }
        if (dead) dparts.splice(i, 1);
      }
      if (dparts.length > 700) dparts.splice(0, dparts.length - 700);
      stepAmbience(dt);
      // foliage: grabbing a vine, or pushing into a plant you weren't already in, rustles;
      // an arched vine in reach beats the strands hanging off it (let go with a push down, and
      // a strand under you catches you instead)
      if (webLetGo > 0) z.arch = null;
      if (z.arch) z.climb = z.arch;
      // moving through them rustles now and then; rustleStep keeps a big clump from spamming
      let entered = !!(z.climb && PLANTS[z.climb.st] && z.climb !== zfx.climb), style = null;
      for (const pr of plantsNow) if (!plantsLast.has(pr)) { entered = true; style = pr.st; }
      const str = rustleStep(rustle, dt, plantsNow.size > 0, entered, Math.hypot(p.vx, p.vy));
      if (str) {
        const pr = style ? null : plantsNow.values().next().value;
        SFX.rustle(pcx, pcy, str, style || (pr && pr.st) || 'vine');
      }
      plantsLast = new Set(plantsNow);
      // spider web lines: each one you're touching slows you, and like a vine you latch on
      // to the nearest (unless you've just let go of one)
      if (!p.dead) {
        let wd = Infinity;
        for (const L of webs) {
          const R = L.grab || (L.grab = spr('webGrab'));
          if (pcx < Math.min(L.a0x, L.b0x) - R || pcx > Math.max(L.a0x, L.b0x) + R ||
              pcy < Math.min(L.a0y, L.b0y) - R - PH / 2 || pcy > Math.max(L.a0y, L.b0y) + R + PH / 2) continue;
          const d = webDist(L, pcx, p.y + WEB_HAND);
          const d2 = webDist(L, pcx, pcy);
          if (Math.min(d, d2) > R) continue;
          z.webs++;
          z.webMul *= L.slow || (L.slow = spr('webSlow'));
          if (d <= R && d < wd) { wd = d; z.web = L; }
        }
        if (webLetGo > 0) z.web = null;
        if (z.web && !z.climb) z.climb = z.web;
        else if (z.climb !== z.web) z.web = null;
      }
      zfx = z;
    }

    // ---- the theme's ambience, pooled round the camera rather than tied to a spot ----
    const AMB_RATE = { spores: 5, frost: 3, embers: 8, motes: 4, ashfall: 55 };
    const AMB_MAX = { spores: 40, frost: 20, embers: 60, motes: 50, ashfall: 280 };
    // one of the Luminescent Spores that drift about the green floors. The jellies puff the
    // very same thing out of their rims (puffSpores), so it is made in one place
    const spore = (x, y, r) => ({ kind: 'spores', x, y, vx: (r - 0.5) * 8, vy: 0, wob: r * 9, life: 5 + r * 3, max: 8,
      c: rgbA(themeFor(floor).moss[1]), s: 1.3, glow: 1 });
    // a jelly's pulse blows a puff of spores out of its rim, back the way it pushes; drag
    // (kx, ky fading at kd) settles them, then they drift like any other spore
    function puffSpores(e) {
      if (e.x < camX - 150 || e.x > camX + viewW + 150 || e.y < camY - 150 || e.y > camY + viewH + 150) return;
      const S = e.je, B = jellyBell(e.r, S.shape, kru('jeSquash', S.u.sq));
      const c = Math.cos(S.hd), sn = Math.sin(S.hd), n = Math.round(kr('jeSpores'));
      for (let i = 0; i < n && amb.length < 500; i++) {
        const lx = (Math.random() * 2 - 1) * B.rw * 0.7;
        const q = spore(e.x - lx * sn - B.rim * c, e.y + lx * c - B.rim * sn, Math.random());
        const a = S.hd + Math.PI + (Math.random() * 2 - 1) * kr('jeSporeSpread') * Math.PI / 180, v = kr('jeSporeSpd');
        q.kx = Math.cos(a) * v; q.ky = Math.sin(a) * v; q.kd = kr('jeSporeDrag');
        amb.push(q);
      }
    }
    // The jellyfish's plant glow in the game (the comp is plantGlowFill): the art round a
    // jelly — the rock with its baked moss over the decoration layer, and the hanging plants
    // drawn over both at terrain resolution and read back — keyed, ramped, twinkled and
    // added on top in its colour. Only on ground you've seen.
    const pgGlow = document.createElement('canvas'), pgGlowCtx = pgGlow.getContext('2d');
    const seenAt = (x, y) => seen[clamp(Math.floor(y / FOG_U), 0, FH - 1) * FW + clamp(Math.floor(x / FOG_U), 0, FW - 1)] !== 0;
    function plantGlow(e, TH) {
      const u = e.je.u, reach = kru('jeGlowR', u.glowR) * kru('jePlantReach', u.plant);
      const strength = kru('jePlantGlow', u.plant);
      if (reach < 2 || strength <= 0) return;
      const bx0 = clamp(Math.floor((e.x - reach) / CELL), 0, CW - 1), by0 = clamp(Math.floor((e.y - reach) / CELL), 0, CH - 1);
      const bx1 = clamp(Math.ceil((e.x + reach) / CELL), 1, CW), by1 = clamp(Math.ceil((e.y + reach) / CELL), 1, CH);
      const w = bx1 - bx0, h = by1 - by0;
      if (w <= 0 || h <= 0) return;
      if (!pgArt || pgArt.length < w * h * 4) pgArt = new Uint8ClampedArray(w * h * 4);
      const x0w = bx0 * CELL, y0w = by0 * CELL, x1w = bx1 * CELL, y1w = by1 * CELL;
      // the hanging plants in reach, drawn at terrain resolution and read back
      let pd = null;
      const plants = props.filter(pr => pr.k === 'climb' && PLANTS[pr.st] &&
        pr.x + pr.r > x0w && pr.x + pr.l < x1w && pr.y + pr.b > y0w && pr.y + pr.t0 < y1w);
      if (plants.length) {
        if (!pgC) { pgC = document.createElement('canvas'); pgCtx = pgC.getContext('2d', { willReadFrequently: true }); }
        if (pgC.width < w || pgC.height < h) { pgC.width = Math.max(pgC.width, w); pgC.height = Math.max(pgC.height, h); }
        pgCtx.setTransform(1, 0, 0, 1, 0, 0); pgCtx.clearRect(0, 0, w, h);
        pgCtx.setTransform(1 / CELL, 0, 0, 1 / CELL, -bx0, -by0);
        for (const pr of plants) drawProp(pgCtx, pr, time, TH);
        pd = pgCtx.getImageData(0, 0, w, h).data;
      }
      // compose the art: rock over the decoration layer, the plants over both
      const T = img.data, D = dimg ? dimg.data : null, A = pgArt;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const si = ((by0 + y) * CW + bx0 + x) * 4, o = (y * w + x) * 4;
        let r = 0, g = 0, b = 0, a = 0;
        if (T[si + 3]) { r = T[si]; g = T[si + 1]; b = T[si + 2]; a = 255; }
        else if (D && D[si + 3]) { r = D[si]; g = D[si + 1]; b = D[si + 2]; a = D[si + 3]; }
        if (pd && pd[o + 3]) {
          const pa = pd[o + 3] / 255;
          if (a) { r += (pd[o] - r) * pa; g += (pd[o + 1] - g) * pa; b += (pd[o + 2] - b) * pa; a = Math.max(a, pd[o + 3]); }
          else { r = pd[o]; g = pd[o + 1]; b = pd[o + 2]; a = pd[o + 3]; }
        }
        A[o] = r; A[o + 1] = g; A[o + 2] = b; A[o + 3] = a;
      }
      const out = new ImageData(w, h);
      if (!plantGlowFill(out.data, A, w, h, { ox: x0w, oy: y0w, px: CELL, cx: e.x, cy: e.y, reach, white: plantW,
        top: kru('jePlantTop', u.plant) / 100, strength, t: time * kru('jePlantTwinkle', u.plant),
        size: kru('jePlantSize', u.plant), rgb: hexArr(jcol('jeColGlow', u.col)), lit: seenAt })) return;
      if (pgGlow.width < w || pgGlow.height < h) { pgGlow.width = Math.max(pgGlow.width, w); pgGlow.height = Math.max(pgGlow.height, h); }
      pgGlowCtx.putImageData(out, 0, 0);
      const sm = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(pgGlow, 0, 0, w, h, x0w, y0w, w * CELL, h * CELL);
      ctx.imageSmoothingEnabled = sm;
    }
    function stepAmbience(dt) {
      const x0 = camX - 30, y0 = camY - 30, w = viewW + 60, h = viewH + 60;
      const T = themeFor(floor);
      for (const kind of ambKinds) {
        if (kind === 'devils') {
          if (devils.length < 2 && Math.random() < dt * 0.4) {
            let x = x0 + Math.random() * w, y = y0 + Math.random() * h, k = 0;
            while (k++ < 120 && !solidAt(x, y + 1)) y += 2;
            if (k < 120 && !solidAt(x, y - 30)) devils.push({ x, y, vx: (Math.random() < 0.5 ? -1 : 1) * (15 + Math.random() * 20), life: 6 + Math.random() * 3, max: 9 });
          }
          continue;
        }
        const n = amb.reduce((a, q) => a + (q.kind === kind), 0);
        let want = AMB_RATE[kind] * dt;
        while (want > 0 && n < AMB_MAX[kind]) {
          if (Math.random() >= want) break;
          want -= 1;
          const x = x0 + Math.random() * w, y = y0 + Math.random() * h;
          if (solidAt(x, y)) continue;
          const r = Math.random();
          if (kind === 'spores') amb.push(spore(x, y, r));
          else if (kind === 'frost') {
            const dir = floor % 2 ? 1 : -1;
            amb.push({ kind, x, y, vx: dir * (100 + r * 60), vy: (r - 0.5) * 10, life: 0.9 + r * 0.5, max: 1.4, c: 'rgba(215,238,255,0.5)', s: 1, streak: 10 });
          } else if (kind === 'embers') amb.push({ kind, x, y, vx: 0, vy: -20 - r * 30, wob: r * 9, life: 3 + r * 2, max: 5, c: r < 0.5 ? '#ffb050' : '#ff7a2a', s: 1.2, glow: 1 });
          else if (kind === 'motes') amb.push({ kind, x, y, vx: (r - 0.5) * 6, vy: (Math.random() - 0.5) * 4, wob: r * 9, life: 6 + r * 3, max: 9, c: 'rgba(235,225,200,0.8)', s: 1 });
          else if (kind === 'ashfall') amb.push({ kind, x, y, vx: 8, vy: 20 + r * 22, wob: r * 9, life: 4 + r * 3, max: 7, c: 'rgba(150,146,142,0.75)', s: 1 + r });
        }
      }
      for (let i = amb.length - 1; i >= 0; i--) {
        const q = amb[i];
        q.life -= dt;
        if (q.wob != null) q.x += Math.sin(time * 1.3 + q.wob) * 6 * dt;
        if (q.kx || q.ky) {                             // a puff's kick, dying away under drag
          q.x += q.kx * dt; q.y += q.ky * dt;
          const k = Math.exp(-q.kd * dt); q.kx *= k; q.ky *= k;
        }
        q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.life <= 0 || solidAt(q.x, q.y) || q.x < x0 - 200 || q.x > x0 + w + 200 || q.y < y0 - 200 || q.y > y0 + h + 200) amb.splice(i, 1);
      }
      for (let i = devils.length - 1; i >= 0; i--) {
        const dv = devils[i];
        dv.life -= dt;
        const nx = dv.x + dv.vx * dt;
        if (solidAt(nx + Math.sign(dv.vx) * 6, dv.y - 4)) dv.vx = -dv.vx; else dv.x = nx;
        if (!solidAt(dv.x, dv.y + 2)) dv.y += 40 * dt;
        else if (solidAt(dv.x, dv.y)) dv.y -= 2;
        if (dv.life <= 0) devils.splice(i, 1);
      }
    }

    function step(dt) {
      time += dt;
      levelT += dt;
      // a toast raised while the game was paused (picking a mod up, say) waits here,
      // because nothing runs on a paused frame
      if (input.current.pendingToast) { toast(input.current.pendingToast); input.current.pendingToast = null; }
      input.current.floor = floor;
      if (input.current.newCave) {                // Dev → New cave: this floor again, freshly rolled
        input.current.newCave = false;
        enterLevel();
        toast('New cave');
        return;
      }
      if (input.current.spawnGun) {               // Dev → Spawn gun: drop one just in front of you
        const gun = caveGun(input.current.spawnGun, Math.random);
        input.current.spawnGun = 0;
        pickups.push({ kind: 'gun', x: p.x + PW / 2 + p.face * 22, y: p.y + PH - 9, gun, t: 0 });
        toast('Spawned ' + gun.name);
      }
      const LO = input.current.loadout;
      // perks: keep the current maximum health honest, wind the shield back up, and never
      // let a shrunken cap (Glass Cannon) leave the bar reading over full
      const MHP = maxHp();
      if (p.hp > MHP) p.hp = MHP;
      if (pb.shield && !p.shieldReady) { p.shieldT -= dt; if (p.shieldT <= 0) { p.shieldReady = true; SFX.fx('shieldUp'); } }
      // movement: thumbstick first, otherwise keyboard (full strength)
      let L = input.current.left;
      if (!L.active) {
        const keys = input.current.keys;
        const kx = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
        if (kx || keys.w) {
          const ny = keys.w ? -1 : 0, len = Math.hypot(kx, ny);
          L = { active: true, nx: kx / len, ny: ny / len, mag: 1, dy: keys.w ? -1 : 1, on: true };
        }
      }
      if (p.dead) L = NO_INPUT;
      p.jx = L.nx; p.jy = L.ny;

      // ---- jetpack and fuel ----
      const raw = L.active ? L.mag : 0;
      const mag = raw > DEAD ? (raw - DEAD) / (1 - DEAD) : 0;
      const wantJet = mag > 0 && L.dy < 0;
      if (p.empty && p.fuel >= FUEL_RESTART) p.empty = false;
      const jet = wantJet && !p.empty;
      // holding a vine (or chain, root, frozen fall): no jet means you hang on and get your
      // breath back; the stick climbs you up and down
      const climbing = zfx.climb && !jet && !p.dead;
      p.jet = jet ? mag : 0;
      // low on fuel it coughs: the flame, smoke and roar cut out for a blink, you drop a
      // little, and it spits a grey puff
      p.sput = sputterStep(jetSt, dt, p.fuel, jet);
      p.flame = p.sput ? 0 : p.jet;
      if (p.sput) p.cough = 0.15;
      else p.cough = Math.max(0, p.cough - dt);
      if (jetSt.start) {
        p.vy += DEV.sputDip;
        for (let i = 0; i < 3; i++)
          smoke.push({ x: p.x + PW / 2 + (Math.random() - 0.5) * 6, y: p.y + PH + 2,
            vx: (Math.random() - 0.5) * 40, vy: 20 + Math.random() * 30,
            r: 2.5 + Math.random() * 2, life: 0.7 + Math.random() * 0.4, max: 1.1, c: '#6f767e', a: 0.8 });
      }
      if (jet) {
        p.fuel -= FUEL_DRAIN * (0.5 + 0.5 * mag) * dt;
        if (p.fuel <= 0) { p.fuel = 0; p.empty = true; }
      } else if (p.onGround || climbing) {
        p.fuel = Math.min(1, p.fuel + FUEL_REGEN * dt);
      }

      // ---- steering ----
      const pcx0 = p.x + PW / 2;
      p.kick -= dt;
      const k = p.kick > 0 ? 0.15 : 1;   // let explosions push you around briefly
      // each spider string on you slows you, and so does each web line you're pushing through
      const tied = strings.reduce((m, s) => m * s.slow, 1) * zfx.webMul;
      webLetGo -= dt;
      if (jet && p.sput) {
        // coughing: steer on, but no lift for the blink
        p.vx = approach(p.vx, L.nx * mag * JET * pb.walk * DEV.move * tied, JET_ACC * dt * k);
        p.vy = Math.min(p.vy + GRAVITY * dt, 900);
      } else if (jet) {
        p.vx = approach(p.vx, L.nx * mag * JET * pb.walk * DEV.move * tied, JET_ACC * dt * k);
        const ty = L.ny * mag * JET * pb.jet * DEV.move * tied;    // Faster Levitation lifts harder
        // rising beats a fall instantly (except just after a cough, which it has to climb
        // back out of); only an explosion still throws you around
        if (ty < p.vy && p.kick <= 0 && p.cough <= 0) p.vy = ty;
        else p.vy = approach(p.vy, ty, JET_ACC * dt * k);
        if (zfx.rev) p.vy -= GRAVITY * zfx.rev * dt;          // dark matter lifts you
      } else if (climbing && zfx.arch && p.kick <= 0) {
        // hanging from an arched vine: the stick runs you along its curve, hands on it. Push
        // down (not along it) to let go.
        const W = zfx.arch, hy = p.y + WEB_HAND, q = archNear(W, pcx0, hy);
        const a = W.arc[q.k], b = W.arc[q.k + 1], ul = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const ux = (b[0] - a[0]) / ul, uy = (b[1] - a[1]) / ul;
        const along = mag > 0 ? (L.nx * ux + L.ny * uy) * mag : 0;
        if (mag > 0.5 && L.ny > 0.7 && Math.abs(along) < 0.5) { webLetGo = 0.35; p.vy = 40; }
        else {
          const v = along * (W.climb || (W.climb = kr('arClimb'))) * tied;
          p.vx = approach(p.vx, ux * v + (q.x - pcx0) * 14, 1800 * dt);
          p.vy = approach(p.vy, uy * v + (q.y - hy) * 14, 1800 * dt);
        }
      } else if (climbing && zfx.web && p.kick <= 0) {
        // hanging from a spider's web line: the stick runs you along it, hands on the line.
        // Push down (not along it) to let go.
        const W = zfx.web, wl = Math.hypot(W.b0x - W.a0x, W.b0y - W.a0y) || 1;
        let ux = (W.b0x - W.a0x) / wl, uy = (W.b0y - W.a0y) / wl;
        const along = mag > 0 ? (L.nx * ux + L.ny * uy) * mag : 0;
        if (mag > 0.5 && L.ny > 0.7 && Math.abs(along) < 0.5) { webLetGo = 0.35; p.vy = 40; }
        else {
          const v = along * (W.climb || (W.climb = spr('webClimb'))) * tied, hy = p.y + WEB_HAND, q = webNear(W, pcx0, hy);
          p.vx = approach(p.vx, ux * v + (q.x - pcx0) * 14, 1800 * dt);
          p.vy = approach(p.vy, uy * v + (q.y - hy) * 14, 1800 * dt);
        }
      } else {
        // decoration underfoot: snow, slime and puddles slow you, ice takes your grip away
        const target = mag > 0 ? L.nx * mag * WALK * pb.walk * DEV.move * zfx.slow * tied : 0;
        p.vx = approach(p.vx, target, (p.onGround ? GROUND_ACC * (zfx.slick ? 0.08 : 1) : AIR_ACC) * dt * k);
        if (climbing && p.kick <= 0) p.vy = approach(p.vy, mag > 0 ? L.ny * mag * CLIMB * tied : 0, 1800 * dt);
        else p.vy = Math.min(p.vy + GRAVITY * dt * (1 - 2 * zfx.rev), 900);   // dark matter flips it
      }

      // ---- move against the pixel terrain ----
      const wasGround = p.onGround, fallV = p.vy;
      let n = Math.ceil(Math.abs(p.vx * dt));
      if (n > 0) {
        const sx = p.vx * dt / n;
        for (let i = 0; i < n; i++) {
          if (!boxHit(p.x + sx, p.y)) { p.x += sx; continue; }
          let moved = false;
          const maxUp = wasGround ? 6 : 3;          // walk up small bumps and slopes
          for (let up = 1; up <= maxUp; up++) {
            if (!boxHit(p.x + sx, p.y - up)) { p.x += sx; p.y -= up; moved = true; break; }
          }
          if (!moved) { p.vx = 0; break; }
        }
      }
      n = Math.ceil(Math.abs(p.vy * dt));
      if (n > 0) {
        const sy = p.vy * dt / n;
        for (let i = 0; i < n; i++) {
          if (!boxHit(p.x, p.y + sy)) { p.y += sy; continue; }
          if (sy > 0) p.y = Math.floor((p.y + sy + PH - 0.001) / CELL) * CELL - PH;
          else p.y = (Math.floor((p.y + sy) / CELL) + 1) * CELL;
          if (boxHit(p.x, p.y)) p.y -= sy;   // fallback
          p.vy = 0;
          break;
        }
      }
      // stick to the ground when walking down slopes
      if (wasGround && !jet && p.vy >= 0 && p.kick <= 0 && !boxHit(p.x, p.y + 1)) {
        for (let dn = 1; dn <= 6; dn++) {
          if (boxHit(p.x, p.y + dn + 1)) { p.y += dn; p.vy = 0; break; }
        }
      }
      // never stay stuck inside terrain
      if (boxHit(p.x, p.y)) {
        for (let up = 1; up <= 40; up++) if (!boxHit(p.x, p.y - up)) { p.y -= up; break; }
      }
      if (p.y > WH) { p.x = start.x; p.y = start.y; p.vx = 0; p.vy = 0; }
      p.onGround = boxHit(p.x, p.y + 0.5);
      // footsteps and landings, in the sound of whatever you're standing on
      if (!p.dead) {
        if (p.onGround && !wasGround && fallV > 200) SFX.fx('land', null, null, { v: fallV, s: zfx.surface });
        if (p.onGround && Math.abs(p.vx) > 40) {
          if ((stepT -= dt * Math.abs(p.vx) / 40) <= 0) { stepT = 1; SFX.fx('step', null, null, zfx.surface); }
        } else stepT = Math.min(stepT, 0.35);
      }

      const pcx = p.x + PW / 2, pcy = p.y + PH / 2;
      if (!p.dead && pcx > portal.x && pcx < portal.x + portal.w &&
          pcy > portal.y && pcy < portal.y + portal.h) {
        floor++;
        enterLevel();
        saveRun();
        SFX.fx('portalIn');
        toast('Floor ' + floor);
        input.current.notify();
        return;
      }

      // ---- aiming: thumbstick first, otherwise mouse ----
      const gx = pcx, gy = p.y + PH * 0.4;
      const TR = input.current.right;
      let R = { on: false, show: false, nx: p.face, ny: 0 };
      // line shows as soon as you touch the stick, fading in with the push: 0 at the centre,
      // full at the trigger ring (vis is what the Trajectory Sight line reads)
      if (TR.active) R = { on: TR.on, show: true, nx: TR.nx, ny: TR.ny, vis: Math.min(1, TR.mag / AIM_DEAD) };
      else if (mouse.inside) {
        const dx = camX + mouse.x / unitPx - gx, dy = camY + mouse.y / unitPx - gy, d = Math.hypot(dx, dy);
        if (d > 1) R = { on: mouse.down, show: true, nx: dx / d, ny: dy / d };
      }
      // Pinpointer aims for you: the gun locks onto the nearest creature and you only
      // decide whether to fire. It replaces hand-aiming — the stick becomes a trigger.
      if (pb.pinpointer && !p.dead) {
        let best = null, bd = 1e9;
        for (const e of enemies) {
          const d = Math.hypot(e.x - gx, e.ty - gy);
          if (d < bd && lineOfSight(gx, gy, e.x, e.ty)) { bd = d; best = e; }
        }
        if (best) {
          const a = Math.atan2(best.ty - gy, best.x - gx);
          R = { on: R.on || (TR.active && TR.on), show: true, nx: Math.cos(a), ny: Math.sin(a), vis: R.vis };
        }
      }
      if (p.dead) R.on = false;
      p.aim = R;

      if (R.show) p.face = R.nx >= 0 ? 1 : -1;
      else if (Math.abs(p.vx) > 10) p.face = p.vx > 0 ? 1 : -1;

      // every gun you carry ticks down and tops up its mana, holstered or not
      for (const g of LO.guns) {
        if (!g) continue;
        const pas = gunPassives(g);
        const recharging = g.rechT > 0;
        g.delayT -= dt; g.rechT -= dt;
        if (recharging && g.rechT <= 0 && g === LO.guns[LO.sel] && (g.rechLen || 0) >= 0.45) SFX.fx('ready');
        g.mana = Math.min(g.manaMax + pas.manaMax, g.mana + (g.manaRegen + pas.manaRegen) * dt);
      }
      const gun = LO.guns[LO.sel];
      if (R.on && gun && gun.delayT <= 0 && gun.rechT <= 0) cast(gun, gx, gy, R.nx, R.ny);

      // ---- shots ----
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.life -= dt; b.spin += dt * 12; b.age = (b.age || 0) + dt;
        let dead = b.life <= 0, boom = false;
        if (dead && b.lifeBoom && b.explode) { dead = false; boom = true; }   // a bomb's fuse burns down
        if (b.fuse && b.age >= b.fuse) { boom = b.explode ? true : false; if (!b.explode) dead = true;
          else { explodeCross(b); dead = true; boom = false; } }
        if (b.grav) b.vy += b.grav * dt;
        if (b.drag) { const k = Math.exp(-b.drag * dt); b.vx *= k; b.vy *= k; }
        if (b.accel) { const f = 1 + b.accel * dt; b.vx *= f; b.vy *= f; }
        if (b.vmax) { const v = Math.hypot(b.vx, b.vy); if (v > b.vmax) { b.vx *= b.vmax / v; b.vy *= b.vmax / v; } }
        if (b.wig) turn(b, wigTurn(b.wig, b.age, dt));
        if (b.look) shotTrail(b, dt);
        // paths: each one bends the velocity, and tracePath draws the same bends
        if (b.spiral) turn(b, b.spiral * dt);
        if (b.pong && Math.floor(b.age / 0.45) % 2 === 1) { b.vx = -b.vx; b.vy = -b.vy; b.age += dt; }
        if (b.orbit) turn(b, b.orbit * dt);
        if (b.boomer) {
          const want = Math.atan2(p.y + PH / 2 - b.y, p.x + PW / 2 - b.x);
          turn(b, clamp(angDiff(want, Math.atan2(b.vy, b.vx)), -b.boomer * dt, b.boomer * dt));
        }
        if (b.eat) dig(b.x, b.y, b.eat);
        if (b.fire) ignite(b.x, b.y, b.size + 2, 0.5);     // a fire spell lights what it flies through
        if (b.arc) lightningStep(b, dt);
        // a timer lets its payload go in mid-air, and the carrier flies on
        if (b.payload && b.timer != null && (b.timer -= dt) <= 0) firePayload(b);
        if (b.pull) {
          // Black Hole: heavy gravity. It reaches ~2.2x its pull stat and drags harder the
          // closer you are, so creatures get hauled in and held in the middle of it. It
          // swallows enemy shots that come near, and grinds anything in it every 0.3s.
          const reach = DEV.bhPull * b.pull / 70;          // Dev knob: max pull range
          for (const e of enemies) {
            const dx = b.x - e.x, dy = b.y - e.ty, d = Math.hypot(dx, dy) || 1;
            if (d < reach) {
              const f = Math.min(d / dt, 60 + 420 * (1 - d / reach));   // never overshoot the centre
              e.x += dx / d * f * dt; e.y += dy / d * f * dt; e.tgt = null;
            }
          }
          for (let k = enemyShots.length - 1; k >= 0; k--) {
            const es = enemyShots[k];
            const dx = b.x - es.x, dy = b.y - es.y, d = Math.hypot(dx, dy) || 1;
            if (d < b.size + 6) { burst(es.x, es.y, 3, '#c58cff'); SFX.fx('absorb', es.x, es.y); enemyShots.splice(k, 1); continue; }
            if (d < reach) { es.vx += dx / d * 900 * dt; es.vy += dy / d * 900 * dt; }
          }
          if ((b.grind = (b.grind || 0) + dt) > 0.3) { b.grind = 0; b.hit = null; }
          // the trail of magic it leaves behind
          if (Math.random() < 0.9) {
            const a = Math.random() * 6.28, rr = b.size * (0.6 + Math.random() * 0.5);
            const life = 0.6 + Math.random() * 0.7;
            motes.push({ kind: 'drift', x: b.x + Math.cos(a) * rr, y: b.y + Math.sin(a) * rr,
              vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, life, max: life,
              s: 0.8 + Math.random() * 1.6, c: Math.random() < 0.3 ? '#f0e0ff' : Math.random() < 0.6 ? '#c58cff' : '#8a5cff' });
          }
        }
        if (b.split && b.age > 0.28) {                   // one clean split, partway along
          b.split = 0;
          SFX.fx('split', b.x, b.y);
          for (const turnBy of [-0.3, 0.3]) {
            const c = Object.assign({}, b, { hit: null, split: 0, age: 0 });
            const sp = Math.hypot(b.vx, b.vy), a = Math.atan2(b.vy, b.vx) + turnBy;
            c.vx = Math.cos(a) * sp; c.vy = Math.sin(a) * sp;
            bullets.push(c);
          }
        }
        if (b.drift) {
          // Pollen: drags to a stop and floats; locks onto the first creature in range
          // it can see, then speeds back up and homes. Loses the lock if that one dies.
          if (b.lock && enemies.indexOf(b.lock) < 0) b.lock = null;
          if (!b.lock) {
            const d = driftStep(b.vx, b.vy, dt); b.vx = d[0]; b.vy = d[1];
            let bd = b.homeR || DRIFT_R;
            for (const e of enemies) {
              const dd = Math.hypot(e.x - b.x, e.ty - b.y);
              if (dd < bd && lineOfSight(b.x, b.y, e.x, e.ty)) { bd = dd; b.lock = e; }
            }
          }
          if (b.lock) {
            const e = b.lock, sp = Math.min(DRIFT_CHASE, Math.hypot(b.vx, b.vy) + DRIFT_ACC * dt);
            const want = Math.atan2(e.ty - b.y, e.x - b.x);
            const ang = Math.hypot(b.vx, b.vy) < 5 ? want
              : Math.atan2(b.vy, b.vx) + clamp(angDiff(want, Math.atan2(b.vy, b.vx)), -b.homing * dt, b.homing * dt);
            b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
          }
        }
        if (b.homing && !b.drift) {
          let best = null, bd = b.homeR || 260;
          for (const e of enemies) {
            const d = Math.hypot(e.x - b.x, e.ty - b.y);
            if (d < bd) { bd = d; best = e; }
          }
          if (best) {
            const sp = Math.hypot(b.vx, b.vy) || 1;
            let ang = Math.atan2(b.vy, b.vx);
            let diff = Math.atan2(best.ty - b.y, best.x - b.x) - ang;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            ang += clamp(diff, -b.homing * dt, b.homing * dt);
            b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
          }
        }
        const sn = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 2));
        for (let st = 0; st < sn && !dead && !boom; st++) {
          const nx = b.x + b.vx * dt / sn, ny = b.y + b.vy * dt / sn;
          const j = enemyAt(nx, ny, b.size + 1);
          if (j >= 0 && !(b.hit && b.hit.has(enemies[j]))) {
            const e = enemies[j];
            const sp = Math.hypot(b.vx, b.vy) || 1;
            damageEnemy(j, critRoll(b.dmg, b.crit));
            if (b.fire) setAlight(e);
            burst(nx, ny, 4, b.col);
            SFX.hit(nx, ny);
            if (b.knock) shove(e, b.vx / sp, b.vy / sp, b.knock);
            b.x = nx; b.y = ny;
            if (b.payload && b.trig !== 'expire') firePayload(b);   // a trigger goes off on a hit
            if (b.chain > 0) {                            // hop to the next one along
              (b.hit || (b.hit = new Set())).add(e);
              let best = null, bd = 150;
              for (const o of enemies) {
                if (b.hit.has(o)) continue;
                const d = Math.hypot(o.x - nx, o.ty - ny);
                if (d < bd) { bd = d; best = o; }
              }
              if (best) {
                b.chain--;
                SFX.fx('chainhop', nx, ny);
                const a = Math.atan2(best.ty - ny, best.x - nx);
                b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
                b.life = Math.max(b.life, 0.4);
                continue;
              }
            }
            if (b.cluster) { spray(b); dead = true; break; }
            if (b.explode) { boom = true; break; }
            if (b.pop) { explode(nx, ny, b.pop, b.dmg * 0.5); dead = true; break; }
            if (b.pull) { (b.hit || (b.hit = new Set())).add(e); continue; }   // a black hole rolls on
            if (b.pierce > 0) { b.pierce--; (b.hit || (b.hit = new Set())).add(e); }
            else { dead = true; break; }
          }
          if (b.friendly && !p.dead && nx > p.x - 2 && nx < p.x + PW + 2 &&
              ny > p.y - 2 && ny < p.y + PH + 2) {
            burst(nx, ny, 5, b.col); hurt(Math.round(b.dmg * 2)); dead = true; break;
          }
          if (solidAt(nx, ny)) {
            if (b.payload && b.trig !== 'expire') firePayload(b);   // so does touching rock
            if (b.bounce > 0 && !b.bore && !b.eat) {
              b.bounce--;
              const hx = solidAt(nx, b.y), hy = solidAt(b.x, ny);
              if (hx || !hy) b.vx = -b.vx;
              if (hy || !hx) b.vy = -b.vy;
              const be = b.bounceE || 0.92;
              b.vx *= be; b.vy *= be;
              const slow = Math.hypot(b.vx, b.vy) < 60;
              if (slow && b.lifeBoom) b.bounce++;         // a bomb at rest doesn't use up its bounces
              if (!slow) SFX.bounce(b.x, b.y);
              if (b.look) shotBounce(b);
              if (b.bounceFx === 'explode') explode(b.x, b.y, Math.max(10, b.explode || 12));
              break;                      // stay put: b.x/b.y are still outside the rock
            }
            b.x = nx; b.y = ny;
            if (b.bore > 0) { if (b.look) shotGrind(b, nx, ny); dig(nx, ny, b.bore); continue; }
            // Matter Eater / Black Hole: eat straight through the rock, digging as it goes,
            // so a fast shot can't outrun the small hole its per-frame eat carves ahead
            if (b.eat > 0) { dig(nx, ny, b.eat); continue; }
            if (b.cluster) { spray(b); dead = true; break; }
            if (b.explode) { boom = true; break; }
            if (b.pop) { explode(b.x, b.y, b.pop, b.dmg * 0.5); dead = true; break; }
            if (b.pit) dig(nx, ny, b.pit);                // Noita's small hole where a shot lands
            burst(b.x, b.y, 3, b.col);
            SFX.rock(b.x, b.y);
            dead = true;
            break;
          }
          b.x = nx; b.y = ny;
        }
        if (boom) { explode(b.x, b.y, b.explode, undefined, b.fire); dead = true; }
        if (dead && b.fire) ignite(b.x, b.y, b.size + 6, 0.9);
        // an expiration trigger goes off however it dies; a trigger stopped by a prop counts as a hit
        if (dead && b.payload && (b.trig === 'expire' || b.struck)) firePayload(b);
        if (dead && b.tele) teleportTo(b);            // Teleport Bolt: you go where it stopped
        if (dead && b.arc && b.trail) {               // the bolt's path lingers for a blink
          b.trail.push({ x: b.x, y: b.y });
          addArc(b.trail, b.col, 1.4, 0.16);
        }
        if (dead && b.look) shotDeath(b);
        if (dead) bullets.splice(i, 1);
      }
      for (let i = arcs.length - 1; i >= 0; i--) if ((arcs[i].t += dt) > arcs[i].max) arcs.splice(i, 1);

      // ---- sound, once a frame: where you are listening from, the jetpack, each live
      // Black Hole's drone, the floor's ambience, and a heartbeat when you're nearly dead ----
      SFX.ear(pcx, pcy);
      if (!jetLoop && SFX.ready) jetLoop = SFX.loop('jet');
      if (jetLoop) jetLoop.set(p.dead ? 0 : Math.min(1, p.flame) * 0.35, null, null,
        (1 + 0.49 * Math.min(1, p.flame)) * jetPitch(jetSt.onT));   // tone: thrust, then how long it's held
      if (p.empty && !wasEmpty) SFX.ui('sputter');
      wasEmpty = p.empty;
      for (const b of bullets) if (b.pull) {
        let h = bhLoops.get(b);
        if (!h && bhLoops.size < 3 && SFX.ready) { h = SFX.loop('void'); if (h) bhLoops.set(b, h); }
        if (h) h.set(0.5, b.x, b.y);
      }
      for (const [b, h] of bhLoops) if (!bullets.includes(b)) { h.stop(); bhLoops.delete(b); }
      SFX.ambTick(dt);
      if (!portalLoop && SFX.ready) portalLoop = SFX.loop('portal');
      if (portalLoop) portalLoop.set(0.55, portal.x + portal.w / 2, portal.y + portal.h / 2);
      if (matterProps.length) {
        let best = null, bd = 300;
        for (const pr of matterProps) { const d = Math.hypot(pr.x - pcx, pr.y - pcy); if (!pr.gone && d < bd) { bd = d; best = pr; } }
        if (best && !matterLoop && SFX.ready) matterLoop = SFX.loop('matter');
        if (matterLoop && best) matterLoop.set(0.6, best.x, best.y);
      }
      if (p.jet > 0 && !wasJet) SFX.fx('ignite');
      wasJet = p.jet > 0;
      for (const dv of devils) if ((dv.snd = (dv.snd || 0) - dt) <= 0) { dv.snd = 0.9 + Math.random() * 0.8; SFX.fx('whirl', dv.x, dv.y - 14); }
      if (!p.dead && p.hp / MHP < 0.3 && (beatT -= dt) <= 0) { beatT = 0.55 + 1.5 * p.hp / MHP; SFX.ui('beat'); }

      // ---- static fields ----
      for (let i = fields.length - 1; i >= 0; i--) {
        const f = fields[i];
        f.life -= dt; f.tick -= dt;
        const near = j => Math.hypot(enemies[j].x - f.x, enemies[j].ty - f.y) < f.r;
        if (f.field === 'slow' || f.field === 'storm') {
          // Stillness frosts and the thundercloud's rain soaks: any fire under them goes out
          if ((f.dT = (f.dT || 0) - dt) <= 0) { f.dT = 0.15;
            if (fireDouse(fire, f.x, f.y, f.r) && Math.random() < 0.5) SFX.fx('steam', f.x, f.y);
            for (const e of enemies) if (e.burn > 0 && Math.hypot(e.x - f.x, e.ty - f.y) < f.r) e.burn = 0;
            if (p.burn > 0 && Math.hypot(pcx - f.x, pcy - f.y) < f.r) p.burn = 0; }
          if (f.field === 'slow' && Math.random() < dt * 14) { const a = Math.random() * 6.283, r = Math.random() * f.r;
            glowDot(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, rnd(-4, 4), rnd(4, 12), Math.random() < 0.5 ? '#ffffff' : '#bfe8ff', rnd(0.7, 1.1), rnd(0.4, 0.9)); }
        }
        if (f.field === 'heal' && Math.random() < dt * 10) { const a = Math.random() * 6.283, r = Math.random() * f.r;
          glowDot(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, 0, rnd(-18, -8), Math.random() < 0.5 ? '#9dff9a' : '#46c48c', rnd(0.8, 1.2), rnd(0.4, 0.8)); }
        if (f.field === 'mine') {
          f.near = enemies.some(e => Math.hypot(e.x - f.x, e.ty - f.y) < f.r * 2.2);
          let trip = f.life <= 0;
          for (let j = 0; j < enemies.length && !trip; j++) if (near(j)) trip = true;
          if (trip) { explode(f.x, f.y, f.r); fieldPayload(f); fields.splice(i, 1); continue; }
        } else if (f.field === 'dormant') {
          // set off by any blast of yours, which is the whole point of it
          for (const fl of flashes) {
            if (Math.hypot(fl.x - f.x, fl.y - f.y) < fl.r + f.r * 0.5) {
              explode(f.x, f.y, f.r * 1.6); fieldPayload(f); fields.splice(i, 1); f.life = -1; break;
            }
          }
          if (f.life < 0) continue;
        } else if (f.field === 'slow') {
          for (const e of enemies) if (Math.hypot(e.x - f.x, e.ty - f.y) < f.r) e.chill = 0.2;
        } else if (f.field === 'shield') {
          for (let k = enemyShots.length - 1; k >= 0; k--) {
            const b = enemyShots[k];
            if (Math.hypot(b.x - f.x, b.y - f.y) < f.r) { burst(b.x, b.y, 3, f.col); SFX.fx('absorb', b.x, b.y); enemyShots.splice(k, 1); }
          }
        } else if (f.field === 'heal') {
          if (Math.hypot(pcx - f.x, pcy - f.y) < f.r && p.hp < MHP && f.tick <= 0) {
            f.tick = 0.4; p.hp = Math.min(MHP, p.hp + 4 * pb.heal); input.current.notify(); SFX.fx('healtick');
          }
        } else if (f.field === 'storm') {
          if (f.tick <= 0) {
            f.tick = 0.22;
            const a = Math.random() * Math.PI * 2, rr = Math.random() * f.r;
            const sx = f.x + Math.cos(a) * rr, sy = f.y + Math.sin(a) * rr;
            for (let j = enemies.length - 1; j >= 0; j--)
              if (Math.hypot(enemies[j].x - sx, enemies[j].ty - sy) < 22) damageEnemy(j, 2);
            burst(sx, sy, 6, '#a8e4ff');
            addArc([{ x: sx + rnd(-8, 8), y: f.y - f.r * 0.85 }, { x: sx, y: sy }], '#a8e4ff', 1.2, 0.14);   // down from the cloud
            SFX.arc(sx, sy, true);
          }
        } else if (f.field === 'vacuum') {
          // Noita's Vacuum Field: a blink after it appears, everything in reach is warped
          // straight to the middle, through walls — creatures, shots (theirs and yours),
          // gold and loot. Once, then it's gone.
          if (!f.done && f.max - f.life >= VACUUM_WAIT) {
            f.done = true;
            const inR = (x, y) => Math.hypot(x - f.x, y - f.y) < f.r;
            for (const e of enemies) if (inR(e.x, e.ty)) { e.y += f.y - e.ty; e.x = f.x; e.tgt = null; }
            for (const b of bullets) if (inR(b.x, b.y)) { b.x = f.x; b.y = f.y; }
            for (const b of enemyShots) if (inR(b.x, b.y)) { b.x = f.x; b.y = f.y; }
            for (const g of coins) if (inR(g.x, g.y)) { g.x = f.x; g.y = f.y; }
            for (const q of pickups) if (!q.taken && inR(q.x, q.y)) { q.x = f.x; q.y = f.y; }
            burst(f.x, f.y, 14, f.col);
            SFX.fx('warp', f.x, f.y);
          }
        } else if (f.field === 'glitter') {
          if (f.tick <= 0) {
            f.tick = 0.16;
            const a = Math.random() * Math.PI * 2, rr = Math.random() * f.r;
            explode(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr, 9);
          }
        }
        if (f.life <= 0) fields.splice(i, 1);
      }
      for (let i = beams.length - 1; i >= 0; i--) if ((beams[i].t += dt) > 0.12) beams.splice(i, 1);

      // ---- pickups: just cooldown upkeep and clearing what was taken. Whether one is
      // near enough to show its card, and whether you actually take it, is decided
      // below together with the shop — both go through the same interact tap now. ----
      for (let i = pickups.length - 1; i >= 0; i--) {
        const q = pickups[i];
        if (q.taken) { pickups.splice(i, 1); continue; }
        if (q.cool > 0) q.cool -= dt;
      }
      // ---- gold ----
      for (let i = coins.length - 1; i >= 0; i--) {
        const g = coins[i];
        const dx = pcx - g.x, dy = pcy - g.y, d = Math.hypot(dx, dy) || 1;
        const pull = COIN_PULL * pb.goldPull;    // Attract Gold reaches further
        if (g.nopull > 0) g.nopull -= dt;        // gold a rat just knocked out of you flies clear first
        if (d < pull && !p.dead && !(g.nopull > 0)) {
          // inside the pull radius it flies to you, straight through rock
          const grab = 180 + 900 * (1 - d / pull);
          g.vx = (g.vx || 0) + (dx / d) * grab * dt * 6;
          g.vy += (dy / d) * grab * dt * 6;
          g.vx *= 0.88; g.vy *= 0.88;
          g.x += g.vx * dt; g.y += g.vy * dt;
          if (d < 12) {
            LO.gold += g.amount;
            coins.splice(i, 1);
            SFX.ui('coin');
            input.current.notify();
          }
          continue;
        }
        if (g.pop) {
          // knocked out of you: flies in an arc, bounces a few times and skids to a stop
          g.vx *= Math.exp(-0.6 * dt);
          g.vy += 420 * dt;
          const nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
          if (solidAt(nx, g.y)) g.vx *= -0.4; else g.x = nx;
          if (solidAt(g.x, ny + 3)) {
            if (g.vy > 70) { g.vy = -g.vy * 0.42; g.vx *= 0.7; SFX.fx('coinland', g.x, g.y); }
            else { g.vy = 0; g.vx *= Math.exp(-8 * dt); if (Math.abs(g.vx) < 4) { g.vx = 0; g.pop = 0; } }
          } else if (solidAt(g.x, ny - 3) && g.vy < 0) g.vy = 0;
          else g.y = ny;
          continue;
        }
        g.vx = (g.vx || 0) * 0.9;
        g.vy += 320 * dt;
        const nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
        if (!solidAt(nx, g.y)) g.x = nx;
        if (solidAt(g.x, ny + 3)) { if (g.vy > 60) SFX.fx('coinland', g.x, g.y); g.vy = 0; } else g.y = ny;
      }

      // ---- what you can interact with: a shop plinth, or something on the ground ----
      const inShop = p.y + PH > SHOP_Y;
      let near = null;                      // { src: 'shop', it } or { src: 'pickup', q }
      for (const it of stock) {
        if (it.sold) continue;
        if (Math.abs(it.x - pcx) > 15 || Math.abs(it.y - pcy) > 22) continue;
        near = { src: 'shop', it };
        break;
      }
      if (!near) for (const q of pickups) {
        if (q.cool > 0) continue;
        if (Math.abs(q.x - pcx) > 18 || Math.abs(q.y - pcy) > 20) continue;
        near = { src: 'pickup', q };
        break;
      }
      // the hidden rooms' prizes: a perk on its altar, or the +25 heart
      if (!near) for (const r of rooms) {
        if (r.taken) continue;
        if (Math.abs(r.x - pcx) > 20 || Math.abs(r.y - pcy) > 26) continue;
        near = { src: 'room', r };
        break;
      }
      const nearKey = !near ? -1 : near.src + ':' +
        (near.src === 'shop' ? stock.indexOf(near.it)
          : near.src === 'room' ? rooms.indexOf(near.r) : pickups.indexOf(near.q));
      const label = !near ? null
        : near.src === 'shop'
          ? (near.it.kind === 'heal' ? { text: 'Full heal', price: 0, can: p.hp < MHP }
            : near.it.kind === 'gun' ? { text: near.it.gun.name, gun: near.it.gun,
                price: near.it.price, can: LO.gold >= near.it.price }
            : { text: MODS[near.it.id].name, id: near.it.id, price: near.it.price,
                can: LO.gold >= near.it.price })
          : near.src === 'room'
            ? (near.r.kind === 'perk'
                ? { text: PERKS[near.r.id].name, perk: near.r.id, price: 0, can: true }
                : { text: '+25 Max Health', heart: true, price: 0, can: true })
          // things on the ground are always yours for the taking — the price is what
          // the "For sale"/"Found" split cares about, not whether you're allowed to
          : (near.q.kind === 'gun' ? { text: near.q.gun.name, gun: near.q.gun, price: 0, can: true, found: true }
            : { text: MODS[near.q.id].name, id: near.q.id, price: 0, can: true, found: true });
      // where the item sits on screen, so the panel can float its bottom edge just above
      // it (the plinth/pickup) rather than covering it. camY/unitPx are last frame's, from
      // draw(); the item is static and the camera settles, so it lands right within a frame
      // or two. In css px measured up from the bottom of the view — that's the panel's
      // `bottom`. Bucketed into the sig so the panel re-lays-out as the camera settles.
      let pbottom = 12;
      if (near) {
        const iy = near.src === 'shop' ? near.it.y : near.src === 'room' ? near.r.y : near.q.y;
        const dprc = window.devicePixelRatio || 1;
        pbottom = Math.round(Math.max(10, c.height / dprc - (iy - 16 - camY) * unitPx));
      }
      const sig = nearKey + ':' + (label && label.can ? 1 : 0) + ':' + inShop + ':' + Math.round(pbottom / 16);
      if (nearKey !== -1 && nearKey !== lastNear) SFX.fx('prompt');   // a soft blip as a card comes up
      lastNear = nearKey;
      if (sig !== input.current.sig) {
        input.current.sig = sig;
        input.current.prompt = label;
        input.current.promptBottom = pbottom;
        input.current.inShop = inShop;
        input.current.notify();
      }
      // dead: a tap on the right stick restarts the run (see the death message)
      if (p.dead && input.current.interact) {
        input.current.interact = false;
        if (input.current.requestRestart) input.current.requestRestart();
      }
      if (input.current.interact && near) {
        input.current.interact = false;
        if (near.src === 'shop') {
          const it = near.it;
          if (it.kind === 'heal') {
            if (p.hp < MHP) { p.hp = MHP; it.sold = true; toast('Patched up'); SFX.ui('heal'); }
          } else if (LO.gold < it.price) {
            toast('Not enough gold');
            SFX.ui('poor');
          } else if (it.kind === 'gun') {
            LO.gold -= it.price;
            it.sold = true;
            // it drops at the plinth, so the usual chooser decides which slot it takes
            // and "leave it" parks the gun you paid for on the floor rather than binning it
            pickups.push({ kind: 'gun', x: it.x, y: it.y, gun: it.gun, t: 0 });
            toast('Bought ' + it.gun.name);
            SFX.ui('buy');
          } else {
            LO.gold -= it.price;
            LO.bag.push(it.id);
            it.sold = true;
            toast('Bought ' + MODS[it.id].name);
            SFX.ui('buy');
          }
        } else if (near.src === 'room') {
          const r = near.r;
          if (r.kind === 'perk') {
            const before = maxHp();
            (LO.perks || (LO.perks = [])).push(r.id);
            refreshBag();
            const after = maxHp();
            if (after > before) p.hp += after - before;   // Extra Health comes full
            p.hp = Math.min(p.hp, after);                 // Glass Cannon trims it
            if (pb.seeAll) { seen.fill(2); paintFog(); }  // All-Seeing Eye lights it up now
            if (pb.ghost && !ghost) ghost = { x: pcx, y: pcy, cd: 0 };
            toast('Perk: ' + PERKS[r.id].name);
            SFX.ui('perk');
          } else {
            LO.maxBonus = (LO.maxBonus || 0) + 25;        // the heart raises the cap, no heal
            toast('+25 Max Health');
            SFX.ui('heart');
          }
          r.taken = true;
        } else {
          const q = near.q;
          if (q.kind === 'mod') {
            // a mod goes straight to the bag — the panel already showed what it is, and a
            // mod has no slot to choose, so there's no second screen for it
            LO.bag.push(q.id);
            q.taken = true; q.cool = PICKUP_COOL;
            toast('Picked up ' + MODS[q.id].name);
            SFX.ui('mod');
          } else {
            // a gun opens the chooser: compare it with yours and pick the slot to swap
            input.current.found = q;
          }
        }
        input.current.sig = '';
        input.current.notify();
      }
      input.current.interact = false;

      for (let i = toasts.length - 1; i >= 0; i--) if ((toasts[i].t -= dt) <= 0) toasts.splice(i, 1);

      decorStep(dt, pcx, pcy);

      // ---- enemies ----
      // What an enemy does is what it is. Shooters hold a hover and fire on sight,
      // turrets never move and wind up a long shot, chasers come at you and hurt on
      // contact, bombers come at you and burst. Runs backwards because a bomber
      // takes itself out of the list.
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i], k = e.k;
        e.flash -= dt;
        e.cd -= dt;
        e.touch -= dt;
        const dx = pcx - e.x, dy = pcy - e.ty, dist = Math.hypot(dx, dy) || 1;
        e.lx = dx / dist; e.ly = dy / dist;
        // Aggro (k.aggro) and firing (k.range) reaches are in world units, but the
        // camera zoom changes how much world fits on screen — zoomed in, an enemy off
        // the edge of the view could still hunt and shoot you. Scale both by 1/zoom so
        // they engage at roughly the same on-screen distance whatever the zoom.
        // Invisibility still folds in on top: creatures notice you far later.
        const sees = (pb.invis ? 0.4 : 1) / DEV.zoom;
        // aggro only on a real sightline: a chaser or bomber won't come for you through a
        // wall any more, only once it can actually see you (and within its aggro reach).
        // The range check comes first so the line-of-sight march only runs for the few
        // enemies already close enough to care.
        // DEV.aggro is an extra hand-tuning multiplier on the aggro reach, on top of the
        // zoom-relative `sees` scaling — firing range (k.range) is left alone.
        // Aggro is sticky: once a chaser/bomber has you it keeps coming (even out of the
        // initial reach and even round a wall), and only drops back to patrol once you've
        // put DEV.loseAggro times the aggro reach between you — so you can outrun it.
        const chaser = HUNTERS[k.act] && !p.dead;
        // a reworked creature rolls its own aggro reach from its knobs, once a second
        if (k.kp && ((e.aggroT = (e.aggroT || 0) - dt) <= 0)) { e.aggroM = kr(k.kp + 'Aggro'); e.aggroT = 1; }
        const reach = k.aggro * sees * DEV.aggro * (k.kp ? e.aggroM : 1);
        if (chaser) {
          if (!e.aggro) { if (dist < reach && lineOfSight(e.x, e.ty, pcx, pcy)) { e.aggro = true; SFX.creature(k, 'alert', e.x, e.ty); } }
          else if (dist > reach * DEV.loseAggro) e.aggro = false;
        } else e.aggro = false;
        const hunting = chaser && e.aggro;
        // the odd noise from anything near, seen or not: you hear the cave before you see it
        if (dist < 380 && Math.random() < 0.07 * dt) SFX.creature(k, 'idle', e.x, e.ty);
        // a bomber closing in ticks like a fuse, faster the nearer it gets
        if (hunting && k.act === 'bomb' && dist < 160 && (e.fuseT = (e.fuseT || 0) - dt) <= 0) {
          e.fuseT = 0.12 + dist / 400; SFX.creature(k, 'fuse', e.x, e.ty);
        }
        if (k.act === 'nest') {
          // lets a rat out now and then, while it has fewer than its max alive; only while
          // you're near enough for it to matter
          const N = e.nest;
          if (!N.max) { N.max = Math.round(kr('raMax')); N.wake = kr('raWake'); }
          if (dist < N.wake && (N.t -= dt) <= 0) {
            N.t = kr('raSpawn');
            let out = 0;
            for (const r of enemies) if (r.home === e) out++;
            if (out < N.max) spawnRat(e);
          }
          e.chill = 1; e.ty = e.y;
          continue;
        }
        if (k.act === 'rat') {
          ratFrame(e, dt, dist, hunting, pcx, pcy);
          e.chill = 1; e.ty = e.y;
          continue;
        }
        if (k.act === 'spider') {
          // only on rock and its own lines (spiderStep); strings you when it has a clear line
          const cold = e.chill && e.chill < 1 ? e.chill : 1;
          if (spiderStep(e, { solidCell, webs, hunting, goal: { x: pcx, y: pcy }, rnd: Math.random,
            speedMul: cold }, dt) === 'web') SFX.fx('lash', e.x, e.y);
          e.silkT = (e.silkT || 0) - dt;
          const S = e.sp;
          if (hunting && e.silkT <= 0 && S && (S.mode === 'surf' || S.mode === 'line') &&
              dist < (e.silkR || (e.silkR = spr('spSilk'))) * sees && dist > e.r + 24) {
            e.silkT = 0.4;
            if (lineOfSight(e.x, e.y, pcx, pcy)) {
              e.silkT = spr('spSilkCd'); e.silkR = spr('spSilk');
              const v = spr('spSilkSpd');
              silk.push({ x: e.x, y: e.y, ax: e.x, ay: e.y, vx: dx / dist * v, vy: dy / dist * v,
                life: 400 / v * 1.3 + 0.1 });
              SFX.creature(k, 'fire', e.x, e.y);
            }
          }
        } else if (k.act === 'jelly') {
          // swims in pulses (jellyStep); spits when its head is lined up on you, in range
          const cold = e.chill && e.chill < 1 ? e.chill : 1;
          if (jellyStep(e, { solidCell, hunting, goal: { x: pcx, y: pcy }, rnd: Math.random,
            speedMul: cold, rangeMul: sees, stay: zone ? natural : null }, dt) === 'pulse') puffSpores(e);
          const S = e.je;
          // brush its tentacles and you're stung, hunting or not (same sting knobs as the bell)
          if (!p.dead && e.touch <= 0 && dist < 180) {
            const t = tentacleTouch(S, p.x, p.y, p.x + PW, p.y + PH);
            if (t) {
              hurt(Math.round(kr('jeBite'))); e.touch = kr('jeBiteCd');
              burst(t.x, t.y, 5, jellyPal(S.u.col).tent);
              SFX.creature(k, 'bite', t.x, t.y);
            }
          }
          if (hunting && S.inRange && S.aimed && e.cd <= 0) {
            e.cd = 0.25;                                // no clear line: look again shortly
            const hx = e.x + Math.cos(S.hd) * e.r * 0.9, hy = e.y + Math.sin(S.hd) * e.r * 0.9;
            if (lineOfSight(hx, hy, pcx, pcy)) {
              e.cd = kr('jeShotCd');
              const a = Math.atan2(pcy - hy, pcx - hx) + (Math.random() * 2 - 1) * kr('jeSpread') * Math.PI / 180;
              const v = kr('jeShotSpd'), P = jellyPal(S.u.col);
              enemyShots.push({ x: hx, y: hy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 3,
                col: P.spit, edge: P.spitEdge, shine: P.spitShine, dripCol: P.drip, dripCol2: P.drip2, glow: hexRgb(P.glow),
                dmg: Math.round(kr('jeShotDmg')), size: kr('jeShotSize'), goo: 1,
                drip: kr('jeDrip'), da: 0, dripG: kr('jeDripG'), splat: Math.round(kr('jeSplat')), splatV: kr('jeSplatSpd') });
              SFX.creature(k, 'fire', e.x, e.y);
            }
          }
        } else if (k.act === 'turret') {
          // holds station: the hover is all the movement it gets
        } else if (hunting) {
          const step = k.spd * (e.chill || 1) * dt;
          const wx = e.x + dx / dist * step, wy = e.y + dy / dist * step;
          if (!solidAt(wx - e.r, wy) && !solidAt(wx + e.r, wy) &&
              !solidAt(wx, wy - e.r) && !solidAt(wx, wy + e.r)) { e.x = wx; e.y = wy; }
          else if (!solidAt(wx, e.y)) e.x = wx;            // slide along whatever it hit
          else if (!solidAt(e.x, wy)) e.y = wy;
          else { e.tgt = null; e.rest = 0; }
        } else {
          // patrol: pick a spot near home, drift to it, pause, pick another. Rock in
          // the way just means the spot was a bad idea, so it chooses a different one.
          e.rest -= dt;
          if (!e.tgt || e.rest <= 0 || Math.hypot(e.tgt.x - e.x, e.tgt.y - e.y) < 6) {
            const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * PATROL_R;
            e.tgt = { x: e.hx + Math.cos(a) * r, y: e.hy + Math.sin(a) * r };
            e.rest = 2 + Math.random() * 3.5;
          }
          const tdx = e.tgt.x - e.x, tdy = e.tgt.y - e.y, td = Math.hypot(tdx, tdy) || 1;
          const step = k.spd * (e.chill || 1) * dt;
          const wx = e.x + tdx / td * step, wy = e.y + tdy / td * step;
          if (solidAt(wx - e.r, wy) || solidAt(wx + e.r, wy) ||
              solidAt(wx, wy - e.r) || solidAt(wx, wy + e.r)) { e.tgt = null; e.rest = 0; }
          else { e.x = wx; e.y = wy; }
        }
        e.chill = 1;                                  // fields re-apply it every frame
        e.ty = k.kp ? e.y : e.y + Math.sin(time * 2 + e.phase) * (hunting ? 2 : 4);

        // contact: a chaser hurts you by reaching you, a bomber goes off
        if (hunting && dist < e.r + 14 && e.touch <= 0) {
          if (k.act === 'bomb') {
            burst(e.x, e.ty, 22, k.col.a);
            SFX.boom(e.x, e.ty, 26);
            hurt(k.dmg);
            enemies.splice(i, 1);
            if (k.fire) fireBlast(e.x, e.ty, 26, 1);
            continue;
          }
          SFX.creature(k, 'bite', e.x, e.ty);
          hurt(k.kp ? Math.round(kr(k.kp + 'Bite')) : k.dmg);
          e.touch = k.kp ? kr(k.kp + 'BiteCd') : 0.9;
        }

        // firing. A turret with a wind-up shows the ring first and only shoots if it
        // still has a line on you when the ring closes.
        if (k.act === 'shoot' || k.act === 'turret') {
          if (e.charge > 0) {
            e.charge -= dt;
            if (e.charge <= 0) fireEnemyShot(e, pcx, pcy);
          } else if (!p.dead && dist < k.range * sees && e.cd <= 0) {
            e.cd = 0.4;   // re-check soon if we can't see the player
            if (lineOfSight(e.x, e.ty, pcx, pcy)) {
              e.cd = k.cd * (0.85 + Math.random() * 0.3);
              if (!e.spotted) { e.spotted = true; SFX.creature(k, 'alert', e.x, e.ty); }
              if (k.tele) { e.charge = k.tele; SFX.creature(k, 'charge', e.x, e.ty, k.tele); } else fireEnemyShot(e, pcx, pcy);
            }
          }
        }
      }
      // Contact Damage: anything touching you is hurt for it, whether or not it's hunting
      if (pb.contact && !p.dead) {
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          if (Math.hypot(e.x - pcx, e.ty - pcy) < e.r + 12) damageEnemy(i, 45 * dt);
        }
      }

      for (let i = enemyShots.length - 1; i >= 0; i--) {
        const b = enemyShots[i];
        b.life -= dt;
        // Projectile Repulsion Field: shots on their way to you are shoved aside
        if (pb.repel) {
          const rx = b.x - pcx, ry = b.y - pcy, rd = Math.hypot(rx, ry) || 1;
          if (rd < 72) { b.vx += rx / rd * 1100 * dt; b.vy += ry / rd * 1100 * dt; }
        }
        // poison spit drips as it flies
        if (b.drip) for (b.da += b.drip * dt; b.da >= 1; b.da--)
          goo(b.x + (Math.random() - 0.5) * b.size, b.y + b.size * 0.5, b.vx * 0.08, 8 + Math.random() * 18, b.dripG, b.dripCol || b.col, 0, b.dripCol2);
        let gone = b.life <= 0;
        if (b.fire) fireArea(fire, b.x, b.y, 4, 0.5);
        const sn = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 2);
        for (let s = 0; s < sn && !gone; s++) {
          b.x += b.vx * dt / sn; b.y += b.vy * dt / sn;
          if (solidAt(b.x, b.y)) {
            gone = true;
            if (b.splat != null) splat(b, b.x - b.vx * dt / sn, b.y - b.vy * dt / sn);
            else SFX.fx('fizzle', b.x, b.y);
            if (b.fire) ignite(b.x - b.vx * dt / sn, b.y - b.vy * dt / sn, 8, 0.9);
            break;
          }
          if (!p.dead && b.x > p.x - 2 && b.x < p.x + PW + 2 && b.y > p.y - 2 && b.y < p.y + PH + 2) {
            gone = true;
            if (b.splat != null) splat(b, b.x, b.y); else burst(b.x, b.y, 5, COL.player);
            hurt(b.dmg);
            if (b.fire) youAlight();
          }
        }
        if (gone) enemyShots.splice(i, 1);
      }
      // spider strings in flight: rock stops them, you catch them
      for (let i = silk.length - 1; i >= 0; i--) {
        const b = silk[i];
        b.life -= dt;
        let gone = b.life <= 0;
        const sn = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 2);
        for (let s = 0; s < sn && !gone; s++) {
          b.x += b.vx * dt / sn; b.y += b.vy * dt / sn;
          if (solidAt(b.x, b.y)) { gone = true; break; }
          if (!p.dead && b.x > p.x - 3 && b.x < p.x + PW + 3 && b.y > p.y - 3 && b.y < p.y + PH + 3) {
            gone = true;
            strings.push({ ax: b.ax, ay: b.ay, ox: b.x - p.x, oy: b.y - p.y, slow: spr('spSlow'), max: spr('spSilkMax') });
            SFX.fx('lash', b.x, b.y);
          }
        }
        if (gone) silk.splice(i, 1);
      }
      // strings on you: pulled past their length, they snap
      for (let i = strings.length - 1; i >= 0; i--) {
        const s = strings[i];
        if (Math.hypot(p.x + s.ox - s.ax, p.y + s.oy - s.ay) > s.max) {
          strings.splice(i, 1);
          burst(p.x + s.ox, p.y + s.oy, 4, '#e8e8f0');
          SFX.fx('lash', p.x + s.ox, p.y + s.oy);
        }
      }
      // a web line whose rock has been blasted away comes down (a few checked a frame)
      for (let n = Math.min(webs.length, 6); n > 0; n--) {
        webCheck = (webCheck + 1) % webs.length;
        const L = webs[webCheck];
        if ((L.bin && !solidAt(L.bin.x, L.bin.y)) || (L.ain && !solidAt(L.ain.x, L.ain.y))) {
          webs.splice(webCheck, 1);
          if (!webs.length) break;
        }
      }
      p.hitT -= dt;

      // ---- Angry Ghost: a spirit that trails you and fires at what's nearest ----
      if (pb.ghost) {
        if (!ghost) ghost = { x: pcx, y: pcy, cd: 0 };
        const gtx = pcx - p.face * 22, gty = p.y - 4;
        const lp = Math.min(1, dt * 4);
        ghost.x += (gtx - ghost.x) * lp; ghost.y += (gty - ghost.y) * lp;
        ghost.cd -= dt;
        if (ghost.cd <= 0 && !p.dead) {
          let best = null, bd = 340;
          for (const e of enemies) { const d = Math.hypot(e.x - ghost.x, e.ty - ghost.y); if (d < bd) { bd = d; best = e; } }
          if (best) {
            ghost.cd = 0.7;
            const a = Math.atan2(best.ty - ghost.y, best.x - ghost.x);
            bullets.push({ x: ghost.x, y: ghost.y, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480,
              life: 1.2, dmg: 2 * pb.dmg, size: 2, col: '#c9a6ff', spin: 0, homing: 3, bounce: 0,
              pierce: 0, explode: 0, grav: 0, accel: 0, bore: 0, hit: null, knock: 0, crit: 0,
              age: 0, born: 1.2 });
            SFX.fx('ghost', ghost.x, ghost.y);
          }
        }
      } else ghost = null;

      // ---- fire: the cave's, the creatures', yours ----
      fireFrame(dt, pcx, pcy);

      // ---- Levitation Trail: flying lays down fire that burns what it touches ----
      if (pb.trail && p.flame > 0 && !p.dead) {
        const bn = { x: pcx + (Math.random() - 0.5) * 6, y: p.y + PH, life: 0.7, max: 0.7 };
        burns.push(bn);
        if (burns.length > 48) burns.shift();
        fireArea(fire, bn.x, bn.y + 2, 4, 0.4);
      }
      for (let i = burns.length - 1; i >= 0; i--) {
        const bn = burns[i]; bn.life -= dt;
        for (let j = enemies.length - 1; j >= 0; j--)
          if (Math.hypot(enemies[j].x - bn.x, enemies[j].ty - bn.y) < 15) { setAlight(enemies[j]); damageEnemy(j, 22 * dt); }
        if (bn.life <= 0) burns.splice(i, 1);
      }

      // ---- jetpack smoke ----
      if (p.flame > 0) {
        let fx = -p.jx, fy = -p.jy + 0.8;
        const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
        smokeAcc += dt * (25 + 35 * p.flame);
        while (smokeAcc >= 1) {
          smokeAcc--;
          smoke.push({ x: pcx + (Math.random() - 0.5) * 5, y: p.y + PH + 3,
            vx: fx * 50 + (Math.random() - 0.5) * 20, vy: fy * 50 + (Math.random() - 0.5) * 20,
            r: 1.5 + Math.random(), life: 0.9, max: 0.9 });
        }
      }
      for (let i = smoke.length - 1; i >= 0; i--) {
        const m = smoke[i];
        m.x += m.vx * dt; m.y += m.vy * dt;
        m.vx *= 1 - 2.5 * dt; m.vy = m.vy * (1 - 2.5 * dt) - 12 * dt;
        m.r += 5 * dt; m.life -= dt;
        if (m.life <= 0) smoke.splice(i, 1);
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const q = sparks[i];
        q.vy += (q.g != null ? q.g : q.heavy ? 600 : 300) * dt;
        const nx = q.x + q.vx * dt, ny = q.y + q.vy * dt;
        if (q.heavy && solidAt(nx, ny)) { q.vx *= 0.3; q.vy = 0; }
        else { q.x = nx; q.y = ny; }
        q.life -= dt;
        if (q.life <= 0) sparks.splice(i, 1);
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        flashes[i].t += dt;
        if (flashes[i].t > 0.25) flashes.splice(i, 1);
      }

      best = Math.max(best, Math.round((start.y - p.y) / 10));

      // ---- the torch ----
      // A random walk with two sines on top, which is what makes a flame gutter rather
      // than pulse. It never goes above 1: flicker means the light dipping, and a canvas
      // globalAlpha over 1 is simply ignored.
      torchT += dt;
      flickN += (Math.random() - 0.5) * 2.6 * dt;
      flickN *= 0.94;
      flick = clamp(0.94 + flickN + 0.04 * Math.sin(torchT * 11.3) + 0.025 * Math.sin(torchT * 19.7),
        0.84, 1);
      torchAcc += dt;
      while (torchAcc > 0.04) {
        torchAcc -= 0.04;
        const th = torchHand();
        const life = 0.3 + Math.random() * 0.35;
        torchP.push({ x: th.x + (Math.random() - 0.5) * 2, y: th.y - 7,
          vx: (Math.random() - 0.5) * 10 + p.vx * 0.15, vy: -20 - Math.random() * 22,
          life, max: life, s: 1 + Math.random() * 1.3,
          c: Math.random() < 0.5 ? COL.flame2 : COL.flame });
        if (torchP.length > 60) torchP.shift();
      }
      for (let i = torchP.length - 1; i >= 0; i--) {
        const q = torchP[i];
        q.vy += 30 * dt; q.vx *= 0.98;
        q.x += q.vx * dt; q.y += q.vy * dt;
        if ((q.life -= dt) <= 0) torchP.splice(i, 1);
      }
      // the flame's lean: spring toward "opposite your velocity", so a sudden move flings
      // it back and it wobbles upright again when you stop
      const wantX = clamp(-p.vx * 0.055, -11, 11), wantY = clamp(-p.vy * 0.03, -5, 7);
      leanVX += ((wantX - leanX) * 90 - leanVX * 9) * dt;
      leanVY += ((wantY - leanY) * 90 - leanVY * 9) * dt;
      leanX += leanVX * dt; leanY += leanVY * dt;
      // the glow gets its own quicker, deeper flicker on top of flick (the map light is untouched)
      glowN += (Math.random() - 0.5) * 6 * dt; glowN *= 0.9;

      // ---- portal motes ----
      portalAcc += dt;
      while (portalAcc > 0.05) {
        portalAcc -= 0.05;
        const ex = portal.x + portal.w / 2, ey = portal.y + portal.h / 2;
        if (Math.abs(ey - p.y) < 500) {        // the exit: scattered round it, drawn in
          const a = Math.random() * 6.28, rr = 30 + Math.random() * 38;
          const life = 1.4 + Math.random() * 0.8;
          motes.push({ kind: 'in', x: ex + Math.cos(a) * rr, y: ey + Math.sin(a) * rr * 0.9,
            tx: ex, ty: ey, vx: 0, vy: 0, life, max: life, age: 0, ph: Math.random() * 6.28,
            s: 1 + Math.random() * 1.4, c: Math.random() < 0.4 ? '#c8ffe4' : COL.portal });
        }
        if (Math.abs(arrival.y - p.y) < 500) { // the way in: breathed out, drifting away
          const a = Math.random() * 6.28, sp = 10 + Math.random() * 16;
          motes.push({ kind: 'out', x: arrival.x + (Math.random() - 0.5) * 12,
            y: arrival.y + (Math.random() - 0.5) * 18, ox: arrival.x, oy: arrival.y,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, life: 4, max: 4, age: 0,
            ph: Math.random() * 6.28, fade: 34 + Math.random() * 18,
            s: 1 + Math.random() * 1.3, c: Math.random() < 0.4 ? '#e6d4ff' : COL.enemy });
        }
      }
      for (let i = motes.length - 1; i >= 0; i--) {
        const q = motes[i];
        q.age += dt;
        if (q.kind === 'in') {
          // accelerate toward the centre, with a sideways wobble so it spirals in unevenly
          const dx = q.tx - q.x, dy = q.ty - q.y, d = Math.hypot(dx, dy) || 1;
          const pullF = 70 + 260 * q.age;
          q.vx += dx / d * pullF * dt; q.vy += dy / d * pullF * dt;
          q.vx *= 1 - 2.2 * dt; q.vy *= 1 - 2.2 * dt;
          const w = Math.sin(q.age * 7 + q.ph) * 26;
          q.x += (q.vx - dy / d * w) * dt; q.y += (q.vy + dx / d * w) * dt;
          if (d < 3) q.life = 0;
        } else if (q.kind === 'out') {
          const w = Math.sin(q.age * 2.3 + q.ph);
          q.vx += w * 18 * dt; q.vy += (Math.cos(q.age * 1.7 + q.ph) * 12 - 3) * dt;
          q.vx *= 1 - 0.4 * dt; q.vy *= 1 - 0.4 * dt;
          q.x += q.vx * dt; q.y += q.vy * dt;
          if (Math.hypot(q.x - q.ox, q.y - q.oy) > q.fade) q.life = 0;
        } else {
          q.vx *= 1 - 1.8 * dt; q.vy = q.vy * (1 - 1.8 * dt) - 6 * dt;
          q.x += q.vx * dt; q.y += q.vy * dt;
        }
        if ((q.life -= dt) <= 0) motes.splice(i, 1);
      }
      if (motes.length > 400) motes.splice(0, motes.length - 400);
    }

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      // the controls overlay the bottom of the canvas (see-through), so the play area is the
      // part above them: scale and frame to that, but still draw (and cull) the full canvas
      const ctlPx = Math.min(c.height * 0.8, (RPV ? RPV.panelH || 0 : input.current.ctlH || 0) * dpr);   // a replay: its panel
      const playPx = c.height - ctlPx;
      const s = Math.min(c.width / VIEW_W, playPx / VIEW_MIN_H) * DEV.zoom * (RPV ? RPV.zoom : 1), vw = c.width / s, vh = c.height / s;
      const vhp = playPx / s;
      unitPx = s / dpr;
      const pcx = p.x + PW / 2, pcy = p.y + PH / 2;

      // camera (a replay's is wherever the viewer has dragged it, or on you)
      if (RPV) {
        if (RPV.follow) {                     // framed on you like the live camera, then kept as the centre
          RPV.cx = vw >= WW ? WW / 2 : clamp(RPV.cx - vw / 2, 0, WW - vw) + vw / 2;
          RPV.cy = clamp(RPV.cy - vhp * 0.55, 0, Math.max(0, WH - vhp)) + vhp / 2;
        }
        camX = RPV.cx - vw / 2; camY = RPV.cy - vhp / 2; RPV.unit = unitPx;
      } else {
        const tx = vw >= WW ? (WW - vw) / 2 : clamp(pcx - vw / 2, 0, WW - vw);
        const ty = clamp(pcy - vhp * 0.55, 0, Math.max(0, WH - vhp));
        if (!camReady) { camX = tx; camY = ty; camReady = true; }
        camX += (tx - camX) * 0.15;
        camY += (ty - camY) * 0.15;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = 'rgb(' + themeFor(floor).bg.join(',') + ')';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.setTransform(s, 0, 0, s, -Math.round(camX * s), -Math.round(camY * s));

      // background and terrain (visible part only)
      // The background sits further back: it slides PARALLAX as far as the terrain does, so
      // it is shifted by the rest of the camera move. It still covers the view at every edge,
      // because the shift only ever pushes it toward the camera.
      const PARALLAX = 0.8;
      const bgox = camX * (1 - PARALLAX), bgoy = camY * (1 - PARALLAX);
      const bcx = camX - bgox, bcy = camY - bgoy;
      const bx0 = clamp(Math.floor(bcx / BCELL), 0, BW - 1), by0 = clamp(Math.floor(bcy / BCELL), 0, BH - 1);
      const bx1 = clamp(Math.ceil((bcx + vw) / BCELL) + 1, 1, BW), by1 = clamp(Math.ceil((bcy + vh) / BCELL) + 1, 1, BH);
      ctx.drawImage(bg, bx0, by0, bx1 - bx0, by1 - by0, bx0 * BCELL + bgox, by0 * BCELL + bgoy, (bx1 - bx0) * BCELL, (by1 - by0) * BCELL);
      // the shop's back wall
      if (camY + vh > SHOP_Y) {
        ctx.fillStyle = '#241f28';
        ctx.fillRect(0, SHOP_Y, WW, (SHOP_FLOOR * CELL) - SHOP_Y);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        for (let bx = 0; bx < WW; bx += 24)
          for (let by = SHOP_Y; by < SHOP_FLOOR * CELL; by += 12)
            ctx.fillRect(bx + ((by / 12) % 2) * 12, by, 11, 11);
        ctx.fillStyle = 'rgba(233,236,242,0.30)';
        ctx.font = '600 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SHOP', WW / 2, SHOP_Y + 14);
        // The floor number, huge and widely spaced along the whole back wall — just a
        // touch brighter than the wall itself, so it reads as painted-on lettering
        // rather than a label. Each glyph is placed by hand so the word spans most of
        // the wall's width no matter how many digits the floor has.
        const wallBot = SHOP_FLOOR * CELL, wallH = wallBot - SHOP_Y;
        const label = 'FLOOR ' + floor;
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.font = '800 ' + Math.round(wallH * 0.62) + 'px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        const margin = WW * 0.05, span = WW - margin * 2, cyText = SHOP_Y + wallH / 2 + 4;
        for (let i = 0; i < label.length; i++)
          ctx.fillText(label[i], margin + span * (i + 0.5) / label.length, cyText);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
      }

      const tx0 = clamp(Math.floor(camX / CELL), 0, CW - 1), ty0 = clamp(Math.floor(camY / CELL), 0, CH - 1);
      const tx1 = clamp(Math.ceil((camX + vw) / CELL) + 1, 1, CW), ty1 = clamp(Math.ceil((camY + vh) / CELL) + 1, 1, CH);
      viewW = vw; viewH = vh;
      // the decoration layer (pass 2): behind the rock, in front of the back wall
      ctx.drawImage(RPV ? RT.dC : decoC, tx0, ty0, tx1 - tx0, ty1 - ty0, tx0 * CELL, ty0 * CELL, (tx1 - tx0) * CELL, (ty1 - ty0) * CELL);
      ctx.drawImage(RPV ? RT.tC : terrain, tx0, ty0, tx1 - tx0, ty1 - ty0, tx0 * CELL, ty0 * CELL, (tx1 - tx0) * CELL, (ty1 - ty0) * CELL);
      // the burning pixels, over the art they're eating: colour by how much fuel is left, and a
      // new flicker each fire tick. Drawn under the fog, so fire you haven't seen stays hidden;
      // the glow on top comes after the fog, only on ground you have seen (fireVis).
      fireVis.length = 0;
      if (fire.list.length) {
        const buckets = [[], [], [], []];
        for (const i of fire.list) {
          const x = i % CW, y = (i / CW) | 0;
          if (x < tx0 || x >= tx1 || y < ty0 || y >= ty1) continue;
          fireVis.push(i);
          const t = fire.t[i], h = (Math.imul(i, 2654435761) + fireN * 40503) >>> 30;
          buckets[t <= 3 ? 3 : h === 0 ? 0 : h === 3 ? 2 : 1].push(i);
        }
        for (let c = 0; c < 4; c++) {
          if (!buckets[c].length) continue;
          ctx.fillStyle = FIRE_COLS[c];
          ctx.beginPath();
          for (const i of buckets[c]) ctx.rect((i % CW) * CELL, ((i / CW) | 0) * CELL, CELL, CELL);
          ctx.fill();
        }
      }

      // the props (pass 3), their drips and the theme's ambience
      const TH = themeFor(floor);
      const onView = (x, y, m) => x > camX - m && x < camX + vw + m && y > camY - m && y < camY + vh + m;
      for (const pr of props)
        if (pr.x + pr.r > camX - 70 && pr.x + pr.l < camX + vw + 70 && pr.y + pr.b > camY - 90 && pr.y + pr.t0 < camY + vh + 90)
          drawProp(ctx, pr, time, TH);
      for (const q of dparts) {
        if (q.glow) continue;
        ctx.globalAlpha = Math.min(1, q.life / q.max * 3);
        ctx.fillStyle = q.c; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
      }
      ctx.lineWidth = 0.8;
      for (const q of amb) {
        if (q.glow) continue;
        ctx.globalAlpha = Math.min(1, q.life);
        if (q.streak) {
          ctx.strokeStyle = q.c; ctx.beginPath();
          ctx.moveTo(q.x - Math.sign(q.vx) * q.streak, q.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        } else { ctx.fillStyle = q.c; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
      }
      ctx.fillStyle = rgbA(mix(TH.rock[1], [255, 255, 255], 0.2));
      for (const dv of devils) {                          // a dust devil: a funnel of grit
        ctx.globalAlpha = 0.7 * Math.min(1, dv.life / 1.5, (dv.max - dv.life) / 1);
        for (let k = 0; k < 24; k++) {
          const hh = k / 24 * 30, r = 1.5 + hh * 0.35, a = time * 10 + k * 1.1;
          ctx.fillRect(dv.x + Math.cos(a) * r + Math.sin(time * 3 + k) - 0.6, dv.y - hh - 0.6, 1.2, 1.2);
        }
      }
      for (const cl of clouds) {                          // a burst pod's spore cloud
        const a = Math.min(1, cl.life / 1.5) * 0.28;
        for (let k = 0; k < 5; k++) {
          const ang = k * 1.26 + time * 0.6, rr = cl.r * 0.45;
          ctx.globalAlpha = a; ctx.fillStyle = '#a8d85a';
          ctx.beginPath(); ctx.arc(cl.x + Math.cos(ang) * rr, cl.y + Math.sin(ang) * rr * 0.7, cl.r * 0.6, 0, 6.29); ctx.fill();
        }
      }
      for (const rg of rings) {                           // a noise going out
        ctx.globalAlpha = 1 - rg.t / 0.9; ctx.strokeStyle = '#f0e6ff'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(rg.x, rg.y, 8 + rg.t * 140, 0, 6.29); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // exit portal: a glowing pool with a slow swirl of dashes round its rim
      const pulse = 0.55 + 0.25 * Math.sin(time * 3);
      const pcxE = portal.x + portal.w / 2, pcyE = portal.y + portal.h / 2;
      ctx.globalAlpha = pulse * 0.35;
      ctx.fillStyle = COL.portal;
      ctx.beginPath(); ctx.ellipse(pcxE, pcyE, portal.w, portal.h * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = pulse;
      ctx.beginPath(); ctx.ellipse(pcxE, pcyE, portal.w / 2, portal.h / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#d8fff0';
      ctx.beginPath(); ctx.ellipse(pcxE, pcyE, portal.w * 0.22, portal.h * 0.26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#c8ffe4'; ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 5]); ctx.lineDashOffset = time * 12;
      ctx.beginPath(); ctx.ellipse(pcxE, pcyE, portal.w * 0.62, portal.h * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // smoke
      for (const m of smoke) {
        ctx.fillStyle = m.c || COL.smoke;
        ctx.globalAlpha = Math.max(0, m.life / m.max) * (m.a || 0.5);
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // static fields
      for (const f of fields) {
        if (f.y > camY + vh + f.r || f.y < camY - f.r) continue;
        const t = f.life / f.max;
        const beat = 0.75 + 0.25 * Math.sin(time * (f.field === 'mine' ? 7 : 3));
        ctx.globalAlpha = 0.14 * beat * (f.field === 'mine' || f.field === 'dormant' ? 2 : 1);
        ctx.fillStyle = f.col;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (f.field === 'mine' ? 0.35 : 1), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.55 * beat;
        ctx.strokeStyle = f.col;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.lineDashOffset = -time * 14;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + 0.6 * t), 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        if (!drawFieldLook(f, beat)) { ctx.fillStyle = f.col; ctx.beginPath(); ctx.arc(f.x, f.y, 3.5, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      // v96: what sits in the middle of a field (or over it)
      function drawFieldLook(f, beat) {
        const dia = (r, c, c2) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(f.x, f.y - r * 1.4); ctx.lineTo(f.x + r, f.y);
          ctx.lineTo(f.x, f.y + r * 1.4); ctx.lineTo(f.x - r, f.y); ctx.fill();
          ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(f.x, f.y - r * 1.4); ctx.lineTo(f.x + r * 0.45, f.y - r * 0.2);
          ctx.lineTo(f.x - r * 0.2, f.y); ctx.fill(); };
        if (f.field === 'mine') {               // a red crystal, blinking faster when something's close
          dia(3.2, '#c8302a', '#ff9a90');
          const bl = f.near ? 18 : 5;
          if (Math.sin(time * bl) > 0.3) { ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffffff'; ctx.fillRect(f.x - 0.6, f.y - 0.6, 1.2, 1.2); }
        } else if (f.field === 'dormant') {     // a dull orange crystal
          dia(3, '#b86a1c', '#ffd08a');
        } else if (f.field === 'slow') {        // an ice-white star
          ctx.strokeStyle = '#e8f8ff'; ctx.lineWidth = 0.8;
          ctx.beginPath();
          for (let k = 0; k < 3; k++) { const a = k * 1.047 + time * 0.4; ctx.moveTo(f.x - Math.cos(a) * 4, f.y - Math.sin(a) * 4); ctx.lineTo(f.x + Math.cos(a) * 4, f.y + Math.sin(a) * 4); }
          ctx.stroke();
        } else if (f.field === 'shield') {      // two shimmering arcs turning against each other
          ctx.strokeStyle = f.col; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.7 * beat;
          for (const [a0, sgn] of [[time * 1.3, 1], [-time * 1.7, -1]]) {
            ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (sgn > 0 ? 0.92 : 0.84), a0, a0 + 2.2); ctx.stroke();
            ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (sgn > 0 ? 0.92 : 0.84), a0 + 3.14, a0 + 5.3); ctx.stroke(); }
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#d8f0ff'; ctx.beginPath(); ctx.arc(f.x, f.y, 2.5, 0, 6.283); ctx.fill();
        } else if (f.field === 'heal') {        // a green cross
          ctx.fillStyle = f.col; ctx.fillRect(f.x - 1.2, f.y - 4, 2.4, 8); ctx.fillRect(f.x - 4, f.y - 1.2, 8, 2.4);
        } else if (f.field === 'storm') {       // the cloud itself, over the top of the circle, with rain under it
          const cy = f.y - f.r * 0.85, t = Math.min(1, (f.max - f.life) * 3, f.life * 2);
          ctx.globalAlpha = 0.85 * t;
          for (let k = 0; k < 7; k++) { const ox = (k - 3) * f.r * 0.28, oy = Math.sin(k * 1.7 + time * 0.8) * 2.5;
            ctx.fillStyle = k % 2 ? '#3a3e4a' : '#4c5160';
            ctx.beginPath(); ctx.arc(f.x + ox, cy + oy, f.r * (0.22 + 0.08 * Math.sin(k * 2.3)), 0, 6.283); ctx.fill(); }
          ctx.globalAlpha = 0.35 * t; ctx.strokeStyle = '#9ec8ff'; ctx.lineWidth = 0.6;
          ctx.beginPath();
          for (let k = 0; k < 18; k++) { const x = f.x + (((k * 37.3 + time * 15) % (f.r * 1.8)) - f.r * 0.9),
            y = cy + ((k * 23.7 + time * 160) % (f.r * 1.7));
            ctx.moveTo(x, y); ctx.lineTo(x - 0.6, y + 4); }
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (f.field === 'glitter') {     // twinkling violet motes all over
          for (let k = 0; k < 10; k++) { const a = k * 2.4 + time * 0.3, r = f.r * ((k * 0.37) % 1);
            const tw = Math.sin(time * 9 + k * 1.3); if (tw < 0.2) continue;
            ctx.globalAlpha = tw; ctx.fillStyle = k % 3 ? '#e0a0ff' : '#ffffff';
            ctx.fillRect(f.x + Math.cos(a) * r - 0.7, f.y + Math.sin(a) * r - 0.7, 1.4, 1.4); }
          ctx.globalAlpha = 1;
        } else return false;
        return true;
      }
      ctx.globalAlpha = 1;

      // spider silk: the web lines they travel (anchor to anchor), lines being shot, the
      // strings in flight at you and the ones stuck to you
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#eef0f6';
      ctx.globalAlpha = 0.55; ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (const L of webs) { ctx.moveTo(L.a0x, L.a0y); ctx.lineTo(L.b0x, L.b0y); }
      for (const e of enemies) {
        const sh = e.sp && e.sp.mode === 'shoot' && e.sp.shot;
        if (sh) { ctx.moveTo(sh.ax0, sh.ay0); ctx.lineTo(sh.x + sh.dx * Math.min(sh.t, sh.len), sh.y + sh.dy * Math.min(sh.t, sh.len)); }
      }
      ctx.stroke();
      ctx.globalAlpha = 0.85; ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (const b of silk) { ctx.moveTo(b.ax, b.ay); ctx.lineTo(b.x, b.y); }
      for (const s of strings) { ctx.moveTo(s.ax, s.ay); ctx.lineTo(p.x + s.ox, p.y + s.oy); }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // enemies
      for (const e of enemies) {
        const ey = e.ty;
        if (ey > camY + vh + 20 || ey < camY - 20 || e.x < camX - 20 || e.x > camX + vw + 20) continue;
        drawEnemy(ctx, e, time);
        if ((e.home || e.nest) && e.hp >= e.hpMax) continue;   // rats and nests: a bar only once hurt
        const hw = 20, hx = e.x - hw / 2, hy = ey - e.r - 9;
        ctx.fillStyle = COL.barBg; ctx.fillRect(hx, hy, hw, 3);
        ctx.fillStyle = e.je ? jcol('jeColBody', e.je.u.col) : e.k.col.a;
        ctx.fillRect(hx, hy, hw * Math.max(0, e.hp / e.hpMax), 3);
      }

      // v95: the Noita-style shots' own sprites. Returns false to fall back to the streak.
      function drawLook(b) {
        const L = b.look, sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp, s = b.size;
        const dot = (x, y, r, c, a) => { ctx.globalAlpha = a; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); };
        if (L === 'spark') {                  // pink halo, white four-point twinkle
          const tw = 0.8 + 0.2 * Math.sin(b.spin * 3);
          dot(b.x, b.y, s * 1.9, b.col, 0.35);
          ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.7;
          const r = s * 2.2 * tw, a = b.spin * 0.6;
          ctx.beginPath();
          for (let k = 0; k < 2; k++) { const c = Math.cos(a + k * 1.571) * r, d = Math.sin(a + k * 1.571) * r;
            ctx.moveTo(b.x - c, b.y - d); ctx.lineTo(b.x + c, b.y + d); }
          ctx.stroke();
          dot(b.x, b.y, s * 0.8, '#ffffff', 1);
        } else if (L === 'crackle') {         // a jittering zig-zag tail, white-hot tip
          ctx.globalAlpha = 1; ctx.strokeStyle = b.col; ctx.lineWidth = 1;
          const px = -uy, py = ux; let x = b.x, y = b.y;
          ctx.beginPath(); ctx.moveTo(x, y);
          for (let k = 1; k <= 4; k++) { x = b.x - ux * k * 3.2 + px * (Math.random() - 0.5) * 4;
            y = b.y - uy * k * 3.2 + py * (Math.random() - 0.5) * 4; ctx.lineTo(x, y); }
          ctx.stroke();
          dot(b.x, b.y, s * 0.9, '#fffbe0', 1);
        } else if (L === 'ember') {           // a small magic fireball: a tail of shrinking blobs
          for (let k = 3; k >= 0; k--) dot(b.x - ux * k * 1.6, b.y - uy * k * 1.6, s * (1 - k * 0.18),
            k ? b.col : '#eaffd8', k ? 0.5 - k * 0.1 : 1);
        } else if (L === 'glob') {            // stretched by its own speed, like Noita's
          const st = 1 + Math.min(1.6, sp / 300);
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
          ctx.globalAlpha = 0.45; ctx.fillStyle = b.col;
          ctx.beginPath(); ctx.ellipse(-s * st * 0.4, 0, s * st * 1.5, s * 1.3, 0, 0, 6.283); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.ellipse(-s * st * 0.25, 0, s * st, s * 0.85, 0, 0, 6.283); ctx.fill();
          ctx.fillStyle = '#ffe0f6';
          ctx.beginPath(); ctx.arc(s * 0.2, -s * 0.25, s * 0.35, 0, 6.283); ctx.fill();
          ctx.restore();
        } else if (L === 'bubble') {          // a see-through bubble, wobbling, with a shine
          const r = s * 1.6, w = 1 + 0.1 * Math.sin(b.spin * 1.7);
          ctx.save(); ctx.translate(b.x, b.y);
          ctx.globalAlpha = 0.18; ctx.fillStyle = b.col;
          ctx.beginPath(); ctx.ellipse(0, 0, r * w, r / w, 0, 0, 6.283); ctx.fill();
          ctx.globalAlpha = 0.9; ctx.strokeStyle = b.col; ctx.lineWidth = 0.7; ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.arc(0, 0, r * 0.68, 3.6, 4.5); ctx.stroke();
          ctx.restore();
        } else if (L === 'arrow') {           // a glowing green arrow along its flight
          const len = 7 + s, hx = b.x - ux * len, hy = b.y - uy * len, px = -uy, py = ux;
          ctx.globalAlpha = 0.35; ctx.strokeStyle = b.col; ctx.lineWidth = s * 2.2;
          ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.globalAlpha = 1; ctx.strokeStyle = '#d8ffc8'; ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.fillStyle = b.col;
          ctx.beginPath(); ctx.moveTo(b.x + ux * 2.5, b.y + uy * 2.5);
          ctx.lineTo(b.x - ux * 2 + px * 2, b.y - uy * 2 + py * 2);
          ctx.lineTo(b.x - ux * 2 - px * 2, b.y - uy * 2 - py * 2); ctx.fill();
          ctx.strokeStyle = b.col; ctx.lineWidth = 0.8;       // fletching
          ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - ux * 2 + px * 1.8, hy - uy * 2 + py * 1.8);
          ctx.moveTo(hx, hy); ctx.lineTo(hx - ux * 2 - px * 1.8, hy - uy * 2 - py * 1.8); ctx.stroke();
        } else if (L === 'drill') {           // a spinning bit
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
          const sq = Math.cos(b.spin * 2.5);
          ctx.globalAlpha = 1; ctx.fillStyle = '#3d5f9a';
          ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-2, 2.2); ctx.lineTo(-2, -2.2); ctx.fill();
          ctx.strokeStyle = b.col; ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.moveTo(-1 + sq, -1.8); ctx.lineTo(1 + sq, 1.2); ctx.moveTo(1.5 - sq * 0.5, -1); ctx.lineTo(2.8 - sq * 0.5, 0.6);
          ctx.stroke();
          ctx.restore();
        } else if (L === 'sparks') {          // no body at all, just its blue streak
          dot(b.x, b.y, s * 0.8, '#ffffff', 1);
        } else if (L === 'heavy') {           // Magic Bolt: a green-gold ball with a spitting tail
          for (let k = 3; k >= 0; k--) dot(b.x - ux * k * 2, b.y - uy * k * 2, s * (1 - k * 0.2) * 0.8,
            k ? b.col : '#fffbd0', k ? 0.45 - k * 0.1 : 1);
          dot(b.x, b.y, s * 1.3, b.col, 0.25);
        } else if (L === 'lance') {           // a long spear with a bright head
          const len = 12 + s * 2, tx = b.x - ux * len, ty = b.y - uy * len;
          ctx.globalAlpha = 0.3; ctx.strokeStyle = b.col; ctx.lineWidth = s * 2.4;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.globalAlpha = 1; ctx.lineWidth = s * 0.8;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s * 0.5;
          ctx.beginPath(); ctx.moveTo(b.x - ux * 4, b.y - uy * 4); ctx.lineTo(b.x + ux * 2, b.y + uy * 2); ctx.stroke();
        } else if (L === 'rubber') {          // a shiny ball, squashed along its flight
          const sq = 1 + Math.min(0.35, sp / 2000);
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
          ctx.globalAlpha = 1; ctx.fillStyle = b.col;
          ctx.beginPath(); ctx.ellipse(0, 0, s * sq, s / sq, 0, 0, 6.283); ctx.fill();
          ctx.restore();
          dot(b.x - s * 0.35, b.y - s * 0.35, s * 0.35, '#fff6d8', 1);
        } else if (L === 'bomb') {            // a black bomb, a cap, and the fizzing fuse
          const a = b.spin * 0.5 - 1.2, cx = Math.cos(a), cy = Math.sin(a);
          dot(b.x, b.y, s * 1.15, '#1e1d24', 1);
          dot(b.x - s * 0.35, b.y - s * 0.4, s * 0.3, '#6a6878', 1);
          ctx.globalAlpha = 1; ctx.strokeStyle = '#8a7a60'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(b.x + cx * s, b.y + cy * s); ctx.lineTo(b.x + cx * s * 1.6, b.y + cy * s * 1.6); ctx.stroke();
          const tw = Math.sin(time * 40) > 0;
          dot(b.x + cx * s * 1.7, b.y + cy * s * 1.7, tw ? 1 : 0.7, tw ? '#ffffff' : '#ffb347', 1);
        } else if (L === 'rocket') {          // a little rocket: body, fins, and a flickering flame
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
          const fl = 2.5 + Math.random() * 2.5 + Math.min(4, sp / 200);
          ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffb347';
          ctx.beginPath(); ctx.moveTo(-3, -1.3); ctx.lineTo(-3 - fl, 0); ctx.lineTo(-3, 1.3); ctx.fill();
          ctx.fillStyle = '#fff2c0';
          ctx.beginPath(); ctx.moveTo(-3, -0.7); ctx.lineTo(-3 - fl * 0.5, 0); ctx.lineTo(-3, 0.7); ctx.fill();
          ctx.globalAlpha = 1; ctx.fillStyle = '#d8d4dc'; ctx.fillRect(-3, -1.2, 5, 2.4);
          ctx.fillStyle = b.col; ctx.beginPath(); ctx.moveTo(2, -1.2); ctx.lineTo(4, 0); ctx.lineTo(2, 1.2); ctx.fill();
          ctx.fillStyle = '#a04030'; ctx.beginPath(); ctx.moveTo(-3, -1.2); ctx.lineTo(-4.2, -2.4); ctx.lineTo(-1.5, -1.2);
          ctx.moveTo(-3, 1.2); ctx.lineTo(-4.2, 2.4); ctx.lineTo(-1.5, 1.2); ctx.fill();
          ctx.restore();
        } else if (L === 'flame') {           // a ball of flame: flickering layers, white-hot heart
          const f = 1 + 0.15 * Math.sin(b.spin * 3.1) + 0.1 * Math.random();
          dot(b.x - ux * s * 0.5, b.y - uy * s * 0.5, s * 1.5 * f, '#e8461c', 0.45);
          dot(b.x, b.y, s * 1.1 * f, b.col, 0.85);
          dot(b.x + ux * s * 0.2, b.y + uy * s * 0.2, s * 0.65, '#ffd35a', 1);
          dot(b.x + ux * s * 0.3, b.y + uy * s * 0.3, s * 0.3, '#fffbe0', 1);
        } else if (L === 'orb') {             // a glowing energy sphere, pulsing
          const pu = 1 + 0.1 * Math.sin(b.spin * 2);
          dot(b.x, b.y, s * 1.8 * pu, b.col, 0.25);
          dot(b.x, b.y, s * pu, b.col, 0.9);
          dot(b.x, b.y, s * 0.5, '#f0f8ff', 1);
        } else if (L === 'chain') {           // a violet orb with arcs flickering round it
          dot(b.x, b.y, s * 1.8, b.col, 0.3);
          dot(b.x, b.y, s * 0.9, '#f4e0ff', 1);
          ctx.globalAlpha = 0.9; ctx.strokeStyle = b.col; ctx.lineWidth = 0.6;
          ctx.beginPath();
          for (let k = 0; k < 3; k++) { let a = Math.random() * 6.283, r = s;
            ctx.moveTo(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r);
            for (let q = 0; q < 3; q++) { a += rnd(-0.6, 0.6); r += 1.4; ctx.lineTo(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r); } }
          ctx.stroke();
        } else if (L === 'cross') {           // a glowing cross, tumbling
          const r = s * 2, a = b.spin * 0.8;
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
          ctx.globalAlpha = 0.35; ctx.strokeStyle = b.col; ctx.lineWidth = s * 1.6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
          ctx.globalAlpha = 1; ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = s * 0.55;
          ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
          ctx.restore();
        } else if (L === 'disc') {            // a spinning sawblade
          const r = s, a = b.spin * 2.2;
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
          ctx.globalAlpha = 1; ctx.fillStyle = b.col;
          ctx.beginPath();
          for (let k = 0; k < 16; k++) { const rr = k % 2 ? r * 0.78 : r * 1.12, t = k / 16 * 6.283; ctx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr); }
          ctx.fill();
          ctx.fillStyle = '#6a6e78'; ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, 6.283); ctx.fill();
          ctx.restore();
        } else if (L === 'nuke') {            // a fat yellow shell with a blinking red light
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
          ctx.globalAlpha = 1; ctx.fillStyle = '#e8d24a';
          ctx.beginPath(); ctx.ellipse(0, 0, s * 1.3, s * 0.85, 0, 0, 6.283); ctx.fill();
          ctx.fillStyle = '#2a2a2a';
          for (let k = 0; k < 3; k++) { const t = k * 2.094 + b.spin * 0.3;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, s * 0.6, t, t + 0.8); ctx.fill(); }
          ctx.fillStyle = '#6a6a58'; ctx.fillRect(-s * 1.7, -s * 0.8, s * 0.5, s * 1.6);
          ctx.restore();
          if (Math.sin(time * 12) > 0) dot(b.x + ux * s * 1.2, b.y + uy * s * 1.2, 0.9, '#ff3a2a', 1);
        } else if (L === 'pollen') {          // a fuzzy puff
          for (let k = 0; k < 7; k++) { const a = k * 0.9 + b.spin * 0.3, r = s * (0.9 + 0.3 * Math.sin(k * 2.1 + b.spin));
            dot(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, 0.7, k % 2 ? b.col : '#f4ffb0', 0.9); }
          dot(b.x, b.y, s * 0.7, '#ffe98a', 1);
        } else return false;
        ctx.globalAlpha = 1;
        return true;
      }
      // a lightning line: a wide soft glow, then a thin white-hot core
      function drawBolt(pts, col, w, alpha) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineJoin = 'miter'; ctx.lineCap = 'round';
        const path = () => { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
          for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y); ctx.stroke(); };
        ctx.strokeStyle = col;
        ctx.globalAlpha = alpha * 0.25; ctx.lineWidth = w * 5; path();
        ctx.globalAlpha = alpha * 0.7; ctx.lineWidth = w * 1.8; path();
        ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = alpha; ctx.lineWidth = w * 0.7; path();
        ctx.restore();
      }
      // projectiles
      for (const b of enemyShots) {
        if (b.goo) {                           // poison spit: a wobbling glob with a wet highlight
          const s = b.size, wob = 1 + 0.12 * Math.sin(time * 30 + b.x * 0.1);
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
          ctx.fillStyle = b.edge || '#123d18';
          ctx.beginPath(); ctx.ellipse(0, 0, s * 1.45 * wob, s * 1.05 / wob, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = b.col;
          ctx.beginPath(); ctx.ellipse(-s * 0.08, 0, s * 1.2 * wob, s * 0.82 / wob, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = b.shine || '#e6ffb8';
          ctx.beginPath(); ctx.arc(s * 0.3, -s * 0.28, s * 0.32, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          continue;
        }
        ctx.fillStyle = b.col;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2); ctx.fill();
      }
      // shots are drawn as streaks along their own velocity, so a fast one reads
      // as a long dash and a slow heavy one as a stub
      ctx.lineCap = 'round';
      for (const b of bullets) {
        if (b.hidden) continue;                 // Buzzsaw cuts without drawing a circle
        if (b.pull) {                           // Black Hole: purple haze, starry black core
          const r = b.size, core = b.eat || r * 0.78, beat = 1 + 0.06 * Math.sin(time * 6 + b.spin);
          const g = ctx.createRadialGradient(b.x, b.y, core * 0.8, b.x, b.y, r * 1.55 * beat);
          g.addColorStop(0, 'rgba(197,140,255,0.75)');
          g.addColorStop(0.3, 'rgba(150,90,255,0.35)');
          g.addColorStop(1, 'rgba(110,50,220,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(b.x, b.y, r * 1.55 * beat, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#050208';
          ctx.beginPath(); ctx.arc(b.x, b.y, core, 0, Math.PI * 2); ctx.fill();
          for (let k = 0; k < 14; k++) {       // twinkling stars wheeling inside
            const tw = Math.sin(time * 8 + k * 1.7);
            if (tw < 0.1) continue;
            const ang = k * 2.4 + time * (0.5 + (k % 3) * 0.35), rad = core * (0.15 + ((k * 0.37) % 0.75));
            const sx = b.x + Math.cos(ang) * rad, sy = b.y + Math.sin(ang) * rad, sz = 0.6 + tw * 0.9;
            ctx.globalAlpha = tw;
            ctx.fillStyle = k % 3 ? '#e6d4ff' : '#ffffff';
            ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
          }
          ctx.globalAlpha = 0.8;
          ctx.strokeStyle = '#b98aff'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(b.x, b.y, core, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1;
          continue;
        }
        if (b.look && drawLook(b)) continue;
        if (b.arc && b.trail && b.trail.length > 1) {   // lightning: a fresh zig-zag every frame
          drawBolt(jag(b.trail.concat([{ x: b.x, y: b.y }]), 5), b.col, 1.6, 1);
          continue;
        }
        const sp = Math.hypot(b.vx, b.vy) || 1;
        const len = Math.max(0.5, Math.min(46, sp * 0.022));   // length is speed alone
        const hx = b.vx / sp * len, hy = b.vy / sp * len;
        if (b.homing) {
          ctx.globalAlpha = 0.3;
          ctx.strokeStyle = COL.enemy;
          ctx.lineWidth = b.size * 1.7 + 4;
          ctx.beginPath(); ctx.moveTo(b.x - hx, b.y - hy); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = b.col;
        ctx.lineWidth = b.size * 1.7;
        ctx.beginPath(); ctx.moveTo(b.x - hx, b.y - hy); ctx.lineTo(b.x, b.y); ctx.stroke();
        if (b.explode) {
          ctx.fillStyle = Math.sin(b.spin) > 0 ? COL.flame2 : COL.visor;
          ctx.fillRect(b.x - 1, b.y - 1, 2, 2);
        }
      }
      for (const a of arcs) drawBolt(a.pts, a.col, a.w, 1 - a.t / a.max);
      // instant beams, which fade over a few frames
      for (const bm of beams) {
        const fade = 1 - bm.t / 0.12;
        if (bm.look) {                          // v96: a wide wavering halo under the beam
          ctx.globalAlpha = fade * 0.18;
          ctx.strokeStyle = bm.col; ctx.lineWidth = bm.w * (7 + Math.random() * 2);
          ctx.beginPath(); ctx.moveTo(bm.x, bm.y); ctx.lineTo(bm.x + bm.nx * bm.len, bm.y + bm.ny * bm.len); ctx.stroke();
        }
        ctx.globalAlpha = fade * 0.35;
        ctx.strokeStyle = bm.col; ctx.lineWidth = bm.w * 3.5;
        ctx.beginPath(); ctx.moveTo(bm.x, bm.y);
        ctx.lineTo(bm.x + bm.nx * bm.len, bm.y + bm.ny * bm.len); ctx.stroke();
        ctx.globalAlpha = fade;
        ctx.lineWidth = bm.w * 1.2;
        ctx.beginPath(); ctx.moveTo(bm.x, bm.y);
        ctx.lineTo(bm.x + bm.nx * bm.len, bm.y + bm.ny * bm.len); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // the portal you arrived through: scenery only
      if (arrival.y < camY + vh + 40 && arrival.y > camY - 40) {
        const sway = 0.5 + 0.18 * Math.sin(time * 1.6);
        ctx.fillStyle = '#4a4550';
        ctx.fillRect(arrival.x - 16, arrival.y + 12, 32, 5);
        ctx.globalAlpha = 0.22 * sway;
        ctx.fillStyle = COL.enemy;
        ctx.beginPath(); ctx.ellipse(arrival.x, arrival.y, 17, 21, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.5 * sway;
        ctx.beginPath(); ctx.ellipse(arrival.x, arrival.y, 10, 14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#6c6480'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(arrival.x, arrival.y, 13, 17, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(233,236,242,0.34)';
        ctx.font = '600 7px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WAY IN', arrival.x, arrival.y - 22);
        ctx.textAlign = 'left';
      }

      // shop stock on its plinths
      for (const it of stock) {
        if (it.y > camY + vh + 40 || it.y < camY - 40) continue;
        const bob = Math.sin(time * 2 + it.x) * 2;
        // the plinth: a narrow column dropping from just under the item down to the shop
        // floor (so it isn't left hovering), with a wider foot resting on the floor
        const floorY = SHOP_FLOOR * CELL;
        ctx.fillStyle = '#4a4550';
        ctx.fillRect(it.x - 6, it.y + 4, 12, Math.max(9, floorY - (it.y + 4)));
        ctx.fillRect(it.x - 11, floorY - 5, 22, 5);
        if (it.sold) {
          ctx.fillStyle = COL.muted;
          ctx.font = '600 8px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('SOLD', it.x, it.y - 2);
          ctx.textAlign = 'left';
          continue;
        }
        if (it.kind === 'heal') {
          ctx.globalAlpha = 0.25; ctx.fillStyle = COL.hp;
          ctx.beginPath(); ctx.arc(it.x, it.y + bob, 13, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1; ctx.fillStyle = COL.hp;
          ctx.fillRect(it.x - 7, it.y - 2.5 + bob, 14, 5);
          ctx.fillRect(it.x - 2.5, it.y - 7 + bob, 5, 14);
        } else if (it.kind === 'gun') {
          ctx.globalAlpha = 0.22; ctx.fillStyle = gunAccent(it.gun);
          ctx.beginPath(); ctx.arc(it.x, it.y + bob, 14, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          drawGun(ctx, it.x - 5, it.y + 1 + bob, -0.22, 0.9, gunAccent(it.gun));
          ctx.fillStyle = COL.bullet;
          ctx.font = '600 9px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(it.price + 'g', it.x, it.y - 13 + bob);
          ctx.fillStyle = COL.muted;
          ctx.font = '600 8px system-ui, sans-serif';
          ctx.fillText(it.gun.cap + ' slots', it.x, it.y + 24 + bob);
          ctx.textAlign = 'left';
        } else {
          const m = MODS[it.id];
          ctx.globalAlpha = 0.22; ctx.fillStyle = famCol(it.id);
          ctx.beginPath(); ctx.arc(it.x, it.y + bob, 13, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1; ctx.fillStyle = famCol(it.id);
          ctx.beginPath();
          ctx.moveTo(it.x, it.y - 8 + bob); ctx.lineTo(it.x + 8, it.y + bob);
          ctx.lineTo(it.x, it.y + 8 + bob); ctx.lineTo(it.x - 8, it.y + bob);
          ctx.fill();
          ctx.fillStyle = '#12141a';
          ctx.font = '600 9px system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(m.glyph, it.x, it.y + 0.5 + bob);
          ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = COL.bullet;
          ctx.font = '600 9px system-ui, sans-serif';
          ctx.fillText(it.price + 'g', it.x, it.y - 12 + bob);
          ctx.textAlign = 'left';
        }
      }

      // gold
      for (const g of coins) {
        if (g.y > camY + vh + 30 || g.y < camY - 30) continue;
        const bob = Math.sin(time * 4 + g.t) * 1.5;
        ctx.fillStyle = '#d8a52a';
        ctx.beginPath(); ctx.ellipse(g.x, g.y + bob, 3.2, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = COL.flame2;
        ctx.beginPath(); ctx.ellipse(g.x - 0.8, g.y - 0.8 + bob, 1.2, 1.8, 0, 0, Math.PI * 2); ctx.fill();
      }

      // pickups
      for (const q of pickups) {
        const qy = q.y + Math.sin(time * 2 + q.t) * 3;
        if (qy > camY + vh + 30 || qy < camY - 30 || q.x < camX - 30 || q.x > camX + vw + 30) continue;
        if (q.kind === 'gun') {
          // a gun you've never held glows, with sparks streaking out of it; one you swapped
          // out and left on the ground doesn't, so you can tell new from discarded at a glance
          if (!q.old) drawGunGlow(ctx, q.x, qy, time, q.t);
          drawGun(ctx, q.x - 5, qy + 1, -0.22, 0.85, gunAccent(q.gun));
        } else {
          const m = MODS[q.id];
          ctx.globalAlpha = 0.22; ctx.fillStyle = famCol(q.id);
          ctx.beginPath(); ctx.arc(q.x, qy, 12, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = famCol(q.id);
          ctx.beginPath();
          ctx.moveTo(q.x, qy - 8); ctx.lineTo(q.x + 8, qy); ctx.lineTo(q.x, qy + 8); ctx.lineTo(q.x - 8, qy);
          ctx.fill();
          ctx.fillStyle = '#12141a';
          ctx.font = '600 9px system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(m.glyph, q.x, qy + 0.5);
          ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        }
      }

      // the hidden rooms' prizes on their altars: a glowing perk sigil, or the +25 heart
      for (const r of rooms) {
        if (r.taken) continue;
        if (r.y > camY + vh + 40 || r.y < camY - 40 || r.x < camX - 40 || r.x > camX + vw + 40) continue;
        const bob = Math.sin(time * 2 + r.x) * 2.5;
        ctx.fillStyle = '#4a4550';
        ctx.fillRect(r.x - 12, r.y + 14, 24, 5);
        ctx.fillRect(r.x - 7, r.y + 5, 14, 10);
        if (r.kind === 'perk') {
          const pk = PERKS[r.id], col = pk.tint || COL.portal;
          ctx.globalAlpha = 0.22 + 0.12 * Math.sin(time * 3);
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(r.x, r.y + bob, 16, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = col;
          ctx.font = '700 20px system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(pk.glyph, r.x, r.y + 0.5 + bob);
          ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
        } else {
          ctx.globalAlpha = 0.25 + 0.12 * Math.sin(time * 3);
          ctx.fillStyle = COL.hp;
          ctx.beginPath(); ctx.arc(r.x, r.y + bob, 16, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1; ctx.fillStyle = COL.hp;
          // a plump heart
          ctx.beginPath();
          ctx.moveTo(r.x, r.y + 7 + bob);
          ctx.bezierCurveTo(r.x - 11, r.y - 2 + bob, r.x - 6, r.y - 11 + bob, r.x, r.y - 4 + bob);
          ctx.bezierCurveTo(r.x + 6, r.y - 11 + bob, r.x + 11, r.y - 2 + bob, r.x, r.y + 7 + bob);
          ctx.fill();
          ctx.fillStyle = '#0c130f';
          ctx.font = '700 8px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('+25', r.x, r.y - 14 + bob);
          ctx.textAlign = 'left';
        }
      }

      // Levitation Trail: the fire you left behind, still burning
      for (const bn of burns) {
        const t = bn.life / bn.max;
        ctx.globalAlpha = t * 0.8;
        ctx.fillStyle = t > 0.5 ? COL.flame2 : COL.flame;
        ctx.beginPath(); ctx.arc(bn.x, bn.y, 3 + (1 - t) * 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // sparks and debris
      for (const q of sparks) {
        ctx.fillStyle = q.c;
        ctx.globalAlpha = Math.max(0, q.life / q.max);
        ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
      }
      ctx.globalAlpha = 1;

      // magic motes: the Black Hole's trail and the portals' drift, added on as light
      ctx.globalCompositeOperation = 'lighter';
      for (const q of motes) {
        if (q.y > camY + vh + 20 || q.y < camY - 20) continue;
        let a;
        if (q.kind === 'in') a = Math.min(1, q.age / 0.6) * 0.9;              // fade in, never pop
        else if (q.kind === 'out') a = Math.min(1, q.age / 0.3) *
          Math.max(0, 1 - Math.hypot(q.x - q.ox, q.y - q.oy) / q.fade) * 0.9;  // fade with distance
        else a = Math.max(0, q.life / q.max) * 0.9;
        ctx.globalAlpha = a;
        ctx.fillStyle = q.c;
        ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      // explosion flashes
      for (const f of flashes) {
        const t = f.t / 0.25;
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = COL.flame;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.6 + 0.5 * t), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = COL.flame2;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.35 + 0.3 * t), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // jet flame
      if (p.flame > 0) {
        let fx = -p.jx, fy = -p.jy + 0.8;
        const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
        const len = 6 + p.flame * 16 + Math.random() * 3;
        const bx = pcx, by = p.y + PH - 2;
        ctx.fillStyle = COL.flame;
        ctx.beginPath(); ctx.moveTo(bx - 4, by); ctx.lineTo(bx + 4, by); ctx.lineTo(bx + fx * len, by + fy * len); ctx.fill();
        ctx.fillStyle = COL.flame2;
        ctx.beginPath(); ctx.moveTo(bx - 2, by); ctx.lineTo(bx + 2, by); ctx.lineTo(bx + fx * len * 0.55, by + fy * len * 0.55); ctx.fill();
      }

      // aim, grenade arc preview, gun
      const R = p.aim;
      const held = input.current.loadout.guns[input.current.loadout.sel];
      const ax = R.show ? R.nx : p.face, ay = R.show ? R.ny : 0;
      const gy = p.y + PH * 0.52;

      // where the next pull actually goes, mods and all — only with the Trajectory Sight perk
      const tvis = R.vis == null ? 1 : R.vis;
      if (!RPV && !p.dead && R.show && held && pb.trajectory && tvis > 0) {
        const sim = Object.assign({}, held, { slots: held.slots.slice(),
          order: held.order.slice(), idx: held.idx });
        const plan = planCast(sim);                 // a copy, so the real gun is untouched
        const seen = {};
        let drawn = 0;
        for (const sh of plan.shots) {
          if (sh.still) {                    // a field lands in front of you, it does not fly
            const fx = pcx + R.nx * 30, fy = gy + R.ny * 30;
            ctx.globalAlpha = 0.5 * tvis; ctx.strokeStyle = sh.col; ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.arc(fx, fy, Math.max(8, sh.r), 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]); ctx.globalAlpha = 1;
            continue;
          }
          const key = [Math.round(sh.speed), Math.round(sh.grav), sh.accel, sh.bounce,
            sh.bore, sh.homing, Math.round(sh.life * 20), sh.beam, sh.spiral, sh.orbit,
            sh.pong, sh.boomer, sh.flat].join(',');
          if (seen[key] || drawn >= 3) continue;
          seen[key] = 1;
          const cone = drawn === 0 && sh.spread > 2
            ? [-sh.spread / 2, 0, sh.spread / 2] : [0];
          drawn++;
          // the perks that bend a bullet in flight bend the aim line too, or it lies
          const tsh = Object.assign({}, sh, { bounce: sh.bounce + pb.bounce,
            homing: Math.max(sh.homing, pb.homing), speed: sh.speed * pb.speed * bhSp(sh) });
          for (const off of cone) {
            const a = Math.atan2(R.ny, R.nx) + off * Math.PI / 180;
            tracePath(tsh, pcx, gy, Math.cos(a), Math.sin(a), solidAt, enemies, aimPath,
              { x: pcx, y: gy });
            ctx.fillStyle = sh.col;
            const edge = off !== 0;
            const size = edge ? 1.6 : 2.4;
            for (let i = 2; i < aimPath.length; i += edge ? 8 : 4) {
              const t = i / aimPath.length;
              ctx.globalAlpha = (edge ? 0.3 : 0.9) * (1 - 0.6 * t) * tvis;
              ctx.fillRect(aimPath[i] - size / 2, aimPath[i + 1] - size / 2, size, size);
            }
          }
        }
        ctx.globalAlpha = 1;
      }

      // player
      if (p.dead) ctx.globalAlpha = 0.35;
      const flashing = p.hitT > 0 && Math.floor(p.hitT * 30) % 2 === 0;
      const running = p.onGround && Math.abs(p.vx) > 15;
      const gait = running ? Math.sin(time * 15) : 0;
      drawRunner(ctx, p.x, p.y, PW, PH, p.face, gait, !p.onGround, p.flame, flashing);
      if (!p.dead) drawGun(ctx, pcx + ax * 2.5, gy, Math.atan2(ay, ax), 0.55, gunAccent(held));
      // the torch, in the hand the gun is not in
      if (!p.dead) { const th = torchHand(); drawTorch(ctx, th.x, th.y, ax >= 0 ? -1 : 1, flick, torchP, leanX, leanY, time); }
      // a small aim crosshair at DEV.aimDist out, rotating round you with the aim: a "+"
      // with the centre cut out (two short verticals, two short horizontals), drawn as thin
      // as the thumbstick lines (~1.5 css px, so 1.5/unitPx world units, whatever the zoom)
      if (!p.dead) {
        const cxp = pcx + ax * DEV.aimDist, cyp = gy + ay * DEV.aimDist;
        const inr = 1.25, outr = 3;            // gap radius, arm end (half the v55 size)
        ctx.strokeStyle = 'rgba(255,255,255,0.92)';
        ctx.lineWidth = 1.5 / unitPx;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(cxp, cyp - outr); ctx.lineTo(cxp, cyp - inr);   // top
        ctx.moveTo(cxp, cyp + inr);  ctx.lineTo(cxp, cyp + outr);  // bottom
        ctx.moveTo(cxp - outr, cyp); ctx.lineTo(cxp - inr, cyp);   // left
        ctx.moveTo(cxp + inr, cyp);  ctx.lineTo(cxp + outr, cyp);  // right
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Permanent Shield: a soft ring while it is up, gone the moment it is spent
      if (pb.shield && p.shieldReady && !p.dead) {
        ctx.globalAlpha = 0.35 + 0.15 * Math.sin(time * 4);
        ctx.strokeStyle = '#7ad7ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pcx, pcy, PW * 1.15, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Angry Ghost: a pale wisp that drifts at your shoulder
      if (pb.ghost && ghost && !p.dead) {
        const gb = Math.sin(time * 3) * 2;
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#c9a6ff';
        ctx.beginPath(); ctx.arc(ghost.x, ghost.y + gb, 6, Math.PI, 0);
        ctx.lineTo(ghost.x + 6, ghost.y + gb + 6);
        ctx.lineTo(ghost.x + 2, ghost.y + gb + 4);
        ctx.lineTo(ghost.x - 2, ghost.y + gb + 6);
        ctx.lineTo(ghost.x - 6, ghost.y + gb + 4);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#3a2f52';
        ctx.fillRect(ghost.x - 3, ghost.y + gb - 1, 1.6, 2.4);
        ctx.fillRect(ghost.x + 1.4, ghost.y + gb - 1, 1.6, 2.4);
      }

      // ---- torchlight, masked by the fog of war ----
      // Line of sight is what lifts the fog: fogReveal marks every cell the fan reaches as
      // somewhere you have been, and it stays marked for the rest of the floor. The lamp
      // then lights that lifted ground — brightest at your feet, fading out to torchR — but
      // it is MASKED by the fog: a cell you have never had line of sight to stays dark even
      // with the torch right on top of it, so the cave ahead of you is a real unknown. The
      // lamp does not itself stop at walls; it is the *reveal* that respects them, so what
      // you have already uncovered round a corner still lights up. `flick` is the flame's
      // own number, so both the reach and the brightness breathe exactly as the fire does.
      const sight = SIGHT * DEV.torch;                       // dev knob scales the whole bubble
      torchR = clamp(sight * LAMP_REACH * (0.5 + 0.55 * flick), 120, 1400);
      visPts = visPoly(pcx, pcy, sight, solidCell, VIS_RAYS);
      fogReveal(seen, pcx, pcy, sight, visPts, VIS_RAYS);   // line of sight lifts the fog
      if (!RPV || RPV.fog) {                                 // a replay can turn the fog off
        // bake the visible slab of the overlay every frame: the base darkness is the fog
        // state, then the lamp brightens the cells the fog has already been lifted from
        const fdat = fogImg.data;
        const dim = Math.round(255 * DEV.fogDim), dark = Math.round(255 * DEV.fogDark);
        const lr2 = torchR * torchR;
        const fx0 = clamp(Math.floor(camX / FOG_U) - 1, 0, FW - 1), fy0 = clamp(Math.floor(camY / FOG_U) - 1, 0, FH - 1);
        const fx1 = clamp(Math.ceil((camX + vw) / FOG_U) + 2, 1, FW), fy1 = clamp(Math.ceil((camY + vh) / FOG_U) + 2, 1, FH);
        for (let cy = fy0; cy < fy1; cy++) {
          const ddy = (cy + 0.5) * FOG_U - pcy;
          for (let cx = fx0; cx < fx1; cx++) {
            const i = cy * FW + cx, k = i * 4;
            fdat[k] = 9; fdat[k + 1] = 10; fdat[k + 2] = 14;
            let s = seen[i];
            // push the dark off ground you have seen: an unseen cell that borders a seen one
            // is treated as remembered (dim + lamp), so a bit more of the uncovered surface
            // shows instead of the darkness sitting right on its edge
            if (!s && !(deepFog && deepFog[i]) && ((cx > 0 && seen[i - 1]) || (cx < FW - 1 && seen[i + 1]) ||
                (cy > 0 && seen[i - FW]) || (cy < FH - 1 && seen[i + FW]) ||
                (cx > 0 && cy > 0 && seen[i - FW - 1]) || (cx < FW - 1 && cy > 0 && seen[i - FW + 1]) ||
                (cx > 0 && cy < FH - 1 && seen[i + FW - 1]) || (cx < FW - 1 && cy < FH - 1 && seen[i + FW + 1]))) s = 1;
            let a = s === 2 ? 0 : s ? dim : dark;
            if (s && a) {                        // the lamp only reaches ground the fog has lifted
              const ddx = (cx + 0.5) * FOG_U - pcx, dd2 = ddx * ddx + ddy * ddy;
              if (dd2 < lr2) {
                const t = Math.sqrt(dd2) / torchR;               // 0 at your feet, 1 at the edge
                const lift = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
                a = a * (1 - lift);
              }
            }
            fdat[k + 3] = a;
          }
        }
        fctx.putImageData(fogImg, 0, 0, fx0, fy0, fx1 - fx0, fy1 - fy0);
        // blur the slab at source resolution (cheap: an 80x200 canvas), then upscale the soft
        // copy — a source-px of blur becomes ~a fog cell of blur on screen, so the fog edge
        // reads as a gradient rather than a hard line
        fbctx.clearRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
        fbctx.filter = 'blur(0.9px)';
        fbctx.drawImage(fogC, fx0, fy0, fx1 - fx0, fy1 - fy0, fx0, fy0, fx1 - fx0, fy1 - fy0);
        fbctx.filter = 'none';
        ctx.imageSmoothingEnabled = true;     // the upscale further softens the edge
        ctx.drawImage(fogBlurC, fx0, fy0, fx1 - fx0, fy1 - fy0,
          fx0 * FOG_U, fy0 * FOG_U, (fx1 - fx0) * FOG_U, (fy1 - fy0) * FOG_U);
        ctx.imageSmoothingEnabled = false;
      }

      // ---- firelight on top of the fog: the wall torches (where you have been) and the hand
      // torch's glow plus its small, warm second light round you. Additive, so it only ever
      // brightens; the map lighting under it is unchanged. The glow gutters on its own,
      // quicker and deeper than the lamp.
      ctx.globalCompositeOperation = 'lighter';
      const gl = clamp(0.82 + glowN + 0.08 * Math.sin(time * 23) + 0.06 * Math.sin(time * 37), 0.5, 1.1);
      const scOn = sc => !(sc.y > camY + vh + 30 || sc.y < camY - 30 || sc.x < camX - 30 || sc.x > camX + vw + 30) &&
        fogLit(sc.x, sc.y);
      for (const sc of sconces) {
        if (!scOn(sc)) continue;
        const sg = 0.85 + 0.15 * Math.sin(time * 11 + sc.ph) * Math.sin(time * 5.3 + sc.ph);
        glowAt(ctx, sc.x, sc.y - 6, 34, 0.16 * sg, '255,140,50');
        glowAt(ctx, sc.x, sc.y - 7, 9, 0.45 * sg, '255,190,90');
      }
      // lit props and glowing motes, only where the fog has lifted — except the eyes, which
      // watch from the dark
      for (const pr of props) {
        if (!(pr.k === 'lamp' || pr.k === 'vent' || pr.k === 'shard' || pr.k === 'eyes' || pr.k === 'matter' ||
          (pr.k === 'drip' && pr.st === 'lava')) || !onView(pr.x, pr.y, 60)) continue;
        if (pr.k !== 'eyes' && !fogLit(pr.x, pr.y)) continue;
        propGlow(ctx, pr, time, TH, Math.hypot(pr.x - pcx, pr.y - pcy), torchR);
      }
      // and the green round each jelly glows and twinkles in its colour (plantGlow)
      for (const e of enemies)
        if (e.je && onView(e.x, e.ty, 160) && fogLit(e.x, e.ty)) plantGlow(e, TH);
      // glowing creatures (the jellyfish) light the cave round them, flaring as they pulse.
      // Radius, brightness and flare are its kp+'GlowR' / 'Glow' / 'Flare' knobs, and like
      // every other light out here it shows only where the fog has lifted
      for (const e of enemies) {
        const k = e.k;
        if (!k.glow || !k.kp || !onView(e.x, e.ty, 120) || !fogLit(e.x, e.ty)) continue;
        const u = (e.je && e.je.u) || { glowR: 0.5, glow: 0.5, flare: 0.5 }, sh = e.je ? e.je.shape : 0;
        const a = kru(k.kp + 'Glow', u.glow) * (1 + kru(k.kp + 'Flare', u.flare) * sh);
        const rgb = e.je ? hexRgb(jcol('jeColGlow', e.je.u.col)) : k.glow;
        glowAt(ctx, e.x, e.ty, kru(k.kp + 'GlowR', u.glowR), a, rgb);
        glowAt(ctx, e.x, e.ty, e.r * 1.6, a * 1.4, rgb);
      }
      for (const b of enemyShots) if (b.glow && onView(b.x, b.y, 30) && fogLit(b.x, b.y)) glowAt(ctx, b.x, b.y, b.size * 6, 0.3, b.glow);
      // v95: your glowing shots light the cave round them (the Bubble Spark most of all)
      for (const b of bullets) if (b.light && !b.hidden && onView(b.x, b.y, 50) && fogLit(b.x, b.y))
        glowAt(ctx, b.x, b.y, b.lightR || 20, 0.28, b.light);
      // fire: the burning pixels brighten and throw a warm glow — only on ground you have seen
      if (fireVis.length) {
        ctx.fillStyle = 'rgba(255,140,50,0.32)';
        ctx.beginPath();
        for (const i of fireVis) {
          const x = (i % CW) * CELL, y = ((i / CW) | 0) * CELL;
          if (seen[clamp(Math.floor(y / FOG_U), 0, FH - 1) * FW + clamp(Math.floor(x / FOG_U), 0, FW - 1)]) ctx.rect(x, y, CELL, CELL);
        }
        ctx.fill();
        const st = Math.max(1, Math.ceil(fireVis.length / 24));
        for (let k = fireN % st; k < fireVis.length; k += st) {
          const i = fireVis[k], x = (i % CW + 0.5) * CELL, y = (((i / CW) | 0) + 0.5) * CELL;
          if (fogLit(x, y)) glowAt(ctx, x, y, 20, Math.min(0.14, 0.03 + fireVis.length / 3000) * flick, '255,120,40');
        }
      }
      for (const e of enemies)
        if (e.burn > 0 && onView(e.x, e.ty, 40) && fogLit(e.x, e.ty)) glowAt(ctx, e.x, e.ty, e.r * 2.4, 0.22 * flick, '255,130,50');
      for (const pr of firePlants)
        if (pr.burn && !pr.gone && onView(pr.x, pr.y + pr.len, 40) && fogLit(pr.x, pr.y + pr.len))
          glowAt(ctx, pr.x, pr.y + pr.len, 16, 0.2 * flick, '255,130,50');
      if (p.burn > 0 && !p.dead) glowAt(ctx, p.x + PW / 2, p.y + PH / 2, 22, 0.25 * flick, '255,130,50');
      for (const list of [dparts, amb]) for (const q of list) {
        if (!q.glow || !onView(q.x, q.y, 10) || !fogLit(q.x, q.y)) continue;
        ctx.globalAlpha = Math.min(1, q.life / (q.max * 0.3));
        ctx.fillStyle = q.c; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
      }
      ctx.globalAlpha = 1;
      if (!p.dead) {
        const th = torchHand(), gfx = th.x + (ax >= 0 ? -1 : 1) * 1.6, gfy = th.y - 11;
        glowAt(ctx, gfx, gfy, 70 * (0.9 + 0.1 * gl), 0.2 * gl, '255,150,60');            // the second light
        glowAt(ctx, gfx + leanX * 0.5, gfy + leanY * 0.5, 12, 0.5 * gl, '255,190,90');   // the halo
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const sc of sconces) if (scOn(sc)) drawSconce(ctx, sc.x, sc.y, time, sc.ph);
      if (RPV) return;                        // a replay frame has no HUD

      // ---- HUD ----
      // The old top-left stack (floor / enemies / health / fuel / mana / gun) is gone:
      // health, mana and fuel are the rings and top-half wipe on the thumbsticks now,
      // the floor number is written big along the shop wall, and gold sits in the deck
      // between the sticks (a DOM readout in App). Only the version is drawn up here.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cw = c.width / dpr;
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3;
      ctx.fillStyle = COL.muted;
      ctx.font = '500 12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(VERSION, 12, 22);
      ctx.shadowBlur = 0;

      // hand the sticks the live health / fuel / mana so they can draw their gauges:
      // the green ring round the left stick, the amber fuel wipe in its top half, and
      // the gold ring round the right stick. Written every frame the loop draws.
      const MHP = maxHp();
      const gpas = held ? gunPassives(held) : null;
      // recharge / cast-delay "readiness": 1 when ready, dropping to 0 the moment it fires
      // and filling back over its own time — so the ring that spends the most time refilling
      // is the one gating your fire. Both normalise by their own max so the wipe is 0..1.
      const effRech = held ? Math.max(0.001, effRecharge(held) * pb.rech) : 1;
      input.current.hud = {
        hp: MHP > 0 ? Math.max(0, Math.min(1, p.hp / MHP)) : 0,
        low: p.hp <= 30,
        fuel: Math.max(0, Math.min(1, p.fuel)),
        empty: !!p.empty,
        mana: held ? Math.max(0, Math.min(1, held.mana / (held.manaMax + gpas.manaMax))) : 0,
        rech: held ? (held.rechT > 0 ? clamp(1 - held.rechT / effRech, 0, 1) : 1) : 0,
        cast: held ? (held.delayT > 0 && held.delayMax ? clamp(1 - held.delayT / held.delayMax, 0, 1) : 1) : 0,
        recharging: !!(held && held.rechT > 0),
        hasGun: !!held,
      };

      // ---- radar perks: point at the nearest enemy / mod / gun still out there ----
      if (pb.radarEnemy || pb.radarItem || pb.radarWand) {
        const cwv = c.width / dpr, chv = playPx / dpr, m = 18;
        const nearest = list => {
          let best = null, bd = 1e18;
          for (const t of list) { const d = (t.x - pcx) * (t.x - pcx) + ((t.ty || t.y) - pcy) * ((t.ty || t.y) - pcy); if (d < bd) { bd = d; best = t; } }
          return best;
        };
        const marker = (t, col) => {
          if (!t) return;
          const sx = (t.x - camX) * unitPx, sy = ((t.ty || t.y) - camY) * unitPx;
          if (sx > m && sx < cwv - m && sy > m && sy < chv - m) {
            ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
            ctx.beginPath(); ctx.arc(sx, sy, 11, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1; return;
          }
          const ex = clamp(sx, m, cwv - m), ey = clamp(sy, m, chv - m);
          const a = Math.atan2(sy - ey, sx - ex);
          ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
          ctx.fillStyle = col; ctx.globalAlpha = 0.9;
          ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-7, -6); ctx.lineTo(-7, 6); ctx.closePath(); ctx.fill();
          ctx.restore(); ctx.globalAlpha = 1;
        };
        if (pb.radarEnemy) marker(nearest(enemies), PERKS.eradar.tint);
        if (pb.radarItem) marker(nearest(pickups.filter(q => q.kind === 'mod')), '#b57cff');
        if (pb.radarWand) marker(nearest(pickups.filter(q => q.kind === 'gun')), COL.bullet);
      }

      // pickup messages
      ctx.textAlign = 'center';
      const ch = playPx / dpr;
      for (let i = 0; i < toasts.length; i++) {
        const tm = toasts[i];
        ctx.globalAlpha = Math.min(1, tm.t * 1.5);
        ctx.fillStyle = COL.text;
        ctx.font = '600 14px system-ui, sans-serif';
        ctx.fillText(tm.text, cw / 2, ch - 18 - (toasts.length - 1 - i) * 19);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';

      ctx.textAlign = 'center';
      if (levelT < 3) {
        ctx.fillStyle = COL.text;
        ctx.globalAlpha = Math.min(1, 3 - levelT);
        ctx.font = '700 22px system-ui, sans-serif';
        ctx.fillText(themeFor(floor).name, cw / 2, 196);
        ctx.font = '500 14px system-ui, sans-serif';
        ctx.fillText('Find the green exit at the top', cw / 2, 218);
        ctx.fillText('Buy and fit mods here, then climb', cw / 2, 236);
        ctx.globalAlpha = 1;
      }
      const msgY = 196;
      ctx.fillStyle = COL.text;
      if (p.dead) {
        ctx.font = '700 22px system-ui, sans-serif';
        ctx.fillText('You were shot down', cw / 2, msgY);
        ctx.font = '500 14px system-ui, sans-serif';
        ctx.fillText('Tap the right stick to restart', cw / 2, msgY + 22);
      } else if (enemies.length === 0) {
        ctx.font = '700 18px system-ui, sans-serif';
        ctx.fillText('All enemies destroyed', cw / 2, msgY);
      }
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;

      // mouse reticule
      if (mouse.inside) {
        const mx = mouse.x, my = mouse.y;
        for (const [w, colr] of [[4, 'rgba(0,0,0,0.6)'], [2, mouse.down ? COL.flame2 : COL.text]]) {
          ctx.strokeStyle = colr; ctx.lineWidth = w;
          ctx.beginPath(); ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(mx - 15, my); ctx.lineTo(mx - 5, my);
          ctx.moveTo(mx + 5, my); ctx.lineTo(mx + 15, my);
          ctx.moveTo(mx, my - 15); ctx.lineTo(mx, my - 5);
          ctx.moveTo(mx, my + 5); ctx.lineTo(mx, my + 15);
          ctx.stroke();
        }
      }

      // ---- the map (toggled by the map button; the run is paused while it is up) ----
      // Covers the whole play area above the controls on solid black: the revealed cave as
      // white outlines, fitted and centred, with a yellow dot for you. Only outline cells the
      // fog has revealed are painted; the source is finer than the display and smooth-scaled,
      // so the walls read as continuous lines, not a scatter.
      if (input.current.mapOpen) {
        mini32.fill(0);
        for (let k = 0; k < miniEdgeIdx.length; k++) {
          const i = miniEdgeIdx[k];
          const tx = (i % MMW) * MINI_D, ty = ((i / MMW) | 0) * MINI_D;
          const fi = ((ty / FOG) | 0) * FW + ((tx / FOG) | 0);
          if (seen[fi]) mini32[i] = 0xe6ffffff;            // white, ~0.9 alpha
        }
        mctx.putImageData(miniImg, 0, 0);
        const pw = c.width / dpr, ph = playPx / dpr, pad = 10;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = 'rgba(0,0,0,0.8)';            // a touch see-through, so the cave shows behind
        ctx.fillRect(0, 0, pw, ph);
        const k = Math.min((pw - 2 * pad) / MMW, (ph - 2 * pad) / MMH);
        const mw = MMW * k, mh = MMH * k, mx0 = (pw - mw) / 2, my0 = (ph - mh) / 2;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(miniC, 0, 0, MMW, MMH, mx0, my0, mw, mh);
        const wW = CW * CELL, wH = CH * CELL;
        const mX = x => mx0 + (x / wW) * mw, mY = y => my0 + (y / wH) * mh;
        // the prize rooms you've found: a yellow outline, crossed out once you've had the prize
        ctx.strokeStyle = '#ffd23c'; ctx.lineWidth = 1.5;
        for (const r of rooms) {
          if (!roomSeen(r)) continue;
          const x0 = mX(r.x - ROOM_HW), y0 = mY(r.y - ROOM_HH), x1 = mX(r.x + ROOM_HW), y1 = mY(r.y + ROOM_HH);
          ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
          if (r.taken) {
            const ix = (x1 - x0) * 0.25, iy = (y1 - y0) * 0.2;
            ctx.beginPath();
            ctx.moveTo(x0 + ix, y0 + iy); ctx.lineTo(x1 - ix, y1 - iy);
            ctx.moveTo(x1 - ix, y0 + iy); ctx.lineTo(x0 + ix, y1 - iy);
            ctx.stroke();
          }
        }
        // loot you've seen and left: green for mods, yellow for guns (a ring if you threw it back)
        for (const q of pickups) {
          if (q.taken || !fogLit(q.x, q.y)) continue;
          const col = q.kind === 'gun' ? '#ffd23c' : '#46e07a';
          ctx.beginPath(); ctx.arc(mX(q.x), mY(q.y), 2.6, 0, Math.PI * 2);
          if (q.old) { ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke(); }
          else { ctx.fillStyle = col; ctx.fill(); }
        }
        // you: a bigger dot with a white rim, so it can't be mistaken for a gun
        ctx.fillStyle = '#ffd23c'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(mX(p.x + PW / 2), mY(p.y + PH / 2), 4, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.imageSmoothingEnabled = false;
      }
    }

    const loop = t => {
      const dt = Math.max(0, Math.min(0.033, (t - last) / 1000));
      last = t;
      const rv = input.current.replay;
      if (rv && REC.done) {                   // the death replay: its own clock, the world stays put
        if (rv.playing) {
          rv.t += dt * rv.speed;
          const W = input.current.witness;
          if (rv.t >= W.t1) {                  // the end: round again, or stop there
            if (rv.loop) rv.t = W.t0; else { rv.t = W.t1; rv.playing = false; }
          }
        }
        SFX.tick();
        drawReplay(rv);
      } else {
        if (!input.current.paused) { step(dt); recFrame(dt); }
        SFX.tick();
        draw();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('resize', resize);
      clearInterval(saveTick);
      if (jetLoop) jetLoop.stop();
      if (portalLoop) portalLoop.stop();
      if (matterLoop) matterLoop.stop();
      for (const h of bhLoops.values()) h.stop();
      document.removeEventListener('visibilitychange', saveHidden);
      window.removeEventListener('pagehide', saveRun);
      c.removeEventListener('pointermove', mMove);
      c.removeEventListener('pointerdown', mDown);
      c.removeEventListener('pointerup', mUp);
      c.removeEventListener('pointercancel', mUp);
      c.removeEventListener('pointerleave', mLeave);
      mouse.inside = false; mouse.down = false;
    };
  }, []);
  return h('canvas', { ref: cv, className: 'game' });
}

// the circumference of the gauge ring (r=46 in a 0..100 viewBox), used to turn a 0..1
// fraction into a stroke-dasharray so the ring is drawn only as far as the stat reaches
const GAUGE_R = 46, GAUGE_C = 2 * Math.PI * GAUGE_R;
// the three gun stats shown as rings on the right stick and colour-coded in the bag, so a
// ring and its stat read as the same thing: mana gold, recharge blue, cast delay purple
const GAUGE_COL = { mana: '#ffc93c', rech: '#7ad7ff', cast: '#c58cff', fuel: '#ff9a2e' };
// green -> amber -> red as health falls, so the colour itself reads as danger
function healthCol(frac) {
  return frac > 0.5 ? mixHex('#e6a52c', '#57d267', (frac - 0.5) * 2)
                    : mixHex('#e24a2c', '#e6a52c', frac * 2);
}
// "Tap the right stick", for the buy/take line: a thin white circle with a thin R in it.
function RKey() {
  return h('svg', { className: 'rkey', viewBox: '0 0 30 30', width: 28, height: 28, 'aria-hidden': true },
    h('circle', { cx: 15, cy: 15, r: 13.5, fill: 'none', stroke: '#fff', strokeWidth: 1 }),
    h('text', { x: 15, y: 15, textAnchor: 'middle', dominantBaseline: 'central', fill: '#fff',
      fontSize: 14, fontWeight: 300, fontFamily: 'system-ui, sans-serif' }, 'R'));
}
function Stick({ size, kind, input, refresh }) {
  const [knob, setKnob] = useState({ x: 0, y: 0, jet: false });
  // the live stat this stick shows: hp+fuel on the left, mana on the right. Read off
  // input.current.hud each animation frame, and only re-rendered when a value actually
  // moves (rounded to 1%), so the ring animates without churning the whole tree.
  const [gauge, setGauge] = useState({ ring: 1, fuel: 1, empty: false, dry: true });
  const left = kind === 'left';
  useEffect(() => {
    let raf, prev = '';
    const tick = () => {
      const s = input.current.hud;
      if (s) {
        const g = left
          ? { ring: s.hp, fuel: s.fuel, empty: s.empty, dry: false }
          : { ring: s.hasGun ? s.mana : 0, rech: s.hasGun ? s.rech : 0, cast: s.hasGun ? s.cast : 0,
              has: s.hasGun, fuel: 0, empty: false, dry: !s.hasGun || s.recharging };
        const key = Math.round(g.ring * 100) + '|' + Math.round(g.fuel * 100) + '|' +
          Math.round((g.rech || 0) * 100) + '|' + Math.round((g.cast || 0) * 100) + '|' +
          (g.has ? 1 : 0) + '|' + (g.empty ? 1 : 0) + '|' + (g.dry ? 1 : 0);
        if (key !== prev) { prev = key; setGauge(g); }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [left]);
  const ref = useRef(null);
  const pid = useRef(null);
  // right stick only: true while this touch has never left the dead zone. A tap that
  // stays true until release is an interact; a drag out (even one that comes back to
  // centre) sets it false the moment it first crosses AIM_DEAD, and stays false.
  const stayed = useRef(true);

  const right = kind === 'right';
  const update = e => {
    const r = ref.current.getBoundingClientRect();
    const rad = r.width / 2;
    const dx = e.clientX - (r.left + rad), dy = e.clientY - (r.top + rad);
    const dist = Math.hypot(dx, dy);
    const maxD = rad * 0.72;
    const cl = Math.min(dist, maxD);
    const nx = dist ? dx / dist : 0, ny = dist ? dy / dist : 0;
    const mag = cl / maxD;
    const thresh = right ? AIM_DEAD : 0.15;
    if (right && mag > AIM_DEAD) stayed.current = false;
    // A card is up: left picks up, right leaves, and the one you are pointing at is the
    // one lit. Inside the dead zone neither is lit, because you have not chosen yet.
    if (right && input.current.confirmAct) {
      const side = mag > AIM_DEAD ? (nx < 0 ? 'take' : 'leave') : null;
      if (input.current.confirmAim !== side) { input.current.confirmAim = side; refresh(); }
    }
    const st = input.current[kind];
    st.active = true; st.nx = nx; st.ny = ny; st.mag = mag; st.dy = dy; st.on = mag > thresh;
    setKnob({ x: nx * cl, y: ny * cl, jet: kind === 'left' && dy < 0 && mag > DEAD });
  };
  const down = e => {
    if (pid.current !== null) return;
    pid.current = e.pointerId;
    stayed.current = true;
    try { ref.current.setPointerCapture(e.pointerId); } catch (_) {}
    update(e);
  };
  const move = e => { if (e.pointerId === pid.current) update(e); };
  const end = e => {
    if (e.pointerId !== pid.current) return;
    pid.current = null;
    const act = input.current.confirmAct;
    if (right && act) {
      // a confirmation is up, so the gesture is "point left or right and let go". The
      // side was decided while dragging, so coming back to the middle before releasing
      // picks nothing, which is the right answer — you were not pointing anywhere.
      const side = input.current.confirmAim;
      input.current.confirmAim = null;
      if (side) act[side]();
    } else if (right && stayed.current) {
      input.current.interact = true;
    }
    Object.assign(input.current[kind], { active: false, mag: 0, on: false, dy: 0 });
    setKnob({ x: 0, y: 0, jet: false });
  };

  // the circular gauges, each a thin ring wiped clockwise from the top as its stat falls.
  // Left: health at the edge, jet fuel just inside it (red track when the tank is dry).
  // Right: gold mana at the edge, then recharge and cast delay inside it, so you can see
  // which one is gating your fire.
  const rw = 3.2, sw = 1.6;
  const wipe = (r, frac, col, track) => [
    h('circle', { key: 't' + r, cx: 50, cy: 50, r, fill: 'none', stroke: track || 'rgba(0,0,0,0.35)', strokeWidth: sw }),
    h('circle', { key: 'w' + r, cx: 50, cy: 50, r, fill: 'none', stroke: col, strokeWidth: sw,
      strokeLinecap: 'round',
      strokeDasharray: (Math.max(0, Math.min(1, frac)) * 2 * Math.PI * r) + ' ' + (2 * Math.PI * r),
      transform: 'rotate(-90 50 50)' })];
  const ring = left
    ? h('svg', { className: 'gauge', viewBox: '0 0 100 100' },
        wipe(GAUGE_R, gauge.ring, healthCol(gauge.ring)),
        wipe(GAUGE_R - rw, gauge.fuel, knob.jet ? '#ffc35a' : GAUGE_COL.fuel,
          gauge.empty ? 'rgba(226,74,44,0.7)' : null))
    : h('svg', { className: 'gauge', viewBox: '0 0 100 100' },
        wipe(GAUGE_R, gauge.ring, gauge.dry ? 'rgba(255,201,60,0.28)' : GAUGE_COL.mana),
        wipe(GAUGE_R - rw, gauge.rech, gauge.has ? GAUGE_COL.rech : 'rgba(122,215,255,0.22)'),
        wipe(GAUGE_R - 2 * rw, gauge.cast, gauge.has ? GAUGE_COL.cast : 'rgba(197,140,255,0.22)'));
  return h('div', {
      ref, className: 'stick' + (knob.jet ? ' jetting' : ''),
      style: { width: size, height: size },
      onPointerDown: down, onPointerMove: move, onPointerUp: end,
      onPointerCancel: end, onLostPointerCapture: end,
    },
    // the centre line splits jet (top half) from walk
    left && h('div', { className: 'stickclip' }, h('div', { className: 'hline' })),
    ring,
    // the right stick's amber ring: the line the knob's edge crosses when the drag starts
    // counting as aiming rather than as a tap on the dead zone
    h('div', { className: 'knob', style: {
      width: (KNOB * 100) + '%', height: (KNOB * 100) + '%',
      transform: `translate(-50%,-50%) translate(${knob.x}px,${knob.y}px)` } }),
    right && h('div', { className: 'deadzone', style: {
      width: (AIM_RING * 100) + '%', height: (AIM_RING * 100) + '%' } }),
    h('span', { className: 'lbl top' }, left ? 'jet' : 'aim'),
    left && h('span', { className: 'lbl bot' }, 'walk')
  );
}

// The same detail card is used by the build screen and by the shop, so what you
// read standing on a plinth is exactly what you get once you own it.
// Tap or hold, told apart: a hold fires on its own after `ms`, a release before
// that counts as a tap, and sliding off cancels both.
function holdPress(onTap, onHold, onState, ms) {
  return e => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    let fired = false;
    const done = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (onState) onState(false);
    };
    const timer = setTimeout(() => { fired = true; done(); onHold(); }, ms || 450);
    const move = ev => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 14) done(); };
    const up = () => { const tap = !fired; done(); if (tap && onTap) onTap(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    if (onState) onState(true);
  };
}

// Every gun stat in one place, with which direction counts as an improvement:
// a smaller cast delay, recharge or spread is better, so those read green.
const GUN_STATS = [
  { k: 'cap', label: 'slots', better: 1, get: g => g.cap, fmt: v => String(v) },
  { k: 'delay', label: 'cast delay', better: -1, get: g => g.castDelay, fmt: v => v.toFixed(2) + 's' },
  { k: 'rech', label: 'recharge', better: -1, get: effRecharge, fmt: v => v.toFixed(2) + 's' },
  { k: 'mana', label: 'mana', better: 1,
    get: g => g.manaMax + gunPassives(g).manaMax, fmt: v => String(Math.round(v)) },
  { k: 'regen', label: 'mana regen', better: 1,
    get: g => g.manaRegen + gunPassives(g).manaRegen, fmt: v => Math.round(v) + '/s' },
  { k: 'spread', label: 'spread', better: -1, get: g => g.spread, fmt: v => v.toFixed(1) + '\u00b0' },
  { k: 'multi', label: 'shots per cast', better: 1, get: g => g.multi, fmt: v => String(v) },
  { k: 'speed', label: 'shot speed', better: 1, get: g => g.speedMul || 1, fmt: v => 'x' + v.toFixed(2) },
  { k: 'order', label: 'cast order', better: 1,
    get: g => (g.shuffle ? 0 : 1), fmt: v => (v ? 'in order' : 'shuffle') },
];

// One card for a gun: its rolled stats and the mods sitting on it.
// `split` is the gun-pickup variant: the stats collapse to wrapping chips and the
// card becomes a flex column, so the mod row at the bottom never gets pushed off.
function GunCard({ gun, label, onClose, ingame, flow, split, mark, compare, compareName }) {
  const vs = compare && compare !== gun ? compare : null;
  const stats = GUN_STATS.map(st => {
    const v = st.get(gun);
    let cls = '';
    if (vs) {
      const o = st.get(vs);
      if (Math.abs(v - o) > 1e-6) cls = (v > o) === (st.better > 0) ? ' up' : ' down';
    }
    return { st, v, cls };
  });
  return h('div', { className: 'pop scroll' + (ingame ? ' ingame' : '') + (flow ? ' flow' : '') +
      (split ? ' split' : '') + (mark ? ' ' + mark : '') },
    h('div', { className: 'phead' },
      h('div', { className: 'pglyph', style: { borderColor: gunLvCol(gun) || '#c9ccd4', color: gunLvCol(gun) || '#c9ccd4' } }, '⌥'),
      h('div', { className: 'ptitle' },
        h('b', { style: { color: gunColor(gun) } }, gun.name),
        h('span', null, (label || 'Gun') + (gun.lvl ? ' · Lv ' + gun.lvl : '') + ' · ' + gun.cap + ' slots')),
      onClose ? h('button', { className: 'pclose',
        onPointerDown: e => { e.preventDefault(); onClose(); } }, '×') : null
    ),
    vs ? h('p', { className: 'vs' }, 'compared with ' + compareName) : null,
    split
      ? h('div', { className: 'stats gstats' },
          stats.map(r => h('div', { className: 'st' + r.cls, key: r.st.k },
            h('b', null, r.st.fmt(r.v)), h('span', null, r.st.label))))
      : h('div', { className: 'prows' },
          stats.map(r => h('div', { className: 'prow' + r.cls, key: r.st.k },
            h('span', null, r.st.label), h('b', null, r.st.fmt(r.v))))),
    h('div', { className: 'pdemo' },
      h('div', { className: 'dtiles' },
        gun.slots.map((id, i) => id
          ? h('div', { key: i, className: 'dtile',
              style: { borderColor: famCol(id), color: famCol(id) } },
            h('b', null, MODS[id].glyph), h('i', null, MODS[id].name))
          : h('div', { key: i, className: 'dtile off' }, h('i', null, 'empty')))),
      split && gun.slots.some(Boolean) ? null       // the split view needs the height more
        : h('span', { className: 'dnote' }, gun.slots.some(Boolean)
          ? 'cast left to right' : 'nothing fitted yet'))
  );
}

// Walked onto a gun: compare it with yours and pick which of your four it replaces, or
// leave it. Mods are taken straight (no screen); guns keep this chooser because a gun goes
// into one of four slots and is worth comparing before you commit.
function GunSwap({ input, refresh, onDone }) {
  const LO = input.current.loadout;
  useEffect(() => { SFX.fx('open'); }, []);
  const found = input.current.found;
  const [base, setBase] = useState(LO.guns[LO.sel] ? LO.sel : LO.guns.findIndex(Boolean));
  const [held, setHeld] = useState(-1);
  if (!found) return null;
  const baseGun = base >= 0 ? LO.guns[base] : null;

  const take = i => {
    const old = LO.guns[i];
    LO.guns[i] = resetGun(found.gun);   // taking a gun never changes which one you hold
    SFX.ui('gun');
    if (old) { found.gun = old; found.old = true; }   // your old gun stays here, no glow: you've had it
    else found.taken = true;
    found.cool = PICKUP_COOL;           // don't reopen the moment you step past it
    input.current.found = null;
    refresh();
    onDone();
  };
  const leave = () => {
    found.cool = PICKUP_COOL;         // same for one you looked at and walked away from
    input.current.found = null; refresh(); onDone();
  };

  // Both guns are on screen at once and split the space between them: the found one
  // above, the slot you are comparing it against below. Each card keeps its head and
  // its mod row pinned, so the mods are never the thing that falls off the bottom.
  return h('div', { className: 'sheet swapsheet' },
    h('div', { className: 'shead' },
      h('h2', null, 'Gun on the ground'),
      h('button', { className: 'done', onPointerDown: e => { e.preventDefault(); leave(); } }, 'Leave it')
    ),
    h(GunCard, { gun: found.gun, label: 'Found', flow: true, split: true, mark: 'found',
      compare: baseGun,
      compareName: baseGun ? 'slot ' + (base + 1) + ', ' + baseGun.name : '' }),
    baseGun
      ? h(GunCard, { gun: baseGun, label: 'Slot ' + (base + 1) + ' \u00b7 yours', flow: true,
          split: true, mark: 'mine', compare: found.gun, compareName: found.gun.name })
      : h('p', { className: 'lab mine' }, base >= 0
          ? 'Slot ' + (base + 1) + ' is empty' : 'No guns to compare it with'),
    h('p', { className: 'lab hint' }, 'Hold a slot to swap it \u00b7 tap to compare it'),
    h('div', { className: 'swaprow' },
      LO.guns.map((g, i) => h('button', {
          key: i,
          className: 'gtab' + (g ? '' : ' empty') + (held === i ? ' holding' : '') +
            (base === i ? ' base' : ''),
          onPointerDown: holdPress(
            () => { if (g) setBase(i); },
            () => take(i),
            on => setHeld(on ? i : -1)),
        },
        h('span', { className: 'num' }, i + 1),
        h('span', { className: 'gname', style: g ? { color: gunColor(g) } : null }, g ? g.name : 'Empty slot'),
        h('span', { className: 'gsub' }, g ? g.slots.filter(Boolean).length + '/' + g.cap + ' mods' : 'hold to take')
      ))
    )
  );
}

function ModCard({ id, onClose, ingame, top, flow }) {
  const m = MODS[id];
  const kind = famOf(id).name + (m.kind === 'passive' ? ' \u00b7 always on' : '');
  const rows = modPreview(id).rows;
  const dtile = (did, key, faded) => h('div', {
      key, className: 'dtile' + (faded ? ' off' : ''),
      style: { borderColor: famCol(did), color: famCol(did) } },
    h('b', null, MODS[did].glyph), h('i', null, MODS[did].name));
  const drow = (ok, tiles, note, key) => h('div', { className: 'drow', key },
    h('span', { className: 'dmark ' + (ok ? 'yes' : 'no') }, ok ? '\u2713' : '\u2717'),
    h('div', null,
      h('div', { className: 'dtiles' }, tiles),
      h('span', { className: 'dnote' }, note)));
  // cast delay is walked in order, so anything that touches it needs explaining
  let timing = null;
  if (m.setDelay !== undefined) {
    timing = 'Sets the gun\u2019s cast delay to ' + m.setDelay + 's the moment it is cast, ' +
      'instead of nudging it like other mods. Anything cast AFTER it adds its own delay back ' +
      'on top, so it only pays off last \u2014 usually at the tail of a multicast group, where ' +
      'it fires alongside your real shot and leaves the gun ready immediately.';
  } else if (m.d) {
    timing = (m.d < 0 ? 'Takes ' + Math.abs(m.d) : 'Adds ' + m.d) + 's ' +
      (m.d < 0 ? 'off' : 'to') + ' the cast delay of the pull it is drawn in. ' +
      'Cast delay is the gap between shots; a mod that zeroes it outright (Buzzsaw) ' +
      'wipes this out if it comes after.';
  } else if (m.rech || m.rechMul) {
    timing = 'Recharge is the pause once the gun reaches the end of its list. This counts ' +
      'from any slot, so position does not matter for it.';
  }

  let demo;
  if (m.setDelay !== undefined) {
    demo = [drow(true, [dtile('double', 'a'), dtile('bolt', 'b'), dtile(id, 'c')],
              'the bolt fires, then this wipes the delay \u2014 shoot again at once', 1),
            drow(false, [dtile(id, 'd'), dtile('bolt', 'e', true)],
              'the bolt adds its delay back after the reset', 2)];
  } else if (m.kind === 'passive') {
    demo = [drow(true, [dtile(id, 'a'), dtile('bolt', 'b')], 'counts wherever you put it', 1),
            drow(true, [dtile('bolt', 'c'), dtile(id, 'd')], 'same here — order does not matter', 2)];
  } else if (m.kind === 'shot') {
    demo = [drow(true, [dtile('dmg_up', 'a'), dtile(id, 'b')], 'modifiers go to its left', 1),
            drow(false, [dtile(id, 'c'), dtile('dmg_up', 'd', true)], 'a modifier here comes too late', 2)];
  } else if (m.kind === 'static') {
    demo = [drow(true, [dtile('dmg_up', 'a'), dtile(id, 'b')],
              'modifiers to its left still count', 1),
            drow(true, [dtile('double', 'c'), dtile(id, 'd'), dtile('bolt', 'e')],
              'it takes a cast slot like any shot does', 2)];
  } else if (m.copy === 'mods') {
    demo = [drow(true, [dtile(id, 'a'), dtile('bolt', 'b'), dtile('heavy', 'c')],
              'the heavy shot counts even though it sits after the bolt', 1),
            drow(true, [dtile('heavy', 'd'), dtile(id, 'e'), dtile('bolt', 'f')],
              'and here too \u2014 Mu does not care where they are', 2)];
  } else if (m.copy) {
    demo = [drow(true, [dtile('bolt', 'a'), dtile(id, 'b')],
              'it copies off the gun, so give it something to copy', 1),
            drow(false, [dtile(id, 'c'), dtile('bolt', 'd', true)],
              'first in an empty gun, there is nothing to copy yet', 2)];
  } else if (m.myriad) {
    demo = [drow(true, [dtile(id, 'a'), dtile('bolt', 'b'), dtile('bolt', 'c'), dtile('slug', 'd')],
              'all three fire together on one pull', 1),
            drow(false, [dtile('bolt', 'e'), dtile(id, 'f', true)], 'nothing left after it', 2)];
  } else if (m.multi) {
    demo = [drow(true, [dtile(id, 'a'), dtile('bolt', 'b'), dtile('bolt', 'c')],
              'both bolts fire on one pull', 1),
            drow(false, [dtile('bolt', 'd'), dtile(id, 'e', true)], 'nothing after it to gather', 2)];
  } else if (m.kind === 'util' && !m.f) {
    demo = [drow(true, [dtile(id, 'a'), dtile('bolt', 'b')],
              'it fires along with the pull it is drawn in', 1),
            drow(true, [dtile('bolt', 'c'), dtile(id, 'd')], 'same pull, same effect', 2)];
  } else {
    demo = [drow(true, [dtile(id, 'a'), dtile('bolt', 'b')], 'the bolt gets the effect', 1),
            drow(false, [dtile('bolt', 'c'), dtile(id, 'd', true)], 'too late — the bolt already fired', 2)];
  }
  return h('div', { className: 'pop scroll' + (ingame ? ' ingame' : '') + (top ? ' top' : '') + (flow ? ' flow' : '') },
    h('div', { className: 'phead' },
      h('div', { className: 'pglyph', style: { borderColor: famCol(id), color: famCol(id) } }, m.glyph),
      h('div', { className: 'ptitle' },
        h('b', null, m.name),
        h('span', null, kind + (m.mana ? ' \u00b7 ' + m.mana + ' mana' : ''))),
      onClose ? h('button', { className: 'pclose',
        onPointerDown: e => { e.preventDefault(); onClose(); } }, '\u00d7') : null
    ),
    m.info ? h('p', { className: 'pinfo' }, m.info) : null,
    timing ? h('p', { className: 'pnote' }, timing) : null,
    rows.length ? h('div', { className: 'prows' },
      rows.map((r, i) => h('div', { className: 'prow', key: i },
        h('span', null, r[0]), h('b', null, r[1])))) : null,
    // the placement use-example is for the editor, where you're deciding where a mod
    // goes — the shop/pickup preview leaves it off and keeps the card compact.
    ingame ? null : h('div', { className: 'pdemo' }, demo)
  );
}

// A gun's stats, one per line: name in its gauge colour, value red->green by how near
// perfect it is, and what the fitted mods add or take away.
const PULL_COL = ['#ff8a1f', '#3fc9ff', '#b565ff', '#57d267', '#ff5fa2', '#ffd23c'];
const GS_ROWS = [
  { k: 'cap', label: 'Slots', fmt: v => String(v) },
  { k: 'castDelay', label: 'Cast delay', col: GAUGE_COL.cast, fmt: v => v.toFixed(2) + 's', better: -1, dfmt: v => v.toFixed(2) + 's' },
  { k: 'recharge', label: 'Recharge', col: GAUGE_COL.rech, fmt: v => v.toFixed(2) + 's', better: -1, dfmt: v => v.toFixed(2) + 's' },
  { k: 'manaMax', label: 'Mana', col: GAUGE_COL.mana, fmt: v => String(Math.round(v)), better: 1, dfmt: v => String(Math.round(v)) },
  { k: 'manaRegen', label: 'Mana regen', col: GAUGE_COL.mana, fmt: v => Math.round(v) + '/s', better: 1, dfmt: v => String(Math.round(v)) },
  { k: 'spread', label: 'Spread', fmt: v => v.toFixed(1) + '°', better: -1, dfmt: v => v.toFixed(1) + '°' },
  { k: 'speedMul', label: 'Shot speed', fmt: v => '×' + v.toFixed(2), better: 1, dfmt: v => v.toFixed(2) },
  { k: 'multi', label: 'Per cast', fmt: v => String(v) },
  { k: 'shuffle', label: 'Order', fmt: v => (v ? 'shuffle' : 'in order') },
];
// Cast delay, recharge and mana get a thin bar under them showing the fire preview live,
// draining and refilling like the right stick's rings (the other stats have none). The
// bars are written straight to the DOM each frame, not re-rendered.
const LIVE_BAR = { castDelay: GAUGE_COL.cast, recharge: GAUGE_COL.rech, manaMax: GAUGE_COL.mana };
function GunStats({ gun, sim, sig }) {
  const d = useMemo(() => gunModDeltas(gun), [sig]);
  const bars = useRef({});
  useEffect(() => {
    let raf;
    const loop = () => {
      const S = sim.current;
      if (S) {
        const gg = fireSimGauges(S);
        for (const k in LIVE_BAR) if (bars.current[k]) bars.current[k].style.width = (gg[k] * 100).toFixed(1) + '%';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const bar = (k, frac, col) => h('div', { className: 'gsbar' },
    h('i', { ref: LIVE_BAR[k] ? el => { bars.current[k] = el; } : undefined, 'data-live': LIVE_BAR[k] ? k : undefined,
      style: { width: (frac * 100).toFixed(1) + '%', background: col } }));
  return h('div', { className: 'gstats' },
    gun.lvl ? h('div', { className: 'gsrow' }, h('span', null, 'Level'),
      h('b', { style: { color: gunLvCol(gun) } }, 'Lv ' + gun.lvl)) : null,
    GS_ROWS.map(r => {
      const v = r.k === 'speedMul' ? (gun.speedMul || 1) : gun[r.k];
      const dv = d[r.k] || 0, show = r.dfmt && Math.abs(dv) > 0.005;
      const q = statQual(r.k, v);
      return h('div', { key: r.k, className: 'gsrow', 'data-stat': r.k },
        h('span', r.col ? { style: { color: r.col } } : null, r.label),
        h('b', { style: { color: healthCol(q) } }, r.fmt(v)),
        show ? h('u', { className: (dv > 0) === (r.better > 0) ? 'up' : 'down' },
          (dv > 0 ? '+' : '\u2212') + r.dfmt(Math.abs(dv))) : null,
        LIVE_BAR[r.k] ? bar(r.k, 1, LIVE_BAR[r.k]) : null);
    }));
}

// the gun's picture on its button, drawn with the same sprite as the one in your hands
function GunIcon({ gun }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1, W = 64, H = 32;
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const sc = 2.7;
    drawGun(ctx, W / 2 - 3.85 * sc, H / 2 + 1 * sc, 0, sc, gunAccent(gun));
  });
  return h('canvas', { ref, className: 'gicon' });
}

// The gun's slots as a fixed grid: a mod stays exactly where you drop it. The fire preview
// (fireSimStep, trigger held) runs here at DEV.bagSpeed × real time; each pull lights the
// slots it fired in that pull's colour. Only re-renders when the lit set changes, so the
// Editor (and the advisor) never re-render per frame.
function SlotGrid({ gun, tile, sig, sim }) {
  const [lit, setLit] = useState(null);
  const steps = useMemo(() => pullSteps(gun), [sig]);
  useEffect(() => {
    let raf, last = performance.now(), prev = null;
    const loop = now => {
      const S = sim.current;
      const dt = Math.min(0.1, (now - last) / 1000) * DEV.bagSpeed;
      last = now;
      if (S) {
        // small sub-steps so a very fast gun still fires every pull it should
        for (let t = dt; t > 0; t -= 0.01) fireSimStep(S, Math.min(0.01, t));
        if (S.lit !== prev) { prev = S.lit; setLit(S.lit); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const pullOf = new Array(gun.slots.length).fill(-1);
  if (steps) for (const st of steps) pullOf[st.slot] = st.pull;
  const on = new Set(lit ? lit.slots : []);
  const col = lit ? PULL_COL[lit.pull % PULL_COL.length] : null;
  return h(ScrollBox, { cls: 'slotRow' }, h('div', { className: 'mgrid' },
    gun.slots.map((id, i) => {
      const el = tile(id, { type: 'slot', i }, i);
      return React.cloneElement(el, { 'data-pull': pullOf[i],
          className: el.props.className + (id && steps && pullOf[i] < 0 ? ' cold' : '') },
        ...[].concat(el.props.children),
        on.has(i) ? h('i', { className: 'pulse on', style: { background: col, borderColor: col, color: col } }) : null);
    })));
}

// A scroll box with a bar down its right side you can grab: the mod tiles take a touch for
// dragging, so with a full grid there was nothing left to scroll by. Tap the bar to jump
// there, or drag the thumb. The thumb follows the box however it scrolled.
function ScrollBox({ cls, drop, children }) {
  const ref = useRef(null);
  const [t, setT] = useState({ top: 0, size: 1, show: false, on: false });
  useEffect(() => {
    const el = ref.current;
    const measure = () => {
      const H = el.scrollHeight, c = el.clientHeight, show = H > c + 1;
      const size = show ? Math.max(0.14, c / H) : 1;
      const top = show ? el.scrollTop / (H - c) * (1 - size) : 0;
      setT(o => o.show === show && Math.abs(o.size - size) < 0.002 && Math.abs(o.top - top) < 0.002 ? o
        : Object.assign({}, o, { top, size, show }));
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) { ro.observe(el); if (el.firstChild) ro.observe(el.firstChild); }
    return () => { el.removeEventListener('scroll', measure); if (ro) ro.disconnect(); };
  }, []);
  const grab = e => {
    e.preventDefault(); e.stopPropagation();
    const el = ref.current, bar = e.currentTarget.getBoundingClientRect();
    const size = t.size, thumb = size * bar.height, at = bar.top + t.top * bar.height;
    // held on the thumb: keep that grip; on the track: the thumb centres under the finger
    const off = e.clientY >= at && e.clientY <= at + thumb ? e.clientY - at : thumb / 2;
    const to = y => {
      const f = (y - off - bar.top) / Math.max(1, bar.height - thumb);
      el.scrollTop = Math.max(0, Math.min(1, f)) * (el.scrollHeight - el.clientHeight);
    };
    to(e.clientY);
    setT(o => Object.assign({}, o, { on: true }));
    const move = ev => to(ev.clientY);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setT(o => Object.assign({}, o, { on: false }));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  return h('div', { className: 'sbwrap ' + cls.split(' ')[0] + 'W', 'data-drop': drop },
    h('div', { ref, className: cls + ' scroll', 'data-drop': drop }, children),
    t.show ? h('div', { className: 'sbar' + (t.on ? ' on' : ''), onPointerDown: grab },
      h('i', { style: { top: t.top * 100 + '%', height: t.size * 100 + '%' } })) : null);
}

// the build advisor's suggested swaps are parked (v72): the dmg/s line still shows, the
// tip buttons don't. buildAdvice and the tip code are kept; flip this to bring them back.
const SHOW_TIPS = false;

function Editor({ input, close, refresh, canEdit }) {
  const LO = input.current.loadout;
  useEffect(() => { SFX.fx('open'); return () => SFX.fx('close'); }, []);
  const [sel, setSel] = useState(LO.sel);
  const sim = useRef(null);
  const [drag, setDrag] = useState(null);
  const [info, setInfo] = useState(null);
  const [gdrag, setGdrag] = useState(null);
  const gun = LO.guns[sel];

  // DEBUG swaps your collection for a shelf holding one of every mod, and nothing
  // you drag off it is used up. Your own bag is left completely alone while it is
  // on, so switching back hands your real mods straight back — the ones you fitted
  // to a gun stay fitted, because they live on the gun, not in the bag.
  const bagIds = LO.debug ? ALL_IDS : LO.bag;
  const takeFromBag = i => { if (!LO.debug) LO.bag.splice(i, 1); };
  const returnToBag = id => { if (!LO.debug && id) LO.bag.push(id); };

  // one-shot reorder into the 8 colour families (same grouping as the legend
  // below), not a display toggle — the bag is already player-mutable state
  // (dragging reorders it too), so this is just another way to reorder it, and
  // it keeps the sort useful as a resting order rather than something to redo
  // every time the sheet reopens. Stable sort: mods keep their relative order
  // within a family.
  const famKeys = Object.keys(FAMILIES);
  const sortBag = () => {
    if (LO.debug) return;
    const rank = id => famKeys.indexOf(FAMILY_OF[id] || 'shots');
    LO.bag.sort((a, b) => rank(a) - rank(b));
    refresh();
  };

  // move a gun to another slot, keeping whatever you had selected selected
  const moveGun = (from, to) => {
    if (from === to) return;
    const held = LO.guns[LO.sel];
    const [g] = LO.guns.splice(from, 1);
    LO.guns.splice(to, 0, g);
    if (held) LO.sel = LO.guns.indexOf(held);
    setSel(LO.sel);
    refresh();
  };

  // tap selects; hold picks the gun up and dragging drops it on another slot
  const gunPress = i => e => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    let dragging = false, over = i;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    const timer = setTimeout(() => {
      if (!LO.guns[i] || !canEdit) return;           // nothing to pick up, or the bag is read-only
      dragging = true;
      setGdrag({ from: i, x: sx, y: sy, over: i });
    }, 320);
    const move = ev => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 14) { cleanup(); setGdrag(null); }
        return;
      }
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const tab = el && el.closest ? el.closest('[data-gun]') : null;
      if (tab) over = Number(tab.dataset.gun);
      setGdrag({ from: i, x: ev.clientX, y: ev.clientY, over });
    };
    const up = () => {
      cleanup();
      setGdrag(null);
      if (dragging) { if (canEdit) moveGun(i, over); }
      else if (LO.guns[i]) { setSel(i); LO.sel = i; refresh(); }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const drop = (x, y, id, from) => {
    if (!canEdit) return;                 // outside the shop (and without Tinker) the bag is read-only
    SFX.fx('place');
    const el = document.elementFromPoint(x, y);
    const node = el && el.closest ? el.closest('[data-drop]') : null;
    const to = node && node.dataset.drop;
    const g = LO.guns[sel];
    if (!to) return;
    if (to === 'bag') {
      if (from.type === 'slot' && g) { g.slots[from.i] = null; returnToBag(id); }
    } else if (to.slice(0, 5) === 'slot:' && g) {
      const k = Number(to.slice(5));
      if (from.type === 'bag') {
        takeFromBag(from.i);
        returnToBag(g.slots[k]);
        g.slots[k] = id;
      } else if (from.i !== k) {
        const swap = g.slots[k];
        g.slots[k] = id;
        g.slots[from.i] = swap;
      }
    }
    if (g) resetGun(g);
    refresh();
  };

  const SLOP = 7;                      // move further than this and it's a drag, not a tap
  const startDrag = (id, from) => e => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    setDrag({ id, from, x: sx, y: sy, armed: false });
    const move = ev => setDrag(d => d && { id: d.id, from: d.from, x: ev.clientX, y: ev.clientY,
      armed: d.armed || Math.hypot(ev.clientX - sx, ev.clientY - sy) > SLOP });
    const up = ev => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setDrag(null);
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) <= SLOP) setInfo(cur => (cur === id ? null : id));
      else drop(ev.clientX, ev.clientY, id, from);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const tile = (id, from, key) => {
    const m = id ? MODS[id] : null;
    return h('div', {
        key,
        className: 'tile' + (m ? '' : ' hole') + (m && m.kind === 'shot' ? ' shot' : ''),
        style: m ? { borderColor: famCol(id), color: famCol(id) } : null,
        'data-drop': from.type === 'slot' ? 'slot:' + from.i : 'bag',
        'data-mod': id || undefined,
        onPointerDown: m ? startDrag(id, from) : undefined,
      },
      m ? h('span', { className: 'tg' }, m.glyph) : h('span', { className: 'tg' }, '+'),
      m ? h('span', { className: 'tn' }, m.name) : null,
      m && m.mark ? h('span', { className: 'tmark' }, m.mark) : null
    );
  };

  const shown = info && MODS[info];

  // the backdrop closes the card, but a tap that lands on another mod switches to it
  const behind = e => {
    e.preventDefault();
    const el = e.currentTarget;
    el.style.pointerEvents = 'none';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    el.style.pointerEvents = '';
    const tile = under && under.closest ? under.closest('[data-mod]') : null;
    const next = tile && tile.dataset.mod;
    setInfo(next && next !== info ? next : null);
  };

  // restart the fire preview whenever the gun or its build changes
  const gsig = gun ? sel + '|' + gun.slots.join() + '|' + gun.multi + '|' + gun.shuffle + '|' + gun.castDelay + '|' + gun.recharge : '';
  if (!sim.current || sim.current.sig !== gsig) sim.current = gun ? Object.assign(fireSimNew(gun), { sig: gsig }) : null;

  const card = shown
    ? h('div', { key: 'card' },
        h('div', { className: 'shade', onPointerDown: behind }),
        h(ModCard, { id: info, onClose: () => setInfo(null), top: true }))
    : null;

  return h('div', { className: 'sheet' + (shown ? ' withcard' : '') },
    h('div', { className: 'shead' },
      h('h2', null, 'Guns & Mods'),
      h('span', { className: 'purse' }, LO.gold + 'g'),
      h('button', { className: 'done', onPointerDown: e => { e.preventDefault(); close(); } }, 'Done')
    ),
    h('div', { className: 'btop' },
      gun ? h(GunStats, { gun, sim, sig: gsig }) : h('div', { className: 'gstats' }, h('p', { className: 'lab' }, 'No gun in this slot')),
      h('div', { className: 'gtabs' },
        LO.guns.map((g, i) => h('button', {
            key: i,
            'data-gun': i,
            className: 'gtab' + (g ? '' : ' empty') + (i === sel ? ' on' : '') +
              (gdrag && gdrag.from === i ? ' lifted' : '') +
              (gdrag && gdrag.over === i && gdrag.from !== i ? ' target' : ''),
            onPointerDown: gunPress(i),
          },
          h('span', { className: 'gname', style: g ? { color: gunColor(g) } : null }, g ? g.name : 'Empty'),
          g ? h(GunIcon, { gun: g }) : h('span', { className: 'gsub' }, '—')
        )))
    ),
    gun ? h('p', { className: 'lab' }, gun.shuffle
      ? 'On the gun — order is shuffled every recharge'
      : 'On the gun — fires left to right, row by row') : null,
    gun ? h(SlotGrid, { gun, tile, sig: gsig, sim }) : null,
    gun ? (() => {
      const adv = buildAdvice(gun, bagIds);
      const apply = t => e => {
        e.preventDefault();
        if (t.kind === 'move') {
          const a = gun.slots[t.slot];
          gun.slots[t.slot] = gun.slots[t.other];
          gun.slots[t.other] = a;
        } else {
          const outgoing = gun.slots[t.slot];
          const k = bagIds.indexOf(t.id);
          if (k >= 0) takeFromBag(k);
          gun.slots[t.slot] = t.id;
          returnToBag(outgoing);
        }
        resetGun(gun);
        refresh();
      };
      return h('div', { className: 'advice' },
        h('div', { className: 'diag ' + adv.limit.key },
          h('b', null, adv.now.dps.toFixed(1) + ' dmg/s'), adv.limit.text),
        SHOW_TIPS && canEdit && adv.tips.length ? h('div', { className: 'tips' },
          adv.tips.map((t, k) => h('button', { key: k, className: 'tip', onPointerDown: apply(t) },
            t.kind === 'move'
              ? 'Swap slots ' + (t.slot + 1) + ' and ' + (t.other + 1)
              : (gun.slots[t.slot] ? 'Replace slot ' + (t.slot + 1) + ' with ' : 'Slot ' +
                  (t.slot + 1) + ': ') + MODS[t.id].name,
            h('b', null, '\u00d7' + t.gain.toFixed(1) + ' dmg')))) : null);
    })() : null,
    h('div', { className: 'bagHead' },
      h('p', { className: 'lab' }, LO.debug
        ? 'Debug shelf — one of every mod, never used up'
        : 'Collected mods' + (LO.bag.length ? '' : ' — none yet, find them in the cave')),
      canEdit && !LO.debug && LO.bag.length > 1 ? h('button', { className: 'sortBag',
          onPointerDown: e => { e.preventDefault(); sortBag(); } }, 'Sort') : null),
    h(ScrollBox, { cls: 'bag' + (LO.debug ? ' debug' : ''), drop: 'bag' },
      h('div', { className: 'mgrid' }, bagIds.map((id, i) => tile(id, { type: 'bag', i }, 'b' + i)))
    ),
    h('div', { className: 'info' },
      canEdit
        ? 'Drag a mod to any slot. Tap one to see what it does. Hold a gun to reorder it.'
        : 'Viewing only — reach a shop, or take the Tinker perk, to change your setup. Tap a mod to see what it does.'),
    gdrag && LO.guns[gdrag.from] ? h('div', { className: 'gghost',
      style: { left: gdrag.x, top: gdrag.y } }, LO.guns[gdrag.from].name) : null,
    drag && drag.armed ? h('div', { className: 'ghost',
      style: { left: drag.x, top: drag.y, borderColor: famCol(drag.id), color: famCol(drag.id) } },
      MODS[drag.id].glyph) : null,
    card
  );
}

// The card that comes up standing on a perk altar, so you know what you're taking before
// you take it. A perk is permanent, so this is the only look you get.
function PerkCard({ id, ingame, flow }) {
  const pk = PERKS[id];
  return h('div', { className: 'pop scroll' + (ingame ? ' ingame' : '') + (flow ? ' flow' : '') },
    h('div', { className: 'phead' },
      h('div', { className: 'pglyph', style: { borderColor: pk.tint, color: pk.tint } }, pk.glyph),
      h('div', { className: 'ptitle' },
        h('b', { style: { color: pk.tint } }, pk.name),
        h('span', null, 'Perk · rest of the run'))),
    h('p', { className: 'pinfo' }, pk.info));
}

// One tweakable value in the dev panel: a labelled number box prefilled with the live
// value, its default shown as the placeholder. Committing an empty box restores the
// default; anything else is parsed, clamped to the knob's range and saved at once.
// A live jellyfish for Dev → Jellyfish colours: the real jellyStep and drawJelly in a
// little walled box — a mossy ledge of floor-1 rock and two hanging vines for its glow and
// plant glow (plantGlowFill) to light, a roam spot circling the middle so it keeps pulsing,
// turning and trailing, a puff of spores on every pulse, and a spit now and then so the
// spit and drip colours show too. Every frame reads DEV, so a change shows at once.
function JellyPreview() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !c.getContext) return;
    const ctx = c.getContext('2d');
    const WU = 110, LEDGE = 8;                          // world units across; rock at the bottom
    const k = enemyFor('meduusa', 1);
    let HU = 60;
    const e = { x: WU / 2, y: 26, hx: WU / 2, hy: 26, r: k.r, phase: 0 };
    const solid = (cx, cy) => cx < 0 || cy < 0 || cx * CELL >= WU || (cy + 1) * CELL > HU - LEDGE;
    let raf, last = performance.now(), t = 0, spitT = 1.2, glob = null;
    const drops = [], spores = [];
    const TH = themeFor(1), sporeCol = rgbA(TH.moss[1]);
    // the art: a ledge with a fringe of moss along its top, and two vines from the roof
    const artC = document.createElement('canvas'), artCtx = artC.getContext('2d', { willReadFrequently: true });
    const glowC = document.createElement('canvas'), glowCtx = glowC.getContext('2d');
    const tufts = Array.from({ length: WU }, () => ({ h: Math.random() < 0.15 ? 0 : 1 + Math.floor(Math.random() * 3), c: Math.random() }));
    const vines = [{ k: 'climb', st: 'vine', x: 11, y: 0, len: 34, seed: 0.37 }, { k: 'climb', st: 'vine', x: WU - 13, y: 0, len: 27, seed: 0.81 }];
    const drop = (x, y, vx, vy, P, g) => { if (drops.length < 120) { const l = 0.5 + Math.random() * 0.5;
      drops.push({ x, y, vx, vy, g, life: l, max: l, c: Math.random() < 0.35 ? P.drip2 : P.drip, s: 1.1 + Math.random() * 0.8 }); } };
    const tick = now => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      const dpr = window.devicePixelRatio || 1, cw = Math.round(c.clientWidth * dpr), ch = Math.round(c.clientHeight * dpr);
      if (!cw || !ch) return;
      if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
      const sc = cw / WU; HU = ch / sc;
      const S = e.je;
      if (S) { S.rx = WU / 2 + Math.cos(t * 0.55) * WU * 0.24; S.ry = (HU - LEDGE) * 0.36 + Math.sin(t * 0.8) * 5; S.roamR = 1e9; S.roamSpd = 0; }
      const pulse = jellyStep(e, { solidCell: solid, hunting: false, goal: null, rnd: Math.random }, dt) === 'pulse';
      const P = jellyPal(e.je.u.col);
      // a puff of spores out of the rim, back the way it pushes (as puffSpores in the game)
      if (pulse) {
        const S2 = e.je, B = jellyBell(e.r, S2.shape, kru('jeSquash', S2.u.sq)), c0 = Math.cos(S2.hd), s0 = Math.sin(S2.hd);
        for (let i = 0, n = Math.round(kr('jeSpores')); i < n && spores.length < 80; i++) {
          const lx = (Math.random() * 2 - 1) * B.rw * 0.7, r = Math.random();
          const a = S2.hd + Math.PI + (Math.random() * 2 - 1) * kr('jeSporeSpread') * Math.PI / 180, v = kr('jeSporeSpd');
          spores.push({ x: e.x - lx * s0 - B.rim * c0, y: e.y + lx * c0 - B.rim * s0, vx: (r - 0.5) * 8, vy: 0, wob: r * 9,
            life: 5 + r * 3, max: 8, kx: Math.cos(a) * v, ky: Math.sin(a) * v, kd: kr('jeSporeDrag') });
        }
      }
      for (let i = spores.length - 1; i >= 0; i--) {
        const q = spores[i];
        q.x += Math.sin(t * 1.3 + q.wob) * 6 * dt + (q.vx + q.kx) * dt; q.y += (q.vy + q.ky) * dt;
        const kk = Math.exp(-q.kd * dt); q.kx *= kk; q.ky *= kk;
        if ((q.life -= dt) <= 0 || q.x < 0 || q.x > WU || q.y < 0 || solid(Math.floor(q.x / CELL), Math.floor(q.y / CELL))) spores.splice(i, 1);
      }
      // a spit from its head across the box, dripping, splatting on whatever it meets
      if ((spitT -= dt) <= 0 && !glob) {
        spitT = 2.2;
        const a = e.je.hd, v = 70;
        glob = { x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r, vx: Math.cos(a) * v, vy: Math.sin(a) * v, da: 0,
          size: kr('jeShotSize'), drip: kr('jeDrip'), g: kr('jeDripG'), n: Math.round(kr('jeSplat')), sv: kr('jeSplatSpd') };
      }
      if (glob) {
        glob.x += glob.vx * dt; glob.y += glob.vy * dt;
        for (glob.da += glob.drip * dt; glob.da >= 1; glob.da--) drop(glob.x, glob.y + glob.size * 0.5, glob.vx * 0.08, 8 + Math.random() * 18, P, glob.g);
        if (solid(Math.floor(glob.x / CELL), Math.floor(glob.y / CELL))) {
          const sp = Math.hypot(glob.vx, glob.vy) || 1;
          for (let i = 0; i < glob.n; i++) {
            const a = Math.random() * 6.28, v = glob.sv * (0.4 + Math.random() * 0.6);
            drop(glob.x - glob.vx * dt, glob.y - glob.vy * dt, Math.cos(a) * v - glob.vx / sp * v * 0.5, Math.sin(a) * v - glob.vy / sp * v * 0.5 - v * 0.3, P, glob.g);
          }
          glob = null;
        }
      }
      for (let i = drops.length - 1; i >= 0; i--) {
        const q = drops[i];
        q.vy += q.g * dt;
        const nx = q.x + q.vx * dt, ny = q.y + q.vy * dt;
        if (solid(Math.floor(nx / CELL), Math.floor(ny / CELL))) { q.vx *= 0.3; q.vy = 0; } else { q.x = nx; q.y = ny; }
        if ((q.life -= dt) <= 0) drops.splice(i, 1);
      }
      // the box: dark water-cave, a ledge of rock, the jelly, its spit, and the glow on top
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0d0f14'; ctx.fillRect(0, 0, cw, ch);
      ctx.setTransform(sc, 0, 0, sc, 0, 0);
      const aw = WU, ah = Math.ceil(HU), top = HU - LEDGE;
      if (artC.width !== aw || artC.height !== ah) { artC.width = aw; artC.height = ah; glowC.width = aw; glowC.height = ah; }
      artCtx.setTransform(1, 0, 0, 1, 0, 0); artCtx.clearRect(0, 0, aw, ah);
      artCtx.fillStyle = 'rgb(62,56,54)'; artCtx.fillRect(0, top, aw, LEDGE + 1);
      artCtx.fillStyle = 'rgb(96,84,74)'; artCtx.fillRect(0, top, aw, 1.2);
      tufts.forEach((q, x) => {
        if (!q.h) return;
        artCtx.fillStyle = rgbA(mix(TH.moss[0], TH.moss[1], q.c)); artCtx.fillRect(x, top - q.h + 1, 1, q.h);
        artCtx.fillStyle = rgbA(TH.moss[1]); artCtx.fillRect(x, top - q.h + 1, 1, 1);
      });
      for (const v of vines) drawProp(artCtx, v, t, TH);
      ctx.imageSmoothingEnabled = false;            // pixel art, like the terrain
      ctx.drawImage(artC, 0, 0);
      drawJelly(ctx, e.x, e.y, e.r, t, 0, false, k.col, e.je);
      if (glob) {
        const z = glob.size;
        ctx.save(); ctx.translate(glob.x, glob.y); ctx.rotate(Math.atan2(glob.vy, glob.vx));
        ctx.fillStyle = P.spitEdge; ctx.beginPath(); ctx.ellipse(0, 0, z * 1.45, z * 1.05, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = P.spit; ctx.beginPath(); ctx.ellipse(-z * 0.08, 0, z * 1.2, z * 0.82, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = P.spitShine; ctx.beginPath(); ctx.arc(z * 0.3, -z * 0.28, z * 0.32, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      for (const q of drops) { ctx.globalAlpha = Math.max(0, q.life / q.max); ctx.fillStyle = q.c; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      const u = e.je.u, a = kru('jeGlow', u.glow) * (1 + kru('jeFlare', u.flare) * e.je.shape), rgb = hexRgb(P.glow);
      glowAt(ctx, e.x, e.y, kru('jeGlowR', u.glowR), a, rgb);
      glowAt(ctx, e.x, e.y, e.r * 1.6, a * 1.4, rgb);
      if (glob) glowAt(ctx, glob.x, glob.y, glob.size * 6, 0.3, rgb);
      ctx.fillStyle = sporeCol;
      for (const q of spores) { ctx.globalAlpha = Math.min(1, q.life / (q.max * 0.3)); ctx.fillRect(q.x - 0.65, q.y - 0.65, 1.3, 1.3); }
      ctx.globalAlpha = 1;
      // the plant glow: the same comp the game runs, on this box's own art
      const art = artCtx.getImageData(0, 0, aw, ah).data;
      const white = plantWhite(art);                 // the box's own brightest green
      const reach = kru('jeGlowR', u.glowR) * kru('jePlantReach', u.plant), out = glowCtx.createImageData(aw, ah);
      if (reach > 2 && plantGlowFill(out.data, art, aw, ah, { ox: 0, oy: 0, px: 1, cx: e.x, cy: e.y, reach, white,
        top: kru('jePlantTop', u.plant) / 100, strength: kru('jePlantGlow', u.plant), t: t * kru('jePlantTwinkle', u.plant),
        size: kru('jePlantSize', u.plant), rgb: hexArr(P.glow) })) {
        glowCtx.putImageData(out, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(glowC, 0, 0);
      }
      ctx.globalCompositeOperation = 'source-over';
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return h('canvas', { ref, className: 'jellyprev' });
}

function DevRow({ meta }) {
  const [val, setVal] = useState(String(DEV[meta.k]));
  if (meta.type === 'slider') {
    // a slider: changes live as you drag, the number beside the label; ↺ puts the default back
    const set = v => { devSet(meta.k, v); setVal(String(v)); };
    return h('div', { className: 'devrow' },
      h('label', null, meta.label, h('span', { className: 'devval' }, String(DEV[meta.k]))),
      h('input', { type: 'range', min: meta.min, max: meta.max, step: meta.step, value: DEV[meta.k],
        onChange: e => set(parseFloat(e.target.value)) }),
      h('button', { className: 'devreset', 'aria-label': 'Default', onPointerDown: () => set(DEV_DEFAULTS[meta.k]) }, '↺'));
  }
  if (meta.type === 'color') {
    // a colour: changes live as you pick; ↺ puts the default back
    const set = v => { devSet(meta.k, v); setVal(v); };
    return h('div', { className: 'devrow' },
      h('label', null, meta.label),
      h('input', { type: 'color', value: DEV[meta.k], onChange: e => set(e.target.value) }),
      h('button', { className: 'devreset', 'aria-label': 'Default', onPointerDown: () => set(DEV_DEFAULTS[meta.k]) }, '↺'));
  }
  const commit = () => {
    const s = val.trim();
    let v;
    if (s === '') v = DEV_DEFAULTS[meta.k];
    else { v = parseFloat(s); if (!isFinite(v)) { setVal(String(DEV[meta.k])); return; } }
    v = Math.max(meta.min, Math.min(meta.max, v));
    devSet(meta.k, v);
    setVal(String(v));
  };
  return h('div', { className: 'devrow' },
    h('label', null, meta.label),
    h('input', { type: 'number', inputMode: 'decimal', step: meta.step,
      value: val, placeholder: String(DEV_DEFAULTS[meta.k]),
      onChange: e => setVal(e.target.value),
      onBlur: commit,
      onKeyDown: e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } } })
  );
}

// The dev window: it pauses the run but the game keeps drawing behind a light backdrop,
// so the look-of-it knobs (zoom, torch, fog) preview live as you type. Holds the toggle
// buttons — "All mods" is the old DEBUG shelf — and the saved, persisted variables.
function DevPanel({ input, refresh, close, onRestart, onSpawnGun }) {
  const LO = input.current.loadout;
  const [, bump] = useState(0);
  const [copied, setCopied] = useState(null);     // null, or the text + whether it copied
  // which groups are open: remembered on this device only, all shut the first time
  const [openG, setOpenG] = useState(() => { try { return JSON.parse(localStorage.getItem('caverunner-devgroups')) || {}; } catch (_) { return {}; } });
  const toggleG = g => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // commit a half-typed box
    const o = Object.assign({}, openG, { [g]: !openG[g] });
    setOpenG(o);
    try { localStorage.setItem('caverunner-devgroups', JSON.stringify(o)); } catch (_) {}
  };
  const copyAll = () => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // commit a half-typed box
    const text = devReport();
    const fallback = () => {
      let ok = false;
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
      } catch (_) {}
      setCopied({ text, ok });
    };
    try {
      navigator.clipboard.writeText(text).then(() => setCopied({ text, ok: true }), fallback);
    } catch (_) { fallback(); }
  };
  return h('div', { className: 'devwrap' },
    h('div', { className: 'devback', onPointerDown: e => { e.preventDefault(); close(); } }),
    h('div', { className: 'devpanel scroll' },
      h('div', { className: 'devhead' },
        h('h2', null, 'Dev'),
        h('button', { className: 'done', onPointerDown: e => { e.preventDefault(); close(); } }, 'Done')),
      h('div', { className: 'devbtns' },
        h('button', { className: 'dbg' + (LO.debug ? ' on' : ''),
          onPointerDown: e => { e.preventDefault(); LO.debug = !LO.debug; refresh(); bump(n => n + 1); } },
          'All mods'),
        h('button', { className: 'dbg restart',
          onPointerDown: e => { e.preventDefault(); onRestart(); } }, 'Restart run'),
        h('button', { className: 'dbg spawngun',
          onPointerDown: e => { e.preventDefault(); onSpawnGun(); } }, 'Spawn gun'),
        h('button', { className: 'dbg newcave',
          onPointerDown: e => { e.preventDefault(); input.current.newCave = true; close(); } }, 'New cave')),
      DEV_GROUPS.map(([g, name]) => {
        const shut = !openG[g];
        return h('div', { key: g, className: 'devgroup' },
          g === 'jellycol' ? h(JellyPreview) : null,          // the live jelly its colours paint
          h('button', { className: 'devghead' + (shut ? '' : ' open'), 'data-g': g,
            onPointerDown: e => { e.preventDefault(); toggleG(g); } },
            h('span', { className: 'devcaret' }, shut ? '▸' : '▾'), name),
          shut ? null : h('div', { className: 'devvars' },
            DEV_META.filter(m => m.g === g).map(m => h(DevRow, { key: m.k, meta: m }))));
      }),
      h('p', { className: 'devnote' },
        'Values save on their own and stick across reloads and sessions. Leave a box empty to put its default back.'),
      h('button', { className: 'dbg devcopy', onPointerDown: e => { e.preventDefault(); copyAll(); } },
        'Copy all dev settings to clipboard'),
      copied ? h('p', { className: 'devnote' }, copied.ok ? 'Copied — paste it to Claude.'
        : 'Could not reach the clipboard — press and hold the text below to copy it.') : null,
      copied && !copied.ok ? h('textarea', { className: 'devcopytext', readOnly: true, value: copied.text }) : null
    )
  );
}

function SpawnGun({ input, close }) {
  const [lvl, setLvl] = useState(String(input.current.floor || 1));
  const spawn = () => {
    input.current.spawnGun = Math.max(1, Math.floor(Number(lvl) || 1));
    close();
  };
  return h('div', { className: 'devwrap' },
    h('div', { className: 'devback', onPointerDown: e => { e.preventDefault(); close(); } }),
    h('div', { className: 'devpanel spawnpanel' },
      h('div', { className: 'devhead' },
        h('h2', null, 'Spawn gun'),
        h('button', { className: 'done', onPointerDown: e => { e.preventDefault(); close(); } }, 'Cancel')),
      h('div', { className: 'devrow' },
        h('label', null, 'Level'),
        h('input', { className: 'spawnlvl', type: 'number', min: 1, inputMode: 'numeric', value: lvl,
          onChange: e => setLvl(e.target.value) })),
      h('button', { className: 'dbg spawngo', onPointerDown: e => { e.preventDefault(); spawn(); } }, 'Spawn')));
}

// ---- the death replay's screen ("Witness yourself"): the recorded scene fills the view — drag
// to pan, pinch (or the wheel) to zoom — with a scrub bar and the controls along the bottom.
// The Game draws it (drawReplay); this only moves input.current.replay's clock and camera.
const RP_SPEEDS = [0.25, 0.5, 1, 2];
function Witness({ input, close }) {
  const V = input.current.replay, W = input.current.witness;
  const [, bump] = useState(0);
  const redo = () => bump(n => n + 1);
  const scrub = useRef(null), pts = useRef(new Map()), pinch = useRef(null), dragging = useRef(false);
  useEffect(() => {                  // the clock and the scrub bar follow the playback
    let raf, last = '';
    const tick = () => {
      const sig = Math.round(V.t * 20) + (V.playing ? 'p' : '');
      if (sig !== last) { last = sig; redo(); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const span = Math.max(0.01, W.t1 - W.t0);
  const seek = e => {
    const r = scrub.current.getBoundingClientRect();
    V.t = W.t0 + clamp((e.clientX - r.left) / r.width, 0, 1) * span;
    V.playing = false; redo();
  };
  // the scene: one finger (or the mouse) drags the camera, two pinch-zoom and drag
  const down = e => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinch.current = null;
  };
  const move = e => {
    const P = pts.current, q = P.get(e.pointerId);
    if (!q) return;
    const u = V.unit || 1;
    if (P.size === 1) { V.cx -= (e.clientX - q.x) / u; V.cy -= (e.clientY - q.y) / u; V.follow = false; }
    q.x = e.clientX; q.y = e.clientY;
    if (P.size >= 2) {
      const [a, b] = [...P.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, L = pinch.current;
      if (L) {
        V.zoom = clamp(V.zoom * d / L.d, 0.4, 4);
        V.cx -= (mx - L.mx) / u; V.cy -= (my - L.my) / u; V.follow = false;
      }
      pinch.current = { d, mx, my };
    }
    if (!V.follow) redo();
  };
  const up = e => { pts.current.delete(e.pointerId); pinch.current = null; };
  const tap = f => e => { e.preventDefault(); f(); redo(); };
  const rel = V.t - W.death, frac = (V.t - W.t0) / span;
  const atEnd = V.t >= W.t1 - 1e-6;
  return h('div', { className: 'witness' },
    h('div', { className: 'wscene', onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up,
        onWheel: e => { V.zoom = clamp(V.zoom * Math.exp(-e.deltaY * 0.0015), 0.4, 4); } },
      h('div', { className: 'wtitle' }, 'WITNESS YOURSELF')),
    h('div', { className: 'wpanel', ref: el => { if (el) V.panelH = el.getBoundingClientRect().height; } },
      h('div', { className: 'wscrub', ref: scrub,
          onPointerDown: e => { e.preventDefault(); dragging.current = true;
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} seek(e); },
          onPointerMove: e => { if (dragging.current) seek(e); },
          onPointerUp: () => { dragging.current = false; }, onPointerCancel: () => { dragging.current = false; } },
        h('div', { className: 'wtrack' }),
        h('div', { className: 'wfill', style: { width: (frac * 100) + '%' } }),
        h('div', { className: 'wdeath', title: 'The moment you died',
          style: { left: ((W.death - W.t0) / span * 100) + '%' } }),
        h('div', { className: 'wthumb', style: { left: (frac * 100) + '%' } })),
      h('div', { className: 'wrow' },
        h('button', { className: 'wfirst', 'aria-label': 'Back to the start',
          onPointerDown: tap(() => { V.t = W.t0; V.playing = true; }) }, '⏮'),
        h('button', { className: 'wplay', 'aria-label': V.playing ? 'Pause' : 'Play',
          onPointerDown: tap(() => { if (!V.playing && atEnd) V.t = W.t0; V.playing = !V.playing; }) },
          V.playing ? '⏸' : '▶'),
        RP_SPEEDS.map(sp => h('button', { key: sp, className: 'wspeed' + (V.speed === sp ? ' on' : ''),
          onPointerDown: tap(() => { V.speed = sp; }) }, (sp < 1 ? String(sp).slice(1) : sp) + '×')),
        h('span', { className: 'wtime' }, (rel < 0 ? '−' : '+') + Math.abs(rel).toFixed(1) + 's')),
      h('div', { className: 'wrow' },
        h('button', { className: 'wloop' + (V.loop ? ' on' : ''), onPointerDown: tap(() => { V.loop = !V.loop; }) }, 'Loop'),
        h('button', { className: 'wfog' + (V.fog ? ' on' : ''), onPointerDown: tap(() => { V.fog = !V.fog; }) }, 'Fog'),
        h('button', { className: 'wfollow' + (V.follow ? ' on' : ''), onPointerDown: tap(() => { V.follow = true; V.zoom = 1; }) },
          'Follow'),
        h('button', { className: 'wclose', onPointerDown: e => { e.preventDefault(); close(); } }, 'Close'))));
}

function App() {
  const blank = () => ({ active: false, nx: 0, ny: 0, mag: 0, dy: 0, on: false });
  const [saved] = useState(loadSave);      // last session's run, if there is one
  const input = useRef({
    left: blank(), right: blank(),
    loadout: saved ? saved.loadout : { guns: startingGuns(), bag: [], sel: 0, gold: START_GOLD, debug: false,
      perks: [], maxBonus: 0, usedLives: 0 },
    saved,                      // handed to Game once, to rebuild the floor
    paused: false, notify: () => {}, inShop: true, prompt: null, interact: false, sig: '',
    found: null,                // a gun on the ground, waiting on the swap chooser
    confirmAct: null, confirmAim: null,   // legacy hooks still read (harmlessly) by Stick
    pendingToast: null,         // raised while paused, shown by the loop when it resumes
    keys: { w: false, a: false, s: false, d: false },
    mouse: { x: 0, y: 0, inside: false, down: false },
  });
  const [size, setSize] = useState(150);
  const [vw, setVw] = useState(window.innerWidth);
  const [mapOpen, setMapOpen] = useState(false);
  const ctlRef = useRef(null);
  const [run, setRun] = useState(0);
  const [edit, setEdit] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [witnessOpen, setWitnessOpen] = useState(false);
  const [gunInfo, setGunInfo] = useState(-1);
  const [held, setHeld] = useState(-1);
  // null when closed; a timestamp (from the tap that opened it) while open, so
  // the Restart button's own tap can't also land on the Yes button underneath —
  // see the guard on the confirm button below
  const [confirmAt, setConfirmAt] = useState(null);
  const [, bump] = useState(0);
  const refresh = () => bump(n => n + 1);
  input.current.notify = refresh;
  const found = input.current.found;
  input.current.mapOpen = mapOpen;
  input.current.paused = edit || !!found || devOpen || spawnOpen || mapOpen || witnessOpen;

  const LO = input.current.loadout;
  // read through the ref: after a Restart the loadout object is replaced, and a
  // handler that closed over the old one silently edits a discarded loadout
  const select = i => {
    const L = input.current.loadout;
    if (L.guns[i]) { if (L.sel !== i) SFX.fx('switch'); L.sel = i; refresh(); }
  };
  const restart = () => {
    clearSave();
    input.current.saved = null;
    input.current.loadout = { guns: startingGuns(), bag: [], sel: 0, gold: START_GOLD, debug: false,
      perks: [], maxBonus: 0, usedLives: 0 };
    input.current.sig = '';
    input.current.found = null;
    input.current.witness = null; input.current.replay = null;
    setWitnessOpen(false);
    setGunInfo(-1);
    setEdit(false);
    setRun(r => r + 1);
  };
  // the game loop calls this when you tap the right stick on the death screen
  input.current.requestRestart = restart;

  useEffect(() => {
    // the circles are as big as two of them side by side will go: width is the binding
    // constraint on a phone, not height
    const fit = () => {
      // back to the size these were: the complaint was about the knob inside them, not
      // the pad. The -28 rather than -36 is because they are border-box now, which buys
      // the toolbar its 4px back and then some.
      setSize(Math.max(80, Math.floor(Math.min((window.innerWidth - 28) / 2, window.innerHeight * 0.28))));
      setVw(window.innerWidth);
    };
    fit();
    window.addEventListener('resize', fit);
    // the game frames itself to the area above the controls, so tell it how tall they are
    const ro = new ResizeObserver(() => {
      if (ctlRef.current) input.current.ctlH = ctlRef.current.getBoundingClientRect().height;
    });
    if (ctlRef.current) { ro.observe(ctlRef.current); input.current.ctlH = ctlRef.current.getBoundingClientRect().height; }
    return () => { window.removeEventListener('resize', fit); ro.disconnect(); };
  }, []);

  useEffect(() => {
    const stop = e => { if (!e.target.closest || !e.target.closest('.scroll')) e.preventDefault(); };
    // in an embedded preview the page starts without keyboard focus, so the number
    // keys go nowhere until something in here is touched
    const grab = () => { try { window.focus(); } catch (_) {} SFX.unlock(); };
    grab();
    document.addEventListener('pointerdown', grab, true);
    document.addEventListener('contextmenu', stop);
    document.addEventListener('touchmove', stop, { passive: false });

    const map = { w: 'w', arrowup: 'w', ' ': 'w', a: 'a', arrowleft: 'a', s: 's', arrowdown: 's', d: 'd', arrowright: 'd' };
    const key = down => e => {
      // never let the game read keys meant for a text field, like the dev panel's inputs
      const t = e.target;
      if (t && /^(input|textarea|select)$/i.test(t.tagName)) return;
      const k = e.key.toLowerCase();
      if (map[k]) { input.current.keys[map[k]] = down; e.preventDefault(); }
      if (!down) return;
      SFX.unlock();
      if (k >= '1' && k <= '4') select(Number(k) - 1);
      if (k === 'e' || k === 'tab') { e.preventDefault();
        if (input.current.inShop || perkBag(input.current.loadout.perks || []).tinker) setEdit(v => !v); }
      if (k === 'f') input.current.interact = true;
      if (k === 'm') setMapOpen(v => !v);
      if (k === 'escape') setEdit(false);
    };
    const kd = key(true), ku = key(false);
    const blur = () => {
      Object.keys(input.current.keys).forEach(k => { input.current.keys[k] = false; });
      input.current.mouse.down = false;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    return () => {
      document.removeEventListener('pointerdown', grab, true);
      document.removeEventListener('contextmenu', stop);
      document.removeEventListener('touchmove', stop);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const prompt = input.current.prompt;
  const inShop = input.current.inShop;
  const perkB = perkBag(LO.perks || []);
  const canEdit = inShop || perkB.tinker;      // Tinker with Wands Everywhere frees the editor
  const heldGun = input.current.loadout.guns[input.current.loadout.sel];
  const deck = deckLayout(vw, size, LO.guns.length);
  const btnAt = pt => ({ width: deck.btn, height: deck.btn,
    left: Math.round(pt.x - deck.btn / 2), top: Math.round(pt.y - deck.btn / 2) });

  // the death replay: offered once the recording has run on past the death (input.current.witness)
  const witness = input.current.witness;
  const openWitness = () => {
    input.current.replay = { t: witness.t0, speed: 1, playing: true, loop: true, fog: true, follow: true, zoom: 1, cx: 0, cy: 0, unit: 1 };
    setWitnessOpen(true);
  };
  const closeWitness = () => { input.current.replay = null; setWitnessOpen(false); };

  return h('div', { className: 'app' + (witnessOpen ? ' witnessing' : '') },
    h('div', { className: 'view' },
      h(Game, { key: run, input }),
      witness && !witnessOpen ? h('button', { className: 'witnessbtn',
        onPointerDown: e => { e.preventDefault(); openWitness(); } }, 'WITNESS YOURSELF') : null,
      witnessOpen && witness ? h(Witness, { input, close: closeWitness }) : null,
      // The item's card and its buy/take line are one panel now, grown up from the
      // bottom: the info you're reading and the price you're paying sit together.
      // The panel is pointer-events:none so a tap still reaches the sticks underneath;
      // buying and taking a mod is a tap on the right stick's dead zone (or the f key),
      // taken straight. A gun on the ground opens the swap chooser instead, so the panel
      // hides while that is up (the game pauses behind it).
      prompt && !found ? h('div', { className: 'buypanel',
        style: { bottom: (input.current.promptBottom || 12) + 'px',
          maxHeight: 'calc(100% - ' + ((input.current.promptBottom || 12) + 12) + 'px)' } },
        prompt.id ? h(ModCard, { id: prompt.id, ingame: true }) : null,
        prompt.perk ? h(PerkCard, { id: prompt.perk, ingame: true }) : null,
        prompt.gun ? h(GunCard, { gun: prompt.gun, label: prompt.found ? 'Found' : 'For sale',
          ingame: true, compare: heldGun, compareName: heldGun ? heldGun.name : '' }) : null,
        // shop stock is "Buy <price>"; anything you pick up for free is just "Take" —
        // the card above already names it, so a nameless item (the heal) shows its name here.
        h('div', { className: 'pbuy' + (prompt.can ? '' : ' cant'),
            'aria-label': 'Tap the right stick to ' + (prompt.price ? 'buy for ' + prompt.price + 'g' : 'take') },
          h(RKey),
          h('b', null, prompt.price ? prompt.price + 'g'
            : (prompt.id || prompt.gun || prompt.perk || prompt.heart) ? 'free' : prompt.text))) : null,
      // one gear in the top-right opens the Dev panel; Restart now lives inside it.
      h('button', { className: 'devbtn', title: 'Dev tools',
        onPointerDown: e => { e.preventDefault(); setDevOpen(true); } }, '⚙️'),
      confirmAt != null ? h('div', { className: 'confirm' },
        h('div', { className: 'shade', onPointerDown: e => { e.preventDefault(); setConfirmAt(null); } }),
        h('div', { className: 'confirmCard' },
          h('p', null, 'Restart the run? You’ll lose your guns and mods.'),
          h('div', { className: 'confirmRow' },
            h('button', { className: 'cancel',
              onPointerDown: e => { e.preventDefault(); setConfirmAt(null); } }, 'Cancel'),
            h('button', { className: 'go',
              onPointerDown: e => {
                e.preventDefault();
                // the tap that opened this dialog can land here too, on some devices,
                // as a second pointerdown a moment later — ignore anything that close
                // to the open so that one tap can never both open and confirm
                if (performance.now() - confirmAt < 400) return;
                setConfirmAt(null);
                restart();
              } }, 'Yes, restart')))) : null
    ),
    h('div', { className: 'controls', ref: ctlRef },
      (LO.perks && LO.perks.length)
        ? h('div', { className: 'perkrow' },
            LO.perks.map((id, i) => PERKS[id] ? h('span', {
                key: i, className: 'perkpip', title: PERKS[id].name,
                style: { color: PERKS[id].tint } }, PERKS[id].glyph) : null))
        : null,
      h('div', { className: 'sticks' },
        h(Stick, { size, kind: 'left', input, refresh }),
        h(Stick, { size, kind: 'right', input, refresh }),
        // gold sits in the gap between the two sticks, down level with their bottom halves.
        // "g" not "gold", and thousands truncate to a "k" (1234 -> 1.2k, 2000 -> 2k).
        h('div', { className: 'gold' }, fmtGold(LO.gold), h('span', null, 'g')),
        // the gun buttons ride an arc round the right stick; tap to hold it, hold for its card
        h('div', { className: 'slots' },
          LO.guns.map((g, i) => h('button', {
              key: i,
              className: 'dbtn slot' + (g ? '' : ' empty') + (i === LO.sel ? ' on' : '') +
                (held === i ? ' holding' : ''),
              style: btnAt(deck.guns[i]),
              title: g ? g.name + ' — hold for details' : 'Empty slot',
              onPointerDown: holdPress(
                () => select(i),
                () => { if (input.current.loadout.guns[i]) setGunInfo(i); },
                on => setHeld(on ? i : -1)),
            }, g ? h(GunIcon, { gun: g }) : null))),
        // the bag mirrors the last gun on the left, and the map toggle sits right above it
        h('button', {
            className: 'dbtn weapon' + (canEdit ? '' : ' locked'), style: btnAt(deck.bag),
            title: canEdit ? 'Bag: guns & mods' : 'Bag: guns & mods (edit in the shop or with Tinker)',
            'aria-label': 'Bag',
            onPointerDown: e => { e.preventDefault(); setMapOpen(false); setEdit(true); } },
          h('span', { className: 'emo' }, '🎒'),
          LO.bag.length ? h('b', { className: 'badge' }, LO.bag.length) : null),
        h('button', {
            className: 'dbtn mapbtn' + (mapOpen ? ' on' : ''), style: btnAt(deck.map),
            title: 'Map', 'aria-label': 'Map',
            onPointerDown: e => { e.preventDefault(); setMapOpen(v => !v); } },
          h('span', { className: 'emo' }, '🗺️'))
      )
    ),
    edit ? h(Editor, { input, refresh, canEdit, close: () => setEdit(false) }) : null,
    devOpen ? h(DevPanel, { input, refresh, close: () => setDevOpen(false),
      onRestart: () => { setDevOpen(false); setConfirmAt(performance.now()); },
      onSpawnGun: () => { setDevOpen(false); setSpawnOpen(true); } }) : null,
    spawnOpen ? h(SpawnGun, { input, close: () => setSpawnOpen(false) }) : null,
    found ? h(GunSwap, { input, refresh, onDone: () => { setGunInfo(-1); refresh(); } }) : null,
    gunInfo >= 0 && LO.guns[gunInfo]
      ? h('div', null,
          h('div', { className: 'shade', onPointerDown: e => { e.preventDefault(); setGunInfo(-1); } }),
          h(GunCard, { gun: LO.guns[gunInfo], label: 'Slot ' + (gunInfo + 1),
            onClose: () => setGunInfo(-1) }))
      : null
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(h(App));
