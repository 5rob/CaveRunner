// One loader for every logic suite: `const G = require('../load');` hands back an object
// holding every pure name the game has (MODS, planCast, makeLevel, DEV, CW, …), plus the
// ImageData shim the level code needs under Node.
//
// Suites don't care where the code lives: this bundles src/pure.js (which re-exports every
// module under src/, and main.js's own export list) with esbuild, in memory, to CommonJS,
// runs it, and returns its exports. No suite changes when code moves between modules.
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const SRC = path.join(__dirname, '..', 'src');
const read = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF

const code = esbuild.buildSync({
  entryPoints: [path.join(SRC, 'pure.js')],
  bundle: true, format: 'cjs', charset: 'utf8', treeShaking: false,
  write: false, logLevel: 'silent',
}).outputFiles[0].text;

// What the page provides and Node doesn't. main.js still runs top to bottom, so it also
// meets the mount line at its end: a React stub (nothing renders), a ReactDOM and a
// document that do nothing. VERSION is the page's global (see tools/build.js).
class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }
const React = { createElement: () => {} };
const ReactDOM = { createRoot: () => ({ render: () => {} }) };
const document = { getElementById: () => null };
const VERSION = /VERSION = '(v\d+\.\d+\.\d+)';/.exec(read(path.join(SRC, 'version.js')))[1];

const mod = { exports: {} };
new Function('module', 'exports', 'require', 'ImageData', 'React', 'ReactDOM', 'document', 'VERSION', code)(
  mod, mod.exports, require, ImageData, React, ReactDOM, document, VERSION);
// a plain object (esbuild's exports are getters): nothing at the top level is reassigned
const G = Object.assign({ ImageData }, mod.exports);

// all of the game's code as text, for the few checks that look at the code itself
// ("every creature body has a sprite"). Not enumerable, so it isn't mistaken for a game name.
const all = [];
const walk = dir => {
  for (const f of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.js')) all.push(read(p));
  }
};
walk(SRC);
Object.defineProperty(G, 'source', { value: all.join('\n') });
module.exports = G;
