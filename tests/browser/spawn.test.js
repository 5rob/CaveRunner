const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1300);

  const at = () => page.evaluate(() => ({
    px: Math.round(window.__lvl.p.x), py: Math.round(window.__lvl.p.y),
    start: { x: Math.round(window.__lvl.start.x), y: Math.round(window.__lvl.start.y) },
    arrival: { x: Math.round(window.__lvl.arrival.x), y: Math.round(window.__lvl.arrival.y) },
    firstPlinth: Math.round(Math.min(...window.__lvl.stock.map(s => s.x))),
    shopLeft: 3 * window.__lvl.world.CELL, worldW: window.__lvl.world.WW, floor: window.__lvl.floor,
    shopY: window.__lvl.world.SHOP_Y,
    onPlinth: !!document.querySelector('.buypanel'),
  }));
  let a = await at();
  check('spawns at the far left of the shop', a.px < 60, a);
  check('and on the shop floor', a.py > a.shopY, { py: a.py, shopY: a.shopY });
  check('clear of the first plinth', a.firstPlinth - a.px > 60, { spawn: a.px, plinth: a.firstPlinth });
  check('so nothing is being offered on arrival', a.onPlinth === false);
  check('the arrival portal sits by the spawn', Math.abs(a.arrival.x - a.px) < 40, a.arrival);
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'spawn.png') });

  // and the next floor puts you in the same place
  await page.evaluate(async () => {
    const { p, portal } = window.__lvl;
    p.x = portal.x; p.y = portal.y;
    await new Promise(r => setTimeout(r, 500));
  });
  const b = await at();
  check('next floor spawns at the far left too', b.floor === 2 && b.px < 60, b);
  check('with its own arrival portal', Math.abs(b.arrival.x - b.px) < 40, b.arrival);
  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
