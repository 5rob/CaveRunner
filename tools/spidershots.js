// Screenshots for the owner: the spider zone (art/titlescene.js spiderRock / spiderBeam, after v1.0.74) in a real level,
// each look (rocks, vines, beams) and a mine the spiders took over, with its orb webs (world/orbweb.js).
//   node tools/spidershots.js [outdir]      (default tests/build/autoshots)
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

// [level seed, the world x to stop at (the zone's middle), name, what it shows]
const SHOTS = [[9, 270, 'rocks', 'the spider zone, rocks: boulders and spikes through the open cave, orb webs strung between them'],
  [10, 920, 'vines', 'the spider zone, vines: big patches of vines off the roof and the boulders\' undersides'],
  [2, 670, 'beams', 'the spider zone, beams: old mine timbering standing in it (not solid), webs off it too'],
  [2, 1245, 'mine', 'a mine the spiders took over: orb webs strung between its frames']];

(async () => {
  const browser = await launch();
  const said = [];
  for (const [seed, at, name, what] of SHOTS) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(s => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = s; localStorage.removeItem('caverunner-auto-run'); }, seed);
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => { Object.assign(DEV, { autoFoeDmg: 0, autoLvlPace: 3, autoBlockN: 0 }); saveAutoRun(newRun()); });
    await page.locator('.tstart').dispatchEvent('pointerdown');
    let x = 0;
    for (let i = 0; i < 300 && x < at; i++) { await page.waitForTimeout(200); x = await page.evaluate(() => (window.__autoScene ? levelTeamX(window.__autoScene) : 0)); }
    await page.evaluate(() => { const S = window.__autoScene; if (S) { S.pace = 0; S.still = true; } });
    await page.waitForTimeout(300);
    const f = 'spider-' + name + '.png';
    await page.screenshot({ path: path.join(OUT, f), clip: { x: 0, y: 0, width: 412, height: 480 } });
    said.push(`${f}  ${what} (team at x ${Math.round(x)})`);
    await ctx.close();
  }
  await browser.close();
  console.log(said.join('\n'));
  console.log('saved in ' + OUT);
})().catch(e => { console.log(e); process.exit(1); });
