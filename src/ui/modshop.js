// @ts-check
// The mod vending machine's ShopDef (ui/vendshop.js): the collection is every mod that can drop,
// by rarity; a red crystal unlocks one off its floor's drop table (crystalRoll), kept across runs
// (saveCollection); "Dispense selected" buys a copy, popped out of the machine (stepShops).

import { saveCollection } from '../save/save.js';
import { crystalRoll, modTiers } from '../spells/collection.js';
import { MODS, famCol, priceOf } from '../spells/mods.js';
import { ModCard } from './cards.js';
import { GunVend } from './gunshop.js';
import { h } from './h.js';
import { CrystalIcon } from './hud.js';
import { VendShop } from './vendshop.js';

const TIER_NAME = ['', 'Common', 'Uncommon', 'Rare', 'Legendary'];

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

// every machine's menu component, by its SHOPS key: the mods' is the collection menu (VendShop),
// the guns' its own (ui/gunshop.js). A new machine: a SHOPS entry and a line here
/** @type {Record<string, (props: { input: { current: GameInput }, close: () => void }) => any>} */
export const SHOP_MENUS = {
  mods: ({ input, close }) => h(VendShop, { def: modShop(input), input, close }),
  guns: GunVend,
};
