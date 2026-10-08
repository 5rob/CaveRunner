// Screenshots for the owner (v0.0.168), phone size (412 x 880 @2.625), the real title through the test page:
// each visit's zones its own (random order, lengths, roof and floor), and the camera: a pinch zoomed in, a
// tap on a player followed.
//   node tools/titlecamshots.js [outdir]      (default tests/build/titlecamshots)
// Not a test: it takes the pictures and prints what each shows.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'titlecamshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const said = [];
  const open = async seed => {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(s => { window.__TEST_TITLE = true; window.__TITLE_SEED = s; }, seed);
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    return { ctx, page };
  };
  const zones = page => page.evaluate(() => {
    const { S } = window.__title, out = [];
    for (let Z = titleZoneSpan(S.scroll, S); Z.x0 < S.scroll + 220; Z = titleZoneSpan(Z.x1 + 1, S)) out.push(Z.z);
    return out.join(' + ');
  });
  const snap = async (page, n, what) => { await page.screenshot({ path: path.join(OUT, n + '.png') }); said.push(`${n}.png  ${what}`); };

  // three visits, three different caves
  for (const [n, seed, wait] of [['a', 101, 5000], ['b', 202, 5000], ['c', 303, 12000]]) {
    const { ctx, page } = await open(seed);
    await page.waitForTimeout(wait);
    await snap(page, `${n}-visit`, `another visit (seed ${seed}), ${wait / 1000} s in: ${await zones(page)}`);
    await ctx.close();
  }
  // the camera, by real touches
  const { ctx, page } = await open(101);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  await page.waitForTimeout(3000);
  await touch('touchStart', [[180, 380], [230, 380]]);
  for (let i = 1; i <= 8; i++) await touch('touchMove', [[180 - i * 5, 380], [230 + i * 5, 380]]);
  await touch('touchEnd', []);
  await page.waitForTimeout(300);
  await snap(page, 'd-pinched', 'two fingers spread: zoomed in about 2.6x where they were');
  const who = await page.evaluate(() => {
    const { C, S } = window.__title;
    Object.assign(C, { z: 1, x: 110, y: C.ay });
    return S.runners.findIndex(r => r.x > 4 && r.x < 200);
  });
  const p = await page.evaluate(i => { const { S } = window.__title, r = S.runners[i], k = 412 / 220; return [(r.x + 6) * k, (r.y + 11) * k]; }, who);
  await touch('touchStart', [p]); await touch('touchEnd', []);
  await page.waitForTimeout(2500);
  await snap(page, 'e-follow', `tapped player ${who + 1}: the camera zooms in (2x) and follows them (2.5 s on)`);
  await page.waitForTimeout(3000);
  await snap(page, 'f-follow-later', '3 s later, still following');
  await ctx.close();
  await browser.close();
  console.log(said.join('\n'));
})();
