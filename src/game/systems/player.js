// @ts-check
// You: the perk bag, your health (maxHp, and hurt: shields, extra lives, death) and which
// hand holds the torch; the jetpack's cough (sputterStep) and the dead stick (NO_INPUT);
// and two parts of step(): moving you (movePlayer) and the torch's flicker (stepTorch).

import { SFX } from '../../audio/sfx.js';
import {
  AIR_ACC, CELL, CLIMB, COL, DEAD, FUEL_DRAIN, FUEL_REGEN, FUEL_RESTART, GRAVITY, GROUND_ACC, JET,
  JET_ACC, PH, PW, SHOP_FLOOR, WALK, WEB_HAND, WH
} from '../../core/consts.js';
import { approach, clamp } from '../../core/util.js';
import { activePerks, perkBag } from '../../data/perks.js';
import { DEV, kr, spr } from '../../dev/knobs.js';
import { clearSave, saveCollection } from '../../save/save.js';
import { darkDepthAt, torchStep } from '../../world/dark.js';
import { archNear } from '../../world/decorate.js';
import { ragHip, ragNew, ragStep } from '../../world/ragdoll.js';
import { hangRootX, hangRootY, swings } from '../../world/sway.js';
import { paintFog } from './fog.js';
import { burst, toast } from './particles.js';
import { boxHit, solidAt } from './terrain.js';
import { webNear } from './webs.js';

// ---- perks ----
// Everything the perks you are carrying add up to, recomputed whenever the run's perk
// list changes and read all over step() and draw(). Neutral (all multipliers 1, all
// flags 0) until a perk is found, so a run with no perks behaves exactly as before.
/** @param {World} W @param {GameCtx} G */
export const refreshBag = (W, G) => { W.pb = perkBag(activePerks(G.input.current.loadout)); };
// the true maximum health: the perk bag's answer plus the running +25 per heart room.
/** @param {World} W @param {GameCtx} G */
export const maxHp = (W, G) => W.pb.maxHp + (G.input.current.loadout.maxBonus || 0);

// The suit changed (a perk fitted or taken out): the perk bag again, and what a change does at once:
// a higher cap comes full (Extra Health), a lower one trims you (Glass Cannon), All-Seeing Eye
// lights the floor, the ghost turns up
/** @param {World} W @param {GameCtx} G */
export function applyPerks(W, G) {
  const before = maxHp(W, G);
  refreshBag(W, G);
  const after = maxHp(W, G);
  if (after > before) W.p.hp += after - before;
  W.p.hp = Math.min(W.p.hp, after);
  if (W.pb.seeAll) { W.seen.fill(2); paintFog(W, G); }
  if (W.pb.ghost && !W.ghost) W.ghost = { x: W.p.x, y: W.p.y, cd: 0 };
}

/** @param {World} W @param {GameCtx} G @param {number} n */
export function hurt(W, G, n) {
  if (W.p.dead || n <= 0) return;
  // Permanent Shield soaks a hit whole, then winds back up over a couple of seconds
  if (W.pb.shield && W.p.shieldReady) {
    W.p.shieldReady = false; W.p.shieldT = 2.5;
    burst(W, W.p.x + PW / 2, W.p.y + PH / 2, 10, '#7ad7ff');
    SFX.ui('shield');
    return;
  }
  W.p.hp = Math.max(0, W.p.hp - n);
  W.p.hitT = 0.3;
  if (W.p.hp > 0) SFX.ui('hurt');
  if (W.p.hp === 0) {
    // Extra Life gets you back up once, at full health
    const LO = G.input.current.loadout;
    if (W.pb.lives > (LO.usedLives || 0)) {
      LO.usedLives = (LO.usedLives || 0) + 1;
      W.p.hp = maxHp(W, G);
      W.p.shieldReady = true; W.p.shieldT = 0;
      burst(W, W.p.x + PW / 2, W.p.y + PH / 2, 24, '#ff5a36');
      SFX.ui('revive');
      toast(W, 'Back from the dead');
      G.input.current.notify();
      return;
    }
    W.p.dead = true; burst(W, W.p.x + PW / 2, W.p.y + PH / 2, 24, COL.player);
    W.strings.length = 0;
    SFX.ui('die');
    clearSave();                          // a death is final: reopening starts a new run
    // and the mods you unlocked go with it (the perks you unlocked stay)
    if (G.input.current.collection) { G.input.current.collection.length = 0; saveCollection([]); }
  }
}

// The hand torch is archived (v0.0.145, owner: kept for creatures later): a light on the gun took its
// place (render/light.js, the beam). true brings the flame, its embers and the round lamp back
export const HAND_TORCH = false;

// The torch hand: whichever one the gun is not in, so the two never sit on top of
// each other. Aiming behind you swaps hands, the same way the gun does.
/** @param {World} W */
export const torchHand = (W) => {
  const a = W.p.aim.show ? W.p.aim.nx : W.p.face;
  return { x: W.p.x + PW / 2 + (a >= 0 ? -5.5 : 5.5), y: W.p.y + 9 };
};

// The jetpack's nozzle: the bottom of the backpack (art/sprites.js paintBody: the pack's panel at the
// sprite's x −4.4, behind you, its foot 17.6 down from your top). The flame and its smoke come out here
export const NOZZLE_X = 4.4, NOZZLE_Y = 17.6;
/** @param {World} W @returns {{ x: number, y: number }} */
export const jetNozzle = W => ({ x: W.p.x + PW / 2 - NOZZLE_X * (W.p.face || 1), y: W.p.y + NOZZLE_Y });

// ---- the jetpack ----
// Near the bottom of the tank the jet coughs: short random cut-outs, more often and a touch
// longer the closer the tank is to dry. `st` keeps the cut-out clock and how long the jet
// has been held on (which bends its pitch). Returns true while it's cut out; `st.start`
// is true on the frame a cut-out begins.
export const SPUTTER_FUEL = 0.25;
/** @param {World['jetSt']} st @param {number} dt @param {number} fuel @param {unknown} on @param {Rnd} [rnd] */
export function sputterStep(st, dt, fuel, on, rnd) {
  rnd = rnd || Math.random;
  st.start = false;
  if (!on) { st.cut = 0; st.gap = 0; st.onT = 0; return false; }
  st.onT = (st.onT || 0) + dt;
  st.cut = Math.max(0, (st.cut || 0) - dt);
  st.gap = Math.max(0, (st.gap || 0) - dt);                  // a catch of breath between coughs
  if (st.gap <= 0 && fuel < SPUTTER_FUEL) {
    const w = 1 - Math.max(0, fuel) / SPUTTER_FUEL;          // 0 at the line, 1 bone dry
    if (rnd() < dt * (1 + 7 * w)) {
      st.cut = 0.04 + rnd() * (0.05 + 0.08 * w);
      st.gap = st.cut + 0.1 + rnd() * 0.2;
      st.start = true;
    }
  }
  return st.cut > 0;
}
// the stick when nothing is pushing it (step() steers you with this once you are dead)
export const NO_INPUT = { active: false, nx: 0, ny: 0, mag: 0, dy: 0, on: false };

// ---- dead: the body is a ragdoll (world/ragdoll.js) that falls, slumps and is thrown about by
// blasts (explode pushes it); you (W.p) follow its hip, so the camera and the recorder do too ----
/** @param {World} W @param {number} dt */
export function corpseStep(W, dt) {
  const p = W.p;
  if (!p.rag) p.rag = ragNew(p.x, p.y, PW, p.face || 1, p.vx, p.vy);
  ragStep(p.rag, dt, (x, y) => solidAt(W, x, y));
  const hip = ragHip(p.rag);
  p.x = hip.x - PW / 2; p.y = hip.y - 15; p.vx = hip.vx; p.vy = hip.vy;
  p.flame = 0; p.jet = 0; p.onGround = false;
}

// ---- moving you (a part of step) ----
// Hanging from a web line or an arched vine (direction ux, uy): does a push (nx, ny at strength
// mag) let go? Any push mostly across the line, in any direction (more than LINE_OFF of it), or
// one along it past an end you're at (atA: the start, atB: the end). Before v125 only pushing
// down let go, so pushing sideways off a steep line, or off its end, left you stuck on it.
export const LINE_OFF = 0.75;
/** @param {number} nx @param {number} ny @param {number} mag @param {number} ux @param {number} uy @param {boolean} atA @param {boolean} atB */
export function lineLetGo(nx, ny, mag, ux, uy, atA, atB) {
  if (mag <= 0.5) return false;
  const along = nx * ux + ny * uy, across = Math.abs(nx * uy - ny * ux);
  return across > LINE_OFF || (atB && along > 0.3) || (atA && along < -0.3);
}

// letting go of a line: no grabbing one again for a moment, and the push carries you off it
/** @param {World} W @param {{ nx: number, ny: number }} L @param {number} mag */
function letGo(W, L, mag) {
  W.webLetGo = 0.35;
  W.p.vx = L.nx * mag * WALK * W.pb.walk * DEV.move * 0.8;
  W.p.vy = Math.max(-90, L.ny * mag * 90);
}

// The stick (or the keys), the jetpack and its fuel, steering (walking, flying, climbing a
// vine, an arched vine or a web line), moving against the pixel terrain, and your footsteps.
/** @param {World} W @param {GameCtx} G @param {StepFrame} F */
export function movePlayer(W, G, F) {
  const { dt } = F;
  if (W.p.dead) { corpseStep(W, dt); return; }
  if (W.p.rag) W.p.rag = null;
  // movement: thumbstick first, otherwise keyboard (full strength)
  let L = G.input.current.left;
  if (!L.active) {
    const keys = G.input.current.keys;
    const kx = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
    if (kx || keys.w) {
      const ny = keys.w ? -1 : 0, len = Math.hypot(kx, ny);
      L = { active: true, nx: kx / len, ny: ny / len, mag: 1, dy: keys.w ? -1 : 1, on: true };
    }
  }
  if (W.p.dead) L = NO_INPUT;
  W.p.jx = L.nx; W.p.jy = L.ny;

  // ---- jetpack and fuel ----
  const raw = L.active ? L.mag : 0;
  const mag = raw > DEAD ? (raw - DEAD) / (1 - DEAD) : 0;
  const wantJet = mag > 0 && L.dy < 0;
  if (W.p.empty && W.p.fuel >= FUEL_RESTART) W.p.empty = false;
  const jet = wantJet && !W.p.empty;
  // holding a vine (or chain, root, frozen fall): no jet means you hang on and get your
  // breath back; the stick climbs you up and down
  const climbing = W.zfx.climb && !jet && !W.p.dead;
  W.p.jet = jet ? mag : 0;
  // low on fuel it coughs: the flame, smoke and roar cut out for a blink, you drop a
  // little, and it spits a grey puff
  W.p.sput = sputterStep(W.jetSt, dt, W.p.fuel, jet);
  W.p.flame = W.p.sput ? 0 : W.p.jet;
  if (W.p.sput) W.p.cough = 0.15;
  else W.p.cough = Math.max(0, W.p.cough - dt);
  if (W.jetSt.start) {
    W.p.vy += DEV.sputDip;
    for (let i = 0; i < 3; i++)
      W.smoke.push({ x: jetNozzle(W).x + (Math.random() - 0.5) * 4, y: W.p.y + NOZZLE_Y + 2,
        vx: (Math.random() - 0.5) * 40, vy: 20 + Math.random() * 30,
        r: 2.5 + Math.random() * 2, life: 0.7 + Math.random() * 0.4, max: 1.1, c: '#6f767e', a: 0.8, jet: true });
  }
  if (jet) {
    W.p.fuel -= FUEL_DRAIN * (0.5 + 0.5 * mag) * dt / W.pb.fuel;    // a bigger tank (Jetpack Fuel) drains slower
    if (W.p.fuel <= 0) { W.p.fuel = 0; W.p.empty = true; }
  } else if (W.p.onGround || climbing) {
    W.p.fuel = Math.min(1, W.p.fuel + FUEL_REGEN * W.pb.refuel * dt);
  }

  // ---- steering ----
  const pcx0 = W.p.x + PW / 2;
  W.p.kick -= dt;
  const k = W.p.kick > 0 ? 0.15 : 1;   // let explosions push you around briefly
  // each spider string on you slows you, and so does each web line you're pushing through
  const tied = W.strings.reduce((m, s) => m * s.slow, 1) * W.zfx.webMul;
  W.webLetGo -= dt;
  if (jet && W.p.sput) {
    // coughing: steer on, but no lift for the blink
    W.p.vx = approach(W.p.vx, L.nx * mag * JET * W.pb.walk * DEV.move * tied, JET_ACC * dt * k);
    W.p.vy = Math.min(W.p.vy + GRAVITY * dt, 900);
  } else if (jet) {
    W.p.vx = approach(W.p.vx, L.nx * mag * JET * W.pb.walk * DEV.move * tied, JET_ACC * dt * k);
    const ty = L.ny * mag * JET * W.pb.jet * DEV.move * tied;    // Faster Levitation lifts harder
    // rising beats a fall instantly (except just after a cough, which it has to climb
    // back out of); only an explosion still throws you around
    if (ty < W.p.vy && W.p.kick <= 0 && W.p.cough <= 0) W.p.vy = ty;
    else W.p.vy = approach(W.p.vy, ty, JET_ACC * dt * k);
    if (W.zfx.rev) W.p.vy -= GRAVITY * W.zfx.rev * dt;          // dark matter lifts you
  } else if (climbing && W.zfx.arch && W.p.kick <= 0) {
    // hanging from an arched vine: the stick runs you along its curve, hands on it. Push
    // off it (any way across it, or past an end) to let go (lineLetGo).
    const ar = W.zfx.arch, hy = W.p.y + WEB_HAND, q = archNear(ar, pcx0, hy);
    const a = ar.arc[q.k], b = ar.arc[q.k + 1], ul = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ux = (b[0] - a[0]) / ul, uy = (b[1] - a[1]) / ul;
    const along = mag > 0 ? (L.nx * ux + L.ny * uy) * mag : 0;
    const A0 = ar.arc[0], A1 = ar.arc[ar.arc.length - 1];
    const atA = Math.hypot(q.x - ar.x - A0[0], q.y - ar.y - A0[1]) < 1.5, atB = Math.hypot(q.x - ar.x - A1[0], q.y - ar.y - A1[1]) < 1.5;
    if (lineLetGo(L.nx, L.ny, mag, ux, uy, atA, atB)) letGo(W, L, mag);
    else {
      const v = along * (ar.climb || (ar.climb = kr('arClimb'))) * tied;
      W.p.vx = approach(W.p.vx, ux * v + (q.x - pcx0) * 14, 1800 * dt);
      W.p.vy = approach(W.p.vy, uy * v + (q.y - hy) * 14, 1800 * dt);
    }
  } else if (climbing && W.zfx.web && W.p.kick <= 0) {
    // hanging from a spider's web line: the stick runs you along it, hands on the line.
    // Push off it (any way across it, or past an end) to let go (lineLetGo).
    const ln = W.zfx.web, wl = Math.hypot(ln.b0x - ln.a0x, ln.b0y - ln.a0y) || 1;
    let ux = (ln.b0x - ln.a0x) / wl, uy = (ln.b0y - ln.a0y) / wl;
    const along = mag > 0 ? (L.nx * ux + L.ny * uy) * mag : 0;
    const e = webNear(ln, pcx0, W.p.y + WEB_HAND);
    const atA = Math.hypot(e.x - ln.a0x, e.y - ln.a0y) < 1.5, atB = Math.hypot(e.x - ln.b0x, e.y - ln.b0y) < 1.5;
    if (lineLetGo(L.nx, L.ny, mag, ux, uy, atA, atB)) letGo(W, L, mag);
    else {
      const v = along * (ln.climb || (ln.climb = spr('webClimb'))) * tied, hy = W.p.y + WEB_HAND, q = webNear(ln, pcx0, hy);
      W.p.vx = approach(W.p.vx, ux * v + (q.x - pcx0) * 14, 1800 * dt);
      W.p.vy = approach(W.p.vy, uy * v + (q.y - hy) * 14, 1800 * dt);
    }
  } else {
    // decoration underfoot: snow, slime and puddles slow you, ice takes your grip away
    const target = mag > 0 ? L.nx * mag * WALK * W.pb.walk * DEV.move * W.zfx.slow * tied : 0;
    // hanging off a vine, the stick not pushing across: you swing on it like a pendulum about its
    // root (sideways only: the stick still climbs you), until it settles (world/sway.js)
    const cp = W.zfx.climb, vine = cp && 'k' in cp && swings(cp) ? cp : null;
    W.p.swing = 0;
    if (vine && climbing && W.p.kick <= 0 && !W.p.onGround && Math.abs(target) < WALK * 0.25) {
      const hy = W.p.y + WEB_HAND, Lh = clamp(hy - vine.y - hangRootY(vine), 6, vine.len);
      const s = clamp((pcx0 - vine.x - hangRootX(vine)) / Lh, -1, 1), a = Math.asin(s);
      W.p.vx += (-GRAVITY * DEV.vineGrav * s * Math.sqrt(1 - s * s) - DEV.vineDamp * W.p.vx) * dt;
      if (Math.abs(a) > DEV.vineMax && W.p.vx * a > 0) W.p.vx = 0;   // the widest it swings
      W.p.swing = 1;
    } else W.p.vx = approach(W.p.vx, target, (W.p.onGround ? GROUND_ACC * (W.zfx.slick ? 0.08 : 1) : AIR_ACC) * dt * k);
    if (climbing && W.p.kick <= 0) W.p.vy = approach(W.p.vy, mag > 0 ? L.ny * mag * CLIMB * tied : 0, 1800 * dt);
    else W.p.vy = Math.min(W.p.vy + GRAVITY * dt * (1 - 2 * W.zfx.rev), 900);   // dark matter flips it
  }

  // ---- move against the pixel terrain ----
  const wasGround = W.p.onGround, fallV = W.p.vy;
  let n = Math.ceil(Math.abs(W.p.vx * dt));
  if (n > 0) {
    const sx = W.p.vx * dt / n;
    for (let i = 0; i < n; i++) {
      if (!boxHit(W, W.p.x + sx, W.p.y)) { W.p.x += sx; continue; }
      let moved = false;
      const maxUp = wasGround ? 6 : 3;          // walk up small bumps and slopes
      for (let up = 1; up <= maxUp; up++) {
        if (!boxHit(W, W.p.x + sx, W.p.y - up)) { W.p.x += sx; W.p.y -= up; moved = true; break; }
      }
      if (!moved) { W.p.vx = 0; break; }
    }
  }
  const y0 = W.p.y;
  n = Math.ceil(Math.abs(W.p.vy * dt));
  if (n > 0) {
    const sy = W.p.vy * dt / n;
    for (let i = 0; i < n; i++) {
      if (!boxHit(W, W.p.x, W.p.y + sy)) { W.p.y += sy; continue; }
      if (sy > 0) W.p.y = Math.floor((W.p.y + sy + PH - 0.001) / CELL) * CELL - PH;
      else W.p.y = (Math.floor((W.p.y + sy) / CELL) + 1) * CELL;
      if (boxHit(W, W.p.x, W.p.y)) W.p.y -= sy;   // fallback
      W.p.vy = 0;
      break;
    }
  }
  // an item plinth's foot is a ledge: falling onto it you land (rising, you pass up through)
  if (W.p.vy >= 0) { const top = ledgeUnder(W, y0 + PH, W.p.y + PH); if (top !== null) { W.p.y = top - PH; W.p.vy = 0; } }
  // stick to the ground when walking down slopes
  if (wasGround && !jet && W.p.vy >= 0 && W.p.kick <= 0 && !boxHit(W, W.p.x, W.p.y + 1)) {
    for (let dn = 1; dn <= 6; dn++) {
      if (boxHit(W, W.p.x, W.p.y + dn + 1)) { W.p.y += dn; W.p.vy = 0; break; }
    }
  }
  // never stay stuck inside terrain
  if (boxHit(W, W.p.x, W.p.y)) {
    for (let up = 1; up <= 40; up++) if (!boxHit(W, W.p.x, W.p.y - up)) { W.p.y -= up; break; }
  }
  if (W.p.y > WH) { W.p.x = W.start.x; W.p.y = W.start.y; W.p.vx = 0; W.p.vy = 0; }
  W.p.onGround = boxHit(W, W.p.x, W.p.y + 0.5) || (W.p.vy >= 0 && ledgeUnder(W, W.p.y + PH - 0.01, W.p.y + PH + 0.5) !== null);
  // footsteps and landings, in the sound of whatever you're standing on
  if (!W.p.dead) {
    if (W.p.onGround && !wasGround && fallV > 200) SFX.fx('land', null, null, { v: fallV, s: W.zfx.surface });
    if (W.p.onGround && Math.abs(W.p.vx) > 40) {
      if ((W.stepT -= dt * Math.abs(W.p.vx) / 40) <= 0) { W.stepT = 1; SFX.fx('step', null, null, W.zfx.surface); }
    } else W.stepT = Math.min(W.stepT, 0.35);
  }
}

// ---- the torch (a part of step) ----
// Its flicker (flick, which everything that lights the cave reads), the flame's particles,
// its lean, and the glow's own flicker.
/** @param {World} W @param {StepFrame} F */
export function stepTorch(W, F) {
  const { dt } = F;
  // A random walk with two sines on top, which is what makes a flame gutter rather
  // than pulse. It never goes above 1: flicker means the light dipping, and a canvas
  // globalAlpha over 1 is simply ignored.
  W.torchT += dt;
  // floor 2's dark zones: crossing a zone's edge the gun light fails, flickering (world/dark.js torchStep)
  W.torchLit = torchStep(W.torchFail, W.p.dead ? 0 : darkDepthAt(W, W.p.x + PW / 2, W.p.y + PH / 2, CELL), dt);
  W.flickN += (Math.random() - 0.5) * 2.6 * dt;
  W.flickN *= 0.94;
  W.flick = clamp(0.94 + W.flickN + 0.04 * Math.sin(W.torchT * 11.3) + 0.025 * Math.sin(W.torchT * 19.7),
    0.84, 1);
  W.torchAcc += dt;
  if (!HAND_TORCH) W.torchAcc = 0;          // archived: no flame, no embers
  while (W.torchAcc > 0.04) {
    W.torchAcc -= 0.04;
    const th = torchHand(W);
    const life = 0.3 + Math.random() * 0.35;
    W.torchP.push({ x: th.x + (Math.random() - 0.5) * 2, y: th.y - 7,
      vx: (Math.random() - 0.5) * 10 + W.p.vx * 0.15, vy: -20 - Math.random() * 22,
      life, max: life, s: 1 + Math.random() * 1.3,
      c: Math.random() < 0.5 ? COL.flame2 : COL.flame });
    if (W.torchP.length > 60) W.torchP.shift();
  }
  for (let i = W.torchP.length - 1; i >= 0; i--) {
    const q = W.torchP[i];
    q.vy += 30 * dt; q.vx *= 0.98;
    q.x += q.vx * dt; q.y += q.vy * dt;
    if ((q.life -= dt) <= 0) W.torchP.splice(i, 1);
  }
  // the flame's lean: spring toward "opposite your velocity", so a sudden move flings
  // it back and it wobbles upright again when you stop
  const wantX = clamp(-W.p.vx * 0.055, -11, 11), wantY = clamp(-W.p.vy * 0.03, -5, 7);
  W.leanVX += ((wantX - W.leanX) * 90 - W.leanVX * 9) * dt;
  W.leanVY += ((wantY - W.leanY) * 90 - W.leanVY * 9) * dt;
  W.leanX += W.leanVX * dt; W.leanY += W.leanVY * dt;
  // the glow gets its own quicker, deeper flicker on top of flick (the map light is untouched)
  W.glowN += (Math.random() - 0.5) * 6 * dt; W.glowN *= 0.9;
}

// The item plinths' feet, as one-way ledges: the hidden rooms' altars (so a prize whose rock
// you dug away still has something to land on) and the shop's plinths. The top of the first one
// your feet crossed going down from f0 to f1 under you, or null
/** @param {World} W @param {number} f0 @param {number} f1 @returns {number | null} */
export function ledgeUnder(W, f0, f1) {
  const x0 = W.p.x, x1 = W.p.x + PW;
  let best = null;
  /** @param {number} cx @param {number} hw @param {number} top */
  const at = (cx, hw, top) => {
    if (x1 > cx - hw && x0 < cx + hw && f0 <= top + 0.01 && f1 >= top && (best === null || top < best)) best = top;
  };
  for (const r of W.rooms) at(r.x, 12, r.y + 14);
  for (const it of W.stock || []) at(it.x, 11, SHOP_FLOOR * CELL - 5);
  return best;
}
