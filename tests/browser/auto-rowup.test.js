// CaveRunner Auto (owner, after v1.0.82): a gun's mod row grown (double tap an empty slot) puts the gun panel at the top
// of the screen and gives the bag the room; again, back as it was.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const run = newRun();
    const g = scratchPistol();
    g.cap = 24; g.slots = ['switch2', 'bolt', 'spark', ...Array(21).fill(null)];
    run.players[0].guns[0] = g; run.players[0].active = 0;
    saveAutoRun(run);
  });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(1500);
  for (const t of ['[data-player="0"]', '[data-open="guns"]', '[data-open="0"]']) {
    await page.locator('.anav ' + t).first().dispatchEvent('pointerdown');
    await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup')));
    await page.waitForTimeout(340);
  }
  await page.waitForTimeout(500);
  const geo = () => page.evaluate(() => {
    const p = document.querySelector('.anavslot.panel'), b = document.querySelector('.abag');
    return p && b ? { top: Math.round(p.getBoundingClientRect().top), bag: Math.round(b.getBoundingClientRect().height) } : null;
  });
  const dbl = async () => {
    const e = page.locator('.anav [data-nslot="14"]').first();
    for (let k = 0; k < 2; k++) { await e.dispatchEvent('pointerdown'); await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup'))); await page.waitForTimeout(120); }
    await page.waitForTimeout(800);
  };
  const a = await geo();
  check('the gun panel is open', !!a, a);
  await dbl();
  const b = await geo();
  check('grown: the gun panel at the top', !!b && b.top < 20, b);
  check('… the bag bigger', !!a && !!b && b.bag > a.bag + 100, { a, b });
  await dbl();
  const c = await geo();
  check('again: back as it was', !!a && !!c && Math.abs(c.top - a.top) < 2 && Math.abs(c.bag - a.bag) < 2, { a, c });
  await browser.close();
  console.log(fails ? `${fails} failed` : 'all ok');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log(e); process.exit(1); });
