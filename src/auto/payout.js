// @ts-check
// CaveRunner Auto stage 10b: the hub's machines pay out. What's been thrown into a machine (auto/throw.js) is the run's
// (run.paid: { gun, exo, mod, perk }, saved with it, so it survives leaving the hub and a reload). Paid in full
// (machinePay), the machine shakes and its lights race for PAY_CYCLE s (stepPay; the painter: game/render/hubdraw.js),
// then spits the item out (machineItem): it lands on the floor, lies PAY_REST s (feedback round 1: the old shop's spit and
// land), then flies into the bag as the level's loot does (S.loot, art/titlescene.js
// stepLoot through S.hub's fits/take); the bag full, it waits on the floor. The change carries over.

import { PERKS } from '../data/perks.js';
import { shopGun } from '../spells/gunshop.js';
import { crystalRoll } from '../spells/collection.js';
import { EXO_CATS, exoMod } from './run.js';
import { hubPrice } from './hub.js';

export const PAY_CYCLE = 1.6;        // a paid machine shakes this long before it spits the item out (s)
const SHAKE_F0 = 3, SHAKE_F1 = 30;   // the shake's frequency (Hz): F0 at the start, F0 + F1 at the pop (game/systems/shops.js)

// how far round its shake a machine is, t s in (the old crystal machine's shakePhase, over PAY_CYCLE)
/** @param {number} t */
export const payPhase = t => SHAKE_F0 * t + SHAKE_F1 * PAY_CYCLE * Math.pow(Math.min(1, t / PAY_CYCLE), 3) / 3;

// what machine id owes at a tier: n items (whole prices paid) and the change left (paid − price × n)
/** @param {{ paid?: Record<string, number> }} run @param {string} id @param {number} tier @returns {{ n: number, left: number, price: number }} */
export function machinePay(run, id, tier) {
  const p = hubPrice(id, tier), paid = (run.paid && run.paid[id]) || 0;
  if (!p || p.n <= 0) return { n: 0, left: paid, price: 0 };
  const n = Math.floor(paid / p.n);
  return { n, left: paid - n * p.n, price: p.n };
}

// the perks a perk machine gives: the named ones (not the stat perks, those are the exo mods')
const GIFT_PERKS = Object.keys(PERKS).filter(id => !PERKS[id].stat && !PERKS[id].off);

// the item machine id spits out at a tier: the gun machine a gun at the tier's level (shopGun), the exo machine an exo
// mod of the tier (a random category), the mod machine a mod (crystalRoll, repeats allowed), the perk machine a perk
/** @param {string} id @param {number} tier @param {() => number} rnd @returns {BagItem | null} */
export function machineItem(id, tier, rnd) {
  const t = Math.max(1, tier | 0);
  if (id === 'gun') return { kind: 'gun', gun: shopGun(rnd, t, false), n: 1 };
  if (id === 'exo') return exoMod(EXO_CATS[Math.floor(rnd() * EXO_CATS.length) % EXO_CATS.length], t);
  if (id === 'mod') { const m = crystalRoll(rnd, t, []); return m ? { kind: 'mod', id: m, n: 1 } : null; }
  if (id === 'perk') return { kind: 'perk', id: GIFT_PERKS[Math.floor(rnd() * GIFT_PERKS.length) % GIFT_PERKS.length], n: 1 };
  return null;
}

