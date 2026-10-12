// @ts-check
// CaveRunner Auto's nav icons (owner, stage 8a: themed pixel art, not emoji; centred in their circle): small pixel
// maps drawn as SVG squares, and the player's helmet (art/sprites.js helmetIcon) on a canvas.

import { helmetIcon } from '../../art/sprites.js';
import { h, useEffect, useRef } from '../h.js';

import { NAV_ICONS, tintShade } from '../../art/itemicon.js';
import { drawTarget } from '../../art/discrimicon.js';
export { NAV_ICONS, tintShade };

// one icon as SVG squares, centred in its box (it keeps its shape: width over height)
/** @param {{ id: string, size?: number | string, tint?: string }} props a size in px, or a share of its box ('64%');
 * tint: every pixel in that one colour (its group's: the exo machine's teal, owner) */
export function PixIcon({ id, size = 26, tint }) {
  const ic = NAV_ICONS[id];
  if (!ic) return null;
  const w = Math.max(...ic.px.map(r => r.length)), ht = ic.px.length, rects = [];
  for (let y = 0; y < ht; y++) {
    for (let x = 0; x < ic.px[y].length; x++) {
      const c = ic.px[y][x];
      if (c !== '.' && ic.pal[c]) rects.push(h('rect', { key: x + ',' + y, x, y, width: 1.02, height: 1.02, fill: tint ? tintShade(tint, ic.pal[c]) : ic.pal[c] }));
    }
  }
  return h('svg', { className: 'apix', viewBox: '0 0 ' + w + ' ' + ht, width: size, height: size, shapeRendering: 'crispEdges' }, rects);
}

// a player's helmet (the sprite the scene draws), its stripe in the player's colour
/** @param {{ col: string, size?: number }} props */
export function HelmetIcon({ col, size = 38 }) {
  /** @type {{ current: HTMLCanvasElement | null }} */
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.round(size * dpr); c.height = Math.round(size * dpr);
    const ctx = c.getContext('2d');
    if (ctx) helmetIcon(ctx, c.width, col);
  }, [col, size]);
  return h('canvas', { ref, className: 'ahelm', style: { width: size + 'px', height: size + 'px' } });
}

// a text glyph (a mod's, a perk's), owner: centred by its ink (each font puts a symbol at its own height), scaled up to
// fill its tile inside a padding (.apixg in style.css), and in the game's pixel look: drawn on a GLYPH_PX-pixel grid,
// each pixel solid or clear, shown crisp (image-rendering: pixelated), no glow (owner)
export const GLYPH_PX = 18;
const GLYPH_BIG = 160;
/** @type {CanvasRenderingContext2D | null} */
let BIG = null;
// the shared big canvas a glyph is measured on
const glyphBig = () => {
  if (!BIG) { const c = document.createElement('canvas'); c.width = GLYPH_BIG; c.height = GLYPH_BIG; BIG = c.getContext('2d', { willReadFrequently: true }); }
  return BIG;
};
/** @param {{ glyph: string, col: string }} props */
export function GlyphIcon({ glyph, col }) {
  /** @type {{ current: HTMLCanvasElement | null }} */
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const N = GLYPH_PX;
    c.width = N; c.height = N;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, N, N);
    // its real ink (font metrics lie for some symbols): drawn big, its painted pixels found, then that box scaled to
    // fill the grid, centred
    const B = GLYPH_BIG, big = glyphBig();
    if (!big) return;
    big.clearRect(0, 0, B, B);
    big.font = '900 ' + Math.round(B * 0.6) + 'px system-ui, sans-serif';
    big.textAlign = 'center'; big.textBaseline = 'middle'; big.fillStyle = col;
    big.fillText(glyph, B / 2, B / 2);
    const px = big.getImageData(0, 0, B, B).data;
    let x0 = B, y0 = B, x1 = -1, y1 = -1;
    for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) {
      if (px[(y * B + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return;
    const w = x1 - x0 + 1, ht = y1 - y0 + 1, k = N / Math.max(w, ht);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(big.canvas, x0, y0, w, ht, (N - w * k) / 2, (N - ht * k) / 2, w * k, ht * k);
    // the pixel look: each pixel solid or clear, full colour
    const im = ctx.getImageData(0, 0, N, N), d = im.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 100 ? 255 : 0;
    ctx.putImageData(im, 0, 0);
  }, [glyph, col]);
  return h('canvas', { ref, className: 'apixg' });
}

// a Discriminate target's picture (art/discrimicon.js drawTarget: the creature's own sprite, the nugget, the crystal), size px
/** @param {{ t: DiscrimTarget, size?: number, className?: string }} props */
export function TargetPic({ t, size = 40, className }) {
  /** @type {{ current: HTMLCanvasElement | null }} */
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, ctx = c && c.getContext('2d');
    if (!c || !ctx) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = c.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size, size);
    drawTarget(ctx, t, size);
  }, [t.kind, t.id, size]);
  return h('canvas', { ref, className: className || 'atgt', style: { width: size + 'px', height: size + 'px' } });
}
