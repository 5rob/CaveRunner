// Gold nuggets in the live game, in a sandbox with a ramp: a rich kill bursts into big, medium and
// small nuggets adding up to its gold; they roll down the ramp, settle apart on the floor, and you
// collect them all. Screenshot: tests/build/nuggets.png.
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
  await page.waitForTimeout(1300);
  await page.evaluate(() => { window.DEV.zoom = 1; window.__lvl.nextFloor(); });
  await page.waitForTimeout(800);

  const r = await page.evaluate(() => new Promise(res => {
    const L = window.__lvl, p = L.p, nugR = window.nugR;
    const proto = L.enemies.find(e => !e.nest && !e.je) || L.enemies[0];
    const room = L.sandbox({ w: 360, h: 220, ramp: true });
    p.x = room.l + 10;                               // far from the gold, so none flies to you yet
    L.coins.length = 0;
    const e = Object.assign({}, proto, { x: room.r - 50, y: room.y - 120, ty: room.y - 120, hp: 0.0001, aggro: false,
      k: Object.assign({}, proto.k, { gold: 140 }) });
    L.enemies.push(e);
    L.bullets.push({ x: e.x, y: e.ty, vx: 60, vy: 0, life: 1, dmg: 5, size: 3,
      col: '#fff', spin: 0, homing: 0, bounce: 0, pierce: 0, explode: 0, grav: 0, accel: 0, bore: 0, hit: null });
    let n = 0, drop = null;
    const tick = () => {
      n++;
      p.x = room.l + 10; p.vx = 0;
      if (!drop && L.coins.length) drop = { n: L.coins.length, sum: L.coins.reduce((a, c) => a + c.amount, 0),
        sizes: [...new Set(L.coins.map(c => c.amount >= 25 ? 'big' : c.amount >= 5 ? 'med' : 'small'))], x0: e.x };
      if (n === 540) drop.at = L.coins.map(c => [c.x, c.y]);
      if (n < 600) return requestAnimationFrame(tick);
      const cs = L.coins;
      // settled: over the last second nothing drifted more than a unit and a half
      const drift = Math.max(...cs.map((c, i) => Math.hypot(c.x - drop.at[i][0], c.y - drop.at[i][1])));
      let worst = 0;
      for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
        const ra = nugR(cs[i].amount), rb = nugR(cs[j].amount);
        worst = Math.max(worst, (ra + rb - Math.hypot(cs[i].x - cs[j].x, cs[i].y - cs[j].y)) / (ra + rb));
      }
      res({ drop, room, after: { n: cs.length, meanX: cs.reduce((a, c) => a + c.x, 0) / cs.length,
        maxY: Math.max(...cs.map(c => c.y)), drift, worst } });
    };
    requestAnimationFrame(tick);
  }));
  check('the kill drops its gold as nuggets adding up to it', r.drop && (delete r.drop.at, true) && r.drop.sum >= 140 && r.drop.sum <= 142 && r.drop.n > 3, r.drop);
  check('in more than one size', r.drop && r.drop.sizes.length >= 2, r.drop && r.drop.sizes);
  check('they roll down the ramp onto the flat', r.after.meanX < r.room.r - 360 / 3, { meanX: r.after.meanX, rampFrom: r.room.r - 120 });
  check('they settle on the floor, not in it', r.after.maxY < r.room.y && r.after.drift < 1.5, r.after);
  check('and none sit on top of each other', r.after.worst < 0.3, r.after.worst);
  // a close look: the player stands back from the heap (out of the pull) and the shot is cropped round it
  const clip = await page.evaluate(() => new Promise(res => {
    const L = window.__lvl, cs = L.coins;
    const mx = cs.reduce((a, c) => a + c.x, 0) / cs.length, my = Math.max(...cs.map(c => c.y));
    L.p.x = mx - 70;
    let n = 0;
    const tick = () => { L.p.x = mx - 70; L.p.vx = 0; if (++n < 40) return requestAnimationFrame(tick);
      const k = L.unitPx; res({ x: Math.max(0, (mx - 60 - L.camX) * k), y: Math.max(0, (my - 50 - L.camY) * k), width: 120 * k, height: 70 * k }); };
    requestAnimationFrame(tick);
  }));
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'nuggets.png'), clip });

  // walk over: you collect every one of them
  const got = await page.evaluate(() => new Promise(res => {
    const L = window.__lvl, LO = window.__in.current.loadout, g0 = LO.gold;
    const want = L.coins.reduce((a, c) => a + c.amount, 0);
    let n = 0;
    const xs = L.coins.map(c => c.x), lo = Math.min(...xs), hi = Math.max(...xs);
    const tick = () => {
      n++;
      L.p.x = lo - 20 + (hi - lo + 40) * Math.min(1, n / 120); L.p.vx = 0;
      if (n < 200 && L.coins.length) return requestAnimationFrame(tick);
      res({ gained: LO.gold - g0, want, left: L.coins.length });
    };
    requestAnimationFrame(tick);
  }));
  check('walking along collects them all', got.left === 0 && got.gained === got.want, got);

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
