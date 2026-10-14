// CaveRunner Auto: the Dev panel's mod grid scrolls (owner, after v1.0.80: "I can't scroll the dev mod grid"; it sat
// outside the panel's scrolling body and ran off the bottom). Opened, it's inside the body, which scrolls, and a touch
// swipe on a tile's edge (off the grab circle) scrolls it down to the last tile.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; localStorage.removeItem('caverunner-auto-run'); localStorage.setItem('caverunner-devshow', '1'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(300);
  await page.locator('.tstart').dispatchEvent('pointerdown');
  let on = false;
  for (let i = 0; i < 60 && !(on = !!(await page.$('.adevbtn'))); i++) await page.waitForTimeout(50);
  check('the auto screen is up, Dev button there', on);
  await page.locator('.adevbtn').dispatchEvent('pointerdown');
  await page.waitForTimeout(300);
  await page.locator('.modgridbtn').dispatchEvent('pointerdown');
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => {
    const b = document.querySelector('.devbody'), g = document.querySelector('.modgrid');
    return b && g ? { inBody: b.contains(g), sh: b.scrollHeight, ch: b.clientHeight } : null;
  });
  check('the grid is inside the scrolling body, which overflows', st && st.inBody && st.sh > st.ch, st);
  // a swipe up on a tile's corner, through CDP touch events (a real finger)
  const t = await page.locator('.mgtile').nth(12).boundingBox();
  const cdp = await ctx.newCDPSession(page);
  const x = t.x + 4, y0 = t.y + 4;
  const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', y0);
  for (let k = 1; k <= 10; k++) await touch('touchMove', y0 - k * 30);
  await touch('touchEnd');
  await page.waitForTimeout(400);
  const top = await page.evaluate(() => document.querySelector('.devbody').scrollTop);
  check('a swipe on a tile scrolls the grid', top > 100, top);
  await browser.close();
  console.log(fails ? `${fails} failed` : 'all ok');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log(e); process.exit(1); });
