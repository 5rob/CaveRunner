// v71 bag screen: the gun's slots are a fixed grid (no regrouping), each tile tagged with
// the pull it fires on, a coloured light walking them in firing order, mods staying where
// they are dropped, and nothing wider than a phone.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const browser = await launch();
  for (const vp of [{ width: 412, height: 880 }, { width: 360, height: 640 }]) {
    const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
    await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => { window.__lvl.p.x = 30; DEV.bagSpeed = 3; });
    const tag = vp.width + 'x' + vp.height;
    const setSlots = (slots, shuffle) => page.evaluate(([sl, sh]) => {
      const g = window.__in.current.loadout.guns[0];
      g.cap = sl.length; g.slots = sl.slice(); g.shuffle = !!sh; g.multi = 1;
      resetGun(g);
      window.__in.current.notify();
    }, [slots, shuffle]);
    const tiles = () => page.evaluate(() => [...document.querySelectorAll('.slotRow .tile')].map(t => ({
      mod: t.dataset.mod || null, pull: +t.dataset.pull, cold: t.classList.contains('cold') })));

    const slots = ['double', 'dmg_up', 'bolt', null, 'bolt', 'slug', null, 'homing'];
    await setSlots(slots);
    await page.tap('.weapon');
    await page.waitForTimeout(400);
    let T = await tiles();
    check(`${tag}: one tile per slot, in slot order`, T.length === 8 && T.map(t => t.mod).join() === slots.map(s => s || '').join(), T.map(t => t.mod));
    check(`${tag}: the multicast and its shots are pull 0`, [0, 1, 2, 4].every(i => T[i].pull === 0), T.map(t => t.pull));
    check(`${tag}: the slug is the next pull`, T[5].pull === 1, T[5]);
    check(`${tag}: empty slots are no pull`, T[3].pull === -1 && T[6].pull === -1);
    check(`${tag}: a trailing modifier is dimmed as never cast`, T[7].pull === -1 && T[7].cold, T[7]);

    // the fire preview (trigger held) lights each pull's slots together, one colour per pull
    const seen = new Map(), together = new Set();
    for (let k = 0; k < 60; k++) {
      const on = await page.evaluate(() => {
        const all = [...document.querySelectorAll('.slotRow .tile')];
        return [...document.querySelectorAll('.slotRow .pulse.on')].map(p => ({ slot: all.indexOf(p.closest('.tile')), col: p.style.background }));
      });
      for (const o of on) seen.set(o.slot, o.col);
      if (on.length) together.add(on.map(o => o.slot).sort().join());
      await page.waitForTimeout(30);
    }
    check(`${tag}: a multicast pull lights all its slots at once`, together.has('0,1,2,4'), [...together]);
    check(`${tag}: the light visits every slot that fires, and no others`,
      [...seen.keys()].sort().join() === '0,1,2,4,5', [...seen.keys()]);
    check(`${tag}: a different colour for each pull`, seen.get(0) === seen.get(4) && seen.get(5) !== seen.get(0),
      Object.fromEntries(seen));

    // drop into an empty slot: it lands exactly there, nothing else moves
    const ts = await page.$$('.slotRow .tile');
    await ts[6].scrollIntoViewIfNeeded();
    const a = await ts[5].boundingBox(), b = await ts[6].boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    const now = await page.evaluate(() => window.__in.current.loadout.guns[0].slots.slice());
    check(`${tag}: a dragged mod stays in the slot it was dropped on`,
      JSON.stringify(now) === JSON.stringify(['double', 'dmg_up', 'bolt', null, 'bolt', null, 'slug', 'homing']), now);
    T = await tiles();
    check(`${tag}: the grid redraws with it`, T[6].mod === 'slug' && T[5].mod === null && T[6].pull === 1, T.map(t => t.mod));

    // shuffled: no sequence, and it says why
    await setSlots(['dmg_up', 'bolt', 'bolt'], true);
    await page.waitForTimeout(250);
    const lab = await page.evaluate(() => [...document.querySelectorAll('.lab')].map(e => e.textContent).join(' | '));
    check(`${tag}: a shuffled gun says so`, /shuffled every recharge/i.test(lab), lab);
    let shufLit = false;
    for (let k = 0; k < 40 && !shufLit; k++) { shufLit = !!(await page.$('.slotRow .pulse')); await page.waitForTimeout(30); }
    check(`${tag}: but the preview still fires it`, shufLit);

    // a full 25-slot gun fits the width and scrolls instead of growing the sheet
    await setSlots(new Array(25).fill('bolt'));
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const V = innerWidth, wide = [];
      document.querySelectorAll('.sheet, .sheet *').forEach(el => {
        const r = el.getBoundingClientRect();
        if ((r.width || r.height) && (r.right > V + 0.5 || r.left < -0.5)) wide.push(String(el.className).split(' ')[0]);
      });
      const sr = document.querySelector('.slotRow'), sh = document.querySelector('.sheet');
      return { wide, n: document.querySelectorAll('.slotRow .tile').length,
        scrolls: sr.scrollHeight > sr.clientHeight, sheetH: sh.scrollHeight, H: innerHeight };
    });
    check(`${tag}: 25 slots, nothing wider than the screen`, m.n === 25 && m.wide.length === 0, m);
    check(`${tag}: the slot grid scrolls, the sheet does not`, m.scrolls && m.sheetH <= m.H, m);
    await page.screenshot({ path: path.join(__dirname, '..', 'build', 'bag_' + tag + '.png') });

    // stats panel: every stat has a row, and mods show a +/- change
    await setSlots(['heavy', 'bolt', 'fast', 'bolt']);
    await page.waitForTimeout(250);
    const st = await page.evaluate(() => [...document.querySelectorAll('.gsrow[data-stat]')].map(r => ({
      k: r.dataset.stat, d: r.querySelector('u') ? r.querySelector('u').textContent : '', cls: r.querySelector('u') ? r.querySelector('u').className : '' })));
    check(`${tag}: all nine gun stats listed`, st.length === 9, st.map(s => s.k));
    const sp = st.find(s => s.k === 'speedMul');
    check(`${tag}: Heavy Shot shows as a red speed loss`, sp && /^−/.test(sp.d) && sp.cls === 'down', sp);
    await ctx.close();
  }
  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
