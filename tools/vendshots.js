// Screenshots for the owner (CaveRunner Auto, feedback round 1): a hub machine's payout spat out, landing, lying on the
// floor before player 1 pulls it in; and player 1 facing left with the gun turned the same way. Phone size 412 x 880.
//   v1-spit.png   the gun machine paid: the gun popped up out of it
//   v2-landed.png the gun lying on the floor
//   v3-left.png   player 1 walked left: the gun faces left
//   node tools/vendshots.js [outdir]      (default tests/build/autoshots)
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
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(3500);
  // stand player 1 left of the gun machine, then pay it
  await page.evaluate(() => { const S = window.__title.S, r = S.runners[0]; r.x = hubStopX('gun') - 60 - PW / 2; hubState(S).paid.gun = hubPrice('gun', 1).n; });
  const at = async (fn, cap) => { for (let i = 0; i < cap; i++) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(30); } return false; };
  await at(() => { const L = window.__title.S.loot; return !!(L && L[0] && L[0].vy > -20 && L[0].vy < 20 && !L[0].ground); }, 200);
  await page.screenshot({ path: path.join(OUT, 'v1-spit.png') });
  await at(() => { const L = window.__title.S.loot; return !!(L && L[0] && L[0].ground && L[0].land < 0.3); }, 200);
  await page.screenshot({ path: path.join(OUT, 'v2-landed.png') });
  await page.waitForTimeout(1500);
  const box = await page.locator('.apill').boundingBox();
  const mx = box.x + box.width / 2, my = box.y + box.height / 2;
  await page.mouse.move(mx, my); await page.mouse.down(); await page.mouse.move(mx - 50, my, { steps: 4 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'v3-left.png') });
  await page.mouse.up();
  console.log('v1-spit.png  the gun popped up out of the machine\nv2-landed.png  lying on the floor\nv3-left.png  walking left, the gun faces left');
  await browser.close();
})();
