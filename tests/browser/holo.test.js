// The background hologram: in a sandbox room (open air behind you), red tiles show through
// while you're out in the level, and the background sits further back than before.
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
  // a tall room, well above the shop
  await page.evaluate(() => {
    const L = window.__lvl; window.DEV.zoom = 1;
    L.p.y = L.world.SHOP_Y - 900;
    L.sandbox({ w: 360, h: 320 });
  });
  await page.waitForTimeout(800);
  // red-dominant pixels in the room's air (the hologram's red over the dark background)
  const red = await page.evaluate(() => {
    const c = document.querySelector('canvas'), g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, Math.round(c.height * 0.4)).data;
    let r = 0, n = 0;
    for (let i = 0; i < d.length; i += 16) { n++; if (d[i] > d[i + 1] + 25 && d[i] > d[i + 2] + 25) r++; }
    return r / n;
  });
  check('red hologram tiles show in the open air', red > 0.03, red);
  if (process.env.HOLO_SHOT) await page.screenshot({ path: process.env.HOLO_SHOT });

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
