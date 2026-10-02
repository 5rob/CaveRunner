// @ts-check
// Vines and web lines that give (v127): a cheap stand-in for rope physics, looks only — none of
// it changes how you move except the swing on a hanging vine and the bob on a line you hold.
//
// A line (a web line, an arched vine) bends as a whole: one damped spring, its bend (wx, wy) at
// the point wu along it, the rest straight from each end to that point (a tent, so a line you
// hang on goes taut in a V). A web line also sags a little at rest (`sag`, world units at its
// middle). A hanging vine is a pendulum about its root: one angle (sw) and its speed (swv), drawn
// as the whole vine turned. Only what you touch wakes; it sleeps again once it's still. Grabbing
// and everything else that finds a line (rats, fire, spiders) asks these, so it's where it's drawn.

/** how much of the bend reaches fraction u along a line whose bend peaks at pu (0 at the ends, 1 at pu) @param {number} u @param {number} pu */
export const tent = (u, pu) => (u <= pu ? (pu > 0 ? u / pu : 0) : (pu < 1 ? (1 - u) / (1 - pu) : 0));

/** @typedef {{ wx?: number, wy?: number, wvx?: number, wvy?: number, wu?: number }} Bendy */

// One step of a line's bend toward (tx, ty) (your weight on it, or nothing): a damped spring,
// stiffness K, damping D, never more than max from straight. False once it has settled at rest
// (and then it is put exactly back, so it sleeps).
/** @param {Bendy} o @param {number} tx @param {number} ty @param {number} K @param {number} D @param {number} max @param {number} dt */
export function bendStep(o, tx, ty, K, D, max, dt) {
  let x = o.wx || 0, y = o.wy || 0, vx = o.wvx || 0, vy = o.wvy || 0;
  dt = Math.min(dt, 1 / 30);                 // a long frame would throw the spring
  vx += (-K * (x - tx) - D * vx) * dt; vy += (-K * (y - ty) - D * vy) * dt;
  x += vx * dt; y += vy * dt;
  const m = Math.hypot(x, y);
  if (m > max) {                             // at full stretch: no further, and no speed outward
    x *= max / m; y *= max / m;
    const out = (vx * x + vy * y) / (max * max);
    if (out > 0) { vx -= out * x; vy -= out * y; }
  }
  const still = !tx && !ty && Math.abs(x) + Math.abs(y) < 0.05 && Math.abs(vx) + Math.abs(vy) < 0.5;
  o.wx = still ? 0 : x; o.wy = still ? 0 : y; o.wvx = still ? 0 : vx; o.wvy = still ? 0 : vy;
  return !still;
}
// something moving at (vx, vy) through the line at fraction u along it: the bend peaks there and
// its speed is drawn toward `share` of yours (so it is pushed the way you went, and lags behind)
/** @param {Bendy} o @param {number} u @param {number} vx @param {number} vy @param {number} share @param {number} dt */
export function bendPush(o, u, vx, vy, share, dt) {
  o.wu = Math.max(0.05, Math.min(0.95, u));
  const k = Math.min(1, 10 * dt);
  o.wvx = (o.wvx || 0) + (vx * share - (o.wvx || 0)) * k;
  o.wvy = (o.wvy || 0) + (vy * share - (o.wvy || 0)) * k;
}
/** is the line moving or bent (or held)? @param {Bendy} o */
export const bendAwake = o => !!(o.wx || o.wy || o.wvx || o.wvy);

// One step of a free hanging vine's swing: a pendulum of length L under gravity g, damped by D,
// never past max radians either side. False once it hangs still again.
/** @param {{ sw?: number, swv?: number }} o @param {number} L @param {number} g @param {number} D @param {number} max @param {number} dt */
export function swingStep(o, L, g, D, max, dt) {
  let a = o.sw || 0, v = o.swv || 0;
  dt = Math.min(dt, 1 / 30);
  v += (-(g / Math.max(2, L)) * Math.sin(a) - D * v) * dt;
  a += v * dt;
  if (a > max) { a = max; if (v > 0) v = 0; } else if (a < -max) { a = -max; if (v < 0) v = 0; }
  const still = Math.abs(a) < 0.002 && Math.abs(v) < 0.01;
  o.sw = still ? 0 : a; o.swv = still ? 0 : v;
  return !still;
}

// ---- where a line is ----
// a web line at fraction u from a0 to b0: the straight line, its sag, and its bend
/** @param {WebLine} L @param {number} u @returns {Pt} */
export function webAt(L, u) {
  const t = tent(u, L.wu == null ? 0.5 : L.wu), s = 4 * u * (1 - u) * (L.sag || 0);
  return { x: L.a0x + (L.b0x - L.a0x) * u + t * (L.wx || 0), y: L.a0y + (L.b0y - L.a0y) * u + s + t * (L.wy || 0) };
}
// the nearest point on a web line to (x, y) (found along the straight line, then sagged and bent
// with it: close enough for the shallow curves these make), and its fraction u along
/** @param {WebLine} L @param {number} x @param {number} y */
export function webNearU(L, x, y) {
  const vx = L.b0x - L.a0x, vy = L.b0y - L.a0y, ll = vx * vx + vy * vy || 1;
  const u = Math.max(0, Math.min(1, ((x - L.a0x) * vx + (y - L.a0y) * vy) / ll));
  const q = webAt(L, u);
  return { x: q.x, y: q.y, u };
}
// trace a web line as drawn into the current path (straight when it's neither sagging nor bent)
/** @param {CanvasRenderingContext2D} ctx @param {WebLine} L */
export function webPath(ctx, L) {
  ctx.moveTo(L.a0x, L.a0y);
  if (!L.sag && !bendAwake(L)) { ctx.lineTo(L.b0x, L.b0y); return; }
  for (let k = 1; k <= 8; k++) { const q = webAt(L, k / 8); ctx.lineTo(q.x, q.y); }
}

// A hanging vine's root, moved by the arch it hangs off (a strand), and how far across its
// swing has carried it at height y (the whole vine turned about its root, so down it at depth d,
// sin(sw) × d across)
/** @param {Prop} pr */
export const hangRootX = pr => (pr.on && pr.on.wx ? tent(pr.u || 0, pr.on.wu == null ? 0.5 : pr.on.wu) * pr.on.wx : 0);
/** @param {Prop} pr */
export const hangRootY = pr => (pr.on && pr.on.wy ? tent(pr.u || 0, pr.on.wu == null ? 0.5 : pr.on.wu) * pr.on.wy : 0);
/** @param {Prop} pr @param {number} y */
export function hangX(pr, y) {
  const rx = hangRootX(pr);
  if (!pr.sw) return rx;
  return rx + Math.sin(pr.sw) * Math.max(0, Math.min(pr.len || 0, y - pr.y - hangRootY(pr)));
}
// can this prop swing? (a hanging vine, chain, root, strand — not an arch, not a frozen fall)
/** @param {Prop} pr */
export const swings = pr => pr.k === 'climb' && !pr.arc && !!pr.len && pr.st !== 'icefall';
