// @ts-check
// The shop's vending machines (the menu is ui/vendshop.js, the look render/shops.js). Each is an
// entry in SHOPS: where it stands and its hologram. Standing at one shows "Tap R to shop"; the tap
// opens its menu (input.current.shopOpen = its key, the game pauses), and what you buy there comes
// back as input.current.dispense, popped out of the machine's chute onto the floor (stepShops).
// The mod machine is the first; a gun shop and a perk shop are meant to be more entries here.

import { SFX } from '../../audio/sfx.js';
import { CELL, SHOP_FLOOR, SHOP_Y, WW } from '../../core/consts.js';

export const MACHINE_W = 56, MACHINE_H = 84;                   // a machine's cabinet (world units)
export const MACHINE_TOP = SHOP_FLOOR * CELL - MACHINE_H;      // its top
export const CHUTE_Y = SHOP_FLOOR * CELL - 14;           // where a bought thing comes out

/** @typedef {{ x: number, icon: string, hue: string, label: string }} ShopMachine */
/** @type {Record<string, ShopMachine>} */
export const SHOPS = {
  mods: { x: WW / 2, icon: '⚙️', hue: '#4fe3ff', label: 'Tap R to shop' },
};

// the machine you're standing at, if any
/** @param {World} W @param {number} pcx @param {number} pcy @returns {string | null} */
export function shopNear(W, pcx, pcy) {
  if (W.warp || W.repo || W.p.dead || pcy < SHOP_Y || pcy > SHOP_FLOOR * CELL) return null;
  for (const k in SHOPS) if (Math.abs(pcx - SHOPS[k].x) < MACHINE_W / 2 + 2) return k;
  return null;
}

// a tap at a machine: open its menu (App shows it and pauses the game)
/** @param {GameCtx} G @param {string} kind */
export function shopUse(G, kind) {
  G.input.current.shopOpen = kind;
  SFX.ui('mod');
}

// A part of stepPickups: something bought (input.current.dispense) pops out of its machine's
// chute towards you, and anything popping flies and lands on the shop floor. It can't be
// taken until it lands
/** @param {World} W @param {GameCtx} G @param {StepFrame} F */
export function stepShops(W, G, F) {
  const d = G.input.current.dispense;
  if (d) {
    G.input.current.dispense = null;
    const m = SHOPS[d.shop];
    if (m) {
      const side = F.pcx < m.x ? -1 : 1;
      W.pickups.push({ kind: 'mod', id: d.id, x: m.x, y: CHUTE_Y, t: 0,
        vx: side * (95 + Math.random() * 30), vy: -200 - Math.random() * 40, cool: 1 });
      SFX.fx('prompt');
    }
  }
  const floor = SHOP_FLOOR * CELL - 9;
  for (const q of W.pickups) {
    if (q.vy === undefined) continue;
    q.vy += 900 * F.dt;
    q.x += (q.vx || 0) * F.dt; q.y += q.vy * F.dt;
    q.cool = 0.2;
    if (q.y >= floor && q.vy > 0) {
      q.y = floor;
      if (q.vy > 120) { q.vy *= -0.35; q.vx = (q.vx || 0) * 0.6; }   // one little bounce
      else { delete q.vy; delete q.vx; q.cool = 0; q.t = W.time; }
    }
  }
}
