// @ts-check
// Shots and fields in draw() (render/draw.js): the layers drawFields, drawShots and drawBeams
// (parts it calls in order; drawFields reads its frame object F, REFACTOR.md D19), and the
// looks they use: drawLook (a v95/v96 shot's own sprite, false to fall back to the streak),
// drawFieldLook (what sits in the middle of a field, false for the plain dot) and drawBolt
// (a lightning line). drawShots and drawBeams draw from the sim's Math.random stream (the
// looks, lightning, beam halos), so they stay in draw's order.

import { COL } from '../../core/consts.js';
import { jag } from '../systems/lightning.js';
import { rnd } from '../systems/shotlooks.js';

// v95: the Noita-style shots' own sprites. Returns false to fall back to the streak.
/** @param {World} W @param {GameCtx} G @param {Bullet} b */
export function drawLook(W, G, b) {
  const L = b.look, sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp, s = b.size;
  const dot = (x, y, r, c, a) => { G.ctx.globalAlpha = a; G.ctx.fillStyle = c; G.ctx.beginPath(); G.ctx.arc(x, y, r, 0, 6.283); G.ctx.fill(); };
  if (L === 'spark') {                  // pink halo, white four-point twinkle
    const tw = 0.8 + 0.2 * Math.sin(b.spin * 3);
    dot(b.x, b.y, s * 1.9, b.col, 0.35);
    G.ctx.globalAlpha = 1; G.ctx.strokeStyle = '#ffffff'; G.ctx.lineWidth = 0.7;
    const r = s * 2.2 * tw, a = b.spin * 0.6;
    G.ctx.beginPath();
    for (let k = 0; k < 2; k++) { const c = Math.cos(a + k * 1.571) * r, d = Math.sin(a + k * 1.571) * r;
      G.ctx.moveTo(b.x - c, b.y - d); G.ctx.lineTo(b.x + c, b.y + d); }
    G.ctx.stroke();
    dot(b.x, b.y, s * 0.8, '#ffffff', 1);
  } else if (L === 'crackle') {         // a jittering zig-zag tail, white-hot tip
    G.ctx.globalAlpha = 1; G.ctx.strokeStyle = b.col; G.ctx.lineWidth = 1;
    const px = -uy, py = ux; let x = b.x, y = b.y;
    G.ctx.beginPath(); G.ctx.moveTo(x, y);
    for (let k = 1; k <= 4; k++) { x = b.x - ux * k * 3.2 + px * (Math.random() - 0.5) * 4;
      y = b.y - uy * k * 3.2 + py * (Math.random() - 0.5) * 4; G.ctx.lineTo(x, y); }
    G.ctx.stroke();
    dot(b.x, b.y, s * 0.9, '#fffbe0', 1);
  } else if (L === 'ember') {           // a small magic fireball: a tail of shrinking blobs
    for (let k = 3; k >= 0; k--) dot(b.x - ux * k * 1.6, b.y - uy * k * 1.6, s * (1 - k * 0.18),
      k ? b.col : '#eaffd8', k ? 0.5 - k * 0.1 : 1);
  } else if (L === 'glob') {            // stretched by its own speed, like Noita's
    const st = 1 + Math.min(1.6, sp / 300);
    G.ctx.save(); G.ctx.translate(b.x, b.y); G.ctx.rotate(Math.atan2(b.vy, b.vx));
    G.ctx.globalAlpha = 0.45; G.ctx.fillStyle = b.col;
    G.ctx.beginPath(); G.ctx.ellipse(-s * st * 0.4, 0, s * st * 1.5, s * 1.3, 0, 0, 6.283); G.ctx.fill();
    G.ctx.globalAlpha = 1;
    G.ctx.beginPath(); G.ctx.ellipse(-s * st * 0.25, 0, s * st, s * 0.85, 0, 0, 6.283); G.ctx.fill();
    G.ctx.fillStyle = '#ffe0f6';
    G.ctx.beginPath(); G.ctx.arc(s * 0.2, -s * 0.25, s * 0.35, 0, 6.283); G.ctx.fill();
    G.ctx.restore();
  } else if (L === 'bubble') {          // a see-through bubble, wobbling, with a shine
    const r = s * 1.6, w = 1 + 0.1 * Math.sin(b.spin * 1.7);
    G.ctx.save(); G.ctx.translate(b.x, b.y);
    G.ctx.globalAlpha = 0.18; G.ctx.fillStyle = b.col;
    G.ctx.beginPath(); G.ctx.ellipse(0, 0, r * w, r / w, 0, 0, 6.283); G.ctx.fill();
    G.ctx.globalAlpha = 0.9; G.ctx.strokeStyle = b.col; G.ctx.lineWidth = 0.7; G.ctx.stroke();
    G.ctx.strokeStyle = '#ffffff'; G.ctx.lineWidth = 0.8;
    G.ctx.beginPath(); G.ctx.arc(0, 0, r * 0.68, 3.6, 4.5); G.ctx.stroke();
    G.ctx.restore();
  } else if (L === 'arrow') {           // a glowing green arrow along its flight
    const len = 7 + s, hx = b.x - ux * len, hy = b.y - uy * len, px = -uy, py = ux;
    G.ctx.globalAlpha = 0.35; G.ctx.strokeStyle = b.col; G.ctx.lineWidth = s * 2.2;
    G.ctx.beginPath(); G.ctx.moveTo(hx, hy); G.ctx.lineTo(b.x, b.y); G.ctx.stroke();
    G.ctx.globalAlpha = 1; G.ctx.strokeStyle = '#d8ffc8'; G.ctx.lineWidth = 0.9;
    G.ctx.beginPath(); G.ctx.moveTo(hx, hy); G.ctx.lineTo(b.x, b.y); G.ctx.stroke();
    G.ctx.fillStyle = b.col;
    G.ctx.beginPath(); G.ctx.moveTo(b.x + ux * 2.5, b.y + uy * 2.5);
    G.ctx.lineTo(b.x - ux * 2 + px * 2, b.y - uy * 2 + py * 2);
    G.ctx.lineTo(b.x - ux * 2 - px * 2, b.y - uy * 2 - py * 2); G.ctx.fill();
    G.ctx.strokeStyle = b.col; G.ctx.lineWidth = 0.8;       // fletching
    G.ctx.beginPath(); G.ctx.moveTo(hx, hy); G.ctx.lineTo(hx - ux * 2 + px * 1.8, hy - uy * 2 + py * 1.8);
    G.ctx.moveTo(hx, hy); G.ctx.lineTo(hx - ux * 2 - px * 1.8, hy - uy * 2 - py * 1.8); G.ctx.stroke();
  } else if (L === 'drill') {           // a spinning bit
    G.ctx.save(); G.ctx.translate(b.x, b.y); G.ctx.rotate(Math.atan2(b.vy, b.vx));
    const sq = Math.cos(b.spin * 2.5);
    G.ctx.globalAlpha = 1; G.ctx.fillStyle = '#3d5f9a';
    G.ctx.beginPath(); G.ctx.moveTo(4, 0); G.ctx.lineTo(-2, 2.2); G.ctx.lineTo(-2, -2.2); G.ctx.fill();
    G.ctx.strokeStyle = b.col; G.ctx.lineWidth = 0.7;
    G.ctx.beginPath(); G.ctx.moveTo(-1 + sq, -1.8); G.ctx.lineTo(1 + sq, 1.2); G.ctx.moveTo(1.5 - sq * 0.5, -1); G.ctx.lineTo(2.8 - sq * 0.5, 0.6);
    G.ctx.stroke();
    G.ctx.restore();
  } else if (L === 'sparks') {          // no body at all, just its blue streak
    dot(b.x, b.y, s * 0.8, '#ffffff', 1);
  } else if (L === 'heavy') {           // Magic Bolt: a green-gold ball with a spitting tail
    for (let k = 3; k >= 0; k--) dot(b.x - ux * k * 2, b.y - uy * k * 2, s * (1 - k * 0.2) * 0.8,
      k ? b.col : '#fffbd0', k ? 0.45 - k * 0.1 : 1);
    dot(b.x, b.y, s * 1.3, b.col, 0.25);
  } else if (L === 'lance') {           // a long spear with a bright head
    const len = 12 + s * 2, tx = b.x - ux * len, ty = b.y - uy * len;
    G.ctx.globalAlpha = 0.3; G.ctx.strokeStyle = b.col; G.ctx.lineWidth = s * 2.4;
    G.ctx.beginPath(); G.ctx.moveTo(tx, ty); G.ctx.lineTo(b.x, b.y); G.ctx.stroke();
    G.ctx.globalAlpha = 1; G.ctx.lineWidth = s * 0.8;
    G.ctx.beginPath(); G.ctx.moveTo(tx, ty); G.ctx.lineTo(b.x, b.y); G.ctx.stroke();
    G.ctx.strokeStyle = '#ffffff'; G.ctx.lineWidth = s * 0.5;
    G.ctx.beginPath(); G.ctx.moveTo(b.x - ux * 4, b.y - uy * 4); G.ctx.lineTo(b.x + ux * 2, b.y + uy * 2); G.ctx.stroke();
  } else if (L === 'rubber') {          // a shiny ball, squashed along its flight
    const sq = 1 + Math.min(0.35, sp / 2000);
    G.ctx.save(); G.ctx.translate(b.x, b.y); G.ctx.rotate(Math.atan2(b.vy, b.vx));
    G.ctx.globalAlpha = 1; G.ctx.fillStyle = b.col;
    G.ctx.beginPath(); G.ctx.ellipse(0, 0, s * sq, s / sq, 0, 0, 6.283); G.ctx.fill();
    G.ctx.restore();
    dot(b.x - s * 0.35, b.y - s * 0.35, s * 0.35, '#fff6d8', 1);
  } else if (L === 'bomb') {            // a black bomb, a cap, and the fizzing fuse
    const a = b.spin * 0.5 - 1.2, cx = Math.cos(a), cy = Math.sin(a);
    dot(b.x, b.y, s * 1.15, '#1e1d24', 1);
    dot(b.x - s * 0.35, b.y - s * 0.4, s * 0.3, '#6a6878', 1);
    G.ctx.globalAlpha = 1; G.ctx.strokeStyle = '#8a7a60'; G.ctx.lineWidth = 0.8;
    G.ctx.beginPath(); G.ctx.moveTo(b.x + cx * s, b.y + cy * s); G.ctx.lineTo(b.x + cx * s * 1.6, b.y + cy * s * 1.6); G.ctx.stroke();
    const tw = Math.sin(W.time * 40) > 0;
    dot(b.x + cx * s * 1.7, b.y + cy * s * 1.7, tw ? 1 : 0.7, tw ? '#ffffff' : '#ffb347', 1);
  } else if (L === 'rocket') {          // a little rocket: body, fins, and a flickering flame
    G.ctx.save(); G.ctx.translate(b.x, b.y); G.ctx.rotate(Math.atan2(b.vy, b.vx));
    const fl = 2.5 + Math.random() * 2.5 + Math.min(4, sp / 200);
    G.ctx.globalAlpha = 0.9; G.ctx.fillStyle = '#ffb347';
    G.ctx.beginPath(); G.ctx.moveTo(-3, -1.3); G.ctx.lineTo(-3 - fl, 0); G.ctx.lineTo(-3, 1.3); G.ctx.fill();
    G.ctx.fillStyle = '#fff2c0';
    G.ctx.beginPath(); G.ctx.moveTo(-3, -0.7); G.ctx.lineTo(-3 - fl * 0.5, 0); G.ctx.lineTo(-3, 0.7); G.ctx.fill();
    G.ctx.globalAlpha = 1; G.ctx.fillStyle = '#d8d4dc'; G.ctx.fillRect(-3, -1.2, 5, 2.4);
    G.ctx.fillStyle = b.col; G.ctx.beginPath(); G.ctx.moveTo(2, -1.2); G.ctx.lineTo(4, 0); G.ctx.lineTo(2, 1.2); G.ctx.fill();
    G.ctx.fillStyle = '#a04030'; G.ctx.beginPath(); G.ctx.moveTo(-3, -1.2); G.ctx.lineTo(-4.2, -2.4); G.ctx.lineTo(-1.5, -1.2);
    G.ctx.moveTo(-3, 1.2); G.ctx.lineTo(-4.2, 2.4); G.ctx.lineTo(-1.5, 1.2); G.ctx.fill();
    G.ctx.restore();
  } else if (L === 'flame') {           // a ball of flame: flickering layers, white-hot heart
    const f = 1 + 0.15 * Math.sin(b.spin * 3.1) + 0.1 * Math.random();
    dot(b.x - ux * s * 0.5, b.y - uy * s * 0.5, s * 1.5 * f, '#e8461c', 0.45);
    dot(b.x, b.y, s * 1.1 * f, b.col, 0.85);
    dot(b.x + ux * s * 0.2, b.y + uy * s * 0.2, s * 0.65, '#ffd35a', 1);
    dot(b.x + ux * s * 0.3, b.y + uy * s * 0.3, s * 0.3, '#fffbe0', 1);
  } else if (L === 'orb') {             // a glowing energy sphere, pulsing
    const pu = 1 + 0.1 * Math.sin(b.spin * 2);
    dot(b.x, b.y, s * 1.8 * pu, b.col, 0.25);
    dot(b.x, b.y, s * pu, b.col, 0.9);
    dot(b.x, b.y, s * 0.5, '#f0f8ff', 1);
  } else if (L === 'chain') {           // a violet orb with arcs flickering round it
    dot(b.x, b.y, s * 1.8, b.col, 0.3);
    dot(b.x, b.y, s * 0.9, '#f4e0ff', 1);
    G.ctx.globalAlpha = 0.9; G.ctx.strokeStyle = b.col; G.ctx.lineWidth = 0.6;
    G.ctx.beginPath();
    for (let k = 0; k < 3; k++) { let a = Math.random() * 6.283, r = s;
      G.ctx.moveTo(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r);
      for (let q = 0; q < 3; q++) { a += rnd(-0.6, 0.6); r += 1.4; G.ctx.lineTo(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r); } }
    G.ctx.stroke();
  } else if (L === 'cross') {           // a glowing cross, tumbling
    const r = s * 2, a = b.spin * 0.8;
    G.ctx.save(); G.ctx.translate(b.x, b.y); G.ctx.rotate(a);
    G.ctx.globalAlpha = 0.35; G.ctx.strokeStyle = b.col; G.ctx.lineWidth = s * 1.6; G.ctx.lineCap = 'round';
    G.ctx.beginPath(); G.ctx.moveTo(-r, 0); G.ctx.lineTo(r, 0); G.ctx.moveTo(0, -r); G.ctx.lineTo(0, r); G.ctx.stroke();
    G.ctx.globalAlpha = 1; G.ctx.strokeStyle = '#e8fbff'; G.ctx.lineWidth = s * 0.55;
    G.ctx.beginPath(); G.ctx.moveTo(-r, 0); G.ctx.lineTo(r, 0); G.ctx.moveTo(0, -r); G.ctx.lineTo(0, r); G.ctx.stroke();
    G.ctx.restore();
  } else if (L === 'disc') {            // a spinning sawblade
    const r = s, a = b.spin * 2.2;
    G.ctx.save(); G.ctx.translate(b.x, b.y); G.ctx.rotate(a);
    G.ctx.globalAlpha = 1; G.ctx.fillStyle = b.col;
    G.ctx.beginPath();
    for (let k = 0; k < 16; k++) { const rr = k % 2 ? r * 0.78 : r * 1.12, t = k / 16 * 6.283; G.ctx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr); }
    G.ctx.fill();
    G.ctx.fillStyle = '#6a6e78'; G.ctx.beginPath(); G.ctx.arc(0, 0, r * 0.35, 0, 6.283); G.ctx.fill();
    G.ctx.restore();
  } else if (L === 'nuke') {            // a fat yellow shell with a blinking red light
    G.ctx.save(); G.ctx.translate(b.x, b.y); G.ctx.rotate(Math.atan2(b.vy, b.vx));
    G.ctx.globalAlpha = 1; G.ctx.fillStyle = '#e8d24a';
    G.ctx.beginPath(); G.ctx.ellipse(0, 0, s * 1.3, s * 0.85, 0, 0, 6.283); G.ctx.fill();
    G.ctx.fillStyle = '#2a2a2a';
    for (let k = 0; k < 3; k++) { const t = k * 2.094 + b.spin * 0.3;
      G.ctx.beginPath(); G.ctx.moveTo(0, 0); G.ctx.arc(0, 0, s * 0.6, t, t + 0.8); G.ctx.fill(); }
    G.ctx.fillStyle = '#6a6a58'; G.ctx.fillRect(-s * 1.7, -s * 0.8, s * 0.5, s * 1.6);
    G.ctx.restore();
    if (Math.sin(W.time * 12) > 0) dot(b.x + ux * s * 1.2, b.y + uy * s * 1.2, 0.9, '#ff3a2a', 1);
  } else if (L === 'pollen') {          // a fuzzy puff
    for (let k = 0; k < 7; k++) { const a = k * 0.9 + b.spin * 0.3, r = s * (0.9 + 0.3 * Math.sin(k * 2.1 + b.spin));
      dot(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, 0.7, k % 2 ? b.col : '#f4ffb0', 0.9); }
    dot(b.x, b.y, s * 0.7, '#ffe98a', 1);
  } else return false;
  G.ctx.globalAlpha = 1;
  return true;
}

// The White Hole (v0.0.137): the Black Hole's look turned inside out and very small: a pale blue
// haze round a white-hot core with blue stars wheeling in it, fading in and out with its life.
// Its size follows its radius (Enlarge / Shrink).
/** @param {World} W @param {GameCtx} G @param {Field} f */
export function drawWhiteHole(W, G, f) {
  const core = Math.max(1.5, f.r * 0.055), fade = Math.min(1, (f.max - f.life) * 8, f.life * 5);
  const beat = 1 + 0.08 * Math.sin(W.time * 9 + f.x), R = core * 3 * beat;
  G.ctx.save();
  G.ctx.globalCompositeOperation = 'lighter';
  const g = G.ctx.createRadialGradient(f.x, f.y, core * 0.6, f.x, f.y, R);
  g.addColorStop(0, 'rgba(200,236,255,' + (0.8 * fade) + ')');
  g.addColorStop(0.35, 'rgba(110,190,255,' + (0.35 * fade) + ')');
  g.addColorStop(1, 'rgba(60,140,255,0)');
  G.ctx.fillStyle = g;
  G.ctx.beginPath(); G.ctx.arc(f.x, f.y, R, 0, Math.PI * 2); G.ctx.fill();
  G.ctx.globalAlpha = fade;
  G.ctx.fillStyle = '#ffffff';
  G.ctx.beginPath(); G.ctx.arc(f.x, f.y, core, 0, Math.PI * 2); G.ctx.fill();
  for (let k = 0; k < 6; k++) {           // blue stars wheeling round the core
    const tw = Math.sin(W.time * 8 + k * 1.7);
    if (tw < 0.1) continue;
    const ang = k * 2.4 - W.time * (2 + (k % 3)), rad = core * (1.1 + ((k * 0.37) % 0.9));
    G.ctx.globalAlpha = tw * fade;
    G.ctx.fillStyle = k % 2 ? '#7cc4ff' : '#c8ecff';
    G.ctx.fillRect(f.x + Math.cos(ang) * rad - 0.4, f.y + Math.sin(ang) * rad - 0.4, 0.8, 0.8);
  }
  G.ctx.globalAlpha = 0.7 * fade;
  G.ctx.strokeStyle = '#8fd0ff'; G.ctx.lineWidth = 0.6;
  G.ctx.beginPath(); G.ctx.arc(f.x, f.y, core * 1.15, 0, Math.PI * 2); G.ctx.stroke();
  G.ctx.restore();
}

// v96: what sits in the middle of a field (or over it)
/** @param {World} W @param {GameCtx} G @param {Field} f @param {number} beat */
export function drawFieldLook(W, G, f, beat) {
  const dia = (r, c, c2) => { G.ctx.fillStyle = c; G.ctx.beginPath(); G.ctx.moveTo(f.x, f.y - r * 1.4); G.ctx.lineTo(f.x + r, f.y);
    G.ctx.lineTo(f.x, f.y + r * 1.4); G.ctx.lineTo(f.x - r, f.y); G.ctx.fill();
    G.ctx.fillStyle = c2; G.ctx.beginPath(); G.ctx.moveTo(f.x, f.y - r * 1.4); G.ctx.lineTo(f.x + r * 0.45, f.y - r * 0.2);
    G.ctx.lineTo(f.x - r * 0.2, f.y); G.ctx.fill(); };
  if (f.field === 'mine') {               // a red crystal, blinking faster when something's close
    dia(3.2, '#c8302a', '#ff9a90');
    const bl = f.near ? 18 : 5;
    if (Math.sin(W.time * bl) > 0.3) { G.ctx.globalAlpha = 0.9; G.ctx.fillStyle = '#ffffff'; G.ctx.fillRect(f.x - 0.6, f.y - 0.6, 1.2, 1.2); }
  } else if (f.field === 'dormant') {     // a dull orange crystal
    dia(3, '#b86a1c', '#ffd08a');
  } else if (f.field === 'slow') {        // an ice-white star
    G.ctx.strokeStyle = '#e8f8ff'; G.ctx.lineWidth = 0.8;
    G.ctx.beginPath();
    for (let k = 0; k < 3; k++) { const a = k * 1.047 + W.time * 0.4; G.ctx.moveTo(f.x - Math.cos(a) * 4, f.y - Math.sin(a) * 4); G.ctx.lineTo(f.x + Math.cos(a) * 4, f.y + Math.sin(a) * 4); }
    G.ctx.stroke();
  } else if (f.field === 'shield') {      // two shimmering arcs turning against each other
    G.ctx.strokeStyle = f.col; G.ctx.lineWidth = 1.2; G.ctx.globalAlpha = 0.7 * beat;
    for (const [a0, sgn] of [[W.time * 1.3, 1], [-W.time * 1.7, -1]]) {
      G.ctx.beginPath(); G.ctx.arc(f.x, f.y, f.r * (sgn > 0 ? 0.92 : 0.84), a0, a0 + 2.2); G.ctx.stroke();
      G.ctx.beginPath(); G.ctx.arc(f.x, f.y, f.r * (sgn > 0 ? 0.92 : 0.84), a0 + 3.14, a0 + 5.3); G.ctx.stroke(); }
    G.ctx.globalAlpha = 1;
    G.ctx.fillStyle = '#d8f0ff'; G.ctx.beginPath(); G.ctx.arc(f.x, f.y, 2.5, 0, 6.283); G.ctx.fill();
  } else if (f.field === 'heal') {        // a green cross
    G.ctx.fillStyle = f.col; G.ctx.fillRect(f.x - 1.2, f.y - 4, 2.4, 8); G.ctx.fillRect(f.x - 4, f.y - 1.2, 8, 2.4);
  } else if (f.field === 'storm') {       // the cloud itself, over the top of the circle, with rain under it
    const cy = f.y - f.r * 0.85, t = Math.min(1, (f.max - f.life) * 3, f.life * 2);
    G.ctx.globalAlpha = 0.85 * t;
    for (let k = 0; k < 7; k++) { const ox = (k - 3) * f.r * 0.28, oy = Math.sin(k * 1.7 + W.time * 0.8) * 2.5;
      G.ctx.fillStyle = k % 2 ? '#3a3e4a' : '#4c5160';
      G.ctx.beginPath(); G.ctx.arc(f.x + ox, cy + oy, f.r * (0.22 + 0.08 * Math.sin(k * 2.3)), 0, 6.283); G.ctx.fill(); }
    G.ctx.globalAlpha = 0.35 * t; G.ctx.strokeStyle = '#9ec8ff'; G.ctx.lineWidth = 0.6;
    G.ctx.beginPath();
    for (let k = 0; k < 18; k++) { const x = f.x + (((k * 37.3 + W.time * 15) % (f.r * 1.8)) - f.r * 0.9),
      y = cy + ((k * 23.7 + W.time * 160) % (f.r * 1.7));
      G.ctx.moveTo(x, y); G.ctx.lineTo(x - 0.6, y + 4); }
    G.ctx.stroke();
    G.ctx.globalAlpha = 1;
  } else if (f.field === 'glitter') {     // twinkling violet motes all over
    for (let k = 0; k < 10; k++) { const a = k * 2.4 + W.time * 0.3, r = f.r * ((k * 0.37) % 1);
      const tw = Math.sin(W.time * 9 + k * 1.3); if (tw < 0.2) continue;
      G.ctx.globalAlpha = tw; G.ctx.fillStyle = k % 3 ? '#e0a0ff' : '#ffffff';
      G.ctx.fillRect(f.x + Math.cos(a) * r - 0.7, f.y + Math.sin(a) * r - 0.7, 1.4, 1.4); }
    G.ctx.globalAlpha = 1;
  } else return false;
  return true;
}

// a lightning line: a wide soft glow, then a thin white-hot core
/** @param {GameCtx} G @param {Pt[]} pts @param {string} col @param {number} w @param {number} alpha */
export function drawBolt(G, pts, col, w, alpha) {
  G.ctx.save();
  G.ctx.globalCompositeOperation = 'lighter';
  G.ctx.lineJoin = 'miter'; G.ctx.lineCap = 'round';
  const path = () => { G.ctx.beginPath(); G.ctx.moveTo(pts[0].x, pts[0].y);
    for (let k = 1; k < pts.length; k++) G.ctx.lineTo(pts[k].x, pts[k].y); G.ctx.stroke(); };
  G.ctx.strokeStyle = col;
  G.ctx.globalAlpha = alpha * 0.25; G.ctx.lineWidth = w * 5; path();
  G.ctx.globalAlpha = alpha * 0.7; G.ctx.lineWidth = w * 1.8; path();
  G.ctx.strokeStyle = '#ffffff'; G.ctx.globalAlpha = alpha; G.ctx.lineWidth = w * 0.7; path();
  G.ctx.restore();
}

// Static fields: a pulsing disc, a dashed ring shrinking as it runs out, and what sits in the
// middle (drawFieldLook, or a plain dot)
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawFields(W, G, F) {
  const { vh } = F;
  // static fields
  for (const f of W.fields) {
    if (f.y > W.camY + vh + f.r || f.y < W.camY - f.r) continue;
    if (f.field === 'vacuum') { drawWhiteHole(W, G, f); continue; }   // no circle: its motes show its reach
    const t = f.life / f.max;
    const beat = 0.75 + 0.25 * Math.sin(W.time * (f.field === 'mine' ? 7 : 3));
    G.ctx.globalAlpha = 0.14 * beat * (f.field === 'mine' || f.field === 'dormant' ? 2 : 1);
    G.ctx.fillStyle = f.col;
    G.ctx.beginPath(); G.ctx.arc(f.x, f.y, f.r * (f.field === 'mine' ? 0.35 : 1), 0, Math.PI * 2); G.ctx.fill();
    G.ctx.globalAlpha = 0.55 * beat;
    G.ctx.strokeStyle = f.col;
    G.ctx.lineWidth = 1.5;
    G.ctx.setLineDash([5, 4]);
    G.ctx.lineDashOffset = -W.time * 14;
    G.ctx.beginPath(); G.ctx.arc(f.x, f.y, f.r * (0.4 + 0.6 * t), 0, Math.PI * 2); G.ctx.stroke();
    G.ctx.setLineDash([]);
    G.ctx.globalAlpha = 1;
    if (!drawFieldLook(W, G, f, beat)) { G.ctx.fillStyle = f.col; G.ctx.beginPath(); G.ctx.arc(f.x, f.y, 3.5, 0, Math.PI * 2); G.ctx.fill(); }
  }
  G.ctx.globalAlpha = 1;
  G.ctx.globalAlpha = 1;
}

// Shots in flight: the creatures' (poison spit as a glob), yours (Black Hole, a look, a lightning
// bolt, or a streak as long as its speed), and the lightning arcs
/** @param {World} W @param {GameCtx} G */
export function drawShots(W, G) {
  // projectiles
  for (const b of W.enemyShots) {
    if (b.goo) {                           // poison spit: a wobbling glob with a wet highlight
      const s = b.size, wob = 1 + 0.12 * Math.sin(W.time * 30 + b.x * 0.1);
      G.ctx.save(); G.ctx.translate(b.x, b.y); G.ctx.rotate(Math.atan2(b.vy, b.vx));
      G.ctx.fillStyle = b.edge || '#123d18';
      G.ctx.beginPath(); G.ctx.ellipse(0, 0, s * 1.45 * wob, s * 1.05 / wob, 0, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.fillStyle = b.col;
      G.ctx.beginPath(); G.ctx.ellipse(-s * 0.08, 0, s * 1.2 * wob, s * 0.82 / wob, 0, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.fillStyle = b.shine || '#e6ffb8';
      G.ctx.beginPath(); G.ctx.arc(s * 0.3, -s * 0.28, s * 0.32, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.restore();
      continue;
    }
    G.ctx.fillStyle = b.col;
    G.ctx.beginPath(); G.ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2); G.ctx.fill();
  }
  // shots are drawn as streaks along their own velocity, so a fast one reads
  // as a long dash and a slow heavy one as a stub
  G.ctx.lineCap = 'round';
  for (const b of W.bullets) {
    if (b.hidden) continue;                 // Buzzsaw cuts without drawing a circle
    if (b.pull) {                           // Black Hole: purple haze, starry black core
      const r = b.size, core = b.eat || r * 0.78, beat = 1 + 0.06 * Math.sin(W.time * 6 + b.spin);
      const g = G.ctx.createRadialGradient(b.x, b.y, core * 0.8, b.x, b.y, r * 1.55 * beat);
      g.addColorStop(0, 'rgba(197,140,255,0.75)');
      g.addColorStop(0.3, 'rgba(150,90,255,0.35)');
      g.addColorStop(1, 'rgba(110,50,220,0)');
      G.ctx.fillStyle = g;
      G.ctx.beginPath(); G.ctx.arc(b.x, b.y, r * 1.55 * beat, 0, Math.PI * 2); G.ctx.fill();
      G.ctx.fillStyle = '#050208';
      G.ctx.beginPath(); G.ctx.arc(b.x, b.y, core, 0, Math.PI * 2); G.ctx.fill();
      for (let k = 0; k < 14; k++) {       // twinkling stars wheeling inside
        const tw = Math.sin(W.time * 8 + k * 1.7);
        if (tw < 0.1) continue;
        const ang = k * 2.4 + W.time * (0.5 + (k % 3) * 0.35), rad = core * (0.15 + ((k * 0.37) % 0.75));
        const sx = b.x + Math.cos(ang) * rad, sy = b.y + Math.sin(ang) * rad, sz = 0.6 + tw * 0.9;
        G.ctx.globalAlpha = tw;
        G.ctx.fillStyle = k % 3 ? '#e6d4ff' : '#ffffff';
        G.ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
      }
      G.ctx.globalAlpha = 0.8;
      G.ctx.strokeStyle = '#b98aff'; G.ctx.lineWidth = 1.2;
      G.ctx.beginPath(); G.ctx.arc(b.x, b.y, core, 0, Math.PI * 2); G.ctx.stroke();
      G.ctx.globalAlpha = 1;
      continue;
    }
    if (b.look && drawLook(W, G, b)) continue;
    if (b.arc && b.trail && b.trail.length > 1) {   // lightning: a fresh zig-zag every frame
      drawBolt(G, jag(b.trail.concat([{ x: b.x, y: b.y }]), 5), b.col, 1.6, 1);
      continue;
    }
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const len = Math.max(0.5, Math.min(46, sp * 0.022));   // length is speed alone
    const hx = b.vx / sp * len, hy = b.vy / sp * len;
    if (b.homing) {
      G.ctx.globalAlpha = 0.3;
      G.ctx.strokeStyle = COL.enemy;
      G.ctx.lineWidth = b.size * 1.7 + 4;
      G.ctx.beginPath(); G.ctx.moveTo(b.x - hx, b.y - hy); G.ctx.lineTo(b.x, b.y); G.ctx.stroke();
      G.ctx.globalAlpha = 1;
    }
    G.ctx.strokeStyle = b.col;
    G.ctx.lineWidth = b.size * 1.7;
    G.ctx.beginPath(); G.ctx.moveTo(b.x - hx, b.y - hy); G.ctx.lineTo(b.x, b.y); G.ctx.stroke();
    if (b.explode) {
      G.ctx.fillStyle = Math.sin(b.spin) > 0 ? COL.flame2 : COL.visor;
      G.ctx.fillRect(b.x - 1, b.y - 1, 2, 2);
    }
  }
  for (const a of W.arcs) drawBolt(G, a.pts, a.col, a.w, 1 - a.t / a.max);
}

// Instant beams, fading over a few frames (a v96 beam with a look has a wavering halo)
/** @param {World} W @param {GameCtx} G */
export function drawBeams(W, G) {
  // instant beams, which fade over a few frames
  for (const bm of W.beams) {
    const fade = 1 - bm.t / 0.12;
    if (bm.look) {                          // v96: a wide wavering halo under the beam
      G.ctx.globalAlpha = fade * 0.18;
      G.ctx.strokeStyle = bm.col; G.ctx.lineWidth = bm.w * (7 + Math.random() * 2);
      G.ctx.beginPath(); G.ctx.moveTo(bm.x, bm.y); G.ctx.lineTo(bm.x + bm.nx * bm.len, bm.y + bm.ny * bm.len); G.ctx.stroke();
    }
    G.ctx.globalAlpha = fade * 0.35;
    G.ctx.strokeStyle = bm.col; G.ctx.lineWidth = bm.w * 3.5;
    G.ctx.beginPath(); G.ctx.moveTo(bm.x, bm.y);
    G.ctx.lineTo(bm.x + bm.nx * bm.len, bm.y + bm.ny * bm.len); G.ctx.stroke();
    G.ctx.globalAlpha = fade;
    G.ctx.lineWidth = bm.w * 1.2;
    G.ctx.beginPath(); G.ctx.moveTo(bm.x, bm.y);
    G.ctx.lineTo(bm.x + bm.nx * bm.len, bm.y + bm.ny * bm.len); G.ctx.stroke();
  }
  G.ctx.globalAlpha = 1;
}
