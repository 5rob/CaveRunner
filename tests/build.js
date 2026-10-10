// Makes tests/build/test.html: the real game, but with React served from disk so the
// tests never depend on the network, and two hooks the browser suites drive it through.
//
//   (autobattler branch, stage 13: the old App is out of the build, so window.__in and
//   window.__lvl are gone; the auto suites set __TEST_TITLE and use the bundle's names)
//   window.__lvl  the live level: the world object W itself (player, enemies, bullets, fields,
//                 beams, pickups, stock, roster, theme; rec / rt: the death replay's recorder
//                 and player), plus sandbox() and placeProp(). Game makes it only when the
//                 page sets window.__TEST, which this does: see src/game/testhook.js.
//
// Nothing here changes game logic. If a test needs to reach something new, add it to
// src/game/testhook.js rather than reaching into the game from the test.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'build');

function build() {
  let s = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const swap = (from, to) => {
    if (!s.includes(from)) throw new Error('build.js is out of date: could not find ' + from);
    s = s.replace(from, to);
  };
  // The suites call game names straight from page.evaluate (MODS, DEV, resetGun, makeLevel…).
  // The bundle is one iife, so its top-level names aren't globals: copy every one onto
  // window as the iife ends. Nothing at the top level is ever reassigned, so the copy is
  // the same value (objects like DEV are the same object). The names come from parsing the
  // bundle with espree, the parser ESLint (a dev dependency) ships with.
  const exposeGlobals = () => {
    const at = s.indexOf('(() => {', s.indexOf("<script>const VERSION = '"));
    const end = s.lastIndexOf('})();', s.indexOf('</script>', at));
    if (at < 0 || end < at) throw new Error('build.js is out of date: could not find the game bundle');
    const espree = require(require.resolve('espree', { paths: [path.dirname(require.resolve('eslint'))] }));
    const iife = espree.parse(s.slice(at, end + 5), { ecmaVersion: 'latest' }).body[0].expression.callee.body.body;
    const names = [];
    const bind = id => {
      if (id.type === 'Identifier') names.push(id.name);
      else if (id.type === 'ObjectPattern') for (const q of id.properties) bind(q.value);
      else if (id.type === 'ArrayPattern') for (const q of id.elements) if (q) bind(q);
    };
    for (const st of iife) {
      if (st.type === 'VariableDeclaration') for (const d of st.declarations) bind(d.id);
      else if (st.id) bind(st.id);   // function and class declarations
    }
    s = s.slice(0, end) + '  Object.assign(window, { ' + names.join(', ') + ' });\n' + s.slice(end);
  };
  swap('https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
    '../lib/react.production.min.js');
  swap('https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
    '../lib/react-dom.production.min.js');
  // the flag that makes Game hand its world to the suites as window.__lvl (src/game/testhook.js)
  swap("<script>const VERSION = '", "<script>window.__TEST = true;</script>\n<script>const VERSION = '");
  // (window.__in, the old App's input ref, went with the old game: autobattler stage 13)
  exposeGlobals();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'test.html'), s);
  return path.join(OUT, 'test.html');
}

if (require.main === module) console.log('built ' + build());
module.exports = build;
