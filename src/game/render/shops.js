// @ts-check
// The shop's vending machines (game/systems/shops.js): a dark cabinet each, with its icon floating
// in front of the glass as a flickering hologram in the machine's hue, and the chute at the bottom
// a bought thing pops out of. Drawn with the shop's stock, before the fog.

import { drawGun } from '../../art/sprites.js';
import { CELL, SHOP_FLOOR } from '../../core/consts.js';
import { MACHINE_H, MACHINE_TOP, MACHINE_W, SHOPS } from '../systems/shops.js';

const ICON = 30, GLOW = 8, RES = 4;        // the hologram's size, its glow, and its pixels per unit

// a steady pseudo-random 0..1 for n (draw() mustn't touch Math.random: it's the simulation's)
/** @param {number} n */
const hash = n => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };

/** @type {Map<string, HTMLCanvasElement>} */
const cache = new Map();

// The icon as a hologram: the emoji washed over with the hue, scan lines cut through it, a glow
/** @param {string} icon @param {string} hue */
function holoIcon(icon, hue) {
  const key = icon + hue, got = cache.get(key);
  if (got) return got;
  const S = (ICON + GLOW * 2) * RES;
  const A = document.createElement('canvas'); A.width = A.height = S;
  const B = document.createElement('canvas'); B.width = B.height = S;
  const a = A.getContext('2d'), b = B.getContext('2d');
  if (!a || !b) return B;
  if (icon === 'gun') {                    // the gun sprite, filling the icon's width
    const sc = ICON * RES / 22;
    drawGun(a, S / 2 - 3.85 * sc, S / 2 + 1 * sc, 0, sc, '#ffffff');
  } else {
    a.fillStyle = '#ffffff';                // a plain glyph (not an emoji) takes the hue below
    a.font = ICON * RES * 0.86 + 'px system-ui, "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    a.textAlign = 'center'; a.textBaseline = 'middle';
    a.fillText(icon, S / 2, S / 2 + ICON * RES * 0.04);
  }
  a.globalCompositeOperation = 'source-atop';
  a.globalAlpha = 0.78; a.fillStyle = hue; a.fillRect(0, 0, S, S);
  a.globalAlpha = 1; a.globalCompositeOperation = 'destination-out'; a.fillStyle = 'rgba(0,0,0,0.45)';
  for (let y = 0; y < S; y += RES * 1.5) a.fillRect(0, y, S, RES * 0.5);
  b.shadowColor = hue; b.shadowBlur = GLOW * RES * 0.6;
  b.drawImage(A, 0, 0);
  b.shadowBlur = 0; b.drawImage(A, 0, 0);
  cache.set(key, B);
  return B;
}

/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawShops(W, G, F) {
  if (MACHINE_TOP > W.camY + F.vh + 10 || MACHINE_TOP + MACHINE_H < W.camY - 10) return;
  const ctx = G.ctx, y = MACHINE_TOP, fy = SHOP_FLOOR * CELL, t = W.time;
  for (const k in SHOPS) {
    const m = SHOPS[k], x = m.x - MACHINE_W / 2;
    if (x > W.camX + F.vw + 20 || x + MACHINE_W < W.camX - 20) continue;
    // the cabinet: body, pillars, cap, foot
    ctx.fillStyle = '#171a21'; ctx.fillRect(x, y, MACHINE_W, MACHINE_H);
    ctx.fillStyle = '#252a35'; ctx.fillRect(x, y, 5, MACHINE_H); ctx.fillRect(x + MACHINE_W - 5, y, 5, MACHINE_H);
    ctx.fillStyle = '#323948'; ctx.fillRect(x - 2, y - 1, MACHINE_W + 4, 5); ctx.fillRect(x - 3, fy - 5, MACHINE_W + 6, 5);
    // neon edge strips in the hue
    ctx.fillStyle = m.hue; ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 3 + m.x);
    ctx.fillRect(x + 5, y + 6, 1, MACHINE_H - 14); ctx.fillRect(x + MACHINE_W - 6, y + 6, 1, MACHINE_H - 14);
    ctx.globalAlpha = 1;
    // the glass
    const gx = x + 8, gy = y + 7, gw = MACHINE_W - 16, gh = 42;
    ctx.fillStyle = '#05070a'; ctx.fillRect(gx, gy, gw, gh);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.moveTo(gx + gw * 0.55, gy); ctx.lineTo(gx + gw, gy); ctx.lineTo(gx + gw, gy + gh * 0.35); ctx.closePath(); ctx.fill();
    // the emitter bar under the glass, and the chute at the bottom with its flap
    const py = gy + gh + 3;
    ctx.fillStyle = '#2a303c'; ctx.fillRect(x + 10, py, MACHINE_W - 20, 2);
    ctx.fillStyle = m.hue; ctx.globalAlpha = 0.85; ctx.fillRect(x + 12, py + 0.5, MACHINE_W - 24, 1); ctx.globalAlpha = 1;
    const cy = fy - 22;
    ctx.fillStyle = '#0a0c10'; ctx.fillRect(x + 12, cy, MACHINE_W - 24, 12);
    ctx.fillStyle = '#2c323e'; ctx.fillRect(x + 12, cy, MACHINE_W - 24, 3);
    ctx.fillStyle = m.hue; ctx.globalAlpha = 0.35; ctx.fillRect(x + 12, cy + 11, MACHINE_W - 24, 1); ctx.globalAlpha = 1;
    // the hologram: a beam up from the emitter, the icon flickering in front of the glass
    const f = Math.floor(t * 14) + m.x;
    const drop = hash(f) < 0.07, jit = hash(f * 1.3) < 0.1 ? (hash(f * 2.1) - 0.5) * 3 : 0;
    const alpha = drop ? 0.25 : 0.82 + 0.15 * hash(f * 0.7);
    ctx.save();
    ctx.globalAlpha = alpha * 0.12; ctx.fillStyle = m.hue;
    const ix = m.x - ICON / 2, iy = gy + (gh - ICON) / 2 - 2;
    ctx.beginPath(); ctx.moveTo(x + 14, py); ctx.lineTo(x + MACHINE_W - 14, py); ctx.lineTo(ix + ICON, iy + ICON); ctx.lineTo(ix, iy + ICON); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.drawImage(holoIcon(m.icon, m.hue), ix - GLOW + jit, iy - GLOW + Math.sin(t * 2) * 1.2, ICON + GLOW * 2, ICON + GLOW * 2);
    // a band of brighter light rolling down it
    const band = iy + ((t * 16 + m.x) % (ICON + 16)) - 8;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * 0.2;
    ctx.fillRect(ix, Math.max(iy, band), ICON, Math.max(0, Math.min(5, iy + ICON - band)));
    ctx.restore();
  }
}
