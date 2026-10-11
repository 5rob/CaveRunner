// @ts-check
// CaveRunner Auto's pixel icons, shared by the screen (ui/auto/icons.js: SVG and canvas) and the play area's canvas
// (auto/itemtile.js: a pickup drawn as its bag tile). Moved here from ui/auto/icons.js (layer 4: the scene's painter
// may use it). glyphCanvas: a text glyph on its GLYPH_PX grid, the screen's GlyphIcon's rule, cached

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


// a text glyph (a mod's, a perk's) on the screen's GLYPH_PX grid, the screen's rule (ui/auto/icons.js GlyphIcon): drawn
// big, its real ink found, that box scaled to fill the grid, centred, each pixel solid or clear. Cached per glyph and colour
export const ICON_PX = 18;
/** @type {Map<string, HTMLCanvasElement | null>} */
const GLYPHS = new Map();
/** @type {CanvasRenderingContext2D | null} */
let BIG = null;
/** @param {string} glyph @param {string} col @returns {HTMLCanvasElement | null} */
export function glyphCanvas(glyph, col) {
  const key = glyph + '|' + col;
  if (GLYPHS.has(key)) return GLYPHS.get(key) || null;
  const N = ICON_PX, B = 160;
  if (!BIG) { const b = document.createElement('canvas'); b.width = B; b.height = B; BIG = b.getContext('2d', { willReadFrequently: true }); }
  const c = document.createElement('canvas');
  c.width = N; c.height = N;
  const ctx = c.getContext('2d', { willReadFrequently: true }), big = BIG;
  if (!ctx || !big) return null;
  big.clearRect(0, 0, B, B);
  big.font = '900 ' + Math.round(B * 0.6) + 'px system-ui, sans-serif';
  big.textAlign = 'center'; big.textBaseline = 'middle'; big.fillStyle = col;
  big.fillText(glyph, B / 2, B / 2);
  const px = big.getImageData(0, 0, B, B).data;
  let x0 = B, y0 = B, x1 = -1, y1 = -1;
  for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) {
    if (px[(y * B + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 >= 0) {
    const w = x1 - x0 + 1, ht = y1 - y0 + 1, k = N / Math.max(w, ht);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(big.canvas, x0, y0, w, ht, (N - w * k) / 2, (N - ht * k) / 2, w * k, ht * k);
    const im = ctx.getImageData(0, 0, N, N), d = im.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 100 ? 255 : 0;
    ctx.putImageData(im, 0, 0);
  }
  GLYPHS.set(key, c);
  return c;
}

// a NAV_ICONS pixel map on a square canvas (1 px a pixel, centred), every pixel in tint's shade when given. Cached
/** @type {Map<string, HTMLCanvasElement | null>} */
const PIXS = new Map();
/** @param {string} id @param {string} [tint] @returns {HTMLCanvasElement | null} */
export function pixCanvas(id, tint) {
  const key = id + '|' + (tint || '');
  if (PIXS.has(key)) return PIXS.get(key) || null;
  const ic = NAV_ICONS[id];
  if (!ic) { PIXS.set(key, null); return null; }
  const w = Math.max(...ic.px.map(r => r.length)), ht = ic.px.length, n = Math.max(w, ht);
  const c = document.createElement('canvas');
  c.width = n; c.height = n;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  for (let y = 0; y < ht; y++) for (let x = 0; x < ic.px[y].length; x++) {
    const k = ic.px[y][x];
    if (k === '.' || !ic.pal[k]) continue;
    ctx.fillStyle = tint ? tintShade(tint, ic.pal[k]) : ic.pal[k];
    ctx.fillRect(x + Math.floor((n - w) / 2), y + Math.floor((n - ht) / 2), 1, 1);
  }
  PIXS.set(key, c);
  return c;
}
