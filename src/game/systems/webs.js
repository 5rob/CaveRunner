// @ts-check
// The spiders' web lines as lines: the rats run along them, fire and you find them by these.

// how far a point is from a web line (anchor to anchor, as drawn), and where on it is closest
/** @param {WebLine} L @param {number} x @param {number} y */
export const webNear = (L, x, y) => {
  const vx = L.b0x - L.a0x, vy = L.b0y - L.a0y, ll = vx * vx + vy * vy || 1;
  const u = Math.max(0, Math.min(1, ((x - L.a0x) * vx + (y - L.a0y) * vy) / ll));
  return { x: L.a0x + vx * u, y: L.a0y + vy * u };
};
/** @param {WebLine} L @param {number} x @param {number} y */
export const webDist = (L, x, y) => { const q = webNear(L, x, y); return Math.hypot(q.x - x, q.y - y); };
