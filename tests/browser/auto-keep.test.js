// CaveRunner Auto (feedback round 1, the owner: "it always resets the level before I can reach the boss"): the play
// area changing size mid-level (the boss bar, a phone's bars) resizes the canvas and the same level runs on; it used to
// throw the scene away and start the level again (ui/scenecanvas.js runScene's keep).
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__AUTO_LEVEL = 7; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForSelector('.tstart', { timeout: 10000 });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  let run = false;
  for (let i = 0; i < 80 && !run; i++) { await page.waitForTimeout(100); run = await page.evaluate(() => { const S = window.__autoScene; return !!(S && levelState(S).phase === 'run'); }); }
  check('the level is running', run);
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => { window.__S0 = window.__autoScene; return { t: window.__autoScene.t, x: levelTeamX(window.__autoScene) }; });
  // the play area shrinks and grows back, as when a bar comes and goes
  await page.evaluate(() => { document.querySelector('.aplay').style.flex = '0 0 300px'; });
  await page.waitForTimeout(400);
  await page.evaluate(() => { document.querySelector('.aplay').style.flex = ''; });
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({ same: window.__S0 === window.__autoScene, t: window.__autoScene.t, x: levelTeamX(window.__autoScene), phase: levelState(window.__autoScene).phase }));
  check('resized twice: the same level runs on (not restarted)', after.same && after.t > before.t && after.x >= before.x && after.phase !== 'arrive', { before, after });
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall ok');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log(e); process.exit(1); });
