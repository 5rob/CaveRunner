// Screenshots for the owner (after v1.0.77): Dev → Zones at phone size (412 x 880 @2.625).
//   node tools/zonesimshots.js [outdir]      (default tests/build/zonesim)
//   zs-a-page.png     the page: the window (Mossy caves, plain), Respawn / Copy zone notes, the first zone cards
//   zs-b-cards.png    scrolled down: the cards (Show, can-have boxes, notes) under the sticky window
//   zs-c-<zone>.png   each zone plain / heavy vegetation / spider web filled: the whole-zone window, one under another
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'zonesim'));
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
  await page.locator('.devtab[data-t=zones]').click();
  await page.waitForTimeout(800);
  await page.locator('.zcard[data-zone=moss] .znote').first().fill('More moss on the ceiling, please');
  await page.screenshot({ path: path.join(OUT, 'zs-a-page.png') });
  await page.locator('.zcard[data-zone=timber]').evaluate(e => e.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'zs-b-cards.png') });
  // each zone: the whole-zone window plain / heavy vegetation / spider web filled, one under another
  const zones = (process.argv[3] || 'moss,webs,timber,paved,grove,winding,spider').split(',');
  for (const z of zones) {
    await page.evaluate(() => {
      const d = document.createElement('div'); d.id = 'sheet';
      Object.assign(d.style, { position: 'fixed', inset: '0', background: '#0b0910', zIndex: 99999, display: 'none', flexDirection: 'column', gap: '2px', padding: '6px', font: '12px sans-serif', color: '#fff' });
      document.body.appendChild(d);
    });
    for (const v of ['plain', 'veg', 'spid']) {
      await page.locator(`.zcard[data-zone=${z}] .zrow[data-v=${v}] .zshow`).click();
      await page.waitForTimeout(900);
      const label = await page.locator('.zsname').innerText();
      await page.evaluate(label => {
        const cv = document.querySelector('.zonesimcvs'), c = document.createElement('canvas');
        c.width = cv.width; c.height = cv.height; c.style.width = '58%';
        c.getContext('2d').drawImage(cv, 0, 0);
        const t = document.createElement('div'); t.textContent = label.replace('Showing: ', '');
        document.getElementById('sheet').append(t, c);
      }, label);
    }
    await page.evaluate(() => { document.getElementById('sheet').style.display = 'flex'; });
    await page.screenshot({ path: path.join(OUT, `zs-c-${z}.png`) });
    await page.evaluate(() => { document.getElementById('sheet').remove(); });
  }
  await browser.close();
  console.log('shots in ' + OUT);
})();
