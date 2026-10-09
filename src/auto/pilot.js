// @ts-check
// CaveRunner Auto's pace control (AUTOBATTLER.md stage 4): how fast the level scrolls under the team, as a
// pace (× the menu's scroll, art/titlescene.js S.pace). Normal pace DEV.autoLvlPace; an elite alive and near slows
// it (× DEV.autoLvlElite), an unopened chest near slows it (× DEV.autoLvlChest); the stick pushed right hurries (up to
// × DEV.autoLvlHurry at full push), pushed left slows (down to × DEV.autoLvlSlow; it never stops the team). A stop point ahead (the boss arena until the boss is dead, then the exit pad) brakes it to a
// stop there. Elites (stage 6) and chests (stage 11) don't exist yet: the inputs are plain lists, the tests use fakes.

import { DEV } from '../dev/knobs.js';

export const PILOT_BRAKE = 60;        // the pace brakes over this far before a stop point (world units)
export const PILOT_CRAWL = 0.08;      // … but never below this × normal pace until it's there (so it arrives)

// PilotIn: x the team's place (world x); stopX where it must stop (null: nowhere ahead); elites and chests: world x
// (an elite dead, a chest opened: no slow); hold: the stick's sideways push, -1 (all the way left) to 1 (all the way right);
// blocked: the way is blocked and no gun in play can clear it (stage 5b): the one case the team stops (0)
/** @typedef {{ x: number, stopX?: number | null, elites?: { x: number, alive?: boolean }[], chests?: { x: number, open?: boolean }[], hold?: number, blocked?: boolean }} PilotIn */

// the pace the team wants now (0: stopped)
/** @param {PilotIn} P @returns {number} */
export function pilotPace(P) {
  if (P.blocked) return 0;
  const base = DEV.autoLvlPace;
  let k = base;
  if (P.elites && P.elites.some(e => e.alive !== false && Math.abs(e.x - P.x) < DEV.autoLvlEliteR)) k *= DEV.autoLvlElite;
  if (P.chests && P.chests.some(c => !c.open && Math.abs(c.x - P.x) < DEV.autoLvlChestR)) k *= DEV.autoLvlChest;
  const hk = pilotPush(P.hold || 0);
  k *= hk;
  if (P.stopX != null) {
    const d = P.stopX - P.x;
    if (d <= 0) return 0;
    k = Math.min(k, base * Math.max(PILOT_CRAWL, Math.min(1, d / PILOT_BRAKE)) * hk);
  }
  return Math.max(0, k);
}

// the stick's push as a pace factor: 1 at rest, up to DEV.autoLvlHurry at full right, down to DEV.autoLvlSlow at full left
/** @param {number} h -1 to 1 */
export function pilotPush(h) {
  const c = Math.max(-1, Math.min(1, h));
  return c >= 0 ? 1 + (DEV.autoLvlHurry - 1) * c : 1 + (Math.max(0.01, DEV.autoLvlSlow) - 1) * -c;
}

// the pace eased toward the one it wants: at most DEV.autoLvlEase × normal pace a second either way; straight to 0
// when it wants to stop dead at a stop point (the level clamps it there too)
/** @param {number} cur @param {number} want @param {number} dt */
export function pilotEase(cur, want, dt) {
  const v = DEV.autoLvlEase * DEV.autoLvlPace * dt;
  return cur < want ? Math.min(want, cur + v) : Math.max(want, cur - v);
}
