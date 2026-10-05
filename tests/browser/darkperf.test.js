// Level 2 stage 4: what a dark zone costs a frame. Software rendering (no GPU, as HANDOVER's "Measuring
// render cost" says: a PC's GPU hides it) at phone size and density; the mean time between frames over
// a few seconds, standing in the tomb, then deep in a zone, then on the same spot with the zone switched
// off (the darkness's own cost). Prints the numbers; fails only if a zone costs far more than the tomb.
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
  await page.evaluate(() => {
    const L = window.__lvl;
    L.seen.fill(1); L.fog.paint();
    const loop = () => {
      const p = window.__pin;
      if (p) { L.p.x = p.x; L.p.y = p.y; L.p.vx = L.p.vy = 0; }
      L.p.hp = 9999;
      for (const e of L.enemies) { e.x = 30; e.y = 30; e.ty = 30; e.hx = 30; e.hy = 30; }
      L.enemyShots.length = 0;
      window.__in.current.right = { active: true, on: false, nx: 1, ny: 0, mag: 0.2 };
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  // the mean frame time over ms milliseconds, standing at (x, y) (world)
  const frames = (x, y, ms) => page.evaluate(([x, y, ms]) => new Promise(res => {
    window.__pin = { x, y };
    setTimeout(() => {
      let n = 0, t0 = 0;
      const tick = t => { if (!t0) t0 = t; n++; if (t - t0 < ms) requestAnimationFrame(tick); else res((t - t0) / Math.max(1, n - 1)); };
      requestAnimationFrame(tick);
    }, 2500);
  }), [x, y, ms]);
  const spots = await page.evaluate(() => {
    const W = window.__lvl, { CW, CELL } = W.world, c = W.dark[0].chamber, v = W.tomb.rooms.find(r => r.type === 'hall' && r.dark < 0) || W.tomb.rooms.find(r => r.dark < 0 && r.big);
    let y = c.y;
    while (y < c.floor + 3 && !W.mat[(y + 1) * CW + c.x]) y++;
    return { zone: { x: c.x * CELL - 6, y: (y + 1) * CELL - 22.5 }, tomb: { x: v.cx * CELL - 6, y: v.floor * CELL - 22.5 } };
  });
  await frames(spots.tomb.x, spots.tomb.y, 1500);                     // (a warm-up)
  const tomb = await frames(spots.tomb.x, spots.tomb.y, 3000);
  const zone = await frames(spots.zone.x, spots.zone.y, 3000);
  const tomb2 = await frames(spots.tomb.x, spots.tomb.y, 3000);
  console.log('tomb again', tomb2.toFixed(1));
  const mask = await page.evaluate(() => { const W = window.__lvl, m = W.darkMask; W.darkMask = null; return !!m; });
  const off = await frames(spots.zone.x, spots.zone.y, 3000);
  console.log(`software-rendered, 412x880 @2.625: tomb ${tomb.toFixed(1)} ms a frame, in a zone ${zone.toFixed(1)} ms, same spot with the zone off ${off.toFixed(1)} ms`);
  check('a zone costs no more than half again the tomb\'s frame', mask && zone < tomb * 1.5 + 4, { tomb, zone, off });
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
