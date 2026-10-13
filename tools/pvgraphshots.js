// Screenshot for the owner (v1.0.79): the gun window's DPS graph carried over a gun change (a dotted line where it
// changed). Spark Bolt x3 fires 4 s, two bolts are dragged off, 3 s more.
//   node tools/pvgraphshots.js [outdir]      (default tests/build/autoshots)
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
  await page.evaluate(() => {
    const run = newRun(), g = scratchPistol();
    g.cap = 4; g.slots = ['bolt', 'bolt', 'bolt', null];
    run.players[0].guns[0] = g; run.players[0].active = 0;
    saveAutoRun(run);
  });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(4000);
  for (const t of ['[data-player="0"]', '[data-open="guns"]', '[data-open="0"]']) {
    await page.locator('.anav ' + t).first().dispatchEvent('pointerdown');
    await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup')));
    await page.waitForTimeout(340);
  }
  await page.waitForTimeout(4000);
  for (const k of [2, 1]) {
    const from = await page.locator('.anav [data-nslot="' + k + '"]').first().boundingBox();
    const empty = await page.evaluate(() => loadAutoRun().bag.findIndex(b => !b));
    const to = await page.locator('.abag [data-slot="' + empty + '"]').boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, 'pvgraph.png') });
  console.log('pvgraph.png  Spark Bolt x3 for 4 s, then down to one bolt: the graph carries on, dotted lines at the changes');
  await browser.close();
})().catch(e => { console.log(e); process.exit(1); });
