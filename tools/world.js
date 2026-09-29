// Refactor helper for P3.2 (REFACTOR.md): turns closure variables of Game's useEffect into
// properties of the world object, `name` -> `W.name`, in src/game/Game.js.
//
//   node tools/world.js [--dry] name...
//
// Scope-aware (eslint-scope): only references that resolve to the closure-level variable are
// rewritten, so an inner `let best` or a callback's own `e` is left alone. A shorthand
// property (`{ enemies }`, also as a destructuring target) becomes `enemies: W.enemies`.
// The declarations are NOT touched: move each one into makeWorld() (game/world.js) or turn it
// into a `W.name = …` line by hand, then `node tests/run.js logic` (no-undef finds a missed one).
// Refuses if a reference sits where some inner `W` would capture it, or a name isn't a
// closure variable. Keeps the file's line endings.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'src', 'game', 'Game.js');
const espree = require('espree');
const escope = require('eslint-scope');

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const names = args.filter(a => !a.startsWith('--'));
if (!names.length) { console.error('usage: node tools/world.js [--dry] name...'); process.exit(2); }

const raw = fs.readFileSync(FILE, 'utf8');
const crlf = raw.includes('\r\n');
const src = raw.replace(/\r\n/g, '\n');
const ast = espree.parse(src, { ecmaVersion: 'latest', sourceType: 'module', range: true, loc: true });
const sm = escope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });

// the useEffect callback inside function Game
let game;
for (const st of ast.body) {
  const d = st.type === 'ExportNamedDeclaration' ? st.declaration : st;
  if (d && d.type === 'FunctionDeclaration' && d.id.name === 'Game') game = d;
}
const eff = game.body.body.find(s => s.type === 'ExpressionStatement' && s.expression.callee &&
  s.expression.callee.name === 'useEffect').expression.arguments[0];
const closure = sm.acquire(eff);
if (!closure.set.has('W')) throw new Error('no closure-level W in Game (const W = makeWorld())');

// parent links, to spot shorthand properties
const parent = new Map();
(function walk(n, p) {
  if (!n || typeof n.type !== 'string') return;
  parent.set(n, p);
  for (const k in n) {
    if (k === 'parent') continue;
    const v = n[k];
    if (Array.isArray(v)) v.forEach(c => walk(c, n));
    else if (v && typeof v.type === 'string') walk(v, n);
  }
})(ast, null);

const edits = [];
let bad = 0;
for (const name of names) {
  const v = closure.set.get(name);
  if (!v) { console.error(`${name}: not a closure variable of Game`); bad++; continue; }
  const declIds = new Set(v.identifiers);
  let n = 0;
  for (const r of v.references) {
    const id = r.identifier;
    if (declIds.has(id)) continue;                 // the declaration itself: left for the hand edit
    // is W captured by an inner scope here?
    for (let s = r.from; s && s !== closure; s = s.upper) {
      if (s.set.has('W')) { console.error(`${name}: line ${id.loc.start.line} sits under an inner W`); bad++; }
    }
    const pr = parent.get(id);
    if (pr && pr.type === 'Property' && pr.shorthand && pr.value === id) {
      edits.push({ at: id.range[0], end: id.range[1], text: `${name}: W.${name}` });
    } else if (pr && pr.type === 'Property' && pr.shorthand && pr.value && pr.value.type === 'AssignmentPattern' && pr.value.left === id) {
      console.error(`${name}: line ${id.loc.start.line}: shorthand with a default, do it by hand`); bad++;
    } else {
      edits.push({ at: id.range[0], end: id.range[1], text: `W.${name}` });
    }
    n++;
  }
  console.log(`${name.padEnd(14)} ${n} reference${n === 1 ? '' : 's'}, declared line ${v.identifiers[0].loc.start.line}`);
}
if (bad) { console.error(`refused: ${bad} problem(s)`); process.exit(1); }
if (dry) return;

// Shorthand keys were matched on the value node; with a shorthand, key and value share a
// range, so one edit covers both. Apply from the end.
edits.sort((a, b) => b.at - a.at);
let out = src;
let prev = Infinity;
for (const e of edits) {
  if (e.end > prev) throw new Error('overlapping edits at ' + e.at);
  out = out.slice(0, e.at) + e.text + out.slice(e.end);
  prev = e.at;
}
fs.writeFileSync(FILE, crlf ? out.replace(/\n/g, '\r\n') : out);
console.log(`rewrote ${edits.length} references in src/game/Game.js`);
