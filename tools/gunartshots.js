// Screenshots of the gun skins (LIST4 item 2), phone size (412 x 880 @2.625), the real game through the
// test page. Not a test: it takes the pictures and prints what each shows.
//   node tools/gunartshots.js [outdir]      (default tests/build/gunartshots)
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'gunartshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  for (let i = 0; i < 100 && !(await page.evaluate(() => window.__lvl && window.__lvl.p)); i++) await page.waitForTimeout(50);
  await page.evaluate(() => { window.__lvl.guide = null; });
  const said = [];
  const shot = async (n, what) => { await page.screenshot({ path: path.join(OUT, n + '.png') }); said.push(`${n}.png  ${what}`); };

  // (a) the gallery, open from the Bag, after picking one so it's highlighted
  await page.tap('.weapon'); await page.waitForTimeout(300);
  await shot('a0-bag', 'the Bag: the 🖼️ look button in the header, left of the gold');
  await page.tap('.artbtn'); await page.waitForTimeout(300);
  const pick = await page.evaluate(() => window.GUN_ART[0].id);
  await page.tap(`.artpick[data-art="${pick}"]`); await page.waitForTimeout(300);
  await page.tap('.artbtn'); await page.waitForTimeout(400);
  await shot('a1-gallery', 'the gallery: Default first, every skin with its name, the current one (Pink Carbine) lit gold');
  await page.tap('.artsheet .done'); await page.waitForTimeout(300);
  await shot('a2-bag-skinned', 'the Bag with the skin on: the gun tab icon and the firing window');
  await page.tap('.sheet .done'); await page.waitForTimeout(300);

  // (b) in hand, zoomed in, in a sandbox; every gun skinned so the HUD slots show them too
  await page.evaluate(() => {
    const L = window.__in.current.loadout, A = window.GUN_ART;
    L.guns.forEach((g, i) => { if (g) g.art = A[[0, 8, 19, 23][i]].id; });
    window.DEV.zoom = 3; window.__lvl.sandbox({}); window.__in.current.notify && window.__in.current.notify();
  });
  await page.waitForTimeout(600);
  await shot('b1-hand', 'in game, zoom 3: the Pink Carbine skin in the hand; the HUD slots show each gun\'s skin');
  await page.evaluate(() => { const L = window.__in.current.loadout; L.sel = 1; window.__in.current.notify && window.__in.current.notify(); });
  await page.waitForTimeout(400);
  await shot('b2-hand', 'the same with slot 2 (Red Sniper) in hand');

  // (c) a contact sheet of every sprite, 4 device px per art pixel, grip marked with a red dot
  const url = await page.evaluate(() => {
    const A = window.GUN_ART, S = 4, c = document.createElement('canvas'); c.width = 1080; c.height = 1500;
    const x = c.getContext('2d'); x.fillStyle = '#14171d'; x.fillRect(0, 0, c.width, c.height);
    x.imageSmoothingEnabled = false;
    let cx = 12, cy = 30, rowH = 0;
    for (const a of A) {
      if (cx + a.w * S > c.width - 12) { cx = 12; cy += rowH + 36; rowH = 0; }
      x.drawImage(window.gunArtCanvas(a.id), cx, cy, a.w * S, a.h * S);
      x.fillStyle = '#ff3048'; x.fillRect(cx + a.grip[0] * S, cy + a.grip[1] * S, S, S);
      x.fillStyle = '#c9d3de'; x.font = '600 16px system-ui'; x.fillText(a.name, cx, cy - 8);
      cx += Math.max(a.w * S, 120) + 24; rowH = Math.max(rowH, a.h * S);
    }
    const out = document.createElement('canvas'); out.width = c.width; out.height = cy + rowH + 16;
    out.getContext('2d').drawImage(c, 0, 0);
    return out.toDataURL();
  });
  fs.writeFileSync(path.join(OUT, 'c-sheet.png'), Buffer.from(url.split(',')[1], 'base64'));
  said.push('c-sheet.png  every skin at 4 px per art pixel, its name over it, the grip (hand point) a red dot');
  await browser.close();
  console.log(said.map(s => path.join(OUT, s)).join('\n'));
})();
