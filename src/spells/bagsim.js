// @ts-check
// The bag screen's pure side: castGroups / pullSteps (which slots each pull fires),
// groupStats, the trigger-held fire preview (fireSimNew / fireSimStep / fireSimGauges), and
// the stat colouring (statQual, gunModDeltas).

import { effRecharge, gunPassives, planCast } from './cast.js';
import { GUN_RANGE, resetGun } from './guns.js';

// The bag screen's "trigger held down" preview: the Game's own cast loop (cast() and the
// per-frame gun tick) run on a copy of the gun, so the slot lights and the stat bars move at
// the gun's real pace — cast delay between pulls, recharge after the last, mana drained per
// pull and regenerating, a pause when it runs dry. No perks: the gun as it is.
/**
 * @typedef {{ g: Gun, max: number, mana: number, delayT: number, delayMax: number, rechT: number, rechLen: number,
 *   pull: number, lit: { slots: number[], pull: number, t: number } | null, fired: number, shots: Shot[] }} FireSim
 */
/** @param {Gun} gun @returns {FireSim} */
export function fireSimNew(gun) {
  const g = resetGun(Object.assign({}, gun, { slots: gun.slots.slice() }));
  const max = gun.manaMax + gunPassives(gun).manaMax;
  return { g, max, mana: max, delayT: 0, delayMax: 0, rechT: 0, rechLen: 0, pull: 0, lit: null, fired: 0, shots: [] };
}
// the live gauges, 0-1, the same readiness the right stick's rings show
/** @param {FireSim} S */
export function fireSimGauges(S) {
  return { mana: S.max > 0 ? Math.max(0, S.mana / S.max) : 0,
    castDelay: S.delayT > 0 && S.delayMax ? Math.max(0, 1 - S.delayT / S.delayMax) : 1,
    recharge: S.rechT > 0 && S.rechLen ? Math.max(0, 1 - S.rechT / S.rechLen) : 1 };
}

// How close a gun stat is to perfect: 0 at the worst end of its GUN_RANGE, 1 at the best.
// Double cast and cast order are yes/no, so they are 0 or 1.
/** @param {string} k a GS_ROWS stat @param {any} v its value: a number, or shuffle's boolean */
export function statQual(k, v) {
  if (k === 'multi') return v > 1 ? 1 : 0;
  if (k === 'shuffle') return v ? 0 : 1;
  const [w, b] = GUN_RANGE[k];
  return Math.max(0, Math.min(1, (v - w) / (b - w)));
}

// What the mods on a gun do to its own stats, as a change from the gun's bare number.
// Cast delay, spread and shot speed are averaged over every pull of one full cycle
// (spread and speed against the same pull with its modifiers stripped out).
/** @param {Gun} g */
export function gunModDeltas(g) {
  const pas = gunPassives(g);
  const out = { cap: 0, castDelay: 0, recharge: effRecharge(g) - g.recharge,
    manaMax: pas.manaMax, manaRegen: pas.manaRegen, spread: 0, speedMul: 0, multi: 0, shuffle: 0 };
  const sim = resetGun(Object.assign({}, g, { slots: g.slots.slice(), shuffle: false }));
  const plans = [];
  for (let guard = 0; guard < 64 && sim.idx < sim.order.length; guard++) {
    const p = planCast(sim);
    if (p.shots.length) plans.push(p);
    if (p.wrap) break;
  }
  if (!plans.length) return out;
  /** @type {(sh: Shot[], f: string) => number} */
  const avg = (sh, f) => sh.reduce((t, x) => t + (x[f] || 0), 0) / sh.length;
  let d = 0, sp = 0, spd = 0;
  for (const p of plans) {
    const ids = p.defs.map(x => x.id);
    const bare = planCast(resetGun(Object.assign({}, g, { cap: Math.max(1, ids.length), slots: ids.slice(),
      multi: Math.max(1, ids.length), shuffle: false })));
    d += p.delay;
    sp += avg(p.shots, 'spread') - (bare.shots.length ? avg(bare.shots, 'spread') : g.spread);
    const bs = bare.shots.length ? avg(bare.shots, 'speed') : 0;
    spd += bs > 0 ? avg(p.shots, 'speed') / bs - 1 : 0;
  }
  out.castDelay = d / plans.length - g.castDelay;
  out.spread = sp / plans.length;
  out.speedMul = (g.speedMul || 1) * spd / plans.length;
  return out;
}
