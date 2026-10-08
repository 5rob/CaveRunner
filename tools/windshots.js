// Screenshots for the owner (v0.0.172), phone size (412 x 880 @2.625), the real title through the test page: the
// winding caves (a narrow tunnel snaking through the rock, branches and pockets off it). For a few seeds, the scene is
// run on (quiet: no creatures, nobody shooting) to the first winding zone's way in, then its middle.
//   node tools/windshots.js [outdir]      (default tests/build/windshots)
// Not a test: it takes the pictures and prints what each shows.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'windshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const said = [];
  for (const seed of [101, 202, 303]) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(s => { window.__TEST_TITLE = true; window.__TITLE_SEED = s; }, seed);
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(800);
    const runTo = end => page.evaluate(end => {
      const { S } = window.__title;
      for (let i = 0; i < 60 * 200 && S.scroll < end; i++) { S.foes.length = 0; S.spawn = 99; S.runners.forEach(q => { q.cd = 9; }); titleStep(S, 1 / 60); }
    }, end);
    const Z = await page.evaluate(() => {
      const { S } = window.__title;
      let T = titleZoneSpan(S.scroll + 230, S);
      while (T.z !== 'winding') T = titleZoneSpan(T.x1 + 1, S);
      return { x0: T.x0, x1: T.x1 };
    });
    await runTo(Z.x0 - 80);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(OUT, `${seed}-in.png`) });
    said.push(`${seed}-in.png   seed ${seed}: into the winding caves`);
    await runTo((Z.x0 + Z.x1) / 2 - 110);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(OUT, `${seed}-mid.png`) });
    said.push(`${seed}-mid.png  …its middle`);
    await ctx.close();
  }
  await browser.close();
  console.log(said.join('\n'));
})();
