// CaveRunner Auto's save (stage 13): a quit mid-level (a reload) resumes in the hub with the bag kept;
// ⏸ → Exit → ▶ finds the same run; ⏸ → New run asks twice, then starts a fresh one.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  // the first load: no save, straight into a level (seed 7); later loads keep the save and open the hub
  await ctx.addInitScript(() => {
    window.__TEST_TITLE = true;
    if (!sessionStorage.getItem('loaded')) { sessionStorage.setItem('loaded', '1'); localStorage.removeItem('caverunner-auto-run'); window.__AUTO_LEVEL = 7; }
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  const play = async () => {
    await page.waitForSelector('.tstart', { timeout: 10000 });
    await page.locator('.tstart').dispatchEvent('pointerdown');
    await page.waitForSelector('.auto', { timeout: 10000 });
  };
  const gold = () => page.evaluate(() => { const r = loadAutoRun(); const g = r && r.bag.find(it => it && it.kind === 'gold'); return g ? g.n : 0; });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await play();

  // in the level: a drop goes into the bag (as level.js's take does), then the page goes away
  let inLevel = false;
  for (let i = 0; i < 60 && !(inLevel = await page.evaluate(() => !!(window.__autoScene && levelState(window.__autoScene)))); i++) await page.waitForTimeout(50);
  check('the first load opens a level', inLevel);
  await page.evaluate(() => { const L = levelState(window.__autoScene); bagAdd(L.run, { kind: 'gold', n: 55 }); L.bagV++; });
  await page.waitForTimeout(500);
  check('a drop in the level is saved at once', await gold() === 55, await gold());
  await page.reload();
  await play();
  let hub = false;
  for (let i = 0; i < 60 && !(hub = await page.evaluate(() => !!window.__autoHub)); i++) await page.waitForTimeout(50);
  check('a quit mid-level resumes in the hub', hub && await page.evaluate(() => !window.__autoScene));
  const slot = await page.evaluate(() => (document.querySelector('.aslot.k-gold') || {}).textContent || '');
  check('the bag is kept (gold 55 on screen and in the save)', /55/.test(slot) && await gold() === 55, slot);

  // ⏸ → Exit to main menu → ▶: the same run
  const before = await page.evaluate(() => JSON.stringify(loadAutoRun()));
  await page.locator('.pausebtn').dispatchEvent('pointerdown');
  await page.waitForSelector('.pausecard', { timeout: 5000 });
  await page.locator('.pbtn.exit').dispatchEvent('pointerdown');
  await page.waitForTimeout(300);
  await play();
  const after = await page.evaluate(() => JSON.stringify(loadAutoRun()));
  const same = (a, b) => { const A = JSON.parse(a), B = JSON.parse(b); A.paid = A.paid || {}; B.paid = B.paid || {}; return ['tier', 'bag', 'players', 'paid'].every(k => JSON.stringify(A[k]) === JSON.stringify(B[k])); };
  check('⏸ → Exit → ▶: the same run (tier, bag, players, machines)', same(before, after) && await gold() === 55);

  // ⏸ → New run: the first tap only asks; the second starts a fresh run (back on the title)
  await page.locator('.pausebtn').dispatchEvent('pointerdown');
  await page.waitForSelector('.pbtn.newrun', { timeout: 5000 });
  await page.locator('.pbtn.newrun').dispatchEvent('pointerdown');
  await page.waitForTimeout(150);
  const asks = await page.evaluate(() => ({ sure: !!document.querySelector('.pbtn.newrun.sure'), text: document.querySelector('.pbtn.newrun').textContent }));
  check('New run asks first (nothing changed yet)', asks.sure && /again/.test(asks.text) && await gold() === 55, asks);
  await page.locator('.pbtn.newrun').dispatchEvent('pointerdown');
  await page.waitForTimeout(300);
  await page.waitForSelector('.tstart', { timeout: 10000 });
  check('the second tap: a fresh run, back on the title', await gold() === 0 && await page.evaluate(() => loadAutoRun().tier === 1));

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e.message); process.exit(1); });
