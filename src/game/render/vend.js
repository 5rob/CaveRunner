// @ts-check
// The level vending machines (game/systems/vend.js): two tall tech cabinets on the shop's back
// wall, each with a holographic screen stacked like the background hologram (a solid box with
// the words cut out of it over an outlined one), green, or red while the level can't be sold.
// A screen goes dark when its machine has nothing to offer, except that the sell machine is always lit:
// green with no level ("SELL lvl 01", its price, no fine print), and SELL_WAIT after a level is bought it glitches (SELL_GLITCH) over
// to the level's screen, red with "no biological entities accepted" (sellScreen). Once the level is bought
// the buy machine counts down the debt's repayment deadline in red (real time, the device clock). And the teleport: the flash over the
// shop, the sweep and the crackle (drawWarp, after the fog).

import { countdown } from '../../core/util.js';
import { CELL, SHOP_FLOOR, SHOP_Y, VEND_BUY_X, VEND_SELL_X } from '../../core/consts.js';
import { lvlBuy, lvlSell } from '../../data/levels.js';
import { pixText, pixWidth } from '../../art/pixfont.js';
import { drawHoloShop } from './holo.js';
import { canSell, REPO_ALARM, REPO_FIRE, REPO_JET, ROOF_Y, VEND_H, VEND_TOP, VEND_W, WARP_SWAP } from '../systems/vend.js';
import { drawBolt } from './looks.js';

export const HOLO_GREEN = '#00ff3c', HOLO_RED = '#ff0000';   // the background hologram's two hues

// the screen, in world units: its width, the solid box, the gap, the outlined box
const SW = 72, TOP_H = 26, GAP = 2, BOT_H = 32, SH = TOP_H + GAP + BOT_H;
const PAD = 4, LINE = 1.2, GLOW = 6, RES = 4;
const TALL = 1.3;                 // the terminal font's pixels: this much taller than wide

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
// scan lines through it all, in the blocky terminal font (art/pixfont.js). A deal screen (look.deal:
// the machines' offer) lays it out instead as "BUY lvl 01" on one line (the verb and number big,
// "lvl" small and leaning, tucked up to the number), and under it the price in bold with any fine
// print (bot's other lines) small below
/** @param {VendLook} look */
function screen(look) {
  const { top, bot, hue, deal } = look;
  const key = (deal ? 'D' + deal : '') + top.join('|') + '/' + bot.join('|') + hue;
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
  /** @param {CanvasRenderingContext2D} t @param {boolean} cut */
  const ink = (t, cut) => { t.globalCompositeOperation = cut ? 'destination-out' : 'source-over'; t.fillStyle = cut ? '#000' : hue; };
  /** @param {CanvasRenderingContext2D} t @param {string[]} lines @param {number} y0 @param {number} hh @param {number} bold @param {boolean} cut */
  const stack = (t, lines, y0, hh, bold, cut) => {
    const lh = (hh - PAD * 2) / lines.length;
    const wide = Math.max(...lines.map(s => pixWidth(s, 1, bold)));
    const px = Math.min(lh / 9 / TALL, (SW - PAD * 2) / wide), ph = px * TALL;
    ink(t, cut);
    lines.forEach((s, i) => pixText(t, s, PAD, y0 + PAD + lh * (i + 0.5) + 3.5 * ph, px, ph, bold, RES));
  };
  /** @param {CanvasRenderingContext2D} t */
  const dealTop = t => {
    const B = 0.6, sm = 0.5, g1 = 2.2, g2 = 2;          // bold, "lvl"'s size, the gaps either side of it (big pixels)
    // both machines alike: the verb's room is the longer verb's, the number's two digits
    const wv = Math.max(pixWidth('SELL', 1, B), pixWidth(top[0], 1, B)), wn = pixWidth(top[1], 1, B), wl = pixWidth('lvl', 1, 0.5) * sm;
    const px = Math.min((TOP_H - PAD * 2) / 7 / TALL, (SW - PAD * 2) / (wv + g1 + wl + g2 + wn)), ph = px * TALL;
    const y = TOP_H / 2 + 3.5 * ph;
    ink(t, true);
    pixText(t, top[0], PAD, y, px, ph, B, RES);
    pixText(t, top[1], PAD + (wv + g1 + wl + g2) * px, y, px, ph, B, RES);
    t.save(); t.translate(PAD + (wv + g1) * px, y); t.transform(1, 0, -0.22, 1, 0, 0);   // "lvl" leans
    pixText(t, 'lvl', 0, 0, px * sm, ph * sm, 0.5, RES);
    t.restore();
  };
  /** @param {CanvasRenderingContext2D} t */
  const dealBot = t => {
    const y0 = TOP_H + GAP + PAD, B = 0.6;
    const px = Math.min(1, (SW - PAD * 2) / pixWidth(typeof deal === 'string' ? deal : bot[0], 1, B)), ph = px * TALL, fx = 0.4, fh = fx * TALL;
    ink(t, false);
    const base = y0 + 7 * ph;
    pixText(t, bot[0], PAD, base, px, ph, B, RES);
    bot.slice(1).forEach((line, i) => pixText(t, line, PAD, base + 3 + 7 * fh + i * 10 * fh, fx, fh, 0.4, RES));
  };
  if (deal) { dealTop(t); dealBot(t); }
  else { stack(t, top, 0, TOP_H, 0.6, true); stack(t, bot, TOP_H + GAP, BOT_H, 0.5, false); }
  t.globalCompositeOperation = 'destination-out'; t.fillStyle = 'rgba(0,0,0,0.3)';
  for (let y = 0; y < SH; y += 1.5) t.fillRect(0, y, SW, 0.5);
  b.shadowColor = hue; b.shadowBlur = GLOW * RES * 0.7;
  b.drawImage(A, 0, 0);
  b.shadowBlur = 0;
  b.drawImage(A, 0, 0);
  // the glow filled the cut-out words back in: cut them again so they're clean holes
  b.scale(RES, RES); b.translate(GLOW, GLOW);
  if (deal) dealTop(b); else stack(b, top, 0, TOP_H, 0.6, true);
  cache.set(key, B);
  return B;
}

// when each screen last went on or off, to animate the change
/** @type {Record<string, { on: boolean | null, t: number }>} */
const V = { buy: { on: null, t: -99 }, sell: { on: null, t: -99 } };

// The sell machine's screen with no level, and the change to the level's screen once one is bought:
// it holds SELL_WAIT seconds, then glitches over SELL_GLITCH seconds (and back the same way once sold)
export const SELL_WAIT = 0.5, SELL_GLITCH = 0.5;
/** @type {{ lvl: boolean | null, t: number, from: VendLook | null, shown: VendLook | null }} */
const SL = { lvl: null, t: -99, from: null, shown: null };

// a machine's offer: "BUY lvl 01" over the price, and the fine print
/** @param {string} verb @param {number} floor @param {number} price @param {string} hue @param {string[]} fine @returns {VendLook} */
// (the price is sized to fit the sell price, the longer, so both machines' prices are the same size)
const deal = (verb, floor, price, hue, fine) =>
  ({ hue, deal: commas(lvlSell(floor)) + ' G.', top: [verb, String(floor).padStart(2, '0')], bot: [commas(price) + ' G.', ...fine] });

// what the sell machine shows this frame: its look, and while it changes over, the old one (from)
// with how far through the glitch it is (k, 0..1)
/** @param {World} W @returns {VendLook & { from: VendLook | null, k: number }} */
export function sellScreen(W) {
  const lvl = W.hasLvl, look = lvl
    ? deal('SELL', W.floor, lvlSell(W.floor), canSell(W) ? HOLO_GREEN : HOLO_RED, ['*no biological', 'entities accepted'])
    : deal('SELL', W.floor, lvlSell(W.floor), HOLO_GREEN, []);
  if (SL.lvl === null || SL.t > W.time) { SL.lvl = lvl; SL.t = -99; }   // the first frame, or a replay: no change shown
  if (SL.lvl !== lvl) { SL.from = SL.shown || look; SL.lvl = lvl; SL.t = W.time; }
  const since = W.time - SL.t;
  if (since < SELL_WAIT && SL.from) return { ...SL.from, from: null, k: 0 };
  if (since < SELL_WAIT + SELL_GLITCH) return { ...look, from: SL.from, k: (since - SELL_WAIT) / SELL_GLITCH };
  SL.shown = look;
  return { ...look, from: null, k: 0 };
}

// One machine: the cabinet, and its screen on (flickering in), going off (a CRT squeeze), or dark,
// or glitching over from another screen (gl: the old one and how far through, 0..1)
/** @param {CanvasRenderingContext2D} ctx @param {World} W @param {'buy' | 'sell'} kind @param {number} cx @param {boolean} on @param {VendLook} look @param {(VendLook & { k: number }) | null} [gl] */
function machine(ctx, W, kind, cx, on, look, gl = null) {
  const gf = Math.floor(W.time * 30);         // the glitch's frame: a new jumble 30 times a second
  let hue = look.hue;
  if (gl && hash(gf * 3.1 + cx) > gl.k) hue = gl.hue;
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
  const img = screen(look), mid = sy + SH / 2;
  ctx.translate(0, mid); ctx.scale(1, squeeze); ctx.translate(0, -mid);
  if (gl) glitch(ctx, img, screen(gl), sx - GLOW, sy - GLOW, gl.k, gf, cx);
  else ctx.drawImage(img, sx - GLOW, sy - GLOW, SW + GLOW * 2, SH + GLOW * 2);
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

// A screen glitching from one image to another: cut into bands, each band the old image or the
// new (more of the new as k goes 0 → 1), the worst of it torn sideways, a ghost of the other hue
// split off it, and thin white tear lines; all from screen-steady hashes of the glitch frame f
/** @param {CanvasRenderingContext2D} ctx @param {HTMLCanvasElement} img @param {HTMLCanvasElement} old @param {number} x @param {number} y @param {number} k @param {number} f @param {number} seed */
function glitch(ctx, img, old, x, y, k, f, seed) {
  const w = SW + GLOW * 2, h = SH + GLOW * 2, n = 3 + Math.floor(hash(f + seed) * 9), rage = Math.sin(k * Math.PI);
  let at = 0;
  for (let i = 0; i < n; i++) {
    const bh = i === n - 1 ? h - at : h / n * (0.4 + hash(f * 5 + i * 1.7) * 1.2);
    const src = hash(f * 7 + i * 3.3 + seed) < k ? img : old;
    const dx = hash(f * 11 + i) < 0.45 ? (hash(f * 13 + i * 2.9) - 0.5) * 22 * rage : 0;
    const sy0 = at / h * src.height, sh0 = Math.max(1, Math.min(bh, h - at) / h * src.height);
    if (dx && hash(f * 17 + i) < 0.5) {       // a colour-split ghost of the other image
      ctx.save(); ctx.globalAlpha *= 0.5; ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(src === img ? old : img, 0, sy0, src.width, sh0, x - dx * 0.6, y + at, w, Math.min(bh, h - at));
      ctx.restore();
    }
    ctx.drawImage(src, 0, sy0, src.width, sh0, x + dx, y + at, w, Math.min(bh, h - at));
    at += bh;
    if (at >= h) break;
  }
  ctx.save(); ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) if (hash(f * 19 + i * 5 + seed) < 0.5 * rage) {
    ctx.globalAlpha = 0.5 + 0.5 * hash(f + i);
    ctx.fillRect(x + GLOW - 4 + (hash(f * 23 + i) - 0.5) * 10, y + GLOW + hash(f * 29 + i * 7) * SH, SW + 8, 0.8);
  }
  ctx.restore();
}

// The two machines, drawn with the shop's stock (before the fog)
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawVend(W, G, F) {
  if (VEND_TOP > W.camY + F.vh + 10 || VEND_TOP + VEND_H < W.camY - 10) return;
  const lv = 'LVL ' + W.floor, busy = !!W.warp, due = G.input.current.loadout.due || 0;
  drawHoloShop(W, G);
  if (W.repo) {                                // repossessed: both screens count down the incineration
    const left = REPO_FIRE - W.repo.t;
    const top = [W.repo.t < REPO_ALARM ? 'OVERDUE' : left > 0 ? '0:' + String(Math.ceil(left)).padStart(2, '0') : 'BURN'];
    const bot = W.repo.t < REPO_ALARM ? ['debt defaulted', 'level', 'repossessed'] : ['incineration', 'sequence', 'initiated'];
    machine(G.ctx, W, 'buy', VEND_BUY_X, !busy, { hue: HOLO_RED, top, bot });
    machine(G.ctx, W, 'sell', VEND_SELL_X, W.repo.t >= REPO_ALARM, { hue: HOLO_RED, top, bot });
    return;
  }
  if (W.hasLvl && due) machine(G.ctx, W, 'buy', VEND_BUY_X, !busy,
    { hue: HOLO_RED, top: [countdown(due - Date.now())], bot: ['debt repayment', 'deadline', lv] });
  else machine(G.ctx, W, 'buy', VEND_BUY_X, !W.hasLvl && !busy, deal('BUY', W.floor, lvlBuy(W.floor), HOLO_GREEN, ['*credit available']));
  const sl = sellScreen(W);
  machine(G.ctx, W, 'sell', VEND_SELL_X, true, sl, sl.from && { ...sl.from, k: sl.k });
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

// The repossession in the shop (after the fog): the fire jets' grates in the floor, the red
// emergency lights fading on and off, and once REPO_FIRE comes the jets roaring up out of the
// grates until the whole room is flame. Only screen-steady hashes here, never Math.random
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawRepo(W, G, F) {
  const R = W.repo;
  if (!R || R.t < REPO_ALARM - 0.5) return;
  const ctx = G.ctx, top = SHOP_Y, fy = SHOP_FLOOR * CELL, x0 = W.camX - 20, x1 = W.camX + F.vw + 20;
  if (top > W.camY + F.vh || fy < W.camY) return;
  const on = Math.min(1, (R.t - REPO_ALARM + 0.5) / 0.5);
  const pulse = on * (0.5 - 0.5 * Math.cos((R.t - REPO_ALARM) * Math.PI * 2 / 1.8));   // fades on and off
  ctx.save();
  // the grates, in the floor every REPO_JET
  const j0 = Math.floor(x0 / REPO_JET) * REPO_JET;
  for (let x = j0; x < x1; x += REPO_JET) {
    ctx.fillStyle = '#15171c'; ctx.fillRect(x - 6, fy - 2, 12, 3);
    ctx.fillStyle = '#3a3f4a'; for (let k = -4; k <= 4; k += 3) ctx.fillRect(x + k, fy - 2, 1, 2);
  }
  // the emergency lights: red wash over the room, and the lamps along the ceiling
  ctx.fillStyle = 'rgba(255,20,20,' + (0.28 * pulse).toFixed(3) + ')';
  ctx.fillRect(x0, top, x1 - x0, fy - top);
  ctx.globalCompositeOperation = 'lighter';
  for (let x = Math.floor(x0 / 160) * 160 + 80; x < x1; x += 160) {
    const g = ctx.createRadialGradient(x, top + 3, 0, x, top + 3, 70);
    g.addColorStop(0, 'rgba(255,60,40,' + (0.55 * pulse).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 70, top, 140, 70);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#2a2020'; ctx.fillRect(x - 5, top, 10, 3);
    ctx.fillStyle = 'rgba(255,' + Math.round(40 + 80 * pulse) + ',60,' + (0.4 + 0.6 * pulse).toFixed(3) + ')'; ctx.fillRect(x - 3, top + 3, 6, 2);
    ctx.globalCompositeOperation = 'lighter';
  }
  // the fire: each jet grows to the ceiling, then the room fills
  if (R.t >= REPO_FIRE) {
    const ft = R.t - REPO_FIRE, H = fy - top, fl = Math.floor(W.time * 20);
    for (let x = j0; x < x1; x += REPO_JET) {
      const h = Math.min(H, ft * 110) * (0.75 + 0.25 * hash(fl + x * 0.13)), w = 7 + 10 * Math.min(1, ft / 3);
      const g = ctx.createLinearGradient(0, fy, 0, fy - h);
      g.addColorStop(0, 'rgba(255,250,210,0.95)'); g.addColorStop(0.25, 'rgba(255,200,60,0.85)');
      g.addColorStop(0.7, 'rgba(255,90,20,0.55)'); g.addColorStop(1, 'rgba(200,20,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - 3, fy); ctx.quadraticCurveTo(x - w, fy - h * 0.5, x + (hash(fl + x) - 0.5) * 8, fy - h);
      ctx.quadraticCurveTo(x + w, fy - h * 0.5, x + 3, fy); ctx.closePath(); ctx.fill();
    }
    const eng = Math.min(0.75, Math.max(0, (ft - 1.5) / 4)) * (0.85 + 0.15 * hash(fl * 1.7));
    if (eng > 0) {
      const g = ctx.createLinearGradient(0, fy, 0, top);
      g.addColorStop(0, 'rgba(255,160,40,' + eng.toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,60,10,' + (eng * 0.6).toFixed(3) + ')');
      ctx.fillStyle = g; ctx.fillRect(x0, top, x1 - x0, fy - top);
    }
  }
  ctx.restore();
}
