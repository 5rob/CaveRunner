// @ts-check
// CaveRunner Auto stage 10a: gold and gems thrown out of the bag into the hub's machines. Pure (the screen,
// ui/auto/AutoScreen.js, turns the finger into throws). A thrown thing (HubThrow) flies, bounces on the floor
// (stepNugget) and, within DEV.autoThrowPull of a machine that takes it (THROW_TAKES: the gun and exo machines gold, the
// mod machine red, the perk machine green), is pulled into its mouth and counted (H.paid[id], what stage 10b pays out
// from). A machine that doesn't take it knocks it away; anything still lying after DEV.autoThrowBack s flies back to
// player 1 and into the bag (H.back, drained by the screen). A lump (the whole stack held, then let go) carries its
// amount as one big nugget or gem.
// Feedback round 2 (owner): paid with A instead (hubPayAt: player 1 at a machine; hubPayOne: one out of his chest, payVel
// its velocity from the drag on A). A thing is pulled in only once it has landed; on the floor they collide
// (collideNuggets) at their real sizes: a gold piece the game's smallest nugget, a gem the game's crystal (CRYSTAL_R).

import { PH, PW } from '../core/consts.js';
import { DEV } from '../dev/knobs.js';
import { NUGGETS, collideNuggets, stepNugget } from '../world/nuggets.js';
import { CRYSTAL_R } from '../art/sprites.js';
import { TCELL } from '../art/titlescene.js';
import { HUB_W, HUB_WALL, hubState, hubStopX } from './hub.js';

// a thrown thing's radius (world units): one gold, the game's smallest nugget; a gem, the game's crystal
/** @param {{ kind: string, lump?: boolean }} g */
export const throwR = g => (g.kind === 'gold' ? (g.lump ? NUGGETS[0].r : NUGGETS[2].r) : CRYSTAL_R);

/** @typedef {'gold' | 'red' | 'green'} Cash */
/** @typedef {{ x: number, y: number, vx: number, vy: number, kind: Cash, n: number, t: number, a: number,
 *   held?: boolean, lump?: boolean, home?: boolean, pull?: import('./hub.js').HubStopId, ground?: number, landed?: boolean, fly?: boolean,
 *   to?: import('./hub.js').HubStopId, rest?: number }} HubThrow */

// what each machine takes
/** @type {Record<string, Cash>} */
export const THROW_TAKES = { gun: 'gold', exo: 'gold', mod: 'red', perk: 'green' };
/** @type {import('./hub.js').HubStopId[]} */
const MACHINES = ['gun', 'exo', 'mod', 'perk'];
export const MOUTH_UP = 30;          // the mouth: this far above the floor (world units; the coin panel)
export const MACH_HALF = 28;         // a machine's half width (it's 56 wide, 84 tall)
export const MACH_H = 84;

/** does machine id take this? @param {string} id @param {string} kind */
export const machineTakes = (id, kind) => THROW_TAKES[id] === kind;

/** is it a thing you can throw (gold, a red or a green gem)? @param {{ kind: string } | null | undefined} it */
export const throwable = it => !!it && (it.kind === 'gold' || it.kind === 'red' || it.kind === 'green');

// a finger's speed (css px / s) as a world speed: css px → screen units (k: css px per screen unit) → world (÷ the zoom)
/** @param {number} vx @param {number} vy @param {number} k @param {number} z @returns {{ vx: number, vy: number }} */
export const screenToWorldVel = (vx, vy, k, z) => ({ vx: vx / k / z, vy: vy / k / z });

// the machine that takes kind nearest (x, y) within r of its mouth (null none)
/** @param {number} x @param {number} y @param {string} kind @param {number} fy @param {number} r @returns {import('./hub.js').HubStopId | null} */
export function pullingMachine(x, y, kind, fy, r) {
  let best = null, bd = r;
  for (const id of MACHINES) {
    if (!machineTakes(id, kind)) continue;
    const d = Math.hypot(hubStopX(id) - x, fy - MOUTH_UP - y);
    if (d < bd) { bd = d; best = id; }
  }
  return best;
}

// the machine whose cabinet (x, y) is inside (null none)
/** @param {number} x @param {number} y @param {number} fy @returns {import('./hub.js').HubStopId | null} */
export function machineAt(x, y, fy) {
  for (const id of MACHINES) if (Math.abs(x - hubStopX(id)) < MACH_HALF && y > fy - MACH_H) return id;
  return null;
}

// a step's pull toward (tx, ty): as the old vend suction / the gold's pull, faster the nearer
/** @param {HubThrow} g @param {number} tx @param {number} ty @param {number} r its reach @param {number} dt @returns {number} the distance left */
export function pullStep(g, tx, ty, r, dt) {
  const dx = tx - g.x, dy = ty - g.y, d = Math.hypot(dx, dy) || 1;
  const grab = DEV.autoThrowSuck * (0.3 + Math.max(0, 1 - d / r));
  g.vx += (dx / d) * grab * dt * 6; g.vy += (dy / d) * grab * dt * 6;
  g.vx *= 0.88; g.vy *= 0.88;
  g.x += g.vx * dt; g.y += g.vy * dt;
  return Math.hypot(tx - g.x, ty - g.y);
}

// the hub's room as a solid test (the floor, the roof, the end walls)
/** @param {{ fy: number, roof: number }} H @returns {(x: number, y: number) => boolean} */
export const roomSolid = H => (x, y) => y >= H.fy || y <= H.roof || x < HUB_WALL * TCELL || x >= HUB_W - HUB_WALL * TCELL;

// a new throw, into the hub's list (H.thrown); world (x, y), world velocity
/** @param {import('../art/titlescene.js').TitleScene} S @param {Cash} kind @param {number} n @param {number} x @param {number} y @param {number} vx @param {number} vy @param {{ held?: boolean }} [o] */
export function hubThrow(S, kind, n, x, y, vx, vy, o) {
  const H = hubState(S);
  if (!H) return null;
  /** @type {HubThrow} */
  const g = { x, y, vx, vy, kind, n, t: 0, a: 0, lump: n > 1, held: !!(o && o.held) };
  H.thrown.push(g);
  return g;
}

// ---- feedback round 2: paying with A ----
/** the machine player 1 stands at (his middle within DEV.autoPayReach of it), to pay with A; null none
 * @param {import('../art/titlescene.js').TitleScene} S @returns {import('./hub.js').HubStopId | null} */
export function hubPayAt(S) {
  const H = hubState(S), L = S.runners[0];
  if (!H || !L || L.hide || H.exitT >= 0) return null;
  const cx = L.x + PW / 2;
  for (const id of MACHINES) if (Math.abs(cx - hubStopX(id)) < DEV.autoPayReach) return id;
  return null;
}
export const PAY_DEAD = 8;       // a drag on A shorter than this (css px) is no drag: the tap's throw
export const PAY_MAX = 90;       // the drag counts up to this far (css px)
export const PAY_TAP = { vx: 55, vy: -110 };   // no drag: a little hop forward, onto the floor in front of him
export const PAY_REST = 0.25;    // a paid thing lies this long on the floor (s) before the machine pulls it in
/** a paid thing's velocity (world / s) from the drag on A (css px from where it was pressed), facing face (±1)
 * @param {number} face @param {number} dx @param {number} dy @returns {{ vx: number, vy: number }} */
export function payVel(face, dx, dy) {
  const d = Math.hypot(dx, dy);
  if (d < PAY_DEAD) return { vx: (face < 0 ? -1 : 1) * PAY_TAP.vx, vy: PAY_TAP.vy };
  const sp = Math.min(d, PAY_MAX) * DEV.autoPayK;
  return { vx: dx / d * sp, vy: dy / d * sp };
}
/** one out of player 1's chest at (vx, vy), paid to machine `to` @param {import('../art/titlescene.js').TitleScene} S @param {Cash} kind @param {number} vx @param {number} vy @param {import('./hub.js').HubStopId} [to] */
export function hubPayOne(S, kind, vx, vy, to) {
  const L = S.runners[0];
  if (!L) return null;
  S.snd.push({ k: 'coin', x: L.x + PW / 2, y: L.y + PH * 0.4 });
  const g = hubThrow(S, kind, 1, L.x + PW / 2, L.y + PH * 0.4, vx, vy);
  if (g && to) g.to = to;
  return g;
}

// One step of everything thrown (hubStep calls it)
/** @param {import('../art/titlescene.js').TitleScene} S @param {import('./hub.js').HubState} H @param {number} dt */
export function stepThrown(S, H, dt) {
  if (!H.thrown.length) return;
  const solid = roomSolid(H), L = S.runners[0];
  for (let i = H.thrown.length - 1; i >= 0; i--) {
    const g = H.thrown[i];
    if (g.held) continue;
    g.t += dt; g.a += g.vx * dt * 0.2;
    g.fly = !!g.home || !!g.pull;
    // back to the bag: flies to player 1, into the bag at 12
    if (g.home) {
      const tx = L ? L.x + PW / 2 : g.x, ty = L ? L.y + PH / 2 : g.y;
      if (pullStep(g, tx, ty, 200, dt) < 12) { H.back.push({ kind: g.kind, n: g.n }); H.thrown.splice(i, 1); S.snd.push({ k: 'coin', x: g.x, y: g.y }); }
      continue;
    }
    // (feedback round 2) pulled in only once it has landed: it shoots out, lands, then goes in. One paid with A (g.to) lies
    // PAY_REST s on the floor, then goes into the machine it was paid at from wherever it rolled
    if (g.ground) g.landed = true;
    if (g.landed && g.to) g.rest = (g.rest || 0) + dt;
    const id = g.to ? (g.pull || (g.rest || 0) >= PAY_REST ? g.to : null)
      : g.landed || g.pull ? pullingMachine(g.x, g.y, g.kind, H.fy, DEV.autoThrowPull) : null;
    if (id) {
      g.pull = id;
      const tx = hubStopX(id), ty = H.fy - MOUTH_UP;
      if (pullStep(g, tx, ty, Math.max(DEV.autoThrowPull, g.to ? Math.hypot(tx - g.x, ty - g.y) : 0), dt) < 6) {
        H.paid[id] = (H.paid[id] || 0) + g.n; H.paidV++;
        H.thrown.splice(i, 1);
        S.snd.push({ k: 'coin', x: g.x, y: g.y });
      }
      continue;
    }
    g.pull = undefined;
    // a machine that doesn't take it knocks it away (one that does lets it land, then pulls it in)
    const m = machineAt(g.x, g.y, H.fy);
    if (m && !machineTakes(m, g.kind)) { const s = Math.sign(g.x - hubStopX(m)) || 1; g.vx = s * Math.max(60, Math.abs(g.vx)); g.vy = Math.min(g.vy, -60); }
    if (stepNugget(g, dt, solid, throwR(g))) S.snd.push({ k: 'coinland', x: g.x, y: g.y });
    if (g.t > DEV.autoThrowBack) g.home = true;
  }
  // on the floor they knock into each other (the ones flying in or home pass through)
  /** @type {(b: any) => number} */
  const rOf = b => throwR(b);
  collideNuggets(H.thrown.filter(g => !g.held), solid, rOf);
}
