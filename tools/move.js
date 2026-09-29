// Refactor helper (REFACTOR.md, P1.5): moves top-level statements out of src/main.js into a
// module, and rewrites the imports on both sides. Delete it once the split is done.
//
//   node tools/move.js <module> [--about "one line"] <what>...
//
//   <module>   path under src/, e.g. core/consts.js (created, or appended to)
//   <what>     a top-level name (CELL, planCast), or @N (the statement on line N of
//              main.js), or @N-M (every statement starting on lines N..M)
//   --about    the module's header comment, for a new module
//   --dry      print what would move and the imports, write nothing
//
// A statement moves with the comment lines above it. Declarations get `export` in front.
// Then the imports of the module and of main.js are worked out from scratch: every free
// name that some module in src/ exports is imported from it. A free name still declared in
// main.js stops the move (it would be a circular import: move that name too, or first).
// main.js's `export { … }` list (what tests/load.js sees through src/pure.js) loses the
// moved names, and pure.js gains `export * from` the module.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const MAIN = path.join(SRC, 'main.js');
const PURE = path.join(SRC, 'pure.js');
const eslintDir = path.dirname(require.resolve('eslint'));
const espree = require(require.resolve('espree', { paths: [eslintDir] }));
const globals = require('globals');
const { Linter } = require('eslint');

const readN = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const crlf = fs.readFileSync(MAIN, 'utf8').includes('\r\n');
const writeN = (f, s) => fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s);
const parse = s => espree.parse(s, { ecmaVersion: 'latest', sourceType: 'module', loc: true, range: true });

const KNOWN = new Set([...Object.keys(globals.browser), ...Object.keys(globals.builtin), 'React', 'ReactDOM', 'VERSION']);

// names a top-level statement declares
function declared(st) {
  const out = [];
  const bind = id => {
    if (!id) return;
    if (id.type === 'Identifier') out.push(id.name);
    else if (id.type === 'ObjectPattern') for (const q of id.properties) bind(q.value || q.argument);
    else if (id.type === 'ArrayPattern') for (const q of id.elements) bind(q);
    else if (id.type === 'AssignmentPattern') bind(id.left);
    else if (id.type === 'RestElement') bind(id.argument);
  };
  const d = st.type === 'ExportNamedDeclaration' ? st.declaration : st;
  if (!d) return out;
  if (d.type === 'VariableDeclaration') for (const x of d.declarations) bind(x.id);
  else if (d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') bind(d.id);
  return out;
}

// every free name in a module's text (imports taken out first), via no-undef with no globals
function freeNames(text) {
  const linter = new Linter();
  const msgs = linter.verify(text, [{ languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: {} },
    rules: { 'no-undef': 'error' } }]);
  const fatal = msgs.find(m => m.fatal);
  if (fatal) throw new Error('parse error: ' + fatal.message + ' at line ' + fatal.line);
  return [...new Set(msgs.map(m => /'(.+)' is not defined/.exec(m.message)).filter(Boolean).map(m => m[1]))];
}

// every module under src/ (not main.js / pure.js) and the names it exports
function moduleExports(skip) {
  const out = new Map();
  const walk = dir => {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) { walk(p); continue; }
      // version.js too: VERSION is the page's global, never imported (REFACTOR.md, D7)
      if (!f.endsWith('.js') || p === MAIN || p === PURE || p === skip || f === 'version.js') continue;
      const names = [];
      for (const st of parse(readN(p)).body) if (st.type === 'ExportNamedDeclaration') {
        names.push(...declared(st));
        for (const sp of st.specifiers || []) names.push(sp.exported.name);
      }
      out.set(p, names);
    }
  };
  walk(SRC);
  return out;
}

// the text without its import statements, and the leading comment block
function stripImports(text) {
  const ast = parse(text);
  const lines = text.split('\n');
  const drop = new Set();
  for (const st of ast.body) if (st.type === 'ImportDeclaration')
    for (let l = st.loc.start.line; l <= st.loc.end.line; l++) drop.add(l);
  return lines.filter((_, i) => !drop.has(i + 1)).join('\n');
}

// import lines for `file` covering every free name some module exports
function importsFor(file, text, mainDecl, exportsMap) {
  const need = new Map();
  const problems = [];
  for (const n of freeNames(text)) {
    const from = [...exportsMap].filter(([, names]) => names.includes(n)).map(([p]) => p);
    if (from.length > 1) problems.push(n + ' is exported by ' + from.join(' and '));
    else if (from.length === 1) { if (!need.has(from[0])) need.set(from[0], []); need.get(from[0]).push(n); }
    else if (mainDecl && mainDecl.has(n)) problems.push(n + ' is still in main.js');
    else if (!KNOWN.has(n)) problems.push(n + ' is not defined anywhere');
  }
  const order = [...exportsMap.keys()];
  const lines = [...need].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map(([p, names]) => {
    let rel = path.relative(path.dirname(file), p).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = './' + rel;
    const list = names.sort();
    const one = 'import { ' + list.join(', ') + " } from '" + rel + "';";
    if (one.length <= 100) return one;
    const rows = [];
    let row = '';
    for (const n of list) {
      if (row && (row + ', ' + n).length > 94) { rows.push(row + ','); row = n; }
      else row = row ? row + ', ' + n : n;
    }
    rows.push(row);
    return 'import {\n  ' + rows.join('\n  ') + "\n} from '" + rel + "';";
  });
  return { lines, problems };
}

function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const ai = args.indexOf('--about');
  const about = ai >= 0 ? args[ai + 1] : null;
  const rest = args.filter((a, i) => a !== '--dry' && (ai < 0 || (i !== ai && i !== ai + 1)));
  const target = path.join(SRC, rest[0]);
  const want = rest.slice(1);
  if (!rest[0] || !want.length) throw new Error('usage: node tools/move.js <module> [--about "…"] <name|@N|@N-M>...');

  let text = readN(MAIN);
  const ast = parse(text);
  const lines = text.split('\n');
  const body = ast.body;

  // which statements move
  const pick = new Set();
  for (const w of want) {
    const m = /^@(\d+)(?:-(\d+))?$/.exec(w);
    let hit = body.filter(st => m
      ? (m[2] ? st.loc.start.line >= +m[1] && st.loc.start.line <= +m[2] : st.loc.start.line <= +m[1] && st.loc.end.line >= +m[1])
      : declared(st).includes(w));
    hit = hit.filter(st => st.type !== 'ImportDeclaration' && !(st.type === 'ExportNamedDeclaration' && !st.declaration));
    if (!hit.length) throw new Error('nothing matches ' + w);
    for (const st of hit) pick.add(st);
  }

  // each statement owns its lines plus the comment/blank lines above it, except indented
  // comment lines straight after a statement: those continue its trailing comment
  const own = new Map();
  let prevEnd = 0, prev = null;
  for (const st of body) {
    if (st.loc.start.line === prevEnd && (pick.has(st) || pick.has(prev)))
      throw new Error('line ' + prevEnd + ' holds two statements: split it by hand first');
    if (prev) {
      let e = prevEnd;
      while (e + 1 < st.loc.start.line && /^\s+\/\//.test(lines[e])) e++;
      own.get(prev)[1] = e;
      prevEnd = e;
    }
    own.set(st, [Math.min(prevEnd + 1, st.loc.start.line), st.loc.end.line]);
    prevEnd = st.loc.end.line;
    prev = st;
  }

  const moved = [];
  const cut = new Set();
  const names = [];
  for (const st of body) if (pick.has(st)) {
    const [a, b] = own.get(st);
    const chunk = lines.slice(a - 1, b);
    const dl = declared(st);
    if (dl.length && st.type !== 'ExportNamedDeclaration') {
      const k = st.loc.start.line - a;
      const col = st.loc.start.column;
      chunk[k] = chunk[k].slice(0, col) + 'export ' + chunk[k].slice(col);
    }
    names.push(...dl);
    moved.push(...chunk);
    for (let l = a; l <= b; l++) cut.add(l);
  }
  while (moved.length && !moved[0].trim()) moved.shift();

  // main.js without the moved lines (no run of more than one blank line at a cut)
  let left = lines.filter((_, i) => !cut.has(i + 1)).join('\n').replace(/\n{3,}/g, '\n\n');

  // the module: header, (imports), old body, moved code
  let modBody = '';
  let header = '';
  if (fs.existsSync(target)) {
    const old = stripImports(readN(target));
    const hm = /^(\/\/.*\n)+\n?/.exec(old);
    header = hm ? hm[0].replace(/\n+$/, '\n') : '';
    modBody = old.slice(hm ? hm[0].length : 0).replace(/\s+$/, '') + '\n\n';
  } else {
    header = about ? about.split('\\n').map(l => '// ' + l).join('\n') + '\n' : '';
  }
  modBody += moved.join('\n').replace(/\s+$/, '') + '\n';

  // main.js's export list loses the moved names (before anything parses main.js: an
  // export of an undeclared name is a parse error)
  const drop = new Set(names);
  left = left.replace(/^export \{\n([\s\S]*?)\n\};\n*/m, (all, list) => {
    const keep = list.split(/[\s,]+/).filter(n => n && !drop.has(n));
    if (!keep.length) return '';
    const rows = [];
    let row = '';
    for (const n of keep) {
      if (row && (row + ', ' + n).length > 94) { rows.push(row + ','); row = n; }
      else row = row ? row + ', ' + n : n;
    }
    rows.push(row);
    return 'export {\n  ' + rows.join('\n  ') + '\n};\n\n';
  });

  const exportsMap = moduleExports(null);
  const oldOwn = exportsMap.get(target) || [];
  exportsMap.delete(target);   // the module doesn't import from itself
  const mainDecl = new Set(parse(left).body.flatMap(declared));
  const modImp = importsFor(target, modBody, mainDecl, exportsMap);
  if (modImp.problems.length) throw new Error(rest[0] + ' needs:\n  ' + modImp.problems.join('\n  '));
  const modText = header + (modImp.lines.length ? (header ? '\n' : '') + modImp.lines.join('\n') + '\n' : '') + '\n' + modBody;

  exportsMap.set(target, oldOwn.concat(names));
  // a module's own export line (its re-export in pure.js) is not a use of it
  const noImp = stripImports(left);
  const mainImp = importsFor(MAIN, noImp, null, exportsMap);
  if (mainImp.problems.length) throw new Error('main.js needs:\n  ' + mainImp.problems.join('\n  '));
  // imports go after main.js's leading comment block, if any
  const hm = /^(\/\/.*\n)*/.exec(noImp);
  const newMain = noImp.slice(0, hm[0].length) + mainImp.lines.join('\n') + '\n\n' +
    noImp.slice(hm[0].length).replace(/^\n+/, '');

  let pure = fs.existsSync(PURE) ? readN(PURE) : '';
  const rel = './' + path.relative(SRC, target).replace(/\\/g, '/');
  const line = "export * from '" + rel + "';";
  if (pure && !pure.includes(line)) pure = pure.replace(/\s*$/, '\n') + line + '\n';

  console.log('moving ' + names.length + ' names (' + [...cut].length + ' lines) to ' + rest[0] + ':');
  console.log('  ' + names.join(', '));
  console.log(rest[0] + ' imports:\n  ' + (modImp.lines.join('\n  ') || '(nothing)'));
  if (dry) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  writeN(target, modText);
  writeN(MAIN, newMain);
  if (pure) writeN(PURE, pure);
}

try { main(); } catch (e) { console.log(e.message); process.exit(1); }
