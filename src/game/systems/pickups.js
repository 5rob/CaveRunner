// @ts-check
// Things to pick up: pickups on the ground, the shop's stock, the hidden rooms' prizes and gold,
// and the interact tap that takes one: a frame of them all (stepPickups, a part of step()).

import { SFX } from '../../audio/sfx.js';
import { COIN_PULL, PH, PICKUP_COOL, SHOP_Y } from '../../core/consts.js';
import { healPrice } from '../../data/creatures.js';
import { PERKS } from '../../data/perks.js';
import { collideNuggets, stepNugget } from '../../world/nuggets.js';
import { MODS } from '../../spells/mods.js';
import { toast } from './particles.js';
import { solidAt } from './terrain.js';
import { MACHINE_TOP, SHOPS, shopNear, shopUse, stepShops } from './shops.js';
import { VEND_TOP, vendLabel, vendNear, vendUse } from './vend.js';

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
    if (q.cool > 0) continue;
    if (Math.abs(q.x - pcx) > 18 || Math.abs(q.y - pcy) > 20) continue;
    near = { src: 'pickup', q };
    break;
  }
  // a shop vending machine (after the pickups, so a mod it just popped out can be taken)
  if (!near) { const kind = shopNear(W, pcx, pcy); if (kind) near = { src: 'shopvend', kind }; }
  // the hidden rooms' prizes: a perk on its altar, or the +25 heart
  if (!near) for (const r of W.rooms) {
    if (r.taken) continue;
    if (Math.abs(r.x - pcx) > 20 || Math.abs(r.y - pcy) > 26) continue;
    near = { src: 'room', r };
    break;
  }
  const nearKey = !near ? -1 : near.src + ':' +
    (near.src === 'vend' || near.src === 'shopvend' ? near.kind : near.src === 'shop' ? W.stock.indexOf(near.it)
      : near.src === 'room' ? W.rooms.indexOf(near.r) : W.pickups.indexOf(near.q));
  const label = !near ? null
    : near.src === 'vend' ? vendLabel(W, near.kind)
    : near.src === 'shopvend' ? { text: SHOPS[near.kind].label, price: 0, can: true, shop: near.kind }
    : near.src === 'shop'
      ? (near.it.kind === 'heal' ? { text: 'Full heal', price: near.it.price, can: W.p.hp < MHP && LO.gold >= near.it.price }
        : near.it.kind === 'gun' ? { text: near.it.gun.name, gun: near.it.gun,
            price: near.it.price, can: LO.gold >= near.it.price }
        : { text: MODS[near.it.id].name, id: near.it.id, price: near.it.price,
            can: LO.gold >= near.it.price })
      : near.src === 'room'
        ? (near.r.kind === 'green' ? { text: 'Green crystal', green: W.floor, price: 0, can: true, found: true }
          : near.r.kind === 'perk' && near.r.id ? { text: PERKS[near.r.id].name, perk: near.r.id, price: 0, can: true }
          : { text: '+25 Max Health', heart: true, price: 0, can: true })
      // things on the ground are always yours for the taking — the price is what
      // the "For sale"/"Found" split cares about, not whether you're allowed to
      : (near.q.kind === 'gun' ? { text: near.q.gun.name, gun: near.q.gun, price: 0, can: true, found: true }
        : near.q.kind === 'perk' ? { text: PERKS[near.q.id].name, perk: near.q.id, price: 0, can: true, found: true }
        : near.q.kind === 'crystal' && near.q.green ? { text: 'Green crystal', green: near.q.floor || W.floor, price: 0, can: true, found: true }
        : near.q.kind === 'crystal' ? { text: 'Red crystal', crystal: near.q.floor, price: 0, can: true, found: true }
        : { text: MODS[near.q.id].name, id: near.q.id, price: 0, can: true, found: true });
  // where the item sits on screen, so the panel can float its bottom edge just above
  // it (the plinth/pickup) rather than covering it. camY/unitPx are last frame's, from
  // draw(); the item is static and the camera settles, so it lands right within a frame
  // or two. In css px measured up from the bottom of the view — that's the panel's
  // `bottom`. Bucketed into the sig so the panel re-lays-out as the camera settles.
  let pbottom = 12;
  if (near) {
    const iy = near.src === 'vend' ? VEND_TOP : near.src === 'shopvend' ? MACHINE_TOP : near.src === 'shop' ? near.it.y : near.src === 'room' ? near.r.y : near.q.y;
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
      if (r.kind === 'green') {                       // a green crystal: the perk machine's currency
        (LO.greens || (LO.greens = [])).push(W.floor);
        toast(W, 'Green crystal');
        SFX.ui('perk');
      } else if (r.kind === 'perk' && r.id) {         // (an older save's perk altar) carried, not fitted
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
      } else if (q.kind === 'crystal') {
        // a crystal goes in your pocket (a red one: the shop's machine turns it into an unlock; a
        // green one: the perk machine's). One tap takes every crystal in reach (an elite drops a pile)
        let reds = 0, greens = 0;
        for (const c of W.pickups) {
          if (c.kind !== 'crystal' || c.taken || c.cool > 0 || Math.abs(c.x - pcx) > 18 || Math.abs(c.y - pcy) > 20) continue;
          if (c.green) { (LO.greens || (LO.greens = [])).push(c.floor || W.floor); greens++; }
          else { (LO.crystals || (LO.crystals = [])).push(c.floor || W.floor); reds++; }
          c.taken = true;
        }
        toast(W, [reds ? (reds > 1 ? reds + ' red crystals' : 'Red crystal') : '', greens ? (greens > 1 ? greens + ' green crystals' : 'Green crystal') : '']
          .filter(Boolean).join(' + '));
        SFX.ui(greens ? 'perk' : 'mod');
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
