// @ts-check
// The title's Grem lines (owner, grem branch v2.0.0), under CAVE RUNNER (art/titlescene.js titleText): AUTO, black pixel letters
// on silver blocks, left-aligned under RUNNER, now and then glitching (slices thrown sideways, a red / cyan split, a block
// flipped dark); and GREM MODE, big bold green letters on a slant across the middle, each swelling in turn. Behind GREM MODE:
// green goo drips off its letters (the old game's jellyfish spit drops: a glob, its edge and shine, jellyPal's colours), the
// jellyfish's luminescent spores drifting behind those, and a soft light green glow pulsing behind it all.
// Drawn over the title's scene each frame (ui/title.js, runScene's over); its drips and spores live in a GremTitle state.

import { jellyPal } from '../creatures/jelly.js';
import { pixText, pixWidth } from './pixfont.js';

/** @typedef {{ x: number, y: number, vy: number, r: number, r0: number, hang: number, age: number, c: string }} GremDrip */
/** @typedef {{ x: number, y: number, vx: number, vy: number, r: number, life: number, max: number, wob: number }} GremSpore */
/** @typedef {{ drips: GremDrip[], spores: GremSpore[], t: number, dripAcc: number, sporeAcc: number }} GremTitle */

export const GREM_SLANT = -8 * Math.PI / 180;   // GREM MODE's slant (rising to the right)
const WORD = 'GREM MODE';
const AUTO = 'AUTO';
const DRIP_RATE = 10;      // drips a second, off the letters
const SPORE_RATE = 9;     // spores a second, round the words
const DRIP_MAX = 60, SPORE_MAX = 110;
const DRIP_FALL = 0.6;    // (s) a drip falls this long, fading at the end: it stays near the words

/** a fresh state for the title's drips and spores @returns {GremTitle} */
export const gremTitleNew = () => ({ drips: [], spores: [], t: -1, dripAcc: 0, sporeAcc: 0 });

// the block's layout for a screen cw wide under a title of pixel size px: AUTO's pixel size, its blocks' height, GREM MODE's
// pixel size, its width, its middle (y from the block's top) and the block's whole height
/** @param {number} cw @param {number} px */
export function gremLayout(cw, px) {
  const apx = Math.max(3, Math.round(px * 0.5)), th = 9 * apx;
  const gpx = Math.max(3, Math.floor(Math.min(cw * 0.86 / pixWidth(WORD, 1, 0), px * 0.85)));   // (not bold: bold fills M's gaps, it read as H)
  const gw = pixWidth(WORD, gpx, 0), rise = Math.abs(Math.sin(GREM_SLANT)) * gw;
  const cy = th + 6 * gpx + rise * 0.15;
  return { apx, th, gpx, gw, cy, h: cy + rise / 2 + 2 * gpx };
}

// a number 0-1 from an integer (the glitch's dice: the same t, the same glitch)
/** @param {number} n */
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/**
 * @param {CanvasRenderingContext2D} ctx @param {GremTitle} G @param {number} t the scene's clock (s)
 * @param {number} cw css width @param {number} y0 the block's top (css px) @param {number} left AUTO's left (RUNNER's left) @param {number} px the title's pixel size
 */
export function gremTitleDraw(ctx, G, t, cw, y0, left, px) {
  const L = gremLayout(cw, px);
  const dt = G.t < 0 ? 0 : Math.max(0, Math.min(0.05, t - G.t));
  G.t = t;
  const P = jellyPal(0.5);
  const cx = cw / 2, cy = y0 + L.cy, cs = Math.cos(GREM_SLANT), sn = Math.sin(GREM_SLANT);
  // a point along the slanted word: u across it (css px from its middle), v down from its baseline
  /** @param {number} u @param {number} v */
  const at = (u, v) => ({ x: cx + u * cs - v * sn, y: cy + u * sn + v * cs });
  // the letters' spans along the word (u from its left end)
  const spans = [];
  let u = -L.gw / 2;
  for (const ch of WORD) { const w = pixWidth(ch, L.gpx, 0); if (ch !== ' ') spans.push({ ch, u, w }); u += w + L.gpx; }

  // ---- the glow: soft light green, pulsing, behind everything ----
  const pulse = 0.75 + 0.25 * Math.sin(t * 2.2);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(cx, cy - 3 * L.gpx); ctx.rotate(GREM_SLANT);
  const ry = L.gpx * 11 * (0.92 + 0.08 * pulse);
  ctx.scale(L.gw * 0.62 / ry, 1);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
  g.addColorStop(0, 'rgba(150,255,150,' + (0.34 * pulse).toFixed(3) + ')');
  g.addColorStop(0.5, 'rgba(90,230,110,' + (0.14 * pulse).toFixed(3) + ')');
  g.addColorStop(1, 'rgba(60,200,90,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, ry, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // ---- the spores: drifting up round the words, fading in and out ----
  for (G.sporeAcc += SPORE_RATE * dt; G.sporeAcc >= 1; G.sporeAcc--) {
    if (G.spores.length >= SPORE_MAX) break;
    const p = at((Math.random() - 0.5) * L.gw * 1.15, (Math.random() - 0.7) * L.gpx * 14), life = 3 + Math.random() * 3;
    G.spores.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 10, vy: -4 - Math.random() * 9, r: 1 + Math.random() * 1.3, life, max: life, wob: Math.random() * 9 });
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = G.spores.length - 1; i >= 0; i--) {
    const s = G.spores[i];
    s.life -= dt;
    if (s.life <= 0) { G.spores.splice(i, 1); continue; }
    s.x += (s.vx + Math.sin(t * 1.7 + s.wob) * 4) * dt; s.y += s.vy * dt;
    const a = Math.sin(Math.PI * s.life / s.max);
    const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
    gr.addColorStop(0, 'rgba(200,255,170,' + (0.9 * a).toFixed(3) + ')');
    gr.addColorStop(0.3, 'rgba(110,255,90,' + (0.45 * a).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(110,255,90,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(s.x - s.r * 4, s.y - s.r * 4, s.r * 8, s.r * 8);
  }
  ctx.restore();

  // ---- the drips: goo gathering under a letter, then falling ----
  for (G.dripAcc += DRIP_RATE * dt; G.dripAcc >= 1; G.dripAcc--) {
    if (G.drips.length >= DRIP_MAX || !spans.length) break;
    const sp = spans[Math.floor(Math.random() * spans.length)];
    const p = at(sp.u + L.gpx * 0.5 + Math.random() * (sp.w - L.gpx), -L.gpx * 0.6);
    const r0 = L.gpx * (0.45 + Math.random() * 0.4);
    G.drips.push({ x: p.x, y: p.y, vy: 0, r: 0, r0, hang: 0.4 + Math.random() * 0.8, age: 0, c: Math.random() < 0.35 ? P.drip2 : P.drip });
  }
  for (let i = G.drips.length - 1; i >= 0; i--) {
    const d = G.drips[i];
    d.age += dt;
    if (d.age < d.hang) d.r = d.r0 * Math.min(1, d.age / d.hang * 1.3);   // gathering
    else { d.vy += 520 * dt; d.y += d.vy * dt; }                          // falling
    if (d.age > d.hang + DRIP_FALL) { G.drips.splice(i, 1); continue; }
    const fade = Math.min(1, (d.hang + DRIP_FALL - d.age) / 0.3), st = 1 + Math.min(1.2, d.vy / 260);   // stretched as it speeds up
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(d.x, d.y);
    ctx.fillStyle = P.spitEdge;
    ctx.beginPath(); ctx.ellipse(0, 0, d.r * 1.25 / Math.sqrt(st), d.r * 1.25 * st, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = d.c;
    ctx.beginPath(); ctx.ellipse(0, -d.r * 0.08, d.r / Math.sqrt(st), d.r * st, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.spitShine;
    ctx.beginPath(); ctx.arc(d.r * 0.3, -d.r * 0.3 * st, d.r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ---- GREM MODE: big bold green letters on the slant, each swelling in turn ----
  spans.forEach((sp, i) => {
    const ph = ((t * 0.8 - i * 0.07) % 1 + 1) % 1, amp = ph < 0.25 ? Math.sin(ph / 0.25 * Math.PI) : 0, k = 1 + 0.2 * amp;
    const m = at(sp.u + sp.w / 2, -3.5 * L.gpx);
    ctx.save();
    ctx.translate(m.x, m.y); ctx.rotate(GREM_SLANT); ctx.scale(k, k);
    const x = -sp.w / 2, y = 3.5 * L.gpx, gp = L.gpx;
    for (let e = Math.ceil(gp * 0.9); e > 0; e--) {   // the extrusion, down-right
      ctx.fillStyle = e > gp * 0.45 ? '#04200b' : '#0b4a1a';
      pixText(ctx, sp.ch, x + e * 0.5, y + e, gp, gp, 0, 8);
    }
    const fg = ctx.createLinearGradient(0, y - 7 * gp, 0, y);
    fg.addColorStop(0, '#f2ffd8'); fg.addColorStop(0.35, '#9dff5c'); fg.addColorStop(0.7, '#36dc4c'); fg.addColorStop(1, '#0f9a2e');
    ctx.shadowColor = 'rgba(90,255,110,' + (0.7 + 0.3 * amp).toFixed(2) + ')'; ctx.shadowBlur = gp * (2 + 2 * amp);
    ctx.fillStyle = fg;
    pixText(ctx, sp.ch, x, y, gp, gp, 0, 8);
    ctx.restore();
  });

  // ---- AUTO: black letters on silver blocks, glitching now and then ----
  const cyc = Math.floor(t / 2.6), start = cyc * 2.6 + hash(cyc) * 2, glitch = t >= start && t < start + 0.18 + hash(cyc + 0.5) * 0.2;
  const f = Math.floor(t * 30);   // the glitch's frame: its dice change 30 times a second
  /** @param {number} dx */
  const drawAuto = dx => {
    let x = left + dx;
    [...AUTO].forEach((ch, i) => {
      const w = pixWidth(ch, L.apx, 1) + 2 * L.apx, h = L.th, jx = glitch && hash(f * 4 + i) < 0.3 ? (hash(f * 9 + i) - 0.5) * L.apx * 4 : 0;
      const dark = glitch && hash(f * 13 + i) < 0.15;   // a block flipped: dark with a silver letter
      const bx = x + jx, by = y0, rr = L.apx * 0.8;
      const sg = ctx.createLinearGradient(0, by, 0, by + h);
      if (dark) { sg.addColorStop(0, '#2a2e34'); sg.addColorStop(1, '#0c0d10'); }
      else { sg.addColorStop(0, '#f6f8fa'); sg.addColorStop(0.45, '#c6ccd3'); sg.addColorStop(0.55, '#aab2bc'); sg.addColorStop(1, '#7e8792'); }
      ctx.fillStyle = '#3c424a';   // the block's bevel underneath
      ctx.beginPath(); ctx.roundRect(bx, by + L.apx * 0.5, w, h, rr); ctx.fill();
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.roundRect(bx, by, w, h, rr); ctx.fill();
      ctx.fillStyle = dark ? '#d8dde3' : '#0b0c10';
      pixText(ctx, ch, bx + L.apx, by + 8 * L.apx, L.apx, L.apx, 1, 8);
      x += w + L.apx;
    });
  };
  if (!glitch) { drawAuto(0); return; }
  // glitching: a red and a cyan ghost either side, then the blocks in a few slices, each thrown sideways
  ctx.save();
  ctx.globalAlpha = 0.55; ctx.globalCompositeOperation = 'lighter';
  /** @type {[number, string][]} */
  const ghosts = [[-L.apx * 0.8, 'rgba(255,40,60,1)'], [L.apx * 0.8, 'rgba(40,230,255,1)']];
  for (const [off, col] of ghosts) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, y0 - L.apx, cw, L.th + 2 * L.apx); ctx.clip();
    ctx.fillStyle = col;
    let x = left + off;
    for (const ch of AUTO) { const w = pixWidth(ch, L.apx, 1) + 2 * L.apx; ctx.fillRect(x, y0, w, L.th); x += w + L.apx; }
    ctx.restore();
  }
  ctx.restore();
  const n = 3 + Math.floor(hash(f) * 3);
  for (let s = 0; s < n; s++) {
    const a = y0 + L.th * s / n, b = y0 + L.th * (s + 1) / n + (s === n - 1 ? L.apx : 0);
    ctx.save(); ctx.beginPath(); ctx.rect(0, a, cw, b - a); ctx.clip();
    drawAuto(hash(f * 7 + s) < 0.5 ? (hash(f * 3 + s) - 0.5) * L.apx * 6 : 0);
    ctx.restore();
  }
}
