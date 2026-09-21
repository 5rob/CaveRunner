// The minimap: white outlines of the revealed cave in the bottom-left of the view,
// everything else transparent. We prove it by reading the canvas: with the fog fully
// lifted there are white pixels in the bottom-left corner; with nothing revealed there
// are none (so it really is gated on the fog, not just painting the whole cave).
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1200);

  // count bright-white pixels in the bottom-left corner of the game canvas
  const whiteInCorner = () => page.evaluate(() => {
    const c = document.querySelector('.view canvas');
    const g = c.getContext('2d');
    const w = Math.floor(c.width / 3), h = Math.floor(c.height / 2);
    const d = g.getImageData(0, c.height - h, w, h).data;
    let white = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200 && d[i + 3] > 120) white++;
    }
    return white;
  });

  // fog fully lifted: the whole cave's outlines can show on the map
  await page.evaluate(async () => {
    window.__lvl.fog.seen.fill(2);
    window.__lvl.fog.paint();
    await new Promise(r => setTimeout(r, 200));
  });
  await page.waitForTimeout(200);
  const lit = await whiteInCorner();
  check('with the fog lifted, the minimap draws white cave outlines', lit > 50, lit);
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'minimap.png') });

  // nothing revealed: the map is empty (transparent), so no white in the corner
  await page.evaluate(async () => {
    window.__lvl.fog.seen.fill(0);
    window.__lvl.fog.paint();
    await new Promise(r => setTimeout(r, 200));
  });
  await page.waitForTimeout(300);
  const dark = await whiteInCorner();
  check('with nothing revealed, the minimap shows nothing', dark < lit / 4, { dark, lit });

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
