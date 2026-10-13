// Screenshots for the owner (v1.0.79): in a level, Dev mode on: the performance graphs bottom right of the play area and
// the level map's outline round the view; then the graphs tapped off.
//   node tools/fpsshots.js [outdir]      (default tests/build/autoshots)
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
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 5; localStorage.removeItem('caverunner-auto-run'); localStorage.setItem('caverunner-devshow', '1'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.evaluate(() => saveAutoRun(newRun()));
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(8000);
  const n = await page.evaluate(() => { const c = document.querySelector('.aplaycvs'); return c && c.dataset.fps; });
  await page.screenshot({ path: path.join(OUT, 'fps.png') });
  console.log('fps.png  a level: the performance graphs bottom right, the map outline  ' + JSON.stringify({ buckets: n }));
  await page.locator('.aperf').dispatchEvent('pointerdown');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'fps-off.png') });
  console.log('fps-off.png  the graphs tapped off: a dim perf in their place');
  await browser.close();
})().catch(e => { console.log(e); process.exit(1); });
