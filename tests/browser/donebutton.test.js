const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

async function run(label, opts, useTap) {
  const browser = await launch();
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 420, height: 820 } }, opts));
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1100);
  const press = sel => (useTap ? page.tap(sel) : page.click(sel));

  await page.evaluate(() => { window.__in.current.loadout.bag.push('bounce', 'homing'); window.__in.current.notify(); });
  await press('.weapon');
  await page.waitForTimeout(250);
  check(`${label}: sheet opens`, await page.$('.sheet') !== null);

  await page.evaluate(() => { window.__lvl.marker = 'run-1'; });
  await press('.done');
  await page.waitForTimeout(400);
  let st = await page.evaluate(() => ({ sheet: !!document.querySelector('.sheet'),
    marker: window.__lvl.marker || null, bag: window.__in.current.loadout.bag.length }));
  check(`${label}: Done closes the sheet`, st.sheet === false, st);
  check(`${label}: Done keeps the run`, st.marker === 'run-1', st);
  check(`${label}: Done keeps collected mods`, st.bag === 2, st);

  // Restart must still do its job — it opens a confirm now, so press that too
  await press('.reset');
  await page.waitForTimeout(500);
  await press('.confirmRow .go');
  await page.waitForTimeout(600);
  st = await page.evaluate(() => ({ marker: window.__lvl.marker || null,
    bag: window.__in.current.loadout.bag.length, guns: window.__in.current.loadout.guns.filter(Boolean).length }));
  check(`${label}: Restart starts a new run`, st.marker === null, st);
  check(`${label}: Restart resets the loadout`, st.bag === 0 && st.guns === 2, st);

  // and the keyboard route in/out of the sheet
  if (!useTap) {
    await page.keyboard.press('e');
    await page.waitForTimeout(200);
    check(`${label}: E opens the sheet`, await page.$('.sheet') !== null);
    await page.evaluate(() => { window.__lvl.marker = 'run-2'; });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const k = await page.evaluate(() => ({ sheet: !!document.querySelector('.sheet'), marker: window.__lvl.marker || null }));
    check(`${label}: Escape closes and keeps the run`, k.sheet === false && k.marker === 'run-2', k);
  }
  await browser.close();
}

(async () => {
  await run('touch', { hasTouch: true, isMobile: true }, true);
  await run('mouse', {}, false);
  console.log(fails ? `\n${fails} failed` : '\nall good');
  process.exit(fails ? 1 : 0);
})();
