// Screenshots for the owner (after v1.0.83): the mana mods. a: a gun with Recharge Battery, Mana Spring, Mana Burst + Spark Bolt open
// (its tiles, its firing window); b, c: the window later (the blue spring circle, a burst).
//   node tools/manashots.js [outdir]      (default tests/build/autoshots)
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
    g.cap = 8; g.slots = ['auto', 'rechbat', 'manaspring', 'manaburst', 'bolt', 'manaburst', 'spark', null];
    run.players[0].guns[0] = g; run.players[0].active = 0;
    for (const id of ['rechbat', 'manaspring', 'manaburst']) bagAdd(run, { kind: 'mod', id, n: 2 });
    saveAutoRun(run);
  });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(1500);
  for (const t of ['[data-player="0"]', '[data-open="guns"]', '[data-open="0"]']) {
    await page.locator('.anav ' + t).first().dispatchEvent('pointerdown');
    await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup')));
    await page.waitForTimeout(340);
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, 'mana-a.png') });
  const box = await page.locator('.anavslot.panel').boundingBox();
  for (const [n, t] of [['b', 700], ['c', 900], ['d', 1100]]) { await page.waitForTimeout(t); await page.screenshot({ path: path.join(OUT, 'mana-' + n + '.png'), clip: box }); }
  await browser.close();
  console.log('mana-a.png  the gun open; mana-b..d.png  its window later');
})();
