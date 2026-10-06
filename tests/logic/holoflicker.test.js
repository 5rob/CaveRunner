// The hologram glitching in floor 2's dark zones (world/holoflicker.js): steady while you're away; near a zone
// it goes through every mode (steady, dropout, flash, torn) at the default knobs, flashes reach the flash
// knob, tears stay within the glitch knob, rate 0 keeps it steady; deterministic; the slices tile 0..1.
const G = require('../load');
const { flickerNew, flickerStep, flickerSlices, DEV_DEFAULTS, DEV_META } = G;
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const k = { rate: DEV_DEFAULTS.l2dFlkRate, flash: DEV_DEFAULTS.l2dFlkFlash, glitch: DEV_DEFAULTS.l2dFlkGlitch };

let s = flickerNew();
for (let i = 0; i < 300; i++) flickerStep(s, 1 / 60, false, k);
check('away from a zone: steady, untorn', s.mode === 0 && s.mul === 1 && s.tear === 0);

const run = () => {
  const s = flickerNew(), modes = new Set(), out = [];
  let maxMul = 0, maxTear = 0, off = 0;
  for (let i = 0; i < 60 * 30; i++) {
    flickerStep(s, 1 / 60, true, k); modes.add(s.mode); out.push(s.mul, s.tear);
    maxMul = Math.max(maxMul, s.mul); maxTear = Math.max(maxTear, s.tear); if (s.mul === 0) off++;
  }
  return { modes, maxMul, maxTear, off, out };
};
const a = run(), b = run();
check('near: every mode in 30 s', a.modes.size === 4, [...a.modes]);
check('flashes reach about the flash knob', a.maxMul > k.flash * 0.9 && a.maxMul <= k.flash + 1e-9, a.maxMul);
check('tears within the glitch knob', a.maxTear > 0 && a.maxTear <= k.glitch, a.maxTear);
check('some frames off', a.off > 10, a.off);
check('deterministic', a.out.join() === b.out.join());

s = flickerNew();
for (let i = 0; i < 600; i++) flickerStep(s, 1 / 60, true, { ...k, rate: 0 });
check('rate 0: steady', s.mode === 0 && s.mul === 1);

const sl = flickerSlices(1234, 10, 14);
check('slices tile the layer', sl[0].y0 === 0 && Math.abs(sl[sl.length - 1].y1 - 1) < 1e-9 && sl.every((x, i) => !i || x.y0 === sl[i - 1].y1), sl.length);
check('slices shift within the tear, some not at all', sl.every(x => Math.abs(x.dx) <= 10) && sl.some(x => x.dx === 0) && sl.some(x => x.dx !== 0));
check('knobs on the panel', ['l2dFlk', 'l2dFlkBase', 'l2dFlkRate', 'l2dFlkFlash', 'l2dFlkGlitch', 'l2dFlkNear'].every(n => DEV_META.some(m => m.k === n && m.g === 'l2dark')));

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
