// The shop heal's price: free the first time on a floor, then 100g, up by HEAL_MUL each time,
// lifted by the floor like the kill gold; and a fresh floor's shop starts the count again.
const G = require('../load');
const { healPrice, goldScale, HEAL_MUL, makeLevel } = G;

let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

check('the first heal is free', healPrice(0, 1) === 0 && healPrice(0, 9) === 0);
check('the second is 100g on floor 1', healPrice(1, 1) === 100, healPrice(1, 1));
const run = [1, 2, 3, 4, 5].map(n => healPrice(n, 1));
check('each one dearer than the last', run.every((p, i) => i === 0 || p > run[i - 1]), run);
check('by about HEAL_MUL', Math.abs(run[2] / run[1] - HEAL_MUL) < 0.05, run);
check('the floor lifts it like kill gold', healPrice(1, 5) === Math.round(100 * goldScale(5) / 5) * 5, healPrice(1, 5));
check('a floor 5 heal costs more than floor 1', healPrice(2, 5) > healPrice(2, 1));
const heal = makeLevel(12345, 3, []).stock.find(s => s.kind === 'heal');
check('a new shop\'s heal starts free, none bought', heal.price === 0 && heal.bought === 0 && !heal.sold, heal);
check('the heal-price reaches the shop code', /healPrice\(it\.bought, W\.floor\)/.test(G.source));

console.log(fails ? `\n${fails} failed` : '\nall good');
process.exit(fails ? 1 : 0);
