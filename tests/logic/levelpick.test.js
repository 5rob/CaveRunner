// v0.0.157: the buy machine's level pick (data/levels.js pickTop/stepPick, game/systems/vend.js
// pickedFloor): a flick steps the floor between 1 and one past what's for sale (that one greyed, not
// buyable), and the machines show the pick only while there's no level.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

check('nothing sold: floors 1..2 to pick', G.pickTop(0) === 2, G.pickTop(0));
check('sold 3: floors 1..5', G.pickTop(3) === 5, G.pickTop(3));
check('never past LVL_MENU_MAX', G.pickTop(99) === G.LVL_MENU_MAX);
check('up from 1 with nothing sold: 2', G.stepPick(1, 0, 1) === 2);
check('no further than 2', G.stepPick(2, 0, 1) === 2);
check('no lower than 1', G.stepPick(1, 0, -1) === 1);
check('the extra one is not for sale', !G.canBuyFloor(0, G.pickTop(0)) && G.canBuyFloor(0, G.pickTop(0) - 1));
check('the pick shows with no level', G.pickedFloor({ hasLvl: false, floor: 1, pick: 2 }) === 2);
check('no pick: the floor up next', G.pickedFloor({ hasLvl: false, floor: 3, pick: 0 }) === 3);
check('a level in: its own floor', G.pickedFloor({ hasLvl: true, floor: 1, pick: 2 }) === 1);

console.log(fails ? `\n${fails} failed` : '\nall good');
process.exit(fails ? 1 : 0);
