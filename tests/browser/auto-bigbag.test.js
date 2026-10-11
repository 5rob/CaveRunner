// CaveRunner Auto (owner, v1.0.46): a double tap on an empty bag slot grows the bag up over the play area (its top at the
// play area's top); a double tap again puts it back, and so does B. One tap does nothing. Saves tests/build/bigbag.png
// (412 x 880) for the owner.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(300);
  await page.evaluate(() => { const run = newRun(); bagAdd(run, { kind: 'gold', n: 50 }); bagAdd(run, { kind: 'red', n: 3 }); saveAutoRun(run); });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  let on = false;
  for (let i = 0; i < 40 && !(on = !!(await page.$('.auto'))); i++) await page.waitForTimeout(50);
  check('the auto screen is up', on);
  await page.waitForTimeout(600);
  const top = sel => page.evaluate(s => document.querySelector(s).getBoundingClientRect().top, sel);
  const empty = '.abag [data-slot="20"]';
  const tap = () => page.locator(empty).dispatchEvent('pointerdown');
  const bag0 = await top('.abag'), play = await top('.aplay');
  await tap(); await page.waitForTimeout(500);
  check('one tap on an empty slot: the bag stays', Math.abs(await top('.abag') - bag0) < 1);
  await page.waitForTimeout(400);
  await tap(); await page.waitForTimeout(120); await tap(); await page.waitForTimeout(500);
  const big = await top('.abag');
  check('a double tap: the bag grows up to the play area\'s top', Math.abs(big - play) < 2, { big, play, bag0 });
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'bigbag.png') });
  await tap(); await page.waitForTimeout(120); await tap(); await page.waitForTimeout(500);
  check('a double tap again: back', Math.abs(await top('.abag') - bag0) < 1);
  await tap(); await page.waitForTimeout(120); await tap(); await page.waitForTimeout(500);
  await page.locator('.abtn.ab').dispatchEvent('pointerdown'); await page.waitForTimeout(500);
  check('grown, then B: back', Math.abs(await top('.abag') - bag0) < 1);
  // (v1.0.47) a double tap on the play area grows it down to the bag's bottom edge; again, or B, back
  const bot = sel => page.evaluate(s => document.querySelector(s).getBoundingClientRect().bottom, sel);
  const ptap = () => page.locator('.aplaycvs').dispatchEvent('pointerdown');
  const play0 = await bot('.aplay'), bagB = await bot('.abag');
  await page.waitForTimeout(400);
  await ptap(); await page.waitForTimeout(120); await ptap(); await page.waitForTimeout(600);
  const pb = await bot('.aplay');
  check('a double tap on the play area: it grows down to the bag\'s bottom edge', Math.abs(pb - bagB) < 2, { pb, bagB, play0 });
  check('…the bag and nav stay where they were (under it)', Math.abs(await bot('.abag') - bagB) < 1);
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'bigplay.png') });
  await ptap(); await page.waitForTimeout(120); await ptap(); await page.waitForTimeout(600);
  check('a double tap again: back', Math.abs(await bot('.aplay') - play0) < 1);
  await ptap(); await page.waitForTimeout(120); await ptap(); await page.waitForTimeout(600);
  await page.locator('.abtn.ab').dispatchEvent('pointerdown'); await page.waitForTimeout(600);
  check('grown, then B: back', Math.abs(await bot('.aplay') - play0) < 1);
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall ok');
  process.exit(fails ? 1 : 0);
})();
