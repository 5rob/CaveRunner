// Screenshots for the owner (CaveRunner Auto, feedback round 1): the level's sure blocked zone (auto/level.js plantWall), phone
// size (412 x 880 @2.625). A fresh run (starter gun, the Buzzsaw in the bag); the wall knobs at 3 s so the shot doesn't
// wait (only where it is changes, not how it looks); creatures do no damage.
//   w-<level>-<variant>.png   the team stopped at the sure blocked zone, "Path blocked" (levels 1, 3, 4)
//   node tools/wallshots.js [outdir]      (default tests/build/autoshots)
// Not a test: it takes the picture and prints what it shows.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  for (let [lvl, look] of [[1, ''], [3, ''], [4, '']]) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(l => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = l; localStorage.removeItem('caverunner-auto-run'); }, lvl);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.evaluate(() => { Object.assign(DEV, { autoWallMin: 3, autoWallMax: 3, autoFoeDmg: 0 }); saveAutoRun(newRun(9)); });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  let hit = false;
  for (let i = 0; i < 300 && !hit; i++) {
    await page.waitForTimeout(100);
    hit = await page.evaluate(() => { const S = window.__autoScene; return !!(S && levelState(S).blocked && S.pace === 0); });
  }
  await page.waitForTimeout(1200);
  look = await page.evaluate(() => { const L = levelState(window.__autoScene), Z = L.plan.zp.z.find(z => z.blk && z.blk.x0 === L.plan.wallX); return Z ? Z.blk.variant : '?'; });
  const n = 'w-' + lvl + '-' + look + '.png';
  await page.screenshot({ path: path.join(OUT, n) });
  console.log(n + '  ' + (hit ? '' : '(never got there) ') + 'the team stopped at the first wall (' + look + '), Path blocked');
  await ctx.close();
  }
  await browser.close();
})();
