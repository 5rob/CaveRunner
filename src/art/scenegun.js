// @ts-check
// CaveRunner Auto (stage 5a): a real gun in the menu's scene. The gun's clocks and mana as the game keeps them
// (game/systems/gun.js cast, spells/bagsim.js fireSimStep), one pull through the real planCast, and each planned
// Shot mapped onto the scene's own shot model (SceneShot: titlescene.js stepShots flies it). Pure: the logic suites
// call it. What the bridge can't carry yet is GUN_TODO (src/auto/README.md lists it too).

import { effRecharge, gunPassives, planCast } from '../spells/cast.js';
import { shuffleOrder } from '../spells/guns.js';
import { MODS } from '../spells/mods.js';
import { DEV } from '../dev/knobs.js';
import { perkBag } from '../data/perks.js';
import { LIFE_K } from '../auto/shotfx.js';
import { trajGrav, trajLife, trajLob } from '../auto/traj.js';
/** @typedef {import('./titlescene.js').TShot} SceneShot */

const SP = 0.5;                       // the scene's speed scale (titlescene.js SP: the game's speeds at the title's screen)
export const SG_LIFE = 1.6;           // shot lives × this (as the title's kits), capped at SG_LIFE_MAX s
export const SG_LIFE_MAX = 4;
export const SG_SIZE_MAX = 8;         // the biggest a shot draws (world units)
export const SG_EXPLODE_MAX = 40;     // the biggest blast (the title's cap)
export const SG_PIT_MAX = 10;
export const SG_BEAM_MAX = 200;      // the longest beam (Plasma Beam's 320 is most of the screen)
export const SG_PELLETS = 12;         // at most this many of one shot at once

// One frame of a gun's clocks: mana back at its regen (to its max), cast delay and recharge counting down.
/** @param {Gun} g @param {number} dt */
export function gunTick(g, dt) {
  const pas = gunPassives(g);
  if (!g.order) shuffleOrder(g);
  g.delayT = (g.delayT || 0) - dt; g.rechT = (g.rechT || 0) - dt;
  const max = Math.max(0, g.manaMax + pas.manaMax);
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
  // Wand Refresh (owner, v1.0.35: it did nothing here): the next time the list runs out, no recharge (the game's skipRech)
  // (owner, after v1.0.83) Recharge Battery: mana to full at each reload
  const wrap = () => {
    g.idx = 0; g.rechT = g.rechLen = g.skipRech ? 0 : effRecharge(g); g.skipRech = false; shuffleOrder(g);
    const pas = gunPassives(g);
    if (pas.rechFill) g.mana = Math.max(0, g.manaMax + pas.manaMax);
  };
  const plan = planCast(g, others);
  if (!plan.shots.length) { wrap(); return null; }
  if ((g.mana || 0) < plan.cost) { g.idx = plan.start; g.swc = plan.swc0; g.delayT = 0.12; return null; }
  g.mana = (g.mana || 0) - plan.cost;
  g.delayT = g.delayMax = plan.delay;
  g.pulls = (g.pulls || 0) + 1;
  if ((plan.acts || []).includes('refresh')) g.skipRech = true;
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
  const life = Math.min(SG_LIFE_MAX, (sh.fuse ? Math.min(sh.life, sh.fuse + 0.5) : sh.life) * SG_LIFE) * (LIFE_K[sh.sid] || 1) * trajLife(sh);
  for (let i = 0; i < n; i++) {
    let a = ang + off + (R() - 0.5) * (sh.spread || 0) * Math.PI / 180 + trajLob(sh, ang);
    if (sh.flat) a = Math.cos(a) < 0 ? Math.PI : 0;   // Horizontal Path: dead level (auto/traj.js knobs trFlat…)
    const v = (sh.speed || 0) * SP * (sh.flat ? DEV.trFlatSpeed : 1);
    out.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: Math.max(1, Math.min(SG_SIZE_MAX, sh.size || 2)),
      col: sh.col || MODS.bolt.col || '#fff', look: sh.look || '', life, foe: false, spin: R() * 6, grav: trajGrav(sh, SP),
      drag: sh.drag || 0, explode: Math.min(SG_EXPLODE_MAX, sh.explode || 0), pit: Math.min(SG_PIT_MAX, Math.max(sh.pit || 0, sh.bore || 0)), bore: Math.min(SG_PIT_MAX, sh.bore || 0),
      fire: sh.fire || 0, bounce: sh.bounce || 0, bounceE: sh.bounceE || 0.92, pierce: sh.pierce || 0, dmg: (sh.dmg || 0) * (sh.flat ? DEV.trFlatDmg : 1),
      homing: sh.sid === 'missile' ? Math.max(1, sh.homing || 0) : sh.homing || 0, homeR: sh.sid === 'missile' ? 400 : 0, accel: sh.accel || 0, vmax: (sh.vmax || 0) * SP, chain: sh.chain || 0,
      real: true, by: by == null ? -1 : by, trig: sh.trig || null, timer: sh.timer || 0, pay: sh.payload && sh.payload.length ? sh.payload : null, age: 0,
      sid: sh.sid || '', light: sh.light || '', lightR: sh.lightR || 0,
      beam: Math.min(SG_BEAM_MAX, sh.beam || 0), ang: a, pull: sh.pull || 0, follow: sh.follow || 0,
      orbit: sh.orbit || 0, spiral: sh.spiral || 0, boomer: sh.boomer || 0, pong: sh.pong || 0,
      homN: sh.homN || 0, seekN: sh.seekN || 0, nearN: sh.nearN || 0, autoaim: sh.autoaim || 0, gravN: sh.gravN || 0, floatN: sh.floatN || 0, flat: sh.flat || 0, only: sh.only || null, manaB: sh.manaB || 0 });
  }
  return out;
}
// the damage the player's fitted perks multiply their shots by (Glass Cannon x2.5; owner, v1.0.35: it did nothing). Each perk once
/** @param {RunPlayer} pl */
export const perkDmg = pl => perkBag([...new Set((pl.perks || []).map(it => it && it.id).filter(Boolean))].map(String)).dmg;
// every shot of a plan, fired at `ang` from (x, y)
/** @param {Plan} plan @param {number} ang @param {number} x @param {number} y @param {() => number} R @param {number} [by] @returns {SceneShot[]} */
export function planShots(plan, ang, x, y, R, by) {
  /** @type {SceneShot[]} */
  const out = [];
  for (const sh of plan.shots) {
    if (sh.sid === 'vacfield') { out.push(whiteHole(sh, ang, x, y, by)); continue; }
    if (sh.sid === 'vigour' || sh.sid === 'manaspring') { out.push(vigourCircle(sh, x, y, by)); continue; }
    if (!sh.still) for (const s of shotsOf(sh, ang, x, y, R, by)) out.push(s);
  }
  return out;
}

// White Hole (owner, v1.0.40): the one static Auto casts. It hangs still WH_AHEAD units along the aim for its life,
// pulling (auto/shotfx.js vacPull), harmless; nothing stops it (titlescene.js stepShots skips its hits). (owner, v1.0.85) With
// Follow Me it comes to its caster and stays with him, as the Circle of Vigour (titlescene.js fieldFollow): the Follow Me used to be dropped here.
export const WH_AHEAD = 50;
/** @param {Shot} sh @param {number} ang @param {number} x @param {number} y @param {number} [by] @returns {SceneShot} */
export function whiteHole(sh, ang, x, y, by) {
  const life = Math.max(0.3, sh.life || 1.2);
  return { x: x + Math.cos(ang) * WH_AHEAD, y: y + Math.sin(ang) * WH_AHEAD, vx: 0, vy: 0, size: 2, col: sh.col || '#9fd8ff', look: '', life, max: life,
    foe: false, spin: 0, grav: 0, drag: 0, explode: 0, pit: 0, fire: 0, bounce: 0, bounceE: 0, pierce: 0, dmg: 0, homing: 0, accel: 0, vmax: 0, chain: 0,
    real: true, by: by == null ? -1 : by, trig: null, timer: 0, pay: null, age: 0, sid: 'vacfield', light: '159,216,255', lightR: 30,
    beam: 0, ang, pull: 0, vac: sh.r || 64, follow: sh.follow || 0, only: sh.only || null };
}
// Circle of Vigour (owner, v1.0.66): cast at the gun, it stays put on the ground for its life (titlescene.js stepShots moves it
// back with the scroll; with Follow Me it comes to its caster and stays with him, v1.0.66; vigourStep: a living player inside heals VIG_HP every VIG_TICK s, × his heal perks, as the old game); harmless
// (owner, after v1.0.83) Mana Spring is the same circle, giving MANA_TICK mana a tick to the gun in hand (`mana`)
export const VIG_HP = 4, VIG_TICK = 0.4, MANA_TICK = 8;
/** @param {Shot} sh @param {number} x @param {number} y @param {number} [by] @returns {SceneShot} */
export function vigourCircle(sh, x, y, by) {
  const life = Math.max(0.3, sh.life || 5), mana = sh.sid === 'manaspring';
  return { x, y, vx: 0, vy: 0, size: 2, col: sh.col || (mana ? '#4a9cff' : '#46c48c'), look: '', life, max: life, mana: mana ? MANA_TICK : 0,
    foe: false, spin: 0, grav: 0, drag: 0, explode: 0, pit: 0, fire: 0, bounce: 0, bounceE: 0, pierce: 0, dmg: 0, homing: 0, accel: 0, vmax: 0, chain: 0,
    real: true, by: by == null ? -1 : by, trig: null, timer: 0, pay: null, age: 0, sid: mana ? 'manaspring' : 'vigour', light: mana ? '74,156,255' : '70,196,140', lightR: 30,
    beam: 0, ang: 0, pull: 0, heal: sh.r || 36, tick: 0, follow: sh.follow || 0, only: sh.only || null };
}

// ---- kept for the test suites (grem branch: the game no longer calls these; the suites set up with them) ----
// Mods the bridge can't do yet: each fires (or is carried) as nothing, or as if it weren't there. Kept honest
// by tests/logic/auto-guns.test.js (every mod changes something about the shots or the gun's clocks, or is here,
// and everything here really changes nothing). The PM picks what to chase.
/** @type {string[]} */
export const GUN_TODO = [
  // statics and fields (they don't fly: planShots leaves them out)
  'boom', 'brim', 'crystal', 'dormant', 'stillc', 'shieldc', 'storm', 'glitter',
  // modifiers whose effect the scene's shot model has no field for yet
  // (Discriminate left it in v1.0.71: shotsOf / whiteHole carry `only`; an unset copy does nothing, by design)
  'knock', 'damper', 'crit', 'gpower', 'cluster',
];
