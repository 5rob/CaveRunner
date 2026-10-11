// Screenshots for the owner (CaveRunner Auto, exo "Jetpack": jet fuel, auto/fuel.js): phone size (412 x 880 @2.625), a fresh
// run in level 1, player 1 on the autopilot (for b his tank is emptied in mid-flight). The gauge over his head shows only when not full.
//   f-a-jetting.png   jetting up, the gauge draining
//   f-b-empty.png     dry: no flame, he falls, the gauge red and blinking
//   f-c-refill.png    back on the ground, the gauge filling again
//   node tools/fuelshots.js [outdir]      (default tests/build/fuel)
// Not a test: it takes the pictures and prints what they show.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'fuel'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 1; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.evaluate(() => { Object.assign(DEV, { autoWallMin: 60, autoWallMax: 60, autoFoeDmg: 0 }); saveAutoRun(newRun(9)); });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(4000);
  const st = () => page.evaluate(() => { const S = window.__autoScene, r = S && S.runners[0]; return r ? { fuel: r.fuel ?? 1, empty: !!r.empty, ground: !!r.ground, flame: r.flame } : null; });
  /** @param {(s: any) => boolean} ok @param {number} n */
  const until = async (ok, n) => { let s = await st(); for (let i = 0; i < n && !(s && ok(s)); i++) { await page.waitForTimeout(50); s = await st(); } return s; };
  let s = await until(x => !x.ground && x.flame > 0.3 && x.fuel < 0.85, 400);
  await page.screenshot({ path: path.join(OUT, 'f-a-jetting.png') });
  console.log('f-a-jetting.png  jetting up, the gauge draining', JSON.stringify(s));
  await until(x => !x.ground && x.flame > 0.2, 400);
  await page.evaluate(() => { const r = window.__autoScene.runners[0]; r.fuel = 0.01; });
  s = await until(x => x.empty && !x.ground, 100);
  await page.screenshot({ path: path.join(OUT, 'f-b-empty.png') });
  console.log('f-b-empty.png    dry: no flame, falling, the gauge red', JSON.stringify(await st()));
  s = await until(x => x.ground && x.fuel > 0.45, 300);
  await page.screenshot({ path: path.join(OUT, 'f-c-refill.png') });
  console.log('f-c-refill.png   on the ground, the gauge filling', JSON.stringify(s));
  await browser.close();
})();
