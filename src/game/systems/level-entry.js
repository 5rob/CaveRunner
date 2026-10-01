// @ts-check
// Entering a floor: makes the level (or rebuilds a saved one) and resets the world, the canvases,
// the fog and the recorder for it.

import { SFX } from '../../audio/sfx.js';
import { CH, CW, MINI_D, MMH, MMW, SHOP_Y } from '../../core/consts.js';
import { plantWhite } from '../../creatures/jelly.js';
import { healPrice } from '../../data/creatures.js';
import { fireNew } from '../../world/fire.js';
import { makeLevel } from '../../world/level.js';
import { fogStart, nestFog } from '../../world/vision.js';
import { paintFog } from './fog.js';
import { refreshBag } from './player.js';
import { recReset } from './recorder.js';

// a floor is a fresh cave with its own shop at the bottom; you keep everything else
// `back` is a saved cave to rebuild (same seed, same perks owned on the way in), with
// what was already taken, sold and killed stripped back out of it
// `keep` (a level teleporting in or out over the shop you're standing in, game/systems/vend.js):
// 'you' stay where you are and so does what's lying on the shop's floor; 'shop' keeps its stock too
/** @param {World} W @param {GameCtx} G @param {SavedLevel} [back] a save's cave, to put back @param {'you' | 'shop'} [keep] */
export function enterLevel(W, G, back, keep) {
  refreshBag(W, G);
  W.levelSeed = back ? back.seed : 1 + Math.floor(Math.random() * 2147483000);
  W.levelOwned = back ? back.owned : (G.input.current.loadout.perks || []).slice();
  const level = makeLevel(W.levelSeed, W.floor, W.levelOwned);
  level.enemies.forEach((e, i) => { e.sid = i; });
  if (back) {
    if (back.alive) { const live = new Set(back.alive); level.enemies = level.enemies.filter(e => live.has(e.sid)); }
    back.sold.forEach(i => { if (level.stock[i]) level.stock[i].sold = true; });
    const heal = level.stock.find(it => it.kind === 'heal');
    if (heal && back.heals) { heal.bought = back.heals; heal.price = healPrice(back.heals, W.floor); }
    back.rooms.forEach(i => { if (level.rooms && level.rooms[i]) level.rooms[i].taken = true; });
    if (back.pickups) level.pickups = back.pickups;
  }
  if (keep) {
    if (keep === 'shop') level.stock = W.stock;
    level.pickups = level.pickups.concat(W.pickups.filter(q => !q.taken && q.y >= SHOP_Y));
  }
  W.mat = level.mat; W.img = level.img; W.ore = level.ore || null;
  miniEdges(W);
  W.start = level.start; W.portal = level.portal; W.arrival = level.arrival;
  W.enemies = level.enemies; W.pickups = level.pickups; W.stock = level.stock;
  W.rooms = level.rooms || []; W.zone = level.zone || null;
  W.props = level.props || []; W.ambKinds = level.amb || []; W.dimg = level.dimg;
  W.plantW = plantWhite(W.img.data, W.dimg && W.dimg.data);    // the jellies' plant glow keys off this
  G.dctx.putImageData(W.dimg, 0, 0);
  W.dparts.length = W.amb.length = W.clouds.length = W.rings.length = W.devils.length = 0;
  W.zfx = { slow: 1, slick: 0, climb: null, rev: 0, web: null, webs: 0, webMul: 1 };
  {
    const pcx0 = W.portal.x + W.portal.w / 2, pcy0 = W.portal.y + W.portal.h / 2;
    W.sconces = [[pcx0 - 26, pcy0 - 2], [pcx0 + 26, pcy0 - 2],
      [W.arrival.x - 26, W.arrival.y - 2], [W.arrival.x + 26, W.arrival.y - 2]];
    for (const r of W.rooms) W.sconces.push([r.x - 28, r.y - 2], [r.x + 28, r.y - 2]);
    W.sconces = W.sconces.map(([x, y], i) => ({ x, y, ph: i * 1.7 }));
  }
  W.roster = level.roster; W.themeName = level.theme;
  SFX.setAmbience(W.themeName);
  for (const h of W.bhLoops.values()) h.stop();
  W.bhLoops.clear();
  W.total = W.enemies.length;
  W.ghost = W.pb.ghost ? { x: level.start.x, y: level.start.y, cd: 0 } : null;
  W.burns.length = 0;
  W.webs.length = W.silk.length = W.strings.length = 0;
  // the rat burrows (see ratSolid): each room and tunnel, bar nothing — the hole too
  W.burrow = null; W.navYou.F = null;
  if (level.nests && level.nests.length) {
    W.burrow = new Uint8Array(CW * CH);
    for (const n of level.nests) {
      const mark = (x, y, r) => {
        for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++)
          if (xx >= 0 && yy >= 0 && xx < CW && yy < CH && Math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= r && !W.mat[yy * CW + xx]) W.burrow[yy * CW + xx] = 1;
      };
      mark(n.x + 0.5, n.y + 0.5, n.r + 3);
      for (const q of n.path) mark(q.x + 0.5, q.y + 0.5, 2.6);
    }
  }
  W.fire = fireNew(level.fuel || new Uint8Array(CW * CH));
  W.firePropN = -1;                         // fireFrame lists the plants and carts that burn
  W.p.burn = 0; W.p.burnAcc = 0;
  G.tctx.putImageData(W.img, 0, 0);
  G.bgctx.putImageData(level.bgImg, 0, 0);
  if (!keep) {
    W.p.x = W.start.x; W.p.y = W.start.y; W.p.vx = 0; W.p.vy = 0;
    W.p.fuel = 1; W.p.empty = false; W.p.kick = 0;
  }
  W.bullets.length = W.enemyShots.length = W.smoke.length = 0;
  W.sparks.length = W.flashes.length = W.coins.length = W.arcs.length = 0;
  W.torchP.length = 0; W.motes.length = 0;
  if (!keep) W.camReady = false;
  W.best = 0;
  W.levelT = 0;                             // the floor's name card gets its three seconds
  W.seen = fogStart(); W.deepFog = nestFog(level.nests);
  if (W.pb.seeAll) W.seen.fill(2);            // All-Seeing Eye lights the whole floor
  paintFog(W, G);                             // otherwise every floor starts dark again
  recReset(W, G);                             // the death replay starts afresh each floor
  W.matterProps = W.props.filter(pr => pr.k === 'matter');
  // out of the way-in, a moment after the way-out's whump
  if (!keep) setTimeout(() => SFX.fx('portalOut', W.arrival.x, W.arrival.y), 260);
}

// The minimap outlines for this floor: scan the real terrain in MINI_D x MINI_D blocks;
// a block is an outline if a wall runs through it (it holds both rock and open), which
// traces the cave walls continuously at a much finer grain than the fog grid.
/** @param {World} W */
export function miniEdges(W) {
  W.miniEdgeIdx = [];
  for (let my = 0; my < MMH; my++) for (let mx = 0; mx < MMW; mx++) {
    let solid = 0, open = 0;
    for (let dy = 0; dy < MINI_D; dy++) {
      const ty = my * MINI_D + dy;
      if (ty >= CH) break;
      for (let dx = 0; dx < MINI_D; dx++) {
        const tx = mx * MINI_D + dx;
        if (tx >= CW) break;
        if (W.mat[ty * CW + tx]) solid++; else open++;
      }
    }
    if (solid && open) W.miniEdgeIdx.push(my * MMW + mx);
  }
}
