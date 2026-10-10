// Screenshots for the owner (CaveRunner Auto stage 11, chests): phone size (412 x 880 @2.625), a level of one player.
//   c1-chest.png  a shut chest by the team, "Tap A to open" over it (the team slowed)
//   c2-spill.png  just after A: the lid popped back, its contents (a red gem, forced for the picture) thrown up
//   node tools/chestshots.js [outdir]      (default tests/build/autoshots)
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
  const said = [];
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 5; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.evaluate(() => { DEV.autoFoeDmg = 0; saveAutoRun(newRun(9)); });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  let ok = false;
  for (let i = 0; i < 80 && !ok; i++) {
    await page.waitForTimeout(100);
    ok = await page.evaluate(() => { const S = window.__autoScene; return !!(S && levelState(S).phase === 'run'); });
  }
  // a chest just ahead of the team, settled on the ground
  await page.evaluate(() => {
    const S = window.__autoScene, L = levelState(S), r = S.runners[0];
    L.chests.unshift({ x: S.scroll + r.x + PW / 2 + 22 });
    S.foes.length = 0;
  });
  await page.waitForTimeout(700);
  const st = await page.evaluate(() => { const S = window.__autoScene; return { near: !!chestInRange(S), pace: S.pace }; });
  said.push(`c1-chest.png  a shut chest, prompt ${st.near ? 'showing' : 'NOT showing'}, the team's pace ${st.pace.toFixed(2)}`);
  await page.screenshot({ path: path.join(OUT, 'c1-chest.png') });
  await page.evaluate(() => { DEV.autoChestGold = 0; DEV.autoChestMod = 0; DEV.autoChestExo = 0; DEV.autoChestPerk = 0; DEV.autoChestGreen = 0; DEV.autoChestRed = 1; });
  const S0 = await page.evaluate(() => (window.__autoScene.loot || []).length);
  await page.locator('.abtn.aa').dispatchEvent('pointerdown');
  await page.waitForTimeout(260);
  const got = await page.evaluate(() => { const L = levelState(window.__autoScene); return L.chests[0].open ? L.chests[0].items.map(it => it.kind).join(',') : 'shut'; });
  said.push(`c2-spill.png  just after A: ${got} thrown up (loot before ${S0})`);
  await page.screenshot({ path: path.join(OUT, 'c2-spill.png') });
  await ctx.close();
  await browser.close();
  console.log(said.join('\n'));
})();
