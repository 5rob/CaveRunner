// The background hologram: in a sandbox room (open air behind you), red tiles show through
// while you're out in the level; the dark outside your torchlight leaves it bright, the fog of
// war hides it.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1200);
  // a tall room, well above the shop (keep one creature aside, for the glitch check)
  await page.evaluate(() => {
    const L = window.__lvl; window.DEV.zoom = 1; window.__spare = L.enemies.find(e => e.k.act !== 'nest');
    L.p.y = L.world.SHOP_Y - 900;
    L.sandbox({ w: 360, h: 320 });
  });
  await page.waitForTimeout(800);
  // red-dominant pixels in the room's air (the hologram's red over the dark background)
  const red = await page.evaluate(() => {
    const c = document.querySelector('canvas'), g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, Math.round(c.height * 0.4)).data;
    let r = 0, n = 0;
    for (let i = 0; i < d.length; i += 16) { n++; if (d[i] > d[i + 1] + 25 && d[i] > d[i + 2] + 25) r++; }
    return r / n;
  });
  check('red hologram tiles show in the open air', red > 0.03, red);
  if (process.env.HOLO_SHOT) await page.screenshot({ path: process.env.HOLO_SHOT });

  // the dark outside your torchlight doesn't dim it; only the fog of war (never-seen ground) does
  const bright = seen => page.evaluate(async seen => {
    const L = window.__lvl; window.DEV.torch = 0.2;
    L.seen.fill(seen);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const c = document.querySelector('canvas'), g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, Math.round(c.height * 0.15)).data;
    let n = 0, all = 0;
    for (let i = 0; i < d.length; i += 16) { all++; if (d[i] > 200 && d[i + 1] < 90) n++; }
    return n / all;
  }, seen);
  const remembered = await bright(1), unseen = await bright(0);

  // the number changing sets off the glitch, which dies away within half a second
  const g = await page.evaluate(async () => {
    const L = window.__lvl, frame = () => new Promise(r => requestAnimationFrame(r));
    await frame(); const before = window.holoGlitch(L);
    L.enemies.push(window.__spare); await frame(); await frame();
    const after = window.holoGlitch(L);
    await new Promise(r => setTimeout(r, 700)); await frame();
    return { before, after, later: window.holoGlitch(L) };
  });
  check('a new creature glitches the hologram', g.before === 0 && g.after > 0.5, g);
  check('and the glitch settles', g.later === 0, g);
  check('on remembered ground outside the torchlight it stays full bright red', remembered > 0.03, remembered);
  check('under the fog of war it is hidden', unseen < 0.002, unseen);

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
