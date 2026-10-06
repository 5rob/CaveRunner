// @ts-check
// The dark zones' alien (Level 2 stage 7; the owner's brief, LEVEL2.md): a body the size of your helmet,
// almost all of it one eyeball, its black pupil darting about until it locks onto you; three very thin
// spider legs, equally spaced and aimed outwards, about one and a half body-widths long (owner: half of three),
// tapering from the body's full width at the root to a thin tip. Out of its zone (a stray)
// it is all black. Sprite only so far: the brain comes after the owner's OK of the look.

// body geometry (world units): r is the body's radius (the helmet is ~5 across: r 2.6)
export const ALIEN = { r: 2.6, leg: 1.5, knee: 0.55, lift: 0.35 };

// a leg as a filled ribbon along pts: w0 wide at the first point, narrowing evenly by length to w1 at the last
// (the bend mitred, the tip rounded)
/** @param {CanvasRenderingContext2D} ctx @param {number[][]} pts @param {number} w0 @param {number} w1 */
function taperedLeg(ctx, pts, w0, w1) {
  const n = pts.length, len = [0];
  for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = len[n - 1] || 1, left = [], right = [];
  for (let i = 0; i < n; i++) {
    // the normal here: the segment's, or at a bend the mean of the two
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const hw = (w0 + (w1 - w0) * len[i] / total) / 2;
    left.push([pts[i][0] - dy * hw, pts[i][1] + dx * hw]); right.push([pts[i][0] + dy * hw, pts[i][1] - dx * hw]);
  }
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(pts[n - 1][0], pts[n - 1][1], w1 / 2, 0, Math.PI * 2); ctx.fill();
}

/**
 * The alien at (x, y). S: how it stands and looks — `rot` the way its underside faces (radians, 0 = feet
 * down), `px`/`py` the pupil's offset (-1..1 of the room it has), `walk` 0..1 how fast its legs go (0 still),
 * `black` a stray outside its zone (all black).
 * @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r @param {number} time
 * @param {number} phase @param {boolean} flash
 * @param {{ a: string, b: string, c: string, eye: string }} col shell a, its shade b, the eye's white c, the pupil eye
 * @param {{ rot?: number, px?: number, py?: number, walk?: number, black?: boolean }} [S]
 */
export function drawAlien(ctx, x, y, r, time, phase, flash, col, S) {
  const s = S || {}, black = !!s.black, rot = s.rot || 0, walk = s.walk || 0;
  const ink = black ? '#000000' : flash ? '#ffffff' : col.b;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  // the legs: three, 120° apart, two planted down and out (a tripod) and one reaching up behind; each a
  // two-part leg, the knee lifted outwards, the foot ~1.5 body-widths out; they step in turn. Each is a filled
  // ribbon from the body's middle, as wide as the body there, narrowing along its whole length to the tip
  const L = r * 2 * ALIEN.leg;
  const tip = Math.max(0.35, r * 0.13);
  ctx.fillStyle = ink;
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i - 1) * (Math.PI * 2 / 3), step = walk ? Math.sin(time * 22 * walk + phase + i * 2.1) : 0;
    const fa = a + step * 0.22, ca = Math.cos(fa), sa = Math.sin(fa);
    // the knee bent off the leg's line, upwards (the planted two) or to one side (the one straight up)
    let qx = -sa, qy = ca;
    if (qy > 0.05 || (Math.abs(qy) <= 0.05 && qx < 0)) { qx = -qx; qy = -qy; }
    const kx = ca * L * ALIEN.knee + qx * L * ALIEN.lift, ky = sa * L * ALIEN.knee + qy * L * ALIEN.lift - Math.max(0, step) * r * 0.6;
    taperedLeg(ctx, [[0, 0], [kx, ky], [ca * L, sa * L]], r * 2, tip);
  }
  ctx.restore();
  // the body, upright whatever its legs do: a thin shell round one big eye
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = ink;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  if (!black) {
    ctx.fillStyle = flash ? '#ffffff' : col.a;
    ctx.beginPath(); ctx.arc(0, -r * 0.08, r * 0.92, 0, Math.PI * 2); ctx.fill();
    // the eyeball: almost all of it
    ctx.fillStyle = flash ? '#ffffff' : col.c;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.fill();
    // the pupil: where it is looking (the veins reach for it)
    const px = Math.max(-1, Math.min(1, s.px || 0)), py = Math.max(-1, Math.min(1, s.py || 0)), room = r * 0.42;
    const pcx = px * room, pcy = py * room, pr = r * 0.3;
    // red veins in from the rim to the pupil's edge, eight, each its own squiggle (owner), following the pupil
    // as it moves; clipped to the eyeball so none shows outside the body
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = 'rgba(170, 40, 50, 0.6)'; ctx.lineWidth = Math.max(0.18, r * 0.05); ctx.lineCap = 'round';
    for (let v = 0; v < 8; v++) {
      const h = Math.sin(phase * 12.9898 + v * 78.233) * 43758.5453, u = h - Math.floor(h);
      const va = phase * 3 + v * (Math.PI * 2 / 8) + (u - 0.5) * 0.5;
      const sx = Math.cos(va) * r * 0.86, sy = Math.sin(va) * r * 0.86;
      const ex = pcx + Math.cos(va) * pr * 0.9, ey = pcy + Math.sin(va) * pr * 0.9;
      const dx = ex - sx, dy = ey - sy, dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl;
      const amp = r * (0.02 + u * 0.12), waves = 1 + u * 3, steps = 10;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      for (let q = 1; q <= steps; q++) {
        const t = q / steps, w = Math.sin(t * Math.PI * waves + v) * amp * Math.sin(t * Math.PI);
        ctx.lineTo(sx + dx * t + nx * w, sy + dy * t + ny * w);
      }
      ctx.stroke();
    }
    ctx.restore();
    // the pupil: a black dot
    ctx.fillStyle = col.eye;
    ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, Math.PI * 2); ctx.fill();
    // and the wet glint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath(); ctx.arc(-r * 0.32, -r * 0.34, r * 0.13, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
