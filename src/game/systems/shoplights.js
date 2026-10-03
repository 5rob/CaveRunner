// @ts-check
// A new run's dark shop (world/shoplights.js has the rules): the teleporter crackles until the
// first tubes come on, the tubes click as they stutter on, and once the whole hall is lit
// W.shopLit goes back to null (the normal, lit shop). A part of step, after stepWarp

import { SFX } from '../../audio/sfx.js';
import { PH, SHOP_Y } from '../../core/consts.js';
import { LIGHT_WAIT, LIGHT_X, lightsNew, lightsStep, sectionLevel } from '../../world/shoplights.js';

// a new run starts here: in the dark, the teleporter crackling (Game.js, a run with no save)
/** @param {World} W */
export function shopDarkStart(W) {
  W.shopLit = lightsNew(W.time);
  W.padZap[1] = W.time;
}

/** @param {World} W @param {StepFrame} F */
export function stepLights(W, F) {
  const L = W.shopLit;
  if (!L) return;
  const { dt, pcx } = F, t = W.time;
  // the way in crackles the whole time it's dark (render/pads.js), with a fizz of sparks now and then
  if (t - L.start < LIGHT_WAIT) {
    W.padZap[1] = t - 0.2;
    if (t >= L.zap) { SFX.fx('sparks', W.arrival.x, W.arrival.y); L.zap = t + 0.18 + 0.3 * ((t * 7.3) % 1); }
  }
  const { done } = lightsStep(L, t, pcx, W.p.y + PH > SHOP_Y);
  // a click each time a starting tube flickers on
  for (let i = 0; i < LIGHT_X.length; i++) {
    if (L.on[i] < 0 || t - L.on[i] > 2) continue;
    if (sectionLevel(L, i, t) > 0.3 && !(sectionLevel(L, i, t - dt) > 0.3)) SFX.fx('tube', LIGHT_X[i], SHOP_Y + 4);
  }
  if (done) W.shopLit = null;
}
