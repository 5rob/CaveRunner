// The camera holds you steady on screen when you fly fast sideways, even when the frames come
// unevenly (a phone's do). It used to ease 15% per frame, so how far it trailed you hung on each
// frame's length and you jittered against the screen. Sandbox room, keys held, the frame clock
// fed with jitter; measures how far you are from the camera, in device pixels, frame to frame.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

async function flight(hz) {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  // the game's clock: frames of 1/hz, each up to ±12% early or late (a fixed pseudo-random run),
  // and every 9th one dropped (twice as long), as a busy phone does
  await ctx.addInitScript(h => {
    const raf = window.requestAnimationFrame.bind(window);
    let T = 0, seed = 7, n = 0;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    // one step of the clock per real frame, shared by every loop on the page
    let real = -1;
    window.requestAnimationFrame = f => raf(t => { if (t !== real) { real = t; T += (1000 / h) * (0.88 + 0.24 * rnd()) * (++n % 9 ? 1 : 2); } f(T); });
  }, hz);
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    DEV.zoom = 1;
    const room = window.__lvl.sandbox({ w: 900, h: 160 });
    const W = window.__lvl;
    W.p.x = Math.max(room.l + 20, 300);   // clear of the world's left edge, where the camera stops
    W.p.y = room.y - 60; W.p.vx = 0; W.p.vy = 0; W.p.fuel = 1; W.camReady = false;
    W.__room = room;
    window.__rec = [];
    const raf = window.requestAnimationFrame;
    const rec = () => {
      const s = W.unitPx * (document.querySelector("canvas.game").width / document.querySelector("canvas.game").getBoundingClientRect().width);
      window.__rec.push({ x: W.p.x, cx: W.camX, s, fuel: W.p.fuel });
      if (window.__rec.length < 400) raf(rec);
    };
    raf(rec);
    // the left stick pushed sideways and a touch up: jetting level across the room
    window.__in.current.left = { active: true, nx: 0.995, ny: -0.1, mag: 1, dy: -1, on: true };
  });
  // steady flight: from 0.5s in (the camera has caught up) until you near the far wall
  await page.waitForTimeout(1600);
  const r = await page.evaluate(() => {
    window.__in.current.left = { active: false, nx: 0, ny: 0, mag: 0, dy: 0, on: false };
    return { rec: window.__rec.slice(), r: window.__lvl.__room.r };
  });
  await browser.close();
  const steady = r.rec.filter((q, i) => i > 45 && q.x < r.r - 120);
  const d = steady.map(q => (q.x - q.cx) * q.s);              // you, from the camera, device px
  const jumps = d.slice(1).map((v, i) => Math.abs(v - d[i]));
  const sp = steady.length > 1 ? (steady[steady.length - 1].x - steady[0].x) / steady.length * steady[0].s : 0;
  const dx = steady.slice(1).map((q, i) => q.x - steady[i].x);
  return { stepMin: +Math.min(...dx).toFixed(2), stepMax: +Math.max(...dx).toFixed(2), frames: steady.length, speedPx: +sp.toFixed(1), worstJump: +Math.max(...jumps).toFixed(2) };
}

(async () => {
  for (const hz of [60, 120]) {
    const r = await flight(hz);
    check(`${hz}Hz: flew sideways long enough to measure`, r.frames > 15 && r.speedPx > 3, r);
    // the jitter allowed: about a css pixel of wobble at most (it was 6 to 10 device px) against the camera between frames
    check(`${hz}Hz: you hold steady on screen against uneven frames`, r.worstJump < 2.5, r);
  }
  console.log(fails ? `\n${fails} failed` : '\nall good');
  process.exit(fails ? 1 : 0);
})();
