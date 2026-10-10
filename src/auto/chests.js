// @ts-check
// CaveRunner Auto's chests (AUTOBATTLER.md stage 11), pure. chestPlan: DEV.autoChestN chests at random along a level's
// random zones (never on the pads or in the boss arena: those are outside the random zones; in a blocked zone but not
// inside the blockage). The pilot slows past an unopened one (auto/pilot.js, L.chests). While a player is within
// DEV.autoChestR of one, "Tap A to open" shows over it (chestInRange; the painter: game/render/leveldraw.js); A opens it
// (chestOpen): the lid pops, chestRoll's contents spill out (art/titlescene.js titleSpill: gold as nuggets, the rest
// as pickups), bounce, and are vacuumed into the bag as a kill's drops are.

import { PW } from '../core/consts.js';
import { DEV } from '../dev/knobs.js';
import { goldScale } from '../data/creatures.js';
import { rollMod } from '../spells/spawn.js';
import { TCELL, TITLE_VW, titleFloor, titleSolid, titleSpill } from '../art/titlescene.js';
import { EXO_CATS, exoMod } from './run.js';
import { machineItem } from './payout.js';

// LevelChest: world x, y (its floor: settled onto the real ground once the terrain is made, `set`), open, openT (when), items (what spilled)
/** @typedef {{ x: number, y?: number, set?: boolean, open?: boolean, openT?: number, items?: BagItem[] }} LevelChest */

const EDGE = 40;      // kept this far from a random zone's ends (world units)
const BLK_GAP = 24;   // and this far outside a blockage

// mulberry32 (the plan's own random: the level's other rolls are unchanged)
/** @param {number} seed */
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Where the chests are: n of them, one in each of n equal stretches of the random zones, at a random place in it
// (another try if it lands in a blockage or by a zone's flat pad; none found: that one is left out)
/** @param {import('./level.js').LevelPlan} plan @param {number} [n] @returns {LevelChest[]} */
export function chestPlan(plan, n = DEV.autoChestN) {
  const R = rng(plan.seed * 7919 + 11), out = [];
  n = Math.max(0, Math.round(n));
  const z0 = plan.z0 + EDGE, z1 = plan.z1 - EDGE, len = (z1 - z0) / Math.max(1, n);
  const blocked = (/** @type {number} */ x) => plan.zp.z.some(Z => (Z.blk && x > Z.blk.x0 - BLK_GAP && x < Z.blk.x1 + BLK_GAP) || (Z.flat && x > Z.x0 - EDGE && x < Z.x1 + EDGE));
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 30; k++) {
      const x = z0 + (i + 0.15 + R() * 0.7) * len;
      if (!blocked(x)) { out.push({ x }); break; }
    }
  }
  return out;
}

// What a chest holds, rolled on opening: one pick by the weights (DEV.autoChestGold … autoChestGreen): gold
// (DEV.autoChestGoldN × the tier's gold scale), a gun mod (the tier's), an exo mod (a random category, the tier), a red
// gem, a perk (a named one), a green gem
/** @param {() => number} rnd @param {number} tier @returns {BagItem[]} */
export function chestRoll(rnd, tier) {
  const w = [['gold', DEV.autoChestGold], ['mod', DEV.autoChestMod], ['exo', DEV.autoChestExo], ['red', DEV.autoChestRed], ['perk', DEV.autoChestPerk], ['green', DEV.autoChestGreen]];
  const tot = w.reduce((a, [, v]) => a + Math.max(0, +v), 0);
  let r = rnd() * tot, kind = 'gold';
  for (const [k, v] of w) { r -= Math.max(0, +v); if (r < 0) { kind = String(k); break; } }
  const t = Math.max(1, tier);
  if (kind === 'mod') return [{ kind: 'mod', id: rollMod(rnd, t), n: 1 }];
  if (kind === 'exo') return [exoMod(EXO_CATS[Math.floor(rnd() * EXO_CATS.length) % EXO_CATS.length], t)];
  if (kind === 'red' || kind === 'green') return [{ kind, n: 1 }];
  if (kind === 'perk') return [machineItem('perk', t, rnd)];
  return [{ kind: 'gold', n: Math.max(1, Math.round(DEV.autoChestGoldN * goldScale(t) * (0.75 + rnd() * 0.5))) }];
}

/** @param {import('../art/titlescene.js').TitleScene} S @returns {LevelChest[]} */
const chestsOf = S => (S.lvl && S.lvl.data && S.lvl.data.chests) || [];

// Settle each chest on the ground once the terrain under it is made (from the plan's floor, up out of rubble or down onto it)
/** @param {import('../art/titlescene.js').TitleScene} S */
export function chestsStep(S) {
  for (const c of chestsOf(S)) {
    if (c.set) continue;
    if (c.y == null) c.y = titleFloor(c.x, S);
    const sx = c.x - S.scroll;
    if (sx > TITLE_VW + 20 || c.x >= S.gen * TCELL - 8) continue;
    let y = Math.round(c.y);
    if (titleSolid(S, sx, y - 1)) { for (let k = 0; k < 60 && titleSolid(S, sx, y - 1); k++) y--; }
    else { for (let k = 0; k < 60 && !titleSolid(S, sx, y); k++) y++; }
    c.y = y; c.set = true;
  }
}

// The unopened chest a player still in is within DEV.autoChestR of (sideways, world units), the nearest; else null
/** @param {import('../art/titlescene.js').TitleScene} S @returns {LevelChest | null} */
export function chestInRange(S) {
  const L = S.lvl && S.lvl.data;
  if (!L || L.phase === 'arrive') return null;
  let best = null, bd = DEV.autoChestR;
  for (const c of chestsOf(S)) {
    if (c.open) continue;
    for (const r of S.runners) {
      if (r.out || r.hide) continue;
      const d = Math.abs(S.scroll + r.x + PW / 2 - c.x);
      if (d <= bd) { bd = d; best = c; }
    }
  }
  return best;
}

// A pressed in a level: open the chest in range (the lid pops, its contents spill); false if there's none
/** @param {import('../art/titlescene.js').TitleScene} S @returns {boolean} */
export function chestOpen(S) {
  const c = chestInRange(S);
  if (!c) return false;
  c.open = true; c.openT = S.t;
  c.items = chestRoll(S.rnd, S.tier || 1);
  const y = (c.y == null ? titleFloor(c.x, S) : c.y) - 8;
  titleSpill(S, c.x, y, c.items, 1.3);
  S.snd.push({ k: 'coin', x: c.x - S.scroll, y });
  return true;
}
