// CaveRunner Auto: the jetpack's fuel in a level (owner, exo "Jetpack": "Auto and manual player movement needs to adhere to
// jetpack fuel levels and recharge limits"). The old game's rule (src/game/systems/player.js): the tank runs 0..1, jetting
// drains it (FUEL_DRAIN, more at full throttle; a bigger tank drains slower), standing on the ground refills it (FUEL_REGEN
// × the refill), and once dry there's no thrust till it's back to FUEL_RESTART. Near the bottom it coughs (short cut-outs).
// tank / refill: the player's playerStats fuel / refuel (perks and the exo Jetpack folded in). Pure: the scene calls it.
import { FUEL_DRAIN, FUEL_REGEN, FUEL_RESTART } from '../core/consts.js';
import { DEV } from '../dev/knobs.js';
import { sputterStep } from '../core/util.js';

/** @typedef {{ fuel?: number, empty?: boolean, jetSt?: { cut: number, onT: number, start: boolean, gap?: number }, sputN?: number, dry?: boolean, id?: number }} FuelHolder */
// the line under which the autopilot won't take off for a flight of its own (it runs on and refills first)
export const FUEL_TAKEOFF = 0.6;

// can he jet this frame? (dry: not till it's refilled to FUEL_RESTART; a cough: not for its blink)
/** @param {FuelHolder} r */
export const fuelCan = r => !r.empty && !(r.jetSt && r.jetSt.cut > 0);

// a frame of the tank: thr the jet's throttle this frame (0 off), ground standing (refills)
/** @param {FuelHolder} r @param {number} thr @param {boolean} ground @param {number} dt @param {number} [tank] @param {number} [refill] */
export function fuelTick(r, thr, ground, dt, tank = 1, refill = 1) {
  if (r.fuel == null) r.fuel = 1;
  if (r.empty && r.fuel >= FUEL_RESTART) r.empty = false;
  r.dry = false;
  if (thr > 0 && !r.empty) {
    r.fuel -= FUEL_DRAIN * DEV.autoFuelDrain * (0.5 + 0.5 * Math.min(1, thr)) * dt / Math.max(0.1, tank);
    if (r.fuel <= 0) { r.fuel = 0; r.empty = true; r.dry = true; }
  } else if (ground) r.fuel = Math.min(1, r.fuel + FUEL_REGEN * DEV.autoFuelRegen * refill * dt);
  // the cough (owner: the old game's): low and jetting, short cut-outs, the game's own sputterStep (core/util.js); its
  // random is a hash of its own, not the scene's seeded stream. jetSt.start: a cough began this frame (the scene dips him
  // and puffs grey smoke, as the game); r.dry: the tank ran out this frame (the sputter sound)
  const h = () => { const v = Math.sin((r.sputN = (r.sputN || 0) + 1) * 91.17 + (r.id || 0) * 31.7) * 43758.5453; return v - Math.floor(v); };
  sputterStep(r.jetSt || (r.jetSt = { cut: 0, onT: 0, start: false }), dt, r.fuel, thr > 0 && !r.empty, h);
}

// how much tank a climb of `h` (world units, up) wants, with a margin: the autopilot jets over a wall only with this much
/** @param {number} h @param {number} [tank] */
export const fuelForClimb = (h, tank = 1) => Math.min(0.95, FUEL_RESTART + Math.max(0, h) / 110 * FUEL_DRAIN * DEV.autoFuelDrain / Math.max(0.1, tank));
