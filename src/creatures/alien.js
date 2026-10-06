// @ts-check
// The dark zones' alien (Level 2 stage 7; the owner's brief, LEVEL2.md): a body the size of your helmet,
// almost all of it one eyeball, its black pupil darting about until it locks onto you; three very thin
// spider legs, equally spaced and aimed outwards, about three body-widths long. Out of its zone (a stray)
// it is all black. Sprite only so far: the brain comes after the owner's OK of the look.

// body geometry (world units): r is the body's radius (the helmet is ~5 across: r 2.6)
export const ALIEN = { r: 2.6, leg: 3, knee: 0.55, lift: 0.35 };

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
  // thin two-part line, the knee lifted outwards, the foot reaching ~3 body-widths; they step in turn
  const L = r * 2 * ALIEN.leg;
  ctx.strokeStyle = ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(0.35, r * 0.13);
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i - 1) * (Math.PI * 2 / 3), step = walk ? Math.sin(time * 22 * walk + phase + i * 2.1) : 0;
    const fa = a + step * 0.22, ca = Math.cos(fa), sa = Math.sin(fa);
    // the knee bent off the leg's line, upwards (the planted two) or to one side (the one straight up)
    let qx = -sa, qy = ca;
    if (qy > 0.05 || (Math.abs(qy) <= 0.05 && qx < 0)) { qx = -qx; qy = -qy; }
    const kx = ca * L * ALIEN.knee + qx * L * ALIEN.lift, ky = sa * L * ALIEN.knee + qy * L * ALIEN.lift - Math.max(0, step) * r * 0.6;
    ctx.beginPath();
    ctx.moveTo(ca * r * 0.7, sa * r * 0.7);
    ctx.lineTo(kx, ky);
    ctx.lineTo(ca * L, sa * L);
    ctx.stroke();
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
