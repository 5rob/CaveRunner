// @ts-check
// The context nav (AUTOBATTLER.md stage 8a): the row between the play area and the bag, as a small state machine.
// players → a player's menu (Guns / Exo suit / Perks / Stats) → guns (its 4 gun slots) → a gun (its mod slots);
// exo → a category (Max Health / Movement Speed / Jetpack / Carrot) → its 5 slots; perks (6 slots); stats (stage 9).
// navOpen goes one level down (a tapped cell's `open`), navBack one up (B; at the top it does nothing). navRow says
// what the row shows. Pure: the state is a plain object, every move returns a new one.

import { EXO_CATS, EXO_GLYPH } from './run.js';

/** @typedef {'players' | 'player' | 'guns' | 'gun' | 'exo' | 'cat' | 'perks' | 'stats'} NavLevel */
/** @typedef {{ level: NavLevel, p: number, g: number, cat: ExoCat }} NavState */
/**
 * One cell of the row: a circle (a choice) or a square slot. `open` is what navOpen takes when it's tapped (none: a tap
 * does nothing); `item` a slot's fitted thing (a BagItem, the bag's tile look); `gun` a gun circle's gun.
 * @typedef {{ key: string, glyph?: string, label?: string, col?: string, gun?: Gun | null, item?: BagItem | null,
 *   dim?: boolean, sel?: boolean, open?: string | number,
 *   icon?: string, helm?: boolean }} NavCell
 */
/** @typedef {{ shape: 'circles' | 'slots' | 'stats', cells: NavCell[], col: string | null }} NavRow */

/** the player menu's four choices */
export const NAV_MENU = [
  { open: 'guns', glyph: '🔫', label: 'Guns' },
  { open: 'exo', glyph: '🧑‍🚀', label: 'Exo suit' },
  { open: 'perks', glyph: '⭐', label: 'Perks' },
  { open: 'stats', glyph: '📈', label: 'Stats' },
];
/** the exo categories' names @type {Record<ExoCat, string>} */
export const EXO_NAMES = { hp: 'Max Health', speed: 'Movement Speed', jet: 'Jetpack', carrot: 'Carrot' };

/** the top: the player row @returns {NavState} */
export const navStart = () => ({ level: 'players', p: -1, g: 0, cat: 'hp' });

/** @type {Record<NavLevel, NavLevel | null>} one level up */
const UP = { players: null, player: 'players', guns: 'player', gun: 'guns', exo: 'player', cat: 'exo', perks: 'player', stats: 'player' };

/**
 * A tapped cell's `open`, one level down; refused (the same state back) when it leads nowhere: a locked player, an
 * empty gun slot, a slot level.
 * @param {NavState} nav @param {string | number} what @param {AutoRun} run @returns {NavState}
 */
export function navOpen(nav, what, run) {
  const L = nav.level;
  if (L === 'players') return typeof what === 'number' && run.players[what] ? { ...nav, level: 'player', p: what } : nav;
  if (L === 'player') return what === 'guns' || what === 'exo' || what === 'perks' || what === 'stats' ? { ...nav, level: what } : nav;
  if (L === 'guns') {
    const pl = run.players[nav.p];
    return typeof what === 'number' && pl && pl.guns[what] ? { ...nav, level: 'gun', g: what } : nav;
  }
  if (L === 'exo') {
    const cat = EXO_CATS.find(c => c === what);
    return cat ? { ...nav, level: 'cat', cat } : nav;
  }
  return nav;
}

/** B: one level up; at the top, nothing @param {NavState} nav @returns {NavState} */
export function navBack(nav) {
  const up = UP[nav.level];
  return up ? { ...nav, level: up } : nav;
}

/**
 * What the row shows for a state: the cells and the tapped player's colour (null at the top). The player's
 * deeper levels fall back to the top if that player is gone (a new run under the same screen).
 * @param {NavState} nav @param {AutoRun} run @param {number} max the row's circles at the top (MAX_PLAYERS) @returns {NavRow}
 */
export function navRow(nav, run, max) {
  const pl = run.players[nav.p];
  if (nav.level === 'players' || !pl) {
    return { shape: 'circles', col: null, cells: Array.from({ length: max }, (_, i) => {
      const q = run.players[i];
      return q ? { key: 'p' + i, label: String(i + 1), helm: true, col: q.col, sel: i === nav.p, open: i } : { key: 'p' + i, dim: true };
    }) };
  }
  const col = pl.col;
  if (nav.level === 'player') return { shape: 'circles', col, cells: NAV_MENU.map(m => ({ key: m.open, icon: m.open, glyph: m.glyph, label: m.label, col, open: m.open })) };
  if (nav.level === 'guns') {
    return { shape: 'circles', col, cells: pl.guns.map((g, i) => ({ key: 'g' + i, gun: g, col, dim: !g, sel: !!g && i === pl.active, open: g ? i : undefined })) };
  }
  if (nav.level === 'gun') {
    const g = pl.guns[nav.g];
    const slots = g ? g.slots : [];
    return { shape: 'slots', col, cells: slots.map((id, i) => ({ key: 's' + i, item: id ? { kind: 'mod', id, n: 1 } : null })) };
  }
  if (nav.level === 'exo') {
    return { shape: 'circles', col, cells: EXO_CATS.map(c => ({ key: c, icon: c, glyph: EXO_GLYPH[c], label: EXO_NAMES[c], col, open: c })) };
  }
  if (nav.level === 'cat') return { shape: 'slots', col, cells: pl.exo[nav.cat].map((it, i) => ({ key: 'x' + i, item: it })) };
  if (nav.level === 'perks') return { shape: 'slots', col, cells: pl.perks.map((it, i) => ({ key: 'k' + i, item: it })) };
  return { shape: 'stats', col, cells: [] };
}
