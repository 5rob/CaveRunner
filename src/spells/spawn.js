// @ts-check
// Which spell a floor hands you: Noita's own spawn table (NOITA_SPAWN, NOITA_OF),
// the rarity gate (TIER_FLOOR), modWeight and rollMod.

import { ALL_IDS, tierOf } from './mods.js';

// What a floor is likely to hand you: Noita's own spawn table (gun_actions.lua's
// spawn_level / spawn_probability — https://noita.wiki.gg/wiki/Wand_and_Spell_Tiers).
// Each spell lists the Noita tiers it turns up at and how likely it is there.
// Tiers 0-6 run down the main world; 10 is the end-game. Our spells point at their
// Noita twin in NOITA_OF; the few we made up borrow the nearest twin, or a row of their own.
/** @type {Record<string, [levels: string, chances: string]>} */
export const NOITA_SPAWN = {
  LIGHT_BULLET: ['0,1,2', '2,1,0.5'], LIGHT_BULLET_TRIGGER: ['0,1,2,3', '1,0.5,0.5,0.5'],
  LIGHT_BULLET_TRIGGER_2: ['2,3,5,6,10', '1,0.5,1,1,0.2'], LIGHT_BULLET_TIMER: ['1,2,3', '0.5,0.5,0.75'],
  BULLET: ['1,2,3,4,5', '1,1,1,0.8,0.5'], BULLET_TRIGGER: ['1,2,3,4,5', '0.5,0.5,0.5,0.6,0.5'],
  BULLET_TIMER: ['2,3,4,5,6', '0.5,0.5,0.5,0.5,0.6'], HEAVY_BULLET: ['1,2,3,4,5,6', '0.5,1,1,1,1,1'],
  SLOW_BULLET: ['1,2,3,4', '1,1,1,1'], SLOW_BULLET_TRIGGER: ['1,2,3,4,5', '0.5,0.5,0.5,0.5,1'],
  SLOW_BULLET_TIMER: ['1,2,3,4,5,6', '0.5,0.5,0.5,0.5,1,1'],
  BLACK_HOLE: ['0,2,4,5', '0.8,0.8,0.8,0.8'], BLACK_HOLE_DEATH_TRIGGER: ['2,4,5,6', '0.5,0.5,0.5,0.5'],
  SPITTER: ['0,1,2,3', '1,1,1,0.5'], SPITTER_TIMER: ['0,1,2,3', '0.5,0.5,0.5,1'],
  BUBBLESHOT: ['0,1,2,3', '1,0.6,1,0.5'], BUBBLESHOT_TRIGGER: ['1,2,3', '0.5,0.5,1'],
  DISC_BULLET: ['0,2,4', '1,1,0.6'], BOUNCY_ORB: ['0,2,4', '1,1,1'], BOUNCY_ORB_TIMER: ['0,2,4', '0.5,0.5,0.5'],
  RUBBER_BALL: ['0,1,6', '1,1,0.2'], POLLEN: ['0,1,3,4', '0.6,1,1,0.6'], LANCE: ['1,2,5,6', '0.9,1,0.8,1'],
  ROCKET: ['1,2,3,4,5', '1,1,1,0.5,0.3'], GRENADE: ['0,1,2,3,4', '1,1,0.5,0.25,0.2'],
  GRENADE_TRIGGER: ['0,1,2,3,4,5', '0.5,0.5,0.2,0.5,0.5,1'], MINE: ['1,3,4,6', '1,0.75,1,0.5'],
  MINE_DEATH_TRIGGER: ['2,6', '1,1'], PIPE_BOMB: ['2,3,4', '1,1,0.6'],
  PIPE_BOMB_DEATH_TRIGGER: ['2,3,4,5', '0.6,0.8,1,0.8'], LIGHTNING: ['1,2,5,6', '1,0.9,0.7,1'],
  LASER_EMITTER: ['1,2,3,4', '0.2,0.8,1,0.5'], DIGGER: ['1,2', '1,0.5'], CHAINSAW: ['0,2', '1,1'],
  LUMINOUS_DRILL: ['0,2,10', '1,1,0.1'], LASER_LUMINOUS_DRILL: ['0,2,6,10', '1,1,0.2,0.1'],
  CHAIN_BOLT: ['0,4,5,6', '0.75,1,0.8,0.6'], FIREBALL: ['0,3,4,6', '1,0.7,1,0.5'],
  METEOR: ['4,5,6,10', '0.6,0.6,0.7,0.5'], BUCKSHOT: ['0,1,2,3,4', '1,1,0.9,0.9,0.6'],
  BOMB: ['0,1,2,3,4,5,6', '1,1,1,1,0.5,0.5,0.1'], DEATH_CROSS: ['1,2,3,4,5,6', '1,0.8,0.6,0.5,0.5,0.3'],
  NUKE: ['1,5,6,10', '0.3,1,1,0.2'],
  TELEPORT_PROJECTILE: ['0,1,2,4,5,6', '0.6,0.6,0.6,0.4,0.4,0.4'],
  TELEPORT_PROJECTILE_SHORT: ['0,1,2,4,5,6', '0.6,0.6,0.6,0.4,0.4,0.4'],
  PURPLE_EXPLOSION_FIELD: ['0,1,2,4,5,6', '0.7,1,0.7,0.5,0.5,0.3'],
  LONG_DISTANCE_CAST: ['0,1,2,4,5,6', '0.6,0.7,0.8,0.6,0.3,0.4'],
  TELEPORT_CAST: ['1,2,4,5,6', '0.6,0.6,0.6,0.8,1'], SUPER_TELEPORT_CAST: ['2,4,5,6', '0.2,0.6,0.8,0.8'],
  BURST_2: ['0,1,2,3,4,5,6', '0.8,0.8,0.8,0.8,0.8,0.8,0.8'], BURST_3: ['1,2,3,4,5,6', '0.7,0.7,0.7,0.7,0.7,0.7'],
  BURST_4: ['2,3,4,5,6', '0.4,0.5,0.6,0.6,0.6'], BURST_8: ['5,6,10', '0.1,0.1,0.5'], BURST_X: ['5,6,10', '0.1,0.1,0.5'],
  SCATTER_3: ['0,1,2,3', '0.6,0.7,0.7,0.8'], I_SHAPE: ['1,2,3', '0.4,0.5,0.3'], Y_SHAPE: ['0,1,2,3', '0.8,0.5,0.4,0.3'],
  W_SHAPE: ['2,3,4,5,6', '0.4,0.3,0.5,0.3,0.3'],
  SPREAD_REDUCE: ['1,2,3,4,5,6', '0.8,0.8,0.8,0.8,0.7,0.6'], HEAVY_SPREAD: ['0,1,2,4,5,6', '0.6,0.7,0.8,0.8,0.8,0.6'],
  RECHARGE: ['1,2,3,4,5,6', '0.8,0.9,1,0.8,0.9,1'], LIFETIME: ['3,4,5,6,10', '0.5,0.5,0.5,0.75,0.1'],
  LIFETIME_DOWN: ['3,4,5,6,10', '0.5,0.5,0.75,0.5,0.1'], MANA_REDUCE: ['1,2,3,4,5,6', '0.7,0.9,1,1,1,1'],
  BLOOD_MAGIC: ['5,6,10', '0.3,0.7,0.5'], MONEY_MAGIC: ['3,5,6,10', '0.2,0.8,0.3,0.5'],
  BLOOD_TO_POWER: ['2,5,6,10', '0.2,0.8,0.2,0.5'], QUANTUM_SPLIT: ['2,3,4,5,6', '0.5,0.6,0.5,0.5,1'],
  GRAVITY: ['2,3,4,5,6', '0.5,0.4,0.4,0.3,0.3'], GRAVITY_ANTI: ['2,3,4,5,6', '0.5,0.4,0.4,0.3,0.3'],
  PINGPONG_PATH: ['1,3,5', '0.4,0.5,0.4'], HORIZONTAL_ARC: ['1,3,5', '0.4,0.4,0.4'],
  ORBIT_SHOT: ['1,2,3,4', '0.2,0.4,0.4,0.3'], SPIRALING_SHOT: ['1,2,3,4', '0.2,0.3,0.4,0.5'],
  BOUNCE: ['2,3,4,6', '1,1,0.4,0.2'], HOMING: ['1,2,3,4,5,6', '0.1,0.4,0.4,0.4,0.4,0.4'],
  HOMING_SHORT: ['1,2,3,4,5,6', '0.4,0.8,1,0.4,0.3,0.1'], HOMING_SHOOTER: ['2,3,4,6', '0.2,0.3,0.2,0.2'],
  AUTOAIM: ['2,3,4,5,6', '0.4,0.4,0.4,0.4,0.4'], HOMING_ACCELERATING: ['1,2,3,4', '0.1,0.3,0.3,0.5'],
  PIERCING_SHOT: ['2,3,4,5,6', '0.4,0.5,0.6,0.6,0.4'], CLIPPING_SHOT: ['2,3,4,5,6', '0.2,0.3,0.6,0.4,0.6'],
  DAMAGE: ['1,2,3,4,5', '0.6,0.6,0.8,0.6,0.6'], DAMAGE_RANDOM: ['3,4,5', '0.7,0.6,0.6'],
  BLOODLUST: ['1,3,4,5,6', '0.2,0.3,0.6,0.7,0.3'], DAMAGE_FOREVER: ['2,3,4,5,6,10', '0.2,0.3,0.6,0.5,0.2,0.2'],
  CRITICAL_HIT: ['1,2,3,4,5', '0.5,0.6,0.6,0.7,0.6'], HEAVY_SHOT: ['2,3,4', '0.4,0.4,0.5'],
  LIGHT_SHOT: ['2,3,4', '0.3,0.5,0.4'], KNOCKBACK: ['3,5', '0.7,0.6'], RECOIL: ['2,4', '0.6,0.7'],
  RECOIL_DAMPER: ['3,6', '0.6,0.7'], SPEED: ['1,2,3', '1,0.5,0.5'], ACCELERATING_SHOT: ['2,3,4', '0.5,0.4,1'],
  EXPLOSIVE_PROJECTILE: ['2,3,4', '1,1,0.8'], CLUSTERMOD: ['1,2,3', '0.5,1,0.6'],
  EXPLOSION: ['0,2,4,5', '0.5,1,1,0.7'], FIRE_BLAST: ['0,1,3,5', '0.5,0.7,0.6,0.4'],
  FREEZE_FIELD: ['0,2,4,5', '0.3,0.6,0.7,0.3'], REGENERATION_FIELD: ['1,2,3,4', '0.3,0.3,0.4,0.3'],
  SHIELD_FIELD: ['2,3,4,5,6', '0.3,0.3,0.4,0.5,0.3'], VACUUM_ENTITIES: ['2,3,5,6', '0.3,0.7,0.3,0.4'],
  CLOUD_THUNDER: ['0,1,2,3,4,5', '0.3,0.3,0.2,0.3,0.4,0.5'],
  MATTER_EATER: ['1,2,4,5,10', '0.1,0.9,0.1,0.2,0.2'], BOUNCE_EXPLOSION: ['2,3,4,5', '0.2,0.6,0.8,0.8'],
  ALL_DISCS: ['0,6,10', '0.1,0.05,1'], RESET: ['10', '1'],
  ADD_TRIGGER: ['3,4,5,10', '0.3,0.6,0.6,1'], ADD_TIMER: ['3,4,5,10', '0.3,0.6,0.6,1'],
  ADD_DEATH_TRIGGER: ['3,4,5,10', '0.3,0.6,0.6,1'],
  ALPHA: ['5,6,10', '0.1,0.2,1'], GAMMA: ['5,6,10', '0.1,0.2,1'], TAU: ['5,6,10', '0.1,0.2,1'],
  OMEGA: ['5,6,10', '0.1,0.1,1'], MU: ['5,6,10', '0.1,0.2,1'], PHI: ['5,6,10', '0.1,0.2,1'],
  SIGMA: ['4,5,10', '0.1,0.2,1'], ZETA: ['2,5,10', '0.2,0.4,0.5'],
  // ours alone: no Noita twin
  OURS_COLD: ['3,4,5,6', '0.2,0.3,0.4,0.5'], OURS_BATTERY: ['2,3,4,5,6', '0.3,0.4,0.5,0.5,0.5'],
  OURS_AUTO: ['0,1,2,3,4,5,6', '0.4,0.4,0.4,0.4,0.4,0.4,0.4'],
};
/** @type {Record<string, string>} */
export const NOITA_OF = {
  bolt: 'LIGHT_BULLET', spark: 'LIGHT_BULLET', slug: 'HEAVY_BULLET', buck: 'BUCKSHOT', lance: 'LANCE',
  orb: 'RUBBER_BALL', saw: 'CHAINSAW', blast: 'BOMB', dmg_up: 'DAMAGE', heavy: 'HEAVY_SHOT',
  light: 'LIGHT_SHOT', speed: 'SPEED', accel: 'ACCELERATING_SHOT', homing: 'HOMING',
  seeker: 'HOMING_ACCELERATING', bounce: 'BOUNCE', pierce: 'PIERCING_SHOT', tight: 'SPREAD_REDUCE',
  scatter: 'SCATTER_3', big: 'DAMAGE', range: 'LIFETIME', brief: 'LIFETIME_DOWN',
  tip: 'EXPLOSIVE_PROJECTILE', borer: 'CLIPPING_SHOT', fast: 'RECHARGE', over: 'HEAVY_SHOT',
  double: 'BURST_2', triple: 'BURST_3', quad: 'BURST_4', cheap: 'MANA_REDUCE', trigger: 'RECHARGE',
  over_heat: 'DAMAGE_RANDOM', cold: 'OURS_COLD', recharge: 'RECHARGE', battery: 'OURS_BATTERY', auto: 'OURS_AUTO',
  arrow: 'BULLET', missile: 'ROCKET', fball: 'FIREBALL', fbolt: 'GRENADE', flamer: 'FIREBALL', bubble: 'BUBBLESHOT',
  spit: 'SPITTER', eorb: 'SLOW_BULLET', esph: 'BOUNCY_ORB', zap: 'LIGHTNING', chain: 'CHAIN_BOLT',
  void: 'BLACK_HOLE', digbolt: 'DIGGER', glance: 'LANCE', plasma: 'LASER_EMITTER',
  ldrill: 'LUMINOUS_DRILL', cross: 'DEATH_CROSS', pollen: 'POLLEN', disc: 'DISC_BULLET', nuke: 'NUKE',
  meteor: 'METEOR', tele: 'TELEPORT_PROJECTILE', teleshort: 'TELEPORT_PROJECTILE_SHORT',
  boom: 'EXPLOSION', brim: 'FIRE_BLAST', crystal: 'MINE', dormant: 'PIPE_BOMB', stillc: 'FREEZE_FIELD',
  shieldc: 'SHIELD_FIELD', vigour: 'REGENERATION_FIELD', storm: 'CLOUD_THUNDER',
  vacfield: 'VACUUM_ENTITIES', glitter: 'PURPLE_EXPLOSION_FIELD', refresh: 'RESET',
  blood: 'BLOOD_MAGIC', bpower: 'BLOOD_TO_POWER', gpower: 'MONEY_MAGIC', farcast: 'LONG_DISTANCE_CAST',
  telecast: 'TELEPORT_CAST', warpcast: 'SUPER_TELEPORT_CAST', sawstorm: 'ALL_DISCS',
  knock: 'KNOCKBACK', kick: 'RECOIL', damper: 'RECOIL_DAMPER', crit: 'CRITICAL_HIT', gravmod: 'GRAVITY',
  float: 'GRAVITY_ANTI', boomer: 'HOMING_SHOOTER', follow: 'HOMING_SHOOTER',
  lifeup: 'LIFETIME', lifedn: 'LIFETIME_DOWN', grow: 'SPEED', shrink: 'SPEED', spiral: 'SPIRALING_SHOT', pong: 'PINGPONG_PATH',
  orbit: 'ORBIT_SHOT', autoaim: 'AUTOAIM', nearhome: 'HOMING_SHORT', flat: 'HORIZONTAL_ARC',
  eater: 'MATTER_EATER', lust: 'BLOODLUST', manapow: 'DAMAGE_FOREVER', split: 'QUANTUM_SPLIT',
  cluster: 'CLUSTERMOD', bboom: 'BOUNCE_EXPLOSION', hspread: 'HEAVY_SPREAD', oct: 'BURST_8',
  myriad: 'BURST_X', bifur: 'Y_SHAPE', trifur: 'W_SHAPE', behind: 'I_SHAPE',
  alpha: 'ALPHA', gamma: 'GAMMA', tau: 'TAU', omega: 'OMEGA', phi: 'PHI', sigma: 'SIGMA', mu: 'MU', zeta: 'ZETA',
  addtrig: 'ADD_TRIGGER', addtimer: 'ADD_TIMER', adddeath: 'ADD_DEATH_TRIGGER',
  bolt_t: 'LIGHT_BULLET_TRIGGER', bolt_tt: 'LIGHT_BULLET_TRIGGER_2', arrow_t: 'BULLET_TRIGGER',
  fbolt_t: 'GRENADE_TRIGGER', bubble_t: 'BUBBLESHOT_TRIGGER', eorb_t: 'SLOW_BULLET_TRIGGER',
  crystal_t: 'MINE_DEATH_TRIGGER', dormant_t: 'PIPE_BOMB_DEATH_TRIGGER', bolt_ti: 'LIGHT_BULLET_TIMER',
  arrow_ti: 'BULLET_TIMER', spit_ti: 'SPITTER_TIMER', esph_ti: 'BOUNCY_ORB_TIMER',
  eorb_ti: 'SLOW_BULLET_TIMER', ldrill_ti: 'LASER_LUMINOUS_DRILL', void_d: 'BLACK_HOLE_DEATH_TRIGGER',
};
// Our floors onto Noita's tiers: floor 1 is tier 0, floor 10 is tier 6, past that the
// end-game tier 10. In between it slides, so a spell fades in and out over a floor or two.
export const floorTier = (/** @type {number} */ floor) => floor > 10 ? 10 : Math.max(0, (floor - 1) * 6 / 9);
// a spell's chance at one Noita tier (0 if it isn't listed there)
/** @param {string} id @param {number} tier @returns {number} */
export function noitaP(id, tier) {
  const row = NOITA_SPAWN[NOITA_OF[id]];
  if (!row) return 0;
  const lv = row[0].split(',').map(Number), pr = row[1].split(',').map(Number);
  const k = lv.indexOf(tier);
  return k < 0 ? 0 : pr[k];
}
// our own rarity overrides Noita where our spell is far stronger than its twin
// (Black Hole is a tier-0 spell in Noita): a rarity-4 spell waits for floor 4
/** @type {Record<number, number>} */
export const TIER_FLOOR = { 4: 4 };
/** @param {string} id @param {number} floor @returns {number} */
export function modWeight(id, floor) {
  const t = floorTier(floor);
  if (floor < (TIER_FLOOR[tierOf(id)] || 0)) return 0;
  if (t >= 10) return Math.max(noitaP(id, 10), noitaP(id, 6));
  const a = Math.floor(t), f = t - a;
  return noitaP(id, a) * (1 - f) + noitaP(id, a + 1) * f;
}
/** @param {Rnd} rnd @param {number} floor @param {Record<string, boolean | number>} [skip] ids never to roll @returns {string} */
export function rollMod(rnd, floor, skip) {
  let total = 0;
  for (const id of ALL_IDS) if (!skip || !skip[id]) total += modWeight(id, floor);
  let r = rnd() * total;
  for (const id of ALL_IDS) {
    if (skip && skip[id]) continue;
    r -= modWeight(id, floor);
    if (r <= 0) return id;
  }
  return 'bolt';
}
