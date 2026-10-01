// @ts-check
// The FX layer: effects drawn over the whole finished picture (after the fog and the lights),
// that change its look rather than add things to it. Now: the hologram's bloom (with a flash
// when its number changes).

import { FH, FOG_U, FW, WH } from '../../core/consts.js';
import { DEV } from '../../dev/knobs.js';
import { holoBright, holoGlitch, holoGrid, holoMask, sizedCanvas } from './holo.js';
import { fogWarC, holoSil } from './light.js';

const GLITCH_FLASH = 1.5;                      // the glow's flash when the number changes (×)

/** @type {{ a: HTMLCanvasElement | null, b: HTMLCanvasElement | null }} */
const buf = { a: null, b: null };

// The hologram's bloom: the parts of it you can actually see (not behind rock, the shop wall
// or the fog of war), brightened, blurred and added over everything, so its light spills round the
// rock, the creatures and you. Worked out on the hologram's own pixel grid (holoGrid), and
// laid over smooth: it's a glow
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawFx(W, G, F) {
  if (!(DEV.bloom > 0) || !(holoBright() > 0)) return;
  const w = holoGrid.w, h = holoGrid.h;
  const A = buf.a = sizedCanvas(buf.a, w, h), B = buf.b = sizedCanvas(buf.b, w, h);
  const a = A.getContext('2d'), b = B.getContext('2d');
  if (!a || !b) return;
  a.setTransform(1, 0, 0, 1, 0, 0); a.clearRect(0, 0, w, h);
  holoGrid.world(a);
  holoMask(a, W, G, F, holoBright());
  // and the fog of war (only: the dark outside your torchlight doesn't dim the hologram)
  const war = fogWarC();
  if (war && (!G.RPV || G.RPV.fog)) {
    a.globalCompositeOperation = 'destination-out'; a.imageSmoothingEnabled = true;
    a.drawImage(war, 0, 0, FW, FH, 0, 0, FW * FOG_U, FH * FOG_U);
  }
  const sil = holoSil();                       // the silhouettes in front don't glow
  if (sil) { a.setTransform(1, 0, 0, 1, 0, 0); a.globalCompositeOperation = 'destination-out'; a.drawImage(sil, 0, 0); }
  a.globalCompositeOperation = 'source-over';
  // blur (and brighten) at the small size, then lay it over the picture as light
  b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, w, h);
  b.filter = 'blur(' + (DEV.bloomBlur / (holoGrid.px * W.unitPx)).toFixed(2) + 'px) brightness(' + DEV.bloomBright + ')';   // the knob is css px
  b.drawImage(A, 0, 0);
  b.filter = 'none';
  G.ctx.save();
  // the number changing flashes the glow brighter for a moment
  let k = DEV.bloom * (1 + GLITCH_FLASH * holoGlitch(W));
  G.ctx.globalCompositeOperation = 'lighter';
  while (k > 0.001) { G.ctx.globalAlpha = Math.min(1, k); holoGrid.place(G.ctx, B, true); k -= 1; }
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
