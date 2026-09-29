// Builds index.html from src/.
//
//   node tools/build.js          build once
//   node tools/build.js --watch  rebuild whenever a file in src/ is saved (pair it with
//                                `node serve.js` to see changes on the phone)
//
// src/main.js is bundled with esbuild (dev dependency: `npm install` once) into one plain
// script: format iife, not minified, Unicode kept raw, React and ReactDOM left as the
// globals the two CDN tags in the page provide, and nothing tree-shaken away.
// src/shell.html is the page skeleton; each
// /*@@file@@*/ line in it is replaced by style.css or the bundle, and {{VERSION}} by the
// `VERSION = 'vNN'` in src/version.js. VERSION is written into the page as its own
// un-bundled `<script>const VERSION = 'vNN';</script>` (esbuild would reprint it with double
// quotes, and CI and the Android app look for the single-quoted shape), so the game code
// reads it as a global and the bundle never declares it.
//
// The output keeps the line endings the checked-out index.html already has (a Windows
// checkout may hand us CRLF), and is only written when it actually changes.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'index.html');

const read = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

function esbuild() {
  try { return require('esbuild'); }
  catch (e) { throw new Error('esbuild is missing: run `npm install` in the project folder'); }
}

// the version, from src/version.js
function version() {
  const m = /VERSION = '(v\d+)';/.exec(read(path.join(SRC, 'version.js')));
  if (!m) throw new Error("tools/build.js: no VERSION = 'vNN'; in src/version.js");
  return m[1];
}

// src/main.js and everything it imports, as one script
function bundle() {
  const r = esbuild().buildSync({
    entryPoints: [path.join(SRC, 'main.js')],
    bundle: true, format: 'iife', charset: 'utf8', minify: false,
    treeShaking: false,   // keep code nothing calls yet (groupStats, …): tests still use it
    write: false, logLevel: 'silent',
  });
  return r.outputFiles[0].text;
}

function build() {
  const v = version();
  const files = { 'main.js': bundle() };
  let html = read(path.join(SRC, 'shell.html'))
    .replace(/\{\{VERSION\}\}/g, v)
    .replace(/\/\*@@([\w.]+)@@\*\/\n/g, (_, f) => files[f] || read(path.join(SRC, f)));
  const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  if (old && old.includes('\r\n')) html = html.replace(/\n/g, '\r\n');
  if (html === old) return false;
  fs.writeFileSync(OUT, html);
  return true;
}

module.exports = build;
build.bundle = bundle;
build.version = version;

function watch() {
  const once = () => {
    try { if (build()) console.log(new Date().toLocaleTimeString() + '  index.html rebuilt'); }
    catch (e) { console.log('build failed: ' + e.message); }
  };
  once();
  let timer = null;   // an editor's save can fire several events: wait for them to settle
  fs.watch(SRC, { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(once, 100); });
  console.log('watching src/ (ctrl+c to stop)');
}

if (require.main === module) {
  if (process.argv.includes('--watch')) watch();
  else console.log(build() ? 'index.html built' : 'index.html up to date');
}
