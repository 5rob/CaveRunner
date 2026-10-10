// The shade under the controls (owner, v0.0.146; ui/hud.js shadeAt): see-through at the map
// button's top, black by the sticks' middles and on down to the screen's bottom.
// Screenshots: ctlshade_before.png / ctlshade_after.png (for the owner).
const { launch } = require('../chromium');
const path = require('path');
const DIR = path.join(__dirname, '..', 'build');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(DIR, 'test.html'));
  await page.waitForTimeout(2500);
  const m = await page.evaluate(() => {
    const s = document.querySelector('.ctlshade'), map = document.querySelector('.mapbtn');
    const st = document.querySelector('.stick');
    if (!s || !map || !st) return null;
    const r = s.getBoundingClientRect(), mr = map.getBoundingClientRect(), sr = st.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, mapTop: mr.top, stickMid: (sr.top + sr.bottom) / 2,
      bg: getComputedStyle(s).backgroundImage, pe: getComputedStyle(s).pointerEvents, vh: innerHeight, vw: innerWidth };
  });
  check('the shade is there', !!m, m);
  if (m) {
    check('it starts at the map button\'s top', Math.abs(m.top - m.mapTop) < 2, m);
    check('it reaches the screen\'s bottom', m.bottom >= m.vh, m);
    check('full width', m.left <= 0 && m.right >= m.vw, m);
    check('taps go through it', m.pe === 'none', m.pe);
    // the gradient's black stop is at the sticks' middles
    const stop = +(m.bg.match(/rgb\(0, 0, 0\) (\d+(\.\d+)?)px/) || [])[1];
    check('black by the sticks\' middles', Math.abs(m.top + stop - m.stickMid) < 2, { stop, top: m.top, mid: m.stickMid });
  }
  // the sticks still take a drag through it
  const st = await page.evaluate(() => { const r = document.querySelector('.stick').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const hit = await page.evaluate(p => document.elementFromPoint(p.x, p.y).closest('.stick') !== null, st);
  check('the left stick is on top of the shade', hit);
  // the shots: out in the cave with the fog lifted (the shop's bottom is black anyway). You stand on
  // the first floor found going down from a third of the way up the level, across the middle
  const spot = await page.evaluate(() => {
    const W = window.__lvl, { CW, CH, CELL } = W.world, open = (x, y) => !W.mat[y * CW + x];
    for (let x0 = CW >> 1, n = 0; n < 40; n++, x0 = (x0 + 37) % CW)
      for (let y = Math.round(CH * 0.35); y < CH * 0.8; y++)
        if (open(x0, y) && !open(x0, y + 1) && [...Array(30)].every((_, k) => open(x0, y - k) && open(x0 - 6, y - k) && open(x0 + 6, y - k)))
          return { x: x0 * CELL - 6, y: (y + 1) * CELL - 22 - 0.5 };
    return null;
  });
  check('found a spot in the cave for the shots', !!spot);
  if (spot) {
    await page.evaluate(() => { const W = window.__lvl; W.seen.fill(2); W.fog.paint(); W.p.hp = 9999; W.enemies.length = 0; W.enemyShots.length = 0; });
    for (let i = 0; i < 12; i++) {
      await page.evaluate(s => { const W = window.__lvl; W.p.x = s.x; W.p.y = s.y; W.p.vx = W.p.vy = 0; W.p.hp = 9999; }, spot);
      await page.waitForTimeout(150);
    }
  }
  await page.screenshot({ path: path.join(DIR, 'ctlshade_after.png') });
  await page.evaluate(() => { document.querySelector('.ctlshade').style.display = 'none'; });
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(DIR, 'ctlshade_before.png') });

  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
