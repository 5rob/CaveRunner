// @ts-check
// The shop's ceiling tubes (v0.0.136), after drawGlows: a fixture over each light section
// (world/shoplights.js LIGHT_X), its tube lit as far as the section is on (a new run's dark shop
// stutters them on; otherwise steady), a soft cone of light down to the floor, and, while the shop
// is dark, the teleporter's blue glow round the way in. Hashes of W.time only, never Math.random.
// Since v0.0.144 dust hangs in each lit cone (coneDust): only ever inside it, dust-coloured.

import { CELL, SHOP_FLOOR, SHOP_Y } from '../../core/consts.js';
import { LIGHT_X, sectionLevel, shopDark } from '../../world/shoplights.js';

const TUBE_W = 40;                         // a tube's length (world units)
const hs = (/** @type {number} */ n) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

export const DUST_N = 14;                  // dust specks in a cone
const DUST_COL = '226,214,188';            // dust: a pale grey-beige

// Dust floating in a cone of light (tube's underside at y0, the floor at fy, lv how lit): each speck
// a fixed share of the way across the cone at its height, so it never leaves the cone, sinking slowly
// and wandering a little, catching the light more in the middle and less near the cone's edges, top and floor
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y0 @param {number} fy @param {number} lv @param {number} t @param {number} i */
export function coneDust(ctx, x, y0, fy, lv, t, i) {
  const H = fy - y0 - 3;
  ctx.fillStyle = 'rgb(' + DUST_COL + ')';
  for (let k = 0; k < DUST_N; k++) {
    const s = i * 31 + k * 7.3, sp = 0.025 + 0.035 * hs(s + 2);         // a cone-height every 15-40 s
    const v = (hs(s + 3) + t * sp) % 1;                                    // how far down (0 tube, 1 floor)
    const u = Math.max(-0.95, Math.min(0.95, (hs(s + 1) * 2 - 1) * 0.85 + 0.12 * Math.sin(t * (0.3 + 0.4 * hs(s + 4)) + s)));
    const half = TUBE_W / 2 + 26 * v, px = x + u * half, py = y0 + v * H;
    const a = lv * (1 - u * u) * Math.min(1, v * 6, (1 - v) * 6) * (0.35 + 0.5 * hs(s + 5)) * (0.75 + 0.25 * Math.sin(t * 2 + s));
    if (a <= 0.02) continue;
    const sz = 0.6 + 0.6 * hs(s + 6);
    ctx.globalAlpha = a;
    ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
}

/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawTubes(W, G, F) {
  const { vw, vh } = F, ctx = G.ctx, fy = SHOP_FLOOR * CELL, L = G.RPV ? null : W.shopLit;
  if (SHOP_Y > W.camY + vh || fy < W.camY) return;
  ctx.save();
  for (let i = 0; i < LIGHT_X.length; i++) {
    const x = LIGHT_X[i];
    if (x + 80 < W.camX || x - 80 > W.camX + vw) continue;
    const lv = L ? sectionLevel(L, i, W.time) : 1, seen = L ? 1 - shopDark(L, x, W.time) : 1;
    const y = SHOP_Y + 1;
    // the fixture: a dark steel housing, seen when anything lights it
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = Math.max(0.15, seen);
    ctx.fillStyle = '#20242c'; ctx.fillRect(x - TUBE_W / 2 - 3, y, TUBE_W + 6, 3);
    ctx.fillStyle = '#3a404c'; ctx.fillRect(x - TUBE_W / 2 - 3, y + 3, 2, 2); ctx.fillRect(x + TUBE_W / 2 + 1, y + 3, 2, 2);
    // the tube: grey and dead off, its ends glowing faintly while it tries, white lit
    const on = L ? L.on[i] >= 0 : true;
    ctx.globalAlpha = 1;
    ctx.fillStyle = lv > 0.2 ? `rgb(${Math.round(150 + 105 * lv)},${Math.round(165 + 90 * lv)},${Math.round(180 + 75 * lv)})` : '#363b44';
    ctx.globalAlpha = lv > 0.2 ? 1 : Math.max(0.15, seen);
    ctx.fillRect(x - TUBE_W / 2, y + 3, TUBE_W, 2);
    if (on && lv <= 0.2) {                 // the cathodes glowing at the ends
      ctx.fillStyle = 'rgba(255,170,190,0.8)';
      ctx.fillRect(x - TUBE_W / 2, y + 3, 3, 2); ctx.fillRect(x + TUBE_W / 2 - 3, y + 3, 3, 2);
    }
    if (lv <= 0.2) continue;
    // its light: a halo round the tube and a faint cone down to the floor
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(x, y + 4, 2, x, y + 4, 34);
    halo.addColorStop(0, `rgba(210,235,255,${0.32 * lv})`); halo.addColorStop(1, 'rgba(210,235,255,0)');
    ctx.fillStyle = halo; ctx.fillRect(x - 36, y - 2, 72, 40);
    const cone = ctx.createLinearGradient(0, y + 5, 0, fy);
    cone.addColorStop(0, `rgba(200,230,255,${0.2 * lv})`); cone.addColorStop(1, `rgba(200,230,255,${0.04 * lv})`);
    ctx.fillStyle = cone;
    ctx.beginPath(); ctx.moveTo(x - TUBE_W / 2, y + 5); ctx.lineTo(x + TUBE_W / 2, y + 5);
    ctx.lineTo(x + TUBE_W / 2 + 26, fy); ctx.lineTo(x - TUBE_W / 2 - 26, fy); ctx.closePath(); ctx.fill();
    // the pool it throws on the floor
    const pool = ctx.createRadialGradient(x, fy, 2, x, fy, TUBE_W / 2 + 26);
    pool.addColorStop(0, `rgba(210,235,255,${0.22 * lv})`); pool.addColorStop(1, 'rgba(210,235,255,0)');
    ctx.fillStyle = pool;
    ctx.beginPath(); ctx.ellipse(x, fy, TUBE_W / 2 + 26, 7, 0, 0, Math.PI * 2); ctx.fill();
    coneDust(ctx, x, y + 5, fy, lv, W.time, i);
  }
  // the dark shop: the teleporter throws its blue about, flickering with the crackle
  if (L) {
    const ax = W.arrival.x, ay = fy - 20, fl = 0.75 + 0.25 * hs(Math.floor(W.time * 20));
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(ax, ay, 4, ax, ay, 70);
    g.addColorStop(0, `rgba(90,170,255,${0.4 * fl})`); g.addColorStop(1, 'rgba(90,170,255,0)');
    ctx.fillStyle = g; ctx.fillRect(ax - 70, ay - 70, 140, 140);
  }
  ctx.restore();
}
