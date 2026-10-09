// Screenshots of the title's buttons and settings window (v0.0.174) for the owner, phone size (412 x 880).
//   node tools/settingsshots.js [outdir]      (default tests/build/settingsshots)
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'settingsshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => {
    window.__TEST_TITLE = true;
    localStorage.setItem('caverunner-save', JSON.stringify({ ver: 'old', floor: 3, hp: 50, hasLvl: true,
      loadout: { guns: [{ name: 'Pistol', slots: ['bolt', null] }, null, null, null], sel: 0, bag: [], gold: 1840 } }));
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'a-menu.png') });
  await page.dispatchEvent('.tgear', 'pointerdown');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'b-settings.png') });
  await page.dispatchEvent('.tclose', 'pointerdown');
  await page.waitForTimeout(100);
  await page.dispatchEvent('.tstart', 'pointerdown');
  for (let i = 0; i < 100 && !(await page.evaluate(() => window.__lvl && window.__lvl.p)); i++) await page.waitForTimeout(50);
  await page.waitForTimeout(1200);
  await page.dispatchEvent('.pausebtn', 'pointerdown');
  await page.dispatchEvent('.pausebtn', 'pointerup');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'c-pause.png') });
  await browser.close();
  console.log('Shots in ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
