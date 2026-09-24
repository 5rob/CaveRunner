// Jetpack cough: held on a nearly empty tank in a sandbox room, the jet cuts out in short
// bursts (no flame while it does), spits grey puffs, and drops you a little each time.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(800);

  const r = await page.evaluate(async () => {
    const L = window.__lvl, p = L.p;
    L.sandbox();
    const wait = ms => new Promise(res => setTimeout(res, ms));
    const run = async (fuel, ms) => {
      window.__in.current.left = { active: true, nx: 0, ny: -1, mag: 1, dy: -1, on: true };
      let frames = 0, sput = 0, flameInSput = 0, grey = 0, dips = 0, lastVy = null;
      const end = performance.now() + ms;
      while (performance.now() < end) {
        p.fuel = fuel; p.empty = false;    // keep the tank where we want it
        await new Promise(requestAnimationFrame);
        frames++;
        if (p.sput) { sput++; if (p.flame > 0) flameInSput++; }
        if (p.sput && lastVy !== null && p.vy > lastVy) dips++;
        lastVy = p.vy;
      }
      grey = L.smoke.filter(m => m.c).length;
      window.__in.current.left = { active: false, nx: 0, ny: 0, mag: 0, dy: 0, on: false };
      await wait(300);
      return { frames, sput, flameInSput, grey, dips };
    };
    return { full: await run(0.9, 1500), low: await run(0.03, 3000) };
  });
  check('a full tank never coughs', r.full.sput === 0 && r.full.grey === 0, r.full);
  check('a nearly empty tank coughs', r.low.sput > 0, r.low);
  check('no flame while it coughs', r.low.flameInSput === 0, r.low);
  check('it spits grey puffs', r.low.grey > 0, r.low);
  check('each cough drops you', r.low.dips > 0, r.low);
  check('it still mostly runs', r.low.sput < r.low.frames * 0.5, r.low);

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
