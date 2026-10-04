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
  // the right stick is a pointer: drag it with the real mouse and a thin ring travels out, the
  // stick's range mapped onto the distance to the furthest screen corner; it highlights what it's
  // over, and letting go there presses it
  const stick = await page.evaluate(() => { const r = document.querySelectorAll('.sticks .stick')[1].getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, rad: r.width / 2, size: r.width, W: innerWidth, H: innerHeight, knob: KNOB }; });
  const center = sel => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
  // where on the stick to hold so the pointer lands on t
  const holdFor = t => {
    const far = Math.max(Math.hypot(stick.x, stick.y), Math.hypot(stick.W - stick.x, stick.y), Math.hypot(stick.x, stick.H - stick.y), Math.hypot(stick.W - stick.x, stick.H - stick.y));
    const vx = t.x - stick.x, vy = t.y - stick.y, d = Math.hypot(vx, vy), mag = d / far, off = mag * stick.rad * 0.72;
    return { x: stick.x + vx / d * off, y: stick.y + vy / d * off };
  };
  const ring = () => page.evaluate(() => { const e = document.querySelector('.mptr'), r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    return { shown: cs.display !== 'none', x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, border: parseFloat(cs.borderTopWidth), bg: cs.backgroundColor }; });
  await page.mouse.move(stick.x, stick.y); await page.mouse.down();
  const tBuy = await center('.vbuy'), hBuy = holdFor(tBuy);
  for (let i = 1; i <= 6; i++) await page.mouse.move(stick.x + (hBuy.x - stick.x) * i / 6, stick.y + (hBuy.y - stick.y) * i / 6);
  await page.waitForTimeout(120);
  let rg = await ring();
  check('dragging the right stick puts out a pointer ring', rg.shown, rg);
  check('it travels out to the target, several times further than the knob', Math.hypot(rg.x - tBuy.x, rg.y - tBuy.y) < 30 &&
    Math.hypot(rg.x - stick.x, rg.y - stick.y) > 3 * Math.hypot(hBuy.x - stick.x, hBuy.y - stick.y), { rg, tBuy, hBuy });
  check('a very thin ring, no fill, the knob size', rg.border <= 1 && (rg.bg === 'rgba(0, 0, 0, 0)' || rg.bg === 'transparent') && Math.abs(rg.w - stick.size * stick.knob) < 1.5, rg);
  check('what it is over is highlighted', (await focus()) === 'buy', await focus());
  await page.screenshot({ path: path.join(DIR, 'vendshop_pointer.png') });
  // a gentle snap: aimed just outside the close button, it still lands on it, pulled a little towards its middle
  const xr = await page.evaluate(() => { const r = document.querySelector('.vclose').getBoundingClientRect(); return { l: r.left, t: r.top, b: r.bottom, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; });
  const near = { x: xr.l - 6, y: xr.cy }, hN = holdFor(near);
  await page.mouse.move(hN.x, hN.y); await page.waitForTimeout(100);
  rg = await ring();
  check('aimed just beside a button it snaps on: highlighted', (await focus()) === 'close', await focus());
  check('pulled a little towards its middle, not jumped there', rg.x > near.x + 1 && rg.x < xr.cx - 5, { rg: rg.x, near: near.x, mid: xr.cx });
  // the Dev knobs: no pull leaves it where you aim (still on the button), a thicker line
  await page.evaluate(() => { DEV.snapPull = 0; DEV.ptrLine = 2; });
  await page.mouse.move(hN.x + 0.5, hN.y); await page.mouse.move(hN.x, hN.y); await page.waitForTimeout(100);
  rg = await ring();
  check('Dev: snap pull 0 leaves it where you aim, still counted on the button', Math.abs(rg.x - near.x) < 1.5 && (await focus()) === 'close', { rg: rg.x, near: near.x });
  check('Dev: ring line width', rg.border === 2, rg.border);
  await page.evaluate(() => { DEV.snapPull = DEV_DEFAULTS.snapPull; DEV.ptrLine = DEV_DEFAULTS.ptrLine; });
  const far = { x: xr.l - 60, y: xr.b + 60 }, hF = holdFor(far);
  await page.mouse.move(hF.x, hF.y); await page.waitForTimeout(100);
  rg = await ring();
  check('well away from anything it does not snap', Math.hypot(rg.x - far.x, rg.y - far.y) < 2, { rg, far });
  // the pointer is held inside the screen: full tilt towards a far corner stops at the edge
  await page.mouse.move(stick.x - stick.rad * 0.72, stick.y - stick.rad * 0.72);
  await page.waitForTimeout(80);
  rg = await ring();
  check('pushed to the limit it stops at the screen edge', rg.x >= -1 && rg.y >= -1 && (rg.x < 2 || rg.y < 2), rg);
  // let go over nothing: nothing is pressed, the highlight stays
  await page.mouse.move(stick.x + 2, stick.y + 2);
  await page.waitForTimeout(60);
  await page.mouse.up(); await page.waitForTimeout(100);
  check('let go over nothing: the ring goes, the menu stays', !(await ring()).shown && await page.evaluate(() => !!document.querySelector('.vshop')));
  // let go over the unlock button: it's pressed (the second crystal goes)
  const hUn = holdFor(await center('.vunlock'));
  await page.mouse.move(stick.x, stick.y); await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(stick.x + (hUn.x - stick.x) * i / 6, stick.y + (hUn.y - stick.y) * i / 6);
  await page.waitForTimeout(100);
  await page.mouse.up(); await page.waitForTimeout(150);
  st = await page.evaluate(() => ({ c: window.__in.current.collection.length, left: window.__in.current.loadout.crystals.length }));
  check('let go over a button: it is pressed (the unlock)', st.c === 2 && st.left === 0, st);
  // select the first mod again (a tap on its cell), then the arrow keys step down to Dispense
  await page.evaluate(id => document.querySelector('.vcell[data-id="' + id + '"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })), got);
  await page.waitForTimeout(80);
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(60); await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(60);
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(60); await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(60);
  check('the arrow keys still step the highlight (to Dispense)', (await focus()) === 'buy', await focus());
  const price = await page.evaluate(id => priceOf(id), got);
  line = await page.evaluate(() => document.querySelector('.vbuy').textContent);
  check('it shows the selected mod\'s price', line === 'Dispense selected' + price + 'g', line);
  await page.screenshot({ path: path.join(DIR, 'vendshop_menu.png') });

  // too poor: stays open
  await page.evaluate(() => { window.__in.current.loadout.gold = 0; window.__in.current.menuTap(); });
  await page.waitForTimeout(80);
  check('without the gold it stays open', await page.evaluate(() => !!document.querySelector('.vshop')));
  await page.evaluate(() => { window.__in.current.loadout.gold = 1000; });
  await page.mouse.move(stick.x, stick.y); await page.mouse.down(); await page.mouse.up();   // a tap on the right stick presses the highlight
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

  // a crystal in the cave flies to you like gold (v0.0.137): no card, no tap
  st = await page.evaluate(async () => {
    const L = window.__lvl, q = L.pickups.find(q => q.kind === 'crystal');
    const before = window.__in.current.loadout.crystals.length;
    L.p.x = q.x - 6; L.p.y = q.y - 13; L.p.vx = L.p.vy = 0; window.__in.current.sig = '';
    await new Promise(r => setTimeout(r, 250));
    const card = !!document.querySelector('.buypanel');
    await new Promise(r => setTimeout(r, 200));
    return { card, before, after: window.__in.current.loadout.crystals.length, taken: !L.pickups.includes(q) };
  });
  check('standing at a crystal: no card, it is collected by itself', !st.card && st.after === st.before + 1 && st.taken, st);

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
