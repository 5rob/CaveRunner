// @ts-check
// CaveRunner Auto: Discriminate's targets (owner, v1.0.71). Auto has no world pointer, so a held Discriminate tile opens a
// small popup of these (ui/auto/AutoScreen.js DiscrimPop); a pick sets the copy (spells/discrim.js discrimId). Each one
// drawn as the game draws it: the creature by its own sprite (creatures/draw.js drawEnemy), the gold nugget and the red
// and green crystals by drawNugget (art/sprites.js).
import { enemyFor } from '../data/creatures.js';
import { drawEnemy } from '../creatures/draw.js';
import { CRYSTAL_PAL, GREEN_PAL, drawNugget } from './sprites.js';

/** @type {{ t: DiscrimTarget, label: string }[]} */
export const DISCRIM_TARGETS = [
  { t: { kind: 'creature', id: 'rotta' }, label: 'Rats' },
  { t: { kind: 'creature', id: 'meduusa' }, label: 'Jellyfish' },
  { t: { kind: 'creature', id: 'hamahakki' }, label: 'Spiders' },
  { t: { kind: 'object', id: 'gold' }, label: 'Gold' },
  { t: { kind: 'object', id: 'red' }, label: 'Red crystals' },
  { t: { kind: 'object', id: 'green' }, label: 'Green crystals' },
];
/** is t one of the popup's targets? @param {DiscrimTarget | null | undefined} t */
export const isAutoTarget = t => !!t && DISCRIM_TARGETS.some(d => d.t.kind === t.kind && d.t.id === t.id);

// one target's picture, filling a px × px square of ctx (already cleared) at its middle
/** @param {CanvasRenderingContext2D} ctx @param {DiscrimTarget} t @param {number} px */
export function drawTarget(ctx, t, px) {
  const c = px / 2;
  ctx.save();
  if (t.kind === 'creature') {
    const k = enemyFor(t.id, 1), s = (px * 0.36) / k.r;
    ctx.translate(c, c); ctx.scale(s, s);
    /** @type {Enemy} */
    const e = { x: 0, y: 0, ty: 0, r: k.r, phase: 0, hp: 1, hpMax: 1, cd: 0, flash: 0, lx: 1, ly: 0, hx: 0, hy: 0, tgt: null, rest: 0, k, touch: 0, charge: 0 };
    try { drawEnemy(ctx, e, 0); } catch (_) { /* a sprite that wants its brain's state: drawn as nothing */ }
  } else {
    const pal = t.id === 'red' ? CRYSTAL_PAL : t.id === 'green' ? GREEN_PAL : undefined;
    drawNugget(ctx, c, c, px * (pal ? 0.36 : 0.3), 3, 0.3, pal);
  }
  ctx.restore();
}
