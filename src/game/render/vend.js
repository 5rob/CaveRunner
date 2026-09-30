// @ts-check
// The level vending machines (game/systems/vend.js): two tall tech cabinets on the shop's back
// wall, each with a holographic screen stacked like the background hologram (a solid box with
// the words cut out of it over an outlined one), green, or red while the level can't be sold.
// A screen goes dark when its machine has nothing to offer, except that once the level is bought
// the buy machine counts down the debt's repayment deadline in red (real time, the device clock). And the teleport: the flash over the
// shop, the sweep and the crackle (drawWarp, after the fog).

import { countdown } from '../../core/util.js';
import { CELL, LVL_BUY, LVL_SELL, SHOP_FLOOR, VEND_BUY_X, VEND_SELL_X } from '../../core/consts.js';
import { canSell, ROOF_Y, VEND_H, VEND_TOP, VEND_W, WARP_SWAP } from '../systems/vend.js';
import { drawBolt } from './looks.js';

export const HOLO_GREEN = '#00ff3c', HOLO_RED = '#ff0000';   // the background hologram's two hues

// the screen, in world units: its width, the solid box, the gap, the outlined box
const SW = 72, TOP_H = 26, GAP = 2, BOT_H = 32, SH = TOP_H + GAP + BOT_H;
const PAD = 4, LINE = 1.2, GLOW = 6, RES = 4;

// a steady pseudo-random 0..1 for n (draw() mustn't touch Math.random: it's the simulation's)
/** @param {number} n */
const hash = n => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };

// 64000000000 -> "64,000,000,000"
/** @param {number} n */
const commas = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** @type {Map<string, HTMLCanvasElement>} */
const cache = new Map();

// One screen, with its glow baked round it (GLOW each side): the top lines cut out of a solid
// box, the bottom ones drawn inside an outlined box, each line fitted to the width, and fine
// scan lines through it all
/** @param {string[]} top @param {string[]} bot @param {string} hue */
function screen(top, bot, hue) {
  const key = top.join('|') + '/' + bot.join('|') + hue;
  const got = cache.get(key);
  if (got) return got;
  if (cache.size > 12) cache.clear();       // the countdown makes a new screen every second
  const w = (SW + GLOW * 2) * RES, h = (SH + GLOW * 2) * RES;
  const A = document.createElement('canvas'); A.width = w; A.height = h;
  const t = A.getContext('2d');
  const B = document.createElement('canvas'); B.width = w; B.height = h;
  const b = B.getContext('2d');
  if (!t || !b) return B;
  t.scale(RES, RES); t.translate(GLOW, GLOW);
  t.fillStyle = hue; t.fillRect(0, 0, SW, TOP_H);
  t.strokeStyle = hue; t.lineWidth = LINE;
  t.strokeRect(LINE / 2, TOP_H + GAP + LINE / 2, SW - LINE, BOT_H - LINE);
  /** @param {CanvasRenderingContext2D} t @param {string[]} lines @param {number} y0 @param {number} hh @param {string} weight @param {boolean} cut */
  const stack = (t, lines, y0, hh, weight, cut) => {
    const lh = (hh - PAD * 2) / lines.length;
    let fs = lh * 0.9;
    t.font = weight + ' ' + fs + 'px system-ui, sans-serif';
    const wide = Math.max(...lines.map(s => t.measureText(s).width));
    if (wide > SW - PAD * 2) fs *= (SW - PAD * 2) / wide;
    t.font = weight + ' ' + fs + 'px system-ui, sans-serif';
    t.globalCompositeOperation = cut ? 'destination-out' : 'source-over';
    t.fillStyle = cut ? '#000' : hue; t.textBaseline = 'middle'; t.textAlign = 'left';
    lines.forEach((s, i) => t.fillText(s, PAD, y0 + PAD + lh * (i + 0.5)));
  };
  stack(t, top, 0, TOP_H, '900', true);
  stack(t, bot, TOP_H + GAP, BOT_H, '700', false);
  t.globalCompositeOperation = 'destination-out'; t.fillStyle = 'rgba(0,0,0,0.3)';
  for (let y = 0; y < SH; y += 1.5) t.fillRect(0, y, SW, 0.5);
  b.shadowColor = hue; b.shadowBlur = GLOW * RES * 0.7;
  b.drawImage(A, 0, 0);
  b.shadowBlur = 0;
  b.drawImage(A, 0, 0);
  // the glow filled the cut-out words back in: cut them again so they're clean holes
  b.scale(RES, RES); b.translate(GLOW, GLOW);
  stack(b, top, 0, TOP_H, '900', true);
  cache.set(key, B);
  return B;
}

// when each screen last went on or off, to animate the change
/** @type {Record<string, { on: boolean | null, t: number }>} */
const V = { buy: { on: null, t: -99 }, sell: { on: null, t: -99 } };

// One machine: the cabinet, and its screen on (flickering in), going off (a CRT squeeze), or dark
/** @param {CanvasRenderingContext2D} ctx @param {World} W @param {'buy' | 'sell'} kind @param {number} cx @param {boolean} on @param {string} hue @param {string[]} top @param {string[]} bot */
function machine(ctx, W, kind, cx, on, hue, top, bot) {
  const s = V[kind];
  if (s.on !== on || s.t > W.time) { s.t = s.on === null || s.t > W.time ? -99 : W.time; s.on = on; }
  const since = W.time - s.t;
  const x = cx - VEND_W / 2, y = VEND_TOP, fy = SHOP_FLOOR * CELL;
  // the cabinet: body, pillars, cap and foot
  ctx.fillStyle = '#171a21'; ctx.fillRect(x, y, VEND_W, VEND_H);
  ctx.fillStyle = '#252a35'; ctx.fillRect(x, y, 6, VEND_H); ctx.fillRect(x + VEND_W - 6, y, 6, VEND_H);
  ctx.fillStyle = '#323948'; ctx.fillRect(x - 2, y - 1, VEND_W + 4, 5); ctx.fillRect(x - 3, fy - 5, VEND_W + 6, 5);
  ctx.fillStyle = '#0c0e12'; ctx.fillRect(x + 1, y + 4, 4, VEND_H - 9); ctx.fillRect(x + VEND_W - 5, y + 4, 4, VEND_H - 9);
  // neon edge strips, and the lights on the cap
  ctx.fillStyle = hue;
  ctx.globalAlpha = on ? 0.55 + 0.2 * Math.sin(W.time * 3 + cx) : 0.12;
  ctx.fillRect(x + 6, y + 6, 1, VEND_H - 14); ctx.fillRect(x + VEND_W - 7, y + 6, 1, VEND_H - 14);
  for (let i = 0; i < 5; i++) {
    ctx.globalAlpha = on ? (hash(Math.floor(W.time * 3) + i * 7 + cx) < 0.6 ? 0.9 : 0.25) : 0.1;
    ctx.fillRect(x + 10 + i * 4, y + 1, 2, 1.5);
  }
  ctx.globalAlpha = 1;
  // the screen's dark glass
  const gx = x + 8, gy = y + 7, gw = VEND_W - 16, gh = SH - 2;
  ctx.fillStyle = '#05070a'; ctx.fillRect(gx, gy, gw, gh);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath(); ctx.moveTo(gx + gw * 0.55, gy); ctx.lineTo(gx + gw, gy); ctx.lineTo(gx + gw, gy + gh * 0.35); ctx.closePath(); ctx.fill();
  // under it: the emitter bar, the card slot and the keypad
  const py = gy + gh + 3;
  ctx.fillStyle = '#2a303c'; ctx.fillRect(x + 10, py, VEND_W - 20, 2);
  ctx.fillStyle = hue; ctx.globalAlpha = on ? 0.9 : 0.15;
  ctx.fillRect(x + 12, py + 0.5, VEND_W - 24, 1);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0a0c10'; ctx.fillRect(x + 12, py + 6, 16, 3);
  ctx.fillStyle = hue; ctx.globalAlpha = on ? 0.7 : 0.1; ctx.fillRect(x + 13, py + 7, 14, 1);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
    ctx.globalAlpha = on && hash(Math.floor(W.time * 2) * 5 + r * 4 + c + cx) < 0.3 ? 0.9 : on ? 0.3 : 0.08;
    ctx.fillRect(x + 34 + c * 4, py + 5 + r * 3.5, 2.5, 2.5);
  }
  ctx.globalAlpha = 1;
  // the hologram: a faint beam up from the emitter, then the screen floating in front of the glass
  const sx = cx - SW / 2, sy = y + 6;
  let alpha = 0, squeeze = 1;
  if (on) alpha = since < 0.4 ? (hash(Math.floor(since * 40)) < since / 0.4 ? 1 : 0.15) : 0.88 + 0.1 * hash(Math.floor(W.time * 20) + cx);
  else if (since < 0.25) { alpha = 1; squeeze = Math.max(0.02, 1 - since / 0.2); }
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha * 0.12 * squeeze;
  ctx.fillStyle = hue;
  ctx.beginPath(); ctx.moveTo(x + 14, py); ctx.lineTo(x + VEND_W - 14, py); ctx.lineTo(sx + SW, sy + SH); ctx.lineTo(sx, sy + SH); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = alpha;
  const img = screen(top, bot, hue), mid = sy + SH / 2;
  ctx.translate(0, mid); ctx.scale(1, squeeze); ctx.translate(0, -mid);
  ctx.drawImage(img, sx - GLOW, sy - GLOW, SW + GLOW * 2, SH + GLOW * 2);
  // a band of brighter light rolling down it
  const band = sy + ((W.time * 18 + cx) % (SH + 20)) - 10;
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * 0.18; ctx.fillStyle = hue;
  ctx.fillRect(sx, Math.max(sy, band), SW, Math.max(0, Math.min(6, sy + SH - band)));
  ctx.restore();
  if (!on) {                                   // going off: the line it squeezes down to, flaring white
    ctx.globalAlpha = Math.max(0, 1 - since / 0.25); ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx - 4, mid - 0.6, SW + 8, 1.2);
    ctx.globalAlpha = 1;
  }
}

// The two machines, drawn with the shop's stock (before the fog)
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawVend(W, G, F) {
  if (VEND_TOP > W.camY + F.vh + 10 || VEND_TOP + VEND_H < W.camY - 10) return;
  const lv = 'LVL ' + W.floor, busy = !!W.warp, due = G.input.current.loadout.due || 0;
  if (W.hasLvl && due) machine(G.ctx, W, 'buy', VEND_BUY_X, !busy, HOLO_RED,
    [countdown(due - Date.now())], ['debt repayment', 'deadline', lv]);
  else machine(G.ctx, W, 'buy', VEND_BUY_X, !W.hasLvl && !busy, HOLO_GREEN,
    ['BUY', lv], [commas(LVL_BUY) + ' G.', '(credit', 'available)']);
  machine(G.ctx, W, 'sell', VEND_SELL_X, W.hasLvl && !busy, canSell(W) ? HOLO_GREEN : HOLO_RED,
    ['SELL', lv], [commas(LVL_SELL) + ' G.', '(no biological', 'entities accepted)']);
}

// The teleport over the shop (after the fog, so it shows over the dark): a glow building along the
// roof, then the flash over everything above it, a bright line sweeping up (arriving) or down
// (going), and the bolts crackling up from the roof
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawWarp(W, G, F) {
  const w = W.warp;
  if (!w) return;
  const ctx = G.ctx, since = w.t - WARP_SWAP;
  const x0 = W.camX - 10, x1 = W.camX + F.vw + 10, top = W.camY - 10, bot = ROOF_Y + 12;
  if (top >= bot) return;
  ctx.save();
  if (since < 0) {
    const k = Math.max(0, 1 + since / 0.4);
    const g = ctx.createLinearGradient(0, ROOF_Y, 0, ROOF_Y - 40);
    g.addColorStop(0, 'rgba(150,255,190,' + (0.6 * k * k).toFixed(3) + ')'); g.addColorStop(1, 'rgba(150,255,190,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g; ctx.fillRect(x0, ROOF_Y - 40, x1 - x0, 40);
  } else {
    const a = Math.exp(-since * 2.6);
    const g = ctx.createLinearGradient(0, bot, 0, top);
    g.addColorStop(0, 'rgba(240,255,244,' + a.toFixed(3) + ')');
    g.addColorStop(1, 'rgba(160,255,200,' + (a * 0.5).toFixed(3) + ')');
    ctx.fillStyle = g; ctx.fillRect(x0, top, x1 - x0, bot - top);
    if (since < 0.9) {
      const k = since / 0.9, span = ROOF_Y - top;
      const y = w.dir === 'in' ? ROOF_Y - k * span : top + k * span;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(110,255,160,' + (0.35 * (1 - k)).toFixed(3) + ')'; ctx.fillRect(x0, y - 8, x1 - x0, 16);
      ctx.fillStyle = 'rgba(220,255,230,' + (0.9 * (1 - k)).toFixed(3) + ')'; ctx.fillRect(x0, y - 1.2, x1 - x0, 2.4);
    }
  }
  ctx.restore();
  for (const b of w.bolts) drawBolt(G, b.pts, '#7dffb0', 1.3, 1 - b.t / b.max);
}
