// @ts-check
// The bag screen's pure side: castGroups / pullSteps (which slots each pull fires),
// groupStats, the trigger-held fire preview (fireSimNew / fireSimStep / fireSimGauges), and
// the stat colouring (statQual, gunModDeltas).

import { shotPellets, shotPower } from './advisor.js';
import { effRecharge, gunPassives, planCast } from './cast.js';
import { GUN_RANGE, resetGun, shuffleOrder } from './guns.js';
import { MODS } from './mods.js';

// Which slots come out together on one pull. A modifier lands in the same group
// as the shots it modifies, which is exactly what the outline in the build screen
// draws. Null means the order is shuffled, so there is nothing fixed to show.
/** @typedef {{ from: number, to: number, wrapped: boolean, shots: number, plan: Plan }} CastGroup the slots from..to, one pull */
/** @param {Gun} gun @returns {CastGroup[] | null} */
export function castGroups(gun) {
  if (gun.shuffle) return null;
  const sim = resetGun(Object.assign({}, gun, { slots: gun.slots.slice() }));
  const groups = [];
  for (let guard = 0; guard < 64; guard++) {
    const from = sim.idx;
    if (from >= sim.order.length) break;
    const plan = planCast(sim);
    let to = sim.idx;
    const wrapped = to <= from;              // a multicast that ran back to the front
    if (wrapped) to = sim.order.length;
    if (plan.shots.length) groups.push({ from, to, wrapped, shots: plan.shots.length, plan });
    if (plan.wrap) break;
  }
  return groups;
}

// Replay a pull with its modifiers stripped out, so the difference is exactly
// what the mods in that group are contributing.
/** @param {Gun} gun @param {CastGroup} gr */
export function groupStats(gun, gr) {
  const plan = gr.plan;
  const ids = plan.defs.map(d => d.id);
  const bare = planCast(resetGun(Object.assign({}, gun, {
    cap: Math.max(1, ids.length), slots: ids.slice(),
    multi: Math.max(1, ids.length), shuffle: false })));
  /** @type {(p: Plan, f: string) => number} */
  const sum = (p, f) => p.shots.reduce((t, sh) => t + (sh[f] || 0), 0);
  // damage is what the whole pull puts out, so a pellet spray counts every pellet
  /** @type {(p: Plan) => number} */
  const power = p => p.shots.reduce((t, sh) => t + shotPower(sh), 0);
  /** @type {(sh: Shot, f: string) => number} */
  const topOf = (sh, f) => (sh.payload || []).reduce((n, ps) => Math.max(n, topOf(ps, f)), sh[f] || 0);
  /** @type {(p: Plan, f: string) => number} */
  const top = (p, f) => p.shots.reduce((t, sh) => Math.max(t, topOf(sh, f)), 0);
  /** @type {(p: Plan) => number} */
  const pellets = p => p.shots.reduce((t, sh) => t + shotPellets(sh), 0);
  /** @type {(p: Plan, f: string) => number} */
  const avg = (p, f) => (p.shots.length ? sum(p, f) / p.shots.length : 0);

  const out = [];
  /** @type {(label: string, now: number, was: number, better: number, fmt: (v: number) => string, always?: boolean) => void} */
  const add = (label, now, was, better, fmt, always) => {
    const d = now - was;
    if (!always && Math.abs(d) < 1e-6) return;
    const dir = Math.abs(d) < 1e-6 ? '' : (d > 0) === (better > 0) ? 'up' : 'down';
    const delta = Math.abs(d) < 1e-6 ? ''
      : (d > 0 ? '+' : '\u2212') + fmt(Math.abs(d));
    out.push({ label, value: fmt(now), delta, dir });
  };
  const n = v => String(Math.round(v * 100) / 100);
  const sec = v => (Math.round(v * 1000) / 1000) + 's';

  // recharge counts from any slot, so credit it to the group its mods sit in
  const without = Object.assign({}, gun, {
    slots: gun.slots.map((id, i) => (i >= gr.from && i < gr.to ? null : id)) });
  add('recharge', effRecharge(gun), effRecharge(without), -1, sec);

  add('dmg', power(plan), power(bare), 1, n, true);
  add('shots', pellets(plan), pellets(bare), 1, n, pellets(plan) > plan.shots.length);
  add('mana', plan.cost, bare.cost, -1, n, true);
  add('delay', plan.delay, bare.delay, -1, sec, true);
  add('speed', avg(plan, 'speed'), avg(bare, 'speed'), 1, v => String(Math.round(v)));
  add('spread', avg(plan, 'spread'), avg(bare, 'spread'), -1, v => n(v) + '\u00b0');
  add('homing', top(plan, 'homing'), top(bare, 'homing'), 1, n);
  add('bounces', top(plan, 'bounce'), top(bare, 'bounce'), 1, n);
  add('pierce', top(plan, 'pierce'), top(bare, 'pierce'), 1, n);
  add('blast', top(plan, 'explode'), top(bare, 'explode'), 1, n);
  add('drill', top(plan, 'bore'), top(bare, 'bore'), 1, n);
  add('life', avg(plan, 'life'), avg(bare, 'life'), 1, sec);
  return out;
}

// The bag screen's slot animation: the filled slots in the order one full cycle fires
// them, each tagged with the pull it comes out on. Empty slots are skipped. Null for a
// shuffled gun, whose order changes every recharge.
/** @param {Gun} g @returns {{ slot: number, pull: number }[] | null} */
export function pullSteps(g) {
  const groups = castGroups(g);
  if (!groups) return null;
  const steps = [], seen = new Set();
  groups.forEach((gr, n) => {
    for (let i = gr.from; i < gr.to && i < g.slots.length; i++)
      if (g.slots[i] && !seen.has(i)) { seen.add(i); steps.push({ slot: i, pull: n }); }
  });
  return steps;
}

// The bag screen's "trigger held down" preview: the Game's own cast loop (cast() and the
// per-frame gun tick) run on a copy of the gun, so the slot lights and the stat bars move at
// the gun's real pace — cast delay between pulls, recharge after the last, mana drained per
// pull and regenerating, a pause when it runs dry. No perks: the gun as it is.
/**
 * @typedef {{ g: Gun, max: number, mana: number, delayT: number, delayMax: number, rechT: number, rechLen: number,
 *   pull: number, lit: { slots: number[], pull: number, t: number } | null, fired: number }} FireSim
 */
/** @param {Gun} gun @returns {FireSim} */
export function fireSimNew(gun) {
  const g = resetGun(Object.assign({}, gun, { slots: gun.slots.slice() }));
  const max = gun.manaMax + gunPassives(gun).manaMax;
  return { g, max, mana: max, delayT: 0, delayMax: 0, rechT: 0, rechLen: 0, pull: 0, lit: null, fired: 0 };
}
/** @param {FireSim} S @param {number} dt */
export function fireSimStep(S, dt) {
  const g = S.g, pas = gunPassives(g);
  S.delayT -= dt; S.rechT -= dt;
  S.mana = Math.min(S.max, S.mana + (g.manaRegen + pas.manaRegen) * dt);
  if (S.lit && (S.lit.t -= dt) <= 0) S.lit = null;
  if (S.delayT > 0 || S.rechT > 0) return;
  const wrap = () => { g.idx = 0; S.rechT = S.rechLen = effRecharge(g); S.pull = 0; shuffleOrder(g); };
  const start = g.idx;
  const plan = planCast(g);
  if (!plan.shots.length) { wrap(); return; }
  if (S.mana < plan.cost) { g.idx = plan.start; S.delayT = S.delayMax = 0.12; return; }
  S.mana -= plan.cost;
  const end = plan.wrap || g.idx <= start ? g.order.length : g.idx;
  const slots = [];
  for (let i = start; i < end; i++) if (g.slots[g.order[i]]) slots.push(g.order[i]);
  // modifiers the pull ran past at the end of the list modify nothing, so they don't light
  const casts = id => MODS[id].kind === 'shot' || MODS[id].kind === 'static';
  while (slots.length && !casts(g.slots[slots[slots.length - 1]])) slots.pop();
  // the light holds for the pull's cast delay, but never so briefly you can't see it
  S.lit = { slots, pull: S.pull, t: Math.max(0.1, Math.min(plan.delay, 0.45)) };
  S.pull++; S.fired++;
  S.delayT = S.delayMax = plan.delay;
  if (plan.wrap) wrap();
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
