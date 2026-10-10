// v79: the gun's slot grid and the collected-mods grid each have a bar down the right side
// you can grab to scroll (the mod tiles take the touch for dragging, so a full grid left
// nothing to scroll by), and an empty slot lets a swipe scroll the grid.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1000);
  // a 25-slot gun, mostly empty, and a big bag: both grids overflow
  await page.evaluate(() => {
    const LO = window.__in.current.loadout, g = LO.guns[0];
    g.cap = 25; g.slots = Array(25).fill(null); g.slots[0] = 'bolt'; g.shuffle = false; g.multi = 1;
    resetGun(g);
    LO.bag = ALL_IDS.slice(0, 80);
    window.__in.current.notify();
  });
  await page.tap('.weapon');
  await page.waitForTimeout(500);

  const state = () => page.evaluate(() => ['.slotRow', '.bag'].map(s => {
    const el = document.querySelector(s), w = el.parentElement, bar = w.querySelector('.sbar');
    const r = bar && bar.getBoundingClientRect(), tr = el.querySelector('.tile').getBoundingClientRect();
    return { top: el.scrollTop, max: el.scrollHeight - el.clientHeight, bar: !!bar,
      barBox: r && { x: r.x, y: r.y, w: r.width, h: r.height }, tileRight: tr.right,
      thumb: bar && bar.querySelector('i').style.top };
  }));
  let S = await state();
  check('both grids overflow in this setup', S.every(s => s.max > 20), S.map(s => s.max));
  check('and each has a grab bar down its side', S.every(s => s.bar && s.barBox.h > 40), S.map(s => s.barBox));
  check('the bar sits clear of the tiles', S.every(s => s.barBox.x >= s.tileRight - 1), S.map(s => [s.barBox.x, s.tileRight]));

  // drag down each bar with a finger: the grid scrolls, and the thumb follows
  for (const [k, name] of [[0, 'slot grid'], [1, 'mod bag']]) {
    const b = S[k].barBox, x = b.x + b.w / 2;
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await touch('touchStart', b.y + 6);
    for (let i = 1; i <= 8; i++) await touch('touchMove', b.y + 6 + (b.h - 12) * i / 8);
    await touch('touchEnd');
    await page.waitForTimeout(150);
    const s = (await state())[k];
    check(`dragging the ${name}'s bar to the bottom scrolls it to the end`, s.top >= s.max - 2, { top: s.top, max: s.max });
    check(`and the ${name}'s thumb moves down with it`, parseFloat(s.thumb) > 30, s.thumb);
    // a tap near the top of the bar jumps back up
    await page.touchscreen.tap(x, b.y + 4);
    await page.waitForTimeout(150);
    check(`tapping the top of the ${name}'s bar jumps back up`, (await state())[k].top < 5, (await state())[k].top);
  }

  // a swipe that starts on an empty slot scrolls the slot grid (native touch scroll)
  const hole = await page.evaluate(() => {
    const t = document.querySelectorAll('.slotRow .tile.hole')[4].getBoundingClientRect();
    return { x: t.x + t.width / 2, y: t.y + t.height / 2, ta: getComputedStyle(document.querySelector('.slotRow .tile.hole')).touchAction };
  });
  check('an empty slot lets a vertical swipe through', hole.ta === 'pan-y', hole.ta);
  // a real finger swipe (touch events): from an empty slot it scrolls; from a mod it doesn't
  // (a mod keeps the touch for dragging)
  const cdp = await ctx.newCDPSession(page);
  const swipe = async (x, y) => {
    await page.evaluate(() => { document.querySelector('.slotRow').scrollTop = 0; });
    const T = (type, yy) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: yy }] });
    await T('touchStart', y);
    for (let i = 1; i <= 12; i++) { await T('touchMove', y - i * 10); await page.waitForTimeout(16); }
    await T('touchEnd');
    await page.waitForTimeout(200);
    return (await state())[0].top;
  };
  const onHole = await swipe(hole.x, hole.y);
  check('swiping on an empty slot scrolls the slot grid', onHole > 20, onHole);
  const mod = await page.evaluate(() => { const t = document.querySelector('.slotRow .tile[data-mod]').getBoundingClientRect(); return { x: t.x + t.width / 2, y: t.y + t.height / 2 }; });
  const onMod = await swipe(mod.x, mod.y);
  check('but a swipe that starts on a mod does not (it drags the mod)', onMod < 5, onMod);

  await browser.close();
  if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
  console.log('\nall scrollbar checks passed');
})().catch(e => { console.log('FAIL', e); process.exit(1); });
