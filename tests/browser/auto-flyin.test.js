// CaveRunner Auto (owner): a pickup taken into the bag in the hub flies a copy of its tile (.afly, the bag's look) from
// the player into the bag slot it went into (bagSlotOf), then goes. Paused at its end, the copy sits on that slot.
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
  await page.locator('.tstart').dispatchEvent('pointerdown');
  for (let i = 0; i < 60 && !(await page.$('.auto')); i++) await page.waitForTimeout(50);
  await page.waitForTimeout(2200);   // the player through the pad
  // a mod pickup beside player 1, free to fly to him
  const id = await page.evaluate(() => {
    const S = window.__title.S, L = S.runners[0], id = Object.keys(MODS).find(k => !MODS[k].off && MODS[k].glyph && MODS[k].kind !== 'shot');
    L.vx = 0;
    (S.loot || (S.loot = [])).push({ x: S.scroll + L.x + 40, y: L.y - 10, vx: 0, vy: 0, it: { kind: 'mod', id, n: 1 }, col: '#fff', t: 1, nopull: 0 });
    return id;
  });
  let fly = null;
  for (let i = 0; i < 60 && !fly; i++) {
    fly = await page.evaluate(() => {
      const el = document.querySelector('.afly');
      if (!el) return null;
      const a = el.getAnimations()[0];
      if (a) { a.pause(); a.currentTime = 0; }
      const r0 = el.getBoundingClientRect();
      if (a) a.currentTime = 499;
      const r1 = el.getBoundingClientRect(), slot = Number(el.dataset.fly);
      const t = document.querySelector('.abag [data-slot="' + slot + '"]').getBoundingClientRect();
      const run = loadAutoRun(), cv = document.querySelector('.aplaycvs').getBoundingClientRect();
      return { slot, at: run ? bagSlotOf(run, { kind: 'mod', id: run.bag[slot] && run.bag[slot].id, n: 1 }) : -2, held: run && run.bag[slot] && run.bag[slot].id,
        start: { x: r0.left + r0.width / 2, y: r0.top + r0.height / 2 }, end: { x: r1.left + r1.width / 2, y: r1.top + r1.height / 2 },
        tile: { x: t.left + t.width / 2, y: t.top + t.height / 2 }, cv: { top: cv.top, bottom: cv.bottom }, icon: !!el.querySelector('.apixg') };
    });
    if (!fly) await page.waitForTimeout(50);
  }
  check('taken: a fly-copy of its tile appears (with its glyph icon)', !!fly && fly.icon, fly);
  check('… headed for the slot the mod went into', !!fly && fly.held === id && fly.at === fly.slot, fly);
  check('… starting in the play area (where he took it)', !!fly && fly.start.y > fly.cv.top && fly.start.y < fly.cv.bottom, fly);
  check('… ending on that slot', !!fly && Math.hypot(fly.end.x - fly.tile.x, fly.end.y - fly.tile.y) < 3, fly);
  await page.evaluate(() => { const el = document.querySelector('.afly'); const a = el && el.getAnimations()[0]; if (a) a.play(); });
  let gone = false;
  for (let i = 0; i < 30 && !gone; i++) { await page.waitForTimeout(50); gone = !(await page.$('.afly')); }
  check('… then it goes', gone);
  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'all ok');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
