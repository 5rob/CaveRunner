// The volume lock (owner, v1.0.93; src/ui/volume.js): a press held 4 s without moving on any volume slider in the pause
// menu locks all three (they can't be moved, 🔒), and the same again unlocks them; the press changes no volume; a press that
// moves doesn't lock. Real mouse events in Grem Mode's pause menu. Screenshot tests/build/autoshots/volume-locked.png.
const { launch } = require('../chromium');
const path = require('path');
const fs = require('fs');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };
const OUT = path.join(__dirname, '..', 'build', 'autoshots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; localStorage.removeItem('caverunner-vol-lock'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(800);
  await page.locator('.grem .pausebtn').dispatchEvent('pointerdown');
  await page.waitForTimeout(400);
  check('the pause menu has the volumes', !!(await page.$('.volumes')));
  const vol = () => page.evaluate(() => [SFX.volume, SFX.fxVolume, SFX.musicVolume].map(v => Math.round(v * 100)).join());
  const locked = () => page.evaluate(() => document.querySelector('.volumes').classList.contains('locked'));
  const box = await page.locator('[data-vol="fx"] .volslider').boundingBox();
  const at = { x: box.x + box.width * 0.2, y: box.y + box.height / 2 };
  const before = await vol();

  // a press that moves: no lock
  await page.mouse.move(at.x, at.y); await page.mouse.down();
  await page.mouse.move(at.x + 60, at.y, { steps: 5 });
  await page.waitForTimeout(4300);
  await page.mouse.up();
  check('a press that moves doesn\'t lock', !(await locked()));

  // held still 4 s: locked, volumes as before the press
  const v1 = await vol();
  await page.mouse.move(at.x, at.y); await page.mouse.down();
  await page.waitForTimeout(4300);
  await page.mouse.up();
  await page.waitForTimeout(150);
  check('held 4 s still: locked', await locked());
  check('… the press changed no volume', (await vol()) === v1, [await vol(), v1]);
  check('… a lock shows', (await page.locator('[data-vol="master"] span').innerText()).includes('🔒'));
  check('… kept on the device', await page.evaluate(() => localStorage.getItem('caverunner-vol-lock') === '1'));
  await page.screenshot({ path: path.join(OUT, 'volume-locked.png') });
  // locked: a drag moves nothing
  await page.mouse.move(at.x, at.y); await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.9, at.y, { steps: 6 });
  await page.mouse.up();
  check('locked: a drag changes nothing', (await vol()) === v1, [await vol(), v1]);
  // held again: unlocked
  await page.mouse.move(at.x, at.y); await page.mouse.down();
  await page.waitForTimeout(4300);
  await page.mouse.up();
  await page.waitForTimeout(150);
  check('held again: unlocked', !(await locked()) && (await vol()) === v1);
  await page.mouse.move(at.x, at.y); await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.9, at.y, { steps: 6 });
  await page.mouse.up();
  check('unlocked: a drag changes it again', (await vol()) !== v1, [await vol(), v1, before]);

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall ok');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log(e); process.exit(1); });
