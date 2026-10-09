// Screenshots for the owner (CaveRunner Auto stage 4a), phone size (412 x 880 @2.625), the real page through the
// test page: window.__AUTO_LEVEL opens the auto screen straight into a level (4 players). The start pad with the
// team teleporting in, mid-level, and the boss arena with the team stopped (a short level: DEV.autoLvlMin).
//   node tools/levelshots.js [outdir]      (default tests/build/autoshots)
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
  // until: a test in the page (the scene is window.__title.S), polled every 250 ms, at most cap ms
  const shot = async (n, what, wait, until, cap = 60000) => {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 3; localStorage.removeItem('caverunner-auto-run'); });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      DEV.autoLvlMin = 0.4; DEV.autoLvlBossT = 60;
      const run = newRun();
      bagAdd(run, { kind: 'green', n: 3 });
      addPlayer(run); addPlayer(run); addPlayer(run);
      saveAutoRun(run);
    });
    await page.locator('.tstart').dispatchEvent('pointerdown');
    if (wait) await page.waitForTimeout(wait);
    if (until) {
      let ok = false;
      for (let t = 0; t < cap && !ok; t += 250) { ok = await page.evaluate(until); if (!ok) await page.waitForTimeout(250); }
      if (!ok) console.log(n + ': the wait ran out');
    }
    await page.screenshot({ path: path.join(OUT, n + '.png') });
    said.push(`${n}.png  ${what}`);
    await ctx.close();
  };
  await shot('l1-arrive', 'the start pad: the team teleporting in (the pad charged, the flash, two through, two to come)', 1900);
  await shot('l2-mid', 'mid-level: the team running, flying and sawing through the cave as it scrolls', 14000);
  await shot('l3-arena', 'the boss arena (a wide flat chamber): the team stopped in it (the boss comes in stage 6)', 1500,
    () => !!(window.__title && window.__title.S && window.__title.S.lvl && window.__title.S.lvl.data.phase === 'arena' && window.__title.S.t - window.__title.S.lvl.data.arenaT > 2), 70000);
  await browser.close();
  console.log(said.join('\n'));
})();
