// The right stick's trigger ring (owner, LIST3 #8; core/consts.js triggerRing): just inside the stick's
// gauge rings (owner's feedback), Dev `aimPad` px in from the innermost; a push short of it aims without firing, past it fires.
// SHOTS=<dir> also saves trigring.png (phone size, a push held past the ring) for the owner.
const { launch } = require('../chromium');
const path = require('path');
const DIR = path.join(__dirname, '..', 'build');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, deviceScaleFactor: 2.625 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(DIR, 'test.html'));
  await page.waitForTimeout(2500);
  const m = await page.evaluate(() => {
    const st = document.querySelectorAll('.stick')[1], dz = st && st.querySelector('.deadzone');
    if (!dz) return null;
    const r = st.getBoundingClientRect(), d = dz.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, size: r.width, ring: d.width, want: window.stickTrigger(r.width).ring * r.width,
      gauge: st.querySelectorAll('.gauge circle')[st.querySelectorAll('.gauge circle').length - 1].getBoundingClientRect().width };
  });
  check('the ring is there', !!m, m);
  if (!m) { await browser.close(); process.exit(1); }
  check('it sits where stickTrigger says', Math.abs(m.ring - m.want) < 1.5, m);
  check('inside the innermost gauge ring', m.ring < m.gauge - 2, m);
  // push straight right: the knob's centre travels 0.72 of the radius at full push
  const push = async u => {
    await page.mouse.move(m.cx, m.cy); await page.mouse.down();
    await page.mouse.move(m.cx + u * m.size / 2 * 0.72, m.cy, { steps: 4 });
    await page.waitForTimeout(80);
    return page.evaluate(() => ({ on: window.__in.current.right.on, fire: window.__in.current.right.fire }));
  };
  const short = await push(0.38);
  check('a short push aims but doesn\'t fire', short.on === false, short);
  await page.mouse.up();
  const far = await push(0.95);
  check('a push past the ring fires', far.on === true, far);
  if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, 'trigring.png') });
  await page.mouse.up();
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
