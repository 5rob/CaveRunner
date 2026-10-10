// CaveRunner Auto stage 8b: dragging between the bag and the nav's slots, with real pointer events (the mouse, and
// touches through CDP). A Buzzsaw from the bag into the starter gun's empty slot 2 and back; a mod onto a gun circle
// is refused; a touch outside the grab radius scrolls the bag instead (and opens no card); a touch inside it drags;
// a tap opens the item's card (a mod's ModCard, an exo mod's own card).
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const run = newRun();
    bagAdd(run, { kind: 'gold', n: 50 });
    bagAdd(run, exoMod('jet', 2));
    saveAutoRun(run);
  });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  let on = false;
  for (let i = 0; i < 40 && !(on = !!(await page.$('.auto'))); i++) await page.waitForTimeout(50);
  check('the auto screen is up', on);
  const nav = async (...sel) => { for (const s of sel) { const L = page.locator(s === 'B' ? '.abtn.ab' : '.anav ' + s).first(); await L.dispatchEvent('pointerdown'); await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup'))); await page.waitForTimeout(80); } };
  const saved = () => page.evaluate(() => { const r = loadAutoRun(); return { slots: r.players[0].guns[0].slots, guns: r.players[0].guns.map(g => !!g), bag: r.bag.map(b => b && (b.id || b.kind)) }; });
  const centre = async sel => { const b = await page.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, b }; };
  const sawSlot = async () => { const s = await saved(); return '.abag [data-slot="' + s.bag.indexOf('saw') + '"]'; };
  const mdrag = async (from, to, mid) => {
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    const m = mid ? await page.evaluate(mid) : null;
    await page.mouse.up();
    await page.waitForTimeout(250);
    return m;
  };

  await nav('[data-player="0"]', '[data-open="guns"]', '[data-open="0"]');
  let s0 = await saved();
  check('the starter gun: slot 2 empty, a Buzzsaw in the bag', s0.slots[1] === null && s0.bag.includes('saw'), s0);

  // the mouse: the Buzzsaw into slot 2 (the ghost follows, the slot lights up)
  const mid = await mdrag(await centre(await sawSlot()), await centre('.anav [data-nslot="1"]'),
    () => ({ ghost: !!document.querySelector('.aghost'), lit: !!document.querySelector('.anav [data-nslot="1"].drop') }));
  check('mid-drag: a ghost under the pointer, the target slot lit', mid.ghost && mid.lit, mid);
  let s1 = await saved();
  check('dropped: slot 2 is the Buzzsaw, the bag lost it (saved)', s1.slots[1] === 'saw' && !s1.bag.includes('saw'), s1);
  check('the ghost is gone, the slot shows it', !(await page.$('.aghost')) && !!(await page.$('.anav [data-nslot="1"].full')));

  // back down to the bag
  await mdrag(await centre('.anav [data-nslot="1"]'), await centre('.abag [data-slot="20"]'));
  let s2 = await saved();
  check('dragged back: slot 2 empty, the Buzzsaw in the bag', s2.slots[1] === null && s2.bag.includes('saw'), s2);

  // a mod onto a gun circle: refused (no highlight, nothing moves)
  await nav('B');
  const before = await saved();
  const mid2 = await mdrag(await centre(await sawSlot()), await centre('.anav [data-gslot="1"]'),
    () => ({ ghost: !!document.querySelector('.aghost'), lit: !!document.querySelector('.anav .drop') }));
  const after = await saved();
  check('a mod onto a gun slot: not lit, refused, springs back', mid2.ghost && !mid2.lit && JSON.stringify(before) === JSON.stringify(after), { mid2, before, after });
  let gone = false;
  for (let i = 0; i < 20 && !(gone = !(await page.$('.aghost'))); i++) await page.waitForTimeout(50);
  check('the sprung-back ghost goes away', gone);

  // touches (CDP: real touch, the browser's own pan-y scrolling)
  await nav('[data-open="0"]');
  const cdp = await ctx.newCDPSession(page);
  const T = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const tdrag = async (x0, y0, x1, y1) => {
    await T('touchStart', x0, y0);
    for (let i = 1; i <= 10; i++) { await T('touchMove', x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10); await page.waitForTimeout(16); }
    await T('touchEnd');
    await page.waitForTimeout(300);
  };
  // outside the grab radius (the tile's corner): the bag scrolls, nothing is picked up, no card
  const c = await centre(await sawSlot());
  const st0 = await page.$eval('.abag', b => b.scrollTop);
  const s3 = await saved();
  await tdrag(c.b.x + 4, c.b.y + 4, c.b.x + 4, c.b.y - 120 > 0 ? c.b.y - 120 : 10);
  const st1 = await page.$eval('.abag', b => b.scrollTop);
  check('a touch outside the grab radius scrolls the bag', st1 > st0 + 20, [st0, st1]);
  check('… and picks nothing up, opens no card', JSON.stringify(await saved()) === JSON.stringify(s3) && !(await page.$('.aghost')) && !(await page.$('.modpop')));
  await page.$eval('.abag', b => { b.scrollTop = 0; });
  await page.waitForTimeout(100);
  // inside it: a touch drag fits it
  const c2 = await centre(await sawSlot()), t2 = await centre('.anav [data-nslot="1"]');
  await tdrag(c2.x, c2.y, t2.x, t2.y);
  const s4 = await saved();
  check('a touch inside the grab radius drags it into the slot', s4.slots[1] === 'saw' && !s4.bag.includes('saw'), s4);

  // a tap opens the card; the shade closes it
  const g = await centre('.anav [data-nslot="1"]');
  await page.mouse.click(g.x, g.y);
  await page.waitForTimeout(200);
  check('a tap on a fitted mod opens its card', !!(await page.$('.modpop .pop')));
  await page.locator('.modpop .shade').dispatchEvent('pointerdown');
  await page.waitForTimeout(150);
  check('the shade closes it', !(await page.$('.modpop')));
  const ei = (await saved()).bag.indexOf('exo');
  await page.tap('.abag [data-slot="' + ei + '"]');
  await page.waitForTimeout(200);
  const ex = await page.evaluate(() => (document.querySelector('.aexocard') || {}).textContent || '');
  check('a tap on an exo mod opens its card (category, tier, bonus)', /Jetpack II/.test(ex) && /%/.test(ex), ex);

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall ok');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log(e); process.exit(1); });
