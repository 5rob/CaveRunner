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
    // a few red veins in from the rim
    ctx.strokeStyle = 'rgba(170, 40, 50, 0.55)'; ctx.lineWidth = Math.max(0.2, r * 0.06);
    for (let v = 0; v < 4; v++) {
      const va = phase * 3 + v * 1.7, vr = r * 0.8;
      ctx.beginPath(); ctx.moveTo(Math.cos(va) * vr, Math.sin(va) * vr);
      ctx.lineTo(Math.cos(va + 0.25) * vr * 0.6, Math.sin(va + 0.25) * vr * 0.6); ctx.stroke();
    }
    // the pupil: a black dot, wherever it is looking
    const px = Math.max(-1, Math.min(1, s.px || 0)), py = Math.max(-1, Math.min(1, s.py || 0)), room = r * 0.42;
    ctx.fillStyle = col.eye;
    ctx.beginPath(); ctx.arc(px * room, py * room, r * 0.3, 0, Math.PI * 2); ctx.fill();
    // and the wet glint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath(); ctx.arc(-r * 0.32, -r * 0.34, r * 0.13, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
