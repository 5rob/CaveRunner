// @ts-check
// The hologram between the background and the rock: a slanted, tiled "N biological entities
// detected" counter in flat bright red and nothing else (dark parts are see-through). It
// parallaxes halfway between the two (HOLO_PAR). At zero it flips (the top box an outline, the
// bottom one solid) and turns green, with static running through it and a glitch when the number
// changes. Its glow is the bloom in fx.js.

import { CELL, CH, CW, PH, SHOP_FLOOR, SHOP_Y, WH, WW } from '../../core/consts.js';
import { clamp } from '../../core/util.js';
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

// the static and the glitch (seconds, world units, css px)
const SCAN = 3, SCAN_SPEED = 6;                // fine scan lines: spacing, crawl speed
const BANDS = 3, BAND_SPEED = 45;              // rolling bands
const GLITCH_T = 0.45;                         // how long the glitch runs when the number changes

// a steady pseudo-random 0..1 for n (draw() mustn't touch Math.random: it's the simulation's)
/** @param {number} n */
const hash = n => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };

/** @type {{ c: HTMLCanvasElement | null, tmp: HTMLCanvasElement | null, n: number, gt: number }} */
const L = { c: null, tmp: null, n: -1, gt: -99 };

// How much of the change glitch is left: 1 the moment the number changes, down to 0
/** @param {World} W */
export const holoGlitch = W => Math.max(0, Math.min(1, 1 - (W.time - L.gt) / GLITCH_T));

// Fill ctx (under the world's transform) with the hologram over the whole view, with its
// static: fine scan lines crawling down it, a few rolling bands, and now and then a dropout
/** @param {CanvasRenderingContext2D} ctx @param {World} W @param {DrawFrame} F @param {number} n */
function holoFill(ctx, W, F, n) {
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
  // the static, cut out of it (in the tilted frame, so the lines run along the tiles)
  ctx.globalCompositeOperation = 'destination-out';
  const t = W.time, fl = Math.floor(t * 24);
  ctx.fillStyle = 'rgba(0,0,0,' + (0.3 + 0.15 * hash(fl)).toFixed(2) + ')';
  for (let y = Math.floor((ly - R) / SCAN) * SCAN + (t * SCAN_SPEED) % SCAN; y < ly + R; y += SCAN) ctx.fillRect(lx - R, y, R * 2, 0.8);
  for (let k = 0; k < BANDS; k++) {
    const y = ly - R + ((t * BAND_SPEED * (0.7 + 0.3 * k) + k * 173) % (R * 2)), hh = 4 + 10 * hash(k * 7.1);
    ctx.fillStyle = 'rgba(0,0,0,' + (0.25 + 0.4 * hash(fl * 3 + k)).toFixed(2) + ')';
    ctx.fillRect(lx - R, y, R * 2, hh);
  }
  if (hash(fl * 0.37 + 11) < 0.07) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(lx - R, ly - R, R * 2, R * 2); }
  ctx.restore();
}

// The change glitch, in screen space on the layer: slices of it torn sideways and blocks of data
// dropping out, strongest the moment the number changes
/** @param {CanvasRenderingContext2D} lc @param {HTMLCanvasElement} C @param {number} g @param {number} t @param {number} dpr */
function glitch(lc, C, g, t, dpr) {
  const T = L.tmp = sizedCanvas(L.tmp, C.width, C.height), tc = T.getContext('2d');
  if (!tc) return;
  tc.clearRect(0, 0, T.width, T.height); tc.drawImage(C, 0, 0);
  const w = C.width, h = C.height, f = Math.floor(t * 30);
  lc.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < 12; i++) {
    const y = Math.floor(hash(f * 13 + i) * h), hh = Math.ceil((3 + 40 * hash(f * 7 + i * 3)) * dpr);
    const dx = Math.round((hash(f * 5 + i * 11) - 0.5) * 80 * dpr * g);
    lc.clearRect(0, y, w, hh); lc.drawImage(T, 0, y, w, hh, dx, y, w, hh);
  }
  lc.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 18; i++) {
    const bw = (6 + 50 * hash(f * 3 + i * 17)) * dpr, bh = (2 + 8 * hash(f * 9 + i)) * dpr;
    lc.fillRect(hash(f + i * 29) * w, hash(f * 2 + i * 31) * h, bw * g, bh);
  }
  lc.globalCompositeOperation = 'source-over';
}

// The hologram for this frame, made once into its own layer (the canvas's size, screen space)
// and drawn from there: right after the background, before the shop wall and the rock (so rock
// and the shop cover it). The fog swap (light.js) and the bloom (fx.js) reuse the layer
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawHolo(W, G, F) {
  const n = bioCount(W.enemies, !W.p.dead && W.p.y + PH <= SHOP_Y);
  if (n !== L.n) { if (L.n >= 0) L.gt = W.time; L.n = n; }
  if (L.gt > W.time) L.gt = -99;                // a new run: the clock started again
  const C = L.c = sizedCanvas(L.c, G.c.width, G.c.height), lc = C.getContext('2d');
  if (!lc) return;
  lc.setTransform(1, 0, 0, 1, 0, 0); lc.clearRect(0, 0, C.width, C.height);
  lc.setTransform(G.ctx.getTransform());
  holoFill(lc, W, F, n);
  const g = holoGlitch(W);
  if (g > 0) glitch(lc, C, g, W.time, F.dpr);
  G.ctx.save();
  G.ctx.setTransform(1, 0, 0, 1, 0, 0);
  G.ctx.globalAlpha = DEV.holoAlpha;
  G.ctx.drawImage(C, 0, 0);
  G.ctx.restore();
}

// A canvas of (at least) w x h, reused: made once, resized only when the view changes
/** @param {HTMLCanvasElement | null} c @param {number} w @param {number} h @returns {HTMLCanvasElement} */
export function sizedCanvas(c, w, h) {
  const o = c || document.createElement('canvas');
  if (o.width !== w || o.height !== h) { o.width = w; o.height = h; }
  return o;
}

// The part of the hologram you could see, drawn into a (1/D of the canvas, already under the
// world's transform shrunk by D): this frame's layer, with what's in front of it cut out (the
// decoration and the rock, the shop's wall, below the floor). Not the fog: the callers cut the
// fog they want
/** @param {CanvasRenderingContext2D} a @param {World} W @param {GameCtx} G @param {DrawFrame} F @param {number} alpha @param {number} D */
export function holoMask(a, W, G, F, alpha, D) {
  if (!L.c) return;
  a.save();
  a.setTransform(1, 0, 0, 1, 0, 0);
  a.globalCompositeOperation = 'source-over'; a.globalAlpha = alpha;
  a.imageSmoothingEnabled = true;
  a.drawImage(L.c, 0, 0, L.c.width / D, L.c.height / D);
  a.restore();
  a.globalCompositeOperation = 'destination-out';
  a.imageSmoothingEnabled = false;
  const tx0 = clamp(Math.floor(W.camX / CELL), 0, CW - 1), ty0 = clamp(Math.floor(W.camY / CELL), 0, CH - 1);
  const tx1 = clamp(Math.ceil((W.camX + F.vw) / CELL) + 1, 1, CW), ty1 = clamp(Math.ceil((W.camY + F.vh) / CELL) + 1, 1, CH);
  for (const src of G.RPV ? [G.RT.dC, G.RT.tC] : [G.decoC, G.terrain])
    a.drawImage(src, tx0, ty0, tx1 - tx0, ty1 - ty0, tx0 * CELL, ty0 * CELL, (tx1 - tx0) * CELL, (ty1 - ty0) * CELL);
  a.fillStyle = '#000'; a.fillRect(0, SHOP_Y, WW, SHOP_FLOOR * CELL - SHOP_Y);
  if (W.camY + F.vh > WH) a.fillRect(W.camX - 10, WH, F.vw + 20, W.camY + F.vh - WH + 10);
  a.globalCompositeOperation = 'source-over';
}
