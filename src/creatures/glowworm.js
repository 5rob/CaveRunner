// Glow worms (Coal Seams, grem chunk C5; the owner's spec): fat little inchworms roaming every surface (floor, walls, roof,
// round corners). Stage a: the body and the gait only. A worm is a plain object (`GlowWorm`, a foe can carry it later): two
// feet on the rock (a point just off it and the rock's outward normal there), the crank angle th, the direction it crawls,
// and the body's six joints. Stepped from the level scene (art/titlescene.js wormsStep), drawn by drawGlowWorm
// (game/render/titledraw.js). Every number is a Dev knob (group 'glow'). World units throughout (the scene's 220 a screen).
//
// The gait (the owner's): two cranks half a turn apart; foot gap = dMid − A·cos θ (A = stride / 2). θ in 0..π: the rear grips
// and the front reaches along the surface, lifted liftF·A·sin θ; θ in π..2π: the front grips and the rear follows, lifted
// liftR·A·|sin θ|. A gripping foot is never moved. The body: FABRIK over six joints (five equal bones) pinned footLen out
// from each foot, started from a circular arc of the body's length bulging away from the rock, so close feet make an Ω.

import { hexArr } from '../core/util.js';
import { DEV, kcol } from '../dev/knobs.js';
import { twinkle } from './jelly.js';

/** @typedef {{ x: number, y: number, nx: number, ny: number }} WormFoot */
/** @typedef {{ r: WormFoot, f: WormFoot, rl: { x: number, y: number }, fl: { x: number, y: number }, th: number, dir: number, pts: { x: number, y: number }[], ph: number, sz: number,
 *   st: 'roam' | 'agro' | 'strike', ag: number, sk: number, cd: number, vt: number, ux: number, uy: number, hit: boolean, foe?: Enemy }} GlowWorm */
// sz: its size (× every body number: DEV.glowSizeMin..Max, rolled once); st: roaming, in agro (stood up on its back foot, facing the player) or striking; ag: 0 walking .. 1 stood up; sk: the strike's
// clock; cd: till it can strike again; vt: the vibration's clock; (ux, uy): the way its head points; foe: its stand-in among the
// scene's foes (art/titlescene.js wormsStep)
/** @typedef {(x: number, y: number) => boolean} WormSolid */

const HOLD = 0.5;    // a foot sits this far off the rock
const FEEL = 4;      // and feels for it this far
const STEP = 0.5;    // the crawl along the surface, in steps this long
const RING = [];     // the normal: rock sampled round the point
for (const r of [1.5, 3]) for (let k = 0; k < 16; k++) RING.push([Math.cos(k * Math.PI / 8) * r, Math.sin(k * Math.PI / 8) * r]);

// the rock's outward normal at (x, y): away from the rock round it; null with none near
/** @param {number} x @param {number} y @param {WormSolid} solid */
export function wormNormal(x, y, solid) {
  let nx = 0, ny = 0;
  for (const [dx, dy] of RING) if (solid(x + dx, y + dy)) { nx -= dx; ny -= dy; }
  const l = Math.hypot(nx, ny);
  return l < 1e-6 ? null : { x: nx / l, y: ny / l };
}

// p seated HOLD off the rock along its normal (in rock: pushed out; off it: pulled in); false with no rock within FEEL
/** @param {WormFoot} p @param {WormSolid} solid */
function seat(p, solid) {
  if (solid(p.x, p.y)) {
    for (let k = 1; k <= 16; k++) if (!solid(p.x + p.nx * k * 0.25, p.y + p.ny * k * 0.25)) { p.x += p.nx * k * 0.25; p.y += p.ny * k * 0.25; return true; }
    return false;
  }
  for (let k = 1; k <= FEEL * 4; k++) {
    const d = k * 0.25;
    if (solid(p.x - p.nx * d, p.y - p.ny * d)) { const m = d - 0.125 - HOLD; if (!solid(p.x - p.nx * m, p.y - p.ny * m)) { p.x -= p.nx * m; p.y -= p.ny * m; } return true; }   // (m < 0: too close, pushed out)
  }
  return false;
}

// the point dist along the surface from foot f, dir 1 (the tangent (−ny, nx)) or −1; null where the rock gives out
/** @param {WormFoot} f @param {number} dist @param {number} dir @param {WormSolid} solid @returns {WormFoot | null} */
export function wormCrawl(f, dist, dir, solid) {
  const p = { x: f.x, y: f.y, nx: f.nx, ny: f.ny };
  for (let left = dist; left > 1e-9; left -= STEP) {
    const s = Math.min(STEP, left);
    p.x += -p.ny * dir * s; p.y += p.nx * dir * s;
    const n = wormNormal(p.x, p.y, solid); if (!n) return null;
    p.nx = n.x; p.ny = n.y;
    if (!seat(p, solid) || solid(p.x, p.y)) return null;
    const n2 = wormNormal(p.x, p.y, solid); if (!n2) return null;
    p.nx = n2.x; p.ny = n2.y;
  }
  return p;
}

// a worm on the rock at (x, y) (in the air by it), crawling dir; null if there's no surface there to walk
/** @param {number} x @param {number} y @param {number} dir @param {WormSolid} solid @param {() => number} rnd @returns {GlowWorm | null} */
export function newWorm(x, y, dir, solid, rnd) {
  const n = wormNormal(x, y, solid); if (!n) return null;
  const r = { x, y, nx: n.x, ny: n.y };
  if (!seat(r, solid) || solid(r.x, r.y)) return null;
  /** @type {GlowWorm} */
  const w = { r, f: r, rl: { x, y }, fl: { x, y }, th: 0, dir, pts: [], ph: rnd() * 6.28, sz: DEV.glowSizeMin + rnd() * Math.max(0, DEV.glowSizeMax - DEV.glowSizeMin), st: 'roam', ag: 0, sk: 0, cd: 0, vt: 0, ux: n.x, uy: n.y, hit: false };
  const g = (DEV.glowDMin * w.sz + DEV.glowDMax * w.sz) / 2 - DEV.glowStride * w.sz / 2;
  let f = wormCrawl(r, g, dir, solid);
  if (!f) { w.dir = -dir; f = wormCrawl(r, g, -dir, solid); }
  if (!f) return null;
  w.f = f; wormBody(w, solid);
  return w;
}

// turned round: the feet swap, so the gripping one stays put and the gait carries on the other way
/** @param {GlowWorm} w */
function turn(w) {
  const r = w.r; w.r = w.f; w.f = r; w.dir = -w.dir;
  if (w.th >= Math.PI) w.th = 2 * Math.PI - w.th;   // (contract → extend at the same gap: the new rear, the old front, grips)
}

// one frame of a worm: roaming, its gait; a player (tgt, his middle) within DEV.glowAgroR, agro: it stands up on its back foot
// straight out from the rock, facing him, vibrating; within DEV.glowStrikeR, a strike: the head snaps round to him and lunges.
// Returns 'plant' when a foot comes down (a puff of spores), 'strike' at a strike's height with him still in reach, else ''
/** @param {GlowWorm} w @param {number} dt @param {WormSolid} solid @param {() => number} rnd @param {{ x: number, y: number } | null} [tgt]
 * @returns {'' | 'plant' | 'strike'} */
export function stepWorm(w, dt, solid, rnd, tgt) {
  const D = DEV, A = D.glowStride * w.sz / 2, dMid = (D.glowDMin * w.sz + D.glowDMax * w.sz) / 2;
  const d = tgt ? Math.hypot(tgt.x - w.r.x, tgt.y - w.r.y) : Infinity;
  /** @type {'' | 'plant' | 'strike'} */
  let ev = '';
  w.cd -= dt; w.vt += dt;
  if (w.st === 'strike') {
    const was = w.sk; w.sk += dt;
    if (was < D.glowStrikeT * 0.5 && w.sk >= D.glowStrikeT * 0.5 && d < D.glowStrikeR) ev = 'strike';
    if (w.sk >= D.glowStrikeT) { w.st = 'agro'; w.cd = D.glowStrikeCd; }
  } else if (d < D.glowStrikeR && w.cd <= 0 && w.ag > 0.8) { w.st = 'strike'; w.sk = 0; }
  else if (d < D.glowAgroR) w.st = 'agro';
  else if (w.st === 'agro' && d > D.glowAgroR * 1.15) { w.st = 'roam'; w.th = 0; }
  const up = w.st !== 'roam';
  w.ag = Math.max(0, Math.min(1, w.ag + (up ? dt : -dt) / 0.2));
  if (!up) {
    const was = w.th < Math.PI;
    w.th += D.glowCrank * dt;
    if (was !== (w.th < Math.PI)) ev = 'plant';
    if (w.th >= 2 * Math.PI) { w.th -= 2 * Math.PI; ev = 'plant'; if (rnd() < D.glowTurn) turn(w); }
    for (let k = 0; k < 2; k++) {
      const gap = dMid - A * Math.cos(w.th), ext = w.th < Math.PI;
      const p = ext ? wormCrawl(w.r, gap, w.dir, solid) : wormCrawl(w.f, gap, -w.dir, solid);
      if (p) { if (ext) w.f = p; else w.r = p; break; }
      turn(w);   // (the rock gives out ahead: back the way it came)
    }
  }
  wormBody(w, solid);
  if (w.ag > 0) wormStand(w, tgt);
  return ev;
}

// stood up (agro, a strike): a rigid line straight out from the rock at the back foot, leaning a little toward the player,
// vibrating across itself (DEV.glowVib, glowVibSpd); a strike snaps it round to him and lunges (half again as long at its
// height). Blended over the walking pose by w.ag
/** @param {GlowWorm} w @param {{ x: number, y: number } | null} [tgt] */
function wormStand(w, tgt) {
  const D = DEV, b = D.glowLen * w.sz / 5, nx = w.r.nx, ny = w.r.ny;
  let px = nx, py = ny;
  if (tgt) { const dx = tgt.x - w.r.x, dy = tgt.y - w.r.y, l = Math.hypot(dx, dy) || 1; px = dx / l; py = dy / l; }
  let ux = nx + 0.35 * px, uy = ny + 0.35 * py, lunge = 1;
  if (w.st === 'strike') {
    const q = Math.min(1, w.sk / (D.glowStrikeT * 0.3));
    ux = ux * (1 - q) + px * q; uy = uy * (1 - q) + py * q;
    lunge = 1 + 0.5 * Math.sin(Math.PI * Math.min(1, w.sk / D.glowStrikeT));
  }
  const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
  w.ux = ux; w.uy = uy;
  const vib = D.glowVib * Math.sin(w.vt * D.glowVibSpd) * (w.st === 'strike' ? 0 : 1), qx = -uy, qy = ux;
  const ax = w.r.x + nx * D.glowFoot * w.sz, ay = w.r.y + ny * D.glowFoot * w.sz, k = w.ag;
  /** @param {{ x: number, y: number }} p @param {number} x @param {number} y */
  const mix = (p, x, y) => ({ x: p.x + (x - p.x) * k, y: p.y + (y - p.y) * k });
  w.rl = mix(w.rl, w.r.x, w.r.y);
  w.pts = w.pts.map((p, i) => mix(p, ax + ux * b * i * lunge + qx * vib * i / 5, ay + uy * b * i * lunge + qy * vib * i / 5));
  const e = w.pts[5];
  w.fl = mix(w.fl, e.x + ux * D.glowFoot * w.sz, e.y + uy * D.glowFoot * w.sz);
}

// the lifted feet and the body: six joints pinned footLen out from them, FABRIK from an arc bulging off the rock
/** @param {GlowWorm} w @param {WormSolid} [solid] */
export function wormBody(w, solid) {
  const D = DEV, A = D.glowStride * w.sz / 2, s = Math.sin(w.th), ext = w.th < Math.PI;
  const lf = ext ? D.glowLiftF * A * s : 0, lr = ext ? 0 : D.glowLiftR * A * -s;
  w.fl = { x: w.f.x + w.f.nx * lf, y: w.f.y + w.f.ny * lf };
  w.rl = { x: w.r.x + w.r.nx * lr, y: w.r.y + w.r.ny * lr };
  const a = { x: w.rl.x + w.r.nx * D.glowFoot * w.sz, y: w.rl.y + w.r.ny * D.glowFoot * w.sz };
  const e = { x: w.fl.x + w.f.nx * D.glowFoot * w.sz, y: w.fl.y + w.f.ny * D.glowFoot * w.sz };
  w.pts = fabrik(a, e, w.r.nx + w.f.nx, w.r.ny + w.f.ny, D.glowLen * w.sz / 5, solid);
}

// FABRIK, both ends pinned: six joints a..e, five bones of b; the start: a circular arc of length 5b through a and e, bulging
// toward (mx, my); then passes from each end in turn till e is reached (every bone its length after each pass). With solid, a
// joint put in rock is pushed out of it on the passes, then a last pass from a without that keeps every bone its length
/** @param {{ x: number, y: number }} a @param {{ x: number, y: number }} e @param {number} mx @param {number} my @param {number} b @param {WormSolid} [solid] */
export function fabrik(a, e, mx, my, b, solid) {
  const L = 5 * b, dx = e.x - a.x, dy = e.y - a.y, d = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / d, uy = dy / d;
  let px = -uy, py = ux; if (px * mx + py * my < 0) { px = -px; py = -py; }
  /** @type {{ x: number, y: number }[]} */
  let P = [];
  if (d >= L * 0.999) { for (let i = 0; i <= 5; i++) P.push({ x: a.x + ux * b * i, y: a.y + uy * b * i }); return P; }
  // the arc's half angle phi: phi / sin(phi) = L / d (bisection)
  let lo = 1e-4, hi = Math.PI - 1e-4;
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (m / Math.sin(m) < L / d) lo = m; else hi = m; }
  const phi = (lo + hi) / 2, R = d / (2 * Math.sin(phi)), cx = (a.x + e.x) / 2, cy = (a.y + e.y) / 2;
  for (let i = 0; i <= 5; i++) {
    const q = -phi + 2 * phi * i / 5, X = R * Math.sin(q), Y = R * (Math.cos(q) - Math.cos(phi));
    P.push({ x: cx + ux * X + px * Y, y: cy + uy * X + py * Y });
  }
  for (let it = 0; it < 30; it++) {
    P[5] = { x: e.x, y: e.y };
    for (let i = 4; i >= 0; i--) { pull(P, i, i + 1, b); if (solid) out(P[i], solid); }
    P[0] = { x: a.x, y: a.y };
    for (let i = 1; i <= 5; i++) { pull(P, i, i - 1, b); if (solid && i < 5) out(P[i], solid); }
    if (Math.hypot(P[5].x - e.x, P[5].y - e.y) < 0.005 && !(solid && P.some(p => solid(p.x, p.y)))) break;
  }
  if (solid) { P[0] = { x: a.x, y: a.y }; for (let i = 1; i <= 5; i++) pull(P, i, i - 1, b); }
  return P;
}
// a joint in rock (or within half a unit of it) pushed out to air, along the rock's normal there
/** @param {{ x: number, y: number }} p @param {WormSolid} solid */
function out(p, solid) {
  const n = wormNormal(p.x, p.y, solid); if (!n) return;
  for (let k = 0; k <= 12 && (solid(p.x, p.y) || solid(p.x - n.x * 0.5, p.y - n.y * 0.5)); k++) { p.x += n.x * 0.25; p.y += n.y * 0.25; }
}
// joint i put b from joint j, on the line between them
/** @param {{ x: number, y: number }[]} P @param {number} i @param {number} j @param {number} b */
function pull(P, i, j, b) {
  const dx = P[i].x - P[j].x, dy = P[i].y - P[j].y, l = Math.hypot(dx, dy) || 1e-6;
  P[i] = { x: P[j].x + dx / l * b, y: P[j].y + dy / l * b };
}

// ---- drawing (world units, ctx already scaled; ox: the view's left edge) ----
const BODY = '#eeffe2', EDGE = '#1eff1e';   // (stage a's plain placeholder: white-green, a green outline; the glow comes in stage b)
// the body's centre line, sampled smooth: the lifted rear foot, the six joints, the lifted front foot (quadratics through the
// joints' midpoints), every point with s, its share of the way along
/** @param {GlowWorm} w @param {number} ox @returns {{ x: number, y: number, s: number }[]} */
export function wormLine(w, ox) {
  const P = [w.rl, ...w.pts, w.fl].map(p => ({ x: p.x - ox, y: p.y })), out = [{ x: P[0].x, y: P[0].y }];
  /** @param {{ x: number, y: number }} a @param {{ x: number, y: number }} b @param {{ x: number, y: number }} e */
  const quad = (a, b, e) => { for (let k = 1; k <= 6; k++) { const t = k / 6, u = 1 - t; out.push({ x: u * u * a.x + 2 * u * t * b.x + t * t * e.x, y: u * u * a.y + 2 * u * t * b.y + t * t * e.y }); } };
  let a = { x: (P[0].x + P[1].x) / 2, y: (P[0].y + P[1].y) / 2 };
  out.push(a);
  for (let i = 1; i < P.length - 1; i++) {
    const e = i === P.length - 2 ? P[i + 1] : { x: (P[i].x + P[i + 1].x) / 2, y: (P[i].y + P[i + 1].y) / 2 };
    quad(a, P[i], e); a = e;
  }
  let L = 0; const d = [0];
  for (let i = 1; i < out.length; i++) { L += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y); d.push(L); }
  return out.map((p, i) => ({ x: p.x, y: p.y, s: L > 0 ? d[i] / L : 0 }));
}
// one worm (world units, ctx already scaled; ox: the view's left edge): fat in the middle, thinner to both ends (DEV.glowTaper:
// an end's thickness, a share of the middle's), a green outline round a white-green body. The scene draws it through
// pixelSprite (the creatures' pixel look)
/** @param {CanvasRenderingContext2D} c @param {GlowWorm} w @param {number} ox */
export function drawGlowWorm(c, w, ox) {
  const Q = wormLine(w, ox), W = DEV.glowW * w.sz, tp = DEV.glowTaper, hp = tp + (1 - tp) * w.ag;   // (stood up: the head end as fat as the middle)
  /** @param {number} s */
  const th = s => { const t0 = s > 0.5 ? hp : tp; return W * (t0 + (1 - t0) * Math.sin(Math.PI * s)); };
  for (const { col, add } of [{ col: EDGE, add: 0.3 }, { col: BODY, add: -0.9 }]) {
    c.fillStyle = col;
    for (let i = 0; i < Q.length; i++) {
      const p = Q[i], r = Math.max(0.15, (th(p.s) + add) / 2);
      c.beginPath(); c.arc(p.x, p.y, r, 0, 6.29); c.fill();
      if (i) {   // (the gap between samples filled: a quad from the last disc to this one)
        const q = Q[i - 1], rq = Math.max(0.15, (th(q.s) + add) / 2), dx = p.x - q.x, dy = p.y - q.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
        c.beginPath(); c.moveTo(q.x + nx * rq, q.y + ny * rq); c.lineTo(p.x + nx * r, p.y + ny * r); c.lineTo(p.x - nx * r, p.y - ny * r); c.lineTo(q.x - nx * rq, q.y - ny * rq); c.fill();
      }
    }
  }
}
// the box a worm is drawn in (screen units): for the pixel layer
/** @param {GlowWorm} w @param {number} ox */
export function wormBox(w, ox) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of [w.rl, w.fl, ...w.pts]) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const e = DEV.glowW * w.sz + 3;
  return { x: Math.floor(x0 - ox - e), y: Math.floor(y0 - e), w: Math.ceil(x1 - x0 + 2 * e) + 1, h: Math.ceil(y1 - y0 + 2 * e) + 1 };
}

// the head, once it stands up (smooth, over the pixel layer, bigger than the body's scale so the face reads): a white-green
// disc with the green outline, a dark mouth in its middle growing and shrinking fast (DEV.glowMouthSpd), two black dot eyes above
/** @param {CanvasRenderingContext2D} c @param {GlowWorm} w @param {number} ox @param {number} t seconds */
export function drawGlowFace(c, w, ox, t) {
  if (w.ag < 0.3) return;
  const k = Math.min(1, (w.ag - 0.3) / 0.5), H = 2.2 * k * w.sz, x = w.fl.x - ox - w.ux * 0.6, y = w.fl.y - w.uy * 0.6, qx = -w.uy, qy = w.ux;
  c.fillStyle = '#2fd23a'; c.beginPath(); c.arc(x, y, H + 0.5, 0, 6.29); c.fill();
  c.fillStyle = '#e6ffd8'; c.beginPath(); c.arc(x, y, H, 0, 6.29); c.fill();
  c.fillStyle = '#0d2a10';
  c.beginPath(); c.arc(x - w.ux * H * 0.15, y - w.uy * H * 0.15, H * 0.36 * (1 + 0.4 * Math.sin(t * DEV.glowMouthSpd + w.ph)), 0, 6.29); c.fill();
  c.fillStyle = '#000';
  for (const sd of [-1, 1]) { c.beginPath(); c.arc(x + w.ux * H * 0.5 + qx * sd * H * 0.38, y + w.uy * H * 0.5 + qy * sd * H * 0.38, H * 0.16, 0, 6.29); c.fill(); }
}

// ---- the look (C5c): the glow behind each worm, its light, and the effects layer drifting across them ----
// a worm's flicker at time t: 1 less up to DEV.glowFlicker, in its own pattern (its phase)
/** @param {GlowWorm} w @param {number} t */
export function wormFlicker(w, t) {
  const n = 0.5 + 0.25 * Math.sin(t * 7.3 + w.ph * 3) + 0.15 * Math.sin(t * 13.1 + w.ph * 7) + 0.1 * Math.sin(t * 23.7 + w.ph);
  return 1 - DEV.glowFlicker * Math.max(0, Math.min(1, n));
}
// its glow colour at u (0 bright, 1 deep), calm → agro by how far it has stood up
/** @param {GlowWorm} w @param {number} u @returns {number[]} */
export function wormCol(w, u) {
  const a = hexArr(kcol('glowColCalm', u)), b = hexArr(kcol('glowColAgro', u));
  return a.map((v, i) => Math.round(v + (b[i] - v) * w.ag));
}
// the glow behind a worm (added light): bright → deep → nothing over DEV.glowSize, flickering
/** @param {CanvasRenderingContext2D} c @param {GlowWorm} w @param {number} ox @param {number} t */
export function drawWormGlow(c, w, ox, t) {
  const m = w.pts[2], m2 = w.pts[3], x = (m.x + m2.x) / 2 - ox, y = (m.y + m2.y) / 2, R = DEV.glowSize, a = DEV.glowGlow * wormFlicker(w, t);
  if (R <= 0 || a <= 0) return;
  const b = wormCol(w, 0), d = wormCol(w, 1), g = c.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, 'rgba(' + b + ',' + a + ')'); g.addColorStop(0.35, 'rgba(' + d + ',' + (a * 0.55) + ')'); g.addColorStop(1, 'rgba(' + d + ',0)');
  c.fillStyle = g; c.fillRect(x - R, y - R, R * 2, R * 2);
}
// the effects layer (the Mossy Caves vine and jellyfish glow overlay's twinkle): a wide soft glow round every worm in reach,
// cut by a noise pattern drifting through the world, so light seems to pass between them. Calm: slow and smooth; agro (by
// w.ag): its own colour (orange), a finer pattern, faster, sharper. out: RGBA, W × H cells of px world units from (ox, oy)
/** @param {Uint8ClampedArray} out @param {number} W @param {number} H @param {{ ox: number, oy: number, px: number, t: number, worms: GlowWorm[] }} o */
export function wormFxFill(out, W, H, o) {
  const D = DEV, R = D.glowFxR;
  if (R <= 0 || D.glowFx <= 0) return false;
  const L = o.worms.map(w => {
    const m = w.pts[2], k = w.ag;
    return { x: m.x, y: m.y, c: wormCol(w, 0.3), f: wormFlicker(w, o.t), size: D.glowFxSizeC + (D.glowFxSizeA - D.glowFxSizeC) * k,
      sp: D.glowFxSpdC + (D.glowFxSpdA - D.glowFxSpdC) * k, sh: D.glowFxSharpC + (D.glowFxSharpA - D.glowFxSharpC) * k };
  });
  let any = false;
  for (let y = 0; y < H; y++) {
    const wy = o.oy + (y + 0.5) * o.px;
    for (let x = 0; x < W; x++) {
      const wx = o.ox + (x + 0.5) * o.px;
      let r = 0, g = 0, b = 0;
      for (const q of L) {
        const d = Math.hypot(wx - q.x, wy - q.y);
        if (d >= R) continue;
        const fall = (1 - d / R) * (1 - d / R), v = Math.max(0, Math.min(1, (twinkle(wx, wy, o.t * q.sp, q.size) - 0.5) * q.sh + 0.5));
        const k = fall * v * q.f * D.glowFx;
        r += q.c[0] * k; g += q.c[1] * k; b += q.c[2] * k;
      }
      if (r + g + b < 1) continue;
      const i = (y * W + x) * 4;
      out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255; any = true;
    }
  }
  return any;
}

// ---- Dev → Glow worms: the live preview's lab (ui/glowpreview.js) ----
// a small cave room (floor, walls, roof, a pillar) with GLOW_LAB_N worms on its floor, roof and walls, stepped by the real
// stepWorm with the live DEV knobs; a stand-in player walks across and back, so they stand up, strike, and now and then the
// nearest one in agro is "shot" and blows up (a burst of particles). Worms gone are put back after a moment. Everything it
// keeps is capped (the particles at GLOW_LAB_PARTS), so it never slows down over time. GLOW_CMD.reset (the Dev button) starts it afresh
export const GLOW_LAB_W = 180, GLOW_LAB_H = 100, GLOW_LAB_N = 6, GLOW_LAB_PARTS = 240;
export const GLOW_CMD = { reset: false };
/** @typedef {{ x: number, y: number, vx: number, vy: number, life: number, max: number, col: string, r: number }} GlowPart */
/** @typedef {{ worms: GlowWorm[], parts: GlowPart[], booms: { x: number, y: number, t: number }[], solid: WormSolid, floor: number, px: number, dir: number, wait: number, shot: number, back: number, key: string, t: number, strikes: number, kills: number }} GlowLab */
/** @returns {GlowLab} */
export function glowLab() {
  const floor = GLOW_LAB_H - 12;
  /** @type {WormSolid} */
  const solid = (x, y) => x < 8 || x >= GLOW_LAB_W - 8 || y < 10 + 4 * Math.sin(x * 0.08) || y >= floor || (Math.abs(x - 112) < 6 && y > floor - 34);
  return { worms: [], parts: [], booms: [], solid, floor, px: -20, dir: 1, wait: 1, shot: 4, back: 0, key: '', t: 0, strikes: 0, kills: 0 };
}
// the spots the lab's worms start on: the floor, the roof, both walls, the pillar's top
const LAB_SPOTS = [[30, 1], [70, 1], [150, 1], [50, -1], [130, -1], [9, 0], [171, 0], [112, 2]];
/** @param {GlowLab} L @param {() => number} rnd */
function labFill(L, rnd) {
  const order = LAB_SPOTS.map(q => ({ q, k: rnd() })).sort((p, q) => p.k - q.k).map(p => p.q);   // (every spot once, in a random order)
  for (let i = 0; L.worms.length < GLOW_LAB_N && i < order.length; i++) {
    const [x, k] = order[i];
    let px = x, py = 0;
    if (k === 1) py = L.floor - 0.5;
    else if (k === -1) { py = 20; while (L.solid(px, py) && py < L.floor) py++; py += 0.5; }
    else if (k === 0) { py = 50; px = x < 90 ? 8.5 : GLOW_LAB_W - 8.5; }
    else { py = 20; while (!L.solid(px, py + 1) && py < L.floor) py++; py += 0.5; }
    if (L.worms.some(w => Math.hypot(w.r.x - px, w.r.y - py) < 12)) continue;
    const w = newWorm(px, py, rnd() < 0.5 ? 1 : -1, L.solid, rnd);
    if (w) L.worms.push(w);
  }
}
// a lab worm blown up: a burst of green particles (capped), a flash
/** @param {GlowLab} L @param {GlowWorm} w @param {() => number} rnd */
function labBlast(L, w, rnd) {
  const m = w.pts[2] || w.r;
  L.booms.push({ x: m.x, y: m.y, t: 0 });
  for (let i = 0; i < 40; i++) {
    const a = rnd() * 6.283, v = 30 + rnd() * 120, l = 0.4 + rnd() * 0.6;
    L.parts.push({ x: m.x, y: m.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: l, max: l, col: i % 3 ? '#7dff3a' : '#eaffd8', r: 0.6 + rnd() * 0.8 });
  }
  L.worms = L.worms.filter(q => q !== w); L.kills++; L.back = 1.5;
}
/** @param {GlowLab} L @param {number} dt @param {() => number} [rnd] */
export function glowLabStep(L, dt, rnd = Math.random) {
  L.t += dt;
  const key = DEV.glowSizeMin + ',' + DEV.glowSizeMax + ',' + DEV.glowLen + ',' + DEV.glowW;
  if (GLOW_CMD.reset || key !== L.key) { GLOW_CMD.reset = false; L.key = key; L.worms = []; L.parts = []; L.booms = []; labFill(L, rnd); }
  // the player: waits off one side, walks across, waits off the other, walks back
  if (L.wait > 0) L.wait -= dt;
  else { L.px += L.dir * 26 * dt; if (L.px > GLOW_LAB_W + 20 || L.px < -20) { L.dir = -L.dir; L.wait = 1.5; } }
  const tgt = { x: L.px, y: L.floor - 6 };
  for (const w of L.worms) {
    const ev = stepWorm(w, dt, L.solid, rnd, L.px > 0 && L.px < GLOW_LAB_W ? tgt : null);
    if (ev === 'strike') L.strikes++;
    if (ev === 'plant' && L.parts.length < GLOW_LAB_PARTS) {   // (the spores' puff)
      const m = w.pts[2], a0 = Math.atan2(w.r.ny + w.f.ny, w.r.nx + w.f.nx);
      for (let i = 0; i < Math.round(DEV.glowSpores); i++) {
        const a = a0 + (rnd() * 2 - 1) * DEV.glowSporeSpread * Math.PI / 180, v = DEV.glowSporeSpd * (0.6 + 0.4 * rnd()), l = 2 + rnd() * 2;
        L.parts.push({ x: m.x, y: m.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: l, max: l, col: '#7dff3a', r: 0.7 });
      }
    }
  }
  // now and then the nearest worm in agro is shot and blows up; gone ones are put back after a moment
  if ((L.shot -= dt) <= 0) {
    L.shot = 3 + rnd() * 3;
    const up = L.worms.filter(w => w.st !== 'roam').sort((a, b) => Math.abs(a.r.x - L.px) - Math.abs(b.r.x - L.px))[0];
    if (up) labBlast(L, up, rnd);
  }
  if (L.back > 0 && (L.back -= dt) <= 0) labFill(L, rnd);
  for (const p of L.parts) { const k = Math.exp(-3 * dt); p.vx *= k; p.vy *= k; p.vy -= 4 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  L.parts = L.parts.filter(p => p.life > 0).slice(-GLOW_LAB_PARTS);
  for (const b of L.booms) b.t += dt;
  L.booms = L.booms.filter(b => b.t < 0.5);
}
