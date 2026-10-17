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
import { spiderHold } from '../creatures/spider.js';
import { gremHardTier } from './grem.js';
import { LVL_TEAM } from './level.js';
import { TCELL, TITLE_KINDS, TITLE_VW, lookAt, titleCeil, titleFloor, titleFoeAt, titleKind, titleSolid } from '../art/titlescene.js';

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

// (owner v1.0.103: a boss came in under the ground, out of the team's reach, and the level waited on it for good) a big creature
// whose middle is in rock or under the floor's line is put back on the floor (its size above it; under the roof if the cave is
// lower than it is tall: half way)
/** @param {import('../art/titlescene.js').TitleScene} S @param {Enemy} f */
// (Grem v2.0.17: elites and the boss spider stuck) a spider sits only its feet's reach off the rock (creatures/spider.js
// spiderHold), less than its size: measured by its size it was "buried" on every floor, lifted, fell, lifted, never walked
export function unbury(S, f) {
  const fy = titleFloor(f.x, S), cy = titleCeil(f.x, S), h = f.k && f.k.act === 'spider' ? spiderHold(f) : f.r;
  if (!(f.y > fy - h + 2 || titleSolid(S, f.x - S.scroll, f.y))) return;
  const y = fy - cy > 2 * h + 2 ? fy - h - 1 : (fy + cy) / 2;
  f.ty += y - f.y; f.y = y;
}
// (Grem, owner: "elites still getting stuck … a reliable solution") the fallback for an elite or the boss: hunting, further than
// its size + 60 from every player, and it hasn't got DEV.autoStuckR from where it was for DEV.autoStuckT s → it is put on open
// floor (or the middle of the cave) DEV.autoStuckHop nearer the team, falling from there (a spider lets go of its lines).
// Turrets and nests hold still by design: never
/** @param {import('../art/titlescene.js').TitleScene} S @param {Enemy} f */
export function unstick(S, f) {
  const act = f.k && f.k.act;
  if (!(DEV.autoStuckT > 0) || act === 'turret' || act === 'nest' || f.hp <= 0) return;
  const runs = S.runners.filter(r => !r.out && !r.hide);
  if (!runs.length) return;
  let near = runs[0], nd = Infinity;
  for (const r of runs) { const d = Math.hypot(S.scroll + r.x + PW / 2 - f.x, r.y + PH / 2 - f.y); if (d < nd) { nd = d; near = r; } }
  const s = f.stk;
  if (!s || !f.aggro || nd < f.r + 60 || Math.hypot(f.x - s.x, f.y - s.y) > DEV.autoStuckR) { f.stk = { x: f.x, y: f.y, t: S.t }; return; }
  if (S.t - s.t < DEV.autoStuckT) return;
  const tx = S.scroll + near.x + PW / 2, dir = Math.sign(tx - f.x) || 1, h = act === 'spider' ? spiderHold(f) : f.r;
  const go = Math.min(DEV.autoStuckHop, Math.max(0, Math.abs(tx - f.x) - f.r - 40));
  // the first open place from there back toward where it is: room for its body between the floor and the roof
  for (let k = 0; k <= 12; k++) {
    const x = f.x + dir * go * (1 - k / 12), fy = titleFloor(x, S), cy = titleCeil(x, S);
    if (fy - cy < 2 * Math.min(h, f.r) + 4) continue;
    const y = fy - cy > 2 * h + 2 ? fy - h - 1 : (fy + cy) / 2;
    if (titleSolid(S, x - S.scroll, y)) continue;
    f.ty += y - f.y; f.x = f.hx = x; f.y = y;
    if (f.sp) { f.sp.mode = 'fall'; f.sp.line = null; f.sp.vy = 0; f.sp.shot = null; }
    f.wox = f.woy = 0;
    break;
  }
  f.stk = { x: f.x, y: f.y, t: S.t };
}
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
    unbury(S, e.f);
    unstick(S, e.f);
    e.x = e.f.x;
  }
  // the boss: in when the team reaches the arena, hunting at once (Grem, owner v2.0.16: already waiting in the arena as
  // the team comes into view of it, made as its middle is generated; still and holding its fire till the arena starts)
  // (owner v2.0.17) on the arena's right, DEV.gremBossAt across the screen where the team stops, facing them: both framed
  const A = L.plan.arena, wx = Math.min(A.x1 - 30, A.mid - LVL_TEAM + TITLE_VW * DEV.gremBossAt);
  const early = L.grem && L.phase === 'run' && wx - S.scroll < TITLE_VW + 200 && wx < S.gen * TCELL - 6;   // (v2.0.17: as soon as its ground is made, so it's there before the team arrives)
  if ((L.phase === 'arena' || early) && !L.boss && !L.bossDead) {
    const look = lookAt(S, L.plan.arena.mid), ks = look && look.roster && look.roster.length ? look.roster : TITLE_KINDS, id = ks[Math.floor(S.rnd() * ks.length)];   // (v1.0.97) an old floor's: one of its roster
    const f = titleFoeAt(S, bossKind(id, tier, mk), L.grem ? wx : Math.min(L.plan.arena.x1 - 30, teamX + BOSS_IN));   // (Grem: always at its waiting place)
    f.aggro = true;
    L.boss = f;
    if (early) { f.aggro = false; L.bossWait = true; f.hx = f.x; }
    // (Grem Mode, owner v1.0.92) made off screen right, it comes in to its place while its name's title plays (bossIntro)
    // (v2.0.17) made late (the arena reached before its place was in view): no slide-in either, its title at once
    if (L.grem && !early) { L.introT = S.t; L.bossTo = L.bossFrom = f.x; f.aggro = false; f.lx = -1; f.ly = 0; }
  }
  const B = L.boss;
  if (B && L.bossWait) {
    if (L.phase === 'run') { B.aggro = false; B.waiting = true; B.cd = Math.max(B.cd, 0.5); B.x = B.hx = wx; B.lx = -1; B.ly = 0; if (B.sp) B.sp.side = -1; }   // (held in place, facing the team: it would wander off)
    else { L.bossWait = false; B.waiting = false; L.introT = S.t; L.bossFrom = L.bossTo = B.x; }   // the arena: its name's title, then it hunts (bossIntro)
  }
  if (B && !L.bossDead) {
    if (B.hp > 0 && B.x >= L.plan.arena.x0 && B.x <= L.plan.arena.x1) unbury(S, B);   // (owner v1.0.103: one came in under the ground and the level stuck)
    if (B.hp > 0 && !B.waiting) unstick(S, B);
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
  if (a >= DEV.gremBossT && S.scroll + LVL_TEAM >= L.plan.arena.mid - 1) { L.introDone = true; B.aggro = true; return false; }   // (v2.0.17: and the team at its stop, both framed)
  const u = Math.min(1, a / (DEV.gremBossT * 0.7)), e = 1 - (1 - u) ** 3, from = L.bossFrom ?? B.x, to = L.bossTo ?? B.x;
  B.x = B.hx = from + (to - from) * e;
  B.cd = Math.max(B.cd, 0.5);
  return true;
}

// the boss's health bar (the screen's overlay): null when there's none (or it hasn't been hurt yet)
/** @param {import('../art/titlescene.js').TitleScene} S @returns {{ hp: number, max: number, name: string } | null} */
export function levelBoss(S) {
  const L = S.lvl && S.lvl.data;
  const B = L && L.boss;
  if (!B || L.bossDead || B.hp >= B.hpMax) return null;   // (owner, v2.0.16: no bar till it's hurt)
  return { hp: Math.max(0, B.hp), max: B.hpMax, name: B.k.name };
}

// ---- kept for the test suites (grem branch: the game no longer calls these; the suites set up with them) ----
// is every player out?
/** @param {import('../art/titlescene.js').TitleScene} S */
export const allFallen = S => S.runners.length > 0 && S.runners.every(r => r.out);
