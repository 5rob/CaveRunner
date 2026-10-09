// @ts-check
// CaveRunner Auto's hub (AUTOBATTLER.md stage 3): a fixed strip for the menu scene (art/titlescene.js
// opts.hub), the old shop's steel room (a steel floor, roof and end walls; a brick back wall over a steel
// wainscot) with its stops evenly spaced left → right: the enter teleporter, the gun, exo, mod and perk
// machines, the exit teleporter (HUB_STOPS). A run begins dark: the player teleports in on the left pad
// (HUB_ARRIVE: the pad charges, then the flash and lightning), and the ceiling's tubes (one over each
// stop) stutter on one after another (world/shoplights.js tubeLevel). The painter is
// game/render/hubdraw.js. Stage 3b: arrow travel (hubGo: the team walks to the next stop, easing in, and
// lines up behind the leader), the exit (hubAtExit, hubExit: A at the exit pad flashes it) and the asking
// price on each machine (hubPrice, at the run's tier). Its numbers are Dev knobs (dev/knobs.js, 'Auto: hub').

import { PH, PW } from '../core/consts.js';
import { DEV } from '../dev/knobs.js';
import { STAT_PERKS } from '../data/perks.js';
import { LIGHT_RUN, LIGHT_WAIT, tubeLevel } from '../world/shoplights.js';
import { TCELL, TM, titleScene } from '../art/titlescene.js';
import { EXO_CATS, EXO_GLYPH, autoExoPrice, autoGunPrice } from './run.js';

export const HUB_EDGE = 56;           // the first and last stop's distance from the strip's ends (world units)
export const HUB_GAP = 100;           // stop to stop (a machine is 56 wide)
export const HUB_ROOM = 104;          // the room's height, floor to roof (world units; a machine is 84 tall)
export const HUB_WALL = 4;            // the end walls' thickness (cells)
export const HUB_ARRIVE = 1;          // the enter pad charges this long before the player comes through (s)
export const HUB_FLASH = 0.4;         // the flash as he comes through (s)
export const HUB_ZAP = 1.4;           // the pad crackles this long after (s)

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

// HubState: fy, roof (world y); on: when each tube came on (-1 not yet); zap: when someone last came through
// the enter pad; arrived: each player's through; tier: the run's (the prices); lx: the leader's middle (world x);
// at: the stop he stands at (-1 on the move), goal: the stop he's walking to, dir: which way (1 right, -1 left);
// exitT: when A was tapped at the exit pad (-99 never)
/** @typedef {{ fy: number, roof: number, on: number[], zap: number, arrived: boolean[], tier: number,
 *   lx: number, at: number, goal: number, dir: number, exitT: number }} HubState */
/** @param {import('../art/titlescene.js').TitleScene} S @returns {HubState} */
export const hubState = S => (S.hub && S.hub.data);

// The hub's scene: titleScene with the strip, n players. They wait (hidden) until the enter pad has charged,
// then each comes through it in turn (HUB_ARRIVE, then 0.5 s apart) and stands on the floor
/** @param {number} vh @param {number} seed @param {number} n players @param {number} [tier] the run's (the prices) @returns {import('../art/titlescene.js').TitleScene} */
export function hubScene(vh, seed, n, tier = 1) {
  const fy = hubFloor(vh);
  /** @type {HubState} */
  const H = { fy, roof: fy - HUB_ROOM, on: HUB_STOPS.map(() => -1), zap: -99, arrived: [], tier,
    lx: hubStopX('enter'), at: 0, goal: 0, dir: 1, exitT: -99 };
  const S = titleScene(vh, seed, fy - HUB_ROOM, fy, { runners: n, hub: { w: HUB_W / TCELL, cell: hubCell(fy), step: hubStep, data: H } });
  S.runners.forEach((r, i) => {
    r.x = hubStopX('enter') - PW / 2 - i * 18; r.y = fy - PH; r.vx = r.vy = 0;
    r.mode = 'run'; r.ground = true; r.stand = true; r.hide = true; r.face = 1; r.ang = 0.35; r.flame = 0;
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
    r.y = H.fy - PH; r.vy = 0; r.ground = true; r.mode = 'run';
  });
  hubWalk(S, H, dt);
  // the tubes: the enter pad's LIGHT_WAIT after the start, then the next along every LIGHT_RUN × 1.6
  for (let i = 0; i < H.on.length; i++) {
    const at = LIGHT_WAIT + i * LIGHT_RUN * 1.6;
    if (H.on[i] < 0 && S.t >= at) H.on[i] = at;
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

// ---- arrow travel (stage 3b) ----
// where the leader stops for stop i, coming the way dir: a machine's side he comes from (DEV.autoHubOff from its
// middle), a pad's middle (he stands on it)
/** @param {number} i @param {number} dir */
export function hubStandX(i, dir) {
  const st = HUB_STOPS[i];
  return st.id === 'enter' || st.id === 'exit' ? st.x : st.x - dir * DEV.autoHubOff;
}

// An arrow: the team sets off for the next stop that way; tapped on the move it queues the one after (the goal
// moves on a stop; back the other way it turns round). Nothing until the leader is through the enter pad
/** @param {import('../art/titlescene.js').TitleScene} S @param {number} dir 1 right (>), -1 left (<) @returns {boolean} whether he goes */
export function hubGo(S, dir) {
  const H = hubState(S);
  if (!H || !H.arrived[0]) return false;
  const goal = Math.max(0, Math.min(HUB_STOPS.length - 1, H.goal + dir));
  if (goal === H.goal && H.at === goal) return false;
  H.goal = goal; H.dir = Math.sign(hubStandX(goal, dir) - H.lx) || dir;
  if (Math.abs(hubStandX(goal, H.dir) - H.lx) > 0.01) H.at = -1;
  return true;
}

// a walker's step toward tx: DEV.autoHubWalk, easing in over the last DEV.autoHubEase; how far it moved
/** @param {number} x @param {number} tx @param {number} dt @param {number} [k] a follower's catch-up @param {number} [ease] over how far */
function walkTo(x, tx, dt, k = 1, ease = DEV.autoHubEase) {
  const d = tx - x, a = Math.abs(d);
  if (a < 0.05) return d;
  const v = DEV.autoHubWalk * k * Math.min(1, Math.max(0.12, a / Math.max(1, ease)));
  return Math.sign(d) * Math.min(a, v * dt);
}

// the room's inside, for a player's middle (between the end walls)
const IN_L = HUB_WALL * TCELL + PW, IN_R = HUB_W - HUB_WALL * TCELL - PW;

// One step of the team: the leader toward his goal, the others in a line behind him (DEV.autoHubSpace apart), each
// running while it moves (the scene's run cycle: gait) and standing still when it doesn't, facing the way it goes
/** @param {import('../art/titlescene.js').TitleScene} S @param {HubState} H @param {number} dt */
function hubWalk(S, H, dt) {
  const L = S.runners[0];
  if (!L || !H.arrived[0]) return;
  if (H.at < 0) {
    const tx = hubStandX(H.goal, H.dir);
    H.lx += walkTo(H.lx, tx, dt);
    if (Math.abs(tx - H.lx) < 0.05) { H.lx = tx; H.at = H.goal; }
  }
  S.runners.forEach((r, i) => {
    if (!H.arrived[i]) return;
    const cx = r.x + PW / 2;
    const tx = i === 0 ? H.lx : Math.max(IN_L, Math.min(IN_R, H.lx - H.dir * DEV.autoHubSpace * i));
    const mv = i === 0 ? tx - cx : walkTo(cx, tx, dt, 1.25, Math.min(DEV.autoHubEase, 6));   // (keeps close: a short ease of its own)
    r.x += mv;
    const moving = Math.abs(mv) > 1e-3;
    r.vx = moving ? mv / Math.max(dt, 1e-3) : 0;
    if (moving) { r.face = Math.sign(mv); r.gait += Math.abs(mv) * 0.3; }
    r.stand = !moving;
  });
}

// is the leader standing at the exit pad?
/** @param {import('../art/titlescene.js').TitleScene} S */
export function hubAtExit(S) {
  const H = hubState(S);
  return !!H && H.at === HUB_STOPS.length - 1;
}
// A at the exit pad: the pad flashes (stage 4 starts the level from it); false anywhere else
/** @param {import('../art/titlescene.js').TitleScene} S */
export function hubExit(S) {
  const H = hubState(S);
  if (!H || !hubAtExit(S)) return false;
  H.exitT = S.t; S.flash = Math.max(S.flash, 0.5);
  S.snd.push({ k: 'arc', x: hubStopX('exit'), y: H.fy - PH / 2 });
  return true;
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
