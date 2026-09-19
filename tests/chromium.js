// Finds Playwright and a Chromium to drive, wherever this machine keeps them.
//
// The browser suites all get their `chromium` and `launch()` from here so none of
// them has to hardcode a path. Override either with an env var:
//   CAVERUNNER_PLAYWRIGHT=/path/to/playwright-core
//   CAVERUNNER_CHROME=/path/to/chrome
const fs = require('fs');
const { execSync } = require('child_process');

function findModule() {
  const tries = [process.env.CAVERUNNER_PLAYWRIGHT, 'playwright-core', 'playwright'];
  try {                                   // globally installed npm packages, if any
    const root = execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    tries.push(root + '/playwright-core', root + '/playwright');
  } catch (e) { /* no npm on PATH: fine, the others may still work */ }
  for (const t of tries) {
    if (!t) continue;
    try { return require(t); } catch (e) { /* keep looking */ }
  }
  throw new Error('no playwright found. npm i playwright-core, or set CAVERUNNER_PLAYWRIGHT');
}

function findChrome() {
  const tries = [process.env.CAVERUNNER_CHROME,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/chromium', '/usr/bin/google-chrome'];
  for (const t of tries) if (t && fs.existsSync(t)) return t;
  // any chromium- build under the shared browser directory
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    for (const d of fs.readdirSync(dir)) {
      const p = dir + '/' + d + '/chrome-linux/chrome';
      if (d.startsWith('chromium') && fs.existsSync(p)) return p;
    }
  } catch (e) { /* directory not there */ }
  return null;
}

const chrome = findChrome();
module.exports = {
  chromium: findModule().chromium,
  executablePath: chrome,
  available: !!chrome,
  // every suite launches through this, so there is one place to change the flags
  launch: opts => findModule().chromium.launch(Object.assign({ executablePath: chrome }, opts)),
};
