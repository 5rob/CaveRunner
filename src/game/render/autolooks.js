// @ts-check
// CaveRunner Auto (stage: shots, first half): the shots' own sprites and lights in a level, by spell id (`sid`).
// Two layers, as titledraw.js paints them: drawSolidShot (solid things — a bullet, pellets, the bomb, the rocket,
// the disc — painted normally, so dark metal shows) and drawGlowShot (added light: plasma, the blade, fire, the
// bubble). Each returns false for a shot it doesn't draw, and the old game's drawLook (looks.js) takes it.
// shotLights: the light a shot throws round it. What they shed as they fly is auto/shotfx.js.

import { glowAt } from '../../art/sprites.js';
import { drawLook } from './looks.js';

/** @typedef {import('../../art/titlescene.js').TShot} TShot */

/** @param {CanvasRenderingContext2D} c @param {number} x @param {number} y @param {number} r @param {string} col @param {number} a */
const dot = (c, x, y, r, col, a) => { c.globalAlpha = a; c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill(); };

// the solid ones (normal painting). W: { time }
/** @param {CanvasRenderingContext2D} c @param {TShot} s @param {{ time: number }} W */
export function drawSolidShot(c, s, W) {
  const a = Math.atan2(s.vy, s.vx);
  /** @type {any} */
  const b = s;
  /** @type {any} */
  const w = W;
  /** @type {any} */
  const g = { ctx: c };
  if (s.sid === 'slug') {               // a large-calibre bullet: copper round nose, brass base, a glint
    c.save(); c.translate(s.x, s.y); c.rotate(a);
    c.globalAlpha = 1; c.fillStyle = '#b07a3a'; c.fillRect(-4, -1.4, 4, 2.8);
    c.fillStyle = '#d9925a'; c.beginPath(); c.moveTo(0, -1.4); c.quadraticCurveTo(3.4, -1.2, 3.6, 0); c.quadraticCurveTo(3.4, 1.2, 0, 1.4); c.fill();
    c.fillStyle = '#ffe2b0'; c.fillRect(-3.5, -1.2, 5, 0.6);
    c.restore();
  } else if (s.sid === 'buck') {        // a small metal pellet
    dot(c, s.x, s.y, 0.9, '#9aa0aa', 1);
    dot(c, s.x - 0.3, s.y - 0.3, 0.4, '#f0f4ff', 1);
  } else if (s.sid === 'blast' || s.sid === 'missile') {   // the bomb and the rocket, now painted solid (dark metal shows)
    drawLook(w, g, b);
  } else if (s.sid === 'disc') {        // four afterimages under it, each a frame or two behind, fading
    const t = s.tr || [];
    for (let k = 4; k >= 1; k--) {
      const i = k * 2 * 2 - 2;          // positions 1, 3, 5, 7 frames back
      if (t.length <= i + 1) continue;
      c.save(); c.globalAlpha = 0.55 - k * 0.11; c.translate(t[i], t[i + 1]); c.rotate((s.spin - k * 0.25) * 2.2);
      c.fillStyle = s.col; c.beginPath();
      for (let q = 0; q < 16; q++) { const rr = q % 2 ? s.size * 0.78 : s.size * 1.12, u = q / 16 * 6.283; c.lineTo(Math.cos(u) * rr, Math.sin(u) * rr); }
      c.fill(); c.restore();
    }
    c.globalAlpha = 1;
    drawLook(w, g, b);
  } else return false;
  c.globalAlpha = 1;
  return true;
}

// the bright ones (added light)
/** @param {CanvasRenderingContext2D} c @param {TShot} s @param {{ time: number }} W */
export function drawGlowShot(c, s, W) {
  const sp = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / sp, uy = s.vy / sp;
  if (s.sid === 'slug' || s.sid === 'disc' || s.sid === 'missile') return true;   // drawn solid
  if (s.sid === 'buck') {               // a glint streaking behind the pellet
    c.globalAlpha = 0.45; c.strokeStyle = '#dfe6f0'; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(s.x - ux * 3, s.y - uy * 3); c.lineTo(s.x, s.y); c.stroke();
  } else if (s.sid === 'blast') {       // the lit fuse's spark
    const k = s.spin * 0.5 - 1.2, fx = s.x + Math.cos(k) * s.size * 1.7, fy = s.y + Math.sin(k) * s.size * 1.7;
    const tw = Math.sin(W.time * 40) > 0;
    dot(c, fx, fy, tw ? 1.2 : 0.8, tw ? '#ffffff' : '#ffb347', 1);
  } else if (s.sid === 'bolt') {        // Noita's spark bolt: a pink-white dart with a soft pink halo
    dot(c, s.x, s.y, s.size * 1.6, s.col, 0.3);
    c.globalAlpha = 0.8; c.strokeStyle = s.col; c.lineWidth = s.size * 0.9; c.lineCap = 'round';
    c.beginPath(); c.moveTo(s.x - ux * 4, s.y - uy * 4); c.lineTo(s.x, s.y); c.stroke();
    dot(c, s.x, s.y, s.size * 0.6, '#ffffff', 1);
  } else if (s.sid === 'spark') {       // Noita's spark: a hot white-yellow fleck with a short jittering tail
    const px = -uy, py = ux; let x = s.x, y = s.y;
    c.globalAlpha = 0.9; c.strokeStyle = '#ffe066'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(x, y);
    for (let k = 1; k <= 3; k++) { const j = Math.sin(s.spin * 7 + k * 2.3) * 1.6; x = s.x - ux * k * 2.4 + px * j; y = s.y - uy * k * 2.4 + py * j; c.lineTo(x, y); }
    c.stroke();
    dot(c, s.x, s.y, 1.6, '#ffe066', 0.35);
    dot(c, s.x, s.y, 0.7, '#ffffff', 1);
  } else if (s.sid === 'lance') {       // a thin blue light-saber
    const len = 16, tx = s.x - ux * len, ty = s.y - uy * len;
    c.lineCap = 'round';
    c.globalAlpha = 0.3; c.strokeStyle = '#3a9cff'; c.lineWidth = 2.6;
    c.beginPath(); c.moveTo(tx, ty); c.lineTo(s.x, s.y); c.stroke();
    c.globalAlpha = 0.8; c.strokeStyle = '#7ad7ff'; c.lineWidth = 1.3; c.stroke();
    c.globalAlpha = 1; c.strokeStyle = '#ffffff'; c.lineWidth = 0.6; c.stroke();
  } else if (s.sid === 'arrow') {       // smaller, longer, thinner
    const len = 9, hx = s.x - ux * len, hy = s.y - uy * len, px = -uy, py = ux;
    c.globalAlpha = 1; c.strokeStyle = s.col; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(hx, hy); c.lineTo(s.x, s.y); c.stroke();
    c.fillStyle = '#e8ffe0';
    c.beginPath(); c.moveTo(s.x + ux * 1.8, s.y + uy * 1.8); c.lineTo(s.x - ux + px, s.y - uy + py); c.lineTo(s.x - ux - px, s.y - uy - py); c.fill();
    c.strokeStyle = s.col; c.lineWidth = 0.5;
    c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx - ux * 1.5 + px * 1.1, hy - uy * 1.5 + py * 1.1);
    c.moveTo(hx, hy); c.lineTo(hx - ux * 1.5 - px * 1.1, hy - uy * 1.5 - py * 1.1); c.stroke();
  } else if (s.sid === 'fball' || s.sid === 'fbolt' || s.sid === 'flamer' || s.sid === 'fdrop') {   // a flying ball of flame, tail behind
    const r = s.size, f = 1 + 0.15 * Math.sin(s.spin * 3.1 + s.x);
    for (let k = 4; k >= 1; k--) dot(c, s.x - ux * k * r * 0.7, s.y - uy * k * r * 0.7 - k * 0.3, r * (1.1 - k * 0.18) * f, k > 2 ? '#c8301a' : '#e8461c', 0.5 - k * 0.08);
    dot(c, s.x, s.y, r * 1.5 * f, '#ff7a1a', 0.4);
    dot(c, s.x, s.y, r * 1.05 * f, '#ff9a2e', 0.9);
    dot(c, s.x + ux * r * 0.2, s.y + uy * r * 0.2, r * 0.65, '#ffd35a', 1);
    dot(c, s.x + ux * r * 0.3, s.y + uy * r * 0.3, r * 0.3, '#fffbe0', 1);
  } else if (s.sid === 'bubble') {      // a bright blue wobbly bubble, twinkling
    const r = s.size * 1.7, w = 1 + 0.14 * Math.sin(s.spin * 1.7), tw = Math.max(0, Math.sin(s.spin * 2.3));
    c.save(); c.translate(s.x, s.y);
    c.globalAlpha = 0.35; c.fillStyle = '#46beff';
    c.beginPath(); c.ellipse(0, 0, r * w, r / w, 0, 0, 6.283); c.fill();
    c.globalAlpha = 1; c.strokeStyle = '#8fdcff'; c.lineWidth = 0.9; c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = 0.8;
    c.beginPath(); c.arc(0, 0, r * 0.66, 3.6, 4.5); c.stroke();
    if (tw > 0.3) {                     // the twinkle: a four-point star on its shine
      const q = tw * 2.2;
      c.globalAlpha = tw; c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(-r * 0.45 - q, -r * 0.45); c.lineTo(-r * 0.45 + q, -r * 0.45); c.moveTo(-r * 0.45, -r * 0.45 - q); c.lineTo(-r * 0.45, -r * 0.45 + q); c.stroke();
    }
    c.restore();
  } else return false;
  c.globalAlpha = 1;
  return true;
}

// the light the shots throw (in the bright layer, before the shots): the mod's own light colour and reach; the
// bubble and pollen brighter and wider. At most `cap` of them
/** @param {CanvasRenderingContext2D} ctx @param {TShot[]} shots @param {number} [cap] */
export function shotLights(ctx, shots, cap = 40) {
  let n = 0;
  for (const s of shots) {
    const lt = s.light || (s.sid === 'pollen' ? '216,255,106' : '');
    if (!lt || n >= cap) continue;
    n++;
    const big = s.sid === 'bubble' || s.sid === 'pollen';
    const fl = s.sid === 'bubble' ? 1 + 0.12 * Math.sin(s.spin * 2.3) : 1;
    glowAt(ctx, s.x, s.y, (s.lightR || 30) * (big ? 0.9 : 0.6) * fl, big ? 0.32 : 0.18, s.sid === 'bubble' ? '70,170,255' : lt);
  }
}
