// @ts-check
// The mod vending machine's ShopDef (ui/vendshop.js): the collection is every mod that can drop,
// by rarity; a red crystal unlocks one off its floor's drop table (crystalRoll), kept for the run
// (saveCollection; a death empties it); "Dispense selected" buys a copy, popped out of the machine (stepShops).

import { PERKS, PERK_IDS, ROMAN, STAT_KEYS, STAT_PERKS, perkPrice } from '../data/perks.js';
import { saveCollection, savePerkCollection } from '../save/save.js';
import { crystalRoll, modTiers, perkRoll } from '../spells/collection.js';
import { MODS, famCol, priceOf } from '../spells/mods.js';
import { ModCard, PerkCard } from './cards.js';
import { GunVend } from './gunshop.js';
import { LevelVend } from './levelshop.js';
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
      name: 'red crystal',
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

// The perk machine's ShopDef: the same as the mods', but the collection is every perk, a green
// crystal unlocks one you haven't (perkRoll), and a dispensed perk is carried (fit it in the Bag)
/** @param {{ current: GameInput }} input @returns {import('./vendshop.js').ShopDef} */
export function perkShop(input) {
  const LO = () => input.current.loadout;
  return {
    title: 'Perks',
    groups: [{ label: 'Perks', ids: PERK_IDS.filter(id => !PERKS[id].stat) },
      ...STAT_KEYS.map(s => ({ label: STAT_PERKS[s].name, ids: PERK_IDS.filter(id => PERKS[id].stat === s) }))],
    owned: id => input.current.perkCollection.includes(id),
    tile: id => ({ glyph: PERKS[id].glyph, color: PERKS[id].tint, name: PERKS[id].name,
      mark: PERKS[id].tier ? ROMAN[PERKS[id].tier - 1] : undefined }),
    card: id => h(PerkCard, { id, ingame: true, flow: true }),
    price: id => perkPrice(id),
    gold: () => LO().gold,
    unlock: {
      name: 'green crystal',
      icon: h(CrystalIcon, { size: 28, green: true }),
      count: () => (LO().greens || []).length,
      run: () => {
        const gr = LO().greens || [];
        if (!gr.length) return null;
        const id = perkRoll(Math.random, input.current.perkCollection);
        if (!id) return null;
        gr.shift();
        input.current.perkCollection.push(id);
        savePerkCollection(input.current.perkCollection);
        return id;
      },
    },
    dispense: id => {
      LO().gold -= perkPrice(id);
      input.current.dispense = { shop: 'perks', perk: id };
    },
  };
}

// every machine's menu, by its SHOPS key (game/systems/shops.js)
/** @type {Record<string, (input: { current: GameInput }) => import('./vendshop.js').ShopDef>} */
export const SHOP_DEFS = { mods: modShop, perks: perkShop };

// every machine's menu component, by its SHOPS key: the mods' is the collection menu (VendShop),
// the guns' its own (ui/gunshop.js). A new machine: a SHOPS entry and a line here
/** @type {Record<string, (props: { input: { current: GameInput }, close: () => void }) => any>} */
export const SHOP_MENUS = {
  mods: ({ input, close }) => h(VendShop, { def: modShop(input), input, close }),
  guns: GunVend,
  perks: ({ input, close }) => h(VendShop, { def: perkShop(input), input, close }),
  levels: LevelVend,                   // the level buy machine's floor menu (not a SHOPS machine: game/systems/vend.js)
};
