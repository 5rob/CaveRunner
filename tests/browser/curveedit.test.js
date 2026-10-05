// Dev → Level 2: destruction's two curve editors (ui/devpanel.js CurveEdit, dev/knobs.js curveKnobs):
// both drawn in their group, and a tap near a handle drags it (the end point only up and down).
// Screenshot: curveedit_dev.png (for the owner, when the destruction lands).
const { launch } = require('../chromium');
const path = require('path');
const DIR = path.join(__dirname, '..', 'build');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(DIR, 'test.html'));
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    for (const k of Object.keys(DEV_DEFAULTS)) if (k.startsWith('l2b')) devSet(k, DEV_DEFAULTS[k]);
    localStorage.setItem('caverunner-devgroups', JSON.stringify({ l2boom: true }));
  });
  await page.tap('.devbtn');
  await page.waitForTimeout(400);
  const n = await page.evaluate(() => [...document.querySelectorAll('.fadecurve[data-curve]')].map(e => e.getAttribute('data-curve')));
  check('both curves drawn in the group', n.includes('l2bDen') && n.includes('l2bScale'), n);
  await page.evaluate(() => document.querySelector('.fadecurve[data-curve="l2bDen"]').scrollIntoView());
  await page.waitForTimeout(200);
  // the end point sits at the box's bottom right (y 0): tap halfway up its right edge
  const box = await page.evaluate(() => { const r = document.querySelector('.fadecurve[data-curve="l2bDen"] svg').getBoundingClientRect(); return { w: r.width, h: r.height }; });
  await page.tap('.fadecurve[data-curve="l2bDen"] svg', { position: { x: box.w * 188 / 200, y: box.h * 66 / 132 } });
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({ y3: DEV.l2bDen1, c2x: DEV.l2bDenC2x, c2y: DEV.l2bDenC2y }));
  check('a tap by the end point moves it up (and only it)', after.y3 > 0.3 && after.y3 < 0.7 && after.c2x === 0.5 && after.c2y === 0, after);
  await page.screenshot({ path: path.join(DIR, 'curveedit_dev.png') });
  await page.evaluate(() => { for (const k of Object.keys(DEV_DEFAULTS)) if (k.startsWith('l2b')) devSet(k, DEV_DEFAULTS[k]); localStorage.removeItem('caverunner-devgroups'); });

  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
