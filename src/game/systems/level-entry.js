// @ts-check
// Entering a floor: makes the level (or rebuilds a saved one) and resets the world, the canvases,
// the fog and the recorder for it.

import { SFX } from '../../audio/sfx.js';
import { CH, CW, SHOP_ROOF, SHOP_TOP, SHOP_Y } from '../../core/consts.js';
import { plantWhite } from '../../creatures/jelly.js';
import { healPrice } from '../../data/creatures.js';
import { themeFor } from '../../data/themes.js';
import { fireNew } from '../../world/fire.js';
import { makeLevel } from '../../world/level.js';
import { fogStart, nestFog } from '../../world/vision.js';
import { paintFog } from './fog.js';
import { refreshBag } from './player.js';
import { recReset } from './recorder.js';
import { putRows } from './vend.js';

// a floor is a fresh cave with its own shop at the bottom; you keep everything else
// `back` is a saved cave to rebuild (same seed, same perks owned on the way in), with
// what was already taken, sold and killed stripped back out of it
// `keep` (a level teleporting in or out over the shop you're standing in, game/systems/vend.js):
// 'you' stay where you are and so does what's lying on the shop's floor; 'shop' keeps its stock too
// `pre`: the level already made from that seed (game/levelgen.js, off the main thread); with `keep`
// = 'shop' (bought: teleporting in) its rock is drawn in from the bottom up over the next frames (W.reveal)
/** @param {World} W @param {GameCtx} G @param {SavedLevel} [back] a save's cave, to put back @param {'you' | 'shop'} [keep] @param {Level} [pre] */
export function enterLevel(W, G, back, keep, pre) {
  refreshBag(W, G);
  W.levelSeed = back ? back.seed : 1 + Math.floor(Math.random() * 2147483000);
  W.levelOwned = back ? back.owned : (G.input.current.loadout.perks || []).slice();
  const level = pre || makeLevel(W.levelSeed, W.floor, W.levelOwned);
  level.enemies.forEach((e, i) => { e.sid = i; });
  if (back) {
    if (back.alive) { const live = new Set(back.alive); level.enemies = level.enemies.filter(e => live.has(e.sid)); }
    if (back.brood) for (const [sid, left] of back.brood) { const e = level.enemies.find(q => q.sid === sid); if (e && e.nest) e.nest.left = left; }
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
  W.start = level.start; W.portal = level.portal; W.portals = level.portals || [level.portal]; W.arrival = level.arrival;
  W.enemies = level.enemies; W.pickups = level.pickups; W.stock = level.stock;
  W.rooms = level.rooms || []; W.zone = level.zone || null; W.tomb = level.tomb || null;
  W.dark = level.dark || []; W.darkMask = level.darkMask || null; W.webbing = level.webbing || null; W.darkShade = level.darkShade || null; W.darkDepth = level.darkDepth || null;
  W.torchFail = { inside: false, t: 99 }; W.torchLit = 1;
  W.props = level.props || []; W.ambKinds = level.amb || []; W.dimg = level.dimg;
  W.plantW = plantWhite(W.img.data, W.dimg && W.dimg.data);    // the jellies' plant glow keys off this
  mapPicture(W, G);                           // the map: the floor as it is now, before anything digs it
  // the map's pins: a saved floor's come back; otherwise only those in the shop stay (it doesn't move)
  W.pins = back ? (back.pins || []).slice() : keep ? W.pins.filter(q => q.y >= SHOP_Y) : [];
  // teleporting in: the shop and a little above it now, the rest a band a frame (stepReveal)
  W.reveal = keep === 'shop' ? Math.max(0, SHOP_TOP - SHOP_ROOF - 60) : 0;
  if (!W.reveal) G.dctx.putImageData(W.dimg, 0, 0);
  W.dparts.length = W.amb.length = W.clouds.length = W.rings.length = W.devils.length = 0;
  W.zfx = { slow: 1, slick: 0, climb: null, rev: 0, web: null, webs: 0, webMul: 1 };
  {
    // the prize rooms' wall torches (the portals are teleporter pads with their own light: render/pads.js)
    W.sconces = [];
    // (not in floor 2's tomb: it is dark, nothing in it gives light but fire; owner, Level 2 stage 4)
    if (!W.tomb) for (const r of W.rooms) W.sconces.push([r.x - 28, r.y - 2], [r.x + 28, r.y - 2]);
    W.sconces = W.sconces.map(([x, y], i) => ({ x, y, ph: i * 1.7 }));
  }
  W.roster = level.roster; W.themeName = level.theme;
  SFX.setAmbience(W.themeName);              // (voidCave turns it off again while there's no level)
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
  if (W.reveal) putRows(W, G, W.reveal, CH);
  else G.tctx.putImageData(W.img, 0, 0);
  G.bgctx.putImageData(level.bgImg, 0, 0);
  if (!keep) {
    W.p.x = W.start.x; W.p.y = W.start.y; W.p.vx = 0; W.p.vy = 0;
    W.p.fuel = 1; W.p.empty = false; W.p.kick = 0;
  }
  W.bullets.length = W.enemyShots.length = W.smoke.length = 0;
  W.sparks.length = W.flashes.length = W.coins.length = W.arcs.length = 0;
  W.torchP.length = 0; W.motes.length = 0; W.eliteFx.length = 0;
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

// The map's picture of this floor (v0.0.141, ui/map.js shows it): one pixel per terrain pixel, the
// decoration with the rock over it (as drawTerrain lays them) on the floor's dark (lifted a little, so
// explored air stands apart from the map's fog). Made once as the
// floor is entered, so the map is the cave as it was made, not as it's been dug
/** @type {HTMLCanvasElement | null} */
let scratch = null;
/** @param {World} W @param {GameCtx} G */
export function mapPicture(W, G) {
  const c = G.mapC, x = c.getContext('2d');
  if (!scratch) { scratch = document.createElement('canvas'); scratch.width = CW; scratch.height = CH; }
  const sx = scratch.getContext('2d');
  if (!x || !sx) return;
  x.globalCompositeOperation = 'source-over';
  if (W.dimg) x.putImageData(W.dimg, 0, 0); else x.clearRect(0, 0, CW, CH);
  sx.putImageData(W.img, 0, 0);
  x.drawImage(scratch, 0, 0);
  x.globalCompositeOperation = 'destination-over';
  x.fillStyle = 'rgb(' + themeFor(W.floor).bg.map(c => Math.round(c * 1.7)).join(',') + ')';   // the air a touch lighter than the fog
  x.fillRect(0, 0, CW, CH);
  x.globalCompositeOperation = 'source-over';
}
