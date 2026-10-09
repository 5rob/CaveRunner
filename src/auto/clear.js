// @ts-check
// CaveRunner Auto's clearing rule (AUTOBATTLER.md section 2, stage 5b), pure: which of a player's guns can clear
// what blocks the way. Read from the real MODS: a shot or modifier that bores, eats rock or blows up
// clears rock; one that sets things alight burns webs and timber (and anything that cuts or blows up breaks
// through those too). A modifier's own numbers come from running its `f` on a blank shot.

import { DEV } from '../dev/knobs.js';
import { MODS } from '../spells/mods.js';

/** @type {Record<string, any>} */
const MM = MODS;

// what can block the way: rock (walls, roofs, the ground), webs and fallen timber (stage 6b's blocked zones)

export const CLEAR_BLOCKS = ['rock', 'web', 'timber'];

// one mod's digging numbers: bore, eat, pit, explode (a blast field's radius counts as explode), fire
/** @param {string} id @returns {{ bore: number, eat: number, pit: number, explode: number, fire: number }} */
export function clearPower(id) {
  const M = MM[id];
  if (!M) return { bore: 0, eat: 0, pit: 0, explode: 0, fire: 0 };
  /** @type {any} */
  const s = { dmg: M.dmg || 0, speed: M.speed || 0, spread: M.spread || 0, size: M.size || 2, life: M.life || 1, count: 1, recoil: 0,
    grav: M.grav || 0, drag: M.drag || 0, explode: M.explode || 0, pit: M.pit || 0, fire: M.fire || 0, bounce: M.bounce || 0,
    bounceE: 0.5, pierce: 0, homing: 0, accel: 0, vmax: 0, bore: M.bore || 0, r: M.r || 0, pull: 0, eat: M.eat || 0, pop: 0 };
  if (M.kind !== 'shot' && M.f) { try { M.f(s); } catch (e) { /* a modifier that needs more than a blank shot: no digging */ } }
  if (M.field === 'explode') s.explode = Math.max(s.explode, M.r || 0);
  /** @param {any} v */
  const n = v => (Number.isFinite(v) && v > 0 ? v : 0);
  return { bore: n(s.bore), eat: n(s.eat), pit: n(s.pit), explode: n(s.explode), fire: n(s.fire) };
}

// how well one mod clears that block (0: not at all)
/** @param {string} id @param {string} block */
export function modClear(id, block) {
  const p = clearPower(id), cut = p.bore * 3 + p.eat + p.explode * 0.5;   // (a pit is only a scorch mark where a shot lands: not clearing)
  if (block === 'rock') return cut;
  return p.fire * DEV.autoClearFire + cut;          // web, timber: fire burns them; anything that cuts or blows up breaks through
}

// how well a gun clears that block: its mods' scores added (0: it can't; below DEV.autoClearMin counts as can't)
/** @param {Gun | null | undefined} gun @param {string} block @returns {number} */
export function canClear(gun, block) {
  if (!gun || !gun.slots) return 0;
  let k = 0;
  for (const id of gun.slots) if (id) k += modClear(id, block);
  return k >= DEV.autoClearMin ? k : 0;
}

// the best of a player's guns for that block: its index, or -1 if none can
/** @param {RunPlayer} player @param {string} block */
export function bestClearer(player, block) {
  let best = -1, bk = 0;
  (player.guns || []).forEach((g, i) => { const k = canClear(g, block); if (k > bk) { bk = k; best = i; } });
  return best;
}

// who on the team clears it: that player first (`me`), else the first other player in play who can; null: no one
/** @param {RunPlayer[]} team @param {string} block @param {number} me @returns {{ p: number, g: number } | null} */
export function teamClearer(team, block, me) {
  const order = [me, ...team.map((_, i) => i).filter(i => i !== me)];
  for (const p of order) {
    const pl = team[p];
    if (!pl || pl.alive === false) continue;
    const g = bestClearer(pl, block);
    if (g >= 0) return { p, g };
  }
  return null;
}
