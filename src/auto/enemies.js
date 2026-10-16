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
import { shieldSoak } from './perks.js';
import { gremHardTier } from './grem.js';
import { TCELL, TITLE_KINDS, TITLE_VW, titleFoeAt, titleKind } from '../art/titlescene.js';

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


// (owner, v1.0.53: a level 10 team one-shot the boss for six levels; the old game's +35% health a floor is too gentle for
// Auto's growing guns) a creature at the run's tier: the old game's kind at tier 1, its health × DEV.autoTierHp and its
// bite × autoTierDmg for each level past 1 (compounding); gold as the old game's tier. Pure
/** @param {string} id @param {number} tier @returns {CreatureKind} */
export function autoFoe(id, tier) {
  const k = enemyFor(id, tier), b = enemyFor(id, 1), n = Math.max(0, tier - 1);
  return Object.assign(k, { hp: Math.max(1, Math.round(b.hp * Math.pow(DEV.autoTierHp, n))), dmg: Math.max(1, Math.round(b.dmg * Math.pow(DEV.autoTierDmg, n))) });
}
// (Grem Mode, owner v1.0.90) a creature toughened a quarter as fast (gremHardTier), its gold still the level's
/** @param {string} id @param {number} tier @returns {CreatureKind} */
export const gremFoe = (id, tier) => Object.assign(autoFoe(id, gremHardTier(tier)), { gold: enemyFor(id, tier).gold });
// the boss's kind: autoFoe(id, tier) (or mk's), huge
/** @param {string} id @param {number} tier @param {(id: string, tier: number) => CreatureKind} [mk] @returns {CreatureKind} */
export function bossKind(id, tier, mk = autoFoe) {
  const k = mk(id, tier);
  return Object.assign({}, k, { boss: true, r: k.r * DEV.autoBossSize, hp: Math.round(k.hp * DEV.autoBossHp),
    dmg: Math.max(1, Math.round(k.dmg * DEV.autoBossDmg)) });
}

// a creature hit player i for dmg (× DEV.autoFoeDmg): off his real hp (the run's), into the health meter; at 0 he falls
/** @param {import('../art/titlescene.js').TitleScene} S @param {number} i @param {number} dmg */
export function levelHurt(S, i, dmg) {
  const pl = S.team && S.team[i], r = S.runners[i];
  if (!pl || pl.alive === false || !r || r.out) return;
  if (S.lvl && S.lvl.data && S.lvl.data.grem) return;   // (Grem Mode, owner v1.0.90) players take no damage
  if (dmg > 0 && shieldSoak(r, pl, S.t)) return;   // Permanent Shield: a ready one soaks the hit whole (auto/perks.js)
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
  const tier = S.tier || 1, mk = L.grem ? gremFoe : autoFoe;
  // the elites: in as the scene's right edge reaches them (where the terrain is made), then tracked
  for (const e of L.elites) {
    if (e.alive === false) continue;
    if (!e.f) {
      if (e.x - S.scroll < TITLE_VW + 16 && e.x < S.gen * TCELL - 6) {
        const id = e.id || (e.id = titleKind(S, e.x));
        e.f = titleFoeAt(S, eliteOf(mk(id, tier), e.u == null ? 0.5 : e.u), e.x);
      }
      continue;
    }
    if (e.f.hp <= 0 || !S.foes.includes(e.f)) { e.alive = false; continue; }
    e.x = e.f.x;
  }
  // the boss: in when the team reaches the arena, hunting at once
  if (L.phase === 'arena' && !L.boss && !L.bossDead) {
    const ks = S.roster && S.roster.length ? S.roster : TITLE_KINDS, id = ks[Math.floor(S.rnd() * ks.length)];   // (v1.0.97) an old floor's: one of its roster
    const f = titleFoeAt(S, bossKind(id, tier, mk), Math.min(L.plan.arena.x1 - 30, teamX + BOSS_IN));
    f.aggro = true;
    L.boss = f;
    // (Grem Mode, owner v1.0.92) made off screen right, it comes in to its place while its name's title plays (bossIntro)
    if (L.grem) { L.introT = S.t; L.bossTo = f.x; L.bossFrom = S.scroll + TITLE_VW + f.r + 8; f.x = L.bossFrom; f.aggro = false; }
  }
  const B = L.boss;
  if (B && !L.bossDead) {
    if (B.hp <= 0) L.bossDead = true;
    else if (!S.foes.includes(B)) { B.x = Math.min(L.plan.arena.x1 - 30, teamX + BOSS_IN); B.y = B.ty = S.vh / 2; S.foes.push(B); }   // fell out of the scene: back in
  }
}

// (Grem Mode, owner v1.0.92) the boss coming in: eased from off screen to its place over 70% of DEV.gremBossT, holding its
// fire; true till the title is gone (then it hunts, and the team's guns are on: level.js)
/** @param {import('../art/titlescene.js').TitleScene} S @param {import('./level.js').LevelState} L */
export function bossIntro(S, L) {
  const B = L.boss;
  if (!L.grem || !B || L.introT == null || L.bossDead || L.introDone) return false;
  const a = S.t - L.introT;
  if (a >= DEV.gremBossT) { L.introDone = true; B.aggro = true; return false; }
  const u = Math.min(1, a / (DEV.gremBossT * 0.7)), e = 1 - (1 - u) ** 3, from = L.bossFrom ?? B.x, to = L.bossTo ?? B.x;
  B.x = B.hx = from + (to - from) * e;
  B.cd = Math.max(B.cd, 0.5);
  return true;
}

// the boss's health bar (the screen's overlay): null when there's none
/** @param {import('../art/titlescene.js').TitleScene} S @returns {{ hp: number, max: number, name: string } | null} */
export function levelBoss(S) {
  const L = S.lvl && S.lvl.data;
  const B = L && L.boss;
  if (!B || L.bossDead) return null;
  return { hp: Math.max(0, B.hp), max: B.hpMax, name: B.k.name };
}
