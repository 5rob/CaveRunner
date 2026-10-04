// @ts-check
// The guide (v0.0.141): a new run's welcome. You walk out of the dark teleporter end of the shop;
// once its spot is well on screen, still dark (or you're about to walk into it) the light over the
// next stretch of hall snaps on and a little hologram of you is hovering right under it, just inside
// what was dark, waving (it sits in the hologram layer: GUIDE_PAR, so it drifts against the
// hall like the background's hologram). A speech box over it types the welcome a letter at a time
// (Dev → Guide: the speed), then it hands out a starter kit one thing at a time (GUIDE_GIFTS) and
// glitches away. Run through it before it's done and it glitches, says GUIDE_RUDE instead and goes
// without the kit (since v0.0.144: once you're past the right edge of its pool of light, not just past it,
// which at a run left no time to see it). Pure: game/systems/guide.js steps it (the gifts, the lights, the sounds),
// game/render/guide.js draws it.

import { LIGHT_X, poolEdge } from './shoplights.js';

export const GUIDE_PAR = 0.8;          // its parallax: the hologram layer's (render/holo.js HOLO_PAR)
export const GUIDE_UNDER = 20;         // it stands this far short of the middle of the first dark section (under its tube's near end)
// It jumps out once its spot is DEV.guideIn inside the right edge of the screen (v0.0.142: before, it came
// as the teleporter left the screen, only ~27 in, its light mostly off screen: the owner never saw the
// dark it lit), or as you come this close to it, whatever the screen shows
export const GUIDE_NEAR = 30;
/** where it stands: just inside the first section the lights are holding dark (g.hold) @param {Guide} g */
export const guideSpot = g => LIGHT_X[Math.min(g.hold, LIGHT_X.length - 1)] - GUIDE_UNDER;
export const APPEAR_T = 0.35;          // the glitch in (s)
export const WAVE_T = 1.1;             // waving before it speaks
export const GIFT_GAP = 0.45;          // one gift every this long
export const LEAVE_T = 0.7;            // the glitch out
export const RUDE_HOLD = 1.6;          // the rude line stays this long once typed

// What it says, a box at a time (the owner's script, as written)
export const GUIDE_PAGES = [
  'Welcome real person. You must be exhausted from your spaceship journey to get here. It must be difficult to recall specifics about why you came here, right? You\'ll need to wait for the Coriolis effect to wear off.',
  'Although I can tell you right now for free what the answer will be..... money. Everyone comes through here looking to get rich and make it big!',
  'They say it\'s simple. Buy a SOL, clean it up a bit and SELL it back to them for a profit! It\'s like printing money!',
  'They even front you the money for all sales.\nOf course you\'d physically travel here from another place to take advantage of an opportunity like that!',
  'Anyway, Welcome to your SOL Hub. Behind me is everything you\'ll need to make your fortune.',
  'Enjoy your Slice Of Life.',
  'And here is something to get you started...',
];
export const GUIDE_RUDE = 'Rude. Yeh OK have fun! Remember, you definitely have everything you need!';

/** @typedef {{ gold?: number, crystal?: 'red' | 'green', mod?: string, gun?: { lvl: number, cap: number, multi: number, recharge: number } }} GuideGift */
// the starter kit, in the order it comes out
/** @type {GuideGift[]} */
export const GUIDE_GIFTS = [
  { gold: 150 },
  { crystal: 'red' }, { crystal: 'red' }, { crystal: 'green' },
  { mod: 'saw' }, { mod: 'bolt' }, { mod: 'double' },
  { gun: { lvl: 5, cap: 3, multi: 1, recharge: 0.5 } },   // non-shuffle, empty, 1 shot a cast, 0.5 s recharge (owner, v0.0.143)
];

// Typing: a letter every 1/cps s, with a beat after a stop (each of "....." too) and a shorter one
// after a comma or line break; the beats scale with the speed
/** @param {string} ch @param {number} cps */
const cost = (ch, cps) => (1 + (/[.!?]/.test(ch) ? 7 : /[,\n]/.test(ch) ? 3 : 0)) / Math.max(1, cps);
/** how long `text` takes to type @param {string} text @param {number} cps */
export function typeTime(text, cps) {
  let t = 0;
  for (const ch of text) t += cost(ch, cps);
  return t;
}
/** how many letters of `text` are up t seconds in @param {string} text @param {number} t @param {number} cps */
export function typedAt(text, t, cps) {
  let n = 0, at = 0;
  for (const ch of text) {
    at += 1 / Math.max(1, cps);
    if (at > t) return n;
    n++;
    at += cost(ch, cps) - 1 / Math.max(1, cps);
  }
  return n;
}
/** how long a box stays once typed @param {string} text @param {number} wait */
export const pageHold = (text, wait) => wait + text.length * 0.012;

/** the right edge of the pool of light it stands in (world x): past it, you've walked off on it @param {Guide} g */
export function guideLitEdge(g) {
  const mid = g.x + GUIDE_UNDER;
  return mid + poolEdge(Math.max(0, LIGHT_X.indexOf(mid)));
}

/** @returns {Guide} */
export const guideNew = () => ({ st: 'wait', t: 0, x: 0, cam0: 0, page: 0, say: '', gift: 0, hold: 2 });

/** where it is drawn now, world x, with the camera at camX (it slides with the hologram layer) @param {Guide} g @param {number} camX */
export const guideX = (g, camX) => g.x + (camX - g.cam0) * (1 - GUIDE_PAR);

/** @typedef {{ pcx: number, camX: number, vw: number, inShop: boolean, cps: number, wait: number, seen: number }} GuideIn */
/** @typedef {{ k: 'appear' | 'talk' | 'gift' | 'rude' | 'leave' | 'gone', gift?: GuideGift }} GuideEvent */

// One step. pcx: your middle; camX, vw: the view's left edge and width (world units); inShop: you're
// in the shop room; cps, wait: Dev's typing speed and the pause after a box; seen: how far inside the
// screen's right edge its spot must be before it jumps out (DEV.guideIn). Returns what happened
/** @param {Guide} g @param {number} dt @param {GuideIn} I @returns {GuideEvent[]} */
export function guideStep(g, dt, I) {
  /** @type {GuideEvent[]} */
  const ev = [];
  /** @param {Guide['st']} st */
  const go = st => { g.st = st; g.t = 0; };
  if (g.st === 'gone') return ev;
  g.t += dt;
  if (g.st === 'wait') {
    // its spot is well on screen, still dark (or you're right at it): it jumps out, just ahead
    const x = guideSpot(g);
    if (x + I.seen <= I.camX + I.vw || I.pcx >= x - GUIDE_NEAR) {
      g.x = x;
      g.cam0 = I.camX;
      go('appear'); ev.push({ k: 'appear' });
    }
    return ev;
  }
  // out of its pool of light, on to the right, before it has finished: rude
  if ((g.st === 'appear' || g.st === 'wave' || g.st === 'talk') && I.inShop && I.pcx > guideLitEdge(g)) {
    g.say = GUIDE_RUDE; go('rude'); ev.push({ k: 'rude' });
    return ev;
  }
  if (g.st === 'appear' && g.t >= APPEAR_T) go('wave');
  else if (g.st === 'wave' && g.t >= WAVE_T) { g.page = 0; g.say = GUIDE_PAGES[0]; go('talk'); ev.push({ k: 'talk' }); }
  else if (g.st === 'talk' && g.t >= typeTime(g.say, I.cps) + pageHold(g.say, I.wait)) {
    if (g.page < GUIDE_PAGES.length - 1) { g.page++; g.say = GUIDE_PAGES[g.page]; g.t = 0; ev.push({ k: 'talk' }); }
    else { g.gift = 0; go('give'); }
  } else if (g.st === 'give') {
    // the last box stays up while it hands things out (it was typed by now)
    while (g.gift < GUIDE_GIFTS.length && g.t >= g.gift * GIFT_GAP) ev.push({ k: 'gift', gift: GUIDE_GIFTS[g.gift++] });
    if (g.gift >= GUIDE_GIFTS.length && g.t >= g.gift * GIFT_GAP) { go('leave'); ev.push({ k: 'leave' }); }
  } else if (g.st === 'rude' && g.t >= typeTime(g.say, I.cps) + RUDE_HOLD) { go('leave'); ev.push({ k: 'leave' }); }
  else if (g.st === 'leave' && g.t >= LEAVE_T) { go('gone'); g.say = ''; g.hold = Infinity; ev.push({ k: 'gone' }); }
  return ev;
}

// The speech box's text this moment ('' for none): the box's whole text and how much of it is typed
/** @param {Guide} g @param {number} cps @returns {{ text: string, n: number }} */
export function guideSpeech(g, cps) {
  if (g.st === 'talk' || g.st === 'rude') return { text: g.say, n: typedAt(g.say, g.t, cps) };
  if (g.st === 'give' || (g.st === 'leave' && g.say)) return { text: g.say, n: g.say.length };
  return { text: '', n: 0 };
}
