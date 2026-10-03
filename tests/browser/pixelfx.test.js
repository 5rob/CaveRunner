// v130: the hand torch's flame and the jetpack's flame and smoke on the player's pixel grid
// (DEV.runnerPx, like the gun): in a sandbox, the torch and the jet are drawn as square pixels of
// the flame colours, the flame moves frame to frame (it licks, it isn't one shape tilting), and
// the jet smoke is blocky too. Screenshots: pixelfx_torch.png, pixelfx_jet.png (zoomed in).
const { launch } = require('../chromium');
const path = require('path');
const DIR = path.join(__dirname, '..', 'build');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const b = await launch();
  const c = await b.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await c.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(DIR, 'test.html'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => { DEV.zoom = 4; DEV.runnerPx = 1; DEV.holoMin = DEV.holoMax = 0; });
  const room = await page.evaluate(() => {
    const L = window.__lvl, r = L.sandbox({ w: 300, h: 200 });
    L.p.x = r.x - 6; L.p.y = r.y - 22; L.p.vx = L.p.vy = 0; L.p.hp = 9999;
    return r;
  });
  await page.waitForTimeout(600);

  // the player on screen: from the canvas, where the world maps, a box round them
  const shot = async name => {
    await page.evaluate(() => { window.__lvl.toasts.length = 0; window.__lvl.levelT = 99; });
    await page.waitForTimeout(50);
    const box = await page.evaluate(() => {
      const L = window.__lvl, cv = document.querySelector('canvas'), r = cv.getBoundingClientRect();
      const u = L.unitPx;
      return { x: r.left + (L.p.x - 30 - L.camX) * u, y: r.top + (L.p.y - 40 - L.camY) * u, width: 72 * u, height: 90 * u };
    });
    await page.screenshot({ path: path.join(DIR, name), clip: box });
    return box;
  };
  // count flame-coloured pixels, and how many sit in flat blocks (a pixel layer's squares)
  const flamePx = () => page.evaluate(() => {
    const L = window.__lvl, cv = document.querySelector('canvas'), x = cv.getContext('2d');
    const u = L.unitPx * (window.devicePixelRatio || 1), x0 = Math.round((L.p.x - 30 - L.camX) * u), y0 = Math.round((L.p.y - 40 - L.camY) * u);
    const w = Math.round(72 * u), h = Math.round(90 * u), d = x.getImageData(x0, y0, w, h).data;
    let fire = 0, blocky = 0;
    const hot = i => d[i] > 230 && d[i + 1] > 110 && d[i + 2] < 150;
    for (let yy = 0; yy < h - 1; yy++) for (let xx = 0; xx < w - 1; xx++) {
      const i = (yy * w + xx) * 4;
      if (!hot(i)) continue;
      fire++;
      const j = i + 4, k = i + w * 4;
      if (d[j] === d[i] && d[j + 1] === d[i + 1] && d[k] === d[i] && d[k + 1] === d[i + 1]) blocky++;
    }
    return { fire, blocky, sig: Array.from(d.filter((_, i) => i % 97 === 0)).join(',').length + ':' + fire };
  });

  const t1 = await flamePx();
  await shot('pixelfx_torch.png');
  await page.waitForTimeout(120);
  const t2 = await flamePx();
  check('the torch flame is drawn', t1.fire > 30, t1);
  check('in square pixels', t1.blocky / t1.fire > 0.6, t1);
  check('and it moves (licks) frame to frame', t1.sig !== t2.sig, [t1.sig, t2.sig]);

  // the jet: held on (keys), the player kept hovering in the room
  await page.evaluate(() => { window.__in.current.keys.w = true; });
  await page.waitForTimeout(250);
  await page.evaluate(r => { const L = window.__lvl; L.p.y = r.y - 70; L.p.vy = 0; L.p.fuel = 1; }, room);
  await page.waitForTimeout(150);
  const j = await flamePx();
  const smoke = await page.evaluate(() => window.__lvl.smoke.filter(m => m.jet).length);
  await shot('pixelfx_jet.png');
  check('the jet flame adds fire pixels', j.fire > t1.fire, [j.fire, t1.fire]);
  check('in square pixels too', j.blocky / j.fire > 0.6, j);
  check('the jet smoke is marked for the pixel layer', smoke > 3, smoke);
  await page.evaluate(() => { window.__in.current.keys.w = false; });

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await b.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log(e); process.exit(1); });
