// Screenshots for the owner (CaveRunner Auto feedback round 2): paying a hub machine with A. Phone size, the real page.
// a: player 1 at the gun machine, "A to Pay" over it; b: A held, dragged up and right: the stream aimed; c: a tap's
// nuggets landed on the floor in front of him (real size, knocking into each other) before the pull; d: red gems at the
// mod machine.
//   node tools/payshots.js [outdir]      (default tests/build/autoshots; ONLY=ab: just shots a, b)
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const ONLY = process.env.ONLY || '';
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const said = [];
  // act(page, a): what to do with the A button's centre a before the shot
  const shot = async (n, what, at, act) => {
    if (ONLY && !ONLY.includes(n[0])) return;
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; localStorage.removeItem('caverunner-auto-run'); });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(400);
    await page.evaluate(() => { const run = newRun(); bagAdd(run, { kind: 'gold', n: 400 }); bagAdd(run, { kind: 'red', n: 6 }); saveAutoRun(run); });
    await page.locator('.tstart').dispatchEvent('pointerdown');
    await page.waitForTimeout(6000);
    await page.evaluate(m => { const S = window.__title.S, L = S.runners[0]; L.x = hubStopX(m) - PW / 2 - 6; L.vx = 0; L.face = 1; }, at);
    await page.waitForTimeout(700);
    const b = await page.locator('.abtn.aa').boundingBox();
    await act(page, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
    await page.screenshot({ path: path.join(OUT, 'pay-' + n + '.png') });
    said.push(`pay-${n}.png  ${what}`);
    await ctx.close();
  };
  await shot('a-hint', 'player 1 at the gun machine: "A to Pay" over it', 'gun', async () => {});
  await shot('b-aim', 'A held and dragged up and right: the gold streams out of his chest that way', 'gun', async (page, a) => {
    await page.evaluate(() => Object.assign(DEV, { autoStreamRate0: 10, autoStreamRate1: 10 }));
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move(a.x + 45, a.y - 40, { steps: 4 });
    await page.waitForTimeout(1100);
  });
  await shot('c-floor', 'five taps: the nuggets hop out onto the floor in front of him, real size, knocking into each other, then get pulled in', 'gun', async (page, a) => {
    await page.evaluate(() => Object.assign(DEV, { autoPayHold: 2000 }));
    for (let i = 0; i < 5; i++) { await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.waitForTimeout(40); await page.mouse.up(); await page.waitForTimeout(60); }
    await page.waitForTimeout(250);
  });
  await shot('d-red', 'at the mod machine A pays red: the gems are the game\'s crystals', 'mod', async (page, a) => {
    await page.evaluate(() => Object.assign(DEV, { autoPayHold: 2000 }));
    for (let i = 0; i < 3; i++) { await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.waitForTimeout(40); await page.mouse.up(); await page.waitForTimeout(80); }
    await page.waitForTimeout(200);
  });
  await browser.close();
  console.log(said.join('\n'));
  console.log('saved in ' + OUT);
})().catch(e => { console.log(e); process.exit(1); });
