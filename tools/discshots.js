// Screenshots for the owner (v1.0.104: the Disc (sawblade) drawn twice its size), phone size
// (412 x 880 @2.625): Grem Mode, player 1 firing a Disc gun at a jellyfish in front of him, the shot as the discs fly.
//   node tools/discshots.js [outdir]      (default tests/build/autoshots)
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
    const f = titleFoeAt(S, gremFoe('meduusa', 1), x + 120); f.hp = f.hpMax = 1e6;
    const g = S.team[0].guns[S.team[0].active]; g.slots = ['disc', null, null]; g.cap = 3;
  });
  for (let i = 0; i < 40; i++) { if (await page.evaluate(() => window.__gremScene.shots.some(s => s.sid === 'disc'))) break; await page.waitForTimeout(100); }
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(OUT, 'disc-x2.png') });
  await browser.close();
  console.log('disc-x2.png  player 1 firing Discs (sawblades) at a jellyfish, the blade drawn twice its old size');
})();
