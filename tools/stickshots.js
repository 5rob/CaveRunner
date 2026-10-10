// Screenshots for the owner (CaveRunner Auto bug round 1): the stick in the bar's left end, a dome over the bag's corner;
// a: at rest in a level, b: manual mode, player 1 steered down: sawing into the floor; c: the crosshair on his helmet.
//   node tools/stickshots.js [outdir]      (default tests/build/autoshots)
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const said = [];
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 5; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    Object.assign(DEV, { autoFoeDmg: 0 });
    const run = newRun(); bagAdd(run, { kind: 'green', n: 9 }); addPlayer(run); addPlayer(run);
    saveAutoRun(run);
  });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(7000);
  const save = async (n, what) => { await page.screenshot({ path: path.join(OUT, 'stick-' + n + '.png') }); said.push(`stick-${n}.png  ${what}`); };
  await save('a-rest', 'the bar: the stick at its left end, rising into a dome; B and A to its right');
  await page.screenshot({ path: path.join(OUT, 'stick-a-zoom.png'), clip: { x: 0, y: 720, width: 412, height: 160 } }); said.push('stick-a-zoom.png  the same, close up');
  const hold = await page.evaluate(() => DEV.autoHoldMs);
  await page.locator('.anav [data-player="0"]').first().dispatchEvent('pointerdown');
  await page.waitForTimeout(hold + 200);
  await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup')));
  const pill = await page.locator('.apill').boundingBox(), px = pill.x + pill.width / 2, py = pill.y + pill.height / 2;
  await page.mouse.move(px, py); await page.mouse.down(); await page.mouse.move(px + 5, py + 60, { steps: 3 });
  await page.waitForTimeout(2500);
  await save('b-down', 'manual mode, the stick pulled down: player 1 saws down into the floor');
  const nav = await page.locator('.anav').boundingBox();
  await page.screenshot({ path: path.join(OUT, 'stick-c-cross.png'), clip: { x: 0, y: nav.y - 20, width: 412, height: nav.height + 40 } }); said.push('stick-c-cross.png  (bug round 2) the crosshair round the manual player\'s helmet');
  await page.mouse.up();
  await browser.close();
  console.log(said.join('\n'));
  console.log('saved in ' + OUT);
})().catch(e => { console.log(e); process.exit(1); });
