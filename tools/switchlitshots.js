// Screenshots for the owner (after v1.0.78): a Double Switch in the gun's pull flashing. Gun: Double Switch, Follow Me,
// Circle of Vigour, Discriminate, Follow Me, Circle of Vigour. Two pulls: the group up lit, the other dimmed.
//   node tools/switchlitshots.js [outdir]      (default tests/build/autoshots)
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
    g.cap = 8; g.slots = ['switch2', 'follow', 'vigour', discrimId({ kind: 'player', id: 0 }), 'follow', 'vigour', null, null];
    g.castDelay = 0.6; g.recharge = 0.6;
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
  const got = new Set();
  for (let i = 0; i < 400 && got.size < 2; i++) {
    const skip = await page.evaluate(() => [...document.querySelectorAll('.anav .pulse.skip')].map(e => e.parentElement.dataset.nslot).join());
    if (skip && !got.has(skip)) {
      got.add(skip);
      const n = got.size;
      await page.screenshot({ path: path.join(OUT, 'switchlit-' + n + '.png') });
      console.log(`switchlit-${n}.png  a pull: the Switch and the group up lit, slots ${skip} dimmed (passed over)`);
    }
    await page.waitForTimeout(25);
  }
  await browser.close();
})().catch(e => { console.log(e); process.exit(1); });
