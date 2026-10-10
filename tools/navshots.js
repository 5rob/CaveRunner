// Screenshots for the owner (CaveRunner Auto stage 8a: the context nav), phone size (412 x 880 @2.625), the real page
// through the test page: the mock-up's four states (the players; player 1's menu Guns / Exo suit / Perks / Stats; his
// 4 gun slots; a gun's mod slots with a few mods fitted, scrolling sideways), plus a Jetpack's 5 exo slots and the 6
// perk slots. Each shot taps the nav the way a player would (and B where it says).
//   node tools/navshots.js [outdir]      (default tests/build/autoshots; ONLY=ab: just shots a, b)
// Not a test: it takes the pictures and prints what each shows.
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
  const shot = async (n, what, taps) => {
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
      await page.waitForTimeout(150);
    }
    await page.screenshot({ path: path.join(OUT, 'nav-' + n + '.png') });
    said.push(`nav-${n}.png  ${what}`);
    await ctx.close();
  };
  await shot('a-players', 'mock-up 1: the players (3 in the run, one locked circle)', []);
  await shot('b-menu', 'mock-up 2: player 1 tapped: Guns / Exo suit / Perks / Stats, the row edged in his colour', ['[data-player="0"]']);
  await shot('c-guns', 'mock-up 3: Guns: his 4 gun slots (the active one ringed white, the empty two dim)', ['[data-player="0"]', '[data-open="guns"]']);
  await shot('d-gun', 'mock-up 4: his first gun: 9 mod slots, 4 mods fitted, empty ones dim (the row scrolls sideways)', ['[data-player="0"]', '[data-open="guns"]', '[data-open="0"]']);
  await shot('e-exo', 'Exo suit → Jetpack: its 5 slots, two exo mods fitted', ['[data-player="0"]', '[data-open="exo"]', '[data-open="jet"]']);
  await shot('f-perks', 'Perks: the 6 perk slots, two perks fitted', ['[data-player="0"]', '[data-open="perks"]']);
  await shot('g-back', 'B from Perks twice: the players again, player 1 still marked', ['[data-player="0"]', '[data-open="perks"]', 'B', 'B']);
  await browser.close();
  console.log(said.join('\n'));
  console.log('saved in ' + OUT);
})().catch(e => { console.log(e); process.exit(1); });
