// Gun presets (save/presets.js, LIST4 #1): the Bag's 💾 saves a deep copy of the gun with its mods,
// junk is dropped on the way in and out, and removePreset takes one out.
const { addPreset, removePreset, cleanPresets, presetGun, caveGun, MODS } = require('../load');

let pass = 0, fail = 0;
const check = (name, ok, got) => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' -> ' + JSON.stringify(got)}`);
};

const ids = Object.keys(MODS);
const gun = { name: 'Zapper', hue: 123, cap: 4, castDelay: 0.1, recharge: 0.3, manaMax: 150, manaRegen: 40, spread: 2,
  multi: 1, shuffle: false, speedMul: 1, slots: [ids[0], null, ids[1], 'no-such-mod'], mana: 7, idx: 2, delayT: 0.5 };

check('junk is an empty list', cleanPresets('x').length === 0 && cleanPresets(null).length === 0 &&
  cleanPresets([1, null, { gun: {} }]).length === 0);

let list = addPreset([], '  My build  ', gun);
check('adds one, name trimmed', list.length === 1 && list[0].name === 'My build', list);
const g = list[0].gun;
check('keeps the build', g.name === 'Zapper' && g.hue === 123 && g.castDelay === 0.1 && g.manaMax === 150 &&
  g.slots[0] === ids[0] && g.slots[2] === ids[1], g);
check('unknown mods dropped (slot kept empty)', g.slots.length === 4 && g.slots[3] === null, g.slots);
gun.slots[0] = ids[2];
check('a deep copy: the gun changing later leaves it alone', g.slots[0] === ids[0], g.slots);
check('stored full of mana, firing state reset', g.mana === 150 && g.idx === 0 && g.delayT === 0, g);

list = addPreset(list, '', gun);
check('blank name → the gun\'s name', list.length === 2 && list[1].name === 'Zapper', list.map(p => p.name));
check('a junk gun adds nothing', addPreset(list, 'x', { name: 'bad' }).length === 2);
check('addPreset leaves the old list alone', addPreset(list, 'y', gun).length === 3 && list.length === 2);

const round = cleanPresets(JSON.parse(JSON.stringify(list)));
check('survives a JSON round trip', round.length === 2 && round[0].gun.slots[0] === ids[0] && round[0].name === 'My build', round);

const removed = removePreset(list, 0);
check('removePreset takes that one out', removed.length === 1 && removed[0].name === 'Zapper' && list.length === 2,
  removed.map(p => p.name));

const a = presetGun(list[0]), b = presetGun(list[0]);
check('presetGun: a fresh copy each time', a && b && a !== b && a.slots !== b.slots && a.slots !== list[0].gun.slots && a.name === 'Zapper');

const real = caveGun(3, Math.random);
const back = cleanPresets(addPreset([], 'r', real))[0].gun;
check('a real cave gun saves and comes back the same', JSON.stringify(back.slots) === JSON.stringify(real.slots) &&
  back.name === real.name && back.hue === real.hue, { back, real });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
