// The mod vending machine (src/game/systems/shops.js, src/ui/vendshop.js, src/ui/modshop.js): it
// stands in the shop and says "Tap R to shop"; the tap opens its menu (the game pauses), the
// collection starts empty, a red crystal unlocks a mod off its floor's table (kept in localStorage),
// the left stick moves the highlight and the right stick's tap presses it, and "Dispense selected"
// takes the gold, closes the menu and pops the mod out onto the floor, where it can be taken.
// Also: the cave's pickups are red crystals now, not mods, and the shop has no plinths but the heal.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const DIR = path.join(__dirname, '..', 'build');
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(DIR, 'test.html'));
  await page.waitForTimeout(1300);

  const s0 = await page.evaluate(() => ({
    stock: window.__lvl.stock.map(i => i.kind),
    kinds: [...new Set(window.__lvl.pickups.map(q => q.kind))],
    crystals: window.__lvl.pickups.filter(q => q.kind === 'crystal').map(q => q.floor),
  }));
  check('the shop has only the heal on a plinth', s0.stock.length === 1 && s0.stock[0] === 'heal', s0.stock);
  check('the cave has red crystals and no mods lying about', s0.kinds.includes('crystal') && !s0.kinds.includes('mod'), s0.kinds);
  check('each crystal knows its floor', s0.crystals.length > 0 && s0.crystals.every(f => f === 1), s0.crystals);

  // stand at the machine
  const MX = await page.evaluate(() => SHOPS.mods.x);
  await page.evaluate(x => { const L = window.__lvl; L.p.x = x - 6; L.p.vx = 0; window.__in.current.sig = ''; }, MX);
  await page.waitForTimeout(300);
  let line = await page.evaluate(() => { const b = document.querySelector('.pbuy'); return b && b.textContent; });
  check('standing at it says "Tap R to shop"', /Tap R to shop$/.test(line || ''), line);
  await page.screenshot({ path: path.join(DIR, 'vendshop_machine.png') });

  await page.evaluate(() => { window.__in.current.interact = true; });
  await page.waitForTimeout(250);
  let st = await page.evaluate(() => ({ open: !!document.querySelector('.vshop'), paused: window.__in.current.paused,
    cells: document.querySelectorAll('.vcell').length, empty: document.querySelectorAll('.vcell.empty').length, all: ALL_IDS.length,
    tiers: document.querySelectorAll('.vtier').length }));
  check('the tap opens the menu and pauses the game', st.open && st.paused, st);
  check('a cell for every mod, in four rarity groups, all empty', st.cells === st.all && st.empty === st.all && st.tiers === 4, st);

  // no crystal: the unlock refuses
  const down = sel => page.evaluate(s => { document.querySelector(s).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); }, sel);
  await down('.vunlock');
  await page.waitForTimeout(80);
  check('without a crystal nothing unlocks', await page.evaluate(() => window.__in.current.collection.length === 0));

  // two crystals from floor 1: one unlocks a floor-1 mod, kept in localStorage
  await page.evaluate(() => { window.__in.current.loadout.crystals = [1, 1]; window.__in.current.notify(); });
  await page.waitForTimeout(50);
  await down('.vunlock');
  await page.waitForTimeout(120);
  st = await page.evaluate(() => {
    const c = window.__in.current.collection;
    return { c: c.slice(), crystals: window.__in.current.loadout.crystals.length, w: c.map(id => modWeight(id, 1)),
      stored: JSON.parse(localStorage.getItem('caverunner-collection') || '[]'),
      lit: [...document.querySelectorAll('.vcell:not(.empty)')].map(e => e.getAttribute('data-id')),
      unlockText: document.querySelector('.vunlock').textContent };
  });
  check('a crystal unlocks one mod and is used up', st.c.length === 1 && st.crystals === 1, st);
  check('off floor 1\'s drop table', st.w[0] > 0, st.w);
  check('kept across runs (localStorage)', st.stored.length === 1 && st.stored[0] === st.c[0], st.stored);
  check('its cell lights up in the grid', st.lit.length === 1 && st.lit[0] === st.c[0], st.lit);
  check('the button shows the crystals left', /×1/.test(st.unlockText), st.unlockText);
  const got = st.c[0];

  // the sticks: the highlight starts on the new mod; down goes to the unlock button, down again
  // to Dispense; a right-stick tap presses it
  const focus = () => page.evaluate(() => { const e = document.querySelector('.vshop .navon'); return e && e.getAttribute('data-nav'); });
  check('the highlight is on the mod just unlocked', (await focus()) === 't:' + got, await focus());
  const push = async (nx, ny) => {
    await page.evaluate(([nx, ny]) => Object.assign(window.__in.current.left, { active: true, nx, ny, mag: 1, on: true }), [nx, ny]);
    await page.waitForTimeout(120);
    await page.evaluate(() => Object.assign(window.__in.current.left, { active: false, mag: 0, on: false }));
    await page.waitForTimeout(60);
  };
  await push(0, 1);
  check('left stick down: the unlock button', (await focus()) === 'unlock', await focus());
  await push(0, 1);
  check('down again: Dispense selected', (await focus()) === 'buy', await focus());
  const price = await page.evaluate(id => priceOf(id), got);
  line = await page.evaluate(() => document.querySelector('.vbuy').textContent);
  check('it shows the selected mod\'s price', line === 'Dispense selected' + price + 'g', line);
  await page.screenshot({ path: path.join(DIR, 'vendshop_menu.png') });

  // too poor: stays open
  await page.evaluate(() => { window.__in.current.loadout.gold = 0; window.__in.current.menuTap(); });
  await page.waitForTimeout(80);
  check('without the gold it stays open', await page.evaluate(() => !!document.querySelector('.vshop')));
  await page.evaluate(() => { window.__in.current.loadout.gold = 1000; window.__in.current.menuTap(); });
  await page.waitForTimeout(100);
  st = await page.evaluate(() => ({ open: !!document.querySelector('.vshop'), gold: window.__in.current.loadout.gold, paused: window.__in.current.paused }));
  check('Dispense: the menu closes and the gold is taken', !st.open && !st.paused && st.gold === 1000 - price, st);

  // it pops out of the machine and lands on the floor beside it
  let q = null;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(100);
    q = await page.evaluate(id => { const q = window.__lvl.pickups.find(q => q.kind === 'mod' && q.id === id); return q && { x: q.x, y: q.y, fly: q.vy !== undefined }; }, got);
    if (q && !q.fly) break;
  }
  const fy = await page.evaluate(() => window.__lvl.world.SHOP_FLOOR * window.__lvl.world.CELL - 9);
  check('the mod landed on the shop floor beside the machine', !!q && !q.fly && Math.abs(q.y - fy) < 1 && Math.abs(q.x - MX) > 30 && Math.abs(q.x - MX) < 120, { q, fy, MX });
  await page.screenshot({ path: path.join(DIR, 'vendshop_dropped.png') });

  // and it can be taken
  await page.evaluate(q => { const L = window.__lvl; L.p.x = q.x - 6; L.p.vx = 0; window.__in.current.sig = ''; }, q);
  await page.waitForTimeout(250);
  await page.evaluate(() => { window.__in.current.interact = true; });
  await page.waitForTimeout(200);
  check('picked up into the bag', await page.evaluate(id => window.__in.current.loadout.bag.includes(id), got));

  // a crystal in the cave is taken with a tap
  st = await page.evaluate(async () => {
    const L = window.__lvl, q = L.pickups.find(q => q.kind === 'crystal');
    const before = window.__in.current.loadout.crystals.length;
    L.p.x = q.x - 6; L.p.y = q.y - 13; L.p.vx = L.p.vy = 0; window.__in.current.sig = '';
    await new Promise(r => setTimeout(r, 250));
    const card = !!document.querySelector('.crystalcard');
    window.__in.current.interact = true;
    await new Promise(r => setTimeout(r, 200));
    return { card, before, after: window.__in.current.loadout.crystals.length, taken: !L.pickups.includes(q) };
  });
  check('standing at a crystal shows its card; a tap takes it', st.card && st.after === st.before + 1 && st.taken, st);

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
