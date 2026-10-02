// @ts-check
// The spiders' web lines as lines: the rats run along them, fire and you find them by these.

import { webNearU } from '../../world/sway.js';

// how far a point is from a web line (anchor to anchor, sagged and bent as drawn: world/sway.js),
// and where on it is closest
/** @param {WebLine} L @param {number} x @param {number} y */
export const webNear = (L, x, y) => webNearU(L, x, y);
/** @param {WebLine} L @param {number} x @param {number} y */
export const webDist = (L, x, y) => { const q = webNear(L, x, y); return Math.hypot(q.x - x, q.y - y); };
