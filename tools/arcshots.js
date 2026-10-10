// Screenshots for the owner (CaveRunner Auto stage 9), phone size (412 x 880 @2.625), the real page through the test
// page: the gun arc held open with gun 2 lit; the Stats row in a level with data; a scrap mid coin burst; a mod
// dropped on the play area lying on the hub's floor.
//   node tools/arcshots.js [outdir]      (default tests/build/autoshots; ONLY=ab: just shots a, b)
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
  const centre = async (page, sel) => { const b = await page.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const slotOf = (page, k) => page.evaluate(k => '.abag [data-slot="' + loadAutoRun().bag.findIndex(b => b && (b.id === k || b.kind === k)) + '"]', k);
  const shot = async (n, what, level, act) => {
    if (ONLY && !ONLY.includes(n[0])) return;
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(l => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; if (l) window.__AUTO_LEVEL = l; localStorage.removeItem('caverunner-auto-run'); }, level);
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const run = newRun();
      run.players[0].guns[1] = scratchPistol();
      bagAdd(run, { kind: 'gold', n: 245 });
      bagAdd(run, { kind: 'red', n: 3 });
      for (const id of ['bolt', 'spark', 'buck']) bagAdd(run, { kind: 'mod', id, n: 1 });
      saveAutoRun(run);
    });
    await page.locator('.tstart').dispatchEvent('pointerdown');
    await page.waitForTimeout(level ? 9000 : 7000);
    await act(page);
    await page.screenshot({ path: path.join(OUT, 'arc-' + n + '.png') });
    said.push(`arc-${n}.png  ${what}`);
    await ctx.close();
  };
  const tapNav = async (page, sel) => {
    await page.locator('.anav ' + sel).first().dispatchEvent('pointerdown');
    await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup')));
    await page.waitForTimeout(150);
  };
  await shot('a-arc', 'player 1\'s helmet held: his 4 guns fanned out above it (two empty, dim), the finger on gun 2 (lit green)', 0, async page => {
    const hm = await centre(page, '.anav [data-player="0"]');
    await page.mouse.move(hm.x, hm.y); await page.mouse.down();
    await page.waitForTimeout(550);
    const g = await centre(page, '.aarcc[data-arc="1"]');
    await page.mouse.move(g.x, g.y, { steps: 6 });
    await page.waitForTimeout(250);
  });
  await shot('b-stats', 'in a level, player 1 → Stats: red damage dealt, green health, the last 15 s (one tap)', 7, async page => {
    await tapNav(page, '[data-player="0"]'); await tapNav(page, '[data-open="stats"]');
    await page.locator('.astats').dispatchEvent('pointerdown');
    await page.waitForTimeout(600);
  });
  await shot('c-scrap', 'a Bolt dropped on the gold stack: it became gold, coins bursting out, +n floating up', 0, async page => {
    const a = await centre(page, await slotOf(page, 'bolt')), b = await centre(page, await slotOf(page, 'gold'));
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(160);
  });
  await shot('d-drop', 'a Spark dragged out of the bag onto the play area: it lies on the hub floor in front of the team', 0, async page => {
    const a = await centre(page, await slotOf(page, 'spark')), b = await centre(page, '.aplay');
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(1500);
  });
  await browser.close();
  console.log(said.join('\n'));
  console.log('saved in ' + OUT);
})().catch(e => { console.log(e); process.exit(1); });
