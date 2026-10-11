// Screenshots for the owner (CaveRunner Auto, tall levels): the level made at the grown play area's height, the camera
// following the pack up and down it with the UI open. Phone size (412 x 880 @2.625).
//   t-a-open.png    a level, UI open, the camera on the pack        t-b-grown.png   the same, the play area grown: the whole height
//   t-c-*.png       further along the level (other zones), grown
//   node tools/tallshots.js [outdir]      (default tests/build/tall; the zones stage: tests/build/zones)
// It also prints the checks: the scene's height = the grown play area's, the leader on screen with the UI open.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'tall'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 11; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.evaluate(() => { Object.assign(DEV, { autoFoeDmg: 0, autoWallMin: 999, autoWallMax: 999, autoBlockN: 0 }); const r = newRun(4); addPlayer(r); addPlayer(r); saveAutoRun(r); });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(4000);
  const info = () => page.evaluate(() => {
    const S = window.__autoScene, C = window.__autoCam.current, cv = document.querySelector('.aplaycvs'), k = cv.clientWidth / TITLE_VW;
    const play = document.querySelector('.aplay').getBoundingClientRect(), bag = document.querySelector('.abag').getBoundingClientRect();
    const grownH = (play.height + Math.max(0, bag.bottom - play.bottom)) / k;
    const r = S.runners.find(q => !q.hide && !q.out) || S.runners[0], v = camTo(C, r.x, r.y + PH / 2);
    return { vh: +S.vh.toFixed(1), grownH: +grownH.toFixed(1), view: +(cv.clientHeight / k).toFixed(1), camY: +C.y.toFixed(1), leaderY: +v.y.toFixed(1),
      onScreen: v.y > 0 && v.y < cv.clientHeight / k, top: +S.top.toFixed(1), bot: +S.bot.toFixed(1) };
  });
  const a = await info();
  console.log('UI open:', JSON.stringify(a));
  console.log((Math.abs(a.vh - a.grownH) < 2 ? 'ok  ' : 'FAIL') + ' the level is made at the grown play area\'s height');
  console.log((a.onScreen ? 'ok  ' : 'FAIL') + ' the leader is on screen with the UI open');
  await page.screenshot({ path: path.join(OUT, 't-a-open.png') });
  // grow the play area: two taps on it within 350 ms
  await page.locator('.aplaycvs').dispatchEvent('pointerdown');
  await page.waitForTimeout(120);
  await page.locator('.aplaycvs').dispatchEvent('pointerdown');
  await page.waitForTimeout(1200);
  const b = await info();
  console.log('grown:', JSON.stringify(b));
  console.log((Math.abs(b.view - b.vh) < 2 ? 'ok  ' : 'FAIL') + ' grown, the view shows the whole height');
  await page.screenshot({ path: path.join(OUT, 't-b-grown.png') });
  // further along: the scene stepped on (the zones go by), grown
  // (the zones stage) stepped at 3× pace so each shot is a zone or so further on (900 frames at normal pace stayed in the first)
  for (const [n, steps] of [['t-c-1.png', 900], ['t-c-2.png', 900], ['t-c-3.png', 900], ['t-c-4.png', 900]]) {
    const z = await page.evaluate(s => {
      const S = window.__autoScene, p = DEV.autoLvlPace;
      DEV.autoLvlPace = p * 3;
      for (let i = 0; i < s; i++) titleStep(S, 1 / 30);
      DEV.autoLvlPace = p;
      return titleZone(levelTeamX(S), S) + ' x ' + Math.round(levelTeamX(S));
    }, steps);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, n) });
    console.log(n + '  zone ' + z);
  }
  await browser.close();
})();
