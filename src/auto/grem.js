// @ts-check
// Grem Mode (owner, 2026-10-15): CaveRunner Auto stripped down for a toddler. The title's 🐣 starts it: no hub, one player
// straight into a level that never ends (auto/level.js levelScene's `endless`: after each boss LEVEL CLEARED, then more cave,
// the level + 1). Gold is the only drop. The gun presets (save/presets.js, in their order) are locked; the gold collected pays
// them off one after the other, each dearer than the last (gremPrice): a preset is unlocked once the gold collected reaches
// its running total (gremUnlocked), its outline filling clockwise on the way (gremFill). The 3 extra players join at
// DEV.gremP2 / gremP3 / gremP4 (the level), each with one of the unlocked guns (gremTeamGun). Player 1 starts with the
// kit set in Dev → Grem (exo mods and perks only: gremKit, saved on this device). Pure but for the kit's store.
// The screen: ui/auto/GremScreen.js.

import { DEV } from '../dev/knobs.js';
import { PERKS } from '../data/perks.js';
import { EXO_CATS, EXO_SLOTS, PERK_SLOTS, exoMod, newPlayer, starterKit } from './run.js';
import { mapsOf } from './maps.js';

/** @param {number} v */
const five = v => Math.max(5, Math.round(v / 5) * 5);

// preset i's price (gold; 0 the first): DEV.gremPrice × DEV.gremGrow for each one before it
/** @param {number} i */
export const gremPrice = i => five(DEV.gremPrice * Math.pow(DEV.gremGrow, Math.max(0, i)));
// the gold collected by the time preset i is paid off (its price and every one before it)
/** @param {number} i */
export function gremPaidAt(i) {
  let s = 0;
  for (let k = 0; k <= i; k++) s += gremPrice(k);
  return s;
}
// how many of n presets are unlocked with this much gold collected
/** @param {number} gold @param {number} n */
export function gremUnlocked(gold, n) {
  let k = 0;
  while (k < n && gold >= gremPaidAt(k)) k++;
  return k;
}
// how far preset i is paid (0 none … 1 unlocked): only the next locked one fills; the ones after it are 0
/** @param {number} gold @param {number} i */
export function gremFill(gold, i) {
  const end = gremPaidAt(i), start = end - gremPrice(i);
  return Math.max(0, Math.min(1, (gold - start) / Math.max(1, end - start)));
}

// how many players at a level: 1, + one each at DEV.gremP2, gremP3, gremP4
/** @param {number} tier */
export const gremTeam = tier => Math.min(4, 1 + [DEV.gremP2, DEV.gremP3, DEV.gremP4].filter(lv => tier >= lv).length);
// extra player j (1-3)'s gun among u unlocked presets: the newest for player 2, the one before it for player 3, … (round
// again when there are fewer); -1: none unlocked yet (he keeps his starter gun)
/** @param {number} u @param {number} j */
export const gremTeamGun = (u, j) => (u > 0 ? ((u - j) % u + u) % u : -1);

// ---- player 1's kit (Dev → Grem): exo mods and perks, kept on this device ----
export const GREM_KIT_KEY = 'caverunner-grem-kit';
/** @typedef {{ exo: Record<string, number[]>, perks: (string | null)[] }} GremKit */
/** an empty kit (every exo slot 0: empty; tiers 1-5) @returns {GremKit} */
export const gremKitNew = () => ({ exo: Object.fromEntries(EXO_CATS.map(c => [c, Array(EXO_SLOTS).fill(0)])), perks: Array(PERK_SLOTS).fill(null) });
// whatever was stored → a clean kit (unknown perks and bad tiers dropped)
/** @param {any} k @returns {GremKit} */
export function gremKitClean(k) {
  const out = gremKitNew();
  if (!k || typeof k !== 'object') return out;
  for (const c of EXO_CATS) {
    const a = k.exo && Array.isArray(k.exo[c]) ? k.exo[c] : [];
    out.exo[c] = out.exo[c].map((_, i) => { const t = Math.round(Number(a[i]) || 0); return t >= 1 && t <= 5 ? t : 0; });
  }
  const p = Array.isArray(k.perks) ? k.perks : [];
  out.perks = out.perks.map((_, i) => (typeof p[i] === 'string' && PERKS[p[i]] && !PERKS[p[i]].stat ? p[i] : null));
  return out;
}
/** @returns {GremKit} */
export const gremKitLoad = () => { try { return gremKitClean(JSON.parse(localStorage.getItem(GREM_KIT_KEY) || 'null')); } catch (_) { return gremKitNew(); } };
/** @param {GremKit} k */
export const gremKitSave = k => { try { localStorage.setItem(GREM_KIT_KEY, JSON.stringify(k)); } catch (_) { /* nowhere to keep it */ } };
// the kit fitted to a player (his exo and perk slots replaced)
/** @param {RunPlayer} pl @param {GremKit} kit */
export function gremKitFit(pl, kit) {
  for (const c of EXO_CATS) pl.exo[c] = kit.exo[c].map(t => (t ? exoMod(c, t) : null));
  pl.perks = kit.perks.map(id => (id ? { kind: 'perk', id, n: 1 } : null));
}

// A Grem run: level 1, one player with a starter gun (until the first preset is paid off) and the Dev kit, an empty bag.
// Never saved (a fresh one each time Grem Mode starts, and after a wipe)
/** @param {GremKit} kit @param {() => number} [rnd] @returns {AutoRun} */
export function gremRun(kit, rnd = Math.random) {
  const pl = newPlayer(0);
  pl.guns[0] = starterKit(rnd).gun;
  gremKitFit(pl, kit);
  /** @type {AutoRun} */
  const run = { tier: 1, players: [pl], bag: Array(14).fill(null), seed: 1 + Math.floor(rnd() * 1e6) };
  mapsOf(run);
  return run;
}
