// @ts-check
// The shop's vending machines (the menu is ui/vendshop.js, the look render/shops.js). Each is an
// entry in SHOPS: where it stands and its hologram. Standing at one shows "Tap R to shop"; the tap
// opens its menu (input.current.shopOpen = its key, the game pauses), and what you buy there comes
// back as input.current.dispense, popped out of the machine's chute onto the floor (stepShops).
// Since v0.0.138 the mod and perk machines are crystal machines (`takes`): no menu (archived: the
// menu code is all still there, ui/vendshop.js + ui/modshop.js; drop `takes` to bring one back). A
// crystal of its colour that comes near (you can't carry them: you push them, or drag them with the
// Gravity Gun) is sucked in, the machine's lights speed up and it shakes faster and faster for CYCLE
// seconds, then pops out a new unlock off the floor's drop table (stepCrystals).

import { SFX } from '../../audio/sfx.js';
import { CELL, PH, PW, SHOP_FLOOR, SHOP_MACHINE_X, SHOP_Y } from '../../core/consts.js';
import { PERKS } from '../../data/perks.js';
import { saveCollection, savePerkCollection } from '../../save/save.js';
import { crystalRoll, perkRoll } from '../../spells/collection.js';
import { MODS } from '../../spells/mods.js';
import { modWeight } from '../../spells/spawn.js';
import { NUG_GRAV, collideNuggets, shoveNugget, stepNugget } from '../../world/nuggets.js';
import { burst, crystalMotes, toast } from './particles.js';
import { solidAt } from './terrain.js';

export const MACHINE_W = 56, MACHINE_H = 84;                   // a machine's cabinet (world units)
export const MACHINE_TOP = SHOP_FLOOR * CELL - MACHINE_H;      // its top
export const CHUTE_Y = SHOP_FLOOR * CELL - 14;           // where a bought thing comes out

/** @typedef {{ x: number, icon: string, hue: string, label: string, takes?: 'red' | 'green' }} ShopMachine  icon: an emoji, or 'gun' for the gun sprite; takes: a crystal machine (no menu) */
/** @type {Record<string, ShopMachine>} */
export const SHOPS = {                                   // left to right: mods, guns, perks
  mods: { x: SHOP_MACHINE_X[0], icon: '⚙️', hue: '#4fe3ff', label: 'Tap R to shop', takes: 'red' },
  guns: { x: SHOP_MACHINE_X[1], icon: 'gun', hue: '#ff9a3c', label: 'Tap R to shop' },
  perks: { x: SHOP_MACHINE_X[2], icon: '✦', hue: '#3dff7a', label: 'Tap R to shop', takes: 'green' },
};

// the machine you're standing at, if any
/** @param {World} W @param {number} pcx @param {number} pcy @returns {string | null} */
export function shopNear(W, pcx, pcy) {
  if (W.warp || W.repo || W.p.dead || pcy < SHOP_Y || pcy > SHOP_FLOOR * CELL) return null;
  for (const k in SHOPS) if (!SHOPS[k].takes && Math.abs(pcx - SHOPS[k].x) < MACHINE_W / 2 + 2) return k;
  return null;
}

// a tap at a machine: open its menu (App shows it and pauses the game)
/** @param {GameCtx} G @param {string} kind */
export function shopUse(G, kind) {
  G.input.current.shopOpen = kind;
  SFX.ui('mod');
}

// A part of stepPickups: something bought (input.current.dispense) pops out of its machine's
// chute towards you, and anything popping flies and lands on the shop floor. It can't be
// taken until it lands
/** @param {World} W @param {GameCtx} G @param {StepFrame} F */
export function stepShops(W, G, F) {
  const d = G.input.current.dispense;
  if (d) {
    G.input.current.dispense = null;
    const m = SHOPS[d.shop];
    if (m) {
      const side = F.pcx < m.x ? -1 : 1;
      const fly = { x: m.x, y: CHUTE_Y, t: 0, vx: side * (95 + Math.random() * 30), vy: -200 - Math.random() * 40, cool: 1 };
      W.pickups.push(d.gun ? { kind: 'gun', gun: d.gun, ...fly } : d.perk ? { kind: 'perk', id: d.perk, ...fly } : { kind: 'mod', id: d.id, ...fly });
      SFX.fx('prompt');
    }
  }
  stepCrystals(W, G, F);
  // anything thrown (a bought thing) falls until it rests on rock, 9 above it
  for (const q of W.pickups) {
    if (q.vy === undefined || q.kind === 'crystal') continue;
    q.vy = Math.min(600, q.vy + 900 * F.dt);
    const nx = q.x + (q.vx || 0) * F.dt;
    if (!solidAt(W, nx, q.y)) q.x = nx; else q.vx = 0;
    q.y += q.vy * F.dt;
    q.cool = 0.2;
    if (q.vy > 0 && solidAt(W, q.x, q.y + 9)) {
      for (let k = 0; k < 20 && solidAt(W, q.x, q.y + 8); k++) q.y -= 1;
      if (q.vy > 120) { q.vy *= -0.35; q.vx = (q.vx || 0) * 0.6; }   // one little bounce
      else { delete q.vy; delete q.vx; q.cool = 0; q.t = W.time; }
    }
  }
}

export const CRYS_R = 8;                                  // a crystal's body (world units; drawn ~9)
export const CYCLE = 2.4;                                 // seconds a crystal machine shakes before it pops
export const SLOT_Y = MACHINE_TOP + 52;                   // where a crystal goes into the machine
const INTAKE_X = MACHINE_W / 2 + 26, INTAKE_TOP = MACHINE_TOP - 26;   // how close one must come to be sucked in
const SHAKE_F0 = 3, SHAKE_F1 = 30;                        // the shake's frequency (Hz): F0 at the start, F0 + F1 at the pop

// how far round its shake a machine is, t seconds in (the frequency rises from SHAKE_F0 to SHAKE_F0 + SHAKE_F1)
/** @param {number} t */
export const shakePhase = t => SHAKE_F0 * t + SHAKE_F1 * CYCLE * Math.pow(Math.min(1, t / CYCLE), 3) / 3;

// the crystal machine that takes q, if it's near enough to be sucked in
/** @param {Pickup} q @returns {string | null} */
export function intakeOf(q) {
  if (q.y < INTAKE_TOP || q.y > SHOP_FLOOR * CELL + 4) return null;
  for (const k in SHOPS) {
    const m = SHOPS[k];
    if (m.takes && (m.takes === 'green') === !!q.green && Math.abs(q.x - m.x) < INTAKE_X) return k;
  }
  return null;
}

// what a machine pops out for a crystal: a new unlock (a mod off the floor's drop table, or a perk),
// added to the collection; once everything is unlocked, one you have (a mod off the floor's table)
/** @param {World} W @param {GameCtx} G @param {string} k @returns {{ kind: 'mod' | 'perk', id: string } | null} */
export function machineRoll(W, G, k) {
  const inp = G.input.current;
  if (SHOPS[k].takes === 'green') {
    const id = perkRoll(Math.random, inp.perkCollection);
    if (id) { inp.perkCollection.push(id); savePerkCollection(inp.perkCollection); return { kind: 'perk', id }; }
    const have = inp.perkCollection;
    return have.length ? { kind: 'perk', id: have[Math.floor(Math.random() * have.length)] } : null;
  }
  const id = crystalRoll(Math.random, W.floor, inp.collection);
  if (id) { inp.collection.push(id); saveCollection(inp.collection); return { kind: 'mod', id }; }
  const pool = inp.collection.filter(m => modWeight(m, W.floor) > 0);
  const have = pool.length ? pool : inp.collection;
  return have.length ? { kind: 'mod', id: have[Math.floor(Math.random() * have.length)] } : null;
}

// A part of stepShops: the crystals. Loose ones are rocks (world/nuggets.js: they fall, roll, bump
// each other) that you shove about by walking into them; a White Hole holds them up (q.hold,
// game/systems/fields.js). One that comes near its machine flies into it (through anything, like
// gold to you), and each machine takes its crystals one at a time: CYCLE seconds of faster and
// faster shaking and lights (W.machines[k].t, drawn by render/shops.js), then the pop
/** @param {World} W @param {GameCtx} G @param {StepFrame} F */
export function stepCrystals(W, G, F) {
  const dt = F.dt;
  /** @param {number} x @param {number} y */
  const solid = (x, y) => solidAt(W, x, y);
  const free = [];
  for (const q of W.pickups) {
    if (q.kind !== 'crystal' || q.taken) continue;
    if (q.into) {                            // being sucked in: straight to the slot
      const m = SHOPS[q.into], dx = m.x - q.x, dy = SLOT_Y - q.y, d = Math.hypot(dx, dy) || 1;
      const grab = 400 + 900 * Math.max(0, 1 - d / 80);
      q.vx = (q.vx || 0) + dx / d * grab * dt * 6; q.fvy = (q.fvy || 0) + dy / d * grab * dt * 6;
      q.vx *= 0.86; q.fvy *= 0.86;
      const ox = q.x, oy = q.y;
      q.x += q.vx * dt; q.y += q.fvy * dt;
      crystalMotes(W, q.x, q.y, !!q.green, dt, Math.hypot(q.x - ox, q.y - oy), ox, oy);
      if (d < 7) {
        q.taken = true;
        const M = W.machines[q.into] || (W.machines[q.into] = { n: 0, t: -1 });
        M.n++;
        burst(W, m.x, SLOT_Y, 8, q.green ? '#3dff7a' : '#ff4a5a');
        SFX.ui(q.green ? 'perk' : 'mod');
      }
      continue;
    }
    if (q.nopull > 0) q.nopull -= dt;
    if (q.hold > 0) { q.hold -= dt; q.vy = (q.vy || 0) - NUG_GRAV * dt; }   // held up: no gravity
    stepNugget(q, dt, solid, CRYS_R);
    if (!W.p.dead) shoveNugget(q, CRYS_R, { x: W.p.x, y: W.p.y, w: PW, h: PH }, W.p.vx, W.p.vy, solid);
    const k = !(q.nopull > 0) && !W.warp ? intakeOf(q) : null;
    if (k) { q.into = k; q.fvy = q.vy || 0; delete q.vy; q.hold = 0; SFX.fx('prompt'); continue; }
    crystalMotes(W, q.x, q.y, !!q.green, dt, 0);
    free.push(q);
  }
  collideNuggets(free, solid, () => CRYS_R);
  // the machines: one crystal at a time, a shake, then the pop
  for (const k in SHOPS) {
    const m = SHOPS[k], M = W.machines[k];
    if (!m.takes || !M) continue;
    if (M.t < 0 && M.n > 0) { M.n--; M.t = 0; }
    if (M.t < 0) continue;
    const t0 = M.t;
    M.t += dt;
    if (Math.floor(shakePhase(M.t)) !== Math.floor(shakePhase(t0))) SFX.fx('reelTick');
    if (M.t < CYCLE) continue;
    M.t = -1;
    const got = machineRoll(W, G, k);
    if (!got) { toast(W, 'Nothing left to unlock'); continue; }
    const side = F.pcx < m.x ? -1 : 1;
    W.pickups.push({ kind: got.kind, id: got.id, x: m.x, y: CHUTE_Y, t: 0,
      vx: side * (95 + Math.random() * 30), vy: -200 - Math.random() * 40, cool: 1 });
    toast(W, 'Unlocked ' + (got.kind === 'perk' ? PERKS[got.id].name : MODS[got.id].name));
    burst(W, m.x, CHUTE_Y, 14, m.hue);
    SFX.fx('reelThud'); SFX.fx('prompt');
    G.input.current.notify();
  }
}
