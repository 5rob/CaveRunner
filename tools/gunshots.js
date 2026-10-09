// Screenshots for the owner (CaveRunner Auto stage 5a): a sheet of guns firing through the real planCast in a level,
// phone size (412 x 880 @2.625). Each picture: 4 players, each with its own gun (mods in GUNS below), mid-level.
//   node tools/gunshots.js [outdir]      (default tests/build/autoshots)
// Not a test: it takes the pictures and prints what each shows.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

// two pictures, four guns each (players blue, red, green, gold)
const SHEETS = [
  ['g1-guns', [['bolt', 'homing', null], ['fball', null, null], ['buck', 'bounce', null], ['spark', 'triple', null]]],
  ['g2-guns', [['missile', null, null], ['bubble', 'big', null], ['arrow', 'pierce', 'fast'], ['flamer', null, null]]],
];

(async () => {
  const browser = await launch();
  const said = [];
  for (const [n, guns] of SHEETS) {
    for (const at of [9000, 16000]) {
      const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
      await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 3; localStorage.removeItem('caverunner-auto-run'); });
      const page = await ctx.newPage();
      page.on('pageerror', e => console.log('PAGEERROR', e.message));
      await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
      await page.waitForTimeout(400);
      await page.evaluate(gs => {
        DEV.autoLvlMin = 0.6;
        const run = newRun();
        bagAdd(run, { kind: 'green', n: 3 });
        addPlayer(run); addPlayer(run); addPlayer(run);
        run.players.forEach((p, i) => { const g = p.guns[p.active]; g.slots = gs[i].slice(); g.name = gs[i].filter(Boolean).join(' + '); resetGun(g); });
        saveAutoRun(run);
      }, guns);
      await page.locator('.tstart').dispatchEvent('pointerdown');
      await page.waitForTimeout(at);
      const f = `${n}-${at / 1000}s`;
      await page.screenshot({ path: path.join(OUT, f + '.png') });
      said.push(`${f}.png  ${guns.map((g, i) => ['blue', 'red', 'green', 'gold'][i] + ': ' + g.filter(Boolean).join('+')).join(', ')}`);
      await ctx.close();
    }
  }
  await browser.close();
  console.log(said.join('\n'));
})();
