// @ts-check
// CaveRunner Auto's maps (owner: "how the levels work"). The maps are THEMES in order (data/themes.js; map 0, Mossy
// Caves, is free). Each keeps its own level: reaching the end teleporter takes the active map's level up by 1 (and marks
// it beaten), everyone falling resets it to 1. The difficulty and the rewards follow the active map: mapTier = level +
// map × DEV.autoMapStep, written to run.tier (syncTier) so everything that reads run.tier keeps working. Map i + 1 is
// bought at the hub's map machine with gold (mapPrice), only once map i is beaten; only the next locked map takes gold.
// (Every map still plays as today's cave: only the name, the progress and the difficulty differ.)

import { DEV } from '../dev/knobs.js';
import { THEMES } from '../data/themes.js';

// the maps' names, in Title Case ("Mossy caves" → "Mossy Caves")
export const MAP_NAMES = THEMES.map(t => t.name.replace(/\b\w/g, c => c.toUpperCase()));

/** @param {number} i @returns {MapProgress} */
const fresh = i => ({ level: 1, best: 0, beaten: false, paid: 0, owned: i === 0 });

// the run's maps, made (or padded to every map) if missing: an old save's run.tier t becomes map 0 at level t
/** @param {AutoRun} run @returns {MapProgress[]} */
export function mapsOf(run) {
  if (!Array.isArray(run.maps)) {
    const t = Math.max(1, run.tier | 0 || 1);
    run.maps = [{ level: t, best: t - 1, beaten: t > 1, paid: 0, owned: true }];
    run.map = 0;
  }
  while (run.maps.length < MAP_NAMES.length) run.maps.push(fresh(run.maps.length));
  if (!(run.map >= 0 && run.map < run.maps.length && run.maps[run.map].owned)) run.map = 0;
  return run.maps;
}

// the effective tier: the active map's level + its index × DEV.autoMapStep
/** @param {AutoRun} run */
export function mapTier(run) {
  const m = mapsOf(run)[run.map || 0];
  return m.level + (run.map || 0) * DEV.autoMapStep;
}
// run.tier from the active map (call after anything changes the map or its level)
/** @param {AutoRun} run */
export function syncTier(run) { run.tier = mapTier(run); return run.tier; }

// what map i costs: 0 for map 0, DEV.autoMapPrice for map 1, × DEV.autoMapGrow each map after
/** @param {number} i */
export const mapPrice = i => (i <= 0 ? 0 : Math.round(DEV.autoMapPrice * Math.pow(DEV.autoMapGrow, i - 1)));

// the first map not owned (-1 all owned)
/** @param {AutoRun} run */
export const nextLocked = run => mapsOf(run).findIndex(m => !m.owned);

// map i at the machine: 'owned', 'buy' (the next locked map, its previous one beaten: it takes gold), 'beat' (the next
// locked map, its previous not beaten yet), 'locked' (further on)
/** @param {AutoRun} run @param {number} i @returns {'owned' | 'buy' | 'beat' | 'locked'} */
export function mapState(run, i) {
  const ms = mapsOf(run), m = ms[i];
  if (!m) return 'locked';
  if (m.owned) return 'owned';
  if (i !== nextLocked(run)) return 'locked';
  return ms[i - 1] && ms[i - 1].beaten ? 'buy' : 'beat';
}

// n gold into the next locked map (only if it can be bought); full, it's owned. The change (all of n if nothing takes it)
/** @param {AutoRun} run @param {number} n @returns {number} */
export function payMap(run, n) {
  const i = nextLocked(run);
  if (i < 0 || mapState(run, i) !== 'buy' || n <= 0) return Math.max(0, n);
  const m = run.maps[i], price = mapPrice(i), take = Math.min(n, price - m.paid);
  m.paid += take;
  if (m.paid >= price) { m.owned = true; m.paid = price; }
  return n - take;
}

// make owned map i the active one (false: not owned)
/** @param {AutoRun} run @param {number} i */
export function selectMap(run, i) {
  const m = mapsOf(run)[i];
  if (!m || !m.owned) return false;
  run.map = i;
  syncTier(run);
  return true;
}

// the end teleporter reached: the active map's level + 1, beaten, its best
/** @param {AutoRun} run */
export function mapCleared(run) {
  const m = mapsOf(run)[run.map || 0];
  m.best = Math.max(m.best, m.level);
  m.level++;
  m.beaten = true;
  syncTier(run);
}
// everyone fell: the active map back to level 1
/** @param {AutoRun} run */
export function mapFailed(run) {
  mapsOf(run)[run.map || 0].level = 1;
  syncTier(run);
}

// the pause menu's label: "Mossy Caves Lv 3"
/** @param {AutoRun} run */
export const mapLabel = run => MAP_NAMES[run.map || 0] + ' Lv ' + mapsOf(run)[run.map || 0].level;
