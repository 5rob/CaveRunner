// Screenshots for the owner (Dev menu rebuild, grem): Grem started, dev mode on, the ⚙️ opens the full-screen Dev menu.
// a: Global's first tab (Grem); b: Level → Coal Seams (its Coal page); c: Level → Coal Seams → Bats, the preview pinned with the
// knobs scrolled down; d: Global → Fire, the fire sim pinned.
//   node tools/devshots.js [outdir]      (default tests/build/autoshots)
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; localStorage.setItem('caverunner-devshow', '1'); localStorage.removeItem('caverunner-devtab'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(2500);
  await page.locator('.adevbtn').dispatchEvent('pointerdown');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'dev-a-global.png') });
  await page.locator('.devside[data-s=level]').click();
  await page.locator('select.devlv').selectOption('coal');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'dev-b-coal.png') });
  // (owner) the rows' ◀ ▶ arrows; then a row zeroed by a double tap on its name (greyed), and put back
  await page.screenshot({ path: path.join(OUT, 'arrows-a-coal.png') });
  const nm = page.locator('.devrow.devnum .devname').nth(2);
  await nm.dispatchEvent('pointerdown'); await page.waitForTimeout(100); await nm.dispatchEvent('pointerdown');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'arrows-b-zeroed.png') });
  await page.waitForTimeout(400);
  await nm.dispatchEvent('pointerdown'); await page.waitForTimeout(100); await nm.dispatchEvent('pointerdown');
  await page.locator('.devtab[data-t=bats]').click();
  await page.waitForTimeout(1500);
  await page.evaluate(() => { document.querySelector('.devbody').scrollTop = 500; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'dev-c-bats.png') });
  await page.locator('.devside[data-s=global]').click();
  await page.locator('.devtab[data-t=firesim]').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'dev-d-fire.png') });
  await page.locator('.devside[data-s=level]').click();
  await page.waitForTimeout(200);
  await page.evaluate(() => { const el = document.querySelector('select.devlv'); el.size = el.options.length; el.style.height = 'auto'; });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'dev-e-levels.png') });
  await browser.close();
  console.log('shots in', OUT);
})();
