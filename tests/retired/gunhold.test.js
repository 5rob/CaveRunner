// The HUD gun slots (ui/gunhold.js, v0.0.149): hold a slot by a gun on the ground to take it;
// hold one with nothing in reach to drag its gun out and drop it; tap the gun in hand for its card.
// In a sandbox room. SHOTS=<dir> also saves the owner's screenshots (the ring filling, a drag).
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1200);
  const shot = async name => { if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, name) }); };
  const room = await page.evaluate(() => window.__lvl.sandbox({ w: 360 }));
  await page.waitForTimeout(400);
  const LO = () => page.evaluate(() => {
    const l = window.__in.current.loadout;
    return { sel: l.sel, guns: l.guns.map(g => g && g.name) };
  });
  const slotAt = async i => { const bb = await (await page.$$('.slots .slot'))[i].boundingBox(); return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }; };
  const start = await LO();
  const empty = start.guns.indexOf(null);
  check('the test kit leaves an empty slot', empty >= 0, start);

  // ---- 1. a gun at your feet: hold the empty slot, it goes in ----
  const name = await page.evaluate(() => {
    const L = window.__lvl, gun = makeGun(Math.random, 1);
    L.pickups.push({ kind: 'gun', gun, x: L.p.x + 6, y: L.p.y + 11, t: 0 });
    return gun.name;
  });
  await page.waitForTimeout(300);
  check('the HUD knows a gun is in reach', await page.evaluate(() => !!window.__in.current.gunNear));
  let s = await slotAt(empty);
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await page.waitForTimeout(250);
  const ring = await page.evaluate(() => !!document.querySelector('.slot .holdring'));
  check('a ring shows round the held slot', ring);
  await shot('item5-hold-ring.png');
  await page.waitForTimeout(400);
  await page.mouse.up();
  await page.waitForTimeout(250);
  let lo = await LO();
  check('holding the slot took the gun into it', lo.guns[empty] === name, { lo, name });
  check('and it is gone from the ground', await page.evaluate(() => !window.__lvl.pickups.some(q => q.kind === 'gun' && !q.taken)));

  // ---- 2. a swap: a second gun, hold a filled slot, your old gun lies where it was ----
  const name2 = await page.evaluate(() => {
    const L = window.__lvl, gun = makeGun(Math.random, 1);
    L.pickups.push({ kind: 'gun', gun, x: L.p.x + 6, y: L.p.y + 11, t: 0 });
    return gun.name;
  });
  await page.waitForTimeout(300);
  s = await slotAt(empty);
  await page.mouse.move(s.x, s.y); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
  await page.waitForTimeout(250);
  lo = await LO();
  const ground = await page.evaluate(() => window.__lvl.pickups.filter(q => q.kind === 'gun' && !q.taken).map(q => q.gun.name));
  check('holding a filled slot swaps', lo.guns[empty] === name2 && ground.length === 1 && ground[0] === name, { lo, ground });

  // ---- 3. nothing in reach: hold a slot, drag the gun out, let go on open floor ----
  await page.evaluate(() => { window.__lvl.pickups.length = 0; });
  await page.waitForTimeout(250);
  const before = await LO();
  const dropW = { x: room.x + 90, y: room.y - 30 };
  const target = await page.evaluate(w => {
    const L = window.__lvl, r = document.querySelector('canvas').getBoundingClientRect();
    return { x: r.left + (w.x - L.camX) * L.unitPx, y: r.top + (w.y - L.camY) * L.unitPx };
  }, dropW);
  s = await slotAt(empty);
  await page.mouse.move(s.x, s.y); await page.mouse.down(); await page.waitForTimeout(600);
  for (let k = 1; k <= 10; k++) { await page.mouse.move(s.x + (target.x - s.x) * k / 10, s.y + (target.y - s.y) * k / 10); await page.waitForTimeout(30); }
  const dragging = await page.evaluate(() => !!document.querySelector('.gundrag'));
  check('the lifted gun follows the finger', dragging);
  await shot('item5-drag.png');
  await page.mouse.up();
  await page.waitForTimeout(300);
  lo = await LO();
  const dropped = await page.evaluate(() => window.__lvl.pickups.filter(q => q.kind === 'gun').map(q => ({ name: q.gun.name, x: Math.round(q.x), y: Math.round(q.y) })));
  check('it left your guns', lo.guns[empty] === null, lo);
  check('and lies on the ground where you let go', dropped.length === 1 && dropped[0].name === before.guns[empty] &&
    Math.abs(dropped[0].x - dropW.x) < 4 && dropped[0].y > dropW.y && dropped[0].y < room.y, { dropped, dropW, floor: room.y });

  // ---- 4. let go back over its own button: nothing happens ----
  const filled = lo.guns.findIndex(Boolean);
  s = await slotAt(filled);
  await page.mouse.move(s.x, s.y); await page.mouse.down(); await page.waitForTimeout(600);
  await page.mouse.move(s.x - 60, s.y - 120); await page.waitForTimeout(60);
  await page.mouse.move(s.x, s.y); await page.waitForTimeout(60);
  await page.mouse.up(); await page.waitForTimeout(250);
  check('letting go over its own slot keeps it', (await LO()).guns[filled] === lo.guns[filled]);

  // ---- 5. taps: another slot equips it; the gun in hand shows its card ----
  const other = lo.guns.findIndex((g, i) => g && i !== lo.sel);
  if (other >= 0) {
    await page.tap('.slots .slot >> nth=' + other);
    await page.waitForTimeout(200);
    check('tapping another slot equips it', (await LO()).sel === other);
  }
  const sel = (await LO()).sel;
  check('no card before the tap', !(await page.$('.pop')));
  await page.tap('.slots .slot >> nth=' + sel);
  await page.waitForTimeout(250);
  const card = await page.evaluate(() => { const b = document.querySelector('.pop .ptitle b'); return b && b.textContent; });
  check('tapping the gun in hand shows its card', card === (await LO()).guns[sel], card);

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
