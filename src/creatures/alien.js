// @ts-check
// The dark zones' alien (Level 2 stage 7; the owner's brief, LEVEL2.md): a body the size of your helmet,
// almost all of it one eyeball, its black pupil darting about until it locks onto you; three very thin
// spider legs, equally spaced and aimed outwards, about one and a half body-widths long (owner: half of three),
// tapering from the body's full width at the root to a thin tip. Out of its zone (a stray)
// it is all black. The brain (stage 7b): alienStep, alienBoids, alienGrid / alienNear, below the sprite.


// body geometry (world units; the skin's noise is skinTile): r is the body's radius (the helmet is ~5 across: r 2.6)
export const ALIEN = { r: 2.6, leg: 1.5, knee: 0.55, lift: 0.35 };

// a leg as a ribbon along pts, added to the current path: w0 wide at the first point, narrowing evenly by
// length to w1 at the last (the tip rounded). The bend is rounded off (Chaikin, twice) and the width is
// bumpy along the leg (owner: not hard angles), by seed: each leg its own bumps
/** @param {CanvasRenderingContext2D} ctx @param {number[][]} raw @param {number} w0 @param {number} w1 @param {number} seed */
function taperedLeg(ctx, raw, w0, w1, seed) {
  let pts = raw;
  for (let it = 0; it < 2; it++) {
    const o = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    o.push(pts[pts.length - 1]);
    pts = o;
  }
  const n = pts.length, len = [0];
  for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = len[n - 1] || 1, left = [], right = [];
  for (let i = 0; i < n; i++) {
    // the normal here: the segment's, or at a bend the mean of the two
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const u = len[i] / total, bump = i === 0 || i === n - 1 ? 1 : 1 + 0.28 * Math.sin(u * 19 + seed * 7.1) * Math.sin(u * 7.3 + seed * 3.7);
    const hw = (w0 + (w1 - w0) * u) / 2 * bump;
    left.push([pts[i][0] - dy * hw, pts[i][1] + dx * hw]); right.push([pts[i][0] + dy * hw, pts[i][1] - dx * hw]);
  }
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.moveTo(pts[n - 1][0] + w1 / 2, pts[n - 1][1]); ctx.arc(pts[n - 1][0], pts[n - 1][1], w1 / 2, 0, Math.PI * 2, true);
}

// the eyeball, shared by every alien (v0.0.148, owner: for speed): its white, the red veins and the wet glint,
// drawn once per colour into EYE_N px and scaled onto each one; only the pupil is drawn per alien. The veins
// are fixed, reaching in toward the middle (the pupil moves over them)
const EYE_N = 96;
/** @type {Map<string, HTMLCanvasElement>} */
const eyes = new Map();
/** @param {string} white */
function eyeArt(white) {
  const got = eyes.get(white);
  if (got) return got;
  const c = document.createElement('canvas'); c.width = c.height = EYE_N;
  eyes.set(white, c);
  const g = c.getContext('2d');
  if (!g) return c;
  // in eye radii: the ball is radius 1 (the body's 0.8 r)
  g.translate(EYE_N / 2, EYE_N / 2); g.scale(EYE_N / 2, EYE_N / 2);
  g.fillStyle = white;
  g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fill();
  g.save();
  g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.clip();
  g.strokeStyle = 'rgba(170, 40, 50, 0.6)'; g.lineWidth = 0.07; g.lineCap = 'round';
  for (let v = 0; v < 8; v++) {
    const h = Math.sin(v * 78.233 + 4.1) * 43758.5453, u = h - Math.floor(h);
    const va = v * (Math.PI * 2 / 8) + (u - 0.5) * 0.5;
    const sx = Math.cos(va) * 1.08, sy = Math.sin(va) * 1.08, ex = Math.cos(va) * 0.4, ey = Math.sin(va) * 0.4;
    const dx = ex - sx, dy = ey - sy, dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl;
    const amp = 0.025 + u * 0.15, waves = 1 + u * 3;
    g.beginPath(); g.moveTo(sx, sy);
    for (let q = 1; q <= 10; q++) {
      const t = q / 10, w = Math.sin(t * Math.PI * waves + v) * amp * Math.sin(t * Math.PI);
      g.lineTo(sx + dx * t + nx * w, sy + dy * t + ny * w);
    }
    g.stroke();
  }
  g.restore();
  return c;
}

/**
 * The alien at (x, y). S: how it stands and looks — `rot` the way its underside faces (radians, 0 = feet
 * down), `px`/`py` the pupil's offset (-1..1 of the room it has), `walk` 0..1 how fast its legs go (0 still),
 * `black` a stray outside its zone (all black).
 * @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r @param {number} time
 * @param {number} phase @param {boolean} flash
 * @param {{ a: string, b: string, c: string, eye: string }} col shell a, its shade b, the eye's white c, the pupil eye
 * @param {{ rot?: number, px?: number, py?: number, walk?: number, black?: boolean, gait?: number }} [S]
 */
export function drawAlien(ctx, x, y, r, time, phase, flash, col, S) {
  const s = S || {}, black = !!s.black, rot = s.rot || 0, walk = s.walk || 0;
  const ink = flash && !black ? '#ffffff' : '#000000';     // body and legs black (v0.0.148: the skin went, for speed)
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  // the legs: three, 120° apart, two planted down and out (a tripod) and one reaching up behind; each a
  // two-part leg, the knee lifted outwards, the foot ~1.5 body-widths out; they step in turn. Each is a filled
  // ribbon from the body's middle, as wide as the body there, narrowing along its whole length to the tip
  const L = r * 2 * ALIEN.leg;
  const tip = Math.max(0.35, r * 0.13);
  ctx.fillStyle = ink;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    // each alien its own stance (from its phase): the legs splayed a little differently, longer or shorter, and
    // twitching slowly even at rest; walking, they step in turn on the gait cycle (the brain's, else the clock)
    const hv = (/** @type {number} */ k) => { const h = Math.sin(phase * 12.9898 + i * 78.233 + k * 37.719) * 43758.5453; return h - Math.floor(h); };
    const splay = (hv(1) - 0.5) * 0.7, lenK = 0.85 + hv(2) * 0.3, twitch = Math.sin(time * (1.3 + hv(3) * 1.7) + hv(4) * 6.28) * 0.07;
    const g = s.gait !== undefined ? s.gait : time * 22 * walk, step = walk ? Math.sin(g + phase + i * 2.1) * Math.min(1, walk * 2) : 0;
    const a = -Math.PI / 2 + (i - 1) * (Math.PI * 2 / 3) + splay + twitch;
    const fa = a + step * 0.22, ca = Math.cos(fa), sa = Math.sin(fa), Li = L * lenK;
    // the knee bent off the leg's line, upwards (the planted two) or to one side (the one straight up)
    let qx = -sa, qy = ca;
    if (qy > 0.05 || (Math.abs(qy) <= 0.05 && qx < 0)) { qx = -qx; qy = -qy; }
    const lift = ALIEN.lift * (0.75 + hv(5) * 0.5);
    const kx = ca * Li * ALIEN.knee + qx * Li * lift, ky = sa * Li * ALIEN.knee + qy * Li * lift - Math.max(0, step) * r * 0.6;
    taperedLeg(ctx, [[0, 0], [kx, ky], [ca * Li, sa * Li]], r * 2, tip, phase * 3.1 + i * 1.9);
  }
  // and the body's round, in the same shape, one fill for it all (wound the same way as the legs, so where
  // they overlap it stays filled: no seams)
  ctx.moveTo(r, 0); ctx.arc(0, 0, r, 0, Math.PI * 2, true);
  ctx.fill();
  ctx.restore();
  // the body, upright whatever its legs do: a thin shell round one big eye (the shared picture), the pupil
  // where it is looking, and the wet glint over it
  if (!black) {
    const er = r * 0.8, sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(eyeArt(flash ? '#ffffff' : col.c), x - er, y - er, er * 2, er * 2);
    ctx.imageSmoothingEnabled = sm;
    const px = Math.max(-1, Math.min(1, s.px || 0)), py = Math.max(-1, Math.min(1, s.py || 0)), room = r * 0.42;
    ctx.fillStyle = col.eye;
    ctx.beginPath(); ctx.arc(x + px * room, y + py * room, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath(); ctx.arc(x - r * 0.32, y - r * 0.34, r * 0.13, 0, Math.PI * 2); ctx.fill();
  }
}

// ---- the brain (stage 7b; the owner's brief, LEVEL2.md) ----
// Hundreds of them, in packs (boids: separation, alignment, cohesion with the neighbours within alBoidR),
// roaming their zone in short bursts a bit faster than the spider, anywhere there is silk (the background)
// or rock next to them. Never out of the zone (a stray excepted). Within alFleeR of any fire (a burning
// cell, an explosion, a burning body: env.fireNear) one runs straight away, and the pack flows with it.
// Only when you are in the dark (in a zone, no fire near you: env.youDark) does one come for you and
// bite; in light it keeps alKeep away, so you have to corner them. The pupil darts about every 0.2-0.8 s
// until you are in aggro reach, then stares at you. A stray (S.black, outside every zone) wanders until it
// sees you, then sprints for the nearest zone (env.home) and turns normal inside. Pure: the world comes in
// through env. Every number is a Dev range (AL_KNOBS, dev/knobs.js), rolled at use.

