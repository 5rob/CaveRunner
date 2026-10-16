// Coal Seams' timber (grem, owner 2026-10-17: "the wooden supports look too copy and paste"): the old game's timberFrame (v85,
// world/strata.js on main) brought to the Grem slice. Each set is measured off the rock where it stands: two posts on level
// ground meeting rock overhead, a cap beam along the roof between them (sloping with it), packed tight with wedges wherever
// the roof lifts away; a spot that can't take one is refused. Each set its own width, braces, rot, the odd snapped post; and a
// fallen prop lying on a floor. Pure: works in terrain cells (column c, row r) through a solid(c, r) the caller gives, and
// hands back the cells to paint, so the scene places them as it makes its columns (art/titlescene.js timberPlan).

/** @typedef {{ c0: number, c1: number, cols: Map<number, Map<number, number>>, mid: number, cap: number }} TSet */

// a small seeded random stream (so a spot always gets the same set)
/** @param {number} seed @returns {() => number} */
export function timberRng(seed) {
  let a = (Math.floor(seed * 4294967296) ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {TSet} T @param {number} c @param {number} r @param {number} m */
const put = (T, c, r, m) => {
  let col = T.cols.get(c);
  if (!col) T.cols.set(c, (col = new Map()));
  col.set(r, m);
};

// A set between columns xa and xb (posts' left edges), y a row in the open air between them. o: L, D the lit and shaded timber;
// minH, maxH the shortest and tallest post (rows); gapMax the most open rows between the roof and the cap; fy (optional) the
// floor row the posts must stand on; rot a post's chance of a rotten patch; broken a set's chance of a snapped post.
// → the set's cells, or null where the rock won't take one
/** @param {(c: number, r: number) => boolean} solid @param {number} xa @param {number} xb @param {number} y @param {() => number} R
 * @param {{ L: number, D: number, minH: number, maxH: number, gapMax: number, fy?: number, rot: number, broken: number }} o
 * @returns {TSet | null} */
export function timberSet(solid, xa, xb, y, R, o) {
  const down = (/** @type {number} */ x) => { let k = y; while (k < y + 80 && !solid(x, k + 1)) k++; return solid(x, k + 1) ? k + 1 : -1; };
  const up = (/** @type {number} */ x) => { let k = y; while (k > y - 80 && !solid(x, k - 1)) k--; return solid(x, k - 1) ? k - 1 : -1; };
  if (xb - xa < 8 || solid(xa, y) || solid(xb, y)) return null;
  const fa = down(xa), fa2 = down(xa + 1), fb = down(xb), fb2 = down(xb - 1);
  const ca = up(xa), ca2 = up(xa + 1), cb = up(xb), cb2 = up(xb - 1);
  if ([fa, fa2, fb, fb2, ca, ca2, cb, cb2].some(v => v < 0)) return null;
  if (Math.abs(fa - fa2) > 1 || Math.abs(fb - fb2) > 1) return null;          // not on a lip
  if (o.fy != null && (Math.abs(fa - o.fy) > 3 || Math.abs(fb - o.fy) > 3)) return null;
  const topA = Math.max(ca, ca2) + 1, topB = Math.max(cb, cb2) + 1;          // first open row under the roof
  const botA = Math.min(fa, fa2), botB = Math.min(fb, fb2);
  const hA = botA - topA, hB = botB - topB;
  if (Math.min(hA, hB) < o.minH || Math.max(hA, hB) > o.maxH) return null;
  const capY = (/** @type {number} */ x) => Math.round(topA + (topB - topA) * (Math.max(xa, Math.min(xb, x)) - xa) / (xb - xa));
  /** @type {number[]} */
  const roof = [];
  let loose = 0;
  for (let x = xa; x <= xb; x++) {
    if (solid(x, y)) return null;                     // a pillar between the posts
    const r = up(x);
    if (r < 0) return null;
    const gap = capY(x) - (r + 1);                    // open rows between the roof and the cap
    if (gap < -2 || gap > o.gapMax) return null;
    if (gap > 3) loose++;
    roof.push(r);
  }
  if (loose > (xb - xa + 1) * 0.3) return null;
  /** @type {TSet} */
  const T = { c0: xa - 3, c1: xb + 3, cols: new Map(), mid: Math.round((xa + xb) / 2), cap: capY((xa + xb) / 2) };
  const { L, D } = o;
  // wedges packed between the roof and the cap (every other one a little proud: blocks, not a smear)
  for (let x = xa; x <= xb; x++) for (let yy = roof[x - xa] + 1; yy < capY(x); yy++) put(T, x, yy, D);
  // the cap, two rows, running past each post (each set its own overhang)
  const ohA = 1 + Math.floor(R() * 3), ohB = 1 + Math.floor(R() * 3);
  for (let x = xa - ohA; x <= xb + ohB; x++) { const cy = capY(x); put(T, x, cy, L); put(T, x, cy + 1, D); }
  // the posts, lit on the left, a footing block under each; a rotten patch now and then; one snapped in a broken set
  const snap = R() < o.broken ? (R() < 0.5 ? 0 : 1) : -1;
  [[xa, topA, botA], [xb - 1, topB, botB]].forEach(([px, top, bot], i) => {
    const rot = R() < o.rot ? top + 4 + Math.floor(R() * Math.max(1, bot - top - 8)) : -99;
    const brk = i === snap ? top + 3 + Math.floor(R() * Math.max(1, bot - top - 8)) : -99;
    for (let yy = top + 2; yy < bot; yy++) {
      if (Math.abs(yy - brk) < 2) continue;           // the break: a gap, the stub above it kinked over
      const kink = brk > 0 && yy < brk ? (i ? -1 : 1) : 0;
      const dk = Math.abs(yy - rot) < 2;
      put(T, px + kink, yy, dk ? D : L);
      put(T, px + 1 + kink, yy, D);
    }
    if (R() < 0.75) for (let dx = -1; dx <= 2; dx++) put(T, px + dx, bot - 1, D);
  });
  // braces: knee braces from the posts up under the cap (both, one or neither, each set its own length), a long diagonal
  // across a tall set, a tie across its middle
  const h = Math.min(hA, hB), kb = R(), kl = 3 + Math.floor(R() * 4);
  if (h >= 12) for (let k = 0; k <= kl; k++) {
    if (kb < 0.7 && snap !== 0) put(T, xa + 2 + k, capY(xa + 2 + k) + 2 + (kl - k), D);
    if ((kb < 0.45 || (kb >= 0.7 && kb < 0.85)) && snap !== 1) put(T, xb - 2 - k, capY(xb - 2 - k) + 2 + (kl - k), D);
  }
  if (h >= 22 && snap < 0) {
    const tie = R();
    if (tie < 0.35) {                                 // a diagonal from one post's foot to the other's top
      const lr = R() < 0.5, x0 = xa + 2, x1 = xb - 1, y0 = lr ? botA - 2 : capY(xa) + 2, y1 = lr ? capY(xb) + 2 : botB - 2;
      for (let x = x0; x < x1; x++) put(T, x, Math.round(y0 + (y1 - y0) * (x - x0) / (x1 - x0)), D);
    } else if (tie < 0.6) {                           // a tie across the middle
      const ty = Math.round((capY(xa) + botA) / 2 + (R() - 0.5) * 4);
      for (let x = xa + 2; x < xb - 1; x++) put(T, x, ty, D);
    }
  }
  return T;
}

// a fallen prop lying on the floor from column x0, len columns long: two rows, following the floor (solid, scanned down from
// row y). → its cells, or null where the floor isn't there
/** @param {(c: number, r: number) => boolean} solid @param {number} x0 @param {number} len @param {number} y @param {{ L: number, D: number }} o
 * @returns {TSet | null} */
export function timberFallen(solid, x0, len, y, o) {
  /** @type {TSet} */
  const T = { c0: x0, c1: x0 + len, cols: new Map(), mid: -1, cap: 0 };
  let last = -1;
  for (let k = 0; k < len; k++) {
    let r = y;
    while (r < y + 12 && !solid(x0 + k, r + 1)) r++;
    if (!solid(x0 + k, r + 1) || solid(x0 + k, r) || (last >= 0 && Math.abs(r - last) > 1)) return null;
    last = r;
    put(T, x0 + k, r, o.D);
    if (k > 1 && k < len - 2) put(T, x0 + k, r - 1, o.L);
  }
  return T;
}

// (Coal Seams, C3) a lean-to: from a foot at column x, row y (open, rock under it), up along a slant (lean: columns across per
// row up, ±) till it meets rock; w columns wide (2: a prop, lit on its left; 5: a ladder's two rails and rungs every 3 rows).
// Not between rows hMin and hMax long, its foot not on rock, or run into rock on the way: null. Pure
/** @param {(c: number, r: number) => boolean} solid @param {number} x @param {number} y @param {number} lean @param {number} w
 * @param {number} hMin @param {number} hMax @param {{ L: number, D: number }} o @returns {TSet | null} */
export function timberSlant(solid, x, y, lean, w, hMin, hMax, o) {
  const ladder = w > 2;
  if (!solid(x, y + 1) || !solid(x + w - 1, y + 1) || solid(x, y) || solid(x + w - 1, y)) return null;
  /** @type {TSet} */
  const T = { c0: x, c1: x, cols: new Map(), mid: -1, cap: 0 };
  for (let k = 0; k <= hMax; k++) {
    const r = y - k, xl = x + Math.round(k * lean);
    let hit = false;
    for (let d = 0; d < w; d++) if (solid(xl + d, r)) hit = true;
    if (hit) {
      if (k < hMin) return null;
      if (!ladder && !solid(xl, r) && !solid(xl + 1, r)) return null;   // (a prop: its head against the rock)
      return T;
    }
    T.c0 = Math.min(T.c0, xl); T.c1 = Math.max(T.c1, xl + w - 1);
    if (ladder) {
      put(T, xl, r, o.L); put(T, xl + w - 1, r, o.D);
      if (k % 3 === 2) for (let d = 1; d < w - 1; d++) put(T, xl + d, r, o.D);
    } else { put(T, xl, r, o.L); put(T, xl + 1, r, o.D); }
  }
  return null;
}
