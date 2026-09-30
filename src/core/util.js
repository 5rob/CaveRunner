// @ts-check
// Small maths and colour helpers with no game knowledge: angles, blends, hex colours,
// clamps, and rr (a rounded-rect path on a canvas).

export const HEX_RE = /^#[0-9a-f]{6}$/i;
// a to b by t, as '#rrggbb'
/** @param {string} a @param {string} b @param {number} t */
export function hexMix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), c = s => {
    const x = pa >> s & 255, y = pb >> s & 255; return Math.round(x + (y - x) * t);
  };
  return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
}
export const hexRgb = (/** @type {string} */ h) => { const n = parseInt(h.slice(1), 16); return (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255); };
export const hexArr = (/** @type {string} */ h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
// a colour turned round the colour wheel by `hue` degrees, its saturation and brightness
// (HSV value) scaled — what the master sliders do to every part at once
/** @param {string} hex @param {number} hue @param {number} sat @param {number} bri */
export function hsvAdjust(hex, hue, sat, bri) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
  let h = !d ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = ((h * 60 + hue) % 360 + 360) % 360;
  const S = Math.min(1, (mx ? d / mx : 0) * sat), V = Math.min(1, mx * bri);
  const c = V * S, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = V - c;
  const [R, G, B] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = q => Math.round((q + m) * 255);
  return '#' + ((1 << 24) | (to(R) << 16) | (to(G) << 8) | to(B)).toString(16).slice(1);
}

// a rounded rectangle path (no fill or stroke)
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} w @param {number} hh @param {number} r */
export function rr(ctx, x, y, w, hh, r) {
  const k = Math.min(r, w / 2, hh / 2);
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, hh, k);
  else {
    ctx.moveTo(x + k, y);
    ctx.arcTo(x + w, y, x + w, y + hh, k);
    ctx.arcTo(x + w, y + hh, x, y + hh, k);
    ctx.arcTo(x, y + hh, x, y, k);
    ctx.arcTo(x, y, x + w, y, k);
    ctx.closePath();
  }
}

// shortest signed angle from b to a
/** @param {number} a @param {number} b */
export function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
// swing a projectile's velocity without changing how fast it is going
/** @param {{ vx: number, vy: number }} b @param {number} by */
export function turn(b, by) {
  const sp = Math.hypot(b.vx, b.vy), a = Math.atan2(b.vy, b.vx) + by;
  b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
}

/** @type {(a: number[], b: number[], t: number) => number[]} */
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** @type {(v: number, t: number, a: number) => number} */
export const approach = (v, t, a) => (v < t ? Math.min(t, v + a) : Math.max(t, v - a));
/** @type {(v: number, a: number, b: number) => number} */
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// blend two "#rrggbb" colours; t=0 is a, t=1 is b. Used for the health ring, which
// slides from green at full down through amber to red as it empties.
/** @param {string} a @param {string} b @param {number} t */
export function mixHex(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round((pa >> 16 & 255) + ((pb >> 16 & 255) - (pa >> 16 & 255)) * t);
  const g = Math.round((pa >> 8 & 255) + ((pb >> 8 & 255) - (pa >> 8 & 255)) * t);
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
  return 'rgb(' + r + ',' + g + ',' + bl + ')';
}

// A countdown for a deadline: ms left -> "4d 23:59:59", or "OVERDUE" once it has passed
/** @param {number} ms */
export function countdown(ms) {
  if (ms <= 0) return 'OVERDUE';
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 86400) + 'd ' + pad2(Math.floor(s / 3600) % 24) + ':' + pad2(Math.floor(s / 60) % 60) + ':' + pad2(s % 60);
}
/** @param {number} n */
const pad2 = n => String(n).padStart(2, '0');
