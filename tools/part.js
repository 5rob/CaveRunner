// Refactor helper for P3.4's last step (REFACTOR.md, "step() and draw(): the plan", step 3):
// cuts a run of whole top-level statements out of a big function into a part function.
//
//   node tools/part.js <file.js> <fn> <from>-<to> <target.js> <part> [--dry] [--doc "line\nline"] [--about "header"]
//
// file.js, target.js: paths from the repo root (target may be file.js itself, or a new module:
//   give that one a header with --about). Lines are 1-based and inclusive, and must cover whole
//   statements of fn's own body (comment lines at either end are fine).
// The part is appended to the target as `export function part(W, G, F) { … }` (each of W, G and
// F only if used), with --doc as `//` lines above it, and the lines become one call, `part(W, G, F);`.
//
// fn's locals that the lines use: W and G are passed; the fields of fn's per-frame object
// `const F = { … }` (dt, LO, …) are read back by a `const { … } = F;` first line, so the moved
// text stays word for word what it was. Refuses (changing nothing) if the lines use any other
// local of fn declared outside them, declare one that is used after them, or hold one of fn's
// own `return`s: those need doing by hand first. The imports of both files are worked out again
// from what each uses (existing imports first, then every module's `export`s under src/); a new
// module gets its `export * from` line in src/pure.js (a render/ one after the other render lines).
// VERSION is never imported (the page's global, D7). Keeps the files' line endings.
const fs = require('fs');
const path = require('path');
const espree = require('espree');
const escope = require('eslint-scope');
const globals = require('globals');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const args = process.argv.slice(2);
const opt = {};
const rest = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dry') opt.dry = true;
  else if (args[i] === '--doc') opt.doc = args[++i];
  else if (args[i] === '--about') opt.about = args[++i];
  else rest.push(args[i]);
}
const [fileArg, fnName, span, targetArg, part] = rest;
if (!part || !/^\d+-\d+$/.test(span)) {
  console.error('usage: node tools/part.js <file.js> <fn> <from>-<to> <target.js> <part> [--dry] [--doc text] [--about text]');
  process.exit(2);
}
const [L0, L1] = span.split('-').map(Number);
const FILE = path.join(ROOT, fileArg), TARGET = path.join(ROOT, targetArg), same = FILE === TARGET;

const read = f => { const raw = fs.readFileSync(f, 'utf8'); return { crlf: raw.includes('\r\n'), src: raw.replace(/\r\n/g, '\n') }; };
const write = (f, text, crlf) => fs.writeFileSync(f, crlf ? text.replace(/\n/g, '\r\n') : text);
const parse = src => espree.parse(src, { ecmaVersion: 'latest', sourceType: 'module', range: true, loc: true });
const analyze = ast => escope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
let bad = 0;
const no = msg => { console.error(msg); bad++; };
const stop = () => { if (bad) { console.error(`refused: ${bad} problem(s)`); process.exit(1); } };

const S = read(FILE), src = S.src;
const ast = parse(src), sm = analyze(ast);
let fn = null;
for (const st of ast.body) {
  const d = st.type === 'ExportNamedDeclaration' ? st.declaration : st;
  if (d && d.type === 'FunctionDeclaration' && d.id.name === fnName) fn = d;
}
if (!fn) { console.error(`${fnName}: not a top-level function of ${fileArg}`); process.exit(1); }
const fnScope = sm.acquire(fn);

// the character range of the lines
const lineStart = [0];
for (let i = 0; i < src.length; i++) if (src[i] === '\n') lineStart.push(i + 1);
const A = lineStart[L0 - 1], B = lineStart[L1];
if (A === undefined || B === undefined) { console.error('lines out of range'); process.exit(1); }
if (A < fn.body.range[0] || B > fn.body.range[1]) no(`lines ${span} aren't inside ${fnName}'s body`);
for (const st of fn.body.body) {
  const inA = st.range[0] >= A && st.range[0] < B, inB = st.range[1] > A && st.range[1] <= B;
  if (inA !== inB) no(`a statement at line ${st.loc.start.line}-${st.loc.end.line} crosses the cut`);
}
const inside = r => r[0] >= A && r[1] <= B;
stop();

// F's fields, from `const F = { … }` in fn's body
const FKEYS = [];
for (const st of fn.body.body) if (st.type === 'VariableDeclaration')
  for (const d of st.declarations) if (d.id.name === 'F' && d.init && d.init.type === 'ObjectExpression')
    for (const p of d.init.properties) if (p.key) FKEYS.push(p.key.name);

// what the lines use of fn's own locals, and what they declare that's used later
const use = { W: false, G: false, F: false };
const fields = new Set();
for (const v of fnScope.variables) {
  const decl = v.defs.length ? v.defs[0].name.range : null;
  const declIn = decl && inside(decl);
  for (const r of v.references) {
    const rin = inside(r.identifier.range);
    if (declIn && !rin) { no(`${v.name}: declared in the lines, used at line ${r.identifier.loc.start.line}`); break; }
    if (!declIn && rin) {
      if (v.name === 'W' || v.name === 'G' || v.name === 'F') use[v.name] = true;
      else if (FKEYS.includes(v.name)) { use.F = true; fields.add(v.name); }
      else { no(`${v.name}: a local of ${fnName} (line ${decl ? src.slice(0, decl[0]).split('\n').length : '?'}) that isn't in F`); break; }
    }
  }
}
(function walk(n, own) {
  if (!n || typeof n.type !== 'string') return;
  if (n !== fn && /Function/.test(n.type)) own = false;
  if (own && n.type === 'ReturnStatement' && inside(n.range)) no(`a return of ${fnName} at line ${n.loc.start.line}`);
  for (const k in n) {
    const v = n[k];
    if (Array.isArray(v)) v.forEach(c => walk(c, own));
    else if (v && typeof v.type === 'string' && k !== 'parent') walk(v, own);
  }
})(fn, true);
stop();

const params = ['W', 'G', 'F'].filter(n => use[n]).join(', ');
const destr = fields.size ? `  const { ${FKEYS.filter(k => fields.has(k)).join(', ')} } = F;\n` : '';
const doc = opt.doc ? opt.doc.split('\\n').join('\n').split('\n').map(l => '// ' + l).join('\n') + '\n' : '';
const body = src.slice(A, B);
const partText = `${doc}export function ${part}(${params}) {\n${destr}${body}}\n`;
const callText = `  ${part}(${params});\n`;

// ---- imports ----
const KNOWN = new Set([...Object.keys(globals.browser), ...Object.keys(globals.builtin), 'React', 'ReactDOM', 'VERSION']);
const exportsOf = new Map();     // name -> [module paths]
(function walkDir(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walkDir(p);
    else if (f.endsWith('.js') && p !== path.join(SRC, 'version.js')) {   // VERSION is the page's global, never imported (D7)
      const t = read(p).src;
      for (const x of t.matchAll(/^export (?:async )?(?:function\*?|const|let|class) ([A-Za-z_$][\w$]*)/gm)) {
        if (!exportsOf.has(x[1])) exportsOf.set(x[1], []);
        exportsOf.get(x[1]).push(p);
      }
    }
  }
})(SRC);
if (exportsOf.has(part)) no(`${part}: already exported by ${exportsOf.get(part).map(p => path.relative(ROOT, p)).join(', ')}`);
const rel = (from, to) => { let r = path.relative(path.dirname(from), to).split(path.sep).join('/'); return r.startsWith('.') ? r : './' + r; };
const importsOf = a => {
  const m = new Map();
  for (const st of a.body) if (st.type === 'ImportDeclaration') for (const s of st.specifiers) m.set(s.local.name, st.source.value);
  return m;
};
const srcImports = importsOf(ast);    // as written in file.js; resolved to absolute below
const absOf = (from, spec) => path.join(path.dirname(from), spec);
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
// the import block `text` (module at `file`) needs; `extra` = names another file defines now
function reimport(file, text, extra) {
  const a = parse(text), sc = analyze(a);
  const had = importsOf(a);
  const mod = sc.scopes.find(s => s.type === 'module');
  const own = new Set(); for (const st of a.body) if (st.type === 'ImportDeclaration') st.specifiers.forEach(s => own.add(s.local.name));
  const free = new Set();
  for (const r of sc.globalScope.through) free.add(r.identifier.name);
  for (const v of mod.variables) if (own.has(v.name) && v.references.length) free.add(v.name);
  const want = new Map();
  for (const n of free) {
    let s = had.get(n);
    if (!s && extra.has(n)) s = rel(file, extra.get(n));
    if (!s && srcImports.has(n)) s = rel(file, absOf(FILE, srcImports.get(n)));
    if (!s && exportsOf.has(n)) {
      const ps = exportsOf.get(n).filter(p => p !== file);
      if (ps.length > 1) { no(`${path.relative(ROOT, file)}: ${n} is exported by several modules`); continue; }
      if (ps.length) s = rel(file, ps[0]);
    }
    if (!s && KNOWN.has(n)) continue;
    if (!s) { no(`${path.relative(ROOT, file)}: can't tell where ${n} comes from`); continue; }
    if (!want.has(s)) want.set(s, new Set());
    want.get(s).add(n);
  }
  const decls = a.body.filter(s => s.type === 'ImportDeclaration');
  const keep = new Map();
  for (const d of decls) keep.set(d.source.value, { text: text.slice(d.range[0], d.range[1]), names: new Set(d.specifiers.map(s => s.local.name)) });
  const lines = [];
  for (const s of [...want.keys()].sort()) {
    const k = keep.get(s), w = want.get(s);
    lines.push(k && k.names.size === w.size && [...w].every(n => k.names.has(n)) ? k.text : fmtImport(w, s));
  }
  const block = lines.join('\n');
  if (!decls.length) {
    // after the header comment
    const m = /^(?:\/\/.*\n)*\n?/.exec(text);
    return text.slice(0, m[0].length) + (block ? block + '\n\n' : '') + text.slice(m[0].length);
  }
  return text.slice(0, decls[0].range[0]) + block + text.slice(decls[decls.length - 1].range[1]);
}

let file2 = src.slice(0, A) + callText + src.slice(B);
const out = new Map();
if (same) {
  file2 = file2.replace(/\n*$/, '\n') + '\n' + partText;
  out.set(FILE, { text: reimport(FILE, file2, new Map()), crlf: S.crlf });
} else {
  const isNew = !fs.existsSync(TARGET);
  if (isNew && opt.about === undefined) no(`${targetArg} is new: give it a header with --about`);
  const T = isNew ? { src: (opt.about || '').split('\\n').join('\n').split('\n').map(l => '// ' + l).join('\n') + '\n\n', crlf: S.crlf } : read(TARGET);
  // a name the lines take from file.js's imports mustn't mean something else in the target
  if (!isNew) {
    const ta = parse(T.src), tsc = analyze(ta).scopes.find(s => s.type === 'module');
    const tdef = new Map(tsc.variables.map(v => [v.name, v]));
    const pa = parse(partText), pfree = new Set(analyze(pa).globalScope.through.map(r => r.identifier.name));
    for (const n of pfree) {
      const v = tdef.get(n);
      if (!v || !srcImports.has(n)) continue;
      const imp = v.defs[0] && v.defs[0].type === 'ImportBinding' ? absOf(TARGET, v.defs[0].parent.source.value) : TARGET;
      if (path.normalize(imp) !== path.normalize(absOf(FILE, srcImports.get(n)))) no(`${n}: means something else in ${targetArg}`);
    }
  }
  let t2 = T.src.replace(/\n*$/, '\n') + '\n' + partText;
  if (isNew) t2 = T.src + partText;
  out.set(TARGET, { text: reimport(TARGET, t2, new Map()), crlf: T.crlf, isNew });
  out.set(FILE, { text: reimport(FILE, file2, new Map([[part, TARGET]])), crlf: S.crlf });
}
stop();

console.log(`${part}(${params})${fields.size ? '  F: ' + [...fields].join(', ') : ''}  <- ${fileArg} ${span} (${L1 - L0 + 1} lines) -> ${targetArg}`);
for (const [f, o] of out) {
  const before = fs.existsSync(f) ? importsOf(parse(read(f).src)) : new Map();
  const after = importsOf(parse(o.text));
  const add = [...after.keys()].filter(n => !before.has(n)), gone = [...before.keys()].filter(n => !after.has(n));
  if (add.length || gone.length) console.log(`  ${path.relative(ROOT, f)}: imports ${add.length ? '+' + add.join(' +') : ''} ${gone.length ? '-' + gone.join(' -') : ''}`);
}
if (opt.dry) { console.log('(dry run)'); process.exit(0); }
for (const [f, o] of out) {
  write(f, o.text, o.crlf);
  if (!o.isNew) continue;
  const P = path.join(SRC, 'pure.js'), p = read(P);
  const line = `export * from './${path.relative(SRC, f).split(path.sep).join('/')}';`;
  if (p.src.includes(line)) continue;
  if (line.includes('/game/render/')) {                 // a render module: after the last render line
    const rs = [...p.src.matchAll(/^export \* from '\.\/game\/render\/.*\n/gm)], last = rs[rs.length - 1];
    write(P, p.src.slice(0, last.index + last[0].length) + line + '\n' + p.src.slice(last.index + last[0].length), p.crlf);
  } else write(P, p.src.replace("export * from './game/systems/step.js';\n", line + '\n' + "export * from './game/systems/step.js';\n"), p.crlf);
}
console.log('done');
