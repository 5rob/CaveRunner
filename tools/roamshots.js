// Screenshots for the owner (CaveRunner Auto feedback round 2, manual mode): a: player 1's helmet held in a level, walked
// forward with the stick: the view keeps him near the middle, the team behind him; b: after roaming back (the stick left).
//   node tools/roamshots.js [outdir]      (default tests/build/autoshots)
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
  const save = async (n, what) => { await page.screenshot({ path: path.join(OUT, 'roam-' + n + '.png') }); said.push(`roam-${n}.png  ${what}`); };
  const hold = await page.evaluate(() => DEV.autoHoldMs);
  await page.locator('.anav [data-player="0"]').first().dispatchEvent('pointerdown');
  await page.waitForTimeout(hold + 200);
  await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup')));
  const pill = await page.locator('.apill').boundingBox(), px = pill.x + pill.width / 2, py = pill.y + pill.height / 2;
  await page.mouse.move(px, py); await page.mouse.down(); await page.mouse.move(px + 60, py, { steps: 3 });
  await page.waitForTimeout(2500);
  await page.mouse.move(px + 20, py, { steps: 2 });
  await page.waitForTimeout(600);
  await save('a-forward', 'manual mode (player 1\'s helmet held), walking forward: the view keeps him near the middle, the team behind him');
  await page.mouse.move(px - 60, py, { steps: 3 });
  await page.waitForTimeout(1600);
  await page.mouse.move(px - 20, py, { steps: 2 });
  await page.waitForTimeout(600);
  await save('b-back', 'after roaming back with the stick: the cave behind is still there, the team lined up behind him (behind where he faces: his gun aims ahead)');
  await page.mouse.up();
  await browser.close();
  console.log(said.join('\n'));
  console.log('saved in ' + OUT);
})().catch(e => { console.log(e); process.exit(1); });
