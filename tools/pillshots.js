// Screenshot for the owner (CaveRunner Auto, feedback round 1): the pill stick's knob free out to the old thumbstick's
// reach (54 px), past the pill's edges, held up and to the right in the hub (player 1 jetting). Phone size 412 x 880.
//   p1-pill.png
//   node tools/pillshots.js [outdir]      (default tests/build/autoshots)
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
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(3500);
  const box = await page.locator('.apill').boundingBox();
  const mx = box.x + box.width / 2, my = box.y + box.height / 2;
  await page.mouse.move(mx, my); await page.mouse.down();
  await page.mouse.move(mx + 60, my - 60, { steps: 5 });
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, 'p1-pill.png') });
  await page.mouse.up();
  console.log('p1-pill.png  the knob held up-right at full reach, out past the pill; player 1 jetting');
  await browser.close();
})();
