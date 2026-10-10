// v0.0.145: the shop's way up is straight over the buy machine, and you can fly up it into the cave.
// Screenshots: shopexit-*.png (phone size).
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  const shot = n => page.screenshot({ path: path.join(__dirname, '..', 'build', 'shopexit-' + n + '.png') });
  for (let i = 0; i < 100 && !(await page.evaluate(() => window.__lvl && window.__lvl.p)); i++) await page.waitForTimeout(50);
  await page.evaluate(() => { const L = window.__lvl; L.guide = null; L.shopLit = null; });
  const s = await page.evaluate(() => {
    const L = window.__lvl, { CW, CELL, SHOP_TOP } = L.world, cx = Math.round(VEND_BUY_X / CELL), row = SHOP_TOP - 3;
    let a = cx, b = cx;   // the open run through the roof round the buy machine
    while (a > 0 && !L.mat[row * CW + a - 1]) a--;
    while (b < CW - 1 && !L.mat[row * CW + b + 1]) b++;
    return { open: !L.mat[row * CW + cx], mid: (a + b) / 2 * CELL, buy: VEND_BUY_X };
  });
  check('the way up is over the buy machine', s.open && Math.abs(s.mid - s.buy) <= 2, s);
  // stand under it
  await page.evaluate(x => { const L = window.__lvl; L.p.x = x - 6; L.p.vx = 0; }, s.buy);
  await page.waitForTimeout(900);
  await shot('1-under');
  // jet straight up: out through the roof
  const y0 = await page.evaluate(() => window.__lvl.p.y);
  const SHOP_Y = await page.evaluate(() => window.__lvl.world.SHOP_Y);
  await page.evaluate(() => { window.__in.current.left = { active: true, nx: 0, ny: -1, mag: 1, dy: -1, on: true }; });
  let y = y0;
  for (let i = 0; i < 40 && y > SHOP_Y - 40; i++) { await page.waitForTimeout(50); y = await page.evaluate(() => { const p = window.__lvl.p; p.fuel = 1; return p.y; }); }
  await page.evaluate(() => { window.__in.current.left = { active: false, nx: 0, ny: 0, mag: 0, dy: 0, on: false }; });
  check('jetting straight up from the buy machine takes you out of the shop', y < SHOP_Y - 20, { y0, y, roof: SHOP_Y });
  await shot('2-up');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
