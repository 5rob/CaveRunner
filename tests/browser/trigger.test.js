// Proves a trigger's payload really goes off out in the world rather than at the
// muzzle. Every bullet remembers where it was born (ox, oy), so the measurement is
// simply: how far from the player did anything come into existence this pull?
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const b = await launch();
  const c = await b.newContext({ viewport: { width: 420, height: 880 }, hasTouch: true, isMobile: true });
  const page = await c.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1500);

  // Fire one pull of `slots` into open air and watch what appears. Returns the
  // furthest-from-the-player birthplace seen, and how many bullets were born out there.
  const onePull = slots => page.evaluate(async sl => {
    const LO = window.__in.current.loadout, L = window.__lvl;
    const g = LO.guns[0];
    g.cap = sl.length; g.slots = sl.slice(); g.shuffle = false;
    g.manaMax = 9999; g.mana = 9999; g.recharge = 4; g.castDelay = 4;
    resetGun(g);
    L.bullets.length = 0; L.fields.length = 0; L.flashes.length = 0;
    L.dig(L.p.x + 150, L.p.y - 30, 150);        // a big pocket so nothing hits rock early
    L.dig(L.p.x + 300, L.p.y - 60, 150);
    window.__in.current.right = { active: true, nx: 1, ny: -0.2, mag: 1, dy: -1, on: true };
    await new Promise(r => setTimeout(r, 60));
    window.__in.current.right = { active: false, nx: 1, ny: 0, mag: 0, dy: 0, on: false };
    let far = 0, mostFar = 0, seenFlash = 0, peak = 0;
    for (let k = 0; k < 50; k++) {
      await new Promise(r => setTimeout(r, 25));
      let nowFar = 0;
      for (const bl of L.bullets) {
        const d = Math.hypot(bl.ox - L.p.x, bl.oy - L.p.y);
        far = Math.max(far, d);
        if (d > 90) nowFar++;
      }
      mostFar = Math.max(mostFar, nowFar);
      peak = Math.max(peak, L.bullets.length + L.fields.length);
      for (const f of L.flashes) seenFlash = Math.max(seenFlash,
        Math.hypot(f.x - L.p.x, f.y - L.p.y));
    }
    return { far: Math.round(far), born: mostFar, flash: Math.round(seenFlash), peak };
  }, slots);

  const plain = await onePull(['bolt']);
  check('a plain bolt is born at the muzzle', plain.far < 40, plain);

  const empty = await onePull(['timer']);
  check('a timer carrying nothing puts nothing out there', empty.born === 0, empty);

  const loaded = await onePull(['timer', 'bolt']);
  check('a loaded timer drops its bolt well away from the player', loaded.far > 100, loaded);
  check('and drops exactly one of them', loaded.born === 1, loaded);

  // Short Fuse first, so the carrier runs out of flight inside the pocket we dug
  // instead of burying itself in rock a long way off
  const dbl = await onePull(['brief', 'dtrig', 'bolt', 'bolt']);
  check('a double trigger drops both of its bolts out there', dbl.born === 2, dbl);

  const boom = await onePull(['trig', 'boom']);
  check('a trigger carrying an explosion blows it up at the impact point, not at your feet',
    boom.flash > 60, boom);

  // the runaway check, in the real game: nothing but triggers, firing flat out
  const stress = await page.evaluate(async () => {
    const g = window.__in.current.loadout.guns[0], L = window.__lvl;
    g.cap = 8; g.slots = ['myriad', 'trig', 'dtrig', 'timer', 'trig', 'bolt', 'trig', 'bolt'];
    g.manaMax = 999999; g.mana = 999999; g.recharge = 0.05; g.castDelay = 0.05;
    resetGun(g);
    window.__in.current.right = { active: true, nx: 1, ny: -0.2, mag: 1, dy: -1, on: true };
    let peak = 0;
    for (let k = 0; k < 80; k++) {
      await new Promise(r => setTimeout(r, 25));
      peak = Math.max(peak, L.bullets.length);
    }
    window.__in.current.right = { active: false, nx: 1, ny: 0, mag: 0, dy: 0, on: false };
    return peak;
  });
  console.log(`     two seconds of held fire on an all-trigger gun peaked at ${stress} bullets`);
  check('an all-trigger gun held down does not run away', stress < 400, stress);

  const fps = await page.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now();
    const tick = () => { if (++n < 60) requestAnimationFrame(tick); else res(Math.round(60000 / (performance.now() - t0))); };
    requestAnimationFrame(tick);
  }));
  check('and it still runs at a playable rate', fps > 30, fps + ' fps');
  check('no page errors anywhere in that', errs.length === 0, errs.slice(0, 4));

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
