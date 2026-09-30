// @ts-check
// The spider (Hämähäkki, act 'spider'): its brain (spiderStep, pure, state on e.sp),
// how it sits on rock and aims its lines, and its sprite (drawSpider). Its Dev knobs
// (SP_KNOBS) are in dev/knobs.js for now (REFACTOR.md, D11).

import { CELL, CH } from '../core/consts.js';
import { roamStep, surfNormal, surfSeat } from './common.js';
import { spr } from '../dev/knobs.js';
import { rayDist } from '../world/vision.js';

// ---- the spider (Hämähäkki) ----
// It lives on the rock and on its own silk and nowhere else. On rock it slides along the
// surface: the "normal" is the average direction from the rock in a small disc round it
// to its centre, which smooths the pixel steps away, so it glides round bumps and
// corners instead of snagging on single pixels. It moves in short fast bursts with rests
// between (rests long when roaming, short when it has you). At the start of each burst
// it looks at where it wants to be: if that's off the surface (dot with the normal ≥
// the Dev 'Web instead of walk above dot' knob) it rides a nearby line that heads that way, or else shoots a new line at
// the rock over there and crosses on it. Lines stay. Pure, so the logic tests can run it
// on a hand-made grid. Nearly every number is a Dev-panel range (SP_KNOBS, rolled by spr);
// SPIDER holds only the body's own geometry.
export const SPIDER = { hold: 6, feel: 14, step: 1.5, fall: 900 };

// sit the spider at `hold` off the nearest rock: pushed straight out of anything closer
// (so a spike or a step just lifts it over, like a ball rolling on it), pulled in along
// the smoothed normal if it has drifted off. false if there's no rock to sit on.
/** @param {Pt} e @param {SurfState} S @param {SolidCell} solidCell @param {number} maxMove */
export function spiderSeat(e, S, solidCell, maxMove) { return surfSeat(e, S, solidCell, maxMove, SPIDER.hold, SPIDER.feel); }

/** @type {(L: WebLine, x: number, y: number) => { u: number, d: number }} */
export const segNear = (L, x, y) => {
  const vx = L.bx - L.ax, vy = L.by - L.ay, ll = vx * vx + vy * vy || 1;
  const u = Math.max(0, Math.min(1, ((x - L.ax) * vx + (y - L.ay) * vy) / ll));
  return { u, d: Math.hypot(L.ax + vx * u - x, L.ay + vy * u - y) };
};

// a new line from (x, y) toward the rock along (dx, dy), or null if no rock within reach.
// Tries straight at it first, then fans out a little.
/** @param {number} x @param {number} y @param {number} dx @param {number} dy @param {number} reach @param {SolidCell} solidCell @returns {{ dx: number, dy: number, len: number } | null} */
export function spiderAim(x, y, dx, dy, reach, solidCell) {
  for (const a of [0, 0.22, -0.22, 0.45, -0.45]) {
    const c = Math.cos(a), s = Math.sin(a), ux = dx * c - dy * s, uy = dx * s + dy * c;
    const d = rayDist(x, y, ux, uy, reach, solidCell);
    if (d < reach && d > SPIDER.hold * 2.5) return { dx: ux, dy: uy, len: d };
  }
  return null;
}

// One frame of one spider. env: { solidCell, webs, goal: {x,y}, hunting, rnd, speed,
// reach }. Moves e, may push a line onto env.webs. Returns 'web' on the frame a shot
// line lands (for a sound), else null.
/** @param {Enemy} e @param {SpiderEnv} env @param {number} dt @returns {string | null} */
export function spiderStep(e, env, dt) {
  const { solidCell, webs, rnd } = env;
  const S = e.sp || (e.sp = { mode: 'fall', vy: 0, nx: 0, ny: -1, on: 0, rest: rnd() * 0.5,
    side: 1, line: null, u: 0, dir: 1, shot: null, rx: e.hx, ry: e.hy, ra: rnd() * 6.28, high: false });
  // the roam point drifts slowly round home, and is pulled back if it wanders too far
  S.webT = (S.webT || 0) - dt;
  roamStep(S, e, dt, rnd, 'sp');
  const goal = env.hunting ? env.goal : { x: S.rx, y: S.ry };
  let out = null;

  if (S.mode === 'fall') {
    S.vy = Math.min(S.vy + SPIDER.fall * dt, 600);
    const n = Math.max(1, Math.ceil(S.vy * dt / SPIDER.step));
    for (let i = 0; i < n; i++) {
      e.y += S.vy * dt / n;
      if (e.y > CH * CELL) { e.y = CH * CELL; break; }
      if (surfNormal(e.x, e.y, SPIDER.hold + 1, solidCell)) {
        spiderSeat(e, S, solidCell, SPIDER.hold);
        S.mode = 'surf'; S.vy = 0; S.on = 0; S.rest = 0.1;
        break;
      }
    }
    return null;
  }

  if (S.mode === 'shoot') {
    const sh = S.shot;
    sh.t += sh.spd * dt;
    if (sh.t < sh.len) return null;
    // the line lands: it only holds if the rock is still there
    const hx = sh.x + sh.dx * sh.len, hy = sh.y + sh.dy * sh.len;
    const inx = hx + sh.dx * 1.2, iny = hy + sh.dy * 1.2;
    S.mode = sh.from; S.shot = null;
    if (!solidCell(Math.floor(inx / CELL), Math.floor(iny / CELL))) return null;
    const L = { ax: sh.x, ay: sh.y, bx: hx - sh.dx * SPIDER.hold, by: hy - sh.dy * SPIDER.hold,
      a0x: sh.ax0, a0y: sh.ay0, b0x: hx, b0y: hy, ain: sh.ain, bin: { x: inx, y: iny }, owner: e };
    webs.push(L);
    // an old line of this spider's goes, unless something is riding it
    const mine = webs.filter(w => w.owner === e);
    if (mine.length > Math.round(spr('spMaxLines', rnd))) {
      const old = mine.find(w => w !== S.line);
      if (old) webs.splice(webs.indexOf(old), 1);
    }
    S.mode = 'line'; S.line = L; S.u = 0; S.dir = 1;
    return 'web';
  }

  // on a line whose rock has gone: drop
  if (S.mode === 'line' && webs.indexOf(S.line) < 0) { S.mode = 'fall'; S.line = null; S.vy = 0; return null; }
  // on rock that has been dug away from under it: drop
  if (S.mode === 'surf' && !surfNormal(e.x, e.y, SPIDER.hold + 2, solidCell)) { S.mode = 'fall'; S.vy = 0; return null; }

  // resting: count down, then start a burst and decide where it goes. Nothing worth doing
  // (already there, right under it): look again shortly — never sit with no clock running
  if (S.on <= 0) {
    if ((S.rest -= dt) > 0) return null;
    S.on = spr(env.hunting ? 'spHuntOn' : 'spRoamOn', rnd);
    // this burst's own numbers
    S.spd = env.speed || spr('spSpeed', rnd); S.arrive = env.hunting ? spr('spArrive', rnd) : 3;
    S.dot = spr('spDot', rnd);
    decide();
    if (S.mode === 'shoot') return null;
    if (S.on <= 0) { S.rest = 0.1 + rnd() * 0.2; return null; }
  }
  if (S.mode === 'shoot') return null;

  const speed = (S.spd || spr('spSpeed', rnd)) * (env.speedMul || 1);
  const dist = speed * Math.min(dt, S.on);
  S.on -= dt;
  const n = Math.max(1, Math.ceil(dist / SPIDER.step));
  for (let i = 0; i < n && S.mode !== 'shoot'; i++) {
    const st = dist / n;
    if (S.mode === 'surf') {
      const tx = -S.ny * S.side, ty = S.nx * S.side;
      e.x += tx * st; e.y += ty * st;
      if (!spiderSeat(e, S, solidCell, st * 2)) {
        // stepped off the edge of nothing: curl back round toward where the rock was
        e.x -= S.nx * st * 2; e.y -= S.ny * st * 2;
        if (!spiderSeat(e, S, solidCell, st * 2)) { S.mode = 'fall'; S.vy = 0; break; }
      }
      // came round a corner and now faces the goal off the surface: look again
      const gx = goal.x - e.x, gy = goal.y - e.y, gd = Math.hypot(gx, gy) || 1;
      const high = (gx * S.nx + gy * S.ny) / gd >= S.dot;
      if (high && !S.high) { S.high = true; decide(); }
      else if (!high) S.high = false;
      // there, or just walked past the closest it gets on this surface: stop
      if (gd < (S.arrive || 3) || (-S.ny * gx + S.nx * gy) * S.side < 0) { S.on = 0; break; }
    } else if (S.mode === 'line') {
      const L = S.line, len = Math.hypot(L.bx - L.ax, L.by - L.ay) || 1;
      const ux = (L.bx - L.ax) / len * S.dir, uy = (L.by - L.ay) / len * S.dir;
      // hanging: going further along would take it away from the goal
      if (!S.go && (goal.x - e.x) * ux + (goal.y - e.y) * uy <= 0) { S.on = 0; break; }
      S.u += S.dir * st / len;
      if (S.u >= 1 || S.u <= 0) {
        S.u = S.u >= 1 ? 1 : 0;
        e.x = S.u ? L.bx : L.ax; e.y = S.u ? L.by : L.ay;
        S.mode = 'surf'; S.line = null; S.go = false;
        if (!spiderSeat(e, S, solidCell, SPIDER.hold)) { S.mode = 'fall'; S.vy = 0; break; }
        decide();
        continue;
      }
      e.x = L.ax + (L.bx - L.ax) * S.u; e.y = L.ay + (L.by - L.ay) * S.u;
    }
  }
  if (S.on <= 0 && S.rest <= 0) S.rest = spr(env.hunting ? 'spHuntOff' : 'spRoamOff', rnd);
  return out;

  // where to go this burst: along the rock, onto a line, or shoot a new one
  function decide() {
    const gx = goal.x - e.x, gy = goal.y - e.y, gd = Math.hypot(gx, gy);
    if (gd < (S.arrive || 3)) { S.on = 0; return; }
    const dx = gx / gd, dy = gy / gd;
    const tryLine = () => {
      let best = null, bd = spr('spGrab', rnd);
      for (const L of webs) {
        if (L === S.line) continue;
        const q = segNear(L, e.x, e.y);
        if (q.d > bd) continue;
        const len = Math.hypot(L.bx - L.ax, L.by - L.ay) || 1;
        const ux = (L.bx - L.ax) / len, uy = (L.by - L.ay) / len, al = ux * dx + uy * dy;
        if (Math.abs(al) < 0.5) continue;
        if ((al > 0 && q.u > 0.97) || (al < 0 && q.u < 0.03)) continue;   // nowhere left to go on it
        best = { L, u: q.u, dir: al > 0 ? 1 : -1 }; bd = q.d;
      }
      if (!best) return false;
      S.mode = 'line'; S.line = best.L; S.u = best.u; S.dir = best.dir;
      e.x = best.L.ax + (best.L.bx - best.L.ax) * best.u; e.y = best.L.ay + (best.L.by - best.L.ay) * best.u;
      return true;
    };
    const tryShoot = from => {
      // a roaming spider spins a new line now and then, not every hop; hunting, much more often
      if (S.webT > 0 || (!env.hunting && gd < 40)) return false;
      const a = spiderAim(e.x, e.y, dx, dy, env.reach || spr('spWeb', rnd), solidCell);
      if (!a) return false;
      let ax0 = e.x, ay0 = e.y, ain = null;
      if (from === 'surf') {
        const d = rayDist(e.x, e.y, -S.nx, -S.ny, SPIDER.feel + 4, solidCell);
        ax0 = e.x - S.nx * d; ay0 = e.y - S.ny * d;
        ain = { x: e.x - S.nx * (d + 1.2), y: e.y - S.ny * (d + 1.2) };
      }
      S.webT = spr(env.hunting ? 'spHuntWeb' : 'spRoamWeb', rnd);
      S.shot = { spd: spr('spLineSpd', rnd), x: e.x, y: e.y, dx: a.dx, dy: a.dy, len: a.len, t: 0, from, ax0, ay0, ain };
      S.mode = 'shoot';
      return true;
    };
    if (S.mode === 'surf') {
      const dot = dx * S.nx + dy * S.ny;
      S.high = dot >= (S.dot || 0.6);
      if (S.high && (tryLine() || tryShoot('surf'))) return;
      const t = -S.ny * dx + S.nx * dy;
      if (Math.abs(t) * gd < 4) { S.on = 0; return; }   // right under it already
      S.side = t > 0 ? 1 : -1;
    } else if (S.mode === 'line') {
      const L = S.line, len = Math.hypot(L.bx - L.ax, L.by - L.ay) || 1;
      const al = ((L.bx - L.ax) * dx + (L.by - L.ay) * dy) / len;
      S.go = false;
      if (Math.abs(al) > 0.3) { S.dir = al > 0 ? 1 : -1; return; }
      // the goal is off to the side of this line: another line, a new one, or the nearer end
      if (tryLine() || tryShoot('line')) return;
      const da = Math.hypot(goal.x - L.ax, goal.y - L.ay), db = Math.hypot(goal.x - L.bx, goal.y - L.by);
      S.dir = db < da ? 1 : -1;
      S.go = true;
    }
  }
}

// The spider: eight legs planted on the rock (or gripping its line), body turned so its
// underside faces the surface it's on. Legs scuttle while it bursts, sit still at rest.
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r @param {number} time @param {number} phase @param {boolean} flash @param {CreatureCol} col @param {SpiderBrain} [S] */
export function drawSpider(ctx, x, y, r, time, phase, flash, col, S) {
  let nx = 0, ny = -1, side = 1, moving = false;
  if (S) {
    if (S.mode === 'line' && S.line) {
      const L = S.line, len = Math.hypot(L.bx - L.ax, L.by - L.ay) || 1;
      nx = -(L.by - L.ay) / len; ny = (L.bx - L.ax) / len;
      if (ny > 0) { nx = -nx; ny = -ny; }                  // hang under the line
      side = S.dir * ((L.bx - L.ax) >= 0 ? 1 : -1);
    } else if (S.mode === 'surf' || S.mode === 'shoot') { nx = S.nx; ny = S.ny; side = S.side; }
    moving = S.on > 0 && S.mode !== 'shoot';
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(nx, -ny));
  const t = moving ? time * 38 + phase : phase;
  ctx.strokeStyle = flash ? '#ffffff' : col.b;
  ctx.lineWidth = r * 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < 4; i++) {
    const o = (i - 1.5) * r * 0.28, sw = Math.sin(t + i * 1.7) * r * 0.22;
    for (const s of [-1, 1]) {
      const fx = s * (r * (0.75 + Math.abs(i - 1.5) * 0.35)) + sw * s;
      ctx.beginPath();
      ctx.moveTo(o * 0.5, 0);
      ctx.lineTo(o * 0.5 + fx * 0.55, -r * 0.55 - Math.abs(sw) * 0.3);   // knee, up
      ctx.lineTo(o * 0.5 + fx, r * 0.62);                               // foot, on the rock
      ctx.stroke();
    }
  }
  ctx.fillStyle = flash ? '#f4f0ff' : col.b;
  ctx.beginPath(); ctx.ellipse(-side * r * 0.45, -r * 0.05, r * 0.62, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? '#ffffff' : col.a;
  ctx.beginPath(); ctx.ellipse(-side * r * 0.45, -r * 0.12, r * 0.48, r * 0.36, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? '#f4f0ff' : col.b;
  ctx.beginPath(); ctx.ellipse(side * r * 0.3, 0, r * 0.38, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? '#ffffff' : col.eye;
  for (const [ex, ey, er] of [[0.5, -0.1, 0.1], [0.42, 0.06, 0.08], [0.58, 0.08, 0.07], [0.36, -0.14, 0.07]]) {
    ctx.beginPath(); ctx.arc(side * r * ex, r * ey, r * er, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
