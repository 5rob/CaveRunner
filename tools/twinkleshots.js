// Screenshots for the owner (v1.0.58, the fire's twinkle): Dev → Fire sim, a crate and a stand of vines lit, the window
// grabbed six times 0.1 s apart into one sheet (2 x 3), so the burning pixels can be compared frame to frame.
//   node tools/twinkleshots.js [outdir]      (default tests/build/twinkle)  →  tw-sheet.png
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'twinkle'));
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
  // over a crate (or moss), lit, and the vines nearest too
  await page.evaluate(() => {
    const F = window.__firesim, p = F.L.pts.find(q => q.kind === 'crate') || F.L.pts.find(q => q.kind === 'moss');
    F.L.S.scroll = Math.max(0, p.x - 110);
    titleIgnite(F.L.S, p.x - F.L.S.scroll, p.y, 8, 1);
    titleIgnite(F.L.S, p.x - F.L.S.scroll, p.y - 14, 8, 1);
    const d = document.createElement('div'); d.id = 'sheet';
    Object.assign(d.style, { position: 'fixed', inset: '0', background: '#0b0910', zIndex: 99999, display: 'none', gridTemplateColumns: '1fr 1fr', gap: '6px', padding: '30px 6px', alignContent: 'start', font: '15px sans-serif', color: '#fff' });
    document.body.appendChild(d);
  });
  await page.waitForTimeout(700);
  for (let i = 0; i < 6; i++) {
    await page.evaluate(i => {
      const cv = document.querySelector('.firesimcvs'), c = document.createElement('canvas'), w = cv.width, h = cv.height;
      c.width = 196; c.height = 150;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
      x.drawImage(cv, w * 0.3, h * 0.35, w * 0.4, h * 0.6, 0, 0, 196, 150);
      const el = document.createElement('div'); el.append(c, document.createTextNode('+' + (i / 10).toFixed(1) + ' s'));
      document.getElementById('sheet').appendChild(el);
    }, i);
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => { document.getElementById('sheet').style.display = 'grid'; });
  await page.screenshot({ path: path.join(OUT, 'tw-sheet.png') });
  console.log('tw-sheet.png');
  await browser.close();
})().catch(e => { console.log(e); process.exit(1); });
