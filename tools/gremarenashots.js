// Screenshots of Grem's boss fight kept in its arena (v2.0.19): mid-fight (the screen's right edge the arena's), later in
// the fight, and just after the kill (the gap of this level's floor before the next level's look)
//   node tools/gremarenashots.js [outdir]      (default tests/build/autoshots)
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
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(1200);
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(3500);
  await page.evaluate(() => { const S = window.__gremScene, L = S.lvl.data; DEV.autoFoeDmg = 0; S.scroll = L.plan.arena.x0 - LVL_TEAM - 60; });
  const info = () => page.evaluate(() => { const S = window.__gremScene, L = S.lvl.data, A = L.plan.arena; return { phase: L.phase, right: Math.round(S.scroll + 220 - A.x1), boss: L.boss && Math.round(L.boss.x - A.x1) }; });
  await page.waitForTimeout(6000);
  console.log('a', JSON.stringify(await info()));
  await page.screenshot({ path: path.join(OUT, 'grem-arena-a.png') });
  await page.waitForTimeout(6000);
  console.log('b', JSON.stringify(await info()));
  await page.screenshot({ path: path.join(OUT, 'grem-arena-b.png') });
  await page.evaluate(() => { const L = window.__gremScene.lvl.data; if (L.boss) L.boss.hp = 0; });
  await page.waitForTimeout(3500);
  console.log('c', JSON.stringify(await info()));
  await page.screenshot({ path: path.join(OUT, 'grem-arena-c.png') });
  await browser.close();
})();
