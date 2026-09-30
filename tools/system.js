// Refactor helper for P3.4 (REFACTOR.md): moves inner functions of Game's useEffect closure
// out into a system module, src/game/systems/<file>, as plain exported functions.
//
//   node tools/system.js <file> [--dry] [--about "header line\nsecond line"] name...
//
// file: e.g. terrain.js; made (with --about as its header comment) or appended to.
// name: closure-level functions (`function f` or `const f = … =>`), and any constant tables
//       (`const T = {…}`) that only they use. Each goes with the `//` lines right above it.
//       `other.js:name` sends that one to another module instead (for a call cycle, D17, whose
//       functions belong in different systems but have to leave the closure together); a new
//       one of those takes its header from `--about:other.js "text"`.
//
// What a moved function takes (D16): `(W, G, …)` if it needs anything outside the world (a
// canvas, the recorder, `input`: the keys of Game's `const G = {…}`, and `input` itself),
// `(W, …)` if it needs only the world, else just its own arguments. Worked out from what each
// one uses, including what the other moved functions it calls need. Then:
//   - in the moved code, `tctx` -> `G.tctx` (any key of G), `input` -> `G.input`;
//   - every call of a moved function, in Game.js and in the moved code, gets `W, G, ` / `W, `;
//   - a moved function used as a value (a callback, `{ hurt }`) becomes an arrow with its own
//     parameter names, `(x, y) => solidAt(W, x, y)`, printed so it can be looked at;
//   - the imports of the module and of Game.js are worked out again from what each uses
//     (Game.js's own imports, and the exports of every module in systems/);
//   - a new module gets its `export * from` line in src/pure.js.
// Refuses (changing nothing) if moved code uses a closure name that isn't W, G, a key of G or
// moved along with it: move that first, or with it. Keeps the files' line endings.
const fs = require('fs');
const path = require('path');
const espree = require('espree');
const escope = require('eslint-scope');
const globals = require('globals');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const GAME = path.join(SRC, 'game', 'Game.js');
const SYS = path.join(SRC, 'game', 'systems');

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const abouts = {};
const rest = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--about') abouts[''] = args[++i];
  else if (args[i].startsWith('--about:')) abouts[args[i].slice(8)] = args[++i];
  else if (args[i] !== '--dry') rest.push(args[i]);
}
const [file, ...spec] = rest;
if (!file || !spec.length) { console.error('usage: node tools/system.js <file> [--dry] [--about text] name...'); process.exit(2); }
if (abouts[''] !== undefined) abouts[file] = abouts[''];
const target = new Map();       // name -> the module it goes to
for (const s of spec) { const m = /^(.+\.js):(.+)$/.exec(s); target.set(m ? m[2] : s, m ? m[1] : file); }
const names = [...target.keys()];
const files = [...new Set(target.values())];

const read = f => { const raw = fs.readFileSync(f, 'utf8'); return { crlf: raw.includes('\r\n'), src: raw.replace(/\r\n/g, '\n') }; };
const write = (f, text, crlf) => fs.writeFileSync(f, crlf ? text.replace(/\n/g, '\r\n') : text);
const parse = src => espree.parse(src, { ecmaVersion: 'latest', sourceType: 'module', range: true, loc: true });
const analyze = ast => escope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
const parents = ast => {
  const m = new Map();
  (function walk(n, p) {
    if (!n || typeof n.type !== 'string') return;
    m.set(n, p);
    for (const k in n) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach(c => walk(c, n));
      else if (v && typeof v.type === 'string') walk(v, n);
    }
  })(ast, null);
  return m;
};

const G0 = read(GAME), src = G0.src;
const ast = parse(src), sm = analyze(ast), parent = parents(ast);
let game;
for (const st of ast.body) {
  const d = st.type === 'ExportNamedDeclaration' ? st.declaration : st;
  if (d && d.type === 'FunctionDeclaration' && d.id.name === 'Game') game = d;
}
const gameScope = sm.acquire(game);
const eff = game.body.body.find(s => s.type === 'ExpressionStatement' && s.expression.callee &&
  s.expression.callee.name === 'useEffect').expression.arguments[0];
const closure = sm.acquire(eff);
const top = eff.body.body;

// the keys of `const G = { … }`
const GKEYS = new Set();
for (const st of top) if (st.type === 'VariableDeclaration') for (const d of st.declarations)
  if (d.id.name === 'G' && d.init && d.init.type === 'ObjectExpression')
    for (const p of d.init.properties) if (p.key) GKEYS.add(p.key.name);

let bad = 0;
const no = msg => { console.error(msg); bad++; };

// the moved statements
const items = new Map();       // name -> { st, decl (declarator or fn), fn (the function node), kind }
for (const name of names) {
  let hit = null;
  for (const st of top) {
    if (st.type === 'FunctionDeclaration' && st.id.name === name) hit = { st, fn: st };
    if (st.type === 'VariableDeclaration' && st.declarations.some(d => d.id.name === name)) {
      if (st.declarations.length > 1) { no(`${name}: shares its const with others, split it by hand`); continue; }
      const d = st.declarations[0];
      const isFn = d.init && /Function/.test(d.init.type);
      if (st.kind !== 'const') no(`${name}: a ${st.kind}, not a const`);
      hit = { st, fn: isFn ? d.init : null };
    }
  }
  if (!hit) { no(`${name}: not a closure-level function or const of Game`); continue; }
  items.set(name, hit);
}
if (bad) { console.error(`refused: ${bad} problem(s)`); process.exit(1); }

// the text each statement takes: its comment lines above, to the end of its last line
const segs = [];
for (const [name, it] of items) {
  const a0 = it.st.range[0], b0 = it.st.range[1];
  const ls = src.lastIndexOf('\n', a0 - 1) + 1;
  if (src.slice(ls, a0).trim()) no(`${name}: something else sits before it on its line`);
  let le = src.indexOf('\n', b0); if (le < 0) le = src.length;
  const tail = src.slice(b0, le).trim();
  if (tail && !tail.startsWith('//')) no(`${name}: something else follows it on its line`);
  let a = ls;
  for (;;) {
    const pe = a - 1, ps = src.lastIndexOf('\n', pe - 1) + 1;
    if (pe <= 0 || !/^\s*\/\//.test(src.slice(ps, pe))) break;
    a = ps;
  }
  segs.push({ name, a, b: le + 1, st: it.st });
}
segs.sort((x, y) => x.a - y.a);
const inSeg = pos => segs.find(s => pos >= s.a && pos < s.b);

// what each moved item uses from the closure
const need = new Map();         // name -> { W, G, calls: Set }
for (const name of items.keys()) need.set(name, { W: false, G: false, calls: new Set() });
const within = (r, st) => r[0] >= st.range[0] && r[1] <= st.range[1];
const owner = r => { for (const [n, it] of items) if (within(r, it.st)) return n; return null; };
const gRefs = [];               // edits for G keys and input inside moved code
for (const v of closure.variables) {
  for (const r of v.references) {
    const id = r.identifier, o = owner(id.range);
    if (!o || v.identifiers.includes(id)) continue;
    const nd = need.get(o);
    if (v.name === 'W') nd.W = true;
    else if (v.name === 'G') { nd.W = true; nd.G = true; }
    else if (GKEYS.has(v.name)) { nd.G = true; nd.W = true; gRefs.push(id); }
    else if (items.has(v.name)) nd.calls.add(v.name);
    else no(`${o} uses ${v.name} (line ${id.loc.start.line}): not W, G or a key of G; move it first or with it`);
  }
}
const inputVar = gameScope.set.get('input');
for (const r of inputVar ? inputVar.references : []) {
  const o = owner(r.identifier.range);
  if (o) { const nd = need.get(o); nd.G = true; nd.W = true; gRefs.push(r.identifier); }
}
for (let changed = true; changed;) {
  changed = false;
  for (const nd of need.values()) for (const c of nd.calls) {
    const cn = need.get(c);
    if (cn.G && !nd.G) { nd.G = nd.W = true; changed = true; }
    if (cn.W && !nd.W) { nd.W = true; changed = true; }
  }
}
for (const [name, it] of items) if (!it.fn && (need.get(name).W || need.get(name).calls.size)) no(`${name}: a table that uses the closure`);
if (bad) { console.error(`refused: ${bad} problem(s)`); process.exit(1); }
const pre = n => (need.get(n).G ? 'W, G' : need.get(n).W ? 'W' : '');

// the edits, in Game.js coordinates
const edits = [];
for (const id of gRefs) {
  const pr = parent.get(id), key = id.name === 'input' ? 'input' : id.name;
  if (pr && pr.type === 'Property' && pr.shorthand && pr.value === id) edits.push({ at: id.range[0], end: id.range[1], text: `${key}: G.${key}` });
  else edits.push({ at: id.range[0], end: id.range[1], text: `G.${key}` });
}
const paramText = n => {
  const fn = items.get(n).fn;
  if (fn.params.some(p => p.type !== 'Identifier')) return null;
  return fn.params.map(p => p.name).join(', ');
};
const wraps = [];
for (const name of items.keys()) {
  const p = pre(name);
  const v = closure.set.get(name);
  // the declaration: W (and G) in front of its parameters, and `export`
  const it = items.get(name);
  edits.push({ at: it.st.range[0], end: it.st.range[0], text: 'export ' });
  if (p && it.fn) {
    const fn = it.fn;
    if (fn.type === 'ArrowFunctionExpression' && fn.params.length === 1 && src[fn.range[0]] !== '(') {
      const q = fn.params[0];
      edits.push({ at: q.range[0], end: q.range[1], text: `(${p}, ${src.slice(q.range[0], q.range[1])})` });
    } else {
      const open = src.indexOf('(', fn.type === 'FunctionDeclaration' ? fn.id.range[1] : fn.range[0]);
      edits.push({ at: open + 1, end: open + 1, text: fn.params.length ? p + ', ' : p });
    }
  }
  if (!p) continue;
  for (const r of v.references) {
    const id = r.identifier;
    if (v.identifiers.includes(id)) continue;
    const pr = parent.get(id);
    if (pr && pr.type === 'CallExpression' && pr.callee === id) {
      const open = src.indexOf('(', id.range[1]);
      edits.push({ at: open + 1, end: open + 1, text: pr.arguments.length ? p + ', ' : p });
      continue;
    }
    const ps = paramText(name);
    if (ps === null) { no(`${name} is used as a value (line ${id.loc.start.line}) and has non-plain params: do it by hand`); continue; }
    const arrow = `(${ps}) => ${name}(${p}${ps ? ', ' + ps : ''})`;
    if (pr && pr.type === 'Property' && pr.shorthand && pr.value === id) edits.push({ at: id.range[0], end: id.range[1], text: `${name}: ${arrow}` });
    else {
      const bare = pr && ((pr.type === 'CallExpression' && pr.arguments.includes(id)) || pr.type === 'Property' ||
        pr.type === 'VariableDeclarator' || pr.type === 'ArrayExpression');
      edits.push({ at: id.range[0], end: id.range[1], text: bare ? arrow : `(${arrow})` });
    }
    wraps.push(`line ${id.loc.start.line}: ${name} -> ${arrow}`);
  }
}
if (bad) { console.error(`refused: ${bad} problem(s)`); process.exit(1); }

const apply = (text, off, list) => {
  list = list.slice().sort((x, y) => y.at - x.at || y.end - x.end);
  let prev = Infinity;
  for (const e of list) {
    if (e.end > prev) throw new Error('overlapping edits at ' + (e.at + off));
    text = text.slice(0, e.at - off) + e.text + text.slice(e.end - off);
    prev = e.at;
  }
  return text;
};
// the moved pieces, dedented by the closure's four spaces
const pieces = new Map(files.map(f => [f, []]));
segs.forEach((s, i) => {
  const t = apply(src.slice(s.a, s.b), s.a, edits.filter(e => e.at >= s.a && e.at < s.b));
  // pieces that sat together (going to the same module) stay together; others get a blank line between
  const nx = segs.slice(i + 1).find(q => target.get(q.name) === target.get(s.name));
  const gap = nx && nx.a !== s.b ? '\n' : '';
  pieces.get(target.get(s.name)).push(t.split('\n').map(l => l.replace(/^ {4}/, '')).join('\n') + gap);
});
// Game.js without them
let game2 = '', pos = 0;
for (const s of segs) {
  game2 += apply(src.slice(pos, s.a), pos, edits.filter(e => e.at >= pos && e.at < s.a));
  pos = s.b;
}
game2 += apply(src.slice(pos), pos, edits.filter(e => e.at >= pos));
// a blank line left doubled where a piece came out
game2 = game2.replace(/\n\n\n+/g, '\n\n');

// ---- imports ----
const KNOWN = new Set([...Object.keys(globals.browser), ...Object.keys(globals.builtin), 'React', 'ReactDOM', 'VERSION']);
const sysExports = () => {
  const m = new Map();
  if (!fs.existsSync(SYS)) return m;
  for (const f of fs.readdirSync(SYS)) if (f.endsWith('.js')) {
    const t = read(path.join(SYS, f)).src;
    for (const x of t.matchAll(/^export (?:async )?(?:function\*?|const|let|class) ([A-Za-z_$][\w$]*)/gm)) m.set(x[1], f);
  }
  return m;
};
const importsOf = (a) => {
  const m = new Map();      // name -> source as written
  for (const st of a.body) if (st.type === 'ImportDeclaration')
    for (const s of st.specifiers) m.set(s.local.name, st.source.value);
  return m;
};
// free names of a module, and where each comes from; `from(name)` gives a source path
// relative to src/game/, or null
function needed(text, from, who) {
  const a = parse(text), g = analyze(a).globalScope;
  const own = new Set(); for (const st of a.body) if (st.type === 'ImportDeclaration') st.specifiers.forEach(s => own.add(s.local.name));
  const out = new Map();
  const free = new Set();
  for (const r of g.through) free.add(r.identifier.name);
  const modScope = analyze(a).scopes.find(s => s.type === 'module');
  for (const v of modScope.variables) if (own.has(v.name) && v.references.length) free.add(v.name);
  for (const n of free) {
    const s = from(n);
    if (!s && KNOWN.has(n)) continue;          // a browser global (unless something here imports that name)
    if (!s) { no(`${who}: can't tell where ${n} comes from`); continue; }
    if (!out.has(s)) out.set(s, new Set());
    out.get(s).add(n);
  }
  return { a, out };
}
const fmtImport = (names, source) => {
  const ns = [...names].sort();
  const one = `import { ${ns.join(', ')} } from '${source}';`;
  if (one.length <= 100) return one;
  const lines = [];
  let cur = '';
  for (const n of ns) {
    const add = (cur ? cur + ' ' : '  ') + n + ',';
    if (add.length > 99 && cur) { lines.push(cur); cur = '  ' + n + ','; } else cur = add;
  }
  lines.push(cur.replace(/,$/, ''));
  return `import {\n${lines.join('\n')}\n} from '${source}';`;
};
// rewrite a module's import block (the import declarations at its top) for `want`
function reimport(text, want) {
  const a = parse(text);
  const decls = a.body.filter(s => s.type === 'ImportDeclaration');
  const keep = new Map();
  for (const d of decls) keep.set(d.source.value, { text: text.slice(d.range[0], d.range[1]), names: new Set(d.specifiers.map(s => s.local.name)) });
  const lines = [];
  for (const s of [...want.keys()].sort()) {
    const k = keep.get(s), w = want.get(s);
    lines.push(k && k.names.size === w.size && [...w].every(n => k.names.has(n)) ? k.text : fmtImport(w, s));
  }
  const block = lines.join('\n');
  if (!decls.length) return null;
  return text.slice(0, decls[0].range[0]) + block + text.slice(decls[decls.length - 1].range[1]);
}

const gameImports = importsOf(ast);
const sys = sysExports();
const moved = new Set(items.keys());
for (const [n, f] of target) sys.set(n, f);
const fromGame = n => (sys.has(n) ? './systems/' + sys.get(n) : gameImports.get(n) || null);
const fromSys = n => {
  if (sys.has(n)) return './' + sys.get(n);
  const g = gameImports.get(n);
  if (!g) return null;
  if (g.startsWith('./systems/')) return './' + g.slice(10);
  return g.startsWith('./') ? '.' + g : '../' + g;       // ./world.js -> ../world.js, ../x -> ../../x
};

// the modules
const out = new Map();          // file -> { text, crlf, isNew }
for (const f of files) {
  const P = path.join(SYS, f), isNew = !fs.existsSync(P);
  let text, crlf = G0.crlf;
  if (!isNew) {
    const m = read(P); crlf = m.crlf;
    text = m.src.replace(/\n*$/, '\n') + '\n' + pieces.get(f).join('');
  } else {
    if (abouts[f] === undefined) no(`${f} is new: give it a header with --about${f === file ? '' : ':' + f}`);
    text = (abouts[f] || '').split('\\n').join('\n').split('\n').map(l => '// ' + l).join('\n') + '\n\nimport {} from \'x\';\n\n' + pieces.get(f).join('');
  }
  const had = isNew ? new Map() : importsOf(parse(read(P).src));    // what the module imports already
  const mn = needed(text, n => (sys.get(n) === f ? null : had.get(n) || fromSys(n)), f);
  text = reimport(text, mn.out) || text;
  text = text.replace(/\n{3,}/g, '\n\n');     // (a new module that needs no imports)
  out.set(f, { text, crlf, isNew });
}
// Game.js
const gn = needed(game2, fromGame, 'Game.js');
game2 = reimport(game2, gn.out);
if (bad) { console.error(`refused: ${bad} problem(s)`); process.exit(1); }

// names that another module exports too (export * would drop both from src/pure.js)
const clash = [];
const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js') && !files.some(x => p === path.join(SYS, x))) {
  const t = fs.readFileSync(p, 'utf8');
  for (const n of moved) if (new RegExp(`^export (?:async )?(?:function\\*?|const|let|class) ${n.replace('$', '\\$')}\\b`, 'm').test(t)) clash.push(`${n} (${path.relative(SRC, p)})`);
} } };
walk(SRC);
if (clash.length) console.log('NOTE: also exported elsewhere, so src/pure.js drops it: ' + clash.join(', '));

for (const n of items.keys()) console.log(`${n.padEnd(14)} (${pre(n) || 'no world'}${items.get(n).fn ? '' : ', table'}) -> ${target.get(n)}`);
for (const w of wraps) console.log('  as a value, ' + w);
if (dry) { console.log('(dry run)'); return; }
fs.mkdirSync(SYS, { recursive: true });
for (const [f, o] of out) {
  write(path.join(SYS, f), o.text, o.crlf);
  if (!o.isNew) continue;
  const P = path.join(SRC, 'pure.js'), p = read(P);
  const line = `export * from './game/systems/${f}';`;
  if (!p.src.includes(line)) write(P, p.src.replace("export * from './game/Game.js';\n", line + '\n' + "export * from './game/Game.js';\n"), p.crlf);
}
write(GAME, game2, G0.crlf);
console.log(`moved ${items.size} into ${files.map(f => 'src/game/systems/' + f).join(', ')}`);
