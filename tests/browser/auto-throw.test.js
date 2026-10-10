// CaveRunner Auto stage 10a, with real pointer events in the hub: gold from the bag into the gun machine by a flick (one
// nugget), by a stream (moved away and held: several) and by a lump (held still on the stack: the whole stack), each
// counted in H.paid.gun and out of the bag (saved); a red gem flicked at the gun machine bounces off and comes back to the bag.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const open = async (gold, red) => {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await ctx.addInitScript(() => { window.__TEST_TITLE = true; localStorage.removeItem('caverunner-auto-run'); });
    const page = await ctx.newPage();
    page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
    await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
    await page.waitForTimeout(300);
    await page.evaluate(([g, r]) => {
      const run = newRun();
      bagAdd(run, { kind: 'gold', n: g });
      if (r) bagAdd(run, { kind: 'red', n: r });
      saveAutoRun(run);
    }, [gold, red]);
    await page.locator('.tstart').dispatchEvent('pointerdown');
    let on = false;
    for (let i = 0; i < 60 && !(on = !!(await page.$('.auto'))); i++) await page.waitForTimeout(50);
    await page.waitForTimeout(2200);   // the player through the pad
    return { ctx, page };
  };
  // the stack's grab handle, and the gun machine's coin slot on screen (css px)
  const stack = async (page, kind) => {
    const i = await page.evaluate(k => loadAutoRun().bag.findIndex(b => b && b.kind === k), kind);
    const b = await page.locator('.abag [data-slot="' + i + '"]').boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const mouth = page => page.evaluate(() => {
    const { S, C } = window.__title, H = hubState(S), r = document.querySelector('.aplaycvs').getBoundingClientRect(), k = r.width / TITLE_VW;
    const wx = hubStopX('gun'), wy = H.fy - MOUTH_UP;
    return { x: r.left + ((wx - C.x) * C.z + TITLE_VW / 2) * k, y: r.top + ((wy - C.y) * C.z + C.ay) * k };
  });
  const state = page => page.evaluate(() => {
    const H = hubState(window.__title.S), run = loadAutoRun();
    return { paid: H.paid.gun || 0, out: H.thrown.length, gold: bagCount(run, 'gold'), red: bagCount(run, 'red') };
  });
  const until = async (page, fn, ms) => { let s; for (let i = 0; i < ms / 100; i++) { s = await state(page); if (fn(s)) return s; await page.waitForTimeout(100); } return s; };

  // a flick: one nugget
  {
    const { ctx, page } = await open(30, 0);
    const a = await stack(page, 'gold'), m = await mouth(page);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move(a.x, (a.y + m.y) / 2, { steps: 3 });
    await page.mouse.move(m.x, m.y + 30, { steps: 3 });
    await page.waitForTimeout(16);
    await page.mouse.move(m.x, m.y, { steps: 2 });
    await page.mouse.up();
    const s1 = await state(page);
    check('flick: one nugget out of the bag (saved)', s1.gold === 29, s1);
    const s = await until(page, s => s.paid === 1 && s.out === 0, 3000);
    check('flick: the gun machine took it (paid 1)', s.paid === 1 && s.out === 0, s);
    await ctx.close();
  }
  // a stream: moved away, held → several, ramping
  {
    const { ctx, page } = await open(30, 0);
    const a = await stack(page, 'gold'), m = await mouth(page);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move(m.x, m.y + 20, { steps: 6 });
    await page.waitForTimeout(1500);
    await page.mouse.up();
    const s1 = await state(page);
    check('stream: several out of the bag', s1.gold <= 30 - 4 && s1.gold >= 0, s1);
    const s = await until(page, s => s.out === 0, 5000);
    check('stream: the gun machine took them all (paid = what left the bag)', s.paid === 30 - s.gold && s.paid >= 4, s);
    await ctx.close();
  }
  // a lump: held still on the stack → the whole stack, dropped at the machine
  {
    const { ctx, page } = await open(30, 0);
    const a = await stack(page, 'gold'), m = await mouth(page);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.waitForTimeout(700);
    const s0 = await state(page);
    check('lump: held still, the whole stack lifts (out of the bag)', s0.gold === 0 && s0.out === 1, s0);
    await page.mouse.move(m.x, m.y, { steps: 8 });
    await page.mouse.up();
    const s = await until(page, s => s.paid === 30, 3000);
    check('lump: dropped at the gun machine, all 30 taken', s.paid === 30 && s.out === 0, s);
    await ctx.close();
  }
  // the wrong currency: a red gem at the gun machine comes back
  {
    const { ctx, page } = await open(5, 2);
    const a = await stack(page, 'red'), m = await mouth(page);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.move(m.x, m.y, { steps: 8 });
    await page.mouse.up();
    const s1 = await state(page);
    check('red lump: out of the bag', s1.red === 0, s1);
    const back = await page.evaluate(() => DEV.autoThrowBack);
    const s = await until(page, s => s.red === 2, (back + 5) * 1000);
    check('the gun machine doesn\'t take red: both back in the bag, nothing paid', s.red === 2 && s.paid === 0 && s.out === 0, s);
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'all ok');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
