// The whole of floor 2 as the game draws it, in one picture: back wall, hologram, silk, rock, decoration,
// the dark zones and the destruction (the real renderer, zoomed out to fit, fog lifted, hologram at full).
//   node tools/floorshot.js [out.png]      (default tests/build/floorshot.png; HOLO=0: hologram at rest)
const fs = require('fs');
const path = require('path');
const { launch } = require('../tests/chromium');
require('./build')();
require('../tests/build')();

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'floorshot.png'));
fs.mkdirSync(path.dirname(OUT), { recursive: true });

(async () => {
  const browser = await launch();
  // the canvas at 1 px per world unit is the floor's own size (1280 × 3200)
  const ctx = await browser.newContext({ viewport: { width: 640, height: 1600 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  for (let i = 0; i < 100 && !(await page.evaluate(() => window.__lvl && window.__lvl.p)); i++) await page.waitForTimeout(50);
  await page.evaluate(() => { window.__lvl.guide = null; Math.random = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(); window.__in.current.newCave = 2; });
  for (let i = 0; i < 60 && !(await page.evaluate(() => window.__lvl.floor === 2 && window.__lvl.dark.length > 0)); i++) await page.waitForTimeout(100);
  await page.waitForTimeout(3000);   // the floor's name card
  const holo = process.env.HOLO !== '0';
  await page.evaluate(h => {
    const L = window.__lvl, { CW, CH, CELL } = L.world;
    L.seen.fill(2); L.fog.paint();
    if (h) { DEV.holoMin = 1; DEV.holoMax = 1; }
    window.__pin = { x: CW * CELL / 2, y: CH * CELL / 2 };
    document.querySelectorAll('.hud, .ctl, button').forEach(e => { e.style.visibility = 'hidden'; });
  }, holo);
  // zoom out until the whole floor fits (the renderer's scale s: canvas px per world unit)
  for (let k = 0; k < 4; k++) {
    await page.waitForTimeout(400);
    await page.evaluate(() => { const L = window.__lvl, { CW, CELL } = L.world, cv = document.querySelector('canvas.game'); DEV.zoom *= (cv.width / (CW * CELL)) / L.light.s; });
  }
  // the camera keeps you off-centre: move the pin until the view starts at the floor's top-left
  for (let k = 0; k < 4; k++) {
    await page.waitForTimeout(700);
    await page.evaluate(() => { const L = window.__lvl; window.__pin = { x: window.__pin.x - L.camX, y: window.__pin.y - L.camY }; });
  }
  await page.waitForTimeout(1500);
  const url = await page.evaluate(() => document.querySelector('canvas.game').toDataURL('image/png'));
  fs.writeFileSync(OUT, Buffer.from(url.split(',')[1], 'base64'));
  console.log(OUT);
  await browser.close();
})().catch(e => { console.log('ERROR', e); process.exit(1); });
