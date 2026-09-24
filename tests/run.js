// Runs the test suites. `node tests/run.js` does the lot; `node tests/run.js logic`
// does just the fast ones; `node tests/run.js advice` runs whatever matches "advice".
//
// Logic suites are plain node: they slice the <script> block out of index.html and
// eval it, so they can call planCast, gunRate, tracePath and friends directly. They
// run in milliseconds and are where most of the coverage lives.
//
// Browser suites drive the real page in Chromium via playwright-core. They are slower
// and a little flaky in parallel, so they run one at a time.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const filter = process.argv[2] || '';
const only = filter === 'logic' || filter === 'browser' ? filter : '';
const match = only ? '' : filter;

const list = dir => fs.readdirSync(path.join(__dirname, dir))
  .filter(f => f.endsWith('.test.js') && (!match || f.includes(match)))
  .sort()
  .map(f => path.join(__dirname, dir, f));

// seconds a suite may take before it is called stuck: logic suites run in ~1s, the
// slowest browser suite (everymod) in well under a minute
const LOGIC_CAP = 30, BROWSER_CAP = 120;
let failed = [];
const run = (file, kind) => {
  const name = path.basename(file, '.test.js');
  process.stdout.write(`${kind === 'logic' ? '  ' : '  '}${name.padEnd(24)}`);
  try {
    // a hard cap per suite, so a test that is stuck fails in minutes instead of running forever
    const out = execFileSync('node', [file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      timeout: (kind === 'logic' ? LOGIC_CAP : BROWSER_CAP) * 1000, killSignal: 'SIGKILL' });
    const last = out.trim().split('\n').filter(Boolean).pop() || 'ok';
    console.log(last.slice(0, 96));
  } catch (e) {
    failed.push(name);
    console.log(e.signal ? 'TIMED OUT after ' + (kind === 'logic' ? LOGIC_CAP : BROWSER_CAP) + 's' : 'FAILED');
    const out = ((e.stdout || '') + (e.stderr || '')).trim().split('\n');
    for (const line of out.filter(l => /FAIL|Error|error/.test(l)).slice(0, 6)) console.log('      ' + line);
    if (!out.some(l => /FAIL/.test(l))) for (const line of out.slice(-5)) console.log('      ' + line);
  }
};

if (only !== 'browser') {
  console.log('\nlogic');
  for (const f of list('logic')) run(f, 'logic');
}
if (only !== 'logic') {
  const files = list('browser');
  if (files.length) {
    if (!require('./chromium').available) {
      console.log('\nbrowser  SKIPPED: no Chromium found');
      console.log('         set CAVERUNNER_CHROME to point at one');
    } else {
      require('./build')();
      console.log('\nbrowser');
      for (const f of files) run(f, 'browser');
    }
  }
}
console.log(failed.length ? `\n${failed.length} failed: ${failed.join(', ')}` : '\nall suites passed');
process.exit(failed.length ? 1 : 0);
