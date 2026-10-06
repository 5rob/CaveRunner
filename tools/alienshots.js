// Level 2 stage 7b: screenshots of the aliens at work on a real floor 2 (phone size), for checking the behaviour:
//   a  a pack roaming, the darkness off (DEV.l2dDark = 0) so they show
//   b  the same pack scattering from a fire (a blast kept going beside them), darkness off
//   c  the same with the darkness on (only the fire's light shows them)
//   d  silhouettes against the hologram (DEV.holoMin = holoMax = 1)
//   e  a bullet's glimpse: firing into the dark
//   f  a black stray outside a zone
//   node tools/alienshots.js [outdir]      (default tests/build/alienshots)
const fs = require('fs');
const path = require('path');
const { launch } = require('../tests/chromium');
require('./build')();
require('../tests/build')();

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'alienshots'));
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  for (let i = 0; i < 100 && !(await page.evaluate(() => window.__lvl && window.__lvl.p)); i++) await page.waitForTimeout(50);
  await page.evaluate(() => { window.__lvl.guide = null; window.__in.current.newCave = 2; });
  for (let i = 0; i < 40 && !(await page.evaluate(() => window.__lvl.floor === 2 && window.__lvl.dark.length > 0)); i++) await page.waitForTimeout(100);
  // stand in the first zone's chamber, pinned; the fire (window.__fire) is a blast renewed every frame
  await page.evaluate(() => {
    const W = window.__lvl, { CW, CELL } = W.world, c = W.dark[0].chamber;
    W.seen.fill(2); W.fog.paint();
    let y = c.y;
    while (y < c.floor + 3 && !W.mat[(y + 1) * CW + c.x]) y++;
    window.__pin = { x: c.x * CELL - 6, y: (y + 1) * CELL - 22.5 };
    const loop = () => {
      const p = window.__pin;
      W.p.x = p.x; W.p.y = p.y; W.p.vx = W.p.vy = 0; W.p.hp = 9999; W.enemyShots.length = 0;
      if (window.__fire) W.flashes.push({ x: window.__fire.x, y: window.__fire.y, r: 3, t: 0 });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    // gather a pack round you so the shots have one in view
    const a = W.enemies.filter(e => e.k.act === 'alien' && !e.al.black);
    a.slice(0, 40).forEach((e, i) => { e.x = window.__pin.x + 6 + Math.cos(i) * (30 + i * 2); e.y = window.__pin.y + 10 - Math.abs(Math.sin(i)) * 25; });
  });
  const shot = async (name, ms) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, name) }); console.log(path.join(OUT, name)); };
  await page.evaluate(() => { window.DEV.l2dDark = 0; window.DEV.zoom = 2; });
  await shot('a-roaming-dark-off.png', 2000);
  await page.evaluate(() => { const p = window.__pin; window.__fire = { x: p.x + 40, y: p.y + 8 }; });
  await shot('b-scatter-fire-dark-off.png', 400);
  await page.evaluate(() => { window.__fire = null; });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.DEV.l2dDark = 1; const p = window.__pin; window.__fire = { x: p.x + 40, y: p.y + 8 }; });
  await shot('c-scatter-fire-dark-on.png', 400);
  await page.evaluate(() => { window.__fire = null; window.DEV.holoMin = window.DEV.holoMax = 1; });
  await shot('d-silhouettes-holo.png', 2500);
  await page.evaluate(() => { window.DEV.holoMin = window.DEV_DEFAULTS.holoMin; window.DEV.holoMax = window.DEV_DEFAULTS.holoMax; window.__in.current.right = { active: true, on: true, nx: 1, ny: -0.2, mag: 1 }; });
  await shot('e-bullet-glimpse.png', 350);
  await page.evaluate(() => { window.__in.current.right = { active: false, on: false, nx: 0, ny: 0, mag: 0 }; });
  // a stray: stand a little way off it
  const found = await page.evaluate(() => {
    const W = window.__lvl, s = W.enemies.find(e => e.al && e.al.black);
    if (!s) return false;
    window.__pin = { x: s.x - 70, y: s.y - 20 };
    s.al.sprint = false; s.aggro = false;
    return true;
  });
  if (found) await shot('f-stray-outside.png', 300);
  else console.log('no stray on this floor');
  await browser.close();
})().catch(e => { console.log('ERROR', e); process.exit(1); });
