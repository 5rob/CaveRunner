// v0.0.132: the version is major.minor.patch, and the app compares an update number worked out from
// it (X × 1,000,000 + Y × 1,000 + Z, tools/build.js). An app installed before then reads versions as
// a plain number (MainActivity.verNum: `VERSION = 'v(\d+)'` in the page, else the first number in
// version.txt): both still have to come out as the update number, bigger than the last v131, or the
// phone never offers another update. The new app's reading (semver first) agrees.
const fs = require('fs');
const path = require('path');
const G = require('../load');
const build = require('../../tools/build');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const v = build.version(), n = build.code(v);
// the old app's verNum, as it was in MainActivity.java up to v131
const oldNum = s => { let m = /VERSION\s*=\s*'v(\d+)'/.exec(s); if (m) return +m[1]; m = /v?(\d+)/.exec(s); return m ? +m[1] : 0; };
// the new one: semver first
const newNum = s => { const m = /v(\d+)\.(\d+)\.(\d+)/.exec(s); return m ? +m[1] * 1e6 + +m[2] * 1e3 + +m[3] : oldNum(s); };
// version.txt as CI writes it (.github/workflows/android.yml)
const yml = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'android.yml'), 'utf8');
const ci = /node -e "(.*version\.txt.*)"/.exec(yml)[1];
const site = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cr-ver-'));
fs.mkdirSync(path.join(site, '_site'));
fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(site, 'index.html'));
require('child_process').execFileSync(process.execPath, ['-e', ci], { cwd: site });
const txt = fs.readFileSync(path.join(site, '_site', 'version.txt'), 'utf8').trim();
fs.rmSync(site, { recursive: true, force: true });

check('the version is vX.Y.Z', /^v\d+\.\d+\.\d+$/.test(v) && G.VERSION === v, v);
check('its update number: X × 1,000,000 + Y × 1,000 + Z', build.code('v0.0.132') === 132 && build.code('v0.1.0') === 1000 && build.code('v1.2.3') === 1002003);
check('the page shows the label', html.includes("const VERSION = '" + v + "';") && html.includes('<title>CaveRunner ' + v + '</title>'));
check('version.txt is "<number> <label>"', txt === n + ' ' + v, txt);
check('an old app reads the number from version.txt', oldNum(txt) === n, oldNum(txt));
check('and from the page (the update it downloads must match)', oldNum(html) === n, oldNum(html));
check('it is past the last old-style version (v131)', n > 131, n);
check('the new app reads the same', newNum(txt) === n && newNum(html) === n, [newNum(txt), newNum(html)]);
check('the Java has the semver reading', /v\(\\\\d\+\)\\\\\.\(\\\\d\+\)\\\\\.\(\\\\d\+\)/.test(
  fs.readFileSync(path.join(ROOT, 'android', 'app', 'src', 'main', 'java', 'com', 'caverunner', 'app', 'MainActivity.java'), 'utf8')));

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
