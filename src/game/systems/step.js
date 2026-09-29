// One frame of the simulation: step(W, G, dt), run by Game's loop on every unpaused frame
// (then the recorder's recFrame, then draw). It calls its parts one after another in the
// order they have always run (they feed each other within the frame, and share the sim's
// Math.random stream), handing each the frame object F (REFACTOR.md D18). Being split into
// those parts (P3.4); what isn't a part yet is still inline in step, in its place.

import { jetPitch } from '../../audio/recipes.js';
import { SFX } from '../../audio/sfx.js';
import {
  AIM_DEAD, AIR_ACC, CELL, CLIMB, COIN_PULL, COL, DEAD, FUEL_DRAIN, FUEL_REGEN, FUEL_RESTART,
  GRAVITY, GROUND_ACC, JET, JET_ACC, PATROL_R, PH, PICKUP_COOL, PW, SHOP_Y, WALK, WEB_HAND, WH
} from '../../core/consts.js';
import { angDiff, approach, clamp, hexRgb, turn } from '../../core/util.js';
import { jellyPal, jellyStep, tentacleTouch } from '../../creatures/jelly.js';
import { spiderStep } from '../../creatures/spider.js';
import { HUNTERS } from '../../data/creatures.js';
import { PERKS } from '../../data/perks.js';
import { DEV, kr, spr } from '../../dev/knobs.js';
import { gunPassives } from '../../spells/cast.js';
import { caveGun } from '../../spells/guns.js';
import { MODS, VACUUM_WAIT } from '../../spells/mods.js';
import { DRIFT_ACC, DRIFT_CHASE, DRIFT_R, driftStep, wigTurn } from '../../spells/trace.js';
import { archNear } from '../../world/decorate.js';
import { fireArea, fireDouse } from '../../world/fire.js';
import { puffSpores } from './ambience.js';
import { critRoll, explodeCross, shove, spray, teleportTo } from './bullets.js';
import { damageEnemy, fireEnemyShot, natural } from './enemies.js';
import { fieldPayload } from './fields.js';
import { fireBlast, fireFrame, ignite, setAlight, youAlight } from './fire.js';
import { paintFog } from './fog.js';
import { cast, firePayload } from './gun.js';
import { enterLevel } from './level-entry.js';
import { addArc, lightningStep } from './lightning.js';
import { burst, goo, splat, toast } from './particles.js';
import { NO_INPUT, hurt, maxHp, refreshBag, sputterStep, torchHand } from './player.js';
import { decorStep } from './props.js';
import { ratFrame, spawnRat } from './rats.js';
import { saveRun } from './save-run.js';
import { glowDot, rnd, shotBounce, shotDeath, shotGrind, shotTrail } from './shotlooks.js';
import { boxHit, dig, enemyAt, explode, lineOfSight, solidAt, solidCell } from './terrain.js';
import { webNear } from './webs.js';

export function step(W, G, dt) {
  // the frame: what step's parts hand on to each other. LO (the loadout) and MHP (your
  // maximum health) are filled in by stepPerks, pcx/pcy (your centre, once you've moved)
  // by the portal check
  const F = { dt, LO: null, MHP: 0, pcx: 0, pcy: 0 };
  if (stepRequests(W, G, F)) return;
  stepPerks(W, G, F);
  const LO = F.LO, MHP = F.MHP;
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
      W.smoke.push({ x: W.p.x + PW / 2 + (Math.random() - 0.5) * 6, y: W.p.y + PH + 2,
        vx: (Math.random() - 0.5) * 40, vy: 20 + Math.random() * 30,
        r: 2.5 + Math.random() * 2, life: 0.7 + Math.random() * 0.4, max: 1.1, c: '#6f767e', a: 0.8 });
  }
  if (jet) {
    W.p.fuel -= FUEL_DRAIN * (0.5 + 0.5 * mag) * dt;
    if (W.p.fuel <= 0) { W.p.fuel = 0; W.p.empty = true; }
  } else if (W.p.onGround || climbing) {
    W.p.fuel = Math.min(1, W.p.fuel + FUEL_REGEN * dt);
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
    // down (not along it) to let go.
    const ar = W.zfx.arch, hy = W.p.y + WEB_HAND, q = archNear(ar, pcx0, hy);
    const a = ar.arc[q.k], b = ar.arc[q.k + 1], ul = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ux = (b[0] - a[0]) / ul, uy = (b[1] - a[1]) / ul;
    const along = mag > 0 ? (L.nx * ux + L.ny * uy) * mag : 0;
    if (mag > 0.5 && L.ny > 0.7 && Math.abs(along) < 0.5) { W.webLetGo = 0.35; W.p.vy = 40; }
    else {
      const v = along * (ar.climb || (ar.climb = kr('arClimb'))) * tied;
      W.p.vx = approach(W.p.vx, ux * v + (q.x - pcx0) * 14, 1800 * dt);
      W.p.vy = approach(W.p.vy, uy * v + (q.y - hy) * 14, 1800 * dt);
    }
  } else if (climbing && W.zfx.web && W.p.kick <= 0) {
    // hanging from a spider's web line: the stick runs you along it, hands on the line.
    // Push down (not along it) to let go.
    const ln = W.zfx.web, wl = Math.hypot(ln.b0x - ln.a0x, ln.b0y - ln.a0y) || 1;
    let ux = (ln.b0x - ln.a0x) / wl, uy = (ln.b0y - ln.a0y) / wl;
    const along = mag > 0 ? (L.nx * ux + L.ny * uy) * mag : 0;
    if (mag > 0.5 && L.ny > 0.7 && Math.abs(along) < 0.5) { W.webLetGo = 0.35; W.p.vy = 40; }
    else {
      const v = along * (ln.climb || (ln.climb = spr('webClimb'))) * tied, hy = W.p.y + WEB_HAND, q = webNear(ln, pcx0, hy);
      W.p.vx = approach(W.p.vx, ux * v + (q.x - pcx0) * 14, 1800 * dt);
      W.p.vy = approach(W.p.vy, uy * v + (q.y - hy) * 14, 1800 * dt);
    }
  } else {
    // decoration underfoot: snow, slime and puddles slow you, ice takes your grip away
    const target = mag > 0 ? L.nx * mag * WALK * W.pb.walk * DEV.move * W.zfx.slow * tied : 0;
    W.p.vx = approach(W.p.vx, target, (W.p.onGround ? GROUND_ACC * (W.zfx.slick ? 0.08 : 1) : AIR_ACC) * dt * k);
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
  W.p.onGround = boxHit(W, W.p.x, W.p.y + 0.5);
  // footsteps and landings, in the sound of whatever you're standing on
  if (!W.p.dead) {
    if (W.p.onGround && !wasGround && fallV > 200) SFX.fx('land', null, null, { v: fallV, s: W.zfx.surface });
    if (W.p.onGround && Math.abs(W.p.vx) > 40) {
      if ((W.stepT -= dt * Math.abs(W.p.vx) / 40) <= 0) { W.stepT = 1; SFX.fx('step', null, null, W.zfx.surface); }
    } else W.stepT = Math.min(W.stepT, 0.35);
  }

  const pcx = W.p.x + PW / 2, pcy = W.p.y + PH / 2;
  if (!W.p.dead && pcx > W.portal.x && pcx < W.portal.x + W.portal.w &&
      pcy > W.portal.y && pcy < W.portal.y + W.portal.h) {
    W.floor++;
    enterLevel(W, G);
    saveRun(W, G);
    SFX.fx('portalIn');
    toast(W, 'Floor ' + W.floor);
    G.input.current.notify();
    return;
  }

  // ---- aiming: thumbstick first, otherwise mouse ----
  const gx = pcx, gy = W.p.y + PH * 0.4;
  const TR = G.input.current.right;
  let R = { on: false, show: false, nx: W.p.face, ny: 0 };
  // line shows as soon as you touch the stick, fading in with the push: 0 at the centre,
  // full at the trigger ring (vis is what the Trajectory Sight line reads)
  if (TR.active) R = { on: TR.on, show: true, nx: TR.nx, ny: TR.ny, vis: Math.min(1, TR.mag / AIM_DEAD) };
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
  if (W.p.dead) R.on = false;
  W.p.aim = R;

  if (R.show) W.p.face = R.nx >= 0 ? 1 : -1;
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
  if (R.on && gun && gun.delayT <= 0 && gun.rechT <= 0) cast(W, G, gun, gx, gy, R.nx, R.ny);

  // ---- shots ----
  for (let i = W.bullets.length - 1; i >= 0; i--) {
    const b = W.bullets[i];
    b.life -= dt; b.spin += dt * 12; b.age = (b.age || 0) + dt;
    let dead = b.life <= 0, boom = false;
    if (dead && b.lifeBoom && b.explode) { dead = false; boom = true; }   // a bomb's fuse burns down
    if (b.fuse && b.age >= b.fuse) { boom = b.explode ? true : false; if (!b.explode) dead = true;
      else { explodeCross(W, G, b); dead = true; boom = false; } }
    if (b.grav) b.vy += b.grav * dt;
    if (b.drag) { const k = Math.exp(-b.drag * dt); b.vx *= k; b.vy *= k; }
    if (b.accel) { const f = 1 + b.accel * dt; b.vx *= f; b.vy *= f; }
    if (b.vmax) { const v = Math.hypot(b.vx, b.vy); if (v > b.vmax) { b.vx *= b.vmax / v; b.vy *= b.vmax / v; } }
    if (b.wig) turn(b, wigTurn(b.wig, b.age, dt));
    if (b.look) shotTrail(W, b, dt);
    // paths: each one bends the velocity, and tracePath draws the same bends
    if (b.spiral) turn(b, b.spiral * dt);
    if (b.pong && Math.floor(b.age / 0.45) % 2 === 1) { b.vx = -b.vx; b.vy = -b.vy; b.age += dt; }
    if (b.orbit) turn(b, b.orbit * dt);
    if (b.boomer) {
      const want = Math.atan2(W.p.y + PH / 2 - b.y, W.p.x + PW / 2 - b.x);
      turn(b, clamp(angDiff(want, Math.atan2(b.vy, b.vx)), -b.boomer * dt, b.boomer * dt));
    }
    if (b.eat) dig(W, G, b.x, b.y, b.eat);
    if (b.fire) ignite(W, G, b.x, b.y, b.size + 2, 0.5);     // a fire spell lights what it flies through
    if (b.arc) lightningStep(W, b, dt);
    // a timer lets its payload go in mid-air, and the carrier flies on
    if (b.payload && b.timer != null && (b.timer -= dt) <= 0) firePayload(W, G, b);
    if (b.pull) {
      // Black Hole: heavy gravity. It reaches ~2.2x its pull stat and drags harder the
      // closer you are, so creatures get hauled in and held in the middle of it. It
      // swallows enemy shots that come near, and grinds anything in it every 0.3s.
      const reach = DEV.bhPull * b.pull / 70;          // Dev knob: max pull range
      for (const e of W.enemies) {
        const dx = b.x - e.x, dy = b.y - e.ty, d = Math.hypot(dx, dy) || 1;
        if (d < reach) {
          const f = Math.min(d / dt, 60 + 420 * (1 - d / reach));   // never overshoot the centre
          e.x += dx / d * f * dt; e.y += dy / d * f * dt; e.tgt = null;
        }
      }
      for (let k = W.enemyShots.length - 1; k >= 0; k--) {
        const es = W.enemyShots[k];
        const dx = b.x - es.x, dy = b.y - es.y, d = Math.hypot(dx, dy) || 1;
        if (d < b.size + 6) { burst(W, es.x, es.y, 3, '#c58cff'); SFX.fx('absorb', es.x, es.y); W.enemyShots.splice(k, 1); continue; }
        if (d < reach) { es.vx += dx / d * 900 * dt; es.vy += dy / d * 900 * dt; }
      }
      if ((b.grind = (b.grind || 0) + dt) > 0.3) { b.grind = 0; b.hit = null; }
      // the trail of magic it leaves behind
      if (Math.random() < 0.9) {
        const a = Math.random() * 6.28, rr = b.size * (0.6 + Math.random() * 0.5);
        const life = 0.6 + Math.random() * 0.7;
        W.motes.push({ kind: 'drift', x: b.x + Math.cos(a) * rr, y: b.y + Math.sin(a) * rr,
          vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, life, max: life,
          s: 0.8 + Math.random() * 1.6, c: Math.random() < 0.3 ? '#f0e0ff' : Math.random() < 0.6 ? '#c58cff' : '#8a5cff' });
      }
    }
    if (b.split && b.age > 0.28) {                   // one clean split, partway along
      b.split = 0;
      SFX.fx('split', b.x, b.y);
      for (const turnBy of [-0.3, 0.3]) {
        const c = Object.assign({}, b, { hit: null, split: 0, age: 0 });
        const sp = Math.hypot(b.vx, b.vy), a = Math.atan2(b.vy, b.vx) + turnBy;
        c.vx = Math.cos(a) * sp; c.vy = Math.sin(a) * sp;
        W.bullets.push(c);
      }
    }
    if (b.drift) {
      // Pollen: drags to a stop and floats; locks onto the first creature in range
      // it can see, then speeds back up and homes. Loses the lock if that one dies.
      if (b.lock && W.enemies.indexOf(b.lock) < 0) b.lock = null;
      if (!b.lock) {
        const d = driftStep(b.vx, b.vy, dt); b.vx = d[0]; b.vy = d[1];
        let bd = b.homeR || DRIFT_R;
        for (const e of W.enemies) {
          const dd = Math.hypot(e.x - b.x, e.ty - b.y);
          if (dd < bd && lineOfSight(W, b.x, b.y, e.x, e.ty)) { bd = dd; b.lock = e; }
        }
      }
      if (b.lock) {
        const e = b.lock, sp = Math.min(DRIFT_CHASE, Math.hypot(b.vx, b.vy) + DRIFT_ACC * dt);
        const want = Math.atan2(e.ty - b.y, e.x - b.x);
        const ang = Math.hypot(b.vx, b.vy) < 5 ? want
          : Math.atan2(b.vy, b.vx) + clamp(angDiff(want, Math.atan2(b.vy, b.vx)), -b.homing * dt, b.homing * dt);
        b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
      }
    }
    if (b.homing && !b.drift) {
      let best = null, bd = b.homeR || 260;
      for (const e of W.enemies) {
        const d = Math.hypot(e.x - b.x, e.ty - b.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const sp = Math.hypot(b.vx, b.vy) || 1;
        let ang = Math.atan2(b.vy, b.vx);
        let diff = Math.atan2(best.ty - b.y, best.x - b.x) - ang;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        ang += clamp(diff, -b.homing * dt, b.homing * dt);
        b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
      }
    }
    const sn = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 2));
    for (let st = 0; st < sn && !dead && !boom; st++) {
      const nx = b.x + b.vx * dt / sn, ny = b.y + b.vy * dt / sn;
      const j = enemyAt(W, nx, ny, b.size + 1);
      if (j >= 0 && !(b.hit && b.hit.has(W.enemies[j]))) {
        const e = W.enemies[j];
        const sp = Math.hypot(b.vx, b.vy) || 1;
        damageEnemy(W, j, critRoll(b.dmg, b.crit));
        if (b.fire) setAlight(e);
        burst(W, nx, ny, 4, b.col);
        SFX.hit(nx, ny);
        if (b.knock) shove(e, b.vx / sp, b.vy / sp, b.knock);
        b.x = nx; b.y = ny;
        if (b.payload && b.trig !== 'expire') firePayload(W, G, b);   // a trigger goes off on a hit
        if (b.chain > 0) {                            // hop to the next one along
          (b.hit || (b.hit = new Set())).add(e);
          let best = null, bd = 150;
          for (const o of W.enemies) {
            if (b.hit.has(o)) continue;
            const d = Math.hypot(o.x - nx, o.ty - ny);
            if (d < bd) { bd = d; best = o; }
          }
          if (best) {
            b.chain--;
            SFX.fx('chainhop', nx, ny);
            const a = Math.atan2(best.ty - ny, best.x - nx);
            b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
            b.life = Math.max(b.life, 0.4);
            continue;
          }
        }
        if (b.cluster) { spray(W, b); dead = true; break; }
        if (b.explode) { boom = true; break; }
        if (b.pop) { explode(W, G, nx, ny, b.pop, b.dmg * 0.5); dead = true; break; }
        if (b.pull) { (b.hit || (b.hit = new Set())).add(e); continue; }   // a black hole rolls on
        if (b.pierce > 0) { b.pierce--; (b.hit || (b.hit = new Set())).add(e); }
        else { dead = true; break; }
      }
      if (b.friendly && !W.p.dead && nx > W.p.x - 2 && nx < W.p.x + PW + 2 &&
          ny > W.p.y - 2 && ny < W.p.y + PH + 2) {
        burst(W, nx, ny, 5, b.col); hurt(W, G, Math.round(b.dmg * 2)); dead = true; break;
      }
      if (solidAt(W, nx, ny)) {
        if (b.payload && b.trig !== 'expire') firePayload(W, G, b);   // so does touching rock
        if (b.bounce > 0 && !b.bore && !b.eat) {
          b.bounce--;
          const hx = solidAt(W, nx, b.y), hy = solidAt(W, b.x, ny);
          if (hx || !hy) b.vx = -b.vx;
          if (hy || !hx) b.vy = -b.vy;
          const be = b.bounceE || 0.92;
          b.vx *= be; b.vy *= be;
          const slow = Math.hypot(b.vx, b.vy) < 60;
          if (slow && b.lifeBoom) b.bounce++;         // a bomb at rest doesn't use up its bounces
          if (!slow) SFX.bounce(b.x, b.y);
          if (b.look) shotBounce(W, b);
          if (b.bounceFx === 'explode') explode(W, G, b.x, b.y, Math.max(10, b.explode || 12));
          break;                      // stay put: b.x/b.y are still outside the rock
        }
        b.x = nx; b.y = ny;
        if (b.bore > 0) { if (b.look) shotGrind(W, b, nx, ny); dig(W, G, nx, ny, b.bore); continue; }
        // Matter Eater / Black Hole: eat straight through the rock, digging as it goes,
        // so a fast shot can't outrun the small hole its per-frame eat carves ahead
        if (b.eat > 0) { dig(W, G, nx, ny, b.eat); continue; }
        if (b.cluster) { spray(W, b); dead = true; break; }
        if (b.explode) { boom = true; break; }
        if (b.pop) { explode(W, G, b.x, b.y, b.pop, b.dmg * 0.5); dead = true; break; }
        if (b.pit) dig(W, G, nx, ny, b.pit);                // Noita's small hole where a shot lands
        burst(W, b.x, b.y, 3, b.col);
        SFX.rock(b.x, b.y);
        dead = true;
        break;
      }
      b.x = nx; b.y = ny;
    }
    if (boom) { explode(W, G, b.x, b.y, b.explode, undefined, b.fire); dead = true; }
    if (dead && b.fire) ignite(W, G, b.x, b.y, b.size + 6, 0.9);
    // an expiration trigger goes off however it dies; a trigger stopped by a prop counts as a hit
    if (dead && b.payload && (b.trig === 'expire' || b.struck)) firePayload(W, G, b);
    if (dead && b.tele) teleportTo(W, b);            // Teleport Bolt: you go where it stopped
    if (dead && b.arc && b.trail) {               // the bolt's path lingers for a blink
      b.trail.push({ x: b.x, y: b.y });
      addArc(W, b.trail, b.col, 1.4, 0.16);
    }
    if (dead && b.look) shotDeath(W, b);
    if (dead) W.bullets.splice(i, 1);
  }
  for (let i = W.arcs.length - 1; i >= 0; i--) if ((W.arcs[i].t += dt) > W.arcs[i].max) W.arcs.splice(i, 1);

  // ---- sound, once a frame: where you are listening from, the jetpack, each live
  // Black Hole's drone, the floor's ambience, and a heartbeat when you're nearly dead ----
  SFX.ear(pcx, pcy);
  if (!W.jetLoop && SFX.ready) W.jetLoop = SFX.loop('jet');
  if (W.jetLoop) W.jetLoop.set(W.p.dead ? 0 : Math.min(1, W.p.flame) * 0.35, null, null,
    (1 + 0.49 * Math.min(1, W.p.flame)) * jetPitch(W.jetSt.onT));   // tone: thrust, then how long it's held
  if (W.p.empty && !W.wasEmpty) SFX.ui('sputter');
  W.wasEmpty = W.p.empty;
  for (const b of W.bullets) if (b.pull) {
    let h = W.bhLoops.get(b);
    if (!h && W.bhLoops.size < 3 && SFX.ready) { h = SFX.loop('void'); if (h) W.bhLoops.set(b, h); }
    if (h) h.set(0.5, b.x, b.y);
  }
  for (const [b, h] of W.bhLoops) if (!W.bullets.includes(b)) { h.stop(); W.bhLoops.delete(b); }
  SFX.ambTick(dt);
  if (!W.portalLoop && SFX.ready) W.portalLoop = SFX.loop('portal');
  if (W.portalLoop) W.portalLoop.set(0.55, W.portal.x + W.portal.w / 2, W.portal.y + W.portal.h / 2);
  if (W.matterProps.length) {
    let best = null, bd = 300;
    for (const pr of W.matterProps) { const d = Math.hypot(pr.x - pcx, pr.y - pcy); if (!pr.gone && d < bd) { bd = d; best = pr; } }
    if (best && !W.matterLoop && SFX.ready) W.matterLoop = SFX.loop('matter');
    if (W.matterLoop && best) W.matterLoop.set(0.6, best.x, best.y);
  }
  if (W.p.jet > 0 && !W.wasJet) SFX.fx('ignite');
  W.wasJet = W.p.jet > 0;
  for (const dv of W.devils) if ((dv.snd = (dv.snd || 0) - dt) <= 0) { dv.snd = 0.9 + Math.random() * 0.8; SFX.fx('whirl', dv.x, dv.y - 14); }
  if (!W.p.dead && W.p.hp / MHP < 0.3 && (W.beatT -= dt) <= 0) { W.beatT = 0.55 + 1.5 * W.p.hp / MHP; SFX.ui('beat'); }

  // ---- static fields ----
  for (let i = W.fields.length - 1; i >= 0; i--) {
    const f = W.fields[i];
    f.life -= dt; f.tick -= dt;
    const near = j => Math.hypot(W.enemies[j].x - f.x, W.enemies[j].ty - f.y) < f.r;
    if (f.field === 'slow' || f.field === 'storm') {
      // Stillness frosts and the thundercloud's rain soaks: any fire under them goes out
      if ((f.dT = (f.dT || 0) - dt) <= 0) { f.dT = 0.15;
        if (fireDouse(W.fire, f.x, f.y, f.r) && Math.random() < 0.5) SFX.fx('steam', f.x, f.y);
        for (const e of W.enemies) if (e.burn > 0 && Math.hypot(e.x - f.x, e.ty - f.y) < f.r) e.burn = 0;
        if (W.p.burn > 0 && Math.hypot(pcx - f.x, pcy - f.y) < f.r) W.p.burn = 0; }
      if (f.field === 'slow' && Math.random() < dt * 14) { const a = Math.random() * 6.283, r = Math.random() * f.r;
        glowDot(W, f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, rnd(-4, 4), rnd(4, 12), Math.random() < 0.5 ? '#ffffff' : '#bfe8ff', rnd(0.7, 1.1), rnd(0.4, 0.9)); }
    }
    if (f.field === 'heal' && Math.random() < dt * 10) { const a = Math.random() * 6.283, r = Math.random() * f.r;
      glowDot(W, f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, 0, rnd(-18, -8), Math.random() < 0.5 ? '#9dff9a' : '#46c48c', rnd(0.8, 1.2), rnd(0.4, 0.8)); }
    if (f.field === 'mine') {
      f.near = W.enemies.some(e => Math.hypot(e.x - f.x, e.ty - f.y) < f.r * 2.2);
      let trip = f.life <= 0;
      for (let j = 0; j < W.enemies.length && !trip; j++) if (near(j)) trip = true;
      if (trip) { explode(W, G, f.x, f.y, f.r); fieldPayload(W, G, f); W.fields.splice(i, 1); continue; }
    } else if (f.field === 'dormant') {
      // set off by any blast of yours, which is the whole point of it
      for (const fl of W.flashes) {
        if (Math.hypot(fl.x - f.x, fl.y - f.y) < fl.r + f.r * 0.5) {
          explode(W, G, f.x, f.y, f.r * 1.6); fieldPayload(W, G, f); W.fields.splice(i, 1); f.life = -1; break;
        }
      }
      if (f.life < 0) continue;
    } else if (f.field === 'slow') {
      for (const e of W.enemies) if (Math.hypot(e.x - f.x, e.ty - f.y) < f.r) e.chill = 0.2;
    } else if (f.field === 'shield') {
      for (let k = W.enemyShots.length - 1; k >= 0; k--) {
        const b = W.enemyShots[k];
        if (Math.hypot(b.x - f.x, b.y - f.y) < f.r) { burst(W, b.x, b.y, 3, f.col); SFX.fx('absorb', b.x, b.y); W.enemyShots.splice(k, 1); }
      }
    } else if (f.field === 'heal') {
      if (Math.hypot(pcx - f.x, pcy - f.y) < f.r && W.p.hp < MHP && f.tick <= 0) {
        f.tick = 0.4; W.p.hp = Math.min(MHP, W.p.hp + 4 * W.pb.heal); G.input.current.notify(); SFX.fx('healtick');
      }
    } else if (f.field === 'storm') {
      if (f.tick <= 0) {
        f.tick = 0.22;
        const a = Math.random() * Math.PI * 2, rr = Math.random() * f.r;
        const sx = f.x + Math.cos(a) * rr, sy = f.y + Math.sin(a) * rr;
        for (let j = W.enemies.length - 1; j >= 0; j--)
          if (Math.hypot(W.enemies[j].x - sx, W.enemies[j].ty - sy) < 22) damageEnemy(W, j, 2);
        burst(W, sx, sy, 6, '#a8e4ff');
        addArc(W, [{ x: sx + rnd(-8, 8), y: f.y - f.r * 0.85 }, { x: sx, y: sy }], '#a8e4ff', 1.2, 0.14);   // down from the cloud
        SFX.arc(sx, sy, true);
      }
    } else if (f.field === 'vacuum') {
      // Noita's Vacuum Field: a blink after it appears, everything in reach is warped
      // straight to the middle, through walls — creatures, shots (theirs and yours),
      // gold and loot. Once, then it's gone.
      if (!f.done && f.max - f.life >= VACUUM_WAIT) {
        f.done = true;
        const inR = (x, y) => Math.hypot(x - f.x, y - f.y) < f.r;
        for (const e of W.enemies) if (inR(e.x, e.ty)) { e.y += f.y - e.ty; e.x = f.x; e.tgt = null; }
        for (const b of W.bullets) if (inR(b.x, b.y)) { b.x = f.x; b.y = f.y; }
        for (const b of W.enemyShots) if (inR(b.x, b.y)) { b.x = f.x; b.y = f.y; }
        for (const g of W.coins) if (inR(g.x, g.y)) { g.x = f.x; g.y = f.y; }
        for (const q of W.pickups) if (!q.taken && inR(q.x, q.y)) { q.x = f.x; q.y = f.y; }
        burst(W, f.x, f.y, 14, f.col);
        SFX.fx('warp', f.x, f.y);
      }
    } else if (f.field === 'glitter') {
      if (f.tick <= 0) {
        f.tick = 0.16;
        const a = Math.random() * Math.PI * 2, rr = Math.random() * f.r;
        explode(W, G, f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr, 9);
      }
    }
    if (f.life <= 0) W.fields.splice(i, 1);
  }
  for (let i = W.beams.length - 1; i >= 0; i--) if ((W.beams[i].t += dt) > 0.12) W.beams.splice(i, 1);

  // ---- pickups: just cooldown upkeep and clearing what was taken. Whether one is
  // near enough to show its card, and whether you actually take it, is decided
  // below together with the shop — both go through the same interact tap now. ----
  for (let i = W.pickups.length - 1; i >= 0; i--) {
    const q = W.pickups[i];
    if (q.taken) { W.pickups.splice(i, 1); continue; }
    if (q.cool > 0) q.cool -= dt;
  }
  // ---- gold ----
  for (let i = W.coins.length - 1; i >= 0; i--) {
    const g = W.coins[i];
    const dx = pcx - g.x, dy = pcy - g.y, d = Math.hypot(dx, dy) || 1;
    const pull = COIN_PULL * W.pb.goldPull;    // Attract Gold reaches further
    if (g.nopull > 0) g.nopull -= dt;        // gold a rat just knocked out of you flies clear first
    if (d < pull && !W.p.dead && !(g.nopull > 0)) {
      // inside the pull radius it flies to you, straight through rock
      const grab = 180 + 900 * (1 - d / pull);
      g.vx = (g.vx || 0) + (dx / d) * grab * dt * 6;
      g.vy += (dy / d) * grab * dt * 6;
      g.vx *= 0.88; g.vy *= 0.88;
      g.x += g.vx * dt; g.y += g.vy * dt;
      if (d < 12) {
        LO.gold += g.amount;
        W.coins.splice(i, 1);
        SFX.ui('coin');
        G.input.current.notify();
      }
      continue;
    }
    if (g.pop) {
      // knocked out of you: flies in an arc, bounces a few times and skids to a stop
      g.vx *= Math.exp(-0.6 * dt);
      g.vy += 420 * dt;
      const nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
      if (solidAt(W, nx, g.y)) g.vx *= -0.4; else g.x = nx;
      if (solidAt(W, g.x, ny + 3)) {
        if (g.vy > 70) { g.vy = -g.vy * 0.42; g.vx *= 0.7; SFX.fx('coinland', g.x, g.y); }
        else { g.vy = 0; g.vx *= Math.exp(-8 * dt); if (Math.abs(g.vx) < 4) { g.vx = 0; g.pop = 0; } }
      } else if (solidAt(W, g.x, ny - 3) && g.vy < 0) g.vy = 0;
      else g.y = ny;
      continue;
    }
    g.vx = (g.vx || 0) * 0.9;
    g.vy += 320 * dt;
    const nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
    if (!solidAt(W, nx, g.y)) g.x = nx;
    if (solidAt(W, g.x, ny + 3)) { if (g.vy > 60) SFX.fx('coinland', g.x, g.y); g.vy = 0; } else g.y = ny;
  }

  // ---- what you can interact with: a shop plinth, or something on the ground ----
  const inShop = W.p.y + PH > SHOP_Y;
  let near = null;                      // { src: 'shop', it } or { src: 'pickup', q }
  for (const it of W.stock) {
    if (it.sold) continue;
    if (Math.abs(it.x - pcx) > 15 || Math.abs(it.y - pcy) > 22) continue;
    near = { src: 'shop', it };
    break;
  }
  if (!near) for (const q of W.pickups) {
    if (q.cool > 0) continue;
    if (Math.abs(q.x - pcx) > 18 || Math.abs(q.y - pcy) > 20) continue;
    near = { src: 'pickup', q };
    break;
  }
  // the hidden rooms' prizes: a perk on its altar, or the +25 heart
  if (!near) for (const r of W.rooms) {
    if (r.taken) continue;
    if (Math.abs(r.x - pcx) > 20 || Math.abs(r.y - pcy) > 26) continue;
    near = { src: 'room', r };
    break;
  }
  const nearKey = !near ? -1 : near.src + ':' +
    (near.src === 'shop' ? W.stock.indexOf(near.it)
      : near.src === 'room' ? W.rooms.indexOf(near.r) : W.pickups.indexOf(near.q));
  const label = !near ? null
    : near.src === 'shop'
      ? (near.it.kind === 'heal' ? { text: 'Full heal', price: 0, can: W.p.hp < MHP }
        : near.it.kind === 'gun' ? { text: near.it.gun.name, gun: near.it.gun,
            price: near.it.price, can: LO.gold >= near.it.price }
        : { text: MODS[near.it.id].name, id: near.it.id, price: near.it.price,
            can: LO.gold >= near.it.price })
      : near.src === 'room'
        ? (near.r.kind === 'perk'
            ? { text: PERKS[near.r.id].name, perk: near.r.id, price: 0, can: true }
            : { text: '+25 Max Health', heart: true, price: 0, can: true })
      // things on the ground are always yours for the taking — the price is what
      // the "For sale"/"Found" split cares about, not whether you're allowed to
      : (near.q.kind === 'gun' ? { text: near.q.gun.name, gun: near.q.gun, price: 0, can: true, found: true }
        : { text: MODS[near.q.id].name, id: near.q.id, price: 0, can: true, found: true });
  // where the item sits on screen, so the panel can float its bottom edge just above
  // it (the plinth/pickup) rather than covering it. camY/unitPx are last frame's, from
  // draw(); the item is static and the camera settles, so it lands right within a frame
  // or two. In css px measured up from the bottom of the view — that's the panel's
  // `bottom`. Bucketed into the sig so the panel re-lays-out as the camera settles.
  let pbottom = 12;
  if (near) {
    const iy = near.src === 'shop' ? near.it.y : near.src === 'room' ? near.r.y : near.q.y;
    const dprc = window.devicePixelRatio || 1;
    pbottom = Math.round(Math.max(10, G.c.height / dprc - (iy - 16 - W.camY) * W.unitPx));
  }
  const sig = nearKey + ':' + (label && label.can ? 1 : 0) + ':' + inShop + ':' + Math.round(pbottom / 16);
  if (nearKey !== -1 && nearKey !== W.lastNear) SFX.fx('prompt');   // a soft blip as a card comes up
  W.lastNear = nearKey;
  if (sig !== G.input.current.sig) {
    G.input.current.sig = sig;
    G.input.current.prompt = label;
    G.input.current.promptBottom = pbottom;
    G.input.current.inShop = inShop;
    G.input.current.notify();
  }
  // dead: a tap on the right stick restarts the run (see the death message)
  if (W.p.dead && G.input.current.interact) {
    G.input.current.interact = false;
    if (G.input.current.requestRestart) G.input.current.requestRestart();
  }
  if (G.input.current.interact && near) {
    G.input.current.interact = false;
    if (near.src === 'shop') {
      const it = near.it;
      if (it.kind === 'heal') {
        if (W.p.hp < MHP) { W.p.hp = MHP; it.sold = true; toast(W, 'Patched up'); SFX.ui('heal'); }
      } else if (LO.gold < it.price) {
        toast(W, 'Not enough gold');
        SFX.ui('poor');
      } else if (it.kind === 'gun') {
        LO.gold -= it.price;
        it.sold = true;
        // it drops at the plinth, so the usual chooser decides which slot it takes
        // and "leave it" parks the gun you paid for on the floor rather than binning it
        W.pickups.push({ kind: 'gun', x: it.x, y: it.y, gun: it.gun, t: 0 });
        toast(W, 'Bought ' + it.gun.name);
        SFX.ui('buy');
      } else {
        LO.gold -= it.price;
        LO.bag.push(it.id);
        it.sold = true;
        toast(W, 'Bought ' + MODS[it.id].name);
        SFX.ui('buy');
      }
    } else if (near.src === 'room') {
      const r = near.r;
      if (r.kind === 'perk') {
        const before = maxHp(W, G);
        (LO.perks || (LO.perks = [])).push(r.id);
        refreshBag(W, G);
        const after = maxHp(W, G);
        if (after > before) W.p.hp += after - before;   // Extra Health comes full
        W.p.hp = Math.min(W.p.hp, after);                 // Glass Cannon trims it
        if (W.pb.seeAll) { W.seen.fill(2); paintFog(W, G); }  // All-Seeing Eye lights it up now
        if (W.pb.ghost && !W.ghost) W.ghost = { x: pcx, y: pcy, cd: 0 };
        toast(W, 'Perk: ' + PERKS[r.id].name);
        SFX.ui('perk');
      } else {
        LO.maxBonus = (LO.maxBonus || 0) + 25;        // the heart raises the cap, no heal
        toast(W, '+25 Max Health');
        SFX.ui('heart');
      }
      r.taken = true;
    } else {
      const q = near.q;
      if (q.kind === 'mod') {
        // a mod goes straight to the bag — the panel already showed what it is, and a
        // mod has no slot to choose, so there's no second screen for it
        LO.bag.push(q.id);
        q.taken = true; q.cool = PICKUP_COOL;
        toast(W, 'Picked up ' + MODS[q.id].name);
        SFX.ui('mod');
      } else {
        // a gun opens the chooser: compare it with yours and pick the slot to swap
        G.input.current.found = q;
      }
    }
    G.input.current.sig = '';
    G.input.current.notify();
  }
  G.input.current.interact = false;

  for (let i = W.toasts.length - 1; i >= 0; i--) if ((W.toasts[i].t -= dt) <= 0) W.toasts.splice(i, 1);

  decorStep(W, G, dt, pcx, pcy);

  // ---- enemies ----
  // What an enemy does is what it is. Shooters hold a hover and fire on sight,
  // turrets never move and wind up a long shot, chasers come at you and hurt on
  // contact, bombers come at you and burst. Runs backwards because a bomber
  // takes itself out of the list.
  for (let i = W.enemies.length - 1; i >= 0; i--) {
    const e = W.enemies[i], k = e.k;
    e.flash -= dt;
    e.cd -= dt;
    e.touch -= dt;
    const dx = pcx - e.x, dy = pcy - e.ty, dist = Math.hypot(dx, dy) || 1;
    e.lx = dx / dist; e.ly = dy / dist;
    // Aggro (k.aggro) and firing (k.range) reaches are in world units, but the
    // camera zoom changes how much world fits on screen — zoomed in, an enemy off
    // the edge of the view could still hunt and shoot you. Scale both by 1/zoom so
    // they engage at roughly the same on-screen distance whatever the zoom.
    // Invisibility still folds in on top: creatures notice you far later.
    const sees = (W.pb.invis ? 0.4 : 1) / DEV.zoom;
    // aggro only on a real sightline: a chaser or bomber won't come for you through a
    // wall any more, only once it can actually see you (and within its aggro reach).
    // The range check comes first so the line-of-sight march only runs for the few
    // enemies already close enough to care.
    // DEV.aggro is an extra hand-tuning multiplier on the aggro reach, on top of the
    // zoom-relative `sees` scaling — firing range (k.range) is left alone.
    // Aggro is sticky: once a chaser/bomber has you it keeps coming (even out of the
    // initial reach and even round a wall), and only drops back to patrol once you've
    // put DEV.loseAggro times the aggro reach between you — so you can outrun it.
    const chaser = HUNTERS[k.act] && !W.p.dead;
    // a reworked creature rolls its own aggro reach from its knobs, once a second
    if (k.kp && ((e.aggroT = (e.aggroT || 0) - dt) <= 0)) { e.aggroM = kr(k.kp + 'Aggro'); e.aggroT = 1; }
    const reach = k.aggro * sees * DEV.aggro * (k.kp ? e.aggroM : 1);
    if (chaser) {
      if (!e.aggro) { if (dist < reach && lineOfSight(W, e.x, e.ty, pcx, pcy)) { e.aggro = true; SFX.creature(k, 'alert', e.x, e.ty); } }
      else if (dist > reach * DEV.loseAggro) e.aggro = false;
    } else e.aggro = false;
    const hunting = chaser && e.aggro;
    // the odd noise from anything near, seen or not: you hear the cave before you see it
    if (dist < 380 && Math.random() < 0.07 * dt) SFX.creature(k, 'idle', e.x, e.ty);
    // a bomber closing in ticks like a fuse, faster the nearer it gets
    if (hunting && k.act === 'bomb' && dist < 160 && (e.fuseT = (e.fuseT || 0) - dt) <= 0) {
      e.fuseT = 0.12 + dist / 400; SFX.creature(k, 'fuse', e.x, e.ty);
    }
    if (k.act === 'nest') {
      // lets a rat out now and then, while it has fewer than its max alive; only while
      // you're near enough for it to matter
      const N = e.nest;
      if (!N.max) { N.max = Math.round(kr('raMax')); N.wake = kr('raWake'); }
      if (dist < N.wake && (N.t -= dt) <= 0) {
        N.t = kr('raSpawn');
        let out = 0;
        for (const r of W.enemies) if (r.home === e) out++;
        if (out < N.max) spawnRat(W, e);
      }
      e.chill = 1; e.ty = e.y;
      continue;
    }
    if (k.act === 'rat') {
      ratFrame(W, G, e, dt, dist, hunting, pcx, pcy);
      e.chill = 1; e.ty = e.y;
      continue;
    }
    if (k.act === 'spider') {
      // only on rock and its own lines (spiderStep); strings you when it has a clear line
      const cold = e.chill && e.chill < 1 ? e.chill : 1;
      if (spiderStep(e, { solidCell: (cx, cy) => solidCell(W, cx, cy), webs: W.webs, hunting, goal: { x: pcx, y: pcy }, rnd: Math.random,
        speedMul: cold }, dt) === 'web') SFX.fx('lash', e.x, e.y);
      e.silkT = (e.silkT || 0) - dt;
      const S = e.sp;
      if (hunting && e.silkT <= 0 && S && (S.mode === 'surf' || S.mode === 'line') &&
          dist < (e.silkR || (e.silkR = spr('spSilk'))) * sees && dist > e.r + 24) {
        e.silkT = 0.4;
        if (lineOfSight(W, e.x, e.y, pcx, pcy)) {
          e.silkT = spr('spSilkCd'); e.silkR = spr('spSilk');
          const v = spr('spSilkSpd');
          W.silk.push({ x: e.x, y: e.y, ax: e.x, ay: e.y, vx: dx / dist * v, vy: dy / dist * v,
            life: 400 / v * 1.3 + 0.1 });
          SFX.creature(k, 'fire', e.x, e.y);
        }
      }
    } else if (k.act === 'jelly') {
      // swims in pulses (jellyStep); spits when its head is lined up on you, in range
      const cold = e.chill && e.chill < 1 ? e.chill : 1;
      if (jellyStep(e, { solidCell: (cx, cy) => solidCell(W, cx, cy), hunting, goal: { x: pcx, y: pcy }, rnd: Math.random,
        speedMul: cold, rangeMul: sees, stay: W.zone ? ((x, y) => natural(W, x, y)) : null }, dt) === 'pulse') puffSpores(W, e);
      const S = e.je;
      // brush its tentacles and you're stung, hunting or not (same sting knobs as the bell)
      if (!W.p.dead && e.touch <= 0 && dist < 180) {
        const t = tentacleTouch(S, W.p.x, W.p.y, W.p.x + PW, W.p.y + PH);
        if (t) {
          hurt(W, G, Math.round(kr('jeBite'))); e.touch = kr('jeBiteCd');
          burst(W, t.x, t.y, 5, jellyPal(S.u.col).tent);
          SFX.creature(k, 'bite', t.x, t.y);
        }
      }
      if (hunting && S.inRange && S.aimed && e.cd <= 0) {
        e.cd = 0.25;                                // no clear line: look again shortly
        const hx = e.x + Math.cos(S.hd) * e.r * 0.9, hy = e.y + Math.sin(S.hd) * e.r * 0.9;
        if (lineOfSight(W, hx, hy, pcx, pcy)) {
          e.cd = kr('jeShotCd');
          const a = Math.atan2(pcy - hy, pcx - hx) + (Math.random() * 2 - 1) * kr('jeSpread') * Math.PI / 180;
          const v = kr('jeShotSpd'), P = jellyPal(S.u.col);
          W.enemyShots.push({ x: hx, y: hy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 3,
            col: P.spit, edge: P.spitEdge, shine: P.spitShine, dripCol: P.drip, dripCol2: P.drip2, glow: hexRgb(P.glow),
            dmg: Math.round(kr('jeShotDmg')), size: kr('jeShotSize'), goo: 1,
            drip: kr('jeDrip'), da: 0, dripG: kr('jeDripG'), splat: Math.round(kr('jeSplat')), splatV: kr('jeSplatSpd') });
          SFX.creature(k, 'fire', e.x, e.y);
        }
      }
    } else if (k.act === 'turret') {
      // holds station: the hover is all the movement it gets
    } else if (hunting) {
      const step = k.spd * (e.chill || 1) * dt;
      const wx = e.x + dx / dist * step, wy = e.y + dy / dist * step;
      if (!solidAt(W, wx - e.r, wy) && !solidAt(W, wx + e.r, wy) &&
          !solidAt(W, wx, wy - e.r) && !solidAt(W, wx, wy + e.r)) { e.x = wx; e.y = wy; }
      else if (!solidAt(W, wx, e.y)) e.x = wx;            // slide along whatever it hit
      else if (!solidAt(W, e.x, wy)) e.y = wy;
      else { e.tgt = null; e.rest = 0; }
    } else {
      // patrol: pick a spot near home, drift to it, pause, pick another. Rock in
      // the way just means the spot was a bad idea, so it chooses a different one.
      e.rest -= dt;
      if (!e.tgt || e.rest <= 0 || Math.hypot(e.tgt.x - e.x, e.tgt.y - e.y) < 6) {
        const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * PATROL_R;
        e.tgt = { x: e.hx + Math.cos(a) * r, y: e.hy + Math.sin(a) * r };
        e.rest = 2 + Math.random() * 3.5;
      }
      const tdx = e.tgt.x - e.x, tdy = e.tgt.y - e.y, td = Math.hypot(tdx, tdy) || 1;
      const step = k.spd * (e.chill || 1) * dt;
      const wx = e.x + tdx / td * step, wy = e.y + tdy / td * step;
      if (solidAt(W, wx - e.r, wy) || solidAt(W, wx + e.r, wy) ||
          solidAt(W, wx, wy - e.r) || solidAt(W, wx, wy + e.r)) { e.tgt = null; e.rest = 0; }
      else { e.x = wx; e.y = wy; }
    }
    e.chill = 1;                                  // fields re-apply it every frame
    e.ty = k.kp ? e.y : e.y + Math.sin(W.time * 2 + e.phase) * (hunting ? 2 : 4);

    // contact: a chaser hurts you by reaching you, a bomber goes off
    if (hunting && dist < e.r + 14 && e.touch <= 0) {
      if (k.act === 'bomb') {
        burst(W, e.x, e.ty, 22, k.col.a);
        SFX.boom(e.x, e.ty, 26);
        hurt(W, G, k.dmg);
        W.enemies.splice(i, 1);
        if (k.fire) fireBlast(W, G, e.x, e.ty, 26, 1);
        continue;
      }
      SFX.creature(k, 'bite', e.x, e.ty);
      hurt(W, G, k.kp ? Math.round(kr(k.kp + 'Bite')) : k.dmg);
      e.touch = k.kp ? kr(k.kp + 'BiteCd') : 0.9;
    }

    // firing. A turret with a wind-up shows the ring first and only shoots if it
    // still has a line on you when the ring closes.
    if (k.act === 'shoot' || k.act === 'turret') {
      if (e.charge > 0) {
        e.charge -= dt;
        if (e.charge <= 0) fireEnemyShot(W, e, pcx, pcy);
      } else if (!W.p.dead && dist < k.range * sees && e.cd <= 0) {
        e.cd = 0.4;   // re-check soon if we can't see the player
        if (lineOfSight(W, e.x, e.ty, pcx, pcy)) {
          e.cd = k.cd * (0.85 + Math.random() * 0.3);
          if (!e.spotted) { e.spotted = true; SFX.creature(k, 'alert', e.x, e.ty); }
          if (k.tele) { e.charge = k.tele; SFX.creature(k, 'charge', e.x, e.ty, k.tele); } else fireEnemyShot(W, e, pcx, pcy);
        }
      }
    }
  }
  // Contact Damage: anything touching you is hurt for it, whether or not it's hunting
  if (W.pb.contact && !W.p.dead) {
    for (let i = W.enemies.length - 1; i >= 0; i--) {
      const e = W.enemies[i];
      if (Math.hypot(e.x - pcx, e.ty - pcy) < e.r + 12) damageEnemy(W, i, 45 * dt);
    }
  }

  for (let i = W.enemyShots.length - 1; i >= 0; i--) {
    const b = W.enemyShots[i];
    b.life -= dt;
    // Projectile Repulsion Field: shots on their way to you are shoved aside
    if (W.pb.repel) {
      const rx = b.x - pcx, ry = b.y - pcy, rd = Math.hypot(rx, ry) || 1;
      if (rd < 72) { b.vx += rx / rd * 1100 * dt; b.vy += ry / rd * 1100 * dt; }
    }
    // poison spit drips as it flies
    if (b.drip) for (b.da += b.drip * dt; b.da >= 1; b.da--)
      goo(W, b.x + (Math.random() - 0.5) * b.size, b.y + b.size * 0.5, b.vx * 0.08, 8 + Math.random() * 18, b.dripG, b.dripCol || b.col, 0, b.dripCol2);
    let gone = b.life <= 0;
    if (b.fire) fireArea(W.fire, b.x, b.y, 4, 0.5);
    const sn = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 2);
    for (let s = 0; s < sn && !gone; s++) {
      b.x += b.vx * dt / sn; b.y += b.vy * dt / sn;
      if (solidAt(W, b.x, b.y)) {
        gone = true;
        if (b.splat != null) splat(W, b, b.x - b.vx * dt / sn, b.y - b.vy * dt / sn);
        else SFX.fx('fizzle', b.x, b.y);
        if (b.fire) ignite(W, G, b.x - b.vx * dt / sn, b.y - b.vy * dt / sn, 8, 0.9);
        break;
      }
      if (!W.p.dead && b.x > W.p.x - 2 && b.x < W.p.x + PW + 2 && b.y > W.p.y - 2 && b.y < W.p.y + PH + 2) {
        gone = true;
        if (b.splat != null) splat(W, b, b.x, b.y); else burst(W, b.x, b.y, 5, COL.player);
        hurt(W, G, b.dmg);
        if (b.fire) youAlight(W);
      }
    }
    if (gone) W.enemyShots.splice(i, 1);
  }
  // spider strings in flight: rock stops them, you catch them
  for (let i = W.silk.length - 1; i >= 0; i--) {
    const b = W.silk[i];
    b.life -= dt;
    let gone = b.life <= 0;
    const sn = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 2);
    for (let s = 0; s < sn && !gone; s++) {
      b.x += b.vx * dt / sn; b.y += b.vy * dt / sn;
      if (solidAt(W, b.x, b.y)) { gone = true; break; }
      if (!W.p.dead && b.x > W.p.x - 3 && b.x < W.p.x + PW + 3 && b.y > W.p.y - 3 && b.y < W.p.y + PH + 3) {
        gone = true;
        W.strings.push({ ax: b.ax, ay: b.ay, ox: b.x - W.p.x, oy: b.y - W.p.y, slow: spr('spSlow'), max: spr('spSilkMax') });
        SFX.fx('lash', b.x, b.y);
      }
    }
    if (gone) W.silk.splice(i, 1);
  }
  // strings on you: pulled past their length, they snap
  for (let i = W.strings.length - 1; i >= 0; i--) {
    const s = W.strings[i];
    if (Math.hypot(W.p.x + s.ox - s.ax, W.p.y + s.oy - s.ay) > s.max) {
      W.strings.splice(i, 1);
      burst(W, W.p.x + s.ox, W.p.y + s.oy, 4, '#e8e8f0');
      SFX.fx('lash', W.p.x + s.ox, W.p.y + s.oy);
    }
  }
  // a web line whose rock has been blasted away comes down (a few checked a frame)
  for (let n = Math.min(W.webs.length, 6); n > 0; n--) {
    W.webCheck = (W.webCheck + 1) % W.webs.length;
    const L = W.webs[W.webCheck];
    if ((L.bin && !solidAt(W, L.bin.x, L.bin.y)) || (L.ain && !solidAt(W, L.ain.x, L.ain.y))) {
      W.webs.splice(W.webCheck, 1);
      if (!W.webs.length) break;
    }
  }
  W.p.hitT -= dt;

  // ---- Angry Ghost: a spirit that trails you and fires at what's nearest ----
  if (W.pb.ghost) {
    if (!W.ghost) W.ghost = { x: pcx, y: pcy, cd: 0 };
    const gtx = pcx - W.p.face * 22, gty = W.p.y - 4;
    const lp = Math.min(1, dt * 4);
    W.ghost.x += (gtx - W.ghost.x) * lp; W.ghost.y += (gty - W.ghost.y) * lp;
    W.ghost.cd -= dt;
    if (W.ghost.cd <= 0 && !W.p.dead) {
      let best = null, bd = 340;
      for (const e of W.enemies) { const d = Math.hypot(e.x - W.ghost.x, e.ty - W.ghost.y); if (d < bd) { bd = d; best = e; } }
      if (best) {
        W.ghost.cd = 0.7;
        const a = Math.atan2(best.ty - W.ghost.y, best.x - W.ghost.x);
        W.bullets.push({ x: W.ghost.x, y: W.ghost.y, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480,
          life: 1.2, dmg: 2 * W.pb.dmg, size: 2, col: '#c9a6ff', spin: 0, homing: 3, bounce: 0,
          pierce: 0, explode: 0, grav: 0, accel: 0, bore: 0, hit: null, knock: 0, crit: 0,
          age: 0, born: 1.2 });
        SFX.fx('ghost', W.ghost.x, W.ghost.y);
      }
    }
  } else W.ghost = null;

  // ---- fire: the cave's, the creatures', yours ----
  fireFrame(W, G, dt, pcx, pcy);

  // ---- Levitation Trail: flying lays down fire that burns what it touches ----
  if (W.pb.trail && W.p.flame > 0 && !W.p.dead) {
    const bn = { x: pcx + (Math.random() - 0.5) * 6, y: W.p.y + PH, life: 0.7, max: 0.7 };
    W.burns.push(bn);
    if (W.burns.length > 48) W.burns.shift();
    fireArea(W.fire, bn.x, bn.y + 2, 4, 0.4);
  }
  for (let i = W.burns.length - 1; i >= 0; i--) {
    const bn = W.burns[i]; bn.life -= dt;
    for (let j = W.enemies.length - 1; j >= 0; j--)
      if (Math.hypot(W.enemies[j].x - bn.x, W.enemies[j].ty - bn.y) < 15) { setAlight(W.enemies[j]); damageEnemy(W, j, 22 * dt); }
    if (bn.life <= 0) W.burns.splice(i, 1);
  }

  // ---- jetpack smoke ----
  if (W.p.flame > 0) {
    let fx = -W.p.jx, fy = -W.p.jy + 0.8;
    const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
    W.smokeAcc += dt * (25 + 35 * W.p.flame);
    while (W.smokeAcc >= 1) {
      W.smokeAcc--;
      W.smoke.push({ x: pcx + (Math.random() - 0.5) * 5, y: W.p.y + PH + 3,
        vx: fx * 50 + (Math.random() - 0.5) * 20, vy: fy * 50 + (Math.random() - 0.5) * 20,
        r: 1.5 + Math.random(), life: 0.9, max: 0.9 });
    }
  }
  for (let i = W.smoke.length - 1; i >= 0; i--) {
    const m = W.smoke[i];
    m.x += m.vx * dt; m.y += m.vy * dt;
    m.vx *= 1 - 2.5 * dt; m.vy = m.vy * (1 - 2.5 * dt) - 12 * dt;
    m.r += 5 * dt; m.life -= dt;
    if (m.life <= 0) W.smoke.splice(i, 1);
  }
  for (let i = W.sparks.length - 1; i >= 0; i--) {
    const q = W.sparks[i];
    q.vy += (q.g != null ? q.g : q.heavy ? 600 : 300) * dt;
    const nx = q.x + q.vx * dt, ny = q.y + q.vy * dt;
    if (q.heavy && solidAt(W, nx, ny)) { q.vx *= 0.3; q.vy = 0; }
    else { q.x = nx; q.y = ny; }
    q.life -= dt;
    if (q.life <= 0) W.sparks.splice(i, 1);
  }
  for (let i = W.flashes.length - 1; i >= 0; i--) {
    W.flashes[i].t += dt;
    if (W.flashes[i].t > 0.25) W.flashes.splice(i, 1);
  }

  W.best = Math.max(W.best, Math.round((W.start.y - W.p.y) / 10));

  // ---- the torch ----
  // A random walk with two sines on top, which is what makes a flame gutter rather
  // than pulse. It never goes above 1: flicker means the light dipping, and a canvas
  // globalAlpha over 1 is simply ignored.
  W.torchT += dt;
  W.flickN += (Math.random() - 0.5) * 2.6 * dt;
  W.flickN *= 0.94;
  W.flick = clamp(0.94 + W.flickN + 0.04 * Math.sin(W.torchT * 11.3) + 0.025 * Math.sin(W.torchT * 19.7),
    0.84, 1);
  W.torchAcc += dt;
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

  // ---- portal motes ----
  W.portalAcc += dt;
  while (W.portalAcc > 0.05) {
    W.portalAcc -= 0.05;
    const ex = W.portal.x + W.portal.w / 2, ey = W.portal.y + W.portal.h / 2;
    if (Math.abs(ey - W.p.y) < 500) {        // the exit: scattered round it, drawn in
      const a = Math.random() * 6.28, rr = 30 + Math.random() * 38;
      const life = 1.4 + Math.random() * 0.8;
      W.motes.push({ kind: 'in', x: ex + Math.cos(a) * rr, y: ey + Math.sin(a) * rr * 0.9,
        tx: ex, ty: ey, vx: 0, vy: 0, life, max: life, age: 0, ph: Math.random() * 6.28,
        s: 1 + Math.random() * 1.4, c: Math.random() < 0.4 ? '#c8ffe4' : COL.portal });
    }
    if (Math.abs(W.arrival.y - W.p.y) < 500) { // the way in: breathed out, drifting away
      const a = Math.random() * 6.28, sp = 10 + Math.random() * 16;
      W.motes.push({ kind: 'out', x: W.arrival.x + (Math.random() - 0.5) * 12,
        y: W.arrival.y + (Math.random() - 0.5) * 18, ox: W.arrival.x, oy: W.arrival.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, life: 4, max: 4, age: 0,
        ph: Math.random() * 6.28, fade: 34 + Math.random() * 18,
        s: 1 + Math.random() * 1.3, c: Math.random() < 0.4 ? '#e6d4ff' : COL.enemy });
    }
  }
  for (let i = W.motes.length - 1; i >= 0; i--) {
    const q = W.motes[i];
    q.age += dt;
    if (q.kind === 'in') {
      // accelerate toward the centre, with a sideways wobble so it spirals in unevenly
      const dx = q.tx - q.x, dy = q.ty - q.y, d = Math.hypot(dx, dy) || 1;
      const pullF = 70 + 260 * q.age;
      q.vx += dx / d * pullF * dt; q.vy += dy / d * pullF * dt;
      q.vx *= 1 - 2.2 * dt; q.vy *= 1 - 2.2 * dt;
      const w = Math.sin(q.age * 7 + q.ph) * 26;
      q.x += (q.vx - dy / d * w) * dt; q.y += (q.vy + dx / d * w) * dt;
      if (d < 3) q.life = 0;
    } else if (q.kind === 'out') {
      const w = Math.sin(q.age * 2.3 + q.ph);
      q.vx += w * 18 * dt; q.vy += (Math.cos(q.age * 1.7 + q.ph) * 12 - 3) * dt;
      q.vx *= 1 - 0.4 * dt; q.vy *= 1 - 0.4 * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (Math.hypot(q.x - q.ox, q.y - q.oy) > q.fade) q.life = 0;
    } else {
      q.vx *= 1 - 1.8 * dt; q.vy = q.vy * (1 - 1.8 * dt) - 6 * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
    }
    if ((q.life -= dt) <= 0) W.motes.splice(i, 1);
  }
  if (W.motes.length > 400) W.motes.splice(0, W.motes.length - 400);
}

// The clock, a toast held over from a paused frame, and the Dev panel's asks. True when
// Dev → New cave rolled the floor again: that frame ends there.
export function stepRequests(W, G, F) {
  const { dt } = F;
  W.time += dt;
  W.levelT += dt;
  // a toast raised while the game was paused (picking a mod up, say) waits here,
  // because nothing runs on a paused frame
  if (G.input.current.pendingToast) { toast(W, G.input.current.pendingToast); G.input.current.pendingToast = null; }
  G.input.current.floor = W.floor;
  if (G.input.current.newCave) {                // Dev → New cave: this floor again, freshly rolled
    G.input.current.newCave = false;
    enterLevel(W, G);
    toast(W, 'New cave');
    return true;
  }
  if (G.input.current.spawnGun) {               // Dev → Spawn gun: drop one just in front of you
    const gun = caveGun(G.input.current.spawnGun, Math.random);
    G.input.current.spawnGun = 0;
    W.pickups.push({ kind: 'gun', x: W.p.x + PW / 2 + W.p.face * 22, y: W.p.y + PH - 9, gun, t: 0 });
    toast(W, 'Spawned ' + gun.name);
  }
}

// The loadout for this frame (F.LO), and your health against the perks (F.MHP)
export function stepPerks(W, G, F) {
  const { dt } = F;
  F.LO = G.input.current.loadout;
  // perks: keep the current maximum health honest, wind the shield back up, and never
  // let a shrunken cap (Glass Cannon) leave the bar reading over full
  const MHP = F.MHP = maxHp(W, G);
  if (W.p.hp > MHP) W.p.hp = MHP;
  if (W.pb.shield && !W.p.shieldReady) { W.p.shieldT -= dt; if (W.p.shieldT <= 0) { W.p.shieldReady = true; SFX.fx('shieldUp'); } }
}
