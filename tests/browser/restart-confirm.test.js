// Restart now asks for confirmation. Prove three things by measurement:
//  1. a single tap on Restart never restarts the run on its own.
//  2. confirming (after the gate) does restart.
//  3. the very tap that opens the confirm cannot also land on the Yes button
//     and action it — the same physical gesture can't both open and confirm.
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

  const mark = txt => page.evaluate(t => { window.__lvl.marker = t; }, txt);
  const state = () => page.evaluate(() => ({
    marker: window.__lvl.marker || null,
    confirmOpen: !!document.querySelector('.confirm'),
    guns: window.__in.current.loadout.guns.filter(Boolean).length,
  }));

  // --- 1. a single tap opens the confirm, but does not restart ---
  await mark('run-a');
  await page.tap('.reset');
  await page.waitForTimeout(150);
  let st = await state();
  check('one tap on Restart does not restart the run', st.marker === 'run-a', st);
  check('one tap on Restart opens the confirm', st.confirmOpen === true, st);

  // Cancel closes it without touching the run
  await page.tap('.confirmRow .cancel');
  await page.waitForTimeout(150);
  st = await state();
  check('Cancel closes the confirm', st.confirmOpen === false, st);
  check('Cancel keeps the run', st.marker === 'run-a', st);

  // --- 2. confirming after the gate does restart ---
  await page.tap('.reset');
  await page.waitForTimeout(500);           // clear of the anti-double-fire gate
  await page.tap('.confirmRow .go');
  await page.waitForTimeout(400);
  st = await state();
  check('confirming restarts the run', st.marker === null, st);
  check('confirming closes the confirm', st.confirmOpen === false, st);
  check('a fresh run has its starting guns back', st.guns === 2, st);

  // --- 3. the tap that opens the confirm cannot also land on Yes ---
  // Simulate the double-fire this project has actually hit before: two
  // pointerdown events landing on the same spot a moment apart, as some
  // touch stacks produce for what the user experiences as one tap. Dispatch
  // a pointerdown directly on the Yes button's DOM node right as it appears,
  // before the anti-double-fire gate's window has elapsed.
  await mark('run-b');
  await page.tap('.reset');
  await page.waitForTimeout(30);            // the confirm is open; well inside the gate
  const early = await page.evaluate(() => {
    const go = document.querySelector('.confirmRow .go');
    if (!go) return { found: false };
    const r = go.getBoundingClientRect();
    const ev = new PointerEvent('pointerdown', { bubbles: true, cancelable: true,
      clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerId: 1, pointerType: 'touch' });
    go.dispatchEvent(ev);
    return { found: true };
  });
  await page.waitForTimeout(100);
  st = await state();
  check('the early tap on Yes reached the button', early.found, early);
  check('but a tap inside the gate window does not restart', st.marker === 'run-b', st);
  check('and the confirm is still open, waiting for a real second tap', st.confirmOpen === true, st);

  // now let the gate clear and press Yes for real — it should work
  await page.waitForTimeout(400);
  await page.tap('.confirmRow .go');
  await page.waitForTimeout(400);
  st = await state();
  check('a tap after the gate clears does restart', st.marker === null, st);

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
