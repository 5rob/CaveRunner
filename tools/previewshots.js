// Screenshots for the owner (the gun panel's firing window, now the level's own scene: auto/preview.js), phone size
// (412 x 880 @2.625), the real page through the test page: player 1's gun opened in the nav (its mod slots), the panel up,
// with a few guns: a plain Spark Bolt; Follow Me + Spark Bolt; White Hole; Circle of Vigour; a Fireball.
//   node tools/previewshots.js [outdir]      (default tests/build/autoshots)
// Not a test: it takes the pictures and prints what each shows.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

const GUNS = [
  ['a-bolt', ['bolt', 'bolt'], 'Spark Bolt ×2: shots across the room into the jellyfish, the DPS over it'],
  ['b-follow', ['follow', 'bolt', 'bolt'], 'Follow Me + Spark Bolt: the shots curve back to him'],
  ['c-vacfield', ['vacfield', 'bolt'], 'White Hole + Spark Bolt: the hole hangs ahead of the gun, pulling'],
  ['d-vigour', ['vigour', 'bolt'], 'Circle of Vigour + Spark Bolt: the green circle on the floor at him'],
  ['e-fball', ['fball', 'fball'], 'Fireball: blasts on the wall / target, the room mended after'],
];

(async () => {
  const browser = await launch();
  for (const [n, slots, what] of GUNS) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; localStorage.removeItem('caverunner-auto-run'); });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(400);
    await page.evaluate(sl => {
      const run = newRun();
      const g = scratchPistol();
      g.cap = Math.max(4, sl.length); g.slots = sl.concat(Array(g.cap - sl.length).fill(null));
      run.players[0].guns[0] = g; run.players[0].active = 0;
      saveAutoRun(run);
    }, slots);
    await page.locator('.tstart').dispatchEvent('pointerdown');
    await page.waitForTimeout(5000);
    for (const t of ['[data-player="0"]', '[data-open="guns"]', '[data-open="0"]']) {
      await page.locator('.anav ' + t).first().dispatchEvent('pointerdown');
      await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup')));
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => { const c = document.querySelector('.apv'); return c ? { pulls: c.dataset.pulls, dps: c.dataset.dps, w: c.clientWidth, h: c.clientHeight } : null; });
    await page.screenshot({ path: path.join(OUT, 'preview-' + n + '.png') });
    console.log(`preview-${n}.png  ${what}  ${JSON.stringify(info)}`);
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.log(e); process.exit(1); });
