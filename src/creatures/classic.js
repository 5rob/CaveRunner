// @ts-check
// Sprites for the creatures not reworked yet (each still one shared body): the drone,
// crawler, blob, skull and worm.

import { rr } from '../core/util.js';

// The enemies, one sprite per body. Every one of them takes the same colour set
// ({ a main, b dark, c light, eye }) so a creature's identity is carried by shape and
// colour together, and a flash on hit is the same white for all of them.
//
// The drone: a hovering gunner with one big eye that follows you around.
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r @param {number} lx @param {number} ly where it looks @param {number} time @param {number} phase @param {boolean} flash @param {CreatureCol} col */
export function drawDrone(ctx, x, y, r, lx, ly, time, phase, flash, col) {
  const shell = flash ? '#f4f0ff' : col.b;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lx * 0.22);
  // thruster wash underneath
  const puff = 0.55 + 0.25 * Math.sin(time * 9 + phase);
  ctx.globalAlpha = 0.3 * puff;
  ctx.fillStyle = col.a;
  ctx.beginPath(); ctx.ellipse(0, r * 0.9, r * 0.45, r * 0.8 * puff, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // stubby fins, drawn first so they read as sticking out of the hull
  ctx.fillStyle = flash ? '#e6e0f5' : col.b;
  rr(ctx, -r * 1.52, -r * 0.4, r * 0.62, r * 0.9, r * 0.22); ctx.fill();
  rr(ctx, r * 0.9, -r * 0.4, r * 0.62, r * 0.9, r * 0.22); ctx.fill();
  rr(ctx, -r * 0.34, r * 0.5, r * 0.68, r * 0.5, r * 0.18); ctx.fill();    // vent
  // hull
  ctx.fillStyle = shell;
  rr(ctx, -r * 1.05, -r * 0.78, r * 2.1, r * 1.5, r * 0.62); ctx.fill();
  ctx.strokeStyle = flash ? '#ffffff' : col.a;
  ctx.lineWidth = r * 0.14;
  rr(ctx, -r * 1.05, -r * 0.78, r * 2.1, r * 1.5, r * 0.62); ctx.stroke();
  ctx.fillStyle = flash ? '#ffffff' : col.c;
  rr(ctx, -r * 0.72, -r * 0.7, r * 1.44, r * 0.46, r * 0.22); ctx.fill();  // canopy
  ctx.restore();
  // the eye sits in the hull and swivels to keep you in view
  const ex = x + lx * r * 0.34, ey = y + ly * r * 0.26;
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = col.a;
  ctx.beginPath(); ctx.arc(ex, ey, r * 0.62, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = flash ? '#ffffff' : col.eye;
  ctx.beginPath(); ctx.arc(ex, ey, r * 0.36, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1b1526';
  ctx.beginPath(); ctx.arc(ex + lx * r * 0.15, ey + ly * r * 0.15, r * 0.16, 0, Math.PI * 2); ctx.fill();
}

// The crawler: a low body on six legs that scuttle as it walks. Spiders, hounds,
// kobolds and the armoured Lohkare all wear this one.
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r @param {number} lx @param {number} ly where it looks @param {number} time @param {number} phase @param {boolean} flash @param {CreatureCol} col */
export function drawCrawler(ctx, x, y, r, lx, ly, time, phase, flash, col) {
  const s = Math.sin(time * 7 + phase);
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = flash ? '#ffffff' : col.b;
  ctx.lineWidth = r * 0.2; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const o = (i - 1) * r * 0.5, sw = s * r * 0.26 * (i % 2 ? 1 : -1);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(o * 0.6, 0);
      ctx.lineTo(o * 0.6 + side * r * 0.8, side * r * 0.5 + sw);
      ctx.lineTo(o * 0.6 + side * r * 1.3, side * r * 0.95 - sw * 0.5);
      ctx.stroke();
    }
  }
  ctx.fillStyle = flash ? '#f4f0ff' : col.b;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? '#ffffff' : col.a;
  ctx.beginPath(); ctx.ellipse(0, -r * 0.12, r * 0.82, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  for (const side of [-1, 1]) {
    ctx.fillStyle = flash ? '#ffffff' : col.eye;
    ctx.beginPath(); ctx.arc(x + lx * r * 0.35 + side * r * 0.3, y + ly * r * 0.25, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The blob: a wobbling sac with two eyes. Slimes, toads and the fungal turret.
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r @param {number} lx @param {number} ly where it looks @param {number} time @param {number} phase @param {boolean} flash @param {CreatureCol} col */
export function drawBlob(ctx, x, y, r, lx, ly, time, phase, flash, col) {
  const wob = 1 + 0.09 * Math.sin(time * 3.4 + phase);
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = col.a;
  ctx.beginPath(); ctx.ellipse(0, r * 0.85, r * 0.72, r * 0.26, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = flash ? '#f4f0ff' : col.b;
  ctx.beginPath(); ctx.ellipse(0, r * 0.18, r * 1.0, r * 0.92 * wob, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? '#ffffff' : col.a;
  ctx.beginPath(); ctx.ellipse(0, r * 0.3, r * 0.76, r * 0.66 * wob, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#1b1526';
    ctx.beginPath(); ctx.arc(x + lx * r * 0.3 + side * r * 0.26, y + r * 0.12 + ly * r * 0.18,
      r * 0.15, 0, Math.PI * 2); ctx.fill();
  }
}

// The skull: bone, a jaw, and a halo of whatever it is made of. The Jäätiö and the
// living bones are both this, one frozen blue and one bare.
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r @param {number} lx @param {number} ly where it looks @param {number} time @param {number} phase @param {boolean} flash @param {CreatureCol} col */
export function drawSkull(ctx, x, y, r, lx, ly, time, phase, flash, col) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lx * 0.18);
  ctx.globalAlpha = 0.26 + 0.1 * Math.sin(time * 4 + phase);
  ctx.fillStyle = col.a;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.55, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = flash ? '#ffffff' : col.a;
  ctx.beginPath(); ctx.ellipse(0, -r * 0.15, r * 0.85, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  rr(ctx, -r * 0.55, r * 0.4, r * 1.1, r * 0.55, r * 0.2); ctx.fill();      // jaw
  ctx.fillStyle = '#1b1526';
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(side * r * 0.34, -r * 0.18, r * 0.24, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = col.eye;
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.arc(side * r * 0.34 + lx * r * 0.1, -r * 0.18 + ly * r * 0.1,
      r * 0.11, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// The worm: a chain of segments that trails behind wherever the head is pointing.
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r @param {number} lx @param {number} ly where it looks @param {number} time @param {number} phase @param {boolean} flash @param {CreatureCol} col */
export function drawWorm(ctx, x, y, r, lx, ly, time, phase, flash, col) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(ly, lx));
  for (let i = 4; i >= 0; i--) {
    const t = i / 4, off = -r * 1.5 * i * 0.62, w = r * (1 - t * 0.4);
    ctx.fillStyle = flash ? '#ffffff' : (i % 2 ? col.b : col.a);
    ctx.beginPath();
    ctx.ellipse(off, Math.sin(time * 6 + phase - i * 0.7) * r * 0.34, w * 0.62, w, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#1b1526';
  ctx.beginPath(); ctx.arc(r * 0.55, 0, r * 0.26, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
