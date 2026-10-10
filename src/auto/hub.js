// @ts-check
// CaveRunner Auto's hub (AUTOBATTLER.md stage 3): a fixed strip for the menu scene (art/titlescene.js
// opts.hub), the old shop's steel room (a steel floor, roof and end walls; a brick back wall over a steel
// wainscot) with its stops evenly spaced left → right: the enter teleporter, the gun, exo, mod and perk
// machines, the exit teleporter (HUB_STOPS). A run begins dark: the player teleports in on the left pad
// (HUB_ARRIVE: the pad charges, then the flash and lightning), and the ceiling's tubes (one over each
// stop) stutter on one after another (world/shoplights.js tubeLevel). The painter is
// game/render/hubdraw.js. Free roam (owner, after stage 4a): the pill stick runs and jets player 1 anywhere in
// the room (hubStick, hubMove), the others line up behind him on the floor; the exit (hubAtExit, hubExit: A at the exit pad flashes it) and the asking
// price on each machine (hubPrice, at the run's tier). Its numbers are Dev knobs (dev/knobs.js, 'Auto: hub').

import { AIR_ACC, ARRIVAL_X, CELL, DEAD, GRAVITY, GROUND_ACC, JET, JET_ACC, PH, PW, SHOP_H, SHOP_SLOT, WALK } from '../core/consts.js';
import { approach } from '../core/util.js';
import { DEV } from '../dev/knobs.js';
import { STAT_PERKS } from '../data/perks.js';
import { LIGHT_RUN, LIGHT_WAIT, tubeLevel } from '../world/shoplights.js';
import { TCELL, TM, jetLift, jetStep, jetThrottle, titleScene } from '../art/titlescene.js';
import { EXO_CATS, EXO_GLYPH, autoExoPrice, autoGunPrice } from './run.js';
import { stepThrown } from './throw.js';
import { stepPay } from './payout.js';

// (owner, feedback round 2: the old shop's room) the old layout's numbers: the way in's pad as far from the end wall as
// the old one (ARRIVAL_X), the stops the old shop's SHOP_SLOT apart, the old room's height and its 3-cell side walls
export const HUB_EDGE = ARRIVAL_X;    // the first and last stop's distance from the strip's ends (world units)
export const HUB_GAP = SHOP_SLOT;     // stop to stop (a machine is 56 wide): 120
export const HUB_ROOM = SHOP_H * CELL; // the room's height, floor to roof (world units; a machine is 84 tall): 96
export const HUB_WALL = 3;            // the end walls' thickness (cells)
export const HUB_ARRIVE = 1;          // the enter pad charges this long before the player comes through (s)
export const HUB_LEAVE = 0.7;         // from A at the exit pad to the level (s)
export const HUB_FLASH = 0.4;         // the flash as he comes through (s)
export const HUB_ZAP = 1.4;           // the pad crackles this long after (s)
export const HUB_PAD = 14;            // the exit pad: the leader's middle within this of its middle (world units)

/** @typedef {'enter' | 'gun' | 'exo' | 'mod' | 'perk' | 'exit'} HubStopId */
/** @type {HubStopId[]} */
const STOP_IDS = ['enter', 'gun', 'exo', 'mod', 'perk', 'exit'];
/** @type {{ id: HubStopId, x: number }[]} the stops, left to right: each its middle (world x) */
export const HUB_STOPS = STOP_IDS.map((id, i) => ({ id, x: HUB_EDGE + i * HUB_GAP }));
export const HUB_W = HUB_EDGE * 2 + (HUB_STOPS.length - 1) * HUB_GAP;   // the strip's width (world units)
/** @param {HubStopId} id */
export const hubStopX = id => (HUB_STOPS.find(s => s.id === id) || HUB_STOPS[0]).x;

// the machines' looks (game/render/hubdraw.js): hue, hologram (an icon; 'gun': the gun sprite; 'exo': the exo glyphs
// in turn, HUB_EXO_GLYPHS) and the crystal it takes (a slot in that colour). As on main: guns gold, mods red, perks green
/** @type {Record<string, { hue: string, icon: string, takes?: 'red' | 'green' }>} */
export const HUB_MACHINES = {
  gun: { hue: '#ffd95a', icon: 'gun' },
  exo: { hue: '#3fe6d6', icon: 'exo' },
  mod: { hue: '#ff3a4a', icon: '⚙️', takes: 'red' },
  perk: { hue: '#3dff7a', icon: '✦', takes: 'green' },
};
// the exo machine's hologram: each category's glyph (STAT_PERKS), one after another
export const HUB_EXO_GLYPHS = EXO_CATS.map(c => EXO_GLYPH[c]);
export const HUB_EXO_T = 1.2;         // each shows this long

// where the floor is (its top, world y) in a view vh high: the room sits low in the view, a whole cell
/** @param {number} vh */
export const hubFloor = vh => Math.floor(Math.max(HUB_ROOM + 8, vh * 0.86) / TCELL) * TCELL;

// the strip's cells: steel below the floor and above the roof and at the ends; inside, the back wall: brick, a
// steel wainscot along the bottom (open: the players stand in front of it)
/** @param {number} fy the floor's top (world y) @returns {(c: number, r: number, rows: number) => number} */
const hubCell = fy => (c, r) => {
  const fr = fy / TCELL, rr = (fy - HUB_ROOM) / TCELL, nc = HUB_W / TCELL;
  if (r >= fr || r < rr || c < HUB_WALL || c >= nc - HUB_WALL) return TM.STEEL;
  return r >= fr - 14 ? TM.SWALL : TM.BWALL;
};

// HubState (thrown, paid, back: stage 10a, auto/throw.js; paid is the run's run.paid, vend: when each machine began paying out
// (-1 idle), paidV: + 1 each payout (the screen saves): stage 10b, auto/payout.js): fy, roof (world y); on: when each tube came on (-1 not yet); zap: when someone last came through
// the enter pad; arrived: each player's through; tier: the run's (the prices); lx: the leader's middle (world x);
// dir: the way he last ran (1 right, -1 left: the others line up behind); exitT: when A was tapped at the exit pad
// (-99 never); stick: the pill stick's push (hubStick)
/** @typedef {{ active: boolean, nx: number, ny: number, mag: number, dy: number }} HubStick */
/** @typedef {{ fy: number, roof: number, on: number[], zap: number, arrived: boolean[], tier: number,
 *   lx: number, dir: number, exitT: number, stick: HubStick, thrown: import('./throw.js').HubThrow[],
 *   paid: Record<string, number>, back: { kind: import('./throw.js').Cash, n: number }[],
 *   vend: Record<string, number>, paidV: number, demo: Record<string, HubDemo> }} HubState */
// a crystal machine's hologram demo (the old shop's stepDemo): t s into it, the side of the machine it plays on
/** @typedef {{ t: number, side: number }} HubDemo */
/** @param {import('../art/titlescene.js').TitleScene} S @returns {HubState} */
export const hubState = S => (S.hub && S.hub.data);

// The hub's scene: titleScene with the strip, n players. They wait (hidden) until the enter pad has charged,
// then each comes through it in turn (HUB_ARRIVE, then 0.5 s apart) and stands on the floor
/** @param {number} vh @param {number} seed @param {number} n players @param {number} [tier] the run's (the prices) @param {Record<string, number>} [paid] the run's run.paid (kept: what's been thrown in) @returns {import('../art/titlescene.js').TitleScene} */
export function hubScene(vh, seed, n, tier = 1, paid = {}) {
  const fy = hubFloor(vh);
  /** @type {HubState} */
  const H = { fy, roof: fy - HUB_ROOM, on: HUB_STOPS.map(() => -1), zap: -99, arrived: [], tier,
    lx: hubStopX('enter'), dir: 1, exitT: -99, stick: { active: false, nx: 0, ny: 0, mag: 0, dy: 0 },
    thrown: [], paid, back: [], vend: {}, paidV: 0, demo: {} };
  const S = titleScene(vh, seed, fy - HUB_ROOM, fy, { runners: n, hub: { w: HUB_W / TCELL, cell: hubCell(fy), step: hubStep, data: H } });
  S.runners.forEach((r, i) => {
    r.x = hubStopX('enter') - PW / 2 - i * 18; r.y = fy - PH; r.vx = r.vy = 0;
    r.mode = 'run'; r.ground = true; r.stand = true; r.hide = true; r.face = 1; r.ang = HUB_GUN_ANG; r.flame = 0;
    H.arrived[i] = false;
  });
  return S;
}

// when player i comes through the enter pad (s into the run)
/** @param {number} i */
export const hubArriveT = i => HUB_ARRIVE + i * 0.5;

// One step (titleStep calls it after its own): the players arriving and standing on the floor, the tubes coming on
/** @param {import('../art/titlescene.js').TitleScene} S @param {number} dt */
export function hubStep(S, dt) {
  const H = hubState(S);
  if (!H) return;
  S.runners.forEach((r, i) => {
    if (!H.arrived[i] && S.t >= hubArriveT(i)) {
      H.arrived[i] = true; H.zap = S.t; r.hide = false;
      S.flash = Math.max(S.flash, 0.5);
      const cx = r.x + PW / 2;
      for (let k = 0; k < 18; k++) {
        const a = S.rnd() * Math.PI * 2, sp = 20 + S.rnd() * 60;
        S.parts.push({ x: cx, y: H.fy - PH / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: 0.5, max: 0.5, r: 1.2,
          col: k % 3 ? '#7cc8ff' : '#e6f6ff', kind: 'spark' });
      }
      S.snd.push({ k: 'arc', x: cx, y: H.fy - PH / 2 });
    }
    if (!H.arrived[i]) { r.y = H.fy - PH; r.vy = 0; r.ground = true; r.mode = 'run'; }
  });
  hubMove(S, H, dt);
  stepThrown(S, H, dt);
  stepPay(S, H);
  stepHubDemo(H, S.runners[0] && H.arrived[0] ? S.runners[0].x + PW / 2 : -999, dt);
  // the tubes: the enter pad's LIGHT_WAIT after the start, then the next along every LIGHT_RUN × 1.6
  for (let i = 0; i < H.on.length; i++) {
    const at = LIGHT_WAIT + i * LIGHT_RUN * 1.6;
    if (H.on[i] < 0 && S.t >= at) H.on[i] = at;
  }
}

// ---- the crystal machines' demo (the old shop's stepDemo, game/systems/shops.js) ----
// While the leader stands within DEV.autoHubDemoNear of a crystal machine (the nearer of the two) that has had nothing
// paid into it this run and isn't paying out, it plays its demo of a gem going in, on his side; walk off and it stops
// (the next time starts over). game/render/hubdraw.js draws it (the old drawDemo, with the old demoAt timing)
/** @param {HubState} H @param {number} lx the leader's middle (world x; far off: none) @param {number} dt */
export function stepHubDemo(H, lx, dt) {
  let near = '';
  /** @param {string} k */
  const sx = k => (HUB_STOPS.find(s => s.id === k) || HUB_STOPS[0]).x;
  for (const k in HUB_MACHINES) if (HUB_MACHINES[k].takes && (!near || Math.abs(lx - sx(k)) < Math.abs(lx - sx(near)))) near = k;
  for (const k in HUB_MACHINES) {
    if (!HUB_MACHINES[k].takes) continue;
    const mx = sx(k);
    const fed = (H.paid[k] || 0) > 0 || (H.vend[k] !== undefined && H.vend[k] >= 0);
    if (k !== near || fed || H.exitT >= 0 || Math.abs(lx - mx) > DEV.autoHubDemoNear) { delete H.demo[k]; continue; }
    const D = H.demo[k] || (H.demo[k] = { t: 0, side: lx < mx ? -1 : 1 });
    D.t += dt;
  }
}

/** how far tube i is on (0-1) @param {import('../art/titlescene.js').TitleScene} S @param {number} i */
export function hubTube(S, i) {
  const H = hubState(S);
  return !H || H.on[i] < 0 ? 0 : tubeLevel(S.t - H.on[i], i + 1);
}

// the enter pad's charge (0-1 while charging, else 0) and what's left of the flash (0-1)
/** @param {import('../art/titlescene.js').TitleScene} S */
export function hubCharge(S) {
  const t = S.t;
  return { ch: t < HUB_ARRIVE ? Math.max(0, t / HUB_ARRIVE) : 0, fl: t >= HUB_ARRIVE ? Math.max(0, 1 - (t - HUB_ARRIVE) / HUB_FLASH) : 0 };
}

// ---- free roam (owner, after stage 4a: the pill stick) ----
// The stick (ui/auto/AutoScreen.js): its push as the old game's left thumbstick (ui/hud.js Stick): mag 0-1 from the
// middle, nx/ny its direction, dy < 0 pushed up. Nothing until the leader is through the enter pad
/** @param {import('../art/titlescene.js').TitleScene} S @param {HubStick} st */
export function hubStick(S, st) {
  const H = hubState(S);
  if (H && H.exitT < 0) H.stick = { active: !!st.active, nx: st.nx || 0, ny: st.ny || 0, mag: st.mag || 0, dy: st.dy || 0 };
}
// the push past the dead zone (0-1), as game/systems/player.js
/** @param {HubStick} st */
const push = st => (st.active && st.mag > DEAD ? (st.mag - DEAD) / (1 - DEAD) : 0);

// a follower's step toward tx: DEV.autoHubWalk × k, easing in over the last few units; how far it moved
/** @param {number} x @param {number} tx @param {number} dt @param {number} k */
function walkTo(x, tx, dt, k) {
  const d = tx - x, a = Math.abs(d);
  if (a < 0.05) return d;
  const v = DEV.autoHubWalk * DEV.autoMoveK * k * Math.min(1, Math.max(0.12, a / 6));   // (they keep up with him: × autoMoveK)
  return Math.sign(d) * Math.min(a, v * dt);
}

// the room's inside, for a player's middle (between the end walls)
const IN_L = HUB_WALL * TCELL + PW / 2, IN_R = HUB_W - HUB_WALL * TCELL - PW / 2;

// One step of the team. The leader steers exactly as the old game's player (game/systems/player.js movePlayer: walk
// WALK with GROUND_ACC / AIR_ACC; the jet aims the stick's way at JET, rising beats a fall at once; gravity GRAVITY,
// falls capped at 900; no fuel in the hub), he lands on the floor, the end walls and the roof hold him. The others walk
// the floor in a line behind him (DEV.autoHubSpace apart), running while they move, standing when they don't
/** @param {import('../art/titlescene.js').TitleScene} S @param {HubState} H @param {number} dt */
function hubMove(S, H, dt) {
  const L = S.runners[0];
  if (!L || !H.arrived[0]) return;
  const st = H.stick, m = push(st), jet = m > 0 && st.dy < 0, mv = DEV.move;
  if (jet) {
    L.vx = approach(L.vx, st.nx * m * JET * DEV.autoMoveK * mv, JET_ACC * DEV.autoMoveK * dt);
    const ty = jetLift(st.ny, m) * mv;
    L.vy = ty < L.vy ? approach(L.vy, ty, JET_ACC * DEV.autoMoveK * 2 * dt) : approach(L.vy, ty, JET_ACC * DEV.autoMoveK * dt);
  } else {
    L.vx = approach(L.vx, m > 0 ? st.nx * m * WALK * DEV.autoMoveK * mv : 0, (L.ground ? GROUND_ACC : AIR_ACC) * DEV.autoMoveK * dt);
    L.vy = Math.min(L.vy + GRAVITY * dt, 900);
  }
  const thr = jet ? jetThrottle(st.ny, m) : 0;
  let cx = L.x + PW / 2 + L.vx * dt;
  if (cx < IN_L) { cx = IN_L; L.vx = Math.max(0, L.vx); }
  if (cx > IN_R) { cx = IN_R; L.vx = Math.min(0, L.vx); }
  L.x = cx - PW / 2;
  L.y += L.vy * dt;
  if (L.y < H.roof + 1) { L.y = H.roof + 1; L.vy = Math.max(0, L.vy); }
  if (L.y + PH >= H.fy) {
    if (L.vy > 100) S.snd.push({ k: 'land', x: cx, y: H.fy, a: L.vy * 2 });
    L.y = H.fy - PH; L.vy = Math.min(0, L.vy); L.ground = L.vy >= 0;
  } else L.ground = false;
  L.mode = L.ground ? 'run' : 'fly'; L.flame = L.ground ? 0 : thr;
  if (Math.abs(L.vx) > 1) { L.face = Math.sign(L.vx); H.dir = L.face; }
  if (L.ground) L.gait += Math.abs(L.vx) * dt * 0.3;
  L.stand = L.ground && Math.abs(L.vx) <= 1;
  H.lx = cx;
  S.runners.forEach((r, i) => {
    if (i === 0 || !H.arrived[i]) return;
    const rx = r.x + PW / 2;
    const tx = Math.max(IN_L, Math.min(IN_R, H.lx - H.dir * DEV.autoHubSpace * i));
    const mv = walkTo(rx, tx, dt, 1.25);
    r.x += mv; r.y = H.fy - PH; r.vy = 0; r.ground = true; r.mode = 'run'; r.flame = 0;
    const moving = Math.abs(mv) > 1e-3;
    r.vx = moving ? mv / Math.max(dt, 1e-3) : 0;
    if (moving) { r.face = Math.sign(mv); r.gait += Math.abs(mv) * 0.3; }
    r.stand = !moving;
  });
  // (owner, feedback round 1) the gun held the way each faces: the resting angle, mirrored facing left
  for (const r of S.runners) r.ang = r.face < 0 ? Math.PI - HUB_GUN_ANG : HUB_GUN_ANG;
  // (feedback round 2) the old jetpack here too: player 1's flame away from his stick's push, its smoke
  L.jetIn = jet ? { nx: st.nx, ny: st.ny } : null;
  for (const r of S.runners) if (!r.hide) jetStep(S, r, dt);
}
const HUB_GUN_ANG = 0.35;              // the gun's resting angle in the hub (a little down, facing right)

// is the leader standing on the exit pad (within HUB_PAD of its middle, feet on the floor)?
/** @param {import('../art/titlescene.js').TitleScene} S */
export function hubAtExit(S) {
  const H = hubState(S), L = S.runners[0];
  return !!H && !!L && H.arrived[0] && L.ground && Math.abs(L.x + PW / 2 - hubStopX('exit')) <= HUB_PAD;
}
// A at the exit pad: the pad flashes (stage 4 starts the level from it); false anywhere else
/** @param {import('../art/titlescene.js').TitleScene} S */
export function hubExit(S) {
  const H = hubState(S);
  if (!H || H.exitT >= 0 || !hubAtExit(S)) return false;
  H.exitT = S.t; S.flash = Math.max(S.flash, 0.5);
  S.snd.push({ k: 'arc', x: hubStopX('exit'), y: H.fy - PH / 2 });
  // everyone goes in the flash (stage 4b), sparks where each stood
  for (const r of S.runners) {
    const cx = r.x + PW / 2, cy = r.y + PH / 2;
    for (let k = 0; k < 12; k++) {
      const a = S.rnd() * Math.PI * 2, sp = 20 + S.rnd() * 60;
      S.parts.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: 0.5, max: 0.5, r: 1.2,
        col: k % 3 ? '#7cc8ff' : '#e6f6ff', kind: 'spark' });
    }
    r.hide = true; r.vx = 0; r.vy = 0; r.flame = 0;
  }
  H.stick = { active: false, nx: 0, ny: 0, mag: 0, dy: 0 };
  return true;
}
// the team has gone through the exit pad and the flash has faded: the screen loads the level (stage 4b)
/** @param {import('../art/titlescene.js').TitleScene} S */
export function hubLeft(S) {
  const H = hubState(S);
  return !!H && H.exitT >= 0 && S.t - H.exitT >= HUB_LEAVE;
}
// what's left of the exit pad's flash (0-1)
/** @param {import('../art/titlescene.js').TitleScene} S */
export function hubExitFlash(S) {
  const H = hubState(S);
  return H ? Math.max(0, Math.min(1, 1 - (S.t - H.exitT) / HUB_FLASH)) : 0;
}

// ---- prices (stage 3b) ----
// what a machine asks at a tier: gold for the gun and exo machines (auto/run.js), a gem for the crystal machines
/** @param {string} id @param {number} tier @returns {{ n: number, kind: 'gold' | 'red' | 'green' } | null} */
export function hubPrice(id, tier) {
  if (id === 'gun') return { n: autoGunPrice(tier), kind: 'gold' };
  if (id === 'exo') return { n: autoExoPrice(tier), kind: 'gold' };
  const m = HUB_MACHINES[id];
  return m && m.takes ? { n: 1, kind: m.takes } : null;
}
