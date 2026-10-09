// @ts-check
// CaveRunner Auto's level, painted (auto/level.js steps it; titledraw.js calls these when S.lvl): the start pad and
// the exit pad on the floor (hubdraw.js's pad, its light and its glow: the charge, flash and lightning as the team
// teleports in on the start pad). Screen x (the cave scrolls under them).

import { hubCharge } from '../../auto/hub.js';
import { levelPads, levelState } from '../../auto/level.js';
import { drawHubPad, padGlow } from './hubdraw.js';

// Before the dark: the pads
/** @param {CanvasRenderingContext2D} ctx @param {import('../../art/titlescene.js').TitleScene} S */
export function levelBack(ctx, S) {
  for (const p of levelPads(S)) drawHubPad(ctx, p.x, p.fy, S.t + (p.id === 'enter' ? 0 : 5));
}

// What lights the pads (cut out of the dark: titledraw.js titleDark): the start pad swelling as it charges
/** @param {import('../../art/titlescene.js').TitleScene} S @param {(x: number, y: number, r: number, a: number, full?: number) => void} pool */
export function levelLight(S, pool) {
  const L = levelState(S);
  if (!L) return;
  const { ch, fl } = L.phase === 'arrive' || S.t < 3 ? hubCharge(S) : { ch: 0, fl: 0 };
  for (const p of levelPads(S)) pool(p.x, p.fy - 16, 34 + 30 * (p.id === 'enter' ? fl : 0), Math.min(1, p.id === 'enter' ? 0.35 + 0.6 * ch * ch + 0.6 * fl : 0.45), 0.2);
}

// Added light, after the dark: the pads' beams, the charge, the flash, the lightning
/** @param {CanvasRenderingContext2D} ctx @param {import('../../art/titlescene.js').TitleScene} S */
export function levelGlow(ctx, S) {
  const L = levelState(S);
  if (!L) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of levelPads(S)) {
    if (p.id === 'enter') padGlow(ctx, S, p.x, p.fy, 0, L.phase === 'arrive' || S.t < 3 ? hubCharge(S) : { ch: 0, fl: 0 }, L.zap);
    else padGlow(ctx, S, p.x, p.fy, 5, { ch: 0, fl: 0 }, -99);
  }
  ctx.restore();
}
