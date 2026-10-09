// Screenshots for the owner (CaveRunner Auto stage 2), phone size (412 x 880 @2.625), the real page
// through the test page: the title's ▶ opens the auto screen. A quiet one (a new run: one player, empty
// bag) and a busy one (2 players; a gun, mods, a gold stack, gems, an exo mod in the bag).
//   node tools/autoshots.js [outdir]      (default tests/build/autoshots)
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
  const shot = async (n, busy, what) => {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; localStorage.removeItem('caverunner-auto-run'); });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(400);
    if (busy) {
      await page.evaluate(() => {
        const run = newRun();
        bagAdd(run, { kind: 'green', n: 1 });
        addPlayer(run);
        bagAdd(run, { kind: 'gun', gun: scratchPistol(), n: 1 });
        for (const id of ['bolt', 'spark', 'buck', 'lance']) bagAdd(run, { kind: 'mod', id, n: 1 });
        bagAdd(run, { kind: 'mod', id: 'bolt', n: 2 });
        bagAdd(run, { kind: 'gold', n: 245 });
        bagAdd(run, { kind: 'red', n: 3 });
        bagAdd(run, { kind: 'green', n: 1 });
        bagAdd(run, exoMod('hp', 2));
        bagAdd(run, exoMod('jet', 1));
        saveAutoRun(run);
      });
    }
    await page.locator('.tstart').dispatchEvent('pointerdown');
    await page.waitForTimeout(busy ? 9000 : 2500);
    await page.screenshot({ path: path.join(OUT, n + '.png') });
    said.push(`${n}.png  ${what}`);
    await ctx.close();
  };
  await shot('a-quiet', false, 'a new run: one player in the scene, his ring in the nav, three locked circles, the empty bag');
  await shot('b-busy', true, '2 players, 9 s in; the bag: a gun, 4 mods (Bolt ×3), 245 gold, 3 red, 1 green, two exo mods');
  await browser.close();
  console.log(said.join('\n'));
  console.log('saved in ' + OUT);
})().catch(e => { console.log(e); process.exit(1); });
