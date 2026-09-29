// The rat nest's Game side (REFACTOR.md D20; its sprite, drawNest, is in creatures/rat.js):
// its frame in the enemy loop (letting rats out) and its death (the gold shower).

import { SFX } from '../../audio/sfx.js';
import { kr } from '../../dev/knobs.js';
import { spawnRat } from '../systems/rats.js';

// A nest's frame: it never moves, and nothing after its move runs for it
export function nestMove(W, G, e, C) {
  const { dt, dist } = C;
  // lets a rat out now and then, while it has fewer than its max alive; only while
  // you're near enough for it to matter
  const N = e.nest;
  if (!N.max) { N.max = Math.round(kr('raMax')); N.wake = kr('raWake'); }
  if (dist < N.wake && (N.t -= dt) <= 0) {
    N.t = kr('raSpawn');
    let out = 0;
    for (const r of W.enemies) if (r.home === e) out++;
    if (out < N.max) spawnRat(W, e);
  }
  e.chill = 1; e.ty = e.y;
  return true;
}

// A nest dies (damageEnemy, once it's out of the list): no ordinary coin
export function nestDie(W, e) {
  // a nest: its own gold and everything its rats brought home, in a little shower
  const all = Math.round(kr('raNestGold') * W.pb.gold) + e.nest.stash;
  const n = Math.max(1, Math.min(14, Math.ceil(all / 8)));
  for (let k = 0; k < n; k++)
    W.coins.push({ x: e.x + (Math.random() - 0.5) * 8, y: e.y, amount: Math.floor(all / n) + (k < all % n ? 1 : 0),
      t: Math.random() * 6.28, vx: (Math.random() - 0.5) * 100, vy: -80 - Math.random() * 80 });
  SFX.fx('coinland', e.x, e.y);
  return true;
}
