// @ts-check
// A new run's guide hologram (world/guide.js, game/systems/guide.js): drawGuide, a little see-through
// blue you hovering over the hall floor, waving, with bright distortion bars rolling down it and a
// glitch as it comes, goes, or is run through (after drawShops, before you, so you pass in front of
// it); drawGuideTalk, its speech box typing out, in screen space over the picture (after the
// messages). Steady hashes of time only: draw shares the simulation's Math.random stream.

import { drawRunner } from '../../art/sprites.js';
import { CELL, PW, SHOP_FLOOR } from '../../core/consts.js';
import { clamp } from '../../core/util.js';
import { DEV } from '../../dev/knobs.js';
import { APPEAR_T, LEAVE_T, guideSpeech } from '../../world/guide.js';
import { LIGHT_X, sectionLevel } from '../../world/shoplights.js';
import { GUIDE_FEET, guideMid } from '../systems/guide.js';

/** @param {number} n */
const hash = n => { const v = Math.sin(n * 12.9898 + 4.1414) * 43758.5453; return v - Math.floor(v); };

/** @type {{ c: HTMLCanvasElement | null, x: CanvasRenderingContext2D | null }} */
const S = { c: null, x: null };
const BOX_W = 34, BOX_H = 38;                  // the layer round it (world units)

// How glitched it is now (0-1), and how solid (0-1)
/** @param {Guide} g @param {number} time */
function glitchOf(g, time) {
  if (g.st === 'appear') return { gl: 1 - g.t / APPEAR_T, a: hash(Math.floor(time * 40)) < g.t / APPEAR_T + 0.2 ? 1 : 0.15 };
  if (g.st === 'rude') return { gl: 0.55 + 0.45 * hash(Math.floor(time * 20)), a: hash(Math.floor(time * 25) + 3) < 0.85 ? 1 : 0.3 };
  if (g.st === 'leave') return { gl: 0.4 + g.t / LEAVE_T, a: Math.max(0, 1 - g.t / LEAVE_T) * (hash(Math.floor(time * 30)) < 0.7 ? 1 : 0.3) };
  // a small stutter now and then, like any hologram
  return { gl: hash(Math.floor(time * 6) + 9) < 0.06 ? 0.35 : 0, a: 1 };
}

// Is it showing? Only while the tube over it is lit (owner): it isn't there in the dark, and as the tube
// stutters on it blinks in with it
/** @param {World} W */
export function guideShown(W) {
  const g = W.guide;
  if (!g || g.st === 'wait' || g.st === 'gone') return false;
  if (!W.shopLit) return true;
  let i = 0;
  for (let k = 1; k < LIGHT_X.length; k++) if (Math.abs(LIGHT_X[k] - g.x) < Math.abs(LIGHT_X[i] - g.x)) i = k;
  return sectionLevel(W.shopLit, i, W.time) > 0.3;
}

/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawGuide(W, G, F) {
  const g = W.guide;
  if (!g || G.RPV || !guideShown(W)) return;
  const t = W.time, m = guideMid(W, g);
  if (m.x < W.camX - 40 || m.x > W.camX + F.vw + 40) return;
  const px = DEV.runnerPx > 0 ? DEV.runnerPx : 1;
  const bob = Math.sin(t * 2.2) * 1.5;
  const feet = SHOP_FLOOR * CELL - GUIDE_FEET + bob, bx = m.x - PW / 2, by = feet - 21;
  // its layer, on a grid pinned to it
  const x0 = Math.round(m.x - BOX_W / 2), y0 = Math.round(by - 8);
  const cw = Math.ceil(BOX_W / px), ch = Math.ceil(BOX_H / px);
  if (!S.c) { S.c = document.createElement('canvas'); S.x = S.c.getContext('2d', { willReadFrequently: true }); }
  const c = S.c, x = S.x;
  if (!x) return;
  if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cw, ch);
  x.setTransform(1 / px, 0, 0, 1 / px, -x0 / px, -y0 / px);
  // facing you, waving its near hand over its head (until it gets talking, and again as it goes)
  const f = F.pcx < m.x ? -1 : 1, cx = bx + PW / 2;
  const waving = g.st === 'appear' || g.st === 'wave' || g.st === 'give' || g.st === 'leave' || (g.st === 'talk' && g.page === 0 && g.t < 2.5);
  // the waving hand swings out past the helmet (the arms are short: up and out, to and fro)
  const sw = Math.sin(t * 9), wa = -0.45 - 0.55 * (0.5 + 0.5 * sw);
  const hands = waving ? { gun: { x: cx + f * (1.1 + Math.cos(wa) * 5.6), y: by + 9.6 + Math.sin(wa) * 5.6 } } : undefined;
  drawRunner(x, bx, by, PW, 22, f, null, true, 0, false, hands);
  x.setTransform(1, 0, 0, 1, 0, 0);
  // into a hologram: blue by brightness, every other line thinner, two bright bars rolling down it
  // that tear it sideways, and glitches that rip rows across and drop some out
  const { gl, a } = glitchOf(g, t);
  const src = x.getImageData(0, 0, cw, ch), d = src.data, out = x.createImageData(cw, ch), o = out.data;
  const fr = Math.floor(t * 30), scan = Math.floor(t * 8) % 2;
  const bars = [((t * 0.9) % 1.6) - 0.3, ((t * 0.9 + 0.8) % 1.6) - 0.3].map(v => v * ch);
  for (let y = 0; y < ch; y++) {
    let shift = 0, lift = 0;
    for (const b of bars) {
      const dy = Math.abs(y - b);
      if (dy < 2.5) { lift = Math.max(lift, 1 - dy / 2.5); shift += Math.round((hash(fr + y) - 0.5) * 3); }
    }
    if (gl > 0 && hash(fr * 3 + Math.floor(y / 3)) < gl * 0.6) shift += Math.round((hash(fr * 7 + y) - 0.5) * 14 * gl);
    const drop = gl > 0 && hash(fr * 5 + y * 3) < gl * 0.25;
    const thin = (y + scan) % 2 ? 0.75 : 1;
    for (let xx = 0; xx < cw; xx++) {
      const sx = xx - shift;
      if (sx < 0 || sx >= cw || drop) continue;
      const i = (y * cw + sx) * 4, j = (y * cw + xx) * 4;
      if (d[i + 3] < 100) continue;
      const L = (d[i] + d[i + 1] + d[i + 2]) / 765;
      // dark parts (the visor) go see-through and deep blue, light ones bright: it still reads as you
      o[j] = Math.min(255, 10 + L * 125 + lift * 200);
      o[j + 1] = Math.min(255, 110 + L * 145 + lift * 100);
      o[j + 2] = 255;
      o[j + 3] = Math.min(255, (70 + L * 185 + lift * 60) * thin);
    }
  }
  // the colour split while it glitches: a red ghost knocked off to one side
  if (gl > 0.3) {
    const k = Math.round((hash(fr + 77) - 0.5) * 6 * gl);
    for (let y = 0; y < ch; y++) for (let xx = 0; xx < cw; xx++) {
      const sx = xx - k, j = (y * cw + xx) * 4;
      if (sx < 0 || sx >= cw || o[j + 3]) continue;
      const i = (y * cw + sx) * 4;
      if (d[i + 3] >= 100) { o[j] = 255; o[j + 1] = 70; o[j + 2] = 110; o[j + 3] = 120 * gl; }
    }
  }
  x.putImageData(out, 0, 0);
  const ctx = G.ctx;
  ctx.save();
  // the projector's light on the floor under it, and a soft glow round it
  const floorY = SHOP_FLOOR * CELL;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.5 * a;
  const pool = ctx.createRadialGradient(m.x, floorY, 0, m.x, floorY, 16);
  pool.addColorStop(0, 'rgba(110,200,255,0.55)'); pool.addColorStop(1, 'rgba(110,200,255,0)');
  ctx.fillStyle = pool;
  ctx.beginPath(); ctx.ellipse(m.x, floorY, 16, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  const glow = ctx.createRadialGradient(m.x, m.y, 2, m.x, m.y, 26);
  glow.addColorStop(0, 'rgba(90,180,255,0.22)'); glow.addColorStop(1, 'rgba(90,180,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(m.x - 26, m.y - 26, 52, 52);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.85 * a;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, 0, 0, cw, ch, x0, y0, cw * px, ch * px);
  ctx.restore();
}

// Lines of `text` (its own line breaks kept) no wider than w, in the context's font
/** @param {CanvasRenderingContext2D} ctx @param {string} text @param {number} w @returns {string[]} */
export function wrapLines(ctx, text, w) {
  const out = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const tryL = line ? line + ' ' + word : word;
      if (line && ctx.measureText(tryL).width > w) { out.push(line); line = word; } else line = tryL;
    }
    out.push(line);
  }
  return out;
}

// The speech box: sized for the whole box's text (so it doesn't grow as it types), over its head,
// kept on screen, a tail down to it. Run through it: the box shakes and its edge flickers red
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawGuideTalk(W, G, F) {
  const g = W.guide;
  if (!g || G.RPV || !guideShown(W)) return;
  const sp = guideSpeech(g, DEV.guideCps);
  if (!sp.text) return;
  const ctx = G.ctx, dpr = F.dpr, cw = G.c.width / dpr, u = W.unitPx;
  const m = guideMid(W, g), t = W.time;
  const rude = g.st === 'rude' || (g.st === 'leave' && g.say.startsWith('Rude'));
  const jit = rude ? (hash(Math.floor(t * 30)) - 0.5) * 4 : 0;
  const sx = (m.x - W.camX) * u + jit, sy = (m.y - 20 - W.camY) * u;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = g.st === 'leave' ? Math.max(0, 1 - g.t / LEAVE_T) : 1;
  const fs = 13, lh = 17, pad = 9;
  ctx.font = '500 ' + fs + 'px system-ui, sans-serif';
  const bw = Math.min(250, cw - 24), lines = wrapLines(ctx, sp.text, bw - pad * 2);
  // as tall as the lines typed so far: it grows upward as it types
  let shown = 0;
  for (let i = 0, left = sp.n; i < lines.length && left > 0; i++) { shown++; left -= lines[i].length + 1; }
  const bh = Math.max(1, shown) * lh + pad * 2 - 3;
  const bx = clamp(sx - bw / 2, 10, cw - bw - 10), by = Math.max(8, sy - 10 - bh);
  ctx.fillStyle = 'rgba(6,20,38,0.9)';
  ctx.strokeStyle = rude && hash(Math.floor(t * 18)) < 0.6 ? '#ff6a7a' : '#7fd8ff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 7);
  // the tail, down towards it
  const tx = clamp(sx, bx + 14, bx + bw - 14);
  ctx.moveTo(tx - 7, by + bh); ctx.lineTo(clamp(sx, tx - 12, tx + 12), Math.min(sy - 2, by + bh + 10)); ctx.lineTo(tx + 7, by + bh);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(6,20,38,0.9)'; ctx.fillRect(tx - 6, by + bh - 2, 12, 3);   // the tail's seam
  ctx.fillStyle = '#d8f3ff'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  let left = sp.n;
  lines.forEach((ln, i) => {
    if (left <= 0) return;
    const s = ln.slice(0, left);
    ctx.fillText(s, bx + pad, by + pad + i * lh);
    // a caret at the end while it types
    if (left <= ln.length && sp.n < sp.text.length && Math.floor(t * 3) % 2 === 0)
      ctx.fillRect(bx + pad + ctx.measureText(s).width + 1, by + pad + i * lh + 1, 6, fs - 1);
    left -= ln.length + 1;                    // the space or line break the wrap ate
  });
  ctx.restore();
}
