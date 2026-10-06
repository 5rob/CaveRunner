// @ts-check
// Floor 2's dark zones: the hologram behind the silk glitching while you're in or near one (owner, after
// v0.0.148: "flicker on and off randomly and glitch a lot in flashes", random backlight for the silk, the aliens
// silhouetted against it). Pure: a little state machine stepped each drawn frame by game/render/dark.js, its
// own random stream (no Math.random). Knobs: DEV.l2dFlk* (Dev → Level 2: dark zones). Each kind of event has its
// own rate (owner: "frequency of glitching and frequency of it randomly blinking on"), events a second.
//   mode 0 steady: the hologram as it is (× 1); 1 dropout: off (× 0); 2 flash: a burst of bright frames,
//   strobing between `flash` and dim; 3 glitch: the layer torn into horizontal slices, each shifted sideways
// Out, per frame: `mul` (× the hologram's alpha; past 1 the extra is drawn again, lighter) and `tear` (the
// slice shift in terrain px, 0 = none), `seed` (re-rolled each torn frame: which slices move, how far).

/** @typedef {{ mode: number, t: number, mul: number, tear: number, seed: number, rng: number,
 *  hold?: { mode: number, mul: number, tear: number, seed: number } | null }} HoloFlicker  hold: a probe's fixed frame (tools/holoflickshots.js), used while near */

/** @returns {HoloFlicker} */
export function flickerNew() { return { mode: 0, t: 0, mul: 1, tear: 0, seed: 1, rng: 0x2545f491 }; }

/** the state's own random, 0..1 @param {HoloFlicker} s */
export function flickerRnd(s) {
  let x = s.rng | 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  s.rng = x | 0;
  return (x >>> 0) / 4294967296;
}

/**
 * One frame. `near` false: back to steady at once (the hologram as it always was).
 * @param {HoloFlicker} s @param {number} dt @param {boolean} near
 * @param {{ blink: number, tears: number, drops: number, flash: number, glitch: number }} k blink: flashes (blinking
 * on) a second; tears: torn glitches a second; drops: dropouts a second; flash: a flash's brightness (× the
 * hologram's alpha 1, can pass 1); glitch: the most a slice shifts, terrain px (0: no tearing)
 */
export function flickerStep(s, dt, near, k) {
  const tears = k.glitch > 0 ? Math.max(0, k.tears) : 0, blink = Math.max(0, k.blink), drops = Math.max(0, k.drops);
  const rate = blink + tears + drops;
  if (!near || rate <= 0) { s.mode = 0; s.t = 0; s.mul = 1; s.tear = 0; return s; }
  if (s.hold) { s.mode = s.hold.mode; s.mul = s.hold.mul; s.tear = s.hold.tear; s.seed = s.hold.seed; return s; }
  const R = () => flickerRnd(s);
  s.t -= dt;
  if (s.t <= 0) {
    if (s.mode !== 0) { s.mode = 0; s.t = (0.3 + R() * 1.4) / Math.max(0.05, rate); }   // a quiet spell, shorter at a higher rate
    else {
      // the next event, each kind as likely as its share of the rates
      const u = R() * rate;
      s.mode = u < drops ? 1 : u < drops + blink ? 2 : 3;
      s.t = s.mode === 1 ? 0.04 + R() * 0.35 : s.mode === 2 ? 0.06 + R() * 0.3 : 0.08 + R() * 0.25;
    }
  }
  s.tear = 0;
  if (s.mode === 0) s.mul = 1;
  else if (s.mode === 1) s.mul = R() < 0.15 ? 0.5 : 0;                        // off, the odd stutter back
  else if (s.mode === 2) s.mul = R() < 0.65 ? k.flash * (0.75 + R() * 0.25) : 0.15;   // strobing: bright, dim, bright
  else {
    s.mul = R() < 0.3 ? k.flash * 0.7 : 0.6 + R() * 0.6;
    s.tear = k.glitch * (0.4 + R() * 0.6); s.seed = 1 + Math.floor(R() * 1e6);
  }
  return s;
}

/**
 * The torn frame's slices: `n` bands down the layer, each a sideways shift (px, ± `tear`), most of them 0.
 * Plain numbers from the seed, so a frame's tear is the same however often it's asked for.
 * @param {number} seed @param {number} tear @param {number} n
 */
export function flickerSlices(seed, tear, n) {
  const s = flickerNew(); s.rng = (seed * 2654435761) | 0 || 1;
  /** @type {{ y0: number, y1: number, dx: number }[]} */
  const out = [];
  let y = 0;
  while (y < 1) {
    const h = Math.min(1 - y, (0.3 + flickerRnd(s) * 1.7) / n);
    const dx = flickerRnd(s) < 0.45 ? (flickerRnd(s) * 2 - 1) * tear : 0;
    out.push({ y0: y, y1: y + h, dx }); y += h;
  }
  return out;
}
