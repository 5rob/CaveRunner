// Runs the test suites. `node tests/run.js` runs the essentials (tests/essentials.js);
// `node tests/run.js related` adds the archived suites that name a file you've changed;
// `node tests/run.js all` runs every suite; `node tests/run.js advice` runs whatever matches
// "advice", archived or not. `logic` or `browser` after any of them keeps to that kind.
//
// Logic suites are plain node: they slice the <script> block out of index.html and
// eval it, so they can call planCast, gunRate, tracePath and friends directly. They
// run in milliseconds and are where most of the coverage lives.
//
// Browser suites drive the real page in Chromium via playwright-core. They are slower
// and a little flaky in parallel, so they run one at a time.
//
// index.html is built from src/ first (tools/build.js), so a green run always means the
// committed index.html is fresh.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log(require('../tools/build')() ? 'index.html rebuilt from src/' : 'index.html up to date');

// The undefined-name check (ESLint, only no-undef, see eslint.config.js). With the code in
// modules, a missing import doesn't fail the build: it fails when that line first runs.
let failed = [];
try {
  execFileSync('node', [path.join(__dirname, '..', 'node_modules', 'eslint', 'bin', 'eslint.js'), 'src'],
    { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  console.log('src/ has no undefined names');
} catch (e) {
  failed.push('undefined-names');
  console.log('UNDEFINED NAMES in src/ (eslint no-undef):');
  for (const line of ((e.stdout || '') + (e.stderr || '') || e.message).trim().split('\n').slice(0, 30)) console.log('      ' + line);
}

// The type check (TypeScript, checking only: tsconfig.json, src/types.d.ts). Every .js under src/
// is checked (checkJs, REFACTOR.md P4.4). A report counts as a failed suite, like the
// undefined-name check's.
try {
  execFileSync('node', [path.join(__dirname, '..', 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', '-p', '.'],
    { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  console.log('src/ type-checks');
} catch (e) {
  failed.push('types');
  console.log('TYPE ERRORS in src/ (tsc --noEmit):');
  for (const line of ((e.stdout || '') + (e.stderr || '') || e.message).trim().split('\n').slice(0, 30)) console.log('      ' + line);
}

// Which suites: the essentials (tests/essentials.js) unless asked for more. `all` runs every suite,
// `related` the essentials plus the archived suites that name a file changed since HEAD, any other
// word the suites whose names contain it (archived ones too).
const ESS = require('./essentials');
const args = process.argv.slice(2);
const mode = args[0] === 'all' || args[0] === 'related' ? args.shift() : 'ess';
const only = args[0] === 'logic' || args[0] === 'browser' ? args.shift() : '';
const match = args[0] || '';

const all = dir => fs.readdirSync(path.join(__dirname, dir)).filter(f => f.endsWith('.test.js')).sort();
for (const dir of ['logic', 'browser']) for (const n of ESS[dir])
  if (!all(dir).includes(n + '.test.js')) { failed.push('essentials'); console.log(`tests/essentials.js: no suite ${dir}/${n}`); }
let related = null;
if (mode === 'related') {
  // changed files (staged, unstaged, untracked) → suites whose text names them, or the suite itself
  const git = a => { try { return execFileSync('git', a, { cwd: path.join(__dirname, '..'), encoding: 'utf8' }); } catch (e) { return ''; } };
  const changed = (git(['diff', '--name-only', 'HEAD']) + git(['ls-files', '--others', '--exclude-standard']))
    .split('\n').map(s => s.trim()).filter(Boolean);
  related = new Map();
  for (const dir of ['logic', 'browser']) for (const f of all(dir)) {
    const text = fs.readFileSync(path.join(__dirname, dir, f), 'utf8');
    const why = changed.filter(c => c === `tests/${dir}/${f}` ||
      (c.startsWith('src/') && /\.(js|css|html)$/.test(c) && !c.endsWith('.d.ts') && new RegExp('\\b' + path.basename(c).replace(/[.$]/g, '\\$&') + '\\b').test(text)));
    if (why.length) related.set(f, why.map(c => path.basename(c)));
  }
  console.log('changed: ' + (changed.join(', ') || 'nothing'));
}
const pick = (dir, f) => {
  const name = path.basename(f, '.test.js');
  if (match) return name.includes(match);
  if (mode === 'all') return true;
  return ESS[dir].includes(name) || !!(related && related.has(f));
};
const list = dir => all(dir).filter(f => pick(dir, f)).map(f => path.join(__dirname, dir, f));

// seconds a suite may take before it is called stuck: logic suites run in ~1s, the
// slowest browser suite (everymod) in well under a minute
const LOGIC_CAP = 30, BROWSER_CAP = 120;
const run = (file, kind) => {
  const name = path.basename(file, '.test.js');
  const why = related && related.get(path.basename(file));
  if (why && !ESS[kind].includes(name)) console.log(`  (${name}: names ${why.join(', ')})`);
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
