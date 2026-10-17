// Dev → Bats / Glow worms: the shared slice preview's model (ui/slicepreview.js draws it, pans it, goes full screen). A random
// slice (one screen) of a real Grem level at level 2 (Coal Seams) with the enemy under work on it, made by the game's own code
// (levelScene, titleStep): the view jumped there a screen at a time, the level's director off (no scroll), its own creatures
// and spawns as in the game. One auto player comes in off the left and makes his own way (the autopilot's goal: levelWaypoint)
// to a random height just past the right edge, moving, shooting and getting hurt as in the game; then, after DEV.slicePrevWait,
// a fresh run of the same slice (the scene made again: a new player, the enemies reset). Every run is a new scene, so nothing
// piles up over loops.

import { PH, PW } from '../core/consts.js';
import { DEV } from '../dev/knobs.js';
import { TITLE_VW, titleCeil, titleFloor, titleStep } from '../art/titlescene.js';
import { levelScene, levelState, levelWaypoint } from './level.js';
import { newRun } from './run.js';

/** @typedef {'bats' | 'glow'} SliceKind */
/** @typedef {import('../art/titlescene.js').TitleScene} SliceScn */
/** @typedef {{ kind: SliceKind, seed: number, n: number, t: number, dead: number, wait: number, runs: number, done: boolean }} SliceRun */
// (the slice: level seed, and n screens jumped from the start)

/** the enemy under work on the screen in view @param {SliceScn} S @param {SliceKind} kind */
export function sliceHas(S, kind) {
  const a = S.scroll + 20, b = S.scroll + TITLE_VW - 20;
  if (kind === 'bats') return !!S.bats && S.bats.spawners.some(p => p.x > a && p.x < b);
  return !!S.worms && S.worms.filter(w => w.r.x > a && w.r.x < b).length >= 2;
}
// where the camera starts: the height of the enemy in view (the worms' middle, under the bats' spawners), else the middle
/** @param {SliceScn} S @param {SliceKind} kind */
export function sliceFocus(S, kind) {
  const a = S.scroll + 20, b = S.scroll + TITLE_VW - 20;
  const ys = kind === 'bats' ? (S.bats ? S.bats.spawners.filter(p => p.x > a && p.x < b).map(p => p.y + 25) : []) : (S.worms || []).filter(w => w.r.x > a && w.r.x < b).map(w => w.r.y);
  return ys.length ? ys.reduce((p, q) => p + q, 0) / ys.length : S.vh / 2;
}
// a level scene for seed, jumped n screens on (a screen a step, the same every time: the same slice comes back)
/** @param {number} seed @param {number} n @param {number} vh @returns {SliceScn} */
function jumped(seed, n, vh) {
  const run = newRun(seed), S = levelScene(vh, seed, 1, undefined, run.players.slice(0, 1), 2, run, true);
  if (S.lvl) S.lvl.step = null;   // (the director off: no scroll, no arrival; the view stays on the slice)
  S.pace = 0; S.spawn = 1e9;
  for (let i = 0; i < n; i++) { S.scroll += TITLE_VW; titleStep(S, 1 / 60); }
  return S;
}
// a new random slice with the enemy on it: a level seed, then screens on past its start till one has it (skipping a few)
/** @param {SliceKind} kind @param {number} vh @param {() => number} [rnd] @returns {{ seed: number, n: number }} */
export function sliceFind(kind, vh, rnd = Math.random) {
  for (let k = 0; k < 6; k++) {
    const seed = 1 + Math.floor(rnd() * 1e6), run = newRun(seed), S = levelScene(vh, seed, 1, undefined, run.players.slice(0, 1), 2, run, true), L = levelState(S);
    if (S.lvl) S.lvl.step = null;
    S.pace = 0; S.spawn = 1e9;
    let skip = Math.floor(rnd() * 3);
    for (let n = 1; L && S.scroll + TITLE_VW * 2 < L.plan.arena.x0; n++) {
      S.scroll += TITLE_VW; titleStep(S, 1 / 60);
      if (n >= 2 && sliceHas(S, kind) && skip-- <= 0) return { seed, n };
    }
  }
  return { seed: 1, n: 3 };
}
// the slice's scene for a run: the player off the left at its floor, his goal a random height just past the right edge
/** @param {SliceRun} P @param {number} vh @param {() => number} [rnd] @returns {SliceScn} */
export function sliceScene(P, vh, rnd = Math.random) {
  const S = jumped(P.seed, P.n, vh), L = levelState(S), r = S.runners[0];
  if (L) L.phase = 'run';
  S.still = false; S.spawn = 0;
  const x0 = S.scroll + 2, f0 = titleFloor(x0, S);
  Object.assign(r, { x: -PW - 4, y: f0 - PH, vx: 0, vy: 0, hide: false, out: false, mode: 'fly', modeT: 0, ground: false });
  const gx = S.scroll + TITLE_VW + 12, c = titleCeil(gx, S), f = titleFloor(gx, S);
  levelWaypoint(S, r.id, gx, c + 12 + rnd() * Math.max(0, f - c - 24));
  P.t = 0; P.dead = 0; P.wait = 0; P.done = false; P.runs++;
  return S;
}
// a run's frame: done (true: make the next run) once he's at the right edge (a player is kept inside the screen), down for 2 s, or 30 s gone by, and then
// DEV.slicePrevWait more
/** @param {SliceRun} P @param {SliceScn} S @param {number} dt */
export function sliceStep(P, S, dt) {
  P.t += dt;
  const r = S.runners[0];
  if (!P.done) {
    if (!r || r.out) P.dead += dt;
    if (!r || P.dead > 2 || P.t > 30 || r.x >= TITLE_VW - PW - 14) { P.done = true; if (r) { r.hide = true; r.out = true; r.dig = 0; r.clr = null; } }   // out: no longer stepped, so he stops shooting in the wait (owner)
    return false;
  }
  return (P.wait += dt) >= DEV.slicePrevWait;
}
