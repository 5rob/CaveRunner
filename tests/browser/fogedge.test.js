// The fog covers the level right to its left and right edges. The fog's soft-edge blur used to
// fade out at the level's borders, leaving a see-through strip down both sides.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1200);
  for (const side of ['left', 'right']) {
    // deep in a fresh cave against one wall, with nothing above you seen yet
    await page.evaluate(side => {
      const L = window.__lvl; window.DEV.zoom = 1.6; window.DEV.holoAlpha = 0;
      L.seen.fill(0); L.p.x = side === 'left' ? 30 : L.world.WW - 42; L.p.y = 1500; L.p.vx = L.p.vy = 0; L.camReady = false;
    }, side);
    await page.waitForTimeout(80);
    await page.evaluate(() => { window.__in.current.paused = true; });   // hold still while measuring
    await page.waitForTimeout(80);
    const m = await page.evaluate(side => {
      const c = document.querySelector('canvas'), g = c.getContext('2d');
      // the outermost 8 css px, across the top fifth of the screen (well away from you)
      // (mean brightness), against a strip 60 css px in from it
      const w = 16, h = Math.round(c.height * 0.2);
      const mean = x => { const d = g.getImageData(x, 60, w, h).data; let s = 0;
        for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3; return s / (d.length / 4); };
      const edge = side === 'left' ? 0 : c.width - w, inner = side === 'left' ? 120 : c.width - w - 120;
      return { edge: +mean(edge).toFixed(1), inner: +mean(inner).toFixed(1) };
    }, side);
    check(`the ${side} edge is fogged like the rest`, m.edge <= m.inner + 3, m);
    await page.evaluate(() => { window.__in.current.paused = false; });
  }
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
