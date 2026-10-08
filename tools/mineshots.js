// Screenshots for the owner (v0.0.170), phone size (412 x 880 @2.625), the real title through the test page:
// the mine works, each its own layout (1–3 tunnels, a way in and a way out at any of them, walled ends, holes
// between). For a few seeds, the scene is run on (quiet: no creatures, nobody shooting) to the first mine works'
// way in, then its way out.
//   node tools/mineshots.js [outdir]      (default tests/build/mineshots)
// Not a test: it takes the pictures and prints what each shows.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'mineshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const said = [];
  for (const seed of [101, 202, 303, 404]) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(s => { window.__TEST_TITLE = true; window.__TITLE_SEED = s; }, seed);
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(800);
    // run on to x (the screen's left edge), quiet
    const runTo = end => page.evaluate(end => {
      const { S } = window.__title;
      for (let i = 0; i < 60 * 120 && S.scroll < end; i++) { S.foes.length = 0; S.spawn = 99; S.runners.forEach(q => { q.cd = 9; }); titleStep(S, 1 / 60); }
    }, end);
    const mine = await page.evaluate(() => {
      const { S } = window.__title;
      let T = titleZoneSpan(S.scroll + 230, S);
      while (T.z !== 'timber') T = titleZoneSpan(T.x1 + 1, S);
      const M = T.mine, f = n => (n === 0 ? 'low' : n === M.n - 1 ? 'high' : 'middle');
      return { x0: T.x0, x1: T.x1, txt: `${M.n} tunnel${M.n > 1 ? 's' : ''}, in ${M.n > 1 ? f(M.ein) : ''}, out ${M.n > 1 ? f(M.eout) : ''}, ${M.holes.length} hole${M.holes.length === 1 ? '' : 's'} between, walled ends: ${M.L.filter(isFinite).length} left, ${M.Rx.filter(isFinite).length} right` };
    });
    await runTo(mine.x0 - 70);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(OUT, `${seed}-in.png`) });
    said.push(`${seed}-in.png   seed ${seed}, the way in: ${mine.txt}`);
    await runTo(mine.x1 - 150);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(OUT, `${seed}-out.png`) });
    said.push(`${seed}-out.png  …the way out`);
    await ctx.close();
  }
  await browser.close();
  console.log(said.join('\n'));
})();
