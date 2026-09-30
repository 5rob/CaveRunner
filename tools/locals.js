// Refactor helper for P3.4's last step (REFACTOR.md): splitting step() and draw() into parts.
//
//   node tools/locals.js [file.js] fn...   for each named function in file.js (a path from the
//                                  repo root; default src/game/Game.js): every local declared in its
//                                  own scope (line declared - last line used, `let*` if reassigned,
//                                  number of uses), and its own `return`s. Since P3.4 (22)/(23):
//                                  node tools/locals.js src/game/systems/step.js step
//                                  node tools/locals.js src/game/render/draw.js draw
//
// A local whose span crosses the line where you cut the function in two has to be handed from
// one part to the next (or worked out again, if it's cheap and nothing changed it); a `let*`
// that crosses has to go back, too. A `return` in a part has to tell the caller to stop.
// Scope-aware (eslint-scope): names declared in inner blocks and inner functions don't count.
const fs = require('fs');
const path = require('path');
const espree = require('espree');
const escope = require('eslint-scope');

const names = process.argv.slice(2);
const file = names[0] && names[0].endsWith('.js') ? names.shift() : 'src/game/Game.js';
if (!names.length) { console.error('usage: node tools/locals.js [file.js] fn...'); process.exit(2); }
const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/\r\n/g, '\n');
const ast = espree.parse(src, { ecmaVersion: 'latest', sourceType: 'module', range: true, loc: true });
const sm = escope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });

const returns = new Map();                     // function name -> lines of its own returns
(function walk(n, fn) {
  if (!n || typeof n.type !== 'string') return;
  if (/Function/.test(n.type)) fn = n.id ? n.id.name : null;
  if (n.type === 'ReturnStatement' && fn) {
    if (!returns.has(fn)) returns.set(fn, []);
    returns.get(fn).push(n.loc.start.line);
  }
  for (const k in n) {
    if (k === 'loc' || k === 'range') continue;
    const v = n[k];
    if (Array.isArray(v)) v.forEach(c => walk(c, fn)); else if (v && typeof v === 'object') walk(v, fn);
  }
})(ast, null);

for (const name of names) {
  const fnScope = sm.scopes.find(s => s.type === 'function' && s.block.id && s.block.id.name === name);
  if (!fnScope) { console.log(`\n${name}: not a named function in ${file}`); continue; }
  const body = fnScope.block.body;
  console.log(`\n${name}: lines ${body.loc.start.line}-${body.loc.end.line}; returns at ${(returns.get(name) || []).join(', ') || 'none'}`);
  const rows = [];
  for (const v of fnScope.variables) {
    if (v.name === 'arguments' || !v.defs.length) continue;
    const refs = v.references.map(r => r.identifier.loc.start.line);
    const writes = v.references.filter(r => r.isWrite() && !r.init).length;
    const decl = v.defs[0].name.loc.start.line;
    const last = refs.length ? Math.max(decl, ...refs) : decl;
    rows.push({ n: v.name, decl, last, writes, uses: refs.length });
  }
  rows.sort((a, b) => a.decl - b.decl);
  for (const r of rows) {
    console.log(`  ${String(r.decl).padStart(5)}-${String(r.last).padEnd(5)} span ${String(r.last - r.decl).padStart(4)}  ` +
      `${r.writes ? 'let*' : '    '} ${r.n} (${r.uses})`);
  }
}
