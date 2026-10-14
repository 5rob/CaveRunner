// Screenshots for the owner (v1.0.86): White Holes side by side in a level, creatures cleared: left a plain one (reach 64), right
// one with Buff ×2's reach (128). The reach (its rim, the sparkles) grows; the bright core stays the same.
//   node tools/whshots.js [outdir]      (default tests/build/autoshots)
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 4; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(1000);
  await page.evaluate(() => { DEV.autoFoeDmg = 0; DEV.autoFoeCap0 = DEV.autoFoeCap1 = 0; const run = newRun(); run.players[0].guns[0].slots = [null, null, null]; saveAutoRun(run); });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const S = window.__autoScene;
    S.foes.length = 0;
    const y = (S.top + S.bot) / 2 - 20;
    S.shots.push(whiteHole({ r: 64, life: 60 }, 0, 40, y, -1), whiteHole({ r: 128, life: 60 }, 0, 105, y, -1));
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'wh-side.png'), clip: { x: 0, y: 120, width: 412, height: 420 } });
  console.log('wh-side.png  left: a plain White Hole; right: Buff ×2 (twice the reach): a bigger rim and more sparkles, the same core');
  await browser.close();
})();
