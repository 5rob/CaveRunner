// The debt's repayment deadline (v107): five real days on the device's clock, counted down on the
// buy machine (countdown), and kept through a save: an older save in debt gets its five days.
const { countdown, cleanLoadout, startingGuns, DEADLINE_MS, LVL_BUY } = require('../load');

let pass = 0, fail = 0;
const check = (name, ok, got) => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' -> ' + JSON.stringify(got)}`);
};
check('five days', DEADLINE_MS === 5 * 86400000, DEADLINE_MS);
check('reads 5d 00:00:00 at the start', countdown(DEADLINE_MS) === '5d 00:00:00', countdown(DEADLINE_MS));
check('a second later', countdown(DEADLINE_MS - 1000) === '4d 23:59:59', countdown(DEADLINE_MS - 1000));
check('under a day', countdown(3723000) === '0d 01:02:03', countdown(3723000));
check('part seconds round down', countdown(1999) === '0d 00:00:01', countdown(1999));
check('passed', countdown(0) === 'OVERDUE' && countdown(-5000) === 'OVERDUE');

const lo = o => Object.assign({ guns: startingGuns(), bag: [], sel: 0, gold: 40, perks: [], maxBonus: 0, usedLives: 0 }, o);
const due = Date.now() + 123456;
check('a save keeps its deadline', cleanLoadout(lo({ debt: LVL_BUY, due })).due === due);
const old = cleanLoadout(lo({ debt: LVL_BUY })).due - Date.now();
check('an older save in debt gets five days', Math.abs(old - DEADLINE_MS) < 5000, old);
check('no debt, no deadline', cleanLoadout(lo({})).due === 0);

console.log(fail ? `\n${fail} failed` : `\n${pass} passed, 0 failed`);
process.exit(fail ? 1 : 0);
