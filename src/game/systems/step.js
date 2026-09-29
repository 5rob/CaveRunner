// One frame of the simulation: step(W, G, dt), run by Game's loop on every unpaused frame
// (then the recorder's recFrame, then draw). It calls its parts one after another in the
// order they have always run (they feed each other within the frame, and share the sim's
// Math.random stream), handing each the frame object F (REFACTOR.md D18). Being split into
// those parts (P3.4); what isn't a part yet is still inline in step, in its place.

import { jetPitch } from '../../audio/recipes.js';
import { SFX } from '../../audio/sfx.js';
import { COL, PH, PW } from '../../core/consts.js';
import { clamp } from '../../core/util.js';
import { caveGun } from '../../spells/guns.js';
import { stepBullets } from './bullets.js';
import { stepEnemies } from './enemies.js';
import { stepFields } from './fields.js';
import { fireFrame, stepTrail } from './fire.js';
import { aimAndCast } from './gun.js';
import { enterLevel } from './level-entry.js';
import { stepToasts, toast } from './particles.js';
import { stepPickups } from './pickups.js';
import { maxHp, movePlayer, torchHand } from './player.js';
import { decorStep } from './props.js';
import { saveRun } from './save-run.js';
import { solidAt } from './terrain.js';

export function step(W, G, dt) {
  // the frame: what step's parts hand on to each other. LO (the loadout) and MHP (your
  // maximum health) are filled in by stepPerks, pcx/pcy (your centre, once you've moved)
  // by the portal check
  const F = { dt, LO: null, MHP: 0, pcx: 0, pcy: 0 };
  if (stepRequests(W, G, F)) return;
  stepPerks(W, G, F);
  const LO = F.LO, MHP = F.MHP;
  movePlayer(W, G, F);
  if (atPortal(W, G, F)) return;
  const pcx = F.pcx, pcy = F.pcy;

  aimAndCast(W, G, F);

  stepBullets(W, G, F);

  stepSound(W, F);

  stepFields(W, G, F);

  stepPickups(W, G, F);

  stepToasts(W, F);

  decorStep(W, G, dt, pcx, pcy);

  stepEnemies(W, G, F);

  stepGhost(W, F);

  // ---- fire: the cave's, the creatures', yours ----
  fireFrame(W, G, dt, pcx, pcy);

  stepTrail(W, F);

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

// Where you are now you've moved (F.pcx/F.pcy, your centre: the rest of the frame works
// from it), and the exit: step into it and you're on the next floor. True when you went
// through: that frame ends there.
export function atPortal(W, G, F) {
  const pcx = F.pcx = W.p.x + PW / 2, pcy = F.pcy = W.p.y + PH / 2;
  if (!W.p.dead && pcx > W.portal.x && pcx < W.portal.x + W.portal.w &&
      pcy > W.portal.y && pcy < W.portal.y + W.portal.h) {
    W.floor++;
    enterLevel(W, G);
    saveRun(W, G);
    SFX.fx('portalIn');
    toast(W, 'Floor ' + W.floor);
    G.input.current.notify();
    return true;
  }
}

// Sound, once a frame: where you are listening from, the jetpack, each live Black Hole's
// drone, the floor's ambience, and a heartbeat when you're nearly dead
export function stepSound(W, F) {
  const { dt, MHP, pcx, pcy } = F;
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
}

// Angry Ghost: a spirit that trails you and fires at what's nearest
export function stepGhost(W, F) {
  const { dt, pcx, pcy } = F;
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
}
