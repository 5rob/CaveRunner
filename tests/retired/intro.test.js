// v0.0.144: a new run's arrival. The teleporter charges for ARRIVE_T (1 s): you're not there yet (held,
// not drawn, no torch), light spirals into the pad (no lightning yet: v0.0.145); then a flash, the lightning, and
// you're standing on it. A second later the tube over the teleporter flickers and comes on
// (LIGHT_WAIT = ARRIVE_T + 1). Screenshots: intro-*.png (phone size).
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const DIR = path.join(__dirname, '..', 'build');

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_INTRO = true; window.__TEST_VOID = true; window.__TEST_EMPTY = true; });
  // count the pad's lightning (render/looks.js drawBolt strokes in '#7cc8ff'), while you're held and after
  await ctx.addInitScript(() => {
    window.__bolts = { held: 0, after: 0 };
    const st = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function (...a) {
      const L = window.__lvl;
      if (this.strokeStyle === '#7cc8ff' && L && L.intro) window.__bolts[L.intro.done ? 'after' : 'held']++;
      return st.apply(this, a);
    };
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(DIR, 'test.html'));
  const st = () => page.evaluate(() => { const L = window.__lvl, I = L.intro;
    return { t: L.shopLit ? L.time - L.shopLit.start : null, done: I ? I.done : null, held: introHeld(L), x: L.p.x, sx: L.start.x,
      tube: L.shopLit ? sectionLevel(L.shopLit, 0, L.time) : 1, on0: L.shopLit ? L.shopLit.on[0] : null, start: L.shopLit && L.shopLit.start }; });
  // wait for a moment of the intro (s into it), a frame at a time, give up after a while
  const at = async s => { for (let i = 0; i < 400; i++) { const q = await st(); if (q.t === null || q.t >= s) return q; await page.waitForTimeout(8); } return st(); };
  const shot = n => page.screenshot({ path: path.join(DIR, 'intro-' + n + '.png') });

  let s = await at(0.05);
  check('a new run starts with the teleporter charging, you not there yet', s.t !== null && s.t < 0.6 && s.held && !s.done, s);
  // trying to walk off while it charges does nothing
  await page.evaluate(() => { window.__in.current.keys.d = true; });
  s = await at(0.55);
  await shot('1-charging');
  check('held while it charges, whatever you press', s.held && Math.abs(s.x - s.sx) < 1, s);
  await page.evaluate(() => { window.__in.current.keys.d = false; });
  s = await at(0.85);
  await shot('2-charged');
  s = await at(1.05);
  await shot('3-flash');
  check('then you come through, on the pad', !s.held && s.done && Math.abs(s.x - s.sx) < 2, s);
  s = await at(1.3);
  const bolts = await page.evaluate(() => window.__bolts);
  check('no lightning while it charges, only once you are through (v0.0.145, owner)', bolts.held === 0 && bolts.after > 0, bolts);
  s = await at(1.6);
  await shot('4-in');
  check('the tube over the teleporter still off a moment after', s.tube === 0 && s.on0 < 0, s);
  // a second after you're in, it flickers, then comes on
  let flick = false, lit = null;
  for (let i = 0; i < 400; i++) {
    s = await st();
    if (s.tube > 0 && s.tube < 1) flick = true;
    if (s.tube >= 1 && s.t > 2) { lit = s; break; }
    if (s.t !== null && s.t > 2.05 && s.t < 2.15) await shot('5-flicker');
    await page.waitForTimeout(8);
  }
  check('a second after you\'re in, the tube over it flickers and comes on', flick && lit && lit.on0 - lit.start === 2, { flick, lit });
  await shot('6-lit');

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
