// @ts-check
// The player's and the world's sprites, all drawn from canvas primitives at world scale:
// the runner, guns (and a new gun's glow), the torch flame, wall sconces, glowAt.

import { COL } from '../core/consts.js';
import { rr } from '../core/util.js';

// ---- sprites ----
// Everything is drawn from primitives at world scale (the player is 12x22 units),
// so it stays crisp at any zoom and there are no images to load.

// A gun, grip at the origin, barrel down +x. Scaled so the same drawing works for
// the one in your hands and the little one lying on the cave floor.
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} ang @param {number} sc @param {string} accent */
export function drawGun(ctx, x, y, ang, sc, accent) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  if (Math.cos(ang) < 0) ctx.scale(1, -1);     // aiming left: flip, don't hang upside down
  ctx.scale(sc, sc);
  ctx.fillStyle = '#20242c';                    // stock and grip
  rr(ctx, -6.5, -4.6, 4.5, 3.6, 1.2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-1.4, -1.2); ctx.lineTo(1.8, -1.2); ctx.lineTo(0.9, 4.6); ctx.lineTo(-2.2, 4.2);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3c424e';                    // magazine
  ctx.beginPath();
  ctx.moveTo(2.2, -1); ctx.lineTo(5, -1); ctx.lineTo(4.4, 3.4); ctx.lineTo(1.8, 3.4);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4a515f';                    // receiver
  rr(ctx, -4.4, -5.2, 10.5, 4.4, 1.3); ctx.fill();
  ctx.fillStyle = '#5f6878';                    // barrel
  rr(ctx, 5.5, -4.4, 7.5, 2.4, 1); ctx.fill();
  ctx.fillStyle = '#343a45';                    // sight
  rr(ctx, 0.5, -6.6, 2.4, 1.6, 0.6); ctx.fill();
  ctx.fillStyle = accent || COL.bullet;         // muzzle and a flash of the gun's colour
  rr(ctx, 12.4, -5, 1.8, 3.6, 0.7); ctx.fill();
  rr(ctx, -3.4, -4.4, 2.6, 2.6, 0.8); ctx.fill();
  ctx.restore();
}

// The runner: jetpack on the back, sealed helmet, legs that actually move.
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} w @param {number} hh @param {number} face @param {number} gait @param {boolean} air @param {number} jet @param {boolean} flash */
export function drawRunner(ctx, x, y, w, hh, face, gait, air, jet, flash) {
  const suit = flash ? '#ffffff' : '#ff5a36';
  const dark = flash ? '#d8dde6' : '#c33a1f';
  ctx.save();
  ctx.translate(x + w / 2, y);
  ctx.scale(face, 1);
  // jetpack
  ctx.fillStyle = '#2b3039';
  rr(ctx, -6.2, 6.5, 4.4, 9, 1.6); ctx.fill();
  ctx.fillStyle = '#ff8a1f';
  rr(ctx, -5.6, 8.4, 3.2, 1.4, 0.6); ctx.fill();
  ctx.fillStyle = '#1b1f26';
  rr(ctx, -5.4, 15, 3, 2.2, 0.8); ctx.fill();
  if (jet > 0) {                                  // the nozzle glows when it is lit
    ctx.fillStyle = COL.flame2;
    rr(ctx, -5.2, 16.4, 2.6, 1.6, 0.8); ctx.fill();
  }
  // legs: a stride on the ground, tucked up in the air
  ctx.fillStyle = dark;
  const swing = air ? -1.4 : gait * 2.6;
  const lift = air ? 2 : 0;
  rr(ctx, -3.4 + swing, 15.5 - lift * 0.5, 3, 6.5 - lift, 1.2); ctx.fill();
  rr(ctx, 0.4 - swing, 15.5 - lift, 3, 6.5 - lift * 0.6, 1.2); ctx.fill();
  ctx.fillStyle = '#24282f';                      // boots
  rr(ctx, -3.6 + swing, 20.2 - lift * 1.2, 3.6, 1.8, 0.7); ctx.fill();
  rr(ctx, 0.2 - swing, 20.2 - lift * 1.4, 3.6, 1.8, 0.7); ctx.fill();
  // torso
  ctx.fillStyle = suit;
  rr(ctx, -3.8, 6, 7.6, 10.5, 2.6); ctx.fill();
  ctx.fillStyle = dark;
  rr(ctx, -3.8, 12.4, 7.6, 2.2, 1); ctx.fill();   // belt
  // arm reaching for the gun
  ctx.fillStyle = suit;
  rr(ctx, 1, 8.4, 5, 2.8, 1.3); ctx.fill();
  // helmet
  ctx.fillStyle = flash ? '#ffffff' : '#d7dbe3';
  ctx.beginPath(); ctx.arc(0, 4.4, 4.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1d2733';                      // visor
  rr(ctx, -0.6, 1.9, 4.6, 4.2, 1.8); ctx.fill();
  ctx.fillStyle = 'rgba(126,214,255,0.75)';       // glint
  rr(ctx, 1.4, 2.7, 1.8, 1.4, 0.6); ctx.fill();
  ctx.restore();
}

// The torch in the runner's free hand. `flick` is the very same number the lamp is drawn
// with, so the flame and the light it throws gutter together and the cave reads as
// torchlight rather than as a dimmer switch. The embers are the loop's particles.
// A teardrop of fire: a round base at (bx, by) of radius r, drawn out to a point at (tx, ty).
// The tip is wherever the flame is being dragged, so one shape covers upright and leaning.
/** @param {CanvasRenderingContext2D} ctx @param {number} bx @param {number} by @param {number} tx @param {number} ty @param {number} r */
export function flameDrop(ctx, bx, by, tx, ty, r) {
  const dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const px = -uy, py = ux, a = Math.atan2(py, px);
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.quadraticCurveTo(bx + px * r * 1.15 + ux * L * 0.35, by + py * r * 1.15 + uy * L * 0.35, bx + px * r, by + py * r);
  ctx.arc(bx, by, r, a, a + Math.PI);
  ctx.quadraticCurveTo(bx - px * r * 1.15 + ux * L * 0.35, by - py * r * 1.15 + uy * L * 0.35, tx, ty);
  ctx.fill();
}
// The flame itself, three layers, its tip pushed by (lx, ly) — the drag of moving — and a
// small lick of its own. s scales the whole thing (the wall torches are smaller).
/** @param {CanvasRenderingContext2D} ctx @param {number} fx @param {number} fy @param {number} lx @param {number} ly @param {number} s @param {number} flick @param {number} time */
export function drawFlame(ctx, fx, fy, lx, ly, s, flick, time) {
  const wob = Math.sin(time * 17) * 0.6 + Math.sin(time * 29) * 0.35;
  const h = 9.5 * s * (0.85 + 0.2 * flick);
  ctx.fillStyle = COL.flame;
  ctx.globalAlpha = 0.9;
  flameDrop(ctx, fx, fy, fx + lx * s + wob * s, fy - h + ly * s, 2.9 * s);
  ctx.globalAlpha = 1;
  ctx.fillStyle = COL.flame2;
  flameDrop(ctx, fx, fy + 0.3 * s, fx + (lx * 0.6 + wob * 0.5) * s, fy - h * 0.6 + ly * 0.6 * s, 1.7 * s);
  ctx.fillStyle = '#fff6d8';
  flameDrop(ctx, fx, fy + 0.6 * s, fx + lx * 0.3 * s, fy - h * 0.28 + ly * 0.3 * s, 0.8 * s);
}
// A soft warm glow at (x, y): additive, so it brightens whatever is under it. Used for the
// halo round a flame and for the torch's small second light round the player.
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r @param {number} a @param {string} rgb 'r,g,b' */
export function glowAt(ctx, x, y, r, a, rgb) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')');
  g.addColorStop(0.45, 'rgba(' + rgb + ',' + (a * 0.4) + ')');
  g.addColorStop(1, 'rgba(' + rgb + ',0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// The torch in the runner's free hand. `flick` is the very same number the lamp is drawn
// with, so the flame and the light it throws gutter together and the cave reads as
// torchlight rather than as a dimmer switch. (lx, ly) drags the flame about as you move.
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} face @param {number} flick @param {Particle[]} embers @param {number} lx @param {number} ly @param {number} time */
export function drawTorch(ctx, x, y, face, flick, embers, lx, ly, time) {
  const fx = x + face * 1.6, fy = y - 7;           // the flame rides above the fist
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#5b4630'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(x, y + 2.5); ctx.lineTo(fx, fy); ctx.stroke();
  ctx.strokeStyle = '#8a6b45'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y + 2.5); ctx.lineTo(fx, fy); ctx.stroke();
  drawFlame(ctx, fx, fy - 1, lx, ly, 1, flick, time);
  ctx.restore();
  for (const q of embers) {
    ctx.globalAlpha = Math.max(0, q.life / q.max) * 0.85;
    ctx.fillStyle = q.c;
    ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
  }
  ctx.globalAlpha = 1;
}
// A smaller torch in an iron bracket on the wall, either side of a portal or a room's prize.
// Its flame sways a little on its own; ph keeps neighbours out of step.
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} time @param {number} ph */
export function drawSconce(ctx, x, y, time, ph) {
  const s = 0.72, fl = 0.9 + 0.1 * Math.sin(time * 13 + ph) * Math.sin(time * 7.3 + ph * 2);
  ctx.save();
  ctx.fillStyle = '#2b2a30';
  ctx.fillRect(x - 2.5, y + 5, 5, 2);               // the wall plate
  ctx.fillRect(x - 0.8, y + 1, 1.6, 5);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#5b4630'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x, y - 3); ctx.stroke();
  ctx.fillStyle = '#3a3840';
  ctx.fillRect(x - 2.2, y - 3.5, 4.4, 2);           // the cup
  drawFlame(ctx, x, y - 4, Math.sin(time * 1.9 + ph) * 1.2, 0, s, fl, time + ph);
  ctx.restore();
}

// A new gun on the ground: a soft amber glow, breathing, with sparks streaking out of it
// (drawn before the gun, so they come from behind it). Each streak rides its own clock:
// born at the middle, flying out and fading, then round again at a fresh angle.
export const GLOW_STREAKS = 9;
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} time @param {number} seed */
export function drawGunGlow(ctx, x, y, time, seed) {
  const breathe = 0.85 + 0.15 * Math.sin(time * 2.6 + seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const R = 20 * breathe;
  const g = ctx.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, 'rgba(255,201,60,0.55)');
  g.addColorStop(0.45, 'rgba(255,170,40,0.22)');
  g.addColorStop(1, 'rgba(255,140,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
  ctx.lineCap = 'round';
  for (let k = 0; k < GLOW_STREAKS; k++) {
    const ph = (time * 0.7 + k / GLOW_STREAKS + seed) % 1;
    const lap = Math.floor(time * 0.7 + k / GLOW_STREAKS + seed);
    const a = seed * 3.1 + k * 2.39996 + lap * 1.7;      // golden-angle spread, new angle each lap
    const r0 = 4 + ph * 18, len = 3 + 5 * (1 - ph);
    ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
    ctx.strokeStyle = k % 3 ? '#ffc93c' : '#fff1b8';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
    ctx.lineTo(x + Math.cos(a) * (r0 + len), y + Math.sin(a) * (r0 + len));
    ctx.stroke();
  }
  ctx.restore();
}

// A gold nugget: a lumpy rock shape (its outline fixed by `seed`), turned by `ang` as it rolls,
// lit from above whichever way up it is: a dark rim, the gold, a bright face up top and a glint.
// `pal` recolours it (rim, body, face, glint): the red crystal is a big one in CRYSTAL_PAL
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r @param {number} seed @param {number} ang @param {string[]} [pal] */
export function drawNugget(ctx, x, y, r, seed, ang, pal) {
  const P = pal || NUGGET_PAL;
  const N = 7, pts = [];
  for (let i = 0; i < N; i++) {
    const h = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    const k = 0.72 + 0.34 * (h - Math.floor(h));
    const a = ang + (i / N) * Math.PI * 2;
    pts.push([x + Math.cos(a) * r * k, y + Math.sin(a) * r * k * 0.86]);
  }
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < N; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); };
  path(); ctx.fillStyle = P[0]; ctx.fill();
  ctx.save(); ctx.translate(-0.35, -0.35); path(); ctx.fillStyle = P[1]; ctx.fill(); ctx.restore();
  ctx.save(); path(); ctx.clip();
  ctx.fillStyle = P[2];
  ctx.beginPath(); ctx.ellipse(x - r * 0.25, y - r * 0.4, r * 0.62, r * 0.38, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = P[3];
  ctx.fillRect(x - r * 0.42, y - r * 0.55, Math.max(0.7, r * 0.26), Math.max(0.7, r * 0.26));
  if (pal) ctx.fillRect(x + r * 0.2, y + r * 0.1, Math.max(0.6, r * 0.14), Math.max(0.6, r * 0.14));   // a second glint
}
export const NUGGET_PAL = ['#7a4e10', '#d8a52a', '#ffd95a', '#fff6c8'];
// the red crystal: gold's shape, dark red, white highlights, and how big it is
export const CRYSTAL_PAL = ['#2a0306', '#6e0a12', '#a3162a', '#ffffff'], CRYSTAL_R = 11;
// the green crystal (the hidden room's prize, the perk machine's currency): the same, green
export const GREEN_PAL = ['#03240c', '#0b6a26', '#1fae46', '#ffffff'];
