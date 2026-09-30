// @ts-check
// The jellyfish (Myrkkymeduusa, act 'jelly'): its brain (jellyStep, pure, state on e.je),
// its bell shape and tentacle stings, its palette (jellyPal) and sprite (drawJelly), and the
// plant-glow comp it throws on green vegetation (plantGlowFill, plantWhite, twinkle). Its
// Dev knobs and colours (JE_KNOBS, JE_COLS) are in dev/knobs.js for now (D11).

import { angDiff } from '../core/util.js';
import { flyMove, roamStep, turnToward } from './common.js';
import { JE_COLS, jcol, kr, kru } from '../dev/knobs.js';

// one jelly's palette at its colour fraction u
/** @param {number} u @returns {Record<string, string>} */
export function jellyPal(u) {
  const P = {};
  for (const [k, , , , f] of JE_COLS) P[f] = jcol(k, u);
  return P;
}

// ---- the jellyfish (Myrkkymeduusa) ----
// Swims the way a jelly does. Its head (the top of the bell) is its heading, and the
// heading turns no faster than the turn-rate knob. Now and then it pulses: a short, hard
// push along wherever the head points — but only once the head is near enough on where
// it's going, so a big turn is made first, drifting. Then it coasts, water drag bleeding
// the speed away and a little sinking, until the next pulse. Roaming it heads for a roam
// spot round home (roamStep); with aggro it heads for you until it's in spitting range,
// then hangs there turning its head onto you. The spitting is the Game's job: jellyStep
// reports S.inRange and S.aimed. S.shape is the bell, 1 thin (just pushed, fast) to 0 flat
// (slowed, stopped), weighted to the thin side so it only flattens right near the stop.
// The tentacles are a few points each, dragged behind the rim follow-the-leader style.
// Pure, so the logic suite runs it on a hand-made grid; the numbers are Dev ranges (JE_KNOBS).
export const JELLY = { hitR: 0.8 };            // collision radius, × body r

// the bell at shape s (0 flat .. 1 thin) and squash q (how much the shape changes), body r.
// top is the head end, rim the open end, in the jelly's own frame (head up). Shared by the
// tentacle roots (jellyStep) and the sprite (drawJelly), so the two always agree.
/** @param {number} r @param {number} s @param {number} q @returns {{ w: number, h: number, rw: number, top: number, rim: number }} */
export function jellyBell(r, s, q) {
  const t = Math.max(0, Math.min(1.5, s * q));
  const w = r * (1.15 - 0.36 * t), h = r * (0.95 + 0.6 * t);
  return { w, h, rw: w * (0.96 - 0.24 * t), top: -h * 0.62, rim: h * 0.38 };
}

// One frame of one jelly. env: { solidCell, goal: {x,y}, hunting, rnd, speedMul, rangeMul,
// stay }. stay(x, y), if given, is where it may swim (the natural zones): its roam spot keeps
// inside, and from inside it never pulses toward a spot its glide would carry it out of —
// hunting you into a built-up corridor, it hangs at the edge and spits from there.
// Returns 'pulse' on the frame a pulse starts, else null.
/** @param {Enemy} e @param {JellyEnv} env @param {number} dt @returns {string | null} */
export function jellyStep(e, env, dt) {
  const { solidCell, rnd } = env;
  let S = e.je;
  if (!S) {
    // looks are rolled once, as fractions of their knob ranges (kru), so each jelly is its
    // own but a Dev-panel change still shows on every one at once
    S = e.je = { hd: -Math.PI / 2 + (rnd() - 0.5) * 0.6, vx: 0, vy: 0, push: 0, pushA: 0,
      rest: rnd() * 1.5, shape: 0, vref: Math.max(1, kr('jeRoamPush', rnd)), t: rnd() * 10, tent: [],
      u: { thin: rnd(), sq: rnd(), len: rnd(), wave: rnd(), sag: rnd(), glow: rnd(), glowR: rnd(), flare: rnd(), col: rnd(), plant: rnd() } };
    feel(false);
    const nt = Math.round(kr('jeTents', rnd));
    for (let i = 0; i < nt; i++) {
      const T = [], nv = Math.max(2, Math.round(kr('jeVerts', rnd)));
      for (let j = 0; j < nv; j++) T.push({ x: NaN, y: NaN });        // laid out behind the rim below
      S.tent.push(T);
    }
  }
  const mul = env.speedMul || 1;
  let hunt = !!(env.hunting && env.goal);
  S.t += dt;
  roamStep(S, e, dt, rnd, 'je', env.stay);
  // strayed into a built-up zone: it forgets you and heads home
  const lost = !!(env.stay && !env.stay(e.x, e.y));
  if (lost) hunt = false;
  if (hunt && !S.range) S.range = kr('jeRange', rnd);
  if (!hunt) S.range = 0;
  const goal = hunt ? env.goal : lost ? { x: e.hx, y: e.hy } : { x: S.rx, y: S.ry };
  const gx = goal.x - e.x, gy = goal.y - e.y, gd = Math.hypot(gx, gy);
  const range = S.range * (env.rangeMul || 1);
  // turn, no faster than the limit. Idle with nowhere to be, it rights itself, head up
  const want = !hunt && gd < 12 ? -Math.PI / 2 : Math.atan2(gy, gx);
  S.hd = turnToward(S.hd, want, S.turn * Math.PI / 180 * mul * dt);
  const off = Math.abs(angDiff(want, S.hd)) * 180 / Math.PI;
  S.inRange = hunt && gd < range;
  S.aimed = hunt && off < S.aimTol;
  let out = null;
  if (S.push > 0) {
    // mid-pulse: thrust along the head (the whole pulse adds up to the rolled push speed)
    const a = S.pushA * mul * Math.min(dt, S.push);
    S.vx += Math.cos(S.hd) * a; S.vy += Math.sin(S.hd) * a;
    S.push -= dt;
  } else if ((S.rest -= dt) <= 0) {
    // ready: pulse only if there's somewhere to go and the head is (nearly) on it
    const v = (hunt ? gd > range : gd > 10) && off < S.tol ? kr(hunt ? 'jeHuntPush' : 'jeRoamPush', rnd) : 0;
    // where this pulse would glide it to (drag bleeds speed exponentially, so a speed v
    // carries it v / drag), no further than where it's going, plus the drift it already has
    const dg = Math.max(0.1, S.drag), glide = Math.min(gd, 160, Math.max(20, v / dg));
    const stay = env.stay, out0 = stay && !lost &&
      !stay(e.x + Math.cos(S.hd) * glide + S.vx / dg, e.y + Math.sin(S.hd) * glide + S.vy / dg);
    if (v > 0 && !out0) {
      const pt = kr('jePushT', rnd);
      S.push = pt; S.pushA = v / Math.max(pt, 0.001); S.vref = Math.max(v, 1);
      S.rest = kr(hunt ? 'jeHuntRest' : 'jeRoamRest', rnd);
      feel(hunt);
      out = 'pulse';
    } else S.rest = 0.05 + rnd() * 0.1;       // look again shortly
  }
  // the water: drag slows it (exponentially — quick at first, then a long glide) and it sinks
  const k = Math.exp(-S.drag * dt);
  S.vx *= k; S.vy = S.vy * k + S.sink * dt;
  flyMove(e, S, dt, e.r * JELLY.hitR, solidCell, S.bounce);
  // the bell: thin at speed, flat at rest, weighted to the thin side
  const f = Math.min(1, Math.hypot(S.vx, S.vy) / S.vref);
  S.shape = 1 - Math.pow(1 - f, kru('jeThin', S.u.thin));
  // tentacles: the first point rides the rim, the rest follow at a fixed spacing, swaying
  // sideways a little and drooping, so they stream out behind a push and hang when it rests
  const B = jellyBell(e.r, S.shape, kru('jeSquash', S.u.sq));
  const c = Math.cos(S.hd), s = Math.sin(S.hd), n = S.tent.length;
  const len = kru('jeTentLen', S.u.len), wave = kru('jeWave', S.u.wave), sag = kru('jeSag', S.u.sag);
  for (let i = 0; i < n; i++) {
    const T = S.tent[i], seg = len / (T.length - 1);
    const lx = n > 1 ? (i / (n - 1) - 0.5) * 1.4 * B.rw : 0;
    T[0].x = e.x - lx * s - B.rim * c; T[0].y = e.y + lx * c - B.rim * s;   // (lx, rim) in the jelly's frame
    if (isNaN(T[1].x)) for (let j = 1; j < T.length; j++) { T[j].x = T[0].x - c * seg * j; T[j].y = T[0].y - s * seg * j; }
    for (let j = 1; j < T.length; j++) {
      const q = T[j], pq = T[j - 1];
      const sw = Math.sin(S.t * 3.1 + i * 0.5 - j * 0.9) * wave * dt * j / (T.length - 1);   // near in step, so they don't cross
      q.x -= s * sw; q.y += c * sw + sag * dt;
      const dx = q.x - pq.x, dy = q.y - pq.y, d = Math.hypot(dx, dy) || 1;
      q.x = pq.x + dx / d * seg; q.y = pq.y + dy / d * seg;
    }
  }
  return out;

  // this pulse's own feel: how fast it turns, how true it must face, drag, sink, bounce, aim
  function feel(h) {
    S.turn = kr('jeTurn', rnd); S.tol = kr('jePushTol', rnd); S.drag = kr('jeDrag', rnd);
    S.sink = kr('jeSink', rnd); S.bounce = kr('jeBounce', rnd); S.aimTol = kr('jeAimTol', rnd);
    S.range = h ? kr('jeRange', rnd) : 0;
  }
}

// Does the line from (ax, ay) to (bx, by) pass through the box x0..x1, y0..y1? Clips the
// line to the box one edge at a time (Liang–Barsky) — exact, so a thin tentacle crossing
// a corner of you counts, and one passing close by doesn't.
/** @param {number} ax @param {number} ay @param {number} bx @param {number} by @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @returns {boolean} */
export function segHitsBox(ax, ay, bx, by, x0, y0, x1, y1) {
  const dx = bx - ax, dy = by - ay;
  let t0 = 0, t1 = 1;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
    return true;
  };
  return clip(-dx, ax - x0) && clip(dx, x1 - ax) && clip(-dy, ay - y0) && clip(dy, y1 - ay);
}
// where a jelly's tentacles cross the box (the middle of the first segment that does), or null
/** @param {JellyBrain | undefined} S @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @returns {Pt | null} */
export function tentacleTouch(S, x0, y0, x1, y1) {
  if (!S || !S.tent) return null;
  for (const T of S.tent) for (let j = 1; j < T.length; j++) {
    const a = T[j - 1], b = T[j];
    if (!isNaN(a.x) && segHitsBox(a.x, a.y, b.x, b.y, x0, y0, x1, y1)) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  return null;
}

// ---- the jellyfish's plant glow ----
// Green vegetation near a jelly glows and twinkles in its colour, built the way the owner
// (a VFX compositor) laid it out: take the art round the jelly, pull the green channel,
// levels it so only the top 25% of the floor's green is left (black point at 75% of the
// white point), × a ramp from the jelly out to its reach, × an animated soft noise (the
// twinkle), × the jelly's glow colour, and add that on top of the level. One change to a
// straight green pull: pixels where green isn't the strongest channel are held out —
// otherwise the gold seams (255,210,60) and pale flowers, bright in green too, set the
// white point and take the top 25%, and the moss gets none of it.
export const TW_N = 64;
export const TW_TILE = (() => {
  let q = 12345; const a = new Float32Array(TW_N * TW_N);
  for (let i = 0; i < a.length; i++) { q = (q * 16807) % 2147483647; a[i] = q / 2147483647; }
  return a;
})();
// smooth value noise, 0..1, repeating every 64
/** @param {number} x @param {number} y @returns {number} */
export function twNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const x0 = ((xi % TW_N) + TW_N) % TW_N, y0 = ((yi % TW_N) + TW_N) % TW_N, x1 = (x0 + 1) % TW_N, y1 = (y0 + 1) % TW_N;
  const a = TW_TILE[y0 * TW_N + x0], b = TW_TILE[y0 * TW_N + x1], c = TW_TILE[y1 * TW_N + x0], d = TW_TILE[y1 * TW_N + x1];
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
// the twinkle at world (x, y), time t: two layers of that noise drifting past each other,
// multiplied, the contrast pushed so it reads as soft points coming and going. 0..1.
/** @param {number} x @param {number} y @param {number} t @param {number} size @returns {number} */
export function twinkle(x, y, t, size) {
  const u = x / size, v = y / size;
  const n = twNoise(u + t * 0.37, v - t * 0.23) * twNoise(u * 1.7 - t * 0.31 + 17, v * 1.7 + t * 0.29 + 5);
  const k = Math.min(1, Math.max(0, (n - 0.12) / 0.45));
  return k * k * (3 - 2 * k);
}
// the white point: the floor's brightest green (its 99.9th percentile, so a stray pixel
// can't set it) among mostly-opaque pixels where green is the strongest channel. A faint
// anti-aliased edge (alpha 1/255 comes back as junk like 0,255,0) must not count.
/** @param {...(Uint8ClampedArray | null | undefined)} datas @returns {number} */
export function plantWhite(...datas) {
  const hist = new Uint32Array(256);
  let n = 0;
  for (const d of datas) if (d) for (let i = 0; i < d.length; i += 4)
    if (d[i + 3] >= 128 && d[i + 1] >= d[i] && d[i + 1] >= d[i + 2]) { hist[d[i + 1]]++; n++; }
  if (!n) return 255;
  for (let g = 0, c = 0; g < 256; g++) { c += hist[g]; if (c >= n * 0.999) return Math.max(1, g); }
  return 255;
}
/** @typedef {{ ox: number, oy: number, px: number, cx: number, cy: number, reach: number, white: number, top: number, strength: number, t: number, size: number, rgb: ArrayLike<number>, lit?: ((x: number, y: number) => unknown) | null }} PlantGlowOpts where the box is, the jelly, the levels, the colour */
// The comp for one box of art (RGBA `art`, w×h, each pixel `o.px` world units, top-left
// at world (o.ox, o.oy)) lit by a jelly at (o.cx, o.cy): writes out (RGBA, same size) with
// the colour o.rgb at alpha = key × ramp × twinkle × strength. o.lit(x, y), if given, holds
// out ground you haven't seen. Returns how many pixels glow.
/** @param {Uint8ClampedArray} out @param {ArrayLike<number>} art @param {number} w @param {number} h @param {PlantGlowOpts} o @returns {number} */
export function plantGlowFill(out, art, w, h, o) {
  const black = o.white * (1 - o.top), span = Math.max(1, o.white - black);
  const r = o.rgb[0], g = o.rgb[1], b = o.rgb[2];
  let any = 0;
  for (let y = 0; y < h; y++) {
    const wy = o.oy + (y + 0.5) * o.px, dy = wy - o.cy;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, G = art[i + 1];
      out[i + 3] = 0;
      if (!art[i + 3] || G <= black || G < art[i] || G < art[i + 2]) continue;      // the green key
      const wx = o.ox + (x + 0.5) * o.px, dx = wx - o.cx;
      const ramp = 1 - Math.sqrt(dx * dx + dy * dy) / o.reach;                        // × the ramp
      if (ramp <= 0 || (o.lit && !o.lit(wx, wy))) continue;
      const a = Math.min(1, (G - black) / span) * ramp * twinkle(wx, wy, o.t, o.size) * o.strength * art[i + 3] / 255;
      if (a < 0.004) continue;
      out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = Math.min(255, a * 255);
      any++;
    }
  }
  return any;
}
// The jellyfish: a see-through green bell pointing its head along its heading — thin and
// tall just after a pulse, flat and wide as it slows (S.shape through jellyBell) — with a
// scalloped rim, four bright poison loops inside and a pale crown, trailing its tentacles
// (S.tent, world points from jellyStep). The glow it throws on the cave is added after the
// fog, in the Game's draw.
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r @param {number} time @param {number} phase @param {boolean} flash @param {CreatureCol} col @param {JellyBrain} [S] */
export function drawJelly(ctx, x, y, r, time, phase, flash, col, S) {
  const P = jellyPal(S ? S.u.col : 0.5);                  // Dev → Jellyfish colours
  const sh = Math.max(0, Math.min(1, (S ? S.shape : 0) + 0.05 * Math.sin(time * 2.2 + phase)));
  const B = jellyBell(r, sh, S ? kru('jeSquash', S.u.sq) : 1);
  // tentacles behind the bell: each one a single smooth ribbon, thick at the rim and
  // tapering to a point, so there are no beads where the segments meet
  if (S) {
    ctx.fillStyle = flash ? '#ffffff' : P.tent;
    ctx.globalAlpha = 0.6;
    for (const T of S.tent) {
      const n = T.length, L = [], R = [];
      for (let j = 0; j < n; j++) {
        const a = T[Math.max(0, j - 1)], b = T[Math.min(n - 1, j + 1)];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const hw = r * 0.09 * (1 - j / (n - 1)) + 0.15;
        L.push({ x: T[j].x - dy / d * hw, y: T[j].y + dx / d * hw });
        R.push({ x: T[j].x + dy / d * hw, y: T[j].y - dx / d * hw });
      }
      const side = (P, back) => {             // a curve through the midpoints: smooth, not angular
        const Q = back ? P.slice().reverse() : P;
        ctx.lineTo(Q[0].x, Q[0].y);
        for (let j = 1; j < n - 1; j++) ctx.quadraticCurveTo(Q[j].x, Q[j].y, (Q[j].x + Q[j + 1].x) / 2, (Q[j].y + Q[j + 1].y) / 2);
        ctx.lineTo(Q[n - 1].x, Q[n - 1].y);
      };
      ctx.beginPath(); ctx.moveTo(L[0].x, L[0].y);
      side(L, false); side(R, true);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((S ? S.hd : -Math.PI / 2) + Math.PI / 2);        // head (local up) along the heading
  // the bell's outline at scale k, shifted oy, with a scalloped margin `lap` deep (0: none)
  const bell = (k, oy, lap) => {
    const w = B.w * k, h = B.h * k, rw = B.rw * k, top = B.top * k + oy, rim = B.rim * k + oy;
    ctx.beginPath();
    ctx.moveTo(-rw, rim);
    ctx.bezierCurveTo(-w * 1.08, rim - h * 0.5, -w * 0.72, top, 0, top);
    ctx.bezierCurveTo(w * 0.72, top, w * 1.08, rim - h * 0.5, rw, rim);
    if (lap) for (let i = 0; i < 5; i++) {
      const x0 = rw - 2 * rw * i / 5, x1 = rw - 2 * rw * (i + 1) / 5;
      ctx.quadraticCurveTo((x0 + x1) / 2, rim + lap * (1 + 0.35 * Math.sin(time * 5 + i * 1.3 + phase)), x1, rim);
    }
    ctx.closePath();
  };
  const g = ctx.createLinearGradient(0, B.top, 0, B.rim);
  g.addColorStop(0, flash ? '#ffffff' : P.top);
  g.addColorStop(0.55, flash ? '#ffffff' : P.body);
  g.addColorStop(1, flash ? '#f4f0ff' : P.rim);
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = g;
  bell(1, 0, r * 0.2 * (1 - 0.5 * sh)); ctx.fill();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = flash ? '#ffffff' : P.edge; ctx.lineWidth = r * 0.08; ctx.stroke();
  // the inner bell, paler
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = flash ? '#ffffff' : P.inner;
  bell(0.6, -B.h * 0.06, 0); ctx.fill();
  // four poison loops, brightest mid-pulse
  ctx.globalAlpha = 0.55 + 0.45 * sh;
  ctx.strokeStyle = flash ? '#ffffff' : P.loops; ctx.lineWidth = r * 0.08;
  const gy = (B.top + B.rim) / 2 + B.h * 0.12;
  for (let i = 0; i < 4; i++) {
    const gx = (i - 1.5) * B.w * 0.34;
    ctx.beginPath(); ctx.arc(gx, gy - Math.abs(i - 1.5) * r * 0.08, r * 0.09, Math.PI, 2 * Math.PI); ctx.stroke();
  }
  // a wet highlight on the crown
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = P.shine;
  ctx.beginPath(); ctx.ellipse(-B.w * 0.32, B.top + B.h * 0.24, B.w * 0.16, B.h * 0.09, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
