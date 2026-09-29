// The jellyfish's plant glow, drawn by draw() after the fog (its scratch canvases are on G).

import { drawProp } from '../../art/props.js';
import { CELL, CH, CW } from '../../core/consts.js';
import { clamp, hexArr } from '../../core/util.js';
import { plantGlowFill } from '../../creatures/jelly.js';
import { jcol, kru } from '../../dev/knobs.js';
import { PLANTS } from '../../world/decorate.js';
import { seenAt } from './fog.js';

// The jellyfish's plant glow in the game (the comp is plantGlowFill): the art round a
// jelly — the rock with its baked moss over the decoration layer, and the hanging plants
// drawn over both at terrain resolution and read back — keyed, ramped, twinkled and
// added on top in its colour. Only on ground you've seen.
export function plantGlow(W, G, e, TH) {
  const u = e.je.u, reach = kru('jeGlowR', u.glowR) * kru('jePlantReach', u.plant);
  const strength = kru('jePlantGlow', u.plant);
  if (reach < 2 || strength <= 0) return;
  const bx0 = clamp(Math.floor((e.x - reach) / CELL), 0, CW - 1), by0 = clamp(Math.floor((e.y - reach) / CELL), 0, CH - 1);
  const bx1 = clamp(Math.ceil((e.x + reach) / CELL), 1, CW), by1 = clamp(Math.ceil((e.y + reach) / CELL), 1, CH);
  const w = bx1 - bx0, h = by1 - by0;
  if (w <= 0 || h <= 0) return;
  if (!G.pgArt || G.pgArt.length < w * h * 4) G.pgArt = new Uint8ClampedArray(w * h * 4);
  const x0w = bx0 * CELL, y0w = by0 * CELL, x1w = bx1 * CELL, y1w = by1 * CELL;
  // the hanging plants in reach, drawn at terrain resolution and read back
  let pd = null;
  const plants = W.props.filter(pr => pr.k === 'climb' && PLANTS[pr.st] &&
    pr.x + pr.r > x0w && pr.x + pr.l < x1w && pr.y + pr.b > y0w && pr.y + pr.t0 < y1w);
  if (plants.length) {
    if (!G.pgC) { G.pgC = document.createElement('canvas'); G.pgCtx = G.pgC.getContext('2d', { willReadFrequently: true }); }
    if (G.pgC.width < w || G.pgC.height < h) { G.pgC.width = Math.max(G.pgC.width, w); G.pgC.height = Math.max(G.pgC.height, h); }
    G.pgCtx.setTransform(1, 0, 0, 1, 0, 0); G.pgCtx.clearRect(0, 0, w, h);
    G.pgCtx.setTransform(1 / CELL, 0, 0, 1 / CELL, -bx0, -by0);
    for (const pr of plants) drawProp(G.pgCtx, pr, W.time, TH);
    pd = G.pgCtx.getImageData(0, 0, w, h).data;
  }
  // compose the art: rock over the decoration layer, the plants over both
  const T = W.img.data, D = W.dimg ? W.dimg.data : null, A = G.pgArt;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = ((by0 + y) * CW + bx0 + x) * 4, o = (y * w + x) * 4;
    let r = 0, g = 0, b = 0, a = 0;
    if (T[si + 3]) { r = T[si]; g = T[si + 1]; b = T[si + 2]; a = 255; }
    else if (D && D[si + 3]) { r = D[si]; g = D[si + 1]; b = D[si + 2]; a = D[si + 3]; }
    if (pd && pd[o + 3]) {
      const pa = pd[o + 3] / 255;
      if (a) { r += (pd[o] - r) * pa; g += (pd[o + 1] - g) * pa; b += (pd[o + 2] - b) * pa; a = Math.max(a, pd[o + 3]); }
      else { r = pd[o]; g = pd[o + 1]; b = pd[o + 2]; a = pd[o + 3]; }
    }
    A[o] = r; A[o + 1] = g; A[o + 2] = b; A[o + 3] = a;
  }
  const out = new ImageData(w, h);
  if (!plantGlowFill(out.data, A, w, h, { ox: x0w, oy: y0w, px: CELL, cx: e.x, cy: e.y, reach, white: W.plantW,
    top: kru('jePlantTop', u.plant) / 100, strength, t: W.time * kru('jePlantTwinkle', u.plant),
    size: kru('jePlantSize', u.plant), rgb: hexArr(jcol('jeColGlow', u.col)), lit: (x, y) => seenAt(W, x, y) })) return;
  if (G.pgGlow.width < w || G.pgGlow.height < h) { G.pgGlow.width = Math.max(G.pgGlow.width, w); G.pgGlow.height = Math.max(G.pgGlow.height, h); }
  G.pgGlowCtx.putImageData(out, 0, 0);
  const sm = G.ctx.imageSmoothingEnabled;
  G.ctx.imageSmoothingEnabled = true;
  G.ctx.drawImage(G.pgGlow, 0, 0, w, h, x0w, y0w, w * CELL, h * CELL);
  G.ctx.imageSmoothingEnabled = sm;
}
