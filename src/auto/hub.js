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

import { ARRIVAL_X, CELL, PW, SHOP_H, SHOP_SLOT } from '../core/consts.js';
import { tubeLevel } from '../world/shoplights.js';
import { TCELL } from '../art/titlescene.js';
import { EXO_CATS, EXO_GLYPH, autoExoPrice, autoGunPrice } from './run.js';
import { mapState } from './maps.js';

// (owner, feedback round 2: the old shop's room) the old layout's numbers: the way in's pad as far from the end wall as
// the old one (ARRIVAL_X), the stops the old shop's SHOP_SLOT apart, the old room's height and its 3-cell side walls
export const HUB_EDGE = ARRIVAL_X;    // the first and last stop's distance from the strip's ends (world units)
export const HUB_GAP = SHOP_SLOT;     // stop to stop (a machine is 56 wide): 120
export const HUB_ROOM = SHOP_H * CELL; // the room's height, floor to roof (world units; a machine is 84 tall): 96
export const HUB_WALL = 3;            // the end walls' thickness (cells)
export const HUB_ARRIVE = 1;          // the enter pad charges this long before the player comes through (s)
export const HUB_FLASH = 0.4;         // the flash as he comes through (s)
export const HUB_ZAP = 1.4;           // the pad crackles this long after (s)
export const HUB_PAD = 14;            // the exit pad: the leader's middle within this of its middle (world units)

/** @typedef {'enter' | 'gun' | 'exo' | 'mod' | 'perk' | 'map' | 'exit'} HubStopId */
/** @type {HubStopId[]} */
const STOP_IDS = ['enter', 'gun', 'exo', 'mod', 'perk', 'map', 'exit'];
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
  map: { hue: '#c89bff', icon: 'map' },   // the map machine (auto/maps.js): its front is painted by hubdraw.js drawMapFront
};
// the exo machine's hologram: each category's glyph (STAT_PERKS), one after another
export const HUB_EXO_GLYPHS = EXO_CATS.map(c => EXO_GLYPH[c]);
export const HUB_EXO_T = 1.2;         // each shows this long

// HubState (thrown, paid, back: stage 10a, auto/throw.js; paid is the run's run.paid, vend: when each machine began paying out
// (-1 idle), paidV: + 1 each payout (the screen saves): stage 10b, auto/payout.js): fy, roof (world y); on: when each tube came on (-1 not yet); zap: when someone last came through
// the enter pad; arrived: each player's through; tier: the run's (the prices); lx: the leader's middle (world x);
// dir: the way he last ran (1 right, -1 left: the others line up behind); exitT: when A was tapped at the exit pad
// (-99 never); stick: the pill stick's push (hubStick)
/** @typedef {{ active: boolean, nx: number, ny: number, mag: number, dy: number }} HubStick */
/** @typedef {{ fy: number, roof: number, on: number[], zap: number, arrived: boolean[], tier: number,
 *   lx: number, dir: number, exitT: number, exitZ?: number, stick: HubStick, thrown: import('./throw.js').HubThrow[],
 *   paid: Record<string, number>, back: { kind: import('./throw.js').Cash, n: number }[],
 *   vend: Record<string, number>, paidV: number, demo: Record<string, HubDemo>,
 *   run?: AutoRun, mapSel: number, mapFlick: number, mapT: number, late?: number, at?: number[], far?: number }} HubState */
// late: when the enter pad began charging for a player added mid-hub (hubLate); at: his arrival time; far: when he came
// through (the play area's flash from the left when the pad is off screen, ui/auto/AutoScreen.js)
// a crystal machine's hologram demo (the old shop's stepDemo): t s into it, the side of the machine it plays on
/** @typedef {{ t: number, side: number }} HubDemo */
/** @param {import('../art/titlescene.js').TitleScene} S @returns {HubState} */
export const hubState = S => (S.hub && S.hub.data);

// (owner, after v1.0.78) a player added in the hub (a green gem: ui/auto/AutoScreen.js): he comes through the enter pad
// as the team did, the pad charging HUB_ARRIVE first, wherever the team is (off screen: the flash from the left)
/** @param {import('../art/titlescene.js').TitleScene} S @param {number} i his runner, hidden on the pad */
export function hubLate(S, i) {
  const H = hubState(S);
  if (!H) return;
  H.late = S.t; (H.at || (H.at = []))[i] = S.t + HUB_ARRIVE; H.arrived[i] = false;
}
// when player i comes through the enter pad (s into the run)
/** @param {number} i */
export const hubArriveT = i => HUB_ARRIVE + i * 0.5;
// (owner v1.0.74) a pad takes one at a time: is anyone who has come through still standing on the pad at world x px?
// (sx: the runners' screen x is world x less sx; the hub's 0)
/** @param {import('../art/titlescene.js').TitleScene} S @param {boolean[]} arrived @param {number} px @param {number} [sx] */
export const padBusy = (S, arrived, px, sx = 0) => S.runners.some((r, i) => arrived[i] && !r.hide && !r.out && Math.abs(r.x + PW / 2 + sx - px) < PAD_HALF);
export const PAD_HALF = 15;           // half the pad's width (game/render/pads.js PAD_W)
// player i may come through now: his time, everyone before him through, the pad clear
/** @param {import('../art/titlescene.js').TitleScene} S @param {boolean[]} arrived @param {number} i @param {number} px @param {number} [sx] */
export const padNext = (S, arrived, i, px, sx = 0) => !arrived[i] && S.t >= hubArriveT(i) && arrived.slice(0, i).every(a => a) && !padBusy(S, arrived, px, sx);

/** how far tube i is on (0-1) @param {import('../art/titlescene.js').TitleScene} S @param {number} i */
export function hubTube(S, i) {
  const H = hubState(S);
  return !H || H.on[i] < 0 ? 0 : tubeLevel(S.t - H.on[i], i + 1);
}

// the enter pad's charge (0-1 while charging, else 0) and what's left of the flash (0-1)
/** @param {import('../art/titlescene.js').TitleScene} S */
export function hubCharge(S) {
  const H = hubState(S), t = H && H.late != null ? S.t - H.late : S.t;
  return { ch: t < HUB_ARRIVE ? Math.max(0, t / HUB_ARRIVE) : 0, fl: t >= HUB_ARRIVE ? Math.max(0, 1 - (t - HUB_ARRIVE) / HUB_FLASH) : 0 };
}

// the room's inside, for a player's middle (between the end walls)
const IN_L = HUB_WALL * TCELL + PW / 2, IN_R = HUB_W - HUB_WALL * TCELL - PW / 2;

// is the leader standing on the exit pad (within HUB_PAD of its middle, feet on the floor)?
/** @param {import('../art/titlescene.js').TitleScene} S */
export function hubAtExit(S) {
  const H = hubState(S), L = S.runners[0];
  return !!H && !!L && H.arrived[0] && L.ground && Math.abs(L.x + PW / 2 - hubStopX('exit')) <= HUB_PAD;
}
// what's left of the exit pad's flash (0-1)
/** @param {import('../art/titlescene.js').TitleScene} S */
export function hubExitFlash(S) {
  const H = hubState(S);
  return H ? Math.max(0, Math.min(1, 1 - (S.t - (H.exitZ ?? -99)) / HUB_FLASH)) : 0;
}

// what A does at the map machine now: 'pick' (an owned map: make it the active one), 'pay' (the next locked map), 'no'
/** @param {import('../art/titlescene.js').TitleScene} S @returns {'pick' | 'pay' | 'no'} */
export function hubMapA(S) {
  const H = hubState(S);
  if (!H || !H.run) return 'no';
  const s = mapState(H.run, H.mapSel);
  return s === 'owned' ? 'pick' : s === 'buy' ? 'pay' : 'no';
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
