// Autosave: readSave / cleanLoadout must turn any stored run — including one written by an
// older version that names mods or perks since removed — into a usable run, or null.
const { readSave, cleanLoadout, cleanGun, startingGuns, VERSION, MODS } = require('../load');

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
check('no guns array is no save', readSave(JSON.stringify({ loadout: { gold: 5 } })) === null);
// v0.0.142: a new run starts with no guns, so a save with none is a run
const empty = readSave(JSON.stringify({ loadout: { guns: [null, null, null, null], sel: 2 } }));
check('empty hands are a save (a new run starts that way)', !!empty && empty.loadout.guns.length === 4 && empty.loadout.sel === 0, empty && empty.loadout);

let s = readSave(run());
check('same version keeps the floor', s.floor === 4, s.floor);
check('keeps hp', s.hp === 60, s.hp);
check('keeps gold', s.loadout.gold === 321, s.loadout.gold);
check('keeps the bag', s.loadout.bag.join() === 'bolt,homing', s.loadout.bag);
check('keeps perks (a pre-suit save: fitted to the suit)', s.loadout.suit.join() === 'eye,,,,,,,,,,,' && s.loadout.perks.length === 0, s.loadout);
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
check('unknown perks are dropped', s.loadout.suit.filter(Boolean).join() === 'eye', s.loadout.suit);
check('unknown mods leave gun slots empty', s.loadout.guns[0].slots.join() === ',bolt,', s.loadout.guns[0].slots);
check('missing gun fields are filled', Number.isFinite(s.loadout.guns[0].manaRegen));
check('sel moves to a real gun', !!s.loadout.guns[s.loadout.sel], s.loadout.sel);
check('guns are reset', s.loadout.guns.every(g => !g || (g.idx === 0 && g.rechT === 0)));

const pk = readSave(run({ level: { seed: 1, pickups: [{ kind: 'mod', id: 'gone_forever' }, { kind: 'gun', gun: { slots: ['bolt'] } }, null] } }));
check('ground loot: unknown mods dropped, guns cleaned', pk.level.pickups.length === 1 && pk.level.pickups[0].gun.cap === 1, pk.level.pickups);

// the level's debt (v107): kept, and v106's negative gold turned into one
const withLo = o => JSON.stringify({ ver: VERSION, floor: 1, loadout: Object.assign(lo(), o) });
s = readSave(withLo({ gold: 55, debt: 64000000000 }));
check('keeps the debt and the gold', s.loadout.debt === 64000000000 && s.loadout.gold === 55, s.loadout);
s = readSave(withLo({ gold: 40 - 64000000000 }));
check('v106 negative gold becomes gold + debt', s.loadout.gold === 40 && s.loadout.debt === 64000000000, s.loadout);
s = readSave(withLo({ gold: 40 }));
check('no debt by default', s.loadout.debt === 0, s.loadout);

// a Gravity Gun saved before v0.0.155 had Follow Me; its trick is Follow This now (owner split them)
const oldGrav = Object.assign({}, startingGuns()[2], { slots: ['follow', 'vacfield'] });
check('an old Gravity Gun gets Follow This', JSON.stringify(cleanGun(JSON.parse(JSON.stringify(oldGrav))).slots) === '["followaim","vacfield"]');
const otherGun = Object.assign({}, startingGuns()[0], { name: 'Mine', slots: ['follow', 'bolt'] });
check('any other gun keeps its Follow Me', cleanGun(JSON.parse(JSON.stringify(otherGun))).slots[0] === 'follow');
check('a fresh loadout round-trips', JSON.stringify(cleanLoadout(JSON.parse(JSON.stringify(lo()))).bag) === '["bolt","homing"]');

console.log(fail ? `\n${fail} failed` : `\n${pass} passed, 0 failed`);
process.exit(fail ? 1 : 0);
