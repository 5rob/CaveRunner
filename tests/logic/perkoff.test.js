// Switching perks off (tap a perk's pip, then R): activePerks drops the switched-off places,
// the bag adds up only what's on, and a save keeps which ones are off.
const G = require('../load');
const { activePerks, perkBag, cleanLoadout, startingGuns } = G;

let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

const lo = { perks: ['unlimited', 'shield', 'shield'], perksOff: [] };
check('nothing off: all of them', activePerks(lo).length === 3);
check('no perksOff at all (an old save): all of them', activePerks({ perks: ['shield'] }).length === 1);
lo.perksOff = [0];
check('off by place', JSON.stringify(activePerks(lo)) === '["shield","shield"]', activePerks(lo));
check('the bag leaves an off perk out', perkBag(activePerks(lo)).mana === 1 && perkBag(lo.perks).mana === 0);
lo.perksOff = [1];
check('two of the same switch separately', activePerks(lo).join() === 'unlimited,shield');
const saved = cleanLoadout({ guns: startingGuns(), perks: ['unlimited', 'shield'], perksOff: [1, 'x', -2] });
check('a save keeps which are off (and drops junk)', saved && JSON.stringify(saved.perksOff) === '[1]', saved && saved.perksOff);

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
