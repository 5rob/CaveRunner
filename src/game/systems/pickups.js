// @ts-check
// Things to pick up: pickups on the ground, the shop's stock, the hidden rooms' prizes and gold,
// and the interact tap that takes one: a frame of them all (stepPickups, a part of step()).

import { SFX } from '../../audio/sfx.js';
import { COIN_PULL, PH, PICKUP_COOL, PW, SHOP_Y } from '../../core/consts.js';
import { healPrice } from '../../data/creatures.js';
import { PERKS } from '../../data/perks.js';
import { collideNuggets, stepNugget } from '../../world/nuggets.js';
import { resetGun } from '../../spells/guns.js';
import { MODS } from '../../spells/mods.js';
import { gameDpr } from '../dpr.js';
import { crystalMotes, toast } from './particles.js';
import { lineOfSight, solidAt } from './terrain.js';
import { MACHINE_TOP, SHOPS, shopNear, shopUse, stepShops } from './shops.js';
import { PICK_IDLE, VEND_TOP, pickStep, vendLabel, vendNear, vendUse } from './vend.js';

// ---- pickups, gold and the interact tap (a part of step) ----
// Pickups' cooldowns, gold flying to you or bouncing, which card (shop plinth, something on
// the ground, a room's prize) shows and where, and what a tap on the right stick takes.
/** @param {World} W @param {GameCtx} G @param {StepFrame} F */
export function stepPickups(W, G, F) {
  const { dt, LO, MHP, pcx, pcy } = F;
  stepShops(W, G, F);                   // a bought thing popping out of a vending machine
  // ---- pickups: just cooldown upkeep and clearing what was taken. Whether one is
  // near enough to show its card, and whether you actually take it, is decided
  // below together with the shop — both go through the same interact tap now. ----
  for (let i = W.pickups.length - 1; i >= 0; i--) {
    const q = W.pickups[i];
    if (q.taken) { W.pickups.splice(i, 1); continue; }
    if (q.cool > 0) q.cool -= dt;
  }
  // ---- gold ----
  /** @param {number} x @param {number} y */
  const solid = (x, y) => solidAt(W, x, y);
  for (let i = W.coins.length - 1; i >= 0; i--) {
    const g = W.coins[i];
    const dx = pcx - g.x, dy = pcy - g.y, d = Math.hypot(dx, dy) || 1;
    const pull = COIN_PULL * W.pb.goldPull;    // Attract Gold reaches further
    if (g.nopull > 0) g.nopull -= dt;        // gold a rat just knocked out of you flies clear first
    g.fly = false;
    if (d < pull && !W.p.dead && !(g.nopull > 0)) {
      g.fly = true;
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
    // loose: a nugget falls, bounces, rolls down the slope (world/nuggets.js)
    if (stepNugget(g, dt, solid)) SFX.fx('coinland', g.x, g.y);
    if (g.pop && g.ground && !g.vx) g.pop = 0;    // a coin knocked out of you has come to rest
  }
  collideNuggets(W.coins, solid);              // and they push each other apart

  // ---- crystals: you can't carry them (v0.0.138): they're rocks you push, or drag with the Gravity
  // Gun, into their machine (stepCrystals in shops.js) ----
  // A green crystal on a hidden room's altar comes off it as a loose crystal once you're in reach.
  const pull = COIN_PULL * W.pb.goldPull;
  for (const r of W.rooms) {
    if (r.taken || r.kind !== 'green') continue;
    crystalMotes(W, r.x, r.y, true, dt, 0);
    if (!W.p.dead && Math.hypot(pcx - r.x, pcy - r.y) < pull) {
      r.taken = true;
      W.pickups.push({ kind: 'crystal', green: true, x: r.x, y: r.y, floor: W.floor, t: 0 });
    }
  }

  // ---- what you can interact with: a shop plinth, or something on the ground ----
  const inShop = W.p.y + PH > SHOP_Y;
  let near = null;                      // { src: 'shop', it } or { src: 'pickup', q }, or a vending machine
  const vend = vendNear(W, pcx, pcy);
  if (vend) near = { src: 'vend', kind: vend };
  if (!near) for (const it of W.stock) {
    if (it.sold) continue;
    if (Math.abs(it.x - pcx) > 15 || Math.abs(it.y - pcy) > 22) continue;
    near = { src: 'shop', it };
    break;
  }
  if (!near) for (const q of W.pickups) {
    if (q.cool > 0 || q.kind === 'crystal') continue;     // crystals fly to you, like gold
    if (Math.abs(q.x - pcx) > 18 || Math.abs(q.y - pcy) > 20) continue;
    near = { src: 'pickup', q };
    break;
  }
  // a shop vending machine (after the pickups, so a mod it just popped out can be taken)
  if (!near) { const kind = shopNear(W, pcx, pcy); if (kind) near = { src: 'shopvend', kind }; }
  // the hidden rooms' prizes: a perk on its altar, or the +25 heart
  if (!near) for (const r of W.rooms) {
    if (r.taken || r.kind === 'green') continue;
    if (Math.abs(r.x - pcx) > 20 || Math.abs(r.y - pcy) > 26) continue;
    near = { src: 'room', r };
    break;
  }
  // at the buy machine the right stick picks the floor: a flick up or down (ui/hud.js; you still aim and fire)
  const picking = !!near && near.src === 'vend' && near.kind === 'buy' && !W.p.dead;
  G.input.current.lvlPick = picking;
  // any directional input on either stick (or a move key) hides its hint; PICK_IDLE without one fades it up
  const IN = G.input.current, K = IN.keys;
  if ((IN.left.active && IN.left.mag > 0.15) || (IN.right.active && IN.right.mag > 0.15) || K.w || K.a || K.s || K.d) W.stickT = W.time;
  const idle = W.time - (W.stickT ?? -99) > PICK_IDLE;
  const flick = G.input.current.lvlStep;
  if (flick) { G.input.current.lvlStep = 0; if (picking) pickStep(W, LO, flick); }
  // a gun in reach: holding a HUD gun slot takes it into that slot (takeGun, ui/gunhold.js)
  G.input.current.gunNear = near && near.src === 'pickup' && near.q.kind === 'gun' && !W.p.dead ? near.q : null;
  const nearKey = !near ? -1 : near.src + ':' +
    (near.src === 'vend' || near.src === 'shopvend' ? near.kind : near.src === 'shop' ? W.stock.indexOf(near.it)
      : near.src === 'room' ? W.rooms.indexOf(near.r) : W.pickups.indexOf(near.q));
  const label = !near ? null
    : near.src === 'vend' ? { ...vendLabel(W, near.kind, LO), idle }
    : near.src === 'shopvend' ? { text: SHOPS[near.kind].label, price: 0, can: true, shop: near.kind }
    : near.src === 'shop'
      ? (near.it.kind === 'heal' ? { text: 'Full heal', price: near.it.price, can: W.p.hp < MHP && LO.gold >= near.it.price }
        : near.it.kind === 'gun' ? { text: near.it.gun.name, gun: near.it.gun,
            price: near.it.price, can: LO.gold >= near.it.price }
        : { text: MODS[near.it.id].name, id: near.it.id, price: near.it.price,
            can: LO.gold >= near.it.price })
      : near.src === 'room'
        ? (near.r.kind === 'perk' && near.r.id ? { text: PERKS[near.r.id].name, perk: near.r.id, price: 0, can: true }
          : { text: '+25 Max Health', heart: true, price: 0, can: true })
      // things on the ground are always yours for the taking — the price is what
      // the "For sale"/"Found" split cares about, not whether you're allowed to
      : (near.q.kind === 'gun' ? { text: near.q.gun.name, gun: near.q.gun, price: 0, can: true, found: true }
        : near.q.kind === 'perk' ? { text: PERKS[near.q.id].name, perk: near.q.id, price: 0, can: true, found: true }
        : { text: MODS[near.q.id].name, id: near.q.id, price: 0, can: true, found: true });
  // where the item sits on screen, so the panel can float its bottom edge just above
  // it (the plinth/pickup) rather than covering it. camY/unitPx are last frame's, from
  // draw(); the item is static and the camera settles, so it lands right within a frame
  // or two. In css px measured up from the bottom of the view — that's the panel's
  // `bottom`. Bucketed into the sig so the panel re-lays-out as the camera settles.
  let pbottom = 12;
  if (near) {
    const iy = near.src === 'vend' ? VEND_TOP : near.src === 'shopvend' ? MACHINE_TOP : near.src === 'shop' ? near.it.y : near.src === 'room' ? near.r.y : near.q.y;
    const dprc = gameDpr();
    pbottom = Math.round(Math.max(10, G.c.height / dprc - (iy - 16 - W.camY) * W.unitPx));
  }
  const sig = nearKey + ':' + (label && label.can ? 1 : 0) + (near && near.src === 'vend' && idle ? 'i' : '') + ':' + inShop + ':' + Math.round(pbottom / 16);
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
    if (near.src === 'vend') vendUse(W, G, near.kind, LO);
    else if (near.src === 'shopvend') shopUse(G, near.kind);
    else if (near.src === 'shop') {
      const it = near.it;
      if (it.kind === 'heal') {
        if (W.p.hp >= MHP) { toast(W, 'Already at full health'); SFX.ui('poor'); }
        else if (LO.gold < it.price) { toast(W, 'Not enough gold'); SFX.ui('poor'); }
        else {
          LO.gold -= it.price;
          W.p.hp = MHP;
          it.bought = (it.bought || 0) + 1;      // never sells out, just dearer: healPrice
          it.price = healPrice(it.bought, W.floor);
          toast(W, 'Patched up'); SFX.ui('heal');
        }
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
      if (r.kind === 'perk' && r.id) {         // (an older save's perk altar) carried, not fitted
        LO.perks.push(r.id);
        toast(W, 'Perk: ' + PERKS[r.id].name);
        SFX.ui('perk');
      } else {
        LO.maxBonus = (LO.maxBonus || 0) + 25;        // (an older save's heart) the cap goes up, no heal
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
      } else if (q.kind === 'perk') {
        // a perk is carried: fit it to the Exo Suit in the Bag to make it count
        LO.perks.push(q.id);
        q.taken = true;
        toast(W, 'Perk: ' + PERKS[q.id].name + ' (fit it in the Bag)');
        SFX.ui('perk');
      } else if (G.input.current.gunMenu) {
        // archived (v0.0.149): a gun opened the chooser (ui/swap.js GunSwap). Off unless
        // input.current.gunMenu is set; a gun is taken by holding a HUD slot now (takeGun)
        G.input.current.found = q;
      } else {
        toast(W, 'Hold a gun slot to take it');
      }
    }
    G.input.current.sig = '';
    G.input.current.notify();
  }
  G.input.current.interact = false;
}

// Hold a HUD gun slot by a gun on the ground: it goes into slot i, and the gun that was there
// (if any) lies where it was, like the old chooser's swap. False when no gun is in reach.
/** @param {World} W @param {GameCtx} G @param {number} i */
export function takeGun(W, G, i) {
  const q = G.input.current.gunNear, LO = G.input.current.loadout;
  if (!q || q.taken || W.pickups.indexOf(q) < 0 || W.p.dead) return false;
  const old = LO.guns[i];
  LO.guns[i] = resetGun(q.gun);
  if (old) { q.gun = old; q.old = true; } else q.taken = true;
  if (!LO.guns[LO.sel]) LO.sel = i;      // empty-handed: hold what you just took
  toast(W, 'Took ' + LO.guns[i].name);
  SFX.ui('gun');
  G.input.current.gunNear = null;
  G.input.current.sig = '';
  G.input.current.notify();
  return true;
}

// Drop the gun in slot i where the finger let go (world x, y); it's no longer yours. It lands
// there, settled onto the floor below, when you can see that spot and it isn't in rock; else
// at your feet. The gun in hand going: hold the next one you have (or none).
/** @param {World} W @param {GameCtx} G @param {number} i @param {number} x @param {number} y */
export function dropGun(W, G, i, x, y) {
  const LO = G.input.current.loadout, gun = LO.guns[i];
  if (!gun || W.p.dead) return false;
  const pcx = W.p.x + PW / 2, pcy = W.p.y + PH / 2;
  let at = { x: pcx, y: W.p.y + PH - 9 };
  if (x === x && y === y && !solidAt(W, x, y) && lineOfSight(W, pcx, pcy, x, y))
    for (let d = 0; d < 600; d += 2) if (solidAt(W, x, y + d + 9)) { at = { x, y: y + d }; break; }
  LO.guns[i] = null;
  if (LO.sel === i) { const n = LO.guns.findIndex(Boolean); LO.sel = n >= 0 ? n : i; }
  W.pickups.push({ kind: 'gun', x: at.x, y: at.y, gun, t: 0, old: true });
  toast(W, 'Dropped ' + gun.name);
  SFX.fx('place');
  G.input.current.sig = '';
  G.input.current.notify();
  return true;
}
