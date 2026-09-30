// @ts-check
// Movement pieces the reworked creatures share: roamStep (a roam spot drifting round
// home), turnToward (turn-rate limit), flyMove (a free flyer bounced off rock), surfNormal
// and surfSeat (sitting on a rock surface). Reach for these first for a new creature.

import { CELL } from '../core/consts.js';
import { angDiff } from '../core/util.js';
import { kr } from '../dev/knobs.js';

// ---- shared creature movement ----
// Pieces more than one creature is built from: the spider and the jellyfish use them now,
// and the next creature reworked should reach for these before writing its own. All pure.

// The roam spot: a point that wanders slowly round home (e.hx, e.hy) and turns back
// whenever it strays past the roam radius. A roaming creature heads for it. Keeps rx, ry,
// ra, roamR, roamSpd on the creature's state R; radius and drift speed are the creature's
// knobs pre+'RoamR' / pre+'RoamSpd', rolled again each time it turns back. ok(x, y), if
// given, is where the spot may go: it turns back toward home at the edge of that too.
/** @param {RoamState} R @param {{ hx: number, hy: number }} e its home @param {number} dt @param {Rnd} rnd @param {string} pre the knob prefix @param {((x: number, y: number) => boolean) | null} [ok] */
export function roamStep(R, e, dt, rnd, pre, ok) {
  if (R.rx === undefined) { R.rx = e.hx; R.ry = e.hy; R.ra = rnd() * 6.28; }
  R.ra += (rnd() - 0.5) * 3 * dt;
  if (!R.roamR) { R.roamR = kr(pre + 'RoamR', rnd); R.roamSpd = kr(pre + 'RoamSpd', rnd); }
  if (Math.hypot(R.rx - e.hx, R.ry - e.hy) > R.roamR) {
    R.ra = Math.atan2(e.hy - R.ry, e.hx - R.rx);
    R.roamR = kr(pre + 'RoamR', rnd); R.roamSpd = kr(pre + 'RoamSpd', rnd);
  }
  const nx = R.rx + Math.cos(R.ra) * R.roamSpd * dt, ny = R.ry + Math.sin(R.ra) * R.roamSpd * dt;
  if (ok && !ok(nx, ny) && ok(R.rx, R.ry)) { R.ra = Math.atan2(e.hy - R.ry, e.hx - R.rx); return; }
  R.rx = nx; R.ry = ny;
}

// a heading `a` turned toward `to` by at most `max` radians: a turn-rate limit. Kept
// within ±π so it never winds up.
/** @param {number} a @param {number} to @param {number} max @returns {number} */
export function turnToward(a, to, max) {
  const d = angDiff(to, a), r = a + Math.max(-max, Math.min(max, d));
  return r > Math.PI ? r - 2 * Math.PI : r < -Math.PI ? r + 2 * Math.PI : r;
}

// Move a free-flying body by its velocity (V.vx, V.vy) in steps short enough that it
// can't pass through a thin wall, and bounce it off rock: anything nearer than r pushes
// it straight back out, and the part of its velocity going into the rock is turned round
// and scaled by `bounce` (0 stops dead against it, 1 is a perfect bounce). surfNormal's
// smoothed normal means it glances off lumpy rock rather than snagging on a pixel.
// true if it touched rock.
/** @param {Pt} e moved @param {{ vx: number, vy: number }} V @param {number} dt @param {number} r @param {SolidCell} solidCell @param {number} bounce @returns {boolean} */
export function flyMove(e, V, dt, r, solidCell, bounce) {
  const n = Math.max(1, Math.ceil(Math.hypot(V.vx, V.vy) * dt / CELL));
  let hit = false;
  for (let i = 0; i < n; i++) {
    e.x += V.vx * dt / n; e.y += V.vy * dt / n;
    const s = surfNormal(e.x, e.y, r + CELL, solidCell);
    if (!s || s.d >= r) continue;
    hit = true;
    // right on the rock there's no nearest-point direction; the smoothed normal still knows
    const ox = s.d > 0.5 ? s.px : s.x, oy = s.d > 0.5 ? s.py : s.y;
    e.x += ox * (r - s.d); e.y += oy * (r - s.d);
    const into = V.vx * ox + V.vy * oy;
    if (into < 0) { V.vx -= (1 + bounce) * into * ox; V.vy -= (1 + bounce) * into * oy; }
  }
  return hit;
}

// the smoothed surface normal at (x, y): points away from the rock, null if there's no
// rock within R. Also the nearest rock: d is the distance to it, (px, py) the way out.
/** @param {number} x @param {number} y @param {number} R @param {SolidCell} solidCell @returns {{ x: number, y: number, d: number, px: number, py: number } | null} */
export function surfNormal(x, y, R, solidCell) {
  const cx0 = Math.floor(x / CELL), cy0 = Math.floor(y / CELL), rc = Math.ceil(R / CELL);
  let nx = 0, ny = 0, n = 0, d = Infinity, px = 0, py = -1;
  for (let dy = -rc; dy <= rc; dy++) for (let dx = -rc; dx <= rc; dx++) {
    const wx = (cx0 + dx + 0.5) * CELL - x, wy = (cy0 + dy + 0.5) * CELL - y;
    if (wx * wx + wy * wy > R * R) continue;
    if (!solidCell(cx0 + dx, cy0 + dy)) continue;
    nx -= wx; ny -= wy; n++;
    // the nearest point of this cell's box
    const qx = Math.max(wx - CELL / 2, Math.min(0, wx + CELL / 2)), qy = Math.max(wy - CELL / 2, Math.min(0, wy + CELL / 2));
    const q = Math.hypot(qx, qy);
    if (q < d) { d = q; if (q > 1e-6) { px = -qx / q; py = -qy / q; } }
  }
  if (!n) return null;
  const l = Math.hypot(nx, ny);
  return l < 1e-6 ? { x: px, y: py, d, px, py } : { x: nx / l, y: ny / l, d, px, py };
}
// the same for any surface crawler: hold is how far off the rock it sits, feel how far it feels
/** @param {Pt} e moved @param {SurfState} S @param {SolidCell} solidCell @param {number} maxMove @param {number} hold @param {number} feel @returns {boolean} */
export function surfSeat(e, S, solidCell, maxMove, hold, feel) {
  let n = surfNormal(e.x, e.y, feel, solidCell);
  if (!n) return false;
  if (n.d < hold) {
    const m = hold - n.d;
    e.x += n.px * m; e.y += n.py * m;
    n = surfNormal(e.x, e.y, feel, solidCell) || n;
  } else {
    const m = Math.min(maxMove, n.d - hold);
    e.x -= n.x * m; e.y -= n.y * m;
  }
  S.nx = n.x; S.ny = n.y; S.py = n.py;          // py: straight out from the nearest rock
  return true;
}

// ---- the hologram's count ----
// "Biological entities detected" (the background hologram, game/render/holo.js): every living
// creature on the floor (not rat nests, not the dead), plus you while you're out of the shop.
/** @param {Enemy[]} enemies @param {boolean} youOut are you in the level (alive, above the shop)? */
export function bioCount(enemies, youOut) {
  let n = youOut ? 1 : 0;
  for (const e of enemies) if (!e.dead && !e.nest && e.k.act !== 'nest') n++;
  return n;
}
