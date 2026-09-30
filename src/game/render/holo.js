// @ts-check
// The hologram between the background and the rock: a slanted, tiled, glowing red "N biological entities
// detected" counter. It parallaxes halfway between the two (HOLO_PAR). Red while anything lives;
// at zero it flips (the top box black, the bottom solid) and turns green.

import { PH, SHOP_Y } from '../../core/consts.js';
import { bioCount } from '../../creatures/common.js';

export const BG_PAR = 0.6;                     // the background slides this far with the camera
export const HOLO_PAR = (1 + BG_PAR) / 2;      // the hologram: halfway to the rock

// the tile, in world units
const BOX_W = 192, TOP_H = 132, BOT_H = 120;   // the lit box, the outlined box under it
const PAD = 15, TXT_PAD = 15;                  // number padding; the words' padding
const GAP_X = 108, GAP_Y = 90;                 // space between tiles
const SLANT = -0.3;                            // radians
const ALPHA = 0.45;                            // added as light over the background
const FILL = 0.42;                             // how bright a "solid" box glows
const LINE = 3;                                // outline width
const GLOW = 10;                               // halo size, world units
const RES = 3;                                 // tile canvas pixels per world unit

/** @type {{ key: string, pat: CanvasPattern | null }} */
const cache = { key: '', pat: null };

// One tile, drawn as light: "black" is simply no light, so a dark number in a lit box is cut
// out of it. Drawn sharp on a layer, then laid down with a coloured halo round it.
/** @param {CanvasRenderingContext2D} ctx @param {number} n */
function tilePattern(ctx, n) {
  const key = String(n);
  if (cache.key === key && cache.pat) return cache.pat;
  const zero = n === 0;
  const hue = zero ? '61,255,110' : '255,40,40', core = zero ? '#b8ffc8' : '#ff9a9a';
  const W = (BOX_W + GAP_X) * RES, H = (TOP_H + BOT_H + GAP_Y) * RES;
  const L = document.createElement('canvas'); L.width = W; L.height = H;
  const t = L.getContext('2d');
  if (!t) return null;
  t.scale(RES, RES);
  const x = GAP_X / 2, y = GAP_Y / 2, by = y + TOP_H;
  /** @param {number} yy @param {number} hh @param {boolean} lit */
  const box = (yy, hh, lit) => {
    if (lit) { t.fillStyle = 'rgba(' + hue + ',' + FILL + ')'; t.fillRect(x, yy, BOX_W, hh); }
    t.strokeStyle = core; t.lineWidth = LINE;
    t.strokeRect(x + LINE / 2, yy + LINE / 2, BOX_W - LINE, hh - LINE);
  };
  /** @param {boolean} cut */
  const ink = cut => {
    t.globalCompositeOperation = cut ? 'destination-out' : 'source-over';
    t.fillStyle = cut ? '#000' : core;
  };
  // the top box: lit with the number cut out of it (at zero: an outline with a lit number)
  box(y, TOP_H, !zero);
  const s = String(n);
  let fs = Math.min(BOX_W, TOP_H) - PAD * 2;
  t.font = '900 ' + fs + 'px system-ui, sans-serif';
  const w = t.measureText(s).width;
  if (w > BOX_W - PAD * 2) { fs *= (BOX_W - PAD * 2) / w; t.font = '900 ' + fs + 'px system-ui, sans-serif'; }
  ink(!zero); t.textBaseline = 'middle'; t.textAlign = 'left';
  t.fillText(s, x + PAD, y + TOP_H / 2 + fs * 0.05);
  t.globalCompositeOperation = 'source-over';
  // the bottom box: an outline with lit words (at zero: lit with the words cut out)
  box(by, BOT_H, zero);
  const words = ['biological', 'entities', 'detected'], lh = (BOT_H - TXT_PAD * 2) / words.length;
  t.font = '700 ' + (lh * 0.85) + 'px system-ui, sans-serif'; t.textBaseline = 'top';
  ink(zero);
  words.forEach((wd, i) => t.fillText(wd, x + TXT_PAD, by + TXT_PAD + i * lh + lh * 0.08));
  // scanlines
  t.globalCompositeOperation = 'destination-out'; t.fillStyle = 'rgba(0,0,0,0.35)';
  for (let sy = 0; sy < H / RES; sy += 4.5) t.fillRect(0, sy, W / RES, 1.5);
  // the tile: the layer twice with a halo, then once sharp
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const o = c.getContext('2d');
  if (!o) return null;
  o.shadowColor = 'rgba(' + hue + ',1)'; o.shadowBlur = GLOW * RES;
  o.drawImage(L, 0, 0); o.drawImage(L, 0, 0);
  o.shadowBlur = 0; o.drawImage(L, 0, 0);
  cache.key = key; cache.pat = ctx.createPattern(c, 'repeat');
  if (cache.pat) cache.pat.setTransform(new DOMMatrix().scale(1 / RES));
  return cache.pat;
}

// Drawn right after the background, before the shop wall and the rock (so rock and the shop
// cover it), in world space: shifted by its share of the camera move, then tilted
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawHolo(W, G, F) {
  const n = bioCount(W.enemies, !W.p.dead && W.p.y + PH <= SHOP_Y);
  const pat = tilePattern(G.ctx, n);
  if (!pat) return;
  const ctx = G.ctx, ox = W.camX * (1 - HOLO_PAR), oy = W.camY * (1 - HOLO_PAR);
  const cx = W.camX + F.vw / 2, cy = W.camY + F.vh / 2, R = Math.hypot(F.vw, F.vh) / 2 + 10;
  ctx.save();
  ctx.globalAlpha = ALPHA * (0.92 + 0.08 * Math.sin(W.time * 7));   // a faint flicker
  ctx.globalCompositeOperation = 'lighter';                       // it's light: it adds
  ctx.translate(ox, oy); ctx.rotate(SLANT);
  // the view's centre in the tilted frame, and a square round it that covers the view
  const dx = cx - ox, dy = cy - oy, c = Math.cos(-SLANT), s = Math.sin(-SLANT);
  const lx = dx * c - dy * s, ly = dx * s + dy * c;
  ctx.fillStyle = pat; ctx.fillRect(lx - R, ly - R, R * 2, R * 2);
  ctx.restore();
}
