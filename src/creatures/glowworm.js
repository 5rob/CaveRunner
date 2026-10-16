// Glow worms (Coal Seams, grem chunk C5; the owner's spec): fat little inchworms roaming every surface (floor, walls, roof,
// round corners). Stage a: the body and the gait only. A worm is a plain object (`GlowWorm`, a foe can carry it later): two
// feet on the rock (a point just off it and the rock's outward normal there), the crank angle th, the direction it crawls,
// and the body's six joints. Stepped from the level scene (art/titlescene.js wormsStep), drawn by drawWorms
// (game/render/titledraw.js). Every number is a Dev knob (group 'glow'). World units throughout (the scene's 220 a screen).
//
// The gait (the owner's): two cranks half a turn apart; foot gap = dMid − A·cos θ (A = stride / 2). θ in 0..π: the rear grips
// and the front reaches along the surface, lifted liftF·A·sin θ; θ in π..2π: the front grips and the rear follows, lifted
// liftR·A·|sin θ|. A gripping foot is never moved. The body: FABRIK over six joints (five equal bones) pinned footLen out
// from each foot, started from a circular arc of the body's length bulging away from the rock, so close feet make an Ω.

import { DEV } from '../dev/knobs.js';

/** @typedef {{ x: number, y: number, nx: number, ny: number }} WormFoot */
/** @typedef {{ r: WormFoot, f: WormFoot, rl: { x: number, y: number }, fl: { x: number, y: number }, th: number, dir: number, pts: { x: number, y: number }[], ph: number }} GlowWorm */
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
  const w = { r, f: r, rl: { x, y }, fl: { x, y }, th: 0, dir, pts: [], ph: rnd() * 6.28 };
  const g = (DEV.glowDMin + DEV.glowDMax) / 2 - DEV.glowStride / 2;
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

// one frame of a worm's gait, then its body
/** @param {GlowWorm} w @param {number} dt @param {WormSolid} solid @param {() => number} rnd */
export function stepWorm(w, dt, solid, rnd) {
  const D = DEV, A = D.glowStride / 2, dMid = (D.glowDMin + D.glowDMax) / 2;
  w.th += D.glowCrank * dt;
  if (w.th >= 2 * Math.PI) { w.th -= 2 * Math.PI; if (rnd() < D.glowTurn) turn(w); }
  for (let k = 0; k < 2; k++) {
    const gap = dMid - A * Math.cos(w.th), ext = w.th < Math.PI;
    const p = ext ? wormCrawl(w.r, gap, w.dir, solid) : wormCrawl(w.f, gap, -w.dir, solid);
    if (p) { if (ext) w.f = p; else w.r = p; break; }
    turn(w);   // (the rock gives out ahead: back the way it came)
  }
  wormBody(w, solid);
}

// the lifted feet and the body: six joints pinned footLen out from them, FABRIK from an arc bulging off the rock
/** @param {GlowWorm} w @param {WormSolid} [solid] */
export function wormBody(w, solid) {
  const D = DEV, A = D.glowStride / 2, s = Math.sin(w.th), ext = w.th < Math.PI;
  const lf = ext ? D.glowLiftF * A * s : 0, lr = ext ? 0 : D.glowLiftR * A * -s;
  w.fl = { x: w.f.x + w.f.nx * lf, y: w.f.y + w.f.ny * lf };
  w.rl = { x: w.r.x + w.r.nx * lr, y: w.r.y + w.r.ny * lr };
  const a = { x: w.rl.x + w.r.nx * D.glowFoot, y: w.rl.y + w.r.ny * D.glowFoot };
  const e = { x: w.fl.x + w.f.nx * D.glowFoot, y: w.fl.y + w.f.ny * D.glowFoot };
  w.pts = fabrik(a, e, w.r.nx + w.f.nx, w.r.ny + w.f.ny, D.glowLen / 5, solid);
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
const BODY = '#e6ffd8', EDGE = '#2fd23a';   // (stage a's plain placeholder: white-green, a green outline; the glow comes in stage b)
/** @param {CanvasRenderingContext2D} c @param {GlowWorm[]} list @param {number} ox */
export function drawWorms(c, list, ox) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const w of list) {
    if (w.r.x - ox < -30 || w.r.x - ox > 250) continue;
    const P = [w.rl, ...w.pts, w.fl].map(p => ({ x: p.x - ox, y: p.y }));
    const path = () => {
      c.beginPath(); c.moveTo(P[0].x, P[0].y); c.lineTo(P[1].x, P[1].y);
      for (let i = 1; i < P.length - 2; i++) c.quadraticCurveTo(P[i].x, P[i].y, (P[i].x + P[i + 1].x) / 2, (P[i].y + P[i + 1].y) / 2);
      c.quadraticCurveTo(P[P.length - 2].x, P[P.length - 2].y, P[P.length - 1].x, P[P.length - 1].y);
    };
    path(); c.strokeStyle = EDGE; c.lineWidth = DEV.glowW + 1.2; c.stroke();
    path(); c.strokeStyle = BODY; c.lineWidth = DEV.glowW; c.stroke();
  }
  c.lineCap = 'butt'; c.lineJoin = 'miter';
}
