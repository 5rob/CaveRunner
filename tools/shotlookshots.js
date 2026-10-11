// Screenshots for the owner (CaveRunner Auto, stage: shots, first half): the shots' new looks in a level, phone size
// (412 x 880 @2.625). Each picture: 4 players, each with one shot mod, firing at creatures put just ahead.
//   s1  bolt, spark, slug, buckshot       s2  lance, blast, magic arrow, magic missile
//   s3  fireball, firebolt, flamethrower, bubble spark     s4  spitter bolt, pollen, disc
//   node tools/shotlookshots.js [outdir]      (default tests/build/shotlooks)
// Not a test: it takes the pictures and prints what each shows.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'shotlooks'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

const SHEETS = [
  ['s1', ['bolt', 'spark', 'slug', 'buck']],
  ['s2', ['lance', 'blast', 'arrow', 'missile']],
  ['s3', ['fball', 'fbolt', 'flamer', 'bubble']],
  ['s4', ['spit', 'pollen', 'disc', 'bolt']],
];

(async () => {
  const browser = await launch();
  const said = [];
  for (const [n, mods] of SHEETS) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 3; localStorage.removeItem('caverunner-auto-run'); });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(400);
    await page.evaluate(ms => {
      DEV.autoFoeDmg = 0;
      const run = newRun();
      bagAdd(run, { kind: 'green', n: 3 });
      addPlayer(run); addPlayer(run); addPlayer(run);
      run.players.forEach((p, i) => { const g = p.guns[p.active]; g.slots = [ms[i], null, null]; g.name = ms[i]; resetGun(g); });
      saveAutoRun(run);
    }, mods);
    await page.locator('.tstart').dispatchEvent('pointerdown');
    let ok = false;
    for (let i = 0; i < 80 && !ok; i++) {
      await page.waitForTimeout(100);
      ok = await page.evaluate(() => { const S = window.__autoScene; return !!(S && levelState(S).phase === 'run'); });
    }
    await page.waitForTimeout(1500);
    // creatures ahead (tough, so they stay), a fresh pair every so often
    for (let k = 0; k < 3; k++) {
      await page.evaluate(() => {
        const S = window.__autoScene;
        for (const dx of [80, 130]) { const f = titleFoeAt(S, enemyFor('rotta', 1), levelTeamX(S) + dx); f.hp = f.hpMax = 9999; }
      });
      await page.waitForTimeout(900);
    }
    await page.screenshot({ path: path.join(OUT, n + '.png') });
    said.push(`${n}.png  ${ok ? '' : '(level never started) '}${mods.map((m, i) => ['blue', 'red', 'green', 'gold'][i] + ': ' + m).join(', ')}`);
    await ctx.close();
  }
  await browser.close();
  console.log(said.join('\n'));
})();
