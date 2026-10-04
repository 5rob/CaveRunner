// @ts-check
// One frame of the simulation: step(W, G, dt), run by Game's loop on every unpaused frame
// (then the recorder's recFrame, then draw). It calls its parts one after another in the
// order they have always run (they feed each other within the frame, and share the sim's
// Math.random stream), handing each the frame object F (REFACTOR.md D18). Most parts live
// with their system; the ones here are the frame's own: its clock and requests, health against
// the perks, the portal, the sound, and Angry Ghost.

import { jetPitch } from '../../audio/recipes.js';
import { SFX } from '../../audio/sfx.js';
import { PH, PW } from '../../core/consts.js';
import { caveGun } from '../../spells/guns.js';
import { stepBullets } from './bullets.js';
import { stepEnemies } from './enemies.js';
import { stepFields } from './fields.js';
import { fireFrame, stepTrail } from './fire.js';
import { aimAndCast } from './gun.js';
import { enterLevel } from './level-entry.js';
import { stepEliteFire, stepMotes, stepParticles, stepToasts, toast } from './particles.js';
import { stepPickups } from './pickups.js';
import { stepLights } from './shoplights.js';
import { maxHp, movePlayer, stepTorch } from './player.js';
import { decorStep } from './props.js';
import { saveRun } from './save-run.js';
import { stepRepo, stepWarp, voidCave } from './vend.js';
import { exits, nearExit } from '../world.js';

/** @param {World} W @param {GameCtx} G @param {number} dt */
export function step(W, G, dt) {
  // the frame: what step's parts hand on to each other. LO (the loadout) and MHP (your
  // maximum health) are filled in by stepPerks, pcx/pcy (your centre, once you've moved)
  // by the portal check
  const F = { dt, LO: null, MHP: 0, pcx: 0, pcy: 0 };
  if (stepRequests(W, G, F)) return;        // the clock, Dev asks (New cave ends the frame)
  stepPerks(W, G, F);                       // the loadout, health against the perks
  movePlayer(W, G, F);                      // the stick, jetpack, steering, the move (player.js)
  if (atPortal(W, G, F)) return;            // where you are now; through the exit ends the frame
  aimAndCast(W, G, F);                      // aim, facing, gun clocks, the trigger (gun.js)
  stepBullets(W, G, F);                     // your shots in flight (bullets.js)
  stepSound(W, F);                          // the ear, the loops, the heartbeat
  stepFields(W, G, F);                      // static fields and beams (fields.js)
  stepPickups(W, G, F);                     // pickups, gold, the card, the interact tap (pickups.js)
  stepWarp(W, G, F);                        // a level teleporting in or out (vend.js)
  stepLights(W, F);                         // a new run's dark shop lighting up (shoplights.js)
  stepRepo(W, G, F);                        // the repayment deadline passed: repossession, fire (vend.js)
  stepToasts(W, F);                         // messages fading (particles.js)
  decorStep(W, G, dt, F.pcx, F.pcy);        // props, plants, webs, what you stand in (props.js)
  stepEnemies(W, G, F);                     // the creatures and their shots (enemies.js)
  stepEliteFire(W, F);                      // the elites' flames (particles.js)
  stepGhost(W, F);                          // Angry Ghost
  fireFrame(W, G, dt, F.pcx, F.pcy);        // fire: the cave's, the creatures', yours (fire.js)
  stepTrail(W, F);                          // Levitation Trail (fire.js)
  stepParticles(W, F);                      // jetpack smoke, smoke, sparks, flashes (particles.js)
  W.best = Math.max(W.best, Math.round((W.start.y - W.p.y) / 10));   // highest you've been
  stepTorch(W, F);                          // the torch's flicker, flame and lean (player.js)
  stepMotes(W, F);                          // portal motes (particles.js)
}

// The clock, a toast held over from a paused frame, and the Dev panel's asks. True when
// Dev → New cave rolled the floor again: that frame ends there.
/** @param {World} W @param {GameCtx} G @param {StepFrame} F */
export function stepRequests(W, G, F) {
  const { dt } = F;
  W.time += dt;
  W.levelT += dt;
  // a toast raised while the game was paused (picking a mod up, say) waits here,
  // because nothing runs on a paused frame
  if (G.input.current.pendingToast) { toast(W, G.input.current.pendingToast); G.input.current.pendingToast = null; }
  G.input.current.floor = W.floor;
  if (G.input.current.newCave) {                // Dev → New cave: this floor again, freshly rolled
    const go = G.input.current.newCave;         // (Dev → Floor 2: that floor instead)
    G.input.current.newCave = false;
    if (typeof go === 'number') W.floor = go;
    enterLevel(W, G);
    if (!W.hasLvl) voidCave(W, G);
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
/** @param {World} W @param {GameCtx} G @param {StepFrame} F */
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
// from it), and the exits (three along the top): step into one and it drops you back in the shop (the level stays:
// sell it at the vending machine once it's clear). True when you went through: that frame ends there.
/** @param {World} W @param {GameCtx} G @param {StepFrame} F */
export function atPortal(W, G, F) {
  const pcx = F.pcx = W.p.x + PW / 2, pcy = F.pcy = W.p.y + PH / 2;
  const at = W.hasLvl && !W.p.dead ? exits(W).findIndex(q => pcx > q.x && pcx < q.x + q.w && pcy > q.y && pcy < q.y + q.h) : -1;
  if (at >= 0) {
    W.padZap[2 + at] = W.padZap[1] = W.time;    // both pads crackle (render/pads.js)
    W.p.x = W.start.x; W.p.y = W.start.y; W.p.vx = 0; W.p.vy = 0;
    W.p.fuel = 1; W.p.empty = false;
    W.camReady = false;
    saveRun(W, G);
    SFX.fx('portalIn');
    setTimeout(() => SFX.fx('portalOut', W.arrival.x, W.arrival.y), 260);
    toast(W, 'Back to the shop');
    G.input.current.notify();
    return true;
  }
}

// Sound, once a frame: where you are listening from, the jetpack, each live Black Hole's
// drone, the floor's ambience, and a heartbeat when you're nearly dead
/** @param {World} W @param {StepFrame} F */
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
  if (W.hasLvl) SFX.ambTick(dt);              // no level: no drips, no creatures in the dark
  if (!W.portalLoop && SFX.ready) W.portalLoop = SFX.loop('portal');
  const ex = nearExit(W, pcx);
  if (W.portalLoop) W.portalLoop.set(W.hasLvl ? 0.55 : 0, ex.x + ex.w / 2, ex.y + ex.h / 2);
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
/** @param {World} W @param {StepFrame} F */
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
