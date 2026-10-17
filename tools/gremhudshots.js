// Screenshots of Grem's bottom row (the HUD rework): the helmets 2×2 left of the stick, the level panel right of it, its
// outline filled to ~40% of the level. 412×880 and a close-up of the bottom.
//   node tools/gremhudshots.js [outdir]      (default tests/build/autoshots)
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
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; localStorage.setItem('caverunner-grem-kit', JSON.stringify({ names: ['Grem', 'Mum', 'Dad', 'Pip'] })); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(1200);
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(3500);
  // all 4 players, then the team ~40% of the way in
  await page.evaluate(() => {
    DEV.autoFoeDmg = 0;
    const S = window.__gremScene, run = S.lvl.data.run;
    bagAdd(run, { kind: 'gold', n: gremPaidAt(12) });
  });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const S = window.__gremScene, L = S.lvl.data;
    S.scroll = L.plan.z0 + L.plan.len * 0.4 - (levelTeamX(S) - S.scroll);
  });
  await page.waitForTimeout(800);
  const p = await page.evaluate(() => document.querySelector('.glvlbox').dataset.prog);
  await page.screenshot({ path: path.join(OUT, 'grem-hud.png') });
  await page.screenshot({ path: path.join(OUT, 'grem-hud-bottom.png'), clip: { x: 0, y: 700, width: 412, height: 180 } });
  console.log('progress', p, '\n' + path.join(OUT, 'grem-hud.png') + '\n' + path.join(OUT, 'grem-hud-bottom.png'));
  await browser.close();
})();
