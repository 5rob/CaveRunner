// Screenshots for the owner (v1.0.58): Dev → Fire sim at phone size (412 x 880 @2.625).
//   node tools/firesimshots.js [outdir]      (default tests/build/firesim)
//   fs-a-page.png    the page: the window (over the vines), Respawn / Hold for fire, the knobs under it
//   fs-b-spots.png   each test spot in the window (vines, webs, timber, moss, grass), one under another
//   fs-c-jets.png    Fire held over the timber, 1.2 s on: jets out of the floor
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
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; localStorage.removeItem('caverunner-auto-run'); localStorage.setItem('caverunner-devshow', '1'); });
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
  const pan = kind => page.evaluate(kind => { const F = window.__firesim, q = LAB_SPOTS.find(s => s.kind === kind); F.L.S.scroll = labClamp(q.x0 + LAB_SPOT / 2 - TITLE_VW / 2); F.x = F.L.S.scroll; }, kind);
  await pan('vines'); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'fs-a-page.png') });
  // each spot, the window grabbed into a sheet
  await page.evaluate(() => {
    const d = document.createElement('div'); d.id = 'sheet';
    Object.assign(d.style, { position: 'fixed', inset: '0', background: '#0b0910', zIndex: 99999, display: 'none', flexDirection: 'column', gap: '4px', padding: '8px', font: '13px sans-serif', color: '#fff' });
    document.body.appendChild(d);
  });
  for (const kind of ['vines', 'webs', 'timber', 'moss', 'grass']) {
    await pan(kind); await page.waitForTimeout(250);
    await page.evaluate(() => {
      const cv = document.querySelector('.firesimcvs'), c = document.createElement('canvas');
      c.width = cv.width; c.height = cv.height; c.style.width = '300px'; c.style.height = Math.round(300 * cv.height / cv.width) + 'px';
      c.getContext('2d').drawImage(cv, 0, 0);
      const el = document.createElement('div'); el.append(c); document.getElementById('sheet').appendChild(el);
    });
  }
  await page.evaluate(() => { document.getElementById('sheet').style.display = 'flex'; });
  await page.screenshot({ path: path.join(OUT, 'fs-b-spots.png') });
  await page.evaluate(() => { document.getElementById('sheet').remove(); });
  // Fire held over the timber
  await pan('timber'); await page.waitForTimeout(200);
  await page.locator('.firego').dispatchEvent('pointerdown');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, 'fs-c-jets.png') });
  await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup')));
  const info = await page.evaluate(() => { const F = window.__firesim; return { hold: F.hold, jets: F.L.jets.length, burnt: F.L.S.burnt }; });
  console.log('fs-a-page.png  fs-b-spots.png  fs-c-jets.png', JSON.stringify(info));
  await browser.close();
})().catch(e => { console.log(e); process.exit(1); });
