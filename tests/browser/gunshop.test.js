// The gun vending machine (src/ui/gunshop.js, spells/gunshop.js): it stands in the shop with the
// gun hologram; its menu offers three guns of the floor's pool with prices; Reroll costs gold and
// gets dearer; the boosted reroll costs red crystals (1, then 2) and rolls deeper, boosted guns;
// the reels stop one at a time; Buy selected pops the gun out onto the floor. Also: an elite
// creature drops red and green crystals when it dies (one tap takes the pile), and the top bar counts your crystals.
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

  const s0 = await page.evaluate(() => ({ kinds: [...new Set(window.__lvl.pickups.map(q => q.kind))],
    n: window.__lvl.pickups.length, elites: window.__lvl.enemies.filter(e => e.k.elite).length }));
  check('the cave has only red crystals lying about (no guns, no mods)', s0.kinds.length === 1 && s0.kinds[0] === 'crystal', s0);
  // (how many elites a floor gets is the logic suite's: a random cave can have none)

  const MX = await page.evaluate(() => SHOPS.guns.x);
  await page.evaluate(x => { const L = window.__lvl; L.p.x = x - 6; L.p.vx = 0; window.__in.current.sig = ''; }, MX);
  await page.waitForTimeout(300);
  check('standing at it: "Tap R to shop"', await page.evaluate(() => window.__in.current.prompt && window.__in.current.prompt.shop === 'guns'));
  await page.screenshot({ path: path.join(DIR, 'gunshop_machine.png') });

  await page.evaluate(() => { window.__in.current.loadout.gold = 5000; window.__in.current.interact = true; });
  await page.waitForTimeout(300);
  let st = await page.evaluate(() => {
    const o = window.__in.current.loadout.gunShop;
    return { open: !!document.querySelector('.gshop'), reels: document.querySelectorAll('.greel').length,
      prices: [...document.querySelectorAll('.gprice')].map(e => e.textContent), want: o.guns.map(g => shopGunPrice(g) + 'g'),
      lv: o.guns.map(g => g.lvl), card: !!document.querySelector('.gcard .pop .dtiles'), floor: o.floor };
  });
  check('the menu opens with three guns', st.open && st.reels === 3, st);
  check('each priced under it', JSON.stringify(st.prices) === JSON.stringify(st.want), st);
  check('of the floor\'s pool', st.floor === 1 && st.lv.every(l => l >= 1), st.lv);
  check('the selected gun\'s card shows its mod grid', st.card);
  await page.screenshot({ path: path.join(DIR, 'gunshop_menu.png') });

  const down = sel => page.evaluate(s => { document.querySelector(s).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); }, sel);
  // a gold reroll: charged, dearer next time, the reels stop one at a time
  const rr0 = await page.evaluate(() => rerollPrice(1, 0));
  await down('.greroll');
  const order = [];
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(50);
    const p = await page.evaluate(() => [...document.querySelectorAll('.gprice')].map(e => e.textContent !== '···'));
    p.forEach((v, j) => { if (v && !order.includes(j)) order.push(j); });
    if (order.length === 3) break;
    if (i === 12) await page.screenshot({ path: path.join(DIR, 'gunshop_spin.png') });
  }
  st = await page.evaluate(() => ({ gold: window.__in.current.loadout.gold, next: document.querySelector('.greroll span').textContent,
    rerolls: window.__in.current.loadout.gunShop.rerolls }));
  check('the reels lock in one at a time, top to bottom', JSON.stringify(order) === '[0,1,2]', order);
  check('a reroll costs gold', st.gold === 5000 - rr0, { st, rr0 });
  check('and the next costs more', parseInt(st.next) > rr0 && st.rerolls === 1, st);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(DIR, 'gunshop_landed.png') });

  // boosted: needs a crystal; then 1, then 2
  await down('.gboost');
  await page.waitForTimeout(100);
  check('no crystals: the boosted reroll refuses', await page.evaluate(() => window.__in.current.loadout.gunShop.boosts === 0));
  await page.evaluate(() => { window.__in.current.loadout.crystals = [1, 1, 1, 1]; window.__in.current.notify(); });
  await page.waitForTimeout(50);
  await down('.gboost');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(DIR, 'gunshop_boost.png') });
  await page.waitForTimeout(2500);
  st = await page.evaluate(() => ({ c: window.__in.current.loadout.crystals.length, guns: window.__in.current.loadout.gunShop.guns.map(g => ({ lvl: g.lvl, b: !!g.boosted })),
    cost: document.querySelector('.gboost .gcost').textContent, top: document.querySelectorAll('.gold .crysrow .cbit.red').length }));
  check('the first boosted reroll costs one crystal, the next two', st.c === 3 && st.cost === '×2', st);
  check('boosted guns: deeper levels, marked boosted', st.guns.every(g => g.b && g.lvl >= 2), st.guns);
  check('the top bar shows a red silhouette per crystal', st.top === 3, st.top);

  // buy the selected (the first): gold taken, menu shut, the gun pops out onto the floor
  const buy = await page.evaluate(() => { const g = window.__in.current.loadout.gunShop.guns[0]; return { name: g.name, price: shopGunPrice(g), gold: window.__in.current.loadout.gold }; });
  await page.evaluate(() => window.__in.current.menuTap && null);
  await down('.gbtns > .vbuy');
  await page.waitForTimeout(150);
  st = await page.evaluate(() => ({ open: !!document.querySelector('.gshop'), gold: window.__in.current.loadout.gold,
    sold: window.__in.current.loadout.gunShop.guns[0] === null }));
  check('Buy: the gold goes, the menu closes, the slot is sold', !st.open && st.gold === buy.gold - buy.price && st.sold, { st, buy });
  let q = null;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(100);
    q = await page.evaluate(n => { const q = window.__lvl.pickups.find(q => q.kind === 'gun' && q.gun.name === n); return q && { x: q.x, y: q.y, fly: q.vy !== undefined }; }, buy.name);
    if (q && !q.fly) break;
  }
  check('the gun landed on the floor beside the machine', !!q && !q.fly && Math.abs(q.x - MX) > 25, { q, MX });
  await page.screenshot({ path: path.join(DIR, 'gunshop_dropped.png') });

  // an elite in a sandbox dies and drops red and green crystals that fall to the floor; they fly to you like gold
  st = await page.evaluate(async () => {
    DEV.elRedLo = DEV.elRedHi = 3; DEV.elGreenLo = DEV.elGreenHi = 1;
    const L = window.__lvl, e = L.enemies.find(e => e.k.elite) || Object.assign(L.enemies.find(e => !e.nest), {}), room = L.sandbox();
    if (!e.k.elite) e.k = eliteOf(e.k);                  // no elite in this cave: make one
    if (!L.enemies.includes(e)) L.enemies.push(e);         // the sandbox clears its box
    const i = L.enemies.indexOf(e);
    e.x = room.x + 60; e.y = e.ty = room.y - 40; e.hp = 0.001;
    const n0 = L.pickups.length;
    const LO = window.__in.current.loadout, r0 = (LO.crystals || []).length, g0 = (LO.greens || []).length;   // one may fly in early
    L.p.x = room.l + 10;                                   // stand well clear while it falls
    damageEnemy(L, i, 5);
    const drop = L.pickups.slice(n0);
    for (let k = 0; k < 60 && drop.some(q => q.vy !== undefined); k++) await new Promise(r => setTimeout(r, 50));
    const out = { reds: drop.filter(q => q.kind === 'crystal' && !q.green).length, greens: drop.filter(q => q.kind === 'crystal' && q.green).length,
      rest: drop.every(q => q.vy === undefined || q.taken), dy: drop.map(q => Math.round(room.y - q.y)) };
    // stand by the pile: every crystal in reach flies in, no tap
    const mx = drop.reduce((s, q) => s + q.x, 0) / drop.length;
    for (const q of drop) q.x = mx + (q.x - mx) * 0.2;   // close together, as a pile you can stand in
    L.p.x = mx - 6; L.p.y = room.y - 22.5; L.p.vx = L.p.vy = 0;
    for (let k = 0; k < 40 && !drop.every(q => q.taken); k++) await new Promise(requestAnimationFrame);
    out.tookReds = (LO.crystals || []).length - r0; out.tookGreens = (LO.greens || []).length - g0;
    out.taken = drop.every(q => q.taken);
    return out;
  });
  check('an elite drops red and green crystals that come to rest on the floor', st.reds === 3 && st.greens === 1 && st.rest && st.dy.every(d => d >= 0 && d < 20), st);
  check('the whole pile flies to you, reds and greens', st.tookReds === 3 && st.tookGreens === 1 && st.taken, st);

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
