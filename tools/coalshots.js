// Screenshots for the owner (Coal Seams, grem branch): Grem Mode started at level 2 (Dev "Start at level"), phone size, a few
// moments along the level, and close-ups of its decorations.
//   node tools/coalshots.js [outdir] [prefix]      (default tests/build/autoshots, coal)
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
const PRE = process.argv[3] || 'coal';
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const said = [];
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 23; });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => { DEV.gremStartLv = 2; DEV.autoFoeDmg = 0; DEV.autoLvlPace = 1.6; });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  const save = async (n, what, clip) => { await page.screenshot({ path: path.join(OUT, PRE + '-' + n + '.png'), clip }); said.push(`${PRE}-${n}.png  ${what}`); };
  const zone = () => page.evaluate(() => { const S = window.__gremScene; return S ? titleZoneSpan(S.scroll + 110, S).z : '?'; });
  // shots as the level goes by: one in each zone kind met (up to 5), and their close-ups
  const got = new Set();
  for (let i = 0; i < 160 && got.size < 5; i++) {
    await page.waitForTimeout(500);
    const z = await zone();
    if (i < 8 || got.has(z)) continue;
    got.add(z);
    await save(String.fromCharCode(97 + got.size - 1) + '-' + z, 'Coal Seams, the ' + ({ timber: 'Mines', winding: 'Digging zone', spider: 'Cavern' }[z] || z) + ' (zone ' + z + ')');
    if (got.size === 3) break;
  }
  // a minecart on screen (then lit: its blast)
  for (let i = 0; i < 240; i++) {
    const on = await page.evaluate(() => { const S = window.__gremScene; return !!S && S.props.some(p => p.k === 'barrel' && !p.gone && p.x > 40 && p.x < 200); });
    if (on) {
      await save('d-cart', 'an explosive minecart on the floor');
      await page.evaluate(() => { const S = window.__gremScene, p = S.props.find(q => q.k === 'barrel' && !q.gone && q.x > 40 && q.x < 200); if (p) p.fuse = 0.01; });
      await page.waitForTimeout(140);
      await save('e-cart-boom', 'the same cart set off: its blast, the rock bitten, fire');
      break;
    }
    await page.waitForTimeout(250);
  }
  await browser.close();
  console.log(said.join('\n'));
})();
