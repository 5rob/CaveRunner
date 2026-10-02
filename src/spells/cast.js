// @ts-check
// Firing a gun: planCast works out what one pull of the trigger fires (the heart of the
// game), blankShot is every field a shot has, effRecharge / gunPassives what the mods on a
// gun do to it. planCast mutates g.idx: callers that only look pass a copy.

import { MODS, TIMER_ADD } from './mods.js';

export const MIN_CAST = 0.016;      // one frame: the fastest a gun can chain casts
export const MIN_RECH = 0.05;

// Recharge counts every slot on the gun, wherever the mod sits, so the number on
// the gun card is always the number you get.
/** @param {Gun} g */
export function effRecharge(g) {
  const pas = gunPassives(g);
  return Math.max(MIN_RECH, (g.recharge + pas.rech) * pas.rechMul);
}

// Work out what the next pull of the trigger fires. Walks the slot list from where
// the gun left off, piling up modifiers and applying them to the shots that follow.
// Advances g.idx; the caller rolls it back if there isn't the mana to pay.
// Anything that comes out of the barrel: a shot has these and nothing else, so a
// modifier's f() can only touch fields that exist here.
/** @param {Mod} sm @param {number} spread the gun's @returns {Shot} */
export function blankShot(sm, spread) {
  return { dmg: sm.dmg || 0, speed: sm.speed || 0, spread: (sm.spread || 0) + spread,
    size: sm.size || 2, life: sm.life || 1, count: sm.count || 1,
    bounce: sm.bounce || 0, pierce: sm.pierce || 0, explode: sm.explode || 0,
    grav: sm.grav || 0, homing: sm.homing || 0, accel: sm.accel || 0, bore: sm.bore || 0, recoil: sm.recoil || 0,
    col: sm.col, knock: sm.knock || 0, crit: 0, boomer: 0, spiral: 0, pong: 0, orbit: 0,
    autoaim: 0, homeR: sm.homeR || 0, flat: 0, eat: sm.eat || 0, pull: sm.pull || 0,
    split: 0, cluster: 0, bounceFx: null, friendly: 0, chain: sm.chain || 0,
    fuse: sm.fuse || 0, beam: sm.beam || 0, payload: null,
    trig: sm.trig || null, timer: sm.timer != null ? sm.timer : TIMER_ADD,
    reach: sm.reach != null ? sm.reach : 10,     // how far ahead of the muzzle it spawns
    hidden: sm.hidden || 0,                       // don't draw it (Buzzsaw cuts unseen)
    drift: sm.drift || 0, pop: sm.pop || 0,       // Pollen: slows, floats, locks on; small pop on contact
    arc: sm.arc || 0,                             // Lightning: jagged bolt that throws side arcs
    fire: sm.fire || 0,                           // sets grass, moss, timber and creatures alight
    tele: sm.tele || 0,                           // Teleport Bolt: you go where it stops
    // v95 Noita flight and looks: air drag (per s), speed kept per bounce, a hole dug where
    // it stops on rock, a zig-zag swing (rad/s), how it's drawn and trails, and its glow
    drag: sm.drag || 0, bounceE: sm.bounceE || 0.92, pit: sm.pit || 0, wig: sm.wig || 0,
    look: sm.look || null, light: sm.light || null, lightR: sm.lightR || 0,
    embers: sm.embers || 0,                       // Brimstone: burning sparks thrown out of the blast
    vmax: sm.vmax || 0, lifeBoom: sm.lifeBoom || 0, // a top speed (rockets); explodes when its time runs out (bombs)
    sid: sm.id,                                   // which spell it is, for its sound
    still: sm.kind === 'static' ? 1 : 0, field: sm.field || null, r: sm.r || 0 };
}

// Work out what the next pull of the trigger fires. Walks the slot list from where
// the gun left off, piling up modifiers and applying them to the spells that follow.
// Advances g.idx; the caller rolls it back if there isn't the mana to pay.
// `others` is your other guns, which only Zeta looks at.
/** @param {Gun} g @param {(Gun | null)[]} [others] @returns {Plan} */
export function planCast(g, others) {
  const start = g.idx, mods = [], defs = [];
  // what each cast spell is carrying, by its index in defs: a trigger fills this
  // with the payload it drew, and everything else leaves it empty
  const holds = [];
  let addTrig = null;                   // an Add Trigger waiting for the next projectile
  let multi = g.multi, cost = 0, manaMul = 1, ran = false, wrapped = 0;
  // delay is walked in draw order: most mods nudge it, a few reset it outright,
  // and anything drawn after a reset adds its own delay back on top
  let delay = g.castDelay;
  let form = null, hp = 0;
  const acts = [];
  const timing = m => {
    if (m.setDelay !== undefined) delay = m.setDelay;
    else delay += (m.kind === 'shot' || m.kind === 'static' ? m.delay : m.d) || 0;
  };
  const live = () => g.slots.filter(id => id && MODS[id].kind !== 'passive');
  const casts = id => id && (MODS[id].kind === 'shot' || MODS[id].kind === 'static');
  // how many things the gun still has left to fire this cycle, which is what Myriad takes
  const rest = () => {
    let n = 0;
    for (let i = g.idx; i < g.order.length; i++) if (casts(g.slots[g.order[i]])) n++;
    return n;
  };
  const onGun = () => g.slots.filter(casts).length;
  let queued = 0;                       // copies waiting in the queue that will fire
  // A Greek letter drops the spells it copies into this queue, and they are drawn
  // before the gun moves on. Copies never copy again, so Omega cannot run away.
  const queue = [];
  const copiesOf = m => {
    const all = live().filter(id => !MODS[id].copy);   // a copy never copies a copy
    if (m.copy === 'first') return all.slice(0, 1);
    if (m.copy === 'last') return all.slice(-1);
    if (m.copy === 'all') return all;
    if (m.copy === 'shots') return all.filter(id => MODS[id].kind === 'shot');
    if (m.copy === 'statics') return all.filter(id => MODS[id].kind === 'static');
    if (m.copy === 'next2') {
      const out = [];
      for (let i = g.idx; i < g.order.length && out.length < 2; i++) {
        const id = g.slots[g.order[i]];
        if (id && MODS[id].kind !== 'passive') out.push(id);
      }
      return out;
    }
    if (m.copy === 'other') {
      const pool = [];
      for (const o of others || []) {
        if (!o || o === g) continue;
        for (const id of o.slots) if (id && MODS[id].kind !== 'passive' && !MODS[id].copy) pool.push(id);
      }
      return pool.length ? [pool[Math.floor(Math.random() * pool.length)]] : [];
    }
    return [];
  };

  const dress = (sm, list) => {
    const sh = blankShot(sm, g.spread);
    for (const m of list) if (m.f) m.f(sh);
    sh.speed *= g.speedMul || 1;
    if (sh.flat) sh.grav = 0;
    return sh;
  };
  // A trigger's payload is a little cast of its own, drawn straight after the carrier:
  // `n` casts, with its own modifiers, multicasts and triggers. Nothing outside it
  // reaches in and nothing in it leaks out. It may wrap round the gun once (shared with
  // the main draw), and the depth cap plus the one wrap keep it from running away.
  // Like Noita, a wrap only brings back spells fired on earlier pulls: nothing drawn in
  // this pull can be drawn again, so a lone trigger does not carry itself.
  let drawn = 0;
  const took = new Set();
  const payloadOf = (n, depth) => {
    const pm = [], out = [];
    let want = n, pform = null, pAdd = null;
    while (out.length < want && drawn++ < 96) {
      if (g.idx >= g.order.length) { ran = true; if (wrapped++) break; g.idx = 0; }
      if (took.has(g.idx)) { g.idx++; continue; }
      took.add(g.idx);
      const id = g.slots[g.order[g.idx++]];
      if (!id) continue;
      const m = MODS[id];
      if (m.kind === 'passive') continue;
      cost += m.mana || 0;
      if (m.hp) hp += m.hp;
      if (m.manaMul) manaMul *= m.manaMul;
      timing(m);
      if (m.kind === 'mod' || m.kind === 'util') {
        if (m.f) pm.push(m);
        if (m.multi) want += m.multi;
        if (m.form) pform = m.form;
        if (m.addTrig) pAdd = m.addTrig;
        continue;
      }
      const sh = dress(m, pm);
      if (pAdd && m.kind === 'shot' && !sh.trig) sh.trig = pAdd;
      pAdd = null;
      if (sh.trig) sh.payload = depth < 6 ? payloadOf(m.draw || 1, depth + 1) : [];
      out.push(sh);
    }
    if (pform) out.forEach((sh, i) => { sh.ang = pform[i % pform.length]; });
    return out;
  };

  for (let guard = 0; defs.length < multi && guard < 96; guard++) {
    let id, copied = false;
    if (queue.length) { id = queue.shift(); copied = true; }
    else {
      if (g.idx >= g.order.length) {
        ran = true;
        // a multicast still owed spells wraps back to the front to find them
        if (defs.length >= multi || wrapped++ || !defs.length && !mods.length) break;
        g.idx = 0;
      }
      id = g.slots[g.order[g.idx]];
      took.add(g.idx);
      g.idx++;
    }
    if (!id) continue;
    const m = MODS[id];
    if (m.kind === 'passive') continue;
    if (m.kind === 'mod' || m.kind === 'util') {
      cost += m.mana || 0;
      if (m.hp) hp += m.hp;
      if (m.act) acts.push(m.act);
      if (m.manaMul) manaMul *= m.manaMul;
      if (m.f) mods.push(m);
      if (m.addTrig) addTrig = m.addTrig;
      // Copies and multicasts only open up on the first pass. Once the gun has
      // wrapped round to the front they are skipped, or a Myriad would widen the
      // cast every time it came round and never finish.
      if (!copied && !wrapped) {
        if (m.multi) multi += m.multi;
        if (m.form) form = m.form;
        if (m.myriad) { multi += rest(); multi = Math.min(multi, queued + onGun()); }
        if (m.copy === 'mods') {
          for (const oid of live()) if (MODS[oid].f && !mods.includes(MODS[oid])) mods.push(MODS[oid]);
        } else if (m.copy) {
          let room = 0;
          for (const c of copiesOf(m)) { queue.push(c); if (casts(c)) { room++; queued++; } }
          // the copies need room, and so do the originals they came from: sweeping the
          // whole gun fires everything on it, and Tau fires its pair twice
          if (m.copy === 'all' || m.copy === 'shots' || m.copy === 'statics') multi += room + rest();
          else if (m.copy === 'next2') multi += room * 2;
          else multi += room;
          // never ask for more than the gun can actually produce, or the wrap-around
          // hands out a stray extra shot
          multi = Math.min(multi, queued + onGun());
        }
      }
      timing(m);
      continue;
    }
    defs.push(m);
    cost += m.mana;
    timing(m);
    // a carrier (a "with Trigger" spell, or any projectile after Add Trigger) draws its
    // payload right now, so the spells it takes are not cast from the barrel as well
    const kind = m.trig || (m.kind === 'shot' && addTrig) || null;
    if (m.kind === 'shot') addTrig = null;
    if (kind) holds[defs.length - 1] = { kind, list: payloadOf(m.draw || 1, 1) };
  }
  const shots = defs.map((sm, i) => {
    const sh = dress(sm, mods);
    if (holds[i]) { sh.trig = holds[i].kind; sh.payload = holds[i].list; }
    return sh;
  });
  if (form) shots.forEach((sh, i) => { sh.ang = form[i % form.length]; });
  let more = false;                       // anything left worth firing this cycle?
  for (let i = g.idx; i < g.order.length; i++) {
    const id = g.slots[g.order[i]];
    const k = id && MODS[id].kind;
    if (k === 'shot' || k === 'static') { more = true; break; }
  }
  return { shots, defs, start, cost: cost * manaMul, acts, hp,
    delay: Math.max(MIN_CAST, delay),
    wrap: ran || !more };
}

// what the gun actually does with the mods on it right now
/** @param {Gun} g */
export function gunPassives(g) {
  let rech = 0, rechMul = 1, manaMax = 0, manaRegen = 0, auto = false;
  for (const id of g.slots) {
    if (!id) continue;
    const m = MODS[id];
    if (m.rech) rech += m.rech;
    if (m.rechMul) rechMul *= m.rechMul;
    if (m.manaMax) manaMax += m.manaMax;
    if (m.manaRegen) manaRegen += m.manaRegen;
    if (m.auto) auto = true;
  }
  return { rech, rechMul, manaMax, manaRegen, auto };
}
