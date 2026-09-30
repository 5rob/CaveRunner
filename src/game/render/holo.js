// @ts-check
// The hologram between the background and the rock: a slanted, tiled "N biological entities
// detected" counter. It parallaxes halfway between the two (HOLO_PAR). Red while anything lives;
// at zero it flips (the top box black, the bottom solid) and turns green.

import { PH, SHOP_Y } from '../../core/consts.js';
import { bioCount } from '../../creatures/common.js';

export const BG_PAR = 0.6;                     // the background slides this far with the camera
export const HOLO_PAR = (1 + BG_PAR) / 2;      // the hologram: halfway to the rock

// the tile, in world units
const BOX_W = 64, TOP_H = 44, BOT_H = 40;      // the red box, the black box under it
const PAD = 5, TXT_PAD = 5;                    // number padding; the words' padding
const GAP_X = 36, GAP_Y = 30;                  // space between tiles
const SLANT = -0.3;                            // radians
const ALPHA = 0.22;
const RES = 4;                                 // tile canvas pixels per world unit

/** @type {{ key: string, pat: CanvasPattern | null }} */
const cache = { key: '', pat: null };

/** @param {CanvasRenderingContext2D} ctx @param {number} n */
function tilePattern(ctx, n) {
  const key = String(n);
  if (cache.key === key && cache.pat) return cache.pat;
  const zero = n === 0, hue = zero ? '#3dff6e' : '#ff2a2a';
  const c = document.createElement('canvas');
  c.width = (BOX_W + GAP_X) * RES; c.height = (TOP_H + BOT_H + GAP_Y) * RES;
  const t = c.getContext('2d');
  if (!t) return null;
  t.scale(RES, RES);
  const x = GAP_X / 2, y = GAP_Y / 2, lw = 1.2;
  // top: solid with black numbers (at zero: black with a hue outline and hue numbers)
  t.fillStyle = zero ? '#000' : hue; t.fillRect(x, y, BOX_W, TOP_H);
  if (zero) { t.strokeStyle = hue; t.lineWidth = lw; t.strokeRect(x + lw / 2, y + lw / 2, BOX_W - lw, TOP_H - lw); }
  const s = String(n);
  let fs = Math.min(BOX_W, TOP_H) - PAD * 2;
  t.font = '900 ' + fs + 'px system-ui, sans-serif';
  const w = t.measureText(s).width;
  if (w > BOX_W - PAD * 2) { fs *= (BOX_W - PAD * 2) / w; t.font = '900 ' + fs + 'px system-ui, sans-serif'; }
  t.fillStyle = zero ? hue : '#000'; t.textBaseline = 'middle'; t.textAlign = 'left';
  t.fillText(s, x + PAD, y + TOP_H / 2 + fs * 0.05);
  // bottom: black with a hue outline and hue words (at zero: solid with black words)
  const by = y + TOP_H;
  t.fillStyle = zero ? hue : '#000'; t.fillRect(x, by, BOX_W, BOT_H);
  if (!zero) { t.strokeStyle = hue; t.lineWidth = lw; t.strokeRect(x + lw / 2, by + lw / 2, BOX_W - lw, BOT_H - lw); }
  const words = ['biological', 'entities', 'detected'], lh = (BOT_H - TXT_PAD * 2) / words.length;
  t.font = '700 ' + (lh * 0.85) + 'px system-ui, sans-serif'; t.textBaseline = 'top';
  t.fillStyle = zero ? '#000' : hue;
  words.forEach((wd, i) => t.fillText(wd, x + TXT_PAD, by + TXT_PAD + i * lh + lh * 0.08));
  // scanlines, for the hologram look
  t.globalCompositeOperation = 'destination-out'; t.fillStyle = 'rgba(0,0,0,0.35)';
  for (let sy = 0; sy < c.height / RES; sy += 1.5) t.fillRect(0, sy, c.width / RES, 0.5);
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
  ctx.translate(ox, oy); ctx.rotate(SLANT);
  // the view's centre in the tilted frame, and a square round it that covers the view
  const dx = cx - ox, dy = cy - oy, c = Math.cos(-SLANT), s = Math.sin(-SLANT);
  const lx = dx * c - dy * s, ly = dx * s + dy * c;
  ctx.fillStyle = pat; ctx.fillRect(lx - R, ly - R, R * 2, R * 2);
  ctx.restore();
}
