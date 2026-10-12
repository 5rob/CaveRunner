// Screenshots for the owner (Discriminate's target popup, v1.0.71), phone size (412 x 880 @2.625), the real page through
// the test page: a Discriminate held in the bag (its popup of six targets), the tile once set to P2 (his helmet in the
// corner), and the gun preview with Discriminate:gold + White Hole pulling a handful of gold nuggets dropped into it.
//   node tools/discrimshots.js [outdir]      (default tests/build/autoshots)
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
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(400);
  const slot = await page.evaluate(() => {
    const run = newRun();
    bagAdd(run, { kind: 'mod', id: 'discrim', n: 1 });
    const g = scratchPistol();
    g.cap = 4; g.slots = [discrimId({ kind: 'object', id: 'gold' }), 'vacfield', null, null];
    run.players[0].guns[0] = g; run.players[0].active = 0;
    saveAutoRun(run);
    return run.bag.findIndex(it => it && it.id === 'discrim');
  });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(4000);
  const tile = page.locator('.abag [data-slot="' + slot + '"]');
  await tile.dispatchEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
  await page.waitForTimeout(700);
  const open = await page.locator('.adbox').count();
  await page.screenshot({ path: path.join(OUT, 'discrim-a-popup.png') });
  console.log('discrim-a-popup.png  Discriminate held in the bag: the popup, six targets and the four players  ' + JSON.stringify({ open }));
  await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 })));
  await page.locator('.adbtn[data-tgt="p2"]').dispatchEvent('pointerdown');
  await page.waitForTimeout(300);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('caverunner-auto-run')).run.bag.filter(it => it && it.kind === 'mod').map(it => it.id));
  await page.screenshot({ path: path.join(OUT, 'discrim-b-set.png') });
  console.log('discrim-b-set.png  the tile set to P2: his helmet in its corner  ' + JSON.stringify({ closed: (await page.locator('.adbox').count()) === 0, saved }));
  for (const t of ['[data-player="0"]', '[data-open="guns"]', '[data-open="0"]']) {
    await page.locator('.anav ' + t).first().dispatchEvent('pointerdown');
    await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup')));
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(800);
  const n = await page.evaluate(() => {
    const S = window.__pvScene; if (!S) return -1;
    const r = S.runners[0];
    for (let i = 0; i < 10; i++) S.coins.push({ x: S.scroll + r.x + 30 + i * 9, y: r.y - 10 - (i % 3) * 8, amount: 1, t: 0, nopull: 99, vx: 0, vy: 0 });
    return S.coins.length;
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, 'discrim-c-whitehole.png') });
  console.log('discrim-c-whitehole.png  the gun preview: Discriminate:gold + White Hole pulling dropped gold nuggets  ' + JSON.stringify({ coins: n }));
  await ctx.close();
  await browser.close();
})().catch(e => { console.log(e); process.exit(1); });
