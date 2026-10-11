// Screenshots for the owner (v1.0.56): Dev → Fire sim, on the auto screen at phone size (412 x 880 @2.625).
//   node tools/firesimshots.js [outdir]      (default tests/build/firesim)
//   fs-a-page.png   the page: the window, Respawn / Fire, the knobs under it
//   fs-b-fire.png   Fire pressed, 0.8 s on          fs-c-pan.png   dragged along the room, Fire again, 1.5 s on
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'firesim'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; localStorage.removeItem('caverunner-auto-run'); localStorage.setItem('caverunner-devshow', '1'); localStorage.setItem('caverunner-devtab', 'firesim'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(3000);
  await page.locator('.adevbtn').dispatchEvent('pointerdown');
  await page.waitForTimeout(400);
  await page.locator('.devtab[data-t=firesim]').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'fs-a-page.png') });
  await page.locator('.firego').dispatchEvent('pointerdown');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'fs-b-fire.png') });
  const box = await page.locator('.firesimcvs').boundingBox();
  if (box) {
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width - 20, y); await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + box.width - 20 - i * 30, y);
    await page.mouse.up();
  }
  const dragged = await page.evaluate(() => Math.round(window.__firesim.S.scroll));
  // then over to a stand of vines (or the vines over moss) to show the leaves passing it on
  await page.evaluate(() => { const F = window.__firesim, p = F.pts.find(q => q.kind === 'mix') || F.pts.find(q => q.kind === 'vines'); if (p) F.S.scroll = Math.max(0, p.x + 20 - 110); });
  await page.waitForTimeout(200);
  await page.locator('.firego').dispatchEvent('pointerdown');
  await page.waitForTimeout(900);
  console.log('dragged to', dragged);
  await page.screenshot({ path: path.join(OUT, 'fs-c-pan.png') });
  const info = await page.evaluate(() => { const F = window.__firesim; return F && F.S ? { scroll: Math.round(F.S.scroll), fire: F.S.fire.length, kinds: F.pts.map(p => p.kind).join(' ') } : null; });
  console.log('fs-a-page.png  fs-b-fire.png  fs-c-pan.png', JSON.stringify(info));
  await browser.close();
})().catch(e => { console.log(e); process.exit(1); });
