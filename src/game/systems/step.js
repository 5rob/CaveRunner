// One frame of the simulation: step(W, G, dt), run by Game's loop on every unpaused frame
// (then the recorder's recFrame, then draw). It calls its parts one after another in the
// order they have always run (they feed each other within the frame, and share the sim's
// Math.random stream), handing each the frame object F (REFACTOR.md D18). Being split into
// those parts (P3.4); what isn't a part yet is still inline in step, in its place.

import { jetPitch } from '../../audio/recipes.js';
import { SFX } from '../../audio/sfx.js';
import { COIN_PULL, COL, PATROL_R, PH, PICKUP_COOL, PW, SHOP_Y } from '../../core/consts.js';
import { clamp, hexRgb } from '../../core/util.js';
import { jellyPal, jellyStep, tentacleTouch } from '../../creatures/jelly.js';
import { spiderStep } from '../../creatures/spider.js';
import { HUNTERS } from '../../data/creatures.js';
import { PERKS } from '../../data/perks.js';
import { DEV, kr, spr } from '../../dev/knobs.js';
import { caveGun } from '../../spells/guns.js';
import { MODS } from '../../spells/mods.js';
import { fireArea } from '../../world/fire.js';
import { puffSpores } from './ambience.js';
import { stepBullets } from './bullets.js';
import { damageEnemy, fireEnemyShot, natural } from './enemies.js';
import { stepFields } from './fields.js';
import { fireBlast, fireFrame, ignite, setAlight, youAlight } from './fire.js';
import { paintFog } from './fog.js';
import { aimAndCast } from './gun.js';
import { enterLevel } from './level-entry.js';
import { burst, goo, splat, toast } from './particles.js';
import { hurt, maxHp, movePlayer, refreshBag, torchHand } from './player.js';
import { decorStep } from './props.js';
import { ratFrame, spawnRat } from './rats.js';
import { saveRun } from './save-run.js';
import { lineOfSight, solidAt, solidCell } from './terrain.js';

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
