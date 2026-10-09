// Screenshots for the owner (CaveRunner Auto stage 5b, the clearing rule): phone size (412 x 880 @2.625), a level with a
// wall of rock built across the strip ahead of the team.
//   c1-dig.png      blue has a Buzzsaw fitted in its second gun: at the wall it switches to it and cuts through
//   c2-blocked.png  starter guns only: no gun in play can clear the wall, the team stops, "Path blocked" pulses
//   node tools/clearshots.js [outdir]      (default tests/build/autoshots)
// Not a test: it takes the pictures and prints what each shows.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

const CASES = [['c1-dig', true], ['c2-blocked', false]];

(async () => {
  const browser = await launch();
  const said = [];
  for (const [n, saw] of CASES) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 3; localStorage.removeItem('caverunner-auto-run'); });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(400);
    await page.evaluate(withSaw => {
      const run = newRun(9);
      bagAdd(run, { kind: 'green', n: 1 });
      addPlayer(run);
      if (withSaw) {
        const g = Object.assign({}, run.players[0].guns[0], { name: 'Buzzsaw', slots: ['saw', null, null] });
        resetGun(g);
        run.players[0].guns[1] = g;
      }
      saveAutoRun(run);
    }, saw);
    await page.locator('.tstart').dispatchEvent('pointerdown');
    // through the arrival, then the wall: floor to roof, 3 cells wide, 70 world units ahead
    let ok = false;
    for (let i = 0; i < 80 && !ok; i++) {
      await page.waitForTimeout(100);
      ok = await page.evaluate(() => { const S = window.__autoScene; return !!(S && levelState(S).phase === 'run'); });
    }
    await page.evaluate(() => {
      const S = window.__autoScene, c0 = Math.floor((levelTeamX(S) + 70) / TCELL);
      for (let c = c0; c < c0 + 3; c++) for (let r = 0; r < S.rows; r++) S.cells[(((c % S.ncol) + S.ncol) % S.ncol) * S.rows + r] = TM.ROCK;
      S.dirtyAll = true;
    });
    let hit = false;
    for (let i = 0; i < 150 && !hit; i++) {
      await page.waitForTimeout(100);
      hit = await page.evaluate(want => {
        const S = window.__autoScene;
        return want ? S.runners.some(r => r.dig > 0.4 && r.clr) : !!levelState(S).blocked && S.pace === 0;
      }, saw);
    }
    await page.waitForTimeout(saw ? 100 : 1200);
    await page.screenshot({ path: path.join(OUT, n + '.png') });
    said.push(`${n}.png  ${hit ? '' : '(never got there) '}${saw ? 'blue switched to its Buzzsaw gun, cutting the wall' : 'starters only: stopped at the wall, Path blocked'}`);
    await ctx.close();
  }
  await browser.close();
  console.log(said.join('\n'));
})();
