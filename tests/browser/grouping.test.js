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

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
