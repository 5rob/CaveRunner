// The gun look gallery (LIST4 item 2, ui/gunart.js): in the Bag, the 🖼️ button opens it; every gun
// wears a sprite (v0.0.161: no Default, the old drawn gun is gone), so before any pick the one its
// colour gives it (gunArtId) is lit; a tap on another sets the selected gun's `art` and closes.
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
  const before = await page.evaluate(() => { const L = window.__in.current.loadout, g = L.guns[L.sel]; return { art: g.art, id: gunArtId(g) }; });
  await page.tap('.artbtn');
  await page.waitForTimeout(250);
  const n = await page.$$eval('.artpick', b => b.length);
  const want = await page.evaluate(() => window.GUN_ART.length);
  check('the gallery shows every skin, no Default', n === want && !(await page.$('.artpick[data-art=""]')), { n, want });
  let on = await page.$eval('.artpick.on', b => b.dataset.art);
  check('an unpicked gun has its colour\'s sprite lit', !before.art && on === before.id, { before, on });
  const pick = await page.evaluate(id => window.GUN_ART.find(a => a.id !== id).id, before.id);
  await page.tap(`.artpick[data-art="${pick}"]`);
  await page.waitForTimeout(250);
  const st = await page.evaluate(() => { const L = window.__in.current.loadout; return { art: L.guns[L.sel].art, open: !!document.querySelector('.artsheet') }; });
  check('a tap sets the gun\'s skin', st.art === pick, st);
  check('and closes the gallery', !st.open, st);
  // reopen: the picked one is lit
  await page.tap('.artbtn');
  await page.waitForTimeout(250);
  on = await page.$eval('.artpick.on', b => b.dataset.art);
  check('the current skin is highlighted', on === pick, on);
  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall good');
  process.exit(fails ? 1 : 0);
})();
