// @ts-check
// Sound, the pure part: which voice a spell, creature or floor speaks with and how its
// stats bend it (shotSound, creatureSound), which Dev volume knob each sound answers to
// (FX_VOL, knob), and the foliage rustle limiter (rustleStep). The engine is audio/sfx.js.

import { DEV } from '../dev/knobs.js';
import { MODS } from '../spells/mods.js';

// The jet's roar climbs the longer you hold it, levelling off after 3 seconds.
/** @param {number} onT @returns {number} */
export function jetPitch(onT) { return 1 + 0.7 * Math.min(Math.max(onT, 0), 3) / 3; }
export const HEAR_FIRE = 320;                                  // how far off a blaze's crackle carries

// ---- sound ----
// Every sound is synthesised on the spot with the Web Audio API — there are no sound files.
// First the pure part (which voice a spell, creature or floor speaks with, and how its stats
// bend it; tested under Node), then SFX, the engine, which only touches the browser once the
// first tap has unlocked audio. The style is a blend: retro oscillator sweeps for the magic,
// filtered noise and crackle for the organic parts (fire, rock, breath, water).

// A spell's voice is its theme. Anything a trigger variant is built from speaks with its base.
/** @type {Record<string, string>} */
export const SPELL_VOICE = {
  bolt: 'magic', spark: 'magic', spit: 'magic', arrow: 'magic',
  lance: 'pierce', glance: 'pierce',
  slug: 'heavy', eorb: 'energy', esph: 'energy',
  buck: 'scatter', orb: 'bubble', bubble: 'bubble',
  saw: 'saw', disc: 'saw',
  blast: 'lob', cross: 'lob', nuke: 'lob',
  missile: 'fire', fball: 'fire', fbolt: 'fire', flamer: 'fire', meteor: 'fire',
  zap: 'thunder', chain: 'thunder',
  void: 'void', digbolt: 'dig', plasma: 'beam', ldrill: 'beam', pollen: 'spore',
  tele: 'energy', teleshort: 'energy',
  // statics: the explosions make their bang when they go off, so casting one is silent
  boom: 'none', brim: 'none', crystal: 'crystal', dormant: 'crystal', glitter: 'crystal',
  stillc: 'aura', shieldc: 'aura', vigour: 'aura', storm: 'thunder', vacfield: 'void',
};
export const SPELL_VOICES = ['magic', 'pierce', 'heavy', 'energy', 'scatter', 'bubble', 'saw', 'lob',
  'fire', 'thunder', 'void', 'dig', 'beam', 'spore', 'crystal', 'aura', 'none'];
/** @type {(v: number, a: number, b: number) => number} */
export const clampS = (v, a, b) => Math.max(a, Math.min(b, v));
// The recipe for one planned shot, from its FINAL stats — after every modifier has had its
// go. The theme gives it its character; the stats bend it: faster is higher, bigger is lower
// and longer, harder-hitting is louder, homing warbles, explosive/boring shots get grit,
// piercing ones a bright edge, bouncing ones a little "boing", pellets a flam.
/** @param {Shot} sh @returns {{ v: string, pitch: number, vol: number, dur: number, n: number, wob: number, grit: number, bright: number, boing: number }} */
export function shotSound(sh) {
  const id = sh.sid, m = id && MODS[id];
  const v = SPELL_VOICE[(m && m.base) || id] || (sh.still ? 'aura' : 'magic');
  if (sh.still) {
    const r = sh.r || 30;
    return { v, pitch: clampS(Math.pow(40 / r, 0.4), 0.5, 1.8), vol: 0.6, dur: 1, n: 1,
      wob: 0, grit: 0, bright: 0, boing: 0 };
  }
  const speed = sh.beam ? 700 : sh.speed > 0 ? sh.speed : 500;
  const size = Math.max(0.8, sh.size || 2);
  const count = Math.max(1, Math.round(sh.count || 1));
  return {
    v,
    pitch: clampS(Math.pow(speed / 500, 0.3) * Math.pow(2.5 / size, 0.4), 0.35, 2.4),
    vol: clampS(0.35 + 0.16 * Math.log2(1 + Math.max(0.3, sh.dmg || 0) * count), 0.25, 1),
    dur: clampS(Math.pow(size / 2.5, 0.3), 0.7, 1.8),
    n: Math.min(3, count),
    wob: (sh.homing || 0) + (sh.spiral || 0) + (sh.orbit || 0) + (sh.boomer || 0) + (sh.pong || 0) > 0 ? 1 : 0,
    grit: sh.explode || sh.bore || sh.eat || sh.cluster ? 1 : 0,
    bright: sh.pierce > 0 || sh.crit > 0 ? 1 : 0,
    boing: sh.bounce > 0 ? 1 : 0,
  };
}

// Creatures speak by body, with a few overrides where the body alone would be wrong.
/** @type {Record<string, string>} */
export const BODY_VOICE = { drone: 'gibber', crawler: 'chitter', spider: 'chitter', worm: 'slither', blob: 'gurgle', jelly: 'gurgle', skull: 'rattle',
  rat: 'chitter', nest: 'chitter', alien: 'chitter' };
/** @type {Record<string, string>} */
export const CREATURE_TONE = { lohkare: 'growl', hurtta: 'growl', jaatio: 'icy', tuli: 'ember', karpas: 'spore' };
export const CREATURE_VOICES = ['gibber', 'chitter', 'slither', 'gurgle', 'rattle', 'growl', 'icy', 'ember', 'spore'];
/** @param {CreatureKind} k @returns {{ v: string, pitch: number }} */
export function creatureSound(k) {
  const v = CREATURE_TONE[k.id] || BODY_VOICE[k.body] || 'chitter';
  // small things squeak, big ones rumble; quick ones are a touch higher again
  const r = k.r || 9, spd = k.spd || 40;
  const pitch = clampS(Math.pow(9 / r, 0.9) * (spd > 80 ? 1.2 : 1), 0.45, 2);
  return { v, pitch };
}
export const AMB_EVENTS = ['drip', 'critter', 'wind', 'trickle', 'rumble', 'creak', 'chime', 'crack',
  'crackle', 'hiss', 'puff', 'bloop', 'hum', 'clank', 'rattle', 'whisper'];

// Which Dev volume knob each SFX.fx sound answers to (anything not listed is world/props).
/** @type {Record<string, string>} */
export const FX_VOL = { step: 'vStep', land: 'vStep', ignite: 'jetVol',
  open: 'vUi', close: 'vUi', switch: 'vUi', ready: 'vUi', prompt: 'vUi', reelThud: 'vUi', reelTick: 'vUi', place: 'vUi', coinland: 'vUi',
  crit: 'vSpell', chainhop: 'vSpell', split: 'vSpell', cluster: 'vSpell', refresh: 'vSpell', drain: 'vSpell',
  gspend: 'vSpell', saws: 'vSpell', warp: 'vSpell', healtick: 'vSpell', shieldUp: 'vSpell', ghost: 'vSpell',
  absorb: 'vEnemyFire', fizzle: 'vEnemyFire', drip: 'vDrip', sizzle: 'vDrip', splash: 'vDrip' };
/** @param {string} name @returns {string} */
export function fxVolKey(name) { return FX_VOL[name] || 'vWorld'; }
/** @type {(k: string) => number} */
export const knob = k => (DEV[k] == null ? 1 : DEV[k]);

// Brushing through hanging plants. Called once a frame with what you are touching; returns
// how hard to rustle this frame (0 = stay quiet). Grabbing on or pushing into a new plant
// rustles at once; moving about inside them rustles now and then, more often the faster you
// go; hanging still is silent. After any rustle there is a short random pause, so a big clump
// of vines is a run of rustles rather than one per vine per frame. `st` keeps the pause.
/** @param {{ t?: number }} st @param {number} dt @param {unknown} touching @param {unknown} entered @param {number} speed @param {Rnd} [rnd] @returns {number} */
export function rustleStep(st, dt, touching, entered, speed, rnd) {
  rnd = rnd || Math.random;
  st.t = Math.max(0, (st.t || 0) - dt);
  if (!touching || st.t > 0) return 0;
  const s = clampS(speed / 220, 0, 1);
  if (entered) { st.t = 0.16 + rnd() * 0.12; return Math.max(0.55, s); }
  if (speed < 25) return 0;
  st.t = (0.42 - 0.24 * s) * (0.8 + rnd() * 0.5);
  return 0.3 + 0.5 * s;
}
