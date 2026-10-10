// @ts-check
// CaveRunner Auto's level, painted (auto/level.js steps it; titledraw.js calls these when S.lvl): the start pad and
// the exit pad on the floor (hubdraw.js's pad, its light and its glow: the charge, flash and lightning as the team
// teleports in on the start pad). Screen x (the cave scrolls under them).

import { hubCharge } from '../../auto/hub.js';
import { levelDeathPrompt, levelPads, levelState } from '../../auto/level.js';
import { deathHelmet } from '../../auto/death.js';
import { drawRagdoll, glowAt, pixelSprite } from '../../art/sprites.js';
import { drawHint, drawHubPad, padGlow } from './hubdraw.js';
import { chestInRange } from '../../auto/chests.js';
import { TITLE_VW } from '../../art/titlescene.js';

// Before the dark: the pads, the chests (stage 11)
/** @param {CanvasRenderingContext2D} ctx @param {import('../../art/titlescene.js').TitleScene} S */
export function levelBack(ctx, S) {
  for (const p of levelPads(S)) drawHubPad(ctx, p.x, p.fy, S.t + (p.id === 'enter' ? 0 : 5));
  const L = levelState(S);
  if (L) for (const c of L.chests) {
    const x = c.x - S.scroll;
    if (x > -20 && x < TITLE_VW + 20 && c.y != null) drawChest(ctx, x, c.y, c.open ? S.t - (c.openT || 0) : -1);
  }
  levelRags(ctx, S);
}

// (feedback round 2) the fallen: the old game's ragdoll (auto/death.js), in world x, on a 1-unit pixel grid riding its hip
// (render/actors.js drawPlayer's dead branch), each in its player's colour
/** @param {CanvasRenderingContext2D} ctx @param {import('../../art/titlescene.js').TitleScene} S */
function levelRags(ctx, S) {
  for (const r of S.runners) {
    const R = r.rag;
    if (!r.out || !R) continue;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const j of R.joints) { x0 = Math.min(x0, j.x); y0 = Math.min(y0, j.y); x1 = Math.max(x1, j.x); y1 = Math.max(y1, j.y); }
    if (x1 - S.scroll < -20 || x0 - S.scroll > TITLE_VW + 20) continue;
    const hip = R.joints[2], ox = hip.x - Math.ceil(hip.x - x0 + 9), oy = hip.y - Math.ceil(hip.y - y0 + 9);
    pixelSprite(ctx, ox - S.scroll, oy, x1 + 9 - ox, y1 + 9 - oy, 1, false, c => { c.translate(-S.scroll, 0); drawRagdoll(c, R, r.col); });
  }
}

// stage 11: a chest, pixel art, its bottom middle at (x, y): a wooden box with iron bands and a gold lock. age: since it
// opened (-1: shut): the lid pops up and flips back on its hinge, settles open, the inside glows for a while
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} age */
export function drawChest(ctx, x, y, age) {
  const l = Math.round(x - 7), b = Math.round(y);
  /** @param {string} c @param {number} px @param {number} py @param {number} w @param {number} h */
  const R = (c, px, py, w, h) => { ctx.fillStyle = c; ctx.fillRect(l + px, b + py, w, h); };
  R('rgba(0,0,0,0.35)', -1, -1, 16, 1);                                                  // its shadow
  R('#3a2210', 0, -8, 14, 8);                                                            // the box: outline
  R('#8a5328', 1, -7, 12, 6); R('#6e3f1c', 1, -4, 12, 1); R('#a8682f', 1, -7, 12, 1);    // planks
  R('#4b4f5c', 2, -8, 1, 8); R('#4b4f5c', 11, -8, 1, 8);                                 // iron bands
  if (age < 0) {
    R('#3a2210', 0, -12, 14, 4); R('#9a5f2c', 1, -11, 12, 2); R('#b97a3a', 1, -11, 12, 1);   // the lid, shut
    R('#4b4f5c', 2, -12, 1, 4); R('#4b4f5c', 11, -12, 1, 4);
    R('#3a2210', 5, -10, 4, 4); R('#ffc93c', 6, -9, 2, 2); R('#7a5a10', 6, -8, 2, 1);        // the lock
    return;
  }
  // open: the dark inside, glowing a while; the lid popped up (0.25 s) and flipped back onto its hinge (the back edge)
  const glow = Math.max(0, 1 - age / 2.5);
  R('#1c120a', 1, -8, 12, 2);
  if (glow > 0) R('rgba(255,214,110,' + (0.8 * glow).toFixed(3) + ')', 2, -8, 10, 1);
  const pop = age < 0.25 ? Math.sin(age / 0.25 * Math.PI) * 5 : 0, ang = Math.min(1, age / 0.3) * 1.9;
  ctx.save();
  ctx.translate(l + 14, b - 8 - pop);
  ctx.rotate(ang);
  ctx.fillStyle = '#3a2210'; ctx.fillRect(-14, -4, 14, 4);
  ctx.fillStyle = '#9a5f2c'; ctx.fillRect(-13, -3, 12, 2);
  ctx.fillStyle = '#4b4f5c'; ctx.fillRect(-12, -4, 1, 4); ctx.fillRect(-3, -4, 1, 4);
  ctx.restore();
}

// What lights the pads (cut out of the dark: titledraw.js titleDark): the start pad swelling as it charges
/** @param {import('../../art/titlescene.js').TitleScene} S @param {(x: number, y: number, r: number, a: number, full?: number) => void} pool */
export function levelLight(S, pool) {
  const L = levelState(S);
  if (!L) return;
  const { ch, fl } = L.phase === 'arrive' || S.t < 3 ? hubCharge(S) : { ch: 0, fl: 0 };
  for (const p of levelPads(S)) pool(p.x, p.fy - 16, 34 + 30 * (p.id === 'enter' ? fl : 0), Math.min(1, p.id === 'enter' ? 0.35 + 0.6 * ch * ch + 0.6 * fl : 0.45), 0.2);
  for (const c of L.chests) {
    const x = c.x - S.scroll;
    if (x > -30 && x < TITLE_VW + 30 && c.y != null) pool(x, c.y - 6, c.open ? 16 : 22, c.open ? 0.25 : 0.4, 0.2);
  }
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
  // (feedback round 2) the fallen's helmet light blinking (Tap A: the teleport home), and the prompt over the last one
  for (const r of S.runners) if (r.out && r.lamp) {
    const h = deathHelmet(S, r);
    if (h) { glowAt(ctx, h.x, h.y - 1, 10, 0.7, '255,40,30'); ctx.fillStyle = '#ff3a2a'; ctx.fillRect(Math.round(h.x - 1), Math.round(h.y - 4), 2, 2); }
  }
  if (levelDeathPrompt(S)) {
    const r = S.runners[L.lastI || 0], h = deathHelmet(S, r);
    if (h) drawHint(ctx, Math.max(50, Math.min(TITLE_VW - 50, h.x)), Math.max(S.top + 20, h.y - 14), 'Tap A to Teleport back to Hub', S.t);
  }
  // stage 11: a player in range of a shut chest: "Tap A to open" over it (the hub exit's hint)
  const c = chestInRange(S);
  if (c && c.y != null) drawHint(ctx, c.x - S.scroll, c.y - 28, 'Tap A to open', S.t);
}
