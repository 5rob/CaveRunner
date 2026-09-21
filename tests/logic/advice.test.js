const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF
const o = src.indexOf('<script>\n') + 9;
const js = src.slice(o, src.indexOf('</script>', o));
const api = new Function('React', js.slice(0, js.indexOf('function Game(')) +
  '\nreturn { MODS, gunRate, buildAdvice, resetGun };')({ createElement: () => {} });
const { MODS, gunRate, buildAdvice, resetGun } = api;
let pass = 0, fail = 0;
const check = (n, ok, x) => { ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const gun = (slots, over) => resetGun(Object.assign({ name: 't', cap: slots.length,
  castDelay: 0.2, recharge: 1, manaMax: 500, manaRegen: 100, spread: 0, multi: 1,
  shuffle: false, mana: 500, speedMul: 1, slots }, over || {}));

// --- the diagnosis ---
check('a long recharge is called out',
  buildAdvice(gun(['bolt']), []).limit.key === 'rech', buildAdvice(gun(['bolt']), []).limit.text);
check('a slow cast is called out instead',
  buildAdvice(gun(['bolt'], { castDelay: 3, recharge: 0.05 }), []).limit.key === 'cast',
  buildAdvice(gun(['bolt'], { castDelay: 3, recharge: 0.05 }), []).limit.text);
const starved = gun(['quad', 'seeker', 'slug', 'slug', 'slug', 'slug'],
  { manaRegen: 5, castDelay: 0.02, recharge: 0.05 });
check('mana starvation outranks the others',
  buildAdvice(starved, []).limit.key === 'mana', buildAdvice(starved, []).limit.text);
check('a gun with no shots says so',
  buildAdvice(gun(['dmg_up', 'homing']), []).limit.key === 'none',
  buildAdvice(gun(['dmg_up', 'homing']), []).limit.text);

// --- the suggestions ---
let a = buildAdvice(gun([null, 'bolt', null]), ['dmg_up', 'tight', 'battery']);
check('it fills the slot BEFORE a shot, where a modifier actually works',
  a.tips.length > 0 && a.tips[0].id === 'dmg_up' && a.tips[0].slot === 0,
  a.tips.map(t => `${MODS[t.id].name}@${t.slot}`));
check('and reports the gain', a.tips[0].gain > 1.05, a.tips[0].gain.toFixed(2));
check('it will not suggest a modifier after the shot, which does nothing',
  buildAdvice(gun(['bolt', null]), ['dmg_up']).tips.length === 0,
  buildAdvice(gun(['bolt', null]), ['dmg_up']).tips);

// the classic mistake: a modifier sitting behind the shot it was meant to boost
a = buildAdvice(gun(['bolt', 'dmg_up']), []);
check('it spots a modifier that needs moving in front', a.tips.length > 0 &&
  a.tips[0].kind === 'move', a.tips[0]);
check('and moving it really does help', a.tips.length && a.tips[0].gain > 1.5,
  a.tips[0] && a.tips[0].gain.toFixed(2));

a = buildAdvice(gun(['double', 'bolt', 'bolt']), ['quad', 'bolt']);
check('it spots a bigger multicast', a.tips.some(t => t.id === 'quad'),
  a.tips.map(t => `${MODS[t.id].name}@${t.slot}`));

a = buildAdvice(gun(['bolt']), []);
check('an empty bag yields no tips', a.tips.length === 0);

a = buildAdvice(gun(['bolt', 'bolt', 'bolt']), ['dmg_up']);
check('at most one tip per slot', new Set(a.tips.map(t => t.slot)).size === a.tips.length,
  a.tips.map(t => t.slot));
check('never more than three tips', a.tips.length <= 3, a.tips.length);

// --- it should reproduce the advice given by hand ---
const molten = resetGun({ name: 'Molten Repeater', cap: 7, castDelay: 0.41, recharge: 1.09,
  manaMax: 439, manaRegen: 132, spread: 0.3, multi: 1, shuffle: false, mana: 439,
  speedMul: 0.99, slots: ['double', 'borer', 'homing', 'orb', 'saw', null, null] });
const bag = ['bolt', 'double', 'pierce', 'quad', 'big', 'dmg_up', 'spark', 'triple',
  'bounce', 'range', 'spark', 'fast', 'slug', 'bolt', 'quad', 'triple', 'double',
  'bolt', 'scatter', 'battery', 'tip', 'bolt', 'slug'];
const t0 = Date.now();
a = buildAdvice(molten, bag);
const ms = Date.now() - t0;
console.log(`\n   ${a.limit.text}`);
for (const t of a.tips) console.log(`   ${MODS[t.id].name} into slot ${t.slot + 1}  x${t.gain.toFixed(2)}`);
// with Buzzsaw now cutting recharge to a third, this build fires fast enough that mana
// sustain, not recharge, is the bottleneck
check('the real build is diagnosed as mana-bound', a.limit.key === 'mana');
check('and it finds a real improvement', a.tips.length && a.tips[0].gain > 2, a.tips[0] && a.tips[0].gain.toFixed(2));
check('fast enough to run on every edit', ms < 60, ms + 'ms');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
