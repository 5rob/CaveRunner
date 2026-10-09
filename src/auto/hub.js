// @ts-check
// CaveRunner Auto's hub (AUTOBATTLER.md stage 3): a fixed strip for the menu scene (art/titlescene.js
// opts.hub), the old shop's steel room (a steel floor, roof and end walls; a brick back wall over a steel
// wainscot) with its stops evenly spaced left → right: the enter teleporter, the gun, exo, mod and perk
// machines, the exit teleporter (HUB_STOPS). A run begins dark: the player teleports in on the left pad
// (HUB_ARRIVE: the pad charges, then the flash and lightning), and the ceiling's tubes (one over each
// stop) stutter on one after another (world/shoplights.js tubeLevel). The painter is
// game/render/hubdraw.js. Arrow travel and prices are stage 3b: they hook on HUB_STOPS' x.

import { PH, PW } from '../core/consts.js';
import { STAT_PERKS } from '../data/perks.js';
import { LIGHT_RUN, LIGHT_WAIT, tubeLevel } from '../world/shoplights.js';
import { TCELL, TM, titleScene } from '../art/titlescene.js';
import { EXO_CATS, EXO_GLYPH } from './run.js';

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

/** @typedef {{ fy: number, roof: number, on: number[], zap: number, arrived: boolean[] }} HubState */
/** @param {import('../art/titlescene.js').TitleScene} S @returns {HubState} */
export const hubState = S => (S.hub && S.hub.data);

// The hub's scene: titleScene with the strip, n players. They wait (hidden) until the enter pad has charged,
// then each comes through it in turn (HUB_ARRIVE, then 0.5 s apart) and stands on the floor
/** @param {number} vh @param {number} seed @param {number} n players @returns {import('../art/titlescene.js').TitleScene} */
export function hubScene(vh, seed, n) {
  const fy = hubFloor(vh);
  /** @type {HubState} */
  const H = { fy, roof: fy - HUB_ROOM, on: HUB_STOPS.map(() => -1), zap: -99, arrived: [] };
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
    r.y = H.fy - PH; r.vy = 0; r.ground = true; r.mode = 'run'; r.stand = true;
  });
  // the tubes: the enter pad's LIGHT_WAIT after the start, then the next along every LIGHT_RUN × 1.6
  for (let i = 0; i < H.on.length; i++) {
    const at = LIGHT_WAIT + i * LIGHT_RUN * 1.6;
    if (H.on[i] < 0 && S.t >= at) H.on[i] = at;
  }
  void dt;
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
