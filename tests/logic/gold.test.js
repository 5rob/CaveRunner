// fmtGold formats the deck's gold readout: bare under 1000, then truncated to a k, M or B.
const { fmtGold } = require('../load');

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} -> ${JSON.stringify(got)}${ok ? '' : ' want ' + JSON.stringify(want)}`);
};

check('zero', fmtGold(0), '0');
check('small', fmtGold(40), '40');
check('just under a thousand', fmtGold(999), '999');
check('exactly a thousand', fmtGold(1000), '1k');
check('truncates, does not round', fmtGold(1234), '1.2k');
check('truncates 1299 down', fmtGold(1299), '1.2k');
check('round thousand drops the decimal', fmtGold(2000), '2k');
check('big', fmtGold(12345), '12.3k');
check('floors a fractional input', fmtGold(40.9), '40');
check('negative keeps its sign', fmtGold(-5), '-5');
check('millions', fmtGold(2500000), '2.5M');
check('a level on credit', fmtGold(40 - 64000000000), '-63.9B');
check('after selling it', fmtGold(40 + 1000), '1k');

console.log(fail ? `\n${fail} failed` : `\n${pass} passed, 0 failed`);
process.exit(fail ? 1 : 0);
