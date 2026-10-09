// @ts-check
// CaveRunner Auto's hub, painted (auto/hub.js steps it; titledraw.js calls these when S.hub). The looks are the
// old shop's, ported to plain arguments: the machines (render/shops.js drawShops: the cabinet, the hologram
// in the machine's hue, a crystal slot and chase lights on the crystal machines), the teleporter pads
// (render/pads.js drawPad, drawPads: the beam, the charge, the flash, the lightning), the ceiling tubes
// (render/shoplights.js drawTubes: the fixture, the stuttering tube, its cone and pool). Three passes:
// hubBack (before the dark), hubLight (what the tubes and the pads cut out of the dark) and hubGlow (added light).
// Stage 3b: each machine's asking price on its coin panel (drawPrice: the blocky font, art/pixfont.js, as main's
// vending machines), the exit pad's flash (hubExit), and over the exit pad the "Tap A" hint (drawHint: main's machine
// hint, the green-edged panel, ui's .pickpanel, ported to the canvas).
// Hashes of time only, never Math.random.

import { gunArtCanvas } from '../../art/gunart.js';
import { PH } from '../../core/consts.js';
import { pixText, pixWidth } from '../../art/pixfont.js';
import { HUB_EXO_GLYPHS, HUB_EXO_T, HUB_MACHINES, HUB_STOPS, HUB_ZAP, hubAtExit, hubCharge, hubExitFlash, hubPrice, hubState, hubTube } from '../../auto/hub.js';
import { drawBolt } from './looks.js';

const MW = 56, MH = 84;                     // a machine's cabinet (render/shops.js: MACHINE_W, MACHINE_H)
const PAD_W = 30, BEAM_H = 64;              // the pads (render/pads.js)
const TUBE_W = 40;                          // a tube (render/shoplights.js)
const ICON = 30, GLOW = 8, RES = 4;         // the hologram
const SHOP_GUN_ART = 'blueraider';
/** @param {number} n */
const hs = n => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

/** @type {Map<string, HTMLCanvasElement>} */
const cache = new Map();
// the icon as a hologram (render/shops.js holoIcon): washed in the hue, scan lines through it, a glow
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
  if (im) {
    const k = ICON * RES / im.width;
    a.imageSmoothingEnabled = false;
    a.drawImage(im, (S - im.width * k) / 2, (S - im.height * k) / 2, im.width * k, im.height * k);
  } else {
    a.fillStyle = '#ffffff';
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

// One machine at cx on the floor fy (render/shops.js drawShops, idle)
/** @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} fy @param {{ hue: string, icon: string, takes?: string }} m @param {number} t */
export function drawMachine(ctx, cx, fy, m, t) {
  const x = cx - MW / 2, y = fy - MH;
  ctx.save();
  ctx.fillStyle = '#171a21'; ctx.fillRect(x, y, MW, MH);
  ctx.fillStyle = '#252a35'; ctx.fillRect(x, y, 5, MH); ctx.fillRect(x + MW - 5, y, 5, MH);
  ctx.fillStyle = '#323948'; ctx.fillRect(x - 2, y - 1, MW + 4, 5); ctx.fillRect(x - 3, fy - 5, MW + 6, 5);
  ctx.fillStyle = m.hue; ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 3 + cx);
  ctx.fillRect(x + 5, y + 6, 1, MH - 14); ctx.fillRect(x + MW - 6, y + 6, 1, MH - 14);
  ctx.globalAlpha = 1;
  const gx = x + 8, gy = y + 7, gw = MW - 16, gh = 42;
  ctx.fillStyle = '#05070a'; ctx.fillRect(gx, gy, gw, gh);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath(); ctx.moveTo(gx + gw * 0.55, gy); ctx.lineTo(gx + gw, gy); ctx.lineTo(gx + gw, gy + gh * 0.35); ctx.closePath(); ctx.fill();
  const py = gy + gh + 3;
  ctx.fillStyle = '#2a303c'; ctx.fillRect(x + 10, py, MW - 20, 2);
  ctx.fillStyle = m.hue; ctx.globalAlpha = 0.85; ctx.fillRect(x + 12, py + 0.5, MW - 24, 1); ctx.globalAlpha = 1;
  const cy = fy - 22;
  ctx.fillStyle = '#0a0c10'; ctx.fillRect(x + 12, cy, MW - 24, 12);
  ctx.fillStyle = '#2c323e'; ctx.fillRect(x + 12, cy, MW - 24, 3);
  ctx.fillStyle = m.hue; ctx.globalAlpha = 0.35; ctx.fillRect(x + 12, cy + 11, MW - 24, 1); ctx.globalAlpha = 1;
  // the hologram: a beam up from the emitter, the icon flickering in front of the glass (the exo machine's: its glyphs in turn)
  const icon = m.icon === 'exo' ? HUB_EXO_GLYPHS[Math.floor(t / HUB_EXO_T) % HUB_EXO_GLYPHS.length] : m.icon;
  const f = Math.floor(t * 14) + cx;
  const drop = hs(f) < 0.07, jit = hs(f * 1.3) < 0.1 ? (hs(f * 2.1) - 0.5) * 3 : 0;
  const alpha = drop ? 0.25 : 0.82 + 0.15 * hs(f * 0.7);
  const ix = cx - ICON / 2, iy = gy + (gh - ICON) / 2 - 2;
  ctx.globalAlpha = alpha * 0.12; ctx.fillStyle = m.hue;
  ctx.beginPath(); ctx.moveTo(x + 14, py); ctx.lineTo(x + MW - 14, py); ctx.lineTo(ix + ICON, iy + ICON); ctx.lineTo(ix, iy + ICON); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.drawImage(holoIcon(icon, m.hue), ix - GLOW + jit, iy - GLOW + Math.sin(t * 2) * 1.2, ICON + GLOW * 2, ICON + GLOW * 2);
  const band = iy + ((t * 16 + cx) % (ICON + 16)) - 8;
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * 0.2;
  ctx.fillRect(ix, Math.max(iy, band), ICON, Math.max(0, Math.min(5, iy + ICON - band)));
  ctx.globalCompositeOperation = 'source-over';
  if (m.takes) {
    const col = m.takes === 'green' ? '#3dff7a' : '#ff3a4a', sy = y + 52;
    ctx.globalAlpha = 1; ctx.fillStyle = '#05070a'; ctx.fillRect(cx - 7, sy - 2, 14, 4);
    ctx.fillStyle = col; ctx.globalAlpha = 0.55 + 0.3 * Math.sin(t * 4 + cx); ctx.fillRect(cx - 8, sy - 3, 16, 1); ctx.fillRect(cx - 8, sy + 2, 16, 1);
    const N = 8, pos = t * 1.5;
    for (let i = 0; i < N; i++) {
      const lit = Math.max(0.15, 1 - ((pos - i) % N + N) % N * 0.45);
      ctx.globalAlpha = lit; ctx.fillStyle = lit > 0.5 ? '#ffffff' : col;
      ctx.fillRect(x + 4 + i * (MW - 8) / N + 1, y, 3, 2);
    }
  }
  ctx.restore();
}

// A teleporter platform at x on the floor fy (render/pads.js drawPad)
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} fy @param {number} time */
export function drawHubPad(ctx, x, fy, time) {
  const w = PAD_W, l = x - w / 2;
  ctx.fillStyle = '#1c2230';
  ctx.beginPath(); ctx.moveTo(l - 3, fy + 4); ctx.lineTo(l, fy - 2); ctx.lineTo(l + w, fy - 2); ctx.lineTo(l + w + 3, fy + 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3a4458'; ctx.fillRect(l, fy - 2, w, 1);
  ctx.fillStyle = '#5a6880'; ctx.fillRect(l + 1, fy - 2, w - 2, 0.6);
  const p = 0.75 + 0.25 * Math.sin(time * 3);
  ctx.fillStyle = 'rgba(120,210,255,' + p.toFixed(3) + ')';
  ctx.fillRect(l + 3, fy - 1, w - 6, 1.2);
  ctx.fillStyle = '#e8f7ff'; ctx.fillRect(l + 6, fy - 0.8, w - 12, 0.6);
  for (let i = 0; i < 4; i++) {
    const on = Math.floor(time * 4) % 4 === i;
    ctx.fillStyle = on ? '#9fe2ff' : '#2e4a66';
    ctx.fillRect(l + 5 + i * (w - 10) / 3 - 0.75, fy + 1.4, 1.5, 1);
  }
}

// Before the dark: the tube fixtures, the pads, the machines
/** @param {CanvasRenderingContext2D} ctx @param {import('../../art/titlescene.js').TitleScene} S */
export function hubBack(ctx, S) {
  const H = hubState(S);
  if (!H) return;
  const t = S.t;
  HUB_STOPS.forEach((st, i) => {
    const lv = hubTube(S, i), y = H.roof;
    ctx.fillStyle = '#20242c'; ctx.fillRect(st.x - TUBE_W / 2 - 3, y, TUBE_W + 6, 3);
    ctx.fillStyle = '#3a404c'; ctx.fillRect(st.x - TUBE_W / 2 - 3, y + 3, 2, 2); ctx.fillRect(st.x + TUBE_W / 2 + 1, y + 3, 2, 2);
    ctx.fillStyle = lv > 0.2 ? `rgb(${Math.round(150 + 105 * lv)},${Math.round(165 + 90 * lv)},${Math.round(180 + 75 * lv)})` : '#363b44';
    ctx.fillRect(st.x - TUBE_W / 2, y + 3, TUBE_W, 2);
    if (H.on[i] >= 0 && lv <= 0.2) {
      ctx.fillStyle = 'rgba(255,170,190,0.8)';
      ctx.fillRect(st.x - TUBE_W / 2, y + 3, 3, 2); ctx.fillRect(st.x + TUBE_W / 2 - 3, y + 3, 3, 2);
    }
    if (st.id === 'enter' || st.id === 'exit') drawHubPad(ctx, st.x, H.fy, t + i);
    else { drawMachine(ctx, st.x, H.fy, HUB_MACHINES[st.id], t); drawPrice(ctx, st.x, H.fy, hubPrice(st.id, H.tier), t); }
  });
}

// What lights the room (cut out of the dark: titledraw.js titleDark): each tube's pool as far as it's on, and the
// pads' blue (the enter pad's swelling as it charges)
/** @param {import('../../art/titlescene.js').TitleScene} S @param {(x: number, y: number, r: number, a: number, full?: number) => void} pool */
export function hubLight(S, pool) {
  const H = hubState(S);
  if (!H) return;
  const { ch, fl } = hubCharge(S);
  HUB_STOPS.forEach((st, i) => {
    const lv = hubTube(S, i);
    if (lv > 0) { pool(st.x, H.fy - 40, 70, lv, 0.45); pool(st.x, H.roof + 8, 30, lv * 0.8, 0.3); }
    if (st.id === 'enter' || st.id === 'exit') {
      const f = st.id === 'enter' ? fl : hubExitFlash(S);
      const a = st.id === 'enter' ? 0.35 + 0.6 * ch * ch + 0.6 * fl : 0.3 + 0.6 * f;
      pool(st.x, H.fy - 16, 34 + 30 * f, Math.min(1, a), 0.2);
    }
  });
}

// Added light, after the dark: the tubes' halos, cones and pools; the pads' beams, the charge, the flash, the lightning
/** @param {CanvasRenderingContext2D} ctx @param {import('../../art/titlescene.js').TitleScene} S */
export function hubGlow(ctx, S) {
  const H = hubState(S);
  if (!H) return;
  const t = S.t, fy = H.fy;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  HUB_STOPS.forEach((st, i) => {
    const lv = hubTube(S, i), x = st.x, y = H.roof + 1;
    if (lv > 0.2) {
      const halo = ctx.createRadialGradient(x, y + 4, 2, x, y + 4, 34);
      halo.addColorStop(0, `rgba(210,235,255,${0.32 * lv})`); halo.addColorStop(1, 'rgba(210,235,255,0)');
      ctx.fillStyle = halo; ctx.fillRect(x - 36, y - 2, 72, 40);
      const cone = ctx.createLinearGradient(0, y + 5, 0, fy);
      cone.addColorStop(0, `rgba(200,230,255,${0.2 * lv})`); cone.addColorStop(1, `rgba(200,230,255,${0.04 * lv})`);
      ctx.fillStyle = cone;
      ctx.beginPath(); ctx.moveTo(x - TUBE_W / 2, y + 5); ctx.lineTo(x + TUBE_W / 2, y + 5);
      ctx.lineTo(x + TUBE_W / 2 + 26, fy); ctx.lineTo(x - TUBE_W / 2 - 26, fy); ctx.closePath(); ctx.fill();
      const pl = ctx.createRadialGradient(x, fy, 2, x, fy, TUBE_W / 2 + 26);
      pl.addColorStop(0, `rgba(210,235,255,${0.22 * lv})`); pl.addColorStop(1, 'rgba(210,235,255,0)');
      ctx.fillStyle = pl; ctx.beginPath(); ctx.ellipse(x, fy, TUBE_W / 2 + 26, 7, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (st.id === 'enter' || st.id === 'exit') padGlow(ctx, S, x, fy, i, st.id === 'enter' ? hubCharge(S) : { ch: 0, fl: hubExitFlash(S) }, st.id === 'enter' ? H.zap : H.exitT);
  });
  ctx.restore();
  // the leader at the exit pad: "Tap A" over it (not while it flashes)
  if (hubAtExit(S) && hubExitFlash(S) <= 0) drawHint(ctx, HUB_STOPS[HUB_STOPS.length - 1].x, fy - PH - 8, 'Tap A to exit', t);
}

// one pad's light (render/pads.js drawPads)
/** @param {CanvasRenderingContext2D} ctx @param {import('../../art/titlescene.js').TitleScene} S @param {number} x @param {number} y @param {number} seed @param {{ ch: number, fl: number }} c @param {number} zapAt */
function padGlow(ctx, S, x, y, seed, c, zapAt) {
  const t = S.t, { ch, fl } = c;
  const pulse = (0.85 + 0.15 * Math.sin(t * (2.4 + 30 * ch * ch) + seed)) * (1 + 2.2 * ch * ch);
  if (ch > 0) {
    for (let i = 0; i < 18; i++) {
      const u = (hs(i * 5.1) + t * (0.8 + 2.2 * ch)) % 1, ang = hs(i * 2.3) * 6.283 + u * 3;
      const r = (1 - u) * (26 + 30 * hs(i * 9.7)), sx = x + Math.cos(ang) * r, sy = y - 14 + Math.sin(ang) * r * 0.75;
      ctx.globalAlpha = Math.min(1, u * 3) * (0.4 + 0.6 * ch);
      ctx.fillStyle = hs(i * 1.7) < 0.4 ? '#e6f6ff' : '#6cc4ff';
      ctx.fillRect(sx - 0.7, sy - 0.7, 1.4, 1.4);
    }
    ctx.globalAlpha = 1;
    const cg = ctx.createRadialGradient(x, y - 12, 0, x, y - 12, 8 + 10 * ch);
    cg.addColorStop(0, 'rgba(220,245,255,' + (0.5 * ch * ch).toFixed(3) + ')'); cg.addColorStop(1, 'rgba(90,185,255,0)');
    ctx.fillStyle = cg; ctx.fillRect(x - 20, y - 32, 40, 40);
  }
  if (fl > 0) {
    const fg = ctx.createRadialGradient(x, y - 12, 0, x, y - 12, 70);
    fg.addColorStop(0, 'rgba(235,250,255,' + (0.95 * fl).toFixed(3) + ')'); fg.addColorStop(0.4, 'rgba(120,200,255,' + (0.45 * fl).toFixed(3) + ')');
    fg.addColorStop(1, 'rgba(90,185,255,0)');
    ctx.fillStyle = fg; ctx.fillRect(x - 70, y - 82, 140, 140);
    ctx.fillStyle = 'rgba(235,250,255,' + (0.8 * fl * fl).toFixed(3) + ')';
    ctx.fillRect(x - 7 * fl - 2, y - BEAM_H * 1.6, 14 * fl + 4, BEAM_H * 1.6);
  }
  for (const [wf, a, hf] of [[0.95, 0.16, 1], [0.66, 0.2, 0.8], [0.34, 0.28, 0.6]]) {
    const h = BEAM_H * hf, g = ctx.createLinearGradient(0, y, 0, y - h);
    g.addColorStop(0, 'rgba(90,185,255,' + (a * pulse).toFixed(3) + ')');
    g.addColorStop(0.5, 'rgba(70,150,255,' + (a * 0.35 * pulse).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(60,120,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - PAD_W * wf / 2, y - h, PAD_W * wf, h);
  }
  const fg = ctx.createRadialGradient(x, y, 0, x, y, PAD_W);
  fg.addColorStop(0, 'rgba(90,185,255,' + (0.25 * pulse).toFixed(3) + ')'); fg.addColorStop(1, 'rgba(90,185,255,0)');
  ctx.fillStyle = fg; ctx.fillRect(x - PAD_W, y - PAD_W, PAD_W * 2, PAD_W * 2);
  for (let i = 0; i < 10; i++) {
    const sp = 14 + hs(i * 3 + seed) * 22, u = ((t * sp / BEAM_H) + hs(i * 7 + seed * 13)) % 1;
    const sx = x + (hs(i * 11 + seed) - 0.5) * PAD_W * 0.8 + Math.sin(t * 2 + i) * 1.2;
    ctx.globalAlpha = (1 - u) * 0.8;
    ctx.fillStyle = hs(i + seed * 5) < 0.4 ? '#e6f6ff' : '#6cc4ff';
    ctx.fillRect(sx - 0.6, y - 2 - u * BEAM_H * 0.9, 1.2, 1.2);
  }
  ctx.globalAlpha = 1;
  // lightning for HUB_ZAP after someone comes through (none while it charges, as on main)
  const zap = 1 - (t - zapAt) / HUB_ZAP;
  if (zap <= 0 || zap > 1) return;
  /** @type {any} */
  const G = { ctx };
  const BT = 0.09, n0 = Math.floor(t / BT), z = zap;
  for (let n = n0 - 2; n <= n0; n++) {
    const s = n * 7.13 + seed * 101;
    if (hs(s) > (0.35 + 0.65 * z) * 0.8 * (fl > 0 ? 1.25 : 1)) continue;
    const age = (t - n * BT) / (BT * 3);
    let bx = x + (hs(s + 1) - 0.5) * (PAD_W - 6), by = y - 1;
    const up = BEAM_H * (0.3 + 0.5 * hs(s + 2)), steps = 6;
    const pts = [{ x: bx, y: by }];
    for (let k = 1; k <= steps; k++) {
      bx += (hs(s + 3 + k) - 0.5) * 7; by -= up / steps;
      bx = Math.max(x - PAD_W / 2, Math.min(x + PAD_W / 2, bx));
      pts.push({ x: bx, y: by });
    }
    drawBolt(G, pts, '#7cc8ff', 0.9, Math.max(0, 1 - age));
  }
}

// a gem (the crystal machines' price): a small cut diamond, lit top left
/** @param {CanvasRenderingContext2D} ctx @param {number} x its middle @param {number} y @param {number} r @param {string} col */
function drawGem(ctx, x, y, r, col) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
}

const PRICE_COL = { gold: '#ffc93c', red: '#ff4f5e', green: '#5ee05a' };
// A machine's price on its coin panel (fy - 22, 12 high): "120 G." in gold, or "1" and a gem in the gem's colour, in the
// terminal font (main's vend.js: pixText, bold), shrunk to fit, with a faint glow
/** @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} fy @param {{ n: number, kind: 'gold' | 'red' | 'green' } | null} p @param {number} t */
export function drawPrice(ctx, cx, fy, p, t) {
  if (!p) return;
  const s = p.kind === 'gold' ? String(p.n).replace(/B(?=(d{3})+(?!d))/g, ',') + ' G.' : String(p.n);
  const gem = p.kind === 'gold' ? 0 : 5, B = 0.5, room = MW - 26;
  const px = Math.min(0.9, (room - gem) / Math.max(1, pixWidth(s, 1, B))), ph = px * 1.3;
  const w = pixWidth(s, px, B) + gem, x0 = cx - w / 2, base = fy - 22 + 6 + 3.5 * ph;
  const col = PRICE_COL[p.kind];
  ctx.save();
  ctx.shadowColor = col; ctx.shadowBlur = 3;
  ctx.globalAlpha = 0.9 + 0.1 * Math.sin(t * 5 + cx);
  ctx.fillStyle = col;
  pixText(ctx, s, x0, base, px, ph, B, 8);
  ctx.shadowBlur = 0;
  if (gem) drawGem(ctx, x0 + w - 2, fy - 22 + 6.5, 2.2, col);
  ctx.restore();
}

// main's machine hint (ui .buypanel.pickpanel: a dark see-through panel, a green edge, the key in a thin white ring,
// the words in bold green) at x, its bottom at y, gently bobbing
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {string} text @param {number} t */
export function drawHint(ctx, x, y, text, t) {
  ctx.save();
  ctx.font = '700 6px system-ui, sans-serif';
  const tw = ctx.measureText(text).width, kr = 3.6, w = tw + kr * 2 + 10, h = 12;
  const l = x - w / 2, top = y - h + Math.sin(t * 3) * 0.6;
  ctx.fillStyle = 'rgba(18,20,26,0.55)'; ctx.strokeStyle = '#00ff3c'; ctx.lineWidth = 0.5;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(l, top, w, h, 3); else ctx.rect(l, top, w, h);
  ctx.fill(); ctx.stroke();
  const ky = top + h / 2;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(l + 4 + kr, ky, kr, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 4.6px system-ui, sans-serif'; ctx.fillText('A', l + 4 + kr, ky + 0.2);
  ctx.fillStyle = '#00ff3c'; ctx.textAlign = 'left';
  ctx.font = '700 6px system-ui, sans-serif'; ctx.fillText(text, l + 7 + kr * 2, ky + 0.3);
  ctx.restore();
}
