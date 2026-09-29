// Refactor helper for Phase 3 (REFACTOR.md): what's in Game's useEffect closure, and who uses what.
//
//   node tools/gamemap.js              every closure-level name: line, kind, who reassigns it, who reads it
//   node tools/gamemap.js fn...        for each named inner function: the closure names it uses
//                                      (functions, and everything else), and who calls it
//
// Scope-aware (eslint-scope), like tools/world.js: an inner local that shadows a closure name
// doesn't count. "Who" is the closure's top-level statement the reference sits in (an inner
// function's name, or `L<line>` for a bare statement). `W.x` is one use of `W`; this doesn't
// look inside W. Names from outside the closure aren't listed: imports, and Game's own
// `input` prop (the React bridge), which many functions read — grep for `input.current`. Made in P3.1 for the Game map; in P3.4 it answers "what does this system need
// passed in when it moves out?".
const fs = require('fs');
const path = require('path');
const espree = require('espree');
const escope = require('eslint-scope');

const FILE = path.join(__dirname, '..', 'src', 'game', 'Game.js');
const src = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');
const ast = espree.parse(src, { ecmaVersion: 'latest', sourceType: 'module', range: true, loc: true });
const sm = escope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
let game;
for (const st of ast.body) {
  const d = st.type === 'ExportNamedDeclaration' ? st.declaration : st;
  if (d && d.type === 'FunctionDeclaration' && d.id.name === 'Game') game = d;
}
const eff = game.body.body.find(s => s.type === 'ExpressionStatement' && s.expression.callee &&
  s.expression.callee.name === 'useEffect').expression.arguments[0];
const closure = sm.acquire(eff);
const top = eff.body.body;

const ownerOf = r => {
  for (const st of top) if (r[0] >= st.range[0] && r[1] <= st.range[1]) {
    if (st.type === 'VariableDeclaration')
      for (const d of st.declarations) if (r[0] >= d.range[0] && r[1] <= d.range[1]) return d.id.name || '(pattern)';
    if (st.type === 'FunctionDeclaration') return st.id.name;
    return 'L' + st.loc.start.line;
  }
  return '?';
};
const rows = closure.variables.map(v => {
  const def = v.defs[0];
  const isFn = def.type === 'FunctionName' || (def.node.init && /Function/.test(def.node.init.type));
  const reads = new Set(), writes = new Set();
  for (const r of v.references) {
    const o = ownerOf(r.identifier.range);
    if (r.isWrite() && !r.init) writes.add(o);
    if (r.isRead()) reads.add(o);
  }
  return { name: v.name, line: def.name.loc.start.line, kind: isFn ? 'fn' : def.parent ? def.parent.kind : def.type,
    reads: [...reads], writes: [...writes] };
});

const want = process.argv.slice(2);
if (!want.length) {
  for (const r of rows) console.log([r.line, r.kind, r.name, 'W:' + r.writes.join(','), 'R:' + r.reads.join(',')].join('\t'));
  return;
}
for (const fn of want) {
  const me = rows.find(r => r.name === fn);
  if (!me) { console.log(`${fn}: not a closure-level name`); continue; }
  const fns = [], vals = [];
  for (const r of rows) {
    if (r.name === fn) continue;
    if (r.reads.includes(fn) || r.writes.includes(fn)) (r.kind === 'fn' ? fns : vals).push(r.name + (r.writes.includes(fn) ? ' (writes)' : ''));
  }
  console.log(`${fn} (line ${me.line})`);
  console.log(`  calls:   ${fns.join(', ') || '-'}`);
  console.log(`  uses:    ${vals.join(', ') || '-'}`);
  console.log(`  used by: ${me.reads.join(', ') || '-'}`);
}
