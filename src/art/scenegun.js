// @ts-check
// CaveRunner Auto (stage 5a): a real gun in the menu's scene. The gun's clocks and mana as the game keeps them
// (game/systems/gun.js cast, spells/bagsim.js fireSimStep), one pull through the real planCast, and each planned
// Shot mapped onto the scene's own shot model (SceneShot: titlescene.js stepShots flies it). Pure: the logic suites
// call it. What the bridge can't carry yet is GUN_TODO (src/auto/README.md lists it too).

import { effRecharge, gunPassives, planCast } from '../spells/cast.js';
import { shuffleOrder } from '../spells/guns.js';
import { MODS } from '../spells/mods.js';
/** @typedef {import('./titlescene.js').TShot} SceneShot */

const SP = 0.5;                       // the scene's speed scale (titlescene.js SP: the game's speeds at the title's screen)
export const SG_LIFE = 1.6;           // shot lives × this (as the title's kits), capped at SG_LIFE_MAX s
export const SG_LIFE_MAX = 4;
export const SG_SIZE_MAX = 8;         // the biggest a shot draws (world units)
export const SG_EXPLODE_MAX = 40;     // the biggest blast (the title's cap)
export const SG_PIT_MAX = 10;
export const SG_PELLETS = 12;         // at most this many of one shot at once

// Mods the bridge can't do yet: each fires (or is carried) as nothing, or as if it weren't there. Kept honest
// by tests/logic/auto-guns.test.js (every mod changes something about the shots or the gun's clocks, or is here,
// and everything here really changes nothing). The PM picks what to chase.
/** @type {string[]} */
export const GUN_TODO = [
  // statics and fields (they don't fly: planShots leaves them out)
  'boom', 'brim', 'crystal', 'dormant', 'crystal_t', 'dormant_t', 'stillc', 'shieldc', 'vigour', 'storm', 'vacfield', 'glitter',
  // modifiers whose effect the scene's shot model has no field for yet
  'knock', 'damper', 'crit', 'spiral', 'follow', 'followaim', 'autoaim', 'aimassist', 'discrim', 'eater', 'gpower', 'cluster',
  // a passive with no meaning here (the scene always fires on its own)
  'auto',
];

// One frame of a gun's clocks: mana back at its regen (to its max), cast delay and recharge counting down.
/** @param {Gun} g @param {number} dt */
export function gunTick(g, dt) {
  const pas = gunPassives(g);
  if (!g.order) shuffleOrder(g);
  g.delayT = (g.delayT || 0) - dt; g.rechT = (g.rechT || 0) - dt;
  const max = g.manaMax + pas.manaMax;
  g.mana = Math.min(max, (g.mana == null ? max : g.mana) + (g.manaRegen + pas.manaRegen) * dt);
}
// is it ready to pull?
/** @param {Gun} g */
export const gunReady = g => (g.delayT || 0) <= 0 && (g.rechT || 0) <= 0;

// One pull, as the game's cast: the plan (its shots), or null (nothing to fire: the recharge started; or not the
// mana: a short wait). Mana spent, the cast delay set, the recharge started when the list ran out.
/** @param {Gun} g @param {(Gun | null)[]} [others] @returns {Plan | null} */
export function gunPull(g, others) {
  if (!gunReady(g)) return null;
  if (!g.order) shuffleOrder(g);
  if (g.idx == null) g.idx = 0;
  const wrap = () => { g.idx = 0; g.rechT = g.rechLen = effRecharge(g); shuffleOrder(g); };
  const plan = planCast(g, others);
  if (!plan.shots.length) { wrap(); return null; }
  if ((g.mana || 0) < plan.cost) { g.idx = plan.start; g.delayT = 0.12; return null; }
  g.mana = (g.mana || 0) - plan.cost;
  g.delayT = g.delayMax = plan.delay;
  if (plan.wrap) wrap();
  return plan;
}

// The scene's shots for one planned Shot fired at angle `ang` (radians) from (x, y): its pellets (count, spread
// each its own random turn, as the game's spawnShot), its formation angle, speed, size, gravity, drag, bounce,
// pierce, blast, dig, fire, homing, acceleration, top speed, chain, its look and colour, real damage, and a
// trigger's payload (released where it hits, on its timer, or where it dies: titlescene.js stepShots).
/** @param {Shot} sh @param {number} ang @param {number} x @param {number} y @param {() => number} R @param {number} [by] who fired it (a runner's id) @returns {SceneShot[]} */
export function shotsOf(sh, ang, x, y, R, by) {
  const out = [], n = Math.min(SG_PELLETS, Math.max(1, Math.round(sh.count || 1)));
  const off = (sh.ang || 0) * Math.PI / 180;
  const life = Math.min(SG_LIFE_MAX, (sh.fuse ? Math.min(sh.life, sh.fuse + 0.5) : sh.life) * SG_LIFE);
  for (let i = 0; i < n; i++) {
    const a = ang + off + (R() - 0.5) * (sh.spread || 0) * Math.PI / 180;
    const v = (sh.speed || 0) * SP;
    out.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: Math.max(1, Math.min(SG_SIZE_MAX, sh.size || 2)),
      col: sh.col || MODS.bolt.col || '#fff', look: sh.look || '', life, foe: false, spin: R() * 6, grav: (sh.grav || 0) * SP,
      drag: sh.drag || 0, explode: Math.min(SG_EXPLODE_MAX, sh.explode || 0), pit: Math.min(SG_PIT_MAX, Math.max(sh.pit || 0, sh.bore || 0)),
      fire: sh.fire || 0, bounce: sh.bounce || 0, bounceE: sh.bounceE || 0.92, pierce: sh.pierce || 0, dmg: sh.dmg || 0,
      homing: sh.homing || 0, accel: sh.accel || 0, vmax: (sh.vmax || 0) * SP, chain: sh.chain || 0,
      real: true, by: by == null ? -1 : by, trig: sh.trig || null, timer: sh.timer || 0, pay: sh.payload && sh.payload.length ? sh.payload : null, age: 0 });
  }
  return out;
}
// every shot of a plan, fired at `ang` from (x, y)
/** @param {Plan} plan @param {number} ang @param {number} x @param {number} y @param {() => number} R @param {number} [by] @returns {SceneShot[]} */
export function planShots(plan, ang, x, y, R, by) {
  /** @type {SceneShot[]} */
  const out = [];
  for (const sh of plan.shots) if (!sh.still) for (const s of shotsOf(sh, ang, x, y, R, by)) out.push(s);
  return out;
}
