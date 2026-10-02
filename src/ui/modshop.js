// @ts-check
// The mod vending machine's ShopDef (ui/vendshop.js): the collection is every mod that can drop,
// by rarity; a red crystal unlocks one off its floor's drop table (crystalRoll), kept across runs
// (saveCollection); "Dispense selected" buys a copy, popped out of the machine (stepShops).
// And the red crystal's picture, for the unlock button and the pickup card.

import { saveCollection } from '../save/save.js';
import { crystalRoll, modTiers } from '../spells/collection.js';
import { MODS, famCol, priceOf } from '../spells/mods.js';
import { ModCard } from './cards.js';
import { h } from './h.js';

const TIER_NAME = ['', 'Common', 'Uncommon', 'Rare', 'Legendary'];

// A red crystal: gold's lumpy nugget, bigger, dark red, white glints (CRYSTAL_PAL in art/sprites.js)
/** @param {{ size?: number }} props */
export function CrystalIcon({ size }) {
  const s = size || 26;
  return h('svg', { className: 'crystal', viewBox: '0 0 24 24', width: s, height: s, 'aria-hidden': true },
    h('path', { d: 'M12 2.5 L19.5 6 L21.5 13 L17 20.5 L8.5 21.5 L3 15.5 L4 7.5 Z', fill: '#2a0306' }),
    h('path', { d: 'M12 3.6 L18.8 6.7 L20.4 13 L16.4 19.6 L8.9 20.5 L4 15.1 L5 8 Z', fill: '#6e0a12' }),
    h('path', { d: 'M5.6 8.4 L12 4.4 L17.6 7.3 L13.5 11.5 L7 12.2 Z', fill: '#a3162a' }),
    h('rect', { x: 7.4, y: 7.2, width: 2.6, height: 2.6, fill: '#fff' }),
    h('rect', { x: 14.2, y: 13.6, width: 1.5, height: 1.5, fill: '#fff' }));
}

/** @param {{ current: GameInput }} input @returns {import('./vendshop.js').ShopDef} */
export function modShop(input) {
  const LO = () => input.current.loadout;
  return {
    title: 'Mods',
    groups: modTiers().map(g => ({ label: TIER_NAME[g.tier], ids: g.ids })),
    owned: id => input.current.collection.includes(id),
    tile: id => ({ glyph: MODS[id].glyph, color: famCol(id), name: MODS[id].name }),
    card: id => h(ModCard, { id, ingame: true, flow: true }),
    price: id => priceOf(id),
    gold: () => LO().gold,
    unlock: {
      icon: h(CrystalIcon, { size: 28 }),
      count: () => (LO().crystals || []).length,
      run: () => {
        const cr = LO().crystals || [];
        if (!cr.length) return null;
        const id = crystalRoll(Math.random, cr[0], input.current.collection);
        if (!id) return null;
        cr.shift();
        input.current.collection.push(id);
        saveCollection(input.current.collection);
        return id;
      },
    },
    dispense: id => {
      LO().gold -= priceOf(id);
      input.current.dispense = { shop: 'mods', id };
    },
  };
}

// every machine's menu, by its SHOPS key (game/systems/shops.js)
/** @type {Record<string, (input: { current: GameInput }) => import('./vendshop.js').ShopDef>} */
export const SHOP_DEFS = { mods: modShop };
