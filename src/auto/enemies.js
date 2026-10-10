// @ts-check
// CaveRunner Auto's enemies in a level (AUTOBATTLER.md stage 6, part 1). The menu's creatures (art/titlescene.js
// addFoe: its zones' home rules) come scaled by the run's tier (S.tier: enemyFor(id, tier)). Here: they hurt the
// team (levelHurt: the scene's bites and spit, × DEV.autoFoeDmg, into the run's players' real hp); a fallen player
// flickers out and is gone till the hub; all fallen → L.failed (the screen takes the team home: run.js levelFailed).
// Elites (DEV.autoFoeElites a level, evenly along the random zones; eliteOf's look and numbers) come in as the team
// nears them, sit in L.elites (the pilot slows near an alive one) and are marked dead. The boss (a random kind of
// TITLE_KINDS, × DEV.autoBossSize / autoBossHp / autoBossDmg) comes in when the team reaches the arena; dead → L.bossDead.

import { PH, PW } from '../core/consts.js';
import { DEV } from '../dev/knobs.js';
import { eliteOf, enemyFor } from '../data/creatures.js';
import { deathFall } from './death.js';
import { TCELL, TITLE_HOME, TITLE_KINDS, TITLE_VW, titleFoeAt, titleZone } from '../art/titlescene.js';

export const FALL_FLICKER = 0.6;      // (retired, feedback round 2: a fallen player is a ragdoll now, auto/death.js)
const BOSS_IN = 90;                   // the boss comes in this far right of the team (world units)

// LevelFoe: a planned elite (L.elites: x its world x, the live one's while it lives), f the creature once it's in
/** @typedef {{ x: number, alive?: boolean, id?: string, u?: number, f?: Enemy | null }} LevelFoe */

// the elites' places: n evenly along the random zones (z0..z1), each a kind its zone's home rules would bring
/** @param {import('./level.js').LevelPlan} plan @param {() => number} rnd @param {number} [n] @returns {LevelFoe[]} */
export function elitePlan(plan, rnd, n = DEV.autoFoeElites) {
  /** @type {LevelFoe[]} */
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = plan.z0 + plan.len * (i + 1) / (n + 1);
    out.push({ x, alive: true, u: rnd(), f: null });
  }
  return out;
}

// a creature kind for world x by the zone's home rules (weighted)
/** @param {import('../art/titlescene.js').TitleScene} S @param {number} x */
function homeKind(S, x) {
  const home = TITLE_HOME[titleZone(x, S)] || TITLE_HOME.moss;
  let roll = S.rnd() * home.reduce((a, h) => a + h[1], 0);
  for (const [q, w] of home) { if (roll < w) return q; roll -= w; }
  return home[0][0];
}

// the boss's kind: enemyFor(id, tier), huge
/** @param {string} id @param {number} tier @returns {CreatureKind} */
export function bossKind(id, tier) {
  const k = enemyFor(id, tier);
  return Object.assign({}, k, { boss: true, r: k.r * DEV.autoBossSize, hp: Math.round(k.hp * DEV.autoBossHp),
    dmg: Math.max(1, Math.round(k.dmg * DEV.autoBossDmg)) });
}

// a creature hit player i for dmg (× DEV.autoFoeDmg): off his real hp (the run's), into the health meter; at 0 he falls
/** @param {import('../art/titlescene.js').TitleScene} S @param {number} i @param {number} dmg */
export function levelHurt(S, i, dmg) {
  const pl = S.team && S.team[i], r = S.runners[i];
  if (!pl || pl.alive === false || !r || r.out) return;
  pl.hp = Math.max(0, pl.hp - dmg * DEV.autoFoeDmg);
  if (pl.hp <= 0) levelFall(S, i);
}
// player i falls: out of the level till the hub (feedback round 2: the old game's ragdoll, auto/death.js deathFall)
/** @param {import('../art/titlescene.js').TitleScene} S @param {number} i */
export function levelFall(S, i) {
  const pl = S.team && S.team[i], r = S.runners[i];
  if (!r || r.out) return;
  if (pl) { pl.hp = 0; pl.alive = false; }
  r.out = true; r.outT = S.t; r.dig = 0; r.clr = null;
  if (r.keep) { r.kit = r.keep; r.keep = null; }
  deathFall(S, r);
  S.snd.push({ k: 'land', x: r.x + PW / 2, y: r.y + PH, a: 200 });
}
// is every player out?
/** @param {import('../art/titlescene.js').TitleScene} S */
export const allFallen = S => S.runners.length > 0 && S.runners.every(r => r.out);

// One step of the level's enemies (levelStep calls it): the elites in and marked, the boss (the fallen: auto/death.js)
/** @param {import('../art/titlescene.js').TitleScene} S @param {import('./level.js').LevelState} L @param {number} teamX the team's place (world x) */
export function levelFoes(S, L, teamX) {
  if (L.phase === 'arrive') return;
  const tier = S.tier || 1;
  // the elites: in as the scene's right edge reaches them (where the terrain is made), then tracked
  for (const e of L.elites) {
    if (e.alive === false) continue;
    if (!e.f) {
      if (e.x - S.scroll < TITLE_VW + 16 && e.x < S.gen * TCELL - 6) {
        const id = e.id || (e.id = homeKind(S, e.x));
        e.f = titleFoeAt(S, eliteOf(enemyFor(id, tier), e.u == null ? 0.5 : e.u), e.x);
      }
      continue;
    }
    if (e.f.hp <= 0 || !S.foes.includes(e.f)) { e.alive = false; continue; }
    e.x = e.f.x;
  }
  // the boss: in when the team reaches the arena, hunting at once
  if (L.phase === 'arena' && !L.boss && !L.bossDead) {
    const id = TITLE_KINDS[Math.floor(S.rnd() * TITLE_KINDS.length)];
    const f = titleFoeAt(S, bossKind(id, tier), Math.min(L.plan.arena.x1 - 30, teamX + BOSS_IN));
    f.aggro = true;
    L.boss = f;
  }
  const B = L.boss;
  if (B && !L.bossDead) {
    if (B.hp <= 0) L.bossDead = true;
    else if (!S.foes.includes(B)) { B.x = Math.min(L.plan.arena.x1 - 30, teamX + BOSS_IN); B.y = B.ty = S.vh / 2; S.foes.push(B); }   // fell out of the scene: back in
  }
}

// the boss's health bar (the screen's overlay): null when there's none
/** @param {import('../art/titlescene.js').TitleScene} S @returns {{ hp: number, max: number, name: string } | null} */
export function levelBoss(S) {
  const L = S.lvl && S.lvl.data;
  const B = L && L.boss;
  if (!B || L.bossDead) return null;
  return { hp: Math.max(0, B.hp), max: B.hpMax, name: B.k.name };
}
