// Screenshots for the owner (CaveRunner Auto feedback round 2): a: a gun's mod slots lit in a pull's colour as the gun
// panel's preview fires them (the old Bag's pull sequence); b: in a level, player 1's health and damage graphs pinned
// above the nav, then player 2's damage slotted in under player 1's; c: the stats span "all" (the whole level so far).
//   node tools/pinshots.js [outdir]      (default tests/build/autoshots; ONLY=ab: just shots a, b)
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
  const open = async level => {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(l => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; if (l) window.__AUTO_LEVEL = 5; localStorage.removeItem('caverunner-auto-run'); }, level);
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const run = newRun(); bagAdd(run, { kind: 'green', n: 2 }); addPlayer(run);
      const g = run.players[0].guns[0]; g.slots = ['bolt', 'spark', 'buck'].concat(g.slots.slice(3)); if (g.cap < 3) g.cap = 3; while (g.slots.length < g.cap) g.slots.push(null);
      saveAutoRun(run);
    });
    await page.locator('.tstart').dispatchEvent('pointerdown');
    await page.waitForTimeout(level ? 9000 : 5000);
    return { ctx, page };
  };
  const tap = async (page, sel) => { await page.locator('.anav ' + sel).first().dispatchEvent('pointerdown'); await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup'))); await page.waitForTimeout(400); };
  const hold = async (page, sel) => { await page.locator(sel).dispatchEvent('pointerdown'); await page.waitForTimeout(500); await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup'))); await page.waitForTimeout(400); };
  const save = async (page, n, what) => { await page.screenshot({ path: path.join(OUT, 'pin-' + n + '.png') }); said.push(`pin-${n}.png  ${what}`); };

  if (!ONLY || ONLY.includes('a')) {
    const { ctx, page } = await open(false);
    await tap(page, '[data-player="0"]'); await tap(page, '[data-open="guns"]'); await tap(page, '[data-open="0"]');
    for (let i = 0; i < 60 && !(await page.$('.anav .pulse.on')); i++) await page.waitForTimeout(30);
    await save(page, 'a-lit', 'a gun\'s mod slots: the ones its preview fires now lit in that pull\'s colour (as the old Bag), in step with the firing window');
    await ctx.close();
  }
  if (!ONLY || ONLY.includes('b') || ONLY.includes('c')) {
    const { ctx, page } = await open(true);
    await tap(page, '[data-player="0"]'); await tap(page, '[data-open="stats"]');
    await hold(page, '.astatg.hp'); await hold(page, '.astatg.dmg');
    await page.locator('.abtn.ab').dispatchEvent('pointerdown'); await page.waitForTimeout(150);
    await page.locator('.abtn.ab').dispatchEvent('pointerdown'); await page.waitForTimeout(400);
    await tap(page, '[data-player="1"]'); await tap(page, '[data-open="stats"]');
    await hold(page, '.astatg.dmg');
    await page.waitForTimeout(1500);
    await save(page, 'b-pins', 'in a level: player 1\'s health (right) and damage (left) pinned above the nav, player 2\'s damage slotted in under player 1\'s');
    for (let i = 0; i < 3; i++) { await page.locator('.astats').dispatchEvent('pointerdown'); await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup'))); await page.waitForTimeout(100); }
    await page.waitForTimeout(400);
    await save(page, 'c-all', 'the stats span tapped to "all": the whole level so far');
    await ctx.close();
  }
  await browser.close();
  console.log(said.join('\n'));
  console.log('saved in ' + OUT);
})().catch(e => { console.log(e); process.exit(1); });
