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

// one icon as SVG squares, centred in its box (it keeps its shape: width over height)
/** @param {{ id: string, size?: number }} props */
export function PixIcon({ id, size = 26 }) {
  const ic = NAV_ICONS[id];
  if (!ic) return null;
  const w = Math.max(...ic.px.map(r => r.length)), ht = ic.px.length, rects = [];
  for (let y = 0; y < ht; y++) {
    for (let x = 0; x < ic.px[y].length; x++) {
      const c = ic.px[y][x];
      if (c !== '.' && ic.pal[c]) rects.push(h('rect', { key: x + ',' + y, x, y, width: 1.02, height: 1.02, fill: ic.pal[c] }));
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

// a text glyph (a mod's, a perk's) centred by its ink, not its font box (owner: the mods' symbols sat off-centre:
// each font puts them at its own height), in its colour with a soft glow
/** @param {{ glyph: string, col: string, size?: number }} props */
export function GlyphIcon({ glyph, col, size = 30 }) {
  /** @type {{ current: HTMLCanvasElement | null }} */
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1), W = Math.round(size * dpr);
    c.width = W; c.height = W;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, W);
    ctx.font = '900 ' + Math.round(W * 0.66) + 'px system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const m = ctx.measureText(glyph), l = m.actualBoundingBoxLeft || 0, r = m.actualBoundingBoxRight || m.width;
    const up = m.actualBoundingBoxAscent || W * 0.5, dn = m.actualBoundingBoxDescent || 0;
    ctx.shadowColor = col; ctx.shadowBlur = 6 * dpr;
    ctx.fillStyle = col;
    ctx.fillText(glyph, W / 2 - (r - l) / 2 + l, W / 2 + (up - dn) / 2);
  }, [glyph, col, size]);
  return h('canvas', { ref, className: 'apix', style: { width: size + 'px', height: size + 'px' } });
}
