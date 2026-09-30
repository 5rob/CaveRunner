// The jellyfish's Game side (REFACTOR.md D20; its brain, jellyStep, its sprite, drawJelly, and
// its palette are in creatures/jelly.js): its part of the enemy loop (jellyMove: the swim, the
// tentacles' sting, the spit) and where it may swim (natural).

import { SFX } from '../../audio/sfx.js';
import { PH, PW } from '../../core/consts.js';
import { hexRgb } from '../../core/util.js';
import { jellyPal, jellyStep, tentacleTouch } from '../../creatures/jelly.js';
import { kr } from '../../dev/knobs.js';
import { builtAt } from '../../world/zones.js';
import { puffSpores } from '../systems/ambience.js';
import { burst } from '../systems/particles.js';
import { hurt } from '../systems/player.js';
import { lineOfSight, solidCell } from '../systems/terrain.js';

export const natural = (W, x, y) => !builtAt(W.zone, x, y);      // jellies keep to the natural zones

// A jelly's frame (ACTS): the swim, the sting, the spit; the shared part of the loop runs
// after it
export function jellyMove(W, G, e, C) {
  const { dt, dist, sees, hunting, pcx, pcy } = C, k = e.k;
  // swims in pulses (jellyStep); spits when its head is lined up on you, in range
  const cold = e.chill && e.chill < 1 ? e.chill : 1;
  if (jellyStep(e, { solidCell: (cx, cy) => solidCell(W, cx, cy), hunting, goal: { x: pcx, y: pcy }, rnd: Math.random,
    speedMul: cold, rangeMul: sees, stay: W.zone ? ((x, y) => natural(W, x, y)) : null }, dt) === 'pulse') puffSpores(W, e);
  const S = e.je;
  // brush its tentacles and you're stung, hunting or not (same sting knobs as the bell)
  if (!W.p.dead && e.touch <= 0 && dist < 180) {
    const t = tentacleTouch(S, W.p.x, W.p.y, W.p.x + PW, W.p.y + PH);
    if (t) {
      hurt(W, G, Math.round(kr('jeBite'))); e.touch = kr('jeBiteCd');
      burst(W, t.x, t.y, 5, jellyPal(S.u.col).tent);
      SFX.creature(k, 'bite', t.x, t.y);
    }
  }
  if (hunting && S.inRange && S.aimed && e.cd <= 0) {
    e.cd = 0.25;                                // no clear line: look again shortly
    const hx = e.x + Math.cos(S.hd) * e.r * 0.9, hy = e.y + Math.sin(S.hd) * e.r * 0.9;
    if (lineOfSight(W, hx, hy, pcx, pcy)) {
      e.cd = kr('jeShotCd');
      const a = Math.atan2(pcy - hy, pcx - hx) + (Math.random() * 2 - 1) * kr('jeSpread') * Math.PI / 180;
      const v = kr('jeShotSpd'), P = jellyPal(S.u.col);
      W.enemyShots.push({ x: hx, y: hy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 3,
        col: P.spit, edge: P.spitEdge, shine: P.spitShine, dripCol: P.drip, dripCol2: P.drip2, glow: hexRgb(P.glow),
        dmg: Math.round(kr('jeShotDmg')), size: kr('jeShotSize'), goo: 1,
        drip: kr('jeDrip'), da: 0, dripG: kr('jeDripG'), splat: Math.round(kr('jeSplat')), splatV: kr('jeSplatSpd') });
      SFX.creature(k, 'fire', e.x, e.y);
    }
  }
}
