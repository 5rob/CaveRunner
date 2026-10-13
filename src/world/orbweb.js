// @ts-check
// Procedural orb webs (owner, after v1.0.74: "the webs are single straight lines; try procedural placements"), the way a
// garden spider builds one: from a hub in open air, spokes out to the rock round it (each a ray to the first solid point,
// so the web fits the cave it's in), then the capture spiral wound outward across the spokes, a thread from spoke to
// spoke a little further out each step, stopping short of each spoke's end. Pure: give it what's solid; it gives back
// threads (OrbThread). Too little rock round the hub to hold it (too few spokes, or more than one side open wider than
// ORB_GAP, or one wider than ORB_FRAME): null. One open side gets a frame thread across it, its spokes ending on that.
// The title scene (art/titlescene.js, the webs zone) turns each thread into a web line, so they burn, cut, sag and
// hold as the straight ones do.
// (the owner's reference: placement by raycasting from candidate points, valid with enough hits in reach; the hub at the
// anchors' centre, pulled a little down by gravity; spokes, an Archimedean spiral r = a + b θ, sag and a little noise)
// orbPlace tries a few spots and keeps the one held on most sides (corners and tight gaps win), its hub re-centred.

/** @typedef {{ ax: number, ay: number, bx: number, by: number, spiral: boolean, ain: { x: number, y: number } | null, bin?: { x: number, y: number } }} OrbThread */
// ax, ay: a spoke's end on the rock (ain: just inside it; none: it ends on a frame thread), bx, by the hub; a spiral thread:
// one spoke to the next; a frame thread: anchor to anchor across an open side (bin: inside the rock at its far end)

export const ORB_GAP = 2.1;            // the widest open side a web can have between two spokes (radians, ~120°)
export const ORB_FRAME = 2.9;          // an open side up to this wide (radians, ~165°) gets a frame thread across it
export const ORB_DROP = 0.12;          // the hub's pull down from the anchors' centre (× the web's mean spoke)

/**
 * @param {(x: number, y: number) => boolean} solid rock at a point
 * @param {number} cx @param {number} cy the hub (open air)
 * @param {() => number} R random 0..1
 * @param {{ spokes?: number, maxR?: number, minR?: number, gap?: number, hole?: number }} [o] spokes tried; a spoke
 *   reaches at most maxR, at least minR (shorter: dropped); gap: the spiral's spacing; hole: the open middle's radius
 * @returns {OrbThread[] | null}
 */
export function orbWeb(solid, cx, cy, R, o = {}) {
  const N = o.spokes ?? 9, maxR = o.maxR ?? 50, minR = o.minR ?? 8, gap = o.gap ?? 5, hole = o.hole ?? 4;
  if (solid(cx, cy)) return null;
  const a0 = R() * Math.PI * 2;
  /** @type {{ a: number, dx: number, dy: number, len: number, hit: boolean, frame?: boolean }[]} */
  const ray = [];
  for (let i = 0; i < N; i++) {
    const a = a0 + (i + (R() - 0.5) * 0.45) * Math.PI * 2 / N, dx = Math.cos(a), dy = Math.sin(a);
    let d = 1;
    while (d <= maxR && !solid(cx + dx * d, cy + dy * d)) d += 1;
    if (d <= maxR && d < minR) return null;   // rock too near the hub: too cramped
    ray.push({ a, dx, dy, len: d - 1, hit: d <= maxR });   // (its end: the last open point the ray found)
  }
  // the open sides: runs of rays with no rock in reach between two that hit
  const hits = ray.filter(r => r.hit);
  if (hits.length < 3) return null;
  /** @type {OrbThread[]} */
  const frames = [];
  for (let k = 0; k < hits.length; k++) {
    const A = hits[k], B = hits[(k + 1) % hits.length], g = (k + 1 < hits.length ? B.a : B.a + Math.PI * 2) - A.a;
    if (g <= ORB_GAP) continue;
    // (as a real orb web) one open side: a frame thread strung from anchor to anchor across it; the spokes there end on
    // it. Only if the hub's on the near side of it (the side open less than a half turn), and the frame's in the open
    if (frames.length || g > ORB_FRAME) return null;
    const ax = cx + A.dx * A.len, ay = cy + A.dy * A.len, bx = cx + B.dx * B.len, by = cy + B.dy * B.len;
    if (solid((ax + bx) / 2, (ay + by) / 2)) return null;
    frames.push({ ax, ay, bx, by, spiral: false, ain: { x: cx + A.dx * (A.len + 2), y: cy + A.dy * (A.len + 2) }, bin: { x: cx + B.dx * (B.len + 2), y: cy + B.dy * (B.len + 2) } });
    const ex = bx - ax, ey = by - ay;
    for (const r of ray) {
      if (r.hit) continue;
      const u = ((r.a - A.a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (u <= 0 || u >= g) continue;
      // the ray (cx, cy) + t (dx, dy) meets the frame (ax, ay) + s (ex, ey)
      const den = r.dx * ey - r.dy * ex;
      if (Math.abs(den) < 1e-6) continue;
      const t = ((ax - cx) * ey - (ay - cy) * ex) / den;
      if (t >= minR && t <= maxR * 1.6) { r.len = t; r.hit = true; r.frame = true; }
    }
  }
  const sp = ray.filter(r => r.hit);
  if (sp.length < 5) return null;
  /** @type {OrbThread[]} */
  const out = sp.map(s => ({ ax: cx + s.dx * s.len, ay: cy + s.dy * s.len, bx: cx, by: cy, spiral: false,
    ain: s.frame ? null : { x: cx + s.dx * (s.len + 2), y: cy + s.dy * (s.len + 2) } }));
  out.push(...frames);
  // the spiral: on spoke i of turn k, radius hole + gap × (k + i / n) (a touch of wobble); a thread to the next spoke
  // where both ends are well inside their spokes and its middle is in the open
  const n = sp.length, jit = () => (R() - 0.5) * gap * 0.25;
  const far = Math.max(...sp.map(s => s.len));
  /** @param {number} k @param {number} i */
  const at = (k, i) => { const s = sp[i], r = hole + gap * (k + i / n) + jit(); return { x: cx + s.dx * r, y: cy + s.dy * r, ok: r <= s.len * 0.9 }; };
  let p = at(0, 0);
  for (let k = 0; hole + gap * k < far; k++) for (let i = 0; i < n; i++) {
    const q = i + 1 < n ? at(k, i + 1) : at(k + 1, 0);
    if (p.ok && q.ok && !solid((p.x + q.x) / 2, (p.y + q.y) / 2)) out.push({ ax: p.x, ay: p.y, bx: q.x, by: q.y, spiral: true, ain: null });
    p = q;
  }
  return out;
}

// the web for a spot: rays from candidate (cx, cy) find its anchors; the hub moves to their centre (ORB_DROP lower) and the
// web is spun from there. tries spots round (cx, cy) within spread; the one with the most spokes, the shortest
// the tie-break, wins. null: none held
/**
 * @param {(x: number, y: number) => boolean} solid @param {number} cx @param {number} cy @param {() => number} R
 * @param {{ spokes?: number, maxR?: number, minR?: number, gap?: number, hole?: number, tries?: number, spread?: number }} [o]
 * @returns {OrbThread[] | null}
 */
export function orbPlace(solid, cx, cy, R, o = {}) {
  const tries = o.tries ?? 4, spread = o.spread ?? 20;
  /** @type {{ W: OrbThread[], n: number, len: number } | null} */
  let best = null;
  for (let t = 0; t < tries; t++) {
    const x = cx + (t ? (R() - 0.5) * 2 * spread : 0), y = cy + (t ? (R() - 0.5) * 2 * spread : 0);
    const W0 = orbWeb(solid, x, y, R, o);
    if (!W0) continue;
    const sp = W0.filter(s => !s.spiral), n = sp.length;
    const mx = sp.reduce((a, s) => a + s.ax, 0) / n, my = sp.reduce((a, s) => a + s.ay, 0) / n;
    const len = sp.reduce((a, s) => a + Math.hypot(s.ax - x, s.ay - y), 0) / n;
    const W = orbWeb(solid, mx, my + len * ORB_DROP, R, o) || W0;
    const m = W.filter(s => !s.spiral).length;
    if (!best || m > best.n || (m === best.n && len < best.len)) best = { W, n: m, len };
  }
  return best ? best.W : null;
}

// which of an orb web's threads still hold (owner, after v1.0.76: "full webs suspended on nothing when players break
// the main lines"). A frame holds while the rock at both its ends does; a spoke while its rock does, or the held frame
// it ends on; the hub while ORB_HUB spokes hold; a spiral thread while both its ends sit on held spokes. The hub gone:
// each spoke still on its rock hangs from there ('hang'); the rest comes down ('fall')
export const ORB_HUB = 3;

/** @typedef {{ ax: number, ay: number, bx: number, by: number, sp?: boolean, fr?: boolean }} OrbLeft */
/**
 * @param {OrbLeft[]} T the web's threads left (a spoke: a on the rock or a frame, b the hub; a frame: anchor to anchor;
 *   a spiral thread: spoke to spoke)
 * @param {(i: number) => boolean} rock thread i's rock still there (a spoke's end; both a frame's ends)
 * @returns {('keep' | 'hang' | 'fall')[]}
 */
export function orbHeld(T, rock) {
  /** @param {number} x @param {number} y @param {OrbLeft} L */
  const onSeg = (x, y, L) => {
    const vx = L.bx - L.ax, vy = L.by - L.ay, ll = vx * vx + vy * vy || 1, u = Math.max(0, Math.min(1, ((x - L.ax) * vx + (y - L.ay) * vy) / ll));
    return Math.hypot(L.ax + vx * u - x, L.ay + vy * u - y) < 1;
  };
  const idx = T.map((_, i) => i);
  const frames = idx.filter(i => T[i].fr && rock(i)), spokes = idx.filter(i => !T[i].sp && !T[i].fr);
  const ok = spokes.filter(i => rock(i) || frames.some(f => onSeg(T[i].ax, T[i].ay, T[f])));
  const hub = ok.length >= ORB_HUB, held = hub ? ok.map(i => T[i]) : [];
  return T.map((L, i) => {
    if (L.fr) return frames.includes(i) ? 'keep' : 'fall';
    if (!L.sp) return hub && ok.includes(i) ? 'keep' : rock(i) ? 'hang' : 'fall';
    return held.some(s => onSeg(L.ax, L.ay, s)) && held.some(s => onSeg(L.bx, L.by, s)) ? 'keep' : 'fall';
  });
}
