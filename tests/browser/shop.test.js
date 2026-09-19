const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1300);

  // you start in the shop, on the floor, with stock around you
  let st = await page.evaluate(() => ({
    floor: window.__lvl.floor, inShop: window.__in.current.inShop,
    gold: window.__in.current.loadout.gold,
    stock: window.__lvl.stock.map(i => i.kind === 'heal' ? 'heal' : i.id + '/' + i.price),
    py: window.__lvl.p.y, shopY: 742 * 2,
  }));
  check('starts on floor 1 inside the shop', st.floor === 1 && st.inShop === true, st);
  check('shop has a heal and 4 mods', st.stock.length === 5 && st.stock[0] === 'heal', st.stock);
  check('spawns below the shop ceiling', st.py > st.shopY, { py: st.py, shopY: st.shopY });
  check('starts with some gold', st.gold === 40, st.gold);
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'shop_room.png') });

  // mods are locked outside the shop
  const modsLabel = () => page.evaluate(() => document.querySelector('.weapon').textContent);
  check('Mods available in the shop', (await modsLabel()).indexOf('Mods') >= 0, await modsLabel());

  // walk onto the free heal: prompt appears, taking it heals
  const goTo = async (item) => page.evaluate(async i => {
    const { p, stock } = window.__lvl;
    p.x = stock[i].x - 6; p.y = stock[i].y + 4; p.vx = 0; p.vy = 0;
    await new Promise(r => setTimeout(r, 260));
  }, item);

  await page.evaluate(() => { window.__lvl.p.hp = 40; });
  await goTo(0);
  let btn = await page.evaluate(() => { const b = document.querySelector('.buy'); return b && b.textContent; });
  check('standing on the heal shows a prompt', !!btn && /Take/.test(btn), btn);
  await page.tap('.buy');
  await page.waitForTimeout(250);
  st = await page.evaluate(() => ({ hp: window.__lvl.p.hp, sold: window.__lvl.stock[0].sold }));
  check('the heal restores full health and is used up', st.hp === 100 && st.sold === true, st);

  // buy a mod
  await goTo(1);
  const item1 = await page.evaluate(() => ({ id: window.__lvl.stock[1].id, price: window.__lvl.stock[1].price }));
  await page.evaluate(() => { window.__in.current.loadout.gold = 500; window.__in.current.sig = ''; });
  await page.waitForTimeout(220);
  await page.tap('.buy');
  await page.waitForTimeout(250);
  st = await page.evaluate(() => ({ gold: window.__in.current.loadout.gold,
    bag: window.__in.current.loadout.bag.slice(), sold: window.__lvl.stock[1].sold }));
  check('buying takes the gold', st.gold === 500 - item1.price, { st, item1 });
  check('the mod lands in the bag', st.bag.includes(item1.id), st.bag);
  check('the stock is marked sold', st.sold === true, st);

  // can't afford it
  await goTo(2);
  await page.evaluate(() => { window.__in.current.loadout.gold = 0; window.__in.current.sig = ''; });
  await page.waitForTimeout(250);
  const cant = await page.evaluate(() => { const b = document.querySelector('.buy'); return b && b.className; });
  check('unaffordable stock is shown greyed', /cant/.test(cant || ''), cant);
  await page.tap('.buy');
  await page.waitForTimeout(200);
  check('and cannot be bought', (await page.evaluate(() => window.__lvl.stock[2].sold)) === false);

  // enemies drop gold
  st = await page.evaluate(async () => {
    const { enemies, coins, p } = window.__lvl;
    const LO = window.__in.current.loadout;
    LO.gold = 0;
    const e = enemies[0];
    e.x = p.x; e.y = p.y - 40; e.ty = e.y;      // bring one down to us and kill it
    e.hp = 0.0001;
    window.__lvl.bullets.push({ x: e.x, y: e.ty, vx: 60, vy: 0, life: 1, dmg: 5, size: 3,
      col: '#fff', spin: 0, homing: 0, bounce: 0, pierce: 0, explode: 0, grav: 0, accel: 0, bore: 0, hit: null });
    await new Promise(r => setTimeout(r, 200));
    await new Promise(r => setTimeout(r, 900));
    return { gold: LO.gold, left: coins.length };
  });
  check('a dead enemy pays out gold', st.gold > 0, st);
  check('and the coin is gone once collected', st.left === 0, st);

  // leaving the shop locks the mod screen
  await page.evaluate(async () => {
    window.__lvl.p.y = 400; window.__lvl.p.x = 320; window.__lvl.p.vy = 0;
    await new Promise(r => setTimeout(r, 200));
  });
  check('Mods locked outside the shop', (await modsLabel()).indexOf('Shop only') >= 0, await modsLabel());
  await page.evaluate(() => { window.__in.current.found = null; window.__in.current.notify(); });
  await page.waitForTimeout(120);
  await page.tap('.weapon');
  await page.waitForTimeout(200);
  check('tapping it out there does nothing', (await page.$('.sheet')) === null);

  // the portal drops you into the next floor's shop
  st = await page.evaluate(async () => {
    const LO = window.__in.current.loadout;
    LO.bag.push('homing');
    const before = { floor: window.__lvl.floor, bag: LO.bag.length, gold: LO.gold, hp: window.__lvl.p.hp };
    window.__lvl.p.hp = 55;
    const pt = { x: 320, y: 34 * 2 };
    window.__lvl.p.x = 320 - 6; window.__lvl.p.y = 30;      // drop onto the portal
    await new Promise(r => setTimeout(r, 400));
    return { before, floor: window.__lvl.floor, inShop: window.__in.current.inShop,
      py: window.__lvl.p.y, bag: LO.bag.length, gold: LO.gold, hp: window.__lvl.p.hp,
      stock: window.__lvl.stock.filter(i => !i.sold).length, enemies: window.__lvl.enemies.length };
  });
  check('portal advances the floor', st.floor === st.before.floor + 1, st);
  check('you arrive in the new shop', st.inShop === true && st.py > 742 * 2, st);
  check('the new shop is fully stocked', st.stock === 5, st);
  check('the new floor has enemies', st.enemies > 0, st.enemies);
  check('you keep your mods and gold', st.bag === st.before.bag && st.gold === st.before.gold, st);
  check('and your damage carries over', st.hp === 55, st.hp);
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'shop_floor2.png') });

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
