// @ts-check
// The shop's ceiling tubes (v0.0.136), after drawGlows: a fixture over each light section
// (world/shoplights.js LIGHT_X), its tube lit as far as the section is on (a new run's dark shop
// stutters them on; otherwise steady), a soft cone of light down to the floor, and, while the shop
// is dark, the teleporter's blue glow round the way in. Hashes of W.time only, never Math.random.

import { CELL, SHOP_FLOOR, SHOP_Y } from '../../core/consts.js';
import { LIGHT_X, sectionLevel, shopDark } from '../../world/shoplights.js';

const TUBE_W = 40;                         // a tube's length (world units)
const hs = (/** @type {number} */ n) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

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
