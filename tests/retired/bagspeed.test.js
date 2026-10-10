// The Bag stays quick with a big gun: a drag re-renders the Bag on every move, and the dmg/s line
// used to re-run the whole build advisor (swap tips and all) each time, ~20ms a go on a PC with a
// 26-slot gun, far more on a phone. Measures the script time Chrome spent on one 20-step drag.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const LO = window.__in.current.loadout, ids = Object.keys(MODS), g = LO.guns[LO.sel];
    g.cap = 26; g.slots = [];
    for (let i = 0; i < 26; i++) g.slots.push(ids[(i * 7) % ids.length]);
    resetGun(g);
    for (let i = 0; i < 40; i++) LO.bag.push(ids[(i * 3) % ids.length]);
    window.__in.current.notify();
  });
  await page.click('.weapon');
  await page.waitForTimeout(600);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  const script = async () => (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'ScriptDuration').value;

  // a drag that goes nowhere (back to the bag): 20 moves of re-rendering, no build change
  const from = await page.$('.bag .tile[data-mod]');
  const fb = await from.boundingBox(), sb = await (await page.$('.slotRow .tile')).boundingBox();
  const s0 = await script();
  await page.mouse.move(fb.x + 10, fb.y + 10); await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(fb.x + 10 + (sb.x - fb.x) * i / 40, fb.y + 10 + (sb.y - fb.y) * i / 40);
  await page.mouse.move(fb.x + 10, fb.y + 10);
  await page.mouse.up();
  await page.waitForTimeout(100);
  const ms = Math.round((await script() - s0) * 1000);
  check('a 20-step drag in a big gun\'s Bag costs little script time', ms < 150, ms + 'ms');
  check('the bag is as it was', await page.evaluate(() => window.__in.current.loadout.bag.length) === 40);

  // and the dmg/s line still follows the build: two different builds, each shows its own number
  const shown = async slots => {
    const want = await page.evaluate(sl => {
      const LO = window.__in.current.loadout, g = LO.guns[LO.sel];
      g.slots = sl.concat(new Array(g.cap - sl.length).fill(null)); resetGun(g); window.__in.current.notify();
      return buildAdvice(g, []).now.dps.toFixed(1) + ' dmg/s';
    }, slots);
    await page.waitForTimeout(200);
    return { want, got: await page.$eval('.advice .diag b', el => el.textContent) };
  };
  const b1 = await shown(['bolt']), b2 = await shown(['dmg_up', 'dmg_up', 'triple', 'bolt', 'bolt', 'bolt']);
  check('the dmg/s line updates when the build changes',
    b1.got === b1.want && b2.got === b2.want && b1.want !== b2.want, [b1, b2]);
  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall good');
  process.exit(fails ? 1 : 0);
})();
