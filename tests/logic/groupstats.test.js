const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const o = src.indexOf('<script>\n') + 9;
const js = src.slice(o, src.indexOf('</script>', o));
const api = new Function('React', js.slice(0, js.indexOf('function makeLevel')) +
  '\nreturn { castGroups, groupStats, resetGun };')({ createElement: () => {} });
const { castGroups, groupStats, resetGun } = api;
let pass = 0, fail = 0;
const gun = slots => resetGun({ name: 't', cap: slots.length, castDelay: 0.2, recharge: 1,
  manaMax: 9999, manaRegen: 0, spread: 2, multi: 1, shuffle: false, mana: 9999, speedMul: 1, slots });
const line = (g, n) => {
  const gr = castGroups(g)[n];
  return groupStats(g, gr).map(r => `${r.label} ${r.value}${r.delta ? ' ' + r.delta + '(' + r.dir + ')' : ''}`);
};
const check = (name, slots, n, want) => {
  const got = line(gun(slots), n).join(' · ');
  const ok = want.every(w => got.includes(w));
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}\n     ${got}${ok ? '' : '\n     missing ' + JSON.stringify(want.filter(w => !got.includes(w)))}`);
};

check('a bare bolt shows no deltas', ['bolt'], 0, ['dmg 1', 'mana 5', 'delay 0.3s']);
check('damage plus is credited to the group', ['dmg_up', 'bolt'], 0,
  ['dmg 2.5 +1.5(up)', 'mana 10 +5(down)']);
check('heavy shot shows the speed it costs', ['heavy', 'bolt'], 0,
  ['dmg 2.5 +1.5(up)', 'speed 189 −351(down)']);
check('homing shows up as a gained trait', ['homing', 'bolt'], 0, ['homing 3.5 +3.5(up)']);
check('scatter counts the extra pellets', ['scatter', 'bolt'], 0,
  ['shots 3 +2(up)', 'spread 18', 'dmg 1.65 +0.65(up)']);
check('buckshot damage counts every pellet', ['buck'], 0, ['dmg 3.5', 'shots 5']);
check('a double cast group totals both shots', ['double', 'dmg_up', 'bolt', 'bolt'], 0,
  ['dmg 5 +3(up)']);
check('the buzzsaw group shows the delay it wipes', ['double', 'bolt', 'saw'], 0,
  ['delay 0.016s']);
check('second group is measured on its own', ['dmg_up', 'bolt', 'bolt'], 1, ['dmg 1']);
check('tight spread shows as an improvement', ['tight', 'buck'], 0, ['spread 0°']);
check('efficient shows the mana it saves', ['cheap', 'slug'], 0, ['mana 10 −10(up)']);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
