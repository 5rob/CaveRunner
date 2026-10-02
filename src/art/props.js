// @ts-check
// Drawing the decoration props (drawProp, drawArch), their colours (propCol) and the
// light some of them give off after the fog (propGlow, eyesAlpha).

import { glowAt } from './sprites.js';
import { mix } from '../core/util.js';
import { hangRootX, hangRootY, swings, tent } from '../world/sway.js';

// ---- drawing the props ----
/** @type {(c: ArrayLike<number>, a?: number) => string} */
export const rgbA = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a == null ? 1 : a) + ')';
/** @type {(c: ArrayLike<number>) => string} */
export const rgbS = c => (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0);
// the colour a prop breaks into
/** @param {Prop} pr @param {Theme} T @returns {string} */
export function propCol(pr, T) {
  return { icicle: '#bfe6ff', icefall: '#bfe6ff', geode: '#c58cff', salt: '#e8e2cc', bone: '#e6dcc4',
    obsidian: '#4a3050', cart: '#8a5a3a', statue: rgbA(T.rock[1]), pillar: rgbA(T.brick[1]),
    monolith: rgbA(T.bg2), skulls: '#e6dcc4', stone: '#c58cff', shard: rgbA(T.moss[1]),
    chain: '#8a7a6a', lantern: '#ffb050', crystal: '#d6a0ff', lava: '#ff7a2a' }[pr.st] || rgbA(T.moss[1]);
}
// An arched vine (v87): a few twisted stems along the curve, swaying a little in the middle
// (never at the ends, which are held), thick with leaves. The strands hanging off it are
// ordinary vine props. While it burns, the burnt stretch (u0..u1) is gone.
/** @param {CanvasRenderingContext2D} ctx @param {Prop} pr @param {number} time @param {Theme} T */
export function drawArch(ctx, pr, time, T) {
  const A = pr.arc, n = A.length - 1, x = pr.x, y = pr.y;
  const col = pr.st === 'root' ? mix(T.moss[0], [200, 190, 160], 0.4) : T.moss[0];
  // the breeze, and the bend from you (world/sway.js: none at the ends)
  const pu = pr.wu == null ? 0.5 : pr.wu, wx = pr.wx || 0, wy = pr.wy || 0;
  const sway = k => Math.sin(time * 0.9 + pr.seed * 6 + k * 0.35) * 0.8 * Math.sin(Math.PI * k / n) + tent(k / n, pu) * wy;
  const bendX = k => tent(k / n, pu) * wx;
  const gone = k => pr.burn && k / n > pr.u0 && k / n < pr.u1;
  const fr = v => v - Math.floor(v);
  for (let s = 0; s < pr.thick; s++) {
    ctx.strokeStyle = rgbA(mix(col, [0, 0, 0], 0.18 * s));
    ctx.lineWidth = pr.st === 'root' ? 1.8 : 1.2;
    ctx.beginPath();
    let pen = false;
    for (let k = 0; k <= n; k++) {
      if (gone(k)) { pen = false; continue; }
      const tw = pr.thick > 1 ? Math.sin(k * 1.3 + s * 2.1 + pr.seed * 9) * 0.9 : 0;
      const px = x + A[k][0] + bendX(k), py = y + A[k][1] + sway(k) + tw;
      if (pen) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      pen = true;
    }
    ctx.stroke();
  }
  // leaves: several per segment, either side of the stems, hanging down a little
  ctx.fillStyle = rgbA(T.moss[1]);
  for (let k = 0; k < n; k++) {
    if (gone(k) || gone(k + 1)) continue;
    for (let j = 0; j < 3; j++) {
      const h = fr(Math.sin(k * 12.9898 + j * 78.233 + pr.seed * 437) * 43758.5);
      const t = (j + h) / 3, s = (k + j) % 2 ? 1 : -1;
      const lx = x + A[k][0] + (A[k + 1][0] - A[k][0]) * t + bendX(k + t);
      const ly = y + A[k][1] + (A[k + 1][1] - A[k][1]) * t + sway(k + t) + 1 + h * 1.5;
      ctx.beginPath();
      ctx.ellipse(lx + s * (1 + h), ly, 1.9, 0.9, s * (0.5 + h * 0.6), 0, 6.29); ctx.fill();
    }
  }
}
// One prop, in world units, before the fog. Anything that glows gets its light added after
// the fog in propGlow, so the light shows in the dark but the prop itself stays hidden.
/** @param {CanvasRenderingContext2D} ctx @param {Prop} pr @param {number} time @param {Theme} T */
export function drawProp(ctx, pr, time, T) {
  const x = pr.x, y = pr.y, st = pr.st;
  ctx.save();
  if (pr.shake > 0) ctx.translate(Math.sin(time * 90) * 0.8, 0);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const tri = (ax, ay, bx, by, cx, cy) => { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill(); };
  switch (pr.k) {
    case 'climb': {
      if (pr.arc) { drawArch(ctx, pr, time, T); break; }
      // swinging (and hung off an arch that's bending): the whole vine turned about its root
      if (swings(pr) && (pr.sw || pr.on)) {
        ctx.translate(x + hangRootX(pr), y + hangRootY(pr));
        if (pr.sw) ctx.rotate(-pr.sw);
        ctx.translate(-x, -y);
      }
      const len = pr.len, sw = st === 'kelp' ? 5 : st === 'chain' ? 0.8 : 1.6;
      const off = k => Math.sin(time * (st === 'kelp' ? 1.6 : 1.1) + pr.seed * 6 + k * 0.08) * sw * (k / len);
      if (st === 'icefall') {
        const x0 = pr.side < 0 ? x : x - 7;
        ctx.fillStyle = 'rgba(170,215,240,0.5)'; ctx.fillRect(x0, y - 4, 7, len + 4);
        ctx.strokeStyle = 'rgba(235,250,255,0.55)'; ctx.lineWidth = 0.8;
        for (let k = 0; k < 3; k++) { const lx = x0 + 1.5 + k * 2; ctx.beginPath(); ctx.moveTo(lx, y - 2); ctx.lineTo(lx + Math.sin(k + pr.seed * 9) * 0.8, y + len); ctx.stroke(); }
        ctx.fillStyle = 'rgba(190,230,255,0.75)';
        for (let k = 0; k < 3; k++) tri(x0 + k * 2.3, y + len, x0 + k * 2.3 + 2.3, y + len, x0 + k * 2.3 + 1.1, y + len + 3 + (k % 2) * 2);
        break;
      }
      if (st === 'chain') {
        ctx.strokeStyle = '#6f635a'; ctx.lineWidth = 0.9;
        for (let k = 0; k < len; k += 3.2) {
          const lx = x + off(k), vert = Math.round(k / 3.2) % 2 === 0;
          ctx.beginPath(); ctx.ellipse(lx, y + k + 1.6, vert ? 1 : 1.8, vert ? 2 : 1.1, 0, 0, 6.29); ctx.stroke();
        }
        break;
      }
      if (st === 'myc') {
        for (let s = -1; s <= 1; s++) {
          ctx.strokeStyle = rgbA(T.moss[1], 0.45 + 0.15 * s); ctx.lineWidth = 0.6;
          const l = len * (0.75 + 0.2 * Math.sin(s * 3 + pr.seed * 9));
          ctx.beginPath(); ctx.moveTo(x + s * 1.6, y);
          for (let k = 0; k <= l; k += 4) ctx.lineTo(x + s * 1.6 + off(k) + Math.sin(k * 0.3 + s) * 0.6, y + k);
          ctx.stroke();
          ctx.fillStyle = rgbA(T.moss[1], 0.8);
          ctx.beginPath(); ctx.arc(x + s * 1.6 + off(l), y + l, 1, 0, 6.29); ctx.fill();
        }
        break;
      }
      const col = st === 'root' ? mix(T.moss[0], [200, 190, 160], 0.4) : T.moss[0];
      ctx.strokeStyle = rgbA(col); ctx.lineWidth = st === 'root' ? 2.2 : st === 'kelp' ? 1.8 : 1.3;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k <= len; k += 3) ctx.lineTo(x + off(k) + (st === 'root' ? Math.sin(k * 0.4 + pr.seed * 5) * 0.8 : 0), y + k);
      ctx.stroke();
      ctx.fillStyle = rgbA(T.moss[1]);
      for (let k = 4, s = 1; k < len; k += st === 'kelp' ? 7 : 5, s = -s) {
        const lx = x + off(k);
        if (st === 'root') { ctx.fillRect(lx - 1.4, y + k, 2.8, 1.4); continue; }
        ctx.beginPath();
        ctx.ellipse(lx + s * 2, y + k, st === 'kelp' ? 3 : 1.8, 0.9, s * 0.5, 0, 6.29); ctx.fill();
      }
      break;
    }
    case 'drip': {
      if (st === 'steam') {                     // a pipe out of the wall
        const s = -pr.side, x0 = s > 0 ? x : x - 8;
        ctx.fillStyle = '#5a4a3e'; ctx.fillRect(x0, y - 2, 8, 4);
        ctx.fillStyle = '#7a6452'; ctx.fillRect(x0 + (s > 0 ? 6 : 0), y - 3, 2, 6);
        break;
      }
      if (st === 'sparks') {
        ctx.fillStyle = '#35333a'; ctx.fillRect(x - 3, y, 6, 4);
        ctx.strokeStyle = '#6a6a70'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(x + 1, y + 4); ctx.quadraticCurveTo(x + 3, y + 8, x + 1.5, y + 10); ctx.stroke();
        break;
      }
      if (st === 'crystal') {
        ctx.fillStyle = rgbA(T.moss[1], 0.9);
        tri(x - 2.5, y, x - 0.5, y, x - 1.5, y + 5); tri(x, y, x + 2.5, y, x + 1.2, y + 4);
        break;
      }
      const c = st === 'lava' ? [255, 110, 40] : st === 'soot' ? [22, 22, 26] : st === 'cascade' ? [140, 200, 255] : [120, 190, 255];
      ctx.fillStyle = rgbA(c, st === 'cascade' ? 0.8 : 0.85);
      if (st === 'cascade') { ctx.fillRect(x - 5, y, 10, 1.6); break; }
      const g = st === 'soot' ? 0 : ((pr.acc || 0) % 1);
      ctx.beginPath(); ctx.ellipse(x, y + 0.8 + g * 1.5, 1.2 + g * 0.5, 0.9 + g * 1.2, 0, 0, 6.29); ctx.fill();
      break;
    }
    case 'drop': {
      if (st === 'icicle') {
        ctx.fillStyle = 'rgba(190,230,255,0.9)'; tri(x - 3.5, y, x + 3.5, y, x + 0.3, y + 16);
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; tri(x - 1.8, y, x - 0.6, y, x - 0.2, y + 10);
      } else {
        ctx.fillStyle = rgbA(mix(T.rock[0], [0, 0, 0], 0.3)); ctx.beginPath(); ctx.ellipse(x, y + 1.5, 7, 3, 0, 0, 6.29); ctx.fill();
        const cs = [[-4.5, 8], [-1.5, 12], [1.8, 10], [4.6, 7]];
        cs.forEach(([dx, l], k) => { ctx.fillStyle = rgbA(k % 2 ? T.moss[1] : T.moss[0]); tri(x + dx - 1.8, y + 2, x + dx + 1.8, y + 2, x + dx, y + l); });
      }
      break;
    }
    case 'spike': {
      if (pr.hang) { ctx.translate(0, 2 * y); ctx.scale(1, -1); }
      const base = st === 'obsidian' ? [44, 28, 48] : st === 'salt' ? [226, 220, 198] : [222, 212, 188];
      const hs = [[-4, 7], [0, 10], [4, 6]];
      for (const [dx, hgt] of hs) {
        ctx.fillStyle = rgbA(base); tri(x + dx - 2.4, y, x + dx + 2.4, y, x + dx, y - hgt);
        ctx.fillStyle = st === 'obsidian' ? 'rgba(200,110,255,0.55)' : 'rgba(255,255,255,0.45)';
        tri(x + dx - 0.6, y, x + dx + 0.4, y, x + dx, y - hgt + 1);
        if (st === 'bone') { ctx.fillStyle = rgbA(base); ctx.beginPath(); ctx.arc(x + dx, y - 0.5, 1.8, 0, 6.29); ctx.fill(); }
      }
      break;
    }
    case 'barrel': {                           // a minecart full of blasting powder
      ctx.fillStyle = '#2a2a30';
      ctx.beginPath(); ctx.arc(x - 5, y - 2.2, 2.2, 0, 6.29); ctx.arc(x + 5, y - 2.2, 2.2, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#b2362c';
      for (let k = -1; k <= 1; k++) ctx.fillRect(x + k * 3.5 - 1, y - 13 + Math.abs(k), 2, 4);
      ctx.fillStyle = '#6e4a32'; ctx.beginPath(); ctx.moveTo(x - 9, y - 10); ctx.lineTo(x + 9, y - 10); ctx.lineTo(x + 7.5, y - 3.5); ctx.lineTo(x - 7.5, y - 3.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8c8f96'; ctx.fillRect(x - 9, y - 10.5, 18, 1.3); ctx.fillRect(x - 8, y - 6.5, 16, 1);
      ctx.fillStyle = '#ffd23c'; ctx.font = '700 5px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', x, y - 4.6);
      break;
    }
    case 'lamp': {
      if (st === 'cap') {
        ctx.fillStyle = rgbA(mix(T.moss[1], [240, 240, 240], 0.5)); ctx.fillRect(x - 1, y - 6, 2, 6);
        ctx.fillStyle = rgbA(T.moss[1]); ctx.beginPath(); ctx.ellipse(x, y - 6, 5, 3.4, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x - 2.5, y - 8, 1, 1); ctx.fillRect(x + 1.5, y - 7.5, 1, 1);
        break;
      }
      if (st === 'hanglamp') {                 // on a chain from the roof, swinging a touch
        const sw = Math.sin(time * 1.3 + pr.seed * 30) * 0.06, bx = x + Math.sin(sw) * pr.len, by = y + Math.cos(sw) * pr.len;
        ctx.strokeStyle = '#5a5048'; ctx.lineWidth = 0.8; ctx.setLineDash([1.2, 0.8]);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#4a3a2a'; ctx.fillRect(bx - 3, by, 6, 1.5); ctx.fillRect(bx - 2.5, by + 7.5, 5, 1.5);
        ctx.fillStyle = '#ffcc70'; ctx.fillRect(bx - 2, by + 1.5, 4, 6);
        ctx.fillStyle = '#fff2c0'; ctx.fillRect(bx - 0.7, by + 3, 1.4, 3);
        ctx.fillStyle = '#4a3a2a'; ctx.fillRect(bx - 2.6, by + 1.5, 0.8, 6); ctx.fillRect(bx + 1.8, by + 1.5, 0.8, 6);
        break;
      }
      const s = -pr.side, lx = x + s * 5;
      ctx.strokeStyle = '#4a3e36'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(lx, y - 5); ctx.lineTo(lx, y - 3); ctx.stroke();
      ctx.fillStyle = '#5c4632'; ctx.fillRect(lx - 2.5, y - 3, 5, 7);
      ctx.fillStyle = '#ffcc70'; ctx.fillRect(lx - 1.5, y - 2, 3, 4.5);
      break;
    }
    case 'vent': {
      ctx.fillStyle = '#1a1010'; ctx.beginPath(); ctx.ellipse(x, y - 0.5, 5, 1.8, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = pr.warn || pr.on ? '#ff8a3a' : 'rgba(255,110,40,0.5)';
      ctx.fillRect(x - 2.5, y - 1, 1, 1); ctx.fillRect(x + 1, y - 1.2, 1.2, 1);
      break;
    }
    case 'pad': {                               // a bouncy mushroom, squashed as it throws you
      const sq = Math.max(0, pr.sq || 0) / 0.3, hh = 8 * (1 - 0.4 * sq), ww = 10 * (1 + 0.25 * sq);
      ctx.fillStyle = rgbA(mix(T.moss[1], [240, 230, 220], 0.6)); ctx.fillRect(x - 1.8, y - hh, 3.6, hh);
      ctx.fillStyle = rgbA(T.moss[0]); ctx.beginPath(); ctx.ellipse(x, y - hh, ww, 5, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (const [dx, dy] of [[-5, -2], [0, -3.8], [4.5, -1.8]]) { ctx.beginPath(); ctx.arc(x + dx * ww / 10, y - hh + dy, 0.9, 0, 6.29); ctx.fill(); }
      break;
    }
    case 'zone': {
      const x0 = x + pr.l, w = pr.r - pr.l;
      if (st === 'ice') { ctx.fillStyle = 'rgba(190,230,255,0.6)'; ctx.fillRect(x0, y - 1.6, w, 1.6); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(x0 + 2, y - 1.6, w - 4, 0.5); }
      else if (st === 'snow' || st === 'ash') {
        ctx.fillStyle = st === 'snow' ? 'rgba(236,244,255,0.95)' : rgbA(mix(T.rock[1], [90, 90, 90], 0.5));
        ctx.beginPath(); ctx.moveTo(x0, y);
        for (let k = 0; k <= w; k += 2) ctx.lineTo(x0 + k, y - 1 - 3.2 * Math.sin(Math.PI * k / w) - Math.sin(k * 0.7 + pr.seed * 9) * 0.5);
        ctx.lineTo(x0 + w, y); ctx.closePath(); ctx.fill();
      } else if (st === 'slime' || st === 'puddle' || st === 'acid') {
        const c = st === 'slime' ? [110, 200, 90] : st === 'puddle' ? [70, 130, 190] : [150, 168, 60];
        ctx.fillStyle = rgbA(c, st === 'puddle' ? 0.6 : 0.7); ctx.fillRect(x0, y - 2.5, w, 2.5);
        ctx.fillStyle = rgbA(mix(c, [255, 255, 255], 0.4), 0.7);
        const nb = Math.max(1, Math.floor(w / 8));
        for (let k = 0; k < nb; k++) {
          const ph = (time * (st === 'acid' ? 0.9 : 0.4) + k * 0.37 + pr.seed) % 1;
          ctx.beginPath(); ctx.arc(x0 + (k + 0.5) * w / nb, y - 2.5 - ph * 2, 0.6 + ph * 0.6, 0, 6.29); ctx.fill();
        }
      } else if (st === 'glass') {
        for (let k = 0; k < w; k += 2.2) {
          const s = Math.sin(k * 12.9 + pr.seed * 78) * 43758.5 % 1;
          ctx.fillStyle = 'rgba(200,240,255,' + (0.35 + Math.abs(s) * 0.4) + ')';
          tri(x0 + k, y, x0 + k + 1.6, y, x0 + k + 0.6 + s, y - 1.5 - Math.abs(s) * 2);
        }
      } else if (st === 'log') {
        ctx.fillStyle = '#2c2220'; ctx.fillRect(x0 + 1, y - 4, w - 2, 4);
        ctx.fillStyle = 'rgba(255,' + Math.round(100 + 40 * Math.sin(time * 3 + pr.seed * 9)) + ',40,0.8)';
        for (let k = 4; k < w - 3; k += 5) ctx.fillRect(x0 + k, y - 2.8 + (k % 2), 1.6, 0.8);
      }
      break;
    }
    case 'pod': {
      const b = 1 + 0.06 * Math.sin(time * 3 + pr.seed * 9);
      ctx.fillStyle = rgbA(T.moss[0]); ctx.fillRect(x - 0.6, y - 3, 1.2, 3);
      ctx.fillStyle = '#9cc44a'; ctx.beginPath(); ctx.ellipse(x, y - 6, 4.4 * b, 5 * b, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#d8f07a';
      ctx.beginPath(); ctx.arc(x - 1.5, y - 7, 0.9, 0, 6.29); ctx.arc(x + 1.6, y - 5, 0.8, 0, 6.29); ctx.fill();
      break;
    }
    case 'noise': {
      if (st === 'skulls') {
        for (const [dx, dy] of [[-4.5, -2.2], [0, -2.4], [4.5, -2.2], [-2.2, -5.8], [2.3, -5.6]]) {
          ctx.fillStyle = '#ded4bc'; ctx.beginPath(); ctx.arc(x + dx, y + dy, 2.3, 0, 6.29); ctx.fill();
          ctx.fillStyle = '#2a2622'; ctx.fillRect(x + dx - 1.3, y + dy - 0.4, 0.9, 0.9); ctx.fillRect(x + dx + 0.4, y + dy - 0.4, 0.9, 0.9);
        }
      } else {
        const s = -pr.side, cx = x + s * 4;
        ctx.fillStyle = rgbA(mix(T.rock[1], T.moss[0], 0.4));
        ctx.beginPath(); ctx.ellipse(cx, y, 4, 9, 0, 0, 6.29); ctx.fill();
        ctx.strokeStyle = rgbA(T.moss[1], 0.5 + 0.5 * Math.max(0, pr.ring || 0)); ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(cx, y - 6); ctx.lineTo(cx - 1.5, y - 1); ctx.lineTo(cx + 1.2, y + 2); ctx.lineTo(cx, y + 6); ctx.stroke();
      }
      break;
    }
    case 'shard': {
      ctx.fillStyle = rgbA(T.moss[1], 0.85);
      const dir = pr.side ? -pr.side : 0;
      if (dir) { tri(x, y - 2, x, y + 2, x + dir * 5, y - 0.5); tri(x, y + 1, x, y + 3.5, x + dir * 3, y + 3); }
      else { tri(x - 2, y, x + 1, y, x - 1, y - 5); tri(x, y, x + 3, y, x + 2.4, y - 3.5); }
      break;
    }
    case 'cover': {
      if (pr.hitT > 0) ctx.translate(Math.sin(time * 80) * 0.6, 0);
      if (st === 'statue') {                  // a drowned figure on a plinth, streaked with algae
        ctx.fillStyle = rgbA(T.rock[0]); ctx.fillRect(x - 8, y - 6, 16, 6);
        ctx.fillStyle = rgbA(T.rock[1]); ctx.beginPath(); ctx.moveTo(x - 5, y - 6); ctx.lineTo(x - 4, y - 20); ctx.lineTo(x + 4, y - 20); ctx.lineTo(x + 5, y - 6); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(x, y - 23.5, 3.6, 0, 6.29); ctx.fill();
        ctx.fillStyle = rgbA(T.moss[0], 0.8);
        ctx.fillRect(x - 3, y - 20, 1, 12); ctx.fillRect(x + 1.5, y - 17, 1, 9); ctx.fillRect(x - 1, y - 26, 2, 1.2);
      } else if (st === 'pillar') {           // cracks spread as it takes hits
        ctx.fillStyle = rgbA(T.brick[1]); ctx.fillRect(x - 5, y - 27, 10, 27);
        ctx.fillStyle = rgbA(T.brick[0]); ctx.fillRect(x - 7, y - 30, 14, 3); ctx.fillRect(x - 7, y - 3, 14, 3);
        ctx.strokeStyle = '#1e1a1a'; ctx.lineWidth = 0.7;
        const dmg = 4 - Math.max(0, pr.hp);
        for (let k = 0; k < dmg; k++) { const cy = y - 8 - k * 6; ctx.beginPath(); ctx.moveTo(x - 5, cy); ctx.lineTo(x - 1, cy - 2); ctx.lineTo(x + 1, cy + 1); ctx.lineTo(x + 5, cy - 1); ctx.stroke(); }
      } else {                                // a monolith that won't hold still
        const sk = Math.sin(time * 0.8 + pr.seed * 9) * 0.08;
        ctx.transform(1, 0, sk, 1, -sk * y, 0);
        ctx.fillStyle = rgbA(mix(T.bg2, [0, 0, 0], 0.2)); ctx.fillRect(x - 6, y - 34, 12, 34);
        ctx.fillStyle = rgbA(T.moss[1], 0.5 + 0.3 * Math.sin(time * 2 + pr.seed * 7));
        ctx.fillRect(x - 0.6, y - 28, 1.2, 8); ctx.fillRect(x - 3, y - 24.6, 6, 1.2);
      }
      break;
    }
    case 'matter': {
      const by = y + Math.sin(time * 1.3 + pr.seed * 9) * 3;
      ctx.fillStyle = '#050208'; ctx.beginPath(); ctx.arc(x, by, 6.5, 0, 6.29); ctx.fill();
      ctx.strokeStyle = 'rgba(160,90,255,0.7)'; ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) { const a = time * 2.4 + k * 2.09; ctx.beginPath(); ctx.arc(x, by, 8 + k, a, a + 1.4); ctx.stroke(); }
      break;
    }
    case 'tendril': {
      ctx.fillStyle = '#2a1640'; ctx.beginPath(); ctx.ellipse(x, y - 1.5, 4, 2.5, 0, 0, 6.29); ctx.fill();
      const ext = Math.max(4, pr.ext || 0), a = pr.aimA != null ? pr.aimA : pr.ang;
      const tx = x + Math.cos(a) * ext, ty = y - 2 + Math.sin(a) * ext;
      const wob = Math.sin(time * 5 + pr.seed * 9) * ext * 0.2;
      const mx = (x + tx) / 2 + Math.cos(a + 1.57) * wob, my = (y + ty) / 2 + Math.sin(a + 1.57) * wob;
      ctx.strokeStyle = '#3e2066'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.quadraticCurveTo(mx, my, tx, ty); ctx.stroke();
      ctx.strokeStyle = rgbA(T.moss[1], 0.8); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo((mx + tx) / 2, (my + ty) / 2); ctx.lineTo(tx, ty); ctx.stroke();
      break;
    }
  }
  ctx.restore();
}
// The light a prop gives off, drawn after the fog with 'lighter'. Lanterns, glowing caps,
// a vent in full roar, shards catching your torch, eyes in the dark.
/** @param {CanvasRenderingContext2D} ctx @param {Prop} pr @param {number} time @param {Theme} T @param {number} pdist how far you are @param {number} torchR */
export function propGlow(ctx, pr, time, T, pdist, torchR) {
  const x = pr.x, y = pr.y;
  if (pr.k === 'lamp') {
    const f = 0.85 + 0.15 * Math.sin(time * 9 + pr.seed * 20) * Math.sin(time * 4.3 + pr.seed * 7);
    if (pr.st === 'cap') glowAt(ctx, x, y - 7, 30, 0.2 * f, rgbS(T.moss[1]));
    else if (pr.st === 'hanglamp') {
      const sw = Math.sin(time * 1.3 + pr.seed * 30) * 0.06, bx = x + Math.sin(sw) * pr.len, by = y + Math.cos(sw) * pr.len + 4.5;
      glowAt(ctx, bx, by, 52, 0.17 * f, '255,160,70'); glowAt(ctx, bx, by, 9, 0.4 * f, '255,210,130');
    }
    else { const lx = x - pr.side * 5; glowAt(ctx, lx, y, 46, 0.16 * f, '255,160,70'); glowAt(ctx, lx, y, 8, 0.4 * f, '255,210,130'); }
  } else if (pr.k === 'vent' && (pr.on || pr.warn)) {
    glowAt(ctx, x, y - (pr.on ? 28 : 3), pr.on ? 44 : 12, pr.on ? 0.35 : 0.25, '255,120,40');
    if (pr.on) {
      const g = ctx.createLinearGradient(0, y - VENT_H, 0, y);
      g.addColorStop(0, 'rgba(255,90,30,0)'); g.addColorStop(0.5, 'rgba(255,140,50,0.55)'); g.addColorStop(1, 'rgba(255,230,150,0.9)');
      ctx.fillStyle = g;
      const w = 4 + Math.sin(time * 40) * 0.8;
      ctx.fillRect(x - w, y - VENT_H, w * 2, VENT_H);
    }
  } else if (pr.k === 'shard' && pdist < torchR) {
    const g = (1 - pdist / torchR) * Math.pow(0.5 + 0.5 * Math.sin(time * 5 + pr.seed * 40), 6);
    if (g > 0.03) {
      ctx.fillStyle = 'rgba(255,255,255,' + g + ')';
      ctx.fillRect(x - 4, y - 0.4, 8, 0.8); ctx.fillRect(x - 0.4, y - 4, 0.8, 8);
      glowAt(ctx, x, y, 7, 0.5 * g, rgbS(T.moss[1]));
    }
  } else if (pr.k === 'eyes') {
    // they fade out as you come near, so you never quite catch what's watching
    const a = eyesAlpha(pdist) * (Math.sin(time * 0.9 + pr.seed * 40) > 0.96 ? 0.1 : 1) *
      (0.55 + 0.25 * Math.sin(time * 1.7 + pr.seed * 9));
    if (a > 0.02) {
      const c = pr.seed < 0.5 ? '255,60,70' : rgbS(T.moss[1]);
      ctx.fillStyle = 'rgba(' + c + ',' + a + ')';
      ctx.fillRect(x - 4, y - 0.6, 2, 1.2); ctx.fillRect(x + 2, y - 0.6, 2, 1.2);
      glowAt(ctx, x, y, 9, 0.25 * a, c);
    }
  } else if (pr.k === 'matter') {
    glowAt(ctx, x, y + Math.sin(time * 1.3 + pr.seed * 9) * 3, 26, 0.12, '140,70,255');
  } else if (pr.k === 'drip' && pr.st === 'lava') {
    glowAt(ctx, x, y + 2, 10, 0.3, '255,110,40');
  }
}
// eyes are gone by the time you're 60 units off, and fully there from 180
/** @type {(d: number) => number} */
export const eyesAlpha = d => Math.max(0, Math.min(1, (d - 60) / 120));
export const VENT_H = 64;                     // how tall a scorched vent's fire pillar stands
