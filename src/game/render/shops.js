// @ts-check
// The shop's vending machines (game/systems/shops.js): a dark cabinet each, with its icon floating
// in front of the glass as a flickering hologram in the machine's hue, and the chute at the bottom
// a bought thing pops out of. A crystal machine (v0.0.138) has a slot in its crystal's colour and a row
// of chase lights on its cap; taking a crystal it shakes faster and faster and the lights race
// (W.machines[k].t). Drawn with the shop's stock, before the fog. drawDemo (v0.0.142): a crystal
// machine's hologram demo of a crystal going in (W.demo, stepDemo), in the guide's blue (render/guide.js).

import { gunArtCanvas } from '../../art/gunart.js';
import { CRYSTAL_R, drawNugget } from '../../art/sprites.js';
import { CELL, SHOP_FLOOR } from '../../core/consts.js';
import { DEV } from '../../dev/knobs.js';
import { CYCLE, MACHINE_H, MACHINE_TOP, MACHINE_W, SHOPS, SLOT_Y, demoAt, demoPos, shakePhase } from '../systems/shops.js';
import { holoLight, holoPass } from './guide.js';

const ICON = 30, GLOW = 8, RES = 4;        // the hologram's size, its glow, and its pixels per unit
const SHOP_GUN_ART = 'blueraider';       // the gun machine's hologram: this sprite

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
  const im = icon === 'gun' ? gunArtCanvas(SHOP_GUN_ART) : null;
  if (im) {                                // a gun sprite, filling the icon's width, crisp
    const k = ICON * RES / im.width;
    a.imageSmoothingEnabled = false;
    a.drawImage(im, (S - im.width * k) / 2, (S - im.height * k) / 2, im.width * k, im.height * k);
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
    // a crystal machine at work: u 0..1 through its shake
    const M = W.machines[k], busy = !!(m.takes && M && M.t >= 0), u = busy ? Math.min(1, M.t / CYCLE) : 0;
    const ph = busy ? shakePhase(M.t) : 0;
    ctx.save();
    if (busy) ctx.translate(Math.sin(ph * 6.283) * (0.4 + 1.8 * u), Math.sin(ph * 4.1) * 0.5 * u);
    // the cabinet: body, pillars, cap, foot
    ctx.fillStyle = '#171a21'; ctx.fillRect(x, y, MACHINE_W, MACHINE_H);
    ctx.fillStyle = '#252a35'; ctx.fillRect(x, y, 5, MACHINE_H); ctx.fillRect(x + MACHINE_W - 5, y, 5, MACHINE_H);
    ctx.fillStyle = '#323948'; ctx.fillRect(x - 2, y - 1, MACHINE_W + 4, 5); ctx.fillRect(x - 3, fy - 5, MACHINE_W + 6, 5);
    // neon edge strips in the hue
    ctx.fillStyle = m.hue; ctx.globalAlpha = busy ? 0.45 + 0.5 * (Math.sin(ph * 6.283) > 0 ? 1 : 0) : 0.5 + 0.2 * Math.sin(t * 3 + m.x);
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
    if (busy) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.15 + 0.35 * u; ctx.fillStyle = m.hue; ctx.fillRect(gx, gy, gw, gh); ctx.globalCompositeOperation = 'source-over'; }
    // a band of brighter light rolling down it
    const band = iy + ((t * 16 + m.x) % (ICON + 16)) - 8;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * 0.2;
    ctx.fillRect(ix, Math.max(iy, band), ICON, Math.max(0, Math.min(5, iy + ICON - band)));
    ctx.restore();
    if (m.takes) {
      const col = m.takes === 'green' ? '#3dff7a' : '#ff3a4a';
      // the slot a crystal goes into, rimmed in its colour
      ctx.fillStyle = '#05070a'; ctx.fillRect(m.x - 7, SLOT_Y - 2, 14, 4);
      ctx.fillStyle = col; ctx.globalAlpha = 0.55 + 0.3 * Math.sin(t * 4 + m.x); ctx.fillRect(m.x - 8, SLOT_Y - 3, 16, 1); ctx.fillRect(m.x - 8, SLOT_Y + 2, 16, 1);
      // the chase lights along the cap: one lit dot strolling across, racing while it works
      const N = 8, pos = busy ? ph * 2 : t * 1.5;
      for (let i = 0; i < N; i++) {
        const lit = busy && u > 0.8 ? (Math.floor(ph * 2) % 2 === 0 ? 1 : 0.15) : Math.max(0.15, 1 - ((pos - i) % N + N) % N * 0.45);
        ctx.globalAlpha = lit; ctx.fillStyle = lit > 0.5 ? '#ffffff' : col;
        ctx.fillRect(x + 4 + i * (MACHINE_W - 8) / N + 1, y, 3, 2);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

/** @type {{ c: HTMLCanvasElement | null, x: CanvasRenderingContext2D | null }} */
const DL = { c: null, x: null };
const DEMO_BOX = 30;                         // the demo crystal's layer (world units)
// the demo crystal is drawn light (the hologram is blue by brightness: the real dark red came out a murky blue)
const DEMO_PAL = ['#56687a', '#a9bccc', '#e4f0f8', '#ffffff'];
const DEMO_TINT = 0.72;                      // how much of the crystal's own red or green shows through the hologram's blue

// A crystal machine's demo (game/systems/shops.js stepDemo): its crystal as a hologram, the guide's
// look (holoPass), glitching in on the floor beside the machine, a faint beam back to the machine
// projecting it, then sucked up into the slot with a trail of specks, and a flash as it goes in
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawDemo(W, G, F) {
  if (G.RPV) return;
  for (const k in W.demo) {
    const m = SHOPS[k], d = W.demo[k];
    if (!m || m.x < W.camX - 80 || m.x > W.camX + F.vw + 80) continue;
    const { ph, u } = demoAt(d.t);
    if (ph === 'gap') continue;
    const ctx = G.ctx, t = W.time, floorY = SHOP_FLOOR * CELL;
    ctx.save();
    if (ph === 'flash') {
      // it's in: a blue flash at the slot
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - u;
      const r = 5 + 12 * u, g = ctx.createRadialGradient(m.x, SLOT_Y, 0, m.x, SLOT_Y, r);
      g.addColorStop(0, 'rgba(190,235,255,0.9)'); g.addColorStop(1, 'rgba(90,180,255,0)');
      ctx.fillStyle = g; ctx.fillRect(m.x - r, SLOT_Y - r, r * 2, r * 2);
      ctx.restore();
      continue;
    }
    const p = demoPos(m.x, d.side, ph === 'suck' ? u : 0);
    // glitching in, then a small stutter now and then, like the guide
    const gl = ph === 'in' ? 1 - u : hash(Math.floor(t * 6) + m.x) < 0.06 ? 0.35 : 0;
    const a = ph === 'in' ? (hash(Math.floor(t * 40) + m.x) < u + 0.2 ? 1 : 0.15) : 1;
    // the machine projecting it: a faint beam from beside its slot
    const bx = m.x + d.side * 8;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.1 * a; ctx.fillStyle = '#6ec8ff';
    ctx.beginPath(); ctx.moveTo(bx, SLOT_Y - 1); ctx.lineTo(p.x, p.y - 8 * p.s); ctx.lineTo(p.x, p.y + 8 * p.s); ctx.lineTo(bx, SLOT_Y + 1); ctx.closePath(); ctx.fill();
    holoLight(ctx, p.x, p.y, floorY, a * (ph === 'suck' ? 1 - u : 1), 0.7);
    // the trail as it's drawn in
    if (ph === 'suck') {
      ctx.fillStyle = '#9fe0ff';
      for (let i = 1; i <= 5; i++) {
        const q = demoPos(m.x, d.side, Math.max(0, u - i * 0.07));
        ctx.globalAlpha = 0.5 * (1 - i / 6);
        ctx.fillRect(q.x - 0.7 + Math.sin(t * 30 + i) * 1.5, q.y - 0.7 + Math.cos(t * 23 + i) * 1.5, 1.4, 1.4);
      }
    }
    // the crystal, through the hologram pass
    const px = DEV.runnerPx > 0 ? DEV.runnerPx : 1;
    const x0 = Math.round(p.x - DEMO_BOX / 2), y0 = Math.round(p.y - DEMO_BOX / 2), cw = Math.ceil(DEMO_BOX / px);
    if (!DL.c) { DL.c = document.createElement('canvas'); DL.x = DL.c.getContext('2d', { willReadFrequently: true }); }
    const c = DL.c, x = DL.x;
    if (!x) { ctx.restore(); continue; }
    if (c.width !== cw || c.height !== cw) { c.width = cw; c.height = cw; }
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cw, cw);
    x.setTransform(1 / px, 0, 0, 1 / px, -x0 / px, -y0 / px);
    drawNugget(x, p.x, p.y, CRYSTAL_R * p.s, 2.7, ph === 'suck' ? u * u * 5 : 0, DEMO_PAL);
    x.setTransform(1, 0, 0, 1, 0, 0);
    holoPass(x, cw, cw, t + m.x, gl);
    // its own colour coming through the blue (owner: so you know which crystal to bring)
    x.globalCompositeOperation = 'source-atop'; x.globalAlpha = DEMO_TINT;
    x.fillStyle = m.takes === 'green' ? '#2dff6a' : '#ff3048'; x.fillRect(0, 0, cw, cw);
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.85 * a;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, 0, 0, cw, cw, x0, y0, cw * px, cw * px);
    ctx.restore();
  }
}
