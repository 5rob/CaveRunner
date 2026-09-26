// Dev → New cave: rolls this floor again with a fresh seed, closes the panel, puts you at
// the shop start, and the game runs on.
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
  const before = await page.evaluate(() => {
    const L = window.__lvl; L.p.x += 40;
    let open = 0; for (let i = 0; i < L.mat.length; i++) if (!L.mat[i]) open++;
    return { seed: L.seed, floor: L.floor, open };
  });

  await page.tap('.devbtn');
  await page.waitForTimeout(150);
  check('the Dev panel has a New cave button', await page.$('.dbg.newcave') !== null);
  await page.tap('.dbg.newcave');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => {
    const L = window.__lvl;
    let open = 0; for (let i = 0; i < L.mat.length; i++) if (!L.mat[i]) open++;
    return { seed: L.seed, floor: L.floor, open, dev: !!document.querySelector('.devpanel'),
      paused: window.__in.current.paused, dx: Math.round(L.p.x - L.start.x) };
  });
  check('a new seed on the same floor', after.seed !== before.seed && after.floor === before.floor, { before, after });
  check('the cave itself changed', after.open !== before.open, { before: before.open, after: after.open });
  check('the panel closed and the game runs', !after.dev && after.paused === false, after);
  check('you are back at the shop start', Math.abs(after.dx) < 20, after.dx);

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
