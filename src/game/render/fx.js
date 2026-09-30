// @ts-check
// The FX layer: effects drawn over the whole finished picture (after the fog and the lights),
// that change its look rather than add things to it. Now: the hologram's bloom.

import { FH, FOG_U, FW, WH } from '../../core/consts.js';
import { DEV } from '../../dev/knobs.js';
import { holoMask, sizedCanvas } from './holo.js';
import { fogWarC } from './light.js';

const D = 4;                                   // the bloom buffers are 1/D of the canvas

/** @type {{ a: HTMLCanvasElement | null, b: HTMLCanvasElement | null }} */
const buf = { a: null, b: null };

// The hologram's bloom: the parts of it you can actually see (not behind rock, the shop wall
// or the fog of war), brightened, blurred and added over everything, so its light spills round the
// rock, the creatures and you
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawFx(W, G, F) {
  if (!(DEV.bloom > 0) || !(DEV.holoAlpha > 0)) return;
  const w = Math.max(1, Math.ceil(G.c.width / D)), h = Math.max(1, Math.ceil(G.c.height / D));
  const A = buf.a = sizedCanvas(buf.a, w, h), B = buf.b = sizedCanvas(buf.b, w, h);
  const a = A.getContext('2d'), b = B.getContext('2d');
  if (!a || !b) return;
  const m = G.ctx.getTransform();              // the world's transform, shrunk into the buffer
  a.setTransform(1, 0, 0, 1, 0, 0); a.clearRect(0, 0, w, h);
  a.setTransform(m.a / D, 0, 0, m.d / D, m.e / D, m.f / D);
  holoMask(a, W, G, F, DEV.holoAlpha);
  // and the fog of war (only: the dark outside your torchlight doesn't dim the hologram)
  const war = fogWarC();
  if (war && (!G.RPV || G.RPV.fog)) {
    a.globalCompositeOperation = 'destination-out'; a.imageSmoothingEnabled = true;
    a.drawImage(war, 0, 0, FW, FH, 0, 0, FW * FOG_U, FH * FOG_U);
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
