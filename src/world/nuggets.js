// @ts-check
// Gold nuggets: dropped gold split into three sizes (splitGold, spillGold), and their physics
// (stepNugget against the rock, collideNuggets against each other): they fall, bounce, roll down
// slopes and never stack in one spot. Pure: the rock comes in as a solid(x, y) test.

// the three sizes, biggest first: what one is worth and its radius (world units)
export const NUGGETS = [{ v: 25, r: 8.4 }, { v: 5, r: 6 }, { v: 1, r: 4 }];
export const NUG_CAP = 20;          // at most this many nuggets from one drop (big ones carry the rest)
export const NUG_GRAV = 420, NUG_ROLL = 260, NUG_BOUNCE = 0.35;

// a nugget's radius, from what it is worth
/** @param {number} amount */
export const nugR = amount => amount >= NUGGETS[0].v ? NUGGETS[0].r : amount >= NUGGETS[1].v ? NUGGETS[1].r : NUGGETS[2].r;

// split an amount into nuggets that add up to it exactly: as many big ones as fit, less one now
// and then (broken into medium and small), then medium the same way, small ones for the change
/** @param {number} amount @param {() => number} [rnd] @returns {number[]} */
export function splitGold(amount, rnd) {
  rnd = rnd || Math.random;
  let rem = Math.max(0, Math.round(amount));
  const out = [];
  for (let s = 0; s < 2; s++) {
    const v = NUGGETS[s].v;
    let n = Math.floor(rem / v);
    if (n > 0 && rnd() < 0.5) n--;
    for (let k = 0; k < n; k++) out.push(v);
    rem -= n * v;
  }
  for (let k = 0; k < rem; k++) out.push(1);
  // too many: fold the smallest into the next one up (the total never changes)
  while (out.length > NUG_CAP) { const a = out.pop() || 0; out[out.length - 1] += a; }
  return out;
}

// a spilled nugget can't be picked up for this long (s): close by, you'd take it before it was ever drawn
export const SPILL_WAIT = 0.25;

// throw an amount's nuggets out of a point into the list: a little spray, up and to the sides
/** @param {Coin[]} list @param {number} x @param {number} y @param {number} amount @param {{ vx?: number, vy?: number }} [kick] spread and upward speed */
export function spillGold(list, x, y, amount, kick) {
  const sx = kick && kick.vx != null ? kick.vx : 60, sy = kick && kick.vy != null ? kick.vy : 70;
  for (const v of splitGold(amount)) {
    list.push({ x: x + (Math.random() - 0.5) * 6, y, amount: v, t: Math.random() * 6.28, a: Math.random() * 6.28,
      vx: (Math.random() - 0.5) * 2 * sx, vy: -sy * (0.7 + Math.random() * 0.6), nopull: SPILL_WAIT });
  }
}

// one nugget against the rock for a frame: gravity, a bounce on landing, rolling down a slope,
// stepping over a pixel-high bump. Returns true on a hard landing (for the clink). Crystals use it
// too, with their own radius `rad` (v0.0.138: they're rocks you push about, game/systems/shops.js)
/** @param {Nug} g @param {number} dt @param {(x: number, y: number) => boolean} solid @param {number} [rad] */
export function stepNugget(g, dt, solid, rad) {
  const r = rad || nugR(g.amount || 0);
  g.vx = g.vx || 0; g.vy = g.vy || 0;
  // buried (the rock moved, or it was spilled into a wall): up and out
  for (let k = 0; k < 8 && solid(g.x, g.y); k++) g.y -= 2;
  g.vy = Math.min(600, g.vy + NUG_GRAV * dt);
  g.vx *= Math.exp(-0.4 * dt);
  let hard = false;
  // sideways, stepping up a little bump if there is one
  if (g.vx) {
    const sg = Math.sign(g.vx), nx = g.x + g.vx * dt;
    if (!solid(nx + sg * r, g.y)) g.x = nx;
    else if (!solid(nx + sg * r, g.y - 2) && !solid(nx, g.y - r - 2)) { g.x = nx; g.y -= 2; }
    else g.vx = -g.vx * 0.3;
  }
  // down (or up)
  const ny = g.y + g.vy * dt;
  let ground = false;
  if (g.vy >= 0 && solid(g.x, ny + r)) {
    if (g.vy > 80) { hard = true; g.vy = -g.vy * NUG_BOUNCE; g.vx *= 0.8; }
    else g.vy = 0;
    for (let k = 0; k < 6 && solid(g.x, g.y + r); k++) g.y -= 1;   // sit on the rock, not in it
    ground = true;
  } else if (g.vy < 0 && solid(g.x, ny - r)) g.vy = 0;
  else g.y = ny;
  // on the ground (or a hair above it, hopping down a stepped slope): roll toward the lower side;
  // on the flat, friction stops it
  if (!ground && g.vy >= 0 && g.vy < 80 && solid(g.x, g.y + r + 2.5)) ground = true;
  if (ground && g.vy >= 0) {
    const L = solid(g.x - r, g.y + r + 1.5), R = solid(g.x + r, g.y + r + 1.5);
    if (!L && R) g.vx -= NUG_ROLL * dt;
    else if (L && !R) g.vx += NUG_ROLL * dt;
    else if (!L && !R) g.vx += (g.t > 3.14 ? 1 : -1) * NUG_ROLL * dt;   // balanced on a point: off it
    else { g.vx *= Math.exp(-7 * dt); if (Math.abs(g.vx) < 2) g.vx = 0; }
    g.ground = 1;
  } else g.ground = 0;
  g.a = (g.a || 0) + g.vx * dt / r;      // it turns as it rolls
  return hard;
}

// nuggets push each other apart (one resting on the rock gives less), and trade the speed they
// close at, so a heap slumps and spreads instead of piling into one spot
/** @param {Nug[]} list @param {(x: number, y: number) => boolean} solid @param {(b: Nug) => number} [rOf] a body's radius (crystals) */
export function collideNuggets(list, solid, rOf) {
  const rad = rOf || (g => nugR(g.amount || 0));
  const n = list.length;
  if (n < 2) return;
  const ord = list.slice().sort((a, b) => a.x - b.x);
  const reach = list.reduce((m, g) => Math.max(m, rad(g)), 0) * 2;
  for (let i = 0; i < n; i++) {
    const a = ord[i];
    if (a.fly) continue;
    const ra = rad(a);
    for (let j = i + 1; j < n; j++) {
      const b = ord[j];
      if (b.x - a.x >= reach) break;
      if (b.fly) continue;
      const min = ra + rad(b);
      let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d >= min) continue;
      if (d < 0.01) { const ang = ((a.t || 0) + (b.t || 0)) * 3.7; dx = Math.cos(ang); dy = -Math.abs(Math.sin(ang)); d = 1; }
      const nx = dx / d, ny = dy / d, push = min - d;
      // one resting on another that sits on the rock: the lower one is as good as rock, the upper
      // one takes the whole push (and so rolls off it, or rests on it); side by side they share it
      let wa = 0.5, wb = 0.5;
      if (ny > 0.85 && b.ground) { wa = 1; wb = 0; a.ground = 1; }
      else if (ny < -0.85 && a.ground) { wa = 0; wb = 1; b.ground = 1; }
      const ax = a.x - nx * push * wa, ay = a.y - ny * push * wa;
      const bx = b.x + nx * push * wb, by = b.y + ny * push * wb;
      if (!solid(ax, ay)) { a.x = ax; a.y = ay; }
      if (!solid(bx, by)) { b.x = bx; b.y = by; }
      const rv = ((b.vx || 0) - (a.vx || 0)) * nx + ((b.vy || 0) - (a.vy || 0)) * ny;
      if (rv < 0) {
        const imp = -rv;                      // no bounce off each other: gold is heavy
        a.vx = (a.vx || 0) - nx * imp * wa; a.vy = (a.vy || 0) - ny * imp * wa;
        b.vx = (b.vx || 0) + nx * imp * wb; b.vy = (b.vy || 0) + ny * imp * wb;
      }
    }
  }
}

// a round body of radius r shoved out of a box (you: x, y its top left, w by h) moving at (vx, vy):
// pushed clear the shortest way and given at least the box's speed that way, so walking into a
// crystal rolls it ahead of you. Never into rock (it stays put then). Returns true if it touched
/** @param {Nug} g @param {number} r @param {{ x: number, y: number, w: number, h: number }} box @param {number} vx @param {number} vy @param {(x: number, y: number) => boolean} solid */
export function shoveNugget(g, r, box, vx, vy, solid) {
  const cx = Math.max(box.x, Math.min(g.x, box.x + box.w)), cy = Math.max(box.y, Math.min(g.y, box.y + box.h));
  let dx = g.x - cx, dy = g.y - cy, d = Math.hypot(dx, dy), push;
  if (d >= r) return false;
  if (d < 0.01) {                          // its middle inside the box: out the nearest side
    const L = g.x - box.x, R = box.x + box.w - g.x, T = g.y - box.y, B = box.y + box.h - g.y, m = Math.min(L, R, T, B);
    dx = m === L ? -1 : m === R ? 1 : 0; dy = dx ? 0 : m === T ? -1 : 1;
    d = 1; push = m + r;
  } else push = r - d;
  const ux = dx / d, uy = dy / d, x = g.x + ux * push, y = g.y + uy * push;
  if (!solid(x + ux * r, y + uy * r)) { g.x = x; g.y = y; }
  const vn = vx * ux + vy * uy, gn = (g.vx || 0) * ux + (g.vy || 0) * uy;
  if (vn > gn) { g.vx = (g.vx || 0) + ux * (vn - gn) * 1.1; g.vy = (g.vy || 0) + uy * (vn - gn) * 1.1; }
  return true;
}
