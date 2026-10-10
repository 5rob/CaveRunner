// The Bag's "Collected mods" stack copies of the same mod (owner, item 9): one tile per mod with a
// small numbered circle top right for 2+. Dragging from a stack into a gun slot moves one copy
// (count drops, the tile goes at 0); a slot dragged back adds to its stack. Gun slots hold one each.
// Saves 412×880 screenshots to CAVERUNNER_SHOTS (a folder) when it is set.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const SHOTS = process.env.CAVERUNNER_SHOTS || '';

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const LO = window.__in.current.loadout, g = LO.guns[LO.sel];
    g.cap = 8; g.slots = ['bolt', 'triple', null, null, null, null, null, null]; resetGun(g);
    LO.bag.length = 0;
    for (const id of ['dmg_up', 'dmg_up', 'dmg_up', 'homing', 'bolt', 'dmg_up', 'homing', 'scatter',
      'fball', 'fball', 'big', 'zap', 'zap', 'zap', 'zap', 'zap', 'zap', 'zap', 'zap', 'zap', 'zap', 'zap', 'zap']) LO.bag.push(id);
    window.__in.current.notify();
  });
  await page.click('.weapon');
  await page.waitForTimeout(400);

  const grid = () => page.evaluate(() => [...document.querySelectorAll('.bag .tile[data-mod]')].map(t => {
    const c = t.querySelector('.tcount');
    return { id: t.dataset.mod, n: c ? Number(c.textContent) : 1 };
  }));
  let g0 = await grid();
  const n0 = id => (g0.find(t => t.id === id) || { n: 0 }).n;
  check('one tile per mod', g0.length === new Set(g0.map(t => t.id)).size && g0.length === 7, g0);
  check('counts shown for stacks', n0('dmg_up') === 4 && n0('homing') === 2 && n0('zap') === 12 && n0('scatter') === 1, g0);
  check('no badge on a single', await page.$$eval('.bag .tile[data-mod="scatter"] .tcount', e => e.length) === 0);
  const badge = await page.evaluate(() => {
    const t = document.querySelector('.bag .tile[data-mod="dmg_up"]').getBoundingClientRect();
    const c = document.querySelector('.bag .tile[data-mod="dmg_up"] .tcount').getBoundingClientRect();
    return { top: c.top - t.top, right: t.right - c.right, w: c.width, h: c.height };
  });
  check('the badge is a small circle in the top right', badge.top < 5 && badge.right < 5 && badge.w < 22 && badge.h < 18, badge);
  check('the bag still holds every copy', await page.evaluate(() => window.__in.current.loadout.bag.length) === 23);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'item9-1.png') });

  const dragTo = async (from, to) => {
    const a = await (await page.$(from)).boundingBox(), b = await (await page.$(to)).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(a.x + a.width / 2 + (b.x - a.x) * i / 8 + (b.width - a.width) * i / 16,
      a.y + a.height / 2 + (b.y - a.y) * i / 8 + (b.height - a.height) * i / 16);
    await page.mouse.up();
    await page.waitForTimeout(200);
  };
  // one copy of dmg_up into empty slot 3
  await dragTo('.bag .tile[data-mod="dmg_up"]', '[data-drop="slot:2"]');
  let st = await page.evaluate(() => { const LO = window.__in.current.loadout; return { slot: LO.guns[LO.sel].slots[2], bag: LO.bag.length }; });
  g0 = await grid();
  check('one copy goes into the slot', st.slot === 'dmg_up' && st.bag === 22, st);
  check('its count drops by one', n0('dmg_up') === 3, g0);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'item9-2.png') });

  // the single scatter: its tile goes when its last copy is used
  await dragTo('.bag .tile[data-mod="scatter"]', '[data-drop="slot:3"]');
  g0 = await grid();
  check('a stack of one leaves the grid when taken', n0('scatter') === 0, g0);

  // slot back to the bag: adds to the stack
  await dragTo('[data-drop="slot:2"] ', '.bag');
  g0 = await grid();
  st = await page.evaluate(() => { const LO = window.__in.current.loadout; return LO.guns[LO.sel].slots[2]; });
  check('a slot dragged back joins its stack', st === null && n0('dmg_up') === 4, g0);

  // Sort keeps one tile per mod
  await page.click('.sortBag');
  await page.waitForTimeout(150);
  g0 = await grid();
  check('Sort keeps the stacks', g0.length === new Set(g0.map(t => t.id)).size && n0('zap') === 12, g0);
  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall good');
  process.exit(fails ? 1 : 0);
})();
