// Close-ups of Coal Seams' timber (grem, art/timber.js) for the owner: Grem Mode at level 2, phone size; each shot a clip round
// a set as it comes into the middle of the view: the open cave's (lane 0), a mine tunnel's run, a snapped or fallen one.
//   node tools/timbershots.js [outdir] [prefix]      (default tests/build/autoshots, timber)
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
const PRE = process.argv[3] || 'timber';
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
  // a set in the middle of the view: its lane, its box (css px), whether it's fallen (no cap) or snapped
  const find = (/** @type {string} */ want) => page.evaluate(w => {
    const S = window.__gremScene, cv = document.querySelector('canvas');
    if (!S || !S.tim || !cv) return null;
    const b = cv.getBoundingClientRect(), k = b.width / TITLE_VW;
    for (const [n, L] of Object.entries(S.tim)) for (const T of L.sets) {
      const x0 = T.c0 * TCELL - S.scroll, x1 = T.c1 * TCELL - S.scroll;
      if (x0 < 50 || x1 > 170) continue;
      const kind = T.mid < 0 ? 'fallen' : n === '0' ? 'open' : 'tunnel';
      if (kind !== w) continue;
      let r0 = 1e9, r1 = -1;
      for (const col of T.cols.values()) for (const r of col.keys()) { r0 = Math.min(r0, r); r1 = Math.max(r1, r); }
      const cx = b.left + (x0 + x1) / 2 * k, cy = b.top + (r0 + r1) / 2 * TCELL * k, hw = Math.max(70, (x1 - x0) * k * 0.9), hh = Math.max(70, (r1 - r0) * TCELL * k * 0.8);
      return { x: Math.max(b.left, cx - hw), y: Math.max(b.top, cy - hh), width: Math.min(hw * 2, b.width), height: Math.min(hh * 2, b.height) };
    }
    return null;
  }, want);
  const wants = [['open', 'a set in the open cave, measured off the rock: posts on the floor, the cap along the roof, wedges'],
    ['tunnel', 'the Mines: a run of sets along a tunnel, each its own width, braces, rot'], ['fallen', 'a fallen prop lying on a floor']];
  const got = new Set();
  for (let i = 0; i < 600 && got.size < wants.length; i++) {
    for (const [w, what] of wants) {
      if (got.has(w)) continue;
      const clip = await find(w);
      if (clip) { got.add(w); await page.screenshot({ path: path.join(OUT, `${PRE}-${w}.png`), clip }); said.push(`${PRE}-${w}.png  ${what}`); }
    }
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: path.join(OUT, `${PRE}-view.png`) });
  said.push(`${PRE}-view.png  the whole view, last`);
  await browser.close();
  console.log(said.join('\n'));
})();
