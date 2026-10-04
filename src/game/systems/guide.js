// @ts-check
// A new run's guide hologram (world/guide.js has the rules): steps it, lights the hall where it
// jumps out, ticks as it types, and hands out the starter kit, each thing thrown out of its body
// towards you. A part of step, before stepLights (whose hold it sets)

import { SFX } from '../../audio/sfx.js';
import { CELL, PH, SHOP_FLOOR, SHOP_Y } from '../../core/consts.js';
import { DEV } from '../../dev/knobs.js';
import { makeGun, resetGun } from '../../spells/guns.js';
import { guideStep, guideX, typedAt } from '../../world/guide.js';
import { spillGold } from '../../world/nuggets.js';
import { lightNear } from '../../world/shoplights.js';
import { burst } from './particles.js';

export const GUIDE_FEET = 9;                 // it hovers this far over the shop floor (world units)
/** where its middle is (world), drawn and stepped alike @param {World} W @param {Guide} g */
export const guideMid = (W, g) => ({ x: guideX(g, W.camX), y: SHOP_FLOOR * CELL - GUIDE_FEET - 12 });

/** @param {World} W @param {GameCtx} G @param {StepFrame} F */
export function stepGuide(W, G, F) {
  const g = W.guide;
  if (!g || g.st === 'gone') return;
  if (!W.camReady || !W.unitPx) return;      // nothing drawn yet: the view isn't known
  const vw = G.c.width / (window.devicePixelRatio || 1) / W.unitPx;
  const cps = DEV.guideCps, before = g.st === 'talk' || g.st === 'rude' ? typedAt(g.say, g.t, cps) : -1;
  const ev = guideStep(g, F.dt, { pcx: F.pcx, camX: W.camX, vw, inShop: W.p.y + PH > SHOP_Y, cps, wait: DEV.guideWait, seen: DEV.guideIn });
  const m = guideMid(W, g);
  for (const e of ev) {
    if (e.k === 'appear') {
      // the hall where it stands snaps on, and nothing past it lights until it has gone
      if (W.shopLit) {
        lightNear(W.shopLit, g.x, W.time);
        g.hold = W.shopLit.on.indexOf(-1) < 0 ? Infinity : W.shopLit.on.indexOf(-1);
      }
      SFX.fx('sparks', m.x, m.y); SFX.fx('warp', m.x, m.y);
    } else if (e.k === 'rude') { SFX.fx('sparks', m.x, m.y); SFX.fx('fizzle', m.x, m.y); }
    else if (e.k === 'leave') SFX.fx('warp', m.x, m.y);
    else if (e.k === 'gift' && e.gift) giveGift(W, F, e.gift, m.x, m.y);
  }
  // a tick for each letter it types (the sound keeps its own gap)
  if (before >= 0 && (g.st === 'talk' || g.st === 'rude') && typedAt(g.say, g.t, cps) > before && /\S/.test(g.say[before] || ''))
    SFX.fx('reelTick', m.x, m.y);
}

// One thing out of its body, thrown in an arc towards you (gold spills like a kill's)
/** @param {World} W @param {StepFrame} F @param {import('../../world/guide.js').GuideGift} gift @param {number} x @param {number} y */
function giveGift(W, F, gift, x, y) {
  const side = F.pcx < x ? -1 : 1;
  const fly = { x, y, t: 0, vx: side * (55 + Math.random() * 70), vy: -170 - Math.random() * 60 };
  if (gift.gold) spillGold(W.coins, x, y, gift.gold, { vx: 70, vy: 150 });
  else if (gift.crystal) W.pickups.push({ kind: 'crystal', green: gift.crystal === 'green' || undefined, floor: W.floor, ...fly, nopull: 0.6 });
  else if (gift.mod) W.pickups.push({ kind: 'mod', id: gift.mod, ...fly, cool: 1 });
  else if (gift.gun) {
    // a level-N gun cut down to the slots asked for, empty, firing in order, its shots a cast and recharge set
    const gun = makeGun(Math.random, gift.gun.lvl);
    gun.cap = gift.gun.cap; gun.slots = new Array(gift.gun.cap).fill(null); gun.shuffle = false;
    gun.multi = gift.gun.multi; gun.recharge = gift.gun.recharge;
    W.pickups.push({ kind: 'gun', gun: resetGun(gun), ...fly, cool: 1 });
  }
  burst(W, x, y, 10, '#7fd8ff');
  SFX.fx('prompt', x, y);
}
