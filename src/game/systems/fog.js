// The fog of war's queries (what has been seen, what a torch or loot may show on) and
// repainting the overlay mask from the reveal grid. The reveal and the bake are in draw().

import { FH, FOG_DARK, FOG_DIM, FOG_U, FW } from '../../core/consts.js';
import { clamp } from '../../core/util.js';
import { ROOM_HH, ROOM_HW } from '../../world/level.js';

// Wall torches and lanterns follow the same rule as the loot: they show once the fog
// over them has lifted (`fogLit`), and never clear it themselves — v59 let them clear
// a circle round themselves, which lit up every prize room on the map from the start.
export const fogLit = (W, x, y) => {
  const cx = clamp(Math.floor(x / FOG_U), 0, FW - 1), cy = clamp(Math.floor(y / FOG_U), 0, FH - 1);
  if (W.deepFog && W.deepFog[cy * FW + cx]) return W.seen[cy * FW + cx] > 0;   // a nest room: no soft edge
  // the fog bake's one-cell soft edge counts, so a torch shows exactly when an item there would
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = cx + dx, ny = cy + dy;
    if (nx >= 0 && ny >= 0 && nx < FW && ny < FH && W.seen[ny * FW + nx]) return true;
  }
  return false;
};
// a prize room counts as found once any of it has been in your line of sight
export const roomSeen = (W, r) => {
  for (let y = r.y - ROOM_HH; y <= r.y + ROOM_HH; y += FOG_U)
    for (let x = r.x - ROOM_HW; x <= r.x + ROOM_HW; x += FOG_U) {
      const cx = clamp(Math.floor(x / FOG_U), 0, FW - 1), cy = clamp(Math.floor(y / FOG_U), 0, FH - 1);
      if (W.seen[cy * FW + cx]) return true;
    }
  return false;
};
// Repaint the whole overlay mask from the reveal grid. FW x FH is a few thousand
// cells, and it only runs on the frames where you actually light something new.
export function paintFog(W, G) {
  const d = G.fogImg.data, dim = Math.round(255 * FOG_DIM), dark = Math.round(255 * FOG_DARK);
  for (let i = 0, k = 0; i < FW * FH; i++, k += 4) {
    d[k] = 9; d[k + 1] = 10; d[k + 2] = 14;
    d[k + 3] = W.seen[i] === 2 ? 0 : W.seen[i] ? dim : dark;
  }
}

export const seenAt = (W, x, y) => W.seen[clamp(Math.floor(y / FOG_U), 0, FH - 1) * FW + clamp(Math.floor(x / FOG_U), 0, FW - 1)] !== 0;
