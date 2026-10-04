// The elites' flames' gradient and opacity ramp (v0.0.137, art/ramps.js), and their Dev knobs.
const G = require('../load');
const { parseGrad, gradStr, gradAt, parseRamp, rampStr, rampAt, bspline, gradLut, rampLut, lutAt, DEV, DEV_DEFAULTS } = G;
let pass = 0, fail = 0;
const check = (n, ok, x) => { ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

const g = parseGrad('1:#000000 0:#ffffff 0.5:#ff0000');
check('a gradient string reads back sorted', g.map(s => s.t).join() === '0,0.5,1', g);
check('and writes back the same', gradStr(g) === '0:#ffffff 0.5:#ff0000 1:#000000', gradStr(g));
check('its ends are its end colours', gradAt(g, 0).join() === '255,255,255' && gradAt(g, 1).join() === '0,0,0');
check('it blends between stops', gradAt(g, 0.25).map(Math.round).join() === '255,128,128', gradAt(g, 0.25));
check('junk falls back to white', parseGrad('nonsense')[0].c === '#ffffff');

const r = parseRamp('0:0 0.2:1 1:0');
check('a ramp reads and writes back', rampStr(r) === '0:0 0.2:1 1:0', rampStr(r));
check('the B-spline starts and ends on its end points', Math.abs(rampAt(r, 0)) < 1e-6 && Math.abs(rampAt(r, 1)) < 1e-6, [rampAt(r, 0), rampAt(r, 1)]);
check('and is pulled up toward the middle point, not through it', rampAt(r, 0.25) > 0.3 && rampAt(r, 0.25) < 1, rampAt(r, 0.25));
const s = bspline(r);
let fwd = true;
for (let i = 2; i < s.length; i += 2) if (s[i] < s[i - 2] - 1e-9) fwd = false;
check('its x only goes forward (so opacity is one value per moment)', fwd);
check('a flat ramp stays flat', [0, 0.3, 0.7, 1].every(x => Math.abs(rampAt(parseRamp('0:0.5 1:0.5'), x) - 0.5) < 1e-9));
check('lookup tables: colour strings and opacities', /^rgb\(/.test(lutAt(gradLut(DEV_DEFAULTS.elFxGrad), 0.5)) && lutAt(rampLut(DEV_DEFAULTS.elFxAlpha), 0) < 0.05);
check('the default flame starts white and fades out', lutAt(gradLut(DEV_DEFAULTS.elFxGrad), 0) === 'rgb(255,255,255)' && lutAt(rampLut(DEV_DEFAULTS.elFxAlpha), 1) < 0.02);
check('the flames have their Dev rows', ['elFxRateLo', 'elFxLifeHi', 'elFxWaveLo', 'elFxDragHi', 'elFxGrad', 'elFxAlpha'].every(k => DEV[k] !== undefined));
check('a Dev report prints the strings', (() => { const old = DEV.elFxGrad; DEV.elFxGrad = '0:#000000 1:#ffffff';
  const t = G.devReport(); DEV.elFxGrad = old; return t.includes('0:#000000 1:#ffffff'); })());

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
