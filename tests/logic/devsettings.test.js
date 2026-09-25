// v57: the Black Hole dev knobs, the copy-to-clipboard report, and the Black Hole's dig
// radius matching its drawn black core rather than its glow.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF
const o = src.indexOf('<script>\n') + 9;
const js = src.slice(o, src.indexOf('</script>', o));
const { DEV, DEV_DEFAULTS, DEV_META, DEV_GROUPS, devReport, bhSp, MODS } = new Function('React', js.slice(0, js.indexOf('function makeLevel')) +
  '\nreturn { DEV, DEV_DEFAULTS, DEV_META, DEV_GROUPS, devReport, bhSp, MODS };')({ createElement: () => {} });

let pass = 0, fail = 0;
const check = (name, ok, x) => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`);
};

check('pull range knob exists', DEV_META.some(m => m.k === 'bhPull') && DEV.bhPull === DEV_DEFAULTS.bhPull);
check('travel speed knob exists', DEV_META.some(m => m.k === 'bhSpeed') && DEV.bhSpeed === DEV_DEFAULTS.bhSpeed);
check('every knob sits in a Dev panel group', DEV_META.every(m => DEV_GROUPS.some(g => g[0] === m.g)));
check('every knob has a default (a number, or a #rrggbb colour for a colour knob)', DEV_META.every(m =>
  m.type === 'color' ? /^#[0-9a-f]{6}$/.test(DEV_DEFAULTS[m.k]) : typeof DEV_DEFAULTS[m.k] === 'number'));
DEV.bhSpeed = MODS.void.speed;
check('the mod own speed leaves shots alone', bhSp({ pull: 70 }) === 1 && bhSp({}) === 1);
DEV.bhSpeed = MODS.void.speed / 2;
check('halving the knob halves a Black Hole', bhSp({ pull: 70 }) === 0.5);
check('and never touches other shots', bhSp({}) === 1);
DEV.bhSpeed = DEV_DEFAULTS.bhSpeed;

let r = devReport();
check('report with nothing changed says so', /nothing changed/.test(r), r);
DEV.zoom = 1.3; DEV.bhPull = 90;
r = devReport();
console.log(r.split('\n').map(l => '     | ' + l).join('\n'));
check('report lists a changed value with its key', /Camera zoom \(DEV\.zoom\): 1\.3/.test(r));
check('and its old default', /DEV\.bhPull\): 90\s+\[default 50\]/.test(r));
check('and leaves unchanged ones out of the list', !/DEV\.torch\)/.test(r) && /Unchanged: .*torch/.test(r));

check('Black Hole digs no wider than its body', MODS.void.eat < MODS.void.size, [MODS.void.eat, MODS.void.size]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
