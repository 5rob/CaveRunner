// The alien's sprite for the owner's OK (Level 2 stage 7): a sheet of its looks drawn big, and the same at
// game scale beside you in a sandbox room.
//   node tools/aliensheet.js [outdir]      (default tests/build/aliensheet)
const fs = require('fs');
const path = require('path');
const { launch } = require('../tests/chromium');
require('./build')();
require('../tests/build')();

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'aliensheet'));
fs.mkdirSync(OUT, { recursive: true });
const COL = { a: '#2a1f2e', b: '#120c14', c: '#e8e2d4', eye: '#050505' };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  for (let i = 0; i < 100 && !(await page.evaluate(() => window.__lvl && window.__lvl.p)); i++) await page.waitForTimeout(50);
  // (a) the sheet: each look at 14 px per world unit, labelled
  const url = await page.evaluate(col => {
    const S = 14, c = document.createElement('canvas'); c.width = 1082; c.height = 1500;
    const x = c.getContext('2d');
    x.fillStyle = '#3a3634'; x.fillRect(0, 0, c.width, c.height);
    const looks = [
      ['looking about', { px: -0.7, py: -0.3 }], ['looking about', { px: 0.6, py: 0.5 }], ['locked on you (right)', { px: 1, py: 0 }],
      ['walking (frame 1)', { walk: 1 }, 0.0], ['walking (frame 2)', { walk: 1 }, 0.07], ['on a wall (rotated)', { rot: Math.PI / 2, px: 0.5 }],
      ['a stray: all black', { black: true }], ['hit (flash)', {}, 0, true], ['on the ceiling', { rot: Math.PI, px: 0, py: 1 }]];
    looks.forEach(([name, st, t, fl], i) => {
      const cx = 180 + (i % 3) * 360, cy = 260 + Math.floor(i / 3) * 460;
      x.save(); x.translate(cx, cy); x.scale(S, S);
      drawAlien(x, 0, 0, ALIEN.r, t || 0, 1.3, !!fl, col, st);
      x.restore();
      x.fillStyle = '#ddd'; x.font = '28px sans-serif'; x.textAlign = 'center'; x.fillText(name, cx, cy + 190);
    });
    return c.toDataURL('image/png');
  }, COL);
  fs.writeFileSync(path.join(OUT, 'a-sheet.png'), Buffer.from(url.split(',')[1], 'base64'));
  // (b) at game scale, beside you in a sandbox room (drawn over the frame each frame)
  await page.waitForTimeout(3000);
  await page.evaluate(col => {
    const W = window.__lvl, room = W.sandbox();
    W.enemies.length = 0;
    window.__pin = { x: room.x, y: room.y - 22 };
    const cv = document.querySelector('canvas.game'), g = cv.getContext('2d');
    const spots = [[30, 0, { px: -1, py: 0 }], [55, 0, { walk: 1, px: -1 }], [80, 0, { black: true }], [-40, 0, { px: 1, py: -0.4 }]];
    const loop = () => {
      const { cam, s } = W.light;
      g.save(); g.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
      for (const [dx, , st] of spots) drawAlien(g, room.x + dx, room.y - ALIEN.r * 2 * ALIEN.leg * 0.5, ALIEN.r, W.time, dx, false, col, st);
      g.restore();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, COL);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'b-game-scale.png') });
  await page.evaluate(() => { DEV.zoom = 3; });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, 'c-game-zoomed.png') });
  console.log(OUT);
  await browser.close();
})().catch(e => { console.log('ERROR', e); process.exit(1); });
