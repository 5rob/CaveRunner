const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF
const o = src.indexOf('<script>\n') + 9;
const js = src.slice(o, src.indexOf('</script>', o));
const api = new Function('React', js.slice(0, js.indexOf('function makeLevel')) +
  '\nreturn { castGroups, resetGun };')({ createElement: () => {} });
const { castGroups, resetGun } = api;
let pass = 0, fail = 0;
const gun = (slots, extra) => resetGun(Object.assign({ name: 't', cap: slots.length,
  castDelay: 0.2, recharge: 1, manaMax: 9999, manaRegen: 0, spread: 0, multi: 1,
  shuffle: false, mana: 9999, speedMul: 1, slots }, extra || {}));
const show = g => { const r = castGroups(g); return r === null ? 'shuffled' : r.map(x => `[${x.from}-${x.to - 1}]`).join(' '); };
const check = (n, slots, want, extra) => {
  const got = show(gun(slots, extra));
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}\n     ${slots.map(x => x || '_').join(', ')}  ->  ${got}${ok ? '' : '   want ' + want}`);
};

check('one shot per pull', ['bolt', 'bolt', 'bolt'], '[0-0] [1-1] [2-2]');
check('a modifier groups with the shot it changes', ['dmg_up', 'bolt', 'bolt'], '[0-1] [2-2]');
check('two modifiers then a shot', ['dmg_up', 'homing', 'bolt'], '[0-2]');
check('double cast pulls two shots into one group', ['double', 'bolt', 'bolt'], '[0-2]');
check('modifier inside a multicast group', ['double', 'dmg_up', 'bolt', 'bolt'], '[0-3]');
check('two separate groups', ['double', 'bolt', 'bolt', 'dmg_up', 'slug'], '[0-2] [3-4]');
check('gaps ride along with their group', [null, 'dmg_up', null, 'bolt'], '[0-3]');
check('trailing modifiers are never cast', ['bolt', 'dmg_up', 'homing'], '[0-0]');
check('a passive does not break the group', ['battery', 'dmg_up', 'bolt'], '[0-2]');
check('shuffled guns have no fixed groups', ['dmg_up', 'bolt'], 'shuffled', { shuffle: true });
check('nothing castable at all', ['dmg_up', 'homing'], '');
check('multicast wrapping back to the front', ['double', 'bolt'], '[0-1]');
check('buzzsaw tail sits in its group', ['double', 'bolt', 'saw', 'bolt'], '[0-2] [3-3]');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
