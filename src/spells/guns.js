// Guns: making them (makeGun at a level 1-10, caveGun, startingGuns), their names,
// colours and prices, and resetGun / shuffleOrder.

import { COL } from '../core/consts.js';
import { MODS, SEED_SHOTS, famCol } from './mods.js';
import { rollMod } from './spawn.js';

// Every gun gets its own hue, fixed for the run so it works as an identifier.
// Saturation and lightness come from the --gun-s/--gun-l CSS vars (see :root),
// which flip per theme so the same hue stays readable in light and dark —
// measured worst case is ~4.9:1 contrast against every background it lands on.
// A gun made before this field existed (or any gun object missing .hue) falls
// back to a hash of its name, so it still renders — just not stored, so it can
// drift if the name is reused; that only ever happens to old data, never a
// freshly made gun.
export const hueFromName = name => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
};
export const gunHue = g => (g && g.hue != null) ? g.hue : hueFromName(g ? g.name : '');
export const gunColor = g => 'hsl(' + gunHue(g) + ', var(--gun-s), var(--gun-l))';

// Guns are priced off what they actually do: slots to build in, how fast they
// cycle, how much mana they hold, and whether they fire in the order you set.
export function gunPrice(g) {
  const rate = 1 / Math.max(0.05, g.castDelay) + 1 / Math.max(0.1, g.recharge);
  const v = g.cap * 20 + rate * 7 + g.manaMax * 0.1 + g.manaRegen * 0.3
    + (g.multi - 1) * 45 + ((g.speedMul || 1) - 1) * 40 - g.spread * 3
    + (g.shuffle ? -30 : 20);
  return Math.max(45, Math.round(v / 5) * 5);
}

// Every second shop is a gun shop instead of a mod shop.
export const isGunShop = floor => floor % 2 === 0;

// ---- guns ----
export const GUN_A = ['Rusty', 'Bone', 'Cracked', 'Copper', 'Glass', 'Ivory', 'Molten', 'Static',
               'Hollow', 'Ember', 'Quartz', 'Iron', 'Pale', 'Gilded'];
export const GUN_B = ['Pistol', 'Repeater', 'Carbine', 'Scattergun', 'Lance', 'Sidearm',
               'Blaster', 'Cannon', 'Spitter', 'Wand'];

export function shuffleOrder(g) {
  g.order = g.slots.map((_, i) => i);
  if (g.shuffle) for (let i = g.order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [g.order[i], g.order[j]] = [g.order[j], g.order[i]];
  }
}
export function resetGun(g) {
  g.idx = 0; g.delayT = 0; g.rechT = 0;
  shuffleOrder(g);
  return g;
}

// A gun's level (1-10) comes from the floor alone: floor 1 rolls level 1 guns, floor 10
// and beyond roll level 10. Every stat has a worst and a best end. A level 1 gun rolls
// anywhere between them (wild); each level squeezes the roll toward the best end, until a
// level 10 gun lands in the best tenth of every range (a little variance, never junk).
export const GUN_LV_MAX = 10;
export const RARE_GUN = 0.2;                     // chance a cave gun rolls a random higher level
export const GUN_RANGE = {                       // [worst, best]
  cap: [2, 25], castDelay: [1.5, 0.01], recharge: [1.5, 0.01], manaMax: [50, 1000],
  manaRegen: [10, 500], spread: [20, 0], speedMul: [0.5, 2] };
// the colour a gun's level wears: grey through green, blue, purple to gold
export const GUN_LV_COL = ['#9a9a9a', '#d8d8d8', '#5fd35f', '#3fc9a8', '#4aa3ff',
                    '#7a7aff', '#b565ff', '#ff5fcf', '#ff9a2a', '#ffd23c'];
export const gunLvTier = lvl => Math.min(1, Math.max(0, (lvl - 1) / (GUN_LV_MAX - 1)));
export function gunStat(rnd, k, t) {
  const [w, b] = GUN_RANGE[k];
  const f = rnd() * (1 - t) + rnd() * 0.1 * t;       // share of the way from best to worst
  return b + (w - b) * f;
}
// the level of a gun found on this floor: the floor's own, or now and then a rare one
// somewhere between the next level up and 10
export function gunLevel(floor, rnd) {
  const base = Math.min(GUN_LV_MAX, Math.max(1, floor));
  if (base < GUN_LV_MAX && rnd() < RARE_GUN) return base + 1 + Math.floor(rnd() * (GUN_LV_MAX - base));
  return base;
}

// a gun of level `lvl` (the Dev panel's Spawn gun uses it to try deeper floors' guns on floor 1)
export function caveGun(lvl, rnd) {
  return makeGun(rnd, Math.min(GUN_LV_MAX, Math.max(1, Math.floor(lvl))));
}

export function makeGun(rnd, lvl) {
  const t = gunLvTier(lvl);
  const cap = Math.max(2, Math.min(25, Math.round(gunStat(rnd, 'cap', t))));
  const g = {
    name: GUN_A[Math.floor(rnd() * GUN_A.length)] + ' ' + GUN_B[Math.floor(rnd() * GUN_B.length)],
    lvl, cap,
    castDelay: gunStat(rnd, 'castDelay', t),
    recharge: gunStat(rnd, 'recharge', t),
    manaMax: Math.round(gunStat(rnd, 'manaMax', t)),
    manaRegen: Math.round(gunStat(rnd, 'manaRegen', t)),
    spread: gunStat(rnd, 'spread', t),
    speedMul: gunStat(rnd, 'speedMul', t),
    multi: rnd() < 0.1 + t * 0.4 ? 2 : 1,
    shuffle: rnd() < 0.5 * (1 - t),
    slots: new Array(cap).fill(null),
    hue: Math.floor(rnd() * 360),
  };
  // seed it with something that already shoots
  const used = 1 + Math.floor(rnd() * Math.min(cap, 2 + t * 3));
  const spots = g.slots.map((_, i) => i).sort(() => rnd() - 0.5).slice(0, used);
  const asFloor = 1 + t * 5;                  // a high-level gun comes with better mods on it
  spots.forEach((slot, n) => {
    g.slots[slot] = n === 0 ? SEED_SHOTS[Math.floor(rnd() * SEED_SHOTS.length)]
                            : rollMod(rnd, asFloor);
  });
  if (!g.slots.some(id => id && MODS[id].kind === 'shot')) g.slots[spots[0]] = 'bolt';
  g.mana = g.manaMax;
  return resetGun(g);
}

export function startingGuns() {
  // The Scratch Pistol is a weak backup on purpose: slow, thirsty and single-shot, so
  // anything you find on floor 1 is an upgrade over it. It's first in line (selected).
  const pistol = resetGun({ name: 'Scratch Pistol', cap: 3, castDelay: 0.32, recharge: 1.7,
    manaMax: 90, manaRegen: 22, spread: 5, multi: 1, shuffle: false, mana: 90, speedMul: 1,
    slots: ['bolt', null, null], hue: Math.floor(Math.random() * 360) });
  // The Pick Axe holds a Buzzsaw: no travel, a big circular slice right in front that chews
  // rock and shreds anything close. Buzzsaw zeroes cast delay, so recharge (1s) sets the swing.
  const pickaxe = resetGun({ name: 'Pick Axe', cap: 1, castDelay: 0.05, recharge: 1.0,
    manaMax: 120, manaRegen: 60, spread: 0, multi: 1, shuffle: false, mana: 120, speedMul: 1,
    slots: ['saw'], hue: 20 });
  return [pistol, pickaxe, null, null];
}

// the colour a gun wears: its level's colour, or (starter guns, which have no level)
// whatever family its first shot belongs to
export const gunLvCol = g => (g && g.lvl ? GUN_LV_COL[Math.min(GUN_LV_MAX, g.lvl) - 1] : null);
export function gunAccent(g) {
  if (g && g.lvl) return gunLvCol(g);
  if (g) for (const id of g.slots) if (id && MODS[id].kind === 'shot') return famCol(id);
  return COL.bullet;
}
