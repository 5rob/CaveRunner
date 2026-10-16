// @ts-check
// Grem Mode (owner, 2026-10-15): CaveRunner Auto stripped down for a toddler. The title's 🐣 starts it: no hub, one player
// straight into a level that never ends (auto/level.js levelScene's `endless`: after each boss LEVEL CLEARED, then more cave,
// the level + 1). Gold is the only drop. The gun presets (save/presets.js, in their order) are locked; the gold collected pays
// them off one after the other, each dearer than the last (gremPrice): a preset is unlocked once the gold collected reaches
// its running total (gremUnlocked), its outline filling clockwise on the way (gremFill). The 3 extra players join at
// unlocks too, spread among the guns (gremUnlocks; owner v1.0.90, they joined by level before), each with one of the unlocked
// guns (gremTeamGun). Players take no damage, the creatures toughen a quarter as fast (gremHardTier), gold drops are doubled
// (DEV.gremGold), the dark is lighter (DEV.gremDark). Player 1 starts with the
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

// (owner, v1.0.90) the unlocks in their order: the n presets with the 3 extra players spread evenly among them (player j
// after round(j × n / 4) presets, at least one gun first); gremPrice / gremUnlocked / gremFill count along this list
/** @typedef {{ gun: number } | { player: number }} GremUnlock */
// (owner, v1.0.92) rnd: the guns in a random order (a fresh one each Grem run), the players still where they were
/** @param {number} n @param {() => number} [rnd] @returns {GremUnlock[]} */
export function gremUnlocks(n, rnd) {
  const order = Array.from({ length: n }, (_, i) => i);
  if (rnd) for (let i = n - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [order[i], order[k]] = [order[k], order[i]]; }
  /** @type {GremUnlock[]} */
  const out = [];
  for (let i = 0, j = 1; i <= n; i++) {
    for (; j <= 3 && Math.max(Math.min(1, n), Math.round(j * n / 4)) === i; j++) out.push({ player: j });
    if (i < n) out.push({ gun: order[i] });
  }
  return out;
}
// the first u unlocks of list: the presets open (in the order they opened) and how many players there are (1 + the extra ones)
/** @param {number} u @param {GremUnlock[]} list @returns {{ guns: number[], team: number }} */
export function gremOpen(u, list) {
  const l = list.slice(0, u), guns = [];
  for (const q of l) if ('gun' in q) guns.push(q.gun);
  return { guns, team: 1 + l.filter(q => 'player' in q).length };
}

// (owner, v1.0.90) the creatures' level: each level past 1 counts DEV.gremHard of one (0.25: a quarter of the normal climb)
/** @param {number} tier */
export const gremHardTier = tier => 1 + Math.max(0, tier - 1) * DEV.gremHard;
// (owner, v1.0.92) the guns' damage at a level: × what the creatures' health has grown by (DEV.autoTierHp a level past 1 at
// gremHardTier), DEV.gremDmgScale of it (1: all of it, so the first guns stay as good as at level 1)
/** @param {number} tier */
export const gremDmgMul = tier => 1 + (Math.pow(DEV.autoTierHp, gremHardTier(tier) - 1) - 1) * DEV.gremDmgScale;
// (owner, v1.0.90) a drop's gold × DEV.gremGold (kills; chests: chests.js chestRoll)
/** @param {BagItem} it @returns {BagItem} */
export const gremGold = it => (it.kind === 'gold' ? Object.assign({}, it, { n: Math.max(1, Math.round((it.n || 1) * DEV.gremGold)) }) : it);
// extra player j (1-3)'s gun among u unlocked presets: the newest for player 2, the one before it for player 3, … (round
// again when there are fewer); -1: none unlocked yet (he keeps his starter gun)
/** @param {number} u @param {number} j */
export const gremTeamGun = (u, j) => (u > 0 ? ((u - j) % u + u) % u : -1);

// ---- player 1's kit (Dev → Grem): exo mods and perks, kept on this device ----
export const GREM_KIT_KEY = 'caverunner-grem-kit';
/** @typedef {{ exo: Record<string, number[]>, perks: (string | null)[], names: string[] }} GremKit */
// (owner, v1.0.92) names: the 4 players' name tags (over their heads in Grem; '' none), at most GREM_NAME_MAX letters
export const GREM_NAME_MAX = 12;
/** an empty kit (every exo slot 0: empty; tiers 1-5) @returns {GremKit} */
export const gremKitNew = () => ({ exo: Object.fromEntries(EXO_CATS.map(c => [c, Array(EXO_SLOTS).fill(0)])), perks: Array(PERK_SLOTS).fill(null), names: ['', '', '', ''] });
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
  const nm = Array.isArray(k.names) ? k.names : [];
  out.names = out.names.map((_, i) => (typeof nm[i] === 'string' ? nm[i].slice(0, GREM_NAME_MAX) : ''));
  return out;
}
// (v1.0.94) the kit a device starts with when it has never saved its own (Dev → Grem): a pasted Copy Dev settings
// carries the owner's as JSON between GREM-KIT-JSON-BEGIN / -END, and it goes here as it is (null: an empty kit)
/** @type {any} */
// (v1.0.95) the owner's, from their Copy Dev settings of v1.0.94
export const GREM_KIT_DEFAULT = { exo: { hp: [5, 5, 5, 5, 5], speed: [0, 0, 0, 0, 0], jet: [0, 0, 0, 0, 0] }, perks: ['pinpoint', 'repel', 'gold', null, null, null], names: ['', '', '', ''] };
/** @returns {GremKit} */
export const gremKitLoad = () => { try { const raw = localStorage.getItem(GREM_KIT_KEY); return gremKitClean(raw == null ? GREM_KIT_DEFAULT : JSON.parse(raw)); } catch (_) { return gremKitClean(GREM_KIT_DEFAULT); } };
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

// ---- kept for the test suites (grem branch: the game no longer calls these; the suites set up with them) ----
// preset i's place on that list (for its price)
/** @param {number} i @param {number} n */
export const gremGunAt = (i, n) => gremUnlocks(n).findIndex(u => 'gun' in u && u.gun === i);
