// The cave's layers of draw() (render/draw.js), each a part it calls in order with its frame
// object F (REFACTOR.md D19): the rock and what sits on it

import { drawProp, rgbA } from '../../art/props.js';
import { BCELL, BH, BW, CELL, CH, COL, CW, SHOP_FLOOR, SHOP_Y, WW } from '../../core/consts.js';
import { clamp, mix } from '../../core/util.js';
import { themeFor } from '../../data/themes.js';
import { FIRE_COLS } from '../../world/fire.js';

// The cave behind everything: the background (with parallax), the shop's back wall, the
// decoration layer and the rock (the visible part only), and the burning pixels over them
export function drawTerrain(W, G, F) {
  const { vw, vh } = F;
  // background and terrain (visible part only)
  // The background sits further back: it slides PARALLAX as far as the terrain does, so
  // it is shifted by the rest of the camera move. It still covers the view at every edge,
  // because the shift only ever pushes it toward the camera.
  const PARALLAX = 0.8;
  const bgox = W.camX * (1 - PARALLAX), bgoy = W.camY * (1 - PARALLAX);
  const bcx = W.camX - bgox, bcy = W.camY - bgoy;
  const bx0 = clamp(Math.floor(bcx / BCELL), 0, BW - 1), by0 = clamp(Math.floor(bcy / BCELL), 0, BH - 1);
  const bx1 = clamp(Math.ceil((bcx + vw) / BCELL) + 1, 1, BW), by1 = clamp(Math.ceil((bcy + vh) / BCELL) + 1, 1, BH);
  G.ctx.drawImage(G.bg, bx0, by0, bx1 - bx0, by1 - by0, bx0 * BCELL + bgox, by0 * BCELL + bgoy, (bx1 - bx0) * BCELL, (by1 - by0) * BCELL);
  // the shop's back wall
  if (W.camY + vh > SHOP_Y) {
    G.ctx.fillStyle = '#241f28';
    G.ctx.fillRect(0, SHOP_Y, WW, (SHOP_FLOOR * CELL) - SHOP_Y);
    G.ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let bx = 0; bx < WW; bx += 24)
      for (let by = SHOP_Y; by < SHOP_FLOOR * CELL; by += 12)
        G.ctx.fillRect(bx + ((by / 12) % 2) * 12, by, 11, 11);
    G.ctx.fillStyle = 'rgba(233,236,242,0.30)';
    G.ctx.font = '600 11px system-ui, sans-serif';
    G.ctx.textAlign = 'center';
    G.ctx.fillText('SHOP', WW / 2, SHOP_Y + 14);
    // The floor number, huge and widely spaced along the whole back wall — just a
    // touch brighter than the wall itself, so it reads as painted-on lettering
    // rather than a label. Each glyph is placed by hand so the word spans most of
    // the wall's width no matter how many digits the floor has.
    const wallBot = SHOP_FLOOR * CELL, wallH = wallBot - SHOP_Y;
    const label = 'FLOOR ' + W.floor;
    G.ctx.fillStyle = 'rgba(255,255,255,0.07)';
    G.ctx.font = '800 ' + Math.round(wallH * 0.62) + 'px system-ui, sans-serif';
    G.ctx.textBaseline = 'middle';
    const margin = WW * 0.05, span = WW - margin * 2, cyText = SHOP_Y + wallH / 2 + 4;
    for (let i = 0; i < label.length; i++)
      G.ctx.fillText(label[i], margin + span * (i + 0.5) / label.length, cyText);
    G.ctx.textBaseline = 'alphabetic';
    G.ctx.textAlign = 'left';
  }

  const tx0 = clamp(Math.floor(W.camX / CELL), 0, CW - 1), ty0 = clamp(Math.floor(W.camY / CELL), 0, CH - 1);
  const tx1 = clamp(Math.ceil((W.camX + vw) / CELL) + 1, 1, CW), ty1 = clamp(Math.ceil((W.camY + vh) / CELL) + 1, 1, CH);
  W.viewW = vw; W.viewH = vh;
  // the decoration layer (pass 2): behind the rock, in front of the back wall
  G.ctx.drawImage(G.RPV ? G.RT.dC : G.decoC, tx0, ty0, tx1 - tx0, ty1 - ty0, tx0 * CELL, ty0 * CELL, (tx1 - tx0) * CELL, (ty1 - ty0) * CELL);
  G.ctx.drawImage(G.RPV ? G.RT.tC : G.terrain, tx0, ty0, tx1 - tx0, ty1 - ty0, tx0 * CELL, ty0 * CELL, (tx1 - tx0) * CELL, (ty1 - ty0) * CELL);
  // the burning pixels, over the art they're eating: colour by how much fuel is left, and a
  // new flicker each fire tick. Drawn under the fog, so fire you haven't seen stays hidden;
  // the glow on top comes after the fog, only on ground you have seen (fireVis).
  W.fireVis.length = 0;
  if (W.fire.list.length) {
    const buckets = [[], [], [], []];
    for (const i of W.fire.list) {
      const x = i % CW, y = (i / CW) | 0;
      if (x < tx0 || x >= tx1 || y < ty0 || y >= ty1) continue;
      W.fireVis.push(i);
      const t = W.fire.t[i], h = (Math.imul(i, 2654435761) + W.fireN * 40503) >>> 30;
      buckets[t <= 3 ? 3 : h === 0 ? 0 : h === 3 ? 2 : 1].push(i);
    }
    for (let c = 0; c < 4; c++) {
      if (!buckets[c].length) continue;
      G.ctx.fillStyle = FIRE_COLS[c];
      G.ctx.beginPath();
      for (const i of buckets[c]) G.ctx.rect((i % CW) * CELL, ((i / CW) | 0) * CELL, CELL, CELL);
      G.ctx.fill();
    }
  }
}

// The props (pass 3), their drips and the theme's ambience (grit, dust devils, spore clouds,
// noise rings). Fills in F.TH (the floor's theme) and F.onView (is a point in view, give or
// take a margin) for the parts after it
export function drawProps(W, G, F) {
  const { vw, vh } = F;
  // the props (pass 3), their drips and the theme's ambience
  const TH = F.TH = themeFor(W.floor);
  F.onView = (x, y, m) => x > W.camX - m && x < W.camX + vw + m && y > W.camY - m && y < W.camY + vh + m;
  for (const pr of W.props)
    if (pr.x + pr.r > W.camX - 70 && pr.x + pr.l < W.camX + vw + 70 && pr.y + pr.b > W.camY - 90 && pr.y + pr.t0 < W.camY + vh + 90)
      drawProp(G.ctx, pr, W.time, TH);
  for (const q of W.dparts) {
    if (q.glow) continue;
    G.ctx.globalAlpha = Math.min(1, q.life / q.max * 3);
    G.ctx.fillStyle = q.c; G.ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
  }
  G.ctx.lineWidth = 0.8;
  for (const q of W.amb) {
    if (q.glow) continue;
    G.ctx.globalAlpha = Math.min(1, q.life);
    if (q.streak) {
      G.ctx.strokeStyle = q.c; G.ctx.beginPath();
      G.ctx.moveTo(q.x - Math.sign(q.vx) * q.streak, q.y); G.ctx.lineTo(q.x, q.y); G.ctx.stroke();
    } else { G.ctx.fillStyle = q.c; G.ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
  }
  G.ctx.fillStyle = rgbA(mix(TH.rock[1], [255, 255, 255], 0.2));
  for (const dv of W.devils) {                          // a dust devil: a funnel of grit
    G.ctx.globalAlpha = 0.7 * Math.min(1, dv.life / 1.5, (dv.max - dv.life) / 1);
    for (let k = 0; k < 24; k++) {
      const hh = k / 24 * 30, r = 1.5 + hh * 0.35, a = W.time * 10 + k * 1.1;
      G.ctx.fillRect(dv.x + Math.cos(a) * r + Math.sin(W.time * 3 + k) - 0.6, dv.y - hh - 0.6, 1.2, 1.2);
    }
  }
  for (const cl of W.clouds) {                          // a burst pod's spore cloud
    const a = Math.min(1, cl.life / 1.5) * 0.28;
    for (let k = 0; k < 5; k++) {
      const ang = k * 1.26 + W.time * 0.6, rr = cl.r * 0.45;
      G.ctx.globalAlpha = a; G.ctx.fillStyle = '#a8d85a';
      G.ctx.beginPath(); G.ctx.arc(cl.x + Math.cos(ang) * rr, cl.y + Math.sin(ang) * rr * 0.7, cl.r * 0.6, 0, 6.29); G.ctx.fill();
    }
  }
  for (const rg of W.rings) {                           // a noise going out
    G.ctx.globalAlpha = 1 - rg.t / 0.9; G.ctx.strokeStyle = '#f0e6ff'; G.ctx.lineWidth = 1.2;
    G.ctx.beginPath(); G.ctx.arc(rg.x, rg.y, 8 + rg.t * 140, 0, 6.29); G.ctx.stroke();
  }
  G.ctx.globalAlpha = 1;
}

// The exit portal
export function drawPortal(W, G) {
  // exit portal: a glowing pool with a slow swirl of dashes round its rim
  const pulse = 0.55 + 0.25 * Math.sin(W.time * 3);
  const pcxE = W.portal.x + W.portal.w / 2, pcyE = W.portal.y + W.portal.h / 2;
  G.ctx.globalAlpha = pulse * 0.35;
  G.ctx.fillStyle = COL.portal;
  G.ctx.beginPath(); G.ctx.ellipse(pcxE, pcyE, W.portal.w, W.portal.h * 0.75, 0, 0, Math.PI * 2); G.ctx.fill();
  G.ctx.globalAlpha = pulse;
  G.ctx.beginPath(); G.ctx.ellipse(pcxE, pcyE, W.portal.w / 2, W.portal.h / 2, 0, 0, Math.PI * 2); G.ctx.fill();
  G.ctx.globalAlpha = 0.9;
  G.ctx.fillStyle = '#d8fff0';
  G.ctx.beginPath(); G.ctx.ellipse(pcxE, pcyE, W.portal.w * 0.22, W.portal.h * 0.26, 0, 0, Math.PI * 2); G.ctx.fill();
  G.ctx.globalAlpha = 0.6;
  G.ctx.strokeStyle = '#c8ffe4'; G.ctx.lineWidth = 1.2;
  G.ctx.setLineDash([3, 5]); G.ctx.lineDashOffset = W.time * 12;
  G.ctx.beginPath(); G.ctx.ellipse(pcxE, pcyE, W.portal.w * 0.62, W.portal.h * 0.6, 0, 0, Math.PI * 2); G.ctx.stroke();
  G.ctx.setLineDash([]);
  G.ctx.globalAlpha = 1;
}
