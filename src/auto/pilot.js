// @ts-check
// CaveRunner Auto's pace control (AUTOBATTLER.md stage 4): how fast the level scrolls under the team, as a
// pace (× the menu's scroll, art/titlescene.js S.pace). Normal pace DEV.autoLvlPace; an elite alive and near slows
// it (× DEV.autoLvlElite), an unopened chest near slows it (× DEV.autoLvlChest); holding > hurries (× DEV.autoLvlHurry),
// holding < stops. A stop point ahead (the boss arena until the boss is dead, then the exit pad) brakes it to a
// stop there. Elites (stage 6) and chests (stage 11) don't exist yet: the inputs are plain lists, the tests use fakes.

import { DEV } from '../dev/knobs.js';

export const PILOT_BRAKE = 60;        // the pace brakes over this far before a stop point (world units)
export const PILOT_CRAWL = 0.08;      // … but never below this × normal pace until it's there (so it arrives)

// PilotIn: x the team's place (world x); stopX where it must stop (null: nowhere ahead); elites and chests: world x
// (an elite dead, a chest opened: no slow); hold: -1 holding <, 1 holding >, 0 neither
/** @typedef {{ x: number, stopX?: number | null, elites?: { x: number, alive?: boolean }[], chests?: { x: number, open?: boolean }[], hold?: number }} PilotIn */

// the pace the team wants now (0: stopped)
/** @param {PilotIn} P @returns {number} */
export function pilotPace(P) {
  if ((P.hold || 0) < 0) return 0;
  const base = DEV.autoLvlPace;
  let k = base;
  if (P.elites && P.elites.some(e => e.alive !== false && Math.abs(e.x - P.x) < DEV.autoLvlEliteR)) k *= DEV.autoLvlElite;
  if (P.chests && P.chests.some(c => !c.open && Math.abs(c.x - P.x) < DEV.autoLvlChestR)) k *= DEV.autoLvlChest;
  if ((P.hold || 0) > 0) k *= DEV.autoLvlHurry;
  if (P.stopX != null) {
    const d = P.stopX - P.x;
    if (d <= 0) return 0;
    k = Math.min(k, base * Math.max(PILOT_CRAWL, Math.min(1, d / PILOT_BRAKE)) * (P.hold && P.hold > 0 ? DEV.autoLvlHurry : 1));
  }
  return Math.max(0, k);
}

// the pace eased toward the one it wants: at most DEV.autoLvlEase × normal pace a second either way; straight to 0
// when it wants to stop dead at a stop point (the level clamps it there too)
/** @param {number} cur @param {number} want @param {number} dt */
export function pilotEase(cur, want, dt) {
  const v = DEV.autoLvlEase * DEV.autoLvlPace * dt;
  return cur < want ? Math.min(want, cur + v) : Math.max(want, cur - v);
}
