// Screenshots of the hologram glitching in floor 2's dark zones (world/holoflicker.js) for the owner, phone size
// (412 x 880 @2.625), the real game through the test page. Not a test: it stands you deep in a zone, past where
// the torch fails, and takes a run of frames (the glitch is random: steady, dropouts, flashes, torn slices),
// printing each frame's state. Same seed as tools/darkshots.js.
//   node tools/holoflickshots.js [outdir] [frames]   (default tests/build/holoflick, 14 frames)
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'holoflick'));
const N = Number(process.argv[3]) || 14;
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
  await page.evaluate(() => { window.__lvl.guide = null; Math.random = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(); window.__in.current.newCave = 2; });
  for (let i = 0; i < 60 && !(await page.evaluate(() => window.__lvl.floor === 2 && window.__lvl.dark.length > 0)); i++) await page.waitForTimeout(100);
  // a standing spot deep in a zone (past where the torch fails), nearest a zone's middle
  const spot = await page.evaluate(() => {
    const W = window.__lvl, { CW, CELL } = W.world, m = W.mat, dp = W.darkDepth, lo = DEV.l2dTorchDepth + 10, hi = lo + 60;
    const free = (x, y) => { for (let j = 0; j < 11; j++) for (let i = 0; i < 6; i++) if (m[(y - j) * CW + x + i]) return false; return true; };
    for (const z of W.dark) {
      const mx = (z.x0 + z.x1) / 2, my = (z.y0 + z.y1) / 2;
      let best = null, bd = 1e12;
      for (let y = z.y0 + 12; y < z.y1; y++) for (let x = z.x0 + 2; x < z.x1 - 8; x++) {
        const d = dp[(y - 5) * CW + x + 3];
        if (d < lo || d > hi || m[y * CW + x] || !m[(y + 1) * CW + x] || !m[(y + 1) * CW + x + 5] || !free(x, y)) continue;
        const e = (x - mx) ** 2 + (y - my) ** 2;
        if (e < bd) { bd = e; best = { x: x * CELL, y: (y + 1) * CELL - 22 - 0.5, d }; }
      }
      if (best) return best;
    }
    return null;
  });
  if (!spot) { console.log('no spot deep in a zone'); await browser.close(); process.exit(1); }
  await page.evaluate(([x, y]) => {
    const L = window.__lvl;
    window.__pin = { x, y };
    const loop = () => {
      L.p.x = window.__pin.x; L.p.y = window.__pin.y; L.p.vx = L.p.vy = 0; L.p.hp = 9999; L.enemyShots.length = 0;
      window.__in.current.right = { active: true, on: false, nx: 1, ny: 0.1, mag: 0.2 };
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, [spot.x, spot.y]);
  await page.waitForTimeout(3500);           // outlast the floor's name card and the torch failing
  const said = [];
  // the knobs off first: the zone as it was
  await page.evaluate(() => { DEV.l2dFlk = 0; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'item1-0-off.png') }); said.push('item1-0-off.png  the glitch switched off (l2dFlk 0): the zone as before');
  await page.evaluate(() => { DEV.l2dFlk = 1; });
  for (let k = 1; k <= N; k++) {
    await page.waitForTimeout(60 + ((k * 137) % 170));
    const f = await page.evaluate(() => { const s = holoFlk(); return { mode: s.mode, mul: s.mul, tear: s.tear }; });
    const n = `item1-${k}.png`;
    await page.screenshot({ path: path.join(OUT, n) });
    said.push(`${n}  ${['steady', 'dropout', 'flash', 'torn'][f.mode]} (× ${f.mul.toFixed(2)}${f.tear ? ', tear ' + f.tear.toFixed(1) + ' px' : ''}; state just before the shot)`);
  }
  console.log(`deep in a zone, ${spot.d} px in\n` + said.join('\n'));
  await browser.close();
})();
