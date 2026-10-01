// An item plinth's foot is a one-way ledge (ledgeUnder, src/game/systems/player.js): a hidden
// room's altar with the rock dug out from under it still has something to land on, taken or
// not, and jetting up you pass through it. In a sandbox, with an altar hanging in open air.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1300);
  const room = await page.evaluate(() => {
    const L = window.__lvl, r = L.sandbox({ w: 300, h: 200 });
    // an altar floating 80 units over the floor (its foot's top at y + 14)
    L.rooms.length = 0;
    L.rooms.push({ kind: 'heart', x: r.x + 60, y: r.y - 94, taken: true, built: false });
    L.p.x = r.x + 60 - 6; L.p.y = r.y - 160; L.p.vx = L.p.vy = 0;
    return { ledge: r.y - 80, floor: r.y };
  });
  let at = null;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(50);
    at = await page.evaluate(() => ({ feet: window.__lvl.p.y + 22, g: window.__lvl.p.onGround, vy: window.__lvl.p.vy }));
    if (at.g) break;
  }
  check('falling onto the altar you land on its foot', at.g && Math.abs(at.feet - room.ledge) < 1, { at, room });
  await page.waitForTimeout(500);
  at = await page.evaluate(() => ({ feet: window.__lvl.p.y + 22, g: window.__lvl.p.onGround }));
  check('and stay standing there', at.g && Math.abs(at.feet - room.ledge) < 1, at);
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'plinth.png') });

  // from underneath, jetting up through it
  await page.evaluate(r => { const L = window.__lvl; L.p.y = r.floor - 22 - 0.5; L.p.vx = 0; L.p.vy = -360; L.p.fuel = 1; }, room);
  let above = false;
  for (let i = 0; i < 20 && !above; i++) {
    await page.evaluate(() => { window.__in.current.keys.w = true; });
    await page.waitForTimeout(50);
    above = await page.evaluate(r => window.__lvl.p.y + 22 < r.ledge - 4, room);
  }
  await page.evaluate(() => { window.__in.current.keys.w = false; });
  check('jetting up you pass through it', above);

  // a little to the side of it you fall past
  await page.evaluate(r => { const L = window.__lvl; L.p.x = L.rooms[0].x - 60; L.p.y = r.ledge - 60; L.p.vy = 0; }, room);
  await page.waitForTimeout(900);
  at = await page.evaluate(() => window.__lvl.p.y + 22);
  check('away from it you fall to the floor', Math.abs(at - room.floor) < 2, { feet: at, floor: room.floor });

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log(e); process.exit(1); });
