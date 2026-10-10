// The hub rebuilt as the old shop's room (CaveRunner Auto feedback round 2), phone size, the same moments as
// tools/oldshopshots.js shows of the old game, so the two can go side by side:
// 1-dark: through the teleporter, the tubes coming on; 2-hint: at the gun machine, "A to Pay"; 3-shake: the mod machine
// paying out; 4-demo: near the mod machine, its demo of a gem going in; 5-pad: on the exit pad, "Tap A to exit".
//   node tools/hubshots.js [outdir]      (default tests/build/hubshots)
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'hubshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const said = [];
  // at: where to stand player 1 (world x of his middle; null: leave him), wait: ms after the start, act: before the shot
  const shot = async (n, what, at, wait, act) => {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; localStorage.removeItem('caverunner-auto-run'); });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(400);
    await page.evaluate(() => { const run = newRun(); bagAdd(run, { kind: 'gold', n: 400 }); bagAdd(run, { kind: 'red', n: 6 }); saveAutoRun(run); });
    await page.locator('.tstart').dispatchEvent('pointerdown');
    await page.waitForTimeout(wait);
    if (at) await page.evaluate(a => { const S = window.__title.S, L = S.runners[0]; L.x = hubStopX(a[0]) + a[1] - PW / 2; L.vx = 0; L.face = 1; }, at);
    if (act) await act(page);
    await page.screenshot({ path: path.join(OUT, 'hub-' + n + '.png') });
    said.push(`hub-${n}.png  ${what}`);
    await ctx.close();
  };
  await shot('1-dark', 'through the teleporter, the tubes coming on one after another', null, 3800);
  await shot('2-hint', 'at the gun machine: "A to Pay"', ['gun', -6], 6000, p => p.waitForTimeout(700));
  await shot('3-shake', 'the mod machine paying out: shaking, its chase lights racing', ['mod', -50], 6000, async p => {
    await p.waitForTimeout(500);
    await p.evaluate(() => { const S = window.__title.S; hubState(S).vend.mod = S.t - 1.7; });
    await p.waitForTimeout(150);
  });
  await shot('4-demo', 'near the mod machine: the hologram demo of a red gem going in', ['mod', -60], 6000, p => p.waitForTimeout(1100));
  await shot('5-pad', 'on the exit pad: "Tap A to exit", under its sign', ['exit', 0], 6000, p => p.waitForTimeout(700));
  await browser.close();
  console.log(said.join('\n'));
  console.log('saved in ' + OUT);
})().catch(e => { console.log(e); process.exit(1); });
