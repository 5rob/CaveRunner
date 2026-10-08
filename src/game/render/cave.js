// @ts-check
// The cave's layers of draw() (render/draw.js), each a part it calls in order with its frame
// object F (REFACTOR.md D19): the rock and what sits on it. The background, rock and fire, the
// props, the two portals, the shop's stock, loot, and the hidden rooms' prizes

import { drawProp, rgbA } from '../../art/props.js';
import { drawTeleSign } from '../../art/sign.js';
import { CRYSTAL_PAL, CRYSTAL_R, GREEN_PAL, drawGun, drawGunGlow, drawNugget } from '../../art/sprites.js';
import { BCELL, BH, BW, CELL, CH, COL, CW, SHOP_FLOOR, SHOP_Y, WW } from '../../core/consts.js';
import { clamp, mix } from '../../core/util.js';
import { PERKS } from '../../data/perks.js';
import { themeFor } from '../../data/themes.js';
import { gunArtId } from '../../art/gunart.js';
import { gunAccent } from '../../spells/guns.js';
import { MODS, famCol } from '../../spells/mods.js';
import { FIRE_COLS } from '../../world/fire.js';
import { coinR } from '../../world/nuggets.js';
import { darkPrep } from './dark.js';
import { BG_PAR, drawHolo } from './holo.js';
import { exits } from '../world.js';
import { drawPad } from './pads.js';

// The cave behind everything: the background (with parallax), the shop's back wall, the
// decoration layer and the rock (the visible part only), and the burning pixels over them
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawTerrain(W, G, F) {
  const { vw, vh } = F;
  // background and terrain (visible part only)
  // The background sits further back: it slides BG_PAR as far as the terrain does, so
  // it is shifted by the rest of the camera move. It still covers the view at every edge,
  // because the shift only ever pushes it toward the camera.
  const bgox = W.camX * (1 - BG_PAR), bgoy = W.camY * (1 - BG_PAR);
  const bcx = W.camX - bgox, bcy = W.camY - bgoy;
  const bx0 = clamp(Math.floor(bcx / BCELL), 0, BW - 1), by0 = clamp(Math.floor(bcy / BCELL), 0, BH - 1);
  const bx1 = clamp(Math.ceil((bcx + vw) / BCELL) + 1, 1, BW), by1 = clamp(Math.ceil((bcy + vh) / BCELL) + 1, 1, BH);
  // (floor 2: the back wall at terrain resolution, the same place on screen)
  const hs = G.bgHiOn ? BCELL / CELL : 1;
  G.ctx.drawImage(G.bgHiOn ? G.bgHi : G.bg, bx0 * hs, by0 * hs, (bx1 - bx0) * hs, (by1 - by0) * hs, bx0 * BCELL + bgox, by0 * BCELL + bgoy, (bx1 - bx0) * BCELL, (by1 - by0) * BCELL);
  drawHolo(W, G, F);                        // the hologram, halfway back (holo.js)
  darkPrep(W, G, F);                        // floor 2's dark zones: the silk, and their backs cut out (dark.js)
  // the shop's back wall
  if (W.camY + vh > SHOP_Y) {
    // steel panels: seams every 64, a rail with a lit line along it, a darker skirting
    const wb = SHOP_FLOOR * CELL, wh = wb - SHOP_Y, rail = SHOP_Y + Math.round(wh * 0.64);
    G.ctx.fillStyle = '#161b24';
    G.ctx.fillRect(0, SHOP_Y, WW, wh);
    G.ctx.fillStyle = '#1b212c'; G.ctx.fillRect(0, SHOP_Y, WW, 10);
    G.ctx.fillStyle = '#10141b'; G.ctx.fillRect(0, wb - 10, WW, 10);
    for (let bx = 0; bx < WW; bx += 64) {
      G.ctx.fillStyle = '#0c1016'; G.ctx.fillRect(bx, SHOP_Y, 1.5, wh);
      G.ctx.fillStyle = 'rgba(255,255,255,0.035)'; G.ctx.fillRect(bx + 1.5, SHOP_Y, 1, wh);
      G.ctx.fillStyle = '#262e3a';                         // rivets top and bottom of each panel
      for (const ry of [SHOP_Y + 14, rail - 6, rail + 8, wb - 14]) { G.ctx.fillRect(bx + 5, ry, 1.5, 1.5); G.ctx.fillRect(bx + 57.5, ry, 1.5, 1.5); }
    }
    G.ctx.fillStyle = '#222a36'; G.ctx.fillRect(0, rail, WW, 3);
    G.ctx.fillStyle = 'rgba(90,200,255,0.28)'; G.ctx.fillRect(0, rail + 1, WW, 0.8);
    G.ctx.fillStyle = 'rgba(233,236,242,0.30)';
    G.ctx.font = '600 11px system-ui, sans-serif';
    G.ctx.textAlign = 'center';
    G.ctx.fillText('SHOP', WW / 2, SHOP_Y + 14);
    // The floor number, huge and widely spaced along the whole back wall — just a
    // touch brighter than the wall itself, so it reads as painted-on lettering
    // rather than a label. Each glyph is placed by hand so the word spans most of
    // the wall's width no matter how many digits the floor has.
    const wallBot = SHOP_FLOOR * CELL, wallH = wallBot - SHOP_Y;
    const label = 'FLOOR ' + W.floor;
    G.ctx.fillStyle = 'rgba(255,255,255,0.07)';
    G.ctx.font = '800 ' + Math.round(wallH * 0.62) + 'px system-ui, sans-serif';
    G.ctx.textBaseline = 'middle';
    const margin = WW * 0.05, span = WW - margin * 2, cyText = SHOP_Y + wallH / 2 + 4;
    for (let i = 0; i < label.length; i++)
      G.ctx.fillText(label[i], margin + span * (i + 0.5) / label.length, cyText);
    G.ctx.textBaseline = 'alphabetic';
    G.ctx.textAlign = 'left';
  }

  const tx0 = clamp(Math.floor(W.camX / CELL), 0, CW - 1), ty0 = clamp(Math.floor(W.camY / CELL), 0, CH - 1);
  const tx1 = clamp(Math.ceil((W.camX + vw) / CELL) + 1, 1, CW), ty1 = clamp(Math.ceil((W.camY + vh) / CELL) + 1, 1, CH);
  W.viewW = vw; W.viewH = vh;
  // the decoration layer (pass 2): behind the rock, in front of the back wall
  G.ctx.drawImage(G.RPV ? G.RT.dC : G.decoC, tx0, ty0, tx1 - tx0, ty1 - ty0, tx0 * CELL, ty0 * CELL, (tx1 - tx0) * CELL, (ty1 - ty0) * CELL);
  G.ctx.drawImage(G.RPV ? G.RT.tC : G.terrain, tx0, ty0, tx1 - tx0, ty1 - ty0, tx0 * CELL, ty0 * CELL, (tx1 - tx0) * CELL, (ty1 - ty0) * CELL);
  // the burning pixels, over the art they're eating: colour by how much fuel is left, and a
  // new flicker each fire tick. Drawn under the fog, so fire you haven't seen stays hidden;
  // the glow on top comes after the fog, only on ground you have seen (fireVis).
  W.fireVis.length = 0;
  if (W.fire.list.length) {
    const buckets = [[], [], [], []];
    for (const i of W.fire.list) {
      const x = i % CW, y = (i / CW) | 0;
      if (x < tx0 || x >= tx1 || y < ty0 || y >= ty1) continue;
      W.fireVis.push(i);
      const t = W.fire.t[i], h = (Math.imul(i, 2654435761) + W.fireN * 40503) >>> 30;
      buckets[t <= 3 ? 3 : h === 0 ? 0 : h === 3 ? 2 : 1].push(i);
    }
    for (let c = 0; c < 4; c++) {
      if (!buckets[c].length) continue;
      G.ctx.fillStyle = FIRE_COLS[c];
      G.ctx.beginPath();
      for (const i of buckets[c]) G.ctx.rect((i % CW) * CELL, ((i / CW) | 0) * CELL, CELL, CELL);
      G.ctx.fill();
    }
  }
}

// The props (pass 3), their drips and the theme's ambience (grit, dust devils, spore clouds,
// noise rings). Fills in F.TH (the floor's theme) and F.onView (is a point in view, give or
// take a margin) for the parts after it
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawProps(W, G, F) {
  const { vw, vh } = F;
  // the props (pass 3), their drips and the theme's ambience
  const TH = F.TH = themeFor(W.floor);
  F.onView = (x, y, m) => x > W.camX - m && x < W.camX + vw + m && y > W.camY - m && y < W.camY + vh + m;
  for (const pr of W.props)
    if (pr.x + pr.r > W.camX - 70 && pr.x + pr.l < W.camX + vw + 70 && pr.y + pr.b > W.camY - 90 && pr.y + pr.t0 < W.camY + vh + 90)
      drawProp(G.ctx, pr, W.time, TH);
  for (const q of W.dparts) {
    if (q.glow) continue;
    G.ctx.globalAlpha = Math.min(1, q.life / q.max * 3);
    G.ctx.fillStyle = q.c; G.ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
  }
  G.ctx.lineWidth = 0.8;
  for (const q of W.amb) {
    if (q.glow) continue;
    G.ctx.globalAlpha = Math.min(1, q.life);
    if (q.streak) {
      G.ctx.strokeStyle = q.c; G.ctx.beginPath();
      G.ctx.moveTo(q.x - Math.sign(q.vx) * q.streak, q.y); G.ctx.lineTo(q.x, q.y); G.ctx.stroke();
    } else { G.ctx.fillStyle = q.c; G.ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
  }
  G.ctx.fillStyle = rgbA(mix(TH.rock[1], [255, 255, 255], 0.2));
  for (const dv of W.devils) {                          // a dust devil: a funnel of grit
    G.ctx.globalAlpha = 0.7 * Math.min(1, dv.life / 1.5, (dv.max - dv.life) / 1);
    for (let k = 0; k < 24; k++) {
      const hh = k / 24 * 30, r = 1.5 + hh * 0.35, a = W.time * 10 + k * 1.1;
      G.ctx.fillRect(dv.x + Math.cos(a) * r + Math.sin(W.time * 3 + k) - 0.6, dv.y - hh - 0.6, 1.2, 1.2);
    }
  }
  for (const cl of W.clouds) {                          // a burst pod's spore cloud
    const a = Math.min(1, cl.life / 1.5) * 0.28;
    for (let k = 0; k < 5; k++) {
      const ang = k * 1.26 + W.time * 0.6, rr = cl.r * 0.45;
      G.ctx.globalAlpha = a; G.ctx.fillStyle = '#a8d85a';
      G.ctx.beginPath(); G.ctx.arc(cl.x + Math.cos(ang) * rr, cl.y + Math.sin(ang) * rr * 0.7, cl.r * 0.6, 0, 6.29); G.ctx.fill();
    }
  }
  for (const rg of W.rings) {                           // a noise going out
    G.ctx.globalAlpha = 1 - rg.t / 0.9; G.ctx.strokeStyle = '#f0e6ff'; G.ctx.lineWidth = 1.2;
    G.ctx.beginPath(); G.ctx.arc(rg.x, rg.y, 8 + rg.t * 140, 0, 6.29); G.ctx.stroke();
  }
  G.ctx.globalAlpha = 1;
}

// The exit portals along the top
/** @param {World} W @param {GameCtx} G */
export function drawPortal(W, G) {
  // each exit: a teleporter pad on its ledge (its light is drawPads, after the fog)
  if (W.hasLvl) for (const q of exits(W)) drawPad(G.ctx, q.x + q.w / 2, q.y + q.h, W.time);
}

// The pad you arrived on, as scenery, and its sign (art/sign.js)
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawArrival(W, G, F) {
  const { vh } = F;
  if (W.arrival.y < W.camY + vh + 40 && W.arrival.y > W.camY - 40) {
    drawPad(G.ctx, W.arrival.x, SHOP_FLOOR * CELL, W.time);
    drawTeleSign(G.ctx, W.arrival.x - 6, SHOP_FLOOR * CELL - 64);   // TELEPORTER, nailed over PRINTER
  }
}

// The shop's stock on its plinths: a heal, a gun or a mod each, with its price (or SOLD)
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawShop(W, G, F) {
  const { vh } = F;
  // shop stock on its plinths
  for (const it of W.stock) {
    if (it.y > W.camY + vh + 40 || it.y < W.camY - 40) continue;
    const bob = Math.sin(W.time * 2 + it.x) * 2;
    // the plinth: a narrow column dropping from just under the item down to the shop
    // floor (so it isn't left hovering), with a wider foot resting on the floor
    const floorY = SHOP_FLOOR * CELL;
    G.ctx.fillStyle = '#4a4550';
    G.ctx.fillRect(it.x - 6, it.y + 4, 12, Math.max(9, floorY - (it.y + 4)));
    G.ctx.fillRect(it.x - 11, floorY - 5, 22, 5);
    if (it.sold) {
      G.ctx.fillStyle = COL.muted;
      G.ctx.font = '600 8px system-ui, sans-serif';
      G.ctx.textAlign = 'center';
      G.ctx.fillText('SOLD', it.x, it.y - 2);
      G.ctx.textAlign = 'left';
      continue;
    }
    if (it.kind === 'heal') {
      G.ctx.globalAlpha = 0.25; G.ctx.fillStyle = COL.hp;
      G.ctx.beginPath(); G.ctx.arc(it.x, it.y + bob, 13, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.globalAlpha = 1; G.ctx.fillStyle = COL.hp;
      G.ctx.fillRect(it.x - 7, it.y - 2.5 + bob, 14, 5);
      G.ctx.fillRect(it.x - 2.5, it.y - 7 + bob, 5, 14);
      G.ctx.fillStyle = COL.bullet;
      G.ctx.font = '600 9px system-ui, sans-serif';
      G.ctx.textAlign = 'center';
      G.ctx.fillText(it.price ? it.price + 'g' : 'Free', it.x, it.y - 13 + bob);
      G.ctx.textAlign = 'left';
    } else if (it.kind === 'gun') {
      G.ctx.globalAlpha = 0.22; G.ctx.fillStyle = gunAccent(it.gun);
      G.ctx.beginPath(); G.ctx.arc(it.x, it.y + bob, 14, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.globalAlpha = 1;
      drawGun(G.ctx, it.x - 5, it.y + 1 + bob, -0.22, 0.9, gunArtId(it.gun));
      G.ctx.fillStyle = COL.bullet;
      G.ctx.font = '600 9px system-ui, sans-serif';
      G.ctx.textAlign = 'center';
      G.ctx.fillText(it.price + 'g', it.x, it.y - 13 + bob);
      G.ctx.fillStyle = COL.muted;
      G.ctx.font = '600 8px system-ui, sans-serif';
      G.ctx.fillText(it.gun.cap + ' slots', it.x, it.y + 24 + bob);
      G.ctx.textAlign = 'left';
    } else {
      const m = MODS[it.id];
      G.ctx.globalAlpha = 0.22; G.ctx.fillStyle = famCol(it.id);
      G.ctx.beginPath(); G.ctx.arc(it.x, it.y + bob, 13, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.globalAlpha = 1; G.ctx.fillStyle = famCol(it.id);
      G.ctx.beginPath();
      G.ctx.moveTo(it.x, it.y - 8 + bob); G.ctx.lineTo(it.x + 8, it.y + bob);
      G.ctx.lineTo(it.x, it.y + 8 + bob); G.ctx.lineTo(it.x - 8, it.y + bob);
      G.ctx.fill();
      G.ctx.fillStyle = '#12141a';
      G.ctx.font = '600 9px system-ui, sans-serif';
      G.ctx.textAlign = 'center'; G.ctx.textBaseline = 'middle';
      G.ctx.fillText(m.glyph, it.x, it.y + 0.5 + bob);
      G.ctx.textBaseline = 'alphabetic';
      G.ctx.fillStyle = COL.bullet;
      G.ctx.font = '600 9px system-ui, sans-serif';
      G.ctx.fillText(it.price + 'g', it.x, it.y - 12 + bob);
      G.ctx.textAlign = 'left';
    }
  }
}

// Loot in the cave: gold coins, and the guns and mods lying about (a never-held gun glows)
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawLoot(W, G, F) {
  const { vw, vh } = F;
  // gold
  for (const g of W.coins) {
    if (g.y > W.camY + vh + 30 || g.y < W.camY - 30) continue;
    drawNugget(G.ctx, g.x, g.y, coinR(g), g.t, g.a || 0);
  }

  // pickups
  for (const q of W.pickups) {
    const qy = q.kind === 'crystal' ? q.y : q.y + Math.sin(W.time * 2 + q.t) * 3;   // a crystal is a rock: no bob
    if (qy > W.camY + vh + 30 || qy < W.camY - 30 || q.x < W.camX - 30 || q.x > W.camX + vw + 30) continue;
    if (q.kind === 'gun') {
      // a gun you've never held glows, with sparks streaking out of it; one you swapped
      // out and left on the ground doesn't, so you can tell new from discarded at a glance
      if (!q.old) drawGunGlow(G.ctx, q.x, qy, W.time, q.t);
      drawGun(G.ctx, q.x - 5, qy + 1, -0.22, 0.85, gunArtId(q.gun));
    } else if (q.kind === 'crystal') {
      // a red crystal: a big dark red nugget shedding sparkles on the breeze (crystalMotes; a green one: green),
      // turned as it rolls
      drawNugget(G.ctx, q.x, qy, CRYSTAL_R, q.t * 7, q.a || 0, q.green ? GREEN_PAL : CRYSTAL_PAL);
    } else if (q.kind === 'perk') {
      // a perk to carry: its sigil in a ring of its colour
      const pk = PERKS[q.id], col = pk.tint || COL.portal;
      G.ctx.globalAlpha = 0.22; G.ctx.fillStyle = col;
      G.ctx.beginPath(); G.ctx.arc(q.x, qy, 12, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.globalAlpha = 1; G.ctx.strokeStyle = col; G.ctx.lineWidth = 1.2;
      G.ctx.beginPath(); G.ctx.arc(q.x, qy, 9, 0, Math.PI * 2); G.ctx.stroke();
      G.ctx.fillStyle = col; G.ctx.font = '700 12px system-ui, sans-serif';
      G.ctx.textAlign = 'center'; G.ctx.textBaseline = 'middle';
      G.ctx.fillText(pk.glyph, q.x, qy + 0.5);
      G.ctx.textAlign = 'left'; G.ctx.textBaseline = 'alphabetic';
    } else {
      const m = MODS[q.id];
      G.ctx.globalAlpha = 0.22; G.ctx.fillStyle = famCol(q.id);
      G.ctx.beginPath(); G.ctx.arc(q.x, qy, 12, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.globalAlpha = 1;
      G.ctx.fillStyle = famCol(q.id);
      G.ctx.beginPath();
      G.ctx.moveTo(q.x, qy - 8); G.ctx.lineTo(q.x + 8, qy); G.ctx.lineTo(q.x, qy + 8); G.ctx.lineTo(q.x - 8, qy);
      G.ctx.fill();
      G.ctx.fillStyle = '#12141a';
      G.ctx.font = '600 9px system-ui, sans-serif';
      G.ctx.textAlign = 'center'; G.ctx.textBaseline = 'middle';
      G.ctx.fillText(m.glyph, q.x, qy + 0.5);
      G.ctx.textAlign = 'left'; G.ctx.textBaseline = 'alphabetic';
    }
  }
}

// The hidden rooms' prizes on their altars: a perk's sigil, or the +25 heart
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawRooms(W, G, F) {
  const { vw, vh } = F;
  // the hidden rooms' prizes on their altars: a glowing perk sigil, or the +25 heart
  for (const r of W.rooms) {
    if (r.y > W.camY + vh + 40 || r.y < W.camY - 40 || r.x < W.camX - 40 || r.x > W.camX + vw + 40) continue;
    const bob = Math.sin(W.time * 2 + r.x) * 2.5;
    G.ctx.fillStyle = '#4a4550';             // the altar stays when its prize is taken: you can stand on it
    G.ctx.fillRect(r.x - 12, r.y + 14, 24, 5);
    G.ctx.fillRect(r.x - 7, r.y + 5, 14, 10);
    if (r.taken) continue;
    if (r.kind === 'green') {
      // a green crystal on the altar, shedding sparkles (crystalMotes); it drops off the altar once you're near
      drawNugget(G.ctx, r.x, r.y + bob, CRYSTAL_R, r.x * 0.37, 0, GREEN_PAL);
    } else if (r.kind === 'perk' && r.id) {
      const pk = PERKS[r.id], col = pk.tint || COL.portal;
      G.ctx.globalAlpha = 0.22 + 0.12 * Math.sin(W.time * 3);
      G.ctx.fillStyle = col;
      G.ctx.beginPath(); G.ctx.arc(r.x, r.y + bob, 16, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.globalAlpha = 1;
      G.ctx.fillStyle = col;
      G.ctx.font = '700 20px system-ui, sans-serif';
      G.ctx.textAlign = 'center'; G.ctx.textBaseline = 'middle';
      G.ctx.fillText(pk.glyph, r.x, r.y + 0.5 + bob);
      G.ctx.textBaseline = 'alphabetic'; G.ctx.textAlign = 'left';
    } else {
      G.ctx.globalAlpha = 0.25 + 0.12 * Math.sin(W.time * 3);
      G.ctx.fillStyle = COL.hp;
      G.ctx.beginPath(); G.ctx.arc(r.x, r.y + bob, 16, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.globalAlpha = 1; G.ctx.fillStyle = COL.hp;
      // a plump heart
      G.ctx.beginPath();
      G.ctx.moveTo(r.x, r.y + 7 + bob);
      G.ctx.bezierCurveTo(r.x - 11, r.y - 2 + bob, r.x - 6, r.y - 11 + bob, r.x, r.y - 4 + bob);
      G.ctx.bezierCurveTo(r.x + 6, r.y - 11 + bob, r.x + 11, r.y - 2 + bob, r.x, r.y + 7 + bob);
      G.ctx.fill();
      G.ctx.fillStyle = '#0c130f';
      G.ctx.font = '700 8px system-ui, sans-serif';
      G.ctx.textAlign = 'center';
      G.ctx.fillText('+25', r.x, r.y - 14 + bob);
      G.ctx.textAlign = 'left';
    }
  }
}
