// @ts-check
// CaveRunner Auto's run model (AUTOBATTLER.md stage 1): the run (tier, up to 4 players, the 70-slot
// bag) and every move on it, as pure functions. Moves change `run` in place and say whether they
// worked; a refused move changes nothing. Prices and scrap values read the Dev knobs (group 'auto').

import { PLAYER_HP } from '../core/consts.js';
import { DEV } from '../dev/knobs.js';
import { goldScale } from '../data/creatures.js';
import { PERKS, STAT_PERKS, perkBag, perkPrice } from '../data/perks.js';
import { stackKey } from '../spells/collection.js';
import { TITLE_COLS } from '../art/titlescene.js';
import { MODS, tierOf } from '../spells/mods.js';
import { resetGun } from '../spells/guns.js';

export const BAG_COLS = 7, BAG_ROWS = 10, BAG_SLOTS = BAG_COLS * BAG_ROWS;
export const MAX_PLAYERS = 4, GUN_SLOTS = 4, EXO_SLOTS = 5, PERK_SLOTS = 6, CARROT_MAX = 5;
/** @type {ExoCat[]} */
export const EXO_CATS = ['hp', 'speed', 'jet', 'carrot'];
// which STAT_PERKS each exo category draws its values from (jet = fuel and recharge together)
/** @type {Record<ExoCat, string[]>} */
export const EXO_STATS = { hp: ['hp'], speed: ['walk'], jet: ['fuel', 'refuel'], carrot: ['carrot'] };
// each category's icon (the bag, the exo machine's hologram): its stat's glyph, but the Jetpack a rocket (owner: ▮ read as a box)
/** @type {Record<string, string>} */
export const EXO_GLYPH = { hp: '♥', speed: '➤', jet: '🚀', carrot: '⌖' };

/** @param {number} v */
const five = v => Math.max(5, Math.round(v / 5) * 5);

// ---- prices (Dev knobs: autoGunBase, autoGunGrow, autoExoPrice, autoScrap, autoRed, autoGreen, autoModGold) ----
/** the gun machine's price at a tier @param {number} tier */
export const autoGunPrice = tier => five(DEV.autoGunBase * Math.pow(DEV.autoGunGrow, Math.max(0, tier - 1)));
/** the exo machine's price at a tier: a share of the gun's @param {number} tier */
export const autoExoPrice = tier => five(autoGunPrice(tier) * DEV.autoExoPrice / 100);

// ---- making things ----
/** @param {ExoCat} cat @param {number} tier 1-5 @returns {BagItem} */
export const exoMod = (cat, tier) => ({ kind: 'exo', cat, tier: Math.max(1, Math.min(EXO_SLOTS, tier | 0)), n: 1 });

/** a new player, the i-th (0-3): its colour, empty slots, full health @param {number} i @returns {RunPlayer} */
export function newPlayer(i) {
  return { col: TITLE_COLS[i % TITLE_COLS.length], guns: [null, null, null, null], active: 0,
    exo: { hp: [null, null, null, null, null], speed: [null, null, null, null, null],
      jet: [null, null, null, null, null], carrot: [null, null, null, null, null] },
    perks: [null, null, null, null, null, null], hp: PLAYER_HP, alive: true };
}

// ---- the starter kit (stage 5a; replaces the Scratch Pistol on this branch) ----
// the shots a starter gun may hold: tier-1 projectiles that hurt on their own (no diggers, teleports or triggers)
export const STARTER_SHOTS = Object.keys(MODS).filter(k => MODS[k].kind === 'shot' && tierOf(k) === 1 && !MODS[k].off
  && !MODS[k].trig && !MODS[k].bore && !MODS[k].tele && k !== 'saw');
// One kit for each new player: a basic gun (3 slots, no shuffle) with a random starter shot in slot 1, and a Buzzsaw
// for the bag (the first blocked way teaches you to drag it in). Its numbers: the Dev tab Auto, "Auto: guns".
/** @param {() => number} [rnd] @returns {{ gun: Gun, saw: BagItem }} */
export function starterKit(rnd = Math.random) {
  const shot = STARTER_SHOTS[Math.floor(rnd() * STARTER_SHOTS.length)];
  const gun = resetGun({ name: 'Starter ' + MODS[shot].name, cap: 3, castDelay: DEV.autoGunDelay, recharge: DEV.autoGunRech,
    manaMax: DEV.autoGunMana, manaRegen: DEV.autoGunRegen, spread: DEV.autoGunSpread, multi: 1, shuffle: false, speedMul: 1,
    mana: DEV.autoGunMana, slots: [shot, null, null], hue: Math.floor(rnd() * 360) });
  return { gun, saw: { kind: 'mod', id: 'saw', n: 1 } };
}
// a player gets its kit: the gun in its first slot (active), the Buzzsaw into the bag
/** @param {AutoRun} run @param {RunPlayer} pl @param {() => number} [rnd] */
function giveKit(run, pl, rnd) {
  const k = starterKit(rnd);
  pl.guns[0] = k.gun; pl.active = 0;
  bagAdd(run, k.saw);
}

/** tier 1, one player with its starter kit (its gun, a Buzzsaw in the bag); seed: the run's levels (levelSeed)
 * @param {number} [seed] @returns {AutoRun} */
export function newRun(seed) {
  /** @type {AutoRun} */
  const run = { tier: 1, players: [newPlayer(0)], bag: Array(BAG_SLOTS).fill(null), seed: seed || 1 + Math.floor(Math.random() * 1e6) };
  giveKit(run, run.players[0]);
  return run;
}

// ---- between levels (stage 4b) ----
/** every player back to full health and alive (each level's start, and home to the hub) @param {AutoRun} run */
export function healRun(run) {
  for (const p of run.players) { p.hp = playerStats(p).maxHp; p.alive = true; }
}
/** the run's level at its tier: the same run's tier n is always the same level @param {AutoRun} run */
export const levelSeed = run => 1 + ((run.seed || 1) * 7919 + run.tier * 104729) % 999983;
/** every player fell in the level (stage 6): home, the tier unchanged, healed (the loot kept) @param {AutoRun} run */
export function levelFailed(run) {
  healRun(run);
}
/** the level's boss is down and the team is home: tier + 1, healed @param {AutoRun} run */
export function levelCleared(run) {
  run.tier++;
  healRun(run);
}

// ---- the bag ----
// two items share a bag slot when this matches (null: never stacks; a gun is one of a kind)
/** @param {BagItem} it @returns {string | null} */
export function itemKey(it) {
  if (it.kind === 'gold' || it.kind === 'red' || it.kind === 'green') return it.kind;
  if (it.kind === 'mod') return 'mod:' + stackKey(it.id || '');
  if (it.kind === 'exo') return 'exo:' + it.cat + ':' + it.tier;
  if (it.kind === 'perk') return 'perk:' + it.id;
  return null;
}

/** how many of a kind the bag holds (gold, red, green: the stacks' total) @param {AutoRun} run @param {ItemKind} kind */
export const bagCount = (run, kind) => run.bag.reduce((s, it) => s + (it && it.kind === kind ? it.n : 0), 0);

// Put an item in the bag: onto its stack if there is one (no limit), else into the first empty
// slot. Returns what didn't fit (null when it all did). The item object may be stored as is.
/** @param {AutoRun} run @param {BagItem} item @returns {BagItem | null} */
export function bagAdd(run, item) {
  if (!item || item.n <= 0) return null;
  const key = itemKey(item);
  if (key) {
    const s = run.bag.find(it => it && itemKey(it) === key);
    if (s) { s.n += item.n; return null; }
  }
  const i = run.bag.indexOf(null);
  if (i < 0) return item;
  if (key) { run.bag[i] = item; return null; }
  // a gun (n is always 1): one slot each
  run.bag[i] = Object.assign({}, item, { n: 1 });
  return item.n > 1 ? Object.assign({}, item, { n: item.n - 1 }) : null;
}

// take one off bag slot i (the whole slot when it's the last): the single item taken, or null
/** @param {AutoRun} run @param {number} i @returns {BagItem | null} */
function takeOne(run, i) {
  const it = run.bag[i];
  if (!it) return null;
  if (it.n > 1) { it.n--; return Object.assign({}, it, { n: 1 }); }
  run.bag[i] = null;
  return it;
}

// Pay n of gold / red / green out of the bag. Not enough: false, nothing taken.
/** @param {AutoRun} run @param {ItemKind} kind @param {number} n @returns {boolean} */
export function spend(run, kind, n) {
  if (n <= 0) return true;
  if (bagCount(run, kind) < n) return false;
  for (let i = 0; i < run.bag.length && n > 0; i++) {
    const it = run.bag[i];
    if (!it || it.kind !== kind) continue;
    const t = Math.min(n, it.n);
    it.n -= t; n -= t;
    if (it.n <= 0) run.bag[i] = null;
  }
  return true;
}

// ---- scrap ----
// what an item (its whole stack) scraps for at a tier: autoScrap% of its price; gems and mods
// have their own knobs (× goldScale(tier)); gold is just gold
/** @param {BagItem} item @param {number} tier @returns {number} */
export function scrap(item, tier) {
  if (!item) return 0;
  const share = DEV.autoScrap / 100, n = item.n || 1;
  /** @type {number} */
  let each;
  switch (item.kind) {
    case 'gold': return n;
    case 'red': each = DEV.autoRed * goldScale(tier); break;
    case 'green': each = DEV.autoGreen * goldScale(tier); break;
    case 'mod': each = DEV.autoModGold * goldScale(tier); break;
    case 'gun': each = autoGunPrice(tier) * share; break;
    case 'exo': each = autoExoPrice(item.tier || tier) * share; break;
    case 'perk': each = perkPrice(item.id || '') * share; break;
    default: each = 0;
  }
  return Math.max(1, Math.round(each)) * n;
}

// Scrap bag slot i (the whole stack) onto the gold stack. False if it's empty or the gold itself.
/** @param {AutoRun} run @param {number} i @returns {number} the gold it made (0: refused) */
export function scrapAt(run, i) {
  const it = run.bag[i];
  if (!it || it.kind === 'gold') return 0;
  const g = scrap(it, run.tier);
  run.bag[i] = null;
  bagAdd(run, { kind: 'gold', n: g });
  return g;
}

// ---- fitting ----
// A mod from bag slot i into a gun's mod slot (player p, gun slot gi, mod slot si). A mod
// already there goes back to the bag; refused (false, nothing changed) if it can't fit.
/** @param {AutoRun} run @param {number} i @param {number} p @param {number} gi @param {number} si @returns {boolean} */
export function fitMod(run, i, p, gi, si) {
  const it = run.bag[i], pl = run.players[p], g = pl && pl.guns[gi];
  if (!it || it.kind !== 'mod' || !g || si < 0 || si >= g.slots.length) return false;
  const old = g.slots[si];
  const before = run.bag.slice(), n = it.n;
  takeOne(run, i);
  if (old && bagAdd(run, { kind: 'mod', id: old, n: 1 })) {
    run.bag = before; it.n = n;
    return false;
  }
  g.slots[si] = it.id || null;
  return true;
}

// A gun's mod back into the bag. False if the slot's empty or the bag is full.
/** @param {AutoRun} run @param {number} p @param {number} gi @param {number} si @returns {boolean} */
export function unfitMod(run, p, gi, si) {
  const pl = run.players[p], g = pl && pl.guns[gi], id = g && g.slots[si];
  if (!id || !g) return false;
  if (bagAdd(run, { kind: 'mod', id, n: 1 })) return false;
  g.slots[si] = null;
  return true;
}

// The gun in bag slot i into player p's gun slot gs; a gun there swaps into the bag slot.
/** @param {AutoRun} run @param {number} i @param {number} p @param {number} gs @returns {boolean} */
export function fitGun(run, i, p, gs) {
  const it = run.bag[i], pl = run.players[p];
  if (!it || it.kind !== 'gun' || !it.gun || !pl || gs < 0 || gs >= GUN_SLOTS) return false;
  const old = pl.guns[gs];
  pl.guns[gs] = it.gun;
  run.bag[i] = old ? { kind: 'gun', gun: old, n: 1 } : null;
  if (!pl.guns[pl.active]) pl.active = gs;
  return true;
}

// An exo mod from bag slot i into player p's slot s of its own category (cat must match the
// item's: an exo mod fits only its own category). One taken off a stack; one there swaps back.
/** @param {AutoRun} run @param {number} i @param {number} p @param {ExoCat} cat @param {number} s @returns {boolean} */
export function fitExo(run, i, p, cat, s) {
  const it = run.bag[i], pl = run.players[p];
  if (!it || it.kind !== 'exo' || it.cat !== cat || !pl || !pl.exo[cat] || s < 0 || s >= EXO_SLOTS) return false;
  return fitInto(run, i, pl.exo[cat], s);
}

// A perk from bag slot i into player p's perk slot s (6). Stat perks (st_*) are exo mods now: refused.
/** @param {AutoRun} run @param {number} i @param {number} p @param {number} s @returns {boolean} */
export function fitPerk(run, i, p, s) {
  const it = run.bag[i], pl = run.players[p];
  if (!it || it.kind !== 'perk' || !it.id || !PERKS[it.id] || PERKS[it.id].stat || !pl || s < 0 || s >= PERK_SLOTS) return false;
  return fitInto(run, i, pl.perks, s);
}

// one of bag slot i into arr[s]; what was there goes back to the bag (refused if it can't)
/** @param {AutoRun} run @param {number} i @param {(BagItem | null)[]} arr @param {number} s */
function fitInto(run, i, arr, s) {
  const it = run.bag[i];
  if (!it) return false;
  const old = arr[s], before = run.bag.slice(), n = it.n;
  const one = takeOne(run, i);
  if (old && bagAdd(run, old)) { run.bag = before; it.n = n; return false; }
  arr[s] = one;
  return true;
}

// Take a fitted gun / exo mod / perk back into the bag. False if empty or the bag is full.
/** @param {AutoRun} run @param {number} p @param {number} gs @returns {boolean} */
export function unfitGun(run, p, gs) {
  const pl = run.players[p], g = pl && pl.guns[gs];
  if (!g || bagAdd(run, { kind: 'gun', gun: g, n: 1 })) return false;
  pl.guns[gs] = null;
  return true;
}
/** @param {AutoRun} run @param {number} p @param {ExoCat} cat @param {number} s @returns {boolean} */
export function unfitExo(run, p, cat, s) {
  const pl = run.players[p], it = pl && pl.exo[cat] && pl.exo[cat][s];
  if (!it || bagAdd(run, it)) return false;
  pl.exo[cat][s] = null;
  return true;
}
/** @param {AutoRun} run @param {number} p @param {number} s @returns {boolean} */
export function unfitPerk(run, p, s) {
  const pl = run.players[p], it = pl && pl.perks[s];
  if (!it || bagAdd(run, it)) return false;
  pl.perks[s] = null;
  return true;
}

// Which of player p's 4 guns fires. False if that slot holds no gun.
/** @param {AutoRun} run @param {number} p @param {number} gs @returns {boolean} */
export function setActive(run, p, gs) {
  const pl = run.players[p];
  if (!pl || !pl.guns[gs]) return false;
  pl.active = gs;
  return true;
}

// A new player (up to 4) for one green gem, with its starter kit: the player, or null (no green, or the team is full).
/** @param {AutoRun} run @returns {RunPlayer | null} */
export function addPlayer(run) {
  if (run.players.length >= MAX_PLAYERS || !spend(run, 'green', 1)) return null;
  const pl = newPlayer(run.players.length);
  run.players.push(pl);
  giveKit(run, pl);
  return pl;
}

// ---- stats ----
// What a player's fitted exo mods add up to: hp adds; speed / fuel / refuel stack additively on
// their excess (two +8% = +16%); carrot adds levels, capped at V.
/** @param {RunPlayer} pl @returns {ExoBonus} */
export function exoBonus(pl) {
  /** @type {ExoBonus} */
  const b = { hpAdd: 0, walk: 1, fuel: 1, refuel: 1, carrot: 0 };
  for (const cat of EXO_CATS) {
    for (const it of pl.exo[cat] || []) {
      if (!it || !it.tier) continue;
      for (const st of EXO_STATS[cat]) {
        const S = STAT_PERKS[st], v = S.vals[it.tier - 1];
        if (st === 'hp') b.hpAdd += v;
        else if (st === 'carrot') b.carrot += v;
        else if (st === 'walk') b.walk += v - 1;
        else if (st === 'fuel') b.fuel += v - 1;
        else if (st === 'refuel') b.refuel += v - 1;
      }
    }
  }
  b.carrot = Math.min(CARROT_MAX, b.carrot);
  return b;
}

// Everything a player's kit adds up to: the fitted perks' perkBag, with the exo bonus folded in
// (exo first, the perks' multipliers on top).
/** @param {RunPlayer} pl @returns {PerkBag} */
export function playerStats(pl) {
  /** @type {string[]} */
  const ids = [];
  for (const it of pl.perks) if (it && it.id && !ids.includes(it.id)) ids.push(it.id);
  const P = perkBag(ids), e = exoBonus(pl);
  P.hpAdd += e.hpAdd;
  P.walk *= e.walk; P.fuel *= e.fuel; P.refuel *= e.refuel;
  P.carrot = Math.min(CARROT_MAX, P.carrot + e.carrot);
  P.maxHp = Math.max(10, Math.round((PLAYER_HP + P.hpAdd) * P.hpMul));
  return P;
}
