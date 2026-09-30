// @ts-check
// The FX layer: effects drawn over the whole finished picture (after the fog and the lights),
// that change its look rather than add things to it. Now: the hologram's bloom.

import { CELL, CH, CW, FH, FOG_U, FW, SHOP_FLOOR, SHOP_Y, WH, WW } from '../../core/consts.js';
import { clamp } from '../../core/util.js';
import { DEV } from '../../dev/knobs.js';
import { holoFill } from './holo.js';

const D = 4;                                   // the bloom buffers are 1/D of the canvas

/** @type {{ a: HTMLCanvasElement | null, b: HTMLCanvasElement | null }} */
const buf = { a: null, b: null };
/** @param {HTMLCanvasElement | null} c @param {number} w @param {number} h @returns {HTMLCanvasElement} */
const sized = (c, w, h) => {
  const o = c || document.createElement('canvas');
  if (o.width !== w || o.height !== h) { o.width = w; o.height = h; }
  return o;
};

// The hologram's bloom: the parts of it you can actually see (not behind rock, the shop wall
// or the fog), brightened, blurred and added over everything, so its light spills round the
// rock, the creatures and you
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawFx(W, G, F) {
  if (!(DEV.bloom > 0) || !(DEV.holoAlpha > 0)) return;
  const w = Math.max(1, Math.ceil(G.c.width / D)), h = Math.max(1, Math.ceil(G.c.height / D));
  const A = buf.a = sized(buf.a, w, h), B = buf.b = sized(buf.b, w, h);
  const a = A.getContext('2d'), b = B.getContext('2d');
  if (!a || !b) return;
  const m = G.ctx.getTransform();              // the world's transform, shrunk into the buffer
  a.setTransform(1, 0, 0, 1, 0, 0); a.clearRect(0, 0, w, h);
  a.setTransform(m.a / D, 0, 0, m.d / D, m.e / D, m.f / D);
  a.globalCompositeOperation = 'source-over'; a.globalAlpha = DEV.holoAlpha;
  holoFill(a, W, F);
  a.globalAlpha = 1;
  // cut out what covers it: the decoration and the rock, the shop's wall, the fog, below the floor
  a.globalCompositeOperation = 'destination-out';
  a.imageSmoothingEnabled = false;
  const tx0 = clamp(Math.floor(W.camX / CELL), 0, CW - 1), ty0 = clamp(Math.floor(W.camY / CELL), 0, CH - 1);
  const tx1 = clamp(Math.ceil((W.camX + F.vw) / CELL) + 1, 1, CW), ty1 = clamp(Math.ceil((W.camY + F.vh) / CELL) + 1, 1, CH);
  for (const src of G.RPV ? [G.RT.dC, G.RT.tC] : [G.decoC, G.terrain])
    a.drawImage(src, tx0, ty0, tx1 - tx0, ty1 - ty0, tx0 * CELL, ty0 * CELL, (tx1 - tx0) * CELL, (ty1 - ty0) * CELL);
  a.fillStyle = '#000'; a.fillRect(0, SHOP_Y, WW, SHOP_FLOOR * CELL - SHOP_Y);
  if (W.camY + F.vh > WH) a.fillRect(W.camX - 10, WH, F.vw + 20, W.camY + F.vh - WH + 10);   // below the floor: black
  if (!G.RPV || G.RPV.fog) {
    a.imageSmoothingEnabled = true;
    a.drawImage(G.fogBlurC, 0, 0, FW, FH, 0, 0, FW * FOG_U, FH * FOG_U);
  }
  a.globalCompositeOperation = 'source-over';
  // blur (and brighten) at the small size, then lay it over the picture as light
  b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, w, h);
  b.filter = 'blur(' + (DEV.bloomBlur * F.dpr / D).toFixed(2) + 'px) brightness(' + DEV.bloomBright + ')';
  b.drawImage(A, 0, 0);
  b.filter = 'none';
  G.ctx.save();
  G.ctx.setTransform(1, 0, 0, 1, 0, 0);
  G.ctx.globalCompositeOperation = 'lighter'; G.ctx.globalAlpha = Math.min(1, DEV.bloom);
  G.ctx.imageSmoothingEnabled = true;
  G.ctx.drawImage(B, 0, 0, w * D, h * D);
  if (DEV.bloom > 1) { G.ctx.globalAlpha = DEV.bloom - 1; G.ctx.drawImage(B, 0, 0, w * D, h * D); }
  G.ctx.restore();
}

// Below the shop floor is the end of the world: plain black over everything drawn there (the
// background, the hologram and its glow)
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawBelow(W, G, F) {
  if (W.camY + F.vh <= WH) return;
  G.ctx.fillStyle = '#000';
  G.ctx.fillRect(W.camX - 10, WH, F.vw + 20, W.camY + F.vh - WH + 10);
}
