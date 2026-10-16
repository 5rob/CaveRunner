// Screenshots for the owner (v1.0.97: levels 2+ play as the old game's floors, auto/maps.js levelLook), phone size
// (412 x 880 @2.625), the real page through the test page: a 4-player run with its map at level L, straight into the level
// (window.__AUTO_LEVEL), creatures harmless (DEV.autoFoeDmg 0) so the team lives; the shot once a few of the floor's
// creatures are on screen.
//   node tools/floorshots.js [outdir] [levels]      (default tests/build/autoshots, levels 1,2,3,4,6,9)
// Not a test: it takes the pictures and prints what each shows.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
const LEVELS = (process.argv[3] || '1,2,3,4,6,9').split(',').map(Number);
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const said = [];
  for (const lv of LEVELS) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 7; localStorage.removeItem('caverunner-auto-run'); });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(400);
    const look = await page.evaluate(lv => {
      DEV.autoFoeDmg = 0; DEV.autoFoeGap0 = 1; DEV.autoFoeCap0 = 8;
      const run = newRun();
      bagAdd(run, { kind: 'green', n: 3 });
      addPlayer(run); addPlayer(run); addPlayer(run);
      run.maps[0].level = lv; syncTier(run);
      saveAutoRun(run);
      const L = levelLook(run, 7);
      return { name: L.name, roster: L.roster };
    }, lv);
    await page.locator('.tstart').dispatchEvent('pointerdown');
    await page.waitForTimeout(3000);
    let ok = false;
    for (let t = 0; t < 60000 && !ok; t += 250) {
      ok = await page.evaluate(() => {
        const S = window.__title && window.__title.S;
        if (!S || !S.lvl || S.lvl.data.phase !== 'run' || S.t < 14) return false;
        const tx = S.scroll + S.runners[0].x;
        return S.foes.filter(f => Math.abs(f.x - tx) < 110).length >= 2;
      });
      if (!ok) await page.waitForTimeout(250);
    }
    if (!ok) console.log('level ' + lv + ': the wait ran out');
    await page.evaluate(() => { const p = document.querySelector('.aperf'); if (p) p.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });   // the Dev graphs off
    await page.waitForTimeout(150);
    const n = 'floor-l' + lv;
    await page.screenshot({ path: path.join(OUT, n + '.png') });
    const on = await page.evaluate(() => { const S = window.__title.S; return [...new Set(S.foes.filter(f => f.x - S.scroll > -20 && f.x - S.scroll < 320).map(f => f.k.name))].join(', '); });
    said.push(`${n}.png  level ${lv}: ${look.name}${look.roster ? ' (creatures: ' + look.roster.join(', ') + ')' : ' (today\'s level 1)'}; on screen: ${on}`);
    await ctx.close();
  }
  await browser.close();
  console.log(said.join('\n'));
})();
