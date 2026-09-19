const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => { window.__lvl.p.x = 30; });

  const setSlots = (slots, shuffle) => page.evaluate(([sl, sh]) => {
    const g = window.__in.current.loadout.guns[0];
    g.cap = sl.length; g.slots = sl.slice(); g.shuffle = !!sh;
    resetGun(g);
    window.__in.current.notify();
  }, [slots, shuffle]);
  const layout = () => page.evaluate(() => [...document.querySelectorAll('.slotRow .grp')].map(g => ({
    label: g.querySelector('.glab') ? g.querySelector('.glab').textContent : null,
    tiles: [...g.querySelectorAll('.tile')].map(t => t.textContent || 'empty'),
    cold: g.className.indexOf('cold') >= 0,
  })));

  await setSlots(['double', 'dmg_up', 'bolt', 'bolt', 'slug', 'homing']);
  await page.tap('.weapon');
  await page.waitForTimeout(300);
  let L = await layout();
  console.log(JSON.stringify(L, null, 1));
  check('three outlines: two pulls and the leftover', L.length === 3, L.length);
  check('the leftover homing is marked never cast', L[2].cold && L[2].tiles.length === 1, L[2]);
  check('the multicast group holds all four', L[0].tiles.length === 4, L[0].tiles);
  check('and is labelled as one pull of 2 shots', /1ST PULL/i.test(L[0].label) && /2 shots/i.test(L[0].label), L[0].label);
  check('the slug is its own pull', L[1].tiles.length === 1 && /1 shot/i.test(L[1].label), L[1]);
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'groups.png') });

  // a modifier with nothing after it is called out
  await setSlots(['bolt', 'dmg_up', 'homing']);
  await page.waitForTimeout(250);
  L = await layout();
  check('trailing modifiers marked never cast', L.length === 2 && L[1].cold && /never cast/i.test(L[1].label), L);
  check('and they are the two trailing tiles', L[1].tiles.length === 2, L[1].tiles);
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'groups_cold.png') });

  // a modifier moved in front of a shot joins that shot's outline
  await setSlots(['bolt', 'bolt', 'dmg_up']);
  await page.waitForTimeout(200);
  const before = await layout();
  await setSlots(['bolt', 'dmg_up', 'bolt']);
  await page.waitForTimeout(200);
  const after = await layout();
  check('moving a modifier regroups the outline',
    before.length === 3 && after.length === 2, { before: before.length, after: after.length });
  check('it now shares an outline with the shot it changes',
    after[1].tiles.length === 2, after[1].tiles);

  // shuffle guns show no grouping
  await setSlots(['dmg_up', 'bolt', 'bolt'], true);
  await page.waitForTimeout(250);
  L = await layout();
  const lab = await page.evaluate(() => [...document.querySelectorAll('.lab')].map(e => e.textContent).join(' | '));
  check('shuffled guns draw no outlines', L.length === 0, L.length);
  check('and say why', /shuffled every recharge/i.test(lab), lab);

  // dragging still works with the tiles nested in groups
  await setSlots(['bolt', 'dmg_up', 'bolt', null]);
  await page.waitForTimeout(250);
  const a = (await page.$$('.slotRow .tile'))[1], b = (await page.$$('.slotRow .tile'))[3];
  const ba = await a.boundingBox(), bb = await b.boundingBox();
  await page.mouse.move(ba.x + ba.width / 2, ba.y + ba.height / 2);
  await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const slots = await page.evaluate(() => window.__in.current.loadout.guns[0].slots.slice());
  check('drag and drop still works inside the outlines',
    JSON.stringify(slots) === JSON.stringify(['bolt', null, 'bolt', 'dmg_up']), slots);
  const regrouped = await layout();
  check('and the outlines redraw after the move', regrouped.length === 3, regrouped.map(g => g.label));

  await ctx.close();

  // --- a full gun must not push its outline off the right edge ---
  // Eight slots gathered into one pull is 8 tiles in a row: 535px of tiles on a 360px
  // phone before .gtiles was allowed to wrap. Measured, not eyeballed.
  for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
    const c2 = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true });
    const pg = await c2.newPage();
    pg.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
    await pg.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
    await pg.waitForTimeout(1200);
    await pg.evaluate(() => { window.__lvl.p.x = 30; });
    // one hot group of 8, then a second gun shape that leaves a long cold tail
    for (const slots of [['oct', 'dmg_up', 'homing', 'heavy', 'bolt', 'bolt', 'bolt', 'bolt'],
                         ['oct', 'bolt', 'slug', 'buck', 'lance', 'orb', 'saw', 'spark']]) {
      await pg.evaluate(sl => {
        const g = window.__in.current.loadout.guns[0];
        g.cap = sl.length; g.slots = sl.slice(); g.multi = 1; g.shuffle = false;
        resetGun(g);
        window.__in.current.notify();
      }, slots);
      if (!(await pg.$('.sheet'))) { await pg.tap('.weapon'); }
      await pg.waitForTimeout(400);
      const m = await pg.evaluate(() => {
        const V = { w: innerWidth, h: innerHeight };
        const wide = [];
        document.querySelectorAll('.sheet, .sheet *').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return;
          if (r.right > V.w + 0.5 || r.left < -0.5)
            wide.push(String(el.className).split(' ')[0] + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
        });
        const grps = [...document.querySelectorAll('.slotRow .grp')].map(g => {
          const box = g.querySelector('.gtiles').getBoundingClientRect();
          const ti = [...g.querySelectorAll('.tile')].map(t => t.getBoundingClientRect());
          return { n: ti.length, right: Math.round(box.right), width: Math.round(box.width),
            rows: new Set(ti.map(r => Math.round(r.top))).size,
            // the outline has to keep enclosing its tiles once they wrap
            encloses: ti.every(r => r.left >= box.left - 1 && r.right <= box.right + 1 &&
              r.top >= box.top - 1 && r.bottom <= box.bottom + 1) };
        });
        return { V, wide, grps, sheetScrollW: document.querySelector('.sheet').scrollWidth,
          tilesOffRight: [...document.querySelectorAll('.slotRow .tile')]
            .filter(t => t.getBoundingClientRect().right > V.w + 0.5).length };
      });
      const tag = vp.width + 'x' + vp.height + ' ' + slots.length + ' slots (' + slots[1] + ')';
      console.log(tag, JSON.stringify(m));
      check(`${tag}: no tile runs off the right edge`, m.tilesOffRight === 0, m.tilesOffRight);
      check(`${tag}: nothing in the sheet is wider than the screen`,
        m.wide.length === 0 && m.sheetScrollW <= vp.width, { wide: m.wide.slice(0, 5), scrollW: m.sheetScrollW });
      check(`${tag}: every group outline stays inside the screen`,
        m.grps.every(g => g.right <= vp.width), m.grps.map(g => g.right));
      check(`${tag}: outlines still enclose their tiles after wrapping`,
        m.grps.every(g => g.encloses), m.grps);
      // a group whose tiles cannot fit on one line has to have stacked, not overflowed
      check(`${tag}: a group too wide for one line stacks instead`,
        m.grps.every(g => g.n * 66 - 6 <= g.width - 13 || g.rows > 1),
        m.grps.map(g => ({ n: g.n, rows: g.rows, width: g.width })));
      await pg.screenshot({ path: path.join(__dirname, '..', 'build',
        'groups_wide_' + vp.width + 'x' + vp.height + '_' + slots[1] + '.png') });
    }
    // dragging across the wrap: slot 0 is on the first row, slot 7 on the second
    await pg.evaluate(() => {
      const g = window.__in.current.loadout.guns[0];
      g.cap = 8; g.multi = 1; g.shuffle = false;
      g.slots = ['oct', 'dmg_up', 'homing', 'heavy', 'bolt', 'bolt', 'bolt', 'bolt'];
      resetGun(g);
      window.__in.current.notify();
    });
    await pg.waitForTimeout(300);
    const ts = await pg.$$('.slotRow .tile');
    const ta = await ts[0].boundingBox(), tb = await ts[7].boundingBox();
    check(`${vp.width}x${vp.height}: the wrap really puts them on different rows`,
      Math.round(ta.y) !== Math.round(tb.y), { first: Math.round(ta.y), last: Math.round(tb.y) });
    await pg.mouse.move(ta.x + ta.width / 2, ta.y + ta.height / 2);
    await pg.mouse.down();
    await pg.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 12 });
    await pg.mouse.up();
    await pg.waitForTimeout(300);
    const moved = await pg.evaluate(() => window.__in.current.loadout.guns[0].slots.slice());
    check(`${vp.width}x${vp.height}: dragging from one row to the next still swaps`,
      JSON.stringify(moved) ===
      JSON.stringify(['bolt', 'dmg_up', 'homing', 'heavy', 'bolt', 'bolt', 'bolt', 'oct']), moved);
    await c2.close();
  }

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
