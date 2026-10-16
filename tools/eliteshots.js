// Screenshots for the owner (v1.0.103: the elites' glow and flames from the old game, in Auto's levels), phone size
// (412 x 880 @2.625): Grem Mode with two elites put in front of the team (a jellyfish and a spider), the shot once their
// flames are going.   node tools/eliteshots.js [outdir]      (default tests/build/autoshots)
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
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(800);
  await page.evaluate(() => { DEV.autoFoeGap0 = 999; DEV.autoFoeCap0 = 0; DEV.autoFoeCap1 = 0; DEV.autoFoeElites = 0; });
  await page.locator('.tgrem').dispatchEvent('pointerdown');
  for (let i = 0; i < 60; i++) { if (await page.evaluate(() => { const S = window.__gremScene; return !!S && S.lvl.data.phase === 'run' && S.t > 6; })) break; await page.waitForTimeout(200); }
  await page.evaluate(() => {
    const S = window.__gremScene, x = S.scroll + S.runners[0].x;
    for (const [id, dx] of [['meduusa', 90], ['hamahakki', 150]]) { const f = titleFoeAt(S, eliteOf(gremFoe(id, 1), 0.6), x + dx); f.hp = f.hpMax = 1e6; }
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'elite-fx.png') });
  await browser.close();
  console.log('elite-fx.png  two elites (a jellyfish, a spider) with the old game\'s tinted glow behind them and flames rising off them; "Level 1 / Mossy Caves" top left');
})();
