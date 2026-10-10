// Screenshots for the owner (CaveRunner Auto stage 13: New run), phone size (412 x 880 @2.625), the real page
// through the test page: the ⏸ menu with its New run button, then after one tap (asking "Tap again").
//   node tools/newrunshots.js [outdir]      (default tests/build/autoshots)
// Not a test: it takes the pictures and prints what each shows.
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
  await page.waitForSelector('.tstart', { timeout: 10000 });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForSelector('.auto', { timeout: 10000 });
  await page.waitForTimeout(1500);
  await page.locator('.pausebtn').dispatchEvent('pointerdown');
  await page.waitForSelector('.pbtn.newrun', { timeout: 5000 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'newrun-1-menu.png') });
  await page.locator('.pbtn.newrun').dispatchEvent('pointerdown');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'newrun-2-confirm.png') });
  console.log('newrun-1-menu.png: the pause menu with "New run" above Exit');
  console.log('newrun-2-confirm.png: after one tap it asks "Tap again: new run" (amber; back after 3 s)');
  await browser.close();
})().catch(e => { console.log('ERROR', e.message); process.exit(1); });
