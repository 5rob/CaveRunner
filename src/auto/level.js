// @ts-check
// CaveRunner Auto's level (AUTOBATTLER.md stage 4a): a FINITE Mossy Caves strip for the menu scene (art/titlescene.js
// opts.level). The plan (levelPlan): a flat start pad, then the menu's random zones (titleZoneAdd: the same order
// rules) for DEV.autoLvlMin minutes at normal pace, then the boss arena (a wide flat chamber), then the exit pad, then
// solid rock. The team teleports in on the start pad (the hub's charge, flash and lightning: auto/hub.js hubArriveT),
// then runs, flies and saws as on the menu while the cave scrolls under it at the pilot's pace (auto/pilot.js:
// S.pace). It stops in the arena until the boss is dead (stage 6; for now DEV.autoLvlBossT or L.bossDead), then
// heads to the exit pad, where the team gathers on the pad and stops (levelDone: stage 4b teleports it to the hub).
// The painter is game/render/leveldraw.js.

import { PH, PW } from '../core/consts.js';
import { DEV } from '../dev/knobs.js';
import { TITLE_VW, TITLE_ZLEN, titleFloor, titlePlan, titleScene, titleSurf, titleZoneAdd } from '../art/titlescene.js';
import { hubArriveT } from './hub.js';
import { pilotEase, pilotPace } from './pilot.js';

export const LVL_SCROLL = 34;         // the menu's scroll (world units / s at pace 1: titlescene.js SCROLL)
export const LVL_PADX = 60;           // the start pad's middle (world x; on screen at the start)
export const LVL_PAD = 160;           // the start pad's flat stretch ends here (world x)
export const LVL_ARENA = 320;         // the boss arena's width (world units)
export const LVL_EXITW = 160;         // the exit pad's flat stretch (the pad in its middle)
export const LVL_TEAM = 60;           // the team's place on screen (screen x): the level's progress is S.scroll + this
const LVL_GO = 0.4;                   // the team sets off this long after the last one came through (s)
const LVL_WALK = 40;                  // gathering on the exit pad: walk speed (world units / s)
const GRAV = 260;                     // (titlescene.js GRAV)

// a flat zone (a pad or the arena): the menu's moss, no hills, no rubble or ledges
/** @param {import('../art/titlescene.js').TitlePlan} P @param {number} x0 @param {number} x1 @param {number} co the roof's offset (- higher) @returns {import('../art/titlescene.js').TZone} */
function flatZone(P, x0, x1, co) {
  const z = { z: 'moss', x0, x1, i: P.z.length, ph: [0, 0, 0, 0, 0], ca: 0, fa: 0, cf: 1, ff: 1, co, fo: 2, dens: 0.4, flat: true };
  P.z.push(z);
  return z;
}

// LevelPlan: the zone plan (the scene's S.zp) and its landmarks (world x): the start pad's middle, where the random zones
// begin and end (len their total), the arena's span and middle, the exit pad's middle
/** @typedef {{ zp: import('../art/titlescene.js').TitlePlan, seed: number, padX: number, z0: number, z1: number, len: number,
 *   arena: { x0: number, x1: number, mid: number }, exitX: number }} LevelPlan */

// The finite plan: same seed, same level. minutes (default the knob) at normal pace (DEV.autoLvlPace) of random zones
/** @param {number} seed @param {number} [minutes] @returns {LevelPlan} */
export function levelPlan(seed, minutes = DEV.autoLvlMin) {
  const P = titlePlan(seed);
  flatZone(P, -300, LVL_PAD, 0);
  const want = Math.max(TITLE_ZLEN[0], minutes * 60 * LVL_SCROLL * DEV.autoLvlPace);
  let x = LVL_PAD;
  while (x - LVL_PAD < want) x = titleZoneAdd(P, x).x1;
  const a = flatZone(P, x, x + LVL_ARENA, -14);
  const e = flatZone(P, a.x1, a.x1 + LVL_EXITW, 0);
  flatZone(P, e.x1, 1e9, 400);   // solid rock: the roof far below the floor (it closes over ZMIX)
  return { zp: P, seed, padX: LVL_PADX, z0: LVL_PAD, z1: x, len: x - LVL_PAD,
    arena: { x0: a.x0, x1: a.x1, mid: (a.x0 + a.x1) / 2 }, exitX: (e.x0 + e.x1) / 2 };
}

// LevelState: the plan; phase: 'arrive' (teleporting in), 'run' (to the arena), 'arena' (stopped till the boss is dead),
// 'out' (to the exit pad), 'exit' (gathered on it); arrived per player, zap (when someone last came through), arenaT
// (when it got there), bossDead; hold (the stick's sideways push, -1 to 1), elites and chests (stage 6, 11: world x), pace (S.pace)
/** @typedef {{ plan: LevelPlan, phase: string, arrived: boolean[], zap: number, goT: number, arenaT: number, bossDead: boolean, hold: number,
 *   elites: { x: number, alive?: boolean }[], chests: { x: number, open?: boolean }[], doneT: number }} LevelState */
/** @param {import('../art/titlescene.js').TitleScene} S @returns {LevelState | null} */
export const levelState = S => (S.lvl && S.lvl.data) || null;
// the team's place in the level (world x)
/** @param {import('../art/titlescene.js').TitleScene} S */
export const levelTeamX = S => S.scroll + LVL_TEAM;

// The level's scene: titleScene with the finite plan, n players, the band (roof and floor) lower than the menu's
/** @param {number} vh @param {number} seed @param {number} n @param {LevelPlan} [plan] (default levelPlan(seed)) @returns {import('../art/titlescene.js').TitleScene} */
export function levelScene(vh, seed, n, plan = levelPlan(seed)) {
  /** @type {LevelState} */
  const L = { plan, phase: 'arrive', arrived: [], zap: -99, goT: -1, arenaT: -1, bossDead: false, hold: 0, elites: [], chests: [], doneT: -1 };
  const S = titleScene(vh, seed, vh * 0.24, vh * 0.92, { runners: n, level: { zp: plan.zp, step: levelStep, data: L } });
  S.pace = 0; S.still = true;
  S.foes.length = 0;
  const fy = titleFloor(plan.padX, S);
  S.runners.forEach((r, i) => {
    r.x = plan.padX - PW / 2 + (i - (S.runners.length - 1) / 2) * 7; r.y = fy - PH; r.vx = r.vy = 0;
    r.mode = 'run'; r.ground = true; r.hide = true; r.face = 1; r.ang = 0.2; r.flame = 0;
    L.arrived[i] = false;
  });
  return S;
}

// the pill stick's sideways push (-1 left … 1 right; 0 let go): auto/pilot.js pilotPush
/** @param {import('../art/titlescene.js').TitleScene} S @param {number} dir */
export function levelHold(S, dir) {
  const L = levelState(S);
  if (L) L.hold = Math.max(-1, Math.min(1, dir || 0));
}
// is the team gathered on the exit pad (stage 4b: teleport to the hub)?
/** @param {import('../art/titlescene.js').TitleScene} S */
export function levelDone(S) {
  const L = levelState(S);
  return !!L && L.phase === 'exit' && L.doneT >= 0;
}
// where the team stops next (world x): the arena's middle till the boss is dead, then the exit pad
/** @param {LevelState} L */
const stopAt = L => (L.phase === 'run' || L.phase === 'arrive' ? L.plan.arena.mid : L.plan.exitX);

// One step (titleStep calls it after its own)
/** @param {import('../art/titlescene.js').TitleScene} S @param {number} dt */
export function levelStep(S, dt) {
  const L = levelState(S);
  if (!L) return;
  const P = L.plan;
  if (L.phase === 'arrive') {
    const fy = titleFloor(P.padX, S);
    S.runners.forEach((r, i) => {
      if (!L.arrived[i] && S.t >= hubArriveT(i)) {
        L.arrived[i] = true; L.zap = S.t; r.hide = false;
        S.flash = Math.max(S.flash, 0.5);
        const cx = r.x + PW / 2;
        for (let k = 0; k < 18; k++) {
          const a = S.rnd() * Math.PI * 2, sp = 20 + S.rnd() * 60;
          S.parts.push({ x: cx, y: fy - PH / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: 0.5, max: 0.5, r: 1.2,
            col: k % 3 ? '#7cc8ff' : '#e6f6ff', kind: 'spark' });
        }
        S.snd.push({ k: 'arc', x: cx, y: fy - PH / 2 });
      }
    });
    if (L.arrived.every(a => a)) {
      if (L.goT < 0) L.goT = S.t;
      if (S.t - L.goT >= LVL_GO) { L.phase = 'run'; S.still = false; S.runners.forEach(r => { r.retarget = 0; r.modeT = 0.6 + r.id * 0.5; }); }
    }
    return;
  }
  // the scroll stops at the stop point
  const stop = stopAt(L);
  if (L.phase !== 'exit' && levelTeamX(S) > stop) S.scroll = stop - LVL_TEAM;
  if (L.phase === 'run' && levelTeamX(S) >= stop - 0.5) { L.phase = 'arena'; L.arenaT = S.t; }
  if (L.phase === 'arena' && (L.bossDead || S.t - L.arenaT >= DEV.autoLvlBossT)) { L.bossDead = true; L.phase = 'out'; }
  if (L.phase === 'out' && levelTeamX(S) >= stop - 0.5) { L.phase = 'exit'; S.still = true; }
  if (L.phase === 'exit') { S.pace = 0; gather(S, L, dt); return; }
  if (L.phase === 'arena') { S.pace = 0; return; }
  const want = pilotPace({ x: levelTeamX(S), stopX: stop, elites: L.elites, chests: L.chests, hold: L.hold });
  S.pace = pilotEase(S.pace || 0, want, dt);
}

// At the exit: the saws put away, everyone down on the floor and walking onto the pad, side by side
/** @param {import('../art/titlescene.js').TitleScene} S @param {LevelState} L @param {number} dt */
function gather(S, L, dt) {
  const n = S.runners.length, px = L.plan.exitX - S.scroll;
  let all = true;
  S.runners.forEach((r, i) => {
    if (r.dig) { r.dig = 0; if (r.keep) r.kit = r.keep; r.keep = null; }
    r.mode = 'run'; r.flame = 0;
    const tx = px - PW / 2 + (i - (n - 1) / 2) * 7, d = tx - r.x, mv = Math.sign(d) * Math.min(Math.abs(d), LVL_WALK * dt);
    r.x += mv;
    if (Math.abs(mv) > 1e-3) { r.face = Math.sign(mv); r.gait += Math.abs(mv) * 0.3; }
    r.stand = Math.abs(mv) <= 1e-3;
    const g = titleSurf(S, r.x + PW / 2, r.y + PH - 6, 1);
    if (r.y + PH < g - 0.5) { r.vy += GRAV * dt; r.y = Math.min(g - PH, r.y + r.vy * dt); r.ground = false; }
    else { r.y = g - PH; r.vy = 0; r.ground = true; }
    if (Math.abs(d) > 0.5 || !r.ground) all = false;
  });
  if (all && L.doneT < 0) L.doneT = S.t;
}

// the start pad's and the exit pad's floor (world y) and middles on screen, for the painter
/** @param {import('../art/titlescene.js').TitleScene} S */
export function levelPads(S) {
  const L = levelState(S);
  if (!L) return [];
  return [{ id: 'enter', x: L.plan.padX - S.scroll, fy: titleFloor(L.plan.padX, S) }, { id: 'exit', x: L.plan.exitX - S.scroll, fy: titleFloor(L.plan.exitX, S) }]
    .filter(p => p.x > -60 && p.x < TITLE_VW + 60);
}
