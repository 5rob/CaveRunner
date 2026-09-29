// Refactor helper (REFACTOR.md, D12): proves a move changed nothing. Builds index.html, then
// compares every top-level statement of the game bundle with the same statement in the
// index.html of an earlier commit (indentation aside). A pure move leaves every statement's
// text identical; only their order changes (a module's code comes before main.js's).
//
//   node tools/same.js            against the last commit (HEAD)
//   node tools/same.js <ref>      against any commit, e.g. 2cb0fb9 (end of P1.5)
//
// Exit code 1 if anything differs, is missing or is new. Needs a ref whose index.html was
// built by esbuild (P1.2, eb44d37, or later); older ones are printed differently.
// Delete it with tools/move.js once the refactor is done.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const espree = require(require.resolve('espree', { paths: [path.dirname(require.resolve('eslint'))] }));

function statements(html) {
  const s = html.replace(/\r\n/g, '\n');
  const a = s.indexOf('(() => {', s.indexOf('<script>const VERSION'));
  const b = s.lastIndexOf('})();', s.indexOf('</script>', a));
  if (a < 0 || b < a) throw new Error('no game bundle found (built before P1.2?)');
  const code = s.slice(a, b + 5);
  const body = espree.parse(code, { ecmaVersion: 'latest', range: true }).body[0].expression.callee.body.body;
  const m = new Map();
  for (const st of body) {
    const text = code.slice(st.range[0], st.range[1]).replace(/^\s+/gm, '');
    const key = st.type === 'VariableDeclaration'
      ? st.declarations.map(d => code.slice(d.id.range[0], d.id.range[1])).join(',')
      : st.id ? st.id.name : 'statement: ' + text.slice(0, 50).replace(/\n/g, ' ');
    m.set(key, text);
  }
  return m;
}

const ref = process.argv[2] || 'HEAD';
require('./build')();
const now = statements(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'));
const then = statements(execFileSync('git', ['show', ref + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }));

const out = [];
let same = 0;
for (const [k, t] of then) {
  if (!now.has(k)) out.push('missing  ' + k);
  else if (now.get(k) !== t) out.push('differs  ' + k);
  else same++;
}
for (const k of now.keys()) if (!then.has(k)) out.push('new      ' + k);
console.log(`${same} of ${then.size} top-level statements identical to ${ref}` + (out.length ? ':' : ''));
for (const line of out.slice(0, 40)) console.log('  ' + line);
if (out.length > 40) console.log(`  … and ${out.length - 40} more`);
process.exit(out.length ? 1 : 0);
