// Screenshots for the owner (after v1.0.78): a player joining in the hub (a green gem onto an empty player circle). Player
// 1 has walked off down the hallway: player 2 comes through the enter teleporter off screen, a bluish flash from the left
// (with the pad's sound); then he runs to the team. And the pad itself when it's on screen.
//   node tools/joinshots.js [outdir]      (default tests/build/autoshots)
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  for (const far of [true, false]) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; localStorage.removeItem('caverunner-auto-run'); });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(400);
    await page.evaluate(() => { const run = newRun(); bagAdd(run, { kind: 'green', n: 1 }); saveAutoRun(run); });
    await page.locator('.tstart').dispatchEvent('pointerdown');
    await page.waitForTimeout(3500);
    if (far) {
      await page.evaluate(() => { const H = hubState(window.__autoHub); H.stick = { active: true, nx: 1, ny: 0, mag: 1, dy: 0 }; });
      await page.waitForTimeout(2500);
      await page.evaluate(() => { const H = hubState(window.__autoHub); H.stick = { active: false, nx: 0, ny: 0, mag: 0, dy: 0 }; });
      await page.waitForTimeout(800);
    }
    const gi = await page.evaluate(() => loadAutoRun().bag.findIndex(b => b && b.kind === 'green'));
    const c = async sel => { const b = await page.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    const a = await c('.abag [data-slot="' + gi + '"]'), b = await c('.anav [data-pslot="1"]');
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up();
    const tag = far ? 'far' : 'near';
    if (!far) {
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT, 'join-near-a-charge.png') });
      console.log('join-near-a-charge.png  the pad on screen: charging for player 2');
    }
    for (let i = 0; i < 200; i++) { if (await page.evaluate(() => hubState(window.__autoHub).far != null)) break; await page.waitForTimeout(10); }
    await page.waitForTimeout(80);
    await page.screenshot({ path: path.join(OUT, 'join-' + tag + '-b-through.png') });
    console.log(`join-${tag}-b-through.png  player 2 through: ${far ? 'the pad off screen, the bluish flash from the left' : 'the pad\'s flash and lightning'}`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, 'join-' + tag + '-c-after.png') });
    console.log(`join-${tag}-c-after.png  2.5 s later: ${far ? 'he runs in from the left' : 'with the team'}`);
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.log(e); process.exit(1); });
