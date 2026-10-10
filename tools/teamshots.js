// Screenshots for the owner (CaveRunner Auto stage 12: extra players), phone size (412 x 880 @2.625), the real page
// through the test page: a run with 2 players in the hub; a green gem dragged from the bag onto the empty circle
// (mid-drag: the circle lit), the third player teleporting in beside the team (flash, sparks, lightning), and the
// nav with 3 players a moment later.
//   node tools/teamshots.js [outdir]      (default tests/build/autoshots)
// Not a test: it takes the pictures and prints what each shows.
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
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const run = newRun();
    bagAdd(run, { kind: 'green', n: 3 });
    addPlayer(run);
    bagAdd(run, { kind: 'gold', n: 120 });
    saveAutoRun(run);
  });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(6000);
  const shot = (n, what) => page.screenshot({ path: path.join(OUT, n + '.png') }).then(() => said.push(`${n}.png  ${what}`));
  const centre = async sel => { const b = await page.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const gi = await page.evaluate(() => loadAutoRun().bag.findIndex(b => b && b.kind === 'green'));
  const a = await centre('.abag [data-slot="' + gi + '"]'), b = await centre('.anav [data-pslot="2"]');
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 10 });
  await page.waitForTimeout(100);
  await shot('team-a-drag', 'a green gem dragged over the empty third circle: the ghost, the circle lit green');
  await page.mouse.up();
  await page.waitForTimeout(70);
  await shot('team-b-arrive', 'let go: player 3 teleports in beside the team (flash, sparks, lightning)');
  await page.waitForTimeout(1500);
  await shot('team-c-nav', 'a moment later: 3 players in the hub, the nav shows 3 helmets and one empty circle');
  await browser.close();
  console.log(said.join('\n'));
  console.log('saved in ' + OUT);
})().catch(e => { console.log(e); process.exit(1); });
