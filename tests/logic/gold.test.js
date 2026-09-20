// fmtGold formats the deck's gold readout: bare under 1000, thousands truncated to a "k".
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF
const o = src.indexOf('<script>\n') + 9;
const js = src.slice(o, src.indexOf('</script>', o));
const { fmtGold } = new Function('React', js.slice(0, js.indexOf('function makeLevel')) +
  '\nreturn { fmtGold };')({ createElement: () => {} });

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
check('never negative', fmtGold(-5), '0');

console.log(fail ? `\n${fail} failed` : `\n${pass} passed, 0 failed`);
process.exit(fail ? 1 : 0);
