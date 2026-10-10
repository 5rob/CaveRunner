// Screenshots for the owner (CaveRunner Auto stage 10a), phone size (412 x 880 @2.625), the real page through the test
// page in the hub: a flicked nugget mid-air on its way to the gun machine; a stream of nuggets; a lump (the whole gold
// stack) held at the finger.
//   node tools/throwshots.js [outdir]      (default tests/build/autoshots; ONLY=ab: just shots a, b)
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
  const shot = async (n, what, act) => {
    if (ONLY && !ONLY.includes(n[0])) return;
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; localStorage.removeItem('caverunner-auto-run'); });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(400);
    await page.evaluate(() => { const run = newRun(); bagAdd(run, { kind: 'gold', n: 120 }); bagAdd(run, { kind: 'red', n: 3 }); saveAutoRun(run); });
    await page.locator('.tstart').dispatchEvent('pointerdown');
    await page.waitForTimeout(7000);
    const i = await page.evaluate(() => loadAutoRun().bag.findIndex(b => b && b.kind === 'gold'));
    const b = await page.locator('.abag [data-slot="' + i + '"]').boundingBox();
    const a = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const m = await page.evaluate(() => {
      const { S, C } = window.__title, H = hubState(S), r = document.querySelector('.aplaycvs').getBoundingClientRect(), k = r.width / TITLE_VW;
      return { x: r.left + ((hubStopX('gun') - C.x) * C.z + TITLE_VW / 2) * k, y: r.top + ((H.fy - MOUTH_UP - C.y) * C.z + C.ay) * k };
    });
    await act(page, a, m);
    await page.screenshot({ path: path.join(OUT, 'throw-' + n + '.png') });
    said.push(`throw-${n}.png  ${what}`);
    await ctx.close();
  };
  await shot('a-flick', 'a nugget flicked from the gold stack, mid-air on its way to the gun machine', async (page, a, m) => {
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move(a.x - 40, a.y - 200, { steps: 3 });
    await page.waitForTimeout(16);
    await page.mouse.move(a.x - 60, a.y - 260, { steps: 2 });
    await page.mouse.up();
    await page.waitForTimeout(120);
  });
  await shot('b-stream', 'moved away from the stack and held: nuggets streaming out toward the gun machine', async (page, a, m) => {
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move(m.x - 30, m.y + 60, { steps: 6 });
    await page.waitForTimeout(1300);
  });
  await shot('c-lump', 'held still on the stack: the whole gold stack (120) lifted as one lump at the finger', async (page, a, m) => {
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.move(m.x - 50, m.y - 10, { steps: 8 });
    await page.waitForTimeout(200);
  });
  await browser.close();
  console.log(said.join('\n'));
})();
