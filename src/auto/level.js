// @ts-check
// CaveRunner Auto's level (AUTOBATTLER.md stage 4a): a FINITE Mossy Caves strip for the menu scene (art/titlescene.js
// opts.level). The plan (levelPlan): a flat start pad, then the menu's random zones (titleZoneAdd: the same order
// rules) for DEV.autoLvlMin minutes at normal pace, then the boss arena (a wide flat chamber), then the exit pad, then
// solid rock. The team teleports in on the start pad (the hub's charge, flash and lightning: auto/hub.js hubArriveT),
// then runs, flies and saws as on the menu while the cave scrolls under it at the pilot's pace (auto/pilot.js:
// S.pace). It stops in the arena until the boss is dead (stage 6; for now DEV.autoLvlBossT or L.bossDead), then
// shows LEVEL CLEARED once the boss's loot is vacuumed (stage 7, phase 'cleared'), heads to the exit pad, where the team gathers on the pad and stops (levelDone: stage 4b teleports it to the hub).
// The painter is game/render/leveldraw.js.

import { PH, PW } from '../core/consts.js';
import { DEV } from '../dev/knobs.js';
import { TITLE_BACK, TITLE_VW, TITLE_ZLEN, TITLE_ZONES, ctlOn, titleClearWebs, titleRng, titleFloor, titlePlan, titleScene, titleSurf, titleZoneAdd } from '../art/titlescene.js';
import { PAD_HALF, padNext } from './hub.js';
import { meterAdd, meterNew, meterSet, meterStep } from './meters.js';
import { lvlPace, pilotEase, pilotPace } from './pilot.js';
import { clearPower, teamClearer } from './clear.js';
import { blockCell, blockCol, blockKind, planBlocks, rollBlock, webSlow } from './blocked.js';
import { deathPrompt, deathRags, deathStep, deathTeleport, exitNuke } from './death.js';
import { autoFoe, elitePlan, levelFoes, levelHurt } from './enemies.js';
import { bagFits, killLoot, lootCol } from './loot.js';
import { bagAdd, playerStats } from './run.js';
import { chestPlan, chestsStep } from './chests.js';
import { CLEARED_N, clearedLand } from '../art/cleared.js';

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
 *   arena: { x0: number, x1: number, mid: number }, exitX: number, wallX: number }} LevelPlan */

// The finite plan: same seed, same level. minutes (default the knob) at normal pace (DEV.autoLvlPace) of random zones;
// blocks of them blocked (stage 6b, auto/blocked.js planBlocks; default DEV.autoBlockN; 0: none)
// endless (Grem Mode, auto/grem.js): no sure wall (nothing blocks: the team digs as the title's runners do), and nothing
// after the arena (no exit pad, no solid rock): the plan grows on with random zones (titlescene.js zoneIn), and levelOnward
// adds the next stretch and arena when the boss is down
/** @param {number} seed @param {number} [minutes] @param {number} [blocks] @param {number} [pace] normal pace (a level: lvlPace(tier)) @param {boolean} [endless] @returns {LevelPlan} */
export function levelPlan(seed, minutes = DEV.autoLvlMin, blocks = DEV.autoBlockN, pace = DEV.autoLvlPace, endless = false) {
  const P = titlePlan(seed, TITLE_ZONES);   // (a level: every zone kind, the spider zone too)
  flatZone(P, -300, LVL_PAD, 0);
  const want = Math.max(TITLE_ZLEN[0], minutes * 60 * LVL_SCROLL * pace);
  let x = LVL_PAD;
  const zs = [];
  while (x - LVL_PAD < want) { const z = titleZoneAdd(P, x); zs.push(z.i); x = z.x1; }
  planBlocks(P, zs, seed, blocks);
  const wallX = endless ? Infinity : plantWall(P, zs, seed, pace);
  const a = flatZone(P, x, x + LVL_ARENA, -14);
  if (endless) return { zp: P, seed, padX: LVL_PADX, z0: LVL_PAD, z1: x, len: x - LVL_PAD, arena: { x0: a.x0, x1: a.x1, mid: (a.x0 + a.x1) / 2 }, exitX: a.x1 + LVL_EXITW / 2, wallX };
  const e = flatZone(P, a.x1, a.x1 + LVL_EXITW, 0);
  flatZone(P, e.x1, 1e9, 400);   // solid rock: the roof far below the floor (it closes over ZMIX)
  return { zp: P, seed, padX: LVL_PADX, z0: LVL_PAD, z1: x, len: x - LVL_PAD,
    arena: { x0: a.x0, x1: a.x1, mid: (a.x0 + a.x1) / 2 }, exitX: (e.x0 + e.x1) / 2, wallX };
}

// The level's first wall (owner, feedback round 1: none in the first 20 s, and not always at 20). One of the level's
// own blocked zones (stage 6b, planBlocks) is made sure of: the first random zone the team reaches past its own random
// time, DEV.autoWallMin to autoWallMax seconds at full hurry (normal pace takes autoLvlHurry × longer; from the seed),
// gets a blockage rolled as any is (rollBlock: a variant that suits it, its size and place in the zone) but blocked all
// the way (severity 1). Before it nothing blocks: the team digs through rock and webs as the title's runners do (levelFree)
/** @param {number} seed @returns {number} the wall's seconds at full hurry */
export function levelWallT(seed) {
  const u = Math.abs(Math.sin(seed * 91.37 + 4.1) * 43758.5453) % 1;
  return DEV.autoWallMin + u * Math.max(0, DEV.autoWallMax - DEV.autoWallMin);
}
const WALL_FREE = 40;                  // levelFree ends this far before the wall (the team's middle to its face)
/** @param {import('../art/titlescene.js').TitlePlan} P @param {number[]} zs @param {number} seed @param {number} pace @returns {number} the wall's x (Infinity: none in the level; -Infinity: knobs at 0) */
function plantWall(P, zs, seed, pace) {
  if (DEV.autoWallMax <= 0) return -Infinity;   // knobs at 0: no sure wall and no free stretch (the rock blocks from the start)
  const x = LVL_PAD + levelWallT(seed) * LVL_SCROLL * pace * DEV.autoLvlHurry;
  const i = zs.find(j => P.z[j].x0 >= x);
  if (i == null) return Infinity;
  const Z = P.z[i];
  Z.blk = rollBlock(titleRng((seed * 7919 + 13) >>> 0), Z);
  Object.assign(Z.blk, { sev: 1, full: true });
  return Z.blk.x0;
}
// The level's creatures (owner, feedback round 1: too many; start with a trickle): a new one every DEV.autoFoeGap0 s with at
// most autoFoeCap0 alive at the start, easing to autoFoeGap1 s and autoFoeCap1 by the arena (the level's progress). None once
// the scene's right edge (where they come in, a swarm trailing SPAWN_TAIL) nears the arena (owner v1.0.55: one spawned past
// the boss wiped a team waiting at the exit)
const SPAWN_TAIL = 100;
/** @param {import('../art/titlescene.js').TitleScene} S @param {LevelState} L @returns {{ gap: number, cap: number }} */
export function levelSpawn(S, L) {
  if (S.scroll + TITLE_VW + 16 + SPAWN_TAIL >= L.plan.arena.x0) return { gap: 1, cap: 0 };
  const p = Math.max(0, Math.min(1, (levelTeamX(S) - L.plan.z0) / Math.max(1, L.plan.len)));
  return { gap: DEV.autoFoeGap0 + (DEV.autoFoeGap1 - DEV.autoFoeGap0) * p, cap: Math.round(DEV.autoFoeCap0 + (DEV.autoFoeCap1 - DEV.autoFoeCap0) * p) };
}

// (owner, v1.0.54: blasts dug out the ground under the exit pad) where blasts stop biting at world x (titlescene.js deepK):
// DEV.autoHardEdge over the bottom edge, rising to the exit pad's floor over its flat stretch, sloping down HARD_RAMP either side
const HARD_RAMP = 50;
/** @param {import('../art/titlescene.js').TitleScene} S @param {LevelPlan} P @param {number} wx */
export function levelHardY(S, P, wx) {
  const low = S.vh - DEV.autoHardEdge, e0 = P.arena.x1, e1 = e0 + LVL_EXITW;
  const d = wx < e0 ? e0 - wx : wx > e1 ? wx - e1 : 0, t = Math.max(0, 1 - d / HARD_RAMP);
  return t > 0 ? low + (Math.min(low, titleFloor(P.exitX, S)) - low) * t : low;
}

// nothing blocks yet: arriving, or the team still short of the level's wall; with r, that runner's own front (he flies
// ahead of the team: he mustn't start a free dig into the wall)
/** @param {import('../art/titlescene.js').TitleScene} S @param {LevelState} L @param {import('../art/titlescene.js').TRunner} [r] */
export function levelFree(S, L, r) {
  if (L.phase === 'arrive') return true;
  return levelTeamX(S) < L.plan.wallX - WALL_FREE && (!r || r.x + PW + S.scroll + 6 < L.plan.wallX);
}

// LevelState: the plan; phase: 'arrive' (teleporting in), 'run' (to the arena), 'arena' (stopped till the boss is dead),
// 'cleared' (stage 7: still stopped; lootT when the boss died, clearT when LEVEL CLEARED began (-1: waiting for its loot), 'out' (to the exit pad), 'exit' (gathered on it); arrived per player, zap (when someone last came through), arenaT
// (when it got there), bossDead; hold (the stick's sideways push, -1 to 1), elites and chests (stage 6, 11: world x), pace (S.pace);
// blocked (stage 5b): rock in the way and no gun in play can clear it (the pilot stops the team; the screen's "Path blocked");
// boss (stage 6: the arena's boss once it's in), failed (every player fallen: the screen takes the team home);
// run (stage 6 part 2: the drops go into its bag; none: they're just taken), bagV (+1 each time something goes in: the screen redraws the bag)
// (grem: Grem Mode, auto/grem.js: endless, gold the only drop; ups: how many bosses it's past)
/** @typedef {{ plan: LevelPlan, phase: string, grem?: boolean, ups?: number, arrived: boolean[], zap: number, goT: number, arenaT: number, bossDead: boolean, hold: number,
 *   elites: import('./enemies.js').LevelFoe[], chests: import('./chests.js').LevelChest[], doneT: number, meters: PlayerMeters[], blocked: boolean,
 *   boss: Enemy | null, failed: boolean, run?: AutoRun | null, bagV: number, blockKind?: string, webK?: number, webT?: number, lootT?: number, clearT?: number, popT?: number[], nukeT?: number, gatherT?: number, padGone?: boolean,
 *   deadT?: number, pace0?: number, base?: number, lastI?: number, tpT?: number, boomed?: boolean, far?: number }} LevelState */
// (far: the furthest the scroll got, world units: manual mode roams back at most DEV.autoRoamBack screens behind it)
// (blockKind: what the block is, rock / web / timber (stage 6b); webK: the team's pace through webs (1 free, auto/blocked.js webSlow); webT: the next cut)
/** @param {import('../art/titlescene.js').TitleScene} S @returns {LevelState | null} */
export const levelState = S => (S.lvl && S.lvl.data) || null;
// the team's place in the level (world x)
/** @param {import('../art/titlescene.js').TitleScene} S */
export const levelTeamX = S => S.scroll + LVL_TEAM;

// The level's scene: titleScene with the finite plan, n players, the band (roof and floor) lower than the menu's
// team: the run's players (stage 5a): each fires its active gun for real (art/scenegun.js), and its damage dealt and
// health go into L.meters (auto/meters.js, for the stats meters). tier: the run's (stage 6: the creatures' strength, enemyFor),
// and the creatures hurt the team (auto/enemies.js). run (stage 6 part 2): kills drop loot (auto/loot.js) that is vacuumed into its bag
// (tall levels) the action band: the old 0.24..0.92 of vh at vh 190 or less; taller, it keeps the old rock over and
// under it (at most 50 and 20) and the rest is the band, so the cave fills the screen's height
// grem (Grem Mode, auto/grem.js): an endless plan (levelPlan's endless, no blocked zones) and gold the only drop (kills and chests)
/** @param {number} vh @param {number} seed @param {number} n @param {LevelPlan} [plan] (default levelPlan(seed)) @param {RunPlayer[]} [team] @param {number} [tier] @param {AutoRun | null} [run] @param {boolean} [grem] @returns {import('../art/titlescene.js').TitleScene} */
export function levelScene(vh, seed, n, plan, team, tier = 1, run = null, grem = false) {
  const base = lvlPace(tier);   // (owner, after v1.0.74) normal pace by level
  if (!plan) plan = levelPlan(seed, undefined, grem ? 0 : undefined, base, grem);
  /** @type {LevelState} */
  const L = { plan, base, phase: 'arrive', arrived: [], zap: -99, goT: -1, arenaT: -1, bossDead: false, hold: 0, elites: [], chests: [], doneT: -1, meters: [], blocked: false,
    boss: null, failed: false, run, bagV: 0, grem, ups: 0 };
  const S = titleScene(vh, seed, Math.min(vh * 0.24, 50), vh - Math.min(vh * 0.08, 20), { runners: n, level: { zp: plan.zp, step: levelStep, data: L, hurt: levelHurt,
    loot: (S, f) => killLoot(f.k.boss ? 'boss' : f.k.elite ? 'elite' : 'foe', S.tier || 1, S.rnd, f.k.gold).filter(it => !L.grem || it.kind === 'gold'),
    fits: (_S, it) => !L.run || bagFits(L.run, it),
    take: (_S, it) => { if (L.run && bagAdd(L.run, it)) return false; L.bagV++; return true; },
    kind: autoFoe, hardY: (S, wx) => levelHardY(S, plan, wx), lootCol, blockCell, blockCol, blockKind, free: (S, r) => levelFree(S, L, r), fuel: (_S, r) => (team && team[r.id] ? playerStats(team[r.id]) : null), spawn: S => levelSpawn(S, L) }, team, tier });
  L.elites = elitePlan(plan, S.rnd);
  L.chests = chestPlan(plan);
  L.meters = S.runners.map(() => ({ dmg: meterNew(), hp: meterNew(), dealt: 0 }));
  S.pace = 0; S.still = true;
  S.foes.length = 0;
  const fy = titleFloor(plan.padX, S);
  S.runners.forEach((r, i) => {
    r.x = plan.padX - PW / 2; r.y = fy - PH; r.vx = r.vy = 0;   // (owner v1.0.74) all on the pad, one at a time
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
// (feedback round 2) the selected player (id; -1 none) is steered by hand: the pill stick's push (st; null: the stick at
// rest) goes to him (titlescene.js ctlStep: he walks and jets, his gun aims and fires by itself); everyone else is back on
// the autopilot (let go in the air, he comes in to land). A fallen player isn't steered
/** @param {import('../art/titlescene.js').TitleScene} S @param {number} id @param {import('../art/titlescene.js').RunnerCtl | null} st */
export function levelControl(S, id, st) {
  for (const r of S.runners) {
    if (r.id === id && !r.out) { r.ctl = st ? { active: st.active, nx: st.nx, ny: st.ny, mag: st.mag } : r.ctl || LEVEL_CTL_REST; continue; }
    if (!r.ctl) continue;
    r.ctl = null; r.cvx = 0; r.retarget = 0; r.ctlIdle = undefined;
    if (!r.ground) { r.mode = 'fly'; r.modeT = 0; }
  }
}
/** @type {import('../art/titlescene.js').RunnerCtl} */
const LEVEL_CTL_REST = { active: false, nx: 0, ny: 0, mag: 0 };
// has every player fallen (stage 6: home to the hub, the tier unchanged: run.js levelFailed)?
/** @param {import('../art/titlescene.js').TitleScene} S */
export function levelLost(S) {
  const L = levelState(S);
  return !!L && L.failed;
}
// (feedback round 2) everyone down and the scroll stopped: "Tap A to Teleport back to Hub" shows (leveldraw.js)
/** @param {import('../art/titlescene.js').TitleScene} S */
export function levelDeathPrompt(S) {
  const L = levelState(S);
  return !!L && deathPrompt(S, L);
}
// A pressed with that prompt up: the helmet light blinks, the blast, then levelLost (home). true: it took the press
/** @param {import('../art/titlescene.js').TitleScene} S */
export function levelTeleportHome(S) {
  const L = levelState(S);
  return !!L && deathTeleport(S, L);
}
// is the team gathered on the exit pad (stage 4b: teleport to the hub)?
/** @param {import('../art/titlescene.js').TitleScene} S */
export function levelDone(S) {
  const L = levelState(S);
  return !!L && L.phase === 'exit' && L.doneT >= 0;
}
// each player's damage dealt this tick (the scene's r.dealt, added up since the last) and health, into its meters
/** @param {import('../art/titlescene.js').TitleScene} S @param {LevelState} L @param {number} dt */
export function levelMeters(S, L, dt) {
  S.runners.forEach((r, i) => {
    const M = L.meters[i];
    if (!M) return;
    meterStep(M.dmg, dt); meterStep(M.hp, dt, true);
    meterAdd(M.dmg, (r.dealt || 0) - M.dealt); M.dealt = r.dealt || 0;
    const pl = S.team && S.team[i];
    if (pl) meterSet(M.hp, pl.alive === false ? 0 : pl.hp);
  });
}
// where the team stops next (world x): the arena's middle till the boss is dead, then the exit pad
/** @param {LevelState} L */
const stopAt = L => (L.phase === 'run' || L.phase === 'arrive' ? L.plan.arena.mid : L.plan.exitX);

// One step (titleStep calls it after its own)
/** @param {import('../art/titlescene.js').TitleScene} S @param {number} dt */
export function levelStep(S, dt) {
  const L = levelState(S);
  if (!L) return;
  levelMeters(S, L, dt);
  levelFoes(S, L, levelTeamX(S));
  clearedWords(S, L, dt);
  if (L.phase === 'exit') { deathRags(S, dt); exitStep(S, L, dt); return; }   // (owner v1.0.74) the pops at the exit: not a death
  if (deathStep(S, L, dt)) return;  // everyone down (auto/death.js): the slow stop, Tap A, the blast, home
  chestsStep(S);
  const P = L.plan;
  if (L.phase === 'arrive') {
    const fy = titleFloor(P.padX, S);
    S.runners.forEach((r, i) => {
      if (padNext(S, L.arrived, i, P.padX, S.scroll)) {
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
    stepOff(S, L, dt);
    if (L.arrived.every(a => a)) {
      if (L.goT < 0) L.goT = S.t;
      if (S.t - L.goT >= LVL_GO) { L.phase = 'run'; S.still = false; S.runners.forEach(r => { r.retarget = 0; r.modeT = 0.6 + r.id * 0.5; }); }
    }
    return;
  }
  // the scroll stops at the stop point (and, roaming back, at the furthest back manual mode may go)
  const stop = stopAt(L);
  if (L.phase !== 'exit' && levelTeamX(S) > stop) S.scroll = stop - LVL_TEAM;
  L.far = Math.max(L.far ?? S.scroll, S.scroll);
  if (S.scroll < roamMin(L)) S.scroll = roamMin(L);
  if (L.phase === 'run' && levelTeamX(S) >= stop - 0.5) { L.phase = 'arena'; L.arenaT = S.t; }
  if (L.phase === 'arena' && (L.bossDead || S.t - L.arenaT >= DEV.autoLvlBossT)) { L.bossDead = true; L.phase = 'cleared'; L.lootT = S.t; L.clearT = -1; }   // (the timeout: a fallback, a boss out of reach)
  S.huddle = L.phase === 'cleared' || L.phase === 'out' || L.phase === 'exit';   // the team keeps together after the boss (titlescene.js's pack pick)
  S.gunsOff = L.bossDead;   // (owner v1.0.74) the boss dead: guns down
  if (L.phase === 'cleared') { S.pace = 0; cleared(S, L); return; }
  if (L.phase === 'out' && levelTeamX(S) >= stop - 0.5) { L.phase = 'exit'; S.still = true; return; }
  if (L.phase === 'arena') { S.pace = 0; return; }
  // blocked (the scene's startDig found no gun in play to clear the rock): stays till one can (a gun fitted)
  if (S.blocked != null) { L.blocked = true; L.blockKind = S.blockedKind || 'rock'; S.blocked = undefined; }
  // webs (stage 6b): they slow the team; tangled enough, it halts till a gun that clears webs burns or cuts them, else blocked
  const ws = webSlow(S);
  L.webK = ws.halt ? 0 : ws.k;
  if (ws.halt && ws.i >= 0) {
    const cl = S.team ? teamClearer(S.team, 'web', ws.i) : null;
    if (cl || !S.team || levelFree(S, L)) {
      if ((L.webT = (L.webT || 0) - dt) <= 0) {
        const gun = cl && S.team ? S.team[cl.p].guns[cl.g] : null, fire = !!gun && gun.slots.some(id => !!id && clearPower(id).fire > 0);
        L.webT = 0.15; titleClearWebs(S, S.runners[ws.i], fire, 12);
      }
    } else if (!cl) { L.blocked = true; L.blockKind = 'web'; }
  }
  if (L.blocked && S.team && (teamClearer(S.team, L.blockKind || 'rock', 0) || levelFree(S, L))) L.blocked = false;
  // (feedback round 2) manual mode: a player steered by hand (a helmet held): the view follows him, not the pilot
  const lead = levelLead(S);
  if (lead && (L.phase === 'run' || L.phase === 'out')) { roamStep(S, L, lead); return; }
  const want = L.webK * pilotPace({ base: L.base, x: levelTeamX(S), stopX: stop, elites: L.elites, chests: L.chests, hold: L.hold, blocked: L.blocked || (S.fuelWait != null && S.t - S.fuelWait < 0.3) });   // (a player waiting at a wall to refill: auto/fuel.js)
  S.pace = pilotEase(S.pace || 0, want, dt, L.base);
}

// MANUAL MODE (owner, feedback round 2): a helmet held in a level (ui/auto/AutoScreen.js holdHelm) steers that player by hand
// (levelControl). The level's own scroll stops; the view follows him instead, forward or back: the scroll moves at
// DEV.autoRoamCam × his offset from the screen's middle (roamPace: slower the nearer he is, a damped follow), never further
// back than roamMin. The others follow him (roamFollow). B lets him go: the pilot's pace again (it eases back up)
// the steered player (none: null)
/** @param {import('../art/titlescene.js').TitleScene} S */
// (bug round 2, semi-automatic) only while the stick is pushed: let go, the level's own pace again (eased) and he plays by himself
export const levelLead = S => S.runners.find(r => ctlOn(r) && !r.out) || null;
// the picked player (manual mode; the nav's crosshair), steered or not (none: null)
/** @param {import('../art/titlescene.js').TitleScene} S */
export const levelPicked = S => S.runners.find(r => !!r.ctl && !r.out) || null;
// the scroll's pace (× LVL_SCROLL; negative: back) for a steered player off the middle by off (screen units, + right)
/** @param {number} off */
export const roamPace = off => DEV.autoRoamCam * off / LVL_SCROLL;
// the furthest back the scroll may go (world units): DEV.autoRoamBack screens behind the furthest point, at most what the
// scene keeps behind its left edge (titlescene.js TITLE_BACK, less a margin)
/** @param {LevelState} L */
export const roamMin = L => (L.far ?? 0) - Math.min(DEV.autoRoamBack * TITLE_VW, TITLE_BACK - 50);
/** @param {import('../art/titlescene.js').TitleScene} S @param {LevelState} L @param {import('../art/titlescene.js').TRunner} lead */
function roamStep(S, L, lead) {
  S.pace = roamPace(lead.x + PW / 2 - TITLE_VW / 2);
  if (S.scroll <= roamMin(L) + 0.01 && S.pace < 0) S.pace = 0;
  roamFollow(S, lead);
}
// the others line up behind him (on the autopilot still: they run, fly and saw as ever; only where they head is his)
/** @param {import('../art/titlescene.js').TitleScene} S @param {import('../art/titlescene.js').TRunner} lead */
export function roamFollow(S, lead) {
  // (bug round 2) behind him by the way he's going (not where his gun has him facing), else by his facing
  let k = 0;
  const dir = Math.abs(lead.cvx || 0) > 5 ? Math.sign(lead.cvx || 0) : (lead.face || 1);
  for (const r of S.runners) {
    if (r === lead || r.out || r.dig) continue;
    r.tx = Math.max(8, Math.min(TITLE_VW * 0.62, lead.x - dir * (14 + 12 * k++)));
    if (r.mode === 'run') r.spd = 1;
    r.retarget = Math.max(r.retarget, 0.3);
  }
}

// LEVEL CLEARED (stage 7): the boss's loot vacuumed (S.loot and S.coins empty; at most DEV.autoClearWait s, as a full bag
// leaves loot lying), then the words (art/cleared.js) for DEV.autoClearT s, a thud at each letter's landing; then on to the exit
// (owner v1.0.74: "once the loot is collected, head straight to the exit") the words show as the team sets off
/** @param {import('../art/titlescene.js').TitleScene} S @param {LevelState} L */
function cleared(S, L) {
  const left = (S.loot ? S.loot.filter(g => !g.left).length : 0) + S.coins.length;
  if (left === 0 || S.t - (L.lootT ?? S.t) >= DEV.autoClearWait) { L.clearT = S.t; L.phase = 'out'; S.runners.forEach(r => { r.retarget = 0; }); if (L.grem) levelOnward(S, L); }
}

// (Grem Mode) on past the arena instead of to an exit: the level + 1 (S.tier, the run's), the next stretch of random zones
// (DEV.autoLvlMin minutes at the new level's pace, from where the plan has grown to) and a new arena after it, its elites and
// chests; the living healed; the team runs on (LEVEL CLEARED shows as it goes)
/** @param {import('../art/titlescene.js').TitleScene} S @param {LevelState} L */
export function levelOnward(S, L) {
  const P = L.plan, zp = P.zp, tier = (S.tier || 1) + 1;
  S.tier = tier;
  if (L.run) L.run.tier = tier;
  L.ups = (L.ups || 0) + 1;
  L.base = lvlPace(tier);
  const z0 = P.arena.x1, want = Math.max(TITLE_ZLEN[0], DEV.autoLvlMin * 60 * LVL_SCROLL * L.base);
  let x = Math.max(z0, zp.z[zp.z.length - 1].x1);
  while (x - z0 < want) x = titleZoneAdd(zp, x).x1;
  const a = flatZone(zp, x, x + LVL_ARENA, -14);
  Object.assign(P, { z0, z1: x, len: x - z0, arena: { x0: a.x0, x1: a.x1, mid: (a.x0 + a.x1) / 2 }, exitX: a.x1 + LVL_EXITW / 2, seed: P.seed + 1 });
  L.elites = elitePlan(P, S.rnd);
  L.chests = chestPlan(P);
  L.phase = 'run'; L.bossDead = false; L.boss = null; L.arenaT = -1;
  S.gunsOff = false; S.huddle = false;
  if (S.team) for (const pl of S.team) if (pl.alive !== false) pl.hp = playerStats(pl).maxHp;
}
// the words' thuds, a frame
/** @param {import('../art/titlescene.js').TitleScene} S @param {LevelState} L @param {number} dt */
function clearedWords(S, L, dt) {
  if ((L.clearT ?? -1) < 0) return;
  const a = S.t - (L.clearT ?? S.t), a0 = a - dt, cx = levelTeamX(S), cy = S.top + 30;
  if (a0 >= DEV.autoClearT) return;
  for (let i = 0; i < CLEARED_N; i++) { const lt = clearedLand(i); if (a0 < lt && a >= lt) S.snd.push({ k: 'land', x: cx, y: cy, a: 160 }); }
}
// LEVEL CLEARED's age (s) while it shows, else -1 (the painter: ui/auto/AutoScreen.js)
/** @param {import('../art/titlescene.js').TitleScene} S */
export function levelClearedAge(S) {
  const L = levelState(S);
  if (!L || (L.clearT ?? -1) < 0) return -1;
  const a = S.t - (L.clearT ?? 0);
  return a < DEV.autoClearT ? a : -1;
}

// (owner v1.0.74; after v1.0.78 one nuke, not each head popping) at the exit, instead of a teleport: everyone gathered on
// the pad, the nuke under it (auto/death.js exitNuke; nobody hurt), the bodies thrown as ragdolls; DEV.autoExitNukeWait s later, home
/** @param {import('../art/titlescene.js').TitleScene} S @param {LevelState} L @param {number} dt */
function exitStep(S, L, dt) {
  S.pace = 0;
  gather(S, L, dt);
  // (owner, after v1.0.78) all on the pad: a moment, then one big nuke under it (death.js exitNuke) throws them all off,
  // and the hub DEV.autoExitNukeWait s later
  if (L.nukeT == null) {
    // (on the pad: standing on its floor, not on a ledge over it; after 6 s it goes off anyway: someone stuck up there)
    const pf = titleFloor(L.plan.exitX, S);
    if (L.gatherT == null) L.gatherT = S.t;
    if (S.runners.every(r => r.out || (r.stand && r.ground && Math.abs(r.y + PH - pf) < 6)) || S.t - L.gatherT > 6) L.nukeT = S.t + 0.5;
    return;
  }
  if (!L.padGone && S.t >= L.nukeT) { L.padGone = true; exitNuke(S, L.plan.exitX, titleFloor(L.plan.exitX, S)); }
  if (L.doneT < 0 && L.padGone && S.t >= L.nukeT + DEV.autoExitNukeWait) L.doneT = S.t;
}

// (owner v1.0.74) through the start pad, each walks off it to the right (a line, the first furthest) to clear it for the next
/** @param {import('../art/titlescene.js').TitleScene} S @param {LevelState} L @param {number} dt */
function stepOff(S, L, dt) {
  const px = L.plan.padX - S.scroll;
  if (S.runners.length < 2) return;   // (alone: he waits on the pad as ever)
  S.runners.forEach((r, i) => {
    if (!L.arrived[i] || r.out) return;
    const tx = px + PAD_HALF + 4 + (S.runners.length - 1 - i) * 9 - PW / 2, d = tx - r.x, mv = Math.sign(d) * Math.min(Math.abs(d), LVL_WALK * dt);
    r.x += mv;
    if (Math.abs(mv) > 1e-3) { r.face = 1; r.gait += Math.abs(mv) * 0.3; }
    r.stand = Math.abs(mv) <= 1e-3;
    r.y = titleFloor(S.scroll + r.x + PW / 2, S) - PH;   // (the level's floor, as the pad's)
  });
}

// At the exit: the saws put away, everyone down on the floor and walking onto the pad, side by side
/** @param {import('../art/titlescene.js').TitleScene} S @param {LevelState} L @param {number} dt */
function gather(S, L, dt) {
  const n = S.runners.length, px = L.plan.exitX - S.scroll;
  S.runners.forEach((r, i) => {
    if (r.out) return;
    if (r.dig) { r.dig = 0; if (r.keep) r.kit = r.keep; r.keep = null; }
    r.mode = 'run'; r.flame = 0;
    const tx = px - PW / 2 + (i - (n - 1) / 2) * 7, d = tx - r.x, mv = Math.sign(d) * Math.min(Math.abs(d), LVL_WALK * dt);
    r.x += mv;
    if (Math.abs(mv) > 1e-3) { r.face = Math.sign(mv); r.gait += Math.abs(mv) * 0.3; }
    const g = titleSurf(S, r.x + PW / 2, r.y + PH - 6, 1);
    if (r.y + PH < g - 0.5) { r.vy += GRAV * dt; r.y = Math.min(g - PH, r.y + r.vy * dt); r.ground = false; }
    else { r.y = g - PH; r.vy = 0; r.ground = true; }
    r.stand = Math.abs(mv) <= 1e-3 && Math.abs(d) <= 0.5;
  });
}

// the start pad's and the exit pad's floor (world y) and middles on screen, for the painter
/** @param {import('../art/titlescene.js').TitleScene} S */
export function levelPads(S) {
  const L = levelState(S);
  if (!L) return [];
  return [{ id: 'enter', x: L.plan.padX - S.scroll, fy: titleFloor(L.plan.padX, S) }, { id: 'exit', x: L.plan.exitX - S.scroll, fy: titleFloor(L.plan.exitX, S) }]
    .filter(p => p.x > -60 && p.x < TITLE_VW + 60 && !(p.id === 'exit' && (L.padGone || L.grem)));   // (Grem Mode: no exit pad)   // (the exit pad: gone in the end's nuke)
}
