// Things to pick up: pickups on the ground, the shop's stock, the hidden rooms' prizes and gold,
// and the interact tap that takes one: a frame of them all (stepPickups, a part of step()).

import { SFX } from '../../audio/sfx.js';
import { COIN_PULL, PH, PICKUP_COOL, SHOP_Y } from '../../core/consts.js';
import { PERKS } from '../../data/perks.js';
import { MODS } from '../../spells/mods.js';
import { paintFog } from './fog.js';
import { toast } from './particles.js';
import { maxHp, refreshBag } from './player.js';
import { solidAt } from './terrain.js';

// ---- pickups, gold and the interact tap (a part of step) ----
// Pickups' cooldowns, gold flying to you or bouncing, which card (shop plinth, something on
// the ground, a room's prize) shows and where, and what a tap on the right stick takes.
export function stepPickups(W, G, F) {
  const { dt, LO, MHP, pcx, pcy } = F;
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
}
