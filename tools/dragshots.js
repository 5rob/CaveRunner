// Screenshots for the owner (CaveRunner Auto stage 8b: dragging between the bag and the slots), phone size
// (412 x 880 @2.625), the real page through the test page: a Buzzsaw mid-drag over the starter gun's lit empty slot,
// a perk mid-drag over a lit perk slot, a tapped mod's card, a tapped exo mod's card.
//   node tools/dragshots.js [outdir]      (default tests/build/autoshots; ONLY=ab: just shots a, b)
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
  // taps: nav cells to tap first; act(page): what to do before the shot (a drag held mid-way, a tap)
  const shot = async (n, what, taps, act) => {
    if (ONLY && !ONLY.includes(n[0])) return;
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; localStorage.removeItem('caverunner-auto-run'); });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const run = newRun();
      bagAdd(run, { kind: 'gold', n: 245 });
      bagAdd(run, { kind: 'red', n: 3 });
      bagAdd(run, exoMod('jet', 2));
      bagAdd(run, exoMod('hp', 4));
      const pk = Object.keys(PERKS).filter(k => !k.startsWith('st_'));
      bagAdd(run, { kind: 'perk', id: pk[2], n: 1 });
      for (const id of ['bolt', 'spark', 'buck']) bagAdd(run, { kind: 'mod', id, n: 1 });
      saveAutoRun(run);
    });
    await page.locator('.tstart').dispatchEvent('pointerdown');
    await page.waitForTimeout(7000);
    for (const t of taps) {
      await page.locator('.anav ' + t).first().dispatchEvent('pointerdown');
      await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup')));
      await page.waitForTimeout(150);
    }
    await act(page);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, 'drag-' + n + '.png') });
    said.push(`drag-${n}.png  ${what}`);
    await ctx.close();
  };
  const centre = async (page, sel) => { const b = await page.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const slotOf = (page, k) => page.evaluate(k => '.abag [data-slot="' + loadAutoRun().bag.findIndex(b => b && (b.id === k || b.kind === k)) + '"]', k);
  // a drag held over its target (not let go)
  const hold = (k, to) => async page => {
    const a = await centre(page, await slotOf(page, k)), b = await centre(page, to);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move(b.x + 4, b.y + 6, { steps: 10 });
  };
  const tapOn = k => async page => { const a = await centre(page, await slotOf(page, k)); await page.mouse.click(a.x, a.y); };
  await shot('a-mod', 'a Buzzsaw dragged from the bag over the starter gun\'s empty slot 2 (lit green; the bag tile faded)',
    ['[data-player="0"]', '[data-open="guns"]', '[data-open="0"]'], hold('saw', '.anav [data-nslot="1"]'));
  await shot('b-perk', 'a perk dragged over perk slot 1 (lit)', ['[data-player="0"]', '[data-open="perks"]'], hold('perk', '.anav [data-nslot="0"]'));
  await shot('c-modcard', 'a tap on the Buzzsaw in the bag: its card (the shade closes it)', [], tapOn('saw'));
  await shot('d-exocard', 'a tap on a Jetpack II exo mod: its own small card (category, tier, what it adds)', [], tapOn('exo'));
  await browser.close();
  console.log(said.join('\n'));
  console.log('saved in ' + OUT);
})().catch(e => { console.log(e); process.exit(1); });
