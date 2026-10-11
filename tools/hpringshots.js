// CaveRunner Auto (owner): the ring round each player's helmet in the nav is his health bar. Shots (412x880) of a level
// with three players at full, 60% and 20% health (low: red, pulsing), and a close-up of the row, in tests/build/hpring/.
// node tools/hpringshots.js (after node tests/run.js or node tests/build.js)
const path = require('path'), fs = require('fs');
const { launch } = require('../tests/chromium');
const OUT = path.join(__dirname, '..', 'tests', 'build', 'hpring');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 1; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    Object.assign(DEV, { autoFoeDmg: 0 });
    const run = newRun(9); bagAdd(run, { kind: 'green', n: 4 }); addPlayer(run); addPlayer(run);
    saveAutoRun(run);
  });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(2500);
  // the screen's own run (AutoScreen loads the save): set the health on the scene's team
  await page.evaluate(() => { const T = window.__autoScene.team; T[1].hp = playerStats(T[1]).maxHp * 0.6; T[2].hp = playerStats(T[2]).maxHp * 0.2; });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'h-a-level.png') });
  const row = await page.locator('.anavrow.l-players').first().boundingBox();
  if (row) await page.screenshot({ path: path.join(OUT, 'h-b-row.png'), clip: { x: row.x, y: row.y, width: row.width, height: row.height } });
  const rings = await page.evaluate(() => [...document.querySelectorAll('.anavc[data-player] .ahp')].map(e => getComputedStyle(e.parentElement).getPropertyValue('--hp')));
  console.log('rings', rings);
  await browser.close();
})();
