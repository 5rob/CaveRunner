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
import { hubPrice, hubStopX } from './hub.js';
import { lootCol } from './loot.js';

export const PAY_CYCLE = 1.6;        // a paid machine shakes this long before it spits the item out (s)
const PAY_REST = 0.45;               // the item lands on the floor and lies this long before the player pulls it in (s)
/** @type {import('./hub.js').HubStopId[]} */
const PAY_IDS = ['gun', 'exo', 'mod', 'perk'];
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
const GIFT_PERKS = Object.keys(PERKS).filter(id => !PERKS[id].stat);

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

// One step of the machines (hubStep calls it): a machine paid in full starts shaking (H.vend[id] = when); PAY_CYCLE
// later the price comes off H.paid (the run's) and the item pops out of its tray into S.loot, thrown up and toward
// the middle, then vacuumed into the bag. H.paidV + 1 whenever H.paid changes (the screen saves the run)
/** @param {import('../art/titlescene.js').TitleScene} S @param {import('./hub.js').HubState} H */
export function stepPay(S, H) {
  for (const id of PAY_IDS) {
    const at = H.vend[id];
    if (at === undefined || at < 0) {
      if (machinePay({ paid: H.paid }, id, H.tier).n > 0) { H.vend[id] = S.t; S.snd.push({ k: 'arc', x: hubStopX(id), y: H.fy - 40 }); }
      continue;
    }
    if (S.t - at < PAY_CYCLE) continue;
    H.vend[id] = -1;
    const due = machinePay({ paid: H.paid }, id, H.tier);
    if (due.n <= 0) continue;
    H.paid[id] = due.left; H.paidV++;
    const x = hubStopX(id);
    for (let k = 0; k < due.n; k++) {
      const it = machineItem(id, H.tier, S.rnd);
      if (!it) continue;
      const vx = (x < 300 ? 1 : -1) * (30 + 40 * S.rnd());
      (S.loot || (S.loot = [])).push({ x, y: H.fy - 14, vx, vy: -150 - 40 * S.rnd(), it, col: lootCol(it), t: 0, land: PAY_REST + 0.15 * k });
    }
    S.flash = Math.max(S.flash, 0.25);
    S.snd.push({ k: 'coin', x, y: H.fy - 14 });
  }
}
