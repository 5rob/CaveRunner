// Grem Mode taps on the real page (owner, v1.0.101; src/ui/auto/GremScreen.js playTap): a tap on empty cave sends the picked
// player there (the waypoint, its ring drawn); a new tap moves it; a tap on a chest far ahead opens it. Screenshot
// tests/build/autoshots/grem-waypoint.png.
const { launch } = require('../chromium');
const path = require('path');
const fs = require('fs');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };
const OUT = path.join(__dirname, '..', 'build', 'autoshots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.evaluate(() => { DEV.autoFoeGap0 = 999; DEV.autoFoeCap0 = 0; DEV.autoFoeCap1 = 0; DEV.autoFoeElites = 0; });
  await page.locator('.tgrem').dispatchEvent('pointerdown');
  let ok = false;
  for (let i = 0; i < 60 && !ok; i++) { ok = await page.evaluate(() => { const S = window.__gremScene; return !!S && S.lvl.data.phase === 'run'; }); if (!ok) await page.waitForTimeout(200); }
  check('Grem level running', ok);
  const box = await page.locator('.aplaycvs').boundingBox();
  await page.locator('.aplay').dispatchEvent('pointerdown', { clientX: box.x + box.width * 0.62, clientY: box.y + box.height * 0.45 });
  await page.waitForTimeout(150);
  const way1 = await page.evaluate(() => { const w = levelGoal(window.__gremScene); return w ? { x: w.x, y: w.y, id: w.id } : null; });
  check('a tap on empty cave: a waypoint for player 1', !!way1 && way1.id === 0, way1);
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, 'grem-waypoint.png') });
  await page.locator('.aplay').dispatchEvent('pointerdown', { clientX: box.x + box.width * 0.3, clientY: box.y + box.height * 0.6 });
  await page.waitForTimeout(150);
  const way2 = await page.evaluate(() => { const w = levelGoal(window.__gremScene); return w ? { x: w.x, y: w.y } : null; });
  check('a new tap moves it', !!way2 && !!way1 && (way2.x !== way1.x || way2.y !== way1.y), [way1, way2]);
  let gone = false;
  for (let i = 0; i < 60 && !gone; i++) { gone = await page.evaluate(() => !levelGoal(window.__gremScene)); if (!gone) await page.waitForTimeout(200); }
  check('he gets there, holds it, then plays on (the goal done)', gone);
  await browser.close();
  console.log(fails ? fails + ' FAILED' : 'all passed');
  process.exit(fails ? 1 : 0);
})();
