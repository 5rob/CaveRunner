// One loader for every logic suite: `const G = require('../load');` hands back an object
// holding every top-level name the game defines above `function Game(` (MODS, planCast,
// makeLevel, DEV, CW, …), plus the ImageData shim the level code needs under Node.
//
// Suites don't care where the code lives: today it is sliced out of the built index.html
// (tests/run.js builds it from src/ first); later this file's inside switches to the
// modules in src/, and no suite has to change.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
// the bundle is one iife, `(() => { ... })();`: take its body. VERSION isn't in it: the page
// declares it in a script of its own just before (see tools/build.js), so add that back.
const VERSION = /<script>const VERSION = '(v\d+)';<\/script>/.exec(src)[1];
const head = "const VERSION = '" + VERSION + "';\n" +
  js.slice(js.indexOf('(() => {\n') + 9, js.indexOf('function Game('));

// Which names are top-level? Rather than parse the declarations, take every word in the
// code and keep the ones that resolve inside the game's scope but not in an empty one.
// Locals inside functions don't resolve at the top, and globals (Math, …) resolve in both.
const RESERVED = new Set(('break case catch class const continue debugger default delete do else export ' +
  'extends false finally for function if import in instanceof new null return super switch this throw ' +
  'true try typeof var void while with yield let static enum await implements package protected ' +
  'interface private public arguments eval undefined').split(' '));
const words = [...new Set(head.match(/[A-Za-z_$][\w$]*/g))].filter(w => !RESERVED.has(w));
const probe = w => `try { ${w}; __o.${w} = true; } catch (e) {}\n`;
const inEmpty = new Function('const __o = {};\n' + words.map(probe).join('') + 'return __o;')();
const names = ['ImageData', ...words.filter(w => !inEmpty[w] && w !== 'ImageData' && w !== 'React')];

const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }\n';
const pick = names.map(w => `try { __o.${w} = ${w}; } catch (e) {}\n`).join('');
const G = new Function('React', shim + head + '\nconst __o = {};\n' + pick + 'return __o;')(
  { createElement: () => {} });

// the whole game script as text, for the few checks that look at the code itself
// ("every creature body has a sprite"). Not enumerable, so it isn't mistaken for a game name.
Object.defineProperty(G, 'source', { value: js });
module.exports = G;
