// The creatures: shooting at you, and taking damage (a kill drops its gold; a nest showers
// what its rats brought home).

import { SFX } from '../../audio/sfx.js';
import { jcol, kr } from '../../dev/knobs.js';
import { burst } from './particles.js';
import { lineOfSight } from './terrain.js';

// one pull of an enemy's trigger: aimed at the player, and a shotgun type throws
// its pellets in a cone. Refuses the shot if the player has broken line of sight
// since it decided to take it.
export function fireEnemyShot(W, e, tx, ty) {
  const k = e.k;
  if (!lineOfSight(W, e.x, e.ty, tx, ty)) return;
  const base = Math.atan2(ty - e.ty, tx - e.x);
  SFX.creature(k, 'fire', e.x, e.ty);
  for (let s = 0; s < k.shots; s++) {
    const cone = k.shots > 1 ? (s - (k.shots - 1) / 2) * 0.15 : 0;
    const a = base + cone + (Math.random() - 0.5) * 0.22;
    W.enemyShots.push({ x: e.x + Math.cos(a) * (e.r + 4), y: e.ty + Math.sin(a) * (e.r + 4),
      vx: Math.cos(a) * k.bspd, vy: Math.sin(a) * k.bspd, life: 2.5,
      col: k.col.a, dmg: k.dmg, size: k.body === 'blob' ? 4 : 3, fire: k.fire });
  }
}
export function damageEnemy(W, j, dmg) {
  const e = W.enemies[j];
  e.hp -= dmg; e.flash = 0.08;
  if (e.k.kp) e.aggro = true;          // hurt a spider or a jelly and it comes for you
  if (e.hp > 0) { if (dmg >= 0.5) SFX.creature(e.k, 'hurt', e.x, e.ty); return; }
  burst(W, e.x, e.ty, 16, e.je ? jcol('jeColBody', e.je.u.col) : e.k.col.a);
  SFX.creature(e.k, 'die', e.x, e.ty);
  W.enemies.splice(j, 1);
  e.dead = true;                        // its rats find out they've no home to go to
  if (e.nest) {
    // a nest: its own gold and everything its rats brought home, in a little shower
    const all = Math.round(kr('raNestGold') * W.pb.gold) + e.nest.stash;
    const n = Math.max(1, Math.min(14, Math.ceil(all / 8)));
    for (let k = 0; k < n; k++)
      W.coins.push({ x: e.x + (Math.random() - 0.5) * 8, y: e.y, amount: Math.floor(all / n) + (k < all % n ? 1 : 0),
        t: Math.random() * 6.28, vx: (Math.random() - 0.5) * 100, vy: -80 - Math.random() * 80 });
    SFX.fx('coinland', e.x, e.y);
    return;
  }
  W.coins.push({ x: e.x, y: e.ty,
    amount: Math.round((e.k.gold + Math.floor(Math.random() * 3)) * W.pb.gold),
    t: Math.random() * 6.28, vy: -60 - Math.random() * 40 });
  // a rat drops what it was carrying home
  if (e.carry > 0) W.coins.push({ x: e.x, y: e.ty, amount: e.carry, t: Math.random() * 6.28,
    vx: (Math.random() - 0.5) * 60, vy: -90 - Math.random() * 40 });
}
