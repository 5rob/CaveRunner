// The game itself: the canvas component. One closure holds the live level and runs the
// loop (step, draw, cast, bullets, fields, the enemy loop, the recorder); App talks to it
// through the input ref. Phase 3 of REFACTOR.md takes it apart.

import { drawProp, propGlow, rgbA } from '../art/props.js';
import { drawGun, drawGunGlow, drawRunner, drawSconce, drawTorch, glowAt } from '../art/sprites.js';
import { jetPitch } from '../audio/recipes.js';
import { SFX } from '../audio/sfx.js';
import {
  AIM_DEAD, AIR_ACC, BCELL, BH, BW, CELL, CH, CLIMB, COIN_PULL, COL, CW, DEAD, FH, FOG, FOG_U,
  FUEL_DRAIN, FUEL_REGEN, FUEL_RESTART, FW, GRAVITY, GROUND_ACC, JET, JET_ACC, LAMP_REACH, MINI_D,
  MMH, MMW, PATROL_R, PH, PICKUP_COOL, PW, SHOP_FLOOR, SHOP_Y, SIGHT, VIEW_MIN_H, VIEW_W, WALK,
  WEB_HAND, WH, WW
} from '../core/consts.js';
import { angDiff, approach, clamp, hexArr, hexRgb, mix, turn } from '../core/util.js';
import { drawEnemy } from '../creatures/draw.js';
import {
  jellyPal, jellyStep, plantGlowFill, plantWhite, tentacleTouch
} from '../creatures/jelly.js';
import { spiderStep } from '../creatures/spider.js';
import { HUNTERS } from '../data/creatures.js';
import { PERKS } from '../data/perks.js';
import { themeFor } from '../data/themes.js';
import { DEV, jcol, kr, kru, spr } from '../dev/knobs.js';
import {
  RP_AFTER, RP_BEFORE, RP_H, RP_HZ, RP_KEEP, RP_W, rpClone, rpCut, rpFrame, rpMerge, rpPaste
} from '../replay/replay.js';
import { SAVE_KEY } from '../save/save.js';
import { effRecharge, gunPassives, planCast } from '../spells/cast.js';
import { caveGun, gunAccent } from '../spells/guns.js';
import { MODS, VACUUM_WAIT, famCol } from '../spells/mods.js';
import {
  DRIFT_ACC, DRIFT_CHASE, DRIFT_R, bhSp, driftStep, tracePath, wigTurn
} from '../spells/trace.js';
import { PLANTS, archNear } from '../world/decorate.js';
import { FIRE_COLS, fireArea, fireDouse, fireNew } from '../world/fire.js';
import { ROOM_HH, ROOM_HW, makeLevel } from '../world/level.js';
import { VIS_RAYS, fogReveal, fogStart, nestFog, visPoly } from '../world/vision.js';
import { builtAt } from '../world/zones.js';
import { puffSpores } from './systems/ambience.js';
import { critRoll, explodeCross, shove, spray, teleportTo } from './systems/bullets.js';
import { damageEnemy, fireEnemyShot } from './systems/enemies.js';
import { fieldPayload } from './systems/fields.js';
import { fireBlast, fireFrame, ignite, setAlight, youAlight } from './systems/fire.js';
import { fogLit, paintFog, roomSeen, seenAt } from './systems/fog.js';
import { cast, firePayload } from './systems/gun.js';
import { addArc, jag, lightningStep } from './systems/lightning.js';
import { burst, goo, splat, toast } from './systems/particles.js';
import { hurt, maxHp, refreshBag } from './systems/player.js';
import { decorStep } from './systems/props.js';
import { onWebIn, ratFrame, spawnRat } from './systems/rats.js';
import { glowDot, rnd, shotBounce, shotDeath, shotGrind, shotTrail } from './systems/shotlooks.js';
import {
  boxHit, dig, enemyAt, explode, lineOfSight, solidAt, solidCell
} from './systems/terrain.js';
import { webNear } from './systems/webs.js';
import { testHook } from './testhook.js';
import { makeWorld } from './world.js';

// Game is layer 5 and may not import from ui/ (layer 6), so it takes its React helpers
// straight off the global React, as ui/h.js does (REFACTOR.md, D13).
const { useRef, useEffect } = React;
const h = React.createElement;

// Near the bottom of the tank the jet coughs: short random cut-outs, more often and a touch
// longer the closer the tank is to dry. `st` keeps the cut-out clock and how long the jet
// has been held on (which bends its pitch). Returns true while it's cut out; `st.start`
// is true on the frame a cut-out begins.
export const SPUTTER_FUEL = 0.25;
export function sputterStep(st, dt, fuel, on, rnd) {
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
export const NO_INPUT = { active: false, nx: 0, ny: 0, mag: 0, dy: 0, on: false };

export function Game({ input }) {
  const cv = useRef(null);
  useEffect(() => {
    const W = makeWorld();                           // the live level (game/world.js)
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
    // the minimap: an MMW x MMH canvas of white cave outlines, smooth-scaled into the
    // bottom-left of the view. miniEdgeIdx lists the wall-outline cells (static per floor);
    // each frame only the ones the fog has revealed are painted white, the rest cleared.
    const miniC = document.createElement('canvas');
    miniC.width = MMW; miniC.height = MMH;
    const mctx = miniC.getContext('2d');
    const miniImg = new ImageData(MMW, MMH);
    const mini32 = new Uint32Array(miniImg.data.buffer);

    const natural = (x, y) => !builtAt(W.zone, x, y);      // jellies keep to the natural zones

    // ---- level decoration (see DECOR): the decoration layer's canvas and the plant glow's
    // scratch. The props, their particles, decorStep's counters and what they did to you are in W.
    let pgArt = null, pgC = null, pgCtx = null;   // the jellies' plant glow (plantGlow)
    const decoC = document.createElement('canvas');
    decoC.width = CW; decoC.height = CH;
    const dctx = decoC.getContext('2d');
    const aimPath = [];                              // scratch buffer for the aim line

    // The torch hand: whichever one the gun is not in, so the two never sit on top of
    // each other. Aiming behind you swaps hands, the same way the gun does.
    const torchHand = () => {
      const a = W.p.aim.show ? W.p.aim.nx : W.p.face;
      return { x: W.p.x + PW / 2 + (a >= 0 ? -5.5 : 5.5), y: W.p.y + 9 };
    };

    let raf, last = performance.now();

    // ---- the death replay's recorder (see RP_HZ) ----
    // REC.snaps: what draw() reads round you, RP_HZ a second. Terrain: tBase/dBase are the rock
    // and decoration pixels as of the oldest snapshot, patches the rectangles changed since
    // (caught by wrapping the two canvases' putImageData, which every dig/blast/burn goes
    // through). Fog: fogBase + fogLog (time, cell, value). While you're alive only the last
    // RP_KEEP seconds are kept (older patches fold into the base); from the death it runs
    // RP_AFTER more seconds and stops.
    const RP_ARR = { bullets: W.bullets, enemyShots: W.enemyShots, smoke: W.smoke, sparks: W.sparks, flashes: W.flashes, coins: W.coins, fields: W.fields, beams: W.beams, arcs: W.arcs, torchP: W.torchP, motes: W.motes,
      burns: W.burns, webs: W.webs, silk: W.silk, strings: W.strings, dparts: W.dparts, amb: W.amb, clouds: W.clouds, rings: W.rings, devils: W.devils };
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
      REC.tBase = W.img.data.slice(); REC.dBase = W.dimg ? W.dimg.data.slice() : null;
      REC.fogBase = W.seen.slice(); REC.fogPrev = W.seen.slice();
      REC.deathT = -1; REC.done = false;
      RT.n = 0; RT.at = -1;
      input.current.witness = null;
    }
    function recSample() {
      const pcx = W.p.x + PW / 2, pcy = W.p.y + PH / 2;
      const grab = (list, m, ty) => {
        const out = [];
        for (const o of list) {
          const x = o.x !== undefined ? o.x : o.a0x !== undefined ? o.a0x : o.ax;
          const y = ty && o[ty] !== undefined ? o[ty] : o.y !== undefined ? o.y : o.a0y !== undefined ? o.a0y : o.ay;
          if (x === undefined || (Math.abs(x - pcx) < RP_W + m && Math.abs(y - pcy) < RP_H + m)) out.push(rpClone(o, idOf(o)));
        }
        return out;
      };
      const S = { t: REC.t, time: W.time, flick: W.flick, leanX: W.leanX, leanY: W.leanY, glowN: W.glowN, fireN: W.fireN, p: rpClone(W.p),
        ghost: W.ghost ? rpClone(W.ghost) : null };
      for (const k in RP_ARR) S[k] = grab(RP_ARR[k], 40);
      S.enemies = grab(W.enemies, 40, 'ty'); S.pickups = grab(W.pickups, 40); S.props = grab(W.props, 120);
      // the burning pixels in the box, and how much fuel each has left
      const fi = [];
      for (const i of W.fire.list) {
        const x = (i % CW) * CELL, y = ((i / CW) | 0) * CELL;
        if (Math.abs(x - pcx) < RP_W && Math.abs(y - pcy) < RP_H) fi.push(i);
      }
      S.fire = Int32Array.from(fi);
      S.fireT = Uint16Array.from(fi, i => W.fire.t[i]);
      REC.snaps.push(S);
      // terrain changed since the last snapshot, as it stands now
      if (REC.dirty.length) {
        for (const [w, x, y, ww, hh] of rpMerge(REC.dirty, CW, CH)) {
          const src = w === 't' ? W.img : W.dimg;
          if (src) REC.patches.push({ t: REC.t, c: w, x, y, w: ww, h: hh, px: rpCut(src.data, CW, x, y, ww, hh) });
        }
        REC.dirty.length = 0;
      }
      for (let i = 0; i < W.seen.length; i++)
        if (W.seen[i] !== REC.fogPrev[i]) { REC.fogLog.push(REC.t, i, W.seen[i]); REC.fogPrev[i] = W.seen[i]; }
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
      if (W.p.dead && REC.deathT < 0) REC.deathT = REC.t;
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
    // the fire's dirty boxes on the two terrain canvases (put back once a frame, see flushFire)
    const fireBox = { t: [CW, CH, -1, -1], d: [CW, CH, -1, -1] };
    // a spider's web line under a rat's feet counts as ground: rats run along webs
    const ratOnWeb = onWebIn(W.webs);
    // what the systems (game/systems/) need that isn't world state (REFACTOR.md, D16): the
    // React bridge, the canvases (tctx and dctx are the recorder's wrapped ones), the recorder,
    // the fire's dirty boxes and the rats' web test
    const G = { input, c, ctx, terrain, tctx, bg, bgctx, fogC, fctx, fogImg, fogBlurC, fbctx,
      miniC, mctx, miniImg, mini32, decoC, dctx, REC, RT, fireBox, ratOnWeb };
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
      const wit = input.current.witness;
      V.t = clamp(V.t, wit.t0, wit.t1);
      const F = rpFrame(REC.snaps, V.t);
      rpTerrain(V.t);
      if (!V.fog) RT.fog.fill(1);          // fog off: everything counts as seen, and no overlay
      if (V.follow) { V.cx = F.p.x + PW / 2; V.cy = F.p.y + PH / 2; }
      const near = F.near;
      for (let k = 0; k < near.fire.length; k++) RT.fireT[near.fire[k]] = near.fireT[k];
      // swap the recording in
      const keepL = {};
      for (const k in RP_ARR) { const L = RP_ARR[k]; keepL[k] = L.splice(0, L.length, ...F[k]); }
      const keep = { enemies: W.enemies, pickups: W.pickups, props: W.props, fire: W.fire, firePlants: W.firePlants, seen: W.seen, ghost: W.ghost, time: W.time, flick: W.flick, leanX: W.leanX, leanY: W.leanY, glowN: W.glowN,
        fireN: W.fireN, camX: W.camX, camY: W.camY, unitPx: W.unitPx, torchR: W.torchR, visPts: W.visPts, viewW: W.viewW, viewH: W.viewH, p: Object.assign({}, W.p) };
      W.enemies = F.enemies; W.pickups = F.pickups; W.props = F.props; W.firePlants = [];
      W.fire = { list: near.fire, t: RT.fireT }; W.seen = RT.fog;
      W.ghost = F.ghost; W.time = F.time; W.flick = F.flick; W.leanX = F.leanX; W.leanY = F.leanY; W.glowN = F.glowN; W.fireN = near.fireN;
      Object.assign(W.p, F.p);
      RPV = V;
      try { draw(); } finally {
        // and the live world back, exactly as it was
        RPV = null;
        for (const k in RP_ARR) { const L = RP_ARR[k]; L.splice(0, L.length, ...keepL[k]); }
        ({ enemies: W.enemies, pickups: W.pickups, props: W.props, fire: W.fire, firePlants: W.firePlants, seen: W.seen, ghost: W.ghost, time: W.time, flick: W.flick, leanX: W.leanX, leanY: W.leanY, glowN: W.glowN,
          fireN: W.fireN, camX: W.camX, camY: W.camY, unitPx: W.unitPx, torchR: W.torchR, visPts: W.visPts, viewW: W.viewW, viewH: W.viewH } = keep);
        Object.assign(W.p, keep.p);
        for (let k = 0; k < near.fire.length; k++) RT.fireT[near.fire[k]] = 0;
      }
    }

    // a floor is a fresh cave with its own shop at the bottom; you keep everything else
    // `back` is a saved cave to rebuild (same seed, same perks owned on the way in), with
    // what was already taken, sold and killed stripped back out of it
    function enterLevel(back) {
      refreshBag(W, G);
      W.levelSeed = back ? back.seed : 1 + Math.floor(Math.random() * 2147483000);
      W.levelOwned = back ? back.owned : (input.current.loadout.perks || []).slice();
      const level = makeLevel(W.levelSeed, W.floor, W.levelOwned);
      level.enemies.forEach((e, i) => { e.sid = i; });
      if (back) {
        if (back.alive) { const live = new Set(back.alive); level.enemies = level.enemies.filter(e => live.has(e.sid)); }
        back.sold.forEach(i => { if (level.stock[i]) level.stock[i].sold = true; });
        back.rooms.forEach(i => { if (level.rooms && level.rooms[i]) level.rooms[i].taken = true; });
        if (back.pickups) level.pickups = back.pickups;
      }
      W.mat = level.mat; W.img = level.img; W.ore = level.ore || null;
      // minimap outlines for this floor: scan the real terrain in MINI_D x MINI_D blocks;
      // a block is an outline if a wall runs through it (it holds both rock and open), which
      // traces the cave walls continuously at a much finer grain than the fog grid.
      W.miniEdgeIdx = [];
      for (let my = 0; my < MMH; my++) for (let mx = 0; mx < MMW; mx++) {
        let solid = 0, open = 0;
        for (let dy = 0; dy < MINI_D; dy++) {
          const ty = my * MINI_D + dy;
          if (ty >= CH) break;
          for (let dx = 0; dx < MINI_D; dx++) {
            const tx = mx * MINI_D + dx;
            if (tx >= CW) break;
            if (W.mat[ty * CW + tx]) solid++; else open++;
          }
        }
        if (solid && open) W.miniEdgeIdx.push(my * MMW + mx);
      }
      W.start = level.start; W.portal = level.portal; W.arrival = level.arrival;
      W.enemies = level.enemies; W.pickups = level.pickups; W.stock = level.stock;
      W.rooms = level.rooms || []; W.zone = level.zone || null;
      W.props = level.props || []; W.ambKinds = level.amb || []; W.dimg = level.dimg;
      W.plantW = plantWhite(W.img.data, W.dimg && W.dimg.data);    // the jellies' plant glow keys off this
      dctx.putImageData(W.dimg, 0, 0);
      W.dparts.length = W.amb.length = W.clouds.length = W.rings.length = W.devils.length = 0;
      W.zfx = { slow: 1, slick: 0, climb: null, rev: 0, web: null, webs: 0, webMul: 1 };
      {
        const pcx0 = W.portal.x + W.portal.w / 2, pcy0 = W.portal.y + W.portal.h / 2;
        W.sconces = [[pcx0 - 26, pcy0 - 2], [pcx0 + 26, pcy0 - 2],
          [W.arrival.x - 26, W.arrival.y - 2], [W.arrival.x + 26, W.arrival.y - 2]];
        for (const r of W.rooms) W.sconces.push([r.x - 28, r.y - 2], [r.x + 28, r.y - 2]);
        W.sconces = W.sconces.map(([x, y], i) => ({ x, y, ph: i * 1.7 }));
      }
      W.roster = level.roster; W.themeName = level.theme;
      SFX.setAmbience(W.themeName);
      for (const h of W.bhLoops.values()) h.stop();
      W.bhLoops.clear();
      W.total = W.enemies.length;
      W.ghost = W.pb.ghost ? { x: level.start.x, y: level.start.y, cd: 0 } : null;
      W.burns.length = 0;
      W.webs.length = W.silk.length = W.strings.length = 0;
      // the rat burrows (see ratSolid): each room and tunnel, bar nothing — the hole too
      W.burrow = null; W.navYou.F = null;
      if (level.nests && level.nests.length) {
        W.burrow = new Uint8Array(CW * CH);
        for (const n of level.nests) {
          const mark = (x, y, r) => {
            for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++)
              if (xx >= 0 && yy >= 0 && xx < CW && yy < CH && Math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= r && !W.mat[yy * CW + xx]) W.burrow[yy * CW + xx] = 1;
          };
          mark(n.x + 0.5, n.y + 0.5, n.r + 3);
          for (const q of n.path) mark(q.x + 0.5, q.y + 0.5, 2.6);
        }
      }
      W.fire = fireNew(level.fuel || new Uint8Array(CW * CH));
      W.firePropN = -1;                         // fireFrame lists the plants and carts that burn
      W.p.burn = 0; W.p.burnAcc = 0;
      tctx.putImageData(W.img, 0, 0);
      bgctx.putImageData(level.bgImg, 0, 0);
      W.p.x = W.start.x; W.p.y = W.start.y; W.p.vx = 0; W.p.vy = 0;
      W.p.fuel = 1; W.p.empty = false; W.p.kick = 0;
      W.bullets.length = W.enemyShots.length = W.smoke.length = 0;
      W.sparks.length = W.flashes.length = W.coins.length = W.arcs.length = 0;
      W.torchP.length = 0; W.motes.length = 0;
      W.camReady = false; W.best = 0;
      W.levelT = 0;                             // the floor's name card gets its three seconds
      W.seen = fogStart(); W.deepFog = nestFog(level.nests);
      if (W.pb.seeAll) W.seen.fill(2);            // All-Seeing Eye lights the whole floor
      paintFog(W, G);                             // otherwise every floor starts dark again
      recReset();                             // the death replay starts afresh each floor
      W.matterProps = W.props.filter(pr => pr.k === 'matter');
      // out of the way-in, a moment after the way-out's whump
      setTimeout(() => SFX.fx('portalOut', W.arrival.x, W.arrival.y), 260);
    }

    // ---- autosave: the run as it stands, written every couple of seconds and whenever the
    // app is put away, so closing it mid-floor loses almost nothing. A dead run is wiped. ----
    function saveRun() {
      if (W.p.dead) return;
      const pk = W.pickups.filter(q => !q.taken && (q.kind === 'mod' || q.kind === 'gun'))
        .map(q => (q.kind === 'mod' ? { kind: 'mod', id: q.id, x: q.x, y: q.y, t: q.t }
          : { kind: 'gun', gun: q.gun, x: q.x, y: q.y, t: q.t, old: !!q.old }));
      const data = { ver: VERSION, floor: W.floor, hp: W.p.hp, loadout: input.current.loadout,
        level: { seed: W.levelSeed, owned: W.levelOwned, alive: W.enemies.map(e => e.sid),
          sold: W.stock.map((it, i) => (it.sold ? i : -1)).filter(i => i >= 0),
          rooms: W.rooms.map((r, i) => (r.taken ? i : -1)).filter(i => i >= 0),
          pickups: pk } };
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (_) {}
    }

    // the browser tests' way in (game/testhook.js): only on the test page, which sets the flag
    if (window.__TEST) window.__lvl = testHook(W, { tctx, dctx, paintFog: () => paintFog(W, G), hurt: (n) => hurt(W, G, n), maxHp: () => maxHp(W, G), dig: (x, y, R) => dig(W, G, x, y, R), explode: (x, y, R, splash, hot) => explode(W, G, x, y, R, splash, hot), recSample,
      ignite: (x, y, r, chance) => ignite(W, G, x, y, r, chance), setAlight, youAlight: () => youAlight(W), REC, RT });
    {
      // picking up where the last session left off, if App found a save
      const sv = input.current.saved;
      input.current.saved = null;
      if (sv) {
        W.floor = sv.floor;
        enterLevel(sv.level);
        if (sv.hp) W.p.hp = Math.min(sv.hp, maxHp(W, G));
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

    // The jellyfish's plant glow in the game (the comp is plantGlowFill): the art round a
    // jelly — the rock with its baked moss over the decoration layer, and the hanging plants
    // drawn over both at terrain resolution and read back — keyed, ramped, twinkled and
    // added on top in its colour. Only on ground you've seen.
    const pgGlow = document.createElement('canvas'), pgGlowCtx = pgGlow.getContext('2d');
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
      const plants = W.props.filter(pr => pr.k === 'climb' && PLANTS[pr.st] &&
        pr.x + pr.r > x0w && pr.x + pr.l < x1w && pr.y + pr.b > y0w && pr.y + pr.t0 < y1w);
      if (plants.length) {
        if (!pgC) { pgC = document.createElement('canvas'); pgCtx = pgC.getContext('2d', { willReadFrequently: true }); }
        if (pgC.width < w || pgC.height < h) { pgC.width = Math.max(pgC.width, w); pgC.height = Math.max(pgC.height, h); }
        pgCtx.setTransform(1, 0, 0, 1, 0, 0); pgCtx.clearRect(0, 0, w, h);
        pgCtx.setTransform(1 / CELL, 0, 0, 1 / CELL, -bx0, -by0);
        for (const pr of plants) drawProp(pgCtx, pr, W.time, TH);
        pd = pgCtx.getImageData(0, 0, w, h).data;
      }
      // compose the art: rock over the decoration layer, the plants over both
      const T = W.img.data, D = W.dimg ? W.dimg.data : null, A = pgArt;
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
      if (!plantGlowFill(out.data, A, w, h, { ox: x0w, oy: y0w, px: CELL, cx: e.x, cy: e.y, reach, white: W.plantW,
        top: kru('jePlantTop', u.plant) / 100, strength, t: W.time * kru('jePlantTwinkle', u.plant),
        size: kru('jePlantSize', u.plant), rgb: hexArr(jcol('jeColGlow', u.col)), lit: (x, y) => seenAt(W, x, y) })) return;
      if (pgGlow.width < w || pgGlow.height < h) { pgGlow.width = Math.max(pgGlow.width, w); pgGlow.height = Math.max(pgGlow.height, h); }
      pgGlowCtx.putImageData(out, 0, 0);
      const sm = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(pgGlow, 0, 0, w, h, x0w, y0w, w * CELL, h * CELL);
      ctx.imageSmoothingEnabled = sm;
    }

    function step(dt) {
      W.time += dt;
      W.levelT += dt;
      // a toast raised while the game was paused (picking a mod up, say) waits here,
      // because nothing runs on a paused frame
      if (input.current.pendingToast) { toast(W, input.current.pendingToast); input.current.pendingToast = null; }
      input.current.floor = W.floor;
      if (input.current.newCave) {                // Dev → New cave: this floor again, freshly rolled
        input.current.newCave = false;
        enterLevel();
        toast(W, 'New cave');
        return;
      }
      if (input.current.spawnGun) {               // Dev → Spawn gun: drop one just in front of you
        const gun = caveGun(input.current.spawnGun, Math.random);
        input.current.spawnGun = 0;
        W.pickups.push({ kind: 'gun', x: W.p.x + PW / 2 + W.p.face * 22, y: W.p.y + PH - 9, gun, t: 0 });
        toast(W, 'Spawned ' + gun.name);
      }
      const LO = input.current.loadout;
      // perks: keep the current maximum health honest, wind the shield back up, and never
      // let a shrunken cap (Glass Cannon) leave the bar reading over full
      const MHP = maxHp(W, G);
      if (W.p.hp > MHP) W.p.hp = MHP;
      if (W.pb.shield && !W.p.shieldReady) { W.p.shieldT -= dt; if (W.p.shieldT <= 0) { W.p.shieldReady = true; SFX.fx('shieldUp'); } }
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
      if (W.p.dead) L = NO_INPUT;
      W.p.jx = L.nx; W.p.jy = L.ny;

      // ---- jetpack and fuel ----
      const raw = L.active ? L.mag : 0;
      const mag = raw > DEAD ? (raw - DEAD) / (1 - DEAD) : 0;
      const wantJet = mag > 0 && L.dy < 0;
      if (W.p.empty && W.p.fuel >= FUEL_RESTART) W.p.empty = false;
      const jet = wantJet && !W.p.empty;
      // holding a vine (or chain, root, frozen fall): no jet means you hang on and get your
      // breath back; the stick climbs you up and down
      const climbing = W.zfx.climb && !jet && !W.p.dead;
      W.p.jet = jet ? mag : 0;
      // low on fuel it coughs: the flame, smoke and roar cut out for a blink, you drop a
      // little, and it spits a grey puff
      W.p.sput = sputterStep(W.jetSt, dt, W.p.fuel, jet);
      W.p.flame = W.p.sput ? 0 : W.p.jet;
      if (W.p.sput) W.p.cough = 0.15;
      else W.p.cough = Math.max(0, W.p.cough - dt);
      if (W.jetSt.start) {
        W.p.vy += DEV.sputDip;
        for (let i = 0; i < 3; i++)
          W.smoke.push({ x: W.p.x + PW / 2 + (Math.random() - 0.5) * 6, y: W.p.y + PH + 2,
            vx: (Math.random() - 0.5) * 40, vy: 20 + Math.random() * 30,
            r: 2.5 + Math.random() * 2, life: 0.7 + Math.random() * 0.4, max: 1.1, c: '#6f767e', a: 0.8 });
      }
      if (jet) {
        W.p.fuel -= FUEL_DRAIN * (0.5 + 0.5 * mag) * dt;
        if (W.p.fuel <= 0) { W.p.fuel = 0; W.p.empty = true; }
      } else if (W.p.onGround || climbing) {
        W.p.fuel = Math.min(1, W.p.fuel + FUEL_REGEN * dt);
      }

      // ---- steering ----
      const pcx0 = W.p.x + PW / 2;
      W.p.kick -= dt;
      const k = W.p.kick > 0 ? 0.15 : 1;   // let explosions push you around briefly
      // each spider string on you slows you, and so does each web line you're pushing through
      const tied = W.strings.reduce((m, s) => m * s.slow, 1) * W.zfx.webMul;
      W.webLetGo -= dt;
      if (jet && W.p.sput) {
        // coughing: steer on, but no lift for the blink
        W.p.vx = approach(W.p.vx, L.nx * mag * JET * W.pb.walk * DEV.move * tied, JET_ACC * dt * k);
        W.p.vy = Math.min(W.p.vy + GRAVITY * dt, 900);
      } else if (jet) {
        W.p.vx = approach(W.p.vx, L.nx * mag * JET * W.pb.walk * DEV.move * tied, JET_ACC * dt * k);
        const ty = L.ny * mag * JET * W.pb.jet * DEV.move * tied;    // Faster Levitation lifts harder
        // rising beats a fall instantly (except just after a cough, which it has to climb
        // back out of); only an explosion still throws you around
        if (ty < W.p.vy && W.p.kick <= 0 && W.p.cough <= 0) W.p.vy = ty;
        else W.p.vy = approach(W.p.vy, ty, JET_ACC * dt * k);
        if (W.zfx.rev) W.p.vy -= GRAVITY * W.zfx.rev * dt;          // dark matter lifts you
      } else if (climbing && W.zfx.arch && W.p.kick <= 0) {
        // hanging from an arched vine: the stick runs you along its curve, hands on it. Push
        // down (not along it) to let go.
        const ar = W.zfx.arch, hy = W.p.y + WEB_HAND, q = archNear(ar, pcx0, hy);
        const a = ar.arc[q.k], b = ar.arc[q.k + 1], ul = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const ux = (b[0] - a[0]) / ul, uy = (b[1] - a[1]) / ul;
        const along = mag > 0 ? (L.nx * ux + L.ny * uy) * mag : 0;
        if (mag > 0.5 && L.ny > 0.7 && Math.abs(along) < 0.5) { W.webLetGo = 0.35; W.p.vy = 40; }
        else {
          const v = along * (ar.climb || (ar.climb = kr('arClimb'))) * tied;
          W.p.vx = approach(W.p.vx, ux * v + (q.x - pcx0) * 14, 1800 * dt);
          W.p.vy = approach(W.p.vy, uy * v + (q.y - hy) * 14, 1800 * dt);
        }
      } else if (climbing && W.zfx.web && W.p.kick <= 0) {
        // hanging from a spider's web line: the stick runs you along it, hands on the line.
        // Push down (not along it) to let go.
        const ln = W.zfx.web, wl = Math.hypot(ln.b0x - ln.a0x, ln.b0y - ln.a0y) || 1;
        let ux = (ln.b0x - ln.a0x) / wl, uy = (ln.b0y - ln.a0y) / wl;
        const along = mag > 0 ? (L.nx * ux + L.ny * uy) * mag : 0;
        if (mag > 0.5 && L.ny > 0.7 && Math.abs(along) < 0.5) { W.webLetGo = 0.35; W.p.vy = 40; }
        else {
          const v = along * (ln.climb || (ln.climb = spr('webClimb'))) * tied, hy = W.p.y + WEB_HAND, q = webNear(ln, pcx0, hy);
          W.p.vx = approach(W.p.vx, ux * v + (q.x - pcx0) * 14, 1800 * dt);
          W.p.vy = approach(W.p.vy, uy * v + (q.y - hy) * 14, 1800 * dt);
        }
      } else {
        // decoration underfoot: snow, slime and puddles slow you, ice takes your grip away
        const target = mag > 0 ? L.nx * mag * WALK * W.pb.walk * DEV.move * W.zfx.slow * tied : 0;
        W.p.vx = approach(W.p.vx, target, (W.p.onGround ? GROUND_ACC * (W.zfx.slick ? 0.08 : 1) : AIR_ACC) * dt * k);
        if (climbing && W.p.kick <= 0) W.p.vy = approach(W.p.vy, mag > 0 ? L.ny * mag * CLIMB * tied : 0, 1800 * dt);
        else W.p.vy = Math.min(W.p.vy + GRAVITY * dt * (1 - 2 * W.zfx.rev), 900);   // dark matter flips it
      }

      // ---- move against the pixel terrain ----
      const wasGround = W.p.onGround, fallV = W.p.vy;
      let n = Math.ceil(Math.abs(W.p.vx * dt));
      if (n > 0) {
        const sx = W.p.vx * dt / n;
        for (let i = 0; i < n; i++) {
          if (!boxHit(W, W.p.x + sx, W.p.y)) { W.p.x += sx; continue; }
          let moved = false;
          const maxUp = wasGround ? 6 : 3;          // walk up small bumps and slopes
          for (let up = 1; up <= maxUp; up++) {
            if (!boxHit(W, W.p.x + sx, W.p.y - up)) { W.p.x += sx; W.p.y -= up; moved = true; break; }
          }
          if (!moved) { W.p.vx = 0; break; }
        }
      }
      n = Math.ceil(Math.abs(W.p.vy * dt));
      if (n > 0) {
        const sy = W.p.vy * dt / n;
        for (let i = 0; i < n; i++) {
          if (!boxHit(W, W.p.x, W.p.y + sy)) { W.p.y += sy; continue; }
          if (sy > 0) W.p.y = Math.floor((W.p.y + sy + PH - 0.001) / CELL) * CELL - PH;
          else W.p.y = (Math.floor((W.p.y + sy) / CELL) + 1) * CELL;
          if (boxHit(W, W.p.x, W.p.y)) W.p.y -= sy;   // fallback
          W.p.vy = 0;
          break;
        }
      }
      // stick to the ground when walking down slopes
      if (wasGround && !jet && W.p.vy >= 0 && W.p.kick <= 0 && !boxHit(W, W.p.x, W.p.y + 1)) {
        for (let dn = 1; dn <= 6; dn++) {
          if (boxHit(W, W.p.x, W.p.y + dn + 1)) { W.p.y += dn; W.p.vy = 0; break; }
        }
      }
      // never stay stuck inside terrain
      if (boxHit(W, W.p.x, W.p.y)) {
        for (let up = 1; up <= 40; up++) if (!boxHit(W, W.p.x, W.p.y - up)) { W.p.y -= up; break; }
      }
      if (W.p.y > WH) { W.p.x = W.start.x; W.p.y = W.start.y; W.p.vx = 0; W.p.vy = 0; }
      W.p.onGround = boxHit(W, W.p.x, W.p.y + 0.5);
      // footsteps and landings, in the sound of whatever you're standing on
      if (!W.p.dead) {
        if (W.p.onGround && !wasGround && fallV > 200) SFX.fx('land', null, null, { v: fallV, s: W.zfx.surface });
        if (W.p.onGround && Math.abs(W.p.vx) > 40) {
          if ((W.stepT -= dt * Math.abs(W.p.vx) / 40) <= 0) { W.stepT = 1; SFX.fx('step', null, null, W.zfx.surface); }
        } else W.stepT = Math.min(W.stepT, 0.35);
      }

      const pcx = W.p.x + PW / 2, pcy = W.p.y + PH / 2;
      if (!W.p.dead && pcx > W.portal.x && pcx < W.portal.x + W.portal.w &&
          pcy > W.portal.y && pcy < W.portal.y + W.portal.h) {
        W.floor++;
        enterLevel();
        saveRun();
        SFX.fx('portalIn');
        toast(W, 'Floor ' + W.floor);
        input.current.notify();
        return;
      }

      // ---- aiming: thumbstick first, otherwise mouse ----
      const gx = pcx, gy = W.p.y + PH * 0.4;
      const TR = input.current.right;
      let R = { on: false, show: false, nx: W.p.face, ny: 0 };
      // line shows as soon as you touch the stick, fading in with the push: 0 at the centre,
      // full at the trigger ring (vis is what the Trajectory Sight line reads)
      if (TR.active) R = { on: TR.on, show: true, nx: TR.nx, ny: TR.ny, vis: Math.min(1, TR.mag / AIM_DEAD) };
      else if (mouse.inside) {
        const dx = W.camX + mouse.x / W.unitPx - gx, dy = W.camY + mouse.y / W.unitPx - gy, d = Math.hypot(dx, dy);
        if (d > 1) R = { on: mouse.down, show: true, nx: dx / d, ny: dy / d };
      }
      // Pinpointer aims for you: the gun locks onto the nearest creature and you only
      // decide whether to fire. It replaces hand-aiming — the stick becomes a trigger.
      if (W.pb.pinpointer && !W.p.dead) {
        let best = null, bd = 1e9;
        for (const e of W.enemies) {
          const d = Math.hypot(e.x - gx, e.ty - gy);
          if (d < bd && lineOfSight(W, gx, gy, e.x, e.ty)) { bd = d; best = e; }
        }
        if (best) {
          const a = Math.atan2(best.ty - gy, best.x - gx);
          R = { on: R.on || (TR.active && TR.on), show: true, nx: Math.cos(a), ny: Math.sin(a), vis: R.vis };
        }
      }
      if (W.p.dead) R.on = false;
      W.p.aim = R;

      if (R.show) W.p.face = R.nx >= 0 ? 1 : -1;
      else if (Math.abs(W.p.vx) > 10) W.p.face = W.p.vx > 0 ? 1 : -1;

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
      if (R.on && gun && gun.delayT <= 0 && gun.rechT <= 0) cast(W, G, gun, gx, gy, R.nx, R.ny);

      // ---- shots ----
      for (let i = W.bullets.length - 1; i >= 0; i--) {
        const b = W.bullets[i];
        b.life -= dt; b.spin += dt * 12; b.age = (b.age || 0) + dt;
        let dead = b.life <= 0, boom = false;
        if (dead && b.lifeBoom && b.explode) { dead = false; boom = true; }   // a bomb's fuse burns down
        if (b.fuse && b.age >= b.fuse) { boom = b.explode ? true : false; if (!b.explode) dead = true;
          else { explodeCross(W, G, b); dead = true; boom = false; } }
        if (b.grav) b.vy += b.grav * dt;
        if (b.drag) { const k = Math.exp(-b.drag * dt); b.vx *= k; b.vy *= k; }
        if (b.accel) { const f = 1 + b.accel * dt; b.vx *= f; b.vy *= f; }
        if (b.vmax) { const v = Math.hypot(b.vx, b.vy); if (v > b.vmax) { b.vx *= b.vmax / v; b.vy *= b.vmax / v; } }
        if (b.wig) turn(b, wigTurn(b.wig, b.age, dt));
        if (b.look) shotTrail(W, b, dt);
        // paths: each one bends the velocity, and tracePath draws the same bends
        if (b.spiral) turn(b, b.spiral * dt);
        if (b.pong && Math.floor(b.age / 0.45) % 2 === 1) { b.vx = -b.vx; b.vy = -b.vy; b.age += dt; }
        if (b.orbit) turn(b, b.orbit * dt);
        if (b.boomer) {
          const want = Math.atan2(W.p.y + PH / 2 - b.y, W.p.x + PW / 2 - b.x);
          turn(b, clamp(angDiff(want, Math.atan2(b.vy, b.vx)), -b.boomer * dt, b.boomer * dt));
        }
        if (b.eat) dig(W, G, b.x, b.y, b.eat);
        if (b.fire) ignite(W, G, b.x, b.y, b.size + 2, 0.5);     // a fire spell lights what it flies through
        if (b.arc) lightningStep(W, b, dt);
        // a timer lets its payload go in mid-air, and the carrier flies on
        if (b.payload && b.timer != null && (b.timer -= dt) <= 0) firePayload(W, G, b);
        if (b.pull) {
          // Black Hole: heavy gravity. It reaches ~2.2x its pull stat and drags harder the
          // closer you are, so creatures get hauled in and held in the middle of it. It
          // swallows enemy shots that come near, and grinds anything in it every 0.3s.
          const reach = DEV.bhPull * b.pull / 70;          // Dev knob: max pull range
          for (const e of W.enemies) {
            const dx = b.x - e.x, dy = b.y - e.ty, d = Math.hypot(dx, dy) || 1;
            if (d < reach) {
              const f = Math.min(d / dt, 60 + 420 * (1 - d / reach));   // never overshoot the centre
              e.x += dx / d * f * dt; e.y += dy / d * f * dt; e.tgt = null;
            }
          }
          for (let k = W.enemyShots.length - 1; k >= 0; k--) {
            const es = W.enemyShots[k];
            const dx = b.x - es.x, dy = b.y - es.y, d = Math.hypot(dx, dy) || 1;
            if (d < b.size + 6) { burst(W, es.x, es.y, 3, '#c58cff'); SFX.fx('absorb', es.x, es.y); W.enemyShots.splice(k, 1); continue; }
            if (d < reach) { es.vx += dx / d * 900 * dt; es.vy += dy / d * 900 * dt; }
          }
          if ((b.grind = (b.grind || 0) + dt) > 0.3) { b.grind = 0; b.hit = null; }
          // the trail of magic it leaves behind
          if (Math.random() < 0.9) {
            const a = Math.random() * 6.28, rr = b.size * (0.6 + Math.random() * 0.5);
            const life = 0.6 + Math.random() * 0.7;
            W.motes.push({ kind: 'drift', x: b.x + Math.cos(a) * rr, y: b.y + Math.sin(a) * rr,
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
            W.bullets.push(c);
          }
        }
        if (b.drift) {
          // Pollen: drags to a stop and floats; locks onto the first creature in range
          // it can see, then speeds back up and homes. Loses the lock if that one dies.
          if (b.lock && W.enemies.indexOf(b.lock) < 0) b.lock = null;
          if (!b.lock) {
            const d = driftStep(b.vx, b.vy, dt); b.vx = d[0]; b.vy = d[1];
            let bd = b.homeR || DRIFT_R;
            for (const e of W.enemies) {
              const dd = Math.hypot(e.x - b.x, e.ty - b.y);
              if (dd < bd && lineOfSight(W, b.x, b.y, e.x, e.ty)) { bd = dd; b.lock = e; }
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
          for (const e of W.enemies) {
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
          const j = enemyAt(W, nx, ny, b.size + 1);
          if (j >= 0 && !(b.hit && b.hit.has(W.enemies[j]))) {
            const e = W.enemies[j];
            const sp = Math.hypot(b.vx, b.vy) || 1;
            damageEnemy(W, j, critRoll(b.dmg, b.crit));
            if (b.fire) setAlight(e);
            burst(W, nx, ny, 4, b.col);
            SFX.hit(nx, ny);
            if (b.knock) shove(e, b.vx / sp, b.vy / sp, b.knock);
            b.x = nx; b.y = ny;
            if (b.payload && b.trig !== 'expire') firePayload(W, G, b);   // a trigger goes off on a hit
            if (b.chain > 0) {                            // hop to the next one along
              (b.hit || (b.hit = new Set())).add(e);
              let best = null, bd = 150;
              for (const o of W.enemies) {
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
            if (b.cluster) { spray(W, b); dead = true; break; }
            if (b.explode) { boom = true; break; }
            if (b.pop) { explode(W, G, nx, ny, b.pop, b.dmg * 0.5); dead = true; break; }
            if (b.pull) { (b.hit || (b.hit = new Set())).add(e); continue; }   // a black hole rolls on
            if (b.pierce > 0) { b.pierce--; (b.hit || (b.hit = new Set())).add(e); }
            else { dead = true; break; }
          }
          if (b.friendly && !W.p.dead && nx > W.p.x - 2 && nx < W.p.x + PW + 2 &&
              ny > W.p.y - 2 && ny < W.p.y + PH + 2) {
            burst(W, nx, ny, 5, b.col); hurt(W, G, Math.round(b.dmg * 2)); dead = true; break;
          }
          if (solidAt(W, nx, ny)) {
            if (b.payload && b.trig !== 'expire') firePayload(W, G, b);   // so does touching rock
            if (b.bounce > 0 && !b.bore && !b.eat) {
              b.bounce--;
              const hx = solidAt(W, nx, b.y), hy = solidAt(W, b.x, ny);
              if (hx || !hy) b.vx = -b.vx;
              if (hy || !hx) b.vy = -b.vy;
              const be = b.bounceE || 0.92;
              b.vx *= be; b.vy *= be;
              const slow = Math.hypot(b.vx, b.vy) < 60;
              if (slow && b.lifeBoom) b.bounce++;         // a bomb at rest doesn't use up its bounces
              if (!slow) SFX.bounce(b.x, b.y);
              if (b.look) shotBounce(W, b);
              if (b.bounceFx === 'explode') explode(W, G, b.x, b.y, Math.max(10, b.explode || 12));
              break;                      // stay put: b.x/b.y are still outside the rock
            }
            b.x = nx; b.y = ny;
            if (b.bore > 0) { if (b.look) shotGrind(W, b, nx, ny); dig(W, G, nx, ny, b.bore); continue; }
            // Matter Eater / Black Hole: eat straight through the rock, digging as it goes,
            // so a fast shot can't outrun the small hole its per-frame eat carves ahead
            if (b.eat > 0) { dig(W, G, nx, ny, b.eat); continue; }
            if (b.cluster) { spray(W, b); dead = true; break; }
            if (b.explode) { boom = true; break; }
            if (b.pop) { explode(W, G, b.x, b.y, b.pop, b.dmg * 0.5); dead = true; break; }
            if (b.pit) dig(W, G, nx, ny, b.pit);                // Noita's small hole where a shot lands
            burst(W, b.x, b.y, 3, b.col);
            SFX.rock(b.x, b.y);
            dead = true;
            break;
          }
          b.x = nx; b.y = ny;
        }
        if (boom) { explode(W, G, b.x, b.y, b.explode, undefined, b.fire); dead = true; }
        if (dead && b.fire) ignite(W, G, b.x, b.y, b.size + 6, 0.9);
        // an expiration trigger goes off however it dies; a trigger stopped by a prop counts as a hit
        if (dead && b.payload && (b.trig === 'expire' || b.struck)) firePayload(W, G, b);
        if (dead && b.tele) teleportTo(W, b);            // Teleport Bolt: you go where it stopped
        if (dead && b.arc && b.trail) {               // the bolt's path lingers for a blink
          b.trail.push({ x: b.x, y: b.y });
          addArc(W, b.trail, b.col, 1.4, 0.16);
        }
        if (dead && b.look) shotDeath(W, b);
        if (dead) W.bullets.splice(i, 1);
      }
      for (let i = W.arcs.length - 1; i >= 0; i--) if ((W.arcs[i].t += dt) > W.arcs[i].max) W.arcs.splice(i, 1);

      // ---- sound, once a frame: where you are listening from, the jetpack, each live
      // Black Hole's drone, the floor's ambience, and a heartbeat when you're nearly dead ----
      SFX.ear(pcx, pcy);
      if (!W.jetLoop && SFX.ready) W.jetLoop = SFX.loop('jet');
      if (W.jetLoop) W.jetLoop.set(W.p.dead ? 0 : Math.min(1, W.p.flame) * 0.35, null, null,
        (1 + 0.49 * Math.min(1, W.p.flame)) * jetPitch(W.jetSt.onT));   // tone: thrust, then how long it's held
      if (W.p.empty && !W.wasEmpty) SFX.ui('sputter');
      W.wasEmpty = W.p.empty;
      for (const b of W.bullets) if (b.pull) {
        let h = W.bhLoops.get(b);
        if (!h && W.bhLoops.size < 3 && SFX.ready) { h = SFX.loop('void'); if (h) W.bhLoops.set(b, h); }
        if (h) h.set(0.5, b.x, b.y);
      }
      for (const [b, h] of W.bhLoops) if (!W.bullets.includes(b)) { h.stop(); W.bhLoops.delete(b); }
      SFX.ambTick(dt);
      if (!W.portalLoop && SFX.ready) W.portalLoop = SFX.loop('portal');
      if (W.portalLoop) W.portalLoop.set(0.55, W.portal.x + W.portal.w / 2, W.portal.y + W.portal.h / 2);
      if (W.matterProps.length) {
        let best = null, bd = 300;
        for (const pr of W.matterProps) { const d = Math.hypot(pr.x - pcx, pr.y - pcy); if (!pr.gone && d < bd) { bd = d; best = pr; } }
        if (best && !W.matterLoop && SFX.ready) W.matterLoop = SFX.loop('matter');
        if (W.matterLoop && best) W.matterLoop.set(0.6, best.x, best.y);
      }
      if (W.p.jet > 0 && !W.wasJet) SFX.fx('ignite');
      W.wasJet = W.p.jet > 0;
      for (const dv of W.devils) if ((dv.snd = (dv.snd || 0) - dt) <= 0) { dv.snd = 0.9 + Math.random() * 0.8; SFX.fx('whirl', dv.x, dv.y - 14); }
      if (!W.p.dead && W.p.hp / MHP < 0.3 && (W.beatT -= dt) <= 0) { W.beatT = 0.55 + 1.5 * W.p.hp / MHP; SFX.ui('beat'); }

      // ---- static fields ----
      for (let i = W.fields.length - 1; i >= 0; i--) {
        const f = W.fields[i];
        f.life -= dt; f.tick -= dt;
        const near = j => Math.hypot(W.enemies[j].x - f.x, W.enemies[j].ty - f.y) < f.r;
        if (f.field === 'slow' || f.field === 'storm') {
          // Stillness frosts and the thundercloud's rain soaks: any fire under them goes out
          if ((f.dT = (f.dT || 0) - dt) <= 0) { f.dT = 0.15;
            if (fireDouse(W.fire, f.x, f.y, f.r) && Math.random() < 0.5) SFX.fx('steam', f.x, f.y);
            for (const e of W.enemies) if (e.burn > 0 && Math.hypot(e.x - f.x, e.ty - f.y) < f.r) e.burn = 0;
            if (W.p.burn > 0 && Math.hypot(pcx - f.x, pcy - f.y) < f.r) W.p.burn = 0; }
          if (f.field === 'slow' && Math.random() < dt * 14) { const a = Math.random() * 6.283, r = Math.random() * f.r;
            glowDot(W, f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, rnd(-4, 4), rnd(4, 12), Math.random() < 0.5 ? '#ffffff' : '#bfe8ff', rnd(0.7, 1.1), rnd(0.4, 0.9)); }
        }
        if (f.field === 'heal' && Math.random() < dt * 10) { const a = Math.random() * 6.283, r = Math.random() * f.r;
          glowDot(W, f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, 0, rnd(-18, -8), Math.random() < 0.5 ? '#9dff9a' : '#46c48c', rnd(0.8, 1.2), rnd(0.4, 0.8)); }
        if (f.field === 'mine') {
          f.near = W.enemies.some(e => Math.hypot(e.x - f.x, e.ty - f.y) < f.r * 2.2);
          let trip = f.life <= 0;
          for (let j = 0; j < W.enemies.length && !trip; j++) if (near(j)) trip = true;
          if (trip) { explode(W, G, f.x, f.y, f.r); fieldPayload(W, G, f); W.fields.splice(i, 1); continue; }
        } else if (f.field === 'dormant') {
          // set off by any blast of yours, which is the whole point of it
          for (const fl of W.flashes) {
            if (Math.hypot(fl.x - f.x, fl.y - f.y) < fl.r + f.r * 0.5) {
              explode(W, G, f.x, f.y, f.r * 1.6); fieldPayload(W, G, f); W.fields.splice(i, 1); f.life = -1; break;
            }
          }
          if (f.life < 0) continue;
        } else if (f.field === 'slow') {
          for (const e of W.enemies) if (Math.hypot(e.x - f.x, e.ty - f.y) < f.r) e.chill = 0.2;
        } else if (f.field === 'shield') {
          for (let k = W.enemyShots.length - 1; k >= 0; k--) {
            const b = W.enemyShots[k];
            if (Math.hypot(b.x - f.x, b.y - f.y) < f.r) { burst(W, b.x, b.y, 3, f.col); SFX.fx('absorb', b.x, b.y); W.enemyShots.splice(k, 1); }
          }
        } else if (f.field === 'heal') {
          if (Math.hypot(pcx - f.x, pcy - f.y) < f.r && W.p.hp < MHP && f.tick <= 0) {
            f.tick = 0.4; W.p.hp = Math.min(MHP, W.p.hp + 4 * W.pb.heal); input.current.notify(); SFX.fx('healtick');
          }
        } else if (f.field === 'storm') {
          if (f.tick <= 0) {
            f.tick = 0.22;
            const a = Math.random() * Math.PI * 2, rr = Math.random() * f.r;
            const sx = f.x + Math.cos(a) * rr, sy = f.y + Math.sin(a) * rr;
            for (let j = W.enemies.length - 1; j >= 0; j--)
              if (Math.hypot(W.enemies[j].x - sx, W.enemies[j].ty - sy) < 22) damageEnemy(W, j, 2);
            burst(W, sx, sy, 6, '#a8e4ff');
            addArc(W, [{ x: sx + rnd(-8, 8), y: f.y - f.r * 0.85 }, { x: sx, y: sy }], '#a8e4ff', 1.2, 0.14);   // down from the cloud
            SFX.arc(sx, sy, true);
          }
        } else if (f.field === 'vacuum') {
          // Noita's Vacuum Field: a blink after it appears, everything in reach is warped
          // straight to the middle, through walls — creatures, shots (theirs and yours),
          // gold and loot. Once, then it's gone.
          if (!f.done && f.max - f.life >= VACUUM_WAIT) {
            f.done = true;
            const inR = (x, y) => Math.hypot(x - f.x, y - f.y) < f.r;
            for (const e of W.enemies) if (inR(e.x, e.ty)) { e.y += f.y - e.ty; e.x = f.x; e.tgt = null; }
            for (const b of W.bullets) if (inR(b.x, b.y)) { b.x = f.x; b.y = f.y; }
            for (const b of W.enemyShots) if (inR(b.x, b.y)) { b.x = f.x; b.y = f.y; }
            for (const g of W.coins) if (inR(g.x, g.y)) { g.x = f.x; g.y = f.y; }
            for (const q of W.pickups) if (!q.taken && inR(q.x, q.y)) { q.x = f.x; q.y = f.y; }
            burst(W, f.x, f.y, 14, f.col);
            SFX.fx('warp', f.x, f.y);
          }
        } else if (f.field === 'glitter') {
          if (f.tick <= 0) {
            f.tick = 0.16;
            const a = Math.random() * Math.PI * 2, rr = Math.random() * f.r;
            explode(W, G, f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr, 9);
          }
        }
        if (f.life <= 0) W.fields.splice(i, 1);
      }
      for (let i = W.beams.length - 1; i >= 0; i--) if ((W.beams[i].t += dt) > 0.12) W.beams.splice(i, 1);

      // ---- pickups: just cooldown upkeep and clearing what was taken. Whether one is
      // near enough to show its card, and whether you actually take it, is decided
      // below together with the shop — both go through the same interact tap now. ----
      for (let i = W.pickups.length - 1; i >= 0; i--) {
        const q = W.pickups[i];
        if (q.taken) { W.pickups.splice(i, 1); continue; }
        if (q.cool > 0) q.cool -= dt;
      }
      // ---- gold ----
      for (let i = W.coins.length - 1; i >= 0; i--) {
        const g = W.coins[i];
        const dx = pcx - g.x, dy = pcy - g.y, d = Math.hypot(dx, dy) || 1;
        const pull = COIN_PULL * W.pb.goldPull;    // Attract Gold reaches further
        if (g.nopull > 0) g.nopull -= dt;        // gold a rat just knocked out of you flies clear first
        if (d < pull && !W.p.dead && !(g.nopull > 0)) {
          // inside the pull radius it flies to you, straight through rock
          const grab = 180 + 900 * (1 - d / pull);
          g.vx = (g.vx || 0) + (dx / d) * grab * dt * 6;
          g.vy += (dy / d) * grab * dt * 6;
          g.vx *= 0.88; g.vy *= 0.88;
          g.x += g.vx * dt; g.y += g.vy * dt;
          if (d < 12) {
            LO.gold += g.amount;
            W.coins.splice(i, 1);
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
          if (solidAt(W, nx, g.y)) g.vx *= -0.4; else g.x = nx;
          if (solidAt(W, g.x, ny + 3)) {
            if (g.vy > 70) { g.vy = -g.vy * 0.42; g.vx *= 0.7; SFX.fx('coinland', g.x, g.y); }
            else { g.vy = 0; g.vx *= Math.exp(-8 * dt); if (Math.abs(g.vx) < 4) { g.vx = 0; g.pop = 0; } }
          } else if (solidAt(W, g.x, ny - 3) && g.vy < 0) g.vy = 0;
          else g.y = ny;
          continue;
        }
        g.vx = (g.vx || 0) * 0.9;
        g.vy += 320 * dt;
        const nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
        if (!solidAt(W, nx, g.y)) g.x = nx;
        if (solidAt(W, g.x, ny + 3)) { if (g.vy > 60) SFX.fx('coinland', g.x, g.y); g.vy = 0; } else g.y = ny;
      }

      // ---- what you can interact with: a shop plinth, or something on the ground ----
      const inShop = W.p.y + PH > SHOP_Y;
      let near = null;                      // { src: 'shop', it } or { src: 'pickup', q }
      for (const it of W.stock) {
        if (it.sold) continue;
        if (Math.abs(it.x - pcx) > 15 || Math.abs(it.y - pcy) > 22) continue;
        near = { src: 'shop', it };
        break;
      }
      if (!near) for (const q of W.pickups) {
        if (q.cool > 0) continue;
        if (Math.abs(q.x - pcx) > 18 || Math.abs(q.y - pcy) > 20) continue;
        near = { src: 'pickup', q };
        break;
      }
      // the hidden rooms' prizes: a perk on its altar, or the +25 heart
      if (!near) for (const r of W.rooms) {
        if (r.taken) continue;
        if (Math.abs(r.x - pcx) > 20 || Math.abs(r.y - pcy) > 26) continue;
        near = { src: 'room', r };
        break;
      }
      const nearKey = !near ? -1 : near.src + ':' +
        (near.src === 'shop' ? W.stock.indexOf(near.it)
          : near.src === 'room' ? W.rooms.indexOf(near.r) : W.pickups.indexOf(near.q));
      const label = !near ? null
        : near.src === 'shop'
          ? (near.it.kind === 'heal' ? { text: 'Full heal', price: 0, can: W.p.hp < MHP }
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
        pbottom = Math.round(Math.max(10, c.height / dprc - (iy - 16 - W.camY) * W.unitPx));
      }
      const sig = nearKey + ':' + (label && label.can ? 1 : 0) + ':' + inShop + ':' + Math.round(pbottom / 16);
      if (nearKey !== -1 && nearKey !== W.lastNear) SFX.fx('prompt');   // a soft blip as a card comes up
      W.lastNear = nearKey;
      if (sig !== input.current.sig) {
        input.current.sig = sig;
        input.current.prompt = label;
        input.current.promptBottom = pbottom;
        input.current.inShop = inShop;
        input.current.notify();
      }
      // dead: a tap on the right stick restarts the run (see the death message)
      if (W.p.dead && input.current.interact) {
        input.current.interact = false;
        if (input.current.requestRestart) input.current.requestRestart();
      }
      if (input.current.interact && near) {
        input.current.interact = false;
        if (near.src === 'shop') {
          const it = near.it;
          if (it.kind === 'heal') {
            if (W.p.hp < MHP) { W.p.hp = MHP; it.sold = true; toast(W, 'Patched up'); SFX.ui('heal'); }
          } else if (LO.gold < it.price) {
            toast(W, 'Not enough gold');
            SFX.ui('poor');
          } else if (it.kind === 'gun') {
            LO.gold -= it.price;
            it.sold = true;
            // it drops at the plinth, so the usual chooser decides which slot it takes
            // and "leave it" parks the gun you paid for on the floor rather than binning it
            W.pickups.push({ kind: 'gun', x: it.x, y: it.y, gun: it.gun, t: 0 });
            toast(W, 'Bought ' + it.gun.name);
            SFX.ui('buy');
          } else {
            LO.gold -= it.price;
            LO.bag.push(it.id);
            it.sold = true;
            toast(W, 'Bought ' + MODS[it.id].name);
            SFX.ui('buy');
          }
        } else if (near.src === 'room') {
          const r = near.r;
          if (r.kind === 'perk') {
            const before = maxHp(W, G);
            (LO.perks || (LO.perks = [])).push(r.id);
            refreshBag(W, G);
            const after = maxHp(W, G);
            if (after > before) W.p.hp += after - before;   // Extra Health comes full
            W.p.hp = Math.min(W.p.hp, after);                 // Glass Cannon trims it
            if (W.pb.seeAll) { W.seen.fill(2); paintFog(W, G); }  // All-Seeing Eye lights it up now
            if (W.pb.ghost && !W.ghost) W.ghost = { x: pcx, y: pcy, cd: 0 };
            toast(W, 'Perk: ' + PERKS[r.id].name);
            SFX.ui('perk');
          } else {
            LO.maxBonus = (LO.maxBonus || 0) + 25;        // the heart raises the cap, no heal
            toast(W, '+25 Max Health');
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
            toast(W, 'Picked up ' + MODS[q.id].name);
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

      for (let i = W.toasts.length - 1; i >= 0; i--) if ((W.toasts[i].t -= dt) <= 0) W.toasts.splice(i, 1);

      decorStep(W, G, dt, pcx, pcy);

      // ---- enemies ----
      // What an enemy does is what it is. Shooters hold a hover and fire on sight,
      // turrets never move and wind up a long shot, chasers come at you and hurt on
      // contact, bombers come at you and burst. Runs backwards because a bomber
      // takes itself out of the list.
      for (let i = W.enemies.length - 1; i >= 0; i--) {
        const e = W.enemies[i], k = e.k;
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
        const sees = (W.pb.invis ? 0.4 : 1) / DEV.zoom;
        // aggro only on a real sightline: a chaser or bomber won't come for you through a
        // wall any more, only once it can actually see you (and within its aggro reach).
        // The range check comes first so the line-of-sight march only runs for the few
        // enemies already close enough to care.
        // DEV.aggro is an extra hand-tuning multiplier on the aggro reach, on top of the
        // zoom-relative `sees` scaling — firing range (k.range) is left alone.
        // Aggro is sticky: once a chaser/bomber has you it keeps coming (even out of the
        // initial reach and even round a wall), and only drops back to patrol once you've
        // put DEV.loseAggro times the aggro reach between you — so you can outrun it.
        const chaser = HUNTERS[k.act] && !W.p.dead;
        // a reworked creature rolls its own aggro reach from its knobs, once a second
        if (k.kp && ((e.aggroT = (e.aggroT || 0) - dt) <= 0)) { e.aggroM = kr(k.kp + 'Aggro'); e.aggroT = 1; }
        const reach = k.aggro * sees * DEV.aggro * (k.kp ? e.aggroM : 1);
        if (chaser) {
          if (!e.aggro) { if (dist < reach && lineOfSight(W, e.x, e.ty, pcx, pcy)) { e.aggro = true; SFX.creature(k, 'alert', e.x, e.ty); } }
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
            for (const r of W.enemies) if (r.home === e) out++;
            if (out < N.max) spawnRat(W, e);
          }
          e.chill = 1; e.ty = e.y;
          continue;
        }
        if (k.act === 'rat') {
          ratFrame(W, G, e, dt, dist, hunting, pcx, pcy);
          e.chill = 1; e.ty = e.y;
          continue;
        }
        if (k.act === 'spider') {
          // only on rock and its own lines (spiderStep); strings you when it has a clear line
          const cold = e.chill && e.chill < 1 ? e.chill : 1;
          if (spiderStep(e, { solidCell: (cx, cy) => solidCell(W, cx, cy), webs: W.webs, hunting, goal: { x: pcx, y: pcy }, rnd: Math.random,
            speedMul: cold }, dt) === 'web') SFX.fx('lash', e.x, e.y);
          e.silkT = (e.silkT || 0) - dt;
          const S = e.sp;
          if (hunting && e.silkT <= 0 && S && (S.mode === 'surf' || S.mode === 'line') &&
              dist < (e.silkR || (e.silkR = spr('spSilk'))) * sees && dist > e.r + 24) {
            e.silkT = 0.4;
            if (lineOfSight(W, e.x, e.y, pcx, pcy)) {
              e.silkT = spr('spSilkCd'); e.silkR = spr('spSilk');
              const v = spr('spSilkSpd');
              W.silk.push({ x: e.x, y: e.y, ax: e.x, ay: e.y, vx: dx / dist * v, vy: dy / dist * v,
                life: 400 / v * 1.3 + 0.1 });
              SFX.creature(k, 'fire', e.x, e.y);
            }
          }
        } else if (k.act === 'jelly') {
          // swims in pulses (jellyStep); spits when its head is lined up on you, in range
          const cold = e.chill && e.chill < 1 ? e.chill : 1;
          if (jellyStep(e, { solidCell: (cx, cy) => solidCell(W, cx, cy), hunting, goal: { x: pcx, y: pcy }, rnd: Math.random,
            speedMul: cold, rangeMul: sees, stay: W.zone ? natural : null }, dt) === 'pulse') puffSpores(W, e);
          const S = e.je;
          // brush its tentacles and you're stung, hunting or not (same sting knobs as the bell)
          if (!W.p.dead && e.touch <= 0 && dist < 180) {
            const t = tentacleTouch(S, W.p.x, W.p.y, W.p.x + PW, W.p.y + PH);
            if (t) {
              hurt(W, G, Math.round(kr('jeBite'))); e.touch = kr('jeBiteCd');
              burst(W, t.x, t.y, 5, jellyPal(S.u.col).tent);
              SFX.creature(k, 'bite', t.x, t.y);
            }
          }
          if (hunting && S.inRange && S.aimed && e.cd <= 0) {
            e.cd = 0.25;                                // no clear line: look again shortly
            const hx = e.x + Math.cos(S.hd) * e.r * 0.9, hy = e.y + Math.sin(S.hd) * e.r * 0.9;
            if (lineOfSight(W, hx, hy, pcx, pcy)) {
              e.cd = kr('jeShotCd');
              const a = Math.atan2(pcy - hy, pcx - hx) + (Math.random() * 2 - 1) * kr('jeSpread') * Math.PI / 180;
              const v = kr('jeShotSpd'), P = jellyPal(S.u.col);
              W.enemyShots.push({ x: hx, y: hy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 3,
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
          if (!solidAt(W, wx - e.r, wy) && !solidAt(W, wx + e.r, wy) &&
              !solidAt(W, wx, wy - e.r) && !solidAt(W, wx, wy + e.r)) { e.x = wx; e.y = wy; }
          else if (!solidAt(W, wx, e.y)) e.x = wx;            // slide along whatever it hit
          else if (!solidAt(W, e.x, wy)) e.y = wy;
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
          if (solidAt(W, wx - e.r, wy) || solidAt(W, wx + e.r, wy) ||
              solidAt(W, wx, wy - e.r) || solidAt(W, wx, wy + e.r)) { e.tgt = null; e.rest = 0; }
          else { e.x = wx; e.y = wy; }
        }
        e.chill = 1;                                  // fields re-apply it every frame
        e.ty = k.kp ? e.y : e.y + Math.sin(W.time * 2 + e.phase) * (hunting ? 2 : 4);

        // contact: a chaser hurts you by reaching you, a bomber goes off
        if (hunting && dist < e.r + 14 && e.touch <= 0) {
          if (k.act === 'bomb') {
            burst(W, e.x, e.ty, 22, k.col.a);
            SFX.boom(e.x, e.ty, 26);
            hurt(W, G, k.dmg);
            W.enemies.splice(i, 1);
            if (k.fire) fireBlast(W, G, e.x, e.ty, 26, 1);
            continue;
          }
          SFX.creature(k, 'bite', e.x, e.ty);
          hurt(W, G, k.kp ? Math.round(kr(k.kp + 'Bite')) : k.dmg);
          e.touch = k.kp ? kr(k.kp + 'BiteCd') : 0.9;
        }

        // firing. A turret with a wind-up shows the ring first and only shoots if it
        // still has a line on you when the ring closes.
        if (k.act === 'shoot' || k.act === 'turret') {
          if (e.charge > 0) {
            e.charge -= dt;
            if (e.charge <= 0) fireEnemyShot(W, e, pcx, pcy);
          } else if (!W.p.dead && dist < k.range * sees && e.cd <= 0) {
            e.cd = 0.4;   // re-check soon if we can't see the player
            if (lineOfSight(W, e.x, e.ty, pcx, pcy)) {
              e.cd = k.cd * (0.85 + Math.random() * 0.3);
              if (!e.spotted) { e.spotted = true; SFX.creature(k, 'alert', e.x, e.ty); }
              if (k.tele) { e.charge = k.tele; SFX.creature(k, 'charge', e.x, e.ty, k.tele); } else fireEnemyShot(W, e, pcx, pcy);
            }
          }
        }
      }
      // Contact Damage: anything touching you is hurt for it, whether or not it's hunting
      if (W.pb.contact && !W.p.dead) {
        for (let i = W.enemies.length - 1; i >= 0; i--) {
          const e = W.enemies[i];
          if (Math.hypot(e.x - pcx, e.ty - pcy) < e.r + 12) damageEnemy(W, i, 45 * dt);
        }
      }

      for (let i = W.enemyShots.length - 1; i >= 0; i--) {
        const b = W.enemyShots[i];
        b.life -= dt;
        // Projectile Repulsion Field: shots on their way to you are shoved aside
        if (W.pb.repel) {
          const rx = b.x - pcx, ry = b.y - pcy, rd = Math.hypot(rx, ry) || 1;
          if (rd < 72) { b.vx += rx / rd * 1100 * dt; b.vy += ry / rd * 1100 * dt; }
        }
        // poison spit drips as it flies
        if (b.drip) for (b.da += b.drip * dt; b.da >= 1; b.da--)
          goo(W, b.x + (Math.random() - 0.5) * b.size, b.y + b.size * 0.5, b.vx * 0.08, 8 + Math.random() * 18, b.dripG, b.dripCol || b.col, 0, b.dripCol2);
        let gone = b.life <= 0;
        if (b.fire) fireArea(W.fire, b.x, b.y, 4, 0.5);
        const sn = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 2);
        for (let s = 0; s < sn && !gone; s++) {
          b.x += b.vx * dt / sn; b.y += b.vy * dt / sn;
          if (solidAt(W, b.x, b.y)) {
            gone = true;
            if (b.splat != null) splat(W, b, b.x - b.vx * dt / sn, b.y - b.vy * dt / sn);
            else SFX.fx('fizzle', b.x, b.y);
            if (b.fire) ignite(W, G, b.x - b.vx * dt / sn, b.y - b.vy * dt / sn, 8, 0.9);
            break;
          }
          if (!W.p.dead && b.x > W.p.x - 2 && b.x < W.p.x + PW + 2 && b.y > W.p.y - 2 && b.y < W.p.y + PH + 2) {
            gone = true;
            if (b.splat != null) splat(W, b, b.x, b.y); else burst(W, b.x, b.y, 5, COL.player);
            hurt(W, G, b.dmg);
            if (b.fire) youAlight(W);
          }
        }
        if (gone) W.enemyShots.splice(i, 1);
      }
      // spider strings in flight: rock stops them, you catch them
      for (let i = W.silk.length - 1; i >= 0; i--) {
        const b = W.silk[i];
        b.life -= dt;
        let gone = b.life <= 0;
        const sn = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 2);
        for (let s = 0; s < sn && !gone; s++) {
          b.x += b.vx * dt / sn; b.y += b.vy * dt / sn;
          if (solidAt(W, b.x, b.y)) { gone = true; break; }
          if (!W.p.dead && b.x > W.p.x - 3 && b.x < W.p.x + PW + 3 && b.y > W.p.y - 3 && b.y < W.p.y + PH + 3) {
            gone = true;
            W.strings.push({ ax: b.ax, ay: b.ay, ox: b.x - W.p.x, oy: b.y - W.p.y, slow: spr('spSlow'), max: spr('spSilkMax') });
            SFX.fx('lash', b.x, b.y);
          }
        }
        if (gone) W.silk.splice(i, 1);
      }
      // strings on you: pulled past their length, they snap
      for (let i = W.strings.length - 1; i >= 0; i--) {
        const s = W.strings[i];
        if (Math.hypot(W.p.x + s.ox - s.ax, W.p.y + s.oy - s.ay) > s.max) {
          W.strings.splice(i, 1);
          burst(W, W.p.x + s.ox, W.p.y + s.oy, 4, '#e8e8f0');
          SFX.fx('lash', W.p.x + s.ox, W.p.y + s.oy);
        }
      }
      // a web line whose rock has been blasted away comes down (a few checked a frame)
      for (let n = Math.min(W.webs.length, 6); n > 0; n--) {
        W.webCheck = (W.webCheck + 1) % W.webs.length;
        const L = W.webs[W.webCheck];
        if ((L.bin && !solidAt(W, L.bin.x, L.bin.y)) || (L.ain && !solidAt(W, L.ain.x, L.ain.y))) {
          W.webs.splice(W.webCheck, 1);
          if (!W.webs.length) break;
        }
      }
      W.p.hitT -= dt;

      // ---- Angry Ghost: a spirit that trails you and fires at what's nearest ----
      if (W.pb.ghost) {
        if (!W.ghost) W.ghost = { x: pcx, y: pcy, cd: 0 };
        const gtx = pcx - W.p.face * 22, gty = W.p.y - 4;
        const lp = Math.min(1, dt * 4);
        W.ghost.x += (gtx - W.ghost.x) * lp; W.ghost.y += (gty - W.ghost.y) * lp;
        W.ghost.cd -= dt;
        if (W.ghost.cd <= 0 && !W.p.dead) {
          let best = null, bd = 340;
          for (const e of W.enemies) { const d = Math.hypot(e.x - W.ghost.x, e.ty - W.ghost.y); if (d < bd) { bd = d; best = e; } }
          if (best) {
            W.ghost.cd = 0.7;
            const a = Math.atan2(best.ty - W.ghost.y, best.x - W.ghost.x);
            W.bullets.push({ x: W.ghost.x, y: W.ghost.y, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480,
              life: 1.2, dmg: 2 * W.pb.dmg, size: 2, col: '#c9a6ff', spin: 0, homing: 3, bounce: 0,
              pierce: 0, explode: 0, grav: 0, accel: 0, bore: 0, hit: null, knock: 0, crit: 0,
              age: 0, born: 1.2 });
            SFX.fx('ghost', W.ghost.x, W.ghost.y);
          }
        }
      } else W.ghost = null;

      // ---- fire: the cave's, the creatures', yours ----
      fireFrame(W, G, dt, pcx, pcy);

      // ---- Levitation Trail: flying lays down fire that burns what it touches ----
      if (W.pb.trail && W.p.flame > 0 && !W.p.dead) {
        const bn = { x: pcx + (Math.random() - 0.5) * 6, y: W.p.y + PH, life: 0.7, max: 0.7 };
        W.burns.push(bn);
        if (W.burns.length > 48) W.burns.shift();
        fireArea(W.fire, bn.x, bn.y + 2, 4, 0.4);
      }
      for (let i = W.burns.length - 1; i >= 0; i--) {
        const bn = W.burns[i]; bn.life -= dt;
        for (let j = W.enemies.length - 1; j >= 0; j--)
          if (Math.hypot(W.enemies[j].x - bn.x, W.enemies[j].ty - bn.y) < 15) { setAlight(W.enemies[j]); damageEnemy(W, j, 22 * dt); }
        if (bn.life <= 0) W.burns.splice(i, 1);
      }

      // ---- jetpack smoke ----
      if (W.p.flame > 0) {
        let fx = -W.p.jx, fy = -W.p.jy + 0.8;
        const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
        W.smokeAcc += dt * (25 + 35 * W.p.flame);
        while (W.smokeAcc >= 1) {
          W.smokeAcc--;
          W.smoke.push({ x: pcx + (Math.random() - 0.5) * 5, y: W.p.y + PH + 3,
            vx: fx * 50 + (Math.random() - 0.5) * 20, vy: fy * 50 + (Math.random() - 0.5) * 20,
            r: 1.5 + Math.random(), life: 0.9, max: 0.9 });
        }
      }
      for (let i = W.smoke.length - 1; i >= 0; i--) {
        const m = W.smoke[i];
        m.x += m.vx * dt; m.y += m.vy * dt;
        m.vx *= 1 - 2.5 * dt; m.vy = m.vy * (1 - 2.5 * dt) - 12 * dt;
        m.r += 5 * dt; m.life -= dt;
        if (m.life <= 0) W.smoke.splice(i, 1);
      }
      for (let i = W.sparks.length - 1; i >= 0; i--) {
        const q = W.sparks[i];
        q.vy += (q.g != null ? q.g : q.heavy ? 600 : 300) * dt;
        const nx = q.x + q.vx * dt, ny = q.y + q.vy * dt;
        if (q.heavy && solidAt(W, nx, ny)) { q.vx *= 0.3; q.vy = 0; }
        else { q.x = nx; q.y = ny; }
        q.life -= dt;
        if (q.life <= 0) W.sparks.splice(i, 1);
      }
      for (let i = W.flashes.length - 1; i >= 0; i--) {
        W.flashes[i].t += dt;
        if (W.flashes[i].t > 0.25) W.flashes.splice(i, 1);
      }

      W.best = Math.max(W.best, Math.round((W.start.y - W.p.y) / 10));

      // ---- the torch ----
      // A random walk with two sines on top, which is what makes a flame gutter rather
      // than pulse. It never goes above 1: flicker means the light dipping, and a canvas
      // globalAlpha over 1 is simply ignored.
      W.torchT += dt;
      W.flickN += (Math.random() - 0.5) * 2.6 * dt;
      W.flickN *= 0.94;
      W.flick = clamp(0.94 + W.flickN + 0.04 * Math.sin(W.torchT * 11.3) + 0.025 * Math.sin(W.torchT * 19.7),
        0.84, 1);
      W.torchAcc += dt;
      while (W.torchAcc > 0.04) {
        W.torchAcc -= 0.04;
        const th = torchHand();
        const life = 0.3 + Math.random() * 0.35;
        W.torchP.push({ x: th.x + (Math.random() - 0.5) * 2, y: th.y - 7,
          vx: (Math.random() - 0.5) * 10 + W.p.vx * 0.15, vy: -20 - Math.random() * 22,
          life, max: life, s: 1 + Math.random() * 1.3,
          c: Math.random() < 0.5 ? COL.flame2 : COL.flame });
        if (W.torchP.length > 60) W.torchP.shift();
      }
      for (let i = W.torchP.length - 1; i >= 0; i--) {
        const q = W.torchP[i];
        q.vy += 30 * dt; q.vx *= 0.98;
        q.x += q.vx * dt; q.y += q.vy * dt;
        if ((q.life -= dt) <= 0) W.torchP.splice(i, 1);
      }
      // the flame's lean: spring toward "opposite your velocity", so a sudden move flings
      // it back and it wobbles upright again when you stop
      const wantX = clamp(-W.p.vx * 0.055, -11, 11), wantY = clamp(-W.p.vy * 0.03, -5, 7);
      W.leanVX += ((wantX - W.leanX) * 90 - W.leanVX * 9) * dt;
      W.leanVY += ((wantY - W.leanY) * 90 - W.leanVY * 9) * dt;
      W.leanX += W.leanVX * dt; W.leanY += W.leanVY * dt;
      // the glow gets its own quicker, deeper flicker on top of flick (the map light is untouched)
      W.glowN += (Math.random() - 0.5) * 6 * dt; W.glowN *= 0.9;

      // ---- portal motes ----
      W.portalAcc += dt;
      while (W.portalAcc > 0.05) {
        W.portalAcc -= 0.05;
        const ex = W.portal.x + W.portal.w / 2, ey = W.portal.y + W.portal.h / 2;
        if (Math.abs(ey - W.p.y) < 500) {        // the exit: scattered round it, drawn in
          const a = Math.random() * 6.28, rr = 30 + Math.random() * 38;
          const life = 1.4 + Math.random() * 0.8;
          W.motes.push({ kind: 'in', x: ex + Math.cos(a) * rr, y: ey + Math.sin(a) * rr * 0.9,
            tx: ex, ty: ey, vx: 0, vy: 0, life, max: life, age: 0, ph: Math.random() * 6.28,
            s: 1 + Math.random() * 1.4, c: Math.random() < 0.4 ? '#c8ffe4' : COL.portal });
        }
        if (Math.abs(W.arrival.y - W.p.y) < 500) { // the way in: breathed out, drifting away
          const a = Math.random() * 6.28, sp = 10 + Math.random() * 16;
          W.motes.push({ kind: 'out', x: W.arrival.x + (Math.random() - 0.5) * 12,
            y: W.arrival.y + (Math.random() - 0.5) * 18, ox: W.arrival.x, oy: W.arrival.y,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, life: 4, max: 4, age: 0,
            ph: Math.random() * 6.28, fade: 34 + Math.random() * 18,
            s: 1 + Math.random() * 1.3, c: Math.random() < 0.4 ? '#e6d4ff' : COL.enemy });
        }
      }
      for (let i = W.motes.length - 1; i >= 0; i--) {
        const q = W.motes[i];
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
        if ((q.life -= dt) <= 0) W.motes.splice(i, 1);
      }
      if (W.motes.length > 400) W.motes.splice(0, W.motes.length - 400);
    }

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      // the controls overlay the bottom of the canvas (see-through), so the play area is the
      // part above them: scale and frame to that, but still draw (and cull) the full canvas
      const ctlPx = Math.min(c.height * 0.8, (RPV ? RPV.panelH || 0 : input.current.ctlH || 0) * dpr);   // a replay: its panel
      const playPx = c.height - ctlPx;
      const s = Math.min(c.width / VIEW_W, playPx / VIEW_MIN_H) * DEV.zoom * (RPV ? RPV.zoom : 1), vw = c.width / s, vh = c.height / s;
      const vhp = playPx / s;
      W.unitPx = s / dpr;
      const pcx = W.p.x + PW / 2, pcy = W.p.y + PH / 2;

      // camera (a replay's is wherever the viewer has dragged it, or on you)
      if (RPV) {
        if (RPV.follow) {                     // framed on you like the live camera, then kept as the centre
          RPV.cx = vw >= WW ? WW / 2 : clamp(RPV.cx - vw / 2, 0, WW - vw) + vw / 2;
          RPV.cy = clamp(RPV.cy - vhp * 0.55, 0, Math.max(0, WH - vhp)) + vhp / 2;
        }
        W.camX = RPV.cx - vw / 2; W.camY = RPV.cy - vhp / 2; RPV.unit = W.unitPx;
      } else {
        const tx = vw >= WW ? (WW - vw) / 2 : clamp(pcx - vw / 2, 0, WW - vw);
        const ty = clamp(pcy - vhp * 0.55, 0, Math.max(0, WH - vhp));
        if (!W.camReady) { W.camX = tx; W.camY = ty; W.camReady = true; }
        W.camX += (tx - W.camX) * 0.15;
        W.camY += (ty - W.camY) * 0.15;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = 'rgb(' + themeFor(W.floor).bg.join(',') + ')';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.setTransform(s, 0, 0, s, -Math.round(W.camX * s), -Math.round(W.camY * s));

      // background and terrain (visible part only)
      // The background sits further back: it slides PARALLAX as far as the terrain does, so
      // it is shifted by the rest of the camera move. It still covers the view at every edge,
      // because the shift only ever pushes it toward the camera.
      const PARALLAX = 0.8;
      const bgox = W.camX * (1 - PARALLAX), bgoy = W.camY * (1 - PARALLAX);
      const bcx = W.camX - bgox, bcy = W.camY - bgoy;
      const bx0 = clamp(Math.floor(bcx / BCELL), 0, BW - 1), by0 = clamp(Math.floor(bcy / BCELL), 0, BH - 1);
      const bx1 = clamp(Math.ceil((bcx + vw) / BCELL) + 1, 1, BW), by1 = clamp(Math.ceil((bcy + vh) / BCELL) + 1, 1, BH);
      ctx.drawImage(bg, bx0, by0, bx1 - bx0, by1 - by0, bx0 * BCELL + bgox, by0 * BCELL + bgoy, (bx1 - bx0) * BCELL, (by1 - by0) * BCELL);
      // the shop's back wall
      if (W.camY + vh > SHOP_Y) {
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
        const label = 'FLOOR ' + W.floor;
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.font = '800 ' + Math.round(wallH * 0.62) + 'px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        const margin = WW * 0.05, span = WW - margin * 2, cyText = SHOP_Y + wallH / 2 + 4;
        for (let i = 0; i < label.length; i++)
          ctx.fillText(label[i], margin + span * (i + 0.5) / label.length, cyText);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
      }

      const tx0 = clamp(Math.floor(W.camX / CELL), 0, CW - 1), ty0 = clamp(Math.floor(W.camY / CELL), 0, CH - 1);
      const tx1 = clamp(Math.ceil((W.camX + vw) / CELL) + 1, 1, CW), ty1 = clamp(Math.ceil((W.camY + vh) / CELL) + 1, 1, CH);
      W.viewW = vw; W.viewH = vh;
      // the decoration layer (pass 2): behind the rock, in front of the back wall
      ctx.drawImage(RPV ? RT.dC : decoC, tx0, ty0, tx1 - tx0, ty1 - ty0, tx0 * CELL, ty0 * CELL, (tx1 - tx0) * CELL, (ty1 - ty0) * CELL);
      ctx.drawImage(RPV ? RT.tC : terrain, tx0, ty0, tx1 - tx0, ty1 - ty0, tx0 * CELL, ty0 * CELL, (tx1 - tx0) * CELL, (ty1 - ty0) * CELL);
      // the burning pixels, over the art they're eating: colour by how much fuel is left, and a
      // new flicker each fire tick. Drawn under the fog, so fire you haven't seen stays hidden;
      // the glow on top comes after the fog, only on ground you have seen (fireVis).
      W.fireVis.length = 0;
      if (W.fire.list.length) {
        const buckets = [[], [], [], []];
        for (const i of W.fire.list) {
          const x = i % CW, y = (i / CW) | 0;
          if (x < tx0 || x >= tx1 || y < ty0 || y >= ty1) continue;
          W.fireVis.push(i);
          const t = W.fire.t[i], h = (Math.imul(i, 2654435761) + W.fireN * 40503) >>> 30;
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
      const TH = themeFor(W.floor);
      const onView = (x, y, m) => x > W.camX - m && x < W.camX + vw + m && y > W.camY - m && y < W.camY + vh + m;
      for (const pr of W.props)
        if (pr.x + pr.r > W.camX - 70 && pr.x + pr.l < W.camX + vw + 70 && pr.y + pr.b > W.camY - 90 && pr.y + pr.t0 < W.camY + vh + 90)
          drawProp(ctx, pr, W.time, TH);
      for (const q of W.dparts) {
        if (q.glow) continue;
        ctx.globalAlpha = Math.min(1, q.life / q.max * 3);
        ctx.fillStyle = q.c; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
      }
      ctx.lineWidth = 0.8;
      for (const q of W.amb) {
        if (q.glow) continue;
        ctx.globalAlpha = Math.min(1, q.life);
        if (q.streak) {
          ctx.strokeStyle = q.c; ctx.beginPath();
          ctx.moveTo(q.x - Math.sign(q.vx) * q.streak, q.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        } else { ctx.fillStyle = q.c; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
      }
      ctx.fillStyle = rgbA(mix(TH.rock[1], [255, 255, 255], 0.2));
      for (const dv of W.devils) {                          // a dust devil: a funnel of grit
        ctx.globalAlpha = 0.7 * Math.min(1, dv.life / 1.5, (dv.max - dv.life) / 1);
        for (let k = 0; k < 24; k++) {
          const hh = k / 24 * 30, r = 1.5 + hh * 0.35, a = W.time * 10 + k * 1.1;
          ctx.fillRect(dv.x + Math.cos(a) * r + Math.sin(W.time * 3 + k) - 0.6, dv.y - hh - 0.6, 1.2, 1.2);
        }
      }
      for (const cl of W.clouds) {                          // a burst pod's spore cloud
        const a = Math.min(1, cl.life / 1.5) * 0.28;
        for (let k = 0; k < 5; k++) {
          const ang = k * 1.26 + W.time * 0.6, rr = cl.r * 0.45;
          ctx.globalAlpha = a; ctx.fillStyle = '#a8d85a';
          ctx.beginPath(); ctx.arc(cl.x + Math.cos(ang) * rr, cl.y + Math.sin(ang) * rr * 0.7, cl.r * 0.6, 0, 6.29); ctx.fill();
        }
      }
      for (const rg of W.rings) {                           // a noise going out
        ctx.globalAlpha = 1 - rg.t / 0.9; ctx.strokeStyle = '#f0e6ff'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(rg.x, rg.y, 8 + rg.t * 140, 0, 6.29); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // exit portal: a glowing pool with a slow swirl of dashes round its rim
      const pulse = 0.55 + 0.25 * Math.sin(W.time * 3);
      const pcxE = W.portal.x + W.portal.w / 2, pcyE = W.portal.y + W.portal.h / 2;
      ctx.globalAlpha = pulse * 0.35;
      ctx.fillStyle = COL.portal;
      ctx.beginPath(); ctx.ellipse(pcxE, pcyE, W.portal.w, W.portal.h * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = pulse;
      ctx.beginPath(); ctx.ellipse(pcxE, pcyE, W.portal.w / 2, W.portal.h / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#d8fff0';
      ctx.beginPath(); ctx.ellipse(pcxE, pcyE, W.portal.w * 0.22, W.portal.h * 0.26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#c8ffe4'; ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 5]); ctx.lineDashOffset = W.time * 12;
      ctx.beginPath(); ctx.ellipse(pcxE, pcyE, W.portal.w * 0.62, W.portal.h * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // smoke
      for (const m of W.smoke) {
        ctx.fillStyle = m.c || COL.smoke;
        ctx.globalAlpha = Math.max(0, m.life / m.max) * (m.a || 0.5);
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // static fields
      for (const f of W.fields) {
        if (f.y > W.camY + vh + f.r || f.y < W.camY - f.r) continue;
        const t = f.life / f.max;
        const beat = 0.75 + 0.25 * Math.sin(W.time * (f.field === 'mine' ? 7 : 3));
        ctx.globalAlpha = 0.14 * beat * (f.field === 'mine' || f.field === 'dormant' ? 2 : 1);
        ctx.fillStyle = f.col;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (f.field === 'mine' ? 0.35 : 1), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.55 * beat;
        ctx.strokeStyle = f.col;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.lineDashOffset = -W.time * 14;
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
          if (Math.sin(W.time * bl) > 0.3) { ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffffff'; ctx.fillRect(f.x - 0.6, f.y - 0.6, 1.2, 1.2); }
        } else if (f.field === 'dormant') {     // a dull orange crystal
          dia(3, '#b86a1c', '#ffd08a');
        } else if (f.field === 'slow') {        // an ice-white star
          ctx.strokeStyle = '#e8f8ff'; ctx.lineWidth = 0.8;
          ctx.beginPath();
          for (let k = 0; k < 3; k++) { const a = k * 1.047 + W.time * 0.4; ctx.moveTo(f.x - Math.cos(a) * 4, f.y - Math.sin(a) * 4); ctx.lineTo(f.x + Math.cos(a) * 4, f.y + Math.sin(a) * 4); }
          ctx.stroke();
        } else if (f.field === 'shield') {      // two shimmering arcs turning against each other
          ctx.strokeStyle = f.col; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.7 * beat;
          for (const [a0, sgn] of [[W.time * 1.3, 1], [-W.time * 1.7, -1]]) {
            ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (sgn > 0 ? 0.92 : 0.84), a0, a0 + 2.2); ctx.stroke();
            ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (sgn > 0 ? 0.92 : 0.84), a0 + 3.14, a0 + 5.3); ctx.stroke(); }
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#d8f0ff'; ctx.beginPath(); ctx.arc(f.x, f.y, 2.5, 0, 6.283); ctx.fill();
        } else if (f.field === 'heal') {        // a green cross
          ctx.fillStyle = f.col; ctx.fillRect(f.x - 1.2, f.y - 4, 2.4, 8); ctx.fillRect(f.x - 4, f.y - 1.2, 8, 2.4);
        } else if (f.field === 'storm') {       // the cloud itself, over the top of the circle, with rain under it
          const cy = f.y - f.r * 0.85, t = Math.min(1, (f.max - f.life) * 3, f.life * 2);
          ctx.globalAlpha = 0.85 * t;
          for (let k = 0; k < 7; k++) { const ox = (k - 3) * f.r * 0.28, oy = Math.sin(k * 1.7 + W.time * 0.8) * 2.5;
            ctx.fillStyle = k % 2 ? '#3a3e4a' : '#4c5160';
            ctx.beginPath(); ctx.arc(f.x + ox, cy + oy, f.r * (0.22 + 0.08 * Math.sin(k * 2.3)), 0, 6.283); ctx.fill(); }
          ctx.globalAlpha = 0.35 * t; ctx.strokeStyle = '#9ec8ff'; ctx.lineWidth = 0.6;
          ctx.beginPath();
          for (let k = 0; k < 18; k++) { const x = f.x + (((k * 37.3 + W.time * 15) % (f.r * 1.8)) - f.r * 0.9),
            y = cy + ((k * 23.7 + W.time * 160) % (f.r * 1.7));
            ctx.moveTo(x, y); ctx.lineTo(x - 0.6, y + 4); }
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (f.field === 'glitter') {     // twinkling violet motes all over
          for (let k = 0; k < 10; k++) { const a = k * 2.4 + W.time * 0.3, r = f.r * ((k * 0.37) % 1);
            const tw = Math.sin(W.time * 9 + k * 1.3); if (tw < 0.2) continue;
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
      for (const L of W.webs) { ctx.moveTo(L.a0x, L.a0y); ctx.lineTo(L.b0x, L.b0y); }
      for (const e of W.enemies) {
        const sh = e.sp && e.sp.mode === 'shoot' && e.sp.shot;
        if (sh) { ctx.moveTo(sh.ax0, sh.ay0); ctx.lineTo(sh.x + sh.dx * Math.min(sh.t, sh.len), sh.y + sh.dy * Math.min(sh.t, sh.len)); }
      }
      ctx.stroke();
      ctx.globalAlpha = 0.85; ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (const b of W.silk) { ctx.moveTo(b.ax, b.ay); ctx.lineTo(b.x, b.y); }
      for (const s of W.strings) { ctx.moveTo(s.ax, s.ay); ctx.lineTo(W.p.x + s.ox, W.p.y + s.oy); }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // enemies
      for (const e of W.enemies) {
        const ey = e.ty;
        if (ey > W.camY + vh + 20 || ey < W.camY - 20 || e.x < W.camX - 20 || e.x > W.camX + vw + 20) continue;
        drawEnemy(ctx, e, W.time);
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
          const tw = Math.sin(W.time * 40) > 0;
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
          if (Math.sin(W.time * 12) > 0) dot(b.x + ux * s * 1.2, b.y + uy * s * 1.2, 0.9, '#ff3a2a', 1);
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
      for (const b of W.enemyShots) {
        if (b.goo) {                           // poison spit: a wobbling glob with a wet highlight
          const s = b.size, wob = 1 + 0.12 * Math.sin(W.time * 30 + b.x * 0.1);
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
      for (const b of W.bullets) {
        if (b.hidden) continue;                 // Buzzsaw cuts without drawing a circle
        if (b.pull) {                           // Black Hole: purple haze, starry black core
          const r = b.size, core = b.eat || r * 0.78, beat = 1 + 0.06 * Math.sin(W.time * 6 + b.spin);
          const g = ctx.createRadialGradient(b.x, b.y, core * 0.8, b.x, b.y, r * 1.55 * beat);
          g.addColorStop(0, 'rgba(197,140,255,0.75)');
          g.addColorStop(0.3, 'rgba(150,90,255,0.35)');
          g.addColorStop(1, 'rgba(110,50,220,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(b.x, b.y, r * 1.55 * beat, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#050208';
          ctx.beginPath(); ctx.arc(b.x, b.y, core, 0, Math.PI * 2); ctx.fill();
          for (let k = 0; k < 14; k++) {       // twinkling stars wheeling inside
            const tw = Math.sin(W.time * 8 + k * 1.7);
            if (tw < 0.1) continue;
            const ang = k * 2.4 + W.time * (0.5 + (k % 3) * 0.35), rad = core * (0.15 + ((k * 0.37) % 0.75));
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
      for (const a of W.arcs) drawBolt(a.pts, a.col, a.w, 1 - a.t / a.max);
      // instant beams, which fade over a few frames
      for (const bm of W.beams) {
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
      if (W.arrival.y < W.camY + vh + 40 && W.arrival.y > W.camY - 40) {
        const sway = 0.5 + 0.18 * Math.sin(W.time * 1.6);
        ctx.fillStyle = '#4a4550';
        ctx.fillRect(W.arrival.x - 16, W.arrival.y + 12, 32, 5);
        ctx.globalAlpha = 0.22 * sway;
        ctx.fillStyle = COL.enemy;
        ctx.beginPath(); ctx.ellipse(W.arrival.x, W.arrival.y, 17, 21, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.5 * sway;
        ctx.beginPath(); ctx.ellipse(W.arrival.x, W.arrival.y, 10, 14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#6c6480'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(W.arrival.x, W.arrival.y, 13, 17, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(233,236,242,0.34)';
        ctx.font = '600 7px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WAY IN', W.arrival.x, W.arrival.y - 22);
        ctx.textAlign = 'left';
      }

      // shop stock on its plinths
      for (const it of W.stock) {
        if (it.y > W.camY + vh + 40 || it.y < W.camY - 40) continue;
        const bob = Math.sin(W.time * 2 + it.x) * 2;
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
      for (const g of W.coins) {
        if (g.y > W.camY + vh + 30 || g.y < W.camY - 30) continue;
        const bob = Math.sin(W.time * 4 + g.t) * 1.5;
        ctx.fillStyle = '#d8a52a';
        ctx.beginPath(); ctx.ellipse(g.x, g.y + bob, 3.2, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = COL.flame2;
        ctx.beginPath(); ctx.ellipse(g.x - 0.8, g.y - 0.8 + bob, 1.2, 1.8, 0, 0, Math.PI * 2); ctx.fill();
      }

      // pickups
      for (const q of W.pickups) {
        const qy = q.y + Math.sin(W.time * 2 + q.t) * 3;
        if (qy > W.camY + vh + 30 || qy < W.camY - 30 || q.x < W.camX - 30 || q.x > W.camX + vw + 30) continue;
        if (q.kind === 'gun') {
          // a gun you've never held glows, with sparks streaking out of it; one you swapped
          // out and left on the ground doesn't, so you can tell new from discarded at a glance
          if (!q.old) drawGunGlow(ctx, q.x, qy, W.time, q.t);
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
      for (const r of W.rooms) {
        if (r.taken) continue;
        if (r.y > W.camY + vh + 40 || r.y < W.camY - 40 || r.x < W.camX - 40 || r.x > W.camX + vw + 40) continue;
        const bob = Math.sin(W.time * 2 + r.x) * 2.5;
        ctx.fillStyle = '#4a4550';
        ctx.fillRect(r.x - 12, r.y + 14, 24, 5);
        ctx.fillRect(r.x - 7, r.y + 5, 14, 10);
        if (r.kind === 'perk') {
          const pk = PERKS[r.id], col = pk.tint || COL.portal;
          ctx.globalAlpha = 0.22 + 0.12 * Math.sin(W.time * 3);
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(r.x, r.y + bob, 16, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = col;
          ctx.font = '700 20px system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(pk.glyph, r.x, r.y + 0.5 + bob);
          ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
        } else {
          ctx.globalAlpha = 0.25 + 0.12 * Math.sin(W.time * 3);
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
      for (const bn of W.burns) {
        const t = bn.life / bn.max;
        ctx.globalAlpha = t * 0.8;
        ctx.fillStyle = t > 0.5 ? COL.flame2 : COL.flame;
        ctx.beginPath(); ctx.arc(bn.x, bn.y, 3 + (1 - t) * 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // sparks and debris
      for (const q of W.sparks) {
        ctx.fillStyle = q.c;
        ctx.globalAlpha = Math.max(0, q.life / q.max);
        ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
      }
      ctx.globalAlpha = 1;

      // magic motes: the Black Hole's trail and the portals' drift, added on as light
      ctx.globalCompositeOperation = 'lighter';
      for (const q of W.motes) {
        if (q.y > W.camY + vh + 20 || q.y < W.camY - 20) continue;
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
      for (const f of W.flashes) {
        const t = f.t / 0.25;
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = COL.flame;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.6 + 0.5 * t), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = COL.flame2;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.35 + 0.3 * t), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // jet flame
      if (W.p.flame > 0) {
        let fx = -W.p.jx, fy = -W.p.jy + 0.8;
        const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
        const len = 6 + W.p.flame * 16 + Math.random() * 3;
        const bx = pcx, by = W.p.y + PH - 2;
        ctx.fillStyle = COL.flame;
        ctx.beginPath(); ctx.moveTo(bx - 4, by); ctx.lineTo(bx + 4, by); ctx.lineTo(bx + fx * len, by + fy * len); ctx.fill();
        ctx.fillStyle = COL.flame2;
        ctx.beginPath(); ctx.moveTo(bx - 2, by); ctx.lineTo(bx + 2, by); ctx.lineTo(bx + fx * len * 0.55, by + fy * len * 0.55); ctx.fill();
      }

      // aim, grenade arc preview, gun
      const R = W.p.aim;
      const held = input.current.loadout.guns[input.current.loadout.sel];
      const ax = R.show ? R.nx : W.p.face, ay = R.show ? R.ny : 0;
      const gy = W.p.y + PH * 0.52;

      // where the next pull actually goes, mods and all — only with the Trajectory Sight perk
      const tvis = R.vis == null ? 1 : R.vis;
      if (!RPV && !W.p.dead && R.show && held && W.pb.trajectory && tvis > 0) {
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
          const tsh = Object.assign({}, sh, { bounce: sh.bounce + W.pb.bounce,
            homing: Math.max(sh.homing, W.pb.homing), speed: sh.speed * W.pb.speed * bhSp(sh) });
          for (const off of cone) {
            const a = Math.atan2(R.ny, R.nx) + off * Math.PI / 180;
            tracePath(tsh, pcx, gy, Math.cos(a), Math.sin(a), (x, y) => solidAt(W, x, y), W.enemies, aimPath,
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
      if (W.p.dead) ctx.globalAlpha = 0.35;
      const flashing = W.p.hitT > 0 && Math.floor(W.p.hitT * 30) % 2 === 0;
      const running = W.p.onGround && Math.abs(W.p.vx) > 15;
      const gait = running ? Math.sin(W.time * 15) : 0;
      drawRunner(ctx, W.p.x, W.p.y, PW, PH, W.p.face, gait, !W.p.onGround, W.p.flame, flashing);
      if (!W.p.dead) drawGun(ctx, pcx + ax * 2.5, gy, Math.atan2(ay, ax), 0.55, gunAccent(held));
      // the torch, in the hand the gun is not in
      if (!W.p.dead) { const th = torchHand(); drawTorch(ctx, th.x, th.y, ax >= 0 ? -1 : 1, W.flick, W.torchP, W.leanX, W.leanY, W.time); }
      // a small aim crosshair at DEV.aimDist out, rotating round you with the aim: a "+"
      // with the centre cut out (two short verticals, two short horizontals), drawn as thin
      // as the thumbstick lines (~1.5 css px, so 1.5/unitPx world units, whatever the zoom)
      if (!W.p.dead) {
        const cxp = pcx + ax * DEV.aimDist, cyp = gy + ay * DEV.aimDist;
        const inr = 1.25, outr = 3;            // gap radius, arm end (half the v55 size)
        ctx.strokeStyle = 'rgba(255,255,255,0.92)';
        ctx.lineWidth = 1.5 / W.unitPx;
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
      if (W.pb.shield && W.p.shieldReady && !W.p.dead) {
        ctx.globalAlpha = 0.35 + 0.15 * Math.sin(W.time * 4);
        ctx.strokeStyle = '#7ad7ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pcx, pcy, PW * 1.15, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Angry Ghost: a pale wisp that drifts at your shoulder
      if (W.pb.ghost && W.ghost && !W.p.dead) {
        const gb = Math.sin(W.time * 3) * 2;
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#c9a6ff';
        ctx.beginPath(); ctx.arc(W.ghost.x, W.ghost.y + gb, 6, Math.PI, 0);
        ctx.lineTo(W.ghost.x + 6, W.ghost.y + gb + 6);
        ctx.lineTo(W.ghost.x + 2, W.ghost.y + gb + 4);
        ctx.lineTo(W.ghost.x - 2, W.ghost.y + gb + 6);
        ctx.lineTo(W.ghost.x - 6, W.ghost.y + gb + 4);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#3a2f52';
        ctx.fillRect(W.ghost.x - 3, W.ghost.y + gb - 1, 1.6, 2.4);
        ctx.fillRect(W.ghost.x + 1.4, W.ghost.y + gb - 1, 1.6, 2.4);
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
      W.torchR = clamp(sight * LAMP_REACH * (0.5 + 0.55 * W.flick), 120, 1400);
      W.visPts = visPoly(pcx, pcy, sight, (cx, cy) => solidCell(W, cx, cy), VIS_RAYS);
      fogReveal(W.seen, pcx, pcy, sight, W.visPts, VIS_RAYS);   // line of sight lifts the fog
      if (!RPV || RPV.fog) {                                 // a replay can turn the fog off
        // bake the visible slab of the overlay every frame: the base darkness is the fog
        // state, then the lamp brightens the cells the fog has already been lifted from
        const fdat = fogImg.data;
        const dim = Math.round(255 * DEV.fogDim), dark = Math.round(255 * DEV.fogDark);
        const lr2 = W.torchR * W.torchR;
        const fx0 = clamp(Math.floor(W.camX / FOG_U) - 1, 0, FW - 1), fy0 = clamp(Math.floor(W.camY / FOG_U) - 1, 0, FH - 1);
        const fx1 = clamp(Math.ceil((W.camX + vw) / FOG_U) + 2, 1, FW), fy1 = clamp(Math.ceil((W.camY + vh) / FOG_U) + 2, 1, FH);
        for (let cy = fy0; cy < fy1; cy++) {
          const ddy = (cy + 0.5) * FOG_U - pcy;
          for (let cx = fx0; cx < fx1; cx++) {
            const i = cy * FW + cx, k = i * 4;
            fdat[k] = 9; fdat[k + 1] = 10; fdat[k + 2] = 14;
            let s = W.seen[i];
            // push the dark off ground you have seen: an unseen cell that borders a seen one
            // is treated as remembered (dim + lamp), so a bit more of the uncovered surface
            // shows instead of the darkness sitting right on its edge
            if (!s && !(W.deepFog && W.deepFog[i]) && ((cx > 0 && W.seen[i - 1]) || (cx < FW - 1 && W.seen[i + 1]) ||
                (cy > 0 && W.seen[i - FW]) || (cy < FH - 1 && W.seen[i + FW]) ||
                (cx > 0 && cy > 0 && W.seen[i - FW - 1]) || (cx < FW - 1 && cy > 0 && W.seen[i - FW + 1]) ||
                (cx > 0 && cy < FH - 1 && W.seen[i + FW - 1]) || (cx < FW - 1 && cy < FH - 1 && W.seen[i + FW + 1]))) s = 1;
            let a = s === 2 ? 0 : s ? dim : dark;
            if (s && a) {                        // the lamp only reaches ground the fog has lifted
              const ddx = (cx + 0.5) * FOG_U - pcx, dd2 = ddx * ddx + ddy * ddy;
              if (dd2 < lr2) {
                const t = Math.sqrt(dd2) / W.torchR;               // 0 at your feet, 1 at the edge
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
      const gl = clamp(0.82 + W.glowN + 0.08 * Math.sin(W.time * 23) + 0.06 * Math.sin(W.time * 37), 0.5, 1.1);
      const scOn = sc => !(sc.y > W.camY + vh + 30 || sc.y < W.camY - 30 || sc.x < W.camX - 30 || sc.x > W.camX + vw + 30) &&
        fogLit(W, sc.x, sc.y);
      for (const sc of W.sconces) {
        if (!scOn(sc)) continue;
        const sg = 0.85 + 0.15 * Math.sin(W.time * 11 + sc.ph) * Math.sin(W.time * 5.3 + sc.ph);
        glowAt(ctx, sc.x, sc.y - 6, 34, 0.16 * sg, '255,140,50');
        glowAt(ctx, sc.x, sc.y - 7, 9, 0.45 * sg, '255,190,90');
      }
      // lit props and glowing motes, only where the fog has lifted — except the eyes, which
      // watch from the dark
      for (const pr of W.props) {
        if (!(pr.k === 'lamp' || pr.k === 'vent' || pr.k === 'shard' || pr.k === 'eyes' || pr.k === 'matter' ||
          (pr.k === 'drip' && pr.st === 'lava')) || !onView(pr.x, pr.y, 60)) continue;
        if (pr.k !== 'eyes' && !fogLit(W, pr.x, pr.y)) continue;
        propGlow(ctx, pr, W.time, TH, Math.hypot(pr.x - pcx, pr.y - pcy), W.torchR);
      }
      // and the green round each jelly glows and twinkles in its colour (plantGlow)
      for (const e of W.enemies)
        if (e.je && onView(e.x, e.ty, 160) && fogLit(W, e.x, e.ty)) plantGlow(e, TH);
      // glowing creatures (the jellyfish) light the cave round them, flaring as they pulse.
      // Radius, brightness and flare are its kp+'GlowR' / 'Glow' / 'Flare' knobs, and like
      // every other light out here it shows only where the fog has lifted
      for (const e of W.enemies) {
        const k = e.k;
        if (!k.glow || !k.kp || !onView(e.x, e.ty, 120) || !fogLit(W, e.x, e.ty)) continue;
        const u = (e.je && e.je.u) || { glowR: 0.5, glow: 0.5, flare: 0.5 }, sh = e.je ? e.je.shape : 0;
        const a = kru(k.kp + 'Glow', u.glow) * (1 + kru(k.kp + 'Flare', u.flare) * sh);
        const rgb = e.je ? hexRgb(jcol('jeColGlow', e.je.u.col)) : k.glow;
        glowAt(ctx, e.x, e.ty, kru(k.kp + 'GlowR', u.glowR), a, rgb);
        glowAt(ctx, e.x, e.ty, e.r * 1.6, a * 1.4, rgb);
      }
      for (const b of W.enemyShots) if (b.glow && onView(b.x, b.y, 30) && fogLit(W, b.x, b.y)) glowAt(ctx, b.x, b.y, b.size * 6, 0.3, b.glow);
      // v95: your glowing shots light the cave round them (the Bubble Spark most of all)
      for (const b of W.bullets) if (b.light && !b.hidden && onView(b.x, b.y, 50) && fogLit(W, b.x, b.y))
        glowAt(ctx, b.x, b.y, b.lightR || 20, 0.28, b.light);
      // fire: the burning pixels brighten and throw a warm glow — only on ground you have seen
      if (W.fireVis.length) {
        ctx.fillStyle = 'rgba(255,140,50,0.32)';
        ctx.beginPath();
        for (const i of W.fireVis) {
          const x = (i % CW) * CELL, y = ((i / CW) | 0) * CELL;
          if (W.seen[clamp(Math.floor(y / FOG_U), 0, FH - 1) * FW + clamp(Math.floor(x / FOG_U), 0, FW - 1)]) ctx.rect(x, y, CELL, CELL);
        }
        ctx.fill();
        const st = Math.max(1, Math.ceil(W.fireVis.length / 24));
        for (let k = W.fireN % st; k < W.fireVis.length; k += st) {
          const i = W.fireVis[k], x = (i % CW + 0.5) * CELL, y = (((i / CW) | 0) + 0.5) * CELL;
          if (fogLit(W, x, y)) glowAt(ctx, x, y, 20, Math.min(0.14, 0.03 + W.fireVis.length / 3000) * W.flick, '255,120,40');
        }
      }
      for (const e of W.enemies)
        if (e.burn > 0 && onView(e.x, e.ty, 40) && fogLit(W, e.x, e.ty)) glowAt(ctx, e.x, e.ty, e.r * 2.4, 0.22 * W.flick, '255,130,50');
      for (const pr of W.firePlants)
        if (pr.burn && !pr.gone && onView(pr.x, pr.y + pr.len, 40) && fogLit(W, pr.x, pr.y + pr.len))
          glowAt(ctx, pr.x, pr.y + pr.len, 16, 0.2 * W.flick, '255,130,50');
      if (W.p.burn > 0 && !W.p.dead) glowAt(ctx, W.p.x + PW / 2, W.p.y + PH / 2, 22, 0.25 * W.flick, '255,130,50');
      for (const list of [W.dparts, W.amb]) for (const q of list) {
        if (!q.glow || !onView(q.x, q.y, 10) || !fogLit(W, q.x, q.y)) continue;
        ctx.globalAlpha = Math.min(1, q.life / (q.max * 0.3));
        ctx.fillStyle = q.c; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
      }
      ctx.globalAlpha = 1;
      if (!W.p.dead) {
        const th = torchHand(), gfx = th.x + (ax >= 0 ? -1 : 1) * 1.6, gfy = th.y - 11;
        glowAt(ctx, gfx, gfy, 70 * (0.9 + 0.1 * gl), 0.2 * gl, '255,150,60');            // the second light
        glowAt(ctx, gfx + W.leanX * 0.5, gfy + W.leanY * 0.5, 12, 0.5 * gl, '255,190,90');   // the halo
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const sc of W.sconces) if (scOn(sc)) drawSconce(ctx, sc.x, sc.y, W.time, sc.ph);
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
      const MHP = maxHp(W, G);
      const gpas = held ? gunPassives(held) : null;
      // recharge / cast-delay "readiness": 1 when ready, dropping to 0 the moment it fires
      // and filling back over its own time — so the ring that spends the most time refilling
      // is the one gating your fire. Both normalise by their own max so the wipe is 0..1.
      const effRech = held ? Math.max(0.001, effRecharge(held) * W.pb.rech) : 1;
      input.current.hud = {
        hp: MHP > 0 ? Math.max(0, Math.min(1, W.p.hp / MHP)) : 0,
        low: W.p.hp <= 30,
        fuel: Math.max(0, Math.min(1, W.p.fuel)),
        empty: !!W.p.empty,
        mana: held ? Math.max(0, Math.min(1, held.mana / (held.manaMax + gpas.manaMax))) : 0,
        rech: held ? (held.rechT > 0 ? clamp(1 - held.rechT / effRech, 0, 1) : 1) : 0,
        cast: held ? (held.delayT > 0 && held.delayMax ? clamp(1 - held.delayT / held.delayMax, 0, 1) : 1) : 0,
        recharging: !!(held && held.rechT > 0),
        hasGun: !!held,
      };

      // ---- radar perks: point at the nearest enemy / mod / gun still out there ----
      if (W.pb.radarEnemy || W.pb.radarItem || W.pb.radarWand) {
        const cwv = c.width / dpr, chv = playPx / dpr, m = 18;
        const nearest = list => {
          let best = null, bd = 1e18;
          for (const t of list) { const d = (t.x - pcx) * (t.x - pcx) + ((t.ty || t.y) - pcy) * ((t.ty || t.y) - pcy); if (d < bd) { bd = d; best = t; } }
          return best;
        };
        const marker = (t, col) => {
          if (!t) return;
          const sx = (t.x - W.camX) * W.unitPx, sy = ((t.ty || t.y) - W.camY) * W.unitPx;
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
        if (W.pb.radarEnemy) marker(nearest(W.enemies), PERKS.eradar.tint);
        if (W.pb.radarItem) marker(nearest(W.pickups.filter(q => q.kind === 'mod')), '#b57cff');
        if (W.pb.radarWand) marker(nearest(W.pickups.filter(q => q.kind === 'gun')), COL.bullet);
      }

      // pickup messages
      ctx.textAlign = 'center';
      const ch = playPx / dpr;
      for (let i = 0; i < W.toasts.length; i++) {
        const tm = W.toasts[i];
        ctx.globalAlpha = Math.min(1, tm.t * 1.5);
        ctx.fillStyle = COL.text;
        ctx.font = '600 14px system-ui, sans-serif';
        ctx.fillText(tm.text, cw / 2, ch - 18 - (W.toasts.length - 1 - i) * 19);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';

      ctx.textAlign = 'center';
      if (W.levelT < 3) {
        ctx.fillStyle = COL.text;
        ctx.globalAlpha = Math.min(1, 3 - W.levelT);
        ctx.font = '700 22px system-ui, sans-serif';
        ctx.fillText(themeFor(W.floor).name, cw / 2, 196);
        ctx.font = '500 14px system-ui, sans-serif';
        ctx.fillText('Find the green exit at the top', cw / 2, 218);
        ctx.fillText('Buy and fit mods here, then climb', cw / 2, 236);
        ctx.globalAlpha = 1;
      }
      const msgY = 196;
      ctx.fillStyle = COL.text;
      if (W.p.dead) {
        ctx.font = '700 22px system-ui, sans-serif';
        ctx.fillText('You were shot down', cw / 2, msgY);
        ctx.font = '500 14px system-ui, sans-serif';
        ctx.fillText('Tap the right stick to restart', cw / 2, msgY + 22);
      } else if (W.enemies.length === 0) {
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
        for (let k = 0; k < W.miniEdgeIdx.length; k++) {
          const i = W.miniEdgeIdx[k];
          const tx = (i % MMW) * MINI_D, ty = ((i / MMW) | 0) * MINI_D;
          const fi = ((ty / FOG) | 0) * FW + ((tx / FOG) | 0);
          if (W.seen[fi]) mini32[i] = 0xe6ffffff;            // white, ~0.9 alpha
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
        for (const r of W.rooms) {
          if (!roomSeen(W, r)) continue;
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
        for (const q of W.pickups) {
          if (q.taken || !fogLit(W, q.x, q.y)) continue;
          const col = q.kind === 'gun' ? '#ffd23c' : '#46e07a';
          ctx.beginPath(); ctx.arc(mX(q.x), mY(q.y), 2.6, 0, Math.PI * 2);
          if (q.old) { ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke(); }
          else { ctx.fillStyle = col; ctx.fill(); }
        }
        // you: a bigger dot with a white rim, so it can't be mistaken for a gun
        ctx.fillStyle = '#ffd23c'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(mX(W.p.x + PW / 2), mY(W.p.y + PH / 2), 4, 0, Math.PI * 2);
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
          const wit = input.current.witness;
          if (rv.t >= wit.t1) {                  // the end: round again, or stop there
            if (rv.loop) rv.t = wit.t0; else { rv.t = wit.t1; rv.playing = false; }
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
      if (W.jetLoop) W.jetLoop.stop();
      if (W.portalLoop) W.portalLoop.stop();
      if (W.matterLoop) W.matterLoop.stop();
      for (const h of W.bhLoops.values()) h.stop();
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
