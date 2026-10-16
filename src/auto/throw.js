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

import { PW } from '../core/consts.js';
import { DEV } from '../dev/knobs.js';
import { NUGGETS } from '../world/nuggets.js';
import { CRYSTAL_R } from '../art/sprites.js';
import { hubState, hubStopX } from './hub.js';

// a thrown thing's radius (world units): one gold, the game's smallest nugget; a gem, the game's crystal
// (owner, v1.0.45) a streamed gold piece worth more is the game's medium (sz 1) or big (sz 0) nugget
/** @param {{ kind: string, lump?: boolean, sz?: number }} g */
export const throwR = g => (g.kind === 'gold' ? (g.sz != null ? NUGGETS[g.sz].r : g.lump ? NUGGETS[0].r : NUGGETS[2].r) : CRYSTAL_R);

/** @typedef {'gold' | 'red' | 'green'} Cash */
/** @typedef {{ x: number, y: number, vx: number, vy: number, kind: Cash, n: number, t: number, a: number,
 *   held?: boolean, lump?: boolean, home?: boolean, pull?: import('./hub.js').HubStopId, ground?: number, landed?: boolean, fly?: boolean,
 *   to?: import('./hub.js').HubStopId, rest?: number, sz?: number }} HubThrow */

/** @type {import('./hub.js').HubStopId[]} */
const MACHINES = ['gun', 'exo', 'mod', 'perk', 'map'];
export const MACH_H = 84;

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

