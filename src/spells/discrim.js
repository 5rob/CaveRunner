// @ts-check
// Discriminate (the 'discrim' mod, LIST3 #11), the pure side. A copy is unset ('discrim', does nothing)
// until you pick its target once with the world pointer (game/systems/gun.js); the set copy is then its
// own id, 'discrim:<kind>:<id>', registered into MODS on demand (ensureMod) like a trigger variant, so
// every MODS[id] lookup, the Bag's stacks (stackKey) and the save keep working on plain strings.
// Its f() puts the target on the next spell's shot (`only`); the bullet loop then touches only that.
import { CREATURES } from '../data/creatures.js';
import { FAMILY_OF, MODS, MOD_PRICE, MOD_TIER } from './mods.js';

const PRE = 'discrim:';

/** the id of a copy set on `t` (registered) @param {DiscrimTarget} t @returns {string} */
export function discrimId(t) {
  const id = PRE + t.kind + ':' + t.id;
  ensureMod(id);
  return id;
}

// Makes sure MODS has this id: a targeted Discriminate is made on first sight (a save, a new target).
// True when MODS[id] exists afterwards
/** @param {string | null | undefined} id @returns {boolean} */
export function ensureMod(id) {
  if (!id) return false;
  if (MODS[id]) return true;
  if (!id.startsWith(PRE)) return false;
  const [kind, ...rest] = id.slice(PRE.length).split(':');
  const tid = rest.join(':');
  if ((kind !== 'creature' && kind !== 'player' && kind !== 'object') || !tid) return false;
  /** @type {DiscrimTarget} */
  const tgt = { kind, id: tid };
  const b = MODS.discrim;
  MODS[id] = Object.assign({}, b, { id, base: 'discrim', off: 1, tgt,
    name: 'Discriminate → ' + targetName(tgt),
    info: 'The next spell touches only ' + targetName(tgt) + ', and passes through everything else (it still stops at rock, without digging or burning it)',
    f: (/** @type {Shot} */ s) => { s.only = tgt; } });
  FAMILY_OF[id] = FAMILY_OF.discrim;
  MOD_PRICE[id] = MOD_PRICE.discrim;
  MOD_TIER[id] = MOD_TIER.discrim;
  return true;
}

/** a copy's target, or null (unset, or not a Discriminate) @param {string | null | undefined} id */
export const targetOf = id => (id && MODS[id] && MODS[id].tgt) || null;

/** is this an unset Discriminate (one you can still aim)? @param {string | null | undefined} id */
export const isUnsetDiscrim = id => id === 'discrim';

// Does a thing match the target? `thing` is { kind, id } like a target (a creature: its kind's id;
// you: 'player'; a prop: its k; a pickup: its kind). No target = everything matches
/** @param {DiscrimTarget | null | undefined} t @param {{ kind: string, id: string }} thing */
export function matchesTarget(t, thing) {
  if (!t) return true;
  return t.kind === thing.kind && t.id === thing.id;
}

// The little icon of a target, drawn inside the mod tile: a creature by its body, you the astronaut,
// an object by what it is
const BODY_ICON = { jelly: '🪼', drone: '🤖', spider: '🕷', alien: '👽', rat: '🐀', nest: '🪺',
  crawler: '🐾', worm: '🪱', blob: '🟢', skull: '💀' };
const OBJ_ICON = { barrel: '🛢', pod: '🫛', lamp: '🏮', cover: '🧱', crystal: '💎', mod: '✦', gun: '🔫',
  heart: '❤', heal: '✚', perk: '★', noise: '🪨', spike: '🔺', drop: '🧊', climb: '🌿' };
/** @param {DiscrimTarget} t @returns {string} */
export function targetIcon(t) {
  if (t.kind === 'player') return '👨‍🚀';
  if (t.kind === 'creature') {
    const c = CREATURES[t.id];
    return (c && BODY_ICON[c.body]) || (c ? c.name.slice(0, 2) : '?');
  }
  return OBJ_ICON[t.id] || t.id.slice(0, 2);
}
/** @param {DiscrimTarget} t @returns {string} */
export function targetName(t) {
  if (t.kind === 'player') return 'You';
  if (t.kind === 'creature') { const c = CREATURES[t.id]; return c ? c.name : t.id; }
  return t.id.charAt(0).toUpperCase() + t.id.slice(1);
}
