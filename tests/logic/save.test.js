// Autosave: readSave / cleanLoadout must turn any stored run — including one written by an
// older version that names mods or perks since removed — into a usable run, or null.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const o = src.indexOf('<script>\n') + 9;
const js = src.slice(o, src.indexOf('</script>', o));
const { readSave, cleanLoadout, startingGuns, VERSION, MODS } = new Function('React', js.slice(0, js.indexOf('function makeLevel')) +
  '\nreturn { readSave, cleanLoadout, startingGuns, VERSION, MODS };')({ createElement: () => {} });

let pass = 0, fail = 0;
const check = (name, ok, got) => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' -> ' + JSON.stringify(got)}`);
};
const lo = () => ({ guns: startingGuns(), bag: ['bolt', 'homing'], sel: 1, gold: 321, perks: ['eye'],
  maxBonus: 25, usedLives: 1, debug: false });
const run = (extra) => JSON.stringify(Object.assign({ ver: VERSION, floor: 4, hp: 60, loadout: lo(),
  level: { seed: 12345, owned: ['eye'], alive: [0, 2], sold: [1], rooms: [0],
    pickups: [{ kind: 'mod', id: 'bolt', x: 1, y: 2, t: 0 }] } }, extra));

check('garbage is no save', readSave('not json') === null);
check('null is no save', readSave(null) === null);
check('no guns is no save', readSave(JSON.stringify({ loadout: { guns: [null, null] } })) === null);

let s = readSave(run());
check('same version keeps the floor', s.floor === 4, s.floor);
check('keeps hp', s.hp === 60, s.hp);
check('keeps gold', s.loadout.gold === 321, s.loadout.gold);
check('keeps the bag', s.loadout.bag.join() === 'bolt,homing', s.loadout.bag);
check('keeps perks', s.loadout.perks.join() === 'eye', s.loadout.perks);
check('keeps sel', s.loadout.sel === 1, s.loadout.sel);
check('keeps max bonus', s.loadout.maxBonus === 25);
check('same version keeps the cave', s.level && s.level.seed === 12345, s.level);
check('same version keeps kills/sales/rooms', s.level.alive.join() === '0,2' && s.level.sold.join() === '1' && s.level.rooms.join() === '0');
check('same version keeps ground loot', s.level.pickups.length === 1);

s = readSave(run({ ver: 'v1' }));
check('older version: gear and floor survive', s.floor === 4 && s.loadout.gold === 321);
check('older version: a fresh cave', s.level === null, s.level);

// a save from a version that had mods and perks since removed
const old = lo();
old.bag.push('gone_forever');
old.perks.push('no_such_perk');
old.guns[0].slots = ['gone_forever', 'bolt', null];
delete old.guns[0].manaRegen;            // a field that didn't exist yet
old.sel = 3;                              // pointing at an empty slot
s = readSave(run({ ver: 'v1', loadout: old }));
check('unknown mods leave the bag', s.loadout.bag.join() === 'bolt,homing', s.loadout.bag);
check('unknown perks are dropped', s.loadout.perks.join() === 'eye', s.loadout.perks);
check('unknown mods leave gun slots empty', s.loadout.guns[0].slots.join() === ',bolt,', s.loadout.guns[0].slots);
check('missing gun fields are filled', Number.isFinite(s.loadout.guns[0].manaRegen));
check('sel moves to a real gun', !!s.loadout.guns[s.loadout.sel], s.loadout.sel);
check('guns are reset', s.loadout.guns.every(g => !g || (g.idx === 0 && g.rechT === 0)));

const pk = readSave(run({ level: { seed: 1, pickups: [{ kind: 'mod', id: 'gone_forever' }, { kind: 'gun', gun: { slots: ['bolt'] } }, null] } }));
check('ground loot: unknown mods dropped, guns cleaned', pk.level.pickups.length === 1 && pk.level.pickups[0].gun.cap === 1, pk.level.pickups);

check('a fresh loadout round-trips', JSON.stringify(cleanLoadout(JSON.parse(JSON.stringify(lo()))).bag) === '["bolt","homing"]');

console.log(fail ? `\n${fail} failed` : `\n${pass} passed, 0 failed`);
process.exit(fail ? 1 : 0);
