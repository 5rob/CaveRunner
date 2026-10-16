// @ts-check
// CaveRunner Auto's run model (AUTOBATTLER.md stage 1): the run (tier, up to 4 players, the 70-slot
// bag) and every move on it, as pure functions. Moves change `run` in place and say whether they
// worked; a refused move changes nothing. Prices and scrap values read the Dev knobs (group 'auto').

import { PLAYER_HP } from '../core/consts.js';
import { DEV } from '../dev/knobs.js';
import { STAT_PERKS, perkBag } from '../data/perks.js';
import { stackKey } from '../spells/collection.js';
import { TITLE_COLS } from '../art/titlescene.js';
import { MODS, tierOf } from '../spells/mods.js';
import { resetGun } from '../spells/guns.js';
import { mapsOf } from './maps.js';

export const BAG_COLS = 7, BAG_ROWS = 10, BAG_SLOTS = BAG_COLS * BAG_ROWS;
// (owner, v1.0.49) the bag grows: always BAG_EXTRA empty rows after the lowest row holding something (bagFit), up to
// BAG_MAX slots (only then is it full)
export const BAG_EXTRA = 3, BAG_MAX = BAG_COLS * 100;
/** the bag's slots now: its rows down to the lowest one holding something, + BAG_EXTRA @param {AutoRun} run */
export function bagSize(run) {
  let last = -1;
  for (let i = run.bag.length - 1; i >= 0; i--) if (run.bag[i]) { last = i; break; }
  return Math.min(BAG_MAX, (Math.floor(last / BAG_COLS) + 1 + BAG_EXTRA) * BAG_COLS);
}
/** pad or trim the bag to bagSize (only empty slots go) @param {AutoRun} run */
export function bagFit(run) {
  const want = bagSize(run);
  if (run.bag.length > want) run.bag.length = want;
  while (run.bag.length < want) run.bag.push(null);
}
export const MAX_PLAYERS = 4, GUN_SLOTS = 4, EXO_SLOTS = 5, PERK_SLOTS = 6, CARROT_MAX = 5;
/** @type {ExoCat[]} */
export const EXO_CATS = ['hp', 'speed', 'jet'];   // owner (v1.0.35): Carrot binned (run.exo.carrot stays for old saves)
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

// ---- between levels (stage 4b) ----
/** every player back to full health and alive (each level's start, and home to the hub) @param {AutoRun} run */
export function healRun(run) {
  for (const p of run.players) { p.hp = playerStats(p).maxHp; p.alive = true; }
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
  bagFit(run);
  const i = run.bag.indexOf(null);
  if (i < 0) return item;
  if (key) { run.bag[i] = item; bagFit(run); return null; }
  // a gun (n is always 1): one slot each
  run.bag[i] = Object.assign({}, item, { n: 1 });
  bagFit(run);
  return item.n > 1 ? Object.assign({}, item, { n: item.n - 1 }) : null;
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

// ---- kept for the test suites (grem branch: the game no longer calls these; the suites set up with them) ----
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
  mapsOf(run);
  giveKit(run, run.players[0]);
  bagFit(run);
  return run;
}
/** the run's level at its tier: the same run's tier n is always the same level @param {AutoRun} run */
export const levelSeed = run => 1 + ((run.seed || 1) * 7919 + run.tier * 104729 + (run.map || 0) * 15485863) % 999983;
// A new player (up to 4) with its starter kit: the player, or null (the team is full). (grem: free; it cost a green gem in Auto)
/** @param {AutoRun} run @returns {RunPlayer | null} */
export function addPlayer(run) {
  if (run.players.length >= 4) return null;
  const pl = newPlayer(run.players.length);
  run.players.push(pl);
  giveKit(run, pl);
  return pl;
}
