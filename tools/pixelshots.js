// Screenshots for the owner (v0.0.170), phone size (412 x 880 @2.625), the real title through the test page:
// the plants, webs, gold and creatures in the players' pixel look, and a jellyfish's green glow on the vines
// and moss round it (the game's plant glow). Whole screen, then the camera zoomed in on the jellyfish.
//   node tools/pixelshots.js [outdir]      (default tests/build/pixelshots)
// Not a test: it takes the pictures and prints what each shows.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'pixelshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const said = [];
  for (const seed of [303, 505]) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(s => { window.__TEST_TITLE = true; window.__TITLE_SEED = s; }, seed);
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    // wait for a jellyfish on screen with a vine near it (up to 40 s)
    let J = null;
    for (let i = 0; i < 160 && !J; i++) {
      await page.waitForTimeout(250);
      J = await page.evaluate(() => {
        const { S } = window.__title;
        const j = S.foes.find(f => f.je && f.x - S.scroll > 50 && f.x - S.scroll < 170 && f.y > S.top + 20 && f.y < S.bot - 30
          && S.props.some(p => p.k === 'climb' && p.st === 'vine' && !p.gone && Math.abs(p.ox - f.x) < 25));
        return j ? { x: j.x - S.scroll, y: j.y } : null;
      });
    }
    await page.screenshot({ path: path.join(OUT, `${seed}-a-screen.png`) });
    said.push(`${seed}-a-screen.png  seed ${seed}: ${J ? 'a jellyfish by the vines' : 'no jellyfish by a vine found in 40 s'}, whole screen`);
    if (J) {
      await page.evaluate(J => { const { C } = window.__title; Object.assign(C, { z: 3, x: J.x, y: J.y, zt: 0 }); }, J);
      await page.waitForTimeout(60);
      await page.screenshot({ path: path.join(OUT, `${seed}-b-zoom.png`) });
      said.push(`${seed}-b-zoom.png    …zoomed in 3x on it: the green glow on the vines and moss, the pixel look`);
    }
    await ctx.close();
  }
  await browser.close();
  console.log(said.join('\n'));
})();
