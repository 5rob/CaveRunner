// v0.0.136: a new run starts in a dark shop. The way in crackles; after 2 s the first tubes
// (the teleporter and heal) stutter on; each next section comes on as you reach the middle of the
// last one lit, one vending machine at a time; then the shop is the normal, lit shop. And the
// TELEPORTER sign over the way in. Screenshots: shoplights-*.png (phone size).
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_INTRO = true; window.__TEST_VOID = true; });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  const shot = n => page.screenshot({ path: path.join(__dirname, '..', 'build', 'shoplights-' + n + '.png') });
  const state = () => page.evaluate(() => { const L = window.__lvl; return { t: L.time, on: L.shopLit && L.shopLit.on.slice(), zap: L.padZap[1] }; });
  // how bright the screen is over a world box (mean of r+g+b), read off the game canvas
  const bright = (x0, y0, x1, y1) => page.evaluate(([x0, y0, x1, y1]) => {
    const L = window.__lvl, c = document.querySelector('canvas'), cam = L.light.cam, s = L.light.s;
    const fy = L.world.SHOP_FLOOR * L.world.CELL;
    const sx = Math.round((x0 - cam.x) * s), sy = Math.round((fy + y0 - cam.y) * s), w = Math.round((x1 - x0) * s), h = Math.round((y1 - y0) * s);
    const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
    const t = tmp.getContext('2d'); t.drawImage(c, sx, sy, w, h, 0, 0, w, h);
    const d = t.getImageData(0, 0, w, h).data; let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
    return sum / (d.length / 4);
  }, [x0, y0, x1, y1]);
  // the frames run while we wait: wait until the game's clock passes t (with a try limit)
  const until = async t => { for (let i = 0; i < 100; i++) { if ((await state()).t >= t) return true; await page.waitForTimeout(50); } return false; };
  const goTo = x => page.evaluate(x => { const L = window.__lvl; L.p.x = x - 6; L.p.vx = 0; }, x);

  // the guide hologram holds the hall's lights until it has spoken: that's guide.test.js; here, no guide
  await page.evaluate(() => { window.__lvl.guide = null; });
  await until(0.8);
  let s = await state();
  check('a new run starts with the shop dark', !!s.on && s.on.every(v => v < 0), s.on);
  check('and the way in crackling', s.t - s.zap < 1, s);
  const dark = await bright(180, -90, 205, -10);       // the wall past the heal, away from you and the pad
  await shot('1-dark');
  await until(2.3);
  s = await state();
  check('after 2 s the first section comes on', s.on[0] >= 0 && s.on[1] < 0, s.on);
  await page.waitForTimeout(60);
  await shot('2-flicker');
  await until(4.2);
  const lit = await bright(180, -90, 205, -10);
  check('lighting the teleporter, not past it', lit < dark * 1.3, { dark, lit });
  const near = await bright(115, -90, 140, -10);
  check('lighting the teleporter', near > dark * 1.4, { dark, near });
  s = await state();
  check('but not the next section while you stand on the pad', s.on[1] < 0, s.on);
  await shot('3-first');
  // walk on, one section at a time
  const LIGHT_X = await page.evaluate(() => LIGHT_X);
  await goTo(await page.evaluate(() => FIRST_TRIGGER + 4));
  await until((await state()).t + 0.3);
  s = await state();
  check('off the pad: the next stretch of hall comes on', s.on[1] >= 0 && s.on[2] < 0, s.on);
  await page.waitForTimeout(250);
  await shot('4-buy');
  await goTo(LIGHT_X[1]);
  await until((await state()).t + 1.6);
  s = await state();
  check('at its middle: the next one, and only that', s.on[2] >= 0 && s.on[3] < 0, s.on);
  await shot('5-sell');
  const PI = await page.evaluate(() => LIGHT_X.indexOf(SHOP_MACHINE_X[2]));
  for (let i = 2; i <= PI; i++) { await goTo(LIGHT_X[i]); await until((await state()).t + 0.4); }
  s = await state();
  check('on along to the perk machine', !s.on || s.on[PI] >= 0, s.on);   // (null: the whole hall's already on)
  await until((await state()).t + 1.4);
  await shot('6-perks');
  // the rest of the hall comes on by itself, then the shop is back to normal
  let done = false;
  for (let i = 0; i < 80 && !done; i++) { await page.waitForTimeout(100); done = !(await state()).on; }
  check('then the whole hall, and the dark shop is over', done);
  // the sign
  await goTo(await page.evaluate(() => ARRIVAL_X));
  await page.waitForTimeout(800);
  await shot('7-sign');
  const sign = await bright(20, -84, 100, -50);
  check('the sign over the way in shows', sign > 150, sign);
  await browser.close();
  console.log(fails ? fails + ' failed' : 'all ok');
  process.exit(fails ? 1 : 0);
})();
