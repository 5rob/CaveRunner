// The perk vending machine and the Exo Suit (src/ui/modshop.js perkShop, src/ui/exosuit.js): the
// floor has one hidden room with a green crystal on its altar (no heart room); a green crystal
// unlocks a perk at the machine (kept across runs), gold dispenses a copy that pops out and is
// carried; the Bag's second tab is the Exo Suit: drag a carried perk onto a slot and it counts,
// drag it off and it doesn't; a tap shows its card; the top bar counts green crystals.
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

  let st = await page.evaluate(() => ({ rooms: window.__lvl.rooms.map(r => r.kind) }));
  check('one hidden room, holding a green crystal', st.rooms.length === 1 && st.rooms[0] === 'green', st.rooms);

  // take the room's green crystal: pinned on the altar (the room is hollow), asked for a few frames
  st = await page.evaluate(async () => {
    const L = window.__lvl, r = L.rooms[0];
    L.pickups.length = 0; L.enemies.length = 0;
    const pin = () => { L.p.x = r.x - 4; L.p.y = r.y - 8; L.p.vx = L.p.vy = 0; };
    pin(); window.__in.current.sig = '';
    for (let i = 0; i < 12; i++) { pin(); await new Promise(res => requestAnimationFrame(res)); }
    const card = !!document.querySelector('.crystalcard');
    for (let i = 0; i < 8; i++) { pin(); window.__in.current.interact = true; await new Promise(res => requestAnimationFrame(res)); }
    await new Promise(res => setTimeout(res, 150));
    return { card, greens: (window.__in.current.loadout.greens || []).length, taken: r.taken,
      top: document.querySelectorAll('.gold .crysrow .cbit.green').length };
  });
  check('its card shows, a tap pockets it', st.card && st.greens === 1 && st.taken, st);
  check('the top bar shows a green silhouette', st.top === 1, st.top);

  // the machine
  const MX = await page.evaluate(() => SHOPS.perks.x);
  await page.evaluate(x => { const L = window.__lvl; L.p.x = x - 6; L.p.y = L.world.SHOP_FLOOR * L.world.CELL - 22; L.p.vx = L.p.vy = 0; window.__in.current.sig = ''; }, MX);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(DIR, 'perkshop_machine.png') });
  await page.evaluate(() => { window.__in.current.loadout.gold = 1000; window.__in.current.interact = true; });
  await page.waitForTimeout(250);
  st = await page.evaluate(() => ({ open: !!document.querySelector('.vshop'), title: document.querySelector('.vhead b').textContent,
    cells: document.querySelectorAll('.vcell').length, empty: document.querySelectorAll('.vcell.empty').length, all: PERK_IDS.length }));
  check('the perk machine opens its menu, every perk an empty cell', st.open && st.title === 'Perks' && st.cells === st.all && st.empty === st.all, st);
  const down = sel => page.evaluate(s => { document.querySelector(s).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); }, sel);
  await down('.vunlock');
  await page.waitForTimeout(120);
  st = await page.evaluate(() => ({ c: window.__in.current.perkCollection.slice(), greens: window.__in.current.loadout.greens.length,
    stored: JSON.parse(localStorage.getItem('caverunner-perkcollection') || '[]') }));
  check('a green crystal unlocks a perk, kept across runs', st.c.length === 1 && st.greens === 0 && st.stored[0] === st.c[0], st);
  const pid = st.c[0];
  await page.screenshot({ path: path.join(DIR, 'perkshop_menu.png') });
  await down('.vbuy');
  await page.waitForTimeout(100);
  st = await page.evaluate(id => ({ open: !!document.querySelector('.vshop'), gold: window.__in.current.loadout.gold, price: perkPrice(id) }), pid);
  check('Dispense: gold taken, menu closed', !st.open && st.gold === 1000 - st.price, st);
  let q = null;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(100);
    q = await page.evaluate(id => { const q = window.__lvl.pickups.find(q => q.kind === 'perk' && q.id === id); return q && { x: q.x, y: q.y, fly: q.vy !== undefined }; }, pid);
    if (q && !q.fly) break;
  }
  check('the perk pops out and lands', !!q && !q.fly, q);
  await page.evaluate(q => { const L = window.__lvl; L.p.x = q.x - 6; L.p.vx = 0; window.__in.current.sig = ''; }, q);
  await page.waitForTimeout(250);
  await page.evaluate(() => { window.__in.current.interact = true; });
  await page.waitForTimeout(200);
  st = await page.evaluate(() => ({ perks: window.__in.current.loadout.perks.slice(), suit: window.__in.current.loadout.suit.slice() }));
  check('picked up, it is carried, not fitted', st.perks.includes(pid) && !st.suit.includes(pid), st);

  // the Exo Suit: the Bag's second tab
  await page.tap('.weapon');
  await page.waitForTimeout(250);
  check('the Bag has tabs along the bottom', await page.evaluate(() => document.querySelectorAll('.btabs .btab').length === 2));
  await down('.btab[data-tab="suit"]');
  await page.waitForTimeout(250);
  st = await page.evaluate(() => ({ suit: !!document.querySelector('.exosuit'), slots: document.querySelectorAll('.xslot').length,
    port: !!document.querySelector('canvas.xport'), grid: document.querySelectorAll('.xperk').length, have: document.querySelectorAll('.xperk.have').length }));
  check('the Exo Suit: portrait, six perk slots and five stat slots, every perk in the grid', st.suit && st.port && st.slots === 11 && st.grid === await page.evaluate(() => PERK_IDS.length), st);
  check('the carried one is lit', st.have === 1, st.have);
  await page.screenshot({ path: path.join(DIR, 'exosuit.png') });

  // a tap shows the card
  const tile = await page.evaluate(id => { const r = document.querySelector('.xperk[data-perk="' + id + '"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, pid);
  await page.touchscreen.tap(tile.x, tile.y);
  await page.waitForTimeout(150);
  check('tapping a perk shows its card', await page.evaluate(() => !!document.querySelector('.exosuit .pop.top')));
  await page.evaluate(() => document.querySelector('.exosuit .shade').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })));
  await page.waitForTimeout(100);

  // drag it onto slot 3
  const si = await page.evaluate(id => { for (let i = 0; i < SUIT_LEN; i++) if (fitsSlot(id, i)) return i; return -1; }, pid);
  const slot = await page.evaluate(i => { const r = document.querySelector('[data-xslot="' + i + '"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, si);
  const dragTo = async (a, b) => {
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(a.x + (b.x - a.x) * i / 8, a.y + (b.y - a.y) * i / 8);
    await page.mouse.up(); await page.waitForTimeout(150);
  };
  await dragTo(tile, slot);
  st = await page.evaluate(() => ({ suit: window.__in.current.loadout.suit.slice(), perks: window.__in.current.loadout.perks.slice() }));
  check('dragged onto a slot that takes it: fitted, no longer carried', st.suit[si] === pid && !st.perks.includes(pid), st);
  await page.waitForTimeout(100);
  check('and it counts (the HUD column shows it)', await page.evaluate(() => document.querySelectorAll('.perkpip').length === 1));
  await page.screenshot({ path: path.join(DIR, 'exosuit_fitted.png') });
  // drag it off again
  await dragTo(slot, tile);
  st = await page.evaluate(() => ({ suit: window.__in.current.loadout.suit.slice(), perks: window.__in.current.loadout.perks.slice() }));
  check('dragged off: carried again', !st.suit.includes(pid) && st.perks.includes(pid), st);

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
