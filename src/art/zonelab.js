// @ts-check
// Dev → Zones (owner, after v1.0.77): one level zone at a time, made as a level makes it (CaveRunner Auto's rules: S.lvl, its
// band), with a variant forced (titleZoneForce: heavy vegetation, spider web filled, or plain), a short flat stretch either side.
// Still: no players, no creatures, no scroll of its own; lit (S.lab: no dark). The whole strip is made at once into a ring wide
// enough to keep it (titleScene's ncol), so the page's window pans back and forth over it (S.scroll) and up and down (the camera).
import { TCELL, TITLE_VW, TITLE_ZONES, titlePlan, titleScene, titleStep, titleZoneForce } from './titlescene.js';

export const ZLAB_LEAD = 60;          // flat cave before the zone (world units)
export const ZLAB_TAIL = 60;          // and after it

/** @typedef {{ S: import('./titlescene.js').TitleScene, Z: import('./titlescene.js').TZone, w: number }} ZoneLab */

// a flat stretch (auto/level.js flatZone's)
/** @param {import('./titlescene.js').TitlePlan} P @param {number} x0 @param {number} x1 */
function flat(P, x0, x1) {
  P.z.push({ z: 'moss', x0, x1, i: P.z.length, ph: [0, 0, 0, 0, 0], ca: 0, fa: 0, cf: 1, ff: 1, co: 0, fo: 2, dens: 0.4, flat: true });
}

// the strip for a view vh tall (a level's height): zone kind z with the variants vars
/** @param {number} vh @param {number} seed @param {string} z @param {{ veg?: boolean, spid?: boolean }} vars @returns {ZoneLab} */
export function zoneLabScene(vh, seed, z, vars) {
  const P = titlePlan(seed, TITLE_ZONES);   // (any kind: the plan grows a zone past the end now and then, as a level's does)
  flat(P, -300, ZLAB_LEAD);
  const Z = titleZoneForce(P, ZLAB_LEAD, z, vars);
  flat(P, Z.x1, 1e9);
  const w = Z.x1 + ZLAB_TAIL;
  const S = titleScene(vh, seed, Math.min(vh * 0.24, 50), vh - Math.min(vh * 0.08, 20),
    { runners: 1, level: { zp: P }, ncol: Math.ceil((w + TITLE_VW + 200) / TCELL) });
  S.runners = []; S.runner = null; S.foes = []; S.still = true; S.pace = 0; S.spawn = Infinity; S.lab = true;
  // the whole strip now: titleStep (a step of 0: nothing moves) makes the columns up to the view's right edge and past it
  const s0 = S.scroll;
  S.scroll = w; titleStep(S, 0); S.scroll = s0;
  return { S, Z, w };
}

// the pan's range: the view's left edge (S.scroll) from 0 to the strip's end less a view
/** @param {ZoneLab} L @param {number} x */
export const zoneLabClamp = (L, x) => Math.max(0, Math.min(L.w - TITLE_VW, x));
