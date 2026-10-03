// v130: the Exo Suit's perk grid works like the Bag's mods (ui/editor.js ScrollBox): a bar down its
// side scrolls it, a perk you can fit takes the touch (a finger drag onto a slot fits it, the grid
// doesn't scroll under it), and the others let a swipe scroll. Real CDP touch, as scrollbar.test.js.
// Screenshot: perkgrid.png.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 400, height: 760 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1000);
  // in the shop (so the suit can change), carrying a few perks, every perk unlocked
  const id = await page.evaluate(() => {
    const LO = window.__in.current.loadout, L = window.__lvl;
    L.p.x = L.start.x; L.p.y = L.start.y;
    window.__in.current.perkCollection = PERK_IDS.slice();
    const ids = PERK_IDS.filter(i => !PERKS[i].stat);
    LO.perks = [ids[ids.length - 1], ids[0]];
    window.__in.current.notify();
    return ids[ids.length - 1];
  });
  await page.waitForTimeout(300);
  await page.tap('.weapon');
  await page.waitForTimeout(400);
  await page.locator('[data-tab="suit"]').dispatchEvent('pointerdown');
  await page.waitForTimeout(400);
  const cdp = await ctx.newCDPSession(page);
  const T = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const state = () => page.evaluate(() => {
    const el = document.querySelector('.xgrid'), bar = el.parentElement.querySelector('.sbar'), r = bar && bar.getBoundingClientRect();
    return { top: el.scrollTop, max: el.scrollHeight - el.clientHeight, bar: r && { x: r.x, y: r.y, w: r.width, h: r.height } };
  });
  let S = await state();
  check('the perk grid overflows here, and has a grab bar', S.max > 20 && S.bar && S.bar.h > 30, S);
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'perkgrid.png') });
  if (S.bar) {
    const b = S.bar, x = b.x + b.w / 2;
    await T('touchStart', x, b.y + 4);
    for (let i = 1; i <= 8; i++) await T('touchMove', x, b.y + 4 + (b.h - 8) * i / 8);
    await T('touchEnd');
    await page.waitForTimeout(150);
    S = await state();
    check('dragging the bar down scrolls the grid to the end', S.top >= S.max - 2, S);
  }
  // the carried perk (the last of the general ones): a finger drag onto the first slot fits it
  const at = await page.evaluate(id => {
    const g = document.querySelector('.xgrid');
    const p = document.querySelector('.xperk[data-perk="' + id + '"]');
    p.scrollIntoView({ block: 'center' });
    const r = p.getBoundingClientRect(), s = document.querySelector('[data-xslot="0"]').getBoundingClientRect();
    return { px: r.x + r.width / 2, py: r.y + r.height / 2, sx: s.x + s.width / 2, sy: s.y + s.height / 2, top: g.scrollTop,
      ta: getComputedStyle(p).touchAction };
  }, id);
  check('a perk you carry takes the touch', at.ta === 'none', at.ta);
  await T('touchStart', at.px, at.py);
  for (let i = 1; i <= 10; i++) { await T('touchMove', at.px + (at.sx - at.px) * i / 10, at.py + (at.sy - at.py) * i / 10); await page.waitForTimeout(16); }
  await T('touchEnd');
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({ suit0: window.__in.current.loadout.suit[0], top: document.querySelector('.xgrid').scrollTop }));
  check('dragged onto a slot, it is fitted', after.suit0 === id, after);
  check('and the grid did not scroll under the drag', Math.abs(after.top - at.top) < 3, [at.top, after.top]);
  // a locked perk lets a swipe scroll the grid
  const lk = await page.evaluate(() => {
    const g = document.querySelector('.xgrid'); g.scrollTop = g.scrollHeight;
    const p = Array.from(document.querySelectorAll('.xperk')).filter(e => !e.classList.contains('grab')).pop();
    const r = p.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, top: g.scrollTop, ta: getComputedStyle(p).touchAction };
  });
  check('a perk you can’t fit lets a swipe through', lk.ta === 'pan-y', lk.ta);
  await T('touchStart', lk.x, lk.y);
  for (let i = 1; i <= 12; i++) { await T('touchMove', lk.x, lk.y + i * 10); await page.waitForTimeout(16); }
  await T('touchEnd');
  await page.waitForTimeout(250);
  const sw = await page.evaluate(() => ({ top: document.querySelector('.xgrid').scrollTop, card: !!document.querySelector('.pop') }));
  check('swiping there scrolls the grid', sw.top < lk.top - 20, [lk.top, sw.top]);
  check('and opens no card', !sw.card, sw);

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log(e); process.exit(1); });
