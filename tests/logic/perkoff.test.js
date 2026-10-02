// The Exo Suit's slots (data/perks.js activePerks, save/save.js cleanPerks): only the perks fitted
// to the suit count; carried ones don't; an old save's switched-on perks are fitted, its
// switched-off ones carried; junk is dropped.
const G = require('../load');
const { activePerks, perkBag, cleanLoadout, startingGuns, SUIT_SLOTS } = G;

let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

check('six suit slots', SUIT_SLOTS === 6);
const lo = { perks: ['unlimited'], suit: ['shield', null, 'shield', null, null, null] };
check('only fitted perks count', JSON.stringify(activePerks(lo)) === '["shield","shield"]', activePerks(lo));
check('a carried perk adds nothing to the bag', perkBag(activePerks(lo)).mana === 1 && perkBag(['unlimited']).mana === 0);
check('no suit: nothing counts', activePerks({ perks: ['shield'] }).length === 0);
const old = cleanLoadout({ guns: startingGuns(), perks: ['unlimited', 'shield', 'eye'], perksOff: [1, 'x', -2] });
check('an old save: the switched-on perks are fitted', old && JSON.stringify(old.suit) === '["unlimited","eye",null,null,null,null,null,null,null,null,null]', old && old.suit);
check('and the switched-off one is carried', old && JSON.stringify(old.perks) === '["shield"]', old && old.perks);
const many = cleanLoadout({ guns: startingGuns(), perks: ['eye', 'eye', 'eye', 'eye', 'eye', 'eye', 'eye', 'eye'] });
check('more than six on: the rest are carried', many && many.suit.slice(0, 6).every(Boolean) && many.perks.length === 2, many && many.perks);
const now = cleanLoadout({ guns: startingGuns(), perks: ['eye', 'nope'], suit: ['shield', 'nope', null] });
check('a suit save reads back, junk dropped, six slots', now && JSON.stringify(now.suit) === '["shield",null,null,null,null,null,null,null,null,null,null]' && now.perks.join() === 'eye', now);

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
