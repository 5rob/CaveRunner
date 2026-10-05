// v0.0.145: the hand torch is archived; a light on the gun throws a cone the way you aim. In a real
// cave (it's about the fog and the dark, which a sandbox lifts): the cave ahead of the gun is lit, the
// same distance behind you isn't; turn the aim and the light turns with it; no gun, no cone; no torch embers.
// Screenshots: gunlight-*.png (phone size).
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  const shot = n => page.screenshot({ path: path.join(__dirname, '..', 'build', 'gunlight-' + n + '.png') });
  for (let i = 0; i < 100 && !(await page.evaluate(() => window.__lvl && window.__lvl.p)); i++) await page.waitForTimeout(50);
  await page.evaluate(() => { window.__lvl.guide = null; DEV.holoAlpha = 0; });
  // somewhere wide open in the cave, away from the edges (the torch suite's search)
  const spot = await page.evaluate(() => {
    const { mat } = window.__lvl, { CW, CH, CELL } = window.__lvl.world;
    const solid = (cx, cy) => cx < 0 || cy < 0 || cx >= CW || cy >= CH || mat[cy * CW + cx] !== 0;
    for (let cy = 400; cy < CH - 800; cy += 5) for (let cx = 220; cx < CW - 220; cx += 5) {
      let ok = true;
      for (let dy = -12; dy <= 6 && ok; dy++) for (let dx = -40; dx <= 40; dx++) if (solid(cx + dx, cy + dy)) { ok = false; break; }
      if (ok) return { x: cx * CELL - 6, y: cy * CELL - 11 };
    }
    return null;
  });
  check('found somewhere open to stand', !!spot, spot);
  if (!spot) { await browser.close(); process.exit(1); }
  // pinned there, the creatures parked in a corner, aiming where __aim says
  await page.evaluate(({ x, y }) => {
    const L = window.__lvl;
    window.__aim = { nx: 1, ny: 0 };
    const loop = () => {
      L.p.x = x; L.p.y = y; L.p.vx = L.p.vy = 0; L.p.hp = 9999;
      for (const e of L.enemies) { e.x = 20; e.y = 20; e.ty = 20; }
      L.enemyShots.length = 0;
      window.__in.current.right = { active: true, on: false, nx: window.__aim.nx, ny: window.__aim.ny, mag: 0.2 };
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    L.pickups.length = 0;
  }, spot);
  await page.waitForTimeout(3200);           // outlast the floor's name card
  // how bright the screen is round a world point (mean of r, g, b), or null off the canvas
  const look = (wx, wy) => page.evaluate(([wx, wy]) => {
    const { cam, s } = window.__lvl.light, cv = document.querySelector('canvas.game');
    const px = Math.round((wx - cam.x) * s), py = Math.round((wy - cam.y) * s), h = 10;
    if (px < h || py < h || px + h > cv.width || py + h > cv.height) return null;
    const d = cv.getContext('2d').getImageData(px - h, py - h, h * 2, h * 2).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
    return sum / (d.length / 4);
  }, [wx, wy]);
  const cx = spot.x + 6, cy = spot.y + 11;
  const aim = async (nx, ny) => { await page.evaluate(([nx, ny]) => { window.__aim = { nx, ny }; }, [nx, ny]); await page.waitForTimeout(700); };

  await aim(1, 0);
  const R1 = await look(cx + 70, cy), L1 = await look(cx - 70, cy);
  await shot('1-right');
  check('aiming right: the cave 70 to the right is lit, 70 to the left much darker', R1 !== null && L1 !== null && R1 > L1 * 1.5, { right: R1, left: L1 });
  await aim(-1, 0);
  const R2 = await look(cx + 70, cy), L2 = await look(cx - 70, cy);
  await shot('2-left');
  check('aiming left: the light turns with it', R2 !== null && L2 !== null && L2 > R2 * 1.5, { right: R2, left: L2 });
  await aim(0.6, -0.8);
  await shot('3-up');
  // no gun in hand (a new run's empty hands): no cone, only the glow round you
  await page.evaluate(() => { window.__in.current.loadout.guns.length = 0; });
  await aim(1, 0);
  const R4 = await look(cx + 70, cy), L4 = await look(cx - 70, cy);
  await shot('4-nogun');
  check('no gun: no cone (right about as dark as left)', R4 !== null && L4 !== null && R4 < L4 * 1.3 + 2 && R4 < R1 * 0.6, { right: R4, left: L4, withGun: R1 });
  const e = await page.evaluate(() => window.__lvl.light.embers);
  check('no torch: no embers', e === 0, e);
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
