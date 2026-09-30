// @ts-check
// The hologram between the background and the rock: a slanted, tiled "N biological entities
// detected" counter in flat bright red and nothing else (dark parts are see-through). It
// parallaxes halfway between the two (HOLO_PAR). At zero it flips (the top box an outline, the
// bottom one solid) and turns green. Its glow is the bloom in fx.js, which uses holoFill.

import { PH, SHOP_Y } from '../../core/consts.js';
import { bioCount } from '../../creatures/common.js';
import { DEV } from '../../dev/knobs.js';

export const BG_PAR = 0.6;                     // the background slides this far with the camera
export const HOLO_PAR = (1 + BG_PAR) / 2;      // the hologram: halfway to the rock

// the tile, in world units: the boxes, and the grid they repeat on (PERIOD_X x PERIOD_Y)
const BOX_W = 96, TOP_H = 66, BOT_H = 60;      // the solid box, the outlined box under it
const PERIOD_X = 300, PERIOD_Y = 342;          // one tile to the next
const PAD = 7.5, TXT_PAD = 7.5;                // number padding; the words' padding
const LINE = 1.5;                              // outline width
const SLANT = -0.3;                            // radians
const RES = 4;                                 // tile canvas pixels per world unit

/** @type {{ key: string, pat: CanvasPattern | null }} */
const cache = { key: '', pat: null };

// One tile: bright red, and "black" is simply nothing, so the number is cut out of the solid box
/** @param {CanvasRenderingContext2D} ctx @param {number} n */
function tilePattern(ctx, n) {
  const key = String(n);
  if (cache.key === key && cache.pat) return cache.pat;
  const zero = n === 0, hue = zero ? '#00ff3c' : '#ff0000';
  const c = document.createElement('canvas');
  c.width = PERIOD_X * RES; c.height = PERIOD_Y * RES;
  const t = c.getContext('2d');
  if (!t) return null;
  t.scale(RES, RES);
  const x = (PERIOD_X - BOX_W) / 2, y = (PERIOD_Y - TOP_H - BOT_H) / 2, by = y + TOP_H;
  /** @param {number} yy @param {number} hh @param {boolean} solid */
  const box = (yy, hh, solid) => {
    t.globalCompositeOperation = 'source-over';
    if (solid) { t.fillStyle = hue; t.fillRect(x, yy, BOX_W, hh); return; }
    t.strokeStyle = hue; t.lineWidth = LINE;
    t.strokeRect(x + LINE / 2, yy + LINE / 2, BOX_W - LINE, hh - LINE);
  };
  // text in a solid box is cut out of it; in an outlined box it's drawn in the hue
  /** @param {boolean} cut */
  const ink = cut => { t.globalCompositeOperation = cut ? 'destination-out' : 'source-over'; t.fillStyle = cut ? '#000' : hue; };
  box(y, TOP_H, !zero);
  const s = String(n);
  let fs = Math.min(BOX_W, TOP_H) - PAD * 2;
  t.font = '900 ' + fs + 'px system-ui, sans-serif';
  const w = t.measureText(s).width;
  if (w > BOX_W - PAD * 2) { fs *= (BOX_W - PAD * 2) / w; t.font = '900 ' + fs + 'px system-ui, sans-serif'; }
  ink(!zero); t.textBaseline = 'middle'; t.textAlign = 'left';
  t.fillText(s, x + PAD, y + TOP_H / 2 + fs * 0.05);
  box(by, BOT_H, zero);
  const words = ['biological', 'entities', 'detected'], lh = (BOT_H - TXT_PAD * 2) / words.length;
  t.font = '700 ' + (lh * 0.85) + 'px system-ui, sans-serif'; t.textBaseline = 'top';
  ink(zero);
  words.forEach((wd, i) => t.fillText(wd, x + TXT_PAD, by + TXT_PAD + i * lh + lh * 0.08));
  cache.key = key; cache.pat = ctx.createPattern(c, 'repeat');
  if (cache.pat) cache.pat.setTransform(new DOMMatrix().scale(1 / RES));
  return cache.pat;
}

// Fill ctx (under the world's transform) with the hologram over the whole view
/** @param {CanvasRenderingContext2D} ctx @param {World} W @param {DrawFrame} F */
export function holoFill(ctx, W, F) {
  const n = bioCount(W.enemies, !W.p.dead && W.p.y + PH <= SHOP_Y);
  const pat = tilePattern(ctx, n);
  if (!pat) return;
  const ox = W.camX * (1 - HOLO_PAR), oy = W.camY * (1 - HOLO_PAR);
  const cx = W.camX + F.vw / 2, cy = W.camY + F.vh / 2, R = Math.hypot(F.vw, F.vh) / 2 + 10;
  ctx.save();
  ctx.translate(ox, oy); ctx.rotate(SLANT);
  // the view's centre in the tilted frame, and a square round it that covers the view
  const dx = cx - ox, dy = cy - oy, c = Math.cos(-SLANT), s = Math.sin(-SLANT);
  const lx = dx * c - dy * s, ly = dx * s + dy * c;
  ctx.fillStyle = pat; ctx.fillRect(lx - R, ly - R, R * 2, R * 2);
  ctx.restore();
}

// Drawn right after the background, before the shop wall and the rock (so rock and the shop
// cover it), in world space: shifted by its share of the camera move, then tilted
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawHolo(W, G, F) {
  G.ctx.globalAlpha = DEV.holoAlpha;
  holoFill(G.ctx, W, F);
  G.ctx.globalAlpha = 1;
}
