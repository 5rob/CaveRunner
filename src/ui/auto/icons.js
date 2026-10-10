// @ts-check
// CaveRunner Auto's nav icons (owner, stage 8a: themed pixel art, not emoji; centred in their circle): small pixel
// maps drawn as SVG squares, and the player's helmet (art/sprites.js helmetIcon) on a canvas.

import { helmetIcon } from '../../art/sprites.js';
import { h, useEffect, useRef } from '../h.js';

// each icon: rows of characters, one per pixel ('.' empty), and the colour of each character
/** @type {Record<string, { px: string[], pal: Record<string, string> }>} */
export const NAV_ICONS = {
  guns: { px: [
    '............',
    '............',
    '..aaaaaaaaab',
    '.aacccaaaaab',
    '.aaaaaaaaa..',
    '.aaddaa.....',
    '.aad.e......',
    '.aad........',
    '.aa.........',
    '............',
  ], pal: { a: '#c8cfdb', b: '#ff8a1f', c: '#4fd2ff', d: '#7a8393', e: '#7a8393' } },
  exo: { px: [
    '....aaaa....',
    '...abbbba...',
    '..aabccbaa..',
    '..aabccbaa..',
    '..aaabbaaa..',
    '.daaaaaaaad.',
    '.daeeaafaad.',
    '.daaaaaaaad.',
    '..aaaggaaa..',
    '..aa....aa..',
    '..dd....dd..',
  ], pal: { a: '#eef1f6', b: '#d9a441', c: '#121a28', d: '#aab2c0', e: '#4fd2ff', f: '#ff5a4a', g: '#7a8393' } },
  perks: { px: [
    '.....a.....',
    '....aba....',
    '....aba....',
    'aaaaabaaaaa',
    '.abbbbbbba.',
    '..abbbbba..',
    '..abbabba..',
    '.abba.abba.',
    '.aba...aba.',
    '.a.......a.',
  ], pal: { a: '#ffb02e', b: '#ffe27a' } },
  stats: { px: [
    'a...........',
    'a.........b.',
    'a........bb.',
    'a...b...b...',
    'a..bcb.b....',
    'a.b...b.....',
    'ab..........',
    'a.c.c.c.c.c.',
    'aaaaaaaaaaaa',
  ], pal: { a: '#9a8ab8', b: '#5ee05a', c: '#ff4f5e' } },
  hp: { px: [
    '.aa...aa.',
    'abba.abba',
    'abbbabbbb',
    'abbbbbbba',
    '.abbbbba.',
    '..abbba..',
    '...aba...',
    '....a....',
  ], pal: { a: '#b8122e', b: '#ff4f5e' } },
  speed: { px: [
    '..aaa.......',
    '..aaa.......',
    '..aaa..b.b..',
    '..aaab..b.b.',
    '..aaaa.b.b..',
    '.aaaaaa.....',
    'cccccccc....',
  ], pal: { a: '#eef1f6', b: '#4fd2ff', c: '#7a8393' } },
  jet: { px: [
    '.aaaaaa.',
    'abbbbbba',
    'abccbbba',
    'abbbbbba',
    'abbbbbba',
    '.dd..dd.',
    '.ee..ee.',
    '.f....f.',
  ], pal: { a: '#7a8393', b: '#dde2ea', c: '#ff8a1f', d: '#5d6676', e: '#ff8a1f', f: '#ffd23a' } },
  carrot: { px: [
    '......bb.',
    '.....b.b.',
    '....aab..',
    '...aaa...',
    '..aaca...',
    '..aaa....',
    '.aca.....',
    '.aa......',
    'a........',
  ], pal: { a: '#ff8c2a', b: '#5ee05a', c: '#c25a10' } },
};

// a pixel in its group colour, as light or dark as its own colour was (so the art keeps its shading)
/** @param {string} tint #rrggbb @param {string} own #rrggbb */
export function tintShade(tint, own) {
  /** @param {string} x @param {number} i */
  const ch = (x, i) => parseInt(x.slice(1 + i * 2, 3 + i * 2), 16) || 0;
  const lum = (0.3 * ch(own, 0) + 0.59 * ch(own, 1) + 0.11 * ch(own, 2)) / 255, k = 0.35 + 0.9 * lum;
  const v = [0, 1, 2].map(i => Math.max(0, Math.min(255, Math.round(ch(tint, i) * k))));
  return 'rgb(' + v.join(',') + ')';
}

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
