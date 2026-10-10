// The gold, debt and settlement clock at the top: centred on the screen, the debt in full
// (64,000,000,000, not 64B), and all of it on screen at phone widths, clear of the Dev gear.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const browser = await launch();
  for (const [w, hgt] of [[360, 640], [412, 880]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
    await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      const LO = window.__in.current.loadout;
      LO.gold = 12345; LO.debt = 64000000000; LO.due = Date.now() + 59 * 60 * 1000;
      window.__in.current.sig = ''; window.__in.current.notify();
    });
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      const box = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, mid: (b.left + b.right) / 2, t: b.top }; };
      return { purse: box('.gold .purse'), debt: box('.gold .debt'), due: box('.gold .due'), gear: box('.devbtn'),
        text: (document.querySelector('.gold .debt') || {}).textContent, size: getComputedStyle(document.querySelector('.gold .purse')).fontSize,
        vw: innerWidth };
    });
    check(w + ': the debt is shown in full', r.text === '-64,000,000,000g owed', r.text);
    check(w + ': all three centred on the screen', ['purse', 'debt', 'due'].every(k => r[k] && Math.abs(r[k].mid - r.vw / 2) < 3), r);
    check(w + ': all on screen and clear of the gear', ['purse', 'debt', 'due'].every(k => r[k].l >= 0 && (r[k].r < r.gear.l || r[k].t > r.gear.t + 40)), r);
    check(w + ': the gold is bigger than it was (19px)', parseFloat(r.size) > 19, r.size);
    await page.screenshot({ path: path.join(__dirname, '..', 'build', 'topgold_' + w + '.png'), clip: { x: 0, y: 0, width: w, height: 140 } });
    await ctx.close();
  }
  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
