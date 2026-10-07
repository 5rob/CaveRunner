// Circle fields' look (v0.0.156) in a sandbox: no filled disc any more, rising sparkles (and plus
// signs for Vigour) instead, so six Circles of Vigour on one spot stay see-through, not a solid blob.
// Measured: the stack's middle against the same spot with no fields. Screenshot: tests/build/fieldlook.png
const { launch } = require('../chromium');
const path = require('path');
const DIR = path.join(__dirname, '..', 'build');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(DIR, 'test.html'));
  await page.waitForTimeout(800);

  const r = await page.evaluate(async () => {
    const L = window.__lvl, W = L;
    DEV.zoom = 1;
    const room = L.sandbox();
    const frames = async n => { for (let i = 0; i < n; i++) await new Promise(requestAnimationFrame); };
    const cv = document.querySelector('canvas');
    // the mean colour of a small square at a world spot, read off the canvas
    const sample = (wx, wy) => {
      const c2 = cv.getContext('2d'), s = L.light.s, cam = L.light.cam;
      const px = Math.round((wx - cam.x) * s), py = Math.round((wy - cam.y) * s);
      const d = c2.getImageData(px - 10, py - 10, 20, 20).data; let g = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { g += d[i + 1] - (d[i] + d[i + 2]) / 2; n++; }
      return g / n;
    };
    const fx = room.x + 70, fy = room.y - 40;
    await frames(20);
    const before = sample(fx, fy);
    const add = (field, col, r, x, y) => W.fields.push({ x, y, r, field, life: 5, max: 5, col, dmg: 0, tick: 0,
      payload: null, ang: 0, trig: null, age: 0, vx: 0, vy: 0 });
    for (let k = 0; k < 6; k++) add('heal', '#46c48c', 36, fx + k * 2, fy);
    add('slow', '#7fd7ff', 44, room.x - 70, fy - 30);
    add('shield', '#63c8ff', 40, room.x - 70, fy + 60);
    await frames(40);
    const after = sample(fx + 14, fy + 14);           // off the cross in the middle
    for (const f of W.fields) f.life = 5;
    return { before, after };
  });
  await page.screenshot({ path: path.join(DIR, 'fieldlook.png') });
  check('six stacked Vigour circles stay see-through (no solid green blob)', r.after - r.before < 25, r);

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
