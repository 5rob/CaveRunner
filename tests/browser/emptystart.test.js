// v0.0.142: a new run starts with no guns and no gold (window.__TEST_EMPTY: the test page otherwise
// hands out the old kit); while you have no gun the gun machine's first reel is a Scratch Pistol, free;
// and a crystal machine no real crystal has gone into yet plays a hologram demo while you stand near it:
// a crystal blinks in on the floor beside it and is sucked into the slot, on a loop (stepDemo, drawDemo).
// Screenshots: emptystart-*.png (phone size).
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const DIR = path.join(__dirname, '..', 'build');

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_EMPTY = true; });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(DIR, 'test.html'));
  await page.waitForTimeout(1300);
  const shot = n => page.screenshot({ path: path.join(DIR, 'emptystart-' + n + '.png') });
  const frames = n => page.evaluate(async n => { for (let i = 0; i < n; i++) await new Promise(r => requestAnimationFrame(r)); }, n);

  // ---- empty hands ----
  let st = await page.evaluate(() => { const LO = window.__in.current.loadout; return { guns: LO.guns.filter(Boolean).length, slots: LO.guns.length, gold: LO.gold }; });
  check('a new run: no guns, no gold', st.guns === 0 && st.slots === 4 && st.gold === 0, st);
  // tapping fire with nothing in hand does nothing (and breaks nothing)
  await page.evaluate(() => { window.__in.current.right = { active: true, nx: 1, ny: 0, mag: 1, dy: 0, on: true, show: true }; });
  await frames(20);
  await page.evaluate(() => { window.__in.current.right = { active: false, nx: 0, ny: 0, mag: 0, dy: 0, on: false }; });
  check('firing with no gun shoots nothing', await page.evaluate(() => window.__lvl.bullets.length === 0));
  // a save with no guns is still a run
  st = await page.evaluate(() => { const s = readSave(JSON.stringify({ ver: VERSION, floor: 1, loadout: window.__in.current.loadout })); return { ok: !!s, guns: s && s.loadout.guns.length, sel: s && s.loadout.sel }; });
  check('and saves and loads like that', st.ok && st.guns === 4 && st.sel === 0, st);

  // ---- the gun machine: the first is a free Scratch Pistol ----
  const open = () => page.evaluate(async () => {
    const L = window.__lvl, fy = L.world.SHOP_FLOOR * L.world.CELL;
    L.p.x = SHOPS.guns.x - 6; L.p.y = fy - 22.5; L.p.vx = L.p.vy = 0; window.__in.current.sig = '';
    for (let i = 0; i < 10; i++) await new Promise(r => requestAnimationFrame(r));
    window.__in.current.interact = true;
    for (let i = 0; i < 20; i++) await new Promise(r => requestAnimationFrame(r));
    const o = window.__in.current.loadout.gunShop;
    return { open: !!document.querySelector('.gshop'), prices: [...document.querySelectorAll('.gprice')].map(e => e.textContent),
      buy: document.querySelector('.vbuy b').textContent, want1: shopGunPrice(o.guns[1]) + 'g', offer0: o.guns[0] && o.guns[0].name };
  });
  st = await open();
  check('the menu opens', st.open, st);
  check('the first gun is free', st.prices[0] === 'FREE' && st.prices[1] === st.want1, st);
  check('"Take it"', st.buy === 'Take it', st);
  await shot('1-free');
  st = await page.evaluate(async () => {
    document.querySelector('.vbuy').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    for (let i = 0; i < 40; i++) await new Promise(r => requestAnimationFrame(r));
    const q = window.__lvl.pickups.find(q => q.kind === 'gun');
    return { closed: !document.querySelector('.gshop'), gold: window.__in.current.loadout.gold, gun: q && q.gun.name,
      slots: q && q.gun.slots, offer0: !!window.__in.current.loadout.gunShop.guns[0] };
  });
  check('taking it costs nothing and pops a Scratch Pistol out', st.closed && st.gold === 0 && st.gun === 'Scratch Pistol' && st.slots[0] === 'bolt', st);
  check('the offer\'s own first gun is still there for later', st.offer0, st);
  await shot('2-pistol');
  // once you have a gun, the first is the offer's again, at its price
  st = await page.evaluate(() => { const LO = window.__in.current.loadout, q = window.__lvl.pickups.find(q => q.kind === 'gun');
    LO.guns[0] = q.gun; LO.sel = 0; window.__lvl.pickups.splice(window.__lvl.pickups.indexOf(q), 1); return true; });
  st = await open();
  check('with a gun in hand nothing is free', st.prices[0] !== 'FREE' && st.prices[0].endsWith('g') && st.buy === 'Buy selected', st);
  await page.evaluate(() => { document.querySelector('.vclose').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); });
  await frames(10);

  // ---- the crystal machines' demo ----
  const at = (k, dx) => page.evaluate(async ({ k, dx }) => {
    const L = window.__lvl, fy = L.world.SHOP_FLOOR * L.world.CELL;
    L.p.x = SHOPS[k].x + dx - 6; L.p.y = fy - 22.5; L.p.vx = L.p.vy = 0;
    for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
  }, { k, dx });
  const demo = k => page.evaluate(k => { const d = window.__lvl.demo[k]; return d ? { t: d.t, side: d.side, ...demoAt(d.t) } : null; }, k);
  await at('mods', -160);
  check('far from the red machine: no demo', !(await demo('mods')));
  await at('mods', -70);
  let d = await demo('mods');
  check('near it: the demo starts, on your side', d && d.ph === 'in' && d.side === -1, d);
  // walk through one loop, a screenshot in each part
  const seen = new Set();
  for (let i = 0; i < 400 && seen.size < 5; i++) {
    d = await demo('mods');
    if (!d) break;
    if (!seen.has(d.ph) && (d.ph !== 'in' || d.u > 0.6) && (d.ph !== 'suck' || d.u > 0.45)) { seen.add(d.ph); await shot('3-red-' + seen.size + '-' + d.ph); }
    await page.evaluate(() => { const L = window.__lvl; L.p.vx = 0; });
    await page.waitForTimeout(25);
  }
  check('it plays: in, sits, sucked in, flash, a gap', ['in', 'sit', 'suck', 'flash', 'gap'].every(p => seen.has(p)), [...seen]);
  const loop = await page.evaluate(() => DEMO_LOOP - DEMO_IN - DEMO_SIT - DEMO_SUCK - DEMO_FLASH);
  check('about 2 seconds between loops', Math.abs(loop - 2) < 0.01, loop);
  // and loops
  for (let i = 0; i < 200; i++) { d = await demo('mods'); if (d && d.t > (await page.evaluate(() => DEMO_LOOP)) && d.ph === 'in') break; await page.waitForTimeout(25); }
  check('then again', d && d.ph === 'in', d);
  // the green one too, on the right
  await at('perks', 70);
  await frames(30);
  d = await demo('perks');
  check('the green machine plays it as well, on your side', d && d.side === 1 && !(await demo('mods')), d);
  for (let i = 0; i < 100; i++) { d = await demo('perks'); if (d && d.ph === 'sit') break; await page.waitForTimeout(25); }
  await shot('4-green-sit');
  // a real crystal goes into the red machine: no more demo there
  st = await page.evaluate(async () => {
    const L = window.__lvl, m = SHOPS.mods, fy = L.world.SHOP_FLOOR * L.world.CELL;
    L.p.x = m.x - 76; L.p.y = fy - 22.5; L.p.vx = L.p.vy = 0;
    L.pickups.push({ kind: 'crystal', x: m.x - 40, y: fy - 8, floor: 1, t: 0 });
    for (let i = 0; i < 120; i++) { await new Promise(r => requestAnimationFrame(r)); L.p.vx = 0; L.p.x = m.x - 76; }
    return { fed: window.__in.current.loadout.fed, demo: !!L.demo.mods };
  });
  check('a real crystal in: that machine stops showing how', st.fed && st.fed.includes('mods') && !st.demo, st);
  await at('perks', 70);
  await frames(10);
  check('the other still does', !!(await demo('perks')));

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
