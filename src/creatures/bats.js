// Bats (Coal Seams, grem chunk C4a; the owner's spec): tiny, very fast, roosting in big groups under any downward-facing rock
// (the roof, a boulder's underside) and flying as a flock (boids). Many and light, so they keep their own pure state (`Bats`),
// stepped from the level scene (art/titlescene.js batsStep) and drawn by drawBats (game/render/titledraw.js).
// A roost: a ceiling anchor and the rectangle its bats roam in. A bat: position, velocity, roost, slot, state (Roost, Fly,
// Return), timer, scared. The players are the predators: each scares bats near him. Every number is a Dev knob (group 'bats').
// World units throughout (the scene's 220 a screen).

import { DEV } from '../dev/knobs.js';

/** @typedef {{ x: number, y: number, x0: number, x1: number, y0: number, y1: number, n: number, hy: (number | undefined)[], bad?: Set<number> }} BatRoost */
/** @typedef {{ x: number, y: number, vx: number, vy: number, ro: BatRoost, slot: number, st: 'roost' | 'fly' | 'return', t: number, scared: boolean, wa: number, ph: number, bite: number, placed: boolean, gone?: boolean, panic?: number, f?: any, hpSeen?: number, rt?: number, jt?: number, fp?: number }} Bat */
/** @typedef {{ roosts: BatRoost[], list: Bat[], hits?: number }} Bats */
/** @typedef {(x: number, y: number) => boolean} BatSolid */

// the Dev panel's buttons (ui/devpanel.js): read and cleared by the next stepBats
export const BAT_CMD = { reset: false, scare: false };
const LOOK = 18;      // look this far ahead for rock
const ZONE_W = 70;    // a roost's rectangle: this far each side of the anchor…
const ZONE_H = 80;    // … and this far down from it
const RETURN_T = 4;   // homing longer than this: another free slot, or off again (never stuck trying to land)
const WHISKERS = [[0, 1], [0.5, 0.7], [-0.5, 0.7], [1.1, 0.35], [-1.1, 0.35]];   // (angle off its heading, weight)

/** @returns {Bats} */
export const newBats = () => ({ roosts: [], list: [] });

// slot i: n = ceil(i/2) × (i odd ? 1 : −1) slots from the anchor: they fill outwards, alternating sides
/** @param {number} i */
export const slotOff = i => Math.ceil(i / 2) * (i % 2 ? 1 : -1);
// where slot i hangs: (anchor x + n × slotSpacing, the rock's underside there: roost.y, or the underside nearest it)
/** @param {BatRoost} ro @param {number} i @param {BatSolid} solid @returns {{ x: number, y: number }} */
export function slotPos(ro, i, solid) {
  const x = ro.x + slotOff(i) * DEV.batSlotSpacing;
  if (ro.hy[i] === undefined) {
    let y = NaN;
    for (let k = 0; k <= 24; k++) {   // (the underside within 24 units up or down: rock over, air at it)
      const a = ro.y - k, b = ro.y + k;
      if (!solid(x, a + 0.01) && solid(x, a - 1)) { y = a; break; }
      if (!solid(x, b + 0.01) && solid(x, b - 1)) { y = b; break; }
    }
    const g = Math.floor(y / 2) * 2;
    ro.hy[i] = solid(x, g + 0.01) ? y : g;   // (on the cell edge: the terrain's 2-unit cells; NaN: no rock to hang from there)
  }
  return { x, y: ro.hy[i] ?? ro.y };
}

// a roost at (x, y), the underside of rock, its batsPerRoost bats hanging in their slots
/** @param {Bats} B @param {number} x @param {number} y @param {() => number} rnd @param {number} [bottom] the lowest a roost's rectangle goes */
export function addRoost(B, x, y, rnd, bottom = Infinity) {
  /** @type {BatRoost} */
  const ro = { x, y, x0: x - ZONE_W, x1: x + ZONE_W, y0: y, y1: Math.min(bottom, y + ZONE_H), n: Math.round(DEV.batsPerRoost), hy: [] };
  B.roosts.push(ro);
  for (let i = 0; i < ro.n; i++) B.list.push({ x, y, vx: 0, vy: 0, ro, slot: i, st: 'roost', t: 0, scared: false, wa: rnd() * 6.28, ph: rnd() * 6.28, bite: 0, placed: false });
  return ro;
}

/** @param {Bat} b @param {() => number} rnd @param {boolean} scared */
function takeOff(b, rnd, scared) {
  b.st = 'fly'; b.scared = scared;
  b.t = DEV.batFlightMin + rnd() * Math.max(0, DEV.batFlightMax - DEV.batFlightMin);
  b.vy += 30 + rnd() * 20; b.vx += (rnd() - 0.5) * 40;   // (a small downward kick)
}

// home: claim the nearest free slot of its roost (none hanging there, none homing to it; its own counts as free). again: not the
// one it has. False: none free
/** @param {Bats} B @param {Bat} b @param {BatSolid} solid @param {boolean} [again] */
function startReturn(B, b, solid, again) {
  const ro = b.ro, used = new Set();
  for (const o of B.list) if (o !== b && o.ro === ro && !o.gone && (o.st === 'roost' || o.st === 'return')) used.add(o.slot);
  let best = -1, bd = Infinity;
  if (again) (ro.bad ||= new Set()).add(b.slot);   // (a slot it couldn't reach: not tried again)
  for (let i = 0; i < ro.n; i++) {
    if (used.has(i) || ro.bad?.has(i)) continue;
    const p = slotPos(ro, i, solid);
    if (isNaN(p.y) || solid(p.x, p.y + 0.5)) continue;
    const q = Math.hypot(p.x - b.x, p.y - b.y);
    if (q < bd) { bd = q; best = i; }
  }
  // none free: a fresh slot further out along the rock (the roost grows a little)
  for (let k = 0; best < 0 && k < 12; k++) { const i = ro.n++, p = slotPos(ro, i, solid); if (!isNaN(p.y) && !solid(p.x, p.y + 0.01)) best = i; }
  if (best < 0) return false;
  b.slot = best; b.st = 'return'; b.rt = 0;
  return true;
}

// a steering force toward a heading: (unit(d) × maxSpeed − v), or nothing
/** @param {Bat} b @param {number} dx @param {number} dy @param {number[]} out */
function steer(b, dx, dy, out) {
  const m = Math.hypot(dx, dy);
  if (m < 1e-6) { out[0] = 0; out[1] = 0; return; }
  out[0] = dx / m * DEV.batMaxSpeed - b.vx; out[1] = dy / m * DEV.batMaxSpeed - b.vy;
}

// one frame of every bat. preds: the players' middles; onBite(i, dmg): a flying bat reached player i (DEV.batBite, 0 harmless)
/** @param {Bats} B @param {number} dt @param {{ x: number, y: number }[]} preds @param {BatSolid} solid @param {() => number} rnd
 * @param {(i: number, dmg: number) => void} [onBite] */
export function stepBats(B, dt, preds, solid, rnd, onBite) {
  const D = DEV, sR = D.batScareR, scareOn = D.batScare > 0.5;
  if (BAT_CMD.reset) {   // (each to a slot of its own, nearest first)
    BAT_CMD.reset = false;
    for (const b of B.list) b.st = 'fly';
    for (const b of B.list) if (b.placed && !b.gone && startReturn(B, b, solid)) { const p = slotPos(b.ro, b.slot, solid); b.x = p.x; b.y = p.y; b.vx = b.vy = 0; b.st = 'roost'; b.scared = false; b.panic = 0; }
  }
  if (BAT_CMD.scare) { BAT_CMD.scare = false; for (const b of B.list) if (b.st !== 'fly' || !b.scared) { if (b.st === 'fly') b.scared = true; else takeOff(b, rnd, true); } }
  const fly = B.list.filter(b => b.st === 'fly'), f = [0, 0];
  for (const b of B.list) {
    if (b.gone) continue;
    // (first frame) into its slot; a slot with no rock over it (a gap, a wall) passes to the next one out
    if (!b.placed) {
      let p = slotPos(b.ro, b.slot, solid);
      for (let k = 0; k < 20 && (isNaN(p.y) || solid(p.x, p.y + 0.5)); k++) p = slotPos(b.ro, b.slot = b.ro.n++, solid);
      if (isNaN(p.y) || solid(p.x, p.y + 0.5)) { b.placed = true; b.gone = true; continue; }   // (no rock to hang from near: this one never was)
      b.x = p.x; b.y = p.y; b.placed = true;
    }
    b.bite -= dt;
    // 1-2. the nearest player: inside scareR it scares; scared and past scareR × clearMult, it calms
    let d = Infinity, pi = -1;
    for (let i = 0; i < preds.length; i++) { const q = Math.hypot(preds[i].x - b.x, preds[i].y - b.y); if (q < d) { d = q; pi = i; } }
    if (scareOn && d < sR) { if (b.st === 'fly') b.scared = true; else takeOff(b, rnd, true); }
    if (b.panic > 0) { b.panic -= dt; b.scared = true; }   // (a roost hit: panicked a while, whoever is near)
    else if (b.scared && (d > sR * D.batClearMult || !scareOn)) b.scared = false;
    if (b.st === 'roost') {   // 3. off on its own now and then
      if (rnd() < D.batTakeoff * dt) takeOff(b, rnd, false);
      continue;
    }
    if (b.st === 'fly' && !b.scared && (b.t -= dt) <= 0) startReturn(B, b, solid);   // 4. the timer runs down only while calm, then home
    let ax = 0, ay = 0, lim = Infinity;
    if (b.st === 'fly') {
      // flocking with the flying bats within perception
      let n = 0, sx = 0, sy = 0, avx = 0, avy = 0, cx = 0, cy = 0, ns = 0;
      for (const o of fly) {
        if (o === b || o.st !== 'fly') continue;
        const ox = b.x - o.x, oy = b.y - o.y, q = Math.hypot(ox, oy);
        if (q > D.batPerception || q < 1e-6) continue;
        n++; avx += o.vx; avy += o.vy; cx += o.x; cy += o.y;
        if (q < D.batSepDist) { sx += ox / q / q; sy += oy / q / q; ns++; }   // (inverse-distance push)
      }
      if (ns) { steer(b, sx, sy, f); ax += f[0] * D.batSep; ay += f[1] * D.batSep; }
      if (n) {
        steer(b, avx / n, avy / n, f); ax += f[0] * D.batAli; ay += f[1] * D.batAli;
        steer(b, cx / n - b.x, cy / n - b.y, f); ax += f[0] * D.batCoh; ay += f[1] * D.batCoh;
      }
      // a random wander jitter
      b.wa += (rnd() - 0.5) * 12 * dt;
      steer(b, Math.cos(b.wa), Math.sin(b.wa), f); ax += f[0] * D.batWander; ay += f[1] * D.batWander;
      // flee the player when scared and near
      if (b.scared && pi >= 0 && d < sR * D.batClearMult) { steer(b, b.x - preds[pi].x, b.y - preds[pi].y, f); ax += f[0] * 2; ay += f[1] * 2; }
      // back inside the roost's rectangle
      const R = b.ro, zx = Math.max(R.x0, Math.min(R.x1, b.x)), zy = Math.max(R.y0 + 4, Math.min(R.y1, b.y));
      if (zx !== b.x || zy !== b.y) { steer(b, zx - b.x, zy - b.y, f); ax += f[0] * D.batZonePull; ay += f[1] * D.batZonePull; }
    } else {
      // 5. home to its claimed slot: arrive (speed = min(maxSpeed, distance × 2.5)); within 3 snap; too long at it, another slot or off again
      const goal = slotPos(b.ro, b.slot, solid), gx = goal.x - b.x, gy = goal.y - b.y, q = Math.hypot(gx, gy);
      if (isNaN(q) || (b.rt = (b.rt || 0) + dt) > RETURN_T) { b.rt = 0; if (!startReturn(B, b, solid, true)) takeOff(b, rnd, false); continue; }
      if (q < 3) { b.x = goal.x; b.y = goal.y; b.vx = b.vy = 0; b.st = 'roost'; continue; }
      lim = q - 2;   // (its slot is on the rock: rock no nearer than the slot counts)
      const sp = Math.min(D.batMaxSpeed, q * 2.5);
      ax += (gx / q * sp - b.vx) * 8; ay += (gy / q * sp - b.vy) * 8;
    }
    // rock ahead (looking further the faster it goes, and to both sides): steer away early and hard, and brake
    const sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp, look = Math.min(lim, LOOK + sp * D.batLookAhead);
    let wx = 0, wy = 0, near = 0;
    for (const [a, w] of WHISKERS) {
      const c = Math.cos(a), s2 = Math.sin(a), dx = ux * c - uy * s2, dy = ux * s2 + uy * c;
      for (const k of [0.35, 0.7, 1]) if (solid(b.x + dx * look * k, b.y + dy * look * k)) { wx -= dx * w / k; wy -= dy * w / k; near = Math.max(near, 1.4 - k); break; }
    }
    if (look > 0 && (wx || wy)) {
      if (b.st === 'fly') { steer(b, wx, wy, f); ax += f[0] * D.batWallAvoid * (1 + near); ay += f[1] * D.batWallAvoid * (1 + near); }
      else { ax += wx * D.batMaxSpeed * 2; ay += wy * D.batMaxSpeed * 2; }   // (homing: round the rock in its way)
      const k = Math.exp(-near * 6 * dt); b.vx *= k; b.vy *= k;
    }
    const mf = D.batMaxForce * (b.st === 'fly' ? 1 : 2), am = Math.hypot(ax, ay); if (am > mf) { ax *= mf / am; ay *= mf / am; }
    b.vx += ax * dt; b.vy += ay * dt;
    if (b.st === 'fly') {
      // twitchy: drag (little momentum), sudden jinks now and then, and the wingbeat: a lift each beat, gravity between (the bob)
      const dr = Math.exp(-D.batDrag * dt); b.vx *= dr; b.vy *= dr;
      if ((b.jt = (b.jt ?? rnd()) - dt) <= 0) { b.jt = (0.4 + rnd() * 1.2) / Math.max(0.01, D.batJinkRate); const a = rnd() * 6.283; b.vx += Math.cos(a) * D.batJinkStr; b.vy += Math.sin(a) * D.batJinkStr; }
      b.vy += D.batGravity * dt;
      b.fp = (b.fp ?? rnd()) + dt * D.batFlapRate;
      if (b.fp >= 1) { b.fp -= Math.floor(b.fp); b.vy -= D.batFlapLift; }
    }
    const v = Math.hypot(b.vx, b.vy), cap = D.batMaxSpeed * (b.st === 'fly' ? 1.25 : 1); if (v > cap) { b.vx *= cap / v; b.vy *= cap / v; }
    // the move, in steps under a cell: on rock, slide along the free axis, or bounce
    const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 1));
    let hit = false;
    for (let s = 0; s < steps; s++) {
      const nx = b.x + b.vx * dt / steps, ny = b.y + b.vy * dt / steps;
      if (!solid(nx, ny)) { b.x = nx; b.y = ny; continue; }
      hit = true;
      if (!solid(nx, b.y)) { b.x = nx; b.vy *= -0.5; }
      else if (!solid(b.x, ny)) { b.y = ny; b.vx *= -0.5; }
      else { b.vx = -b.vx * 0.5; b.vy = -b.vy * 0.5; break; }
    }
    if (hit) B.hits = (B.hits || 0) + 1;   // (wall contacts, a frame each: the tests count them)
    // a bite (harmless by default: DEV.batBite 0)
    if (onBite && D.batBite > 0 && pi >= 0 && d < 5 && b.bite <= 0) { b.bite = 1; onBite(pi, D.batBite); }
  }
  if (B.list.some(b => b.gone)) B.list = B.list.filter(b => !b.gone);
}

// (owner) a bat of the roost hurt or killed: the whole roost panics into scared flight for DEV.batPanic seconds
/** @param {Bats} B @param {BatRoost} ro @param {() => number} rnd */
export function panicRoost(B, ro, rnd) {
  for (const b of B.list) if (b.ro === ro && !b.gone) { if (b.st !== 'fly') takeOff(b, rnd, true); b.scared = true; b.panic = DEV.batPanic; }
}

// the roosts far behind the view, and their bats, dropped
/** @param {Bats} B @param {number} x0 */
export function dropBats(B, x0) {
  if (!B.roosts.some(r => r.x1 < x0)) return;
  B.roosts = B.roosts.filter(r => r.x1 >= x0);
  const keep = new Set(B.roosts);
  B.list = B.list.filter(b => keep.has(b.ro));
}

// ---- drawing (world units, ctx already scaled; ox: the view's left edge) ----
const BODY = '#4a3a4c', EDGE = '#6e5a70';   // (a dusky brown-purple: dark, but seen against the cave's black air)
// wrap(x, y, half, paint): draws one bat's paint in a box half each way round (x, y) (the scene: pixelSprite, the creatures' pixel look)
/** @param {CanvasRenderingContext2D} c @param {Bats} B @param {number} ox @param {number} t seconds @param {{ x: number, y: number }[]} [preds]
 * @param {(x: number, y: number, half: number, paint: (q: CanvasRenderingContext2D) => void) => void} [wrap] */
export function drawBats(c, B, ox, t, preds, wrap) {
  const dbg = DEV.batDebug > 0.5;
  if (dbg) {
    c.lineWidth = 0.4; c.strokeStyle = 'rgba(120,255,160,0.7)';
    for (const r of B.roosts) { c.strokeRect(r.x0 - ox, r.y0, r.x1 - r.x0, r.y1 - r.y0); c.beginPath(); c.arc(r.x - ox, r.y, 1.5, 0, 6.29); c.stroke(); }
    c.strokeStyle = 'rgba(255,220,90,0.6)';
    for (const p of preds || []) { c.beginPath(); c.arc(p.x - ox, p.y, DEV.batScareR, 0, 6.29); c.stroke(); c.beginPath(); c.arc(p.x - ox, p.y, DEV.batScareR * DEV.batClearMult, 0, 6.29); c.stroke(); }
  }
  for (const b of B.list) {
    const x = b.x - ox, y = b.y;
    if (x < -10 || x > 240 || b.gone) continue;
    const paint = (/** @type {CanvasRenderingContext2D} */ q) => { q.translate(x, y); q.scale(DEV.batSize, DEV.batSize); drawBat(q, b, t, dbg); };
    if (wrap) wrap(x, y, 6 * DEV.batSize + 2, paint); else { c.save(); paint(c); c.restore(); }
  }
}
// one bat, at the origin, size 1 (drawBats places and sizes it: DEV.batSize)
/** @param {CanvasRenderingContext2D} c @param {Bat} b @param {number} t @param {boolean} dbg */
function drawBat(c, b, t, dbg) {
  c.fillStyle = dbg && b.scared ? '#ff3b3b' : dbg && b.st === 'return' ? '#3b8bff' : BODY;
  if (b.st === 'roost') {   // folded, hanging head-down under the rock
    c.beginPath(); c.moveTo(-0.9, 0); c.lineTo(0.9, 0); c.lineTo(1.1, 2.6); c.lineTo(0, 3.8); c.lineTo(-1.1, 2.6); c.closePath(); c.fill();
    c.fillRect(-0.9, 3.6, 0.5, 0.7); c.fillRect(0.4, 3.6, 0.5, 0.7);   // (the ears, at the bottom)
    c.fillStyle = EDGE; c.fillRect(-0.15, 0, 0.3, 0.5);   // (the feet on the rock)
    return;
  }
  // in flight: wings flapping fast
  const fl = -Math.sin((b.fp ?? 0) * 6.283), s = b.vx < 0 ? -1 : 1;   // (in step with the wingbeat: the downstroke round each lift)
  c.beginPath();
  for (const w of [-1, 1]) {
    c.moveTo(0, -0.3);
    c.lineTo(w * 2.2, -0.8 - fl * 1.6);
    c.lineTo(w * 4.2, -0.2 - fl * 2.4);
    c.lineTo(w * 3.2, 0.6 - fl * 0.8);
    c.lineTo(w * 2.0, 0.3 - fl * 0.6);
    c.lineTo(0, 0.6);
  }
  c.fill();
  c.beginPath(); c.ellipse(0, 0.2, 1, 1.3, 0, 0, 6.29); c.fill();
  c.fillRect(s * 0.4 - 0.25, -1.5, 0.5, 0.6); c.fillRect(-s * 0.2 - 0.25, -1.5, 0.5, 0.6);   // (ears)
}

// ---- the Dev preview's cave (ui/batpreview.js; the owner: "a cave of bats with a player walking past periodically") ----
// A small room WU across with a bumpy roof, a boulder hanging off it, and a floor; two roosts under the roof; a player walking
// across and back every few seconds. Rebuilt when a knob that shapes the roosts changes; every other knob is read live.
export const BAT_LAB_W = 180, BAT_LAB_H = 100;
/** @typedef {{ B: Bats, solid: BatSolid, roof: (x: number) => number, floor: number, px: number, dir: number, wait: number, key: string, t: number }} BatLab */
/** @returns {BatLab} */
export function batLab() {
  const roof = (/** @type {number} */ x) => 12 + 5 * Math.sin(x * 0.07) + 3 * Math.sin(x * 0.19 + 1);
  const floor = BAT_LAB_H - 10;
  const boulder = (/** @type {number} */ x, /** @type {number} */ y) => Math.hypot((x - 132) / 16, (y - roof(132) - 8) / 10) < 1;
  /** @type {BatSolid} */
  const solid = (x, y) => x < 0 || x >= BAT_LAB_W || y < roof(x) || y >= floor || boulder(x, y);
  /** @type {BatLab} */
  const L = { B: newBats(), solid, roof, floor, px: -20, dir: 1, wait: 2, key: '', t: 0 };
  return L;
}
/** @param {BatLab} L @param {number} dt @param {() => number} [rnd] */
export function batLabStep(L, dt, rnd = Math.random) {
  L.t += dt;
  const key = DEV.batsPerRoost + ',' + DEV.batSlotSpacing;
  if (key !== L.key) {   // (the roosts' own knobs changed: hung afresh)
    L.key = key; L.B = newBats();
    for (const x of [50, 132]) { let y = Math.floor(L.roof(x)); while (L.solid(x, y + 0.5) && y < L.floor) y++; addRoost(L.B, x, y, rnd, L.floor - 6); }
  }
  // the player: waits off one side, walks across, waits off the other, walks back
  if (L.wait > 0) L.wait -= dt;
  else { L.px += L.dir * 32 * dt; if (L.px > BAT_LAB_W + 20 || L.px < -20) { L.dir = -L.dir; L.wait = 1.5; } }
  stepBats(L.B, dt, [{ x: L.px, y: L.floor - 6 }], L.solid, rnd);
}
