// @ts-check
// drawEnemy: draws any creature by its body (e.k.body), plus the ring that warns of a
// charged shot.

import { drawAlien } from './alien.js';
import { drawBlob, drawCrawler, drawDrone, drawSkull, drawWorm } from './classic.js';
import { drawJelly } from './jelly.js';
import { drawNest, drawRat } from './rat.js';
import { drawSpider } from './spider.js';

// Whatever this enemy is, plus the ring that warns you a charged shot is coming.
/** @param {CanvasRenderingContext2D} ctx @param {Enemy} e @param {number} time */
export function drawEnemy(ctx, e, time) {
  const k = e.k, flash = e.flash > 0;
  const x = e.x, y = e.ty, r = e.r, lx = e.lx, ly = e.ly;
  if (k.body === 'alien') drawAlien(ctx, x, y, r, time, e.phase, flash, k.col, e.al);
  else if (k.body === 'spider') drawSpider(ctx, x, y, r, time, e.phase, flash, k.col, e.sp);
  else if (k.body === 'rat') drawRat(ctx, x, y, r, time, e.phase, flash, k.col, e.ra, e.carry);
  else if (k.body === 'nest') drawNest(ctx, x, y, r, time, flash, k.col, e.nest);
  else if (k.body === 'jelly') drawJelly(ctx, x, y, r, time, e.phase, flash, k.col, e.je);
  else if (k.body === 'crawler') drawCrawler(ctx, x, y, r, lx, ly, time, e.phase, flash, k.col);
  else if (k.body === 'blob') drawBlob(ctx, x, y, r, lx, ly, time, e.phase, flash, k.col);
  else if (k.body === 'skull') drawSkull(ctx, x, y, r, lx, ly, time, e.phase, flash, k.col);
  else if (k.body === 'worm') drawWorm(ctx, x, y, r, lx, ly, time, e.phase, flash, k.col);
  else drawDrone(ctx, x, y, r, lx, ly, time, e.phase, flash, k.col);
  if (e.charge > 0 && k.tele) {
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = k.col.eye;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, e.r + 4 + e.charge * 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
