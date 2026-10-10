// The Bag's mana bar (owner, after v0.0.149): under the stats' Mana row it drains and refills with the fire
// preview, like cast delay's and recharge's. It never moved (it read the gauge under the row's key, `manaMax`).
// Saves manabar.png (412×880) to CAVERUNNER_SHOTS when it is set.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const SHOTS = process.env.CAVERUNNER_SHOTS || '';

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1000);
  // a gun that spends faster than it refills: the bar has to drop
  await page.evaluate(() => {
    const LO = window.__in.current.loadout, g = LO.guns[LO.sel];
    g.cap = 4; g.multi = 1; g.shuffle = false; g.castDelay = 0.1; g.recharge = 0.2; g.manaMax = 100; g.manaRegen = 5;
    g.slots = ['fball', 'fball', 'fball', 'fball'];
    resetGun(g);
    window.__in.current.notify();
  });
  await page.click('.weapon');
  let low = 1;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(100);
    const w = await page.evaluate(() => {
      const b = document.querySelector('[data-live=manaMax]');
      return b ? parseFloat(b.style.width) / 100 : NaN;
    });
    if (!(w >= 0)) { low = NaN; break; }
    low = Math.min(low, w);
  }
  check('the mana bar drains as the preview fires', low < 0.9, low);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'manabar.png') });
  await browser.close();
  console.log(fails ? `${fails} failed` : 'all good');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
