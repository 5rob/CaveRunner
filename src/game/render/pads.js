// @ts-check
// The two portals as teleporter pads: the exit on its ledge at the top of the cave, the way in on
// the shop floor. drawPad (before the fog, from drawPortal / drawArrival in cave.js) is the
// hardware: a metal platform with a lit emitter strip; drawPads (after drawGlows) is the light: a
// blue beam fading off upward, specks rising in it, and lightning crackling up off the pad (the
// warp's bolts, drawBolt), only where the fog says the pad has been seen. Screen-steady hashes
// of W.time only, never Math.random (draw shares the simulation's stream).

import { CELL, SHOP_FLOOR } from '../../core/consts.js';
import { fogLit } from '../systems/fog.js';
import { drawBolt } from './looks.js';

export const PAD_W = 30;                       // the platform's width (world units)
export const BEAM_H = 64;                      // how far up the beam fades out
const BOLT_T = 0.09;                           // one bolt slot (seconds)
const BOLT_CHANCE = 0.4;                       // a slot's chance of a bolt

// a steady pseudo-random 0..1 for n
/** @param {number} n */
const hs = n => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

// where the pads stand: centre x, and the floor y they sit on
/** @param {World} W */
export const padSpots = W => {
  const out = [{ x: W.arrival.x, y: SHOP_FLOOR * CELL, seed: 1 }];
  if (W.hasLvl) out.push({ x: W.portal.x + W.portal.w / 2, y: W.portal.y + W.portal.h, seed: 2 });
  return out;
};

// The platform at (x, fy): its top flush with the floor, sunk into it
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} fy @param {number} time */
export function drawPad(ctx, x, fy, time) {
  const w = PAD_W, l = x - w / 2;
  ctx.fillStyle = '#1c2230';                                   // the housing
  ctx.beginPath(); ctx.moveTo(l - 3, fy + 4); ctx.lineTo(l, fy - 2); ctx.lineTo(l + w, fy - 2); ctx.lineTo(l + w + 3, fy + 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3a4458'; ctx.fillRect(l, fy - 2, w, 1);  // its top edge
  ctx.fillStyle = '#5a6880'; ctx.fillRect(l + 1, fy - 2, w - 2, 0.6);
  const p = 0.75 + 0.25 * Math.sin(time * 3);
  ctx.fillStyle = 'rgba(120,210,255,' + p.toFixed(3) + ')';    // the emitter strip
  ctx.fillRect(l + 3, fy - 1, w - 6, 1.2);
  ctx.fillStyle = '#e8f7ff'; ctx.fillRect(l + 6, fy - 0.8, w - 12, 0.6);
  for (let i = 0; i < 4; i++) {                                // little lights along the front, chasing
    const on = Math.floor(time * 4) % 4 === i;
    ctx.fillStyle = on ? '#9fe2ff' : '#2e4a66';
    ctx.fillRect(l + 5 + i * (w - 10) / 3 - 0.75, fy + 1.4, 1.5, 1);
  }
}

// The light over the pads, after the fog: the beam, the specks, the bolts
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawPads(W, G, F) {
  const ctx = G.ctx, t = W.time;
  for (const P of padSpots(W)) {
    if (P.y < W.camY - 10 || P.y - BEAM_H > W.camY + F.vh || P.x < W.camX - 40 || P.x > W.camX + F.vw + 40) continue;
    if (!fogLit(W, P.x, P.y - 6)) continue;
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.4 + P.seed);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // the beam: three widths, each fading off upward, so it's brightest in the middle and low down
    for (const [wf, a, hf] of [[0.95, 0.16, 1], [0.66, 0.2, 0.8], [0.34, 0.28, 0.6]]) {
      const h = BEAM_H * hf, g = ctx.createLinearGradient(0, P.y, 0, P.y - h);
      g.addColorStop(0, 'rgba(90,185,255,' + (a * pulse).toFixed(3) + ')');
      g.addColorStop(0.5, 'rgba(70,150,255,' + (a * 0.35 * pulse).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(60,120,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(P.x - PAD_W * wf / 2, P.y - h, PAD_W * wf, h);
    }
    // a soft glow on the floor round it
    const fg = ctx.createRadialGradient(P.x, P.y, 0, P.x, P.y, PAD_W);
    fg.addColorStop(0, 'rgba(90,185,255,' + (0.25 * pulse).toFixed(3) + ')'); fg.addColorStop(1, 'rgba(90,185,255,0)');
    ctx.fillStyle = fg; ctx.fillRect(P.x - PAD_W, P.y - PAD_W, PAD_W * 2, PAD_W * 2);
    // specks rising up the beam
    for (let i = 0; i < 10; i++) {
      const sp = 14 + hs(i * 3 + P.seed) * 22, u = ((t * sp / BEAM_H) + hs(i * 7 + P.seed * 13)) % 1;
      const sx = P.x + (hs(i * 11 + P.seed) - 0.5) * PAD_W * 0.8 + Math.sin(t * 2 + i) * 1.2;
      ctx.globalAlpha = (1 - u) * 0.8;
      ctx.fillStyle = hs(i + P.seed * 5) < 0.4 ? '#e6f6ff' : '#6cc4ff';
      ctx.fillRect(sx - 0.6, P.y - 2 - u * BEAM_H * 0.9, 1.2, 1.2);
    }
    ctx.restore();
    // lightning up off the pad: a few slots of bolts at a time, each a jagged line up into the beam
    const n0 = Math.floor(t / BOLT_T);
    for (let n = n0 - 2; n <= n0; n++) {
      const s = n * 7.13 + P.seed * 101;
      if (hs(s) > BOLT_CHANCE) continue;
      const age = (t - n * BOLT_T) / (BOLT_T * 3);
      let bx = P.x + (hs(s + 1) - 0.5) * (PAD_W - 6), by = P.y - 1;
      const up = BEAM_H * (0.3 + 0.5 * hs(s + 2)), steps = 6;
      const pts = [{ x: bx, y: by }];
      for (let k = 1; k <= steps; k++) {
        bx += (hs(s + 3 + k) - 0.5) * 7; by -= up / steps;
        bx = Math.max(P.x - PAD_W / 2, Math.min(P.x + PAD_W / 2, bx));
        pts.push({ x: bx, y: by });
      }
      drawBolt(G, pts, '#7cc8ff', 0.9, Math.max(0, 1 - age));
    }
  }
}
