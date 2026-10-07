// The debt's repayment deadline (v107; an hour since v109): real time on the device's clock, counted down on the
// buy machine and at the top (countdown), and kept through a save: an older save in debt gets its hour.
const { countdown, cleanLoadout, startingGuns, DEADLINE_MS, LVL_BUY } = require('../load');

let pass = 0, fail = 0;
const check = (name, ok, got) => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' -> ' + JSON.stringify(got)}`);
};
check('an hour', DEADLINE_MS === 3600000, DEADLINE_MS);
// floor 1's time is a Dev knob (minutes), a day by default (the owner's 1440, v0.0.161); the other floors keep the hour
{
  const { DEV, dueMs } = require('../load');
  check('floor 1: a day by default', dueMs(1) === 24 * DEADLINE_MS, dueMs(1));
  DEV.due1 = 5;
  check('floor 1 follows the knob', dueMs(1) === 5 * 60000 && dueMs(2) === DEADLINE_MS, [dueMs(1), dueMs(2)]);
  DEV.due1 = 1440;
}
check('reads 01:00:00 at the start', countdown(DEADLINE_MS) === '01:00:00', countdown(DEADLINE_MS));
check('a second later', countdown(DEADLINE_MS - 1000) === '00:59:59', countdown(DEADLINE_MS - 1000));
check('hours, minutes, seconds', countdown(3723000) === '01:02:03', countdown(3723000));
check('part seconds round down', countdown(1999) === '00:00:01', countdown(1999));
check('days only past a day', countdown(5 * 86400000) === '5d 00:00:00', countdown(5 * 86400000));
check('passed', countdown(0) === 'OVERDUE' && countdown(-5000) === 'OVERDUE');

const lo = o => Object.assign({ guns: startingGuns(), bag: [], sel: 0, gold: 40, perks: [], maxBonus: 0, usedLives: 0 }, o);
const due = Date.now() + 123456;
check('a save keeps its deadline', cleanLoadout(lo({ debt: LVL_BUY, due })).due === due);
const old = cleanLoadout(lo({ debt: LVL_BUY })).due - Date.now();
check('an older save in debt gets its hour', Math.abs(old - DEADLINE_MS) < 5000, old);
check('no debt, no deadline', cleanLoadout(lo({})).due === 0);
// an older page loading a v107 save dropped the debt, then paid out the whole sale
const fixed = cleanLoadout(lo({ gold: 40 + 64000001000 }));
check('a sale paid out with the debt lost: the price comes back off', fixed.gold === 1040 && fixed.debt === 0, fixed.gold);
check('but gold with its debt beside it is left alone', cleanLoadout(lo({ gold: 64000000005, debt: LVL_BUY })).gold === 64000000005);

console.log(fail ? `\n${fail} failed` : `\n${pass} passed, 0 failed`);
process.exit(fail ? 1 : 0);
