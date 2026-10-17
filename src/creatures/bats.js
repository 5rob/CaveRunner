// Bats (Coal Seams; the owner's rewrite spec, 2026-10-17): spawners scattered over the downward-facing rock, each releasing a
// group of bats that belong to it. A bat is a foe the players shoot (its stand-in among the foes: art/titlescene.js batsStep).
// Five states: HANGING under the rock near its spawner, ROAMING the open air round it, FLEEING a player (faster), ATTACKING (one
// fast streak at a player, a bite), RETURNING to a spot under the rock near its spawner. Every flying state travels in straight
// lines to its target, with a soft wiggle across the way and the bob (the wings beat down as it bobs up).
// Pure: stepBats(B, dt, players, solid, rnd, onBite); drawn by drawBats (game/render/titledraw.js, ui/batpreview.js). Every number
// is a Dev knob in group 'bats' (dev/knobs.js): times, distances and speeds as ranges (Lo/Hi), chances a second as single knobs.
// World units throughout (the scene's 220 a screen).

import { DEV, kr, kru } from '../dev/knobs.js';

/** @typedef {'hang' | 'roam' | 'flee' | 'attack' | 'return'} BatState */
/** @typedef {{ x: number, y: number, n: number }} BatSpawner */
/** @typedef {{ x: number, y: number, bx: number, by: number, sp: BatSpawner, st: BatState, u: number, placed: boolean, gone?: boolean,
 *   hx: number, hy: number, tx: number, ty: number, spd: number, t: number, wait: number, calm: number, flut: number, fp: number,
 *   wt: number, ang: number, bite: number, f?: any, hpSeen?: number }} Bat */
/** @typedef {{ spawners: BatSpawner[], list: Bat[], hits?: number }} Bats */
/** @typedef {(x: number, y: number) => boolean} BatSolid */

// the Dev panel's buttons (ui/devpanel.js): read and cleared by the next stepBats
export const BAT_CMD = { reset: false, scare: false };
const TRIES = 16;     // tries at a random target before settling
const CLEAR = 6;      // a flight target this far from any rock (units)

/** @returns {Bats} */
export const newBats = () => ({ spawners: [], list: [] });

// a spawner at (x, y), the underside of rock: it releases batPerSpawn (min-max) bats, each hung at its own random spot near it
/** @param {Bats} B @param {number} x @param {number} y @param {() => number} rnd */
export function addSpawner(B, x, y, rnd) {
  const n = Math.max(1, Math.round(kr('batPerSpawn', rnd)));
  /** @type {BatSpawner} */
  const sp = { x, y, n };
  B.spawners.push(sp);
  for (let i = 0; i < n; i++) B.list.push({ x, y, bx: x, by: y, sp, st: 'hang', u: rnd(), placed: false, hx: x, hy: y, tx: x, ty: y, spd: 0, t: 0, wait: 0,
    calm: 0, flut: 0, fp: rnd(), wt: rnd() * 6.28, ang: 0, bite: 0 });
  return sp;
}

// a spot on the underside of rock: rock just above, air at it; the nearest to y within 30 units up or down at x, or null
/** @param {number} x @param {number} y @param {BatSolid} solid */
function underAt(x, y, solid) {
  y = Math.round(y);
  for (let k = 0; k <= 30; k++) for (const a of [y - k, y + k]) if (!solid(x, a + 0.01) && solid(x, a - 1)) return a;
  return null;
}
// a hanging spot a random distance (batHangDist) from the spawner along its rock
/** @param {Bat} b @param {BatSolid} solid @param {() => number} rnd */
function pickHang(b, solid, rnd) {
  for (let i = 0; i < TRIES; i++) {
    const x = b.sp.x + (rnd() < 0.5 ? -1 : 1) * kr('batHangDist', rnd), y = underAt(x, b.sp.y, solid);
    if (y != null) { b.hx = x; b.hy = y; return; }
  }
  b.hx = b.sp.x; b.hy = b.sp.y;
}
// the straight line from (x0, y0) to (x1, y1) clear of rock (sampled every 2 units)
/** @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @param {BatSolid} solid */
function clearLine(x0, y0, x1, y1, solid) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2);
  for (let i = 1; i <= n; i++) if (solid(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false;
  return true;
}
// open air at (x, y): no rock within CLEAR units round it
/** @param {number} x @param {number} y @param {BatSolid} solid */
const openAt = (x, y, solid) => !solid(x, y) && !solid(x + CLEAR, y) && !solid(x - CLEAR, y) && !solid(x, y + CLEAR) && !solid(x, y - CLEAR);
// a flight target: a random point in open air within dist of the spawner, reachable in a straight line; away: a player to keep
// away from (the target on the far side of the bat from him). False: none found (it keeps the last)
/** @param {Bat} b @param {number} dist @param {BatSolid} solid @param {() => number} rnd @param {{ x: number, y: number } | null} away */
function pickTarget(b, dist, solid, rnd, away) {
  for (let i = 0; i < TRIES * 2; i++) {
    const a = rnd() * 6.283, r = Math.sqrt(rnd()) * dist, x = b.sp.x + Math.cos(a) * r, y = b.sp.y + Math.abs(Math.sin(a)) * r + 4;
    if (away && (x - b.bx) * (b.bx - away.x) + (y - b.by) * (b.by - away.y) <= 0) continue;
    if (openAt(x, y, solid) && clearLine(b.bx, b.by, x, y, solid)) { b.tx = x; b.ty = y; return true; }
  }
  return false;
}

/** @param {Bat} b @param {BatSolid} solid @param {() => number} rnd */
function toRoam(b, solid, rnd) {
  b.st = 'roam'; b.t = kr('batFlight', rnd); b.wait = 0; b.spd = kr('batSpeed', rnd);
  if (!pickTarget(b, kr('batRoamDist', rnd), solid, rnd, null)) { b.tx = b.bx; b.ty = b.by + 10; }
}
/** @param {Bat} b @param {BatSolid} solid @param {() => number} rnd @param {{ x: number, y: number } | null} from */
function toFlee(b, solid, rnd, from) {
  if (b.st === 'hang') { b.by += 2; }
  b.st = 'flee'; b.calm = kr('batCalm', rnd); b.wait = 0; b.spd = kr('batSpeed', rnd) * kr('batFleeMul', rnd);
  if (!pickTarget(b, kr('batFleeDist', rnd), solid, rnd, from)) pickTarget(b, kr('batFleeDist', rnd), solid, rnd, null);
}
/** @param {Bat} b @param {BatSolid} solid @param {() => number} rnd */
function toReturn(b, solid, rnd) {
  b.st = 'return'; b.t = 0; b.spd = kr('batSpeed', rnd);
  // a spot under the rock near the spawner it can fly straight to (else the nearest it found: it slides round the rock)
  let best = null;
  for (let i = 0; i < TRIES; i++) {
    pickHang(b, solid, rnd);
    if (clearLine(b.bx, b.by, b.hx, b.hy + 1, solid)) { best = [b.hx, b.hy]; break; }
  }
  if (best) { b.hx = best[0]; b.hy = best[1]; }
}

// the nearest player (index, distance)
/** @param {Bat} b @param {{ x: number, y: number }[]} P */
function nearest(b, P) {
  let d = Infinity, i = -1;
  for (let k = 0; k < P.length; k++) { const q = Math.hypot(P[k].x - b.x, P[k].y - b.y); if (q < d) { d = q; i = k; } }
  return { i, d };
}

// one frame of every bat. P: the players' middles; onBite(i, dmg): an attacking bat reached player i (DEV.batBite, 0 harmless)
/** @param {Bats} B @param {number} dt @param {{ x: number, y: number }[]} P @param {BatSolid} solid @param {() => number} rnd
 * @param {(i: number, dmg: number) => void} [onBite] */
export function stepBats(B, dt, P, solid, rnd, onBite) {
  const D = DEV, scareOn = D.batScare > 0.5;
  if (BAT_CMD.reset) { BAT_CMD.reset = false; for (const b of B.list) if (b.placed) { b.st = 'hang'; b.bx = b.x = b.hx; b.by = b.y = b.hy; } }
  if (BAT_CMD.scare) { BAT_CMD.scare = false; for (const b of B.list) if (b.placed && !b.gone) toFlee(b, solid, rnd, P.length ? P[0] : null); }
  for (const b of B.list) {
    if (b.gone) continue;
    if (!b.placed) { pickHang(b, solid, rnd); b.bx = b.x = b.hx; b.by = b.y = b.hy; b.placed = true; }
    b.bite -= dt;
    const n = nearest(b, P), scareR = kru('batScareR', b.u);
    if (b.st === 'hang') {
      // HANGING: still; now and then a flutter (wings beating fast a moment), now and then off ROAMING; a player near: FLEEING
      b.flut -= dt;
      if (b.flut <= 0 && rnd() < D.batFlutChance * dt) b.flut = kr('batFlutT', rnd);
      if (b.flut > 0) b.fp = (b.fp + dt * kru('batFlap', b.u) * 2) % 1;
      if (scareOn && n.d < scareR) toFlee(b, solid, rnd, P[n.i]);
      else if (rnd() < D.batRoamChance * dt) { b.by += 2; toRoam(b, solid, rnd); }
      else { b.x = b.bx = b.hx; b.y = b.by = b.hy; continue; }
    }
    let flap = kru('batFlap', b.u);
    if (b.st === 'roam') {
      if ((b.t -= dt) <= 0) toReturn(b, solid, rnd);
      else if (scareOn && n.d < scareR) toFlee(b, solid, rnd, P[n.i]);
    } else if (b.st === 'flee') {
      flap *= kru('batFleeMul', b.u);
      const near = scareOn && n.d < scareR * D.batClearMult;
      if (near && rnd() < D.batAttackChance * dt) { b.st = 'attack'; b.t = D.batAttackT; b.spd = kr('batAttackSpeed', rnd); }
      else if (!near && (b.calm -= dt) <= 0) toRoam(b, solid, rnd);
    }
    // the travel: straight to the target at its speed (ATTACKING: at the player, a fast streak)
    let arrived = false;
    if (b.st === 'attack') {
      flap *= kru('batFleeMul', b.u);
      const p = n.i >= 0 ? P[n.i] : null;
      b.t -= dt;
      if (!p || b.t <= 0) toFlee(b, solid, rnd, p);
      else {
        const dx = p.x - b.bx, dy = p.y - b.by, q = Math.hypot(dx, dy) || 1, s = Math.min(q, b.spd * dt);
        const nx = b.bx + dx / q * s, ny = b.by + dy / q * s;
        if (q < 4) {   // the bite (harmless by default), then off again
          if (onBite && D.batBite > 0 && b.bite <= 0) { b.bite = 1; onBite(n.i, D.batBite); }
          toFlee(b, solid, rnd, p);
        } else if (solid(nx, ny)) { B.hits = (B.hits || 0) + 1; toFlee(b, solid, rnd, p); }
        else { b.bx = nx; b.by = ny; b.ang = Math.atan2(dy, dx); }
      }
    } else {
      const tx = b.st === 'return' ? b.hx : b.tx, ty = b.st === 'return' ? b.hy : b.ty;
      const dx = tx - b.bx, dy = ty - b.by, q = Math.hypot(dx, dy);
      if (b.wait > 0) b.wait -= dt;
      else if (q < 2) arrived = true;
      else {
        const s = Math.min(q, b.spd * dt), nx = b.bx + dx / q * s, ny = b.by + dy / q * s;
        b.ang = Math.atan2(dy, dx);
        if (!solid(nx, ny)) { b.bx = nx; b.by = ny; }
        else {   // rock in the way (it moved, or a corner): slide along the free axis, or a new target
          B.hits = (B.hits || 0) + 1;
          if (!solid(nx, b.by)) b.bx = nx; else if (!solid(b.bx, ny)) b.by = ny;
          else if (b.st === 'return') toReturn(b, solid, rnd); else arrived = true;
        }
        if (b.st === 'return' && (b.t += dt) > D.batReturnT) { b.bx = b.hx; b.by = b.hy; arrived = true; }   // (never stuck: it gets there)
      }
    }
    if (arrived) {
      if (b.st === 'return') { b.st = 'hang'; b.x = b.bx = b.hx; b.y = b.by = b.hy; continue; }
      if (b.st === 'roam' && rnd() < D.batWaitChance) b.wait = kr('batWait', rnd);
      const far = b.st === 'flee' ? kr('batFleeDist', rnd) : kr('batRoamDist', rnd);
      if (!pickTarget(b, far, solid, rnd, b.st === 'flee' && n.i >= 0 ? P[n.i] : null)) pickTarget(b, far, solid, rnd, null);
    }
    // the look on top: a soft wiggle across the way it goes, and the bob in step with the wings (they beat down as it bobs up)
    b.fp = (b.fp + dt * flap) % 1;
    b.wt += dt * kru('batWiggleF', b.u) * 6.283;
    const w = Math.sin(b.wt) * kru('batWiggle', b.u), bob = Math.cos(b.fp * 6.283) * kru('batBob', b.u);
    const x = b.bx - Math.sin(b.ang) * w, y = b.by + Math.cos(b.ang) * w + bob;
    if (!solid(x, y)) { b.x = x; b.y = y; } else { b.x = b.bx; b.y = b.by; }
  }
  if (B.list.some(b => b.gone)) B.list = B.list.filter(b => !b.gone);
}

// (owner) a bat of a group hurt or killed: the whole group (its spawner's) FLEES
/** @param {Bats} B @param {BatSpawner} sp @param {() => number} rnd @param {BatSolid} solid @param {{ x: number, y: number } | null} from */
export function panicGroup(B, sp, rnd, solid, from) {
  for (const b of B.list) if (b.sp === sp && !b.gone && b.placed && b.st !== 'attack') toFlee(b, solid, rnd, from);
}

// the spawners far behind the view, and their bats, dropped
/** @param {Bats} B @param {number} x0 */
export function dropBats(B, x0) {
  const far = kru('batFleeDist', 1) + 20;
  if (!B.spawners.some(s => s.x + far < x0)) return;
  B.spawners = B.spawners.filter(s => s.x + far >= x0);
  const keep = new Set(B.spawners);
  B.list = B.list.filter(b => keep.has(b.sp));
}

// ---- drawing (world units, ctx already scaled; ox: the view's left edge) ----
const DBG = { hang: '#9a9aa8', roam: '#4cd964', flee: '#ffd23b', attack: '#ff3b3b', return: '#3b8bff' };
// wrap(x, y, half, paint): draws one bat's paint in a box half each way round (x, y) (the scene: pixelSprite, the creatures' pixel look)
/** @param {CanvasRenderingContext2D} c @param {Bats} B @param {number} ox @param {number} _t seconds @param {{ x: number, y: number }[]} [P]
 * @param {(x: number, y: number, half: number, paint: (q: CanvasRenderingContext2D) => void) => void} [wrap] */
export function drawBats(c, B, ox, _t, P, wrap) {
  const dbg = DEV.batDebug > 0.5;
  if (dbg) {   // the spawners, their roam and flee reaches, the players' scare reach
    c.lineWidth = 0.4;
    for (const s of B.spawners) {
      c.strokeStyle = 'rgba(120,255,160,0.6)'; c.beginPath(); c.arc(s.x - ox, s.y, DEV.batRoamDistHi, 0, 6.29); c.stroke();
      c.strokeStyle = 'rgba(255,210,60,0.4)'; c.beginPath(); c.arc(s.x - ox, s.y, DEV.batFleeDistHi, 0, 6.29); c.stroke();
      c.fillStyle = '#7cffa0'; c.fillRect(s.x - ox - 1, s.y, 2, 2);
    }
    c.strokeStyle = 'rgba(255,120,90,0.5)';
    for (const p of P || []) { c.beginPath(); c.arc(p.x - ox, p.y, DEV.batScareRHi, 0, 6.29); c.stroke(); }
  }
  const sz = DEV.batSize;
  for (const b of B.list) {
    const x = b.x - ox, y = b.y;
    if (x < -10 || x > 240 || b.gone || !b.placed) continue;
    const paint = (/** @type {CanvasRenderingContext2D} */ q) => { q.translate(x, y); q.scale(sz, sz); drawBat(q, b, dbg ? DBG[b.st] : null); };
    if (wrap) wrap(x, y, 6 * sz * Math.max(1, DEV.batSpan) + 2, paint); else { c.save(); paint(c); c.restore(); }
  }
}
// one bat at the origin, size 1. Hanging: folded head-down (a flutter: wings out, beating); flying: wings in step with the bob
/** @param {CanvasRenderingContext2D} c @param {Bat} b @param {string | null} dcol */
function drawBat(c, b, dcol) {
  const body = dcol || DEV.batCol, wing = dcol || DEV.batWingCol, sp = DEV.batSpan;
  const fl = Math.cos(b.fp * 6.283);   // (1: wings up, -1: down; the bob rises from fp 0 to 0.5, the downbeat)
  if (b.st === 'hang' && !(b.flut > 0)) {
    c.fillStyle = wing;
    c.beginPath(); c.moveTo(-0.9, 0); c.lineTo(0.9, 0); c.lineTo(1.1, 2.6); c.lineTo(0, 3.8); c.lineTo(-1.1, 2.6); c.closePath(); c.fill();
    c.fillStyle = body; c.fillRect(-0.9, 3.6, 0.5, 0.7); c.fillRect(0.4, 3.6, 0.5, 0.7);   // (the ears, at the bottom)
    c.fillRect(-0.15, 0, 0.3, 0.5);   // (the feet on the rock)
    return;
  }
  const hang = b.st === 'hang', s = Math.cos(b.ang) < 0 ? -1 : 1;
  if (hang) c.translate(0, 2.4);   // (fluttering: hung by the feet, wings out)
  c.fillStyle = wing; c.beginPath();
  for (const w of [-1, 1]) {
    c.moveTo(0, -0.3);
    c.lineTo(w * 2.2 * sp, -0.8 - fl * 1.6);
    c.lineTo(w * 4.2 * sp, -0.2 - fl * 2.4);
    c.lineTo(w * 3.2 * sp, 0.6 - fl * 0.8);
    c.lineTo(w * 2.0 * sp, 0.3 - fl * 0.6);
    c.lineTo(0, 0.6);
  }
  c.fill();
  c.fillStyle = body;
  c.beginPath(); c.ellipse(0, 0.2, 1, 1.3, 0, 0, 6.29); c.fill();
  const ey = hang ? 1.5 : -1.5;
  c.fillRect(s * 0.4 - 0.25, ey, 0.5, 0.6); c.fillRect(-s * 0.2 - 0.25, ey, 0.5, 0.6);   // (ears)
}

