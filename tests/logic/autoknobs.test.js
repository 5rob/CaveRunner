// The Dev panel's Auto colours (v1.0.57): src/dev/autouse.js lists the knobs CaveRunner Auto's build reads (tools/autoknobs.js,
// run by tools/build.js on every build). It's current, every name in it is a real knob, and a few known ones land right.
const G = require('../load');
const { scan } = require('../../tools/autoknobs');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const now = scan(), file = [...G.AUTO_KNOBS].sort();
check('autouse.js is current (else: node tools/build.js)', JSON.stringify(now) === JSON.stringify(file), { now: now.length, file: file.length });
const keys = new Set(G.DEV_META.map(m => m.k));
check('every name in it is a knob', file.every(k => keys.has(k)), file.filter(k => !keys.has(k)));
for (const k of ['autoVineFire', 'autoNavCut', 'fireSpreadLo', 'jeTentsHi', 'torch']) check(`${k}: Auto reads it`, G.AUTO_KNOBS.has(k));
for (const k of ['bhSpeed', 'fogDark']) check(`${k}: old game only`, !G.AUTO_KNOBS.has(k));
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
