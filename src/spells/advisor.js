// @ts-check
// The build advisor and the mod previews: gunRate (damage a gun really deals, priced by
// the mana and health it costs), buildAdvice (swap suggestions), modPreview / previewPlan
// (the use-example on a mod card).

import { PLAYER_HP } from '../core/consts.js';
import { effRecharge, gunPassives, planCast } from './cast.js';
import { resetGun } from './guns.js';
import { FIELD_WHAT, MODS } from './mods.js';

// What does this mod actually do? Rather than describing it by hand, run a plain
// bolt through the planner with and without it and report whatever changed.
/** @type {[key: string, label: string, unit?: string][]} a Shot field, how the card names it */
export const PREVIEW_FIELDS = [['dmg', 'damage'], ['speed', 'speed'], ['spread', 'spread', '\u00b0'],
  ['size', 'size'], ['life', 'flight time', 's'], ['bounce', 'bounces'], ['pierce', 'pierce'],
  ['homing', 'homing'], ['explode', 'blast radius'], ['bore', 'drill'], ['recoil', 'recoil'],
  ['accel', 'acceleration']];
export const num = (/** @type {number} */ v) => {
  const r = Math.round(v * 100) / 100;
  return String(r);
};
/** @param {(string | null)[]} slots @param {Partial<Gun>} [over] @returns {Gun} */
export function previewGun(slots, over) {
  return resetGun(Object.assign({ name: 'p', cap: slots.length, castDelay: 0.2, recharge: 1,
    manaMax: 99999, manaRegen: 0, spread: 0, multi: 1, shuffle: false, mana: 99999,
    speedMul: 1, slots }, over || {}));
}
/** @param {(string | null)[]} slots @returns {Plan} */
export function previewPlan(slots) { return planCast(previewGun(slots)); }
/** @param {string} id @returns {{ rows: string[][] }} label, value */
export function modPreview(id) {
  const m = MODS[id];
  const rows = [];
  /** @type {(label: string, x: number, y: number, unit?: string) => void} */
  const push = (label, x, y, unit) => {
    if (Math.abs(x - y) < 1e-6) return;
    rows.push([label, num(x) + (unit || '') + ' \u2192 ' + num(y) + (unit || '')]);
  };
  // a plain, readable gun to measure against
  const REF = { recharge: 1, manaMax: 100, manaRegen: 40 };
  const ref = (/** @type {string[]} */ slots) => previewGun(slots, REF);

  if (m.kind === 'passive') {
    const a = ref(['bolt']), b = ref([id, 'bolt']);
    push('recharge', effRecharge(a), effRecharge(b), 's');
    push('mana', a.manaMax + gunPassives(a).manaMax, b.manaMax + gunPassives(b).manaMax);
    push('mana regen', a.manaRegen + gunPassives(a).manaRegen,
      b.manaRegen + gunPassives(b).manaRegen, '/s');
    return { rows };
  }

  if (m.kind === 'static') {
    const p = previewPlan([id]);
    rows.push(['mana', num(p.cost)], ['cast delay', num(p.delay) + 's'],
      ['radius', num(m.r)]);
    if (m.life > 0.2) rows.push(['lasts', num(m.life) + 's']);
    rows.push(['does', FIELD_WHAT[m.field] || m.field]);
    return { rows };
  }

  if (m.kind === 'util') {
    const p = previewPlan([id, 'bolt']), a = previewPlan(['bolt']);
    rows.push(['mana', num(m.mana || 0)]);
    push('cast delay', a.delay, p.delay, 's');
    push('recharge', effRecharge(ref(['bolt'])), effRecharge(ref([id, 'bolt'])), 's');
    if (m.manaMul) rows.push(['mana cost', '\u00d7' + num(m.manaMul)]);
    if (m.hp) rows.push(['health per pull', '\u2212' + num(m.hp)]);
    const sa = a.shots[0], sb = p.shots[0];
    if (sa && sb) for (const [key, label, unit] of PREVIEW_FIELDS) push(label, sa[key] || 0, sb[key] || 0, unit);
    return { rows };
  }

  if (m.kind === 'shot') {
    const p = previewPlan([id]);
    const sh = p.shots[0];
    rows.push(['mana', num(p.cost)], ['cast delay', num(p.delay) + 's']);
    if (m.trig) rows.push(['carries',
      (m.draw === 1 ? 'the next spell' : 'the next ' + m.draw + ' spells')
      + (m.trig === 'hit' ? ', on a hit' : m.trig === 'timer' ? ', after ' + num(m.timer) + 's'
        : ', when it dies')]);
    if (m.rech || m.rechMul) rows.push(['recharge', num(effRecharge(ref([id]))) + 's']);
    for (const [key, label, unit] of PREVIEW_FIELDS) {
      if (!sh[key]) continue;
      rows.push([label, num(sh[key]) + (unit || '')]);
    }
    if (sh.count > 1) rows.splice(2, 0, ['pellets', num(sh.count)]);
    return { rows };
  }

  const a = previewPlan(['bolt']);
  const b = previewPlan([id, 'bolt', 'bolt', 'bolt', 'bolt']);
  push('shots per pull', a.shots.length, b.shots.length);
  push('mana', a.cost, b.cost);
  push('cast delay', a.delay, b.delay, 's');
  push('recharge', effRecharge(ref(['bolt'])), effRecharge(ref([id, 'bolt'])), 's');
  const sa = a.shots[0], sb = b.shots[0];
  if (sa && sb) for (const [key, label, unit] of PREVIEW_FIELDS) push(label, sa[key] || 0, sb[key] || 0, unit);
  return { rows };
}

// How much damage a gun really puts out, averaged over a whole cycle: every pull
// in the list, then the recharge. Firing faster than mana allows just stalls, so
// the rate is capped by what regen can sustain.
// what your health can pay out per second and still last a decent fight
export const HP_BUDGET = PLAYER_HP / 25;

// What one planned shot is worth: every pellet of it, plus anything a trigger is
// carrying to the point of impact. Payloads nest, but are finite, so this ends.
/** @type {(sh: Shot) => number} */
export const shotPower = sh => (sh.dmg || 0) * Math.max(1, Math.round(sh.count || 1))
  + (sh.payload || []).reduce((t, ps) => t + shotPower(ps), 0);
/** @type {(sh: Shot) => number} */
export const shotCount = sh => 1 + (sh.payload || []).reduce((t, ps) => t + shotCount(ps), 0);
/** @type {(sh: Shot) => number} */
export const shotPellets = sh => Math.max(1, Math.round(sh.count || 1))
  + (sh.payload || []).reduce((t, ps) => t + shotPellets(ps), 0);

/** @param {Gun} gun */
export function gunRate(gun) {
  const g = resetGun(Object.assign({}, gun, { slots: gun.slots.slice() }));
  let cast = 0, dmg = 0, cost = 0, shots = 0, blood = 0;
  for (let guard = 0; guard < 16; guard++) {
    const p = planCast(g);
    cast += p.delay;
    cost += p.cost;
    blood += p.hp || 0;
    for (const sh of p.shots) {
      // a trigger's mana is already counted; its payload's damage has to be too
      shots += shotCount(sh);
      dmg += shotPower(sh);
    }
    if (p.wrap) break;
  }
  const rech = effRecharge(g);
  const cycle = Math.max(0.001, cast + rech);
  const pas = gunPassives(gun);
  const regen = gun.manaRegen + pas.manaRegen;
  const manaPerSec = cost / cycle;
  const sustain = manaPerSec > regen ? regen / manaPerSec : 1;
  // health is a resource too: a gun that bleeds you dry in five seconds is not really
  // doing that much damage per second, however good the raw numbers look
  const hpPerSec = blood / cycle;
  const bleed = hpPerSec > HP_BUDGET ? HP_BUDGET / hpPerSec : 1;
  return { dps: (dmg / cycle) * sustain * bleed, cycle, cast, rech, manaPerSec, regen,
    shots, sustain, hpPerSec, bleed };
}

// Spot the bottleneck, then brute-force every single swap between the gun and the
// bag to see which one helps most. No cleverness, just the planner run a few
// hundred times, which costs a few milliseconds.
// how many promising mods get the full every-slot treatment
export const SHORTLIST = 14;

/** @param {Gun} gun @param {string[]} bag the mod ids you carry */
export function buildAdvice(gun, bag) {
  const now = gunRate(gun);
  let limit;
  if (!now.shots) limit = { key: 'none', text: 'Nothing on this gun fires — it needs a shot mod' };
  else if (now.bleed < 0.95) limit = { key: 'blood',
    text: 'Your health is the limit — ' + now.hpPerSec.toFixed(1) + ' hp/s to keep this up' };
  else if (now.sustain < 0.95) limit = { key: 'mana',
    text: 'Mana is the limit — ' + Math.round(now.manaPerSec) + '/s used against ' +
      Math.round(now.regen) + '/s regen' };
  else if (now.rech > now.cast) limit = { key: 'rech',
    text: 'Recharge is the limit — ' + Math.round(100 * now.rech / now.cycle) + '% of the cycle' };
  else limit = { key: 'cast',
    text: 'Cast delay is the limit — ' + Math.round(100 * now.cast / now.cycle) + '% of the cycle' };

  const tips = [];
  const score = (/** @type {(string | null)[]} */ slots) => gunRate(Object.assign({}, gun, { slots })).dps;
  if (now.shots) {
    const seen = {};
    const pool = bag.filter(id => !seen[id] && (seen[id] = 1));
    // With a hundred-odd mods to hand, trying every one in every slot is far too much
    // work for one render. So: a cheap first look at each mod in a couple of slots,
    // then the handful that showed promise get tried properly everywhere.
    const probe = [0, gun.slots.indexOf(null) >= 0 ? gun.slots.indexOf(null) : gun.slots.length - 1]
      .filter((v, i, a) => v >= 0 && a.indexOf(v) === i);
    let shortlist = pool;
    if (pool.length > SHORTLIST) {
      const rough = [];
      for (const id of pool) {
        let bestDps = 0;
        for (const i of probe) {
          if (gun.slots[i] === id) continue;
          const slots = gun.slots.slice();
          slots[i] = id;
          bestDps = Math.max(bestDps, score(slots));
        }
        rough.push({ id, bestDps });
      }
      rough.sort((a, b) => b.bestDps - a.bestDps);
      shortlist = rough.slice(0, SHORTLIST).map(r => r.id);
    }
    // bringing one mod in from the bag
    for (let i = 0; i < gun.slots.length; i++) {
      for (const id of shortlist) {
        if (gun.slots[i] === id) continue;
        const slots = gun.slots.slice();
        slots[i] = id;
        const dps = score(slots);
        if (dps > now.dps * 1.05) tips.push({ kind: 'fit', slot: i, id, dps, gain: dps / now.dps });
      }
    }
    // or just moving what is already on the gun, which is often the real fix
    for (let i = 0; i < gun.slots.length; i++) {
      for (let j = i + 1; j < gun.slots.length; j++) {
        if (!gun.slots[i] && !gun.slots[j]) continue;
        const slots = gun.slots.slice();
        slots[i] = gun.slots[j]; slots[j] = gun.slots[i];
        const dps = score(slots);
        if (dps > now.dps * 1.05) tips.push({ kind: 'move', slot: i, other: j, dps, gain: dps / now.dps });
      }
    }
    tips.sort((a, b) => b.dps - a.dps);
  }
  // one tip per slot, so the list does not fill up with variations on one idea
  const picked = [], usedSlot = {}, usedMod = {};
  for (const t of tips) {
    if (usedSlot[t.slot] || (t.other !== undefined && usedSlot[t.other])) continue;
    if (t.id && usedMod[t.id]) continue;   // you only own one of each, so only its best slot
    if (t.id) usedMod[t.id] = 1;
    usedSlot[t.slot] = 1;
    if (t.other !== undefined) usedSlot[t.other] = 1;
    picked.push(t);
    if (picked.length === 3) break;
  }
  return { now, limit, tips: picked };
}
