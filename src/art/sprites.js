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

// ---- the runner: a white-suited astronaut, arms and legs jointed at the elbow and knee ----
// One painter (paintBody) draws the body from a pose: where the head, chest, hip, shoulders,
// hips, elbows, hands, knees and feet are, in world units. The living runner works its pose out
// (runnerPose: the feet from the stride, knees and elbows by two-bone reach, hands on the gun
// and the torch); the corpse takes its pose straight off the ragdoll's joints, so the dead body
// is the same astronaut as the live one. In game it's drawn into a small layer at DEV.runnerPx
// world units a pixel and scaled up crisp (pixelSprite), like the hologram.
const SUIT = { white: '#eef1f6', shade: '#aab2c0', dark: '#7a8393', boot: '#4e5566', visor: '#121a28',
  glint: '#8fe0ff', rim: '#d9a441', pack: '#dde2ea', light: '#ff8a1f', panel: '#5d6676' };
const FLASH = { white: '#ffb0a8', shade: '#f08a80', dark: '#c25a50', boot: '#7a3a36', visor: '#3a1418',
  glint: '#ffd0c8', rim: '#ffb0a8', pack: '#ffb8b0', light: '#ffffff', panel: '#a04a44' };
export const THIGH = 3, SHIN = 3, UPPER = 2.7, FORE = 2.6;   // bone lengths (world units)

/** @typedef {{ x: number, y: number }} P2 */
/** @typedef {{ face: number, head: P2, chest: P2, hip: P2, sh: P2[], hp: P2[], el: P2[], ha: P2[], kn: P2[], ft: P2[] }} BodyPose  [0] = the far limb, [1] = the near one */

// Two-bone reach: the middle joint (elbow, knee) of a limb rooted at a with bones l1, l2 whose end
// wants to be at t (or as near as it reaches: e). bend picks the side it folds to (+1 / -1).
/** @param {P2} a @param {P2} t @param {number} l1 @param {number} l2 @param {number} bend @returns {{ j: P2, e: P2 }} */
export function reach(a, t, l1, l2, bend) {
  const dx = t.x - a.x, dy = t.y - a.y, d0 = Math.hypot(dx, dy) || 1e-6;
  const d = Math.max(Math.abs(l1 - l2) + 0.01, Math.min(l1 + l2 - 0.01, d0));
  const base = Math.atan2(dy, dx), k = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const ang = base + bend * k;
  return { j: { x: a.x + Math.cos(ang) * l1, y: a.y + Math.sin(ang) * l1 }, e: { x: a.x + dx / d0 * d, y: a.y + dy / d0 * d } };
}

// The live runner's pose. (x, y) the runner box's top-left, w wide; gait the stride's phase
// (radians, null standing); air: off the ground; hands: where the near (gun) and far (torch) hands
// want to be, world units (none: resting). The sprite's own numbers face right, y from its top.
/** @param {number} x @param {number} y @param {number} w @param {number} face @param {number | null} gait @param {boolean} air @param {{ gun?: P2 | null, torch?: P2 | null }} [hands] @returns {BodyPose} */
export function runnerPose(x, y, w, face, gait, air, hands) {
  const cx = x + w / 2, f = face || 1;
  /** @param {number} lx @param {number} ly @returns {P2} */
  const at = (lx, ly) => ({ x: cx + lx * f, y: y + ly });
  const hp = [at(-0.9, 15.4), at(0.9, 15.4)];
  // the feet: a stride (each foot swings forward lifted, comes back planted), tucked in the air, else apart
  /** @type {P2[]} */
  let ft;
  if (air) ft = [at(-2.1, 20.2), at(1.6, 19.4)];
  else if (gait != null) ft = [0, Math.PI].map((o, i) => {
    const ph = gait + o, fx = -Math.cos(ph) * 3.4, lift = Math.max(0, Math.sin(ph)) * 2.2;
    return at(fx + (i ? 0.5 : -0.5), 21 - lift);
  });
  else ft = [at(-1.7, 21), at(1.7, 21)];
  const kn = hp.map((h, i) => reach(h, ft[i], THIGH, SHIN, -f).j);   // knees fold forward
  const sh = [at(-1.1, 9.6), at(1.1, 9.6)];
  const H = hands || {};
  const want = [H.torch ? { x: H.torch.x, y: H.torch.y + 1.5 } : at(-2.4, 13.6), H.gun || at(3.4, 12.6)];
  /** @type {P2[]} */
  const el = [], ha = [];
  for (let i = 0; i < 2; i++) {
    // an elbow folds whichever way puts it lower (arms hang, they don't wing up)
    const a = reach(sh[i], want[i], UPPER, FORE, 1), b = reach(sh[i], want[i], UPPER, FORE, -1);
    const r = a.j.y >= b.j.y ? a : b;
    el.push(r.j); ha.push(r.e);
  }
  return { face: f, head: at(0, 5), chest: at(0, 10), hip: at(0, 15.4), sh, hp, el, ha, kn, ft };
}

// The body from a pose (world units). held: drawn between the body and the near arm (the gun, so
// the hand closes over it). jet: the backpack's nozzle glows. flash: hit (washed red).
/** @param {CanvasRenderingContext2D} ctx @param {BodyPose} P @param {number} jet @param {boolean} flash @param {((c: CanvasRenderingContext2D) => void) | null} [held] */
export function paintBody(ctx, P, jet, flash, held) {
  const C = flash ? FLASH : SUIT, f = P.face;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  /** @param {P2} a @param {P2} b @param {string} col @param {number} w */
  const seg = (a, b, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
  // a part drawn in the sprite's own numbers, pinned at a (the sprite's (px, py)) and turned so its
  // "down" points from a to b
  /** @param {P2} a @param {P2} b @param {number} px @param {number} py @param {() => void} art */
  const along = (a, b, px, py, art) => {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2);
    ctx.scale(f, 1);
    ctx.translate(-px, -py);
    art();
    ctx.restore();
  };
  // a limb's bone: a darker edge round it first, so it reads against the white suit behind it
  /** @param {P2} a @param {P2} b @param {string} col @param {number} w */
  const bone = (a, b, col, w) => { seg(a, b, C.dark, w + 1); seg(a, b, col, w); };
  /** @param {number} i @param {string} col */
  const leg = (i, col) => {
    bone(P.hp[i], P.kn[i], col, 2.3); bone(P.kn[i], P.ft[i], col, 2.1);
    // the boot: from the heel forward, square to the shin
    const sx = P.ft[i].x - P.kn[i].x, sy = P.ft[i].y - P.kn[i].y, sl = Math.hypot(sx, sy) || 1;
    const tx = sy / sl * f, ty = -sx / sl * f;
    seg({ x: P.ft[i].x - tx * 0.5, y: P.ft[i].y - ty * 0.5 }, { x: P.ft[i].x + tx * 1.5, y: P.ft[i].y + ty * 1.5 }, C.boot, 2.2);
  };
  /** @param {number} i @param {string} col @param {string} glove */
  const arm = (i, col, glove) => {
    bone(P.sh[i], P.el[i], col, 2); bone(P.el[i], P.ha[i], col, 1.8);
    ctx.fillStyle = glove; ctx.beginPath(); ctx.arc(P.ha[i].x, P.ha[i].y, 1.25, 0, Math.PI * 2); ctx.fill();
  };
  arm(0, C.shade, C.dark);                                  // the far arm, in shadow
  leg(0, C.shade);                                          // the far leg
  along(P.chest, P.hip, 0, 10, () => {                      // the backpack
    ctx.fillStyle = C.pack; rr(ctx, -6.4, 7.6, 4, 8.4, 1.2); ctx.fill();
    ctx.fillStyle = C.shade; ctx.fillRect(-6.4, 13.6, 4, 1.2);
    ctx.fillStyle = C.light; ctx.fillRect(-5.6, 9, 1.2, 1.2);
    ctx.fillStyle = C.panel; rr(ctx, -5.8, 15.6, 2.8, 1.8, 0.6); ctx.fill();
    if (jet > 0) { ctx.fillStyle = COL.flame2; rr(ctx, -5.6, 16.6, 2.4, 1.4, 0.6); ctx.fill(); }
  });
  along(P.chest, P.hip, 0, 10, () => {                      // the torso: chest box, belt
    ctx.fillStyle = C.white; rr(ctx, -3.3, 7.8, 6.6, 8.6, 2.2); ctx.fill();
    ctx.fillStyle = C.shade; ctx.fillRect(-3.3, 9.4, 1.4, 6);
    ctx.fillStyle = C.panel; ctx.fillRect(0.3, 10.4, 2.4, 2);
    ctx.fillStyle = '#4fd2ff'; ctx.fillRect(0.6, 10.8, 0.9, 0.9);
    ctx.fillStyle = '#ff5a4a'; ctx.fillRect(1.6, 10.8, 0.9, 0.9);
    ctx.fillStyle = C.dark; ctx.fillRect(-3.3, 14.2, 6.6, 1.2);
  });
  leg(1, C.white);                                          // the near leg
  along(P.head, P.chest, 0, 5, () => {                      // the helmet
    ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(0, 4.6, 4.9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.shade; ctx.beginPath(); ctx.arc(0, 4.6, 4.9, Math.PI * 0.55, Math.PI * 1.15); ctx.lineTo(0, 4.6); ctx.fill();
    ctx.fillStyle = C.rim; rr(ctx, -0.4, 1.6, 5, 5.6, 2.2); ctx.fill();
    ctx.fillStyle = C.visor; rr(ctx, 0.2, 2.2, 4.2, 4.4, 1.8); ctx.fill();
    ctx.fillStyle = C.glint; ctx.fillRect(2.4, 2.8, 1.2, 1.2);
    ctx.fillStyle = C.shade; ctx.fillRect(-3.4, 8.6, 6.4, 1);  // the neck ring
  });
  if (held) held(ctx);
  arm(1, C.white, C.shade);                                 // the near arm, over the gun
  ctx.restore();
}

// The runner (also the Exo Suit tab's portrait). gait: the stride's phase in radians, or null
// standing; hands: where the gun and torch hands go (world units); held: the gun, under the hand.
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} w @param {number} hh @param {number} face @param {number | null} gait @param {boolean} air @param {number} jet @param {boolean} flash @param {{ gun?: P2 | null, torch?: P2 | null }} [hands] @param {((c: CanvasRenderingContext2D) => void) | null} [held] */
export function drawRunner(ctx, x, y, w, hh, face, gait, air, jet, flash, hands, held) {
  paintBody(ctx, runnerPose(x, y, w, face, gait, air, hands), jet, flash, held);
}

// The corpse's pose, off the ragdoll's joints (world/ragdoll.js RAG_POSE). A replay saved before
// the ragdoll had elbows and a second hand (8 joints) gets them made up.
/** @param {import('../world/ragdoll.js').Ragdoll} R @returns {BodyPose} */
export function ragPose(R) {
  const J = R.joints;
  /** @param {P2} a @param {P2} b @returns {P2} */
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 0.6 });
  const ha0 = J[10] || J[7], el1 = J[8] || mid(J[1], J[7]), el0 = J[9] || mid(J[1], ha0);
  return { face: R.face, head: J[0], chest: J[1], hip: J[2], sh: [J[1], J[1]], hp: [J[2], J[2]],
    el: [el0, el1], ha: [ha0, J[7]], kn: [J[3], J[5]], ft: [J[4], J[6]] };
}

// The runner dead: the same body, laid along the ragdoll
/** @param {CanvasRenderingContext2D} ctx @param {import('../world/ragdoll.js').Ragdoll} R */
export function drawRagdoll(ctx, R) { paintBody(ctx, ragPose(R), 0, false, null); }

// ---- pixel sprites ----
// Draw `paint` (world units) into a small layer at px world units a pixel, its grid pinned at
// (x0, y0) so it rides with the sprite rather than crawling over it; make every pixel solid or
// clear (no soft edges), give it a dark one-pixel outline (line), and lay it down scaled up crisp.
/** @type {{ c: HTMLCanvasElement | null, x: CanvasRenderingContext2D | null }} */
const PIX = { c: null, x: null };
/** @param {CanvasRenderingContext2D} ctx @param {number} x0 @param {number} y0 @param {number} w @param {number} h @param {number} px @param {boolean} line @param {(c: CanvasRenderingContext2D) => void} paint */
export function pixelSprite(ctx, x0, y0, w, h, px, line, paint) {
  const cw = Math.ceil(w / px), ch = Math.ceil(h / px);
  if (!PIX.c) { PIX.c = document.createElement('canvas'); PIX.x = PIX.c.getContext('2d', { willReadFrequently: true }); }
  const c = PIX.c, t = PIX.x;
  if (!t) return;
  if (c.width < cw || c.height < ch) { c.width = Math.max(c.width, cw); c.height = Math.max(c.height, ch); }
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.clearRect(0, 0, c.width, c.height);
  t.setTransform(1 / px, 0, 0, 1 / px, -x0 / px, -y0 / px);
  paint(t);
  t.setTransform(1, 0, 0, 1, 0, 0);
  const im = t.getImageData(0, 0, cw, ch), d = im.data, n = cw * ch;
  const on = new Uint8Array(n);
  for (let i = 0; i < n; i++) { if (d[i * 4 + 3] >= 100) { on[i] = 1; d[i * 4 + 3] = 255; } else d[i * 4 + 3] = 0; }
  if (line) for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = y * cw + x;
    if (on[i]) continue;
    if ((x > 0 && on[i - 1]) || (x < cw - 1 && on[i + 1]) || (y > 0 && on[i - cw]) || (y < ch - 1 && on[i + cw])) {
      d[i * 4] = 14; d[i * 4 + 1] = 17; d[i * 4 + 2] = 26; d[i * 4 + 3] = 255;
    }
  }
  t.putImageData(im, 0, 0);
  const sm = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, 0, 0, cw, ch, x0, y0, cw * px, ch * px);
  ctx.imageSmoothingEnabled = sm;
}

// pixelSprite without the cut-off: `paint` drawn small (one canvas pixel per px world units) and
// scaled up crisp, see-through parts kept see-through (smoke). Its own canvas
/** @type {{ c: HTMLCanvasElement | null, x: CanvasRenderingContext2D | null }} */
export const PIX2 = { c: null, x: null };
/** @param {CanvasRenderingContext2D} ctx @param {number} x0 @param {number} y0 @param {number} w @param {number} h @param {number} px @param {(c: CanvasRenderingContext2D) => void} paint */
export function pixelSoft(ctx, x0, y0, w, h, px, paint) {
  const cw = Math.ceil(w / px), ch = Math.ceil(h / px);
  if (!PIX2.c) { PIX2.c = document.createElement('canvas'); PIX2.x = PIX2.c.getContext('2d'); }
  const c = PIX2.c, t = PIX2.x;
  if (!t || cw < 1 || ch < 1) return;
  if (c.width < cw || c.height < ch) { c.width = Math.max(c.width, cw); c.height = Math.max(c.height, ch); }
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.clearRect(0, 0, cw + 1, ch + 1);
  t.setTransform(1 / px, 0, 0, 1 / px, -x0 / px, -y0 / px);
  paint(t);
  t.setTransform(1, 0, 0, 1, 0, 0);
  const sm = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, 0, 0, cw, ch, x0, y0, cw * px, ch * px);
  ctx.imageSmoothingEnabled = sm;
}

// The jetpack's flame from the nozzle (bx, by), out along (ux, uy) for len: a fire, not a
// triangle. A flickering body in four layers (deep orange edge to a white core), two tongues either
// side licking on their own beats, and sparks of flame breaking off its tip. For pixelSprite
// (actors.js drawJetFlame). Steady hashes of time only (draw shares the simulation's Math.random)
/** @param {CanvasRenderingContext2D} ctx @param {number} bx @param {number} by @param {number} ux @param {number} uy @param {number} len @param {number} time */
export function jetFlame(ctx, bx, by, ux, uy, len, time) {
  const nx = -uy, ny = ux;                         // across the flame
  /** @param {number} k along @param {number} side across @returns {[number, number]} */
  const at = (k, side) => [bx + ux * len * k + nx * side, by + uy * len * k + ny * side];
  const layers = [['#d8381a', 1, 3.6], [COL.flame, 0.82, 2.8], [COL.flame2, 0.55, 1.9], ['#fff6d8', 0.28, 1.1]];
  for (const [col, k, r] of layers) {
    ctx.fillStyle = String(col);
    const kk = Number(k), rr = Number(r);
    const wob = Math.sin(time * 31 + kk * 5) * 0.9 * kk;
    const [tx, ty] = at(kk * (0.9 + 0.12 * Math.sin(time * 23 + kk * 7)), wob);
    flameDrop(ctx, bx, by, tx, ty, rr);
    if (kk < 0.5) continue;
    for (const side of [-1, 1]) {                  // the side tongues
      const lick = 0.45 + 0.4 * Math.abs(Math.sin(time * (17 + side * 4) + kk * 3 + side));
      const [sx, sy] = at(kk * lick, side * rr * 0.9 + Math.sin(time * 13 + side) * 0.8);
      flameDrop(ctx, bx + nx * side * rr * 0.4, by + ny * side * rr * 0.4, sx, sy, rr * 0.5);
    }
  }
  for (let i = 0; i < 3; i++) {                     // flame breaking off the tip
    const u = (time * 4.1 + i / 3) % 1, rr = 1.6 * (1 - u);
    if (rr < 0.45) continue;
    const [x, y] = at(0.8 + 0.6 * u, Math.sin(time * 19 + i * 2.3) * 2.2 * u);
    ctx.fillStyle = u < 0.4 ? COL.flame2 : COL.flame;
    ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
  }
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

// The hand torch's flame: not one smooth drop but a fire. A short body, three tongues licking up off
// it each on its own beat (taller, shorter, swaying), and two licks breaking off the top and rising
// as they shrink, in four layers from a deep orange edge to a white core. Meant to be drawn through
// pixelSprite (actors.js), where the licks read as pixel flames. (lx, ly) drags it as you move;
// `flick` is the lamp's own number, so the flame and its light gutter together.
const TONGUES = [[-1.3, 11.7, 0.62, 0], [0.2, 15.3, 0.92, 2.1], [1.4, 13.1, 0.7, 4.4]];   // x, beat, height, phase
/** @param {CanvasRenderingContext2D} ctx @param {number} fx @param {number} fy @param {number} lx @param {number} ly @param {number} flick @param {number} time */
export function torchFlame(ctx, fx, fy, lx, ly, flick, time) {
  const h = 10 * (0.82 + 0.22 * flick);
  /** @param {number} k how far up (0 base, 1 tip) @param {number} [sw] its own sway */
  const tipX = (k, sw = 0) => fx + lx * k + sw;
  const layers = [['#d8381a', 1], [COL.flame, 0.78], [COL.flame2, 0.5], ['#fff6d8', 0.24]];
  layers.forEach(([col, sc], li) => {
    ctx.fillStyle = String(col);
    const s = Number(sc), r = 3 * s + 0.4;
    // the body
    const bh = h * 0.55 * s * (0.9 + 0.12 * Math.sin(time * 9.7));
    flameDrop(ctx, fx, fy, tipX(0.5, Math.sin(time * 7.3) * 0.5), fy - bh + ly * 0.5, r);
    if (li === 3) return;
    // the tongues, each rising and falling on its own beat
    for (const [ox, beat, th, ph] of TONGUES) {
      const lick = 0.55 + 0.45 * Math.abs(Math.sin(time * beat + ph)) * (0.8 + 0.2 * Math.sin(time * 3.1 + ph));
      const tt = h * th * lick * s;
      flameDrop(ctx, fx + ox * s, fy - 0.6, tipX(tt / h, Math.sin(time * (beat * 0.6) + ph) * 1.1 * s) + ox * 0.5 * s,
        fy - tt + ly * (tt / h), Math.max(0.6, r * 0.55));
    }
  });
  // licks breaking off the top, rising and shrinking
  for (let k = 0; k < 2; k++) {
    const u = (time * 2.3 + k * 0.5) % 1, rr = 1.5 * (1 - u);
    if (rr < 0.45) continue;
    const y = fy - h * (0.75 + 0.75 * u) + ly * (1 + u), x = tipX(1 + u * 0.6, Math.sin(time * 6 + k * 3) * 1.2);
    ctx.fillStyle = u < 0.45 ? COL.flame2 : COL.flame;
    ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
  }
}

// The torch in the runner's free hand: the stick and the flame (embers: torchEmbers, drawn apart so
// they can leave the pixel layer's box). (lx, ly) drags the flame about as you move.
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} face @param {number} flick @param {number} lx @param {number} ly @param {number} time */
export function drawTorch(ctx, x, y, face, flick, lx, ly, time) {
  const fx = x + face * 1.6, fy = y - 7;           // the flame rides above the fist
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#5b4630'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(x, y + 2.5); ctx.lineTo(fx, fy); ctx.stroke();
  ctx.strokeStyle = '#8a6b45'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y + 2.5); ctx.lineTo(fx, fy); ctx.stroke();
  torchFlame(ctx, fx, fy - 0.5, lx, ly, flick, time);
  ctx.restore();
}

// The torch's embers (the loop's particles), as squares on the pixel grid `px` (0: anywhere)
/** @param {CanvasRenderingContext2D} ctx @param {Particle[]} embers @param {number} px */
export function torchEmbers(ctx, embers, px) {
  for (const q of embers) {
    ctx.globalAlpha = Math.max(0, q.life / q.max) * 0.85;
    ctx.fillStyle = q.c;
    if (px > 0) { const s = Math.max(px, Math.round(q.s / px) * px); ctx.fillRect(Math.floor(q.x / px) * px, Math.floor(q.y / px) * px, s, s); }
    else ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
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
