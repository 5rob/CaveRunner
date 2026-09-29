// The game itself: the canvas component. One closure holds the live level and runs the
// loop (step, draw, cast, bullets, fields, the enemy loop, the recorder); App talks to it
// through the input ref. Phase 3 of REFACTOR.md takes it apart.

import { VENT_H, drawProp, propCol, propGlow, rgbA } from '../art/props.js';
import { drawGun, drawGunGlow, drawRunner, drawSconce, drawTorch, glowAt } from '../art/sprites.js';
import { HEAR_FIRE, jetPitch, rustleStep } from '../audio/recipes.js';
import { SFX } from '../audio/sfx.js';
import {
  AIM_DEAD, AIR_ACC, BCELL, BED, BH, BRICK, BW, CELL, CH, CLIMB, COIN_PULL, COL, CW, DEAD, FH,
  FOG, FOG_DARK, FOG_DIM, FOG_U, FUEL_DRAIN, FUEL_REGEN, FUEL_RESTART, FW, GRAVITY, GROUND_ACC,
  JET, JET_ACC, LAMP_REACH, MINI_D, MMH, MMW, PATROL_R, PH, PICKUP_COOL, PLAYER_HP, PW,
  SHOP_FLOOR, SHOP_Y, SIGHT, VIEW_MIN_H, VIEW_W, WALK, WEB_HAND, WH, WW
} from '../core/consts.js';
import { angDiff, approach, clamp, hexArr, hexRgb, mix, turn } from '../core/util.js';
import { roamStep } from '../creatures/common.js';
import { drawEnemy } from '../creatures/draw.js';
import {
  jellyBell, jellyPal, jellyStep, plantGlowFill, plantWhite, tentacleTouch
} from '../creatures/jelly.js';
import { pathLen, ratSpread, ratStep } from '../creatures/rat.js';
import { spiderStep } from '../creatures/spider.js';
import { HUNTERS, enemyFor } from '../data/creatures.js';
import { PERKS, perkBag } from '../data/perks.js';
import { themeFor } from '../data/themes.js';
import { DEV, jcol, kr, kru, spr } from '../dev/knobs.js';
import {
  RP_AFTER, RP_BEFORE, RP_H, RP_HZ, RP_KEEP, RP_W, rpClone, rpCut, rpFrame, rpMerge, rpPaste
} from '../replay/replay.js';
import { SAVE_KEY, clearSave } from '../save/save.js';
import { effRecharge, gunPassives, planCast } from '../spells/cast.js';
import { caveGun, gunAccent, shuffleOrder } from '../spells/guns.js';
import { MODS, VACUUM_WAIT, famCol } from '../spells/mods.js';
import {
  DRIFT_ACC, DRIFT_CHASE, DRIFT_R, bhSp, driftStep, tracePath, wigTurn
} from '../spells/trace.js';
import { PLANTS, PROP_DMG, archAt, archNear, propAnchored } from '../world/decorate.js';
import {
  FIRE_COLS, FIRE_WET, FLAMMABLE, fireArea, fireDouse, fireNear, fireNew, fireStep
} from '../world/fire.js';
import { ROOM_HH, ROOM_HW, makeLevel } from '../world/level.js';
import { NAV, navField, navWay } from '../world/nav.js';
import { ORE_GOLD } from '../world/veins.js';
import {
  VIS_RAYS, fogReveal, fogStart, losClear, nestFog, rayDist, visPoly
} from '../world/vision.js';
import { builtAt } from '../world/zones.js';
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
    // ---- perks ----
    // Everything the perks you are carrying add up to, recomputed whenever the run's perk
    // list changes and read all over step() and draw(). Neutral (all multipliers 1, all
    // flags 0) until a perk is found, so a run with no perks behaves exactly as before.
    const refreshBag = () => { W.pb = perkBag(input.current.loadout.perks || []); };
    // the true maximum health: the perk bag's answer plus the running +25 per heart room.
    const maxHp = () => W.pb.maxHp + (input.current.loadout.maxBonus || 0);
    // how far a point is from a web line (anchor to anchor, as drawn), and where on it is closest
    const webNear = (L, x, y) => {
      const vx = L.b0x - L.a0x, vy = L.b0y - L.a0y, ll = vx * vx + vy * vy || 1;
      const u = Math.max(0, Math.min(1, ((x - L.a0x) * vx + (y - L.a0y) * vy) / ll));
      return { x: L.a0x + vx * u, y: L.a0y + vy * u };
    };
    const webDist = (L, x, y) => { const q = webNear(L, x, y); return Math.hypot(q.x - x, q.y - y); };

    const toast = text => { W.toasts.push({ text, t: 2.2 }); if (W.toasts.length > 3) W.toasts.shift(); };
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
      refreshBag();
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
      paintFog();                             // otherwise every floor starts dark again
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

    // Wall torches and lanterns follow the same rule as the loot: they show once the fog
    // over them has lifted (`fogLit`), and never clear it themselves — v59 let them clear
    // a circle round themselves, which lit up every prize room on the map from the start.
    const fogLit = (x, y) => {
      const cx = clamp(Math.floor(x / FOG_U), 0, FW - 1), cy = clamp(Math.floor(y / FOG_U), 0, FH - 1);
      if (W.deepFog && W.deepFog[cy * FW + cx]) return W.seen[cy * FW + cx] > 0;   // a nest room: no soft edge
      // the fog bake's one-cell soft edge counts, so a torch shows exactly when an item there would
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && ny >= 0 && nx < FW && ny < FH && W.seen[ny * FW + nx]) return true;
      }
      return false;
    };
    // a prize room counts as found once any of it has been in your line of sight
    const roomSeen = r => {
      for (let y = r.y - ROOM_HH; y <= r.y + ROOM_HH; y += FOG_U)
        for (let x = r.x - ROOM_HW; x <= r.x + ROOM_HW; x += FOG_U) {
          const cx = clamp(Math.floor(x / FOG_U), 0, FW - 1), cy = clamp(Math.floor(y / FOG_U), 0, FH - 1);
          if (W.seen[cy * FW + cx]) return true;
        }
      return false;
    };
    // Repaint the whole overlay mask from the reveal grid. FW x FH is a few thousand
    // cells, and it only runs on the frames where you actually light something new.
    function paintFog() {
      const d = fogImg.data, dim = Math.round(255 * FOG_DIM), dark = Math.round(255 * FOG_DARK);
      for (let i = 0, k = 0; i < FW * FH; i++, k += 4) {
        d[k] = 9; d[k + 1] = 10; d[k + 2] = 14;
        d[k + 3] = W.seen[i] === 2 ? 0 : W.seen[i] ? dim : dark;
      }
    }
    // the browser tests' way in (game/testhook.js): only on the test page, which sets the flag
    if (window.__TEST) window.__lvl = testHook(W, { tctx, dctx, paintFog, hurt, maxHp, dig, explode, recSample,
      ignite, setAlight, youAlight, REC, RT });
    {
      // picking up where the last session left off, if App found a save
      const sv = input.current.saved;
      input.current.saved = null;
      if (sv) {
        W.floor = sv.floor;
        enterLevel(sv.level);
        if (sv.hp) W.p.hp = Math.min(sv.hp, maxHp());
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

    // ---- terrain queries ----
    const solidCell = (cx, cy) =>
      cx < 0 || cy < 0 || cx >= CW || cy >= CH || W.mat[cy * CW + cx] !== 0;
    const solidAt = (x, y) => solidCell(Math.floor(x / CELL), Math.floor(y / CELL));
    const boxHit = (x, y) => {
      const x0 = Math.floor(x / CELL), x1 = Math.floor((x + PW - 0.001) / CELL);
      const y0 = Math.floor(y / CELL), y1 = Math.floor((y + PH - 0.001) / CELL);
      for (let cy = y0; cy <= y1; cy++) {
        if (cy < 0 || cy >= CH) return true;
        for (let cx = x0; cx <= x1; cx++) {
          if (cx < 0 || cx >= CW || W.mat[cy * CW + cx]) return true;
        }
      }
      return false;
    };
    const lineOfSight = (x0, y0, x1, y1) => losClear(x0, y0, x1, y1, solidCell);
    const enemyAt = (x, y, pad) => {
      for (let j = 0; j < W.enemies.length; j++) {
        const e = W.enemies[j];
        if (Math.hypot(x - e.x, y - e.ty) < e.r + pad) return j;
      }
      return -1;
    };

    // one drop of goo: falls under its own gravity g, lands and sits a moment on rock
    function goo(x, y, vx, vy, g, c, size, c2) {
      if (W.sparks.length > 800) return;
      const life = 0.5 + Math.random() * 0.5;
      W.sparks.push({ x, y, vx, vy, life, max: life, c: Math.random() < 0.35 ? (c2 || '#c8ff8a') : c,
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
        W.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.45, max: 0.45, c: color, size: 3 });
      }
    }
    function hurt(n) {
      if (W.p.dead || n <= 0) return;
      // Permanent Shield soaks a hit whole, then winds back up over a couple of seconds
      if (W.pb.shield && W.p.shieldReady) {
        W.p.shieldReady = false; W.p.shieldT = 2.5;
        burst(W.p.x + PW / 2, W.p.y + PH / 2, 10, '#7ad7ff');
        SFX.ui('shield');
        return;
      }
      W.p.hp = Math.max(0, W.p.hp - n);
      W.p.hitT = 0.3;
      if (W.p.hp > 0) SFX.ui('hurt');
      if (W.p.hp === 0) {
        // Extra Life gets you back up once, at full health
        const LO = input.current.loadout;
        if (W.pb.lives > (LO.usedLives || 0)) {
          LO.usedLives = (LO.usedLives || 0) + 1;
          W.p.hp = maxHp();
          W.p.shieldReady = true; W.p.shieldT = 0;
          burst(W.p.x + PW / 2, W.p.y + PH / 2, 24, '#ff5a36');
          SFX.ui('revive');
          toast('Back from the dead');
          input.current.notify();
          return;
        }
        W.p.dead = true; burst(W.p.x + PW / 2, W.p.y + PH / 2, 24, COL.player);
        W.strings.length = 0;
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
        W.enemyShots.push({ x: e.x + Math.cos(a) * (e.r + 4), y: e.ty + Math.sin(a) * (e.r + 4),
          vx: Math.cos(a) * k.bspd, vy: Math.sin(a) * k.bspd, life: 2.5,
          col: k.col.a, dmg: k.dmg, size: k.body === 'blob' ? 4 : 3, fire: k.fire });
      }
    }
    function damageEnemy(j, dmg) {
      const e = W.enemies[j];
      e.hp -= dmg; e.flash = 0.08;
      if (e.k.kp) e.aggro = true;          // hurt a spider or a jelly and it comes for you
      if (e.hp > 0) { if (dmg >= 0.5) SFX.creature(e.k, 'hurt', e.x, e.ty); return; }
      burst(e.x, e.ty, 16, e.je ? jcol('jeColBody', e.je.u.col) : e.k.col.a);
      SFX.creature(e.k, 'die', e.x, e.ty);
      W.enemies.splice(j, 1);
      e.dead = true;                        // its rats find out they've no home to go to
      if (e.nest) {
        // a nest: its own gold and everything its rats brought home, in a little shower
        const all = Math.round(kr('raNestGold') * W.pb.gold) + e.nest.stash;
        const n = Math.max(1, Math.min(14, Math.ceil(all / 8)));
        for (let k = 0; k < n; k++)
          W.coins.push({ x: e.x + (Math.random() - 0.5) * 8, y: e.y, amount: Math.floor(all / n) + (k < all % n ? 1 : 0),
            t: Math.random() * 6.28, vx: (Math.random() - 0.5) * 100, vy: -80 - Math.random() * 80 });
        SFX.fx('coinland', e.x, e.y);
        return;
      }
      W.coins.push({ x: e.x, y: e.ty,
        amount: Math.round((e.k.gold + Math.floor(Math.random() * 3)) * W.pb.gold),
        t: Math.random() * 6.28, vy: -60 - Math.random() * 40 });
      // a rat drops what it was carrying home
      if (e.carry > 0) W.coins.push({ x: e.x, y: e.ty, amount: e.carry, t: Math.random() * 6.28,
        vx: (Math.random() - 0.5) * 60, vy: -90 - Math.random() * 40 });
    }
    // ---- rats ----
    // A rat's view of the terrain: rock, plus the burrows (so it runs over a hole rather than
    // falling in and wedging in a tunnel it only ever walks as a path). burrow is per floor.
    const ratSolid = (cx, cy) => solidCell(cx, cy) || (W.burrow !== null && W.burrow[cy * CW + cx] === 1);
    // a goal's distance field, kept on `o` and made again when the goal moves or the rock changes
    // a spider's web line under a rat's feet counts as ground: rats run along webs
    const onWebIn = list => (x, y) => { for (const L of list) if (webDist(L, x, y) < 3) return true; return false; };
    const ratOnWeb = onWebIn(W.webs);
    function navFor(o, goal, R) {
      // (the rock changing only counts once a second, or a drill would rebuild them every frame)
      if (!o.F || (o.v !== W.terrainV && W.time - o.t > 1) || Math.hypot(goal.x - o.fx, goal.y - o.fy) > (o === W.navYou ? 12 : 6) ||
          (o === W.navYou && W.time - o.t > 0.4) || (o.wn !== W.webs.length && W.time - o.t > 1)) {
        // only the web lines that cross the field's square, so a floor of webs costs nothing
        const half = (R + 1) * NAV * CELL, near = W.webs.filter(L =>
          Math.max(L.a0x, L.b0x) > goal.x - half && Math.min(L.a0x, L.b0x) < goal.x + half &&
          Math.max(L.a0y, L.b0y) > goal.y - half && Math.min(L.a0y, L.b0y) < goal.y + half);
        o.F = navField(ratSolid, goal.x, goal.y, R, near.length ? onWebIn(near) : null);
        o.v = W.terrainV; o.fx = goal.x; o.fy = goal.y; o.t = W.time; o.wn = W.webs.length;
      }
      return o.F;
    }
    // a new rat, down in nest `n`'s room, on its way out up the tunnel
    function spawnRat(n) {
      const k = enemyFor('rotta', W.floor), P = n.nest.path, m = n.nest.mouth;
      const e = { x: P[0].x, y: P[0].y, ty: P[0].y, r: k.r, phase: Math.random() * 6.28, hp: 1, hpMax: 1,
        cd: 0, flash: 0, lx: 0, ly: 1, hx: m.x, hy: m.y, tgt: null, rest: 0, k, touch: 0, charge: 0,
        home: n, path: P, carry: 0 };
      e.ra = { mode: 'tunnel', vx: 0, vy: 0, nx: 0, ny: -1, on: 0, rest: 0, side: 1, face: 1, s: 0, dir: 1, wait: 0 };
      W.enemies.push(e);
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
        for (const g of W.coins) {
          if (g.nopull > 0 && g.vy < 0) continue;            // still on its way up
          const d = Math.hypot(g.x - e.x, g.y - e.y);
          if (d < bd) { bd = d; want = g; }
        }
        if (want) { goal = want; fast = true; }
        else if (hunting) { goal = { x: pcx, y: W.p.y + PH - 2 }; fast = true; }
        else {
          const R = e.roam || (e.roam = {});
          roamStep(R, e, dt, Math.random, 'ra');
          // keep apart from the other loose rats: the push walks this rat's roam spot away
          // from the crowd, so the pack fans out round the nest
          const D = e.spread || (e.spread = kr('raSpread')), sp = ratSpread(e, W.enemies.filter(o => o.ra && o.ra.mode !== 'tunnel' &&
            Math.abs(o.x - e.x) < D && Math.abs(o.y - e.y) < D), D);
          R.rx += sp.x * D * 1.5 * dt; R.ry += sp.y * D * 1.5 * dt;
          goal = { x: R.rx + sp.x * D, y: R.ry + sp.y * D }; jump = false;
        }
      }
      if (!e.arrive || Math.random() < dt) e.arrive = kr('raArrive');
      // with a job on, it follows the way there (navField) rather than a straight line
      let way = goal, follow = false, air = false;
      if (fast && S && S.mode !== 'tunnel') {
        const F = home ? navFor(N.nest, goal, 100) : want ? navFor(want, goal, 36) : navFor(W.navYou, goal, 56);
        const w = F && navWay(F, e.x, e.y, 1);
        if (w) { way = w.dist > 2 ? w : goal; follow = true; air = w.air && w.dist > 2; }
        // v95: getting no nearer along the way for 4s (hopping back and forth over a gap it
        // can't clear) counts as stuck, the same as standing still
        const job = home ? N : want || W.navYou;
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
        else { const j = W.enemies.indexOf(e); if (j >= 0) W.enemies.splice(j, 1); }
        return;
      }
      // a coin in reach: in its mouth
      if (want && Math.hypot(want.x - e.x, want.y - e.y) < e.r + 5) {
        const i = W.coins.indexOf(want);
        if (i >= 0) { W.coins.splice(i, 1); e.carry = (e.carry || 0) + want.amount; SFX.fx('coinland', e.x, e.y); }
      }
      // you, in reach: a bite, and a coin knocked out of you over its head
      if (hunting && !want && !(e.giveUp > 0) && !(e.carry > 0 && N) && dist < e.r + 12 && e.touch <= 0 && !W.p.dead) {
        const LO = input.current.loadout, broke = !(LO.gold > 0);
        hurt(Math.round(kr('raBite') * (broke ? kr('raBroke') : 1)));
        e.touch = kr('raBiteCd');
        SFX.creature(k, 'bite', e.x, e.y);
        if (!broke) {
          const amt = Math.min(LO.gold, Math.max(1, Math.round(kr('raSteal'))));
          LO.gold -= amt;
          input.current.notify();
          const side = e.x >= pcx ? 1 : -1;
          W.coins.push({ x: pcx, y: W.p.y + 4, amount: amt, t: Math.random() * 6.28,
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
      const d = W.img.data;
      let changed = false, nOre = 0;
      for (let cy = minY; cy <= maxY; cy++)
        for (let cx = minX; cx <= maxX; cx++) {
          const i = cy * CW + cx;
          if (!W.mat[i] || W.mat[i] === BED) continue;
          if (Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0) > rc) continue;
          if (W.ore && W.ore[i]) { W.ore[i] = 0; nOre++; }
          W.fire.fuel[i] = 0; W.fire.t[i] = 0;
          W.mat[i] = 0; d[i * 4 + 3] = 0; changed = true;
        }
      if (W.burrow) for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++)
        if (W.burrow[cy * CW + cx] && Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0) <= rc) { W.burrow[cy * CW + cx] = 0; changed = true; }
      if (changed) W.terrainV++;
      if (changed) tctx.putImageData(W.img, 0, 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
      unDeco(cx0, cy0, rc, minX, minY, maxX, maxY);
      if (nOre) dropOre(x, y, nOre);
    }
    // a gold seam cut or blown open: bits of gold tumble out, as much as the rock you took.
    // Fractions carry over in oreBank, so nibbling a seam with a drill pays the same as a blast.
    function dropOre(x, y, n) {
      W.oreBank += n * ORE_GOLD * (1 + (W.floor - 1) * 0.3) * W.pb.gold;
      let bits = Math.min(12, Math.floor(W.oreBank / 2));
      if (!bits) return;
      const each = Math.floor(W.oreBank / bits);
      W.oreBank -= each * bits;
      for (let k = 0; k < bits; k++)
        W.coins.push({ x: x + (Math.random() - 0.5) * 6, y, amount: each, t: Math.random() * 6.28,
          vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 80 });
      SFX.fx('coinland', x, y);
    }
    // wipe the decoration layer inside a cleared circle, so baked rubble, beams and pillars
    // go with the rock round them
    function unDeco(cx0, cy0, rc, minX, minY, maxX, maxY) {
      const dd = W.dimg.data;
      let changed = false;
      for (let cy = minY; cy <= maxY; cy++)
        for (let cx = minX; cx <= maxX; cx++) {
          const k = (cy * CW + cx) * 4;
          if (!dd[k + 3] || Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0) > rc) continue;
          dd[k + 3] = 0; changed = true;
          W.fire.fuel[k >> 2] = 0; W.fire.t[k >> 2] = 0;
        }
      if (changed) dctx.putImageData(W.dimg, 0, 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
    }

    // lay solid brick down, the opposite of dig()
    function paint(x, y, w, hh) {
      const x0 = Math.max(1, Math.round(x / CELL - w / 2)), x1 = Math.min(CW - 2, x0 + w);
      const y0 = Math.max(1, Math.round(y / CELL)), y1 = Math.min(CH - 2, y0 + hh);
      const d = W.img.data;
      for (let cy = y0; cy < y1; cy++)
        for (let cx = x0; cx < x1; cx++) {
          const i = cy * CW + cx;
          if (W.mat[i]) continue;
          W.mat[i] = BRICK;
          const k = i * 4;
          d[k] = 132; d[k + 1] = 99; d[k + 2] = 71; d[k + 3] = 255;
        }
      if (x1 > x0 && y1 > y0) tctx.putImageData(W.img, 0, 0, x0, y0, x1 - x0, y1 - y0);
    }

    // ---- casting ----
    // Walk the gun's slot list from where it left off. Modifiers pile up and apply
    // to the shots that come after them; running off the end triggers the recharge.
    function cast(g, gx, gy, nx, ny) {
      const pas = gunPassives(g);
      const wrap = () => {
        g.idx = 0;
        g.rechT = g.skipRech ? 0 : effRecharge(g) * W.pb.rech;   // Faster Wands shortens it
        g.rechLen = g.rechT;
        g.skipRech = false;
        shuffleOrder(g);
      };
      const plan = planCast(g, input.current.loadout.guns);
      if (!plan.shots.length) { wrap(); return; }        // modifiers with nothing to modify
      const cost = W.pb.mana === 0 ? 0 : plan.cost;        // Unlimited Spells: nothing costs mana
      if (g.mana < cost) { g.idx = plan.start; g.delayT = 0.12; g.delayMax = 0.12; SFX.ui('empty'); return; }
      g.mana -= cost;

      const base = Math.atan2(ny, nx);
      const acts = plan.acts || [];
      let bonus = 0;                                   // damage bought with something else

      if (plan.hp && !W.p.dead) hurt(plan.hp);
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
        for (const b of W.bullets) {
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
        for (const e of W.enemies) {
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
      if (kick && !W.p.dead) {
        kick = Math.min(220, kick * 1.4 * W.pb.recoil);   // Knockback / Concentrated add kick
        W.p.vx -= Math.cos(base) * kick;
        W.p.vy -= Math.sin(base) * kick;
      }
      g.delayT = plan.delay * W.pb.delay;                 // Concentrated slows, Faster Wands quickens
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
      const pd = W.pb.dmg;
      let pc = W.pb.crit;
      if (W.pb.close && W.enemies.some(e => Math.hypot(e.x - ox, e.ty - oy) < 56)) pc += 0.4;
      for (let i = 0; i < n; i++) {
        let a = base + off + (Math.random() - 0.5) * sh.spread * W.pb.spread * Math.PI / 180;
        if (sh.autoaim) {
          let best = null, bd = 320;
          for (const e of W.enemies) {
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
        W.bullets.push({ x: bx, y: by,
          vx: Math.cos(a) * sh.speed * W.pb.speed * bhSp(sh), vy: Math.sin(a) * sh.speed * W.pb.speed * bhSp(sh),
          life: sh.life, dmg: (sh.dmg + bonus) * pd, size: sh.size, col: sh.col, spin: 0,
          homing: Math.max(sh.homing, W.pb.homing), bounce: sh.bounce + W.pb.bounce, pierce: sh.pierce,
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
    function addArc(pts, col, w, max) { W.arcs.push({ pts: jag(pts, 4), col, w, t: 0, max }); }
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
      for (let j = 0; j < W.enemies.length; j++) {
        const e = W.enemies[j];
        if (Math.hypot(e.x - b.x, e.ty - b.y) < R && lineOfSight(b.x, b.y, e.x, e.ty)) near.push(j);
      }
      if (near.length && Math.random() < 0.75) {
        const j = near[Math.floor(Math.random() * near.length)], e = W.enemies[j];
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
          if (sh.knock) shove(W.enemies[j], nx, ny, sh.knock);
          if (!sh.pierce) { hitAt = d; break; }
        }
      }
      W.beams.push({ x, y, nx, ny, len: hitAt, col: sh.col, w: sh.size, t: 0, look: sh.look });
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
        W.bullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
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
      W.dparts.push({ x, y, vx, vy, g: g || 0, c, s, life, max: life, glow: 1 });
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
        if (chance(18)) W.smoke.push({ x: b.x, y: b.y, vx: rnd(-10, 10), vy: rnd(-12, 4), r: rnd(1.2, 2.2),
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
        if (chance(25)) W.smoke.push({ x: b.x - ux * 5, y: b.y - uy * 5, vx: rnd(-6, 6), vy: rnd(-8, 2), r: rnd(1.2, 2.4),
          life: 0.9, max: 0.9, c: '#5a5652', a: 0.4 });
      } else if (L === 'flame') {             // fire licking up off it, and smoke off the big ones
        const big = b.size >= 4;
        if (chance(big ? 70 : 40)) glowDot(b.x + rnd(-b.size, b.size), b.y + rnd(-b.size, b.size), -ux * 20 + rnd(-15, 15), -uy * 20 - rnd(10, 40),
          FIRE_COLS[Math.floor(Math.random() * 3)], rnd(0.8, 1.2 + b.size * 0.2), rnd(0.12, 0.35), -0.03);
        if (chance(big ? 14 : 5)) W.smoke.push({ x: b.x, y: b.y, vx: rnd(-6, 6), vy: rnd(-14, -4), r: rnd(1.5, 1 + b.size * 0.6),
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
        if (chance(10)) W.smoke.push({ x: b.x - ux * 6, y: b.y - uy * 6, vx: rnd(-5, 5), vy: rnd(-10, 0), r: rnd(2, 3), life: 1, max: 1, c: '#4a4a40', a: 0.35 });
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
      if (cx < 0 || cy < 0 || cx >= CW || cy >= CH || !W.mat[cy * CW + cx]) return;
      const k = (cy * CW + cx) * 4, d = W.img.data, sp = Math.hypot(b.vx, b.vy) || 1;
      W.sparks.push({ x, y, vx: -b.vx / sp * rnd(40, 110) + rnd(-50, 50), vy: -b.vy / sp * rnd(40, 110) - rnd(20, 70),
        life: rnd(0.4, 0.8), max: 0.8, c: 'rgb(' + d[k] + ',' + d[k + 1] + ',' + d[k + 2] + ')', size: rnd(1, 1.8), heavy: true });
    }
    // Brimstone: burning sparks thrown out of the blast, lighting what they land on
    function throwEmbers(x, y, n) {
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 4.2, v = 60 + Math.random() * 150;
        W.dparts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, g: 0.45,
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
      W.fields.push({ x, y, r: sh.r, field: sh.field, life: sh.life, max: sh.life,
        col: sh.col, dmg: sh.dmg || 1, tick: 0, payload: pay, ang: ang || 0, trig: sh.trig });
    }
    // Teleport Bolt: put you where the bolt stopped. It may have stopped against rock, so
    // back up along its own track (and nudge up/down) until your whole body fits; if
    // nowhere near fits, it fizzles and you stay put.
    function teleportTo(b) {
      if (W.p.dead) return;
      const sp = Math.hypot(b.vx, b.vy), nx = sp ? b.vx / sp : 0, ny = sp ? b.vy / sp : 0;
      for (let back = 0; back <= 40; back += 3)
        for (const dy of [0, -4, 4, -8, 8, -12, 12, -16, 16]) {
          const x = b.x - nx * back - PW / 2, y = b.y - ny * back - PH / 2 + dy;
          if (x < CELL * 3 || y < CELL * 3 || x + PW > WW - CELL * 3 || y + PH > WH - CELL * 3) continue;
          if (boxHit(x, y)) continue;
          burst(W.p.x + PW / 2, W.p.y + PH / 2, 10, b.col);
          W.p.x = x; W.p.y = y; W.p.vx = 0; W.p.vy = 0;
          burst(W.p.x + PW / 2, W.p.y + PH / 2, 12, b.col);
          SFX.fx('warp', W.p.x + PW / 2, W.p.y + PH / 2);
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
      if (W.mat[i]) {
        const d = W.img.data;
        d[k] = 34 + r * 16; d[k + 1] = 28 + r * 12; d[k + 2] = 24 + r * 10;
        growBox(fireBox.t, x, y);
      } else if (W.dimg) {
        const dd = W.dimg.data;
        if (r < 0.16) { const a = 30 + r * 120; dd[k] = a; dd[k + 1] = a * 0.9; dd[k + 2] = a * 0.85; }
        else dd[k + 3] = 0;
        growBox(fireBox.d, x, y);
      }
    }
    function flushFire() {
      for (const [b, c, im] of [[fireBox.t, tctx, W.img], [fireBox.d, dctx, W.dimg]]) {
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
      const L = W.webs[w];
      for (let u = 0; u <= 1; u += 0.1)
        W.dparts.push({ x: L.a0x + (L.b0x - L.a0x) * u, y: L.a0y + (L.b0y - L.a0y) * u, vx: (Math.random() - 0.5) * 20,
          vy: -20 - Math.random() * 30, g: -0.02, c: Math.random() < 0.5 ? '#ffd35a' : '#ff8a2a', s: 1.4, life: 0.4, max: 0.4, glow: 1 });
      W.webs.splice(w, 1);
      SFX.fx('whoosh', (L.a0x + L.b0x) / 2, (L.a0y + L.b0y) / 2);
    }
    // everything that burns within r of (x, y) catches at `chance`: grass, moss and timber
    // pixels, plants, web lines — and a minecart goes up
    function ignite(x, y, r, chance) {
      fireList();
      const n = fireArea(W.fire, x, y, r, chance);
      for (const pr of W.firePlants)
        if (!pr.gone && !pr.burn && x > pr.x - 5 - r && x < pr.x + 5 + r && y > pr.y - r && y < pr.y + pr.len + r &&
          Math.random() < chance) catchPlant(pr);
      for (let w = W.webs.length - 1; w >= 0; w--) if (webDist(W.webs[w], x, y) < r + 2 && Math.random() < chance) burnWeb(w);
      for (const pr of W.fireArches) {
        if (pr.gone || pr.burn || x < pr.x + pr.l - r || x > pr.x + pr.r + r || y < pr.y + pr.t0 - r || y > pr.y + pr.b + r) continue;
        const q = archNear(pr, x, y);
        if (q.d < r + 3 && Math.random() < chance) catchArch(pr, q.k / (pr.arc.length - 1));
      }
      for (const pr of W.fireCarts)
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
      if (W.p.dead) return;
      if (!(W.p.burn > 0)) { SFX.fx('whoosh', W.p.x + PW / 2, W.p.y + PH / 2); W.strings.length = 0; }   // spider silk burns off
      W.p.burn = Math.max(W.p.burn || 0, kr('fireYou'));
    }
    // a blast's heat: fuel round it catches, and creatures (and you) in it may go up
    function fireBlast(x, y, R, hot) {
      const ch = hot ? 0.9 : kr('fireBoom');
      ignite(x, y, R * 1.3, ch);
      for (const e of W.enemies) if (Math.hypot(e.x - x, e.ty - y) < R + e.r && Math.random() < ch) setAlight(e);
      if (!W.p.dead && Math.hypot(W.p.x + PW / 2 - x, W.p.y + PH / 2 - y) < R + 6 && Math.random() < ch * 0.5) youAlight();
    }
    // a flame licking up off a burning spot
    const flameAt = (x, y, sp) => W.dparts.push({ x, y, vx: (Math.random() - 0.5) * 16, vy: -30 - Math.random() * (sp || 40),
      g: -0.03, c: Math.random() < 0.4 ? '#ffd35a' : Math.random() < 0.6 ? '#ff8a2a' : '#e8461c', s: 1 + Math.random() * 1.2,
      life: 0.25 + Math.random() * 0.3, max: 0.55, glow: 1 });
    const fireSmoke = (x, y) => W.smoke.push({ x, y, vx: (Math.random() - 0.5) * 12, vy: -25 - Math.random() * 20,
      r: 2 + Math.random() * 2.5, life: 1.4, max: 1.4, c: '#2a2624', a: 0.35 });
    // One frame of fire: the cave's fire moves on, plants, webs and carts catch off it,
    // burning creatures (and you) take damage and spread it, flames and smoke come off
    // what's on view, and the crackle sits at the nearest blaze.
    // the props that burn, relisted whenever props came or went (a test room, a drop)
    function fireList() {
      if (W.props.length === W.firePropN && W.props[W.props.length - 1] === W.firePropLast) return;
      W.firePropN = W.props.length; W.firePropLast = W.props[W.props.length - 1];
      W.firePlants = W.props.filter(pr => pr.k === 'climb' && FLAMMABLE[pr.st] && !pr.arc);
      W.fireArches = W.props.filter(pr => pr.arc && FLAMMABLE[pr.st]);
      W.fireCarts = W.props.filter(pr => pr.k === 'barrel');
    }
    function fireFrame(dt, pcx, pcy) {
      fireList();
      const ticks = fireStep(W.fire, dt, fireOut);
      W.fireN += ticks;
      const L = W.fire.list, any = L.length > 0;
      if (ticks && any) {
        for (let k = W.fireN & 3; k < W.firePlants.length; k += 4) {       // a quarter of the plants a tick
          const pr = W.firePlants[k];
          if (pr.gone || pr.burn) continue;
          for (let yy = pr.y + 2; yy < pr.y + pr.len; yy += 8) if (fireNear(W.fire, pr.x, yy, 2)) { catchPlant(pr); break; }
        }
        for (const pr of W.fireArches) {
          if (pr.gone || pr.burn) continue;
          const n = pr.arc.length - 1;
          for (let k = 0; k <= n; k += 2) { const q = archAt(pr, k / n); if (fireNear(W.fire, q.x, q.y, 2)) { catchArch(pr, k / n); break; } }
        }
        for (let w = W.webs.length - 1; w >= 0; w--) {
          const ln = W.webs[w];
          for (let u = 0; u <= 1; u += 0.25)
            if (fireNear(W.fire, ln.a0x + (ln.b0x - ln.a0x) * u, ln.a0y + (ln.b0y - ln.a0y) * u, 2)) { burnWeb(w); break; }
        }
        for (const pr of W.fireCarts) if (!pr.gone && fireNear(W.fire, pr.x, pr.y - 4, 8)) blowProp(pr);
      }
      // burning plants: the fire climbs from the tip to the rock, lighting what's round it
      for (const pr of W.firePlants) {
        if (!pr.burn || pr.gone) continue;
        pr.len -= kr('firePlant') * dt; pr.b = Math.max(0, pr.len);
        const ty = pr.y + Math.max(0, pr.len);
        if (Math.random() < dt * 30) flameAt(pr.x + (Math.random() - 0.5) * 4, ty);
        if (Math.random() < dt * 4) fireSmoke(pr.x, ty);
        if (ticks) {
          fireArea(W.fire, pr.x, ty, 5, 0.3);
          for (const o of W.firePlants)
            if (!o.burn && !o.gone && Math.abs(o.x - pr.x) < 10 && ty > o.y - 4 && ty < o.y + o.len + 4 && Math.random() < 0.25) catchPlant(o);
          if (!W.p.dead && W.zfx.climb === pr) youAlight();
        }
        if (pr.len < 4) { pr.gone = true; fireArea(W.fire, pr.x, pr.y, 6, 1); }
      }
      // burning arched vines: the fire runs both ways along it from where it caught, lighting
      // the strands as it reaches them, and the vine is gone when it meets both ends
      for (const pr of W.fireArches) {
        if (!pr.burn || pr.gone) continue;
        const du = kr('fireArch') * dt / Math.max(1, pr.alen);
        pr.u0 = Math.max(0, pr.u0 - du); pr.u1 = Math.min(1, pr.u1 + du);
        for (const u of [pr.u0, pr.u1]) {
          const q = archAt(pr, u);
          if (Math.random() < dt * 30) flameAt(q.x + (Math.random() - 0.5) * 4, q.y);
          if (Math.random() < dt * 4) fireSmoke(q.x, q.y);
          if (ticks) fireArea(W.fire, q.x, q.y, 5, 0.3);
        }
        if (ticks) {
          for (const o of W.firePlants) if (o.on === pr && !o.burn && !o.gone && o.u >= pr.u0 && o.u <= pr.u1) catchPlant(o);
          if (!W.p.dead && W.zfx.climb === pr) youAlight();
        }
        if (pr.u0 <= 0 && pr.u1 >= 1) pr.gone = true;
      }
      // burning creatures: hurt in chunks (so they flash, not flicker), spread it where they go
      for (let j = W.enemies.length - 1; j >= 0; j--) {
        const e = W.enemies[j];
        if (ticks && any && !(e.burn > 0) && fireNear(W.fire, e.x, e.ty, e.r * 0.7)) setAlight(e);
        if (!(e.burn > 0)) continue;
        e.burn -= dt;
        e.burnAcc = (e.burnAcc || 0) + kr('fireDps') * dt;
        if (Math.random() < dt * 40) flameAt(e.x + (Math.random() - 0.5) * e.r * 1.4, e.ty + (Math.random() - 0.3) * e.r);
        if (Math.random() < dt * 6) fireSmoke(e.x, e.ty - e.r);
        if (ticks) ignite(e.x, e.ty + e.r * 0.4, e.r * 0.8, 0.35);
        if (!W.p.dead && Math.hypot(e.x - pcx, e.ty - pcy) < e.r + 8 && Math.random() < dt * 2) youAlight();
        if (e.burnAcc >= 0.5 || e.burn <= 0) { const d = e.burnAcc; e.burnAcc = 0; if (d > 0 && W.enemies[j] === e) damageEnemy(j, d); }
      }
      // you: fire underfoot or round you lights you; water, snow or slime puts you out
      if (!W.p.dead) {
        if (ticks && any && !(W.p.burn > 0) && (fireNear(W.fire, pcx, W.p.y + PH - 3, 3) || fireNear(W.fire, pcx, pcy, 3))) youAlight();
        if (W.p.burn > 0 && FIRE_WET[W.zfx.surface]) { W.p.burn = 0; W.p.burnAcc = 0; SFX.fx('sizzle', pcx, W.p.y + PH); }
        if (W.p.burn > 0) {
          W.p.burn -= dt;
          W.p.burnAcc = (W.p.burnAcc || 0) + kr('fireYouDps') * dt;
          if (Math.random() < dt * 40) flameAt(W.p.x + Math.random() * PW, W.p.y + PH * (0.2 + Math.random() * 0.8));
          if (Math.random() < dt * 6) fireSmoke(pcx, W.p.y);
          if (ticks) fireArea(W.fire, pcx, W.p.y + PH - 2, 5, 0.3);
          if (W.p.burnAcc >= 2 || W.p.burn <= 0) { const d = Math.round(W.p.burnAcc); W.p.burnAcc -= d; if (d > 0) hurt(d); }
        }
      } else W.p.burn = 0;
      // flames and smoke off the burning pixels you can see, and the crackle at the nearest blaze
      if (any) {
        const x0 = W.camX / CELL - 4, x1 = (W.camX + W.viewW) / CELL + 4, y0 = W.camY / CELL - 4, y1 = (W.camY + W.viewH) / CELL + 4;
        const want = Math.min(20, Math.ceil(L.length * dt * 2.5));
        for (let a = 0, got = 0; a < want * 3 && got < want && W.dparts.length < 700; a++) {
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
          if (!W.fireLoop && SFX.ready) W.fireLoop = SFX.loop('fire');
          if (W.fireLoop) W.fireLoop.set(Math.min(1, 0.35 + near / 300) * 0.7, bx, by);
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
      const d = W.img.data;
      let debris = 0, nOre = 0;
      for (let cy = minY; cy <= maxY; cy++) {
        for (let cx = minX; cx <= maxX; cx++) {
          const i = cy * CW + cx, m = W.mat[i];
          if (!m) continue;
          const dist = Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0);
          const k = i * 4;
          if (dist <= rc && m !== BED) {
            if (debris < 40 && Math.random() < 0.08) {
              debris++;
              const f = 0.5 + Math.random();
              W.sparks.push({ x: cx * CELL, y: cy * CELL,
                vx: (cx - cx0) / rc * 220 * f, vy: ((cy - cy0) / rc * 220 - 140) * f,
                life: 0.8 + Math.random() * 0.4, max: 1.2, c: `rgb(${d[k]},${d[k + 1]},${d[k + 2]})`, size: 2, heavy: true });
            }
            if (W.ore && W.ore[i]) { W.ore[i] = 0; nOre++; }
            W.fire.fuel[i] = 0; W.fire.t[i] = 0;
            W.mat[i] = 0;
            d[k + 3] = 0;
          } else if (dist <= ring) {
            d[k] *= 0.72; d[k + 1] *= 0.72; d[k + 2] *= 0.72;   // scorch the crater edge
          }
        }
      }
      tctx.putImageData(W.img, 0, 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
      unDeco(cx0, cy0, rc, minX, minY, maxX, maxY);
      if (nOre) dropOre(x, y, nOre);
      if (W.burrow) for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++)
        if (Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0) <= rc) W.burrow[cy * CW + cx] = 0;
      W.terrainV++;
      // a blast knocks the props about: carts and pods go off, pillars crack, icicles let go
      for (const pr of W.props) {
        if (pr.gone || Math.abs(pr.x - x) > R + 40 || Math.abs(pr.y - y) > R + 40) continue;
        const bx = clamp(x, pr.x + pr.l, pr.x + pr.r), by = clamp(y, pr.y + pr.t0, pr.y + pr.b);
        if (Math.hypot(bx - x, by - y) < R + 6) pr.hurt = (pr.hurt || 0) + 2;
      }

      W.flashes.push({ x, y, r: R, t: 0 });
      for (let i = 0; i < (splash != null ? 2 : 10); i++) {
        W.smoke.push({ x: x + (Math.random() - 0.5) * R, y: y + (Math.random() - 0.5) * R,
          vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40 - 20,
          r: 4 + Math.random() * 5, life: 1.2, max: 1.2 });
      }
      for (let j = W.enemies.length - 1; j >= 0; j--) {
        const e = W.enemies[j], dist = Math.hypot(e.x - x, e.ty - y);
        if (dist < R + e.r) damageEnemy(j, splash != null ? splash : dist < R * 0.5 ? 3 : 2);
      }
      if (splash != null) return;
      fireBlast(x, y, R, hot);
      const pcx = W.p.x + PW / 2, pcy = W.p.y + PH / 2;
      const dist = Math.hypot(pcx - x, pcy - y), reach = R + 10;
      if (dist < reach && !W.p.dead) {
        const f = 1 - dist / reach;
        hurt(Math.round(25 * f));
        const nx = (pcx - x) / (dist || 1), ny = (pcy - y) / (dist || 1);
        W.p.vx += nx * 500 * f;
        W.p.vy += ny * 500 * f - 150 * f;
        W.p.kick = 0.25;
      }
    }

    // ---- decoration, pass 3: the props at work ----
    const pOver = (pr, pad) => W.p.x + PW > pr.x + pr.l - pad && W.p.x < pr.x + pr.r + pad &&
      W.p.y + PH > pr.y + pr.t0 - pad && W.p.y < pr.y + pr.b + pad;
    // a loud noise: every creature within earshot comes looking, and shooters get ready
    function alertAt(x, y) {
      W.rings.push({ x, y, t: 0 });
      for (const e of W.enemies) {
        if (Math.hypot(e.x - x, e.ty - y) > 320) continue;
        if (HUNTERS[e.k.act]) e.aggro = true;
        else e.cd = Math.min(e.cd, 0.3);
      }
    }
    // what a breakable prop is made of, for the sound it breaks with
    const MATERIAL = { icicle: 'ice', geode: 'crystal', salt: 'salt', bone: 'bone', obsidian: 'glass', shard: 'glass' };
    function shatter(pr, n) {
      SFX.fx('shatter', pr.x, pr.y + (pr.t0 + pr.b) / 2, MATERIAL[pr.st] || 'stone');
      burst(pr.x, pr.y + (pr.t0 + pr.b) / 2, n || 10, propCol(pr, themeFor(W.floor)));
      pr.gone = true;
    }
    function blowProp(pr) {
      if (pr.gone) return;
      pr.gone = true;                          // first, so a chain of blasts can't loop
      if (pr.k === 'barrel') { explode(pr.x, pr.y - 6, 105, undefined, 1); SFX.debris(pr.x, pr.y - 6); }
      else if (pr.k === 'pod') {
        SFX.pop(pr.x, pr.y - 6);
        W.clouds.push({ x: pr.x, y: pr.y - 8, r: 34, life: 4.5, max: 4.5, tick: 0 });
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
        W.dparts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, g: 0.45,
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
      W.decoFrame++;
      W.plantsNow.clear();
      const z = { slow: 1, slick: 0, climb: null, rev: 0, web: null, webs: 0, webMul: 1 };
      // the runtime anchor check, staggered: a thirtieth of the props each frame, so each one
      // finds out within half a second that the rock it hung off has been blown away
      for (let i = W.decoFrame % 30; i < W.props.length; i += 30) {
        const pr = W.props[i];
        if (!pr.gone && !pr.fall && (pr.anc || pr.on) && !propAnchored(pr, W.mat)) { pr.fall = true; pr.vy = 0; pr.anc = null; pr.on = null; }
      }
      for (let i = W.props.length - 1; i >= 0; i--) {
        const pr = W.props[i];
        if (pr.gone) { W.props.splice(i, 1); continue; }
        if (pr.fall) {                           // physics hand-off: it drops
          pr.vy = Math.min(pr.vy + GRAVITY * 0.8 * dt, 700);
          pr.y += pr.vy * dt;
          if (pr.y > WH) { pr.gone = true; continue; }
          if (pr.vy > 120 && (pr.k === 'drop' || pr.k === 'spike' || pr.k === 'cover' || pr.k === 'noise')) {
            if (!W.p.dead && pOver(pr, 0)) { hurt(PROP_DMG.drop); shatter(pr, 14); continue; }
            for (let j = W.enemies.length - 1; j >= 0; j--) {
              const e = W.enemies[j];
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
          for (const b of W.bullets) {
            if (b.life <= 0 || b.x + b.size < x0 || b.x - b.size > x1 || b.y + b.size < y0 || b.y - b.size > y1) continue;
            if (b.pull || b.eat || b.bore) {          // rolls on through, but only counts once
              const seen = b.propHit || (b.propHit = new Set());
              if (!seen.has(pr)) { seen.add(pr); pr.hurt = (pr.hurt || 0) + 1; }
            } else { pr.hurt = (pr.hurt || 0) + 1; burst(b.x, b.y, 3, b.col); b.life = 0; b.struck = 1; }
          }
          if (tough) for (let k = W.enemyShots.length - 1; k >= 0; k--) {
            const es = W.enemyShots[k];
            if (es.x > x0 && es.x < x1 && es.y > y0 && es.y < y1) { burst(es.x, es.y, 3, es.col); SFX.fx('coverHit', es.x, es.y); W.enemyShots.splice(k, 1); }
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
        const me = !W.p.dead;
        switch (pr.k) {
          case 'climb':
            if (pr.arc) {                          // an arched vine: latch on like a web line
              if (!me || !pOver(pr, 0)) break;
              const R = pr.grab || (pr.grab = kr('arGrab'));
              const d = archNear(pr, pcx, W.p.y + WEB_HAND).d, d2 = archNear(pr, pcx, pcy).d;
              if (Math.min(d, d2) < R + 3) W.plantsNow.add(pr);
              if (d <= R && (!z.arch || d < z.archD)) { z.arch = pr; z.archD = d; }
              break;
            }
            if (me && pOver(pr, 0)) z.climb = pr;
            if (me && PLANTS[pr.st] && pOver(pr, 1)) W.plantsNow.add(pr);
            break;
          case 'drip':
            if (pr.st === 'sparks') {
              pr.t -= dt;
              if (pr.t <= 0) {
                pr.t = 1.2 + Math.random() * 2.6;
                SFX.fx('sparks', pr.x, pr.y);
                for (let k = 0; k < 10; k++) W.dparts.push({ x: pr.x, y: pr.y + 4, vx: (Math.random() - 0.5) * 170,
                  vy: -20 + Math.random() * 90, g: 0.5, c: Math.random() < 0.5 ? '#ffe27a' : '#fff6c8', s: 1.2, life: 0.5, max: 0.5, glow: 1 });
              }
            } else {
              // each drip keeps its own random clock, so they never fall in step
              const rate = DRIP_RATE[pr.st];
              if (pr.dn == null) { pr.di = (0.3 + Math.random() * 1.4) / rate; pr.dn = Math.random() * pr.di; }
              pr.dn -= dt;
              if (pr.st === 'steam' && (pr.hs = (pr.hs || Math.random() * 3) - dt) <= 0) { pr.hs = 1.5 + Math.random() * 3; SFX.fx('steam', pr.x, pr.y); }
              while (pr.dn <= 0) { pr.di = (0.3 + Math.random() * 1.4) / rate; pr.dn += pr.di; W.dparts.push(spawnDrip(pr)); }
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
              W.p.vy = pr.hang ? 160 : -280; burst(pcx, pr.hang ? W.p.y : W.p.y + PH, 5, '#ff5a5a');
            }
            break;
          case 'vent': {
            pr.t += dt;
            const ph = pr.t % 3.6, wasOn = pr.on, wasWarn = pr.warn;
            pr.on = ph > 2.6; pr.warn = ph > 1.9 && !pr.on;
            if (pr.warn && !wasWarn) SFX.fx('ventWarn', pr.x, pr.y);
            if (pr.on && !wasOn) SFX.fx('ventFire', pr.x, pr.y - 20);
            if (pr.warn && Math.random() < dt * 14) W.smoke.push({ x: pr.x, y: pr.y - 2, vx: (Math.random() - 0.5) * 10,
              vy: -30, r: 2 + Math.random() * 2, life: 0.8, max: 0.8 });
            if (pr.on) {
              if (Math.random() < dt * 40) W.dparts.push({ x: pr.x + (Math.random() - 0.5) * 6, y: pr.y - 4, vx: (Math.random() - 0.5) * 20,
                vy: -140 - Math.random() * 80, g: 0, c: Math.random() < 0.5 ? '#ffb050' : '#ff7a2a', s: 1.6, life: 0.4, max: 0.4, glow: 1 });
              if (me && pr.cd <= 0 && W.p.x + PW > pr.x - 6 && W.p.x < pr.x + 6 && W.p.y < pr.y && W.p.y + PH > pr.y - VENT_H) { hurt(PROP_DMG.vent); youAlight(); pr.cd = 0.4; }
              if ((pr.ecd = (pr.ecd || 0) - dt) <= 0) {
                pr.ecd = 0.4;
                for (let yy = 4; yy < VENT_H; yy += 12) ignite(pr.x, pr.y - yy, 6, 0.5);   // and it lights what hangs over it
                for (let j = W.enemies.length - 1; j >= 0; j--) {
                  const e = W.enemies[j];
                  if (Math.abs(e.x - pr.x) < e.r + 6 && e.ty < pr.y && e.ty > pr.y - VENT_H) { setAlight(e); damageEnemy(j, 1); }
                }
              }
            }
            break;
          }
          case 'pad':                               // a bouncy mushroom throws you up
            if (pr.sq > 0) pr.sq -= dt;
            if (me && W.p.vy >= 0 && Math.abs(pcx - pr.x) < 11 && W.p.y + PH > pr.y - 12 && W.p.y + PH < pr.y + 2) {
              W.p.vy = -680; W.p.onGround = false; pr.sq = 0.3;
              SFX.fx('shroom', pr.x, pr.y);
              burst(pr.x, pr.y - 8, 5, propCol(pr, themeFor(W.floor)));
            }
            break;
          case 'zone': {
            const on = me && W.p.onGround && W.p.x + PW > pr.x + pr.l && W.p.x < pr.x + pr.r && Math.abs(W.p.y + PH - pr.y) < 5;
            const st = pr.st, moving = Math.abs(W.p.vx) > 30;
            if (st === 'slime') for (const e of W.enemies)
              if (e.x > pr.x + pr.l && e.x < pr.x + pr.r && e.ty > pr.y - 30 && e.ty < pr.y) e.chill = 0.45;
            if (!on) { pr.stand = 0; break; }
            z.surface = st;
            if (st === 'ice') z.slick = 1;
            else if (st === 'snow') z.slow = Math.min(z.slow, 0.55);
            else if (st === 'slime') z.slow = Math.min(z.slow, 0.45);
            else if (st === 'puddle') {
              z.slow = Math.min(z.slow, 0.7);
              if (moving && Math.random() < dt * 20) W.dparts.push({ x: pcx, y: pr.y - 2, vx: (Math.random() - 0.5) * 60,
                vy: -60 - Math.random() * 60, g: 0.9, c: 'rgba(150,200,255,0.8)', s: 1.3, life: 0.6, max: 0.6 });
            } else if (st === 'acid') { if (pr.cd <= 0) { hurt(3); pr.cd = 0.5; } }
            else if (st === 'glass') {
              if (Math.abs(W.p.vx) > 80 && pr.cd <= 0) { hurt(2); pr.cd = 0.35; burst(pcx, pr.y - 1, 3, '#d8f4ff'); }
            } else if (st === 'log') {
              pr.stand = (pr.stand || 0) + dt;
              if (pr.stand > 0.8 && pr.cd <= 0) { hurt(3); pr.cd = 0.5; }
            } else if (st === 'ash' && moving && Math.random() < dt * 30) {
              W.smoke.push({ x: pcx + (Math.random() - 0.5) * 8, y: pr.y - 2, vx: -W.p.vx * 0.2 + (Math.random() - 0.5) * 20,
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
            const by = pr.y + Math.sin(W.time * 1.3 + pr.seed * 9) * 3, dd = Math.hypot(pcx - pr.x, pcy - by);
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
                hurt(PROP_DMG.tendril); pr.cd = 0.8; W.p.vx += Math.cos(pr.aimA) * 220; W.p.kick = 0.15;
              }
            }
            break;
          }
        }
      }
      // spore clouds from burst pods
      for (let i = W.clouds.length - 1; i >= 0; i--) {
        const cl = W.clouds[i];
        cl.life -= dt; cl.tick -= dt;
        if (cl.tick <= 0) {
          cl.tick = 0.4;
          if (!W.p.dead && Math.hypot(pcx - cl.x, pcy - cl.y) < cl.r) hurt(PROP_DMG.cloud);
          for (let j = W.enemies.length - 1; j >= 0; j--)
            if (Math.hypot(W.enemies[j].x - cl.x, W.enemies[j].ty - cl.y) < cl.r + W.enemies[j].r) damageEnemy(j, 1);
        }
        if (cl.life <= 0) W.clouds.splice(i, 1);
      }
      for (let i = W.rings.length - 1; i >= 0; i--) if ((W.rings[i].t += dt) > 0.9) W.rings.splice(i, 1);
      // drips, sparks, steam and splashes
      W.dripHurt -= dt;
      for (let i = W.dparts.length - 1; i >= 0; i--) {
        const q = W.dparts[i];
        q.life -= dt;
        q.vy += GRAVITY * q.g * dt;
        if (q.wob != null) q.vx = Math.sin(W.time * 2 + q.wob) * 6;
        if (q.grow) q.s += dt * 3;
        q.x += q.vx * dt; q.y += q.vy * dt;
        let dead = q.life <= 0;
        // burning oil from a lantern: lights what it passes through, and where it lands
        if (q.ember) {
          const ex = Math.floor(q.x / CELL), ey = Math.floor(q.y / CELL);
          if (ex >= 0 && ey >= 0 && ex < CW && ey < CH && W.fire.fuel[ey * CW + ex]) ignite(q.x, q.y, 2, 0.6);
          if (!W.p.dead && q.x > W.p.x && q.x < W.p.x + PW && q.y > W.p.y && q.y < W.p.y + PH) { youAlight(); dead = true; }
          if (!dead && solidAt(q.x, q.y)) ignite(q.x - q.vx * dt, q.y - q.vy * dt, 4, 0.85);
        }
        if (!dead && solidAt(q.x, q.y)) {
          dead = true;
          if (q.snd) SFX.fx(q.snd, q.x, q.y);
          if (q.splash) for (let k = 0; k < 2; k++) W.dparts.push({ x: q.x, y: q.y - 2, vx: (Math.random() - 0.5) * 50,
            vy: -30 - Math.random() * 40, g: 0.8, c: q.c, s: 1, life: 0.35, max: 0.35, glow: q.glow });
        }
        if (!dead && q.dmg && !W.p.dead && q.x > W.p.x && q.x < W.p.x + PW && q.y > W.p.y && q.y < W.p.y + PH) {
          if (W.dripHurt <= 0) { hurt(q.dmg); W.dripHurt = 0.4; }
          dead = true;
        }
        if (dead) W.dparts.splice(i, 1);
      }
      if (W.dparts.length > 700) W.dparts.splice(0, W.dparts.length - 700);
      stepAmbience(dt);
      // foliage: grabbing a vine, or pushing into a plant you weren't already in, rustles;
      // an arched vine in reach beats the strands hanging off it (let go with a push down, and
      // a strand under you catches you instead)
      if (W.webLetGo > 0) z.arch = null;
      if (z.arch) z.climb = z.arch;
      // moving through them rustles now and then; rustleStep keeps a big clump from spamming
      let entered = !!(z.climb && PLANTS[z.climb.st] && z.climb !== W.zfx.climb), style = null;
      for (const pr of W.plantsNow) if (!W.plantsLast.has(pr)) { entered = true; style = pr.st; }
      const str = rustleStep(W.rustle, dt, W.plantsNow.size > 0, entered, Math.hypot(W.p.vx, W.p.vy));
      if (str) {
        const pr = style ? null : W.plantsNow.values().next().value;
        SFX.rustle(pcx, pcy, str, style || (pr && pr.st) || 'vine');
      }
      W.plantsLast = new Set(W.plantsNow);
      // spider web lines: each one you're touching slows you, and like a vine you latch on
      // to the nearest (unless you've just let go of one)
      if (!W.p.dead) {
        let wd = Infinity;
        for (const L of W.webs) {
          const R = L.grab || (L.grab = spr('webGrab'));
          if (pcx < Math.min(L.a0x, L.b0x) - R || pcx > Math.max(L.a0x, L.b0x) + R ||
              pcy < Math.min(L.a0y, L.b0y) - R - PH / 2 || pcy > Math.max(L.a0y, L.b0y) + R + PH / 2) continue;
          const d = webDist(L, pcx, W.p.y + WEB_HAND);
          const d2 = webDist(L, pcx, pcy);
          if (Math.min(d, d2) > R) continue;
          z.webs++;
          z.webMul *= L.slow || (L.slow = spr('webSlow'));
          if (d <= R && d < wd) { wd = d; z.web = L; }
        }
        if (W.webLetGo > 0) z.web = null;
        if (z.web && !z.climb) z.climb = z.web;
        else if (z.climb !== z.web) z.web = null;
      }
      W.zfx = z;
    }

    // ---- the theme's ambience, pooled round the camera rather than tied to a spot ----
    const AMB_RATE = { spores: 5, frost: 3, embers: 8, motes: 4, ashfall: 55 };
    const AMB_MAX = { spores: 40, frost: 20, embers: 60, motes: 50, ashfall: 280 };
    // one of the Luminescent Spores that drift about the green floors. The jellies puff the
    // very same thing out of their rims (puffSpores), so it is made in one place
    const spore = (x, y, r) => ({ kind: 'spores', x, y, vx: (r - 0.5) * 8, vy: 0, wob: r * 9, life: 5 + r * 3, max: 8,
      c: rgbA(themeFor(W.floor).moss[1]), s: 1.3, glow: 1 });
    // a jelly's pulse blows a puff of spores out of its rim, back the way it pushes; drag
    // (kx, ky fading at kd) settles them, then they drift like any other spore
    function puffSpores(e) {
      if (e.x < W.camX - 150 || e.x > W.camX + W.viewW + 150 || e.y < W.camY - 150 || e.y > W.camY + W.viewH + 150) return;
      const S = e.je, B = jellyBell(e.r, S.shape, kru('jeSquash', S.u.sq));
      const c = Math.cos(S.hd), sn = Math.sin(S.hd), n = Math.round(kr('jeSpores'));
      for (let i = 0; i < n && W.amb.length < 500; i++) {
        const lx = (Math.random() * 2 - 1) * B.rw * 0.7;
        const q = spore(e.x - lx * sn - B.rim * c, e.y + lx * c - B.rim * sn, Math.random());
        const a = S.hd + Math.PI + (Math.random() * 2 - 1) * kr('jeSporeSpread') * Math.PI / 180, v = kr('jeSporeSpd');
        q.kx = Math.cos(a) * v; q.ky = Math.sin(a) * v; q.kd = kr('jeSporeDrag');
        W.amb.push(q);
      }
    }
    // The jellyfish's plant glow in the game (the comp is plantGlowFill): the art round a
    // jelly — the rock with its baked moss over the decoration layer, and the hanging plants
    // drawn over both at terrain resolution and read back — keyed, ramped, twinkled and
    // added on top in its colour. Only on ground you've seen.
    const pgGlow = document.createElement('canvas'), pgGlowCtx = pgGlow.getContext('2d');
    const seenAt = (x, y) => W.seen[clamp(Math.floor(y / FOG_U), 0, FH - 1) * FW + clamp(Math.floor(x / FOG_U), 0, FW - 1)] !== 0;
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
        size: kru('jePlantSize', u.plant), rgb: hexArr(jcol('jeColGlow', u.col)), lit: seenAt })) return;
      if (pgGlow.width < w || pgGlow.height < h) { pgGlow.width = Math.max(pgGlow.width, w); pgGlow.height = Math.max(pgGlow.height, h); }
      pgGlowCtx.putImageData(out, 0, 0);
      const sm = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(pgGlow, 0, 0, w, h, x0w, y0w, w * CELL, h * CELL);
      ctx.imageSmoothingEnabled = sm;
    }
    function stepAmbience(dt) {
      const x0 = W.camX - 30, y0 = W.camY - 30, w = W.viewW + 60, h = W.viewH + 60;
      const T = themeFor(W.floor);
      for (const kind of W.ambKinds) {
        if (kind === 'devils') {
          if (W.devils.length < 2 && Math.random() < dt * 0.4) {
            let x = x0 + Math.random() * w, y = y0 + Math.random() * h, k = 0;
            while (k++ < 120 && !solidAt(x, y + 1)) y += 2;
            if (k < 120 && !solidAt(x, y - 30)) W.devils.push({ x, y, vx: (Math.random() < 0.5 ? -1 : 1) * (15 + Math.random() * 20), life: 6 + Math.random() * 3, max: 9 });
          }
          continue;
        }
        const n = W.amb.reduce((a, q) => a + (q.kind === kind), 0);
        let want = AMB_RATE[kind] * dt;
        while (want > 0 && n < AMB_MAX[kind]) {
          if (Math.random() >= want) break;
          want -= 1;
          const x = x0 + Math.random() * w, y = y0 + Math.random() * h;
          if (solidAt(x, y)) continue;
          const r = Math.random();
          if (kind === 'spores') W.amb.push(spore(x, y, r));
          else if (kind === 'frost') {
            const dir = W.floor % 2 ? 1 : -1;
            W.amb.push({ kind, x, y, vx: dir * (100 + r * 60), vy: (r - 0.5) * 10, life: 0.9 + r * 0.5, max: 1.4, c: 'rgba(215,238,255,0.5)', s: 1, streak: 10 });
          } else if (kind === 'embers') W.amb.push({ kind, x, y, vx: 0, vy: -20 - r * 30, wob: r * 9, life: 3 + r * 2, max: 5, c: r < 0.5 ? '#ffb050' : '#ff7a2a', s: 1.2, glow: 1 });
          else if (kind === 'motes') W.amb.push({ kind, x, y, vx: (r - 0.5) * 6, vy: (Math.random() - 0.5) * 4, wob: r * 9, life: 6 + r * 3, max: 9, c: 'rgba(235,225,200,0.8)', s: 1 });
          else if (kind === 'ashfall') W.amb.push({ kind, x, y, vx: 8, vy: 20 + r * 22, wob: r * 9, life: 4 + r * 3, max: 7, c: 'rgba(150,146,142,0.75)', s: 1 + r });
        }
      }
      for (let i = W.amb.length - 1; i >= 0; i--) {
        const q = W.amb[i];
        q.life -= dt;
        if (q.wob != null) q.x += Math.sin(W.time * 1.3 + q.wob) * 6 * dt;
        if (q.kx || q.ky) {                             // a puff's kick, dying away under drag
          q.x += q.kx * dt; q.y += q.ky * dt;
          const k = Math.exp(-q.kd * dt); q.kx *= k; q.ky *= k;
        }
        q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.life <= 0 || solidAt(q.x, q.y) || q.x < x0 - 200 || q.x > x0 + w + 200 || q.y < y0 - 200 || q.y > y0 + h + 200) W.amb.splice(i, 1);
      }
      for (let i = W.devils.length - 1; i >= 0; i--) {
        const dv = W.devils[i];
        dv.life -= dt;
        const nx = dv.x + dv.vx * dt;
        if (solidAt(nx + Math.sign(dv.vx) * 6, dv.y - 4)) dv.vx = -dv.vx; else dv.x = nx;
        if (!solidAt(dv.x, dv.y + 2)) dv.y += 40 * dt;
        else if (solidAt(dv.x, dv.y)) dv.y -= 2;
        if (dv.life <= 0) W.devils.splice(i, 1);
      }
    }

    function step(dt) {
      W.time += dt;
      W.levelT += dt;
      // a toast raised while the game was paused (picking a mod up, say) waits here,
      // because nothing runs on a paused frame
      if (input.current.pendingToast) { toast(input.current.pendingToast); input.current.pendingToast = null; }
      input.current.floor = W.floor;
      if (input.current.newCave) {                // Dev → New cave: this floor again, freshly rolled
        input.current.newCave = false;
        enterLevel();
        toast('New cave');
        return;
      }
      if (input.current.spawnGun) {               // Dev → Spawn gun: drop one just in front of you
        const gun = caveGun(input.current.spawnGun, Math.random);
        input.current.spawnGun = 0;
        W.pickups.push({ kind: 'gun', x: W.p.x + PW / 2 + W.p.face * 22, y: W.p.y + PH - 9, gun, t: 0 });
        toast('Spawned ' + gun.name);
      }
      const LO = input.current.loadout;
      // perks: keep the current maximum health honest, wind the shield back up, and never
      // let a shrunken cap (Glass Cannon) leave the bar reading over full
      const MHP = maxHp();
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
          if (!boxHit(W.p.x + sx, W.p.y)) { W.p.x += sx; continue; }
          let moved = false;
          const maxUp = wasGround ? 6 : 3;          // walk up small bumps and slopes
          for (let up = 1; up <= maxUp; up++) {
            if (!boxHit(W.p.x + sx, W.p.y - up)) { W.p.x += sx; W.p.y -= up; moved = true; break; }
          }
          if (!moved) { W.p.vx = 0; break; }
        }
      }
      n = Math.ceil(Math.abs(W.p.vy * dt));
      if (n > 0) {
        const sy = W.p.vy * dt / n;
        for (let i = 0; i < n; i++) {
          if (!boxHit(W.p.x, W.p.y + sy)) { W.p.y += sy; continue; }
          if (sy > 0) W.p.y = Math.floor((W.p.y + sy + PH - 0.001) / CELL) * CELL - PH;
          else W.p.y = (Math.floor((W.p.y + sy) / CELL) + 1) * CELL;
          if (boxHit(W.p.x, W.p.y)) W.p.y -= sy;   // fallback
          W.p.vy = 0;
          break;
        }
      }
      // stick to the ground when walking down slopes
      if (wasGround && !jet && W.p.vy >= 0 && W.p.kick <= 0 && !boxHit(W.p.x, W.p.y + 1)) {
        for (let dn = 1; dn <= 6; dn++) {
          if (boxHit(W.p.x, W.p.y + dn + 1)) { W.p.y += dn; W.p.vy = 0; break; }
        }
      }
      // never stay stuck inside terrain
      if (boxHit(W.p.x, W.p.y)) {
        for (let up = 1; up <= 40; up++) if (!boxHit(W.p.x, W.p.y - up)) { W.p.y -= up; break; }
      }
      if (W.p.y > WH) { W.p.x = W.start.x; W.p.y = W.start.y; W.p.vx = 0; W.p.vy = 0; }
      W.p.onGround = boxHit(W.p.x, W.p.y + 0.5);
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
        toast('Floor ' + W.floor);
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
          if (d < bd && lineOfSight(gx, gy, e.x, e.ty)) { bd = d; best = e; }
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
      if (R.on && gun && gun.delayT <= 0 && gun.rechT <= 0) cast(gun, gx, gy, R.nx, R.ny);

      // ---- shots ----
      for (let i = W.bullets.length - 1; i >= 0; i--) {
        const b = W.bullets[i];
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
          const want = Math.atan2(W.p.y + PH / 2 - b.y, W.p.x + PW / 2 - b.x);
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
            if (d < b.size + 6) { burst(es.x, es.y, 3, '#c58cff'); SFX.fx('absorb', es.x, es.y); W.enemyShots.splice(k, 1); continue; }
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
          const j = enemyAt(nx, ny, b.size + 1);
          if (j >= 0 && !(b.hit && b.hit.has(W.enemies[j]))) {
            const e = W.enemies[j];
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
            if (b.cluster) { spray(b); dead = true; break; }
            if (b.explode) { boom = true; break; }
            if (b.pop) { explode(nx, ny, b.pop, b.dmg * 0.5); dead = true; break; }
            if (b.pull) { (b.hit || (b.hit = new Set())).add(e); continue; }   // a black hole rolls on
            if (b.pierce > 0) { b.pierce--; (b.hit || (b.hit = new Set())).add(e); }
            else { dead = true; break; }
          }
          if (b.friendly && !W.p.dead && nx > W.p.x - 2 && nx < W.p.x + PW + 2 &&
              ny > W.p.y - 2 && ny < W.p.y + PH + 2) {
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
            glowDot(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, rnd(-4, 4), rnd(4, 12), Math.random() < 0.5 ? '#ffffff' : '#bfe8ff', rnd(0.7, 1.1), rnd(0.4, 0.9)); }
        }
        if (f.field === 'heal' && Math.random() < dt * 10) { const a = Math.random() * 6.283, r = Math.random() * f.r;
          glowDot(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, 0, rnd(-18, -8), Math.random() < 0.5 ? '#9dff9a' : '#46c48c', rnd(0.8, 1.2), rnd(0.4, 0.8)); }
        if (f.field === 'mine') {
          f.near = W.enemies.some(e => Math.hypot(e.x - f.x, e.ty - f.y) < f.r * 2.2);
          let trip = f.life <= 0;
          for (let j = 0; j < W.enemies.length && !trip; j++) if (near(j)) trip = true;
          if (trip) { explode(f.x, f.y, f.r); fieldPayload(f); W.fields.splice(i, 1); continue; }
        } else if (f.field === 'dormant') {
          // set off by any blast of yours, which is the whole point of it
          for (const fl of W.flashes) {
            if (Math.hypot(fl.x - f.x, fl.y - f.y) < fl.r + f.r * 0.5) {
              explode(f.x, f.y, f.r * 1.6); fieldPayload(f); W.fields.splice(i, 1); f.life = -1; break;
            }
          }
          if (f.life < 0) continue;
        } else if (f.field === 'slow') {
          for (const e of W.enemies) if (Math.hypot(e.x - f.x, e.ty - f.y) < f.r) e.chill = 0.2;
        } else if (f.field === 'shield') {
          for (let k = W.enemyShots.length - 1; k >= 0; k--) {
            const b = W.enemyShots[k];
            if (Math.hypot(b.x - f.x, b.y - f.y) < f.r) { burst(b.x, b.y, 3, f.col); SFX.fx('absorb', b.x, b.y); W.enemyShots.splice(k, 1); }
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
              if (Math.hypot(W.enemies[j].x - sx, W.enemies[j].ty - sy) < 22) damageEnemy(j, 2);
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
            for (const e of W.enemies) if (inR(e.x, e.ty)) { e.y += f.y - e.ty; e.x = f.x; e.tgt = null; }
            for (const b of W.bullets) if (inR(b.x, b.y)) { b.x = f.x; b.y = f.y; }
            for (const b of W.enemyShots) if (inR(b.x, b.y)) { b.x = f.x; b.y = f.y; }
            for (const g of W.coins) if (inR(g.x, g.y)) { g.x = f.x; g.y = f.y; }
            for (const q of W.pickups) if (!q.taken && inR(q.x, q.y)) { q.x = f.x; q.y = f.y; }
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
            if (W.p.hp < MHP) { W.p.hp = MHP; it.sold = true; toast('Patched up'); SFX.ui('heal'); }
          } else if (LO.gold < it.price) {
            toast('Not enough gold');
            SFX.ui('poor');
          } else if (it.kind === 'gun') {
            LO.gold -= it.price;
            it.sold = true;
            // it drops at the plinth, so the usual chooser decides which slot it takes
            // and "leave it" parks the gun you paid for on the floor rather than binning it
            W.pickups.push({ kind: 'gun', x: it.x, y: it.y, gun: it.gun, t: 0 });
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
            if (after > before) W.p.hp += after - before;   // Extra Health comes full
            W.p.hp = Math.min(W.p.hp, after);                 // Glass Cannon trims it
            if (W.pb.seeAll) { W.seen.fill(2); paintFog(); }  // All-Seeing Eye lights it up now
            if (W.pb.ghost && !W.ghost) W.ghost = { x: pcx, y: pcy, cd: 0 };
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

      for (let i = W.toasts.length - 1; i >= 0; i--) if ((W.toasts[i].t -= dt) <= 0) W.toasts.splice(i, 1);

      decorStep(dt, pcx, pcy);

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
            for (const r of W.enemies) if (r.home === e) out++;
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
          if (spiderStep(e, { solidCell, webs: W.webs, hunting, goal: { x: pcx, y: pcy }, rnd: Math.random,
            speedMul: cold }, dt) === 'web') SFX.fx('lash', e.x, e.y);
          e.silkT = (e.silkT || 0) - dt;
          const S = e.sp;
          if (hunting && e.silkT <= 0 && S && (S.mode === 'surf' || S.mode === 'line') &&
              dist < (e.silkR || (e.silkR = spr('spSilk'))) * sees && dist > e.r + 24) {
            e.silkT = 0.4;
            if (lineOfSight(e.x, e.y, pcx, pcy)) {
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
          if (jellyStep(e, { solidCell, hunting, goal: { x: pcx, y: pcy }, rnd: Math.random,
            speedMul: cold, rangeMul: sees, stay: W.zone ? natural : null }, dt) === 'pulse') puffSpores(e);
          const S = e.je;
          // brush its tentacles and you're stung, hunting or not (same sting knobs as the bell)
          if (!W.p.dead && e.touch <= 0 && dist < 180) {
            const t = tentacleTouch(S, W.p.x, W.p.y, W.p.x + PW, W.p.y + PH);
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
        e.ty = k.kp ? e.y : e.y + Math.sin(W.time * 2 + e.phase) * (hunting ? 2 : 4);

        // contact: a chaser hurts you by reaching you, a bomber goes off
        if (hunting && dist < e.r + 14 && e.touch <= 0) {
          if (k.act === 'bomb') {
            burst(e.x, e.ty, 22, k.col.a);
            SFX.boom(e.x, e.ty, 26);
            hurt(k.dmg);
            W.enemies.splice(i, 1);
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
          } else if (!W.p.dead && dist < k.range * sees && e.cd <= 0) {
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
      if (W.pb.contact && !W.p.dead) {
        for (let i = W.enemies.length - 1; i >= 0; i--) {
          const e = W.enemies[i];
          if (Math.hypot(e.x - pcx, e.ty - pcy) < e.r + 12) damageEnemy(i, 45 * dt);
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
          goo(b.x + (Math.random() - 0.5) * b.size, b.y + b.size * 0.5, b.vx * 0.08, 8 + Math.random() * 18, b.dripG, b.dripCol || b.col, 0, b.dripCol2);
        let gone = b.life <= 0;
        if (b.fire) fireArea(W.fire, b.x, b.y, 4, 0.5);
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
          if (!W.p.dead && b.x > W.p.x - 2 && b.x < W.p.x + PW + 2 && b.y > W.p.y - 2 && b.y < W.p.y + PH + 2) {
            gone = true;
            if (b.splat != null) splat(b, b.x, b.y); else burst(b.x, b.y, 5, COL.player);
            hurt(b.dmg);
            if (b.fire) youAlight();
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
          if (solidAt(b.x, b.y)) { gone = true; break; }
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
          burst(W.p.x + s.ox, W.p.y + s.oy, 4, '#e8e8f0');
          SFX.fx('lash', W.p.x + s.ox, W.p.y + s.oy);
        }
      }
      // a web line whose rock has been blasted away comes down (a few checked a frame)
      for (let n = Math.min(W.webs.length, 6); n > 0; n--) {
        W.webCheck = (W.webCheck + 1) % W.webs.length;
        const L = W.webs[W.webCheck];
        if ((L.bin && !solidAt(L.bin.x, L.bin.y)) || (L.ain && !solidAt(L.ain.x, L.ain.y))) {
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
      fireFrame(dt, pcx, pcy);

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
          if (Math.hypot(W.enemies[j].x - bn.x, W.enemies[j].ty - bn.y) < 15) { setAlight(W.enemies[j]); damageEnemy(j, 22 * dt); }
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
        if (q.heavy && solidAt(nx, ny)) { q.vx *= 0.3; q.vy = 0; }
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
            tracePath(tsh, pcx, gy, Math.cos(a), Math.sin(a), solidAt, W.enemies, aimPath,
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
      W.visPts = visPoly(pcx, pcy, sight, solidCell, VIS_RAYS);
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
        fogLit(sc.x, sc.y);
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
        if (pr.k !== 'eyes' && !fogLit(pr.x, pr.y)) continue;
        propGlow(ctx, pr, W.time, TH, Math.hypot(pr.x - pcx, pr.y - pcy), W.torchR);
      }
      // and the green round each jelly glows and twinkles in its colour (plantGlow)
      for (const e of W.enemies)
        if (e.je && onView(e.x, e.ty, 160) && fogLit(e.x, e.ty)) plantGlow(e, TH);
      // glowing creatures (the jellyfish) light the cave round them, flaring as they pulse.
      // Radius, brightness and flare are its kp+'GlowR' / 'Glow' / 'Flare' knobs, and like
      // every other light out here it shows only where the fog has lifted
      for (const e of W.enemies) {
        const k = e.k;
        if (!k.glow || !k.kp || !onView(e.x, e.ty, 120) || !fogLit(e.x, e.ty)) continue;
        const u = (e.je && e.je.u) || { glowR: 0.5, glow: 0.5, flare: 0.5 }, sh = e.je ? e.je.shape : 0;
        const a = kru(k.kp + 'Glow', u.glow) * (1 + kru(k.kp + 'Flare', u.flare) * sh);
        const rgb = e.je ? hexRgb(jcol('jeColGlow', e.je.u.col)) : k.glow;
        glowAt(ctx, e.x, e.ty, kru(k.kp + 'GlowR', u.glowR), a, rgb);
        glowAt(ctx, e.x, e.ty, e.r * 1.6, a * 1.4, rgb);
      }
      for (const b of W.enemyShots) if (b.glow && onView(b.x, b.y, 30) && fogLit(b.x, b.y)) glowAt(ctx, b.x, b.y, b.size * 6, 0.3, b.glow);
      // v95: your glowing shots light the cave round them (the Bubble Spark most of all)
      for (const b of W.bullets) if (b.light && !b.hidden && onView(b.x, b.y, 50) && fogLit(b.x, b.y))
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
          if (fogLit(x, y)) glowAt(ctx, x, y, 20, Math.min(0.14, 0.03 + W.fireVis.length / 3000) * W.flick, '255,120,40');
        }
      }
      for (const e of W.enemies)
        if (e.burn > 0 && onView(e.x, e.ty, 40) && fogLit(e.x, e.ty)) glowAt(ctx, e.x, e.ty, e.r * 2.4, 0.22 * W.flick, '255,130,50');
      for (const pr of W.firePlants)
        if (pr.burn && !pr.gone && onView(pr.x, pr.y + pr.len, 40) && fogLit(pr.x, pr.y + pr.len))
          glowAt(ctx, pr.x, pr.y + pr.len, 16, 0.2 * W.flick, '255,130,50');
      if (W.p.burn > 0 && !W.p.dead) glowAt(ctx, W.p.x + PW / 2, W.p.y + PH / 2, 22, 0.25 * W.flick, '255,130,50');
      for (const list of [W.dparts, W.amb]) for (const q of list) {
        if (!q.glow || !onView(q.x, q.y, 10) || !fogLit(q.x, q.y)) continue;
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
      const MHP = maxHp();
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
        for (const q of W.pickups) {
          if (q.taken || !fogLit(q.x, q.y)) continue;
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
