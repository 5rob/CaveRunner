// Builds index.html from src/. Plain Node, no dependencies.
//
//   node tools/build.js          build once
//
// src/shell.html is the page skeleton; each /*@@file@@*/ line in it is replaced by that
// file from src/ (style.css, main.js). The output keeps the line endings the checked-out
// index.html already has (a Windows checkout may hand us CRLF), and is only written when
// it actually changes.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'index.html');

const read = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

function build() {
  let html = read(path.join(SRC, 'shell.html'))
    .replace(/\/\*@@([\w.]+)@@\*\/\n/g, (_, f) => read(path.join(SRC, f)));
  const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  if (old && old.includes('\r\n')) html = html.replace(/\n/g, '\r\n');
  if (html === old) return false;
  fs.writeFileSync(OUT, html);
  return true;
}

module.exports = build;

if (require.main === module) console.log(build() ? 'index.html built' : 'index.html up to date');
