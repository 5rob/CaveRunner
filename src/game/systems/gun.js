// @ts-check
// Casting: one pull of the trigger through planCast (cast), each planned shot into the world
// (spawnShot), and a trigger's payload coming out where its carrier stopped (releaseAt); and
// each frame's aiming, gun clocks and trigger pull (aimAndCast, a part of step()).

import { SFX } from '../../audio/sfx.js';
import { AIM_DEAD, PH, PW } from '../../core/consts.js';
import { effRecharge, gunPassives, planCast } from '../../spells/cast.js';
import { shuffleOrder } from '../../spells/guns.js';
import { bhSp } from '../../spells/trace.js';
import { assistPointer, assistSnap, hasAssist } from '../../spells/assist.js';
import { discrimId, targetName } from '../../spells/discrim.js';
import { DEV } from '../../dev/knobs.js';
import { anchorOf, castField, fireBeam } from './fields.js';
import { burst, toast } from './particles.js';
import { hurt } from './player.js';
import { lineOfSight, solidAt } from './terrain.js';

// ---- casting ----
// Walk the gun's slot list from where it left off. Modifiers pile up and apply
// to the shots that come after them; running off the end triggers the recharge.
/** @param {World} W @param {GameCtx} G @param {Gun} g @param {number} gx @param {number} gy @param {number} nx @param {number} ny */
export function cast(W, G, g, gx, gy, nx, ny) {
  const pas = gunPassives(g);
  const wrap = () => {
    g.idx = 0;
    g.rechT = g.skipRech ? 0 : effRecharge(g) * W.pb.rech;   // Faster Wands shortens it
    g.rechLen = g.rechT;
    g.skipRech = false;
    shuffleOrder(g);
  };
  const plan = planCast(g, G.input.current.loadout.guns);
  if (!plan.shots.length) { wrap(); return; }        // modifiers with nothing to modify
  const cost = W.pb.mana === 0 ? 0 : plan.cost;        // Unlimited Spells: nothing costs mana
  if (g.mana < cost) { g.idx = plan.start; g.delayT = 0.12; g.delayMax = 0.12; SFX.ui('empty'); return; }
  g.mana -= cost;

  const base = Math.atan2(ny, nx);
  const acts = plan.acts || [];
  let bonus = 0;                                   // damage bought with something else

  if (plan.hp && !W.p.dead) hurt(W, G, plan.hp);
  if (acts.includes('refresh')) { g.skipRech = true; SFX.fx('refresh'); }
  if (acts.includes('manapow')) {
    SFX.fx('drain');
    const spare = Math.max(0, g.mana - 50);
    g.mana -= spare; bonus += spare / 12;
  }
  if (acts.includes('gpower')) {
    const LO2 = G.input.current.loadout;
    const spend = Math.floor(LO2.gold * 0.05);
    LO2.gold -= spend; bonus += spend / 8;
    if (spend) { G.input.current.notify(); SFX.fx('gspend'); }
  }
  if (acts.includes('saws')) {
    SFX.fx('saws');
    for (const b of W.bullets) {
      b.dmg = Math.max(b.dmg, 3); b.size = 5; b.bore = 4; b.col = '#d9dde4';
      b.life = Math.max(b.life, 1.2); b.bounce = Math.max(b.bounce, 4); b.explode = 0;
    }
  }

  // where the shots come into the world. A spot buried in rock would eat the
  // whole cast, so anything that moves the origin backs off to clear ground.
  let ox = gx, oy = gy;
  const clearSpot = (tx, ty) => {
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      const cx = tx + (gx - tx) * t, cy = ty + (gy - ty) * t;
      if (!solidAt(W, cx, cy)) return [cx, cy];
    }
    return [gx, gy];
  };
  if (acts.includes('far')) [ox, oy] = clearSpot(gx + nx * 95, gy + ny * 95);
  if (acts.includes('tele')) {
    let best = null, bd = 420;
    for (const e of W.enemies) {
      const d = Math.hypot(e.x - gx, e.ty - gy);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) [ox, oy] = clearSpot(best.x - nx * 14, best.ty - ny * 14);
  }
  const warp = acts.includes('warp');
  if (warp || acts.includes('far') || acts.includes('tele')) SFX.fx('warp', ox, oy);

  for (const sh of plan.shots) spawnShot(W, G, sh, ox, oy, base, bonus, warp, 30);
  SFX.cast(plan.shots, ox === gx && oy === gy ? null : ox, oy);
  let kick = 0;
  for (const sh of plan.shots) kick += sh.recoil;
  if (kick && !W.p.dead) {
    kick = Math.min(220, kick * 1.4 * W.pb.recoil);   // Knockback / Concentrated add kick
    W.p.vx -= Math.cos(base) * kick;
    W.p.vy -= Math.sin(base) * kick;
  }
  g.delayT = plan.delay * W.pb.delay;                 // Concentrated slows, Faster Wands quickens
  g.delayMax = Math.max(g.delayT, 0.001);           // for the cast-delay ring on the stick
  if (plan.wrap) wrap();
}

// One planned shot into the world: pellets, spread, auto-aim, beams and all. It is
// its own function because a trigger's payload comes through here too, from
// wherever the carrier stopped. `fd` is how far ahead of the origin a static field
// lands: a barrel's length out of the gun, and nothing at all off a trigger.
/** @param {World} W @param {GameCtx} G @param {Shot} sh @param {number} ox @param {number} oy @param {number} base @param {number} bonus @param {boolean} warp @param {number} fd @param {Bullet | Field | null} [from] a trigger's carrier (what an orbit circles) */
export function spawnShot(W, G, sh, ox, oy, base, bonus, warp, fd, from) {
  if (sh.still) { castField(W, G, sh, ox + Math.cos(base) * fd, oy + Math.sin(base) * fd, base, from); return; }
  const n = Math.min(24, Math.max(1, Math.round(sh.count)));
  const off = (sh.ang || 0) * Math.PI / 180;
  // perk touches: Glass/Concentrated damage, Critical/Close-Call chance, Faster
  // Projectiles speed, Bouncing/Homing paths. Close Call only counts if something is
  // right on top of you, so it is worked out once per cast, not once per pellet.
  const pd = W.pb.dmg;
  let pc = W.pb.crit;
  if (W.pb.close && W.enemies.some(e => Math.hypot(e.x - ox, e.ty - oy) < 56)) pc += 0.4;
  for (let i = 0; i < n; i++) {
    let a = base + off + (Math.random() - 0.5) * sh.spread * W.pb.spread * Math.PI / 180;
    if (sh.autoaim) {
      let best = null, bd = 320;
      for (const e of W.enemies) {
        const d = Math.hypot(e.x - ox, e.ty - oy);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) a = Math.atan2(best.ty - oy, best.x - ox);
    }
    if (sh.flat) a = Math.cos(a) >= 0 ? 0 : Math.PI;
    if (sh.beam) { fireBeam(W, G, sh, ox, oy, Math.cos(a), Math.sin(a), bonus, pd, pc); continue; }
    const reach = sh.reach != null ? sh.reach : 10;
    let bx = ox + Math.cos(a) * reach, by = oy + Math.sin(a) * reach;
    if (warp) {                                   // jump forward, but not into rock
      for (let step = 0; step < 14; step++) {
        const tx = bx + Math.cos(a) * 10, ty = by + Math.sin(a) * 10;
        if (solidAt(W, tx, ty)) break;
        bx = tx; by = ty;
      }
    }
    W.bullets.push({ x: bx, y: by,
      vx: Math.cos(a) * sh.speed * W.pb.speed * bhSp(sh), vy: Math.sin(a) * sh.speed * W.pb.speed * bhSp(sh),
      life: sh.life, dmg: (sh.dmg + bonus) * pd, size: sh.size, col: sh.col, spin: 0,
      homing: Math.max(sh.homing, W.pb.homing), bounce: sh.bounce + W.pb.bounce, pierce: sh.pierce,
      explode: sh.explode, grav: sh.grav, accel: sh.accel, bore: sh.bore, hit: null,
      knock: sh.knock, crit: sh.crit + pc, boomer: sh.boomer, spiral: sh.spiral,
      pong: sh.pong, orbit: sh.orbit, follow: sh.follow, followAim: sh.followAim, anc: anchorOf(from), homeR: sh.homeR, eat: sh.eat, pull: sh.pull,
      split: sh.split, cluster: sh.cluster, bounceFx: sh.bounceFx,
      friendly: sh.friendly, chain: sh.chain, fuse: sh.fuse,
      payload: sh.payload && sh.payload.length ? sh.payload : null, hidden: sh.hidden, arc: sh.arc,
      drift: sh.drift, pop: sh.pop, tele: sh.tele, fire: sh.fire,
      drag: sh.drag, bounceE: sh.bounceE, pit: sh.pit, wig: sh.wig, look: sh.look,
      light: sh.light, lightR: sh.lightR, vmax: sh.vmax, lifeBoom: sh.lifeBoom,
      trig: sh.trig, timer: sh.trig === 'timer' ? sh.timer : null,
      ox: bx, oy: by, age: 0, born: sh.life, only: sh.only || null });
  }
}

// A carrier lets go of its payload: 'hit' on the first thing it touches, 'timer'
// when its timer runs out (or on a hit first), 'expire' when it dies. It fires once;
// anything in the payload that is itself a carrier takes its own payload along.
/** @param {World} W @param {GameCtx} G @param {Bullet} b */
export function firePayload(W, G, b) {
  const list = b.payload;
  b.payload = null;
  const sp = Math.hypot(b.vx, b.vy);
  const nx = sp ? b.vx / sp : Math.cos(b.ang || 0), ny = sp ? b.vy / sp : Math.sin(b.ang || 0);
  releaseAt(W, G, list, b.x, b.y, nx, ny, b.col, b);
}
/** @param {World} W @param {GameCtx} G @param {Shot[]} list @param {number} x @param {number} y @param {number} nx @param {number} ny @param {string} col @param {Bullet | Field | null} [from] the carrier */
export function releaseAt(W, G, list, x, y, nx, ny, col, from) {
  const x0 = x, y0 = y;
  // it may have stopped inside the rock, so back up along its own track until
  // there is open ground for the payload to come out into
  for (let k = 0; k < 6 && solidAt(W, x + nx * 10, y + ny * 10); k++) { x -= nx * 4; y -= ny * 4; }
  const base = Math.atan2(ny, nx);
  for (const sh of list) spawnShot(W, G, sh, x, y, base, 0, false, 0, from);
  SFX.cast(list, x0, y0);
  burst(W, x0, y0, 5, col);
}

// Aim Assist's pointer between frames: out (past DEV.aaStart this touch), the creature it's on, and
// how long it's been on it (the auto-fire waits DEV.aaDelay)
let assistOut = false, assistT = 0;
/** @type {Enemy | null} */
let assistHeld = null;

// Discriminate's target pick (the Bag's "Set target" sets input.pickTarget to the copy's bag index):
// the pointer is out this touch, the thing it's on, and whether the hint has shown
let pickOut = false, pickHint = false;
/** @type {{ x: number, ty: number, r: number, t: DiscrimTarget } | null} */
let pickHeld = null;
// everything on screen a Discriminate can be set on: creatures, you, props, pickups
/** @param {World} W @param {{ x: number, y: number, w: number, h: number }} v */
function pickables(W, v) {
  const on = (/** @type {number} */ x, /** @type {number} */ y) => x >= v.x && x <= v.x + v.w && y >= v.y && y <= v.y + v.h;
  /** @type {{ x: number, ty: number, r: number, t: DiscrimTarget }[]} */
  const out = [];
  for (const e of W.enemies) if (e.hp > 0 && on(e.x, e.ty)) out.push({ x: e.x, ty: e.ty, r: e.r, t: { kind: 'creature', id: e.k.id } });
  if (!W.p.dead) out.push({ x: W.p.x + PW / 2, ty: W.p.y + PH / 2, r: 6, t: { kind: 'player', id: 'player' } });
  for (const pr of W.props) {
    const x = pr.x + (pr.l + pr.r) / 2, y = pr.y + (pr.t0 + pr.b) / 2;
    if (!pr.gone && on(x, y)) out.push({ x, ty: y, r: Math.min(14, Math.max(pr.r - pr.l, pr.b - pr.t0) / 2), t: { kind: 'object', id: pr.k } });
  }
  for (const it of W.pickups) if (!it.taken && on(it.x, it.y)) out.push({ x: it.x, ty: it.y, r: 5, t: { kind: 'object', id: it.kind } });
  return out;
}

// ---- aiming and firing (a part of step) ----
// Where you aim (the right stick, else the mouse; Pinpointer aims for you), which way you
// face, every gun's clocks and mana, and a pull of the held gun's trigger.
/** @param {World} W @param {GameCtx} G @param {StepFrame} F */
export function aimAndCast(W, G, F) {
  const { dt, LO, pcx } = F;
  // ---- aiming: thumbstick first, otherwise mouse ----
  const gx = pcx, gy = W.p.y + PH * 0.4;
  // at the buy machine the right stick picks the floor (pickups.js): it doesn't aim or fire there
  const TR = G.input.current.lvlPick ? { ...G.input.current.right, active: false, on: false } : G.input.current.right;
  let R = { on: false, show: false, nx: W.p.face, ny: 0 };
  // line shows as soon as you touch the stick, fading in with the push: 0 at the centre,
  // full at the trigger ring (vis is what the Trajectory Sight line reads)
  if (TR.active) R = { on: TR.on, show: true, nx: TR.nx, ny: TR.ny, vis: Math.min(1, TR.mag / (TR.fire || AIM_DEAD)) };
  else if (G.mouse.inside) {
    const dx = W.camX + G.mouse.x / W.unitPx - gx, dy = W.camY + G.mouse.y / W.unitPx - gy, d = Math.hypot(dx, dy);
    if (d > 1) R = { on: G.mouse.down, show: true, nx: dx / d, ny: dy / d };
  }
  // Pinpointer aims for you: the gun locks onto the nearest creature and you only
  // decide whether to fire. It replaces hand-aiming — the stick becomes a trigger.
  if (W.pb.pinpointer && !W.p.dead) {
    let best = null, bd = 1e9;
    for (const e of W.enemies) {
      const d = Math.hypot(e.x - gx, e.ty - gy);
      if (d < bd && lineOfSight(W, gx, gy, e.x, e.ty)) { bd = d; best = e; }
    }
    if (best) {
      const a = Math.atan2(best.ty - gy, best.x - gx);
      R = { on: R.on || (TR.active && TR.on), show: true, nx: Math.cos(a), ny: Math.sin(a), vis: R.vis };
    }
  }
  // Aim Assist on the held gun: the right stick is a pointer (no trigger ring) that snaps onto
  // creatures in sight and on screen; once it's on one for DEV.aaDelay the gun fires at it
  const held = LO.guns[LO.sel];
  W.p.assist = undefined;
  const pick = G.input.current.pickTarget;
  if (pick == null && hasAssist(held) && !W.p.dead && TR.active && !G.RPV) {
    if (TR.mag > DEV.aaStart || assistOut) {
      assistOut = true;
      const view = { x: W.camX, y: W.camY, w: W.viewW || 400, h: W.viewH || 300 };
      const raw = assistPointer(gx, gy, TR.nx, TR.ny, TR.mag, view);
      const onScreen = (/** @type {Enemy} */ e) => e.x >= view.x && e.x <= view.x + view.w && e.ty >= view.y && e.ty <= view.y + view.h;
      const s = assistSnap(raw, W.enemies, e => e.hp > 0 && onScreen(e) && lineOfSight(W, gx, gy, e.x, e.ty), assistHeld);
      if (s.on !== assistHeld) { assistHeld = s.on; assistT = 0; } else assistT += dt;
      const tx = s.on ? s.on.x : s.x, ty = s.on ? s.on.ty : s.y, d = Math.hypot(tx - gx, ty - gy);
      W.p.assist = { x: s.x, y: s.y, snap: !!s.on, ex: s.on ? s.on.x : 0, ey: s.on ? s.on.ty : 0, er: s.on ? s.on.r : 0 };
      R = { on: !!s.on && assistT >= DEV.aaDelay, show: true, nx: d > 1 ? (tx - gx) / d : W.p.face, ny: d > 1 ? (ty - gy) / d : 0, vis: 0 };
    } else R = { on: false, show: R.show, nx: R.nx, ny: R.ny, vis: 0 };
  } else if (!TR.active) { assistOut = false; assistHeld = null; }
  // picking a Discriminate's target: the same pointer and ring, snapping onto anything it can be set on;
  // letting go on a thing sets it (for good), letting go on nothing cancels. Nothing fires meanwhile
  if (pick != null && !G.RPV) {
    const IN = G.input.current;
    if (!pickHint) { pickHint = true; toast(W, 'Aim at a target, let go to set it'); }
    if (TR.active) {
      pickOut = true;
      const view = { x: W.camX, y: W.camY, w: W.viewW || 400, h: W.viewH || 300 };
      const raw = assistPointer(gx, gy, TR.nx, TR.ny, TR.mag, view);
      const s = assistSnap(raw, pickables(W, view), () => true, pickHeld);
      pickHeld = s.on;
      W.p.assist = { x: s.x, y: s.y, snap: !!s.on, ex: s.on ? s.on.x : 0, ey: s.on ? s.on.ty : 0, er: s.on ? s.on.r : 0 };
    } else if (pickOut || W.p.dead) {
      if (pickHeld && LO.bag[pick] === 'discrim') {
        LO.bag[pick] = discrimId(pickHeld.t);
        toast(W, 'Discriminate → ' + targetName(pickHeld.t)); SFX.ui('mod');
      } else toast(W, 'Discriminate: no target set');
      IN.pickTarget = null; pickOut = false; pickHeld = null; pickHint = false;
      IN.notify();
    }
    R = { on: false, show: false, nx: W.p.face, ny: 0 };
  } else { pickOut = false; pickHeld = null; pickHint = false; }
  if (W.p.dead) R.on = false;
  W.p.aim = R;

  if (R.show) W.p.face = R.nx >= 0 ? 1 : -1;
  // swinging on a vine you keep facing the way you were, unless you push the other way (owner)
  else if (W.p.swing) { if (Math.abs(W.p.steer || 0) > 0.1) W.p.face = W.p.steer > 0 ? 1 : -1; }
  else if (Math.abs(W.p.vx) > 10) W.p.face = W.p.vx > 0 ? 1 : -1;

  // every gun you carry ticks down and tops up its mana, holstered or not
  for (const g of LO.guns) {
    if (!g) continue;
    const pas = gunPassives(g);
    const recharging = g.rechT > 0;
    g.delayT -= dt; g.rechT -= dt;
    if (recharging && g.rechT <= 0 && g === LO.guns[LO.sel] && (g.rechLen || 0) >= 0.45) SFX.fx('ready');
    g.mana = Math.min(g.manaMax + pas.manaMax, g.mana + (g.manaRegen + pas.manaRegen) * dt);
  }
  const gun = LO.guns[LO.sel];
  // Questions Later: the trigger is always down, aimed where you aim (or the way you face)
  const auto = !!gun && !W.p.dead && gunPassives(gun).auto;
  if ((R.on || auto) && gun && gun.delayT <= 0 && gun.rechT <= 0) cast(W, G, gun, gx, gy, R.nx, R.ny);
}
