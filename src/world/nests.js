// @ts-check
// Rat nests (floor 1): ratNests finds a surface, digs a room into the rock behind it and
// a bending tunnel back out, so no sightline runs down it.

import { CH, CW, ROCK, SHOP_ROOF, SHOP_TOP } from '../core/consts.js';

// Rat nests, carved into a level's rock (floor 1: `nb` in the built-up zones, `nw` in the
// natural ones). Each is a spot on an up- or side-facing surface with room to stand in
// front of it; a room (a small blob) found a little way into solid rock behind it; and a
// tunnel from the room back out to the spot that bends as it goes, so no sightline runs
// down it and the fog over the room never lifts — you find a nest by digging. The mouth
// gets a little mound of earth. Everything in terrain pixels. `zone` is the level's zone
// map (null: everything is natural); `keep` spots {x, y, r} (px) no nest goes near.
// Returns [{ x, y, r (room), path: [{x, y}] room → mouth, mouth, built, mound: [i...] }].
/** @param {Uint8Array} mat @param {Rnd} rnd @param {Uint8Array | null} zone @param {{ x: number, y: number, r: number }[]} keep @param {number} nb @param {number} nw @returns {NestSpot[]} */
export function ratNests(mat, rnd, zone, keep, nb, nw) {
  const inb = (x, y) => x >= 4 && y >= 4 && x < CW - 4 && y < CH - 4;
  const rock = (x, y) => { x = Math.round(x); y = Math.round(y); return inb(x, y) && mat[y * CW + x] === ROCK; };
  const open = (x, y) => { x = Math.round(x); y = Math.round(y); return inb(x, y) && !mat[y * CW + x]; };
  const isBuilt = (x, y) => !!zone && zone[Math.round(y) * CW + Math.round(x)] === 1;
  const allRock = (x, y, r) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
      if (dx * dx + dy * dy <= r * r && !rock(x + dx, y + dy)) return false;
    return true;
  };
  const nests = [];
  const make = wantBuilt => {
    for (let a = 0; a < 400; a++) {
      const x = 8 + Math.floor(rnd() * (CW - 16)), y = 60 + Math.floor(rnd() * (SHOP_TOP - SHOP_ROOF - 110));
      if (!open(x, y) || isBuilt(x, y) !== wantBuilt) continue;
      // the surface: down to a floor, or (a third of the time) across to a wall
      let sx = x, sy = y, found = false;
      const dir = rnd() < 0.33 ? (rnd() < 0.5 ? -1 : 1) : 0;
      for (let k = 0; k < 30; k++) {
        const nx = dir ? sx + dir : sx, ny = dir ? sy : sy + 1;
        if (!inb(nx, ny)) break;
        if (mat[ny * CW + nx]) { found = rock(nx, ny); break; }
        sx = nx; sy = ny;
      }
      if (!found) continue;
      // its normal, from the rock round it; up or sideways only
      let nx = 0, ny = 0;
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++)
        if (dx * dx + dy * dy <= 25 && inb(sx + dx, sy + dy) && mat[(sy + dy) * CW + sx + dx]) { nx -= dx; ny -= dy; }
      const nl = Math.hypot(nx, ny);
      if (nl < 1e-6) continue;
      nx /= nl; ny /= nl;
      if (ny > 0.35) continue;
      // room to stand in front of it (the mound mustn't pinch a squeeze shut)
      let clear = true;
      for (let k = 2; k <= 22 && clear; k += 2) if (!open(sx + nx * k, sy + ny * k)) clear = false;
      if (!clear) continue;
      // the room, a little way back into solid rock, angled off the way in
      const ang = Math.atan2(-ny, -nx) + (rnd() - 0.5) * 1.3, D = 20 + rnd() * 14, rr = 5 + Math.floor(rnd() * 3);
      const cx = Math.round(sx + Math.cos(ang) * D), cy = Math.round(sy + Math.sin(ang) * D);
      if (cy > SHOP_TOP - SHOP_ROOF - 14 || !allRock(cx, cy, rr + 5)) continue;
      if (keep.some(k => Math.hypot(k.x - cx, k.y - cy) < k.r + rr || Math.hypot(k.x - sx, k.y - sy) < k.r)) continue;
      if (nests.some(n => Math.hypot(n.x - cx, n.y - cy) < 50 || Math.hypot(n.mouth.x - sx, n.mouth.y - sy) < 40)) continue;
      // the tunnel: room to surface with a sideways wave that's zero at both ends
      const M = 4 + rnd() * 1.5;                           // the mound's radius
      const tx = sx + nx * (M - 0.5), ty = sy + ny * (M - 0.5);   // up through the mound
      const L = Math.hypot(tx - cx, ty - cy), px = -(ty - cy) / L, py = (tx - cx) / L;
      const amp = (4 + rnd() * 4) * (rnd() < 0.5 ? -1 : 1), waves = 1 + rnd() * 0.8, steps = Math.ceil(L * 2);
      const path = [];
      let buried = true;
      for (let k = 0; k <= steps; k++) {
        const t = k / steps, w = amp * Math.sin(t * Math.PI * waves) * Math.sin(t * Math.PI);
        const qx = cx + (tx - cx) * t + px * w, qy = cy + (ty - cy) * t + py * w;
        path.push({ x: qx, y: qy });
        // buried in rock the whole way, bar the last bit up to the surface
        if (Math.hypot(qx - sx, qy - sy) > 6 && Math.hypot(qx - cx, qy - cy) > rr && !allRock(qx, qy, 3)) { buried = false; break; }
      }
      if (!buried) continue;
      // carve: the mound first (open ground only, a lens on the surface), then the room and tunnel
      const mound = [];
      const mx = sx - nx * 1.5, my = sy - ny * 1.5, Mr = Math.ceil(M + 2);
      for (let dy = -Mr; dy <= Mr; dy++) for (let dx = -Mr; dx <= Mr; dx++) {
        const X = Math.round(mx) + dx, Y = Math.round(my) + dy;
        if (!inb(X, Y) || Math.hypot(X - mx, Y - my) > M) continue;
        if (!mat[Y * CW + X]) mat[Y * CW + X] = ROCK;
        if (mat[Y * CW + X] === ROCK) mound.push(Y * CW + X);
      }
      for (let dy = -rr - 2; dy <= rr + 2; dy++) for (let dx = -rr - 2; dx <= rr + 2; dx++) {
        const a2 = Math.atan2(dy, dx), wob = rr * (0.8 + 0.25 * Math.sin(a2 * 3 + cx) + 0.12 * Math.sin(a2 * 5 + cy));
        if (Math.hypot(dx, dy * 1.25) <= wob) mat[(cy + dy) * CW + cx + dx] = 0;
      }
      const cut = (qx, qy) => {
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const X = Math.round(qx + dx), Y = Math.round(qy + dy);
          if (inb(X, Y) && Math.hypot(X - qx, Y - qy) <= 1.6) mat[Y * CW + X] = 0;
        }
      };
      for (const q of path) cut(q.x, q.y);
      cut(tx + nx, ty + ny);
      const mouth = { x: tx + nx * 2.5, y: ty + ny * 2.5 };
      path.push(mouth);
      // a rat walks the tunnel along its middle; thinned out so it's cheap to follow
      const thin = path.filter((q, i) => i % 3 === 0 || i === path.length - 1);
      nests.push({ x: cx, y: cy, r: rr, path: thin, mouth, built: wantBuilt, mound, nx, ny });
      return true;
    }
    return false;
  };
  for (let i = 0; i < nb; i++) make(true);
  for (let i = 0; i < nw; i++) make(false);
  return nests;
}
