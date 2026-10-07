// The gun look gallery (LIST4 item 2, ui/gunart.js): in the Bag, the 🖼️ button opens it; a tap
// on a skin sets the selected gun's `art`, closes the gallery, and the Default tile takes it off.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1100);
  await page.tap('.weapon');
  await page.waitForTimeout(250);
  check('the Bag has the look button', await page.$('.sheet .artbtn') !== null);
  await page.tap('.artbtn');
  await page.waitForTimeout(250);
  const n = await page.$$eval('.artpick', b => b.length);
  const want = await page.evaluate(() => window.GUN_ART.length + 1);
  check('the gallery shows Default and every skin', n === want, { n, want });
  const pick = await page.evaluate(() => window.GUN_ART[5].id);
  await page.tap(`.artpick[data-art="${pick}"]`);
  await page.waitForTimeout(250);
  let st = await page.evaluate(() => { const L = window.__in.current.loadout; return { art: L.guns[L.sel].art, open: !!document.querySelector('.artsheet') }; });
  check('a tap sets the gun\'s skin', st.art === pick, st);
  check('and closes the gallery', !st.open, st);
  // reopen: the picked one is lit; Default takes it off
  await page.tap('.artbtn');
  await page.waitForTimeout(250);
  const on = await page.$eval('.artpick.on', b => b.dataset.art);
  check('the current skin is highlighted', on === pick, on);
  await page.tap('.artpick[data-art=""]');
  await page.waitForTimeout(250);
  st = await page.evaluate(() => { const L = window.__in.current.loadout; return { art: L.guns[L.sel].art, open: !!document.querySelector('.artsheet') }; });
  check('Default takes the skin off', st.art === undefined && !st.open, st);
  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall good');
  process.exit(fails ? 1 : 0);
})();
