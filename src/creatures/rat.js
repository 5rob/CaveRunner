// @ts-check
// The rat (Rotta, act 'rat') and its nest: its brain (ratStep, pure, state on e.ra:
// surface crawl, jumps, path mode, tunnels), footing and spreading out, and the sprites
// (drawRat, drawNest). Its Dev knobs (RA_KNOBS) are in dev/knobs.js for now (D11).

import { CELL, CH, COL } from '../core/consts.js';
import { surfNormal, surfSeat } from './common.js';
import { kr } from '../dev/knobs.js';

// ---- the rat (Rotta) and its nest (Rotanpesä) ----
// A rat runs the rock surfaces the way the spider does (surfSeat keeps it sat on the rock,
// sliding round bumps), in short bursts with rests between, but it has no silk: when where it
// wants to be is up off the surface and near enough, it jumps there, and it drops off
// anything it finds itself hanging under. Its nest is a room in the rock at the end of a
// tunnel too thin for you (path, room first, mouth last); in there it just follows the path.
// What it wants (you, loose gold, home, or its roam spot) is the Game's call: env.goal.
// env.home: wants to go in, so reaching the mouth takes it down the tunnel. Returns 'home'
// the moment it reaches the nest room, 'out' as it comes out of the hole, 'jump' on a jump.
// Pure; the numbers are Dev ranges (RA_KNOBS).
export const RAT = { hold: 3.5, feel: 9, step: 1, fall: 900, ceil: 0.55, tunnel: 0.6 };
// v95: can a rat stand here? Rock under it or beside it (the nearest rock not overhead —
// that's a ceiling, and it drops off those), or a web line under its feet.
// (The reach is generous: a rat running a path rides a little off bumpy rock, and a dip in
// the floor isn't a cliff. Open air means nothing within a rat-and-a-half.)
/** @param {number} x @param {number} y @param {SolidCell} solidCell @param {((x: number, y: number) => unknown) | null} [onWeb] @returns {boolean} */
export function ratFooting(x, y, solidCell, onWeb) {
  const n = surfNormal(x, y, RAT.hold + 5, solidCell);
  return (n && n.py <= RAT.ceil) || !!(onWeb && onWeb(x, y));
}
// a hop that lands on `goal`: time of flight from how far, the lift to make up the drop.
// Higher and higher arcs until one clears the rock (round the edge of a slab, not into it).
// Sets the rat flying and returns 'jump', or null if no arc gets there.
/** @param {Enemy} e @param {RatBrain} S @param {Pt} goal @param {RatEnv} env @param {Rnd} rnd @returns {string | null} */
export function ratJump(e, S, goal, env, rnd) {
  const solidCell = env.solidCell, gx = goal.x - e.x, gy = goal.y - e.y, gd = Math.hypot(gx, gy);
  const v = kr('raJump', rnd), cap = v * 1.4, x0 = e.x + S.nx * 1.5, y0 = e.y + S.ny * 1.5;
  for (const T of [Math.max(0.18, Math.min(0.6, gd / v)), 0.4, 0.55, 0.7]) {
    let vx = gx / T, vy = gy / T - 0.5 * RAT.fall * T;
    const sp = Math.hypot(vx, vy);
    if (sp > cap) { vx *= cap / sp; vy *= cap / sp; }
    let ok = true;
    for (let k = 1; k <= 16 && ok; k++) {
      const t = T * k / 16, px = x0 + vx * t, py = y0 + vy * t + 0.5 * RAT.fall * t * t;
      if (Math.hypot(px - goal.x, py - goal.y) < RAT.hold + 3) break;
      for (const [ox, oy] of [[0, 0], [2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]])
        if (solidCell(Math.floor((px + ox) / CELL), Math.floor((py + oy) / CELL))) { ok = false; break; }
    }
    if (!ok) continue;
    S.vx = vx; S.vy = vy; e.x = x0; e.y = y0;
    S.mode = 'air'; S.on = 0; S.rest = 0.05;
    if (Math.abs(S.vx) > 1) S.face = S.vx > 0 ? 1 : -1;
    return 'jump';
  }
  return null;
}
// v95: roaming rats spread out. A push away from every other loose rat nearer than `D`,
// harder the closer it is (0 at D, 1 on top of it, summed). Pure; the Game adds it to the
// rat's roam spot, so the pack fans out round the nest instead of moving as one lump.
/** @param {Enemy} e @param {Enemy[]} others @param {number} D @returns {Pt} */
export function ratSpread(e, others, D) {
  let x = 0, y = 0;
  for (const o of others) {
    if (o === e) continue;
    const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy);
    if (d >= D) continue;
    const f = 1 - d / D;
    if (d > 0.01) { x += dx / d * f; y += dy / d * f; }
    else { const a = e.phase != null ? e.phase : 1; x += Math.cos(a) * f; y += Math.sin(a) * f; }
  }
  return { x, y };
}
// the point `d` along a path of points, and which way it's heading there
/** @param {Pt[]} P @param {number} d @returns {{ x: number, y: number, dx: number, dy: number }} */
export function pathAt(P, d) {
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], l = Math.hypot(b.x - a.x, b.y - a.y);
    if (d <= l || i === P.length - 1) {
      const u = l ? Math.max(0, Math.min(1, d / l)) : 0;
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, dx: (b.x - a.x) / (l || 1), dy: (b.y - a.y) / (l || 1) };
    }
    d -= l;
  }
  return { x: P[0].x, y: P[0].y, dx: 0, dy: -1 };
}
/** @type {(P: Pt[]) => number} */
export const pathLen = P => { let l = 0; for (let i = 1; i < P.length; i++) l += Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y); return l; };

/** @param {Enemy} e @param {RatEnv} env @param {number} dt @returns {string | null} */
export function ratStep(e, env, dt) {
  const { solidCell, rnd } = env;
  const S = e.ra || (e.ra = { mode: 'air', vx: 0, vy: 0, nx: 0, ny: -1, on: 0, rest: rnd() * 0.3, side: 1, face: 1, s: 0, dir: 1, wait: 0 });
  const goal = env.goal;
  const P = env.path, speed = (env.speed || kr('raSpeed', rnd)) * (env.speedMul || 1);

  if (S.noT > 0) S.noT -= dt;
  if (S.mode === 'tunnel') {
    if (!P) { S.mode = 'air'; S.vx = S.vy = 0; return null; }
    if (S.wait > 0) { S.wait -= dt; return null; }
    const L = S.len || (S.len = pathLen(P));
    S.s += S.dir * speed * RAT.tunnel * dt;
    if (S.s <= 0) {                       // down in the nest
      S.s = 0; S.dir = 1; S.wait = kr('raNestRest', rnd);
      e.x = P[0].x; e.y = P[0].y;
      return 'home';
    }
    if (S.s >= L) {                       // out of the hole
      const m = P[P.length - 1];
      e.x = m.x; e.y = m.y;
      S.mode = 'surf'; S.on = 0; S.rest = 0.05 + rnd() * 0.2;
      if (!surfSeat(e, S, solidCell, RAT.hold, RAT.hold, RAT.feel)) { S.mode = 'air'; S.vx = S.vy = 0; }
      return 'out';
    }
    const q = pathAt(P, S.s);
    e.x = q.x; e.y = q.y; S.face = q.dx * S.dir >= 0 ? 1 : -1;
    S.nx = 0; S.ny = -1;
    return null;
  }

  // at the hole, wanting in: down the tunnel (landing on it counts too)
  if (env.home && P) {
    const m = P[P.length - 1];
    if (Math.hypot(m.x - e.x, m.y - e.y) < 12) { S.mode = 'tunnel'; S.len = pathLen(P); S.s = S.len; S.dir = -1; S.wait = 0; S.vx = S.vy = 0; return null; }
  }

  // with a way found (env.follow: goal is a waypoint off navField), it just runs the way,
  // pushed out of the rock and settled onto floors as it goes, so it can't wedge or fall
  // off anything: the path already knows what a rat can climb
  if (env.follow && goal && S.mode !== 'air') {             // (mid-jump or falling: physics first)
    if (S.mode !== 'path') { S.mode = 'path'; S.vx = S.vy = 0; }
    const gx = goal.x - e.x, gy = goal.y - e.y, gd = Math.hypot(gx, gy), go = Math.min(gd, speed * dt);
    const rock = (x, y) => solidCell(Math.floor(x / CELL), Math.floor(y / CELL));
    // v95: no walking on thin air. It needs rock under or beside it (not just overhead) or a
    // web line to stand on; the way across or up through open air is a jump, and off an edge
    // it falls. (Before, a path through air was run like floor, so rats floated.)
    if (!ratFooting(e.x, e.y, solidCell, env.onWeb)) { S.mode = 'air'; S.vx = gd ? gx / gd * speed * 0.4 : 0; S.vy = 0; return null; }
    if (env.air && gd > RAT.hold + 2) {                  // only when the next step really has nothing under it
      const f = Math.min(gd, 6) / gd;
      if (!ratFooting(e.x + gx * f, e.y + gy * f, solidCell, env.onWeb)) { const j = ratJump(e, S, goal, env, rnd); if (j) return j; }
    }
    if (gd > 0.01) {                       // never a step into the rock (small steps, so not over a thin wall either)
      const k = Math.max(1, Math.ceil(go / 0.8)), mx = gx / gd * go / k, my = gy / gd * go / k;
      let moved = false;
      for (let q = 0; q < k; q++) {
        if (!rock(e.x + mx, e.y + my)) { e.x += mx; e.y += my; moved = true; }
        else if (!rock(e.x + mx, e.y)) { e.x += mx; moved = true; }
        else if (!rock(e.x, e.y + my)) { e.y += my; moved = true; }
        else break;
        // walked off the edge of its footing: it falls from here, carried on by its run
        if (!ratFooting(e.x, e.y, solidCell, env.onWeb)) { S.mode = 'air'; S.vx = gx / gd * speed * 0.6; S.vy = 0; return null; }
      }
      if (Math.abs(gx) > 0.5) S.face = gx > 0 ? 1 : -1;
      // boxed in on that line: a little hop to come at it again
      S.blockT = moved ? 0 : (S.blockT || 0) + dt;
      if (S.blockT > 0.3) { S.blockT = 0; S.mode = 'air'; S.vx = (rnd() - 0.5) * 120; S.vy = -160; return null; }
    }
    const n = surfNormal(e.x, e.y, RAT.feel, solidCell);
    if (n) {
      if (n.d < RAT.hold && n.d > 0.01 && !rock(e.x + n.px * (RAT.hold - n.d), e.y + n.py * (RAT.hold - n.d))) {
        e.x += n.px * (RAT.hold - n.d); e.y += n.py * (RAT.hold - n.d);
      } else if (n.d >= RAT.hold && n.py < -0.5 && n.d < RAT.hold + 7 && gy > -2) {   // not climbing: down onto the floor
        const m = Math.min(n.d - RAT.hold, 80 * dt); e.x -= n.px * m; e.y -= n.py * m;
      }
      S.nx = n.x; S.ny = n.y; S.py = n.py;
    } else { S.nx = 0; S.ny = -1; S.py = -1; }
    return null;
  }
  if (S.mode === 'path') { S.mode = 'air'; S.vx = S.vy = 0; }   // lost the way: plain physics again

  if (S.mode === 'air') {
    S.vy = Math.min(S.vy + RAT.fall * dt, 600);
    const n = Math.max(1, Math.ceil(Math.hypot(S.vx, S.vy) * dt / RAT.step));
    for (let i = 0; i < n; i++) {
      e.x += S.vx * dt / n; e.y += S.vy * dt / n;
      if (e.y > CH * CELL) { e.y = CH * CELL; break; }
      // falling onto a web line with somewhere to be: it catches hold and runs on along it
      if (S.vy > 0 && env.follow && env.onWeb && env.onWeb(e.x, e.y)) { S.mode = 'path'; S.vx = S.vy = 0; return 'land'; }
      const s = surfNormal(e.x, e.y, RAT.hold + 0.5, solidCell);
      if (!s) continue;
      if (s.py > RAT.ceil) {              // bumped its head (the nearest rock is above): out, and on down
        e.x += s.px * (RAT.hold + 0.5 - s.d); e.y += s.py * (RAT.hold + 0.5 - s.d);
        S.vy = Math.max(S.vy, 0); S.vx *= 0.5;
        continue;
      }
      surfSeat(e, S, solidCell, RAT.hold, RAT.hold, RAT.feel);
      S.mode = 'surf'; S.vx = S.vy = 0; S.on = 0; S.rest = Math.min(S.rest, 0.05);
      return 'land';
    }
    return null;
  }

  // on rock that has been dug out from under it, or hanging off a ceiling: drop
  // (a ceiling is where the nearest rock is overhead: the averaged normal misreads a crack)
  if (!surfNormal(e.x, e.y, RAT.hold + 2, solidCell) || S.py > RAT.ceil) { S.mode = 'air'; S.vx = S.vy = 0; return null; }

  // Roaming it scurries in bursts with rests between; with a job on (you, gold, home) it
  // runs flat out and only stops to pick a new way (raHuntOff is 0 by default)
  if (S.on <= 0) {
    if ((S.rest -= dt) > 0) return null;
    S.on = kr(env.hunting ? 'raHuntOn' : 'raRoamOn', rnd);
    S.spd = speed; S.arrive = env.arrive != null ? env.arrive : 3;
    S.dot = kr('raDot', rnd);
    const j = decide();
    if (j) return j;
    if (S.on <= 0) { S.rest = env.hunting ? 0.03 : 0.1 + rnd() * 0.2; return null; }
  }
  const dist = S.spd * Math.min(dt, S.on);
  S.on -= dt;
  const n = Math.max(1, Math.ceil(dist / RAT.step));
  for (let i = 0; i < n; i++) {
    const st = dist / n, tx = -S.ny * S.side, ty = S.nx * S.side;
    e.x += tx * st; e.y += ty * st;
    if (!surfSeat(e, S, solidCell, st * 2, RAT.hold, RAT.feel)) {
      e.x -= S.nx * st * 2; e.y -= S.ny * st * 2;
      if (!surfSeat(e, S, solidCell, st * 2, RAT.hold, RAT.feel)) { S.mode = 'air'; S.vx = tx * S.spd * 0.5; S.vy = 0; break; }
    }
    // walked up under an overhang: it drops, and won't try that way again for a bit
    if (S.py > RAT.ceil) { S.mode = 'air'; S.vx = tx * S.spd * 0.3; S.vy = 0; S.noSide = S.side; S.noT = 1.5; break; }
    if (Math.abs(tx) > 0.2) S.face = tx > 0 ? 1 : -1;
    if (!goal) continue;
    const gx = goal.x - e.x, gy = goal.y - e.y, gd = Math.hypot(gx, gy) || 1;
    if (gd < S.arrive || (-S.ny * gx + S.nx * gy) * S.side < 0) { S.on = 0; break; }
    // came round onto a surface where it's now up off the rock: look again (maybe jump)
    const high = (gx * S.nx + gy * S.ny) / gd >= S.dot;
    if (high && !S.high) { S.high = true; const j = decide(); if (j) return j; if (S.on <= 0) break; }
    else if (!high) S.high = false;
  }
  if (S.on <= 0 && S.rest <= 0) S.rest = kr(env.hunting ? 'raHuntOff' : 'raRoamOff', rnd);
  return null;

  // this burst: run along the rock toward the goal, or jump at it if it's up off the rock
  function decide() {
    if (!goal) { S.on = 0; return null; }
    const gx = goal.x - e.x, gy = goal.y - e.y, gd = Math.hypot(gx, gy);
    if (gd < S.arrive) { S.on = 0; return null; }
    const dx = gx / gd, dy = gy / gd, t = -S.ny * dx + S.nx * dy;
    // the way it wants to run is the way it just fell off an overhang: jump for it if it can, else turn back
    const barred = S.noT > 0 && (t > 0 ? 1 : -1) === S.noSide;
    if ((barred || (env.jump !== false && dx * S.nx + dy * S.ny >= S.dot)) && gd < kr('raJumpR', rnd)) {
      const j = ratJump(e, S, goal, env, rnd);
      if (j) return j;
    }
    if (barred) { S.side = -S.noSide; return null; }
    if (Math.abs(t) * gd < 2) { S.on = 0; return null; }
    S.side = t > 0 ? 1 : -1;
    return null;
  }
}

// a rat: a low grey-brown body along the rock (its "up" is the rock's normal), pointed snout,
// round ear, long pink tail, legs scurrying while it runs; a coin in its mouth if it has one
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r @param {number} time @param {number} phase @param {boolean} flash @param {CreatureCol} col @param {RatBrain} [S] @param {number} [carry] */
export function drawRat(ctx, x, y, r, time, phase, flash, col, S, carry) {
  const air = !S || S.mode === 'air', nx = air ? 0 : S.nx, ny = air ? -1 : S.ny, f = S ? S.face : 1;
  const moving = S && (S.on > 0 || S.mode === 'air' || S.mode === 'path' || (S.mode === 'tunnel' && !(S.wait > 0)));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(nx, -ny));                  // local up = the surface normal
  ctx.scale(f, 1);
  const run = moving ? Math.sin(time * 38 + phase) : 0, bob = moving ? Math.abs(run) * 0.4 : 0;
  ctx.translate(0, r * 0.35 - bob);
  // tail
  ctx.strokeStyle = flash ? '#fff' : '#d9a0a0'; ctx.lineWidth = 0.7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-r * 1.1, 0);
  ctx.quadraticCurveTo(-r * 2.1, -r * (0.2 + 0.4 * Math.sin(time * 6 + phase)), -r * 2.9, r * 0.3 * Math.sin(time * 4 + phase));
  ctx.stroke();
  // legs
  ctx.strokeStyle = flash ? '#fff' : col.b; ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, r * 0.2); ctx.lineTo(-r * 0.6 - run * r * 0.4, r * 0.6 + bob);
  ctx.moveTo(r * 0.5, r * 0.2); ctx.lineTo(r * 0.5 + run * r * 0.4, r * 0.6 + bob);
  ctx.stroke();
  // body and head
  ctx.fillStyle = flash ? '#fff' : col.a;
  ctx.beginPath(); ctx.ellipse(-r * 0.15, -r * 0.2, r * 1.15, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(r * 0.6, -r * 0.65); ctx.quadraticCurveTo(r * 1.5, -r * 0.5, r * 1.75, -r * 0.05);
  ctx.lineTo(r * 0.55, r * 0.25); ctx.closePath(); ctx.fill();
  ctx.fillStyle = flash ? '#fff' : col.c;
  ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.5, r * 0.7, r * 0.2, -0.1, 0, Math.PI * 2); ctx.fill();
  // ear, eye, nose
  ctx.fillStyle = flash ? '#fff' : '#c98f8f';
  ctx.beginPath(); ctx.arc(r * 0.55, -r * 0.8, r * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col.eye; ctx.fillRect(r * 1.0, -r * 0.5, r * 0.25, r * 0.25);
  ctx.fillStyle = '#e88a9a'; ctx.fillRect(r * 1.62, -r * 0.18, r * 0.25, r * 0.22);
  if (carry > 0) {
    // the coin in its teeth: the same size and look as gold on the ground, kept upright
    ctx.translate(r * 2.1, r * 0.1);
    ctx.scale(f, 1); ctx.rotate(-Math.atan2(nx, -ny));
    ctx.fillStyle = '#d8a52a';
    ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COL.flame2;
    ctx.beginPath(); ctx.ellipse(-0.8, -0.8, 1.2, 1.8, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
// a rat nest: a bowl of straw and twigs in its little room, with the gold the rats brought
// home glinting in it
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r @param {number} time @param {boolean} flash @param {CreatureCol} col @param {NestState} [N] */
export function drawNest(ctx, x, y, r, time, flash, col, N) {
  ctx.save();
  ctx.translate(x, y + r * 0.35);
  ctx.fillStyle = flash ? '#fff' : col.b;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  const coins = N ? Math.min(12, Math.ceil(N.stash / 5)) : 0;
  for (let k = 0; k < coins; k++) {
    const a = k * 2.4, d = (k % 4) * r * 0.16;
    ctx.fillStyle = (Math.sin(time * 3 + k) > 0.8) ? '#fff2a0' : '#ffd23c';
    ctx.beginPath(); ctx.arc(Math.cos(a) * d * 1.6, -r * 0.2 + Math.sin(a) * d * 0.5, r * 0.16, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = flash ? '#fff' : col.c; ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2, b = a + 0.9 + (k % 3) * 0.3;
    ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r * 0.45 - r * 0.05);
    ctx.lineTo(Math.cos(b) * r * 0.8, Math.sin(b) * r * 0.4 + r * 0.05);
  }
  ctx.stroke();
  ctx.strokeStyle = flash ? '#fff' : col.a; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.ellipse(0, -r * 0.1, r * 0.95, r * 0.35, 0, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke();
  ctx.fillStyle = '#e8e0cc';                        // a bone or two
  ctx.fillRect(-r * 0.9, -r * 0.3, r * 0.6, r * 0.12); ctx.fillRect(r * 0.4, -r * 0.45, r * 0.12, r * 0.5);
  ctx.restore();
}
