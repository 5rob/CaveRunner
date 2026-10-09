// Screenshots for the owner (CaveRunner Auto stage 6b, blocked zones): phone size (412 x 880 @2.625), one per variant
// (auto/blocked.js BLOCK_VARIANTS), blocked all the way, put on a zone ahead of a team with a Buzzsaw gun; the shot is
// taken as the block comes into the middle of the screen.
//   b-<variant>.png     node tools/blockshots.js [outdir] [variant…]      (default tests/build/autoshots, every variant)
// Not a test: it takes the pictures and prints what each shows.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();
const ONLY = process.argv.slice(3);

(async () => {
  const browser = await launch();
  const said = [];
  const ids = ONLY.length ? ONLY : (await (async () => {
    const G = require('../tests/load');
    return G.BLOCK_VARIANTS.map(v => v.id);
  })());
  for (const id of ids) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 3; localStorage.removeItem('caverunner-auto-run'); });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const run = newRun(9);
      bagAdd(run, { kind: 'green', n: 1 });
      addPlayer(run);
      const g = Object.assign({}, run.players[0].guns[0], { name: 'Buzzsaw', slots: ['saw', null, null] });
      resetGun(g);
      run.players[0].guns[1] = g;
      saveAutoRun(run);
      DEV.autoLvlPace = 2.5;
    });
    await page.locator('.tstart').dispatchEvent('pointerdown');
    let ok = false;
    for (let i = 0; i < 80 && !ok; i++) {
      await page.waitForTimeout(100);
      ok = await page.evaluate(() => { const S = window.__autoScene; return !!(S && levelState(S).phase === 'run'); });
    }
    // the first zone not generated yet: blocked all the way with this variant
    const x0 = await page.evaluate(v => {
      const S = window.__autoScene, Z = S.zp.z.find(z => z.x0 > S.gen * TCELL + 10 && !z.flat);
      let k = 0;
      Z.blk = rollBlock(() => ((k++ * 0.37) % 1), Z, v);
      Object.assign(Z.blk, { sev: 1, full: true });
      S.foes.length = 0;
      return Z.blk.x0;
    }, id);
    let at = false;
    for (let i = 0; i < 200 && !at; i++) {
      await page.waitForTimeout(100);
      at = await page.evaluate(x => { const S = window.__autoScene; S.foes.length = 0; return levelTeamX(S) >= x - 70; }, x0);
    }
    await page.evaluate(() => { DEV.autoLvlPace = 1; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, 'b-' + id + '.png') });
    said.push(`b-${id}.png  ${at ? '' : '(never got there) '}${id}`);
    await ctx.close();
  }
  await browser.close();
  console.log(said.join('\n'));
})();
