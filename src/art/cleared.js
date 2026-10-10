// @ts-check
// CaveRunner Auto's LEVEL CLEARED (AUTOBATTLER.md stage 7): the title's letters (titlescene.js titleLetter: the
// extrusion, the hot gradient, the glow, the shine) dropping in one by one from above, bouncing as they land, a burst
// of sparks at each landing, then a shine sweeping across, the title's bob, and a fade at the end. Pure timing
// (clearedLand: auto/level.js plays a sound at each landing) and a painter over the play area (ui/auto/AutoScreen.js).

import { pixWidth } from './pixfont.js';
import { titleLetter } from './titlescene.js';

export const CLEARED_LINES = ['LEVEL', 'CLEARED'];
export const CLEARED_N = CLEARED_LINES.join('').length;
const STAGGER = 0.09;       // one letter starts falling this long after the one before (s)
const FALL = 0.42;          // a letter's drop with its bounces (s)
const SPARK_T = 0.55;       // a landing's sparks live this long (s)
const SHINE_T = 0.7;        // the shine's sweep across (s)
const FADE = 0.5;           // the fade at the end (s)

// when letter i (0 … CLEARED_N - 1, reading order) first touches down, s after the start
/** @param {number} i */
export const clearedLand = i => i * STAGGER + FALL * 0.55;
// when the shine sweeps (s after the start): once the last letter has settled
export const clearedShine = () => (CLEARED_N - 1) * STAGGER + FALL + 0.1;

// the drop: 1 (high above) → 0 (landed) with two bounces (an ease-out bounce), u the drop's share done (0-1)
/** @param {number} u */
function dropAt(u) {
  if (u <= 0) return 1;
  if (u >= 1) return 0;
  const b = u < 0.55 ? (u / 0.55) ** 2 : u < 0.82 ? 1 - 0.18 * Math.sin(Math.PI * (u - 0.55) / 0.27) : 1 - 0.05 * Math.sin(Math.PI * (u - 0.82) / 0.18);
  return 1 - b;
}
// a fixed hash in [0, 1) (the sparks' directions: the same every frame)
/** @param {number} n */
const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

// Paints the words over a cw × hh area (css px), a s into the show, which lasts dur s; top: the first line's top
/** @param {CanvasRenderingContext2D} ctx @param {number} a @param {number} dur @param {number} cw @param {number} top */
export function clearedText(ctx, a, dur, cw, top) {
  if (a < 0 || a > dur) return;
  const px = Math.max(3, Math.floor(Math.min(cw * 0.86 / pixWidth('CLEARED', 1, 1), 13)));
  const fade = Math.max(0, Math.min(1, (dur - a) / FADE));
  ctx.save();
  ctx.globalAlpha = fade;
  const shine = (a - clearedShine()) / SHINE_T * 1.6 - 0.3;
  let y = top + 7 * px, n = 0;
  /** @type {{ x: number, y: number, t: number, n: number }[]} */
  const lands = [];
  for (const s of CLEARED_LINES) {
    let x = (cw - pixWidth(s, px, 1)) / 2;
    for (const c of s) {
      const u = (a - n * STAGGER) / FALL;
      if (u > 0) {
        const settle = Math.max(0, a - clearedShine());
        const bob = Math.sin(settle * 3.2 + n * 0.7) * px * 0.45 * Math.min(1, settle * 2);
        const cy = y - dropAt(u) * (y + px * 4) + bob;
        const lx = (x + pixWidth(c, px, 1) / 2) / cw;
        titleLetter(ctx, c, x, cy, px, 1 - Math.abs(lx - shine) * 5);
        const lt = a - clearedLand(n);
        if (lt >= 0 && lt < SPARK_T) lands.push({ x: x + pixWidth(c, px, 1) / 2, y, t: lt, n });
      }
      x += pixWidth(c, px, 1) + px;
      n++;
    }
    y += 7 * px + Math.ceil(px * 2.2);
  }
  // the sparks: each landing throws a fan of hot bits out of the letter's feet, falling and fading
  ctx.globalCompositeOperation = 'lighter';
  for (const L of lands) {
    const k = L.t / SPARK_T;
    for (let j = 0; j < 12; j++) {
      const h1 = hash(L.n * 31 + j), h2 = hash(L.n * 57 + j * 3 + 1);
      const ang = Math.PI + h1 * Math.PI, sp = px * (5 + h2 * 9);
      const sx = L.x + Math.cos(ang) * sp * L.t * 2.2, sy = L.y + Math.sin(ang) * sp * L.t * 2.2 + px * 30 * L.t * L.t;
      const r = Math.max(1, px * 0.35 * (1 - k));
      ctx.fillStyle = j % 3 ? 'rgba(255,190,70,' + (1 - k).toFixed(3) + ')' : 'rgba(255,250,215,' + (1 - k).toFixed(3) + ')';
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    // a flash ring at the touch-down
    if (L.t < 0.18) {
      ctx.strokeStyle = 'rgba(255,220,140,' + (1 - L.t / 0.18).toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, px * 0.4);
      ctx.beginPath(); ctx.ellipse(L.x, L.y, px * (1 + L.t * 30), px * (0.3 + L.t * 8), 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
}
