// Screenshot for the owner (CaveRunner Auto feedback round 2): the Dev panel on the auto screen (⏸ held 5 s turns dev
// mode on; the ⚙️ beside ⏸ opens it). a: the ⚙️ beside ⏸; b: the panel open on its Auto tab.
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
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; localStorage.removeItem('caverunner-auto-run'); localStorage.setItem('caverunner-devshow', '1'); localStorage.setItem('caverunner-devtab', 'auto'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(OUT, 'dev-a-gear.png') });
  await page.locator('.adevbtn').dispatchEvent('pointerdown');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'dev-b-panel.png') });
  // c: the Auto tab, its fire group open (v1.0.56)
  await page.getByText('Auto', { exact: true }).first().click();
  await page.waitForTimeout(200);
  await page.getByText('Auto: fire', { exact: true }).first().click();
  await page.waitForTimeout(200);
  await page.getByText('Auto: fire', { exact: true }).first().scrollIntoViewIfNeeded();
  await page.evaluate(() => { const e = [...document.querySelectorAll('*')].find(n => n.textContent === 'Auto: fire'); if (e) e.scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'dev-c-fire.png') });
  console.log('dev-a-gear.png  the Dev ⚙️ beside ⏸ (dev mode on)\ndev-b-panel.png  the Dev panel open, Auto tab\ndev-c-fire.png  Auto: fire open');
  await browser.close();
})().catch(e => { console.log(e); process.exit(1); });
