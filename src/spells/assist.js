// Aim Assist (the 'aimassist' mod, LIST3 #10), the pure side. With it on the held gun the right
// stick drives a pointer, like the vending menus' (ui/vendshop.js menuPointer / snapTo) but in the
// world: it travels out from your gun, snaps gently onto creatures, and the game fires at the one
// it's on (game/systems/gun.js aimAndCast). All in world units; the knobs are Dev → Aim Assist.
import { DEV } from '../dev/knobs.js';

/** does this gun carry Aim Assist? @param {Gun | null | undefined} g */
export const hasAssist = g => !!g && g.slots.includes('aimassist');

// Where the pointer is for a stick push: out from the gun along the stick's direction, the push's
// 0..1 mapped onto 0..(the distance to the view's furthest corner × DEV.aaReach), held inside the view
/** @param {number} gx @param {number} gy the gun @param {number} nx @param {number} ny @param {number} mag the stick
 *  @param {{ x: number, y: number, w: number, h: number }} view @returns {Pt} */
export function assistPointer(gx, gy, nx, ny, mag, view) {
  const { x, y, w, h } = view;
  const far = Math.max(Math.hypot(gx - x, gy - y), Math.hypot(x + w - gx, gy - y),
    Math.hypot(gx - x, y + h - gy), Math.hypot(x + w - gx, y + h - gy));
  const d = Math.min(1, mag) * far * DEV.aaReach;
  return { x: Math.max(x, Math.min(x + w, gx + nx * d)), y: Math.max(y, Math.min(y + h, gy + ny * d)) };
}

// The snap: the creature (one `sees` lets through) nearest the pointer, by distance from its edge,
// within DEV.aaSnapR pulls the point towards its middle (up to DEV.aaPull of the way, more the closer);
// it's the one the pointer is ON within DEV.aaHit, and the one it was already on (`held`) stays on out
// to DEV.aaHold × that, so a jittery thumb doesn't drop it.
/** @template {{ x: number, ty: number, r: number }} E
 *  @param {Pt} p @param {E[]} list @param {(e: E) => boolean} sees @param {E | null} [held]
 *  @returns {{ x: number, y: number, on: E | null }} */
export function assistSnap(p, list, sees, held) {
  /** @type {E | null} */
  let best = null;
  let bd = Infinity;
  for (const e of list) {
    const d = Math.max(0, Math.hypot(e.x - p.x, e.ty - p.y) - (e.r || 0));
    if (d < bd && d <= Math.max(DEV.aaSnapR, DEV.aaHit * DEV.aaHold) && sees(e)) { bd = d; best = e; }
  }
  if (held && list.includes(held)) {
    const hd = Math.max(0, Math.hypot(held.x - p.x, held.ty - p.y) - (held.r || 0));
    if (hd <= DEV.aaHit * DEV.aaHold && sees(held)) { best = held; bd = hd; }
  }
  if (!best) return { x: p.x, y: p.y, on: null };
  const R = DEV.aaSnapR, k = R > 0 && bd <= R ? DEV.aaPull * (1 - bd / R) : 0;
  const on = bd <= DEV.aaHit || (best === held && bd <= DEV.aaHit * DEV.aaHold) ? best : null;
  return { x: p.x + (best.x - p.x) * k, y: p.y + (best.ty - p.y) * k, on };
}
