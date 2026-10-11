// Screenshots for the owner (CaveRunner Auto): the hub's map machine, between the perk machine and the exit. Phone size
// (412 x 880 @2.625).
//   m-a-hub.png     the hub, player 1 at the map machine (Mossy Caves picked, Lv 3)
//   m-b-owned.png   a close-up of its front: an owned map and its level, the active one
//   m-c-buy.png     a close-up: the next locked map (Tombs), part paid (the ring, the gold still owed)
//   m-d-locked.png  a close-up: a map further on ("BEAT TOMBS FIRST")
//   node tools/mapshots.js [outdir]      (default tests/build/maps)
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'maps'));
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
  // a run: Mossy Caves beaten, at Lv 3; Tombs 40% paid
  await page.evaluate(() => { const r = newRun(4); levelCleared(r); levelCleared(r); r.maps[1].paid = 400000; saveAutoRun(r); });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(3000);
  const at = () => page.evaluate(() => { const S = window.__autoHub, L = S.runners[0]; L.x = hubStopX('map') - PW / 2 - 32; L.vx = 0; L.face = 1; });
  await at();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'm-a-hub.png') });
  // a close-up of the machine's front, cut from the play canvas
  const zoom = async name => {
    await at();
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const S = window.__autoHub, C = window.__title.C, cv = document.querySelector('.aplaycvs'), k = cv.width / TITLE_VW;
      const v = camTo(C, hubStopX('map') - S.scroll, hubState(S).fy - 46), r = 56 / C.z;
      const c = document.createElement('canvas'); c.id = 'zoomshot'; c.width = 380; c.height = 380;
      Object.assign(c.style, { position: 'fixed', left: '16px', top: '200px', width: '380px', height: '380px', zIndex: 99999, border: '2px solid #fff' });
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
      x.drawImage(cv, (v.x - r * C.z) * k, (v.y - r * C.z) * k, 2 * r * C.z * k, 2 * r * C.z * k, 0, 0, 380, 380);
      document.body.appendChild(c);
    });
    await page.locator('#zoomshot').screenshot({ path: path.join(OUT, name) });
    await page.evaluate(() => document.getElementById('zoomshot').remove());
  };
  await zoom('m-b-owned.png');
  await page.evaluate(() => { hubState(window.__autoHub).mapSel = 1; });
  await zoom('m-c-buy.png');
  await page.evaluate(() => { hubState(window.__autoHub).mapSel = 2; });
  await zoom('m-d-locked.png');
  console.log('written to ' + OUT);
  await browser.close();
})();
