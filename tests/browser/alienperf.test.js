// Level 2 stage 7b: what the aliens cost a frame. Software rendering at phone size (as darkperf.test.js), floor
// 2, standing in a zone's chamber with its pack about: the mean frame time with every alien, then with them all
// gone, and how many were within the view. Prints the numbers; fails only if they cost far more than the zone.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch({ args: ['--disable-gpu', '--disable-gpu-compositing'] });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  for (let i = 0; i < 100 && !(await page.evaluate(() => window.__lvl && window.__lvl.p)); i++) await page.waitForTimeout(50);
  await page.evaluate(() => { window.__lvl.guide = null; Math.random = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(); window.__in.current.newCave = 2; });
  for (let i = 0; i < 40 && !(await page.evaluate(() => window.__lvl.floor === 2 && window.__lvl.dark.length > 0)); i++) await page.waitForTimeout(100);
  const spot = await page.evaluate(() => {
    const W = window.__lvl, { CW, CELL } = W.world, c = W.dark[0].chamber;
    W.seen.fill(1); W.fog.paint();
    let y = c.y;
    while (y < c.floor + 3 && !W.mat[(y + 1) * CW + c.x]) y++;
    const s = { x: c.x * CELL - 6, y: (y + 1) * CELL - 22.5 };
    const loop = () => { W.p.x = s.x; W.p.y = s.y; W.p.vx = W.p.vy = 0; W.p.hp = 9999; W.enemyShots.length = 0; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    return s;
  });
  const frames = ms => page.evaluate(ms => new Promise(res => {
    setTimeout(() => {
      let n = 0, t0 = 0;
      const tick = t => { if (!t0) t0 = t; n++; if (t - t0 < ms) requestAnimationFrame(tick); else res((t - t0) / Math.max(1, n - 1)); };
      requestAnimationFrame(tick);
    }, 2000);
  }), ms);
  await frames(1500);
  const counts = await page.evaluate(() => {
    const W = window.__lvl, a = W.enemies.filter(e => e.k.act === 'alien');
    const vw = 412 / window.DEV.zoom, vh = 880 / window.DEV.zoom;
    return { all: a.length, view: a.filter(e => e.x > W.camX && e.x < W.camX + vw * 1.5 && e.y > W.camY && e.y < W.camY + vh * 1.5).length };
  });
  const withA = await frames(3000);
  await page.evaluate(() => { const W = window.__lvl; for (let i = W.enemies.length - 1; i >= 0; i--) if (W.enemies[i].k.act === 'alien') W.enemies.splice(i, 1); });
  const without = await frames(3000);
  console.log(`software-rendered, 412x880 @2.625, in a zone: ${counts.all} aliens on the floor (${counts.view} near the view): ${withA.toFixed(1)} ms a frame; none: ${without.toFixed(1)} ms`);
  check('the aliens cost no more than half again the zone\'s frame', withA < without * 1.5 + 4, { withA, without, counts, spot });
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
