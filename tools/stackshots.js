// Screenshots for the owner (CaveRunner Auto feedback round 2): the nav as a stack (rows rise as you go down, B
// reverses), the gun panel at a gun's mod slots, a gun held to make it active. Phone size, the real page.
//   node tools/stackshots.js [outdir]      (default tests/build/autoshots; ONLY=ab: just shots a, b)
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
  // taps: the nav cells to tap in turn (CSS selectors inside .anav; 'B' presses B)
  const shot = async (n, what, taps, wait = 400, hold = '') => {
    if (ONLY && !ONLY.includes(n[0])) return;
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; localStorage.removeItem('caverunner-auto-run'); });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const run = newRun();
      bagAdd(run, { kind: 'green', n: 2 });
      addPlayer(run); addPlayer(run);
      const pl = run.players[0];
      // a 9-slot gun with 4 mods fitted (more slots than fit: the row scrolls), a second gun, two empty gun slots
      const g = scratchPistol();
      g.cap = 9; g.slots = ['bolt', 'spark', null, 'buck', null, 'lance', null, null, null];
      pl.guns[0] = g; pl.guns[1] = scratchPistol(); pl.guns[2] = null; pl.guns[3] = null;
      pl.exo.jet[0] = exoMod('jet', 3); pl.exo.jet[1] = exoMod('jet', 1);
      const pk = Object.keys(PERKS).filter(k => !k.startsWith('st_'));
      pl.perks[0] = { kind: 'perk', id: pk[0], n: 1 }; pl.perks[1] = { kind: 'perk', id: pk[3], n: 1 };
      bagAdd(run, { kind: 'gold', n: 245 });
      for (const id of ['bolt', 'spark', 'buck']) bagAdd(run, { kind: 'mod', id, n: 1 });
      saveAutoRun(run);
    });
    await page.locator('.tstart').dispatchEvent('pointerdown');
    await page.waitForTimeout(7000);
    for (const t of taps) {
      await page.locator(t === 'B' ? '.abtn.ab' : '.anav ' + t).first().dispatchEvent('pointerdown');
      await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup')));
      await page.waitForTimeout(t === taps[taps.length - 1] ? wait : 400);
    }
    if (hold) { await page.locator('.anav ' + hold).first().dispatchEvent('pointerdown'); await page.waitForTimeout(600); await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup'))); await page.waitForTimeout(300); }
    await page.screenshot({ path: path.join(OUT, 'stack-' + n + '.png') });
    said.push(`stack-${n}.png  ${what}`);
    await ctx.close();
  };
  await shot('a-menu', 'player 1 tapped: the players row rose, his menu slid in below it (player 1 lit, the rest dimmed)', ['[data-player="0"]']);
  await shot('b-guns', 'Guns: the players and menu rows raised, his 4 guns in the nav', ['[data-player="0"]', '[data-open="guns"]']);
  await shot('c-gun', 'a gun: the gun panel rose above its mod slots (stats left, firing window right), the slots flash with each pull', ['[data-player="0"]', '[data-open="guns"]', '[data-open="0"]'], 1800);
  await shot('d-mid', 'mid-animation: tapping Guns, the rows rising and the guns row sliding in', ['[data-player="0"]', '[data-open="guns"]'], 110);
  await shot('e-back', 'mid-animation: B from a gun, its row sliding out and the rest dropping back', ['[data-player="0"]', '[data-open="guns"]', '[data-open="0"]', 'B'], 110);
  await shot('f-hold', 'Guns: gun 2 held 0.6 s: it is now the active gun (white ring)', ['[data-player="0"]', '[data-open="guns"]'], 400, '[data-open="1"]');
  await browser.close();
  console.log(said.join('\n'));
  console.log('saved in ' + OUT);
})().catch(e => { console.log(e); process.exit(1); });
