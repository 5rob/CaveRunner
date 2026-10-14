// Screenshots for the owner (after v1.0.82): a gun open in the nav, its mod row grown (double tap an empty slot): everything
// goes up, the gun panel at the top, the bag taking the room. a: before, b: grown.
//   node tools/rowupshots.js [outdir]      (default tests/build/autoshots)
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
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const run = newRun();
    const g = scratchPistol();
    g.cap = 24; g.slots = ['switch2', 'auto', 'battery', 'grow', 'grow', 'switch2', 'follow', 'vigour', 'discrim', 'vigour', 'blood', 'saw', ...Array(12).fill(null)];
    run.players[0].guns[0] = g; run.players[0].active = 0;
    for (const id of ['bolt', 'spark', 'bounce', 'double', 'orb', 'slug', 'fast', 'tip']) bagAdd(run, { kind: 'mod', id, n: 2 });
    saveAutoRun(run);
  });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(1500);
  for (const t of ['[data-player="0"]', '[data-open="guns"]', '[data-open="0"]']) {
    await page.locator('.anav ' + t).first().dispatchEvent('pointerdown');
    await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup')));
    await page.waitForTimeout(340);
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'rowup-a.png') });
  const e = page.locator('.anav [data-nslot="14"]').first();
  for (let k = 0; k < 2; k++) { await e.dispatchEvent('pointerdown'); await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup'))); await page.waitForTimeout(120); }
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'rowup-b.png') });
  console.log(await page.evaluate(() => { const p = document.querySelector('.anavslot.panel'); return p && p.getBoundingClientRect().top; }));
  await browser.close();
  console.log('rowup-a.png  before\nrowup-b.png  the row grown: panel at the top, bag bigger');
})();
