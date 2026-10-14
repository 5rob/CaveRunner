// @ts-check
// CaveRunner Auto (stage: shots, first half): the shots' own sprites and lights in a level, by spell id (`sid`).
// Two layers, as titledraw.js paints them: drawSolidShot (solid things — a bullet, pellets, the bomb, the rocket,
// the disc — painted normally, so dark metal shows) and drawGlowShot (added light: plasma, the blade, fire, the
// bubble). Each returns false for a shot it doesn't draw, and the old game's drawLook (looks.js) takes it.
// shotLights: the light a shot throws round it. What they shed as they fly is auto/shotfx.js.

import { glowAt } from '../../art/sprites.js';
import { drawBolt, drawField, drawLook, drawWhiteHole } from './looks.js';
import { jagPts } from '../../auto/shotfx.js';

/** @typedef {import('../../art/titlescene.js').TShot} TShot */
/** @typedef {import('../../art/titlescene.js').TBoom} TBoom */

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
  } else if (s.sid === 'void') {        // Black Hole, as the game draws it: purple haze, a starry black core
    const r = s.size * VOID_K, core = r * 0.78, beat = 1 + 0.06 * Math.sin(W.time * 6 + s.spin);
    const gr = c.createRadialGradient(s.x, s.y, core * 0.8, s.x, s.y, r * 1.55 * beat);
    gr.addColorStop(0, 'rgba(197,140,255,0.75)'); gr.addColorStop(0.3, 'rgba(150,90,255,0.35)'); gr.addColorStop(1, 'rgba(110,50,220,0)');
    c.globalAlpha = 1; c.fillStyle = gr; c.beginPath(); c.arc(s.x, s.y, r * 1.55 * beat, 0, 6.283); c.fill();
    dot(c, s.x, s.y, core, '#050208', 1);
    for (let k = 0; k < 10; k++) {      // stars wheeling inside
      const tw = Math.sin(W.time * 8 + k * 1.7);
      if (tw < 0.1) continue;
      const ang = k * 2.4 + W.time * (0.5 + (k % 3) * 0.35), rad = core * (0.15 + ((k * 0.37) % 0.75));
      c.globalAlpha = tw; c.fillStyle = k % 3 ? '#e6d4ff' : '#ffffff';
      c.fillRect(s.x + Math.cos(ang) * rad - 0.4, s.y + Math.sin(ang) * rad - 0.4, 0.8, 0.8);
    }
    c.globalAlpha = 0.8; c.strokeStyle = '#b98aff'; c.lineWidth = 0.8;
    c.beginPath(); c.arc(s.x, s.y, core, 0, 6.283); c.stroke();
  } else if (s.sid === 'chain') {       // the dark heart of the little storm (its purple crackle is added light)
    dot(c, s.x, s.y, s.size * 0.75, '#12041c', 1);
    dot(c, s.x - 0.4, s.y - 0.4, s.size * 0.35, '#3a0c5a', 1);
  } else if (s.sid === 'meteor') {      // a lump of rock, cracked and glowing
    c.save(); c.translate(s.x, s.y); c.rotate(s.spin * 0.6);
    c.globalAlpha = 1; c.fillStyle = '#3a2a24'; c.beginPath();
    for (let q = 0; q < 8; q++) { const u = q / 8 * 6.283, rr = s.size * (0.75 + 0.2 * Math.sin(q * 2.7)); c.lineTo(Math.cos(u) * rr, Math.sin(u) * rr); }
    c.fill();
    c.strokeStyle = '#ff8a1f'; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(-s.size * 0.4, -s.size * 0.2); c.lineTo(0, s.size * 0.1); c.lineTo(s.size * 0.3, -s.size * 0.3); c.stroke();
    c.restore();
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
// Black Hole drawn this many times its (capped) shot size (owner, v1.0.40: double)
export const VOID_K = 2;

export function drawGlowShot(c, s, W) {
  const sp = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / sp, uy = s.vy / sp;
  if (s.sid === 'slug' || s.sid === 'disc' || s.sid === 'missile' || s.sid === 'void') return true;   // drawn solid
  /** @type {any} */
  const G2 = { ctx: c };
  if (s.sid === 'vigour') {             // Circle of Vigour: the game's own field look (rising sparkles and plus signs, a faint dashed ring, the cross)
    /** @type {any} */
    const f = { x: s.x, y: s.y, r: s.heal || 36, life: s.life, max: s.max || 5, col: s.col, field: 'heal' };
    /** @type {any} */
    const Wt = W;
    drawField(Wt, G2, f);
    return true;
  }
  if (s.sid === 'vacfield') {           // White Hole: the game's look (white core, wheeling blue stars), bigger, and a faint rim at its reach
    /** @type {any} */
    const f = { x: s.x, y: s.y, r: (s.vac || 64) * 0.8, life: s.life, max: s.max || 1.2 };   // owner (v1.0.40): half the first try's size
    /** @type {any} */
    const Wt = W;
    drawWhiteHole(Wt, G2, f);
    const fade = Math.min(1, (f.max - s.life) * 8, s.life * 5);
    c.globalAlpha = 0.18 * fade * (0.7 + 0.3 * Math.sin(W.time * 6)); c.strokeStyle = '#8fd0ff'; c.lineWidth = 0.6;
    c.beginPath(); c.arc(s.x, s.y, (s.vac || 64) * (0.95 - 0.1 * ((W.time * 1.5) % 1)), 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 1;
    return true;
  }
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
  } else if (s.sid === 'eorb' || s.sid === 'esph') {   // an undulating ball of energy; the sphere hollow, a ring
    const hollow = s.sid === 'esph', r = s.size * (hollow ? 2.2 : 1.25), t = W.time * 9 + s.spin;
    /** @param {number} rad @param {number} amp @param {number} ph */
    const blob = (rad, amp, ph) => { c.beginPath();
      for (let q = 0; q <= 24; q++) { const u = q / 24 * 6.283, rr = rad * (1 + amp * Math.sin(u * 5 + t + ph) + amp * 0.6 * Math.sin(u * 3 - t * 1.3)); c.lineTo(s.x + Math.cos(u) * rr, s.y + Math.sin(u) * rr); } };
    const col = hollow ? '#3c8cff' : '#64beff';
    if (hollow) {
      c.lineJoin = 'round';
      c.globalAlpha = 0.3; c.strokeStyle = col; c.lineWidth = 2.6; blob(r, 0.1, 0); c.stroke();
      c.globalAlpha = 0.9; c.strokeStyle = '#8fc4ff'; c.lineWidth = 1; blob(r, 0.12, 1.3); c.stroke();
      c.globalAlpha = 0.9; c.strokeStyle = '#ffffff'; c.lineWidth = 0.5; blob(r * 0.96, 0.15, 2.6); c.stroke();
    } else {
      dot(c, s.x, s.y, r * 1.8, col, 0.18);
      c.globalAlpha = 0.45; c.fillStyle = col; blob(r * 1.2, 0.14, 0); c.fill();
      c.globalAlpha = 0.6; c.fillStyle = '#9ad8ff'; blob(r * 0.8, 0.18, 2); c.fill();
      dot(c, s.x, s.y, r * 0.3, '#ffffff', 0.9);
      c.globalAlpha = 0.8; c.strokeStyle = '#e8f6ff'; c.lineWidth = 0.5;   // a crackle across it
      c.beginPath(); for (let q = 0; q < 4; q++) { const u = t * 0.7 + q * 1.9; c.lineTo(s.x + Math.cos(u) * r * 0.9, s.y + Math.sin(u) * r * 0.9); } c.stroke();
    }
  } else if (s.sid === 'zap') {         // a jagged bolt along its last stretch of path, re-kinked every frame (the old game's look)
    const tr = s.tr || [];
    /** @type {{ x: number, y: number }[]} */
    let pts = [];
    for (let i = tr.length - 2; i >= 2; i -= 2) { const q = jagPts(tr[i], tr[i + 1], tr[i - 2], tr[i - 1], 5, Math.random); pts = pts.concat(pts.length ? q.slice(1) : q); }
    if (pts.length > 1) drawBolt(G2, pts, s.col, 1, Math.min(1, s.life * 6));
    dot(c, s.x, s.y, 2.6, s.col, 0.35);
    dot(c, s.x, s.y, 1, '#ffffff', 1);
  } else if (s.sid === 'chain') {       // a raging black-and-purple lightning ball: arcs crackling out of it; a streak as it leaps
    if (s.hopT && s.hx != null) {
      const k = s.hopT / 0.14;
      c.lineCap = 'round';
      c.globalAlpha = 0.5 * k; c.strokeStyle = '#a040ff'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(s.hx, s.hy || 0); c.lineTo(s.x, s.y); c.stroke();
      c.globalAlpha = k; c.strokeStyle = '#ffffff'; c.lineWidth = 0.8; c.stroke();
    }
    dot(c, s.x, s.y, s.size * 2, '#8a2cff', 0.25);
    for (let k = 0; k < 4; k++) {
      const a = Math.random() * 6.283, d = s.size * (1.4 + Math.random() * 1.4);
      drawBolt(G2, jagPts(s.x, s.y, s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, 1.2, Math.random), k % 2 ? '#c860ff' : '#7a20ff', 0.5, 0.9);
    }
    c.globalAlpha = 0.9; c.strokeStyle = '#d27aff'; c.lineWidth = 0.6;
    c.beginPath(); c.arc(s.x, s.y, s.size * 0.8, 0, 6.283); c.stroke();
  } else if (s.sid === 'plasma' || s.sid === 'ldrill') {   // a bright beam: plasma purple, the drill green and short, its tip fading out
    if (s.bx == null) return true;
    const drill = s.sid === 'ldrill', k = Math.min(1, s.life * 12), ex = s.bx, ey = s.by2 || 0;
    const col = drill ? '#5aff3a' : '#c040ff', hot = drill ? '#c8ffb0' : '#f0a8ff';
    /** @param {number} w @param {string} cl @param {number} a */
    const line = (w, cl, a) => {
      if (drill) { const g = c.createLinearGradient(s.x, s.y, ex, ey); g.addColorStop(0, cl); g.addColorStop(0.55, cl); g.addColorStop(1, 'rgba(0,0,0,0)'); c.strokeStyle = g; }
      else c.strokeStyle = cl;
      c.globalAlpha = a * k; c.lineWidth = w; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(ex, ey); c.stroke();
    };
    c.lineCap = 'round';
    const wob = 1 + 0.2 * Math.sin(W.time * 50);
    line(5 * wob, col, 0.3); line(2.2, col, 0.8); line(1, hot, 1); line(0.4, '#ffffff', 1);
    if (!drill) { dot(c, ex, ey, 4 * wob, col, 0.4 * k); dot(c, ex, ey, 1.6, '#ffffff', k); }
  } else if (s.sid === 'meteor') {      // the fire it trails: a long tapering tail of flame, a hot rim round the rock
    const r = s.size;
    for (let k = 8; k >= 1; k--) dot(c, s.x - ux * k * r * 0.7, s.y - uy * k * r * 0.7, r * (1.25 - k * 0.12), k > 5 ? '#a8200e' : k > 2 ? '#e8461c' : '#ff9a2e', 0.55 - k * 0.05);
    dot(c, s.x, s.y, r * 1.6, '#ff7a1a', 0.45);
    dot(c, s.x + ux * r * 0.3, s.y + uy * r * 0.3, r * 0.5, '#fff2b0', 0.9);
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

// a blast's look (titledraw.js, after the shot layer): the usual fireball; a nuke's and meteor's (bigger, longer: auto/shotfx.js
// boomLook) a white flash, a fireball rolling out, and a shockwave ring racing past it (a nuke's mushroom: drawMushroom)
/** @param {CanvasRenderingContext2D} ctx @param {TBoom} b */
export function drawBoom(ctx, b) {
  const q = b.t / b.max, big = b.sid === 'nuke' || b.sid === 'meteor';
  const rad = b.r * (big ? 0.3 + 0.7 * Math.sqrt(q) : 0.4 + q);
  const gr = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, rad);
  const mid = b.sid === 'nuke' ? '200,255,90,' : '255,150,40,';
  gr.addColorStop(0, 'rgba(255,250,220,' + (1 - q) + ')'); gr.addColorStop(0.4, 'rgba(' + mid + (0.8 * (1 - q)) + ')');
  gr.addColorStop(1, 'rgba(200,30,0,0)');
  ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(b.x, b.y, rad, 0, 6.283); ctx.fill();
  if (!big) return;
  if (q < 0.15) { ctx.globalAlpha = 1 - q / 0.15; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.6, 0, 6.283); ctx.fill(); }
  ctx.globalAlpha = Math.max(0, 0.9 * (1 - q)); ctx.strokeStyle = b.sid === 'nuke' ? '#e8ffb0' : '#ffd8a0'; ctx.lineWidth = 3 * (1 - q) + 0.5;
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.2 + q * 1.3), 0, 6.283); ctx.stroke();
  ctx.globalAlpha = 1;
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

// (owner, after v1.0.78: "a good looking mushroom cloud") a nuke's mushroom cloud (art/titlescene.js S.mush, MushCloud): a
// column of billowing puffs rising off the blast, a cap rolling as a ring of puffs round its rim, and a dust skirt racing
// out along the ground. Hot at first (white-yellow cores, orange, dark red, lit from below), cooling to grey smoke, then
// fading. All its puffs are worked out from its seed each frame (no state but its age). sx: the scene's scroll
/** @param {CanvasRenderingContext2D} ctx @param {{ wx: number, y: number, r: number, t: number, max: number, seed: number }} m @param {number} sx */
export function drawMushroom(ctx, m, sx) {
  const t = m.t, R = m.r, x = m.wx - sx, gy = m.y;
  /** @param {number} i @param {number} k */
  const rn = (i, k) => { const v = Math.sin(i * 12.9898 + k * 78.233 + m.seed * 3.7) * 43758.5453; return v - Math.floor(v); };
  const heat = Math.exp(-t / 0.75), fade = Math.min(1, t / 0.06) * (t > m.max * 0.6 ? Math.max(0, 1 - (t - m.max * 0.6) / (m.max * 0.4)) : 1);
  if (fade <= 0) return;
  const H = R * 1.2, rise = 1 - Math.exp(-t / 0.55), capY = gy - H * rise, capR = R * 0.5 * (0.3 + 0.7 * (1 - Math.exp(-t / 0.7)));
  // a puff: a soft ball, its colour by its heat (h 0-1: smoke to white hot), darker where it's in shade (sh 0-1)
  /** @param {number} px @param {number} py @param {number} pr @param {number} h @param {number} sh */
  const puff = (px, py, pr, h, sh) => {
    if (pr < 0.5) return;
    // (white hot, orange, burnt orange, brown, then smoke; blended between, so no band shows)
    const st = [[0, 72, 68, 74], [0.12, 105, 82, 66], [0.3, 190, 100, 40], [0.5, 255, 160, 55], [0.78, 255, 240, 200], [1, 255, 252, 235]];
    let j = 1;
    while (j < st.length - 1 && h > st[j][0]) j++;
    const a0 = st[j - 1], a1 = st[j], f = Math.max(0, Math.min(1, (h - a0[0]) / (a1[0] - a0[0])));
    const c = [1, 2, 3].map(q => a0[q] + (a1[q] - a0[q]) * f);
    const k = 1 - sh * 0.45, col = c.map(v => Math.round(v * k)).join(','), hi = c.map(v => Math.round(Math.min(255, v * k * 1.25 + 12))).join(','), lo = c.map(v => Math.round(v * k * 0.55)).join(',');
    const g = ctx.createRadialGradient(px - pr * 0.25, py - pr * 0.3, pr * 0.1, px, py, pr);
    // (a lit top, its colour, a darker rim: each puff reads as a billow)
    g.addColorStop(0, 'rgba(' + hi + ',' + (0.95 * fade).toFixed(3) + ')');
    g.addColorStop(0.55, 'rgba(' + col + ',' + (0.9 * fade).toFixed(3) + ')');
    g.addColorStop(0.85, 'rgba(' + lo + ',' + (0.7 * fade).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(' + lo + ',0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, pr, 0, 6.283); ctx.fill();
  };
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';   // (drawn in the bright pass, which adds: smoke would add up to white)
  // the dust skirt along the ground
  const sk = R * 1.5 * (1 - Math.exp(-t / 0.45));
  for (let i = 0; i < 20; i++) {
    const s = (i / 19) * 2 - 1, px = x + s * sk + (rn(i, 1) - 0.5) * 6, pr = R * (0.1 + 0.07 * rn(i, 2)) * (1 - Math.abs(s) * 0.45) * (0.5 + 0.5 * rise);
    puff(px, gy - pr * 0.3, pr, heat * (1 - Math.abs(s)) * 0.6, 0.45);
  }
  // the stem: puffs from the ground up to the cap, swaying a little, hot at its foot early on
  const n = 20;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), py = gy - (gy - capY) * u, w = R * (0.12 + 0.03 * Math.sin(u * 9 + t * 3 + m.seed)) * (1 + (1 - u) * (1 - u) * 1.1) * (0.8 + 0.4 * rn(i, 8));
    const px = x + Math.sin(u * 5 + t * 1.7 + m.seed) * R * 0.035 + (rn(i, 3) - 0.5) * R * 0.09;
    puff(px, py, w, heat * (0.55 + 0.45 * (1 - u)), 0.25 + 0.3 * u);
  }
  // the cap: a ring of puffs rolling round its rim (back half first, in shade), puffs piled on top, and its hot underside
  const N = 22, P = [];
  for (let i = 0; i < N; i++) {
    const th = (i / N) * 6.283 + rn(i, 4) * 0.25, roll = th * 2 + t * 2.4;
    const px = x + Math.cos(th) * capR * (1 + 0.08 * Math.sin(roll)), py = capY + Math.sin(th) * capR * 0.3 - Math.cos(roll) * capR * 0.18;
    P.push({ px, py, pr: capR * (0.36 + 0.12 * rn(i, 5)) * (1 + 0.1 * Math.sin(roll)), z: Math.sin(th), h: heat * (0.65 + 0.35 * Math.max(0, Math.cos(roll))) });
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 6 - 0.5) * 1.6;
    P.push({ px: x + Math.sin(a) * capR * 0.7, py: capY - capR * (0.35 + 0.15 * Math.cos(a)) - rn(i, 6) * capR * 0.1, pr: capR * (0.42 + 0.1 * rn(i, 7)), z: 0.2, h: heat * 0.45 });
  }
  P.sort((a, b) => a.z - b.z);
  for (const p of P) puff(p.px, p.py, p.pr, p.h, p.z < 0 ? 0.5 : p.py < capY ? 0.05 : 0.35);   // (lit on top, shaded under the rim)
  ctx.restore();
  // the glow it throws while hot: round the cap's underside and the stem's foot
  if (heat > 0.15) {
    glowAt(ctx, x, capY + capR * 0.15, capR * 2, 0.3 * heat * fade, '255,150,60');
    glowAt(ctx, x, gy, R, 0.25 * heat * fade, '255,190,110');
  }
}
