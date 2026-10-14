// Screenshots for the owner (after v1.0.78): the level's end nuke (auto/death.js exitNuke) and its mushroom cloud
// (game/render/autolooks.js drawMushroom), set off under the team in a level, at a few moments.
//   node tools/nukeshots.js [outdir]      (default tests/build/autoshots)
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();
const AT = [0.12, 0.5, 1.1, 2, 2.9];

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 11; localStorage.removeItem('caverunner-auto-run'); localStorage.setItem('caverunner-devshow', '0'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.evaluate(() => { const run = newRun(); run.players.push(Object.assign({}, run.players[0], { col: '#ff5a6a' })); saveAutoRun(run); });
  await page.evaluate(() => { Object.assign(DEV, { autoLvlMin: 0.25, autoLvlBossT: 2, autoFoeElites: 0, autoChestN: 0 }); });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  // a short level played to its end (as auto-level.test.js): the team walks to the exit pad, gathers, the nuke
  for (let i = 0; i < 3000; i++) { if (await page.evaluate(() => { const L = levelState(window.__autoScene); return !!L && L.nukeT != null; })) break; await page.waitForTimeout(50); }
  // (the level map hidden: a test level this short makes it a tall box over the cave)
  await page.evaluate(() => { const j = document.querySelector('.ajourney'); if (j) j.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, 'nuke-a-gathered.png') });
  console.log('nuke-a-gathered.png  the team gathered on the exit pad, the nuke 0.5 s off');
  for (let i = 0; i < 1000; i++) { if (await page.evaluate(() => levelState(window.__autoScene).padGone)) break; await page.waitForTimeout(10); }
  await page.evaluate(() => { window.__nukeT = levelState(window.__autoScene).nukeT; });
  let last = 0;
  for (const t of AT) {
    for (let i = 0; i < 400; i++) { const age = await page.evaluate(() => window.__autoScene.t - window.__nukeT); if (age >= t) break; await page.waitForTimeout(8); }
    await page.screenshot({ path: path.join(OUT, 'nuke-' + t.toFixed(2) + '.png') });
    console.log('nuke-' + t.toFixed(2) + '.png  ' + t + ' s after the nuke');
    last = t;
  }
  await browser.close();
})().catch(e => { console.log(e); process.exit(1); });
