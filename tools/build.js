// Builds index.html from src/. Plain Node, no dependencies.
//
//   node tools/build.js          build once
//   node tools/build.js --watch  rebuild whenever a file in src/ is saved (pair it with
//                                `node serve.js` to see changes on the phone)
//
// src/shell.html is the page skeleton; each /*@@file@@*/ line in it is replaced by that
// file from src/ (style.css, main.js), and {{VERSION}} by the `const VERSION = 'vNN'` in
// main.js, so the version is bumped in one place and the <title> follows. The output
// keeps the line endings the checked-out index.html already has (a Windows checkout may
// hand us CRLF), and is only written when it actually changes.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'index.html');

const read = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

function build() {
  const version = /const VERSION = '(v\d+)';/.exec(read(path.join(SRC, 'main.js')));
  if (!version) throw new Error("tools/build.js: no const VERSION = 'vNN'; in src/main.js");
  let html = read(path.join(SRC, 'shell.html'))
    .replace('{{VERSION}}', version[1])
    .replace(/\/\*@@([\w.]+)@@\*\/\n/g, (_, f) => read(path.join(SRC, f)));
  const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  if (old && old.includes('\r\n')) html = html.replace(/\n/g, '\r\n');
  if (html === old) return false;
  fs.writeFileSync(OUT, html);
  return true;
}

module.exports = build;

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
