// @ts-check
// A new run's dark shop (world/shoplights.js has the rules): the teleporter crackles until the
// first tubes come on, the tubes click as they stutter on, and once the whole hall is lit
// W.shopLit goes back to null (the normal, lit shop). A part of step, after stepWarp.
// v0.0.144: before you're in, the teleporter charges for ARRIVE_T (you're not there yet: held, unseen,
// no torch; render/pads.js draws the charge), then you come through in a flash of lightning (stepIntro).

import { SFX } from '../../audio/sfx.js';
import { PH, SHOP_Y } from '../../core/consts.js';
import { guideNew } from '../../world/guide.js';
import { ARRIVE_T, LIGHT_WAIT, LIGHT_X, lightsNew, lightsStep, sectionLevel } from '../../world/shoplights.js';
import { burst } from './particles.js';

// a new run starts here: in the dark, the teleporter crackling, the guide waiting down the hall
// (Game.js, a run with no save; game/systems/guide.js)
/** @param {World} W */
export function shopDarkStart(W) {
  W.shopLit = lightsNew(W.time);
  W.padZap[1] = W.time;
  W.guide = guideNew();
  W.intro = { start: W.time, done: false };
  SFX.fx('padCharge', W.arrival.x, W.arrival.y);
}

// you're still on your way in: the teleporter is charging (no you, no torch, no moving)
/** @param {World} W */
export const introHeld = W => !!W.intro && !W.intro.done;

// The charge, then you: at ARRIVE_T a flash, a storm of bolts off the pad (padZap) and sparks, and
// you're standing on it. A part of step, before movePlayer (which it skips while you're held)
/** @param {World} W */
export function stepIntro(W) {
  const I = W.intro;
  if (!I) return;
  const t = W.time - I.start;
  if (!I.done && t >= ARRIVE_T) {
    I.done = true;
    W.p.x = W.start.x; W.p.y = W.start.y; W.p.vx = W.p.vy = 0;
    W.padZap[1] = W.time;
    const x = W.arrival.x, y = W.start.y + PH / 2;
    for (let i = 0; i < 3; i++) burst(W, x, y, 8, i ? '#7cc8ff' : '#e8f7ff');
    SFX.fx('portalOut', x, y); SFX.fx('levelWarp', x, y);
  }
  if (t > ARRIVE_T + 1) W.intro = null;
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
  const { done } = lightsStep(L, t, pcx, W.p.y + PH > SHOP_Y, W.guide ? W.guide.hold : Infinity);
  // a click each time a starting tube flickers on
  for (let i = 0; i < LIGHT_X.length; i++) {
    if (L.on[i] < 0 || t - L.on[i] > 2) continue;
    if (sectionLevel(L, i, t) > 0.3 && !(sectionLevel(L, i, t - dt) > 0.3)) SFX.fx('tube', LIGHT_X[i], SHOP_Y + 4);
  }
  if (done) W.shopLit = null;
}
